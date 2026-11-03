/**
 * Merc gear: discipline weapons (authored pointing UP in their canvas, pivot at the grip),
 * the vanguard shield, belt lanterns and attack/cast FX parts. Weapon tier 0–4 adds
 * rarity-coloured trims; tier 4 relics get a faint glow.
 */
import type { LampKind } from "../../mercs";
import { RAMPS } from "../../palette";
import { blob, ellipse, poly } from "../ink";
import type { RigGlow } from "../rig";
import {
  BONE,
  BRASS,
  boundsOf,
  fblob,
  fcaps,
  fell,
  flat,
  fpoly,
  glint,
  INK,
  LEATHER,
  LEATHER_DARK,
  line,
  type Mat,
  mat,
  matR,
  mixHex,
  type PartSpec,
  type Pt,
  ragged,
  RIM_HOT,
  rivet,
  scratches,
  softGlow,
  STEEL,
  STEEL_DARK,
  stitches,
  stroke,
  tintMat,
  WOOD,
  withAlpha,
} from "./kit";
import type { MercStyle } from "./style";

export interface GearOut {
  parts: PartSpec[];
  glows: RigGlow[];
}

const BLADE = mat(RAMPS.steel[1], RAMPS.steel[2], RAMPS.steel[3], RAMPS.steel[5], RIM_HOT);

/** Rarity trim line (tier ≥ 1). */
function trim(ctx: CanvasRenderingContext2D, S: MercStyle, pts: readonly Pt[], w = 2.2) {
  if (S.tier < 1) return;
  line(ctx, pts, w + 1.6, INK, [0.1, 0.1]);
  line(ctx, pts, w, S.tierColor, [0.1, 0.1]);
}

function gem(ctx: CanvasRenderingContext2D, S: MercStyle, x: number, y: number, r = 4.5) {
  if (S.tier < 3) return;
  fpoly(
    ctx,
    [
      [x, y - r * 1.2],
      [x + r, y],
      [x, y + r * 1.2],
      [x - r, y],
    ],
    mat(mixHex(S.tierColor, INK, 0.6), mixHex(S.tierColor, INK, 0.3), S.tierColor, S.tierHi),
    { ol: 2, hatch: false },
  );
  glint(ctx, [
    [x - r * 0.3, y - r * 0.6],
    [x + r * 0.2, y - r * 0.2],
  ], 1.4, "#ffffff");
  if (S.tier >= 4) softGlow(ctx, x, y, r * 4, S.tierColor, 0.55);
}

function relicGlow(S: MercStyle, part: string, x: number, y: number, radius: number): RigGlow[] {
  return S.tier >= 4 ? [{ part, x, y, radius, color: S.tierColor, alpha: 0.35 }] : [];
}

/** Leather grip wrap between y0..y1 around x (vertical haft). */
function wrap(ctx: CanvasRenderingContext2D, x: number, y0: number, y1: number, w: number, m: Mat) {
  fpoly(
    ctx,
    [
      [x - w, y0],
      [x + w, y0],
      [x + w, y1],
      [x - w, y1],
    ],
    m,
    { ol: 2.4, hatch: false, depth: w * 0.6 },
  );
  for (let y = y0 + 4; y < y1; y += 5) {
    stroke(
      ctx,
      [
        [x - w, y],
        [x + w, y - 3],
      ],
      1.3,
      INK,
      0.75,
    );
  }
}

// ---------------------------------------------------------------------------
// Vanguard: breach maul + heater shield
// ---------------------------------------------------------------------------

