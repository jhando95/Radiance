/**
 * Parallax battle backdrops (native 320x180, displayed 4x) and the expedition-map sky.
 *
 * Everything is drawn into raw RGBA buffers (fast) with palette colors, ordered (Bayer)
 * dithering for gradients and light pools, and atmospheric perspective: farther layers are
 * mixed toward each biome's haze color. The bottom ~46px is a calm, low-contrast ground
 * strip (feet at y≈160) so characters read clearly. Output is deterministic per seed.
 */
import { hexToRgb, INK, mix, RAMPS } from "./palette";
import { artRng, bayer, flipCanvas, makeCanvas } from "./pixel";

export type Biome = "duskMines" | "crystalHollows" | "ashenSurface";
export interface Backdrop {
  layers: HTMLCanvasElement[];
}

const W = 320;
const H = 180;
/** Top edge of the walkable ground strip. */
const GY = 134;
const FRONT_W = 400;

const { void: VOID, steel, lamp, rust, crystal, leather, bone, rock, umbra } = RAMPS;

// ---------------------------------------------------------------------------------------
// Buffer
// ---------------------------------------------------------------------------------------

type RGB = readonly [number, number, number];
const rgbCache = new Map<string, RGB>();
function rgb(hex: string): RGB {
  let c = rgbCache.get(hex);
  if (!c) {
    c = hexToRgb(hex);
    rgbCache.set(hex, c);
  }
  return c;
}

/** Packed little-endian RGBA (as written through a Uint32Array view), memoized. */
const packCache: Record<string, number> = {};
function pack(hex: string): number {
  let v = packCache[hex];
  if (v === undefined) {
    const [r, g, b] = hexToRgb(hex);
    v = ((255 << 24) | (b << 16) | (g << 8) | r) >>> 0;
    packCache[hex] = v;
  }
  return v;
}

/** Memoized color mix for hot loops (nested maps: no per-call key allocation). */
const mixCache = new Map<string, Map<string, Map<number, string>>>();
function mixc(a: string, b: string, t: number): string {
  let ma = mixCache.get(a);
  if (!ma) {
    ma = new Map();
    mixCache.set(a, ma);
  }
  let mb = ma.get(b);
  if (!mb) {
    mb = new Map();
    ma.set(b, mb);
  }
  let v = mb.get(t);
  if (v === undefined) {
    v = mix(a, b, t);
    mb.set(t, v);
  }
  return v;
}

type Pt = readonly [number, number];

class Buf {
  readonly data: Uint8ClampedArray<ArrayBuffer>;
  private readonly u32: Uint32Array;
  private glows: { x: number; y: number; r: number; c: string; s: number }[] = [];

  constructor(
    readonly w: number,
    readonly h: number,
  ) {
    this.data = new Uint8ClampedArray(w * h * 4);
    this.u32 = new Uint32Array(this.data.buffer);
  }

  px(x: number, y: number, hex: string, a = 1): void {
    const xi = x | 0;
    const yi = y | 0;
    if (xi < 0 || yi < 0 || xi >= this.w || yi >= this.h || a <= 0) return;
    if (a >= 1) {
      this.u32[yi * this.w + xi] = pack(hex);
      return;
    }
    const i = (yi * this.w + xi) * 4;
    const [r, g, b] = rgb(hex);
    const d = this.data;
    const da = (d[i + 3] as number) / 255;
    const oa = a + da * (1 - a);
    d[i] = (r * a + (d[i] as number) * da * (1 - a)) / oa;
    d[i + 1] = (g * a + (d[i + 1] as number) * da * (1 - a)) / oa;
    d[i + 2] = (b * a + (d[i + 2] as number) * da * (1 - a)) / oa;
    d[i + 3] = oa * 255;
  }

  has(x: number, y: number): boolean {
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return false;
    return (this.data[(y * this.w + x) * 4 + 3] as number) > 0;
  }

  rect(x: number, y: number, w: number, h: number, hex: string, a = 1): void {
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) this.px(x + i, y + j, hex, a);
  }

  /** Ordered-dither rectangle between two colors (t = share of b). */
  drect(x: number, y: number, w: number, h: number, a: string, b: string, t: number): void {
    for (let j = 0; j < h; j++)
      for (let i = 0; i < w; i++) this.px(x + i, y + j, t > bayer(x + i, y + j) ? b : a);
  }

  line(x0: number, y0: number, x1: number, y1: number, hex: string, a = 1): void {
    let x = Math.round(x0);
    let y = Math.round(y0);
    const ex = Math.round(x1);
    const ey = Math.round(y1);
    const dx = Math.abs(ex - x);
    const dy = -Math.abs(ey - y);
    const sx = x < ex ? 1 : -1;
    const sy = y < ey ? 1 : -1;
    let err = dx + dy;
    for (;;) {
      this.px(x, y, hex, a);
      if (x === ex && y === ey) break;
      const e2 = 2 * err;
      if (e2 >= dy) {
        err += dy;
        x += sx;
      }
      if (e2 <= dx) {
        err += dx;
        y += sy;
      }
    }
  }

  poly(points: readonly Pt[], fill: (x: number, y: number) => string | null): void {
    const ys = points.map((p) => p[1]);
    const y0 = Math.max(0, Math.floor(Math.min(...ys)));
    const y1 = Math.min(this.h - 1, Math.ceil(Math.max(...ys)));
    for (let y = y0; y <= y1; y++) {
      const yc = y + 0.5;
      const xs: number[] = [];
      for (let i = 0; i < points.length; i++) {
        const a = points[i] as Pt;
        const b = points[(i + 1) % points.length] as Pt;
        if ((a[1] <= yc && b[1] > yc) || (b[1] <= yc && a[1] > yc)) {
          xs.push(a[0] + ((yc - a[1]) / (b[1] - a[1])) * (b[0] - a[0]));
        }
      }
      xs.sort((p, q) => p - q);
      for (let i = 0; i + 1 < xs.length; i += 2) {
        const xa = Math.max(0, Math.round(xs[i] as number));
        const xb = Math.min(this.w - 1, Math.round(xs[i + 1] as number) - 1);
        for (let x = xa; x <= xb; x++) {
          const c = fill(x, y);
          if (c) this.px(x, y, c);
        }
      }
    }
  }

  disc(cx: number, cy: number, r: number, fill: (x: number, y: number) => string | null): void {
    const r2 = r * r + r * 0.5;
    for (let y = Math.floor(cy - r); y <= Math.ceil(cy + r); y++) {
      for (let x = Math.floor(cx - r); x <= Math.ceil(cx + r); x++) {
        const dx = x - cx;
        const dy = y - cy;
        if (dx * dx + dy * dy <= r2) {
          const c = fill(x, y);
          if (c) this.px(x, y, c);
        }
      }
    }
  }

  /**
   * Dithered light pool: tints already-opaque pixels toward `hex`, quantized in steps
   * with a Bayer threshold so it stays crisp pixel art (no smooth smears).
   */
  light(cx: number, cy: number, r: number, hex: string, strength: number, steps = 4): void {
    const [lr, lg, lb] = rgb(hex);
    const d = this.data;
    for (let y = Math.max(0, Math.floor(cy - r)); y <= Math.min(this.h - 1, cy + r); y++) {
      for (let x = Math.max(0, Math.floor(cx - r)); x <= Math.min(this.w - 1, cx + r); x++) {
        const dist = Math.hypot(x - cx, (y - cy) * 1.15);
        if (dist >= r) continue;
        const i = (y * this.w + x) * 4;
        if ((d[i + 3] as number) === 0) continue;
        const f = 1 - dist / r;
        const q = Math.floor(f * f * strength * steps + bayer(x, y)) / steps;
        if (q <= 0) continue;
        d[i] = (d[i] as number) + (lr - (d[i] as number)) * q;
        d[i + 1] = (d[i + 1] as number) + (lg - (d[i + 1] as number)) * q;
        d[i + 2] = (d[i + 2] as number) + (lb - (d[i + 2] as number)) * q;
      }
    }
  }

  /** Raw RGBA at a pixel (alpha 0 when outside). */
  at(x: number, y: number): [number, number, number, number] {
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return [0, 0, 0, 0];
    const i = (y * this.w + x) * 4;
    const d = this.data;
    return [d[i] as number, d[i + 1] as number, d[i + 2] as number, d[i + 3] as number];
  }

  /**
   * Immediate, dithered additive glow written into the buffer (respects draw order, so
   * later shapes can occlude it). On transparent pixels it lays down translucent color.
   */
  glowNow(cx: number, cy: number, r: number, hex: string, s: number, steps = 12): void {
    const [cr, cg, cb] = rgb(hex);
    const d = this.data;
    for (let y = Math.max(0, Math.floor(cy - r)); y <= Math.min(this.h - 1, cy + r); y++) {
      for (let x = Math.max(0, Math.floor(cx - r)); x <= Math.min(this.w - 1, cx + r); x++) {
        const dist = Math.hypot(x - cx, y - cy) / r;
        if (dist >= 1) continue;
        const f = Math.floor((1 - dist) ** 2 * s * steps + bayer(x, y)) / steps;
        if (f <= 0) continue;
        const i = (y * this.w + x) * 4;
        if ((d[i + 3] as number) === 0) {
          d[i] = cr;
          d[i + 1] = cg;
          d[i + 2] = cb;
          d[i + 3] = Math.min(255, f * 255);
        } else {
          d[i] = (d[i] as number) + cr * f;
          d[i + 1] = (d[i + 1] as number) + cg * f;
          d[i + 2] = (d[i + 2] as number) + cb * f;
        }
      }
    }
  }

  /** Smooth additive glow applied after rasterizing (lamps, crystals, corona). */
  glow(x: number, y: number, r: number, c: string, s: number): void {
    this.glows.push({ x, y, r, c, s });
  }

  canvas(): HTMLCanvasElement {
    const c = makeCanvas(this.w, this.h);
    const ctx = c.getContext("2d");
    if (!ctx) return c;
    ctx.putImageData(new ImageData(this.data, this.w, this.h), 0, 0);
    if (this.glows.length) {
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      for (const g of this.glows) {
        const [r, gg, b] = rgb(g.c);
        const grad = ctx.createRadialGradient(g.x + 0.5, g.y + 0.5, 0, g.x + 0.5, g.y + 0.5, g.r);
        grad.addColorStop(0, `rgba(${r},${gg},${b},${g.s})`);
        grad.addColorStop(0.35, `rgba(${r},${gg},${b},${g.s * 0.35})`);
        grad.addColorStop(1, `rgba(${r},${gg},${b},0)`);
        ctx.fillStyle = grad;
        ctx.fillRect(g.x - g.r, g.y - g.r, g.r * 2 + 1, g.r * 2 + 1);
      }
      ctx.restore();
    }
    return c;
  }
}

