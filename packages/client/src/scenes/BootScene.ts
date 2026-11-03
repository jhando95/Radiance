/**
 * Boot / loading screen. Waits for the pixel font, then generates and caches the procedural
 * textures a frame at a time behind a lamp-lit progress bar, launches the UI overlay and
 * fades into the title (or a `?debug=` route in dev builds).
 */
import * as Phaser from "phaser";
import { SCENES } from "../app/scenes";
import {
  enemyTexture,
  ensureFxTextures,
  ensureIconTextures,
  ensureUiTextures,
  iconTexture,
  mapBackdropTexture,
  mercTexture,
  TEX,
} from "../app/textures";
import { goTo } from "../app/transitions";
import { VERSION } from "../app/version";
import { hexNum, RAMPS } from "../art/palette";
import { iconIds } from "../ui/artAdapter";
import { COLOR_NUM, COLORS, FONT_FAMILY, GAME_H, GAME_W, GRID, TEXT } from "../ui/theme";

const BAR_W = 435;
const BAR_H = 18;
const MIN_BOOT_MS = 1100;

/** Debug routes (dev only): ?debug=settings|howto|credits|pause|toast|modal|tooltip|prompt */
export function debugRoute(): string | null {
  if (!import.meta.env.DEV) return null;
  try {
    return new URLSearchParams(window.location.search).get("debug");
  } catch {
    return null;
  }
}

async function waitForFonts(): Promise<void> {
  if (!("fonts" in document)) return;
  const timeout = new Promise<void>((r) => setTimeout(r, 3000));
  const load = Promise.all([
    document.fonts.load(`16px ${FONT_FAMILY}`),
    document.fonts.load(`600 16px ${FONT_FAMILY}`),
    document.fonts.load(`700 16px ${FONT_FAMILY}`),
  ]).then(() => document.fonts.ready);
  await Promise.race([load.then(() => undefined), timeout]).catch(() => undefined);
}

export class BootScene extends Phaser.Scene {
  private bar!: Phaser.GameObjects.Graphics;
  private shown = 0;
  private target = 0;
  private status: Phaser.GameObjects.Text | null = null;
  private glow: Phaser.GameObjects.Image | null = null;

  constructor() {
    super({ key: SCENES.boot });
  }

  create(): void {
    this.cameras.main.setBackgroundColor(COLORS.bg);
    this.bar = this.add.graphics();
    this.drawBar();
    void this.run();
  }

  override update(_t: number, dt: number): void {
    if (this.shown < this.target) {
      this.shown = Math.min(this.target, this.shown + dt / 500);
      this.drawBar();
    }
    if (this.glow) this.glow.setAlpha(0.2 + this.shown * 0.35 + Math.random() * 0.04);
  }

  private async run(): Promise<void> {
    const started = performance.now();
    await waitForFonts();
    ensureFxTextures(this);
    this.buildChrome();

    const icons = iconIds();
    const steps: Array<[string, () => void]> = [
      ["Charging lamp cells", () => ensureUiTextures(this)],
      ...chunk(icons, 12).map(
        (ids) =>
          ["Etching the glyphs", () => ensureIconTextures(this, ids)] as [string, () => void],
      ),
      ["Charting the sunless moons", () => mapBackdropTexture(this, 7)],
      [
        "Mustering mercenaries",
        () => {
          for (let i = 0; i < 4; i++) mercTexture(this, i);
        },
      ],
      [
        "Listening to the dark",
        () => {
          for (let i = 0; i < 4; i++) enemyTexture(this, i);
        },
      ],
    ];
    for (let i = 0; i < steps.length; i++) {
      const step = steps[i];
      if (!step) continue;
      this.status?.setText(`${step[0]}…`);
      try {
        step[1]();
      } catch (err) {
        console.error("boot step failed:", step[0], err);
      }
      this.target = (i + 1) / steps.length;
      await this.nextFrame();
    }
    const wait = MIN_BOOT_MS - (performance.now() - started);
    if (wait > 0) await new Promise((r) => setTimeout(r, wait));
    this.target = 1;
    this.status?.setText("The lamps are lit.");
    await new Promise((r) => setTimeout(r, 250));

    this.scene.launch(SCENES.uiOverlay);
    this.route();
  }

