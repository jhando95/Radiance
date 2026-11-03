/**
 * Shared screen furniture for shell scenes: the atmospheric backdrop (moon horizon, drifting
 * dust, embers, vignette) and the standard screen header.
 */
import * as Phaser from "phaser";
import { iconTexture, mapBackdropTexture, TEX } from "../app/textures";
import { createDivider } from "./Panel";
import { BACKDROP_SCALE, COLOR_NUM, GAME_H, GAME_W, GRID, TEXT } from "./theme";

export interface BackdropOptions {
  seed?: number;
  /** Darken over the art, 0..1 (default 0). */
  dim?: number;
  /** Slow horizontal parallax drift (default true). */
  drift?: boolean;
  /** Rising ember particles (default true). */
  embers?: boolean;
  /** Floating dust motes (default true). */
  dust?: boolean;
}

export interface Backdrop {
  image: Phaser.GameObjects.Image;
  layers: Phaser.GameObjects.GameObject[];
}

/** Full-screen animated backdrop. Everything sits at depth < 0 so content goes on top. */
export function addBackdrop(scene: Phaser.Scene, opts: BackdropOptions = {}): Backdrop {
  const key = mapBackdropTexture(scene, opts.seed ?? 7);
  const layers: Phaser.GameObjects.GameObject[] = [];
  const img = scene.add
    .image(GAME_W / 2, GAME_H / 2, key)
    .setScale(BACKDROP_SCALE)
    .setDepth(-100);
  layers.push(img);

  if (opts.drift ?? true) {
    scene.tweens.add({
      targets: img,
      // The vignette hides the few edge pixels this exposes.
      x: { from: GAME_W / 2 - 8, to: GAME_W / 2 + 8 },
      y: { from: GAME_H / 2 + 4, to: GAME_H / 2 },
      duration: 26000,
      yoyo: true,
      repeat: -1,
      ease: "Sine.inOut",
    });
  }

  // Parallax star twinkles on top of the backdrop art.
  const stars = scene.add.particles(0, 0, TEX.dot, {
    x: { min: 0, max: GAME_W },
    y: { min: 0, max: GAME_H * 0.6 },
    lifespan: { min: 2400, max: 5200 },
    scale: { min: 1, max: 1.5 },
    alpha: { onEmit: () => 0, onUpdate: (_p, _k, t) => Math.sin(t * Math.PI) * 0.9 },
    tint: [0xc4d3e6, 0xfff3c4, 0x8399ba],
    frequency: 180,
    quantity: 1,
    blendMode: Phaser.BlendModes.ADD,
  });
  stars.setDepth(-90);
  layers.push(stars);

  if (opts.dim && opts.dim > 0) {
    layers.push(
      scene.add.rectangle(0, 0, GAME_W, GAME_H, COLOR_NUM.ink, opts.dim).setOrigin(0).setDepth(-80),
    );
  }

  if (opts.dust ?? true) {
    const dust = scene.add.particles(0, 0, TEX.dot, {
      x: { min: -40, max: GAME_W + 40 },
      y: { min: 0, max: GAME_H },
      lifespan: { min: 9000, max: 16000 },
      speedX: { min: 4, max: 16 },
      speedY: { min: -6, max: 4 },
      scale: { min: 1, max: 2 },
      alpha: { onEmit: () => 0, onUpdate: (_p, _k, t) => Math.sin(t * Math.PI) * 0.45 },
      tint: [0x9c9183, 0x6f665c, 0x8399ba],
      frequency: 260,
      advance: 12000,
    });
    dust.setDepth(-70);
    layers.push(dust);
  }

  if (opts.embers ?? true) {
    const embers = scene.add.particles(0, GAME_H + 8, TEX.dot, {
      x: { min: 0, max: GAME_W },
      lifespan: { min: 5000, max: 9000 },
      speedY: { min: -38, max: -14 },
      speedX: { min: -8, max: 10 },
      scale: { start: 2, end: 1 },
      alpha: { start: 0.9, end: 0 },
      tint: [0xf2a93b, 0xffd36e, 0xc7711c, 0xe78450],
      frequency: 220,
      blendMode: Phaser.BlendModes.ADD,
      advance: 6000,
    });
    embers.setDepth(-60);
    layers.push(embers);
  }

  layers.push(
    scene.add
      .image(GAME_W / 2, GAME_H / 2, TEX.vignette)
      .setDisplaySize(GAME_W, GAME_H)
      .setDepth(-50),
  );
  return { image: img, layers };
}

/** Standard header: lamp icon + title at top-left, a rule under it, optional subtitle. */
export function addHeader(scene: Phaser.Scene, title: string, subtitle?: string) {
  const x = GRID * 8;
  const y = GRID * 7;
  const icon = scene.add.image(x + 16, y, iconTexture(scene, "ui_lamp")).setScale(3);
  const text = scene.add.text(x + 48, y, title, TEXT.title).setOrigin(0, 0.5);
  const parts: Phaser.GameObjects.GameObject[] = [icon, text];
  if (subtitle) {
    parts.push(
      scene.add.text(x + 48 + text.width + GRID * 3, y + 6, subtitle, TEXT.small).setOrigin(0, 0.5),
    );
  }
  parts.push(createDivider(scene, x, y + 34, GAME_W - x * 2, 0x34305a));
  return parts;
}

/** Small key hint like "[Esc] Back" at the bottom right. */
export function addKeyHint(scene: Phaser.Scene, text: string): Phaser.GameObjects.Text {
  return scene.add
    .text(GAME_W - GRID * 8, GAME_H - GRID * 3, text, TEXT.tiny)
    .setOrigin(1, 1)
    .setAlpha(0.8);
}
