/**
 * Modal dialogs: a dimmed backdrop that swallows input, a centered panel with title, body,
 * optional custom content and a row of buttons with keyboard focus. Promise helpers cover
 * the common cases: `confirmDialog` and `promptDialog` (text fields).
 */
import * as Phaser from "phaser";
import type { PanelVariant } from "./artAdapter";
import { Button, type ButtonKind } from "./Button";
import { FocusGroup } from "./focus";
import { createDivider, createPanel } from "./Panel";
import { TextInput } from "./TextInput";
import {
  COLOR_NUM,
  COLORS,
  DEPTH,
  DURATION,
  GAME_H,
  GAME_W,
  GRID,
  playUiSound,
  TEXT,
} from "./theme";

export interface ModalButton {
  label: string;
  kind?: ButtonKind;
  /** Return false to keep the modal open. */
  onClick?: (modal: ModalHandle) => boolean | undefined;
  /** Initially focused (default: the last button). */
  focus?: boolean;
  width?: number;
}

export interface ModalContentContext {
  scene: Phaser.Scene;
  /** Add your objects here; (0,0) is the content area's top-left. */
  container: Phaser.GameObjects.Container;
  /** Content area width. */
  width: number;
  /** World position of the content area's top-left (for DOM elements). */
  worldX: number;
  worldY: number;
  modal: ModalHandle;
}

export interface ModalOptions {
  title: string;
  body?: string;
  /** Panel width (default 576). */
  width?: number;
  buttons?: ModalButton[];
  /** Esc / click outside closes and calls onDismiss (default true). */
  dismissible?: boolean;
  onDismiss?: () => void;
  /** Height reserved for `content`. */
  contentHeight?: number;
  content?: (ctx: ModalContentContext) => void;
  variant?: PanelVariant;
}

export interface ModalHandle {
  readonly container: Phaser.GameObjects.Container;
  readonly closed: boolean;
  close(): void;
  /** Dismiss as if Esc was pressed. */
  dismiss(): void;
  onClose(cb: () => void): void;
  /** Swap the body text (e.g. to show an error). */
  setBody(text: string, color?: string): void;
}

const PAD = GRID * 4;

