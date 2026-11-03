/**
 * Hover tooltips with lightly rich content: a colored title (e.g. rarity), a subtitle,
 * body lines (each optionally colored / with an icon) and a footer. One tooltip per scene.
 *
 *   attachTooltip(itemSprite, () => ({
 *     title: "Ember Lantern", titleColor: RARITY_COLORS.rare, subtitle: "Lamp · Rare",
 *     lines: ["+2 Light radius", { text: "+10% Radiant damage", color: COLORS.accent }],
 *     footer: "Equipped",
 *   }));
 */
import * as Phaser from "phaser";
import { iconTexture, TEX } from "../app/textures";
import type { PanelVariant } from "./artAdapter";
import { createPanel, resizePanel } from "./Panel";
import { COLORS, DEPTH, DURATION, GAME_H, GAME_W, GRID, TEXT } from "./theme";

export interface TooltipLine {
  text: string;
  color?: string;
  /** Icon id drawn at 2x before the text. */
  icon?: string;
  size?: "body" | "small";
}

export interface TooltipContent {
  title?: string;
  /** Title color, e.g. a RARITY_COLORS value. */
  titleColor?: string;
  subtitle?: string;
  lines?: ReadonlyArray<string | TooltipLine>;
  footer?: string;
  /** Max width in px (default 320). */
  width?: number;
  variant?: PanelVariant;
}

export type TooltipSource = TooltipContent | (() => TooltipContent | null);

const PAD = GRID * 2;

class TooltipView {
  readonly root: Phaser.GameObjects.Container;
  private readonly panel: Phaser.GameObjects.NineSlice;
  private readonly body: Phaser.GameObjects.Container;
  private w = 0;
  private h = 0;

  constructor(private readonly scene: Phaser.Scene) {
    this.panel = createPanel(scene, 0, 0, 96, 48, { originX: 0, originY: 0 });
    this.body = scene.add.container(0, 0);
    this.root = scene.add
      .container(0, 0, [this.panel, this.body])
      .setDepth(DEPTH.tooltip)
      .setScrollFactor(0)
      .setVisible(false);
  }

  show(c: TooltipContent, x: number, y: number): void {
    this.body.removeAll(true);
    const maxW = c.width ?? 320;
    const inner = maxW - PAD * 2;
    let cy = PAD - 2;
    let widest = 0;
    const add = (obj: Phaser.GameObjects.Text, dx = 0) => {
      obj.setPosition(PAD + dx, cy);
      this.body.add(obj);
      widest = Math.max(widest, obj.width + dx);
      cy += obj.height;
    };
    if (c.title) {
      add(
        this.scene.add.text(0, 0, c.title, {
          ...TEXT.subheading,
          color: c.titleColor ?? COLORS.accentBright,
          wordWrap: { width: inner },
        }),
      );
    }
    if (c.subtitle) {
      cy += 2;
      add(this.scene.add.text(0, 0, c.subtitle, { ...TEXT.small, wordWrap: { width: inner } }));
    }
    const lines = c.lines ?? [];
    if ((c.title || c.subtitle) && lines.length > 0) {
      cy += GRID;
      const rule = this.scene.add
        .rectangle(PAD, cy, 1, 3, 0x34305a)
        .setOrigin(0, 0)
        .setName("rule");
      this.body.add(rule);
      cy += 3 + GRID;
    }
    for (const raw of lines) {
      const line: TooltipLine = typeof raw === "string" ? { text: raw } : raw;
      const style = line.size === "small" ? TEXT.small : TEXT.body;
      let dx = 0;
      if (line.icon) {
        const icon = this.scene.add
          .image(PAD, cy + 2, iconTexture(this.scene, line.icon))
          .setOrigin(0, 0)
          .setScale(2);
        this.body.add(icon);
        dx = 32 + GRID;
      }
      const t = this.scene.add.text(0, 0, line.text, {
        ...style,
        fontSize: line.size === "small" ? "16px" : "18px",
        color: line.color ?? style.color,
        wordWrap: { width: inner - dx },
      });
      if (line.icon) {
        const before = cy;
        add(t, dx);
        t.setY(before + Math.max(0, (36 - t.height) / 2));
        cy = Math.max(cy, before + 36);
      } else {
        add(t);
      }
      cy += 4;
    }
    if (c.footer) {
      cy += GRID - 4;
      add(
        this.scene.add.text(0, 0, c.footer, {
          ...TEXT.tiny,
          color: COLORS.textDim,
          wordWrap: { width: inner },
        }),
      );
    }
    this.w = Math.ceil((Math.min(maxW - PAD * 2, Math.max(widest, 120)) + PAD * 2) / 3) * 3;
    this.h = Math.ceil((cy + PAD) / 3) * 3;
    const rule = this.body.getByName("rule") as Phaser.GameObjects.Rectangle | null;
    rule?.setSize(this.w - PAD * 2, 3);
    resizePanel(this.panel, this.w, this.h);
    this.panel.setTexture(TEX.panel(c.variant));
    this.moveTo(x, y);
    if (!this.root.visible) {
      this.root.setVisible(true).setAlpha(0);
      this.scene.tweens.killTweensOf(this.root);
      this.scene.tweens.add({ targets: this.root, alpha: 1, duration: DURATION.fast });
    }
    this.scene.children.bringToTop(this.root);
  }

