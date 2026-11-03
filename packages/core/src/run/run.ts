import { type Ctx, stream } from "../combat/ctx";
import { advance, changeLamp, createCombat, useSkill } from "../combat/flow";
import { darknessLevel } from "../combat/light";
import { BOSS_ENCOUNTER, ELITE_ENCOUNTERS, ENCOUNTERS, getDiscipline } from "../content";
import {
  canEquip,
  computeStats,
  createMerc,
  grantXp,
  rollItem,
  slotsFor,
  validSkillLoadout,
} from "../merc";
import { nextFloat, pick, rangeInt } from "../rng";
import type {
  CommandResult,
  EquipSlot,
  Item,
  MapNode,
  Merc,
  MercSetup,
  PlayerId,
  RewardSummary,
  RunCommand,
  RunEvent,
  RunPlayer,
  RunState,
} from "../types";
import { generateMap, MAP_ROWS } from "./map";

export const SQUAD_SIZE = 4;
export const LAMP_DRAIN_PER_NODE = 7;
export const REFUEL_COST = 30;
export const REFUEL_AMOUNT = 20;

export interface CreateRunOptions {
  seed: string;
  players: RunPlayer[];
  /** Exactly SQUAD_SIZE mercs; index 0 starts in rank 1. */
  mercs: { ownerId: PlayerId; setup: MercSetup }[];
}

/** How many mercs each player controls for a given party size (squad is always 4). */
export function slotsForPlayers(playerCount: number): number[] {
  const n = Math.max(1, Math.min(SQUAD_SIZE, playerCount));
  return Array.from(
    { length: n },
    (_, i) => Math.floor(SQUAD_SIZE / n) + (i < SQUAD_SIZE % n ? 1 : 0),
  );
}

export function createRun(opts: CreateRunOptions): RunState {
  if (opts.mercs.length !== SQUAD_SIZE) throw new Error(`A squad needs ${SQUAD_SIZE} mercenaries.`);
  const run: RunState = {
    seed: opts.seed,
    rng: {},
    version: 0,
    nextUid: 1,
    phase: "map",
    players: opts.players.map((p) => ({ ...p })),
    mercs: [],
    nodes: [],
    currentNodeId: "",
    visited: [],
    votes: {},
    lampCharge: 100,
    ore: 0,
    stash: [],
    combat: null,
    reward: null,
    ready: [],
    stats: { kills: 0, combats: 0, itemsFound: 0 },
  };
  const uids = { next: () => run.nextUid++ };
  const lampHolder = Math.max(
    0,
    opts.mercs.findIndex((m) => m.setup.discipline === "lamplighter"),
  );
  run.mercs = opts.mercs.map((m, i) =>
    createMerc(m.setup, `m${i + 1}`, m.ownerId, uids, i === lampHolder),
  );
  run.nodes = generateMap(stream(run, "map"));
  const start = run.nodes.find((n) => n.type === "start");
  if (!start) throw new Error("map has no start");
  run.currentNodeId = start.id;
  run.visited = [start.id];
  // A small welcome kit so builds start diverging immediately.
  const loot = stream(run, "loot");
  for (let i = 0; i < 2; i++) {
    run.stash.push(
      rollItem(loot, run.nextUid++, { ilvl: 1, rarityBonus: 0, minRarity: "uncommon" }),
    );
  }
  return run;
}

export function currentNode(run: RunState): MapNode {
  const node = run.nodes.find((n) => n.id === run.currentNodeId);
  if (!node) throw new Error("current node missing");
  return node;
}

export function availableNodes(run: RunState): MapNode[] {
  const cur = currentNode(run);
  return run.nodes.filter((n) => cur.next.includes(n.id));
}

function partyStat(run: RunState, key: "lootFind" | "oreFind"): number {
  return run.mercs.reduce((s, m) => s + computeStats(m)[key], 0) / 2;
}

function rarityBonus(run: RunState): number {
  return partyStat(run, "lootFind") + ([0, 10, 25, 45][darknessLevel(run.lampCharge)] ?? 0);
}

function dropLoot(ctx: Omit<Ctx, "combat">, count: number, minRarity?: Item["rarity"]): Item[] {
  const { run } = ctx;
  const row = currentNode(run).row;
  const items: Item[] = [];
  for (let i = 0; i < count; i++) {
    const item = rollItem(stream(run, "loot"), run.nextUid++, {
      ilvl: Math.max(1, row),
      rarityBonus: rarityBonus(run),
      disciplines: run.mercs.map((m) => m.discipline),
      ...(minRarity ? { minRarity } : {}),
    });
    items.push(item);
    run.stash.push(item);
  }
  run.stats.itemsFound += items.length;
  if (items.length) ctx.events.push({ type: "loot", itemUids: items.map((i) => i.uid) });
  return items;
}