// ---------------------------------------------------------------------------------------
// Noise + helpers
// ---------------------------------------------------------------------------------------

function hash(x: number, y: number, s: number): number {
  let h = Math.imul(x | 0, 374761393) ^ Math.imul(y | 0, 668265263) ^ Math.imul(s | 0, 1442695041);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

function vnoise(x: number, y: number, s: number): number {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  let fx = x - xi;
  let fy = y - yi;
  fx = fx * fx * (3 - 2 * fx);
  fy = fy * fy * (3 - 2 * fy);
  const a = hash(xi, yi, s);
  const b = hash(xi + 1, yi, s);
  const c = hash(xi, yi + 1, s);
  const d = hash(xi + 1, yi + 1, s);
  return a + (b - a) * fx + (c - a) * fy + (a - b - c + d) * fx * fy;
}

function fbm(x: number, y: number, s: number, oct = 3): number {
  let amp = 0.5;
  let f = 1;
  let sum = 0;
  let norm = 0;
  for (let i = 0; i < oct; i++) {
    sum += amp * vnoise(x * f, y * f, s + i * 101);
    norm += amp;
    amp *= 0.5;
    f *= 2.03;
  }
  return sum / norm;
}

const fbm1 = (x: number, s: number, oct = 3) => fbm(x, 0.37, s, oct);

/** Ridged 1D noise: sharp peaks for mountains and rock spires. */
function ridged1(x: number, s: number, oct = 4): number {
  let amp = 0.5;
  let f = 1;
  let sum = 0;
  let norm = 0;
  for (let i = 0; i < oct; i++) {
    const n = 1 - Math.abs(vnoise(x * f, 0.5, s + i * 57) * 2 - 1);
    sum += amp * n * n;
    norm += amp;
    amp *= 0.5;
    f *= 2.1;
  }
  return sum / norm;
}

const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));

/** Vertical gradient across palette stops using ordered dithering between neighbours. */
function vgrad(b: Buf, x0: number, y0: number, w: number, h: number, stops: readonly string[]) {
  const n = stops.length - 1;
  for (let y = y0; y < y0 + h; y++) {
    const t = clamp(((y - y0) / Math.max(1, h - 1)) * n, 0, n);
    const i = Math.min(n - 1, Math.floor(t));
    const f = t - i;
    const a = stops[i] as string;
    const c = stops[i + 1] as string;
    for (let x = x0; x < x0 + w; x++) b.px(x, y, f > bayer(x, y) ? c : a);
  }
}

/** Pick a tone from a list using value v∈[0,1] with dithered transitions. */
function tone(tones: readonly string[], v: number, x: number, y: number, spread = 0.5): string {
  const t = clamp(v * tones.length + (bayer(x, y) - 0.5) * spread, 0, tones.length - 0.001);
  return tones[Math.floor(t)] as string;
}

/** Textured rock: soft tonal masses, thin cracks and top-lit ledge lips. */
function rockAt(
  x: number,
  y: number,
  s: number,
  tones: readonly string[],
  sx = 26,
  sy = 9,
  bias = 0,
  crack = 0.014,
): string {
  const m = fbm(x / (sx * 0.7), y / (sy * 1.3), s + 7, 2);
  if (Math.abs(m - 0.5) < crack) return tones[0] as string;
  const mu = fbm(x / (sx * 0.7), (y - 1) / (sy * 1.3), s + 7, 2);
  if (Math.abs(mu - 0.5) < crack) return tones[tones.length - 1] as string;
  const n = fbm(x / sx, y / sy, s, 2) + bias;
  return tone(tones, clamp((n - 0.28) * 2.1, 0, 1), x, y, 0.7);
}

/**
 * Fill a region (row-major, predicate-driven) with rock texture. Caches the crack field
 * of the previous row, which roughly halves the noise cost versus rockAt per pixel.
 */
function rockFill(
  b: Buf,
  inside: (x: number, y: number) => boolean,
  x0: number,
  x1: number,
  y0: number,
  y1: number,
  tones: readonly string[],
  s: number,
  sx = 26,
  sy = 9,
  bias = 0,
  crack = 0.014,
): void {
  const prev = new Float32Array(x1 - x0 + 1).fill(-1);
  const last = tones[tones.length - 1] as string;
  const first = tones[0] as string;
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      const k = x - x0;
      if (!inside(x, y)) {
        prev[k] = -1;
        continue;
      }
      const m = fbm(x / (sx * 0.7), y / (sy * 1.3), s + 7, 2);
      const mu = prev[k] as number;
      prev[k] = m;
      let c: string;
      if (Math.abs(m - 0.5) < crack) c = first;
      else if (mu >= 0 && Math.abs(mu - 0.5) < crack) c = last;
      else c = tone(tones, clamp((fbm(x / sx, y / sy, s, 2) + bias - 0.28) * 2.1, 0, 1), x, y, 0.7);
      b.px(x, y, c);
    }
  }
}

function catenary(b: Buf, x0: number, y0: number, x1: number, y1: number, sag: number, c: string) {
  let px = x0;
  let py = y0;
  const n = Math.max(2, Math.abs(x1 - x0));
  for (let i = 1; i <= n; i++) {
    const t = i / n;
    const x = x0 + (x1 - x0) * t;
    const y = y0 + (y1 - y0) * t + sag * 4 * t * (1 - t);
    b.line(px, py, x, y, c);
    px = x;
    py = y;
  }
}

function catenaryY(x0: number, y0: number, x1: number, y1: number, sag: number, x: number) {
  const t = (x - x0) / (x1 - x0);
  return y0 + (y1 - y0) * t + sag * 4 * t * (1 - t);
}

/**
 * One crystal prism rooted at (bx, by), tilted by `ang` radians. Faces: lit left facet,
 * mid front facet, dark right facet, a bright ridge between the first two, darker base.
 * ramp must have 6 entries (dark -> light).
 */
function prism(
  b: Buf,
  bx: number,
  by: number,
  h: number,
  w: number,
  ang: number,
  ramp: readonly string[],
) {
  const sn = Math.sin(ang);
  const cs = Math.cos(ang);
  const ext = h + w;
  for (let y = Math.floor(by - ext); y <= by + w; y++) {
    for (let x = Math.floor(bx - ext); x <= bx + ext; x++) {
      const dx = x + 0.5 - bx;
      const dy = y + 0.5 - by;
      const v = dx * sn - dy * cs;
      const u = dx * cs + dy * sn;
      if (v < -1.5 || v > h) continue;
      const hw = v < h * 0.74 ? w / 2 : (w / 2) * (1 - (v - h * 0.74) / (h * 0.26));
      if (Math.abs(u) > hw) continue;
      const ub = -0.32 * hw;
      let i: number;
      if (Math.abs(u) > hw - 1) i = 1;
      else if (u < ub) i = 4;
      else if (u < ub + 1) i = 5;
      else if (u < 0.3 * hw) i = 3;
      else i = 2;
      if (v < h * 0.25) i = Math.max(1, i - 1);
      if (v < h * 0.1) i = Math.max(0, i - 1);
      if (v > h - 1.6) i = 5;
      b.px(x, y, ramp[i] as string);
    }
  }
}

/** A fan of crystals erupting from a dark rock mound. */
function crystalCluster(
  b: Buf,
  x: number,
  base: number,
  size: number,
  rnd: () => number,
  ramp: readonly string[],
  mound?: readonly string[],
) {
  const n = 4 + Math.floor(rnd() * 3);
  const list: [number, number, number, number][] = [];
  for (let i = 0; i < n; i++) {
    const t = i / (n - 1) - 0.5;
    const ang = t * 1.3 + (rnd() - 0.5) * 0.3;
    const h = size * (1 - Math.abs(t) * 0.9) * (0.7 + rnd() * 0.35);
    const w = Math.max(3, size * (0.2 + rnd() * 0.1) * (1 - Math.abs(t) * 0.3));
    list.push([x + t * size * 0.45, h, w, ang]);
  }
  list.sort((a, c) => c[1] - a[1]);
  for (const [cx, h, w, ang] of list) prism(b, cx, base, h, w, ang, ramp);
  if (!mound) return;
  // rock mound the crystals erupt from
  const mw = size * 0.55;
  const mh = Math.max(3, size * 0.14);
  for (let y = Math.floor(base - mh); y <= base + 2; y++) {
    for (let xx = Math.floor(x - mw); xx <= x + mw; xx++) {
      const e = ((xx - x) / mw) ** 2 + ((y - base) / mh) ** 2;
      if (e > 1) continue;
      const lit = (xx - x) / mw + (y - base) / mh < -0.9;
      b.px(
        xx,
        y,
        e > 0.8 ? (mound[0] as string) : lit ? (mound[2] as string) : (mound[1] as string),
      );
    }
  }
}

