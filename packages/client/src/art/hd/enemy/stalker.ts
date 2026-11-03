/**
 * Umbral Stalker: a lean shadow predator, half mantis, half wolf. It walks on its folded
 * scythe forelimbs (blades hooked forward), digitigrade hind legs, a quilled spine, a curled
 * whip tail and a long eyeless wolf skull with three pale burning eye-slits.
 */
import type { Pt } from "../ink";
import type { RigDef } from "../rig";
import {
  assemble,
  type CStyle,
  cshape,
  eye,
  fang,
  glint,
  INK_COLOR,
  line,
  type PartSpec,
  rigGlows,
  rng,
  sblob,
  shadowPart,
  stube,
} from "./kit";

const PALE = "#dfe8ff";
const EYE_GLOW = "#b9ccff";
const COLD = "#a99be0";
const HIDE: CStyle = {
  fill: "#272036",
  shade: "#14101d",
  deep: "#060509",
  light: "#4a4064",
  hatch: { spacing: 4.5, alpha: 0.5 },
  rimBack: COLD,
  rimBackW: 3.2,
};
const HIDE_FAR: CStyle = {
  ...HIDE,
  fill: "#16121f",
  shade: "#0c0a12",
  light: "#2a2339",
  rimFront: false,
};
const BLADE: CStyle = {
  fill: "#2c2638",
  shade: "#17131f",
  deep: "#08070b",
  light: "#5a5070",
  hatch: { spacing: 4, alpha: 0.4 },
  rimBack: COLD,
};

function hind(far: boolean): PartSpec["draw"] {
  return (ctx) => {
    const st = far ? HIDE_FAR : HIDE;
    const knee: Pt = [26, 40];
    const hock: Pt = [-12, 86];
    const paw: Pt = [2, 124];
    cshape(ctx, stube([[0, -6], knee], [24, 15]), { ...st, depth: 14 });
    cshape(ctx, stube([knee, hock], [12, 7]), { ...st, depth: 6 });
    cshape(ctx, stube([hock, paw], [7, 6]), { ...st, depth: 4 });
    // hooked hind claws
    cshape(ctx, sblob([[paw[0] - 8, paw[1] - 6], [paw[0] + 14, paw[1] - 4], [paw[0] + 22, paw[1] + 6], [paw[0] - 10, paw[1] + 6]], 0.4), { ...st, depth: 4, outline: 2.6 });
    for (let i = 0; i < 2; i++) line(ctx, [[paw[0] + 14 + i * 4, paw[1]], [paw[0] + 26 + i * 4, paw[1] + 4]], 3.4, INK_COLOR, [0.1, 0.95]);
    // spur on the hock
    line(ctx, [hock, [hock[0] - 18, hock[1] - 10]], 5, INK_COLOR, [0.1, 0.95]);
  };
}

/** Upper forelimb (shoulder → elbow). */
function foreUpper(far: boolean): PartSpec["draw"] {
  return (ctx) => {
    cshape(ctx, stube([[0, -4], [16, 66]], [18, 10]), { ...(far ? HIDE_FAR : HIDE), depth: 10 });
    cshape(ctx, sblob([[8, 58], [26, 60], [24, 76], [8, 74]], 0.6), { ...(far ? HIDE_FAR : HIDE), depth: 5, outline: 2.6 });
  };
}

/** Forearm down to the ground knuckle, then the scythe hooking forward and up. */
function scythe(far: boolean): PartSpec["draw"] {
  return (ctx) => {
    const st = far ? HIDE_FAR : HIDE;
    const bst = far ? { ...BLADE, fill: "#1f1a28", light: "#3a3248", rimFront: false as const } : BLADE;
    // blade: thick spine curving forward, inner serrated edge pale
    const outer: Pt[] = [[-8, 92], [16, 98], [42, 86], [62, 58], [72, 20], [68, -18]];
    const inner: Pt[] = [[62, 0], [58, 30], [46, 56], [28, 74], [8, 82]];
    const blade = sblob([...outer, ...inner], 0.4);
    cshape(ctx, blade, {
      ...bst,
      depth: 10,
      detail: (c) => {
        line(c, [[8, 90], [36, 84], [54, 62], [64, 28]], 2, INK_COLOR, [0.1, 0.4], 0.7);
        if (!far) glint(c, 60, 40, 30, -1.3, "#cfc6ea", 2, 0.6);
      },
    });
    // pale honed inner edge with serrations
    const edge: Pt[] = [[66, -12], [60, 22], [48, 52], [30, 72], [10, 80]];
    line(ctx, edge, 4, far ? "#6f6888" : "#cfc8de", [0.05, 0.4], far ? 0.6 : 0.95);
    for (let i = 1; i < edge.length; i++) {
      const [x, y] = edge[i] as Pt;
      line(ctx, [[x, y], [x - 8, y - 3]], 3, INK_COLOR, [0.05, 0.95]);
    }
    // forearm
    cshape(ctx, stube([[0, 0], [-2, 50], [4, 92]], [10, 9, 12]), { ...st, depth: 6 });
    line(ctx, [[-6, 20], [6, 24]], 1.6, INK_COLOR, [0.2, 0.2], 0.7);
    line(ctx, [[-6, 50], [6, 52]], 1.6, INK_COLOR, [0.2, 0.2], 0.7);
  };
}

