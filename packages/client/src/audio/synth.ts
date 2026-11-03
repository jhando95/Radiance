/**
 * Low-level synthesis primitives shared by SFX recipes and music instruments.
 *
 * Everything here works on any BaseAudioContext (realtime or offline), schedules at absolute
 * context times, and cleans up its own nodes when the source ends. No asset files: noise comes
 * from procedurally filled buffers that are generated once per context and reused.
 */

export type NoiseColor = "white" | "pink" | "brown";

export interface NoiseBank {
  readonly white: AudioBuffer;
  readonly pink: AudioBuffer;
  readonly brown: AudioBuffer;
}

/** Everything a sound needs to render: where it goes, when it starts and its pitch scale. */
export interface Voice {
  readonly ctx: BaseAudioContext;
  readonly noise: NoiseBank;
  /** Dry destination. */
  readonly out: AudioNode;
  /** Reverb send (optional). */
  readonly wet: AudioNode | null;
  /** Echo/delay send (optional). */
  readonly echo: AudioNode | null;
  /** Absolute start time in context seconds. */
  readonly t: number;
  /** Pitch multiplier applied to oscillator and filter frequencies. */
  readonly p: number;
}

/** Amplitude envelope + routing shared by every primitive. Times are relative to `voice.t`. */
export interface Shape {
  /** Start offset (s). */
  at?: number;
  /** Attack (s), linear. */
  a?: number;
  /** Sustain at peak before decaying (s). */
  hold?: number;
  /** Exponential decay/release (s). */
  d: number;
  /** Peak gain. */
  g: number;
  /** Reverb send level. */
  wet?: number;
  /** Echo send level. */
  echo?: number;
  /** Stereo position -1..1. */
  pan?: number;
}

const EPS = 0.0001;
const banks = new WeakMap<BaseAudioContext, NoiseBank>();

export function noiseBank(ctx: BaseAudioContext): NoiseBank {
  let bank = banks.get(ctx);
  if (!bank) {
    bank = makeNoiseBank(ctx);
    banks.set(ctx, bank);
  }
  return bank;
}

function makeNoiseBank(ctx: BaseAudioContext): NoiseBank {
  const len = Math.floor(ctx.sampleRate * 2);
  const white = ctx.createBuffer(1, len, ctx.sampleRate);
  const pink = ctx.createBuffer(1, len, ctx.sampleRate);
  const brown = ctx.createBuffer(1, len, ctx.sampleRate);
  const w = white.getChannelData(0);
  const pk = pink.getChannelData(0);
  const br = brown.getChannelData(0);
  let b0 = 0;
  let b1 = 0;
  let b2 = 0;
  let b3 = 0;
  let b4 = 0;
  let b5 = 0;
  let b6 = 0;
  let last = 0;
  for (let i = 0; i < len; i++) {
    const x = Math.random() * 2 - 1;
    w[i] = x * 0.9;
    // Paul Kellet's refined pink filter.
    b0 = 0.99886 * b0 + x * 0.0555179;
    b1 = 0.99332 * b1 + x * 0.0750759;
    b2 = 0.969 * b2 + x * 0.153852;
    b3 = 0.8665 * b3 + x * 0.3104856;
    b4 = 0.55 * b4 + x * 0.5329522;
    b5 = -0.7616 * b5 - x * 0.016898;
    pk[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + x * 0.5362) * 0.11;
    b6 = x * 0.115926;
    last = (last + 0.02 * x) / 1.02;
    br[i] = last * 3.5;
  }
  return { white, pink, brown };
}

const curves = new Map<number, Float32Array<ArrayBuffer>>();

/** Soft-saturation curve; `amount` 0..1. Cached. */
export function driveCurve(amount: number): Float32Array<ArrayBuffer> {
  const key = Math.round(amount * 100);
  let c = curves.get(key);
  if (!c) {
    const n = 1024;
    c = new Float32Array(n);
    const k = 1 + key * 0.5;
    const norm = Math.tanh(k);
    for (let i = 0; i < n; i++) {
      const x = (i / (n - 1)) * 2 - 1;
      c[i] = Math.tanh(k * x) / norm;
    }
    curves.set(key, c);
  }
  return c;
}

