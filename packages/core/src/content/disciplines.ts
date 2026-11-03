import type { DisciplineDef, OriginDef } from "../types";

export const DISCIPLINES = {
  vanguard: {
    id: "vanguard",
    name: "Vanguard",
    blurb: "Breacher in salvaged plate. Holds the front, stuns, and shields the squad.",
    base: { maxHp: 38, speed: 3, acc: 90, dodge: 4, crit: 4 },
    growth: { maxHp: 5, acc: 1, prot: 0.5 },
    skills: ["shieldBash", "bulwark", "provoke", "seismicSlam", "grappleChain", "rallyCry"],
    defaultSkills: ["shieldBash", "seismicSlam", "bulwark", "grappleChain"],
    preferredRanks: [1, 2],
    weaponBase: "breachMaul",
    startArmor: "plateVest",
  },
  gunner: {
    id: "gunner",
    name: "Gunner",
    blurb: "Long-gun specialist. Picks targets off from the back and lights them up with flares.",
    base: { maxHp: 28, speed: 5, acc: 96, dodge: 8, crit: 6 },
    growth: { maxHp: 3, acc: 1.5, crit: 0.5 },
    skills: [
      "aimedShot",
      "suppressingFire",
      "flareRound",
      "piercingRound",
      "pointBlank",
      "quickReload",
    ],
    defaultSkills: ["aimedShot", "flareRound", "piercingRound", "suppressingFire"],
    preferredRanks: [3, 4],
    weaponBase: "longRifle",
    startArmor: "scavLeathers",
  },
  lamplighter: {
    id: "lamplighter",
    name: "Lamplighter",
    blurb: "Keeper of the squad's light. Heals, rekindles the fallen, and burns the dark away.",
    base: { maxHp: 27, speed: 4, acc: 90, dodge: 6, crit: 3 },
    growth: { maxHp: 3, healPct: 3, acc: 1 },
    skills: ["kindleWounds", "radiantLash", "beacon", "purge", "blindingFlash", "warmth"],
    defaultSkills: ["kindleWounds", "radiantLash", "beacon", "warmth"],
    preferredRanks: [3, 4],
    weaponBase: "lanternStaff",
    startArmor: "scavLeathers",
  },
  reaver: {
    id: "reaver",
    name: "Reaver",
    blurb: "Knife-fighter of the deep shafts. Fast, bloody, and hard to pin down.",
    base: { maxHp: 30, speed: 7, acc: 93, dodge: 12, crit: 8 },
    growth: { maxHp: 3.5, dodge: 1, crit: 0.5 },
    skills: ["rend", "lunge", "flurry", "execute", "shadowstep", "hamstring"],
    defaultSkills: ["rend", "flurry", "execute", "lunge"],
    preferredRanks: [1, 2],
    weaponBase: "twinBlades",
    startArmor: "scavLeathers",
  },
  hexer: {
    id: "hexer",
    name: "Hexer",
    blurb: "Channels the void between stars. Curses, rots and drains — strongest in the dark.",
    base: { maxHp: 26, speed: 5, acc: 92, dodge: 8, crit: 5 },
    growth: { maxHp: 3, voidPct: 2, acc: 1 },
    skills: ["voidBolt", "hexOfFrailty", "siphon", "umbralTide", "snuffLight", "rotCurse"],
    defaultSkills: ["voidBolt", "hexOfFrailty", "rotCurse", "umbralTide"],
    preferredRanks: [2, 3],
    weaponBase: "voidFocus",
    startArmor: "scavLeathers",
  },
} satisfies Record<string, DisciplineDef>;

export type DisciplineId = keyof typeof DISCIPLINES;
export const DISCIPLINE_IDS = Object.keys(DISCIPLINES) as DisciplineId[];

export const ORIGINS = {
  exMiner: {
    id: "exMiner",
    name: "Ex-Miner",
    blurb: "Spent years in the shafts. Tough, and knows where the good ore hides.",
    mods: { maxHp: 6, oreFind: 25, resPoison: 15 },
  },
  voidBorn: {
    id: "voidBorn",
    name: "Void-Born",
    blurb: "Born on a station that never saw the sun. Sees in the dark.",
    mods: { resVoid: 20, voidPct: 10, darkvision: 1, maxHp: -2 },
  },
  corpDeserter: {
    id: "corpDeserter",
    name: "Corp Deserter",
    blurb: "Walked out of a megacorp security detail with their training intact.",
    mods: { acc: 5, crit: 4, prot: 3 },
  },
  iceHauler: {
    id: "iceHauler",
    name: "Ice Hauler",
    blurb: "Ran cargo across frozen moons. Hard to knock down, hard to stop.",
    mods: { resStun: 25, resDebuff: 15, maxHp: 4 },
  },
  sunPenitent: {
    id: "sunPenitent",
    name: "Sun Penitent",
    blurb: "Pilgrim of a dead star's faith. Carries its light in their hands.",
    mods: { radiantPct: 15, healPct: 10, resVoid: -10 },
  },
  gutterMedic: {
    id: "gutterMedic",
    name: "Gutter Medic",
    blurb: "Patched up dockworkers with whatever was at hand.",
    mods: { healPct: 15, resBleed: 25, resPoison: 15 },
  },
  railVeteran: {
    id: "railVeteran",
    name: "Rail-War Veteran",
    blurb: "Survived the rail wars. Doesn't flinch, doesn't miss.",
    mods: { prot: 6, acc: 4, speed: -1, maxHp: 4 },
  },
  scrapProphet: {
    id: "scrapProphet",
    name: "Scrap Prophet",
    blurb: "Hears the old machines whisper where their treasures lie.",
    mods: { lootFind: 20, oreFind: 10, lightRadius: 1, maxHp: -3 },
  },
} satisfies Record<string, OriginDef>;

export type OriginId = keyof typeof ORIGINS;
export const ORIGIN_IDS = Object.keys(ORIGINS) as OriginId[];

/** Appearance option counts (art must support every index below these bounds). */
export const APPEARANCE_OPTIONS = {
  body: 3,
  skin: 6,
  hair: 8,
  hairColor: 8,
  primary: 10,
  secondary: 10,
  headgear: 5,
  marking: 4,
} as const;
