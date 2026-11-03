/**
 * Procedural pixel-art mercenaries for Radiance.
 *
 * Every merc is assembled at runtime from a small skeleton ("rig") per discipline and pose:
 * limbs are rasterised as capsules and shaded with a directional key light (upper-left),
 * heads / hair / headgear are hand-authored templates, weapons are hand-authored templates
 * rotated around their grip. A warm amber rim light on the front edge ties every sprite to
 * the game's "light is precious" theme. Output is deterministic: same look + pose -> same pixels.
 *
 * The first section is a tiny sprite kit (Spr / Mask / shade ...) that enemies.ts reuses.
 */
import { HAIR, INK, RAMPS, RARITY_COLORS, type Ramp, SKIN, TINTS } from "./palette";
import { Pix } from "./pixel";

// ============================================================================================
// Sprite kit (internal; shared with enemies.ts)
// ============================================================================================

export type P = readonly [number, number];

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

/** Safe ramp lookup (clamped index). */
export function tone(r: Ramp, i: number): string {
  return r[clamp(Math.round(i), 0, r.length - 1)] ?? INK;
}

const packCache = new Map<string, number>();
/** "#rrggbb" -> packed little-endian RGBA (as stored in ImageData's Uint32 view). */
export function pk(hex: string): number {
  let v = packCache.get(hex);
  if (v === undefined) {
    const n = Number.parseInt(hex.slice(1, 7), 16);
    v = ((255 << 24) | ((n & 255) << 16) | (n & 0xff00) | ((n >> 16) & 255)) >>> 0;
    packCache.set(hex, v);
  }
  return v;
}

function mixPk(a: number, b: number, t: number): number {
  const ar = a & 255;
  const ag = (a >>> 8) & 255;
  const ab = (a >>> 16) & 255;
  const r = Math.round(ar + ((b & 255) - ar) * t);
  const g = Math.round(ag + (((b >>> 8) & 255) - ag) * t);
  const bl = Math.round(ab + (((b >>> 16) & 255) - ab) * t);
  return ((255 << 24) | (bl << 16) | (g << 8) | r) >>> 0;
}

/** Key light direction for the current draw: -1 = from the left (default), +1 = from the right. */
let LIGHT = -1;
export function withLight<T>(dir: number, fn: () => T): T {
  const prev = LIGHT;
  LIGHT = dir;
  try {
    return fn();
  } finally {
    LIGHT = prev;
  }
}

/** In-memory RGBA sprite buffer; converted to a canvas (Pix) once at the end. */
export class Spr {
  readonly data: Uint32Array;
  constructor(
    readonly w: number,
    readonly h: number,
  ) {
    this.data = new Uint32Array(w * h);
  }
  inside(x: number, y: number): boolean {
    return x >= 0 && y >= 0 && x < this.w && y < this.h;
  }
  get(x: number, y: number): number {
    if (!this.inside(x, y)) return 0;
    return this.data[y * this.w + x] ?? 0;
  }
  has(x: number, y: number): boolean {
    return this.get(x, y) !== 0;
  }
  setN(x: number, y: number, n: number): this {
    x = Math.round(x);
    y = Math.round(y);
    if (this.inside(x, y)) this.data[y * this.w + x] = n;
    return this;
  }
  set(x: number, y: number, hex: string | undefined): this {
    if (!hex) return this;
    return this.setN(x, y, pk(hex));
  }
  /** Blend an existing opaque pixel toward `hex` by t. */
  blend(x: number, y: number, hex: string, t: number): this {
    const c = this.get(Math.round(x), Math.round(y));
    if (c) this.setN(x, y, mixPk(c, pk(hex), t));
    return this;
  }
  rect(x: number, y: number, w: number, h: number, hex: string): this {
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) this.set(x + i, y + j, hex);
    return this;
  }
  hline(x0: number, x1: number, y: number, hex: string): this {
    for (let x = Math.min(x0, x1); x <= Math.max(x0, x1); x++) this.set(x, y, hex);
    return this;
  }
  vline(x: number, y0: number, y1: number, hex: string): this {
    for (let y = Math.min(y0, y1); y <= Math.max(y0, y1); y++) this.set(x, y, hex);
    return this;
  }
  line(x0: number, y0: number, x1: number, y1: number, hex: string): this {
    for (const [x, y] of linePts(x0, y0, x1, y1)) this.set(x, y, hex);
    return this;
  }
  /** Paint a char-grid template. `map` maps chars to colors; unknown chars / "." are skipped. */
  tpl(x: number, y: number, rows: readonly string[], map: Record<string, string>, flip = false) {
    for (let j = 0; j < rows.length; j++) {
      const row = rows[j] ?? "";
      for (let i = 0; i < row.length; i++) {
        const c = map[row.charAt(i)];
        if (c) this.set(flip ? x + row.length - 1 - i : x + i, y + j, c);
      }
    }
    return this;
  }
  stamp(src: Spr, ox: number, oy: number): this {
    for (let y = 0; y < src.h; y++)
      for (let x = 0; x < src.w; x++) {
        const c = src.data[y * src.w + x] ?? 0;
        if (c) this.setN(x + ox, y + oy, c);
      }
    return this;
  }
  flipped(): Spr {
    const o = new Spr(this.w, this.h);
    for (let y = 0; y < this.h; y++)
      for (let x = 0; x < this.w; x++)
        o.data[y * this.w + (this.w - 1 - x)] = this.data[y * this.w + x] ?? 0;
    return o;
  }
  bbox(): { x0: number; y0: number; x1: number; y1: number } {
    let x0 = this.w;
    let y0 = this.h;
    let x1 = -1;
    let y1 = -1;
    for (let y = 0; y < this.h; y++)
      for (let x = 0; x < this.w; x++)
        if (this.data[y * this.w + x]) {
          if (x < x0) x0 = x;
          if (x > x1) x1 = x;
          if (y < y0) y0 = y;
          if (y > y1) y1 = y;
        }
    return { x0, y0, x1, y1 };
  }
  toPix(): Pix {
    const p = new Pix(this.w, this.h);
    const img = p.ctx.createImageData(this.w, this.h);
    new Uint32Array(img.data.buffer).set(this.data);
    p.ctx.putImageData(img, 0, 0);
    return p;
  }
}

export function linePts(x0: number, y0: number, x1: number, y1: number): P[] {
  const out: P[] = [];
  let x = Math.round(x0);
  let y = Math.round(y0);
  const ex = Math.round(x1);
  const ey = Math.round(y1);
  const dx = Math.abs(ex - x);
  const dy = -Math.abs(ey - y);
  const sx = x < ex ? 1 : -1;
  const sy = y < ey ? 1 : -1;
  let err = dx + dy;
  for (let guard = 0; guard < 512; guard++) {
    out.push([x, y]);
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
  return out;
}

/** Binary coverage mask used to build a shape before shading it. */
export class Mask {
  readonly data: Uint8Array;
  x0 = 1e9;
  y0 = 1e9;
  x1 = -1e9;
  y1 = -1e9;
  constructor(
    readonly w: number,
    readonly h: number,
  ) {
    this.data = new Uint8Array(w * h);
  }
  add(x: number, y: number): this {
    x = Math.round(x);
    y = Math.round(y);
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return this;
    this.data[y * this.w + x] = 1;
    if (x < this.x0) this.x0 = x;
    if (x > this.x1) this.x1 = x;
    if (y < this.y0) this.y0 = y;
    if (y > this.y1) this.y1 = y;
    return this;
  }
  del(x: number, y: number): this {
    if (x >= 0 && y >= 0 && x < this.w && y < this.h) this.data[y * this.w + x] = 0;
    return this;
  }
  has(x: number, y: number): boolean {
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return false;
    return this.data[y * this.w + x] === 1;
  }
  empty(): boolean {
    return this.x1 < this.x0;
  }
  rect(x: number, y: number, w: number, h: number): this {
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) this.add(x + i, y + j);
    return this;
  }
  span(y: number, xa: number, xb: number): this {
    for (let x = Math.round(Math.min(xa, xb)); x <= Math.round(Math.max(xa, xb)); x++)
      this.add(x, y);
    return this;
  }
  ellipse(cx: number, cy: number, rx: number, ry: number): this {
    const ix = Math.ceil(rx) + 1;
    const iy = Math.ceil(ry) + 1;
    for (let y = -iy; y <= iy; y++)
      for (let x = -ix; x <= ix; x++) {
        const px = Math.round(cx) + x;
        const py = Math.round(cy) + y;
        const dx = px - cx;
        const dy = py - cy;
        if ((dx * dx) / (rx * rx + 0.3) + (dy * dy) / (ry * ry + 0.3) <= 1) this.add(px, py);
      }
    return this;
  }
  disc(cx: number, cy: number, r: number): this {
    return this.ellipse(cx, cy, r, r);
  }
  /** Tapered capsule from (ax,ay) radius ra to (bx,by) radius rb. */
  capsule(ax: number, ay: number, bx: number, by: number, ra: number, rb = ra): this {
    const r = Math.max(ra, rb);
    const minX = Math.floor(Math.min(ax, bx) - r - 1);
    const maxX = Math.ceil(Math.max(ax, bx) + r + 1);
    const minY = Math.floor(Math.min(ay, by) - r - 1);
    const maxY = Math.ceil(Math.max(ay, by) + r + 1);
    const vx = bx - ax;
    const vy = by - ay;
    const len2 = vx * vx + vy * vy || 1;
    for (let y = minY; y <= maxY; y++)
      for (let x = minX; x <= maxX; x++) {
        const t = clamp(((x - ax) * vx + (y - ay) * vy) / len2, 0, 1);
        const dx = x - (ax + vx * t);
        const dy = y - (ay + vy * t);
        const rr = ra + (rb - ra) * t;
        if (dx * dx + dy * dy <= rr * rr + 0.15) this.add(x, y);
      }
    return this;
  }
  /** Chain of capsules through points with per-point radii. */
  chain(pts: readonly P[], radii: readonly number[]): this {
    for (let i = 0; i + 1 < pts.length; i++) {
      const a = pts[i] as P;
      const b = pts[i + 1] as P;
      this.capsule(a[0], a[1], b[0], b[1], radii[i] ?? 1, radii[i + 1] ?? radii[i] ?? 1);
    }
    return this;
  }
  poly(points: readonly P[]): this {
    if (points.length < 3) return this;
    const ys = points.map((p) => p[1]);
    const minY = Math.floor(Math.min(...ys));
    const maxY = Math.ceil(Math.max(...ys));
    for (let y = minY; y <= maxY; y++) {
      const xs: number[] = [];
      const yc = y + 0.5;
      for (let i = 0; i < points.length; i++) {
        const [ax, ay] = points[i] as P;
        const [bx, by] = points[(i + 1) % points.length] as P;
        if ((ay <= yc && by > yc) || (by <= yc && ay > yc))
          xs.push(ax + ((yc - ay) / (by - ay)) * (bx - ax));
      }
      xs.sort((a, b) => a - b);
      for (let i = 0; i + 1 < xs.length; i += 2) {
        const xa = Math.round(xs[i] as number);
        const xb = Math.round(xs[i + 1] as number) - 1;
        for (let x = xa; x <= xb; x++) this.add(x, y);
      }
    }
    return this;
  }
  sub(o: Mask): this {
    for (let i = 0; i < this.data.length; i++) if (o.data[i]) this.data[i] = 0;
    return this;
  }
  each(fn: (x: number, y: number) => void): void {
    for (let y = Math.max(0, this.y0); y <= Math.min(this.h - 1, this.y1); y++)
      for (let x = Math.max(0, this.x0); x <= Math.min(this.w - 1, this.x1); x++)
        if (this.data[y * this.w + x]) fn(x, y);
  }
}

