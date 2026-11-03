/**
 * SFX recipes. Each recipe schedules a short layered sound (< ~1.2 s) on the given Voice.
 * Gains are tuned so a single raw voice peaks well below 1.0 before the master limiter.
 */

import { bell, chance, fm, later, mtof, noise, rand, tone, type Voice, WARM_BELL } from "./synth";
import type { Sfx } from "./types";

export type Recipe = (v: Voice) => void;

// ---------------------------------------------------------------- shared layers

/** Low sine "body" with a downward pitch sweep. */
function thump(v: Voice, hz: number, hz2: number, d: number, g: number, at = 0): void {
  tone(v, { hz, hz2, glide: d * 0.6, d, g, at, a: 0.002 });
}

/** Very short bright transient. */
function tick(v: Voice, g: number, f = 3500, at = 0): void {
  noise(v, { filter: "bandpass", f, q: 1.2, d: 0.018, g, at, a: 0.0005 });
}

/** High shimmering sparkle: highpassed noise with fast flutter. */
function sparkle(v: Voice, g: number, d: number, at = 0): void {
  noise(v, {
    filter: "highpass",
    f: 6500,
    q: 0.8,
    a: 0.02,
    d,
    g,
    at,
    trem: { rate: 23, depth: 0.9 },
    wet: 0.5,
  });
}

/** Air movement: a bandpassed noise sweep. */
function swish(v: Voice, f: number, f2: number, d: number, g: number, at = 0, q = 1.5): void {
  noise(v, { filter: "bandpass", f, f2, q, a: d * 0.35, d: d * 0.65, g, at });
}

/** A few randomized crackle pops. */
function crackles(v: Voice, n: number, span: number, g: number, at = 0): void {
  for (let i = 0; i < n; i++) {
    noise(v, {
      filter: "highpass",
      f: rand(1800, 4500),
      q: 1,
      a: 0.0005,
      d: rand(0.006, 0.02),
      g: g * rand(0.5, 1),
      at: at + rand(0, span),
      pan: rand(-0.4, 0.4),
    });
  }
}

/** Arpeggiate pitches (Hz) with a per-note function. */
function arp(
  v: Voice,
  notes: readonly number[],
  step: number,
  fn: (v: Voice, hz: number, i: number) => void,
): void {
  notes.forEach((hz, i) => {
    fn(later(v, i * step), hz, i);
  });
}

/** Warm lamp-like note: triangle + sine with gentle vibrato, lowpassed. */
function warmNote(v: Voice, hz: number, d: number, g: number): void {
  tone(v, {
    type: "triangle",
    hz,
    a: 0.012,
    d,
    g,
    filter: "lowpass",
    f: hz * 4,
    f2: hz * 1.5,
    vib: { rate: 5.5, depth: 6 },
    wet: 0.35,
  });
  tone(v, { hz: hz * 2, a: 0.008, d: d * 0.5, g: g * 0.25, wet: 0.3 });
}

const N = mtof;

// ---------------------------------------------------------------- recipes

