/**
 * Presentation helpers for the character sheet: tooltip content for items, skills, perks,
 * disciplines and origins, plus the grouped stat table. Everything here only *describes*
 * core data (via @radiance/core's describe helpers); no game rules live here.
 */
import {
  canEquip,
  computeStats,
  describeItem,
  describeSkill,
  type EquipSlot,
  formatMods,
  formatStat,
  getDiscipline,
  getItemBase,
  getOrigin,
  getPerk,
  getSkill,
  type Item,
  itemMods,
  itemScore,
  type Merc,
  mercPerkIds,
  type PerkDef,
  type SkillMod,
  type StatKey,
  type Stats,
  slotsFor,
} from "@radiance/core";
import { ELEMENT_COLORS, RAMPS, RARITY_COLORS } from "../../art/palette";
import type { TooltipContent, TooltipLine } from "../../ui/Tooltip";
import { COLORS } from "../../ui/theme";

export const SLOT_LABELS: Record<EquipSlot, string> = {
  weapon: "Weapon",
  armor: "Armor",
  lamp: "Lamp",
  trinket1: "Trinket I",
  trinket2: "Trinket II",
};

/** Faint silhouette icon for empty equipment slots. */
export const SLOT_PLACEHOLDER_ICON: Record<EquipSlot, string> = {
  weapon: "item_weapon_vanguard",
  armor: "item_armor_medium",
  lamp: "item_lamp_oil",
  trinket1: "item_trinket_ring",
  trinket2: "item_trinket_charm",
};

export const GAIN = COLORS.success;
export const LOSS = COLORS.danger;
export const PERK_GOLD = RARITY_COLORS.relic;

export function cap(s: string): string {
  return s.length ? `${s[0]?.toUpperCase()}${s.slice(1)}` : s;
}

/** Item icon id (from its base), with a safe fallback. */
export function itemIcon(item: Item): string {
  try {
    return getItemBase(item.baseId).icon;
  } catch {
    return `item_${item.slot}`;
  }
}

/** Where clicking "equip" would put an item: first empty compatible slot, else the first. */
export function targetSlot(merc: Merc, item: Item): EquipSlot {
  const slots = slotsFor(item.slot);
  return slots.find((s) => merc.equipment[s] === null) ?? (slots[0] as EquipSlot);
}

/** Stats the merc would have with `item` in `slot` (pure preview via core's computeStats). */
export function previewStats(merc: Merc, item: Item, slot: EquipSlot): Stats {
  const clone: Merc = { ...merc, equipment: { ...merc.equipment, [slot]: item } };
  return computeStats(clone);
}

/** Stats the merc would have with `slot` emptied. */
export function previewUnequip(merc: Merc, slot: EquipSlot): Stats {
  const clone: Merc = { ...merc, equipment: { ...merc.equipment, [slot]: null } };
  return computeStats(clone);
}

/** True when `item` looks like an upgrade over what `merc` has in its target slot. */
export function isUpgrade(merc: Merc, item: Item): boolean {
  if (canEquip(merc, item)) return false;
  const slots = slotsFor(item.slot);
  if (slots.some((s) => merc.equipment[s] === null)) return item.slot !== "weapon";
  const worst = Math.min(
    ...slots.map((s) => {
      const cur = merc.equipment[s];
      return cur ? itemScore(cur) : 0;
    }),
  );
  return itemScore(item) > worst + 0.5;
}

/** Signed stat diff lines between two items (green gains, red losses). */
export function diffLines(next: Item | null, current: Item | null): TooltipLine[] {
  const a = next ? itemMods(next) : {};
  const b = current ? itemMods(current) : {};
  const keys = [...new Set([...Object.keys(a), ...Object.keys(b)] as StatKey[])];
  const out: TooltipLine[] = [];
  for (const k of keys) {
    const d = (a[k] ?? 0) - (b[k] ?? 0);
    if (d === 0) continue;
    const text =
      k === "darkvision" ? (d > 0 ? "Gains darkvision" : "Loses darkvision") : formatStat(k, d);
    out.push({ text, color: d > 0 ? GAIN : LOSS, size: "small" });
  }
  return out;
}

export interface ItemTipOptions {
  merc: Merc | null;
  /** The item is equipped in this slot (no comparison). */
  equippedIn?: EquipSlot;
  footer?: string;
}

