/**
 * Ashen Surface: the moon's dead surface under a black, star-filled sky. An enormous
 * eclipsed sun sits low on the horizon, only a thin amber corona escaping — the scarce
 * sunlight. Far: jagged ridges rim-lit by the corona. Mid: ruined old-world towers,
 * lattice antennas and a radar dish with one blinking beacon. Near: ash dunes with
 * half-buried wreckage. Front (2112 wide): ash drifts, a leaning girder, falling ash.
 */
import { INK_COLOR, mixHex, type Pt, poly, seeded, shape, withAlpha } from "../ink";
import {
  addGlow,
  applyGrain,
  BH,
  BW,
  blit,
  clamp,
  fbm,
  fogBand,
  fogWisps,
  FRONT_W,

  hazeBandAtop,
  layer,
  makeNoise,
  motes,
  pixelCanvas,
  range,
  type Rng,
  rgba,
  ridge,
  silhouette,
  softSpot,
  starfield,
  mottleAtop,
  shadeAtop,
  vgrad,
} from "./paint";
import { beam, boulder, cable, fadeMat, groundShadow, latticeTower, MAT, type Mat } from "./props";

const GROUND_TOP = 692;
const CORONA = "#f2a93b";
const RIM = "#e8a050";

interface Sun {
  x: number;
  y: number;
  r: number;
}

export function ashenSurface(seed: number): HTMLCanvasElement[] {
  const rnd = seeded(seed * 3301 + 59);
  const sun: Sun = { x: range(rnd, 560, 1360), y: range(rnd, 600, 660), r: range(rnd, 250, 330) };
  return [aFar(seed, rnd, sun), aMid(seed, rnd, sun), aNear(seed, rnd, sun), aFront(seed, rnd)];
}

/** 0..1: how strongly an x position is lit by the corona. */
const sunLit = (sun: Sun, x: number) => clamp(1 - Math.abs(x - sun.x) / (sun.r * 2.6), 0, 1);

// ---------------------------------------------------------------------------
// Far: sky, stars, eclipsed sun, ridges
// ---------------------------------------------------------------------------

