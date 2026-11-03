/**
 * Paginated, illustrated guide: squad & ranks, turn order & skills, light & darkness,
 * builds & loot, co-op. Left/Right (or the buttons) change page, Esc goes back.
 */
import * as Phaser from "phaser";
import { SCENES } from "../app/scenes";
import { enemyTexture, iconTexture, mercTexture, TEX } from "../app/textures";
import { hexNum, RAMPS, RARITY_COLORS } from "../art/palette";
import type { Rarity } from "../ui/artAdapter";
import { Button } from "../ui/Button";
import { isTypingInDom } from "../ui/focus";
import { createPanel } from "../ui/Panel";
import { addBackdrop, addHeader } from "../ui/screen";
import { COLOR_NUM, COLORS, DURATION, GAME_H, GAME_W, playUiSound, TEXT } from "../ui/theme";
import { leaveSubScreen, type SubScreenData } from "./SettingsScene";

type C = Phaser.GameObjects.Container;

interface Page {
  title: string;
  tagline: string;
  bullets: string[];
  draw(scene: HowToPlayScene, c: C, w: number, h: number): void;
}

const BANNER_W = 1104;
const BANNER_H = 288;
const SPRITE_SCALE = 2;

const P1 = RAMPS.lamp[3];
const P2 = RAMPS.crystal[4];

