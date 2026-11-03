/**
 * Mycelid Tender: a stooped fungal caretaker. A fibrous pale stalk on a tangle of root legs,
 * a heavy drooping cap (dark, wet, blotched with toxic bioluminescence) whose gills glow
 * from beneath, hanging mycelium veils with glowing droplets, long root-fingered arms and a
 * drifting cloud of spores. Heals (cast) by lifting its arms and flaring the gills.
 */
import { RAMPS } from "../../palette";
import type { Pt } from "../ink";
import type { RigDef } from "../rig";
import {
  assemble,
  bloom,
  type CStyle,
  cshape,
  flat,
  glint,
  INK_COLOR,
  line,
  type PartSpec,
  rigGlows,
  rng,
  sblob,
  sell,
  shadowPart,
  stube,
} from "./kit";

const GLOW = RAMPS.toxic[4];
const GLOW_HOT = RAMPS.toxic[5];
const STALK: CStyle = {
  fill: "#5e5c4c",
  shade: "#393830",
  deep: "#181814",
  light: "#878570",
  hatch: { spacing: 4.5, alpha: 0.45 },
  grain: { color: "#1c1c17", alpha: 0.3, density: 0.008, seed: 5, size: 1.2 },
};
const STALK_DARK: CStyle = {
  ...STALK,
  fill: "#4c4b3e",
  shade: "#2f2e26",
  deep: "#141410",
  light: "#66654f",
  rimFront: false,
};
const CAP: CStyle = {
  fill: "#1e271a",
  shade: "#10160d",
  deep: "#050704",
  light: "#34452b",
  hatch: { spacing: 4.5, alpha: 0.5, cross: true },
};

function fibers(ctx: CanvasRenderingContext2D, spine: Pt[], n: number, spread: number, seed: number): void {
  const r = rng(seed);
  for (let i = 0; i < n; i++) {
    const off = (r() - 0.5) * spread;
    line(ctx, spine.map(([x, y], k) => [x + off * (1 - k / spine.length / 2), y] as Pt), 1.3, INK_COLOR, [0.2, 0.2], 0.45 + r() * 0.2);
  }
}

function roots(front: boolean): PartSpec["draw"] {
  return (ctx) => {
    const st = front ? STALK : STALK_DARK;
    const set: [Pt[], number[]][] = front
      ? [
          [[[0, 0], [20, 14], [40, 30], [62, 40]], [13, 9, 5, 1.2]],
          [[[0, 0], [6, 20], [14, 34], [8, 42]], [12, 8, 5, 1.2]],
          [[[0, 0], [-20, 16], [-36, 32], [-58, 40]], [12, 8, 4, 1]],
        ]
      : [
          [[[0, 0], [30, 10], [52, 26], [80, 36]], [10, 7, 4, 1]],
          [[[0, 0], [-32, 12], [-60, 26], [-88, 34]], [10, 7, 4, 1]],
          [[[0, 0], [-6, 18], [-14, 38]], [10, 6, 1]],
        ];
    set.forEach(([sp, rr], i) => {
      cshape(ctx, stube(sp, rr, 0.5), { ...st, depth: 6, outline: 2.8, hatch: false });
      const tip = sp[sp.length - 1] as Pt;
      line(ctx, [tip, [tip[0] + (tip[0] > 0 ? 10 : -10), tip[1] + 3]], 2, INK_COLOR, [0.1, 0.9]);
      fibers(ctx, sp.slice(0, 3), 2, 6, 30 + i);
    });
  };
}

