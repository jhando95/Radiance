/**
 * Icon kit: materials and inked motif primitives for the HD icons. Everything is drawn in
 * a 96-unit design space (the caller scales the context to the target size).
 */
import { INK_COLOR, type PathFn, type Pt, poly, shape, withAlpha } from "../ink";

export interface IM {
  fill: string;
  shade: string;
  deep: string;
  light: string;
  glow: string;
}

export const M = {
  steel: { fill: "#8a9fbf", shade: "#5a6f92", deep: "#364561", light: "#e2ebf6", glow: "#c4d3e6" },
  iron: { fill: "#5d7192", shade: "#3c4a66", deep: "#222b3d", light: "#a3b5cf", glow: "#8399ba" },
  gold: { fill: "#ffc95c", shade: "#e0902a", deep: "#a85a16", light: "#fff6d0", glow: "#ffd36e" },
  brass: { fill: "#e3a043", shade: "#a8601c", deep: "#6a3410", light: "#ffe08a", glow: "#f2a93b" },
  void: { fill: "#9f74de", shade: "#6a3fae", deep: "#3f1d70", light: "#e4d2ff", glow: "#a87fe2" },
  fire: { fill: "#f58a45", shade: "#cc4f28", deep: "#82261f", light: "#ffe08a", glow: "#f08a4b" },
  toxic: { fill: "#92d65a", shade: "#4f9a35", deep: "#2a5622", light: "#e2fbb0", glow: "#8fd25a" },
  blood: { fill: "#cc3a2c", shade: "#8a2420", deep: "#4d1518", light: "#f5866a", glow: "#e04a3a" },
  bone: { fill: "#dbd1bf", shade: "#a09584", deep: "#6f665c", light: "#f8f3ea", glow: "#ece4d4" },
  wood: { fill: "#8f6140", shade: "#5c3c28", deep: "#33221a", light: "#c0915f", glow: "#a77b52" },
  leather: { fill: "#a97c52", shade: "#7a5236", deep: "#4a3020", light: "#dcb487", glow: "#d2ab7f" },
  crystal: { fill: "#6fe0d7", shade: "#2ea5ad", deep: "#17697a", light: "#e8fffa", glow: "#6fe0d7" },
  rock: { fill: "#5e5b6d", shade: "#403d4c", deep: "#24222d", light: "#8a86a0", glow: "#666275" },
  cloth: { fill: "#a3304c", shade: "#6a1530", deep: "#3f0c1f", light: "#d9607a", glow: "#cf4a62" },
  flesh: { fill: "#b8665c", shade: "#7e3836", deep: "#4a1c1e", light: "#eca090", glow: "#e04a3a" },
  dark: { fill: "#3a3446", shade: "#25202e", deep: "#110e16", light: "#5e5672", glow: "#4a4458" },
  white: { fill: "#f4efe4", shade: "#c9bfae", deep: "#8a8070", light: "#ffffff", glow: "#ffffff" },
} as const satisfies Record<string, IM>;

/** Ink line weight multiplier (set per render size: thicker at small sizes). */
let inkMul = 1;
export function setInkWeight(m: number): void {
  inkMul = m;
}
export const inkW = (w: number): number => w * inkMul;

export interface PartOpts {
  depth?: number;
  outline?: number;
  hatch?: boolean;
  light?: number;
  noDeep?: boolean;
  sheen?: number;
}

const FULL = { x: -12, y: -12, w: 120, h: 120 };

/** A cel-shaded, gradient-sheened, ink-outlined part. */
export function part(ctx: CanvasRenderingContext2D, path: PathFn, m: IM, o: PartOpts = {}) {
  shape(
    ctx,
    path,
    {
      fill: m.fill,
      shade: m.shade,
      deep: o.noDeep ? undefined : m.deep,
      light: m.light,
      lightAngle: o.light ?? -2.3,
      shadeDepth: o.depth ?? 7,
      hatch: o.hatch ? { spacing: 3.2, alpha: 0.32, width: 0.9 } : undefined,
      outline: 0,
    },
    FULL,
  );
  ctx.save();
  ctx.beginPath();
  path(ctx);
  ctx.clip();
  const s = o.sheen ?? 1;
  const g = ctx.createLinearGradient(10, 6, 86, 90);
  g.addColorStop(0, `rgba(255,250,235,${0.2 * s})`);
  g.addColorStop(0.45, "rgba(255,255,255,0)");
  g.addColorStop(1, `rgba(5,0,15,${0.28 * s})`);
  ctx.fillStyle = g;
  ctx.fillRect(-12, -12, 120, 120);
  ctx.restore();
  const ow = o.outline ?? 3.2;
  if (ow > 0) {
    ctx.save();
    ctx.beginPath();
    path(ctx);
    ctx.lineWidth = inkW(ow);
    ctx.strokeStyle = INK_COLOR;
    ctx.lineJoin = "round";
    ctx.stroke();
    ctx.restore();
  }
}

/** Run `fn` in a local frame: translate, rotate (radians), uniform scale. */
export function at(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  rot: number,
  s: number,
  fn: () => void,
) {
  ctx.save();
  ctx.translate(x, y);
  if (rot) ctx.rotate(rot);
  if (s !== 1) ctx.scale(s, s);
  fn();
  ctx.restore();
}

