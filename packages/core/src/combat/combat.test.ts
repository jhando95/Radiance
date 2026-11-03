import { describe, expect, it } from "vitest";
import { getCard } from "../content";
import { runCombatWithBots } from "../sim/simulate";
import type { CombatState, Command, PlayerState } from "../types";
import { applyCommand, canPlayCard, createCombat, type LoggedCommand, replay } from "./combat";
import { viewFor } from "./view";

const duo = () =>
  createCombat({
    seed: "test-seed",
    encounterId: "gloomPack",
    players: [
      { id: "p1", name: "Ada", classId: "warden" },
      { id: "p2", name: "Bo", classId: "seeker" },
    ],
  });

function ok(state: CombatState, playerId: string, cmd: Command): CombatState {
  const result = applyCommand(state, playerId, cmd);
  if (!result.ok) throw new Error(result.error);
  return result.state;
}

const player = (s: CombatState, id: string) => s.players.find((p) => p.id === id) as PlayerState;

describe("createCombat", () => {
  it("deals an opening hand and sets intents", () => {
    const s = duo();
    expect(s.turn).toBe(1);
    for (const p of s.players) {
      expect(p.hand).toHaveLength(5);
      expect(p.energy).toBe(3);
      expect(p.drawPile.length + p.hand.length).toBe(10);
    }
    for (const e of s.enemies) expect(e.intent).not.toBeNull();
  });

  it("is deterministic", () => {
    expect(duo()).toEqual(duo());
  });

  it("scales enemy HP with party size", () => {
    const solo = createCombat({
      seed: "x",
      encounterId: "sentinel",
      players: [{ id: "p1", name: "A", classId: "warden" }],
    });
    const quad = createCombat({
      seed: "x",
      encounterId: "sentinel",
      players: ["p1", "p2", "p3", "p4"].map((id) => ({ id, name: id, classId: "warden" })),
    });
    expect(quad.enemies[0]?.maxHp).toBeGreaterThan(solo.enemies[0]?.maxHp ?? 0);
  });

  it("rejects empty and oversized parties", () => {
    expect(() => createCombat({ seed: "x", encounterId: "sentinel", players: [] })).toThrow();
    const five = ["a", "b", "c", "d", "e"].map((id) => ({ id, name: id, classId: "warden" }));
    expect(() => createCombat({ seed: "x", encounterId: "sentinel", players: five })).toThrow();
  });
});

