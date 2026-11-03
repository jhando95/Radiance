/**
 * Title / expedition-map backdrop (1920x1080): a deep starfield with faint nebulae, a vast
 * dim ringed gas giant lit only on a thin crescent by the distant sun, and the curved dark
 * horizon of the moon the mercenaries scavenge, its limb catching a line of amber light.
 */
import { seeded, withAlpha } from "../ink";
import {
  addGlow,
  applyGrain,
  BH,
  BW,
  blit,
  clamp,
  fbm,
  hexRgb,
  layer,
  makeNoise,
  pixelCanvas,
  range,
  rgba,
  smooth,
  softSpot,
  starfield,
  vgrad,
} from "./paint";

export function mapBackdrop(seed: number): HTMLCanvasElement {
  const rnd = seeded(seed * 4441 + 3);
  const [c, ctx] = layer();
  vgrad(ctx, 0, 0, BW, BH, [
    [0, "#030208"],
    [0.5, "#07060f"],
    [1, "#0c0a16"],
  ]);

  // nebulae: two tinted fbm fields at low res
  const n = makeNoise(seed + 101);
  const n2 = makeNoise(seed + 102);
  const neb = pixelCanvas(320, 180, (x, y) => {
    const X = x / 320;
    const Y = y / 180;
    const w = fbm(n2, X * 3, Y * 3, 3);
    const v = fbm(n, X * 4 + w * 1.5, Y * 4 + w, 5);
    const band = Math.max(0, 1 - Math.abs(Y - (0.15 + X * 0.55)) * 2.4);
    const a = clamp((v - 0.45) * 2.2, 0, 1) * (0.25 + band * 0.75);
    if (v > 0.62) return rgba(150, 80, 70, a * 0.35);
    return rgba(70, 45, 120, a * 0.45);
  });
  blit(ctx, neb, 0, 0, BW, BH);
  starfield(ctx, rnd, 1800, 0, 0, BW, BH);

  // gas giant
  const gx = range(rnd, 1180, 1420);
  const gy = range(rnd, 280, 380);
  const gr = range(rnd, 500, 580);
  const tilt = range(rnd, -0.32, -0.18);
  const ringA = gr * 1.9;
  const ringB = gr * 0.36;
  const light = { x: -0.78, y: -0.5, z: 0.38 }; // sun up-left, slightly behind
  const ll = Math.hypot(light.x, light.y, light.z);
  const lx = light.x / ll;
  const ly = light.y / ll;
  const lz = light.z / ll;

  // rings, back half (drawn before the planet)
  drawRings(ctx, gx, gy, ringA, ringB, tilt, false);

  // planet body at half res
  const S = 2;
  const pw = Math.ceil((gr * 2) / S);
  const pn = makeNoise(seed + 103);
  const pal = ["#120c14", "#2a1a1c", "#4a2c24", "#6e4630", "#8a6a50", "#a88a68"].map(hexRgb);
  const body = pixelCanvas(pw, pw, (x, y) => {
    const dx = (x * S + S / 2 - gr) / gr;
    const dy = (y * S + S / 2 - gr) / gr;
    const d2 = dx * dx + dy * dy;
    if (d2 > 1) return 0;
    const nz = Math.sqrt(1 - d2);
    // rotate into the band frame (bands follow the ring tilt)
    const by = dy * Math.cos(tilt) - dx * Math.sin(tilt);
    const turb = fbm(pn, dx * 3 + 10, by * 9, 4);
    const lat = by + (turb - 0.5) * 0.12;
    const bands = Math.sin(lat * 26) * 0.5 + 0.5 + Math.sin(lat * 61 + 1.3) * 0.18;
    const lam = Math.max(0, dx * lx + dy * ly + nz * lz);
    const lit = smooth(clamp(lam * 1.35, 0, 1));
    const tone = clamp(0.18 + bands * 0.38 + (turb - 0.5) * 0.4, 0, 1);
    const v = tone * (0.12 + lit * 0.95);
    const fi = clamp(v * (pal.length - 1), 0, pal.length - 1.001);
    const i0 = Math.floor(fi);
    const f = fi - i0;
    const a = pal[i0] as [number, number, number];
    const b = pal[i0 + 1] as [number, number, number];
    let r = a[0] + (b[0] - a[0]) * f;
    let g = a[1] + (b[1] - a[1]) * f;
    let bl = a[2] + (b[2] - a[2]) * f;
    // atmospheric limb: a thin cold scatter on the night side, warm on the lit side
    const limb = clamp((Math.sqrt(d2) - 0.93) / 0.07, 0, 1);
    if (limb > 0) {
      const warm = lam > 0.05;
      r += limb * (warm ? 70 : 18);
      g += limb * (warm ? 40 : 22);
      bl += limb * (warm ? 20 : 48);
    }
    const edgeA = clamp((1 - Math.sqrt(d2)) * gr * 0.5, 0, 1);
    return rgba(r, g, bl, edgeA);
  });
  ctx.drawImage(body, gx - gr, gy - gr, gr * 2, gr * 2);
  // ring shadow across the planet
  ctx.save();
  ctx.beginPath();
  ctx.arc(gx, gy, gr - 1, 0, Math.PI * 2);
  ctx.clip();
  ctx.translate(gx, gy);
  ctx.rotate(tilt);
  ctx.strokeStyle = "rgba(4,3,8,0.55)";
  ctx.lineWidth = gr * 0.1;
  ctx.beginPath();
  ctx.ellipse(gr * 0.06, -gr * 0.1, ringA * 0.82, ringB * 0.7, 0, Math.PI * 1.05, Math.PI * 1.95);
  ctx.stroke();
  ctx.restore();
  // faint atmosphere glow on the lit crescent
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  ctx.strokeStyle = withAlpha("#f2a93b", 0.22);
  ctx.lineWidth = 6;
  ctx.beginPath();
  const la = Math.atan2(ly, lx);
  ctx.arc(gx, gy, gr + 2, la - 1.1, la + 1.1);
  ctx.stroke();
  ctx.restore();
  addGlow(ctx, gx + lx * gr * 0.9, gy + ly * gr * 0.9, gr * 0.7, "#7a3d12", 0.18);

  // rings, front half
  drawRings(ctx, gx, gy, ringA, ringB, tilt, true);

  // a small far moon
  const mx = range(rnd, 220, 620);
  const my = range(rnd, 140, 300);
  const mr = range(rnd, 18, 34);
  const mg = ctx.createRadialGradient(mx - mr * 0.4, my - mr * 0.4, mr * 0.1, mx, my, mr);
  mg.addColorStop(0, "#8a8090");
  mg.addColorStop(0.5, "#3a3442");
  mg.addColorStop(1, "#0c0a12");
  ctx.fillStyle = mg;
  ctx.beginPath();
  ctx.arc(mx, my, mr, 0, Math.PI * 2);
  ctx.fill();

  // the dark moon's horizon
  const hx = BW * range(rnd, 0.35, 0.6);
  const hR = 3400;
  const hTop = range(rnd, 820, 870);
  const hy = hTop + hR;
  // atmospheric haze above the limb
  ctx.save();
  ctx.beginPath();
  ctx.arc(hx, hy, hR + 120, 0, Math.PI * 2);
  ctx.arc(hx, hy, hR, 0, Math.PI * 2, true);
  ctx.clip();
  const hg = ctx.createRadialGradient(hx, hy, hR, hx, hy, hR + 120);
  hg.addColorStop(0, "rgba(120,70,40,0.35)");
  hg.addColorStop(0.3, "rgba(60,40,70,0.15)");
  hg.addColorStop(1, "rgba(30,20,50,0)");
  ctx.fillStyle = hg;
  ctx.fillRect(0, hTop - 140, BW, 400);
  ctx.restore();
  // surface
  const sn = makeNoise(seed + 104);
  const surf = pixelCanvas(480, 70, (x, y) => {
    const X = x * 4;
    const Y = hTop - 30 + y * 4;
    const dy = Y - (hy - Math.sqrt(Math.max(0, hR * hR - (X - hx) ** 2)));
    if (dy < 0) return 0;
    const v = fbm(sn, X / 120, Y / 30, 5);
    const depth = clamp(dy / 200, 0, 1);
    const base = 22 - depth * 14 + (v - 0.5) * 26;
    return rgba(base * 1.05, base * 0.92, base * 1.15, 1);
  });
  blit(ctx, surf, 0, hTop - 30, BW, 280);
  // craters
  for (let i = 0; i < 14; i++) {
    const x = range(rnd, 0, BW);
    const top = hy - Math.sqrt(Math.max(0, hR * hR - (x - hx) ** 2));
    const y = top + 14 + rnd() ** 1.5 * (BH - top - 20);
    const rx = range(rnd, 18, 80) * (0.6 + (y - top) / 200);
    const ry = rx * 0.22;
    ctx.fillStyle = "rgba(2,2,4,0.6)";
    ctx.beginPath();
    ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "rgba(110,80,60,0.25)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(x, y + 1, rx, ry, 0, 0.1, Math.PI - 0.1);
    ctx.stroke();
  }
  // lit limb: a line of amber sunlight, strongest toward the sun (left)
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  for (const [w, a] of [
    [10, 0.12],
    [4, 0.35],
    [1.6, 0.8],
  ] as const) {
    const g = ctx.createLinearGradient(0, 0, BW, 0);
    g.addColorStop(0, withAlpha("#ffd36e", a));
    g.addColorStop(0.45, withAlpha("#f2a93b", a * 0.6));
    g.addColorStop(1, withAlpha("#7a3d12", a * 0.15));
    ctx.strokeStyle = g;
    ctx.lineWidth = w;
    ctx.beginPath();
    ctx.arc(hx, hy, hR, Math.PI * 1.25, Math.PI * 1.75);
    ctx.stroke();
  }
  ctx.restore();
  softSpot(ctx, 0, hTop + 20, 700, "#c7711c", 0.12, 0.35);
  // vignette
  const vg = ctx.createRadialGradient(BW * 0.5, BH * 0.45, BH * 0.35, BW * 0.5, BH * 0.5, BW * 0.75);
  vg.addColorStop(0, "rgba(2,1,5,0)");
  vg.addColorStop(1, "rgba(2,1,5,0.6)");
  ctx.fillStyle = vg;
  ctx.fillRect(0, 0, BW, BH);
  applyGrain(ctx, 0.18, false, seed);
  return c;
}

