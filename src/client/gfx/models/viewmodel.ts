import { Euler, Quaternion, Vector3 } from "three";
import { Anim } from "../../../shared/sim/entity";
import { MeshBuilder, turn, type T3 } from "./kit";
import { buildFocus, FOCUS_MODELS, focusModelOf, gripHand, type FocusInfo } from "./foci";
import { easeOut, Gait, glow, node, span } from "./parts";
import { registerModel, rigModel, type ModelInstance, type ModelOptions } from "./registry";

/** First-person viewmodel: the delver's right forearm and hand holding the
 * equipped focus, authored in CAMERA space (camera at the origin looking
 * −Z), sitting bottom-right about 0.35–0.5 m ahead.
 *
 * Registered as `viewmodel:<focus model id>` (what the game creates) and
 * `viewmodel_staff` (focus from look.focus). The game swaps the material to
 * the viewmodel one and moves meshes to the viewmodel layer. Animate every
 * frame: idle sway, walk bob from `speed`, recoil on anim Cast (animTime
 * since the cast), a pulsing tip. sockets.tip = the focus' business end. */

/** Where the fist sits and where the haft points, in camera space. Tuned
 * for the game camera (80° vertical FOV, 16:9): the hand fills the bottom-
 * right corner and the business end lands right of and below the crosshair
 * (≈ 65–70 % across, 55–60 % down), the haft leaning away into the scene. */
interface Hold {
  grip: T3;
  /** A camera-space point the haft aims at from the grip. */
  aim: T3;
  /** Roll about the haft (turns the knuckles). */
  roll: number;
}

const STAFF: Hold = { grip: [0.4, -0.33, -0.52], aim: [0.72, -0.2, -1.5], roll: 0.5 };
const HOLDS: Record<string, Hold> = {
  staff_apprentice: STAFF,
  staff_ember: STAFF,
  staff_void: STAFF,
  wand_rime: { grip: [0.3, -0.27, -0.44], aim: [0.34, -0.08, -0.78], roll: 0.5 },
  rod_storm: { grip: [0.32, -0.29, -0.46], aim: [0.42, -0.1, -0.96], roll: 0.5 },
  orb_venom: { grip: [0.3, -0.28, -0.46], aim: [0.27, -0.1, -0.62], roll: 0.4 },
};

function holdRot(h: Hold): T3 {
  const d = new Vector3(h.aim[0] - h.grip[0], h.aim[1] - h.grip[1], h.aim[2] - h.grip[2]).normalize();
  const q = new Quaternion().setFromUnitVectors(new Vector3(0, 1, 0), d);
  q.multiply(new Quaternion().setFromAxisAngle(new Vector3(0, 1, 0), h.roll));
  const e = new Euler().setFromQuaternion(q, "XYZ");
  return [e.x, e.y, e.z];
}

