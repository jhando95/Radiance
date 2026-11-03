import { computeStats, getDiscipline, MAP_ROWS } from "@radiance/core";
import * as Phaser from "phaser";
import { audio } from "../audio";
import { SCENES } from "../app/scenes";
import { mapBackdropTexture } from "../app/textures";
import { goTo } from "../app/transitions";
import { globals } from "../game/globals";
import { unitPortrait } from "../game/unitArt";
import type { GameSession } from "../net/session";
import { Button } from "../ui/Button";
import { COLORS, GAME_H, GAME_W, TEXT } from "../ui/theme";

/** End of expedition: victory or defeat recap. */
export class SummaryScene extends Phaser.Scene {
  constructor() {
    super({ key: SCENES.summary });
  }

  create(): void {
    const session = globals.session as GameSession | null;
    const view = session?.currentView;
    this.add.image(GAME_W / 2, GAME_H / 2, mapBackdropTexture(this, 11)).setScale(4);
    this.add.rectangle(0, 0, GAME_W, GAME_H, 0x05040a, 0.6).setOrigin(0);
    const cx = GAME_W / 2;
    const won = view?.phase === "victory";
    audio.setMusic(won ? "victory" : "defeat");
    this.add.text(cx, 90, won ? "EXPEDITION COMPLETE" : "THE LIGHT GOES OUT", { ...TEXT.title, color: won ? COLORS.accentBright : COLORS.danger }).setOrigin(0.5);
    if (view) {
      const node = view.nodes.find((n) => n.id === view.currentNodeId);
      const lines = [
        won ? "The Lumen Eater is dead and its stolen light spills across the hollows." : "Your squad was overwhelmed in the dark.",
        `Depth reached: ${node?.row ?? 0}/${MAP_ROWS - 1}   ·   Enemies slain: ${view.stats.kills}   ·   Fights: ${view.stats.combats}`,
        `Items found: ${view.stats.itemsFound}   ·   Ore hauled: ${view.ore}`,
      ];
      lines.forEach((l, i) => this.add.text(cx, 150 + i * 32, l, i === 0 ? TEXT.body : TEXT.bodyDim).setOrigin(0.5));
      view.mercs.forEach((m, i) => {
        const x = cx - 420 + i * 280;
        const y = 380;
        this.add.rectangle(x, y, 250, 170, 0x0e0c16, 0.95).setStrokeStyle(2, 0x34305a);
        this.add.image(x, y - 34, unitPortrait(this, { id: m.id, side: "merc", defId: m.discipline }, view.mercs)).setScale(3.5);
        this.add.text(x, y + 26, m.name, TEXT.subheading).setOrigin(0.5);
        this.add
          .text(x, y + 54, `Lv ${m.level} ${getDiscipline(m.discipline).name} · ${m.hp > 0 ? `${m.hp}/${computeStats(m).maxHp} HP` : "fallen"}`, TEXT.small)
          .setOrigin(0.5);
      });
    }
    const btn = new Button(this, cx, GAME_H - 90, {
      label: "Return to base",
      width: 320,
      kind: "primary",
      onClick: () => {
        session?.close();
        globals.session = null;
        audio.setMusic("title");
        goTo(this, SCENES.title);
      },
    });
    this.add.existing(btn);
  }
}
