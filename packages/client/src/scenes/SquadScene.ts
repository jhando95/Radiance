/**
 * Squad builder / character creator. Each player crafts 1–4 mercenaries: name, discipline,
 * origin, appearance and a 4-skill loadout, with a live animated preview and stat readout.
 *
 * Launch with `scene.start("squad", data as SquadSceneData)`. The scene never decides what
 * happens next: `onConfirm` receives validated setups and the caller moves on.
 */
import {
  APPEARANCE_OPTIONS,
  DISCIPLINE_IDS,
  describeSkill,
  formatMods,
  getDiscipline,
  getOrigin,
  getSkill,
  type MercSetup,
  ORIGIN_IDS,
  type Stats,
  skillIcon,
} from "@radiance/core";
import * as Phaser from "phaser";
import { SCENES } from "../app/scenes";
import { ensureUiTextures, mapBackdropTexture, TEX } from "../app/textures";
import { ensureMercPortrait, ensureMercTexture, lookFromSetup, type MercPose } from "../art/look";
import { ELEMENT_COLORS, hexNum, RAMPS } from "../art/palette";
import { Button } from "../ui/Button";
import { createDivider, createPanel, setPanelVariant } from "../ui/Panel";
import { TextInput } from "../ui/TextInput";
import { COLOR_NUM, COLORS, DURATION, GRID, playUiSound, TEXT } from "../ui/theme";
import {
  APPEARANCE_ROWS,
  type AppearanceKey,
  defaultSetups,
  finalizeSetup,
  freshSeed,
  previewStats,
  randomAppearance,
  sanitizeSetup,
  setupProblem,
  uiRng,
} from "./squad/data";
import { MAX_NAME_LENGTH, randomName } from "./squad/names";
import { ensureStageTextures, STAGE_TEX } from "./squad/stage";
import { addArrow, addIcon, drawRankPips, noLig, OptionRow, Tooltip } from "./squad/widgets";

export interface SquadSceneData {
  /** How many mercs this player creates (1–4). */
  slots: number;
  /** e.g. "Assemble your squad" / "Your mercenaries (2 of 4)". */
  title?: string;
  /** Prefill. */
  initial?: MercSetup[];
  onConfirm: (setups: MercSetup[]) => void;
  onBack?: () => void;
}

// ---------------------------------------------------------------------------------------
// Layout (1280x720, 8px grid)

const LAYOUT = {
  top: 56,
  slots: { x: 16, w: 240, cardH: 84, gap: 8 },
  preview: { x: 264, y: 56, w: 440, h: 360 },
  bottom: { x: 16, y: 424, w: 688, h: 232 },
  right: { x: 720, w: 544 },
  disc: { y: 56, h: 128 },
  origin: { y: 192, h: 144 },
  look: { y: 344, h: 312 },
  footerY: 688,
} as const;

const SPRITE_SCALE = 5;
const STAGE_X = LAYOUT.preview.x + LAYOUT.preview.w / 2;
const FEET_Y = 344;

const DISC_COLORS: Record<string, string> = {
  vanguard: RAMPS.steel[3],
  gunner: RAMPS.rust[3],
  lamplighter: RAMPS.lamp[3],
  reaver: RAMPS.toxic[3],
  hexer: RAMPS.umbra[3],
};

const STAT_CELLS: { key: string; icon: string; label: string; value: (s: Stats) => string }[] = [
  { key: "hp", icon: "stat_hp", label: "Health", value: (s) => `${s.maxHp}` },
  { key: "speed", icon: "stat_speed", label: "Speed", value: (s) => `${s.speed}` },
  { key: "acc", icon: "stat_acc", label: "Accuracy", value: (s) => `${s.acc}` },
  { key: "dodge", icon: "stat_dodge", label: "Dodge", value: (s) => `${s.dodge}` },
  { key: "crit", icon: "stat_crit", label: "Crit", value: (s) => `${s.crit}%` },
  { key: "prot", icon: "stat_prot", label: "Protection", value: (s) => `${s.prot}%` },
  { key: "dmg", icon: "stat_dmg", label: "Damage", value: (s) => `${s.dmgMin}–${s.dmgMax}` },
];

const STAT_SCORE: Record<string, (s: Stats) => number> = {
  hp: (s) => s.maxHp,
  speed: (s) => s.speed,
  acc: (s) => s.acc,
  dodge: (s) => s.dodge,
  crit: (s) => s.crit,
  prot: (s) => s.prot,
  dmg: (s) => s.dmgMin + s.dmgMax,
};

const FIELD_NOTES = [
  "Skills only work from certain ranks. Hover one to see where it can be used and what it reaches.",
  "Origins stack permanent bonuses on top of a discipline.",
  "Light keeps the dark at bay. Bring someone who can carry it.",
];

interface SlotCard {
  bg: Phaser.GameObjects.NineSlice;
  container: Phaser.GameObjects.Container;
  portrait: Phaser.GameObjects.Image;
  name: Phaser.GameObjects.Text;
  disc: Phaser.GameObjects.Text;
  warn: Phaser.GameObjects.Text;
}

