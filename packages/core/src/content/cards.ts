import type { CardDef } from "../types";

/**
 * Card content. Effects are declarative data so they can be validated, described,
 * simulated and (later) modded. If a card truly needs bespoke logic, add a new
 * effect kind in combat/effects.ts rather than special-casing the card id.
 */
export const CARDS = {
  // --- Neutral starters ------------------------------------------------------
  strike: {
    id: "strike",
    name: "Strike",
    classId: "neutral",
    type: "attack",
    rarity: "starter",
    cost: 1,
    targeting: "enemy",
    effects: [{ kind: "damage", amount: 6, to: "target" }],
  },
  guard: {
    id: "guard",
    name: "Guard",
    classId: "neutral",
    type: "skill",
    rarity: "starter",
    cost: 1,
    targeting: "none",
    effects: [{ kind: "block", amount: 5, to: "self" }],
  },
  kindle: {
    id: "kindle",
    name: "Kindle",
    classId: "neutral",
    type: "skill",
    rarity: "starter",
    cost: 1,
    targeting: "none",
    effects: [
      { kind: "radiance", amount: 2 },
      { kind: "draw", count: 1 },
    ],
    flavor: "A spark shared is a fire for all.",
  },

  // --- Warden: protector, shields allies, generates Radiance ------------------
  interpose: {
    id: "interpose",
    name: "Interpose",
    classId: "warden",
    type: "skill",
    rarity: "starter",
    cost: 1,
    targeting: "ally",
    effects: [{ kind: "block", amount: 8, to: "target" }],
    flavor: "Step into the dark so they don't have to.",
  },
  bulwarkHymn: {
    id: "bulwarkHymn",
    name: "Bulwark Hymn",
    classId: "warden",
    type: "skill",
    rarity: "common",
    cost: 2,
    targeting: "none",
    coopOnly: true,
    effects: [
      { kind: "block", amount: 6, to: "allAllies" },
      { kind: "radiance", amount: 1 },
    ],
  },

  // --- Seeker: reveals intents, spends Radiance for burst damage --------------
  lanternFlash: {
    id: "lanternFlash",
    name: "Lantern Flash",
    classId: "seeker",
    type: "skill",
    rarity: "starter",
    cost: 1,
    targeting: "enemy",
    effects: [
      { kind: "illuminate", to: "target" },
      { kind: "status", status: "vulnerable", amount: 1, to: "target" },
      { kind: "radiance", amount: 1 },
    ],
    flavor: "What is seen can be struck.",
  },
  sunburst: {
    id: "sunburst",
    name: "Sunburst",
    classId: "seeker",
    type: "attack",
    rarity: "starter",
    cost: 1,
    radianceCost: 3,
    targeting: "none",
    effects: [{ kind: "damage", amount: 10, to: "allEnemies" }],
  },
} satisfies Record<string, CardDef>;

export type CardId = keyof typeof CARDS;
