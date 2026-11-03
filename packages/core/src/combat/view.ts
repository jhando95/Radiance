import { getCard, getEnemy } from "../content";
import type {
  CardDef,
  CardEffect,
  CombatState,
  EnemyState,
  PlayerId,
  PlayerState,
  Statuses,
} from "../types";
import { getMove } from "./effects";
import { computeDamage, findPlayer } from "./state";

export interface EnemyView extends EnemyState {
  /** True when the intent exists but is veiled from players. */
  intentHidden: boolean;
}

export type PlayerView = PlayerState;

/** What a client is allowed to see. No RNG state, no draw order, no veiled intents. */
export interface CombatView extends Omit<CombatState, "rng" | "enemies" | "players"> {
  viewerId: PlayerId;
  players: PlayerView[];
  enemies: EnemyView[];
}

export function viewFor(state: CombatState, viewerId: PlayerId): CombatView {
  const { rng: _secret, enemies, players, ...rest } = state;
  return structuredClone({
    ...rest,
    viewerId,
    players: players.map((p) => ({
      ...p,
      // Contents are public, order is not.
      drawPile: [...p.drawPile].sort((a, b) => a.defId.localeCompare(b.defId) || a.uid - b.uid),
    })),
    enemies: enemies.map((e) => {
      const hidden = !e.illuminated && e.intent !== null;
      return { ...e, intent: hidden ? null : e.intent, intentHidden: hidden };
    }),
  });
}

// ---------------------------------------------------------------------------
// Human-readable descriptions (shared by client UI, logs and the simulator)
// ---------------------------------------------------------------------------

export type IntentKind = "attack" | "defend" | "buff" | "debuff" | "hidden";

export interface IntentSummary {
  kind: IntentKind;
  label: string;
  /** Per-hit damage after modifiers, if the move attacks. */
  damage?: number;
  hits?: number;
  targetId: PlayerId | null;
  targetsAll: boolean;
}

export function describeIntent(
  view: Pick<CombatState, "players">,
  enemy: EnemyView | EnemyState,
): IntentSummary | null {
  if ("intentHidden" in enemy && enemy.intentHidden) {
    return { kind: "hidden", label: "???", targetId: null, targetsAll: false };
  }
  if (!enemy.intent) return null;
  const move = getMove(enemy, enemy.intent.moveId);
  const target = enemy.intent.targetId ? findPlayer(view, enemy.intent.targetId) : undefined;
  const attack = move.effects.find((e) => e.kind === "attack");
  const kinds = new Set(move.effects.map((e) => e.kind));
  let kind: IntentKind = "buff";
  if (attack) kind = "attack";
  else if (kinds.has("block")) kind = "defend";
  else if (move.effects.some((e) => e.kind === "status" && e.to !== "self")) kind = "debuff";

  const defender: Statuses = target?.statuses ?? {};
  const damage = attack ? computeDamage(attack.amount, enemy.statuses, defender) : undefined;
  const hits = attack?.hits ?? (attack ? 1 : undefined);
  const targetsAll = move.effects.some((e) => e.kind !== "block" && e.to === "allPlayers");
  let label = move.name;
  if (damage !== undefined) label = hits && hits > 1 ? `${damage}x${hits}` : `${damage}`;
  return { kind, label, damage, hits, targetId: enemy.intent.targetId, targetsAll };
}

const TARGET_TEXT: Record<string, string> = {
  target: "",
  self: "",
  allEnemies: " to ALL enemies",
  allAllies: " to ALL allies",
  randomEnemy: " to a random enemy",
};

function describeEffect(effect: CardEffect, targeting: CardDef["targeting"]): string {
  switch (effect.kind) {
    case "damage": {
      const hits = effect.hits && effect.hits > 1 ? ` ${effect.hits} times` : "";
      return `Deal ${effect.amount} damage${hits}${TARGET_TEXT[effect.to]}.`;
    }
    case "block":
      if (effect.to === "target" && targeting === "ally")
        return `Give an ally ${effect.amount} Block.`;
      return `Gain ${effect.amount} Block${TARGET_TEXT[effect.to]}.`;
    case "draw":
      return `Draw ${effect.count} card${effect.count === 1 ? "" : "s"}.`;
    case "energy":
      return `Gain ${effect.amount} Energy.`;
    case "radiance":
      return `Kindle ${effect.amount} Radiance.`;
    case "heal":
      return `Heal ${effect.amount}${TARGET_TEXT[effect.to]}.`;
    case "status": {
      const name = effect.status[0]?.toUpperCase() + effect.status.slice(1);
      return `Apply ${effect.amount} ${name}${TARGET_TEXT[effect.to]}.`;
    }
    case "illuminate":
      return effect.to === "allEnemies" ? "Illuminate ALL enemies." : "Illuminate.";
    default: {
      const exhaustive: never = effect;
      return String(exhaustive);
    }
  }
}

export function describeCard(defOrId: CardDef | string): string {
  const def = typeof defOrId === "string" ? getCard(defOrId) : defOrId;
  const parts = def.effects.map((e) => describeEffect(e, def.targeting));
  if (def.radianceCost) parts.unshift(`Costs ${def.radianceCost} Radiance.`);
  if (def.exhaust) parts.push("Exhaust.");
  return parts.join(" ");
}

export function enemyName(enemy: Pick<EnemyState, "defId">): string {
  return getEnemy(enemy.defId).name;
}
