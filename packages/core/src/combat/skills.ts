import { getPerk, getSkill } from "../content";
import { nextFloat, rangeInt } from "../rng";
import type {
  CombatState,
  Element,
  PerkDef,
  RunState,
  SkillDef,
  SkillEffect,
  SkillMod,
  StatusId,
  Unit,
} from "../types";
import {
  addStatus,
  type Ctx,
  canAct,
  DEBUFFS,
  DOTS,
  findUnit,
  hasStatus,
  opponentsOf,
  rankOf,
  sideOf,
  statusValue,
  stream,
} from "./ctx";
import { isLit } from "./light";

// ---------------------------------------------------------------------------
// Perk lookups
// ---------------------------------------------------------------------------

export function unitPerks(u: Unit): PerkDef[] {
  return u.perks.map((id) => getPerk(id));
}

export function skillModsFor(u: Unit, skillId: string): SkillMod[] {
  return unitPerks(u)
    .map((p) => p.skillMods?.[skillId])
    .filter((m): m is SkillMod => m !== undefined);
}

export function effectiveCooldown(u: Unit, skill: SkillDef): number {
  const delta = skillModsFor(u, skill.id).reduce((s, m) => s + (m.cooldown ?? 0), 0);
  return Math.max(0, skill.cooldown + delta);
}

// ---------------------------------------------------------------------------
// Targeting
// ---------------------------------------------------------------------------

/** Units a skill may target right now (for AoE: everything it would hit). */
export function validTargets(combat: CombatState, user: Unit, skill: SkillDef): Unit[] {
  if (skill.target.side === "self") return [user];
  const ranks = skill.target.ranks as number[];
  if (skill.id === "move") {
    const side = sideOf(combat, user);
    const i = side.indexOf(user);
    return [side[i - 1], side[i + 1]].filter((u): u is Unit => u !== undefined);
  }
  if (skill.target.side === "ally") {
    const side = sideOf(combat, user);
    const revives = skill.effects.some((e) => e.kind === "heal" && e.revive);
    return side.filter(
      (u, i) =>
        ranks.includes(i + 1) &&
        (revives || canAct(u)) &&
        // Guard can't target yourself.
        !(u === user && skill.effects.some((e) => e.kind === "guard")),
    );
  }
  const opponents = opponentsOf(combat, user);
  const inRange = opponents.filter((u, i) => ranks.includes(i + 1) && canAct(u));
  if (!skill.target.aoe) {
    const taunters = inRange.filter((u) => hasStatus(u, "taunt"));
    if (taunters.length) return taunters;
  }
  return inRange;
}

export function skillBlocker(
  combat: CombatState,
  user: Unit,
  skillId: string,
  targetId?: string,
): string | null {
  if (skillId !== "move" && skillId !== "wait" && !user.skills.includes(skillId)) {
    return "That skill isn't equipped.";
  }
  const skill = getSkill(skillId);
  if ((user.cooldowns[skillId] ?? 0) > 0) return `${skill.name} is on cooldown.`;
  if (!(skill.from as number[]).includes(rankOf(combat, user))) {
    return `${skill.name} can't be used from rank ${rankOf(combat, user)}.`;
  }
  const targets = validTargets(combat, user, skill);
  if (targets.length === 0) return "No valid targets.";
  if (!skill.target.aoe && skill.target.side !== "self") {
    if (!targetId) return "Choose a target.";
    if (!targets.some((t) => t.id === targetId)) return "Invalid target.";
  }
  return null;
}

// ---------------------------------------------------------------------------
// Resolution
// ---------------------------------------------------------------------------

const ELEMENT_PCT: Record<Element, keyof Unit["stats"] | null> = {
  physical: null,
  radiant: "radiantPct",
  void: "voidPct",
  fire: "firePct",
  toxic: "toxicPct",
};
const ELEMENT_RES: Record<Element, keyof Unit["stats"] | null> = {
  physical: null,
  radiant: "resRadiant",
  void: "resVoid",
  fire: "resFire",
  toxic: "resToxic",
};
const STATUS_RES: Partial<Record<StatusId, keyof Unit["stats"]>> = {
  bleed: "resBleed",
  burn: "resBurn",
  toxic: "resPoison",
  stun: "resStun",
  mark: "resDebuff",
  blind: "resDebuff",
  corrode: "resDebuff",
  slow: "resDebuff",
  weaken: "resDebuff",
};

