/**
 * Character sheet / inventory overlay. Launched on top of the expedition scene:
 *
 *   scene.scene.launch("character", { session, mercId, onClose });
 *
 * Renders entirely from `session.currentView` and re-renders on every "state" event (keeping
 * the selected merc, stash filter and scroll). All changes go through `session.command` —
 * equip/unequip, skill loadouts, level-up perks and refuelling. Mercs owned by other players
 * are read-only, and gear is locked outside the "map" and "reward" phases.
 */
import {
  canEquip,
  computeStats,
  EQUIP_SLOTS,
  type EquipSlot,
  formatMods,
  getDiscipline,
  getOrigin,
  type getPerk,
  getSkill,
  type Item,
  type ItemSlot,
  MAX_LEVEL,
  type Merc,
  RARITIES,
  REFUEL_COST,
  type RunView,
  type Stats,
  skillIcon,
  XP_TABLE,
} from "@radiance/core";
import * as Phaser from "phaser";
import { hdScale } from "../app/hires";
import { ensureUiTextures, iconTexture, TEX } from "../app/textures";
import { RigSprite } from "../art/hd/rig";
import { ensureMercPortrait, lookFromMerc } from "../art/look";
import { hexNum, INK, RAMPS, RARITY_COLORS } from "../art/palette";
import { fitImage, mercRigFromLook, portraitForLook } from "../game/hdArt";
import type { GameSession, SessionEvent } from "../net/session";
import { Button } from "../ui/Button";
import { type ModalHandle, openModal } from "../ui/Modal";
import { createPanel } from "../ui/Panel";
import { toast } from "../ui/Toast";
import { attachTooltip, hideTooltip, type TooltipContent } from "../ui/Tooltip";
import { COLOR_NUM, COLORS, DURATION, GAME_H, GAME_W, playUiSound, TEXT } from "../ui/theme";
import {
  cap,
  disciplineTooltip,
  GAIN,
  isUpgrade,
  itemIcon,
  itemTooltip,
  LOSS,
  mercPerks,
  originTooltip,
  perkColor,
  perkPoolLabel,
  perkTooltip,
  previewStats,
  previewUnequip,
  rowDelta,
  rowText,
  rowValue,
  SLOT_LABELS,
  SLOT_PLACEHOLDER_ICON,
  STAT_GROUPS,
  STAT_HELP,
  safePerk,
  skillTooltip,
  targetSlot,
} from "./character/format";
import {
  chip,
  drawBar,
  fallbackBadge,
  glow,
  icon,
  panelAt,
  SLOT_PX,
  sectionTitle,
  setHitBox,
  slotView,
} from "./character/widgets";

export const CHARACTER_SCENE_KEY = "character";

export interface CharacterSceneData {
  session: GameSession;
  mercId?: string;
  onClose?: () => void;
}

type StashFilter = "all" | ItemSlot;
const FILTERS: { id: StashFilter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "weapon", label: "Weapons" },
  { id: "armor", label: "Armor" },
  { id: "lamp", label: "Lamps" },
  { id: "trinket", label: "Trinkets" },
];

const SLOT_ORDER: Record<ItemSlot, number> = { weapon: 0, armor: 1, lamp: 2, trinket: 3 };

// Layout (1280x720, 8px grid).
const M = 16;
const TAB_Y = 52;
const TAB_H = 68;
const BODY_Y = 128;
const LEFT = { x: M, y: BODY_Y, w: 320, h: 392 };
const EQUIP = { x: 344, y: BODY_Y, w: 488, h: 144 };
const STATS = { x: 344, y: 280, w: 488, h: 240 };
const SKILLS = { x: M, y: 528, w: 512, h: 176 };
const PERKS = { x: 536, y: 528, w: 296, h: 176 };
const STASH = { x: 840, y: BODY_Y, w: 424, h: 576 };
const GRID_COLS = 6;
const GRID_ROWS = 6;
const CELL = 64;
const GRID_X = STASH.x + 20;
const GRID_Y = STASH.y + 92;

export class CharacterScene extends Phaser.Scene {
  private session!: GameSession;
  private onClose: (() => void) | undefined;
  private mercId: string | null = null;
  private filter: StashFilter = "all";
  private stashScroll = 0;
  /** Skill loadout being edited (null slots = freed). */
  private pending: { mercId: string; slots: (string | null)[] } | null = null;
  private unsubscribe: (() => void) | null = null;
  private root!: Phaser.GameObjects.Container;
  private statsLayer: Phaser.GameObjects.Container | null = null;
  private noticeText: Phaser.GameObjects.Text | null = null;
  private noticeIcon: Phaser.GameObjects.Image | null = null;
  private loops: Array<Phaser.Tweens.Tween | Phaser.Time.TimerEvent> = [];
  private lastStats = new Map<string, Stats>();
  private flashSlot: { mercId: string; slot: EquipSlot } | null = null;
  private celebrate: { mercId: string; perkId: string } | null = null;
  private modal: ModalHandle | null = null;
  private modalClosedFrame = -1;
  private chooser: Phaser.GameObjects.Container | null = null;
  private closing = false;
  private spriteAnchor = { x: 0, y: 0 };

  constructor() {
    super({ key: CHARACTER_SCENE_KEY });
  }

  init(data: CharacterSceneData): void {
    this.session = data.session;
    this.onClose = data.onClose;
    this.mercId = data.mercId ?? null;
    this.filter = "all";
    this.stashScroll = 0;
    this.pending = null;
    this.flashSlot = null;
    this.celebrate = null;
    this.modal = null;
    this.chooser = null;
    this.closing = false;
    this.loops = [];
    this.lastStats = new Map();
  }

  create(): void {
    ensureUiTextures(this);
    // Always draw above the scene that launched us (launch() keeps the scene list order).
    this.scene.bringToTop();
    this.input.topOnly = true;

    // Darkened backdrop over the map; swallows input meant for the scene underneath.
    const dim = this.add
      .rectangle(0, 0, GAME_W, GAME_H, COLOR_NUM.ink, 0.88)
      .setOrigin(0)
      .setInteractive();
    dim.on(Phaser.Input.Events.GAMEOBJECT_POINTER_UP, () => this.closeChooser());
    this.add
      .image(GAME_W / 2, GAME_H / 2, TEX.vignette)
      .setDisplaySize(GAME_W, GAME_H)
      .setAlpha(0.8);
    this.buildChrome();
    this.root = this.add.container(0, 0);

    this.unsubscribe = this.session.subscribe((e) => this.onSession(e));
    this.input.keyboard?.on("keydown", this.onKey, this);
    this.input.on(Phaser.Input.Events.POINTER_WHEEL, this.onWheel, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.cleanup());

    this.render();
    // Fade in.
    this.cameras.main.setAlpha(0);
    this.tweens.add({ targets: this.cameras.main, alpha: 1, duration: DURATION.normal });
  }

  // -------------------------------------------------------------------------------------
  // Session & input

  private onSession(e: SessionEvent): void {
    if (e.type === "state") {
      this.render();
    } else if (e.type === "error") {
      this.celebrate = null;
      this.flashSlot = null;
      if (this.pending) {
        this.pending = null;
        this.render();
      }
      toast(this, e.message, "error");
    }
  }

  private onKey(e: KeyboardEvent): void {
    if (this.closing) return;
    if (this.modal && !this.modal.closed) return;
    if (this.game.loop.frame === this.modalClosedFrame) return;
    if (e.code === "Escape" && this.chooser) {
      this.closeChooser();
      return;
    }
    if (e.code === "Escape" || e.code === "KeyC") {
      this.close();
      return;
    }
    const view = this.session.currentView;
    if (!view) return;
    const n = Number.parseInt(e.key, 10);
    if (n >= 1 && n <= view.mercs.length) this.selectMerc(view.mercs[n - 1]?.id ?? null);
    if (e.code === "KeyQ" || e.code === "KeyE" || e.code === "Tab") {
      if (e.code === "Tab") e.preventDefault();
      const i = view.mercs.findIndex((m) => m.id === this.mercId);
      const dir = e.code === "KeyQ" || (e.code === "Tab" && e.shiftKey) ? -1 : 1;
      const next = view.mercs[(i + dir + view.mercs.length) % view.mercs.length];
      this.selectMerc(next?.id ?? null);
    }
  }

