/**
 * The Lumen Eater (boss) and its Maw Tendrils.
 *
 * The Lumen Eater is a colossal cave worm bursting from a rubble mound: a chain of armoured
 * chitin rings arching toward the squad, ending in a circular lamprey maw ringed with teeth
 * and hooked mandibles. The light it has swallowed glows amber in its gullet and leaks
 * through the seams between its plates. Void tendrils writhe around the base.
 *
 * The Maw Tendril is a thick ringed tentacle rising from the floor, suckers along its belly
 * and a swollen amber lure at the tip.
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
  sell,
  shadowPart,
  stube,
} from "./kit";

const AMBER = RAMPS.lamp[3];
const AMBER_HOT = RAMPS.lamp[4];
const AMBER_WHITE = RAMPS.lamp[5];
const CHITIN: CStyle = {
  fill: "#2b2537",
  shade: "#17131f",
  deep: "#08070c",
  light: "#4e4565",
  hatch: { spacing: 5, alpha: 0.5, cross: true },
  rimBackW: 4,
  rimFrontW: 2.5,
  outline: 4,
};
const ROCK: CStyle = {
  fill: "#34323f",
  shade: "#1f1d27",
  deep: "#0c0b10",
  light: "#535064",
  hatch: { spacing: 5, alpha: 0.45 },
  grain: { color: "#0c0b10", alpha: 0.4, density: 0.008, seed: 3, size: 1.4 },
};
const VOID: CStyle = {
  fill: "#21153a",
  shade: "#120a22",
  deep: "#06030c",
  light: "#3a2670",
  hatch: { spacing: 4.5, alpha: 0.45 },
};
const TEETH = ["#2a2420", "#4e4339", "#8e8170", "#cbbfa8", "#efe6d2"] as const;

const deg = (d: number) => (d * Math.PI) / 180;

/** Rotate a point given in segment-axis space (x along normal, y along -axis) by angle. */
function axisPt(theta: number, along: number, side: number): Pt {
  const ux = Math.sin(theta);
  const uy = -Math.cos(theta);
  const nx = Math.cos(theta);
  const ny = Math.sin(theta);
  return [ux * along + nx * side, uy * along + ny * side];
}

/** One armoured ring segment from the pivot (0,0) along `theta` (deg from vertical). */
function segment(thetaDeg: number, len: number, r0: number, r1: number, seed: number, st: CStyle = CHITIN): PartSpec["draw"] {
  const th = deg(thetaDeg);
  return (ctx) => {
    const P = (a: number, s: number) => axisPt(th, a, s);
    const bulge = (r0 + r1) / 2 + 8;
    // The body overlaps its neighbours (below the pivot and past the tip) so bent joints
    // never open gaps.
    const body = stube([P(-r0 * 0.45, 0), P(len * 0.5, 0), P(len + r1 * 0.35, 0)], [r0 * 0.92, bulge, r1 * 0.95], 0.5);
    const rnd = rng(seed);
    // amber light leaking from the joint below
    bloom(ctx, ...P(0, r0 * 0.2), r0 * 0.9, AMBER, 0.35);
    cshape(ctx, body, {
      ...st,
      depth: r0 * 0.75,
      detail: (c) => {
        // ring seams across the segment (sagging toward the base for volume)
        for (const t of [0.18, 0.58]) {
          const a = len * t;
          const r = r0 + (bulge - r0) * Math.min(1, t * 2);
          const pts = [P(a, -r - 4), P(a - 10, -r * 0.3), P(a - 12, r * 0.3), P(a, r + 4)];
          if (t < 0.5) {
            // swallowed light leaking through the gap between rings
            const leak = [P(a - 9, -r * 0.5), P(a - 12, r * 0.1), P(a - 8, r * 0.75)];
            for (const q of leak) bloom(c, q[0], q[1], 22, AMBER, 0.32);
            line(c, leak, 8, AMBER, [0.3, 0.3], 0.85);
            line(c, leak, 3, AMBER_WHITE, [0.4, 0.4], 0.9);
          }
          line(c, pts, 4.5, INK_COLOR, [0.05, 0.05]);
          line(c, pts.map(([x, y]) => [x + Math.sin(th) * 4, y - Math.cos(th) * 4] as Pt), 1.8, "#6b6085", [0.1, 0.1], 0.6);
        }
        // overlapping plate edges on the lit (front) side
        for (const t of [0.32, 0.78]) {
          const a = len * t;
          line(c, [P(a + 6, bulge * 0.2), P(a, bulge * 0.6), P(a - 6, bulge * 1.1)], 2.4, INK_COLOR, [0.1, 0.1], 0.8);
        }
        // a hairline fracture glowing faintly
        {
          const [x, y] = P(len * (0.4 + rnd() * 0.3), (rnd() - 0.1) * bulge * 0.6);
          bloom(c, x, y, 14, AMBER, 0.25);
          crack(c, rnd, x, y, th + Math.PI / 2 + (rnd() - 0.5) * 0.6, 26, 1.8, RAMPS.lamp[2], 0);
        }
        scuffs(c, seed + 3, ...P(len, -bulge), bulge * 2, len, 16, "#9a90b8");
        const [gx, gy] = P(len * 0.45, bulge * 0.55);
        glint(c, gx, gy, len * 0.4, th - Math.PI / 2, "#cdbff0", 2.6, 0.5);
      },
    });
    // dorsal spikes on the back edge
    for (const t of [0.3, 0.72]) {
      const base = P(len * t, -bulge + 6);
      const tip = P(len * t - 18, -bulge - 34 - rnd() * 10);
      fang(ctx, base, tip, 8, TEETH, 0.25, 2.6);
    }
  };
}

