import type { LobbyPlayer, MercSetup, RunCommand, RunEvent, RunView } from "@radiance/core";

export interface LobbyInfo {
  code: string;
  hostId: string;
  players: LobbyPlayer[];
  started: boolean;
}

export type SessionEvent =
  | { type: "state"; view: RunView; events: RunEvent[] }
  | { type: "lobby"; lobby: LobbyInfo }
  | { type: "error"; message: string }
  | { type: "status"; text: string };

/**
 * The client's only way to affect the game. Offline and online play implement the same
 * interface, so scenes never know (or care) where the rules are running.
 */
export interface GameSession {
  readonly mode: "offline" | "online";
  readonly playerId: string;
  readonly isHost: boolean;
  /** Latest run view, so scenes that boot late can render immediately. */
  readonly currentView: RunView | null;
  readonly lobby: LobbyInfo | null;
  subscribe(listener: (event: SessionEvent) => void): () => void;
  command(cmd: RunCommand): void;
  /** Submit this player's mercenaries (lobby). */
  submitSquad(mercs: MercSetup[]): void;
  /** Host only: depart on the expedition once everyone is ready. */
  startGame(): void;
  close(): void;
}

export class Emitter<T> {
  private listeners = new Set<(event: T) => void>();
  on(listener: (event: T) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }
  emit(event: T): void {
    for (const l of [...this.listeners]) l(event);
  }
}

/** Mercs this player controls in the view. */
export function myMercs(view: RunView) {
  return view.mercs.filter((m) => m.ownerId === view.viewerId);
}
