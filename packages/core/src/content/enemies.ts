import type { EnemyDef, SkillDef } from "../types";

const ANY = [1, 2, 3, 4] as const;
type R = 1 | 2 | 3 | 4;
const s = (
  id: string,
  name: string,
  from: R[],
  ranks: R[],
  effects: SkillDef["effects"],
  extra: Partial<SkillDef> = {},
): SkillDef => ({
  id,
  name,
  owner: "enemy",
  element: "physical",
  cooldown: 0,
  from,
  target: { side: "enemy", ranks },
  kind: "attack",
  effects,
  icon: "skill_enemyMelee",
  ...extra,
});

/**
 * Enemy stats are for depth 1; the run scales HP and damage with depth.
 * Enemy skill `target.side: "enemy"` means "the mercs" (the enemy's enemies).
 */
export const ENEMIES = {
  huskMiner: {
    id: "huskMiner",
    name: "Husk Miner",
    hp: 22,
    speed: 3,
    acc: 85,
    dodge: 4,
    prot: 10,
    crit: 4,
    dmg: [4, 7],
    res: { resPoison: 60, resBleed: 20, resRadiant: -15 },
    skills: [
      s("pickSwing", "Pick Swing", [1, 2], [1, 2], [{ kind: "damage", mult: 1 }]),
      s(
        "lampSmash",
        "Lamp Smash",
        [1, 2],
        [1, 2],
        [
          { kind: "damage", mult: 0.6 },
          { kind: "lampCharge", amount: -5 },
        ],
        { cooldown: 3 },
      ),
    ],
    xp: 18,
  },
  huskForeman: {
    id: "huskForeman",
    name: "Husk Foreman",
    hp: 64,
    speed: 2,
    acc: 88,
    dodge: 0,
    prot: 25,
    crit: 5,
    dmg: [7, 11],
    res: { resPoison: 70, resBleed: 30, resStun: 40 },
    skills: [
      s(
        "drillCharge",
        "Drill Charge",
        [1, 2],
        [1, 2],
        [
          { kind: "damage", mult: 1.2 },
          { kind: "status", status: "stun", chance: 0.5, turns: 1, value: 0 },
        ],
        { cooldown: 2 },
      ),
      s("groundPound", "Ground Pound", [1, 2], [1, 2, 3], [{ kind: "damage", mult: 0.55 }], {
        target: { side: "enemy", ranks: [1, 2, 3], aoe: true },
      }),
      s(
        "foremansBark",
        "Foreman's Bark",
        [...ANY],
        [...ANY],
        [{ kind: "status", status: "empower", chance: 1, turns: 2, value: 25 }],
        {
          kind: "support",
          cooldown: 3,
          target: { side: "ally", ranks: [...ANY], aoe: true },
          icon: "skill_enemyBuff",
        },
      ),
    ],
    xp: 55,
    elite: true,
  },
  gloamCrawler: {
    id: "gloamCrawler",
    name: "Gloam Crawler",
    hp: 15,
    speed: 7,
    acc: 90,
    dodge: 18,
    prot: 0,
    crit: 8,
    dmg: [3, 6],
    umbral: true,
    res: { resRadiant: -25 },
    skills: [
      s(
        "bite",
        "Bite",
        [1, 2, 3],
        [1, 2, 3],
        [
          { kind: "damage", mult: 1 },
          { kind: "status", status: "bleed", chance: 0.7, turns: 3, value: 2 },
        ],
      ),
      s(
        "skitter",
        "Skitter",
        [...ANY],
        [...ANY],
        [
          { kind: "status", status: "evasive", chance: 1, turns: 2, value: 15, to: "self" },
          { kind: "move", amount: -1, to: "self" },
        ],
        {
          kind: "support",
          cooldown: 3,
          target: { side: "self", ranks: [...ANY] },
          icon: "skill_enemyBuff",
        },
      ),
    ],
    ai: { focusWeak: true },
    xp: 14,
  },
  voidWisp: {
    id: "voidWisp",
    name: "Void Wisp",
    hp: 16,
    speed: 6,
    acc: 88,
    dodge: 15,
    prot: 0,
    crit: 5,
    dmg: [4, 7],
    umbral: true,
    res: { resVoid: 60, resRadiant: -50, resBleed: 80, resPoison: 80 },
    skills: [
      s("voidLance", "Void Lance", [2, 3, 4], [...ANY], [{ kind: "damage", mult: 1 }], {
        element: "void",
        icon: "skill_enemyRanged",
      }),
      s(
        "engulf",
        "Engulf the Light",
        [...ANY],
        [...ANY],
        [
          { kind: "beacon", amount: -1, rounds: 2 },
          { kind: "lampCharge", amount: -4 },
        ],
        {
          kind: "support",
          cooldown: 3,
          target: { side: "self", ranks: [...ANY] },
          element: "void",
          icon: "skill_enemyDebuff",
        },
      ),
    ],
    xp: 16,
  },
  shardback: {
    id: "shardback",
    name: "Shardback",
    hp: 34,
    speed: 1,
    acc: 86,
    dodge: 0,
    prot: 35,
    crit: 4,
    dmg: [4, 7],
    res: { resVoid: 20, resBleed: 50, resPoison: 30 },
    skills: [
      s("crystalSpikes", "Crystal Spikes", [1, 2], [1, 2], [{ kind: "damage", mult: 0.7 }], {
        target: { side: "enemy", ranks: [1, 2], aoe: true },
      }),
      s(
        "harden",
        "Harden",
        [...ANY],
        [...ANY],
        [
          { kind: "guard", turns: 2 },
          { kind: "status", status: "shield", chance: 1, turns: 2, value: 10, to: "self" },
        ],
        {
          kind: "support",
          cooldown: 3,
          target: { side: "ally", ranks: [...ANY] },
          icon: "skill_enemyBuff",
        },
      ),
    ],
    xp: 20,
  },
  scavCutter: {
    id: "scavCutter",
    name: "Scav Cutter",
    hp: 20,
    speed: 5,
    acc: 92,
    dodge: 12,
    prot: 8,
    crit: 8,
    dmg: [4, 8],
    skills: [
      s(
        "slash",
        "Slash",
        [1, 2],
        [1, 2],
        [
          { kind: "damage", mult: 1 },
          { kind: "status", status: "bleed", chance: 0.5, turns: 2, value: 2 },
        ],
      ),
      s(
        "dirtyStrike",
        "Dirty Strike",
        [1, 2, 3],
        [1, 2, 3],
        [
          { kind: "damage", mult: 0.7 },
          { kind: "status", status: "blind", chance: 0.6, turns: 2, value: 15 },
        ],
        { cooldown: 2 },
      ),
    ],
    xp: 15,
  },
  scavGunner: {
    id: "scavGunner",
    name: "Scav Gunner",
    hp: 17,
    speed: 4,
    acc: 92,
    dodge: 8,
    prot: 5,
    crit: 10,
    dmg: [5, 8],
    skills: [
      s("snipe", "Snipe", [3, 4], [2, 3, 4], [{ kind: "damage", mult: 1.1 }], {
        icon: "skill_enemyRanged",
      }),
      s(
        "flashbang",
        "Flashbang",
        [2, 3, 4],
        [1, 2],
        [
          { kind: "damage", mult: 0.3 },
          { kind: "status", status: "blind", chance: 0.7, turns: 2, value: 15 },
        ],
        {
          cooldown: 3,
          target: { side: "enemy", ranks: [1, 2], aoe: true },
          icon: "skill_enemyDebuff",
        },
      ),
      s("hipFire", "Hip Fire", [1, 2], [1, 2], [{ kind: "damage", mult: 0.8 }], {
        icon: "skill_enemyRanged",
      }),
    ],
    xp: 15,
  },
  umbralStalker: {
    id: "umbralStalker",
    name: "Umbral Stalker",
    hp: 24,
    speed: 8,
    acc: 95,
    dodge: 22,
    prot: 5,
    crit: 12,
    dmg: [5, 9],
    umbral: true,
    res: { resRadiant: -30, resVoid: 40 },
    skills: [
      s("pounce", "Pounce", [1, 2, 3], [...ANY], [{ kind: "damage", mult: 1.1 }]),
      s(
        "shadowRend",
        "Shadow Rend",
        [1, 2],
        [1, 2],
        [
          { kind: "damage", mult: 0.8 },
          { kind: "status", status: "bleed", chance: 0.8, turns: 3, value: 3 },
        ],
        { cooldown: 2, element: "void" },
      ),
    ],
    ai: { focusWeak: true },
    xp: 22,
  },
  mycelidTender: {
    id: "mycelidTender",
    name: "Mycelid Tender",
    hp: 20,
    speed: 3,
    acc: 85,
    dodge: 5,
    prot: 5,
    crit: 2,
    dmg: [2, 4],
    res: { resPoison: 90, resFire: -30 },
    skills: [
      s(
        "sporeCloud",
        "Spore Cloud",
        [2, 3, 4],
        [...ANY],
        [
          { kind: "damage", mult: 0.3 },
          { kind: "status", status: "toxic", chance: 0.7, turns: 3, value: 3 },
        ],
        {
          cooldown: 2,
          element: "toxic",
          target: { side: "enemy", ranks: [...ANY], aoe: true },
          icon: "skill_enemyDebuff",
        },
      ),
      s("mend", "Mend", [...ANY], [...ANY], [{ kind: "heal", min: 6, max: 9 }], {
        kind: "support",
        cooldown: 1,
        target: { side: "ally", ranks: [...ANY] },
        icon: "skill_enemyHeal",
      }),
      s("lash", "Root Lash", [1, 2, 3], [1, 2], [{ kind: "damage", mult: 1 }]),
    ],
    xp: 16,
  },
  lumenEater: {
    id: "lumenEater",
    name: "The Lumen Eater",
    hp: 170,
    speed: 4,
    acc: 92,
    dodge: 0,
    prot: 20,
    crit: 5,
    dmg: [8, 13],
    umbral: true,
    res: { resRadiant: -25, resVoid: 50, resStun: 60, resBleed: 30, resPoison: 30 },
    skills: [
      s(
        "devourLight",
        "Devour Light",
        [...ANY],
        [...ANY],
        [
          { kind: "damage", mult: 0.4 },
          { kind: "lampCharge", amount: -8 },
          { kind: "beacon", amount: -1, rounds: 2 },
        ],
        {
          cooldown: 3,
          element: "void",
          target: { side: "enemy", ranks: [...ANY], aoe: true },
          icon: "skill_enemyDebuff",
        },
      ),
      s("crushingMaw", "Crushing Maw", [1, 2], [1, 2], [{ kind: "damage", mult: 1.3 }]),
      s(
        "lightlessGaze",
        "Lightless Gaze",
        [...ANY],
        [...ANY],
        [
          { kind: "damage", mult: 0.5 },
          { kind: "status", status: "mark", chance: 0.9, turns: 2, value: 25 },
          { kind: "status", status: "weaken", chance: 0.7, turns: 2, value: 20 },
        ],
        { cooldown: 2, element: "void", icon: "skill_enemyDebuff" },
      ),
    ],
    xp: 0,
    boss: true,
  },
  mawTendril: {
    id: "mawTendril",
    name: "Maw Tendril",
    hp: 26,
    speed: 5,
    acc: 90,
    dodge: 5,
    prot: 10,
    crit: 5,
    dmg: [4, 6],
    umbral: true,
    res: { resRadiant: -20 },
    skills: [
      s("tendrilLash", "Lash", [...ANY], [...ANY], [{ kind: "damage", mult: 1 }]),
      s(
        "constrict",
        "Constrict",
        [1, 2, 3],
        [1, 2],
        [
          { kind: "damage", mult: 0.6 },
          { kind: "status", status: "stun", chance: 0.4, turns: 1, value: 0 },
        ],
        { cooldown: 3 },
      ),
    ],
    xp: 12,
  },
} satisfies Record<string, EnemyDef>;

