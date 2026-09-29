import { BufferAttribute, LatheGeometry, Vector2 } from "three";
import { Anim, Flag } from "../../../shared/sim/entity";
import { turn, type MeshBuilder, type RigBuilder, type Rig, type Surf, type T3 } from "./kit";
import { buildFocus, focusModelOf, gripHand } from "./foci";
import {
  chain,
  clamp01,
  deathT,
  easeOut,
  flame,
  flinch,
  Gait,
  glow,
  hand,
  lerp,
  node,
  span,
  staggerAmt,
  VOID,
  wobble,
} from "./parts";
import { registerModel, rigModel, type AnimInput, type ModelOptions } from "./registry";

/** The delver — the player's wizard as OTHER players (and the inventory
 * preview) see them: hooded robe in the player's dye, belt with pouches and
 * a lantern, boots, and the equipped focus in the right fist.
 *
 * look: robe_dye (#hex), hood (pointed | cowl | brim | default),
 *       staff_finish (bone | gilt), lantern (#hex light), focus (item base id).
 * sockets: lantern (flame), tip (focus business end), head. */

const D = {
  hips: [0, 0.94, 0.0] as T3,
  spine: [0, 1.0, 0.0] as T3,
  neck: [0, 1.47, 0.0] as T3,
  shR: [0.19, 1.41, 0.01] as T3,
  elR: [0.235, 1.13, 0.05] as T3,
  wrR: [0.25, 0.97, -0.17] as T3,
  shL: [-0.19, 1.41, 0.01] as T3,
  elL: [-0.22, 1.13, 0.02] as T3,
  wrL: [-0.235, 0.87, -0.02] as T3,
  hipR: [0.095, 0.92, 0.0] as T3,
  kneeR: [0.1, 0.5, -0.02] as T3,
  ankR: [0.1, 0.09, 0.02] as T3,
  hipL: [-0.095, 0.92, 0.0] as T3,
  kneeL: [-0.1, 0.5, -0.02] as T3,
  ankL: [-0.1, 0.09, 0.02] as T3,
  grip: [0.245, 0.95, -0.25] as T3,
  lantern: [-0.18, 0.93, -0.1] as T3,
};

/** Half a surface of revolution (phi from `start`, π long), both faces —
 * robe panels that can part at the front and back when legs swing. */
function halfLathe(b: MeshBuilder, profile: [number, number][], start: number, surf: Surf, segments = 6): void {
  const pts = profile.map(([r, y]) => new Vector2(Math.max(r, 1e-4), y));
  b.add(new LatheGeometry(pts, segments, start, Math.PI), surf);
  const back = new LatheGeometry(pts, segments, start, Math.PI);
  const idx = back.index!;
  for (let i = 0; i < idx.count; i += 3) {
    const t = idx.getX(i + 1);
    idx.setX(i + 1, idx.getX(i + 2));
    idx.setX(i + 2, t);
  }
  const n = back.attributes.normal as BufferAttribute;
  for (let i = 0; i < n.count; i++) n.setXYZ(i, -n.getX(i), -n.getY(i), -n.getZ(i));
  b.add(back, { ...surf, tint: darker(surf.tint) });
}

function darker(t: Surf["tint"]): Surf["tint"] {
  if (Array.isArray(t)) return [t[0] * 0.5, t[1] * 0.5, t[2] * 0.5];
  return t ? shade(t, 0.5) : "#404040";
}

/** Scale a #rrggbb colour's brightness. */
function shade(hex: string, k: number): string {
  const n = parseInt(hex.slice(1), 16);
  const c = (v: number) => Math.max(0, Math.min(255, Math.round(v * k)));
  return `#${[(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => c(v).toString(16).padStart(2, "0")).join("")}`;
}

function validHex(v: string | undefined, d: string): string {
  return v && /^#[0-9a-fA-F]{6}$/.test(v) ? v : d;
}

