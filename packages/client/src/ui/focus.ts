/**
 * Keyboard focus navigation. A FocusGroup owns an ordered list of focusable widgets and maps
 * arrows / WASD / Enter / Space / Escape onto them. Groups stack per scene: the most recently
 * created live group receives keys (so a modal's buttons steal input from the menu beneath).
 * Pointer hover moves focus too, so mouse and keyboard share one highlight.
 */
import * as Phaser from "phaser";

export interface Focusable {
  setFocused(focused: boolean): void;
  /** Enter / Space. */
  activate?(): void;
  /** Left / right on a vertical group (sliders, selectors). Return true if consumed. */
  adjust?(dir: -1 | 1): boolean;
  /** Disabled items are skipped. */
  isEnabled?(): boolean;
}

/** Event a widget emits (on itself) when the pointer hovers it, to take focus. */
export const FOCUS_REQUEST = "focus-request";

export interface FocusGroupOptions {
  axis?: "vertical" | "horizontal";
  wrap?: boolean;
  /** Escape. */
  onBack?: () => void;
  /** Initially focused index (default 0; -1 for none). */
  initial?: number;
  /** Called whenever focus moves. */
  onFocus?: (item: Focusable, index: number) => void;
}

const stacks = new WeakMap<Phaser.Scene, FocusGroup[]>();

/** True while the user is typing in a DOM text field (keys belong to it, not the game). */
export function isTypingInDom(): boolean {
  const el = document.activeElement;
  return el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement;
}

export class FocusGroup {
  private items: Focusable[] = [];
  private index = -1;
  private destroyed = false;
  private readonly onKeyBound = (e: KeyboardEvent) => this.onKey(e);
  private readonly hoverHandlers = new Map<Focusable, () => void>();

  constructor(
    readonly scene: Phaser.Scene,
    items: Focusable[] = [],
    private readonly opts: FocusGroupOptions = {},
  ) {
    const stack = stacks.get(scene) ?? [];
    stack.push(this);
    stacks.set(scene, stack);
    scene.input.keyboard?.on("keydown", this.onKeyBound);
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.destroy());
    for (const it of items) this.add(it);
    const initial = opts.initial ?? 0;
    if (initial >= 0 && this.items.length > 0) this.focus(initial);
  }

  get focusedIndex(): number {
    return this.index;
  }

  get focused(): Focusable | undefined {
    return this.items[this.index];
  }

  /** True if this group currently receives keyboard input. */
  isActive(): boolean {
    const stack = stacks.get(this.scene);
    return !this.destroyed && stack !== undefined && stack[stack.length - 1] === this;
  }

  add(item: Focusable): this {
    this.items.push(item);
    if (item instanceof Phaser.Events.EventEmitter) {
      const h = () => {
        if (this.isActive()) this.focus(item);
      };
      this.hoverHandlers.set(item, h);
      item.on(FOCUS_REQUEST, h);
    }
    return this;
  }

  focus(target: number | Focusable): void {
    const i = typeof target === "number" ? target : this.items.indexOf(target);
    if (i < 0 || i >= this.items.length || i === this.index) return;
    this.items[this.index]?.setFocused(false);
    this.index = i;
    const item = this.items[i];
    if (!item) return;
    item.setFocused(true);
    this.opts.onFocus?.(item, i);
  }

  /** Clear the highlight (e.g. when the group loses relevance). */
  blur(): void {
    this.items[this.index]?.setFocused(false);
    this.index = -1;
  }

  move(dir: -1 | 1): void {
    const n = this.items.length;
    if (n === 0) return;
    let i = this.index;
    for (let step = 0; step < n; step++) {
      i += dir;
      if (i < 0 || i >= n) {
        if (this.opts.wrap === false) return;
        i = (i + n) % n;
      }
      const it = this.items[i];
      if (it && (it.isEnabled?.() ?? true)) {
        this.focus(i);
        return;
      }
    }
  }

  private onKey(e: KeyboardEvent): void {
    if (!this.isActive() || isTypingInDom()) return;
    const horizontal = this.opts.axis === "horizontal";
    const cur = this.items[this.index];
    switch (e.code) {
      case "ArrowUp":
      case "KeyW":
        if (!horizontal) this.move(-1);
        break;
      case "ArrowDown":
      case "KeyS":
        if (!horizontal) this.move(1);
        break;
      case "ArrowLeft":
      case "KeyA":
        if (horizontal) this.move(-1);
        else cur?.adjust?.(-1);
        break;
      case "ArrowRight":
      case "KeyD":
        if (horizontal) this.move(1);
        else cur?.adjust?.(1);
        break;
      case "Enter":
      case "NumpadEnter":
      case "Space":
        if (e.repeat) return;
        if (cur && (cur.isEnabled?.() ?? true)) cur.activate?.();
        break;
      case "Escape":
        if (e.repeat) return;
        this.opts.onBack?.();
        break;
      default:
        return;
    }
  }

  destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    this.scene.input.keyboard?.off("keydown", this.onKeyBound);
    for (const [item, h] of this.hoverHandlers) {
      (item as unknown as Phaser.Events.EventEmitter).off(FOCUS_REQUEST, h);
    }
    this.hoverHandlers.clear();
    const stack = stacks.get(this.scene);
    if (stack) {
      const i = stack.indexOf(this);
      if (i >= 0) stack.splice(i, 1);
    }
  }
}
