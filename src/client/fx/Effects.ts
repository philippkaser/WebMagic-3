import { Vector3 } from "three";
import { CREATURES, PROPS, SPELLS } from "../../shared/content";
import type { Element } from "../../shared/content/types";
import { EntityType } from "../../shared/sim/entity";
import type { SimEvent } from "../../shared/sim/events";
import { audio } from "../audio";
import type { LightManager } from "../render/lights";
import type { ClientWorld } from "../world/ClientWorld";
import type { SurfaceLayer } from "../world/SurfaceLayer";
import type { Bolts } from "./bolts";
import { ELEMENT_COLOR, ELEMENT_HEX, hexLinear } from "./palette";
import type { Particles } from "./particles";

/** Turns simulation events into what you see and hear: bursts, flashes,
 * debris, bolts, screen shake, sounds, and UI notifications. */

export interface EffectsHooks {
  shake(amount: number): void;
  damageNumber(p: [number, number, number], amount: number, element: Element, crit: boolean, onSelf: boolean): void;
  toast(text: string, kind: string): void;
  banner(title: string, sub: string): void;
  selfId(): number;
  cameraPos(): Vector3;
}

type P3 = [number, number, number];
const v = (p: P3) => ({ x: p[0], y: p[1], z: p[2] });

export class Effects {
  constructor(
    private particles: Particles,
    private lights: LightManager,
    private bolts: Bolts,
    private world: () => ClientWorld | null,
    private surfaces: () => SurfaceLayer | null,
    private hooks: EffectsHooks,
  ) {}

  handle(events: SimEvent[]): void {
    for (const ev of events) {
      try {
        this.one(ev);
      } catch (err) {
        console.warn("effect failed", ev.t, err);
      }
    }
  }

