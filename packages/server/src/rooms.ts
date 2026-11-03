import {
  applyCommand,
  type ClientMessage,
  type CombatEvent,
  type CombatState,
  createCombat,
  ENCOUNTERS,
  type LobbyPlayer,
  type LoggedCommand,
  MAX_PLAYERS,
  type ServerMessage,
  viewFor,
} from "@radiance/core";

/** Anything that can receive server messages (a WebSocket in prod, an array in tests). */
export interface Peer {
  send(msg: ServerMessage): void;
}

/** Per-socket session; tracks which room/player the socket is bound to. */
export interface Connection {
  peer: Peer;
  roomCode?: string;
  playerId?: string;
}

interface Member {
  id: string;
  name: string;
  classId: string;
  token: string;
  conn: Connection | null;
}

interface Room {
  code: string;
  hostId: string;
  members: Member[];
  combat: CombatState | null;
  /** Seed + log fully reproduces the combat (save files, desync reports). */
  log: LoggedCommand[];
  nextPlayerNum: number;
  emptySince: number | null;
}

export interface RoomDeps {
  makeCode(): string;
  makeToken(): string;
  makeSeed(): string;
  /** Picks which encounter to start next. Replaced by the run/map system in M2. */
  pickEncounter(seed: string): string;
  now(): number;
}

export const ROOM_IDLE_TTL_MS = 10 * 60 * 1000;

export class RoomManager {
  private readonly rooms = new Map<string, Room>();

  constructor(private readonly deps: RoomDeps) {}

  get roomCount(): number {
    return this.rooms.size;
  }

  handle(conn: Connection, msg: ClientMessage): void {
    switch (msg.t) {
      case "createRoom": {
        if (conn.roomCode) {
          this.fail(conn, "Already in a room.");
          return;
        }
        let code = this.deps.makeCode();
        while (this.rooms.has(code)) code = this.deps.makeCode();
        const room: Room = {
          code,
          hostId: "",
          members: [],
          combat: null,
          log: [],
          nextPlayerNum: 1,
          emptySince: null,
        };
        this.rooms.set(code, room);
        const member = this.addMember(room, conn, msg.name, msg.classId);
        room.hostId = member.id;
        this.broadcastLobby(room);
        return;
      }
      case "joinRoom": {
        if (conn.roomCode) {
          this.fail(conn, "Already in a room.");
          return;
        }
        const room = this.rooms.get(msg.code);
        if (!room) {
          this.fail(conn, "Room not found.");
          return;
        }
        if (room.combat) {
          this.fail(conn, "That game has already started.");
          return;
        }
        if (room.members.length >= MAX_PLAYERS) {
          this.fail(conn, "Room is full.");
          return;
        }
        this.addMember(room, conn, msg.name, msg.classId);
        this.broadcastLobby(room);
        return;
      }
      case "rejoin": {
        const room = this.rooms.get(msg.code);
        const member = room?.members.find((m) => m.token === msg.token);
        if (!room || !member) {
          this.fail(conn, "Could not rejoin that room.");
          return;
        }
        if (member.conn && member.conn !== conn) {
          member.conn.peer.send({ t: "error", message: "Signed in from another tab." });
          member.conn.roomCode = undefined;
          member.conn.playerId = undefined;
        }
        member.conn = conn;
        conn.roomCode = room.code;
        conn.playerId = member.id;
        room.emptySince = null;
        conn.peer.send({ t: "welcome", code: room.code, playerId: member.id, token: member.token });
        this.broadcastLobby(room);
        if (room.combat) this.sendState(room, member, []);
        return;
      }
      case "setClass": {
        const { room, member } = this.context(conn);
        if (!room || !member) {
          this.fail(conn, "Not in a room.");
          return;
        }
        if (room.combat) {
          this.fail(conn, "Can't change class mid-game.");
          return;
        }
        member.classId = msg.classId;
        this.broadcastLobby(room);
        return;
      }
      case "startGame": {
        const { room, member } = this.context(conn);
        if (!room || !member) {
          this.fail(conn, "Not in a room.");
          return;
        }
        if (member.id !== room.hostId) {
          this.fail(conn, "Only the host can start.");
          return;
        }
        if (room.combat && room.combat.phase === "player") {
          this.fail(conn, "A combat is in progress.");
          return;
        }
        const seed = this.deps.makeSeed();
        room.combat = createCombat({
          seed,
          encounterId: this.deps.pickEncounter(seed),
          players: room.members.map(({ id, name, classId }) => ({ id, name, classId })),
        });
        room.log = [];
        this.broadcastLobby(room);
        for (const m of room.members) this.sendState(room, m, []);
        return;
      }
      case "command": {
        const { room, member } = this.context(conn);
        if (!room?.combat || !member) {
          this.fail(conn, "No game in progress.");
          return;
        }
        const result = applyCommand(room.combat, member.id, msg.command);
        if (!result.ok) {
          this.fail(conn, result.error);
          return;
        }
        room.combat = result.state;
        room.log.push({ playerId: member.id, command: msg.command });
        for (const m of room.members) this.sendState(room, m, result.events);
        return;
      }
      default: {
        const exhaustive: never = msg;
        this.fail(conn, `Unhandled message ${JSON.stringify(exhaustive)}`);
      }
    }
  }

  disconnect(conn: Connection): void {
    const { room, member } = this.context(conn);
    if (!room || !member || member.conn !== conn) return;
    member.conn = null;
    if (room.members.every((m) => m.conn === null)) room.emptySince = this.deps.now();
    this.broadcastLobby(room);
  }

  /** Remove rooms that have had nobody connected for longer than the TTL. */
  sweep(): number {
    let removed = 0;
    for (const [code, room] of this.rooms) {
      if (room.emptySince !== null && this.deps.now() - room.emptySince > ROOM_IDLE_TTL_MS) {
        this.rooms.delete(code);
        removed++;
      }
    }
    return removed;
  }

  private addMember(room: Room, conn: Connection, name: string, classId: string): Member {
    const member: Member = {
      id: `p${room.nextPlayerNum++}`,
      name,
      classId,
      token: this.deps.makeToken(),
      conn,
    };
    room.members.push(member);
    room.emptySince = null;
    conn.roomCode = room.code;
    conn.playerId = member.id;
    conn.peer.send({ t: "welcome", code: room.code, playerId: member.id, token: member.token });
    return member;
  }

  private context(conn: Connection): { room?: Room; member?: Member } {
    const room = conn.roomCode ? this.rooms.get(conn.roomCode) : undefined;
    const member = room?.members.find((m) => m.id === conn.playerId);
    return { room, member };
  }

  private broadcastLobby(room: Room): void {
    const players: LobbyPlayer[] = room.members.map((m) => ({
      id: m.id,
      name: m.name,
      classId: m.classId,
      connected: m.conn !== null,
    }));
    const msg: ServerMessage = {
      t: "lobby",
      code: room.code,
      hostId: room.hostId,
      players,
      started: room.combat !== null,
    };
    for (const m of room.members) m.conn?.peer.send(msg);
  }

  private sendState(room: Room, member: Member, events: CombatEvent[]): void {
    if (!room.combat || !member.conn) return;
    member.conn.peer.send({ t: "state", view: viewFor(room.combat, member.id), events });
  }

  private fail(conn: Connection, message: string): void {
    conn.peer.send({ t: "error", message });
  }
}

export function defaultPickEncounter(seed: string): string {
  const ids = Object.keys(ENCOUNTERS);
  let h = 0;
  for (const ch of seed) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return ids[h % ids.length] as string;
}