export function maulPart(S: MercStyle, gripAt: Pt): { spec: PartSpec; glows: RigGlow[] } {
  const W = 150;
  const H = 280;
  const x = 66;
  const gy = 220;
  const top = 34;
  const k = [0.92, 1, 1.12][S.body] ?? 1;
  const draw = (ctx: CanvasRenderingContext2D) => {
    const rnd = S.rng(201);
    // Haft.
    fpoly(
      ctx,
      [
        [x - 5, top + 40],
        [x + 5, top + 40],
        [x + 6, gy + 44],
        [x - 6, gy + 44],
      ],
      WOOD,
      { ol: 3, hatch: false, depth: 4 },
    );
    line(ctx, [
      [x + 2, top + 60],
      [x + 3, gy + 30],
    ], 1.2, withAlpha("#c79b6a", 0.5));
    wrap(ctx, x, gy - 30, gy + 30, 7, LEATHER_DARK);
    // Pommel ring + spike.
    fell(ctx, x, gy + 50, 9, 7, STEEL, { ol: 2.6, hatch: false });
    fpoly(
      ctx,
      [
        [x - 4, gy + 54],
        [x + 4, gy + 54],
        [x, gy + 66],
      ],
      STEEL,
      { ol: 2, hatch: false },
    );
    // Langets.
    for (const s of [-1, 1]) {
      fpoly(
        ctx,
        [
          [x + s * 4, top + 40],
          [x + s * 8, top + 40],
          [x + s * 7, top + 100],
          [x + s * 4, top + 104],
        ],
        STEEL_DARK,
        { ol: 2, hatch: false },
      );
    }
    rivet(ctx, x, top + 70, 2);
    rivet(ctx, x, top + 92, 2);
    trim(ctx, S, [
      [x, top + 46],
      [x, top + 100],
    ]);
    // Head: breaching block (striking face +x) + rear pick.
    const hw = 30 * k;
    const hh = 56 * k;
    const hy = top + 14;
    const pick: Pt[] = [
      [x - hw * 0.5, hy + hh * 0.3],
      [x - hw * 0.5, hy + hh * 0.66],
      [x - hw * 1.3, hy + hh * 0.9],
      [x - hw * 1.75, hy + hh * 1.25],
      [x - hw * 1.45, hy + hh * 0.72],
    ];
    fpoly(ctx, pick, STEEL, { ol: 3, hatch: 4, depth: 6 });
    glint(ctx, [
      [x - hw * 0.7, hy + hh * 0.4],
      [x - hw * 1.4, hy + hh * 0.8],
    ], 1.6, RAMPS.steel[5]);
    const block: Pt[] = [
      [x - hw * 0.62, hy],
      [x + hw * 1.15, hy - 4],
      [x + hw * 1.28, hy + 4],
      [x + hw * 1.28, hy + hh - 4],
      [x + hw * 1.15, hy + hh + 4],
      [x - hw * 0.62, hy + hh],
    ];
    fpoly(ctx, block, STEEL, { ol: 4, hatch: 4, depth: 14, grain: RAMPS.rust[2], seed: 9 });
    // Reinforcing bands + striking face plate.
    for (const t of [0.18, 0.82]) {
      const yy = hy + hh * t;
      fpoly(
        ctx,
        [
          [x - hw * 0.66, yy - 4],
          [x + hw * 1.3, yy - 6],
          [x + hw * 1.3, yy + 4],
          [x - hw * 0.66, yy + 5],
        ],
        STEEL_DARK,
        { ol: 2.2, hatch: false, depth: 3 },
      );
      rivet(ctx, x - hw * 0.4, yy, 2);
      rivet(ctx, x + hw * 0.4, yy - 1, 2);
      rivet(ctx, x + hw * 1.05, yy - 1, 2);
      trim(ctx, S, [
        [x - hw * 0.6, yy],
        [x + hw * 1.25, yy - 1.4],
      ], 1.8);
    }
    fpoly(
      ctx,
      [
        [x + hw * 1.15, hy - 8],
        [x + hw * 1.5, hy - 2],
        [x + hw * 1.5, hy + hh + 2],
        [x + hw * 1.15, hy + hh + 8],
      ],
      STEEL_DARK,
      { ol: 3, hatch: false, depth: 4 },
    );
    // Top spike.
    fpoly(
      ctx,
      [
        [x - 6, hy + 1],
        [x + 8, hy],
        [x + 1, hy - 22],
      ],
      STEEL,
      { ol: 2.6, hatch: false },
    );
    scratches(ctx, rnd, boundsOf(block), 9);
    // Chipped dents.
    for (let i = 0; i < 3; i++) {
      const px = x + hw * (rnd() * 1.6 - 0.4);
      const py = hy + hh * (0.3 + rnd() * 0.4);
      flat(ctx, ellipse(px, py, 2.4, 1.6), withAlpha(INK, 0.6));
    }
    if (S.tier >= 2) {
      // Engraved glyph on the side face.
      stroke(
        ctx,
        [
          [x + hw * 0.1, hy + hh * 0.34],
          [x + hw * 0.5, hy + hh * 0.5],
          [x + hw * 0.1, hy + hh * 0.66],
        ],
        2,
        S.tierColor,
        0.95,
      );
    }
    gem(ctx, S, x + hw * 0.7, hy + hh * 0.5, 5.5);
  };
  return {
    spec: {
      id: "weapon",
      w: W,
      h: H,
      pivot: [x, gy],
      parent: "fArmF",
      at: gripAt,
      z: 12.5,
      draw,
    },
    glows: relicGlow(S, "weapon", x + 10, top + 40, 70),
  };
}

