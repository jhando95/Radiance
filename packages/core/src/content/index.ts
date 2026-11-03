import type { DisciplineDef, EnemyDef, ItemBaseDef, OriginDef, PerkDef, SkillDef } from "../types";
import { DISCIPLINES, ORIGINS } from "./disciplines";
import { ENEMIES } from "./enemies";
import { AFFIXES, ITEM_BASES } from "./items";
import { PERKS } from "./perks";
import { SKILLS } from "./skills";

export * from "./disciplines";
export * from "./enemies";
export * from "./items";
export * from "./perks";
export * from "./skills";

function lookup<T>(table: Record<string, T>, kind: string, id: string): T {
  const def = table[id];
  if (!def) throw new Error(`Unknown ${kind} id: "${id}"`);
  return def;
}

/** All skills, including enemy skills (indexed by id). */
const ALL_SKILLS: Record<string, SkillDef> = { ...SKILLS };
for (const enemy of Object.values(ENEMIES) as EnemyDef[]) {
  for (const skill of enemy.skills) ALL_SKILLS[skill.id] = skill;
}

export const getSkill = (id: string): SkillDef => lookup(ALL_SKILLS, "skill", id);
export const getDiscipline = (id: string): DisciplineDef =>
  lookup<DisciplineDef>(DISCIPLINES, "discipline", id);
export const getOrigin = (id: string): OriginDef => lookup<OriginDef>(ORIGINS, "origin", id);
export const getPerk = (id: string): PerkDef => lookup<PerkDef>(PERKS, "perk", id);
export const getEnemy = (id: string): EnemyDef => lookup<EnemyDef>(ENEMIES, "enemy", id);
export const getItemBase = (id: string): ItemBaseDef =>
  lookup<ItemBaseDef>(ITEM_BASES, "item base", id);
export const getAffix = (id: string) => lookup(AFFIXES, "affix", id);
export const skillIcon = (skill: SkillDef): string => skill.icon ?? `skill_${skill.id}`;