export type EnemyId = keyof typeof ENEMIES;

/** Encounter pools by biome (index 0 = rank 1). */
export const ENCOUNTERS: Record<
  "ashenSurface" | "duskMines" | "crystalHollows",
  readonly (readonly string[])[]
> = {
  ashenSurface: [
    ["scavCutter", "scavCutter", "scavGunner"],
    ["scavCutter", "gloamCrawler", "scavGunner"],
    ["gloamCrawler", "gloamCrawler", "scavGunner", "scavGunner"],
    ["huskMiner", "scavCutter", "scavGunner"],
  ],
  duskMines: [
    ["huskMiner", "huskMiner", "mycelidTender"],
    ["huskMiner", "gloamCrawler", "voidWisp"],
    ["gloamCrawler", "huskMiner", "gloamCrawler", "mycelidTender"],
    ["huskMiner", "huskMiner", "voidWisp", "voidWisp"],
  ],
  crystalHollows: [
    ["shardback", "voidWisp", "voidWisp"],
    ["umbralStalker", "shardback", "voidWisp"],
    ["shardback", "umbralStalker", "mycelidTender", "voidWisp"],
    ["umbralStalker", "umbralStalker", "voidWisp"],
  ],
} as const;

export const ELITE_ENCOUNTERS: readonly (readonly string[])[] = [
  ["huskForeman", "huskMiner", "mycelidTender"],
  ["umbralStalker", "huskForeman", "voidWisp"],
  ["shardback", "umbralStalker", "umbralStalker", "voidWisp"],
] as const;

export const BOSS_ENCOUNTER: readonly string[] = [
  "mawTendril",
  "lumenEater",
  "mawTendril",
] as const;
