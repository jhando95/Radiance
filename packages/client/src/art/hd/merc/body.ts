/**
 * Merc body parts: pelvis, legs (thigh / shin / boot), torso, collar, arms (upper / fore +
 * hand) and cloth tails. Each returns an unscaled PartSpec; geometry helpers expose the
 * sockets other modules attach to.
 */
import { RAMPS } from "../../palette";
import { blob, capsule, ellipse, poly } from "../ink";
import {
  BONE,
  BRASS,
  boundsOf,
  buckle,
  clipTo,
  COLD,
  dim,
  crossHatch,
  fblob,
  fcaps,
  fell,
  fill,
  flat,
  folds,
  fpoly,
  glint,
  INK,
  LEATHER,
  LEATHER_DARK,
  line,
  type Mat,
  matR,
  mixHex,
  type PartSpec,
  type PathFn,
  type Pt,
  pouch,
  RAG,
  ragged,
  rivet,
  scratches,
  softGlow,
  STEEL,
  STEEL_DARK,
  stitches,
  strap,
  stroke,
  tintMat,
  wash,
  WOOD,
} from "./kit";
import { type MercStyle, SK } from "./style";

const heavy = (S: MercStyle) => S.armor === "heavy";
const medium = (S: MercStyle) => S.armor === "medium";
const longCoat = (S: MercStyle) =>
  S.armor !== "heavy" && (S.d === "gunner" || S.d === "lamplighter" || S.d === "hexer");

// ---------------------------------------------------------------------------
// Geometry
// ---------------------------------------------------------------------------

export function pelvisGeo(S: MercStyle) {
  const hip = S.D.hip + (heavy(S) ? 6 : 0);
  const W = hip + 90;
  const H = 110;
  const cx = W / 2;
  return {
    hip,
    W,
    H,
    cx,
    pivot: [cx, SK.pelvisPivotY] as Pt,
    torsoAt: [cx, SK.torsoAtY] as Pt,
    hipN: [cx - hip * 0.17, SK.hipSocketY] as Pt,
    hipF: [cx + hip * 0.17, SK.hipSocketY] as Pt,
    hook: [cx + hip * 0.16, 27] as Pt,
    tailAt: [cx - hip * 0.36, 20] as Pt,
    apronAt: [cx + hip * 0.26, 24] as Pt,
  };
}

export function torsoGeo(S: MercStyle) {
  const hw = S.D.sh / 2 + (heavy(S) ? 5 : medium(S) ? 2 : 0);
  const waist = S.D.waist + (heavy(S) ? 6 : 0);
  const W = hw * 2 + 96;
  const H = 214;
  const cx = W / 2 - 4;
  const py = 140;
  return {
    hw,
    waist,
    W,
    H,
    cx,
    py,
    pivot: [cx, py] as Pt,
    shN: [cx - hw * 0.56, py - SK.shoulderDy] as Pt,
    shF: [cx + hw * 0.52, py - SK.shoulderDy] as Pt,
    neck: [cx + hw * 0.06, py - SK.neckDy] as Pt,
    capeAt: [cx - hw * 0.62, py - 74] as Pt,
    scarfAt: [cx - hw * 0.2, py - 74] as Pt,
  };
}

export function upperArmGeo(S: MercStyle) {
  const A = S.D.arm + (heavy(S) ? 2 : 0);
  const W = A * 2 + 64;
  const H = 24 + SK.upper + 18;
  return { A, W, H, cx: W / 2, pivot: [W / 2, 24] as Pt, elbow: [W / 2, 24 + SK.upper] as Pt };
}

export function forearmGeo(S: MercStyle) {
  const F = S.D.fore + (heavy(S) ? 1.5 : 0);
  const Hd = S.D.hand + (heavy(S) ? 1.5 : 0);
  const W = Math.ceil(Hd * 2.8 + F * 2 + 24);
  const H = 12 + SK.grip + Hd + 14;
  const cx = W / 2;
  return {
    F,
    Hd,
    W,
    H,
    cx,
    pivot: [cx, 12] as Pt,
    wristY: 12 + SK.fore,
    grip: [cx + Hd * 0.12, 12 + SK.grip] as Pt,
  };
}

export function thighGeo(S: MercStyle) {
  const T = S.D.thigh + (heavy(S) ? 2 : 0);
  const W = T * 2 + 34;
  const H = SK.thigh + 30;
  return { T, W, H, cx: W / 2, pivot: [W / 2, 12] as Pt, knee: [W / 2, 12 + SK.thigh] as Pt };
}

export function shinGeo(S: MercStyle) {
  const s = S.D.shin + (heavy(S) ? 2 : 0);
  const W = s * 2.8 + 26;
  const H = SK.shin + 24;
  return { s, W, H, cx: W / 2, pivot: [W / 2, 8] as Pt, ankle: [W / 2, 8 + SK.shin] as Pt };
}

export function footGeo(S: MercStyle) {
  const k = S.D.foot * (heavy(S) ? 1.06 : 1);
  return { k, W: 90, H: 34, pivot: [30, 10] as Pt };
}

// ---------------------------------------------------------------------------
// Pelvis
// ---------------------------------------------------------------------------

export function pelvisPart(S: MercStyle): PartSpec {
  const g = pelvisGeo(S);
  const { hip, cx } = g;
  return {
    id: "pelvis",
    w: g.W,
    h: g.H,
    pivot: g.pivot,
    parent: null,
    at: [0, SK.pelvisY],
    z: 6,
    draw: (ctx) => {
      const rnd = S.rng(11);
      // Hips / seat of the trousers.
      fblob(
        ctx,
        [
          [cx - hip * 0.52, 14],
          [cx + hip * 0.52, 14],
          [cx + hip * 0.58, 42],
          [cx + hip * 0.36, 64],
          [cx + hip * 0.02, 70],
          [cx - hip * 0.38, 64],
          [cx - hip * 0.6, 42],
        ],
        S.pants,
        { ol: 3.4 },
      );
      folds(ctx, [
        [
          [cx + hip * 0.05, 50],
          [cx + hip * 0.02, 66],
        ],
        [
          [cx - hip * 0.3, 44],
          [cx - hip * 0.12, 58],
        ],
      ]);
      // Tassets / fauld.
      if (heavy(S)) {
        const plates: Pt[][] = [
          [
            [cx - hip * 0.08, 22],
            [cx + hip * 0.6, 22],
            [cx + hip * 0.66, 62],
            [cx + hip * 0.02, 66],
          ],
          [
            [cx - hip * 0.66, 22],
            [cx - hip * 0.06, 22],
            [cx - hip * 0.12, 60],
            [cx - hip * 0.7, 54],
          ],
        ];
        for (const p of plates) {
          fpoly(ctx, p, S.plate, { ol: 3, depth: 8 });
          const [a, b, c, d] = p as [Pt, Pt, Pt, Pt];
          for (const t of [0.36, 0.68]) {
            stroke(
              ctx,
              [
                [a[0] + (d[0] - a[0]) * t, a[1] + (d[1] - a[1]) * t],
                [b[0] + (c[0] - b[0]) * t, b[1] + (c[1] - b[1]) * t],
              ],
              2,
            );
          }
          rivet(ctx, a[0] + 5, a[1] + 6, 1.8);
          rivet(ctx, b[0] - 5, b[1] + 6, 1.8);
        }
        scratches(ctx, rnd, { x: cx - hip * 0.6, y: 30, w: hip * 1.2, h: 26 }, 4);
      } else if (medium(S)) {
        // Leather fauld flaps.
        for (const [x0, x1] of [
          [cx + hip * 0.02, cx + hip * 0.56],
          [cx - hip * 0.62, cx - hip * 0.1],
        ] as const) {
          fpoly(
            ctx,
            [
              [x0, 22],
              [x1, 22],
              [x1 + 3, 54],
              [x0 - 2, 56],
            ],
            LEATHER,
            { ol: 2.6, depth: 6 },
          );
          stitches(
            ctx,
            [
              [x0 + 3, 50],
              [x1 - 1, 49],
            ],
            4,
          );
          rivet(ctx, (x0 + x1) / 2, 30, 1.8);
        }
      }
      // Belt (slight perspective dip toward the front).
      const belt: Pt[] = [
        [cx - hip * 0.62, 12],
        [cx + hip * 0.58, 15],
        [cx + hip * 0.6, 29],
        [cx - hip * 0.62, 25],
      ];
      fpoly(ctx, belt, LEATHER_DARK, { ol: 3, hatch: false, depth: 5 });
      stitches(
        ctx,
        [
          [cx - hip * 0.58, 15],
          [cx + hip * 0.56, 18],
        ],
        5,
        1.6,
        RAMPS.leather[4],
        0.5,
      );
      buckle(ctx, cx + hip * 0.36, 21, 10, 12);
      // Pouches & kit.
      pouch(ctx, cx - hip * 0.6, 20, 17, 17, LEATHER);
      if (S.d === "gunner" || S.d === "reaver") {
        // Slung second belt with ammo / knife.
        strap(ctx, [cx - hip * 0.6, 28], [cx + hip * 0.55, 38], 7, LEATHER, { stitch: false });
        pouch(ctx, cx - hip * 0.1, 30, 12, 13, LEATHER_DARK, 2.2);
        if (S.d === "gunner") {
          for (let i = 0; i < 4; i++) {
            const x = cx + hip * 0.12 + i * 6;
            fpoly(
              ctx,
              [
                [x, 30 + i * 0.6],
                [x + 4, 30 + i * 0.6],
                [x + 4, 40 + i * 0.6],
                [x, 40 + i * 0.6],
              ],
              BRASS,
              { ol: 1.4, hatch: false, rim: false },
            );
          }
        }
      }
      if (S.d === "lamplighter") {
        // Oil flask.
        fblob(
          ctx,
          [
            [cx - hip * 0.18, 26],
            [cx - hip * 0.02, 26],
            [cx, 44],
            [cx - hip * 0.1, 50],
            [cx - hip * 0.22, 44],
          ],
          matR(RAMPS.lamp, 2),
          { ol: 2.2, hatch: false },
        );
        softGlow(ctx, cx - hip * 0.11, 40, 8, RAMPS.lamp[4], 0.35);
      }
      if (S.d === "hexer") {
        // Bone fetishes on cords.
        for (let i = 0; i < 3; i++) {
          const x = cx - hip * 0.2 + i * 9;
          const len = 14 + i * 5;
          stroke(
            ctx,
            [
              [x, 24],
              [x + 1, 24 + len],
            ],
            1.2,
            RAMPS.bone[2],
          );
          fell(ctx, x + 1, 26 + len, 2.6, 4, BONE, { ol: 1.4, hatch: false, rim: false });
        }
      }
      // Lantern hook ring.
      if (S.lamp !== "none") {
        ctx.save();
        ctx.lineWidth = 2.6;
        ctx.strokeStyle = INK;
        ctx.beginPath();
        ctx.arc(g.hook[0], g.hook[1], 3.6, 0, Math.PI * 2);
        ctx.stroke();
        ctx.lineWidth = 1.3;
        ctx.strokeStyle = RAMPS.steel[4];
        ctx.stroke();
        ctx.restore();
      }
      if (S.hostile) {
        // Red rag sash knotted on the hip, tails hanging.
        const r2 = S.rng(12);
        const kx = cx - hip * 0.3;
        fpoly(
          ctx,
          [[cx - hip * 0.64, 13], [cx + hip * 0.6, 16], [cx + hip * 0.6, 26], [cx - hip * 0.64, 24]],
          RAG,
          { ol: 2.4, hatch: false, depth: 4 },
        );
        for (const [dx, len] of [
          [-6, 44],
          [4, 34],
        ] as const) {
          fpoly(
            ctx,
            [
              [kx + dx - 4, 20],
              [kx + dx + 5, 20],
              [kx + dx + 2 + len * 0.15, 20 + len],
              ...ragged(r2, kx + dx + len * 0.15, kx + dx - 6 + len * 0.12, 20 + len, 6, 4),
            ],
            RAG,
            { ol: 2.2, depth: 4 },
          );
        }
        fell(ctx, kx, 20, 6, 5, RAG, { ol: 2.4, hatch: false });
      }
    },
  };
}

