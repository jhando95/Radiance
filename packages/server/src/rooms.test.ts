import { CLASS_PRESETS, PROTOCOL_VERSION, type ServerMessage } from "@radiance/core";
import { beforeEach, describe, expect, it } from "vitest";
import { type Connection, ROOM_IDLE_TTL_MS, RoomManager } from "./rooms";

function client(): Connection & { inbox: ServerMessage[] } {
  const inbox: ServerMessage[] = [];
  return { inbox, peer: { send: (m) => inbox.push(m) } };
}

const last = <T extends ServerMessage["t"]>(c: { inbox: ServerMessage[] }, t: T) =>
  [...c.inbox].reverse().find((m) => m.t === t) as Extract<ServerMessage, { t: T }> | undefined;

const v = PROTOCOL_VERSION;
const merc = (d: keyof typeof CLASS_PRESETS) => CLASS_PRESETS[d] as NonNullable<(typeof CLASS_PRESETS)[string]>;

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
      now: () => now,
    });
  });

  function hostAndGuest() {
    const host = client();
    const guest = client();
    manager.handle(host, { t: "createRoom", v, name: "Host" });
    manager.handle(guest, { t: "joinRoom", v, code: "ROOM1", name: "Guest" });
    return { host, guest };
  }

  function ready(host: Connection, guest: Connection) {
    manager.handle(host, { t: "submitSquad", mercs: [merc("vanguard"), merc("gunner")] });
    manager.handle(guest, { t: "submitSquad", mercs: [merc("reaver"), merc("lamplighter")] });
  }

  it("splits the 4-merc squad between players", () => {
    const { host } = hostAndGuest();
    expect(last(host, "lobby")?.players.map((p) => p.slots)).toEqual([2, 2]);
  });

  it("requires each player to submit the right number of mercs", () => {
    const { host, guest } = hostAndGuest();
    manager.handle(guest, { t: "submitSquad", mercs: [merc("reaver")] });
    expect(last(guest, "error")?.message).toMatch(/exactly 2/);
    manager.handle(host, { t: "startGame" });
    expect(last(host, "error")?.message).toMatch(/Waiting/);
  });

  it("starts a shared run where each player owns their mercs", () => {
    const { host, guest } = hostAndGuest();
    ready(host, guest);
    manager.handle(guest, { t: "startGame" });
    expect(last(guest, "error")?.message).toMatch(/host/i);
    manager.handle(host, { t: "startGame" });
    const view = last(guest, "state")?.view;
    expect(view?.mercs.map((m) => m.ownerId)).toEqual(["p1", "p1", "p2", "p2"]);
    expect(view?.viewerId).toBe("p2");
    expect(JSON.stringify(view)).not.toContain('"rng"');
  });

  it("routes votes and needs everyone to agree before moving", () => {
    const { host, guest } = hostAndGuest();
    ready(host, guest);
    manager.handle(host, { t: "startGame" });
    const node = last(host, "state")?.view.available[0] as string;
    manager.handle(host, { t: "command", command: { type: "vote", nodeId: node } });
    expect(last(guest, "state")?.view.phase).toBe("map");
    manager.handle(guest, { t: "command", command: { type: "vote", nodeId: node } });
    expect(last(guest, "state")?.view.phase).toBe("combat");
  });

  it("rejects illegal commands", () => {
    const { host, guest } = hostAndGuest();
    ready(host, guest);
    manager.handle(host, { t: "startGame" });
    manager.handle(host, { t: "command", command: { type: "vote", nodeId: "n8_0" } });
    expect(last(host, "error")).toBeDefined();
  });

  it("lets a disconnected player rejoin a running expedition", () => {
    const { host, guest } = hostAndGuest();
    ready(host, guest);
    manager.handle(host, { t: "startGame" });
    const token = last(guest, "welcome")?.token as string;
    manager.disconnect(guest);
    expect(last(host, "lobby")?.players.find((p) => p.id === "p2")?.connected).toBe(false);
    const back = client();
    manager.handle(back, { t: "rejoin", v, code: "ROOM1", token });
    expect(last(back, "state")?.view.viewerId).toBe("p2");
  });

  it("frees the seat if someone leaves before departure", () => {
    const { host, guest } = hostAndGuest();
    manager.disconnect(guest);
    expect(last(host, "lobby")?.players).toHaveLength(1);
    expect(last(host, "lobby")?.players[0]?.slots).toBe(4);
  });

  it("caps rooms at four players and blocks late joins", () => {
    const { host, guest } = hostAndGuest();
    manager.handle(client(), { t: "joinRoom", v, code: "ROOM1", name: "C" });
    manager.handle(client(), { t: "joinRoom", v, code: "ROOM1", name: "D" });
    const fifth = client();
    manager.handle(fifth, { t: "joinRoom", v, code: "ROOM1", name: "E" });
    expect(last(fifth, "error")?.message).toMatch(/full/);
    void host;
    void guest;
  });

  it("sweeps idle rooms", () => {
    const { host, guest } = hostAndGuest();
    ready(host, guest);
    manager.handle(host, { t: "startGame" });
    manager.disconnect(host);
    manager.disconnect(guest);
    now += ROOM_IDLE_TTL_MS + 1;
    expect(manager.sweep()).toBe(1);
  });
});
