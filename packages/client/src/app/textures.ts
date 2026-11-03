/**
 * Texture cache for procedurally drawn art. Every function is idempotent: the first call
 * draws the canvas and registers it with Phaser's texture manager, later calls just return
 * the key. Textures live on the game (not the scene) so any scene can use them after boot.
 *
 * HD vs pixel art
 * ---------------
 * The HD art modules (src/art/hd/uiHD.ts, iconsHD.ts, backdrops.ts) are optional: BootScene
 * awaits `loadHdArt()` before generating anything, and every function below uses HD art when
 * its module is loaded and falls back to the pixel art otherwise. Callers never branch.
 *
 * "Base-unit" textures (icons, slots, arrow, backdrops)
 * -----------------------------------------------------
 * Gameplay code sizes these with the old pixel units: an icon is 16x16 and is shown with
 * `setScale(2)` / `setScale(UI_SCALE)`, a slot is 20x20, the arrow 4x7, a backdrop 320x180 at
 * `setScale(BACKDROP_SCALE)`. To keep every such call site working, HD canvases are registered
 * with `addBaseTexture`: the frame REPORTS the old base size (so width, origin, hit areas,
 * `setScale`, `setDisplaySize`, `frame.width/height` all behave exactly as before) while the
 * texture source carries `resolution = canvasPx / basePx`, which Phaser's image renderer divides
 * out. Result: `setScale(3)` on an icon still covers 48x48 logical px, now sampled from a
 * 128px smooth canvas (with mipmaps) instead of a blown-up 16px sprite.
 *
 *   iconTexture(scene, id)          → 16x16 base units (HD: 128px canvas)
 *   TEX.slot(rarity)                → 20x20 base units (HD: 96px canvas)
 *   TEX.arrow                       → 4x7 base units   (HD: 32x56 canvas)
 *   mapBackdropTexture / backdropTexture layers → 180 base units tall (HD: 1080 px tall;
 *     a wider parallax layer, e.g. 2112 px, reports 352 units: draw it centred)
 *
 * Preferred for new code: `iconImage(scene, x, y, id, logicalSize)`.
 * Caveat: base-unit textures are for Images/Sprites. Particle emitters and DynamicTexture
 * draws ignore the source resolution, so don't use icons as particle textures.
 *
 * Panels and buttons (render-px textures)
 * ---------------------------------------
 * Use `createPanel` / `Button` from src/ui; they read `panelMetrics()` to size the 9-slice in
 * whichever units the current art uses. Never assume a panel's scale is UI_SCALE.
 */
import * as Phaser from "phaser";
import { RARITY_COLORS } from "../art/palette";
import { makeCanvas } from "../art/pixel";
import {
  type ButtonKind,
  type ButtonState,
  barFrameCanvas,
  biomeBackdropLayers,
  buttonCanvas,
  enemyCanvas,
  hdBackdrops,
  hdIcons,
  hdUi,
  iconCanvas,
  iconIds,
  lightConeCanvas,
  mapBackdropCanvas,
  mercCanvas,
  type PanelVariant,
  panelCanvas,
  type Rarity,
  slotCanvas,
} from "../ui/artAdapter";
import { GAME_H, GAME_W, UI_SCALE } from "../ui/theme";
import { addHdTexture, RENDER_SCALE } from "./hires";

export { loadHdArt } from "../ui/artAdapter";

/** Native size of pixel 9-slice source canvases and their border (slice) width. */
export const PANEL_SRC = 24;
export const PANEL_SLICE = 4;
/** HD 9-slice source canvas size (render px; not a power of two, so no edge wrap bleed). */
const PANEL_HD_SRC = 120;

/** Base size of an icon (old pixel units). `setScale(k)` shows it at 16*k logical px. */
export const ICON_BASE = 16;
/** Base size of a rarity slot frame. */
export const SLOT_BASE = 20;
/** HD icon canvas size (power of two → mipmapped, crisp at any display size). */
const ICON_HD_PX = 128;
const SLOT_HD_PX = 96;