// ---------------------------------------------------------------------------
// Legs
// ---------------------------------------------------------------------------

/** Re-outline a path (crisp contour after clipped interior detail). */
function reink(ctx: CanvasRenderingContext2D, path: PathFn, w: number) {
  ctx.save();
  ctx.beginPath();
  path(ctx);
  ctx.strokeStyle = INK;
  ctx.lineWidth = w;
  ctx.stroke();
  ctx.restore();
}

/** Ring-mail texture inside any path. */
function mailIn(ctx: CanvasRenderingContext2D, path: PathFn, b: { x: number; y: number; w: number; h: number }) {
  clipTo(ctx, path, () => {
    ctx.lineWidth = 1;
    for (let y = b.y; y < b.y + b.h + 4; y += 4) {
      for (let x = b.x + ((y / 4) % 2) * 2.5; x < b.x + b.w + 4; x += 5) {
        ctx.strokeStyle = INK;
        ctx.globalAlpha = 0.55;
        ctx.beginPath();
        ctx.arc(x, y, 2.2, 0.2, Math.PI - 0.2);
        ctx.stroke();
        ctx.strokeStyle = RAMPS.steel[4];
        ctx.globalAlpha = 0.3;
        ctx.beginPath();
        ctx.arc(x, y - 0.8, 1.6, Math.PI + 0.4, Math.PI * 2 - 0.4);
        ctx.stroke();
      }
    }
  });
}

export function thighPart(S: MercStyle, far: boolean): PartSpec {
  const g = thighGeo(S);
  const pg = pelvisGeo(S);
  const { T, cx } = g;
  const M = (m: Mat) => (far ? S.far(m) : dim(m, 0.08));
  const y0 = g.pivot[1];
  const ky = g.knee[1];
  const limb = capsule(cx, y0, cx + T * 0.06, ky, T * 1.12, T * 0.84);
  const box = { x: cx - T * 1.2, y: y0 - T * 1.2, w: T * 2.4, h: ky - y0 + T * 2.2 };
  return {
    id: far ? "thighB" : "thighF",
    w: g.W,
    h: g.H,
    pivot: g.pivot,
    parent: "pelvis",
    at: far ? pg.hipF : pg.hipN,
    z: far ? 4.2 : 7.6,
    draw: (ctx) => {
      fill(ctx, limb, box, M(S.pants), { ol: 3.6, hatch: 5 });
      clipTo(ctx, limb, () => {
        // Lit quad plane + side seam.
        wash(ctx, blob([[cx + T * 0.1, y0 + 4], [cx + T * 1.0, y0 + 10], [cx + T * 0.8, ky - 16], [cx + T * 0.3, ky - 24]], 0.5), M(S.pants).light, 0.25);
        stitches(ctx, [[cx - T * 0.1, y0 + 2], [cx - T * 0.15, ky]], 5, 2.2, INK, 0.35);
        folds(ctx, [
          [[cx - T * 0.9, y0 + 8], [cx - T * 0.2, y0 + 20]],
          [[cx + T * 0.1, ky - 16], [cx + T * 0.8, ky - 6]],
          [[cx - T * 0.8, ky - 14], [cx - T * 0.2, ky - 6]],
        ]);
        if (!heavy(S)) {
          // Knee patch.
          fblob(ctx, [[cx - T * 0.4, ky - 12], [cx + T * 0.9, ky - 14], [cx + T * 1.0, ky + 8], [cx - T * 0.3, ky + 10]], M(medium(S) ? LEATHER : tintMat(S.pants, RAMPS.leather[2], 0.45)), { ol: 2.4, hatch: false }, 0.3);
          stitches(ctx, [[cx - T * 0.3, ky - 9], [cx + T * 0.85, ky - 11]], 4, 2);
        }
      });
      reink(ctx, limb, 3.6);
      if (heavy(S)) {
        const cuisse: Pt[] = [[cx - T * 0.55, y0 + 4], [cx + T * 1.16, y0], [cx + T * 0.98, ky - 10], [cx - T * 0.3, ky - 6]];
        fpoly(ctx, cuisse, M(S.plate), { ol: 3, depth: 9 });
        stroke(ctx, [[cx + T * 0.32, y0 + 4], [cx + T * 0.28, ky - 10]], 1.6, RAMPS.steel[5], 0.5);
        rivet(ctx, cx - T * 0.3, y0 + 10, 1.8);
        rivet(ctx, cx + T * 0.92, y0 + 8, 1.8);
        scratches(ctx, S.rng(far ? 31 : 32), { x: cx - T * 0.3, y: y0 + 10, w: T * 1.2, h: 40 }, 3);
        fell(ctx, cx + T * 0.25, ky, T * 0.88, T * 0.72, M(S.plate), { ol: 3, depth: 6 });
        fpoly(ctx, [[cx + T * 0.8, ky - 6], [cx + T * 1.4, ky], [cx + T * 0.8, ky + 8]], M(S.plate), { ol: 2.4, hatch: false });
        rivet(ctx, cx + T * 0.25, ky, 2);
      } else if (!far && (S.d === "reaver" || S.d === "gunner")) {
        // Thigh rig: strapped sheath / holster.
        fpoly(ctx, [[cx - T * 0.6, y0 + 8], [cx + T * 0.1, y0 + 8], [cx, ky - 14], [cx - T * 0.35, ky - 8]], LEATHER, { ol: 2.4, depth: 5 });
        if (S.d === "gunner") fcaps(ctx, cx - T * 0.25, y0 + 2, cx - T * 0.25, y0 + 14, 5, 5, WOOD, { ol: 2, hatch: false });
        else fpoly(ctx, [[cx - T * 0.45, y0 + 8], [cx - T * 0.05, y0 + 8], [cx - T * 0.2, y0 - 8]], STEEL_DARK, { ol: 1.8, hatch: false });
        clipTo(ctx, limb, () => {
          strap(ctx, [cx - T * 1.2, y0 + 16], [cx + T * 1.2, y0 + 20], 6, LEATHER_DARK, { stitch: false });
          strap(ctx, [cx - T * 1.2, y0 + 38], [cx + T * 1.2, y0 + 42], 6, LEATHER_DARK, { stitch: false });
        });
        buckle(ctx, cx + T * 0.6, y0 + 19, 7, 8);
      } else if (medium(S)) {
        clipTo(ctx, limb, () => strap(ctx, [cx - T * 1.2, y0 + 26], [cx + T * 1.2, y0 + 30], 6, LEATHER_DARK, { stitch: false }));
        buckle(ctx, cx + T * 0.5, y0 + 28, 7, 8);
      }
    },
  };
}

