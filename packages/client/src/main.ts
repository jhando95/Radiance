/**
 * Client entry: loads the pixel font and base styles, creates the Phaser game and registers
 * the shell scenes plus every gameplay scene pushed into `gameplayScenes`.
 */
import "@fontsource/pixelify-sans/400.css";
import "@fontsource/pixelify-sans/600.css";
import "@fontsource/pixelify-sans/700.css";
import "./ui/style.css";
import * as Phaser from "phaser";
import { registerGameplayScenes, SCENES } from "./app/scenes";
import { getSettings, onSettingsChange } from "./app/settings";
import { BootScene } from "./scenes/BootScene";
import { CreditsScene } from "./scenes/CreditsScene";
import { DebugScene } from "./scenes/DebugScene";
import { HowToPlayScene } from "./scenes/HowToPlayScene";
import { PauseOverlay } from "./scenes/PauseOverlay";
import { SettingsScene } from "./scenes/SettingsScene";
import { TitleScene } from "./scenes/TitleScene";
import { UiOverlayScene } from "./scenes/UiOverlayScene";
import "./scenes/gameplay";
import { COLORS, GAME_H, GAME_W, installLigatureFix } from "./ui/theme";

// Before any scene creates text: suppress Pixelify Sans fi/fl/ff ligatures everywhere.
installLigatureFix(Phaser.GameObjects.Text);

const game = new Phaser.Game({
  type: Phaser.AUTO,
  width: GAME_W,
  height: GAME_H,
  parent: "game",
  backgroundColor: COLORS.bg,
  pixelArt: true,
  scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
  dom: { createContainer: true },
  input: { activePointers: 2 },
  disableContextMenu: true,
  scene: [
    BootScene,
    TitleScene,
    SettingsScene,
    HowToPlayScene,
    CreditsScene,
    ...(import.meta.env.DEV ? [DebugScene] : []),
  ],
});

registerGameplayScenes(game);
// Overlays last so they render above gameplay scenes by default.
game.scene.add(SCENES.pause, PauseOverlay, false);
game.scene.add(SCENES.uiOverlay, UiOverlayScene, false);

// Phaser's own sound manager follows the master volume (the audio module may layer on top).
const applyVolume = () => {
  game.sound.volume = getSettings().masterVolume;
};
game.events.once(Phaser.Core.Events.READY, applyVolume);
onSettingsChange(applyVolume);

if (import.meta.env.DEV) (window as unknown as { __game?: Phaser.Game }).__game = game;
