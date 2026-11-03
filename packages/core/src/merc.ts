import { getAffix, getDiscipline, getItemBase, getOrigin, getPerk } from "./content";
import { AFFIXES, ITEM_BASES, RARITY_AFFIXES, RARITY_WEIGHTS, RELIC_NAMES } from "./content/items";
import { PERKS } from "./content/perks";
import { nextFloat, pick, type RngState, rangeInt, shuffle, weightedPick } from "./rng";
import {
  EQUIP_SLOTS,
  type EquipSlot,
  type Item,
  type ItemBaseDef,
  type ItemSlot,
  type Merc,
  type MercSetup,
  type PerkDef,
  type Rarity,
  STAT_KEYS,
  type StatMods,
  type Stats,
} from "./types";

export const MAX_LEVEL = 10;
/** Total XP required to reach level N (index = level). */
export const XP_TABLE = [0, 0, 60, 150, 270, 420, 600, 820, 1080, 1380, 1720];

export function emptyStats(): Stats {
  const s = {} as Stats;
  for (const k of STAT_KEYS) s[k] = 0;
  return s;
}

export function addMods(stats: Stats, mods: StatMods | undefined, factor = 1): void {
  if (!mods) return;
  for (const [k, v] of Object.entries(mods) as [keyof Stats, number][]) {
    stats[k] += v * factor;
  }
}

export function itemMods(item: Item): StatMods {
  const out: StatMods = { ...item.implicit };
  for (const affix of item.affixes) out[affix.stat] = (out[affix.stat] ?? 0) + affix.value;
  if (item.perk) {
    for (const [k, v] of Object.entries(getPerk(item.perk).mods ?? {}) as [keyof Stats, number][]) {
      out[k] = (out[k] ?? 0) + v;
    }
  }
  return out;
}

/** All perk ids affecting a merc: chosen perks, origin perk, and relic item perks. */
export function mercPerkIds(merc: Merc): string[] {
  const ids = [...merc.perks];
  const origin = getOrigin(merc.origin);
  if (origin.perk) ids.push(origin.perk);
  for (const slot of EQUIP_SLOTS) {
    const perk = merc.equipment[slot]?.perk;
    if (perk) ids.push(perk);
  }
  return ids;
}

/** Final stats for a merc. Pure: derived entirely from discipline, origin, level, perks, gear. */
export function computeStats(merc: Merc): Stats {
  const stats = emptyStats();
  stats.critDmg = 50;
  const disc = getDiscipline(merc.discipline);
  addMods(stats, disc.base);
  addMods(stats, disc.growth, merc.level - 1);
  addMods(stats, getOrigin(merc.origin).mods);
  for (const id of merc.perks) addMods(stats, getPerk(id).mods);
  for (const slot of EQUIP_SLOTS) {
    const item = merc.equipment[slot];
    if (item) addMods(stats, itemMods(item));
  }
  for (const k of STAT_KEYS) stats[k] = Math.round(stats[k]);
  stats.maxHp = Math.max(1, stats.maxHp);
  stats.dmgMax = Math.max(stats.dmgMin, stats.dmgMax);
  stats.prot = Math.min(75, stats.prot);
  return stats;
}

export function emptyEquipment(): Record<EquipSlot, Item | null> {
  return { weapon: null, armor: null, lamp: null, trinket1: null, trinket2: null };
}

/** Which equip slots an item can go into. */
export function slotsFor(slot: ItemSlot): EquipSlot[] {
  return slot === "trinket" ? ["trinket1", "trinket2"] : [slot];
}

export function canEquip(merc: Merc, item: Item): string | null {
  const base = getItemBase(item.baseId);
  if (base.discipline && base.discipline !== merc.discipline) {
    return `Only a ${getDiscipline(base.discipline).name} can use this.`;
  }
  return null;
}

export interface UidSource {
  next(): number;
}