export function shinPart(S: MercStyle, far: boolean): PartSpec {
  const g = shinGeo(S);
  const tg = thighGeo(S);
  const { s, cx } = g;
  const M = (m: Mat) => (far ? S.far(m) : dim(m, 0.12));
  const tall = S.d !== "lamplighter";
  const y0 = g.pivot[1];
  const ay = g.ankle[1];
  const limb = capsule(cx, y0, cx, ay, s * 1.02, s * 0.78);
  return {
    id: far ? "shinB" : "shinF",
    w: g.W,
    h: g.H,
    pivot: g.pivot,
    parent: far ? "thighB" : "thighF",
    at: tg.knee,
    z: far ? 4.0 : 7.3,
    draw: (ctx) => {
      fill(ctx, limb, { x: cx - s * 1.2, y: y0 - s, w: s * 2.4, h: ay - y0 + s * 2 }, M(S.pants), { ol: 3.4, hatch: 5 });
      // Calf.
      fblob(ctx, [[cx - s * 0.3, y0 + 2], [cx - s * 1.22, y0 + 18], [cx - s * 1.05, y0 + 40], [cx - s * 0.3, y0 + 46]], M(S.pants), { ol: 3.2, hatch: 4 }, 0.5);
      const top = tall ? y0 + 16 : y0 + 32;
      const shaft: Pt[] = [
        [cx - s * 1.32, top + 2],
        [cx + s * 1.2, top - 2],
        [cx + s * 1.04, top + 18],
        [cx + s * 0.92, ay + 4],
        [cx - s * 1.0, ay + 6],
        [cx - s * 1.2, top + 24],
      ];
      fblob(ctx, shaft, M(S.boot), { ol: 3.4, hatch: 4 }, 0.35);
      fpoly(ctx, [[cx - s * 1.38, top + 1], [cx + s * 1.28, top - 3], [cx + s * 1.2, top + 9], [cx - s * 1.3, top + 12]], M(tintMat(S.boot, RAMPS.leather[4], 0.3)), { ol: 2.8, hatch: false, depth: 4 });
      stitches(ctx, [[cx - s * 1.2, top + 9], [cx + s * 1.1, top + 5]], 4, 1.8, RAMPS.leather[4], 0.6);
      folds(ctx, [[[cx - s * 0.6, top + 22], [cx - s * 0.1, top + 30]], [[cx - s * 0.5, ay - 10], [cx + s * 0.2, ay - 6]]], 1.6);
      if (heavy(S)) {
        const greave: Pt[] = [[cx - s * 0.15, top - 6], [cx + s * 1.34, top - 10], [cx + s * 1.1, ay - 2], [cx - s * 0.05, ay + 2]];
        fpoly(ctx, greave, M(S.plate), { ol: 3, depth: 8 });
        stroke(ctx, [[cx + s * 0.62, top - 6], [cx + s * 0.55, ay - 4]], 1.6, RAMPS.steel[5], 0.55);
        rivet(ctx, cx + s * 0.1, top + 4, 1.8);
        rivet(ctx, cx + s * 0.15, ay - 8, 1.8);
        scratches(ctx, S.rng(far ? 41 : 42), { x: cx, y: top, w: s, h: 36 }, 3);
      } else {
        for (const y of [top + 24, top + 38]) {
          if (y > ay - 2) continue;
          strap(ctx, [cx - s * 1.14, y + 2], [cx + s * 1.1, y - 1], 5, M(LEATHER_DARK), { stitch: false, ol: 1.8 });
          buckle(ctx, cx + s * 0.55, y, 6, 7);
        }
      }
      if (medium(S)) {
        fblob(ctx, [[cx - s * 0.6, y0 - 8], [cx + s * 1.1, y0 - 10], [cx + s * 1.3, y0 + 8], [cx + s * 0.4, y0 + 16], [cx - s * 0.4, y0 + 10]], M(STEEL_DARK), { ol: 2.8, depth: 5 });
        rivet(ctx, cx + s * 0.35, y0 + 2, 1.8);
      }
    },
  };
}

export function footPart(S: MercStyle, far: boolean): PartSpec {
  const g = footGeo(S);
  const sg = shinGeo(S);
  const k = g.k;
  const [px, py] = g.pivot;
  const M = (m: Mat) => (far ? S.far(m) : m);
  const X = (v: number) => px + v * k;
  return {
    id: far ? "footB" : "footF",
    w: g.W,
    h: g.H,
    pivot: g.pivot,
    parent: far ? "shinB" : "shinF",
    at: sg.ankle,
    z: far ? 3.8 : 7.1,
    draw: (ctx) => {
      const sole = py + 14;
      const body: Pt[] = [
        [X(-13), py - 8],
        [X(11), py - 8],
        [X(20), py + 1],
        [X(33), py + 4],
        [X(42), py + 9],
        [X(43), sole - 1],
        [X(-16), sole - 1],
        [X(-17), py + 1],
      ];
      fblob(ctx, body, M(S.boot), { ol: 3.4, hatch: 4 }, 0.3);
      // Toe cap.
      fblob(
        ctx,
        [
          [X(28), py + 3],
          [X(38), py + 6],
          [X(43), py + 11],
          [X(42), sole - 2],
          [X(27), sole - 2],
        ],
        M(heavy(S) || S.d === "vanguard" ? STEEL : tintMat(S.boot, RAMPS.leather[4], 0.3)),
        { ol: 2.4, hatch: false },
        0.3,
      );
      // Sole + heel block.
      fpoly(
        ctx,
        [
          [X(-17), sole - 4],
          [X(44), sole - 4],
          [X(43), sole + 1],
          [X(-17), sole + 1],
        ],
        M(matR(RAMPS.rock, 2)),
        { ol: 2.4, hatch: false, rim: false, light: false },
      );
      for (let i = 0; i < 8; i++) {
        const x = X(-14 + i * 7);
        stroke(
          ctx,
          [
            [x, sole - 3],
            [x, sole + 1],
          ],
          1,
          RAMPS.rock[0],
          0.8,
        );
      }
      // Instep strap / laces.
      if (heavy(S)) {
        for (const x of [4, 13, 22]) {
          stroke(
            ctx,
            [
              [X(x), py - 6 + x * 0.3],
              [X(x + 5), sole - 5],
            ],
            2,
          );
        }
      } else {
        strap(ctx, [X(2), py - 6], [X(16), sole - 5], 5, M(LEATHER_DARK), { stitch: false, ol: 1.8 });
        buckle(ctx, X(10), py + 1, 5, 6);
      }
    },
  };
}

// ---------------------------------------------------------------------------
// Torso
// ---------------------------------------------------------------------------

function torsoOutline(g: ReturnType<typeof torsoGeo>): Pt[] {
  const { cx, hw, waist, py } = g;
  return [
    [cx - hw * 0.4, py - 86],
    [cx + hw * 0.3, py - 88],
    [cx + hw * 0.82, py - 80],
    [cx + hw * 1.02, py - 58],
    [cx + hw * 0.92, py - 34],
    [cx + waist * 0.54, py - 2],
    [cx - waist * 0.5, py],
    [cx - hw * 0.78, py - 34],
    [cx - hw * 0.96, py - 72],
  ];
}

