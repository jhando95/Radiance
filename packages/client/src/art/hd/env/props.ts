/**
 * Inked environment props shared by the HD backdrops: timber/iron beams, chains, lanterns,
 * ore carts, lattice towers, crystals, rocks. All drawn in render px with the ink toolkit.
 */
import { INK_COLOR, type Pt, poly, shape, withAlpha } from "../ink";
import { addGlow, clamp, type Rng, range, softSpot } from "./paint";

export interface Mat {
  fill: string;
  shade: string;
  deep: string;
  light: string;
}

export const MAT = {
  timber: { fill: "#4a3424", shade: "#30211a", deep: "#1c130f", light: "#6e4d32" },
  oldTimber: { fill: "#3a2b24", shade: "#261c18", deep: "#150f0d", light: "#55402f" },
  iron: { fill: "#3a4252", shade: "#262c39", deep: "#151922", light: "#5d6a80" },
  rustIron: { fill: "#4d3128", shade: "#33201b", deep: "#1e1210", light: "#7a4a33" },
  rock: { fill: "#2a2730", shade: "#1c1a22", deep: "#100e14", light: "#3d3a46" },
  darkRock: { fill: "#1a1820", shade: "#121016", deep: "#09080c", light: "#2a2731" },
  ash: { fill: "#3a3534", shade: "#2a2627", deep: "#18161a", light: "#575050" },
  concrete: { fill: "#34323a", shade: "#24232a", deep: "#141318", light: "#4c4954" },
} as const satisfies Record<string, Mat>;

/** Darken/blend a material toward a haze colour (for distance). */
export function fadeMat(m: Mat, mix: (a: string, b: string, t: number) => string, haze: string, t: number): Mat {
  return {
    fill: mix(m.fill, haze, t),
    shade: mix(m.shade, haze, t),
    deep: mix(m.deep, haze, t),
    light: mix(m.light, haze, t),
  };
}

function bboxOf(pts: readonly Pt[]) {
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;
  for (const [x, y] of pts) {
    x0 = Math.min(x0, x);
    y0 = Math.min(y0, y);
    x1 = Math.max(x1, x);
    y1 = Math.max(y1, y);
  }
  return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
}

/** Quad corners for a straight beam of width `w` from p1 to p2. */
export function beamQuad(x1: number, y1: number, x2: number, y2: number, w: number): Pt[] {
  const a = Math.atan2(y2 - y1, x2 - x1) + Math.PI / 2;
  const ox = (Math.cos(a) * w) / 2;
  const oy = (Math.sin(a) * w) / 2;
  return [
    [x1 + ox, y1 + oy],
    [x2 + ox, y2 + oy],
    [x2 - ox, y2 - oy],
    [x1 - ox, y1 - oy],
  ];
}

/** A cel-shaded inked beam (timber or iron) with wood-grain/edge lines and optional rim. */
export function beam(
  ctx: CanvasRenderingContext2D,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  w: number,
  m: Mat,
  opts: { rim?: 1 | -1; rimColor?: string; outline?: number; grain?: boolean; seed?: number } = {},
) {
  const q = beamQuad(x1, y1, x2, y2, w);
  const bb = bboxOf(q);
  shape(
    ctx,
    poly(q),
    {
      fill: m.fill,
      shade: m.shade,
      deep: m.deep,
      light: m.light,
      shadeDepth: w * 0.42,
      hatch: { spacing: 5, alpha: 0.28, width: 1.1 },
      outline: opts.outline ?? Math.max(2, Math.min(4, w * 0.12)),
      grain: opts.grain === false ? undefined : { color: INK_COLOR, alpha: 0.3, density: 0.01, seed: opts.seed ?? 3 },
      rim: opts.rim
        ? { side: opts.rim, color: opts.rimColor ?? "#e0913a", width: Math.max(2, w * 0.14) }
        : undefined,
    },
    bb,
  );
  // grain lines running along the beam
  const len = Math.hypot(x2 - x1, y2 - y1);
  if (len > 30 && w > 9) {
    ctx.save();
    ctx.beginPath();
    poly(q)(ctx);
    ctx.clip();
    ctx.translate(x1, y1);
    ctx.rotate(Math.atan2(y2 - y1, x2 - x1));
    ctx.strokeStyle = withAlpha(INK_COLOR, 0.35);
    ctx.lineWidth = 1;
    const lines = Math.max(1, Math.floor(w / 9));
    for (let i = 0; i < lines; i++) {
      const yy = -w / 2 + ((i + 0.6) * w) / (lines + 0.4);
      ctx.beginPath();
      ctx.moveTo(4, yy);
      const segs = Math.max(2, Math.floor(len / 60));
      for (let s = 1; s <= segs; s++) {
        ctx.lineTo((s / segs) * len * (0.5 + ((i * 37 + s * 13) % 10) / 20), yy + Math.sin(s * 1.7 + i) * 1.2);
      }
      ctx.stroke();
    }
    ctx.restore();
  }
}

