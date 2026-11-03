/**
 * Game data -> art "look" mapping. Every client view that shows a mercenary goes through
 * here: core's MercSetup / Merc (discipline, appearance, equipment) become a MercLook for
 * the procedural sprite generator in ./mercs.ts, and generated canvases are cached as
 * Phaser textures under stable keys.
 */
import { getDiscipline, type Merc, type MercSetup, RARITIES } from "@radiance/core";
import * as Phaser from "phaser";
import {
  type ArmorWeight,
  type Discipline,
  drawMerc,
  drawMercPortrait,
  type LampKind,
  type MercLook,
  type MercPose,
} from "./mercs";

export type { ArmorWeight, Discipline, LampKind, MercLook, MercPose };

const ARMOR_WEIGHTS: Record<string, ArmorWeight> = {
  scavLeathers: "light",
  plateVest: "medium",
  bulwarkPlate: "heavy",
};

const LAMP_KINDS: Record<string, LampKind> = {
  oilLantern: "oil",
  arcLamp: "arc",
  shroudLamp: "shroud",
};

const DISCIPLINES: readonly Discipline[] = ["vanguard", "gunner", "lamplighter", "reaver", "hexer"];

function asDiscipline(id: string): Discipline {
  return (DISCIPLINES as readonly string[]).includes(id) ? (id as Discipline) : "vanguard";
}

/** Armor item base id -> sprite armor weight (default light). */
export function armorWeightOf(armorBaseId: string | undefined): ArmorWeight {
  return (armorBaseId && ARMOR_WEIGHTS[armorBaseId]) || "light";
}

/** Lamp item base id -> sprite lamp kind (default none). */
export function lampKindOf(lampBaseId: string | undefined): LampKind {
  return (lampBaseId && LAMP_KINDS[lampBaseId]) || "none";
}

function startArmorOf(disciplineId: string): string | undefined {
  try {
    return getDiscipline(disciplineId).startArmor;
  } catch {
    return undefined;
  }
}

/** Look of a freshly created merc (starting armor, lamplighters carry an oil lamp). */
export function lookFromSetup(setup: MercSetup): MercLook {
  const a = setup.appearance;
  return {
    discipline: asDiscipline(setup.discipline),
    body: a.body,
    skin: a.skin,
    hair: a.hair,
    hairColor: a.hairColor,
    primary: a.primary,
    secondary: a.secondary,
    headgear: a.headgear,
    marking: a.marking,
    armor: armorWeightOf(startArmorOf(setup.discipline)),
    lamp: setup.discipline === "lamplighter" ? "oil" : "none",
    weaponTier: 0,
  };
}

/** Look of a merc in play: armor, lamp and weapon tier come from its equipment. */
export function lookFromMerc(merc: Merc): MercLook {
  const a = merc.appearance;
  const weapon = merc.equipment.weapon;
  return {
    discipline: asDiscipline(merc.discipline),
    body: a.body,
    skin: a.skin,
    hair: a.hair,
    hairColor: a.hairColor,
    primary: a.primary,
    secondary: a.secondary,
    headgear: a.headgear,
    marking: a.marking,
    armor: armorWeightOf(merc.equipment.armor?.baseId),
    lamp: lampKindOf(merc.equipment.lamp?.baseId),
    weaponTier: weapon ? Math.max(0, RARITIES.indexOf(weapon.rarity)) : 0,
  };
}

function lookId(look: MercLook): string {
  return [
    look.discipline,
    look.body,
    look.skin,
    look.hair,
    look.hairColor,
    look.primary,
    look.secondary,
    look.headgear,
    look.marking,
    look.armor,
    look.lamp,
    look.weaponTier,
  ].join(".");
}

/** Stable texture key for a look + pose. */
export function mercTextureKey(look: MercLook, pose: MercPose): string {
  return `merc.${lookId(look)}.${pose}`;
}

/** Stable texture key for a look's 24x24 portrait. */
export function mercPortraitKey(look: MercLook): string {
  return `mercp.${lookId(look)}`;
}

/** Generate (once) and register the 48x48 sprite for `look` in `pose`. Returns its key. */
export function ensureMercTexture(scene: Phaser.Scene, look: MercLook, pose: MercPose): string {
  const key = mercTextureKey(look, pose);
  if (!scene.textures.exists(key))
    scene.textures
      .addCanvas(key, drawMerc(look, pose))
      ?.setFilter(Phaser.Textures.FilterMode.NEAREST);
  return key;
}

/** Generate (once) and register the 24x24 portrait for `look`. Returns its key. */
export function ensureMercPortrait(scene: Phaser.Scene, look: MercLook): string {
  const key = mercPortraitKey(look);
  if (!scene.textures.exists(key))
    scene.textures
      .addCanvas(key, drawMercPortrait(look))
      ?.setFilter(Phaser.Textures.FilterMode.NEAREST);
  return key;
}