export const RECIPES: Record<Sfx, Recipe> = {
  // ---- UI
  uiHover(v) {
    tone(v, { hz: 1850, a: 0.003, d: 0.045, g: 0.08 });
    tick(v, 0.03, 5000);
  },
  uiClick(v) {
    tick(v, 0.18, 3200);
    tone(v, { type: "triangle", hz: 980, hz2: 640, d: 0.06, g: 0.22 });
  },
  uiBack(v) {
    tick(v, 0.1, 2500);
    tone(v, { type: "triangle", hz: N(76), d: 0.07, g: 0.2, hold: 0.02 });
    tone(v, { type: "triangle", hz: N(71), d: 0.12, g: 0.2, at: 0.075 });
  },
  uiError(v) {
    for (const at of [0, 0.11]) {
      tone(v, {
        type: "square",
        hz: 138,
        at,
        hold: 0.06,
        d: 0.04,
        g: 0.12,
        filter: "lowpass",
        f: 900,
      });
      tone(v, {
        type: "sawtooth",
        hz: 146,
        at,
        hold: 0.06,
        d: 0.04,
        g: 0.08,
        filter: "lowpass",
        f: 700,
      });
    }
  },
  uiConfirm(v) {
    tick(v, 0.1, 4000);
    bell(v, { hz: N(81), d: 0.25, g: 0.14, wet: 0.2 });
    bell(v, { hz: N(88), d: 0.35, g: 0.14, at: 0.07, wet: 0.25 });
  },
  turnStart(v) {
    bell(v, { hz: N(57), d: 0.9, g: 0.16, wet: 0.4, partials: WARM_BELL });
    bell(v, { hz: N(81), d: 0.6, g: 0.08, at: 0.03, wet: 0.5 });
    noise(v, {
      color: "pink",
      filter: "bandpass",
      f: 900,
      f2: 2500,
      q: 1,
      a: 0.25,
      d: 0.2,
      g: 0.06,
    });
  },
  skillSelect(v) {
    tone(v, { type: "triangle", hz: 420, hz2: 980, d: 0.09, g: 0.2, a: 0.004 });
    tone(v, { hz: 1960, at: 0.06, d: 0.12, g: 0.06, wet: 0.3 });
    tick(v, 0.06, 6000, 0.06);
  },
  targetSelect(v) {
    fm(v, { hz: 1250, ratio: 3.5, index: 1.5, d: 0.09, g: 0.12 });
    tone(v, { type: "triangle", hz: 330, d: 0.06, g: 0.12 });
  },

  // ---- hits
  hitPhysical(v) {
    thump(v, 150, 48, 0.16, 0.6);
    noise(v, { filter: "lowpass", f: 1800, f2: 400, d: 0.09, g: 0.42, a: 0.001 });
    tick(v, 0.22, 2400);
  },
  hitRadiant(v) {
    tick(v, 0.25, 5200);
    thump(v, 220, 110, 0.1, 0.25);
    bell(v, { hz: N(84) * rand(0.98, 1.02), d: 0.6, g: 0.16, wet: 0.45 });
    bell(v, { hz: N(91), d: 0.45, g: 0.08, at: 0.03, wet: 0.5 });
    sparkle(v, 0.12, 0.35, 0.01);
  },
  hitVoid(v) {
    for (const det of [-14, 0, 17]) {
      tone(v, {
        type: "sawtooth",
        hz: 210,
        hz2: 62,
        detune: det,
        a: 0.01,
        d: 0.55,
        g: 0.11,
        filter: "lowpass",
        f: 1300,
        f2: 220,
        q: 6,
        wob: { rate: 9, depth: 350 },
        wet: 0.25,
      });
    }
    thump(v, 90, 35, 0.3, 0.4);
    noise(v, { color: "brown", filter: "lowpass", f: 500, d: 0.3, g: 0.25, a: 0.02 });
  },
  hitFire(v) {
    thump(v, 120, 50, 0.14, 0.4);
    noise(v, { filter: "bandpass", f: 700, f2: 3200, q: 0.9, a: 0.01, d: 0.35, g: 0.38 });
    noise(v, { color: "brown", filter: "lowpass", f: 900, d: 0.4, g: 0.2, a: 0.03, wet: 0.2 });
    crackles(v, 7, 0.4, 0.22, 0.02);
  },
  hitToxic(v) {
    tone(v, {
      type: "sine",
      hz: 320,
      hz2: 170,
      d: 0.35,
      g: 0.3,
      vib: { rate: 22, depth: 300 },
      filter: "lowpass",
      f: 1400,
    });
    noise(v, {
      filter: "bandpass",
      f: 4200,
      q: 2,
      a: 0.02,
      d: 0.4,
      g: 0.16,
      trem: { rate: 31, depth: 0.7 },
    });
    thump(v, 110, 55, 0.12, 0.3);
    for (let i = 0; i < 4; i++) {
      tone(v, {
        hz: rand(500, 900),
        hz2: rand(1100, 1600),
        at: 0.05 + i * rand(0.05, 0.08),
        d: 0.04,
        g: 0.08,
      });
    }
  },
  crit(v) {
    thump(v, 170, 40, 0.22, 0.45);
    noise(v, { filter: "lowpass", f: 2600, f2: 500, d: 0.12, g: 0.3, a: 0.001 });
    tick(v, 0.3, 3000);
    fm(v, { hz: 2350, ratio: 1.41, index: 2.5, index2: 0.1, d: 0.7, g: 0.12, wet: 0.4 });
    tone(v, { hz: 3520, a: 0.002, d: 0.5, g: 0.06, wet: 0.5 });
    noise(v, { color: "brown", filter: "lowpass", f: 200, d: 0.35, g: 0.3, at: 0.01 });
  },
  miss(v) {
    swish(v, 2400, 500, 0.28, 0.24, 0, 1.2);
    swish(v, 5000, 1500, 0.2, 0.06, 0.03, 2);
  },
  block(v) {
    fm(v, { hz: 520, ratio: 2.41, index: 4, index2: 0.2, d: 0.32, g: 0.2, wet: 0.25 });
    fm(v, { hz: 1180, ratio: 1.53, index: 2, d: 0.2, g: 0.08 });
    thump(v, 130, 70, 0.08, 0.3);
    tick(v, 0.28, 2800);
  },

  // ---- status
  heal(v) {
    arp(v, [N(72), N(76), N(79), N(84)], 0.07, (w, hz, i) => {
      tone(w, {
        type: "triangle",
        hz,
        a: 0.01,
        d: 0.45 - i * 0.05,
        g: 0.12,
        wet: 0.45,
        vib: { rate: 6, depth: 8 },
      });
      tone(w, { hz: hz * 2, a: 0.01, d: 0.25, g: 0.04, wet: 0.5 });
    });
    noise(v, { color: "pink", filter: "highpass", f: 3000, a: 0.25, d: 0.4, g: 0.05, wet: 0.5 });
  },
  buff(v) {
    tone(v, {
      type: "triangle",
      hz: 300,
      hz2: 900,
      glide: 0.2,
      a: 0.02,
      hold: 0.1,
      d: 0.2,
      g: 0.16,
      filter: "lowpass",
      f: 2400,
    });
    bell(v, { hz: N(86), at: 0.18, d: 0.4, g: 0.1, wet: 0.4 });
    sparkle(v, 0.07, 0.25, 0.15);
  },
  debuff(v) {
    for (const det of [-20, 20]) {
      tone(v, {
        type: "square",
        hz: 520,
        hz2: 150,
        detune: det,
        a: 0.02,
        hold: 0.05,
        d: 0.4,
        g: 0.07,
        filter: "lowpass",
        f: 2000,
        f2: 300,
      });
    }
    noise(v, { color: "pink", filter: "lowpass", f: 600, a: 0.05, d: 0.3, g: 0.1 });
  },
  stun(v) {
    thump(v, 180, 70, 0.1, 0.35);
    tick(v, 0.15, 2000);
    for (let i = 0; i < 4; i++) {
      tone(v, {
        hz: i % 2 === 0 ? 1560 : 1240,
        at: 0.08 + i * 0.1,
        d: 0.1,
        g: 0.09,
        vib: { rate: 14, depth: 40 },
        wet: 0.3,
      });
    }
  },
  bleed(v) {
    noise(v, { filter: "bandpass", f: 500, q: 2, d: 0.12, g: 0.3, a: 0.002 });
    tone(v, { hz: 1100, hz2: 280, d: 0.09, g: 0.14, at: 0.03 });
    tone(v, { hz: 900, hz2: 260, d: 0.08, g: 0.08, at: 0.16 });
  },
  burn(v) {
    noise(v, { filter: "bandpass", f: 600, f2: 2600, q: 0.8, a: 0.06, d: 0.35, g: 0.22 });
    noise(v, { color: "brown", filter: "lowpass", f: 700, a: 0.03, d: 0.4, g: 0.2 });
    crackles(v, 6, 0.4, 0.16);
  },
  dotTick(v) {
    tone(v, { hz: 310, hz2: 190, d: 0.06, g: 0.2 });
    noise(v, { filter: "lowpass", f: 1200, d: 0.03, g: 0.12 });
  },

  // ---- movement / life
  move(v) {
    for (const at of [0, 0.13]) {
      noise(v, { color: "pink", filter: "lowpass", f: 900, at, a: 0.004, d: 0.07, g: 0.35 });
      tone(v, { hz: 95, hz2: 60, at, d: 0.06, g: 0.2 });
    }
    swish(v, 1200, 2600, 0.22, 0.06, 0.02, 0.8);
  },
  downed(v) {
    tone(v, {
      type: "triangle",
      hz: 320,
      hz2: 70,
      a: 0.02,
      d: 0.65,
      g: 0.18,
      filter: "lowpass",
      f: 1200,
      f2: 250,
      wet: 0.35,
    });
    thump(v, 90, 35, 0.35, 0.5, 0.35);
    noise(v, { color: "brown", filter: "lowpass", f: 400, at: 0.35, d: 0.3, g: 0.35 });
    tone(v, {
      hz: N(62),
      at: 0.05,
      a: 0.05,
      d: 0.7,
      g: 0.06,
      vib: { rate: 4, depth: 20 },
      wet: 0.6,
    });
  },
  enemyDeath(v) {
    noise(v, { filter: "lowpass", f: 3000, f2: 300, d: 0.35, g: 0.3, drive: 0.7, a: 0.002 });
    tone(v, {
      type: "square",
      hz: 420,
      hz2: 38,
      d: 0.5,
      g: 0.1,
      filter: "lowpass",
      f: 1800,
      f2: 200,
    });
    thump(v, 120, 32, 0.4, 0.4);
    crackles(v, 4, 0.2, 0.12);
  },
  revive(v) {
    tone(v, { hz: 200, hz2: 820, glide: 0.6, a: 0.25, hold: 0.25, d: 0.4, g: 0.14, wet: 0.4 });
    noise(v, {
      color: "pink",
      filter: "bandpass",
      f: 600,
      f2: 4000,
      q: 1,
      a: 0.5,
      d: 0.3,
      g: 0.08,
      wet: 0.4,
    });
    for (const hz of [N(74), N(78), N(81)]) {
      bell(v, { hz, at: 0.55, d: 0.5, g: 0.07, wet: 0.5, partials: WARM_BELL });
    }
    sparkle(v, 0.07, 0.4, 0.5);
  },

  // ---- attacks / casts
  gunshot(v) {
    noise(v, { filter: "highpass", f: 1100, a: 0.0008, d: 0.05, g: 0.5 });
    noise(v, { filter: "bandpass", f: 2400, q: 0.8, a: 0.0005, d: 0.02, g: 0.28, drive: 0.6 });
    thump(v, 135, 42, 0.18, 0.45);
    noise(v, {
      color: "pink",
      filter: "lowpass",
      f: 2400,
      f2: 350,
      at: 0.02,
      a: 0.01,
      d: 0.55,
      g: 0.14,
      wet: 0.5,
    });
  },
  bladeSlash(v) {
    noise(v, { filter: "bandpass", f: 2600, f2: 7500, q: 2.2, a: 0.05, d: 0.14, g: 0.38 });
    noise(v, { filter: "highpass", f: 5000, a: 0.03, d: 0.1, g: 0.12, at: 0.02 });
    fm(v, { hz: 3200, ratio: 1.5, index: 0.8, at: 0.05, a: 0.002, d: 0.3, g: 0.05, wet: 0.3 });
  },
  hammerImpact(v) {
    thump(v, 95, 38, 0.32, 0.42);
    fm(v, { hz: 330, ratio: 1.41, index: 6, index2: 0.3, a: 0.001, d: 0.55, g: 0.13, wet: 0.3 });
    fm(v, { hz: 870, ratio: 2.76, index: 2, d: 0.25, g: 0.07 });
    noise(v, { filter: "lowpass", f: 2200, f2: 300, d: 0.15, g: 0.25, a: 0.001, drive: 0.4 });
  },
  castRadiant(v) {
    tone(v, {
      hz: 600,
      hz2: 1800,
      glide: 0.5,
      a: 0.3,
      hold: 0.15,
      d: 0.35,
      g: 0.08,
      wet: 0.5,
      vib: { rate: 7, depth: 15 },
    });
    arp(v, [N(81), N(85), N(88), N(93)], 0.06, (w, hz) => {
      bell(w, { hz, d: 0.45, g: 0.07, wet: 0.5 });
    });
    sparkle(v, 0.1, 0.6, 0.05);
  },
  castVoid(v) {
    for (const [hz, det] of [
      [110, -18],
      [110, 15],
      [165, 6],
    ] as const) {
      tone(v, {
        type: "sawtooth",
        hz,
        hz2: hz * 0.5,
        detune: det,
        a: 0.35,
        hold: 0.15,
        d: 0.35,
        g: 0.08,
        filter: "lowpass",
        f: 400,
        f2: 1400,
        fGlide: 0.4,
        q: 5,
        wob: { rate: 6, depth: 250 },
        wet: 0.35,
      });
    }
    noise(v, {
      color: "brown",
      filter: "lowpass",
      f: 300,
      a: 0.4,
      d: 0.4,
      g: 0.25,
      trem: { rate: 7, depth: 0.6 },
    });
  },
  flare(v) {
    noise(v, { filter: "highpass", f: 2000, a: 0.002, d: 0.05, g: 0.35 });
    noise(v, {
      filter: "bandpass",
      f: 900,
      f2: 5200,
      q: 0.7,
      a: 0.06,
      hold: 0.25,
      d: 0.55,
      g: 0.22,
      wet: 0.3,
    });
    noise(v, { color: "brown", filter: "lowpass", f: 600, a: 0.08, hold: 0.2, d: 0.5, g: 0.2 });
    crackles(v, 10, 0.9, 0.14, 0.05);
  },
  lampDrain(v) {
    tone(v, {
      type: "triangle",
      hz: 620,
      hz2: 290,
      a: 0.02,
      d: 0.6,
      g: 0.16,
      trem: { rate: 13, depth: 0.8 },
      filter: "lowpass",
      f: 1800,
      f2: 500,
      wet: 0.3,
    });
    noise(v, {
      color: "pink",
      filter: "bandpass",
      f: 1400,
      f2: 500,
      q: 2,
      a: 0.02,
      d: 0.5,
      g: 0.06,
      trem: { rate: 9, depth: 0.9 },
    });
  },
  lampRefuel(v) {
    for (let i = 0; i < 3; i++) {
      tone(v, {
        hz: 180 + i * 40,
        hz2: 380 + i * 60,
        at: i * 0.07,
        d: 0.06,
        g: 0.12,
        filter: "lowpass",
        f: 900,
      });
    }
    noise(v, { filter: "bandpass", f: 400, f2: 2400, q: 0.8, at: 0.22, a: 0.05, d: 0.25, g: 0.18 });
    warmNote(later(v, 0.25), N(62), 0.45, 0.14);
    warmNote(later(v, 0.35), N(69), 0.4, 0.1);
  },
  lightUp(v) {
    noise(v, {
      color: "pink",
      filter: "lowpass",
      f: 250,
      f2: 3500,
      fGlide: 0.3,
      q: 2,
      a: 0.08,
      d: 0.45,
      g: 0.35,
    });
    thump(v, 70, 45, 0.3, 0.3);
    for (const [hz, at] of [
      [N(62), 0.1],
      [N(66), 0.16],
      [N(69), 0.22],
    ] as const) {
      warmNote(later(v, at), hz, 0.75, 0.09);
    }
    crackles(v, 5, 0.6, 0.06, 0.2);
  },

  // ---- rewards
  lootCommon(v) {
    tone(v, { type: "square", hz: N(83), d: 0.07, g: 0.07, filter: "lowpass", f: 4000 });
    tone(v, {
      type: "square",
      hz: N(88),
      at: 0.07,
      d: 0.18,
      g: 0.07,
      filter: "lowpass",
      f: 4000,
      wet: 0.2,
    });
    tone(v, { hz: N(95), at: 0.07, d: 0.15, g: 0.05 });
  },
  lootRare(v) {
    arp(v, [N(79), N(83), N(86)], 0.08, (w, hz, i) => {
      bell(w, { hz, d: 0.35 + i * 0.1, g: 0.11, wet: 0.4 });
    });
    sparkle(v, 0.07, 0.4, 0.16);
  },
  lootRelic(v) {
    tone(v, {
      type: "triangle",
      hz: N(50),
      a: 0.15,
      hold: 0.3,
      d: 0.6,
      g: 0.12,
      filter: "lowpass",
      f: 600,
      wet: 0.4,
    });
    tone(v, {
      type: "triangle",
      hz: N(57),
      a: 0.2,
      hold: 0.25,
      d: 0.6,
      g: 0.08,
      filter: "lowpass",
      f: 700,
      wet: 0.4,
    });
    arp(v, [N(74), N(78), N(81), N(85), N(86), N(90), N(93)], 0.055, (w, hz, i) => {
      bell(w, { hz, d: 0.3 + i * 0.05, g: 0.075, wet: 0.5, pan: (i % 2 === 0 ? -1 : 1) * 0.3 });
    });
    sparkle(v, 0.1, 0.7, 0.1);
  },
  levelUp(v) {
    const notes = [N(62), N(66), N(69), N(74), N(78)];
    arp(v, notes, 0.085, (w, hz, i) => {
      warmNote(w, hz, i === notes.length - 1 ? 0.7 : 0.35, 0.12);
    });
    for (const hz of [N(62), N(69), N(74)]) {
      tone(v, {
        type: "sawtooth",
        hz,
        at: 0.4,
        a: 0.08,
        hold: 0.2,
        d: 0.45,
        g: 0.035,
        filter: "lowpass",
        f: 1400,
        detune: rand(-8, 8),
        wet: 0.4,
      });
    }
    sparkle(v, 0.05, 0.5, 0.4);
  },
  perkChosen(v) {
    bell(v, { hz: N(74), d: 0.7, g: 0.12, wet: 0.45, partials: WARM_BELL });
    bell(v, { hz: N(81), at: 0.1, d: 0.7, g: 0.11, wet: 0.45, partials: WARM_BELL });
    noise(v, {
      color: "pink",
      filter: "bandpass",
      f: 2000,
      q: 1,
      a: 0.2,
      d: 0.3,
      g: 0.04,
      wet: 0.4,
    });
  },
  equip(v) {
    fm(v, { hz: 1400, ratio: 2.1, index: 3, d: 0.08, g: 0.12 });
    tick(v, 0.25, 3000);
    noise(v, { color: "pink", filter: "lowpass", f: 700, at: 0.06, d: 0.08, g: 0.3 });
    fm(v, { hz: 900, ratio: 1.7, index: 2, at: 0.1, d: 0.15, g: 0.08 });
  },
  ore(v) {
    fm(v, { hz: 2100, ratio: 3.17, index: 1.6, d: 0.22, g: 0.12, wet: 0.2 });
    fm(v, { hz: 2830, ratio: 2.3, index: 1.2, at: 0.09, d: 0.18, g: 0.08 });
    for (let i = 0; i < 5; i++) {
      noise(v, {
        filter: "bandpass",
        f: rand(1200, 3500),
        q: 3,
        at: rand(0, 0.25),
        a: 0.001,
        d: rand(0.015, 0.04),
        g: 0.18,
      });
    }
  },

  // ---- map / outcome
  mapStep(v) {
    noise(v, { color: "pink", filter: "lowpass", f: rand(600, 1000), a: 0.006, d: 0.08, g: 0.3 });
    if (chance(0.5)) tick(v, 0.05, 2200, 0.02);
  },
  victory(v) {
    arp(v, [N(62), N(66), N(69)], 0.09, (w, hz) => {
      tone(w, {
        type: "sawtooth",
        hz,
        a: 0.02,
        hold: 0.08,
        d: 0.3,
        g: 0.06,
        filter: "lowpass",
        f: 2800,
        f2: 1200,
      });
    });
    for (const hz of [N(62), N(66), N(69), N(74)]) {
      tone(v, {
        type: "sawtooth",
        hz,
        at: 0.3,
        a: 0.04,
        hold: 0.25,
        d: 0.55,
        g: 0.045,
        filter: "lowpass",
        f: 900,
        f2: 3200,
        fGlide: 0.2,
        detune: rand(-6, 6),
        wet: 0.4,
      });
    }
    bell(v, { hz: N(86), at: 0.3, d: 0.7, g: 0.08, wet: 0.5 });
    thump(v, 110, 50, 0.3, 0.35, 0.3);
  },
  defeat(v) {
    for (const [hz, at] of [
      [N(57), 0],
      [N(53), 0.25],
      [N(50), 0.5],
    ] as const) {
      tone(v, {
        type: "triangle",
        hz,
        at,
        a: 0.03,
        hold: 0.1,
        d: 0.5,
        g: 0.13,
        filter: "lowpass",
        f: 900,
        wet: 0.4,
      });
    }
    thump(v, 70, 28, 0.6, 0.55, 0.5);
    noise(v, { color: "brown", filter: "lowpass", f: 250, at: 0.5, a: 0.02, d: 0.55, g: 0.35 });
  },
  bossRoar(v) {
    for (const det of [-25, 0, 22]) {
      tone(v, {
        type: "sawtooth",
        hz: 78,
        hz2: 52,
        detune: det,
        a: 0.12,
        hold: 0.35,
        d: 0.6,
        g: 0.09,
        drive: 0.8,
        filter: "lowpass",
        f: 700,
        f2: 250,
        q: 3,
        trem: { rate: 31, depth: 0.5 },
      });
    }
    noise(v, {
      filter: "bandpass",
      f: 650,
      f2: 220,
      q: 1.5,
      a: 0.1,
      hold: 0.3,
      d: 0.65,
      g: 0.32,
      drive: 0.5,
      wet: 0.3,
    });
    noise(v, { color: "brown", filter: "lowpass", f: 180, a: 0.05, hold: 0.4, d: 0.6, g: 0.3 });
  },
};