/** Lamp-sun emblem: circle with rays (squad sigil). */
function sigil(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, color: string) {
  ctx.save();
  ctx.strokeStyle = INK;
  ctx.lineWidth = 3.2;
  ctx.beginPath();
  ctx.arc(x, y, r * 0.45, 0, Math.PI * 2);
  ctx.stroke();
  ctx.strokeStyle = color;
  ctx.lineWidth = 1.8;
  ctx.stroke();
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2 - Math.PI / 2;
    const r0 = r * 0.62;
    const r1 = i % 2 === 0 ? r : r * 0.82;
    line(
      ctx,
      [
        [x + Math.cos(a) * r0, y + Math.sin(a) * r0],
        [x + Math.cos(a) * r1, y + Math.sin(a) * r1],
      ],
      i % 2 === 0 ? 3 : 2.2,
      color,
      [0.1, 0.6],
    );
  }
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(x, y, r * 0.18, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

/** Ring-mail texture inside a path. */
function mailTex(ctx: CanvasRenderingContext2D, pts: readonly Pt[]) {
  const b = boundsOf(pts);
  ctx.save();
  ctx.beginPath();
  poly(pts)(ctx);
  ctx.clip();
  ctx.lineWidth = 1;
  for (let y = b.y; y < b.y + b.h + 4; y += 4) {
    for (let x = b.x + ((y / 4) % 2) * 2.5; x < b.x + b.w + 4; x += 5) {
      ctx.strokeStyle = INK;
      ctx.globalAlpha = 0.6;
      ctx.beginPath();
      ctx.arc(x, y, 2.2, 0.2, Math.PI - 0.2);
      ctx.stroke();
      ctx.strokeStyle = RAMPS.steel[4];
      ctx.globalAlpha = 0.35;
      ctx.beginPath();
      ctx.arc(x, y - 0.8, 1.6, Math.PI + 0.4, Math.PI * 2 - 0.4);
      ctx.stroke();
    }
  }
  ctx.restore();
}

export function torsoPart(S: MercStyle): PartSpec {
  const g = torsoGeo(S);
  const pg = pelvisGeo(S);
  const { cx, hw, waist, py } = g;
  const out = torsoOutline(g);
  const Y = (dy: number) => py - dy;
  return {
    id: "torso",
    w: g.W,
    h: g.H,
    pivot: g.pivot,
    parent: "pelvis",
    at: pg.torsoAt,
    z: 9,
    draw: (ctx) => {
      const rnd = S.rng(21);
      // ---- coat skirt (front flap below the waist) ----
      const skirt = heavy(S) ? 0 : longCoat(S) ? 58 : S.d === "reaver" ? 26 : 30;
      if (skirt > 0) {
        const hem = ragged(rnd, cx + waist * 0.72, cx - waist * 0.1, py + skirt, S.d === "hexer" ? 10 : 3, 7, -4);
        const flap: Pt[] = [[cx - waist * 0.16, py - 6], [cx + waist * 0.56, py - 6], ...hem];
        const coatMat = medium(S) ? S.sec : S.pri;
        fpoly(ctx, flap, coatMat, { ol: 3.2, hatch: 5 });
        folds(ctx, [
          [
            [cx + waist * 0.25, py + 4],
            [cx + waist * 0.32, py + skirt - 6],
          ],
          [
            [cx + waist * 0.5, py + 6],
            [cx + waist * 0.62, py + skirt - 10],
          ],
        ]);
        stitches(
          ctx,
          hem.map(([x, y]) => [x, y - 5] as Pt).filter((_, i) => i % 1 === 0),
          5,
          2,
          S.trim,
          0.5,
        );
      }

      // ---- base torso ----
      const baseMat = heavy(S) ? S.mail : medium(S) ? S.sec : S.d === "reaver" ? LEATHER : S.pri;
      fblob(ctx, out, baseMat, { ol: 4, hatch: 5 }, 0.42);
      if (heavy(S)) mailTex(ctx, out);

      if (heavy(S)) {
        // ---- cuirass ----
        const cu: Pt[] = [
          [cx - hw * 0.62, Y(80)],
          [cx + hw * 0.2, Y(84)],
          [cx + hw * 0.8, Y(76)],
          [cx + hw * 1.04, Y(56)],
          [cx + hw * 0.94, Y(30)],
          [cx + waist * 0.56, Y(2)],
          [cx - waist * 0.52, Y(0)],
          [cx - hw * 0.8, Y(32)],
          [cx - hw * 0.84, Y(64)],
        ];
        fblob(ctx, cu, S.plate, { ol: 4, hatch: 5, depth: 16 }, 0.4);
        // Keel ridge & lames.
        line(
          ctx,
          [
            [cx + hw * 0.36, Y(82)],
            [cx + hw * 0.52, Y(56)],
            [cx + hw * 0.44, Y(32)],
          ],
          2.4,
        );
        glint(ctx, [
          [cx + hw * 0.58, Y(74)],
          [cx + hw * 0.7, Y(56)],
          [cx + hw * 0.66, Y(42)],
        ], 2.4, RAMPS.steel[5]);
        for (const dy of [28, 18, 8]) {
          const yl = Y(dy);
          ctx.save();
          ctx.beginPath();
          blob(cu, 0.4)(ctx);
          ctx.clip();
          fpoly(
            ctx,
            [
              [cx - hw, yl],
              [cx + hw * 1.1, yl - 4],
              [cx + hw * 1.1, yl + 12],
              [cx - hw, yl + 14],
            ],
            tintMat(S.plate, COLD, 0.1),
            { ol: 2.6, hatch: false, depth: 4 },
          );
          ctx.restore();
          rivet(ctx, cx + waist * 0.4, yl + 4, 1.7);
          rivet(ctx, cx - waist * 0.35, yl + 5, 1.7);
        }
        // Edge trim (secondary colour) + rivets along the arm hole.
        stroke(
          ctx,
          [
            [cx - hw * 0.6, Y(78)],
            [cx + hw * 0.2, Y(82)],
            [cx + hw * 0.78, Y(74)],
          ],
          3,
          S.trim,
          0.9,
        );
        for (let i = 0; i < 5; i++) rivet(ctx, cx - hw * 0.45 + i * hw * 0.28, Y(78 - (i === 4 ? -3 : 0)), 1.8);
        scratches(ctx, rnd, { x: cx - hw * 0.5, y: Y(70), w: hw * 1.3, h: 36 }, 7);
      } else if (medium(S)) {
        // Quilted gambeson lines.
        ctx.save();
        ctx.beginPath();
        blob(out, 0.42)(ctx);
        ctx.clip();
        for (let x = cx - hw; x < cx + hw * 1.1; x += 9) {
          stroke(
            ctx,
            [
              [x, Y(92)],
              [x + 6, py],
            ],
            1.2,
            INK,
            0.35,
          );
        }
        ctx.restore();
        // Vest.
        const vest: Pt[] = [
          [cx - hw * 0.72, Y(74)],
          [cx - hw * 0.12, Y(84)],
          [cx + hw * 0.22, Y(66)],
          [cx + hw * 0.6, Y(82)],
          [cx + hw * 1.0, Y(58)],
          [cx + hw * 0.92, Y(32)],
          [cx + waist * 0.56, Y(0)],
          [cx - waist * 0.52, Y(-2)],
          [cx - hw * 0.8, Y(34)],
        ];
        const vestMat = S.pri;
        fpoly(ctx, vest, vestMat, { ol: 3.6, hatch: 5, depth: 14 });
        // Riveted plate inserts.
        const ins: Pt[] = [
          [cx + hw * 0.36, Y(62)],
          [cx + hw * 0.9, Y(56)],
          [cx + hw * 0.84, Y(30)],
          [cx + hw * 0.34, Y(26)],
        ];
        fpoly(ctx, ins, S.plate, { ol: 2.6, depth: 7 });
        for (const p of ins) rivet(ctx, p[0] + (p[0] > cx + hw * 0.6 ? -4 : 4), p[1] + (p[1] < Y(40) ? 4 : -4), 1.7);
        scratches(ctx, rnd, boundsOf(ins), 3);
        // Front buckled straps.
        for (const dy of [56, 40, 22]) {
          strap(ctx, [cx + hw * 0.08, Y(dy) + 1], [cx + hw * 0.42, Y(dy) - 1], 6, LEATHER_DARK, {
            stitch: false,
            ol: 1.8,
          });
          buckle(ctx, cx + hw * 0.28, Y(dy), 7, 8);
        }
        stitches(
          ctx,
          [
            [cx - hw * 0.66, Y(70)],
            [cx - hw * 0.76, Y(36)],
            [cx - waist * 0.46, Y(4)],
          ],
          5,
          2.2,
          S.trim,
          0.55,
        );
      } else {
        // ---- light: coat / jerkin ----
        // Shirt V + lapels.
        const v: Pt[] = [
          [cx - hw * 0.02, Y(86)],
          [cx + hw * 0.52, Y(86)],
          [cx + hw * 0.3, Y(50)],
        ];
        fpoly(ctx, v, S.d === "reaver" ? S.sec : matR(RAMPS.bone, 3), { ol: 2.6, hatch: false });
        const lapF: Pt[] = [
          [cx + hw * 0.48, Y(88)],
          [cx + hw * 0.86, Y(78)],
          [cx + hw * 0.62, Y(56)],
          [cx + hw * 0.72, Y(48)],
          [cx + hw * 0.32, Y(46)],
        ];
        const lapB: Pt[] = [
          [cx - hw * 0.08, Y(88)],
          [cx + hw * 0.18, Y(64)],
          [cx + hw * 0.3, Y(46)],
          [cx + hw * 0.08, Y(52)],
          [cx - hw * 0.24, Y(76)],
        ];
        fpoly(ctx, lapB, S.sec, { ol: 2.8, depth: 6 });
        fpoly(ctx, lapF, S.sec, { ol: 2.8, depth: 6 });
        // Opening + toggles.
        line(
          ctx,
          [
            [cx + hw * 0.3, Y(46)],
            [cx + hw * 0.36, Y(24)],
            [cx + waist * 0.4, Y(0)],
          ],
          2.6,
        );
        for (let i = 0; i < 3; i++) {
          const yy = Y(40 - i * 13);
          fcaps(ctx, cx + hw * 0.26, yy, cx + hw * 0.46, yy - 1, 2, 2, BONE, {
            ol: 1.4,
            hatch: false,
            rim: false,
          });
        }
        folds(ctx, [
          [
            [cx - hw * 0.5, Y(60)],
            [cx - hw * 0.2, Y(40)],
          ],
          [
            [cx + hw * 0.7, Y(36)],
            [cx + hw * 0.6, Y(14)],
          ],
          [
            [cx - hw * 0.3, Y(22)],
            [cx, Y(10)],
          ],
        ]);
        stitches(
          ctx,
          [
            [cx - hw * 0.84, Y(66)],
            [cx - hw * 0.7, Y(34)],
            [cx - waist * 0.46, Y(4)],
          ],
          5,
          2.2,
          S.trim,
          0.5,
        );
        if (S.d === "reaver") {
          // Crossed harness with throwing knives.
          strap(ctx, [cx - hw * 0.5, Y(84)], [cx + waist * 0.5, Y(6)], 7, LEATHER_DARK);
          strap(ctx, [cx + hw * 0.8, Y(78)], [cx - waist * 0.4, Y(8)], 7, LEATHER_DARK);
          for (let i = 0; i < 3; i++) {
            const t = 0.25 + i * 0.16;
            const x = cx - hw * 0.5 + (waist * 0.5 + hw * 0.5) * t;
            const y = Y(84) + (Y(6) - Y(84)) * t;
            fpoly(
              ctx,
              [
                [x - 2, y - 10],
                [x + 3, y - 12],
                [x + 4, y + 2],
                [x - 1, y + 4],
              ],
              STEEL,
              { ol: 1.6, hatch: false },
            );
          }
          fell(ctx, cx + hw * 0.18, Y(46), 5, 5, STEEL, { ol: 2, hatch: false });
        }
      }

      // ---- discipline overlays ----
      if (S.d === "vanguard") {
        // Tabard with the lamp-sun sigil.
        const tab: Pt[] = [
          [cx + hw * 0.0, Y(70)],
          [cx + hw * 0.74, Y(72)],
          [cx + waist * 0.62, Y(-2)],
          [cx - waist * 0.04, Y(-2)],
        ];
        fpoly(ctx, tab, S.sec, { ol: 3.2, hatch: 5, depth: 10 });
        stitches(
          ctx,
          [
            [cx + hw * 0.06, Y(66)],
            [cx + waist * 0.02, Y(2)],
          ],
          5,
          2,
          S.trim,
          0.7,
        );
        stitches(
          ctx,
          [
            [cx + hw * 0.68, Y(68)],
            [cx + waist * 0.56, Y(2)],
          ],
          5,
          2,
          S.trim,
          0.7,
        );
        sigil(ctx, cx + hw * 0.38, Y(40), hw * 0.22, S.trim);
        // Baldric chain.
        for (let i = 0; i < 9; i++) {
          const t = i / 8;
          const x = cx - hw * 0.62 + (hw * 1.5) * t;
          const y = Y(80) + 60 * t;
          fell(ctx, x, y, 3.4, 2.4, STEEL, { ol: 1.4, hatch: false }, 0.6);
        }
      } else if (S.d === "gunner") {
        // Bandolier with brass shells.
        const a: Pt = [cx - hw * 0.62, Y(82)];
        const b: Pt = [cx + waist * 0.56, Y(6)];
        strap(ctx, a, b, 11, LEATHER_DARK);
        for (let i = 1; i < 9; i++) {
          const t = i / 9;
          const x = a[0] + (b[0] - a[0]) * t;
          const y = a[1] + (b[1] - a[1]) * t;
          fpoly(
            ctx,
            [
              [x - 3, y - 7],
              [x + 2, y - 8],
              [x + 3, y + 1],
              [x - 2, y + 2],
            ],
            BRASS,
            { ol: 1.3, hatch: false },
          );
          flat(ctx, ellipse(x - 0.5, y - 7.5, 2.3, 1.2), RAMPS.lamp[1]);
        }
        // Shoulder patch on the coat.
        if (!heavy(S) && !medium(S)) {
          fblob(
            ctx,
            [
              [cx + hw * 0.6, Y(76)],
              [cx + hw * 0.92, Y(70)],
              [cx + hw * 0.96, Y(52)],
              [cx + hw * 0.7, Y(56)],
            ],
            S.sec,
            { ol: 2.2, hatch: false },
            0.3,
          );
          stitches(
            ctx,
            [
              [cx + hw * 0.64, Y(72)],
              [cx + hw * 0.92, Y(66)],
              [cx + hw * 0.92, Y(55)],
            ],
            3.5,
            1.6,
          );
        }
      } else if (S.d === "lamplighter") {
        // Capelet / mantle with embroidered hem and an amber glass charm.
        const hem = ragged(S.rng(22), cx + hw * 1.06, cx - hw * 1.0, Y(40), 3, 9, -6);
        const mantle: Pt[] = [[cx - hw * 0.5, Y(92)], [cx + hw * 0.5, Y(92)], [cx + hw * 1.08, Y(66)], ...hem];
        fblob(ctx, mantle, S.sec, { ol: 3.4, hatch: 5, depth: 10 }, 0.25);
        for (let i = 0; i < hem.length; i++) {
          const p = hem[i] as Pt;
          if (i % 2 === 0) rivet(ctx, p[0], p[1] - 5, 1.6, true);
        }
        stroke(
          ctx,
          hem.map(([x, y]) => [x, y - 8] as Pt),
          1.4,
          S.trim,
          0.7,
        );
        // Charm.
        line(
          ctx,
          [
            [cx + hw * 0.2, Y(86)],
            [cx + hw * 0.5, Y(62)],
            [cx + hw * 0.78, Y(84)],
          ],
          1.4,
          RAMPS.lamp[2],
        );
        fpoly(
          ctx,
          [
            [cx + hw * 0.5, Y(66)],
            [cx + hw * 0.58, Y(56)],
            [cx + hw * 0.5, Y(44)],
            [cx + hw * 0.42, Y(56)],
          ],
          matR(RAMPS.lamp, 3, RAMPS.lamp[5]),
          { ol: 2, hatch: false },
        );
        softGlow(ctx, cx + hw * 0.5, Y(56), 14, RAMPS.lamp[4], 0.45);
      } else if (S.d === "hexer") {
        // Tattered mantle with stitched void sigil + tooth necklace.
        const hem = ragged(S.rng(23), cx + hw * 1.04, cx - hw * 1.0, Y(28), 12, 8, -8);
        const mantle: Pt[] = [[cx - hw * 0.5, Y(92)], [cx + hw * 0.5, Y(92)], [cx + hw * 1.1, Y(64)], ...hem];
        const mm = tintMat(S.sec, RAMPS.umbra[1], 0.35);
        fpoly(ctx, mantle, mm, { ol: 3.4, hatch: 4, depth: 12 });
        const sx = cx - hw * 0.35;
        const sy = Y(58);
        ctx.save();
        ctx.strokeStyle = RAMPS.umbra[4];
        ctx.lineWidth = 1.6;
        ctx.globalAlpha = 0.85;
        ctx.beginPath();
        ctx.arc(sx, sy, 7, 0, Math.PI * 2);
        ctx.moveTo(sx, sy - 11);
        ctx.lineTo(sx, sy + 11);
        ctx.moveTo(sx - 8, sy + 5);
        ctx.lineTo(sx + 8, sy - 5);
        ctx.stroke();
        ctx.restore();
        for (let i = 0; i < 7; i++) {
          const t = i / 6;
          const x = cx + hw * (0.05 + t * 0.7);
          const y = Y(80) + Math.sin(t * Math.PI) * 18;
          fpoly(
            ctx,
            [
              [x - 2, y],
              [x + 2, y],
              [x, y + 7],
            ],
            BONE,
            { ol: 1.2, hatch: false, rim: false },
          );
        }
      }
      // Deep shadow under the chest / at the back (chiaroscuro).
      ctx.save();
      ctx.beginPath();
      blob(out, 0.42)(ctx);
      ctx.clip();
      const sh = ctx.createLinearGradient(cx - hw, 0, cx - hw * 0.2, 0);
      sh.addColorStop(0, "rgba(8,6,16,0.5)");
      sh.addColorStop(1, "rgba(8,6,16,0)");
      ctx.fillStyle = sh;
      ctx.fillRect(cx - hw * 1.2, Y(100), hw, 110);
      ctx.restore();
    },
  };
}

/** Collar layer (in front of the neck): gorget / high collar / scarf wrap / mantle folds. */
export function collarPart(S: MercStyle): PartSpec {
  const tg = torsoGeo(S);
  const nw = S.D.neck + 9;
  const W = 110;
  const H = 70;
  const cx = 52;
  const cy = 36;
  return {
    id: "collar",
    w: W,
    h: H,
    pivot: [cx, cy],
    parent: "torso",
    at: tg.neck,
    z: 11.5,
    draw: (ctx) => {
      if (heavy(S)) {
        // Gorget: two overlapping lames.
        for (const [dy, s] of [
          [8, 1.25],
          [0, 1.05],
        ] as const) {
          fblob(
            ctx,
            [
              [cx - nw * s, cy - 6 + dy],
              [cx + nw * s * 0.9, cy - 10 + dy],
              [cx + nw * s * 1.3, cy + 4 + dy],
              [cx + nw * s * 0.4, cy + 12 + dy],
              [cx - nw * s * 1.2, cy + 8 + dy],
            ],
            S.plate,
            { ol: 3, depth: 5 },
            0.4,
          );
          rivet(ctx, cx + nw * s * 0.9, cy + dy, 1.7);
        }
        stroke(
          ctx,
          [
            [cx - nw * 1.1, cy + 10],
            [cx + nw * 1.2, cy + 6],
          ],
          2,
          S.trim,
          0.9,
        );
      } else if (S.d === "reaver") {
        // Bulky scarf wrap.
        const r = S.rng(51);
        fblob(
          ctx,
          [
            [cx - nw * 1.35, cy - 8],
            [cx - nw * 0.1, cy - 14],
            [cx + nw * 1.3, cy - 10],
            [cx + nw * 1.55, cy + 6],
            [cx + nw * 0.4, cy + 16],
            [cx - nw * 1.4, cy + 10],
          ],
          S.sec,
          { ol: 3.2, hatch: 4 },
          0.45,
        );
        for (let i = 0; i < 4; i++) {
          const x = cx - nw * 1.1 + i * nw * 0.7 + r() * 3;
          line(
            ctx,
            [
              [x, cy - 10],
              [x + 6, cy + 2],
              [x + 4, cy + 12],
            ],
            1.8,
          );
        }
        fblob(
          ctx,
          [
            [cx + nw * 0.8, cy + 6],
            [cx + nw * 1.5, cy + 4],
            [cx + nw * 1.4, cy + 30],
            [cx + nw * 0.9, cy + 26],
          ],
          S.sec,
          { ol: 2.6, hatch: false },
          0.3,
        );
      } else if (S.d === "hexer") {
        // Fallen hood folds.
        fblob(
          ctx,
          [
            [cx - nw * 1.7, cy - 2],
            [cx - nw * 0.8, cy - 14],
            [cx + nw * 0.4, cy - 8],
            [cx + nw * 1.3, cy + 2],
            [cx + nw * 0.6, cy + 14],
            [cx - nw * 1.5, cy + 14],
          ],
          tintMat(S.sec, RAMPS.umbra[1], 0.35),
          { ol: 3, hatch: 4 },
          0.45,
        );
        folds(ctx, [
          [
            [cx - nw, cy - 6],
            [cx - nw * 0.2, cy + 8],
          ],
          [
            [cx + nw * 0.2, cy - 4],
            [cx + nw * 0.6, cy + 8],
          ],
        ]);
      } else if (medium(S)) {
        // Standing leather collar with buckle.
        fblob(
          ctx,
          [
            [cx - nw * 1.2, cy - 12],
            [cx + nw * 0.3, cy - 16],
            [cx + nw * 1.2, cy - 6],
            [cx + nw * 1.25, cy + 8],
            [cx - nw * 1.25, cy + 10],
          ],
          LEATHER,
          { ol: 3, hatch: 4 },
          0.3,
        );
        stitches(
          ctx,
          [
            [cx - nw, cy - 8],
            [cx + nw * 0.3, cy - 11],
            [cx + nw, cy - 3],
          ],
          4,
          2,
          RAMPS.leather[5],
          0.55,
        );
        buckle(ctx, cx + nw * 0.85, cy + 2, 7, 8);
      } else {
        // Turned-up coat collar.
        const cm = S.d === "lamplighter" ? S.sec : S.pri;
        fpoly(
          ctx,
          [
            [cx - nw * 1.3, cy - 16],
            [cx - nw * 0.2, cy - 6],
            [cx + nw * 0.2, cy + 12],
            [cx - nw * 1.4, cy + 10],
          ],
          cm,
          { ol: 3, hatch: 4, depth: 6 },
        );
        fpoly(
          ctx,
          [
            [cx + nw * 1.5, cy - 10],
            [cx + nw * 0.7, cy + 2],
            [cx + nw * 0.5, cy + 14],
            [cx + nw * 1.6, cy + 10],
          ],
          cm,
          { ol: 3, hatch: false, depth: 4 },
        );
      }
    },
  };
}

// ---------------------------------------------------------------------------
// Arms
// ---------------------------------------------------------------------------

function sleeveMat(S: MercStyle): Mat {
  if (heavy(S)) return S.mail;
  if (medium(S)) return S.sec;
  if (S.d === "reaver") return S.skin;
  if (S.d === "hexer") return tintMat(S.sec, RAMPS.umbra[1], 0.35);
  return S.pri;
}

export function upperArmPart(S: MercStyle, far: boolean): PartSpec {
  const g = upperArmGeo(S);
  const tg = torsoGeo(S);
  const { A, cx } = g;
  const M = (m: Mat) => (far ? S.far(m) : m);
  const y0 = g.pivot[1];
  const ey = g.elbow[1];
  const limb = capsule(cx, y0, cx, ey, A * 1.1, A * 0.8);
  const box = { x: cx - A * 1.2, y: y0 - A * 1.2, w: A * 2.4, h: ey - y0 + A * 2.2 };
  const bare = S.d === "reaver" && S.armor === "light";
  return {
    id: far ? "uArmB" : "uArmF",
    w: g.W,
    h: g.H,
    pivot: g.pivot,
    parent: "torso",
    at: far ? tg.shF : tg.shN,
    z: far ? 2 : 12,
    draw: (ctx) => {
      const smat = M(sleeveMat(S));
      fill(ctx, limb, box, smat, { ol: 3.6, hatch: 5 });
      clipTo(ctx, limb, () => {
        // Deltoid / shoulder plane catching the lamp.
        wash(ctx, blob([[cx - A * 0.2, y0 - A], [cx + A * 1.1, y0 - 2], [cx + A * 0.8, y0 + 22], [cx + A * 0.1, y0 + 14]], 0.5), smat.light, bare ? 0.35 : 0.22);
        if (heavy(S)) {
          mailIn(ctx, limb, box);
        } else if (medium(S)) {
          for (let y = y0 + 2; y < ey + 6; y += 9) stroke(ctx, [[cx - A * 1.2, y], [cx + A * 1.2, y - 2]], 1.2, INK, 0.4);
        } else if (bare) {
          line(ctx, [[cx + A * 0.5, y0 + 2], [cx + A * 0.15, y0 + 26]], 1.8, mixHex(S.skin.deep, "#000000", 0.2));
          line(ctx, [[cx - A * 0.4, y0 + 30], [cx - A * 0.1, y0 + 44]], 1.4, mixHex(S.skin.deep, "#000000", 0.2));
          for (let i = 0; i < 3; i++) {
            const y = ey - 14 + i * 6;
            fpoly(ctx, [[cx - A * 1.3, y], [cx + A * 1.3, y - 3], [cx + A * 1.3, y + 4], [cx - A * 1.3, y + 7]], M(BONE), { ol: 1.6, hatch: false });
          }
        } else {
          folds(ctx, [
            [[cx - A * 0.6, ey - 18], [cx + A * 0.2, ey - 6]],
            [[cx + A * 0.3, ey - 12], [cx + A * 0.9, ey - 2]],
          ]);
          stitches(ctx, [[cx - A * 0.35, y0 - 4], [cx - A * 0.4, ey]], 5, 2, INK, 0.4);
        }
      });
      reink(ctx, limb, 3.6);
      if (heavy(S)) {
        fblob(ctx, [[cx - A * 0.95, y0 + 16], [cx + A * 1.12, y0 + 14], [cx + A * 0.98, ey - 4], [cx - A * 0.86, ey - 2]], M(S.plate), { ol: 3, depth: 7 }, 0.25);
        rivet(ctx, cx, y0 + 22, 1.8);
      }
      // Pauldron.
      const big = heavy(S) || (S.d === "vanguard" && medium(S));
      if (heavy(S) || (medium(S) && !far) || (S.d === "vanguard" && !far)) {
        const R = A * (big ? 2.05 : 1.6);
        const pm = M(heavy(S) || S.d === "vanguard" ? S.plate : LEATHER);
        const lames = big ? 3 : 2;
        for (let i = lames - 1; i >= 0; i--) {
          const yy = y0 - R * 0.35 + i * R * 0.36;
          const rr = R * (1 - i * 0.1);
          fblob(
            ctx,
            [
              [cx - rr, yy + rr * 0.35],
              [cx - rr * 0.55, yy - rr * 0.3],
              [cx + rr * 0.3, yy - rr * 0.42],
              [cx + rr * 0.98, yy + rr * 0.05],
              [cx + rr * 0.9, yy + rr * 0.5],
              [cx - rr * 0.9, yy + rr * 0.62],
            ],
            pm,
            { ol: 3.2, hatch: 4, depth: rr * 0.36 },
            0.45,
          );
          rivet(ctx, cx + rr * 0.62, yy + rr * 0.2, 1.8);
          rivet(ctx, cx - rr * 0.6, yy + rr * 0.32, 1.8);
        }
        if (big) {
          stroke(ctx, [[cx - R * 0.6, y0 - R * 0.62], [cx + R * 0.3, y0 - R * 0.76], [cx + R * 0.95, y0 - R * 0.3]], 2.6, S.trim, 0.9);
        }
        scratches(ctx, S.rng(far ? 61 : 62), { x: cx - R * 0.7, y: y0 - R * 0.6, w: R * 1.4, h: R * 0.8 }, 4);
        if (S.hostile && !far) {
          for (const dx of [-0.4, 0.1, 0.55]) {
            fpoly(ctx, [[cx + R * dx - 3, y0 - R * 0.5], [cx + R * dx + 3, y0 - R * 0.52], [cx + R * dx + 1, y0 - R * 0.95]], STEEL, { ol: 1.6, hatch: false });
          }
        }
      }
      if (S.hostile && !far) {
        // Red rag armband with hanging tails.
        const y = y0 + 30;
        const r = S.rng(63);
        clipTo(ctx, limb, () => fpoly(ctx, [[cx - A * 1.3, y], [cx + A * 1.3, y - 3], [cx + A * 1.3, y + 9], [cx - A * 1.3, y + 12]], RAG, { ol: 2.4, depth: 4 }));
        fpoly(ctx, [[cx - A * 0.9, y + 6], [cx - A * 0.5, y + 7], [cx - A * 1.0, y + 26 + r() * 4], [cx - A * 1.4, y + 22]], RAG, { ol: 2, hatch: false });
        fpoly(ctx, [[cx - A * 0.8, y + 6], [cx - A * 0.4, y + 8], [cx - A * 0.4, y + 20], [cx - A * 0.7, y + 18]], RAG, { ol: 2, hatch: false });
      }
    },
  };
}

export type HandKind = "fist" | "claw";

function handMat(S: MercStyle, kind: HandKind): Mat {
  if (kind === "claw") return matR(RAMPS.umbra, 2, RAMPS.umbra[4]);
  if (heavy(S)) return S.plate;
  if (S.d === "reaver") return S.skin;
  return S.glove;
}

export function forearmPart(S: MercStyle, far: boolean, kind: HandKind = "fist"): PartSpec {
  const g = forearmGeo(S);
  const ug = upperArmGeo(S);
  const { F, Hd, cx } = g;
  const M = (m: Mat) => (far ? S.far(m) : m);
  const y0 = g.pivot[1];
  const wy = g.wristY;
  const limb = capsule(cx, y0, cx, wy, F * 1.08, F * 0.74);
  const box = { x: cx - F * 1.2, y: y0 - F * 1.2, w: F * 2.4, h: wy - y0 + F * 2.2 };
  return {
    id: far ? "fArmB" : "fArmF",
    w: g.W,
    h: g.H,
    pivot: g.pivot,
    parent: far ? "uArmB" : "uArmF",
    at: ug.elbow,
    z: far ? 2.6 : 13,
    draw: (ctx) => {
      const smat = M(sleeveMat(S));
      fill(ctx, limb, box, smat, { ol: 3.4, hatch: 5 });
      // Forearm muscle bulge (front, near the elbow).
      clipTo(ctx, limb, () => {
        wash(ctx, blob([[cx + F * 0.1, y0 - 2], [cx + F * 1.1, y0 + 6], [cx + F * 0.7, y0 + 24], [cx + F * 0.1, y0 + 18]], 0.5), smat.light, 0.22);
        if (heavy(S)) mailIn(ctx, limb, box);
      });
      reink(ctx, limb, 3.4);
      const br: Pt[] = [
        [cx - F * 1.12, y0 + 14],
        [cx + F * 1.2, y0 + 12],
        [cx + F * 0.98, wy + 4],
        [cx - F * 0.98, wy + 6],
      ];
      if (heavy(S) || (kind === "claw" && !far)) {
        const vm = M(kind === "claw" ? matR(RAMPS.umbra, 2, RAMPS.umbra[4]) : S.plate);
        fpoly(ctx, br, vm, { ol: 3, depth: 7 });
        stroke(ctx, [[cx + F * 0.5, y0 + 16], [cx + F * 0.45, wy + 2]], 1.6, RAMPS.steel[5], 0.5);
        rivet(ctx, cx - F * 0.5, y0 + 20, 1.7);
        rivet(ctx, cx - F * 0.5, wy - 6, 1.7);
      } else if (medium(S) || S.d === "vanguard" || S.d === "gunner") {
        fpoly(ctx, br, M(LEATHER), { ol: 2.8, depth: 6 });
        for (let y = y0 + 18; y < wy; y += 6) stroke(ctx, [[cx + F * 0.1, y], [cx + F * 0.7, y + 4]], 1.2, RAMPS.leather[5], 0.8);
        stitches(ctx, [[cx - F * 0.8, y0 + 18], [cx - F * 0.8, wy]], 4, 2);
      } else {
        const r = S.rng(far ? 71 : 72);
        clipTo(ctx, poly([[cx - F * 2, y0 + 16], [cx + F * 2, y0 + 16], [cx + F * 2, wy + 10], [cx - F * 2, wy + 10]]), () => {
          for (let i = 0; i < 6; i++) {
            const y = y0 + 18 + i * 6;
            fpoly(ctx, [[cx - F * 1.1, y + 2 + r()], [cx + F * 1.15, y - 2], [cx + F * 1.1, y + 5], [cx - F * 1.05, y + 8]], M(S.d === "reaver" ? BONE : S.sec), { ol: 1.6, hatch: false, depth: 3 });
          }
        });
      }
      const hm = M(handMat(S, kind));
      if (kind === "claw") {
        const palm: Pt[] = [[cx - Hd * 0.8, wy + 2], [cx + Hd * 0.85, wy], [cx + Hd * 1.05, wy + Hd * 1.0], [cx - Hd * 0.75, wy + Hd * 1.05]];
        fblob(ctx, palm, hm, { ol: 3, depth: 5 }, 0.35);
        const fingers: [number, number][] = [[-0.6, 0.15], [-0.15, 0.05], [0.3, -0.05], [0.75, -0.2]];
        for (const [fx, ang] of fingers) {
          const bx = cx + Hd * fx;
          const by = wy + Hd * 0.95;
          const len = Hd * 1.15;
          const tx = bx + Math.sin(ang) * len;
          const ty = by + Math.cos(ang) * len;
          fcaps(ctx, bx, by, tx, ty, Hd * 0.2, Hd * 0.12, hm, { ol: 2, hatch: false, depth: 2 });
          fpoly(ctx, [[tx - 2.5, ty - 1], [tx + 2.5, ty - 1], [tx + Math.sin(ang) * 8, ty + 8]], STEEL, { ol: 1.4, hatch: false });
        }
        fcaps(ctx, cx + Hd * 0.9, wy + Hd * 0.3, cx + Hd * 1.7, wy + Hd * 0.6, Hd * 0.24, Hd * 0.16, hm, { ol: 2, hatch: false });
        stroke(ctx, [[cx - Hd * 0.3, wy + 6], [cx + Hd * 0.2, wy + 12], [cx - Hd * 0.1, wy + 18]], 1.5, RAMPS.umbra[4], 0.9);
        softGlow(ctx, cx, wy + 12, 10, RAMPS.umbra[4], 0.25);
        return;
      }
      // Fist: knuckles forward, curled fingers, thumb over the grip.
      const fist: Pt[] = [
        [cx - Hd * 0.86, wy - 2],
        [cx + Hd * 0.72, wy - 3],
        [cx + Hd * 1.22, wy + Hd * 0.55],
        [cx + Hd * 1.18, wy + Hd * 1.5],
        [cx + Hd * 0.55, wy + Hd * 1.98],
        [cx - Hd * 0.62, wy + Hd * 1.86],
        [cx - Hd * 1.02, wy + Hd * 1.0],
      ];
      fblob(ctx, fist, hm, { ol: 3.4, hatch: 4, depth: Hd * 0.55 }, 0.55);
      for (let i = 0; i < 3; i++) {
        const y = wy + Hd * (0.62 + i * 0.4);
        line(ctx, [[cx + Hd * 1.2, y], [cx + Hd * 0.62, y + 1], [cx + Hd * 0.42, y + 3]], 1.7, INK, [0.1, 0.7]);
        glint(ctx, [[cx + Hd * 1.05, y - Hd * 0.3], [cx + Hd * 1.12, y - Hd * 0.12]], 1.6, hm.light);
      }
      fblob(ctx, [[cx - Hd * 0.05, wy + 1], [cx + Hd * 0.72, wy], [cx + Hd * 1.06, wy + Hd * 0.42], [cx + Hd * 0.62, wy + Hd * 0.7], [cx, wy + Hd * 0.5]], hm, { ol: 2.2, hatch: false, depth: 3 }, 0.5);
      if (heavy(S)) {
        stroke(ctx, [[cx + Hd * 0.3, wy + 2], [cx + Hd * 0.42, wy + Hd * 1.8]], 2, INK, 0.8);
        rivet(ctx, cx + Hd * 0.05, wy + Hd * 1.1, 1.6);
      } else if (S.d === "reaver") {
        stroke(ctx, [[cx - Hd * 0.7, wy + Hd], [cx + Hd * 1.1, wy + Hd * 0.75]], 3, RAMPS.bone[4], 0.9);
      } else {
        stitches(ctx, [[cx - Hd * 0.6, wy + 4], [cx - Hd * 0.7, wy + Hd * 1.6]], 4, 1.8, RAMPS.leather[5], 0.5);
      }
    },
  };
}

// ---------------------------------------------------------------------------
// Cloth tails (behind) & apron (front)
// ---------------------------------------------------------------------------

export function tailPart(S: MercStyle): PartSpec | null {
  const pg = pelvisGeo(S);
  const tg = torsoGeo(S);
  const r = S.rng(81);
  if (S.d === "reaver") {
    // Long scarf tail streaming back from the neck.
    const W = 170;
    const H = 150;
    const px = 150;
    const py = 14;
    const wv = (t: number) => Math.sin(t * 7) * 6;
    const top: Pt[] = [];
    const bot: Pt[] = [];
    const n = 9;
    for (let i = 0; i <= n; i++) {
      const t = i / n;
      const x = px - t * 132;
      const y = py + t * 70 + wv(t) + t * t * 30;
      const w = 24 - t * 8;
      top.push([x, y - w * 0.5]);
      bot.push([x + 2, y + w * 0.5]);
    }
    const end = ragged(r, (top[n] as Pt)[0] - 2, (bot[n] as Pt)[0] - 2, (top[n] as Pt)[1], 0);
    const pts: Pt[] = [...top, [(top[n] as Pt)[0] - 14, (top[n] as Pt)[1] + 4], [(bot[n] as Pt)[0] - 10, (bot[n] as Pt)[1] + 14], ...bot.reverse()];
    void end;
    return {
      id: "tail",
      w: W,
      h: H,
      pivot: [px, py],
      parent: "torso",
      at: tg.scarfAt,
      z: 0.5,
      draw: (ctx) => {
        fblob(ctx, pts, S.far(S.sec), { ol: 3.2, hatch: 4 }, 0.35);
        for (let i = 2; i < n; i += 2) {
          const a = top[i] as Pt;
          line(
            ctx,
            [
              [a[0], a[1] + 3],
              [a[0] - 12, a[1] + 8],
            ],
            1.6,
          );
        }
        // Frayed threads.
        const e = (top[top.length - 1] as Pt) ?? [0, 0];
        for (let i = 0; i < 4; i++) {
          line(
            ctx,
            [
              [e[0] - 8, e[1] + 4 + i * 4],
              [e[0] - 20 - r() * 6, e[1] + 8 + i * 5],
            ],
            1.4,
          );
        }
      },
    };
  }
  if (S.d === "vanguard") {
    // Half-cape off the back shoulder.
    const W = 120;
    const H = 190;
    const px = 84;
    const py = 10;
    const hem = ragged(r, px + 14, px - 80, py + 158, 9, 9, -12);
    const pts: Pt[] = [[px - 16, py - 4], [px + 14, py], [px + 18, py + 70], ...hem, [px - 70, py + 70]];
    return {
      id: "tail",
      w: W,
      h: H,
      pivot: [px, py],
      parent: "torso",
      at: tg.capeAt,
      z: 0.5,
      draw: (ctx) => {
        fblob(ctx, pts, S.far(S.sec), { ol: 3.4, hatch: 5 }, 0.25);
        folds(ctx, [
          [
            [px - 10, py + 20],
            [px - 30, py + 140],
          ],
          [
            [px - 30, py + 30],
            [px - 56, py + 130],
          ],
          [
            [px + 4, py + 60],
            [px - 2, py + 150],
          ],
        ], 2.2);
        stroke(
          ctx,
          hem.map(([x, y]) => [x, y - 8] as Pt),
          1.6,
          S.trim,
          0.6,
        );
      },
    };
  }
  if (heavy(S) && S.d !== "lamplighter" && S.d !== "hexer") {
    return null;
  }
  // Coat / robe tails hanging from the back of the belt.
  const long = S.d === "lamplighter" ? 140 : S.d === "hexer" ? 130 : longCoat(S) ? 118 : 56;
  const W = 120;
  const H = long + 40;
  const px = 70;
  const py = 6;
  const tattered = S.d === "hexer";
  const hem = ragged(r, px + 22, px - 56, py + long, tattered ? 22 : 5, tattered ? 8 : 10, -10);
  const pts: Pt[] = [[px - 20, py - 4], [px + 20, py - 4], [px + 26, py + long * 0.4], ...hem, [px - 50, py + long * 0.5]];
  const m = S.d === "lamplighter" ? S.sec : tattered ? tintMat(S.sec, RAMPS.umbra[1], 0.35) : S.pri;
  return {
    id: "tail",
    w: W,
    h: H,
    pivot: [px, py],
    parent: "pelvis",
    at: pg.tailAt,
    z: 0.6,
    draw: (ctx) => {
      fpoly(ctx, pts, S.far(m), { ol: 3.4, hatch: 5 });
      // Lining edge.
      const lin: Pt[] = [[px + 20, py + 6], [px + 26, py + long * 0.4], [hem[0]?.[0] ?? px, hem[0]?.[1] ?? py + long]];
      stroke(ctx, lin, 3, S.far(S.sec).base, 0.9);
      folds(ctx, [
        [
          [px - 4, py + 10],
          [px - 16, py + long - 10],
        ],
        [
          [px - 26, py + 20],
          [px - 40, py + long - 20],
        ],
      ], 2);
      if (S.d === "lamplighter") {
        stroke(
          ctx,
          hem.map(([x, y]) => [x, y - 10] as Pt),
          2.4,
          S.trim,
          0.7,
        );
        for (let i = 0; i < hem.length; i += 2) {
          const p = hem[i] as Pt;
          rivet(ctx, p[0], p[1] - 10, 1.5, true);
        }
      } else if (!tattered) {
        // Back vent + strap tab.
        line(
          ctx,
          [
            [px - 8, py + long * 0.45],
            [px - 14, py + long],
          ],
          2,
        );
        strap(ctx, [px - 24, py + 18], [px + 12, py + 20], 6, LEATHER_DARK, { stitch: false });
        buckle(ctx, px - 6, py + 19, 6, 7);
      }
    },
  };
}

export function apronPart(S: MercStyle): PartSpec | null {
  const pg = pelvisGeo(S);
  const r = S.rng(91);
  if (S.d === "vanguard") {
    const w = pg.hip * 0.56;
    const L = 80;
    const W = w + 30;
    const H = L + 30;
    const px = W / 2;
    const py = 4;
    const hem = ragged(r, px + w / 2 + 2, px - w / 2 - 2, py + L, 7, 7, 3);
    const pts: Pt[] = [[px - w / 2, py], [px + w / 2, py], ...hem];
    return {
      id: "apron",
      w: W,
      h: H,
      pivot: [px, py],
      parent: "pelvis",
      at: pg.apronAt,
      z: 8.6,
      draw: (ctx) => {
        fpoly(ctx, pts, S.sec, { ol: 3.2, hatch: 5, depth: 8 });
        stroke(
          ctx,
          [
            [px - w / 2 + 5, py + 2],
            [px - w / 2 + 6, py + L - 6],
          ],
          2,
          S.trim,
          0.8,
        );
        stroke(
          ctx,
          [
            [px + w / 2 - 5, py + 2],
            [px + w / 2 - 4, py + L - 6],
          ],
          2,
          S.trim,
          0.8,
        );
        folds(ctx, [
          [
            [px, py + 10],
            [px - 3, py + L - 12],
          ],
        ]);
      },
    };
  }
  if (S.d === "lamplighter") {
    const W = 60;
    const H = 130;
    const px = 30;
    const py = 4;
    return {
      id: "apron",
      w: W,
      h: H,
      pivot: [px, py],
      parent: "pelvis",
      at: pg.apronAt,
      z: 8.6,
      draw: (ctx) => {
        for (const [dx, L] of [
          [-7, 104],
          [8, 92],
        ] as const) {
          const x = px + dx;
          const hem = ragged(r, x + 7, x - 7, py + L, 3, 5, 2);
          fpoly(ctx, [[x - 7, py], [x + 7, py], ...hem], S.sec, { ol: 2.8, hatch: false, depth: 4 });
          stroke(
            ctx,
            [
              [x, py + 4],
              [x, py + L - 6],
            ],
            1.6,
            S.trim,
            0.8,
          );
          for (let y = py + 14; y < py + L - 10; y += 16) {
            fell(ctx, x, y, 2.2, 2.2, BRASS, { ol: 1.2, hatch: false });
          }
        }
        // Hanging glass charm.
        fpoly(
          ctx,
          [
            [px - 7, py + 106],
            [px - 2, py + 112],
            [px - 7, py + 122],
            [px - 12, py + 112],
          ],
          matR(RAMPS.lamp, 3, RAMPS.lamp[5]),
          { ol: 1.8, hatch: false },
        );
        softGlow(ctx, px - 7, py + 113, 10, RAMPS.lamp[4], 0.4);
      },
    };
  }
  if (S.d === "hexer") {
    const W = 70;
    const H = 110;
    const px = 30;
    const py = 4;
    return {
      id: "apron",
      w: W,
      h: H,
      pivot: [px, py],
      parent: "pelvis",
      at: pg.apronAt,
      z: 8.6,
      draw: (ctx) => {
        const strips: [number, number, number][] = [
          [-10, 9, 86],
          [2, 8, 70],
          [12, 7, 92],
        ];
        for (const [dx, w, L] of strips) {
          const x = px + dx;
          const hem = ragged(r, x + w / 2, x - w / 2, py + L, 8, 4, 0);
          fpoly(
            ctx,
            [[x - w / 2, py], [x + w / 2, py], ...hem],
            tintMat(S.sec, RAMPS.umbra[1], 0.35),
            { ol: 2.4, hatch: false, depth: 4 },
          );
        }
        crossHatch(ctx, poly([[px - 16, py], [px + 18, py], [px + 18, py + 30], [px - 16, py + 30]]), { x: px - 16, y: py, w: 34, h: 30 }, 4, 0.25);
      },
    };
  }
  return null;
}

