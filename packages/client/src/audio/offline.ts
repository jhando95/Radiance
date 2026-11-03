/**
 * Offline render checks: renders SFX and music moods with OfflineAudioContext and measures
 * peak / RMS so we can verify output without listening. Used by the audio lab page.
 */

import { createGraph } from "./graph";
import { MoodPlayer, makeMood } from "./music";
import { RECIPES } from "./sfx";
import type { Voice } from "./synth";
import { type MusicMood, SFX_NAMES, type Sfx } from "./types";

export interface RenderStats {
  name: string;
  /** Peak |sample| of the raw mix (no master limiter). */
  peak: number;
  /** Peak after the master compressor/limiter/clipper. */
  peakMastered: number;
  /** RMS (dBFS) over the audible span (first to last sample above -60 dBFS) of the raw render. */
  rmsDb: number;
  /** Seconds until the raw render stays below -60 dBFS. */
  audibleSec: number;
  ok: boolean;
}

const RATE = 44100;
/**
 * SFX start offset in the offline render. DynamicsCompressorNode settles during its first few
 * hundred ms after context start, which would understate mastered peaks of very early sounds.
 */
const SFX_START = 0.5;

function measure(buf: AudioBuffer): { peak: number; rms: number; audible: number } {
  let peak = 0;
  let lastLoud = 0;
  let firstLoud = Number.POSITIVE_INFINITY;
  const thresh = 10 ** (-60 / 20);
  const chans: Float32Array[] = [];
  for (let c = 0; c < buf.numberOfChannels; c++) chans.push(buf.getChannelData(c));
  for (const d of chans) {
    for (let i = 0; i < d.length; i++) {
      const a = Math.abs(d[i] ?? 0);
      if (a > peak) peak = a;
      if (a > thresh) {
        if (i > lastLoud) lastLoud = i;
        if (i < firstLoud) firstLoud = i;
      }
    }
  }
  let sum = 0;
  let n = 0;
  for (const d of chans) {
    for (let i = Number.isFinite(firstLoud) ? firstLoud : 0; i <= lastLoud && i < d.length; i++) {
      const x = d[i] ?? 0;
      sum += x * x;
      n++;
    }
  }
  return { peak, rms: n > 0 ? Math.sqrt(sum / n) : 0, audible: lastLoud / buf.sampleRate };
}

async function renderOneSfx(sfx: Sfx, limiter: boolean, seconds: number): Promise<AudioBuffer> {
  const ctx = new OfflineAudioContext(2, Math.ceil(RATE * seconds), RATE);
  const g = createGraph(ctx, { limiter, darkness: 0, mood: "none", ambience: false });
  // Default in-game volumes (master 0.8, sfx 0.85 through the perceptual taper) would hide
  // clipping; render at unity so the numbers describe the recipe itself.
  g.masterVol.gain.value = 1;
  g.sfxVol.gain.value = 1;
  const dry = ctx.createGain();
  dry.connect(g.sfxVol);
  const voice: Voice = {
    ctx,
    noise: g.rig.noise,
    out: dry,
    wet: g.sfxWet,
    echo: null,
    t: SFX_START,
    p: 1,
  };
  RECIPES[sfx](voice);
  return ctx.startRendering();
}

const db = (x: number) => (x > 0 ? 20 * Math.log10(x) : -Infinity);

export async function renderSfxTable(names: readonly Sfx[] = SFX_NAMES): Promise<RenderStats[]> {
  const rows: RenderStats[] = [];
  for (const name of names) {
    const raw = measure(await renderOneSfx(name, false, 2.5 + SFX_START));
    const mastered = measure(await renderOneSfx(name, true, 2.5 + SFX_START));
    rows.push({
      name,
      peak: raw.peak,
      peakMastered: mastered.peak,
      rmsDb: db(raw.rms),
      audibleSec: raw.audible - SFX_START,
      ok: raw.peak > 0.01 && raw.peak < 1 && mastered.peak < 1,
    });
  }
  return rows;
}

export async function renderMoodTable(
  moods: readonly Exclude<MusicMood, "none">[] = [
    "title",
    "map",
    "combat",
    "elite",
    "boss",
    "camp",
    "victory",
    "defeat",
  ],
  seconds = 12,
  darkness = 0.3,
): Promise<RenderStats[]> {
  const rows: RenderStats[] = [];
  for (const mood of moods) {
    const stats = [];
    for (const limiter of [false, true]) {
      const ctx = new OfflineAudioContext(2, Math.ceil(RATE * seconds), RATE);
      const g = createGraph(ctx, { limiter, darkness, mood, ambience: true });
      g.masterVol.gain.value = 1;
      g.musicVol.gain.value = 1;
      const player = new MoodPlayer(mood, makeMood(mood), g.rig, g.musicIn, darkness);
      player.start(0);
      player.schedule(seconds, 0);
      stats.push(measure(await ctx.startRendering()));
    }
    const [raw, mastered] = stats;
    if (!raw || !mastered) continue;
    rows.push({
      name: mood,
      peak: raw.peak,
      peakMastered: mastered.peak,
      rmsDb: db(raw.rms),
      audibleSec: raw.audible,
      ok: raw.peak > 0.01 && mastered.peak < 1,
    });
  }
  return rows;
}

/** Worst case: every SFX fired at the same instant through the full master chain. */
export async function renderStress(): Promise<RenderStats> {
  const stats = [];
  for (const limiter of [false, true]) {
    const ctx = new OfflineAudioContext(2, Math.ceil(RATE * 3), RATE);
    const g = createGraph(ctx, { limiter, darkness: 0, mood: "none", ambience: false });
    g.masterVol.gain.value = 1;
    g.sfxVol.gain.value = 1;
    for (const name of SFX_NAMES) {
      const voice: Voice = {
        ctx,
        noise: g.rig.noise,
        out: g.sfxVol,
        wet: g.sfxWet,
        echo: null,
        t: SFX_START,
        p: 1,
      };
      RECIPES[name](voice);
    }
    stats.push(measure(await ctx.startRendering()));
  }
  const [raw, mastered] = stats;
  return {
    name: `all ${SFX_NAMES.length} at once`,
    peak: raw?.peak ?? 0,
    peakMastered: mastered?.peak ?? 0,
    rmsDb: db(raw?.rms ?? 0),
    audibleSec: (raw?.audible ?? 0) - SFX_START,
    ok: (mastered?.peak ?? 1) < 1,
  };
}