export interface ShadeOpts {
  /** Tone offset (+ brighter, - darker). */
  bias?: number;
  /** Horizontal vs vertical weight of the light (0..1). */
  kx?: number;
  /** Where across the form the highlight peaks (0 = lit edge). */
  peak?: number;
}

/**
 * Directional form shading: each pixel's tone comes from its position inside the horizontal
 * and vertical runs of the mask, lit from the current key-light side and from above.
 */
export function shade(s: Spr, m: Mask, tones: readonly string[], o: ShadeOpts = {}): void {
  const n = tones.length;
  const bias = o.bias ?? 0;
  const kx = o.kx ?? 0.6;
  const ky = 1 - kx;
  const peak = o.peak ?? 0.28;
  // Precompute horizontal / vertical run extents once (keeps big masks fast).
  const bw = m.x1 - m.x0 + 1;
  const bh = m.y1 - m.y0 + 1;
  if (bw <= 0 || bh <= 0) return;
  const runL = new Int16Array(bw * bh);
  const runR = new Int16Array(bw * bh);
  const runT = new Int16Array(bw * bh);
  const runB = new Int16Array(bw * bh);
  for (let y = m.y0; y <= m.y1; y++) {
    let start = -1;
    for (let x = m.x0; x <= m.x1 + 1; x++) {
      const on = x <= m.x1 && m.has(x, y);
      if (on && start < 0) start = x;
      if (!on && start >= 0) {
        for (let i = start; i < x; i++) {
          const k = (y - m.y0) * bw + (i - m.x0);
          runL[k] = start;
          runR[k] = x - 1;
        }
        start = -1;
      }
    }
  }
  for (let x = m.x0; x <= m.x1; x++) {
    let start = -1;
    for (let y = m.y0; y <= m.y1 + 1; y++) {
      const on = y <= m.y1 && m.has(x, y);
      if (on && start < 0) start = y;
      if (!on && start >= 0) {
        for (let j = start; j < y; j++) {
          const k = (j - m.y0) * bw + (x - m.x0);
          runT[k] = start;
          runB[k] = y - 1;
        }
        start = -1;
      }
    }
  }
  m.each((x, y) => {
    const k = (y - m.y0) * bw + (x - m.x0);
    const L = runL[k] ?? x;
    const R = runR[k] ?? x;
    const T = runT[k] ?? y;
    const B = runB[k] ?? y;
    let tx = (x - L + 0.5) / (R - L + 1);
    if (LIGHT > 0) tx = 1 - tx;
    const lx = 1 - Math.abs(tx - peak) * 1.35;
    const ty = (y - T + 0.5) / (B - T + 1);
    const v = kx * lx + ky * (1 - ty);
    s.set(x, y, tones[clamp(Math.floor(v * n + bias), 0, n - 1)]);
  });
}

/** Fill mask with a flat color. */
export function fill(s: Spr, m: Mask, hex: string): void {
  m.each((x, y) => s.set(x, y, hex));
}

/** Darken already-painted pixels just outside the mask on the shadow side (fakes overlap). */
export function contactShadow(s: Spr, m: Mask, t = 0.45, color = INK): void {
  const sd = -LIGHT;
  const hit = new Uint8Array(s.w * s.h);
  m.each((x, y) => {
    const cand: P[] = [
      [x + sd, y],
      [x, y + 1],
      [x + sd, y + 1],
    ];
    for (const [cx, cy] of cand) {
      if (m.has(cx, cy) || !s.has(cx, cy)) continue;
      const i = cy * s.w + cx;
      if (hit[i]) continue;
      hit[i] = 1;
      s.blend(cx, cy, color, t);
    }
  });
}

/** Rim light: tint opaque pixels whose neighbour on `side` is empty. */
export function rim(s: Spr, side: number, hex: string, t: number, y0 = 0, y1 = s.h - 1): void {
  const snap = s.data.slice();
  const opaque = (x: number, y: number) =>
    x >= 0 && y >= 0 && x < s.w && y < s.h && (snap[y * s.w + x] ?? 0) !== 0;
  for (let y = Math.max(0, y0); y <= Math.min(s.h - 1, y1); y++)
    for (let x = 0; x < s.w; x++)
      if (opaque(x, y) && !opaque(x + side, y)) {
        s.blend(x, y, hex, t);
        if (opaque(x - side, y) && opaque(x - 2 * side, y)) s.blend(x - side, y, hex, t * 0.35);
      }
}

/** Build a small sprite from a char template. */
export function tplSpr(rows: readonly string[], map: Record<string, string>): Spr {
  const w = Math.max(...rows.map((r) => r.length));
  const s = new Spr(w, rows.length);
  s.tpl(0, 0, rows, map);
  return s;
}

/** Map a point in a rotated template (pivot at px,py) to screen coordinates. */
export function rotPt(
  px: number,
  py: number,
  angleDeg: number,
  ox: number,
  oy: number,
  pt: P,
  flipV = false,
): P {
  const a = (angleDeg * Math.PI) / 180;
  const c = Math.cos(a);
  const s = Math.sin(a);
  const u = pt[0] - px;
  const v = (pt[1] - py) * (flipV ? -1 : 1);
  return [Math.round(ox + u * c - v * s), Math.round(oy + u * s + v * c)];
}

/**
 * Draw `src` rotated by angleDeg (0 = as authored, pointing right; positive = clockwise) with
 * its pivot (px,py) placed at (ox,oy). Nearest-neighbour inverse mapping.
 * flipV mirrors the template across its long axis (auto when pointing left, so the lit
 * edge stays on top). Returns the mask of drawn pixels.
 */
export function blitRot(
  dst: Spr,
  src: Spr,
  px: number,
  py: number,
  angleDeg: number,
  ox: number,
  oy: number,
  flipV?: boolean,
): Mask {
  const a = (angleDeg * Math.PI) / 180;
  const c = Math.cos(a);
  const s = Math.sin(a);
  const fv = flipV ?? c < -0.2;
  const m = new Mask(dst.w, dst.h);
  const R = Math.ceil(Math.hypot(Math.max(px, src.w - px), Math.max(py, src.h - py))) + 1;
  for (let dy = -R; dy <= R; dy++)
    for (let dx = -R; dx <= R; dx++) {
      const u = dx * c + dy * s;
      let v = -dx * s + dy * c;
      if (fv) v = -v;
      const sx = Math.round(px + u + 1e-6);
      const sy = Math.round(py + v + 1e-6);
      const col = src.get(sx, sy);
      if (!col) continue;
      const X = ox + dx;
      const Y = oy + dy;
      if (!dst.inside(X, Y)) continue;
      dst.setN(X, Y, col);
      m.add(X, Y);
    }
  return m;
}

/** Scale2x (EPX) upscale – keeps diagonals crisp; used for portraits. */
export function scale2x(src: Spr): Spr {
  const o = new Spr(src.w * 2, src.h * 2);
  for (let y = 0; y < src.h; y++)
    for (let x = 0; x < src.w; x++) {
      const p = src.get(x, y);
      const A = y > 0 ? src.get(x, y - 1) : p;
      const B = x < src.w - 1 ? src.get(x + 1, y) : p;
      const C = x > 0 ? src.get(x - 1, y) : p;
      const D = y < src.h - 1 ? src.get(x, y + 1) : p;
      const e0 = C === A && C !== D && A !== B ? A : p;
      const e1 = A === B && A !== C && B !== D ? B : p;
      const e2 = D === C && D !== B && C !== A ? C : p;
      const e3 = B === D && B !== A && D !== C ? D : p;
      o.setN(x * 2, y * 2, e0);
      o.setN(x * 2 + 1, y * 2, e1);
      o.setN(x * 2, y * 2 + 1, e2);
      o.setN(x * 2 + 1, y * 2 + 1, e3);
    }
  return o;
}

export interface Glow {
  x: number;
  y: number;
  r: number;
  color: string;
  strength: number;
}

/** Outline with INK, lift outline segments on the key-lit top-left a touch, then add glows. */
export function finish(s: Spr, glows: readonly Glow[], selout = true): HTMLCanvasElement {
  const p = s.toPix();
  p.outline(INK);
  if (selout) {
    // Selective outline: outline pixels whose sprite neighbour is below-right (i.e. the lit,
    // upper-left silhouette edge) become a deep indigo instead of pure ink.
    const img = p.ctx.getImageData(0, 0, s.w, s.h);
    const d = new Uint32Array(img.data.buffer);
    const ink = pk(INK);
    const soft = pk(RAMPS.void[2]);
    const sd = -LIGHT;
    for (let y = 0; y < s.h; y++)
      for (let x = 0; x < s.w; x++) {
        const i = y * s.w + x;
        if (d[i] !== ink || s.has(x, y)) continue;
        const litEdge =
          (s.has(x + sd, y) && !s.has(x - sd, y) && s.has(x + sd, y + 1)) ||
          (s.has(x, y + 1) && !s.has(x, y - 1) && s.has(x + sd, y + 1));
        if (litEdge) d[i] = soft;
      }
    p.ctx.putImageData(img, 0, 0);
  }
  for (const g of glows) p.glow(g.x, g.y, g.r, g.color, g.strength);
  return p.canvas;
}

/** Arc of pixels (motion smear). Angles in degrees, clockwise from +x. */
export function arcPts(cx: number, cy: number, r: number, a0: number, a1: number): P[] {
  const out: P[] = [];
  const steps = Math.max(6, Math.ceil((Math.abs(a1 - a0) * Math.PI * r) / 180) * 2);
  let last = "";
  for (let i = 0; i <= steps; i++) {
    const a = ((a0 + ((a1 - a0) * i) / steps) * Math.PI) / 180;
    const p: P = [Math.round(cx + Math.cos(a) * r), Math.round(cy + Math.sin(a) * r)];
    const k = `${p[0]},${p[1]}`;
    if (k !== last) out.push(p);
    last = k;
  }
  return out;
}

// ============================================================================================
// Public types
// ============================================================================================

export type Discipline = "vanguard" | "gunner" | "lamplighter" | "reaver" | "hexer";
export type ArmorWeight = "light" | "medium" | "heavy";
export type LampKind = "none" | "oil" | "arc" | "shroud";
export type MercPose = "idle0" | "idle1" | "attack" | "cast" | "hurt" | "downed";
export interface MercLook {
  discipline: Discipline;
  body: number; // 0 slim, 1 standard, 2 broad
  skin: number; // 0..5 index into SKIN
  hair: number; // 0..7 style; 0 = shaved
  hairColor: number; // 0..7 index into HAIR
  primary: number; // 0..9 index into TINTS
  secondary: number; // 0..9 index into TINTS
  headgear: number; // 0 none, 1 hood, 2 goggles, 3 rebreather, 4 helmet
  marking: number; // 0 none, 1 scar, 2 war paint, 3 cybernetic eye
  armor: ArmorWeight;
  lamp: LampKind;
  weaponTier: number; // 0..4
}

