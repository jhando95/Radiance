/**
 * Balance simulator: plays many seeded combats with bots and prints win rates.
 *   pnpm sim                       # default matrix
 *   pnpm sim -- --runs 2000        # more samples
 */
import { CLASS_IDS, ENCOUNTERS, simulate } from "../src/index";

const runsArg = process.argv.indexOf("--runs");
const runs = runsArg > -1 ? Number(process.argv[runsArg + 1]) : 500;

const parties: string[][] = [
  ...CLASS_IDS.map((c) => [c]),
  ["warden", "seeker"],
  ["warden", "seeker", "seeker"],
  ["warden", "warden", "seeker", "seeker"],
];

const rows = [];
for (const encounterId of Object.keys(ENCOUNTERS)) {
  for (const classes of parties) {
    const r = simulate({ encounterId, classes, runs });
    rows.push({
      encounter: encounterId,
      party: classes.join("+"),
      winRate: `${(r.winRate * 100).toFixed(1)}%`,
      avgTurns: r.avgTurns.toFixed(1),
      hpLost: `${(r.avgHpLostPct * 100).toFixed(1)}%`,
      stalemates: r.stalemates,
    });
  }
}
console.log(`Simulated ${runs} combats per row\n`);
console.table(rows);
