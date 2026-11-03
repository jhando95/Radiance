/**
 * Visual language for Radiance's UI: a two-font type system, a small set of text styles,
 * colors pulled from the art palette, and an 8px spacing grid. Every widget and scene reads
 * from here so the whole shell looks like one game.
 *
 * Typography
 * - DISPLAY_FONT "Cinzel": engraved classical capitals. Logo, titles, headings, menu items
 *   and button labels. Always gets a little letter spacing.
 * - BODY_FONT "Alegreya Sans": a humanist sans with a calligraphic warmth. Body copy,
 *   descriptions, tooltips, small print and numbers.
 * Sizes are LOGICAL px (the game lays out in 1280x720; the canvas renders at 1080p, so a
 * 20px body line is 30 screen px). Nothing goes below 14 logical px.
 *
 * Text size setting: `TEXT` is rebuilt in place from the player's "Text size" setting
 * (Normal / Large). Scenes read TEXT when they create objects, so a change applies to every
 * scene created afterwards. For hand-picked sizes use `fontPx(n)`, which follows the same scale.
 */
import type * as Phaser from "phaser";
import { getSettings, onSettingsChange, type TextSize } from "../app/settings";
import { hexNum, INK, RAMPS, RARITY_COLORS } from "../art/palette";

/** Engraved capitals for display text (titles, headings, buttons, menu items). */
export const DISPLAY_FONT = '"Cinzel", "Trajan Pro", "Times New Roman", Georgia, serif';
/** Readable humanist sans for everything else. */
export const BODY_FONT = '"Alegreya Sans", "Segoe UI", "Helvetica Neue", Arial, sans-serif';
/** Default family for ad-hoc text (`{ fontFamily: FONT_FAMILY, ... }`): the body font. */
export const FONT_FAMILY = BODY_FONT;

/** Every family/weight the UI uses; BootScene waits for all of them before drawing text. */
export const FONT_FACES: ReadonlyArray<{ family: string; weight: number }> = [
  { family: "Cinzel", weight: 600 },
  { family: "Cinzel", weight: 700 },
  { family: "Cinzel", weight: 900 },
  { family: "Alegreya Sans", weight: 400 },
  { family: "Alegreya Sans", weight: 500 },
  { family: "Alegreya Sans", weight: 700 },
  { family: "Alegreya Sans", weight: 800 },
];

/** Logical game resolution. */
export const GAME_W = 1280;
export const GAME_H = 720;

/** Spacing grid unit (px). Use multiples: GRID, GRID*2, ... */
export const GRID = 8;
/**
 * Scale of the legacy pixel-art UI units. HD icons, slots and arrows keep these base units
 * (an icon is 16 "units", a slot 20), so `image.setScale(UI_SCALE)` still shows a 48px icon;
 * see app/textures.ts.
 */
export const UI_SCALE = 3;
/** Scale applied to full-screen backdrops (320x180 base units). */
export const BACKDROP_SCALE = 4;

/** Hex strings, for text styles and DOM. */
export const COLORS = {
  bg: RAMPS.void[0],
  bgDeep: INK,
  panel: RAMPS.void[1],
  panelLight: RAMPS.void[2],
  line: RAMPS.void[4],
  /** Primary text: warm bone, near white (~15:1 on panels). */
  text: "#f3ecdd",
  /** Secondary text (~9:1 on panels). */
  textDim: "#c4b9a6",
  /** Tertiary text / hints (~6:1 on panels, still AA). */
  textMuted: "#9098ad",
  accent: RAMPS.lamp[3],
  accentBright: RAMPS.lamp[4],
  accentPale: RAMPS.lamp[5],
  accentDeep: RAMPS.lamp[1],
  danger: RAMPS.rust[4],
  dangerDeep: RAMPS.rust[2],
  success: RAMPS.toxic[4],
  info: RAMPS.crystal[4],
  umbra: RAMPS.umbra[4],
  ink: INK,
  ...RARITY_COLORS,
} as const;

export type ColorName = keyof typeof COLORS;

/** 0xRRGGBB numbers, for Graphics / tints. */
export const COLOR_NUM: { readonly [K in ColorName]: number } = Object.fromEntries(
  Object.entries(COLORS).map(([k, v]) => [k, hexNum(v)]),
) as { [K in ColorName]: number };

/** Soft drop shadow that lifts text off art (offsets are in text-canvas px). */
const SHADOW = {
  offsetX: 0,
  offsetY: 3,
  color: "rgba(3,2,8,0.92)",
  blur: 5,
  fill: true,
  stroke: true,
};

type TextStyle = Phaser.Types.GameObjects.Text.TextStyle;
type Weight = "400" | "500" | "600" | "700" | "800" | "900";

interface StyleSpec {
  font: "display" | "body";
  size: number;
  color: string;
  weight: Weight;
  /** Letter spacing as a fraction of the font size (display caps). */
  track?: number;
  /** How strongly the Large setting grows this style (0..1, default 1). */
  grow?: number;
  extra?: TextStyle;
}