export const MERC_FRAME = { w: 48, h: 48, footY: 44, centerX: 24 } as const;

// ============================================================================================
// Palette per look
// ============================================================================================

interface Pal {
  skin: Ramp;
  hair: Ramp;
  pri: Ramp;
  sec: Ramp;
  pants: Ramp;
  boots: Ramp;
  glove: Ramp;
  steel: Ramp;
  accent: string;
  accentHi: string;
  tier: number;
  eye: string;
}

const TIER_COLORS = [
  RARITY_COLORS.common,
  RARITY_COLORS.uncommon,
  RARITY_COLORS.rare,
  RARITY_COLORS.epic,
  RARITY_COLORS.relic,
];

function mixHex(a: string, b: string, t: number): string {
  const n = mixPk(pk(a), pk(b), t);
  const r = n & 255;
  const g = (n >>> 8) & 255;
  const bl = (n >>> 16) & 255;
  return `#${((1 << 24) | (r << 16) | (g << 8) | bl).toString(16).slice(1)}`;
}

function pick<T>(arr: readonly T[], i: number): T {
  const n = arr.length;
  return arr[((Math.round(i) % n) + n) % n] as T;
}

function palOf(look: MercLook): Pal {
  const skin = pick(SKIN, look.skin);
  const hair = pick(HAIR, look.hairColor);
  const pri = pick(TINTS, look.primary).ramp;
  const sec = pick(TINTS, look.secondary).ramp;
  const rock = RAMPS.rock;
  const pants = [0, 1, 2, 3].map((i) => mixHex(tone(sec, i), tone(rock, i + 1), 0.5));
  const tier = clamp(Math.round(look.weaponTier), 0, 4);
  const accent = tier === 0 ? RAMPS.steel[3] : (TIER_COLORS[tier] ?? RAMPS.steel[3]);
  return {
    skin,
    hair,
    pri,
    sec,
    pants,
    boots: RAMPS.leather.slice(0, 4),
    glove: RAMPS.leather.slice(1, 5),
    steel: RAMPS.steel,
    accent,
    accentHi: tier === 0 ? RAMPS.steel[4] : mixHex(accent, "#ffffff", 0.45),
    tier,
    eye: mixHex(skin[0] ?? INK, INK, 0.6),
  };
}

// ============================================================================================
// Rig
// ============================================================================================

interface Limb {
  a: P;
  b: P;
  c: P;
}
interface Rig {
  hip: P;
  chest: P;
  head: P; // top-left of the 12x14 head grid
  fl: Limb; // far leg (screen-right, forward)
  nl: Limb; // near leg (screen-left, back)
  fa: Limb; // far arm (shoulder at the chest's front edge)
  na: Limb; // near arm (drawn over the torso)
  w: number; // main weapon angle (deg)
  w2: number; // secondary angle
  t: number; // pose tag for effects
}

type V = [number, number];
const add = (p: P, d: P): P => [p[0] + d[0], p[1] + d[1]];
const limb = (a: V, b: V, c: V): Limb => ({ a, b, c });

function mkRig(
  hip: V,
  chest: V,
  fl: [V, V, V],
  nl: [V, V, V],
  fa: [V, V, V],
  na: [V, V, V],
  w: number,
  w2 = 0,
  headOff: V = [0, 0],
): Rig {
  return {
    hip,
    chest,
    head: [chest[0] - 6 + headOff[0], chest[1] - 12 + headOff[1]],
    fl: limb(...fl),
    nl: limb(...nl),
    fa: limb(...fa),
    na: limb(...na),
    w,
    w2,
    t: 0,
  };
}

/** Idle breathing: upper body (and everything it holds) sinks 1px; feet stay planted. */
function bob(r: Rig, d = 1): Rig {
  const dn = (p: P): P => [p[0], p[1] + d];
  const arm = (l: Limb): Limb => ({ a: dn(l.a), b: dn(l.b), c: dn(l.c) });
  return { ...r, chest: dn(r.chest), head: dn(r.head), fa: arm(r.fa), na: arm(r.na) };
}

// Rig table: hip, chest, far leg (hip, knee, foot), near leg, far arm (shoulder, elbow, hand),
// near arm, main weapon angle, secondary angle, head offset.
type RigRow = readonly number[];
const STD_LEGS = [26, 31, 28, 37, 29, 43, 22, 31, 21, 37, 19, 43];
const HURT_LEGS = [25, 31, 28, 36, 30, 42, 21, 31, 20, 37, 19, 43];
const RIGS: Record<Discipline, Record<"idle0" | "attack" | "cast" | "hurt", RigRow>> = {
  vanguard: {
    idle0: [
      24,
      31,
      24,
      20,
      ...STD_LEGS,
      27,
      22,
      29,
      25,
      31,
      26,
      22,
      22,
      24,
      27,
      27,
      26,
      74,
      0,
      0,
      0,
    ],
    attack: [
      26, 32, 29, 22, 28, 32, 32, 37, 34, 43, 24, 32, 20, 38, 16, 43, 31, 24, 34, 25, 36, 26, 27,
      24, 26, 28, 24, 27, 62, 0, 1, 1,
    ],
    cast: [
      24, 31, 24, 20, 26, 31, 29, 37, 31, 43, 22, 31, 20, 37, 17, 43, 27, 22, 28, 18, 27, 16, 23,
      22, 27, 23, 31, 22, -130, 0, 0, 0,
    ],
    hurt: [
      23,
      31,
      21,
      21,
      ...HURT_LEGS,
      24,
      23,
      24,
      27,
      26,
      29,
      19,
      23,
      22,
      20,
      25,
      18,
      150,
      0,
      -2,
      0,
    ],
  },
  gunner: {
    idle0: [
      24,
      31,
      24,
      20,
      ...STD_LEGS,
      27,
      22,
      28,
      26,
      27,
      29,
      22,
      22,
      25,
      26,
      31,
      25,
      -30,
      0,
      0,
      0,
    ],
    attack: [
      23, 31, 23, 20, 25, 31, 28, 37, 30, 43, 21, 31, 19, 37, 17, 43, 26, 22, 26, 26, 27, 24, 21,
      22, 26, 26, 32, 23, 0, 0, 1, 1,
    ],
    cast: [
      23, 31, 23, 20, 25, 31, 28, 37, 30, 43, 21, 31, 19, 37, 17, 43, 26, 22, 26, 26, 27, 24, 21,
      22, 25, 25, 31, 21, -22, 0, 1, 0,
    ],
    hurt: [
      23,
      31,
      21,
      21,
      ...HURT_LEGS,
      24,
      23,
      25,
      27,
      27,
      28,
      19,
      23,
      21,
      19,
      23,
      16,
      -70,
      0,
      -2,
      0,
    ],
  },
  lamplighter: {
    idle0: [
      24,
      31,
      24,
      20,
      ...STD_LEGS,
      27,
      22,
      28,
      27,
      28,
      31,
      22,
      22,
      25,
      26,
      30,
      26,
      -90,
      0,
      0,
      0,
    ],
    attack: [
      25, 31, 27, 21, 27, 31, 31, 37, 33, 43, 23, 31, 20, 37, 17, 43, 29, 23, 30, 27, 28, 30, 25,
      23, 29, 23, 33, 22, -45, 0, 1, 0,
    ],
    cast: [
      24,
      31,
      24,
      20,
      ...STD_LEGS,
      27,
      22,
      30,
      23,
      33,
      21,
      23,
      22,
      26,
      18,
      28,
      15,
      -90,
      0,
      0,
      -1,
    ],
    hurt: [
      23,
      31,
      21,
      21,
      ...HURT_LEGS,
      24,
      23,
      25,
      27,
      27,
      29,
      19,
      23,
      22,
      26,
      25,
      25,
      -68,
      0,
      -2,
      0,
    ],
  },
  reaver: {
    idle0: [
      23, 33, 25, 23, 25, 33, 29, 37, 31, 43, 21, 33, 18, 38, 16, 43, 28, 25, 31, 28, 33, 28, 23,
      25, 23, 29, 26, 31, -35, 18, 1, 0,
    ],
    attack: [
      27, 33, 31, 24, 29, 33, 34, 38, 37, 43, 25, 33, 20, 39, 15, 43, 33, 26, 36, 26, 39, 25, 28,
      26, 26, 30, 23, 30, 12, 150, 2, 1,
    ],
    cast: [
      24, 33, 25, 23, 26, 33, 30, 38, 31, 43, 22, 33, 19, 38, 17, 43, 28, 25, 30, 29, 27, 27, 23,
      25, 26, 29, 29, 27, -60, -120, 1, 0,
    ],
    hurt: [
      23, 32, 21, 22, 25, 32, 28, 37, 30, 42, 21, 32, 19, 37, 18, 43, 24, 24, 26, 27, 28, 26, 19,
      24, 18, 28, 16, 26, -60, -150, -2, 0,
    ],
  },
  hexer: {
    idle0: [
      24,
      31,
      25,
      20,
      ...STD_LEGS,
      28,
      22,
      28,
      27,
      28,
      30,
      23,
      22,
      27,
      25,
      31,
      25,
      0,
      0,
      1,
      1,
    ],
    attack: [
      24, 31, 26, 21, 26, 31, 30, 37, 32, 43, 22, 31, 20, 37, 17, 43, 29, 23, 29, 27, 28, 30, 24,
      23, 29, 23, 33, 22, 0, 0, 1, 0,
    ],
    cast: [
      24,
      31,
      24,
      20,
      ...STD_LEGS,
      27,
      22,
      30,
      24,
      32,
      23,
      23,
      22,
      25,
      17,
      27,
      14,
      0,
      0,
      0,
      -1,
    ],
    hurt: [
      23,
      31,
      21,
      21,
      ...HURT_LEGS,
      24,
      23,
      25,
      27,
      26,
      30,
      19,
      23,
      21,
      19,
      22,
      16,
      0,
      0,
      -2,
      0,
    ],
  },
};
const DOWNED_ROW: RigRow = [
  24, 31, 24, 20, 26, 31, 30, 36, 27, 42, 22, 31, 22, 37, 21, 43, 27, 22, 31, 21, 34, 19, 22, 22,
  23, 27, 24, 31, 0, 0, 1, 0,
];

function rigFromRow(n: RigRow): Rig {
  const v = (i: number) => n[i] ?? 0;
  const pt = (i: number): V => [v(i), v(i + 1)];
  const three = (i: number): [V, V, V] => [pt(i), pt(i + 2), pt(i + 4)];
  return mkRig(pt(0), pt(2), three(4), three(10), three(16), three(22), v(28), v(29), pt(30));
}

function rigFor(d: Discipline, pose: MercPose): Rig {
  if (pose === "idle1") return bob(rigFor(d, "idle0"));
  if (pose === "downed") return downedRig(d);
  return rigFromRow(RIGS[d][pose]);
}

/** Limp body used for "downed" (drawn upright, then rotated onto the ground). */
function downedRig(_d: Discipline): Rig {
  return rigFromRow(DOWNED_ROW);
}

// ============================================================================================
// Head, hair & headgear templates (12 x 14 grid; cranium x3..9, nose x10, rows 3..10)
// ============================================================================================

const HEAD = [
  "............",
  "............",
  "............",
  ".....2333...",
  "....233443..",
  "...2334444..",
  "...2334443..",
  "...22133e3..",
  "...22133333.",
  "...1223332..",
  "....11222...",
];

