/** Horizontal value slider row (volumes etc). Drag, click, or Left/Right when focused. */
import * as Phaser from "phaser";
import { hexNum, RAMPS } from "../art/palette";
import { Row, type RowOptions } from "./Row";
import { COLOR_NUM, COLORS, fontPx, GRID, playUiSound, TEXT } from "./theme";

export interface SliderOptions extends RowOptions {
  value: number;
  min?: number;
  max?: number;
  step?: number;
  /** Value label formatter (default: percent). */
  format?: (v: number) => string;
  onChange?: (v: number) => void;
}

const TRACK_H = 12;
const KNOB_W = 14;
const KNOB_H = 28;

export class Slider extends Row {
  private value: number;
  private readonly min: number;
  private readonly max: number;
  private readonly step: number;
  private readonly format: (v: number) => string;
  private readonly onChange: ((v: number) => void) | undefined;
  private readonly track: Phaser.GameObjects.Graphics;
  private readonly knob: Phaser.GameObjects.Graphics;
  private readonly valueText: Phaser.GameObjects.Text;
  private readonly trackX: number;
  private readonly trackW: number;
  private dragging = false;

  constructor(scene: Phaser.Scene, x: number, y: number, opts: SliderOptions) {
    super(scene, x, y, opts);
    this.min = opts.min ?? 0;
    this.max = opts.max ?? 1;
    this.step = opts.step ?? 0.05;
    this.value = Phaser.Math.Clamp(opts.value, this.min, this.max);
    this.format = opts.format ?? ((v) => `${Math.round(v * 100)}%`);
    this.onChange = opts.onChange;

    const valueW = 64;
    this.trackX = this.controlX;
    this.trackW = this.controlWidth - valueW - GRID;
    this.track = scene.add.graphics();
    this.knob = scene.add.graphics();
    this.valueText = scene.add
      .text(this.rowWidth - GRID * 2, 0, "", { ...TEXT.number, fontSize: fontPx(19) })
      .setOrigin(1, 0.5);
    const hit = scene.add
      .zone(this.trackX + this.trackW / 2, 0, this.trackW + KNOB_W * 2, KNOB_H + 12)
      .setInteractive({ useHandCursor: true, draggable: false });
    this.add([this.track, this.knob, this.valueText, hit]);

    hit.on(Phaser.Input.Events.GAMEOBJECT_POINTER_OVER, () => this.emit("focus-request"));
    hit.on(Phaser.Input.Events.GAMEOBJECT_POINTER_DOWN, (p: Phaser.Input.Pointer) => {
      this.dragging = true;
      this.setFromPointer(p);
    });
    const move = (p: Phaser.Input.Pointer) => {
      if (this.dragging && p.isDown) this.setFromPointer(p);
    };
    const up = () => {
      if (this.dragging) playUiSound("click");
      this.dragging = false;
    };
    scene.input.on(Phaser.Input.Events.POINTER_MOVE, move);
    scene.input.on(Phaser.Input.Events.POINTER_UP, up);
    scene.input.on(Phaser.Input.Events.POINTER_UP_OUTSIDE, up);
    this.once(Phaser.GameObjects.Events.DESTROY, () => {
      scene.input.off(Phaser.Input.Events.POINTER_MOVE, move);
      scene.input.off(Phaser.Input.Events.POINTER_UP, up);
      scene.input.off(Phaser.Input.Events.POINTER_UP_OUTSIDE, up);
    });
    this.redraw();
  }

  getValue(): number {
    return this.value;
  }

  setValue(v: number, emit = false): this {
    const snapped = Math.round((v - this.min) / this.step) * this.step + this.min;
    const next = Phaser.Math.Clamp(Number(snapped.toFixed(4)), this.min, this.max);
    if (next === this.value) return this;
    this.value = next;
    this.redraw();
    if (emit) this.onChange?.(next);
    return this;
  }

