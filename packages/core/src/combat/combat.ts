import { getCard, getClass, getEncounter, getEnemy } from "../content";
import { pick, rangeInt, shuffle, weightedPick } from "../rng";
import type {
  CombatState,
  Command,
  CommandResult,
  EnemyState,
  PlayerId,
  PlayerState,
} from "../types";
import { drawCards, getMove, moveNeedsTarget, resolveCard, resolveEnemyMove } from "./effects";
import {
  activePlayers,
  type Ctx,
  ENEMY_HP_SCALE_PER_EXTRA_PLAYER,
  findEnemy,
  findPlayer,
  HAND_SIZE,
  isEnemyAlive,
  livingEnemies,
  MAX_RADIANCE,
  stream,
  tickDurationStatuses,
} from "./state";

export interface CombatPlayerSetup {
  id: PlayerId;
  name: string;
  classId: string;
}

export interface CreateCombatOptions {
  seed: string;
  encounterId: string;
  players: CombatPlayerSetup[];
}

export const MAX_PLAYERS = 4;

/** Build a fresh combat and run the opening draw. Pure: same options => same state. */
export function createCombat(opts: CreateCombatOptions): CombatState {
  if (opts.players.length < 1 || opts.players.length > MAX_PLAYERS) {
    throw new Error(`Combat needs 1-${MAX_PLAYERS} players, got ${opts.players.length}`);
  }
  const state: CombatState = {
    seed: opts.seed,
    rng: {},
    nextUid: 1,
    turn: 0,
    phase: "player",
    radiance: 0,
    maxRadiance: MAX_RADIANCE,
    players: [],
    enemies: [],
    version: 0,
  };

  for (const setup of opts.players) {
    const cls = getClass(setup.classId);
    const deck = cls.startingDeck.map((defId) => ({ uid: state.nextUid++, defId }));
    shuffle(stream(state, `deck:${setup.id}`), deck);
    state.players.push({
      id: setup.id,
      name: setup.name,
      classId: cls.id,
      hp: cls.maxHp,
      maxHp: cls.maxHp,
      block: 0,
      energy: 0,
      maxEnergy: cls.maxEnergy,
      statuses: {},
      drawPile: deck,
      hand: [],
      discardPile: [],
      exhaustPile: [],
      ready: false,
      downed: false,
    });
  }

  const hpScale = 1 + ENEMY_HP_SCALE_PER_EXTRA_PLAYER * (opts.players.length - 1);
  const setupRng = stream(state, "enemies:setup");
  getEncounter(opts.encounterId).enemies.forEach((defId, i) => {
    const def = getEnemy(defId);
    const hp = Math.round(rangeInt(setupRng, def.hp[0], def.hp[1]) * hpScale);
    state.enemies.push({
      id: `e${i + 1}`,
      defId: def.id,
      hp,
      maxHp: hp,
      block: 0,
      statuses: {},
      intent: null,
      illuminated: !def.veiled,
      moveHistory: [],
    });
  });

  startTurn({ state, events: [] });
  return state;
}

/**
 * The single entry point for changing combat state. Never mutates `prev`.
 * The server calls this for every client command; clients call it only in offline mode.
 */
export function applyCommand(prev: CombatState, playerId: PlayerId, cmd: Command): CommandResult {
  if (prev.phase !== "player") return { ok: false, error: "Combat is over." };
  const player = findPlayer(prev, playerId);
  if (!player) return { ok: false, error: "You are not in this combat." };
  if (player.downed) return { ok: false, error: "You are downed." };

  const state = structuredClone(prev);
  const ctx: Ctx = { state, events: [] };
  const me = findPlayer(state, playerId) as PlayerState;

  switch (cmd.type) {
    case "playCard": {
      const error = playCard(ctx, me, cmd.cardUid, cmd.targetId);
      if (error) return { ok: false, error };
      break;
    }
    case "endTurn": {
      if (me.ready) return { ok: false, error: "You already ended your turn." };
      me.ready = true;
      ctx.events.push({ type: "ready", playerId: me.id, ready: true });
      if (activePlayers(state).every((p) => p.ready)) endRound(ctx);
      break;
    }
    case "cancelEndTurn": {
      if (!me.ready) return { ok: false, error: "You haven't ended your turn." };
      me.ready = false;
      ctx.events.push({ type: "ready", playerId: me.id, ready: false });
      break;
    }
    default: {
      const exhaustive: never = cmd;
      return { ok: false, error: `Unknown command: ${JSON.stringify(exhaustive)}` };
    }
  }

  state.version++;
  return { ok: true, state, events: ctx.events };
}