const HAIRS: readonly (readonly string[])[] = [
  // 0 shaved: faint stubble cap
  ["", "", "", ".....ssss...", "....sssss...", "...ss.......", "...s........"],
  // 1 short crop
  [
    "",
    "",
    "....bbbb....",
    "...bccccb...",
    "..abbcccbb..",
    "..abbbbbb...",
    "..aab.......",
    "..aa........",
    "...a........",
  ],
  // 2 mohawk
  [
    "......c.....",
    ".....bcc....",
    "....abbcc...",
    "...aabbbcb..",
    "...s.ab.....",
    "...ss.......",
    "...s........",
  ],
  // 3 long, tied back
  [
    "",
    "",
    "....bbbb....",
    "...bccccb...",
    "..abbcccbb..",
    "..abbbbbb...",
    ".aabbb......",
    ".abb........",
    ".acb........",
    "aab.........",
    "ab..........",
    "ab..........",
    "a...........",
  ],
  // 4 braids
  [
    "",
    "",
    "....bbbb....",
    "...bccccb...",
    "..abbcccbb..",
    "..abbbbbb...",
    "..abbb......",
    ".acab.......",
    ".bab........",
    ".acb........",
    ".bab........",
    ".ac.........",
    ".a..........",
  ],
  // 5 swept fringe
  [
    "",
    "",
    "...bbbbb....",
    "..bcccccbb..",
    "..abbcccccb.",
    "..abbbbbbbcb",
    "..aab...bb..",
    "..aa........",
    "..a.........",
  ],
  // 6 topknot
  [
    "....bc......",
    "...bccb.....",
    "....ab......",
    "...abbbbb...",
    "..aabbcbbb..",
    "..abbbb.....",
    "..ab........",
    "..a.........",
  ],
  // 7 wild / shaggy
  [
    "",
    "...b.b.b....",
    "..bbcbcbbb..",
    ".abbcccbbbb.",
    ".abbbcccbbbb",
    "aabbbbbbbbb.",
    "aabbab..bb..",
    "aab.a.......",
    ".ab.........",
    ".a..........",
  ],
];

const HOOD = [
  "",
  ".....tttt...",
  "...ttuuuut..",
  "..tuuvvvuut.",
  ".tuuvvvvuuut",
  ".tuuuuus....",
  ".tuuuuus....",
  "stuuuuus....",
  "stuuuuus....",
  "stuuuuuts...",
  "stuuuuuuts..",
  "stuuuuuuuts.",
  "sttuuuuuuutt",
  ".ssttttttss.",
];

const GOGGLES = ["", "", "", "", "......fFFf..", "..lllLfhgfg.", "......ffff.."];

const REBREATHER = [
  "",
  "",
  "",
  "",
  "",
  "",
  "",
  "......l.....",
  "....l..kmMm.",
  ".....l.kmmnR",
  "......kkmmnr",
];

const HELMET = [
  "",
  "",
  ".....kkkk...",
  "...kmMMWMk..",
  "..kmMMMMMmk.",
  "..kmMMMMmmnk",
  "..knmmmmmmnk",
  "..knmmvvVVvk",
  "..knnmmmmmnk",
  "..kknnmmnnk.",
  "...kknnnk...",
  "....kkk.....",
];

function drawHead(s: Spr, r: Rig, look: MercLook, pal: Pal, glows: Glow[]): void {
  const [hx, hy] = r.head;
  const sk = pal.skin;
  const hg = look.headgear;
  // Neck
  const nx = hx + 5 + Math.round((r.chest[0] - (hx + 6)) * 0.5);
  for (let y = hy + 10; y <= r.chest[1]; y++) {
    s.set(nx, y, tone(sk, 1));
    s.set(nx + 1, y, tone(sk, 1));
    s.set(nx + 2, y, tone(sk, 0));
  }
  // Long hair that falls behind the head is drawn first so the skull overlaps it.
  const hairMap: Record<string, string> = {
    a: tone(pal.hair, 0),
    b: tone(pal.hair, 1),
    c: tone(pal.hair, 2),
    s: mixHex(tone(sk, 1), tone(pal.hair, 0), 0.45),
  };
  const headMap: Record<string, string> = {
    "1": tone(sk, 0),
    "2": tone(sk, 1),
    "3": tone(sk, 2),
    "4": tone(sk, 3),
    e: pal.eye,
  };
  s.tpl(hx, hy, HEAD, headMap);
  // Brow
  const brow = mixHex(tone(pal.hair, 0), tone(sk, 0), 0.4);
  s.set(hx + 7, hy + 6, brow).set(hx + 8, hy + 6, brow);

  // Markings
  const mk = look.marking;
  if (mk === 1) {
    const scar = mixHex(tone(sk, 3), RAMPS.rust[4], 0.45);
    s.set(hx + 7, hy + 5, scar)
      .set(hx + 7, hy + 7, scar)
      .set(hx + 6, hy + 8, scar);
  } else if (mk === 2) {
    // dark band on light skin, pale ash paint on dark skin
    const light = look.skin === 2 || look.skin === 3 || look.skin === 5;
    const paint = hg === 4 ? "" : light ? RAMPS.umbra[1] : RAMPS.bone[4];
    s.set(hx + 6, hy + 7, paint)
      .set(hx + 7, hy + 7, paint)
      .set(hx + 9, hy + 7, paint)
      .set(hx + 7, hy + 8, paint);
  } else if (mk === 3) {
    s.set(hx + 8, hy + 7, RAMPS.crystal[5]).set(hx + 9, hy + 7, RAMPS.steel[3]);
    s.set(hx + 8, hy + 8, RAMPS.steel[2]);
    if (hg !== 4)
      glows.push({ x: hx + 8, y: hy + 7, r: 3, color: RAMPS.crystal[4], strength: 0.55 });
  }

  // Hair
  const hairRows = pick(HAIRS, look.hair);
  if (hg === 0 || hg === 2 || hg === 3) {
    s.tpl(hx, hy, hairRows, hairMap);
    // hair casts a little shadow on the forehead
    for (let x = hx + 6; x <= hx + 10; x++) {
      const y = hy + 5;
      if (!hairMap.b) break;
      if (s.get(x, y - 1) === pk(tone(pal.hair, 1)) || s.get(x, y - 1) === pk(tone(pal.hair, 2))) {
        if (s.get(x, y) === pk(tone(sk, 3)) || s.get(x, y) === pk(tone(sk, 2)))
          s.set(x, y, tone(sk, 1));
      }
    }
  } else if (hg === 4) {
    // only hair escaping below/behind the helmet
    const rows = hairRows.map((row, j) =>
      [...row].map((ch, i) => (i < 2 || j > 10 ? ch : ".")).join(""),
    );
    s.tpl(hx, hy, rows, hairMap);
  }

  // Headgear
  if (hg === 1) {
    const sec = pal.sec;
    s.tpl(hx, hy, HOOD, {
      s: tone(sec, 0),
      t: tone(sec, 1),
      u: tone(sec, 2),
      v: tone(sec, 3),
    });
    // shade the face under the brim
    for (let x = hx + 7; x <= hx + 10; x++) {
      s.blend(x, hy + 5, INK, 0.45);
      s.blend(x, hy + 6, INK, 0.3);
    }
    if (look.discipline === "hexer") {
      // tattered hem
      for (const x of [hx + 2, hx + 5, hx + 8]) s.data[(hy + 13) * s.w + x] = 0;
      for (const x of [hx + 3, hx + 9]) s.blend(x, hy + 12, INK, 0.3);
    }
  } else if (hg === 2) {
    s.tpl(hx, hy, GOGGLES, {
      l: tone(RAMPS.leather, 1),
      L: tone(RAMPS.leather, 2),
      f: tone(RAMPS.steel, 1),
      F: tone(RAMPS.steel, 3),
      g: opts_hostile ? RAMPS.rust[3] : tone(RAMPS.crystal, 3),
      h: opts_hostile ? RAMPS.rust[5] : tone(RAMPS.crystal, 5),
    });
  } else if (hg === 3) {
    s.tpl(hx, hy, REBREATHER, {
      l: tone(RAMPS.leather, 1),
      k: tone(RAMPS.steel, 1),
      m: tone(RAMPS.steel, 2),
      M: tone(RAMPS.steel, 4),
      n: tone(RAMPS.steel, 1),
      r: tone(RAMPS.steel, 2),
      R: opts_hostile ? RAMPS.rust[4] : tone(pal.sec, 3),
    });
  } else if (hg === 4) {
    s.tpl(hx, hy, HELMET, {
      k: tone(pal.steel, 1),
      n: tone(pal.steel, 2),
      m: tone(pal.steel, 3),
      M: tone(pal.steel, 4),
      W: tone(pal.steel, 5),
      v: RAMPS.void[1],
      V: opts_hostile ? RAMPS.rust[4] : look.marking === 3 ? RAMPS.crystal[5] : RAMPS.lamp[4],
    });
    // tint stripe in primary color
    s.set(hx + 6, hy + 3, tone(pal.pri, 3)).set(hx + 6, hy + 4, tone(pal.pri, 3));
    s.set(hx + 6, hy + 5, tone(pal.pri, 2));
    glows.push({
      x: hx + 9,
      y: hy + 7,
      r: 3,
      color: look.marking === 3 ? RAMPS.crystal[4] : RAMPS.lamp[3],
      strength: 0.35,
    });
  }
}

// ============================================================================================
// Weapons (authored pointing right, pivot = grip)
// ============================================================================================

interface Wpn {
  rows: readonly string[];
  pivot: P;
}

const MAUL: Wpn = {
  rows: [
    "...............kMMMk",
    "...............nMWMn",
    "...............nMMmn",
    "..............*nmmmn",
    "owwqqqwwwwwwwo*+mmmn",
    "dddqqqddddddd.*nmmnk",
    "...............nmmnk",
    "...............nnnnk",
    "...............kkkk.",
  ],
  pivot: [4, 4],
};

const RIFLE: Wpn = {
  rows: [
    ".......kmMMMc.............",
    "........k**k..............",
    "oo....knmMMMMnmMMMMMMMMM+k",
    "wwwwwwnnmmmmnnnnnnnnnnn*nk",
    "dwwd...wwnkkn.............",
    "dd.....ww.kn..............",
  ],
  pivot: [8, 4],
};

const STAFF: Wpn = {
  rows: [
    "nkwwwwwwwwwwwwwqqqwwwwwwwwwob*bwo.",
    "................................bw",
    ".................................w",
  ],
  pivot: [16, 0],
};

const BLADE: Wpn = {
  rows: [
    "............MW",
    "..........MMWm",
    "........MMMmn.",
    ".....nmMMmn...",
    "qqq*kmmmn.....",
    "...*..........",
  ],
  pivot: [1, 4],
};

function wpnMap(pal: Pal): Record<string, string> {
  return {
    k: tone(RAMPS.steel, 1),
    n: tone(RAMPS.steel, 2),
    m: tone(RAMPS.steel, 3),
    M: tone(RAMPS.steel, 4),
    W: tone(RAMPS.steel, 5),
    d: tone(RAMPS.leather, 1),
    w: tone(RAMPS.leather, 2),
    o: tone(RAMPS.leather, 3),
    q: tone(pal.sec, 2),
    "*": pal.accent,
    "+": pal.accentHi,
    b: tone(RAMPS.lamp, 1),
    c: tone(RAMPS.crystal, 4),
    r: tone(RAMPS.rust, 2),
  };
}

