import { applyCommand, type CombatPlayerSetup, createCombat } from "../combat/combat";
import { seedRng } from "../rng";
import type { CombatState } from "../types";
import { botCommand } from "./bot";

export interface SimOptions {
  encounterId: string;
  classes: string[];
  runs: number;
  seedPrefix?: string;
  /** Safety valve against stalemates. */
  maxCommands?: number;
}

export interface SimResult {
  encounterId: string;
  classes: string[];
  runs: number;
  wins: number;
  winRate: number;
  avgTurns: number;
  avgHpLostPct: number;
  stalemates: number;
}

export function runCombatWithBots(
  seed: string,
  encounterId: string,
  classes: string[],
  maxCommands = 2000,
): { state: CombatState; commands: number } {
  const players: CombatPlayerSetup[] = classes.map((classId, i) => ({
    id: `p${i + 1}`,
    name: `Bot ${i + 1}`,
    classId,
  }));
  let state = createCombat({ seed, encounterId, players });
  const botRng = seedRng(`bot::${seed}`);
  let commands = 0;
  while (state.phase === "player" && commands < maxCommands) {
    // Rotate through players who still have actions, like real co-op interleaving.
    const actor = state.players.find((p) => !p.downed && !p.ready);
    if (!actor) break;
    const result = applyCommand(state, actor.id, botCommand(state, actor.id, botRng));
    if (!result.ok) throw new Error(`Bot issued invalid command: ${result.error}`);
    state = result.state;
    commands++;
  }
  return { state, commands };
}

export function simulate(opts: SimOptions): SimResult {
  let wins = 0;
  let turns = 0;
  let hpLostPct = 0;
  let stalemates = 0;
  for (let i = 0; i < opts.runs; i++) {
    const seed = `${opts.seedPrefix ?? "sim"}-${i}`;
    const { state } = runCombatWithBots(seed, opts.encounterId, opts.classes, opts.maxCommands);
    if (state.phase === "victory") wins++;
    if (state.phase === "player") stalemates++;
    turns += state.turn;
    const maxHp = state.players.reduce((s, p) => s + p.maxHp, 0);
    const hp = state.players.reduce((s, p) => s + p.hp, 0);
    hpLostPct += (maxHp - hp) / maxHp;
  }
  return {
    encounterId: opts.encounterId,
    classes: opts.classes,
    runs: opts.runs,
    wins,
    winRate: wins / opts.runs,
    avgTurns: turns / opts.runs,
    avgHpLostPct: hpLostPct / opts.runs,
    stalemates,
  };
}
