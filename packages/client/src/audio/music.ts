/**
 * Generative music. Each mood is a small step sequencer (16 steps per bar) whose `step` callback
 * makes probabilistic choices and schedules instruments at exact context times. A MoodPlayer owns
 * one running mood: its buses, sustained layers, crossfade gains and voice budget. The engine
 * drives every live player from one lookahead scheduler.
 */

import {
  anvil,
  bass,
  boom,
  brass,
  crackle,
  drone,
  hat,
  kick,
  lamp,
  metalPing,
  noiseBed,
  pad,
  pluck,
  roar,
  type Sustain,
  snare,
  tom,
} from "./instruments";
import { chance, type NoiseBank, pick, rand, type Voice } from "./synth";
import type { MusicMood } from "./types";

/** Shared music effects the players send into. */
export interface MusicRig {
  readonly ctx: BaseAudioContext;
  readonly noise: NoiseBank;
  readonly reverb: AudioNode;
  readonly echo: AudioNode;
}

export type BusName = "main" | "drone" | "lamp";

export interface MoodApi {
  readonly rig: MusicRig;
  /** Current darkness 0..1. */
  readonly dark: number;
  /** Seconds per 16th step. */
  readonly stepDur: number;
  /**
   * A Voice on the given bus at time `t`, reserving `cost` voice units for `dur` seconds.
   * Returns null when the voice budget is exhausted (the note should be skipped).
   */
  v(bus: BusName, t: number, dur: number, cost?: number): Voice | null;
  /** Start a sustained layer on a bus; it is stopped with the player. */
  sustain(bus: BusName, make: (dest: AudioNode) => Sustain): void;
}

export interface MoodDef {
  readonly bpm: number;
  /** Overall level of this mood. */
  readonly gain: number;
  /** Stingers stop scheduling after this many steps. */
  readonly length?: number;
  /** Fade-in time (s). */
  readonly fadeIn?: number;
  setup?(m: MoodApi, t: number): void;
  step(m: MoodApi, s: number, t: number): void;
}

const VOICE_CAP = 48;

interface Bus {
  dry: GainNode;
  wet: GainNode;
  echo: GainNode;
}

export class MoodPlayer {
  readonly mood: MusicMood;
  private readonly def: MoodDef;
  private readonly rig: MusicRig;
  private readonly fades: GainNode[];
  private readonly buses: Record<BusName, Bus>;
  private readonly sustains: Sustain[] = [];
  private readonly voices: number[] = [];
  private readonly stepDur: number;
  private nextTime = 0;
  private stepIndex = 0;
  private stopped = false;
  private darkness = 0;
  private readonly api: MoodApi;

  constructor(mood: MusicMood, def: MoodDef, rig: MusicRig, dest: AudioNode, darkness: number) {
    this.mood = mood;
    this.def = def;
    this.rig = rig;
    this.darkness = darkness;
    this.stepDur = 60 / def.bpm / 4;
    const { ctx } = rig;
    const dryFade = ctx.createGain();
    const wetFade = ctx.createGain();
    const echoFade = ctx.createGain();
    this.fades = [dryFade, wetFade, echoFade];
    for (const f of this.fades) f.gain.value = 0;
    dryFade.connect(dest);
    wetFade.connect(rig.reverb);
    echoFade.connect(rig.echo);
    const mk = (): Bus => {
      const b = { dry: ctx.createGain(), wet: ctx.createGain(), echo: ctx.createGain() };
      b.dry.connect(dryFade);
      b.wet.connect(wetFade);
      b.echo.connect(echoFade);
      return b;
    };
    this.buses = { main: mk(), drone: mk(), lamp: mk() };
    this.applyDarkness(ctx.currentTime, true);

    const self = this;
    this.api = {
      rig,
      stepDur: this.stepDur,
      get dark() {
        return self.darkness;
      },
      v: (bus, t, dur, cost = 1) => this.voice(bus, t, dur, cost),
      sustain: (bus, make) => {
        this.sustains.push(make(this.buses[bus].dry));
      },
    };
  }

  get finished(): boolean {
    return this.def.length !== undefined && this.stepIndex >= this.def.length;
  }

  start(t: number): void {
    const fadeIn = this.def.fadeIn ?? 1.5;
    for (const f of this.fades) {
      f.gain.setValueAtTime(0, t);
      f.gain.setTargetAtTime(this.def.gain, t, fadeIn / 4);
    }
    this.nextTime = t + 0.03;
    this.def.setup?.(this.api, t);
  }

