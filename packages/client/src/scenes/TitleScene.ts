/**
 * Title / main menu. Moon-horizon backdrop with parallax drift, dust and embers, a flickering
 * lamp glow behind the logo and menu, and a keyboard-navigable menu. Menu actions go through
 * `flow.handlers` (registered by gameplay code).
 */
import * as Phaser from "phaser";
import { flow } from "../app/flow";
import { SCENES } from "../app/scenes";
import { getSettings, PLAYER_NAME_MAX, updateSettings } from "../app/settings";
import { hasTexture, TEX } from "../app/textures";
import { goTo } from "../app/transitions";
import { VERSION } from "../app/version";
import { type MenuEntry, createMenuList } from "../ui/MenuList";
import { promptDialog } from "../ui/Modal";
import { addBackdrop } from "../ui/screen";
import { COLOR_NUM, COLORS, GAME_H, GAME_W, GRID, TEXT } from "../ui/theme";
import { toast } from "../ui/Toast";

const NAME_ALLOW = /[\p{L}\p{N} _\-'.]/u;
const CODE_ALLOW = /[A-Z0-9]/;

/** True when running inside a desktop wrapper (Electron / Tauri) that can quit. */
export function isDesktopApp(): boolean {
  const w = window as unknown as Record<string, unknown>;
  return "__TAURI__" in w || "__TAURI_INTERNALS__" in w || /Electron/i.test(navigator.userAgent);
}

function quitApp(): void {
  const w = window as unknown as {
    __TAURI__?: { process?: { exit?: (code?: number) => void } };
    electronAPI?: { quit?: () => void };
  };
  try {
    if (w.electronAPI?.quit) w.electronAPI.quit();
    else if (w.__TAURI__?.process?.exit) w.__TAURI__.process.exit(0);
    else window.close();
  } catch {
    window.close();
  }
}

export class TitleScene extends Phaser.Scene {
  private busy = false;

  constructor() {
    super({ key: SCENES.title });
  }

  create(): void {
    this.busy = false;
    this.cameras.main.setBackgroundColor(COLORS.bg);
    addBackdrop(this, { seed: 7 });

    // Warm lamp light pooling behind logo and menu.
    const glow = this.add
      .image(GAME_W / 2, 360, TEX.glow)
      .setDisplaySize(1100, 760)
      .setTint(COLOR_NUM.accent)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setAlpha(0.16)
      .setDepth(-40);
    const core = this.add
      .image(GAME_W / 2, 180, TEX.glow)
      .setDisplaySize(720, 220)
      .setTint(COLOR_NUM.accentBright)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setAlpha(0.14)
      .setDepth(-39);
    this.flicker([glow, core]);

    // Darken behind the menu so text reads against the horizon.
    this.add
      .image(GAME_W / 2, 476, TEX.glow)
      .setDisplaySize(620, 460)
      .setTint(COLOR_NUM.ink)
      .setAlpha(0.75)
      .setDepth(-38);

    this.buildLogo();
    this.buildMenu();

    this.add
      .text(GRID * 3, GAME_H - GRID * 2, VERSION, TEXT.tiny)
      .setOrigin(0, 1)
      .setAlpha(0.7);
    this.add
      .text(GAME_W - GRID * 3, GAME_H - GRID * 2, "a game by jhando95", TEXT.tiny)
      .setOrigin(1, 1)
      .setAlpha(0.7);
    this.add
      .text(GAME_W / 2, GAME_H - GRID * 2, "Arrows  select   ·   Enter  confirm", TEXT.tiny)
      .setOrigin(0.5, 1)
      .setAlpha(0.55);
  }

  private flicker(targets: Phaser.GameObjects.Image[]): void {
    const base = targets.map((t) => t.alpha);
    this.time.addEvent({
      delay: 90,
      loop: true,
      callback: () => {
        const n = Math.random();
        // Mostly steady, with an occasional dip like a guttering flame.
        const k = n > 0.96 ? 0.55 : n > 0.85 ? 0.85 : 0.95 + Math.random() * 0.1;
        targets.forEach((t, i) => {
          this.tweens.add({ targets: t, alpha: (base[i] ?? 0.15) * k, duration: 80 });
        });
      },
    });
  }

  private buildLogo(): void {
    const y = 156;
    let logo: Phaser.GameObjects.Image | Phaser.GameObjects.Text;
    if (hasTexture(this, TEX.logo)) {
      logo = this.add.image(GAME_W / 2, y, TEX.logo).setScale(4);
    } else {
      logo = this.add
        .text(GAME_W / 2, y, "RADIANCE", {
          ...TEXT.display,
          fontSize: "96px",
          letterSpacing: 12,
          stroke: COLORS.accentDeep,
          strokeThickness: 6,
          shadow: { offsetX: 0, offsetY: 6, color: COLORS.ink, blur: 0, fill: true, stroke: true },
        })
        .setOrigin(0.5);
    }
    const sub = this.add
      .text(GAME_W / 2, y + 76, "SCAVENGERS  OF  THE  SUNLESS  MOONS", {
        ...TEXT.small,
        color: COLORS.textDim,
        letterSpacing: 4,
      })
      .setOrigin(0.5);
    logo.setAlpha(0);
    sub.setAlpha(0);
    this.tweens.add({
      targets: logo,
      alpha: 1,
      y: { from: y + 12, to: y },
      duration: 900,
      ease: "Quad.out",
    });
    this.tweens.add({ targets: sub, alpha: 0.9, duration: 900, delay: 500 });
  }

  private buildMenu(): void {
    const h = flow.handlers;
    const entries: MenuEntry[] = [];
    if (h?.resume && (h.canResume?.() ?? true)) {
      entries.push({ label: "Resume Expedition", onSelect: () => this.run(() => h.resume?.(this)) });
    }
    entries.push(
      { label: "New Expedition (Solo)", onSelect: () => this.startSolo() },
      { label: "Host Co-op", onSelect: () => void this.hostCoop() },
      { label: "Join Co-op", onSelect: () => void this.joinCoop() },
      { label: "Settings", onSelect: () => this.open(SCENES.settings) },
      { label: "How to Play", onSelect: () => this.open(SCENES.howToPlay) },
      { label: "Credits", onSelect: () => this.open(SCENES.credits) },
    );
    if (isDesktopApp()) entries.push({ label: "Quit", onSelect: () => quitApp() });

    const spacing = entries.length > 7 ? 40 : 44;
    const top = 300 + (7 - entries.length) * 10;
    const menu = createMenuList(this, GAME_W / 2, top, entries, { spacing, width: 420 });
    menu.items.forEach((item, i) => {
      item.setAlpha(0);
      this.tweens.add({
        targets: item,
        alpha: 1,
        x: { from: -12, to: 0 },
        duration: 420,
        delay: 500 + i * 60,
        ease: "Quad.out",
      });
    });
  }

  private open(key: string): void {
    if (this.busy) return;
    goTo(this, key, { returnTo: SCENES.title });
  }

  private run(fn: () => void): void {
    if (this.busy) return;
    try {
      fn();
    } catch (err) {
      console.error(err);
      toast(this, "Something went wrong. Check the console.", "error");
    }
  }

  private startSolo(): void {
    const h = flow.handlers;
    if (!h) return toast(this, "Coming soon");
    this.run(() => h.startSolo(this));
  }

  private async hostCoop(): Promise<void> {
    const h = flow.handlers;
    if (!h) return toast(this, "Coming soon");
    const values = await promptDialog(this, {
      title: "Host Co-op",
      body: "Open a room and share its code with up to three friends.",
      fields: [this.nameField()],
      confirmLabel: "Open Room",
    });
    if (!values) return;
    const name = this.rememberName(values.name);
    this.run(() => h.hostOnline(this, name));
  }

  private async joinCoop(): Promise<void> {
    const h = flow.handlers;
    if (!h) return toast(this, "Coming soon");
    const values = await promptDialog(this, {
      title: "Join Co-op",
      body: "Enter the room code your host shared.",
      fields: [
        this.nameField(),
        {
          key: "code",
          label: "Room code",
          placeholder: "ABCD",
          maxLength: 6,
          uppercase: true,
          allow: CODE_ALLOW,
          className: "rad-input--code",
        },
      ],
      confirmLabel: "Join",
      validate: (v) => ((v.code ?? "").length < 4 ? "Room codes are 4–6 characters." : null),
    });
    if (!values) return;
    const name = this.rememberName(values.name);
    const code = (values.code ?? "").toUpperCase();
    this.run(() => h.joinOnline(this, name, code));
  }

  private nameField() {
    return {
      key: "name",
      label: "Your callsign",
      value: getSettings().playerName,
      placeholder: "Callsign",
      maxLength: PLAYER_NAME_MAX,
      allow: NAME_ALLOW,
    };
  }

  private rememberName(raw: string | undefined): string {
    const name = (raw ?? "").trim().slice(0, PLAYER_NAME_MAX) || "Merc";
    updateSettings({ playerName: name });
    return name;
  }
}
