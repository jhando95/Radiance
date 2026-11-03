/**
 * Merc drawing kit: materials (cel ramps with cold shadows + warm lamp rim), shape wrappers
 * with automatic bounds, and small costume details (rivets, stitches, buckles, straps,
 * scratches, torn hems). Everything is drawn in UNSCALED render px; parts are rasterized at
 * a build scale by `makePart` (battle = 1, portraits ≈ 1.5).
 */
import { RAMPS } from "../../palette";
import {
  blob,
  canvas,
  capsule,
  ctx2d,
  ellipse,
  INK_COLOR,
  inkStroke,
  mixHex,
  type PathFn,
  type Pt,
  poly,
  shape,
  withAlpha,
} from "../ink";
import type { RigPart } from "../rig";

export { INK_COLOR as INK, mixHex, withAlpha };
export type { PathFn, Pt };

/** Key light: from the upper front (the squad's lamps are ahead of them). */
export const LIGHT = -1.05;
/** Warm amber lamp rim on the front (right) edge. */
export const RIM: string = RAMPS.lamp[3];
export const RIM_HOT: string = RAMPS.lamp[4];
/** Cold indigo the shadows lean toward. */
export const COLD = "#1b1932";

export interface Mat {
  base: string;
  shade: string;
  deep: string;
  light: string;
  rim: string | null;
}

/** Material from explicit tones (dark → light), cold-shifted shadows, warm-ish highlight. */
export function mat(
  deep: string,
  shade: string,
  base: string,
  light: string,
  rim: string | null = RIM,
): Mat {
  return {
    base,
    shade: mixHex(shade, COLD, 0.3),
    deep: mixHex(deep, INK_COLOR, 0.5),
    light: mixHex(light, RAMPS.lamp[4], 0.12),
    rim,
  };
}

/** Material from a ramp centred on index `i`. */
export function matR(r: readonly string[], i: number, rim: string | null = RIM): Mat {
  const at = (k: number) => r[Math.max(0, Math.min(r.length - 1, k))] ?? INK_COLOR;
  const m = mat(at(i - 2), at(i - 1), at(i), at(i + 1));
  m.rim = rim;
  return m;
}

/** Push a material back in depth (far limbs): darker, colder, dimmer rim. */
export function dim(m: Mat, k = 0.28): Mat {
  return {
    base: mixHex(m.base, COLD, k),
    shade: mixHex(m.shade, COLD, k * 0.8),
    deep: mixHex(m.deep, INK_COLOR, k),
    light: mixHex(m.light, COLD, k * 1.2),
    rim: m.rim ? mixHex(m.rim, COLD, k * 1.4) : null,
  };
}

export function tintMat(m: Mat, color: string, k: number): Mat {
  return {
    base: mixHex(m.base, color, k),
    shade: mixHex(m.shade, color, k * 0.7),
    deep: m.deep,
    light: mixHex(m.light, color, k),
    rim: m.rim,
  };
}

export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface FillOpts {
  /** Ink outline width (default 3). */
  ol?: number;
  /** Hatching in the shadow band (spacing px) – false to skip. */
  hatch?: number | false;
  /** Rim light (default on when the material has one). */
  rim?: boolean;
  rimW?: number;
  /** Shadow band depth override. */
  depth?: number;
  /** Highlight band on/off (default on). */
  light?: boolean;
  /** Speckle grime colour. */
  grain?: string;
  seed?: number;
  lightAngle?: number;
}

export function boundsOf(pts: readonly Pt[], pad = 0): Box {
  let x0 = Number.POSITIVE_INFINITY;
  let y0 = Number.POSITIVE_INFINITY;
  let x1 = Number.NEGATIVE_INFINITY;
  let y1 = Number.NEGATIVE_INFINITY;
  for (const [x, y] of pts) {
    x0 = Math.min(x0, x);
    y0 = Math.min(y0, y);
    x1 = Math.max(x1, x);
    y1 = Math.max(y1, y);
  }
  return { x: x0 - pad, y: y0 - pad, w: x1 - x0 + pad * 2, h: y1 - y0 + pad * 2 };
}

