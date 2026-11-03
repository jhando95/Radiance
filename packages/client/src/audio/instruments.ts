/**
 * Music instruments built from the synth primitives. All take MIDI note numbers and absolute-time
 * Voices; durations are seconds. Sustained layers (drones, noise beds) return a stop handle.
 */

import { bell, clampFreq, fm, mtof, noise, rand, tone, type Voice, WARM_BELL } from "./synth";

export interface Sustain {
  stop(t: number): void;
}

/** Slow detuned pad chord. */
export function pad(
  v: Voice,
  notes: readonly number[],
  dur: number,
  g: number,
  o: {
    type?: OscillatorType;
    lp?: number;
    lp2?: number;
    attack?: number;
    release?: number;
    spread?: number;
    wet?: number;
  } = {},
): void {
  const attack = o.attack ?? 1.5;
  const spread = o.spread ?? 7;
  for (const m of notes) {
    for (const det of [-spread, spread]) {
      tone(v, {
        type: o.type ?? "sawtooth",
        hz: mtof(m),
        detune: det + rand(-2, 2),
        a: attack,
        hold: Math.max(dur - attack, 0),
        d: o.release ?? 2,
        g: g / 2,
        filter: "lowpass",
        f: o.lp ?? 900,
        ...(o.lp2 !== undefined ? { f2: o.lp2 } : {}),
        q: 0.4,
        wet: o.wet ?? 0.6,
        pan: det > 0 ? 0.25 : -0.25,
      });
    }
  }
}

/** Soft plucked tone. */
export function pluck(v: Voice, m: number, g: number, decay = 1.2, echo = 0.3): void {
  const hz = mtof(m);
  tone(v, {
    type: "triangle",
    hz,
    a: 0.003,
    d: decay,
    g,
    filter: "lowpass",
    f: hz * 7,
    f2: hz * 1.3,
    fGlide: decay * 0.5,
    wet: 0.45,
    echo,
    pan: rand(-0.5, 0.5),
  });
  tone(v, { hz: hz * 2, a: 0.002, d: decay * 0.3, g: g * 0.3, wet: 0.3 });
}

/** The warm lamp motif timbre: gentle triangle + sine octave with vibrato. */
export function lamp(v: Voice, m: number, g: number, dur = 1.6): void {
  const hz = mtof(m);
  tone(v, {
    type: "triangle",
    hz,
    a: 0.05,
    hold: dur * 0.2,
    d: dur,
    g,
    filter: "lowpass",
    f: hz * 3,
    f2: hz * 1.4,
    vib: { rate: 5, depth: 7 },
    wet: 0.6,
    echo: 0.25,
  });
  bell(v, { hz: hz * 2, a: 0.02, d: dur * 0.6, g: g * 0.18, wet: 0.6, partials: WARM_BELL });
}

/** Distant metallic echo: inharmonic FM ping drowned in reverb/echo. */
export function metalPing(v: Voice, m: number, g: number): void {
  fm(v, {
    hz: mtof(m),
    ratio: 2.76,
    index: 2.5,
    index2: 0.05,
    a: 0.002,
    d: 2.2,
    g,
    wet: 0.9,
    echo: 0.6,
    pan: rand(-0.8, 0.8),
  });
}

/** Distant industrial boom. */
export function boom(v: Voice, g: number): void {
  tone(v, { hz: 62, hz2: 34, glide: 0.8, a: 0.005, d: 1.3, g, wet: 0.9 });
  noise(v, { color: "brown", filter: "lowpass", f: 220, a: 0.01, d: 1, g: g * 0.8, wet: 0.9 });
}

export function kick(v: Voice, g: number, punch = 1): void {
  tone(v, { hz: 150 * punch, hz2: 42, glide: 0.12, a: 0.001, d: 0.35, g });
  noise(v, { filter: "lowpass", f: 3000, a: 0.0005, d: 0.015, g: g * 0.35 });
}

export function tom(v: Voice, hz: number, g: number): void {
  tone(v, { hz, hz2: hz * 0.55, glide: 0.25, a: 0.002, d: 0.38, g, wet: 0.2 });
  noise(v, { filter: "bandpass", f: hz * 3, q: 1, a: 0.001, d: 0.07, g: g * 0.3 });
}

/** Industrial anvil/metal hit. */
export function anvil(v: Voice, g: number, hz = 680): void {
  fm(v, {
    hz,
    ratio: 1.41,
    index: 5,
    index2: 0.2,
    a: 0.001,
    d: 0.32,
    g,
    wet: 0.3,
    pan: rand(-0.3, 0.3),
  });
  noise(v, { filter: "highpass", f: 3000, a: 0.0005, d: 0.04, g: g * 0.8 });
}

export function snare(v: Voice, g: number): void {
  noise(v, { filter: "bandpass", f: 1800, q: 0.7, a: 0.001, d: 0.16, g, wet: 0.2 });
  tone(v, { type: "triangle", hz: 190, hz2: 150, a: 0.001, d: 0.08, g: g * 0.7 });
}

export function hat(v: Voice, g: number, open = false): void {
  noise(v, {
    filter: "highpass",
    f: 7000,
    a: 0.0008,
    d: open ? 0.22 : 0.035,
    g,
    pan: rand(-0.3, 0.3),
  });
}

