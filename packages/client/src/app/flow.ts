/**
 * Title-menu actions are routed through these handlers so gameplay code (sessions, lobby,
 * expedition) can implement them without the shell depending on it. Until handlers are
 * registered the title menu shows a "Coming soon" toast.
 */
import type * as Phaser from "phaser";

export interface FlowHandlers {
  startSolo(scene: Phaser.Scene): void;
  hostOnline(scene: Phaser.Scene, name: string): void;
  joinOnline(scene: Phaser.Scene, name: string, code: string): void;
  /** If present, the title menu shows "Resume Expedition" (when `canResume` allows it). */
  resume?(scene: Phaser.Scene): void;
  /** Optional gate for the Resume entry; defaults to true when `resume` exists. */
  canResume?(): boolean;
}

export const flow: { handlers: FlowHandlers | null; register(h: FlowHandlers): void } = {
  handlers: null,
  register(h: FlowHandlers): void {
    this.handlers = h;
  },
};
