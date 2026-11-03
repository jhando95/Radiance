import type { ClassDef } from "../types";

export const CLASSES = {
  warden: {
    id: "warden",
    name: "Warden",
    maxHp: 80,
    maxEnergy: 3,
    startingDeck: [
      "strike",
      "strike",
      "strike",
      "strike",
      "guard",
      "guard",
      "guard",
      "guard",
      "interpose",
      "kindle",
    ],
    blurb: "A shield-bearer who protects allies and stokes the party's Radiance.",
  },
  seeker: {
    id: "seeker",
    name: "Seeker",
    maxHp: 70,
    maxEnergy: 3,
    startingDeck: [
      "strike",
      "strike",
      "strike",
      "strike",
      "guard",
      "guard",
      "guard",
      "guard",
      "lanternFlash",
      "sunburst",
    ],
    blurb: "A scout who pierces the dark, revealing intents and spending Radiance in bursts.",
  },
} satisfies Record<string, ClassDef>;

export type ClassId = keyof typeof CLASSES;
export const CLASS_IDS = Object.keys(CLASSES) as ClassId[];
