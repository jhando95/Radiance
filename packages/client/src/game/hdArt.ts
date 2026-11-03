/**
 * Adapter between game data and HD art. Uses the HD rig modules when they exist and falls
 * back gracefully (mannequin / pixel art), so scenes never care which art is available.
 */
import type { Merc, Unit } from "@radiance/core";
import * as Phaser from "phaser";
import { addHdTexture } from "../app/hires";
import type { EnemyArtId } from "../art/enemies";
import { buildMannequin } from "../art/hd/mannequin";
import type { RigDef } from "../art/hd/rig";
import { lookFromMerc, lookFromSetup } from "../art/look";
import type { MercLook } from "../art/mercs";
import { GAME_H } from "../ui/theme";
import { unitPortrait } from "./unitArt";

interface MercRigModule {
  buildMercRig(look: MercLook, opts?: { hostile?: boolean }): RigDef;
  mercPortraitHD(look: MercLook, opts?: { hostile?: boolean }): HTMLCanvasElement;
}
interface EnemyRigModule {
  buildEnemyRig(id: EnemyArtId): RigDef;
  enemyPortraitHD(id: EnemyArtId): HTMLCanvasElement;
}

// Optional modules (being authored); eager glob over exact paths only.
const mods = import.meta.glob<Record<string, unknown>>(
  ["../art/hd/mercRig.ts", "../art/hd/enemyRig.ts"],
  {
    eager: true,
  },
);
const mercMod = mods["../art/hd/mercRig.ts"] as unknown as MercRigModule | undefined;
const enemyMod = mods["../art/hd/enemyRig.ts"] as unknown as EnemyRigModule | undefined;

export const hasHdMercs = () => typeof mercMod?.buildMercRig === "function";
export const hasHdEnemies = () => typeof enemyMod?.buildEnemyRig === "function";

const fallbackCache = new Map<string, RigDef>();
function fallback(id: string, tint?: { fill: string; shade: string; deep: string }): RigDef {
  let def = fallbackCache.get(id);
  if (!def) {
    def = buildMannequin(id, tint);
    fallbackCache.set(id, def);
  }
  return def;
}

export function mercRigFromLook(look: MercLook): RigDef {
  return mercMod?.buildMercRig ? mercMod.buildMercRig(look) : fallback(`mq.${look.discipline}`);
}

export function enemyRig(id: string): RigDef {
  return enemyMod?.buildEnemyRig
    ? enemyMod.buildEnemyRig(id as EnemyArtId)
    : fallback(`mq.enemy.${id}`, { fill: "#82261f", shade: "#4d1518", deep: "#24090c" });
}

/** Rig for a combat unit (mercs use their persistent build for the look). */
export function unitRig(unit: Pick<Unit, "id" | "side" | "defId">, mercs: readonly Merc[]): RigDef {
  if (unit.side === "merc") {
    const merc = mercs.find((m) => m.id === unit.id);
    if (merc) return mercRigFromLook(lookFromMerc(merc));
  }
  return enemyRig(unit.defId);
}

export { lookFromMerc, lookFromSetup };

/** Portrait texture key; HD when available, else the pixel portrait. Display with `fitImage`. */
export function portraitTexture(
  scene: Phaser.Scene,
  unit: Pick<Unit, "id" | "side" | "defId">,
  mercs: readonly Merc[],
): string {
  if (unit.side === "merc" && mercMod?.mercPortraitHD) {
    const merc = mercs.find((m) => m.id === unit.id);
    if (merc) {
      const look = lookFromMerc(merc);
      const key = `hd.portrait.merc.${JSON.stringify(look)}`;
      if (!scene.textures.exists(key)) addHdTexture(scene, key, mercMod.mercPortraitHD(look));
      return key;
    }
  }
  if (unit.side === "enemy" && enemyMod?.enemyPortraitHD) {
    const key = `hd.portrait.enemy.${unit.defId}`;
    if (!scene.textures.exists(key))
      addHdTexture(scene, key, enemyMod.enemyPortraitHD(unit.defId as EnemyArtId));
    return key;
  }
  return unitPortrait(scene, unit, mercs);
}

/** Size any image to a logical square box regardless of its source resolution. */
export function fitImage<T extends Phaser.GameObjects.Image>(img: T, logicalSize: number): T {
  const f = img.frame;
  const k = logicalSize / Math.max(f.width, f.height);
  img.setScale(k);
  return img;
}

/** Scale a full-screen backdrop layer (pixel 320x180 or HD 1920x1080) to fill the screen. */
export function fitBackdrop(img: Phaser.GameObjects.Image): Phaser.GameObjects.Image {
  return img.setScale(GAME_H / img.frame.height);
}

export { Phaser };

/** Portrait texture for a look (squad builder / previews). HD when available. */
export function portraitForLook(
  scene: Phaser.Scene,
  look: MercLook,
  pixelFallback: () => string,
): string {
  if (!mercMod?.mercPortraitHD) return pixelFallback();
  const key = `hd.portrait.merc.${JSON.stringify(look)}`;
  if (!scene.textures.exists(key)) addHdTexture(scene, key, mercMod.mercPortraitHD(look));
  return key;
}
