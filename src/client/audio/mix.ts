/** The mix sheet: per-id output trims, balanced against the offline level
 * check (`bun scripts/audio-check.ts`). Cue code shapes each sound; this
 * table sets how loud it sits against the rest. Targets (raw peak into the
 * bus): big hits / wardens ≈ 0.8, impacts & casts ≈ 0.5, voices 0.2–0.6,
 * footsteps ≈ 0.25, UI ≈ 0.25; loops ≈ 0.1 RMS; beds ≈ 0.05–0.07 RMS. */

export const CUE_TRIM: Record<string, number> = {
  // spells
  cast_arcane: 1.7, cast_fire: 1.35, cast_frost: 1.5, cast_storm: 0.5, cast_void: 0.8, cast_venom: 1.6, cast_force: 0.85,
  hit_venom: 1.5, hit_void: 0.9, hit_force: 0.6, hit_storm: 0.36, hit_frost: 1.1,
  explosion_small: 0.4, explosion_medium: 0.4, explosion_large: 0.42,
  beam_loop: 0.65, black_hole_loop: 0.4, chain_lightning: 0.8, freeze: 1.5, ignite: 1.3, shatter_ice: 1.1, splash: 1.9, sizzle: 1.3,
  // combat
  hit_metal: 0.85, hit_stone: 1.2, low_health_heartbeat: 0.9, player_hurt: 1.6, player_death: 1.2, heal: 1.5, mana_restore: 1.6,
  // movement (footsteps already carry 0.8)
  footstep_stone: 1.35, footstep_wood: 0.7, footstep_water: 1.9, footstep_metal: 0.75, footstep_snow: 1.8, footstep_flesh: 1.5, footstep_dirt: 1.1,
  jump: 3, land_heavy: 0.85, dash: 2.7, glide_loop: 0.65,
  // world
  barrel_break: 0.9, pot_shatter: 1.25, glass_shatter: 1.8, barrel_explode: 0.42, oil_splash: 1.4,
  fire_crackle_loop: 0.4, torch_loop: 0.6, candle_snuff: 3, lava_loop: 0.5, chain_rattle: 3, dart_fire: 3.2,
  blade_swing: 2, boulder_roll_loop: 0.42, gas_hiss: 1.3, trap_arm: 1.5,
  // loot & ui
  pickup_item: 1.4, pickup_gold: 2, pickup_rare: 1.6, equip: 1.7, ui_hover: 2.5, ui_open: 1.4, ui_close: 1.25,
  shop_buy: 1.4, shop_sell: 0.8, gamble_roll: 1.8, gamble_win: 1.5, gamble_lose: 0.8, craft: 0.8, level_up: 1.3,
  // run
  portal_hum_loop: 0.35, descend: 1.25, ascend: 1.8, reliquary_open: 1.3, pact_formed: 1.8, oath_broken: 0.7, warden_roar: 0.62, warden_phase: 1.1,
};

/** Creature voices: [idle, alert, attack, hurt, death]. */
export const VOICE_TRIM: Record<string, readonly [number, number, number, number, number]> = {
  rat: [2.5, 1.4, 1.9, 1.3, 1.2],
  carrion: [0.75, 0.85, 0.7, 0.9, 1.4],
  ink_eel: [1.4, 2.3, 1.9, 1.7, 1.3],
  bee: [1.25, 1.4, 1.6, 2.5, 1.9],
  spore: [2.5, 1.9, 1.7, 2.5, 1],
  slag: [1, 0.75, 0.75, 0.8, 0.8],
  flesh: [1.7, 1.6, 2, 1.7, 1.4],
  bones: [2.2, 2.1, 1.3, 1.3, 1.3],
  wight: [1.5, 3, 2, 2.5, 2.8],
  frost: [1.5, 1.3, 1.3, 1.7, 1.5],
  mirror: [1.6, 1.6, 1.5, 1.6, 1.5],
  dream: [0.8, 0.9, 1, 1, 0.8],
  automaton: [2.5, 1.1, 0.8, 1, 1.15],
  clock: [1.2, 1.3, 1, 1, 1.1],
  paper: [3, 3.3, 1.3, 3.3, 1.5],
  fungal: [1.2, 1.1, 1.3, 2.1, 1.7],
  giant: [1, 0.8, 0.72, 0.95, 0.72],
};

export const STINGER_TRIM: Record<string, number> = { warden_appears: 0.8, legendary_drop: 2, death: 1.1, ascend: 1.5, secret: 2 };

export const BED_TRIM: Record<string, number> = {
  village_night: 1.4, undercroft: 0.3, archive: 1.1, choir: 0.7, foundry: 0.7, hive: 2.2, liturgy: 2.3, garden: 1.6, orrery: 1.2, unlit: 0.8, threshold: 1.3,
};

/** Copy a record of cue-like defs with their gains trimmed. */
export function trimmed<T extends { gain: number }>(defs: Record<string, T>, trims: Record<string, number>): Record<string, T> {
  const out: Record<string, T> = {};
  for (const [id, d] of Object.entries(defs)) out[id] = { ...d, gain: d.gain * (trims[id] ?? 1) };
  return out;
}
