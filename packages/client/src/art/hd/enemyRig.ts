/**
 * HD enemy rigs (cut-out animated, drawn procedurally in the gothic-ink style).
 *
 * `buildEnemyRig(id)` returns a memoized RigDef FACING RIGHT (the game flips enemies to face
 * the squad). `enemyPortraitHD(id)` bakes a 192x192 bust crop facing right, transparent bg.
 */
import type { EnemyArtId } from "../enemies";
import { buildGloamCrawler } from "./enemy/crawler";
import { buildHuskForeman, buildHuskMiner } from "./enemy/husk";
import { buildMawTendril, buildLumenEater } from "./enemy/lumen";
import { buildMycelidTender } from "./enemy/mycelid";
import { buildScav, scavPortrait } from "./enemy/scav";
import { buildShardback } from "./enemy/shardback";
import { buildUmbralStalker } from "./enemy/stalker";
import { buildVoidWisp } from "./enemy/wisp";
import { bakeRig, type RigDef } from "./rig";

const BUILDERS: Record<EnemyArtId, () => RigDef> = {
  huskMiner: buildHuskMiner,
  huskForeman: buildHuskForeman,
  gloamCrawler: buildGloamCrawler,
  voidWisp: buildVoidWisp,
  shardback: buildShardback,
  umbralStalker: buildUmbralStalker,
  mycelidTender: buildMycelidTender,
  lumenEater: buildLumenEater,
  mawTendril: buildMawTendril,
  scavCutter: () => buildScav("cutter"),
  scavGunner: () => buildScav("gunner"),
};

const cache = new Map<EnemyArtId, RigDef>();

export function buildEnemyRig(id: EnemyArtId): RigDef {
  const hit = cache.get(id);
  if (hit) return hit;
  const def = BUILDERS[id]();
  cache.set(id, def);
  return def;
}

/** Portrait crop per enemy (root px, square): centre x, centre y, size. Scavs use the merc bust. */
const PORTRAIT: Record<EnemyArtId, readonly [number, number, number]> = {
  huskMiner: [70, -196, 130],
  huskForeman: [76, -250, 170],
  gloamCrawler: [70, -100, 140],
  voidWisp: [10, -186, 170],
  shardback: [86, -84, 140],
  scavCutter: [0, 0, 0],
  scavGunner: [0, 0, 0],
  umbralStalker: [86, -206, 150],
  mycelidTender: [28, -186, 200],
  lumenEater: [150, -392, 310],
  mawTendril: [20, -236, 150],
};

export function enemyPortraitHD(id: EnemyArtId): HTMLCanvasElement {
  if (id === "scavCutter") return copy(scavPortrait("cutter"));
  if (id === "scavGunner") return copy(scavPortrait("gunner"));
  const def = buildEnemyRig(id);
  const [cx, cy, size] = PORTRAIT[id];
  return bakeRig(def, "idle", {
    scale: 192 / size,
    crop: { x: cx - size / 2, y: cy - size / 2, w: size, h: size },
  });
}

/** Merc portraits are cached by the merc module; hand out a copy so callers may draw on it. */
function copy(src: HTMLCanvasElement): HTMLCanvasElement {
  const c = document.createElement("canvas");
  c.width = src.width;
  c.height = src.height;
  c.getContext("2d")?.drawImage(src, 0, 0);
  return c;
}
