import type * as Phaser from "phaser";
import type { GameSession } from "../net/session";

/** Process-wide gameplay state shared by gameplay scenes. */
export interface GameGlobals {
  session: GameSession | null;
  /** Opens the pause overlay over a gameplay scene (wired in scenes/gameplay.ts). */
  openPause?: (scene: Phaser.Scene) => void;
  /** Opens the character sheet overlay. */
  openCharacter?: (scene: Phaser.Scene, mercId?: string) => void;
}

export const globals: GameGlobals = { session: null };

/** Which gameplay scene should be showing for a run phase. */
export function sceneForPhase(phase: string): "expedition" | "combat" | "summary" {
  if (phase === "combat") return "combat";
  if (phase === "victory" || phase === "defeat") return "summary";
  return "expedition";
}