export const TEX = {
  panel: (v: PanelVariant = "default") => `ui.panel.${v}`,
  /** Buttons are drawn at exact size: `ui.button.<kind>.<state>.<w>x<h>` (logical px). */
  button: (s: ButtonState, w: number, h: number, kind: ButtonKind = "secondary") =>
    `ui.button.${kind}.${s}.${w}x${h}`,
  slot: (r?: Rarity) => `ui.slot.${r ?? "empty"}`,
  bar: "ui.bar",
  lightCone: "ui.lightcone",
  logo: "ui.logo",
  icon: (id: string) => `icon.${id}`,
  /** 1x1 white pixel for particles / tinted rects. */
  pixel: "fx.pixel",
  /** White right-pointing arrow (4x7 base units), tint it; flipX for left. */
  arrow: "ui.arrow",
  /** 2x2 white dot. */
  dot: "fx.dot",
  /** Soft round white spark (32px, smooth), for embers and motes. */
  spark: "fx.spark",
  /** Smooth white radial glow (256px), tint + ADD blend for light. */
  glow: "fx.glow",
  /** Soft vignette, full screen. */
  vignette: "fx.vignette",
  merc: (i: number) => `shell.merc.${i}`,
  enemy: (i: number) => `shell.enemy.${i}`,
} as const;

/** Register `draw()` (pixel art, nearest filtering) under `key` unless it exists. */
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

/** Register `draw()` as a smooth (linear) texture under `key` unless it exists. */
export function ensureSmoothTexture(
  scene: Phaser.Scene,
  key: string,
  draw: () => HTMLCanvasElement | null,
): string {
  if (scene.textures.exists(key)) return key;
  const canvas = draw();
  if (canvas) addHdTexture(scene, key, canvas);
  return key;
}

/**
 * Register a high-res canvas so it behaves like a texture `baseH` units tall (see the header);
 * the width follows the canvas aspect (`baseW` is only a hint for the usual case).
 * Power-of-two canvases keep the renderer's mipmapped minification.
 */
export function addBaseTexture(
  scene: Phaser.Scene,
  key: string,
  canvas: HTMLCanvasElement,
  _baseW: number,
  baseH: number,
): string {
  if (scene.textures.exists(key)) return key;
  const tex = scene.textures.addCanvas(key, canvas);
  if (!tex) return key;
  const pot = isPow2(canvas.width) && isPow2(canvas.height);
  if (!pot) tex.setFilter(Phaser.Textures.FilterMode.LINEAR);
  const res = canvas.height / baseH;
  const baseW = canvas.width / res;
  const src = tex.source[0];
  if (src) src.resolution = res;
  const f = tex.get() as Phaser.Textures.Frame & {
    data: { sourceSize: { w: number; h: number }; spriteSourceSize: { w: number; h: number } };
  };
  f.width = baseW;
  f.height = baseH;
  f.halfWidth = baseW / 2;
  f.halfHeight = baseH / 2;
  f.centerX = Math.floor(baseW / 2);
  f.centerY = Math.floor(baseH / 2);
  f.data.sourceSize.w = baseW;
  f.data.sourceSize.h = baseH;
  f.data.spriteSourceSize.w = baseW;
  f.data.spriteSourceSize.h = baseH;
  return key;
}

const isPow2 = (n: number) => n > 0 && (n & (n - 1)) === 0;

/** True if the texture exists (e.g. the optional title logo). */
export function hasTexture(scene: Phaser.Scene, key: string): boolean {
  return scene.textures.exists(key);
}

/** True when the HD UI kit (panels, buttons, slots) is active. */
export function isHdUi(): boolean {
  return hdUi() !== null;
}

const RARITIES = Object.keys(RARITY_COLORS) as Rarity[];
const PANEL_VARIANTS: PanelVariant[] = ["default", "inset", "highlight"];

/**
 * How panel 9-slices are built: `createPanel` makes a nineslice of (logical size / scale)
 * units with `slice` borders, then `setScale(scale)`.
 */
export function panelMetrics(): { scale: number; slice: number; hd: boolean } {
  const ui = hdUi();
  if (ui) return { scale: 1 / RENDER_SCALE, slice: ui.UI_HD?.panelSlice ?? 30, hd: true };
  return { scale: UI_SCALE, slice: PANEL_SLICE, hd: false };
}