  private onWheel(p: Phaser.Input.Pointer, _over: unknown, _dx: number, dy: number): void {
    if (
      p.worldX < STASH.x ||
      p.worldX > STASH.x + STASH.w ||
      p.worldY < GRID_Y ||
      p.worldY > GRID_Y + CELL * 6
    )
      return;
    const view = this.session.currentView;
    if (!view) return;
    const rows = Math.ceil(this.filteredStash(view).length / GRID_COLS);
    const max = Math.max(0, rows - GRID_ROWS);
    const next = Phaser.Math.Clamp(this.stashScroll + Math.sign(dy), 0, max);
    if (next !== this.stashScroll) {
      this.stashScroll = next;
      hideTooltip(this);
      this.render();
    }
  }

  private selectMerc(id: string | null): void {
    if (!id || id === this.mercId) return;
    playUiSound("click");
    this.mercId = id;
    this.pending = null;
    this.closeChooser();
    hideTooltip(this);
    this.render();
  }

  close(): void {
    if (this.closing) return;
    this.closing = true;
    playUiSound("back");
    hideTooltip(this);
    const cb = this.onClose;
    this.scene.stop();
    cb?.();
  }

  private cleanup(): void {
    this.unsubscribe?.();
    this.unsubscribe = null;
    this.stopLoops();
    this.input.keyboard?.off("keydown", this.onKey, this);
    this.input.off(Phaser.Input.Events.POINTER_WHEEL, this.onWheel, this);
  }

  private stopLoops(): void {
    for (const l of this.loops) {
      if (l instanceof Phaser.Time.TimerEvent) l.remove();
      else l.stop();
    }
    this.loops = [];
  }

  // -------------------------------------------------------------------------------------
  // Static chrome: title row + close button

  private buildChrome(): void {
    this.add.image(M + 16, 26, iconTexture(this, "ui_lamp")).setScale(2);
    this.add
      .text(M + 40, 26, "Mercenaries", { ...TEXT.heading, fontSize: "24px" })
      .setOrigin(0, 0.5);
    this.noticeIcon = this.add
      .image(0, 26, iconTexture(this, "ui_lock"))
      .setScale(2)
      .setVisible(false);
    this.noticeText = this.add
      .text(GAME_W / 2, 26, "", { ...TEXT.small, color: COLORS.textDim })
      .setOrigin(0.5);
    this.add
      .text(GAME_W - M - 144, 26, "1-4 / Q E switch · C / Esc close", {
        ...TEXT.tiny,
        color: COLORS.textMuted,
      })
      .setOrigin(1, 0.5);
    new Button(this, GAME_W - M - 64, 26, {
      label: "Close",
      width: 128,
      height: 36,
      onClick: () => this.close(),
    });
  }

  private setNotice(text: string, color: string, iconId: string | null): void {
    if (!this.noticeText || !this.noticeIcon) return;
    this.noticeText.setText(text).setColor(color);
    const w = this.noticeText.width + (iconId ? 40 : 0);
    const x0 = GAME_W / 2 - w / 2 + 10;
    this.noticeText.setX(Math.round(GAME_W / 2 + (iconId ? 20 : 0)));
    this.noticeIcon.setVisible(!!iconId && text.length > 0);
    if (iconId) this.noticeIcon.setTexture(iconTexture(this, iconId)).setX(Math.round(x0));
  }

  // -------------------------------------------------------------------------------------
  // Render

  private render(): void {
    if (!this.sys.isActive() && !this.sys.isVisible()) return;
    this.stopLoops();
    this.root.removeAll(true);
    this.statsLayer = null;
    const view = this.session.currentView;
    if (!view || view.mercs.length === 0) {
      this.root.add(
        this.add
          .text(GAME_W / 2, GAME_H / 2, "Waiting for the expedition…", TEXT.bodyDim)
          .setOrigin(0.5),
      );
      this.setNotice("", COLORS.textDim, null);
      return;
    }
    let merc = view.mercs.find((m) => m.id === this.mercId);
    if (!merc) {
      merc = view.mercs.find((m) => m.ownerId === view.viewerId) ?? view.mercs[0];
      if (!merc) return;
      this.mercId = merc.id;
    }
    if (this.pending && this.pending.mercId !== merc.id) this.pending = null;
    if (this.pending && sameSet(this.pending.slots, merc.skills)) this.pending = null;

    const owned = merc.ownerId === view.viewerId;
    const phaseOk = view.phase === "map" || view.phase === "reward";
    const editable = owned && phaseOk;
    const lockReason = !owned
      ? `${ownerName(view, merc)}'s mercenary — view only`
      : !phaseOk
        ? view.phase === "combat"
          ? "Gear, skills and perks are locked during combat"
          : "The expedition is over — loadouts are final"
        : "";
    if (lockReason) {
      this.setNotice(lockReason, !owned ? COLORS.info : COLORS.danger, "ui_lock");
    } else {
      this.setNotice("Click stash items to equip · click gear to unequip", COLORS.textMuted, null);
    }

    const ctx: Ctx = { view, merc, owned, editable, phaseOk, lockReason };
    this.renderTabs(ctx);
    this.renderHero(ctx);
    this.renderEquipment(ctx);
    this.renderStats(ctx, null);
    this.renderSkills(ctx);
    this.renderPerks(ctx);
    this.renderStash(ctx);

    // Post-render feedback: flashes for changed stats, celebrations.
    const stats = computeStats(merc);
    const before = this.lastStats.get(merc.id);
    this.lastStats.set(merc.id, stats);
    if (before) this.flashStatChanges(before, stats);
    if (this.flashSlot && this.flashSlot.mercId === merc.id) {
      this.flashEquipSlot(this.flashSlot.slot);
      this.flashSlot = null;
    }
    if (this.celebrate && this.celebrate.mercId === merc.id) {
      if (merc.perks.includes(this.celebrate.perkId)) {
        this.playCelebration(this.celebrate.perkId);
        this.celebrate = null;
      }
    }
  }

  // ---- Tabs ----------------------------------------------------------------------------

