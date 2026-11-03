/**
 * Void Wisp: a hovering mass of violet darkness that drinks light. Smoke-tongued body
 * streaming backward, a pale cracked core of stolen light caged by dark finger-ribs, trailing
 * tendrils and a hooked reaching tendril. Floats ~20 px above the floor and bobs.
 */
import { RAMPS } from "../../palette";
import type { Pt } from "../ink";
import type { RigDef } from "../rig";
import {
  assemble,
  bloom,
  type CStyle,
  contour,
  cshape,
  INK_COLOR,
  line,
  type PartSpec,
  rigGlows,
  rng,
  sblob,
  shadowPart,
  stube,
} from "./kit";

const DARK: CStyle = {
  fill: "#21153a",
  shade: "#120a22",
  deep: "#06030c",
  light: "#3a2670",
  hatch: { spacing: 4.5, alpha: 0.45 },
  rimFrontW: 2,
};
const DARKER: CStyle = {
  ...DARK,
  fill: "#1b1130",
  shade: "#0f081d",
  deep: "#06030c",
  light: "#2f1f55",
  rimFront: false,
};
const CORE = "#e6d6ff";
const VIOLET = RAMPS.umbra[4];

/** Swirling inner currents of the void body. */
function currents(ctx: CanvasRenderingContext2D, seed: number, cx: number, cy: number, r: number, n: number): void {
  const rnd = rng(seed);
  for (let i = 0; i < n; i++) {
    const a0 = rnd() * Math.PI * 2;
    const rr = r * (0.4 + rnd() * 0.6);
    const pts: Pt[] = [];
    for (let k = 0; k <= 6; k++) {
      const a = a0 + k * 0.32;
      const q = rr * (1 - k * 0.06);
      pts.push([cx + Math.cos(a) * q, cy + Math.sin(a) * q * 0.9]);
    }
    line(ctx, pts, 2 + rnd() * 2, i % 3 === 0 ? "#5d43a0" : INK_COLOR, [0.3, 0.6], i % 3 === 0 ? 0.55 : 0.5);
  }
}

function tendril(spine: Pt[], radii: number[], st: CStyle, seed: number): PartSpec["draw"] {
  return (ctx) => {
    cshape(ctx, stube(spine, radii, 0.5), {
      ...st,
      depth: 8,
      outline: 2.6,
      detail: (c) => {
        const rnd = rng(seed);
        for (let i = 1; i < spine.length - 1; i++) {
          const p = spine[i] as Pt;
          const r = (radii[i] ?? 4) * 0.8;
          line(c, [[p[0] - r, p[1] - 2 + rnd() * 3], [p[0], p[1] + 3], [p[0] + r, p[1] - 1]], 1.6, INK_COLOR, [0.2, 0.2], 0.6);
        }
      },
    });
  };
}

