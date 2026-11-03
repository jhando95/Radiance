/**
 * Master palette for Radiance's pixel art. Every sprite, icon and background draws from
 * these ramps so the whole game reads as one coherent style.
 *
 * Art direction: cold, near-black alien darkness (indigo/steel) against warm lamp light
 * (amber/gold). Accent hues (void purple, crystal cyan, toxic green, rust red) mark
 * elements and factions. Ramps run DARK -> LIGHT; index 0 is the deepest shadow.
 */

export type Ramp = readonly string[];

export const INK = "#05040a"; // outlines / deepest black
export const TRANSPARENT = "";

export const RAMPS = {
  /** Night sky, shadows, background depth. */
  void: ["#07060b", "#0e0c16", "#17142a", "#231f3d", "#34305a", "#4a4677"],
  /** Metal, armor plates, machinery. */
  steel: ["#151a26", "#222b3d", "#364561", "#566c8f", "#8399ba", "#c4d3e6"],
  /** Lamp light, gold, fire highlights. The hero color. */
  lamp: ["#3b1f0e", "#7a3d12", "#c7711c", "#f2a93b", "#ffd36e", "#fff3c4"],
  /** Rust, blood, scav faction, fire damage. */
  rust: ["#24090c", "#4d1518", "#82261f", "#bd4a2e", "#e78450", "#f8c08c"],
  /** Toxic/spore/fungal. */
  toxic: ["#0d1a0d", "#1b3418", "#2f5f26", "#4f9a35", "#8fd25a", "#d4f59a"],
  /** Void/dark element, hexes. */
  umbra: ["#14081f", "#2c1149", "#4b2380", "#7546b8", "#a87fe2", "#dcc6fb"],
  /** Crystals, minerals, shock, scanners. */
  crystal: ["#081c26", "#0f3b4b", "#17697a", "#2ea5ad", "#6fe0d7", "#c8fff3"],
  /** Leather, cloth, wood, dirt. */
  leather: ["#1a110c", "#33221a", "#553828", "#7d5539", "#a77b52", "#d2ab7f"],
  /** Bone, pale cloth, dust. */
  bone: ["#26221f", "#47403a", "#6f665c", "#9c9183", "#c9bfae", "#ece4d4"],
  /** Rock, regolith, cave walls. */
  rock: ["#0c0b10", "#17161e", "#24222d", "#353342", "#4b4859", "#666275"],
} as const satisfies Record<string, Ramp>;

export type RampName = keyof typeof RAMPS;

/** Skin tones (shadow -> highlight), 6 options. */
export const SKIN: readonly Ramp[] = [
  ["#3a2219", "#6b3f2c", "#9c6345", "#c98d66"],
  ["#2b1a14", "#553326", "#7f4f37", "#a8704d"],
  ["#4a2c22", "#8a5a42", "#c2896a", "#e8b896"],
  ["#5a3a30", "#a87763", "#dba98d", "#f6d4bb"],
  ["#1c1415", "#3a2a2a", "#5c4440", "#80625a"],
  ["#2d3a3f", "#4f6870", "#7c999e", "#b0ccc9"], // pale void-touched
];

/** Hair colors (shadow, mid, highlight), 8 options. */
export const HAIR: readonly Ramp[] = [
  ["#0f0c0c", "#221b1b", "#3a3030"], // black
  ["#2a160d", "#4f2b17", "#7a4526"], // brown
  ["#4a2a10", "#8a5420", "#c48a3a"], // auburn
  ["#6b5320", "#b8923a", "#ecd27a"], // blond
  ["#5a1414", "#952622", "#d0473a"], // red
  ["#5c5a63", "#9e9ba8", "#dedbe6"], // white/silver
  ["#1d2a4f", "#34539a", "#5f8fe0"], // dyed blue
  ["#3b1259", "#6c2a9e", "#a865d8"], // dyed violet
];

/** Armor/cloth tint ramps players pick for primary/secondary colors (10 options). */
export const TINTS: readonly { name: string; ramp: Ramp }[] = [
  { name: "Gunmetal", ramp: RAMPS.steel.slice(0, 5) },
  { name: "Rust", ramp: RAMPS.rust.slice(0, 5) },
  { name: "Olive", ramp: ["#141a0e", "#26301a", "#3d4b28", "#5c6b3a", "#8a9a5a"] },
  { name: "Ochre", ramp: ["#2a1a08", "#4f3310", "#7d5418", "#b07c25", "#dcae4f"] },
  { name: "Navy", ramp: ["#080c1c", "#121c3a", "#1f3060", "#344c8c", "#5677bb"] },
  { name: "Crimson", ramp: ["#1f0610", "#3f0c1f", "#6a1530", "#9c2443", "#cf4a62"] },
  { name: "Charcoal", ramp: ["#0b0b0e", "#17171c", "#25252c", "#383842", "#53535f"] },
  { name: "Bone", ramp: RAMPS.bone.slice(1, 6) },
  { name: "Teal", ramp: RAMPS.crystal.slice(0, 5) },
  { name: "Plum", ramp: RAMPS.umbra.slice(0, 5) },
];

/** Item rarity colors (UI text, glows, borders). */
export const RARITY_COLORS = {
  common: "#b9b4c2",
  uncommon: "#6fd28a",
  rare: "#5fa8ff",
  epic: "#b97cff",
  relic: "#ffb23e",
} as const;

/** Damage element colors (numbers, icons, VFX). */
export const ELEMENT_COLORS = {
  physical: "#e8e2d4",
  radiant: "#ffd36e",
  void: "#a87fe2",
  fire: "#f08a4b",
  toxic: "#8fd25a",
} as const;

/** Parse "#rrggbb" to [r,g,b]. */
export function hexToRgb(hex: string): [number, number, number] {
  const n = Number.parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export function rgbToHex(r: number, g: number, b: number): string {
  const c = (v: number) =>
    Math.max(0, Math.min(255, Math.round(v)))
      .toString(16)
      .padStart(2, "0");
  return `#${c(r)}${c(g)}${c(b)}`;
}

/** Linear blend between two hex colors (t=0 -> a, t=1 -> b). */
export function mix(a: string, b: string, t: number): string {
  const [ar, ag, ab] = hexToRgb(a);
  const [br, bg, bb] = hexToRgb(b);
  return rgbToHex(ar + (br - ar) * t, ag + (bg - ag) * t, ab + (bb - ab) * t);
}

/** Phaser-friendly 0xRRGGBB number. */
export function hexNum(hex: string): number {
  return Number.parseInt(hex.slice(1), 16);
}
