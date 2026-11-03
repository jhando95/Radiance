/**
 * 9-slice panels. With the HD UI kit the slice is built in render px and shown at 1/RENDER_SCALE
 * (1 canvas px = 1 screen px at 1080p); with the pixel fallback it is built in native pixels
 * and shown at UI_SCALE. Always size panels through `createPanel` / `resizePanel` (logical px)
 * and read their size back with `panelSize`, never via `panel.width * UI_SCALE`.
 */
import * as Phaser from "phaser";
import { panelMetrics, TEX } from "../app/textures";
import type { PanelVariant } from "./artAdapter";
import { COLOR_NUM } from "./theme";

export interface PanelOptions {
  variant?: PanelVariant;
  /** 0..1 origin on both axes (default 0.5 = centered). */
  originX?: number;
  originY?: number;
}

/** A panel `width` x `height` logical px. */
export function createPanel(
  scene: Phaser.Scene,
  x: number,
  y: number,
  width: number,
  height: number,
  opts: PanelOptions = {},
): Phaser.GameObjects.NineSlice {
  const m = panelMetrics();
  const w = units(width, m.scale);
  const h = units(height, m.scale);
  const s = sliceFor(w, h, m.slice);
  const p = scene.add.nineslice(
    x,
    y,
    TEX.panel(opts.variant ?? "default"),
    undefined,
    w,
    h,
    s,
    s,
    s,
    s,
  );
  p.setScale(m.scale);
  p.setOrigin(opts.originX ?? 0.5, opts.originY ?? opts.originX ?? 0.5);
  return p;
}

/** Resize a panel made by `createPanel` to `width` x `height` logical px. */
export function resizePanel(panel: Phaser.GameObjects.NineSlice, width: number, height: number) {
  const m = panelMetrics();
  const w = units(width, m.scale);
  const h = units(height, m.scale);
  const s = sliceFor(w, h, m.slice);
  if (s !== panel.leftWidth || s !== panel.topHeight) {
    panel.setSlices(w, h, s, s, s, s);
  } else {
    panel.setSize(w, h);
  }
}

/** Current logical size of a panel made by `createPanel`. */
export function panelSize(panel: Phaser.GameObjects.NineSlice): { width: number; height: number } {
  return { width: panel.width * panel.scaleX, height: panel.height * panel.scaleY };
}

/** Swap the panel's look. */
export function setPanelVariant(panel: Phaser.GameObjects.NineSlice, variant: PanelVariant) {
  panel.setTexture(TEX.panel(variant));
}

function units(px: number, scale: number): number {
  return Math.max(3, Math.round(px / scale));
}

/** Shrink the border for panels smaller than two full borders (keeps corners intact). */
function sliceFor(w: number, h: number, slice: number): number {
  return Math.max(1, Math.min(slice, Math.floor((Math.min(w, h) - 1) / 2)));
}

/**
 * A thin horizontal rule as a Graphics object: a warm lamp-lit line that fades out at both
 * ends, with a dark groove under it. `color` tints the line.
 */
export function createDivider(
  scene: Phaser.Scene,
  x: number,
  y: number,
  width: number,
  color: number = COLOR_NUM.accentDeep,
): Phaser.GameObjects.Graphics {
  const g = scene.add.graphics({ x, y });
  const half = width / 2;
  const bright = Phaser.Display.Color.IntegerToColor(color).brighten(25).color;
  // dark groove
  g.fillStyle(COLOR_NUM.ink, 0.85);
  g.fillRect(0, 2, width, 2);
  // fading line: two gradient halves meeting in a bright center
  g.fillGradientStyle(color, bright, color, bright, 0, 1, 0, 1);
  g.fillRect(0, 0, half, 2);
  g.fillGradientStyle(bright, color, bright, color, 1, 0, 1, 0);
  g.fillRect(half, 0, width - half, 2);
  return g;
}
