/**
 * Scene key registry. Every scene transition uses these keys, never string literals.
 *
 * Gameplay scenes live outside the app shell: `src/scenes/gameplay.ts` pushes their classes
 * into `gameplayScenes`, and main.ts adds every class in that array to the game at boot.
 */
import type * as Phaser from "phaser";

export const SCENES = {
  boot: "boot",
  title: "title",
  settings: "settings",
  howToPlay: "howToPlay",
  credits: "credits",
  lobby: "lobby",
  squad: "squad",
  expedition: "expedition",
  combat: "combat",
  summary: "summary",
  /** Pause menu overlay launched over a gameplay scene. */
  pause: "pause",
  /** Always-on-top overlay for toasts. */
  uiOverlay: "uiOverlay",
  /** Dev-only playground (`?debug=...`). */
  debug: "debug",
} as const;

export type SceneKey = (typeof SCENES)[keyof typeof SCENES];

/** Gameplay scene classes, filled by src/scenes/gameplay.ts and registered in main.ts. */
export const gameplayScenes: Array<typeof Phaser.Scene> = [];

/** Add every gameplay scene class to a game (called once by main.ts). */
export function registerGameplayScenes(game: Phaser.Game): void {
  for (const SceneClass of gameplayScenes) {
    const probe = new SceneClass();
    const key = probe.sys.settings.key;
    if (!key) {
      console.error("Gameplay scene has no key; pass one to super({ key })", SceneClass.name);
      continue;
    }
    if (game.scene.getScene(key)) continue;
    game.scene.add(key, probe, false);
  }
}
