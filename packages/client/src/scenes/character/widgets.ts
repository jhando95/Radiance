/**
 * Small pixel-UI building blocks for the character sheet. They lean on the shell's texture
 * kit (app/textures.ts) and panels (ui/Panel.ts) so the sheet matches the rest of the game.
 */
import * as Phaser from "phaser";
import { iconTexture, TEX } from "../../app/textures";
import { hexNum, INK, RAMPS } from "../../art/palette";
import type { PanelVariant, Rarity } from "../../ui/artAdapter";
import { createPanel } from "../../ui/Panel";
import { COLORS, TEXT } from "../../ui/theme";

type Scene = Phaser.Scene;
type Container = Phaser.GameObjects.Container;

/** Slot frames are 20x20 native, shown at 3x (60px). Icons are 16x16 at 3x (48px). */
export const SLOT_PX = 60;
export const ICON_SCALE = 3;

/**
 * Make a container interactive over a box given in its *local* coordinates. Phaser offsets a
 * container's hit area by its display origin (half its size), so we compensate here.
 */
export function setHitBox(
  c: Container,
  x0: number,
  y0: number,
  w: number,
  h: number,
  cursor = "pointer",
): Container {
  c.setSize(w, h);
  c.setInteractive(
    new Phaser.Geom.Rectangle(x0 + c.displayOriginX, y0 + c.displayOriginY, w, h),
    Phaser.Geom.Rectangle.Contains,
  );
  if (c.input) c.input.cursor = cursor;
  return c;
}

/** Top-left anchored panel. */
export function panelAt(
  scene: Scene,
  parent: Container,
  x: number,
  y: number,
  w: number,
  h: number,
  variant: PanelVariant = "default",
): Phaser.GameObjects.NineSlice {
  const p = createPanel(scene, x, y, w, h, { variant, originX: 0, originY: 0 });
  parent.add(p);
  return p;
}

/** Section title: small caps in lamp amber with a faint rule to the right. */
export function sectionTitle(
  scene: Scene,
  parent: Container,
  x: number,
  y: number,
  text: string,
  ruleTo?: number,
): Phaser.GameObjects.Text {
  const t = scene.add
    .text(x, y, text.toUpperCase(), {
      ...TEXT.small,
      color: COLORS.accent,
      fontStyle: "600",
      letterSpacing: 2,
    })
    .setOrigin(0, 0.5);
  parent.add(t);
  if (ruleTo !== undefined && ruleTo > x + t.width + 16) {
    const g = scene.add.graphics();
    g.fillStyle(hexNum(RAMPS.void[3]), 1);
    g.fillRect(Math.round(x + t.width + 12), Math.round(y), Math.round(ruleTo - x - t.width - 12), 2);
    parent.add(g);
  }
  return t;
}

export function icon(
  scene: Scene,
  parent: Container,
  id: string,
  x: number,
  y: number,
  scale = 2,
): Phaser.GameObjects.Image {
  const img = scene.add.image(Math.round(x), Math.round(y), iconTexture(scene, id)).setScale(scale);
  parent.add(img);
  return img;
}

export interface BarOptions {
  fill: string;
  /** Lighter top line of the fill. */
  fillHi?: string;
  back?: string;
  /** Segment ticks every N px (0 = none). */
  ticks?: number;
}

/** A crisp pixel progress bar: ink outline, steel frame, dark well, two-tone fill. */
export function drawBar(
  g: Phaser.GameObjects.Graphics,
  x: number,
  y: number,
  w: number,
  h: number,
  frac: number,
  o: BarOptions,
): void {
  const f = Phaser.Math.Clamp(frac, 0, 1);
  g.fillStyle(hexNum(INK), 1).fillRect(x, y, w, h);
  g.fillStyle(hexNum(RAMPS.steel[1]), 1).fillRect(x + 2, y + 2, w - 4, h - 4);
  g.fillStyle(hexNum(o.back ?? RAMPS.void[0]), 1).fillRect(x + 3, y + 3, w - 6, h - 6);
  const fw = Math.round((w - 6) * f);
  if (fw > 0) {
    g.fillStyle(hexNum(o.fill), 1).fillRect(x + 3, y + 3, fw, h - 6);
    g.fillStyle(hexNum(o.fillHi ?? o.fill), 1).fillRect(x + 3, y + 3, fw, 2);
  }
  if (o.ticks) {
    g.fillStyle(hexNum(INK), 0.45);
    for (let tx = x + 3 + o.ticks; tx < x + w - 4; tx += o.ticks) g.fillRect(tx, y + 3, 1, h - 6);
  }
}

export interface ChipOptions {
  color: string;
  icon?: string;
  /** Fixed width (default: fits text). */
  width?: number;
  height?: number;
  fontSize?: number;
}

