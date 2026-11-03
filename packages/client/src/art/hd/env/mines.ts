/**
 * Dusk Mines: an abandoned mining complex in a vast dark cavern. Far: hazy headframes
 * against a dim amber glow from a distant working gallery, a cold shaft of light from the
 * surface. Mid: rock walls, a timber trestle with rails, an ore cart, chains, work lamps.
 * Near: the gallery floor with a rail track, a central timber support with a lit lantern.
 * Front (2112 wide): massive dark timber posts at the edges, chains and dust.
 */
import { blob, INK_COLOR, mixHex, type Pt, poly, seeded, shape, withAlpha } from "../ink";
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
  pick,
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
import {
  beam,
  bolt,
  boulder,
  cable,
  chain,
  fadeMat,
  groundShadow,
  lantern,
  latticeTower,
  MAT,
  oreCart,
  stalactite,
} from "./props";

const HAZE = "#2a2026";
const FAR_GLOW = "#c7711c";
const AMBER = "#f2a93b";
const RIM = "#e0913a";
const GROUND_TOP = 688;

function pickaxe(ctx: CanvasRenderingContext2D, x0: number, y0: number, x1: number, y1: number) {
  beam(ctx, x0, y0, x1, y1, 8, MAT.oldTimber, { outline: 2.2, grain: false });
  const a = Math.atan2(y1 - y0, x1 - x0);
  ctx.save();
  ctx.translate(x1, y1);
  ctx.rotate(a + Math.PI / 2);
  shape(
    ctx,
    (c) => {
      c.moveTo(-46, 10);
      c.quadraticCurveTo(-20, -8, 0, -6);
      c.quadraticCurveTo(20, -8, 42, 6);
      c.quadraticCurveTo(18, 2, 0, 4);
      c.quadraticCurveTo(-20, 2, -46, 10);
      c.closePath();
    },
    { ...MAT.iron, outline: 2.5, rim: { side: 1, color: RIM, width: 2 } },
    { x: -46, y: -8, w: 90, h: 18 },
  );
  ctx.restore();
}

export function duskMines(seed: number): HTMLCanvasElement[] {
  const rnd = seeded(seed * 1013 + 77);
  const glowX = range(rnd, 620, 1300);
  return [mFar(seed, rnd, glowX), mMid(seed, rnd, glowX), mNear(seed, rnd), mFront(seed, rnd)];
}

// ---------------------------------------------------------------------------
// Far layer (opaque)
// ---------------------------------------------------------------------------

