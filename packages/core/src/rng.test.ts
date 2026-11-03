import { describe, expect, it } from "vitest";
import { nextInt, nextU32, seedRng, shuffle, weightedPick } from "./rng";

describe("rng", () => {
  it("is deterministic for a given seed", () => {
    const a = seedRng("radiance");
    const b = seedRng("radiance");
    const seqA = Array.from({ length: 50 }, () => nextU32(a));
    const seqB = Array.from({ length: 50 }, () => nextU32(b));
    expect(seqA).toEqual(seqB);
  });

  it("diverges for different seeds", () => {
    const a = seedRng("seed-1");
    const b = seedRng("seed-2");
    expect(nextU32(a)).not.toEqual(nextU32(b));
  });

  it("survives a JSON round-trip mid-stream", () => {
    const a = seedRng("persist");
    nextU32(a);
    const b = JSON.parse(JSON.stringify(a));
    expect(nextU32(b)).toEqual(nextU32(a));
  });

  it("nextInt stays in range and covers it", () => {
    const r = seedRng("range");
    const seen = new Set<number>();
    for (let i = 0; i < 1000; i++) {
      const n = nextInt(r, 6);
      expect(n).toBeGreaterThanOrEqual(0);
      expect(n).toBeLessThan(6);
      seen.add(n);
    }
    expect(seen.size).toBe(6);
  });

  it("shuffle is a permutation", () => {
    const items = Array.from({ length: 20 }, (_, i) => i);
    shuffle(seedRng("shuffle"), items);
    expect([...items].sort((x, y) => x - y)).toEqual(Array.from({ length: 20 }, (_, i) => i));
  });

  it("weightedPick never picks zero-weight options", () => {
    const r = seedRng("weights");
    for (let i = 0; i < 500; i++) {
      expect(
        weightedPick(r, [
          ["a", 0],
          ["b", 1],
        ] as const),
      ).toBe("b");
    }
  });
});
