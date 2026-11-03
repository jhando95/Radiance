/** 9-slice pixel-art panels, scaled 3x so their pixels match the rest of the UI. */
import type * as Phaser from "phaser";
import { PANEL_SLICE, TEX } from "../app/textures";
import type { PanelVariant } from "./artAdapter";
import { UI_SCALE } from "./theme";

export interface PanelOptions {
  variant?: PanelVariant;
  /** 0..1 origin on both axes (default 0.5 = centered). */
  originX?: number;
  originY?: number;
}

/** A panel `width` x `height` screen px (multiples of 3 keep pixels square). */
export function createPanel(
  scene: Phaser.Scene,
  x: number,
  y: number,
  width: number,
  height: number,
  opts: PanelOptions = {},
): Phaser.GameObjects.NineSlice {
  const p = scene.add.nineslice(
    x,
    y,
    TEX.panel(opts.variant ?? "default"),
    undefined,
    nativeSize(width),
    nativeSize(height),
    PANEL_SLICE,
    PANEL_SLICE,
    PANEL_SLICE,
    PANEL_SLICE,
  );
  p.setScale(UI_SCALE);
  p.setOrigin(opts.originX ?? 0.5, opts.originY ?? opts.originX ?? 0.5);
  return p;
}

/** Resize a panel made by `createPanel` to `width` x `height` screen px. */
export function resizePanel(panel: Phaser.GameObjects.NineSlice, width: number, height: number) {
  panel.setSize(nativeSize(width), nativeSize(height));
}

/** Swap the panel's look. */
export function setPanelVariant(panel: Phaser.GameObjects.NineSlice, variant: PanelVariant) {
  panel.setTexture(TEX.panel(variant));
}

function nativeSize(px: number): number {
  return Math.max(PANEL_SLICE * 2 + 1, Math.round(px / UI_SCALE));
}

/** A thin horizontal divider (3px tall, pixel-art style) as a Graphics object. */
export function createDivider(
  scene: Phaser.Scene,
  x: number,
  y: number,
  width: number,
  color = 0x34305a,
): Phaser.GameObjects.Graphics {
  const g = scene.add.graphics({ x, y });
  g.fillStyle(color, 1);
  g.fillRect(0, 0, width, 3);
  g.fillStyle(0x05040a, 1);
  g.fillRect(0, 3, width, 3);
  return g;
}