/** Iron rivets / bolt heads. */
export function bolt(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, lit = "#8a95a8") {
  ctx.save();
  ctx.fillStyle = INK_COLOR;
  ctx.beginPath();
  ctx.arc(x, y, r + 1.2, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#2a2f3a";
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = lit;
  ctx.beginPath();
  ctx.arc(x - r * 0.3, y - r * 0.3, r * 0.45, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

/** A hanging chain between two points, links alternating face-on / edge-on. */
export function chain(
  ctx: CanvasRenderingContext2D,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  linkLen = 16,
  color = "#4d5566",
  sag = 0,
) {
  const len = Math.hypot(x2 - x1, y2 - y1);
  const n = Math.max(2, Math.floor(len / (linkLen * 0.78)));
  ctx.save();
  for (let i = 0; i < n; i++) {
    const t = (i + 0.5) / n;
    const s = Math.sin(t * Math.PI) * sag;
    const px = x1 + (x2 - x1) * t;
    const py = y1 + (y2 - y1) * t + s;
    const t2 = (i + 1.5) / n;
    const nx = x1 + (x2 - x1) * t2;
    const ny = y1 + (y2 - y1) * t2 + Math.sin(t2 * Math.PI) * sag;
    const a = Math.atan2(ny - py, nx - px);
    ctx.save();
    ctx.translate(px, py);
    ctx.rotate(a);
    if (i % 2 === 0) {
      ctx.lineWidth = linkLen * 0.32;
      ctx.strokeStyle = INK_COLOR;
      ctx.beginPath();
      ctx.ellipse(0, 0, linkLen * 0.5, linkLen * 0.28, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.lineWidth = linkLen * 0.13;
      ctx.strokeStyle = color;
      ctx.beginPath();
      ctx.ellipse(0, 0, linkLen * 0.5, linkLen * 0.28, 0, Math.PI * 1.05, Math.PI * 1.95);
      ctx.stroke();
    } else {
      ctx.fillStyle = INK_COLOR;
      ctx.fillRect(-linkLen * 0.55, -linkLen * 0.12, linkLen * 1.1, linkLen * 0.24);
      ctx.fillStyle = color;
      ctx.fillRect(-linkLen * 0.45, -linkLen * 0.06, linkLen * 0.9, linkLen * 0.07);
    }
    ctx.restore();
  }
  ctx.restore();
}

/** A rope / cable as a sagging ink line. */
export function cable(
  ctx: CanvasRenderingContext2D,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  sag: number,
  width = 3,
  color = INK_COLOR,
) {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.quadraticCurveTo((x1 + x2) / 2, (y1 + y2) / 2 + sag * 2, x2, y2);
  ctx.stroke();
  ctx.restore();
}

/**
 * Caged work lamp hanging from (x, y) on a short wire; `lit` adds the amber bulb and glow.
 * `s` scales the lamp (1 = ~44 px tall). Returns the bulb centre.
 */
export function lantern(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  s: number,
  lit: number,
  wire = 40,
  tilt = 0,
): Pt {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(tilt);
  ctx.strokeStyle = INK_COLOR;
  ctx.lineWidth = 2.4 * s;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(0, wire);
  ctx.stroke();
  ctx.translate(0, wire);
  const bulbY = 26 * s;
  if (lit > 0) {
    addGlow(ctx, 0, bulbY, 230 * s, "#f2a93b", 0.32 * lit);
    addGlow(ctx, 0, bulbY, 70 * s, "#ffd36e", 0.55 * lit);
  }
  // cap
  shape(
    ctx,
    poly([
      [-12 * s, 10 * s],
      [-6 * s, 0],
      [6 * s, 0],
      [12 * s, 10 * s],
    ]),
    { fill: "#3a3f4a", shade: "#22262f", outline: 2.4 * s, light: "#596274" },
    { x: -12 * s, y: 0, w: 24 * s, h: 10 * s },
  );
  // glass
  ctx.save();
  ctx.beginPath();
  ctx.roundRect(-9 * s, 10 * s, 18 * s, 30 * s, 6 * s);
  const g = ctx.createRadialGradient(0, bulbY, 1, 0, bulbY, 16 * s);
  if (lit > 0) {
    g.addColorStop(0, "#fff3c4");
    g.addColorStop(0.4, "#ffd36e");
    g.addColorStop(1, "#c7711c");
  } else {
    g.addColorStop(0, "#3b3a40");
    g.addColorStop(1, "#18161c");
  }
  ctx.fillStyle = g;
  ctx.fill();
  ctx.lineWidth = 2.6 * s;
  ctx.strokeStyle = INK_COLOR;
  ctx.stroke();
  // cage bars
  ctx.lineWidth = 2 * s;
  ctx.beginPath();
  for (const bx of [-4.5, 0, 4.5]) {
    ctx.moveTo(bx * s, 10 * s);
    ctx.lineTo(bx * s, 40 * s);
  }
  ctx.moveTo(-9 * s, 25 * s);
  ctx.lineTo(9 * s, 25 * s);
  ctx.stroke();
  if (lit <= 0) {
    // dead lamp: a cracked glint
    ctx.strokeStyle = "rgba(160,170,190,0.35)";
    ctx.lineWidth = 1.2 * s;
    ctx.beginPath();
    ctx.moveTo(-5 * s, 14 * s);
    ctx.lineTo(-2 * s, 22 * s);
    ctx.stroke();
  }
  ctx.restore();
  // base
  ctx.fillStyle = "#2a2e38";
  ctx.strokeStyle = INK_COLOR;
  ctx.lineWidth = 2.4 * s;
  ctx.beginPath();
  ctx.roundRect(-11 * s, 39 * s, 22 * s, 6 * s, 2 * s);
  ctx.fill();
  ctx.stroke();
  ctx.restore();
  const c = Math.cos(tilt);
  const sn = Math.sin(tilt);
  const ly = wire + bulbY;
  return [x - sn * ly, y + c * ly];
}

/** Old ore cart (side view) on its wheels, base at (x, y), width ~ 150*s. */
export function oreCart(
  ctx: CanvasRenderingContext2D,
  rnd: Rng,
  x: number,
  y: number,
  s: number,
  rim: 1 | -1 = -1,
  tip = 0,
) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(tip);
  const W = 150 * s;
  const H = 74 * s;
  const wr = 17 * s;
  // ore heap
  for (let i = 0; i < 9; i++) {
    const ox = range(rnd, -W * 0.38, W * 0.38);
    const r = range(rnd, 10, 22) * s;
    shape(
      ctx,
      (c) => c.arc(ox, -H - wr * 1.1 - r * 0.2 + Math.abs(ox) * 0.15, r, 0, Math.PI * 2),
      { fill: "#2c2a33", shade: "#1a1820", light: "#4a4655", outline: 2 * s },
      { x: ox - r, y: -H - wr - r * 1.5, w: r * 2, h: r * 2 },
    );
  }
  // glints of ore
  for (let i = 0; i < 4; i++) {
    const gx = range(rnd, -W * 0.3, W * 0.3);
    const gy = -H - wr - range(rnd, 4, 22) * s;
    ctx.fillStyle = i % 2 ? "#ffd36e" : "#6fe0d7";
    ctx.beginPath();
    ctx.arc(gx, gy, 2.2 * s, 0, Math.PI * 2);
    ctx.fill();
    addGlow(ctx, gx, gy, 12 * s, i % 2 ? "#f2a93b" : "#2ea5ad", 0.4);
  }
  // bucket
  const bucket: Pt[] = [
    [-W / 2, -H - wr],
    [W / 2, -H - wr],
    [W * 0.4, -wr * 0.9],
    [-W * 0.4, -wr * 0.9],
  ];
  shape(
    ctx,
    poly(bucket),
    {
      ...MAT.rustIron,
      shadeDepth: 30 * s,
      hatch: { spacing: 5, alpha: 0.3 },
      rim: { side: rim, color: "#d78a3a", width: 5 * s },
      outline: 3.5 * s,
      grain: { color: "#1a0d08", alpha: 0.45, density: 0.02, seed: 9 },
    },
    { x: -W / 2, y: -H - wr, w: W, h: H },
  );
  // bands and rivets
  ctx.strokeStyle = INK_COLOR;
  ctx.lineWidth = 2.5 * s;
  ctx.beginPath();
  ctx.moveTo(-W * 0.47, -H - wr + 12 * s);
  ctx.lineTo(W * 0.47, -H - wr + 12 * s);
  ctx.stroke();
  for (let i = -3; i <= 3; i++) bolt(ctx, i * W * 0.12, -H - wr + 6 * s, 2.3 * s, "#a0704a");
  for (const wx of [-W * 0.26, W * 0.26]) {
    shape(
      ctx,
      (c) => c.arc(wx, -wr, wr, 0, Math.PI * 2),
      { ...MAT.iron, outline: 3 * s },
      { x: wx - wr, y: -wr * 2, w: wr * 2, h: wr * 2 },
    );
    ctx.fillStyle = INK_COLOR;
    ctx.beginPath();
    ctx.arc(wx, -wr, wr * 0.3, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

/** Far lattice headframe / tower silhouette (thin lines, no shading). */
export function latticeTower(
  ctx: CanvasRenderingContext2D,
  x: number,
  base: number,
  h: number,
  w: number,
  color: string,
  lw: number,
  wheel = true,
) {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = lw;
  const top = base - h;
  const tw = w * 0.32;
  const L = (t: number) => x - w / 2 + (w / 2 - tw / 2) * t;
  const R = (t: number) => x + w / 2 - (w / 2 - tw / 2) * t;
  ctx.beginPath();
  ctx.moveTo(x - w / 2, base);
  ctx.lineTo(x - tw / 2, top);
  ctx.moveTo(x + w / 2, base);
  ctx.lineTo(x + tw / 2, top);
  const n = Math.max(3, Math.round(h / (w * 0.8)));
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const yy = base - h * t;
    ctx.moveTo(L(t), yy);
    ctx.lineTo(R(t), yy);
    if (i < n) {
      const t2 = (i + 1) / n;
      const y2 = base - h * t2;
      ctx.moveTo(L(t), yy);
      ctx.lineTo(R(t2), y2);
      ctx.moveTo(R(t), yy);
      ctx.lineTo(L(t2), y2);
    }
  }
  ctx.stroke();
  ctx.lineWidth = lw * 1.6;
  ctx.beginPath();
  ctx.moveTo(x - tw, top);
  ctx.lineTo(x + tw, top);
  ctx.stroke();
  if (wheel) {
    const r = tw * 0.95;
    ctx.lineWidth = lw * 1.3;
    ctx.beginPath();
    ctx.arc(x, top - r * 0.6, r, 0, Math.PI * 2);
    ctx.stroke();
    ctx.lineWidth = lw * 0.7;
    ctx.beginPath();
    for (let k = 0; k < 6; k++) {
      const a = (k / 6) * Math.PI;
      ctx.moveTo(x + Math.cos(a) * r, top - r * 0.6 + Math.sin(a) * r);
      ctx.lineTo(x - Math.cos(a) * r, top - r * 0.6 - Math.sin(a) * r);
    }
    ctx.stroke();
  }
  ctx.restore();
}

/**
 * One crystal prism (pointing along `angle`, 0 = straight up) with lit/shadow facets, an
 * inner glow and ink contour. Base at (x, y).
 */
export function crystal(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  len: number,
  wid: number,
  angle: number,
  pal: { dark: string; mid: string; light: string; glow: string; core: string },
  glowAmt = 1,
  outline = 3,
) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  const tipL = len * 0.22;
  const outlinePts: Pt[] = [
    [-wid / 2, 0],
    [-wid / 2, -len + tipL],
    [0, -len],
    [wid / 2, -len + tipL],
    [wid / 2, 0],
  ];
  // body gradient
  ctx.beginPath();
  poly(outlinePts)(ctx);
  const g = ctx.createLinearGradient(0, 0, 0, -len);
  g.addColorStop(0, pal.dark);
  g.addColorStop(0.55, pal.mid);
  g.addColorStop(1, pal.light);
  ctx.fillStyle = g;
  ctx.fill();
  ctx.save();
  ctx.clip();
  // shadow facet (right)
  ctx.fillStyle = withAlpha(pal.dark, 0.75);
  ctx.beginPath();
  ctx.moveTo(wid * 0.12, 0);
  ctx.lineTo(wid * 0.12, -len + tipL * 0.9);
  ctx.lineTo(0, -len);
  ctx.lineTo(wid / 2, -len + tipL);
  ctx.lineTo(wid / 2, 0);
  ctx.closePath();
  ctx.fill();
  // lit facet (left edge)
  ctx.fillStyle = withAlpha(pal.light, 0.55);
  ctx.beginPath();
  ctx.moveTo(-wid / 2, -len * 0.1);
  ctx.lineTo(-wid / 2, -len + tipL);
  ctx.lineTo(0, -len);
  ctx.lineTo(-wid * 0.22, -len + tipL);
  ctx.lineTo(-wid * 0.22, -len * 0.25);
  ctx.closePath();
  ctx.fill();
  // inner core glow
  if (glowAmt > 0) {
    ctx.globalCompositeOperation = "lighter";
    const cg = ctx.createLinearGradient(0, -len * 0.15, 0, -len);
    cg.addColorStop(0, withAlpha(pal.core, 0));
    cg.addColorStop(0.6, withAlpha(pal.core, 0.35 * glowAmt));
    cg.addColorStop(1, withAlpha(pal.core, 0.6 * glowAmt));
    ctx.fillStyle = cg;
    ctx.fillRect(-wid * 0.3, -len, wid * 0.4, len);
  }
  ctx.restore();
  // facet lines
  ctx.strokeStyle = withAlpha(INK_COLOR, 0.55);
  ctx.lineWidth = Math.max(1, outline * 0.45);
  ctx.beginPath();
  ctx.moveTo(wid * 0.12, 0);
  ctx.lineTo(wid * 0.12, -len + tipL * 0.9);
  ctx.lineTo(0, -len);
  ctx.stroke();
  if (outline > 0) {
    ctx.strokeStyle = INK_COLOR;
    ctx.lineWidth = outline;
    ctx.beginPath();
    poly(outlinePts)(ctx);
    ctx.stroke();
  }
  // bright tip glint
  if (glowAmt > 0) {
    ctx.fillStyle = withAlpha(pal.core, 0.9 * glowAmt);
    ctx.beginPath();
    ctx.arc(-wid * 0.12, -len + tipL * 0.75, Math.max(1.2, wid * 0.06), 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

/** A fanned cluster of crystals from base (x, y); size ~ len of the tallest. */
export function crystalCluster(
  ctx: CanvasRenderingContext2D,
  rnd: Rng,
  x: number,
  y: number,
  size: number,
  pal: { dark: string; mid: string; light: string; glow: string; core: string },
  glowAmt = 1,
  outline = 3,
  lean = 0,
) {
  if (glowAmt > 0) addGlow(ctx, x, y - size * 0.45, size * 1.25, pal.glow, 0.22 * glowAmt, 0.85);
  const n = 3 + Math.floor(rnd() * 4);
  const items: { a: number; l: number; w: number; dx: number }[] = [];
  for (let i = 0; i < n; i++) {
    const t = n === 1 ? 0 : i / (n - 1) - 0.5;
    items.push({
      a: t * 1.5 + range(rnd, -0.18, 0.18) + lean,
      l: size * (1 - Math.abs(t) * 0.9) * range(rnd, 0.6, 1),
      w: size * range(rnd, 0.14, 0.22),
      dx: t * size * 0.35,
    });
  }
  // draw sides first, the tallest last
  items.sort((a, b) => a.l - b.l);
  for (const it of items) crystal(ctx, x + it.dx, y, it.l, it.w, it.a, pal, glowAmt, outline);
  // rocky base
  const base: Pt[] = [];
  const bw = size * 0.55;
  for (let i = 0; i <= 8; i++) {
    const a = Math.PI + (i / 8) * Math.PI;
    base.push([x + Math.cos(a) * bw * range(rnd, 0.85, 1.1), y + Math.sin(a) * size * 0.1 * range(rnd, 0.6, 1.3)]);
  }
  base.push([x + bw, y + 6]);
  base.push([x - bw, y + 6]);
  shape(ctx, poly(base), { ...MAT.darkRock, outline: outline }, { x: x - bw, y: y - size * 0.12, w: bw * 2, h: size * 0.2 });
}

/** A hanging stalactite (point down) from (x, y). */
export function stalactite(
  ctx: CanvasRenderingContext2D,
  rnd: Rng,
  x: number,
  y: number,
  len: number,
  wid: number,
  m: Mat,
  outline = 3,
  rimColor?: string,
) {
  const pts: Pt[] = [[x - wid / 2, y - 10]];
  const steps = 5;
  for (let i = 1; i <= steps; i++) {
    const t = i / steps;
    const w = (wid / 2) * (1 - t) ** 0.9;
    pts.push([x - w + range(rnd, -wid * 0.06, wid * 0.06), y + len * t * (i === steps ? 1 : range(rnd, 0.92, 1.02))]);
  }
  for (let i = steps - 1; i >= 1; i--) {
    const t = i / steps;
    const w = (wid / 2) * (1 - t) ** 0.9;
    pts.push([x + w + range(rnd, -wid * 0.06, wid * 0.06), y + len * t]);
  }
  pts.push([x + wid / 2, y - 10]);
  shape(
    ctx,
    poly(pts),
    {
      ...m,
      lightAngle: -2.0,
      shadeDepth: wid * 0.4,
      hatch: { spacing: 5, alpha: 0.3 },
      outline,
      rim: rimColor ? { side: -1, color: rimColor, width: Math.max(2, wid * 0.08) } : undefined,
    },
    { x: x - wid / 2, y: y - 10, w: wid, h: len + 10 },
  );
}

/** Irregular inked boulder centred on (x, y) resting on its base. */
export function boulder(
  ctx: CanvasRenderingContext2D,
  rnd: Rng,
  x: number,
  y: number,
  rx: number,
  ry: number,
  m: Mat,
  outline = 3,
  rim?: { side: 1 | -1; color: string },
) {
  const pts: Pt[] = [];
  const n = 9;
  for (let i = 0; i < n; i++) {
    const a = Math.PI + (i / (n - 1)) * Math.PI;
    const k = range(rnd, 0.82, 1.08);
    pts.push([x + Math.cos(a) * rx * k, y + Math.sin(a) * ry * k]);
  }
  pts.push([x + rx * 0.95, y + ry * 0.12]);
  pts.push([x - rx * 0.95, y + ry * 0.12]);
  shape(
    ctx,
    poly(pts),
    {
      ...m,
      shadeDepth: Math.min(rx, ry) * 0.6,
      hatch: { spacing: 5, alpha: 0.3 },
      outline,
      rim: rim ? { side: rim.side, color: rim.color, width: Math.max(2, rx * 0.08) } : undefined,
      grain: { color: INK_COLOR, alpha: 0.35, density: 0.012, seed: Math.floor(rnd() * 99) },
    },
    { x: x - rx, y: y - ry, w: rx * 2, h: ry * 1.2 },
  );
}

/** A soft cast shadow ellipse on the ground. */
export function groundShadow(ctx: CanvasRenderingContext2D, x: number, y: number, rx: number, alpha = 0.5) {
  softSpot(ctx, x, y, rx, "#030205", alpha, 0.16);
}

export { clamp };