function mFar(seed: number, rnd: Rng, glowX: number): HTMLCanvasElement {
  const [c, ctx] = layer();
  vgrad(ctx, 0, 0, BW, BH, [
    [0, "#040307"],
    [0.3, "#0b0910"],
    [0.52, "#1a1318"],
    [0.62, "#2a1d1c"],
    [0.7, "#17111a"],
    [1, "#08070b"],
  ]);
  // distant lit gallery glow
  softSpot(ctx, glowX, 600, 820, "#4a2614", 0.5, 0.42);
  softSpot(ctx, glowX, 625, 340, "#a35a1f", 0.38, 0.4);
  softSpot(ctx, BW - glowX, 300, 900, "#141a2c", 0.5, 0.6);

  // back wall: rock strata painted at 1/4 res
  const n = makeNoise(seed + 11);
  const n2 = makeNoise(seed + 12);
  const lw = 480;
  const lh = 270;
  const lit = hexRgb("#4a3328");
  const dark = hexRgb("#030205");
  const mid = hexRgb("#231b20");
  const wall = pixelCanvas(lw, lh, (x, y) => {
    const X = x * 4;
    const Y = y * 4;
    const warp = fbm(n2, X / 300, Y / 300, 2) * 3;
    const v = fbm(n, X / 260 + warp * 0.3, Y / 90 + warp, 5);
    const strata = Math.sin(Y / 26 + warp * 4 + v * 6) * 0.5 + 0.5;
    const d = Math.hypot((X - glowX) / 900, (Y - 600) / 420);
    const warm = Math.max(0, 1 - d);
    if (v < 0.42) return rgba(dark[0], dark[1], dark[2], (0.42 - v) * 2.4 * (0.6 + strata * 0.4));
    if (v > 0.56) {
      const a = Math.min(1, (v - 0.56) * 3) * (0.25 + warm * 0.55);
      return rgba(lit[0], lit[1], lit[2], a * (0.6 + strata * 0.4));
    }
    return rgba(mid[0], mid[1], mid[2], 0.18 * strata);
  });
  ctx.globalAlpha = 0.85;
  blit(ctx, wall, 0, 0, BW, BH);
  ctx.globalAlpha = 1;
  // darker cavern ceiling
  vgrad(ctx, 0, 0, BW, 360, [
    [0, "rgba(3,2,5,0.85)"],
    [1, "rgba(3,2,5,0)"],
  ]);

  // shaft of cold light from a surface opening
  const sx = range(rnd, 200, 1700);
  const sa = range(rnd, -0.22, 0.22);
  softSpot(ctx, sx, 0, 140, "#6d7fa6", 0.4, 0.4);
  lightShaft(ctx, sx, -10, 120, 360, 820, sa, "#7d8fb8", 0.13);
  if (rnd() < 0.6) lightShaft(ctx, sx + range(rnd, 80, 160), -10, 50, 160, 680, sa + 0.05, "#7d8fb8", 0.07);

  // far cavern floor + stalagmite silhouettes against the glow
  const farCol = mixHex("#191317", HAZE, 0.35);
  for (let i = 0; i < 9; i++) {
    const x = range(rnd, 0, BW);
    const h = range(rnd, 60, 220);
    const w = range(rnd, 26, 70);
    ctx.fillStyle = mixHex(farCol, "#3a2a26", Math.max(0, 1 - Math.abs(x - glowX) / 700) * 0.35);
    ctx.beginPath();
    ctx.moveTo(x - w, 660);
    ctx.quadraticCurveTo(x - w * 0.25, 660 - h * 0.6, x, 660 - h);
    ctx.quadraticCurveTo(x + w * 0.25, 660 - h * 0.6, x + w, 660);
    ctx.fill();
  }
  // headframes / lattice towers silhouetted against the glow
  const towers = 2 + Math.floor(rnd() * 3);
  for (let i = 0; i < towers; i++) {
    const tx = glowX + range(rnd, -720, 720);
    const th = range(rnd, 200, 360);
    const near = Math.abs(tx - glowX) < 420;
    const col = near ? "#2a1e20" : "#1d1619";
    latticeTower(ctx, tx, 660, th, range(rnd, 60, 110), col, 3, rnd() < 0.75);
    // a cable from the top running off
    cable(ctx, tx, 660 - th - 10, tx + range(rnd, -500, 500), range(rnd, 520, 640), 30, 1.5, col);
    if (rnd() < 0.7) {
      addGlow(ctx, tx + range(rnd, -14, 14), 660 - th * range(rnd, 0.3, 0.8), 26, AMBER, 0.5);
      ctx.fillStyle = "#ffd36e";
      ctx.fillRect(tx - 1.5, 660 - th * 0.55 - 1.5, 3, 3);
    }
  }
  // distant work lights scattered along the far galleries
  for (let i = 0; i < 8; i++) {
    const lx = glowX + range(rnd, -600, 600);
    const ly = range(rnd, 540, 650);
    addGlow(ctx, lx, ly, range(rnd, 12, 30), AMBER, range(rnd, 0.25, 0.6));
    ctx.fillStyle = "rgba(255,220,150,0.9)";
    ctx.fillRect(lx - 1, ly - 1, 2, 2);
  }
  // two planes of massive rock pillars framing the lit gallery (depth through value steps)
  for (const plane of [0, 1]) {
    const col = plane === 0 ? "#22191c" : "#120d11";
    const rimA = plane === 0 ? 0.25 : 0.4;
    for (let i = 0; i < 3; i++) {
      let px = range(rnd, 0, BW);
      if (Math.abs(px - glowX) < 260) px += px < glowX ? -260 : 260;
      const w = range(rnd, 90, 220) * (plane === 0 ? 0.8 : 1.1);
      const pts: Pt[] = [];
      for (let y = -60; y <= 760; y += 120) {
        const t = y / 680;
        const pinch = 1 - Math.sin(t * Math.PI) * 0.3;
        pts.push([px - (w / 2) * pinch + range(rnd, -14, 14), y]);
      }
      for (let y = 760; y >= -60; y -= 120) {
        const t = y / 680;
        const pinch = 1 - Math.sin(t * Math.PI) * 0.3;
        pts.push([px + (w / 2) * pinch + range(rnd, -14, 14), y]);
      }
      const pillar = blob(pts, 0.5);
      ctx.beginPath();
      pillar(ctx);
      ctx.fillStyle = col;
      ctx.fill();
      ctx.save();
      ctx.clip();
      const side = px < glowX ? 1 : -1;
      ctx.translate(-side * 4, 0);
      ctx.strokeStyle = withAlpha("#a0602a", rimA * Math.max(0.2, 1 - Math.abs(px - glowX) / 900));
      ctx.lineWidth = 6;
      ctx.beginPath();
      pillar(ctx);
      ctx.stroke();
      ctx.restore();
    }
    if (plane === 0) fogBand(ctx, 600, 120, "#2a1e20", 0.35);
  }
  const floor = ridge(rnd, -20, BW + 20, 664, 14, 16, 0.2);
  silhouette(ctx, floor, BH, { fill: "#140f13", rim: "#6b4428", rimWidth: 2, rimAlpha: 0.5 });

  fogWisps(ctx, seed + 3, 0, 520, BW, 220, "#3a2a2a", 0.55);
  fogBand(ctx, 650, 70, "#3d2b26", 0.45);
  motes(ctx, rnd, 120, sx - 300, 0, 600, 700, "#a8b6d6", 1.6, 0.5);
  mottleAtop(ctx, seed + 13, 0, 0, BW, BH, "#5a4a48", "#000000", 0.18, 160);
  applyGrain(ctx, 0.25, false, seed);
  return c;
}