  private renderTabs(ctx: Ctx): void {
    const { view } = ctx;
    const n = view.mercs.length;
    const gap = 8;
    const w = Math.floor((GAME_W - M * 2 - gap * (n - 1)) / n);
    view.mercs.forEach((m, i) => {
      const x = M + i * (w + gap);
      const selected = m.id === this.mercId;
      const mine = m.ownerId === view.viewerId;
      const c = this.add.container(x, TAB_Y);
      this.root.add(c);
      const panel = createPanel(this, 0, 0, w, TAB_H, {
        variant: selected ? "highlight" : "inset",
        originX: 0,
        originY: 0,
      });
      c.add(panel);
      if (!selected) panel.setAlpha(0.9);
      // Portrait.
      const look = lookFromMerc(m);
      let portrait: Phaser.GameObjects.GameObject[];
      try {
        portrait = [
          fitImage(
            this.add.image(
              40,
              TAB_H / 2,
              portraitForLook(this, look, () => ensureMercPortrait(this, look)),
            ),
            46,
          ),
        ];
      } catch {
        portrait = [...fallbackBadge(this, 40, TAB_H / 2, 48, m.name[0] ?? "?")];
      }
      const frame = this.add.graphics();
      frame.lineStyle(2, selected ? hexNum(RAMPS.lamp[3]) : hexNum(RAMPS.steel[2]), 1);
      frame.strokeRect(15, TAB_H / 2 - 25, 50, 50);
      c.add([...portrait, frame]);
      if (m.hp <= 0) (portrait[0] as Phaser.GameObjects.Image).setAlpha?.(0.4);
      // Name & level.
      const name = this.add
        .text(76, 6, m.name, {
          ...TEXT.subheading,
          fontSize: "20px",
          color: selected ? COLORS.accentPale : COLORS.text,
        })
        .setOrigin(0, 0);
      const disc = safeName(() => getDiscipline(m.discipline).name, m.discipline);
      const sub = this.add.text(76, 31, `Lv ${m.level} ${disc} · Rank ${i + 1}`, {
        ...TEXT.small,
        fontSize: "16px",
        color: selected ? COLORS.textDim : COLORS.textMuted,
      });
      c.add([name, sub]);
      // Owner tag.
      const ownerLabel = mine ? "YOU" : ownerName(view, m);
      const tagColor = mine ? COLORS.accent : COLORS.info;
      const tag = chip(this, 0, 0, ownerLabel, {
        color: tagColor,
        height: 22,
        fontSize: 12,
        ...(mine ? {} : { icon: "ui_lock" }),
      });
      tag.disableInteractive();
      tag.setPosition(w - tag.width - 10, 9);
      c.add(tag);
      // HP sliver along the bottom.
      const maxHp = computeStats(m).maxHp;
      const g = this.add.graphics();
      drawBar(g, 76, TAB_H - 17, w - 76 - 12, 10, m.hp / maxHp, hpColors(m.hp / maxHp));
      c.add(g);
      // Pending perk badge.
      if (mine && m.perkOffers.length > 0) {
        const bx = 58;
        const by = TAB_H - 16;
        const halo = glow(this, bx, by, 40, RAMPS.lamp[4], 0.55);
        const badge = this.add.image(bx, by, iconTexture(this, "ui_perk")).setScale(2);
        c.add([halo, badge]);
        this.loops.push(
          this.tweens.add({
            targets: halo,
            alpha: { from: 0.25, to: 0.8 },
            duration: 700,
            yoyo: true,
            repeat: -1,
            ease: "Sine.inOut",
          }),
        );
      }
      // Input.
      setHitBox(c, 0, 0, w, TAB_H, selected ? "default" : "pointer");
      c.on(Phaser.Input.Events.GAMEOBJECT_POINTER_OVER, () => {
        if (!selected) panel.setAlpha(1).setTint(0xd8d0ff);
      });
      c.on(Phaser.Input.Events.GAMEOBJECT_POINTER_OUT, () => {
        if (!selected) panel.setAlpha(0.9).clearTint();
      });
      c.on(Phaser.Input.Events.GAMEOBJECT_POINTER_UP, () => this.selectMerc(m.id));
    });
  }

  // ---- Hero (left) ---------------------------------------------------------------------

  private renderHero(ctx: Ctx): void {
    const { merc, owned } = ctx;
    const r = LEFT;
    panelAt(this, this.root, r.x, r.y, r.w, r.h);
    const cx = r.x + r.w / 2;

    // Name.
    const name = this.add
      .text(r.x + 20, r.y + 18, merc.name, { ...TEXT.heading, color: COLORS.accentBright })
      .setOrigin(0, 0);
    this.root.add(name);

    // Discipline + origin chips with tooltips.
    const discName = safeName(() => getDiscipline(merc.discipline).name, merc.discipline);
    const originName = safeName(() => getOrigin(merc.origin).name, merc.origin);
    const dChip = chip(this, r.x + 20, r.y + 56, discName, {
      color: RAMPS.lamp[4],
      icon: `disc_${merc.discipline}`,
    });
    const oChip = chip(this, r.x + 20 + dChip.width + 8, r.y + 56, originName, {
      color: RAMPS.crystal[4],
    });
    this.root.add([dChip, oChip]);
    attachTooltip(dChip, () => safeTip(() => disciplineTooltip(merc.discipline)));
    attachTooltip(oChip, () => safeTip(() => originTooltip(merc.origin)));

    // Sprite on a pool of lamp light.
    const footY = r.y + 286;
    this.spriteAnchor = { x: cx, y: footY - 110 };
    const lampLit = !!merc.equipment.lamp;
    const pool = glow(this, cx, footY - 70, 300, lampLit ? RAMPS.lamp[3] : RAMPS.steel[3], 0.22);
    const floor = this.add.ellipse(cx, footY + 2, 150, 22, hexNum(INK), 0.65);
    const floorLight = this.add
      .ellipse(cx, footY + 1, 190, 26, hexNum(lampLit ? RAMPS.lamp[2] : RAMPS.steel[2]), 0.18)
      .setBlendMode(Phaser.BlendModes.ADD);
    this.root.add([pool, floorLight, floor]);
    this.loops.push(
      this.tweens.add({
        targets: pool,
        alpha: { from: 0.18, to: 0.28 },
        duration: 1400,
        yoyo: true,
        repeat: -1,
        ease: "Sine.inOut",
      }),
    );
    const look = lookFromMerc(merc);
    try {
      const rig = new RigSprite(this, cx, footY, mercRigFromLook(look), {
        scale: hdScale(1.15),
        pose: merc.hp <= 0 ? "downed" : "idle",
      });
      if (merc.hp <= 0) rig.setTintAll(0x8a8a9a);
      else rig.idle();
      this.root.add(rig);
    } catch {
      this.root.add([...fallbackBadge(this, cx, footY - 100, 160, merc.name[0] ?? "?")]);
    }

    // Level & XP.
    const lvY = r.y + 300;
    const atMax = merc.level >= MAX_LEVEL;
    const lo = XP_TABLE[merc.level] ?? 0;
    const hi = XP_TABLE[merc.level + 1] ?? lo;
    const frac = atMax ? 1 : (merc.xp - lo) / Math.max(1, hi - lo);
    icon(this, this.root, "ui_xp", r.x + 28, lvY + 10, 2);
    this.root.add(
      this.add.text(r.x + 48, lvY + 10, `Level ${merc.level}`, TEXT.number).setOrigin(0, 0.5),
    );
    this.root.add(
      this.add
        .text(r.x + r.w - 20, lvY + 10, atMax ? "MAX" : `${merc.xp} / ${hi} XP`, {
          ...TEXT.small,
          color: COLORS.textDim,
        })
        .setOrigin(1, 0.5),
    );
    const g = this.add.graphics();
    drawBar(g, r.x + 20, lvY + 24, r.w - 40, 12, frac, {
      fill: RAMPS.umbra[3],
      fillHi: RAMPS.umbra[5],
      ticks: 0,
    });
    // HP.
    const stats = computeStats(merc);
    const hpY = lvY + 44;
    icon(this, this.root, "stat_hp", r.x + 28, hpY + 8, 2);
    this.root.add(
      this.add
        .text(r.x + 48, hpY + 8, merc.hp <= 0 ? "Downed" : "Health", {
          ...TEXT.small,
          color: merc.hp <= 0 ? COLORS.danger : COLORS.textDim,
        })
        .setOrigin(0, 0.5),
    );
    this.root.add(
      this.add
        .text(r.x + r.w - 20, hpY + 8, `${Math.max(0, merc.hp)} / ${stats.maxHp}`, {
          ...TEXT.small,
          color: COLORS.text,
        })
        .setOrigin(1, 0.5),
    );
    drawBar(g, r.x + 20, hpY + 20, r.w - 40, 12, merc.hp / stats.maxHp, {
      ...hpColors(merc.hp / stats.maxHp),
      ticks: Math.max(6, Math.round(((r.w - 46) * 10) / stats.maxHp)),
    });
    this.root.add(g);

    // Level-up banner (floats above the merc's head).
    const offer = merc.perkOffers[0];
    if (owned && offer) this.renderLevelBanner(ctx, cx, r.y + 112);
  }