export function createMerc(
  setup: MercSetup,
  id: string,
  ownerId: string,
  uids: UidSource,
  withLamp: boolean,
): Merc {
  const disc = getDiscipline(setup.discipline);
  const merc: Merc = {
    id,
    ownerId,
    name: setup.name,
    discipline: disc.id,
    origin: getOrigin(setup.origin).id,
    appearance: { ...setup.appearance },
    level: 1,
    xp: 0,
    hp: 1,
    perks: [],
    perkOffers: [],
    skills: validSkillLoadout(disc.id, setup.skills),
    equipment: emptyEquipment(),
  };
  merc.equipment.weapon = makeItem(uids.next(), disc.weaponBase, "common", 1, []);
  merc.equipment.armor = makeItem(uids.next(), disc.startArmor, "common", 1, []);
  if (withLamp) merc.equipment.lamp = makeItem(uids.next(), "oilLantern", "common", 1, []);
  merc.hp = computeStats(merc).maxHp;
  return merc;
}

/** Up to 4 unique skills from the discipline's list; falls back to defaults. */
export function validSkillLoadout(disciplineId: string, skills: readonly string[]): string[] {
  const disc = getDiscipline(disciplineId);
  const chosen = [...new Set(skills)].filter((s) => disc.skills.includes(s)).slice(0, 4);
  for (const s of disc.defaultSkills) {
    if (chosen.length >= 4) break;
    if (!chosen.includes(s)) chosen.push(s);
  }
  return chosen;
}

// ---------------------------------------------------------------------------
// Leveling
// ---------------------------------------------------------------------------

/** Adds XP; returns the levels gained. Perk offers are queued with `r`. */
export function grantXp(merc: Merc, xp: number, r: RngState): number[] {
  const gained: number[] = [];
  if (merc.level >= MAX_LEVEL) return gained;
  merc.xp += xp;
  while (merc.level < MAX_LEVEL && merc.xp >= (XP_TABLE[merc.level + 1] ?? Infinity)) {
    const before = computeStats(merc).maxHp;
    merc.level++;
    const after = computeStats(merc).maxHp;
    merc.hp = Math.min(after, merc.hp + (after - before) + Math.round(after * 0.15));
    merc.perkOffers.push(rollPerkOffer(merc, r));
    gained.push(merc.level);
  }
  return gained;
}

export function rollPerkOffer(merc: Merc, r: RngState): string[] {
  const owned = new Set(mercPerkIds(merc));
  const queued = new Set(merc.perkOffers.flat());
  const pool = (Object.values(PERKS) as PerkDef[]).filter(
    (p) =>
      (p.pool === "general" || p.pool === merc.discipline) &&
      !owned.has(p.id) &&
      !queued.has(p.id) &&
      // Only offer skill perks for skills the discipline actually has.
      (!p.skillMods ||
        Object.keys(p.skillMods).every((s) => getDiscipline(merc.discipline).skills.includes(s))),
  );
  const discipline = pool.filter((p) => p.pool === merc.discipline);
  const general = pool.filter((p) => p.pool === "general");
  shuffle(r, discipline);
  shuffle(r, general);
  // Usually 1-2 discipline perks + general ones.
  const nDisc = Math.min(discipline.length, nextFloat(r) < 0.5 ? 1 : 2);
  const offer = [...discipline.slice(0, nDisc), ...general].slice(0, 3);
  return offer.map((p) => p.id);
}

// ---------------------------------------------------------------------------
// Loot
// ---------------------------------------------------------------------------

export function makeItem(
  uid: number,
  baseId: string,
  rarity: Rarity,
  ilvl: number,
  affixes: Item["affixes"],
  perk?: string,
): Item {
  const base = getItemBase(baseId);
  const implicit: StatMods = {};
  for (const [k, v] of Object.entries(base.implicit) as [keyof Stats, number][]) {
    const growth = base.scale?.[k] ?? 0;
    implicit[k] = Math.round(v + growth * (ilvl - 1));
  }
  const prefix = affixes.find((a) => getAffix(a.id).position === "prefix");
  const suffix = affixes.find((a) => getAffix(a.id).position === "suffix");
  const name =
    rarity === "relic" && perk
      ? (RELIC_NAMES[perk] ?? base.name)
      : [prefix ? getAffix(prefix.id).name : "", base.name, suffix ? getAffix(suffix.id).name : ""]
          .filter(Boolean)
          .join(" ");
  return {
    uid,
    baseId,
    slot: base.slot,
    rarity,
    ilvl,
    name,
    implicit,
    affixes,
    ...(perk ? { perk } : {}),
  };
}

