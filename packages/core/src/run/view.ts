import { type Ctx, rankOf } from "../combat/ctx";
import { darknessLevel, isLit, lightRadius } from "../combat/light";
import type { CombatState, PlayerId, RunState, Unit } from "../types";
import { availableNodes } from "./run";

export interface UnitView extends Unit {
  rank: number;
  lit: boolean;
  /** Unlit enemy: HP and cooldowns are hidden (hp/maxHp = -1). */
  hidden: boolean;
}

export interface CombatView extends Omit<CombatState, "mercs" | "enemies"> {
  mercs: UnitView[];
  enemies: UnitView[];
  lightRadius: number;
}

export interface RunView extends Omit<RunState, "rng" | "combat"> {
  viewerId: PlayerId;
  combat: CombatView | null;
  darkness: 0 | 1 | 2 | 3;
  available: string[];
}

function unitView(run: RunState, combat: CombatState, u: Unit): UnitView {
  const lit = isLit(run, combat, u);
  const hidden = u.side === "enemy" && !lit;
  const view: UnitView = { ...structuredClone(u), rank: rankOf(combat, u), lit, hidden };
  if (hidden) {
    view.hp = -1;
    view.stats = { ...view.stats, maxHp: -1 };
    view.cooldowns = {};
  }
  return view;
}

/** What one player may see. RNG state is secret; unlit enemies hide their health. */
export function viewFor(run: RunState, viewerId: PlayerId): RunView {
  const { rng: _secret, combat, ...rest } = run;
  return {
    ...structuredClone(rest),
    viewerId,
    darkness: darknessLevel(run.lampCharge),
    available: run.phase === "map" ? availableNodes(run).map((n) => n.id) : [],
    combat: combat
      ? {
          ...structuredClone({ ...combat, mercs: [], enemies: [] }),
          mercs: combat.mercs.map((u) => unitView(run, combat, u)),
          enemies: combat.enemies.map((u) => unitView(run, combat, u)),
          lightRadius: lightRadius(run, combat),
        }
      : null,
  };
}

export type { Ctx };
