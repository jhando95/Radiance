/**
 * HD icons: bold, ink-outlined emblematic motifs for every IconId (skills, statuses, items,
 * map nodes, stats/UI, elements, discipline emblems). Drawn procedurally in a 96-unit design
 * space with cel shading, a subtle gradient sheen, element-coloured auras and an extra outer
 * ink silhouette (plus soft drop shadow) so they read on any frame.
 *
 *   drawIconHD(id, size = 96)      transparent background, memoized per (id, size)
 *   drawSkillIconHD(id, size = 96) the same motif on a framed, element-tinted backing
 *
 * Element colour coding: physical = steel/bone, radiant = gold, void = purple,
 * fire = rust/orange, toxic = green; reaver blood = red; enemy = rust/flesh.
 */
import type { IconId } from "../icons";
import {
  arrow,
  at,
  aura,
  banner,
  bloom,
  bullet,
  chainLinks,
  chevron,
  circ,
  coin,
  cord,
  crown,
  curvedBlade,
  ell,
  eye,
  flame,
  flask,
  gear,
  heart,
  heaterShield,
  hourglass,
  type IM,
  inkW,
  lampMotif,
  line,
  liquidDrop,
  M,
  padlock,
  part,
  rays,
  reticle,
  revolver,
  rifle,
  ring,
  roundShield,
  rr,
  setInkWeight,
  shard,
  skull,
  sparkle,
  speedLines,
  star,
  sword,
  swoosh,
  vortex,
} from "./env/iconkit";
import { canvas, ctx2d, INK_COLOR, type Pt, poly, withAlpha } from "./ink";

type C = CanvasRenderingContext2D;
type Elem = "physical" | "radiant" | "void" | "fire" | "toxic" | "blood" | "enemy" | "crystal" | "neutral";

const ELEM_GLOW: Record<Elem, string> = {
  physical: "#9fb2cc",
  radiant: "#ffd36e",
  void: "#a87fe2",
  fire: "#f08a4b",
  toxic: "#8fd25a",
  blood: "#e04a3a",
  enemy: "#d0603a",
  crystal: "#6fe0d7",
  neutral: "#c9bfae",
};

// ---------------------------------------------------------------------------
// Extra motifs used by several recipes
// ---------------------------------------------------------------------------

/** Front-facing helm; origin = centre. */
function helm(ctx: C, s: number, m: IM, horns?: IM, crest?: IM) {
  if (horns)
    for (const sd of [-1, 1])
      part(
        ctx,
        (c) => {
          c.moveTo(sd * 16 * s, -8 * s);
          c.quadraticCurveTo(sd * 42 * s, -10 * s, sd * 40 * s, -40 * s);
          c.quadraticCurveTo(sd * 32 * s, -20 * s, sd * 18 * s, -18 * s);
          c.closePath();
        },
        horns,
        { depth: 4 * s },
      );
  if (crest)
    part(
      ctx,
      (c) => {
        c.moveTo(-4 * s, -26 * s);
        c.quadraticCurveTo(0, -46 * s, 18 * s, -44 * s);
        c.quadraticCurveTo(8 * s, -36 * s, 4 * s, -26 * s);
        c.closePath();
      },
      crest,
      { depth: 4 * s },
    );
  part(
    ctx,
    (c) => {
      c.moveTo(-22 * s, 24 * s);
      c.lineTo(-22 * s, -6 * s);
      c.bezierCurveTo(-22 * s, -34 * s, 22 * s, -34 * s, 22 * s, -6 * s);
      c.lineTo(22 * s, 24 * s);
      c.quadraticCurveTo(0, 30 * s, -22 * s, 24 * s);
      c.closePath();
    },
    m,
    { depth: 10 * s, hatch: true },
  );
  // eye slit + breaths
  part(ctx, rr(-17 * s, -4 * s, 34 * s, 6 * s, 2 * s), M.dark, { depth: 1, outline: 2 });
  part(ctx, rr(-2.5 * s, 2 * s, 5 * s, 20 * s, 2 * s), M.dark, { depth: 1, outline: 2 });
  for (const sd of [-1, 1])
    for (let k = 0; k < 3; k++) part(ctx, circ(sd * 10 * s, (10 + k * 5) * s, 1.4 * s), M.dark, { outline: 0 });
}

/** Warhammer head + haft; origin = haft bottom, pointing up. */
function warhammer(ctx: C, L: number, head: IM = M.iron) {
  part(ctx, rr(-3.5, -L, 7, L, 3), M.wood, { depth: 3 });
  part(ctx, rr(-4.5, -L * 0.16, 9, L * 0.14, 2), M.leather, { depth: 2, outline: 2.4 });
  part(
    ctx,
    poly([
      [-20, -L - 2],
      [16, -L - 2],
      [22, -L + 6],
      [16, -L + 14],
      [-20, -L + 14],
      [-26, -L + 6],
    ]),
    head,
    { depth: 6, hatch: true },
  );
  part(ctx, rr(-5, -L - 4, 10, 20, 2), M.brass, { depth: 2, outline: 2.4 });
}

/** Heavy executioner's axe; origin = haft bottom. */
function axe(ctx: C, L: number) {
  part(ctx, rr(-3.5, -L, 7, L, 3), M.wood, { depth: 3 });
  part(
    ctx,
    (c) => {
      c.moveTo(2, -L + 4);
      c.quadraticCurveTo(22, -L - 6, 34, -L + 6);
      c.quadraticCurveTo(26, -L + 28, 34, -L + 46);
      c.quadraticCurveTo(20, -L + 46, 2, -L + 34);
      c.closePath();
    },
    M.steel,
    { depth: 8, hatch: true },
  );
  line(ctx, [
    [30, -L + 8],
    [26, -L + 26],
    [30, -L + 44],
  ], 2.4, M.steel.light);
  part(ctx, rr(-5, -L + 2, 9, 34, 2), M.iron, { depth: 2, outline: 2.4 });
}

/** Dagger pointing right; origin = pommel. */
function dagger(ctx: C, L: number, blade: IM = M.steel) {
  at(ctx, 0, 0, Math.PI / 2, 1, () => sword(ctx, L, blade, M.iron, 1.15));
}

/** Boot (side view, toe right); origin = sole centre. */
function boot(ctx: C, s: number, m: IM = M.leather) {
  part(
    ctx,
    (c) => {
      c.moveTo(-14 * s, -40 * s);
      c.lineTo(8 * s, -40 * s);
      c.lineTo(8 * s, -14 * s);
      c.quadraticCurveTo(26 * s, -12 * s, 26 * s, -2 * s);
      c.lineTo(26 * s, 2 * s);
      c.lineTo(-16 * s, 2 * s);
      c.closePath();
    },
    m,
    { depth: 7 * s, hatch: true },
  );
  part(ctx, rr(-17 * s, -2 * s, 44 * s, 6 * s, 2 * s), M.dark, { depth: 1, outline: 2.4 });
  part(ctx, rr(-16 * s, -44 * s, 26 * s, 7 * s, 2 * s), M.brass, { depth: 1.5, outline: 2.2 });
}

/** Feathered wing (sweeping up-left); origin = root. */
function wing(ctx: C, s: number, m: IM = M.bone) {
  for (let i = 4; i >= 0; i--) {
    const a = -2.2 + i * 0.28;
    const L = (44 - i * 5) * s;
    at(ctx, 0, 0, a + Math.PI / 2, 1, () =>
      part(
        ctx,
        (c) => {
          c.moveTo(0, 0);
          c.quadraticCurveTo(-7 * s, -L * 0.5, 0, -L);
          c.quadraticCurveTo(7 * s, -L * 0.5, 0, 0);
          c.closePath();
        },
        m,
        { depth: 3 * s, outline: 2.4 },
      ),
    );
  }
}

/** Feather; origin = quill base, pointing up-right. */
function feather(ctx: C, L: number, m: IM = M.bone) {
  part(
    ctx,
    (c) => {
      c.moveTo(0, 0);
      c.bezierCurveTo(-L * 0.28, -L * 0.3, -L * 0.1, -L * 0.85, L * 0.12, -L);
      c.bezierCurveTo(L * 0.22, -L * 0.7, L * 0.18, -L * 0.25, 0, 0);
      c.closePath();
    },
    m,
    { depth: L * 0.08, hatch: true },
  );
  line(ctx, [
    [0, 4],
    [L * 0.06, -L * 0.5],
    [L * 0.12, -L * 0.96],
  ], inkW(2));
  for (let k = 1; k < 5; k++) {
    const t = k / 5;
    line(ctx, [
      [L * 0.06 * t * 1.6, -L * t * 0.9],
      [-L * 0.12, -L * t * 0.9 + L * 0.08],
    ], 1.4, withAlpha(INK_COLOR, 0.5));
  }
}

