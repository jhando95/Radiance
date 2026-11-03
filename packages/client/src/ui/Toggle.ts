/** On/off switch row. Click, Enter/Space or Left/Right when focused. */
import type * as Phaser from "phaser";
import { hexNum, RAMPS } from "../art/palette";
import { Row, type RowOptions } from "./Row";
import { COLOR_NUM, COLORS, DURATION, GRID, playUiSound, TEXT } from "./theme";

export interface ToggleOptions extends RowOptions {
  value: boolean;
  onChange?: (v: boolean) => void;
  /** Labels for the two states (default ON / OFF). */
  onLabel?: string;
  offLabel?: string;
}

const SW_W = 64;
const SW_H = 30;

export class Toggle extends Row {
  private value: boolean;
  private readonly onChange: ((v: boolean) => void) | undefined;
  private readonly sw: Phaser.GameObjects.Graphics;
  private readonly knob: Phaser.GameObjects.Graphics;
  private readonly stateText: Phaser.GameObjects.Text;
  private readonly onLabel: string;
  private readonly offLabel: string;
  private readonly swX: number;

  constructor(scene: Phaser.Scene, x: number, y: number, opts: ToggleOptions) {
    super(scene, x, y, opts);
    this.value = opts.value;
    this.onChange = opts.onChange;
    this.onLabel = opts.onLabel ?? "ON";
    this.offLabel = opts.offLabel ?? "OFF";
    this.swX = this.rowWidth - GRID * 2 - SW_W;
    this.sw = scene.add.graphics();
    this.knob = scene.add.graphics();
    this.stateText = scene.add
      .text(this.swX - GRID * 2, 0, "", { ...TEXT.small, fontStyle: "800", letterSpacing: 1 })
      .setOrigin(1, 0.5);
    this.add([this.sw, this.knob, this.stateText]);
    this.redraw(false);
  }

  getValue(): boolean {
    return this.value;
  }

  setValue(v: boolean, emit = false): this {
    if (v === this.value) return this;
    this.value = v;
    this.redraw(true);
    if (emit) this.onChange?.(v);
    return this;
  }

  activate(): void {
    playUiSound("click");
    this.setValue(!this.value, true);
  }

  adjust(dir: -1 | 1): boolean {
    const want = dir > 0;
    if (want !== this.value) this.activate();
    return true;
  }

  protected override onRowClick(): void {
    this.activate();
  }

  protected override onFocusChange(): void {
    this.redraw(false);
  }

  private redraw(animate: boolean): void {
    const on = this.value;
    const x = this.swX;
    const r = SW_H / 2;
    const g = this.sw;
    g.clear();
    if (this.focused) {
      g.fillStyle(COLOR_NUM.accent, 0.18);
      g.fillRoundedRect(x - 6, -SW_H / 2 - 6, SW_W + 12, SW_H + 12, r + 6);
    }
    g.fillStyle(COLOR_NUM.ink, 1);
    g.fillRoundedRect(x - 2, -SW_H / 2 - 2, SW_W + 4, SW_H + 4, r + 2);
    g.fillStyle(on ? hexNum(RAMPS.lamp[2]) : hexNum(RAMPS.void[2]), 1);
    g.fillRoundedRect(x, -SW_H / 2, SW_W, SW_H, r);
    // inner shade on the lower half
    g.fillStyle(on ? hexNum(RAMPS.lamp[1]) : COLOR_NUM.ink, on ? 0.7 : 0.5);
    g.fillRoundedRect(x + 2, 0, SW_W - 4, SW_H / 2 - 2, { tl: 0, tr: 0, bl: r - 2, br: r - 2 });
    g.lineStyle(1.5, on ? hexNum(RAMPS.lamp[4]) : hexNum(RAMPS.steel[this.focused ? 3 : 2]), 1);
    g.strokeRoundedRect(x, -SW_H / 2, SW_W, SW_H, r);

    const kr = r - 4;
    const kxTarget = on ? x + SW_W - 4 - kr : x + 4 + kr;
    const k = this.knob;
    k.clear();
    k.fillStyle(COLOR_NUM.ink, 0.6);
    k.fillCircle(0, 2, kr + 1);
    const top = on ? hexNum(RAMPS.lamp[5]) : hexNum(RAMPS.steel[5]);
    const bot = on ? hexNum(RAMPS.lamp[4]) : hexNum(RAMPS.steel[3]);
    k.fillStyle(bot, 1);
    k.fillCircle(0, 0, kr);
    k.fillStyle(top, 1);
    k.fillCircle(0, -2, kr - 3);
    this.scene.tweens.killTweensOf(k);
    if (animate) {
      this.scene.tweens.add({ targets: k, x: kxTarget, duration: DURATION.fast, ease: "Quad.out" });
    } else {
      k.x = kxTarget;
    }
    this.stateText.setText(on ? this.onLabel : this.offLabel);
    this.stateText.setColor(on ? COLORS.accentBright : COLORS.textMuted);
  }
}