function segBox(thetaDeg: number, len: number, r: number): readonly [number, number, number, number] {
  const th = deg(thetaDeg);
  const tip = axisPt(th, len + 10, 0);
  const pad = r + 60;
  return [Math.min(0, tip[0]) - pad, Math.min(0, tip[1]) - pad, Math.max(0, tip[0]) + pad, Math.max(0, tip[1]) + pad];
}

function rubble(seed: number, w: number, h: number, front: boolean): PartSpec["draw"] {
  return (ctx) => {
    const r = rng(seed);
    const n = front ? 9 : 11;
    for (let i = 0; i < n; i++) {
      const t = i / (n - 1);
      const x = -w / 2 + t * w + (r() - 0.5) * 20;
      const rw = 22 + r() * 30;
      const rh = 14 + r() * 22 + (1 - Math.abs(t - 0.5) * 2) * (front ? 10 : 26);
      const y = front ? -rh * 0.4 : -rh * 0.6 - (1 - Math.abs(t - 0.5) * 2) * h * 0.35;
      const pts: Pt[] = [];
      const k = 5 + Math.floor(r() * 3);
      for (let j = 0; j < k; j++) {
        const a = Math.PI + (j / (k - 1)) * Math.PI;
        pts.push([x + Math.cos(a) * rw * (0.8 + r() * 0.3), y + Math.sin(a) * rh * (0.8 + r() * 0.3)]);
      }
      pts.push([x + rw * 0.9, 4], [x - rw * 0.9, 4]);
      cshape(ctx, sblob(pts, 0.15), {
        ...ROCK,
        fill: front ? ROCK.fill : "#2a2833",
        depth: rh * 0.6,
        grain: { ...ROCK.grain, color: "#0c0b10", seed: seed + i },
        detail: (c) => {
          if (r() < 0.5) crack(c, r, x - rw * 0.3, y - rh * 0.3, 0.6, rw * 0.6, 1.8, INK_COLOR, 1);
        },
      });
    }
  };
}

function voidTendril(spine: Pt[], radii: number[], seed: number): PartSpec["draw"] {
  return (ctx) => {
    cshape(ctx, stube(spine, radii, 0.5), {
      ...VOID,
      depth: 12,
      outline: 3,
      detail: (c) => {
        const r = rng(seed);
        for (let i = 1; i < spine.length - 1; i++) {
          const [x, y] = spine[i] as Pt;
          const rr = (radii[i] ?? 6) * 0.9;
          line(c, [[x - rr, y + r() * 3], [x, y + 4], [x + rr, y]], 1.8, INK_COLOR, [0.2, 0.2], 0.6);
        }
      },
    });
    const tip = spine[spine.length - 1] as Pt;
    bloom(ctx, tip[0], tip[1], 10, RAMPS.umbra[4], 0.5);
  };
}