  /** Schedule every step that starts before `until`. */
  schedule(until: number, now: number): void {
    if (this.stopped) return;
    // If the tab was throttled and we fell behind, skip ahead rather than bursting.
    if (this.nextTime < now - 0.25) {
      const behind = Math.ceil((now - this.nextTime) / this.stepDur);
      this.nextTime += behind * this.stepDur;
      this.stepIndex += behind;
    }
    while (this.nextTime < until && !this.finished) {
      this.def.step(this.api, this.stepIndex, this.nextTime);
      this.nextTime += this.stepDur;
      this.stepIndex++;
    }
  }

  /** Fade out and release everything. Returns when it's safe to disconnect. */
  stop(t: number, fade = 1.5): number {
    if (this.stopped) return t;
    this.stopped = true;
    for (const f of this.fades) f.gain.setTargetAtTime(0, t, fade / 4);
    const end = t + fade * 1.6;
    for (const s of this.sustains) s.stop(end - 0.5);
    return end + 2.5;
  }

  disconnect(): void {
    for (const f of this.fades) f.disconnect();
    for (const b of Object.values(this.buses)) {
      b.dry.disconnect();
      b.wet.disconnect();
      b.echo.disconnect();
    }
  }

  setDarkness(d: number, t: number): void {
    this.darkness = d;
    this.applyDarkness(t, false);
  }

  private applyDarkness(t: number, immediate: boolean): void {
    const d = this.darkness;
    const drone = 0.7 + 0.9 * d;
    const lampLvl = Math.max(0, 1 - d) ** 1.4;
    const set = (b: Bus, level: number) => {
      for (const g of [b.dry, b.wet, b.echo]) {
        if (immediate) g.gain.value = level;
        else g.gain.setTargetAtTime(level, t, 0.6);
      }
    };
    set(this.buses.main, 1);
    set(this.buses.drone, drone);
    set(this.buses.lamp, lampLvl);
  }

  private voice(bus: BusName, t: number, dur: number, cost: number): Voice | null {
    const live = this.voices;
    for (let i = live.length - 1; i >= 0; i--) {
      if ((live[i] ?? 0) <= t) live.splice(i, 1);
    }
    if (live.length + cost > VOICE_CAP) return null;
    for (let i = 0; i < cost; i++) live.push(t + dur);
    const b = this.buses[bus];
    return {
      ctx: this.rig.ctx,
      noise: this.rig.noise,
      out: b.dry,
      wet: b.wet,
      echo: b.echo,
      t,
      p: 1,
    };
  }
}

// ------------------------------------------------------------------ helpers

type Phrase = readonly (readonly [note: number, step: number])[];

function playMotif(m: MoodApi, t: number, phrase: Phrase, g: number, transpose = 0): void {
  for (const [note, st] of phrase) {
    const at = t + st * m.stepDur + rand(-0.01, 0.015);
    const v = m.v("lamp", at, 2.2, 2);
    if (v) lamp(v, note + transpose, g * rand(0.85, 1.05));
  }
}

const bar = (s: number) => Math.floor(s / 16);
const pos = (s: number) => s % 16;

// ------------------------------------------------------------------ moods

const LAMP_MOTIFS: readonly Phrase[] = [
  [
    [69, 0],
    [72, 4],
    [74, 8],
    [72, 14],
  ],
  [
    [74, 0],
    [72, 3],
    [69, 6],
    [67, 10],
    [69, 16],
  ],
  [
    [65, 0],
    [69, 4],
    [72, 8],
    [76, 12],
    [74, 20],
  ],
];

function title(): MoodDef {
  const chords = [
    [50, 57, 60, 64],
    [46, 53, 57, 62],
    [43, 50, 53, 58],
    [45, 52, 57, 60],
  ];
  return {
    bpm: 56,
    gain: 0.9,
    fadeIn: 2.5,
    setup(m, t) {
      m.sustain("drone", (dest) =>
        drone(m.rig.ctx, dest, t, {
          notes: [26, 33],
          type: "triangle",
          lp: 260,
          gain: 0.14,
          fadeIn: 4,
        }),
      );
    },
    step(m, s, t) {
      const b = bar(s);
      const p = pos(s);
      if (p === 0 && b % 2 === 0) {
        const chord = chords[(b / 2) % chords.length] ?? chords[0];
        const v = m.v("main", t, 12, 8);
        if (v && chord)
          pad(v, chord, 9, 0.04, { attack: 3, release: 3, lp: 700 + (1 - m.dark) * 500 });
      }
      if (p === 0 && b % 4 === 1 && chance(0.9 - m.dark * 0.6)) {
        playMotif(m, t, pick(LAMP_MOTIFS), 0.11);
      }
      if ((p === 6 || p === 14) && chance(0.14 + m.dark * 0.1)) {
        const v = m.v("main", t, 3, 2);
        if (v) metalPing(v, pick([74, 77, 81, 84, 86]), 0.035);
      }
      if (p === 8 && b % 2 === 1 && chance(0.18 + m.dark * 0.2)) {
        const v = m.v("drone", t, 1.5, 2);
        if (v) boom(v, 0.12);
      }
    },
  };
}

