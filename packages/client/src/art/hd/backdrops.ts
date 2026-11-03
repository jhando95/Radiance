/**
 * HD painted battle backdrops (1920x1080 render px) and the title / expedition-map sky.
 *
 * Style: layered inked silhouettes over soft painted gradients, fog and grain; cold indigo
 * darkness with scarce warm amber lamp accents. Values stay dark (the battle scene adds its
 * own darkness overlay and light pools) but carry mid-tone structure for depth.
 *
 * Layout contract (render px): characters' feet at y = 750 (mercs x ≈ 225–810, enemies
 * x ≈ 1110–1700); the ground band y ≈ 690–860 is kept calm and dark; the HUD covers y > 858.
 *
 * Layers are ordered back → front. All are 1920x1080 except the front-most, which is
 * 2112x1080 and should be drawn centred (96 px spare each side for parallax drift). The
 * back layer is opaque; the others are transparent. Output is deterministic per seed and
 * memoized per (biome, seed).
 */
import type { Biome } from "../backgrounds";
import { ashenSurface } from "./env/ashen";
import { crystalHollows } from "./env/hollows";
import { mapBackdrop } from "./env/map";
import { duskMines } from "./env/mines";
import { setMirror } from "./env/paint";

export { BH as BACKDROP_H, BW as BACKDROP_W, FRONT_W as BACKDROP_FRONT_W } from "./env/paint";

const cache = new Map<string, { layers: HTMLCanvasElement[] }>();

/** Parallax battle backdrop, layers back → front (front-most is 2112 wide: centre it). */
export function drawBackdropHD(biome: Biome, seed: number): { layers: HTMLCanvasElement[] } {
  const key = `${biome}:${seed}`;
  const hit = cache.get(key);
  if (hit) return hit;
  // Odd seeds mirror the composition for extra variety (the lighting reads either way).
  setMirror((seed & 1) === 1);
  let layers: HTMLCanvasElement[];
  try {
    layers =
      biome === "duskMines"
        ? duskMines(seed)
        : biome === "crystalHollows"
          ? crystalHollows(seed)
          : ashenSurface(seed);
  } finally {
    setMirror(false);
  }
  const bd = { layers };
  cache.set(key, bd);
  return bd;
}

const mapCache = new Map<number, HTMLCanvasElement>();

/** 1920x1080 title / expedition-map backdrop: stars, a vast dim ringed gas giant, the moon's horizon. */
export function drawMapBackdropHD(seed: number): HTMLCanvasElement {
  const hit = mapCache.get(seed);
  if (hit) return hit;
  const c = mapBackdrop(seed);
  mapCache.set(seed, c);
  return c;
}
