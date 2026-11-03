/**
 * Text entry using a real DOM <input> (IME, paste, mobile keyboards for free), styled by
 * `.rad-input` in style.css to match the pixel UI. Requires `dom.createContainer: true`.
 * Keys typed into it never reach Phaser's keyboard handlers.
 */
import * as Phaser from "phaser";
import { Row, type RowOptions } from "./Row";

export interface TextInputOptions {
  /** Width in game px (default 280). */
  width?: number;
  value?: string;
  placeholder?: string;
  maxLength?: number;
  /** Force upper-case (room codes). */
  uppercase?: boolean;
  /** Characters allowed (others are stripped), e.g. /[A-Z0-9]/. */
  allow?: RegExp;
  /** Focus as soon as it is created. */
  autofocus?: boolean;
  /** Extra class names (e.g. "rad-input--code"). */
  className?: string;
  ariaLabel?: string;
  onChange?: (value: string) => void;
  onSubmit?: (value: string) => void;
  onCancel?: () => void;
}

export class TextInput {
  readonly el: HTMLInputElement;
  readonly dom: Phaser.GameObjects.DOMElement;
  private readonly opts: TextInputOptions;

  constructor(scene: Phaser.Scene, x: number, y: number, opts: TextInputOptions = {}) {
    this.opts = opts;
    const el = document.createElement("input");
    el.type = "text";
    el.className = `rad-input ${opts.className ?? ""}`.trim();
    el.spellcheck = false;
    el.autocomplete = "off";
    el.style.width = `${opts.width ?? 280}px`;
    if (opts.placeholder) el.placeholder = opts.placeholder;
    if (opts.maxLength) el.maxLength = opts.maxLength;
    if (opts.ariaLabel) el.setAttribute("aria-label", opts.ariaLabel);
    el.value = this.clean(opts.value ?? "");
    this.el = el;

    el.addEventListener("input", () => {
      const cleaned = this.clean(el.value);
      if (cleaned !== el.value) {
        const pos = el.selectionStart ?? cleaned.length;
        el.value = cleaned;
        el.setSelectionRange(Math.min(pos, cleaned.length), Math.min(pos, cleaned.length));
      }
      opts.onChange?.(el.value);
    });
    el.addEventListener("keydown", (e) => {
      e.stopPropagation(); // keep typing out of Phaser's window key listener
      if (e.key === "Enter") {
        e.preventDefault();
        opts.onSubmit?.(el.value);
      } else if (e.key === "Escape") {
        e.preventDefault();
        el.blur();
        opts.onCancel?.();
      }
    });
    el.addEventListener("keyup", (e) => e.stopPropagation());

    this.dom = scene.add.dom(x, y, el).setOrigin(0.5);
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.destroy());
    if (opts.autofocus) {
      scene.time.delayedCall(30, () => this.focus());
    }
  }

  private clean(v: string): string {
    let out = this.opts.uppercase ? v.toUpperCase() : v;
    const allow = this.opts.allow;
    if (allow) {
      out = [...out].filter((ch) => allow.test(ch)).join("");
    }
    return this.opts.maxLength ? out.slice(0, this.opts.maxLength) : out;
  }

  getValue(): string {
    return this.el.value;
  }

  setValue(v: string): this {
    this.el.value = this.clean(v);
    return this;
  }

  focus(): void {
    this.el.focus({ preventScroll: true });
    this.el.select();
  }

  blur(): void {
    this.el.blur();
  }

  setVisible(v: boolean): this {
    this.dom.setVisible(v);
    return this;
  }

  setInvalid(invalid: boolean): this {
    this.el.classList.toggle("rad-input--invalid", invalid);
    if (invalid) {
      this.el.classList.remove("rad-input--shake");
      void this.el.offsetWidth; // restart the animation
      this.el.classList.add("rad-input--shake");
    }
    return this;
  }

  destroy(): void {
    if (this.dom.active) this.dom.destroy();
    this.el.remove();
  }
}

export function createTextInput(
  scene: Phaser.Scene,
  x: number,
  y: number,
  opts: TextInputOptions = {},
): TextInput {
  return new TextInput(scene, x, y, opts);
}

export interface TextFieldOptions extends RowOptions, Omit<TextInputOptions, "width"> {}

/**
 * Labelled form row with a text input in the control area. The input is positioned in world
 * space at creation; don't move the row afterwards.
 */
export class TextField extends Row {
  readonly field: TextInput;

  constructor(scene: Phaser.Scene, x: number, y: number, opts: TextFieldOptions) {
    super(scene, x, y, opts);
    const w = this.controlWidth;
    this.field = new TextInput(scene, x + this.controlX + w / 2, y, { ...opts, width: w });
    this.field.el.addEventListener("focus", () => this.emit("focus-request"));
    this.once(Phaser.GameObjects.Events.DESTROY, () => this.field.destroy());
  }

  activate(): void {
    this.field.focus();
  }

  protected override onRowClick(): void {
    this.field.focus();
  }

  protected override onFocusChange(focused: boolean): void {
    this.field.el.classList.toggle("rad-input--focus", focused);
  }
}
