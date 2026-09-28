/** The synthesis toolkit: re-exports the building blocks every cue, voice and
 * ambience bed is made of. See the individual modules for intent:
 *  - synth/core.ts      enveloped oscillators, noise bursts, FM, LFOs, shaping
 *  - synth/physical.ts  modal banks, resonators, Karplus–Strong, crackle, bubbles
 *  - synth/vocal.ts     formant voices (moans, hisses, whispers, choirs)
 *  - synth/prerender.ts OfflineAudioContext pre-render + variant cache */

export * from "./synth/core";
export * from "./synth/physical";
export * from "./synth/vocal";
export * from "./synth/prerender";
