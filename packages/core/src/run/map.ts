import { nextFloat, type RngState, rangeInt, weightedPick } from "../rng";
import type { Biome, MapNode, NodeType } from "../types";

export const MAP_ROWS = 9; // 0 = start, 1..7 = expedition, 8 = boss

export function biomeForRow(row: number): Biome {
  if (row <= 2) return "ashenSurface";
  if (row <= 5) return "duskMines";
  return "crystalHollows";
}

function rollType(r: RngState, row: number): NodeType {
  if (row === 1) return "combat";
  if (row === MAP_ROWS - 2) return "camp";
  const weights: [NodeType, number][] = [
    ["combat", 46],
    ["vein", 13],
    ["cache", 10],
    ["derelict", 13],
    ["camp", row >= 3 ? 8 : 0],
    ["elite", row >= 3 ? 12 : 0],
  ];
  return weightedPick(r, weights);
}

/** A layered DAG, descending from the surface to the Lumen Eater's lair. */
export function generateMap(r: RngState): MapNode[] {
  const rows: MapNode[][] = [];
  for (let row = 0; row < MAP_ROWS; row++) {
    const count = row === 0 || row === MAP_ROWS - 1 ? 1 : rangeInt(r, 2, 4);
    const nodes: MapNode[] = [];
    for (let col = 0; col < count; col++) {
      const jitter = count > 1 ? (nextFloat(r) - 0.5) * 0.12 : 0;
      nodes.push({
        id: `n${row}_${col}`,
        row,
        col,
        x: count === 1 ? 0.5 : Math.min(0.95, Math.max(0.05, (col + 0.5) / count + jitter)),
        type: row === 0 ? "start" : row === MAP_ROWS - 1 ? "boss" : rollType(r, row),
        biome: biomeForRow(row),
        next: [],
      });
    }
    // Avoid a row of nothing but elites/derelicts: guarantee at least one combat or camp.
    if (row > 1 && row < MAP_ROWS - 2 && !nodes.some((n) => n.type === "combat")) {
      const n = nodes[rangeInt(r, 0, nodes.length - 1)];
      if (n) n.type = "combat";
    }
    rows.push(nodes);
  }
  for (let row = 0; row < MAP_ROWS - 1; row++) {
    const cur = rows[row] as MapNode[];
    const nxt = rows[row + 1] as MapNode[];
    for (const node of cur) {
      const sorted = [...nxt].sort((a, b) => Math.abs(a.x - node.x) - Math.abs(b.x - node.x));
      const first = sorted[0];
      if (first) node.next.push(first.id);
      const second = sorted[1];
      if (second && nextFloat(r) < 0.55) node.next.push(second.id);
    }
    // Every node in the next row needs a way in.
    for (const target of nxt) {
      if (cur.some((n) => n.next.includes(target.id))) continue;
      const nearest = [...cur].sort(
        (a, b) => Math.abs(a.x - target.x) - Math.abs(b.x - target.x),
      )[0];
      nearest?.next.push(target.id);
    }
    for (const node of cur) node.next.sort();
  }
  return rows.flat();
}