/** Hanging stalactite / spike from a ceiling line. */
function spike(
  b: Buf,
  x: number,
  top: number,
  len: number,
  w: number,
  colorAt: (x: number, y: number, edge: number) => string,
) {
  for (let y = 0; y < len; y++) {
    const hw = (w / 2) * (1 - y / len) ** 1.3;
    const x0 = Math.round(x - hw);
    const x1 = Math.round(x + hw);
    for (let xx = x0; xx <= x1; xx++) {
      const edge = xx === x0 ? -1 : xx === x1 ? 1 : 0;
      b.px(xx, top + y, colorAt(xx, top + y, edge));
    }
  }
}

/** Rising stalagmite / rock spire from the ground line. */
function spire(
  b: Buf,
  x: number,
  base: number,
  h: number,
  w: number,
  t: readonly string[],
  lean = 0,
) {
  for (let y = 0; y < h; y++) {
    const k = y / h;
    const hw = (w / 2) * k ** 0.85;
    const cx = x + lean * (1 - k);
    const x0 = Math.round(cx - hw);
    const x1 = Math.round(cx + hw);
    for (let xx = x0; xx <= x1; xx++) {
      const c = xx === x0 ? t[2] : xx >= x1 - 1 ? t[0] : t[1];
      b.px(xx, base - h + y, c as string);
    }
  }
}

function stars(b: Buf, rnd: () => number, count: number, maxY: number) {
  for (let i = 0; i < count; i++) {
    const x = Math.floor(rnd() * b.w);
    const y = Math.floor(rnd() * rnd() * maxY);
    const r = rnd();
    const fade = 1 - (y / maxY) * 0.75;
    if (r > 0.988) {
      b.px(x, y, bone[5], 0.95 * fade);
      b.px(x - 1, y, steel[3], 0.45 * fade);
      b.px(x + 1, y, steel[3], 0.45 * fade);
      b.px(x, y - 1, steel[3], 0.45 * fade);
      b.px(x, y + 1, steel[3], 0.45 * fade);
    } else if (r > 0.93) b.px(x, y, r > 0.965 ? lamp[4] : steel[4], 0.7 * fade);
    else b.px(x, y, r > 0.5 ? steel[3] : VOID[5], (0.25 + r * 0.4) * fade);
  }
}

// ---------------------------------------------------------------------------------------
// Dusk Mines
// ---------------------------------------------------------------------------------------

function woodBeamV(b: Buf, x: number, y0: number, y1: number, w: number, t: readonly string[]) {
  for (let y = y0; y <= y1; y++) {
    for (let i = 0; i < w; i++) {
      const grain = (y * 3 + i * 7 + x) % 13 === 0;
      const c = i === 0 ? t[2] : i === w - 1 ? t[0] : grain ? t[0] : t[1];
      b.px(x + i, y, c as string);
    }
  }
}

function woodBeamH(b: Buf, x0: number, x1: number, y: number, h: number, t: readonly string[]) {
  for (let x = x0; x <= x1; x++) {
    for (let j = 0; j < h; j++) {
      const grain = (x * 5 + j * 3 + y) % 17 === 0;
      const c = j === 0 ? t[2] : j === h - 1 ? t[0] : grain ? t[0] : t[1];
      b.px(x, y + j, c as string);
    }
  }
}

function brace(b: Buf, x0: number, y0: number, x1: number, y1: number, t: readonly string[]) {
  b.line(x0, y0, x1, y1, t[1] as string);
  b.line(x0, y0 + 1, x1, y1 + 1, t[0] as string);
}

/** Small cage work lamp hanging from (x, y). lit 0 = dead, 1 = full. */
function workLamp(b: Buf, x: number, y: number, lit: number) {
  b.px(x, y, INK);
  b.px(x, y + 1, steel[1]);
  b.rect(x - 2, y + 2, 5, 1, steel[2]);
  b.px(x - 2, y + 2, steel[1]);
  b.rect(x - 1, y + 3, 3, 3, lit > 0 ? lamp[4] : VOID[1]);
  if (lit > 0) {
    b.px(x, y + 4, lamp[5]);
    b.px(x - 1, y + 5, lamp[3]);
    b.px(x + 1, y + 5, lamp[3]);
  } else {
    b.px(x - 1, y + 3, steel[1]);
    b.px(x + 1, y + 5, VOID[2]);
  }
  b.px(x - 2, y + 3, steel[1]);
  b.px(x + 2, y + 3, steel[0]);
  b.px(x - 2, y + 5, steel[1]);
  b.px(x + 2, y + 5, steel[0]);
  b.rect(x - 1, y + 6, 3, 1, steel[0]);
  if (lit > 0) {
    b.glow(x, y + 4, 30 * lit, lamp[3], 0.3 * lit);
    b.glow(x, y + 4, 8, lamp[4], 0.45 * lit);
  }
}

