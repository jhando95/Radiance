/**
 * Gloam Crawler: an arachnid cave hunter on high-arched, needle-tipped legs. Near-black
 * violet chitin plates with wet sheen, a bloated segmented abdomen studded with
 * bioluminescent cyan dots, a cluster of glowing eyes and hooked chelicerae.
 */
import { RAMPS } from "../../palette";
import type { Pt } from "../ink";
import type { RigDef } from "../rig";
import {
  assemble,
  type CStyle,
  cshape,
  flat,
  glint,
  INK_COLOR,
  line,
  lumDot,
  type PartSpec,
  rigGlows,
  rng,
  sblob,
  scuffs,
  shadowPart,
  stube,
} from "./kit";

const CYAN = RAMPS.crystal[4];
const CHITIN: CStyle = {
  fill: "#28213e",
  shade: "#151124",
  deep: "#08070d",
  light: "#5a4e8a",
  rimBackW: 3,
  hatch: { spacing: 4.5, alpha: 0.5 },
};
const CHITIN_FAR: CStyle = {
  ...CHITIN,
  fill: "#1c182c",
  shade: "#100d1a",
  deep: "#07060b",
  light: "#2f2848",
  rimFront: false,
};
const SHEEN = "#c9bdf2";

function bristles(ctx: CanvasRenderingContext2D, from: Pt, to: Pt, n: number, len: number, seed: number, side = -1): void {
  const r = rng(seed);
  const a = Math.atan2(to[1] - from[1], to[0] - from[0]) + (side * Math.PI) / 2;
  for (let i = 0; i < n; i++) {
    const t = (i + 0.5) / n;
    const x = from[0] + (to[0] - from[0]) * t;
    const y = from[1] + (to[1] - from[1]) * t;
    const l = len * (0.6 + r() * 0.6);
    const b = a + (r() - 0.5) * 0.5 - side * 0.5;
    line(ctx, [[x, y], [x + Math.cos(b) * l, y + Math.sin(b) * l]], 1.8, INK_COLOR, [0.05, 0.9]);
  }
}

function drawLeg(ctx: CanvasRenderingContext2D, knee: Pt, foot: Pt, far: boolean, seed: number): void {
  const st = far ? CHITIN_FAR : CHITIN;
  // tibia: knee → shin joint → needle foot
  const shin: Pt = [knee[0] + (foot[0] - knee[0]) * 0.55 + (foot[0] > knee[0] ? 4 : -4), knee[1] + (foot[1] - knee[1]) * 0.55];
  cshape(ctx, stube([knee, shin, foot], [5, 3.6, 0.9], 0.4), { ...st, depth: 4, outline: 2.6, weight: 1.2 });
  cshape(ctx, sblob([[shin[0] - 5, shin[1] - 4], [shin[0] + 5, shin[1] - 4], [shin[0] + 4, shin[1] + 5], [shin[0] - 4, shin[1] + 5]], 0.6), { ...st, depth: 3, outline: 2.2 });
  // femur: body → high knee, thicker with bristles
  const mid: Pt = [knee[0] * 0.5 + (knee[0] > 0 ? -6 : 6), knee[1] * 0.55];
  cshape(ctx, stube([[0, 0], mid, knee], [8.5, 7, 5.5], 0.4), {
    ...st,
    depth: 6,
    outline: 3,
    detail: (c) => {
      if (!far) glint(c, mid[0] + 3, mid[1] - 2, 16, Math.atan2(knee[1], knee[0]), SHEEN, 1.8, 0.6);
    },
  });
  bristles(ctx, mid, knee, 4, 7, seed, knee[0] > 0 ? -1 : 1);
  cshape(ctx, sblob([[knee[0] - 7, knee[1] - 6], [knee[0] + 7, knee[1] - 6], [knee[0] + 6, knee[1] + 6], [knee[0] - 6, knee[1] + 6]], 0.6), { ...st, depth: 4, outline: 2.6 });
  if (!far) lumDot(ctx, knee[0], knee[1] - 1, 2.2, CYAN);
}

function legSpec(id: string, at: Pt, knee: Pt, foot: Pt, z: number, far: boolean, seed: number): PartSpec {
  const xs = [0, knee[0], foot[0]];
  const ys = [0, knee[1], foot[1]];
  return {
    id,
    parent: "thorax",
    at,
    z,
    box: [Math.min(...xs) - 20, Math.min(...ys) - 20, Math.max(...xs) + 20, Math.max(...ys) + 14],
    draw: (ctx) => drawLeg(ctx, knee, foot, far, seed),
  };
}

