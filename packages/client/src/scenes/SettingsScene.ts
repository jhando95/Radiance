/**
 * Settings: audio sliders, gameplay options, display, and the player's callsign. Every change
 * applies live and persists immediately. Can run as a full screen (from the title) or as an
 * overlay above a paused game (from the pause menu): pass `{ overlay: true, returnTo }`.
 */
import * as Phaser from "phaser";
import { SCENES } from "../app/scenes";
import {
  ANIMATION_SPEEDS,
  type AnimationSpeed,
  getSettings,
  PLAYER_NAME_MAX,
  resetSettings,
  type Settings,
  TEXT_SIZES,
  type TextSize,
  updateSettings,
} from "../app/settings";
import { goTo } from "../app/transitions";
import { Button } from "../ui/Button";
import { type Focusable, FocusGroup } from "../ui/focus";
import { confirmDialog } from "../ui/Modal";
import { createPanel } from "../ui/Panel";
import type { Row } from "../ui/Row";
import { Selector } from "../ui/Selector";
import { Slider } from "../ui/Slider";
import { addBackdrop, addHeader, addKeyHint } from "../ui/screen";
import { TextField } from "../ui/TextInput";
import { toast } from "../ui/Toast";
import { Toggle } from "../ui/Toggle";
import {
  COLOR_NUM,
  COLORS,
  DISPLAY_FONT,
  GAME_H,
  GAME_W,
  GRID,
  playUiSound,
  TEXT,
} from "../ui/theme";

export interface SubScreenData {
  /** Scene to return to (default: title). */
  returnTo?: string;
  /** Running above a paused/sleeping scene: Back stops this scene and wakes `returnTo`. */
  overlay?: boolean;
}

interface SettingsData extends SubScreenData {
  /** Focus this row index on create (used when the scene rebuilds for a text size change). */
  focus?: number;
}

const TEXT_SIZE_LABEL: Record<TextSize, string> = { normal: "Normal", large: "Large" };

/** Shared Back behaviour for shell sub-screens (settings, how to play, credits). */
export function leaveSubScreen(scene: Phaser.Scene, data: SubScreenData): void {
  playUiSound("back");
  const to = data.returnTo ?? SCENES.title;
  if (data.overlay) {
    scene.scene.stop();
    const target = scene.scene.get(to);
    if (target && scene.scene.isSleeping(to)) scene.scene.wake(to);
    else if (target && scene.scene.isPaused(to)) scene.scene.resume(to);
    return;
  }
  goTo(scene, to);
}

const COL_W = 504;
const ROW_H = 48;

export class SettingsScene extends Phaser.Scene {
  private data_: SettingsData = {};
  private hint!: Phaser.GameObjects.Text;
  private controls: {
    master?: Slider;
    music?: Slider;
    sfx?: Slider;
    speed?: Selector<AnimationSpeed>;
    shake?: Toggle;
    numbers?: Toggle;
    colorblind?: Toggle;
    fullscreen?: Toggle;
    textSize?: Selector<TextSize>;
    name?: TextField;
  } = {};

  constructor() {
    super({ key: SCENES.settings });
  }

  init(data: SettingsData): void {
    this.data_ = data ?? {};
    this.controls = {};
  }