function duskMines(seed: number): Backdrop {
  const rnd = artRng(seed * 7919 + 11);
  const s = (seed * 131 + 7) | 0;
  const haze = mix(rock[2], leather[1], 0.45);
  const fade = (c: string, t: number) => mix(c, haze, t);

  // ---- L0: deep cavern, distant shafts, headframes and tunnel mouths ----
  const L0 = new Buf(W, H);
  vgrad(L0, 0, 0, W, GY + 8, [
    VOID[0],
    rock[0],
    fade(rock[0], 0.3),
    fade(rock[1], 0.5),
    fade(rock[1], 0.75),
    haze,
  ]);
  const farTones = [
    fade(rock[0], 0.55),
    fade(rock[1], 0.6),
    fade(rock[1], 0.45),
    fade(rock[2], 0.5),
  ];
  const farTop = new Float32Array(W);
  for (let x = 0; x < W; x++)
    farTop[x] = 74 + fbm1(x / 38, s + 3) * 40 - ridged1(x / 60, s + 4) * 22;
  rockFill(L0, (x, y) => y >= (farTop[x] as number), 0, W - 1, 30, GY + 7, farTones, s + 5, 34, 10);
  // vertical shafts: pale slots fading downward, timber cross-ties
  for (let k = 0; k < 3; k++) {
    const sx = 40 + k * 100 + Math.floor(rnd() * 40);
    const sw = 6 + Math.floor(rnd() * 4);
    const sBot = 64 + Math.floor(rnd() * 24);
    for (let y = 0; y < sBot; y++) {
      const t = (1 - y / sBot) * 0.75;
      for (let i = 0; i < sw; i++)
        L0.px(sx + i, y, t > bayer(sx + i, y) ? fade(VOID[3], 0.35) : fade(rock[0], 0.4));
      if (y % 10 === 5) L0.rect(sx - 1, y, sw + 2, 1, fade(leather[0], 0.35));
    }
    L0.px(sx - 1, 0, fade(leather[1], 0.3));
  }
  // distant headframes on the far floor
  for (let k = 0; k < 2; k++) {
    const hx = 76 + k * 150 + Math.floor(rnd() * 30);
    const hb = Math.min(GY, Math.floor(farTop[hx] ?? 110) + 8);
    const ht = hb - 46 - Math.floor(rnd() * 10);
    const c = fade(rock[0], 0.3);
    for (const sgn of [-1, 1]) {
      L0.line(hx + sgn * 12, hb, hx, ht, c);
      L0.line(hx + sgn * 11, hb, hx + sgn, ht, c);
    }
    for (let y = ht + 9; y < hb; y += 10) {
      const hw = ((y - ht) / (hb - ht)) * 12;
      L0.line(hx - hw, y, hx + hw, y, c);
    }
    L0.disc(hx, ht, 3, (x, y) => ((x + y) % 2 === 0 ? c : fade(rock[1], 0.4)));
    L0.px(hx, ht, fade(rock[2], 0.5));
    L0.rect(hx - 16, hb, 33, 2, c);
  }
  // far tunnel mouths with timber frames
  for (let k = 0; k < 2; k++) {
    const tx = 110 + k * 120 + Math.floor(rnd() * 24);
    const tw = 18;
    const th = 20;
    const ty = GY + 4 - th;
    L0.poly(
      [
        [tx, ty + th],
        [tx, ty + 4],
        [tx + 3, ty],
        [tx + tw - 3, ty],
        [tx + tw, ty + 4],
        [tx + tw, ty + th],
      ],
      () => VOID[0],
    );
    L0.rect(tx - 2, ty - 2, tw + 4, 2, fade(leather[1], 0.45));
    L0.rect(tx - 2, ty - 2, tw + 4, 1, fade(leather[2], 0.45));
    L0.rect(tx - 2, ty, 2, th, fade(leather[1], 0.5));
    L0.rect(tx + tw, ty, 2, th, fade(leather[0], 0.45));
  }
  // one far lamp still burning deep in the mine
  {
    const fx = 200 + Math.floor(rnd() * 50);
    const fy = 100 + Math.floor(rnd() * 8);
    L0.glowNow(fx, fy, 22, lamp[2], 0.5);
    L0.px(fx, fy, lamp[4]);
    L0.px(fx, fy + 1, lamp[2]);
  }

  // ---- L1: ceiling, flanking rock walls, far scaffold ----
  const L1 = new Buf(W, H);
  const wallTones = [
    INK,
    rock[0],
    mix(rock[0], rock[1], 0.45),
    mix(rock[0], fade(rock[1], 0.2), 0.8),
    fade(rock[1], 0.35),
  ];
  const ceil = new Float32Array(W);
  for (let x = 0; x < W; x++)
    ceil[x] = 12 + fbm1(x / 30, s + 21) * 20 + (1 - ridged1(x / 14, s + 22)) * 9;
  const lEdge = new Float32Array(H);
  const rEdge = new Float32Array(H);
  for (let y = 0; y < H; y++) {
    lEdge[y] = 30 + fbm1(y / 16, s + 25) * 24 - (y > 96 ? (y - 96) * 0.35 : 0);
    rEdge[y] = W - (26 + fbm1(y / 16, s + 26) * 28) + (y > 96 ? (y - 96) * 0.4 : 0);
  }
  rockFill(
    L1,
    (x, y) =>
      y < (ceil[x] as number) ||
      (y < GY + 4 && (x < (lEdge[y] as number) || x >= (rEdge[y] as number))),
    0,
    W - 1,
    0,
    GY + 3,
    wallTones,
    s + 23,
    20,
    9,
    -0.06,
  );
  // rim: faint lit lip on the cave-facing edge of the walls and ceiling
  for (let y = 0; y < GY + 4; y++) {
    const xl = Math.floor(lEdge[y] as number) - 1;
    const xr = Math.floor(rEdge[y] as number);
    if (xl > 0 && y > (ceil[xl] ?? 0)) L1.px(xl, y, fade(rock[2], 0.3));
    if (xr < W && y > (ceil[xr] ?? 0)) L1.px(xr, y, fade(rock[1], 0.3));
  }
  for (let x = 0; x < W; x++) L1.px(x, Math.floor(ceil[x] as number), fade(rock[1], 0.35));
  // stalactite drips from the ceiling
  for (let i = 0; i < 18; i++) {
    const x = Math.floor(rnd() * W);
    const top = (ceil[x] as number) - 1;
    spike(L1, x, top, 5 + Math.floor(rnd() * 14), 3 + rnd() * 4, (_x, _y, e) =>
      e < 0 ? fade(rock[1], 0.3) : e > 0 ? INK : rock[0],
    );
  }
  // far scaffold tower
  {
    const t = [fade(leather[0], 0.35), fade(leather[1], 0.4), fade(leather[2], 0.45)];
    const x0 = 168 + Math.floor(rnd() * 20);
    woodBeamV(L1, x0, 40, GY + 2, 3, t);
    woodBeamV(L1, x0 + 34, 46, GY + 2, 3, t);
    for (const y of [54, 84, 114]) woodBeamH(L1, x0 - 4, x0 + 40, y, 2, t);
    brace(L1, x0 + 3, 56, x0 + 34, 82, t);
    brace(L1, x0 + 3, 112, x0 + 34, 86, t);
    // dead lamp on the far tower
    workLamp(L1, x0 + 20, 58, 0);
  }

  // ---- L2: main scaffolding, catwalk, gantry, cables and work lamps ----
  const L2 = new Buf(W, H);
  const wood = [leather[0], leather[1], leather[2], leather[3]];
  const st = [VOID[0], steel[0], steel[1], steel[2]];
  const ax = 52 + Math.floor(rnd() * 10);
  woodBeamV(L2, ax, 40, GY + 2, 4, wood);
  woodBeamV(L2, ax + 44, 52, GY + 2, 4, wood);
  woodBeamH(L2, ax - 8, ax + 70, 56, 3, wood); // catwalk deck
  for (let x = ax - 6; x <= ax + 66; x += 7) L2.rect(x, 58, 1, 1, leather[0]);
  woodBeamH(L2, ax - 4, ax + 52, 46, 2, wood); // handrail
  for (let x = ax - 4; x <= ax + 52; x += 14) woodBeamV(L2, x, 46, 56, 2, wood);
  woodBeamH(L2, ax - 2, ax + 50, 98, 3, wood);
  brace(L2, ax + 4, 60, ax + 44, 96, wood);
  brace(L2, ax + 4, 96, ax + 44, 62, wood);
  brace(L2, ax + 4, 102, ax + 44, GY - 2, wood);
  // ladder down from the catwalk
  for (let y = 59; y < GY + 2; y++) {
    L2.px(ax + 60, y, leather[1]);
    L2.px(ax + 66, y, leather[0]);
    if (y % 5 === 0) L2.line(ax + 61, y, ax + 65, y, leather[2]);
  }
  // right steel gantry with lattice
  const gx = 236 + Math.floor(rnd() * 12);
  for (const px of [gx, gx + 26]) {
    for (let y = 30; y <= GY + 2; y++) {
      L2.px(px, y, st[3] as string);
      L2.px(px + 1, y, st[2] as string);
      L2.px(px + 2, y, st[1] as string);
    }
  }
  for (let y = 36; y < GY - 8; y += 18) {
    L2.line(gx + 3, y + 2, gx + 25, y + 18, st[1] as string);
    L2.line(gx + 25, y + 2, gx + 3, y + 18, st[1] as string);
    L2.rect(gx, y, 29, 2, st[2] as string);
    L2.rect(gx, y, 29, 1, st[3] as string);
    L2.px(gx + 1, y + 1, steel[3]);
    L2.px(gx + 27, y + 1, steel[3]);
  }
  // overhead I-beam across the cave with a pulley and hook
  for (let x = 96; x < W; x++) {
    L2.px(x, 28, st[3] as string);
    L2.px(x, 29, st[2] as string);
    L2.px(x, 30, st[1] as string);
    L2.px(x, 31, st[2] as string);
    if (x % 12 === 0) L2.px(x, 29, steel[3]);
  }
  const hookX = 196 + Math.floor(rnd() * 14);
  L2.disc(hookX, 34, 2.5, (x, y) => (x + y < hookX + 34 ? steel[2] : steel[0]));
  for (let y = 37; y < 76; y++) L2.px(hookX + ((y >> 1) % 2), y, y & 1 ? steel[1] : steel[0]);
  L2.rect(hookX - 1, 76, 4, 2, steel[1]);
  L2.px(hookX - 1, 76, steel[2]);
  for (const [dx, dy] of [
    [-2, 78],
    [-2, 79],
    [-1, 80],
    [0, 80],
    [1, 79],
  ] as const)
    L2.px(hookX + dx, dy, steel[1]);
  // cables with lamps
  const c1: [number, number, number, number, number] = [ax + 2, 41, 172, 31, 16];
  const c2: [number, number, number, number, number] = [182, 31, gx, 34, 14];
  catenary(L2, c1[0], c1[1], c1[2], c1[3], c1[4], INK);
  catenary(L2, c2[0], c2[1], c2[2], c2[3], c2[4], INK);
  const lampsSpec: [[number, number, number, number, number], number, number][] = [
    [c1, 0.35, rnd() < 0.8 ? 1 : 0],
    [c1, 0.75, rnd() < 0.3 ? 0.7 : 0],
    [c2, 0.3, rnd() < 0.25 ? 0.8 : 0],
    [c2, 0.68, rnd() < 0.8 ? 0.6 : 0],
  ];
  const litLamps: [number, number, number][] = [];
  for (const [c, t, lit] of lampsSpec) {
    const x = Math.round(c[0] + (c[2] - c[0]) * t);
    const y = Math.round(catenaryY(c[0], c[1], c[2], c[3], c[4], x));
    for (let j = 1; j < 4; j++) L2.px(x, y + j, INK);
    workLamp(L2, x, y + 4, lit);
    if (lit > 0) litLamps.push([x, y + 8, lit]);
  }
  for (const [x, y, lit] of litLamps) L2.light(x, y, 52 * lit, lamp[3], 0.7 * lit, 8);
  for (const [x, y, lit] of litLamps) {
    for (let i = 0; i < 7; i++) {
      const dx = (rnd() - 0.5) * 46;
      const dy = rnd() * 36 - 4;
      L2.px(x + dx, y + dy, lamp[4], 0.2 + rnd() * 0.3 * lit);
    }
  }

  // ---- L3: ground strip, rails, ore cart, debris ----
  const L3 = new Buf(W, H);
  const gTones = [
    VOID[0],
    rock[0],
    mix(rock[0], rock[1], 0.5),
    rock[1],
    mix(rock[1], rock[2], 0.5),
  ];
  for (let x = 0; x < W; x++) {
    const top = GY + Math.round((fbm1(x / 20, s + 41) - 0.5) * 3);
    for (let y = top; y < H; y++) {
      const depth = (y - top) / (H - top);
      let c: string;
      if (y === top) c = rock[2];
      else if (y === top + 1) c = mix(rock[1], rock[2], 0.5);
      else {
        const n = fbm(x / 34, y / 5, s + 42, 2);
        c = tone(gTones, clamp(0.78 - depth * 0.62 + (n - 0.5) * 0.3, 0, 1), x, y, 0.5);
      }
      L3.px(x, y, c);
    }
  }
  const railY = GY + 6;
  for (let x = 0; x < W; x++) {
    L3.px(x, railY, steel[2]);
    L3.px(x, railY + 1, steel[0]);
    if (x % 9 < 5) {
      L3.px(x, railY + 2, leather[1]);
      L3.px(x, railY + 3, leather[0]);
    }
  }
  // ore cart on the rail
  {
    const cx = 196 + Math.floor(rnd() * 30);
    const cy = railY - 3;
    const body: Pt[] = [
      [cx - 17, cy - 18],
      [cx + 17, cy - 18],
      [cx + 14, cy - 2],
      [cx - 14, cy - 2],
    ];
    const cartA = mix(rust[1], steel[0], 0.35);
    const cartB = mix(rust[2], steel[1], 0.4);
    L3.poly(body, (x, y) => {
      if (y === cy - 18) return steel[2];
      if (y === cy - 17) return steel[1];
      if (y === cy - 3) return VOID[0];
      if ((x - cx + 40) % 9 === 0) return steel[0];
      return x < cx - 9 ? cartB : cartA;
    });
    for (let x = cx - 13; x <= cx + 13; x += 9) {
      L3.px(x + 1, cy - 15, steel[2]);
      L3.px(x + 1, cy - 6, steel[1]);
    }
    L3.rect(cx - 15, cy - 2, 30, 1, steel[0]);
    for (let i = 0; i < 7; i++) {
      const ox = cx - 13 + i * 4 + rnd() * 2;
      const r = 3 + rnd() * 2;
      L3.disc(ox, cy - 19, r, (x, y) => {
        if (y > cy - 19) return null;
        return x - ox + (y - (cy - 19)) < -1.5
          ? rock[3]
          : y < cy - 20 - r * 0.4
            ? rock[2]
            : rock[1];
      });
    }
    for (let i = 0; i < 5; i++) {
      const gx2 = cx - 12 + Math.floor(rnd() * 24);
      const gy2 = cy - 21 - Math.floor(rnd() * 3);
      L3.px(gx2, gy2, i % 2 ? crystal[4] : lamp[3]);
    }
    for (const wx of [cx - 9, cx + 9]) {
      L3.disc(wx, cy, 2.6, (x, y) => (x + y < wx + cy ? steel[1] : VOID[0]));
      L3.px(wx, cy, steel[2]);
    }
  }
  // debris on the back edge: broken crate, pickaxe, rocks
  {
    const bx = 14 + Math.floor(rnd() * 14);
    const by = GY - 9;
    for (let j = 0; j < 10; j++) {
      for (let i = 0; i < 14; i++) {
        const edge = i === 0 || j === 0 || i === 13 || j === 9;
        const c = edge ? leather[2] : j % 3 === 0 ? leather[0] : leather[1];
        if (!(i > 9 && j < 3)) L3.px(bx + i, by + j, c);
      }
    }
    L3.line(bx + 1, by + 1, bx + 12, by + 8, leather[2]);
    // pickaxe leaning on the crate
    L3.line(bx + 18, GY + 1, bx + 24, by - 6, leather[2]);
    L3.line(bx + 19, GY + 1, bx + 25, by - 6, leather[0]);
    L3.line(bx + 19, by - 9, bx + 29, by - 4, steel[2]);
    L3.px(bx + 18, by - 10, steel[1]);
    for (let i = 0; i < 7; i++) {
      const rx = Math.floor(rnd() * W);
      if (rx > 80 && rx < 250) continue;
      const rr = 2 + rnd() * 3;
      L3.disc(rx, GY + 1, rr, (x, y) => (y > GY + 1 ? null : x < rx ? rock[2] : rock[1]));
    }
  }
  for (let i = 0; i < 18; i++) {
    const x = Math.floor(rnd() * W);
    const y = GY + 14 + Math.floor(rnd() * 28);
    L3.px(x, y, rock[1]);
    L3.px(x + 1, y, rock[1]);
    L3.px(x, y - 1, rock[2]);
  }
  for (const [x, , lit] of litLamps) L3.light(x, GY + 2, 34 * lit, lamp[2], 0.3 * lit, 8);

  // ---- L4: foreground framing (400 wide; centered, visible x≈40..360) ----
  const L4 = new Buf(FRONT_W, H);
  const post = [INK, VOID[0], mix(leather[0], VOID[0], 0.3), leather[0]];
  const PX = 50;
  woodBeamV(L4, PX, 0, H - 1, 9, [INK, post[1] as string, post[2] as string]);
  for (let y = 0; y < H; y++) L4.px(PX + 8, y, post[3] as string);
  for (let y = 18; y < H; y += 40) {
    L4.rect(PX - 1, y, 11, 2, post[1] as string);
    L4.px(PX + 8, y, steel[1]);
  }
  brace(L4, PX + 9, 30, PX + 44, 0, post);
  brace(L4, PX + 9, 31, PX + 44, 1, post);
  const fgT = [INK, INK, VOID[0], rock[0]];
  const re = new Float32Array(H);
  for (let y = 0; y < H; y++)
    re[y] = FRONT_W - 50 - fbm1(y / 12, s + 61) * 22 - (y > 120 ? (y - 120) * 0.45 : 0);
  rockFill(L4, (x, y) => x >= (re[y] as number), 300, FRONT_W - 1, 0, H - 1, fgT, s + 62, 16, 8);
  for (let y = 0; y < H; y++) L4.px(Math.floor(re[y] as number), y, rock[1]);
  for (let x = 0; x < FRONT_W; x++) {
    const side = Math.min(x - 30, FRONT_W - 30 - x);
    if (side > 70) continue;
    const top = H - 2 - (1 - Math.max(0, side) / 70) * 14 - ridged1(x / 9, s + 63) * 7;
    for (let y = Math.floor(top); y < H; y++) L4.px(x, y, y === Math.floor(top) ? rock[1] : INK);
  }
  // hanging chains catching a little lamp light
  for (const cx of [132 + Math.floor(rnd() * 20), 290 + Math.floor(rnd() * 20)]) {
    const len = 16 + Math.floor(rnd() * 18);
    for (let y = 0; y < len; y++) {
      const ph = y % 4;
      if (ph === 0 || ph === 2) {
        L4.px(cx, y, INK);
      } else {
        L4.px(cx - 1, y, INK);
        L4.px(cx + 1, y, INK);
        L4.px(cx - 1 + (ph === 1 ? 0 : 2), y, rock[1]);
      }
    }
  }

  return { layers: [L0.canvas(), L1.canvas(), L2.canvas(), L3.canvas(), L4.canvas()] };
}

