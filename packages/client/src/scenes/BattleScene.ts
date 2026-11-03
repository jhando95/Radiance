import {
  canAct,
  darknessLevel,
  describeSkill,
  getSkill,
  type RunEvent,
  type RunView,
  skillBlocker,
  skillIcon,
  skillModsFor,
  type Unit,
  type UnitView,
  validTargets,
} from "@radiance/core";
import * as Phaser from "phaser";
import { ELEMENT_COLORS, hexNum, RAMPS } from "../art/palette";
import { audio, type Sfx } from "../audio";
import { SCENES } from "../app/scenes";
import { animDuration, getSettings } from "../app/settings";
import { backdropTexture, iconTexture } from "../app/textures";
import { goTo } from "../app/transitions";
import { type GameGlobals, globals } from "../game/globals";
import { unitFrame, type UnitPose, unitPortrait, unitTexture } from "../game/unitArt";
import type { GameSession, SessionEvent } from "../net/session";
import { Button } from "../ui/Button";
import { attachTooltip } from "../ui/Tooltip";
import { toast } from "../ui/Toast";
import { COLOR_NUM, COLORS, FONT_FAMILY, GAME_H, GAME_W, TEXT } from "../ui/theme";

const FEET_Y = 500;
const SCALE = 4;
const MERC_X = (rank: number) => 540 - (rank - 1) * 128;
const ENEMY_X = (rank: number) => 740 + (rank - 1) * 128;
const HUD_Y = 572;

const STATUS_COLORS: Record<string, string> = {
  bleed: RAMPS.rust[4],
  burn: RAMPS.lamp[3],
  toxic: RAMPS.toxic[4],
  stun: RAMPS.lamp[5],
  mark: RAMPS.rust[5],
  guard: RAMPS.steel[5],
  shield: RAMPS.crystal[4],
  blind: RAMPS.bone[4],
  corrode: RAMPS.toxic[3],
  haste: RAMPS.crystal[5],
  slow: RAMPS.steel[4],
  regen: RAMPS.toxic[5],
  empower: RAMPS.lamp[4],
  weaken: RAMPS.umbra[4],
  taunt: RAMPS.rust[4],
  evasive: RAMPS.crystal[4],
  lit: RAMPS.lamp[5],
};

interface UnitSprite {
  id: string;
  side: Unit["side"];
  root: Phaser.GameObjects.Container;
  sprite: Phaser.GameObjects.Image;
  shadow: Phaser.GameObjects.Ellipse;
  hpBack: Phaser.GameObjects.Rectangle;
  hpFill: Phaser.GameObjects.Rectangle;
  hpText: Phaser.GameObjects.Text;
  shieldText: Phaser.GameObjects.Text;
  statusRow: Phaser.GameObjects.Container;
  marker: Phaser.GameObjects.Text;
  hit: Phaser.GameObjects.Rectangle;
  pose: UnitPose;
  /** Currently displayed HP (animated ahead of the authoritative view). */
  hp: number;
  maxHp: number;
  hidden: boolean;
  baseX: number;
  scale: number;
}

/**
 * Ranked, initiative-based combat. Renders the authoritative RunView and plays the event
 * stream as animations; all rules come from @radiance/core via the session.
 */
export class BattleScene extends Phaser.Scene {
  private session!: GameSession;
  private g!: GameGlobals;
  private view: RunView | null = null;
  private units = new Map<string, UnitSprite>();
  private pending: { view: RunView; events: RunEvent[] }[] = [];
  private playing = false;
  private selectedSkill: string | null = null;
  private hud!: Phaser.GameObjects.Container;
  private turnBar!: Phaser.GameObjects.Container;
  private lightHud!: Phaser.GameObjects.Container;
  private darkTex: Phaser.Textures.CanvasTexture | null = null;
  private darkImage!: Phaser.GameObjects.Image;
  private glowLayer!: Phaser.GameObjects.Container;
  private banner: Phaser.GameObjects.Text | null = null;
  private idleFrame = 0;
  private unsubscribe: (() => void) | null = null;
  private leaving = false;

  constructor() {
    super({ key: SCENES.combat });
  }

  init(): void {
    this.g = globals;
    this.session = globals.session as GameSession;
    this.view = null;
    this.units = new Map();
    this.pending = [];
    this.playing = false;
    this.selectedSkill = null;
    this.leaving = false;
    this.darkTex = null;
    this.banner = null;
  }

  create(): void {
    const view = this.session.currentView;
    if (!view?.combat) {
      goTo(this, SCENES.expedition);
      return;
    }
    const node = view.nodes.find((n) => n.id === view.currentNodeId);
    const biome = node?.biome ?? "duskMines";
    const layers = backdropTexture(this, biome, node?.row ?? 1);
    layers.forEach((key, i) => {
      const img = this.add.image(GAME_W / 2, GAME_H / 2, key).setScale(SCALE);
      img.setDepth(-100 + i);
      this.tweens.add({
        targets: img,
        x: GAME_W / 2 - 6 * (i + 1),
        duration: 9000 + i * 1500,
        yoyo: true,
        repeat: -1,
        ease: "Sine.inOut",
      });
    });
    this.darkImage = this.add.image(0, 0, "__WHITE").setOrigin(0).setDepth(50).setVisible(false);
    this.glowLayer = this.add.container(0, 0).setDepth(51);
    this.turnBar = this.add.container(0, 0).setDepth(100);
    this.lightHud = this.add.container(0, 0).setDepth(100);
    this.hud = this.add.container(0, 0).setDepth(100);

    const kind = view.combat.kind;
    audio.setMusic(kind === "boss" ? "boss" : kind === "elite" ? "elite" : "combat");
    if (kind === "boss") audio.play("bossRoar");

    this.applyView(view, true);
    this.unsubscribe = this.session.subscribe((e) => this.onSession(e));
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.unsubscribe?.());