export function clampFreq(ctx: BaseAudioContext, f: number): number {
  return Math.min(Math.max(f, 10), ctx.sampleRate * 0.45);
}

export function mtof(midi: number): number {
  return 440 * 2 ** ((midi - 69) / 12);
}

export const rand = (lo: number, hi: number): number => lo + Math.random() * (hi - lo);
export const chance = (p: number): boolean => Math.random() < p;
export function pick<T>(xs: readonly T[]): T {
  return xs[Math.floor(Math.random() * xs.length)] as T;
}

/** Builds the gain envelope and output routing. Returns the node to feed and the timing. */
function amp(v: Voice, s: Shape): { input: GainNode; t0: number; end: number; nodes: AudioNode[] } {
  const { ctx } = v;
  const g = ctx.createGain();
  const nodes: AudioNode[] = [g];
  const t0 = v.t + (s.at ?? 0);
  const a = Math.max(s.a ?? 0.003, 0.001);
  const hold = s.hold ?? 0;
  const end = t0 + a + hold + Math.max(s.d, 0.005);
  const peak = Math.max(s.g, EPS * 2);
  const p = g.gain;
  p.setValueAtTime(0, t0);
  p.linearRampToValueAtTime(peak, t0 + a);
  if (hold > 0) p.setValueAtTime(peak, t0 + a + hold);
  p.exponentialRampToValueAtTime(EPS, end);
  p.linearRampToValueAtTime(0, end + 0.005);

  let dry: AudioNode = g;
  if (s.pan && ctx.createStereoPanner) {
    const pan = ctx.createStereoPanner();
    pan.pan.value = Math.max(-1, Math.min(1, s.pan));
    g.connect(pan);
    nodes.push(pan);
    dry = pan;
  }
  dry.connect(v.out);
  if (s.wet && v.wet) {
    const w = ctx.createGain();
    w.gain.value = s.wet;
    dry.connect(w);
    w.connect(v.wet);
    nodes.push(w);
  }
  if (s.echo && v.echo) {
    const e = ctx.createGain();
    e.gain.value = s.echo;
    dry.connect(e);
    e.connect(v.echo);
    nodes.push(e);
  }
  return { input: g, t0, end, nodes };
}

function run(
  src: AudioScheduledSourceNode,
  extra: AudioScheduledSourceNode[],
  nodes: AudioNode[],
  t0: number,
  end: number,
): void {
  const stopAt = end + 0.02;
  for (const s of extra) {
    s.start(t0);
    s.stop(stopAt);
  }
  src.start(t0);
  src.stop(stopAt);
  src.onended = () => {
    for (const n of nodes) n.disconnect();
    for (const s of extra) s.disconnect();
    src.disconnect();
  };
}

/** Optional filter stage. Frequencies are scaled by pitch. */
interface FilterOpts {
  filter?: BiquadFilterType;
  /** Filter frequency at start. */
  f?: number;
  /** Filter frequency at end of glide. */
  f2?: number;
  /** Filter glide time (s), defaults to the full sound. */
  fGlide?: number;
  q?: number;
  /** LFO wobble on filter: rate Hz, depth Hz. */
  wob?: { rate: number; depth: number };
}

function filterStage(
  v: Voice,
  o: FilterOpts,
  t0: number,
  end: number,
  extra: AudioScheduledSourceNode[],
  nodes: AudioNode[],
): BiquadFilterNode | null {
  if (!o.filter) return null;
  const { ctx } = v;
  const bq = ctx.createBiquadFilter();
  bq.type = o.filter;
  bq.Q.value = o.q ?? 0.7;
  const f1 = clampFreq(ctx, (o.f ?? 1000) * v.p);
  bq.frequency.setValueAtTime(f1, t0);
  if (o.f2 !== undefined) {
    bq.frequency.exponentialRampToValueAtTime(
      clampFreq(ctx, o.f2 * v.p),
      o.fGlide !== undefined ? t0 + o.fGlide : end,
    );
  }
  if (o.wob) {
    const lfo = ctx.createOscillator();
    lfo.frequency.value = o.wob.rate;
    const depth = ctx.createGain();
    depth.gain.value = o.wob.depth * v.p;
    lfo.connect(depth);
    depth.connect(bq.frequency);
    extra.push(lfo);
    nodes.push(depth);
  }
  nodes.push(bq);
  return bq;
}