  private renderLevelBanner(ctx: Ctx, cx: number, cy: number): void {
    const { merc, editable } = ctx;
    const w = 272;
    const h = 44;
    const c = this.add.container(cx, cy);
    const halo = glow(this, 0, 0, 340, RAMPS.lamp[3], 0.45).setDisplaySize(360, 120);
    const panel = createPanel(this, 0, 0, w, h, { variant: "highlight" });
    const count = merc.perkOffers.length;
    const label = this.add
      .text(14, -1, count > 1 ? `Level up! Choose a perk (${count})` : "Level up! Choose a perk", {
        ...TEXT.button,
        fontSize: "18px",
        color: COLORS.accentPale,
      })
      .setOrigin(0.5);
    const ic = this.add.image(-w / 2 + 22, 0, iconTexture(this, "ui_perk")).setScale(2);
    c.add([halo, panel, ic, label]);
    setHitBox(c, -w / 2, -h / 2, w, h);
    this.root.add(c);
    this.loops.push(
      this.tweens.add({
        targets: halo,
        alpha: { from: 0.25, to: 0.6 },
        duration: 900,
        yoyo: true,
        repeat: -1,
        ease: "Sine.inOut",
      }),
      this.tweens.add({
        targets: c,
        y: { from: cy, to: cy - 4 },
        duration: 1100,
        yoyo: true,
        repeat: -1,
        ease: "Sine.inOut",
      }),
    );
    // Sparks rising off the banner.
    const sparks = this.add.particles(cx, cy + 8, TEX.dot, {
      x: { min: -w / 2, max: w / 2 },
      lifespan: { min: 700, max: 1300 },
      speedY: { min: -40, max: -18 },
      scale: { start: 1.5, end: 0.5 },
      alpha: { start: 0.9, end: 0 },
      tint: [0xffd36e, 0xfff3c4, 0xf2a93b],
      frequency: 90,
      blendMode: Phaser.BlendModes.ADD,
    });
    this.root.addAt(sparks, this.root.getIndex(c));
    c.on(Phaser.Input.Events.GAMEOBJECT_POINTER_OVER, () => panel.setTint(0xfff0d0));
    c.on(Phaser.Input.Events.GAMEOBJECT_POINTER_OUT, () => panel.clearTint());
    c.on(Phaser.Input.Events.GAMEOBJECT_POINTER_UP, () => {
      if (!editable) {
        toast(this, ctx.lockReason || "Perks can't be chosen right now.", "info");
        return;
      }
      playUiSound("click");
      this.openPerkModal(merc);
    });
  }

  // ---- Equipment -----------------------------------------------------------------------

  private renderEquipment(ctx: Ctx): void {
    const { merc, editable } = ctx;
    const r = EQUIP;
    panelAt(this, this.root, r.x, r.y, r.w, r.h);
    sectionTitle(this, this.root, r.x + 20, r.y + 20, "Equipment", r.x + r.w - 20);
    const n = EQUIP_SLOTS.length;
    const pitch = (r.w - 40) / n;
    EQUIP_SLOTS.forEach((slot, i) => {
      const x = Math.round(r.x + 20 + pitch * (i + 0.5));
      const y = r.y + 72;
      const item = merc.equipment[slot];
      const s = slotView(this, x, y, {
        ...(item ? { rarity: item.rarity, icon: itemIcon(item) } : {}),
        ghostIcon: SLOT_PLACEHOLDER_ICON[slot],
      });
      s.setName(`equip:${slot}`);
      this.root.add(s);
      const label = this.add
        .text(x, y + SLOT_PX / 2 + 14, SLOT_LABELS[slot], {
          ...TEXT.tiny,
          fontSize: "12px",
          color: item ? COLORS.textDim : COLORS.textMuted,
        })
        .setOrigin(0.5);
      this.root.add(label);
      if (item?.perk) {
        // Relic marker.
        const star = this.add.image(x + 22, y - 22, iconTexture(this, "ui_perk")).setScale(1);
        this.root.add(star);
      }
      const canUnequip = editable && item && slot !== "weapon";
      if (s.input) s.input.cursor = canUnequip ? "pointer" : "default";
      attachTooltip(s, () => {
        if (!item) {
          return {
            title: `${SLOT_LABELS[slot]} — empty`,
            titleColor: COLORS.textDim,
            lines: [
              {
                text:
                  slot === "lamp"
                    ? "Equip a lamp to light the squad's way."
                    : "Equip something from the stash.",
                size: "small",
              },
            ],
          };
        }
        const footer =
          slot === "weapon"
            ? "Weapons can only be swapped, not removed"
            : !editable
              ? ctx.lockReason
              : "Click to unequip (returns to stash)";
        return itemTooltip(item, { merc, equippedIn: slot, footer });
      });
      s.on(Phaser.Input.Events.GAMEOBJECT_POINTER_OVER, () => {
        if (canUnequip) this.renderStats(ctx, previewUnequip(merc, slot));
      });
      s.on(Phaser.Input.Events.GAMEOBJECT_POINTER_OUT, () => this.renderStats(ctx, null));
      s.on(Phaser.Input.Events.GAMEOBJECT_POINTER_UP, () => {
        if (!item) return;
        if (slot === "weapon") {
          if (editable) toast(this, "Weapons can only be swapped — equip another from the stash.");
          return;
        }
        if (!editable) {
          toast(this, ctx.lockReason, "info");
          return;
        }
        playUiSound("click");
        hideTooltip(this);
        this.session.command({ type: "unequip", mercId: merc.id, slot });
      });
    });
  }

  private flashEquipSlot(slot: EquipSlot): void {
    const s = this.root.getByName(`equip:${slot}`) as Phaser.GameObjects.Container | null;
    if (!s) return;
    const flare = glow(this, s.x, s.y, 140, RAMPS.lamp[4], 0.9);
    this.root.add(flare);
    this.tweens.add({
      targets: flare,
      alpha: 0,
      scale: flare.scale * 1.6,
      duration: 520,
      ease: "Quad.out",
      onComplete: () => flare.destroy(),
    });
    this.tweens.add({ targets: s, scale: { from: 1.18, to: 1 }, duration: 260, ease: "Back.out" });
  }

  // ---- Stats ---------------------------------------------------------------------------

  /** (Re)draw the stat table; `preview` shows what a hovered change would do. */
  private renderStats(ctx: Ctx, preview: Stats | null): void {
    if (this.statsLayer) {
      this.statsLayer.destroy(true);
      this.statsLayer = null;
    }
    const layer = this.add.container(0, 0);
    this.statsLayer = layer;
    // Keep the stat table under tooltips/modals: insert into root.
    this.root.add(layer);
    const r = STATS;
    panelAt(this, layer, r.x, r.y, r.w, r.h);
    sectionTitle(this, layer, r.x + 20, r.y + 20, "Stats", r.x + r.w - 20);
    const cur = computeStats(ctx.merc);
    if (preview) {
      layer.add(
        this.add
          .text(r.x + r.w - 20, r.y + 20, "previewing change", {
            ...TEXT.tiny,
            color: COLORS.accent,
          })
          .setOrigin(1, 0.5),
      );
    }
    const colW = Math.floor((r.w - 40 - 24) / 3);
    STAT_GROUPS.forEach((group, gi) => {
      const x = Math.round(r.x + 20 + gi * (colW + 12));
      let y = r.y + 46;
      layer.add(
        this.add
          .text(x, y, group.title, { ...TEXT.small, color: COLORS.textDim, fontStyle: "600" })
          .setOrigin(0, 0.5),
      );
      const ug = this.add.graphics();
      ug.fillStyle(hexNum(RAMPS.void[3]), 1).fillRect(x, y + 11, colW, 2);
      layer.add(ug);
      y += 28;
      const rows = group.rows.filter(
        (row) =>
          row.core || rowValue(cur, row.key) !== 0 || (preview && rowValue(preview, row.key) !== 0),
      );
      const maxRows = 8;
      rows.slice(0, maxRows).forEach((row) => {
        const show = preview ?? cur;
        const delta = preview ? rowDelta(cur, preview, row) : "";
        const better = delta.startsWith("+");
        const hit = this.add
          .rectangle(x - 2, y - 10, colW + 4, 20, 0xffffff, 0)
          .setOrigin(0, 0)
          .setInteractive();
        layer.add(hit);
        layer.add(this.add.image(x + 8, y, iconTexture(this, row.icon)).setScale(1));
        const label = this.add
          .text(x + 22, y, row.label, {
            ...TEXT.small,
            fontSize: "16px",
            color: row.color ?? COLORS.textDim,
          })
          .setOrigin(0, 0.5);
        layer.add(label);
        const val = this.add
          .text(x + colW, y, rowText(show, row), {
            ...TEXT.small,
            fontSize: "16px",
            color: delta ? (better ? GAIN : LOSS) : COLORS.text,
          })
          .setOrigin(1, 0.5)
          .setName(`stat:${row.key}`);
        layer.add(val);
        const valLeft = x + colW - val.width;
        // Long labels drop to the small size rather than collide with the value.
        if (label.x + label.width + 8 > valLeft) label.setFontSize(12);
        if (delta) {
          const dt = this.add
            .text(valLeft - 6, y + 1, delta, { ...TEXT.tiny, color: better ? GAIN : LOSS })
            .setOrigin(1, 0.5);
          if (dt.x - dt.width < label.x + label.width + 6) {
            // No room for the number: a small up/down arrow instead.
            dt.destroy();
            layer.add(
              this.add
                .image(valLeft - 8, y, TEX.arrow)
                .setAngle(better ? -90 : 90)
                .setTint(hexNum(better ? GAIN : LOSS)),
            );
          } else {
            layer.add(dt);
          }
        }
        const help = STAT_HELP[row.key];
        attachTooltip(hit, () => ({
          title: row.key === "dmg" ? "Weapon Damage" : row.label,
          lines: [
            { text: `${rowText(cur, row)}`, color: COLORS.accentBright },
            ...(help ? [{ text: help, size: "small" as const }] : []),
          ],
          width: 300,
        }));
        y += 20;
      });
      if (rows.length > maxRows) {
        layer.add(
          this.add.text(x, y - 4, `+${rows.length - maxRows} more`, {
            ...TEXT.tiny,
            color: COLORS.textMuted,
          }),
        );
      }
    });
  }