export function itemTooltip(item: Item, opts: ItemTipOptions): TooltipContent {
  const d = describeItem(item);
  const lines: TooltipLine[] = d.lines.map((text) => ({ text }));
  if (d.perk) {
    lines.push({ text: `${d.perk.name}`, color: PERK_GOLD, icon: "ui_perk" });
    lines.push({ text: d.perk.desc, color: RAMPS.lamp[4], size: "small" });
  }
  const merc = opts.merc;
  if (merc && !opts.equippedIn) {
    const blocker = canEquip(merc, item);
    if (blocker) {
      lines.push({ text: blocker, color: LOSS, icon: "ui_lock", size: "small" });
    } else {
      const slots = slotsFor(item.slot);
      const slot = targetSlot(merc, item);
      const current = merc.equipment[slot];
      lines.push({
        text: current
          ? `vs equipped ${SLOT_LABELS[slot]}: ${current.name}`
          : `Fills empty ${SLOT_LABELS[slot]}`,
        color: COLORS.textMuted,
        size: "small",
      });
      const diff = diffLines(item, current);
      lines.push(...(diff.length ? diff : [{ text: "No stat change", size: "small" as const }]));
      if (slots.length > 1 && slots.every((s) => merc.equipment[s] !== null)) {
        const other = slots.find((s) => s !== slot);
        const otherItem = other ? merc.equipment[other] : null;
        if (other && otherItem) {
          lines.push({
            text: `vs ${SLOT_LABELS[other]}: ${otherItem.name}`,
            color: COLORS.textMuted,
            size: "small",
          });
          lines.push(...diffLines(item, otherItem));
        }
      }
    }
  }
  return {
    title: d.name,
    titleColor: RARITY_COLORS[item.rarity],
    subtitle: d.subtitle,
    lines,
    width: 360,
    ...(opts.footer ? { footer: opts.footer } : {}),
  };
}

/** Skill mods granted to a merc's skill by its perks (chosen, origin and relic perks). */
export function skillModsOf(merc: Merc, skillId: string): { mods: SkillMod[]; perks: PerkDef[] } {
  const perks: PerkDef[] = [];
  const mods: SkillMod[] = [];
  for (const id of mercPerkIds(merc)) {
    const perk = safePerk(id);
    const m = perk?.skillMods?.[skillId];
    if (perk && m) {
      perks.push(perk);
      mods.push(m);
    }
  }
  return { mods, perks };
}

export function skillTooltip(merc: Merc, skillId: string, footer?: string): TooltipContent {
  const skill = getSkill(skillId);
  const { mods, perks } = skillModsOf(merc, skillId);
  const t = describeSkill(skill, mods);
  const lines: TooltipLine[] = [];
  const flavor = skill.flavor;
  for (const l of t.lines) {
    if (flavor && l === flavor) continue;
    lines.push({ text: l });
  }
  const meta: string[] = [];
  meta.push(skill.kind === "attack" ? "Attack" : "Support");
  if (skill.element !== "physical") meta.push(cap(skill.element));
  meta.push(t.cooldown > 0 ? `Cooldown ${t.cooldown}` : "No cooldown");
  if (skill.accMod) meta.push(`${skill.accMod > 0 ? "+" : ""}${skill.accMod} acc`);
  if (skill.critMod) meta.push(`${skill.critMod > 0 ? "+" : ""}${skill.critMod}% crit`);
  lines.push({
    text: meta.join(" · "),
    color: skill.element === "physical" ? COLORS.textMuted : ELEMENT_COLORS[skill.element],
    size: "small",
  });
  for (const p of perks)
    lines.push({ text: `Enhanced by ${p.name}`, color: PERK_GOLD, size: "small" });
  if (flavor) lines.push({ text: flavor, color: COLORS.textMuted, size: "small" });
  return {
    title: t.name,
    subtitle: t.usage || undefined,
    lines,
    width: 360,
    ...(footer ? { footer } : {}),
  };
}

export function safePerk(id: string): PerkDef | null {
  try {
    return getPerk(id);
  } catch {
    return null;
  }
}

export type PerkSource = "chosen" | "origin" | "relic";

export function perkPoolLabel(perk: PerkDef): string {
  if (perk.pool === "general") return "General";
  if (perk.pool === "relic") return "Relic";
  if (perk.pool === "origin") return "Origin";
  try {
    return getDiscipline(perk.pool).name;
  } catch {
    return cap(perk.pool);
  }
}

export function perkColor(perk: PerkDef, source: PerkSource = "chosen"): string {
  if (source === "relic" || perk.pool === "relic") return RARITY_COLORS.relic;
  if (source === "origin" || perk.pool === "origin") return RAMPS.crystal[4];
  if (perk.pool === "general") return RAMPS.steel[5];
  return RAMPS.lamp[4];
}