// ---------------------------------------------------------------------------
// Paths
// ---------------------------------------------------------------------------

export const rr =
  (x: number, y: number, w: number, h: number, r: number): PathFn =>
  (c) => {
    c.roundRect(x, y, w, h, r);
  };
export const circ =
  (x: number, y: number, r: number): PathFn =>
  (c) => {
    c.moveTo(x + r, y);
    c.arc(x, y, r, 0, Math.PI * 2);
  };
export const ell =
  (x: number, y: number, rx: number, ry: number, rot = 0): PathFn =>
  (c) => {
    c.ellipse(x, y, rx, ry, rot, 0, Math.PI * 2);
  };
/** Ring (donut) path – fill with evenodd semantics via two opposite arcs. */
export const ring =
  (x: number, y: number, r0: number, r1: number): PathFn =>
  (c) => {
    c.moveTo(x + r1, y);
    c.arc(x, y, r1, 0, Math.PI * 2);
    c.moveTo(x + r0, y);
    c.arc(x, y, r0, 0, Math.PI * 2, true);
  };
export const star = (x: number, y: number, r0: number, r1: number, n: number, rot = -Math.PI / 2): PathFn => {
  const pts: Pt[] = [];
  for (let i = 0; i < n * 2; i++) {
    const r = i % 2 === 0 ? r1 : r0;
    const a = rot + (i * Math.PI) / n;
    pts.push([x + Math.cos(a) * r, y + Math.sin(a) * r]);
  }
  return poly(pts);
};
export const drop =
  (x: number, y: number, r: number): PathFn =>
  (c) => {
    c.moveTo(x, y - r * 2);
    c.bezierCurveTo(x + r * 0.35, y - r * 1.2, x + r, y - r * 0.6, x + r, y);
    c.arc(x, y, r, 0, Math.PI);
    c.bezierCurveTo(x - r, y - r * 0.6, x - r * 0.35, y - r * 1.2, x, y - r * 2);
    c.closePath();
  };

// ---------------------------------------------------------------------------
// Effects
// ---------------------------------------------------------------------------

/** Soft element aura behind the motif. */
export function aura(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, color: string, a = 0.55) {
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, withAlpha(color, a));
  g.addColorStop(0.5, withAlpha(color, a * 0.35));
  g.addColorStop(1, withAlpha(color, 0));
  ctx.save();
  ctx.fillStyle = g;
  ctx.fillRect(x - r, y - r, r * 2, r * 2);
  ctx.restore();
}

/** Additive bright glow. */
export function bloom(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, color: string, a = 0.8) {
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  aura(ctx, x, y, r, color, a);
  ctx.restore();
}

/** Radiating rays (inked wedges) around a centre. */
export function rays(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  r0: number,
  r1: number,
  n: number,
  m: IM,
  width = 0.16,
  rot = 0,
  outline = 2.2,
) {
  for (let i = 0; i < n; i++) {
    const a = rot + (i / n) * Math.PI * 2;
    const long = i % 2 === 0 ? 1 : 0.72;
    const re = r0 + (r1 - r0) * long;
    const pts: Pt[] = [
      [x + Math.cos(a - width) * r0, y + Math.sin(a - width) * r0],
      [x + Math.cos(a) * re, y + Math.sin(a) * re],
      [x + Math.cos(a + width) * r0, y + Math.sin(a + width) * r0],
    ];
    part(ctx, poly(pts), m, { depth: 2, outline, noDeep: true });
  }
}

/** A 4-point sparkle. */
export function sparkle(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, color = "#fff6d0") {
  ctx.save();
  ctx.fillStyle = INK_COLOR;
  ctx.beginPath();
  star(x, y, r * 0.34, r * 1.18, 4)(ctx);
  ctx.fill();
  ctx.fillStyle = color;
  ctx.beginPath();
  star(x, y, r * 0.2, r, 4)(ctx);
  ctx.fill();
  ctx.restore();
}

/** A tapered swoosh arc (slash trail), coloured with an inked edge. */
export function swoosh(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  r: number,
  a0: number,
  a1: number,
  w: number,
  color: string,
  ink = true,
) {
  const n = 18;
  const outer: Pt[] = [];
  const inner: Pt[] = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const a = a0 + (a1 - a0) * t;
    const ww = w * Math.sin(t * Math.PI) ** 0.8;
    outer.push([cx + Math.cos(a) * (r + ww / 2), cy + Math.sin(a) * (r + ww / 2)]);
    inner.push([cx + Math.cos(a) * (r - ww / 2), cy + Math.sin(a) * (r - ww / 2)]);
  }
  const path = poly([...outer, ...inner.reverse()]);
  ctx.save();
  if (ink) {
    ctx.beginPath();
    path(ctx);
    ctx.lineWidth = inkW(2.4);
    ctx.strokeStyle = INK_COLOR;
    ctx.stroke();
  }
  ctx.beginPath();
  path(ctx);
  ctx.fillStyle = color;
  ctx.fill();
  ctx.restore();
}

