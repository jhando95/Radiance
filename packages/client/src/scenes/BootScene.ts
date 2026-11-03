/**
 * Boot / loading screen. Waits for the UI fonts (Cinzel + Alegreya Sans, every weight we use)
 * and the optional HD art modules, then generates and caches the procedural textures a frame
 * at a time behind a lamp-lit progress bar, launches the UI overlay and fades into the title
 * (or a `?debug=` route in dev builds).
 */
import * as Phaser from "phaser";
import { RENDER_SCALE } from "../app/hires";
import { SCENES } from "../app/scenes";
import {
  enemyTexture,
  ensureFxTextures,
  ensureIconTextures,
  ensureUiTextures,
  iconTexture,
  loadHdArt,
  logoTexture,
  mapBackdropTexture,
  mercTexture,
  TEX,
} from "../app/textures";
import { goTo } from "../app/transitions";
import { VERSION } from "../app/version";
import { hexNum, RAMPS } from "../art/palette";
import { hdArtStatus, iconIds } from "../ui/artAdapter";
import {
  COLOR_NUM,
  COLORS,
  DISPLAY_FONT,
  FONT_FACES,
  fontPx,
  GAME_H,
  GAME_W,
  GRID,
  TEXT,
} from "../ui/theme";

const BAR_W = 420;
const BAR_H = 6;
const BAR_Y = GAME_H / 2 + 96;
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

/** Load every family/weight in FONT_FACES (canvas text never triggers font loads itself). */
async function waitForFonts(): Promise<void> {
  if (!("fonts" in document)) return;
  const timeout = new Promise<void>((r) => setTimeout(r, 4000));
  const load = Promise.all(
    FONT_FACES.map((f) =>
      document.fonts.load(`${f.weight} 20px "${f.family}"`, "Radiance fi fl 0123").catch(() => []),
    ),
  ).then(() => document.fonts.ready);
  await Promise.race([load.then(() => undefined), timeout]).catch(() => undefined);
}

export class BootScene extends Phaser.Scene {
  private bar!: Phaser.GameObjects.Graphics;
  private shown = 0;
  private target = 0;
  private status: Phaser.GameObjects.Text | null = null;
  private glow: Phaser.GameObjects.Image | null = null;
  private head: Phaser.GameObjects.Image | null = null;

  constructor() {
    super({ key: SCENES.boot });
  }

  create(): void {
    // Boot starts before installHiRes can hook it, so fit the camera to 1080p here.
    this.cameras.main.setZoom(RENDER_SCALE).centerOn(GAME_W / 2, GAME_H / 2);
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
    if (this.glow) this.glow.setAlpha(0.18 + this.shown * 0.3 + Math.random() * 0.04);
  }

  private async run(): Promise<void> {
    const started = performance.now();
    await Promise.all([waitForFonts(), loadHdArt()]);
    if (import.meta.env.DEV) console.info("HD art modules:", hdArtStatus());
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
      .image(cx, cy + 10, TEX.glow)
      .setDisplaySize(900, 460)
      .setTint(COLOR_NUM.accent)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setAlpha(0.18)
      .setDepth(-1);
    this.add.image(cx, cy, TEX.vignette).setDisplaySize(GAME_W, GAME_H).setDepth(-2);

    const lampY = cy - 110;
    const lampGlow = this.add
      .image(cx, lampY, TEX.glow)
      .setDisplaySize(170, 170)
      .setTint(COLOR_NUM.accentBright)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setAlpha(0.45);
    const lamp = this.add.image(cx, lampY, iconTexture(this, "ui_lamp")).setDisplaySize(64, 64);
    this.tweens.add({
      targets: [lamp, lampGlow],
      y: lampY - 5,
      duration: 1600,
      yoyo: true,
      repeat: -1,
      ease: "Sine.inOut",
    });
    this.tweens.add({
      targets: lampGlow,
      alpha: 0.3,
      duration: 140,
      yoyo: true,
      repeat: -1,
      repeatDelay: 900,
    });

    const logo = logoTexture(this);
    if (logo.hd) {
      const img = this.add.image(cx, cy - 6, logo.key);
      img.setScale(Math.min(1 / 1.5, 600 / img.width));
    } else {
      this.add
        .text(cx, cy - 10, "RADIANCE", {
          ...TEXT.display,
          fontSize: "76px",
          letterSpacing: 14,
        })
        .setOrigin(0.5);
    }
    this.add
      .text(cx, cy + 48, "SCAVENGERS OF THE SUNLESS MOONS", {
        ...TEXT.small,
        fontFamily: DISPLAY_FONT,
        fontStyle: "700",
        fontSize: fontPx(15, 0.5),
        letterSpacing: 4,
        color: COLORS.textDim,
      })
      .setOrigin(0.5);

    this.head = this.add
      .image(0, BAR_Y + BAR_H / 2, TEX.glow)
      .setDisplaySize(64, 40)
      .setTint(COLOR_NUM.accentBright)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setAlpha(0);
    this.status = this.add
      .text(cx, BAR_Y + 34, "Kindling the lamps…", { ...TEXT.small, color: COLORS.textDim })
      .setOrigin(0.5);
    this.add.text(GRID * 3, GAME_H - GRID * 3, VERSION, TEXT.tiny).setOrigin(0, 1);
  }

  private drawBar(): void {
    const g = this.bar;
    const x = Math.round((GAME_W - BAR_W) / 2);
    const y = BAR_Y;
    const r = BAR_H / 2;
    g.clear();
    // groove
    g.fillStyle(COLOR_NUM.ink, 0.95);
    g.fillRoundedRect(x - 3, y - 3, BAR_W + 6, BAR_H + 6, r + 3);
    g.lineStyle(1, hexNum(RAMPS.lamp[0]), 1);
    g.strokeRoundedRect(x - 3, y - 3, BAR_W + 6, BAR_H + 6, r + 3);
    // lamp-light fill
    const fw = Math.round(BAR_W * this.shown);
    if (fw > BAR_H) {
      g.fillStyle(hexNum(RAMPS.lamp[2]), 1);
      g.fillRoundedRect(x, y, fw, BAR_H, r);
      g.fillStyle(hexNum(RAMPS.lamp[4]), 1);
      g.fillRoundedRect(x + 1, y, fw - 2, BAR_H / 2, { tl: r, tr: r, bl: 0, br: 0 });
    }
    if (this.head) {
      this.head.setX(x + fw).setAlpha(fw > BAR_H ? 0.85 : 0);
    }
  }
}

function chunk<T>(arr: readonly T[], n: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n));
  return out;
}