/** Generate the UI kit: panels, buttons, slots, bar frame, light cone, logo, fx textures. */
export function ensureUiTextures(scene: Phaser.Scene): void {
  const ui = hdUi();
  for (const v of PANEL_VARIANTS) {
    if (ui) {
      ensureSmoothTexture(scene, TEX.panel(v), () => ui.drawPanelHD(PANEL_HD_SRC, PANEL_HD_SRC, v));
    } else {
      ensureTexture(scene, TEX.panel(v), () => panelCanvas(PANEL_SRC, PANEL_SRC, v));
    }
  }
  slotTexture(scene);
  for (const r of RARITIES) slotTexture(scene, r);
  ensureTexture(scene, TEX.bar, () => barFrameCanvas(32));
  ensureSmoothTexture(scene, TEX.lightCone, () => lightConeCanvas(48));
  logoTexture(scene);
  ensureFxTextures(scene);
}

/** Slot frame texture key (20x20 base units). */
export function slotTexture(scene: Phaser.Scene, rarity?: Rarity): string {
  const key = TEX.slot(rarity);
  if (scene.textures.exists(key)) return key;
  const ui = hdUi();
  if (ui) {
    try {
      return addBaseTexture(scene, key, ui.drawSlotHD(rarity, SLOT_HD_PX), SLOT_BASE, SLOT_BASE);
    } catch (err) {
      console.warn("drawSlotHD failed", err);
    }
  }
  return ensureTexture(scene, key, () => slotCanvas(rarity));
}

/**
 * Title logo in render px (show at `hdScale()`, or use `logoImage` to fit a width): the HD
 * kit's painted logo when available, else an engraved Cinzel wordmark drawn here.
 * Returns `{ key, hd }` (`hd` is always true now; kept for callers that branch).
 */
export function logoTexture(scene: Phaser.Scene): { key: string; hd: boolean } {
  const key = TEX.logo;
  if (!scene.textures.exists(key)) {
    const draw = hdUi()?.drawTitleLogoHD;
    let canvas: HTMLCanvasElement | null = null;
    if (draw) {
      try {
        canvas = draw();
      } catch (err) {
        console.warn("drawTitleLogoHD failed", err);
      }
    }
    addHdTexture(scene, key, canvas ?? drawWordmark());
  }
  return { key, hd: true };
}

/** "RADIANCE" in Cinzel Black: molten-gold gradient, inked edge, warm bloom, lamp rules. */
function drawWordmark(): HTMLCanvasElement {
  const size = 150;
  const track = 22;
  const text = "RADIANCE";
  const font = `900 ${size}px "Cinzel", "Times New Roman", serif`;
  const probe = makeCanvas(8, 8).getContext("2d");
  let textW = size * 6.2;
  if (probe) {
    probe.font = font;
    textW = probe.measureText(text).width + track * (text.length - 1);
  }
  const padX = 90;
  const w = Math.ceil(textW + padX * 2);
  const h = 250;
  const c = makeCanvas(w, h);
  const ctx = c.getContext("2d");
  if (!ctx) return c;
  const base = 166;
  ctx.font = font;
  ctx.textBaseline = "alphabetic";
  const drawText = (dx = 0, dy = 0) => {
    let x = padX + dx;
    for (const ch of text) {
      ctx.fillText(ch, x, base + dy);
      x += ctx.measureText(ch).width + track;
    }
  };
  // Bloom.
  ctx.save();
  ctx.shadowColor = "rgba(242,169,59,0.55)";
  ctx.shadowBlur = 46;
  ctx.fillStyle = "rgba(122,61,18,0.9)";
  drawText();
  ctx.restore();
  // Inked edge / bevel shadow.
  ctx.save();
  ctx.fillStyle = "#1a0d06";
  drawText(0, 7);
  ctx.lineJoin = "round";
  ctx.lineWidth = 9;
  ctx.strokeStyle = "#140a05";
  let x = padX;
  for (const ch of text) {
    ctx.strokeText(ch, x, base);
    x += ctx.measureText(ch).width + track;
  }
  ctx.restore();
  // Molten gold face.
  const g = ctx.createLinearGradient(0, base - size * 0.72, 0, base + 6);
  g.addColorStop(0, "#fff6d6");
  g.addColorStop(0.32, "#ffd36e");
  g.addColorStop(0.62, "#e39531");
  g.addColorStop(1, "#8a4413");
  ctx.fillStyle = g;
  drawText();
  // Top-edge highlight.
  ctx.save();
  ctx.globalCompositeOperation = "source-atop";
  const sh = ctx.createLinearGradient(0, base - size * 0.72, 0, base - size * 0.45);
  sh.addColorStop(0, "rgba(255,255,240,0.55)");
  sh.addColorStop(1, "rgba(255,255,240,0)");
  ctx.fillStyle = sh;
  ctx.fillRect(0, 0, w, base);
  ctx.restore();
  // Rules with a lamp diamond.
  const ry = base + 34;
  const mid = w / 2;
  for (const dir of [-1, 1]) {
    const lg = ctx.createLinearGradient(mid, 0, mid + dir * (textW / 2 + 30), 0);
    lg.addColorStop(0, "rgba(255,211,110,0.95)");
    lg.addColorStop(1, "rgba(199,113,28,0)");
    ctx.fillStyle = lg;
    ctx.fillRect(
      Math.min(mid + dir * 22, mid + dir * (textW / 2 + 30)),
      ry - 1.5,
      textW / 2 + 8,
      3,
    );
  }
  ctx.save();
  ctx.translate(mid, ry);
  ctx.rotate(Math.PI / 4);
  ctx.shadowColor = "rgba(255,211,110,0.9)";
  ctx.shadowBlur = 16;
  ctx.fillStyle = "#ffe7a6";
  ctx.fillRect(-7, -7, 14, 14);
  ctx.restore();
  return c;
}