/** Straight speed lines. */
export function speedLines(
  ctx: CanvasRenderingContext2D,
  lines: readonly [number, number, number, number][],
  color: string,
  w = 3,
) {
  ctx.save();
  ctx.lineCap = "round";
  for (const [x1, y1, x2, y2] of lines) {
    ctx.strokeStyle = INK_COLOR;
    ctx.lineWidth = inkW(w + 2.4);
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
    ctx.strokeStyle = color;
    ctx.lineWidth = w;
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
  }
  ctx.restore();
}

/** Ink line (no fill). */
export function line(ctx: CanvasRenderingContext2D, pts: readonly Pt[], w: number, color = INK_COLOR) {
  const [f, ...rest] = pts;
  if (!f) return;
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = w;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.beginPath();
  ctx.moveTo(f[0], f[1]);
  for (const p of rest) ctx.lineTo(p[0], p[1]);
  ctx.stroke();
  ctx.restore();
}

/** Thick coloured line with ink edges (ropes, beams, whips). */
export function cord(
  ctx: CanvasRenderingContext2D,
  draw: (c: CanvasRenderingContext2D) => void,
  w: number,
  color: string,
  hi?: string,
) {
  ctx.save();
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.strokeStyle = INK_COLOR;
  ctx.lineWidth = w + inkW(5);
  ctx.beginPath();
  draw(ctx);
  ctx.stroke();
  ctx.strokeStyle = color;
  ctx.lineWidth = w;
  ctx.beginPath();
  draw(ctx);
  ctx.stroke();
  if (hi) {
    ctx.strokeStyle = hi;
    ctx.lineWidth = w * 0.3;
    ctx.translate(-w * 0.15, -w * 0.15);
    ctx.beginPath();
    draw(ctx);
    ctx.stroke();
  }
  ctx.restore();
}

// ---------------------------------------------------------------------------
// Motifs (canonical orientation, origin noted per function)
// ---------------------------------------------------------------------------

/** Straight sword pointing up; origin = pommel. Length L. */
export function sword(ctx: CanvasRenderingContext2D, L: number, blade: IM = M.steel, hilt: IM = M.brass, wide = 1) {
  const w = L * 0.13 * wide;
  part(
    ctx,
    poly([
      [-w / 2, -L * 0.24],
      [-w / 2, -L * 0.84],
      [0, -L],
      [w / 2, -L * 0.84],
      [w / 2, -L * 0.24],
    ]),
    blade,
    { depth: w * 0.45 },
  );
  line(ctx, [
    [0, -L * 0.28],
    [0, -L * 0.8],
  ], w * 0.14, withAlpha(INK_COLOR, 0.55));
  part(ctx, rr(-w * 0.32, -L * 0.24, w * 0.64, L * 0.2, 2), M.leather, { depth: 2 });
  part(ctx, rr(-L * 0.17, -L * 0.27, L * 0.34, w * 0.5, w * 0.2), hilt, { depth: 2 });
  part(ctx, circ(0, -L * 0.03, w * 0.42), hilt, { depth: 2 });
}

/** Curved blade (reaver knife / sabre) pointing up-right; origin = pommel. */
export function curvedBlade(ctx: CanvasRenderingContext2D, L: number, blade: IM = M.steel, grip: IM = M.dark) {
  const w = L * 0.15;
  part(
    ctx,
    (c) => {
      c.moveTo(-w * 0.35, -L * 0.28);
      c.quadraticCurveTo(-w * 0.9, -L * 0.7, w * 0.6, -L);
      c.quadraticCurveTo(w * 0.15, -L * 0.62, w * 0.55, -L * 0.28);
      c.closePath();
    },
    blade,
    { depth: w * 0.4 },
  );
  part(ctx, rr(-w * 0.28, -L * 0.28, w * 0.62, L * 0.27, 2), grip, { depth: 2 });
  part(ctx, rr(-w * 0.8, -L * 0.31, w * 1.7, w * 0.36, 2), M.iron, { depth: 1.5 });
}

/** Heater shield centred on origin, w × h. */
export function heaterShield(ctx: CanvasRenderingContext2D, w: number, h: number, face: IM = M.iron, rim: IM = M.brass) {
  const path: PathFn = (c) => {
    c.moveTo(-w / 2, -h / 2);
    c.lineTo(w / 2, -h / 2);
    c.lineTo(w / 2, -h * 0.05);
    c.quadraticCurveTo(w * 0.45, h * 0.32, 0, h / 2);
    c.quadraticCurveTo(-w * 0.45, h * 0.32, -w / 2, -h * 0.05);
    c.closePath();
  };
  part(ctx, path, rim, { depth: w * 0.18 });
  at(ctx, 0, -h * 0.02, 0, 0.8, () => part(ctx, path, face, { depth: w * 0.22, hatch: true, outline: 2.2 }));
}

/** Round shield / boss; origin = centre. */
export function roundShield(ctx: CanvasRenderingContext2D, r: number, face: IM = M.iron, rim: IM = M.brass) {
  part(ctx, circ(0, 0, r), rim, { depth: r * 0.3 });
  part(ctx, circ(0, 0, r * 0.8), face, { depth: r * 0.35, hatch: true, outline: 2.2 });
  part(ctx, circ(0, 0, r * 0.26), rim, { depth: r * 0.1, outline: 2.2 });
}

