/**
 * The static mixing graph, shared by the realtime engine and the offline test renderer.
 *
 *   sfx voices ──► sfxVol ─────────────────────────────┐
 *        └─wet─► sfxReverb ─► sfxVol                    │
 *   mood players ─► musicIn ─► darkFilter ─► musicVol ──┼─► masterVol ─► [glue ► limit ► clip] ─► out
 *        ├─wet─► musicReverb ─► musicIn                 │
 *        └─echo─► echo ─► musicIn (+ reverb)            │
 *   dark ambience (wind + sub drone) ─► musicVol ───────┘
 */

import { drone, noiseBed } from "./instruments";
import type { MusicRig } from "./music";
import { makeEcho, makeMasterChain, makeReverb, noiseBank } from "./synth";
import type { MusicMood } from "./types";

export interface Graph {
  readonly ctx: BaseAudioContext;
  readonly masterVol: GainNode;
  readonly sfxVol: GainNode;
  readonly sfxWet: AudioNode;
  readonly musicIn: GainNode;
  readonly musicVol: GainNode;
  readonly darkFilter: BiquadFilterNode;
  readonly ambience: GainNode;
  readonly rig: MusicRig;
}

/** Perceptual taper for 0..1 slider values. */
export const taper = (x: number): number => Math.max(0, Math.min(1, x)) ** 2;

export function darkCutoff(d: number): number {
  return 15000 * (1 / 13) ** d;
}

export function ambienceLevel(d: number, mood: MusicMood): number {
  const factor =
    mood === "title" || mood === "map" || mood === "camp"
      ? 1
      : mood === "combat" || mood === "elite" || mood === "boss"
        ? 0.6
        : 0;
  return 0.1 * d ** 1.5 * factor;
}

export function createGraph(
  ctx: BaseAudioContext,
  o: { limiter: boolean; darkness: number; mood: MusicMood; ambience: boolean },
): Graph {
  const noise = noiseBank(ctx);
  const masterVol = ctx.createGain();
  if (o.limiter) masterVol.connect(makeMasterChain(ctx, ctx.destination));
  else masterVol.connect(ctx.destination);

  const sfxVol = ctx.createGain();
  sfxVol.connect(masterVol);
  const sfxReverb = makeReverb(ctx, 1.4, 0.7);
  const sfxReturn = ctx.createGain();
  sfxReturn.gain.value = 0.55;
  sfxReverb.connect(sfxReturn);
  sfxReturn.connect(sfxVol);

  const musicVol = ctx.createGain();
  musicVol.connect(masterVol);
  const darkFilter = ctx.createBiquadFilter();
  darkFilter.type = "lowpass";
  darkFilter.Q.value = 0.9;
  darkFilter.frequency.value = darkCutoff(o.darkness);
  darkFilter.connect(musicVol);
  const musicIn = ctx.createGain();
  musicIn.connect(darkFilter);

  const musicReverb = makeReverb(ctx, 3.6, 0.5);
  const reverbReturn = ctx.createGain();
  reverbReturn.gain.value = 0.7;
  musicReverb.connect(reverbReturn);
  reverbReturn.connect(musicIn);

  const echo = makeEcho(ctx, 0.48, 0.42, 1900);
  const echoReturn = ctx.createGain();
  echoReturn.gain.value = 0.5;
  echo.output.connect(echoReturn);
  echoReturn.connect(musicIn);
  const echoToVerb = ctx.createGain();
  echoToVerb.gain.value = 0.3;
  echo.output.connect(echoToVerb);
  echoToVerb.connect(musicReverb);

  const ambience = ctx.createGain();
  ambience.gain.value = ambienceLevel(o.darkness, o.mood);
  ambience.connect(musicVol);
  if (o.ambience) {
    const t = ctx.currentTime;
    noiseBed(ctx, noise.pink, ambience, t, {
      type: "bandpass",
      f: 380,
      q: 1.6,
      gain: 0.9,
      lfo: 0.05,
      lfoDepth: 0.6,
    });
    drone(ctx, ambience, t, {
      notes: [26, 25],
      type: "sine",
      lp: 200,
      q: 0.5,
      gain: 0.6,
      lfo: 0.03,
    });
  }

  return {
    ctx,
    masterVol,
    sfxVol,
    sfxWet: sfxReverb,
    musicIn,
    musicVol,
    darkFilter,
    ambience,
    rig: { ctx, noise, reverb: musicReverb, echo: echo.input },
  };
}