export function shieldPart(S: MercStyle, at: Pt): PartSpec {
  const W = 120;
  const H = 170;
  const cx = 58;
  const k = [0.92, 1, 1.12][S.body] ?? 1;
  const w = 40 * k;
  const top = 18;
  const h = 128 * k;
  return {
    id: "shield",
    w: W,
    h: H,
    pivot: [cx, top + h * 0.42],
    parent: "fArmB",
    at,
    z: 9.6,
    draw: (ctx) => {
      const rnd = S.rng(211);
      const outline: Pt[] = [
        [cx - w, top + 6],
        [cx - w * 0.2, top],
        [cx + w * 0.2, top],
        [cx + w, top + 6],
        [cx + w * 0.98, top + h * 0.45],
        [cx + w * 0.62, top + h * 0.78],
        [cx, top + h],
        [cx - w * 0.62, top + h * 0.78],
        [cx - w * 0.98, top + h * 0.45],
      ];
      // Steel rim (outer), field inset.
      fblob(ctx, outline, STEEL_DARK, { ol: 4.4, hatch: false, depth: 10 }, 0.15);
      const inset = outline.map(([x, y]) => [cx + (x - cx) * 0.86, top + h * 0.4 + (y - top - h * 0.4) * 0.88] as Pt);
      fblob(ctx, inset, S.plate, { ol: 2.6, hatch: 4, depth: 18, grain: RAMPS.rust[2], seed: 4 }, 0.15);
      // Per-bend division in the secondary colour.
      ctx.save();
      ctx.beginPath();
      blob(inset, 0.15)(ctx);
      ctx.clip();
      fpoly(
        ctx,
        [
          [cx - w, top + h * 0.15],
          [cx + w * 1.2, top + h * 0.75],
          [cx + w, top + h * 1.2],
          [cx - w, top + h * 1.2],
        ],
        tintMat(S.sec, "#000000", 0.05),
        { ol: 2.4, hatch: 4, depth: 10 },
      );
      ctx.restore();
      // Lamp-sun sigil.
      const sx = cx;
      const sy = top + h * 0.38;
      ctx.save();
      ctx.strokeStyle = INK;
      ctx.lineWidth = 4.2;
      ctx.beginPath();
      ctx.arc(sx, sy, 11, 0, Math.PI * 2);
      ctx.stroke();
      ctx.strokeStyle = S.trim;
      ctx.lineWidth = 2.4;
      ctx.stroke();
      ctx.restore();
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2;
        const r0 = 15;
        const r1 = i % 2 ? 21 : 27;
        line(ctx, [
          [sx + Math.cos(a) * r0, sy + Math.sin(a) * r0],
          [sx + Math.cos(a) * r1, sy + Math.sin(a) * r1],
        ], 5, INK, [0.1, 0.7]);
        line(ctx, [
          [sx + Math.cos(a) * r0, sy + Math.sin(a) * r0],
          [sx + Math.cos(a) * r1, sy + Math.sin(a) * r1],
        ], 3, S.trim, [0.1, 0.7]);
      }
      flat(ctx, ellipse(sx, sy, 5, 5), S.trim, 2);
      // Rim rivets.
      for (let i = 0; i < outline.length; i++) {
        const a = outline[i] as Pt;
        const b = outline[(i + 1) % outline.length] as Pt;
        const m: Pt = [cx + ((a[0] + b[0]) / 2 - cx) * 0.93, top + h * 0.4 + ((a[1] + b[1]) / 2 - top - h * 0.4) * 0.94];
        rivet(ctx, m[0], m[1], 2.2);
      }
      scratches(ctx, rnd, { x: cx - w * 0.8, y: top + 10, w: w * 1.6, h: h * 0.7 }, 12);
      // Gouges.
      for (let i = 0; i < 3; i++) {
        const gx = cx - w * 0.6 + rnd() * w * 1.2;
        const gy = top + 20 + rnd() * h * 0.5;
        line(ctx, [
          [gx, gy],
          [gx + 10, gy + 6],
          [gx + 16, gy + 7],
        ], 2.6, INK, [0.1, 0.8]);
      }
      glint(ctx, [
        [cx + w * 0.7, top + 10],
        [cx + w * 0.92, top + h * 0.35],
      ], 2.4, RAMPS.steel[5]);
    },
  };
}

// ---------------------------------------------------------------------------
// Gunner: scavenged long rifle + muzzle flash
// ---------------------------------------------------------------------------

export const RIFLE = { W: 90, H: 300, x: 44, gy: 214, muzzleY: 10, foreY: 128 };