function hitChance(ctx: Ctx, user: Unit, target: Unit, skill: SkillDef, mods: SkillMod[]): number {
  const { run, combat } = ctx;
  const accMod = (skill.accMod ?? 0) + mods.reduce((s, m) => s + (m.accMod ?? 0), 0);
  let dodge = target.stats.dodge + statusValue(target, "evasive");
  if (rankOf(combat, target) === 1) {
    dodge += unitPerks(target).reduce((s, p) => s + (p.cond?.frontRankDodge ?? 0), 0);
  }
  let chance = user.stats.acc + accMod - dodge - statusValue(user, "blind");
  if (!isLit(run, combat, target)) {
    if (!user.stats.darkvision) chance -= 15;
    if (target.side === "enemy" && isUmbral(target)) chance -= 10;
  }
  return Math.max(5, Math.min(97, chance));
}

function critChance(ctx: Ctx, user: Unit, target: Unit, skill: SkillDef, mods: SkillMod[]): number {
  if (!isLit(ctx.run, ctx.combat, target) && !user.stats.darkvision) return 0;
  const mod = (skill.critMod ?? 0) + mods.reduce((s, m) => s + (m.critMod ?? 0), 0);
  return Math.max(0, Math.min(100, user.stats.crit + mod));
}

export function isUmbral(u: Unit): boolean {
  return u.umbral;
}

function damagePct(ctx: Ctx, user: Unit, target: Unit, element: Element): number {
  const { run, combat } = ctx;
  const elemKey = ELEMENT_PCT[element];
  let pct = user.stats.dmgPct + (elemKey ? user.stats[elemKey] : 0);
  pct += statusValue(user, "empower") - statusValue(user, "weaken");
  pct += statusValue(target, "mark");
  const targetLit = isLit(run, combat, target);
  for (const perk of unitPerks(user)) {
    const c = perk.cond;
    if (!c) continue;
    if (c.vsUnlitPct && !targetLit) pct += c.vsUnlitPct;
    if (c.vsLitPct && targetLit) pct += c.vsLitPct;
    if (c.vsBleedingPct && hasStatus(target, "bleed")) pct += c.vsBleedingPct;
    if (c.vsMarkedPct && hasStatus(target, "mark")) pct += c.vsMarkedPct;
    if (c.lowHpPct && user.hp < user.stats.maxHp / 2) pct += c.lowHpPct;
  }
  // Umbral creatures are emboldened in shadow.
  if (user.side === "enemy" && isUmbral(user) && !isLit(run, combat, user)) pct += 20;
  return pct;
}

function mitigate(target: Unit, element: Element, amount: number, ignoreProt = 0): number {
  if (element === "physical") {
    const prot = Math.max(0, target.stats.prot - statusValue(target, "corrode"));
    return amount * (1 - (Math.min(75, prot) * (1 - ignoreProt / 100)) / 100);
  }
  const key = ELEMENT_RES[element];
  const res = key ? Math.min(90, target.stats[key]) : 0;
  return amount * (1 - res / 100);
}

/** Applies damage through shields; returns [hpLost, absorbed]. */
export function applyDamage(ctx: Ctx, target: Unit, amount: number): [number, number] {
  let remaining = amount;
  let absorbed = 0;
  for (const s of target.statuses) {
    if (s.id !== "shield" || remaining <= 0) continue;
    const take = Math.min(s.value, remaining);
    s.value -= take;
    remaining -= take;
    absorbed += take;
  }
  target.statuses = target.statuses.filter((s) => s.id !== "shield" || s.value > 0);
  const lost = Math.min(target.hp, remaining);
  target.hp -= lost;
  void ctx;
  return [lost, absorbed];
}

