import { getEnemy } from "../content";
import { pick, shuffle } from "../rng";
import type { CardDef, EnemyMoveDef, EnemyState, EntityId, PlayerState } from "../types";
import {
  activePlayers,
  addStatus,
  type Ctx,
  computeDamage,
  findEnemy,
  findPlayer,
  isEnemyAlive,
  livingEnemies,
  MAX_HAND_SIZE,
  MAX_RADIANCE,
  stream,
} from "./state";

type Combatant = PlayerState | EnemyState;

/** Apply damage to a combatant, consuming block first. Returns HP lost. */
export function dealDamage(ctx: Ctx, source: Combatant, target: Combatant, base: number): number {
  const amount = computeDamage(base, source.statuses, target.statuses);
  const blocked = Math.min(target.block, amount);
  target.block -= blocked;
  const hpLoss = amount - blocked;
  target.hp = Math.max(0, target.hp - hpLoss);
  ctx.events.push({
    type: "damage",
    sourceId: source.id,
    targetId: target.id,
    amount: hpLoss,
    blocked,
  });
  if (target.hp === 0) onZeroHp(ctx, target);
  return hpLoss;
}

function onZeroHp(ctx: Ctx, target: Combatant): void {
  if ("downed" in target) {
    if (target.downed) return;
    target.downed = true;
    target.block = 0;
    target.ready = false;
    target.discardPile.push(...target.hand);
    target.hand = [];
  } else {
    target.intent = null;
    target.block = 0;
  }
  ctx.events.push({ type: "defeated", targetId: target.id });
}

export function gainBlock(ctx: Ctx, target: Combatant, amount: number): void {
  if (amount <= 0) return;
  target.block += amount;
  ctx.events.push({ type: "block", targetId: target.id, amount });
}

export function gainRadiance(ctx: Ctx, amount: number): void {
  const before = ctx.state.radiance;
  ctx.state.radiance = Math.max(0, Math.min(MAX_RADIANCE, before + amount));
  const delta = ctx.state.radiance - before;
  if (delta !== 0) ctx.events.push({ type: "radiance", amount: delta, total: ctx.state.radiance });
}

export function drawCards(ctx: Ctx, player: PlayerState, count: number): void {
  let drawn = 0;
  for (let i = 0; i < count; i++) {
    if (player.hand.length >= MAX_HAND_SIZE) break;
    if (player.drawPile.length === 0) {
      if (player.discardPile.length === 0) break;
      player.drawPile = player.discardPile;
      player.discardPile = [];
      shuffle(stream(ctx.state, `deck:${player.id}`), player.drawPile);
    }
    const card = player.drawPile.pop();
    if (!card) break;
    player.hand.push(card);
    drawn++;
  }
  if (drawn > 0) ctx.events.push({ type: "draw", playerId: player.id, count: drawn });
}

// ---------------------------------------------------------------------------
// Card effects
// ---------------------------------------------------------------------------

export function resolveCard(
  ctx: Ctx,
  player: PlayerState,
  def: CardDef,
  targetId: EntityId | undefined,
): void {
  for (const effect of def.effects) {
    // A card can kill its last target mid-resolution; stop once combat is decided.
    if (livingEnemies(ctx.state).length === 0) return;
    switch (effect.kind) {
      case "damage": {
        const hits = effect.hits ?? 1;
        for (let h = 0; h < hits; h++) {
          for (const enemy of enemyTargets(ctx, effect.to, targetId)) {
            dealDamage(ctx, player, enemy, effect.amount);
          }
        }
        break;
      }
      case "block":
        for (const ally of allyTargets(ctx, player, effect.to, targetId))
          gainBlock(ctx, ally, effect.amount);
        break;
      case "draw":
        drawCards(ctx, player, effect.count);
        break;
      case "energy":
        player.energy += effect.amount;
        break;
      case "radiance":
        gainRadiance(ctx, effect.amount);
        break;
      case "heal":
        for (const ally of allyTargets(ctx, player, effect.to, targetId)) {
          const healed = Math.min(effect.amount, ally.maxHp - ally.hp);
          if (healed > 0) {
            ally.hp += healed;
            ctx.events.push({ type: "heal", targetId: ally.id, amount: healed });
          }
        }
        break;
      case "status": {
        const targets: Combatant[] =
          effect.to === "self" || effect.to === "allAllies"
            ? allyTargets(ctx, player, effect.to, targetId)
            : enemyTargets(ctx, effect.to, targetId);
        for (const t of targets) {
          addStatus(t.statuses, effect.status, effect.amount);
          ctx.events.push({
            type: "status",
            targetId: t.id,
            status: effect.status,
            amount: effect.amount,
          });
        }
        break;
      }
      case "illuminate":
        for (const enemy of enemyTargets(ctx, effect.to, targetId)) {
          if (!enemy.illuminated) {
            enemy.illuminated = true;
            ctx.events.push({ type: "illuminate", targetId: enemy.id });
          }
        }
        break;
      default: {
        const exhaustive: never = effect;
        throw new Error(`Unhandled card effect: ${JSON.stringify(exhaustive)}`);
      }
    }
  }
}

