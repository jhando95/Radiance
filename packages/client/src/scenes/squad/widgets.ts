/**
 * Small widgets specific to the squad builder. General widgets (Button, panels, text input)
 * come from the shell in src/ui/.
 */
import * as Phaser from "phaser";
import { iconTexture, TEX } from "../../app/textures";
import { hexNum, INK, RAMPS } from "../../art/palette";
import { artList, hasArt } from "../../ui/artAdapter";
import { createPanel } from "../../ui/Panel";
import {
  COLOR_NUM,
  COLORS,
  DEPTH,
  DURATION,
  GRID,
  playUiSound,
  TEXT,
  UI_SCALE,
} from "../../ui/theme";

// ---------------------------------------------------------------------------------------
// Text

/**
 * Pixelify Sans' "fi"/"fl"/"ff" ligatures read as odd glyphs at UI sizes; canvas text can't
 * switch ligatures off, so break them with a zero-width non-joiner.
 */
export function noLig(text: string): string {
  return text.replace(/f(?=[fil])/g, "f\u200C");
}

// ---------------------------------------------------------------------------------------
// Icons

let knownIcons: Set<string> | null = null;

/** True if the icons art module can draw `id` (falls back to a lettered square otherwise). */
export function hasIcon(id: string): boolean {
  if (!hasArt("icons", "drawIcon")) return false;
  knownIcons ??= new Set(artList("icons", "ICON_IDS") ?? []);
  return knownIcons.size === 0 || knownIcons.has(id);
}

/**
 * A 16x16 icon at `scale`, or a colored square with `letter` when the icon art is missing.
 * Returns a container centered on (x, y).
 */
export function addIcon(
  scene: Phaser.Scene,
  x: number,
  y: number,
  id: string,
  scale: number,
  fallbackColor: string,
  letter: string,
): Phaser.GameObjects.Container {
  const c = scene.add.container(x, y);
  if (hasIcon(id)) {
    c.add(scene.add.image(0, 0, iconTexture(scene, id)).setScale(scale));
    return c;
  }
  const s = 14 * scale;
  const g = scene.add.graphics();
  g.fillStyle(hexNum(INK), 1).fillRect(
    -s / 2 - scale,
    -s / 2 - scale,
    s + scale * 2,
    s + scale * 2,
  );
  g.fillStyle(hexNum(fallbackColor), 1).fillRect(-s / 2, -s / 2, s, s);
  g.fillStyle(0xffffff, 0.18).fillRect(-s / 2, -s / 2, s, scale);
  const t = scene.add
    .text(0, -1, letter.toUpperCase(), { ...TEXT.subheading, fontSize: `${8 * scale}px` })
    .setOrigin(0.5);
  c.add([g, t]);
  return c;
}

// ---------------------------------------------------------------------------------------
// Arrow buttons

/** A clickable pixel arrow (TEX.arrow) with a hover tint and a generous hit area. */
export function addArrow(
  scene: Phaser.Scene,
  x: number,
  y: number,
  dir: -1 | 1,
  onClick: () => void,
  scale = UI_SCALE,
): Phaser.GameObjects.Image {
  const img = scene.add
    .image(x, y, TEX.arrow)
    .setScale(scale)
    .setFlipX(dir < 0);
  img.setTint(COLOR_NUM.textDim);
  img.setInteractive({
    useHandCursor: true,
    hitArea: new Phaser.Geom.Rectangle(-4, -4, 12, 15),
    hitAreaCallback: Phaser.Geom.Rectangle.Contains,
  });
  img.on(Phaser.Input.Events.GAMEOBJECT_POINTER_OVER, () => {
    img.setTint(COLOR_NUM.accentBright);
    playUiSound("hover");
  });
  img.on(Phaser.Input.Events.GAMEOBJECT_POINTER_OUT, () => img.setTint(COLOR_NUM.textDim));
  img.on(Phaser.Input.Events.GAMEOBJECT_POINTER_DOWN, () => {
    playUiSound("click");
    scene.tweens.add({
      targets: img,
      x: { from: x + dir * 4, to: x },
      duration: DURATION.normal,
      ease: "Quad.out",
    });
    onClick();
  });
  return img;
}

