/**
 * High-resolution rendering.
 *
 * All game code lays out in a LOGICAL 1280x720 space (GAME_W x GAME_H). The canvas is
 * RENDER_SCALE times larger (1920x1080), and every scene's main camera is zoomed by
 * RENDER_SCALE so logical coordinates still map to the full screen. Result: sprites, vector
 * art and text are rasterized at full-HD instead of being upscaled from 720p.
 *
 * Rules for game code:
 * - Lay out in logical coordinates as before.
 * - Use `pointer.worldX/worldY` (not `pointer.x/y`) for positions.
 * - HD art is drawn at RENDER px (canvas px = logical px × RENDER_SCALE); display it with
 *   `setScale(1 / RENDER_SCALE)` (see `hdScale`).
 */
import * as Phaser from "phaser";
import { GAME_H, GAME_W } from "../ui/theme";

export const RENDER_SCALE = 1.5;
export const RENDER_W = Math.round(GAME_W * RENDER_SCALE);
export const RENDER_H = Math.round(GAME_H * RENDER_SCALE);

/** Scale to apply to an image whose canvas was drawn in render pixels. */
export const hdScale = (extra = 1) => extra / RENDER_SCALE;

/** Text is rasterized at this resolution so it stays crisp on 1080p–1440p screens. */
export const TEXT_RESOLUTION = Math.min(
  3,
  Math.max(2, Math.ceil(RENDER_SCALE * (globalThis.devicePixelRatio || 1))),
);

function fitCamera(scene: Phaser.Scene): void {
  const cam = scene.cameras?.main;
  if (!cam) return;
  cam.setZoom(RENDER_SCALE);
  cam.centerOn(GAME_W / 2, GAME_H / 2);
}

/** Zoom every scene's main camera so logical 1280x720 fills the 1920x1080 canvas. */
export function installHiRes(game: Phaser.Game): void {
  const hook = (scene: Phaser.Scene) => {
    const events = scene.sys.events;
    // Before create() so scenes that read/adjust the camera in create() see the final zoom.
    events.on(Phaser.Scenes.Events.START, () => fitCamera(scene));
    events.on(Phaser.Scenes.Events.CREATE, () => fitCamera(scene));
  };
  const hooked = new WeakSet<Phaser.Scene>();
  const hookAll = () => {
    for (const scene of game.scene.scenes) {
      if (hooked.has(scene)) continue;
      hooked.add(scene);
      hook(scene);
    }
  };
  hookAll();
  // Scenes added later (gameplay, overlays) are picked up on the next frame before they render.
  game.events.on(Phaser.Core.Events.PRE_STEP, hookAll);
}

/** Make every Phaser Text rasterize at TEXT_RESOLUTION (crisp at any display size). */
export function installCrispText(TextClass: typeof Phaser.GameObjects.Text): void {
  const proto = TextClass.prototype as Phaser.GameObjects.Text & { __crisp?: boolean };
  if (proto.__crisp) return;
  proto.__crisp = true;
  const original = proto.setText;
  proto.setText = function (this: Phaser.GameObjects.Text, value: string | string[]) {
    if (this.style && this.style.resolution !== TEXT_RESOLUTION)
      this.style.resolution = TEXT_RESOLUTION;
    return original.call(this, value);
  };
}

/** Register a pixel-art canvas as a texture with nearest-neighbour filtering (stays crisp). */
export function addPixelTexture(
  scene: Phaser.Scene,
  key: string,
  canvas: HTMLCanvasElement,
): string {
  if (!scene.textures.exists(key)) {
    scene.textures.addCanvas(key, canvas)?.setFilter(Phaser.Textures.FilterMode.NEAREST);
  }
  return key;
}

/** Register an HD (smooth) canvas as a texture with linear filtering. */
export function addHdTexture(scene: Phaser.Scene, key: string, canvas: HTMLCanvasElement): string {
  if (!scene.textures.exists(key)) {
    scene.textures.addCanvas(key, canvas)?.setFilter(Phaser.Textures.FilterMode.LINEAR);
  }
  return key;
}
