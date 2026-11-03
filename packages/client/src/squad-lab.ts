/**
 * Standalone dev page for the squad builder: `vite` then open /squad-lab.html
 * (`?slots=2` for fewer mercs, `?back=1` to show the Back button).
 */
import "@fontsource/pixelify-sans/400.css";
import "@fontsource/pixelify-sans/600.css";
import "@fontsource/pixelify-sans/700.css";
import type { MercSetup } from "@radiance/core";
import * as Phaser from "phaser";
import { SquadScene, type SquadSceneData } from "./scenes/SquadScene";

const params = new URLSearchParams(location.search);
const slots = Math.max(1, Math.min(4, Number(params.get("slots") ?? 4) || 4));
const out = document.getElementById("out") as HTMLPreElement;

declare global {
  interface Window {
    __squadResult?: MercSetup[];
    __squadGame?: Phaser.Game;
  }
}

async function main(): Promise<void> {
  await Promise.all(
    ["400", "600", "700"].map((w) => document.fonts.load(`${w} 20px "Pixelify Sans"`)),
  ).catch(() => undefined);
  await document.fonts.ready;

  const data: SquadSceneData = {
    slots,
    title: slots === 4 ? "Assemble your squad" : `Your mercenaries (${slots} of 4)`,
    onConfirm: (setups) => {
      const json = JSON.stringify(setups, null, 2);
      console.log("squad confirmed", json);
      window.__squadResult = setups;
      out.textContent = `onConfirm:\n${json}`;
      out.hidden = false;
    },
    ...(params.has("back") ? { onBack: () => console.log("squad back") } : {}),
  };

  const game = new Phaser.Game({
    type: Phaser.AUTO,
    width: 1280,
    height: 720,
    parent: "game",
    backgroundColor: "#07060b",
    pixelArt: true,
    scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
    dom: { createContainer: true },
    scene: [],
  });
  window.__squadGame = game;
  game.scene.add("squad", SquadScene, true, data);
  out.addEventListener("click", () => {
    out.hidden = true;
  });
}

void main();