/** Treasure chest; origin = bottom centre. */
function chest(ctx: C, s: number) {
  part(ctx, rr(-30 * s, -28 * s, 60 * s, 28 * s, 3 * s), M.wood, { depth: 7 * s, hatch: true });
  part(
    ctx,
    (c) => {
      c.moveTo(-30 * s, -28 * s);
      c.bezierCurveTo(-30 * s, -50 * s, 30 * s, -50 * s, 30 * s, -28 * s);
      c.closePath();
    },
    M.wood,
    { depth: 6 * s },
  );
  for (const x of [-22, 22]) part(ctx, rr((x - 3) * s, -46 * s, 6 * s, 46 * s, 1), M.brass, { depth: 1.5, outline: 2 });
  part(ctx, rr(-31 * s, -30 * s, 62 * s, 5 * s, 1), M.brass, { depth: 1.5, outline: 2 });
  part(ctx, rr(-7 * s, -34 * s, 14 * s, 14 * s, 2 * s), M.gold, { depth: 2, outline: 2.2 });
  part(ctx, circ(0, -27 * s, 2.2 * s), M.dark, { outline: 0 });
}

/** Campfire; origin = ground centre. */
function campfire(ctx: C, s: number) {
  bloom(ctx, 0, -24 * s, 46 * s, "#f2a93b", 0.55);
  at(ctx, 0, -4 * s, 0.38, 1, () => part(ctx, rr(-30 * s, -5 * s, 60 * s, 10 * s, 5 * s), M.wood, { depth: 3, hatch: true }));
  at(ctx, 0, -4 * s, -0.38, 1, () => part(ctx, rr(-30 * s, -5 * s, 60 * s, 10 * s, 5 * s), M.wood, { depth: 3, hatch: true }));
  flame(ctx, 34 * s, 50 * s);
  for (let i = -2; i <= 2; i++) part(ctx, ell(i * 12 * s, 2 * s, 6 * s, 4 * s), M.rock, { depth: 1, outline: 2 });
}

/** Ruined watchtower; origin = base centre. */
function ruinTower(ctx: C, s: number, m: IM = M.rock) {
  part(
    ctx,
    poly([
      [-18 * s, 0],
      [-14 * s, -58 * s],
      [-8 * s, -52 * s],
      [-2 * s, -64 * s],
      [6 * s, -50 * s],
      [14 * s, -46 * s],
      [18 * s, 0],
    ]),
    m,
    { depth: 8 * s, hatch: true },
  );
  part(ctx, rr(-5 * s, -38 * s, 10 * s, 14 * s, 5 * s), M.dark, { depth: 1, outline: 2.2 });
  part(ctx, rr(-6 * s, -14 * s, 12 * s, 14 * s, 6 * s), M.dark, { depth: 1, outline: 2.2 });
  for (const [y, x0, x1] of [
    [-26, -16, -6],
    [-44, 6, 15],
  ] as const)
    line(ctx, [
      [x0 * s, y * s],
      [x1 * s, y * s],
    ], inkW(1.8));
}

/** Clawed talons (three hooked claws) slashing down-right; origin = centre. */
function talons(ctx: C, s: number, m: IM = M.bone) {
  for (let i = -1; i <= 1; i++) {
    at(ctx, i * 14 * s, i * 4 * s, 0.25, 1, () =>
      part(
        ctx,
        (c) => {
          c.moveTo(-6 * s, -26 * s);
          c.quadraticCurveTo(10 * s, -14 * s, 6 * s, 28 * s);
          c.quadraticCurveTo(0, 4 * s, -8 * s, -10 * s);
          c.closePath();
        },
        m,
        { depth: 4 * s },
      ),
    );
  }
}

/** Candle; origin = base centre. */
function candle(ctx: C, s: number, lit: boolean) {
  part(ctx, rr(-9 * s, -38 * s, 18 * s, 38 * s, 3 * s), M.bone, { depth: 5 * s, hatch: true });
  part(
    ctx,
    (c) => {
      c.moveTo(-9 * s, -34 * s);
      c.quadraticCurveTo(-12 * s, -24 * s, -8 * s, -22 * s);
      c.quadraticCurveTo(-6 * s, -28 * s, -4 * s, -36 * s);
      c.closePath();
    },
    M.bone,
    { depth: 1, outline: 2 },
  );
  line(ctx, [
    [0, -38 * s],
    [1 * s, -45 * s],
  ], inkW(2.4));
  if (lit) at(ctx, 1 * s, -44 * s, 0, 1, () => flame(ctx, 12 * s, 20 * s, M.gold, M.white));
  part(ctx, ell(0, 0, 18 * s, 5 * s), M.brass, { depth: 2, outline: 2.4 });
}

/** Cracks radiating from a point (ink + light edge). */
function cracks(ctx: C, x: number, y: number, r: number, n: number, seed: number) {
  let a = seed;
  const rnd = () => {
    a = (a * 9301 + 49297) % 233280;
    return a / 233280;
  };
  for (let i = 0; i < n; i++) {
    const ang = Math.PI + (i / (n - 1)) * Math.PI + (rnd() - 0.5) * 0.3;
    const pts: Pt[] = [[x, y]];
    let px = x;
    let py = y;
    for (let k = 1; k <= 3; k++) {
      px += Math.cos(ang + (rnd() - 0.5) * 0.6) * (r / 3);
      py += Math.sin(ang + (rnd() - 0.5) * 0.6) * (r / 3) * 0.45;
      pts.push([px, py]);
    }
    line(ctx, pts, inkW(3));
  }
}

/** A circle of runes (void sigil). */
function runeCircle(ctx: C, r: number, m: IM) {
  ctx.save();
  for (const [w, col] of [
    [inkW(7), INK_COLOR],
    [3, m.fill],
  ] as const) {
    ctx.strokeStyle = col;
    ctx.lineWidth = w;
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.restore();
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    at(ctx, Math.cos(a) * r, Math.sin(a) * r, a + Math.PI / 2, 1, () =>
      part(ctx, poly([[-4, -5], [4, -5], [0, 6]]), m, { depth: 1, outline: 2 }),
    );
  }
}

/** Ore chunk with crystal and gold flecks; origin = centre. */
function oreChunk(ctx: C, s: number) {
  part(
    ctx,
    poly([
      [-28 * s, 10 * s],
      [-24 * s, -12 * s],
      [-6 * s, -24 * s],
      [16 * s, -20 * s],
      [28 * s, -2 * s],
      [22 * s, 18 * s],
      [-10 * s, 22 * s],
    ]),
    M.rock,
    { depth: 9 * s, hatch: true },
  );
  at(ctx, -4 * s, -8 * s, -0.3, 1, () => shard(ctx, 24 * s, 10 * s));
  at(ctx, 8 * s, -6 * s, 0.4, 1, () => shard(ctx, 18 * s, 8 * s));
  for (const [x, y] of [
    [-14, 8],
    [10, 10],
    [18, -6],
  ] as const)
    part(ctx, star(x * s, y * s, 1.6 * s, 4 * s, 4), M.gold, { depth: 1, outline: 1.5 });
}

/** Hooded figure bust; origin = bottom centre. */
function hoodedBust(ctx: C, s: number, m: IM, glow?: string) {
  part(
    ctx,
    (c) => {
      c.moveTo(-34 * s, 0);
      c.quadraticCurveTo(-30 * s, -26 * s, -16 * s, -32 * s);
      c.quadraticCurveTo(-20 * s, -64 * s, 0, -68 * s);
      c.quadraticCurveTo(20 * s, -64 * s, 16 * s, -32 * s);
      c.quadraticCurveTo(30 * s, -26 * s, 34 * s, 0);
      c.closePath();
    },
    m,
    { depth: 10 * s, hatch: true },
  );
  part(ctx, ell(0, -42 * s, 10 * s, 13 * s), M.dark, { depth: 2, outline: 2.2 });
  if (glow)
    for (const sd of [-1, 1]) {
      bloom(ctx, sd * 4.5 * s, -44 * s, 6 * s, glow, 0.8);
      part(ctx, ell(sd * 4.5 * s, -44 * s, 2.4 * s, 1.6 * s), { ...M.gold, fill: glow }, { outline: 0 });
    }
}

// ---------------------------------------------------------------------------
// Recipes (96-unit space)
// ---------------------------------------------------------------------------

const RUST_IRON: IM = { fill: "#8a5236", shade: "#5a3022", deep: "#2e1610", light: "#c07a4e", glow: "#bd4a2e" };

interface Recipe {
  e: Elem;
  draw: (ctx: C) => void;
}
const R = (e: Elem, draw: (ctx: C) => void): Recipe => ({ e, draw });

