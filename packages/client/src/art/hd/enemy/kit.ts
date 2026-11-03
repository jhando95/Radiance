/**
 * Enemy toolkit: creature-specific additions on top of ../ink.ts.
 *
 * Lighting for every enemy (rigs face RIGHT; the game flips them to face the squad):
 * - Key light from the upper FRONT (+x): the squad's lamps are in front of the creature.
 * - Shadow bands fall on the back/lower side, hatched, deepest tones near-black.
 * - Cold violet rim on the back edge (separates dark bodies from dark backdrops) and a thin
 *   warm amber kiss on the front edge.
 * - Contours are heavier on the shadow side (an offset ink "underlay").
 *
 * Authoring: parts are drawn in LOCAL coordinates with the joint pivot at (0,0); `box` gives
 * the canvas extent around the pivot. A child's `at` is relative to its PARENT'S PIVOT (the
 * kit converts it to the parent-canvas coordinates RigPart expects).
 */
import { RAMPS } from "../../palette";
import { canvas, ctx2d, INK_COLOR, inkStroke, type PathFn, type Pt, withAlpha } from "../ink";
import type { RigGlow, RigPart } from "../rig";

export { INK_COLOR };

/** Direction toward the key light (upper front). */
export const LIGHT_ANGLE = -0.95;
const LX = Math.cos(LIGHT_ANGLE);
const LY = Math.sin(LIGHT_ANGLE);

export const COLD_RIM = "#8e7fc6";
export const WARM_RIM = RAMPS.lamp[3];

export type Box = { x: number; y: number; w: number; h: number };

/** A path plus its bounding box. */
export interface Shp {
  path: PathFn;
  b: Box;
}

function boxOf(points: readonly Pt[], pad = 0): Box {
  let x0 = Number.POSITIVE_INFINITY;
  let y0 = Number.POSITIVE_INFINITY;
  let x1 = Number.NEGATIVE_INFINITY;
  let y1 = Number.NEGATIVE_INFINITY;
  for (const [x, y] of points) {
    x0 = Math.min(x0, x);
    y0 = Math.min(y0, y);
    x1 = Math.max(x1, x);
    y1 = Math.max(y1, y);
  }
  return { x: x0 - pad, y: y0 - pad, w: x1 - x0 + pad * 2, h: y1 - y0 + pad * 2 };
}

/** Smooth closed curve (Catmull-Rom). */
export function sblob(points: readonly Pt[], tension = 0.5): Shp {
  const path: PathFn = (ctx) => {
    const n = points.length;
    if (n < 3) return;
    const p = (i: number) => points[((i % n) + n) % n] as Pt;
    ctx.moveTo(p(0)[0], p(0)[1]);
    for (let i = 0; i < n; i++) {
      const p0 = p(i - 1);
      const p1 = p(i);
      const p2 = p(i + 1);
      const p3 = p(i + 2);
      const t = tension / 3;
      ctx.bezierCurveTo(
        p1[0] + (p2[0] - p0[0]) * t,
        p1[1] + (p2[1] - p0[1]) * t,
        p2[0] - (p3[0] - p1[0]) * t,
        p2[1] - (p3[1] - p1[1]) * t,
        p2[0],
        p2[1],
      );
    }
    ctx.closePath();
  };
  return { path, b: boxOf(points, 8) };
}

/** Straight-edged polygon. */
export function spoly(points: readonly Pt[]): Shp {
  const path: PathFn = (ctx) => {
    const [first, ...rest] = points;
    if (!first) return;
    ctx.moveTo(first[0], first[1]);
    for (const q of rest) ctx.lineTo(q[0], q[1]);
    ctx.closePath();
  };
  return { path, b: boxOf(points, 2) };
}

/** Tapered limb. */
export function scaps(x1: number, y1: number, x2: number, y2: number, r1: number, r2: number): Shp {
  const path: PathFn = (ctx) => {
    const a = Math.atan2(y2 - y1, x2 - x1);
    const n = a + Math.PI / 2;
    ctx.moveTo(x1 + Math.cos(n) * r1, y1 + Math.sin(n) * r1);
    ctx.lineTo(x2 + Math.cos(n) * r2, y2 + Math.sin(n) * r2);
    ctx.arc(x2, y2, r2, n, n - Math.PI, true);
    ctx.lineTo(x1 - Math.cos(n) * r1, y1 - Math.sin(n) * r1);
    ctx.arc(x1, y1, r1, n + Math.PI, n, true);
    ctx.closePath();
  };
  const r = Math.max(r1, r2);
  return {
    path,
    b: {
      x: Math.min(x1, x2) - r,
      y: Math.min(y1, y2) - r,
      w: Math.abs(x2 - x1) + r * 2,
      h: Math.abs(y2 - y1) + r * 2,
    },
  };
}