/** Handle a unit reaching 0 HP. Returns true if it went down/died now. */
export function checkDown(ctx: Ctx, target: Unit, killer?: Unit): boolean {
  if (target.hp > 0) return false;
  const { combat } = ctx;
  if (target.side === "merc") {
    if (target.downed) return false;
    target.downed = true;
    target.statuses = [];
    combat.queue = combat.queue.filter((id) => id !== target.id);
    ctx.events.push({ type: "downed", unitId: target.id });
  } else {
    const idx = combat.enemies.indexOf(target);
    if (idx < 0) return false;
    combat.enemies.splice(idx, 1);
    combat.queue = combat.queue.filter((id) => id !== target.id);
    combat.xp += target.xpValue;
    ctx.events.push({ type: "died", unitId: target.id });
    ctx.run.stats.kills++;
    if (killer) onKill(ctx, killer);
  }
  return true;
}

function onKill(ctx: Ctx, killer: Unit): void {
  for (const perk of unitPerks(killer)) {
    for (const t of perk.triggers ?? []) {
      if (t.on !== "kill") continue;
      if (t.healPct) heal(ctx, killer, Math.round((killer.stats.maxHp * t.healPct) / 100));
      if (t.empower) {
        addStatus(killer, { id: "empower", turns: 2, value: t.empower });
        ctx.events.push({
          type: "status",
          targetId: killer.id,
          status: "empower",
          turns: 2,
          value: t.empower,
        });
      }
      if (t.lamp) changeLamp(ctx, t.lamp);
    }
  }
}

export function heal(ctx: Ctx, target: Unit, amount: number, revive = false): void {
  if (target.downed && !revive) return;
  if (target.downed && revive) {
    target.downed = false;
    target.hp = 0;
    ctx.events.push({ type: "revived", unitId: target.id });
  }
  const healed = Math.min(Math.max(0, amount), target.stats.maxHp - target.hp);
  if (healed <= 0 && !revive) return;
  target.hp += Math.max(healed, revive && target.hp === 0 ? 1 : 0);
  ctx.events.push({ type: "heal", targetId: target.id, amount: healed });
}

export function changeLamp(ctx: Ctx, amount: number): void {
  const before = ctx.run.lampCharge;
  ctx.run.lampCharge = Math.max(0, Math.min(100, before + amount));
  const delta = ctx.run.lampCharge - before;
  if (delta !== 0) ctx.events.push({ type: "lamp", amount: delta, total: ctx.run.lampCharge });
}

function tryStatus(
  ctx: Ctx,
  user: Unit,
  target: Unit,
  e: Extract<SkillEffect, { kind: "status" }>,
  element: Element,
): void {
  const recipient = e.to === "self" ? user : target;
  if (!canAct(recipient) && recipient.hp <= 0) return;
  let chance = e.chance;
  const hostile = DEBUFFS.has(e.status) && recipient.side !== user.side;
  if (hostile) {
    const resKey = STATUS_RES[e.status];
    if (resKey) chance *= 1 - Math.min(95, Math.max(-50, recipient.stats[resKey])) / 100;
  }
  if (nextFloat(stream(ctx.run, "combat")) >= chance) {
    if (hostile) ctx.events.push({ type: "resist", targetId: recipient.id, status: e.status });
    return;
  }
  let value = e.value;
  if (DOTS.has(e.status)) {
    const elemKey =
      ELEMENT_PCT[e.status === "bleed" ? "physical" : e.status === "burn" ? "fire" : "toxic"];
    const bonus = user.stats.dotPct + (elemKey ? user.stats[elemKey] : 0);
    value = Math.max(1, Math.round(value * (1 + bonus / 100)));
  }
  void element;
  addStatus(recipient, { id: e.status, turns: e.turns, value, sourceId: user.id });
  ctx.events.push({
    type: "status",
    targetId: recipient.id,
    status: e.status,
    turns: e.turns,
    value,
  });
}

