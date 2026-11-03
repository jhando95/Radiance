/**
 * Expedition simulator: bots play full runs. Prints outcomes so balance changes can be
 * judged with numbers.   pnpm sim -- --runs 200
 */
import { DISCIPLINE_IDS, defaultSquad, simulateRun } from "../src/index";

const runsArg = process.argv.indexOf("--runs");
const runs = runsArg > -1 ? Number(process.argv[runsArg + 1]) : 100;

const squads: Record<string, string[]> = {
  balanced: ["vanguard", "reaver", "gunner", "lamplighter"],
  darkness: ["vanguard", "reaver", "hexer", "hexer"],
  noHealer: ["vanguard", "reaver", "gunner", "gunner"],
  random: [],
};

const rows = [];
for (const [label, comp] of Object.entries(squads)) {
  let wins = 0;
  let depth = 0;
  let kills = 0;
  let level = 0;
  for (let i = 0; i < runs; i++) {
    const disciplines = comp.length
      ? comp
      : Array.from(
          { length: 4 },
          (_, k) => DISCIPLINE_IDS[(i * 7 + k * 3) % DISCIPLINE_IDS.length] as string,
        );
    const res = simulateRun(`sim-${label}-${i}`, 1 + (i % 4), defaultSquad(disciplines));
    if (res.phase === "victory") wins++;
    depth += res.row;
    kills += res.kills;
    level += res.levels.reduce((a, b) => a + b, 0) / 4;
  }
  rows.push({
    squad: label,
    winRate: `${((wins / runs) * 100).toFixed(1)}%`,
    avgDepth: (depth / runs).toFixed(2),
    avgKills: (kills / runs).toFixed(1),
    avgLevel: (level / runs).toFixed(2),
  });
}
console.log(`Simulated ${runs} expeditions per squad (map rows 0-8; 8 = boss)\n`);
console.table(rows);