export function sell(cx: number, cy: number, rx: number, ry: number, rot = 0): Shp {
  const path: PathFn = (ctx) => {
    ctx.ellipse(cx, cy, rx, ry, rot, 0, Math.PI * 2);
  };
  const r = Math.max(rx, ry);
  return { path, b: { x: cx - r, y: cy - r, w: r * 2, h: r * 2 } };
}

/**
 * A limb/tentacle outline along a spine with per-point radius (smooth, tapered). Great for
 * legs, tails, tendrils and worm bodies.
 */
export function stube(spine: readonly Pt[], radii: readonly number[], tension = 0.5): Shp {
  const n = spine.length;
  const left: Pt[] = [];
  const right: Pt[] = [];
  for (let i = 0; i < n; i++) {
    const p = spine[i] as Pt;
    const prev = spine[Math.max(0, i - 1)] as Pt;
    const next = spine[Math.min(n - 1, i + 1)] as Pt;
    const a = Math.atan2(next[1] - prev[1], next[0] - prev[0]) + Math.PI / 2;
    const r = radii[Math.min(radii.length - 1, i)] ?? 4;
    left.push([p[0] + Math.cos(a) * r, p[1] + Math.sin(a) * r]);
    right.push([p[0] - Math.cos(a) * r, p[1] - Math.sin(a) * r]);
  }
  const last = spine[n - 1] as Pt;
  const first = spine[0] as Pt;
  const pts: Pt[] = [...left, last, ...right.reverse(), first];
  // Drop duplicate-ish cap points if the radius is ~0 there.
  return sblob(pts, tension);
}

// ---------------------------------------------------------------------------
// Creature shape: cel bands, hatching, dual rim, weighted contour.
// ---------------------------------------------------------------------------

export interface CStyle {
  fill: string;
  shade?: string;
  deep?: string;
  light?: string;
  /** Shadow band depth in px (default from shape size). */
  depth?: number;
  /** Override light direction (radians, direction TOWARD the light). */
  lightAngle?: number;
  hatch?: boolean | { spacing?: number; alpha?: number; width?: number; cross?: boolean };
  grain?: { color: string; alpha?: number; density?: number; seed?: number; size?: number };
  /** Cold back rim colour (false = none). */
  rimBack?: string | false;
  rimBackW?: number;
  /** Warm front rim colour (false = none). */
  rimFront?: string | false;
  rimFrontW?: number;
  outline?: number;
  /** Extra contour thickness on the shadow side (px). */
  weight?: number;
  /** Extra detail drawn clipped inside the shape (after cel bands, before rims). */
  detail?: (ctx: CanvasRenderingContext2D) => void;
}