function farPair(id: string, at: Pt, legs: [Pt, Pt][], z: number, seed: number): PartSpec {
  const xs = legs.flatMap(([k, f]) => [k[0], f[0], 0]);
  const ys = legs.flatMap(([k, f]) => [k[1], f[1], 0]);
  return {
    id,
    parent: "thorax",
    at,
    z,
    box: [Math.min(...xs) - 20, Math.min(...ys) - 20, Math.max(...xs) + 20, Math.max(...ys) + 14],
    draw: (ctx) => {
      legs.forEach(([k, f], i) => drawLeg(ctx, k, f, true, seed + i));
    },
  };
}

export function buildGloamCrawler(): RigDef {
  const specs: PartSpec[] = [
    shadowPart(112, 13, 0.55, 0),
    {
      id: "thorax",
      at: [16, -96],
      z: 5,
      box: [-44, -40, 56, 34],
      draw: (ctx) => {
        const s = sblob([[-36, -4], [-22, -26], [12, -32], [40, -20], [48, 0], [32, 20], [-6, 24], [-32, 14]]);
        cshape(ctx, s, {
          ...CHITIN,
          depth: 18,
          detail: (c) => {
            // carapace plates
            line(c, [[-30, -10], [-4, -22], [30, -18]], 2, INK_COLOR, [0.1, 0.1], 0.8);
            line(c, [[-6, -22], [-2, 6], [-10, 22]], 1.8, INK_COLOR, [0.1, 0.1], 0.7);
            line(c, [[16, -26], [20, 4], [14, 22]], 1.8, INK_COLOR, [0.1, 0.1], 0.7);
            scuffs(c, 3, -30, -28, 70, 44, 10, SHEEN);
            glint(c, 16, -24, 22, -0.15, SHEEN, 2.2, 0.75);
            glint(c, -16, -18, 12, -0.4, SHEEN, 1.6, 0.5);
          },
        });
        lumDot(ctx, 4, -14, 2.4, CYAN);
        lumDot(ctx, 26, -12, 2, CYAN);
      },
    },
    {
      id: "abdomen",
      parent: "thorax",
      at: [-28, -8],
      z: 4,
      box: [-134, -72, 20, 56],
      draw: (ctx) => {
        const s = sblob([
          [10, -8],
          [-8, -38],
          [-56, -60],
          [-102, -50],
          [-126, -16],
          [-114, 22],
          [-74, 44],
          [-26, 36],
          [6, 14],
        ]);
        cshape(ctx, s, {
          ...CHITIN,
          depth: 34,
          hatch: { spacing: 4.5, alpha: 0.5, cross: true },
          detail: (c) => {
            // segment plates (arched bands)
            for (const [i, x] of [-20, -46, -72, -96].entries()) {
              const top = -36 - Math.sin(((x + 126) / 136) * Math.PI) * 20;
              const pts: Pt[] = [[x + 8, top], [x - 4, -6], [x + 4, 30 - i * 2]];
              line(c, pts, 2.6, INK_COLOR, [0.05, 0.05]);
              line(c, pts.map(([px, py]) => [px - 4, py] as Pt), 1.6, "#5a4f86", [0.1, 0.1], 0.55);
            }
            glint(c, -60, -50, 34, -0.05, SHEEN, 2.6, 0.7);
            glint(c, -30, -36, 16, -0.4, SHEEN, 1.8, 0.55);
            scuffs(c, 7, -120, -50, 120, 80, 18, SHEEN);
          },
        });
        // bioluminescent dot rows
        const dorsal: Pt[] = [[-14, -26], [-38, -40], [-62, -46], [-86, -42], [-106, -28]];
        dorsal.forEach(([x, y], i) => lumDot(ctx, x, y, 3.2 - i * 0.25, CYAN));
        const lateral: Pt[] = [[-44, 8], [-84, 6]];
        for (const [x, y] of lateral) lumDot(ctx, x, y, 1.8, CYAN);
        // spinnerets
        cshape(ctx, sblob([[-118, 6], [-132, 2], [-134, 12], [-122, 16]], 0.5), { ...CHITIN, depth: 4, outline: 2.4 });
        // coarse hairs along the underside
        const r = rng(19);
        for (let i = 0; i < 12; i++) {
          const x = -110 + i * 9;
          const y = 24 + Math.sin((i / 11) * Math.PI) * 18;
          line(ctx, [[x, y], [x - 3 + r() * 2, y + 6 + r() * 5]], 1.6, INK_COLOR, [0.05, 0.9]);
        }
      },
    },
    farPair("farBack", [-10, 4], [[[-30, -76], [-44, 86]], [[-62, -60], [-92, 86]]], 1, 40),
    farPair("farFront", [10, 4], [[[14, -78], [34, 86]], [[42, -64], [74, 86]]], 2, 50),
    legSpec("leg4", [-20, 10], [-56, -70], [-96, 86], 6, false, 61),
    legSpec("leg3", [-8, 14], [-18, -82], [-28, 82], 7, false, 62),
    legSpec("leg2", [6, 14], [24, -78], [54, 82], 8, false, 63),
    {
      id: "head",
      parent: "thorax",
      at: [40, -2],
      z: 9,
      box: [-14, -34, 52, 36],
      draw: (ctx) => {
        const s = sblob([[-6, -18], [14, -26], [34, -14], [40, 4], [26, 20], [2, 18]]);
        cshape(ctx, s, {
          ...CHITIN,
          depth: 12,
          detail: (c) => {
            line(c, [[0, -16], [8, 0], [2, 16]], 1.6, INK_COLOR, [0.1, 0.1], 0.6);
            glint(c, 16, -20, 12, -0.3, SHEEN, 1.6, 0.6);
          },
        });
        // eye cluster: two big forward eyes and four small
        for (const [x, y, r] of [
          [30, -6, 4.6],
          [22, -14, 4],
          [13, -19, 2.6],
          [34, 6, 2.6],
          [8, -12, 2],
          [24, 2, 2.2],
        ] as const) {
          lumDot(ctx, x, y, r, CYAN, "#f4fffd");
        }
      },
    },
    {
      id: "fangs",
      parent: "head",
      at: [28, 12],
      z: 10,
      box: [-16, -12, 32, 44],
      draw: (ctx) => {
        // far chelicera (darker), then near one with a hooked pale fang
        cshape(ctx, stube([[-6, 0], [6, 14], [2, 26]], [7, 5, 3]), { ...CHITIN_FAR, depth: 4, outline: 2.4 });
        cshape(ctx, stube([[0, 0], [14, 12], [12, 24]], [8, 6, 4]), { ...CHITIN, depth: 5, outline: 2.6 });
        const fang = sblob([[8, 22], [16, 24], [12, 36], [4, 40], [8, 32]], 0.5);
        cshape(ctx, fang, {
          fill: RAMPS.bone[4],
          shade: RAMPS.bone[2],
          deep: RAMPS.bone[1],
          depth: 4,
          outline: 2,
          rimBack: false,
        });
        flat(ctx, sblob([[0, 24], [6, 24], [3, 33]], 0.5), RAMPS.bone[2]);
      },
    },
    legSpec("leg1", [18, 10], [40, -66], [80, 26], 11, false, 64),
  ];

  return {
    id: "enemy.gloamCrawler",
    parts: assemble(specs),
    height: 172,
    width: 230,
    glows: rigGlows(specs, [
      { part: "head", x: 24, y: -6, radius: 34, color: CYAN, alpha: 0.5 },
      { part: "abdomen", x: -60, y: -30, radius: 70, color: CYAN, alpha: 0.18 },
    ]),
    poses: {
      idle: {},
      breathe: {
        thorax: { y: 3 },
        abdomen: { rot: -4, sy: 1.04 },
        head: { rot: 4 },
        fangs: { rot: 10 },
        leg1: { rot: -8 },
        leg2: { rot: 2 },
        leg3: { rot: -1 },
        leg4: { rot: 2 },
        farFront: { rot: 1 },
        farBack: { rot: -1 },
      },
      windup: {
        thorax: { x: -12, y: -14, rot: -12 },
        abdomen: { rot: 10 },
        head: { rot: -12 },
        fangs: { rot: 28 },
        leg1: { rot: -40 },
        leg2: { rot: -16 },
        leg3: { rot: 8 },
        leg4: { rot: 12 },
        farFront: { rot: -8 },
        farBack: { rot: 10 },
      },
      attack: {
        thorax: { x: 34, y: 4, rot: 14 },
        abdomen: { rot: -10 },
        head: { rot: 12 },
        fangs: { rot: -16 },
        leg1: { rot: 34 },
        leg2: { rot: 18 },
        leg3: { rot: -10 },
        leg4: { rot: -22 },
        farFront: { rot: 12 },
        farBack: { rot: -16 },
      },
      cast: {
        thorax: { y: -10, rot: -6 },
        abdomen: { rot: 16, sy: 1.08 },
        head: { rot: -8 },
        fangs: { rot: 22 },
        leg1: { rot: -26 },
        leg2: { rot: -6 },
        leg4: { rot: 8 },
      },
      hurt: {
        thorax: { x: -16, y: -4, rot: -14 },
        abdomen: { rot: 12 },
        head: { rot: -16 },
        fangs: { rot: 24 },
        leg1: { rot: -30 },
        leg2: { rot: -12 },
        leg3: { rot: 10 },
        leg4: { rot: 14 },
      },
      downed: {
        thorax: { y: 62, rot: 8 },
        abdomen: { rot: -6 },
        head: { rot: 18 },
        fangs: { rot: 30 },
        leg1: { rot: 70 },
        leg2: { rot: 60 },
        leg3: { rot: -40 },
        leg4: { rot: -60 },
        farFront: { rot: 50 },
        farBack: { rot: -50 },
      },
    },
  };
}
