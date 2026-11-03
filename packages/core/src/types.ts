import type { RngState } from "./rng";

export type PlayerId = string;
export type UnitId = string;

// ---------------------------------------------------------------------------
// Stats
// ---------------------------------------------------------------------------

export const ELEMENTS = ["physical", "radiant", "void", "fire", "toxic"] as const;
export type Element = (typeof ELEMENTS)[number];

export const STAT_KEYS = [
  "maxHp",
  "speed",
  "acc",
  "dodge",
  "crit",
  "critDmg",
  "prot",
  "dmgMin",
  "dmgMax",
  "dmgPct",
  "radiantPct",
  "voidPct",
  "firePct",
  "toxicPct",
  "dotPct",
  "healPct",
  "lifesteal",
  "resRadiant",
  "resVoid",
  "resFire",
  "resToxic",
  "resBleed",
  "resBurn",
  "resPoison",
  "resStun",
  "resDebuff",
  "lightRadius",
  "oreFind",
  "lootFind",
  "darkvision",
] as const;
export type StatKey = (typeof STAT_KEYS)[number];
export type Stats = Record<StatKey, number>;
export type StatMods = Partial<Stats>;

// ---------------------------------------------------------------------------
// Statuses
// ---------------------------------------------------------------------------

export const STATUS_IDS = [
  "bleed",
  "burn",
  "toxic",
  "stun",
  "mark",
  "guard",
  "shield",
  "blind",
  "corrode",
  "haste",
  "slow",
  "regen",
  "empower",
  "weaken",
  "taunt",
  "evasive",
  "lit",
] as const;
export type StatusId = (typeof STATUS_IDS)[number];

export interface StatusInstance {
  id: StatusId;
  /** Remaining turns of the bearer. */
  turns: number;
  /** Magnitude: dot damage, shield amount, stat delta, % etc. */
  value: number;
  /** For guard: the guardian. For dots: who applied it (for lifesteal/credit later). */
  sourceId?: UnitId;
}

// ---------------------------------------------------------------------------
// Skills
// ---------------------------------------------------------------------------

export type Side = "merc" | "enemy";
export type Rank = 1 | 2 | 3 | 4;

export type SkillEffect =
  /** Damage = weapon roll × mult. Rolled per target, per hit. */
  | {
      kind: "damage";
      mult: number;
      hits?: number;
      ignoreProt?: number;
      /** Extra % damage when the target is below 50% hp. */
      executePct?: number;
    }
  | { kind: "heal"; min: number; max: number; revive?: boolean; to?: "target" | "self" }
  | {
      kind: "status";
      status: StatusId;
      chance: number;
      turns: number;
      value: number;
      to?: "target" | "self";
    }
  /** Positive = toward the front (rank 1), negative = toward the back. */
  | { kind: "move"; amount: number; to: "self" | "target" }
  | { kind: "cleanse"; to?: "target" | "self" }
  /** Extends the squad's light radius for N rounds. */
  | { kind: "beacon"; amount: number; rounds: number }
  /** Changes expedition lamp charge (enemies drain it). */
  | { kind: "lampCharge"; amount: number }
  /** Reduce the user's other skill cooldowns. */
  | { kind: "cooldowns"; amount: number }
  /** User guards the target ally: single-target attacks on it hit the user instead. */
  | { kind: "guard"; turns: number };

export interface SkillTargeting {
  side: "enemy" | "ally" | "self";
  /** Ranks that may be targeted. */
  ranks: Rank[];
  /** Hit every valid unit in `ranks` instead of choosing one. */
  aoe?: boolean;
}

export interface SkillDef {
  id: string;
  name: string;
  owner: string; // discipline id, "common" or "enemy"
  element: Element;
  cooldown: number;
  /** Ranks the user must stand in. */
  from: Rank[];
  target: SkillTargeting;
  accMod?: number;
  critMod?: number;
  /** "attack" skills roll to hit; "support" skills always land. */
  kind: "attack" | "support";
  effects: SkillEffect[];
  /** Icon id override (defaults to `skill_<id>`). */
  icon?: string;
  flavor?: string;
}

/** Per-skill modifications granted by perks/relics. */
export interface SkillMod {
  dmgMult?: number;
  cooldown?: number;
  accMod?: number;
  critMod?: number;
  addEffects?: SkillEffect[];
}

// ---------------------------------------------------------------------------
// Builds: disciplines, origins, perks, items
// ---------------------------------------------------------------------------

