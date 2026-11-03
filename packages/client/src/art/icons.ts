/**
 * 16x16 pixel icons for skills, statuses, items, map nodes, stats and UI.
 *
 * Icons are authored on a 16x16 CHARACTER grid (text sprites and procedural ops), then
 * rendered: UPPERCASE letters are *materials* that are auto-shaded with a consistent
 * upper-left key light (highlight / light / mid / shadow); lowercase letters are fixed
 * palette colors. Everything opaque gets a 1px INK outline. A second "fx" grid is drawn
 * after the outline (glows, rays, sparks) so light effects stay soft and un-inked.
 */
import { INK, RAMPS } from "./palette";
import { Pix } from "./pixel";

export const ICON_IDS = [
  // vanguard
  "skill_shieldBash",
  "skill_bulwark",
  "skill_provoke",
  "skill_seismicSlam",
  "skill_grappleChain",
  "skill_rallyCry",
  // gunner
  "skill_aimedShot",
  "skill_suppressingFire",
  "skill_flareRound",
  "skill_piercingRound",
  "skill_pointBlank",
  "skill_quickReload",
  // lamplighter
  "skill_kindleWounds",
  "skill_radiantLash",
  "skill_beacon",
  "skill_purge",
  "skill_blindingFlash",
  "skill_warmth",
  // reaver
  "skill_rend",
  "skill_lunge",
  "skill_flurry",
  "skill_execute",
  "skill_shadowstep",
  "skill_hamstring",
  // hexer
  "skill_voidBolt",
  "skill_hexOfFrailty",
  "skill_siphon",
  "skill_umbralTide",
  "skill_snuffLight",
  "skill_rotCurse",
  // common
  "skill_move",
  "skill_wait",
  // enemy
  "skill_enemyMelee",
  "skill_enemyRanged",
  "skill_enemyBuff",
  "skill_enemyDebuff",
  "skill_enemyHeal",
  // statuses
  "status_bleed",
  "status_burn",
  "status_toxic",
  "status_stun",
  "status_mark",
  "status_guard",
  "status_shield",
  "status_blind",
  "status_corrode",
  "status_haste",
  "status_slow",
  "status_regen",
  "status_empower",
  "status_weaken",
  "status_taunt",
  "status_evasive",
  "status_lit",
  // items
  "item_weapon_vanguard",
  "item_weapon_gunner",
  "item_weapon_lamplighter",
  "item_weapon_reaver",
  "item_weapon_hexer",
  "item_armor_light",
  "item_armor_medium",
  "item_armor_heavy",
  "item_lamp_oil",
  "item_lamp_arc",
  "item_lamp_shroud",
  "item_trinket_ring",
  "item_trinket_charm",
  "item_trinket_chip",
  "item_trinket_vial",
  "item_trinket_shard",
  "item_trinket_coin",
  "item_trinket_fang",
  // map nodes
  "node_combat",
  "node_elite",
  "node_boss",
  "node_cache",
  "node_vein",
  "node_camp",
  "node_start",
  "node_derelict",
  // stats / ui
  "stat_hp",
  "stat_speed",
  "stat_crit",
  "stat_dodge",
  "stat_prot",
  "stat_acc",
  "stat_dmg",
  "ui_lamp",
  "ui_ore",
  "ui_xp",
  "ui_perk",
  "ui_cooldown",
  "ui_lock",
  "ui_crown",
  "ui_player",
  // elements
  "elem_physical",
  "elem_radiant",
  "elem_void",
  "elem_fire",
  "elem_toxic",
  // discipline emblems
  "disc_vanguard",
  "disc_gunner",
  "disc_lamplighter",
  "disc_reaver",
  "disc_hexer",
] as const;

export type IconId = (typeof ICON_IDS)[number];

const S = 16;
const { steel, lamp, rust, toxic, umbra, crystal, leather, bone, rock } = RAMPS;

/** Auto-shaded materials: [shadow, mid, light, highlight]. */
const MAT: Record<string, readonly [string, string, string, string]> = {
  S: [steel[2], steel[3], steel[4], steel[5]], // steel
  D: [steel[1], steel[2], steel[3], steel[4]], // dark steel
  G: [lamp[2], lamp[3], lamp[4], lamp[5]], // gold / lamp light
  A: [lamp[1], lamp[2], lamp[3], lamp[4]], // brass
  R: [rust[1], rust[2], rust[3], rust[4]], // blood / red
  F: [rust[3], rust[4], lamp[3], lamp[4]], // fire
  T: [toxic[2], toxic[3], toxic[4], toxic[5]], // toxic green
  U: [umbra[1], umbra[2], umbra[3], umbra[4]], // void purple
  P: [umbra[3], umbra[4], umbra[5], "#f6efff"], // pale void glow
  C: [crystal[2], crystal[3], crystal[4], crystal[5]], // crystal / cyan
  W: [leather[1], leather[2], leather[3], leather[4]], // wood
  L: [leather[2], leather[3], leather[4], leather[5]], // leather
  B: [bone[2], bone[3], bone[4], bone[5]], // bone / pale
  K: [rock[2], rock[3], rock[4], rock[5]], // rock
};

/** Fixed (unshaded) colors. */
const FIX: Record<string, string> = {
  k: INK,
  w: lamp[5],
  y: lamp[4],
  o: lamp[3],
  a: lamp[2],
  x: bone[5],
  b: bone[3],
  s: steel[5],
  m: steel[3],
  d: steel[1],
  r: rust[3],
  e: rust[4],
  q: rust[2],
  g: toxic[3],
  t: toxic[4],
  h: toxic[5],
  u: umbra[3],
  v: umbra[4],
  p: umbra[5],
  n: umbra[1],
  c: crystal[4],
  z: crystal[5],
  i: crystal[3],
  l: leather[3],
  j: leather[1],
};

type Pt = readonly [number, number];

/** A 16x16 character canvas with a few drawing ops. "." = empty. */
class G {
  readonly c: string[] = new Array<string>(S * S).fill(".");
  /** Soft light glows applied last: [x, y, radius, color, strength]. */
  readonly glows: [number, number, number, string, number][] = [];

  glow(x: number, y: number, r: number, color: string, strength = 0.45): this {
    this.glows.push([x, y, r, color, strength]);
    return this;
  }

  set(x: number, y: number, ch: string): this {
    const xi = Math.round(x);
    const yi = Math.round(y);
    if (ch === "." || xi < 0 || yi < 0 || xi >= S || yi >= S) return this;
    this.c[yi * S + xi] = ch;
    return this;
  }

  get(x: number, y: number): string {
    if (x < 0 || y < 0 || x >= S || y >= S) return ".";
    return this.c[y * S + x] ?? ".";
  }