export function openModal(scene: Phaser.Scene, opts: ModalOptions): ModalHandle {
  const width = Math.round((opts.width ?? 576) / 3) * 3;
  const inner = width - PAD * 2;
  const buttons = opts.buttons ?? [{ label: "OK", kind: "primary" }];
  const dismissible = opts.dismissible ?? true;
  const closeCbs: Array<() => void> = [];
  let closed = false;

  const dim = scene.add
    .rectangle(0, 0, GAME_W, GAME_H, COLOR_NUM.ink, 0.72)
    .setOrigin(0)
    .setScrollFactor(0)
    .setDepth(DEPTH.modal)
    .setInteractive();
  const root = scene.add
    .container(0, 0)
    .setDepth(DEPTH.modal + 1)
    .setScrollFactor(0);

  const title = scene.add.text(PAD, PAD - 4, opts.title, TEXT.heading);
  const divider = createDivider(scene, PAD, PAD + 40, inner);
  let y = PAD + 40 + 6 + GRID * 2;
  const bodyText = scene.add.text(PAD, y, opts.body ?? "", {
    ...TEXT.body,
    color: COLORS.textDim,
    wordWrap: { width: inner },
    lineSpacing: 6,
  });
  if (opts.body) y += bodyText.height + GRID * 3;
  const contentTop = y;
  y += opts.contentHeight ?? 0;
  y += GRID;
  const btnTop = y;
  const height = Math.round((btnTop + 48 + PAD) / 3) * 3;
  const left = Math.round((GAME_W - width) / 2);
  const top = Math.round((GAME_H - height) / 2);
  root.setPosition(left, top);

  const panel = createPanel(scene, 0, 0, width, height, {
    variant: opts.variant ?? "default",
    originX: 0,
    originY: 0,
  });
  root.add([panel, title, divider, bodyText]);

  const handle: ModalHandle = {
    container: root,
    get closed() {
      return closed;
    },
    close,
    dismiss,
    onClose(cb) {
      closeCbs.push(cb);
    },
    setBody(text, color) {
      bodyText.setText(text).setColor(color ?? COLORS.textDim);
    },
  };

  if (opts.content) {
    const container = scene.add.container(PAD, contentTop);
    root.add(container);
    opts.content({
      scene,
      container,
      width: inner,
      worldX: left + PAD,
      worldY: top + contentTop,
      modal: handle,
    });
  }

  // Buttons, centered row.
  const bw = buttons.map(
    (b) => b.width ?? Math.max(168, Math.min(240, inner / buttons.length - GRID)),
  );
  const totalW = bw.reduce((a, b) => a + b, 0) + GRID * 2 * (buttons.length - 1);
  let bx = (width - totalW) / 2;
  const btnObjs = buttons.map((b, i) => {
    const w = bw[i] ?? 168;
    const btn = new Button(scene, bx + w / 2, btnTop + 24, {
      label: b.label,
      kind: b.kind ?? "secondary",
      width: w,
      height: 48,
      onClick: () => {
        if (closed) return;
        const keep = b.onClick?.(handle);
        if (keep !== false) close();
      },
    });
    bx += w + GRID * 2;
    root.add(btn);
    return btn;
  });
  const initial = Math.max(
    0,
    buttons.findIndex((b) => b.focus),
  );
  const group = new FocusGroup(scene, btnObjs, {
    axis: "horizontal",
    wrap: false,
    initial: buttons.some((b) => b.focus) ? initial : btnObjs.length - 1,
    onBack: () => dismiss(),
  });

  dim.on(Phaser.Input.Events.GAMEOBJECT_POINTER_UP, () => dismiss());

  // Open animation.
  dim.setAlpha(0);
  root.setAlpha(0);
  root.y = top + 12;
  scene.tweens.add({ targets: dim, alpha: 1, duration: DURATION.normal });
  scene.tweens.add({
    targets: root,
    alpha: 1,
    y: top,
    duration: DURATION.normal,
    ease: "Quad.out",
  });

  const onShutdown = () => close(true);
  scene.events.once(Phaser.Scenes.Events.SHUTDOWN, onShutdown);

  function dismiss(): void {
    if (closed || !dismissible) return;
    playUiSound("back");
    opts.onDismiss?.();
    close();
  }

  function close(immediate = false): void {
    if (closed) return;
    closed = true;
    group.destroy();
    scene.events.off(Phaser.Scenes.Events.SHUTDOWN, onShutdown);
    for (const cb of closeCbs) cb();
    if (immediate || !scene.sys.isActive()) {
      dim.destroy();
      root.destroy();
      return;
    }
    dim.disableInteractive();
    scene.tweens.add({ targets: dim, alpha: 0, duration: DURATION.fast });
    scene.tweens.add({
      targets: root,
      alpha: 0,
      y: top + 8,
      duration: DURATION.fast,
      onComplete: () => {
        dim.destroy();
        root.destroy();
      },
    });
  }

  return handle;
}

export interface ConfirmOptions {
  title: string;
  body?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  /** Red confirm button; Cancel gets initial focus. */
  danger?: boolean;
}

/** Yes/no dialog. Resolves true on confirm, false on cancel / Esc. */
export function confirmDialog(scene: Phaser.Scene, opts: ConfirmOptions): Promise<boolean> {
  return new Promise((resolve) => {
    let result = false;
    const m = openModal(scene, {
      title: opts.title,
      body: opts.body,
      buttons: [
        { label: opts.cancelLabel ?? "Cancel", focus: !!opts.danger },
        {
          label: opts.confirmLabel ?? "Confirm",
          kind: opts.danger ? "danger" : "primary",
          onClick: () => {
            result = true;
          },
        },
      ],
    });
    m.onClose(() => resolve(result));
  });
}

