/**
 * Visual language for Radiance's UI: one font, a small set of text styles, colors pulled
 * from the art palette, and an 8px spacing grid. Every widget and scene reads from here
 * so the whole shell looks like one game.
 */
import type * as Phaser from "phaser";
import { hexNum, INK, RAMPS, RARITY_COLORS } from "../art/palette";

export const FONT_FAMILY = '"Pixelify Sans", "Courier New", monospace';

/** Logical game resolution. */
export const GAME_W = 1280;
export const GAME_H = 720;

/** Spacing grid unit (px). Use multiples: GRID, GRID*2, ... */
export const GRID = 8;
/** Scale applied to native pixel-art UI textures (panels, buttons, icons). */
export const UI_SCALE = 3;
/** Scale applied to full-screen backdrops (320x180 native). */
export const BACKDROP_SCALE = 4;

/** Hex strings, for text styles and DOM. */
export const COLORS = {
  bg: RAMPS.void[0],
  bgDeep: INK,
  panel: RAMPS.void[1],
  panelLight: RAMPS.void[2],
  line: RAMPS.void[4],
  text: RAMPS.bone[5],
  textDim: RAMPS.bone[3],
  textMuted: RAMPS.steel[3],
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

const SHADOW = { offsetX: 0, offsetY: 2, color: INK, blur: 0, fill: true, stroke: false };

type TextStyle = Phaser.Types.GameObjects.Text.TextStyle;

function style(size: number, color: string, weight: "400" | "600" | "700", extra?: TextStyle) {
  return {
    fontFamily: FONT_FAMILY,
    fontSize: `${size}px`,
    fontStyle: weight === "400" ? "normal" : weight,
    color,
    shadow: SHADOW,
    ...extra,
  } satisfies TextStyle;
}

/**
 * Text styles. Sizes are multiples of 8 (or 4 for the smallest) so Pixelify Sans lands on
 * whole pixels at 1280x720. Spread and override: `{ ...TEXT.body, color: COLORS.accent }`.
 */
export const TEXT = {
  /** Giant display text (fallback logo, page heroes). */
  display: style(64, COLORS.accentBright, "700", {
    shadow: { ...SHADOW, offsetY: 4 },
  }),
  title: style(40, COLORS.accentBright, "700", { shadow: { ...SHADOW, offsetY: 3 } }),
  heading: style(28, COLORS.accent, "600"),
  subheading: style(20, COLORS.text, "600"),
  body: style(20, COLORS.text, "400"),
  bodyDim: style(20, COLORS.textDim, "400"),
  small: style(16, COLORS.textDim, "400"),
  tiny: style(14, COLORS.textMuted, "400"),
  button: style(20, COLORS.text, "600"),
  number: style(20, COLORS.accentBright, "700"),
} as const satisfies Record<string, TextStyle>;

export type TextStyleName = keyof typeof TEXT;

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

/** Zero-width non-joiner: breaks font ligatures without taking space. */
const ZWNJ = "‌";

/**
 * Pixelify Sans has fi / fl / ff ligatures that render as odd glyphs in canvas text
 * ("Confirm" reads "ConfIrm"). Insert a ZWNJ between f and i/l/f to suppress them.
 * Idempotent. `installLigatureFix()` applies this to every Phaser Text automatically.
 */
export function noLig(text: string): string {
  return text.includes("f") ? text.replace(/f(?=[fil])/g, `f${ZWNJ}`) : text;
}

let ligatureFixInstalled = false;

/**
 * Patch Phaser.GameObjects.Text#setText (also used by the constructor) so every text object in
 * every scene goes through `noLig`. Call once at startup (main.ts does). Note that
 * `text.text` then contains ZWNJ characters; strip /‌/g before comparing strings.
 */
export function installLigatureFix(TextClass: typeof Phaser.GameObjects.Text): void {
  if (ligatureFixInstalled) return;
  ligatureFixInstalled = true;
  const proto = TextClass.prototype;
  const original = proto.setText;
  proto.setText = function (this: Phaser.GameObjects.Text, value: string | string[]) {
    const fixed = Array.isArray(value)
      ? value.map((v) => (typeof v === "string" ? noLig(v) : v))
      : typeof value === "string"
        ? noLig(value)
        : value;
    return original.call(this, fixed);
  };
}