  clear(x: number, y: number): this {
    if (x >= 0 && y >= 0 && x < S && y < S) this.c[y * S + x] = ".";
    return this;
  }

  /** Place a text sprite. Rows separated by newlines; centered unless ox/oy given. */
  t(text: string, ox?: number, oy?: number, map?: Record<string, string>): this {
    const rows = text
      .split("\n")
      .map((r) => r.trim())
      .filter((r) => r.length > 0);
    const w = Math.max(...rows.map((r) => r.length));
    const x0 = ox ?? Math.floor((S - w) / 2);
    const y0 = oy ?? Math.floor((S - rows.length) / 2);
    rows.forEach((row, y) => {
      for (let x = 0; x < row.length; x++) {
        const ch = row[x] ?? ".";
        this.set(x0 + x, y0 + y, map?.[ch] ?? ch);
      }
    });
    return this;
  }

  rect(x: number, y: number, w: number, h: number, ch: string): this {
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) this.set(x + i, y + j, ch);
    return this;
  }

  line(x0: number, y0: number, x1: number, y1: number, ch: string): this {
    let x = Math.round(x0);
    let y = Math.round(y0);
    const ex = Math.round(x1);
    const ey = Math.round(y1);
    const dx = Math.abs(ex - x);
    const dy = -Math.abs(ey - y);
    const sx = x < ex ? 1 : -1;
    const sy = y < ey ? 1 : -1;
    let err = dx + dy;
    for (;;) {
      this.set(x, y, ch);
      if (x === ex && y === ey) break;
      const e2 = 2 * err;
      if (e2 >= dy) {
        err += dy;
        x += sx;
      }
      if (e2 <= dx) {
        err += dx;
        y += sy;
      }
    }
    return this;
  }

  /** Disc; cx/cy may be .5 for even-sized discs. */
  disc(cx: number, cy: number, r: number, ch: string): this {
    for (let y = 0; y < S; y++) {
      for (let x = 0; x < S; x++) {
        const dx = x - cx;
        const dy = y - cy;
        if (dx * dx + dy * dy <= r * r + r * 0.6) this.set(x, y, ch);
      }
    }
    return this;
  }

  ring(cx: number, cy: number, r: number, ch: string, th = 1): this {
    for (let y = 0; y < S; y++) {
      for (let x = 0; x < S; x++) {
        const dx = x - cx;
        const dy = y - cy;
        const d2 = dx * dx + dy * dy;
        const ro = r * r + r * 0.6;
        const ri = (r - th) * (r - th) + (r - th) * 0.6;
        if (d2 <= ro && d2 > ri) this.set(x, y, ch);
      }
    }
    return this;
  }

  poly(points: readonly Pt[], ch: string): this {
    for (let y = 0; y < S; y++) {
      const yc = y + 0.5;
      const xs: number[] = [];
      for (let i = 0; i < points.length; i++) {
        const a = points[i] as Pt;
        const b = points[(i + 1) % points.length] as Pt;
        if ((a[1] <= yc && b[1] > yc) || (b[1] <= yc && a[1] > yc)) {
          xs.push(a[0] + ((yc - a[1]) / (b[1] - a[1])) * (b[0] - a[0]));
        }
      }
      xs.sort((p, q) => p - q);
      for (let i = 0; i + 1 < xs.length; i += 2) {
        const xa = Math.round(xs[i] as number);
        const xb = Math.round(xs[i + 1] as number) - 1;
        for (let x = xa; x <= xb; x++) this.set(x, y, ch);
      }
    }
    return this;
  }

  /** Replace every occurrence of a char. */
  swap(from: string, to: string): this {
    for (let i = 0; i < this.c.length; i++) if (this.c[i] === from) this.c[i] = to;
    return this;
  }
}

function render(g: G, fx: G, fxAlpha: number): HTMLCanvasElement {
  const p = new Pix(S, S);
  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      const ch = g.get(x, y);
      if (ch === ".") continue;
      const m = MAT[ch];
      if (m) {
        const up = g.get(x, y - 1) === ch;
        const left = g.get(x - 1, y) === ch;
        const down = g.get(x, y + 1) === ch;
        const right = g.get(x + 1, y) === ch;
        let tone = 1;
        if (!up && !left) tone = 3;
        else if (!up || !left) tone = 2;
        else if (!down || !right) tone = 0;
        p.px(x, y, m[tone as 0 | 1 | 2 | 3]);
      } else {
        const f = FIX[ch];
        if (f) p.px(x, y, f);
      }
    }
  }
  p.outline(INK);
  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      const ch = fx.get(x, y);
      if (ch === ".") continue;
      // Uppercase fx = full strength, lowercase = translucent glow.
      const lower = ch.toLowerCase();
      const col = MAT[ch]?.[2] ?? FIX[ch] ?? FIX[lower];
      if (col) p.px(x, y, col, ch !== lower ? 1 : fxAlpha);
    }
  }
  for (const [x, y, r, c, s] of [...g.glows, ...fx.glows]) p.glow(x, y, r, c, s);
  return p.canvas;
}

type Def = (g: G, fx: G) => number | undefined;

// ---------------------------------------------------------------------------------------
// Shared motifs
// ---------------------------------------------------------------------------------------

const SKULL = `
...BBBBB...
.BBBBBBBBB.
BBBBBBBBBBB
BBBBBBBBBBB
BkkkBBBkkkB
BkkkBBBkkkB
BBBBBkBBBBB
.BBBBBBBBB.
..BkBkBkB..
...BBBBB...
`;

const FLAME = `
.....F.....
.....FF....
....FFF..F.
....FFFF.F.
...FFFFFFF.
..FFFFyFFF.
..FFFyyFFFF
.FFFyywyFFF
.FFyywwyFFF
.FFywwwwyF.
..FywwwwyF.
...FFFFFF..
`;

const LANTERN = `
...kk...
..A..A..
...AA...
.AAAAAA.
.DAAAAD.
.AywwyA.
.AywwyA.
.AyyyyA.
.AyooyA.
.AAAAAA.
DAAAAAAD
`;

/** Diagonal sword, tip top-left, hilt bottom-right. flip mirrors horizontally. */
function sword(g: G, flip: boolean, len = 8, blade = "S", grip = "W", guard = "A") {
  const X = (x: number) => (flip ? 15 - x : x);
  for (let i = 0; i < len; i++) {
    g.set(X(2 + i), 2 + i, blade);
    g.set(X(3 + i), 2 + i, blade);
  }
  g.set(X(2), 2, "x");
  const e = 2 + len; // blade end
  g.line(X(e - 3), e + 1, X(e + 1), e - 3, guard);
  g.line(X(e), e, X(e + 2), e + 2, grip);
  g.set(X(e + 3), e + 3, guard);
}

