import RAPIER, { type Collider, type RigidBody, type World } from "@dimforge/rapier3d-compat";
import { GRAVITY } from "../config";
import { buildStaticBoxes } from "../world/colliders";
import type { FloorLayout } from "../world/layout";

/** Rapier wrapper shared by the authoritative sim and the client's local
 * physics (player movement). Initialisation is async (WASM) and happens once
 * per process via `initPhysics()`. */

let ready: Promise<void> | null = null;

export function initPhysics(): Promise<void> {
  if (!ready) ready = RAPIER.init();
  return ready;
}

export { RAPIER };

/** Collision groups (membership bit index). */
export const Group = {
  World: 0,
  Player: 1,
  Creature: 2,
  Prop: 3,
  Corpse: 4,
  Ghost: 5, // things that only collide with the world (gibs, flying pickups)
} as const;

const bit = (g: number) => 1 << g;

/** Rapier interaction-groups value: (membership << 16) | filter. */
export function groups(member: number, collidesWith: number[]): number {
  let filter = 0;
  for (const g of collidesWith) filter |= bit(g);
  return ((bit(member) & 0xffff) << 16) | (filter & 0xffff);
}

export const GROUPS = {
  world: groups(Group.World, [Group.Player, Group.Creature, Group.Prop, Group.Corpse, Group.Ghost]),
  player: groups(Group.Player, [Group.World, Group.Creature, Group.Prop, Group.Player]),
  creature: groups(Group.Creature, [Group.World, Group.Player, Group.Creature, Group.Prop]),
  prop: groups(Group.Prop, [Group.World, Group.Player, Group.Creature, Group.Prop, Group.Corpse]),
  corpse: groups(Group.Corpse, [Group.World, Group.Prop, Group.Corpse]),
  ghost: groups(Group.Ghost, [Group.World]),
  /** Scene queries (rays, shape casts) belong to every group, so only the
   * filter half decides what they see. Projectiles/sight: everything solid. */
  queryAll: query([Group.World, Group.Player, Group.Creature, Group.Prop, Group.Corpse]),
  /** Static world only. */
  queryWorld: query([Group.World]),
  /** Bodies only (no world). */
  queryBodies: query([Group.Player, Group.Creature, Group.Prop, Group.Corpse]),
};

function query(sees: number[]): number {
  let filter = 0;
  for (const g of sees) filter |= bit(g);
  return (0xffff << 16) | filter;
}

export function createWorld(): World {
  const w = new RAPIER.World({ x: 0, y: GRAVITY, z: 0 });
  return w;
}

/** Add the floor's static geometry (grid boxes + solid decor). */
export function addStaticLayout(world: World, layout: FloorLayout): Collider[] {
  const body = world.createRigidBody(RAPIER.RigidBodyDesc.fixed());
  const out: Collider[] = [];
  for (const b of buildStaticBoxes(layout)) {
    const desc = RAPIER.ColliderDesc.cuboid(b.half[0], b.half[1], b.half[2])
      .setTranslation(b.center[0], b.center[1], b.center[2])
      .setCollisionGroups(GROUPS.world)
      .setFriction(0.8);
    out.push(world.createCollider(desc, body));
  }
  return out;
}

/** Upright capsule body for creatures (rotation locked; the brain steers
 * it with velocities and physics does the rest). */
export function createCapsuleBody(
  world: World,
  opts: { x: number; y: number; z: number; radius: number; height: number; mass: number; kind: "dynamic" | "kinematic"; groups: number },
): { body: RigidBody; collider: Collider } {
  const half = Math.max(0.01, opts.height / 2 - opts.radius);
  const bodyDesc =
    opts.kind === "dynamic"
      ? RAPIER.RigidBodyDesc.dynamic().lockRotations().setLinearDamping(0.1).setCcdEnabled(true)
      : RAPIER.RigidBodyDesc.kinematicPositionBased();
  bodyDesc.setTranslation(opts.x, opts.y, opts.z);
  const body = world.createRigidBody(bodyDesc);
  const volume = Math.PI * opts.radius * opts.radius * (2 * half + (4 / 3) * opts.radius);
  const collider = world.createCollider(
    RAPIER.ColliderDesc.capsule(half, opts.radius)
      .setDensity(opts.kind === "dynamic" ? opts.mass / Math.max(volume, 1e-3) : 1)
      .setFriction(0)
      .setFrictionCombineRule(RAPIER.CoefficientCombineRule.Min)
      .setRestitution(0)
      .setCollisionGroups(opts.groups)
      .setActiveEvents(RAPIER.ActiveEvents.CONTACT_FORCE_EVENTS)
      .setContactForceEventThreshold(opts.mass * 40),
    body,
  );
  return { body, collider };
}

export type Shape3 =
  | { kind: "box"; half: [number, number, number] }
  | { kind: "cylinder"; radius: number; halfHeight: number }
  | { kind: "ball"; radius: number };

export function shapeDesc(s: Shape3) {
  switch (s.kind) {
    case "box":
      return RAPIER.ColliderDesc.cuboid(s.half[0], s.half[1], s.half[2]);
    case "cylinder":
      return RAPIER.ColliderDesc.cylinder(s.halfHeight, s.radius);
    case "ball":
      return RAPIER.ColliderDesc.ball(s.radius);
  }
}

export function shapeVolume(s: Shape3): number {
  switch (s.kind) {
    case "box":
      return 8 * s.half[0] * s.half[1] * s.half[2];
    case "cylinder":
      return Math.PI * s.radius * s.radius * 2 * s.halfHeight;
    case "ball":
      return (4 / 3) * Math.PI * s.radius ** 3;
  }
}
