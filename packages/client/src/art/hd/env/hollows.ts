/**
 * Crystal Hollows: a vast cavern lit by cyan/teal crystal growths. Far: colossal hazy
 * crystal pillars over a still underground lake that mirrors them. Mid: ceiling with
 * stalactites, rock ledges with glowing clusters. Near: wet rock floor with shards and a
 * glowing centre cluster. Front (2112 wide): dark crystal masses and stalactites at the
 * edges, drifting sparkles.
 */
import { INK_COLOR, mixHex, type Pt, poly, seeded, shape, withAlpha } from "../ink";
import {
  addGlow,
  applyGrain,
  BH,
  BW,
  blit,
  fbm,
  fogBand,
  fogWisps,
  FRONT_W,
  hazeAtop,
  hazeBandAtop,
  hexRgb,
  layer,
  lightShaft,
  makeNoise,
  motes,
  pixelCanvas,
  range,
  type Rng,
  rgba,
  ridge,
  silhouette,
  softSpot,
  mottleAtop,
  shadeAtop,
  vgrad,
} from "./paint";
import { boulder, crystal, crystalCluster, fadeMat, groundShadow, MAT, stalactite } from "./props";

type CrystalPal = { dark: string; mid: string; light: string; glow: string; core: string };

const TEAL: CrystalPal = { dark: "#0f3b4b", mid: "#2ea5ad", light: "#a8f5ec", glow: "#2ea5ad", core: "#c8fff3" };
const DEEP_TEAL: CrystalPal = { dark: "#0a2430", mid: "#17697a", light: "#5fc8c4", glow: "#17697a", core: "#8fe8e0" };
const VIOLET: CrystalPal = { dark: "#2c1149", mid: "#7546b8", light: "#dcc6fb", glow: "#7546b8", core: "#f0e4ff" };
const HAZE = "#0f2a35";
const WATER_Y = 606;
const GROUND_TOP = 690;

const CAVE_ROCK = { fill: "#1a2530", shade: "#111a23", deep: "#080d13", light: "#2a3a48" };

export function crystalHollows(seed: number): HTMLCanvasElement[] {
  const rnd = seeded(seed * 2027 + 31);
  const accent = rnd() < 0.35 ? VIOLET : TEAL;
  return [hFar(seed, rnd, accent), hMid(seed, rnd, accent), hNear(seed, rnd, accent), hFront(seed, rnd)];
}

// ---------------------------------------------------------------------------
// Far: cavern, colossal crystals, the lake mirror
// ---------------------------------------------------------------------------