export interface DisciplineDef {
  id: string;
  name: string;
  blurb: string;
  base: StatMods;
  growth: StatMods;
  skills: string[];
  defaultSkills: string[];
  preferredRanks: Rank[];
  weaponBase: string;
  startArmor: string;
}

export interface OriginDef {
  id: string;
  name: string;
  blurb: string;
  mods: StatMods;
  perk?: string;
}

export type PerkTrigger =
  | { on: "kill"; healPct?: number; empower?: number; lamp?: number }
  | { on: "crit"; status?: StatusId; turns?: number; value?: number }
  | { on: "turnStart"; healPct?: number; shield?: number }
  | { on: "hit"; status: StatusId; chance: number; turns: number; value: number };

export interface PerkDef {
  id: string;
  name: string;
  /** Discipline id, or "general". Relic/origin perks use "relic"/"origin". */
  pool: string;
  desc: string;
  mods?: StatMods;
  skillMods?: Record<string, SkillMod>;
  triggers?: PerkTrigger[];
  /** Conditional damage bonuses in %. */
  cond?: {
    vsUnlitPct?: number;
    vsLitPct?: number;
    vsBleedingPct?: number;
    vsMarkedPct?: number;
    lowHpPct?: number;
    frontRankDodge?: number;
  };
}

export type ItemSlot = "weapon" | "armor" | "lamp" | "trinket";
export type EquipSlot = "weapon" | "armor" | "lamp" | "trinket1" | "trinket2";
export const EQUIP_SLOTS: readonly EquipSlot[] = [
  "weapon",
  "armor",
  "lamp",
  "trinket1",
  "trinket2",
];
export type Rarity = "common" | "uncommon" | "rare" | "epic" | "relic";
export const RARITIES: readonly Rarity[] = ["common", "uncommon", "rare", "epic", "relic"];

export interface ItemBaseDef {
  id: string;
  name: string;
  slot: ItemSlot;
  /** Weapons are restricted to a discipline. */
  discipline?: string;
  /** Implicit stats at item level 1; scaled with ilvl by `scale` keys. */
  implicit: StatMods;
  scale?: Partial<Record<StatKey, number>>;
  icon: string;
}

export interface AffixDef {
  id: string;
  name: string;
  position: "prefix" | "suffix";
  stat: StatKey;
  /** Value range at ilvl 1 and per-ilvl growth. */
  min: number;
  max: number;
  perLevel: number;
  slots: ItemSlot[];
}

export interface Item {
  uid: number;
  baseId: string;
  slot: ItemSlot;
  rarity: Rarity;
  ilvl: number;
  name: string;
  implicit: StatMods;
  affixes: { id: string; stat: StatKey; value: number }[];
  perk?: string;
}

// ---------------------------------------------------------------------------
// Mercenaries
// ---------------------------------------------------------------------------

export interface Appearance {
  body: number;
  skin: number;
  hair: number;
  hairColor: number;
  primary: number;
  secondary: number;
  headgear: number;
  marking: number;
}

export interface MercSetup {
  name: string;
  discipline: string;
  origin: string;
  appearance: Appearance;
  skills: string[];
}

export interface Merc {
  id: UnitId;
  ownerId: PlayerId;
  name: string;
  discipline: string;
  origin: string;
  appearance: Appearance;
  level: number;
  xp: number;
  hp: number;
  perks: string[];
  /** Pending level-up perk offers (each entry is one choice of up to 3 perk ids). */
  perkOffers: string[][];
  skills: string[];
  equipment: Record<EquipSlot, Item | null>;
}

// ---------------------------------------------------------------------------
// Enemies
// ---------------------------------------------------------------------------

export interface EnemyDef {
  id: string;
  name: string;
  hp: number;
  speed: number;
  acc: number;
  dodge: number;
  prot: number;
  crit: number;
  dmg: [number, number];
  res?: StatMods;
  /** Grows stronger in darkness; weak to radiant damage. */
  umbral?: boolean;
  skills: SkillDef[];
  ai?: { weights?: Record<string, number>; focusWeak?: boolean };
  xp: number;
  elite?: boolean;
  boss?: boolean;
}

// ---------------------------------------------------------------------------
// Combat
// ---------------------------------------------------------------------------

export interface Unit {
  id: UnitId;
  side: Side;
  /** Merc id or enemy def id. */
  defId: string;
  name: string;
  ownerId: PlayerId | null;
  hp: number;
  stats: Stats;
  skills: string[];
  cooldowns: Record<string, number>;
  statuses: StatusInstance[];
  downed: boolean;
  /** Perk ids active for this unit (mercs; enemies may have innate ones). */
  perks: string[];
  /** Umbral creatures grow stronger in darkness. */
  umbral: boolean;
  /** XP awarded when this enemy dies. */
  xpValue: number;
  elite: boolean;
  boss: boolean;
  /** Enemy AI prefers the weakest target. */
  focusWeak: boolean;
}