const PAGES: Page[] = [
  {
    title: "Your Squad & Ranks",
    tagline: "Four mercenaries, one narrow tunnel.",
    bullets: [
      "You field a squad of 4 mercs standing in ranks: rank 1 is the front line, rank 4 the back.",
      "Enemies line up the same way, facing you: their rank 1 is closest to your blades.",
      "Every skill lists the ranks it can be used FROM and the enemy ranks it can HIT.",
      "Order matters: brawlers up front, gunners and lamp-tenders in the back. Some skills shuffle positions.",
    ],
    draw(scene, c, w, h) {
      const mid = w / 2;
      const y = h / 2 + 20;
      const step = 112;
      label(scene, c, mid - 2.5 * step, 40, "YOUR SQUAD", COLORS.accent);
      label(scene, c, mid + 2.5 * step, 40, "ENEMIES", COLORS.danger);
      for (let r = 1; r <= 4; r++) {
        const mx = mid - 48 - (r - 1) * step - 32;
        const ex = mid + 48 + (r - 1) * step + 32;
        sprite(scene, c, mx, y, mercTexture(scene, r - 1), false);
        sprite(scene, c, ex, y, enemyTexture(scene, r - 1), true);
        rankBadge(scene, c, mx, y + 72, r, COLORS.accent);
        rankBadge(scene, c, ex, y + 72, r, COLORS.danger);
      }
      // front line marker
      const g = scene.add.graphics();
      g.fillStyle(hexNum(RAMPS.lamp[2]), 0.6);
      for (let yy = 64; yy < h - 40; yy += 12) g.fillRect(mid - 1, yy, 3, 6);
      c.add(g);
      c.add(
        scene.add
          .text(mid, h - 28, "FRONT", { ...TEXT.tiny, color: COLORS.accent, letterSpacing: 2 })
          .setOrigin(0.5),
      );
    },
  },
  {
    title: "Turn Order & Skills",
    tagline: "The quick act first. The slow act last — if they act at all.",
    bullets: [
      "Each round, everyone acts in order of Speed. The bar at the top shows who is next.",
      "On your turn, pick a skill, then a highlighted target.",
      "Pips show ranks: left pips = where the user must stand, right pips = which enemy ranks it hits.",
      "Strong skills have cooldowns: after use they rest for a few turns. Plan your rotation.",
    ],
    draw(scene, c, w) {
      // Speed timeline.
      const order: Array<[string, number, boolean]> = [
        ["Vex", 9, false],
        ["Husk", 8, true],
        ["Orla", 7, false],
        ["Brann", 5, false],
        ["Grub", 4, true],
        ["Ceto", 3, false],
      ];
      label(scene, c, w / 2, 32, "TURN ORDER  (FASTEST FIRST)", COLORS.textDim);
      const chipW = 144;
      const gap = 16;
      const x0 = (w - (order.length * chipW + (order.length - 1) * gap)) / 2;
      order.forEach(([name, spd, enemy], i) => {
        const x = x0 + i * (chipW + gap);
        const chip = createPanel(scene, x, 56, chipW, 54, {
          variant: i === 0 ? "highlight" : "inset",
          originX: 0,
          originY: 0,
        });
        c.add(chip);
        c.add(
          scene.add
            .text(x + 16, 83, name, {
              ...TEXT.body,
              fontSize: "18px",
              color: enemy ? COLORS.danger : COLORS.text,
            })
            .setOrigin(0, 0.5),
        );
        c.add(
          scene.add
            .text(x + chipW - 14, 83, `${spd}`, { ...TEXT.number, fontSize: "18px" })
            .setOrigin(1, 0.5),
        );
        if (i < order.length - 1) {
          c.add(
            scene.add
              .image(x + chipW + gap / 2, 83, TEX.arrow)
              .setScale(2)
              .setTint(COLOR_NUM.line),
          );
        }
      });

      // Skill card mock.
      const cw = 560;
      const cx = (w - cw) / 2;
      const cy = 136;
      c.add(createPanel(scene, cx, cy, cw, 126, { originX: 0, originY: 0 }));
      c.add(scene.add.text(cx + 24, cy + 20, "Lantern Bash", TEXT.subheading));
      c.add(
        scene.add.text(cx + 24, cy + 50, "Heavy blow. Lights the target.", {
          ...TEXT.small,
          color: COLORS.textDim,
        }),
      );
      pips(scene, c, cx + 24, cy + 92, [true, true, false, false], COLORS.accent, "USE");
      pips(scene, c, cx + 200, cy + 92, [true, true, false, false], COLORS.danger, "HIT");
      const cdx = cx + cw - 140;
      c.add(scene.add.image(cdx, cy + 92, iconTexture(scene, "ui_cooldown")).setScale(2));
      c.add(
        scene.add
          .text(cdx + 24, cy + 92, "2 turns", { ...TEXT.small, color: COLORS.info })
          .setOrigin(0, 0.5),
      );
    },
  },
  {
    title: "Light & Darkness",
    tagline: "Your lamp is your lifeline. Guard its charge.",
    bullets: [
      "The lamp's charge drains as you push deeper. Brighter light means a wider radius.",
      "Light reaches only the first few enemy ranks. Unlit enemies are harder to hit, can't be crit, and hide their health.",
      "Umbral creatures grow stronger in darkness — keep them in the light.",
      "Flare and Radiant skills light up their targets, exposing them to the whole squad.",
    ],
    draw(scene, c, w, h) {
      const y = h / 2 + 30;
      const step = 104;
      // light pool from the squad's lamp, reaching enemy ranks 1-2
      const pool = scene.add
        .image(w / 2 - 40, y, TEX.glow)
        .setDisplaySize(820, 300)
        .setTint(COLOR_NUM.accent)
        .setBlendMode(Phaser.BlendModes.ADD)
        .setAlpha(0.35);
      c.add(pool);
      scene.tweens.add({
        targets: pool,
        alpha: 0.28,
        duration: 220,
        yoyo: true,
        repeat: -1,
        repeatDelay: 900,
      });
      for (let r = 1; r <= 2; r++) {
        sprite(scene, c, w / 2 - 80 - (r - 1) * step, y, mercTexture(scene, r - 1), false);
      }
      c.add(scene.add.image(w / 2 - 36, y - 6, iconTexture(scene, "ui_lamp")).setScale(2));
      for (let r = 1; r <= 4; r++) {
        const x = w / 2 + 60 + (r - 1) * step;
        const lit = r <= 2;
        const s = sprite(scene, c, x, y, enemyTexture(scene, r - 1), true);
        if (!lit) s.setTint(hexNum(RAMPS.void[3]));
        healthBar(scene, c, x, y - 64, lit ? 0.7 - r * 0.15 : null);
      }
      // radius bracket
      const bx0 = w / 2 + 60 - 44;
      const bx1 = w / 2 + 60 + step + 44;
      const g = scene.add.graphics();
      g.fillStyle(hexNum(RAMPS.lamp[3]), 1);
      g.fillRect(bx0, h - 44, bx1 - bx0, 3);
      g.fillRect(bx0, h - 52, 3, 11);
      g.fillRect(bx1 - 3, h - 52, 3, 11);
      c.add(g);
      c.add(
        scene.add
          .text((bx0 + bx1) / 2, h - 26, "LIGHT RADIUS 2", {
            ...TEXT.tiny,
            color: COLORS.accent,
            letterSpacing: 2,
          })
          .setOrigin(0.5),
      );
      c.add(
        scene.add
          .text(w / 2 + 60 + 2.5 * step, h - 26, "IN THE DARK", {
            ...TEXT.tiny,
            color: COLORS.umbra,
            letterSpacing: 2,
          })
          .setOrigin(0.5),
      );
      // lamp charge meter
      lampMeter(scene, c, 32, 32, 0.62);
    },
  },
  {
    title: "Builds & Loot",
    tagline: "Every merc is a project. Every relic is a temptation.",
    bullets: [
      "Each merc has a discipline (their role) and an origin (their past), which shape their skills and stats.",
      "Level up after expeditions and choose a perk to specialize.",
      "Loot comes in rarities from Common to Relic, with random affixes on top of its base stats.",
      "Five equipment slots: weapon, armor, lamp and two trinkets.",
    ],
    draw(scene, c, w) {
      const slots: Array<[string, Rarity, string]> = [
        ["Weapon", "rare", "item_weapon_vanguard"],
        ["Armor", "uncommon", "item_armor_medium"],
        ["Lamp", "relic", "item_lamp_oil"],
        ["Trinket", "epic", "item_trinket_shard"],
        ["Trinket", "common", "item_trinket_ring"],
      ];
      const step = 120;
      const x0 = 64;
      label(scene, c, x0 + 2 * step + 30, 30, "EQUIPMENT", COLORS.textDim);
      slots.forEach(([name, rarity, icon], i) => {
        const x = x0 + 30 + i * step;
        c.add(scene.add.image(x, 112, TEX.slot(rarity)).setScale(3));
        c.add(scene.add.image(x, 112, iconTexture(scene, icon)).setScale(3));
        c.add(
          scene.add.text(x, 160, name, { ...TEXT.small, color: COLORS.textDim }).setOrigin(0.5),
        );
      });
      // rarity ladder
      const rar = Object.entries(RARITY_COLORS) as Array<[Rarity, string]>;
      label(scene, c, x0 + 2 * step + 30, 206, "RARITY", COLORS.textDim);
      rar.forEach(([r, color], i) => {
        c.add(
          scene.add
            .text(x0 + 30 + i * step, 240, r[0]?.toUpperCase() + r.slice(1), {
              ...TEXT.small,
              fontStyle: "600",
              color,
            })
            .setOrigin(0.5),
        );
      });
      // mock item tooltip
      const tx = w - 400;
      c.add(createPanel(scene, tx, 36, 360, 216, { originX: 0, originY: 0 }));
      c.add(
        scene.add.text(tx + 20, 54, "Ember Lantern", {
          ...TEXT.subheading,
          color: RARITY_COLORS.relic,
        }),
      );
      c.add(scene.add.text(tx + 20, 82, "Lamp · Relic", { ...TEXT.small }));
      c.add(scene.add.rectangle(tx + 20, 110, 320, 3, 0x34305a).setOrigin(0));
      const lines: Array<[string, string]> = [
        ["+1 Light radius", COLORS.text],
        ["Lamp drains 15% slower", COLORS.text],
        ["Flare skills burn for 2", COLORS.accent],
        ["“It never quite goes out.”", COLORS.textMuted],
      ];
      lines.forEach(([t, col], i) => {
        c.add(
          scene.add.text(tx + 20, 124 + i * 28, t, { ...TEXT.body, fontSize: "18px", color: col }),
        );
      });
    },
  },
  {
    title: "Co-op",
    tagline: "Split the squad. Share the spoils. Argue about the route.",
    bullets: [
      "Up to 4 players share one squad; each player commands their own mercs in battle.",
      "Between fights, everyone votes on the route. Majority decides; ties go to the host.",
      "Loot goes into a shared stash. Divide it fairly — or don't.",
      "Host a room and share the 4-letter code, or join a friend's room from the title screen.",
    ],
    draw(scene, c, w, h) {
      const y = h / 2 + 24;
      const step = 100;
      for (let i = 0; i < 4; i++) {
        const x = 96 + i * step;
        sprite(scene, c, x, y, mercTexture(scene, 3 - i), false);
        const color = i < 2 ? P2 : P1;
        const badge = scene.add.graphics();
        badge.fillStyle(COLOR_NUM.ink, 1);
        badge.fillRect(x - 30, y - 84, 60, 26);
        badge.fillStyle(hexNum(color), 1);
        badge.fillRect(x - 27, y - 81, 54, 20);
        c.add(badge);
        c.add(
          scene.add
            .text(x, y - 72, i < 2 ? "P2" : "P1", {
              ...TEXT.small,
              fontStyle: "700",
              color: COLORS.ink,
              shadow: undefined,
            })
            .setOrigin(0.5),
        );
      }
      // route vote map
      const mx = w - 520;
      label(scene, c, mx + 220, 36, "ROUTE VOTE", COLORS.textDim);
      const nodes: Array<[number, number]> = [
        [mx + 40, 150],
        [mx + 220, 90],
        [mx + 220, 210],
        [mx + 400, 150],
      ];
      const g = scene.add.graphics();
      g.lineStyle(3, hexNum(RAMPS.steel[2]), 1);
      const links: Array<[number, number]> = [
        [0, 1],
        [0, 2],
        [1, 3],
        [2, 3],
      ];
      for (const [a, b] of links) {
        const na = nodes[a];
        const nb = nodes[b];
        if (na && nb) g.lineBetween(na[0], na[1], nb[0], nb[1]);
      }
      c.add(g);
      nodes.forEach(([nx, ny], i) => {
        c.add(scene.add.image(nx, ny, TEX.slot(i === 0 ? "relic" : undefined)).setScale(3));
        const icon = ["node_start", "node_cache", "node_elite", "node_boss"][i] ?? "node_combat";
        c.add(scene.add.image(nx, ny, iconTexture(scene, icon)).setScale(2));
      });
      // votes
      const vote = (nx: number, ny: number, color: string, k: number) => {
        const d = scene.add.graphics();
        d.fillStyle(COLOR_NUM.ink, 1);
        d.fillRect(nx + 26 + k * 18, ny - 34, 15, 15);
        d.fillStyle(hexNum(color), 1);
        d.fillRect(nx + 29 + k * 18, ny - 31, 9, 9);
        c.add(d);
      };
      const n1 = nodes[1];
      const n2 = nodes[2];
      if (n1 && n2) {
        vote(n1[0], n1[1], P1, 0);
        vote(n1[0], n1[1], P2, 1);
        vote(n2[0], n2[1], RAMPS.toxic[4], 0);
      }
      c.add(scene.add.image(mx + 400, 236, iconTexture(scene, "item_trinket_coin")).setScale(3));
      c.add(
        scene.add
          .text(mx + 400, 272, "SHARED STASH", {
            ...TEXT.tiny,
            color: COLORS.info,
            letterSpacing: 2,
          })
          .setOrigin(0.5),
      );
    },
  },
];