function driveStage(
  v: Voice,
  drive: number | undefined,
  nodes: AudioNode[],
): WaveShaperNode | null {
  if (!drive) return null;
  const ws = v.ctx.createWaveShaper();
  ws.curve = driveCurve(drive);
  ws.oversample = "2x";
  nodes.push(ws);
  return ws;
}

function chain(first: AudioNode, stages: (AudioNode | null)[], last: AudioNode): void {
  let cur = first;
  for (const s of stages) {
    if (!s) continue;
    cur.connect(s);
    cur = s;
  }
  cur.connect(last);
}

export interface ToneOpts extends Shape, FilterOpts {
  type?: OscillatorType;
  /** Oscillator frequency (Hz), scaled by pitch. */
  hz: number;
  /** End frequency for a pitch glide. */
  hz2?: number;
  /** Glide duration (s), defaults to the whole sound. */
  glide?: number;
  /** Detune (cents). */
  detune?: number;
  /** Vibrato: rate Hz, depth cents. */
  vib?: { rate: number; depth: number };
  /** Tremolo: rate Hz, depth 0..1. */
  trem?: { rate: number; depth: number };
  /** Saturation 0..1. */
  drive?: number;
}

/** One oscillator through optional filter/drive and an envelope. */
export function tone(v: Voice, o: ToneOpts): void {
  const { ctx } = v;
  const env = amp(v, o);
  const { t0, end, nodes } = env;
  const extra: AudioScheduledSourceNode[] = [];
  const osc = ctx.createOscillator();
  osc.type = o.type ?? "sine";
  osc.frequency.setValueAtTime(clampFreq(ctx, o.hz * v.p), t0);
  if (o.hz2 !== undefined) {
    osc.frequency.exponentialRampToValueAtTime(
      clampFreq(ctx, o.hz2 * v.p),
      o.glide !== undefined ? t0 + o.glide : end,
    );
  }
  if (o.detune) osc.detune.value = o.detune;
  if (o.vib) {
    const lfo = ctx.createOscillator();
    lfo.frequency.value = o.vib.rate;
    const d = ctx.createGain();
    d.gain.value = o.vib.depth;
    lfo.connect(d);
    d.connect(osc.detune);
    extra.push(lfo);
    nodes.push(d);
  }
  let trem: GainNode | null = null;
  if (o.trem) {
    trem = ctx.createGain();
    trem.gain.value = 1 - o.trem.depth / 2;
    const lfo = ctx.createOscillator();
    lfo.frequency.value = o.trem.rate;
    const d = ctx.createGain();
    d.gain.value = o.trem.depth / 2;
    lfo.connect(d);
    d.connect(trem.gain);
    extra.push(lfo);
    nodes.push(trem, d);
  }
  const bq = filterStage(v, o, t0, end, extra, nodes);
  const ws = driveStage(v, o.drive, nodes);
  chain(osc, [ws, bq, trem], env.input);
  run(osc, extra, nodes, t0, end);
}

export interface NoiseOpts extends Shape, FilterOpts {
  color?: NoiseColor;
  /** Playback rate (pitch-scaled); <1 darkens. */
  rate?: number;
  drive?: number;
  trem?: { rate: number; depth: number };
}

