import {
  applyRunCommand,
  type ClientMessage,
  createRun,
  type LobbyPlayer,
  type LoggedCommand,
  type MercSetup,
  type RunEvent,
  type RunState,
  type ServerMessage,
  SQUAD_SIZE,
  slotsForPlayers,
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
  token: string;
  conn: Connection | null;
  squad: MercSetup[] | null;
}

interface Room {
  code: string;
  hostId: string;
  members: Member[];
  run: RunState | null;
  /** Seed + setups + log fully reproduce the run (saves, desync reports). */
  log: LoggedCommand[];
  nextPlayerNum: number;
  emptySince: number | null;
}

export interface RoomDeps {
  makeCode(): string;
  makeToken(): string;
  makeSeed(): string;
  now(): number;
}

export const ROOM_IDLE_TTL_MS = 15 * 60 * 1000;
export const MAX_PLAYERS = SQUAD_SIZE;

export class RoomManager {
  private readonly rooms = new Map<string, Room>();

  constructor(private readonly deps: RoomDeps) {}

  get roomCount(): number {
    return this.rooms.size;
  }

  handle(conn: Connection, msg: ClientMessage): void {
    switch (msg.t) {
      case "createRoom": {
        if (conn.roomCode) return this.fail(conn, "Already in a room.");
        let code = this.deps.makeCode();
        while (this.rooms.has(code)) code = this.deps.makeCode();
        const room: Room = {
          code,
          hostId: "",
          members: [],
          run: null,
          log: [],
          nextPlayerNum: 1,
          emptySince: null,
        };
        this.rooms.set(code, room);
        room.hostId = this.addMember(room, conn, msg.name).id;
        this.broadcastLobby(room);
        return;
      }
      case "joinRoom": {
        if (conn.roomCode) return this.fail(conn, "Already in a room.");
        const room = this.rooms.get(msg.code);
        if (!room) return this.fail(conn, "Room not found.");
        if (room.run) return this.fail(conn, "That expedition has already left.");
        if (room.members.length >= MAX_PLAYERS) return this.fail(conn, "Room is full.");
        this.addMember(room, conn, msg.name);
        this.resetMismatchedSquads(room);
        this.broadcastLobby(room);
        return;
      }
      case "rejoin": {
        const room = this.rooms.get(msg.code);
        const member = room?.members.find((m) => m.token === msg.token);
        if (!room || !member) return this.fail(conn, "Could not rejoin that room.");
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
        if (room.run) this.sendState(room, member, []);
        return;
      }
      case "submitSquad": {
        const { room, member } = this.context(conn);
        if (!room || !member) return this.fail(conn, "Not in a room.");
        if (room.run) return this.fail(conn, "The expedition has already left.");
        const slots = this.slotsOf(room, member);
        if (msg.mercs.length !== slots) return this.fail(conn, `Create exactly ${slots} mercenaries.`);
        member.squad = msg.mercs as MercSetup[];
        this.broadcastLobby(room);
        return;
      }
      case "startGame": {
        const { room, member } = this.context(conn);
        if (!room || !member) return this.fail(conn, "Not in a room.");
        if (member.id !== room.hostId) return this.fail(conn, "Only the host can start.");
        if (room.run) return this.fail(conn, "Already started.");
        const notReady = room.members.filter((m) => m.squad?.length !== this.slotsOf(room, m));
        if (notReady.length) {
          return this.fail(conn, `Waiting for ${notReady.map((m) => m.name).join(", ")}.`);
        }
        room.run = createRun({
          seed: this.deps.makeSeed(),
          players: room.members.map(({ id, name }) => ({ id, name })),
          mercs: room.members.flatMap((m) => (m.squad ?? []).map((setup) => ({ ownerId: m.id, setup }))),
        });
        room.log = [];
        this.broadcastLobby(room);
        for (const m of room.members) this.sendState(room, m, []);
        return;
      }
      case "command": {
        const { room, member } = this.context(conn);
        if (!room?.run || !member) return this.fail(conn, "No expedition in progress.");
        const result = applyRunCommand(room.run, member.id, msg.command);
        if (!result.ok) return this.fail(conn, result.error);
        room.run = result.state;
        room.log.push({ playerId: member.id, command: msg.command });
        for (const m of room.members) this.sendState(room, m, result.events);
        return;
      }
      default: {
        const never: never = msg;
        this.fail(conn, `Unhandled message ${JSON.stringify(never)}`);
      }
    }
  }

  disconnect(conn: Connection): void {
    const { room, member } = this.context(conn);
    if (!room || !member || member.conn !== conn) return;
    member.conn = null;
    if (!room.run) {
      // Before departure, leaving frees the seat.
      room.members = room.members.filter((m) => m !== member);
      if (room.hostId === member.id && room.members[0]) room.hostId = room.members[0].id;
      this.resetMismatchedSquads(room);
    }
    if (room.members.every((m) => m.conn === null)) room.emptySince = this.deps.now();
    if (room.members.length === 0) this.rooms.delete(room.code);
    else this.broadcastLobby(room);
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

  private slotsOf(room: Room, member: Member): number {
    const slots = slotsForPlayers(room.members.length);
    return slots[room.members.indexOf(member)] ?? 0;
  }

  private resetMismatchedSquads(room: Room): void {
    for (const m of room.members) {
      if (m.squad && m.squad.length !== this.slotsOf(room, m)) m.squad = null;
    }
  }

  private addMember(room: Room, conn: Connection, name: string): Member {
    const member: Member = {
      id: `p${room.nextPlayerNum++}`,
      name,
      token: this.deps.makeToken(),
      conn,
      squad: null,
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
      connected: m.conn !== null,
      slots: this.slotsOf(room, m),
      ready: m.squad?.length === this.slotsOf(room, m),
    }));
    const msg: ServerMessage = {
      t: "lobby",
      code: room.code,
      hostId: room.hostId,
      players,
      started: room.run !== null,
    };
    for (const m of room.members) m.conn?.peer.send(msg);
  }

  private sendState(room: Room, member: Member, events: RunEvent[]): void {
    if (!room.run || !member.conn) return;
    member.conn.peer.send({ t: "state", view: viewFor(room.run, member.id), events });
  }

  private fail(conn: Connection, message: string): void {
    conn.peer.send({ t: "error", message });
  }
}