// ---------------------------------------------------------------------------
// Mid layer: rock walls, ceiling, trestle with rails & cart, chains, lamps
// ---------------------------------------------------------------------------

function mMid(seed: number, rnd: Rng, glowX: number): HTMLCanvasElement {
  const [c, ctx] = layer();
  const fade = (m: (typeof MAT)[keyof typeof MAT], t: number) => fadeMat(m, mixHex, HAZE, t);

  // side rock walls (proscenium)
  for (const side of [-1, 1] as const) {
    const pts: Pt[] = [];
    const x0 = side < 0 ? -40 : BW + 40;
    const reach = range(rnd, 140, 300);
    for (let y = -20; y <= 720; y += 40) {
      const t = y / 720;
      const bulge = Math.sin(t * Math.PI * 0.9 + 0.3) * reach + range(rnd, -26, 26);
      pts.push([x0 - side * bulge, y]);
    }
    const path = poly([[x0, -20], ...pts, [x0, 720]]);
    shape(
      ctx,
      path,
      {
        ...fade(MAT.rock, 0.3),
        lightAngle: side < 0 ? -2.6 : -0.5,
        shadeDepth: 70,
        hatch: { spacing: 7, alpha: 0.25, width: 1.2 },
        outline: 3,
        rim: { side: side < 0 ? 1 : -1, color: "#5a3a26", width: 5 },
        grain: { color: INK_COLOR, alpha: 0.35, density: 0.004, seed: seed + side },
      },
      { x: side < 0 ? -40 : BW - 340, y: -20, w: 380, h: 740 },
    );
    // strata cracks
    ctx.save();
    ctx.beginPath();
    path(ctx);
    ctx.clip();
    ctx.strokeStyle = withAlpha(INK_COLOR, 0.5);
    ctx.lineWidth = 2;
    for (let k = 0; k < 10; k++) {
      const yy = range(rnd, 40, 700);
      ctx.beginPath();
      ctx.moveTo(x0, yy);
      ctx.bezierCurveTo(x0 - side * 80, yy + range(rnd, -20, 20), x0 - side * 160, yy + range(rnd, -30, 30), x0 - side * 320, yy + range(rnd, -20, 20));
      ctx.stroke();
    }
    ctx.restore();
  }

  // ceiling with stalactites
  const ceil = ridge(rnd, -20, BW + 20, 70, 50, 24, 0.5);
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(-20, -10);
  for (const p of ceil) ctx.lineTo(p[0], p[1]);
  ctx.lineTo(BW + 20, -10);
  ctx.closePath();
  const cg = ctx.createLinearGradient(0, 0, 0, 140);
  cg.addColorStop(0, "#050407");
  cg.addColorStop(1, "#16121a");
  ctx.fillStyle = cg;
  ctx.fill();
  ctx.strokeStyle = INK_COLOR;
  ctx.lineWidth = 3;
  ctx.stroke();
  ctx.restore();
  for (let i = 0; i < 14; i++) {
    const x = range(rnd, 40, BW - 40);
    const p = ceil[Math.min(ceil.length - 1, Math.max(0, Math.round((x + 20) / 24)))] as Pt;
    stalactite(ctx, rnd, x, p[1] - 4, range(rnd, 40, 150), range(rnd, 18, 44), fade(MAT.rock, 0.25), 2.5);
  }

  // timber trestle with rail deck
  const leftSide = rnd() < 0.5;
  const deckY = range(rnd, 400, 470);
  const dx0 = leftSide ? -30 : range(rnd, 900, 1150);
  const dx1 = leftSide ? range(rnd, 780, 1020) : BW + 30;
  const timber = fade(MAT.timber, 0.3);
  const postStep = range(rnd, 150, 190);
  const posts: number[] = [];
  for (let x = dx0 + 40; x < dx1 - 20; x += postStep) posts.push(x);
  // cross braces behind posts
  for (let i = 0; i < posts.length - 1; i++) {
    const a = posts[i] as number;
    const b = posts[i + 1] as number;
    beam(ctx, a, deckY + 20, b, 690, 10, fade(MAT.oldTimber, 0.4), { outline: 2 });
    beam(ctx, b, deckY + 20, a, 690, 10, fade(MAT.oldTimber, 0.4), { outline: 2 });
    beam(ctx, a, deckY + 140, b, deckY + 140, 9, fade(MAT.oldTimber, 0.35), { outline: 2 });
  }
  for (const px of posts) beam(ctx, px, deckY, px, 700, 22, timber, { rim: px < glowX ? 1 : -1, rimColor: "#8a5a32", seed });
  beam(ctx, dx0, deckY, dx1, deckY, 26, timber, { rimColor: "#8a5a32", seed: seed + 1 });
  // the deck's end: broken boards dangling
  const endX = leftSide ? dx1 : dx0;
  beam(ctx, endX, deckY + 4, endX + (leftSide ? 40 : -40), deckY + 70, 10, timber, { outline: 2 });
  // rails on the deck
  ctx.strokeStyle = INK_COLOR;
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.moveTo(dx0, deckY - 16);
  ctx.lineTo(dx1 - (leftSide ? 30 : 0), deckY - 16);
  ctx.stroke();
  ctx.strokeStyle = "#6a5a54";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(dx0, deckY - 18);
  ctx.lineTo(dx1 - (leftSide ? 30 : 0), deckY - 18);
  ctx.stroke();
  for (let x = dx0 + 10; x < dx1 - 30; x += 34) {
    ctx.fillStyle = INK_COLOR;
    ctx.fillRect(x, deckY - 14, 16, 4);
  }
  // ore cart on the trestle
  const cartX = leftSide ? range(rnd, dx0 + 200, dx1 - 160) : range(rnd, dx0 + 160, BW - 200);
  oreCart(ctx, rnd, cartX, deckY - 14, 0.8, cartX < glowX ? 1 : -1);
  // chains hanging from the deck
  for (let i = 0; i < 3; i++) {
    const hx = range(rnd, dx0 + 60, dx1 - 60);
    const len = range(rnd, 90, 210);
    chain(ctx, hx, deckY + 12, hx + range(rnd, -6, 6), deckY + 12 + len, 13, "#4a4e58");
    // hook
    ctx.strokeStyle = INK_COLOR;
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.arc(hx, deckY + 22 + len, 9, -0.3, Math.PI * 1.1);
    ctx.stroke();
  }

  // headframe wheel on the opposite side
  const hx = leftSide ? range(rnd, 1350, 1650) : range(rnd, 280, 560);
  const hTop = range(rnd, 180, 260);
  const iron = fade(MAT.iron, 0.35);
  beam(ctx, hx - 130, 700, hx - 10, hTop, 16, iron, { outline: 2.5, rim: 1, rimColor: "#6a5a4a" });
  beam(ctx, hx + 130, 700, hx + 10, hTop, 16, iron, { outline: 2.5, rim: -1, rimColor: "#6a5a4a" });
  for (let k = 1; k < 5; k++) {
    const t = k / 5;
    const y = 700 - (700 - hTop) * t;
    const w = 130 - 120 * t;
    beam(ctx, hx - w, y, hx + w, y, 7, iron, { outline: 1.8, grain: false });
    if (k < 4) {
      const t2 = (k + 1) / 5;
      const y2 = 700 - (700 - hTop) * t2;
      const w2 = 130 - 120 * t2;
      beam(ctx, hx - w, y, hx + w2, y2, 5, iron, { outline: 1.5, grain: false });
    }
  }
  const wr = 64;
  ctx.save();
  ctx.strokeStyle = INK_COLOR;
  ctx.lineWidth = 12;
  ctx.beginPath();
  ctx.arc(hx, hTop - 20, wr, 0, Math.PI * 2);
  ctx.stroke();
  ctx.strokeStyle = "#4a4a54";
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.arc(hx, hTop - 20, wr, Math.PI * 1.05, Math.PI * 1.7);
  ctx.stroke();
  ctx.strokeStyle = INK_COLOR;
  ctx.lineWidth = 4;
  ctx.beginPath();
  for (let k = 0; k < 8; k++) {
    const a = (k / 8) * Math.PI * 2 + 0.2;
    ctx.moveTo(hx, hTop - 20);
    ctx.lineTo(hx + Math.cos(a) * wr, hTop - 20 + Math.sin(a) * wr);
  }
  ctx.stroke();
  ctx.restore();
  bolt(ctx, hx, hTop - 20, 9, "#7d7a80");
  cable(ctx, hx + wr, hTop - 20, hx + wr + 6, 690, 0, 3);
  cable(ctx, hx - wr, hTop - 20, hx - 420 * (leftSide ? 1 : -1), 40, 20, 3);

  // work lamps hanging from the trestle: one or two lit, the rest dead
  const lampXs = [range(rnd, dx0 + 50, dx1 - 50), range(rnd, dx0 + 50, dx1 - 50), range(rnd, dx0 + 50, dx1 - 50)];
  const lamps = lampXs.map((lx, i) => ({
    x: lx,
    wire: range(rnd, 20, 70),
    tilt: range(rnd, -0.08, 0.08),
    lit: i === 0 ? 0.85 : i === 1 && rnd() < 0.5 ? 0.5 : 0,
  }));
  const headLit = rnd() < 0.6 ? 0.7 : 0;

  // painterly surface, chiaroscuro falloff from the lamps, atmospheric push-back
  mottleAtop(ctx, seed + 14, 0, 0, BW, BH, "#6a5040", "#000000", 0.35, 110);
  const lights = lamps.filter((l) => l.lit > 0).map((l) => ({ x: l.x, y: deckY + l.wire + 40, r: 520 * l.lit, sy: 0.8 }));
  lights.push({ x: glowX, y: 600, r: 800, sy: 0.6 });
  if (headLit) lights.push({ x: hx, y: hTop + 120, r: 420, sy: 1 });
  shadeAtop(ctx, "#040306", 0.55, lights);
  hazeAtop(ctx, "#1a1318", 0.2);
  hazeBandAtop(ctx, "#3a2a26", 500, 700, 0, 0.55);
  applyGrain(ctx, 0.22, true, seed + 4);

  for (const l of lamps) lantern(ctx, l.x, deckY + 12, 0.9, l.lit, l.wire, l.tilt);
  lantern(ctx, hx, hTop + 60, 0.8, headLit, 30);
  return c;
}