export function buildMycelidTender(): RigDef {
  const specs: PartSpec[] = [
    shadowPart(96, 12, 0.55, 0),
    {
      id: "stalk",
      at: [-18, -38],
      z: 5,
      box: [-30, -176, 56, 16],
      draw: (ctx) => {
        const spine: Pt[] = [[0, 4], [-2, -50], [8, -110], [30, -156]];
        cshape(ctx, stube(spine, [26, 21, 17, 15], 0.5), {
          ...STALK,
          depth: 16,
          detail: (c) => {
            fibers(c, spine, 9, 26, 3);
            // fungal shelf growths
            flat(c, sblob([[-16, -70], [-4, -76], [0, -66], [-14, -62]], 0.5), "#8f8d72");
            line(c, [[-18, -64], [0, -66]], 1.8);
            flat(c, sblob([[-10, -30], [2, -34], [4, -26], [-8, -24]], 0.5), "#8f8d72");
            line(c, [[-12, -24], [4, -26]], 1.6);
            glint(c, 14, -120, 20, -1.1, "#e8e6c8", 1.8, 0.45);
          },
        });
        // glowing nodules along the stalk
        for (const [x, y, r] of [
          [12, -96, 3],
          [4, -60, 2.4],
          [16, -130, 2.2],
        ] as const) {
          bloom(ctx, x, y, r * 4, GLOW, 0.5);
          flat(ctx, sblob([[x - r, y], [x, y - r], [x + r, y], [x, y + r]], 0.9), GLOW_HOT);
        }
      },
    },
    { id: "rootsBack", parent: "stalk", at: [0, 0], z: 1, box: [-104, -16, 96, 52], draw: roots(false) },
    { id: "rootsFront", parent: "stalk", at: [2, 2], z: 7, box: [-72, -16, 80, 52], draw: roots(true) },
    {
      id: "armBack",
      parent: "stalk",
      at: [4, -112],
      z: 2,
      box: [-70, -20, 20, 104],
      draw: (ctx) => {
        const sp: Pt[] = [[0, 0], [-26, 24], [-40, 56], [-44, 80]];
        cshape(ctx, stube(sp, [9, 7, 5, 4], 0.5), { ...STALK_DARK, depth: 5, outline: 2.6 });
        for (let i = 0; i < 3; i++) {
          line(ctx, [[-44, 78], [-50 + i * 6, 92], [-56 + i * 8, 100]], 3, INK_COLOR, [0.1, 0.9]);
        }
      },
    },
    {
      id: "armFront",
      parent: "stalk",
      at: [18, -126],
      z: 8,
      box: [-20, -20, 70, 64],
      draw: (ctx) => {
        cshape(ctx, stube([[0, 0], [22, 18], [44, 34]], [10, 8, 6], 0.5), {
          ...STALK,
          depth: 6,
          detail: (c) => fibers(c, [[0, 0], [22, 18], [44, 34]], 3, 8, 8),
        });
      },
    },
    {
      id: "handFront",
      parent: "armFront",
      at: [44, 34],
      z: 9,
      box: [-14, -16, 50, 74],
      draw: (ctx) => {
        cshape(ctx, stube([[0, 0], [8, 22], [10, 34]], [7, 6, 5], 0.5), { ...STALK, depth: 4, outline: 2.6 });
        // long root fingers ending in glowing droplets
        const fingers: Pt[][] = [
          [[10, 32], [22, 46], [26, 62]],
          [[10, 34], [14, 52], [10, 66]],
          [[8, 32], [0, 48], [-6, 58]],
          [[12, 30], [30, 36], [40, 46]],
        ];
        for (const f of fingers) {
          line(ctx, f, 5, INK_COLOR, [0.1, 0.9]);
          line(ctx, f, 2.4, "#8a886f", [0.1, 0.9]);
          const tip = f[f.length - 1] as Pt;
          bloom(ctx, tip[0], tip[1] + 2, 8, GLOW, 0.6);
        }
      },
    },
    {
      id: "cap",
      parent: "stalk",
      at: [30, -156],
      z: 10,
      box: [-100, -84, 118, 112],
      draw: (ctx) => {
        // underside: glowing gills in a dark hollow
        const under = sblob([[-80, 26], [-40, 12], [0, 12], [44, 24], [84, 50], [92, 92], [60, 74], [10, 44], [-40, 40]], 0.5);
        flat(ctx, under, INK_COLOR);
        ctx.save();
        ctx.beginPath();
        under.path(ctx);
        ctx.clip();
        bloom(ctx, 0, 30, 70, GLOW, 0.55);
        for (let i = 0; i < 18; i++) {
          const x = -76 + i * 8.6;
          line(ctx, [[x, 8], [x + 4, 46]], 1.8, i % 2 ? "#1a2a14" : RAMPS.toxic[3], [0.1, 0.2], 0.85);
        }
        ctx.restore();
        // the drooping cap
        // weeping hood: high at the back, sagging heavily over the front, ragged lip
        const lip: Pt[] = [];
        const lipFrom: Pt = [94, 96];
        const lipTo: Pt = [-80, 30];
        for (let i = 0; i <= 12; i++) {
          const t = i / 12;
          const x = lipFrom[0] + (lipTo[0] - lipFrom[0]) * t;
          const sag = Math.sin(t * Math.PI) * -26 + (1 - t) * 0;
          const y = lipFrom[1] + (lipTo[1] - lipFrom[1]) * t + sag - (t < 0.35 ? (0.35 - t) * 60 : 0);
          lip.push([x, y + (i % 2 ? 5 + ((i * 7) % 5) : 0)]);
        }
        const cap = sblob([[-88, 18], [-80, -22], [-52, -60], [-6, -74], [44, -62], [80, -30], [100, 16], [104, 64], ...lip], 0.42);
        cshape(ctx, cap, {
          ...CAP,
          depth: 34,
          detail: (c) => {
            // mottled bioluminescent blotches
            const r = rng(41);
            // clusters of glowing pores and rot streaks running down the cap
            for (let i = 0; i < 6; i++) {
              const x = -60 + r() * 130;
              const y = -50 + r() * 50;
              bloom(c, x, y, 14, GLOW, 0.22);
              for (let k = 0; k < 4; k++) {
                const px = x + (r() - 0.5) * 14;
                const py = y + (r() - 0.5) * 10;
                flat(c, sell(px, py, 1.2 + r() * 1.6, 1 + r() * 1.2), k % 2 ? RAMPS.toxic[3] : GLOW, 0.9);
              }
              line(c, [[x, y + 4], [x + 6, y + 30 + r() * 20]], 3, RAMPS.toxic[2], [0.2, 0.9], 0.5);
            }
            flat(c, sblob([[-30, -40], [10, -50], [30, -30], [-10, -24]], 0.6), "#2c3a25", 0.7);
            // radial ridges
            for (let i = 0; i < 7; i++) {
              const a = -2.6 + i * 0.36;
              line(c, [[-6 + Math.cos(a) * 20, -40 + Math.sin(a) * 10], [Math.cos(a) * 96, 10 + Math.sin(a) * 60]], 1.6, INK_COLOR, [0.2, 0.4], 0.5);
            }
            // wet sheen
            glint(c, -14, -62, 40, 0.1, "#c8f0a0", 2.4, 0.55);
            glint(c, 40, -50, 18, 0.6, "#c8f0a0", 1.8, 0.4);
          },
        });
        // glowing ragged lip
        line(ctx, lip.filter((_, i) => i % 2 === 0).map(([x, y]) => [x, y - 2] as Pt), 2.2, GLOW, [0.1, 0.1], 0.7);
        // eyes peering from the dark under the brim
        for (const [x, y, rr] of [
          [62, 50, 2.6],
          [50, 44, 2],
          [70, 62, 1.8],
        ] as const) {
          bloom(ctx, x, y, 10, "#e6ffc8", 0.5);
          flat(ctx, sell(x, y, rr, rr * 0.7), "#f4ffe6");
        }
      },
    },
    {
      id: "veil",
      parent: "cap",
      at: [0, 14],
      z: 11,
      box: [-92, -8, 98, 84],
      draw: (ctx) => {
        const r = rng(73);
        const anchors: Pt[] = [[-80, 6], [-58, 0], [-34, -4], [-8, -4], [18, 0], [44, 8], [64, 22], [84, 34]];
        anchors.forEach(([x, y], i) => {
          const len = 30 + r() * 40 - (i === 3 || i === 4 ? 14 : 0);
          const sway = (r() - 0.5) * 10;
          const pts: Pt[] = [[x, y], [x + sway * 0.5, y + len * 0.5], [x + sway, y + len]];
          line(ctx, pts, 3.2, INK_COLOR, [0.1, 0.6]);
          line(ctx, pts, 1.3, "#9fae84", [0.1, 0.6], 0.7);
          if (i % 2 === 0) {
            const tip = pts[2] as Pt;
            bloom(ctx, tip[0], tip[1] + 3, 9, GLOW, 0.7);
            flat(ctx, sblob([[tip[0] - 2.4, tip[1] + 1], [tip[0], tip[1] - 2], [tip[0] + 2.4, tip[1] + 1], [tip[0], tip[1] + 5]], 0.9), GLOW_HOT);
          }
        });
      },
    },
    {
      id: "spores",
      parent: "stalk",
      at: [30, -150],
      z: 12,
      box: [-110, -110, 110, 90],
      draw: (ctx) => {
        const r = rng(91);
        for (let i = 0; i < 16; i++) {
          const x = (r() - 0.5) * 190;
          const y = -100 + r() * 170;
          const rr = 1.2 + r() * 1.8;
          bloom(ctx, x, y, rr * 5, GLOW, 0.5);
          ctx.fillStyle = GLOW_HOT;
          ctx.beginPath();
          ctx.arc(x, y, rr, 0, Math.PI * 2);
          ctx.fill();
        }
      },
    },
  ];

  return {
    id: "enemy.mycelidTender",
    parts: assemble(specs),
    height: 262,
    width: 200,
    glows: rigGlows(specs, [
      { part: "cap", x: 10, y: 46, radius: 80, color: GLOW, alpha: 0.2 },
      { part: "handFront", x: 12, y: 56, radius: 24, color: GLOW, alpha: 0.4 },
    ]),
    poses: {
      idle: {},
      breathe: {
        stalk: { rot: 1.5, sy: 1.01 },
        cap: { rot: 3, sy: 1.03, sx: 0.99 },
        veil: { rot: -4 },
        armFront: { rot: -5 },
        handFront: { rot: 6 },
        armBack: { rot: 5 },
        spores: { y: -10, rot: 3 },
      },
      windup: {
        stalk: { rot: -12 },
        cap: { rot: -10 },
        veil: { rot: 8 },
        armFront: { rot: -80 },
        handFront: { rot: -30 },
        armBack: { rot: 30 },
        spores: { y: -6 },
      },
      attack: {
        stalk: { rot: 14, x: 18 },
        cap: { rot: 18 },
        veil: { rot: -14 },
        armFront: { rot: 26 },
        handFront: { rot: 20 },
        armBack: { rot: -20 },
        spores: { x: 30, sx: 1.2, sy: 1.2 },
      },
      cast: {
        stalk: { rot: -8, sy: 1.04 },
        cap: { rot: -18, sx: 1.08, sy: 1.08 },
        veil: { rot: 14 },
        armFront: { rot: -120 },
        handFront: { rot: -40 },
        armBack: { rot: 110 },
        spores: { y: -40, sx: 1.35, sy: 1.35 },
      },
      hurt: {
        stalk: { rot: -14, x: -10 },
        cap: { rot: -16 },
        veil: { rot: 18 },
        armFront: { rot: 30 },
        armBack: { rot: 30 },
        spores: { x: -16 },
      },
      downed: {
        stalk: { rot: -62, y: 20, x: 20 },
        cap: { rot: 30 },
        veil: { rot: 40 },
        armFront: { rot: 60 },
        armBack: { rot: -60 },
        rootsFront: { rot: 70 },
        rootsBack: { rot: 60 },
        spores: { alpha: 0 },
      },
    },
  };
}