function label(scene: Phaser.Scene, c: C, x: number, y: number, text: string, color: string) {
  c.add(
    scene.add
      .text(x, y, text, { ...TEXT.tiny, fontStyle: "700", color, letterSpacing: 3 })
      .setOrigin(0.5),
  );
}

function sprite(
  scene: Phaser.Scene,
  c: C,
  x: number,
  y: number,
  key: string,
  enemy: boolean,
): Phaser.GameObjects.Image {
  // Merc art faces right and enemy art faces left already; `enemy` only affects idle timing.
  const img = scene.add.image(x, y, key).setScale(SPRITE_SCALE);
  c.add(img);
  scene.tweens.add({
    targets: img,
    y: y - 2,
    duration: (enemy ? 1100 : 900) + Math.random() * 300,
    yoyo: true,
    repeat: -1,
    ease: "Stepped",
    easeParams: [2],
  });
  return img;
}

function rankBadge(scene: Phaser.Scene, c: C, x: number, y: number, r: number, color: string) {
  c.add(createPanel(scene, x, y, 42, 36, { variant: "inset" }));
  c.add(scene.add.text(x, y - 1, `${r}`, { ...TEXT.number, color }).setOrigin(0.5));
}

function pips(
  scene: Phaser.Scene,
  c: C,
  x: number,
  y: number,
  on: boolean[],
  color: string,
  text: string,
) {
  c.add(scene.add.text(x, y, text, { ...TEXT.tiny, fontStyle: "700", color }).setOrigin(0, 0.5));
  const g = scene.add.graphics();
  on.forEach((v, i) => {
    const px = x + 40 + i * 22;
    g.fillStyle(COLOR_NUM.ink, 1);
    g.fillRect(px, y - 9, 18, 18);
    g.fillStyle(v ? hexNum(color) : hexNum(RAMPS.void[3]), 1);
    g.fillRect(px + 3, y - 6, 12, 12);
  });
  c.add(g);
}