/** Rifle, origin = stock butt, pointing right, length L. */
export function rifle(ctx: CanvasRenderingContext2D, L: number) {
  const h = L * 0.1;
  // barrel
  part(ctx, rr(L * 0.34, -h * 0.95, L * 0.66, h * 0.5, 2), M.iron, { depth: 2 });
  part(ctx, rr(L * 0.92, -h * 1.2, L * 0.05, h * 0.3, 1), M.iron, { depth: 1 });
  // body / receiver
  part(ctx, rr(L * 0.2, -h * 1.05, L * 0.3, h * 0.95, 3), M.steel, { depth: 3 });
  // stock
  part(
    ctx,
    poly([
      [0, -h * 0.4],
      [L * 0.24, -h * 0.9],
      [L * 0.3, -h * 0.1],
      [L * 0.1, h * 0.6],
      [0, h * 0.7],
    ]),
    M.wood,
    { depth: 4, hatch: true },
  );
  // foregrip
  part(ctx, rr(L * 0.48, -h * 0.55, L * 0.24, h * 0.5, 3), M.wood, { depth: 2 });
  // trigger guard
  line(ctx, [
    [L * 0.28, 0],
    [L * 0.31, h * 0.45],
    [L * 0.38, h * 0.45],
    [L * 0.38, 0],
  ], inkW(2.4));
  // scope
  part(ctx, rr(L * 0.27, -h * 1.75, L * 0.24, h * 0.5, 3), M.dark, { depth: 2 });
  part(ctx, circ(L * 0.52, -h * 1.5, h * 0.3), M.crystal, { depth: 1, outline: 2 });
}

/** Revolver, origin = grip bottom, barrel pointing right. */
export function revolver(ctx: CanvasRenderingContext2D, s: number) {
  part(ctx, rr(14 * s, -34 * s, 40 * s, 9 * s, 2 * s), M.steel, { depth: 3 });
  part(ctx, rr(4 * s, -38 * s, 16 * s, 14 * s, 3 * s), M.iron, { depth: 3 });
  part(ctx, rr(6 * s, -36 * s, 13 * s, 12 * s, 4 * s), M.steel, { depth: 3, outline: 2.2 });
  part(
    ctx,
    poly([
      [-2 * s, -30 * s],
      [8 * s, -26 * s],
      [6 * s, 0],
      [-8 * s, 0],
      [-10 * s, -6 * s],
    ]),
    M.wood,
    { depth: 3, hatch: true },
  );
  part(ctx, rr(-6 * s, -42 * s, 6 * s, 8 * s, 2 * s), M.iron, { depth: 1 });
  line(ctx, [
    [8 * s, -24 * s],
    [12 * s, -16 * s],
    [18 * s, -16 * s],
    [18 * s, -24 * s],
  ], inkW(2.2));
}

/** Bullet pointing right; origin = base centre. */
export function bullet(ctx: CanvasRenderingContext2D, L: number, tip: IM = M.brass, cas: IM = M.gold) {
  const r = L * 0.2;
  part(ctx, rr(0, -r, L * 0.55, r * 2, 2), cas, { depth: r * 0.6 });
  part(
    ctx,
    (c) => {
      c.moveTo(L * 0.53, -r);
      c.quadraticCurveTo(L * 0.9, -r, L, 0);
      c.quadraticCurveTo(L * 0.9, r, L * 0.53, r);
      c.closePath();
    },
    tip,
    { depth: r * 0.6 },
  );
  line(ctx, [
    [L * 0.1, -r],
    [L * 0.1, r],
  ], inkW(2));
}

/** Hanging/standing lamp; origin = lamp base centre, height ~60*s. */
export function lampMotif(ctx: CanvasRenderingContext2D, s: number, lit: IM | null = M.gold, body: IM = M.brass) {
  if (lit) bloom(ctx, 0, -30 * s, 40 * s, lit.glow, 0.75);
  // handle ring
  ctx.save();
  ctx.strokeStyle = INK_COLOR;
  ctx.lineWidth = inkW(5) * s;
  ctx.beginPath();
  ctx.arc(0, -62 * s, 8 * s, Math.PI, 0);
  ctx.stroke();
  ctx.strokeStyle = body.fill;
  ctx.lineWidth = 2.5 * s;
  ctx.beginPath();
  ctx.arc(0, -62 * s, 8 * s, Math.PI, 0);
  ctx.stroke();
  ctx.restore();
  part(
    ctx,
    poly([
      [-16 * s, -48 * s],
      [-9 * s, -60 * s],
      [9 * s, -60 * s],
      [16 * s, -48 * s],
    ]),
    body,
    { depth: 3 * s },
  );
  // glass
  part(ctx, rr(-13 * s, -48 * s, 26 * s, 38 * s, 7 * s), lit ?? M.dark, { depth: 6 * s, sheen: 0.6 });
  if (lit) {
    bloom(ctx, 0, -28 * s, 14 * s, "#fff6d0", 0.9);
    part(ctx, drop(0, -24 * s, 4.5 * s), M.white, { depth: 1, outline: 1.6 });
  }
  // cage bars
  line(ctx, [
    [-6 * s, -48 * s],
    [-6 * s, -10 * s],
  ], inkW(2.2) * s);
  line(ctx, [
    [6 * s, -48 * s],
    [6 * s, -10 * s],
  ], inkW(2.2) * s);
  part(ctx, rr(-17 * s, -12 * s, 34 * s, 9 * s, 3 * s), body, { depth: 3 * s });
}

