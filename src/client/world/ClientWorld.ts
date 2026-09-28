import type { Scene } from "three";
import { TICK_DT } from "../../shared/config";
import type { StatusId } from "../../shared/content/types";
import { statusIds, type EntitySnap } from "../../shared/net/codec";
import { makeSampledPose, SnapshotBuffer, type SampledPose } from "../../shared/net/interp";
import type { EntityInfo } from "../../shared/net/protocol";
import { EntityType } from "../../shared/sim/entity";
import type { FloorLayout } from "../../shared/world/layout";
import type { Particles } from "../fx/particles";
import type { LightManager } from "../render/lights";
import { createView, type EntityView } from "./views";

/** Everything a view needs from the outside world. */
export interface ViewContext {
  scene: Scene;
  lights: LightManager;
  particles: Particles;
  layout: FloorLayout | null;
  /** Local seconds (monotonic). */
  now(): number;
  groundAt(x: number, z: number): number;
}

/** A replicated entity as the client knows it. */
export class ClientEntity {
  readonly buffer = new SnapshotBuffer();
  readonly pose: SampledPose = makeSampledPose();
  flags = 0;
  hp = 1;
  statuses: StatusId[] = [];
  statusBits = 0;
  anim = 0;
  variant = 0;
  /** Local time (s) when the current anim began. */
  animStart = 0;
  info: EntityInfo | null = null;
  view: EntityView | null = null;
  /** Hit flash 0..1, decays in the view. */
  flash = 0;
  flashColor: [number, number, number] = [1, 1, 1];
  seen = false;

  constructor(
    readonly id: number,
    readonly type: EntityType,
    readonly def: string,
  ) {}

  get x() {
    return this.pose.p[0];
  }
  get y() {
    return this.pose.p[1];
  }
  get z() {
    return this.pose.p[2];
  }
  get yaw() {
    return this.pose.a?.[0] ?? 0;
  }
}

/** The client-side mirror of a floor: applies snapshots, samples
 * interpolation buffers on the shared timeline and drives entity views. */
export class ClientWorld {
  readonly entities = new Map<number, ClientEntity>();
  private pendingInfo = new Map<number, EntityInfo>();

  constructor(
    readonly ctx: ViewContext,
    /** Our own delver's entity id (rendered in first person, no view). */
    public selfId: number,
  ) {}

  applySnapshot(entities: EntitySnap[], removed: number[], serverTime: number): void {
    const now = this.ctx.now();
    for (const s of entities) {
      let e = this.entities.get(s.id);
      if (!e || e.type !== s.type || e.def !== s.def) {
        if (e) this.drop(e);
        e = new ClientEntity(s.id, s.type, s.def);
        e.info = this.pendingInfo.get(s.id) ?? null;
        this.pendingInfo.delete(s.id);
        this.entities.set(s.id, e);
      }
      e.buffer.push({ t: serverTime, p: [s.x, s.y, s.z], v: [s.vx, s.vy, s.vz], q: s.quat ?? undefined, a: [s.yaw] });
      e.flags = s.flags;
      if (s.hp < e.hp - 0.001) {
        e.flash = 1;
        e.flashColor = [1, 0.35, 0.3];
      }
      e.hp = s.hp;
      if (s.statuses !== e.statusBits) {
        e.statusBits = s.statuses;
        e.statuses = statusIds(s.statuses);
      }
      const start = now - s.animAge * TICK_DT;
      if (s.anim !== e.anim || s.variant !== e.variant || Math.abs(start - e.animStart) > 0.25) {
        e.anim = s.anim;
        e.variant = s.variant;
        e.animStart = start;
      }
      if (!e.view && e.id !== this.selfId) {
        // First sample defines where the view appears.
        e.buffer.sample(serverTime, e.pose);
        e.view = createView(e, this.ctx);
      }
    }
    for (const id of removed) {
      const e = this.entities.get(id);
      if (e) this.drop(e);
    }
  }

  setInfo(list: EntityInfo[]): void {
    for (const info of list) {
      const e = this.entities.get(info.id);
      if (e) {
        e.info = info;
        e.view?.onInfo?.(info);
      } else this.pendingInfo.set(info.id, info);
    }
  }

  /** Sample every buffer at the render time and update views. */
  update(renderServerTime: number, dt: number): void {
    const now = this.ctx.now();
    for (const e of this.entities.values()) {
      e.buffer.sample(renderServerTime, e.pose);
      e.flash = Math.max(0, e.flash - dt * 5);
      e.view?.update(e, dt, now);
    }
  }

  get(id: number): ClientEntity | undefined {
    return this.entities.get(id);
  }

  private drop(e: ClientEntity): void {
    e.view?.dispose();
    e.view = null;
    this.entities.delete(e.id);
  }

  clear(): void {
    for (const e of this.entities.values()) e.view?.dispose();
    this.entities.clear();
    this.pendingInfo.clear();
  }
}