/** Overall scale: the stalker is drawn a touch larger so it holds its own at battle size. */
const K = 1.1;

export function buildUmbralStalker(): RigDef {
  const specs: PartSpec[] = [
    shadowPart(110, 12, 0.6, 0),
    {
      id: "hips",
      at: [-58, -138],
      z: 4,
      box: [-30, -30, 30, 30],
      draw: (ctx) => {
        cshape(ctx, sblob([[-24, -16], [14, -22], [24, 4], [4, 22], [-22, 14]]), { ...HIDE, depth: 14 });
      },
    },
    {
      id: "tail",
      parent: "hips",
      at: [-16, -8],
      z: 1,
      box: [-62, -112, 20, 20],
      draw: (ctx) => {
        const spine: Pt[] = [[0, 0], [-32, -18], [-48, -52], [-38, -86], [-18, -100]];
        cshape(ctx, stube(spine, [11, 8, 6, 3.5, 1]), { ...HIDE, depth: 8, outline: 3 });
        const r = rng(9);
        for (let i = 1; i < spine.length - 1; i++) {
          const [x, y] = spine[i] as Pt;
          line(ctx, [[x - 4, y], [x - 14 - r() * 6, y + 4 - r() * 8]], 3.5, INK_COLOR, [0.1, 0.95]);
        }
        // barbed tip
        line(ctx, [[-18, -100], [-4, -104], [6, -96]], 4, INK_COLOR, [0.1, 0.95]);
      },
    },
    { id: "hindFar", parent: "hips", at: [10, 4], z: 1, box: [-40, -32, 52, 146], draw: hind(true) },
    { id: "foreFarUp", parent: "body", at: [70, -18], z: 2, box: [-24, -24, 36, 84], draw: foreUpper(true) },
    { id: "foreFar", parent: "foreFarUp", at: [18, 52], z: 2, box: [-24, -30, 84, 104], draw: scythe(true) },
    {
      id: "body",
      parent: "hips",
      at: [0, 0],
      z: 5,
      box: [-44, -96, 116, 36],
      draw: (ctx) => {
        const s = sblob([
          [-30, 12],
          [-36, -12],
          [-10, -30],
          [26, -36],
          [60, -50],
          [88, -46],
          [100, -22],
          [86, 4],
          [50, 12],
          [14, 22],
        ]);
        cshape(ctx, s, {
          ...HIDE,
          depth: 24,
          hatch: { spacing: 4.5, alpha: 0.5, cross: true },
          detail: (c) => {
            // ribs showing through the taut hide
            for (let i = 0; i < 6; i++) {
              const x = 10 + i * 11;
              line(c, [[x, -22 - i * 2], [x + 6, -4], [x + 2, 12]], 2, INK_COLOR, [0.2, 0.5], 0.75);
              line(c, [[x + 3, -22 - i * 2], [x + 9, -6]], 1.2, "#4d4366", [0.2, 0.5], 0.6);
            }
            glint(c, 70, -42, 22, -0.1, "#b4a8de", 2, 0.5);
          },
        });
        // quills along the spine (shadow mane)
        const r = rng(4);
        for (let i = 0; i < 11; i++) {
          const t = i / 10;
          const x = -24 + t * 112;
          const y = -26 - Math.sin(t * Math.PI * 0.95) * 26;
          const len = 18 + Math.sin(t * Math.PI) * 26 + r() * 8;
          const a = -2.0 - t * 0.35 + (r() - 0.5) * 0.2;
          line(ctx, [[x + 6, y + 4], [x + Math.cos(a) * len * 0.5, y + Math.sin(a) * len * 0.5], [x + Math.cos(a - 0.15) * len, y + Math.sin(a - 0.15) * len]], 9 - t * 2, INK_COLOR, [0.05, 0.95]);
          line(ctx, [[x + 6, y + 2], [x + Math.cos(a) * len * 0.5, y + Math.sin(a) * len * 0.5 - 1]], 2, COLD, [0.05, 0.9], 0.55);
        }
      },
    },
    { id: "hindNear", parent: "hips", at: [-4, 6], z: 6, box: [-40, -32, 52, 146], draw: hind(false) },
    {
      id: "head",
      parent: "body",
      at: [92, -34],
      z: 8,
      box: [-40, -76, 120, 40],
      draw: (ctx) => {
        ctx.scale(1.18, 1.18);
        cshape(ctx, stube([[-18, 14], [10, -10], [24, -22]], [18, 14, 13]), { ...HIDE, depth: 10 });
        // long eyeless skull with swept-back horn-ears
        line(ctx, [[18, -34], [-4, -48], [-24, -54]], 9, INK_COLOR, [0.1, 0.95]);
        line(ctx, [[18, -36], [-4, -48]], 2.6, "#4d4366", [0.1, 0.9], 0.8);
        const skull = sblob([[6, -22], [26, -34], [52, -30], [84, -18], [94, -12], [66, -6], [30, -2], [10, -6]], 0.45);
        cshape(ctx, skull, {
          ...HIDE,
          depth: 12,
          detail: (c) => {
            line(c, [[24, -30], [46, -26], [76, -16]], 1.6, INK_COLOR, [0.2, 0.3], 0.7);
            glint(c, 50, -34, 22, 0.15, "#b4a8de", 2, 0.6);
          },
        });
        line(ctx, [[30, -40], [4, -54], [-14, -62]], 7, INK_COLOR, [0.1, 0.95]);
        // upper teeth
        for (let i = 0; i < 7; i++) fang(ctx, [34 + i * 7, -6], [35 + i * 7 - 1, 3 + (i % 2) * 2], 2.2, ["#26221f", "#47403a", "#8f8a9c", "#c9c3d6", "#e7e3f0"], 0, 1.1);
        eye(ctx, 50, -24, 5, 2, PALE, "#ffffff", 0.2, 0);
        eye(ctx, 40, -27, 3.4, 1.6, PALE, "#ffffff", 0.2, 0);
        eye(ctx, 60, -21, 2.6, 1.3, PALE, "#ffffff", 0.2, 0);
      },
    },
    {
      id: "jaw",
      parent: "head",
      at: [28, -2],
      z: 7,
      box: [-18, -18, 80, 32],
      draw: (ctx) => {
        ctx.scale(1.18, 1.18);
        cshape(ctx, sblob([[-6, -4], [30, -2], [58, -2], [52, 8], [24, 14], [0, 10]], 0.4), { ...HIDE, depth: 8 });
        for (let i = 0; i < 6; i++) fang(ctx, [16 + i * 7, -2], [17 + i * 7, -10 - (i % 2) * 2], 2, ["#26221f", "#47403a", "#8f8a9c", "#c9c3d6", "#e7e3f0"], 0, 1.1);
      },
    },
    { id: "foreNearUp", parent: "body", at: [80, -16], z: 9, box: [-24, -24, 36, 84], draw: foreUpper(false) },
    { id: "foreNear", parent: "foreNearUp", at: [18, 52], z: 10, box: [-24, -30, 84, 104], draw: scythe(false) },
  ];

  return {
    id: "enemy.umbralStalker",
    parts: assemble(specs, K),
    height: 238 * K,
    width: 220 * K,
    glows: rigGlows(specs, [{ part: "head", x: 59, y: -28, radius: 30, color: EYE_GLOW, alpha: 0.55 }], K),
    poses: {
      idle: {},
      breathe: {
        hips: { y: 2 },
        body: { rot: -1.5, sy: 1.02 },
        head: { rot: 4 },
        jaw: { rot: 5 },
        tail: { rot: 6 },
        foreNearUp: { rot: 1.5 },
        foreFarUp: { rot: 1.5 },
      },
      windup: {
        hips: { x: -12, y: 8, rot: -4 },
        body: { rot: -16 },
        head: { rot: 8 },
        jaw: { rot: 24 },
        tail: { rot: -14 },
        foreNearUp: { rot: -40 },
        foreNear: { rot: 70 },
        foreFarUp: { rot: 14 },
        hindNear: { rot: 8 },
        hindFar: { rot: 8 },
      },
      attack: {
        hips: { x: 40, y: 2, rot: 6 },
        body: { rot: 12 },
        head: { rot: -6 },
        jaw: { rot: 30 },
        tail: { rot: 18 },
        foreNearUp: { rot: -70 },
        foreNear: { rot: -40 },
        foreFarUp: { rot: -14 },
        hindNear: { rot: -24 },
        hindFar: { rot: -14 },
      },
      cast: {
        hips: { y: 4 },
        body: { rot: -10 },
        head: { rot: -26 },
        jaw: { rot: 34 },
        tail: { rot: -10 },
        foreNearUp: { rot: -20 },
        foreNear: { rot: 30 },
      },
      hurt: {
        hips: { x: -16, rot: -6 },
        body: { rot: -14 },
        head: { rot: -20 },
        jaw: { rot: 20 },
        tail: { rot: -20 },
        foreNearUp: { rot: 20 },
        foreFarUp: { rot: 16 },
        hindNear: { rot: 10 },
      },
      downed: {
        hips: { y: 84, rot: 4 },
        body: { rot: 10 },
        head: { rot: 34 },
        jaw: { rot: 26 },
        tail: { rot: -50 },
        hindNear: { rot: -62 },
        hindFar: { rot: -52 },
        foreNearUp: { rot: -40 },
        foreNear: { rot: 50 },
        foreFarUp: { rot: -30 },
        foreFar: { rot: 40 },
      },
    },
  };
}
