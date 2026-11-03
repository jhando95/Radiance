/** "◂ value ▸" option cycler row. Click the arrows, or Left/Right / Enter when focused. */
import * as Phaser from "phaser";
import { hexNum } from "../art/palette";
import { TEX } from "../app/textures";
import { Row, type RowOptions } from "./Row";
import { COLORS, DURATION, GRID, playUiSound, TEXT, UI_SCALE } from "./theme";

export interface SelectorOption<T> {
  value: T;
  label: string;
}

export interface SelectorOptions<T> extends RowOptions {
  options: ReadonlyArray<SelectorOption<T>>;
  value: T;
  onChange?: (v: T) => void;
  /** Wrap around at the ends (default false). */
  wrap?: boolean;
}

export class Selector<T> extends Row {
  private index: number;
  private readonly options: ReadonlyArray<SelectorOption<T>>;
  private readonly onChange: ((v: T) => void) | undefined;
  private readonly wrap: boolean;
  private readonly valueText: Phaser.GameObjects.Text;
  private readonly left: Phaser.GameObjects.Image;
  private readonly right: Phaser.GameObjects.Image;
  private readonly pips: Phaser.GameObjects.Graphics;
  private readonly centerX: number;

  constructor(scene: Phaser.Scene, x: number, y: number, opts: SelectorOptions<T>) {
    super(scene, x, y, opts);
    this.options = opts.options;
    this.onChange = opts.onChange;
    this.wrap = opts.wrap ?? false;
    this.index = Math.max(
      0,
      opts.options.findIndex((o) => Object.is(o.value, opts.value)),
    );
    const x0 = this.controlX;
    const x1 = this.rowWidth - GRID * 2;
    this.centerX = (x0 + x1) / 2;
    this.left = scene.add.image(x0 + 8, -3, TEX.arrow).setScale(UI_SCALE).setFlipX(true);
    this.right = scene.add.image(x1 - 8, -3, TEX.arrow).setScale(UI_SCALE);
    this.valueText = scene.add.text(this.centerX, -4, "", TEXT.number).setOrigin(0.5);
    this.pips = scene.add.graphics();
    this.add([this.left, this.right, this.valueText, this.pips]);
    for (const [arrow, dir] of [
      [this.left, -1],
      [this.right, 1],
    ] as const) {
      arrow.setInteractive({
        useHandCursor: true,
        hitArea: new Phaser.Geom.Rectangle(-4, -3, 12, 13),
        hitAreaCallback: Phaser.Geom.Rectangle.Contains,
      });
      arrow.on(Phaser.Input.Events.GAMEOBJECT_POINTER_OVER, () => this.emit("focus-request"));
      arrow.on(Phaser.Input.Events.GAMEOBJECT_POINTER_UP, () => this.step(dir, true));
    }
    this.redraw();
  }

  getValue(): T {
    return (this.options[this.index] as SelectorOption<T>).value;
  }

  setValue(v: T): this {
    const i = this.options.findIndex((o) => Object.is(o.value, v));
    if (i >= 0 && i !== this.index) {
      this.index = i;
      this.redraw();
    }
    return this;
  }

  adjust(dir: -1 | 1): boolean {
    this.step(dir, true);
    return true;
  }

  activate(): void {
    this.step(1, true, true);
  }

  protected override onRowClick(): void {
    this.step(1, true, true);
  }

  protected override onFocusChange(): void {
    this.redraw();
  }

  private step(dir: -1 | 1, emit: boolean, forceWrap = false): void {
    const n = this.options.length;
    let i = this.index + dir;
    if (i < 0 || i >= n) {
      if (!this.wrap && !forceWrap) return;
      i = (i + n) % n;
    }
    this.index = i;
    playUiSound("click");
    this.redraw();
    this.scene.tweens.add({
      targets: this.valueText,
      x: { from: this.centerX + dir * 8, to: this.centerX },
      duration: DURATION.normal,
      ease: "Quad.out",
    });
    if (emit) this.onChange?.(this.getValue());
  }

  private redraw(): void {
    const opt = this.options[this.index];
    this.valueText.setText(opt?.label ?? "");
    this.valueText.setColor(this.focused ? COLORS.accentPale : COLORS.accentBright);
    const atStart = !this.wrap && this.index === 0;
    const atEnd = !this.wrap && this.index === this.options.length - 1;
    const tint = (dim: boolean) =>
      hexNum(dim ? COLORS.line : this.focused ? COLORS.accent : COLORS.textDim);
    this.left.setTint(tint(atStart));
    this.right.setTint(tint(atEnd));
    // position pips under the value
    const g = this.pips;
    g.clear();
    const n = this.options.length;
    const pw = 9;
    const gap = 6;
    const total = n * pw + (n - 1) * gap;
    for (let i = 0; i < n; i++) {
      const on = i === this.index;
      g.fillStyle(on ? 0xf2a93b : 0x34305a, 1);
      g.fillRect(this.centerX - total / 2 + i * (pw + gap), 14, pw, 3);
    }
  }
}