  private flashStatChanges(before: Stats, after: Stats): void {
    const layer = this.statsLayer;
    if (!layer) return;
    for (const group of STAT_GROUPS) {
      for (const row of group.rows) {
        const d = rowValue(after, row.key) - rowValue(before, row.key);
        if (d === 0) continue;
        const t = layer.getByName(`stat:${row.key}`) as Phaser.GameObjects.Text | null;
        if (!t) continue;
        t.setColor(d > 0 ? GAIN : LOSS);
        const baseX = t.x;
        this.tweens.add({
          targets: t,
          x: { from: baseX - 4, to: baseX },
          duration: 240,
          ease: "Back.out",
        });
        this.time.delayedCall(1400, () => {
          if (t.active) t.setColor(COLORS.text);
        });
      }
    }
  }

  // ---- Skills --------------------------------------------------------------------------

  private renderSkills(ctx: Ctx): void {
    const { merc, editable } = ctx;
    const r = SKILLS;
    panelAt(this, this.root, r.x, r.y, r.w, r.h);
    sectionTitle(this, this.root, r.x + 20, r.y + 20, "Skills");
    let disc: ReturnType<typeof getDiscipline>;
    try {
      disc = getDiscipline(merc.discipline);
    } catch {
      return;
    }
    const slots = this.pending?.mercId === merc.id ? this.pending.slots : [...merc.skills];
    const chosen = slots.filter((s): s is string => !!s);
    const missing = 4 - chosen.length;
    const hint =
      missing > 0
        ? `Pick ${missing} more skill${missing > 1 ? "s" : ""}`
        : editable
          ? "4 of 6 equipped · click to swap"
          : "4 of 6 equipped";
    this.root.add(
      this.add
        .text(r.x + r.w - 20, r.y + 20, hint, {
          ...TEXT.small,
          color: missing > 0 ? COLORS.accentBright : COLORS.textMuted,
        })
        .setOrigin(1, 0.5),
    );
    const pitch = (r.w - 40) / disc.skills.length;
    disc.skills.forEach((skillId, i) => {
      const x = Math.round(r.x + 20 + pitch * (i + 0.5));
      const y = r.y + 78;
      const slotIdx = slots.indexOf(skillId);
      const on = slotIdx >= 0;
      const c = this.add.container(x, y);
      this.root.add(c);
      if (on) c.add(glow(this, 0, 0, 96, RAMPS.lamp[3], 0.3));
      const frame = this.add.image(0, 0, TEX.slot(on ? "relic" : undefined)).setScale(3);
      let ic: Phaser.GameObjects.Image;
      try {
        ic = this.add.image(0, 0, iconTexture(this, skillIcon(getSkill(skillId)))).setScale(3);
      } catch {
        ic = this.add.image(0, 0, iconTexture(this, `skill_${skillId}`)).setScale(3);
      }
      if (!on) {
        ic.setAlpha(0.45);
        frame.setAlpha(0.7);
      }
      const hover = this.add.graphics();
      hover.lineStyle(3, hexNum(COLORS.accentBright), 1);
      hover.strokeRect(-SLOT_PX / 2 - 3, -SLOT_PX / 2 - 3, SLOT_PX + 6, SLOT_PX + 6);
      hover.setVisible(false);
      c.add([frame, ic, hover]);
      if (on) {
        // Loadout order badge.
        const bg = this.add.graphics();
        bg.fillStyle(hexNum(INK), 1).fillRect(SLOT_PX / 2 - 18, -SLOT_PX / 2 - 4, 22, 20);
        bg.fillStyle(hexNum(RAMPS.lamp[2]), 1).fillRect(SLOT_PX / 2 - 16, -SLOT_PX / 2 - 2, 18, 16);
        const num = this.add
          .text(SLOT_PX / 2 - 7, -SLOT_PX / 2 + 6, String(slotIdx + 1), {
            ...TEXT.tiny,
            color: COLORS.ink,
            fontStyle: "700",
            shadow: undefined,
          })
          .setOrigin(0.5);
        c.add([bg, num]);
      }
      let skillName = skillId;
      try {
        skillName = getSkill(skillId).name;
      } catch {
        /* unknown skill id */
      }
      const label = this.add
        .text(x, y + SLOT_PX / 2 + 8, skillName, {
          ...TEXT.tiny,
          fontSize: "12px",
          color: on ? COLORS.text : COLORS.textMuted,
          align: "center",
          wordWrap: { width: pitch - 6 },
        })
        .setOrigin(0.5, 0);
      this.root.add(label);
      setHitBox(c, -SLOT_PX / 2, -SLOT_PX / 2, SLOT_PX, SLOT_PX, editable ? "pointer" : "default");
      c.on(Phaser.Input.Events.GAMEOBJECT_POINTER_OVER, () => hover.setVisible(true));
      c.on(Phaser.Input.Events.GAMEOBJECT_POINTER_OUT, () => hover.setVisible(false));
      attachTooltip(c, () =>
        safeTip(() =>
          skillTooltip(
            merc,
            skillId,
            !editable
              ? ctx.lockReason
              : on
                ? "Equipped · click to unequip"
                : missing > 0
                  ? "Click to equip"
                  : "Unequip a skill first to make room",
          ),
        ),
      );
      c.on(Phaser.Input.Events.GAMEOBJECT_POINTER_UP, () => this.toggleSkill(ctx, skillId));
    });
  }

  private toggleSkill(ctx: Ctx, skillId: string): void {
    const { merc, editable } = ctx;
    if (!editable) {
      toast(this, ctx.lockReason, "info");
      return;
    }
    const slots = this.pending?.mercId === merc.id ? [...this.pending.slots] : [...merc.skills];
    while (slots.length < 4) slots.push(null);
    const idx = slots.indexOf(skillId);
    if (idx >= 0) {
      slots[idx] = null;
    } else {
      const free = slots.indexOf(null);
      if (free < 0) {
        playUiSound("error");
        toast(this, "All 4 skill slots are full — click an equipped skill to free one.", "info");
        return;
      }
      slots[free] = skillId;
    }
    playUiSound("click");
    hideTooltip(this);
    this.pending = { mercId: merc.id, slots };
    const full = slots.every((s) => s !== null);
    if (full && !sameSet(slots, merc.skills)) {
      this.session.command({
        type: "setSkills",
        mercId: merc.id,
        skills: slots.filter((s): s is string => !!s),
      });
    }
    this.render();
  }