/** Simple message box. Resolves when closed. */
export function alertDialog(
  scene: Phaser.Scene,
  title: string,
  body: string,
  okLabel = "OK",
): Promise<void> {
  return new Promise((resolve) => {
    openModal(scene, { title, body, buttons: [{ label: okLabel, kind: "primary" }] }).onClose(
      resolve,
    );
  });
}

export interface PromptField {
  key: string;
  label: string;
  value?: string;
  placeholder?: string;
  maxLength?: number;
  uppercase?: boolean;
  allow?: RegExp;
  /** Must be non-empty (default true). */
  required?: boolean;
  /** Visual style hook, e.g. "rad-input--code" for big monospace room codes. */
  className?: string;
}

export interface PromptOptions {
  title: string;
  body?: string;
  fields: PromptField[];
  confirmLabel?: string;
  cancelLabel?: string;
  /** Extra validation; return an error message to block submit. */
  validate?: (values: Record<string, string>) => string | null;
}

const FIELD_H = 88;

/** Dialog with text fields. Resolves to the values, or null if cancelled. */
export function promptDialog(
  scene: Phaser.Scene,
  opts: PromptOptions,
): Promise<Record<string, string> | null> {
  return new Promise((resolve) => {
    const inputs: TextInput[] = [];
    let errorText: Phaser.GameObjects.Text | null = null;
    let result: Record<string, string> | null = null;

    const values = () =>
      Object.fromEntries(opts.fields.map((f, i) => [f.key, (inputs[i]?.getValue() ?? "").trim()]));

    const trySubmit = (m: ModalHandle): boolean => {
      const v = values();
      const missing = opts.fields.findIndex((f) => (f.required ?? true) && !v[f.key]);
      let err: string | null = null;
      if (missing >= 0) {
        err = `${opts.fields[missing]?.label ?? "Field"} is required.`;
        inputs[missing]?.setInvalid(true);
        inputs[missing]?.focus();
      } else {
        err = opts.validate?.(v) ?? null;
      }
      if (err) {
        playUiSound("error");
        errorText?.setText(err);
        return false;
      }
      result = v;
      if (!m.closed) m.close();
      return true;
    };

    const m = openModal(scene, {
      title: opts.title,
      body: opts.body,
      contentHeight: opts.fields.length * FIELD_H + 24,
      buttons: [
        { label: opts.cancelLabel ?? "Cancel" },
        {
          label: opts.confirmLabel ?? "OK",
          kind: "primary",
          onClick: (mm) => trySubmit(mm),
        },
      ],
      content: (ctx) => {
        opts.fields.forEach((f, i) => {
          const fy = i * FIELD_H;
          ctx.container.add(
            ctx.scene.add.text(0, fy, f.label.toUpperCase(), {
              ...TEXT.small,
              fontStyle: "600",
              color: COLORS.accent,
            }),
          );
          const input = new TextInput(ctx.scene, ctx.worldX + ctx.width / 2, ctx.worldY + fy + 52, {
            width: ctx.width,
            value: f.value,
            placeholder: f.placeholder,
            maxLength: f.maxLength,
            uppercase: f.uppercase,
            allow: f.allow,
            className: f.className,
            ariaLabel: f.label,
            autofocus: i === firstEmpty(),
            onChange: () => {
              input.setInvalid(false);
              errorText?.setText("");
            },
            onSubmit: () => {
              const next = inputs[i + 1];
              if (next && !next.getValue()) next.focus();
              else trySubmit(ctx.modal);
            },
            onCancel: () => ctx.modal.dismiss(),
          });
          input.dom.setAlpha(0);
          ctx.scene.tweens.add({ targets: input.dom, alpha: 1, duration: DURATION.normal });
          inputs.push(input);
        });
        errorText = ctx.scene.add.text(0, opts.fields.length * FIELD_H, "", {
          ...TEXT.small,
          color: COLORS.danger,
        });
        ctx.container.add(errorText);
      },
    });

    function firstEmpty(): number {
      const i = opts.fields.findIndex((f) => !f.value);
      return Math.max(i, 0);
    }

    m.onClose(() => {
      for (const inp of inputs) inp.destroy();
      resolve(result);
    });
  });
}
