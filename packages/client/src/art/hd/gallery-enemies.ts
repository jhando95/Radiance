/**
 * Dev gallery for HD enemy rigs. Open /hd-enemies.html.
 * Query params: `?only=<id>` shows just that enemy's stills at 1.5x; `?pose=<pose>` freezes
 * the live sprites in that pose instead of cycling; `?still=0` skips the stills.
 */
import * as Phaser from "phaser";
import type { EnemyArtId } from "../enemies";
import { buildEnemyRig, enemyPortraitHD } from "./enemyRig";
import { bakeRig, HD_POSES, type HdPose, RigSprite } from "./rig";

const NORMALS: EnemyArtId[] = [
  "huskMiner",
  "huskForeman",
  "gloamCrawler",
  "voidWisp",
  "shardback",
  "scavCutter",
  "scavGunner",
  "umbralStalker",
  "mycelidTender",
  "mawTendril",
];
const ALL: EnemyArtId[] = [...NORMALS, "lumenEater"];

const params = new URLSearchParams(location.search);
const only = params.get("only") as EnemyArtId | null;
const frozen = params.get("pose") as HdPose | null;

const timing = document.getElementById("timing") as HTMLElement;
const lines: string[] = [];
for (const id of ALL) {
  const t0 = performance.now();
  buildEnemyRig(id);
  lines.push(`${id}: ${(performance.now() - t0).toFixed(1)}ms`);
}
timing.textContent = `rig build — ${lines.join(" · ")}`;

function el<K extends keyof HTMLElementTagNameMap>(tag: K, text?: string): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  if (text) e.textContent = text;
  return e;
}

function cycle(scene: Phaser.Scene, s: RigSprite, delay: number): void {
  if (frozen) {
    void s.play(frozen, 1);
    return;
  }
  s.idle();
  const run = async () => {
    const wait = (ms: number) => new Promise((r) => scene.time.delayedCall(ms, r));
    for (;;) {
      await wait(1400);
      await s.attack();
      await wait(1400);
      await s.cast();
      await wait(500);
      await s.hurt();
    }
  };
  scene.time.delayedCall(delay, () => void run());
}

function liveGame(
  parent: HTMLElement,
  layout: (scene: Phaser.Scene) => void,
): void {
  const holder = el("div");
  holder.className = "live";
  parent.append(holder);
  class S extends Phaser.Scene {
    create() {
      this.cameras.main.setBackgroundColor("#0d0b14");
      const g = this.add.graphics();
      g.lineStyle(1, 0x231f3d, 1);
      layout(this);
      g.setDepth(-1);
    }
  }
  new Phaser.Game({
    type: Phaser.AUTO,
    width: 1920,
    height: 1080,
    parent: holder,
    antialias: true,
    backgroundColor: "#0d0b14",
    scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_HORIZONTALLY },
    ...(params.get("gl") ? { render: { maxTextures: Number(params.get("gl")) } } : {}),
    scene: S,
  });
}

function label(scene: Phaser.Scene, x: number, y: number, text: string): void {
  scene.add
    .text(x, y, text, { fontFamily: "monospace", fontSize: "18px", color: "#6f665c" })
    .setOrigin(0.5, 0);
}

function ground(scene: Phaser.Scene, y: number): void {
  const g = scene.add.graphics();
  g.lineStyle(2, 0x231f3d, 1);
  g.lineBetween(0, y, 1920, y);
}

