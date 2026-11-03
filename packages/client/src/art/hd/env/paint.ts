/**
 * Painting helpers for the HD environment art (backdrops, map): fast value noise, noise
 * canvases painted at low resolution and upscaled (soft for free), film grain, ridge lines,
 * inked silhouettes, fog, light shafts and dust motes.
 *
 * Everything is deterministic: pass a `seeded()` rng or a seed, never Math.random.
 */
import { canvas, ctx2d, INK_COLOR, type Pt, seeded, withAlpha } from "../ink";

/** Backdrop canvas size (render px) and the front-most (parallax) layer width. */
export const BW = 1920;
export const BH = 1080;
export const FRONT_W = 2112;
/** Characters' feet line and the top of the bottom HUD (render px). */
export const FEET_Y = 750;
export const HUD_Y = 858;

export type Rng = () => number;

export const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;
export const clamp = (v: number, lo: number, hi: number): number =>
  v < lo ? lo : v > hi ? hi : v;
export const smooth = (t: number): number => t * t * (3 - 2 * t);
export const range = (rnd: Rng, a: number, b: number): number => a + rnd() * (b - a);
export function pick<T>(rnd: Rng, arr: readonly T[]): T {
  const v = arr[Math.floor(rnd() * arr.length) % arr.length];
  if (v === undefined) throw new Error("pick from empty array");
  return v;
}

// ---------------------------------------------------------------------------
// Value noise
// ---------------------------------------------------------------------------

export type Noise2 = (x: number, y: number) => number;

/** Smooth 2D value noise in [0,1] with a 256-cell repeating lattice. */
export function makeNoise(seed: number): Noise2 {
  const rnd = seeded(seed * 7919 + 13);
  const perm = new Uint8Array(512);
  const vals = new Float32Array(256);
  for (let i = 0; i < 256; i++) {
    perm[i] = i;
    vals[i] = rnd();
  }
  for (let i = 255; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    const t = perm[i] as number;
    perm[i] = perm[j] as number;
    perm[j] = t;
  }
  for (let i = 0; i < 256; i++) perm[i + 256] = perm[i] as number;
  return (x, y) => {
    const xf = Math.floor(x);
    const yf = Math.floor(y);
    const tx = x - xf;
    const ty = y - yf;
    const xi = xf & 255;
    const yi = yf & 255;
    const a = perm[xi] as number;
    const b = perm[xi + 1] as number;
    const v00 = vals[perm[a + yi] as number] as number;
    const v10 = vals[perm[b + yi] as number] as number;
    const v01 = vals[perm[a + yi + 1] as number] as number;
    const v11 = vals[perm[b + yi + 1] as number] as number;
    const sx = tx * tx * (3 - 2 * tx);
    const sy = ty * ty * (3 - 2 * ty);
    const top = v00 + (v10 - v00) * sx;
    const bot = v01 + (v11 - v01) * sx;
    return top + (bot - top) * sy;
  };
}

/** Fractal sum of `oct` octaves, normalised to ~[0,1]. */
export function fbm(n: Noise2, x: number, y: number, oct = 4): number {
  let sum = 0;
  let amp = 0.5;
  let norm = 0;
  let f = 1;
  for (let i = 0; i < oct; i++) {
    sum += n(x * f, y * f) * amp;
    norm += amp;
    amp *= 0.5;
    f *= 2.03;
  }
  return sum / norm;
}

/**
 * Paint a canvas pixel by pixel: `fn` returns packed 0xAABBGGRR (little-endian RGBA) or 0.
 * Paint at low resolution and draw the result scaled up for soft, painterly fields.
 */
export function pixelCanvas(
  w: number,
  h: number,
  fn: (x: number, y: number) => number,
): HTMLCanvasElement {
  const c = canvas(w, h);
  const ctx = ctx2d(c);
  const img = ctx.createImageData(w, h);
  const buf = new Uint32Array(img.data.buffer);
  let i = 0;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) buf[i++] = fn(x, y);
  ctx.putImageData(img, 0, 0);
  return c;
}

/** Pack an rgb triple and alpha 0..1 for `pixelCanvas`. */
export function rgba(r: number, g: number, b: number, a = 1): number {
  return (
    ((Math.round(clamp(a, 0, 1) * 255) << 24) |
      (clamp(Math.round(b), 0, 255) << 16) |
      (clamp(Math.round(g), 0, 255) << 8) |
      clamp(Math.round(r), 0, 255)) >>>
    0
  );
}