const RECIPES: Record<IconId, Recipe> = {
  // ---------------- Vanguard ----------------
  skill_shieldBash: R("physical", (ctx) => {
    speedLines(ctx, [
      [10, 34, 26, 34],
      [6, 50, 22, 50],
      [10, 66, 26, 66],
    ], M.steel.light);
    at(ctx, 46, 50, -0.22, 1, () => heaterShield(ctx, 44, 56));
    rays(ctx, 76, 36, 6, 20, 8, M.gold, 0.22);
    sparkle(ctx, 76, 36, 7);
  }),
  skill_bulwark: R("physical", (ctx) => {
    aura(ctx, 48, 48, 46, "#8399ba", 0.35);
    at(ctx, 26, 52, -0.18, 0.72, () => heaterShield(ctx, 44, 56, M.iron, M.iron));
    at(ctx, 70, 52, 0.18, 0.72, () => heaterShield(ctx, 44, 56, M.iron, M.iron));
    at(ctx, 48, 48, 0, 1.05, () => heaterShield(ctx, 46, 60));
    at(ctx, 48, 46, 0, 1, () => part(ctx, star(0, 0, 4, 11, 4), M.gold, { depth: 2, outline: 2.4 }));
  }),
  skill_provoke: R("physical", (ctx) => {
    aura(ctx, 48, 50, 44, "#e04a3a", 0.35);
    at(ctx, 48, 54, 0, 1, () => helm(ctx, 1, M.iron, M.bone));
    speedLines(ctx, [
      [12, 30, 4, 22],
      [8, 50, 0, 50],
      [84, 30, 92, 22],
      [88, 50, 96, 50],
    ], "#f5866a", 3.2);
  }),
  skill_seismicSlam: R("physical", (ctx) => {
    part(ctx, ell(48, 80, 40, 9), M.rock, { depth: 4 });
    cracks(ctx, 48, 80, 40, 5, 7);
    at(ctx, 54, 72, -0.55, 1, () => warhammer(ctx, 62));
    for (const [x, y, r] of [
      [18, 62, 5],
      [80, 58, 6],
      [26, 48, 3.5],
    ] as const)
      part(ctx, poly([[x - r, y], [x, y - r], [x + r, y + r * 0.4], [x, y + r]]), M.rock, { depth: 2, outline: 2.2 });
  }),
  skill_grappleChain: R("physical", (ctx) => {
    chainLinks(ctx, [
      [12, 84],
      [30, 62],
      [48, 50],
      [60, 36],
    ], 13);
    at(ctx, 66, 30, 0.6, 1, () => {
      cord(
        ctx,
        (c) => {
          c.moveTo(0, 6);
          c.lineTo(0, -10);
          c.arc(-10, -10, 10, 0, Math.PI, true);
        },
        6,
        M.steel.fill,
        M.steel.light,
      );
      part(ctx, poly([[-20, -12], [-26, -2], [-16, -4]]), M.steel, { depth: 1, outline: 2.2 });
      part(ctx, circ(0, 8, 5), M.iron, { depth: 1, outline: 2.2 });
    });
  }),
  skill_rallyCry: R("radiant", (ctx) => {
    aura(ctx, 52, 36, 46, "#ffd36e", 0.45);
    rays(ctx, 54, 34, 18, 40, 12, M.gold, 0.12, 0.2, 1.8);
    at(ctx, 34, 90, 0, 1, () =>
      banner(ctx, 1, M.cloth, () => part(ctx, star(22, -50, 4, 10, 8), M.gold, { depth: 2, outline: 2 })),
    );
  }),

  // ---------------- Gunner ----------------
  skill_aimedShot: R("physical", (ctx) => {
    at(ctx, 48, 48, 0, 1, () => reticle(ctx, 28, "#f5866a"));
    at(ctx, 14, 82, -0.785, 1, () => bullet(ctx, 30));
  }),
  skill_suppressingFire: R("fire", (ctx) => {
    at(ctx, 10, 48, 0, 1, () => rays(ctx, 0, 0, 4, 18, 7, M.fire, 0.3));
    for (const [x, y] of [
      [30, 26],
      [44, 48],
      [30, 70],
    ] as const) {
      speedLines(ctx, [[x - 18, y, x - 4, y]], M.gold.light, 2.4);
      at(ctx, x, y, 0, 1, () => bullet(ctx, 40));
    }
  }),
  skill_flareRound: R("radiant", (ctx) => {
    cord(
      ctx,
      (c) => {
        c.moveTo(14, 86);
        c.quadraticCurveTo(26, 56, 54, 40);
      },
      5,
      "#f2a93b",
    );
    bloom(ctx, 66, 30, 34, "#ffd36e", 0.9);
    rays(ctx, 66, 30, 9, 28, 10, M.gold, 0.18);
    part(ctx, circ(66, 30, 10), M.white, { depth: 2, outline: 2.4 });
    at(ctx, 40, 50, -0.65, 1, () => bullet(ctx, 26, M.fire, M.brass));
  }),
  skill_piercingRound: R("physical", (ctx) => {
    for (const x of [40, 62]) {
      part(ctx, rr(x - 4, 22, 8, 54, 2), M.iron, { depth: 3, hatch: true });
      part(ctx, circ(x, 48, 5), M.dark, { depth: 1, outline: 2 });
    }
    speedLines(ctx, [[6, 48, 30, 48]], M.steel.light, 3);
    at(ctx, 52, 48, 0, 1, () => bullet(ctx, 40, M.steel, M.brass));
    sparkle(ctx, 40, 48, 8);
    sparkle(ctx, 62, 48, 6);
  }),
  skill_pointBlank: R("fire", (ctx) => {
    bloom(ctx, 74, 44, 26, "#f08a4b", 0.8);
    rays(ctx, 74, 44, 6, 22, 9, M.fire, 0.28);
    part(ctx, circ(74, 44, 7), M.gold, { depth: 2, outline: 2.2 });
    at(ctx, 22, 84, 0, 1, () => revolver(ctx, 1));
  }),
  skill_quickReload: R("physical", (ctx) => {
    ctx.save();
    for (const [w, col] of [
      [inkW(10), INK_COLOR],
      [5, M.gold.fill],
    ] as const) {
      ctx.strokeStyle = col;
      ctx.lineWidth = w;
      ctx.beginPath();
      ctx.arc(48, 48, 36, -2.6, 2.0);
      ctx.stroke();
    }
    ctx.restore();
    at(ctx, 48 + Math.cos(2.0) * 36, 48 + Math.sin(2.0) * 36, 2.0 + Math.PI / 2, 1, () =>
      part(ctx, poly([[-10, -6], [10, -6], [0, 8]]), M.gold, { depth: 2, outline: 2.4 }),
    );
    part(ctx, circ(48, 48, 24), M.steel, { depth: 6, hatch: true });
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2 - Math.PI / 2;
      part(ctx, circ(48 + Math.cos(a) * 13, 48 + Math.sin(a) * 13, 5.4), i === 0 ? M.dark : M.brass, { depth: 1.5, outline: 2 });
    }
    part(ctx, circ(48, 48, 3.5), M.iron, { outline: 2 });
  }),

  // ---------------- Lamplighter ----------------
  skill_kindleWounds: R("fire", (ctx) => {
    at(ctx, 48, 58, 0, 1, () => flame(ctx, 48, 60));
    at(ctx, 48, 86, 0, 1, () => liquidDrop(ctx, 9, M.blood));
    sparkle(ctx, 76, 24, 6, "#ffe08a");
  }),
  skill_radiantLash: R("radiant", (ctx) => {
    aura(ctx, 52, 44, 44, "#ffd36e", 0.35);
    cord(
      ctx,
      (c) => {
        c.moveTo(20, 80);
        c.bezierCurveTo(30, 40, 84, 60, 76, 30);
        c.bezierCurveTo(70, 10, 40, 16, 46, 34);
      },
      5,
      M.gold.fill,
      M.gold.light,
    );
    at(ctx, 20, 80, 0.5, 1, () => part(ctx, rr(-5, -2, 10, 22, 3), M.leather, { depth: 2 }));
    sparkle(ctx, 46, 34, 7);
    sparkle(ctx, 82, 50, 5);
    sparkle(ctx, 30, 50, 4);
  }),
  skill_beacon: R("radiant", (ctx) => {
    aura(ctx, 48, 30, 46, "#ffd36e", 0.5);
    rays(ctx, 48, 28, 16, 40, 12, M.gold, 0.12, 0, 1.8);
    part(ctx, poly([[34, 90], [40, 44], [56, 44], [62, 90]]), M.rock, { depth: 6, hatch: true });
    line(ctx, [
      [38, 64],
      [58, 64],
    ], inkW(2));
    line(ctx, [
      [36, 78],
      [60, 78],
    ], inkW(2));
    at(ctx, 48, 46, 0, 0.6, () => lampMotif(ctx, 1));
  }),
  skill_purge: R("radiant", (ctx) => {
    bloom(ctx, 48, 48, 44, "#ffd36e", 0.6);
    rays(ctx, 48, 48, 16, 42, 16, M.gold, 0.1);
    part(ctx, ring(48, 48, 17, 24), M.gold, { depth: 3, outline: 2.6 });
    part(ctx, circ(48, 48, 13), M.white, { depth: 3, outline: 2.4 });
    for (const [x, y] of [
      [20, 24],
      [78, 74],
      [16, 72],
    ] as const)
      part(ctx, circ(x, y, 4), M.void, { depth: 1, outline: 2 });
  }),
  skill_blindingFlash: R("radiant", (ctx) => {
    at(ctx, 48, 54, 0, 1, () => eye(ctx, 60, M.void));
    bloom(ctx, 60, 34, 34, "#fff6d0", 0.95);
    rays(ctx, 60, 34, 6, 30, 8, M.white, 0.2);
    sparkle(ctx, 60, 34, 12, "#ffffff");
  }),
  skill_warmth: R("radiant", (ctx) => {
    aura(ctx, 48, 52, 46, "#f2a93b", 0.55);
    at(ctx, 48, 50, 0, 1, () => flame(ctx, 64, 66, M.brass, M.gold));
    at(ctx, 48, 62, 0, 1, () => heart(ctx, 30, { ...M.blood, fill: "#e0503a", light: "#ffb08a" }));
  }),

  // ---------------- Reaver ----------------
  skill_rend: R("blood", (ctx) => {
    for (let i = -1; i <= 1; i++) swoosh(ctx, 20 + i * 16, 92 - i * 4, 70, -1.2, -0.25, 9, i === 0 ? M.blood.light : M.blood.fill);
    at(ctx, 72, 76, 0, 1, () => liquidDrop(ctx, 6, M.blood));
    at(ctx, 84, 62, 0, 1, () => liquidDrop(ctx, 4, M.blood));
  }),
  skill_lunge: R("blood", (ctx) => {
    speedLines(ctx, [
      [6, 36, 28, 36],
      [2, 50, 24, 50],
      [6, 64, 28, 64],
    ], M.blood.light, 3);
    at(ctx, 22, 50, 0, 1, () => dagger(ctx, 70));
  }),
  skill_flurry: R("blood", (ctx) => {
    swoosh(ctx, 48, 52, 34, -2.8, -0.4, 8, M.blood.fill);
    swoosh(ctx, 48, 52, 24, 0.4, 2.6, 7, M.blood.light);
    at(ctx, 30, 78, 0.45, 1, () => curvedBlade(ctx, 52));
    at(ctx, 66, 80, -0.25, 1, () => curvedBlade(ctx, 46));
  }),
  skill_execute: R("blood", (ctx) => {
    at(ctx, 48, 74, 0, 0.62, () => skull(ctx, 1));
    at(ctx, 30, 88, -0.35, 1, () => axe(ctx, 80));
    at(ctx, 70, 26, 0, 1, () => liquidDrop(ctx, 5, M.blood));
  }),
  skill_shadowstep: R("void", (ctx) => {
    for (const [x, a] of [
      [26, 0.25],
      [38, 0.5],
    ] as const) {
      ctx.save();
      ctx.globalAlpha = a;
      at(ctx, x, 90, 0, 0.85, () => hoodedBust(ctx, 1, M.void));
      ctx.restore();
    }
    at(ctx, 58, 90, 0, 0.95, () => hoodedBust(ctx, 1, M.dark, "#c8a0ff"));
    for (const [x, y] of [
      [20, 40],
      [84, 30],
      [80, 60],
    ] as const)
      sparkle(ctx, x, y, 4, "#dcc6fb");
  }),
  skill_hamstring: R("blood", (ctx) => {
    at(ctx, 42, 86, 0, 1.1, () => boot(ctx, 1));
    swoosh(ctx, 20, 30, 50, 0.2, 1.4, 8, M.blood.light);
    at(ctx, 60, 70, 0, 1, () => liquidDrop(ctx, 5, M.blood));
    at(ctx, 72, 82, 0, 1, () => liquidDrop(ctx, 4, M.blood));
  }),

  // ---------------- Hexer ----------------
  skill_voidBolt: R("void", (ctx) => {
    swoosh(ctx, 10, 96, 66, -1.45, -0.55, 18, withAlpha(M.void.shade, 0.9));
    swoosh(ctx, 10, 96, 66, -1.3, -0.65, 8, M.void.light, false);
    bloom(ctx, 62, 36, 30, "#a87fe2", 0.8);
    part(ctx, circ(62, 36, 16), M.void, { depth: 6 });
    part(ctx, circ(58, 32, 6), { ...M.white, fill: "#f0e4ff" }, { outline: 0 });
    sparkle(ctx, 84, 18, 5, "#e4d2ff");
    sparkle(ctx, 80, 58, 4, "#e4d2ff");
  }),
  skill_hexOfFrailty: R("void", (ctx) => {
    aura(ctx, 48, 48, 46, "#a87fe2", 0.4);
    at(ctx, 48, 48, 0, 1, () => runeCircle(ctx, 34, M.void));
    at(ctx, 48, 48, -0.785, 1, () => {
      part(ctx, rr(-4, -24, 8, 48, 3), M.bone, { depth: 2 });
      for (const sd of [-1, 1]) {
        part(ctx, circ(-5, sd * 24, 5.5), M.bone, { depth: 1.5, outline: 2.4 });
        part(ctx, circ(5, sd * 24, 5.5), M.bone, { depth: 1.5, outline: 2.4 });
      }
      line(ctx, [
        [-5, -2],
        [2, 1],
        [-2, 4],
        [5, 6],
      ], inkW(2.4));
    });
  }),
  skill_siphon: R("void", (ctx) => {
    at(ctx, 26, 72, 0, 1, () => heart(ctx, 30, M.blood));
    cord(
      ctx,
      (c) => {
        c.moveTo(34, 62);
        c.bezierCurveTo(50, 54, 40, 34, 60, 30);
      },
      5,
      M.blood.fill,
      M.blood.light,
    );
    bloom(ctx, 68, 28, 26, "#a87fe2", 0.7);
    at(ctx, 68, 28, 0, 0.6, () => vortex(ctx, 24, M.void));
  }),
  skill_umbralTide: R("void", (ctx) => {
    aura(ctx, 48, 60, 46, "#7546b8", 0.5);
    part(
      ctx,
      (c) => {
        c.moveTo(4, 86);
        c.bezierCurveTo(10, 50, 40, 22, 70, 24);
        c.bezierCurveTo(90, 26, 92, 48, 76, 52);
        c.bezierCurveTo(66, 54, 62, 42, 70, 40);
        c.bezierCurveTo(54, 38, 44, 60, 56, 86);
        c.closePath();
      },
      M.void,
      { depth: 8, hatch: true },
    );
    part(
      ctx,
      (c) => {
        c.moveTo(40, 88);
        c.bezierCurveTo(46, 66, 64, 58, 80, 64);
        c.bezierCurveTo(92, 70, 88, 84, 92, 88);
        c.closePath();
      },
      { ...M.void, fill: M.void.shade, shade: M.void.deep },
      { depth: 5 },
    );
    for (const [x, y] of [
      [26, 30],
      [86, 34],
    ] as const)
      sparkle(ctx, x, y, 5, "#e4d2ff");
  }),
  skill_snuffLight: R("void", (ctx) => {
    at(ctx, 40, 88, 0, 1.1, () => candle(ctx, 1, false));
    cord(
      ctx,
      (c) => {
        c.moveTo(41, 38);
        c.bezierCurveTo(30, 26, 52, 22, 46, 12);
      },
      4,
      M.void.fill,
    );
    at(ctx, 64, 34, 0.4, 1, () => {
      part(
        ctx,
        (c) => {
          c.moveTo(-14, 10);
          c.quadraticCurveTo(0, -10, 14, 10);
          c.closePath();
        },
        M.brass,
        { depth: 3 },
      );
      part(ctx, rr(10, 2, 24, 5, 2), M.wood, { depth: 1, outline: 2.2 });
    });
  }),
  skill_rotCurse: R("toxic", (ctx) => {
    aura(ctx, 48, 44, 44, "#8fd25a", 0.4);
    at(ctx, 48, 42, 0, 1, () => skull(ctx, 1, { ...M.bone, fill: "#b8c89a", shade: "#7a8a5a" }, "#2a5622"));
    for (const [x, y, r] of [
      [36, 82, 5],
      [52, 90, 6],
      [64, 80, 4],
    ] as const)
      at(ctx, x, y, 0, 1, () => liquidDrop(ctx, r, M.toxic));
  }),

  // ---------------- Common ----------------
  skill_move: R("neutral", (ctx) => {
    at(ctx, 52, 36, 0, 1, () => arrow(ctx, 60, 12, M.bone));
    at(ctx, 44, 64, Math.PI, 1, () => arrow(ctx, 60, 12, M.bone));
  }),
  skill_wait: R("neutral", (ctx) => {
    at(ctx, 48, 48, 0, 1, () => hourglass(ctx, 72));
  }),

  // ---------------- Enemy ----------------
  skill_enemyMelee: R("enemy", (ctx) => {
    aura(ctx, 48, 48, 44, "#bd4a2e", 0.35);
    at(ctx, 48, 48, 0, 1.1, () => talons(ctx, 1));
  }),
  skill_enemyRanged: R("enemy", (ctx) => {
    for (const [x, y] of [
      [24, 72],
      [16, 80],
      [30, 82],
    ] as const)
      part(ctx, circ(x, y, 4), M.toxic, { depth: 1, outline: 2 });
    speedLines(ctx, [[20, 76, 40, 56]], M.toxic.fill, 4);
    at(ctx, 42, 56, -0.785, 1, () =>
      part(
        ctx,
        (c) => {
          c.moveTo(0, -8);
          c.lineTo(44, 0);
          c.lineTo(0, 8);
          c.quadraticCurveTo(6, 0, 0, -8);
          c.closePath();
        },
        M.bone,
        { depth: 4, hatch: true },
      ),
    );
  }),
  skill_enemyBuff: R("enemy", (ctx) => {
    aura(ctx, 48, 50, 46, "#e04a3a", 0.45);
    at(ctx, 48, 40, -Math.PI / 2, 1, () => arrow(ctx, 58, 18, M.flesh));
    at(ctx, 48, 80, -Math.PI / 2, 1, () => chevron(ctx, 16, 44, 9, M.blood));
  }),
  skill_enemyDebuff: R("enemy", (ctx) => {
    aura(ctx, 48, 44, 44, "#8fd25a", 0.3);
    at(ctx, 48, 40, 0, 1, () => eye(ctx, 66, { ...M.toxic, fill: "#d0c040", shade: "#8a7a20" }, M.flesh, true));
    for (const [x, y, r] of [
      [34, 72, 4],
      [50, 82, 5],
      [62, 70, 3.5],
    ] as const)
      at(ctx, x, y, 0, 1, () => liquidDrop(ctx, r, M.toxic));
  }),
  skill_enemyHeal: R("enemy", (ctx) => {
    aura(ctx, 48, 50, 46, "#8fd25a", 0.35);
    part(ctx, ell(48, 52, 30, 28), M.flesh, { depth: 10, hatch: true });
    for (const pts of [
      [
        [30, 40],
        [40, 50],
        [36, 64],
      ],
      [
        [62, 32],
        [58, 48],
        [68, 60],
      ],
    ] as Pt[][])
      line(ctx, pts, inkW(2.4), M.blood.deep);
    at(ctx, 70, 30, 0, 1, () => {
      part(ctx, rr(-4, -12, 8, 24, 2), M.toxic, { depth: 2, outline: 2.4 });
      part(ctx, rr(-12, -4, 24, 8, 2), M.toxic, { depth: 2, outline: 2.4 });
    });
  }),

  // ---------------- Statuses ----------------
  status_bleed: R("blood", (ctx) => {
    at(ctx, 48, 60, 0, 1, () => liquidDrop(ctx, 16, M.blood));
    at(ctx, 22, 76, 0, 1, () => liquidDrop(ctx, 8, M.blood));
    at(ctx, 76, 82, 0, 1, () => liquidDrop(ctx, 7, M.blood));
  }),
  status_burn: R("fire", (ctx) => {
    at(ctx, 48, 88, 0, 1, () => flame(ctx, 60, 78));
  }),
  status_toxic: R("toxic", (ctx) => {
    at(ctx, 44, 74, 0, 1, () => liquidDrop(ctx, 20, M.toxic));
    part(ctx, circ(74, 30, 9), M.toxic, { depth: 3, outline: 2.6 });
    part(ctx, circ(80, 54, 5), M.toxic, { depth: 2, outline: 2.4 });
    part(ctx, circ(44, 70, 6), { ...M.toxic, fill: M.toxic.deep, shade: "#14300f" }, { outline: 0 });
  }),
  status_stun: R("radiant", (ctx) => {
    ctx.save();
    for (const [w, col] of [
      [inkW(8), INK_COLOR],
      [3.4, M.gold.shade],
    ] as const) {
      ctx.strokeStyle = col;
      ctx.lineWidth = w;
      ctx.beginPath();
      ctx.ellipse(48, 52, 38, 14, -0.15, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.restore();
    for (const [x, y, s] of [
      [16, 52, 13],
      [56, 36, 16],
      [78, 62, 11],
    ] as const)
      part(ctx, star(x, y, s * 0.45, s, 5), M.gold, { depth: 3, outline: 2.6 });
  }),
  status_mark: R("blood", (ctx) => {
    at(ctx, 48, 48, 0, 1.1, () => reticle(ctx, 30, "#ff6a4a"));
  }),
  status_guard: R("physical", (ctx) => {
    at(ctx, 48, 52, 0, 1.2, () => heaterShield(ctx, 54, 66));
    at(ctx, 48, 48, -Math.PI / 2, 1, () => chevron(ctx, 16, 34, 8, M.gold));
  }),
  status_shield: R("crystal", (ctx) => {
    bloom(ctx, 48, 48, 44, "#6fe0d7", 0.4);
    part(ctx, circ(48, 48, 38), { ...M.crystal, fill: "#3fbfc0", shade: "#1f7f88" }, { depth: 12, sheen: 1.5 });
    ctx.save();
    ctx.beginPath();
    ctx.arc(48, 48, 36, 0, Math.PI * 2);
    ctx.clip();
    ctx.strokeStyle = withAlpha("#e8fffa", 0.55);
    ctx.lineWidth = 2;
    for (let r = -3; r <= 3; r++)
      for (let q = -3; q <= 3; q++) {
        const x = 48 + q * 16 + (r % 2 ? 8 : 0);
        const y = 48 + r * 14;
        ctx.beginPath();
        poly([0, 1, 2, 3, 4, 5].map((k) => [x + Math.cos((k * Math.PI) / 3 + Math.PI / 6) * 8, y + Math.sin((k * Math.PI) / 3 + Math.PI / 6) * 8] as Pt))(ctx);
        ctx.stroke();
      }
    ctx.restore();
    ctx.fillStyle = "rgba(255,255,255,0.6)";
    ctx.beginPath();
    ctx.ellipse(34, 30, 10, 5, -0.6, 0, Math.PI * 2);
    ctx.fill();
  }),
  status_blind: R("neutral", (ctx) => {
    at(ctx, 48, 48, 0, 1, () => eye(ctx, 72, M.steel));
    line(ctx, [
      [14, 80],
      [82, 16],
    ], inkW(12));
    line(ctx, [
      [14, 80],
      [82, 16],
    ], 5, "#f5866a");
  }),
  status_corrode: R("toxic", (ctx) => {
    part(ctx, rr(14, 18, 68, 46, 4), M.iron, { depth: 10, hatch: true });
    for (const [x, y] of [
      [26, 28],
      [70, 28],
      [26, 54],
      [70, 54],
    ] as const)
      part(ctx, circ(x, y, 3), M.brass, { outline: 1.6 });
    part(ctx, ell(50, 40, 12, 8), M.dark, { depth: 2, outline: 2.2 });
    ctx.save();
    ctx.beginPath();
    rr(14, 18, 68, 46, 4)(ctx);
    ctx.clip();
    part(ctx, ell(48, 22, 30, 10), M.toxic, { depth: 3, outline: 2.2 });
    ctx.restore();
    for (const [x, y, r] of [
      [32, 76, 5],
      [52, 84, 6],
      [68, 74, 4],
    ] as const)
      at(ctx, x, y, 0, 1, () => liquidDrop(ctx, r, M.toxic));
  }),
  status_haste: R("radiant", (ctx) => {
    speedLines(ctx, [
      [8, 32, 24, 32],
      [6, 64, 22, 64],
    ], M.gold.light, 3);
    at(ctx, 44, 48, 0, 1, () => chevron(ctx, 30, 60, 12, M.gold));
    at(ctx, 68, 48, 0, 1, () => chevron(ctx, 30, 60, 12, M.gold));
  }),
  status_slow: R("physical", (ctx) => {
    chainLinks(ctx, [
      [14, 18],
      [30, 40],
      [42, 54],
    ], 12);
    part(ctx, circ(58, 64, 22), M.iron, { depth: 9, hatch: true });
    ctx.fillStyle = "rgba(255,255,255,0.45)";
    ctx.beginPath();
    ctx.ellipse(50, 54, 6, 3.5, -0.6, 0, Math.PI * 2);
    ctx.fill();
  }),
  status_regen: R("toxic", (ctx) => {
    bloom(ctx, 48, 48, 42, "#8fd25a", 0.5);
    part(ctx, rr(38, 12, 20, 72, 5), M.toxic, { depth: 6 });
    part(ctx, rr(12, 38, 72, 20, 5), M.toxic, { depth: 6 });
    sparkle(ctx, 78, 20, 6, "#e2fbb0");
  }),
  status_empower: R("fire", (ctx) => {
    aura(ctx, 48, 50, 44, "#f08a4b", 0.4);
    at(ctx, 40, 90, 0.2, 1, () => sword(ctx, 80, M.steel, M.brass));
    at(ctx, 74, 46, -Math.PI / 2, 1, () => chevron(ctx, 14, 28, 7, M.fire));
    at(ctx, 74, 30, -Math.PI / 2, 1, () => chevron(ctx, 14, 28, 7, M.fire));
  }),
  status_weaken: R("void", (ctx) => {
    at(ctx, 36, 88, 0.15, 1, () => {
      part(ctx, poly([[-5, -18], [-5, -42], [2, -46], [5, -40], [5, -18]]), M.steel, { depth: 3 });
      part(ctx, rr(-3, -18, 6, 16, 2), M.leather, { depth: 2 });
      part(ctx, rr(-14, -21, 28, 6, 2), M.iron, { depth: 1.5 });
      part(ctx, circ(0, -2, 4), M.iron, { depth: 1 });
    });
    at(ctx, 70, 22, 0.6, 1, () => part(ctx, poly([[-5, 0], [-5, -18], [0, -24], [5, -18], [5, -4], [0, 4]]), M.steel, { depth: 3 }));
    at(ctx, 68, 64, Math.PI / 2, 1, () => chevron(ctx, 14, 30, 7, M.void));
    at(ctx, 68, 80, Math.PI / 2, 1, () => chevron(ctx, 14, 30, 7, M.void));
  }),
  status_taunt: R("blood", (ctx) => {
    aura(ctx, 48, 50, 46, "#e04a3a", 0.45);
    at(ctx, 48, 54, 0, 0.95, () => helm(ctx, 1, M.iron, undefined, M.cloth));
    for (const [x1, y1, x2, y2] of [
      [12, 30, 2, 24],
      [10, 52, 0, 54],
      [84, 30, 94, 24],
      [86, 52, 96, 54],
    ] as const)
      speedLines(ctx, [[x1, y1, x2, y2]], "#ff8a6a", 3.4);
  }),
  status_evasive: R("physical", (ctx) => {
    at(ctx, 62, 74, 0, 1.25, () => wing(ctx, 1, { ...M.bone, fill: "#cfd8e6", shade: "#8a9ab4" }));
    speedLines(ctx, [
      [70, 82, 92, 82],
      [74, 70, 92, 70],
    ], M.steel.light, 2.6);
  }),
  status_lit: R("radiant", (ctx) => {
    at(ctx, 48, 90, 0, 1.15, () => lampMotif(ctx, 1));
  }),

  // ---------------- Items ----------------
  item_weapon_vanguard: R("physical", (ctx) => {
    at(ctx, 30, 90, 0.5, 1, () => warhammer(ctx, 80));
  }),
  item_weapon_gunner: R("physical", (ctx) => {
    at(ctx, 8, 82, -0.62, 1, () => rifle(ctx, 104));
  }),
  item_weapon_lamplighter: R("radiant", (ctx) => {
    at(ctx, 26, 90, 0.45, 1, () => {
      part(ctx, rr(-3.5, -70, 7, 70, 3), M.wood, { depth: 2 });
      part(ctx, rr(-3, -76, 26, 6, 3), M.brass, { depth: 2 });
      cord(ctx, (c) => {
        c.moveTo(20, -72);
        c.lineTo(20, -62);
      }, 2, M.brass.fill);
      at(ctx, 20, -16, -0.45, 0.62, () => lampMotif(ctx, 1));
    });
  }),
  item_weapon_reaver: R("blood", (ctx) => {
    at(ctx, 24, 86, 0.3, 1, () => curvedBlade(ctx, 70));
    at(ctx, 72, 86, -0.3, 1, () => {
      ctx.scale(-1, 1);
      curvedBlade(ctx, 70);
    });
  }),
  item_weapon_hexer: R("void", (ctx) => {
    bloom(ctx, 64, 32, 26, "#a87fe2", 0.7);
    at(ctx, 26, 82, 0.785, 1, () => {
      part(
        ctx,
        (c) => {
          c.moveTo(-6, -20);
          c.bezierCurveTo(-12, -34, 0, -44, -6, -58);
          c.lineTo(0, -82);
          c.lineTo(6, -58);
          c.bezierCurveTo(12, -44, 0, -34, 6, -20);
          c.closePath();
        },
        M.steel,
        { depth: 4 },
      );
      part(ctx, rr(-4, -20, 8, 20, 2), M.dark, { depth: 2 });
      part(ctx, rr(-14, -23, 28, 6, 3), M.brass, { depth: 2 });
      part(ctx, circ(0, -24, 6), M.void, { depth: 2, outline: 2.2 });
    });
  }),
  item_armor_light: R("neutral", (ctx) => {
    at(ctx, 48, 92, 0, 1.15, () => hoodedBust(ctx, 1, M.leather));
    part(ctx, rr(40, 64, 16, 6, 2), M.brass, { depth: 1, outline: 2 });
  }),
  item_armor_medium: R("physical", (ctx) => {
    part(
      ctx,
      (c) => {
        c.moveTo(20, 20);
        c.lineTo(36, 14);
        c.quadraticCurveTo(48, 24, 60, 14);
        c.lineTo(76, 20);
        c.lineTo(80, 40);
        c.lineTo(70, 46);
        c.lineTo(72, 84);
        c.quadraticCurveTo(48, 92, 24, 84);
        c.lineTo(26, 46);
        c.lineTo(16, 40);
        c.closePath();
      },
      M.leather,
      { depth: 10, hatch: true },
    );
    for (let r = 0; r < 4; r++)
      for (let k = 0; k < 4; k++) part(ctx, circ(34 + k * 9.5, 40 + r * 11, 2.2), M.brass, { outline: 1.4 });
    part(ctx, rr(26, 70, 44, 7, 2), M.dark, { depth: 1, outline: 2.2 });
    part(ctx, rr(44, 69, 8, 9, 2), M.brass, { depth: 1, outline: 2 });
  }),
  item_armor_heavy: R("physical", (ctx) => {
    at(ctx, 48, 52, 0, 1.3, () => helm(ctx, 1, M.steel, undefined, M.cloth));
  }),
  item_lamp_oil: R("radiant", (ctx) => {
    part(ctx, rr(22, 34, 46, 52, 6), M.brass, { depth: 10, hatch: true });
    part(ctx, rr(22, 50, 46, 14, 2), M.cloth, { depth: 3, outline: 2.2 });
    part(ctx, poly([[58, 36], [80, 18], [84, 22], [66, 42]]), M.brass, { depth: 2, outline: 2.4 });
    part(ctx, rr(32, 26, 16, 10, 3), M.iron, { depth: 2, outline: 2.4 });
    cord(ctx, (c) => {
      c.moveTo(30, 34);
      c.quadraticCurveTo(45, 14, 60, 34);
    }, 3, M.iron.fill);
    at(ctx, 84, 34, 0, 1, () => liquidDrop(ctx, 5, M.gold));
  }),
  item_lamp_arc: R("crystal", (ctx) => {
    bloom(ctx, 48, 40, 40, "#6fe0d7", 0.6);
    part(ctx, circ(48, 40, 26), { ...M.crystal, fill: "#5fc8c4", shade: "#2a8a90", deep: "#17697a" }, { depth: 7, sheen: 1.4 });
    line(ctx, [
      [36, 52],
      [42, 32],
      [48, 46],
      [54, 30],
      [60, 52],
    ], 3.4, "#e8fffa");
    part(ctx, rr(36, 64, 24, 8, 2), M.iron, { depth: 2, outline: 2.4 });
    part(ctx, rr(38, 72, 20, 8, 2), M.brass, { depth: 2, outline: 2.4 });
    part(ctx, rr(42, 80, 12, 6, 2), M.iron, { depth: 1, outline: 2.2 });
    sparkle(ctx, 18, 24, 6, "#c8fff3");
    sparkle(ctx, 80, 22, 5, "#c8fff3");
  }),
  item_lamp_shroud: R("void", (ctx) => {
    at(ctx, 48, 92, 0, 1.1, () => lampMotif(ctx, 1, M.void, M.iron));
    part(
      ctx,
      (c) => {
        c.moveTo(48, 20);
        c.bezierCurveTo(30, 26, 26, 60, 18, 86);
        c.lineTo(34, 80);
        c.lineTo(40, 88);
        c.bezierCurveTo(40, 60, 44, 34, 48, 20);
        c.closePath();
      },
      { ...M.void, fill: "#4b2380", shade: "#2c1149", deep: "#14081f" },
      { depth: 5, hatch: true },
    );
  }),
  item_trinket_ring: R("radiant", (ctx) => {
    part(ctx, ring(48, 56, 18, 28), M.gold, { depth: 6 });
    at(ctx, 48, 28, 0, 1, () => {
      part(ctx, rr(-10, -2, 20, 10, 3), M.gold, { depth: 2, outline: 2.4 });
      bloom(ctx, 0, -6, 16, "#e04a3a", 0.6);
      part(ctx, poly([[-10, -6], [0, -18], [10, -6], [0, 4]]), M.blood, { depth: 3, outline: 2.4 });
    });
  }),
  item_trinket_charm: R("neutral", (ctx) => {
    cord(ctx, (c) => {
      c.moveTo(18, 14);
      c.quadraticCurveTo(48, 54, 78, 14);
    }, 2.6, M.leather.fill);
    at(ctx, 48, 62, 0, 1, () => {
      part(ctx, circ(0, 0, 22), M.brass, { depth: 6, hatch: true });
      eye(ctx, 26, M.crystal);
    });
  }),
  item_trinket_chip: R("crystal", (ctx) => {
    for (let i = 0; i < 5; i++) {
      for (const sd of [-1, 1]) {
        part(ctx, rr(48 + sd * 30 - 5, 26 + i * 11, 10, 4, 1), M.gold, { outline: 1.6 });
        part(ctx, rr(26 + i * 11, 48 + sd * 30 - 5, 4, 10, 1), M.gold, { outline: 1.6 });
      }
    }
    part(ctx, rr(22, 22, 52, 52, 5), { ...M.dark, fill: "#1f3a3a", shade: "#13262a", light: "#2f5a5a" }, { depth: 8 });
    line(ctx, [
      [30, 34],
      [42, 34],
      [48, 42],
    ], 2.4, "#6fe0d7");
    line(ctx, [
      [66, 62],
      [54, 62],
      [48, 54],
    ], 2.4, "#6fe0d7");
    bloom(ctx, 48, 48, 14, "#6fe0d7", 0.7);
    part(ctx, rr(40, 40, 16, 16, 2), M.crystal, { depth: 3, outline: 2.2 });
  }),
  item_trinket_vial: R("blood", (ctx) => {
    at(ctx, 48, 88, 0, 1.25, () => flask(ctx, 1, M.blood, false));
  }),
  item_trinket_shard: R("crystal", (ctx) => {
    bloom(ctx, 48, 48, 40, "#6fe0d7", 0.5);
    at(ctx, 52, 88, 0.2, 1, () => shard(ctx, 80, 26));
    at(ctx, 30, 86, -0.5, 1, () => shard(ctx, 34, 12));
  }),
  item_trinket_coin: R("radiant", (ctx) => {
    at(ctx, 56, 56, 0, 1, () => coin(ctx, 26, M.brass));
    at(ctx, 40, 42, 0, 1, () => coin(ctx, 26));
  }),
  item_trinket_fang: R("neutral", (ctx) => {
    cord(ctx, (c) => {
      c.moveTo(14, 14);
      c.quadraticCurveTo(48, 50, 82, 14);
    }, 2.6, M.leather.fill);
    part(ctx, rr(40, 30, 16, 10, 3), M.brass, { depth: 2, outline: 2.4 });
    part(
      ctx,
      (c) => {
        c.moveTo(38, 40);
        c.quadraticCurveTo(36, 68, 54, 90);
        c.quadraticCurveTo(60, 64, 58, 40);
        c.closePath();
      },
      M.bone,
      { depth: 6, hatch: true },
    );
  }),

  // ---------------- Map nodes ----------------
  node_combat: R("physical", (ctx) => {
    at(ctx, 20, 84, 0.785, 1, () => sword(ctx, 84));
    at(ctx, 76, 84, -0.785, 1, () => sword(ctx, 84));
  }),
  node_elite: R("blood", (ctx) => {
    aura(ctx, 48, 50, 46, "#e04a3a", 0.4);
    at(ctx, 48, 54, 0, 1.1, () => skull(ctx, 1, M.bone, "#e04a3a", M.dark));
    for (const sd of [-1, 1]) bloom(ctx, 48 + sd * 10, 56, 8, "#ff6a4a", 0.9);
  }),
  node_boss: R("fire", (ctx) => {
    aura(ctx, 48, 52, 48, "#f08a4b", 0.55);
    at(ctx, 48, 60, 0, 1.05, () => skull(ctx, 1, M.bone, "#ff6a2a", M.dark));
    at(ctx, 48, 32, 0, 0.62, () => crown(ctx, 1));
    for (const sd of [-1, 1]) bloom(ctx, 48 + sd * 9.5, 62, 9, "#ffb050", 0.95);
  }),
  node_cache: R("radiant", (ctx) => {
    bloom(ctx, 48, 40, 34, "#ffd36e", 0.45);
    at(ctx, 48, 82, 0, 1.15, () => chest(ctx, 1));
  }),
  node_vein: R("crystal", (ctx) => {
    bloom(ctx, 48, 44, 40, "#6fe0d7", 0.45);
    at(ctx, 48, 56, 0, 1.4, () => oreChunk(ctx, 1));
  }),
  node_camp: R("fire", (ctx) => {
    at(ctx, 48, 82, 0, 1.15, () => campfire(ctx, 1));
  }),
  node_start: R("radiant", (ctx) => {
    aura(ctx, 50, 36, 40, "#ffd36e", 0.4);
    at(ctx, 30, 90, 0, 1, () => banner(ctx, 1, { ...M.leather, fill: "#c7711c", shade: "#7a3d12", deep: "#3b1f0e", light: "#f2a93b" }));
    at(ctx, 52, 52, 0, 0.32, () => lampMotif(ctx, 1, M.gold, M.iron));
  }),
  node_derelict: R("neutral", (ctx) => {
    at(ctx, 58, 64, 0.3, 1, () => gear(ctx, 20, RUST_IRON));
    at(ctx, 40, 90, 0, 1.2, () => ruinTower(ctx, 1));
  }),

  // ---------------- Stats / UI ----------------
  stat_hp: R("blood", (ctx) => {
    at(ctx, 48, 50, 0, 1, () => heart(ctx, 76, M.blood));
    ctx.fillStyle = "rgba(255,255,255,0.5)";
    ctx.beginPath();
    ctx.ellipse(30, 36, 7, 4, -0.7, 0, Math.PI * 2);
    ctx.fill();
  }),
  stat_speed: R("physical", (ctx) => {
    at(ctx, 36, 50, 0, 0.95, () => wing(ctx, 1, { ...M.bone, fill: "#cfd8e6", shade: "#8a9ab4" }));
    at(ctx, 52, 86, 0, 1.1, () => boot(ctx, 1));
  }),
  stat_crit: R("blood", (ctx) => {
    bloom(ctx, 48, 48, 40, "#ff6a4a", 0.5);
    part(ctx, star(48, 48, 12, 42, 8, -Math.PI / 2 + 0.2), M.blood, { depth: 7 });
    part(ctx, star(48, 48, 6, 20, 4), M.gold, { depth: 3, outline: 2.4 });
  }),
  stat_dodge: R("physical", (ctx) => {
    at(ctx, 38, 86, 0.35, 1, () => feather(ctx, 76, { ...M.bone, fill: "#cfd8e6", shade: "#8a9ab4" }));
    speedLines(ctx, [
      [64, 30, 88, 30],
      [68, 46, 90, 46],
    ], M.steel.light, 2.6);
  }),
  stat_prot: R("physical", (ctx) => {
    at(ctx, 48, 50, 0, 1, () => roundShield(ctx, 36));
  }),
  stat_acc: R("physical", (ctx) => {
    at(ctx, 48, 48, 0, 1.15, () => reticle(ctx, 28, M.steel.light));
  }),
  stat_dmg: R("physical", (ctx) => {
    at(ctx, 24, 82, 0.785, 1, () => sword(ctx, 86));
    rays(ctx, 74, 24, 4, 16, 8, M.gold, 0.24);
  }),
  ui_lamp: R("radiant", (ctx) => {
    at(ctx, 48, 90, 0, 1.2, () => lampMotif(ctx, 1));
  }),
  ui_ore: R("crystal", (ctx) => {
    at(ctx, 48, 52, 0, 1.35, () => oreChunk(ctx, 1));
  }),
  ui_xp: R("radiant", (ctx) => {
    bloom(ctx, 48, 48, 40, "#ffd36e", 0.55);
    part(ctx, star(48, 48, 13, 40, 4), M.gold, { depth: 7 });
    part(ctx, star(48, 48, 5, 14, 4, 0), M.white, { depth: 2, outline: 2 });
  }),
  ui_perk: R("void", (ctx) => {
    bloom(ctx, 48, 48, 40, "#a87fe2", 0.45);
    part(ctx, poly([[48, 8], [84, 48], [48, 88], [12, 48]]), M.void, { depth: 10, hatch: true });
    part(ctx, poly([[48, 22], [70, 48], [48, 74], [26, 48]]), M.dark, { depth: 3, outline: 2.4 });
    line(ctx, [
      [48, 32],
      [48, 64],
    ], 3.2, M.gold.fill);
    line(ctx, [
      [38, 42],
      [48, 50],
      [58, 42],
    ], 3.2, M.gold.fill);
  }),
  ui_cooldown: R("neutral", (ctx) => {
    part(ctx, circ(48, 50, 36), M.iron, { depth: 8 });
    part(ctx, circ(48, 50, 29), M.bone, { depth: 6, outline: 2.4 });
    ctx.save();
    ctx.fillStyle = withAlpha(M.void.shade, 0.75);
    ctx.beginPath();
    ctx.moveTo(48, 50);
    ctx.arc(48, 50, 29, -Math.PI / 2, Math.PI * 0.75);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
    line(ctx, [
      [48, 50],
      [48, 28],
    ], 4);
    line(ctx, [
      [48, 50],
      [62, 58],
    ], 4);
    part(ctx, circ(48, 50, 4), M.brass, { outline: 2 });
    part(ctx, rr(42, 8, 12, 8, 2), M.brass, { depth: 2, outline: 2.4 });
  }),
  ui_lock: R("neutral", (ctx) => {
    at(ctx, 48, 50, 0, 1.3, () => padlock(ctx, 1));
  }),
  ui_crown: R("radiant", (ctx) => {
    at(ctx, 48, 72, 0, 1.15, () => crown(ctx, 1));
  }),
  ui_player: R("radiant", (ctx) => {
    aura(ctx, 48, 46, 40, "#f2a93b", 0.35);
    at(ctx, 48, 94, 0, 1.15, () => hoodedBust(ctx, 1, M.leather, "#ffd36e"));
  }),

  // ---------------- Elements ----------------
  elem_physical: R("physical", (ctx) => {
    part(ctx, star(48, 48, 16, 42, 8), M.bone, { depth: 9, hatch: true });
    part(ctx, star(48, 48, 7, 18, 4, -Math.PI / 4), M.steel, { depth: 3, outline: 2.4 });
  }),
  elem_radiant: R("radiant", (ctx) => {
    bloom(ctx, 48, 48, 44, "#ffd36e", 0.6);
    rays(ctx, 48, 48, 22, 44, 12, M.gold, 0.14);
    part(ctx, circ(48, 48, 22), M.gold, { depth: 7 });
    part(ctx, circ(44, 44, 9), M.white, { depth: 2, outline: 0 });
  }),
  elem_void: R("void", (ctx) => {
    at(ctx, 48, 48, 0, 1, () => vortex(ctx, 40, M.void));
    at(ctx, 48, 48, 0, 1, () => eye(ctx, 30, M.void, M.dark, true));
  }),
  elem_fire: R("fire", (ctx) => {
    at(ctx, 48, 90, 0, 1, () => flame(ctx, 66, 82));
  }),
  elem_toxic: R("toxic", (ctx) => {
    bloom(ctx, 48, 52, 40, "#8fd25a", 0.4);
    for (let i = 0; i < 3; i++) {
      const a = -Math.PI / 2 + (i * Math.PI * 2) / 3;
      at(ctx, 48 + Math.cos(a) * 20, 58 + Math.sin(a) * 20, 0, 1, () => liquidDrop(ctx, 13, M.toxic));
    }
    part(ctx, circ(48, 50, 6), M.dark, { outline: 2 });
  }),

  // ---------------- Disciplines ----------------
  disc_vanguard: R("physical", (ctx) => {
    at(ctx, 48, 50, 0, 1.4, () => heaterShield(ctx, 52, 64));
    at(ctx, 48, 50, 0, 1, () => {
      part(ctx, rr(-14, -20, 28, 30, 2), M.rock, { depth: 4, outline: 2.4 });
      for (let k = -1; k <= 1; k++) part(ctx, rr(k * 10 - 4, -26, 8, 8, 1), M.rock, { depth: 1, outline: 2.2 });
      part(ctx, rr(-4, -6, 8, 16, 4), M.dark, { outline: 2 });
    });
  }),
  disc_gunner: R("physical", (ctx) => {
    at(ctx, 10, 80, -0.6, 0.9, () => rifle(ctx, 100));
    at(ctx, 86, 80, 0.6, 0.9, () => {
      ctx.scale(-1, 1);
      rifle(ctx, 100);
    });
    at(ctx, 48, 40, 0, 0.62, () => reticle(ctx, 26, "#f5866a"));
  }),
  disc_lamplighter: R("radiant", (ctx) => {
    aura(ctx, 48, 50, 46, "#ffd36e", 0.45);
    rays(ctx, 48, 52, 24, 44, 12, M.gold, 0.12, 0, 1.8);
    at(ctx, 48, 86, 0, 1.05, () => lampMotif(ctx, 1));
  }),
  disc_reaver: R("blood", (ctx) => {
    at(ctx, 28, 88, 0.55, 1.05, () => curvedBlade(ctx, 74));
    at(ctx, 68, 88, -0.55, 1.05, () => {
      ctx.scale(-1, 1);
      curvedBlade(ctx, 74);
    });
    at(ctx, 48, 34, 0, 1, () => liquidDrop(ctx, 9, M.blood));
  }),
  disc_hexer: R("void", (ctx) => {
    aura(ctx, 48, 52, 46, "#a87fe2", 0.5);
    part(ctx, poly([[48, 8], [88, 80], [8, 80]]), M.void, { depth: 9, hatch: true });
    part(ctx, poly([[48, 24], [74, 72], [22, 72]]), M.dark, { depth: 3, outline: 2.4 });
    at(ctx, 48, 56, 0, 1, () => eye(ctx, 32, M.void, M.bone, true));
  }),
};


// ---------------------------------------------------------------------------
// Render pipeline
// ---------------------------------------------------------------------------

const cache = new Map<string, HTMLCanvasElement>();

function renderMotif(id: IconId, size: number): HTMLCanvasElement {
  const c = canvas(size, size);
  const ctx = ctx2d(c);
  ctx.scale(size / 96, size / 96);
  setInkWeight(size < 64 ? 1.25 : 1);
  try {
    RECIPES[id].draw(ctx);
  } finally {
    setInkWeight(1);
  }
  return c;
}

/**
 * Outer ink silhouette + drop shadow under the motif: dilate the motif's solid pixels
 * (alpha ≥ ~0.88, so soft glows are ignored) by ~2 render px and tint them INK.
 */
function withSilhouette(motif: HTMLCanvasElement, size: number): HTMLCanvasElement {
  const ctx = ctx2d(motif);
  const img = ctx.getImageData(0, 0, size, size);
  const src = img.data;
  const n = size * size;
  const solid = new Float32Array(n);
  for (let i = 0; i < n; i++) solid[i] = Math.min(1, Math.max(0, ((src[i * 4 + 3] as number) - 225) / 25));
  const rad = size >= 64 ? 2.2 : 1.4;
  const offs: [number, number, number][] = [];
  const R = Math.ceil(rad);
  for (let dy = -R; dy <= R; dy++)
    for (let dx = -R; dx <= R; dx++) {
      const d = Math.hypot(dx, dy);
      if (d <= rad + 0.5) offs.push([dx, dy, Math.min(1, rad + 0.5 - d)]);
    }
  const out = new Float32Array(n);
  for (let y = 0; y < size; y++)
    for (let x = 0; x < size; x++) {
      let m = 0;
      for (const [dx, dy, w] of offs) {
        const xx = x + dx;
        const yy = y + dy;
        if (xx < 0 || yy < 0 || xx >= size || yy >= size) continue;
        const v = (solid[yy * size + xx] as number) * w;
        if (v > m) m = v;
      }
      out[y * size + x] = m;
    }
  const res = canvas(size, size);
  const rctx = ctx2d(res);
  const oimg = rctx.createImageData(size, size);
  const od = oimg.data;
  const shadowDy = Math.max(1, Math.round(size / 40));
  for (let y = 0; y < size; y++)
    for (let x = 0; x < size; x++) {
      const i = y * size + x;
      const o = out[i] as number;
      const sy = y - shadowDy;
      const s = sy >= 0 ? (out[sy * size + x] as number) * 0.5 : 0;
      const a = o + s * (1 - o);
      od[i * 4] = 8;
      od[i * 4 + 1] = 5;
      od[i * 4 + 2] = 12;
      od[i * 4 + 3] = Math.round(a * 255);
    }
  rctx.putImageData(oimg, 0, 0);
  rctx.drawImage(motif, 0, 0);
  return res;
}

/** Transparent-background HD icon, memoized per (id, size). */
export function drawIconHD(id: IconId, size = 96): HTMLCanvasElement {
  const s = Math.max(8, Math.round(size));
  const key = `${id}@${s}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const c = withSilhouette(renderMotif(id, s), s);
  cache.set(key, c);
  return c;
}

/** The icon's element tint (for frames, tooltips, glows). */
export function iconElementColor(id: IconId): string {
  return ELEM_GLOW[RECIPES[id].e];
}

const framedCache = new Map<string, HTMLCanvasElement>();

/** Skill icon on a framed backing: dark recessed plate, element-tinted glow, iron & brass bevel. */
export function drawSkillIconHD(id: IconId, size = 96): HTMLCanvasElement {
  const s = Math.max(16, Math.round(size));
  const key = `${id}@${s}`;
  const hit = framedCache.get(key);
  if (hit) return hit;
  const c = canvas(s, s);
  const ctx = ctx2d(c);
  const k = s / 96;
  const col = ELEM_GLOW[RECIPES[id].e];
  ctx.save();
  ctx.scale(k, k);
  // outer iron frame
  const frame = ctx.createLinearGradient(0, 0, 0, 96);
  frame.addColorStop(0, "#4a5266");
  frame.addColorStop(0.5, "#2a2f3c");
  frame.addColorStop(1, "#14161e");
  ctx.fillStyle = INK_COLOR;
  ctx.beginPath();
  ctx.roundRect(0, 0, 96, 96, 12);
  ctx.fill();
  ctx.fillStyle = frame;
  ctx.beginPath();
  ctx.roundRect(2, 2, 92, 92, 10);
  ctx.fill();
  // brass inner rim
  ctx.strokeStyle = "#a8601c";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.roundRect(7, 7, 82, 82, 7);
  ctx.stroke();
  // recessed plate with element tint
  const plate = ctx.createRadialGradient(48, 42, 4, 48, 52, 56);
  plate.addColorStop(0, withAlpha(col, 0.42));
  plate.addColorStop(0.55, "rgba(20,16,30,0.95)");
  plate.addColorStop(1, "#07060b");
  ctx.fillStyle = "#0a0810";
  ctx.beginPath();
  ctx.roundRect(9, 9, 78, 78, 6);
  ctx.fill();
  ctx.fillStyle = plate;
  ctx.fill();
  // inner shadow on the top edge
  const ish = ctx.createLinearGradient(0, 9, 0, 22);
  ish.addColorStop(0, "rgba(0,0,0,0.6)");
  ish.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = ish;
  ctx.fillRect(9, 9, 78, 13);
  // bevel highlight
  ctx.strokeStyle = "rgba(255,230,180,0.18)";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(4, 88);
  ctx.lineTo(4, 10);
  ctx.quadraticCurveTo(4, 4, 10, 4);
  ctx.lineTo(88, 4);
  ctx.stroke();
  ctx.restore();
  const inner = Math.round(s * 0.86);
  const off = Math.round((s - inner) / 2);
  ctx.save();
  ctx.beginPath();
  ctx.roundRect(9 * k, 9 * k, 78 * k, 78 * k, 6 * k);
  ctx.clip();
  ctx.drawImage(drawIconHD(id, inner), off, off);
  ctx.restore();
  framedCache.set(key, c);
  return c;
}

export const ICON_HD_DEFAULT_SIZE = 96;
