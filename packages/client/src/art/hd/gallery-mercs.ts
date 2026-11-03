/**
 * Dev gallery for HD mercenaries (hd-mercs.html): live RigSprites cycling through their
 * animations, plus baked stills of every discipline × pose and the 192px portraits.
 *
 * Query params: ?freeze=<pose> holds the top row in a pose (screenshots); ?stills=0 skips
 * the stills; ?nogame=1 skips the Phaser canvas.
 */
import * as Phaser from "phaser";
import type { MercLook } from "../mercs";
import { buildMercRig, mercPortraitHD } from "./mercRig";
import { bakeRig, HD_POSES, type HdPose, RigSprite } from "./rig";

const params = new URLSearchParams(location.search);
const freeze = params.get("freeze") as HdPose | null;

const L = (o: Partial<MercLook> & Pick<MercLook, "discipline">): MercLook => ({
  body: 1,
  skin: 0,
  hair: 1,
  hairColor: 1,
  primary: 0,
  secondary: 1,
  headgear: 0,
  marking: 0,
  armor: "light",
  lamp: "none",
  weaponTier: 0,
  ...o,
});

const LINEUP: MercLook[] = [
  L({
    discipline: "vanguard",
    body: 2,
    skin: 1,
    hair: 1,
    hairColor: 1,
    primary: 0,
    secondary: 5,
    marking: 1,
    armor: "heavy",
    lamp: "oil",
    weaponTier: 2,
  }),
  L({
    discipline: "gunner",
    skin: 3,
    hair: 3,
    hairColor: 4,
    primary: 2,
    secondary: 3,
    headgear: 2,
    armor: "light",
    lamp: "arc",
    weaponTier: 1,
  }),
  L({
    discipline: "lamplighter",
    skin: 2,
    hair: 5,
    hairColor: 5,
    primary: 7,
    secondary: 3,
    marking: 2,
    armor: "light",
    lamp: "oil",
    weaponTier: 3,
  }),
  L({
    discipline: "reaver",
    body: 0,
    skin: 4,
    hair: 2,
    hairColor: 0,
    primary: 6,
    secondary: 1,
    marking: 2,
    armor: "light",
    weaponTier: 1,
  }),
  L({
    discipline: "hexer",
    body: 0,
    skin: 5,
    hair: 7,
    hairColor: 7,
    primary: 9,
    secondary: 6,
    headgear: 1,
    marking: 3,
    armor: "light",
    lamp: "shroud",
    weaponTier: 4,
  }),
];

const VARIED: MercLook[] = [
  L({ discipline: "vanguard", body: 1, skin: 3, hair: 4, hairColor: 3, primary: 4, secondary: 7, headgear: 4, armor: "medium", weaponTier: 0 }),
  L({ discipline: "gunner", body: 2, skin: 0, hair: 0, hairColor: 0, primary: 1, secondary: 6, headgear: 3, marking: 1, armor: "medium", lamp: "oil", weaponTier: 3 }),
  L({ discipline: "reaver", body: 1, skin: 2, hair: 6, hairColor: 2, primary: 5, secondary: 0, marking: 3, armor: "medium", lamp: "arc", weaponTier: 4 }),
  L({ discipline: "hexer", body: 1, skin: 1, hair: 3, hairColor: 6, primary: 6, secondary: 9, headgear: 2, armor: "medium", weaponTier: 1 }),
  L({ discipline: "lamplighter", body: 2, skin: 4, hair: 0, hairColor: 5, primary: 3, secondary: 4, headgear: 1, armor: "medium", lamp: "arc", weaponTier: 0 }),
  L({ discipline: "vanguard", body: 0, skin: 5, hair: 7, hairColor: 4, primary: 8, secondary: 3, marking: 2, armor: "light", lamp: "shroud", weaponTier: 4 }),
  L({ discipline: "gunner", body: 0, skin: 2, hair: 5, hairColor: 2, primary: 9, secondary: 2, headgear: 4, armor: "heavy", weaponTier: 2 }),
  L({ discipline: "reaver", body: 2, skin: 1, hair: 1, hairColor: 1, primary: 2, secondary: 8, headgear: 3, armor: "heavy", lamp: "oil", weaponTier: 0 }),
];

/** Rival scavs (enemy agent): Scav Cutter (reaver-like) and Scav Gunner (gunner-like). */
const HOSTILE: MercLook[] = [
  L({ discipline: "reaver", body: 1, skin: 0, hair: 2, hairColor: 4, primary: 6, secondary: 1, headgear: 0, marking: 1, armor: "medium", weaponTier: 1 }),
  L({ discipline: "gunner", body: 2, skin: 1, hair: 0, hairColor: 0, primary: 1, secondary: 6, headgear: 3, armor: "light", weaponTier: 0 }),
];

// ---------------------------------------------------------------------------
// Timing
// ---------------------------------------------------------------------------
const timings: string[] = [];
function timed(look: MercLook, hostile = false) {
  const t0 = performance.now();
  const def = buildMercRig(look, { hostile });
  const t1 = performance.now();
  const p = mercPortraitHD(look, { hostile });
  const t2 = performance.now();
  timings.push(
    `${look.discipline.padEnd(12)} ${hostile ? "HOSTILE " : ""}rig ${(t1 - t0).toFixed(1)}ms  portrait ${(t2 - t1).toFixed(1)}ms  parts ${def.parts.length}`,
  );
  return { def, p };
}
for (const l of LINEUP) timed(l);
for (const l of VARIED) timed(l);
for (const l of HOSTILE) timed(l, true);