function drawRings(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  a: number,
  b: number,
  tilt: number,
  front: boolean,
) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(tilt);
  // clip to the near (lower) or far (upper) half in ring space
  ctx.beginPath();
  if (front) ctx.rect(-a * 1.2, 0, a * 2.4, b * 1.5);
  else ctx.rect(-a * 1.2, -b * 1.5, a * 2.4, b * 1.5);
  ctx.clip();
  const bands: [number, number, string, number][] = [
    [0.66, 0.04, "#3a2c2a", 0.5],
    [0.72, 0.07, "#6a5040", 0.55],
    [0.8, 0.05, "#8a6a52", 0.6],
    [0.86, 0.015, "#050308", 0.7],
    [0.9, 0.06, "#5a4436", 0.5],
    [0.97, 0.025, "#3a2c2a", 0.4],
  ];
  for (const [r, w, col, al] of bands) {
    const g = ctx.createLinearGradient(-a, 0, a, 0);
    g.addColorStop(0, withAlpha(col, al * (front ? 1 : 0.7)));
    g.addColorStop(0.5, withAlpha(col, al * 0.55));
    g.addColorStop(1, withAlpha(col, al * 0.25));
    ctx.strokeStyle = g;
    ctx.lineWidth = w * b * 2.2;
    ctx.beginPath();
    ctx.ellipse(0, 0, a * r, b * r, 0, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.restore();
}