export function riflePart(S: MercStyle, gripAt: Pt): { spec: PartSpec; glows: RigGlow[] } {
  const { W, H, x, gy, muzzleY } = RIFLE;
  const draw = (ctx: CanvasRenderingContext2D) => {
    const rnd = S.rng(221);
    // Sling (sags on the underside, +x).
    ctx.save();
    ctx.lineWidth = 7;
    ctx.strokeStyle = INK;
    ctx.beginPath();
    ctx.moveTo(x + 9, gy + 50);
    ctx.quadraticCurveTo(x + 40, gy - 20, x + 10, 110);
    ctx.stroke();
    ctx.lineWidth = 4;
    ctx.strokeStyle = RAMPS.leather[3];
    ctx.stroke();
    ctx.restore();
    // Barrel.
    fpoly(
      ctx,
      [
        [x - 3.5, muzzleY + 16],
        [x + 3.5, muzzleY + 16],
        [x + 4, 120],
        [x - 4, 120],
      ],
      STEEL_DARK,
      { ol: 2.6, hatch: false, depth: 3 },
    );
    glint(ctx, [
      [x - 1, muzzleY + 24],
      [x - 1, 100],
    ], 1.2, RAMPS.steel[5]);
    // Muzzle brake.
    fpoly(
      ctx,
      [
        [x - 7, muzzleY],
        [x + 7, muzzleY],
        [x + 7, muzzleY + 24],
        [x - 7, muzzleY + 24],
      ],
      STEEL,
      { ol: 2.8, hatch: false, depth: 4 },
    );
    for (const y of [muzzleY + 6, muzzleY + 12, muzzleY + 18]) {
      flat(
        ctx,
        poly([
          [x - 5, y],
          [x + 5, y],
          [x + 5, y + 2.6],
          [x - 5, y + 2.6],
        ]),
        INK,
      );
    }
    // Fore-end (wood with wrap) + under-barrel rail.
    fpoly(
      ctx,
      [
        [x - 8, 100],
        [x + 9, 104],
        [x + 11, 156],
        [x - 8, 158],
      ],
      WOOD,
      { ol: 3, hatch: 4, depth: 6 },
    );
    wrap(ctx, x + 1, RIFLE.foreY - 14, RIFLE.foreY + 16, 9, tintMat(S.sec, RAMPS.leather[2], 0.4));
    // Receiver (scavenged plate).
    const rec: Pt[] = [
      [x - 10, 154],
      [x + 11, 154],
      [x + 12, gy - 4],
      [x - 10, gy + 6],
    ];
    fpoly(ctx, rec, STEEL, { ol: 3.2, hatch: 4, depth: 8, grain: RAMPS.rust[2], seed: 5 });
    fpoly(
      ctx,
      [
        [x - 4, 166],
        [x + 8, 166],
        [x + 8, 186],
        [x - 4, 186],
      ],
      S.plate,
      { ol: 2, hatch: false },
    );
    rivet(ctx, x - 6, 160, 1.6);
    rivet(ctx, x - 6, gy - 2, 1.6);
    rivet(ctx, x + 7, 192, 1.6);
    // Bolt handle.
    fcaps(ctx, x - 8, 192, x - 18, 198, 2, 3.4, STEEL, { ol: 2, hatch: false });
    // Magazine (underside).
    fpoly(
      ctx,
      [
        [x + 10, 168],
        [x + 26, 172],
        [x + 30, 196],
        [x + 11, 194],
      ],
      STEEL_DARK,
      { ol: 2.6, hatch: false, depth: 4 },
    );
    // Pistol grip + trigger guard.
    fpoly(
      ctx,
      [
        [x + 6, gy - 6],
        [x + 14, gy - 8],
        [x + 26, gy + 14],
        [x + 16, gy + 18],
      ],
      WOOD,
      { ol: 2.6, hatch: false },
    );
    ctx.save();
    ctx.lineWidth = 2.4;
    ctx.strokeStyle = INK;
    ctx.beginPath();
    ctx.arc(x + 12, gy - 10, 7, -0.4, 1.9);
    ctx.stroke();
    ctx.restore();
    // Stock.
    const stock: Pt[] = [
      [x - 10, gy + 4],
      [x + 12, gy - 2],
      [x + 16, gy + 70],
      [x + 14, gy + 78],
      [x - 14, gy + 80],
      [x - 15, gy + 40],
    ];
    fpoly(ctx, stock, WOOD, { ol: 3.4, hatch: 4, depth: 8 });
    // Cheek riser (leather pad, scope side).
    fblob(
      ctx,
      [
        [x - 14, gy + 16],
        [x - 4, gy + 14],
        [x - 4, gy + 48],
        [x - 16, gy + 46],
      ],
      LEATHER,
      { ol: 2.2, hatch: false },
      0.3,
    );
    stitches(ctx, [
      [x - 12, gy + 18],
      [x - 12, gy + 44],
    ], 4, 2, RAMPS.leather[5], 0.6);
    fpoly(
      ctx,
      [
        [x - 15, gy + 76],
        [x + 16, gy + 74],
        [x + 16, gy + 82],
        [x - 15, gy + 84],
      ],
      matR(RAMPS.rock, 2),
      { ol: 2.2, hatch: false, rim: false },
    );
    // Scope (top, -x).
    fcaps(ctx, x - 20, 122, x - 20, 176, 5, 5, STEEL_DARK, { ol: 2.6, hatch: false });
    fpoly(
      ctx,
      [
        [x - 27, 112],
        [x - 13, 112],
        [x - 15, 126],
        [x - 25, 126],
      ],
      STEEL,
      { ol: 2.4, hatch: false },
    );
    fpoly(
      ctx,
      [
        [x - 26, 172],
        [x - 14, 172],
        [x - 13, 184],
        [x - 27, 184],
      ],
      STEEL,
      { ol: 2.4, hatch: false },
    );
    flat(ctx, ellipse(x - 20, 113, 5, 1.8), S.hostile ? RAMPS.rust[4] : RAMPS.crystal[4], 1.4);
    for (const y of [140, 160]) {
      fpoly(
        ctx,
        [
          [x - 16, y],
          [x - 10, y],
          [x - 10, y + 6],
          [x - 16, y + 6],
        ],
        STEEL,
        { ol: 1.6, hatch: false },
      );
    }
    scratches(ctx, rnd, boundsOf(rec), 4);
    trim(ctx, S, [
      [x - 8, 104],
      [x - 6, 154],
    ]);
    trim(ctx, S, [
      [x + 10, gy + 6],
      [x + 13, gy + 66],
    ]);
    if (S.tier >= 2) {
      for (let i = 0; i < 3; i++) {
        flat(ctx, ellipse(x - 2, gy + 26 + i * 12, 2.4, 2.4), S.tierColor, 1.2);
      }
    }
    gem(ctx, S, x + 2, 176, 4.4);
  };
  return {
    spec: { id: "weapon", w: W, h: H, pivot: [x, gy], parent: "fArmF", at: gripAt, z: 12.5, draw },
    glows: relicGlow(S, "weapon", x, 180, 56),
  };
}