// ---------------------------------------------------------------------------
// Phaser lineup
// ---------------------------------------------------------------------------
class Lineup extends Phaser.Scene {
  create() {
    const g = this.add.graphics();
    // Floor bands + lamp pools.
    g.fillStyle(0x17142a, 1).fillRect(0, 560, 1920, 4);
    g.fillStyle(0x17142a, 1).fillRect(0, 1010, 1920, 4);
    const label = (x: number, y: number, s: string) =>
      this.add
        .text(x, y, s, { fontFamily: "monospace", fontSize: "18px", color: "#9c9183" })
        .setOrigin(0.5, 0);
    const shadow = (x: number, y: number, w: number) => {
      g.fillStyle(0x000000, 0.45).fillEllipse(x, y, w, w * 0.16);
    };
    const only = params.get("only");
    const dbg = params.get("dbgpart");
    if (dbg !== null) {
      const def = buildMercRig(LINEUP[Number(dbg)] as MercLook);
      def.parts.forEach((p, i) => {
        const key = `dbg.${p.id}`;
        this.textures.addCanvas(key, p.canvas);
        this.add.image(20 + (i % 10) * 190, 20 + Math.floor(i / 10) * 420, key).setOrigin(0, 0);
        label(100 + (i % 10) * 190, 400 + Math.floor(i / 10) * 420, p.id);
      });
      return;
    }
    LINEUP.forEach((look, i) => {
      if (only !== null && Number(only) !== i) return;
      const x = 230 + i * 365;
      const y = 556;
      shadow(x, y, 190);
      const spr = new RigSprite(this, x, y, buildMercRig(look), { scale: 1 });
      ((window as unknown as { __sprites: RigSprite[] }).__sprites ??= []).push(spr);
      label(x, y + 12, look.discipline);
      if (freeze) {
        void spr.play(freeze, 1);
        return;
      }
      spr.idle();
      const cycle = async () => {
        const wait = (ms: number) => new Promise((r) => this.time.delayedCall(ms, r));
        for (;;) {
          await wait(1400 + i * 120);
          await spr.attack();
          await wait(1200);
          await spr.cast();
          await wait(900);
          await spr.hurt();
          await wait(1100);
          if (i % 2 === 0) {
            await spr.down();
            await wait(900);
            await spr.rise();
          }
        }
      };
      void cycle();
    });
    const row = [...VARIED.map((l) => ({ l, h: false })), ...HOSTILE.map((l) => ({ l, h: true }))];
    row.forEach(({ l, h }, i) => {
      if (only !== null) return;
      const x = 100 + i * 190;
      const y = 1004;
      shadow(x, y, 130);
      const spr = new RigSprite(this, x, y, buildMercRig(l, { hostile: h }), {
        scale: 0.67,
        flip: h,
      });
      label(x, y + 6, h ? `scav ${l.discipline}` : `${l.discipline} ${l.armor[0]}`);
      if (freeze) {
        void spr.play(freeze, 1);
        return;
      }
      spr.idle();
      const loop = async () => {
        const wait = (ms: number) => new Promise((r) => this.time.delayedCall(ms, r));
        await wait(800 + i * 450);
        for (;;) {
          await spr.attack();
          await wait(3500 + (i % 3) * 700);
        }
      };
      void loop();
    });
  }
}

if (params.get("nogame") !== "1") {
  new Phaser.Game({
    type: Phaser.WEBGL,
    parent: "game",
    width: 1920,
    height: 1080,
    backgroundColor: "#0d0b14",
    antialias: true,
    scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.NO_CENTER },
    scene: [Lineup],
  });
}

// ---------------------------------------------------------------------------
// Stills
// ---------------------------------------------------------------------------
const rest = document.getElementById("rest") as HTMLElement;
const h2 = (s: string) => {
  const e = document.createElement("h2");
  e.textContent = s;
  rest.append(e);
};
const row = () => {
  const r = document.createElement("div");
  r.className = "row";
  rest.append(r);
  return r;
};
const cell = (r: HTMLElement, c: HTMLCanvasElement, label: string) => {
  const d = document.createElement("div");
  d.className = "cell";
  const s = document.createElement("span");
  s.textContent = label;
  d.append(c, s);
  r.append(d);
};

const pre = document.createElement("pre");
pre.id = "timing";
pre.textContent = timings.join("\n");
rest.append(pre);

if (params.get("stills") !== "0") {
  const crop = { x: -270, y: -430, w: 560, h: 450 };
  for (const look of LINEUP) {
    h2(`${look.discipline} — poses`);
    const r = row();
    const def = buildMercRig(look);
    for (const pose of HD_POSES) cell(r, bakeRig(def, pose, { scale: 0.5, crop }), pose);
  }
  h2("portraits (192px) — lineup, varied, hostile");
  const pr = row();
  for (const l of LINEUP) cell(pr, mercPortraitHD(l), l.discipline);
  for (const l of VARIED) cell(pr, mercPortraitHD(l), l.discipline);
  for (const l of HOSTILE) cell(pr, mercPortraitHD(l, { hostile: true }), `scav ${l.discipline}`);
  h2("zoom ×2 (idle, upper body)");
  const zr = row();
  for (const l of [...LINEUP, ...VARIED.slice(0, 3)]) {
    cell(zr, bakeRig(buildMercRig(l), "idle", { scale: 2, crop: { x: -110, y: -360, w: 220, h: 220 } }), l.discipline);
  }
  h2("varied + hostile — idle (scale 1)");
  const vr = row();
  for (const l of VARIED) cell(vr, bakeRig(buildMercRig(l), "idle", { scale: 0.75, crop }), `${l.discipline} ${l.armor}`);
  for (const l of HOSTILE)
    cell(vr, bakeRig(buildMercRig(l, { hostile: true }), "idle", { scale: 0.75, crop }), `scav ${l.discipline}`);
}
