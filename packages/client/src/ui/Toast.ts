/**
 * Toast notifications. `toast(scene, msg, kind)` renders in the always-on-top UI overlay scene
 * when it is running (so toasts survive scene changes), else in the calling scene.
 */
import * as Phaser from "phaser";
import { hexNum } from "../art/palette";
import { SCENES } from "../app/scenes";
import { iconTexture } from "../app/textures";
import { createPanel } from "./Panel";
import { COLORS, DEPTH, DURATION, GAME_W, GRID, playUiSound, TEXT } from "./theme";

export type ToastKind = "info" | "error" | "success";

const KIND: Record<ToastKind, { color: string; icon: string }> = {
  info: { color: COLORS.info, icon: "ui_lamp" },
  error: { color: COLORS.danger, icon: "ui_lock" },
  success: { color: COLORS.success, icon: "ui_crown" },
};

const MAX = 4;
const TOP = GRID * 3;
const H = 54;
const GAP = GRID;

/** Toast stack bound to one scene. */
export class ToastLayer {
  private items: Phaser.GameObjects.Container[] = [];
  private recent = new Map<string, number>();

  constructor(private readonly scene: Phaser.Scene) {}

  show(message: string, kind: ToastKind = "info", durationMs = 2800): void {
    const now = this.scene.time.now;
    const k = `${kind}:${message}`;
    if ((this.recent.get(k) ?? -1e9) > now - 600) return;
    this.recent.set(k, now);
    if (kind === "error") playUiSound("error");

    const s = this.scene;
    const spec = KIND[kind];
    const text = s.add
      .text(0, 0, message, { ...TEXT.body, fontSize: "18px", wordWrap: { width: 560 } })
      .setOrigin(0, 0.5);
    const h = Math.max(H, Math.ceil((text.height + 24) / 3) * 3);
    const w = Math.ceil((text.width + 32 + 32 + GRID * 3) / 3) * 3;
    const panel = createPanel(s, 0, 0, w, h, {
      variant: kind === "error" ? "default" : "inset",
    });
    const stripe = s.add.rectangle(-w / 2 + 9, 0, 6, h - 24, hexNum(spec.color));
    const icon = s.add.image(-w / 2 + 16 + 20, 0, iconTexture(s, spec.icon)).setScale(2);
    text.setPosition(-w / 2 + 16 + 40 + GRID, 0);
    const c = s.add
      .container(GAME_W / 2, 0, [panel, stripe, icon, text])
      .setDepth(DEPTH.toast)
      .setScrollFactor(0)
      .setSize(w, h)
      .setAlpha(0);
    c.setData("h", h);
    this.items.unshift(c);
    while (this.items.length > MAX) this.dismiss(this.items[this.items.length - 1]);
    this.layout(c);
    s.tweens.add({ targets: c, alpha: 1, duration: DURATION.normal });
    s.time.delayedCall(durationMs, () => this.dismiss(c));
    c.setInteractive({ useHandCursor: true }).on(Phaser.Input.Events.GAMEOBJECT_POINTER_UP, () =>
      this.dismiss(c),
    );
  }

  private layout(fresh?: Phaser.GameObjects.Container): void {
    let y = TOP;
    for (const c of this.items) {
      const h = c.getData("h") as number;
      const target = y + h / 2;
      if (c === fresh) {
        c.y = target - 16;
        this.scene.tweens.add({ targets: c, y: target, duration: DURATION.slow, ease: "Back.out" });
      } else {
        this.scene.tweens.add({ targets: c, y: target, duration: DURATION.normal, ease: "Quad.out" });
      }
      y += h + GAP;
    }
  }

  private dismiss(c: Phaser.GameObjects.Container | undefined): void {
    if (!c || !c.active || c.getData("leaving")) return;
    c.setData("leaving", true);
    this.items = this.items.filter((x) => x !== c);
    c.disableInteractive();
    this.scene.tweens.add({
      targets: c,
      alpha: 0,
      y: c.y - 12,
      duration: DURATION.normal,
      onComplete: () => c.destroy(),
    });
    this.layout();
  }
}

const layers = new WeakMap<Phaser.Scene, ToastLayer>();

/** The toast layer for a specific scene (created on demand). */
export function toastLayer(scene: Phaser.Scene): ToastLayer {
  let l = layers.get(scene);
  if (!l) {
    l = new ToastLayer(scene);
    layers.set(scene, l);
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => layers.delete(scene));
  }
  return l;
}

/** Show a toast. Works from any scene; prefers the global overlay scene. */
export function toast(scene: Phaser.Scene, message: string, kind: ToastKind = "info"): void {
  const overlay = scene.scene.get(SCENES.uiOverlay);
  if (overlay?.sys.isActive()) {
    scene.scene.bringToTop(SCENES.uiOverlay);
    toastLayer(overlay).show(message, kind);
    return;
  }
  toastLayer(scene).show(message, kind);
}