export function muzzleFlashPart(S: MercStyle): PartSpec {
  const W = 150;
  const H = 170;
  const px = 75;
  const py = 160;
  return {
    id: "fx",
    w: W,
    h: H,
    pivot: [px, py],
    parent: "weapon",
    at: [RIFLE.x, RIFLE.muzzleY + 2],
    z: 12.7,
    draw: (ctx) => {
      const r = S.rng(231);
      softGlow(ctx, px, py - 50, 70, RAMPS.lamp[3], 0.75, 0.3);
      const spikes = (len: number, wid: number, col: string) => {
        const pts: Pt[] = [];
        const n = 14;
        for (let i = 0; i < n; i++) {
          const a = -Math.PI / 2 + ((i / n) * 2 - 1) * 1.2;
          const l = i % 2 === 0 ? len * (0.55 + r() * 0.45) : wid;
          pts.push([px + Math.cos(a) * l, py - 18 + Math.sin(a) * l]);
        }
        pts.push([px + 8, py], [px - 8, py]);
        fpoly(ctx, pts, mat(col, col, col, "#ffffff", null), { ol: 0, hatch: false, light: false });
      };
      spikes(140, 22, RAMPS.lamp[3]);
      spikes(98, 16, RAMPS.lamp[4]);
      spikes(58, 10, RAMPS.lamp[5]);
      // Side jets from the brake.
      for (const s of [-1, 1]) {
        fpoly(
          ctx,
          [
            [px, py - 6],
            [px + s * 64, py - 22],
            [px + s * 70, py - 12],
            [px, py + 2],
          ],
          mat(RAMPS.lamp[3], RAMPS.lamp[3], RAMPS.lamp[4], "#ffffff", null),
          { ol: 0, hatch: false },
        );
      }
      flat(ctx, ellipse(px, py - 22, 14, 22), "#fff8e0");
    },
  };
}

// ---------------------------------------------------------------------------
// Lamplighter: lantern staff + flare
// ---------------------------------------------------------------------------

export const STAFF = { W: 130, H: 360, x: 60, gy: 222, lampY: 48 };

export function staffPart(S: MercStyle, gripAt: Pt): { spec: PartSpec; glows: RigGlow[] } {
  const { W, H, x, gy, lampY } = STAFF;
  const draw = (ctx: CanvasRenderingContext2D) => {
    const rnd = S.rng(241);
    // Shaft.
    fpoly(
      ctx,
      [
        [x - 4.5, lampY + 30],
        [x + 4.5, lampY + 30],
        [x + 5.5, H - 14],
        [x - 5.5, H - 14],
      ],
      WOOD,
      { ol: 3, hatch: false, depth: 4 },
    );
    // Knots.
    for (const y of [130, 270, 300]) {
      flat(ctx, ellipse(x + 1, y, 2, 3.5), "#2a1a10");
    }
    // Iron ferrule.
    fpoly(
      ctx,
      [
        [x - 6, H - 30],
        [x + 6, H - 30],
        [x + 4, H - 6],
        [x, H - 2],
        [x - 4, H - 6],
      ],
      STEEL_DARK,
      { ol: 2.4, hatch: false },
    );
    wrap(ctx, x, gy - 26, gy + 26, 7, LEATHER);
    // Bands.
    for (const y of [lampY + 50, lampY + 64, gy - 34, gy + 34]) {
      fpoly(
        ctx,
        [
          [x - 7, y - 3],
          [x + 7, y - 3],
          [x + 7, y + 3],
          [x - 7, y + 3],
        ],
        BRASS,
        { ol: 2, hatch: false },
      );
    }
    trim(ctx, S, [
      [x - 5, lampY + 74],
      [x + 5, lampY + 96],
      [x - 5, lampY + 118],
      [x + 5, lampY + 140],
    ], 2);
    // Ribbons hanging below the lantern.
    for (const [dx, len] of [
      [-6, 70],
      [5, 54],
    ] as const) {
      const hem = ragged(rnd, x + dx + 5, x + dx - 4, lampY + 40 + len, 4, 4, 0);
      fpoly(
        ctx,
        [
          [x + dx - 3, lampY + 40],
          [x + dx + 4, lampY + 40],
          [x + dx + 6, lampY + 40 + len * 0.5],
          ...hem,
          [x + dx - 6, lampY + 40 + len * 0.5],
        ],
        S.sec,
        { ol: 2, hatch: false, depth: 3 },
      );
    }
    // Lantern cage: crown, glass, bars, base.
    const ly = lampY;
    softGlow(ctx, x, ly, 46, RAMPS.lamp[3], 0.55, 0.3);
    fpoly(
      ctx,
      [
        [x - 16, ly + 22],
        [x + 16, ly + 22],
        [x + 10, ly + 34],
        [x - 10, ly + 34],
      ],
      BRASS,
      { ol: 2.6, hatch: false },
    );
    fblob(
      ctx,
      [
        [x - 13, ly - 18],
        [x + 13, ly - 18],
        [x + 15, ly + 4],
        [x + 12, ly + 22],
        [x - 12, ly + 22],
        [x - 15, ly + 4],
      ],
      mat(RAMPS.lamp[2], RAMPS.lamp[3], RAMPS.lamp[4], RAMPS.lamp[5], RAMPS.lamp[5]),
      { ol: 2.6, hatch: false, light: true, depth: 6 },
      0.4,
    );
    // Flame.
    fblob(
      ctx,
      [
        [x, ly - 12],
        [x + 6, ly + 4],
        [x + 3, ly + 14],
        [x - 3, ly + 14],
        [x - 6, ly + 4],
      ],
      mat("#fff3c4", "#fff3c4", "#ffffff", "#ffffff", null),
      { ol: 0, hatch: false },
      0.6,
    );
    for (const dx of [-13, -5, 5, 13]) {
      stroke(
        ctx,
        [
          [x + dx, ly - 18],
          [x + dx * 1.12, ly + 4],
          [x + dx * 0.92, ly + 22],
        ],
        3.6,
        INK,
      );
      stroke(
        ctx,
        [
          [x + dx, ly - 18],
          [x + dx * 1.12, ly + 4],
          [x + dx * 0.92, ly + 22],
        ],
        1.4,
        RAMPS.steel[3],
      );
    }
    // Crown with prongs + ring.
    fpoly(
      ctx,
      [
        [x - 18, ly - 16],
        [x + 18, ly - 16],
        [x + 10, ly - 28],
        [x - 10, ly - 28],
      ],
      BRASS,
      { ol: 2.6, hatch: false },
    );
    for (const s of [-1, 0, 1]) {
      fpoly(
        ctx,
        [
          [x + s * 12 - 3, ly - 26],
          [x + s * 12 + 3, ly - 26],
          [x + s * 16, ly - 42 + Math.abs(s) * 6],
        ],
        BRASS,
        { ol: 2, hatch: false },
      );
    }
    ctx.save();
    ctx.strokeStyle = INK;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(x, ly - 34, 6, 0, Math.PI * 2);
    ctx.stroke();
    ctx.strokeStyle = RAMPS.lamp[2];
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.restore();
    gem(ctx, S, x, ly + 28, 4);
    if (S.tier >= 1) {
      stroke(
        ctx,
        [
          [x - 16, ly - 16],
          [x + 16, ly - 16],
        ],
        2,
        S.tierColor,
      );
    }
  };
  return {
    spec: { id: "weapon", w: W, h: H, pivot: [x, gy], parent: "fArmF", at: gripAt, z: 12.5, draw },
    glows: [{ part: "weapon", x, y: lampY, radius: 120, color: RAMPS.lamp[3], alpha: 0.5 }],
  };
}