describe("applyCommand", () => {
  it("never mutates the previous state", () => {
    const s = duo();
    const snapshot = JSON.stringify(s);
    ok(s, "p1", { type: "endTurn" });
    expect(JSON.stringify(s)).toBe(snapshot);
  });

  it("plays an attack: spends energy, damages, discards", () => {
    let s = duo();
    player(s, "p1").hand.push({ uid: 500, defId: "strike" });
    const enemy = s.enemies[0];
    if (!enemy) throw new Error("no enemy");
    const before = enemy.hp;
    s = ok(s, "p1", { type: "playCard", cardUid: 500, targetId: enemy.id });
    expect(player(s, "p1").energy).toBe(2);
    expect(s.enemies[0]?.hp).toBe(before - 6);
    expect(player(s, "p1").discardPile.map((c) => c.uid)).toContain(500);
  });

  it("ally-targeted cards can shield a teammate", () => {
    let s = duo();
    player(s, "p1").hand.push({ uid: 501, defId: "interpose" });
    s = ok(s, "p1", { type: "playCard", cardUid: 501, targetId: "p2" });
    expect(player(s, "p2").block).toBe(8);
    expect(player(s, "p1").block).toBe(0);
  });

  it("rejects playing a card that isn't in your hand", () => {
    const s = duo();
    const p2card = player(s, "p2").hand[0];
    if (!p2card) throw new Error("empty hand");
    const result = applyCommand(s, "p1", { type: "playCard", cardUid: p2card.uid });
    expect(result.ok).toBe(false);
  });

  it("requires a valid target for targeted cards", () => {
    const s = duo();
    player(s, "p1").hand.push({ uid: 502, defId: "strike" });
    expect(canPlayCard(s, "p1", 502, undefined)).toBe("Choose an enemy target.");
    expect(canPlayCard(s, "p1", 502, "nonsense")).toBe("Choose an enemy target.");
    expect(canPlayCard(s, "p1", 502, "p2")).toBe("Choose an enemy target.");
    expect(canPlayCard(s, "p1", 502, "e1")).toBeNull();
  });

  it("waits for every active player before enemies act", () => {
    let s = duo();
    s = ok(s, "p1", { type: "endTurn" });
    expect(s.turn).toBe(1);
    expect(applyCommand(s, "p1", { type: "endTurn" }).ok).toBe(false);
    s = ok(s, "p1", { type: "cancelEndTurn" });
    s = ok(s, "p1", { type: "endTurn" });
    const result = applyCommand(s, "p2", { type: "endTurn" });
    if (!result.ok) throw new Error(result.error);
    expect(result.state.turn).toBe(2);
    expect(result.events.some((e) => e.type === "enemyMove")).toBe(true);
    for (const p of result.state.players) {
      expect(p.ready).toBe(false);
      expect(p.energy).toBe(p.maxEnergy);
    }
  });

  it("radiance is a shared pool that gates radiance-cost cards", () => {
    let s = duo();
    s.players[1]?.hand.push({ uid: 999, defId: "sunburst" });
    expect(canPlayCard(s, "p2", 999)).toBe("Not enough Radiance.");
    s = structuredClone(s);
    s.radiance = 5;
    s = ok(s, "p2", { type: "playCard", cardUid: 999 });
    expect(s.radiance).toBe(2);
  });

  it("increments version on every accepted command", () => {
    const s = duo();
    const next = ok(s, "p1", { type: "endTurn" });
    expect(next.version).toBe(s.version + 1);
  });
});

describe("viewFor", () => {
  it("strips RNG state and hides veiled intents", () => {
    const s = createCombat({
      seed: "veil",
      encounterId: "sentinel",
      players: [{ id: "p1", name: "A", classId: "seeker" }],
    });
    const view = viewFor(s, "p1");
    expect("rng" in view).toBe(false);
    expect(JSON.stringify(view)).not.toContain('"rng"');
    expect(view.enemies[0]?.intent).toBeNull();
    expect(view.enemies[0]?.intentHidden).toBe(true);
  });
});

describe("determinism (the co-op contract)", () => {
  it("replaying a command log reproduces the exact same state", () => {
    const opts = {
      seed: "replay-me",
      encounterId: "shadeAmbush",
      players: [
        { id: "p1", name: "A", classId: "warden" },
        { id: "p2", name: "B", classId: "seeker" },
      ],
    };
    // Record a bot game's commands, then replay them.
    const log: LoggedCommand[] = [];
    let s = createCombat(opts);
    for (let i = 0; i < 400 && s.phase === "player"; i++) {
      const actor = s.players.find((p) => !p.downed && !p.ready);
      if (!actor) break;
      const playable = actor.hand.find(
        (c) => canPlayCard(s, actor.id, c.uid, s.enemies.find((e) => e.hp > 0)?.id) === null,
      );
      const command: Command = playable
        ? {
            type: "playCard",
            cardUid: playable.uid,
            targetId:
              getCard(playable.defId).targeting === "ally"
                ? actor.id
                : s.enemies.find((e) => e.hp > 0)?.id,
          }
        : { type: "endTurn" };
      const result = applyCommand(s, actor.id, command);
      if (!result.ok) continue;
      log.push({ playerId: actor.id, command });
      s = result.state;
    }
    expect(log.length).toBeGreaterThan(10);
    expect(replay(opts, log)).toEqual(s);
  });

  it("bot combats finish and are reproducible", () => {
    for (const seed of ["a", "b", "c", "d", "e"]) {
      const first = runCombatWithBots(seed, "sentinel", ["warden", "seeker"]);
      const second = runCombatWithBots(seed, "sentinel", ["warden", "seeker"]);
      expect(first.state.phase).not.toBe("player");
      expect(second.state).toEqual(first.state);
    }
  });
});