// ---------------------------------------------------------------------------
// Near layer: ground, rail track, central support with lantern, props at the edges
// ---------------------------------------------------------------------------

function mNear(seed: number, rnd: Rng): HTMLCanvasElement {
  const [c, ctx] = layer();
  // ground plane
  const top = ridge(rnd, -20, BW + 20, GROUND_TOP, 6, 20, 0.1);
  const gg = ctx.createLinearGradient(0, GROUND_TOP - 10, 0, BH);
  gg.addColorStop(0, "#3a2b28");
  gg.addColorStop(0.08, "#2a2023");
  gg.addColorStop(0.25, "#1b1519");
  gg.addColorStop(0.5, "#110d12");
  gg.addColorStop(1, "#08070a");
  silhouette(ctx, top, BH, { fill: gg, ink: 3, rim: "#9a6a3e", rimWidth: 3, rimAlpha: 0.35 });
  // ground texture: low-res noise strata
  const n = makeNoise(seed + 41);
  const tex = pixelCanvas(480, 100, (x, y) => {
    const v = fbm(n, x / 26, y / 6, 4);
    const Y = GROUND_TOP + y * 3.9;
    const fadeTop = Math.min(1, (Y - GROUND_TOP) / 30);
    if (v > 0.58) return rgba(90, 66, 54, (v - 0.58) * 1.4 * fadeTop * 0.6);
    if (v < 0.4) return rgba(4, 3, 6, (0.4 - v) * 2.2 * fadeTop);
    return 0;
  });
  ctx.save();
  ctx.globalCompositeOperation = "source-atop";
  blit(ctx, tex, 0, GROUND_TOP, BW, BH - GROUND_TOP);
  ctx.restore();
  // pebbles and gravel near the back edge (calm further forward)
  for (let i = 0; i < 260; i++) {
    const x = range(rnd, 0, BW);
    const y = GROUND_TOP + 6 + rnd() ** 2 * 220;
    const r = range(rnd, 1.2, 4.5) * (1 + (y - GROUND_TOP) / 300);
    ctx.fillStyle = withAlpha("#050407", 0.55);
    ctx.beginPath();
    ctx.ellipse(x + 1, y + 1.5, r, r * 0.55, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = withAlpha(pick(rnd, ["#3a302f", "#2c2428", "#4a3a32"]), 0.8);
    ctx.beginPath();
    ctx.ellipse(x, y, r, r * 0.55, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  // rail track along the back of the floor (behind the characters' feet)
  const r1 = 706;
  const r2 = 726;
  for (let x = -20; x < BW + 20; x += 52) {
    const jx = x + range(rnd, -3, 3);
    const tilt = range(rnd, -2, 2);
    shape(
      ctx,
      poly([
        [jx - 4, r1 - 6 + tilt],
        [jx + 26, r1 - 6 - tilt],
        [jx + 34, r2 + 7 - tilt],
        [jx + 2, r2 + 7 + tilt],
      ]),
      { ...MAT.oldTimber, outline: 2, shadeDepth: 6 },
      { x: jx - 4, y: r1 - 8, w: 40, h: 36 },
    );
  }
  for (const ry of [r1, r2]) {
    ctx.fillStyle = INK_COLOR;
    ctx.fillRect(0, ry - 5, BW, 9);
    const rg = ctx.createLinearGradient(0, ry - 4, 0, ry + 3);
    rg.addColorStop(0, "#9a8d86");
    rg.addColorStop(0.35, "#5a4440");
    rg.addColorStop(1, "#2a1a18");
    ctx.fillStyle = rg;
    ctx.fillRect(0, ry - 4, BW, 6);
  }
  // a broken section of rail sticking up
  if (rnd() < 0.6) {
    const bx = range(rnd, 860, 1060);
    beam(ctx, bx, r1, bx + 70, r1 - 26, 6, MAT.rustIron, { outline: 2, grain: false });
  }

  // central timber support set with a lantern (sits in the gap between the two sides)
  const cx = 960 + range(rnd, -40, 40);
  const capY = range(rnd, 120, 170);
  const timber = MAT.timber;
  beam(ctx, cx - 210, capY, cx + 210, capY + range(rnd, -8, 8), 30, timber, { seed: seed + 9 });
  beam(ctx, cx, capY + 10, cx, 712, 34, timber, { rim: -1, rimColor: RIM, seed: seed + 8 });
  beam(ctx, cx - 120, capY + 12, cx - 8, capY + 120, 16, timber, { seed: seed + 7 });
  beam(ctx, cx + 120, capY + 12, cx + 8, capY + 120, 16, timber, { seed: seed + 6 });
  for (const by of [capY + 4, capY + 120, 500]) bolt(ctx, cx, by, 4.5, "#a08870");
  // splintered base and a few rocks
  boulder(ctx, rnd, cx - 34, 714, 30, 18, MAT.rock, 2.5);
  boulder(ctx, rnd, cx + 30, 716, 22, 14, MAT.rock, 2.5);
  groundShadow(ctx, cx, 716, 120, 0.6);
  // a pickaxe leaning against the post
  if (rnd() < 0.7) {
    const side = rnd() < 0.5 ? -1 : 1;
    pickaxe(ctx, cx + side * 30, 714, cx + side * 74, 600);
  }

  // edge props: ore cart on one side, crates and an ore pile on the other
  const cartLeft = rnd() < 0.5;
  const cartX = cartLeft ? range(rnd, 70, 140) : range(rnd, 1780, 1850);
  groundShadow(ctx, cartX, 722, 110, 0.6);
  oreCart(ctx, rnd, cartX, r2 - 4, 0.95, cartLeft ? 1 : -1, range(rnd, -0.03, 0.03));
  const pileX = cartLeft ? range(rnd, 1760, 1860) : range(rnd, 60, 150);
  groundShadow(ctx, pileX, 716, 140, 0.6);
  for (let i = 0; i < 2; i++) {
    const w = range(rnd, 60, 80);
    const bx = pileX + (i === 0 ? -50 : 30);
    const by = 714 - (i === 1 ? 0 : 0);
    shape(
      ctx,
      poly([
        [bx - w / 2, by],
        [bx - w / 2, by - w * 0.8],
        [bx + w / 2, by - w * 0.8],
        [bx + w / 2, by],
      ]),
      { ...MAT.oldTimber, outline: 3, hatch: { spacing: 5, alpha: 0.3 }, rim: { side: cartLeft ? -1 : 1, color: RIM, width: 4 } },
      { x: bx - w / 2, y: by - w, w, h: w },
    );
    ctx.strokeStyle = INK_COLOR;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(bx - w / 2, by - w * 0.8);
    ctx.lineTo(bx + w / 2, by);
    ctx.moveTo(bx - w / 2, by - w * 0.4);
    ctx.lineTo(bx + w / 2, by - w * 0.4);
    ctx.stroke();
  }
  for (let i = 0; i < 6; i++) {
    boulder(ctx, rnd, pileX + range(rnd, -110, 110), 718 + range(rnd, -4, 6), range(rnd, 10, 26), range(rnd, 8, 16), MAT.rock, 2.2);
  }

  // darken toward the camera and push the very back edge into the fog
  hazeBandAtop(ctx, "#3a2b28", GROUND_TOP - 10, GROUND_TOP + 50, 0.45, 0);
  hazeBandAtop(ctx, "#050407", 860, BH, 0, 0.6);
  applyGrain(ctx, 0.25, true, seed + 5);

  // chiaroscuro around the central lantern, then the lantern itself (bright)
  const side = rnd() < 0.5 ? -1 : 1;
  const wire = range(rnd, 60, 120);
  mottleAtop(ctx, seed + 15, 0, 0, BW, GROUND_TOP + 40, "#6a5040", "#000000", 0.3, 90);
  shadeAtop(ctx, "#040306", 0.5, [
    { x: cx + side * 96, y: capY + wire + 60, r: 760, sy: 0.75 },
    { x: 960, y: 760, r: 900, sy: 0.25, k: 0.6 },
  ]);
  lantern(ctx, cx + side * 96, capY + 16, 1.25, 1, wire, range(rnd, -0.05, 0.05));
  addGlow(ctx, cx, 715, 260, AMBER, 0.08, 0.2);
  return c;
}

// ---------------------------------------------------------------------------
// Front layer (2112 wide): edge posts, chains, overhang, dust
// ---------------------------------------------------------------------------

function mFront(seed: number, rnd: Rng): HTMLCanvasElement {
  const [c, ctx] = layer(FRONT_W, BH);
  const ox = (FRONT_W - BW) / 2;
  const dark = { fill: "#1a120e", shade: "#0f0a08", deep: "#070505", light: "#2e2016" };
  // a massive foreground post on one edge, a hanging rock mass on the other
  const postSide = rnd() < 0.5 ? -1 : 1;
  for (const side of [-1, 1] as const) {
    if (side === postSide) {
      const px = side < 0 ? ox + range(rnd, 0, 30) : ox + BW - range(rnd, 0, 30);
      const w = range(rnd, 120, 150);
      beam(ctx, px, -20, px, BH + 20, w, dark, { rim: (side < 0 ? 1 : -1) as 1 | -1, rimColor: "#b06a2a", seed: seed + side });
      beam(ctx, px, range(rnd, 150, 220), px - side * range(rnd, 170, 240), -20, w * 0.5, dark, { seed: seed + 3, rim: (side < 0 ? 1 : -1) as 1 | -1, rimColor: "#8a5222" });
      for (const by of [300, 560]) {
        ctx.fillStyle = "#050304";
        ctx.fillRect(px - w / 2 - 4, by, w + 8, 16);
        bolt(ctx, px - side * w * 0.3, by + 8, 5, "#7a5a40");
      }
    } else {
      const x0 = side < 0 ? 0 : FRONT_W;
      const pts: Pt[] = [[x0, -20]];
      const reach = range(rnd, 200, 280);
      for (let k = 0; k <= 8; k++) {
        const t = k / 8;
        pts.push([x0 - side * (reach * (1 - t * 0.7) + range(rnd, -20, 20)), -20 + t * range(rnd, 380, 520)]);
      }
      pts.push([x0, 600]);
      shape(ctx, poly(pts), { ...dark, outline: 4, hatch: { spacing: 6, alpha: 0.3 }, rim: { side: side < 0 ? 1 : -1, color: "#8a5222", width: 4 } }, { x: side < 0 ? 0 : FRONT_W - reach - 30, y: -20, w: reach + 30, h: 620 });
    }
  }
  // overhanging rock lip at the very top
  const lip = ridge(rnd, -20, FRONT_W + 20, 26, 26, 22, 0.6);
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(-20, -10);
  for (const p of lip) ctx.lineTo(p[0], p[1]);
  ctx.lineTo(FRONT_W + 20, -10);
  ctx.closePath();
  ctx.fillStyle = "#06050a";
  ctx.fill();
  ctx.strokeStyle = INK_COLOR;
  ctx.lineWidth = 4;
  ctx.stroke();
  ctx.restore();
  // hanging chains from the top (keep above character heads ~ y 420)
  const nChains = 2 + Math.floor(rnd() * 3);
  for (let i = 0; i < nChains; i++) {
    const x = ox + range(rnd, 180, BW - 180);
    const len = range(rnd, 90, 260);
    chain(ctx, x, 0, x + range(rnd, -4, 4), len, 22, "#3a3a44");
    if (rnd() < 0.5) {
      ctx.strokeStyle = INK_COLOR;
      ctx.lineWidth = 7;
      ctx.beginPath();
      ctx.arc(x, len + 14, 13, -0.3, Math.PI * 1.1);
      ctx.stroke();
    }
  }
  // foreground rubble along the bottom (mostly behind the HUD)
  for (let i = 0; i < 14; i++) {
    const x = range(rnd, 0, FRONT_W);
    const edge = Math.min(x, FRONT_W - x) < 360;
    const y = BH + range(rnd, 10, 40);
    boulder(ctx, rnd, x, y, range(rnd, 50, edge ? 170 : 90), range(rnd, edge ? 100 : 60, edge ? 220 : 120), { fill: "#0e0b0d", shade: "#08060a", deep: "#040305", light: "#1a1416" }, 4, { side: -1, color: "#6a4024" });
  }
  // let the edges fall into shadow: only the centre catches the lamp light
  shadeAtop(ctx, "#030204", 0.75, [{ x: FRONT_W / 2, y: 380, r: 1100, sy: 0.7 }]);
  // dust motes drifting in the lamp light
  motes(ctx, rnd, 90, ox + 200, 120, BW - 400, 620, "#ffcf8a", 2.4, 0.45);
  motes(ctx, rnd, 40, 0, 0, FRONT_W, BH, "#c9b8a0", 1.4, 0.3);
  applyGrain(ctx, 0.25, true, seed + 6);
  return c;
}