// ---------------------------------------------------------------------------------------
// Compact option row: "Label        ◂ [■] Value ▸"

export class OptionRow extends Phaser.GameObjects.Container {
  private readonly valueText: Phaser.GameObjects.Text;
  private readonly swatch: Phaser.GameObjects.Graphics;
  private readonly band: Phaser.GameObjects.Graphics;
  private readonly valueGroup: Phaser.GameObjects.Container;
  private readonly label: Phaser.GameObjects.Text;
  private readonly valueCenter: number;

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    readonly rowWidth: number,
    label: string,
    private readonly onStep: (dir: -1 | 1) => void,
  ) {
    super(scene, x, y);
    const h = 40;
    this.band = scene.add.graphics();
    this.band.fillStyle(COLOR_NUM.accent, 0.08).fillRect(0, -h / 2, rowWidth, h);
    this.band.fillStyle(COLOR_NUM.accent, 1).fillRect(0, -h / 2, 3, h);
    this.band.setAlpha(0);
    this.label = scene.add.text(GRID * 1.5, -1, noLig(label), TEXT.small).setOrigin(0, 0.5);
    const left = 116;
    const right = rowWidth - 8;
    this.valueCenter = (left + right) / 2;
    this.swatch = scene.add.graphics();
    this.valueText = scene.add.text(this.valueCenter, -1, "", TEXT.small).setOrigin(0.5);
    this.valueText.setColor(COLORS.accentBright);
    const hit = scene.add
      .zone(rowWidth / 2, 0, rowWidth, h)
      .setInteractive({ useHandCursor: true });
    hit.on(Phaser.Input.Events.GAMEOBJECT_POINTER_OVER, () => this.setHover(true));
    hit.on(Phaser.Input.Events.GAMEOBJECT_POINTER_OUT, () => this.setHover(false));
    hit.on(Phaser.Input.Events.GAMEOBJECT_POINTER_DOWN, (p: Phaser.Input.Pointer) => {
      // Left half of the control steps back, everything else steps forward.
      const local = p.x - this.x;
      this.step(local < this.valueCenter - 24 && local > left - 16 ? -1 : 1);
    });
    this.valueGroup = scene.add.container(0, 0, [this.swatch, this.valueText]);
    this.add([this.band, this.label, hit, this.valueGroup]);
    this.add(addArrow(scene, left, -1, -1, () => this.step(-1, false)));
    this.add(addArrow(scene, right, -1, 1, () => this.step(1, false)));
    scene.add.existing(this);
  }

  private step(dir: -1 | 1, sound = true): void {
    if (sound) playUiSound("click");
    this.onStep(dir);
    this.scene.tweens.add({
      targets: this.valueGroup,
      x: { from: dir * 6, to: 0 },
      duration: DURATION.normal,
      ease: "Quad.out",
    });
  }

  private setHover(on: boolean): void {
    this.scene.tweens.killTweensOf(this.band);
    this.scene.tweens.add({ targets: this.band, alpha: on ? 1 : 0, duration: DURATION.fast });
    this.label.setColor(on ? COLORS.accentPale : COLORS.textDim);
    if (on) playUiSound("hover");
  }

  setValue(text: string, swatch?: string): void {
    this.valueText.setText(noLig(text));
    this.swatch.clear();
    const sw = 12;
    if (swatch) {
      const total = sw + 6 + this.valueText.width;
      const x0 = Math.round(this.valueCenter - total / 2);
      this.swatch.fillStyle(hexNum(INK), 1).fillRect(x0 - 2, -sw / 2 - 2, sw + 4, sw + 4);
      this.swatch.fillStyle(hexNum(swatch), 1).fillRect(x0, -sw / 2, sw, sw);
      this.swatch.fillStyle(0xffffff, 0.25).fillRect(x0, -sw / 2, sw, 2);
      this.valueText.setOrigin(0, 0.5).setX(x0 + sw + 6);
    } else {
      this.valueText.setOrigin(0.5).setX(this.valueCenter);
    }
  }
}

// ---------------------------------------------------------------------------------------
// Tooltip

export interface TooltipLine {
  text: string;
  color?: string;
  style?: "title" | "body" | "small";
}