function gainOre(run: RunState, base: number): number {
  const ore = Math.round(base * (1 + partyStat(run, "oreFind") / 100 / 2));
  run.ore += ore;
  return ore;
}

function giveXp(ctx: Omit<Ctx, "combat">, xp: number, notes: string[]): void {
  for (const merc of ctx.run.mercs) {
    const amount = merc.hp > 0 ? xp : Math.round(xp / 2);
    for (const level of grantXp(merc, amount, stream(ctx.run, `perks:${merc.id}`))) {
      ctx.events.push({ type: "levelUp", mercId: merc.id, level });
      notes.push(`${merc.name} reached level ${level}!`);
    }
  }
}

function enterNode(ctx: Omit<Ctx, "combat">, node: MapNode): void {
  const { run } = ctx;
  run.currentNodeId = node.id;
  run.visited.push(node.id);
  run.votes = {};
  run.ready = [];
  ctx.events.push({ type: "node", nodeId: node.id, nodeType: node.type });
  changeLamp(ctx as Ctx, -LAMP_DRAIN_PER_NODE);
  const r = stream(run, "nodes");
  const reward = (title: string): RewardSummary => ({
    title,
    items: [],
    ore: 0,
    xp: 0,
    lamp: 0,
    notes: [],
  });

  switch (node.type) {
    case "combat":
    case "elite":
    case "boss": {
      const enemies =
        node.type === "boss"
          ? BOSS_ENCOUNTER
          : node.type === "elite"
            ? pick(r, ELITE_ENCOUNTERS)
            : pick(r, ENCOUNTERS[node.biome]);
      run.phase = "combat";
      run.stats.combats++;
      createCombat(ctx, enemies, node.type === "combat" ? "combat" : node.type, node.row);
      afterCombatStep(ctx as Ctx);
      return;
    }
    case "cache": {
      const rw = reward("Supply Cache");
      rw.items = dropLoot(ctx, 2);
      rw.ore = gainOre(run, rangeInt(r, 10, 25));
      rw.notes.push("An old-world supply cache, still sealed.");
      showReward(run, rw);
      return;
    }
    case "vein": {
      const rw = reward("Mineral Vein");
      rw.ore = gainOre(run, rangeInt(r, 45, 75) + node.row * 4);
      changeLamp(ctx as Ctx, -5);
      rw.lamp = -5;
      if (nextFloat(r) < 0.35) rw.items = dropLoot(ctx, 1);
      rw.notes.push("Mining in the dark burns lamp oil.");
      showReward(run, rw);
      return;
    }
    case "camp": {
      const rw = reward("Camp");
      for (const merc of run.mercs) {
        const max = computeStats(merc).maxHp;
        merc.hp = Math.min(max, Math.max(merc.hp, 0) + Math.round(max * 0.4));
      }
      changeLamp(ctx as Ctx, 20);
      rw.lamp = 20;
      rw.notes.push("The squad rests by the lamp. Everyone heals 40% and is back on their feet.");
      showReward(run, rw);
      return;
    }
    case "derelict": {
      const roll = nextFloat(r);
      if (roll < 0.3) {
        const enemies = pick(r, ENCOUNTERS[node.biome]);
        run.phase = "combat";
        run.stats.combats++;
        createCombat(ctx, enemies, "combat", node.row);
        afterCombatStep(ctx as Ctx);
        return;
      }
      const rw = reward("Derelict");
      if (roll < 0.75) {
        rw.items = dropLoot(ctx, 1, "rare");
        rw.notes.push("Among the wreckage: something valuable.");
      } else {
        for (const merc of run.mercs) {
          if (merc.hp > 0)
            merc.hp = Math.max(1, merc.hp - Math.round(computeStats(merc).maxHp * 0.12));
        }
        rw.ore = gainOre(run, 35);
        rw.notes.push("A booby-trap! Everyone is hurt, but the ore stash survived.");
      }
      showReward(run, rw);
      return;
    }
    case "start":
      run.phase = "map";
      return;
  }
}

function showReward(run: RunState, rw: RewardSummary): void {
  run.reward = rw;
  run.phase = "reward";
  run.ready = [];
}