  private one(ev: SimEvent): void {
    const P = this.particles;
    const self = this.hooks.selfId();
    switch (ev.t) {
      case "cast": {
        const spell = SPELLS.find(ev.spell);
        if (!spell) return;
        if (ev.by !== self) {
          const c = hexLinear(spell.vfx.color, 2);
          this.burst(ev.p, c, 6, 1.5, 0.25, "spark");
          this.lights.flash(v(ev.p), spell.vfx.color, 2, 4, 0.12);
        }
        if (spell.sfx?.cast && ev.by !== self) audio.play(spell.sfx.cast, { pos: v(ev.p) });
        return;
      }
      case "impact": {
        const c = ELEMENT_COLOR[ev.el];
        this.burst(ev.p, c, 14, 3.5, 0.4, ev.el === "fire" ? "ember" : ev.el === "frost" ? "shard" : "spark", ev.n);
        this.puff(ev.p, 2, 0.5);
        this.lights.flash(v(ev.p), ELEMENT_HEX[ev.el], 3, 5, 0.18);
        const spell = SPELLS.find(ev.spell);
        audio.play(spell?.sfx?.hit ?? `hit_${ev.el}`, { pos: v(ev.p) });
        return;
      }
      case "hit": {
        const target = this.world()?.get(ev.id);
        const onSelf = ev.id === self;
        this.hooks.damageNumber(ev.p, ev.amt, ev.el, ev.crit, onSelf);
        if (onSelf) {
          this.hooks.shake(Math.min(0.5, ev.amt / 40));
          if (ev.amt >= 3) audio.play("player_hurt");
          return;
        }
        if (!target) return;
        if (target.type === EntityType.Creature) {
          const def = CREATURES.find(target.def);
          const bony = def?.faction === "dead";
          this.burst(ev.p, bony ? [0.8, 0.75, 0.6] : [0.35, 0.02, 0.02], bony ? 6 : 10, 2.5, 0.5, bony ? "bone_chip" : "blood", undefined, false, -9);
          audio.play(bony ? "hit_bone" : "hit_flesh", { pos: v(ev.p) });
          if (def?.voice && Math.random() < 0.5) audio.voice(def.voice, "hurt", { pos: v(ev.p), pitch: 1 / (def.scale ?? 1) });
          if (ev.crit) audio.play("crit", { pos: v(ev.p) });
        } else if (target.type === EntityType.Prop) {
          const mat = PROPS.find(target.def)?.material;
          audio.play(mat === "metal" ? "hit_metal" : mat === "stone" ? "hit_stone" : "hit_wood", { pos: v(ev.p) });
          this.burst(ev.p, [0.5, 0.35, 0.2], 5, 2, 0.5, "splinter", undefined, false, -9);
        } else if (target.type === EntityType.Player) {
          this.burst(ev.p, [0.35, 0.02, 0.02], 8, 2.5, 0.5, "blood", undefined, false, -9);
          audio.play("hit_flesh", { pos: v(ev.p) });
        }
        return;
      }
      case "explode": {
        const c = ELEMENT_COLOR[ev.el];
        const n = Math.round(20 + ev.r * 14);
        this.burst(ev.p, c, n, ev.r * 3.2, 0.6, ev.el === "fire" ? "flame" : "glow");
        this.burst(ev.p, [c[0] * 0.5, c[1] * 0.5, c[2] * 0.5], n / 2, ev.r * 1.5, 1, "spark");
        this.puff(ev.p, Math.round(6 + ev.r * 3), ev.r * 0.8);
        // Shockwave ring.
        P.spawn({ x: ev.p[0], y: ev.p[1] + 0.1, z: ev.p[2], life: 0.35, size: 0.3, size1: ev.r * 2.6, r: c[0], g: c[1], b: c[2], alpha: 0.9, sprite: "ring" });
        this.lights.flash(v(ev.p), ELEMENT_HEX[ev.el], 8 + ev.r * 2, ev.r * 3.5, 0.35);
        audio.play(ev.r > 3.5 ? "explosion_large" : ev.r > 2 ? "explosion_medium" : "explosion_small", { pos: v(ev.p) });
        return;
      }
      case "shake": {
        const d = this.hooks.cameraPos().distanceTo(new Vector3(...ev.p));
        this.hooks.shake(ev.amount * Math.max(0, 1 - d / 18));
        return;
      }
      case "death": {
        const e = this.world()?.get(ev.id);
        if (ev.id === self) return;
        if (e?.type === EntityType.Creature) {
          const def = CREATURES.find(e.def);
          if (def?.voice) audio.voice(def.voice, "death", { pos: v(ev.p), pitch: 1 / (def.scale ?? 1) });
          this.puff(ev.p, 8, 0.6);
          if (def?.warden) audio.stinger("warden_appears");
        } else if (e?.type === EntityType.Player) {
          audio.play("player_death", { pos: v(ev.p) });
        }
        return;
      }
      case "break": {
        const def = PROPS.find(ev.def);
        const mat = def?.material ?? "wood";
        const sprite = mat === "ceramic" || mat === "glass" ? "shard" : mat === "bone" ? "bone_chip" : "splinter";
        const col: [number, number, number] = mat === "ceramic" ? [0.6, 0.35, 0.2] : mat === "glass" ? [0.6, 0.7, 0.7] : mat === "bone" ? [0.8, 0.75, 0.6] : [0.45, 0.3, 0.16];
        this.burst(ev.p, col, 22, 4, 1.2, sprite, undefined, false, -12);
        this.puff(ev.p, 6, 0.5);
        audio.play(mat === "ceramic" ? "pot_shatter" : mat === "glass" ? "glass_shatter" : mat === "wood" ? (def?.shape.kind === "cylinder" ? "barrel_break" : "crate_break") : "hit_stone", { pos: v(ev.p) });
        return;
      }
      case "beam": {
        const c = ELEMENT_COLOR[ev.el];
        this.bolts.add([...ev.from, ...ev.to], [c[0] * 1.5, c[1] * 1.5, c[2] * 1.5], { width: 0.1, life: ev.dur, jitter: ev.el === "storm" ? 0.3 : 0.02 });
        this.burst(ev.to, c, 3, 1.5, 0.2, "spark");
        this.lights.flash(v(ev.to), ELEMENT_HEX[ev.el], 2, 4, ev.dur);
        return;
      }
      case "chain": {
        const c = ELEMENT_COLOR[ev.el];
        this.bolts.add(ev.pts, [c[0] * 1.6, c[1] * 1.6, c[2] * 1.6], { width: 0.07, life: 0.22, jitter: 0.35 });
        for (let i = 3; i + 2 < ev.pts.length; i += 3) this.lights.flash({ x: ev.pts[i], y: ev.pts[i + 1], z: ev.pts[i + 2] }, ELEMENT_HEX[ev.el], 3, 4, 0.2);
        audio.play("chain_lightning", { pos: { x: ev.pts[0], y: ev.pts[1], z: ev.pts[2] } });
        return;
      }
      case "trap": {
        const e = this.world()?.get(ev.id);
        const p = e ? ({ x: e.x, y: e.y, z: e.z } as const) : null;
        const id = ev.action === "spikes" ? "spike_trap" : ev.action === "darts" ? "dart_fire" : ev.action === "flame" ? "ignite" : ev.action === "collapse" ? "crate_break" : "trap_arm";
        audio.play(id, { pos: p ?? undefined });
        if (p && ev.action === "flame") this.burst([p.x, p.y, p.z], ELEMENT_COLOR.fire, 30, 3, 0.7, "flame", [0, 1, 0]);
        if (p && ev.action === "spikes") this.burst([p.x, p.y + 0.1, p.z], [0.6, 0.6, 0.6], 8, 2, 0.3, "spark", [0, 1, 0]);
        return;
      }
      case "surf":
        this.surfaces()?.apply(ev.cells);
        return;
      case "sound":
        audio.play(ev.id, { pos: ev.p ? v(ev.p) : undefined, volume: ev.v });
        return;
      case "pickup":
        if (ev.by === self) {
          audio.play(ev.gold ? "pickup_gold" : ev.rarity === "legendary" ? "pickup_legendary" : ev.rarity === "rare" || ev.rarity === "epic" ? "pickup_rare" : "pickup_item");
          this.hooks.toast(ev.gold ? `+${ev.gold} gold` : `${ev.name}`, ev.gold ? "gold" : `item:${ev.rarity}`);
          if (ev.rarity === "legendary") audio.stinger("legendary_drop");
        }
        return;
      case "msg":
        if (ev.to === self) this.hooks.toast(ev.text, ev.kind);
        return;
      case "warden":
        if (ev.phase === 2) this.hooks.banner(ev.name, "grows desperate");
        else if (ev.phase === 0) this.hooks.banner(ev.name, "has fallen — the way down is open");
        return;
      case "open":
        audio.play("reliquary_open", { pos: this.world()?.get(ev.id) ? { x: this.world()!.get(ev.id)!.x, y: this.world()!.get(ev.id)!.y, z: this.world()!.get(ev.id)!.z } : undefined });
        return;
      case "status": {
        const e = this.world()?.get(ev.id);
        if (!e) return;
        const p: P3 = [e.x, e.y, e.z];
        if (ev.status === "frozen") {
          this.burst(p, ELEMENT_COLOR.frost, 16, 2, 0.5, "shard");
          audio.play("freeze", { pos: v(p) });
        } else if (ev.status === "burning") audio.play("ignite", { pos: v(p) });
        return;
      }
      case "fx":
        this.named(ev.fx, ev.p, ev.c, ev.s);
        return;
    }
  }