// ===========================================================================================
// The Lumen Eater
// ===========================================================================================

export function buildLumenEater(): RigDef {
  const segs: { id: string; theta: number; len: number; r0: number; r1: number }[] = [
    { id: "seg1", theta: -2, len: 124, r0: 96, r1: 88 },
    { id: "seg2", theta: 8, len: 112, r0: 88, r1: 80 },
    { id: "seg3", theta: 22, len: 100, r0: 80, r1: 74 },
    { id: "seg4", theta: 40, len: 88, r0: 74, r1: 70 },
  ];
  const specs: PartSpec[] = [shadowPart(240, 22, 0.7, -10)];
  specs.push(
    { id: "moundBack", at: [-10, 0], z: 0, box: [-260, -120, 250, 12], draw: rubble(5, 440, 120, false) },
    {
      id: "tendrilBack",
      at: [-150, -30],
      z: 1,
      box: [-110, -250, 40, 30],
      draw: voidTendril([[0, 0], [-30, -60], [-20, -130], [-60, -190], [-90, -232]], [26, 20, 14, 8, 1.5], 7),
    },
  );
  let parent: string | null = null;
  let at: Pt = [-50, -36];
  segs.forEach((s, i) => {
    specs.push({
      id: s.id,
      parent,
      at,
      z: 3 + i,
      box: segBox(s.theta, s.len, s.r0 + 10),
      draw: segment(s.theta, s.len, s.r0, s.r1, 20 + i * 7),
    });
    parent = s.id;
    at = axisPt(deg(s.theta), s.len, 0);
  });

  // Head: drawn in a frame whose +x axis runs from the neck to the maw, tilted HEAD_TILT
  // degrees down toward the squad. The oral disk sits at the end of that axis.
  const HEAD_TILT = 18;
  const ht = deg(HEAD_TILT);
  const H = (x: number, y: number): Pt => [x * Math.cos(ht) - y * Math.sin(ht), x * Math.sin(ht) + y * Math.cos(ht)];
  const MX = 150;
  const RX = 54;
  const RY = 118;
  specs.push(
    {
      id: "head",
      parent: "seg4",
      at,
      z: 8,
      box: [-150, -230, 270, 230],
      draw: (ctx) => {
        ctx.rotate(ht);
        // hood: the swollen back of the head flaring into the oral disk
        const hood = sblob([
          [-40, 74],
          [-70, 20],
          [-64, -56],
          [-20, -116],
          [50, -146],
          [118, -142],
          [MX - 10, -RY - 10],
          [MX - 4, RY + 6],
          [110, 140],
          [40, 128],
          [-10, 104],
        ], 0.5);
        cshape(ctx, hood, {
          ...CHITIN,
          depth: 64,
          detail: (c) => {
            // armoured plate rings around the hood
            for (const x of [10, 64, 110]) {
              const pts: Pt[] = [[x - 6, -150 + (x < 50 ? 30 : 0)], [x - 26, -40], [x - 26, 40], [x - 6, 140 - (x < 50 ? 30 : 0)]];
              line(c, pts, 4.5, INK_COLOR, [0.05, 0.05]);
              line(c, pts.map(([px, py]) => [px + 4, py] as Pt), 1.8, "#6b6085", [0.1, 0.1], 0.6);
            }
            // light leaking between the hood rings
            for (const x of [10, 64]) {
              const leak: Pt[] = [[x - 18, -70], [x - 23, -10], [x - 21, 50]];
              for (const q of leak) bloom(c, q[0], q[1], 22, AMBER, 0.3);
              line(c, leak, 7, AMBER, [0.3, 0.3], 0.8);
              line(c, leak, 2.6, AMBER_WHITE, [0.4, 0.4], 0.85);
            }
            scuffs(c, 67, -60, -140, 200, 270, 34, "#9a90b8");
            glint(c, 40, -128, 70, -0.2, "#cdbff0", 3, 0.55);
            glint(c, 100, -132, 24, 0.1, "#cdbff0", 2.4, 0.5);
          },
        });
        // dorsal crest spikes along the hood
        for (const [bx, by, tx, ty] of [
          [-44, -70, -96, -100],
          [-6, -112, -50, -160],
          [44, -140, 14, -200],
          [96, -142, 92, -196],
        ] as const) {
          fang(ctx, [bx, by], [tx, ty], 12, TEETH, 0.2, 3);
        }
        // flared oral disk: a plated ring around the gullet
        const ring = sell(MX, 0, RX + 24, RY + 26);
        cshape(ctx, ring, {
          ...CHITIN,
          fill: "#352d44",
          light: "#5d5378",
          depth: 22,
          detail: (c) => {
            for (let i = 0; i < 18; i++) {
              const a = (i / 18) * Math.PI * 2;
              line(c, [[MX + Math.cos(a) * RX * 0.9, Math.sin(a) * RY * 0.9], [MX + Math.cos(a) * (RX + 28), Math.sin(a) * (RY + 30)]], 2.6, INK_COLOR, [0.1, 0.1], 0.85);
            }
          },
        });
        // gullet: swallowed light
        const mouth = sell(MX, 0, RX, RY);
        flat(ctx, mouth, INK_COLOR);
        ctx.save();
        ctx.beginPath();
        mouth.path(ctx);
        ctx.clip();
        const g = ctx.createRadialGradient(MX + 8, 0, 4, MX, 0, RY);
        g.addColorStop(0, AMBER_WHITE);
        g.addColorStop(0.22, AMBER_HOT);
        g.addColorStop(0.5, RAMPS.lamp[2]);
        g.addColorStop(0.8, RAMPS.lamp[0]);
        g.addColorStop(1, "#120806");
        ctx.fillStyle = g;
        ctx.fillRect(MX - RX, -RY, RX * 2, RY * 2);
        // inner rings of teeth silhouetted against the glow
        for (const [k, n, len] of [
          [0.8, 22, 22],
          [0.56, 18, 16],
          [0.34, 14, 11],
        ] as const) {
          for (let i = 0; i < n; i++) {
            const a = (i / n) * Math.PI * 2 + k;
            const bx = MX + Math.cos(a) * RX * k;
            const by = Math.sin(a) * RY * k;
            const tx = MX + Math.cos(a) * (RX * k - len * 0.5);
            const ty = Math.sin(a) * (RY * k - len);
            line(ctx, [[bx, by], [tx, ty]], 6 * k + 2, k > 0.5 ? "#2a1206" : "#6a3410", [0.05, 0.95], 0.95);
          }
        }
        ctx.restore();
        ctx.lineWidth = 4.5;
        ctx.strokeStyle = INK_COLOR;
        ctx.beginPath();
        mouth.path(ctx);
        ctx.stroke();
        // ring of big hooked teeth around the lip, curving inward
        for (let i = 0; i < 20; i++) {
          const a = (i / 20) * Math.PI * 2;
          const bx = MX + Math.cos(a) * (RX + 6);
          const by = Math.sin(a) * (RY + 6);
          const tx = MX + Math.cos(a + 0.1) * (RX - 14);
          const ty = Math.sin(a + 0.1) * (RY - 30);
          fang(ctx, [bx, by], [tx, ty], 6.5, TEETH, 0.15, 2);
        }
      },
    },
    {
      id: "mawLight",
      parent: "head",
      at: H(MX + 4, 0),
      z: 9,
      box: [-60, -90, 60, 90],
      draw: (ctx) => {
        bloom(ctx, 0, 0, 56, AMBER_HOT, 0.5);
        bloom(ctx, 3, 0, 24, AMBER_WHITE, 0.8);
      },
    },
    {
      id: "jawUpper",
      parent: "head",
      at: H(MX - 26, -RY - 4),
      z: 10,
      box: [-60, -110, 170, 90],
      draw: (ctx) => {
        ctx.rotate(ht);
        // hooked mandible arching forward over the maw
        const m = sblob([[-30, 16], [-24, -24], [24, -50], [78, -42], [116, -10], [128, 32], [112, 62], [104, 26], [80, 4], [40, -4], [6, 22]], 0.4);
        cshape(ctx, m, {
          ...CHITIN,
          fill: "#332c42",
          depth: 26,
          detail: (c) => {
            line(c, [[-14, -6], [36, -32], [96, -18]], 2.4, INK_COLOR, [0.1, 0.2], 0.8);
            glint(c, 36, -42, 44, 0.12, "#cdbff0", 2.6, 0.55);
          },
        });
        for (let i = 0; i < 4; i++) fang(ctx, [44 + i * 16, 2 + i * 2], [46 + i * 16, 22 + i * 3], 4.5, TEETH, 0.1, 1.8);
        fang(ctx, [112, 50], [112, 86], 8, TEETH, -0.2, 2.4);
      },
    },
    {
      id: "jawLower",
      parent: "head",
      at: H(MX - 26, RY + 4),
      z: 10,
      box: [-60, -90, 170, 110],
      draw: (ctx) => {
        ctx.rotate(ht);
        const m = sblob([[-30, -16], [6, -22], [40, 4], [80, -4], [104, -26], [112, -62], [128, -32], [116, 10], [78, 42], [24, 50], [-24, 24]], 0.4);
        cshape(ctx, m, {
          ...CHITIN,
          fill: "#2a2437",
          depth: 26,
          detail: (c) => {
            line(c, [[-14, 6], [36, 32], [96, 18]], 2.4, INK_COLOR, [0.1, 0.2], 0.8);
          },
        });
        for (let i = 0; i < 4; i++) fang(ctx, [44 + i * 16, -2 - i * 2], [46 + i * 16, -22 - i * 3], 4.5, TEETH, -0.1, 1.8);
        fang(ctx, [112, -50], [112, -86], 8, TEETH, 0.2, 2.4);
      },
    },
    {
      id: "tendrilFront",
      at: [70, -20],
      z: 20,
      box: [-40, -230, 130, 30],
      draw: voidTendril([[0, 0], [30, -50], [20, -110], [60, -160], [100, -190], [116, -216]], [28, 20, 14, 9, 5, 1.2], 11),
    },
    {
      id: "tendrilSide",
      at: [-120, -16],
      z: 19,
      box: [-120, -150, 40, 30],
      draw: voidTendril([[0, 0], [-40, -30], [-60, -80], [-96, -100], [-110, -136]], [22, 16, 10, 5, 1.2], 13),
    },
    { id: "moundFront", at: [-10, 4], z: 21, box: [-250, -70, 250, 12], draw: rubble(9, 430, 60, true) },
  );

  return {
    id: "enemy.lumenEater",
    parts: assemble(specs),
    height: 580,
    width: 480,
    glows: rigGlows(specs, [
      { part: "mawLight", x: 0, y: 0, radius: 230, color: AMBER, alpha: 0.32 },
      { part: "mawLight", x: 4, y: 0, radius: 70, color: AMBER_WHITE, alpha: 0.55 },
      { part: "seg2", x: 0, y: 0, radius: 70, color: AMBER, alpha: 0.18 },
      { part: "seg4", x: 0, y: 0, radius: 60, color: AMBER, alpha: 0.18 },
    ]),
    poses: {
      idle: {},
      breathe: {
        seg1: { rot: -1 },
        seg2: { rot: -1.5 },
        seg3: { rot: 2 },
        seg4: { rot: 2.5 },
        head: { rot: 3 },
        mawLight: { sx: 1.1, sy: 1.1 },
        jawUpper: { rot: -5 },
        jawLower: { rot: 5 },
        tendrilFront: { rot: 6 },
        tendrilBack: { rot: -6 },
        tendrilSide: { rot: 5 },
      },
      windup: {
        seg1: { rot: -4 },
        seg2: { rot: -7 },
        seg3: { rot: -9 },
        seg4: { rot: -10 },
        head: { rot: -14 },
        mawLight: { sx: 1.15, sy: 1.15 },
        jawUpper: { rot: -26 },
        jawLower: { rot: 26 },
        tendrilFront: { rot: -10 },
        tendrilBack: { rot: -12 },
        tendrilSide: { rot: 10 },
      },
      attack: {
        seg1: { rot: 4, x: 22 },
        seg2: { rot: 6 },
        seg3: { rot: 8 },
        seg4: { rot: 10 },
        head: { rot: 10 },
        mawLight: { sx: 0.8, sy: 0.8 },
        jawUpper: { rot: 8 },
        jawLower: { rot: -8 },
        tendrilFront: { rot: 14 },
        tendrilBack: { rot: 10 },
        tendrilSide: { rot: -8 },
      },
      cast: {
        seg1: { rot: -2 },
        seg2: { rot: -4 },
        seg3: { rot: -6 },
        seg4: { rot: -4 },
        head: { rot: -8, sx: 1.04, sy: 1.04 },
        mawLight: { sx: 1.5, sy: 1.5 },
        jawUpper: { rot: -44 },
        jawLower: { rot: 40 },
        tendrilFront: { rot: -18 },
        tendrilBack: { rot: -16 },
        tendrilSide: { rot: 16 },
      },
      hurt: {
        seg1: { rot: -2, x: -8 },
        seg2: { rot: -6 },
        seg3: { rot: -10 },
        seg4: { rot: -12 },
        head: { rot: -16 },
        mawLight: { sx: 0.7, sy: 0.7 },
        jawUpper: { rot: -14 },
        jawLower: { rot: 18 },
        tendrilFront: { rot: -14 },
        tendrilSide: { rot: 12 },
      },
      downed: {
        seg1: { rot: 8, y: 30 },
        seg2: { rot: 22 },
        seg3: { rot: 30 },
        seg4: { rot: 28 },
        head: { rot: 26 },
        mawLight: { sx: 0.4, sy: 0.4, alpha: 0.4 },
        jawUpper: { rot: 10 },
        jawLower: { rot: 20 },
        tendrilFront: { rot: 50 },
        tendrilBack: { rot: -40 },
        tendrilSide: { rot: -40 },
      },
    },
  };
}

