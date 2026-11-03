/**
 * Base for labelled form rows (sliders, toggles, selectors, text fields). The container's
 * origin is the row's left edge, vertical center. Hovering focuses the row; the focused row
 * gets a warm highlight band and a lamp-colored edge marker.
 */
import * as Phaser from "phaser";
import { FOCUS_REQUEST, type Focusable } from "./focus";
import { COLOR_NUM, COLORS, DURATION, GRID, playUiSound, TEXT } from "./theme";

export interface RowOptions {
  label: string;
  /** Row width in px (default 512). */
  width?: number;
  /** Row height in px (default 48). */
  height?: number;
  /** Optional helper line under the label. */
  description?: string;
}

export abstract class Row extends Phaser.GameObjects.Container implements Focusable {
  protected readonly highlight: Phaser.GameObjects.Graphics;
  protected readonly labelText: Phaser.GameObjects.Text;
  protected readonly rowWidth: number;
  protected readonly rowHeight: number;
  protected focused = false;

  constructor(scene: Phaser.Scene, x: number, y: number, opts: RowOptions) {
    super(scene, x, y);
    this.rowWidth = opts.width ?? 512;
    this.rowHeight = opts.height ?? 48;
    const w = this.rowWidth;
    const h = this.rowHeight;

    // Focus band: warm light pooling from the left edge, with a lamp-colored marker.
    this.highlight = scene.add.graphics();
    const a = COLOR_NUM.accent;
    this.highlight.fillGradientStyle(a, a, a, a, 0.2, 0.03, 0.2, 0.03);
    this.highlight.fillRect(0, -h / 2, w, h);
    this.highlight.fillStyle(COLOR_NUM.accentBright, 1);
    this.highlight.fillRect(0, -h / 2 + 4, 3, h - 8);
    this.highlight.setAlpha(0);

    this.labelText = scene.add
      .text(GRID * 2, opts.description ? -10 : 0, opts.label, TEXT.body)
      .setOrigin(0, 0.5);
    this.add([this.highlight, this.labelText]);
    if (opts.description) {
      this.add(scene.add.text(GRID * 2, 14, opts.description, TEXT.tiny).setOrigin(0, 0.5));
    }

    // Hover anywhere on the row to focus it.
    const hit = scene.add.zone(w / 2, 0, w, h).setInteractive();
    hit.on(Phaser.Input.Events.GAMEOBJECT_POINTER_OVER, () => this.emit(FOCUS_REQUEST));
    hit.on(Phaser.Input.Events.GAMEOBJECT_POINTER_UP, () => this.onRowClick());
    this.add(hit);
    scene.add.existing(this);
  }

  /** Left edge of the control area (right 55% of the row). */
  protected get controlX(): number {
    return Math.round(this.rowWidth * 0.45);
  }

  protected get controlWidth(): number {
    return this.rowWidth - this.controlX - GRID * 2;
  }

  /** Clicking the row body (not the control). Default: nothing. */
  protected onRowClick(): void {}

  setFocused(focused: boolean): void {
    if (focused === this.focused) return;
    this.focused = focused;
    if (focused) playUiSound("hover");
    this.scene.tweens.killTweensOf(this.highlight);
    this.scene.tweens.add({
      targets: this.highlight,
      alpha: focused ? 1 : 0,
      duration: DURATION.fast,
    });
    this.labelText.setColor(focused ? COLORS.accentPale : COLORS.text);
    this.onFocusChange(focused);
  }

  protected onFocusChange(_focused: boolean): void {}
}