  // ---- Perks ---------------------------------------------------------------------------

  private renderPerks(ctx: Ctx): void {
    const { merc } = ctx;
    const r = PERKS;
    panelAt(this, this.root, r.x, r.y, r.w, r.h);
    const perks = mercPerks(merc);
    sectionTitle(this, this.root, r.x + 20, r.y + 20, "Perks");
    this.root.add(
      this.add
        .text(r.x + r.w - 20, r.y + 20, String(perks.length), {
          ...TEXT.small,
          color: COLORS.textMuted,
        })
        .setOrigin(1, 0.5),
    );
    if (perks.length === 0) {
      this.root.add(
        this.add.text(r.x + 20, r.y + 44, "No perks yet. Level up to choose one.", {
          ...TEXT.small,
          color: COLORS.textMuted,
          wordWrap: { width: r.w - 40 },
        }),
      );
      return;
    }
    let x = r.x + 20;
    let y = r.y + 40;
    const maxX = r.x + r.w - 20;
    const rowH = 32;
    const maxY = r.y + r.h - 16;
    let shown = 0;
    for (const { perk, source } of perks) {
      const c = chip(this, x, y, perk.name, {
        color: perkColor(perk, source),
        ...(source === "relic" ? { icon: "ui_perk" } : {}),
      });
      if (x + c.width > maxX && x > r.x + 20) {
        x = r.x + 20;
        y += rowH;
        c.setPosition(x, y);
      }
      if (y + 28 > maxY) {
        c.destroy();
        break;
      }
      if (c.width > maxX - x) c.destroy();
      else {
        this.root.add(c);
        attachTooltip(c, perkTooltip(perk, source));
        c.setName(`perk:${perk.id}`);
        x += c.width + 6;
        shown++;
      }
    }
    if (shown < perks.length) {
      this.root.add(
        this.add
          .text(r.x + r.w - 20, r.y + r.h - 18, `+${perks.length - shown} more`, {
            ...TEXT.tiny,
            color: COLORS.textMuted,
          })
          .setOrigin(1, 0.5),
      );
    }
  }

  private openPerkModal(merc: Merc): void {
    const offer = merc.perkOffers[0];
    if (!offer || (this.modal && !this.modal.closed)) return;
    hideTooltip(this);
    const cardW = 256;
    const cardH = 224;
    const gap = 16;
    const width = cardW * 3 + gap * 2 + 64;
    const nextLevel = merc.level - merc.perkOffers.length + 1;
    const modal = openModal(this, {
      title: "Level up — choose a perk",
      body: `${merc.name} reached level ${nextLevel}. Pick one perk to keep for the rest of the expedition.`,
      width,
      contentHeight: cardH,
      variant: "highlight",
      buttons: [{ label: "Decide later", kind: "secondary", width: 200 }],
      content: ({ container, width: inner }) => {
        const total = offer.length * cardW + (offer.length - 1) * gap;
        let x = (inner - total) / 2;
        for (const perkId of offer) {
          const perk = safePerk(perkId);
          if (!perk) continue;
          const card = this.perkCard(perk, cardW, cardH, () => {
            this.celebrate = { mercId: merc.id, perkId };
            this.session.command({ type: "choosePerk", mercId: merc.id, perkId });
            modal.close();
          });
          card.setPosition(x, 0);
          container.add(card);
          x += cardW + gap;
        }
      },
    });
    this.modal = modal;
    modal.onClose(() => {
      this.modalClosedFrame = this.game.loop.frame;
      this.modal = null;
    });
  }

  private perkCard(
    perk: ReturnType<typeof getPerk>,
    w: number,
    h: number,
    onPick: () => void,
  ): Phaser.GameObjects.Container {
    const c = this.add.container(0, 0);
    const halo = glow(this, w / 2, h / 2, w * 1.3, perkColor(perk), 0).setDisplaySize(
      w * 1.4,
      h * 1.2,
    );
    const panel = createPanel(this, 0, 0, w, h, { variant: "inset", originX: 0, originY: 0 });
    const isDisc = perk.pool !== "general";
    const tag = chip(this, 16, 16, perkPoolLabel(perk), {
      color: isDisc ? RAMPS.lamp[4] : RAMPS.steel[5],
      height: 22,
      fontSize: 12,
      ...(isDisc ? { icon: `disc_${perk.pool}` } : {}),
    });
    tag.disableInteractive();
    const name = this.add.text(16, 50, perk.name, {
      ...TEXT.subheading,
      color: perkColor(perk),
      wordWrap: { width: w - 32 },
    });
    const desc = this.add.text(16, 50 + name.height + 10, perk.desc, {
      ...TEXT.body,
      fontSize: "18px",
      color: COLORS.text,
      wordWrap: { width: w - 32 },
      lineSpacing: 4,
    });
    const badge = this.add.image(w - 30, 28, iconTexture(this, "ui_perk")).setScale(2);
    c.add([halo, panel, tag, badge, name, desc]);
    let y = desc.y + desc.height + 12;
    const extra: { text: string; color: string; icon?: string }[] = [];
    for (const line of formatMods(perk.mods ?? {})) extra.push({ text: line, color: GAIN });
    if (perk.skillMods) {
      for (const s of Object.keys(perk.skillMods)) {
        let skillIconId: string | undefined;
        try {
          skillIconId = skillIcon(getSkill(s));
        } catch {
          skillIconId = undefined;
        }
        extra.push({
          text: `Improves ${safeName(() => getSkill(s).name, s)}`,
          color: RARITY_COLORS.relic,
          ...(skillIconId ? { icon: skillIconId } : {}),
        });
      }
    }
    for (const line of extra) {
      const dx = line.icon ? 22 : 0;
      if (line.icon) c.add(this.add.image(24, y + 9, iconTexture(this, line.icon)).setScale(1));
      const t = this.add.text(16 + dx, y, line.text, {
        ...TEXT.small,
        color: line.color,
        wordWrap: { width: w - 32 - dx },
      });
      c.add(t);
      y += Math.max(t.height, 18) + 4;
    }
    const pick = this.add
      .text(w / 2, h - 22, "Choose", { ...TEXT.button, fontSize: "18px", color: COLORS.textDim })
      .setOrigin(0.5);
    c.add(pick);
    setHitBox(c, 0, 0, w, h);
    c.on(Phaser.Input.Events.GAMEOBJECT_POINTER_OVER, () => {
      playUiSound("hover");
      panel.setTexture(TEX.panel("highlight"));
      pick.setColor(COLORS.accentPale);
      this.tweens.add({ targets: halo, alpha: 0.35, duration: DURATION.fast });
      this.tweens.add({ targets: c, y: -4, duration: DURATION.fast, ease: "Quad.out" });
    });
    c.on(Phaser.Input.Events.GAMEOBJECT_POINTER_OUT, () => {
      panel.setTexture(TEX.panel("inset"));
      pick.setColor(COLORS.textDim);
      this.tweens.add({ targets: halo, alpha: 0, duration: DURATION.fast });
      this.tweens.add({ targets: c, y: 0, duration: DURATION.fast, ease: "Quad.out" });
    });
    c.on(Phaser.Input.Events.GAMEOBJECT_POINTER_UP, () => {
      playUiSound("click");
      onPick();
    });
    return c;
  }