function aFar(seed: number, rnd: Rng, sun: Sun): HTMLCanvasElement {
  const [c, ctx] = layer();
  vgrad(ctx, 0, 0, BW, BH, [
    [0, "#010103"],
    [0.35, "#04040a"],
    [0.52, "#0b0810"],
    [0.6, "#1a0f0d"],
    [0.66, "#120b0b"],
    [1, "#050406"],
  ]);
  // faint galactic dust band
  const n = makeNoise(seed + 61);
  const band = pixelCanvas(320, 180, (x, y) => {
    const X = x * 6;
    const Y = y * 6;
    const d = Math.abs(Y - (120 + X * 0.18)) / 220;
    const bell = Math.max(0, 1 - d * d);
    const v = fbm(n, X / 260, Y / 260, 5);
    const a = clamp((v - 0.4) * 1.8, 0, 1) * bell * 0.4;
    return v > 0.62 ? rgba(110, 70, 140, a) : rgba(60, 40, 90, a * 0.7);
  });
  blit(ctx, band, 0, 0, BW, BH);
  starfield(ctx, rnd, 1400, 0, 0, BW, 660, (x, y) => {
    const d = Math.hypot(x - sun.x, y - sun.y) / sun.r;
    return clamp((d - 1.2) / 1.4, 0.05, 1) * clamp((640 - y) / 200, 0.1, 1);
  });

  // the eclipse: bloom, corona streamers, dark disc, thin bright ring and a bead of light
  softSpot(ctx, sun.x, sun.y, sun.r * 3.2, "#3b1f0e", 0.75, 0.75);
  softSpot(ctx, sun.x, sun.y, sun.r * 1.9, "#7a3d12", 0.45);
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  for (let i = 0; i < 150; i++) {
    const a = rnd() * Math.PI * 2;
    const len = sun.r * range(rnd, 0.2, 0.9) * (rnd() < 0.12 ? 2 : 1);
    const w = range(rnd, 0.006, 0.035);
    const g = ctx.createRadialGradient(sun.x, sun.y, sun.r * 0.95, sun.x, sun.y, sun.r + len);
    g.addColorStop(0, withAlpha(CORONA, range(rnd, 0.04, 0.14)));
    g.addColorStop(1, withAlpha("#c7711c", 0));
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(sun.x, sun.y);
    ctx.arc(sun.x, sun.y, sun.r + len, a - w, a + w);
    ctx.closePath();
    ctx.fill();
  }
  const cg = ctx.createRadialGradient(sun.x, sun.y, sun.r * 0.98, sun.x, sun.y, sun.r * 1.35);
  cg.addColorStop(0, withAlpha("#ffd36e", 0.75));
  cg.addColorStop(0.12, withAlpha(CORONA, 0.4));
  cg.addColorStop(0.5, withAlpha("#c7711c", 0.12));
  cg.addColorStop(1, withAlpha("#c7711c", 0));
  ctx.fillStyle = cg;
  ctx.fillRect(sun.x - sun.r * 1.4, sun.y - sun.r * 1.4, sun.r * 2.8, sun.r * 2.8);
  ctx.restore();
  // disc with faint earthshine on its limb
  const dg = ctx.createRadialGradient(sun.x + sun.r * 0.2, sun.y + sun.r * 0.25, sun.r * 0.2, sun.x, sun.y, sun.r);
  dg.addColorStop(0, "#030204");
  dg.addColorStop(0.85, "#07050a");
  dg.addColorStop(1, "#160d10");
  ctx.fillStyle = dg;
  ctx.beginPath();
  ctx.arc(sun.x, sun.y, sun.r, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = withAlpha("#ffe3a0", 0.85);
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.arc(sun.x, sun.y, sun.r + 1, 0, Math.PI * 2);
  ctx.stroke();
  const beadA = range(rnd, -2.6, -1.9);
  const bx = sun.x + Math.cos(beadA) * sun.r;
  const by = sun.y + Math.sin(beadA) * sun.r;
  ctx.strokeStyle = withAlpha("#fff3c4", 0.9);
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.arc(sun.x, sun.y, sun.r + 1, beadA - 0.14, beadA + 0.14);
  ctx.stroke();
  addGlow(ctx, bx, by, 160, "#ffd36e", 0.55);
  addGlow(ctx, bx, by, 40, "#fff3c4", 0.9);
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  ctx.strokeStyle = withAlpha("#ffe3a0", 0.5);
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(bx - 260, by);
  ctx.lineTo(bx + 260, by);
  ctx.moveTo(bx, by - 120);
  ctx.lineTo(bx, by + 120);
  ctx.stroke();
  ctx.restore();

  // ridges, far → near; the farthest catch the most corona light
  const layers = [
    { base: 600, amp: 150, col: "#2a1c1c", rimA: 0.75, jag: 0.85, f: 1.1 },
    { base: 640, amp: 90, col: "#170f10", rimA: 0.6, jag: 0.8, f: 1.6 },
    { base: 668, amp: 44, col: "#0c0809", rimA: 0.45, jag: 0.6, f: 2.4 },
  ];
  for (const L of layers) {
    const pts = ridge(rnd, -20, BW + 20, L.base, L.amp, 6, L.jag, L.f);
    silhouette(ctx, pts, BH, { fill: L.col, ink: 2, inkColor: "#050304" });
    // rim light along the top edge, strongest near the sun
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    ctx.lineWidth = 2.2;
    for (let i = 1; i < pts.length; i++) {
      const p0 = pts[i - 1] as Pt;
      const p1 = pts[i] as Pt;
      const lit = sunLit(sun, p1[0]);
      if (lit <= 0.02) continue;
      ctx.strokeStyle = withAlpha(RIM, L.rimA * lit);
      ctx.beginPath();
      ctx.moveTo(p0[0], p0[1] + 1.5);
      ctx.lineTo(p1[0], p1[1] + 1.5);
      ctx.stroke();
    }
    ctx.restore();
    fogBand(ctx, L.base + 20, 40, "#2a1a16", 0.35);
  }
  fogWisps(ctx, seed + 9, 0, 560, BW, 200, "#3a2620", 0.45);
  mottleAtop(ctx, seed + 19, 0, 560, BW, BH - 560, "#5a3a30", "#000000", 0.3, 90);
  applyGrain(ctx, 0.2, false, seed);
  return c;
}

// ---------------------------------------------------------------------------
// Mid: ruined towers, antennas, a dish
// ---------------------------------------------------------------------------

function tower(ctx: CanvasRenderingContext2D, rnd: Rng, x: number, base: number, w: number, h: number, m: Mat, sun: Sun) {
  // broken top edge
  const pts: Pt[] = [[x - w / 2, base]];
  pts.push([x - w / 2, base - h * range(rnd, 0.75, 0.95)]);
  const steps = 5;
  for (let i = 1; i < steps; i++) {
    pts.push([x - w / 2 + (w * i) / steps, base - h * range(rnd, 0.72, 1)]);
  }
  pts.push([x + w / 2, base - h * range(rnd, 0.6, 0.9)]);
  pts.push([x + w / 2, base]);
  const litSide: 1 | -1 = sun.x > x ? 1 : -1;
  shape(
    ctx,
    poly(pts),
    {
      ...m,
      lightAngle: litSide > 0 ? -0.6 : -2.5,
      shadeDepth: w * 0.45,
      hatch: { spacing: 5, alpha: 0.3 },
      outline: 3,
      rim: { side: litSide, color: RIM, width: 3 },
      grain: { color: INK_COLOR, alpha: 0.3, density: 0.006, seed: Math.floor(rnd() * 99) },
    },
    { x: x - w / 2, y: base - h, w, h },
  );
  // window grid (dead, a few holes)
  ctx.save();
  ctx.beginPath();
  poly(pts)(ctx);
  ctx.clip();
  const cols = Math.max(2, Math.floor(w / 22));
  const rows = Math.floor(h / 30);
  for (let r = 1; r < rows; r++) {
    for (let k = 0; k < cols; k++) {
      if (rnd() < 0.25) continue;
      const wx = x - w / 2 + ((k + 0.5) * w) / cols - 4;
      const wy = base - r * 30;
      ctx.fillStyle = rnd() < 0.015 ? "#c7711c" : withAlpha("#050304", 0.8);
      ctx.fillRect(wx, wy, 8, 13);
    }
  }
  ctx.restore();
}

function dish(ctx: CanvasRenderingContext2D, x: number, base: number, s: number, tilt: number, m: Mat) {
  beam(ctx, x, base, x, base - 90 * s, 12 * s, m, { outline: 2.5, grain: false });
  beam(ctx, x - 40 * s, base, x, base - 60 * s, 7 * s, m, { outline: 2, grain: false });
  beam(ctx, x + 40 * s, base, x, base - 60 * s, 7 * s, m, { outline: 2, grain: false });
  ctx.save();
  ctx.translate(x, base - 100 * s);
  ctx.rotate(tilt);
  shape(
    ctx,
    (c) => {
      c.ellipse(0, 0, 80 * s, 28 * s, 0, Math.PI, Math.PI * 2);
      c.ellipse(0, 0, 80 * s, 10 * s, 0, 0, Math.PI, true);
    },
    { ...m, outline: 3, rim: { side: 1, color: RIM, width: 3 }, hatch: { spacing: 5, alpha: 0.3 } },
    { x: -80 * s, y: -28 * s, w: 160 * s, h: 38 * s },
  );
  ctx.strokeStyle = INK_COLOR;
  ctx.lineWidth = 3 * s;
  ctx.beginPath();
  ctx.moveTo(0, -4 * s);
  ctx.lineTo(0, -60 * s);
  ctx.stroke();
  ctx.fillStyle = INK_COLOR;
  ctx.beginPath();
  ctx.arc(0, -62 * s, 5 * s, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function aMid(seed: number, rnd: Rng, sun: Sun): HTMLCanvasElement {
  const [c, ctx] = layer();
  const conc = fadeMat(MAT.concrete, mixHex, "#0a0708", 0.6);
  const iron = fadeMat(MAT.iron, mixHex, "#0a0708", 0.55);
  // a low mid ridge on which ruins stand
  const pts = ridge(rnd, -20, BW + 20, 676, 26, 14, 0.6, 2);
  // ruined towers (behind the ridge)
  const nTowers = 3 + Math.floor(rnd() * 3);
  for (let i = 0; i < nTowers; i++) {
    const x = range(rnd, 60, BW - 60);
    if (Math.abs(x - sun.x) < sun.r * 0.5 && rnd() < 0.6) continue;
    tower(ctx, rnd, x, 690, range(rnd, 70, 150), range(rnd, 180, 380), conc, sun);
  }
  // lattice antenna masts with guy wires
  const nMasts = 1 + Math.floor(rnd() * 2);
  let beacon: Pt = [0, 0];
  for (let i = 0; i < nMasts; i++) {
    const x = range(rnd, 150, BW - 150);
    const h = range(rnd, 380, 560);
    latticeTower(ctx, x, 690, h, range(rnd, 40, 60), "#0d090b", 3.2, false);
    ctx.strokeStyle = "#0d090b";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(x, 690 - h);
    ctx.lineTo(x + (rnd() < 0.5 ? -1 : 1) * range(rnd, 10, 40), 690 - h - range(rnd, 40, 90));
    ctx.stroke();
    cable(ctx, x, 690 - h * 0.85, x - h * 0.6, 690, 10, 1.3, withAlpha("#0d090b", 0.9));
    cable(ctx, x, 690 - h * 0.85, x + h * 0.6, 690, 10, 1.3, withAlpha("#0d090b", 0.9));
    if (i === 0) beacon = [x, 690 - h - 4];
  }
  // dish
  dish(ctx, range(rnd, 200, BW - 200), 690, range(rnd, 0.9, 1.3), range(rnd, -0.6, 0.6), iron);
  silhouette(ctx, pts, BH, { fill: "#0b0809", ink: 3 });
  // ridge rim facing the sun
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  ctx.lineWidth = 2;
  for (let i = 1; i < pts.length; i++) {
    const p0 = pts[i - 1] as Pt;
    const p1 = pts[i] as Pt;
    const lit = sunLit(sun, p1[0]);
    if (lit <= 0.02) continue;
    ctx.strokeStyle = withAlpha(RIM, 0.45 * lit);
    ctx.beginPath();
    ctx.moveTo(p0[0], p0[1] + 2);
    ctx.lineTo(p1[0], p1[1] + 2);
    ctx.stroke();
  }
  ctx.restore();
  mottleAtop(ctx, seed + 29, 0, 0, BW, 700, "#5a4038", "#000000", 0.3, 70);
  hazeBandAtop(ctx, "#2a1a16", 400, 690, 0.0, 0.3);
  applyGrain(ctx, 0.22, true, seed + 2);
  // the beacon: a dim, dying red-amber light
  addGlow(ctx, beacon[0], beacon[1], 90, "#e0552e", 0.45);
  addGlow(ctx, beacon[0], beacon[1], 16, "#ffb070", 0.95);
  return c;
}

// ---------------------------------------------------------------------------
// Near: ash dunes and half-buried wreckage
// ---------------------------------------------------------------------------

function aNear(seed: number, rnd: Rng, sun: Sun): HTMLCanvasElement {
  const [c, ctx] = layer();
  const top = ridge(rnd, -20, BW + 20, GROUND_TOP, 10, 18, 0.2, 1.4);
  const gg = ctx.createLinearGradient(0, GROUND_TOP - 12, 0, BH);
  gg.addColorStop(0, "#3e302c");
  gg.addColorStop(0.05, "#261e1e");
  gg.addColorStop(0.2, "#171314");
  gg.addColorStop(0.45, "#0e0c0e");
  gg.addColorStop(1, "#060506");
  silhouette(ctx, top, BH, { fill: gg, ink: 3, rim: "#e0a060", rimWidth: 3, rimAlpha: 0.45 });
  // ash ripples
  const n = makeNoise(seed + 71);
  const tex = pixelCanvas(480, 100, (x, y) => {
    const v = fbm(n, x / 40, y / 8, 4);
    const rip = Math.sin(x / 3 + v * 14 + y * 0.9) * 0.5 + 0.5;
    const fadeTop = Math.min(1, y / 5);
    if (rip > 0.9) return rgba(120, 100, 90, (rip - 0.9) * 2.2 * fadeTop * v);
    if (v < 0.42) return rgba(4, 3, 4, (0.42 - v) * 2 * fadeTop);
    return 0;
  });
  ctx.save();
  ctx.globalCompositeOperation = "source-atop";
  blit(ctx, tex, 0, GROUND_TOP, BW, BH - GROUND_TOP);
  ctx.restore();
  // corona light grazing the dunes near the sun
  ctx.save();
  ctx.globalCompositeOperation = "source-atop";
  softSpot(ctx, sun.x, GROUND_TOP + 10, sun.r * 2.2, "#c7711c", 0.16, 0.12);
  ctx.restore();

  // wreckage: half-buried slabs, pipes, a toppled sign, a broken pylon in the gap
  const debris = (x: number, big: boolean) => {
    const k = Math.floor(rnd() * 3);
    const lit: 1 | -1 = sun.x > x ? 1 : -1;
    if (k === 0) {
      const w = range(rnd, 80, 160) * (big ? 1.4 : 1);
      const h = range(rnd, 40, 90) * (big ? 1.4 : 1);
      const a = range(rnd, -0.35, 0.35);
      ctx.save();
      ctx.translate(x, GROUND_TOP + 18);
      ctx.rotate(a);
      shape(
        ctx,
        poly([
          [-w / 2, 0],
          [-w / 2, -h],
          [w * 0.2, -h - 6],
          [w / 2, -h * 0.7],
          [w / 2, 0],
        ]),
        { ...MAT.concrete, outline: 3, hatch: { spacing: 5, alpha: 0.3 }, rim: { side: lit, color: RIM, width: 3 }, grain: { color: INK_COLOR, alpha: 0.4, density: 0.01, seed: 5 } },
        { x: -w / 2, y: -h - 6, w, h: h + 6 },
      );
      ctx.strokeStyle = INK_COLOR;
      ctx.lineWidth = 2;
      for (let r = 0; r < 3; r++) {
        ctx.beginPath();
        ctx.moveTo(-w / 2 + 10 + r * 18, -h * 0.9);
        ctx.lineTo(-w / 2 + 14 + r * 18, -h * 0.9 - 18);
        ctx.stroke();
      }
      ctx.restore();
    } else if (k === 1) {
      const len = range(rnd, 140, 240);
      const y = GROUND_TOP + range(rnd, 10, 22);
      beam(ctx, x - len / 2, y, x + len / 2, y - range(rnd, 10, 40), range(rnd, 22, 34), MAT.rustIron, { rim: lit, rimColor: RIM, outline: 3 });
      ctx.fillStyle = INK_COLOR;
      ctx.beginPath();
      ctx.ellipse(x + len / 2, y - 25, 6, 13, 0.2, 0, Math.PI * 2);
      ctx.fill();
    } else {
      // toppled sign on a post
      const a = range(rnd, -0.5, 0.5);
      ctx.save();
      ctx.translate(x, GROUND_TOP + 16);
      ctx.rotate(a);
      beam(ctx, 0, 0, 0, -120, 8, MAT.iron, { outline: 2, grain: false });
      shape(
        ctx,
        poly([
          [-46, -150],
          [46, -150],
          [46, -100],
          [-46, -100],
        ]),
        { ...MAT.rustIron, outline: 3, rim: { side: lit, color: RIM, width: 3 }, grain: { color: INK_COLOR, alpha: 0.45, density: 0.02, seed: 3 } },
        { x: -46, y: -150, w: 92, h: 50 },
      );
      ctx.strokeStyle = withAlpha("#c9bfae", 0.35);
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(-30, -125);
      ctx.lineTo(-10, -125);
      ctx.moveTo(0, -125);
      ctx.lineTo(30, -125);
      ctx.stroke();
      ctx.restore();
    }
    groundShadow(ctx, x, GROUND_TOP + 18, 90, 0.5);
  };
  debris(range(rnd, 40, 170), true);
  debris(range(rnd, 1750, 1880), true);
  if (rnd() < 0.8) debris(range(rnd, 900, 1020), false);
  // broken pylon stump in the gap
  const px = 960 + range(rnd, -60, 60);
  const darkIron = fadeMat(MAT.iron, mixHex, "#0a0708", 0.45);
  beam(ctx, px - 18, GROUND_TOP + 22, px - 10, GROUND_TOP - range(rnd, 120, 220), 26, darkIron, { rim: sun.x > px ? 1 : -1, rimColor: RIM });
  beam(ctx, px + 18, GROUND_TOP + 22, px + 12, GROUND_TOP - range(rnd, 80, 160), 22, darkIron, { rim: sun.x > px ? 1 : -1, rimColor: RIM });
  beam(ctx, px - 40, GROUND_TOP - 60, px + 34, GROUND_TOP - 90, 10, darkIron, { outline: 2.5 });
  for (let i = 0; i < 4; i++) boulder(ctx, rnd, px + range(rnd, -80, 80), GROUND_TOP + 24, range(rnd, 14, 30), range(rnd, 8, 16), MAT.ash, 2.5);
  // scattered rocks and ash lumps along the back of the ground
  for (let i = 0; i < 26; i++) {
    const x = range(rnd, 0, BW);
    boulder(ctx, rnd, x, GROUND_TOP + range(rnd, 6, 26), range(rnd, 8, 26), range(rnd, 5, 14), MAT.ash, 2, sunLit(sun, x) > 0.2 ? { side: sun.x > x ? 1 : -1, color: RIM } : undefined);
  }
  hazeBandAtop(ctx, "#4a3530", GROUND_TOP - 12, GROUND_TOP + 40, 0.35, 0);
  hazeBandAtop(ctx, "#030203", 860, BH, 0, 0.6);
  shadeAtop(ctx, "#030203", 0.45, [{ x: sun.x, y: GROUND_TOP, r: 1100, sy: 0.4 }]);
  applyGrain(ctx, 0.25, true, seed + 3);
  return c;
}

// ---------------------------------------------------------------------------
// Front (2112): ash drifts, leaning girder, falling ash
// ---------------------------------------------------------------------------

/** A broken steel I-beam: web, two flanges, rivet rows and a torn end. */
function iBeam(ctx: CanvasRenderingContext2D, x1: number, y1: number, x2: number, y2: number, w: number, m: Mat, rim: 1 | -1) {
  beam(ctx, x1, y1, x2, y2, w, m, { rim, rimColor: "#9a5a2a", outline: 4 });
  const a = Math.atan2(y2 - y1, x2 - x1);
  const len = Math.hypot(x2 - x1, y2 - y1);
  ctx.save();
  ctx.translate(x1, y1);
  ctx.rotate(a);
  ctx.fillStyle = INK_COLOR;
  ctx.fillRect(0, -w * 0.28, len - 10, 4);
  ctx.fillRect(0, w * 0.24, len - 10, 4);
  ctx.fillStyle = withAlpha("#8a6a50", 0.6);
  for (let d = 30; d < len - 30; d += 46) {
    ctx.beginPath();
    ctx.arc(d, -w * 0.38, 3, 0, Math.PI * 2);
    ctx.arc(d + 23, w * 0.38, 3, 0, Math.PI * 2);
    ctx.fill();
  }
  // torn end
  ctx.fillStyle = INK_COLOR;
  ctx.beginPath();
  ctx.moveTo(len - 4, -w / 2 - 2);
  ctx.lineTo(len - 26, -w * 0.1);
  ctx.lineTo(len - 8, w * 0.1);
  ctx.lineTo(len - 30, w / 2 + 2);
  ctx.lineTo(len + 4, w / 2 + 2);
  ctx.lineTo(len + 4, -w / 2 - 2);
  ctx.closePath();
  ctx.globalCompositeOperation = "destination-out";
  ctx.fill();
  ctx.restore();
}

function aFront(seed: number, rnd: Rng): HTMLCanvasElement {
  const [c, ctx] = layer(FRONT_W, BH);
  const ox = (FRONT_W - BW) / 2;
  const dark: Mat = { fill: "#141012", shade: "#0b090a", deep: "#050405", light: "#241c1c" };
  // drifts in the bottom corners
  for (const side of [-1, 1] as const) {
    const x0 = side < 0 ? 0 : FRONT_W;
    const pts: Pt[] = [[x0, BH + 10]];
    const reach = range(rnd, 380, 560);
    for (let k = 0; k <= 10; k++) {
      const t = k / 10;
      pts.push([x0 - side * reach * t, BH - range(rnd, 150, 260) * (1 - t) ** 1.6 - 10 + range(rnd, -6, 6)]);
    }
    pts.push([x0 - side * reach, BH + 10]);
    shape(ctx, poly(pts), { ...dark, outline: 4, rim: { side: side < 0 ? 1 : -1, color: "#7a4a2a", width: 3 }, hatch: { spacing: 6, alpha: 0.3 } }, { x: side < 0 ? 0 : FRONT_W - reach, y: BH - 280, w: reach, h: 290 });
  }
  // a leaning broken girder on one side
  const side = rnd() < 0.5 ? -1 : 1;
  const gx = side < 0 ? ox + range(rnd, -20, 60) : ox + BW - range(rnd, -20, 60);
  iBeam(ctx, gx, BH + 20, gx - side * range(rnd, 80, 180), range(rnd, 60, 200), range(rnd, 54, 70), dark, (side < 0 ? 1 : -1) as 1 | -1);
  // falling ash
  ctx.save();
  for (let i = 0; i < 260; i++) {
    const x = range(rnd, 0, FRONT_W);
    const y = range(rnd, 0, BH);
    const r = 0.6 + rnd() ** 3 * 2.4;
    ctx.fillStyle = withAlpha(rnd() < 0.8 ? "#9a9090" : "#e0a060", range(rnd, 0.15, 0.55));
    ctx.beginPath();
    ctx.ellipse(x, y, r, r * 0.7, rnd(), 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
  shadeAtop(ctx, "#020102", 0.6, [{ x: FRONT_W / 2, y: 500, r: 1100, sy: 0.6 }]);
  motes(ctx, rnd, 40, ox, 200, BW, 500, "#ffb070", 1.8, 0.4);
  applyGrain(ctx, 0.25, true, seed + 4);
  return c;
}