// ---------------------------------------------------------------------------------------
// Crystal Hollows
// ---------------------------------------------------------------------------------------

function crystalHollows(seed: number): Backdrop {
  const rnd = artRng(seed * 4241 + 23);
  const s = (seed * 173 + 13) | 0;
  const haze = mix(crystal[0], VOID[2], 0.5);
  const fade = (c: string, t: number) => mix(c, haze, t);
  const trock = rock.map((c) => mix(c, crystal[0], 0.3));
  const tr = (i: number) => trock[i] as string;

  // ---- L0: deep cavern with distant spires and glowing veins ----
  const L0 = new Buf(W, H);
  vgrad(L0, 0, 0, W, GY + 8, [
    VOID[0],
    mix(VOID[0], crystal[0], 0.5),
    fade(crystal[0], 0.3),
    haze,
    fade(crystal[1], 0.55),
    haze,
  ]);
  // two far rock bands: upper one hangs from the dark, lower one rises from the floor
  const farA = [fade(tr(1), 0.6), fade(tr(1), 0.5), fade(tr(2), 0.55)];
  const farB = [fade(tr(0), 0.2), fade(tr(0), 0.3), fade(tr(1), 0.3), fade(tr(2), 0.4)];
  const topA = new Float32Array(W);
  const topB = new Float32Array(W);
  for (let x = 0; x < W; x++) {
    topA[x] = 70 + fbm1(x / 44, s + 1) * 34 - ridged1(x / 24, s + 2) * 30;
    topB[x] = 104 + fbm1(x / 30, s + 4) * 18 - ridged1(x / 16, s + 6) * 14;
  }
  rockFill(L0, (x, y) => y >= (topA[x] as number), 0, W - 1, 20, GY + 7, farA, s + 3, 30, 12);
  rockFill(L0, (x, y) => y >= (topB[x] as number), 0, W - 1, 70, GY + 7, farB, s + 8, 24, 10);
  for (let k = 0; k < 3; k++) {
    const cx = 60 + k * 100 + rnd() * 40;
    const cw = 8 + rnd() * 8;
    for (let y = 0; y < GY + 8; y++) {
      const hw =
        (cw / 2) * (1 - 0.4 * Math.sin((y / (GY + 8)) * Math.PI)) +
        (fbm1(y / 9, s + 40 + k) - 0.5) * 3;
      for (let x = Math.round(cx - hw); x <= Math.round(cx + hw); x++)
        L0.px(x, y, x === Math.round(cx - hw) ? fade(tr(2), 0.6) : fade(tr(1), 0.62));
    }
  }
  const farRamp = crystal.map((c) => fade(c, 0.5));
  for (let i = 0; i < 4; i++) {
    const x = 20 + rnd() * 280;
    const base = Math.floor(topB[Math.floor(x)] ?? 110) + 10;
    const size = 8 + rnd() * 6;
    L0.glowNow(x, base - size * 0.4, size * 2.6, crystal[2], 0.25);
    // distant clusters read best as a few bright glints inside their glow
    for (let k = 0; k < 3; k++)
      L0.px(x - 3 + k * 3, base - 3 - ((k * 5) % 4), farRamp[4] as string);
  }
  for (let i = 0; i < 28; i++) {
    L0.px(rnd() * W, rnd() * 100, i % 3 ? crystal[3] : crystal[5], 0.15 + rnd() * 0.3);
  }

  const big: [number, number][] = [
    [44 + rnd() * 12, 50 + rnd() * 10],
    [272 + rnd() * 14, 46 + rnd() * 12],
    [146 + rnd() * 30, 20 + rnd() * 6],
  ];

  // ---- L1: ceiling, stalactites, columns, mid-distance clusters ----
  const L1 = new Buf(W, H);
  const cT = [
    INK,
    tr(0),
    mix(tr(0), tr(1), 0.5),
    mix(tr(0), fade(tr(1), 0.15), 0.8),
    fade(tr(1), 0.3),
  ];
  const ceil = new Float32Array(W);
  for (let x = 0; x < W; x++) ceil[x] = 8 + fbm1(x / 26, s + 11) * 16;
  const cols: [number, number][] = [
    [24 + rnd() * 10, 18],
    [292 - rnd() * 10, 20],
  ];
  const colTab = cols.map(([, cw], ci) => {
    const t = new Float32Array(H);
    for (let y = 0; y < H; y++) {
      const pinch = 1 - 0.38 * Math.sin((y / (GY + 4)) * Math.PI);
      t[y] = (cw / 2) * pinch + (fbm1(y / 7, s + 14 + ci) - 0.5) * 4;
    }
    return t;
  });
  const colHW = (ci: number, y: number) => (colTab[ci] as Float32Array)[y] as number;
  rockFill(
    L1,
    (x, y) => {
      if (y < (ceil[x] as number)) return true;
      if (y >= GY + 4) return false;
      for (let ci = 0; ci < cols.length; ci++) {
        const cx = (cols[ci] as [number, number])[0];
        if (Math.abs(x - cx) <= colHW(ci, y)) return true;
      }
      return false;
    },
    0,
    W - 1,
    0,
    GY + 3,
    cT,
    s + 12,
    14,
    10,
    -0.05,
  );
  for (let ci = 0; ci < cols.length; ci++) {
    const cx = (cols[ci] as [number, number])[0];
    for (let y = Math.floor(ceil[Math.floor(cx)] ?? 0); y < GY + 4; y++) {
      const hw = colHW(ci, y);
      L1.px(Math.round(cx - hw), y, fade(tr(2), 0.2));
      L1.px(Math.round(cx + hw), y, INK);
    }
  }
  for (let i = 0; i < 24; i++) {
    const x = Math.floor(rnd() * W);
    const big = rnd() < 0.35;
    const len = big ? 26 + rnd() * 34 : 7 + rnd() * 14;
    const w = big ? 8 + rnd() * 6 : 3 + rnd() * 3;
    spike(L1, x, (ceil[x] as number) - 1, len, w, (xx, yy, e) =>
      e < 0 ? (cT[4] as string) : e > 0 ? INK : rockAt(xx, yy, s + 13, cT.slice(0, 4), 6, 14),
    );
    if (big && rnd() < 0.5) L1.px(x, (ceil[x] as number) + len - 1, crystal[4], 0.8);
  }
  const midRamp = crystal.map((c) => fade(c, 0.22));
  const midMound = [fade(tr(0), 0.2), fade(tr(1), 0.3), fade(tr(2), 0.3)];
  for (let i = 0; i < 3; i++) {
    const x = 92 + i * 66 + rnd() * 26;
    const base = GY + 1;
    const size = 18 + rnd() * 10;
    L1.glow(x, base - size * 0.4, size * 2, crystal[3], 0.12);
    crystalCluster(L1, x, base, size, rnd, midRamp, midMound);
  }

  for (const [x, size] of big) L1.light(x, GY - size * 0.5, size * 2, crystal[2], 0.35, 8);

  // ---- L2: big crystal clusters + stalagmites ----
  const L2 = new Buf(W, H);
  const sT = [tr(0), tr(1), tr(2)];
  for (let i = 0; i < 6; i++) {
    const x = i % 2 ? 66 + rnd() * 50 : 206 + rnd() * 50;
    spire(L2, x, GY + 3, 12 + rnd() * 26, 6 + rnd() * 6, sT, (rnd() - 0.5) * 4);
  }
  const lights: [number, number, number][] = [];
  const mound = [VOID[0], tr(1), tr(2)];
  for (const [x, size] of big) {
    L2.glowNow(x, GY - size * 0.35, size * 1.5, crystal[2], 0.28);
    crystalCluster(L2, x, GY + 3, size, rnd, crystal, mound);
    L2.glow(x, GY - size * 0.45, size * 1.2, crystal[3], 0.16);
    lights.push([x, GY - size * 0.4, size]);
  }
  for (const [x, y, size] of lights) L2.light(x, y, size * 1.4, crystal[3], 0.45, 6);

  // ---- L3: ground with a still pool that mirrors the crystals ----
  const L3 = new Buf(W, H);
  const gT = [VOID[0], tr(0), mix(tr(0), tr(1), 0.5), tr(1), mix(tr(1), tr(2), 0.5)];
  const poolTop = GY + 4;
  const poolBot = GY + 13;
  for (let x = 0; x < W; x++) {
    const top = GY + Math.round((fbm1(x / 24, s + 31) - 0.5) * 2);
    for (let y = top; y < H; y++) {
      let c: string | null = null;
      if (y >= poolTop && y <= poolBot) {
        // reflection: sample the cluster layer mirrored about the waterline
        const ripple = Math.round(Math.sin(y * 1.7 + x * 0.05) * ((y - poolTop) * 0.25));
        const sy = poolTop - 1 - (y - poolTop) * 2;
        const [r, g, bb, a] = L2.at(x + ripple, sy);
        const water = (y - poolTop) % 3 === 1 ? VOID[1] : mixc(VOID[1], crystal[0], 0.5);
        if (a > 0 && (y - poolTop) % 3 !== 2) {
          const t = 0.45 + ((y - poolTop) / (poolBot - poolTop)) * 0.35;
          const src = `#${((1 << 24) | (r << 16) | (g << 8) | bb).toString(16).slice(1)}`;
          c = mix(src, water, t);
        } else c = water;
        if (y === poolTop) c = mixc(crystal[2], VOID[1], 0.4);
      } else if (y === top) c = tr(2);
      else {
        const depth = (y - poolBot) / (H - poolBot);
        const n = fbm(x / 30, y / 5, s + 32, 2);
        c = tone(gT, clamp(0.76 - depth * 0.62 + (n - 0.5) * 0.3, 0, 1), x, y, 0.5);
        if (y === poolBot + 1) c = tr(2);
        if (y === poolBot + 2) c = mix(tr(1), tr(2), 0.5);
      }
      L3.px(x, y, c);
    }
  }
  for (let i = 0; i < 10; i++) {
    const x = Math.floor(rnd() * W);
    const h = 2 + Math.floor(rnd() * 4);
    const by = poolBot + 3;
    for (let j = 0; j < h; j++) {
      L3.px(x, by - j, j === h - 1 ? crystal[5] : crystal[3]);
      if (j < h - 1) L3.px(x + 1, by - j, crystal[1]);
    }
    L3.glow(x, by - 2, 7, crystal[3], 0.18);
  }
  for (let i = 0; i < 16; i++) {
    const x = Math.floor(rnd() * W);
    const y = poolBot + 8 + Math.floor(rnd() * 26);
    L3.px(x, y, tr(1));
    L3.px(x + 1, y, tr(1));
    L3.px(x, y - 1, tr(2));
  }
  for (const [x, , size] of lights) L3.light(x, GY + 16, size * 1.1, crystal[2], 0.35, 6);

  // ---- L4: foreground stalactites and dark crystals at the edges ----
  const L4 = new Buf(FRONT_W, H);
  const fgEdge = mix(tr(1), crystal[1], 0.3);
  for (const [x, len, w] of [
    [52, 74, 24],
    [86, 32, 11],
    [FRONT_W - 60, 84, 28],
    [FRONT_W - 98, 30, 10],
    [210, 14, 8],
  ] as const) {
    spike(L4, x + rnd() * 6, -1, len, w, (_x, y, e) =>
      e < 0 ? fgEdge : e > 0 ? INK : y % 9 === 4 ? VOID[0] : INK,
    );
  }
  const darkRamp = [INK, INK, VOID[0], mix(VOID[0], crystal[0], 0.6), crystal[0], crystal[1]];
  const dMound = [INK, INK, VOID[0]];
  crystalCluster(L4, 48, H + 4, 38, rnd, darkRamp, dMound);
  crystalCluster(L4, FRONT_W - 48, H + 4, 44, rnd, darkRamp, dMound);

  return { layers: [L0.canvas(), L1.canvas(), L2.canvas(), L3.canvas(), L4.canvas()] };
}

