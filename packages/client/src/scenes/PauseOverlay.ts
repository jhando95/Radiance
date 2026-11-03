/**
 * Pause menu overlay for gameplay scenes. `openPause(scene, opts)` pauses the scene and launches
 * this overlay above it: Resume, Settings, How to Play, Abandon Expedition (with confirm).
 * `bindPauseKey(scene, opts)` wires Esc to open it.
 */
import * as Phaser from "phaser";
import { SCENES } from "../app/scenes";
import { iconTexture, TEX } from "../app/textures";
import { goTo } from "../app/transitions";
import { createMenuList } from "../ui/MenuList";
import { confirmDialog } from "../ui/Modal";
import { createDivider, createPanel } from "../ui/Panel";
import { COLOR_NUM, DURATION, GAME_H, GAME_W, playUiSound, TEXT } from "../ui/theme";

export interface PauseOptions {
  /**
   * Called after the player confirms abandoning. The overlay has closed and the gameplay scene
   * is resumed; navigate away from it here (e.g. close the session and `goTo(scene, title)`).
   * Default: `goTo(scene, SCENES.title)`.
   */
  onAbandon?: (scene: Phaser.Scene) => void;
  /** Called after the overlay closes via Resume / Esc. */
  onResume?: (scene: Phaser.Scene) => void;
  /** Label for the abandon entry (default "Abandon Expedition"). */
  abandonLabel?: string;
  /** Confirm dialog body text. */
  abandonWarning?: string;
}

interface PauseData extends PauseOptions {
  parent: string;
}

let lastClosed = 0;

/** Pause `scene` and show the pause menu above it. No-op if already open. */
export function openPause(scene: Phaser.Scene, opts: PauseOptions = {}): void {
  const mgr = scene.scene;
  if (mgr.isActive(SCENES.pause) || mgr.isSleeping(SCENES.pause)) return;
  if (performance.now() - lastClosed < 200) return;
  playUiSound("click");
  mgr.pause();
  const data: PauseData = { ...opts, parent: mgr.key };
  mgr.launch(SCENES.pause, data);
  mgr.bringToTop(SCENES.pause);
}

/** Open the pause menu when Esc is pressed in `scene`. */
export function bindPauseKey(scene: Phaser.Scene, opts: PauseOptions = {}): void {
  const handler = () => openPause(scene, opts);
  scene.input.keyboard?.on("keydown-ESC", handler);
  scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () =>
    scene.input.keyboard?.off("keydown-ESC", handler),
  );
}

export class PauseOverlay extends Phaser.Scene {
  private opts: PauseData = { parent: "" };
  private closing = false;
  private root!: Phaser.GameObjects.Container;
  private dim!: Phaser.GameObjects.Rectangle;

  constructor() {
    super({ key: SCENES.pause });
  }

  init(data: PauseData): void {
    this.opts = data;
    this.closing = false;
  }

  create(): void {
    this.dim = this.add
      .rectangle(0, 0, GAME_W, GAME_H, COLOR_NUM.ink, 0.66)
      .setOrigin(0)
      .setInteractive();
    this.add.image(GAME_W / 2, GAME_H / 2, TEX.vignette).setDisplaySize(GAME_W, GAME_H);

    const w = 456;
    const h = 384;
    this.root = this.add.container(GAME_W / 2, GAME_H / 2);
    const glow = this.add
      .image(0, -h / 2 + 20, TEX.glow)
      .setDisplaySize(520, 240)
      .setTint(COLOR_NUM.accent)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setAlpha(0.18);
    const panel = createPanel(this, 0, 0, w, h);
    const title = this.add
      .text(0, -h / 2 + 48, "PAUSED", { ...TEXT.title, letterSpacing: 6 })
      .setOrigin(0, 0.5);
    // Center lamp + title as one group.
    const groupW = 48 + 12 + title.width;
    const lamp = this.add
      .image(-groupW / 2 + 24, -h / 2 + 48, iconTexture(this, "ui_lamp"))
      .setScale(3);
    title.setX(-groupW / 2 + 60);
    const rule = createDivider(this, -w / 2 + 32, -h / 2 + 84, w - 64);
    const hint = this.add
      .text(0, h / 2 - 28, "Esc  resume", { ...TEXT.tiny })
      .setOrigin(0.5)
      .setAlpha(0.8);
    this.root.add([glow, panel, lamp, title, rule, hint]);

    const menu = createMenuList(
      this,
      0,
      -h / 2 + 128,
      [
        { label: "Resume", onSelect: () => this.resume() },
        { label: "Settings", onSelect: () => this.openSub(SCENES.settings) },
        { label: "How to Play", onSelect: () => this.openSub(SCENES.howToPlay) },
        {
          label: this.opts.abandonLabel ?? "Abandon Expedition",
          onSelect: () => void this.abandon(),
        },
      ],
      { spacing: 52, width: 380, onBack: () => this.resume() },
    );
    this.root.add(menu.container);

    this.dim.setAlpha(0);
    this.root.setAlpha(0).setY(GAME_H / 2 + 12);
    this.tweens.add({ targets: this.dim, alpha: 1, duration: DURATION.normal });
    this.tweens.add({
      targets: this.root,
      alpha: 1,
      y: GAME_H / 2,
      duration: DURATION.normal,
      ease: "Quad.out",
    });
    // Ensure sub-screens returning to us re-raise the overlay.
    this.events.on(Phaser.Scenes.Events.WAKE, () => this.scene.bringToTop());
  }

  private parentScene(): Phaser.Scene | null {
    return this.opts.parent ? this.scene.get(this.opts.parent) : null;
  }

  private openSub(key: string): void {
    if (this.closing) return;
    this.scene.launch(key, { overlay: true, returnTo: SCENES.pause });
    this.scene.bringToTop(key);
    this.scene.sleep();
  }

  private close(then: (parent: Phaser.Scene | null) => void): void {
    if (this.closing) return;
    this.closing = true;
    this.tweens.add({ targets: [this.dim, this.root], alpha: 0, duration: DURATION.fast });
    this.time.delayedCall(DURATION.fast, () => {
      const parent = this.parentScene();
      lastClosed = performance.now();
      if (parent) this.scene.resume(parent);
      this.scene.stop();
      then(parent);
    });
  }

  private resume(): void {
    playUiSound("back");
    this.close((p) => {
      if (p) this.opts.onResume?.(p);
    });
  }

  private async abandon(): Promise<void> {
    const ok = await confirmDialog(this, {
      title: "Abandon expedition?",
      body:
        this.opts.abandonWarning ??
        "Your squad retreats to the dropship. Unbanked loot from this expedition is lost.",
      confirmLabel: "Abandon",
      cancelLabel: "Keep going",
      danger: true,
    });
    if (!ok) return;
    const onAbandon = this.opts.onAbandon;
    this.close((p) => {
      if (!p) return;
      if (onAbandon) onAbandon(p);
      else goTo(p, SCENES.title);
    });
  }
}
