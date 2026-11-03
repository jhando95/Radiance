/** Slow-scrolling credits over the dimmed moon horizon. Any key / click returns. */
import * as Phaser from "phaser";
import { SCENES } from "../app/scenes";
import { iconTexture, logoImage, TEX } from "../app/textures";
import { VERSION } from "../app/version";
import { addBackdrop, addKeyHint } from "../ui/screen";
import { COLOR_NUM, COLORS, DISPLAY_FONT, fontPx, GAME_H, GAME_W, TEXT } from "../ui/theme";
import { leaveSubScreen, type SubScreenData } from "./SettingsScene";

type Line =
  | { kind: "logo" }
  | { kind: "heading"; text: string }
  | { kind: "line"; text: string }
  | { kind: "small"; text: string }
  | { kind: "gap"; size?: number }
  | { kind: "lamp" };

const CREDITS: Line[] = [
  { kind: "logo" },
  { kind: "small", text: "Scavengers of the Sunless Moons" },
  { kind: "gap", size: 96 },
  { kind: "heading", text: "A game by" },
  { kind: "line", text: "jhando95" },
  { kind: "gap" },
  { kind: "heading", text: "Design, code & procedural art" },
  { kind: "line", text: "jhando95" },
  { kind: "small", text: "with a crew of tireless Claude agents" },
  { kind: "gap" },
  { kind: "heading", text: "Built with" },
  { kind: "line", text: "Phaser" },
  { kind: "line", text: "TypeScript" },
  { kind: "line", text: "Vite" },
  { kind: "gap" },
  { kind: "heading", text: "Typefaces" },
  { kind: "line", text: "Cinzel" },
  { kind: "small", text: "by Natanael Gama · SIL Open Font License" },
  { kind: "line", text: "Alegreya Sans" },
  { kind: "small", text: "by Juan Pablo del Peral, Huerta Tipográfica · SIL Open Font License" },
  { kind: "gap" },
  { kind: "heading", text: "Art" },
  { kind: "line", text: "Every stroke drawn by code" },
  { kind: "small", text: "Procedural characters, icons and skies" },
  { kind: "gap" },
  { kind: "heading", text: "Inspired by" },
  { kind: "line", text: "Ranked tactics, ruined lanterns," },
  { kind: "line", text: "and the long dark between stars" },
  { kind: "gap" },
  { kind: "heading", text: "Special thanks" },
  { kind: "line", text: "Everyone who carried the lamp" },
  { kind: "line", text: "a little further" },
  { kind: "gap", size: 120 },
  { kind: "lamp" },
  { kind: "small", text: "Keep the light." },
  { kind: "gap", size: 40 },
  { kind: "small", text: VERSION },
];

const SPEED = 42; // px per second

export class CreditsScene extends Phaser.Scene {
  private data_: SubScreenData = {};
  private roll!: Phaser.GameObjects.Container;
  private rollH = 0;
  private leaving = false;
  private fastKeys: Phaser.Input.Keyboard.Key[] = [];

  constructor() {
    super({ key: SCENES.credits });
  }

  init(data: SubScreenData): void {
    this.data_ = data ?? {};
    this.leaving = false;
  }

  create(): void {
    this.cameras.main.setBackgroundColor(COLORS.bg);
    addBackdrop(this, { dim: 0.45, dust: true, embers: true });
    // Soft fade bands at top and bottom so text dissolves in and out.
    const band = (y: number, flip: boolean) =>
      this.add
        .image(GAME_W / 2, y, TEX.glow)
        .setDisplaySize(GAME_W * 2, 260)
        .setTint(COLOR_NUM.ink)
        .setAlpha(0.95)
        .setFlipY(flip)
        .setDepth(10);
    band(-60, false);
    band(GAME_H + 60, true);

    this.roll = this.add.container(GAME_W / 2, GAME_H + 40);
    let y = 0;
    for (const line of CREDITS) {
      switch (line.kind) {
        case "logo": {
          const obj = logoImage(this, 0, y, 520).setOrigin(0.5, 0);
          this.roll.add(obj);
          y += obj.displayHeight + 4;
          break;
        }
        case "heading": {
          const t = this.add
            .text(0, y, line.text.toUpperCase(), {
              ...TEXT.small,
              fontFamily: DISPLAY_FONT,
              fontStyle: "700",
              color: COLORS.accent,
              letterSpacing: 3,
            })
            .setOrigin(0.5, 0);
          this.roll.add(t);
          y += t.height + 8;
          break;
        }
        case "line": {
          const t = this.add.text(0, y, line.text, {
            ...TEXT.subheading,
            fontSize: fontPx(26, 0.5),
          });
          t.setOrigin(0.5, 0);
          this.roll.add(t);
          y += t.height + 4;
          break;
        }
        case "small": {
          const t = this.add
            .text(0, y, line.text, { ...TEXT.small, color: COLORS.textDim })
            .setOrigin(0.5, 0);
          this.roll.add(t);
          y += t.height + 4;
          break;
        }
        case "lamp": {
          const img = this.add
            .image(0, y + 24, iconTexture(this, "ui_lamp"))
            .setDisplaySize(64, 64);
          const glow = this.add
            .image(0, y + 24, TEX.glow)
            .setDisplaySize(200, 200)
            .setTint(COLOR_NUM.accent)
            .setBlendMode(Phaser.BlendModes.ADD)
            .setAlpha(0.4);
          this.tweens.add({
            targets: glow,
            alpha: 0.25,
            duration: 160,
            yoyo: true,
            repeat: -1,
            repeatDelay: 700,
          });
          this.roll.add([glow, img]);
          y += 72;
          break;
        }
        case "gap":
          y += line.size ?? 48;
          break;
      }
    }
    this.rollH = y;

    addKeyHint(this, "Esc  back   ·   hold Space  faster").setDepth(20);
    const kb = this.input.keyboard;
    this.fastKeys = kb ? [kb.addKey("SPACE"), kb.addKey("DOWN")] : [];
    this.input.keyboard?.on("keydown", (e: KeyboardEvent) => {
      if (e.code !== "Space" && e.code !== "ArrowDown") this.back();
    });
    this.input.on(Phaser.Input.Events.POINTER_UP, () => this.back());
  }

  override update(_t: number, dt: number): void {
    const fast = this.fastKeys.some((k) => k.isDown);
    this.roll.y -= ((SPEED * dt) / 1000) * (fast ? 5 : 1);
    if (this.roll.y < -this.rollH + GAME_H / 2 - 40) {
      // Hold on the final line, then return.
      this.roll.y = -this.rollH + GAME_H / 2 - 40;
      if (!this.leaving) {
        this.leaving = true;
        this.time.delayedCall(3500, () => this.back());
      }
    }
  }

  private back(): void {
    leaveSubScreen(this, this.data_);
  }
}
