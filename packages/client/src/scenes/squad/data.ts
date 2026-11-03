/**
 * Squad builder data helpers: appearance option labels, default/random setups, setup
 * validation and the stat preview (via core's createMerc + computeStats).
 */
import {
  APPEARANCE_OPTIONS,
  type Appearance,
  computeStats,
  createMerc,
  DISCIPLINE_IDS,
  DISCIPLINES,
  getDiscipline,
  type MercSetup,
  ORIGIN_IDS,
  type Stats,
  validSkillLoadout,
} from "@radiance/core";
import { HAIR, SKIN, TINTS } from "../../art/palette";
import { MAX_NAME_LENGTH, randomName } from "./names";

export type AppearanceKey = keyof Appearance;

export interface AppearanceRow {
  key: AppearanceKey;
  label: string;
  /** Display name of option `i`. */
  name(i: number): string;
  /** Optional swatch color ("#rrggbb") for option `i`. */
  swatch?(i: number): string;
}

const BODY_NAMES = ["Slim", "Standard", "Broad"];
const HAIR_NAMES = ["Shaved", "Crop", "Mohawk", "Tied Back", "Braids", "Fringe", "Topknot", "Wild"];
const HAIR_COLOR_NAMES = ["Black", "Brown", "Auburn", "Blond", "Red", "Silver", "Blue", "Violet"];
const HEADGEAR_NAMES = ["None", "Hood", "Goggles", "Rebreather", "Helmet"];
const MARKING_NAMES = ["None", "Scar", "War Paint", "Cyber Eye"];

const named = (names: readonly string[], fallback: string) => (i: number) =>
  names[i] ?? `${fallback} ${i + 1}`;

/** Every APPEARANCE_OPTIONS key with a readable label (display order). */
export const APPEARANCE_ROWS: readonly AppearanceRow[] = [
  { key: "body", label: "Build", name: named(BODY_NAMES, "Build") },
  {
    key: "skin",
    label: "Skin",
    name: (i) => `Tone ${i + 1}`,
    swatch: (i) => SKIN[i]?.[2] ?? "#000000",
  },
  { key: "hair", label: "Hair", name: named(HAIR_NAMES, "Style") },
  {
    key: "hairColor",
    label: "Hair Color",
    name: named(HAIR_COLOR_NAMES, "Color"),
    swatch: (i) => HAIR[i]?.[1] ?? "#000000",
  },
  {
    key: "primary",
    label: "Primary",
    name: (i) => TINTS[i]?.name ?? `Tint ${i + 1}`,
    swatch: (i) => TINTS[i]?.ramp[3] ?? "#000000",
  },
  {
    key: "secondary",
    label: "Secondary",
    name: (i) => TINTS[i]?.name ?? `Tint ${i + 1}`,
    swatch: (i) => TINTS[i]?.ramp[3] ?? "#000000",
  },
  { key: "headgear", label: "Headgear", name: named(HEADGEAR_NAMES, "Headgear") },
  { key: "marking", label: "Marking", name: named(MARKING_NAMES, "Marking") },
];

/** Cheap seeded PRNG for UI randomization. */
export function uiRng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function freshSeed(): number {
  return Math.floor(Math.random() * 0x7fffffff);
}

const int = (r: () => number, n: number) => Math.floor(r() * n);

export function randomAppearance(r: () => number): Appearance {
  const primary = int(r, APPEARANCE_OPTIONS.primary);
  let secondary = int(r, APPEARANCE_OPTIONS.secondary - 1);
  if (secondary >= primary) secondary++;
  return {
    body: int(r, APPEARANCE_OPTIONS.body),
    skin: int(r, APPEARANCE_OPTIONS.skin),
    hair: int(r, APPEARANCE_OPTIONS.hair),
    hairColor: int(r, APPEARANCE_OPTIONS.hairColor),
    primary,
    secondary,
    // Bare heads are more common so faces stay visible.
    headgear: r() < 0.45 ? 0 : 1 + int(r, APPEARANCE_OPTIONS.headgear - 1),
    marking: r() < 0.4 ? 0 : 1 + int(r, APPEARANCE_OPTIONS.marking - 1),
  };
}

/** Discipline order for default squads: a front line first, then support and range. */
const DEFAULT_ORDER: Record<number, string[]> = {
  1: ["vanguard"],
  2: ["vanguard", "lamplighter"],
  3: ["vanguard", "reaver", "lamplighter"],
  4: ["vanguard", "reaver", "lamplighter", "gunner"],
};

export function defaultSetups(slots: number, seed = freshSeed()): MercSetup[] {
  const r = uiRng(seed);
  const order = DEFAULT_ORDER[slots] ?? DEFAULT_ORDER[4] ?? [];
  const origins = [...ORIGIN_IDS].sort(() => r() - 0.5);
  const used = new Set<string>();
  return Array.from({ length: slots }, (_, i) => {
    const discipline = order[i] ?? DISCIPLINE_IDS[i % DISCIPLINE_IDS.length] ?? "vanguard";
    let name = randomName(int(r, 0x7fffffff));
    for (let tries = 0; used.has(name) && tries < 8; tries++) {
      name = randomName(int(r, 0x7fffffff));
    }
    used.add(name);
    return {
      name,
      discipline,
      origin: origins[i % origins.length] ?? "exMiner",
      appearance: randomAppearance(r),
      skills: [...getDiscipline(discipline).defaultSkills],
    };
  });
}

/** Coerce an incoming setup (e.g. `initial`) into something the builder can edit. */
export function sanitizeSetup(s: MercSetup, fallback: MercSetup): MercSetup {
  const discipline = s.discipline in DISCIPLINES ? s.discipline : fallback.discipline;
  const origin = (ORIGIN_IDS as string[]).includes(s.origin) ? s.origin : fallback.origin;
  const appearance = { ...fallback.appearance };
  for (const key of Object.keys(APPEARANCE_OPTIONS) as AppearanceKey[]) {
    const v = s.appearance?.[key];
    if (typeof v === "number" && Number.isInteger(v) && v >= 0 && v < APPEARANCE_OPTIONS[key]) {
      appearance[key] = v;
    }
  }
  return {
    name: (s.name ?? "").slice(0, MAX_NAME_LENGTH),
    discipline,
    origin,
    appearance,
    skills: validSkillLoadout(discipline, s.skills ?? []),
  };
}

/** Problem with a setup, or null when it's ready to confirm. */
export function setupProblem(s: MercSetup): string | null {
  const name = s.name.trim();
  if (!name) return "needs a name";
  if (name.length > MAX_NAME_LENGTH) return `name is over ${MAX_NAME_LENGTH} characters`;
  if (new Set(s.skills).size !== 4) return "needs 4 skills";
  return null;
}

/** Final, validated setup for onConfirm. */
export function finalizeSetup(s: MercSetup): MercSetup {
  return {
    name: s.name.trim().slice(0, MAX_NAME_LENGTH),
    discipline: s.discipline,
    origin: s.origin,
    appearance: { ...s.appearance },
    skills: validSkillLoadout(s.discipline, s.skills),
  };
}

/** Level-1 stats a merc built from `setup` would have (starting gear included). */
export function previewStats(setup: MercSetup): Stats {
  let uid = 1;
  const merc = createMerc(
    { ...setup, name: setup.name || "?" },
    "preview",
    "preview",
    { next: () => uid++ },
    setup.discipline === "lamplighter",
  );
  return computeStats(merc);
}