function drawWeapon(s: Spr, w: Wpn, pal: Pal, hand: P, angle: number, flipV?: boolean): Mask {
  const src = tplSpr(w.rows, wpnMap(pal));
  return blitRot(s, src, w.pivot[0], w.pivot[1], angle, hand[0], hand[1], flipV);
}

function tierGlow(glows: Glow[], pal: Pal, x: number, y: number): void {
  if (pal.tier >= 3) glows.push({ x, y, r: 4, color: pal.accent, strength: 0.35 });
}

// ============================================================================================
// Lanterns
// ============================================================================================

function lampColors(kind: LampKind): { core: string; mid: string; edge: string; glow: string } {
  if (kind === "arc")
    return {
      core: "#ffffff",
      mid: RAMPS.crystal[5],
      edge: RAMPS.crystal[3],
      glow: RAMPS.crystal[4],
    };
  if (kind === "shroud")
    return {
      core: RAMPS.umbra[5],
      mid: RAMPS.umbra[4],
      edge: RAMPS.umbra[2],
      glow: RAMPS.umbra[3],
    };
  return { core: RAMPS.lamp[5], mid: RAMPS.lamp[4], edge: RAMPS.lamp[2], glow: RAMPS.lamp[3] };
}

/** Small belt lantern hanging from (x,y). */
function beltLamp(s: Spr, x: number, y: number, kind: LampKind, glows: Glow[], dim = 1): void {
  if (kind === "none") return;
  const c = lampColors(kind);
  const st = RAMPS.steel;
  s.set(x, y, st[2]);
  s.set(x - 1, y + 1, st[3])
    .set(x, y + 1, st[2])
    .set(x + 1, y + 1, st[1]);
  s.set(x - 1, y + 2, c.edge)
    .set(x, y + 2, c.mid)
    .set(x + 1, y + 2, c.edge);
  s.set(x - 1, y + 3, c.edge)
    .set(x, y + 3, c.core)
    .set(x + 1, y + 3, c.edge);
  s.set(x - 1, y + 4, st[2])
    .set(x, y + 4, st[1])
    .set(x + 1, y + 4, st[0]);
  const strength = (kind === "shroud" ? 0.28 : 0.34) * dim;
  glows.push({ x, y: y + 3, r: kind === "shroud" ? 4 : 5, color: c.glow, strength });
}

/** Big staff lantern hanging from hook (x,y). */
function staffLamp(s: Spr, x: number, y: number, glows: Glow[], bright: number): void {
  const st = RAMPS.steel;
  const L = RAMPS.lamp;
  s.set(x, y, st[3]);
  s.hline(x - 1, x + 1, y + 1, st[2]).set(x - 1, y + 1, st[3]);
  s.hline(x - 2, x + 2, y + 2, st[1])
    .set(x - 2, y + 2, st[3])
    .set(x - 1, y + 2, st[2]);
  for (let j = 3; j <= 6; j++) {
    s.set(x - 2, y + j, st[2]);
    s.set(x + 2, y + j, st[0]);
    s.set(x - 1, y + j, L[3]);
    s.set(x, y + j, j === 4 || j === 5 ? L[5] : L[4]);
    s.set(x + 1, y + j, L[2]);
  }
  s.set(x, y + 3, L[4]);
  s.hline(x - 2, x + 2, y + 7, st[1]).set(x - 2, y + 7, st[2]);
  s.set(x, y + 8, st[1]);
  glows.push({ x, y: y + 5, r: 9 + bright * 6, color: L[3], strength: 0.4 + bright * 0.25 });
  if (bright > 0) glows.push({ x, y: y + 5, r: 4, color: L[5], strength: 0.5 });
}

// ============================================================================================
// Body parts
// ============================================================================================

/** Torso profile per row (back, front) for a standard body, top (shoulders) -> bottom (hips). */
const TORSO: readonly P[] = [
  [3, 3],
  [4, 4],
  [4, 4],
  [4, 4],
  [4, 4],
  [3, 4],
  [3, 3],
  [3, 3],
  [3, 3],
  [3, 3],
  [4, 3],
  [4, 3],
];

function torsoMask(r: Rig, look: MercLook, w: number, h: number): Mask {
  const m = new Mask(w, h);
  const [cx, cy] = r.chest;
  const [hx, hy] = r.hip;
  const bodyAdj = clamp(look.body, 0, 2) - 1;
  const heavy = look.armor === "heavy" ? 1 : 0;
  for (let y = cy; y <= hy + 1; y++) {
    const t = clamp((y - cy) / Math.max(1, hy - cy), 0, 1);
    const idx = clamp(Math.round(t * (TORSO.length - 1)), 0, TORSO.length - 1);
    const prof = TORSO[idx] as P;
    const chestRow = idx <= 6 ? heavy + (bodyAdj > 0 ? 1 : 0) : 0;
    const x = Math.round(cx + (hx - cx) * t);
    const back = prof[0] + bodyAdj + chestRow;
    const front = prof[1] + bodyAdj + chestRow - (bodyAdj < 0 && idx >= 5 && idx <= 9 ? 1 : 0);
    m.span(y, x - back, x + front);
  }
  return m;
}

function legMasks(L: Limb, rad: number, w: number, h: number): { leg: Mask; ankle: P } {
  const m = new Mask(w, h);
  const ankle: P = [L.c[0], L.c[1] - 2];
  m.capsule(L.a[0], L.a[1], L.b[0], L.b[1], rad + 0.2, rad);
  m.capsule(L.b[0], L.b[1], ankle[0], ankle[1], rad, rad - 0.25);
  return { leg: m, ankle };
}

function drawLeg(s: Spr, L: Limb, look: MercLook, pal: Pal, far: boolean) {
  const rad = [1.15, 1.35, 1.6][clamp(look.body, 0, 2)] ?? 1.35;
  const { leg, ankle } = legMasks(L, rad, s.w, s.h);
  const bias = far ? -0.8 : 0;
  shade(s, leg, pal.pants, { bias, kx: 0.7 });
  // Knee / greave
  if (look.armor === "heavy") {
    const g = new Mask(s.w, s.h).capsule(L.b[0], L.b[1], ankle[0], ankle[1], rad + 0.2, rad);
    shade(s, g, pal.pri.slice(0, 5), { bias: bias + 0.2, kx: 0.7 });
    const k = new Mask(s.w, s.h).ellipse(L.b[0] + 0.5, L.b[1], 1.6, 1.2);
    shade(s, k, RAMPS.steel.slice(1, 6), { bias });
  } else if (look.armor === "medium") {
    s.set(L.b[0] + 1, L.b[1], tone(RAMPS.steel, far ? 2 : 3));
    s.set(L.b[0] + 1, L.b[1] + 1, tone(RAMPS.steel, far ? 1 : 2));
  }
  // Boot
  const [fx, fy] = L.c;
  const b = pal.boots;
  const heavy = look.armor === "heavy";
  const bm = new Mask(s.w, s.h);
  bm.span(fy - 3, fx - 1, fx + 1);
  bm.span(fy - 2, fx - 1, fx + 1);
  bm.span(fy - 1, fx - 1, fx + 2 + (heavy ? 1 : 0));
  bm.span(fy, fx - 2, fx + 3);
  const bootRamp = heavy ? pal.pri.slice(0, 4) : b;
  shade(s, bm, bootRamp, { bias: bias + 0.3, kx: 0.5 });
  s.hline(fx - 2, fx + 3, fy, tone(RAMPS.leather, 0));
  s.set(fx + 2, fy - 1, tone(bootRamp, far ? 1 : 3));
  if (!heavy) s.hline(fx - 1, fx + 1, fy - 3, tone(b, far ? 1 : 2));
}

function sleeveRamp(look: MercLook, pal: Pal): Ramp {
  if (look.armor === "medium") return pal.sec.slice(0, 4);
  return pal.pri.slice(0, 4);
}

/** Draws an arm (upper + forearm). The hand is drawn separately so it can sit over a grip. */
function drawArm(s: Spr, A: Limb, look: MercLook, pal: Pal, far: boolean): Mask {
  const rad = [1.05, 1.2, 1.45][clamp(look.body, 0, 2)] ?? 1.2;
  const bias = far ? -0.8 : 0;
  const up = new Mask(s.w, s.h).capsule(A.a[0], A.a[1], A.b[0], A.b[1], rad + 0.15, rad);
  const fo = new Mask(s.w, s.h).capsule(A.b[0], A.b[1], A.c[0], A.c[1], rad, rad - 0.2);
  const sl = sleeveRamp(look, pal);
  const all = new Mask(s.w, s.h);
  up.each((x, y) => all.add(x, y));
  fo.each((x, y) => all.add(x, y));
  if (!far) contactShadow(s, all, 0.5);
  shade(s, up, sl, { bias, kx: 0.65 });
  const gaunt = look.armor === "heavy" || (look.discipline === "hexer" && !far);
  if (gaunt) {
    shade(s, fo, look.discipline === "hexer" ? RAMPS.umbra.slice(1, 6) : RAMPS.steel.slice(1, 6), {
      bias,
      kx: 0.65,
    });
  } else if (look.armor === "medium") {
    shade(s, fo, sl, { bias, kx: 0.65 });
    // leather bracer near the wrist
    const br = new Mask(s.w, s.h).capsule(
      A.b[0] + (A.c[0] - A.b[0]) * 0.45,
      A.b[1] + (A.c[1] - A.b[1]) * 0.45,
      A.c[0],
      A.c[1],
      rad,
      rad - 0.2,
    );
    shade(s, br, RAMPS.leather.slice(1, 5), { bias, kx: 0.65 });
  } else {
    shade(s, fo, sl, { bias, kx: 0.65 });
  }
  if (look.armor === "heavy") {
    const el = new Mask(s.w, s.h).ellipse(A.b[0], A.b[1], 1.3, 1.3);
    shade(s, el, RAMPS.steel.slice(1, 6), { bias });
  }
  return all;
}

function drawHand(s: Spr, A: Limb, look: MercLook, pal: Pal, far: boolean, big = false): void {
  const [x, y] = A.c;
  const m = new Mask(s.w, s.h);
  if (big) m.ellipse(x, y, 1.6, 1.5);
  else m.rect(x - 1, y - 1, 2, 2).add(x, y + 1);
  const ramp =
    look.discipline === "hexer" && !far
      ? RAMPS.umbra.slice(1, 6)
      : look.armor === "heavy"
        ? RAMPS.steel.slice(1, 6)
        : pal.glove;
  shade(s, m, ramp, { bias: far ? -0.6 : 0.3 });
}

function pauldron(s: Spr, at: P, look: MercLook, pal: Pal, far: boolean): void {
  const big = look.armor === "heavy";
  const m = new Mask(s.w, s.h);
  if (big) m.ellipse(at[0], at[1] + 0.5, 3.2, 2.4);
  else m.ellipse(at[0], at[1] + 0.5, 2.1, 1.6);
  m.each((x, y) => {
    if (y > at[1] + 2) m.del(x, y);
  });
  if (!far) contactShadow(s, m, 0.5);
  shade(s, m, pal.pri.slice(0, 5), { bias: far ? -1 : 0.3, kx: 0.55 });
  if (big && !far) {
    // trim + rivet
    const by = at[1] + 2;
    for (let x = at[0] - 3; x <= at[0] + 3; x++) if (m.has(x, by)) s.set(x, by, tone(pal.sec, 2));
    s.set(at[0] - 1, at[1] - 1, mixHex(tone(pal.pri, 4), "#ffffff", 0.4));
    s.set(at[0] + 1, at[1] + 1, tone(RAMPS.steel, 4));
  }
}