  adjust(dir: -1 | 1): boolean {
    const before = this.value;
    this.setValue(this.value + dir * this.step, true);
    if (this.value !== before) playUiSound("hover");
    return true;
  }

  private setFromPointer(p: Phaser.Input.Pointer): void {
    const local = p.worldX - this.getWorldTransformMatrix().tx - this.trackX;
    const t = Phaser.Math.Clamp(local / this.trackW, 0, 1);
    this.setValue(this.min + t * (this.max - this.min), true);
  }

  protected override onFocusChange(): void {
    this.redraw();
  }

  private redraw(): void {
    const t = (this.value - this.min) / (this.max - this.min);
    const x0 = this.trackX;
    const w = this.trackW;
    const top = -TRACK_H / 2;
    const r = TRACK_H / 2;
    const g = this.track;
    g.clear();
    // groove: dark well with a thin rim (brighter when focused)
    g.fillStyle(COLOR_NUM.ink, 0.9);
    g.fillRoundedRect(x0 - 2, top - 2, w + 4, TRACK_H + 4, r + 2);
    g.lineStyle(1.5, this.focused ? COLOR_NUM.accentDeep : hexNum(RAMPS.steel[1]), 1);
    g.strokeRoundedRect(x0 - 2, top - 2, w + 4, TRACK_H + 4, r + 2);
    // fill: lamp light, bright on top
    const fw = Math.max(0, Math.round(w * t));
    if (fw > 0) {
      const fwr = Math.max(fw, TRACK_H);
      g.fillStyle(hexNum(RAMPS.lamp[2]), 1);
      g.fillRoundedRect(x0, top, fwr, TRACK_H, r);
      g.fillStyle(hexNum(RAMPS.lamp[3]), 1);
      g.fillRoundedRect(x0 + 1, top + 1, fwr - 2, TRACK_H / 2, {
        tl: r - 1,
        tr: r - 1,
        bl: 0,
        br: 0,
      });
      g.fillStyle(hexNum(RAMPS.lamp[5]), 0.55);
      g.fillRoundedRect(x0 + 3, top + 2, fwr - 6, 2, 1);
    }
    // quarter ticks
    g.fillStyle(COLOR_NUM.ink, 0.55);
    for (let i = 1; i < 4; i++)
      g.fillRect(x0 + Math.round((w * i) / 4) - 1, top + 3, 2, TRACK_H - 6);

    const kx = Math.round(x0 + fw - KNOB_W / 2);
    const k = this.knob;
    k.clear();
    if (this.focused) {
      k.fillStyle(COLOR_NUM.accent, 0.25);
      k.fillRoundedRect(kx - 5, -KNOB_H / 2 - 5, KNOB_W + 10, KNOB_H + 10, 9);
    }
    k.fillStyle(COLOR_NUM.ink, 1);
    k.fillRoundedRect(kx - 2, -KNOB_H / 2 - 2, KNOB_W + 4, KNOB_H + 4, 6);
    const top1 = this.focused ? hexNum(RAMPS.lamp[5]) : hexNum(RAMPS.steel[5]);
    const bot1 = this.focused ? hexNum(RAMPS.lamp[3]) : hexNum(RAMPS.steel[3]);
    k.fillStyle(bot1, 1);
    k.fillRoundedRect(kx, -KNOB_H / 2, KNOB_W, KNOB_H, 4);
    k.fillStyle(top1, 1);
    k.fillRoundedRect(kx + 1, -KNOB_H / 2 + 1, KNOB_W - 2, KNOB_H / 2, {
      tl: 3,
      tr: 3,
      bl: 0,
      br: 0,
    });
    k.fillStyle(COLOR_NUM.ink, 0.35);
    k.fillRect(kx + KNOB_W / 2 - 1, -6, 2, 12);

    this.valueText.setText(this.format(this.value));
    this.valueText.setColor(this.focused ? COLORS.accentPale : COLORS.accentBright);
  }
}
