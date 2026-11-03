import { describe, expect, it } from "vitest";
import { advance } from "../combat/flow";
import { getSkill } from "../content";
import { createMerc } from "../merc";
import { defaultSquad, simulateRun } from "../sim/simulate";
import type { RunState } from "../types";
import { applyRunCommand, availableNodes, createRun, replayRun, slotsForPlayers } from "./run";
import { viewFor } from "./view";

const opts = (players = 1) => {
  const ids = Array.from({ length: players }, (_, i) => `p${i + 1}`);
  const owners = slotsForPlayers(players).flatMap((n, i) =>
    Array<string>(n).fill(ids[i] as string),
  );
  return {
    seed: "test-seed",
    players: ids.map((id) => ({ id, name: id })),
    mercs: defaultSquad().map((setup, i) => ({ ownerId: owners[i] as string, setup })),
  };
};

function ok(run: RunState, pid: string, cmd: Parameters<typeof applyRunCommand>[2]): RunState {
  const res = applyRunCommand(run, pid, cmd);
  if (!res.ok) throw new Error(res.error);
  return res.state;
}

describe("createRun", () => {
  it("is deterministic and starts on the map with a 4-merc squad", () => {
    const a = createRun(opts());
    expect(a).toEqual(createRun(opts()));
    expect(a.phase).toBe("map");
    expect(a.mercs).toHaveLength(4);
    expect(availableNodes(a).length).toBeGreaterThan(0);
    expect(a.mercs.filter((m) => m.equipment.lamp)).toHaveLength(1);
  });

  it("splits the squad between players", () => {
    expect(slotsForPlayers(1)).toEqual([4]);
    expect(slotsForPlayers(2)).toEqual([2, 2]);
    expect(slotsForPlayers(3)).toEqual([2, 1, 1]);
    expect(slotsForPlayers(4)).toEqual([1, 1, 1, 1]);
  });
});

describe("map voting", () => {
  it("waits for every player before moving", () => {
    let run = createRun(opts(2));
    const target = availableNodes(run)[0]?.id as string;
    run = ok(run, "p1", { type: "vote", nodeId: target });
    expect(run.phase).toBe("map");
    run = ok(run, "p2", { type: "vote", nodeId: target });
    expect(run.currentNodeId).toBe(target);
    expect(run.phase).toBe("combat"); // row 1 is always a fight
  });

  it("rejects unreachable nodes", () => {
    const run = createRun(opts());
    expect(applyRunCommand(run, "p1", { type: "vote", nodeId: "n8_0" }).ok).toBe(false);
  });
});