// ============================================================================================
// Composition
// ============================================================================================

interface Op {
  z: number;
  fn: () => void;
}

export interface MercComposeOpts {
  hostile?: boolean;
  noProps?: boolean;
}

export interface Composed {
  spr: Spr;
  glows: Glow[];
  rig: Rig;
}

function torsoAndClothes(s: Spr, r: Rig, look: MercLook, pal: Pal, ops: Op[]) {
  const W = s.w;
  const H = s.h;
  const [hx, hy] = r.hip;
  const [cx, cy] = r.chest;
  const d = look.discipline;
  const robe = d === "lamplighter";
  const coat = look.armor === "light" || robe;

  // Coat skirt / robe (over the thighs) – z between legs and torso
  if (coat) {
    ops.push({
      z: -0.5,
      fn: () => {
        const len = robe ? 10 : 6;
        const m = new Mask(W, H);
        const back = hx - 4 - clamp(look.body, 0, 2) + 1;
        m.poly([
          [back, hy - 2],
          [hx + 4, hy - 2],
          [hx + 4 + (robe ? 3 : 1), hy + len - 1],
          [hx + 1, hy + len],
          [back - (robe ? 4 : 3), hy + len + 1],
        ]);
        const ramp = robe ? pal.sec.slice(0, 4) : pal.pri.slice(0, 4);
        shade(s, m, ramp, { kx: 0.5, bias: -0.2 });
        // front opening / hem
        for (let y = hy; y <= hy + len; y++) s.set(hx + 2, y, tone(ramp, 0));
        m.each((x, y) => {
          if (!m.has(x, y + 1)) s.set(x, y, tone(ramp, 0));
        });
        if (robe) {
          // trim line in primary color
          for (let y = hy; y <= hy + len - 1; y++) s.set(hx + 3, y, tone(pal.pri, 3));
        }
      },
    });
  }

  ops.push({
    z: 0,
    fn: () => {
      const tm = torsoMask(r, look, W, H);
      const heavy = look.armor === "heavy";
      const base = look.armor === "medium" ? pal.sec.slice(0, 4) : pal.pri.slice(0, heavy ? 5 : 4);
      shade(s, tm, base, { kx: 0.55 });
      const rowX = (y: number) => Math.round(cx + ((hx - cx) * (y - cy)) / Math.max(1, hy - cy));

      if (look.armor === "medium") {
        // vest over shirt
        const vm = new Mask(W, H);
        tm.each((x, y) => {
          if (y < cy + 2) return;
          const mx = rowX(y);
          if (y < cy + 5 && x >= mx + 1 && x <= mx + 2) return; // V-neck
          vm.add(x, y);
        });
        shade(s, vm, pal.pri.slice(0, 4), { kx: 0.55, bias: 0.2 });
        for (let y = cy + 4; y < hy - 1; y += 3) {
          const mx = rowX(y);
          for (let x = mx - 3; x <= mx + 1; x++) if (vm.has(x, y)) s.blend(x, y, INK, 0.25);
        }
      } else if (heavy) {
        // breastplate seams, rivets, gorget
        for (const yy of [cy + 6, cy + 8]) {
          tm.each((x, y) => {
            if (y === yy) s.set(x, y, tone(pal.pri, 1));
          });
        }
        const mx = rowX(cy + 2);
        s.set(mx - 2, cy + 2, mixHex(tone(pal.pri, 4), "#ffffff", 0.35));
        s.set(mx - 1, cy + 3, tone(pal.pri, 4));
        s.set(mx + 3, cy + 4, tone(RAMPS.steel, 4));
        const gm = new Mask(W, H).span(cy, cx - 2, cx + 2).span(cy + 1, cx - 2, cx + 2);
        shade(s, gm, RAMPS.steel.slice(1, 6), { kx: 0.7 });
      } else {
        // coat: collar + lapel line
        s.set(cx - 2, cy, tone(pal.sec, 2)).set(cx - 1, cy, tone(pal.sec, 3));
        s.set(cx - 2, cy - 1, tone(pal.sec, 2));
        for (let y = cy + 1; y < hy - 2; y++)
          s.set(rowX(y) + 2, y, tone(robe ? pal.pri : pal.sec, 2));
      }

      // Discipline torso extras
      if (d === "gunner") {
        // bandolier from near shoulder to far hip
        for (const [x, y] of linePts(cx - 3, cy + 1, hx + 3, hy - 2)) {
          s.set(x, y, tone(RAMPS.leather, 1));
          s.set(x + 1, y, tone(RAMPS.leather, 2));
        }
        let i = 0;
        for (const [x, y] of linePts(cx - 2, cy + 2, hx + 2, hy - 3)) {
          if (i++ % 2 === 0) s.set(x + 1, y, RAMPS.lamp[3]);
        }
      }
      if (d === "lamplighter") {
        // sash
        for (const [x, y] of linePts(cx + 2, cy + 1, hx - 3, hy - 2)) {
          s.set(x, y, tone(pal.pri, 3));
          s.set(x, y + 1, tone(pal.pri, 2));
        }
      }

      // Belt
      const by = hy - 2;
      tm.each((x, y) => {
        if (y === by) s.set(x, y, tone(RAMPS.leather, 1));
        if (y === by + 1) s.set(x, y, tone(RAMPS.leather, 0));
      });
      const bx = rowX(by) + 2;
      s.set(bx, by, tone(RAMPS.lamp, 3)).set(bx, by + 1, tone(RAMPS.lamp, 2));
      // pouch at the back hip
      const px = rowX(by) - 4;
      s.rect(px, by, 3, 3, tone(RAMPS.leather, 2));
      s.hline(px, px + 2, by, tone(RAMPS.leather, 3));
      s.set(px + 2, by + 2, tone(RAMPS.leather, 1));

      if (opts_hostile) {
        // red rag tied on the belt
        s.set(bx - 1, by + 1, RAMPS.rust[3]).set(bx - 1, by + 2, RAMPS.rust[2]);
        s.set(bx - 2, by + 3, RAMPS.rust[2]);
      }
    },
  });

  if (look.armor === "heavy") {
    ops.push({
      z: 0.5,
      fn: () => {
        // tassets (plate skirt)
        const m = new Mask(W, H);
        m.poly([
          [hx - 4, hy],
          [hx + 4, hy],
          [hx + 5, hy + 4],
          [hx - 5, hy + 4],
        ]);
        shade(s, m, pal.pri.slice(0, 5), { kx: 0.5 });
        s.hline(hx - 5, hx + 5, hy + 2, tone(pal.pri, 1));
        s.vline(hx, hy, hy + 4, tone(pal.pri, 1));
        s.hline(hx - 4, hx + 4, hy, tone(pal.sec, 2));
      },
    });
  }
}

// Module-level flag set during a compose call (keeps the torso helper signature small).
let opts_hostile = false;

function composeMerc(look: MercLook, pose: MercPose, o: MercComposeOpts = {}): Composed {
  const W = MERC_FRAME.w;
  const H = MERC_FRAME.h;
  if (pose === "downed") return composeDowned(look, o);
  const s = new Spr(W, H);
  const glows: Glow[] = [];
  const r = rigFor(look.discipline, pose);
  const pal = palOf(look);
  const ops: Op[] = [];
  const d = look.discipline;
  const prevHostile = opts_hostile;
  opts_hostile = !!o.hostile;
  try {
    // ---- body ----
    ops.push({ z: -6, fn: () => drawArm(s, r.fa, look, pal, true) });
    ops.push({ z: -4.8, fn: () => drawHand(s, r.fa, look, pal, true) });
    ops.push({ z: -4, fn: () => drawLeg(s, r.fl, look, pal, true) });
    ops.push({ z: -2, fn: () => drawLeg(s, r.nl, look, pal, false) });
    torsoAndClothes(s, r, look, pal, ops);
    ops.push({ z: 2, fn: () => drawHead(s, r, look, pal, glows) });
    if (look.armor !== "light" || d === "vanguard") {
      ops.push({ z: -7, fn: () => pauldron(s, add(r.fa.a, [0, 0]), look, pal, true) });
    }
    ops.push({
      z: 4,
      fn: () => {
        const m = drawArm(s, r.na, look, pal, false);
        if (o.hostile) {
          // red rag armband on the near upper arm
          const ax = Math.round((r.na.a[0] + r.na.b[0]) / 2);
          const ay = Math.round((r.na.a[1] + r.na.b[1]) / 2);
          for (let dx = -2; dx <= 2; dx++)
            if (m.has(ax + dx, ay)) s.set(ax + dx, ay, dx < 0 ? RAMPS.rust[4] : RAMPS.rust[3]);
          s.set(ax - 2, ay + 1, RAMPS.rust[2]).set(ax - 3, ay + 2, RAMPS.rust[2]);
        }
      },
    });
    if (look.armor !== "light") {
      ops.push({ z: 4.6, fn: () => pauldron(s, add(r.na.a, [0, -1]), look, pal, false) });
    }
    ops.push({
      z: 6,
      fn: () => drawHand(s, r.na, look, pal, false, d === "hexer"),
    });
    // Belt lamp (back hip, near side)
    if (look.lamp !== "none") {
      ops.push({
        z: 0.8,
        fn: () => beltLamp(s, r.hip[0] - 5, r.hip[1] - 1, look.lamp, glows),
      });
    }

    if (!o.noProps) disciplineProps(s, r, look, pal, pose, glows, ops);
    else if (d === "reaver") scarf(s, r, pal, pose, ops);
    else if (d === "hexer") mantle(s, r, look, pal, ops);

    ops.sort((a, b) => a.z - b.z);
    for (const op of ops) op.fn();
  } finally {
    opts_hostile = prevHostile;
  }
  return { spr: s, glows, rig: r };
}

function scarf(s: Spr, r: Rig, pal: Pal, pose: MercPose, ops: Op[]): void {
  ops.push({
    z: -9,
    fn: () => {
      const [cx, cy] = r.chest;
      const wave = pose === "idle1" ? 1 : 0;
      const sweep = pose === "attack" ? 3 : pose === "hurt" ? -2 : 0;
      const lift = pose === "attack" ? -2 : 0;
      const m = new Mask(s.w, s.h)
        .chain(
          [
            [cx - 2, cy - 1],
            [cx - 6, cy + wave + lift],
            [cx - 10 - sweep, cy + 2 + lift],
            [cx - 13 - sweep, cy + 1 - wave + lift],
          ],
          [1.5, 1.2, 1, 0.5],
        )
        .chain(
          [
            [cx - 3, cy],
            [cx - 6, cy + 4 - wave],
            [cx - 8 - sweep, cy + 6 + lift],
          ],
          [1, 0.8, 0.4],
        );
      shade(s, m, pal.sec.slice(0, 4), { kx: 0.3 });
    },
  });
  ops.push({
    z: 3,
    fn: () => {
      const [cx, cy] = r.chest;
      const m = new Mask(s.w, s.h)
        .span(cy - 1, cx - 3, cx + 1)
        .span(cy, cx - 3, cx + 2)
        .span(cy + 1, cx - 2, cx + 3);
      shade(s, m, pal.sec.slice(0, 5), { kx: 0.6, bias: 0.3 });
      s.set(cx - 3, cy + 1, tone(pal.sec, 1));
    },
  });
}