export function fill(
  ctx: CanvasRenderingContext2D,
  path: PathFn,
  box: Box,
  m: Mat,
  o: FillOpts = {},
): void {
  const hatch = o.hatch === undefined ? 5 : o.hatch;
  shape(
    ctx,
    path,
    {
      fill: m.base,
      shade: m.shade,
      deep: m.deep,
      light: o.light === false ? undefined : m.light,
      lightAngle: o.lightAngle ?? LIGHT,
      shadeDepth: o.depth ?? Math.max(4, Math.min(box.w, box.h) * 0.4),
      hatch: hatch ? { spacing: hatch, alpha: 0.42, width: 1.2, color: INK_COLOR } : undefined,
      rim:
        o.rim !== false && m.rim
          ? { side: 1, color: m.rim, width: o.rimW ?? Math.max(1.6, Math.min(3.2, box.w * 0.07)) }
          : undefined,
      outline: o.ol ?? 3,
      grain: o.grain ? { color: o.grain, alpha: 0.28, density: 0.006, seed: o.seed ?? 3 } : undefined,
    },
    box,
  );
}

export function fpoly(ctx: CanvasRenderingContext2D, pts: readonly Pt[], m: Mat, o: FillOpts = {}) {
  fill(ctx, poly(pts), boundsOf(pts), m, o);
}

export function fblob(
  ctx: CanvasRenderingContext2D,
  pts: readonly Pt[],
  m: Mat,
  o: FillOpts = {},
  tension = 0.5,
) {
  fill(ctx, blob(pts, tension), boundsOf(pts, 4), m, o);
}

export function fcaps(
  ctx: CanvasRenderingContext2D,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  r1: number,
  r2: number,
  m: Mat,
  o: FillOpts = {},
) {
  const r = Math.max(r1, r2);
  fill(
    ctx,
    capsule(x1, y1, x2, y2, r1, r2),
    {
      x: Math.min(x1, x2) - r,
      y: Math.min(y1, y2) - r,
      w: Math.abs(x2 - x1) + r * 2,
      h: Math.abs(y2 - y1) + r * 2,
    },
    m,
    o,
  );
}

export function fell(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  rx: number,
  ry: number,
  m: Mat,
  o: FillOpts = {},
  rot = 0,
) {
  const r = Math.max(rx, ry);
  fill(ctx, ellipse(cx, cy, rx, ry, rot), { x: cx - r, y: cy - r, w: r * 2, h: r * 2 }, m, o);
}

/** Flat fill (no shading) with optional outline. */
export function flat(
  ctx: CanvasRenderingContext2D,
  path: PathFn,
  color: string,
  ol = 0,
  olColor = INK_COLOR,
): void {
  ctx.save();
  ctx.beginPath();
  path(ctx);
  ctx.fillStyle = color;
  ctx.fill();
  if (ol > 0) {
    ctx.strokeStyle = olColor;
    ctx.lineWidth = ol;
    ctx.stroke();
  }
  ctx.restore();
}

/** Tapered ink line. */
export function line(
  ctx: CanvasRenderingContext2D,
  pts: readonly Pt[],
  w = 2,
  color = INK_COLOR,
  taper: [number, number] = [0.25, 0.25],
): void {
  inkStroke(ctx, pts, w, color, taper);
}

/** Uniform stroke (seams, straps edges). */
export function stroke(
  ctx: CanvasRenderingContext2D,
  pts: readonly Pt[],
  w: number,
  color = INK_COLOR,
  alpha = 1,
): void {
  const [first, ...rest] = pts;
  if (!first) return;
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.strokeStyle = color;
  ctx.lineWidth = w;
  ctx.beginPath();
  ctx.moveTo(first[0], first[1]);
  for (const p of rest) ctx.lineTo(p[0], p[1]);
  ctx.stroke();
  ctx.restore();
}