function buildDelver(r: RigBuilder, look: Record<string, string>): { focus: string } {
  const dye = validHex(look.robe_dye, "#6a5a4a");
  // The wool albedo is dark; lift the dye so the robe reads as its colour.
  const robe = { mat: "cloth.wool", tint: shade(dye, 1.6), uvm: 0.7 };
  const robeDk = { mat: "cloth.wool", tint: shade(dye, 1.05), uvm: 0.7 };
  const trim = { mat: "cloth.linen", tint: shade(dye, 2.1), uvm: 0.5 };
  const leather = { mat: "leather", tint: "#5a3e28", uvm: 0.4 };
  const leatherDk = { mat: "leather", tint: "#3a2818", uvm: 0.4 };
  const skin = { mat: "skin.wizard", uvm: 0.3 };
  const lightC = validHex(look.lantern, "#ffb35a");

  // ── hips: belt, pouches, the upper skirt ──
  const hips = r.joint("hips", "root", D.hips);
  hips.lathe(
    [
      [0.165, 0.76],
      [0.19, 0.8],
      [0.175, 0.92],
      [0.16, 0.99],
      [0.001, 1.0],
    ],
    { ...robe, segments: 12 },
  );
  hips.cylinder(0.172, 0.172, 0.06, { ...leather, at: [0, 0.965, 0], segments: 12 });
  hips.box([0.06, 0.05, 0.02], { mat: "metal.brass", uvm: 0.2, at: [0, 0.965, -0.172], bevel: 0.006 });
  // Pouches: a fat one on the right hip, a flat one at the back.
  hips.group({ at: [0.15, 0.9, -0.08], rot: [0, -0.5, 0] }, (g) => {
    g.box([0.09, 0.1, 0.05], { ...leather, bevel: 0.015 });
    g.box([0.095, 0.04, 0.056], { ...leatherDk, at: [0, 0.035, 0], bevel: 0.01 });
    g.sphere(0.008, { mat: "metal.brass", uvm: 0.1, at: [0, 0.02, -0.03], segments: 4, rings: 3 });
  });
  hips.group({ at: [0.07, 0.9, 0.16], rot: [0, 0.4, 0] }, (g) => {
    g.box([0.1, 0.08, 0.035], { ...leather, bevel: 0.01 });
    g.box([0.105, 0.03, 0.04], { ...leatherDk, at: [0, 0.03, 0], bevel: 0.008 });
  });
  // Scroll case slung at the back.
  hips.cylinder(0.025, 0.025, 0.26, { ...leatherDk, at: [-0.1, 0.95, 0.17], rot: [0, 0, 1.1], segments: 6 });
  hips.cylinder(0.028, 0.028, 0.03, { mat: "metal.brass", uvm: 0.1, at: [-0.215, 1.01, 0.17], rot: [0, 0, 1.1], segments: 6 });
  // Lantern on a short chain at the left hip.
  const lan = r.joint("lantern", "hips", D.lantern);
  const L = D.lantern;
  chain(lan, L, [L[0], L[1] - 0.06, L[2]], 0.025);
  lan.group({ at: [L[0], L[1] - 0.15, L[2]] }, (g) => {
    const iron = { mat: "metal.iron", tint: "#4a4440", uvm: 0.2 };
    g.cone(0.05, 0.04, { ...iron, at: [0, 0.075, 0], segments: 6, flat: true });
    g.torus(0.014, 0.004, { ...iron, at: [0, 0.1, 0], radial: 3, tubular: 6 });
    g.cylinder(0.045, 0.045, 0.012, { ...iron, at: [0, 0.05, 0], segments: 6 });
    g.cylinder(0.05, 0.05, 0.015, { ...iron, at: [0, -0.05, 0], segments: 6 });
    g.cylinder(0.036, 0.036, 0.09, { ...glow(lightC, 1.8), segments: 6 });
    g.radial(4, (h) => h.box([0.007, 0.1, 0.007], { ...iron, at: [0, 0, -0.042] }), Math.PI / 4);
  });
  const lf = r.joint("lanternFlame", "lantern", [L[0], L[1] - 0.17, L[2]]);
  flame(lf, [L[0], L[1] - 0.18, L[2]], 0.045, 0.014, 5, lightC);

  // ── legs: trousers, knee-high boots; the robe's lower panels ride the thighs ──
  for (const [side, hip, knee, ank] of [
    ["R", D.hipR, D.kneeR, D.ankR],
    ["L", D.hipL, D.kneeL, D.ankL],
  ] as const) {
    const sx = side === "R" ? 1 : -1;
    const th = r.joint(`thigh${side}`, "hips", hip);
    th.tube([hip, knee], (t) => 0.075 - t * 0.02, { mat: "cloth.wool", tint: "#3a3430", uvm: 0.5, radial: 7, segments: 3 });
    halfLathe(
      th,
      [
        [0.24, 0.3],
        [0.215, 0.5],
        [0.195, 0.7],
        [0.185, 0.82],
      ],
      sx > 0 ? 0 : Math.PI,
      { ...robe, flat: false },
      6,
    );
    // Hem trim.
    th.add(new LatheGeometry([new Vector2(0.245, 0.29), new Vector2(0.242, 0.33)], 6, sx > 0 ? 0 : Math.PI, Math.PI), { ...trim });
    const sh = r.joint(`shin${side}`, `thigh${side}`, knee);
    sh.tube([knee, ank], (t) => 0.055 - t * 0.01, { ...leather, radial: 7, segments: 3 });
    sh.cylinder(0.068, 0.062, 0.07, { ...leatherDk, at: [knee[0], knee[1] - 0.06, knee[2]], segments: 8 });
    const ft = r.joint(`foot${side}`, `shin${side}`, ank);
    ft.box([0.1, 0.09, 0.22], { ...leather, at: [ank[0], 0.05, ank[2] - 0.05], bevel: 0.035 });
    ft.sphere(0.052, { ...leather, at: [ank[0], 0.045, ank[2] - 0.14], squash: [1, 0.8, 1.1], segments: 7, rings: 4 });
    ft.box([0.105, 0.02, 0.24], { ...leatherDk, at: [ank[0], 0.01, ank[2] - 0.055], bevel: 0.006 });
    for (let k = 0; k < 3; k++) ft.box([0.07, 0.006, 0.008], { mat: "rope", tint: "#8a7450", uvm: 0.1, at: [ank[0], 0.09 + k * 0.03, ank[2] - 0.055 + k * 0.004] });
  }

  // ── spine: robe bodice, mantle, scarf ──
  const sp = r.joint("spine", "hips", D.spine);
  sp.lathe(
    [
      [0.16, 0.98],
      [0.175, 1.1],
      [0.19, 1.26],
      [0.17, 1.38],
      [0.1, 1.46],
      [0.06, 1.5],
      [0.001, 1.51],
    ],
    { ...robe, segments: 12 },
  );
  // Crossed robe front and a trim line.
  sp.box([0.025, 0.4, 0.02], { ...trim, at: [0.03, 1.2, -0.18], rot: [0.08, 0, 0.3] });
  sp.box([0.02, 0.3, 0.015], { ...robeDk, at: [-0.03, 1.17, -0.185], rot: [0.08, 0, -0.25] });
  // Mantle over the shoulders.
  sp.lathe(
    [
      [0.25, 1.24],
      [0.24, 1.31],
      [0.2, 1.4],
      [0.12, 1.47],
      [0.08, 1.49],
    ],
    { ...robeDk, segments: 12, flat: true },
  );
  sp.torus(0.085, 0.03, { ...trim, at: [0, 1.47, -0.005], rot: [Math.PI / 2 + 0.15, 0, 0], radial: 5, tubular: 12 });
  // Strap across the chest for the scroll case.
  sp.box([0.03, 0.55, 0.012], { ...leatherDk, at: [0, 1.2, -0.19], rot: [0.1, 0, 0.75] });
  sp.box([0.03, 0.55, 0.012], { ...leatherDk, at: [0, 1.2, 0.19], rot: [-0.1, 0, -0.75] });

  // ── head and hood ──
  const head = r.joint("head", "spine", D.neck);
  head.cylinder(0.045, 0.05, 0.08, { ...skin, at: [0, 1.5, 0], segments: 6 });
  head.sphere(0.095, { ...skin, at: [0, 1.6, -0.01], squash: [0.9, 1.08, 1], segments: 10, rings: 7 });
  head.cone(0.02, 0.05, { ...skin, at: [0, 1.595, -0.1], rot: [-1.3, 0, 0], segments: 4 });
  head.box([0.1, 0.05, 0.05], { mat: "fur", tint: "#4a3a2c", uvm: 0.2, at: [0, 1.535, -0.07], bevel: 0.02 });
  head.mirrorX((m) => {
    m.sphere(0.014, { ...VOID, at: [0.032, 1.615, -0.085], segments: 5, rings: 3 });
    m.sphere(0.005, { ...glow("#e8f0ff", 1.5), at: [0.032, 1.617, -0.097], segments: 4, rings: 2 });
    m.box([0.04, 0.012, 0.02], { mat: "fur", tint: "#3a2a20", uvm: 0.2, at: [0.034, 1.64, -0.088], rot: [0, 0, 0.1] });
  });
  const hood = look.hood ?? "default";
  const shell = { ...robeDk, flat: true };
  if (hood === "brim") {
    head.sphere(0.12, { ...shell, at: [0, 1.62, 0.01], squash: [1, 1.05, 1.08], segments: 10, rings: 7 });
    head.cylinder(0.27, 0.28, 0.02, { mat: "leather", tint: "#3a2c20", uvm: 0.5, at: [0, 1.7, 0.0], rot: [0.08, 0, 0.04], segments: 14 });
    head.cylinder(0.09, 0.12, 0.14, { mat: "leather", tint: "#3a2c20", uvm: 0.5, at: [0, 1.78, 0.01], rot: [0.08, 0, 0.04], segments: 10 });
    head.cylinder(0.122, 0.122, 0.03, { mat: "cloth.velvet", tint: "#6a2a1a", uvm: 0.3, at: [0, 1.73, 0.005], rot: [0.08, 0, 0.04], segments: 10 });
  } else {
    // A cloth hood: shell behind the face, a deep opening, folds at the neck.
    head.sphere(0.13, { ...shell, at: [0, 1.62, 0.025], squash: [1, 1.08, 1.12], segments: 10, rings: 7 });
    head.torus(0.1, 0.03, { ...shell, at: [0, 1.6, -0.075], rot: [0.2, 0, 0], scale: [1, 1.25, 1], radial: 4, tubular: 12 });
    if (hood === "pointed") {
      head.tube(
        [
          [0, 1.7, 0.03],
          [0, 1.83, 0.07],
          [0, 1.93, 0.14],
          [0.02, 1.98, 0.24],
        ],
        (t) => 0.11 * (1 - t) + 0.008,
        { ...shell, radial: 7, segments: 10 },
      );
    } else if (hood === "cowl") {
      head.torus(0.17, 0.06, { ...robe, at: [0, 1.47, 0.0], rot: [Math.PI / 2, 0, 0], radial: 5, tubular: 14, flat: true });
      head.sphere(0.14, { ...shell, at: [0, 1.64, 0.03], squash: [1.05, 1.1, 1.15], segments: 10, rings: 7 });
    } else {
      head.cone(0.08, 0.14, { ...shell, at: [0, 1.66, 0.13], rot: [1.9, 0, 0], segments: 6 });
    }
  }

  // ── arms ──
  for (const [side, sh, el, wr] of [
    ["R", D.shR, D.elR, D.wrR],
    ["L", D.shL, D.elL, D.wrL],
  ] as const) {
    const sx = side === "R" ? 1 : -1;
    const a = r.joint(`arm${side}`, "spine", sh);
    a.sphere(0.07, { ...robeDk, at: [sh[0] + 0.01 * sx, sh[1] + 0.01, sh[2]], segments: 8, rings: 5 });
    a.tube([sh, el], (t) => 0.058 - t * 0.008, { ...robe, radial: 7, segments: 3 });
    const f = r.joint(`fore${side}`, `arm${side}`, el);
    f.sphere(0.052, { ...robe, at: el, segments: 7, rings: 4 });
    f.tube([el, wr], (t) => 0.05 + t * 0.022, { ...robe, radial: 8, segments: 3 });
    f.torus(0.068, 0.012, { ...trim, at: [el[0] + (wr[0] - el[0]) * 0.9, el[1] + (wr[1] - el[1]) * 0.9, el[2] + (wr[2] - el[2]) * 0.9], rot: side === "R" ? [0.55, 0, 0] : [Math.PI / 2, 0, 0], radial: 4, tubular: 10 });
    r.joint(`hand${side}`, `fore${side}`, wr);
  }
  // Right fist around the focus (built in the focus frame at the grip).
  const focus = focusModelOf(look.focus);
  const short = focus === "wand_rime" || focus === "rod_storm";
  const fRot: T3 = short ? [-1.0, 0, 0] : [0, 0, 0];
  const hR = r.part("handR");
  const fx = r.joint("focus", "handR", D.grip);
  const fl = r.joint("focusFloat", "focus", D.grip);
  let tipAt: T3 = D.grip;
  fx.group({ at: D.grip, rot: fRot, scale: short ? 1 : 1.12 }, (g) => {
    const info = buildFocus(g, focus, focus === "staff_void" ? fl.push({ at: D.grip, rot: fRot, scale: 1.12 }) : undefined, { finish: look.staff_finish });
    if (focus === "staff_void") fl.pop();
    tipAt = [D.grip[0] + info.tip[0], D.grip[1] + info.tip[1] * (short ? 1 : 1.12), D.grip[2] + info.tip[2]];
    if (short) tipAt = [D.grip[0], D.grip[1] + Math.cos(1.0) * info.tip[1], D.grip[2] - Math.sin(1.0) * info.tip[1]];
    hR.group({ at: D.grip, rot: fRot }, (h) => gripHand(h, info.grip));
  });
  r.joint("tip", "focus", tipAt);
  // Left hand: open and relaxed; a palm sigil lit for the Open Palm.
  const hL = r.part("handL");
  hL.group({ scale: [-1, 1, 1] }, (m) => hand(m, { at: [-D.wrL[0], D.wrL[1], D.wrL[2]], rot: [0, 0.2, 0], s: 1.0, curl: 0.35, spread: 0.1 }));
  const palm = r.joint("palm", "handL", [D.wrL[0] + 0.02, D.wrL[1] - 0.06, D.wrL[2]]);
  palm.torus(0.035, 0.005, { ...glow("#e6d9ff", 4), at: [D.wrL[0] + 0.02, D.wrL[1] - 0.06, D.wrL[2]], rot: [0, Math.PI / 2, 0], radial: 3, tubular: 12 });
  palm.sphere(0.012, { ...glow("#ffffff", 5), at: [D.wrL[0] + 0.02, D.wrL[1] - 0.06, D.wrL[2]], segments: 5, rings: 3 });
  return { focus };
}