// ---------------------------------------------------------------------------------------
// Ashen Surface
// ---------------------------------------------------------------------------------------

function ashenSurface(seed: number): Backdrop {
  const rnd = artRng(seed * 6007 + 37);
  const s = (seed * 197 + 29) | 0;
  const horizon = 126;
  const sunX = 190 + Math.floor(rnd() * 70);
  const sunY = horizon + 2;
  const sunR = 58;
  /** Rim-light strength from the corona at a point (0..1). */
  const sunLit = (x: number, y: number) => {
    const d = Math.hypot(x - sunX, (y - sunY) * 1.3);
    return clamp(1 - (d - sunR * 0.8) / 60, 0, 1);
  };

  // ---- L0: sky, stars, eclipsed giant with a thin amber corona ----
  const L0 = new Buf(W, H);
  const skyStops = [
    VOID[0],
    mix(VOID[0], VOID[1], 0.5),
    VOID[1],
    mix(VOID[1], VOID[2], 0.5),
    VOID[2],
    mix(VOID[2], umbra[1], 0.35),
    mix(VOID[3], rust[0], 0.5),
    mix(VOID[3], lamp[0], 0.6),
  ];
  for (let y = 0; y < H; y++) {
    const base = clamp(y / horizon, 0, 1.2) ** 1.5 * 0.6;
    for (let x = 0; x < W; x++) {
      const warm = clamp(1 - Math.hypot((x - sunX) / 170, (y - horizon) / 80), 0, 1) ** 2 * 0.42;
      L0.px(x, y, tone(skyStops, clamp(base + warm, 0, 0.999), x, y, 1));
    }
  }
  stars(L0, rnd, 220, horizon);
  // corona glow (written before the disc so the disc occludes it)
  L0.glowNow(sunX, sunY, sunR + 70, lamp[2], 0.42, 40);
  L0.glowNow(sunX - 20, sunY - sunR + 8, 64, lamp[3], 0.22, 40);
  // faint corona streamers
  for (let k = 0; k < 9; k++) {
    const a = -Math.PI * (0.12 + (k / 8) * 0.76) + (rnd() - 0.5) * 0.1;
    const len = 10 + rnd() * 26;
    for (let r = sunR + 2; r < sunR + len; r++) {
      const x = sunX + Math.cos(a) * r;
      const y = sunY + Math.sin(a) * r;
      const f = 1 - (r - sunR) / len;
      if (f * 0.8 > bayer(Math.round(x), Math.round(y))) L0.px(x, y, lamp[1], 0.6);
    }
  }
  for (let y = sunY - sunR - 4; y < H; y++) {
    for (let x = sunX - sunR - 4; x <= sunX + sunR + 4; x++) {
      const d = Math.hypot(x - sunX, y - sunY);
      const up = clamp((sunY - y) / sunR, 0, 1);
      const lean = clamp(0.55 + ((sunX - x) / sunR) * 0.55, 0.15, 1);
      if (d <= sunR - 1) {
        const band = fbm(x / 44, y / 5, s + 5, 2);
        L0.px(x, y, band > 0.56 && 0.5 > bayer(x, y) ? VOID[1] : mixc(VOID[0], VOID[1], 0.35));
      } else if (d <= sunR) {
        L0.px(x, y, up > 0.1 ? mix(lamp[1], VOID[1], 0.3) : VOID[1]);
      } else if (d <= sunR + 1.2) {
        const v = up * lean;
        L0.px(x, y, v > 0.6 ? lamp[5] : v > 0.35 ? lamp[4] : v > 0.15 ? lamp[3] : lamp[2]);
      } else if (d <= sunR + 3) {
        const v = up * lean * (1 - (d - sunR - 1.2) / 1.8);
        if (v > bayer(x, y) * 0.8) L0.px(x, y, v > 0.45 ? lamp[3] : lamp[2]);
      }
    }
  }
  // a small second moon
  {
    const mx = sunX > 210 ? 56 + rnd() * 50 : 236 + rnd() * 50;
    const my = 26 + rnd() * 18;
    L0.disc(mx, my, 5, (x, y) => (x - mx + (y - my) * 0.3 < -1.8 ? bone[2] : VOID[2]));
    L0.px(mx - 4, my - 1, bone[3]);
  }

  // ---- L1: far mountains (backlit, hazy) and a nearer, darker range ----
  const L1 = new Buf(W, H);
  const ranges = [
    {
      base: horizon - 2,
      amp: 52,
      sc: 30,
      seed: s + 11,
      body: [mix(VOID[1], VOID[2], 0.7), mix(VOID[2], umbra[1], 0.12)],
      rim: mix(lamp[2], VOID[2], 0.35),
      rimK: 1,
    },
    {
      base: horizon + 4,
      amp: 22,
      sc: 18,
      seed: s + 12,
      body: [VOID[1], mix(VOID[1], VOID[2], 0.4)],
      rim: mix(lamp[1], VOID[1], 0.3),
      rimK: 0.6,
    },
  ];
  for (const r of ranges) {
    const tops = new Float32Array(W + 1);
    for (let x = 0; x <= W; x++)
      tops[x] = r.base - ridged1(x / r.sc, r.seed) * r.amp - fbm1(x / 7, r.seed + 3) * 3;
    for (let x = 0; x < W; x++) {
      const top = Math.round(tops[x] as number);
      const slopeR = (tops[x + 1] as number) - (tops[x] as number); // >0: descending right
      const facesSun = x < sunX ? slopeR > 0.15 : slopeR < -0.15;
      // rim light only where the ridge is seen against the glowing corona, not the disc
      const behindDisc = Math.hypot(x - sunX, top - 2 - sunY) <= sunR + 1;
      const lit = behindDisc ? 0 : sunLit(x, top) * r.rimK;
      for (let y = top; y < GY + 6; y++) {
        const strata = fbm(x / 10 + y / 20, y / 3, r.seed, 2);
        let c = strata > 0.6 ? (r.body[0] as string) : (r.body[1] as string);
        if (y - top < 2 && lit > 0.2 && (facesSun || y === top)) {
          c = y === top && lit > 0.35 ? r.rim : mixc(r.rim, c, 0.55);
        } else if (y === top) c = mixc(c, VOID[3], 0.3);
        // backlit falloff: darker toward the base
        if ((y - top) / 50 > bayer(x, y) + 0.4) c = r.body[0] as string;
        L1.px(x, y, c);
      }
    }
  }

  // ---- L2: ruined old-world towers, antenna mast, broken dish ----
  const L2 = new Buf(W, H);
  const ruin = mix(VOID[0], rock[0], 0.5);
  const ruinLo = VOID[0];
  const ruinHi = mix(VOID[1], rock[1], 0.6);
  const rimC = mix(lamp[1], ruinHi, 0.35);
  const rimAt = (x: number, y: number) => (sunLit(x, y) > 0.3 ? rimC : ruinHi);
  const tower = (x: number, w: number, h: number, broken: number) => {
    const top = GY + 2 - h;
    const tops: number[] = [];
    for (let i = 0; i < w; i++) {
      const jag = Math.max(0, fbm1((x + i) / 2.5, s + x) - 0.4) * broken * 3;
      tops.push(Math.round(top + jag + Math.max(0, i - w * 0.5) * broken * 0.2));
    }
    for (let i = 0; i < w; i++) {
      const xx = x + i;
      const bt = tops[i] as number;
      for (let y = bt; y < GY + 4; y++) {
        let c = ruin;
        const fy = (y - top) % 10;
        if (fy === 0) c = ruinLo;
        else if (fy >= 3 && fy <= 6 && i % 5 >= 1 && i % 5 <= 2 && i > 0 && i < w - 1) {
          c = hash(Math.floor((y - top) / 10), Math.floor(i / 5), x) > 0.25 ? ruinLo : ruin;
        }
        if (y === bt) c = ruinHi;
        if (i === (x < sunX ? w - 1 : 0) && y - bt < 26 && (y - bt) / 26 < 1 - bayer(xx, y) * 0.6)
          c = rimAt(xx, y);
        L2.px(xx, y, c);
      }
    }
    // exposed girders poking out of the broken top
    for (let g = 0; g < 2; g++) {
      const i = Math.floor(rnd() * w);
      const bt = tops[i] as number;
      const len = 4 + Math.floor(rnd() * 8);
      const dir = rnd() < 0.5 ? -1 : 1;
      L2.line(x + i, bt, x + i + dir * Math.floor(len * 0.5), bt - len, ruin);
    }
  };
  const tx = 16 + Math.floor(rnd() * 26);
  tower(tx, 22, 74 + rnd() * 16, 8);
  // one window still holds a weak amber light
  {
    const wy = GY - 30 - Math.floor(rnd() * 3) * 10;
    L2.rect(tx + 6, wy, 2, 3, lamp[1]);
    L2.px(tx + 6, wy, lamp[2]);
    L2.glow(tx + 7, wy + 1, 6, lamp[2], 0.25);
  }
  tower(tx + 25, 13, 46 + rnd() * 10, 4);
  tower(tx + 41, 9, 28 + rnd() * 8, 3);
  const rtx = W - 54 - Math.floor(rnd() * 18);
  tower(rtx, 18, 54 + rnd() * 12, 10);
  tower(rtx + 20, 10, 30 + rnd() * 8, 4);
  // lattice antenna mast with a dying red beacon
  {
    const mx = 118 + Math.floor(rnd() * 40);
    const mTop = 24 + Math.floor(rnd() * 10);
    for (let y = mTop; y < GY + 3; y++) {
      const hw = Math.round(1 + ((y - mTop) / (GY - mTop)) * 7);
      L2.px(mx - hw, y, ruin);
      L2.px(mx + hw, y, mx < sunX && sunLit(mx, y) > 0.3 ? rimC : ruin);
      if ((y - mTop) % 8 === 0) L2.line(mx - hw, y, mx + hw, y, ruin);
    }
    for (let y = mTop; y < GY - 6; y += 8) {
      const hw = 1 + ((y - mTop) / (GY - mTop)) * 7;
      const hw2 = 1 + ((y + 8 - mTop) / (GY - mTop)) * 7;
      L2.line(mx - hw, y, mx + hw2, y + 8, ruin);
    }
    L2.line(mx, mTop, mx, mTop - 12, ruin);
    L2.line(mx - 6, mTop - 4, mx + 6, mTop - 7, ruin);
    L2.line(mx - 3, mTop - 9, mx + 3, mTop - 10, ruin);
    L2.glowNow(mx, mTop - 13, 9, rust[3], 0.7);
    L2.px(mx, mTop - 13, rust[5]);
    catenary(L2, mx - 4, mTop + 16, tx + 21, GY - 66, 9, ruin);
  }
  // broken dish on a pylon
  {
    const dx = sunX > 215 ? 92 + Math.floor(rnd() * 14) : 236 + Math.floor(rnd() * 14);
    const dy = GY - 24;
    L2.rect(dx - 2, dy, 5, GY + 3 - dy, ruin);
    L2.rect(dx - 5, GY - 2, 11, 5, ruin);
    // tilted bowl: thick ellipse arc
    for (let a = 0; a < Math.PI; a += 0.02) {
      for (let t = 0; t < 4; t++) {
        const rx = 15 - t * 0.5;
        const ry = 6 - t * 0.3;
        const ex = Math.cos(a) * rx;
        const ey = Math.sin(a) * ry;
        const x = dx + ex * 0.86 - ey * 0.5;
        const y = dy - 10 + ex * 0.5 + ey * 0.86;
        L2.px(x, y, t === 0 ? rimAt(Math.round(x), Math.round(y)) : ruin);
      }
    }
    L2.line(dx, dy - 10, dx - 4, dy - 22, ruin);
    L2.px(dx - 4, dy - 23, ruinHi);
  }
  // ash haze settling over the ruin bases (stepped bands, not noise)
  for (let y = GY - 16; y < GY + 4; y++) {
    const t = (y - (GY - 16)) / 20;
    const hc = mix(ruin, mix(VOID[2], rock[1], 0.5), (Math.floor(t * 4) / 4) * 0.7);
    for (let x = 0; x < W; x++) if (L2.has(x, y)) L2.px(x, y, hc);
  }

  // ---- L3: ash plain ----
  const L3 = new Buf(W, H);
  const aT = [
    VOID[0],
    rock[0],
    mix(rock[0], rock[1], 0.6),
    mix(rock[1], umbra[0], 0.25),
    rock[1],
    mix(rock[2], leather[0], 0.3),
  ];
  for (let x = 0; x < W; x++) {
    const top = GY + Math.round((fbm1(x / 40, s + 31) - 0.5) * 4);
    const glint = sunLit(x, horizon);
    for (let y = top; y < H; y++) {
      const depth = (y - top) / (H - top);
      const dune = Math.sin(x / 21 + y * 0.8 + fbm(x / 50, y / 8, s + 32, 2) * 6);
      const v = 0.82 - depth * 0.7 + dune * 0.05 + glint * 0.18 * clamp(1 - depth * 3, 0, 1);
      let c = tone(aT, clamp(v, 0, 0.999), x, y, 0.55);
      if (y === top) c = glint > 0.5 ? mixc(lamp[1], rock[2], 0.6) : rock[2];
      L3.px(x, y, c);
    }
  }
  {
    const gx = 50 + Math.floor(rnd() * 180);
    L3.poly(
      [
        [gx, GY + 3],
        [gx + 36, GY - 8],
        [gx + 38, GY - 5],
        [gx + 4, GY + 5],
      ],
      (x, y) => (y + x * 0.3 < GY + gx * 0.3 + 5 ? rock[2] : rock[0]),
    );
    for (let i = 0; i < 4; i++) L3.px(gx + 9 + i * 7, GY - i * 2.2 + 1, VOID[0]);
  }
  for (let i = 0; i < 9; i++) {
    const rx = Math.floor(rnd() * W);
    const rr = 1.5 + rnd() * 3.5;
    L3.disc(rx, GY + 2, rr, (x, y) => (y > GY + 2 ? null : x < rx ? rock[2] : rock[0]));
  }
  for (let i = 0; i < 16; i++) {
    const x = Math.floor(rnd() * W);
    const y = GY + 14 + Math.floor(rnd() * 28);
    L3.px(x, y, rock[2]);
    L3.px(x + 1, y, rock[1]);
  }

  // ---- L4: foreground rocks, a twisted girder and drifting ash ----
  const L4 = new Buf(FRONT_W, H);
  for (let x = 0; x < FRONT_W; x++) {
    const side = Math.min(x - 30, FRONT_W - 30 - x);
    if (side > 80) continue;
    const k = 1 - Math.max(0, side) / 80;
    const top = H - 2 - k ** 1.6 * 28 - ridged1(x / 11, s + 41) * 8 * k;
    for (let y = Math.floor(top); y < H; y++) {
      const edge = y === Math.floor(top);
      L4.px(x, y, edge ? (x < FRONT_W / 2 ? rock[0] : mix(lamp[0], rock[0], 0.5)) : INK);
    }
  }
  {
    // girder: two flanges with lightening holes, snapped at the end
    const x0 = FRONT_W - 84;
    const y0 = H - 12;
    for (let i = 0; i < 34; i++) {
      const x = x0 + i;
      const y = y0 - i * 0.5;
      for (let j = -2; j <= 2; j++) {
        const hole = Math.abs(j) <= 0 && i % 8 >= 3 && i % 8 <= 5;
        if (hole) continue;
        L4.px(x, y + j, j === -2 ? rock[1] : INK);
      }
    }
  }
  for (let i = 0; i < 36; i++)
    L4.px(30 + rnd() * 340, rnd() * (H - 30), bone[2], 0.12 + rnd() * 0.25);

  return { layers: [L0.canvas(), L1.canvas(), L2.canvas(), L3.canvas(), L4.canvas()] };
}

