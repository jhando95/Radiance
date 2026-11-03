/**
 * Dev gallery for character art: open /gallery-characters.html on the Vite dev server.
 * Renders every merc discipline/pose, a grid of randomised looks, portraits, and every enemy.
 */
import {
  drawEnemy,
  drawEnemyPortrait,
  type EnemyArtId,
  type EnemyPose,
  enemyFrame,
} from "./enemies";
import {
  type ArmorWeight,
  type Discipline,
  drawMerc,
  drawMercPortrait,
  type LampKind,
  type MercLook,
  type MercPose,
} from "./mercs";
import { artRng, upscale } from "./pixel";

const SCALE = 4;
const DISCIPLINES: Discipline[] = ["vanguard", "gunner", "lamplighter", "reaver", "hexer"];
const POSES: MercPose[] = ["idle0", "idle1", "attack", "cast", "hurt", "downed"];
const ENEMIES: EnemyArtId[] = [
  "huskMiner",
  "huskForeman",
  "gloamCrawler",
  "voidWisp",
  "shardback",
  "scavCutter",
  "scavGunner",
  "umbralStalker",
  "mycelidTender",
  "lumenEater",
  "mawTendril",
];
const ENEMY_POSES: EnemyPose[] = ["idle0", "idle1", "attack", "hurt"];

export const SHOWCASE: Record<Discipline, MercLook> = {
  vanguard: {
    discipline: "vanguard",
    body: 2,
    skin: 2,
    hair: 1,
    hairColor: 1,
    primary: 0,
    secondary: 5,
    headgear: 0,
    marking: 1,
    armor: "heavy",
    lamp: "oil",
    weaponTier: 2,
  },
  gunner: {
    discipline: "gunner",
    body: 1,
    skin: 0,
    hair: 5,
    hairColor: 0,
    primary: 2,
    secondary: 3,
    headgear: 2,
    marking: 0,
    armor: "medium",
    lamp: "arc",
    weaponTier: 1,
  },
  lamplighter: {
    discipline: "lamplighter",
    body: 1,
    skin: 3,
    hair: 3,
    hairColor: 3,
    primary: 3,
    secondary: 4,
    headgear: 0,
    marking: 0,
    armor: "light",
    lamp: "none",
    weaponTier: 4,
  },
  reaver: {
    discipline: "reaver",
    body: 0,
    skin: 1,
    hair: 2,
    hairColor: 4,
    primary: 4,
    secondary: 5,
    headgear: 3,
    marking: 2,
    armor: "light",
    lamp: "oil",
    weaponTier: 3,
  },
  hexer: {
    discipline: "hexer",
    body: 0,
    skin: 5,
    hair: 0,
    hairColor: 5,
    primary: 6,
    secondary: 9,
    headgear: 1,
    marking: 3,
    armor: "light",
    lamp: "shroud",
    weaponTier: 3,
  },
};

function randomLook(seed: number): MercLook {
  const r = artRng(seed);
  const int = (n: number) => Math.floor(r() * n);
  const armors: ArmorWeight[] = ["light", "medium", "heavy"];
  const lamps: LampKind[] = ["none", "oil", "arc", "shroud"];
  return {
    discipline: DISCIPLINES[seed % DISCIPLINES.length] as Discipline,
    body: int(3),
    skin: int(6),
    hair: int(8),
    hairColor: int(8),
    primary: int(10),
    secondary: int(10),
    headgear: (seed + Math.floor(seed / 5)) % 5,
    marking: int(4),
    armor: armors[(seed >> 1) % 3] as ArmorWeight,
    lamp: lamps[(seed >> 2) % 4] as LampKind,
    weaponTier: int(5),
  };
}

function el<K extends keyof HTMLElementTagNameMap>(tag: K, cls?: string, text?: string) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text) e.textContent = text;
  return e;
}

function cell(canvas: HTMLCanvasElement, label: string, scale = SCALE): HTMLElement {
  const c = el("div", "cell");
  c.appendChild(upscale(canvas, scale));
  c.appendChild(el("span", undefined, label));
  return c;
}

function section(root: HTMLElement, title: string): HTMLElement {
  root.appendChild(el("h2", undefined, title));
  const wrap = el("div");
  root.appendChild(wrap);
  return wrap;
}

function describe(l: MercLook): string {
  const hg = ["bare", "hood", "goggles", "rebreather", "helmet"][l.headgear] ?? "?";
  return `${l.discipline} b${l.body} ${l.armor} ${hg} h${l.hair} ${l.lamp} t${l.weaponTier}`;
}

function main(): void {
  const root = document.getElementById("root");
  if (!root) return;
  const t0 = performance.now();
  let draws = 0;

  const poses = section(root, "Disciplines × poses");
  for (const d of DISCIPLINES) {
    const row = el("div", "row");
    row.appendChild(el("div", "rowlabel", d));
    for (const p of POSES) {
      row.appendChild(cell(drawMerc(SHOWCASE[d], p), p));
      draws++;
    }
    row.appendChild(cell(drawMercPortrait(SHOWCASE[d]), "portrait"));
    poses.appendChild(row);
  }

  const looks = section(root, "Random looks (idle0)");
  const lrow = el("div", "row");
  const prow = el("div", "row");
  for (let i = 0; i < 16; i++) {
    const look = randomLook(i * 7 + 3);
    lrow.appendChild(cell(drawMerc(look, "idle0"), describe(look), 3));
    prow.appendChild(cell(drawMercPortrait(look), `#${i}`, 3));
    draws += 2;
  }
  looks.appendChild(lrow);
  root.appendChild(el("h2", undefined, "Portraits (24x24, 3x)"));
  root.appendChild(prow);

  const en = section(root, "Enemies × poses");
  for (const id of ENEMIES) {
    const row = el("div", "row");
    row.appendChild(el("div", "rowlabel", id));
    const big = enemyFrame(id).w > 48;
    for (const p of ENEMY_POSES) {
      row.appendChild(cell(drawEnemy(id, p), p, big ? 3 : SCALE));
      draws++;
    }
    row.appendChild(cell(drawEnemyPortrait(id), "portrait"));
    en.appendChild(row);
  }

  // Determinism + timing check
  const a = drawMerc(SHOWCASE.reaver, "attack").toDataURL();
  const b = drawMerc(SHOWCASE.reaver, "attack").toDataURL();
  const ms = (performance.now() - t0) / Math.max(1, draws);
  const info = el(
    "p",
    undefined,
    `${draws} sprites, avg ${ms.toFixed(2)} ms/sprite (incl. upscale + DOM). deterministic: ${a === b}`,
  );
  info.id = "stats";
  root.prepend(info);
}

main();