function hFar(seed: number, rnd: Rng, accent: CrystalPal): HTMLCanvasElement {
  const [c, ctx] = layer();
  vgrad(ctx, 0, 0, BW, BH, [
    [0, "#020509"],
    [0.32, "#05111a"],
    [0.52, "#0a2029"],
    [0.59, "#0f2d36"],
    [0.62, "#0a1c24"],
    [1, "#03070b"],
  ]);
  const gx = range(rnd, 600, 1320);
  softSpot(ctx, gx, 540, 1000, "#11454f", 0.6, 0.55);
  softSpot(ctx, gx, 560, 420, "#1f7782", 0.35, 0.6);

  // cavern wall: flowing mineral strata at 1/4 res
  const n = makeNoise(seed + 21);
  const n2 = makeNoise(seed + 22);
  const sheen = hexRgb("#2a6872");
  const dark = hexRgb("#010306");
  const wall = pixelCanvas(480, 160, (x, y) => {
    const X = x * 4;
    const Y = y * 4;
    const warp = fbm(n2, X / 380, Y / 260, 2) * 2.5;
    const v = fbm(n, X / 240 + warp * 0.4, Y / 120 + warp, 5);
    const band = Math.sin(Y / 30 + warp * 5 + X / 400) * 0.5 + 0.5;
    const d = Math.hypot((X - gx) / 1000, (Y - 560) / 500);
    const lit = Math.max(0, 1 - d);
    if (v < 0.44) return rgba(dark[0], dark[1], dark[2], (0.44 - v) * 2.6);
    if (v > 0.55) return rgba(sheen[0], sheen[1], sheen[2], Math.min(1, (v - 0.55) * 3) * (0.2 + lit * 0.5) * (0.5 + band * 0.5));
    return 0;
  });
  blit(ctx, wall, 0, 0, BW, 640);
  vgrad(ctx, 0, 0, BW, 300, [
    [0, "rgba(1,3,6,0.9)"],
    [1, "rgba(1,3,6,0)"],
  ]);

  // shafts of pale light through ceiling cracks
  for (let i = 0; i < 2; i++) {
    const sx = range(rnd, 250, 1650);
    lightShaft(ctx, sx, -10, range(rnd, 50, 110), range(rnd, 200, 340), 760, range(rnd, -0.25, 0.25), "#6fe0d7", 0.07);
  }

  // colossal far crystals standing in the lake
  const far = fadeCrystal(DEEP_TEAL, HAZE, 0.35);
  const count = 4 + Math.floor(rnd() * 3);
  for (let i = 0; i < count; i++) {
    const x = range(rnd, 80, BW - 80);
    const big = Math.abs(x - gx) < 380;
    const len = range(rnd, big ? 380 : 200, big ? 560 : 380);
    const w = len * range(rnd, 0.16, 0.24);
    addGlow(ctx, x, WATER_Y - len * 0.5, len * 0.7, "#17697a", 0.18, 1.2);
    crystal(ctx, x, WATER_Y + 6, len, w, range(rnd, -0.22, 0.22), far, 0.6, 0);
    if (rnd() < 0.7)
      crystal(ctx, x + range(rnd, -w, w), WATER_Y + 6, len * range(rnd, 0.4, 0.65), w * 0.7, range(rnd, -0.6, 0.6), far, 0.5, 0);
  }
  hazeBandAtop(ctx, HAZE, 200, WATER_Y, 0.0, 0.35);
  // far shore rock line
  const shore = ridge(rnd, -20, BW + 20, WATER_Y - 4, 10, 14, 0.3);
  silhouette(ctx, shore, WATER_Y + 8, { fill: "#08161d" });

  // lake: mirror the scene above the waterline, darken and ripple it
  const reflH = BH - WATER_Y;
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0); // pixel-space self copy (ignores a mirrored base)
  ctx.beginPath();
  ctx.rect(0, WATER_Y, BW, reflH);
  ctx.clip();
  ctx.translate(0, WATER_Y * 2);
  ctx.scale(1, -1);
  ctx.globalAlpha = 0.7;
  ctx.drawImage(c, 0, WATER_Y - reflH, BW, reflH, 0, WATER_Y - reflH, BW, reflH);
  ctx.restore();
  vgrad(ctx, 0, WATER_Y, BW, reflH, [
    [0, "rgba(4,16,22,0.15)"],
    [0.18, "rgba(3,10,15,0.45)"],
    [0.4, "rgba(2,5,8,0.85)"],
    [1, "rgba(2,5,8,0.95)"],
  ]);
  ctx.save();
  for (let i = 0; i < 160; i++) {
    const y = WATER_Y + 3 + rnd() ** 1.6 * 84;
    const x = range(rnd, 0, BW);
    const w = range(rnd, 20, 140) * (1 + (y - WATER_Y) / 60);
    const near = Math.max(0, 1 - Math.abs(x - gx) / 700);
    ctx.fillStyle = withAlpha(rnd() < 0.5 ? "#6fe0d7" : "#02070a", rnd() < 0.5 ? 0.12 + near * 0.25 : 0.4);
    ctx.fillRect(x - w / 2, y, w, range(rnd, 1, 2.2));
  }
  ctx.restore();

  fogWisps(ctx, seed + 5, 0, 470, BW, 240, "#1f5560", 0.5);
  fogBand(ctx, WATER_Y - 6, 50, "#2a6870", 0.3);
  motes(ctx, rnd, 160, 0, 80, BW, 560, "#8fe8e0", 1.8, 0.55);
  void accent;
  mottleAtop(ctx, seed + 23, 0, 0, BW, WATER_Y, "#3a7a80", "#000000", 0.2, 150);
  applyGrain(ctx, 0.22, false, seed);
  return c;
}