  private playCelebration(perkId: string): void {
    const perk = safePerk(perkId);
    const { x, y } = this.spriteAnchor;
    const burst = glow(this, x, y, 120, RAMPS.lamp[4], 1);
    const ring = this.add.graphics({ x, y });
    ring.lineStyle(4, hexNum(RAMPS.lamp[4]), 1).strokeCircle(0, 0, 40);
    ring.setBlendMode(Phaser.BlendModes.ADD);
    this.tweens.add({
      targets: burst,
      displayWidth: 520,
      displayHeight: 520,
      alpha: 0,
      duration: 900,
      ease: "Quad.out",
      onComplete: () => burst.destroy(),
    });
    this.tweens.add({
      targets: ring,
      scale: 4,
      alpha: 0,
      duration: 700,
      ease: "Quad.out",
      onComplete: () => ring.destroy(),
    });
    const sparks = this.add.particles(x, y, TEX.dot, {
      speed: { min: 80, max: 220 },
      lifespan: { min: 500, max: 1000 },
      scale: { start: 2, end: 0.5 },
      alpha: { start: 1, end: 0 },
      tint: [0xffd36e, 0xfff3c4, 0xf2a93b],
      blendMode: Phaser.BlendModes.ADD,
      emitting: false,
    });
    sparks.explode(48);
    this.time.delayedCall(1200, () => sparks.destroy());
    const chipObj = this.root.getByName(`perk:${perkId}`) as Phaser.GameObjects.Container | null;
    if (chipObj) {
      this.tweens.add({
        targets: chipObj,
        scale: { from: 1.3, to: 1 },
        duration: 400,
        ease: "Back.out",
      });
    }
    if (perk) toast(this, `${perk.name} learned!`, "success");
  }

  // ---- Stash ---------------------------------------------------------------------------

  private filteredStash(view: RunView): Item[] {
    const items = view.stash.filter((i) => this.filter === "all" || i.slot === this.filter);
    return items.sort(
      (a, b) =>
        SLOT_ORDER[a.slot] - SLOT_ORDER[b.slot] ||
        RARITIES.indexOf(b.rarity) - RARITIES.indexOf(a.rarity) ||
        b.ilvl - a.ilvl ||
        a.uid - b.uid,
    );
  }

  private renderStash(ctx: Ctx): void {
    const { view, merc, editable, phaseOk } = ctx;
    const r = STASH;
    panelAt(this, this.root, r.x, r.y, r.w, r.h);
    sectionTitle(this, this.root, r.x + 20, r.y + 20, "Shared stash");
    this.root.add(
      this.add
        .text(r.x + r.w - 20, r.y + 20, `${view.stash.length} items`, {
          ...TEXT.small,
          color: COLORS.textMuted,
        })
        .setOrigin(1, 0.5),
    );

    // Filter tabs.
    const fw = (r.w - 40 - 4 * 4) / FILTERS.length;
    FILTERS.forEach((f, i) => {
      const x = Math.round(r.x + 20 + i * (fw + 4));
      const y = r.y + 40;
      const active = this.filter === f.id;
      const count =
        f.id === "all" ? view.stash.length : view.stash.filter((it) => it.slot === f.id).length;
      const g = this.add.graphics();
      const edge = active ? hexNum(RAMPS.lamp[3]) : hexNum(RAMPS.steel[2]);
      g.fillStyle(hexNum(INK), 1).fillRect(x, y, fw, 32);
      g.fillStyle(edge, 1).fillRect(x + 1, y + 1, fw - 2, 30);
      g.fillStyle(hexNum(active ? RAMPS.void[3] : RAMPS.void[1]), 1).fillRect(
        x + 3,
        y + 3,
        fw - 6,
        26,
      );
      const t = this.add
        .text(x + fw / 2, y + 15, f.label, {
          ...TEXT.small,
          fontSize: "16px",
          color: active ? COLORS.accentPale : count ? COLORS.textDim : COLORS.textMuted,
        })
        .setOrigin(0.5);
      const hit = this.add
        .rectangle(x, y, fw, 32, 0xffffff, 0)
        .setOrigin(0)
        .setInteractive({ useHandCursor: !active });
      hit.on(Phaser.Input.Events.GAMEOBJECT_POINTER_OVER, () => {
        if (!active) t.setColor(COLORS.accentPale);
      });
      hit.on(Phaser.Input.Events.GAMEOBJECT_POINTER_OUT, () => {
        if (!active) t.setColor(count ? COLORS.textDim : COLORS.textMuted);
      });
      hit.on(Phaser.Input.Events.GAMEOBJECT_POINTER_UP, () => {
        if (active) return;
        playUiSound("click");
        this.filter = f.id;
        this.stashScroll = 0;
        hideTooltip(this);
        this.render();
      });
      this.root.add([g, t, hit]);
    });

    // Grid.
    const items = this.filteredStash(view);
    const rows = Math.ceil(items.length / GRID_COLS);
    const maxScroll = Math.max(0, rows - GRID_ROWS);
    this.stashScroll = Phaser.Math.Clamp(this.stashScroll, 0, maxScroll);
    const start = this.stashScroll * GRID_COLS;
    const visible = items.slice(start, start + GRID_COLS * GRID_ROWS);
    // Empty cell wells.
    const wells = this.add.graphics();
    for (let i = 0; i < GRID_COLS * GRID_ROWS; i++) {
      const cx = GRID_X + (i % GRID_COLS) * CELL;
      const cy = GRID_Y + Math.floor(i / GRID_COLS) * CELL;
      wells.fillStyle(hexNum(RAMPS.void[0]), 0.9).fillRect(cx + 4, cy + 4, CELL - 8, CELL - 8);
      wells.fillStyle(hexNum(RAMPS.void[2]), 0.6).fillRect(cx + 4, cy + CELL - 6, CELL - 8, 2);
    }
    this.root.add(wells);
    if (items.length === 0) {
      this.root.add(
        this.add
          .text(
            GRID_X + (GRID_COLS * CELL) / 2,
            GRID_Y + (GRID_ROWS * CELL) / 2,
            view.stash.length === 0
              ? "The stash is empty.\nLoot from fights and caches lands here."
              : "Nothing of this kind in the stash.",
            { ...TEXT.small, color: COLORS.textMuted, align: "center", lineSpacing: 6 },
          )
          .setOrigin(0.5),
      );
    }
    visible.forEach((item, i) => {
      const x = GRID_X + (i % GRID_COLS) * CELL + CELL / 2;
      const y = GRID_Y + Math.floor(i / GRID_COLS) * CELL + CELL / 2;
      const blocker = canEquip(merc, item);
      const s = slotView(this, x, y, {
        rarity: item.rarity,
        icon: itemIcon(item),
        dim: !!blocker,
      });
      this.root.add(s);
      if (blocker) {
        s.add(this.add.image(18, 18, iconTexture(this, "ui_lock")).setScale(1));
      } else if (isUpgrade(merc, item)) {
        const arrow = this.add
          .image(20, 18, TEX.arrow)
          .setAngle(-90)
          .setScale(2)
          .setTint(hexNum(GAIN));
        s.add(arrow);
      }
      if (item.perk) s.add(this.add.image(-20, -20, iconTexture(this, "ui_perk")).setScale(1));
      if (s.input) s.input.cursor = editable && !blocker ? "pointer" : "default";
      attachTooltip(s, () => {
        const both =
          item.slot === "trinket" &&
          merc.equipment.trinket1 !== null &&
          merc.equipment.trinket2 !== null;
        const footer = blocker
          ? `Can't be used by ${merc.name}`
          : !editable
            ? ctx.lockReason
            : both
              ? `Click to choose which trinket to replace`
              : `Click to equip on ${merc.name}`;
        return itemTooltip(item, { merc, footer });
      });
      s.on(Phaser.Input.Events.GAMEOBJECT_POINTER_OVER, () => {
        if (!blocker) this.renderStats(ctx, previewStats(merc, item, targetSlot(merc, item)));
      });
      s.on(Phaser.Input.Events.GAMEOBJECT_POINTER_OUT, () => this.renderStats(ctx, null));
      s.on(Phaser.Input.Events.GAMEOBJECT_POINTER_UP, () => this.clickStashItem(ctx, item, s));
    });

    // Scrollbar.
    if (maxScroll > 0) {
      const sx = GRID_X + GRID_COLS * CELL + 6;
      const sh = GRID_ROWS * CELL;
      const sb = this.add.graphics();
      sb.fillStyle(hexNum(RAMPS.void[0]), 1).fillRect(sx, GRID_Y, 6, sh);
      const th = Math.max(24, (sh * GRID_ROWS) / rows);
      const ty = GRID_Y + ((sh - th) * this.stashScroll) / maxScroll;
      sb.fillStyle(hexNum(RAMPS.lamp[2]), 1).fillRect(sx, ty, 6, th);
      this.root.add(sb);
    }

    // Footer: ore, lamp, refuel.
    const fy = r.y + r.h - 108;
    const div = this.add.graphics();
    div.fillStyle(hexNum(RAMPS.void[3]), 1).fillRect(r.x + 20, fy, r.w - 40, 2);
    this.root.add(div);
    const rowY = fy + 26;
    icon(this, this.root, "ui_ore", r.x + 36, rowY, 2);
    const ore = this.add
      .text(r.x + 58, rowY, `${view.ore}`, { ...TEXT.number, color: RAMPS.crystal[5] })
      .setOrigin(0, 0.5);
    const oreLbl = this.add
      .text(r.x + 62 + ore.width, rowY + 1, "ore", { ...TEXT.small, color: COLORS.textMuted })
      .setOrigin(0, 0.5);
    this.root.add([ore, oreLbl]);
    const lampX = r.x + 168;
    icon(this, this.root, "ui_lamp", lampX, rowY, 2);
    const lg = this.add.graphics();
    const lampFrac = view.lampCharge / 100;
    drawBar(lg, lampX + 22, rowY - 8, 168, 16, lampFrac, {
      fill: lampFrac < 0.25 ? RAMPS.rust[3] : RAMPS.lamp[3],
      fillHi: lampFrac < 0.25 ? RAMPS.rust[4] : RAMPS.lamp[5],
      ticks: 16,
    });
    this.root.add(lg);
    this.root.add(
      this.add
        .text(r.x + r.w - 20, rowY, `${Math.round(view.lampCharge)}%`, {
          ...TEXT.small,
          color: lampFrac < 0.25 ? COLORS.danger : COLORS.accentBright,
        })
        .setOrigin(1, 0.5),
    );
    const lampHit = this.add
      .rectangle(lampX - 16, rowY - 16, r.x + r.w - 20 - (lampX - 16), 32, 0xffffff, 0)
      .setOrigin(0)
      .setInteractive();
    this.root.add(lampHit);
    attachTooltip(lampHit, {
      title: "Lamp charge",
      titleColor: COLORS.accentBright,
      lines: [
        { text: `${Math.round(view.lampCharge)} / 100`, color: COLORS.accentBright },
        {
          text: "Each step drains the lamp. As it dims, the dark deepens: enemies grow stronger, but loot gets richer.",
          size: "small",
        },
      ],
      width: 340,
    });
    const canRefuel = phaseOk && view.ore >= REFUEL_COST && view.lampCharge < 100;
    const btn = new Button(this, r.x + r.w / 2, r.y + r.h - 40, {
      label: `Refuel lamp (${REFUEL_COST} ore)`,
      icon: "ui_lamp",
      width: r.w - 40,
      height: 44,
      kind: "primary",
      disabled: !canRefuel,
      onClick: () => {
        hideTooltip(this);
        this.session.command({ type: "refuel" });
      },
    });
    this.root.add(btn);
    attachTooltip(btn, () => ({
      title: "Refuel lamp",
      titleColor: COLORS.accentBright,
      lines: [
        {
          text: !phaseOk
            ? "No time to refuel right now."
            : view.lampCharge >= 100
              ? "The lamp is already full."
              : view.ore < REFUEL_COST
                ? `Needs ${REFUEL_COST} ore (you have ${view.ore}).`
                : `Spend ${REFUEL_COST} ore to restore lamp charge. Shared by the squad.`,
          size: "small",
        },
      ],
      width: 320,
    }));
  }