export function flarePart(S: MercStyle, parent: string, at: Pt, color: readonly string[]): PartSpec {
  const R = 150;
  return {
    id: "fx",
    w: R * 2,
    h: R * 2,
    pivot: [R, R],
    parent,
    at,
    z: 13.8,
    draw: (ctx) => {
      const r = S.rng(251);
      softGlow(ctx, R, R, R, color[3] ?? "#ffffff", 0.75, 0.25);
      const ray = (len: number, w: number, col: string, n: number, off: number) => {
        for (let i = 0; i < n; i++) {
          const a = off + (i / n) * Math.PI * 2;
          const l = len * (0.6 + r() * 0.4);
          fpoly(
            ctx,
            [
              [R + Math.cos(a + 0.5 * (w / l)) * 12, R + Math.sin(a + 0.5 * (w / l)) * 12],
              [R + Math.cos(a) * l, R + Math.sin(a) * l],
              [R + Math.cos(a - 0.5 * (w / l)) * 12, R + Math.sin(a - 0.5 * (w / l)) * 12],
            ],
            mat(col, col, col, col, null),
            { ol: 0, hatch: false, light: false },
          );
        }
      };
      ray(R * 0.95, 26, withAlpha(color[3] ?? "#ffffff", 0.75), 10, 0.2);
      ray(R * 0.7, 18, color[4] ?? "#ffffff", 8, 0.55);
      ctx.save();
      ctx.strokeStyle = withAlpha(color[4] ?? "#ffffff", 0.8);
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(R, R, R * 0.42, 0, Math.PI * 2);
      ctx.stroke();
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(R, R, R * 0.6, 0.3, 2.4);
      ctx.stroke();
      ctx.restore();
      softGlow(ctx, R, R, R * 0.3, color[5] ?? "#ffffff", 1, 0.5);
    },
  };
}

// ---------------------------------------------------------------------------
// Reaver: twin curved blades + slash arcs
// ---------------------------------------------------------------------------

export function bladePart(
  S: MercStyle,
  id: string,
  parent: string,
  gripAt: Pt,
  z: number,
  far: boolean,
): { spec: PartSpec; glows: RigGlow[] } {
  const W = 80;
  const H = 190;
  const x = 30;
  const gy = 160;
  const len = 124 * ([0.94, 1, 1.06][S.body] ?? 1);
  const draw = (ctx: CanvasRenderingContext2D) => {
    const M = (m: Mat) => (far ? S.far(m) : m);
    const bm = M(BLADE);
    const base = gy - 18;
    const tipY = base - len;
    // Curved blade (edge on +x, belly widening toward the tip, clipped point).
    const pts: Pt[] = [
      [x - 4, base],
      [x + 5, base],
      [x + 10, base - len * 0.35],
      [x + 19, base - len * 0.72],
      [x + 22, base - len * 0.9],
      [x + 14, tipY],
      [x + 4, tipY + len * 0.06],
      [x - 1, base - len * 0.62],
      [x - 5, base - len * 0.3],
    ];
    fblob(ctx, pts, bm, { ol: 3, hatch: false, depth: 6 }, 0.3);
    // Edge bevel + fuller.
    line(ctx, [
      [x + 5, base - 4],
      [x + 12, base - len * 0.4],
      [x + 19, base - len * 0.78],
      [x + 15, tipY + 4],
    ], 2.4, withAlpha(RAMPS.steel[5], 0.9));
    line(ctx, [
      [x, base - 6],
      [x + 3, base - len * 0.4],
      [x + 9, base - len * 0.72],
    ], 1.6, withAlpha(INK, 0.7));
    trim(ctx, S, [
      [x - 2, base - 8],
      [x + 1, base - len * 0.5],
    ], 1.6);
    scratches(ctx, S.rng(far ? 261 : 262), { x: x - 2, y: tipY + 20, w: 16, h: len * 0.6 }, 3);
    // Guard (asymmetric hook).
    fpoly(
      ctx,
      [
        [x - 12, base + 2],
        [x + 12, base - 2],
        [x + 18, base - 10],
        [x + 14, base + 4],
        [x - 10, base + 8],
      ],
      M(STEEL_DARK),
      { ol: 2.4, hatch: false },
    );
    // Wrapped handle + ring pommel.
    wrap(ctx, x, base + 6, gy + 18, 5, M(tintMat(S.sec, RAMPS.leather[2], 0.3)));
    ctx.save();
    ctx.strokeStyle = INK;
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.arc(x, gy + 25, 6, 0, Math.PI * 2);
    ctx.stroke();
    ctx.strokeStyle = S.tier >= 1 ? S.tierColor : RAMPS.steel[3];
    ctx.lineWidth = 2.4;
    ctx.stroke();
    ctx.restore();
    gem(ctx, S, x + 2, base - 6, 3.4);
  };
  return {
    spec: { id, w: W, h: H, pivot: [x, gy], parent, at: gripAt, z, draw },
    glows: far ? [] : relicGlow(S, id, x + 10, gy - 80, 48),
  };
}

