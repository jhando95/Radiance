import { canAct, rankOf } from "../combat/ctx";
import { skillBlocker, validTargets } from "../combat/skills";
import { getDiscipline, getSkill } from "../content";
import { canEquip, computeStats, itemScore, slotsFor } from "../merc";
import { nextFloat, pick, type RngState } from "../rng";
import { availableNodes } from "../run/run";
import type { CombatState, Merc, PlayerId, RunCommand, RunState, SkillDef, Unit } from "../types";

/** Heuristic bot used by the simulator, tests, and (later) to stand in for absent players. */
export function botRunCommand(run: RunState, playerId: PlayerId, r: RngState): RunCommand | null {
  if (run.phase === "combat" && run.combat) return botCombat(run.combat, playerId, r);
  if (run.phase !== "map" && run.phase !== "reward") return null;

  const mine = run.mercs.filter((m) => m.ownerId === playerId);
  for (const merc of mine) {
    const offer = merc.perkOffers[0];
    if (offer?.length) return { type: "choosePerk", mercId: merc.id, perkId: pick(r, offer) };
  }
  for (const merc of mine) {
    const upgrade = bestUpgrade(run, merc);
    if (upgrade) return upgrade;
  }
  if (run.lampCharge < 40 && run.ore >= 30) return { type: "refuel" };
  if (run.phase === "reward") return run.ready.includes(playerId) ? null : { type: "continue" };
  if (run.votes[playerId]) return null;
  const options = availableNodes(run);
  if (!options.length) return null;
  const hurt =
    run.mercs.reduce((s, m) => s + m.hp / computeStats(m).maxHp, 0) / run.mercs.length < 0.5;
  const camp = options.find((n) => n.type === "camp");
  const node = hurt && camp ? camp : pick(r, options);
  return { type: "vote", nodeId: node.id };
}

function bestUpgrade(run: RunState, merc: Merc): RunCommand | null {
  for (const item of run.stash) {
    if (canEquip(merc, item)) continue;
    for (const slot of slotsFor(item.slot)) {
      const current = merc.equipment[slot];
      if (slot === "weapon" && !current) continue;
      if (!current || itemScore(item) > itemScore(current) + 2) {
        return { type: "equip", mercId: merc.id, itemUid: item.uid, slot };
      }
    }
  }
  return null;
}

function botCombat(combat: CombatState, playerId: PlayerId, r: RngState): RunCommand | null {
  const unit = [...combat.mercs].find((u) => u.id === combat.active);
  if (!unit || unit.ownerId !== playerId) return null;
  const choice = chooseSkill(combat, unit, r);
  return { type: "useSkill", unitId: unit.id, ...choice };
}

export function chooseSkill(
  combat: CombatState,
  unit: Unit,
  r: RngState,
): { skillId: string; targetId?: string } {
  const allies = combat.mercs;
  const hurt = [...allies]
    .filter((a) => a.downed || a.hp < a.stats.maxHp * 0.45)
    .sort((a, b) => Number(b.downed) - Number(a.downed) || a.hp - b.hp);

  const options: { skill: SkillDef; targetId?: string; score: number }[] = [];
  for (const id of unit.skills) {
    const skill = getSkill(id);
    const targets = validTargets(combat, unit, skill);
    let targetId: string | undefined;
    let score = 0;
    const heals = skill.effects.some((e) => e.kind === "heal" && e.to !== "self");
    if (heals) {
      const t = hurt.find((h) => targets.includes(h));
      if (!t && !skill.target.aoe) continue;
      if (skill.target.aoe && hurt.length < 2) continue;
      targetId = t?.id;
      score = 6 + (t?.downed ? 5 : 0);
    } else if (skill.target.side === "enemy") {
      const sorted = [...targets].sort((a, b) => a.hp - b.hp);
      targetId = sorted[0]?.id;
      const dmg = skill.effects.find((e) => e.kind === "damage");
      score = dmg ? dmg.mult * (dmg.hits ?? 1) * (skill.target.aoe ? 1.6 : 1) * 3 : 1;
      score += skill.cooldown > 0 ? 1 : 0;
    } else if (skill.target.side === "ally") {
      targetId = targets.find((t) => t !== unit)?.id ?? targets[0]?.id;
      score = 1.5;
    } else {
      score = 1.2 + nextFloat(r);
    }
    if (skillBlocker(combat, unit, id, targetId) !== null) continue;
    options.push({ skill, targetId, score });
  }
  if (options.length) {
    const best = options.sort((a, b) => b.score - a.score)[0] as (typeof options)[number];
    return { skillId: best.skill.id, ...(best.targetId ? { targetId: best.targetId } : {}) };
  }
  // Nothing usable: step toward the discipline's preferred ranks.
  const preferred = getDiscipline(unit.defId).preferredRanks as number[];
  const rank = rankOf(combat, unit);
  const dir =
    rank < Math.min(...preferred) ? 1 : rank > Math.max(...preferred) ? -1 : rank > 2 ? -1 : 1;
  const neighbor = combat.mercs[rank - 1 + dir];
  if (neighbor && skillBlocker(combat, unit, "move", neighbor.id) === null) {
    return { skillId: "move", targetId: neighbor.id };
  }
  return { skillId: "wait" };
}

export { canAct };