// ---------------------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------------------

const backdropCache = new Map<string, Backdrop>();

/** Parallax battle backdrop: layers back -> front (last layer is 400 wide, center it). */
export function drawBackdrop(biome: Biome, seed: number): Backdrop {
  const key = `${biome}:${seed}`;
  const hit = backdropCache.get(key);
  if (hit) return hit;
  const bd =
    biome === "duskMines"
      ? duskMines(seed)
      : biome === "crystalHollows"
        ? crystalHollows(seed)
        : ashenSurface(seed);
  // Odd seeds of the cave biomes mirror the layout for extra variety.
  if (biome !== "ashenSurface" && (seed & 1) === 1) bd.layers = bd.layers.map(flipCanvas);
  backdropCache.set(key, bd);
  return bd;
}

/** Expedition map / title backdrop: stars, a vast dim ringed gas giant, the moon's horizon. */
export function drawMapBackdrop(seed: number): HTMLCanvasElement {
  const rnd = artRng(seed * 9973 + 5);
  const s = (seed * 211 + 3) | 0;
  const b = new Buf(W, H);
  vgrad(b, 0, 0, W, H, [VOID[0], VOID[0], VOID[1], mix(VOID[1], VOID[2], 0.5)]);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const n = fbm(x / 70, y / 34, s + 1, 4);
      const v = (n - 0.56) * 4;
      if (v > bayer(x, y))
        b.px(x, y, v > 0.7 ? mixc(VOID[2], umbra[1], 0.4) : mixc(VOID[1], VOID[2], 0.6));
    }
  }
  stars(b, rnd, 340, H);

  const px = 236;
  const py = 54;
  const pr = 92;
  const tilt = -0.28;
  const ringA = 150;
  const ringB = 26;
  const ct = Math.cos(tilt);
  const st = Math.sin(tilt);
  // ring-plane coords; ringE > 0 means the near (front) half
  const ringE = (x: number, y: number) => {
    const dx = x - px;
    const dy = y - py;
    const rx = dx * ct + dy * st;
    const ry = -dx * st + dy * ct;
    const e = Math.hypot(rx / ringA, ry / ringB);
    return ry > 0 ? e : -e;
  };
  const ringLit = (x: number, y: number) => -((x - px) * ct + (y - py) * st) / ringA;
  const ringColor = (e: number, lit: number): string | null => {
    if (e < 0.7 || e > 1) return null;
    if (e > 0.8 && e < 0.835) return null; // gap
    const base = e < 0.8 ? bone[0] : e < 0.93 ? bone[1] : mix(bone[0], VOID[2], 0.5);
    return lit > 0.2 ? mixc(base, lamp[1], 0.25) : lit < -0.4 ? mixc(base, VOID[1], 0.5) : base;
  };
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const e = ringE(x, y);
      if (e > 0 || e < -1) continue;
      const c = ringColor(-e, ringLit(x, y));
      if (c) b.px(x, y, mixc(c, VOID[1], 0.45));
    }
  }
  const pTones = [
    VOID[0],
    VOID[1],
    mix(VOID[1], umbra[0], 0.6),
    mix(umbra[1], rust[0], 0.4),
    mix(rust[1], umbra[1], 0.5),
    mix(rust[1], lamp[1], 0.45),
  ];
  for (let y = Math.max(0, py - pr); y < Math.min(H, py + pr); y++) {
    for (let x = Math.max(0, px - pr); x < Math.min(W, px + pr); x++) {
      const dx = (x - px) / pr;
      const dy = (y - py) / pr;
      const d2 = dx * dx + dy * dy;
      if (d2 > 1) continue;
      const nz = Math.sqrt(1 - d2);
      const lam = clamp(-dx * 0.75 - dy * 0.35 + nz * 0.2, 0, 1);
      const lat = dy + Math.sin(dx * 3 + fbm(x / 30, y / 6, s + 7, 2) * 3) * 0.03;
      const band = Math.sin(lat * 24) * 0.5 + 0.5;
      let v = lam * (0.7 + band * 0.35);
      if (d2 > 0.95) v = v * 0.6 + 0.12; // faint atmospheric limb on the night side
      b.px(x, y, tone(pTones, clamp(v, 0, 0.999), x, y, 0.8));
    }
  }
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const e = ringE(x, y);
      if (e < 0.6 || e > 1) continue;
      const c = ringColor(e, ringLit(x, y));
      if (c) b.px(x, y, c);
      // ring shadow cast on the planet just above the front arc
      else if (e < 0.7) {
        const dx = x - px;
        const dy = y - py;
        if (dx * dx + dy * dy < pr * pr && 0.5 > bayer(x, y)) b.px(x, y, VOID[0]);
      }
    }
  }

  // the dark moon's surface: a long curved horizon with craters
  const cx = 150;
  const cy = H + 640;
  const cr = 668;
  const sTones = [INK, VOID[0], rock[0], mix(rock[0], rock[1], 0.6), rock[1]];
  const surfTop = (x: number) => Math.ceil(cy - Math.sqrt(cr * cr - (x - cx) * (x - cx)));
  for (let x = 0; x < W; x++) {
    const top = surfTop(x);
    for (let y = Math.max(0, top); y < H; y++) {
      const depth = (y - top) / 30;
      const n = fbm(x / 26, y / 5, s + 21, 3);
      let c = tone(sTones, clamp(0.8 - depth * 0.6 + (n - 0.5) * 0.35, 0, 0.999), x, y, 0.6);
      if (y === top) c = mix(lamp[1], rock[2], 0.35 + (x / W) * 0.4);
      else if (y === top + 1) c = rock[1];
      b.px(x, y, c);
    }
  }
  for (let i = 0; i < 8; i++) {
    const x = 10 + rnd() * (W - 20);
    const top = surfTop(Math.floor(x));
    const y = top + 5 + rnd() * (H - top - 8);
    const rx = 3 + rnd() * 7 * clamp((y - top) / 20, 0.4, 1.4);
    const ry = Math.max(1.2, rx * 0.3);
    for (let yy = Math.floor(y - ry); yy <= y + ry; yy++) {
      for (let xx = Math.floor(x - rx); xx <= x + rx; xx++) {
        const e = ((xx - x) / rx) ** 2 + ((yy - y) / ry) ** 2;
        if (e > 1) continue;
        b.px(xx, yy, e > 0.55 ? (yy < y ? VOID[0] : rock[2]) : rock[0]);
      }
    }
  }
  b.glow(cx - 140, surfTop(10), 70, lamp[2], 0.08);
  return b.canvas();
}