// ===========================================================================================
// Maw Tendril
// ===========================================================================================

export function buildMawTendril(): RigDef {
  const links: { id: string; theta: number; len: number; r0: number; r1: number }[] = [
    { id: "t1", theta: -4, len: 76, r0: 34, r1: 28 },
    { id: "t2", theta: 6, len: 70, r0: 28, r1: 23 },
    { id: "t3", theta: 18, len: 62, r0: 23, r1: 18 },
    { id: "t4", theta: 34, len: 54, r0: 18, r1: 13 },
  ];
  const specs: PartSpec[] = [
    shadowPart(80, 11, 0.6, 0),
    { id: "baseBack", at: [0, 0], z: 0, box: [-100, -60, 100, 12], draw: rubble(31, 150, 50, false) },
  ];
  let parent: string | null = null;
  let at: Pt = [-6, -14];
  links.forEach((l, i) => {
    const th = deg(l.theta);
    specs.push({
      id: l.id,
      parent,
      at,
      z: 2 + i,
      box: segBox(l.theta, l.len, l.r0),
      draw: (ctx) => {
        const P = (a: number, s: number) => axisPt(th, a, s);
        const body = stube([P(-l.r0 * 0.5, 0), P(l.len * 0.5, 0), P(l.len + l.r1 * 0.4, 0)], [l.r0 * 0.92, (l.r0 + l.r1) / 2 + 3, l.r1 * 0.95], 0.5);
        cshape(ctx, body, {
          ...CHITIN,
          depth: l.r0 * 0.8,
          rimBackW: 3,
          detail: (c) => {
            for (const t of [0.2, 0.62]) {
              const a = l.len * t;
              const r = l.r0 + 4;
              const pts = [P(a, -r), P(a - 6, -r * 0.3), P(a - 7, r * 0.3), P(a, r)];
              line(c, pts, 3.4, INK_COLOR, [0.05, 0.05]);
              line(c, pts.map(([x, y]) => [x + Math.sin(th) * 3, y - Math.cos(th) * 3] as Pt), 1.4, "#6b6085", [0.1, 0.1], 0.6);
            }
            // pale suckers along the front (belly) side
            for (const t of [0.35, 0.8]) {
              const [sx, sy] = P(l.len * t, l.r0 * 0.62);
              const rr = l.r0 * 0.24;
              flat(c, sell(sx, sy, rr + 1.6, rr + 1.6), INK_COLOR);
              flat(c, sell(sx, sy, rr, rr), "#8c7f96");
              flat(c, sell(sx + 0.6, sy, rr * 0.45, rr * 0.45), "#3a2a3e");
            }
            const [gx, gy] = P(l.len * 0.5, -l.r0 * 0.3);
            glint(c, gx, gy, l.len * 0.35, th - Math.PI / 2, "#cdbff0", 2, 0.5);
            bloom(c, ...P(l.len * 0.5, 0), 16, AMBER, 0.15 + i * 0.05);
          },
        });
        // back barbs
        fang(ctx, P(l.len * 0.5, -l.r0 + 4), P(l.len * 0.5 - 10, -l.r0 - 16), 5, TEETH, 0.25, 2);
      },
    });
    parent = l.id;
    at = axisPt(th, l.len, 0);
  });
  specs.push(
    {
      id: "lure",
      parent: "t4",
      at,
      z: 7,
      box: [-40, -50, 50, 40],
      draw: (ctx) => {
        // swollen bulb with an amber glow inside a cage of thin chitin
        bloom(ctx, 6, -10, 40, AMBER, 0.6);
        const bulb = sblob([[-12, 6], [-14, -14], [0, -30], [18, -32], [30, -18], [28, 2], [10, 10]], 0.5);
        flat(ctx, bulb, INK_COLOR);
        ctx.save();
        ctx.beginPath();
        bulb.path(ctx);
        ctx.clip();
        const g = ctx.createRadialGradient(10, -14, 2, 8, -12, 26);
        g.addColorStop(0, AMBER_WHITE);
        g.addColorStop(0.4, AMBER_HOT);
        g.addColorStop(0.8, RAMPS.lamp[2]);
        g.addColorStop(1, RAMPS.lamp[1]);
        ctx.fillStyle = g;
        ctx.fillRect(-20, -40, 60, 60);
        ctx.restore();
        for (const pts of [
          [[-10, 4], [-6, -16], [4, -30]],
          [[2, 8], [12, -8], [20, -30]],
          [[14, 8], [26, -4], [30, -16]],
        ] as Pt[][]) {
          line(ctx, pts, 3.6, INK_COLOR, [0.1, 0.4]);
        }
        ctx.lineWidth = 3.4;
        ctx.strokeStyle = INK_COLOR;
        ctx.beginPath();
        bulb.path(ctx);
        ctx.stroke();
        // trailing feelers
        line(ctx, [[22, -30], [36, -42], [44, -40]], 2.6, INK_COLOR, [0.1, 0.95]);
        line(ctx, [[28, -20], [42, -24]], 2.4, INK_COLOR, [0.1, 0.95]);
      },
    },
    { id: "baseFront", at: [0, 4], z: 10, box: [-100, -50, 100, 12], draw: rubble(37, 140, 30, true) },
  );

  return {
    id: "enemy.mawTendril",
    parts: assemble(specs),
    height: 300,
    width: 170,
    glows: rigGlows(specs, [
      { part: "lure", x: 8, y: -12, radius: 70, color: AMBER, alpha: 0.5 },
      { part: "lure", x: 8, y: -12, radius: 22, color: AMBER_WHITE, alpha: 0.7 },
    ]),
    poses: {
      idle: {},
      breathe: {
        t1: { rot: -2 },
        t2: { rot: -3 },
        t3: { rot: 4 },
        t4: { rot: 7 },
        lure: { rot: 8, sx: 1.08, sy: 1.08 },
      },
      windup: {
        t1: { rot: -8 },
        t2: { rot: -14 },
        t3: { rot: -18 },
        t4: { rot: -22 },
        lure: { rot: -16 },
      },
      attack: {
        t1: { rot: 8 },
        t2: { rot: 14 },
        t3: { rot: 18 },
        t4: { rot: 22 },
        lure: { rot: 20, sx: 1.15, sy: 1.15 },
      },
      cast: {
        t1: { rot: -4 },
        t2: { rot: -6 },
        t3: { rot: -10 },
        t4: { rot: -20 },
        lure: { rot: -10, sx: 1.4, sy: 1.4 },
      },
      hurt: {
        t1: { rot: -6 },
        t2: { rot: -10 },
        t3: { rot: -12 },
        t4: { rot: -6 },
        lure: { sx: 0.8, sy: 0.8 },
      },
      downed: {
        t1: { rot: 30, y: 10 },
        t2: { rot: 30 },
        t3: { rot: 26 },
        t4: { rot: 20 },
        lure: { sx: 0.6, sy: 0.6, alpha: 0.5 },
      },
    },
  };
}
