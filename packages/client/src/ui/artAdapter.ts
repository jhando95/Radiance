/**
 * Adapter between the shell and the procedural art modules in src/art/. Shell code asks for
 * canvases here (never imports art modules directly), so art signature changes are absorbed
 * in one place.
 *
 * Two generations of art live side by side:
 * - pixel art (src/art/*.ts): native-size canvases shown scaled with nearest filtering;
 * - HD art (src/art/hd/uiHD.ts, iconsHD.ts, backdrops.ts): smooth canvases in RENDER px.
 * The HD modules are optional: `loadHdArt()` (awaited by BootScene) imports exactly those three
 * files if they exist and silently keeps the pixel fallback if they are missing or throw.
 * `hdUi()`, `hdIcons()`, `hdBackdrops()` return the loaded API or null.
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
export type ButtonKind = "primary" | "secondary" | "danger";
export type Rarity = keyof typeof RARITY_COLORS;

// ---------------------------------------------------------------------------------------
// Optional HD art modules

export interface HdUiApi {
  drawPanelHD(w: number, h: number, variant?: PanelVariant): HTMLCanvasElement;
  drawSlotHD(rarity?: Rarity, size?: number): HTMLCanvasElement;
  drawButtonHD(w: number, h: number, state: ButtonState, kind?: ButtonKind): HTMLCanvasElement;
  drawTitleLogoHD?: () => HTMLCanvasElement;
  drawBarFrameHD?: (w: number, h?: number) => HTMLCanvasElement;
  UI_HD?: { panelSlice?: number; buttonSlice?: number };
}
export interface HdIconsApi {
  drawIconHD(id: string, size?: number): HTMLCanvasElement;
}
export interface HdBackdropsApi {
  drawBackdropHD?: (biome: string, seed: number) => { layers: HTMLCanvasElement[] };
  drawMapBackdropHD?: (seed: number) => HTMLCanvasElement;
}

// Exact paths only (a wildcard over src/art/** once pulled gallery pages into the game).
const HD_LOADERS = import.meta.glob<Record<string, unknown>>([
  "../art/hd/uiHD.ts",
  "../art/hd/iconsHD.ts",
  "../art/hd/backdrops.ts",
]);

const hd: { ui: HdUiApi | null; icons: HdIconsApi | null; backdrops: HdBackdropsApi | null } = {
  ui: null,
  icons: null,
  backdrops: null,
};
let hdLoad: Promise<void> | null = null;

const fn = (m: Record<string, unknown> | undefined, name: string) =>
  typeof m?.[name] === "function";

async function loadOne(path: string): Promise<Record<string, unknown> | undefined> {
  const loader = HD_LOADERS[path];
  if (!loader) return undefined;
  try {
    return await loader();
  } catch (err) {
    console.warn(`HD art module ${path} failed to load; using pixel art.`, err);
    return undefined;
  }
}

/**
 * True if `draw` returns a canvas with at least one visible pixel. While an HD module is still
 * a placeholder stub (blank canvases), the pixel fallback stays active.
 */
function paints(draw: () => HTMLCanvasElement): boolean {
  try {
    const c = draw();
    const ctx = c.getContext("2d", { willReadFrequently: true });
    if (!ctx || c.width === 0 || c.height === 0) return false;
    const data = ctx.getImageData(0, 0, c.width, c.height).data;
    for (let i = 3; i < data.length; i += 4) if ((data[i] ?? 0) > 8) return true;
    return false;
  } catch (err) {
    console.warn("HD art probe failed", err);
    return false;
  }
}

/** Import the optional HD art modules (idempotent). Never rejects. */
export function loadHdArt(): Promise<void> {
  hdLoad ??= (async () => {
    const [ui, icons, backdrops] = await Promise.all([
      loadOne("../art/hd/uiHD.ts"),
      loadOne("../art/hd/iconsHD.ts"),
      loadOne("../art/hd/backdrops.ts"),
    ]);
    if (fn(ui, "drawPanelHD") && fn(ui, "drawButtonHD") && fn(ui, "drawSlotHD")) {
      const api = ui as unknown as HdUiApi;
      if (paints(() => api.drawPanelHD(96, 96, "default"))) hd.ui = api;
    }
    if (fn(icons, "drawIconHD")) {
      const api = icons as unknown as HdIconsApi;
      if (paints(() => api.drawIconHD("ui_lamp", 32))) hd.icons = api;
    }
    if (fn(backdrops, "drawBackdropHD") || fn(backdrops, "drawMapBackdropHD")) {
      hd.backdrops = backdrops as unknown as HdBackdropsApi;
    }
  })();
  return hdLoad;
}

/** Loaded HD UI kit, or null (pixel fallback). */
export const hdUi = (): HdUiApi | null => hd.ui;
export const hdIcons = (): HdIconsApi | null => hd.icons;
export const hdBackdrops = (): HdBackdropsApi | null => hd.backdrops;

/** Which HD modules are active (for logs / debug overlays). */
export function hdArtStatus(): Record<"ui" | "icons" | "backdrops", boolean> {
  return { ui: !!hd.ui, icons: !!hd.icons, backdrops: !!hd.backdrops };
}

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

/** Sample merc look (How to Play illustrations). index 0 = front-liner. */
export function sampleMercLook(index: number): MercLook {
  return (SAMPLE_MERCS[index % SAMPLE_MERCS.length] ?? SAMPLE_MERCS[0]) as MercLook;
}

/** Enemies with finished HD rigs, used for illustrations when the HD rigs are available. */
const SAMPLE_ENEMIES_HD: readonly EnemyArtId[] = [
  "huskMiner",
  "gloamCrawler",
  "huskForeman",
  "voidWisp",
];

/** Sample enemy id for illustrations (`hd` picks from enemies that have HD rigs). */
export function sampleEnemyId(index: number, hd = false): EnemyArtId {
  const list = hd ? SAMPLE_ENEMIES_HD : SAMPLE_ENEMIES;
  return list[index % list.length] ?? "huskMiner";
}

/** Sample merc sprite (48x48, facing right). index 0 = front-liner. */
export function mercCanvas(index: number): HTMLCanvasElement {
  const look = SAMPLE_MERCS[index % SAMPLE_MERCS.length] ?? SAMPLE_MERCS[0];
  return drawMerc(look as MercLook, "idle0");
}

/** Sample enemy sprite (48x48, facing LEFT). */
export function enemyCanvas(index: number): HTMLCanvasElement {
  return drawEnemy(SAMPLE_ENEMIES[index % SAMPLE_ENEMIES.length] ?? "huskMiner", "idle0");
}