const SPECS = {
  /** Giant display text (fallback logo, page heroes). */
  display: {
    font: "display",
    size: 64,
    color: COLORS.accentBright,
    weight: "900",
    track: 0.08,
    grow: 0.25,
    extra: { shadow: { ...SHADOW, offsetY: 5, blur: 10 } },
  },
  title: {
    font: "display",
    size: 44,
    color: COLORS.accentBright,
    weight: "700",
    track: 0.06,
    grow: 0.4,
    extra: { shadow: { ...SHADOW, offsetY: 4, blur: 8 } },
  },
  heading: {
    font: "display",
    size: 30,
    color: COLORS.accent,
    weight: "700",
    track: 0.05,
    grow: 0.5,
  },
  subheading: { font: "display", size: 22, color: COLORS.text, weight: "700", track: 0.04 },
  body: { font: "body", size: 20, color: COLORS.text, weight: "500" },
  bodyDim: { font: "body", size: 20, color: COLORS.textDim, weight: "500" },
  small: { font: "body", size: 17, color: COLORS.textDim, weight: "500" },
  tiny: { font: "body", size: 15, color: COLORS.textMuted, weight: "500" },
  button: { font: "display", size: 20, color: COLORS.text, weight: "700", track: 0.06 },
  number: { font: "body", size: 20, color: COLORS.accentBright, weight: "800" },
} as const satisfies Record<string, StyleSpec>;

export type TextStyleName = keyof typeof SPECS;

/** Multiplier per text-size setting (body copy grows the full amount, headings less). */
export const TEXT_SIZE_SCALE: Readonly<Record<TextSize, number>> = { normal: 1, large: 1.18 };

let scale = 1;

/** Current text scale from the "Text size" setting (1 = normal). */
export function textScale(): number {
  return scale;
}

/** A font size in logical px, following the Text size setting: `fontSize: fontPx(18)`. */
export function fontPx(px: number, grow = 1): string {
  return `${Math.max(14, Math.round(px * (1 + (scale - 1) * grow)))}px`;
}

function build(spec: StyleSpec) {
  const size = Math.max(14, Math.round(spec.size * (1 + (scale - 1) * (spec.grow ?? 1))));
  return {
    fontFamily: spec.font === "display" ? DISPLAY_FONT : BODY_FONT,
    fontSize: `${size}px`,
    fontStyle: spec.weight === "400" ? "normal" : spec.weight,
    color: spec.color,
    shadow: SHADOW,
    letterSpacing: spec.track ? Math.round(size * spec.track * 10) / 10 : 0,
    ...spec.extra,
  } satisfies TextStyle;
}

type BuiltStyle = ReturnType<typeof build>;

/**
 * Text styles. Spread and override: `{ ...TEXT.body, color: COLORS.accent }`.
 *
 * | name       | font          | size | weight |
 * |------------|---------------|------|--------|
 * | display    | Cinzel        | 64   | 900    |
 * | title      | Cinzel        | 44   | 700    |
 * | heading    | Cinzel        | 30   | 700    |
 * | subheading | Cinzel        | 22   | 700    |
 * | body       | Alegreya Sans | 20   | 500    |
 * | bodyDim    | Alegreya Sans | 20   | 500    |
 * | small      | Alegreya Sans | 17   | 500    |
 * | tiny       | Alegreya Sans | 15   | 500    |
 * | button     | Cinzel        | 20   | 700    |
 * | number     | Alegreya Sans | 20   | 800    |
 */
export const TEXT = {} as { readonly [K in TextStyleName]: BuiltStyle };

function rebuild(): void {
  const t = TEXT as Record<TextStyleName, BuiltStyle>;
  for (const k of Object.keys(SPECS) as TextStyleName[]) {
    const fresh = build(SPECS[k]);
    // Mutate in place so modules holding a reference to TEXT see the new sizes.
    t[k] = Object.assign(t[k] ?? {}, fresh);
  }
}

function applyTextSize(size: TextSize): void {
  const next = TEXT_SIZE_SCALE[size] ?? 1;
  if (next === scale && Object.keys(TEXT).length > 0) return;
  scale = next;
  rebuild();
}

applyTextSize(getSettings().textSize);
onSettingsChange((s, changed) => {
  if (changed.includes("textSize")) applyTextSize(s.textSize);
});

/** Standard tween durations (ms). */
export const DURATION = {
  fast: 90,
  normal: 160,
  slow: 320,
  fade: 280,
} as const;

/** Depths for shell-level layers inside a scene. */
export const DEPTH = {
  modal: 9000,
  tooltip: 9500,
  toast: 9800,
} as const;

/**
 * Optional sound hooks. The audio module can assign these so every widget click/hover
 * makes a sound without the widgets depending on audio code.
 */
export const uiSoundHooks: {
  hover?: () => void;
  click?: () => void;
  back?: () => void;
  error?: () => void;
} = {};

export function playUiSound(kind: keyof typeof uiSoundHooks): void {
  try {
    uiSoundHooks[kind]?.();
  } catch {
    /* audio must never break UI */
  }
}

/**
 * Legacy ligature workaround. The old pixel font drew its fi/fl/ff ligatures as odd glyphs;
 * Cinzel and Alegreya Sans have proper ligatures, so this is now the identity. Kept so existing
 * imports keep compiling.
 */
export function noLig(text: string): string {
  return text;
}

/** Legacy no-op (see `noLig`). Kept for API compatibility. */
export function installLigatureFix(_TextClass: typeof Phaser.GameObjects.Text): void {}
