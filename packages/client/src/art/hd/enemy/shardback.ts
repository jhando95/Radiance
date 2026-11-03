/**
 * Shardback: a heavy, low crystal beetle-tortoise. A domed carapace of fractured rock plates
 * with cyan crystal shards jutting from the ridge, stubby pillar legs with claws and a wedge
 * head with a hooked beak and a crystal nose-horn.
 */
import { RAMPS } from "../../palette";
import type { Pt } from "../ink";
import type { RigDef } from "../rig";
import {
  assemble,
  bloom,
  type CStyle,
  crack,
  cshape,
  eye,
  fang,
  flat,
  glint,
  INK_COLOR,
  line,
  type PartSpec,
  rigGlows,
  rng,
  sblob,
  scuffs,
  shadowPart,
  shard,
  spoly,
  stube,
} from "./kit";

const CYAN = RAMPS.crystal[4];
const ROCK: CStyle = {
  fill: "#3d3b4b",
  shade: "#24222e",
  deep: "#0f0e15",
  light: "#5f5c72",
  hatch: { spacing: 5, alpha: 0.45 },
  grain: { color: "#0f0e15", alpha: 0.4, density: 0.01, seed: 2, size: 1.3 },
};
const ROCK_FAR: CStyle = {
  ...ROCK,
  fill: "#2a2834",
  shade: "#191821",
  deep: "#09080d",
  light: "#3d3b4b",
  rimFront: false,
};
const HIDE: CStyle = {
  fill: "#2e2b3a",
  shade: "#1b1924",
  deep: "#0b0a10",
  light: "#4a4660",
  hatch: { spacing: 4.5, alpha: 0.45 },
};

function leg(far: boolean, toe: number): PartSpec["draw"] {
  return (ctx) => {
    const st = far ? ROCK_FAR : ROCK;
    cshape(ctx, stube([[0, -6], [6, 30], [4, 54]], [22, 19, 17]), {
      ...(far ? { ...HIDE, fill: "#211f2a", light: "#2e2b3a", rimFront: false as const } : HIDE),
      depth: 14,
      detail: (c) => {
        line(c, [[-14, 22], [0, 26], [18, 22]], 1.8, INK_COLOR, [0.2, 0.2], 0.7);
        line(c, [[-14, 38], [2, 42], [18, 38]], 1.8, INK_COLOR, [0.2, 0.2], 0.7);
      },
    });
    // scaled rock armour on the front of the leg
    cshape(ctx, spoly([[-6, -8], [22, -2], [24, 26], [8, 34], [-4, 18]]), { ...st, depth: 10 });
    // clawed foot
    cshape(ctx, sblob([[-20, 50], [20, 48], [28, 62], [-22, 64]], 0.4), { ...HIDE, depth: 8 });
    for (let i = 0; i < 3; i++) {
      const x = -6 + i * 12 + toe;
      fang(ctx, [x, 58], [x + 9, 66], 4.5, RAMPS.bone, -0.1, 1.8);
    }
  };
}

