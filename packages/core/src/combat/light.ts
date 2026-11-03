import type { CombatState, RunState, Unit } from "../types";
import { hasStatus, MAX_RANKS } from "./ctx";

/** Lamp charge bands: a dimming lamp shrinks the light radius. */
export function lampPenalty(lampCharge: number): number {
  if (lampCharge >= 50) return 0;
  if (lampCharge >= 25) return 1;
  return 2;
}

/** Darkness level 0 (bright) .. 3 (pitch) for UI, audio and loot bonuses. */
export function darknessLevel(lampCharge: number): 0 | 1 | 2 | 3 {
  if (lampCharge >= 75) return 0;
  if (lampCharge >= 50) return 1;
  if (lampCharge >= 25) return 2;
  return 3;
}

/** Number of enemy ranks lit by the squad (0..4). */
export function lightRadius(run: Pick<RunState, "lampCharge">, combat: CombatState): number {
  const lamp = Math.max(0, ...combat.mercs.map((m) => m.stats.lightRadius));
  const beacons = combat.beacons.reduce((s, b) => s + b.amount, 0);
  const radius = lamp > 0 ? lamp - lampPenalty(run.lampCharge) + beacons : beacons;
  return Math.max(0, Math.min(MAX_RANKS, radius));
}

export function isLit(run: Pick<RunState, "lampCharge">, combat: CombatState, unit: Unit): boolean {
  if (unit.side === "merc") return true;
  if (hasStatus(unit, "lit")) return true;
  return combat.enemies.indexOf(unit) < lightRadius(run, combat);
}