/** Called after any combat step; wraps up the fight when it has ended. */
function afterCombatStep(ctx: Ctx): void {
  const { run } = ctx;
  const combat = run.combat;
  if (!combat?.result) return;
  // Copy HP back to the persistent mercs.
  for (const unit of combat.mercs) {
    const merc = run.mercs.find((m) => m.id === unit.id);
    if (merc) merc.hp = unit.downed ? 0 : unit.hp;
  }
  // Keep the formation the squad ended in.
  run.mercs = combat.mercs
    .map((u) => run.mercs.find((m) => m.id === u.id))
    .filter((m): m is Merc => m !== undefined);
  if (combat.result === "defeat") {
    run.phase = "defeat";
    return;
  }
  if (combat.kind === "boss") {
    run.phase = "victory";
    run.reward = {
      title: "The Lumen Eater falls",
      items: [],
      ore: gainOre(run, 150),
      xp: 0,
      lamp: 0,
      notes: ["The swallowed light spills out across the hollows. Your squad is rich — and alive."],
    };
    return;
  }
  const rw: RewardSummary = {
    title: combat.kind === "elite" ? "Elite defeated" : "Victory",
    items: [],
    ore: 0,
    xp: combat.xp,
    lamp: 0,
    notes: [],
  };
  // Downed mercs get back up after the fight.
  for (const merc of run.mercs) {
    if (merc.hp <= 0) {
      merc.hp = 1;
      rw.notes.push(`${merc.name} was downed and limps on at 1 HP.`);
    }
  }
  const r = stream(run, "nodes");
  rw.ore = gainOre(run, rangeInt(r, 8, 20) + (combat.kind === "elite" ? 30 : 0));
  const count = combat.kind === "elite" ? 2 : nextFloat(r) < 0.65 ? 1 : 2;
  rw.items = dropLoot(ctx, count, combat.kind === "elite" ? "rare" : undefined);
  giveXp(ctx, combat.xp, rw.notes);
  run.combat = null;
  showReward(run, rw);
}

function findMerc(run: RunState, mercId: string): Merc | undefined {
  return run.mercs.find((m) => m.id === mercId);
}

function ownedMerc(run: RunState, playerId: string, mercId: string): Merc | string {
  const merc = findMerc(run, mercId);
  if (!merc) return "Unknown mercenary.";
  if (merc.ownerId !== playerId) return "That mercenary belongs to another player.";
  return merc;
}

function clampHp(merc: Merc): void {
  const max = computeStats(merc).maxHp;
  merc.hp = Math.min(merc.hp, max);
}

/**
 * The single entry point for changing a run. Never mutates `prev`.
 */
export function applyRunCommand(
  prev: RunState,
  playerId: PlayerId,
  cmd: RunCommand,
): CommandResult {
  if (!prev.players.some((p) => p.id === playerId))
    return { ok: false, error: "You are not in this expedition." };
  if (prev.phase === "victory" || prev.phase === "defeat")
    return { ok: false, error: "The expedition is over." };
  const run = structuredClone(prev);
  const events: RunEvent[] = [];
  const base = { run, events };
  const error = handle(base, playerId, cmd);
  if (error) return { ok: false, error };
  run.version++;
  return { ok: true, state: run, events };
}

const OUT_OF_COMBAT: ReadonlySet<RunState["phase"]> = new Set(["map", "reward"]);

