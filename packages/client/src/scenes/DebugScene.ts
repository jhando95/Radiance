/**
 * Dev-only playground reached with `?debug=<mode>`: a stand-in gameplay scene that exercises
 * shell widgets (pause, toast, modal, prompt, tooltip, widgets) for screenshots and testing.
 */
import * as Phaser from "phaser";
import { hdScale, RENDER_SCALE } from "../app/hires";
import { SCENES } from "../app/scenes";
import { enemyTexture, iconImage, iconTexture, mercTexture, slotTexture } from "../app/textures";
import { RigSprite } from "../art/hd/rig";
import { RARITY_COLORS } from "../art/palette";
import { enemyRig, hasHdEnemies, hasHdMercs, mercRigFromLook } from "../game/hdArt";
import { sampleEnemyId, sampleMercLook } from "../ui/artAdapter";
import { Button } from "../ui/Button";
import { FocusGroup } from "../ui/focus";
import { confirmDialog, promptDialog } from "../ui/Modal";
import { createPanel } from "../ui/Panel";
import { Selector } from "../ui/Selector";
import { Slider } from "../ui/Slider";
import { addBackdrop } from "../ui/screen";
import { toast } from "../ui/Toast";
import { Toggle } from "../ui/Toggle";
import { attachTooltip, showTooltip } from "../ui/Tooltip";
import { COLORS, GAME_H, GAME_W, TEXT, type TextStyleName } from "../ui/theme";
import { bindPauseKey, openPause } from "./PauseOverlay";

export class DebugScene extends Phaser.Scene {
  private mode = "";

  constructor() {
    super({ key: SCENES.debug });
  }

  /** Stand-in squad / enemies: HD rigs when available, else pixel sprites. */
  private figure(x: number, feet: number, enemy: boolean, i: number): void {
    if (enemy ? hasHdEnemies() : hasHdMercs()) {
      const def = enemy ? enemyRig(sampleEnemyId(i, true)) : mercRigFromLook(sampleMercLook(i));
      const k = Math.min(
        (150 * RENDER_SCALE) / Math.max(def.height, 1),
        (104 * RENDER_SCALE) / Math.max(def.width, 1),
      );
      new RigSprite(this, x, feet, def, { scale: hdScale(k), flip: enemy }).idle();
      return;
    }
    const key = enemy ? enemyTexture(this, i) : mercTexture(this, i);
    this.add.image(x, feet, key).setOrigin(0.5, 1).setScale(2);
  }

  /** Type specimen + widget gallery for visual checks (`?debug=widgets`). */
  private widgetSheet(): void {
    let y = 64;
    for (const name of Object.keys(TEXT) as TextStyleName[]) {
      const t = this.add.text(40, y, `${name} — The lamp gutters; Brann holds rank 1. 0123`, {
        ...TEXT[name],
        fontSize: name === "display" ? "40px" : TEXT[name].fontSize,
      });
      y += t.height + 6;
    }
    const px = 820;
    const variants = ["default", "inset", "highlight"] as const;
    variants.forEach((v, i) => {
      createPanel(this, px + i * 140, 60, 124, 90, { variant: v, originX: 0, originY: 0 });
      this.add.text(px + i * 140 + 62, 105, v, TEXT.small).setOrigin(0.5);
    });
    const rarities = [
      undefined,
      ...(Object.keys(RARITY_COLORS) as Array<keyof typeof RARITY_COLORS>),
    ];
    rarities.forEach((r, i) => {
      this.add.image(px + 30 + i * 70, 200, slotTexture(this, r)).setScale(3);
    });
    const ids = ["ui_lamp", "ui_ore", "ui_cooldown", "item_lamp_oil", "node_boss", "ui_crown"];
    ids.forEach((id, i) => {
      this.add.image(px + 30 + i * 70, 280, iconTexture(this, id)).setScale(3);
    });
    [16, 24, 32, 48, 64].forEach((size, i) => {
      iconImage(this, px + 20 + i * 76, 360, "ui_lamp", size);
    });
    const rows = [
      new Slider(this, 760, 430, { label: "Master volume", width: 480, value: 0.8 }),
      new Toggle(this, 760, 478, { label: "Screen shake", width: 480, value: true }),
      new Selector(this, 760, 526, {
        label: "Animation speed",
        width: 480,
        value: 1,
        options: [0.5, 1, 1.5, 2].map((v) => ({ value: v, label: `${v}x` })),
      }),
    ];
    new FocusGroup(this, rows, { initial: -1 });
  }