function enemyTargets(
  ctx: Ctx,
  to: "target" | "self" | "allEnemies" | "allAllies" | "randomEnemy",
  targetId: EntityId | undefined,
): EnemyState[] {
  switch (to) {
    case "target": {
      const e = targetId ? findEnemy(ctx.state, targetId) : undefined;
      return e && isEnemyAlive(e) ? [e] : [];
    }
    case "allEnemies":
      return livingEnemies(ctx.state);
    case "randomEnemy": {
      const alive = livingEnemies(ctx.state);
      return alive.length ? [pick(stream(ctx.state, "cards"), alive)] : [];
    }
    default:
      return [];
  }
}

function allyTargets(
  ctx: Ctx,
  self: PlayerState,
  to: "target" | "self" | "allAllies" | "allEnemies" | "randomEnemy",
  targetId: EntityId | undefined,
): PlayerState[] {
  switch (to) {
    case "self":
      return [self];
    case "target": {
      const p = targetId ? findPlayer(ctx.state, targetId) : undefined;
      return p && !p.downed ? [p] : [];
    }
    case "allAllies":
      return activePlayers(ctx.state);
    default:
      return [];
  }
}

// ---------------------------------------------------------------------------
// Enemy moves
// ---------------------------------------------------------------------------

export function getMove(enemy: EnemyState, moveId: string): EnemyMoveDef {
  const move = getEnemy(enemy.defId).moves.find((m) => m.id === moveId);
  if (!move) throw new Error(`Enemy ${enemy.defId} has no move ${moveId}`);
  return move;
}

export function moveNeedsTarget(move: EnemyMoveDef): boolean {
  return move.effects.some((e) => e.kind !== "block" && e.to === "target");
}

export function resolveEnemyMove(ctx: Ctx, enemy: EnemyState): void {
  const intent = enemy.intent;
  if (!intent) return;
  const move = getMove(enemy, intent.moveId);
  ctx.events.push({ type: "enemyMove", enemyId: enemy.id, moveId: move.id });

  // If the intended target went down this round, retarget a random active player.
  let target = intent.targetId ? findPlayer(ctx.state, intent.targetId) : undefined;
  if (moveNeedsTarget(move) && (!target || target.downed)) {
    const candidates = activePlayers(ctx.state);
    target = candidates.length ? pick(stream(ctx.state, "enemies:ai"), candidates) : undefined;
  }

  for (const effect of move.effects) {
    if (activePlayers(ctx.state).length === 0) return;
    switch (effect.kind) {
      case "attack": {
        const hits = effect.hits ?? 1;
        for (let h = 0; h < hits; h++) {
          const targets =
            effect.to === "allPlayers" ? activePlayers(ctx.state) : target ? [target] : [];
          for (const p of targets) if (!p.downed) dealDamage(ctx, enemy, p, effect.amount);
        }
        break;
      }
      case "block":
        gainBlock(ctx, enemy, effect.amount);
        break;
      case "status": {
        const targets: Combatant[] =
          effect.to === "self"
            ? [enemy]
            : effect.to === "allPlayers"
              ? activePlayers(ctx.state)
              : target && !target.downed
                ? [target]
                : [];
        for (const t of targets) {
          addStatus(t.statuses, effect.status, effect.amount);
          ctx.events.push({
            type: "status",
            targetId: t.id,
            status: effect.status,
            amount: effect.amount,
          });
        }
        break;
      }
      default: {
        const exhaustive: never = effect;
        throw new Error(`Unhandled enemy effect: ${JSON.stringify(exhaustive)}`);
      }
    }
  }
}
