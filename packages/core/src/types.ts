import type { RngState } from "./rng";

export type PlayerId = string;
export type EnemyId = string;
export type EntityId = PlayerId | EnemyId;

export const STATUS_IDS = ["strength", "vulnerable", "weak"] as const;
export type StatusId = (typeof STATUS_IDS)[number];
export type Statuses = Partial<Record<StatusId, number>>;

// ---------------------------------------------------------------------------
// Content definitions (static data, never stored in state — state stores ids)
// ---------------------------------------------------------------------------

export type CardType = "attack" | "skill" | "power";
export type CardRarity = "starter" | "common" | "uncommon" | "rare";
/** What the player must choose when playing the card. */
export type CardTargeting = "enemy" | "ally" | "none";

export type CardEffectTarget = "target" | "self" | "allEnemies" | "allAllies" | "randomEnemy";

export type CardEffect =
  | { kind: "damage"; amount: number; hits?: number; to: "target" | "allEnemies" | "randomEnemy" }
  | { kind: "block"; amount: number; to: "self" | "target" | "allAllies" }
  | { kind: "draw"; count: number }
  | { kind: "energy"; amount: number }
  | { kind: "radiance"; amount: number }
  | { kind: "status"; status: StatusId; amount: number; to: CardEffectTarget }
  | { kind: "illuminate"; to: "target" | "allEnemies" }
  | { kind: "heal"; amount: number; to: "self" | "target" | "allAllies" };

export interface CardDef {
  id: string;
  name: string;
  /** Owning class id, or "neutral". */
  classId: string;
  type: CardType;
  rarity: CardRarity;
  cost: number;
  /** Shared co-op resource spent in addition to energy. */
  radianceCost?: number;
  targeting: CardTargeting;
  effects: CardEffect[];
  exhaust?: boolean;
  /** Only offered as a reward when 2+ players are in the run. */
  coopOnly?: boolean;
  flavor?: string;
}

export type EnemyEffect =
  | { kind: "attack"; amount: number; hits?: number; to: "target" | "allPlayers" }
  | { kind: "block"; amount: number }
  | { kind: "status"; status: StatusId; amount: number; to: "self" | "target" | "allPlayers" };

export interface EnemyMoveDef {
  id: string;
  name: string;
  effects: EnemyEffect[];
}

export type EnemyAi =
  /** Repeat moves in a fixed order. */
  | { type: "cycle"; order: string[] }
  /** Weighted random, never the same move more than `maxRepeat` times in a row. */
  | { type: "weighted"; weights: Record<string, number>; maxRepeat: number };

export interface EnemyDef {
  id: string;
  name: string;
  hp: [min: number, max: number];
  /** Veiled enemies hide their intent until a player illuminates them. */
  veiled: boolean;
  moves: EnemyMoveDef[];
  ai: EnemyAi;
}

export interface ClassDef {
  id: string;
  name: string;
  maxHp: number;
  maxEnergy: number;
  startingDeck: string[];
  blurb: string;
}

export interface EncounterDef {
  id: string;
  enemies: string[];
}

// ---------------------------------------------------------------------------
// Runtime state (plain JSON — must survive structuredClone / JSON round-trip)
// ---------------------------------------------------------------------------

export interface CardInstance {
  uid: number;
  defId: string;
}

export interface PlayerState {
  id: PlayerId;
  name: string;
  classId: string;
  hp: number;
  maxHp: number;
  block: number;
  energy: number;
  maxEnergy: number;
  statuses: Statuses;
  drawPile: CardInstance[];
  hand: CardInstance[];
  discardPile: CardInstance[];
  exhaustPile: CardInstance[];
  /** Has ended their turn this round. */
  ready: boolean;
  downed: boolean;
}

export interface Intent {
  moveId: string;
  /** Player targeted by single-target effects; null if the move has none. */
  targetId: PlayerId | null;
}

export interface EnemyState {
  id: EnemyId;
  defId: string;
  hp: number;
  maxHp: number;
  block: number;
  statuses: Statuses;
  intent: Intent | null;
  illuminated: boolean;
  moveHistory: string[];
}

export type CombatPhase = "player" | "victory" | "defeat";

export interface CombatState {
  seed: string;
  /** Named RNG streams; see `stream()` in combat/state.ts. SECRET: never send to clients. */
  rng: Record<string, RngState>;
  nextUid: number;
  turn: number;
  phase: CombatPhase;
  /** Shared co-op resource. */
  radiance: number;
  maxRadiance: number;
  players: PlayerState[];
  enemies: EnemyState[];
  /** Incremented on every accepted command. Clients use it to detect stale/missed updates. */
  version: number;
}

// ---------------------------------------------------------------------------
// Commands (player intent) and events (what happened, for animation & logs)
// ---------------------------------------------------------------------------

export type Command =
  | { type: "playCard"; cardUid: number; targetId?: EntityId }
  | { type: "endTurn" }
  | { type: "cancelEndTurn" };

export type CombatEvent =
  | { type: "cardPlayed"; playerId: PlayerId; cardUid: number; defId: string; targetId?: EntityId }
  | { type: "damage"; sourceId: EntityId; targetId: EntityId; amount: number; blocked: number }
  | { type: "block"; targetId: EntityId; amount: number }
  | { type: "heal"; targetId: EntityId; amount: number }
  | { type: "status"; targetId: EntityId; status: StatusId; amount: number }
  | { type: "radiance"; amount: number; total: number }
  | { type: "draw"; playerId: PlayerId; count: number }
  | { type: "illuminate"; targetId: EnemyId }
  | { type: "defeated"; targetId: EntityId }
  | { type: "ready"; playerId: PlayerId; ready: boolean }
  | { type: "enemyMove"; enemyId: EnemyId; moveId: string }
  | { type: "turnStart"; turn: number }
  | { type: "combatEnd"; result: "victory" | "defeat" };

export type CommandResult =
  | { ok: true; state: CombatState; events: CombatEvent[] }
  | { ok: false; error: string };