/** Why a card can't be played right now, or null if it can. Used by UI and validation. */
export function canPlayCard(
  state: Pick<CombatState, "players" | "enemies" | "phase" | "radiance">,
  playerId: PlayerId,
  cardUid: number,
  targetId?: string,
): string | null {
  const player = findPlayer(state, playerId);
  if (!player || player.downed) return "You can't act.";
  if (state.phase !== "player") return "Combat is over.";
  if (player.ready) return "You already ended your turn.";
  const card = player.hand.find((c) => c.uid === cardUid);
  if (!card) return "That card is not in your hand.";
  const def = getCard(card.defId);
  if (def.cost > player.energy) return "Not enough energy.";
  if ((def.radianceCost ?? 0) > state.radiance) return "Not enough Radiance.";
  if (def.coopOnly && state.players.length < 2) return "That card needs allies.";
  if (def.targeting === "enemy") {
    const enemy = targetId ? findEnemy(state, targetId) : undefined;
    if (!enemy || !isEnemyAlive(enemy)) return "Choose an enemy target.";
  } else if (def.targeting === "ally") {
    const ally = targetId ? findPlayer(state, targetId) : undefined;
    if (!ally || ally.downed) return "Choose an ally target.";
  }
  return null;
}

function playCard(ctx: Ctx, me: PlayerState, cardUid: number, targetId?: string): string | null {
  const error = canPlayCard(ctx.state, me.id, cardUid, targetId);
  if (error) return error;
  const index = me.hand.findIndex((c) => c.uid === cardUid);
  const [card] = me.hand.splice(index, 1);
  if (!card) return "That card is not in your hand.";
  const def = getCard(card.defId);

  me.energy -= def.cost;
  if (def.radianceCost) {
    ctx.state.radiance -= def.radianceCost;
    ctx.events.push({ type: "radiance", amount: -def.radianceCost, total: ctx.state.radiance });
  }
  ctx.events.push({ type: "cardPlayed", playerId: me.id, cardUid, defId: def.id, targetId });

  resolveCard(ctx, me, def, targetId);

  if (def.exhaust || def.type === "power") me.exhaustPile.push(card);
  else me.discardPile.push(card);

  if (livingEnemies(ctx.state).length === 0) endCombat(ctx, "victory");
  return null;
}

/** All active players are ready: discard, enemies act, then the next turn begins. */
function endRound(ctx: Ctx): void {
  const { state } = ctx;
  for (const p of activePlayers(state)) {
    p.discardPile.push(...p.hand);
    p.hand = [];
    tickDurationStatuses(p.statuses);
  }

  for (const enemy of state.enemies) {
    if (!isEnemyAlive(enemy)) continue;
    enemy.block = 0;
    resolveEnemyMove(ctx, enemy);
    if (enemy.intent) enemy.moveHistory.push(enemy.intent.moveId);
    if (activePlayers(state).length === 0) {
      endCombat(ctx, "defeat");
      return;
    }
  }

  for (const enemy of livingEnemies(state)) tickDurationStatuses(enemy.statuses);
  startTurn(ctx);
}

function startTurn(ctx: Ctx): void {
  const { state } = ctx;
  state.turn++;
  ctx.events.push({ type: "turnStart", turn: state.turn });
  for (const p of activePlayers(state)) {
    p.block = 0;
    p.energy = p.maxEnergy;
    p.ready = false;
    drawCards(ctx, p, HAND_SIZE);
  }
  for (const enemy of livingEnemies(state)) rollIntent(state, enemy);
}

function rollIntent(state: CombatState, enemy: EnemyState): void {
  const def = getEnemy(enemy.defId);
  const r = stream(state, "enemies:ai");
  let moveId: string;
  if (def.ai.type === "cycle") {
    moveId = def.ai.order[enemy.moveHistory.length % def.ai.order.length] as string;
  } else {
    const { weights, maxRepeat } = def.ai;
    const recent = enemy.moveHistory.slice(-maxRepeat);
    const banned = recent.length === maxRepeat && recent.every((m) => m === recent[0]);
    const options = Object.entries(weights).filter(([id]) => !(banned && id === recent[0]));
    moveId = weightedPick(r, options);
  }
  const move = getMove(enemy, moveId);
  const candidates = activePlayers(state);
  const targetId = moveNeedsTarget(move) && candidates.length ? pick(r, candidates).id : null;
  enemy.intent = { moveId, targetId };
}

function endCombat(ctx: Ctx, result: "victory" | "defeat"): void {
  ctx.state.phase = result;
  for (const p of ctx.state.players) p.ready = false;
  ctx.events.push({ type: "combatEnd", result });
}

export interface LoggedCommand {
  playerId: PlayerId;
  command: Command;
}

/**
 * Rebuild a combat from its options and command log. This is the save format and the
 * desync/bug-report tool: if two machines replay the same log they MUST agree.
 */
export function replay(opts: CreateCombatOptions, log: readonly LoggedCommand[]): CombatState {
  let state = createCombat(opts);
  for (const [i, entry] of log.entries()) {
    const result = applyCommand(state, entry.playerId, entry.command);
    if (!result.ok) throw new Error(`Replay failed at command ${i}: ${result.error}`);
    state = result.state;
  }
  return state;
}
