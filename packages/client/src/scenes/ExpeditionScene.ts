import {
  computeStats,
  darknessLevel,
  describeItem,
  getDiscipline,
  getItemBase,
  MAP_ROWS,
  type MapNode,
  REFUEL_AMOUNT,
  REFUEL_COST,
  type RunView,
} from "@radiance/core";
import * as Phaser from "phaser";
import { hexNum, RAMPS, RARITY_COLORS } from "../art/palette";
import { audio } from "../audio";
import { SCENES } from "../app/scenes";
import { iconTexture, mapBackdropTexture } from "../app/textures";
import { goTo } from "../app/transitions";
import { globals, sceneForPhase } from "../game/globals";
import { unitPortrait } from "../game/unitArt";
import type { GameSession, SessionEvent } from "../net/session";
import { Button } from "../ui/Button";
import { attachTooltip } from "../ui/Tooltip";
import { toast } from "../ui/Toast";
import { COLOR_NUM, COLORS, FONT_FAMILY, GAME_H, GAME_W, TEXT } from "../ui/theme";

const NODE_NAMES: Record<string, string> = {
  start: "Landing Site",
  combat: "Hostiles",
  elite: "Elite Threat",
  boss: "The Lumen Eater",
  cache: "Supply Cache",
  vein: "Mineral Vein",
  camp: "Camp",
  derelict: "Derelict",
};
const NODE_DESC: Record<string, string> = {
  combat: "A fight. XP, ore and a chance of loot.",
  elite: "A dangerous fight. Guaranteed rare+ loot.",
  boss: "The beast that devours the light. Kill it to complete the expedition.",
  cache: "Sealed old-world supplies: two items and some ore.",
  vein: "Rich ore — but mining in the dark burns lamp oil.",
  camp: "Rest: everyone heals 40%, downed mercs get up, +20 lamp.",
  derelict: "A wreck. Treasure, a trap, or an ambush.",
  start: "Where the dropship left you.",
};
const BIOME_NAMES: Record<string, string> = {
  ashenSurface: "Ashen Surface",
  duskMines: "Dusk Mines",
  crystalHollows: "Crystal Hollows",
};

const MAP_X0 = 470;
const MAP_W = 520;
const MAP_Y0 = 70;
const ROW_H = 68;

/** The expedition route map, squad overview and reward screens. */
export class ExpeditionScene extends Phaser.Scene {
  private session!: GameSession;
  private view: RunView | null = null;
  private layer!: Phaser.GameObjects.Container;
  private overlay!: Phaser.GameObjects.Container;
  private unsubscribe: (() => void) | null = null;
  private leaving = false;

  constructor() {
    super({ key: SCENES.expedition });
  }

  init(): void {
    this.session = globals.session as GameSession;
    this.leaving = false;
  }

