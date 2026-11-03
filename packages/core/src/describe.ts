import { getAffix, getItemBase, getPerk } from "./content";
import { itemMods } from "./merc";
import type { Item, SkillDef, SkillEffect, SkillMod, StatKey, StatMods } from "./types";

export const STAT_LABELS: Record<StatKey, string> = {
  maxHp: "Max HP",
  speed: "Speed",
  acc: "Accuracy",
  dodge: "Dodge",
  crit: "Crit Chance",
  critDmg: "Crit Damage",
  prot: "Protection",
  dmgMin: "Min Damage",
  dmgMax: "Max Damage",
  dmgPct: "Damage",
  radiantPct: "Radiant Damage",
  voidPct: "Void Damage",
  firePct: "Fire Damage",
  toxicPct: "Toxic Damage",
  dotPct: "Damage over Time",
  healPct: "Healing",
  lifesteal: "Lifesteal",
  resRadiant: "Radiant Resist",
  resVoid: "Void Resist",
  resFire: "Fire Resist",
  resToxic: "Toxic Resist",
  resBleed: "Bleed Resist",
  resBurn: "Burn Resist",
  resPoison: "Poison Resist",
  resStun: "Stun Resist",
  resDebuff: "Debuff Resist",
  lightRadius: "Light Radius",
  oreFind: "Ore Find",
  lootFind: "Loot Rarity",
  darkvision: "Darkvision",
};

const PCT_STATS = new Set<StatKey>([
  "crit",
  "critDmg",
  "prot",
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
  "oreFind",
  "lootFind",
]);

export function formatStat(key: StatKey, value: number, signed = true): string {
  if (key === "darkvision") return "Sees in the dark";
  const sign = signed && value > 0 ? "+" : "";
  return `${sign}${value}${PCT_STATS.has(key) ? "%" : ""} ${STAT_LABELS[key]}`;
}

export function formatMods(mods: StatMods): string[] {
  const lines: string[] = [];
  const min = mods.dmgMin;
  const max = mods.dmgMax;
  if (min !== undefined && max !== undefined) lines.push(`${min}–${max} Damage`);
  for (const [k, v] of Object.entries(mods) as [StatKey, number][]) {
    if (k === "dmgMin" || k === "dmgMax" || v === 0) continue;
    lines.push(formatStat(k, v));
  }
  return lines;
}

const RANK_TEXT = (ranks: readonly number[]) =>
  ranks.length === 4 ? "any rank" : `rank ${ranks.join(", ")}`;

const STATUS_TEXT: Record<string, (v: number, t: number) => string> = {
  bleed: (v, t) => `Bleed ${v}/turn for ${t}`,
  burn: (v, t) => `Burn ${v}/turn for ${t}`,
  toxic: (v, t) => `Poison ${v}/turn for ${t}`,
  stun: () => "Stun",
  mark: (v, t) => `Mark (+${v}% dmg taken) ${t}t`,
  guard: (_v, t) => `Guard ${t}t`,
  shield: (v, t) => `Shield ${v} for ${t}t`,
  blind: (v, t) => `Blind (-${v} acc) ${t}t`,
  corrode: (v, t) => `Corrode (-${v}% prot) ${t}t`,
  haste: (v, t) => `Haste +${v} spd ${t}t`,
  slow: (v, t) => `Slow -${v} spd ${t}t`,
  regen: (v, t) => `Regen ${v}/turn for ${t}`,
  empower: (v, t) => `Empower +${v}% dmg ${t}t`,
  weaken: (v, t) => `Weaken -${v}% dmg ${t}t`,
  taunt: (_v, t) => `Taunt ${t}t`,
  evasive: (v, t) => `Evasive +${v} dodge ${t}t`,
  lit: (_v, t) => `Illuminate ${t}t`,
};

