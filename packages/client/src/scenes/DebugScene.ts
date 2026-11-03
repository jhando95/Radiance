/**
 * Dev-only playground reached with `?debug=<mode>`: a stand-in gameplay scene that exercises
 * shell widgets (pause, toast, modal, prompt, tooltip, widgets) for screenshots and testing.
 */
import * as Phaser from "phaser";
import { RARITY_COLORS } from "../art/palette";
import { SCENES } from "../app/scenes";
import { enemyTexture, mercTexture } from "../app/textures";
import { Button } from "../ui/Button";
import { FocusGroup } from "../ui/focus";
import { confirmDialog, promptDialog } from "../ui/Modal";
import { createPanel } from "../ui/Panel";
import { addBackdrop } from "../ui/screen";
import { COLORS, GAME_H, GAME_W, TEXT } from "../ui/theme";
import { toast } from "../ui/Toast";
import { attachTooltip, showTooltip } from "../ui/Tooltip";
import { bindPauseKey, openPause } from "./PauseOverlay";

export class DebugScene extends Phaser.Scene {
  private mode = "";

  constructor() {
    super({ key: SCENES.debug });
  }

  init(data: { mode?: string }): void {
    this.mode = data?.mode ?? "";
  }

  create(): void {
    addBackdrop(this, { seed: 3, dim: 0.2 });
    for (let i = 0; i < 4; i++) {
      this.add.image(520 - i * 112, 470, mercTexture(this, i)).setScale(2);
      this.add.image(760 + i * 112, 470, enemyTexture(this, i)).setScale(2);
    }
    this.add.text(24, 24, `debug: ${this.mode}`, TEXT.small);
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
        t(300, () => void confirmDialog(this, {
          title: "Abandon expedition?",
          body: "Your squad retreats to the dropship. Unbanked loot from this expedition is lost.",
          confirmLabel: "Abandon",
          cancelLabel: "Keep going",
          danger: true,
        }));
        break;
      case "prompt":
        t(300, () => void promptDialog(this, {
          title: "Join Co-op",
          body: "Enter the room code your host shared.",
          fields: [
            { key: "name", label: "Your callsign", value: "Vex", maxLength: 16 },
            { key: "code", label: "Room code", placeholder: "ABCD", uppercase: true, maxLength: 6, className: "rad-input--code" },
          ],
          confirmLabel: "Join",
        }));
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
              lines: ["Deal 120% damage and light the target for 2 turns.", { text: "Use from ranks 1–2", color: COLORS.textDim, size: "small" }],
            },
            420,
            220,
          ),
        );
        break;
      }
      case "widgets": {
        const b1 = new Button(this, GAME_W / 2 - 260, GAME_H - 80, { label: "Primary", kind: "primary" });
        const b2 = new Button(this, GAME_W / 2, GAME_H - 80, { label: "Secondary", icon: "ui_ore" });
        const b3 = new Button(this, GAME_W / 2 + 260, GAME_H - 80, { label: "Disabled", disabled: true });
        new FocusGroup(this, [b1, b2, b3], { axis: "horizontal" });
        break;
      }
      default:
        break;
    }
  }
}
