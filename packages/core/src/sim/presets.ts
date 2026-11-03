import type { MercSetup } from "../types";

const look = (n: number) => ({
  body: n % 3,
  skin: n % 6,
  hair: (n * 3) % 8,
  hairColor: (n * 5) % 8,
  primary: (n * 7) % 10,
  secondary: (n * 3 + 1) % 10,
  headgear: n % 5,
  marking: n % 4,
});

/** Starter setups per discipline (also used as client defaults). */
export const CLASS_PRESETS: Record<string, MercSetup> = {
  vanguard: {
    name: "Brask",
    discipline: "vanguard",
    origin: "railVeteran",
    appearance: look(1),
    skills: ["shieldBash", "seismicSlam", "bulwark", "grappleChain"],
  },
  reaver: {
    name: "Vesk",
    discipline: "reaver",
    origin: "voidBorn",
    appearance: look(2),
    skills: ["rend", "flurry", "execute", "lunge"],
  },
  gunner: {
    name: "Ilo",
    discipline: "gunner",
    origin: "corpDeserter",
    appearance: look(3),
    skills: ["aimedShot", "flareRound", "piercingRound", "suppressingFire"],
  },
  lamplighter: {
    name: "Sefa",
    discipline: "lamplighter",
    origin: "sunPenitent",
    appearance: look(4),
    skills: ["kindleWounds", "radiantLash", "beacon", "warmth"],
  },
  hexer: {
    name: "Mott",
    discipline: "hexer",
    origin: "scrapProphet",
    appearance: look(5),
    skills: ["voidBolt", "hexOfFrailty", "rotCurse", "umbralTide"],
  },
};