export function describeEffect(e: SkillEffect): string {
  switch (e.kind) {
    case "damage": {
      const hits = e.hits && e.hits > 1 ? ` ×${e.hits}` : "";
      const extra = [
        e.ignoreProt ? "ignores protection" : "",
        e.executePct ? `+${e.executePct}% vs targets under 50% HP` : "",
      ]
        .filter(Boolean)
        .join(", ");
      return `${Math.round(e.mult * 100)}% weapon damage${hits}${extra ? ` (${extra})` : ""}`;
    }
    case "heal":
      return `${e.to === "self" ? "Heal self" : "Heal"} ${e.min}–${e.max}${e.revive ? " (revives)" : ""}`;
    case "status": {
      const txt = STATUS_TEXT[e.status]?.(e.value, e.turns) ?? e.status;
      const chance = e.chance < 1 ? ` (${Math.round(e.chance * 100)}%)` : "";
      return `${e.to === "self" ? "Self: " : ""}${txt}${chance}`;
    }
    case "move":
      return `${e.to === "self" ? "Move" : "Push target"} ${e.amount > 0 ? "forward" : "back"} ${Math.abs(e.amount)}`;
    case "cleanse":
      return "Remove harmful effects";
    case "beacon":
      return `${e.amount > 0 ? "+" : ""}${e.amount} light radius for ${e.rounds} rounds`;
    case "lampCharge":
      return `${e.amount > 0 ? "Refuel" : "Drain"} lamp ${Math.abs(e.amount)}`;
    case "cooldowns":
      return `Other cooldowns -${e.amount}`;
    case "guard":
      return `Guard target for ${e.turns} turns`;
    default: {
      const never: never = e;
      return String(never);
    }
  }
}

export interface SkillText {
  name: string;
  usage: string;
  lines: string[];
  cooldown: number;
}

export function describeSkill(skill: SkillDef, mods: SkillMod[] = []): SkillText {
  const cd = Math.max(0, skill.cooldown + mods.reduce((s, m) => s + (m.cooldown ?? 0), 0));
  const dmgBonus = mods.reduce((s, m) => s + (m.dmgMult ?? 0), 0);
  const effects = [...skill.effects, ...mods.flatMap((m) => m.addEffects ?? [])];
  const lines = effects.map((e) =>
    e.kind === "damage" && dmgBonus
      ? describeEffect({ ...e, mult: e.mult + dmgBonus })
      : describeEffect(e),
  );
  if (skill.flavor) lines.push(skill.flavor);
  const targetSide =
    skill.target.side === "self" ? "self" : skill.target.side === "ally" ? "ally" : "enemy";
  const usage =
    skill.id === "move" || skill.id === "wait"
      ? ""
      : `From ${RANK_TEXT(skill.from)} → ${targetSide === "self" ? "self" : `${skill.target.aoe ? "all " : ""}${targetSide} ${RANK_TEXT(skill.target.ranks)}`}`;
  return { name: skill.name, usage, lines, cooldown: cd };
}

export interface ItemText {
  name: string;
  subtitle: string;
  lines: string[];
  perk?: { name: string; desc: string };
}

export function describeItem(item: Item): ItemText {
  const base = getItemBase(item.baseId);
  const slotName = item.slot[0]?.toUpperCase() + item.slot.slice(1);
  const lines = formatMods(item.implicit);
  for (const a of item.affixes)
    lines.push(`${formatStat(a.stat, a.value)}  (${getAffix(a.id).name})`);
  const perk = item.perk ? getPerk(item.perk) : undefined;
  return {
    name: item.name,
    subtitle: `${item.rarity[0]?.toUpperCase()}${item.rarity.slice(1)} ${slotName} · ${base.name} · iLvl ${item.ilvl}`,
    lines,
    ...(perk ? { perk: { name: perk.name, desc: perk.desc } } : {}),
  };
}

/** Diff two items' stats for tooltips ("+3 Crit Chance" vs equipped). */
export function compareItems(next: Item, current: Item | null): string[] {
  const a = itemMods(next);
  const b = current ? itemMods(current) : {};
  const keys = new Set([...Object.keys(a), ...Object.keys(b)] as StatKey[]);
  const out: string[] = [];
  for (const k of keys) {
    const d = (a[k] ?? 0) - (b[k] ?? 0);
    if (d !== 0) out.push(formatStat(k, d));
  }
  return out;
}