  create(): void {
    if (this.data_.overlay) {
      this.add.rectangle(0, 0, GAME_W, GAME_H, COLOR_NUM.ink, 0.86).setOrigin(0).setInteractive();
    } else {
      this.cameras.main.setBackgroundColor(COLORS.bg);
      addBackdrop(this, { dim: 0.55, embers: false });
    }
    addHeader(this, "Settings", "Changes save automatically");

    const panelTop = 100;
    const panelH = 516;
    createPanel(this, GAME_W / 2, panelTop, 1104, panelH, { originX: 0.5, originY: 0 });
    const leftX = GAME_W / 2 - 536;
    const rightX = GAME_W / 2 + 32;
    // column separator
    this.add
      .rectangle(GAME_W / 2, panelTop + 32, 2, panelH - 128, COLOR_NUM.line, 0.6)
      .setOrigin(0.5, 0);

    const s = getSettings();
    const rows: Array<{ row: Row; hint: string }> = [];
    const pct = (v: number) => `${Math.round(v * 100)}%`;

    let y = panelTop + 40;
    this.section(leftX, y, "Audio");
    y += 44;
    this.controls.master = new Slider(this, leftX, y, {
      label: "Master volume",
      width: COL_W,
      value: s.masterVolume,
      format: pct,
      onChange: (v) => updateSettings({ masterVolume: v }),
    });
    rows.push({ row: this.controls.master, hint: "Overall loudness." });
    y += ROW_H;
    this.controls.music = new Slider(this, leftX, y, {
      label: "Music",
      width: COL_W,
      value: s.musicVolume,
      format: pct,
      onChange: (v) => updateSettings({ musicVolume: v }),
    });
    rows.push({ row: this.controls.music, hint: "Ambient score and stingers." });
    y += ROW_H;
    this.controls.sfx = new Slider(this, leftX, y, {
      label: "Effects",
      width: COL_W,
      value: s.sfxVolume,
      format: pct,
      onChange: (v) => updateSettings({ sfxVolume: v }),
    });
    rows.push({ row: this.controls.sfx, hint: "Combat, interface and world sounds." });
    y += ROW_H + 24;
    this.section(leftX, y, "Profile");
    y += 44;
    this.controls.name = new TextField(this, leftX, y, {
      label: "Callsign",
      width: COL_W,
      value: s.playerName,
      placeholder: "Your name",
      maxLength: PLAYER_NAME_MAX,
      allow: /[\p{L}\p{N} _\-'.]/u,
      onChange: (v) => updateSettings({ playerName: v.trim() }),
      onSubmit: () => this.controls.name?.field.blur(),
    });
    rows.push({ row: this.controls.name, hint: "Shown to your squadmates in co-op." });

    y = panelTop + 40;
    this.section(rightX, y, "Gameplay");
    y += 44;
    this.controls.speed = new Selector<AnimationSpeed>(this, rightX, y, {
      label: "Animation speed",
      width: COL_W,
      value: s.animationSpeed,
      options: ANIMATION_SPEEDS.map((v) => ({ value: v, label: `${v}x` })),
      onChange: (v) => updateSettings({ animationSpeed: v }),
    });
    rows.push({ row: this.controls.speed, hint: "How fast attacks and effects play out." });
    y += ROW_H;
    this.controls.shake = new Toggle(this, rightX, y, {
      label: "Screen shake",
      width: COL_W,
      value: s.screenShake,
      onChange: (v) => updateSettings({ screenShake: v }),
    });
    rows.push({ row: this.controls.shake, hint: "Camera shake on heavy hits and explosions." });
    y += ROW_H;
    this.controls.numbers = new Toggle(this, rightX, y, {
      label: "Damage numbers",
      width: COL_W,
      value: s.damageNumbers,
      onChange: (v) => updateSettings({ damageNumbers: v }),
    });
    rows.push({ row: this.controls.numbers, hint: "Floating numbers for damage and healing." });
    y += ROW_H;
    this.controls.colorblind = new Toggle(this, rightX, y, {
      label: "Colorblind intents",
      width: COL_W,
      value: s.colorblindIntents,
      onChange: (v) => updateSettings({ colorblindIntents: v }),
    });
    rows.push({
      row: this.controls.colorblind,
      hint: "Add shapes and patterns to enemy intents and damage types, not just color.",
    });
    y += ROW_H + 24;
    this.section(rightX, y, "Display");
    y += 44;
    this.controls.fullscreen = new Toggle(this, rightX, y, {
      label: "Fullscreen",
      width: COL_W,
      value: this.scale.isFullscreen,
      onChange: () => this.toggleFullscreen(),
    });
    rows.push({
      row: this.controls.fullscreen,
      hint: "Fill the whole screen. Press Esc to leave.",
    });
    y += ROW_H;
    const textSizeRow = rows.length;
    this.controls.textSize = new Selector<TextSize>(this, rightX, y, {
      label: "Text size",
      width: COL_W,
      value: s.textSize,
      options: TEXT_SIZES.map((v) => ({ value: v, label: TEXT_SIZE_LABEL[v] })),
      onChange: (v) => this.setTextSize(v, textSizeRow),
    });
    rows.push({
      row: this.controls.textSize,
      hint: "Larger text across menus and the battlefield.",
    });

    // Hint strip at the bottom of the panel.
    const hintY = panelTop + panelH - 40;
    this.add.rectangle(GAME_W / 2, hintY - 22, 1104 - 64, 2, COLOR_NUM.line, 0.6).setOrigin(0.5, 0);
    this.hint = this.add
      .text(GAME_W / 2, hintY + 6, "", { ...TEXT.small, color: COLORS.textDim })
      .setOrigin(0.5);

    // Footer buttons.
    const footY = GAME_H - 54;
    const back = new Button(this, GAME_W / 2 - 136, footY, {
      label: "Back",
      kind: "primary",
      width: 240,
      onClick: () => this.back(),
    });
    const reset = new Button(this, GAME_W / 2 + 136, footY, {
      label: "Reset defaults",
      width: 240,
      onClick: () => void this.reset(),
    });
    addKeyHint(this, "Esc  back   ·   Left / Right  adjust");

    const items: Focusable[] = [...rows.map((r) => r.row), back, reset];
    const hints = new Map<Focusable, string>(rows.map((r) => [r.row, r.hint]));
    hints.set(back, "Return to the previous screen.");
    hints.set(reset, "Restore every setting to its default (keeps your callsign).");
    new FocusGroup(this, items, {
      onBack: () => this.back(),
      onFocus: (item) => this.hint.setText(hints.get(item) ?? ""),
      initial: Math.min(Math.max(0, this.data_.focus ?? 0), items.length - 1),
    });

    const onFs = () => this.controls.fullscreen?.setValue(this.scale.isFullscreen);
    this.scale.on(Phaser.Scale.Events.ENTER_FULLSCREEN, onFs);
    this.scale.on(Phaser.Scale.Events.LEAVE_FULLSCREEN, onFs);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.scale.off(Phaser.Scale.Events.ENTER_FULLSCREEN, onFs);
      this.scale.off(Phaser.Scale.Events.LEAVE_FULLSCREEN, onFs);
    });
  }

  private section(x: number, y: number, label: string): void {
    this.add
      .text(x + GRID * 2, y, label.toUpperCase(), {
        ...TEXT.small,
        fontFamily: DISPLAY_FONT,
        fontStyle: "700",
        color: COLORS.accent,
        letterSpacing: 3,
      })
      .setOrigin(0, 0.5);
    this.add
      .rectangle(x + GRID * 2, y + 17, COL_W - GRID * 4, 2, COLOR_NUM.line, 0.7)
      .setOrigin(0, 0.5);
  }

  /** Text size changes rebuild the screen so every label picks up the new TEXT sizes. */
  private setTextSize(size: TextSize, rowIndex: number): void {
    updateSettings({ textSize: size });
    this.controls.name?.field.blur();
    this.time.delayedCall(120, () => this.scene.restart({ ...this.data_, focus: rowIndex }));
  }

  private toggleFullscreen(): void {
    try {
      this.scale.toggleFullscreen();
    } catch {
      toast(this, "Fullscreen isn't available here.", "error");
    }
    // The browser may refuse; resync once it has decided.
    this.time.delayedCall(300, () => this.controls.fullscreen?.setValue(this.scale.isFullscreen));
  }

  private async reset(): Promise<void> {
    const ok = await confirmDialog(this, {
      title: "Reset settings?",
      body: "Volumes and options go back to their defaults. Your callsign is kept.",
      confirmLabel: "Reset",
    });
    if (!ok) return;
    const name = getSettings().playerName;
    const server = getSettings().lastServerUrl;
    const before = getSettings().textSize;
    resetSettings();
    const s: Settings = { ...getSettings(), playerName: name, lastServerUrl: server };
    updateSettings(s);
    const c = this.controls;
    c.master?.setValue(s.masterVolume);
    c.music?.setValue(s.musicVolume);
    c.sfx?.setValue(s.sfxVolume);
    c.speed?.setValue(s.animationSpeed);
    c.shake?.setValue(s.screenShake);
    c.numbers?.setValue(s.damageNumbers);
    c.colorblind?.setValue(s.colorblindIntents);
    c.textSize?.setValue(s.textSize);
    toast(this, "Settings restored to defaults.", "success");
    if (s.textSize !== before) this.time.delayedCall(150, () => this.scene.restart(this.data_));
  }

  private back(): void {
    this.controls.name?.field.blur();
    leaveSubScreen(this, this.data_);
  }
}
