/**
 * Texture cache for procedurally drawn art. Every function is idempotent: the first call
 * draws the canvas and registers it with Phaser's texture manager, later calls just return
 * the key. Textures live on the game (not the scene) so any scene can use them after boot.
 */
import * as Phaser from "phaser";
import { RARITY_COLORS } from "../art/palette";
import { makeCanvas } from "../art/pixel";
import {
  type ButtonState,
  barFrameCanvas,
  biomeBackdropLayers,
  buttonCanvas,
  enemyCanvas,
  iconCanvas,
  iconIds,
  lightConeCanvas,
  mapBackdropCanvas,
  mercCanvas,
  type PanelVariant,
  panelCanvas,
  type Rarity,
  slotCanvas,
  titleLogoCanvas,
} from "../ui/artAdapter";

/** Native size of 9-slice source canvases and their border (slice) width. */
export const PANEL_SRC = 24;
export const PANEL_SLICE = 4;

export const TEX = {
  panel: (v: PanelVariant = "default") => `ui.panel.${v}`,
  /** Buttons are drawn at exact native size: `ui.button.<state>.<w>x<h>`. */
  button: (s: ButtonState, w: number, h: number) => `ui.button.${s}.${w}x${h}`,
  slot: (r?: Rarity) => `ui.slot.${r ?? "empty"}`,
  bar: "ui.bar",
  lightCone: "ui.lightcone",
  logo: "ui.logo",
  icon: (id: string) => `icon.${id}`,
  /** 1x1 white pixel for particles / tinted rects. */
  pixel: "fx.pixel",
  /** White right-pointing pixel arrow (4x7), tint it; flipX for left. */
  arrow: "ui.arrow",
  /** 2x2 white pixel dot. */
  dot: "fx.dot",
  /** Smooth white radial glow (256px), tint + ADD blend for light. */
  glow: "fx.glow",
  /** Soft vignette, full screen. */
  vignette: "fx.vignette",
  merc: (i: number) => `shell.merc.${i}`,
  enemy: (i: number) => `shell.enemy.${i}`,
} as const;

/** Register `draw()` under `key` unless it already exists. Returns the key. */
export function ensureTexture(
  scene: Phaser.Scene,
  key: string,
  draw: () => HTMLCanvasElement | null,
): string {
  if (scene.textures.exists(key)) return key;
  const canvas = draw();
  if (!canvas) return key;
  scene.textures.addCanvas(key, canvas)?.setFilter(Phaser.Textures.FilterMode.NEAREST);
  return key;
}

/** True if the texture exists (e.g. the optional title logo). */
export function hasTexture(scene: Phaser.Scene, key: string): boolean {
  return scene.textures.exists(key);
}

const RARITIES = Object.keys(RARITY_COLORS) as Rarity[];
const PANEL_VARIANTS: PanelVariant[] = ["default", "inset", "highlight"];

/** Generate the UI kit: panels, buttons, slots, bar frame, light cone, logo, fx textures. */
export function ensureUiTextures(scene: Phaser.Scene): void {
  for (const v of PANEL_VARIANTS) {
    ensureTexture(scene, TEX.panel(v), () => panelCanvas(PANEL_SRC, PANEL_SRC, v));
  }
  ensureTexture(scene, TEX.slot(), () => slotCanvas());
  for (const r of RARITIES) ensureTexture(scene, TEX.slot(r), () => slotCanvas(r));
  ensureTexture(scene, TEX.bar, () => barFrameCanvas(32));
  ensureTexture(scene, TEX.lightCone, () => lightConeCanvas(48));
  ensureTexture(scene, TEX.logo, () => titleLogoCanvas());
  ensureFxTextures(scene);
}

/** Button texture at native size `w` x `h` (screen size / UI_SCALE). Returns the key. */
export function buttonTexture(scene: Phaser.Scene, state: ButtonState, w: number, h: number) {
  return ensureTexture(scene, TEX.button(state, w, h), () => buttonCanvas(w, h, state));
}

/** Particle dots, smooth glow and vignette. */
export function ensureFxTextures(scene: Phaser.Scene): void {
  ensureTexture(scene, TEX.pixel, () => solid(1, 1));
  ensureTexture(scene, TEX.dot, () => solid(2, 2));
  ensureTexture(scene, TEX.arrow, () => {
    const c = makeCanvas(4, 7);
    const ctx = c.getContext("2d");
    if (ctx) {
      ctx.fillStyle = "#ffffff";
      for (let x = 0; x < 4; x++) ctx.fillRect(x, x, 1, 7 - x * 2);
    }
    return c;
  });
  ensureTexture(scene, TEX.glow, () => {
    const s = 256;
    const c = makeCanvas(s, s);
    const ctx = c.getContext("2d");
    if (!ctx) return c;
    const g = ctx.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
    g.addColorStop(0, "rgba(255,255,255,1)");
    g.addColorStop(0.25, "rgba(255,255,255,0.55)");
    g.addColorStop(0.6, "rgba(255,255,255,0.15)");
    g.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, s, s);
    return c;
  });
  ensureTexture(scene, TEX.vignette, () => {
    const w = 320;
    const h = 180;
    const c = makeCanvas(w, h);
    const ctx = c.getContext("2d");
    if (!ctx) return c;
    const g = ctx.createRadialGradient(w / 2, h / 2, h * 0.35, w / 2, h / 2, w * 0.62);
    g.addColorStop(0, "rgba(5,4,10,0)");
    g.addColorStop(1, "rgba(5,4,10,0.92)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
    return c;
  });
}

function solid(w: number, h: number): HTMLCanvasElement {
  const c = makeCanvas(w, h);
  const ctx = c.getContext("2d");
  if (ctx) {
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, w, h);
  }
  return c;
}

/** Icon texture key for `id` (generated on demand). */
export function iconTexture(scene: Phaser.Scene, id: string): string {
  return ensureTexture(scene, TEX.icon(id), () => iconCanvas(id));
}

/** Generate icon textures (all known ids by default). Returns their keys. */
export function ensureIconTextures(scene: Phaser.Scene, ids: readonly string[] = iconIds()) {
  return ids.map((id) => iconTexture(scene, id));
}

/** Overworld/title backdrop (320x180 native). Returns the texture key. */
export function mapBackdropTexture(scene: Phaser.Scene, seed = 1): string {
  return ensureTexture(scene, `bg.map.${seed}`, () => mapBackdropCanvas(seed));
}

/** Parallax layers for a biome backdrop, back to front. Returns texture keys. */
export function backdropTexture(scene: Phaser.Scene, biome: string, seed = 1): string[] {
  const prefix = `bg.${biome}.${seed}`;
  const first = `${prefix}.0`;
  if (scene.textures.exists(first)) {
    const keys: string[] = [];
    for (let i = 0; scene.textures.exists(`${prefix}.${i}`); i++) keys.push(`${prefix}.${i}`);
    return keys;
  }
  const layers = biomeBackdropLayers(biome, seed);
  return layers.map((canvas, i) => ensureTexture(scene, `${prefix}.${i}`, () => canvas));
}

/** Shell illustration sprites (How to Play). */
export function mercTexture(scene: Phaser.Scene, i: number): string {
  return ensureTexture(scene, TEX.merc(i), () => mercCanvas(i));
}
export function enemyTexture(scene: Phaser.Scene, i: number): string {
  return ensureTexture(scene, TEX.enemy(i), () => enemyCanvas(i));
}
