/**
 * Husks: reanimated dead miners. The Husk Miner is a hunched corpse in a ragged hazard suit
 * with a cracked hardhat and dead headlamp, dragging a pickaxe; the Husk Foreman is a bloated
 * giant strapped into a rusted exo-frame with a hydraulic drill-arm and fume tanks.
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
  hatch,
  INK_COLOR,
  line,
  type PartSpec,
  rigGlows,
  rng,
  sblob,
  scuffs,
  streaks,
  scaps,
  sell,
  shadowPart,
  spoly,
  stube,
} from "./kit";

const TOXIC_EYE = RAMPS.toxic[4];

const SKIN: CStyle = {
  fill: "#78826a",
  shade: "#4b5343",
  deep: "#252a22",
  light: "#a2aa8b",
  hatch: true,
  grain: { color: "#3b2a3a", alpha: 0.35, density: 0.006, seed: 3 },
};
const SKIN_DARK: CStyle = {
  ...SKIN,
  fill: "#5a6250",
  shade: "#383f33",
  deep: "#1b1f19",
  light: "#7d8669",
};
const SUIT: CStyle = {
  fill: "#6a5038",
  shade: "#3f2e21",
  deep: "#1a120d",
  light: "#8a6c4c",
  hatch: { spacing: 5, alpha: 0.45 },
  grain: { color: "#160e09", alpha: 0.3, density: 0.008, seed: 11 },
};
const SUIT_DARK: CStyle = {
  ...SUIT,
  fill: "#4a3828",
  shade: "#2e2219",
  deep: "#130d09",
  light: "#5f4733",
};
const HAT: CStyle = {
  fill: "#968039",
  shade: "#5e4c22",
  deep: "#2a200d",
  light: "#c4ad62",
  hatch: true,
  grain: { color: "#3b2a12", alpha: 0.35, density: 0.01, seed: 5 },
};
const LEATHER: CStyle = {
  fill: RAMPS.leather[2],
  shade: RAMPS.leather[1],
  deep: RAMPS.leather[0],
  light: RAMPS.leather[3],
  hatch: true,
};
const RUSTY_STEEL: CStyle = {
  fill: "#5d5f66",
  shade: "#383a42",
  deep: "#18191e",
  light: "#8e8f96",
  hatch: true,
  grain: { color: "#5a2f20", alpha: 0.35, density: 0.008, seed: 21, size: 1.4 },
};
const RUST_PLATE: CStyle = {
  fill: "#6d3d29",
  shade: "#43251a",
  deep: "#1d0f0b",
  light: "#9a5a3a",
  hatch: { spacing: 5, alpha: 0.45 },
  grain: { color: "#1d0f0b", alpha: 0.4, density: 0.01, seed: 9, size: 1.4 },
};

/** Ragged hem points from a→b with jagged teeth hanging by `amp`. */
function ragged(a: Pt, b: Pt, n: number, amp: number, seed: number): Pt[] {
  const r = rng(seed);
  const out: Pt[] = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const x = a[0] + (b[0] - a[0]) * t;
    const y = a[1] + (b[1] - a[1]) * t;
    out.push([x, y + (i % 2 === 1 ? amp * (0.5 + r()) : r() * amp * 0.3)]);
  }
  return out;
}