  moveTo(px: number, py: number): void {
    let x = px + 18;
    let y = py + 22;
    if (x + this.w > GAME_W - GRID) x = px - this.w - 12;
    if (y + this.h > GAME_H - GRID) y = Math.max(GRID, py - this.h - 12);
    x = Phaser.Math.Clamp(x, GRID, GAME_W - this.w - GRID);
    this.root.setPosition(Math.round(x), Math.round(y));
  }

  hide(): void {
    this.scene.tweens.killTweensOf(this.root);
    this.root.setVisible(false);
  }

  get visible(): boolean {
    return this.root.visible;
  }
}

const views = new WeakMap<Phaser.Scene, TooltipView>();

function viewFor(scene: Phaser.Scene): TooltipView {
  let v = views.get(scene);
  if (!v?.root.active) {
    v = new TooltipView(scene);
    views.set(scene, v);
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => views.delete(scene));
  }
  return v;
}

/** Show the scene's tooltip near (x, y) (screen px, usually the pointer). */
export function showTooltip(scene: Phaser.Scene, content: TooltipContent, x: number, y: number) {
  viewFor(scene).show(content, x, y);
}

export function moveTooltip(scene: Phaser.Scene, x: number, y: number): void {
  views.get(scene)?.moveTo(x, y);
}

export function hideTooltip(scene: Phaser.Scene): void {
  views.get(scene)?.hide();
}

/**
 * Show a tooltip while the pointer hovers `target` (made interactive if it isn't).
 * Content may be a function, evaluated on each hover (return null to skip).
 * Returns a function that detaches the listeners.
 */
export function attachTooltip(
  target: Phaser.GameObjects.GameObject,
  source: TooltipSource,
  opts: { delay?: number } = {},
): () => void {
  const scene = target.scene;
  if (!target.input) {
    (target as Phaser.GameObjects.GameObject & { setInteractive(): unknown }).setInteractive();
  }
  let timer: Phaser.Time.TimerEvent | null = null;
  let showing = false;
  const resolve = () => (typeof source === "function" ? source() : source);
  const over = (p: Phaser.Input.Pointer) => {
    timer?.remove();
    timer = scene.time.delayedCall(opts.delay ?? 120, () => {
      const c = resolve();
      if (!c) return;
      showing = true;
      showTooltip(scene, c, p.worldX, p.worldY);
    });
  };
  const move = (p: Phaser.Input.Pointer) => {
    if (showing) moveTooltip(scene, p.worldX, p.worldY);
  };
  const out = () => {
    timer?.remove();
    timer = null;
    if (showing) hideTooltip(scene);
    showing = false;
  };
  target.on(Phaser.Input.Events.GAMEOBJECT_POINTER_OVER, over);
  target.on(Phaser.Input.Events.GAMEOBJECT_POINTER_MOVE, move);
  target.on(Phaser.Input.Events.GAMEOBJECT_POINTER_OUT, out);
  target.once(Phaser.GameObjects.Events.DESTROY, out);
  return () => {
    out();
    target.off(Phaser.Input.Events.GAMEOBJECT_POINTER_OVER, over);
    target.off(Phaser.Input.Events.GAMEOBJECT_POINTER_MOVE, move);
    target.off(Phaser.Input.Events.GAMEOBJECT_POINTER_OUT, out);
  };
}