/** Teardrop flame; origin = flame base centre, height h. */
export function flame(ctx: CanvasRenderingContext2D, w: number, h: number, outer: IM = M.fire, inner: IM = M.gold) {
  const f =
    (k: number): PathFn =>
    (c) => {
      const W = w * k;
      const H = h * k;
      c.moveTo(0, -H);
      c.bezierCurveTo(W * 0.15, -H * 0.72, W * 0.62, -H * 0.62, W * 0.5, -H * 0.22);
      c.bezierCurveTo(W * 0.46, H * 0.02, W * 0.22, 0, 0, 0);
      c.bezierCurveTo(-W * 0.22, 0, -W * 0.5, -H * 0.02, -W * 0.5, -H * 0.24);
      c.bezierCurveTo(-W * 0.52, -H * 0.5, -W * 0.2, -H * 0.56, -W * 0.18, -H * 0.82);
      c.bezierCurveTo(-W * 0.02, -H * 0.66, W * 0.04, -H * 0.86, 0, -H);
      c.closePath();
    };
  bloom(ctx, 0, -h * 0.4, h * 0.75, outer.glow, 0.45);
  part(ctx, f(1), outer, { depth: w * 0.18, noDeep: true });
  at(ctx, 0, 0, 0, 1, () => part(ctx, f(0.6), inner, { depth: w * 0.1, outline: 2, noDeep: true }));
  part(ctx, ell(0, -h * 0.13, w * 0.11, h * 0.09), M.white, { depth: 1, outline: 0 });
}