function map(): MoodDef {
  const scale = [62, 65, 67, 69, 72, 74, 77];
  const swells = [
    [38, 45],
    [41, 48],
    [36, 43],
    [34, 41],
  ];
  let lastPluck = -10;
  return {
    bpm: 72,
    gain: 0.85,
    fadeIn: 2,
    setup(m, t) {
      m.sustain("drone", (dest) =>
        drone(m.rig.ctx, dest, t, {
          notes: [38, 45],
          type: "triangle",
          lp: 380,
          gain: 0.1,
          lfo: 0.05,
        }),
      );
    },
    step(m, s, t) {
      const b = bar(s);
      const p = pos(s);
      if (p % 2 === 0 && s - lastPluck > 3 && chance(0.13)) {
        lastPluck = s;
        const v = m.v("main", t, 1.6, 2);
        let note = pick(scale);
        // In deep darkness, notes slip a semitone towards dissonance.
        if (m.dark > 0.6 && chance(0.3)) note += 1;
        if (v) pluck(v, note, 0.09, 1.4, 0.35);
      }
      if (p === 0 && b % 4 === 0) {
        const v = m.v("drone", t, 14, 4);
        const sw = swells[(b / 4) % swells.length];
        if (v && sw) pad(v, sw, 8, 0.05, { type: "triangle", attack: 4, release: 4, lp: 500 });
      }
      if (p === 4 && chance(0.05 + m.dark * 0.08)) {
        const v = m.v("main", t, 3, 2);
        if (v) metalPing(v, pick([79, 81, 86, 88]), 0.03);
      }
      if (p === 0 && b % 8 === 2 && chance(0.65 - m.dark * 0.5)) {
        playMotif(m, t, pick(LAMP_MOTIFS), 0.08);
      }
    },
  };
}

const N = null;
type Pattern = readonly (number | null)[];
const BASS: readonly Pattern[][] = [
  [
    [0, N, 0, 0, N, 0, 3, N, 0, N, 0, 0, 5, N, 3, N],
    [0, N, 0, 12, 0, N, 3, N, 0, N, 0, 10, 0, N, 7, N],
    [0, N, N, 0, 0, N, 3, 0, N, 0, 5, N, 3, N, 0, N],
  ],
  [
    [0, N, 0, 12, 0, N, 1, N, 0, N, 0, 10, 0, N, 1, N],
    [0, 0, N, 0, 1, N, 0, N, 0, 0, N, 0, 6, N, 5, N],
    [0, N, 0, 0, 12, N, 0, 1, 0, N, 0, 0, 13, N, 12, N],
  ],
  [
    [0, 0, 12, 0, 0, 1, 0, 0, 0, 0, 12, 0, 6, N, 5, N],
    [0, 12, 0, 1, 0, 12, 0, 6, 0, 12, 0, 1, 13, 12, 6, 5],
    [0, 0, 0, 12, 1, 1, 0, 0, 0, 0, 6, 6, 5, 5, 1, 1],
  ],
];