  create(): void {
    const bg = this.add.image(GAME_W / 2, GAME_H / 2, mapBackdropTexture(this, 7)).setScale(4);
    this.tweens.add({ targets: bg, x: GAME_W / 2 - 10, duration: 14000, yoyo: true, repeat: -1, ease: "Sine.inOut" });
    this.add.rectangle(0, 0, GAME_W, GAME_H, 0x05040a, 0.45).setOrigin(0);
    this.layer = this.add.container(0, 0);
    this.overlay = this.add.container(0, 0).setDepth(500);
    this.view = this.session.currentView;
    audio.setMusic("map");
    this.render();
    this.unsubscribe = this.session.subscribe((e) => this.onSession(e));
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.unsubscribe?.());
    this.input.keyboard?.on("keydown-ESC", () => globals.openPause?.(this));
    this.input.keyboard?.on("keydown-C", () => globals.openCharacter?.(this));
    this.events.on(Phaser.Scenes.Events.RESUME, () => this.render());
  }

  private onSession(e: SessionEvent): void {
    if (e.type === "state") {
      const prevPhase = this.view?.phase;
      this.view = e.view;
      for (const ev of e.events) {
        if (ev.type === "levelUp") audio.play("levelUp");
        if (ev.type === "loot") audio.play("lootCommon");
        if (ev.type === "vote") audio.play("mapStep");
      }
      if (prevPhase !== e.view.phase && e.view.phase === "reward") audio.play("ore");
      this.render();
    } else if (e.type === "error") {
      toast(this, e.message, "error");
      audio.play("uiError");
    } else if (e.type === "status" && e.text) {
      toast(this, e.text);
    }
  }

  private render(): void {
    const view = this.view;
    if (!view) return;
    const target = sceneForPhase(view.phase);
    if (target !== "expedition") {
      if (!this.leaving) {
        this.leaving = true;
        goTo(this, target === "combat" ? SCENES.combat : SCENES.summary);
      }
      return;
    }
    this.layer.removeAll(true);
    this.overlay.removeAll(true);
    this.drawTopBar(view);
    this.drawMap(view);
    this.drawSquad(view);
    if (view.phase === "reward" && view.reward) this.drawReward(view);
  }

  // -------------------------------------------------------------------------

  private drawTopBar(view: RunView): void {
    const node = view.nodes.find((n) => n.id === view.currentNodeId);
    const biome = BIOME_NAMES[node?.biome ?? ""] ?? "";
    this.layer.add(
      this.add.text(GAME_W / 2 + 40, 18, `${biome.toUpperCase()} · DEPTH ${node?.row ?? 0}/${MAP_ROWS - 1}`, {
        ...TEXT.small,
        color: COLORS.textDim,
      }).setOrigin(0.5, 0),
    );
    // Lamp charge
    const x = GAME_W - 300;
    const lampIcon = this.add.image(x, 30, iconTexture(this, "ui_lamp")).setScale(2);
    const barBg = this.add.rectangle(x + 20, 30, 150, 14, 0x05040a).setOrigin(0, 0.5).setStrokeStyle(2, 0x34305a);
    const bar = this.add.rectangle(x + 22, 30, (146 * view.lampCharge) / 100, 10, hexNum(RAMPS.lamp[3])).setOrigin(0, 0.5);
    const dark = ["Bright", "Dim", "Dark", "Pitch dark"][darknessLevel(view.lampCharge)];
    const lampText = this.add.text(x + 20, 42, `Lamp ${view.lampCharge}% · ${dark}`, TEXT.tiny);
    attachTooltip(barBg, {
      title: "Lamp charge",
      titleColor: COLORS.accentBright,
      lines: [
        "Drains as you push deeper. A dimmer lamp lights fewer enemy ranks.",
        "Darkness makes umbral enemies stronger — but loot gets better.",
        `Refuel at camps, with Beacon, or here for ${REFUEL_COST} ore.`,
      ],
    });
    const ore = this.add.image(x + 200, 30, iconTexture(this, "ui_ore")).setScale(2);
    const oreText = this.add.text(x + 220, 20, String(view.ore), TEXT.number);
    this.layer.add([lampIcon, barBg, bar, lampText, ore, oreText]);
    const refuel = new Button(this, x + 70, 78, {
      label: `Refuel +${REFUEL_AMOUNT} (${REFUEL_COST} ore)`,
      width: 260,
      height: 36,
      kind: "secondary",
      disabled: view.ore < REFUEL_COST || view.lampCharge >= 100,
      onClick: () => this.session.command({ type: "refuel" }),
    });
    this.layer.add(refuel);
  }

  private nodePos(n: MapNode): { x: number; y: number } {
    return { x: MAP_X0 + n.x * MAP_W, y: MAP_Y0 + n.row * ROW_H };
  }

  private drawMap(view: RunView): void {
    const g = this.add.graphics();
    this.layer.add(g);
    // Biome bands
    for (const [rows, name, color] of [
      [[0, 2], "Ashen Surface", RAMPS.bone[1]],
      [[3, 5], "Dusk Mines", RAMPS.lamp[0]],
      [[6, 8], "Crystal Hollows", RAMPS.crystal[0]],
    ] as const) {
      const y0 = MAP_Y0 + rows[0] * ROW_H - ROW_H / 2;
      g.fillStyle(hexNum(color), 0.18);
      g.fillRect(MAP_X0 - 30, y0, MAP_W + 60, (rows[1] - rows[0] + 1) * ROW_H);
      this.layer.add(this.add.text(MAP_X0 - 24, y0 + 6, name.toUpperCase(), { ...TEXT.tiny, color: COLORS.textMuted }));
    }
    const visited = new Set(view.visited);
    const available = new Set(view.available);
    for (const n of view.nodes) {
      const a = this.nodePos(n);
      for (const nextId of n.next) {
        const m = view.nodes.find((x) => x.id === nextId);
        if (!m) continue;
        const b = this.nodePos(m);
        const travelled = visited.has(n.id) && visited.has(m.id);
        const open = n.id === view.currentNodeId && available.has(m.id);
        g.lineStyle(travelled ? 4 : open ? 3 : 2, travelled ? hexNum(RAMPS.lamp[3]) : open ? hexNum(RAMPS.lamp[2]) : 0x34305a, travelled || open ? 0.95 : 0.6);
        g.lineBetween(a.x, a.y, b.x, b.y);
      }
    }
    for (const n of view.nodes) {
      const { x, y } = this.nodePos(n);
      const current = n.id === view.currentNodeId;
      const isVisited = visited.has(n.id);
      const open = available.has(n.id) && view.phase === "map";
      const size = n.type === "boss" ? 56 : 40;
      const ring = this.add
        .circle(x, y, size / 2 + 4, current ? hexNum(RAMPS.lamp[2]) : 0x0e0c16)
        .setStrokeStyle(open ? 3 : 2, open ? COLOR_NUM.accentBright : isVisited ? hexNum(RAMPS.lamp[1]) : 0x34305a);
      const icon = this.add.image(x, y, iconTexture(this, `node_${n.type}`)).setScale(n.type === "boss" ? 3 : 2);
      if (!open && !current && !isVisited) icon.setAlpha(0.55);
      this.layer.add([ring, icon]);
      if (open) {
        this.tweens.add({ targets: ring, scale: 1.12, duration: 600, yoyo: true, repeat: -1, ease: "Sine.inOut" });
        ring.setInteractive({ useHandCursor: true }).on("pointerdown", () => {
          audio.play("uiClick");
          this.session.command({ type: "vote", nodeId: n.id });
        });
      }
      attachTooltip(ring, {
        title: NODE_NAMES[n.type] ?? n.type,
        titleColor: n.type === "boss" ? COLORS.relic : n.type === "elite" ? COLORS.epic : COLORS.accentBright,
        subtitle: `${BIOME_NAMES[n.biome]} · Depth ${n.row}`,
        lines: [NODE_DESC[n.type] ?? "", ...(open ? [{ text: "Click to vote for this route", color: COLORS.accentPale }] : [])],
      });
      // Votes
      const voters = Object.entries(view.votes).filter(([, id]) => id === n.id);
      voters.forEach(([pid], i) => {
        const name = view.players.find((p) => p.id === pid)?.name ?? pid;
        const chip = this.add
          .text(x + size / 2 + 8, y - 12 + i * 18, name, { ...TEXT.tiny, color: pid === view.viewerId ? COLORS.accentBright : COLORS.info })
          .setBackgroundColor("#0e0c16")
          .setPadding(4, 1, 4, 1);
        this.layer.add(chip);
      });
      if (current) {
        const marker = this.add.text(x, y - size / 2 - 8, "▼", { fontFamily: FONT_FAMILY, fontSize: "20px", color: COLORS.accentBright }).setOrigin(0.5, 1);
        this.tweens.add({ targets: marker, y: marker.y - 6, duration: 500, yoyo: true, repeat: -1 });
        this.layer.add(marker);
      }
    }
    if (view.phase === "map") {
      const waiting = view.players.filter((p) => !view.votes[p.id]).map((p) => p.name);
      const msg = view.votes[view.viewerId]
        ? `Waiting for ${waiting.join(", ")} to vote…`
        : "Choose the next stop on the route.";
      this.layer.add(this.add.text(MAP_X0 + MAP_W / 2, GAME_H - 30, msg, { ...TEXT.small, color: COLORS.accentPale }).setOrigin(0.5));
    }
  }

  private drawSquad(view: RunView): void {
    const x = 24;
    let y = 120;
    this.layer.add(this.add.text(x, 80, "SQUAD", { ...TEXT.small, color: COLORS.accent }));
    this.layer.add(this.add.text(x + 80, 82, "[C] character sheet · [Esc] menu", { ...TEXT.tiny, color: COLORS.textMuted }));
    view.mercs.forEach((m, i) => {
      const stats = computeStats(m);
      const mine = m.ownerId === view.viewerId;
      const card = this.add
        .rectangle(x, y, 400, 104, 0x0e0c16, 0.92)
        .setOrigin(0)
        .setStrokeStyle(2, mine ? COLOR_NUM.accent : 0x34305a)
        .setInteractive({ useHandCursor: true });
      card.on("pointerdown", () => globals.openCharacter?.(this, m.id));
      const portrait = this.add.image(x + 48, y + 52, unitPortrait(this, { id: m.id, side: "merc", defId: m.discipline }, view.mercs)).setScale(3);
      const owner = view.players.find((p) => p.id === m.ownerId)?.name ?? "";
      const name = this.add.text(x + 96, y + 10, `${i + 1}. ${m.name}`, TEXT.subheading);
      const sub = this.add.text(x + 96, y + 36, `Lv ${m.level} ${getDiscipline(m.discipline).name}${view.players.length > 1 ? ` · ${owner}` : ""}`, TEXT.small);
      const hpBg = this.add.rectangle(x + 96, y + 74, 200, 10, 0x05040a).setOrigin(0, 0.5).setStrokeStyle(2, 0x231f3d);
      const hp = this.add.rectangle(x + 97, y + 74, (198 * Math.max(0, m.hp)) / stats.maxHp, 6, 0xbd4a2e).setOrigin(0, 0.5);
      const hpText = this.add.text(x + 306, y + 66, `${m.hp}/${stats.maxHp}`, TEXT.tiny);
      this.layer.add([card, portrait, name, sub, hpBg, hp, hpText]);
      const lamp = m.equipment.lamp;
      if (lamp) {
        const li = this.add.image(x + 372, y + 24, iconTexture(this, getItemBase(lamp.baseId).icon)).setScale(2);
        attachTooltip(li, { title: lamp.name, titleColor: RARITY_COLORS[lamp.rarity], lines: describeItem(lamp).lines });
        this.layer.add(li);
      }
      if (mine && m.perkOffers.length) {
        const badge = this.add.text(x + 300, y + 86, "★ LEVEL UP", { ...TEXT.tiny, color: COLORS.accentBright }).setOrigin(0, 0.5);
        this.tweens.add({ targets: badge, alpha: 0.4, duration: 500, yoyo: true, repeat: -1 });
        this.layer.add(badge);
      }
      y += 116;
    });
    const stash = this.add.text(x, y + 4, `Stash: ${view.stash.length} item${view.stash.length === 1 ? "" : "s"} — open a character sheet to equip`, {
      ...TEXT.tiny,
      color: COLORS.textDim,
    });
    this.layer.add(stash);
  }

  private drawReward(view: RunView): void {
    const rw = view.reward;
    if (!rw) return;
    const shade = this.add.rectangle(0, 0, GAME_W, GAME_H, 0x05040a, 0.7).setOrigin(0).setInteractive();
    const w = 640;
    const h = 420;
    const px = GAME_W / 2 - w / 2 + 120;
    const py = GAME_H / 2 - h / 2;
    const panel = this.add.rectangle(px, py, w, h, 0x0e0c16, 0.97).setOrigin(0).setStrokeStyle(3, COLOR_NUM.accent);
    const title = this.add.text(px + w / 2, py + 22, rw.title.toUpperCase(), TEXT.heading).setOrigin(0.5, 0);
    this.overlay.add([shade, panel, title]);
    let y = py + 76;
    const gains: string[] = [];
    if (rw.xp) gains.push(`+${rw.xp} XP`);
    if (rw.ore) gains.push(`+${rw.ore} ore`);
    if (rw.lamp) gains.push(`${rw.lamp > 0 ? "+" : ""}${rw.lamp} lamp`);
    if (gains.length) {
      this.overlay.add(this.add.text(px + w / 2, y, gains.join("   "), { ...TEXT.subheading, color: COLORS.accentBright }).setOrigin(0.5, 0));
      y += 40;
    }
    for (const note of rw.notes) {
      const t = this.add.text(px + 32, y, note, { ...TEXT.small, wordWrap: { width: w - 64 } });
      this.overlay.add(t);
      y += t.height + 8;
    }
    if (rw.items.length) {
      y += 8;
      this.overlay.add(this.add.text(px + 32, y, "LOOT (added to the shared stash)", { ...TEXT.tiny, color: COLORS.textMuted }));
      y += 24;
      rw.items.forEach((item, i) => {
        const ix = px + 32 + i * 196;
        const color = RARITY_COLORS[item.rarity];
        const frame = this.add.rectangle(ix, y, 184, 84, 0x07060b).setOrigin(0).setStrokeStyle(2, hexNum(color));
        const icon = this.add.image(ix + 30, y + 42, iconTexture(this, getItemBase(item.baseId).icon)).setScale(3);
        const name = this.add.text(ix + 58, y + 10, item.name, { fontFamily: FONT_FAMILY, fontSize: "14px", color, wordWrap: { width: 120 } });
        const rarity = this.add.text(ix + 58, y + 62, item.rarity.toUpperCase(), { ...TEXT.tiny, color });
        const d = describeItem(item);
        attachTooltip(frame, {
          title: d.name,
          titleColor: color,
          subtitle: d.subtitle,
          lines: [...d.lines, ...(d.perk ? [{ text: `${d.perk.name}: ${d.perk.desc}`, color: COLORS.relic }] : [])],
        });
        this.overlay.add([frame, icon, name, rarity]);
        if (item.rarity === "relic") audio.play("lootRelic");
        else if (item.rarity === "epic" || item.rarity === "rare") audio.play("lootRare");
      });
    }
    const ready = view.ready.includes(view.viewerId);
    const waiting = view.players.filter((p) => !view.ready.includes(p.id)).map((p) => p.name);
    const btn = new Button(this, px + w / 2, py + h - 44, {
      label: ready ? `Waiting for ${waiting.join(", ")}` : "Continue",
      width: 320,
      kind: "primary",
      disabled: ready,
      onClick: () => this.session.command({ type: "continue" }),
    });
    const sheet = new Button(this, px + 110, py + h - 44, {
      label: "Squad [C]",
      width: 160,
      kind: "secondary",
      onClick: () => globals.openCharacter?.(this),
    });
    this.overlay.add([btn, sheet]);
    this.overlay.setAlpha(0);
    this.tweens.add({ targets: this.overlay, alpha: 1, duration: 200 });
  }
}