const live = document.getElementById("live") as HTMLElement;
if (!only) {
  // Game 1: the ten normal enemies at scale 1, two rows.
  liveGame(live, (scene) => {
    const rows = [NORMALS.slice(0, 5), NORMALS.slice(5)];
    rows.forEach((row, r) => {
      const gy = 470 + r * 520;
      ground(scene, gy);
      row.forEach((id, i) => {
        const x = 230 + i * 365;
        const s = new RigSprite(scene, x, gy, buildEnemyRig(id), { flip: true, scale: 1 });
        cycle(scene, s, (r * 5 + i) * 230);
        label(scene, x, gy + 8, id);
      });
    });
  });
  // Game 2: the boss with two maw tendrils, plus a battle-scale (0.67) lineup at 192 px.
  liveGame(live, (scene) => {
    const gy = 640;
    ground(scene, gy);
    const boss = new RigSprite(scene, 1180, gy, buildEnemyRig("lumenEater"), { flip: true });
    cycle(scene, boss, 0);
    label(scene, 1180, gy + 8, "lumenEater");
    for (const [i, x] of [1520, 1760].entries()) {
      const t = new RigSprite(scene, x, gy, buildEnemyRig("mawTendril"), { flip: true });
      cycle(scene, t, 600 + i * 400);
    }
    const by = 1040;
    ground(scene, by);
    NORMALS.forEach((id, i) => {
      const s = new RigSprite(scene, 96 + i * 192, by, buildEnemyRig(id), { flip: true, scale: 0.67 });
      cycle(scene, s, i * 300);
    });
    label(scene, 400, gy + 8, "battle scale 0.67 @ 192px spacing (bottom)");
  });
}

// ---- stills ----
const stills = document.getElementById("stills") as HTMLElement;
if (params.get("still") !== "0") {
  const ids = only ? [only] : ALL;
  const sc = only ? 1.5 : 0.6;
  for (const id of ids) {
    const def = buildEnemyRig(id);
    stills.append(el("h2", `${id} — ${def.parts.length} parts, ${def.width}x${def.height}`));
    const row = el("div");
    row.className = "row";
    for (const pose of HD_POSES) {
      const cell = el("div");
      cell.className = "cell";
      const k = id === "lumenEater" && !only ? sc * 0.6 : sc;
      const crop = {
        x: -def.width * 0.85,
        y: -def.height * 1.2,
        w: def.width * 2,
        h: def.height * 1.3,
      };
      cell.append(bakeRig(def, pose, { scale: k, crop }), el("span", pose));
      row.append(cell);
    }
    const cell = el("div");
    cell.className = "cell";
    cell.append(enemyPortraitHD(id), el("span", "portrait 192"));
    row.append(cell);
    stills.append(row);
  }
  if (!only) {
    const row = el("div");
    row.className = "row";
    for (const id of ALL) {
      const cell = el("div");
      cell.className = "cell";
      cell.append(enemyPortraitHD(id), el("span", id));
      row.append(cell);
    }
    stills.prepend(row);
    stills.prepend(el("h2", "portraits (192x192)"));
  }
}

// ---- debug: rotated canvas images inside a flipped container (runtime clipping check) ----
if (params.get("debug") === "rot") {
  liveGame(live, (scene) => {
    const mk = (key: string, w: number, h: number) => {
      const c = document.createElement("canvas");
      c.width = w;
      c.height = h;
      const ctx = c.getContext("2d") as CanvasRenderingContext2D;
      ctx.fillStyle = "#c04040";
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = "#40c040";
      ctx.fillRect(10, 10, w - 20, h - 20);
      scene.textures.addCanvas(key, c);
    };
    mk("dbg.a", 200, 100);
    for (const [i, rot] of [0, 90, 143, 173, -167, -100].entries()) {
      scene.add.image(200 + i * 260, 200, "dbg.a").setOrigin(0, 0).setRotation((rot * Math.PI) / 180);
      const outer = scene.add.container(200 + i * 260, 600);
      const inner = scene.add.container(0, 0);
      outer.add(inner);
      inner.setScale(-1, 1);
      const img = scene.add.image(0, 0, "dbg.a").setOrigin(0, 0).setRotation((rot * Math.PI) / 180);
      inner.add(img);
    }
  });
}

if (params.get("debug") === "rig") {
  const id = (params.get("id") as EnemyArtId | null) ?? "huskMiner";
  const pose = (params.get("p") as HdPose | null) ?? "windup";
  liveGame(live, (scene) => {
    const def = buildEnemyRig(id);
    const s = new RigSprite(scene, 500, 900, def, { scale: 2 });
    void s.play(pose, 1);
    (window as unknown as { dbgRig: RigSprite }).dbgRig = s;
    const baked = bakeRig(def, pose, { scale: 2, crop: { x: -200, y: -400, w: 400, h: 420 } });
    scene.textures.addCanvas("dbg.bake", baked);
    scene.add.image(1100, 900 - 800, "dbg.bake").setOrigin(0, 0);
  });
}