/** The title logo as an image no wider than `maxW` logical px (never upscaled past 1:1 HD). */
export function logoImage(
  scene: Phaser.Scene,
  x: number,
  y: number,
  maxW: number,
): Phaser.GameObjects.Image {
  const { key } = logoTexture(scene);
  const img = scene.add.image(x, y, key);
  img.setScale(Math.min(1 / RENDER_SCALE, maxW / img.width));
  return img;
}

/**
 * Button texture at exact size `w` x `h` LOGICAL px. Show it with `setDisplaySize(w, h)`
 * (works for both the HD and the pixel version).
 */
export function buttonTexture(
  scene: Phaser.Scene,
  state: ButtonState,
  w: number,
  h: number,
  kind: ButtonKind = "secondary",
): string {
  const ui = hdUi();
  if (ui) {
    const key = TEX.button(state, w, h, kind);
    return ensureSmoothTexture(scene, key, () =>
      ui.drawButtonHD(Math.round(w * RENDER_SCALE), Math.round(h * RENDER_SCALE), state, kind),
    );
  }
  // Pixel buttons have no kind variants (the label color carries it).
  const nw = Math.round(w / UI_SCALE);
  const nh = Math.round(h / UI_SCALE);
  return ensureTexture(scene, `ui.button.px.${state}.${nw}x${nh}`, () =>
    buttonCanvas(nw, nh, state),
  );
}

