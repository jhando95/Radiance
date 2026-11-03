/**
 * Reference rig: a plain inked mannequin. It documents the rig conventions for HD artists
 * and is the fallback when a real rig isn't available. Facing right, ~300 render px tall.
 */
import { canvas, capsule, ctx2d, ellipse, shape } from "./ink";
import type { RigDef, RigPart } from "./rig";

const SKIN = {
  fill: "#9c6345",
  shade: "#6b3f2c",
  deep: "#3a2219",
  rim: { side: 1 as const, color: "#f2a93b" },
};
const CLOTH = {
  fill: "#46587a",
  shade: "#2c3850",
  deep: "#151a26",
  rim: { side: 1 as const, color: "#f2a93b" },
};

function part(
  id: string,
  w: number,
  h: number,
  draw: (ctx: CanvasRenderingContext2D) => void,
  pivot: [number, number],
  parent: string | null,
  at: [number, number],
  z: number,
): RigPart {
  const c = canvas(w, h);
  draw(ctx2d(c));
  return { id, canvas: c, pivot, parent, at, z };
}

const limb = (w: number, h: number, style: typeof SKIN) => (ctx: CanvasRenderingContext2D) =>
  shape(
    ctx,
    capsule(w / 2, w / 2, w / 2, h - w / 2, w / 2 - 3, w / 2 - 5),
    { ...style, hatch: {}, outline: 3.5 },
    {
      x: 0,
      y: 0,
      w,
      h,
    },
  );

export function buildMannequin(
  id = "mannequin",
  tint?: { fill: string; shade: string; deep: string },
): RigDef {
  const cloth = tint ? { ...CLOTH, ...tint } : CLOTH;
  const parts: RigPart[] = [
    // Legs hang from the pelvis (root part at hip height).
    part(
      "pelvis",
      70,
      50,
      (ctx) =>
        shape(
          ctx,
          ellipse(35, 25, 30, 20),
          { ...cloth, outline: 3.5 },
          { x: 0, y: 0, w: 70, h: 50 },
        ),
      [35, 25],
      null,
      [0, -140],
      3,
    ),
    part("legBack", 34, 140, limb(34, 140, cloth), [17, 12], "pelvis", [24, 30], 1),
    part("legFront", 34, 140, limb(34, 140, cloth), [17, 12], "pelvis", [46, 30], 4),
    part(
      "torso",
      90,
      120,
      (ctx) =>
        shape(
          ctx,
          capsule(45, 30, 45, 92, 36, 30),
          { ...cloth, hatch: {}, outline: 4 },
          { x: 0, y: 0, w: 90, h: 120 },
        ),
      [45, 105],
      "pelvis",
      [35, 18],
      5,
    ),
    part(
      "head",
      70,
      76,
      (ctx) =>
        shape(ctx, ellipse(35, 38, 28, 33), { ...SKIN, outline: 4 }, { x: 0, y: 0, w: 70, h: 76 }),
      [35, 70],
      "torso",
      [48, 14],
      8,
    ),
    part("armBack", 30, 110, limb(30, 110, SKIN), [15, 12], "torso", [30, 26], 2),
    part("armFront", 30, 110, limb(30, 110, SKIN), [15, 12], "torso", [60, 26], 9),
  ];
  return {
    id,
    parts,
    width: 120,
    height: 300,
    poses: {
      idle: {},
      breathe: {
        torso: { sy: 1.02, rot: -1 },
        head: { rot: 2 },
        armFront: { rot: 3 },
        armBack: { rot: -2 },
      },
      windup: { torso: { rot: -10 }, armFront: { rot: 140 }, head: { rot: -6 }, pelvis: { x: -8 } },
      attack: {
        torso: { rot: 14 },
        armFront: { rot: -80 },
        legFront: { rot: -20 },
        pelvis: { x: 24 },
      },
      cast: {
        armFront: { rot: -150 },
        armBack: { rot: -120 },
        head: { rot: -10 },
        torso: { rot: -4 },
      },
      hurt: { torso: { rot: -16 }, head: { rot: -14 }, pelvis: { x: -18 }, armFront: { rot: 30 } },
      downed: {
        pelvis: { rot: -88, y: 112, x: -40 },
        legFront: { rot: 10 },
        armFront: { rot: 40 },
      },
    },
  };
}