/** Clip subsequent drawing to a path. */
export function clipTo(ctx: CanvasRenderingContext2D, path: PathFn, draw: () => void): void {
  ctx.save();
  ctx.beginPath();
  path(ctx);
  ctx.clip();
  draw();
  ctx.restore();
}

/** Cross-hatch a region (clipped to path). */
export function crossHatch(
  ctx: CanvasRenderingContext2D,
  path: PathFn,
  box: Box,
  spacing = 4,
  alpha = 0.4,
  cross = true,
  color = INK_COLOR,
): void {
  clipTo(ctx, path, () => {
    ctx.strokeStyle = color;
    ctx.globalAlpha = alpha;
    ctx.lineWidth = 1;
    ctx.beginPath();
    const { x, y, w, h } = box;
    for (let i = -h; i < w + h; i += spacing) {
      ctx.moveTo(x + i, y);
      ctx.lineTo(x + i - h, y + h);
      if (cross) {
        ctx.moveTo(x + i - h, y);
        ctx.lineTo(x + i, y + h);
      }
    }
    ctx.stroke();
  });
}

/** Soft shadow wash (multiply-ish darkening) inside a path. */
export function wash(
  ctx: CanvasRenderingContext2D,
  path: PathFn,
  color: string,
  alpha: number,
): void {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.beginPath();
  path(ctx);
  ctx.fillStyle = color;
  ctx.fill();
  ctx.restore();
}

export const STEEL = matR(RAMPS.steel, 3, RIM_HOT);
export const STEEL_DARK = matR(RAMPS.steel, 2);
export const BRASS = mat(RAMPS.lamp[0], RAMPS.lamp[1], RAMPS.lamp[2], RAMPS.lamp[4], RIM_HOT);
export const LEATHER = matR(RAMPS.leather, 3);
export const LEATHER_DARK = matR(RAMPS.leather, 2);
export const WOOD = mat("#1d120b", "#3d2617", "#6a4428", "#946640");
export const BONE = matR(RAMPS.bone, 4);
export const RAG = matR(RAMPS.rust, 3, RIM_HOT);

export function rivet(ctx: CanvasRenderingContext2D, x: number, y: number, r = 2.2, hot = false) {
  ctx.save();
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fillStyle = hot ? RAMPS.lamp[3] : RAMPS.steel[4];
  ctx.fill();
  ctx.lineWidth = 1.1;
  ctx.strokeStyle = INK_COLOR;
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(x + r * 0.3, y - r * 0.35, r * 0.4, 0, Math.PI * 2);
  ctx.fillStyle = RAMPS.lamp[5];
  ctx.fill();
  ctx.restore();
}

/** Stitch ticks along a polyline. */
export function stitches(
  ctx: CanvasRenderingContext2D,
  pts: readonly Pt[],
  spacing = 5,
  len = 2.6,
  color = INK_COLOR,
  alpha = 0.7,
): void {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.globalAlpha = alpha;
  ctx.lineWidth = 1.1;
  ctx.beginPath();
  for (let i = 0; i + 1 < pts.length; i++) {
    const a = pts[i] as Pt;
    const b = pts[i + 1] as Pt;
    const dx = b[0] - a[0];
    const dy = b[1] - a[1];
    const d = Math.hypot(dx, dy);
    if (d < 0.01) continue;
    const nx = -dy / d;
    const ny = dx / d;
    for (let t = spacing / 2; t < d; t += spacing) {
      const x = a[0] + (dx * t) / d;
      const y = a[1] + (dy * t) / d;
      ctx.moveTo(x - nx * len * 0.5 - (dx / d) * 0.8, y - ny * len * 0.5 - (dy / d) * 0.8);
      ctx.lineTo(x + nx * len * 0.5 + (dx / d) * 0.8, y + ny * len * 0.5 + (dy / d) * 0.8);
    }
  }
  ctx.stroke();
  ctx.restore();
}

