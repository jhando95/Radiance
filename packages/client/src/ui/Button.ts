/**
 * Button: an exact-size frame (HD UI kit, pixel fallback) with idle/hover/pressed/disabled
 * states, a Cinzel label and an optional icon. Focusable (hover and keyboard share the
 * highlight).
 */
import * as Phaser from "phaser";
import { buttonTexture, iconTexture } from "../app/textures";
import type { ButtonKind, ButtonState } from "./artAdapter";
import { FOCUS_REQUEST, type Focusable } from "./focus";
import { COLORS, DURATION, fontPx, GRID, playUiSound, TEXT } from "./theme";

export type { ButtonKind } from "./artAdapter";

export interface ButtonOptions {
  label: string;
  /** Screen px (default 240 x 48). */
  width?: number;
  height?: number;
  kind?: ButtonKind;
  /** Icon id (see textures.iconTexture), drawn left of the label at 28px. */
  icon?: string;
  disabled?: boolean;
  onClick?: () => void;
  /** Small hint drawn under/after the label, e.g. a key binding. */
  hint?: string;
}

const LABEL_COLOR: Record<ButtonKind, { idle: string; hover: string }> = {
  primary: { idle: COLORS.accentBright, hover: COLORS.accentPale },
  secondary: { idle: COLORS.text, hover: COLORS.accentPale },
  danger: { idle: COLORS.danger, hover: "#ffd0b0" },
};

/** Cinzel sits a touch high in its em box; nudge labels down to look optically centered. */
const LABEL_Y = 1;
const ICON_SIZE = 28;

export class Button extends Phaser.GameObjects.Container implements Focusable {
  readonly bg: Phaser.GameObjects.Image;
  private readonly bw: number;
  private readonly bh: number;
  readonly label: Phaser.GameObjects.Text;
  private icon: Phaser.GameObjects.Image | null = null;
  private hintText: Phaser.GameObjects.Text | null = null;
  private focused = false;
  private pressed = false;
  private disabled: boolean;
  private readonly kind: ButtonKind;
  onClick: (() => void) | undefined;

  constructor(scene: Phaser.Scene, x: number, y: number, opts: ButtonOptions) {
    super(scene, x, y);
    const w = opts.width ?? 240;
    const h = opts.height ?? 48;
    this.kind = opts.kind ?? "secondary";
    this.disabled = opts.disabled ?? false;
    this.onClick = opts.onClick;

    this.bw = Math.round(w);
    this.bh = Math.round(h);
    this.bg = scene.add.image(0, 0, this.frameKey("idle")).setDisplaySize(this.bw, this.bh);
    // Small buttons get a slightly smaller label so it never crowds the frame.
    const labelStyle = h < 40 ? { ...TEXT.button, fontSize: fontPx(17, 0.5) } : TEXT.button;
    this.label = scene.add.text(0, LABEL_Y, opts.label, labelStyle).setOrigin(0.5);
    this.add([this.bg, this.label]);

    if (opts.icon) {
      this.icon = scene.add
        .image(0, 0, iconTexture(scene, opts.icon))
        .setDisplaySize(ICON_SIZE, ICON_SIZE);
      this.add(this.icon);
    }
    if (opts.hint) {
      this.hintText = scene.add.text(0, 0, opts.hint, TEXT.tiny).setOrigin(1, 0.5);
      this.add(this.hintText);
    }
    this.layout(w);

    this.setSize(w, h);
    this.setInteractive({ useHandCursor: true });
    this.on(Phaser.Input.Events.GAMEOBJECT_POINTER_OVER, () => {
      if (this.disabled) return;
      this.emit(FOCUS_REQUEST);
      if (!this.focused) this.setFocused(true);
    });
    this.on(Phaser.Input.Events.GAMEOBJECT_POINTER_OUT, () => {
      this.pressed = false;
      this.refresh();
    });
    this.on(Phaser.Input.Events.GAMEOBJECT_POINTER_DOWN, () => {
      if (this.disabled) return;
      this.pressed = true;
      this.refresh();
    });
    this.on(Phaser.Input.Events.GAMEOBJECT_POINTER_UP, () => {
      if (!this.pressed) return;
      this.pressed = false;
      this.refresh();
      this.activate();
    });
    this.refresh();
    scene.add.existing(this);
  }

  private frameKey(state: ButtonState): string {
    return buttonTexture(this.scene, state, this.bw, this.bh, this.kind);
  }

  private layout(w: number): void {
    if (this.icon) {
      const gap = GRID;
      const total = ICON_SIZE + gap + this.label.width;
      this.icon.setPosition(-total / 2 + ICON_SIZE / 2, 0);
      this.label.setPosition(-total / 2 + ICON_SIZE + gap + this.label.width / 2, LABEL_Y);
    }
    if (this.hintText) this.hintText.setPosition(w / 2 - 14, 0);
  }

  setLabel(text: string): this {
    this.label.setText(text);
    this.layout(this.width);
    return this;
  }

  setEnabled(enabled: boolean): this {
    this.disabled = !enabled;
    if (this.disabled) this.focused = false;
    this.refresh();
    return this;
  }

  isEnabled(): boolean {
    return !this.disabled;
  }

  setFocused(focused: boolean): void {
    if (focused && !this.focused && !this.disabled) playUiSound("hover");
    this.focused = focused && !this.disabled;
    if (!this.focused) this.pressed = false;
    this.refresh();
  }

  /** Programmatic click (keyboard Enter). Plays a short press animation. */
  activate(): void {
    if (this.disabled) return;
    playUiSound("click");
    this.bg.setTexture(this.frameKey("pressed")).setDisplaySize(this.bw, this.bh);
    this.label.setY(LABEL_Y + 2);
    this.scene.time.delayedCall(DURATION.fast, () => {
      if (this.active) this.refresh();
    });
    this.onClick?.();
  }

  private refresh(): void {
    if (!this.active) return;
    const state: ButtonState = this.disabled
      ? "disabled"
      : this.pressed
        ? "pressed"
        : this.focused
          ? "hover"
          : "idle";
    this.bg.setTexture(this.frameKey(state)).setDisplaySize(this.bw, this.bh);
    const c = LABEL_COLOR[this.kind];
    this.label.setColor(this.disabled ? COLORS.textMuted : this.focused ? c.hover : c.idle);
    this.label.setY(state === "pressed" ? LABEL_Y + 2 : LABEL_Y);
    this.icon?.setAlpha(this.disabled ? 0.4 : 1);
    if (this.input) this.input.cursor = this.disabled ? "default" : "pointer";
  }
}

/** Convenience factory. */
export function createButton(scene: Phaser.Scene, x: number, y: number, opts: ButtonOptions) {
  return new Button(scene, x, y, opts);
}
