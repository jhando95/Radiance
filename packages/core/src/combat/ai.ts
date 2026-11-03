import { getSkill } from "../content";
import { nextFloat, pick, weightedPick } from "../rng";
import type { CombatState, SkillDef, Unit } from "../types";
import type { Ctx } from "./ctx";
import { canAct, sideOf, stream } from "./ctx";
import { skillBlocker, validTargets } from "./skills";

export interface AiChoice {
  skillId: string;
  targetId?: string;
}

/** Enemy decision-making. Uses the `ai` stream only, never the combat stream. */
export function chooseEnemyAction(ctx: Ctx, unit: Unit): AiChoice {
  const { combat } = ctx;
  const r = stream(ctx.run, "ai");
  const usable = unit.skills
    .map((id) => getSkill(id))
    .filter((s) => skillBlocker(combat, unit, s.id, firstTarget(combat, unit, s)) === null);

  if (usable.length === 0) {
    // Try to step toward the front so skills come into range.
    const side = sideOf(combat, unit);
    const i = side.indexOf(unit);
    const ahead = side[i - 1];
    if (ahead) return { skillId: "move", targetId: ahead.id };
    return { skillId: "wait" };
  }

  const allies = sideOf(combat, unit);
  const hurtAlly = allies.some((a) => canAct(a) && a.hp < a.stats.maxHp * 0.6);
  const weights = usable.map((s): [string, number] => {
    let w = 1;
    const healing = s.effects.some((e) => e.kind === "heal");
    if (healing) w = hurtAlly ? 3 : 0.05;
    else if (s.kind === "support") w = 0.6;
    if (s.cooldown > 0 && !healing) w *= 1.4; // signature moves are used when ready
    return [s.id, w];
  });
  const skill = getSkill(weightedPick(r, weights));
  return { skillId: skill.id, targetId: chooseTarget(ctx, unit, skill) };
}

function firstTarget(combat: CombatState, unit: Unit, skill: SkillDef): string | undefined {
  return validTargets(combat, unit, skill)[0]?.id;
}

function chooseTarget(ctx: Ctx, unit: Unit, skill: SkillDef): string | undefined {
  const targets = validTargets(ctx.combat, unit, skill);
  if (skill.target.aoe || skill.target.side === "self") return undefined;
  const r = stream(ctx.run, "ai");
  if (skill.effects.some((e) => e.kind === "heal")) {
    return [...targets].sort((a, b) => a.hp / a.stats.maxHp - b.hp / b.stats.maxHp)[0]?.id;
  }
  if (unit.focusWeak || nextFloat(r) < 0.35) {
    return [...targets].sort((a, b) => a.hp - b.hp)[0]?.id;
  }
  return pick(r, targets).id;
}