function healthBar(scene: Phaser.Scene, c: C, x: number, y: number, frac: number | null) {
  const w = 72;
  const g = scene.add.graphics();
  g.fillStyle(COLOR_NUM.ink, 1);
  g.fillRect(x - w / 2 - 3, y - 6, w + 6, 12);
  g.fillStyle(hexNum(RAMPS.void[2]), 1);
  g.fillRect(x - w / 2, y - 3, w, 6);
  if (frac !== null) {
    g.fillStyle(hexNum(RAMPS.rust[3]), 1);
    g.fillRect(x - w / 2, y - 3, Math.round(w * frac), 6);
  }
  c.add(g);
  if (frac === null) {
    c.add(
      scene.add
        .text(x, y - 20, "???", { ...TEXT.tiny, fontStyle: "700", color: COLORS.umbra })
        .setOrigin(0.5),
    );
  }
}

function lampMeter(scene: Phaser.Scene, c: C, x: number, y: number, frac: number) {
  c.add(scene.add.image(x + 16, y + 12, iconTexture(scene, "ui_lamp")).setScale(2));
  c.add(
    scene.add
      .text(x + 40, y + 12, "LAMP", { ...TEXT.tiny, fontStyle: "700", color: COLORS.accent })
      .setOrigin(0, 0.5),
  );
  const g = scene.add.graphics();
  const bx = x + 88;
  const cells = 10;
  g.fillStyle(COLOR_NUM.ink, 1);
  g.fillRect(bx - 3, y + 3, cells * 15 + 3, 18);
  for (let i = 0; i < cells; i++) {
    const on = i < Math.round(frac * cells);
    g.fillStyle(on ? hexNum(RAMPS.lamp[i < 3 ? 2 : 3]) : hexNum(RAMPS.void[2]), 1);
    g.fillRect(bx + i * 15, y + 6, 12, 12);
  }
  c.add(g);
  c.add(
    scene.add
      .text(bx + cells * 15 + 12, y + 12, `${Math.round(frac * 100)}%`, {
        ...TEXT.number,
        fontSize: "16px",
      })
      .setOrigin(0, 0.5),
  );
}