/** Motion arcs (reaver double slash / vanguard swing / lamplighter lash). */
export function arcFxPart(
  S: MercStyle,
  parent: string,
  at: Pt,
  colors: readonly string[],
  opts: { R: number; a0: number; a1: number; double?: boolean; thick?: number },
): PartSpec {
  const pad = 30;
  const W = opts.R * 2 + pad * 2;
  const H = W;
  const c = W / 2;
  return {
    id: "fx",
    w: W,
    h: H,
    pivot: [c, c],
    parent,
    at,
    z: 20,
    draw: (ctx) => {
      const r = S.rng(271);
      const crescent = (R: number, th: number, a0: number, a1: number, col: string, alpha: number) => {
        const n = 28;
        const outer: Pt[] = [];
        const inner: Pt[] = [];
        for (let i = 0; i <= n; i++) {
          const t = i / n;
          const a = a0 + (a1 - a0) * t;
          const w = th * Math.sin(Math.PI * t ** 0.8);
          outer.push([c + Math.cos(a) * R, c + Math.sin(a) * R]);
          inner.push([c + Math.cos(a) * (R - w), c + Math.sin(a) * (R - w)]);
        }
        ctx.save();
        ctx.globalAlpha = alpha;
        flat(ctx, poly([...outer, ...inner.reverse()]), col);
        ctx.restore();
      };
      const th = opts.thick ?? 30;
      crescent(opts.R, th, opts.a0, opts.a1, colors[2] ?? "#ffffff", 0.35);
      crescent(opts.R, th * 0.62, opts.a0 + 0.05, opts.a1, colors[3] ?? "#ffffff", 0.75);
      crescent(opts.R, th * 0.25, opts.a0 + 0.12, opts.a1, colors[5] ?? "#ffffff", 0.95);
      if (opts.double) {
        const R2 = opts.R * 0.78;
        crescent(R2, th * 0.8, opts.a0 + 0.35, opts.a1 + 0.2, colors[3] ?? "#ffffff", 0.55);
        crescent(R2, th * 0.3, opts.a0 + 0.45, opts.a1 + 0.2, colors[5] ?? "#ffffff", 0.9);
      }
      // Speed streaks.
      for (let i = 0; i < 7; i++) {
        const a = opts.a0 + (opts.a1 - opts.a0) * (0.2 + r() * 0.7);
        const rr = opts.R * (0.7 + r() * 0.35);
        const da = 0.18 + r() * 0.2;
        line(ctx, [
          [c + Math.cos(a - da) * rr, c + Math.sin(a - da) * rr],
          [c + Math.cos(a) * rr, c + Math.sin(a) * rr],
        ], 2, withAlpha(colors[5] ?? "#ffffff", 0.7), [0.8, 0.1]);
      }
    },
  };
}

// ---------------------------------------------------------------------------
// Hexer: void orb
// ---------------------------------------------------------------------------