export function perkTooltip(perk: PerkDef, source: PerkSource = "chosen"): TooltipContent {
  const lines: TooltipLine[] = [{ text: perk.desc }];
  if (perk.mods) {
    for (const l of formatMods(perk.mods)) lines.push({ text: l, color: GAIN, size: "small" });
  }
  if (perk.skillMods) {
    const names = Object.keys(perk.skillMods)
      .map((s) => {
        try {
          return getSkill(s).name;
        } catch {
          return s;
        }
      })
      .join(", ");
    lines.push({ text: `Modifies: ${names}`, color: PERK_GOLD, size: "small" });
  }
  const src =
    source === "relic"
      ? "From a relic item"
      : source === "origin"
        ? "From origin"
        : "Level-up perk";
  return {
    title: perk.name,
    titleColor: perkColor(perk, source),
    subtitle: `${perkPoolLabel(perk)} perk · ${src}`,
    lines,
    width: 340,
  };
}

/** Perks with where they come from, in display order. */
export function mercPerks(merc: Merc): { perk: PerkDef; source: PerkSource }[] {
  const out: { perk: PerkDef; source: PerkSource }[] = [];
  for (const id of merc.perks) {
    const p = safePerk(id);
    if (p) out.push({ perk: p, source: "chosen" });
  }
  const origin = safeOrigin(merc.origin);
  if (origin?.perk) {
    const p = safePerk(origin.perk);
    if (p) out.push({ perk: p, source: "origin" });
  }
  for (const item of Object.values(merc.equipment)) {
    if (item?.perk) {
      const p = safePerk(item.perk);
      if (p) out.push({ perk: p, source: "relic" });
    }
  }
  return out;
}

function safeOrigin(id: string) {
  try {
    return getOrigin(id);
  } catch {
    return null;
  }
}

export function disciplineTooltip(id: string): TooltipContent {
  const d = getDiscipline(id);
  const lines: TooltipLine[] = [{ text: d.blurb }];
  lines.push({
    text: `Prefers rank ${d.preferredRanks.join(", ")}`,
    color: COLORS.textMuted,
    size: "small",
  });
  const growth = formatMods(d.growth);
  if (growth.length) {
    lines.push({ text: "Per level:", color: COLORS.accent, size: "small" });
    for (const g of growth) lines.push({ text: g, color: GAIN, size: "small" });
  }
  return { title: d.name, subtitle: "Discipline", lines, width: 340 };
}

export function originTooltip(id: string): TooltipContent {
  const o = getOrigin(id);
  const lines: TooltipLine[] = [{ text: o.blurb }];
  for (const [k, v] of Object.entries(o.mods) as [StatKey, number][]) {
    if (v === 0) continue;
    lines.push({
      text: k === "darkvision" ? "Sees in the dark" : formatStat(k, v),
      color: v > 0 ? GAIN : LOSS,
      size: "small",
    });
  }
  if (o.perk) {
    const p = safePerk(o.perk);
    if (p) lines.push({ text: `${p.name}: ${p.desc}`, color: PERK_GOLD, size: "small" });
  }
  return { title: o.name, titleColor: RAMPS.crystal[4], subtitle: "Origin", lines, width: 340 };
}

// ---------------------------------------------------------------------------------------
// Stat table

export interface StatRow {
  key: StatKey | "dmg";
  label: string;
  icon: string;
  /** Always shown, even at zero. */
  core?: boolean;
  pct?: boolean;
  color?: string;
}

export interface StatGroup {
  title: string;
  rows: StatRow[];
}