/** Particle dots, sparks, smooth glow, vignette and the selector arrow. */
export function ensureFxTextures(scene: Phaser.Scene): void {
  ensureTexture(scene, TEX.pixel, () => solid(1, 1));
  ensureSmoothTexture(scene, TEX.dot, () => solid(2, 2));
  if (!scene.textures.exists(TEX.arrow)) addBaseTexture(scene, TEX.arrow, arrowCanvas(), 4, 7);
  ensureSmoothTexture(scene, TEX.spark, () => radial(32, [0, 1], [0.35, 0.6], [1, 0]));
  ensureSmoothTexture(scene, TEX.glow, () =>
    radial(256, [0, 1], [0.25, 0.55], [0.6, 0.15], [1, 0]),
  );
  ensureSmoothTexture(scene, TEX.vignette, () => {
    const w = 640;
    const h = 360;
    const c = makeCanvas(w, h);
    const ctx = c.getContext("2d");
    if (!ctx) return c;
    const g = ctx.createRadialGradient(w / 2, h / 2, h * 0.35, w / 2, h / 2, w * 0.62);
    g.addColorStop(0, "rgba(5,4,10,0)");
    g.addColorStop(0.55, "rgba(5,4,10,0.45)");
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

function radial(s: number, ...stops: Array<[number, number]>): HTMLCanvasElement {
  const c = makeCanvas(s, s);
  const ctx = c.getContext("2d");
  if (!ctx) return c;
  const g = ctx.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
  for (const [at, a] of stops) g.addColorStop(at, `rgba(255,255,255,${a})`);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, s, s);
  return c;
}

/** Smooth right-pointing chevron-triangle, 8x the 4x7 base. */
function arrowCanvas(): HTMLCanvasElement {
  const c = makeCanvas(32, 56);
  const ctx = c.getContext("2d");
  if (!ctx) return c;
  ctx.fillStyle = "#ffffff";
  ctx.lineJoin = "round";
  ctx.lineWidth = 5;
  ctx.strokeStyle = "#ffffff";
  ctx.beginPath();
  ctx.moveTo(5, 5);
  ctx.lineTo(28, 28);
  ctx.lineTo(5, 51);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  return c;
}

/**
 * Icon texture key for `id` (16x16 base units; HD when available). Existing code that does
 * `image.setScale(k)` keeps showing it at 16*k logical px.
 */
export function iconTexture(scene: Phaser.Scene, id: string): string {
  const key = TEX.icon(id);
  if (scene.textures.exists(key)) return key;
  const icons = hdIcons();
  if (icons) {
    try {
      return addBaseTexture(scene, key, icons.drawIconHD(id, ICON_HD_PX), ICON_BASE, ICON_BASE);
    } catch (err) {
      console.warn(`drawIconHD(${id}) failed`, err);
    }
  }
  return ensureTexture(scene, key, () => iconCanvas(id));
}

/** An icon image `size` x `size` logical px (preferred API for new code). */
export function iconImage(
  scene: Phaser.Scene,
  x: number,
  y: number,
  id: string,
  size = 32,
): Phaser.GameObjects.Image {
  return scene.add.image(x, y, iconTexture(scene, id)).setDisplaySize(size, size);
}

/** Generate icon textures (all known ids by default). Returns their keys. */
export function ensureIconTextures(scene: Phaser.Scene, ids: readonly string[] = iconIds()) {
  return ids.map((id) => iconTexture(scene, id));
}

/** Backdrop base size (old pixel units): show at BACKDROP_SCALE (or fit to GAME_H). */
const BD_W = GAME_W / 4;
const BD_H = GAME_H / 4;

/** Overworld/title backdrop (320x180 base units; HD 1920x1080). Returns the texture key. */
export function mapBackdropTexture(scene: Phaser.Scene, seed = 1): string {
  const key = `bg.map.${seed}`;
  if (scene.textures.exists(key)) return key;
  const draw = hdBackdrops()?.drawMapBackdropHD;
  if (draw) {
    try {
      return addBaseTexture(scene, key, draw(seed), BD_W, BD_H);
    } catch (err) {
      console.warn("drawMapBackdropHD failed", err);
    }
  }
  return ensureTexture(scene, key, () => mapBackdropCanvas(seed));
}

/** Parallax layers for a biome backdrop, back to front (320x180 base units each). */
export function backdropTexture(scene: Phaser.Scene, biome: string, seed = 1): string[] {
  const prefix = `bg.${biome}.${seed}`;
  const first = `${prefix}.0`;
  if (scene.textures.exists(first)) {
    const keys: string[] = [];
    for (let i = 0; scene.textures.exists(`${prefix}.${i}`); i++) keys.push(`${prefix}.${i}`);
    return keys;
  }
  const draw = hdBackdrops()?.drawBackdropHD;
  if (draw) {
    try {
      const layers = draw(biome, seed).layers;
      return layers.map((canvas, i) => addBaseTexture(scene, `${prefix}.${i}`, canvas, BD_W, BD_H));
    } catch (err) {
      console.warn("drawBackdropHD failed", err);
    }
  }
  const layers = biomeBackdropLayers(biome, seed);
  return layers.map((canvas, i) => ensureTexture(scene, `${prefix}.${i}`, () => canvas));
}

/** Shell illustration sprites (pixel fallback for How to Play / debug). 48x48. */
export function mercTexture(scene: Phaser.Scene, i: number): string {
  return ensureTexture(scene, TEX.merc(i), () => mercCanvas(i));
}
export function enemyTexture(scene: Phaser.Scene, i: number): string {
  return ensureTexture(scene, TEX.enemy(i), () => enemyCanvas(i));
}
