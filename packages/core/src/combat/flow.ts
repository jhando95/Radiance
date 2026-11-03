import { getEnemy } from "../content";
import { computeStats, emptyStats, mercPerkIds } from "../merc";
import { rangeInt } from "../rng";
import type { CombatState, EnemyDef, Merc, RunState, Unit } from "../types";
import { chooseEnemyAction } from "./ai";
import { type Ctx, canAct, DOTS, findUnit, statusValue, stream } from "./ctx";
import { lightRadius } from "./light";
import {
  applyDamage,
  changeLamp,
  checkDown,
  heal,
  resolveSkill,
  skillBlocker,
  unitPerks,
} from "./skills";

/** Enemy stats scale with expedition depth (map row). */
export function enemyUnit(def: EnemyDef, id: string, depth: number): Unit {
  const hpScale = 1 + 0.13 * (depth - 1);
  const dmgScale = 1 + 0.09 * (depth - 1);
  const stats = emptyStats();
  stats.maxHp = Math.round(def.hp * hpScale);
  stats.speed = def.speed;
  stats.acc = def.acc + depth;
  stats.dodge = def.dodge;
  stats.prot = def.prot;
  stats.crit = def.crit;
  stats.critDmg = 50;
  stats.dmgMin = Math.round(def.dmg[0] * dmgScale);
  stats.dmgMax = Math.round(def.dmg[1] * dmgScale);
  for (const [k, v] of Object.entries(def.res ?? {}) as [keyof typeof stats, number][])
    stats[k] += v;
  return {
    id,
    side: "enemy",
    defId: def.id,
    name: def.name,
    ownerId: null,
    hp: stats.maxHp,
    stats,
    skills: def.skills.map((s) => s.id),
    cooldowns: {},
    statuses: [],
    downed: false,
    perks: [],
    umbral: !!def.umbral,
    xpValue: Math.round(def.xp * (1 + 0.1 * (depth - 1))),
    elite: !!def.elite,
    boss: !!def.boss,
    focusWeak: !!def.ai?.focusWeak,
  };
}

export function mercUnit(merc: Merc): Unit {
  const stats = computeStats(merc);
  return {
    id: merc.id,
    side: "merc",
    defId: merc.discipline,
    name: merc.name,
    ownerId: merc.ownerId,
    hp: Math.min(merc.hp, stats.maxHp),
    stats,
    skills: [...merc.skills],
    cooldowns: {},
    statuses: [],
    downed: merc.hp <= 0,
    perks: mercPerkIds(merc),
    umbral: false,
    xpValue: 0,
    elite: false,
    boss: false,
    focusWeak: false,
  };
}

export function createCombat(
  ctx: Omit<Ctx, "combat">,
  enemyIds: readonly string[],
  kind: CombatState["kind"],
  depth: number,
): CombatState {
  const combat: CombatState = {
    mercs: ctx.run.mercs.map(mercUnit),
    enemies: enemyIds.map((id, i) => enemyUnit(getEnemy(id), `e${ctx.run.nextUid++}_${i}`, depth)),
    round: 0,
    queue: [],
    active: null,
    beacons: [],
    result: null,
    kind,
    xp: 0,
  };
  const full: Ctx = { ...ctx, combat };
  ctx.run.combat = combat;
  ctx.events.push({ type: "light", radius: lightRadius(ctx.run, combat) });
  advance(full);
  return combat;
}

function effectiveSpeed(u: Unit): number {
  return u.stats.speed + statusValue(u, "haste") - statusValue(u, "slow");
}

function startRound(ctx: Ctx): void {
  const { combat } = ctx;
  combat.round++;
  const r = stream(ctx.run, "combat");
  const order = [...combat.mercs, ...combat.enemies]
    .filter(canAct)
    .map((u) => ({ u, init: effectiveSpeed(u) + rangeInt(r, 0, 3) }))
    .sort(
      (a, b) => b.init - a.init || (a.u.side === "merc" ? -1 : 1) - (b.u.side === "merc" ? -1 : 1),
    );
  combat.queue = order.map((o) => o.u.id);
  ctx.events.push({ type: "round", round: combat.round });
}

function endRound(ctx: Ctx): void {
  const { combat } = ctx;
  const before = lightRadius(ctx.run, combat);
  for (const b of combat.beacons) b.rounds--;
  combat.beacons = combat.beacons.filter((b) => b.rounds > 0);
  const after = lightRadius(ctx.run, combat);
  if (after !== before) ctx.events.push({ type: "light", radius: after });
}

