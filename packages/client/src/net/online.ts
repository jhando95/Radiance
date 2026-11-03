import {
  type ClientMessage,
  type CombatView,
  type Command,
  PROTOCOL_VERSION,
  type ServerMessage,
} from "@radiance/core";
import { Emitter, type GameSession, type LobbyInfo, type SessionEvent } from "./session";

const STORAGE_KEY = "radiance:rejoin";

interface RejoinInfo {
  code: string;
  token: string;
}

function loadRejoin(): RejoinInfo | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as RejoinInfo) : null;
  } catch {
    return null;
  }
}

function saveRejoin(info: RejoinInfo | null): void {
  try {
    if (info) sessionStorage.setItem(STORAGE_KEY, JSON.stringify(info));
    else sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    // Storage can be unavailable (private mode); rejoin-on-refresh just won't work.
  }
}

export function defaultServerUrl(): string {
  const configured = import.meta.env.VITE_SERVER_URL as string | undefined;
  if (configured) return configured;
  const proto = location.protocol === "https:" ? "wss" : "ws";
  return `${proto}://${location.hostname}:8787`;
}

export type OnlineIntent =
  | { kind: "create"; name: string; classId: string }
  | { kind: "join"; code: string; name: string; classId: string }
  | { kind: "rejoin" };

export function hasRejoin(): boolean {
  return loadRejoin() !== null;
}

/** Talks to the authoritative server. Reconnects with backoff and rejoins by token. */
export class OnlineSession implements GameSession {
  readonly mode = "online";
  playerId = "";
  currentView: CombatView | null = null;
  private lobby: LobbyInfo | null = null;
  private readonly emitter = new Emitter<SessionEvent>();
  private socket: WebSocket | null = null;
  private rejoin: RejoinInfo | null = null;
  private retries = 0;
  private closed = false;

  constructor(
    private readonly url: string,
    private intent: OnlineIntent,
  ) {
    if (intent.kind === "rejoin") this.rejoin = loadRejoin();
    this.connect();
  }

  get isHost(): boolean {
    return this.lobby?.hostId === this.playerId;
  }

  subscribe(listener: (event: SessionEvent) => void): () => void {
    return this.emitter.on(listener);
  }

  command(command: Command): void {
    this.send({ t: "command", command });
  }

  startGame(): void {
    this.send({ t: "startGame" });
  }

  setClass(classId: string): void {
    this.send({ t: "setClass", classId });
  }

  close(): void {
    this.closed = true;
    saveRejoin(null);
    this.socket?.close();
  }

  private connect(): void {
    this.emitter.emit({ type: "status", text: "Connecting…" });
    const socket = new WebSocket(this.url);
    this.socket = socket;

    socket.addEventListener("open", () => {
      this.retries = 0;
      const v = PROTOCOL_VERSION;
      if (this.rejoin) {
        this.send({ t: "rejoin", v, ...this.rejoin });
      } else if (this.intent.kind === "create") {
        this.send({ t: "createRoom", v, name: this.intent.name, classId: this.intent.classId });
      } else if (this.intent.kind === "join") {
        const { code, name, classId } = this.intent;
        this.send({ t: "joinRoom", v, code, name, classId });
      }
    });

    socket.addEventListener("message", (ev) => {
      let msg: ServerMessage;
      try {
        msg = JSON.parse(String(ev.data)) as ServerMessage;
      } catch {
        return;
      }
      this.onMessage(msg);
    });

    socket.addEventListener("close", () => {
      if (this.closed) return;
      if (!this.rejoin) {
        this.emitter.emit({ type: "error", message: "Could not reach the server." });
        return;
      }
      const delay = Math.min(10_000, 500 * 2 ** this.retries++);
      this.emitter.emit({ type: "status", text: "Connection lost — reconnecting…" });
      setTimeout(() => this.connect(), delay);
    });
  }

  private onMessage(msg: ServerMessage): void {
    switch (msg.t) {
      case "welcome":
        this.playerId = msg.playerId;
        this.rejoin = { code: msg.code, token: msg.token };
        saveRejoin(this.rejoin);
        break;
      case "lobby":
        this.lobby = {
          code: msg.code,
          hostId: msg.hostId,
          players: msg.players,
          started: msg.started,
        };
        this.emitter.emit({ type: "lobby", lobby: this.lobby });
        break;
      case "state":
        this.currentView = msg.view;
        this.emitter.emit({ type: "state", view: msg.view, events: msg.events });
        break;
      case "error":
        if (msg.message === "Could not rejoin that room.") {
          this.rejoin = null;
          saveRejoin(null);
        }
        this.emitter.emit({ type: "error", message: msg.message });
        break;
    }
  }

  private send(msg: ClientMessage): void {
    if (this.socket?.readyState === WebSocket.OPEN) this.socket.send(JSON.stringify(msg));
  }
}