function fadeCrystal(p: CrystalPal, haze: string, t: number): CrystalPal {
  return {
    dark: mixHex(p.dark, haze, t),
    mid: mixHex(p.mid, haze, t),
    light: mixHex(p.light, haze, t),
    glow: p.glow,
    core: mixHex(p.core, haze, t * 0.5),
  };
}

// ---------------------------------------------------------------------------
// Mid: ceiling, stalactites, ledges with clusters
// ---------------------------------------------------------------------------

function hMid(seed: number, rnd: Rng, accent: CrystalPal): HTMLCanvasElement {
  const [c, ctx] = layer();
  const rock = fadeMat(CAVE_ROCK, mixHex, HAZE, 0.2);

  // ceiling mass
  const ceil = ridge(rnd, -20, BW + 20, 80, 60, 20, 0.5);
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(-20, -10);
  for (const p of ceil) ctx.lineTo(p[0], p[1]);
  ctx.lineTo(BW + 20, -10);
  ctx.closePath();
  const cg = ctx.createLinearGradient(0, 0, 0, 160);
  cg.addColorStop(0, "#010305");
  cg.addColorStop(1, "#0d1820");
  ctx.fillStyle = cg;
  ctx.fill();
  ctx.strokeStyle = INK_COLOR;
  ctx.lineWidth = 3;
  ctx.stroke();
  ctx.restore();
  for (let i = 0; i < 18; i++) {
    const x = range(rnd, 20, BW - 20);
    const p = ceil[Math.min(ceil.length - 1, Math.max(0, Math.round((x + 20) / 20)))] as Pt;
    const len = range(rnd, 50, 220) * (rnd() < 0.2 ? 1.6 : 1);
    stalactite(ctx, rnd, x, p[1] - 4, len, range(rnd, 18, 50), rock, 2.5, "#2a6870");
    if (rnd() < 0.35) crystal(ctx, x, p[1] + len * 0.6, len * 0.35, 10, Math.PI + range(rnd, -0.3, 0.3), DEEP_TEAL, 0.8, 2);
  }

  // rock ledges on both sides with clusters
  const clusterLights: { x: number; y: number; r: number }[] = [];
  for (const side of [-1, 1] as const) {
    const x0 = side < 0 ? -30 : BW + 30;
    const ledgeY = range(rnd, 420, 560);
    const reach = range(rnd, 260, 420);
    const pts: Pt[] = [[x0, ledgeY - 220]];
    for (let k = 0; k <= 6; k++) {
      const t = k / 6;
      pts.push([x0 - side * reach * Math.sin(t * Math.PI * 0.5) * range(rnd, 0.9, 1.05), ledgeY - 200 + t * 200 + range(rnd, -14, 14)]);
    }
    pts.push([x0 - side * reach * 0.9, ledgeY + 30]);
    pts.push([x0 - side * reach * 0.7, GROUND_TOP]);
    pts.push([x0, GROUND_TOP]);
    shape(
      ctx,
      poly(pts),
      {
        ...rock,
        lightAngle: side < 0 ? -2.4 : -0.7,
        shadeDepth: 60,
        hatch: { spacing: 6, alpha: 0.3 },
        outline: 3,
        rim: { side: side < 0 ? 1 : -1, color: "#3fa0a6", width: 4 },
        grain: { color: INK_COLOR, alpha: 0.35, density: 0.004, seed: seed + side },
      },
      { x: side < 0 ? -30 : BW - reach - 30, y: ledgeY - 230, w: reach + 60, h: GROUND_TOP - ledgeY + 240 },
    );
    const cx = x0 - side * reach * range(rnd, 0.45, 0.75);
    crystalCluster(ctx, rnd, cx, ledgeY - 192, range(rnd, 90, 150), rnd() < 0.5 ? accent : TEAL, 0.8, 3, side * 0.15);
    clusterLights.push({ x: cx, y: ledgeY - 220, r: 420 });
  }
  mottleAtop(ctx, seed + 24, 0, 0, BW, GROUND_TOP, "#3a7078", "#000000", 0.35, 100);
  shadeAtop(ctx, "#010306", 0.5, [
    ...clusterLights,
    { x: 960, y: 560, r: 900, sy: 0.6 },
  ]);
  hazeAtop(ctx, "#081820", 0.18);
  hazeBandAtop(ctx, "#1f5560", 480, GROUND_TOP, 0, 0.35);
  applyGrain(ctx, 0.2, true, seed + 2);
  return c;
}

