import type { Merc, Unit } from "@radiance/core";
import type * as Phaser from "phaser";
import {
  drawEnemy,
  drawEnemyPortrait,
  type EnemyArtId,
  type EnemyPose,
  enemyFrame,
} from "../art/enemies";
import { ensureMercPortrait, ensureMercTexture, lookFromMerc } from "../art/look";
import { MERC_FRAME, type MercPose } from "../art/mercs";

export type UnitPose = "idle0" | "idle1" | "attack" | "cast" | "hurt" | "downed";

export interface UnitFrame {
  w: number;
  h: number;
  footY: number;
  centerX: number;
}

function add(scene: Phaser.Scene, key: string, make: () => HTMLCanvasElement): string {
  if (!scene.textures.exists(key)) scene.textures.addCanvas(key, make());
  return key;
}

export function enemyPose(pose: UnitPose): EnemyPose {
  if (pose === "cast") return "attack";
  if (pose === "downed") return "hurt";
  return pose;
}

/** Texture key for a combat unit in a pose. Mercs use their persistent build for the look. */
export function unitTexture(
  scene: Phaser.Scene,
  unit: Unit,
  mercs: readonly Merc[],
  pose: UnitPose,
): string {
  if (unit.side === "merc") {
    const merc = mercs.find((m) => m.id === unit.id);
    if (merc) return ensureMercTexture(scene, lookFromMerc(merc), pose as MercPose);
  }
  const id = unit.defId as EnemyArtId;
  const p = enemyPose(pose);
  return add(scene, `enemy.${id}.${p}`, () => drawEnemy(id, p));
}

export function unitPortrait(
  scene: Phaser.Scene,
  unit: Pick<Unit, "id" | "side" | "defId">,
  mercs: readonly Merc[],
): string {
  if (unit.side === "merc") {
    const merc = mercs.find((m) => m.id === unit.id);
    if (merc) return ensureMercPortrait(scene, lookFromMerc(merc));
  }
  const id = unit.defId as EnemyArtId;
  return add(scene, `enemy.${id}.portrait`, () => drawEnemyPortrait(id));
}

export function unitFrame(unit: Pick<Unit, "side" | "defId">): UnitFrame {
  if (unit.side === "merc") return MERC_FRAME;
  return enemyFrame(unit.defId as EnemyArtId);
}
