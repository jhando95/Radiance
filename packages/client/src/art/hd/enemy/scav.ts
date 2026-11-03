/**
 * Rival scavengers: hostile HD merc rigs (built by ../mercRig.ts) in rust/charcoal kit with
 * rebreather (cutter) or goggles (gunner).
 */
import type { MercLook } from "../../mercs";
import { buildMercRig, mercPortraitHD } from "../mercRig";
import type { RigDef } from "../rig";

export const SCAV_CUTTER_LOOK: MercLook = {
  discipline: "reaver",
  body: 1,
  skin: 4,
  hair: 2,
  hairColor: 4,
  primary: 1,
  secondary: 6,
  headgear: 3,
  marking: 2,
  armor: "medium",
  lamp: "none",
  weaponTier: 1,
};

export const SCAV_GUNNER_LOOK: MercLook = {
  discipline: "gunner",
  body: 2,
  skin: 1,
  hair: 7,
  hairColor: 0,
  primary: 6,
  secondary: 1,
  headgear: 2,
  marking: 1,
  armor: "light",
  lamp: "oil",
  weaponTier: 1,
};

export type ScavKind = "cutter" | "gunner";

const lookOf = (kind: ScavKind): MercLook => (kind === "cutter" ? SCAV_CUTTER_LOOK : SCAV_GUNNER_LOOK);

export function buildScav(kind: ScavKind): RigDef {
  return buildMercRig(lookOf(kind), { hostile: true });
}

export function scavPortrait(kind: ScavKind): HTMLCanvasElement {
  return mercPortraitHD(lookOf(kind), { hostile: true });
}