export function buildShardback(): RigDef {
  const shellPts: Pt[] = [
    [62, 8],
    [52, -34],
    [22, -64],
    [-24, -78],
    [-70, -66],
    [-100, -32],
    [-108, 4],
    [-84, 20],
    [-30, 24],
    [24, 22],
  ];
  const crystalsBack: [Pt, Pt, number][] = [
    [[-84, -40], [-110, -92], 9],
    [[-66, -60], [-84, -124], 12],
    [[-38, -72], [-42, -146], 15],
    [[-12, -74], [4, -128], 12],
    [[14, -62], [38, -102], 9],
    [[-52, -64], [-60, -104], 7],
    [[0, -70], [-12, -108], 7],
  ];

  const specs: PartSpec[] = [
    shadowPart(118, 14, 0.65, -4),
    {
      id: "body",
      at: [-12, -62],
      z: 4,
      box: [-96, -30, 80, 36],
      draw: (ctx) => {
        cshape(ctx, sblob([[-88, -4], [-40, -18], [40, -20], [72, -2], [50, 22], [-20, 26], [-80, 16]]), {
          ...HIDE,
          depth: 18,
          detail: (c) => {
            for (let x = -70; x < 60; x += 16) line(c, [[x, -6], [x + 4, 20]], 1.6, INK_COLOR, [0.2, 0.2], 0.6);
          },
        });
      },
    },
    { id: "legFarBack", parent: "body", at: [-50, -4], z: 1, box: [-30, -20, 44, 70], draw: leg(true, 0) },
    { id: "legFarFront", parent: "body", at: [50, -4], z: 2, box: [-30, -20, 44, 70], draw: leg(true, 4) },
    {
      id: "shell",
      parent: "body",
      at: [-6, -4],
      z: 6,
      box: [-118, -90, 74, 34],
      draw: (ctx) => {
        const sh = sblob(shellPts, 0.42);
        cshape(ctx, sh, {
          ...ROCK,
          depth: 34,
          hatch: { spacing: 5, alpha: 0.5, cross: true },
          detail: (c) => {
            // fractured plates: dark seams with lit upper lips
            const seams: Pt[][] = [
              [[-100, -6], [-70, -18], [-40, -10], [-6, -16], [30, -10], [58, -14]],
              [[-80, -50], [-58, -30], [-70, -18]],
              [[-50, -72], [-36, -42], [-40, -10]],
              [[-6, -76], [-2, -44], [-6, -16]],
              [[30, -56], [22, -32], [30, -10]],
              [[-58, -30], [-36, -42], [-2, -44], [22, -32], [48, -36]],
            ];
            for (const sm of seams) {
              line(c, sm, 3.2, INK_COLOR, [0.1, 0.1]);
              line(c, sm.map(([x, y]) => [x + 1, y - 3] as Pt), 1.4, "#7a7690", [0.15, 0.15], 0.55);
            }
            const r = rng(14);
            crack(c, r, -86, -36, 0.8, 26, 2, INK_COLOR, 1);
            crack(c, r, 4, -32, 1.2, 22, 2, INK_COLOR, 1);
            crack(c, r, -30, 4, -0.6, 20, 1.8, INK_COLOR, 1);
            scuffs(c, 21, -100, -76, 160, 96, 30, "#8d89a3");
            // crystal veins glowing through the cracks
            line(c, [[-60, -26], [-48, -20], [-36, -24]], 2.4, CYAN, [0.2, 0.2], 0.7);
            line(c, [[10, -24], [20, -20]], 2, CYAN, [0.2, 0.2], 0.6);
            glint(c, 6, -64, 30, 0.35, "#b9b5cc", 2.4, 0.55);
          },
        });
        // shell rim lip
        line(ctx, [[-104, 10], [-60, 20], [0, 22], [56, 12]], 4, INK_COLOR, [0.1, 0.1]);
        line(ctx, [[-100, 8], [-60, 17], [0, 19], [52, 10]], 1.6, "#5f5c72", [0.1, 0.1], 0.7);
      },
    },
    {
      id: "crystalsBack",
      parent: "shell",
      at: [0, 0],
      z: 5,
      box: [-128, -160, 56, 0],
      draw: (ctx) => {
        for (const [b, t, w] of crystalsBack) {
          bloom(ctx, t[0] * 0.6 + b[0] * 0.4, t[1] * 0.6 + b[1] * 0.4, w * 3, CYAN, 0.22);
          shard(ctx, b, t, w, RAMPS.crystal, 3);
        }
      },
    },
    {
      id: "crystalsFront",
      parent: "shell",
      at: [0, 0],
      z: 7,
      box: [-110, -110, 70, 10],
      draw: (ctx) => {
        // stubby shards breaking through the side plates
        const small: [Pt, Pt, number][] = [
          [[-76, -24], [-96, -48], 7],
          [[-24, -36], [-24, -64], 8],
          [[34, -36], [52, -58], 6],
        ];
        for (const [b, t, w] of small) {
          flat(ctx, sblob([[b[0] - w - 4, b[1] + 2], [b[0], b[1] - 4], [b[0] + w + 4, b[1] + 2], [b[0], b[1] + 6]], 0.6), INK_COLOR);
          shard(ctx, b, t, w, RAMPS.crystal, 2.6);
        }
      },
    },
    { id: "legBack", parent: "body", at: [-62, 2], z: 8, box: [-30, -20, 44, 70], draw: leg(false, 0) },
    { id: "legFront", parent: "body", at: [40, 2], z: 9, box: [-30, -20, 44, 70], draw: leg(false, 6) },
    {
      id: "head",
      parent: "body",
      at: [58, -6],
      z: 10,
      box: [-22, -46, 80, 28],
      draw: (ctx) => {
        const h = sblob([[-14, -22], [18, -30], [46, -20], [64, -4], [56, 8], [28, 14], [-10, 14]], 0.4);
        cshape(ctx, h, { ...HIDE, depth: 14 });
        // heavy brow plate
        const brow = spoly([[-16, -26], [20, -36], [50, -24], [56, -12], [30, -14], [6, -8], [-14, -12]]);
        cshape(ctx, brow, {
          ...ROCK,
          depth: 10,
          detail: (c) => {
            line(c, [[14, -32], [18, -14]], 2, INK_COLOR, [0.1, 0.1], 0.8);
            glint(c, 30, -28, 16, 0.3, "#b9b5cc", 2, 0.6);
          },
        });
        shard(ctx, [44, -22], [58, -44], 6, RAMPS.crystal, 2.4);
        // hooked upper beak
        cshape(ctx, sblob([[48, -6], [66, -6], [74, 6], [66, 14], [56, 6]], 0.4), { ...ROCK, depth: 6, outline: 2.8 });
        eye(ctx, 34, -6, 3.6, 2.6, CYAN, "#e8fffb", 0, 18);
      },
    },
    {
      id: "jaw",
      parent: "head",
      at: [20, 8],
      z: 9,
      box: [-14, -10, 56, 30],
      draw: (ctx) => {
        cshape(ctx, sblob([[-6, -2], [32, 0], [46, 6], [36, 18], [4, 16]], 0.4), { ...ROCK, depth: 8 });
        for (let i = 0; i < 3; i++) fang(ctx, [24 + i * 7, 2], [26 + i * 7, -5], 2.4, RAMPS.bone, 0, 1.2);
      },
    },
  ];

  return {
    id: "enemy.shardback",
    parts: assemble(specs),
    height: 214,
    width: 240,
    glows: rigGlows(specs, [
      { part: "crystalsBack", x: -42, y: -120, radius: 60, color: CYAN, alpha: 0.3 },
      { part: "crystalsBack", x: -84, y: -100, radius: 40, color: CYAN, alpha: 0.25 },
      { part: "head", x: 34, y: -6, radius: 22, color: CYAN, alpha: 0.5 },
    ]),
    poses: {
      idle: {},
      breathe: {
        body: { y: 1 },
        shell: { y: -3, sy: 1.015 },
        head: { rot: 3, x: 1 },
        jaw: { rot: 6 },
        legFront: { rot: -1 },
      },
      windup: {
        body: { x: -16, y: -6, rot: -7 },
        shell: { rot: -2 },
        head: { rot: -16 },
        jaw: { rot: 18 },
        legFront: { rot: 10 },
        legFarFront: { rot: 10 },
        legBack: { rot: 4 },
        legFarBack: { rot: 4 },
      },
      attack: {
        body: { x: 36, y: 2, rot: 6 },
        shell: { rot: 2 },
        head: { rot: 16 },
        jaw: { rot: 2 },
        legFront: { rot: -18 },
        legFarFront: { rot: -12 },
        legBack: { rot: -16 },
        legFarBack: { rot: -10 },
      },
      cast: {
        body: { y: -4, rot: -4 },
        shell: { rot: -3 },
        crystalsBack: { sx: 1.06, sy: 1.1 },
        crystalsFront: { sx: 1.1, sy: 1.1 },
        head: { rot: -22 },
        jaw: { rot: 28 },
        legFront: { rot: 4 },
      },
      hurt: {
        body: { x: -14, rot: -6 },
        shell: { rot: -2 },
        head: { rot: -18 },
        jaw: { rot: 20 },
        legFront: { rot: 8 },
        legBack: { rot: 6 },
      },
      downed: {
        body: { y: 30, rot: 4 },
        shell: { rot: 3 },
        head: { rot: 34, y: 10 },
        jaw: { rot: 20 },
        legFront: { rot: -64 },
        legFarFront: { rot: -56 },
        legBack: { rot: 60 },
        legFarBack: { rot: 52 },
      },
    },
  };
}