export class HowToPlayScene extends Phaser.Scene {
  private page = 0;
  private data_: SubScreenData = {};
  private content: C | null = null;
  private dots!: Phaser.GameObjects.Graphics;
  private prevBtn!: Button;
  private nextBtn!: Button;
  private pageLabel!: Phaser.GameObjects.Text;

  constructor() {
    super({ key: SCENES.howToPlay });
  }

  init(data: SubScreenData & { page?: number }): void {
    this.data_ = data ?? {};
    this.page = Phaser.Math.Clamp(Math.floor(data?.page ?? 0), 0, PAGES.length - 1) || 0;
    this.content = null;
  }

  create(): void {
    if (this.data_.overlay) {
      this.add.rectangle(0, 0, GAME_W, GAME_H, COLOR_NUM.ink, 0.88).setOrigin(0).setInteractive();
    } else {
      this.cameras.main.setBackgroundColor(COLORS.bg);
      addBackdrop(this, { dim: 0.6, embers: false });
    }
    addHeader(this, "How to Play", "A field guide for new mercenaries");

    const footY = GAME_H - 56;
    new Button(this, 64 + 96, footY, {
      label: "Back",
      width: 192,
      onClick: () => this.back(),
    });
    this.prevBtn = new Button(this, GAME_W - 64 - 96 - 208, footY, {
      label: "Previous",
      width: 192,
      onClick: () => this.go(-1),
    });
    this.nextBtn = new Button(this, GAME_W - 64 - 96, footY, {
      label: "Next",
      kind: "primary",
      width: 192,
      onClick: () => this.go(1),
    });
    this.dots = this.add.graphics();
    this.pageLabel = this.add.text(GAME_W / 2, footY + 18, "", { ...TEXT.tiny }).setOrigin(0.5);

    this.input.keyboard?.on("keydown", (e: KeyboardEvent) => {
      if (isTypingInDom()) return;
      if (e.code === "ArrowRight" || e.code === "KeyD") this.go(1);
      else if (e.code === "ArrowLeft" || e.code === "KeyA") this.go(-1);
      else if (e.code === "Escape" || e.code === "Backspace") this.back();
      else if ((e.code === "Enter" || e.code === "Space") && !e.repeat) {
        if (this.page === PAGES.length - 1) this.back();
        else this.go(1);
      }
    });
    this.showPage(0);
  }

