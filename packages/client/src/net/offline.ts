import {
  applyRunCommand,
  createRun,
  type MercSetup,
  type RunCommand,
  type RunEvent,
  type RunState,
  type RunView,
  viewFor,
} from "@radiance/core";
import { Emitter, type GameSession, type LobbyInfo, type SessionEvent } from "./session";

const SAVE_KEY = "radiance:offline-run";

interface SaveFile {
  seed: string;
  name: string;
  squad: MercSetup[];
  log: { playerId: string; command: RunCommand }[];
}

function load(): SaveFile | null {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    return raw ? (JSON.parse(raw) as SaveFile) : null;
  } catch {
    return null;
  }
}

function save(file: SaveFile | null): void {
  try {
    if (file) localStorage.setItem(SAVE_KEY, JSON.stringify(file));
    else localStorage.removeItem(SAVE_KEY);
  } catch {
    // Storage unavailable: the run just won't survive a reload.
  }
}

export function hasOfflineSave(): boolean {
  const f = load();
  return !!f && f.log.length > 0;
}

/** Solo play: runs @radiance/core in the browser. Saves as seed + command log. */
export class OfflineSession implements GameSession {
  readonly mode = "offline";
  readonly playerId = "p1";
  readonly isHost = true;
  readonly lobby: LobbyInfo | null = null;
  currentView: RunView | null = null;
  private readonly emitter = new Emitter<SessionEvent>();
  private run: RunState | null = null;
  private squad: MercSetup[] = [];
  private file: SaveFile | null = null;

  constructor(private readonly name: string) {}

  /** Resume the saved expedition, if any. Returns false if there is none. */
  resume(): boolean {
    const file = load();
    if (!file) return false;
    try {
      let run = createRun(this.options(file.seed, file.squad));
      for (const entry of file.log) {
        const res = applyRunCommand(run, entry.playerId, entry.command);
        if (!res.ok) throw new Error(res.error);
        run = res.state;
      }
      this.file = file;
      this.squad = file.squad;
      this.run = run;
      this.publish([]);
      return true;
    } catch {
      save(null);
      return false;
    }
  }

  subscribe(listener: (event: SessionEvent) => void): () => void {
    return this.emitter.on(listener);
  }

  submitSquad(mercs: MercSetup[]): void {
    this.squad = mercs;
  }

  startGame(): void {
    if (this.squad.length !== 4) {
      this.emitter.emit({ type: "error", message: "Assemble four mercenaries first." });
      return;
    }
    const seed = `solo-${Date.now().toString(36)}`;
    this.run = createRun(this.options(seed, this.squad));
    this.file = { seed, name: this.name, squad: this.squad, log: [] };
    save(this.file);
    this.publish([]);
  }

  command(cmd: RunCommand): void {
    if (!this.run) return;
    const result = applyRunCommand(this.run, this.playerId, cmd);
    if (!result.ok) {
      this.emitter.emit({ type: "error", message: result.error });
      return;
    }
    this.run = result.state;
    if (this.file) {
      this.file.log.push({ playerId: this.playerId, command: cmd });
      save(this.run.phase === "victory" || this.run.phase === "defeat" ? null : this.file);
    }
    this.publish(result.events);
  }

  close(): void {}

  /** Abandon the expedition and delete the save. */
  abandon(): void {
    save(null);
    this.run = null;
    this.file = null;
  }

  private options(seed: string, squad: MercSetup[]) {
    return {
      seed,
      players: [{ id: this.playerId, name: this.name }],
      mercs: squad.map((setup) => ({ ownerId: this.playerId, setup })),
    };
  }

  private publish(events: RunEvent[]): void {
    if (!this.run) return;
    this.currentView = viewFor(this.run, this.playerId);
    this.emitter.emit({ type: "state", view: this.currentView, events });
  }
}