/** Small 8-ray light burst into fx grid. */
function rays(fx: G, cx: number, cy: number, r0: number, r1: number, ch = "y", diag = true) {
  const dirs: Pt[] = [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
  ];
  if (diag) dirs.push([1, 1], [-1, 1], [1, -1], [-1, -1]);
  for (const [dx, dy] of dirs) {
    const k = dx !== 0 && dy !== 0 ? 0.75 : 1;
    for (let r = r0; r <= r1 * k; r++) fx.set(cx + dx * r, cy + dy * r, ch);
  }
}

/** Soft light glow around a point (drawn last, un-inked). */
function halo(fx: G, cx: number, cy: number, r: number, ch = "o") {
  fx.glow(cx, cy, r + 1, FIX[ch] ?? lamp[3], 0.42);
}

/** Hex badge frame for discipline emblems. */
function badge(g: G, rim = "A", fill = "d") {
  const outer: Pt[] = [
    [8, 1],
    [14, 4],
    [14, 12],
    [8, 15],
    [2, 12],
    [2, 4],
  ];
  const inner: Pt[] = [
    [8, 2.5],
    [13, 5],
    [13, 11],
    [8, 13.5],
    [3, 11],
    [3, 5],
  ];
  g.poly(outer, rim);
  g.poly(inner, fill);
}

// ---------------------------------------------------------------------------------------
// Icon definitions
// ---------------------------------------------------------------------------------------

