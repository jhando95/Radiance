/**
 * Client entry: loads the UI fonts (Cinzel for display, Alegreya Sans for body; BootScene waits
 * for them) and base styles, creates the Phaser game and registers the shell scenes plus every
 * gameplay scene pushed into `gameplayScenes`.
 */
import "@fontsource/cinzel/600.css";
import "@fontsource/cinzel/700.css";
import "@fontsource/cinzel/900.css";
import "@fontsource/alegreya-sans/400.css";
import "@fontsource/alegreya-sans/500.css";
import "@fontsource/alegreya-sans/700.css";
import "@fontsource/alegreya-sans/800.css";
import "./ui/style.css";
import * as Phaser from "phaser";
import { installCrispText, installHiRes, RENDER_H, RENDER_W } from "./app/hires";
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
import { COLORS } from "./ui/theme";

// Every text object rasterizes at high resolution.
installCrispText(Phaser.GameObjects.Text);

const game = new Phaser.Game({
  type: Phaser.AUTO,
  // Full-HD backing canvas; cameras zoom so game code keeps using logical 1280x720.
  width: RENDER_W,
  height: RENDER_H,
  parent: "game",
  backgroundColor: COLORS.bg,
  // Smooth filtering for HD art; remaining pixel-art textures opt into NEAREST.
  pixelArt: false,
  antialias: true,
  // Mipmaps for power-of-two textures (HD icons are 128px) so they stay clean when shown small.
  mipmapFilter: "LINEAR_MIPMAP_LINEAR",
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
installHiRes(game);

// Phaser's own sound manager follows the master volume (the audio module may layer on top).
const applyVolume = () => {
  game.sound.volume = getSettings().masterVolume;
};
game.events.once(Phaser.Core.Events.READY, applyVolume);
onSettingsChange(applyVolume);

if (import.meta.env.DEV) (window as unknown as { __game?: Phaser.Game }).__game = game;
