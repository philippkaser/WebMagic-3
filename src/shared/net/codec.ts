import { CREATURES, ITEMS, PROPS, SPELLS, STATUSES, TRAPS } from "../content";
import type { StatusId } from "../content/types";
import { EntityType, type Entity } from "../sim/entity";

/** Binary world snapshots. A snapshot carries every entity whose replicated
 * header changed since the recipient last heard about it, plus removals.
 * ~40 bytes per entity; a busy fight costs a few KB per snapshot.
 *
 * Layout (little endian):
 *   u8 kind=1 | u32 tick | f64 serverTime | u16 count
 *   count × { u32 id | u8 type | u16 def | u16 flags | f32 x,y,z
 *             | i16 vx,vy,vz (cm/s) | u16 yaw | u8 anim | u8 variant
 *             | u16 animAge (ticks) | u8 hp (0..255) | u16 statusBits
 *             | u8 hasQuat [ | i16 qx,qy,qz,qw ] }
 *   u16 removedCount | removedCount × u32 id
 */

export const SNAPSHOT_KIND = 1;

export const INTERACTABLE_KINDS = ["arrival", "chest", "descent", "mercy_candle", "note", "reliquary", "shrine", "npc", "lever", "door"];

export interface EntitySnap {
  id: number;
  type: EntityType;
  def: string;
  flags: number;
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  yaw: number;
  anim: number;
  variant: number;
  animAge: number;
  hp: number;
  statuses: number;
  quat: [number, number, number, number] | null;
}

export interface Snapshot {
  tick: number;
  serverTime: number;
  entities: EntitySnap[];
  removed: number[];
}

export function defIndex(type: EntityType, def: string): number {
  switch (type) {
    case EntityType.Player:
      return 0;
    case EntityType.Creature:
      return CREATURES.index(def);
    case EntityType.Prop:
      return PROPS.index(def);
    case EntityType.Projectile:
      return SPELLS.index(def);
    case EntityType.Trap:
      return TRAPS.index(def);
    case EntityType.Pickup:
      return ITEMS.index(def);
    case EntityType.Interactable:
      return Math.max(0, INTERACTABLE_KINDS.indexOf(def));
  }
}

export function defId(type: EntityType, index: number): string {
  switch (type) {
    case EntityType.Player:
      return "delver";
    case EntityType.Creature:
      return CREATURES.idAt(index);
    case EntityType.Prop:
      return PROPS.idAt(index);
    case EntityType.Projectile:
      return SPELLS.idAt(index);
    case EntityType.Trap:
      return TRAPS.idAt(index);
    case EntityType.Pickup:
      return ITEMS.idAt(index);
    case EntityType.Interactable:
      return INTERACTABLE_KINDS[index] ?? "arrival";
  }
}

export function statusBits(e: Entity): number {
  let bits = 0;
  for (const id of e.statuses.keys()) {
    const i = STATUSES.index(id);
    if (i < 16) bits |= 1 << i;
  }
  return bits;
}

export function statusIds(bits: number): StatusId[] {
  const out: StatusId[] = [];
  for (let i = 0; i < 16; i++) if (bits & (1 << i)) out.push(STATUSES.idAt(i) as StatusId);
  return out;
}

/** Header of a live sim entity, as seen by one viewer (flags may be
 * viewer-specific, e.g. Ally / CanAscend). */
export function snapOf(e: Entity, tick: number, flags = e.flags): EntitySnap {
  return {
    id: e.id,
    type: e.type,
    def: e.def,
    flags,
    x: e.pos.x,
    y: e.pos.y,
    z: e.pos.z,
    vx: e.vel.x,
    vy: e.vel.y,
    vz: e.vel.z,
    yaw: e.yaw,
    anim: e.anim,
    variant: e.animVariant,
    animAge: Math.min(65535, tick - e.animTick),
    hp: e.maxHp > 0 ? e.hp / e.maxHp : 1,
    statuses: statusBits(e),
    quat: e.quat ? [e.quat.x, e.quat.y, e.quat.z, e.quat.w] : null,
  };
}

const TAU = Math.PI * 2;
const clampI16 = (v: number) => Math.max(-32768, Math.min(32767, Math.round(v)));

