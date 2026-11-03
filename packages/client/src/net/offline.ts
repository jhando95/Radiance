import {
  applyCommand,
  botCommand,
  type CombatEvent,
  type CombatState,
  type CombatView,
  type Command,
  createCombat,
  ENCOUNTERS,
  type RngState,
  seedRng,
  viewFor,
} from "@radiance/core";
import { Emitter, type GameSession, type SessionEvent } from "./session";

export interface OfflineOptions {
  name: string;
  classId: string;
  /** Classes for AI allies — lets you exercise co-op rules without a second human. */
  botClasses: string[];
}

/** Runs @radiance/core directly in the browser. Same rules as the server, no network. */
export class OfflineSession implements GameSession {
  readonly mode = "offline";
  readonly playerId = "p1";
  readonly isHost = true;
  private readonly emitter = new Emitter<SessionEvent>();
  private state: CombatState | null = null;
  private readonly botIds: string[];
  private readonly botRng: RngState;
  private fights = 0;
  currentView: CombatView | null = null;

  constructor(private readonly opts: OfflineOptions) {
    this.botIds = opts.botClasses.map((_, i) => `p${i + 2}`);
    this.botRng = seedRng(`offline-bots-${Date.now()}`);
  }

  subscribe(listener: (event: SessionEvent) => void): () => void {
    return this.emitter.on(listener);
  }

  setClass(classId: string): void {
    this.opts.classId = classId;
  }

  startGame(): void {
    const encounterIds = Object.keys(ENCOUNTERS);
    const seed = `offline-${Date.now()}`;
    this.state = createCombat({
      seed,
      encounterId: encounterIds[this.fights++ % encounterIds.length] as string,
      players: [
        { id: this.playerId, name: this.opts.name, classId: this.opts.classId },
        ...this.opts.botClasses.map((classId, i) => ({
          id: this.botIds[i] as string,
          name: `Ally ${i + 1}`,
          classId,
        })),
      ],
    });
    this.publish([]);
    this.runBots();
  }

  command(cmd: Command): void {
    if (!this.state) return;
    const result = applyCommand(this.state, this.playerId, cmd);
    if (!result.ok) {
      this.emitter.emit({ type: "error", message: result.error });
      return;
    }
    this.state = result.state;
    this.publish(result.events);
    this.runBots();
  }

  close(): void {}

  /** Bots take their whole turn right away (with a small delay so it's watchable). */
  private runBots(): void {
    const state = this.state;
    if (state?.phase !== "player") return;
    const bot = state.players.find((p) => this.botIds.includes(p.id) && !p.downed && !p.ready);
    if (!bot) return;
    setTimeout(() => {
      if (!this.state || this.state !== state) return;
      const result = applyCommand(state, bot.id, botCommand(state, bot.id, this.botRng));
      if (!result.ok) return;
      this.state = result.state;
      this.publish(result.events);
      this.runBots();
    }, 350);
  }

  private publish(events: CombatEvent[]): void {
    if (!this.state) return;
    this.currentView = viewFor(this.state, this.playerId);
    this.emitter.emit({ type: "state", view: this.currentView, events });
  }
}
