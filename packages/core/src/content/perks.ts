import type { PerkDef } from "../types";

const p = (def: PerkDef) => def;

/**
 * Perks are offered three at a time on level up. General perks fit any build; discipline
 * perks reshape that discipline's skills. Relic perks only come from relic-rarity loot.
 */
export const PERKS = {
  // ---- General -------------------------------------------------------------
  toughened: p({
    id: "toughened",
    name: "Toughened",
    pool: "general",
    desc: "+10 max HP.",
    mods: { maxHp: 10 },
  }),
  quickHands: p({
    id: "quickHands",
    name: "Quick Hands",
    pool: "general",
    desc: "+2 speed.",
    mods: { speed: 2 },
  }),
  keenEye: p({
    id: "keenEye",
    name: "Keen Eye",
    pool: "general",
    desc: "+6% crit chance.",
    mods: { crit: 6 },
  }),
  steadyAim: p({
    id: "steadyAim",
    name: "Steady Aim",
    pool: "general",
    desc: "+8 accuracy.",
    mods: { acc: 8 },
  }),
  lightFooted: p({
    id: "lightFooted",
    name: "Light-Footed",
    pool: "general",
    desc: "+8 dodge.",
    mods: { dodge: 8 },
  }),
  thickSkin: p({
    id: "thickSkin",
    name: "Thick Skin",
    pool: "general",
    desc: "+8% protection.",
    mods: { prot: 8 },
  }),
  bloodlust: p({
    id: "bloodlust",
    name: "Bloodlust",
    pool: "general",
    desc: "Killing blows heal 15% max HP.",
    triggers: [{ on: "kill", healPct: 15 }],
  }),
  adrenaline: p({
    id: "adrenaline",
    name: "Adrenaline",
    pool: "general",
    desc: "+25% damage while below half HP.",
    cond: { lowHpPct: 25 },
  }),
  darkAdapted: p({
    id: "darkAdapted",
    name: "Dark-Adapted",
    pool: "general",
    desc: "No accuracy or crit penalty against unlit targets.",
    mods: { darkvision: 1 },
  }),
  lampWarden: p({
    id: "lampWarden",
    name: "Lamp Warden",
    pool: "general",
    desc: "+1 light radius.",
    mods: { lightRadius: 1 },
  }),
  scavenger: p({
    id: "scavenger",
    name: "Scavenger",
    pool: "general",
    desc: "+25% ore found, +10% loot rarity.",
    mods: { oreFind: 25, lootFind: 10 },
  }),
  opportunist: p({
    id: "opportunist",
    name: "Opportunist",
    pool: "general",
    desc: "+20% damage to Marked targets.",
    cond: { vsMarkedPct: 20 },
  }),
  cruelty: p({
    id: "cruelty",
    name: "Cruelty",
    pool: "general",
    desc: "+20% damage to bleeding targets.",
    cond: { vsBleedingPct: 20 },
  }),
  plating: p({
    id: "plating",
    name: "Reactive Plating",
    pool: "general",
    desc: "Gain 3 shield at the start of each turn.",
    triggers: [{ on: "turnStart", shield: 3 }],
  }),
  ironWill: p({
    id: "ironWill",
    name: "Iron Will",
    pool: "general",
    desc: "+30% stun resist, +20% debuff resist.",
    mods: { resStun: 30, resDebuff: 20 },
  }),
  antivenom: p({
    id: "antivenom",
    name: "Antivenom",
    pool: "general",
    desc: "+40% poison resist, +25% bleed resist.",
    mods: { resPoison: 40, resBleed: 25 },
  }),
  executioner: p({
    id: "executioner",
    name: "Executioner",
    pool: "general",
    desc: "+25% crit damage.",
    mods: { critDmg: 25 },
  }),
  precision: p({
    id: "precision",
    name: "Precision Strikes",
    pool: "general",
    desc: "Crits Mark the target (+20% damage taken, 2 turns).",
    triggers: [{ on: "crit", status: "mark", turns: 2, value: 20 }],
  }),
  sunblessed: p({
    id: "sunblessed",
    name: "Sunblessed",
    pool: "general",
    desc: "+15% radiant damage.",
    mods: { radiantPct: 15 },
  }),
  voidtouched: p({
    id: "voidtouched",
    name: "Voidtouched",
    pool: "general",
    desc: "+15% void damage.",
    mods: { voidPct: 15 },
  }),
  pyromaniac: p({
    id: "pyromaniac",
    name: "Pyromaniac",
    pool: "general",
    desc: "+20% fire damage.",
    mods: { firePct: 20 },
  }),
  festering: p({
    id: "festering",
    name: "Festering",
    pool: "general",
    desc: "+25% damage over time.",
    mods: { dotPct: 25 },
  }),
  fieldMedic: p({
    id: "fieldMedic",
    name: "Field Medic",
    pool: "general",
    desc: "+20% healing done.",
    mods: { healPct: 20 },
  }),
  leech: p({
    id: "leech",
    name: "Leech",
    pool: "general",
    desc: "Heal for 8% of damage dealt.",
    mods: { lifesteal: 8 },
  }),

  // ---- Vanguard ------------------------------------------------------------
  unbreakable: p({
    id: "unbreakable",
    name: "Unbreakable",
    pool: "vanguard",
    desc: "+10% protection, +8 max HP.",
    mods: { prot: 10, maxHp: 8 },
  }),
  shieldMaster: p({
    id: "shieldMaster",
    name: "Shield Master",
    pool: "vanguard",
    desc: "Shield Bash: -1 cooldown, +20% damage.",
    skillMods: { shieldBash: { cooldown: -1, dmgMult: 0.2 } },
  }),
  wardensOath: p({
    id: "wardensOath",
    name: "Warden's Oath",
    pool: "vanguard",
    desc: "Bulwark also heals the guarded ally 4–6.",
    skillMods: { bulwark: { addEffects: [{ kind: "heal", min: 4, max: 6 }] } },
  }),
  earthshaker: p({
    id: "earthshaker",
    name: "Earthshaker",
    pool: "vanguard",
    desc: "Seismic Slam has a 35% chance to stun.",
    skillMods: {
      seismicSlam: {
        addEffects: [{ kind: "status", status: "stun", chance: 0.35, turns: 1, value: 0 }],
      },
    },
  }),
  chainmaster: p({
    id: "chainmaster",
    name: "Chainmaster",
    pool: "vanguard",
    desc: "Grapple Chain: -1 cooldown and causes bleed.",
    skillMods: {
      grappleChain: {
        cooldown: -1,
        addEffects: [{ kind: "status", status: "bleed", chance: 0.8, turns: 3, value: 3 }],
      },
    },
  }),
  frontline: p({
    id: "frontline",
    name: "Frontliner",
    pool: "vanguard",
    desc: "+12 dodge while in rank 1.",
    cond: { frontRankDodge: 12 },
  }),

  // ---- Gunner --------------------------------------------------------------
  deadeye: p({
    id: "deadeye",
    name: "Deadeye",
    pool: "gunner",
    desc: "Aimed Shot: +10% crit, +15% damage.",
    skillMods: { aimedShot: { critMod: 10, dmgMult: 0.15 } },
  }),
  incendiary: p({
    id: "incendiary",
    name: "Incendiary Rounds",
    pool: "gunner",
    desc: "Flare Round burns harder; +10% fire damage.",
    mods: { firePct: 10 },
    skillMods: {
      flareRound: {
        addEffects: [{ kind: "status", status: "burn", chance: 0.7, turns: 3, value: 3 }],
      },
    },
  }),
  armorPiercer: p({
    id: "armorPiercer",
    name: "Armor Piercer",
    pool: "gunner",
    desc: "Piercing Round: -1 cooldown.",
    skillMods: { piercingRound: { cooldown: -1 } },
  }),
  suppressor: p({
    id: "suppressor",
    name: "Suppressor",
    pool: "gunner",
    desc: "Suppressing Fire also Weakens.",
    skillMods: {
      suppressingFire: {
        addEffects: [{ kind: "status", status: "weaken", chance: 0.6, turns: 2, value: 15 }],
      },
    },
  }),
  trickShot: p({
    id: "trickShot",
    name: "Trick Shot",
    pool: "gunner",
    desc: "Crits cause bleed (3 turns).",
    triggers: [{ on: "crit", status: "bleed", turns: 3, value: 3 }],
  }),
  spotter: p({
    id: "spotter",
    name: "Spotter",
    pool: "gunner",
    desc: "Hits have a 25% chance to Mark.",
    triggers: [{ on: "hit", status: "mark", chance: 0.25, turns: 2, value: 15 }],
  }),

  // ---- Lamplighter ---------------------------------------------------------
  lightbringer: p({
    id: "lightbringer",
    name: "Lightbringer",
    pool: "lamplighter",
    desc: "+1 light radius; Beacon -1 cooldown.",
    mods: { lightRadius: 1 },
    skillMods: { beacon: { cooldown: -1 } },
  }),
  devoted: p({
    id: "devoted",
    name: "Devoted Healer",
    pool: "lamplighter",
    desc: "+25% healing done.",
    mods: { healPct: 25 },
  }),
  searingLight: p({
    id: "searingLight",
    name: "Searing Light",
    pool: "lamplighter",
    desc: "Radiant Lash: +25% damage and may burn.",
    skillMods: {
      radiantLash: {
        dmgMult: 0.25,
        addEffects: [{ kind: "status", status: "burn", chance: 0.4, turns: 2, value: 2 }],
      },
    },
  }),
  sanctuary: p({
    id: "sanctuary",
    name: "Sanctuary",
    pool: "lamplighter",
    desc: "Warmth also grants 4 shield.",
    skillMods: {
      warmth: { addEffects: [{ kind: "status", status: "shield", chance: 1, turns: 2, value: 4 }] },
    },
  }),
  dazzle: p({
    id: "dazzle",
    name: "Dazzle",
    pool: "lamplighter",
    desc: "Blinding Flash: +25% stun chance.",
    skillMods: {
      blindingFlash: {
        addEffects: [{ kind: "status", status: "stun", chance: 0.25, turns: 1, value: 0 }],
      },
    },
  }),
  emberHeart: p({
    id: "emberHeart",
    name: "Ember Heart",
    pool: "lamplighter",
    desc: "Heal 4% max HP at the start of each turn.",
    triggers: [{ on: "turnStart", healPct: 4 }],
  }),

  // ---- Reaver --------------------------------------------------------------
  hemorrhage: p({
    id: "hemorrhage",
    name: "Hemorrhage",
    pool: "reaver",
    desc: "Rend bleeds deeper; +15% damage over time.",
    mods: { dotPct: 15 },
    skillMods: {
      rend: { addEffects: [{ kind: "status", status: "bleed", chance: 0.5, turns: 3, value: 2 }] },
    },
  }),
  bladeDancer: p({
    id: "bladeDancer",
    name: "Blade Dancer",
    pool: "reaver",
    desc: "+6 dodge, +1 speed.",
    mods: { dodge: 6, speed: 1 },
  }),
  reapersMark: p({
    id: "reapersMark",
    name: "Reaper's Mark",
    pool: "reaver",
    desc: "Execute: -1 cooldown, +20% damage.",
    skillMods: { execute: { cooldown: -1, dmgMult: 0.2 } },
  }),
  whirlwind: p({
    id: "whirlwind",
    name: "Whirlwind",
    pool: "reaver",
    desc: "Flurry: +10% damage per hit and may bleed.",
    skillMods: {
      flurry: {
        dmgMult: 0.1,
        addEffects: [{ kind: "status", status: "bleed", chance: 0.3, turns: 2, value: 2 }],
      },
    },
  }),
  killingSpree: p({
    id: "killingSpree",
    name: "Killing Spree",
    pool: "reaver",
    desc: "Killing blows Empower (+25% damage, 2 turns).",
    triggers: [{ on: "kill", empower: 25 }],
  }),
  shadowborn: p({
    id: "shadowborn",
    name: "Shadowborn",
    pool: "reaver",
    desc: "+20% damage to unlit targets; sees in the dark.",
    mods: { darkvision: 1 },
    cond: { vsUnlitPct: 20 },
  }),

  // ---- Hexer ---------------------------------------------------------------
  deepVoid: p({
    id: "deepVoid",
    name: "Deep Void",
    pool: "hexer",
    desc: "+20% void damage.",
    mods: { voidPct: 20 },
  }),
  maledict: p({
    id: "maledict",
    name: "Maledict",
    pool: "hexer",
    desc: "Hex of Frailty: -1 cooldown, also Weakens.",
    skillMods: {
      hexOfFrailty: {
        cooldown: -1,
        addEffects: [{ kind: "status", status: "weaken", chance: 0.6, turns: 2, value: 15 }],
      },
    },
  }),
  soulLeech: p({
    id: "soulLeech",
    name: "Soul Leech",
    pool: "hexer",
    desc: "Heal for 15% of damage dealt.",
    mods: { lifesteal: 15 },
  }),
  plague: p({
    id: "plague",
    name: "Plaguebringer",
    pool: "hexer",
    desc: "Rot Curse festers; +20% damage over time.",
    mods: { dotPct: 20 },
    skillMods: {
      rotCurse: {
        addEffects: [{ kind: "status", status: "toxic", chance: 0.6, turns: 3, value: 2 }],
      },
    },
  }),
  abyssalTide: p({
    id: "abyssalTide",
    name: "Abyssal Tide",
    pool: "hexer",
    desc: "Umbral Tide: +20% damage and may Mark.",
    skillMods: {
      umbralTide: {
        dmgMult: 0.2,
        addEffects: [{ kind: "status", status: "mark", chance: 0.35, turns: 2, value: 20 }],
      },
    },
  }),
  eclipse: p({
    id: "eclipse",
    name: "Eclipse",
    pool: "hexer",
    desc: "+30% damage to unlit targets.",
    cond: { vsUnlitPct: 30 },
  }),

  // ---- Relic (granted by relic items only) -----------------------------------
  oldSunHeart: p({
    id: "oldSunHeart",
    name: "Heart of the Old Sun",
    pool: "relic",
    desc: "+25% radiant damage, +1 light radius.",
    mods: { radiantPct: 25, lightRadius: 1 },
  }),
  eclipseShard: p({
    id: "eclipseShard",
    name: "Eclipse Shard",
    pool: "relic",
    desc: "+35% damage to unlit targets, +10% void damage.",
    mods: { voidPct: 10 },
    cond: { vsUnlitPct: 35 },
  }),
  gravediggersBell: p({
    id: "gravediggersBell",
    name: "Gravedigger's Bell",
    pool: "relic",
    desc: "Killing blows Empower (+30%) and refuel the lamp by 4.",
    triggers: [{ on: "kill", empower: 30, lamp: 4 }],
  }),
  foremansLedger: p({
    id: "foremansLedger",
    name: "Foreman's Ledger",
    pool: "relic",
    desc: "+60% ore found, +25% loot rarity.",
    mods: { oreFind: 60, lootFind: 25 },
  }),
  stalkerFang: p({
    id: "stalkerFang",
    name: "Stalker's Fang",
    pool: "relic",
    desc: "+10% crit; crits cause heavy bleeding.",
    mods: { crit: 10 },
    triggers: [{ on: "crit", status: "bleed", turns: 3, value: 4 }],
  }),
  wardensAegis: p({
    id: "wardensAegis",
    name: "Warden's Aegis",
    pool: "relic",
    desc: "+6% protection; gain 4 shield each turn.",
    mods: { prot: 6 },
    triggers: [{ on: "turnStart", shield: 4 }],
  }),
  hollowCrown: p({
    id: "hollowCrown",
    name: "Hollow Crown",
    pool: "relic",
    desc: "+3 speed, +8 dodge, -10 max HP.",
    mods: { speed: 3, dodge: 8, maxHp: -10 },
  }),
} satisfies Record<string, PerkDef>;

export type PerkId = keyof typeof PERKS;