/** Floating info panel. `show` lays out lines and keeps the panel on screen. */
export class Tooltip extends Phaser.GameObjects.Container {
  private readonly bg: Phaser.GameObjects.NineSlice;
  private readonly content: Phaser.GameObjects.Container;
  readonly extra: Phaser.GameObjects.Graphics;

  constructor(
    scene: Phaser.Scene,
    private readonly maxWidth = 336,
  ) {
    super(scene, 0, 0);
    this.bg = createPanel(scene, 0, 0, 96, 48, { originX: 0, originY: 0 });
    this.content = scene.add.container(0, 0);
    this.extra = scene.add.graphics();
    this.add([this.bg, this.content, this.extra]);
    this.setDepth(DEPTH.tooltip).setVisible(false);
    scene.add.existing(this);
  }

  /**
   * Show `lines` anchored above (or below, if no room) the rect (ax, ay, aw, ah).
   * `gap` lines (null) insert 8px of space; `reserve` adds blank vertical space (px) after
   * the line index given, for custom drawings in `extra` (local coords).
   */
  show(
    lines: (TooltipLine | null)[],
    anchor: { x: number; y: number; w: number; h: number },
    reserve?: { after: number; height: number },
  ): { reservedY: number } {
    this.content.removeAll(true);
    this.extra.clear();
    const pad = 16;
    const wrap = this.maxWidth - pad * 2;
    let y = pad - 2;
    let w = 0;
    let reservedY = 0;
    lines.forEach((line, i) => {
      if (line) {
        const base =
          line.style === "title"
            ? TEXT.subheading
            : line.style === "small"
              ? TEXT.small
              : TEXT.small;
        const t = this.scene.add.text(pad, y, noLig(line.text), {
          ...base,
          color: line.color ?? (line.style === "title" ? COLORS.accentBright : COLORS.text),
          wordWrap: { width: wrap, useAdvancedWrap: true },
          lineSpacing: 2,
        });
        this.content.add(t);
        y += t.height + 4;
        w = Math.max(w, t.width);
      } else {
        y += GRID;
      }
      if (reserve && reserve.after === i) {
        reservedY = y;
        y += reserve.height;
      }
    });
    const width = Math.min(this.maxWidth, Math.max(w, reserve ? 200 : 0) + pad * 2);
    const height = y + pad - 4;
    this.bg.setSize(Math.round(width / UI_SCALE), Math.round(height / UI_SCALE));
    const bw = this.bg.width * UI_SCALE;
    const bh = this.bg.height * UI_SCALE;
    const cam = this.scene.cameras.main;
    let x = anchor.x + anchor.w / 2 - bw / 2;
    let top = anchor.y - bh - GRID;
    if (top < GRID) top = anchor.y + anchor.h + GRID;
    x = Phaser.Math.Clamp(x, GRID, cam.width - bw - GRID);
    top = Phaser.Math.Clamp(top, GRID, cam.height - bh - GRID);
    this.setPosition(Math.round(x), Math.round(top));
    this.setVisible(true).setAlpha(0);
    this.scene.tweens.killTweensOf(this);
    this.scene.tweens.add({ targets: this, alpha: 1, duration: DURATION.fast });
    return { reservedY };
  }

  hide(): void {
    this.scene.tweens.killTweensOf(this);
    this.setVisible(false);
  }
}

/** Draw DD-style rank pips: 4 squares, `on` ranks lit. Ranks run 4..1 or 1..4 left->right. */
export function drawRankPips(
  g: Phaser.GameObjects.Graphics,
  x: number,
  y: number,
  on: readonly number[],
  color: number,
  reversed: boolean,
  size = 12,
): number {
  const gap = 4;
  for (let i = 0; i < 4; i++) {
    const rank = reversed ? 4 - i : i + 1;
    const px = x + i * (size + gap);
    g.fillStyle(hexNum(INK), 1).fillRect(px - 2, y - 2, size + 4, size + 4);
    if (on.includes(rank)) {
      g.fillStyle(color, 1).fillRect(px, y, size, size);
      g.fillStyle(0xffffff, 0.3).fillRect(px, y, size, 2);
    } else {
      g.fillStyle(hexNum(RAMPS.void[2]), 1).fillRect(px, y, size, size);
    }
  }
  return 4 * size + 3 * gap;
}
