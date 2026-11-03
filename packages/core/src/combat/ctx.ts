import { type RngState, seedRng } from "../rng";
import type { CombatState, RunEvent, RunState, StatusId, StatusInstance, Unit } from "../types";

/** Mutable working context while resolving one command against a cloned run. */
export interface Ctx {
  run: RunState;
  combat: CombatState;
  events: RunEvent[];
}

/**
 * Named RNG streams stored on the run state. Streams in use:
 * `map`, `loot`, `combat`, `ai`, `perks:<mercId>`, `vote`, `nodes`.
 */
export function stream(run: RunState, name: string): RngState {
  let r = run.rng[name];
  if (!r) {
    r = seedRng(`${run.seed}::${name}`);
    run.rng[name] = r;
  }
  return r;
}

export const MAX_RANKS = 4;

export function sideOf(combat: CombatState, unit: Unit): Unit[] {
  return unit.side === "merc" ? combat.mercs : combat.enemies;
}

export function opponentsOf(combat: CombatState, unit: Unit): Unit[] {
  return unit.side === "merc" ? combat.enemies : combat.mercs;
}

export function rankOf(combat: CombatState, unit: Unit): number {
  return sideOf(combat, unit).indexOf(unit) + 1;
}

export function findUnit(combat: CombatState, id: string): Unit | undefined {
  return combat.mercs.find((u) => u.id === id) ?? combat.enemies.find((u) => u.id === id);
}

export function canAct(u: Unit): boolean {
  // Enemies are removed on death, so presence means alive (views may mask enemy HP as -1).
  return !u.downed && u.hp !== 0;
}

export function statusValue(u: Unit, id: StatusId): number {
  return u.statuses.filter((s) => s.id === id).reduce((sum, s) => sum + s.value, 0);
}

export function hasStatus(u: Unit, id: StatusId): boolean {
  return u.statuses.some((s) => s.id === id);
}

export const DEBUFFS: ReadonlySet<StatusId> = new Set<StatusId>([
  "bleed",
  "burn",
  "toxic",
  "stun",
  "mark",
  "blind",
  "corrode",
  "slow",
  "weaken",
]);

export const DOTS: ReadonlySet<StatusId> = new Set<StatusId>(["bleed", "burn", "toxic"]);

/** Statuses that refresh instead of stacking. */
const NON_STACKING: ReadonlySet<StatusId> = new Set<StatusId>([
  "stun",
  "mark",
  "guard",
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
]);

export function addStatus(u: Unit, s: StatusInstance): void {
  if (NON_STACKING.has(s.id)) {
    const existing = u.statuses.find((x) => x.id === s.id);
    if (existing) {
      existing.turns = Math.max(existing.turns, s.turns);
      existing.value = Math.max(existing.value, s.value);
      if (s.sourceId) existing.sourceId = s.sourceId;
      return;
    }
  }
  u.statuses.push({ ...s });
}
