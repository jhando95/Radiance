import { canPlayCard } from "../combat/combat";
import { activePlayers, findPlayer, livingEnemies } from "../combat/state";
import { describeIntent } from "../combat/view";
import { getCard } from "../content";
import { pick, type RngState } from "../rng";
import type { CombatState, Command, PlayerId } from "../types";

/**
 * A simple heuristic bot. Used by the balance simulator and as a stand-in for absent
 * co-op players in tests. It only reads state; its own randomness comes from `r`,
 * never from the combat's RNG streams.
 */
export function botCommand(state: CombatState, playerId: PlayerId, r: RngState): Command {
  const me = findPlayer(state, playerId);
  if (!me || me.downed || me.ready) return { type: "endTurn" };

  const enemies = livingEnemies(state);
  const incoming = enemies.reduce((sum, e) => {
    const intent = describeIntent(state, e);
    if (!intent?.damage) return sum;
    const hitsMe = intent.targetsAll || intent.targetId === me.id;
    return hitsMe ? sum + intent.damage * (intent.hits ?? 1) : sum;
  }, 0);
  const needBlock = incoming > me.block;
  const weakest = [...enemies].sort((a, b) => a.hp + a.block - (b.hp + b.block))[0];
  const neediestAlly = [...activePlayers(state)].sort((a, b) => a.hp - b.hp)[0];

  const options: Array<{ cmd: Command; score: number }> = [];
  for (const card of me.hand) {
    const def = getCard(card.defId);
    const targetId =
      def.targeting === "enemy"
        ? weakest?.id
        : def.targeting === "ally"
          ? neediestAlly?.id
          : undefined;
    if (canPlayCard(state, me.id, card.uid, targetId) !== null) continue;
    let score = 1;
    const isBlock = def.effects.some((e) => e.kind === "block");
    if (isBlock) score += needBlock ? 3 : -0.5;
    if (def.type === "attack") score += 2;
    if (def.radianceCost) score += 3;
    if (def.effects.some((e) => e.kind === "radiance" || e.kind === "illuminate")) score += 1.5;
    options.push({ cmd: { type: "playCard", cardUid: card.uid, targetId }, score });
  }
  if (options.length === 0) return { type: "endTurn" };
  const best = Math.max(...options.map((o) => o.score));
  return pick(
    r,
    options.filter((o) => o.score === best),
  ).cmd;
}