/** Rectangular buckle. */
export function buckle(ctx: CanvasRenderingContext2D, x: number, y: number, w = 8, h = 9) {
  ctx.save();
  ctx.lineWidth = 2.6;
  ctx.strokeStyle = INK_COLOR;
  ctx.strokeRect(x - w / 2, y - h / 2, w, h);
  ctx.lineWidth = 1.5;
  ctx.strokeStyle = RAMPS.lamp[2];
  ctx.strokeRect(x - w / 2, y - h / 2, w, h);
  ctx.strokeStyle = RAMPS.lamp[4];
  ctx.beginPath();
  ctx.moveTo(x - w / 2 + 1, y - h / 2);
  ctx.lineTo(x + w / 2 - 1, y - h / 2);
  ctx.stroke();
  ctx.strokeStyle = INK_COLOR;
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  ctx.moveTo(x, y - h / 2);
  ctx.lineTo(x, y + h / 2);
  ctx.stroke();
  ctx.restore();
}

/** Strap: a band between two points (width w) with edge stitching. */
export function strap(
  ctx: CanvasRenderingContext2D,
  a: Pt,
  b: Pt,
  w: number,
  m: Mat,
  o: { stitch?: boolean; ol?: number } = {},
): void {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const d = Math.hypot(dx, dy) || 1;
  const nx = (-dy / d) * (w / 2);
  const ny = (dx / d) * (w / 2);
  const pts: Pt[] = [
    [a[0] + nx, a[1] + ny],
    [b[0] + nx, b[1] + ny],
    [b[0] - nx, b[1] - ny],
    [a[0] - nx, a[1] - ny],
  ];
  fpoly(ctx, pts, m, { ol: o.ol ?? 2, hatch: false, depth: w * 0.45 });
  if (o.stitch !== false && d > 12) {
    const k = 0.62;
    stitches(
      ctx,
      [
        [a[0] + nx * k, a[1] + ny * k],
        [b[0] + nx * k, b[1] + ny * k],
      ],
      5,
      1.6,
      m.light,
      0.55,
    );
  }
}

/** Pouch with flap. */
export function pouch(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  m: Mat,
  ol = 2.4,
): void {
  fblob(
    ctx,
    [
      [x, y],
      [x + w, y],
      [x + w + 1, y + h * 0.7],
      [x + w - 2, y + h],
      [x + 2, y + h],
      [x - 1, y + h * 0.7],
    ],
    m,
    { ol, hatch: false },
    0.2,
  );
  fpoly(
    ctx,
    [
      [x - 1, y - 1],
      [x + w + 1, y - 1],
      [x + w, y + h * 0.45],
      [x + w / 2, y + h * 0.55],
      [x, y + h * 0.45],
    ],
    tintMat(m, COLD, 0.15),
    { ol: ol * 0.85, hatch: false, light: false },
  );
  rivet(ctx, x + w / 2, y + h * 0.42, 1.5);
}

/** Scratches on metal: thin pale nicks with a dark under-line. */
export function scratches(
  ctx: CanvasRenderingContext2D,
  rnd: () => number,
  box: Box,
  n: number,
  pale: string = "#c4d3e6",
): void {
  for (let i = 0; i < n; i++) {
    const x = box.x + rnd() * box.w;
    const y = box.y + rnd() * box.h;
    const a = -0.6 + rnd() * 1.2 + (rnd() < 0.5 ? 0 : Math.PI / 2);
    const l = 3 + rnd() * 7;
    const p: Pt[] = [
      [x, y],
      [x + Math.cos(a) * l * 0.5, y + Math.sin(a) * l * 0.5 + 0.6],
      [x + Math.cos(a) * l, y + Math.sin(a) * l],
    ];
    line(ctx, p.map(([px, py]) => [px + 0.8, py + 0.8] as Pt), 1.4, withAlpha(INK_COLOR, 0.55));
    line(ctx, p, 1.2, withAlpha(pale, 0.75));
  }
}

