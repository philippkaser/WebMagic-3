import type { Collider, KinematicCharacterController, RigidBody, World } from "@dimforge/rapier3d-compat";
import { PLAYER } from "../../shared/config";
import { GROUPS, RAPIER, createWorld } from "../../shared/sim/physics";
import type { V3 } from "../../shared/util/math";
import type { StaticBox } from "../../shared/world/colliders";

/** The delver's private collision world: the place's static boxes plus a
 * kinematic capsule driven by Rapier's character controller. Pure (no
 * three.js), so tests exercise exactly what the client runs.
 *
 * Rapier only indexes colliders for scene queries during `world.step()`,
 * and the character controller *is* a scene query: the world must be
 * stepped once before the first move and then every frame, or the capsule
 * sees no ground at all. */
export interface CharacterWorld {
  world: World;
  body: RigidBody;
  collider: Collider;
  kcc: KinematicCharacterController;
}

export function createCharacterWorld(boxes: StaticBox[], spawn: V3): CharacterWorld {
  const world = createWorld();
  const fixed = world.createRigidBody(RAPIER.RigidBodyDesc.fixed());
  for (const b of boxes) {
    world.createCollider(RAPIER.ColliderDesc.cuboid(b.half[0], b.half[1], b.half[2]).setTranslation(b.center[0], b.center[1], b.center[2]).setCollisionGroups(GROUPS.world), fixed);
  }
  const body = world.createRigidBody(RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(spawn.x, spawn.y, spawn.z));
  const collider = world.createCollider(RAPIER.ColliderDesc.capsule(PLAYER.halfHeight, PLAYER.radius).setCollisionGroups(GROUPS.player), body);
  const kcc = world.createCharacterController(0.02);
  kcc.enableAutostep(PLAYER.stepHeight, 0.15, false);
  kcc.enableSnapToGround(0.3);
  kcc.setMaxSlopeClimbAngle((PLAYER.maxSlopeDeg * Math.PI) / 180);
  kcc.setApplyImpulsesToDynamicBodies(false);
  world.step();
  return { world, body, collider, kcc };
}