interface SkillSlot {
  id: string;
  container: Phaser.GameObjects.Container;
  frame: Phaser.GameObjects.Image;
  icon: Phaser.GameObjects.Container;
  label: Phaser.GameObjects.Text;
  badge: Phaser.GameObjects.Graphics;
  x: number;
  y: number;
}

const NAME_INPUT_CSS = `
:where(.squad-name) {
  box-sizing: border-box; height: 40px; padding: 0 12px; margin: 0;
  font: 20px "Pixelify Sans", "Courier New", monospace; color: ${COLORS.text};
  background: ${RAMPS.void[0]}; border: 3px solid ${RAMPS.steel[2]}; border-radius: 0;
  font-variant-ligatures: none; outline: none; box-shadow: inset 0 3px 0 ${COLORS.ink}; caret-color: ${COLORS.accent};
}
:where(.squad-name):hover { border-color: ${RAMPS.steel[3]}; }
:where(.squad-name):focus { border-color: ${COLORS.accent}; }
:where(.squad-name)::placeholder { color: ${RAMPS.steel[3]}; }
`;

function injectInputCss(): void {
  if (document.getElementById("squad-name-css")) return;
  const style = document.createElement("style");
  style.id = "squad-name-css";
  style.textContent = NAME_INPUT_CSS;
  document.head.prepend(style);
}

export class SquadScene extends Phaser.Scene {
  private cfg!: SquadSceneData;
  private setups: MercSetup[] = [];
  private current = 0;
  private pose: MercPose = "idle0";
  private poseUntil = 0;
  private lastStats: { slot: number; stats: Stats } | null = null;
  private confirmLockedUntil = 0;

  private cards: SlotCard[] = [];
  private sprite!: Phaser.GameObjects.Image;
  private glow!: Phaser.GameObjects.Image;
  private nameInput!: TextInput;
  private discIcon: Phaser.GameObjects.Container | null = null;
  private discName!: Phaser.GameObjects.Text;
  private discBlurb!: Phaser.GameObjects.Text;
  private discPips!: Phaser.GameObjects.Graphics;
  private originName!: Phaser.GameObjects.Text;
  private originBlurb!: Phaser.GameObjects.Text;
  private originMods!: Phaser.GameObjects.Container;
  private rows = new Map<AppearanceKey, OptionRow>();
  private skillSlots: SkillSlot[] = [];
  private skillCount!: Phaser.GameObjects.Text;
  private statValues = new Map<string, Phaser.GameObjects.Text>();
  private confirmBtn!: Button;
  private confirmHint!: Phaser.GameObjects.Text;
  private tooltip!: Tooltip;
  private hoveredSkill: string | null = null;
  private readonly onWindowKey = (e: KeyboardEvent) => this.handleKey(e);

  constructor() {
    super({ key: SCENES.squad });
  }

  init(data: SquadSceneData): void {
    this.cfg = data;
    const slots = Phaser.Math.Clamp(Math.floor(data.slots || 1), 1, 4);
    const defaults = defaultSetups(slots);
    this.setups = defaults.map((d, i) => {
      const given = data.initial?.[i];
      return given ? sanitizeSetup(given, d) : d;
    });
    this.current = 0;
    this.pose = "idle0";
    this.poseUntil = 0;
    this.lastStats = null;
    this.confirmLockedUntil = 0;
    this.cards = [];
    this.rows = new Map();
    this.skillSlots = [];
    this.statValues = new Map();
    this.discIcon = null;
    this.hoveredSkill = null;
  }