  init(data: { mode?: string }): void {
    this.mode = data?.mode ?? "";
  }

  create(): void {
    addBackdrop(this, { seed: 3, dim: 0.2 });
    if (this.mode !== "widgets") {
      for (let i = 0; i < 4; i++) {
        this.figure(520 - i * 112, 540, false, i);
        this.figure(760 + i * 112, 540, true, i);
      }
    }
    this.add.text(24, 24, `debug: ${this.mode}`, TEXT.small);
    if (this.mode === "widgets") this.widgetSheet();
    bindPauseKey(this);

    const t = (ms: number, fn: () => void) => this.time.delayedCall(ms, fn);
    switch (this.mode) {
      case "pause":
        t(300, () => openPause(this));
        break;
      case "toast":
        t(200, () => toast(this, "Connected to room KX4F."));
        t(350, () => toast(this, "Brann found a Relic: Ember Lantern!", "success"));
        t(500, () => toast(this, "Connection lost. Retrying…", "error"));
        break;
      case "modal":
        t(
          300,
          () =>
            void confirmDialog(this, {
              title: "Abandon expedition?",
              body: "Your squad retreats to the dropship. Unbanked loot from this expedition is lost.",
              confirmLabel: "Abandon",
              cancelLabel: "Keep going",
              danger: true,
            }),
        );
        break;
      case "prompt":
        t(
          300,
          () =>
            void promptDialog(this, {
              title: "Join Co-op",
              body: "Enter the room code your host shared.",
              fields: [
                { key: "name", label: "Your callsign", value: "Vex", maxLength: 16 },
                {
                  key: "code",
                  label: "Room code",
                  placeholder: "ABCD",
                  uppercase: true,
                  maxLength: 6,
                  className: "rad-input--code",
                },
              ],
              confirmLabel: "Join",
            }),
        );
        break;
      case "tooltip": {
        const slot = createPanel(this, 400, 200, 96, 96, { variant: "highlight" });
        attachTooltip(slot, {
          title: "Ember Lantern",
          titleColor: RARITY_COLORS.relic,
          subtitle: "Lamp · Relic · Item level 12",
          lines: [
            { text: "+1 Light radius", icon: "ui_lamp" },
            "Lamp drains 15% slower",
            { text: "Flare skills burn for 2 turns", color: COLORS.accent },
            { text: "“It never quite goes out.”", color: COLORS.textMuted, size: "small" },
          ],
          footer: "Equipped by Brann",
        });
        t(300, () =>
          showTooltip(
            this,
            {
              title: "Lantern Bash",
              titleColor: COLORS.accentBright,
              subtitle: "Skill · Cooldown 2",
              lines: [
                "Deal 120% damage and light the target for 2 turns.",
                { text: "Use from ranks 1–2", color: COLORS.textDim, size: "small" },
              ],
            },
            420,
            220,
          ),
        );
        break;
      }
      case "widgets": {
        const b1 = new Button(this, GAME_W / 2 - 260, GAME_H - 80, {
          label: "Primary",
          kind: "primary",
        });
        const b2 = new Button(this, GAME_W / 2, GAME_H - 80, {
          label: "Secondary",
          icon: "ui_ore",
        });
        const b3 = new Button(this, GAME_W / 2 + 260, GAME_H - 80, {
          label: "Disabled",
          disabled: true,
        });
        new FocusGroup(this, [b1, b2, b3], { axis: "horizontal" });
        break;
      }
      default:
        break;
    }
  }
}