  private route(): void {
    const dbg = debugRoute();
    const direct: Record<string, string> = {
      settings: SCENES.settings,
      howto: SCENES.howToPlay,
      credits: SCENES.credits,
      title: SCENES.title,
    };
    if (dbg && direct[dbg]) {
      const page = Number(new URLSearchParams(window.location.search).get("page") ?? 0);
      goTo(this, direct[dbg], { page });
    } else if (dbg) {
      goTo(this, SCENES.debug, { mode: dbg });
    } else {
      goTo(this, SCENES.title, undefined, { duration: 400, fadeIn: 700 });
    }
  }

  private nextFrame(): Promise<void> {
    return new Promise((r) => requestAnimationFrame(() => r()));
  }

  private buildChrome(): void {
    const cx = GAME_W / 2;
    const cy = GAME_H / 2;
    this.glow = this.add
      .image(cx, cy + 40, TEX.glow)
      .setDisplaySize(720, 360)
      .setTint(COLOR_NUM.accent)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setAlpha(0.2)
      .setDepth(-1);
    const lamp = this.add.image(cx, cy - 72, iconTexture(this, "ui_lamp")).setScale(4);
    this.tweens.add({
      targets: lamp,
      y: lamp.y - 4,
      duration: 1400,
      yoyo: true,
      repeat: -1,
      ease: "Sine.inOut",
    });
    this.add.text(cx, cy - 8, "RADIANCE", { ...TEXT.title, letterSpacing: 8 }).setOrigin(0.5);
    this.status = this.add
      .text(cx, cy + 92, "Kindling the lamps…", { ...TEXT.small, color: COLORS.textDim })
      .setOrigin(0.5);
    this.add
      .text(GRID * 3, GAME_H - GRID * 3, VERSION, TEXT.tiny)
      .setOrigin(0, 1)
      .setAlpha(0.7);
  }

  private drawBar(): void {
    const g = this.bar;
    const x = Math.round((GAME_W - BAR_W) / 2);
    const y = Math.round(GAME_H / 2 + 52);
    g.clear();
    g.fillStyle(COLOR_NUM.ink, 1);
    g.fillRect(x - 6, y - 6, BAR_W + 12, BAR_H + 12);
    g.fillStyle(hexNum(RAMPS.steel[1]), 1);
    g.fillRect(x - 3, y - 3, BAR_W + 6, BAR_H + 6);
    g.fillStyle(COLOR_NUM.bg, 1);
    g.fillRect(x, y, BAR_W, BAR_H);
    // segmented fill (12px cells, 3px gaps), lamp ramp
    const cells = Math.floor((BAR_W - 3) / 12);
    const lit = this.shown * cells;
    for (let i = 0; i < cells; i++) {
      const cx = x + 3 + i * 12;
      if (i < Math.floor(lit)) {
        g.fillStyle(hexNum(RAMPS.lamp[2]), 1);
        g.fillRect(cx, y + 3, 9, BAR_H - 6);
        g.fillStyle(hexNum(RAMPS.lamp[4]), 1);
        g.fillRect(cx, y + 3, 9, 3);
      } else if (i === Math.floor(lit)) {
        g.fillStyle(hexNum(RAMPS.lamp[1]), 1);
        g.fillRect(cx, y + 3, 9, BAR_H - 6);
      } else {
        g.fillStyle(hexNum(RAMPS.void[2]), 1);
        g.fillRect(cx, y + 3, 9, BAR_H - 6);
      }
    }
  }
}

function chunk<T>(arr: readonly T[], n: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n));
  return out;
}