function mantle(s: Spr, r: Rig, look: MercLook, pal: Pal, ops: Op[]): void {
  ops.push({
    z: 1.5,
    fn: () => {
      const [cx, cy] = r.chest;
      const adj = clamp(look.body, 0, 2) - 1 + (look.armor === "heavy" ? 1 : 0);
      const m = new Mask(s.w, s.h);
      for (let y = cy - 1; y <= cy + 6; y++) {
        const t = y - cy;
        const back = 4 + adj + (t > 1 ? 1 : 0);
        const front = 3 + adj + (t > 2 ? 1 : 0);
        m.span(y, cx - back, cx + front);
      }
      // tattered hem
      for (let x = cx - 6; x <= cx + 6; x++) {
        const k = (x * 7 + 3) % 4;
        if (k === 0) m.add(x, cy + 7).add(x, cy + 8);
        else if (k === 1) m.add(x, cy + 7);
        else if (k === 3) m.del(x, cy + 6);
      }
      m.each((x, y) => {
        if (y > cy + 8) m.del(x, y);
      });
      shade(s, m, pal.sec.slice(0, 4), { kx: 0.55, bias: 0.1 });
      // clasp
      s.set(cx + 2, cy, RAMPS.umbra[4]);
    },
  });
}

function disciplineProps(
  s: Spr,
  r: Rig,
  look: MercLook,
  pal: Pal,
  pose: MercPose,
  glows: Glow[],
  ops: Op[],
): void {
  const d = look.discipline;
  if (d === "vanguard") {
    // Maul in the far hand: planted head-down in front at rest, swung in attack, raised in cast.
    const behind = pose === "hurt";
    const zM = behind ? -9 : pose === "idle0" || pose === "idle1" ? 3.5 : 5.5;
    ops.push({
      z: zM,
      fn: () => {
        drawWeapon(s, MAUL, pal, r.fa.c, r.w);
        const head = rotPt(MAUL.pivot[0], MAUL.pivot[1], r.w, r.fa.c[0], r.fa.c[1], [17, 4]);
        tierGlow(glows, pal, head[0], head[1]);
        if (pose === "attack") {
          // motion smear arcing down to the impact
          const pts = arcPts(r.fa.c[0], r.fa.c[1], 16, -95, 45);
          pts.forEach(([x, y], i) => {
            if (s.has(x, y)) return;
            const t = i / pts.length;
            s.set(x, y, t > 0.7 ? RAMPS.lamp[5] : t > 0.4 ? RAMPS.bone[4] : RAMPS.bone[2]);
          });
          const sm = arcPts(r.fa.c[0], r.fa.c[1], 14, -50, 40);
          sm.forEach(([x, y], i) => {
            if (!s.has(x, y) && i % 2 === 0) s.set(x, y, RAMPS.bone[3]);
          });
          const [ix, iy] = rotPt(MAUL.pivot[0], MAUL.pivot[1], r.w, r.fa.c[0], r.fa.c[1], [20, 4]);
          for (const [dx, dy] of [
            [2, 0],
            [3, -2],
            [1, 2],
            [4, 1],
            [-1, 3],
          ] as const)
            s.set(ix + dx, iy + dy, RAMPS.lamp[4]);
          glows.push({ x: ix + 1, y: iy, r: 7, color: RAMPS.lamp[3], strength: 0.5 });
        }
        if (pose === "cast") {
          glows.push({ x: head[0], y: head[1], r: 9, color: RAMPS.lamp[3], strength: 0.5 });
        }
      },
    });
    if (!behind) ops.push({ z: zM + 0.1, fn: () => drawHand(s, r.fa, look, pal, false) });
    // Heater shield on the near arm
    ops.push({
      z: 5,
      fn: () => {
        const [hx, hy] = r.na.c;
        const x = hx + 1;
        const y = hy - 1;
        const m = new Mask(s.w, s.h).poly([
          [x - 3, y - 5],
          [x + 4, y - 5],
          [x + 4, y + 2],
          [x + 0.5, y + 6],
          [x - 3, y + 2],
        ]);
        m.del(x - 3, y - 5).del(x + 3, y - 5);
        contactShadow(s, m, 0.55);
        shade(s, m, pal.sec.slice(0, 5), { kx: 0.75, bias: 0.3 });
        // steel rim, lit on the upper-left
        m.each((px, py) => {
          const edge =
            !m.has(px - 1, py) || !m.has(px + 1, py) || !m.has(px, py - 1) || !m.has(px, py + 1);
          if (!edge) return;
          const lit = px <= x - 2 || py <= y - 4;
          s.set(px, py, tone(RAMPS.steel, lit ? 4 : 2));
        });
        // emblem: a small lamp-flame sigil in the primary tint
        const e = tone(pal.pri, 4);
        s.set(x, y - 2, e).set(x + 1, y - 2, tone(pal.pri, 3));
        s.set(x, y - 1, e)
          .set(x + 1, y - 1, e)
          .set(x - 1, y - 1, tone(pal.pri, 3));
        s.set(x, y, tone(pal.pri, 3)).set(x + 1, y, tone(pal.pri, 2));
        s.set(x, y + 1, tone(pal.pri, 2));
        s.set(x - 2, y - 4, mixHex(tone(RAMPS.steel, 5), "#ffffff", 0.3));
        if (pose === "cast") {
          glows.push({ x, y: y - 1, r: 11, color: RAMPS.lamp[4], strength: 0.45 });
          for (const [dx, dy] of [
            [6, -1],
            [5, -6],
            [5, 4],
            [7, -3],
            [-1, -8],
          ] as const)
            s.set(x + dx, y - 1 + dy, RAMPS.lamp[5]);
        }
      },
    });
    return;
  }

  if (d === "gunner") {
    ops.push({
      z: 5,
      fn: () => {
        drawWeapon(s, RIFLE, pal, r.fa.c, r.w, false);
        // strap sag
        const a = rotPt(RIFLE.pivot[0], RIFLE.pivot[1], r.w, r.fa.c[0], r.fa.c[1], [2, 4], false);
        const b = rotPt(RIFLE.pivot[0], RIFLE.pivot[1], r.w, r.fa.c[0], r.fa.c[1], [16, 3], false);
        const mid: P = [Math.round((a[0] + b[0]) / 2), Math.round((a[1] + b[1]) / 2) + 4];
        for (const [x, y] of [
          ...linePts(a[0], a[1] + 1, mid[0], mid[1]),
          ...linePts(mid[0], mid[1], b[0], b[1] + 1),
        ])
          if (!s.has(x, y) || y > Math.max(a[1], b[1])) s.set(x, y, tone(pal.sec, 1));
        const muzzle = rotPt(
          RIFLE.pivot[0],
          RIFLE.pivot[1],
          r.w,
          r.fa.c[0],
          r.fa.c[1],
          [25, 2.5],
          false,
        );
        const scope = rotPt(
          RIFLE.pivot[0],
          RIFLE.pivot[1],
          r.w,
          r.fa.c[0],
          r.fa.c[1],
          [12, 0],
          false,
        );
        tierGlow(glows, pal, muzzle[0] - 2, muzzle[1]);
        if (pose === "attack") {
          const [mx, my] = muzzle;
          const L = RAMPS.lamp;
          s.set(mx + 1, my, L[5])
            .set(mx + 2, my, L[5])
            .set(mx + 3, my, L[4]);
          s.set(mx + 1, my - 1, L[4]).set(mx + 1, my + 1, L[4]);
          s.set(mx + 2, my - 2, L[3]).set(mx + 2, my + 2, L[3]);
          s.set(mx + 4, my, L[3]).set(mx + 3, my - 1, L[3]);
          glows.push({ x: mx + 2, y: my, r: 8, color: L[4], strength: 0.7 });
          // smoke puff behind
          s.set(mx - 3, my - 3, RAMPS.bone[2]).set(mx - 2, my - 4, RAMPS.bone[1]);
        }
        if (pose === "cast") {
          s.set(scope[0], scope[1], RAMPS.crystal[5]);
          glows.push({ x: scope[0], y: scope[1], r: 5, color: RAMPS.crystal[4], strength: 0.6 });
          // laser sight dots
          for (let i = 1; i <= 4; i++) {
            const p = rotPt(
              RIFLE.pivot[0],
              RIFLE.pivot[1],
              r.w,
              r.fa.c[0],
              r.fa.c[1],
              [26 + i * 3, 2],
              false,
            );
            s.set(p[0], p[1], i % 2 ? RAMPS.crystal[4] : RAMPS.crystal[3]);
          }
        }
      },
    });
    ops.push({ z: 5.5, fn: () => drawHand(s, r.fa, look, pal, false) });
    return;
  }

  if (d === "lamplighter") {
    ops.push({
      z: 5,
      fn: () => {
        drawWeapon(s, STAFF, pal, r.na.c, r.w, false);
        const hook = rotPt(
          STAFF.pivot[0],
          STAFF.pivot[1],
          r.w,
          r.na.c[0],
          r.na.c[1],
          [33, 2],
          false,
        );
        const bright = pose === "cast" ? 1 : 0;
        staffLamp(s, hook[0], hook[1] + 1, glows, bright);
        if (pose === "cast") {
          const [x, y] = [hook[0], hook[1] + 6];
          for (const [dx, dy] of [
            [-6, 0],
            [6, 0],
            [0, -7],
            [-5, -5],
            [5, -5],
            [-4, 5],
            [5, 5],
          ] as const)
            s.set(x + dx, y + dy, RAMPS.lamp[5]);
          for (const [dx, dy] of [
            [-7, 0],
            [7, 0],
            [-6, -6],
            [6, -6],
          ] as const)
            s.set(x + dx, y + dy, RAMPS.lamp[3]);
        }
        if (pose === "attack") {
          const pts = arcPts(r.na.c[0], r.na.c[1], 15, -110, -50);
          pts.forEach(([x, y], i) => {
            if (!s.has(x, y) && i % 2 === 0)
              s.set(x, y, i > pts.length / 2 ? RAMPS.lamp[4] : RAMPS.lamp[2]);
          });
        }
      },
    });
    return;
  }

  if (d === "reaver") {
    scarf(s, r, pal, pose, ops);
    // back blade (near hand, held low/reversed)
    ops.push({
      z: 5,
      fn: () => {
        drawWeapon(s, BLADE, pal, r.na.c, r.w2);
        const tip = rotPt(BLADE.pivot[0], BLADE.pivot[1], r.w2, r.na.c[0], r.na.c[1], [10, 1]);
        tierGlow(glows, pal, tip[0], tip[1]);
      },
    });
    // lead blade (far hand)
    ops.push({
      z: pose === "attack" ? 6.5 : 5.5,
      fn: () => {
        drawWeapon(s, BLADE, pal, r.fa.c, r.w, false);
        const tip = rotPt(
          BLADE.pivot[0],
          BLADE.pivot[1],
          r.w,
          r.fa.c[0],
          r.fa.c[1],
          [11, 0],
          false,
        );
        tierGlow(glows, pal, tip[0], tip[1]);
        if (pose === "attack") {
          const pts = arcPts(r.fa.c[0] - 3, r.fa.c[1] + 2, 13, -95, 15);
          pts.forEach(([x, y], i) => {
            if (s.has(x, y)) return;
            const t = i / pts.length;
            s.set(x, y, t > 0.7 ? RAMPS.bone[5] : t > 0.4 ? RAMPS.bone[4] : RAMPS.bone[2]);
          });
          const inner = arcPts(r.fa.c[0] - 3, r.fa.c[1] + 2, 11, -60, 10);
          inner.forEach(([x, y], i) => {
            if (!s.has(x, y) && i % 2 === 1) s.set(x, y, RAMPS.bone[3]);
          });
        }
        if (pose === "cast") {
          glows.push({
            x: r.chest[0] + 2,
            y: r.chest[1] + 4,
            r: 9,
            color: RAMPS.rust[3],
            strength: 0.5,
          });
          s.set(r.chest[0] + 5, r.chest[1] - 2, RAMPS.rust[5]).set(
            r.chest[0] + 7,
            r.chest[1] + 1,
            RAMPS.rust[4],
          );
          s.set(r.chest[0] - 2, r.chest[1] - 3, RAMPS.rust[4]);
        }
      },
    });
    ops.push({ z: pose === "attack" ? 6.6 : 5.6, fn: () => drawHand(s, r.fa, look, pal, false) });
    return;
  }

  // hexer
  mantle(s, r, look, pal, ops);
  ops.push({
    z: 7,
    fn: () => {
      const [hx, hy] = r.na.c;
      const U = RAMPS.umbra;
      let ox = hx + 3;
      let oy = hy - 4;
      let rad = 2;
      if (pose === "attack") {
        ox = hx + 8;
        oy = hy - 1;
      } else if (pose === "cast") {
        ox = hx + 1;
        oy = hy - 6;
        rad = 3;
      } else if (pose === "hurt") {
        ox = hx + 4;
        oy = hy - 3;
        rad = 1;
      }
      if (pose === "attack") {
        // trail
        for (let i = 1; i <= 6; i++) {
          s.set(ox - rad - i, oy + (i % 2 ? 0 : 1) - 1, i < 3 ? U[4] : i < 5 ? U[3] : U[2]);
          if (i < 4) s.set(ox - rad - i, oy + 1, U[2]);
        }
      }
      const m = new Mask(s.w, s.h).disc(ox, oy, rad);
      shade(s, m, [U[1], U[2], U[3], U[4]], { kx: 0.5 });
      s.set(ox, oy, U[5]);
      if (rad >= 2) s.set(ox - 1, oy - 1, "#ffffff");
      // orbiting shards
      if (pose !== "hurt") {
        const shards: P[] =
          pose === "cast"
            ? [
                [ox - 6, oy - 1],
                [ox + 6, oy + 1],
                [ox - 2, oy - 6],
                [ox + 3, oy + 5],
              ]
            : [
                [ox - 3, oy + 3],
                [ox + 4, oy - 2],
              ];
        for (const [x, y] of shards) {
          s.set(x, y, U[4]).set(x, y + 1, U[2]);
        }
      }
      const strength = pose === "cast" ? 0.85 : pose === "hurt" ? 0.25 : 0.5;
      glows.push({ x: ox, y: oy, r: pose === "cast" ? 13 : 7, color: U[3], strength });
      if (pose === "cast") glows.push({ x: ox, y: oy, r: 5, color: U[5], strength: 0.6 });
      if (pal.tier >= 3) glows.push({ x: hx, y: hy, r: 4, color: pal.accent, strength: 0.3 });
      // tier accent on the gauntlet knuckles
      if (pal.tier > 0) s.set(hx + 1, hy - 1, pal.accent);
    },
  });
}