/** Filtered noise burst from the shared buffers (random offset, looped). */
export function noise(v: Voice, o: NoiseOpts): void {
  const { ctx } = v;
  const env = amp(v, o);
  const { t0, end, nodes } = env;
  const extra: AudioScheduledSourceNode[] = [];
  const src = ctx.createBufferSource();
  const buf = v.noise[o.color ?? "white"];
  src.buffer = buf;
  src.loop = true;
  src.playbackRate.value = (o.rate ?? 1) * v.p;
  let trem: GainNode | null = null;
  if (o.trem) {
    trem = ctx.createGain();
    trem.gain.value = 1 - o.trem.depth / 2;
    const lfo = ctx.createOscillator();
    lfo.type = "square";
    lfo.frequency.value = o.trem.rate;
    const d = ctx.createGain();
    d.gain.value = o.trem.depth / 2;
    lfo.connect(d);
    d.connect(trem.gain);
    extra.push(lfo);
    nodes.push(trem, d);
  }
  const bq = filterStage(v, o, t0, end, extra, nodes);
  const ws = driveStage(v, o.drive, nodes);
  chain(src, [bq, ws, trem], env.input);
  const offset = Math.random() * (buf.duration - 0.05);
  const stopAt = end + 0.02;
  for (const s of extra) {
    s.start(t0);
    s.stop(stopAt);
  }
  src.start(t0, offset);
  src.stop(stopAt);
  src.onended = () => {
    for (const n of nodes) n.disconnect();
    for (const s of extra) s.disconnect();
    src.disconnect();
  };
}

export interface FmOpts extends Shape, FilterOpts {
  hz: number;
  hz2?: number;
  glide?: number;
  /** Modulator frequency ratio (non-integer = metallic). */
  ratio: number;
  /** Modulation index at start (x carrier frequency). */
  index: number;
  /** Modulation index at end. */
  index2?: number;
  type?: OscillatorType;
}

/** Two-operator FM: great for clangs, bells and metallic hits. */
export function fm(v: Voice, o: FmOpts): void {
  const { ctx } = v;
  const env = amp(v, o);
  const { t0, end, nodes } = env;
  const extra: AudioScheduledSourceNode[] = [];
  const car = ctx.createOscillator();
  car.type = o.type ?? "sine";
  const f = clampFreq(ctx, o.hz * v.p);
  car.frequency.setValueAtTime(f, t0);
  const mod = ctx.createOscillator();
  mod.frequency.setValueAtTime(clampFreq(ctx, f * o.ratio), t0);
  if (o.hz2 !== undefined) {
    const f2 = clampFreq(ctx, o.hz2 * v.p);
    const tg = o.glide !== undefined ? t0 + o.glide : end;
    car.frequency.exponentialRampToValueAtTime(f2, tg);
    mod.frequency.exponentialRampToValueAtTime(clampFreq(ctx, f2 * o.ratio), tg);
  }
  const idx = ctx.createGain();
  idx.gain.setValueAtTime(o.index * f, t0);
  idx.gain.exponentialRampToValueAtTime(Math.max((o.index2 ?? o.index * 0.05) * f, 0.01), end);
  mod.connect(idx);
  idx.connect(car.frequency);
  extra.push(mod);
  nodes.push(idx);
  const bq = filterStage(v, o, t0, end, extra, nodes);
  chain(car, [bq], env.input);
  run(car, extra, nodes, t0, end);
}

/** Inharmonic sine partials: [ratio, relative gain, decay multiplier]. */
export const BELL: readonly (readonly [number, number, number])[] = [
  [1, 1, 1],
  [2.01, 0.5, 0.7],
  [2.76, 0.35, 0.5],
  [4.07, 0.2, 0.35],
  [5.43, 0.12, 0.25],
];

export const WARM_BELL: readonly (readonly [number, number, number])[] = [
  [1, 1, 1],
  [2, 0.35, 0.6],
  [3.01, 0.12, 0.4],
];

export interface BellOpts extends Shape {
  hz: number;
  partials?: readonly (readonly [number, number, number])[];
}

export function bell(v: Voice, o: BellOpts): void {
  const parts = o.partials ?? BELL;
  for (const [ratio, gain, decay] of parts) {
    const hz = o.hz * ratio;
    if (hz * v.p > v.ctx.sampleRate * 0.45) continue;
    tone(v, { ...o, type: "sine", hz, g: o.g * gain, d: o.d * decay });
  }
}