export type CombatEvent =
  | { type: "round"; round: number }
  | { type: "turn"; unitId: UnitId }
  | { type: "skill"; unitId: UnitId; skillId: string; targetIds: UnitId[] }
  | {
      type: "hit";
      sourceId: UnitId;
      targetId: UnitId;
      amount: number;
      element: Element;
      crit: boolean;
      absorbed: number;
    }
  | { type: "miss"; sourceId: UnitId; targetId: UnitId }
  | { type: "heal"; targetId: UnitId; amount: number }
  | { type: "status"; targetId: UnitId; status: StatusId; turns: number; value: number }
  | { type: "resist"; targetId: UnitId; status: StatusId }
  | { type: "tick"; targetId: UnitId; status: StatusId; amount: number }
  | { type: "stunned"; unitId: UnitId }
  | { type: "move"; unitId: UnitId; from: number; to: number }
  | { type: "downed"; unitId: UnitId }
  | { type: "died"; unitId: UnitId }
  | { type: "revived"; unitId: UnitId }
  | { type: "light"; radius: number }
  | { type: "lamp"; amount: number; total: number }
  | { type: "guarded"; guardId: UnitId; targetId: UnitId }
  | { type: "end"; result: "victory" | "defeat" };

export interface CombatState {
  /** Index 0 = rank 1 (front). Downed mercs keep their place; dead enemies are removed. */
  mercs: Unit[];
  enemies: Unit[];
  round: number;
  /** Units still to act this round, in order. */
  queue: UnitId[];
  active: UnitId | null;
  /** Temporary light-radius bonuses from skills. */
  beacons: { amount: number; rounds: number }[];
  result: "victory" | "defeat" | null;
  kind: "combat" | "elite" | "boss";
  xp: number;
}

// ---------------------------------------------------------------------------
// Expedition / run
// ---------------------------------------------------------------------------

export type NodeType =
  | "start"
  | "combat"
  | "elite"
  | "boss"
  | "cache"
  | "vein"
  | "camp"
  | "derelict";
export type Biome = "ashenSurface" | "duskMines" | "crystalHollows";

export interface MapNode {
  id: string;
  row: number;
  col: number;
  /** 0..1 horizontal layout hint. */
  x: number;
  type: NodeType;
  biome: Biome;
  next: string[];
}

export interface RewardSummary {
  title: string;
  items: Item[];
  ore: number;
  xp: number;
  lamp: number;
  notes: string[];
}

export type RunPhase = "map" | "combat" | "reward" | "victory" | "defeat";

export interface RunPlayer {
  id: PlayerId;
  name: string;
}

export interface RunState {
  seed: string;
  /** SECRET — never sent to clients. */
  rng: Record<string, RngState>;
  version: number;
  nextUid: number;
  phase: RunPhase;
  players: RunPlayer[];
  /** Formation order outside combat (index 0 = rank 1). */
  mercs: Merc[];
  nodes: MapNode[];
  currentNodeId: string;
  visited: string[];
  votes: Record<PlayerId, string>;
  lampCharge: number;
  ore: number;
  stash: Item[];
  combat: CombatState | null;
  reward: RewardSummary | null;
  ready: PlayerId[];
  /** Ore spent at camps etc. is tracked for the summary. */
  stats: { kills: number; combats: number; itemsFound: number };
}

export type RunCommand =
  | { type: "vote"; nodeId: string }
  | { type: "useSkill"; unitId: UnitId; skillId: string; targetId?: UnitId }
  | { type: "continue" }
  | { type: "equip"; mercId: UnitId; itemUid: number; slot?: EquipSlot }
  | { type: "unequip"; mercId: UnitId; slot: EquipSlot }
  | { type: "setSkills"; mercId: UnitId; skills: string[] }
  | { type: "choosePerk"; mercId: UnitId; perkId: string }
  | { type: "swap"; mercA: UnitId; mercB: UnitId }
  | { type: "refuel" };

export type RunEvent =
  | CombatEvent
  | { type: "node"; nodeId: string; nodeType: NodeType }
  | { type: "levelUp"; mercId: UnitId; level: number }
  | { type: "loot"; itemUids: number[] }
  | { type: "vote"; playerId: PlayerId; nodeId: string };

export type CommandResult =
  | { ok: true; state: RunState; events: RunEvent[] }
  | { ok: false; error: string };
