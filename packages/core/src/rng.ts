/**
 * Deterministic, serializable PRNG (sfc32 seeded via cyrb128).
 *
 * Never use Math.random() in @radiance/core. All randomness flows through named
 * streams stored on the game state, so a run is fully reproducible from its seed
 * plus its command log, and one player's actions never shift another player's draws.
 */

export interface RngState {
  a: number;
  b: number;
  c: number;
  d: number;
}

/** Hash a string into four 32-bit seeds (cyrb128). */
function cyrb128(str: string): [number, number, number, number] {
  let h1 = 1779033703;
  let h2 = 3144134277;
  let h3 = 1013904242;
  let h4 = 2773480762;
  for (let i = 0; i < str.length; i++) {
    const k = str.charCodeAt(i);
    h1 = h2 ^ Math.imul(h1 ^ k, 597399067);
    h2 = h3 ^ Math.imul(h2 ^ k, 2869860233);
    h3 = h4 ^ Math.imul(h3 ^ k, 951274213);
    h4 = h1 ^ Math.imul(h4 ^ k, 2716044179);
  }
  h1 = Math.imul(h3 ^ (h1 >>> 18), 597399067);
  h2 = Math.imul(h4 ^ (h2 >>> 22), 2869860233);
  h3 = Math.imul(h1 ^ (h3 >>> 17), 951274213);
  h4 = Math.imul(h2 ^ (h4 >>> 19), 2716044179);
  h1 ^= h2 ^ h3 ^ h4;
  h2 ^= h1;
  h3 ^= h1;
  h4 ^= h1;
  return [h1 >>> 0, h2 >>> 0, h3 >>> 0, h4 >>> 0];
}

export function seedRng(seed: string): RngState {
  const [a, b, c, d] = cyrb128(seed);
  const state: RngState = { a, b, c, d };
  // Warm up so similar seeds diverge quickly.
  for (let i = 0; i < 12; i++) nextU32(state);
  return state;
}

/** Advance the stream and return an unsigned 32-bit integer. Mutates `r`. */
export function nextU32(r: RngState): number {
  r.a >>>= 0;
  r.b >>>= 0;
  r.c >>>= 0;
  r.d >>>= 0;
  const t = (((r.a + r.b) | 0) + r.d) | 0;
  r.d = (r.d + 1) | 0;
  r.a = r.b ^ (r.b >>> 9);
  r.b = (r.c + (r.c << 3)) | 0;
  r.c = (r.c << 21) | (r.c >>> 11);
  r.c = (r.c + t) | 0;
  return t >>> 0;
}

/** Float in [0, 1). */
export function nextFloat(r: RngState): number {
  return nextU32(r) / 4294967296;
}

/** Integer in [0, maxExclusive). */
export function nextInt(r: RngState, maxExclusive: number): number {
  if (maxExclusive <= 0) throw new Error(`nextInt: maxExclusive must be > 0, got ${maxExclusive}`);
  return Math.floor(nextFloat(r) * maxExclusive);
}

/** Integer in [min, max] inclusive. */
export function rangeInt(r: RngState, min: number, max: number): number {
  return min + nextInt(r, max - min + 1);
}

export function pick<T>(r: RngState, items: readonly T[]): T {
  const item = items[nextInt(r, items.length)];
  if (item === undefined) throw new Error("pick: empty array");
  return item;
}

export function weightedPick<T extends string>(
  r: RngState,
  weights: ReadonlyArray<readonly [T, number]>,
): T {
  const total = weights.reduce((sum, [, w]) => sum + Math.max(0, w), 0);
  if (total <= 0) throw new Error("weightedPick: no positive weights");
  let roll = nextFloat(r) * total;
  for (const [value, w] of weights) {
    roll -= Math.max(0, w);
    if (roll < 0) return value;
  }
  // Floating point edge: fall back to last positive weight.
  const last = [...weights].reverse().find(([, w]) => w > 0);
  if (!last) throw new Error("weightedPick: unreachable");
  return last[0];
}

/** In-place Fisher–Yates shuffle. */
export function shuffle<T>(r: RngState, items: T[]): void {
  for (let i = items.length - 1; i > 0; i--) {
    const j = nextInt(r, i + 1);
    const tmp = items[i] as T;
    items[i] = items[j] as T;
    items[j] = tmp;
  }
}
