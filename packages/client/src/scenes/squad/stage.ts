/** Tiny procedural textures for the squad builder's preview stage. */
import * as Phaser from "phaser";
import { INK, mix, RAMPS } from "../../art/palette";
import { artRng, bayer, Pix } from "../../art/pixel";

export const STAGE_TEX = {
  ground: "squad.ground",
  dice: "squad.dice",
} as const;

/** A lamp-lit patch of moon rock (64x16 native) for the merc to stand on. */
function groundCanvas(): HTMLCanvasElement {
  const w = 64;
  const h = 16;
  const p = new Pix(w, h);
  const cx = 31.5;
  const cy = 6;
  const rx = 30;
  const ry = 5;
  const R = RAMPS.rock;
  const shades = [
    R[1],
    R[2],
    mix(R[3], RAMPS.lamp[1], 0.35),
    mix(R[4], RAMPS.lamp[2], 0.35),
    mix(R[5], RAMPS.lamp[3], 0.4),
  ];
  // front face (cliff lip) below the top surface
  for (let x = 0; x < w; x++) {
    const dx = (x - cx) / rx;
    if (Math.abs(dx) > 1) continue;
    const edge = cy + ry * Math.sqrt(1 - dx * dx);
    const depth = Math.round(4 * Math.sqrt(1 - dx * dx));
    for (let y = Math.floor(edge); y <= edge + depth; y++) {
      p.px(x, y, y > edge + depth - 1 ? INK : R[0]);
    }
  }
  // lit top surface
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const d = ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2;
      if (d > 1) continue;
      const lit = 1 - Math.sqrt(d);
      const k = Math.min(shades.length - 1, Math.floor(lit * 4.2 + bayer(x, y) * 0.55));
      p.px(x, y, shades[k] ?? INK);
    }
  }
  // pebbles and cracks
  const rng = artRng(77);
  for (let i = 0; i < 14; i++) {
    const x = Math.round(cx + (rng() * 2 - 1) * (rx - 3));
    const y = Math.round(cy + (rng() * 2 - 1) * (ry - 1));
    if (Math.abs(x - cx) < 9) continue;
    p.px(x, y, R[0]);
    p.px(x, y - 1, mix(R[5], RAMPS.lamp[3], 0.3));
  }
  p.hline(9, 14, 7, R[1]).hline(48, 52, 5, R[1]);
  // contact shadow under the feet
  p.ellipse(32, 6, 9, 1, INK, 0.55);
  return p.canvas;
}

/** A 12x12 die face for the "random name" button. */
function diceCanvas(): HTMLCanvasElement {
  const p = new Pix(12, 12);
  p.rect(1, 1, 10, 10, RAMPS.bone[5]);
  p.rect(1, 9, 10, 2, RAMPS.bone[3]);
  p.vline(10, 1, 10, RAMPS.bone[3]);
  for (const [x, y] of [
    [3, 3],
    [8, 3],
    [5, 5],
    [3, 7],
    [8, 7],
  ] as const) {
    p.rect(x, y, 2, 2, RAMPS.rust[2]);
  }
  p.outline(INK);
  return p.canvas;
}

export function ensureStageTextures(scene: Phaser.Scene): void {
  if (!scene.textures.exists(STAGE_TEX.ground)) {
    scene.textures
      .addCanvas(STAGE_TEX.ground, groundCanvas())
      ?.setFilter(Phaser.Textures.FilterMode.NEAREST);
  }
  if (!scene.textures.exists(STAGE_TEX.dice)) {
    scene.textures
      .addCanvas(STAGE_TEX.dice, diceCanvas())
      ?.setFilter(Phaser.Textures.FilterMode.NEAREST);
  }
}