/** combat (0), elite (1) and boss (2) share one generator with rising intensity. */
function battle(k: 0 | 1 | 2): MoodDef {
  const bpm = [112, 118, 138][k] ?? 112;
  const roots = [
    [0, 0, -4, -2],
    [0, 1, 0, -2],
    [0, 1, -4, 6],
  ][k] ?? [0];
  const pool = BASS[k] ?? [];
  let pattern: Pattern = pool[0] ?? [];
  const droneNotes = [[26], [26, 27], [26, 27, 32]][k] ?? [26];
  const padShape = [
    [0, 7, 12, 15],
    [0, 6, 12, 15],
    [0, 1, 7, 12],
  ][k] ?? [0, 7];
  return {
    bpm,
    gain: 0.8,
    fadeIn: 1.2,
    setup(m, t) {
      m.sustain("drone", (dest) =>
        drone(m.rig.ctx, dest, t, { notes: droneNotes, lp: 150 + k * 40, gain: 0.08, lfo: 0.11 }),
      );
    },
    step(m, s, t) {
      const b = bar(s);
      const p = pos(s);
      const root = 38 + (roots[Math.floor(b / 2) % roots.length] ?? 0);
      if (p === 0 && b % 4 === 0) pattern = b === 0 ? (pool[0] ?? pattern) : pick(pool);

      // Kick
      const kicks = [
        [0, 6, 8],
        [0, 3, 6, 8, 11],
        [0, 4, 8, 12],
      ][k] ?? [0];
      const maybe =
        [
          [10, 0.5, 14, 0.3],
          [14, 0.5, 15, 0.3],
          [2, 0.3, 6, 0.5, 10, 0.4, 14, 0.5],
        ][k] ?? [];
      let hitKick = kicks.includes(p);
      for (let i = 0; i < maybe.length; i += 2)
        if (maybe[i] === p && chance(maybe[i + 1] ?? 0)) hitKick = true;
      if (hitKick) {
        const v = m.v("main", t, 0.4, 2);
        if (v) kick(v, 0.42 + k * 0.03, k === 2 ? 1.2 : 1);
      }

      // Backbeat: anvil (combat/elite) or snare + anvil (boss)
      if (p === 4 || p === 12) {
        const v = m.v("main", t, 0.4, 2);
        if (v) {
          if (k === 2) snare(v, 0.2);
          anvil(v, 0.05 + k * 0.02, k === 1 ? 560 : 680);
        }
      }
      if (k >= 1 && (p === 15 || p === 7) && chance(k === 2 ? 0.6 : 0.3)) {
        const v = m.v("main", t, 0.4, 2);
        if (v) anvil(v, 0.04, rand(900, 1300));
      }

      // Hats
      const hatEvery = k === 2 ? 1 : 2;
      if (p % hatEvery === 0 || (k === 1 && chance(0.2))) {
        const v = m.v("main", t, 0.1, 1);
        if (v)
          hat(v, (p % 4 === 2 ? 0.05 : 0.03) * (1 + k * 0.1), k >= 1 && p === 14 && chance(0.4));
      }

      // Tom fill on the 4th bar
      if (b % 4 === 3 && p >= 12 && (k > 0 || p % 2 === 0)) {
        const v = m.v("main", t, 0.4, 2);
        if (v) tom(v, [200, 170, 140, 110][p - 12] ?? 120, 0.28);
      }

      // Bass ostinato
      const off = pattern[p];
      if (off !== null && off !== undefined) {
        const v = m.v("main", t, m.stepDur * 2, 2);
        if (v) bass(v, root + off, m.stepDur * 1.6, 0.13, k * 0.35);
      }

      // Tension pad
      if (p === 0 && b % 4 === 0) {
        const v = m.v("drone", t, 4 * 16 * m.stepDur + 2, 8);
        if (v) {
          pad(
            v,
            padShape.map((x) => root + 12 + x),
            4 * 16 * m.stepDur - 0.5,
            0.035,
            { attack: 2, release: 1.5, lp: 700 + k * 150, wet: 0.4 },
          );
        }
      }

      // Brass stabs
      if (k === 2 && (p === 0 || (p === 10 && b % 2 === 1))) {
        const v = m.v("main", t, 1.2, 9);
        if (v) brass(v, [root + 12, root + 13, root + 19], p === 0 ? 0.55 : 0.3, 0.09);
      }
      if (k === 1 && p === 0 && b % 2 === 0) {
        const v = m.v("main", t, 2, 9);
        if (v) brass(v, [root + 12, root + 18, root + 24], 1.2, 0.05);
      }
      if (k === 2 && b % 8 === 7 && p === 0) {
        const v = m.v("drone", t, 2.5, 2);
        if (v) roar(v, 0.12, 2);
      }

      // Darkness: distant metal scrapes creep in.
      if (p === 9 && chance(m.dark * 0.25)) {
        const v = m.v("drone", t, 3, 2);
        if (v) metalPing(v, pick([73, 75, 80]), 0.03);
      }
    },
  };
}

