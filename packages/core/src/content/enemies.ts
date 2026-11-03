import type { EncounterDef, EnemyDef } from "../types";

export const ENEMIES = {
  gloomling: {
    id: "gloomling",
    name: "Gloomling",
    hp: [13, 17],
    veiled: false,
    moves: [
      { id: "claw", name: "Claw", effects: [{ kind: "attack", amount: 6, to: "target" }] },
      {
        id: "skitter",
        name: "Skitter",
        effects: [
          { kind: "block", amount: 4 },
          { kind: "attack", amount: 3, to: "target" },
        ],
      },
    ],
    ai: { type: "weighted", weights: { claw: 60, skitter: 40 }, maxRepeat: 2 },
  },
  shade: {
    id: "shade",
    name: "Shade",
    hp: [20, 24],
    veiled: true,
    moves: [
      {
        id: "sap",
        name: "Sap",
        effects: [
          { kind: "attack", amount: 7, to: "target" },
          { kind: "status", status: "weak", amount: 1, to: "target" },
        ],
      },
      { id: "fade", name: "Fade", effects: [{ kind: "block", amount: 8 }] },
    ],
    ai: { type: "weighted", weights: { sap: 65, fade: 35 }, maxRepeat: 2 },
  },
  hollowSentinel: {
    id: "hollowSentinel",
    name: "Hollow Sentinel",
    hp: [44, 48],
    veiled: true,
    moves: [
      {
        id: "brace",
        name: "Brace",
        effects: [
          { kind: "block", amount: 10 },
          { kind: "status", status: "strength", amount: 2, to: "self" },
        ],
      },
      { id: "crush", name: "Crush", effects: [{ kind: "attack", amount: 12, to: "target" }] },
      { id: "sweep", name: "Sweep", effects: [{ kind: "attack", amount: 5, to: "allPlayers" }] },
    ],
    ai: { type: "cycle", order: ["brace", "crush", "sweep"] },
  },
} satisfies Record<string, EnemyDef>;

export type EnemyDefId = keyof typeof ENEMIES;

export const ENCOUNTERS = {
  gloomPack: { id: "gloomPack", enemies: ["gloomling", "gloomling"] },
  shadeAmbush: { id: "shadeAmbush", enemies: ["gloomling", "shade"] },
  sentinel: { id: "sentinel", enemies: ["hollowSentinel"] },
} satisfies Record<string, EncounterDef>;

export type EncounterId = keyof typeof ENCOUNTERS;