  create(): void {
    ensureUiTextures(this);
    ensureStageTextures(this);
    injectInputCss();
    this.buildBackdrop();
    this.buildHeader();
    this.buildSlotCards();
    this.buildPreview();
    this.buildDiscipline();
    this.buildOrigin();
    this.buildAppearance();
    this.buildSkills();
    this.buildFooter();
    this.tooltip = new Tooltip(this);

    this.time.addEvent({
      delay: 500,
      loop: true,
      callback: () => {
        if (this.time.now < this.poseUntil) return;
        this.pose = this.pose === "idle0" ? "idle1" : "idle0";
        this.applySprite();
      },
    });

    // Clicking anywhere on the canvas ends name editing (Phaser keeps DOM focus otherwise).
    this.input.on(Phaser.Input.Events.POINTER_DOWN, () => {
      if (document.activeElement === this.nameInput.el) this.nameInput.blur();
    });
    window.addEventListener("keydown", this.onWindowKey);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      window.removeEventListener("keydown", this.onWindowKey);
    });
    if (!this.game.domContainer) {
      console.warn("SquadScene: game config needs dom.createContainer = true for the name field");
    }
    this.refresh();
  }

  // -------------------------------------------------------------------------------------
  // State helpers

  private get setup(): MercSetup {
    return this.setups[this.current] as MercSetup;
  }

  private update_(mutate: (s: MercSetup) => void): void {
    mutate(this.setup);
    this.refresh();
  }

  // -------------------------------------------------------------------------------------
  // Build

  private buildBackdrop(): void {
    const { width, height } = this.scale;
    this.add.rectangle(0, 0, width, height, COLOR_NUM.bg).setOrigin(0);
    this.add
      .image(0, 0, mapBackdropTexture(this, 3))
      .setOrigin(0)
      .setDisplaySize(width, height)
      .setAlpha(0.3);
    this.add.image(0, 0, TEX.vignette).setOrigin(0).setDisplaySize(width, height);
  }

  private buildHeader(): void {
    const title = this.cfg.title ?? "Assemble your squad";
    this.add.text(GRID * 2, 12, noLig(title), TEXT.heading);
    const hints = [
      this.setups.length > 1 ? "Tab  next mercenary" : "",
      this.cfg.onBack ? "Esc  back" : "",
    ].filter(Boolean);
    this.add
      .text(this.scale.width - GRID * 2, 28, hints.join("     "), TEXT.tiny)
      .setOrigin(1, 0.5);
  }

  private buildSlotCards(): void {
    const { x, w, cardH, gap } = LAYOUT.slots;
    this.setups.forEach((_, i) => {
      const y = LAYOUT.top + i * (cardH + gap);
      const container = this.add.container(x, y);
      const bg = createPanel(this, 0, 0, w, cardH, { originX: 0, originY: 0 });
      const frame = this.add.graphics();
      frame.fillStyle(COLOR_NUM.ink, 1).fillRect(10, 10, 64, 64);
      frame.fillStyle(hexNum(RAMPS.void[2]), 1).fillRect(12, 12, 60, 60);
      const portrait = this.add.image(42, 42, "__DEFAULT").setScale(2.5);
      const num = this.add
        .text(w - 14, 12, `${i + 1}`, { ...TEXT.tiny, color: COLORS.textMuted })
        .setOrigin(1, 0);
      const name = this.add.text(86, 14, "", {
        ...TEXT.small,
        color: COLORS.text,
        fontStyle: "600",
        wordWrap: { width: w - 86 - 22, useAdvancedWrap: true },
        maxLines: 2,
      });
      const disc = this.add.text(86, cardH - 14, "", { ...TEXT.small, color: COLORS.accent });
      disc.setOrigin(0, 1);
      const warn = this.add
        .text(w - 14, cardH - 12, "!", { ...TEXT.subheading, color: COLORS.danger })
        .setOrigin(1, 1);
      const hit = this.add.zone(w / 2, cardH / 2, w, cardH).setInteractive({ useHandCursor: true });
      container.add([bg, frame, portrait, num, name, disc, warn, hit]);
      hit.on(Phaser.Input.Events.GAMEOBJECT_POINTER_OVER, () => {
        if (i !== this.current) playUiSound("hover");
        this.tweens.add({ targets: container, x: x + 4, duration: DURATION.fast });
      });
      hit.on(Phaser.Input.Events.GAMEOBJECT_POINTER_OUT, () => {
        this.tweens.add({ targets: container, x, duration: DURATION.fast });
      });
      hit.on(Phaser.Input.Events.GAMEOBJECT_POINTER_DOWN, () => this.selectSlot(i));
      this.cards.push({ bg, container, portrait, name, disc, warn });
    });
    this.buildFieldNotes();
  }

  /** Fills the left column under the cards when fewer than 4 slots are shown. */
  private buildFieldNotes(): void {
    const { x, w, cardH, gap } = LAYOUT.slots;
    const top = LAYOUT.top + this.setups.length * (cardH + gap);
    const bottom = LAYOUT.preview.y + LAYOUT.preview.h;
    if (bottom - top < 72) return;
    createPanel(this, x, top, w, bottom - top, { originX: 0, originY: 0, variant: "inset" });
    this.add.text(x + 16, top + 14, "FIELD NOTES", TEXT.tiny);
    let y = top + 34;
    for (const tip of FIELD_NOTES) {
      const t = this.add.text(x + 16, y, noLig(tip), {
        ...TEXT.small,
        wordWrap: { width: w - 32, useAdvancedWrap: true },
        lineSpacing: 2,
      });
      if (y + t.height > bottom - 14) {
        t.destroy();
        break;
      }
      y += t.height + 12;
    }
  }

  private buildPreview(): void {
    const P = LAYOUT.preview;
    createPanel(this, P.x, P.y, P.w, P.h, { originX: 0, originY: 0, variant: "inset" });
    this.glow = this.add
      .image(STAGE_X, FEET_Y - 110, TEX.glow)
      .setTint(hexNum(RAMPS.lamp[3]))
      .setBlendMode(Phaser.BlendModes.ADD)
      .setDisplaySize(400, 330)
      .setAlpha(0.28);
    this.add
      .image(STAGE_X, FEET_Y + 4, TEX.glow)
      .setTint(hexNum(RAMPS.lamp[2]))
      .setBlendMode(Phaser.BlendModes.ADD)
      .setDisplaySize(340, 70)
      .setAlpha(0.3);
    this.add
      .image(STAGE_X, FEET_Y + 5, STAGE_TEX.ground)
      .setScale(SPRITE_SCALE)
      .setOrigin(0.5, 6 / 16);
    this.add.particles(STAGE_X, FEET_Y - 8, TEX.dot, {
      x: { min: -110, max: 110 },
      y: { min: -10, max: 6 },
      lifespan: { min: 1800, max: 3400 },
      speedY: { min: -24, max: -8 },
      speedX: { min: -5, max: 5 },
      scale: { start: 1.5, end: 0.5 },
      alpha: { start: 0.8, end: 0 },
      tint: [hexNum(RAMPS.lamp[5]), hexNum(RAMPS.lamp[4]), hexNum(RAMPS.lamp[3])],
      frequency: 180,
      blendMode: Phaser.BlendModes.ADD,
    });
    this.sprite = this.add
      .image(STAGE_X, FEET_Y, "__DEFAULT")
      .setScale(SPRITE_SCALE)
      .setOrigin(0.5, 44 / 48);

    // Name field + random name die
    const fieldW = 320;
    const rowW = fieldW + GRID + 40;
    const fx = P.x + (P.w - rowW) / 2;
    const fy = P.y + 40;
    this.nameInput = new TextInput(this, fx + fieldW / 2, fy, {
      width: fieldW,
      maxLength: MAX_NAME_LENGTH,
      placeholder: "Name your mercenary",
      className: "squad-name",
      ariaLabel: "Mercenary name",
      onChange: (v) => {
        this.setup.name = v;
        this.refreshCards();
        this.refreshConfirm();
      },
      onSubmit: () => this.nameInput.blur(),
    });
    this.nameInput.el.addEventListener("keydown", (e) => {
      if (e.key !== "Tab" || this.setups.length < 2) return;
      e.preventDefault();
      this.cycleSlot(e.shiftKey ? -1 : 1);
      this.nameInput.focus();
    });
    const dice = new Button(this, fx + fieldW + GRID + 20, fy, {
      label: "",
      width: 42,
      height: 42,
      onClick: () => {
        this.update_((s) => {
          s.name = randomName(freshSeed());
        });
      },
    });
    const die = this.add.image(0, -1, STAGE_TEX.dice).setScale(2);
    dice.add(die);
    dice.on(Phaser.Input.Events.GAMEOBJECT_POINTER_UP, () => {
      this.tweens.add({ targets: die, angle: { from: -90, to: 0 }, duration: DURATION.slow });
    });

    // Pose preview buttons
    const by = P.y + P.h - 32;
    const bx = P.x + P.w - 16 - 44;
    new Button(this, bx, by, {
      label: "Cast",
      width: 88,
      height: 36,
      onClick: () => this.previewPose("cast"),
    });
    new Button(this, bx - 96, by, {
      label: "Attack",
      width: 96,
      height: 36,
      onClick: () => this.previewPose("attack"),
    });
    this.add
      .text(P.x + 20, by, "Preview", { ...TEXT.tiny, color: COLORS.textMuted })
      .setOrigin(0, 0.5);
  }

  private buildDiscipline(): void {
    const { x, w } = LAYOUT.right;
    const { y, h } = LAYOUT.disc;
    createPanel(this, x, y, w, h, { originX: 0, originY: 0 });
    this.add.text(x + 80, y + 14, "DISCIPLINE", TEXT.tiny);
    this.discName = this.add.text(x + 80, y + 26, "", TEXT.heading);
    this.add.text(x + w - 104, y + 18, "BEST RANKS", TEXT.tiny).setOrigin(1, 0);
    this.discPips = this.add.graphics();
    this.discBlurb = this.add.text(x + 20, y + 76, "", {
      ...TEXT.small,
      wordWrap: { width: w - 40, useAdvancedWrap: true },
      lineSpacing: 2,
    });
    addArrow(this, x + w - 72, y + 42, -1, () => this.stepDiscipline(-1), 4);
    addArrow(this, x + w - 32, y + 42, 1, () => this.stepDiscipline(1), 4);
  }

  private buildOrigin(): void {
    const { x, w } = LAYOUT.right;
    const { y, h } = LAYOUT.origin;
    createPanel(this, x, y, w, h, { originX: 0, originY: 0 });
    this.add.text(x + 20, y + 14, "ORIGIN", TEXT.tiny);
    this.originName = this.add.text(x + 20, y + 26, "", TEXT.heading);
    this.originBlurb = this.add.text(x + 20, y + 64, "", {
      ...TEXT.small,
      wordWrap: { width: w - 40, useAdvancedWrap: true },
      lineSpacing: 2,
    });
    this.originMods = this.add.container(x + 20, y + h - 30);
    addArrow(this, x + w - 72, y + 42, -1, () => this.stepOrigin(-1), 4);
    addArrow(this, x + w - 32, y + 42, 1, () => this.stepOrigin(1), 4);
  }

  private buildAppearance(): void {
    const { x, w } = LAYOUT.right;
    const { y, h } = LAYOUT.look;
    createPanel(this, x, y, w, h, { originX: 0, originY: 0 });
    this.add.text(x + 20, y + 14, "APPEARANCE", TEXT.tiny);
    const colW = (w - 40 - GRID) / 2;
    APPEARANCE_ROWS.forEach((row, i) => {
      const col = i % 2;
      const r = Math.floor(i / 2);
      const rx = x + 20 + col * (colW + GRID);
      const ry = y + 56 + r * 44;
      const opt = new OptionRow(this, rx, ry, colW, row.label, (dir) => {
        this.update_((s) => {
          const n = APPEARANCE_OPTIONS[row.key];
          s.appearance[row.key] = (s.appearance[row.key] + dir + n) % n;
        });
      });
      this.rows.set(row.key, opt);
    });
    const by = y + h - 40;
    const bw = (w - 40 - GRID * 2) / 2;
    new Button(this, x + 20 + bw / 2, by, {
      label: "Randomize Look",
      width: bw,
      height: 40,
      onClick: () => {
        this.update_((s) => {
          s.appearance = randomAppearance(uiRng(freshSeed()));
        });
        this.popSprite(1.06);
      },
    });
    new Button(this, x + 20 + bw * 1.5 + GRID * 2, by, {
      label: "Randomize All",
      width: bw,
      height: 40,
      onClick: () => this.randomizeAll(),
    });
  }

  private buildSkills(): void {
    const B = LAYOUT.bottom;
    createPanel(this, B.x, B.y, B.w, B.h, { originX: 0, originY: 0 });
    this.add.text(B.x + 20, B.y + 14, "SKILL LOADOUT", TEXT.tiny);
    this.add.text(B.x + 132, B.y + 14, "click to equip · hover for details", {
      ...TEXT.tiny,
      color: RAMPS.steel[2],
    });
    this.skillCount = this.add
      .text(B.x + B.w - 20, B.y + 10, "", { ...TEXT.small, color: COLORS.accent })
      .setOrigin(1, 0);
    // stats strip
    createDivider(this, B.x + 16, B.y + 158, B.w - 32);
    const cellW = (B.w - 40) / STAT_CELLS.length;
    STAT_CELLS.forEach((cell, i) => {
      const cx = B.x + 20 + i * cellW;
      const cy = B.y + 192;
      addIcon(this, cx + 14, cy, cell.icon, 2, RAMPS.steel[2], cell.label[0] ?? "?");
      const value = this.add.text(cx + 36, cy - 8, "", TEXT.number).setOrigin(0, 0.5);
      const label = cell.label === "Protection" ? "Protect" : cell.label;
      this.add.text(cx + 36, cy + 13, label, TEXT.tiny).setOrigin(0, 0.5);
      this.statValues.set(cell.key, value);
    });
  }

  /** (Re)build the six skill slots for the current discipline. */
  private rebuildSkillSlots(): void {
    for (const s of this.skillSlots) s.container.destroy();
    this.skillSlots = [];
    const B = LAYOUT.bottom;
    const disc = getDiscipline(this.setup.discipline);
    const pitch = 108;
    const x0 = B.x + B.w / 2 - (pitch * (disc.skills.length - 1)) / 2;
    disc.skills.forEach((id, i) => {
      const skill = getSkill(id);
      const x = x0 + i * pitch;
      const y = B.y + 72;
      const container = this.add.container(x, y);
      const frame = this.add.image(0, 0, TEX.slot()).setScale(3);
      const icon = addIcon(
        this,
        0,
        0,
        skillIcon(skill),
        3,
        ELEMENT_COLORS[skill.element],
        skill.name[0] ?? "?",
      );
      const badge = this.add.graphics();
      const label = this.add
        .text(0, 38, noLig(skill.name), {
          ...TEXT.small,
          align: "center",
          wordWrap: { width: pitch - 8, useAdvancedWrap: true },
          lineSpacing: -2,
        })
        .setOrigin(0.5, 0);
      const hit = this.add.zone(0, 18, pitch - 8, 104).setInteractive({ useHandCursor: true });
      container.add([frame, icon, badge, label, hit]);
      const slot: SkillSlot = { id, container, frame, icon, label, badge, x, y };
      hit.on(Phaser.Input.Events.GAMEOBJECT_POINTER_OVER, () => {
        playUiSound("hover");
        this.hoveredSkill = id;
        this.tweens.add({ targets: [frame, icon, badge], y: -4, duration: DURATION.fast });
        this.showSkillTooltip(slot);
      });
      hit.on(Phaser.Input.Events.GAMEOBJECT_POINTER_OUT, () => {
        if (this.hoveredSkill === id) this.hoveredSkill = null;
        this.tweens.add({ targets: [frame, icon, badge], y: 0, duration: DURATION.fast });
        this.tooltip.hide();
      });
      hit.on(Phaser.Input.Events.GAMEOBJECT_POINTER_DOWN, () => this.toggleSkill(slot));
      this.skillSlots.push(slot);
    });
  }

  private buildFooter(): void {
    const y = LAYOUT.footerY;
    if (this.cfg.onBack) {
      new Button(this, GRID * 2 + 80, y, {
        label: "Back",
        width: 160,
        height: 40,
        onClick: () => this.cfg.onBack?.(),
      });
    }
    const cw = 256;
    this.confirmBtn = new Button(this, this.scale.width - GRID * 2 - cw / 2, y, {
      label: noLig(this.setups.length > 1 ? "Confirm Squad" : "Confirm"),
      width: cw,
      height: 40,
      kind: "primary",
      onClick: () => this.confirm(),
    });
    this.confirmHint = this.add
      .text(this.scale.width - GRID * 4 - cw, y, "", TEXT.small)
      .setOrigin(1, 0.5);
  }

  // -------------------------------------------------------------------------------------
  // Refresh

  private refresh(): void {
    const s = this.setup;
    this.applySprite();
    this.refreshCards();
    if (this.nameInput.getValue() !== s.name) this.nameInput.setValue(s.name);
    this.refreshDiscipline();
    this.refreshOrigin();
    for (const row of APPEARANCE_ROWS) {
      const v = s.appearance[row.key];
      this.rows.get(row.key)?.setValue(row.name(v), row.swatch?.(v));
    }
    this.refreshSkills();
    this.refreshStats();
    this.refreshConfirm();
  }

  private applySprite(): void {
    const look = lookFromSetup(this.setup);
    this.sprite.setTexture(ensureMercTexture(this, look, this.pose));
  }

  private refreshCards(): void {
    this.cards.forEach((card, i) => {
      const s = this.setups[i];
      if (!s) return;
      const active = i === this.current;
      setPanelVariant(card.bg, active ? "highlight" : "default");
      card.portrait.setTexture(ensureMercPortrait(this, lookFromSetup(s)));
      const name = s.name.trim();
      card.name.setText(noLig(name || "Unnamed"));
      card.name.setColor(name ? (active ? COLORS.accentPale : COLORS.text) : COLORS.danger);
      card.disc.setText(getDiscipline(s.discipline).name);
      card.disc.setColor(active ? COLORS.accentBright : COLORS.accent);
      card.warn.setVisible(setupProblem(s) !== null);
      card.container.setAlpha(active ? 1 : 0.82);
    });
  }

  private refreshDiscipline(): void {
    const { x, w } = LAYOUT.right;
    const { y } = LAYOUT.disc;
    const disc = getDiscipline(this.setup.discipline);
    this.discIcon?.destroy();
    this.discIcon = addIcon(
      this,
      x + 44,
      y + 42,
      `disc_${disc.id}`,
      3,
      DISC_COLORS[disc.id] ?? RAMPS.steel[3],
      disc.name[0] ?? "?",
    );
    this.discName.setText(disc.name);
    this.discBlurb.setText(noLig(disc.blurb));
    this.discPips.clear();
    drawRankPips(this.discPips, x + w - 168, y + 36, disc.preferredRanks, COLOR_NUM.accent, true);
  }

  private refreshOrigin(): void {
    const origin = getOrigin(this.setup.origin);
    this.originName.setText(noLig(origin.name));
    this.originBlurb.setText(noLig(origin.blurb));
    this.originMods.removeAll(true);
    // Flow the stat bonuses under the blurb, wrapping when a line is full.
    const maxW = LAYOUT.right.w - 40;
    this.originMods.setY(this.originBlurb.y + this.originBlurb.height + 6);
    let mx = 0;
    let my = 0;
    for (const line of formatMods(origin.mods)) {
      const color = line.startsWith("-") ? COLORS.danger : COLORS.success;
      const t = this.add.text(0, 0, noLig(line), { ...TEXT.small, color });
      if (mx > 0 && mx + t.width > maxW) {
        mx = 0;
        my += 22;
      }
      t.setPosition(mx, my);
      this.originMods.add(t);
      mx += t.width + GRID * 2.5;
    }
  }

  private refreshSkills(): void {
    const s = this.setup;
    if (
      this.skillSlots.length === 0 ||
      this.skillSlots[0]?.id !== getDiscipline(s.discipline).skills[0]
    ) {
      this.rebuildSkillSlots();
    }
    for (const slot of this.skillSlots) {
      const on = s.skills.includes(slot.id);
      slot.frame.setTexture(on ? TEX.slot("relic") : TEX.slot());
      slot.icon.setAlpha(on ? 1 : 0.35);
      slot.label.setColor(on ? COLORS.text : COLORS.textMuted);
      slot.badge.clear();
      if (on) {
        // lit lamp pip in the corner
        slot.badge.fillStyle(COLOR_NUM.ink, 1).fillRect(18, -32, 14, 14);
        slot.badge.fillStyle(COLOR_NUM.accentBright, 1).fillRect(20, -30, 10, 10);
        slot.badge.fillStyle(COLOR_NUM.accentPale, 1).fillRect(22, -28, 4, 4);
      }
    }
    const n = s.skills.length;
    this.skillCount.setText(`${n} / 4 equipped`);
    this.skillCount.setColor(n === 4 ? COLORS.accent : COLORS.danger);
  }

  private refreshStats(): void {
    const stats = previewStats(this.setup);
    const prev = this.lastStats?.slot === this.current ? this.lastStats.stats : null;
    for (const cell of STAT_CELLS) {
      const t = this.statValues.get(cell.key);
      if (!t) continue;
      t.setText(cell.value(stats));
      const score = STAT_SCORE[cell.key];
      if (!prev || !score) {
        t.setColor(COLORS.accentBright);
        continue;
      }
      const d = score(stats) - score(prev);
      if (d === 0) continue;
      this.flashStat(t, d);
    }
    this.lastStats = { slot: this.current, stats };
  }

  private flashStat(t: Phaser.GameObjects.Text, delta: number): void {
    const up = delta > 0;
    t.setColor(up ? COLORS.success : COLORS.danger);
    this.tweens.killTweensOf(t);
    t.setScale(1);
    this.tweens.add({
      targets: t,
      scale: { from: 1.25, to: 1 },
      duration: DURATION.slow,
      ease: "Back.out",
    });
    this.time.delayedCall(900, () => {
      if (t.active) t.setColor(COLORS.accentBright);
    });
    const label = `${up ? "+" : "−"}${Math.abs(delta)}`;
    const f = this.add
      .text(t.x + t.width + 6, t.y, label, {
        ...TEXT.tiny,
        color: up ? COLORS.success : COLORS.danger,
      })
      .setOrigin(0, 0.5);
    this.tweens.add({
      targets: f,
      y: t.y - 18,
      alpha: 0,
      duration: 900,
      ease: "Quad.out",
      onComplete: () => f.destroy(),
    });
  }

  private refreshConfirm(): void {
    const problems = this.setups
      .map((s, i) => ({ s, i, p: setupProblem(s) }))
      .filter((x) => x.p !== null);
    this.confirmBtn.setEnabled(problems.length === 0);
    const first = problems[0];
    if (first) {
      const who = first.s.name.trim() || `Mercenary ${first.i + 1}`;
      this.confirmHint.setText(noLig(`${who} ${first.p}`)).setColor(COLORS.danger);
    } else {
      const n = this.setups.length;
      this.confirmHint
        .setText(n > 1 ? `${n} mercenaries ready` : "Ready to deploy")
        .setColor(COLORS.success);
    }
  }

  // -------------------------------------------------------------------------------------
  // Actions

  private selectSlot(i: number): void {
    if (i === this.current || !this.setups[i]) return;
    playUiSound("click");
    this.current = i;
    this.tooltip.hide();
    this.refresh();
    this.tweens.killTweensOf(this.sprite);
    this.sprite.setScale(SPRITE_SCALE);
    this.tweens.add({
      targets: this.sprite,
      x: { from: STAGE_X - 24, to: STAGE_X },
      alpha: { from: 0, to: 1 },
      duration: DURATION.slow,
      ease: "Quad.out",
    });
  }

  private cycleSlot(dir: -1 | 1): void {
    const n = this.setups.length;
    this.selectSlot((this.current + dir + n) % n);
  }

  private stepDiscipline(dir: -1 | 1): void {
    const ids = DISCIPLINE_IDS as readonly string[];
    const i = ids.indexOf(this.setup.discipline);
    const next = ids[(i + dir + ids.length) % ids.length] ?? "vanguard";
    this.update_((s) => {
      s.discipline = next;
      s.skills = [...getDiscipline(next).defaultSkills];
    });
    this.popSprite(1.14);
    if (this.discIcon) {
      this.tweens.add({
        targets: this.discIcon,
        scale: { from: 1.3, to: 1 },
        duration: DURATION.slow,
        ease: "Back.out",
      });
    }
  }

  private stepOrigin(dir: -1 | 1): void {
    const ids = ORIGIN_IDS as readonly string[];
    const i = ids.indexOf(this.setup.origin);
    const next = ids[(i + dir + ids.length) % ids.length] ?? "exMiner";
    this.update_((s) => {
      s.origin = next;
    });
  }

  private randomizeAll(): void {
    const r = uiRng(freshSeed());
    const discipline = DISCIPLINE_IDS[Math.floor(r() * DISCIPLINE_IDS.length)] ?? "vanguard";
    this.update_((s) => {
      s.name = randomName(Math.floor(r() * 0x7fffffff));
      s.discipline = discipline;
      s.origin = ORIGIN_IDS[Math.floor(r() * ORIGIN_IDS.length)] ?? "exMiner";
      s.appearance = randomAppearance(r);
      s.skills = [...getDiscipline(discipline).defaultSkills];
    });
    this.popSprite(1.14);
  }

  private toggleSkill(slot: SkillSlot): void {
    const s = this.setup;
    const order = getDiscipline(s.discipline).skills;
    if (s.skills.includes(slot.id)) {
      s.skills = s.skills.filter((id) => id !== slot.id);
      playUiSound("click");
    } else if (s.skills.length < 4) {
      s.skills = order.filter((id) => id === slot.id || s.skills.includes(id));
      playUiSound("click");
      this.tweens.add({
        targets: slot.icon,
        scale: { from: 1.3, to: 1 },
        duration: DURATION.slow,
        ease: "Back.out",
      });
    } else {
      playUiSound("error");
      this.tweens.add({
        targets: slot.container,
        x: { from: slot.x - 6, to: slot.x },
        duration: 240,
        ease: "Elastic.out",
      });
      this.skillCount.setText("Unequip a skill first").setColor(COLORS.danger);
      this.time.delayedCall(1100, () => {
        if (this.skillCount.active) this.refreshSkills();
      });
      return;
    }
    this.refreshSkills();
    this.refreshCards();
    this.refreshConfirm();
    if (this.hoveredSkill === slot.id) this.showSkillTooltip(slot);
  }

  private previewPose(pose: MercPose): void {
    this.pose = pose;
    this.poseUntil = this.time.now + (pose === "attack" ? 650 : 800);
    this.applySprite();
    this.tweens.killTweensOf(this.sprite);
    this.sprite.setPosition(STAGE_X, FEET_Y).setScale(SPRITE_SCALE).setAlpha(1);
    if (pose === "attack") {
      this.tweens.add({
        targets: this.sprite,
        x: STAGE_X + 20,
        duration: 90,
        yoyo: true,
        hold: 140,
        ease: "Quad.out",
      });
    } else {
      this.tweens.add({
        targets: this.glow,
        alpha: { from: 0.65, to: 0.28 },
        duration: 800,
        ease: "Quad.out",
      });
    }
    this.time.delayedCall(pose === "attack" ? 650 : 800, () => {
      if (this.time.now >= this.poseUntil - 1) {
        this.pose = "idle0";
        this.applySprite();
      }
    });
  }

  private popSprite(amount: number): void {
    this.tweens.killTweensOf(this.sprite);
    this.sprite.setPosition(STAGE_X, FEET_Y).setAlpha(1);
    this.tweens.add({
      targets: this.sprite,
      scale: { from: SPRITE_SCALE * amount, to: SPRITE_SCALE },
      duration: DURATION.slow,
      ease: "Back.out",
    });
    this.tweens.add({
      targets: this.glow,
      alpha: { from: 0.5, to: 0.28 },
      duration: 500,
      ease: "Quad.out",
    });
  }

  private showSkillTooltip(slot: SkillSlot): void {
    const skill = getSkill(slot.id);
    const text = describeSkill(skill);
    const equipped = this.setup.skills.includes(slot.id);
    const elementName = skill.element[0]?.toUpperCase() + skill.element.slice(1);
    const kind = skill.kind === "attack" ? "Attack" : "Support";
    const effects = skill.flavor ? text.lines.slice(0, -1) : text.lines;
    const lines = [
      { text: text.name, style: "title" as const },
      { text: `${elementName} · ${kind}`, color: ELEMENT_COLORS[skill.element] },
      null,
      { text: text.usage, color: COLORS.textDim },
      null,
      ...effects.map((l) => ({ text: l, color: COLORS.text })),
      ...(skill.flavor ? [{ text: skill.flavor, color: COLORS.textMuted }] : []),
      null,
      {
        text: text.cooldown > 0 ? `Cooldown: ${text.cooldown} turns` : "No cooldown",
        color: COLORS.info,
      },
      {
        text: equipped ? "Click to unequip" : "Click to equip",
        color: equipped ? COLORS.textMuted : COLORS.accent,
      },
    ];
    const { reservedY } = this.tooltip.show(
      lines,
      { x: slot.x - 30, y: slot.y - 34, w: 60, h: 60 },
      { after: 2, height: 32 },
    );
    // Rank pips: user ranks (4..1) then target ranks (1..4), Darkest-Dungeon style.
    const g = this.tooltip.extra;
    const y = reservedY + 2;
    const used = drawRankPips(g, 16, y, skill.from, COLOR_NUM.accent, true);
    const targetColor =
      skill.target.side === "enemy"
        ? COLOR_NUM.danger
        : skill.target.side === "ally"
          ? COLOR_NUM.success
          : COLOR_NUM.accent;
    const targetRanks = skill.target.side === "self" ? [] : skill.target.ranks;
    g.fillStyle(COLOR_NUM.line, 1).fillRect(16 + used + 8, y + 5, 12, 2);
    drawRankPips(g, 16 + used + 28, y, targetRanks, targetColor, false);
    if (skill.target.aoe && skill.target.side !== "self") {
      g.fillStyle(targetColor, 0.8).fillRect(16 + used + 28, y + 16, used, 2);
    }
  }

  private confirm(): void {
    if (this.time.now < this.confirmLockedUntil) return;
    if (this.setups.some((s) => setupProblem(s) !== null)) {
      this.refreshConfirm();
      return;
    }
    this.confirmLockedUntil = this.time.now + 600;
    this.nameInput.blur();
    this.cfg.onConfirm(this.setups.map(finalizeSetup));
  }

  private handleKey(e: KeyboardEvent): void {
    const typing =
      document.activeElement instanceof HTMLInputElement ||
      document.activeElement instanceof HTMLTextAreaElement;
    if (typing || !this.scene.isActive()) return;
    if (e.key === "Tab" && this.setups.length > 1) {
      e.preventDefault();
      this.cycleSlot(e.shiftKey ? -1 : 1);
    } else if (e.key === "Escape" && this.cfg.onBack) {
      e.preventDefault();
      playUiSound("back");
      this.cfg.onBack();
    }
  }
}