export const STAT_GROUPS: StatGroup[] = [
  {
    title: "Offense",
    rows: [
      { key: "dmg", label: "Damage", icon: "stat_dmg", core: true },
      { key: "dmgPct", label: "Dmg Bonus", icon: "stat_dmg", pct: true },
      { key: "crit", label: "Crit", icon: "stat_crit", core: true, pct: true },
      { key: "critDmg", label: "Crit Dmg", icon: "stat_crit", core: true, pct: true },
      { key: "acc", label: "Accuracy", icon: "stat_acc", core: true },
      {
        key: "radiantPct",
        label: "Radiant",
        icon: "elem_radiant",
        pct: true,
        color: ELEMENT_COLORS.radiant,
      },
      { key: "voidPct", label: "Void", icon: "elem_void", pct: true, color: ELEMENT_COLORS.void },
      { key: "firePct", label: "Fire", icon: "elem_fire", pct: true, color: ELEMENT_COLORS.fire },
      {
        key: "toxicPct",
        label: "Toxic",
        icon: "elem_toxic",
        pct: true,
        color: ELEMENT_COLORS.toxic,
      },
      { key: "dotPct", label: "DoT Dmg", icon: "status_bleed", pct: true },
      { key: "healPct", label: "Healing", icon: "status_regen", pct: true },
      { key: "lifesteal", label: "Lifesteal", icon: "skill_siphon", pct: true },
    ],
  },
  {
    title: "Defense",
    rows: [
      { key: "maxHp", label: "Max HP", icon: "stat_hp", core: true },
      { key: "prot", label: "Prot", icon: "stat_prot", core: true, pct: true },
      { key: "dodge", label: "Dodge", icon: "stat_dodge", core: true },
      { key: "resRadiant", label: "Radiant Res", icon: "elem_radiant", pct: true },
      { key: "resVoid", label: "Void Res", icon: "elem_void", pct: true },
      { key: "resFire", label: "Fire Res", icon: "elem_fire", pct: true },
      { key: "resToxic", label: "Toxic Res", icon: "elem_toxic", pct: true },
      { key: "resBleed", label: "Bleed Res", icon: "status_bleed", pct: true },
      { key: "resBurn", label: "Burn Res", icon: "status_burn", pct: true },
      { key: "resPoison", label: "Poison Res", icon: "status_toxic", pct: true },
      { key: "resStun", label: "Stun Res", icon: "status_stun", pct: true },
      { key: "resDebuff", label: "Debuff Res", icon: "status_weaken", pct: true },
    ],
  },
  {
    title: "Utility",
    rows: [
      { key: "speed", label: "Speed", icon: "stat_speed", core: true },
      { key: "lightRadius", label: "Light", icon: "ui_lamp", core: true },
      { key: "oreFind", label: "Ore Find", icon: "ui_ore", pct: true },
      { key: "lootFind", label: "Loot Rarity", icon: "node_cache", pct: true },
      { key: "darkvision", label: "Darkvision", icon: "status_lit" },
    ],
  },
];

/** Long-form description for a stat row (tooltip). */
export const STAT_HELP: Partial<Record<StatRow["key"], string>> = {
  dmg: "Weapon damage range. Skills deal a multiple of a roll in this range.",
  dmgPct: "Bonus to all damage dealt.",
  crit: "Chance for an attack to critically hit.",
  critDmg: "Extra damage dealt by critical hits.",
  acc: "Chance to hit. Compared against the target's dodge.",
  maxHp: "Health. A merc at 0 HP is downed.",
  prot: "Reduces incoming damage by this percentage (max 75%).",
  dodge: "Lowers the chance enemies hit you.",
  speed: "Higher speed acts earlier each round.",
  lightRadius: "How far this merc's lamp pushes back the dark. The squad uses its brightest lamp.",
  oreFind: "More ore from veins, caches and fights.",
  lootFind: "Better odds of rare loot.",
  darkvision: "Can see and strike unlit enemies without penalty.",
  dotPct: "Bonus to bleed, burn and poison damage.",
  healPct: "Bonus to healing done.",
  lifesteal: "Heals for a share of damage dealt.",
};

export function rowValue(stats: Stats, key: StatRow["key"]): number {
  if (key === "dmg") return stats.dmgMin + stats.dmgMax;
  return stats[key];
}

export function rowText(stats: Stats, row: StatRow): string {
  if (row.key === "dmg") return `${stats.dmgMin}–${stats.dmgMax}`;
  if (row.key === "darkvision") return stats.darkvision > 0 ? "Yes" : "No";
  const v = stats[row.key];
  return `${v}${row.pct ? "%" : ""}`;
}

export function rowDelta(before: Stats, after: Stats, row: StatRow): string {
  if (row.key === "dmg") {
    const a = after.dmgMin - before.dmgMin;
    const b = after.dmgMax - before.dmgMax;
    if (a === 0 && b === 0) return "";
    const s = (n: number) => `${n > 0 ? "+" : ""}${n}`;
    return a === b ? s(a) : `${s(a)}/${s(b)}`;
  }
  const d = after[row.key] - before[row.key];
  if (d === 0) return "";
  if (row.key === "darkvision") return d > 0 ? "+" : "-";
  return `${d > 0 ? "+" : ""}${d}${row.pct ? "%" : ""}`;
}