/**
 * Ragged hem: points from (x0,y) to (x1,y) with seeded tears (for polygons, append to a
 * shape outline). amp = max tear depth.
 */
export function ragged(
  rnd: () => number,
  x0: number,
  x1: number,
  y: number,
  amp: number,
  step = 7,
  slope = 0,
): Pt[] {
  const out: Pt[] = [];
  const n = Math.max(2, Math.round(Math.abs(x1 - x0) / step));
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const x = x0 + (x1 - x0) * t;
    const tear = i % 2 === 1 ? amp * (0.35 + rnd() * 0.65) : rnd() * amp * 0.25;
    out.push([x + (rnd() - 0.5) * step * 0.4, y + slope * t + tear]);
  }
  return out;
}

/** Fold/crease lines: short tapered strokes. */
export function folds(
  ctx: CanvasRenderingContext2D,
  strokes: readonly (readonly Pt[])[],
  w = 1.8,
  color = INK_COLOR,
): void {
  for (const s of strokes) line(ctx, s, w, color, [0.35, 0.5]);
}

/** A highlight glint (small bright tapered stroke). */
export function glint(ctx: CanvasRenderingContext2D, pts: readonly Pt[], w = 1.8, color: string = RAMPS.lamp[5]) {
  line(ctx, pts, w, withAlpha(color, 0.9), [0.4, 0.4]);
}

/** Soft radial light baked into a canvas (FX, lantern cores). */
export function softGlow(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  r: number,
  color: string,
  alpha = 0.8,
  hard = 0.25,
): void {
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, withAlpha(color, alpha));
  g.addColorStop(hard, withAlpha(color, alpha * 0.55));
  g.addColorStop(1, withAlpha(color, 0));
  ctx.save();
  ctx.fillStyle = g;
  ctx.fillRect(x - r, y - r, r * 2, r * 2);
  ctx.restore();
}

// ---------------------------------------------------------------------------
// Parts
// ---------------------------------------------------------------------------

export interface PartSpec {
  id: string;
  /** Extra drawing scale for this part (canvas, pivot and drawing scale together). */
  ks?: number;
  w: number;
  h: number;
  pivot: Pt;
  parent: string | null;
  at: Pt;
  z: number;
  draw: (ctx: CanvasRenderingContext2D) => void;
}

/** Skeleton-only part (no pixels) used to solve poses before rasterizing. */
export function bonePart(s: PartSpec): RigPart {
  const ks = s.ks ?? 1;
  return {
    id: s.id,
    canvas: DUMMY,
    pivot: [s.pivot[0] * ks, s.pivot[1] * ks],
    parent: s.parent,
    at: s.at,
    z: s.z,
  };
}
const DUMMY =
  typeof document !== "undefined" ? canvas(1, 1) : (null as unknown as HTMLCanvasElement);

/** Rasterize a part at build scale `k`. */
export function makePart(s: PartSpec, k: number): RigPart {
  const ks = s.ks ?? 1;
  const c = canvas(s.w * k * ks, s.h * k * ks);
  const ctx = ctx2d(c);
  ctx.scale(k * ks, k * ks);
  s.draw(ctx);
  return {
    id: s.id,
    canvas: c,
    pivot: [s.pivot[0] * k * ks, s.pivot[1] * k * ks],
    parent: s.parent,
    at: [s.at[0] * k, s.at[1] * k],
    z: s.z,
  };
}

export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export const lp = (a: Pt, b: Pt, t: number): Pt => [lerp(a[0], b[0], t), lerp(a[1], b[1], t)];
export const add = (a: Pt, x: number, y: number): Pt => [a[0] + x, a[1] + y];
