import { type ClientMessage, PROTOCOL_VERSION, type ServerMessage } from "@radiance/core";
import { beforeEach, describe, expect, it } from "vitest";
import { type Connection, ROOM_IDLE_TTL_MS, RoomManager } from "./rooms";

function client(): Connection & { inbox: ServerMessage[] } {
  const inbox: ServerMessage[] = [];
  return { inbox, peer: { send: (m) => inbox.push(m) } };
}

const last = <T extends ServerMessage["t"]>(c: { inbox: ServerMessage[] }, t: T) =>
  [...c.inbox].reverse().find((m) => m.t === t) as Extract<ServerMessage, { t: T }> | undefined;

const v = PROTOCOL_VERSION;

describe("RoomManager", () => {
  let now = 0;
  let manager: RoomManager;
  let n = 0;

  beforeEach(() => {
    now = 0;
    n = 0;
    manager = new RoomManager({
      makeCode: () => "ROOM1",
      makeToken: () => `token-${++n}-xxxxxxxxxxxxxxxx`,
      makeSeed: () => "fixed-seed",
      pickEncounter: () => "gloomPack",
      now: () => now,
    });
  });

  function hostAndGuest() {
    const host = client();
    const guest = client();
    manager.handle(host, { t: "createRoom", v, name: "Host", classId: "warden" });
    manager.handle(guest, { t: "joinRoom", v, code: "ROOM1", name: "Guest", classId: "seeker" });
    return { host, guest };
  }

  it("creates a room and lets a friend join by code", () => {
    const { host, guest } = hostAndGuest();
    expect(last(host, "welcome")?.playerId).toBe("p1");
    expect(last(guest, "welcome")?.playerId).toBe("p2");
    expect(last(host, "lobby")?.players.map((p) => p.name)).toEqual(["Host", "Guest"]);
  });

  it("only the host can start", () => {
    const { host, guest } = hostAndGuest();
    manager.handle(guest, { t: "startGame" });
    expect(last(guest, "error")?.message).toMatch(/host/i);
    manager.handle(host, { t: "startGame" });
    expect(last(guest, "state")?.view.players).toHaveLength(2);
  });

  it("applies commands authoritatively and broadcasts redacted state to everyone", () => {
    const { host, guest } = hostAndGuest();
    manager.handle(host, { t: "startGame" });
    manager.handle(host, { t: "command", command: { type: "endTurn" } });
    const view = last(guest, "state")?.view;
    expect(view?.viewerId).toBe("p2");
    expect(view?.players.find((p) => p.id === "p1")?.ready).toBe(true);
    expect(JSON.stringify(view)).not.toContain('"rng"');
  });

  it("rejects illegal commands without changing state", () => {
    const { host } = hostAndGuest();
    manager.handle(host, { t: "startGame" });
    const before = last(host, "state")?.view.version;
    manager.handle(host, { t: "command", command: { type: "playCard", cardUid: 9999 } });
    expect(last(host, "error")).toBeDefined();
    expect(last(host, "state")?.view.version).toBe(before);
  });

  it("lets a disconnected player rejoin with their token", () => {
    const { host, guest } = hostAndGuest();
    manager.handle(host, { t: "startGame" });
    const token = last(guest, "welcome")?.token as string;
    manager.disconnect(guest);
    expect(last(host, "lobby")?.players.find((p) => p.id === "p2")?.connected).toBe(false);

    const reconnected = client();
    const msg: ClientMessage = { t: "rejoin", v, code: "ROOM1", token };
    manager.handle(reconnected, msg);
    expect(last(reconnected, "welcome")?.playerId).toBe("p2");
    expect(last(reconnected, "state")?.view.viewerId).toBe("p2");
  });

  it("blocks joining after the game started", () => {
    const { host } = hostAndGuest();
    manager.handle(host, { t: "startGame" });
    const late = client();
    manager.handle(late, { t: "joinRoom", v, code: "ROOM1", name: "Late", classId: "warden" });
    expect(last(late, "error")?.message).toMatch(/started/);
  });

  it("caps rooms at four players", () => {
    hostAndGuest();
    for (const name of ["C", "D"]) {
      manager.handle(client(), { t: "joinRoom", v, code: "ROOM1", name, classId: "warden" });
    }
    const fifth = client();
    manager.handle(fifth, { t: "joinRoom", v, code: "ROOM1", name: "E", classId: "warden" });
    expect(last(fifth, "error")?.message).toMatch(/full/);
  });

  it("sweeps rooms that stay empty past the TTL", () => {
    const { host, guest } = hostAndGuest();
    manager.disconnect(host);
    manager.disconnect(guest);
    now += ROOM_IDLE_TTL_MS + 1;
    expect(manager.sweep()).toBe(1);
    expect(manager.roomCount).toBe(0);
  });
});