  private go(dir: -1 | 1): void {
    const next = this.page + dir;
    if (next < 0 || next >= PAGES.length) {
      if (next >= PAGES.length) this.back();
      return;
    }
    playUiSound("click");
    this.page = next;
    this.showPage(dir);
  }

  private showPage(dir: number): void {
    const page = PAGES[this.page];
    if (!page) return;
    const old = this.content;
    if (old) {
      this.tweens.add({
        targets: old,
        alpha: 0,
        x: -dir * 24,
        duration: DURATION.normal,
        onComplete: () => old.destroy(),
      });
    }
    const c = this.add.container(dir * 24, 0).setAlpha(0);
    this.content = c;

    // Illustration banner.
    const bx = (GAME_W - BANNER_W) / 2;
    const by = 104;
    c.add(
      createPanel(this, bx, by, BANNER_W, BANNER_H, { variant: "inset", originX: 0, originY: 0 }),
    );
    const art = this.add.container(bx, by);
    c.add(art);
    page.draw(this, art, BANNER_W, BANNER_H);

    // Title + tagline.
    const ty = by + BANNER_H + 28;
    c.add(this.add.text(bx + 8, ty, page.title, TEXT.heading).setOrigin(0, 0.5));
    c.add(
      this.add
        .text(GAME_W - bx - 8, ty + 2, page.tagline, { ...TEXT.small, color: COLORS.textDim })
        .setOrigin(1, 0.5),
    );
    c.add(this.add.rectangle(bx + 8, ty + 24, BANNER_W - 16, 3, 0x231f3d).setOrigin(0, 0));

    // Bullets in two columns.
    const colW = (BANNER_W - 48) / 2;
    const half = Math.ceil(page.bullets.length / 2);
    page.bullets.forEach((b, i) => {
      const col = i < half ? 0 : 1;
      const row = col === 0 ? i : i - half;
      const x = bx + 8 + col * (colW + 32);
      const y = ty + 44 + row * 76;
      const mark = this.add.rectangle(x + 4, y + 11, 9, 9, COLOR_NUM.accent).setOrigin(0, 0);
      const t = this.add.text(x + 24, y, b, {
        ...TEXT.body,
        fontSize: "18px",
        lineSpacing: 6,
        wordWrap: { width: colW - 28 },
      });
      c.add([mark, t]);
    });

    this.tweens.add({ targets: c, alpha: 1, x: 0, duration: DURATION.slow, ease: "Quad.out" });
    this.updateFooter();
  }

  private updateFooter(): void {
    const n = PAGES.length;
    this.prevBtn.setEnabled(this.page > 0);
    this.nextBtn.setLabel(this.page === n - 1 ? "Done" : "Next");
    const g = this.dots;
    g.clear();
    const size = 12;
    const gap = 12;
    const total = n * size + (n - 1) * gap;
    const x0 = GAME_W / 2 - total / 2;
    const y = GAME_H - 56 - 10;
    for (let i = 0; i < n; i++) {
      g.fillStyle(COLOR_NUM.ink, 1);
      g.fillRect(x0 + i * (size + gap) - 3, y - 3, size + 6, size + 6);
      g.fillStyle(i === this.page ? COLOR_NUM.accent : hexNum(RAMPS.void[3]), 1);
      g.fillRect(x0 + i * (size + gap), y, size, size);
    }
    this.pageLabel.setText(`${this.page + 1} / ${n}`);
  }

  private back(): void {
    leaveSubScreen(this, this.data_);
  }
}