export function encodeSnapshot(s: Snapshot): ArrayBuffer {
  let size = 1 + 4 + 8 + 2 + 2 + s.removed.length * 4;
  for (const e of s.entities) size += 38 + (e.quat ? 8 : 0);
  const buf = new ArrayBuffer(size);
  const v = new DataView(buf);
  let o = 0;
  v.setUint8(o, SNAPSHOT_KIND);
  o += 1;
  v.setUint32(o, s.tick, true);
  o += 4;
  v.setFloat64(o, s.serverTime, true);
  o += 8;
  v.setUint16(o, s.entities.length, true);
  o += 2;
  for (const e of s.entities) {
    v.setUint32(o, e.id, true);
    v.setUint8(o + 4, e.type);
    v.setUint16(o + 5, defIndex(e.type, e.def), true);
    v.setUint16(o + 7, e.flags & 0xffff, true);
    v.setFloat32(o + 9, e.x, true);
    v.setFloat32(o + 13, e.y, true);
    v.setFloat32(o + 17, e.z, true);
    v.setInt16(o + 21, clampI16(e.vx * 100), true);
    v.setInt16(o + 23, clampI16(e.vy * 100), true);
    v.setInt16(o + 25, clampI16(e.vz * 100), true);
    const yaw = ((e.yaw % TAU) + TAU) % TAU;
    v.setUint16(o + 27, Math.round((yaw / TAU) * 65535), true);
    v.setUint8(o + 29, e.anim);
    v.setUint8(o + 30, e.variant);
    v.setUint16(o + 31, Math.min(65535, e.animAge), true);
    v.setUint8(o + 33, Math.round(Math.max(0, Math.min(1, e.hp)) * 255));
    v.setUint16(o + 34, e.statuses & 0xffff, true);
    v.setUint8(o + 36, e.quat ? 1 : 0);
    o += 37;
    if (e.quat) {
      for (let k = 0; k < 4; k++) v.setInt16(o + k * 2, clampI16(e.quat[k] * 32767), true);
      o += 8;
    }
    o += 1; // reserved byte keeps entries 38 bytes (room for future flags)
  }
  v.setUint16(o, s.removed.length, true);
  o += 2;
  for (const id of s.removed) {
    v.setUint32(o, id, true);
    o += 4;
  }
  return buf;
}

export function decodeSnapshot(buf: ArrayBuffer): Snapshot {
  const v = new DataView(buf);
  let o = 1;
  const tick = v.getUint32(o, true);
  o += 4;
  const serverTime = v.getFloat64(o, true);
  o += 8;
  const count = v.getUint16(o, true);
  o += 2;
  const entities: EntitySnap[] = [];
  for (let i = 0; i < count; i++) {
    const type = v.getUint8(o + 4) as EntityType;
    const hasQuat = v.getUint8(o + 36) === 1;
    const e: EntitySnap = {
      id: v.getUint32(o, true),
      type,
      def: defId(type, v.getUint16(o + 5, true)),
      flags: v.getUint16(o + 7, true),
      x: v.getFloat32(o + 9, true),
      y: v.getFloat32(o + 13, true),
      z: v.getFloat32(o + 17, true),
      vx: v.getInt16(o + 21, true) / 100,
      vy: v.getInt16(o + 23, true) / 100,
      vz: v.getInt16(o + 25, true) / 100,
      yaw: (v.getUint16(o + 27, true) / 65535) * TAU,
      anim: v.getUint8(o + 29),
      variant: v.getUint8(o + 30),
      animAge: v.getUint16(o + 31, true),
      hp: v.getUint8(o + 33) / 255,
      statuses: v.getUint16(o + 34, true),
      quat: null,
    };
    o += 37;
    if (hasQuat) {
      const q: [number, number, number, number] = [0, 0, 0, 1];
      for (let k = 0; k < 4; k++) q[k] = v.getInt16(o + k * 2, true) / 32767;
      const l = Math.hypot(q[0], q[1], q[2], q[3]) || 1;
      e.quat = [q[0] / l, q[1] / l, q[2] / l, q[3] / l];
      o += 8;
    }
    o += 1;
    entities.push(e);
  }
  const rc = v.getUint16(o, true);
  o += 2;
  const removed: number[] = [];
  for (let i = 0; i < rc; i++) {
    removed.push(v.getUint32(o, true));
    o += 4;
  }
  return { tick, serverTime, entities, removed };
}