/** Skull, origin = centre of cranium; s = 1 → ~44 units wide. */
export function skull(ctx: CanvasRenderingContext2D, s: number, m: IM = M.bone, eye = "#0b0810", horns?: IM) {
  if (horns) {
    for (const sd of [-1, 1]) {
      part(
        ctx,
        (c) => {
          c.moveTo(sd * 14 * s, -14 * s);
          c.quadraticCurveTo(sd * 40 * s, -18 * s, sd * 36 * s, -44 * s);
          c.quadraticCurveTo(sd * 30 * s, -26 * s, sd * 18 * s, -22 * s);
          c.closePath();
        },
        horns,
        { depth: 4 * s },
      );
    }
  }
  part(
    ctx,
    (c) => {
      c.moveTo(-22 * s, 0);
      c.bezierCurveTo(-24 * s, -30 * s, 24 * s, -30 * s, 22 * s, 0);
      c.bezierCurveTo(22 * s, 8 * s, 16 * s, 12 * s, 14 * s, 16 * s);
      c.lineTo(14 * s, 24 * s);
      c.lineTo(-14 * s, 24 * s);
      c.lineTo(-14 * s, 16 * s);
      c.bezierCurveTo(-16 * s, 12 * s, -22 * s, 8 * s, -22 * s, 0);
      c.closePath();
    },
    m,
    { depth: 9 * s, hatch: true },
  );
  ctx.save();
  ctx.fillStyle = eye;
  for (const sd of [-1, 1]) {
    ctx.beginPath();
    ctx.ellipse(sd * 9 * s, 2 * s, 6.5 * s, 7.5 * s, sd * 0.25, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = INK_COLOR;
  ctx.beginPath();
  ctx.moveTo(0, 9 * s);
  ctx.lineTo(-3.5 * s, 15 * s);
  ctx.lineTo(3.5 * s, 15 * s);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
  for (let i = -2; i <= 2; i++) line(ctx, [
    [i * 4.6 * s, 18 * s],
    [i * 4.6 * s, 24 * s],
  ], inkW(1.8) * s);
}

/** Almond eye; origin = centre, width w. */
export function eye(ctx: CanvasRenderingContext2D, w: number, iris: IM, white: IM = M.bone, slit = false) {
  const h = w * 0.42;
  const path: PathFn = (c) => {
    c.moveTo(-w / 2, 0);
    c.quadraticCurveTo(0, -h * 1.25, w / 2, 0);
    c.quadraticCurveTo(0, h * 1.25, -w / 2, 0);
    c.closePath();
  };
  part(ctx, path, white, { depth: h * 0.5, noDeep: true });
  ctx.save();
  ctx.beginPath();
  path(ctx);
  ctx.clip();
  part(ctx, circ(0, 0, h * 0.62), iris, { depth: h * 0.3, outline: 2 });
  ctx.fillStyle = INK_COLOR;
  ctx.beginPath();
  if (slit) ctx.ellipse(0, 0, h * 0.12, h * 0.5, 0, 0, Math.PI * 2);
  else ctx.arc(0, 0, h * 0.26, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#ffffff";
  ctx.beginPath();
  ctx.arc(-h * 0.2, -h * 0.22, h * 0.12, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  ctx.save();
  ctx.beginPath();
  path(ctx);
  ctx.lineWidth = inkW(3);
  ctx.strokeStyle = INK_COLOR;
  ctx.stroke();
  ctx.restore();
}

/** Crystal shard; origin = base, pointing up. */
export function shard(ctx: CanvasRenderingContext2D, len: number, w: number, m: IM = M.crystal) {
  const tip = len * 0.24;
  part(
    ctx,
    poly([
      [-w / 2, 0],
      [-w / 2, -len + tip],
      [0, -len],
      [w / 2, -len + tip],
      [w / 2, 0],
    ]),
    m,
    { depth: w * 0.35 },
  );
  ctx.save();
  ctx.fillStyle = withAlpha(m.light, 0.75);
  ctx.beginPath();
  ctx.moveTo(-w / 2 + 1.5, -len * 0.1);
  ctx.lineTo(-w / 2 + 1.5, -len + tip);
  ctx.lineTo(-w * 0.08, -len + tip * 0.6);
  ctx.lineTo(-w * 0.12, -len * 0.18);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
  line(ctx, [
    [w * 0.12, -2],
    [w * 0.12, -len + tip],
    [0, -len + 1],
  ], inkW(1.6), withAlpha(INK_COLOR, 0.6));
}

/** Hourglass; origin = centre, height h. */
export function hourglass(ctx: CanvasRenderingContext2D, h: number, frame: IM = M.wood, sand: IM = M.gold) {
  const w = h * 0.6;
  part(ctx, rr(-w / 2 - 4, -h / 2 - 4, w + 8, 8, 3), frame, { depth: 2 });
  part(ctx, rr(-w / 2 - 4, h / 2 - 4, w + 8, 8, 3), frame, { depth: 2 });
  const glass: PathFn = (c) => {
    c.moveTo(-w / 2, -h / 2 + 4);
    c.lineTo(w / 2, -h / 2 + 4);
    c.quadraticCurveTo(w * 0.45, -h * 0.12, w * 0.07, 0);
    c.quadraticCurveTo(w * 0.45, h * 0.12, w / 2, h / 2 - 4);
    c.lineTo(-w / 2, h / 2 - 4);
    c.quadraticCurveTo(-w * 0.45, h * 0.12, -w * 0.07, 0);
    c.quadraticCurveTo(-w * 0.45, -h * 0.12, -w / 2, -h / 2 + 4);
    c.closePath();
  };
  part(ctx, glass, { ...M.crystal, fill: "#8fb8c8", shade: "#5a7f92", deep: "#3a5566" }, { depth: 3, sheen: 0.4 });
  ctx.save();
  ctx.beginPath();
  glass(ctx);
  ctx.clip();
  part(
    ctx,
    poly([
      [-w * 0.32, -h * 0.18],
      [w * 0.32, -h * 0.18],
      [0, 0],
    ]),
    sand,
    { depth: 2, outline: 1.6 },
  );
  part(ctx, ell(0, h / 2 - 4, w * 0.42, h * 0.18), sand, { depth: 2, outline: 1.6 });
  ctx.restore();
  line(ctx, [
    [0, 0],
    [0, h * 0.33],
  ], 2.4, sand.light);
  ctx.save();
  ctx.beginPath();
  glass(ctx);
  ctx.lineWidth = inkW(3);
  ctx.strokeStyle = INK_COLOR;
  ctx.stroke();
  ctx.restore();
  for (const sd of [-1, 1]) part(ctx, rr(sd * (w / 2 + 2) - 2.5, -h / 2, 5, h, 2), frame, { depth: 1.5, outline: 2.2 });
}

/** Chunky arrow pointing right; origin = centre. */
export function arrow(ctx: CanvasRenderingContext2D, L: number, t: number, m: IM) {
  part(
    ctx,
    poly([
      [-L / 2, -t / 2],
      [L * 0.12, -t / 2],
      [L * 0.12, -t * 1.15],
      [L / 2, 0],
      [L * 0.12, t * 1.15],
      [L * 0.12, t / 2],
      [-L / 2, t / 2],
    ]),
    m,
    { depth: t * 0.45 },
  );
}

/** Chevron pointing right; origin = centre. */
export function chevron(ctx: CanvasRenderingContext2D, w: number, h: number, t: number, m: IM) {
  part(
    ctx,
    poly([
      [-w / 2, -h / 2],
      [-w / 2 + t, -h / 2],
      [w / 2, 0],
      [-w / 2 + t, h / 2],
      [-w / 2, h / 2],
      [w / 2 - t, 0],
    ]),
    m,
    { depth: t * 0.5 },
  );
}

/** Heart; origin = centre, size s (~ width). */
export function heart(ctx: CanvasRenderingContext2D, s: number, m: IM = M.blood) {
  part(
    ctx,
    (c) => {
      c.moveTo(0, s * 0.42);
      c.bezierCurveTo(-s * 0.62, -s * 0.02, -s * 0.5, -s * 0.52, -s * 0.24, -s * 0.5);
      c.bezierCurveTo(-s * 0.1, -s * 0.5, -s * 0.02, -s * 0.4, 0, -s * 0.28);
      c.bezierCurveTo(s * 0.02, -s * 0.4, s * 0.1, -s * 0.5, s * 0.24, -s * 0.5);
      c.bezierCurveTo(s * 0.5, -s * 0.52, s * 0.62, -s * 0.02, 0, s * 0.42);
      c.closePath();
    },
    m,
    { depth: s * 0.16 },
  );
}

/** Crosshair reticle; origin = centre. */
export function reticle(ctx: CanvasRenderingContext2D, r: number, color: string) {
  ctx.save();
  for (const [w, c] of [
    [inkW(7), INK_COLOR],
    [3.2, color],
  ] as const) {
    ctx.strokeStyle = c;
    ctx.lineWidth = w;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.moveTo(r * 0.45, 0);
    ctx.arc(0, 0, r * 0.45, 0, Math.PI * 2);
    for (const [dx, dy] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ] as const) {
      ctx.moveTo(dx * r * 0.62, dy * r * 0.62);
      ctx.lineTo(dx * r * 1.28, dy * r * 1.28);
    }
    ctx.stroke();
  }
  ctx.fillStyle = INK_COLOR;
  ctx.beginPath();
  ctx.arc(0, 0, 4, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(0, 0, 2.2, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

/** Spiral vortex; origin = centre. */
export function vortex(ctx: CanvasRenderingContext2D, r: number, m: IM, arms = 3) {
  bloom(ctx, 0, 0, r * 1.2, m.glow, 0.5);
  for (let k = 0; k < arms; k++) {
    const a0 = (k / arms) * Math.PI * 2;
    const pts: Pt[] = [];
    const inner: Pt[] = [];
    const n = 16;
    for (let i = 0; i <= n; i++) {
      const t = i / n;
      const a = a0 + t * 2.6;
      const rr0 = r * (0.15 + t * 0.85);
      const w = r * 0.22 * Math.sin(t * Math.PI) + 1;
      pts.push([Math.cos(a) * (rr0 + w / 2), Math.sin(a) * (rr0 + w / 2)]);
      inner.push([Math.cos(a) * (rr0 - w / 2), Math.sin(a) * (rr0 - w / 2)]);
    }
    part(ctx, poly([...pts, ...inner.reverse()]), m, { depth: 3, outline: 2.4, noDeep: true });
  }
  part(ctx, circ(0, 0, r * 0.22), M.dark, { depth: 2, outline: 2.4 });
}

/** Chain links along a line; origin-free. */
export function chainLinks(ctx: CanvasRenderingContext2D, pts: readonly Pt[], link: number, m: IM = M.iron) {
  let idx = 0;
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i] as Pt;
    const b = pts[i + 1] as Pt;
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
    const n = Math.max(1, Math.round(len / (link * 0.72)));
    const ang = Math.atan2(b[1] - a[1], b[0] - a[0]);
    for (let k = 0; k < n; k++) {
      const t = (k + 0.5) / n;
      const x = a[0] + (b[0] - a[0]) * t;
      const y = a[1] + (b[1] - a[1]) * t;
      at(ctx, x, y, ang, 1, () => {
        if (idx % 2 === 0) part(ctx, ring(0, 0, link * 0.18, link * 0.5), m, { depth: 2, outline: 2.4 });
        else part(ctx, rr(-link * 0.52, -link * 0.13, link * 1.04, link * 0.26, link * 0.13), m, { depth: 1.5, outline: 2.4 });
      });
      idx++;
    }
  }
}

/** Blood/liquid drop; origin = round bottom centre. */
export function liquidDrop(ctx: CanvasRenderingContext2D, r: number, m: IM) {
  part(ctx, drop(0, 0, r), m, { depth: r * 0.45 });
  ctx.save();
  ctx.fillStyle = withAlpha(m.light, 0.85);
  ctx.beginPath();
  ctx.ellipse(-r * 0.4, -r * 0.3, r * 0.18, r * 0.32, 0.4, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

/** Flask/potion; origin = bottom centre. */
export function flask(ctx: CanvasRenderingContext2D, s: number, liquid: IM, round = true) {
  const body: PathFn = round
    ? (c) => {
        c.moveTo(-6 * s, -40 * s);
        c.lineTo(-6 * s, -28 * s);
        c.bezierCurveTo(-24 * s, -22 * s, -24 * s, 0, 0, 0);
        c.bezierCurveTo(24 * s, 0, 24 * s, -22 * s, 6 * s, -28 * s);
        c.lineTo(6 * s, -40 * s);
        c.closePath();
      }
    : poly([
        [-6 * s, -40 * s],
        [-6 * s, -26 * s],
        [-20 * s, 0],
        [20 * s, 0],
        [6 * s, -26 * s],
        [6 * s, -40 * s],
      ]);
  part(ctx, body, { fill: "#4a5a6a", shade: "#2f3a48", deep: "#1a222c", light: "#9fb4c8", glow: "#9fb4c8" }, { depth: 6 * s, sheen: 0.4 });
  ctx.save();
  ctx.beginPath();
  body(ctx);
  ctx.clip();
  bloom(ctx, 0, -10 * s, 22 * s, liquid.glow, 0.5);
  part(ctx, rr(-30 * s, -18 * s, 60 * s, 24 * s, 0), liquid, { depth: 5 * s, outline: 2 });
  ctx.restore();
  ctx.save();
  ctx.beginPath();
  body(ctx);
  ctx.lineWidth = inkW(3);
  ctx.strokeStyle = INK_COLOR;
  ctx.stroke();
  ctx.fillStyle = "rgba(255,255,255,0.55)";
  ctx.beginPath();
  ctx.ellipse(-9 * s, -16 * s, 2.5 * s, 6 * s, 0.4, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  part(ctx, rr(-8 * s, -47 * s, 16 * s, 9 * s, 2 * s), M.wood, { depth: 2 });
}

/** Coin; origin = centre. */
export function coin(ctx: CanvasRenderingContext2D, r: number, m: IM = M.gold) {
  part(ctx, circ(0, 0, r), m, { depth: r * 0.3 });
  part(ctx, circ(0, 0, r * 0.72), { ...m, fill: m.shade, shade: m.deep, light: m.fill }, { depth: r * 0.2, outline: 1.8 });
  part(ctx, star(0, 0, r * 0.2, r * 0.5, 4), m, { depth: 2, outline: 1.8 });
}

/** Padlock; origin = body centre. */
export function padlock(ctx: CanvasRenderingContext2D, s: number) {
  cord(ctx, (c) => {
    c.moveTo(-12 * s, -6 * s);
    c.lineTo(-12 * s, -18 * s);
    c.arc(0, -18 * s, 12 * s, Math.PI, 0);
    c.lineTo(12 * s, -6 * s);
  }, 6 * s, M.steel.fill, M.steel.light);
  part(ctx, rr(-20 * s, -8 * s, 40 * s, 32 * s, 6 * s), M.brass, { depth: 7 * s, hatch: true });
  part(ctx, circ(0, 4 * s, 4.5 * s), M.dark, { depth: 1, outline: 1.6 });
  part(ctx, rr(-2 * s, 5 * s, 4 * s, 10 * s, 1.5), M.dark, { depth: 1, outline: 0 });
}

/** Crown; origin = band bottom centre. */
export function crown(ctx: CanvasRenderingContext2D, s: number, m: IM = M.gold, gem: IM = M.blood) {
  part(
    ctx,
    poly([
      [-30 * s, 0],
      [-34 * s, -30 * s],
      [-17 * s, -14 * s],
      [0, -36 * s],
      [17 * s, -14 * s],
      [34 * s, -30 * s],
      [30 * s, 0],
    ]),
    m,
    { depth: 8 * s, hatch: true },
  );
  part(ctx, rr(-31 * s, -8 * s, 62 * s, 10 * s, 3 * s), m, { depth: 3 * s, outline: 2.6 });
  for (const [x, y] of [
    [-34, -30],
    [0, -36],
    [34, -30],
  ] as const)
    part(ctx, circ(x * s, y * s, 4 * s), m, { depth: 1, outline: 2 });
  part(ctx, ell(0, -3 * s, 5 * s, 4 * s), gem, { depth: 2, outline: 1.8 });
  part(ctx, ell(-17 * s, -3 * s, 3.5 * s, 3 * s), M.crystal, { depth: 1, outline: 1.6 });
  part(ctx, ell(17 * s, -3 * s, 3.5 * s, 3 * s), M.crystal, { depth: 1, outline: 1.6 });
}

/** Banner on a pole; origin = pole bottom. */
export function banner(ctx: CanvasRenderingContext2D, s: number, cloth: IM, emblem?: () => void) {
  part(ctx, rr(-3 * s, -76 * s, 6 * s, 76 * s, 2), M.wood, { depth: 2 });
  part(
    ctx,
    (c) => {
      c.moveTo(3 * s, -70 * s);
      c.quadraticCurveTo(22 * s, -74 * s, 42 * s, -68 * s);
      c.lineTo(40 * s, -30 * s);
      c.lineTo(30 * s, -38 * s);
      c.lineTo(20 * s, -28 * s);
      c.quadraticCurveTo(12 * s, -32 * s, 3 * s, -30 * s);
      c.closePath();
    },
    cloth,
    { depth: 7 * s, hatch: true },
  );
  part(ctx, circ(0, -78 * s, 4.5 * s), M.brass, { depth: 1 });
  if (emblem) emblem();
}

/** Simple gear; origin = centre. */
export function gear(ctx: CanvasRenderingContext2D, r: number, m: IM = M.iron, teeth = 8) {
  const pts: Pt[] = [];
  for (let i = 0; i < teeth * 4; i++) {
    const a = (i / (teeth * 4)) * Math.PI * 2;
    const rr0 = i % 4 < 2 ? r : r * 0.78;
    pts.push([Math.cos(a) * rr0, Math.sin(a) * rr0]);
  }
  part(ctx, poly(pts), m, { depth: r * 0.25 });
  part(ctx, circ(0, 0, r * 0.32), M.dark, { depth: 2, outline: 2 });
}

export type { PathFn, Pt };
