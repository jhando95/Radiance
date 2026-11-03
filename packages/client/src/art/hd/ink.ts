/**
 * Ink: a small Canvas2D toolkit for Radiance's HD "gothic ink" illustration style.
 *
 * Style rules (shared by every HD artist module):
 * - Bold, slightly irregular black ink contours (INK_COLOR), heavier on the shadow side.
 * - Flat base colours from palette ramps, cel-shaded with 2–3 hard-edged tones.
 * - Shadows get cross-hatching; deepest shadows go near-black (chiaroscuro).
 * - A warm amber lamp rim-light on the side facing the squad's lamp (`rimSide`).
 * - Exaggerated, readable silhouettes. Everything is drawn in RENDER pixels (1080p).
 *
 * All drawing is deterministic (use `seeded()` for any jitter, never Math.random).
 */

export const INK_COLOR = "#0b0810";

export type Pt = readonly [number, number];

/** Deterministic PRNG (mulberry32). */
export function seeded(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function canvas(w: number, h: number): HTMLCanvasElement {
  const c = document.createElement("canvas");
  c.width = Math.max(1, Math.ceil(w));
  c.height = Math.max(1, Math.ceil(h));
  return c;
}

export function ctx2d(c: HTMLCanvasElement): CanvasRenderingContext2D {
  const ctx = c.getContext("2d");
  if (!ctx) throw new Error("2D canvas unavailable");
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  return ctx;
}

// ---------------------------------------------------------------------------
// Paths
// ---------------------------------------------------------------------------

export type PathFn = (ctx: CanvasRenderingContext2D) => void;

/** Smooth closed curve through points (Catmull-Rom → Bézier). tension 0..1 */
export function blob(points: readonly Pt[], tension = 0.5): PathFn {
  return (ctx) => {
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
}

/** Straight-edged polygon (hard armour plates, blades). */
export function poly(points: readonly Pt[]): PathFn {
  return (ctx) => {
    const [first, ...rest] = points;
    if (!first) return;
    ctx.moveTo(first[0], first[1]);
    for (const q of rest) ctx.lineTo(q[0], q[1]);
    ctx.closePath();
  };
}

/** Tapered limb from (x1,y1) radius r1 to (x2,y2) radius r2. */
export function capsule(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  r1: number,
  r2: number,
): PathFn {
  return (ctx) => {
    const a = Math.atan2(y2 - y1, x2 - x1);
    const n = a + Math.PI / 2;
    ctx.moveTo(x1 + Math.cos(n) * r1, y1 + Math.sin(n) * r1);
    ctx.lineTo(x2 + Math.cos(n) * r2, y2 + Math.sin(n) * r2);
    ctx.arc(x2, y2, r2, n, n - Math.PI, true);
    ctx.lineTo(x1 - Math.cos(n) * r1, y1 - Math.sin(n) * r1);
    ctx.arc(x1, y1, r1, n + Math.PI, n, true);
    ctx.closePath();
  };
}

export function ellipse(cx: number, cy: number, rx: number, ry: number, rot = 0): PathFn {
  return (ctx) => {
    ctx.ellipse(cx, cy, rx, ry, rot, 0, Math.PI * 2);
  };
}

// ---------------------------------------------------------------------------
// Shaded, inked shapes
// ---------------------------------------------------------------------------

export interface ShapeStyle {
  /** Base colour. */
  fill: string;
  /** Cel shadow colour (hard edge). Light comes from upper-left by default. */
  shade?: string;
  /** Deep shadow colour (second, smaller cel band). */
  deep?: string;
  /** Highlight colour (small hard-edged band on the lit side). */
  light?: string;
  /** Light direction in radians (default: from upper-left, -2.4). */
  lightAngle?: number;
  /** How far the shadow band reaches into the shape (px). */
  shadeDepth?: number;
  /** Cross-hatching in the shadow band. */
  hatch?: { spacing?: number; color?: string; alpha?: number; width?: number };
  /** Warm rim light on one side (1 = right edge, -1 = left edge). */
  rim?: { side: 1 | -1; color: string; width?: number };
  /** Ink outline width in px (0 = none). */
  outline?: number;
  outlineColor?: string;
  /** Optional texture: speckles for grime/rust/stone. */
  grain?: { color: string; alpha?: number; density?: number; seed?: number };
}

/**
 * Draw a filled, cel-shaded, optionally hatched and rim-lit shape with an ink outline.
 * Bounds (bx,by,bw,bh) only bound the hatching/grain work; pass the shape's rough box.
 */
export function shape(
  ctx: CanvasRenderingContext2D,
  path: PathFn,
  style: ShapeStyle,
  bounds: { x: number; y: number; w: number; h: number },
): void {
  const { x, y, w, h } = bounds;
  const ang = style.lightAngle ?? -2.4;
  const dx = Math.cos(ang);
  const dy = Math.sin(ang);
  const depth = style.shadeDepth ?? Math.max(4, Math.min(w, h) * 0.32);

  ctx.save();
  ctx.beginPath();
  path(ctx);
  ctx.fillStyle = style.fill;
  ctx.fill();
  ctx.clip();

  // Cel shadow: everything not covered by the shape shifted toward the light.
  const band = (color: string, d: number) => {
    ctx.save();
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.rect(x - 4, y - 4, w + 8, h + 8);
    ctx.translate(dx * d, dy * d);
    path(ctx);
    ctx.fill("evenodd");
    ctx.restore();
  };
  if (style.shade) band(style.shade, depth);
  if (style.deep) band(style.deep, depth * 0.45);

  // Hatching inside the shadow band.
  if (style.hatch && style.shade) {
    ctx.save();
    ctx.beginPath();
    ctx.rect(x - 4, y - 4, w + 8, h + 8);
    ctx.translate(dx * depth * 0.7, dy * depth * 0.7);
    path(ctx);
    ctx.translate(-dx * depth * 0.7, -dy * depth * 0.7);
    ctx.clip("evenodd");
    ctx.strokeStyle = style.hatch.color ?? INK_COLOR;
    ctx.globalAlpha = style.hatch.alpha ?? 0.35;
    ctx.lineWidth = style.hatch.width ?? 1.4;
    const s = style.hatch.spacing ?? 6;
    ctx.beginPath();
    for (let i = -h; i < w + h; i += s) {
      ctx.moveTo(x + i, y);
      ctx.lineTo(x + i - h, y + h);
    }
    ctx.stroke();
    ctx.restore();
  }

  // Highlight band on the lit side (the shadow trick mirrored toward the light).
  if (style.light) band(style.light, -depth * 0.3);

  if (style.grain) {
    const rnd = seeded(style.grain.seed ?? 7);
    ctx.fillStyle = style.grain.color;
    ctx.globalAlpha = style.grain.alpha ?? 0.25;
    const count = Math.round(w * h * (style.grain.density ?? 0.004));
    for (let i = 0; i < count; i++) {
      const r = 0.6 + rnd() * 1.6;
      ctx.beginPath();
      ctx.arc(x + rnd() * w, y + rnd() * h, r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  // Rim light: a thin bright band along one vertical side.
  if (style.rim) {
    const rw = style.rim.width ?? Math.max(2, w * 0.08);
    ctx.save();
    ctx.globalCompositeOperation = "source-atop";
    ctx.fillStyle = style.rim.color;
    ctx.beginPath();
    ctx.rect(x - 4, y - 4, w + 8, h + 8);
    ctx.translate(-style.rim.side * rw, 0);
    path(ctx);
    ctx.fill("evenodd");
    ctx.restore();
  }
  ctx.restore();

  // Ink contour.
  if ((style.outline ?? 3) > 0) {
    ctx.save();
    ctx.beginPath();
    path(ctx);
    ctx.strokeStyle = style.outlineColor ?? INK_COLOR;
    ctx.lineWidth = style.outline ?? 3;
    ctx.lineJoin = "round";
    ctx.stroke();
    ctx.restore();
  }
}

/** Tapered ink stroke along points (hair strands, cloth folds, cracks). */
export function inkStroke(
  ctx: CanvasRenderingContext2D,
  points: readonly Pt[],
  width: number,
  color = INK_COLOR,
  taper: [number, number] = [0.2, 0.2],
): void {
  if (points.length < 2) return;
  ctx.save();
  ctx.fillStyle = color;
  const n = points.length;
  const left: Pt[] = [];
  const right: Pt[] = [];
  for (let i = 0; i < n; i++) {
    const p = points[i] as Pt;
    const prev = points[Math.max(0, i - 1)] as Pt;
    const next = points[Math.min(n - 1, i + 1)] as Pt;
    const a = Math.atan2(next[1] - prev[1], next[0] - prev[0]) + Math.PI / 2;
    const t = i / (n - 1);
    const k = Math.min(1, t / Math.max(0.001, taper[0]), (1 - t) / Math.max(0.001, taper[1]));
    const r = (width / 2) * Math.max(0.15, k);
    left.push([p[0] + Math.cos(a) * r, p[1] + Math.sin(a) * r]);
    right.push([p[0] - Math.cos(a) * r, p[1] - Math.sin(a) * r]);
  }
  ctx.beginPath();
  const all = [...left, ...right.reverse()];
  ctx.moveTo((all[0] as Pt)[0], (all[0] as Pt)[1]);
  for (const q of all.slice(1)) ctx.lineTo(q[0], q[1]);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

/** Soft additive glow (lamps, magic, eyes). */
export function glow(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  r: number,
  color: string,
  alpha = 0.7,
): void {
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, withAlpha(color, alpha));
  g.addColorStop(0.35, withAlpha(color, alpha * 0.45));
  g.addColorStop(1, withAlpha(color, 0));
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  ctx.fillStyle = g;
  ctx.fillRect(x - r, y - r, r * 2, r * 2);
  ctx.restore();
}

export function withAlpha(hex: string, a: number): string {
  const n = Number.parseInt(hex.slice(1, 7), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}

/** Linear blend of two hex colours. */
export function mixHex(a: string, b: string, t: number): string {
  const pa = Number.parseInt(a.slice(1, 7), 16);
  const pb = Number.parseInt(b.slice(1, 7), 16);
  const ch = (s: number) => {
    const ca = (pa >> s) & 255;
    const cb = (pb >> s) & 255;
    return Math.round(ca + (cb - ca) * t);
  };
  return `#${[16, 8, 0].map((s) => ch(s).toString(16).padStart(2, "0")).join("")}`;
}
