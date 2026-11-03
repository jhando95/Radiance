import type { CombatEvent, CombatView, Command, LobbyPlayer } from "@radiance/core";

export interface LobbyInfo {
  code: string;
  hostId: string;
  players: LobbyPlayer[];
  started: boolean;
}

export type SessionEvent =
  | { type: "state"; view: CombatView; events: CombatEvent[] }
  | { type: "lobby"; lobby: LobbyInfo }
  | { type: "error"; message: string }
  | { type: "status"; text: string };

/**
 * The client's only way to affect the game. Offline and online play implement the
 * same interface, so scenes never know (or care) where the rules are running.
 */
export interface GameSession {
  readonly mode: "offline" | "online";
  readonly playerId: string;
  readonly isHost: boolean;
  /** Most recent combat view, so late subscribers (e.g. a scene still booting) can catch up. */
  readonly currentView: CombatView | null;
  subscribe(listener: (event: SessionEvent) => void): () => void;
  command(cmd: Command): void;
  /** Host only: begin the next combat (also the first one, from the lobby). */
  startGame(): void;
  setClass(classId: string): void;
  close(): void;
}

export class Emitter<T> {
  private listeners = new Set<(event: T) => void>();
  on(listener: (event: T) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }
  emit(event: T): void {
    for (const l of this.listeners) l(event);
  }
}