export interface LootOptions {
  ilvl: number;
  /** Extra % rarity (loot find + darkness). */
  rarityBonus: number;
  slot?: ItemSlot;
  /** Bias weapon drops toward these disciplines. */
  disciplines?: string[];
  minRarity?: Rarity;
}

const RARITY_ORDER: Rarity[] = ["common", "uncommon", "rare", "epic", "relic"];

export function rollRarity(r: RngState, bonus: number, min: Rarity = "common"): Rarity {
  const mult = 1 + bonus / 100;
  const minIdx = RARITY_ORDER.indexOf(min);
  const weights = RARITY_ORDER.map(
    (rar, i) =>
      [rar, i < minIdx ? 0 : RARITY_WEIGHTS[rar] * (i >= 2 ? mult : 1)] as [Rarity, number],
  );
  return weightedPick(r, weights);
}

export function rollItem(r: RngState, uid: number, opts: LootOptions): Item {
  const rarity = rollRarity(r, opts.rarityBonus, opts.minRarity);
  const slot: ItemSlot =
    opts.slot ??
    weightedPick(r, [
      ["weapon", 30],
      ["armor", 25],
      ["lamp", 12],
      ["trinket", 33],
    ] as [ItemSlot, number][]);
  let bases = (Object.values(ITEM_BASES) as ItemBaseDef[]).filter((b) => b.slot === slot);
  if (slot === "weapon" && opts.disciplines?.length && nextFloat(r) < 0.75) {
    const preferred = bases.filter((b) => opts.disciplines?.includes(b.discipline ?? ""));
    if (preferred.length) bases = preferred;
  }
  const base = pick(r, bases);
  const [minA, maxA] = RARITY_AFFIXES[rarity];
  const count = rangeInt(r, minA, maxA);
  const candidates = Object.values(AFFIXES).filter((a) =>
    (a.slots as readonly string[]).includes(slot),
  );
  shuffle(r, candidates);
  const affixes: Item["affixes"] = [];
  const usedStats = new Set<string>();
  let prefixes = 0;
  let suffixes = 0;
  for (const affix of candidates) {
    if (affixes.length >= count) break;
    if (usedStats.has(affix.stat)) continue;
    if (affix.position === "prefix" && prefixes >= 2) continue;
    if (affix.position === "suffix" && suffixes >= 2) continue;
    const lo = affix.min + affix.perLevel * (opts.ilvl - 1);
    const hi = affix.max + affix.perLevel * (opts.ilvl - 1);
    const value = Math.max(1, Math.round(lo + nextFloat(r) * (hi - lo)));
    affixes.push({ id: affix.id, stat: affix.stat, value });
    usedStats.add(affix.stat);
    if (affix.position === "prefix") prefixes++;
    else suffixes++;
  }
  const perk =
    rarity === "relic"
      ? pick(
          r,
          (Object.values(PERKS) as PerkDef[]).filter((p) => p.pool === "relic"),
        ).id
      : undefined;
  return makeItem(uid, base.id, rarity, opts.ilvl, affixes, perk);
}

/** Rough power score for comparing items in UI and bots. */
export function itemScore(item: Item): number {
  const mods = itemMods(item);
  let score = RARITY_ORDER.indexOf(item.rarity) * 6 + item.ilvl * 2;
  score += ((mods.dmgMin ?? 0) + (mods.dmgMax ?? 0)) * 1.5;
  score += (mods.prot ?? 0) * 0.8 + (mods.maxHp ?? 0) * 0.5 + (mods.lightRadius ?? 0) * 6;
  for (const k of ["crit", "acc", "dodge", "speed"] as const) score += (mods[k] ?? 0) * 0.7;
  return score;
}