export function cshape(ctx: CanvasRenderingContext2D, s: Shp, st: CStyle): void {
  const { path } = s;
  const { x, y, w, h } = s.b;
  const ang = st.lightAngle ?? LIGHT_ANGLE;
  const lx = st.lightAngle === undefined ? LX : Math.cos(ang);
  const ly = st.lightAngle === undefined ? LY : Math.sin(ang);
  const depth = st.depth ?? Math.max(4, Math.min(w, h) * 0.3);
  const outline = st.outline ?? 3.5;
  const weight = st.weight ?? outline * 0.6;

  // Heavier contour on the shadow side.
  if (outline > 0 && weight > 0) {
    ctx.save();
    ctx.translate(-lx * weight, -ly * weight);
    ctx.beginPath();
    path(ctx);
    ctx.fillStyle = INK_COLOR;
    ctx.fill();
    ctx.lineWidth = outline;
    ctx.strokeStyle = INK_COLOR;
    ctx.stroke();
    ctx.restore();
  }

  ctx.save();
  ctx.beginPath();
  path(ctx);
  ctx.fillStyle = st.fill;
  ctx.fill();
  ctx.clip();

  const band = (color: string, d: number, dirx = lx, diry = ly) => {
    ctx.save();
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.rect(x - 40, y - 40, w + 80, h + 80);
    ctx.translate(dirx * d, diry * d);
    path(ctx);
    ctx.fill("evenodd");
    ctx.restore();
  };
  if (st.shade) band(st.shade, depth);
  if (st.deep) band(st.deep, depth * 0.45);

  if (st.hatch && st.shade) {
    const hs = typeof st.hatch === "object" ? st.hatch : {};
    ctx.save();
    ctx.beginPath();
    ctx.rect(x - 40, y - 40, w + 80, h + 80);
    ctx.translate(lx * depth * 0.72, ly * depth * 0.72);
    path(ctx);
    ctx.translate(-lx * depth * 0.72, -ly * depth * 0.72);
    ctx.clip("evenodd");
    ctx.strokeStyle = INK_COLOR;
    ctx.globalAlpha = hs.alpha ?? 0.4;
    ctx.lineWidth = hs.width ?? 1.3;
    const sp = hs.spacing ?? 5;
    ctx.beginPath();
    for (let i = -h; i < w + h; i += sp) {
      ctx.moveTo(x + i, y);
      ctx.lineTo(x + i - h, y + h);
    }
    if (hs.cross) {
      for (let i = -h; i < w + h; i += sp * 1.6) {
        ctx.moveTo(x + i - h, y);
        ctx.lineTo(x + i, y + h);
      }
    }
    ctx.stroke();
    ctx.restore();
  }

  if (st.light) band(st.light, -depth * 0.28);

  if (st.grain) {
    const g = st.grain;
    const rnd = rng(g.seed ?? 7);
    ctx.fillStyle = g.color;
    ctx.globalAlpha = g.alpha ?? 0.25;
    const count = Math.round(w * h * (g.density ?? 0.004));
    const sz = g.size ?? 1.6;
    for (let i = 0; i < count; i++) {
      const r = 0.5 + rnd() * sz;
      ctx.beginPath();
      ctx.arc(x + rnd() * w, y + rnd() * h, r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  if (st.detail) {
    ctx.save();
    st.detail(ctx);
    ctx.restore();
  }

  const rimBack = st.rimBack === undefined ? COLD_RIM : st.rimBack;
  if (rimBack) {
    const rw = st.rimBackW ?? Math.max(1.5, Math.min(3.2, w * 0.04));
    ctx.save();
    ctx.globalAlpha = 0.7;
    band(rimBack, rw, 0.94, 0.34);
    ctx.restore();
  }
  const rimFront = st.rimFront === undefined ? WARM_RIM : st.rimFront;
  if (rimFront) {
    const rw = st.rimFrontW ?? Math.max(1.2, Math.min(2.5, w * 0.025));
    ctx.save();
    ctx.globalAlpha = 0.5;
    band(rimFront, rw, -0.97, 0.24);
    ctx.restore();
  }
  ctx.restore();

  if (outline > 0) {
    ctx.save();
    ctx.beginPath();
    path(ctx);
    ctx.strokeStyle = INK_COLOR;
    ctx.lineWidth = outline;
    ctx.stroke();
    ctx.restore();
  }
}

/** Ramp → style shortcut: [deep, shade, fill, light] from a palette ramp start index. */
export function rampStyle(ramp: readonly string[], base: number, extra: Partial<CStyle> = {}): CStyle {
  const g = (i: number) => ramp[Math.max(0, Math.min(ramp.length - 1, i))] as string;
  return {
    fill: g(base),
    shade: g(base - 1),
    deep: g(base - 2),
    light: g(base + 1),
    hatch: true,
    ...extra,
  };
}

// ---------------------------------------------------------------------------
// Detail helpers
// ---------------------------------------------------------------------------

export function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Tapered ink line through points. */
export function line(
  ctx: CanvasRenderingContext2D,
  pts: readonly Pt[],
  width: number,
  color: string = INK_COLOR,
  taper: [number, number] = [0.25, 0.25],
  alpha = 1,
): void {
  ctx.save();
  ctx.globalAlpha = alpha;
  inkStroke(ctx, pts, width, color, taper);
  ctx.restore();
}

/** Jagged branching crack from (x,y) heading `ang` (radians). */
export function crack(
  ctx: CanvasRenderingContext2D,
  rnd: () => number,
  x: number,
  y: number,
  ang: number,
  len: number,
  width: number,
  color: string = INK_COLOR,
  depth = 2,
): void {
  const pts: Pt[] = [[x, y]];
  let cx = x;
  let cy = y;
  let a = ang;
  const steps = 4 + Math.floor(rnd() * 3);
  for (let i = 0; i < steps; i++) {
    a += (rnd() - 0.5) * 0.9;
    const l = (len / steps) * (0.7 + rnd() * 0.6);
    cx += Math.cos(a) * l;
    cy += Math.sin(a) * l;
    pts.push([cx, cy]);
    if (depth > 0 && rnd() < 0.3) {
      crack(ctx, rnd, cx, cy, a + (rnd() < 0.5 ? -1 : 1) * (0.6 + rnd() * 0.6), len * 0.45, width * 0.7, color, depth - 1);
    }
  }
  line(ctx, pts, width, color, [0.05, 0.9]);
}

/** Short bright tapered highlight (wet sheen, glint on chitin/metal). */
export function glint(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  len: number,
  ang: number,
  color = "#f4ecff",
  width = 2.4,
  alpha = 0.85,
): void {
  const pts: Pt[] = [];
  for (let i = 0; i <= 4; i++) {
    const t = i / 4 - 0.5;
    const bend = Math.sin((i / 4) * Math.PI) * len * 0.12;
    pts.push([
      x + Math.cos(ang) * len * t - Math.sin(ang) * bend,
      y + Math.sin(ang) * len * t + Math.cos(ang) * bend,
    ]);
  }
  line(ctx, pts, width, color, [0.5, 0.5], alpha);
}

/** Hatching lines clipped to a path (for extra shadow passes). */
export function hatch(
  ctx: CanvasRenderingContext2D,
  s: Shp,
  ang: number,
  spacing: number,
  alpha = 0.35,
  width = 1.2,
  color: string = INK_COLOR,
): void {
  const { x, y, w, h } = s.b;
  ctx.save();
  ctx.beginPath();
  s.path(ctx);
  ctx.clip();
  ctx.strokeStyle = color;
  ctx.globalAlpha = alpha;
  ctx.lineWidth = width;
  const cx = x + w / 2;
  const cy = y + h / 2;
  const r = Math.hypot(w, h) / 2 + 4;
  const dx = Math.cos(ang);
  const dy = Math.sin(ang);
  ctx.beginPath();
  for (let o = -r; o <= r; o += spacing) {
    const px = cx - dy * o;
    const py = cy + dx * o;
    ctx.moveTo(px - dx * r, py - dy * r);
    ctx.lineTo(px + dx * r, py + dy * r);
  }
  ctx.stroke();
  ctx.restore();
}

/** Fill a path with a flat colour (no shading) — inner shadows, mouths, holes. */
export function flat(ctx: CanvasRenderingContext2D, s: Shp, color: string, alpha = 1): void {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = color;
  ctx.beginPath();
  s.path(ctx);
  ctx.fill();
  ctx.restore();
}

/** Stroke a path's contour only. */
export function contour(ctx: CanvasRenderingContext2D, s: Shp, width: number, color: string = INK_COLOR, alpha = 1): void {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.beginPath();
  s.path(ctx);
  ctx.stroke();
  ctx.restore();
}

/** Radial glow (additive). */
export function bloom(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  r: number,
  color: string,
  alpha = 0.7,
): void {
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, withAlpha(color, alpha));
  g.addColorStop(0.4, withAlpha(color, alpha * 0.4));
  g.addColorStop(1, withAlpha(color, 0));
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  ctx.fillStyle = g;
  ctx.fillRect(x - r, y - r, r * 2, r * 2);
  ctx.restore();
}

/** Glowing bioluminescent dot: halo + hot core + ink ring. */
export function lumDot(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  r: number,
  color: string,
  core = "#effffb",
): void {
  bloom(ctx, x, y, r * 3.2, color, 0.55);
  ctx.save();
  ctx.fillStyle = INK_COLOR;
  ctx.beginPath();
  ctx.arc(x, y, r + 1.4, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = core;
  ctx.beginPath();
  ctx.arc(x - r * 0.2, y - r * 0.2, r * 0.45, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

/** Glowing eye: dark socket, bright slit/almond and bloom. */
export function eye(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  rx: number,
  ry: number,
  color: string,
  core = "#ffffff",
  rot = 0,
  bloomR = 0,
): void {
  if (bloomR > 0) bloom(ctx, x, y, bloomR, color, 0.6);
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rot);
  ctx.fillStyle = INK_COLOR;
  ctx.beginPath();
  ctx.ellipse(0, 0, rx + 2.5, ry + 2.5, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = core;
  ctx.beginPath();
  ctx.ellipse(rx * 0.15, 0, rx * 0.5, ry * 0.5, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

/**
 * Faceted crystal shard from `base` to `tip`: a lit face and a shadow face split along the
 * axis, a bright inner edge, inked contour.
 */
export function shard(
  ctx: CanvasRenderingContext2D,
  base: Pt,
  tip: Pt,
  w: number,
  ramp: readonly string[] = RAMPS.crystal,
  outline = 3,
): void {
  const ax = tip[0] - base[0];
  const ay = tip[1] - base[1];
  const len = Math.hypot(ax, ay) || 1;
  const ux = ax / len;
  const uy = ay / len;
  const nx = -uy;
  const ny = ux;
  const shoulder: Pt = [base[0] + ux * len * 0.72, base[1] + uy * len * 0.72];
  const bl: Pt = [base[0] + nx * w, base[1] + ny * w];
  const br: Pt = [base[0] - nx * w, base[1] - ny * w];
  const sl: Pt = [shoulder[0] + nx * w * 0.85, shoulder[1] + ny * w * 0.85];
  const sr: Pt = [shoulder[0] - nx * w * 0.85, shoulder[1] - ny * w * 0.85];
  const mid: Pt = [base[0] + ux * len * 0.08, base[1] + uy * len * 0.08];
  // Which face is toward the light?
  const litLeft = nx * LX + ny * LY > 0;
  const g = (i: number) => ramp[i] as string;
  const faceA = spoly([bl, sl, tip, mid]);
  const faceB = spoly([br, sr, tip, mid]);
  ctx.save();
  ctx.lineJoin = "miter";
  // underlay contour
  ctx.fillStyle = INK_COLOR;
  ctx.strokeStyle = INK_COLOR;
  ctx.lineWidth = outline * 1.6;
  ctx.beginPath();
  spoly([bl, sl, tip, sr, br]).path(ctx);
  ctx.fill();
  ctx.stroke();
  flat(ctx, faceA, litLeft ? g(3) : g(1));
  flat(ctx, faceB, litLeft ? g(1) : g(3));
  // inner facet light near the tip and the dark root
  flat(ctx, spoly([litLeft ? sl : sr, tip, [shoulder[0], shoulder[1]]]), litLeft ? g(4) : g(4), 0.9);
  flat(ctx, spoly([bl, br, [base[0] + ux * len * 0.25, base[1] + uy * len * 0.25]]), g(0), 0.7);
  line(ctx, [mid, tip], Math.max(1.2, w * 0.18), g(5), [0.1, 0.5], 0.9);
  ctx.restore();
  contour(ctx, spoly([bl, sl, tip, sr, br]), outline);
}

/** A conical tooth/claw from base to tip (bone by default). */
export function fang(
  ctx: CanvasRenderingContext2D,
  base: Pt,
  tip: Pt,
  w: number,
  ramp: readonly string[] = RAMPS.bone,
  curve = 0.2,
  outline = 2,
): void {
  const ax = tip[0] - base[0];
  const ay = tip[1] - base[1];
  const len = Math.hypot(ax, ay) || 1;
  const nx = -ay / len;
  const ny = ax / len;
  const midx = base[0] + ax * 0.5 + nx * len * curve;
  const midy = base[1] + ay * 0.5 + ny * len * curve;
  const s: Shp = {
    path: (c) => {
      c.moveTo(base[0] + nx * w, base[1] + ny * w);
      c.quadraticCurveTo(midx + nx * w * 0.5, midy + ny * w * 0.5, tip[0], tip[1]);
      c.quadraticCurveTo(midx - nx * w * 0.5, midy - ny * w * 0.5, base[0] - nx * w, base[1] - ny * w);
      c.closePath();
    },
    b: boxOf([base, tip, [midx, midy]], w + 2),
  };
  cshape(ctx, s, {
    fill: ramp[4] as string,
    shade: ramp[2] as string,
    deep: ramp[1] as string,
    depth: w * 0.9,
    outline,
    weight: 0.8,
    rimBack: false,
    rimFront: false,
  });
}

// ---------------------------------------------------------------------------
// Parts
// ---------------------------------------------------------------------------

export interface PartSpec {
  id: string;
  parent?: string | null;
  /** Root coords for root parts; relative to the parent's PIVOT for child parts. */
  at: Pt;
  z: number;
  /** Canvas extent relative to the pivot: [x0, y0, x1, y1]. */
  box: readonly [number, number, number, number];
  draw: (ctx: CanvasRenderingContext2D) => void;
}

/** Build part canvases. `k` uniformly scales the whole creature (drawing, joints, boxes). */
export function assemble(specs: readonly PartSpec[], k = 1): RigPart[] {
  const pivots = new Map<string, Pt>();
  for (const s of specs) pivots.set(s.id, [-s.box[0] * k, -s.box[1] * k]);
  return specs.map((s) => {
    const [x0, y0, x1, y1] = s.box.map((v) => v * k) as [number, number, number, number];
    const c = canvas(x1 - x0, y1 - y0);
    const ctx = ctx2d(c);
    ctx.translate(-x0, -y0);
    ctx.scale(k, k);
    s.draw(ctx);
    const parent = s.parent ?? null;
    const pp = parent ? pivots.get(parent) : undefined;
    const at: Pt = pp ? [pp[0] + s.at[0] * k, pp[1] + s.at[1] * k] : [s.at[0] * k, s.at[1] * k];
    return { id: s.id, canvas: c, pivot: [-x0, -y0] as const, parent, at, z: s.z };
  });
}

/** A glow given in a part's LOCAL (pivot-relative) coordinates. */
export interface LocalGlow {
  part: string;
  x: number;
  y: number;
  radius: number;
  color: string;
  alpha?: number;
}

/** Convert pivot-relative glows to RigGlow (part canvas px). */
export function rigGlows(specs: readonly PartSpec[], glows: readonly LocalGlow[], k = 1): RigGlow[] {
  return glows.map((g) => {
    const s = specs.find((p) => p.id === g.part);
    return {
      ...g,
      x: (g.x - (s?.box[0] ?? 0)) * k,
      y: (g.y - (s?.box[1] ?? 0)) * k,
      radius: g.radius * k,
    };
  });
}

/** Soft ground contact shadow part (root, behind everything). */
export function shadowPart(rx: number, ry: number, alpha = 0.55, cx = 0): PartSpec {
  return {
    id: "shadow",
    at: [cx, 0],
    z: -100,
    box: [-rx - 4, -ry - 4, rx + 4, ry + 4],
    draw: (ctx) => {
      ctx.save();
      ctx.scale(1, ry / rx);
      const g = ctx.createRadialGradient(0, 0, 0, 0, 0, rx);
      g.addColorStop(0, withAlpha(RAMPS.void[0], alpha));
      g.addColorStop(0.6, withAlpha(RAMPS.void[0], alpha * 0.7));
      g.addColorStop(1, withAlpha(RAMPS.void[0], 0));
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(0, 0, rx, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    },
  };
}

/** Point along a polyline at fraction t (0..1) of its vertex count. */
export function lerpPt(a: Pt, b: Pt, t: number): Pt {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
}

/** Downward grime/rust drips (clip to a shape via CStyle.detail). */
export function streaks(
  ctx: CanvasRenderingContext2D,
  seed: number,
  x: number,
  y: number,
  w: number,
  h: number,
  n: number,
  color: string,
  alpha = 0.4,
  width = 2.2,
): void {
  const r = rng(seed);
  for (let i = 0; i < n; i++) {
    const sx = x + r() * w;
    const sy = y + r() * h * 0.6;
    const len = h * (0.15 + r() * 0.4);
    line(ctx, [[sx, sy], [sx + (r() - 0.5) * 3, sy + len * 0.5], [sx + (r() - 0.5) * 4, sy + len]], width * (0.6 + r() * 0.8), color, [0.1, 0.9], alpha);
  }
}

/** Scuffs: short dark nicks and a few pale scratches (worn metal/chitin). */
export function scuffs(
  ctx: CanvasRenderingContext2D,
  seed: number,
  x: number,
  y: number,
  w: number,
  h: number,
  n: number,
  pale = "#c9c3cf",
): void {
  const r = rng(seed);
  for (let i = 0; i < n; i++) {
    const sx = x + r() * w;
    const sy = y + r() * h;
    const a = r() * Math.PI;
    const l = 3 + r() * 8;
    const pts: Pt[] = [[sx, sy], [sx + Math.cos(a) * l, sy + Math.sin(a) * l]];
    if (r() < 0.6) line(ctx, pts, 1.6, INK_COLOR, [0.3, 0.3], 0.7);
    else line(ctx, pts, 1.2, pale, [0.3, 0.3], 0.45);
  }
}