  private clickStashItem(ctx: Ctx, item: Item, cell: Phaser.GameObjects.Container): void {
    const { merc, editable } = ctx;
    this.closeChooser();
    if (!editable) {
      toast(this, ctx.lockReason, "info");
      return;
    }
    const blocker = canEquip(merc, item);
    if (blocker) {
      playUiSound("error");
      toast(this, blocker, "error");
      return;
    }
    if (
      item.slot === "trinket" &&
      merc.equipment.trinket1 !== null &&
      merc.equipment.trinket2 !== null
    ) {
      this.openTrinketChooser(ctx, item, cell.x, cell.y);
      return;
    }
    this.equip(merc, item, targetSlot(merc, item));
  }

  private equip(merc: Merc, item: Item, slot: EquipSlot): void {
    playUiSound("click");
    hideTooltip(this);
    this.flashSlot = { mercId: merc.id, slot };
    this.session.command({ type: "equip", mercId: merc.id, itemUid: item.uid, slot });
  }

  private openTrinketChooser(ctx: Ctx, item: Item, x: number, y: number): void {
    hideTooltip(this);
    const { merc } = ctx;
    const w = 280;
    const h = 156;
    const left = Phaser.Math.Clamp(x - w / 2, M, GAME_W - M - w);
    const top = Phaser.Math.Clamp(y + 36, M, GAME_H - M - h);
    const c = this.add.container(left, top).setDepth(5000);
    const panel = createPanel(this, 0, 0, w, h, { variant: "highlight", originX: 0, originY: 0 });
    panel.setInteractive();
    const title = this.add
      .text(16, 22, "Replace which trinket?", { ...TEXT.small, color: COLORS.accentPale })
      .setOrigin(0, 0.5);
    c.add([panel, title]);
    (["trinket1", "trinket2"] as const).forEach((slot, i) => {
      const cur = merc.equipment[slot];
      const b = new Button(this, w / 2, 64 + i * 52, {
        label: `${SLOT_LABELS[slot]}: ${cur ? truncate(cur.name, 16) : "empty"}`,
        width: w - 32,
        height: 44,
        onClick: () => {
          this.closeChooser();
          this.equip(merc, item, slot);
        },
      });
      b.label.setFontSize(16);
      if (cur) b.label.setColor(RARITY_COLORS[cur.rarity]);
      c.add(b);
      if (cur) attachTooltip(b, () => itemTooltip(cur, { merc, equippedIn: slot }));
    });
    c.setAlpha(0);
    this.tweens.add({ targets: c, alpha: 1, duration: DURATION.fast });
    this.chooser = c;
  }

  private closeChooser(): void {
    if (!this.chooser) return;
    const c = this.chooser;
    this.chooser = null;
    hideTooltip(this);
    c.destroy(true);
  }
}

// ---------------------------------------------------------------------------------------

interface Ctx {
  view: RunView;
  merc: Merc;
  owned: boolean;
  editable: boolean;
  phaseOk: boolean;
  lockReason: string;
}

function ownerName(view: RunView, merc: Merc): string {
  return view.players.find((p) => p.id === merc.ownerId)?.name ?? "Another player";
}

function sameSet(a: readonly (string | null)[], b: readonly string[]): boolean {
  const x = a.filter((s): s is string => !!s);
  return x.length === b.length && x.every((s, i) => s === b[i]);
}

function safeName(fn: () => string, fallback: string): string {
  try {
    return fn();
  } catch {
    return cap(fallback);
  }
}

function safeTip(fn: () => TooltipContent): TooltipContent | null {
  try {
    return fn();
  } catch (err) {
    console.warn("character: tooltip failed", err);
    return null;
  }
}

function hpColors(frac: number): { fill: string; fillHi: string } {
  if (frac <= 0.3) return { fill: RAMPS.rust[3], fillHi: RAMPS.rust[4] };
  if (frac <= 0.6) return { fill: RAMPS.lamp[2], fillHi: RAMPS.lamp[4] };
  return { fill: RAMPS.toxic[3], fillHi: RAMPS.toxic[4] };
}

function truncate(s: string, n: number): string {
  return s.length > n ? `${s.slice(0, n - 1)}…` : s;
}
