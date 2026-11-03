import {
  type CombatEvent,
  type CombatView,
  canPlayCard,
  describeCard,
  describeIntent,
  type EnemyView,
  enemyName,
  getCard,
  getClass,
  type PlayerView,
} from "@radiance/core";
import * as Phaser from "phaser";
import type { GameSession, SessionEvent } from "../net/session";
import { toast } from "../ui/toast";

export const WIDTH = 1280;
export const HEIGHT = 720;

const FONT = "Georgia, 'Times New Roman', serif";
const C = {
  ink: "#f2ead8",
  muted: "#a49cb5",
  gold: "#f5c45e",
  red: "#e0655a",
  blue: "#7fb3ff",
  panel: 0x1a1626,
  panel2: 0x241e35,
  border: 0x3a3150,
  hp: 0xc0473d,
  block: 0x4f86d9,
  goldHex: 0xf5c45e,
  select: 0x9be3a5,
};

const CARD_COLORS: Record<string, number> = { attack: 0x5a2630, skill: 0x23405a, power: 0x4a3a1c };

type Pos = { x: number; y: number };

/**
 * Renders a CombatView and turns clicks into Commands. Holds NO game rules: everything
 * shown comes from the view, and every action goes through the GameSession.
 *
 * Rendering is "rebuild on every state" for now. The event list is used for simple
 * floating numbers; a proper animation queue driven by events is a milestone-1 task.
 */
export class CombatScene extends Phaser.Scene {
  private session!: GameSession;
  private view: CombatView | null = null;
  private root!: Phaser.GameObjects.Container;
  private selectedCard: number | null = null;
  private positions = new Map<string, Pos>();
  private status = "";
  private unsubscribe: (() => void) | null = null;

  constructor() {
    super("combat");
  }

  init(data: { session: GameSession }): void {
    this.session = data.session;
    this.view = data.session.currentView;
    this.selectedCard = null;
  }

