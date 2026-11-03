/**
 * Adapter between the shell and the procedural art modules in src/art/. Shell code asks for
 * canvases here (never imports art modules directly), so art signature changes are absorbed
 * in one place. All functions return native-size canvases; Phaser displays them scaled with
 * nearest-neighbour filtering.
 */
import * as backgroundsMod from "../art/backgrounds";
import { type Biome, drawBackdrop, drawMapBackdrop } from "../art/backgrounds";
import * as enemiesMod from "../art/enemies";
import { drawEnemy, type EnemyArtId } from "../art/enemies";
import * as iconsMod from "../art/icons";
import { drawIcon, ICON_IDS, type IconId } from "../art/icons";
import * as mercsMod from "../art/mercs";
import { drawMerc, type MercLook } from "../art/mercs";
import type { RARITY_COLORS } from "../art/palette";
import * as uiMod from "../art/ui";
import {
  drawBarFrame,
  drawButton,
  drawLightCone,
  drawPanel,
  drawSlot,
  drawTitleLogo,
} from "../art/ui";

export type PanelVariant = "default" | "inset" | "highlight";
export type ButtonState = "idle" | "hover" | "pressed" | "disabled";
export type Rarity = keyof typeof RARITY_COLORS;

const MODULES: Record<string, Record<string, unknown>> = {
  ui: uiMod,
  icons: iconsMod,
  backgrounds: backgroundsMod,
  mercs: mercsMod,
  enemies: enemiesMod,
};

/** True if art module `file` (e.g. "icons") exports a function `name`. */
export function hasArt(file: string, name: string): boolean {
  return typeof MODULES[file]?.[name] === "function";
}

/** A string list exported by an art module (e.g. artList("icons", "ICON_IDS")). */
export function artList(file: string, name: string): readonly string[] | undefined {
  const v = MODULES[file]?.[name];
  if (Array.isArray(v)) return v.filter((x): x is string => typeof x === "string");
  if (v && typeof v === "object") return Object.keys(v);
  return undefined;
}

/** Native-px panel with a 4px border; flat interior, so 9-slice friendly (slice 4). */
export function panelCanvas(w: number, h: number, variant: PanelVariant = "default") {
  return drawPanel(w, h, variant);
}

/** Native-px button (draw at exact size: its sheen is dithered, so don't 9-slice it). */
export function buttonCanvas(w: number, h: number, state: ButtonState): HTMLCanvasElement {
  return drawButton(w, h, state);
}

/** 20x20 slot with a rarity-tinted border (no rarity = empty slot). */
export function slotCanvas(rarity?: Rarity): HTMLCanvasElement {
  return drawSlot(rarity ?? "empty");
}

/** 6px-tall bar frame. */
export function barFrameCanvas(w: number): HTMLCanvasElement {
  return drawBarFrame(w);
}

/** Smooth white radial light (radius*2 square). */
export function lightConeCanvas(radius: number): HTMLCanvasElement {
  return drawLightCone(radius);
}

/** "RADIANCE" wordmark, ~140x28. */
export function titleLogoCanvas(): HTMLCanvasElement {
  return drawTitleLogo();
}

/** Every icon id the icons module can draw. */
export function iconIds(): readonly string[] {
  return ICON_IDS;
}

function isIconId(id: string): id is IconId {
  return (ICON_IDS as readonly string[]).includes(id);
}

/** 16x16 icon. Unknown ids get a neutral placeholder rather than throwing. */
export function iconCanvas(id: string): HTMLCanvasElement {
  return drawIcon(isIconId(id) ? id : "ui_lock");
}

/** Overworld/title backdrop, 320x180. */
export function mapBackdropCanvas(seed: number): HTMLCanvasElement {
  return drawMapBackdrop(seed);
}

const BIOMES: readonly Biome[] = ["duskMines", "crystalHollows", "ashenSurface"];

/** Parallax layers for a biome backdrop (back to front). */
export function biomeBackdropLayers(biome: string, seed: number): HTMLCanvasElement[] {
  const b = (BIOMES as readonly string[]).includes(biome) ? (biome as Biome) : "duskMines";
  return drawBackdrop(b, seed).layers;
}

// ---------------------------------------------------------------------------------------
// Illustration sprites for shell screens (How to Play, debug host). Fixed sample looks.

const SAMPLE_MERCS: readonly MercLook[] = [
  {
    discipline: "vanguard",
    body: 2,
    skin: 1,
    hair: 1,
    hairColor: 0,
    primary: 1,
    secondary: 6,
    headgear: 4,
    marking: 1,
    armor: "heavy",
    lamp: "none",
    weaponTier: 2,
  },
  {
    discipline: "reaver",
    body: 0,
    skin: 3,
    hair: 3,
    hairColor: 4,
    primary: 5,
    secondary: 6,
    headgear: 0,
    marking: 2,
    armor: "light",
    lamp: "none",
    weaponTier: 2,
  },
  {
    discipline: "gunner",
    body: 1,
    skin: 2,
    hair: 2,
    hairColor: 3,
    primary: 2,
    secondary: 3,
    headgear: 2,
    marking: 0,
    armor: "medium",
    lamp: "none",
    weaponTier: 3,
  },
  {
    discipline: "lamplighter",
    body: 1,
    skin: 0,
    hair: 4,
    hairColor: 5,
    primary: 3,
    secondary: 7,
    headgear: 1,
    marking: 0,
    armor: "light",
    lamp: "oil",
    weaponTier: 1,
  },
];

const SAMPLE_ENEMIES: readonly EnemyArtId[] = [
  "huskMiner",
  "scavCutter",
  "gloamCrawler",
  "voidWisp",
];

/** Sample merc sprite (48x48, facing right). index 0 = front-liner. */
export function mercCanvas(index: number): HTMLCanvasElement {
  const look = SAMPLE_MERCS[index % SAMPLE_MERCS.length] ?? SAMPLE_MERCS[0];
  return drawMerc(look as MercLook, "idle0");
}

/** Sample enemy sprite (48x48, facing LEFT). */
export function enemyCanvas(index: number): HTMLCanvasElement {
  return drawEnemy(SAMPLE_ENEMIES[index % SAMPLE_ENEMIES.length] ?? "huskMiner", "idle0");
}