function buildVM(model: string, look: Record<string, string>): ModelInstance {
  const h = HOLDS[model] ?? STAFF;
  const hold = { at: h.grip, rot: holdRot(h) };
  const g = new Gait();
  return rigModel(
    (r) => {
      const arm = r.joint("arm", "root", hold.at);
      let info!: FocusInfo;
      arm.group({ at: hold.at, rot: hold.rot }, (f) => {
        // The Hollow's shard floats in its own node; everything else is rigid.
        const shard = model === "staff_void" ? new MeshBuilder() : undefined;
        info = buildFocus(f, model, shard, { finish: look.staff_finish });
        gripHand(f, info.grip);
        if (shard) r.joint("shard", "arm", hold.at).group({ at: hold.at, rot: hold.rot }, (sb) => sb.merge(shard));
      });
      // Wrist, bracer and robe sleeve running off-screen bottom-right.
      const [gx, gy, gz] = hold.at;
      const wrist: T3 = [gx + 0.05, gy - 0.07, gz + 0.06];
      const elbow: T3 = [gx + 0.24, gy - 0.34, gz + 0.36];
      arm.tube([[gx + 0.03, gy - 0.04, gz + 0.03], wrist, [gx + 0.08, gy - 0.12, gz + 0.1]], 0.024, { mat: "skin.wizard", uvm: 0.25, radial: 7 });
      arm.tube([wrist, [(wrist[0] + elbow[0]) / 2, (wrist[1] + elbow[1]) / 2, (wrist[2] + elbow[2]) / 2], elbow], (t) => 0.034 + t * 0.012, {
        mat: "leather",
        tint: "#4a3424",
        uvm: 0.25,
        radial: 8,
      });
      for (const t of [0.25, 0.55]) {
        const p: T3 = [wrist[0] + (elbow[0] - wrist[0]) * t, wrist[1] + (elbow[1] - wrist[1]) * t, wrist[2] + (elbow[2] - wrist[2]) * t];
        arm.torus(0.037 + t * 0.012, 0.005, { mat: "metal.iron", tint: "#6a6260", uvm: 0.2, at: p, rot: [0.95, 0, -0.55], radial: 3, tubular: 10 });
      }
      const dye = look.robe_dye ?? "#6a5a4a";
      const sleeveA: T3 = [gx + 0.16, gy - 0.22, gz + 0.22];
      arm.tube([sleeveA, [gx + 0.3, gy - 0.42, gz + 0.46], [gx + 0.42, gy - 0.62, gz + 0.66]], (t) => 0.06 + t * 0.05, { mat: "cloth.wool", tint: dye, uvm: 0.5, radial: 8 });
      arm.torus(0.064, 0.014, { mat: "cloth.wool", tint: dye, uvm: 0.4, at: sleeveA, rot: [0.95, 0, -0.55], radial: 4, tubular: 12 });
      // Tip socket (+ a glow core the animation pulses) at the business end.
      const tp = new Vector3(...info.tip).applyEuler(new Euler(...hold.rot)).add(new Vector3(...hold.at));
      const tipAt: T3 = [tp.x, tp.y, tp.z];
      r.joint("tip", "arm", tipAt).sphere(0.012, { ...glow(info.color, 5), at: tipAt, segments: 6, rings: 4 });
    },
    (rig, s) => {
      const arm = node(rig.nodes, "arm");
      const tip = node(rig.nodes, "tip");
      const shard = rig.nodes.get("shard");
      g.update(s, 2.6);
      const t = s.time;
      const w = g.amt;
      // Idle sway and breathing.
      arm.position.x += Math.sin(t * 0.7) * 0.004;
      arm.position.y += Math.sin(t * 1.4) * 0.003;
      turn(arm, Math.sin(t * 0.9) * 0.012, Math.sin(t * 0.6) * 0.015, Math.sin(t * 0.8) * 0.01);
      // Walk bob: a figure-eight in step with the feet.
      arm.position.y += (Math.abs(g.sin()) * 0.018 - 0.009) * w;
      arm.position.x += g.sin() * 0.012 * w;
      turn(arm, 0, 0, g.sin() * 0.03 * w);
      // Cast: a hard shove forward, a kick back, settle.
      let flare = 0;
      if (s.anim === Anim.Cast) {
        const a = s.animTime;
        const push = easeOut(a / 0.05) * (1 - span(a, 0.05, 0.12));
        const kick = span(a, 0.04, 0.09) * (1 - easeOut((a - 0.09) / 0.25));
        arm.position.z -= push * 0.06 - kick * 0.05;
        arm.position.y += kick * 0.02;
        turn(arm, kick * 0.22, 0, -kick * 0.05);
        flare = Math.max(push, kick);
      }
      // Tip: gentle pulse, flares on cast.
      tip.scale.setScalar(1 + Math.sin(t * 3.1) * 0.15 + flare * 2.2);
      if (shard) {
        shard.position.y += Math.sin(t * 1.7) * 0.008 + flare * 0.02;
        turn(shard, 0, Math.sin(t * 0.9) * 0.2);
      }
    },
    { flashable: false },
    (rig) => ({ tip: node(rig.nodes, "tip") }),
  );
}

/** Build the first-person viewmodel for an item base id (or focus model id). */
export function buildViewmodel(focusBaseId: string, look: Record<string, string> = {}): ModelInstance {
  return buildVM(focusModelOf(focusBaseId), look);
}

for (const m of FOCUS_MODELS) registerModel(`viewmodel:${m}`, (opts: ModelOptions) => buildVM(m, opts.look ?? {}));
registerModel("viewmodel_staff", (opts: ModelOptions) => buildVM(focusModelOf(opts.look?.focus), opts.look ?? {}));

