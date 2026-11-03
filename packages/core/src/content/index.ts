import type { CardDef, ClassDef, EncounterDef, EnemyDef } from "../types";
import { CARDS } from "./cards";
import { CLASSES } from "./classes";
import { ENCOUNTERS, ENEMIES } from "./enemies";

export { CARDS, type CardId } from "./cards";
export { CLASS_IDS, CLASSES, type ClassId } from "./classes";
export { ENCOUNTERS, ENEMIES, type EncounterId, type EnemyDefId } from "./enemies";

function lookup<T>(table: Record<string, T>, kind: string, id: string): T {
  const def = table[id];
  if (!def) throw new Error(`Unknown ${kind} id: "${id}"`);
  return def;
}

export const getCard = (id: string): CardDef => lookup<CardDef>(CARDS, "card", id);
export const getEnemy = (id: string): EnemyDef => lookup<EnemyDef>(ENEMIES, "enemy", id);
export const getClass = (id: string): ClassDef => lookup<ClassDef>(CLASSES, "class", id);
export const getEncounter = (id: string): EncounterDef =>
  lookup<EncounterDef>(ENCOUNTERS, "encounter", id);