function handle(ctx: Omit<Ctx, "combat">, playerId: string, cmd: RunCommand): string | null {
  const { run } = ctx;
  switch (cmd.type) {
    case "vote": {
      if (run.phase !== "map") return "You can't choose a route right now.";
      if (!availableNodes(run).some((n) => n.id === cmd.nodeId))
        return "That path isn't reachable.";
      run.votes[playerId] = cmd.nodeId;
      ctx.events.push({ type: "vote", playerId, nodeId: cmd.nodeId });
      if (run.players.every((p) => run.votes[p.id])) {
        const tally = new Map<string, number>();
        for (const v of Object.values(run.votes)) tally.set(v, (tally.get(v) ?? 0) + 1);
        const top = Math.max(...tally.values());
        const winners = [...tally.entries()]
          .filter(([, c]) => c === top)
          .map(([id]) => id)
          .sort();
        const chosen = winners.length === 1 ? winners[0] : pick(stream(run, "vote"), winners);
        const node = run.nodes.find((n) => n.id === chosen);
        if (node) enterNode(ctx, node);
      }
      return null;
    }
    case "useSkill": {
      if (run.phase !== "combat" || !run.combat) return "There's no fight right now.";
      const c: Ctx = { ...ctx, combat: run.combat };
      const err = useSkill(c, playerId, cmd.unitId, cmd.skillId, cmd.targetId);
      if (err) return err;
      afterCombatStep(c);
      return null;
    }
    case "continue": {
      if (run.phase !== "reward") return "Nothing to continue.";
      if (!run.ready.includes(playerId)) run.ready.push(playerId);
      if (run.players.every((p) => run.ready.includes(p.id))) {
        run.reward = null;
        run.ready = [];
        run.phase = "map";
        if (currentNode(run).row >= MAP_ROWS - 1) run.phase = "victory";
      }
      return null;
    }
    case "equip": {
      if (!OUT_OF_COMBAT.has(run.phase)) return "You can't change gear mid-fight.";
      const merc = ownedMerc(run, playerId, cmd.mercId);
      if (typeof merc === "string") return merc;
      const idx = run.stash.findIndex((i) => i.uid === cmd.itemUid);
      const item = run.stash[idx];
      if (!item) return "That item isn't in the stash.";
      const blocker = canEquip(merc, item);
      if (blocker) return blocker;
      const slots = slotsFor(item.slot);
      const slot: EquipSlot =
        cmd.slot && slots.includes(cmd.slot)
          ? cmd.slot
          : (slots.find((s) => merc.equipment[s] === null) ?? (slots[0] as EquipSlot));
      const previous = merc.equipment[slot];
      if (slot === "weapon" && !previous) return "Weapons can only be swapped.";
      run.stash.splice(idx, 1);
      if (previous) run.stash.push(previous);
      const before = computeStats(merc).maxHp;
      merc.equipment[slot] = item;
      const after = computeStats(merc).maxHp;
      if (after > before && merc.hp > 0) merc.hp += after - before;
      clampHp(merc);
      return null;
    }
    case "unequip": {
      if (!OUT_OF_COMBAT.has(run.phase)) return "You can't change gear mid-fight.";
      const merc = ownedMerc(run, playerId, cmd.mercId);
      if (typeof merc === "string") return merc;
      if (cmd.slot === "weapon") return "A mercenary always keeps a weapon.";
      const item = merc.equipment[cmd.slot];
      if (!item) return "Nothing equipped there.";
      merc.equipment[cmd.slot] = null;
      run.stash.push(item);
      clampHp(merc);
      return null;
    }
    case "setSkills": {
      if (!OUT_OF_COMBAT.has(run.phase)) return "You can't change skills mid-fight.";
      const merc = ownedMerc(run, playerId, cmd.mercId);
      if (typeof merc === "string") return merc;
      const disc = getDiscipline(merc.discipline);
      const unique = [...new Set(cmd.skills)];
      if (unique.length !== 4 || !unique.every((s) => disc.skills.includes(s))) {
        return "Pick exactly four of your discipline's skills.";
      }
      merc.skills = validSkillLoadout(merc.discipline, unique);
      return null;
    }
    case "choosePerk": {
      if (!OUT_OF_COMBAT.has(run.phase)) return "Choose perks between fights.";
      const merc = ownedMerc(run, playerId, cmd.mercId);
      if (typeof merc === "string") return merc;
      const offer = merc.perkOffers[0];
      if (!offer?.includes(cmd.perkId)) return "That perk isn't on offer.";
      const before = computeStats(merc).maxHp;
      merc.perks.push(cmd.perkId);
      merc.perkOffers.shift();
      const after = computeStats(merc).maxHp;
      if (after > before && merc.hp > 0) merc.hp += after - before;
      clampHp(merc);
      return null;
    }
    case "swap": {
      if (!OUT_OF_COMBAT.has(run.phase)) return "Reposition during the fight with skills.";
      const a = run.mercs.findIndex((m) => m.id === cmd.mercA);
      const b = run.mercs.findIndex((m) => m.id === cmd.mercB);
      if (a < 0 || b < 0 || a === b) return "Pick two different mercenaries.";
      const ma = run.mercs[a] as Merc;
      const mb = run.mercs[b] as Merc;
      if (ma.ownerId !== playerId && mb.ownerId !== playerId)
        return "Move one of your own mercenaries.";
      run.mercs[a] = mb;
      run.mercs[b] = ma;
      return null;
    }
    case "refuel": {
      if (!OUT_OF_COMBAT.has(run.phase)) return "No time to refuel mid-fight.";
      if (run.ore < REFUEL_COST) return `Refueling costs ${REFUEL_COST} ore.`;
      if (run.lampCharge >= 100) return "The lamp is already full.";
      run.ore -= REFUEL_COST;
      changeLamp(ctx as Ctx, REFUEL_AMOUNT);
      return null;
    }
    default: {
      const never: never = cmd;
      return `Unknown command ${JSON.stringify(never)}`;
    }
  }
}

export interface LoggedCommand {
  playerId: PlayerId;
  command: RunCommand;
}

/** Rebuild a run from its options and command log (save format & desync tool). */
export function replayRun(opts: CreateRunOptions, log: readonly LoggedCommand[]): RunState {
  let run = createRun(opts);
  for (const [i, entry] of log.entries()) {
    const res = applyRunCommand(run, entry.playerId, entry.command);
    if (!res.ok) throw new Error(`Replay failed at ${i}: ${res.error}`);
    run = res.state;
  }
  return run;
}

export { advance };
