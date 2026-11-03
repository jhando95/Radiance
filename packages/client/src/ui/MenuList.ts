/**
 * Atmospheric text menu (title screen, pause): items are plain pixel text that light up
 * amber when focused, with a flickering lamp marker and a soft glow bar behind them.
 */
import * as Phaser from "phaser";
import { iconTexture, TEX } from "../app/textures";
import { FOCUS_REQUEST, type Focusable, FocusGroup } from "./focus";
import { COLOR_NUM, COLORS, DURATION, playUiSound, TEXT } from "./theme";

export interface MenuEntry {
  label: string;
  onSelect: () => void;
  disabled?: boolean;
  /** Dim note shown after the label (e.g. "soon"). */
  note?: string;
}

export interface MenuListOptions {
  /** Vertical distance between items (default 48). */
  spacing?: number;
  /** Width of the hover glow bar (default 360). */
  width?: number;
  /** Escape handler. */
  onBack?: () => void;
  fontSize?: number;
}

export class MenuItem extends Phaser.GameObjects.Container implements Focusable {
  private readonly text: Phaser.GameObjects.Text;
  private readonly note: Phaser.GameObjects.Text | null;
  private readonly glow: Phaser.GameObjects.Image;
  private readonly lampL: Phaser.GameObjects.Image;
  private readonly lampR: Phaser.GameObjects.Image;
  private focused = false;
  private flicker: Phaser.Tweens.Tween | null = null;

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    private readonly entry: MenuEntry,
    width: number,
    fontSize: number,
  ) {
    super(scene, x, y);
    this.glow = scene.add
      .image(0, 0, TEX.glow)
      .setDisplaySize(width, 56)
      .setTint(COLOR_NUM.accent)
      .setAlpha(0)
      .setBlendMode(Phaser.BlendModes.ADD);
    this.text = scene.add
      .text(0, 0, entry.label, { ...TEXT.subheading, fontSize: `${fontSize}px` })
      .setOrigin(0.5);
    this.note = entry.note
      ? scene.add.text(0, 0, entry.note, TEXT.tiny).setOrigin(0, 0.5).setAlpha(0.8)
      : null;
    const lamp = iconTexture(scene, "ui_lamp");
    const half = this.text.width / 2 + 28;
    this.lampL = scene.add.image(-half, 0, lamp).setScale(2).setAlpha(0);
    this.lampR = scene.add.image(half, 0, lamp).setScale(2).setAlpha(0).setFlipX(true);
    this.add([this.glow, this.text, this.lampL, this.lampR]);
    if (this.note) {
      this.note.setPosition(this.text.width / 2 + 56, 2);
      this.add(this.note);
    }
    this.setSize(Math.max(width * 0.8, this.text.width + 80), fontSize + 20);
    this.setInteractive({ useHandCursor: !entry.disabled });
    this.on(Phaser.Input.Events.GAMEOBJECT_POINTER_OVER, () => {
      if (!entry.disabled) this.emit(FOCUS_REQUEST);
    });
    this.on(Phaser.Input.Events.GAMEOBJECT_POINTER_UP, () => this.activate());
    this.refresh();
    scene.add.existing(this);
  }

  isEnabled(): boolean {
    return !this.entry.disabled;
  }

  setFocused(focused: boolean): void {
    if (focused === this.focused) return;
    this.focused = focused;
    if (focused) playUiSound("hover");
    this.refresh();
  }

  activate(): void {
    if (this.entry.disabled) return;
    playUiSound("click");
    this.scene.tweens.add({
      targets: this.text,
      y: { from: 3, to: 0 },
      duration: DURATION.normal,
      ease: "Quad.easeOut",
    });
    this.entry.onSelect();
  }

  private refresh(): void {
    const on = this.focused && !this.entry.disabled;
    this.text.setColor(
      this.entry.disabled ? COLORS.textMuted : on ? COLORS.accentBright : COLORS.textDim,
    );
    this.scene.tweens.killTweensOf([this.glow, this.lampL, this.lampR]);
    this.scene.tweens.add({
      targets: this.glow,
      alpha: on ? 0.5 : 0,
      duration: DURATION.normal,
    });
    this.scene.tweens.add({
      targets: [this.lampL, this.lampR],
      alpha: on ? 1 : 0,
      duration: DURATION.fast,
    });
    this.flicker?.remove();
    this.flicker = null;
    if (on) {
      this.flicker = this.scene.tweens.add({
        targets: this.glow,
        alpha: { from: 0.5, to: 0.36 },
        duration: 140,
        yoyo: true,
        repeat: -1,
        repeatDelay: 400,
        delay: DURATION.normal,
        ease: "Stepped",
        easeParams: [3],
      });
    }
  }
}

export interface MenuList {
  container: Phaser.GameObjects.Container;
  items: MenuItem[];
  group: FocusGroup;
}

/** A vertical menu centered on (x, y) of its first item, with keyboard navigation. */
export function createMenuList(
  scene: Phaser.Scene,
  x: number,
  y: number,
  entries: MenuEntry[],
  opts: MenuListOptions = {},
): MenuList {
  const spacing = opts.spacing ?? 48;
  const width = opts.width ?? 360;
  const container = scene.add.container(x, y);
  const items = entries.map((e, i) => {
    const it = new MenuItem(scene, 0, i * spacing, e, width, opts.fontSize ?? 24);
    container.add(it);
    return it;
  });
  const first = entries.findIndex((e) => !e.disabled);
  const group = new FocusGroup(scene, items, {
    axis: "vertical",
    onBack: opts.onBack,
    initial: first,
  });
  return { container, items, group };
}
