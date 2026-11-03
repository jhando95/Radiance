import { seedRng } from "../rng";
import { applyRunCommand, createRun, type LoggedCommand, slotsForPlayers } from "../run/run";
import type { MercSetup, RunState } from "../types";
import { botRunCommand } from "./bot";
import { CLASS_PRESETS } from "./presets";

export interface RunSimResult {
  seed: string;
  phase: RunState["phase"];
  row: number;
  steps: number;
  kills: number;
  levels: number[];
  ore: number;
  log: LoggedCommand[];
  state: RunState;
}

export function defaultSquad(
  disciplines: string[] = ["vanguard", "reaver", "gunner", "lamplighter"],
): MercSetup[] {
  return disciplines.map((d, i) => {
    const preset = CLASS_PRESETS[d] ?? CLASS_PRESETS.vanguard;
    return { ...(preset as MercSetup), name: `Bot ${i + 1}` };
  });
}

/** Play a whole expedition with bots. `players` controls how mercs are split. */
export function simulateRun(
  seed: string,
  players = 1,
  squad = defaultSquad(),
  maxSteps = 6000,
): RunSimResult {
  const ids = Array.from({ length: players }, (_, i) => `p${i + 1}`);
  const slots = slotsForPlayers(players);
  const owners: string[] = slots.flatMap((n, i) => Array<string>(n).fill(ids[i] as string));
  let run = createRun({
    seed,
    players: ids.map((id) => ({ id, name: id })),
    mercs: squad.map((setup, i) => ({ ownerId: owners[i] as string, setup })),
  });
  const r = seedRng(`bots::${seed}`);
  const log: LoggedCommand[] = [];
  let steps = 0;
  while (steps < maxSteps && run.phase !== "victory" && run.phase !== "defeat") {
    let acted = false;
    for (const pid of ids) {
      const cmd = botRunCommand(run, pid, r);
      if (!cmd) continue;
      const res = applyRunCommand(run, pid, cmd);
      if (!res.ok)
        throw new Error(
          `Bot ${pid} sent invalid ${JSON.stringify(cmd)}: ${res.error} (phase ${run.phase})`,
        );
      run = res.state;
      log.push({ playerId: pid, command: cmd });
      steps++;
      acted = true;
      break;
    }
    if (!acted) throw new Error(`Run stalled in phase ${run.phase}`);
  }
  const row = run.nodes.find((n) => n.id === run.currentNodeId)?.row ?? 0;
  return {
    seed,
    phase: run.phase,
    row,
    steps,
    kills: run.stats.kills,
    levels: run.mercs.map((m) => m.level),
    ore: run.ore,
    log,
    state: run,
  };
}