export function orbPart(S: MercStyle, at: Pt): { spec: PartSpec; glows: RigGlow[] } {
  const W = 100;
  const c = W / 2;
  const U = S.hostile ? RAMPS.rust : RAMPS.umbra;
  return {
    spec: {
      id: "orb",
      w: W,
      h: W,
      pivot: [c, c],
      parent: "fArmF",
      at,
      z: 13.5,
      draw: (ctx) => {
        const r = S.rng(281);
        softGlow(ctx, c, c, 44, U[3], 0.6, 0.35);
        // Orbiting shards.
        for (let i = 0; i < 4; i++) {
          const a = i * 1.7 + r();
          const d = 26 + r() * 8;
          const sx = c + Math.cos(a) * d;
          const sy = c + Math.sin(a) * d * 0.7;
          fpoly(
            ctx,
            [
              [sx, sy - 6],
              [sx + 3, sy],
              [sx, sy + 6],
              [sx - 3, sy],
            ],
            matR(U, 3, U[5]),
            { ol: 1.6, hatch: false },
          );
        }
        // Core sphere: black heart, violet rim.
        flat(ctx, ellipse(c, c, 18, 18), U[3], 3.2);
        flat(ctx, ellipse(c - 1.5, c + 1.5, 14.5, 14.5), U[1]);
        flat(ctx, ellipse(c - 3, c + 3, 9, 9), "#07040c");
        // Swirl.
        ctx.save();
        ctx.strokeStyle = withAlpha(U[4], 0.9);
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        for (let t = 0; t < 1; t += 0.02) {
          const a = t * Math.PI * 3.2;
          const rr = 3 + t * 13;
          const px = c + Math.cos(a) * rr;
          const py = c + Math.sin(a) * rr;
          if (t === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        }
        ctx.stroke();
        ctx.restore();
        glint(ctx, [
          [c + 6, c - 14],
          [c + 13, c - 7],
        ], 2.4, U[5]);
        ctx.save();
        ctx.strokeStyle = withAlpha(U[4], 0.55);
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.ellipse(c, c, 30, 11, -0.35, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      },
    },
    glows: [{ part: "orb", x: c, y: c, radius: 70, color: U[4], alpha: 0.55 }],
  };
}

// ---------------------------------------------------------------------------
// Belt lantern
// ---------------------------------------------------------------------------

export function lampColors(kind: LampKind): { core: string; mid: string; edge: string; glow: string } {
  if (kind === "arc") return { core: "#ffffff", mid: RAMPS.crystal[5], edge: RAMPS.crystal[3], glow: RAMPS.crystal[4] };
  if (kind === "shroud")
    return { core: RAMPS.umbra[5], mid: RAMPS.umbra[4], edge: RAMPS.umbra[2], glow: RAMPS.umbra[3] };
  return { core: RAMPS.lamp[5], mid: RAMPS.lamp[4], edge: RAMPS.lamp[2], glow: RAMPS.lamp[3] };
}

export function beltLanternPart(S: MercStyle, at: Pt): { spec: PartSpec; glows: RigGlow[] } | null {
  if (S.lamp === "none") return null;
  const c = lampColors(S.lamp);
  const W = 50;
  const H = 74;
  const x = 25;
  const top = 6;
  const glassY = top + 34;
  const frame = S.lamp === "arc" ? STEEL : S.lamp === "shroud" ? matR(RAMPS.umbra, 2) : BRASS;
  return {
    spec: {
      id: "lantern",
      w: W,
      h: H,
      pivot: [x, top],
      parent: "pelvis",
      at,
      z: 9.4,
      draw: (ctx) => {
        // Hook chain.
        stroke(ctx, [
          [x, top],
          [x, top + 10],
        ], 3, INK);
        stroke(ctx, [
          [x, top],
          [x, top + 10],
        ], 1.4, RAMPS.steel[4]);
        // Cap.
        fpoly(
          ctx,
          [
            [x - 6, top + 10],
            [x + 6, top + 10],
            [x + 12, top + 20],
            [x - 12, top + 20],
          ],
          frame,
          { ol: 2.4, hatch: false },
        );
        // Glass.
        softGlow(ctx, x, glassY, 24, c.glow, 0.55, 0.3);
        if (S.lamp === "arc") {
          fpoly(
            ctx,
            [
              [x - 10, top + 20],
              [x + 10, top + 20],
              [x + 10, top + 46],
              [x - 10, top + 46],
            ],
            mat(c.edge, c.edge, c.mid, c.core, c.core),
            { ol: 2.4, hatch: false, depth: 4 },
          );
          // Filament coil.
          line(ctx, [
            [x - 4, glassY - 6],
            [x + 3, glassY - 3],
            [x - 3, glassY],
            [x + 4, glassY + 3],
            [x - 3, glassY + 6],
          ], 1.6, "#ffffff");
        } else {
          fblob(
            ctx,
            [
              [x - 9, top + 20],
              [x + 9, top + 20],
              [x + 12, glassY],
              [x + 8, top + 47],
              [x - 8, top + 47],
              [x - 12, glassY],
            ],
            mat(c.edge, c.edge, c.mid, c.core, c.core),
            { ol: 2.4, hatch: false, depth: 4 },
            0.4,
          );
          fblob(
            ctx,
            [
              [x, glassY - 9],
              [x + 4, glassY + 2],
              [x, glassY + 7],
              [x - 4, glassY + 2],
            ],
            mat(c.core, c.core, "#ffffff", "#ffffff", null),
            { ol: 0, hatch: false },
            0.6,
          );
        }
        // Cage bars.
        for (const dx of [-10, 0, 10]) {
          stroke(ctx, [
            [x + dx, top + 20],
            [x + dx * 1.15, glassY],
            [x + dx * 0.85, top + 47],
          ], 2.2, INK);
        }
        // Base.
        fpoly(
          ctx,
          [
            [x - 12, top + 46],
            [x + 12, top + 46],
            [x + 8, top + 54],
            [x - 8, top + 54],
          ],
          frame,
          { ol: 2.4, hatch: false },
        );
        if (S.lamp === "shroud") {
          // Tattered shroud cloth over the top.
          fpoly(
            ctx,
            [
              [x - 13, top + 14],
              [x + 13, top + 14],
              [x + 14, top + 30],
              [x + 6, top + 26],
              [x, top + 34],
              [x - 7, top + 27],
              [x - 14, top + 32],
            ],
            matR(RAMPS.void, 3),
            { ol: 2, hatch: false },
          );
        }
      },
    },
    glows: [{ part: "lantern", x, y: glassY, radius: 64, color: c.glow, alpha: 0.5 }],
  };
}

export { BONE, fblob };