/** A pill-ish label with a colored border; returns a container sized for hit-testing. */
export function chip(scene: Scene, x: number, y: number, label: string, o: ChipOptions): Container {
  const h = o.height ?? 28;
  const iconW = o.icon ? 22 : 0;
  const text = scene.add
    .text(0, 0, label, {
      ...TEXT.small,
      fontSize: `${o.fontSize ?? 16}px`,
      color: o.color,
    })
    .setOrigin(0, 0.5);
  const w = o.width ?? Math.ceil(text.width + 20 + iconW);
  const g = scene.add.graphics();
  const edge = hexNum(o.color);
  g.fillStyle(hexNum(INK), 1).fillRect(0, 0, w, h);
  g.fillStyle(edge, 0.55).fillRect(1, 1, w - 2, h - 2);
  g.fillStyle(hexNum(RAMPS.void[1]), 1).fillRect(3, 3, w - 6, h - 6);
  g.fillStyle(edge, 0.12).fillRect(3, 3, w - 6, h - 6);
  // notched corners
  g.fillStyle(hexNum(INK), 1)
    .fillRect(0, 0, 2, 2)
    .fillRect(w - 2, 0, 2, 2)
    .fillRect(0, h - 2, 2, 2)
    .fillRect(w - 2, h - 2, 2, 2);
  const parts: Phaser.GameObjects.GameObject[] = [g];
  if (o.icon) {
    parts.push(scene.add.image(10 + 8, h / 2, iconTexture(scene, o.icon)).setScale(1));
  }
  text.setPosition(10 + iconW, Math.round(h / 2) - 1);
  if (text.width > w - 20 - iconW) {
    // Truncate long labels with an ellipsis.
    let s = label;
    while (s.length > 1 && text.width > w - 20 - iconW) {
      s = s.slice(0, -1);
      text.setText(`${s}…`);
    }
  }
  parts.push(text);
  const c = scene.add.container(Math.round(x), Math.round(y), parts);
  return setHitBox(c, 0, 0, w, h, "default");
}

export interface SlotOptions {
  rarity?: Rarity;
  icon?: string;
  /** Faded silhouette icon for empty slots. */
  ghostIcon?: string;
  dim?: boolean;
}

/** An item slot (60x60) centered at x,y: rarity frame + 3x icon. Interactive. */
export function slotView(scene: Scene, x: number, y: number, o: SlotOptions): Container {
  const parts: Phaser.GameObjects.GameObject[] = [];
  if (o.rarity && o.rarity !== "common") {
    const glow = scene.add
      .image(0, 0, TEX.glow)
      .setDisplaySize(SLOT_PX * 1.25, SLOT_PX * 1.25)
      .setTint(hexNum(rarityHex(o.rarity)))
      .setAlpha(o.rarity === "relic" || o.rarity === "epic" ? 0.32 : 0.18)
      .setBlendMode(Phaser.BlendModes.ADD);
    glow.setName("rarityGlow");
    parts.push(glow);
  }
  parts.push(scene.add.image(0, 0, TEX.slot(o.rarity)).setScale(ICON_SCALE));
  if (o.icon) {
    parts.push(scene.add.image(0, 0, iconTexture(scene, o.icon)).setScale(ICON_SCALE));
  } else if (o.ghostIcon) {
    parts.push(
      scene.add
        .image(0, 0, iconTexture(scene, o.ghostIcon))
        .setScale(ICON_SCALE)
        .setTint(hexNum(RAMPS.void[4]))
        .setAlpha(0.35),
    );
  }
  const hover = scene.add.graphics();
  hover.lineStyle(3, hexNum(COLORS.accentBright), 1);
  hover.strokeRect(-SLOT_PX / 2 - 3, -SLOT_PX / 2 - 3, SLOT_PX + 6, SLOT_PX + 6);
  hover.setVisible(false).setName("hover");
  parts.push(hover);
  const c = scene.add.container(Math.round(x), Math.round(y), parts);
  setHitBox(c, -SLOT_PX / 2, -SLOT_PX / 2, SLOT_PX, SLOT_PX);
  if (o.dim) c.setAlpha(0.38);
  c.on(Phaser.Input.Events.GAMEOBJECT_POINTER_OVER, () => hover.setVisible(true));
  c.on(Phaser.Input.Events.GAMEOBJECT_POINTER_OUT, () => hover.setVisible(false));
  return c;
}

function rarityHex(r: Rarity): string {
  return (COLORS as Record<string, string>)[r] ?? COLORS.text;
}

/** A soft additive glow sprite (light!). */
export function glow(
  scene: Scene,
  x: number,
  y: number,
  size: number,
  color: string,
  alpha: number,
): Phaser.GameObjects.Image {
  return scene.add
    .image(Math.round(x), Math.round(y), TEX.glow)
    .setDisplaySize(size, size)
    .setTint(hexNum(color))
    .setAlpha(alpha)
    .setBlendMode(Phaser.BlendModes.ADD);
}

/** Letter-in-a-box fallback when a texture can't be produced. */
export function fallbackBadge(scene: Scene, x: number, y: number, size: number, letter: string) {
  const g = scene.add.graphics({ x: x - size / 2, y: y - size / 2 });
  g.fillStyle(hexNum(RAMPS.void[3]), 1).fillRect(0, 0, size, size);
  const t = scene.add
    .text(x, y, letter.toUpperCase(), { ...TEXT.heading, color: COLORS.textDim })
    .setOrigin(0.5);
  return [g, t] as const;
}