const DEFS: Record<IconId, Def> = {
  // ---------------- Vanguard (physical steel; rally = radiant gold) ----------------
  skill_shieldBash: (g, fx) => {
    g.t(`
......SSSSS..
.....SSSSSSS.
bb..SSSDDDSSS
...SSSDGGGDSS
bbb.SSDGwGDSS
...SSSDGGGDSS
.bb.SSSDDDSSS
.....SSSSSSS.
......SSSSS..
`);
    fx.set(14, 3, "y").set(14, 9, "y").set(15, 6, "y");
  },
  skill_bulwark: (g) => {
    g.t(`
AAAAAAAAAAA
ASSSSGSSSSA
ASSSSGSSSSA
AGGGGGGGGGA
ASSSSGSSSSA
ASSSSGSSSSA
ASSSSGSSSSA
.ASSSGSSSA.
.ASSSGSSSA.
..ASSGSSA..
...AAGAA...
....AAA....
`);
  },
  skill_provoke: (g) => {
    g.t(`
...SSS....RR
.SSSSSSS..RR
SSSSSSSSS.RR
SSSSSSSSS.RR
SkeekeekS.RR
SSSSkSSSS...
SSSSkSSSS.RR
.SSSkSSS..RR
..SSSSS.....
`);
  },
  skill_seismicSlam: (g, fx) => {
    g.t(
      `
.....WW......
.....WW......
.....WW......
.....WW......
..SSSSSSSSS..
..SSSSSSSSS..
..SSSSSSSSS..
LLDDDDDDDDDLL
LLLLLLLLLLLLL
LLLLkLLLLkLLL
.LLk.kLLk.kL.
`,
      undefined,
      2,
    );
    fx.t("y...........y\n.y.........y.\ny...........y", 1, 5);
  },
  skill_grappleChain: (g) => {
    g.t(`
DDD...........
D.D...........
DDDD..........
...DD.........
....DDD.......
....D.D.......
....DDDD......
.......DD.....
........SSS...
........S.S...
........SSS...
.........S...S
.....S...S..SS
.....SS..S.SS.
......SSSSSS..
`);
  },
  skill_rallyCry: (g, fx) => {
    g.t(`
.y..........
.WRRRRRRRRRR
.WRRRRRRRRRR
.WRRRRGRRRR.
.WRRRGGGRR..
.WRRGGwGGR..
.WRRRGGGRR..
.WRRRRGRRRR.
.WRRRRRRRRRR
.WRRRRRRRRRR
.W..........
.W..........
.W..........
`);
    fx.set(1, 0, "w");
  },

  // ---------------- Gunner (physical; flare = radiant) ----------------
  skill_aimedShot: (g) => {
    g.t(`
....sssss....
..ss..s..ss..
.s....s....s.
.s.........s.
s...........s
s...........s
ssss..e..ssss
s...........s
s...........s
.s.........s.
.s....s....s.
..ss..s..ss..
....sssss....
`);
  },
  skill_suppressingFire: (g, fx) => {
    const b = `
AAAAS.
AAAASS
AAAAS.
`;
    g.t(b, 4, 2).t(b, 8, 6).t(b, 3, 10);
    fx.t(".ooo\noo..\n.ooo", 0, 2).t(".ooo\noo..\n.ooo", 4, 6).t("ooo\no..\nooo", 0, 10);
  },
  skill_flareRound: (g, fx) => {
    g.t(`
........yyy.
.......yGwGy
.......GwwwG
.......yGwGy
........GGG.
.......FF...
......FF....
.....FF.....
....FF......
...FF.......
..FF........
.F..........
`);
    rays(fx, 11, 4, 3, 4, "y");
  },
  skill_piercingRound: (g, fx) => {
    g.t(`
.....DD......
.....DD......
.....DD......
.....DD......
AAAAASSSSSS..
AAAAASSSSSSS.
AAAAASSSSSS..
.....DD......
.....DD......
.....DD......
.....DD......
`);
    fx.set(10, 3, "y").set(11, 2, "y").set(10, 9, "y").set(11, 10, "y");
  },
  skill_pointBlank: (g, fx) => {
    g.t(`
..........y.y
.........yyy.
SSSSSSSSyywyy
SSSSSSSSywwwy
DDDWWDDD.yyy.
..WWkD...y.y.
..WWW........
..WWW........
...WW........
`);
    fx.set(14, 2, "y").set(14, 6, "y");
  },
  skill_quickReload: (g) => {
    g.t(`
.....yyyy....
...yy....yy..
..y........y.
.y....S...yyy
.y...SSS...y.
y....AAA.....
y....AAA.....
y....AAA....y
.y...AAA....y
.y...ddd...y.
..y.......y..
...yy...yy...
.....yyy.....
`);
  },

  // ---------------- Lamplighter (radiant gold; kindle = fire) ----------------
  skill_kindleWounds: (g, fx) => {
    g.t(`
.....F......
..F..FF..F..
..FF.FyF.FF.
.FyF.FyF.FyF
..FyRRRRyF..
....RRRR....
...RRRRRR...
..RRRRRRRR..
..RRRRRRRR..
..RRRRRRRR..
...RRRRRR...
....RRRR....
`);
    g.set(4, 7, "e");
    fx.set(1, 0, "e").set(11, 0, "o");
    fx.glow(6, 4, 5, lamp[3], 0.4);
  },
  skill_radiantLash: (g, fx) => {
    g.line(1, 14, 4, 11, "W").line(2, 14, 5, 11, "W").set(1, 15, "A").set(2, 15, "A");
    g.rect(5, 9, 2, 2, "A");
    const path: Pt[] = [
      [6, 8],
      [7, 6],
      [8, 4],
      [10, 2],
      [12, 2],
      [13, 4],
      [12, 6],
      [10, 6],
      [10, 5],
    ];
    for (let i = 0; i + 1 < path.length; i++) {
      const a = path[i] as Pt;
      const b = path[i + 1] as Pt;
      g.line(a[0], a[1], b[0], b[1], "G");
      g.line(a[0] + 1, a[1], b[0] + 1, b[1], "G");
    }
    g.set(11, 4, "w");
    fx.set(14, 1, "w").set(14, 8, "y").set(8, 9, "y").set(4, 4, "y");
    fx.glow(10, 4, 6, lamp[4], 0.35);
  },
  skill_beacon: (g, fx) => {
    g.t(
      `
..A..
.AAA.
AAAAA
AwwwA
AwwwA
AyyyA
AAAAA
.AAA.
..W..
..W..
..W..
.WWW.
`,
      undefined,
      2,
    );
    rays(fx, 7, 6, 4, 6, "y");
  },
  skill_purge: (g, fx) => {
    g.t(`
......G......
......G......
.....GyG.....
.....GyG.....
....GGyGG....
..GGGywyGGG..
GGyyywwwyyyGG
..GGGywyGGG..
....GGyGG....
.....GyG.....
.....GyG.....
......G......
......G......
`);
    fx.set(2, 2, "U").set(13, 3, "U").set(3, 12, "U").set(12, 12, "U").set(1, 9, "u");
  },
  skill_blindingFlash: (g, fx) => {
    g.t(`
...BBBBB...
.BBBBBBBBB.
BBBBGGGBBBB
BBBGGwGGBBB
BBBBGGGBBBB
.BBBBBBBBB.
...BBBBB...
`);
    fx.t(
      `
.y....y....y.
..y...y...y..
.............
.............
.............
.............
.............
.............
.............
..y...y...y..
.y....y....y.
`,
      undefined,
      2,
    );
  },
  skill_warmth: (g, fx) => {
    g.t(
      `
......F......
.....FFF.....
.....FyF.....
....FFwFF....
....FywyF....
LL...FyF...LL
LLL.......LLL
.LLLL...LLLL.
..LLLLLLLLL..
...LLLLLLL...
`,
      undefined,
      3,
    );
    fx.glow(7, 7, 7, lamp[3], 0.5);
  },
  // ---------------- Reaver (physical; blood red) ----------------
  skill_rend: (g) => {
    for (let k = 0; k < 3; k++) {
      const ox = 4 + k * 3;
      const oy = 1 + (k === 1 ? 0 : 1);
      for (let i = 0; i < 10; i++) {
        const x = ox + 5 - Math.round(i * 0.7);
        const y = oy + i + 1;
        const ch = i < 2 || i > 8 ? "x" : i < 5 ? "x" : "R";
        g.set(x, y, ch);
        if (i > 1 && i < 8) g.set(x + 1, y, i < 5 ? "R" : "R");
      }
    }
  },
  skill_lunge: (g) => {
    g.t(`
....A........
bb..A........
...WASSSSSSS.
bbWWASSSSSSSS
...WASSSSSSS.
bb..A........
....A........
`);
  },
  skill_flurry: (g) => {
    g.line(2, 3, 13, 12, "x").line(3, 3, 13, 11, "R");
    g.line(13, 3, 2, 12, "x").line(12, 3, 2, 11, "R");
    g.line(1, 7, 14, 7, "x").line(2, 8, 13, 8, "R");
    g.set(7, 7, "w").set(8, 7, "w");
  },
  skill_execute: (g) => {
    g.t(SKULL, 2, 3);
    g.line(14, 1, 2, 13, "x").line(14, 2, 3, 13, "R").line(13, 1, 1, 13, "R");
  },
  skill_shadowstep: (g, fx) => {
    g.t(
      `
.......UUU..
......UUUUU.
......UkpkU.
.......UUU..
.....UUUUUU.
.....UUUUUUU
.....UUUUU.U
....UUUUU...
...UUU.UUU..
..UUU...UU..
.UU......U..
`,
      2,
      2,
    );
    fx.t("uuuu\n\n.uuuuu\n\nuuu", 0, 6).t("U.\n.U", 0, 2);
  },
  skill_hamstring: (g) => {
    g.t(
      `
...LLLL.....
...LLLL.....
...LLLL.....
...LLLL.....
...LLLL.....
...LLLLL....
...LLLLLLLL.
...LLLLLLLLL
...LLLLLLLLL
...DDDDDDDDD
`,
      2,
      4,
    );
    g.line(1, 9, 9, 5, "x").line(1, 10, 9, 6, "R");
    g.set(4, 12, "R").set(4, 13, "R").set(3, 14, "R");
  },
  // ---------------- Hexer (void purple; rot = toxic) ----------------
  skill_voidBolt: (g, fx) => {
    g.poly(
      [
        [1, 5],
        [9, 4.5],
        [11, 8],
        [9, 11.5],
        [1, 11],
        [6, 8],
      ],
      "U",
    );
    g.disc(10, 8, 3.2, "P");
    g.set(9, 6, "w").set(10, 6, "p");
    fx.set(2, 3, "v").set(4, 13, "v").set(14, 4, "p").set(14, 12, "p").set(15, 8, "u");
  },
  skill_hexOfFrailty: (g, fx) => {
    g.ring(7.5, 7.5, 6, "U", 1);
    g.poly(
      [
        [3.5, 5],
        [12.5, 5],
        [8, 13],
      ],
      "P",
    );
    g.poly(
      [
        [6, 6.5],
        [10, 6.5],
        [8, 10],
      ],
      "n",
    );
    g.set(7, 1, "v").set(8, 1, "v").set(1, 7, "v").set(14, 7, "v");
    fx.set(7, 0, "p").set(8, 0, "p");
  },
  skill_siphon: (g, fx) => {
    g.t(
      `
.RR.RR.
RRRRRRR
RRRRRRR
.RRRRR.
..RRR..
...R...
`,
      1,
      9,
    );
    g.disc(11, 4, 3.2, "P");
    g.set(10, 3, "w").set(11, 3, "p");
    g.set(5, 7, "R").set(6, 7, "R").set(6, 6, "R");
    g.set(7, 5, "R").set(8, 6, "R");
    fx.set(14, 1, "p").set(15, 5, "v").set(12, 9, "u").set(9, 0, "v");
    fx.glow(11, 4, 6, umbra[4], 0.5);
  },
  skill_umbralTide: (g, fx) => {
    g.t(`
......UUUU...
....UUPPPPU..
...UPP....PU.
..UP...UU..P.
..UP..UPPU...
.UP...UP.....
.UP....UU....
UUP.......U.U
UUUP....UUUUU
UUUUUUUUUUUUU
`);
    fx.set(13, 3, "p").set(14, 6, "v");
  },
  skill_snuffLight: (g, fx) => {
    g.t(
      `
..UU.....
.U..U....
.U.......
..UU.....
....U....
...U.....
...k.....
.BBBBB...
.BBBBB...
.BBBBB...
.BBBBB...
.BBBBB...
AAAAAAA..
.AAAAA...
`,
      4,
      1,
    );
    fx.set(10, 3, "v").set(2, 5, "u");
  },
  skill_rotCurse: (g, fx) => {
    g.t(SKULL, 2, 1);
    g.swap("B", "T");
    g.set(3, 11, "T").set(3, 12, "T").set(7, 11, "T").set(7, 12, "T").set(7, 13, "T");
    g.set(11, 11, "T");
    fx.set(1, 1, "h").set(14, 3, "t").set(13, 13, "t").set(4, 14, "g");
  },

  // ---------------- Common ----------------
  skill_move: (g) => {
    g.t(`
........B....
........BB...
BBBBBBBBBBB..
BBBBBBBBBBBB.
BBBBBBBBBBB..
........BB...
........B....
....B........
...BB........
..BBBBBBBBBBB
.BBBBBBBBBBBB
..BBBBBBBBBBB
...BB........
....B........
`);
  },
  skill_wait: (g) => {
    g.t(`
AAAAAAAAAAA
.WWWWWWWWW.
..byyyyyb..
..byyyyyb..
...byyyb...
....byb....
.....y.....
....b.b....
...b.y.b...
..b.yyy.b..
..byyyyyb..
.WWWWWWWWW.
AAAAAAAAAAA
`);
  },

  // ---------------- Enemy (rust / organic) ----------------
  skill_enemyMelee: (g) => {
    g.t(`
.SSSSS.......
SSSSSSS......
SSRSSSSS.....
SSSSSSSSS....
.SSSSRSSSS...
..SSSSSSSSW..
...S.S.S.WWW.
.........WWW.
..........WWW
...........WW
`);
  },
  skill_enemyRanged: (g, fx) => {
    g.t(
      `
.........B...
.......BBBB..
...BBBBBBBBBB
BBBBBBBBBBBB.
...BBBBBBB...
.......BB....
`,
      2,
      5,
    );
    g.set(2, 8, "R").set(3, 8, "R").set(4, 8, "R").set(5, 7, "R");
    fx.t("rr.r\n\nr.rr", 0, 5).t(".rrr", 0, 11);
  },
  skill_enemyBuff: (g) => {
    g.t(`
......R......
.....RRR.....
....RRRRR....
...RRRRRRR...
..RRRR.RRRR..
.RRRR...RRRR.
......R......
.....RRR.....
....RRRRR....
...RRRRRRR...
..RRRR.RRRR..
.RRRR...RRRR.
`);
  },
  skill_enemyDebuff: (g) => {
    g.t(`
.UUUU...UUUU.
..UUUU.UUUU..
...UUUUUUU...
....UUUUU....
.....UUU.....
......U......
.UUUU...UUUU.
..UUUU.UUUU..
...UUUUUUU...
....UUUUU....
.....UUU.....
......U......
`);
  },
  skill_enemyHeal: (g) => {
    g.t(`
....TTTT....
....TTTT....
....TTTT....
TTTTTTTTTTTT
TTTTTTTTTTTT
TTTTTTTTTTTT
TTTTTTTTTTTT
.T..TTTT..T.
.T..TTTT....
....TTTT....
.....T.T....
.....T......
`);
  },

  // ---------------- Statuses ----------------
  status_bleed: (g) => {
    g.t(`
.....R......
.....R......
....RRR.....
....RRR.....
...RRRRR....
R..RRRRR..R.
R..RRRRR..R.
RR.RRRRR.RRR
RR..RRR..RRR
.............
`);
  },
  status_burn: (g, fx) => {
    g.t(FLAME);
    fx.set(2, 3, "e").set(13, 1, "o");
  },
  status_toxic: (g) => {
    g.t(`
....T....
....T....
...TTT...
...TTT...
..TTTTT..
.TTTTTTT.
.TkkTkkT.
TTkkTkkTT
TTTTTTTTT
TTTkTkTTT
.TTTTTTT.
..TTTTT..
`);
  },
  status_stun: (g, fx) => {
    g.t(
      `
......y......
......y......
....yywyy....
..y...y...y..
..y...y...y..
yywyy...yywyy
..y.......y..
..y.......y..
`,
      undefined,
      2,
    );
    fx.t(
      `
...ooooooo...
.oo.......oo.
o...........o
.oo.......oo.
...ooooooo...
`,
      undefined,
      9,
    );
  },
  status_mark: (g) => {
    g.t(`
rrr.....rrr
r.........r
r.........r
...........
.....e.....
....eee....
.....e.....
...........
r.........r
r.........r
rrr.....rrr
`);
  },
  status_guard: (g) => {
    g.t(
      `
SSSSSSSS
SSSGGSSS
SSSGGSSS
SGGGGGGS
SSSGGSSS
.SSGGSS.
.SSSSSS.
..SSSS..
...SS...
`,
      6,
      2,
    );
    g.t(
      `
.BBB.
BBBBB
BBBBB
.BBB.
.....
LLLLL
LLLLL
`,
      2,
      6,
    );
  },
  status_shield: (g, fx) => {
    g.t(`
CCCCCCCCCC
CiiiiiiiiC
CiziiiiiiC
CiizziiiiC
CiiiziiiiC
.CiiiiiiC.
.CiiiiiiC.
..CiiiiC..
...CiiC...
....CC....
`);
    fx.set(1, 2, "z").set(14, 2, "z");
  },
  status_blind: (g) => {
    g.t(`
...BBBBB...
.BBBBBBBBB.
BBBBmmmBBBB
BBBmmkmmBBB
BBBBmmmBBBB
.BBBBBBBBB.
...BBBBB...
`);
    g.line(12, 2, 3, 13, "r").line(13, 2, 4, 13, "r");
  },
  status_corrode: (g) => {
    g.t(
      `
...T......
..TTT.....
..TTT.....
...T......
`,
      5,
      0,
    );
    g.t(
      `
SSSSSSSSSSSS
SSSSkkSSSSSS
SSSkTTkSSkSS
SSSSTkSSkTkS
.SSSTSSSSTS.
....T....T..
....T.......
`,
      2,
      6,
    );
  },
  status_haste: (g) => {
    g.t(`
CCC...CCC...
.CCC...CCC..
..CCC...CCC.
...CCC...CCC
..CCC...CCC.
.CCC...CCC..
CCC...CCC...
`);
  },
  status_slow: (g) => {
    g.t(`
...DDDD......
..DSSSSD.....
.DSSDDSSD....
.DSDSSDSD..B.
.DSDDSDSD.BB.
.DSSSSDSDBBB.
BBDDDDDDBBBB.
BBBBBBBBBBB..
`);
  },
  status_regen: (g, fx) => {
    g.t(`
...TTT...
...TTT...
TTTTTTTTT
TTTTTTTTT
TTTTTTTTT
...TTT...
...TTT...
`);
    fx.set(13, 3, "h").set(2, 12, "h").set(12, 12, "t");
  },
  status_empower: (g) => {
    g.t(`
..S.......R...
.SSS.....RRR..
.SSS....RRRRR.
.SSS...RRRRRRR
.SSS.....RRR..
.SSS.....RRR..
.SSS.....RRR..
AAAAA....RRR..
..W...........
..W...........
.AAA..........
`);
  },
  status_weaken: (g) => {
    g.t(`
.SSS..........
.SSS..........
..............
.SSS.....UUU..
.SSS.....UUU..
.SSS.....UUU..
.SSS..UUUUUUUU
AAAAA..UUUUUU.
..W.....UUUU..
..W......UU...
.AAA..........
`);
    g.set(1, 1, "S").set(2, 2, "S");
  },
  status_taunt: (g) => {
    g.t(`
.....R.....
..R..R..R..
...RRRRR...
..RRRxRRR..
RRRRRxRRRRR
..RRRxRRR..
..RRRxRRR..
..RRRRRRR..
...RRxRR...
..R..R..R..
.....R.....
`);
  },
  status_evasive: (g) => {
    g.t(`
......CCCC..
....CC....C.
..........C.
CCCCCCCCCC..
............
CCCCCCCC....
........C...
.....CCC....
`);
  },
  status_lit: (g, fx) => {
    g.t(`
...G...
..GG...
..GGG..
.GGyGG.
.GywyG.
.GywyG.
..GyG..
`);
    halo(fx, 7, 8, 5, "o");
  },

  // ---------------- Items ----------------
  item_weapon_vanguard: (g) => {
    g.line(2, 13, 8, 7, "W").line(3, 13, 8, 8, "W");
    g.set(1, 14, "A").set(2, 14, "A");
    g.poly(
      [
        [8.5, 1],
        [14, 6.5],
        [10.5, 10],
        [5, 4.5],
      ],
      "S",
    );
    g.line(6, 6, 9, 9, "D");
  },
  item_weapon_gunner: (g) => {
    g.line(6, 9, 14, 1, "S");
    g.line(5, 9, 10, 4, "D").line(5, 10, 10, 5, "D").line(6, 10, 10, 6, "D");
    g.line(1, 12, 4, 9, "W").line(2, 13, 5, 10, "W").line(1, 13, 3, 11, "W");
    g.line(7, 5, 9, 3, "k");
    g.set(8, 10, "D").set(9, 11, "D");
    g.set(14, 1, "s");
  },
  item_weapon_lamplighter: (g, fx) => {
    g.line(1, 14, 9, 6, "W").line(2, 14, 10, 6, "W");
    g.line(10, 6, 11, 3, "A").set(12, 2, "A").set(13, 2, "A").set(13, 3, "A");
    g.t(
      `
.A.
AAA
yww
yyw
AAA
`,
      12,
      4,
    );
    fx.glow(13, 7, 5, lamp[3], 0.55);
  },
  item_weapon_reaver: (g) => {
    sword(g, false, 7, "S", "R", "D");
    sword(g, true, 7, "S", "R", "D");
  },
  item_weapon_hexer: (g, fx) => {
    g.t(`
....PPPP....
...PPwPPP...
..PPwPPPPP..
..PPPPPPPP..
.DPPPPPPPPD.
.DDPPPPPPDD.
..DDPPPPDD..
...DDDDDD...
.....DD.....
.....WW.....
.....WW.....
....AAAA....
`);
    fx.set(1, 2, "v").set(14, 1, "p").set(13, 5, "u");
  },
  item_armor_light: (g) => {
    g.t(`
.LLL...LLL.
LLLLL.LLLLL
LLLLLLLLLLL
LLLLLaLLLLL
.LLLLaLLLL.
..LLLaLLL..
..LLLaLLL..
..WWWAWWW..
..LLLLLLL..
..LLLLLLL..
...LL.LL...
`);
  },
  item_armor_medium: (g) => {
    g.t(`
.SSS.....SSS.
SSSSS...SSSSS
SSSSSmdmSSSSS
.LdmdmdmdmdL.
.LmdmdmdmdmL.
..dmdmdmdmd..
..mdmdmdmdm..
..WWWWAWWWW..
..dmdmdmdmd..
..mdmdmdmdm..
...dmd.dmd...
`);
  },
  item_armor_heavy: (g) => {
    g.t(`
.SSSS...SSSS.
SSSSSSSSSSSSS
SSSSSDDDSSSSS
.DSSSSSSSSSD.
..SSSSGSSSS..
..SSSSGSSSS..
..SSSSSSSSS..
..DDDDDDDDD..
..SSSSSSSSS..
..SSSSDSSSS..
...SSS.SSS...
`);
  },
  item_lamp_oil: (g, fx) => {
    g.t(LANTERN, undefined, 2);
    g.t("RRRR", 6, 11);
    halo(fx, 7, 8, 6, "o");
  },
  item_lamp_arc: (g, fx) => {
    g.t(LANTERN, undefined, 2);
    g.swap("A", "S").swap("y", "c").swap("w", "z").swap("o", "i");
    g.set(7, 8, "w").set(8, 7, "w");
    halo(fx, 7, 8, 6, "i");
  },
  item_lamp_shroud: (g, fx) => {
    g.t(LANTERN, undefined, 2);
    g.swap("y", "a").swap("w", "o").swap("o", "a");
    g.t(
      `
...UU...
..UUUU..
.UUUUUU.
UUUUUUUU
UUUUUUUU
U.U..U.U
`,
      4,
      2,
    );
    fx.set(7, 11, "o");
  },
  item_trinket_ring: (g, fx) => {
    g.ring(7.5, 9, 4.5, "G", 2);
    g.t(
      `
.RR.
RRRR
.RR.
`,
      6,
      1,
    );
    g.set(7, 2, "e");
    fx.set(3, 1, "y").set(12, 3, "w");
  },
  item_trinket_charm: (g) => {
    g.line(2, 1, 6, 5, "a").line(13, 1, 9, 5, "a");
    g.t(
      `
..A..
.AAA.
AACAA
ACzCA
ACCCA
.ACA.
..A..
`,
      5,
      5,
    );
  },
  item_trinket_chip: (g, fx) => {
    g.t(`
..s.s.s.s..
.DDDDDDDDD.
sDDDDDDDDDs
.DDCCCCCDD.
sDDCzCCCDDs
.DDCCCCCDD.
sDDCCCCCDDs
.DDDDDDDDD.
sDDDDDDDDDs
.DDDDDDDDD.
..s.s.s.s..
`);
    fx.set(8, 7, "Z");
  },
  item_trinket_vial: (g) => {
    g.t(`
....WW....
....WW....
...bBBb...
....BB....
....BB....
...BTTB...
..BTTTTB..
.BTTTTTTB.
.BThTTTTB.
.BTTTTTTB.
..BTTTTB..
...BBBB...
`);
  },
  item_trinket_shard: (g, fx) => {
    g.t(`
.......CC.
......CCC.
.....CCzC.
....CCzC..
...CCzCC..
..CCCCC...
..CCCC....
.CCCC.....
.CCC......
.CC.......
`);
    fx.set(12, 1, "z").set(2, 4, "c").set(10, 10, "c");
  },
  item_trinket_coin: (g) => {
    g.disc(7.5, 7.5, 5.3, "G");
    g.ring(7.5, 7.5, 3.6, "A", 1);
    g.rect(7, 7, 2, 2, "k");
  },
  item_trinket_fang: (g) => {
    g.t(`
l.........l
.l.......l.
..l.....l..
...lAAAl...
...BBBBB...
...BBBBB...
....BBBB...
....BBBB...
.....BBB...
.....BBB...
......BB...
......B....
`);
  },
  // ---------------- Map nodes ----------------
  node_combat: (g) => {
    sword(g, false, 8);
    sword(g, true, 8);
  },
  node_elite: (g, fx) => {
    g.t(`
B...........B
BB.........BB
.B..BBBBB..B.
.BBBBBBBBBBB.
..BBBBBBBBB..
..BeeBBBeeB..
..BeeBBBeeB..
..BBBBkBBBB..
...BBBBBBB...
....BkBkB....
....BBBBB....
`);
    fx.set(4, 6, "e").set(10, 6, "e");
  },
  node_boss: (g, fx) => {
    g.t(`
.G....G....G.
.GG..GGG..GG.
.GGGGGRGGGGG.
.GGGGGGGGGGG.
..BBBBBBBBB..
.BBBBBBBBBBB.
.BeeeBBBeeeB.
.BeeeBBBeeeB.
.BBBBBkBBBBB.
..BBBBBBBBB..
...BkBkBkB...
...BBBBBBB...
`);
    fx.set(1, 12, "r").set(13, 12, "r");
  },
  node_cache: (g) => {
    g.t(`
SSSSSSSSSSS
SWWWWWWWWWS
SjjjjjjjjjS
SWWWWWWWWWS
SWWWWGWWWWS
SjjjjGjjjjS
SWWWWWWWWWS
SWWWWWWWWWS
SjjjjjjjjjS
SSSSSSSSSSS
`);
  },
  node_vein: (g, fx) => {
    g.t(`
.......C.....
......CCC.C..
..C...CzC.CC.
.CCC..CCCCCC.
.CzC.KCCCKCCK
KCCCKKKCCKKKK
KKKKKKKKKKKKK
KKKKKKKKKKKKK
.KKKKKKKKKKK.
`);
    fx.set(1, 3, "c").set(13, 2, "z");
    fx.glow(8, 5, 6, crystal[3], 0.35);
  },
  node_camp: (g, fx) => {
    g.t(`
.....F.....
....FFF....
....FyF..F.
...FFyFFFF.
...FywwyF..
..FFywwyFF.
...FFFFFF..
.WW.WWWW.WW
..WWWWWWWW.
.WW......WW
`);
    halo(fx, 7, 7, 6, "o");
  },
  node_start: (g, fx) => {
    g.t(`
....SSS....
...SSSSS...
..SSCCCSS..
..SSCzCSS..
.SSSSSSSSS.
.DDDDDDDDD.
..D.GGG.D..
.D..GwG..D.
D....G....D
`);
    fx.set(5, 12, "y").set(9, 12, "y").set(7, 13, "o");
  },
  node_derelict: (g, fx) => {
    g.t(`
.D.....DD...
.DD...DDDD..
.DDD.DDDDD..
.DDDDDDDDDD.
.DDkkDDkkDD.
.DDkkDDkoDD.
.DDDDDDDDDD.
.DDkkDDkkDD.
.DDkkDDkkDD.
.DDDDDDDDDD.
KKKKKKKKKKKK
`);
    fx.set(9, 6, "o");
  },

  // ---------------- Stats / UI ----------------
  stat_hp: (g) => {
    g.t(`
.RRR...RRR.
RRRRR.RRRRR
RRRRRRRRRRR
RRRRRRRRRRR
RRRRRRRRRRR
.RRRRRRRRR.
..RRRRRRR..
...RRRRR...
....RRR....
.....R.....
`);
    g.set(4, 4, "x").set(3, 5, "e");
  },
  stat_speed: (g) => {
    g.t(`
BB............
BBBB..........
.BBBBB.LLLL...
..BBBB.LLLL...
...BBBBLLLL...
.....BBLLLL...
.......LLLLL..
.......LLLLLLL
.......LLLLLLL
.......DDDDDDD
`);
  },
  stat_crit: (g) => {
    g.t(`
.....F.....
.F...F...F.
..F.FFF.F..
...FFFFF...
..FFFyFFF..
FFFFywyFFFF
..FFFyFFF..
...FFFFF...
..F.FFF.F..
.F...F...F.
.....F.....
`);
  },
  stat_dodge: (g) => {
    g.t(`
.........BB
.......BBBB
......BBBB.
.....BBBBB.
....BBBmBB.
...BBBmBB..
..BBBmBB...
..BBmBB....
..BmBB.....
..mB.......
.m.........
m..........
`);
  },
  stat_prot: (g) => {
    g.t(`
SSSSSSSSSSS
SxSSSSSSSxS
SSSSSSSSSSS
SSSSSSSSSSS
DDDDDDDDDDD
SSSSSSSSSSS
.SSSSSSSSS.
.SSSSSSSSS.
..SSSSSSS..
...SSSSS...
....SSS....
`);
  },
  stat_acc: (g) => {
    g.disc(6.5, 8.5, 5, "R");
    g.disc(6.5, 8.5, 3.6, "B");
    g.disc(6.5, 8.5, 2.2, "R");
    g.rect(6, 8, 2, 2, "x");
    g.line(8, 7, 13, 2, "W");
    g.t("A.A\n.AA\nAAA", 12, 0);
  },
  stat_dmg: (g) => {
    sword(g, true, 9);
  },
  ui_lamp: (g, fx) => {
    g.t(LANTERN, undefined, 2);
    halo(fx, 7, 8, 6, "o");
  },
  ui_ore: (g, fx) => {
    g.t(`
....CCCC....
...CCCCCC...
..CCzCCCCC..
.CCzCCCCCCC.
CCCCCCCCCCCC
.CCCCCCCCCC.
..CCCCCCCC..
...CCCCCC...
....CCCC....
`);
    g.line(4, 4, 11, 4, "i").line(5, 4, 3, 8, "c").line(10, 4, 8, 12, "i");
    fx.set(1, 2, "z").set(14, 11, "c");
  },
  ui_xp: (g) => {
    g.t(`
.....C.....
.....C.....
....CCC....
....CzC....
CCCCCCCCCCC
.CCCCCCCCC.
..CCCCCCC..
...CCCCC...
..CCCCCCC..
..CCC.CCC..
.CC.....CC.
`);
  },
  ui_perk: (g) => {
    g.t(`
.RR...RR.
.RRR.RRR.
..RRRRR..
...RRR...
..GGGGG..
.GGGGGGG.
GGGGyGGGG
GGGyyyGGG
GGGGyGGGG
.GGGGGGG.
..GGGGG..
`);
  },
  ui_cooldown: (g) => {
    g.rect(6, 1, 3, 1, "S").rect(7, 2, 1, 1, "S");
    g.disc(7, 8.5, 5.3, "S");
    g.disc(7, 8.5, 4.2, "x");
    g.poly(
      [
        [7.5, 9],
        [7.5, 4],
        [11.8, 7],
        [11.8, 11],
      ],
      "i",
    );
    g.line(7, 9, 7, 5, "k").line(7, 9, 9, 9, "k");
  },
  ui_lock: (g) => {
    g.t(`
...SSSSS...
..SS...SS..
..S.....S..
..S.....S..
.GGGGGGGGG.
.GGGGGGGGG.
.GGGGkGGGG.
.GGGkkkGGG.
.GGGGkGGGG.
.GGGGkGGGG.
.GGGGGGGGG.
`);
  },
  ui_crown: (g) => {
    g.t(`
G....G....G
GG..GGG..GG
GGG.GGG.GGG
GGGGGGGGGGG
GGRGGCGGRGG
GGGGGGGGGGG
AAAAAAAAAAA
`);
  },
  ui_player: (g) => {
    g.t(`
...BBBB...
..BBBBBB..
..BBBBBB..
..BBBBBB..
...BBBB...
..........
.SSSSSSSS.
SSSSSSSSSS
SSSSSSSSSS
SSSSSSSSSS
`);
  },

  // ---------------- Elements ----------------
  elem_physical: (g) => {
    g.t(`
..BBBBBBBB..
.BBBBBBBBBB.
.BkBBkBBkBB.
.BkBBkBBkBB.
BBBBBBBBBBB.
BBBBBBBBBBB.
BkkkkkBBBBB.
BBBBBkBBBBB.
.BBBBBBBBB..
..BBBBBBB...
...LLLLL....
...LLLLL....
`);
  },
  elem_radiant: (g, fx) => {
    g.disc(7.5, 7.5, 3.4, "G");
    g.set(6, 6, "w");
    const sp: Pt[] = [
      [7, 0],
      [8, 0],
      [7, 1],
      [8, 1],
      [7, 14],
      [8, 14],
      [7, 13],
      [8, 13],
      [0, 7],
      [0, 8],
      [1, 7],
      [1, 8],
      [14, 7],
      [14, 8],
      [13, 7],
      [13, 8],
      [3, 3],
      [12, 3],
      [3, 12],
      [12, 12],
      [2, 2],
      [13, 2],
      [2, 13],
      [13, 13],
    ];
    for (const [x, y] of sp) g.set(x, y, "G");
    fx.ring(7.5, 7.5, 5, "o");
  },
  elem_void: (g, fx) => {
    g.disc(7.5, 7.5, 5.4, "P");
    g.disc(8.5, 6.5, 4.6, "n");
    fx.set(1, 2, "p").set(13, 13, "v").set(14, 4, "u");
  },
  elem_fire: (g) => {
    g.t(FLAME);
  },
  elem_toxic: (g, fx) => {
    g.t(`
....T....
....T....
...TTT...
...TTT...
..TTTTT..
.TTTTTTT.
.TTTTTTT.
TTTTTTTTT
TThTTTTTT
TThTTTTTT
.TThTTTT.
..TTTTT..
`);
    fx.set(13, 3, "t").set(12, 1, "h");
  },

  // ---------------- Discipline emblems ----------------
  disc_vanguard: (g) => {
    badge(g);
    g.t(
      `
GGGGGGG
GSSGSSG
GGGGGGG
GSSGSSG
.GSGSG.
..GGG..
...G...
`,
      5,
      5,
    );
  },
  disc_gunner: (g) => {
    badge(g, "D");
    g.ring(8, 8, 3.5, "s", 1);
    g.rect(8, 3, 1, 3, "s").rect(8, 11, 1, 3, "s").rect(4, 8, 3, 1, "s").rect(10, 8, 3, 1, "s");
    g.set(8, 8, "e");
  },
  disc_lamplighter: (g) => {
    badge(g);
    g.t(
      `
..G..
..GG.
.GGG.
GGyGG
GywyG
GywyG
.GyG.
`,
      6,
      4,
    );
  },
  disc_reaver: (g) => {
    badge(g, "R");
    g.line(5, 5, 10, 10, "x").line(6, 5, 10, 9, "S");
    g.line(11, 5, 6, 10, "x").line(10, 5, 6, 9, "S");
    g.set(4, 11, "R").set(5, 11, "R").set(12, 11, "R").set(11, 11, "R");
  },
  disc_hexer: (g, fx) => {
    badge(g, "U", "n");
    g.t(
      `
..PPP..
.PPPPP.
PPPkPPP
PPkkkPP
PPPkPPP
.PPPPP.
..PPP..
`,
      5,
      5,
    );
    fx.set(8, 2, "p");
  },
};

const cache = new Map<IconId, HTMLCanvasElement>();

/** Draw (and cache) a 16x16 icon. Returns a fresh canvas copy-safe for texture upload. */
export function drawIcon(id: IconId): HTMLCanvasElement {
  const hit = cache.get(id);
  if (hit) return hit;
  const g = new G();
  const fx = new G();
  const def = DEFS[id];
  const a = def(g, fx);
  const c = render(g, fx, typeof a === "number" ? a : 0.55);
  cache.set(id, c);
  return c;
}
