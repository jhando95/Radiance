import { type RngState, seedRng } from "../rng";
import type {
  CombatEvent,
  CombatState,
  EnemyState,
  EntityId,
  PlayerState,
  Statuses,
  StatusId,
} from "../types";

export const HAND_SIZE = 5;
export const MAX_HAND_SIZE = 10;
export const MAX_RADIANCE = 10;
/** Enemy max HP multiplier per extra player: hp * (1 + scale * (players - 1)). Tunable. */
export const ENEMY_HP_SCALE_PER_EXTRA_PLAYER = 0.7;

/** Mutable working context for resolving a single command against a cloned state. */
export interface Ctx {
  state: CombatState;
  events: CombatEvent[];
}

/**
 * Get (lazily creating) a named RNG stream. Stream names in use:
 *  - `enemies:setup`        enemy HP rolls
 *  - `enemies:ai`           intent selection / targeting
 *  - `deck:<playerId>`      that player's shuffles
 *  - `cards`                random targets from card effects
 */
export function stream(state: CombatState, name: string): RngState {
  let r = state.rng[name];
  if (!r) {
    r = seedRng(`${state.seed}::${name}`);
    state.rng[name] = r;
  }
  return r;
}

export const isEnemyAlive = (e: EnemyState): boolean => e.hp > 0;
export const isPlayerActive = (p: PlayerState): boolean => !p.downed;

type HasPlayers = Pick<CombatState, "players">;
type HasEnemies = Pick<CombatState, "enemies">;

export function livingEnemies<E extends EnemyState>(state: { enemies: E[] }): E[] {
  return state.enemies.filter(isEnemyAlive);
}

export function activePlayers(state: HasPlayers): PlayerState[] {
  return state.players.filter(isPlayerActive);
}

export function findPlayer(state: HasPlayers, id: EntityId): PlayerState | undefined {
  return state.players.find((p) => p.id === id);
}

export function findEnemy(state: HasEnemies, id: EntityId): EnemyState | undefined {
  return state.enemies.find((e) => e.id === id);
}

export function findEntity(
  state: HasPlayers & HasEnemies,
  id: EntityId,
): PlayerState | EnemyState | undefined {
  return findPlayer(state, id) ?? findEnemy(state, id);
}

export function getStatus(statuses: Statuses, id: StatusId): number {
  return statuses[id] ?? 0;
}

export function addStatus(statuses: Statuses, id: StatusId, amount: number): void {
  const next = getStatus(statuses, id) + amount;
  if (next === 0) delete statuses[id];
  else statuses[id] = next;
}

/** Duration statuses tick down at the end of their owner's turn. */
export function tickDurationStatuses(statuses: Statuses): void {
  for (const id of ["vulnerable", "weak"] as const) {
    if (getStatus(statuses, id) > 0) addStatus(statuses, id, -1);
  }
}

/** Final damage after attacker and defender modifiers (before block). */
export function computeDamage(base: number, attacker: Statuses, defender: Statuses): number {
  let dmg = base + getStatus(attacker, "strength");
  if (getStatus(attacker, "weak") > 0) dmg = Math.floor(dmg * 0.75);
  if (getStatus(defender, "vulnerable") > 0) dmg = Math.floor(dmg * 1.5);
  return Math.max(0, dmg);
}