/** Move a unit within its side by `amount` (positive = toward rank 1). */
export function moveUnit(ctx: Ctx, unit: Unit, amount: number): void {
  const side = sideOf(ctx.combat, unit);
  const from = side.indexOf(unit);
  if (from < 0) return;
  const to = Math.max(0, Math.min(side.length - 1, from - amount));
  if (to === from) return;
  side.splice(from, 1);
  side.splice(to, 0, unit);
  ctx.events.push({ type: "move", unitId: unit.id, from: from + 1, to: to + 1 });
}

/** Resolve a fully validated skill use. */
export function resolveSkill(ctx: Ctx, user: Unit, skillId: string, targetId?: string): void {
  const { combat } = ctx;
  const skill = getSkill(skillId);
  const mods = user.side === "merc" ? skillModsFor(user, skill.id) : [];
  const cd = effectiveCooldown(user, skill);
  if (cd > 0) user.cooldowns[skill.id] = cd + 1;

  // Special skills.
  if (skill.id === "wait") {
    ctx.events.push({ type: "skill", unitId: user.id, skillId: skill.id, targetIds: [] });
    return;
  }
  if (skill.id === "move") {
    const other = targetId ? findUnit(combat, targetId) : undefined;
    ctx.events.push({
      type: "skill",
      unitId: user.id,
      skillId: skill.id,
      targetIds: other ? [other.id] : [],
    });
    if (other) {
      const side = sideOf(combat, user);
      const a = side.indexOf(user);
      const b = side.indexOf(other);
      side[a] = other;
      side[b] = user;
      ctx.events.push({ type: "move", unitId: user.id, from: a + 1, to: b + 1 });
      ctx.events.push({ type: "move", unitId: other.id, from: b + 1, to: a + 1 });
    }
    return;
  }

  const all = validTargets(combat, user, skill);
  const targets = skill.target.aoe ? all : all.filter((t) => t.id === (targetId ?? user.id));
  ctx.events.push({
    type: "skill",
    unitId: user.id,
    skillId: skill.id,
    targetIds: targets.map((t) => t.id),
  });

  const effects = [...skill.effects, ...mods.flatMap((m) => m.addEffects ?? [])];
  const dmgBonus = mods.reduce((s, m) => s + (m.dmgMult ?? 0), 0);
  const r = stream(ctx.run, "combat");
  const selfEffectsDone = new Set<number>();

  for (let target of targets) {
    // Guard redirect for single-target hostile skills.
    if (skill.kind === "attack" && !skill.target.aoe && target.side !== user.side) {
      const guard = target.statuses.find((s) => s.id === "guard");
      const guardian = guard?.sourceId ? findUnit(combat, guard.sourceId) : undefined;
      if (guardian && canAct(guardian) && guardian.side === target.side && guardian !== target) {
        ctx.events.push({ type: "guarded", guardId: guardian.id, targetId: target.id });
        target = guardian;
      }
    }

    let landed = skill.kind !== "attack";
    let killed = false;
    for (const [i, e] of effects.entries()) {
      if (killed && !("to" in e && e.to === "self")) continue;
      switch (e.kind) {
        case "damage": {
          const hits = e.hits ?? 1;
          for (let h = 0; h < hits && !killed; h++) {
            if (nextFloat(r) * 100 >= hitChance(ctx, user, target, skill, mods)) {
              ctx.events.push({ type: "miss", sourceId: user.id, targetId: target.id });
              continue;
            }
            landed = true;
            const crit = nextFloat(r) * 100 < critChance(ctx, user, target, skill, mods);
            const roll = rangeInt(
              r,
              user.stats.dmgMin,
              Math.max(user.stats.dmgMin, user.stats.dmgMax),
            );
            let pct = damagePct(ctx, user, target, skill.element);
            if (e.executePct && target.hp < target.stats.maxHp / 2) pct += e.executePct;
            let amount = roll * (e.mult + dmgBonus) * (1 + pct / 100);
            if (crit) amount *= 1 + user.stats.critDmg / 100;
            amount = Math.max(1, Math.round(mitigate(target, skill.element, amount, e.ignoreProt)));
            const [lost, absorbed] = applyDamage(ctx, target, amount);
            ctx.events.push({
              type: "hit",
              sourceId: user.id,
              targetId: target.id,
              amount: lost,
              element: skill.element,
              crit,
              absorbed,
            });
            if (user.stats.lifesteal > 0 && lost > 0) {
              heal(ctx, user, Math.round((lost * user.stats.lifesteal) / 100));
            }
            onHitTriggers(ctx, user, target, crit);
            if (checkDown(ctx, target, user)) killed = true;
          }
          break;
        }
        case "heal": {
          const who = e.to === "self" ? user : target;
          if (e.to === "self") {
            if (selfEffectsDone.has(i)) break;
            selfEffectsDone.add(i);
            if (!landed) break;
          }
          const amount = Math.round(rangeInt(r, e.min, e.max) * (1 + user.stats.healPct / 100));
          heal(ctx, who, amount, e.revive);
          break;
        }
        case "status": {
          if (e.to === "self") {
            if (selfEffectsDone.has(i)) break;
            selfEffectsDone.add(i);
          } else if (!landed) break;
          tryStatus(ctx, user, target, e, skill.element);
          break;
        }
        case "move": {
          if (e.to === "self") {
            if (selfEffectsDone.has(i)) break;
            selfEffectsDone.add(i);
            moveUnit(ctx, user, e.amount);
          } else if (landed && canAct(target)) {
            moveUnit(ctx, target, e.amount);
          }
          break;
        }
        case "cleanse": {
          const who = e.to === "self" ? user : target;
          const before = who.statuses.length;
          who.statuses = who.statuses.filter((s) => !DEBUFFS.has(s.id));
          if (who.statuses.length !== before)
            ctx.events.push({ type: "heal", targetId: who.id, amount: 0 });
          break;
        }
        case "beacon": {
          if (selfEffectsDone.has(i)) break;
          selfEffectsDone.add(i);
          combat.beacons.push({ amount: e.amount, rounds: e.rounds });
          ctx.events.push({ type: "light", radius: e.amount });
          break;
        }
        case "lampCharge": {
          if (selfEffectsDone.has(i)) break;
          selfEffectsDone.add(i);
          changeLamp(ctx, e.amount);
          break;
        }
        case "cooldowns": {
          if (selfEffectsDone.has(i)) break;
          selfEffectsDone.add(i);
          for (const k of Object.keys(user.cooldowns)) {
            if (k !== skill.id)
              user.cooldowns[k] = Math.max(0, (user.cooldowns[k] ?? 0) - e.amount);
          }
          break;
        }
        case "guard": {
          if (target === user) break;
          addStatus(target, { id: "guard", turns: e.turns, value: 0, sourceId: user.id });
          ctx.events.push({
            type: "status",
            targetId: target.id,
            status: "guard",
            turns: e.turns,
            value: 0,
          });
          break;
        }
        default: {
          const never: never = e;
          throw new Error(`Unhandled effect ${JSON.stringify(never)}`);
        }
      }
    }
  }
}

function onHitTriggers(ctx: Ctx, user: Unit, target: Unit, crit: boolean): void {
  if (target.hp <= 0) return;
  const r = stream(ctx.run, "combat");
  for (const perk of unitPerks(user)) {
    for (const t of perk.triggers ?? []) {
      if (t.on === "hit" && nextFloat(r) < t.chance) {
        addStatus(target, { id: t.status, turns: t.turns, value: t.value, sourceId: user.id });
        ctx.events.push({
          type: "status",
          targetId: target.id,
          status: t.status,
          turns: t.turns,
          value: t.value,
        });
      }
      if (t.on === "crit" && crit && t.status) {
        const turns = t.turns ?? 2;
        const value = t.value ?? 0;
        addStatus(target, { id: t.status, turns, value, sourceId: user.id });
        ctx.events.push({ type: "status", targetId: target.id, status: t.status, turns, value });
      }
    }
  }
}

export type { RunState };