/** Ostinato bass: saw + square sub through a plucky resonant lowpass. */
export function bass(v: Voice, m: number, dur: number, g: number, drive = 0): void {
  const hz = mtof(m);
  tone(v, {
    type: "sawtooth",
    hz,
    a: 0.004,
    hold: dur * 0.3,
    d: dur * 0.9,
    g,
    filter: "lowpass",
    f: 1100 + drive * 800,
    f2: 220,
    fGlide: dur,
    q: 5,
    drive,
  });
  tone(v, {
    type: "square",
    hz: hz / 2,
    a: 0.004,
    hold: dur * 0.3,
    d: dur * 0.8,
    g: g * 0.35,
    filter: "lowpass",
    f: 300,
  });
}

/** Brass-like saw stack swelling open. */
export function brass(v: Voice, notes: readonly number[], dur: number, g: number): void {
  for (const m of notes) {
    for (const det of [-11, 0, 12]) {
      tone(v, {
        type: "sawtooth",
        hz: mtof(m),
        detune: det,
        a: 0.06,
        hold: Math.max(dur - 0.06, 0),
        d: 0.35,
        g: g / 3,
        filter: "lowpass",
        f: 300,
        f2: 2600,
        fGlide: Math.min(0.25, dur),
        q: 1.5,
        drive: 0.3,
        wet: 0.3,
      });
    }
  }
}

/** Low roar swell (boss). */
export function roar(v: Voice, g: number, dur = 2): void {
  noise(v, {
    filter: "bandpass",
    f: 900,
    f2: 160,
    q: 2,
    a: dur * 0.4,
    d: dur * 0.6,
    g,
    drive: 0.5,
    wet: 0.5,
  });
}

export function crackle(v: Voice, g: number): void {
  noise(v, {
    filter: "highpass",
    f: rand(1800, 5200),
    q: 1.2,
    a: 0.0005,
    d: rand(0.004, 0.02),
    g,
    pan: rand(-0.6, 0.6),
  });
}

/** Continuous oscillators through a slowly wobbling lowpass. */
export function drone(
  ctx: BaseAudioContext,
  dest: AudioNode,
  t: number,
  o: {
    notes: readonly number[];
    type?: OscillatorType;
    lp: number;
    q?: number;
    gain: number;
    lfo?: number;
    fadeIn?: number;
  },
): Sustain {
  const out = ctx.createGain();
  out.gain.setValueAtTime(0, t);
  out.gain.setTargetAtTime(o.gain, t, (o.fadeIn ?? 3) / 4);
  const lp = ctx.createBiquadFilter();
  lp.type = "lowpass";
  lp.frequency.value = o.lp;
  lp.Q.value = o.q ?? 2;
  const lfo = ctx.createOscillator();
  lfo.frequency.value = o.lfo ?? 0.07;
  const depth = ctx.createGain();
  depth.gain.value = o.lp * 0.45;
  lfo.connect(depth);
  depth.connect(lp.frequency);
  const oscs: OscillatorNode[] = [lfo];
  for (const m of o.notes) {
    for (const det of [-6, 6]) {
      const osc = ctx.createOscillator();
      osc.type = o.type ?? "sawtooth";
      osc.frequency.value = clampFreq(ctx, mtof(m));
      osc.detune.value = det;
      osc.connect(lp);
      oscs.push(osc);
    }
  }
  lp.connect(out);
  out.connect(dest);
  for (const osc of oscs) osc.start(t);
  return {
    stop(at) {
      out.gain.setTargetAtTime(0, at, 0.3);
      for (const osc of oscs) {
        osc.stop(at + 2.5);
      }
      const last = oscs[0];
      if (last) {
        last.onended = () => {
          for (const osc of oscs) osc.disconnect();
          depth.disconnect();
          lp.disconnect();
          out.disconnect();
        };
      }
    },
  };
}

/** Continuous filtered noise bed (wind, fire rumble) with slow filter motion. */
export function noiseBed(
  ctx: BaseAudioContext,
  buf: AudioBuffer,
  dest: AudioNode,
  t: number,
  o: {
    type: BiquadFilterType;
    f: number;
    q?: number;
    gain: number;
    lfo?: number;
    lfoDepth?: number;
    fadeIn?: number;
  },
): Sustain {
  const src = ctx.createBufferSource();
  src.buffer = buf;
  src.loop = true;
  const bq = ctx.createBiquadFilter();
  bq.type = o.type;
  bq.frequency.value = o.f;
  bq.Q.value = o.q ?? 1;
  const out = ctx.createGain();
  out.gain.setValueAtTime(0, t);
  out.gain.setTargetAtTime(o.gain, t, (o.fadeIn ?? 2) / 4);
  const lfo = ctx.createOscillator();
  lfo.frequency.value = o.lfo ?? 0.09;
  const depth = ctx.createGain();
  depth.gain.value = o.f * (o.lfoDepth ?? 0.4);
  lfo.connect(depth);
  depth.connect(bq.frequency);
  src.connect(bq);
  bq.connect(out);
  out.connect(dest);
  src.start(t, Math.random() * buf.duration * 0.9);
  lfo.start(t);
  return {
    stop(at) {
      out.gain.setTargetAtTime(0, at, 0.3);
      src.stop(at + 2.5);
      lfo.stop(at + 2.5);
      src.onended = () => {
        src.disconnect();
        lfo.disconnect();
        depth.disconnect();
        bq.disconnect();
        out.disconnect();
      };
    },
  };
}