function rivets(ctx: CanvasRenderingContext2D, pts: readonly Pt[], r = 2.4): void {
  for (const [x, y] of pts) {
    ctx.fillStyle = INK_COLOR;
    ctx.beginPath();
    ctx.arc(x, y, r + 1, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#9a9097";
    ctx.beginPath();
    ctx.arc(x - 0.6, y - 0.6, r * 0.6, 0, Math.PI * 2);
    ctx.fill();
  }
}

function veins(ctx: CanvasRenderingContext2D, seed: number, x: number, y: number, w: number, h: number, n = 3): void {
  const r = rng(seed);
  for (let i = 0; i < n; i++) {
    crack(ctx, r, x + r() * w, y + r() * h, Math.PI * (0.3 + r() * 0.5), Math.min(w, h) * 0.6, 1.4, "#3a2440", 1);
  }
}

// ===========================================================================================
// Husk Miner
// ===========================================================================================

export function buildHuskMiner(): RigDef {
  const leg = (front: boolean): PartSpec["draw"] => (ctx) => {
    const st = front ? SUIT : SUIT_DARK;
    const knee: Pt = front ? [30, 42] : [12, 46];
    const ankle: Pt = front ? [14, 86] : [-10, 86];
    const s = stube([[0, -4], knee, ankle], [19, 15, 11]);
    cshape(ctx, s, {
      ...st,
      detail: (c) => {
        // torn knee showing grey flesh
        flat(c, sblob([[knee[0] - 6, knee[1] - 10], [knee[0] + 12, knee[1] - 8], [knee[0] + 10, knee[1] + 6], [knee[0] - 4, knee[1] + 4]], 0.5), front ? "#4b5343" : "#323829");
        line(c, ragged([knee[0] - 8, knee[1] - 10], [knee[0] + 14, knee[1] - 8], 4, 4, front ? 61 : 62), 1.8);
        line(c, [[-8, 10], [2, 26], [knee[0] - 6, knee[1] - 14]], 1.4, INK_COLOR, [0.2, 0.3], 0.6);
        streaks(c, front ? 71 : 72, -16, 0, 40, 60, 5, "#1a120d", 0.4);
      },
    });
    const cuff = spoly([
      [ankle[0] - 13, ankle[1] - 14],
      [ankle[0] + 13, ankle[1] - 14],
      ...ragged([ankle[0] + 13, ankle[1] - 3], [ankle[0] - 13, ankle[1] - 3], 6, 7, front ? 4 : 5),
    ]);
    cshape(ctx, cuff, { ...st, depth: 6, rimFront: false });
    const toe = front ? 30 : 18;
    const boot = sblob([
      [ankle[0] - 12, ankle[1] - 6],
      [ankle[0] + 8, ankle[1] - 7],
      [ankle[0] + toe - 4, ankle[1] + 1],
      [ankle[0] + toe, ankle[1] + 10],
      [ankle[0] - 16, ankle[1] + 10],
    ], 0.3);
    cshape(ctx, boot, { ...LEATHER, fill: front ? RAMPS.leather[1] : RAMPS.leather[0], light: RAMPS.leather[2], depth: 6 });
    line(ctx, [[ankle[0] - 16, ankle[1] + 7], [ankle[0] + toe, ankle[1] + 7]], 1.6, RAMPS.leather[3], [0.1, 0.1], 0.45);
  };

  const specs: PartSpec[] = [
    shadowPart(84, 12, 0.6, 18),
    {
      id: "pelvis",
      at: [-8, -102],
      z: 3,
      box: [-40, -30, 44, 34],
      draw: (ctx) => {
        cshape(ctx, sblob([[-30, -14], [26, -16], [34, 8], [10, 22], [-26, 20]]), SUIT);
        cshape(ctx, spoly([[-32, -12], [34, -14], [35, -3], [-33, 0]]), { ...LEATHER, depth: 5 });
        cshape(ctx, spoly([[6, -15], [18, -15], [18, -2], [6, -1]]), { ...RUSTY_STEEL, depth: 4, outline: 2.5 });
        cshape(ctx, sblob([[-34, -4], [-18, -4], [-16, 18], [-34, 18]], 0.2), { ...LEATHER, fill: RAMPS.leather[1], depth: 6 });
      },
    },
    { id: "legBack", parent: "pelvis", at: [-8, 6], z: 1, box: [-36, -26, 44, 104], draw: leg(false) },
    { id: "legFront", parent: "pelvis", at: [10, 6], z: 6, box: [-30, -26, 60, 104], draw: leg(true) },
    {
      id: "torso",
      parent: "pelvis",
      at: [0, -4],
      z: 5,
      box: [-50, -120, 86, 26],
      draw: (ctx) => {
        const body = sblob([
          [-22, 8],
          [-34, -18],
          [-38, -52],
          [-26, -84],
          [0, -102],
          [30, -106],
          [56, -96],
          [74, -78],
          [66, -56],
          [48, -32],
          [30, -4],
        ]);
        cshape(ctx, body, {
          ...SUIT,
          depth: 30,
          hatch: { spacing: 5, alpha: 0.5, cross: true },
          detail: (c) => {
            // tear across the hump exposing grey flesh and spine knuckles
            const tear = sblob([[-32, -62], [-20, -86], [2, -100], [6, -86], [-12, -70], [-26, -50]], 0.4);
            cshape(c, tear, { ...SKIN_DARK, depth: 8, outline: 2.5, rimFront: false });
            for (let i = 0; i < 4; i++) {
              const x = -26 + i * 8;
              const y = -58 - i * 9;
              flat(c, sell(x, y, 4.5, 3.2, -0.9), "#8d9680");
              line(c, [[x - 4, y + 3], [x + 3, y + 3]], 1.4);
            }
            line(c, ragged([-34, -60], [4, -102], 7, 3, 81), 2.4);
            // dulled, torn reflective stripe
            const stripe = spoly([[-36, -30], [58, -46], [62, -36], [-36, -20]]);
            flat(c, stripe, "#77735c");
            hatch(c, stripe, 0.5, 4, 0.4);
            line(c, [[-36, -30], [58, -46]], 1.6);
            line(c, [[-36, -20], [62, -36]], 1.6);
            flat(c, sblob([[10, -44], [22, -46], [20, -30], [12, -32]], 0.5), SUIT.fill, 1);
            // fold lines
            line(c, [[48, -92], [36, -74], [40, -58]], 1.8, INK_COLOR, [0.2, 0.4], 0.8);
            line(c, [[-6, -6], [8, -16], [26, -18]], 1.6, INK_COLOR, [0.2, 0.4], 0.7);
            // harness strap
            cshape(c, spoly([[44, -102], [56, -98], [16, 4], [4, 2]]), { ...LEATHER, depth: 5, outline: 2.5 });
            streaks(c, 91, -30, -80, 90, 90, 8, "#1a120d", 0.35);
            glint(c, 58, -90, 14, -0.7, "#e0c9a0", 2, 0.45);
          },
        });
        const hem = spoly([[-24, -6], [32, -6], ...ragged([32, 6], [-24, 6], 8, 12, 7)]);
        cshape(ctx, hem, { ...SUIT, depth: 8 });
      },
    },
    {
      id: "armBack",
      parent: "torso",
      at: [40, -92],
      z: 4,
      box: [-24, -20, 70, 132],
      draw: (ctx) => {
        cshape(ctx, stube([[0, 0], [12, 46]], [15, 11]), SUIT_DARK);
        cshape(ctx, stube([[12, 42], [26, 80], [34, 92]], [9, 7, 6]), {
          ...SKIN_DARK,
          detail: (c) => veins(c, 17, 10, 44, 20, 40, 2),
        });
        for (let i = 0; i < 4; i++) {
          const pts: Pt[] = [[30 + i * 2, 90], [36 + i * 3, 104 + i * 2], [34 + i * 5, 116 + i * 1.5]];
          line(ctx, pts, 5, INK_COLOR, [0.1, 0.85]);
          line(ctx, pts, 2.4, "#5a6250", [0.1, 0.8]);
        }
        const cuff = spoly([[0, 32], [24, 30], ...ragged([26, 46], [2, 48], 5, 8, 12)]);
        cshape(ctx, cuff, { ...SUIT_DARK, depth: 6 });
      },
    },
    {
      id: "head",
      parent: "torso",
      at: [68, -76],
      z: 8,
      box: [-26, -76, 80, 36],
      draw: (ctx) => {
        cshape(ctx, stube([[-8, 8], [12, -8]], [13, 11]), SKIN_DARK);
        line(ctx, [[-4, 4], [8, -6]], 1.4, INK_COLOR, [0.2, 0.2], 0.7);
        const skull = sblob([
          [-8, -16],
          [8, -34],
          [36, -32],
          [52, -18],
          [58, -6],
          [52, 0],
          [46, 6],
          [26, 10],
          [6, 6],
          [-6, -4],
        ], 0.45);
        cshape(ctx, skull, {
          ...SKIN,
          depth: 14,
          detail: (c) => {
            flat(c, sblob([[28, -20], [46, -22], [48, -8], [32, -6]], 0.5), SKIN.deep as string);
            flat(c, sblob([[20, -2], [38, -4], [40, 6], [24, 8]], 0.5), SKIN.shade as string, 0.9);
            line(c, [[18, -6], [30, 4], [44, 2]], 1.6);
            flat(c, sblob([[50, -12], [56, -8], [52, -2]], 0.5), INK_COLOR);
            veins(c, 8, 0, -24, 26, 20, 3);
            flat(c, sblob([[4, -14], [16, -16], [14, -4], [6, -4]], 0.5), "#5d4a62", 0.5);
          },
        });
        for (let i = 0; i < 4; i++) fang(ctx, [35 + i * 5, 4], [36 + i * 5, 11], 2.2, RAMPS.bone, 0, 1.2);
        eye(ctx, 39, -13, 4.5, 3, TOXIC_EYE, "#efffd0", -0.2, 26);
        const dome = sblob([[-12, -24], [-6, -46], [16, -60], [40, -54], [52, -34], [50, -24]], 0.5);
        cshape(ctx, dome, {
          ...HAT,
          depth: 16,
          detail: (c) => {
            line(c, [[18, -60], [14, -26]], 3, HAT.shade as string, [0.1, 0.1], 0.9);
            crack(c, rng(31), 30, -56, 1.9, 26, 2.2, INK_COLOR, 2);
            scuffs(c, 33, -8, -56, 56, 30, 14, "#e8d9a0");
            streaks(c, 34, -8, -50, 56, 26, 5, "#2a200d", 0.45);
            glint(c, 30, -51, 14, -0.3, "#fff1c0", 2.2, 0.55);
          },
        });
        cshape(ctx, spoly([[-18, -26], [64, -27], [66, -19], [-16, -18]]), { ...HAT, depth: 5, outline: 3 });
        cshape(ctx, sblob([[42, -48], [56, -50], [61, -38], [46, -33]], 0.4), { ...RUSTY_STEEL, depth: 6, outline: 2.5 });
        flat(ctx, sell(59, -42, 4.2, 6.8), INK_COLOR);
        flat(ctx, sell(59.5, -42, 3, 5.6), "#262c36");
        line(ctx, [[57, -47], [61, -40], [58, -36]], 1.2, "#8ea2b0", [0.1, 0.1], 0.8);
        glint(ctx, 60, -45, 4, 1.4, "#d6e4f0", 1.4, 0.7);
      },
    },
    {
      id: "jaw",
      parent: "head",
      at: [14, 4],
      z: 7,
      box: [-14, -12, 46, 34],
      draw: (ctx) => {
        const jaw = sblob([[-6, -4], [16, 0], [36, 2], [40, 10], [32, 18], [10, 16], [-4, 8]], 0.4);
        cshape(ctx, jaw, { ...SKIN_DARK, depth: 8 });
        for (let i = 0; i < 4; i++) fang(ctx, [22 + i * 5, 4], [23 + i * 5, -3], 2, RAMPS.bone, 0, 1.1);
        line(ctx, [[12, 14], [10, 22], [12, 30]], 2, "#4b5343", [0.1, 0.6]);
        line(ctx, [[24, 16], [25, 24]], 1.6, "#4b5343", [0.1, 0.6]);
      },
    },
    {
      id: "armFront",
      parent: "torso",
      at: [50, -86],
      z: 9,
      box: [-22, -22, 30, 64],
      draw: (ctx) => {
        cshape(ctx, stube([[0, 0], [-2, 46]], [18, 13]), {
          ...SUIT,
          detail: (c) => {
            line(c, [[-10, 10], [0, 20], [10, 16]], 1.5, INK_COLOR, [0.2, 0.2], 0.7);
            line(c, [[-12, 28], [-2, 36], [10, 32]], 1.5, INK_COLOR, [0.2, 0.2], 0.7);
          },
        });
      },
    },
    {
      id: "foreFront",
      parent: "armFront",
      at: [-2, 46],
      z: 11,
      box: [-22, -18, 34, 66],
      draw: (ctx) => {
        cshape(ctx, stube([[0, 0], [4, 22], [8, 38]], [12, 10, 9]), {
          ...SKIN,
          detail: (c) => veins(c, 14, -6, 0, 18, 34, 2),
        });
        const cuff = spoly([[-13, -10], [13, -10], ...ragged([12, 8], [-14, 6], 4, 8, 3)]);
        cshape(ctx, cuff, { ...SUIT, depth: 6 });
        cshape(ctx, sblob([[-2, 36], [14, 36], [20, 48], [12, 58], [0, 54]], 0.5), { ...SKIN, depth: 8 });
        line(ctx, [[8, 40], [10, 56]], 1.4);
        line(ctx, [[14, 42], [16, 54]], 1.4);
      },
    },
    {
      id: "pick",
      parent: "foreFront",
      at: [10, 46],
      z: 10,
      box: [-50, -40, 64, 110],
      draw: (ctx) => {
        cshape(ctx, scaps(-6, -30, 14, 84, 5, 6), {
          fill: RAMPS.leather[3],
          shade: RAMPS.leather[2],
          deep: RAMPS.leather[1],
          light: RAMPS.leather[4],
          depth: 5,
          outline: 3,
          detail: (c) => {
            for (let y = -24; y < 76; y += 13) line(c, [[-4 + y * 0.17, y], [10 + y * 0.17, y + 4]], 1.2, INK_COLOR, [0.2, 0.2], 0.5);
          },
        });
        // heavy curved pick head; spike digs into the floor in front
        const head = sblob([
          [-40, 62],
          [-14, 72],
          [10, 78],
          [30, 86],
          [48, 104],
          [26, 96],
          [6, 94],
          [-18, 88],
          [-42, 72],
        ], 0.35);
        cshape(ctx, head, {
          ...RUSTY_STEEL,
          depth: 8,
          detail: (c) => {
            scuffs(c, 41, -40, 60, 88, 40, 12);
            glint(c, 22, 86, 20, 0.45, "#e6e8f0", 2, 0.65);
            flat(c, sell(-26, 74, 7, 3, 0.3), "#6d3d29", 0.8);
            streaks(c, 42, -36, 64, 70, 30, 4, "#5a2f20", 0.6, 1.8);
          },
        });
        cshape(ctx, spoly([[2, 70], [20, 72], [18, 92], [0, 90]]), { ...RUSTY_STEEL, depth: 5, outline: 2.5 });
        cshape(ctx, spoly([[0, 60], [16, 62], [16, 70], [0, 68]]), { ...LEATHER, depth: 4, outline: 2 });
      },
    },
  ];

  return {
    id: "enemy.huskMiner",
    parts: assemble(specs),
    height: 246,
    width: 190,
    glows: rigGlows(specs, [{ part: "head", x: 39, y: -13, radius: 30, color: TOXIC_EYE, alpha: 0.5 }]),
    poses: {
      idle: {},
      breathe: {
        pelvis: { y: 2 },
        torso: { rot: 2.5, sy: 0.985 },
        head: { rot: 6, y: 1 },
        jaw: { rot: 10 },
        armBack: { rot: -5 },
        armFront: { rot: -2 },
        foreFront: { rot: 2 },
        pick: { rot: -1 },
      },
      windup: {
        pelvis: { x: -10, y: 2, rot: -4 },
        torso: { rot: -18 },
        head: { rot: -12 },
        jaw: { rot: 24 },
        armFront: { rot: 165 },
        foreFront: { rot: 30 },
        pick: { rot: 20 },
        armBack: { rot: 40 },
        legFront: { rot: -6 },
        legBack: { rot: 8 },
      },
      attack: {
        pelvis: { x: 26, y: 6, rot: 8 },
        torso: { rot: 18 },
        head: { rot: 8 },
        jaw: { rot: 28 },
        armFront: { rot: -80 },
        foreFront: { rot: -24 },
        pick: { rot: -30 },
        armBack: { rot: -30 },
        legFront: { rot: -22 },
        legBack: { rot: 18 },
      },
      cast: {
        torso: { rot: -12 },
        head: { rot: -26 },
        jaw: { rot: 34 },
        armBack: { rot: -40 },
        armFront: { rot: -20 },
      },
      hurt: {
        pelvis: { x: -14, rot: -6 },
        torso: { rot: -18 },
        head: { rot: -24 },
        jaw: { rot: 26 },
        armFront: { rot: 26 },
        armBack: { rot: 30 },
        legFront: { rot: 8 },
      },
      downed: {
        pelvis: { x: 6, y: 64, rot: 24 },
        legFront: { rot: -84 },
        legBack: { rot: -96 },
        torso: { rot: 52 },
        head: { rot: 22 },
        jaw: { rot: 30 },
        armFront: { rot: -40 },
        foreFront: { rot: -20 },
        pick: { rot: 60 },
        armBack: { rot: -30 },
      },
    },
  };
}

// ===========================================================================================
// Husk Foreman (elite)
// ===========================================================================================

export function buildHuskForeman(): RigDef {
  const leg = (front: boolean): PartSpec["draw"] => (ctx) => {
    const knee: Pt = front ? [16, 58] : [4, 60];
    const ankle: Pt = front ? [8, 112] : [-12, 112];
    const suit = front ? { ...SUIT, fill: "#5d4632", shade: "#3a2b1e", deep: "#1a120c", light: "#7a5d42" } : SUIT_DARK;
    cshape(ctx, stube([[0, -6], knee, ankle], [28, 22, 16]), suit);
    // exo strut with piston along the outer leg
    const steel = front ? RUSTY_STEEL : { ...RUSTY_STEEL, fill: "#44464d", light: "#6b6c73" };
    cshape(ctx, scaps(-10, 6, knee[0] - 4, knee[1], 6, 6), { ...steel, depth: 5, outline: 2.5 });
    cshape(ctx, scaps(knee[0] - 4, knee[1], ankle[0] - 6, ankle[1] - 6, 6, 5), { ...steel, depth: 5, outline: 2.5 });
    cshape(ctx, scaps(-4, 12, knee[0] - 2, knee[1] - 12, 3, 3), { ...steel, fill: "#a9a6a0", depth: 3, outline: 2 });
    cshape(ctx, sell(knee[0] - 4, knee[1], 12, 12), {
      ...RUST_PLATE,
      depth: 8,
      detail: (c) => rivets(c, [[knee[0] - 4, knee[1]]], 3.5),
    });
    // steel-capped boot
    const toe = front ? 38 : 22;
    const boot = sblob([
      [ankle[0] - 18, ankle[1] - 10],
      [ankle[0] + 10, ankle[1] - 12],
      [ankle[0] + toe - 6, ankle[1] - 2],
      [ankle[0] + toe, ankle[1] + 12],
      [ankle[0] - 22, ankle[1] + 12],
    ], 0.3);
    cshape(ctx, boot, { ...LEATHER, fill: RAMPS.leather[1], depth: 8 });
    cshape(ctx, sblob([[ankle[0] + toe - 18, ankle[1] - 6], [ankle[0] + toe, ankle[1] + 2], [ankle[0] + toe, ankle[1] + 12], [ankle[0] + toe - 22, ankle[1] + 12]], 0.4), { ...RUSTY_STEEL, depth: 5, outline: 2.5 });
  };

  const specs: PartSpec[] = [
    shadowPart(108, 15, 0.65, 10),
    {
      id: "pelvis",
      at: [-6, -126],
      z: 3,
      box: [-56, -36, 56, 40],
      draw: (ctx) => {
        cshape(ctx, sblob([[-44, -16], [38, -20], [48, 12], [14, 30], [-40, 26]]), SUIT_DARK);
        // armoured belt plate
        cshape(ctx, spoly([[-48, -18], [48, -22], [50, 2], [-46, 6]]), {
          ...RUST_PLATE,
          depth: 10,
          detail: (c) => rivets(c, [[-38, -6], [-14, -8], [14, -10], [40, -10]]),
        });
      },
    },
    { id: "legBack", parent: "pelvis", at: [-16, 10], z: 1, box: [-44, -40, 46, 132], draw: leg(false) },
    { id: "legFront", parent: "pelvis", at: [14, 10], z: 6, box: [-44, -40, 62, 132], draw: leg(true) },
    {
      id: "frame",
      parent: "torso",
      at: [-30, -110],
      z: 2,
      box: [-70, -78, 40, 120],
      draw: (ctx) => {
        // back-mounted cage with two fume tanks and exhaust stacks
        cshape(ctx, scaps(-40, -60, -40, 6, 5, 5), { ...RUSTY_STEEL, depth: 4, outline: 2.5 });
        cshape(ctx, scaps(-18, -70, -24, -20, 6, 6), { ...RUSTY_STEEL, depth: 4, outline: 2.5 });
        cshape(ctx, sblob([[-38, -72], [-30, -76], [-26, -36], [-36, -34]], 0.3), { ...RUST_PLATE, depth: 5 });
        line(ctx, [[-34, -80], [-36, -96]], 7, INK_COLOR, [0.1, 0.1]);
        line(ctx, [[-34, -80], [-36, -96]], 3.5, "#4a4a52", [0.1, 0.1]);
        for (let i = 0; i < 2; i++) {
          const x = -46 + i * 26;
          const tank = sblob([[x - 12, -30], [x + 12, -30], [x + 14, 50], [x, 58], [x - 14, 50]], 0.35);
          cshape(ctx, tank, {
            ...RUSTY_STEEL,
            fill: i ? "#4f5157" : "#3e4046",
            depth: 12,
            detail: (c) => {
              // sickly fluid gauge
              flat(c, spoly([[x - 4, -8], [x + 4, -8], [x + 4, 34], [x - 4, 34]]), INK_COLOR);
              flat(c, spoly([[x - 2.5, 8], [x + 2.5, 8], [x + 2.5, 32], [x - 2.5, 32]]), RAMPS.toxic[3]);
              bloom(c, x, 20, 16, RAMPS.toxic[4], 0.45);
              line(c, [[x - 12, 6], [x + 12, 6]], 2.4);
              line(c, [[x - 12, 40], [x + 12, 40]], 2.4);
            },
          });
        }
        // rebreather hose to the head
        line(ctx, [[-4, -20], [16, -36], [34, -20], [36, 0]], 9, INK_COLOR, [0.05, 0.05]);
        line(ctx, [[-4, -20], [16, -36], [34, -20], [36, 0]], 5, "#3d3a3a", [0.05, 0.05]);
      },
    },
    {
      id: "torso",
      parent: "pelvis",
      at: [0, -6],
      z: 5,
      box: [-80, -186, 96, 30],
      draw: (ctx) => {
        // massive hunched barrel chest
        const body = sblob([
          [-36, 10],
          [-60, -40],
          [-62, -96],
          [-44, -142],
          [-6, -164],
          [40, -160],
          [72, -132],
          [78, -94],
          [62, -54],
          [40, -10],
        ]);
        cshape(ctx, body, {
          ...SUIT_DARK,
          depth: 40,
          hatch: { spacing: 5, alpha: 0.5, cross: true },
          detail: (c) => {
            // bloated flesh bursting through the suit at the belly
            const gut = sblob([[4, -64], [44, -78], [64, -54], [48, -20], [12, -18]], 0.5);
            cshape(c, gut, {
              ...SKIN,
              fill: "#7c826a",
              depth: 18,
              outline: 3,
              rimBack: false,
              detail: (d) => {
                veins(d, 41, 10, -70, 46, 46, 4);
                flat(d, sblob([[30, -56], [44, -52], [40, -40], [28, -44]], 0.5), "#5d4a62", 0.55);
                glint(d, 44, -66, 14, -0.5, "#e3f0c8", 2, 0.6);
              },
            });
            // torn suit edges around the wound
            line(c, ragged([2, -66], [62, -82], 8, 6, 51), 3);
            line(c, ragged([10, -18], [50, -22], 6, -5, 52), 3);
            // chest harness: rusted exo plate with rivets
            const plate = spoly([[-20, -150], [36, -158], [64, -126], [58, -96], [-8, -92], [-30, -120]]);
            cshape(c, plate, {
              ...RUST_PLATE,
              depth: 18,
              detail: (d) => {
                rivets(d, [[-14, -138], [30, -148], [54, -124], [50, -102], [-2, -100]]);
                line(d, [[0, -146], [10, -100]], 2, INK_COLOR, [0.1, 0.1], 0.7);
                crack(d, rng(77), 40, -140, 2.2, 22, 2, INK_COLOR, 1);
                scuffs(d, 78, -26, -156, 90, 60, 20, "#d9a07a");
                streaks(d, 79, -26, -150, 90, 60, 7, "#2a120a", 0.5);
                glint(d, 34, -146, 20, -0.15, "#f6c79a", 2.2, 0.7);
              },
            });
            line(c, [[-44, -60], [-30, -30], [-10, -16]], 2, INK_COLOR, [0.2, 0.3], 0.7);
            streaks(c, 5, -56, -150, 110, 140, 12, "#0f0a07", 0.35);
          },
        });
      },
    },
    {
      id: "armBack",
      parent: "torso",
      at: [-10, -146],
      z: 1,
      box: [-36, -30, 70, 160],
      draw: (ctx) => {
        cshape(ctx, stube([[0, 0], [8, 64]], [26, 20]), SUIT_DARK);
        cshape(ctx, stube([[8, 60], [22, 110]], [17, 14]), SKIN_DARK);
        // hydraulic clamp hand
        const jawA = sblob([[10, 108], [40, 112], [52, 134], [40, 130], [24, 122]], 0.3);
        const jawB = sblob([[8, 116], [30, 130], [40, 150], [26, 146], [6, 130]], 0.3);
        cshape(ctx, jawB, { ...RUSTY_STEEL, fill: "#3f4147", depth: 8 });
        cshape(ctx, jawA, { ...RUSTY_STEEL, fill: "#4a4c52", depth: 8 });
        cshape(ctx, sell(16, 116, 12, 12), { ...RUST_PLATE, depth: 8, detail: (c) => rivets(c, [[16, 116]], 3) });
      },
    },
    {
      id: "head",
      parent: "torso",
      at: [62, -128],
      z: 8,
      box: [-44, -90, 92, 58],
      draw: (ctx) => {
        ctx.scale(1.4, 1.4);
        // thick neck sinew
        cshape(ctx, stube([[-22, 10], [0, -10]], [16, 14]), SKIN_DARK);
        // sunken head under a welded faceplate
        cshape(ctx, sblob([[-16, -36], [10, -50], [36, -42], [44, -20], [34, 6], [8, 14], [-14, 2]], 0.45), {
          ...SKIN_DARK,
          depth: 14,
        });
        // jaw hanging under the mask
        cshape(ctx, sblob([[6, 4], [36, 0], [40, 18], [20, 26], [4, 16]], 0.4), { ...SKIN, depth: 9 });
        for (let i = 0; i < 4; i++) fang(ctx, [16 + i * 6, 6], [17 + i * 6, 14], 2.4, RAMPS.bone, 0, 1.2);
        const mask = spoly([[-6, -46], [30, -50], [48, -36], [50, -10], [36, 2], [2, -2], [-10, -20]]);
        cshape(ctx, mask, {
          ...RUSTY_STEEL,
          depth: 14,
          detail: (c) => {
            flat(c, spoly([[12, -30], [48, -32], [48, -22], [14, -20]]), INK_COLOR);
            line(c, [[4, -6], [38, -8]], 1.8, INK_COLOR, [0.1, 0.1], 0.8);
            rivets(c, [[2, -36], [40, -42], [44, -12], [6, -10]], 2.2);
            crack(c, rng(19), 30, -46, 1.6, 20, 1.8, INK_COLOR, 1);
            glint(c, 22, -44, 18, -0.1, "#d8dbe6", 2, 0.65);
          },
        });
        eye(ctx, 26, -26, 5, 3, TOXIC_EYE, "#f4ffd8", 0, 0);
        eye(ctx, 40, -27, 4, 2.6, TOXIC_EYE, "#f4ffd8", 0, 0);
        bloom(ctx, 33, -26, 24, TOXIC_EYE, 0.6);
      },
    },
    {
      id: "armFront",
      parent: "torso",
      at: [46, -128],
      z: 9,
      box: [-46, -50, 50, 84],
      draw: (ctx) => {
        cshape(ctx, stube([[0, 0], [8, 58]], [26, 21]), SUIT);
        // pauldron
        const pad = sblob([[-38, -12], [-22, -40], [12, -46], [40, -26], [38, 6], [0, 2]], 0.35);
        cshape(ctx, pad, {
          ...RUST_PLATE,
          depth: 18,
          detail: (c) => {
            rivets(c, [[-22, -16], [6, -34], [30, -14]]);
            line(c, [[-30, -6], [34, -10]], 2, INK_COLOR, [0.1, 0.1], 0.6);
            glint(c, 8, -38, 22, -0.1, "#f8c08c", 2.4, 0.7);
          },
        });
      },
    },
    {
      id: "drill",
      parent: "armFront",
      at: [8, 58],
      z: 11,
      box: [-36, -24, 96, 92],
      draw: (ctx) => {
        ctx.rotate(0.3);
        // hydraulic housing replacing the forearm
        const housing = sblob([[-18, -14], [30, -16], [62, -2], [64, 26], [30, 34], [-18, 22]], 0.25);
        cshape(ctx, housing, {
          ...RUSTY_STEEL,
          depth: 16,
          detail: (c) => {
            for (const x of [8, 30, 50]) {
              line(c, [[x, -16], [x + 2, 34]], 3, INK_COLOR, [0.05, 0.05], 0.85);
              line(c, [[x + 3, -14], [x + 5, 30]], 1.4, "#9a9ca4", [0.1, 0.1], 0.6);
            }
            glint(c, 34, -8, 26, 0.12, "#e8e8ef", 2.2, 0.6);
            flat(c, sell(-2, 10, 9, 9), RAMPS.rust[2], 0.7);
          },
        });
        // hoses
        line(ctx, [[-14, 22], [6, 44], [40, 40]], 7, INK_COLOR, [0.05, 0.05]);
        line(ctx, [[-14, 22], [6, 44], [40, 40]], 3.5, "#3d3a3a", [0.05, 0.05]);
        cshape(ctx, sell(-4, 4, 14, 14), { ...RUST_PLATE, depth: 8, detail: (c) => rivets(c, [[-4, 4]], 3.5) });
      },
    },
    {
      id: "bit",
      parent: "drill",
      at: [56, 28],
      z: 12,
      box: [-16, -30, 100, 66],
      draw: (ctx) => {
        ctx.rotate(0.3);
        // conical spiral drill bit, pointing forward
        const cone = spoly([[0, -24], [96, 0], [0, 24]]);
        cshape(ctx, cone, {
          ...RUSTY_STEEL,
          fill: "#6c6e75",
          light: "#a8aab3",
          depth: 12,
          detail: (c) => {
            for (let i = 0; i < 6; i++) {
              const x = 4 + i * 14;
              const r = 24 * (1 - x / 96);
              line(c, [[x, r], [x + 10, -r * 0.8]], 3, INK_COLOR, [0.1, 0.1], 0.9);
              line(c, [[x + 2, r - 1], [x + 11, -r * 0.7]], 1.2, "#c8cad2", [0.1, 0.1], 0.6);
            }
          },
        });
        cshape(ctx, spoly([[-6, -24], [6, -24], [6, 24], [-6, 24]]), { ...RUST_PLATE, depth: 5, outline: 2.5 });
      },
    },
  ];

  return {
    id: "enemy.huskForeman",
    parts: assemble(specs),
    height: 318,
    width: 220,
    glows: rigGlows(specs, [
      { part: "head", x: 46, y: -36, radius: 40, color: TOXIC_EYE, alpha: 0.5 },
      { part: "frame", x: -33, y: 20, radius: 30, color: RAMPS.toxic[3], alpha: 0.25 },
    ]),
    poses: {
      idle: {},
      breathe: {
        pelvis: { y: 2 },
        torso: { rot: 1.5, sy: 0.99, sx: 1.01 },
        head: { rot: 4 },
        armFront: { rot: -3 },
        drill: { rot: 2 },
        bit: { sy: 0.92 },
        armBack: { rot: -3 },
        frame: { rot: -1 },
      },
      windup: {
        pelvis: { x: -12, y: 4, rot: -3 },
        torso: { rot: -12 },
        head: { rot: -8 },
        armFront: { rot: 60 },
        drill: { rot: -40 },
        bit: { sy: 0.8 },
        armBack: { rot: 24 },
        legFront: { rot: -4 },
        legBack: { rot: 6 },
      },
      attack: {
        pelvis: { x: 34, y: 6, rot: 6 },
        torso: { rot: 18 },
        head: { rot: 8 },
        armFront: { rot: -50 },
        drill: { rot: -10 },
        bit: { x: 14, sy: 1.1 },
        armBack: { rot: -24 },
        legFront: { rot: -20 },
        legBack: { rot: 14 },
      },
      cast: {
        torso: { rot: -14 },
        head: { rot: -20 },
        armFront: { rot: 110 },
        drill: { rot: -70 },
        armBack: { rot: 60 },
        frame: { rot: -3 },
      },
      hurt: {
        pelvis: { x: -14, rot: -4 },
        torso: { rot: -14 },
        head: { rot: -20 },
        armFront: { rot: 24 },
        drill: { rot: 14 },
        armBack: { rot: 20 },
      },
      downed: {
        pelvis: { x: -20, y: 96, rot: -10 },
        legFront: { rot: -70 },
        legBack: { rot: -52 },
        torso: { rot: 58 },
        head: { rot: 20 },
        armFront: { rot: -60 },
        drill: { rot: 30 },
        armBack: { rot: -40 },
      },
    },
  };
}