/** A Voice that starts `dt` seconds later, optionally with a different pitch factor. */
export function later(v: Voice, dt: number, pitch = 1): Voice {
  return { ...v, t: v.t + dt, p: v.p * pitch };
}

/** Procedural stereo impulse response: decaying noise that darkens over time. */
export function makeImpulse(ctx: BaseAudioContext, seconds: number, brightness = 0.6): AudioBuffer {
  const rate = ctx.sampleRate;
  const len = Math.floor(rate * seconds);
  const buf = ctx.createBuffer(2, len, rate);
  const pre = Math.floor(rate * 0.012);
  for (let ch = 0; ch < 2; ch++) {
    const d = buf.getChannelData(ch);
    let lp = 0;
    for (let i = pre; i < len; i++) {
      const k = (i - pre) / (len - pre);
      // One-pole lowpass whose cutoff falls with time: highs die first.
      const coef = brightness * (1 - k) ** 1.5 + 0.02;
      lp += coef * (Math.random() * 2 - 1 - lp);
      d[i] = lp * (1 - k) ** 2.2;
    }
  }
  return buf;
}

export function makeReverb(
  ctx: BaseAudioContext,
  seconds: number,
  brightness = 0.6,
): ConvolverNode {
  const conv = ctx.createConvolver();
  conv.normalize = true;
  conv.buffer = makeImpulse(ctx, seconds, brightness);
  return conv;
}

/** Feedback delay with a darkening loop filter. Returns input and output nodes. */
export function makeEcho(
  ctx: BaseAudioContext,
  time: number,
  feedback: number,
  tone = 2200,
): { input: GainNode; output: GainNode } {
  const input = ctx.createGain();
  const output = ctx.createGain();
  const delay = ctx.createDelay(2);
  delay.delayTime.value = time;
  const fb = ctx.createGain();
  fb.gain.value = feedback;
  const lp = ctx.createBiquadFilter();
  lp.type = "lowpass";
  lp.frequency.value = tone;
  input.connect(delay);
  delay.connect(lp);
  lp.connect(fb);
  fb.connect(delay);
  lp.connect(output);
  return { input, output };
}

/**
 * Master bus safety chain: transparent below about -3 dBFS, then a fast limiter and a soft
 * clipper so the output can never exceed ~0.96. Returns the node to feed.
 */
export function makeMasterChain(ctx: BaseAudioContext, dest: AudioNode): AudioNode {
  const limit = ctx.createDynamicsCompressor();
  limit.threshold.value = -3;
  limit.knee.value = 3;
  limit.ratio.value = 20;
  limit.attack.value = 0.001;
  limit.release.value = 0.1;
  // DynamicsCompressorNode applies automatic make-up gain (Blink/WebKit/Gecko share the same
  // kernel); for these settings it is ~x1.147 (measured), so undo it to stay unity below threshold.
  const unmakeup = ctx.createGain();
  unmakeup.gain.value = 1 / 1.147;
  const clip = ctx.createWaveShaper();
  clip.curve = softClipCurve();
  clip.oversample = "2x";
  limit.connect(unmakeup);
  unmakeup.connect(clip);
  clip.connect(dest);
  return limit;
}

let clipCurve: Float32Array<ArrayBuffer> | null = null;
function softClipCurve(): Float32Array<ArrayBuffer> {
  if (clipCurve) return clipCurve;
  const n = 2048;
  const c = new Float32Array(n);
  const knee = 0.85;
  const ceil = 0.98;
  for (let i = 0; i < n; i++) {
    const x = (i / (n - 1)) * 2 - 1;
    const ax = Math.abs(x);
    const y = ax <= knee ? ax : knee + (ceil - knee) * Math.tanh((ax - knee) / (ceil - knee));
    c[i] = Math.sign(x) * y;
  }
  clipCurve = c;
  return c;
}