    this.time.addEvent({ delay: 520, loop: true, callback: () => this.tickIdle() });
    this.input.keyboard?.on("keydown-ESC", () => {
      if (this.selectedSkill) this.selectSkill(null);
      else this.g.openPause?.(this);
    });
    this.input.keyboard?.on("keydown", (ev: KeyboardEvent) => {
      const n = Number(ev.key);
      if (n >= 1 && n <= 6) this.hotkey(n - 1);
    });
    this.input.on("pointerdown", (p: Phaser.Input.Pointer) => {
      if (p.rightButtonDown()) this.selectSkill(null);
    });
    this.input.mouse?.disableContextMenu();
  }

  // -------------------------------------------------------------------------
  // Session / animation queue
  // -------------------------------------------------------------------------

  private onSession(e: SessionEvent): void {
    if (e.type === "state") {
      this.pending.push({ view: e.view, events: e.events });
      void this.drain();
    } else if (e.type === "error") {
      toast(this, e.message, "error");
      audio.play("uiError");
    }
  }

  private async drain(): Promise<void> {
    if (this.playing) return;
    this.playing = true;
    this.renderHud();
    while (this.pending.length) {
      const next = this.pending.shift() as { view: RunView; events: RunEvent[] };
      for (const ev of next.events) await this.animate(ev, next.view);
      this.applyView(next.view, false);
    }
    this.playing = false;
    this.renderHud();
    this.maybeLeave();
  }

  private maybeLeave(): void {
    const view = this.view;
    if (!view || this.leaving || view.phase === "combat") return;
    this.leaving = true;
    const won = view.phase !== "defeat";
    this.showBanner(won ? "VICTORY" : "DEFEAT", won ? COLORS.accentBright : COLORS.danger);
    audio.play(won ? "victory" : "defeat");
    this.time.delayedCall(1500, () => {
      goTo(this, view.phase === "victory" || view.phase === "defeat" ? SCENES.summary : SCENES.expedition);
    });
  }

  private wait(ms: number): Promise<void> {
    return new Promise((resolve) => this.time.delayedCall(animDuration(ms), () => resolve()));
  }

  // -------------------------------------------------------------------------
  // Rendering the authoritative view
  // -------------------------------------------------------------------------

  private applyView(view: RunView, instant: boolean): void {
    this.view = view;
    const combat = view.combat;
    if (!combat) {
      this.renderHud();
      return;
    }
    const present = new Set<string>();
    for (const u of [...combat.mercs, ...combat.enemies]) {
      present.add(u.id);
      const s = this.units.get(u.id) ?? this.createUnit(u);
      this.syncUnit(s, u, instant);
    }
    for (const [id, s] of this.units) {
      if (present.has(id)) continue;
      this.units.delete(id);
      this.tweens.add({ targets: s.root, alpha: 0, y: s.root.y + 20, duration: 300, onComplete: () => s.root.destroy() });
    }
    this.renderLighting();
    this.renderTurnBar();
    this.renderLightHud();
    this.renderHud();
    audio.setDarkness(darknessLevel(view.lampCharge) / 3);
  }

  private createUnit(u: UnitView): UnitSprite {
    const frame = unitFrame(u);
    const scale = frame.w > 48 ? 3 : SCALE;
    const x = u.side === "merc" ? MERC_X(u.rank) : ENEMY_X(u.rank);
    const root = this.add.container(x, FEET_Y).setDepth(10);
    const shadow = this.add.ellipse(0, 4, 26 * scale, 6 * scale, 0x000000, 0.45);
    const sprite = this.add
      .image(0, 0, unitTexture(this, u, this.view?.mercs ?? [], u.downed ? "downed" : "idle0"))
      .setOrigin(frame.centerX / frame.w, frame.footY / frame.h)
      .setScale(scale);
    const barW = 96;
    const hpBack = this.add.rectangle(-barW / 2, 22, barW, 10, 0x05040a).setOrigin(0, 0.5).setStrokeStyle(2, 0x231f3d);
    const hpFill = this.add.rectangle(-barW / 2 + 1, 22, barW - 2, 6, u.side === "merc" ? 0xbd4a2e : 0x82261f).setOrigin(0, 0.5);
    const hpText = this.add.text(0, 32, "", { fontFamily: FONT_FAMILY, fontSize: "16px", color: COLORS.text }).setOrigin(0.5, 0);
    const shieldText = this.add.text(barW / 2 + 6, 22, "", { fontFamily: FONT_FAMILY, fontSize: "16px", color: COLORS.info }).setOrigin(0, 0.5);
    const statusRow = this.add.container(0, 58);
    const marker = this.add
      .text(0, frame.w > 48 ? -frame.footY * scale * 0.85 : -(36 * scale + 6), "▼", { fontFamily: FONT_FAMILY, fontSize: "28px", color: COLORS.accentBright })
      .setOrigin(0.5, 1)
      .setVisible(false);
    const hit = this.add.rectangle(0, -70, 116, 190, 0xffffff, 0).setInteractive({ useHandCursor: true });
    root.add([shadow, sprite, hpBack, hpFill, hpText, shieldText, statusRow, marker, hit]);
    const s: UnitSprite = {
      id: u.id,
      side: u.side,
      root,
      sprite,
      shadow,
      hpBack,
      hpFill,
      hpText,
      shieldText,
      statusRow,
      marker,
      hit,
      pose: "idle0",
      hp: u.hp,
      maxHp: u.stats.maxHp,
      hidden: u.hidden,
      baseX: x,
      scale,
    };
    hit.on("pointerdown", (p: Phaser.Input.Pointer) => {
      if (p.leftButtonDown()) this.onUnitClick(u.id);
    });
    attachTooltip(hit, () => this.unitTooltip(u.id));
    this.units.set(u.id, s);
    root.setAlpha(0);
    this.tweens.add({ targets: root, alpha: 1, duration: 250 });
    return s;
  }

  private syncUnit(s: UnitSprite, u: UnitView, instant: boolean): void {
    const x = u.side === "merc" ? MERC_X(u.rank) : ENEMY_X(u.rank);
    s.baseX = x;
    if (instant) s.root.x = x;
    else if (Math.abs(s.root.x - x) > 1) this.tweens.add({ targets: s.root, x, duration: animDuration(260), ease: "Quad.out" });
    s.hp = u.hp;
    s.maxHp = u.stats.maxHp;
    s.hidden = u.hidden;
    this.setPose(s, u.downed ? "downed" : "idle0");
    this.drawHp(s);
    const shield = u.statuses.filter((st) => st.id === "shield").reduce((a, st) => a + st.value, 0);
    s.shieldText.setText(shield > 0 ? `◆${shield}` : "");
    // Unlit enemies are swallowed by darkness.
    s.sprite.setTint(u.side === "enemy" && !u.lit ? 0x4a4677 : 0xffffff);
    s.statusRow.removeAll(true);
    const shown = u.statuses.filter((st) => st.id !== "shield").slice(0, 5);
    shown.forEach((st, i) => {
      const icon = this.add.image((i - (shown.length - 1) / 2) * 28, 0, iconTexture(this, `status_${st.id}`)).setScale(1.5);
      const turns = this.add
        .text(icon.x + 8, 6, String(st.turns), { fontFamily: FONT_FAMILY, fontSize: "12px", color: COLORS.text })
        .setOrigin(0.5, 0);
      s.statusRow.add([icon, turns]);
    });
    s.root.setDepth(10 + (u.side === "merc" ? 5 - u.rank : u.rank));
  }

  private drawHp(s: UnitSprite): void {
    const full = 94;
    if (s.hidden) {
      s.hpFill.width = full;
      s.hpFill.setFillStyle(0x231f3d);
      s.hpText.setText("???").setColor(COLORS.textMuted);
      return;
    }
    s.hpFill.setFillStyle(s.side === "merc" ? 0xbd4a2e : 0x82261f);
    s.hpFill.width = Math.max(0, (full * Math.max(0, s.hp)) / Math.max(1, s.maxHp));
    s.hpText.setText(`${Math.max(0, s.hp)}/${s.maxHp}`).setColor(COLORS.text);
  }

  private setPose(s: UnitSprite, pose: UnitPose): void {
    if (!this.view) return;
    const unit = this.findUnitView(s.id);
    if (!unit) return;
    s.pose = pose;
    s.sprite.setTexture(unitTexture(this, unit, this.view.mercs, pose));
  }

  private tickIdle(): void {
    if (this.playing) return;
    this.idleFrame ^= 1;
    for (const s of this.units.values()) {
      if (s.pose === "idle0" || s.pose === "idle1") this.setPose(s, this.idleFrame ? "idle1" : "idle0");
    }
  }

  private findUnitView(id: string): UnitView | undefined {
    const c = this.view?.combat;
    return c?.mercs.find((u) => u.id === id) ?? c?.enemies.find((u) => u.id === id);
  }

  // -------------------------------------------------------------------------
  // Lighting
  // -------------------------------------------------------------------------

  private renderLighting(): void {
    const view = this.view;
    const combat = view?.combat;
    if (!view || !combat) return;
    const W = 320;
    const H = 180;
    if (!this.darkTex) {
      this.darkTex = this.textures.createCanvas("battle.dark", W, H);
      this.darkImage.setTexture("battle.dark").setScale(SCALE).setVisible(true);
    }
    const tex = this.darkTex;
    if (!tex) return;
    const ctx = tex.getContext();
    const darkness = darknessLevel(view.lampCharge);
    ctx.globalCompositeOperation = "source-over";
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = `rgba(5,4,10,${0.5 + darkness * 0.1})`;
    ctx.fillRect(0, 0, W, H);
    ctx.globalCompositeOperation = "destination-out";
    const hole = (x: number, y: number, r: number, strength: number) => {
      const g = ctx.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, `rgba(0,0,0,${strength})`);
      g.addColorStop(0.6, `rgba(0,0,0,${strength * 0.6})`);
      g.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = g;
      ctx.fillRect(x - r, y - r, r * 2, r * 2);
    };
    const lamp = Math.max(0, ...combat.mercs.map((m) => m.stats.lightRadius));
    // The squad's own light pool.
    for (const m of combat.mercs) hole(MERC_X(m.rank) / SCALE, (FEET_Y - 60) / SCALE, 34, 0.95);
    // Light reaching into the enemy ranks.
    for (const e of combat.enemies) {
      if (e.lit) hole(ENEMY_X(e.rank) / SCALE, (FEET_Y - 60) / SCALE, 30, 0.9);
    }
    hole(W / 2, (FEET_Y - 50) / SCALE, 20 + combat.lightRadius * 8, 0.5);
    tex.refresh();

    // Warm glow around the lamp bearer.
    this.glowLayer.removeAll(true);
    const bearer = combat.mercs.find((m) => m.stats.lightRadius === lamp && lamp > 0);
    if (bearer) {
      const glow = this.add
        .image(MERC_X(bearer.rank) + 30, FEET_Y - 80, iconTexture(this, "__glow"))
        .setVisible(false);
      this.glowLayer.add(glow);
      const g = this.add.graphics();
      for (let i = 6; i > 0; i--) {
        g.fillStyle(hexNum(RAMPS.lamp[3]), 0.025 * (7 - i));
        g.fillCircle(MERC_X(bearer.rank) + 24, FEET_Y - 70, 30 + i * 22);
      }
      g.setBlendMode(Phaser.BlendModes.ADD);
      this.glowLayer.add(g);
    }
  }

  private renderLightHud(): void {
    const view = this.view;
    const combat = view?.combat;
    this.lightHud.removeAll(true);
    if (!view || !combat) return;
    const x = 24;
    const y = 20;
    this.lightHud.add(this.add.image(x + 12, y + 12, iconTexture(this, "ui_lamp")).setScale(2));
    const barW = 160;
    this.lightHud.add(this.add.rectangle(x + 32, y + 12, barW, 12, 0x05040a).setOrigin(0, 0.5).setStrokeStyle(2, 0x34305a));
    this.lightHud.add(
      this.add.rectangle(x + 33, y + 12, ((barW - 2) * view.lampCharge) / 100, 8, hexNum(RAMPS.lamp[3])).setOrigin(0, 0.5),
    );
    const label = ["Bright", "Dim", "Dark", "Pitch dark"][darknessLevel(view.lampCharge)] as string;
    this.lightHud.add(
      this.add.text(x + 32, y + 24, `Lamp ${view.lampCharge}% · ${label} · light reaches ${combat.lightRadius} rank${combat.lightRadius === 1 ? "" : "s"}`, {
        ...TEXT.tiny,
        color: COLORS.textDim,
      }),
    );
  }

  private renderTurnBar(): void {
    const view = this.view;
    const combat = view?.combat;
    this.turnBar.removeAll(true);
    if (!view || !combat) return;
    const order = [combat.active, ...combat.queue].filter((id): id is string => !!id).slice(0, 9);
    const size = 44;
    const startX = GAME_W / 2 - ((order.length - 1) * (size + 8)) / 2;
    this.turnBar.add(
      this.add.text(GAME_W / 2, 16, `ROUND ${combat.round}`, { ...TEXT.tiny, color: COLORS.textMuted }).setOrigin(0.5, 0),
    );
    order.forEach((id, i) => {
      const u = this.findUnitView(id);
      if (!u) return;
      const x = startX + i * (size + 8);
      const y = 56;
      const active = i === 0;
      const frame = this.add
        .rectangle(x, y, size, size, u.side === "merc" ? 0x17142a : 0x24090c)
        .setStrokeStyle(active ? 3 : 2, active ? COLOR_NUM.accentBright : u.side === "merc" ? 0x566c8f : 0x82261f);
      const portrait = this.add.image(x, y, unitPortrait(this, u, view.mercs)).setScale(size / 26);
      if (u.side === "enemy" && !u.lit) portrait.setTint(0x4a4677);
      this.turnBar.add([frame, portrait]);
      if (active) {
        this.tweens.add({ targets: frame, scale: 1.08, duration: 500, yoyo: true, repeat: -1 });
      }
    });
  }

  // -------------------------------------------------------------------------
  // HUD (skill bar) & input
  // -------------------------------------------------------------------------

  private activeUnit(): UnitView | undefined {
    const c = this.view?.combat;
    return c?.active ? c.mercs.find((u) => u.id === c.active) : undefined;
  }

  private myTurn(): boolean {
    const u = this.activeUnit();
    return !!u && u.ownerId === this.view?.viewerId && !this.playing && this.view?.phase === "combat";
  }

  private renderHud(): void {
    this.hud.removeAll(true);
    for (const s of this.units.values()) s.marker.setVisible(false);
    const view = this.view;
    const combat = view?.combat;
    if (!view || !combat) return;
    const panel = this.add.rectangle(0, HUD_Y, GAME_W, GAME_H - HUD_Y, 0x07060b, 0.92).setOrigin(0);
    const line = this.add.rectangle(0, HUD_Y, GAME_W, 2, hexNum(RAMPS.lamp[1])).setOrigin(0);
    this.hud.add([panel, line]);
    const unit = this.activeUnit();

    if (!unit) {
      this.hud.add(this.add.text(GAME_W / 2, HUD_Y + 64, this.playing ? "" : "…", TEXT.bodyDim).setOrigin(0.5));
      return;
    }
    // Active merc info.
    const portrait = this.add.image(72, HUD_Y + 72, unitPortrait(this, unit, view.mercs)).setScale(3.4);
    const owner = view.players.find((p) => p.id === unit.ownerId)?.name ?? "";
    const mine = unit.ownerId === view.viewerId;
    this.hud.add([
      this.add.rectangle(72, HUD_Y + 72, 92, 92, 0x17142a).setStrokeStyle(2, COLOR_NUM.accent),
      portrait,
      this.add.text(132, HUD_Y + 20, unit.name, TEXT.subheading),
      this.add.text(132, HUD_Y + 46, `${unit.hp}/${unit.stats.maxHp} HP · Rank ${unit.rank}`, TEXT.small),
      this.add.text(132, HUD_Y + 68, mine ? "Your turn" : `${owner}'s turn`, {
        ...TEXT.small,
        color: mine ? COLORS.accentBright : COLORS.textMuted,
      }),
    ]);
    if (!mine || this.playing) {
      if (!mine) {
        this.hud.add(this.add.text(GAME_W / 2 + 60, HUD_Y + 72, `Waiting for ${owner}…`, TEXT.bodyDim).setOrigin(0.5));
      }
      return;
    }

    const skills = [...unit.skills, "move", "wait"];
    const size = 72;
    const startX = 420;
    skills.forEach((id, i) => {
      const skill = getSkill(id);
      const x = startX + i * (size + 14);
      const y = HUD_Y + 74;
      const blocker = this.skillReason(unit, id);
      const cd = unit.cooldowns[id] ?? 0;
      const selected = this.selectedSkill === id;
      const frame = this.add
        .rectangle(x, y, size, size, selected ? 0x3b1f0e : 0x17142a)
        .setStrokeStyle(selected ? 3 : 2, selected ? COLOR_NUM.accentBright : blocker ? 0x34305a : COLOR_NUM.accent)
        .setInteractive({ useHandCursor: !blocker });
      const icon = this.add.image(x, y, iconTexture(this, skillIcon(skill))).setScale(3.5);
      if (blocker) icon.setTint(0x4a4677);
      const key = this.add.text(x - size / 2 + 4, y - size / 2 + 2, String(i + 1), { ...TEXT.tiny, color: COLORS.textMuted });
      this.hud.add([frame, icon, key]);
      if (cd > 0) {
        this.hud.add(this.add.rectangle(x, y, size - 4, size - 4, 0x000000, 0.55));
        this.hud.add(this.add.text(x, y, String(cd), { ...TEXT.title, fontSize: "32px" }).setOrigin(0.5));
      }
      const label = this.add.text(x, y + size / 2 + 6, skill.name, { ...TEXT.tiny, color: blocker ? COLORS.textMuted : COLORS.text }).setOrigin(0.5, 0);
      label.setWordWrapWidth(size + 12);
      label.setAlign("center");
      this.hud.add(label);
      frame.on("pointerdown", () => {
        if (blocker) {
          toast(this, blocker, "error");
          audio.play("uiError");
          return;
        }
        this.chooseSkill(id);
      });
      attachTooltip(frame, () => {
        const text = describeSkill(skill, skillModsFor(unit, id));
        return {
          title: text.name,
          titleColor: ELEMENT_COLORS[skill.element],
          subtitle: [text.usage, text.cooldown ? `Cooldown ${text.cooldown}` : ""].filter(Boolean).join(" · "),
          lines: [...text.lines, ...(blocker ? [{ text: blocker, color: COLORS.danger }] : [])],
        };
      });
    });

    if (this.selectedSkill) {
      const skill = getSkill(this.selectedSkill);
      const targets = validTargets(combat, unit, skill).map((t) => t.id);
      for (const id of targets) this.units.get(id)?.marker.setVisible(true).setColor(skill.target.side === "enemy" ? COLORS.danger : COLORS.success);
      const hint = skill.target.aoe ? "Click any highlighted target to unleash" : "Choose a target · Esc to cancel";
      this.hud.add(this.add.text(GAME_W / 2 + 120, HUD_Y - 28, hint, { ...TEXT.small, color: COLORS.accentPale }).setOrigin(0.5));
    }
  }

  private skillReason(unit: UnitView, id: string): string | null {
    const combat = this.view?.combat;
    if (!combat) return "No fight";
    const skill = getSkill(id);
    if ((unit.cooldowns[id] ?? 0) > 0) return `${skill.name} is on cooldown.`;
    const targets = validTargets(combat, unit, skill);
    if (!(skill.from as number[]).includes(unit.rank)) return `Can't be used from rank ${unit.rank}.`;
    if (targets.length === 0) return "No valid targets in range.";
    return null;
  }

  private hotkey(index: number): void {
    const unit = this.activeUnit();
    if (!unit || !this.myTurn()) return;
    const id = [...unit.skills, "move", "wait"][index];
    if (!id) return;
    if (this.skillReason(unit, id)) {
      audio.play("uiError");
      return;
    }
    this.chooseSkill(id);
  }

  private chooseSkill(id: string): void {
    const unit = this.activeUnit();
    if (!unit || !this.myTurn()) return;
    const skill = getSkill(id);
    audio.play("skillSelect");
    if (skill.target.side === "self") {
      this.useSkill(id);
      return;
    }
    this.selectSkill(this.selectedSkill === id ? null : id);
  }

  private selectSkill(id: string | null): void {
    this.selectedSkill = id;
    this.renderHud();
  }

  private onUnitClick(unitId: string): void {
    if (!this.selectedSkill || !this.myTurn()) return;
    const unit = this.activeUnit();
    const combat = this.view?.combat;
    if (!unit || !combat) return;
    const skill = getSkill(this.selectedSkill);
    const targets = validTargets(combat, unit, skill);
    if (!targets.some((t) => t.id === unitId)) {
      audio.play("uiError");
      return;
    }
    audio.play("targetSelect");
    this.useSkill(this.selectedSkill, skill.target.aoe ? undefined : unitId);
  }

  private useSkill(skillId: string, targetId?: string): void {
    const unit = this.activeUnit();
    const combat = this.view?.combat;
    if (!unit || !combat) return;
    const err = skillBlocker(combat, unit, skillId, targetId);
    if (err) {
      toast(this, err, "error");
      return;
    }
    this.selectedSkill = null;
    this.session.command({ type: "useSkill", unitId: unit.id, skillId, ...(targetId ? { targetId } : {}) });
    // Lock input until the server answers.
    this.hud.removeAll(true);
  }

  private unitTooltip(id: string) {
    const u = this.findUnitView(id);
    if (!u) return null;
    const lines: { text: string; color?: string; icon?: string }[] = [];
    if (u.hidden) lines.push({ text: "Shrouded in darkness. Light this rank to see its health.", color: COLORS.textMuted });
    else lines.push({ text: `${u.hp}/${u.stats.maxHp} HP · Speed ${u.stats.speed} · Dodge ${u.stats.dodge} · Prot ${u.stats.prot}%` });
    if (u.umbral) lines.push({ text: "Umbral: stronger in darkness, weak to radiant.", color: COLORS.umbra });
    for (const st of u.statuses) {
      lines.push({ text: `${st.id[0]?.toUpperCase()}${st.id.slice(1)} ${st.value ? `(${st.value}) ` : ""}— ${st.turns} turn(s)`, color: STATUS_COLORS[st.id], icon: `status_${st.id}` });
    }
    return {
      title: u.name,
      titleColor: u.side === "merc" ? COLORS.accentBright : u.boss ? COLORS.relic : u.elite ? COLORS.epic : COLORS.danger,
      subtitle: `Rank ${u.rank}${u.side === "enemy" ? (u.lit ? " · Lit" : " · Unlit") : ""}`,
      lines,
    };
  }

  // -------------------------------------------------------------------------
  // Event animations
  // -------------------------------------------------------------------------

  private floatText(x: number, y: number, text: string, color: string, size = 28, delay = 0): void {
    if (!getSettings().damageNumbers && /^\d/.test(text)) return;
    const t = this.add
      .text(x, y, text, { fontFamily: FONT_FAMILY, fontSize: `${size}px`, fontStyle: "700", color, stroke: "#05040a", strokeThickness: 5 })
      .setOrigin(0.5)
      .setDepth(200)
      .setAlpha(0);
    this.tweens.add({
      targets: t,
      y: y - 56,
      alpha: { from: 1, to: 0 },
      delay,
      duration: animDuration(1000),
      ease: "Cubic.out",
      onComplete: () => t.destroy(),
    });
  }

  private headY(s: UnitSprite): number {
    return s.root.y - 48 * s.scale * 0.75;
  }

  private async animate(ev: RunEvent, next: RunView): Promise<void> {
    switch (ev.type) {
      case "round":
        return;
      case "turn": {
        const s = this.units.get(ev.unitId);
        if (!s) return;
        if (s.side === "merc") audio.play("turnStart");
        this.tweens.add({ targets: s.sprite, y: -6, duration: animDuration(90), yoyo: true });
        return this.wait(s.side === "enemy" ? 140 : 60);
      }
      case "skill": {
        const s = this.units.get(ev.unitId);
        if (!s) return;
        const skill = getSkill(ev.skillId);
        const unitView = this.findUnitView(ev.unitId) ?? next.combat?.mercs.find((u) => u.id === ev.unitId);
        if (skill.id === "wait") {
          this.floatText(s.root.x, this.headY(s), "Hold", COLORS.textDim, 20);
          return this.wait(250);
        }
        if (skill.id === "move") {
          audio.play("move");
          return this.wait(120);
        }
        const hostile = skill.target.side === "enemy";
        const ranged = !(skill.from as number[]).includes(1);
        const caster = skill.kind === "support" || skill.element === "radiant" || skill.element === "void";
        this.setPose(s, caster && (ranged || !hostile) ? "cast" : "attack");
        this.label(s, skill.name, unitView?.side === "enemy" ? COLORS.danger : COLORS.accentPale);
        audio.play(this.skillSfx(unitView, skill.element, ranged, caster, hostile));
        if (hostile && !ranged) {
          const dir = s.side === "merc" ? 1 : -1;
          this.tweens.add({ targets: s.root, x: s.baseX + 46 * dir, duration: animDuration(120), yoyo: true, hold: animDuration(140), ease: "Quad.out" });
        } else if (hostile && ranged) {
          const target = ev.targetIds[0] ? this.units.get(ev.targetIds[0]) : undefined;
          if (target) this.projectile(s, target, ELEMENT_COLORS[skill.element]);
        }
        await this.wait(320);
        return;
      }
      case "hit": {
        const t = this.units.get(ev.targetId);
        if (!t) return;
        const src = this.units.get(ev.sourceId);
        this.setPose(t, "hurt");
        t.sprite.setTint(0xffffff).setTintMode(Phaser.TintModes.FILL);
        this.time.delayedCall(animDuration(80), () => {
          t.sprite.setTintMode(Phaser.TintModes.MULTIPLY);
          const u = this.findUnitView(t.id);
          t.sprite.setTint(u && u.side === "enemy" && !u.lit ? 0x4a4677 : 0xffffff);
        });
        const dir = t.side === "merc" ? -1 : 1;
        this.tweens.add({ targets: t.root, x: t.baseX + 14 * dir, duration: animDuration(70), yoyo: true });
        t.hp -= ev.amount;
        this.drawHp(t);
        const color = ELEMENT_COLORS[ev.element];
        const text = ev.amount > 0 ? String(ev.amount) : ev.absorbed > 0 ? `◆${ev.absorbed}` : "0";
        if (ev.crit) {
          this.floatText(t.root.x, this.headY(t) - 30, "CRIT!", COLORS.accentBright, 22);
          if (getSettings().screenShake) this.cameras.main.shake(140, 0.006);
          audio.play("crit");
        } else {
          audio.play(this.hitSfx(ev.element));
        }
        this.floatText(t.root.x, this.headY(t), text, color, ev.crit ? 40 : 30);
        if (ev.absorbed > 0 && ev.amount > 0) this.floatText(t.root.x + 40, this.headY(t) + 20, `◆${ev.absorbed}`, COLORS.info, 18);
        void src;
        await this.wait(230);
        if (t.pose === "hurt") this.setPose(t, "idle0");
        return;
      }
      case "miss": {
        const t = this.units.get(ev.targetId);
        if (!t) return;
        this.floatText(t.root.x, this.headY(t), "Miss", COLORS.textMuted, 24);
        audio.play("miss");
        const dir = t.side === "merc" ? -1 : 1;
        this.tweens.add({ targets: t.root, x: t.baseX + 24 * dir, duration: animDuration(110), yoyo: true });
        return this.wait(200);
      }
      case "heal": {
        const t = this.units.get(ev.targetId);
        if (!t) return;
        if (ev.amount > 0) {
          t.hp = Math.min(t.maxHp, t.hp + ev.amount);
          this.drawHp(t);
          this.floatText(t.root.x, this.headY(t), `+${ev.amount}`, COLORS.success, 28);
        } else {
          this.floatText(t.root.x, this.headY(t), "Cleansed", COLORS.success, 20);
        }
        audio.play("heal");
        return this.wait(180);
      }
      case "status": {
        const t = this.units.get(ev.targetId);
        if (!t) return;
        const name = ev.status[0]?.toUpperCase() + ev.status.slice(1);
        this.floatText(t.root.x, this.headY(t) + 30, name, STATUS_COLORS[ev.status] ?? COLORS.text, 18, 80);
        audio.play(ev.status === "stun" ? "stun" : ev.status === "bleed" ? "bleed" : ev.status === "burn" ? "burn" : t.side === "merc" && ["empower", "shield", "regen", "evasive", "haste", "guard", "taunt"].includes(ev.status) ? "buff" : "debuff");
        return this.wait(110);
      }
      case "resist": {
        const t = this.units.get(ev.targetId);
        if (t) this.floatText(t.root.x, this.headY(t) + 30, "Resisted", COLORS.textDim, 18, 80);
        return this.wait(90);
      }
      case "tick": {
        const t = this.units.get(ev.targetId);
        if (!t) return;
        t.hp -= ev.amount;
        this.drawHp(t);
        this.floatText(t.root.x, this.headY(t), String(ev.amount), STATUS_COLORS[ev.status] ?? COLORS.danger, 24);
        audio.play("dotTick");
        return this.wait(220);
      }
      case "stunned": {
        const t = this.units.get(ev.unitId);
        if (t) this.floatText(t.root.x, this.headY(t), "Stunned", COLORS.accentPale, 22);
        return this.wait(300);
      }
      case "move": {
        const s = this.units.get(ev.unitId);
        if (!s) return;
        const x = s.side === "merc" ? MERC_X(ev.to) : ENEMY_X(ev.to);
        s.baseX = x;
        this.tweens.add({ targets: s.root, x, duration: animDuration(220), ease: "Quad.out" });
        return this.wait(120);
      }
      case "downed": {
        const s = this.units.get(ev.unitId);
        if (!s) return;
        this.setPose(s, "downed");
        this.floatText(s.root.x, this.headY(s), "Downed", COLORS.danger, 24);
        audio.play("downed");
        return this.wait(350);
      }
      case "died": {
        const s = this.units.get(ev.unitId);
        if (!s) return;
        audio.play("enemyDeath");
        this.units.delete(ev.unitId);
        this.burst(s.root.x, s.root.y - 60, RAMPS.umbra[4]);
        this.tweens.add({ targets: s.root, alpha: 0, y: s.root.y + 16, duration: animDuration(380), onComplete: () => s.root.destroy() });
        return this.wait(300);
      }
      case "revived": {
        const s = this.units.get(ev.unitId);
        if (!s) return;
        this.setPose(s, "idle0");
        this.floatText(s.root.x, this.headY(s), "Rekindled!", COLORS.accentBright, 24);
        audio.play("revive");
        return this.wait(300);
      }
      case "guarded": {
        const g = this.units.get(ev.guardId);
        if (g) this.floatText(g.root.x, this.headY(g), "Guard!", COLORS.info, 22);
        audio.play("block");
        return this.wait(160);
      }
      case "lamp": {
        audio.play(ev.amount > 0 ? "lampRefuel" : "lampDrain");
        this.floatText(140, 70, `Lamp ${ev.amount > 0 ? "+" : ""}${ev.amount}`, ev.amount > 0 ? COLORS.accentBright : COLORS.umbra, 20);
        return this.wait(150);
      }
      case "light":
        audio.play(ev.radius > 0 ? "lightUp" : "lampDrain");
        return this.wait(80);
      case "end":
        return this.wait(300);
      default:
        return;
    }
  }

  private skillSfx(unit: Unit | undefined, element: string, ranged: boolean, caster: boolean, hostile: boolean): Sfx {
    if (!hostile) return element === "void" ? "castVoid" : "castRadiant";
    if (element === "radiant") return "castRadiant";
    if (element === "void" || element === "toxic") return "castVoid";
    if (element === "fire") return "flare";
    if (unit?.side === "merc" && unit.defId === "vanguard") return "hammerImpact";
    if (ranged || unit?.defId === "gunner") return "gunshot";
    void caster;
    return "bladeSlash";
  }

  private hitSfx(element: string): Sfx {
    switch (element) {
      case "radiant":
        return "hitRadiant";
      case "void":
        return "hitVoid";
      case "fire":
        return "hitFire";
      case "toxic":
        return "hitToxic";
      default:
        return "hitPhysical";
    }
  }

  private label(s: UnitSprite, text: string, color: string): void {
    const t = this.add
      .text(s.root.x, this.headY(s) - 70, text, { fontFamily: FONT_FAMILY, fontSize: "20px", fontStyle: "700", color, stroke: "#05040a", strokeThickness: 5 })
      .setOrigin(0.5)
      .setDepth(210);
    this.tweens.add({ targets: t, alpha: { from: 1, to: 0 }, delay: animDuration(500), duration: animDuration(300), onComplete: () => t.destroy() });
  }

  private projectile(from: UnitSprite, to: UnitSprite, color: string): void {
    const y = from.root.y - 90;
    const p = this.add.rectangle(from.root.x, y, 14, 4, hexNum(color)).setDepth(150).setBlendMode(Phaser.BlendModes.ADD);
    this.tweens.add({ targets: p, x: to.root.x, y: to.root.y - 90, duration: animDuration(160), onComplete: () => p.destroy() });
  }

  private burst(x: number, y: number, color: string): void {
    for (let i = 0; i < 14; i++) {
      const a = (i / 14) * Math.PI * 2;
      const p = this.add.rectangle(x, y, 6, 6, hexNum(color)).setDepth(150);
      this.tweens.add({
        targets: p,
        x: x + Math.cos(a) * (40 + (i % 3) * 18),
        y: y + Math.sin(a) * (40 + (i % 3) * 18),
        alpha: 0,
        duration: animDuration(500),
        onComplete: () => p.destroy(),
      });
    }
  }

  private showBanner(text: string, color: string): void {
    this.banner?.destroy();
    this.banner = this.add
      .text(GAME_W / 2, 250, text, { ...TEXT.display, color, stroke: "#05040a", strokeThickness: 8 })
      .setOrigin(0.5)
      .setDepth(300)
      .setScale(0.6)
      .setAlpha(0);
    this.tweens.add({ targets: this.banner, scale: 1, alpha: 1, duration: 300, ease: "Back.out" });
  }
}

export { canAct, Button };