function animateDelver(rig: Rig, s: AnimInput, g: Gait, focus: string): void {
  const n = rig.nodes;
  const [root, hips, spine, head, lantern] = ["root", "hips", "spine", "head", "lantern"].map((k) => node(n, k));
  const [armR, foreR, handR, armL, foreL, handL] = ["armR", "foreR", "handR", "armL", "foreL", "handL"].map((k) => node(n, k));
  const [thL, shL, ftL, thR, shR, ftR] = ["thighL", "shinL", "footL", "thighR", "shinR", "footR"].map((k) => node(n, k));
  const [fx, ff, palm, lf] = ["focus", "focusFloat", "palm", "lanternFlame"].map((k) => node(n, k));
  const run = clamp01((s.speed - 2.5) / 2.5);
  g.update(s, lerp(1.35, 2.4, run));
  const t = s.time;
  const w = g.amt;
  const amp = lerp(0.45, 0.85, run) * w;

  // Legs.
  turn(thL, g.sin(0) * amp - 0.05 * run * w);
  turn(shL, -Math.max(0, g.cos(0)) * lerp(0.6, 1.4, run) * w);
  turn(ftL, -g.sin(0) * 0.2 * w);
  turn(thR, g.sin(0.5) * amp - 0.05 * run * w);
  turn(shR, -Math.max(0, g.cos(0.5)) * lerp(0.6, 1.4, run) * w);
  turn(ftR, -g.sin(0.5) * 0.2 * w);
  hips.position.y += (Math.abs(g.cos(0)) * lerp(0.03, 0.06, run) - 0.02) * w;
  turn(hips, 0, g.sin(0) * 0.12 * w);
  // Torso: counter-twist, lean into the run, breathe.
  turn(spine, -lerp(0.04, 0.22, run) * w + Math.sin(t * 1.6) * 0.015, -g.sin(0) * 0.18 * w, g.sin(0.25) * 0.03 * w);
  turn(head, lerp(0.02, 0.15, run) * w + Math.sin(t * 0.5) * 0.03, wobble(t * 0.25, 1) * 0.25 * (1 - w) + g.sin(0) * 0.08 * w);
  // Arms: the free arm swings, the staff arm carries.
  turn(armL, -g.sin(0) * lerp(0.35, 0.8, run) * w, 0, -0.06);
  turn(foreL, 0.2 + Math.max(0, -g.sin(0)) * 0.6 * run * w);
  turn(armR, -g.sin(0.5) * 0.12 * w + 0.15 * run * w, 0, 0.04);
  turn(foreR, -0.1 * run * w);
  turn(lantern, g.sin(0.2) * 0.4 * w + Math.sin(t * 1.4) * 0.05, 0, g.sin(0.45) * 0.15 * w);
  lf.scale.setScalar(1 + Math.sin(t * 17) * 0.1);
  ff.position.y += Math.sin(t * 1.7) * 0.012;
  turn(ff, 0, t * 0.8);

  if (s.anim === Anim.Cast) {
    // Thrust the focus at the target, a kick, then settle.
    const a = s.animTime;
    const thrust = easeOut(a / 0.08) * (1 - span(a, 0.25, 0.5));
    turn(armR, 1.05 * thrust, 0, -0.1 * thrust);
    turn(foreR, 0.35 * thrust);
    turn(fx, -0.9 * thrust * (focus === "wand_rime" || focus === "rod_storm" ? 0.6 : 1));
    turn(spine, -0.08 * thrust, -0.25 * thrust);
    turn(armL, -0.3 * thrust, 0, -0.25 * thrust);
  }
  const palmUp = (s.flags & Flag.Palm) !== 0;
  palm.visible = palmUp;
  if (palmUp) {
    // Open Palm: left arm straight out, palm to the foe, fingers up.
    turn(armL, 1.35, 0.1, 0.1);
    turn(foreL, 0.25);
    turn(handL, 0, -Math.PI / 2, -1.2);
    turn(spine, 0, 0.2);
  }
  if (s.anim === Anim.Fall) {
    turn(armL, 0.3 + Math.sin(t * 9) * 0.3, 0, -1.2);
    turn(armR, 0.2, 0, 0.6 + Math.sin(t * 9 + 1) * 0.2);
    turn(thL, 0.5);
    turn(shL, -0.8);
    turn(thR, -0.1);
  }
  const f = flinch(s) + staggerAmt(s) * 0.8;
  if (f) {
    turn(spine, f * 0.3, f * 0.15);
    turn(head, f * 0.4, 0, f * 0.2);
    turn(armL, -f * 0.4, 0, -f * 0.5);
    hips.position.z += f * 0.04;
  }
  const d = deathT(s, 0.55);
  if (d > 0) {
    // Knees give, then onto the back; the focus slips from the fist.
    const buckle = span(d, 0, 0.45);
    const fall = span(d, 0.3, 1);
    hips.position.y -= 0.3 * buckle;
    turn(thL, 0.9 * buckle);
    turn(shL, -1.4 * buckle);
    turn(thR, 0.7 * buckle);
    turn(shR, -1.1 * buckle);
    root.position.y += 0.1 * fall;
    root.position.z += 0.3 * fall;
    turn(root, 1.45 * easeOut(fall));
    turn(armR, -0.4 * fall, 0, 1.1 * fall);
    turn(armL, -0.3 * fall, 0, -1.2 * fall);
    turn(head, -0.2 * fall, 0.8 * fall);
    turn(fx, 0, 0, -1.4 * fall);
    fx.position.x += 0.2 * fall;
  }
  void handR;
  void foreL;
}

registerModel("delver", (opts: ModelOptions) => {
  const g = new Gait();
  let focus = "staff_apprentice";
  return rigModel(
    (r) => {
      focus = buildDelver(r, opts.look ?? {}).focus;
    },
    (rig, s) => animateDelver(rig, s, g, focus),
    opts,
    (rig) => ({ lantern: node(rig.nodes, "lanternFlame"), tip: node(rig.nodes, "tip"), head: node(rig.nodes, "head") }),
  );
});