// ---------------------------------------------------------------------------
// Near: wet floor, shards, centre cluster
// ---------------------------------------------------------------------------

function hNear(seed: number, rnd: Rng, accent: CrystalPal): HTMLCanvasElement {
  const [c, ctx] = layer();
  const top = ridge(rnd, -20, BW + 20, GROUND_TOP, 7, 20, 0.15);
  const gg = ctx.createLinearGradient(0, GROUND_TOP - 10, 0, BH);
  gg.addColorStop(0, "#1d3a42");
  gg.addColorStop(0.07, "#132530");
  gg.addColorStop(0.25, "#0c1820");
  gg.addColorStop(0.5, "#070f15");
  gg.addColorStop(1, "#03070a");
  silhouette(ctx, top, BH, { fill: gg, ink: 3, rim: "#6fe0d7", rimWidth: 3, rimAlpha: 0.35 });
  const n = makeNoise(seed + 51);
  const tex = pixelCanvas(480, 100, (x, y) => {
    const v = fbm(n, x / 30, y / 7, 4);
    const fadeTop = Math.min(1, y / 6);
    if (v > 0.6) return rgba(60, 120, 130, (v - 0.6) * 1.2 * fadeTop * 0.5);
    if (v < 0.4) return rgba(1, 3, 6, (0.4 - v) * 2.2 * fadeTop);
    return 0;
  });
  ctx.save();
  ctx.globalCompositeOperation = "source-atop";
  blit(ctx, tex, 0, GROUND_TOP, BW, BH - GROUND_TOP);
  ctx.restore();
  // wet reflective puddles catching crystal light
  for (let i = 0; i < 7; i++) {
    const x = range(rnd, 100, BW - 100);
    const y = range(rnd, 715, 840);
    const rx = range(rnd, 60, 180);
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(1, 0.14);
    const g = ctx.createRadialGradient(0, 0, 0, 0, 0, rx);
    g.addColorStop(0, "rgba(60,150,160,0.22)");
    g.addColorStop(0.7, "rgba(20,70,80,0.12)");
    g.addColorStop(1, "rgba(20,70,80,0)");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(0, 0, rx, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    ctx.fillStyle = "rgba(160,240,235,0.25)";
    ctx.fillRect(x - rx * 0.4, y - 1, rx * 0.5, 1.5);
  }
  // pebbles + tiny shards at the back edge
  for (let i = 0; i < 160; i++) {
    const x = range(rnd, 0, BW);
    const y = GROUND_TOP + 6 + rnd() ** 2 * 200;
    const r = range(rnd, 1.2, 4) * (1 + (y - GROUND_TOP) / 300);
    ctx.fillStyle = "rgba(1,3,6,0.6)";
    ctx.beginPath();
    ctx.ellipse(x + 1, y + 1.5, r, r * 0.5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = rnd() < 0.15 ? "rgba(111,224,215,0.7)" : "rgba(40,62,72,0.85)";
    ctx.beginPath();
    ctx.ellipse(x, y, r, r * 0.5, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  for (let i = 0; i < 16; i++) {
    const x = range(rnd, 0, BW);
    if (x > 200 && x < 1720 && Math.abs(x - 960) > 120) {
      if (rnd() < 0.7) continue;
    }
    const y = GROUND_TOP + range(rnd, 4, 24);
    crystal(ctx, x, y, range(rnd, 18, 46), range(rnd, 7, 14), range(rnd, -0.7, 0.7), TEAL, 0.8, 2);
  }

  // edge clusters behind the outer ranks
  for (const side of [-1, 1] as const) {
    const x = side < 0 ? range(rnd, 50, 150) : range(rnd, 1770, 1870);
    groundShadow(ctx, x, GROUND_TOP + 22, 150, 0.6);
    crystalCluster(ctx, rnd, x, GROUND_TOP + 20, range(rnd, 150, 210), side < 0 ? DEEP_TEAL : accent, 0.75, 3.5, side * -0.2);
    boulder(ctx, rnd, x + side * -70, GROUND_TOP + 26, 40, 24, CAVE_ROCK, 3);
  }
  // centre cluster in the gap between the sides: the scene's light source
  const cx = 960 + range(rnd, -50, 50);
  groundShadow(ctx, cx, GROUND_TOP + 30, 160, 0.6);
  addGlow(ctx, cx, GROUND_TOP - 40, 380, "#2ea5ad", 0.18, 0.7);
  crystalCluster(ctx, rnd, cx, GROUND_TOP + 26, range(rnd, 150, 200), accent, 1.1, 3.5);
  boulder(ctx, rnd, cx - 60, GROUND_TOP + 32, 44, 22, CAVE_ROCK, 3, { side: 1, color: "#3fa0a6" });
  boulder(ctx, rnd, cx + 66, GROUND_TOP + 34, 34, 18, CAVE_ROCK, 3, { side: -1, color: "#3fa0a6" });
  addGlow(ctx, cx, GROUND_TOP + 40, 300, "#2ea5ad", 0.12, 0.15);

  hazeBandAtop(ctx, "#2a5f68", GROUND_TOP - 10, GROUND_TOP + 50, 0.4, 0);
  hazeBandAtop(ctx, "#020407", 860, BH, 0, 0.6);
  shadeAtop(ctx, "#010306", 0.45, [{ x: cx, y: GROUND_TOP, r: 1000, sy: 0.35 }]);
  applyGrain(ctx, 0.22, true, seed + 3);
  return c;
}

// ---------------------------------------------------------------------------
// Front (2112 wide)
// ---------------------------------------------------------------------------

function hFront(seed: number, rnd: Rng): HTMLCanvasElement {
  const [c, ctx] = layer(FRONT_W, BH);
  const ox = (FRONT_W - BW) / 2;
  const darkPal: CrystalPal = { dark: "#04121a", mid: "#0c3440", light: "#2f7f86", glow: "#17697a", core: "#6fe0d7" };
  const darkRock = { fill: "#0e1820", shade: "#081016", deep: "#04080b", light: "#1d3440" };
  // overhang
  const lip = ridge(rnd, -20, FRONT_W + 20, 24, 24, 22, 0.6);
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(-20, -10);
  for (const p of lip) ctx.lineTo(p[0], p[1]);
  ctx.lineTo(FRONT_W + 20, -10);
  ctx.closePath();
  ctx.fillStyle = "#020406";
  ctx.fill();
  ctx.strokeStyle = INK_COLOR;
  ctx.lineWidth = 4;
  ctx.stroke();
  ctx.restore();
  // big stalactites at the top corners
  for (const side of [-1, 1] as const) {
    for (let k = 0; k < 3; k++) {
      const x = side < 0 ? ox + range(rnd, -60, 200) : ox + BW - range(rnd, -60, 200);
      stalactite(ctx, rnd, x, 10, range(rnd, 160, 330), range(rnd, 60, 110), darkRock, 4, "#2a6870");
    }
  }
  // dark crystal masses in the bottom corners
  for (const side of [-1, 1] as const) {
    const x = side < 0 ? ox + range(rnd, -30, 40) : ox + BW + range(rnd, -40, 30);
    crystalCluster(ctx, rnd, x, BH + 30, range(rnd, 240, 320), darkPal, 0.5, 5, side * -0.35);
  }
  for (let i = 0; i < 8; i++) {
    const x = range(rnd, 0, FRONT_W);
    boulder(ctx, rnd, x, BH + 20, range(rnd, 60, 140), range(rnd, 50, 110), darkRock, 4, { side: -1, color: "#1f5560" });
  }
  shadeAtop(ctx, "#010204", 0.7, [{ x: FRONT_W / 2, y: 420, r: 1100, sy: 0.7 }]);
  motes(ctx, rnd, 110, ox + 100, 80, BW - 200, 640, "#8fe8e0", 2.6, 0.55);
  applyGrain(ctx, 0.25, true, seed + 7);
  return c;
}