  /** Named one-off effects the sim asks for. */
  private named(fx: string, p: P3, color?: string, scale?: number): void {
    const P = this.particles;
    switch (fx) {
      case "ice_shatter":
        this.burst(p, ELEMENT_COLOR.frost, 24, 4, 0.8, "shard", undefined, false, -10);
        return;
      case "steam":
        this.puff(p, 10, 0.8, [0.7, 0.7, 0.75]);
        audio.play("sizzle", { pos: v(p) });
        return;
      case "singularity":
        for (let i = 0; i < 40; i++) {
          const a = Math.random() * Math.PI * 2;
          const r = (scale ?? 5) * (0.5 + Math.random() * 0.5);
          P.spawn({ x: p[0] + Math.cos(a) * r, y: p[1] + (Math.random() - 0.5) * 2, z: p[2] + Math.sin(a) * r, vx: -Math.cos(a) * r * 0.9, vz: -Math.sin(a) * r * 0.9, life: 1, size: 0.08, r: 0.8, g: 0.3, b: 2, sprite: "glow" });
        }
        audio.play("black_hole_loop", { pos: v(p) }).stop(2.2);
        return;
      case "bounce":
        this.burst(p, color ? hexLinear(color, 2) : [1, 1, 1], 5, 2, 0.2, "spark");
        return;
      case "ash_puff":
        this.puff(p, 8, 0.5, [0.35, 0.33, 0.3]);
        return;
      case "dissolve":
        this.burst(p, [0.8, 0.7, 1.6], 20, 1.2, 1, "glow");
        return;
      case "blessing":
        this.burst(p, [2, 1.7, 0.9], 24, 1.5, 1.2, "star", [0, 1, 0]);
        this.lights.flash(v(p), "#ffe0a0", 3, 6, 0.8);
        return;
      case "palm":
        this.burst(p, [1.6, 1.5, 1], 10, 1, 0.8, "star", [0, 1, 0]);
        return;
      case "collapse":
        this.puff(p, 14, 0.8, [0.3, 0.26, 0.2]);
        this.burst(p, [0.4, 0.3, 0.2], 18, 2, 1, "splinter", undefined, false, -12);
        return;
      case "reliquary_rise":
        this.burst(p, [2, 1.6, 1], 30, 1.2, 1.4, "glow", [0, 1, 0]);
        this.lights.flash(v(p), "#ffd8a0", 4, 7, 1);
        return;
      case "grasp_fail":
        this.burst(p, [0.7, 0.6, 1.4], 6, 1, 0.3, "glow");
        return;
      case "light":
        this.lights.flash(v(p), color ?? "#ffffff", 3, scale ?? 6, 1.5);
        return;
    }
  }