  create(): void {
    this.cameras.main.setBackgroundColor("#0d0b14");
    this.root = this.add.container(0, 0);
    this.unsubscribe = this.session.subscribe((e) => this.onSessionEvent(e));
    this.input.keyboard?.on("keydown-ESC", () => this.select(null));
    this.input.keyboard?.on("keydown-E", () => this.endTurn());
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.unsubscribe?.());
    this.redraw();
  }

  private onSessionEvent(e: SessionEvent): void {
    if (e.type === "state") {
      this.view = e.view;
      if (this.selectedCard !== null && !this.me()?.hand.some((c) => c.uid === this.selectedCard)) {
        this.selectedCard = null;
      }
      this.redraw();
      this.playEvents(e.events);
    } else if (e.type === "status") {
      this.status = e.text;
      this.redraw();
    } else if (e.type === "lobby") {
      this.redraw();
    }
  }

  private me(): PlayerView | undefined {
    return this.view?.players.find((p) => p.id === this.view?.viewerId);
  }

  // -------------------------------------------------------------------------
  // Drawing
  // -------------------------------------------------------------------------

  private redraw(): void {
    this.root.removeAll(true);
    this.positions.clear();
    const view = this.view;
    if (!view) {
      this.text(WIDTH / 2, HEIGHT / 2, this.status || "Waiting for combat…", 24).setOrigin(0.5);
      return;
    }
    this.drawTopBar(view);
    for (const [i, p] of view.players.entries()) this.drawPlayer(view, p, i);
    for (const [i, e] of view.enemies.entries()) this.drawEnemy(view, e, i);
    this.drawHand(view);
    this.drawEndTurn(view);
    if (view.phase !== "player") this.drawResult(view);
  }

  private text(x: number, y: number, str: string, size = 16, color = C.ink, wrap?: number) {
    const t = this.add.text(x, y, str, {
      fontFamily: FONT,
      fontSize: `${size}px`,
      color,
      align: "center",
      wordWrap: wrap ? { width: wrap } : undefined,
    });
    this.root.add(t);
    return t;
  }

  private rect(x: number, y: number, w: number, h: number, fill: number, stroke = C.border) {
    const r = this.add.rectangle(x, y, w, h, fill).setStrokeStyle(2, stroke);
    this.root.add(r);
    return r;
  }

  private bar(x: number, y: number, w: number, value: number, max: number, color: number) {
    this.rect(x, y, w, 12, 0x000000, C.border).setOrigin(0, 0.5);
    const fill = this.add.rectangle(x, y, Math.max(0, (w * value) / Math.max(1, max)), 12, color);
    fill.setOrigin(0, 0.5);
    this.root.add(fill);
  }

  private drawTopBar(view: CombatView): void {
    this.text(24, 18, `Turn ${view.turn}`, 20, C.gold);
    const pipW = 22;
    const startX = WIDTH / 2 - (view.maxRadiance * pipW) / 2;
    this.text(WIDTH / 2, 8, "RADIANCE (shared)", 12, C.muted).setOrigin(0.5, 0);
    for (let i = 0; i < view.maxRadiance; i++) {
      const lit = i < view.radiance;
      this.rect(startX + i * pipW + pipW / 2, 36, 16, 16, lit ? C.goldHex : C.panel2).setAngle(45);
    }
    const right = [this.session.mode === "online" ? "Online" : "Offline", this.status]
      .filter(Boolean)
      .join(" · ");
    this.text(WIDTH - 24, 18, right, 14, C.muted).setOrigin(1, 0);
  }

  private drawPlayer(view: CombatView, p: PlayerView, i: number): void {
    const x = 160;
    const y = 120 + i * 118;
    this.positions.set(p.id, { x, y });
    const isMe = p.id === view.viewerId;
    const selected = this.selectedDef();
    const targetable = selected?.targeting === "ally" && !p.downed;
    const panel = this.rect(
      x,
      y,
      270,
      104,
      C.panel,
      targetable ? C.select : isMe ? 0x7a6a9a : C.border,
    );
    if (targetable) {
      panel
        .setInteractive({ useHandCursor: true })
        .on("pointerdown", () => this.playSelected(p.id));
    }
    const cls = getClass(p.classId);
    const title = `${p.name}${isMe ? " (you)" : ""} — ${cls.name}`;
    this.text(x - 125, y - 44, title, 15, p.downed ? C.red : C.ink).setOrigin(0, 0);
    this.bar(x - 125, y - 10, 180, p.hp, p.maxHp, C.hp);
    this.text(x + 62, y - 19, `${p.hp}/${p.maxHp}`, 13).setOrigin(0, 0);
    if (p.block > 0) this.text(x - 125, y + 4, `◆ ${p.block} Block`, 14, C.blue).setOrigin(0, 0);
    const statuses = Object.entries(p.statuses)
      .map(([k, v]) => `${k} ${v}`)
      .join("  ");
    if (statuses) this.text(x - 125, y + 24, statuses, 12, C.muted).setOrigin(0, 0);
    const right = p.downed ? "DOWNED" : p.ready ? "✓ ready" : `⚡ ${p.energy}/${p.maxEnergy}`;
    this.text(x + 125, y - 44, right, 14, p.ready ? C.gold : C.muted).setOrigin(1, 0);
    if (!isMe) this.text(x + 125, y + 26, `${p.hand.length} in hand`, 12, C.muted).setOrigin(1, 0);
  }

  private drawEnemy(view: CombatView, e: EnemyView, i: number): void {
    const n = view.enemies.length;
    const span = 640;
    const x = 560 + (span / (n + 1)) * (i + 1);
    const y = 300;
    this.positions.set(e.id, { x, y });
    const alive = e.hp > 0;
    const selected = this.selectedDef();
    const targetable = alive && selected?.targeting === "enemy";
    const body = this.rect(
      x,
      y,
      170,
      190,
      alive ? C.panel2 : 0x111111,
      targetable ? C.select : C.border,
    );
    if (targetable) {
      body.setInteractive({ useHandCursor: true }).on("pointerdown", () => this.playSelected(e.id));
    }
    this.text(x, y - 80, enemyName(e), 17, alive ? C.ink : C.muted).setOrigin(0.5, 0);
    if (!alive) {
      this.text(x, y, "defeated", 16, C.muted).setOrigin(0.5);
      return;
    }
    this.bar(x - 70, y + 60, 140, e.hp, e.maxHp, C.hp);
    this.text(x, y + 72, `${e.hp}/${e.maxHp}`, 13).setOrigin(0.5, 0);
    if (e.block > 0) this.text(x, y + 30, `◆ ${e.block}`, 15, C.blue).setOrigin(0.5);
    const statuses = Object.entries(e.statuses)
      .map(([k, v]) => `${k} ${v}`)
      .join("  ");
    if (statuses) this.text(x, y + 5, statuses, 12, C.muted).setOrigin(0.5);
    if (!e.illuminated) this.text(x, y - 40, "veiled", 12, C.muted).setOrigin(0.5);

    const intent = describeIntent(view, e);
    if (intent) {
      const target = intent.targetsAll
        ? "→ all"
        : intent.targetId
          ? `→ ${view.players.find((p) => p.id === intent.targetId)?.name ?? "?"}`
          : "";
      const icon = { attack: "⚔", defend: "◆", buff: "▲", debuff: "▼", hidden: "?" }[intent.kind];
      const color = intent.kind === "attack" ? C.red : intent.kind === "hidden" ? C.muted : C.blue;
      this.text(x, y - 130, `${icon} ${intent.label} ${target}`, 17, color).setOrigin(0.5);
    }
  }

  private drawHand(view: CombatView): void {
    const me = this.me();
    if (!me) return;
    this.text(
      24,
      HEIGHT - 30,
      `Draw ${me.drawPile.length}  ·  Discard ${me.discardPile.length}`,
      14,
      C.muted,
    );
    const n = me.hand.length;
    const cardW = 132;
    const spacing = Math.min(cardW + 10, 820 / Math.max(1, n));
    const startX = 600 - ((n - 1) * spacing) / 2;
    me.hand.forEach((card, i) => {
      const def = getCard(card.defId);
      const x = startX + i * spacing;
      const selected = this.selectedCard === card.uid;
      const y = selected ? 560 : 590;
      const playable = this.cardBlocker(view, card.uid) === null;
      const container = this.add.container(x, y);
      const bg = this.add
        .rectangle(0, 0, cardW, 184, CARD_COLORS[def.type] ?? C.panel)
        .setStrokeStyle(3, selected ? C.select : playable ? C.goldHex : C.border);
      const mk = (yy: number, s: string, size: number, color = C.ink, wrap?: number) =>
        this.add
          .text(0, yy, s, {
            fontFamily: FONT,
            fontSize: `${size}px`,
            color,
            align: "center",
            wordWrap: wrap ? { width: wrap } : undefined,
          })
          .setOrigin(0.5, 0);
      const cost = def.radianceCost ? `${def.cost}⚡ ${def.radianceCost}✦` : `${def.cost}⚡`;
      container.add([
        bg,
        mk(-84, cost, 14, playable ? C.gold : C.muted),
        mk(-62, def.name, 16, C.ink, cardW - 12),
        mk(-36, def.type, 11, C.muted),
        mk(-14, describeCard(def), 13, C.ink, cardW - 16),
      ]);
      container.setAlpha(playable ? 1 : 0.6);
      bg.setInteractive({ useHandCursor: true })
        .on("pointerdown", () => this.onCardClick(card.uid))
        .on("pointerover", () => container.setScale(1.08).setDepth(5))
        .on("pointerout", () => container.setScale(1).setDepth(0));
      this.root.add(container);
    });
  }

  private drawEndTurn(view: CombatView): void {
    const me = this.me();
    if (!me || view.phase !== "player") return;
    const active = view.players.filter((p) => !p.downed);
    const readyCount = active.filter((p) => p.ready).length;
    const label = me.downed
      ? "Downed"
      : me.ready
        ? `Waiting ${readyCount}/${active.length}\n(click to undo)`
        : "End Turn [E]";
    const btn = this.rect(1170, 640, 190, 70, me.ready ? C.panel2 : 0x6b4f1d, C.goldHex);
    btn.setInteractive({ useHandCursor: true }).on("pointerdown", () => this.endTurn());
    this.text(1170, 640, label, 17, C.ink).setOrigin(0.5);
  }

  private drawResult(view: CombatView): void {
    const shade = this.add.rectangle(WIDTH / 2, HEIGHT / 2, WIDTH, HEIGHT, 0x000000, 0.6);
    shade.setInteractive();
    this.root.add(shade);
    const won = view.phase === "victory";
    this.text(WIDTH / 2, 280, won ? "VICTORY" : "DEFEAT", 56, won ? C.gold : C.red).setOrigin(0.5);
    if (this.session.isHost) {
      const btn = this.rect(WIDTH / 2, 400, 240, 60, 0x6b4f1d, C.goldHex);
      btn.setInteractive({ useHandCursor: true }).on("pointerdown", () => this.session.startGame());
      this.text(WIDTH / 2, 400, "Next fight", 20).setOrigin(0.5);
    } else {
      this.text(WIDTH / 2, 400, "Waiting for the host…", 18, C.muted).setOrigin(0.5);
    }
  }

  // -------------------------------------------------------------------------
  // Input → Commands
  // -------------------------------------------------------------------------

  private selectedDef() {
    const card = this.me()?.hand.find((c) => c.uid === this.selectedCard);
    return card ? getCard(card.defId) : undefined;
  }

  /** Why the card can't be played, ignoring which target will be chosen. */
  private cardBlocker(view: CombatView, uid: number): string | null {
    const me = this.me();
    const card = me?.hand.find((c) => c.uid === uid);
    if (!me || !card) return "Unknown card.";
    const def = getCard(card.defId);
    const anyTarget =
      def.targeting === "enemy"
        ? view.enemies.find((e) => e.hp > 0)?.id
        : def.targeting === "ally"
          ? me.id
          : undefined;
    return canPlayCard(view, me.id, uid, anyTarget);
  }

  private onCardClick(uid: number): void {
    if (!this.view) return;
    if (this.selectedCard === uid) {
      this.select(null);
      return;
    }
    const blocker = this.cardBlocker(this.view, uid);
    if (blocker) {
      toast(blocker);
      return;
    }
    const card = this.me()?.hand.find((c) => c.uid === uid);
    if (!card) return;
    if (getCard(card.defId).targeting === "none") {
      this.session.command({ type: "playCard", cardUid: uid });
      this.select(null);
      return;
    }
    this.select(uid);
  }

  private playSelected(targetId: string): void {
    if (this.selectedCard === null) return;
    this.session.command({ type: "playCard", cardUid: this.selectedCard, targetId });
    this.select(null);
  }

  private select(uid: number | null): void {
    this.selectedCard = uid;
    this.redraw();
  }

  private endTurn(): void {
    const me = this.me();
    if (!me || me.downed || this.view?.phase !== "player") return;
    this.session.command({ type: me.ready ? "cancelEndTurn" : "endTurn" });
  }

  // -------------------------------------------------------------------------
  // Feedback (placeholder juice — replace with an event-driven animation queue)
  // -------------------------------------------------------------------------

  private playEvents(events: CombatEvent[]): void {
    let delay = 0;
    for (const ev of events) {
      if (ev.type === "damage" || ev.type === "block" || ev.type === "heal") {
        const pos = this.positions.get(ev.targetId);
        if (!pos) continue;
        const [label, color] =
          ev.type === "damage"
            ? [ev.amount > 0 ? `-${ev.amount}` : `blocked ${ev.blocked}`, C.red]
            : ev.type === "block"
              ? [`+${ev.amount} ◆`, C.blue]
              : [`+${ev.amount}`, "#9be3a5"];
        const t = this.add
          .text(pos.x, pos.y - 20, label, { fontFamily: FONT, fontSize: "26px", color })
          .setOrigin(0.5)
          .setDepth(20)
          .setAlpha(0);
        this.tweens.add({
          targets: t,
          y: pos.y - 70,
          alpha: { from: 1, to: 0 },
          delay,
          duration: 900,
          onComplete: () => t.destroy(),
        });
        delay += 90;
      }
    }
  }
}