describe("combat", () => {
  function inCombat(): RunState {
    const run = createRun(opts());
    return ok(run, "p1", { type: "vote", nodeId: availableNodes(run)[0]?.id as string });
  }

  it("pauses on a merc's turn and enforces rank requirements", () => {
    const run = inCombat();
    const combat = run.combat;
    if (!combat) throw new Error("no combat");
    expect(combat.active).toMatch(/^m/);
    const active = combat.mercs.find((m) => m.id === combat.active);
    if (!active) throw new Error("no active");
    const target = combat.enemies[0]?.id;
    // The gunner (rank 3) can't use Point Blank-style rank 1 skills; find a skill with bad rank.
    const rank = combat.mercs.indexOf(active) + 1;
    const badSkill = active.skills.find((s) => !(getSkill(s).from as number[]).includes(rank));
    if (badSkill) {
      const res = applyRunCommand(run, "p1", {
        type: "useSkill",
        unitId: active.id,
        skillId: badSkill,
        targetId: target,
      });
      expect(res.ok).toBe(false);
    }
    const res = applyRunCommand(run, "p1", {
      type: "useSkill",
      unitId: active.id,
      skillId: "wait",
    });
    expect(res.ok).toBe(true);
  });

  it("rejects commands for another player's mercenary", () => {
    let run = createRun(opts(2));
    const node = availableNodes(run)[0]?.id as string;
    run = ok(run, "p1", { type: "vote", nodeId: node });
    run = ok(run, "p2", { type: "vote", nodeId: node });
    const active = run.combat?.mercs.find((m) => m.id === run.combat?.active);
    if (!active) throw new Error("no active");
    const other = active.ownerId === "p1" ? "p2" : "p1";
    const res = applyRunCommand(run, other, {
      type: "useSkill",
      unitId: active.id,
      skillId: "wait",
    });
    expect(res.ok).toBe(false);
  });

  it("puts used skills on cooldown", () => {
    let run = inCombat();
    for (let i = 0; i < 40 && run.phase === "combat"; i++) {
      const c = run.combat as NonNullable<RunState["combat"]>;
      const unit = c.mercs.find((m) => m.id === c.active);
      if (!unit) break;
      const cdSkill = unit.skills.find(
        (s) => getSkill(s).cooldown > 0 && getSkill(s).target.side === "self",
      );
      if (cdSkill && (getSkill(cdSkill).from as number[]).includes(c.mercs.indexOf(unit) + 1)) {
        run = ok(run, "p1", { type: "useSkill", unitId: unit.id, skillId: cdSkill });
        const after = run.combat?.mercs.find((m) => m.id === unit.id);
        expect(after?.cooldowns[cdSkill]).toBeGreaterThan(0);
        return;
      }
      run = ok(run, "p1", { type: "useSkill", unitId: unit.id, skillId: "wait" });
    }
  });

  it("hides unlit enemies' health in the client view", () => {
    const run = inCombat();
    if (!run.combat) throw new Error("no combat");
    // Snuff the light: no lamp.
    const dark = structuredClone(run);
    for (const m of dark.combat?.mercs ?? []) m.stats.lightRadius = 0;
    const view = viewFor(dark, "p1");
    expect(view.combat?.lightRadius).toBe(0);
    expect(view.combat?.enemies.every((e) => e.hidden && e.hp === -1)).toBe(true);
    expect(JSON.stringify(view)).not.toContain('"rng"');
  });
});

describe("gear and builds", () => {
  it("equips stash items and enforces weapon discipline", () => {
    let run = createRun(opts());
    const trinket = run.stash.find(
      (i) => i.slot === "trinket" || i.slot === "armor" || i.slot === "lamp",
    );
    if (trinket) {
      run = ok(run, "p1", { type: "equip", mercId: "m1", itemUid: trinket.uid });
      expect(run.stash.some((i) => i.uid === trinket.uid)).toBe(false);
    }
    // Give the vanguard a rifle: must fail.
    const rifle = createMerc(
      defaultSquad(["gunner"])[0] as never,
      "x",
      "p1",
      { next: () => 999 },
      false,
    ).equipment.weapon;
    if (!rifle) throw new Error("no rifle");
    run = structuredClone(run);
    run.stash.push(rifle);
    expect(applyRunCommand(run, "p1", { type: "equip", mercId: "m1", itemUid: 999 }).ok).toBe(
      false,
    );
  });

  it("validates skill loadouts", () => {
    const run = createRun(opts());
    expect(
      applyRunCommand(run, "p1", {
        type: "setSkills",
        mercId: "m1",
        skills: ["rend", "flurry", "execute", "lunge"],
      }).ok,
    ).toBe(false);
    expect(
      applyRunCommand(run, "p1", {
        type: "setSkills",
        mercId: "m1",
        skills: ["shieldBash", "provoke", "rallyCry", "bulwark"],
      }).ok,
    ).toBe(true);
  });
});

describe("full expeditions (bots)", () => {
  it("bots finish runs for 1-4 players without invalid commands", () => {
    for (let i = 0; i < 8; i++) {
      const res = simulateRun(`suite-${i}`, 1 + (i % 4));
      expect(["victory", "defeat"]).toContain(res.phase);
    }
  });

  it("replaying the command log reproduces the run exactly", () => {
    const res = simulateRun("replay-check", 2);
    const players = 2;
    const ids = ["p1", "p2"];
    const owners = slotsForPlayers(players).flatMap((n, i) =>
      Array<string>(n).fill(ids[i] as string),
    );
    const replayed = replayRun(
      {
        seed: "replay-check",
        players: ids.map((id) => ({ id, name: id })),
        mercs: defaultSquad().map((setup, i) => ({ ownerId: owners[i] as string, setup })),
      },
      res.log,
    );
    expect(replayed).toEqual(res.state);
  });

  it("advance() is exported for engine tooling", () => {
    expect(typeof advance).toBe("function");
  });
});