// ---- downed -------------------------------------------------------------------------------

function composeDowned(look: MercLook, o: MercComposeOpts): Composed {
  const W = MERC_FRAME.w;
  const H = MERC_FRAME.h;
  const pal = palOf(look);
  // Body drawn upright with the key light from the upper-right, then rotated 90° CCW so the
  // light ends up coming from the upper-left and the merc lies on their back, head left.
  const upright = withLight(1, () => {
    const s = new Spr(W, H);
    const glows: Glow[] = [];
    const r = downedRig(look.discipline);
    const ops: Op[] = [];
    const prev = opts_hostile;
    opts_hostile = !!o.hostile;
    try {
      ops.push({ z: -6, fn: () => drawArm(s, r.fa, look, pal, true) });
      ops.push({ z: -4.8, fn: () => drawHand(s, r.fa, look, pal, true) });
      ops.push({ z: -4, fn: () => drawLeg(s, r.fl, look, pal, true) });
      ops.push({ z: -2, fn: () => drawLeg(s, r.nl, look, pal, false) });
      torsoAndClothes(s, r, look, pal, ops);
      ops.push({ z: 2, fn: () => drawHead(s, r, look, pal, glows) });
      ops.push({ z: 4, fn: () => drawArm(s, r.na, look, pal, false) });
      ops.push({
        z: 6,
        fn: () => drawHand(s, r.na, look, pal, false, look.discipline === "hexer"),
      });
      if (look.armor !== "light") {
        ops.push({ z: 4.6, fn: () => pauldron(s, add(r.na.a, [0, -1]), look, pal, false) });
      }
      if (look.discipline === "hexer") mantle(s, r, look, pal, ops);
      if (look.discipline === "reaver") scarf(s, r, pal, "idle0", ops);
      ops.sort((a, b) => a.z - b.z);
      for (const op of ops) op.fn();
    } finally {
      opts_hostile = prev;
    }
    return { s, glows };
  });
  const src = upright.s;
  const bb = src.bbox();
  const s = new Spr(W, H);
  // rotate CCW: (x, y) -> (y, W-1-x); then translate so feet/back rest on the ground
  const rotW = bb.y1 - bb.y0 + 1;
  const offX = Math.round(MERC_FRAME.centerX - rotW / 2) - bb.y0 - 1;
  const offY = MERC_FRAME.footY - 1 - (W - 1 - bb.x0);
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const c = src.get(x, y);
      if (c) s.setN(y + offX, W - 1 - x + offY, c);
    }
  const glows: Glow[] = upright.glows.map((g) => ({
    ...g,
    x: g.y + offX,
    y: W - 1 - g.x + offY,
  }));
  // Dropped weapon / lamp beside the body
  const gy = MERC_FRAME.footY - 1;
  const d = look.discipline;
  if (d === "vanguard") {
    drawWeapon(s, MAUL, pal, [23, gy - 4], 0);
    const m = new Mask(W, H).ellipse(9, gy - 2, 4.5, 1.6);
    shade(s, m, pal.sec.slice(0, 5), { kx: 0.3, bias: 0.3 });
    m.each((x, y) => {
      if (!m.has(x, y - 1)) s.set(x, y, tone(RAMPS.steel, 4));
    });
  } else if (d === "gunner") {
    drawWeapon(s, RIFLE, pal, [26, gy - 2], 0);
  } else if (d === "lamplighter") {
    drawWeapon(s, STAFF, pal, [22, gy], 0);
    // lantern toppled, guttering
    staffLamp(s, 42, gy - 8, glows, 0);
    glows.pop();
    glows.push({ x: 42, y: gy - 3, r: 6, color: RAMPS.lamp[2], strength: 0.3 });
  } else if (d === "reaver") {
    drawWeapon(s, BLADE, pal, [33, gy - 1], 8);
    drawWeapon(s, BLADE, pal, [6, gy], -4);
  } else {
    const U = RAMPS.umbra;
    s.set(40, gy - 1, U[3])
      .set(41, gy - 1, U[2])
      .set(40, gy - 2, U[4])
      .set(41, gy, U[1]);
    glows.push({ x: 40, y: gy - 1, r: 4, color: U[3], strength: 0.25 });
  }
  if (look.lamp !== "none") {
    // belt lamp knocked over, dim
    const c = lampColors(look.lamp);
    const lx = 13;
    s.set(lx, gy, RAMPS.steel[1])
      .set(lx + 1, gy, c.edge)
      .set(lx + 2, gy, c.mid)
      .set(lx + 3, gy, RAMPS.steel[2]);
    s.set(lx + 1, gy - 1, RAMPS.steel[2]).set(lx + 2, gy - 1, c.edge);
    glows.push({ x: lx + 2, y: gy, r: 5, color: c.glow, strength: 0.25 });
  }
  return { spr: s, glows, rig: downedRig(d) };
}

// ============================================================================================
// Public API
// ============================================================================================

const WARM_RIM = RAMPS.lamp[4];

/** 48x48 merc sprite facing right on a transparent background. */
export function drawMerc(look: MercLook, pose: MercPose): HTMLCanvasElement {
  const c = composeMerc(look, pose);
  rim(c.spr, 1, WARM_RIM, 0.32);
  return finish(c.spr, c.glows);
}

/**
 * Internal: compose a merc for enemies.ts (rival scavengers). Drawn with the key light from
 * the right and a cold rim on the left so that, once mirrored to face left, lighting matches
 * the enemy side of the screen.
 */
export function drawHostileMerc(look: MercLook, pose: MercPose): HTMLCanvasElement {
  return withLight(1, () => {
    const c = composeMerc(look, pose, { hostile: true });
    rim(c.spr, -1, RAMPS.lamp[3], 0.28);
    rim(c.spr, 1, RAMPS.umbra[3], 0.25);
    const flipped = c.spr.flipped();
    const glows = c.glows.map((g) => ({ ...g, x: c.spr.w - 1 - g.x }));
    return withLight(-1, () => finish(flipped, glows));
  });
}

/** Head-and-shoulders crop of the idle pose, smart-upscaled (Scale2x) to 24x24. */
function portraitOf(
  c: Composed,
  flip: boolean,
  rimSide: number,
  rimColor: string,
): HTMLCanvasElement {
  const [hx, hy] = c.rig.head;
  const crop = new Spr(12, 12);
  const x0 = hx + 1;
  const y0 = hy + 1;
  for (let y = 0; y < 12; y++)
    for (let x = 0; x < 12; x++) crop.setN(x, y, c.spr.get(x0 + x, y0 + y));
  let big = scale2x(crop);
  if (flip) big = big.flipped();
  rim(big, rimSide, rimColor, 0.3);
  // re-clip the glows into portrait space
  const glows = c.glows
    .filter((g) => g.r <= 4)
    .map((g) => {
      const gx = (g.x - x0) * 2 + 1;
      return { ...g, x: flip ? 23 - gx : gx, y: (g.y - y0) * 2 + 1, r: g.r * 1.5 };
    })
    .filter((g) => g.x >= 0 && g.y >= 0 && g.x < 24 && g.y < 24);
  return finish(big, glows, false);
}

export function drawMercPortrait(look: MercLook): HTMLCanvasElement {
  const c = composeMerc(look, "idle0", { noProps: true });
  return portraitOf(c, false, 1, WARM_RIM);
}

/** Internal: portrait for rival scavengers (faces left). */
export function drawHostileMercPortrait(look: MercLook): HTMLCanvasElement {
  const c = composeMerc(look, "idle0", { noProps: true, hostile: true });
  return portraitOf(c, true, 1, RAMPS.umbra[3]);
}