  burst(p: P3, c: [number, number, number], n: number, speed: number, life: number, sprite = "spark", dir?: P3, additive = true, gravity = -4): void {
    for (let i = 0; i < n; i++) {
      let vx = (Math.random() - 0.5) * 2;
      let vy = (Math.random() - 0.5) * 2;
      let vz = (Math.random() - 0.5) * 2;
      if (dir) {
        vx = vx * 0.6 + dir[0];
        vy = vy * 0.6 + dir[1];
        vz = vz * 0.6 + dir[2];
      }
      const l = Math.hypot(vx, vy, vz) || 1;
      const s = speed * (0.4 + Math.random() * 0.8);
      this.particles.spawn({
        x: p[0],
        y: p[1],
        z: p[2],
        vx: (vx / l) * s,
        vy: (vy / l) * s + (additive ? 0.5 : 1.5),
        vz: (vz / l) * s,
        life: life * (0.6 + Math.random() * 0.6),
        size: sprite === "glow" || sprite === "flame" ? 0.22 : 0.07,
        size1: sprite === "flame" ? 0.04 : undefined,
        r: c[0],
        g: c[1],
        b: c[2],
        sprite,
        gravity,
        drag: 1.5,
        spin: 8,
        additive,
        floor: additive ? undefined : p[1] - 1.5,
      });
    }
  }

  puff(p: P3, n: number, size: number, c: [number, number, number] = [0.12, 0.11, 0.1]): void {
    for (let i = 0; i < n; i++) {
      this.particles.spawn({
        x: p[0] + (Math.random() - 0.5) * size,
        y: p[1] + (Math.random() - 0.5) * size,
        z: p[2] + (Math.random() - 0.5) * size,
        vx: (Math.random() - 0.5) * 1.5,
        vy: 0.4 + Math.random() * 0.8,
        vz: (Math.random() - 0.5) * 1.5,
        life: 1.2 + Math.random(),
        size: size * 0.8,
        size1: size * 2.2,
        r: c[0],
        g: c[1],
        b: c[2],
        alpha: 0.55,
        sprite: "smoke",
        additive: false,
        drag: 1.2,
        turb: 0.6,
        spin: 1,
      });
    }
  }
}