export function hexRgb(hex: string): [number, number, number] {
  const n = Number.parseInt(hex.slice(1, 7), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/** Draw `src` stretched to fill (dx,dy,dw,dh) with high-quality smoothing. */
export function blit(
  ctx: CanvasRenderingContext2D,
  src: HTMLCanvasElement,
  dx = 0,
  dy = 0,
  dw = ctx.canvas.width,
  dh = ctx.canvas.height,
): void {
  ctx.save();
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(src, dx, dy, dw, dh);
  ctx.restore();
}

// ---------------------------------------------------------------------------
// Grain / texture
// ---------------------------------------------------------------------------

const grainTiles = new Map<number, HTMLCanvasElement>();

/** 256² tile of light and dark speckles (alpha-only, so it works atop transparent art). */
export function grainTile(seed = 1): HTMLCanvasElement {
  const hit = grainTiles.get(seed);
  if (hit) return hit;
  const rnd = seeded(seed * 31 + 5);
  const c = pixelCanvas(256, 256, () => {
    const v = rnd();
    const a = rnd();
    return v < 0.5 ? rgba(0, 0, 0, a * 0.55) : rgba(255, 240, 220, a * 0.35);
  });
  grainTiles.set(seed, c);
  return c;
}

/** Film grain over the whole canvas. `atop` keeps transparent pixels transparent. */
export function applyGrain(ctx: CanvasRenderingContext2D, alpha: number, atop = false, seed = 1) {
  const pat = ctx.createPattern(grainTile(seed), "repeat");
  if (!pat) return;
  ctx.save();
  ctx.globalAlpha = alpha;
  if (atop) ctx.globalCompositeOperation = "source-atop";
  ctx.fillStyle = pat;
  ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
  ctx.restore();
}

/** Tint every opaque pixel toward `color` (atmospheric perspective on a layer). */
export function hazeAtop(ctx: CanvasRenderingContext2D, color: string, alpha: number) {
  ctx.save();
  ctx.globalCompositeOperation = "source-atop";
  ctx.fillStyle = withAlpha(color, alpha);
  ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
  ctx.restore();
}

/** Vertical haze that increases with height band [y0..y1] (fog lying on the ground). */
export function hazeBandAtop(
  ctx: CanvasRenderingContext2D,
  color: string,
  y0: number,
  y1: number,
  a0: number,
  a1: number,
) {
  ctx.save();
  ctx.globalCompositeOperation = "source-atop";
  const g = ctx.createLinearGradient(0, y0, 0, y1);
  g.addColorStop(0, withAlpha(color, a0));
  g.addColorStop(1, withAlpha(color, a1));
  ctx.fillStyle = g;
  ctx.fillRect(0, Math.min(y0, y1), ctx.canvas.width, Math.abs(y1 - y0));
  ctx.restore();
}

// ---------------------------------------------------------------------------
// Gradients, fog, light
// ---------------------------------------------------------------------------

export function vgrad(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  stops: readonly (readonly [number, string])[],
) {
  const g = ctx.createLinearGradient(0, y, 0, y + h);
  for (const [t, c] of stops) g.addColorStop(t, c);
  ctx.fillStyle = g;
  ctx.fillRect(x, y, w, h);
}

/** Horizontal fog band, densest at `y`, fading over `h` px above and below. */
export function fogBand(
  ctx: CanvasRenderingContext2D,
  y: number,
  h: number,
  color: string,
  alpha: number,
  x = 0,
  w = ctx.canvas.width,
) {
  const g = ctx.createLinearGradient(0, y - h, 0, y + h);
  g.addColorStop(0, withAlpha(color, 0));
  g.addColorStop(0.5, withAlpha(color, alpha));
  g.addColorStop(1, withAlpha(color, 0));
  ctx.fillStyle = g;
  ctx.fillRect(x, y - h, w, h * 2);
}

/**
 * Wispy fog: a low-res fbm field tinted `color`, drawn stretched over (x,y,w,h). Patchy
 * horizontally stretched noise with a vertical bell so it fades at the band edges.
 */
export function fogWisps(
  ctx: CanvasRenderingContext2D,
  seed: number,
  x: number,
  y: number,
  w: number,
  h: number,
  color: string,
  alpha: number,
  stretch = 4,
) {
  const n = makeNoise(seed);
  const lw = Math.max(8, Math.round(w / 12));
  const lh = Math.max(4, Math.round(h / 12));
  const [r, g, b] = hexRgb(color);
  const c = pixelCanvas(lw, lh, (px, py) => {
    const ty = py / (lh - 1);
    const bell = Math.sin(ty * Math.PI);
    const v = fbm(n, (px / lw) * 6, (py / lh) * (6 / stretch) * (h / w) * 6, 4);
    const a = clamp((v - 0.38) * 2.2, 0, 1) * bell * alpha;
    return rgba(r, g, b, a);
  });
  blit(ctx, c, x, y, w, h);
}

/** Soft radial glow with normal (not additive) blending. */
export function softSpot(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  r: number,
  color: string,
  alpha: number,
  sy = 1,
) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(1, sy);
  const g = ctx.createRadialGradient(0, 0, 0, 0, 0, r);
  g.addColorStop(0, withAlpha(color, alpha));
  g.addColorStop(0.4, withAlpha(color, alpha * 0.45));
  g.addColorStop(1, withAlpha(color, 0));
  ctx.fillStyle = g;
  ctx.fillRect(-r, -r, r * 2, r * 2);
  ctx.restore();
}

/** Additive glow, optionally squashed vertically. */
export function addGlow(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  r: number,
  color: string,
  alpha: number,
  sy = 1,
) {
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  softSpot(ctx, x, y, r, color, alpha, sy);
  ctx.restore();
}

/**
 * A light shaft: trapezoid from (x, y) of width `w0`, travelling `len` px at `angle`
 * (radians from straight down), widening to `w1`, fading out along its length.
 */
export function lightShaft(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w0: number,
  w1: number,
  len: number,
  angle: number,
  color: string,
  alpha: number,
) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  ctx.globalCompositeOperation = "lighter";
  const g = ctx.createLinearGradient(0, 0, 0, len);
  g.addColorStop(0, withAlpha(color, alpha));
  g.addColorStop(0.55, withAlpha(color, alpha * 0.4));
  g.addColorStop(1, withAlpha(color, 0));
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.moveTo(-w0 / 2, 0);
  ctx.lineTo(w0 / 2, 0);
  ctx.lineTo(w1 / 2, len);
  ctx.lineTo(-w1 / 2, len);
  ctx.closePath();
  ctx.fill();
  // soft side falloff: a second narrower, brighter core
  const g2 = ctx.createLinearGradient(0, 0, 0, len * 0.8);
  g2.addColorStop(0, withAlpha(color, alpha * 0.6));
  g2.addColorStop(1, withAlpha(color, 0));
  ctx.fillStyle = g2;
  ctx.beginPath();
  ctx.moveTo(-w0 / 5, 0);
  ctx.lineTo(w0 / 5, 0);
  ctx.lineTo(w1 / 5, len * 0.8);
  ctx.lineTo(-w1 / 5, len * 0.8);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

/** Floating dust motes / embers / sparks in a rectangle. */
export function motes(
  ctx: CanvasRenderingContext2D,
  rnd: Rng,
  n: number,
  x: number,
  y: number,
  w: number,
  h: number,
  color: string,
  maxR = 2.6,
  alpha = 0.7,
) {
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  for (let i = 0; i < n; i++) {
    const px = x + rnd() * w;
    const py = y + rnd() * h;
    const r = 0.6 + rnd() ** 3 * maxR;
    const a = alpha * (0.25 + rnd() * 0.75);
    if (r > 1.6) softSpot(ctx, px, py, r * 4, color, a * 0.25);
    ctx.fillStyle = withAlpha(color, a);
    ctx.beginPath();
    ctx.arc(px, py, r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

/** Vignette: darken the corners/edges of an opaque layer. */
export function vignette(ctx: CanvasRenderingContext2D, color: string, alpha: number, inner = 0.45) {
  const { width: w, height: h } = ctx.canvas;
  const g = ctx.createRadialGradient(w / 2, h * 0.48, Math.min(w, h) * inner, w / 2, h / 2, w * 0.72);
  g.addColorStop(0, withAlpha(color, 0));
  g.addColorStop(1, withAlpha(color, alpha));
  ctx.save();
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
  ctx.restore();
}

// ---------------------------------------------------------------------------
// Silhouettes
// ---------------------------------------------------------------------------

/**
 * A ridge line from x0 to x1: fbm-displaced heights around baseY with amplitude `amp`.
 * `jag` (0..1) mixes in sharp random peaks (mountain ridges) vs. smooth rolls (cave floors).
 */
export function ridge(
  rnd: Rng,
  x0: number,
  x1: number,
  baseY: number,
  amp: number,
  step = 12,
  jag = 0.4,
  freq = 1,
): Pt[] {
  const n = makeNoise(Math.floor(rnd() * 1e6));
  const pts: Pt[] = [];
  const off = rnd() * 50;
  for (let x = x0; x <= x1 + step; x += step) {
    const sx = (x / 420) * freq + off;
    // smooth rolling base + ridged (crag) octaves for mountains
    const roll = fbm(n, sx, 0.5, 3) - 0.5;
    let crag = 0;
    let a = 0.5;
    let f = 1.7;
    for (let o = 0; o < 4; o++) {
      const v = 1 - Math.abs(n(sx * f + 31, 7.3 + o) * 2 - 1);
      crag += v * v * a;
      a *= 0.5;
      f *= 2.1;
    }
    const h = roll * (1 - jag) * 2 + (crag - 0.35) * jag * 2.2;
    const y = baseY - h * amp - (rnd() - 0.5) * amp * 0.06 * jag;
    pts.push([x, y]);
  }
  return pts;
}

export interface SilhouetteStyle {
  fill: string | CanvasGradient;
  /** Ink contour width along the top edge (0 = none). */
  ink?: number;
  inkColor?: string;
  /** Rim light along the top edge. */
  rim?: string;
  rimWidth?: number;
  rimAlpha?: number;
}

/** Fill the area under a ridge line down to `bottom`, ink the top edge, add an optional rim. */
export function silhouette(
  ctx: CanvasRenderingContext2D,
  pts: readonly Pt[],
  bottom: number,
  style: SilhouetteStyle,
) {
  const first = pts[0];
  const last = pts[pts.length - 1];
  if (!first || !last) return;
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(first[0], bottom);
  for (const p of pts) ctx.lineTo(p[0], p[1]);
  ctx.lineTo(last[0], bottom);
  ctx.closePath();
  ctx.fillStyle = style.fill;
  ctx.fill();
  if (style.rim) {
    ctx.clip();
    ctx.strokeStyle = withAlpha(style.rim, style.rimAlpha ?? 0.55);
    ctx.lineWidth = style.rimWidth ?? 3;
    ctx.beginPath();
    ctx.moveTo(first[0], first[1] + 1.5);
    for (const p of pts) ctx.lineTo(p[0], p[1] + 1.5);
    ctx.stroke();
  }
  ctx.restore();
  if (style.ink) {
    ctx.save();
    ctx.strokeStyle = style.inkColor ?? INK_COLOR;
    ctx.lineWidth = style.ink;
    ctx.lineJoin = "round";
    ctx.beginPath();
    ctx.moveTo(first[0], first[1]);
    for (const p of pts) ctx.lineTo(p[0], p[1]);
    ctx.stroke();
    ctx.restore();
  }
}

/** Hatching strokes clipped to the current path region given as a path function. */
export function hatchRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  spacing: number,
  color: string,
  alpha: number,
  width = 1.2,
  slope = 1,
) {
  ctx.save();
  ctx.strokeStyle = withAlpha(color, alpha);
  ctx.lineWidth = width;
  ctx.beginPath();
  for (let i = -h; i < w + h; i += spacing) {
    ctx.moveTo(x + i, y);
    ctx.lineTo(x + i - h * slope, y + h);
  }
  ctx.stroke();
  ctx.restore();
}

/** Mirror a canvas horizontally (for seed variety). */
export function flipX(src: HTMLCanvasElement): HTMLCanvasElement {
  const c = canvas(src.width, src.height);
  const ctx = ctx2d(c);
  ctx.translate(src.width, 0);
  ctx.scale(-1, 1);
  ctx.drawImage(src, 0, 0);
  return c;
}

/** Starfield: many tiny points, a few brighter with soft halos and cross flares. */
export function starfield(
  ctx: CanvasRenderingContext2D,
  rnd: Rng,
  n: number,
  x: number,
  y: number,
  w: number,
  h: number,
  density?: (x: number, y: number) => number,
) {
  const tints = ["#ffffff", "#dfe6ff", "#ffe9c8", "#cfd9ff", "#ffd9b0"];
  ctx.save();
  for (let i = 0; i < n; i++) {
    const px = x + rnd() * w;
    const py = y + rnd() * h;
    if (density && rnd() > density(px, py)) continue;
    const m = rnd() ** 4;
    const tint = pick(rnd, tints);
    const a = 0.25 + m * 0.75;
    const r = 0.5 + m * 1.6;
    ctx.fillStyle = withAlpha(tint, a);
    ctx.beginPath();
    ctx.arc(px, py, r, 0, Math.PI * 2);
    ctx.fill();
    if (m > 0.45) {
      ctx.globalCompositeOperation = "lighter";
      softSpot(ctx, px, py, r * 6, tint, 0.18 * m);
      if (m > 0.7) {
        ctx.strokeStyle = withAlpha(tint, 0.35 * m);
        ctx.lineWidth = 0.8;
        const L = r * 7;
        ctx.beginPath();
        ctx.moveTo(px - L, py);
        ctx.lineTo(px + L, py);
        ctx.moveTo(px, py - L);
        ctx.lineTo(px, py + L);
        ctx.stroke();
      }
      ctx.globalCompositeOperation = "source-over";
    }
  }
  ctx.restore();
}

let mirrorLayers = false;
/** While true, new layers are created with a horizontally mirrored base transform. */
export function setMirror(on: boolean): void {
  mirrorLayers = on;
}

/** New transparent layer + its context (mirrored when `setMirror(true)` is active). */
export function layer(w = BW, h = BH): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = canvas(w, h);
  const ctx = ctx2d(c);
  if (mirrorLayers) ctx.setTransform(-1, 0, 0, 1, w, 0);
  return [c, ctx];
}

/**
 * Painterly surface mottling over everything already drawn in (x,y,w,h): a low-res fbm
 * field of light and dark patches composited source-atop (keeps transparency).
 */
export function mottleAtop(
  ctx: CanvasRenderingContext2D,
  seed: number,
  x: number,
  y: number,
  w: number,
  h: number,
  light: string,
  dark: string,
  amount: number,
  scale = 140,
) {
  const n = makeNoise(seed);
  const lw = Math.max(8, Math.round(w / 5));
  const lh = Math.max(8, Math.round(h / 5));
  const [lr, lg, lb] = hexRgb(light);
  const [dr, dg, db] = hexRgb(dark);
  const c = pixelCanvas(lw, lh, (px, py) => {
    const X = px * 5;
    const Y = py * 5;
    const v = fbm(n, X / scale, Y / (scale * 0.7), 4);
    const fine = n(X / 9 + 100, Y / 9);
    const t = v + (fine - 0.5) * 0.18;
    if (t > 0.54) return rgba(lr, lg, lb, Math.min(1, (t - 0.54) * 3.2) * amount);
    if (t < 0.46) return rgba(dr, dg, db, Math.min(1, (0.46 - t) * 3.2) * amount * 1.3);
    return 0;
  });
  ctx.save();
  ctx.globalCompositeOperation = "source-atop";
  blit(ctx, c, x, y, w, h);
  ctx.restore();
}

/**
 * Chiaroscuro: darken everything already drawn toward `color`, except inside soft pools
 * around the given lights (r = falloff radius, sy = vertical squash).
 */
export function shadeAtop(
  ctx: CanvasRenderingContext2D,
  color: string,
  alpha: number,
  lights: readonly { x: number; y: number; r: number; sy?: number; k?: number }[],
) {
  const { width: w, height: h } = ctx.canvas;
  const m = canvas(w, h);
  const mc = ctx2d(m);
  // the mask is painted in the same (possibly mirrored) space as the layer
  mc.setTransform(ctx.getTransform());
  mc.fillStyle = withAlpha(color, alpha);
  mc.fillRect(-w, -h, w * 3, h * 3);
  mc.globalCompositeOperation = "destination-out";
  for (const L of lights) {
    mc.save();
    mc.translate(L.x, L.y);
    mc.scale(1, L.sy ?? 1);
    const g = mc.createRadialGradient(0, 0, 0, 0, 0, L.r);
    const k = L.k ?? 1;
    g.addColorStop(0, `rgba(0,0,0,${k})`);
    g.addColorStop(0.45, `rgba(0,0,0,${k * 0.6})`);
    g.addColorStop(1, "rgba(0,0,0,0)");
    mc.fillStyle = g;
    mc.fillRect(-L.r, -L.r, L.r * 2, L.r * 2);
    mc.restore();
  }
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalCompositeOperation = "source-atop";
  ctx.drawImage(m, 0, 0);
  ctx.restore();
}