function camp(): MoodDef {
  const chords = [
    [50, 54, 57, 62],
    [43, 50, 54, 59],
    [47, 54, 57, 62],
    [45, 52, 57, 61],
  ];
  let chord = chords[0] ?? [];
  return {
    bpm: 68,
    gain: 1.1,
    fadeIn: 2,
    setup(m, t) {
      m.sustain("main", (dest) =>
        noiseBed(m.rig.ctx, m.rig.noise.brown, dest, t, {
          type: "lowpass",
          f: 500,
          gain: 0.13,
          lfo: 0.3,
          lfoDepth: 0.5,
        }),
      );
      m.sustain("main", (dest) =>
        noiseBed(m.rig.ctx, m.rig.noise.pink, dest, t, {
          type: "bandpass",
          f: 2600,
          q: 0.8,
          gain: 0.012,
          lfo: 0.5,
        }),
      );
    },
    step(m, s, t) {
      const b = bar(s);
      const p = pos(s);
      // Fire crackles
      if (chance(0.3)) {
        const v = m.v("main", t + rand(0, m.stepDur), 0.05, 1);
        if (v) crackle(v, rand(0.03, 0.11));
      }
      if (chance(0.02)) {
        for (let i = 0; i < 3; i++) {
          const v = m.v("main", t + i * rand(0.02, 0.06), 0.05, 1);
          if (v) crackle(v, rand(0.08, 0.15));
        }
      }
      if (p === 0 && b % 2 === 0) {
        chord = chords[(b / 2) % chords.length] ?? chord;
        const v = m.v("main", t, 10, 8);
        if (v)
          pad(v, chord, 7, 0.06, {
            type: "triangle",
            attack: 1.8,
            release: 2.5,
            lp: 1300,
            spread: 5,
          });
      }
      if (p % 2 === 0 && p !== 0 && chance(0.22)) {
        const v = m.v("main", t, 1.4, 2);
        const n = pick(chord);
        if (v) pluck(v, n + 12, 0.07, 1.2, 0.2);
      }
      if (p === 0 && b % 4 === 1 && chance(0.85 - m.dark * 0.5)) {
        playMotif(m, t, pick(LAMP_MOTIFS), 0.09, 0);
      }
    },
  };
}

function victory(): MoodDef {
  return {
    bpm: 96,
    gain: 0.9,
    fadeIn: 0.05,
    length: 48,
    step(m, s, t) {
      if (s === 0 || s === 16) {
        const v = m.v("main", t, 1.5, 2);
        if (v) {
          kick(v, 0.4, 0.8);
          boom(v, 0.08);
        }
      }
      if (s === 0) {
        const v = m.v("main", t, 3, 12);
        if (v) brass(v, [50, 57, 62], 1.6, 0.07);
      }
      if (s % 2 === 0 && s <= 6) {
        const v = m.v("main", t, 2, 2);
        if (v) lamp(v, [62, 66, 69, 74][s / 2] ?? 74, 0.12, 1.4);
      }
      if (s === 8) {
        const v = m.v("main", t, 2, 2);
        if (v) metalPing(v, 86, 0.04);
      }
      if (s === 16) {
        const v = m.v("main", t, 6, 10);
        if (v)
          pad(v, [50, 57, 62, 66, 69], 2.5, 0.06, {
            type: "triangle",
            attack: 0.2,
            release: 2.5,
            lp: 1800,
          });
        const w = m.v("main", t, 3, 2);
        if (w) lamp(w, 78, 0.1, 2.4);
      }
    },
  };
}

function defeat(): MoodDef {
  return {
    bpm: 60,
    gain: 0.9,
    fadeIn: 0.05,
    length: 40,
    step(m, s, t) {
      if (s === 0) {
        const v = m.v("main", t, 6, 10);
        if (v) {
          boom(v, 0.2);
          pad(v, [38, 45, 50, 53], 4, 0.06, { attack: 0.4, release: 3, lp: 500, lp2: 200 });
        }
      }
      if (s % 4 === 0 && s <= 12) {
        const v = m.v("main", t, 2, 2);
        const note = [69, 67, 65, 62][s / 4] ?? 62;
        if (v) lamp(v, note, 0.1 * (1 - s / 20), 1.6);
      }
      if (s === 16) {
        const v = m.v("main", t, 4, 4);
        if (v) {
          kick(v, 0.35, 0.6);
          metalPing(v, 61, 0.03);
        }
      }
    },
  };
}

export function makeMood(mood: Exclude<MusicMood, "none">): MoodDef {
  switch (mood) {
    case "title":
      return title();
    case "map":
      return map();
    case "combat":
      return battle(0);
    case "elite":
      return battle(1);
    case "boss":
      return battle(2);
    case "camp":
      return camp();
    case "victory":
      return victory();
    case "defeat":
      return defeat();
  }
}