export function buildVoidWisp(): RigDef {
  const specs: PartSpec[] = [
    shadowPart(64, 10, 0.5, 0),
    {
      id: "body",
      at: [0, -178],
      z: 5,
      box: [-100, -128, 100, 92],
      draw: (ctx) => {
        const s = sblob([
          [-48, 44],
          [-68, 14],
          [-74, -26],
          [-62, -58],
          [-92, -100],
          [-42, -80],
          [-36, -116],
          [-8, -84],
          [8, -120],
          [20, -80],
          [48, -70],
          [68, -40],
          [72, 2],
          [58, 38],
          [30, 60],
          [0, 66],
          [-26, 60],
        ], 0.55);
        cshape(ctx, s, {
          ...DARK,
          depth: 36,
          hatch: { spacing: 4.5, alpha: 0.45, cross: true },
          detail: (c) => {
            currents(c, 4, 6, -4, 66, 14);
            // inner violet bleed around where the core sits
            bloom(c, 12, -6, 56, "#6a3fc0", 0.28);
            line(c, [[-60, -56], [-40, -40], [-30, -10]], 2.2, "#5d43a0", [0.2, 0.6], 0.6);
            line(c, [[-30, -100], [-20, -70], [-6, -50]], 2, "#5d43a0", [0.2, 0.6], 0.5);
          },
        });
        // smoke tongues licking off the top edge (ink strokes)
        line(ctx, [[-60, -62], [-84, -92], [-108, -108]], 5, INK_COLOR, [0.2, 0.95]);
        line(ctx, [[-30, -100], [-44, -124], [-62, -134]], 4, INK_COLOR, [0.2, 0.95]);
        line(ctx, [[8, -110], [0, -126], [-14, -136]], 3.5, INK_COLOR, [0.2, 0.95]);
        // dark finger-ribs caging the core
        const ribs: [Pt, Pt, Pt][] = [
          [[-22, -40], [10, -46], [36, -30]],
          [[-28, -10], [-4, -34], [20, -40]],
          [[-24, 26], [6, 30], [36, 18]],
          [[40, -38], [54, -16], [44, 14]],
        ];
        for (const [a, b, c] of ribs) {
          line(ctx, [a, b, c], 9, INK_COLOR, [0.3, 0.9]);
          line(ctx, [a, b, c], 3.5, "#3c2868", [0.3, 0.9], 0.9);
        }
      },
    },
    {
      id: "mantle",
      parent: "body",
      at: [-10, -10],
      z: 2,
      box: [-130, -110, 70, 100],
      draw: (ctx) => {
        ctx.globalAlpha = 0.85;
        const s = sblob([
          [-40, 70],
          [-90, 40],
          [-126, 10],
          [-98, -6],
          [-110, -44],
          [-72, -50],
          [-80, -90],
          [-36, -70],
          [10, -84],
          [40, -40],
          [50, 20],
          [20, 70],
        ], 0.55);
        cshape(ctx, s, { ...DARKER, depth: 30, rimBackW: 3.5 });
        line(ctx, [[-96, 28], [-120, 24], [-128, 30]], 3, INK_COLOR, [0.2, 0.95]);
        line(ctx, [[-90, -46], [-116, -70]], 3, INK_COLOR, [0.2, 0.95]);
      },
    },
    {
      id: "tailC",
      parent: "body",
      at: [-54, 30],
      z: 1,
      box: [-60, -14, 30, 120],
      draw: tendril([[0, 0], [-16, 36], [-12, 70], [-34, 104]], [13, 9, 5, 1], DARKER, 3),
    },
    {
      id: "tailA",
      parent: "body",
      at: [-26, 50],
      z: 3,
      box: [-40, -18, 36, 134],
      draw: tendril([[0, 0], [-8, 38], [6, 78], [-10, 118]], [18, 12, 6, 1.2], DARK, 5),
    },
    {
      id: "tailB",
      parent: "body",
      at: [16, 52],
      z: 4,
      box: [-30, -18, 40, 116],
      draw: tendril([[0, 0], [10, 34], [-2, 68], [10, 100]], [15, 10, 5, 1], DARK, 7),
    },
    {
      id: "armBack",
      parent: "body",
      at: [-48, -6],
      z: 1,
      box: [-70, -30, 30, 90],
      draw: tendril([[0, 0], [-24, 20], [-40, 46], [-54, 76]], [12, 8, 5, 1], DARKER, 9),
    },
    {
      id: "core",
      parent: "body",
      at: [12, -6],
      z: 6,
      box: [-44, -44, 44, 44],
      draw: (ctx) => {
        bloom(ctx, 0, 0, 44, VIOLET, 0.8);
        ctx.fillStyle = INK_COLOR;
        ctx.beginPath();
        ctx.arc(0, 0, 25, 0, Math.PI * 2);
        ctx.fill();
        const g = ctx.createRadialGradient(-5, -6, 2, 0, 0, 23);
        g.addColorStop(0, "#ffffff");
        g.addColorStop(0.35, CORE);
        g.addColorStop(0.8, "#b392f0");
        g.addColorStop(1, "#7a52c4");
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(0, 0, 22, 0, Math.PI * 2);
        ctx.fill();
        // cracks of darkness across the stolen light
        const rnd = rng(12);
        for (let i = 0; i < 5; i++) {
          const a = (i / 5) * Math.PI * 2 + rnd() * 0.6;
          const pts: Pt[] = [[Math.cos(a) * 23, Math.sin(a) * 23]];
          let r = 23;
          let aa = a;
          for (let k = 0; k < 3; k++) {
            r -= 4 + rnd() * 4;
            aa += (rnd() - 0.5) * 0.7;
            pts.push([Math.cos(aa) * r, Math.sin(aa) * r]);
          }
          line(ctx, pts, 2.6, "#3a2368", [0.05, 0.9], 0.85);
        }
        contour(ctx, sblob([[-22, 0], [0, -22], [22, 0], [0, 22]], 0.9), 3);
      },
    },
    {
      id: "shroud",
      parent: "body",
      at: [10, 18],
      z: 7,
      box: [-60, -30, 64, 46],
      draw: (ctx) => {
        // lower lip of darkness curling over the core, with hooked fingers
        const s = sblob([[-56, 6], [-30, -8], [-6, 2], [22, -6], [50, -24], [58, -8], [40, 18], [8, 30], [-30, 26]], 0.5);
        cshape(ctx, s, { ...DARK, depth: 14 });
        line(ctx, [[-28, 0], [-20, -18], [-8, -26]], 6, INK_COLOR, [0.2, 0.95]);
        line(ctx, [[-28, 0], [-20, -18], [-8, -26]], 2.2, "#4a3282", [0.2, 0.95], 0.9);
        line(ctx, [[30, -8], [36, -24], [30, -34]], 5, INK_COLOR, [0.2, 0.95]);
      },
    },
    {
      id: "armFront",
      parent: "body",
      at: [50, 14],
      z: 8,
      box: [-20, -20, 80, 100],
      draw: (ctx) => {
        tendril([[0, 0], [26, 18], [44, 42], [50, 66]], [14, 9, 6, 3], DARK, 11)(ctx);
        // hooked talons at the end
        for (const [dx, dy, ex, ey] of [
          [50, 64, 66, 86],
          [48, 66, 46, 92],
          [52, 62, 72, 70],
        ] as const) {
          line(ctx, [[dx, dy], [(dx + ex) / 2 + 4, (dy + ey) / 2], [ex, ey]], 5, INK_COLOR, [0.1, 0.95]);
          line(ctx, [[dx, dy], [(dx + ex) / 2 + 4, (dy + ey) / 2], [ex, ey]], 1.8, "#6a52a8", [0.1, 0.95], 0.8);
        }
      },
    },
    {
      id: "motes",
      parent: "body",
      at: [0, 0],
      z: 9,
      box: [-110, -140, 110, 120],
      draw: (ctx) => {
        const rnd = rng(77);
        for (let i = 0; i < 9; i++) {
          const a = rnd() * Math.PI * 2;
          const r = 80 + rnd() * 26;
          const x = Math.cos(a) * r;
          const y = Math.sin(a) * r * 0.9;
          bloom(ctx, x, y, 7, VIOLET, 0.7);
          ctx.fillStyle = CORE;
          ctx.beginPath();
          ctx.arc(x, y, 1.6, 0, Math.PI * 2);
          ctx.fill();
        }
      },
    },
  ];

  return {
    id: "enemy.voidWisp",
    parts: assemble(specs),
    height: 300,
    width: 190,
    glows: rigGlows(specs, [
      { part: "core", x: 0, y: 0, radius: 110, color: "#9a6cf0", alpha: 0.26 },
      { part: "core", x: 0, y: 0, radius: 36, color: CORE, alpha: 0.7 },
    ]),
    poses: {
      idle: {},
      breathe: {
        shadow: { sx: 0.82, sy: 0.82, alpha: 0.75 },
        body: { y: -12, rot: -1 },
        mantle: { rot: -3, sy: 1.04, sx: 1.03 },
        core: { sx: 1.1, sy: 1.1 },
        tailA: { rot: 7 },
        tailB: { rot: -6 },
        tailC: { rot: 9 },
        armFront: { rot: -8 },
        armBack: { rot: 7 },
        shroud: { y: 2 },
        motes: { rot: 8 },
      },
      windup: {
        body: { x: -18, y: -14, rot: -9 },
        mantle: { sx: 1.12, sy: 1.08, rot: -4 },
        core: { sx: 0.85, sy: 0.85 },
        armFront: { rot: -70 },
        armBack: { rot: 20 },
        tailA: { rot: 14 },
        tailB: { rot: 10 },
        tailC: { rot: 16 },
        motes: { rot: -10 },
      },
      attack: {
        body: { x: 44, y: 4, rot: 12 },
        mantle: { sx: 0.95, rot: 6 },
        core: { sx: 1.25, sy: 1.25 },
        armFront: { rot: 24 },
        armBack: { rot: -24 },
        tailA: { rot: 24 },
        tailB: { rot: 28 },
        tailC: { rot: 26 },
        shroud: { rot: -6 },
        motes: { rot: 20 },
      },
      cast: {
        body: { y: -18, rot: -4 },
        mantle: { sx: 1.18, sy: 1.12 },
        core: { sx: 1.45, sy: 1.45 },
        armFront: { rot: -56 },
        armBack: { rot: 36 },
        tailA: { rot: -8 },
        tailB: { rot: 8 },
        shroud: { y: 8, rot: 6 },
        motes: { rot: -30, sx: 1.2, sy: 1.2 },
      },
      hurt: {
        body: { x: -20, y: -4, rot: -12 },
        mantle: { rot: -8, sx: 0.92 },
        core: { sx: 0.7, sy: 0.7 },
        armFront: { rot: -30 },
        tailA: { rot: 18 },
        tailB: { rot: 16 },
        tailC: { rot: 20 },
      },
      downed: {
        shadow: { sx: 1.3, alpha: 0.5 },
        body: { y: 120, sx: 1.25, sy: 0.55, alpha: 0.75 },
        mantle: { sx: 1.2 },
        core: { sx: 0.45, sy: 0.45 },
        armFront: { rot: 60 },
        armBack: { rot: -50 },
        tailA: { rot: -70, alpha: 0.3 },
        tailB: { rot: -80, alpha: 0.3 },
        tailC: { rot: 70, alpha: 0.3 },
        motes: { alpha: 0 },
      },
    },
  };
}