function checkEnd(ctx: Ctx): boolean {
  const { combat } = ctx;
  if (combat.result) return true;
  if (combat.enemies.length === 0) combat.result = "victory";
  else if (combat.mercs.every((m) => !canAct(m))) combat.result = "defeat";
  if (combat.result) {
    combat.active = null;
    combat.queue = [];
    ctx.events.push({ type: "end", result: combat.result });
    return true;
  }
  return false;
}

/** Start-of-turn effects. Returns false if the unit can't act this turn. */
function beginTurn(ctx: Ctx, unit: Unit): boolean {
  ctx.events.push({ type: "turn", unitId: unit.id });
  for (const s of unit.statuses) {
    if (!DOTS.has(s.id)) continue;
    const [lost] = applyDamage(ctx, unit, s.value);
    ctx.events.push({ type: "tick", targetId: unit.id, status: s.id, amount: lost });
    const source = s.sourceId ? findUnit(ctx.combat, s.sourceId) : undefined;
    if (checkDown(ctx, unit, source)) return false;
  }
  const regen = statusValue(unit, "regen");
  if (regen > 0) heal(ctx, unit, regen);
  for (const perk of unitPerks(unit)) {
    for (const t of perk.triggers ?? []) {
      if (t.on !== "turnStart") continue;
      if (t.healPct) heal(ctx, unit, Math.max(1, Math.round((unit.stats.maxHp * t.healPct) / 100)));
      if (t.shield) {
        const existing = unit.statuses.find((s) => s.id === "shield");
        if (existing) existing.value = Math.max(existing.value, t.shield);
        else unit.statuses.push({ id: "shield", turns: 2, value: t.shield });
      }
    }
  }
  const stun = unit.statuses.find((s) => s.id === "stun");
  if (stun) {
    unit.statuses = unit.statuses.filter((s) => s !== stun);
    ctx.events.push({ type: "stunned", unitId: unit.id });
    finishTurn(ctx, unit);
    return false;
  }
  return true;
}

function finishTurn(ctx: Ctx, unit: Unit): void {
  for (const k of Object.keys(unit.cooldowns)) {
    unit.cooldowns[k] = Math.max(0, (unit.cooldowns[k] ?? 0) - 1);
  }
  for (const s of unit.statuses) s.turns--;
  unit.statuses = unit.statuses.filter((s) => s.turns > 0);
  if (ctx.combat.active === unit.id) ctx.combat.active = null;
}

/**
 * Run the turn loop until a merc needs input or the combat ends. Enemy turns resolve
 * immediately (their events are emitted in order so clients can animate them).
 */
export function advance(ctx: Ctx): void {
  const { combat } = ctx;
  let guard = 0;
  while (!checkEnd(ctx)) {
    if (++guard > 500) throw new Error("advance(): runaway loop");
    if (combat.queue.length === 0) {
      if (combat.round > 0) endRound(ctx);
      startRound(ctx);
      continue;
    }
    const id = combat.queue.shift() as string;
    const unit = findUnit(combat, id);
    if (!unit || !canAct(unit)) continue;
    combat.active = unit.id;
    if (!beginTurn(ctx, unit)) {
      combat.active = null;
      continue;
    }
    if (unit.side === "merc") return; // wait for the owner's command
    const choice = chooseEnemyAction(ctx, unit);
    resolveSkill(ctx, unit, choice.skillId, choice.targetId);
    finishTurn(ctx, unit);
  }
}

/** Validate and resolve a merc's skill; then continue the turn loop. */
export function useSkill(
  ctx: Ctx,
  playerId: string,
  unitId: string,
  skillId: string,
  targetId?: string,
): string | null {
  const { combat } = ctx;
  if (combat.result) return "The fight is over.";
  if (combat.active !== unitId) return "It's not that mercenary's turn.";
  const unit = findUnit(combat, unitId);
  if (unit?.side !== "merc") return "Unknown mercenary.";
  if (unit.ownerId !== playerId) return "That mercenary belongs to another player.";
  const blocker = skillBlocker(combat, unit, skillId, targetId);
  if (blocker) return blocker;
  resolveSkill(ctx, unit, skillId, targetId);
  finishTurn(ctx, unit);
  advance(ctx);
  return null;
}

export type { RunState };
export { changeLamp };
