/**
 * Procedural pixel-art enemies for Radiance. All sprites face LEFT (toward the party).
 *
 * Lighting: key light from the upper-left (the party's lamps), a faint warm kiss on the front
 * edge and a cold violet rim on the back edge so dark creatures still separate from the
 * near-black backgrounds. Built with the same sprite kit as the mercs.
 */

import {
  arcPts,
  blitRot,
  contactShadow,
  drawHostileMerc,
  drawHostileMercPortrait,
  fill,
  finish,
  type Glow,
  linePts,
  Mask,
  type MercLook,
  type MercPose,
  type P,
  rim,
  rotPt,
  Spr,
  scale2x,
  shade,
  tone,
  tplSpr,
} from "./mercs";
import { INK, RAMPS, type Ramp, TINTS } from "./palette";
import { artRng, withAlpha } from "./pixel";

export type EnemyArtId =
  | "huskMiner"
  | "huskForeman"
  | "gloamCrawler"
  | "voidWisp"
  | "shardback"
  | "scavCutter"
  | "scavGunner"
  | "umbralStalker"
  | "mycelidTender"
  | "lumenEater"
  | "mawTendril";
export type EnemyPose = "idle0" | "idle1" | "attack" | "hurt";

const SMALL = { w: 48, h: 48, footY: 44, centerX: 24 } as const;
const BOSS = { w: 96, h: 96, footY: 92, centerX: 48 } as const;

export function enemyFrame(id: EnemyArtId): {
  w: number;
  h: number;
  footY: number;
  centerX: number;
} {
  return id === "lumenEater" ? { ...BOSS } : { ...SMALL };
}

interface Comp {
  s: Spr;
  glows: Glow[];
  /** Soft ground shadow (drawn translucent, under the sprite). */
  shadow?: { cx: number; rx: number; y: number; alpha: number };
}

const COLD_RIM = RAMPS.umbra[4];
const WARM_KISS = RAMPS.lamp[3];

function finishEnemy(c: Comp): HTMLCanvasElement {
  rim(c.s, 1, COLD_RIM, 0.32);
  rim(c.s, -1, WARM_KISS, 0.14);
  const cv = finish(c.s, c.glows);
  if (c.shadow) {
    const ctx = cv.getContext("2d");
    if (ctx) {
      const { cx, rx, y, alpha } = c.shadow;
      ctx.save();
      ctx.globalCompositeOperation = "destination-over";
      ctx.fillStyle = withAlpha(RAMPS.void[0], alpha);
      for (let dx = -rx; dx <= rx; dx++) {
        const t = Math.abs(dx) / (rx + 0.5);
        const hgt = t < 0.6 ? 2 : 1;
        ctx.fillRect(cx + dx, y - hgt + 1, 1, hgt);
      }
      ctx.restore();
    }
  }
  return cv;
}

const mix = (a: string, b: string, t: number): string => {
  const pa = Number.parseInt(a.slice(1), 16);
  const pb = Number.parseInt(b.slice(1), 16);
  const ch = (sh: number) => {
    const x = (pa >> sh) & 255;
    const y = (pb >> sh) & 255;
    return Math.round(x + (y - x) * t);
  };
  return `#${((1 << 24) | (ch(16) << 16) | (ch(8) << 8) | ch(0)).toString(16).slice(1)}`;
};

const mixRamp = (a: Ramp, b: Ramp, t: number): string[] => a.map((c, i) => mix(c, tone(b, i), t));

/** Pose helpers shared by most creatures. */
function poseDelta(pose: EnemyPose): { bob: number; lunge: number; recoil: number } {
  return {
    bob: pose === "idle1" ? 1 : 0,
    lunge: pose === "attack" ? 1 : 0,
    recoil: pose === "hurt" ? 1 : 0,
  };
}

// ============================================================================================
// Husks (reanimated miners)
// ============================================================================================

const HUSK_SKIN = ["#151c19", "#2c3a33", "#4a5e50", "#6f8771", "#97ad93"] as const;
const JUMPSUIT = mixRamp(TINTS[3]?.ramp ?? RAMPS.leather, RAMPS.bone, 0.45);

/** Husk head facing left: dented hard-hat, dead headlamp, glowing sockets, slack jaw. */
const HUSK_HEAD = [
  "....kkkkk...",
  "...kmMMWmk..",
  "..kmMMmmmnk.",
  ".LkmmMmcmnk.",
  "lLkkkkkkkkkk",
  "..3g343221..",
  ".12s332221..",
  "..2t1232211.",
  "..1d1d2211..",
  "...1111.....",
];

function huskHeadMap(glow: string): Record<string, string> {
  return {
    k: RAMPS.leather[1],
    m: mix(RAMPS.lamp[1], RAMPS.leather[2], 0.5),
    M: mix(RAMPS.lamp[2], RAMPS.leather[3], 0.55),
    W: mix(RAMPS.lamp[3], RAMPS.bone[4], 0.4),
    n: RAMPS.leather[2],
    c: RAMPS.leather[0],
    L: RAMPS.steel[1],
    l: RAMPS.void[3],
    "1": tone(HUSK_SKIN, 0),
    "2": tone(HUSK_SKIN, 1),
    "3": tone(HUSK_SKIN, 2),
    "4": tone(HUSK_SKIN, 3),
    g: glow,
    s: RAMPS.toxic[1],
    t: RAMPS.bone[3],
    d: INK,
  };
}

const PICKAXE = {
  rows: [
    "...........kk....",
    "............nk...",
    "............mnk..",
    "dwwwwwwwwwwkMMmk.",
    "............mrk..",
    "............rk...",
    "...........kk....",
    "..........k......",
  ],
  pivot: [2, 3] as P,
};

function wmap(): Record<string, string> {
  return {
    k: RAMPS.steel[1],
    n: RAMPS.steel[2],
    m: RAMPS.steel[3],
    M: RAMPS.steel[4],
    W: RAMPS.steel[5],
    d: RAMPS.leather[1],
    w: RAMPS.leather[2],
    o: RAMPS.leather[3],
    r: RAMPS.rust[2],
    R: RAMPS.rust[3],
    y: RAMPS.lamp[2],
    Y: RAMPS.lamp[3],
  };
}

interface HumRig {
  hip: P;
  chest: P;
  head: P;
  fl: [P, P, P]; // front (near/left) leg
  bl: [P, P, P]; // back leg
  fa: [P, P, P]; // front arm
  ba: [P, P, P]; // back arm
  w: number;
}

function limb(
  s: Spr,
  L: readonly [P, P, P],
  r: number,
  ramp: readonly string[],
  bias: number,
): Mask {
  const m = new Mask(s.w, s.h);
  m.capsule(L[0][0], L[0][1], L[1][0], L[1][1], r + 0.2, r);
  m.capsule(L[1][0], L[1][1], L[2][0], L[2][1], r, r - 0.3);
  shade(s, m, ramp, { bias, kx: 0.65 });
  return m;
}

function boot(s: Spr, x: number, y: number, ramp: readonly string[], bias: number, big = false) {
  const m = new Mask(s.w, s.h);
  m.span(y - 2, x - 1, x + 1 + (big ? 1 : 0));
  m.span(y - 1, x - 2 - (big ? 1 : 0), x + 1 + (big ? 1 : 0));
  m.span(y, x - 3 - (big ? 1 : 0), x + 1 + (big ? 1 : 0));
  shade(s, m, ramp, { bias, kx: 0.5 });
  s.hline(x - 3 - (big ? 1 : 0), x + 1 + (big ? 1 : 0), y, RAMPS.leather[0]);
}

function huskRig(pose: EnemyPose): HumRig {
  switch (pose) {
    case "attack":
      return {
        hip: [23, 31],
        chest: [18, 22],
        head: [9, 13],
        fl: [
          [21, 31],
          [17, 36],
          [14, 43],
        ],
        bl: [
          [25, 31],
          [29, 37],
          [32, 43],
        ],
        fa: [
          [17, 23],
          [13, 21],
          [10, 18],
        ],
        ba: [
          [21, 23],
          [19, 27],
          [12, 19],
        ],
        w: 115,
      };
    case "hurt":
      return {
        hip: [27, 31],
        chest: [27, 21],
        head: [21, 11],
        fl: [
          [25, 31],
          [23, 36],
          [21, 42],
        ],
        bl: [
          [29, 31],
          [30, 37],
          [31, 43],
        ],
        fa: [
          [25, 23],
          [23, 28],
          [20, 30],
        ],
        ba: [
          [29, 23],
          [32, 26],
          [34, 24],
        ],
        w: 150,
      };
    default: {
      const b = pose === "idle1" ? 1 : 0;
      return {
        hip: [26, 31],
        chest: [21, 22 + b],
        head: [12, 13 + b],
        fl: [
          [24, 31],
          [21, 37],
          [19, 43],
        ],
        bl: [
          [28, 31],
          [30, 37],
          [31, 43],
        ],
        fa: [
          [19, 24 + b],
          [17, 29 + b],
          [16, 33 + b],
        ],
        ba: [
          [24, 24 + b],
          [26, 29 + b],
          [26, 33 + b],
        ],
        w: 112 - b * 3,
      };
    }
  }
}

function torso(
  s: Spr,
  chest: P,
  hip: P,
  wBack: number,
  wFront: number,
  ramp: readonly string[],
  hunch = 0,
): Mask {
  const m = new Mask(s.w, s.h);
  for (let y = chest[1]; y <= hip[1] + 1; y++) {
    const t = (y - chest[1]) / Math.max(1, hip[1] - chest[1]);
    const x = Math.round(chest[0] + (hip[0] - chest[0]) * t);
    const top = t < 0.15 ? -1 : 0;
    const waist = t > 0.45 && t < 0.85 ? -1 : 0;
    // facing left: "front" is to the left
    m.span(y, x - wFront - top - waist, x + wBack + top + (t < 0.4 ? hunch : 0));
  }
  shade(s, m, ramp, { kx: 0.55 });
  return m;
}

function drawHusk(pose: EnemyPose): Comp {
  const s = new Spr(48, 48);
  const glows: Glow[] = [];
  const r = huskRig(pose);
  const suit = JUMPSUIT;
  const glow = RAMPS.toxic[4];
  // back arm + leg
  limb(s, r.ba, 1.35, HUSK_SKIN.slice(0, 4), -0.8);
  limb(s, r.bl, 1.55, suit.slice(0, 4), -0.8);
  boot(s, r.bl[2][0], r.bl[2][1], RAMPS.leather.slice(0, 4), -0.6);
  limb(s, r.fl, 1.55, suit.slice(0, 4), 0);
  boot(s, r.fl[2][0], r.fl[2][1], RAMPS.leather.slice(0, 4), 0);
  // torso: hunched, ragged
  const tm = torso(s, r.chest, r.hip, 4, 3, suit.slice(0, 5), 1);
  // rips showing sickly skin + rib lines
  const [cx, cy] = r.chest;
  s.set(cx - 1, cy + 4, tone(HUSK_SKIN, 2)).set(cx, cy + 4, tone(HUSK_SKIN, 3));
  s.set(cx - 1, cy + 5, tone(HUSK_SKIN, 1)).set(cx, cy + 6, tone(HUSK_SKIN, 2));
  s.set(cx + 1, cy + 5, tone(HUSK_SKIN, 0));
  // belt & tool pouch
  tm.each((x, y) => {
    if (y === r.hip[1] - 2) s.set(x, y, RAMPS.leather[1]);
  });
  s.rect(r.hip[0] + 1, r.hip[1] - 2, 3, 3, RAMPS.leather[2]).set(
    r.hip[0] + 3,
    r.hip[1],
    RAMPS.leather[1],
  );
  // ragged hem
  for (let x = r.hip[0] - 4; x <= r.hip[0] + 4; x += 2) s.set(x, r.hip[1] + 2, tone(suit, 1));
  // hi-vis stripe (faded) on the back
  tm.each((x, y) => {
    if (y === cy + 3 && x > cx) s.set(x, y, mix(RAMPS.lamp[2], tone(suit, 2), 0.5));
  });
  // head
  s.tpl(r.head[0], r.head[1], HUSK_HEAD, huskHeadMap(glow));
  glows.push({ x: r.head[0] + 3, y: r.head[1] + 5, r: 3, color: RAMPS.toxic[3], strength: 0.55 });
  // front arm + pickaxe
  const am = limb(s, r.fa, 1.35, HUSK_SKIN.slice(0, 4), 0);
  contactShadow(s, am, 0.4);
  limb(s, r.fa, 1.35, HUSK_SKIN.slice(0, 4), 0);
  // torn sleeve
  const sl = new Mask(48, 48).capsule(r.fa[0][0], r.fa[0][1], r.fa[1][0], r.fa[1][1], 1.6, 1.4);
  shade(s, sl, suit.slice(0, 4), { kx: 0.6 });
  const pick = tplSpr(PICKAXE.rows, wmap());
  blitRot(s, pick, PICKAXE.pivot[0], PICKAXE.pivot[1], r.w, r.fa[2][0], r.fa[2][1]);
  // fist over the haft
  const hm = new Mask(48, 48).rect(r.fa[2][0] - 1, r.fa[2][1] - 1, 2, 2);
  shade(s, hm, HUSK_SKIN.slice(1, 5), {});
  if (pose === "attack") {
    const pts = arcPts(r.fa[2][0], r.fa[2][1], 13, -150, -230);
    pts.forEach(([x, y], i) => {
      if (!s.has(x, y) && i % 2 === 0)
        s.set(x, y, i > pts.length / 2 ? RAMPS.bone[4] : RAMPS.bone[2]);
    });
  }
  return { s, glows };
}

const FOREMAN_HEAD = [
  "...yyyyyy....",
  "..yYYYYyyy...",
  ".yYYYyyyyyy..",
  "kkkkkkkkkkkk.",
  "..g34332211..",
  ".23s33322211.",
  ".223322221...",
  "..1tdtd221...",
  "..1222211....",
  "...1111......",
];

function drawForeman(pose: EnemyPose): Comp {
  const s = new Spr(48, 48);
  const glows: Glow[] = [];
  const { bob, lunge, recoil } = poseDelta(pose);
  const dx = -lunge * 3 + recoil * 3;
  const hip: P = [27 + dx, 30];
  const chest: P = [24 + dx - lunge * 2 + recoil * 2, 17 + bob];
  const st = RAMPS.steel;
  const suit = mixRamp(RAMPS.rust.slice(0, 5), RAMPS.leather, 0.45);
  const skin = HUSK_SKIN;
  // exo backpack (behind)
  const bp = new Mask(48, 48).rect(chest[0] + 5, chest[1] + 1, 5, 9);
  shade(s, bp, st.slice(0, 5), { kx: 0.6 });
  s.vline(chest[0] + 8, chest[1] - 3, chest[1] + 1, st[2]).set(
    chest[0] + 8,
    chest[1] - 4,
    RAMPS.rust[3],
  );
  s.set(chest[0] + 9, chest[1] - 3, st[1]);
  s.set(chest[0] + 6, chest[1] + 3, RAMPS.rust[3]).set(chest[0] + 6, chest[1] + 6, RAMPS.lamp[1]);
  // legs (thick) + exo struts
  const bl: [P, P, P] = [
    [hip[0] + 3, hip[1]],
    [hip[0] + 5, hip[1] + 6],
    [hip[0] + 6, 43],
  ];
  const fl: [P, P, P] = [
    [hip[0] - 2, hip[1]],
    [hip[0] - 5 - lunge * 2, hip[1] + 6],
    [hip[0] - 7 - lunge * 3, 43],
  ];
  limb(s, bl, 2, suit.slice(0, 4), -0.8);
  boot(s, bl[2][0], 43, st.slice(0, 4), -0.5, true);
  limb(s, fl, 2, suit.slice(0, 4), 0);
  for (const [a, b] of [
    [fl[0], fl[1]],
    [fl[1], fl[2]],
  ] as const)
    s.line(a[0] + 2, a[1], b[0] + 2, b[1] - 2, st[3]);
  s.set(fl[1][0] + 2, fl[1][1], st[5]);
  boot(s, fl[2][0], 43, st.slice(0, 4), 0.2, true);
  // back arm
  const ba: [P, P, P] = [
    [chest[0] + 4, chest[1] + 3],
    [chest[0] + 6, chest[1] + 9],
    [chest[0] + 4, chest[1] + 13],
  ];
  limb(s, ba, 1.8, suit.slice(0, 4), -0.8);
  // torso: big, broad
  const tm = torso(s, chest, hip, 5, 5, suit.slice(0, 5), 1);
  // chest harness / reinforced plate
  const plate = new Mask(48, 48);
  tm.each((x, y) => {
    if (y > chest[1] && y < chest[1] + 7 && x < chest[0] + 3) plate.add(x, y);
  });
  shade(s, plate, st.slice(1, 6), { kx: 0.6 });
  s.hline(chest[0] - 5, chest[0] + 2, chest[1] + 7, RAMPS.rust[2]);
  s.set(chest[0] - 3, chest[1] + 2, st[5]).set(chest[0] + 1, chest[1] + 2, st[4]);
  tm.each((x, y) => {
    if (y === hip[1] - 2) s.set(x, y, RAMPS.leather[1]);
    if (y === hip[1] - 1) s.set(x, y, x % 2 ? RAMPS.lamp[2] : RAMPS.leather[0]);
  });
  // gaping wound with toxic glow
  s.set(chest[0] + 3, chest[1] + 9, RAMPS.toxic[3]).set(
    chest[0] + 2,
    chest[1] + 10,
    RAMPS.toxic[2],
  );
  // head
  const hx = chest[0] - 9 - lunge;
  const hy = chest[1] - 10 + lunge;
  s.tpl(hx, hy, FOREMAN_HEAD, {
    y: mix(RAMPS.lamp[2], RAMPS.rust[2], 0.4),
    Y: RAMPS.lamp[3],
    k: RAMPS.rust[1],
    "1": tone(skin, 0),
    "2": tone(skin, 1),
    "3": tone(skin, 2),
    "4": tone(skin, 3),
    g: RAMPS.toxic[4],
    s: RAMPS.toxic[1],
    t: RAMPS.bone[3],
    d: INK,
  });
  s.set(hx + 4, hy + 1, RAMPS.lamp[4]);
  glows.push({ x: hx + 2, y: hy + 4, r: 3, color: RAMPS.toxic[3], strength: 0.6 });
  // shoulder piston
  const sp = new Mask(48, 48).ellipse(chest[0] - 1, chest[1] + 2, 3.5, 2.5);
  contactShadow(s, sp, 0.4);
  shade(s, sp, st.slice(1, 6), {});
  s.hline(chest[0] - 4, chest[0] + 2, chest[1] + 4, RAMPS.rust[3]);
  // front arm with drill
  const fa: [P, P, P] =
    pose === "attack"
      ? [
          [chest[0] - 2, chest[1] + 3],
          [chest[0] - 7, chest[1] + 5],
          [chest[0] - 11, chest[1] + 6],
        ]
      : pose === "hurt"
        ? [
            [chest[0] - 2, chest[1] + 3],
            [chest[0] - 4, chest[1] + 8],
            [chest[0] - 6, chest[1] + 10],
          ]
        : [
            [chest[0] - 2, chest[1] + 3],
            [chest[0] - 5, chest[1] + 8],
            [chest[0] - 8, chest[1] + 10],
          ];
  const am = limb(s, fa, 1.9, suit.slice(0, 4), 0);
  contactShadow(s, am, 0.45);
  limb(s, fa, 1.9, suit.slice(0, 4), 0);
  s.line(fa[0][0], fa[0][1] - 1, fa[1][0], fa[1][1] - 1, st[3]);
  const drill = tplSpr(
    [
      "kkkkkk..........",
      "kmMMMmrkk.......",
      "knmmmmrMmnk.....",
      "knnmmmrmMnMnnk..",
      "knnnnnrnmnmnnkkk",
      "knnnnnrkkkk.....",
      "kkkkkk..........",
    ],
    { ...wmap() },
  );
  const ang = pose === "hurt" ? 160 : pose === "attack" ? 180 : 170;
  blitRot(s, drill, 2, 3, ang, fa[2][0], fa[2][1]);
  if (pose === "attack") {
    const tip = rotPt(2, 3, ang, fa[2][0], fa[2][1], [16, 4], true);
    for (const [ddx, ddy] of [
      [-1, -2],
      [-2, 1],
      [0, 2],
      [-3, -1],
      [1, -3],
    ] as const)
      s.set(tip[0] + ddx, tip[1] + ddy, RAMPS.lamp[4]);
    glows.push({ x: tip[0], y: tip[1], r: 6, color: RAMPS.lamp[3], strength: 0.55 });
  }
  return { s, glows };
}

// ============================================================================================
// Gloam crawler
// ============================================================================================

const CHITIN = ["#0b0912", "#171126", "#251a3f", "#36285a", "#4c3d78", "#6a5a9a"] as const;

function drawCrawler(pose: EnemyPose): Comp {
  const s = new Spr(48, 48);
  const glows: Glow[] = [];
  const { bob, lunge, recoil } = poseDelta(pose);
  const dx = -lunge * 3 + recoil * 3;
  const rear = lunge * 3 - recoil;
  const ty = 33 + bob; // thorax centre y
  const tx = 20 + dx;
  // [attach dx, knee x, knee y, foot x, foot y] relative to the thorax (near side)
  const legs: [number, number, number, number, number][] = [
    [-3, -10, -10, -17, 10],
    [-1, -4, -12, -10, 10],
    [1, 6, -12, 10, 10],
    [3, 13, -9, 21, 10],
  ];
  const legPass = (far: boolean) => {
    legs.forEach(([ax, kx, ky, fx, fy], i) => {
      const off = far ? 2 : 0;
      const wob = pose === "idle1" ? (i % 2 ? 1 : -1) : 0;
      let k: P = [tx + kx + off, ty + ky + bob * 0 - (far ? 1 : 0) + wob];
      let f: P = [tx + fx + off + (far ? 1 : 0), Math.min(43, ty + fy)];
      if (pose === "attack" && i < 2) {
        // front legs raised to strike
        k = [tx + kx + 2 + off, ty + ky - 5 - i];
        f = [tx + fx + 4 + i * 3 + off, ty + ky + 3 - i * 4];
      }
      if (pose === "hurt") {
        k = [k[0] + (i < 2 ? -1 : 1), k[1] + 2];
        f = [f[0] + (i < 2 ? -2 : 2), f[1]];
      }
      const a: P = [tx + ax + off, ty - (i < 2 ? Math.max(0, rear) : 0)];
      const m = new Mask(48, 48);
      m.capsule(a[0], a[1], k[0], k[1], 1.25, 0.9);
      m.capsule(k[0], k[1], f[0], f[1], 0.85, 0.35);
      shade(s, m, CHITIN.slice(0, 5), { bias: far ? -1.3 : 0.1, kx: 0.6 });
      // knee joint highlight
      s.set(k[0], k[1] - 1, far ? CHITIN[2] : CHITIN[5]);
    });
  };
  legPass(true);
  // abdomen: big, raised, striped
  const ax = 32 + dx;
  const ay = ty - 5 + Math.round(rear / 2);
  const ab = new Mask(48, 48).ellipse(ax, ay, 8.5, 7);
  shade(s, ab, CHITIN.slice(0, 6), { kx: 0.5 });
  for (const off of [-3, 1, 5]) {
    for (const [x, y] of arcPts(ax + off - 10, ay, 10, -40, 40))
      if (ab.has(x, y)) s.blend(x, y, INK, 0.45);
  }
  // pedicel + cephalothorax
  const th = new Mask(48, 48).ellipse(tx, ty - Math.round(rear / 2), 5.5, 3.8);
  contactShadow(s, th, 0.45);
  shade(s, th, CHITIN.slice(0, 6), { kx: 0.55, bias: 0.2 });
  // head
  const hx = tx - 6;
  const hy = ty - rear + (pose === "hurt" ? -2 : 0);
  const hm = new Mask(48, 48).ellipse(hx, hy, 3.2, 2.7);
  contactShadow(s, hm, 0.45);
  shade(s, hm, CHITIN.slice(1, 6), { kx: 0.55, bias: 0.3 });
  // fangs (chelicerae)
  const open = pose === "attack" ? 1 : 0;
  const B = RAMPS.bone;
  s.set(hx - 3, hy + 2, CHITIN[3])
    .set(hx - 4, hy + 3 + open, B[3])
    .set(hx - 4, hy + 4 + open, B[2]);
  s.set(hx - 1, hy + 3, CHITIN[2])
    .set(hx - 2, hy + 4, B[2])
    .set(hx - 2, hy + 5, B[1]);
  if (open) s.set(hx - 5, hy + 2, B[4]);
  // near legs
  legPass(false);
  // eye cluster + bioluminescent markings
  const C = RAMPS.crystal;
  const eyes: P[] = [
    [hx - 2, hy - 1],
    [hx - 1, hy - 2],
    [hx, hy - 1],
  ];
  for (const [x, y] of eyes) s.set(x, y, C[5]);
  glows.push({ x: hx - 1, y: hy - 1, r: 4, color: C[4], strength: 0.6 });
  const dots: P[] = [
    [ax - 4, ay - 4],
    [ax, ay - 6],
    [ax + 4, ay - 4],
    [ax - 1, ay - 1],
    [ax + 3, ay],
  ];
  dots.forEach(([x, y], i) => {
    s.set(x, y, i < 3 ? C[4] : C[3]);
    glows.push({ x, y, r: 2.5, color: C[4], strength: 0.35 });
  });
  // spinnerets / abdomen tip
  s.set(ax + 8, ay + 2, CHITIN[3]).set(ax + 9, ay + 3, CHITIN[2]);
  return { s, glows };
}

// ============================================================================================
// Void wisp
// ============================================================================================

function drawWisp(pose: EnemyPose): Comp {
  const s = new Spr(48, 48);
  const glows: Glow[] = [];
  const { bob, lunge, recoil } = poseDelta(pose);
  const U = RAMPS.umbra;
  const cx = 24 - lunge * 5 + recoil * 4;
  const cy = 21 + bob - lunge;
  const rng = artRng(77);
  // tendrils (behind)
  const ten = new Mask(48, 48);
  for (let i = 0; i < 5; i++) {
    const bx = cx - 5 + i * 2.5;
    const sway = (pose === "idle1" ? 1 : -1) * (i % 2 ? 1 : -1);
    const back = lunge * 3 - recoil * 2;
    const pts: P[] = [
      [bx, cy + 4],
      [bx + 2 + sway + back, cy + 10],
      [bx + 1 - sway + back * 2, cy + 15],
      [bx + 3 + sway + back * 3, cy + 19 - (i % 2) * 2],
    ];
    ten.chain(pts, [1.6, 1.1, 0.8, 0.4]);
  }
  shade(s, ten, [U[0], U[1], U[1], U[2]], { kx: 0.4 });
  // body: lumpy cloud of darkness
  const body = new Mask(48, 48);
  const sx = pose === "attack" ? 1.25 : pose === "hurt" ? 0.85 : 1;
  body.ellipse(cx, cy, 8 * sx, 7);
  for (let i = 0; i < 9; i++) {
    const a = (i / 9) * Math.PI * 2 + rng() * 0.4;
    const rr = 6 + rng() * 2;
    body.ellipse(
      cx + Math.cos(a) * rr * sx,
      cy + Math.sin(a) * rr * 0.85,
      2.5 + rng() * 1.2,
      2.2 + rng(),
    );
  }
  shade(s, body, [U[0], U[1], U[1], U[2], U[3]], { kx: 0.5 });
  // inner swirl
  for (const [x, y] of arcPts(cx, cy, 4.5, 200, 320)) s.set(x, y, U[3]);
  for (const [x, y] of arcPts(cx, cy, 5.5, 20, 120)) s.set(x, y, U[2]);
  // core
  const coreR = pose === "attack" ? 3 : pose === "hurt" ? 1.5 : 2.5;
  const core = new Mask(48, 48).disc(cx - 1, cy, coreR);
  shade(s, core, [U[3], U[4], U[5]], { kx: 0.5, bias: 0.5 });
  s.set(cx - 1, cy, "#ffffff");
  if (pose !== "hurt") s.set(cx - 2, cy - 1, "#ffffff");
  // motes
  const motes: P[] = [
    [cx - 11, cy - 6 + bob],
    [cx + 10, cy - 8 - bob],
    [cx + 12, cy + 3],
    [cx - 9, cy + 8 - bob],
  ];
  for (const [x, y] of motes) s.set(x, y, U[4]);
  if (pose === "attack") {
    // void lash reaching forward
    const m = new Mask(48, 48).chain(
      [
        [cx - 7, cy + 1],
        [cx - 12, cy - 1],
        [cx - 16, cy + 2],
        [cx - 19, cy + 1],
      ],
      [1.8, 1.3, 0.9, 0.4],
    );
    shade(s, m, [U[1], U[2], U[3], U[4]], { kx: 0.5 });
  }
  if (pose === "hurt") {
    for (const [x, y] of [
      [cx + 10, cy - 3],
      [cx + 12, cy + 1],
      [cx + 9, cy + 5],
    ] as const)
      s.set(x, y, U[2]).set(x + 1, y, U[1]);
  }
  glows.push({
    x: cx - 1,
    y: cy,
    r: pose === "attack" ? 16 : 12,
    color: U[3],
    strength: pose === "hurt" ? 0.3 : 0.5,
  });
  glows.push({ x: cx - 1, y: cy, r: 5, color: U[5], strength: pose === "hurt" ? 0.35 : 0.6 });
  return { s, glows, shadow: { cx: cx, rx: 7, y: 43, alpha: 0.55 } };
}

// ============================================================================================
// Shardback
// ============================================================================================

function crystal(s: Spr, base: P, tip: P, w: number, glows: Glow[], bright = false): void {
  const C = RAMPS.crystal;
  const nx = -(tip[1] - base[1]);
  const ny = tip[0] - base[0];
  const len = Math.hypot(nx, ny) || 1;
  const ox = (nx / len) * w;
  const oy = (ny / len) * w;
  const left = new Mask(s.w, s.h).poly([
    [base[0] - ox, base[1] - oy],
    [tip[0], tip[1]],
    [base[0], base[1]],
  ]);
  const right = new Mask(s.w, s.h).poly([
    [base[0], base[1]],
    [tip[0], tip[1]],
    [base[0] + ox, base[1] + oy],
  ]);
  const lf = ox > 0 ? right : left;
  const rf = ox > 0 ? left : right;
  fill(s, rf, C[2]);
  fill(s, lf, C[3]);
  // central ridge highlight
  for (const [x, y] of linePts(base[0], base[1], tip[0], tip[1])) s.set(x, y, C[4]);
  s.set(tip[0], tip[1], C[5]);
  if (bright) glows.push({ x: tip[0], y: tip[1] + 2, r: 5, color: C[4], strength: 0.35 });
}

function drawShardback(pose: EnemyPose): Comp {
  const s = new Spr(48, 48);
  const glows: Glow[] = [];
  const { bob, lunge, recoil } = poseDelta(pose);
  const dx = -lunge * 3 + recoil * 3;
  const R = RAMPS.rock;
  const shellRamp = [R[1], R[2], R[3], R[4], R[5]];
  const cy = 34 + bob;
  const tilt = recoil ? -1 : lunge ? 1 : 0;
  // far legs
  for (const lx of [17, 33]) {
    const m = new Mask(48, 48).rect(lx + dx + 2, cy + 3, 3, 43 - cy - 2);
    shade(s, m, shellRamp.slice(0, 3), { bias: -1 });
  }
  // crystals first (they sit in the shell)
  const crys: [number, number, number, number][] = [
    [16, -2, -5, 2],
    [21, -4, -10, 2.4],
    [27, -4, -12, 2.6],
    [32, -3, -8, 2.2],
    [36, -1, -5, 1.8],
  ];
  crys.forEach(([x, by, h, w], i) => {
    const flare = pose === "attack" ? 2 : 0;
    const base: P = [x + dx, cy - 6 + by + (i < 2 ? tilt : -tilt)];
    const tip: P = [x + dx + 2 + Math.round(i * 0.6), cy - 6 + by + h - flare];
    crystal(s, base, tip, w, glows, i === 2);
  });
  // shell dome
  const shell = new Mask(48, 48).ellipse(26 + dx, cy, 14, 8);
  shell.each((x, y) => {
    if (y > cy + 4) shell.del(x, y);
  });
  shade(s, shell, shellRamp, { kx: 0.5 });
  // plate seams
  const seam = (x0: number, y0: number, x1: number, y1: number) => {
    for (const [x, y] of linePts(x0 + dx, y0, x1 + dx, y1)) if (shell.has(x, y)) s.set(x, y, R[1]);
  };
  seam(17, cy - 2, 21, cy - 6);
  seam(21, cy - 6, 30, cy - 7);
  seam(30, cy - 7, 36, cy - 3);
  seam(19, cy + 3, 24, cy - 1);
  seam(24, cy - 1, 31, cy - 1);
  seam(31, cy - 1, 35, cy + 3);
  // crystal shards embedded at the rim
  s.set(14 + dx, cy + 1, RAMPS.crystal[4]).set(37 + dx, cy + 2, RAMPS.crystal[3]);
  // belly rim
  for (let x = 12; x <= 40; x++) if (shell.has(x + dx, cy + 4)) s.set(x + dx, cy + 4, R[0]);
  // near legs
  for (const lx of [14, 30]) {
    const m = new Mask(48, 48).rect(lx + dx, cy + 3, 4, 43 - cy - 2);
    m.span(43, lx + dx - 1, lx + dx + 4);
    shade(s, m, shellRamp.slice(0, 4), { bias: 0 });
    s.set(lx + dx - 1, 43, R[4]).set(lx + dx + 1, 43, R[4]);
  }
  // head: armored, beaked
  const hx = 10 + dx - lunge * 2 + recoil;
  const hy = cy + 1 + lunge * 2 - recoil;
  const hm = new Mask(48, 48).ellipse(hx, hy, 4, 3);
  hm.add(hx - 5, hy + 1)
    .add(hx - 5, hy + 2)
    .add(hx - 4, hy + 2)
    .add(hx - 4, hy + 3);
  contactShadow(s, hm, 0.4);
  shade(s, hm, shellRamp, { kx: 0.55, bias: 0.3 });
  s.hline(hx - 2, hx + 3, hy - 3, R[5]);
  s.set(hx - 2, hy, RAMPS.crystal[5]);
  glows.push({ x: hx - 2, y: hy, r: 2.5, color: RAMPS.crystal[4], strength: 0.6 });
  if (pose === "attack") {
    glows.push({ x: 27 + dx, y: cy - 12, r: 14, color: RAMPS.crystal[3], strength: 0.4 });
  }
  if (pose === "hurt") {
    s.set(33 + dx, cy - 16, RAMPS.crystal[4])
      .set(36 + dx, cy - 13, RAMPS.crystal[3])
      .set(38 + dx, cy - 17, RAMPS.crystal[5]);
  }
  return { s, glows };
}

// ============================================================================================
// Rival scavengers (reuse the merc renderer with hostile looks)
// ============================================================================================

const SCAV_CUTTER: MercLook = {
  discipline: "reaver",
  body: 1,
  skin: 4,
  hair: 2,
  hairColor: 4,
  primary: 1,
  secondary: 6,
  headgear: 3,
  marking: 2,
  armor: "medium",
  lamp: "none",
  weaponTier: 0,
};

const SCAV_GUNNER: MercLook = {
  discipline: "gunner",
  body: 2,
  skin: 1,
  hair: 7,
  hairColor: 0,
  primary: 6,
  secondary: 1,
  headgear: 2,
  marking: 1,
  armor: "light",
  lamp: "oil",
  weaponTier: 0,
};

// ============================================================================================
// Umbral stalker
// ============================================================================================

const SHADE_RAMP = ["#07060b", "#0f0a18", "#1a1029", "#28183d", "#3a2456"] as const;

function drawStalker(pose: EnemyPose): Comp {
  const s = new Spr(48, 48);
  const glows: Glow[] = [];
  const { bob, lunge, recoil } = poseDelta(pose);
  const dx = -lunge * 3 + recoil * 3;
  const rear = lunge ? 4 : recoil ? 2 : 0;
  const hip: P = [34 + dx, 28 + bob];
  const sh: P = [21 + dx, 23 + bob - rear];
  const R = SHADE_RAMP;
  // tail (whip)
  const tail = new Mask(48, 48).chain(
    [
      [hip[0] + 2, hip[1] - 1],
      [hip[0] + 7, hip[1] - 4 - bob],
      [hip[0] + 11, hip[1] - 2],
      [hip[0] + 13, hip[1] - 6 + bob],
    ],
    [1.5, 1, 0.7, 0.3],
  );
  shade(s, tail, R.slice(0, 4), { kx: 0.4 });
  const hindLeg = (off: number, far: boolean) => {
    const m = new Mask(48, 48);
    const knee: P = [hip[0] + 4 + off, hip[1] + 6];
    const hock: P = [hip[0] + 1 + off - lunge, hip[1] + 11];
    const foot: P = [hip[0] + 2 + off - lunge * 2, 43];
    m.chain([[hip[0] + off, hip[1] + 1], knee, hock, foot], [2.6, 1.4, 0.9, 0.7]);
    shade(s, m, R, { bias: far ? -1.2 : 0.2 });
    s.set(foot[0] - 1, 43, far ? R[2] : RAMPS.bone[2]).set(
      foot[0] - 2,
      43,
      far ? R[1] : RAMPS.bone[1],
    );
  };
  // Forelimb ending in a mantis scythe. mode: 0 planted, 1 slash, 2 guard
  const scythe = (off: number, far: boolean, mode: number) => {
    const top: P = [sh[0] + 1 + off, sh[1] + 2];
    let elbow: P;
    let blade: P[];
    if (mode === 1) {
      elbow = [sh[0] - 5 + off, sh[1] - 6];
      blade = [
        [elbow[0] - 4, elbow[1] - 1],
        [elbow[0] - 8, elbow[1] + 3],
        [elbow[0] - 9, elbow[1] + 9],
      ];
    } else if (mode === 2) {
      elbow = [sh[0] - 1 + off, sh[1] - 7];
      blade = [
        [elbow[0] - 2, elbow[1] - 4],
        [elbow[0] + 1, elbow[1] - 8],
        [elbow[0] + 4, elbow[1] - 9],
      ];
    } else {
      elbow = [sh[0] + 2 + off, sh[1] + 10];
      const wrist: P = [sh[0] - 1 + off, 41];
      blade = [wrist, [wrist[0] - 4, 42], [wrist[0] - 8, 41], [wrist[0] - 10, 39]];
    }
    const arm = new Mask(48, 48).chain([top, elbow], [2, 1.3]);
    if (!far) contactShadow(s, arm, 0.4);
    shade(s, arm, R, { kx: 0.5, bias: far ? -1.2 : 0.3 });
    const bl = new Mask(48, 48).chain([elbow, ...blade], [1.3, 1.1, 0.9, 0.5, 0.3]);
    shade(s, bl, R.slice(1, 5), { kx: 0.5, bias: far ? -1 : 0.5 });
    if (far) return;
    // bright cutting edge along the inner curve
    let prev = elbow;
    for (const b of blade) {
      for (const [x, y] of linePts(prev[0], prev[1], b[0], b[1])) {
        const ey = mode === 0 ? y - 1 : y + 1;
        if (bl.has(x, ey) && !arm.has(x, ey)) s.set(x, ey, RAMPS.umbra[4]);
      }
      prev = b;
    }
    const tip = blade[blade.length - 1] as P;
    s.set(tip[0], tip[1], RAMPS.umbra[5]);
    if (mode === 1) {
      const pts = arcPts(elbow[0], elbow[1] + 2, 12, -130, -250);
      pts.forEach(([x, y], i) => {
        if (!s.has(x, y))
          s.set(x, y, i > pts.length * 0.6 ? RAMPS.umbra[5] : i % 2 ? RAMPS.umbra[3] : "");
      });
    }
  };
  hindLeg(2, true);
  scythe(3, true, pose === "hurt" ? 2 : 0);
  // body: low hindquarters, heavy shoulder hump
  const mid: P = [Math.round((hip[0] + sh[0]) / 2), Math.round((hip[1] + sh[1]) / 2) + 2];
  const body = new Mask(48, 48).chain([hip, mid, sh], [3, 2.6, 4.2]);
  shade(s, body, R, { kx: 0.35 });
  // ribs
  for (let i = 0; i < 3; i++) s.set(mid[0] - 2 + i * 2, mid[1] + 1, R[3]);
  // mane of spines along the back
  for (let x = sh[0] - 2; x <= hip[0] - 1; x += 2) {
    let y = 0;
    while (y < 47 && !body.has(x, y)) y++;
    const len = x < mid[0] ? 4 : 2;
    s.line(x, y - 1, x + 2, y - len, R[3]).set(x + 2, y - len, R[4]);
  }
  hindLeg(0, false);
  // head: long skull held low and forward
  const hb: P = [sh[0] - 3, sh[1] + 1];
  const hc: P = [sh[0] - 8 - lunge * 2, sh[1] + 3 + lunge - recoil * 2];
  const sn: P = [hc[0] - 5, hc[1] + 2];
  const neck = new Mask(48, 48).chain([hb, hc], [2.8, 2.4]);
  shade(s, neck, R, { kx: 0.4 });
  const head = new Mask(48, 48).chain([hc, sn], [2.4, 0.9]);
  contactShadow(s, head, 0.35);
  shade(s, head, R, { kx: 0.5, bias: 0.5 });
  const open = pose === "attack" ? 2 : pose === "hurt" ? 1 : 0;
  if (open) {
    const jaw = new Mask(48, 48).capsule(hc[0] + 1, hc[1] + 3, sn[0] + 1, sn[1] + 1 + open, 1, 0.5);
    shade(s, jaw, R, { bias: -0.3 });
    for (let x = sn[0] + 1; x <= hc[0]; x++) s.set(x, sn[1] + Math.round(open / 2), INK);
    s.set(sn[0] + 1, sn[1], RAMPS.bone[4]).set(sn[0] + 3, sn[1], RAMPS.bone[3]);
    s.set(sn[0] + 2, sn[1] + open, RAMPS.bone[3]);
  } else {
    s.set(sn[0] + 1, sn[1] + 1, RAMPS.bone[3]).set(sn[0] + 3, sn[1] + 1, RAMPS.bone[2]);
  }
  // swept-back horns
  s.line(hc[0] + 1, hc[1] - 2, hc[0] + 6, hc[1] - 5, R[3]).set(hc[0] + 7, hc[1] - 6, R[4]);
  s.line(hc[0] + 2, hc[1] - 1, hc[0] + 6, hc[1] - 3, R[2]);
  // eyes
  s.set(hc[0] - 2, hc[1] - 1, "#ffffff").set(hc[0] - 1, hc[1] - 1, RAMPS.umbra[5]);
  s.set(hc[0] + 1, hc[1] - 1, RAMPS.umbra[4]);
  glows.push({ x: hc[0] - 1, y: hc[1] - 1, r: 4, color: RAMPS.umbra[5], strength: 0.75 });
  scythe(0, false, pose === "attack" ? 1 : pose === "hurt" ? 2 : 0);
  return { s, glows };
}

// ============================================================================================
// Mycelid tender
// ============================================================================================

function drawMycelid(pose: EnemyPose): Comp {
  const s = new Spr(48, 48);
  const glows: Glow[] = [];
  const { bob, lunge, recoil } = poseDelta(pose);
  const T = RAMPS.toxic;
  const B = RAMPS.bone;
  const lean = -lunge * 3 + recoil * 3;
  const base: P = [25, 39];
  const top: P = [22 + lean, 22 + bob + lunge];
  // roots
  const roots: P[][] = [
    [base, [20, 41], [16, 42], [13, 43]],
    [base, [23, 42], [21, 43]],
    [base, [28, 41], [31, 43], [34, 43]],
    [base, [30, 40], [35, 41], [38, 43]],
  ];
  roots.forEach((pts, i) => {
    const m = new Mask(48, 48).chain(pts, [2, 1.3, 0.8, 0.5]);
    shade(s, m, RAMPS.leather.slice(0, 4), { bias: i === 1 || i === 3 ? -0.8 : 0 });
  });
  // back arm (tendril)
  const armB = new Mask(48, 48).chain(
    [
      [top[0] + 2, top[1] + 6],
      [top[0] + 6, top[1] + 10],
      [top[0] + 7, top[1] + 14 - bob],
    ],
    [1, 0.8, 0.5],
  );
  shade(s, armB, B.slice(0, 4), { bias: -1 });
  // stalk
  const stalk = new Mask(48, 48).chain(
    [base, [Math.round((base[0] + top[0]) / 2) + 1, 31], top],
    [3.6, 3, 2.8],
  );
  shade(s, stalk, mixRamp([B[0], B[1], B[2], B[3]], RAMPS.toxic, 0.18), { kx: 0.7 });
  // fibrous streaks
  for (let y = top[1] + 7; y < base[1] - 1; y += 3)
    s.set(base[0] + 1 - Math.round((base[1] - y) / 6), y, B[0]);
  // ring (annulus) + gill skirt
  for (let x = top[0] - 4; x <= top[0] + 4; x++) {
    s.set(x, top[1] + 5, B[2]);
    if ((x + 1) % 2) s.set(x, top[1] + 6, B[1]);
  }
  // face: two hollow eyes and a slit mouth on the stalk
  const fx = top[0] - 2;
  const fy = top[1] + 2;
  s.set(fx, fy, T[5])
    .set(fx + 2, fy, T[4])
    .set(fx + 1, fy + 2, B[0])
    .set(fx, fy + 2, B[1]);
  glows.push({ x: fx + 1, y: fy, r: 3, color: T[4], strength: 0.5 });
  // cap
  const capY = top[1] - 3 + (pose === "attack" ? -1 : 0);
  const cap = new Mask(48, 48).ellipse(top[0], capY, 11 + (pose === "attack" ? 1 : 0), 7);
  cap.each((x, y) => {
    if (y > capY + 2) cap.del(x, y);
  });
  // droopy brim
  cap.span(capY + 3, top[0] - 10, top[0] - 7).span(capY + 3, top[0] + 7, top[0] + 10);
  shade(s, cap, [T[0], T[1], T[2], T[3]], { kx: 0.5 });
  // glowing lower lip of the cap
  cap.each((x, y) => {
    if (!cap.has(x, y + 1)) s.set(x, y, T[4]);
  });
  // gills (glowing underside)
  for (let x = top[0] - 8; x <= top[0] + 8; x++) {
    s.set(x, capY + 3, x % 2 ? T[2] : T[1]);
    if (x % 3 === 0) s.set(x, capY + 4, T[3]);
  }
  // spots
  for (const [x, y] of [
    [-5, -4],
    [-1, -5],
    [4, -3],
    [7, 0],
    [-8, 0],
    [1, -1],
  ] as const) {
    s.set(top[0] + x, capY + y, T[5]);
    if (x % 2 === 0) s.set(top[0] + x + 1, capY + y, B[5]);
  }
  // mottling + dripping slime strands under the brim
  for (const [x, y] of [
    [-7, -2],
    [-3, -3],
    [2, -5],
    [5, -1],
    [-9, 1],
  ] as const)
    s.set(top[0] + x, capY + y, T[1]);
  for (const x of [-9, -4, 6, 9]) {
    s.set(top[0] + x, capY + 4, T[3]);
    if (x % 2) s.set(top[0] + x, capY + 5 + bob, T[2]);
  }
  glows.push({
    x: top[0],
    y: capY + 3,
    r: 14,
    color: T[3],
    strength: pose === "attack" ? 0.45 : 0.28,
  });
  // front arm holding a little spore censer
  const ax = top[0] - 4 - lunge * 3;
  const armF = new Mask(48, 48).chain(
    [
      [top[0] - 1, top[1] + 6],
      [top[0] - 4, top[1] + 9],
      [ax - 2, top[1] + 11 - lunge * 4],
    ],
    [1.1, 0.9, 0.6],
  );
  contactShadow(s, armF, 0.35);
  shade(s, armF, B.slice(1, 5), { kx: 0.6 });
  // spores
  const rng = artRng(pose === "idle1" ? 31 : pose === "attack" ? 57 : 13);
  const spores = pose === "attack" ? 14 : 7;
  for (let i = 0; i < spores; i++) {
    let x: number;
    let y: number;
    if (pose === "attack") {
      x = Math.round(top[0] - 8 - rng() * 14);
      y = Math.round(capY - 2 + rng() * 14);
    } else {
      x = Math.round(top[0] - 13 + rng() * 26);
      y = Math.round(capY - 8 + rng() * 22);
    }
    if (s.has(x, y)) continue;
    s.set(x, y, rng() > 0.5 ? T[5] : T[4]);
    if (i % 3 === 0) glows.push({ x, y, r: 2, color: T[4], strength: 0.4 });
  }
  return { s, glows };
}

// ============================================================================================
// Maw tendril (boss add)
// ============================================================================================

const FLESH = ["#12060f", "#24091e", "#3f1230", "#5f1f45", "#86355e", "#b05a7c"] as const;

function tentacle(
  s: Spr,
  pts: readonly P[],
  radii: readonly number[],
  ramp: readonly string[],
  bands = true,
): Mask {
  const m = new Mask(s.w, s.h).chain(pts, radii);
  shade(s, m, ramp, { kx: 0.6 });
  if (bands) {
    // ring bands along the length
    let acc = 0;
    for (let i = 0; i + 1 < pts.length; i++) {
      const a = pts[i] as P;
      const b = pts[i + 1] as P;
      const seg = linePts(a[0], a[1], b[0], b[1]);
      for (const [x, y] of seg) {
        acc++;
        if (acc % 4 !== 0) continue;
        const dxv = b[0] - a[0];
        const dyv = b[1] - a[1];
        const l = Math.hypot(dxv, dyv) || 1;
        const nx = -dyv / l;
        const ny = dxv / l;
        const r = (radii[i] ?? 1) + 1;
        for (let t = -r; t <= r; t += 0.5) {
          const px = Math.round(x + nx * t);
          const py = Math.round(y + ny * t);
          if (m.has(px, py)) s.blend(px, py, INK, 0.3);
        }
      }
    }
  }
  return m;
}

function drawMawTendril(pose: EnemyPose): Comp {
  const s = new Spr(48, 48);
  const glows: Glow[] = [];
  const { bob } = poseDelta(pose);
  const pts: P[] =
    pose === "attack"
      ? [
          [27, 44],
          [28, 37],
          [25, 29],
          [19, 24],
          [12, 22],
          [6, 24],
        ]
      : pose === "hurt"
        ? [
            [27, 44],
            [29, 37],
            [31, 30],
            [31, 23],
            [34, 18],
            [37, 16],
          ]
        : [
            [27, 44],
            [28, 37],
            [25 - bob, 30],
            [21 - bob, 23],
            [22 - bob, 16 + bob],
            [26 - bob, 12 + bob],
          ];
  const radii = [4.5, 3.8, 3.2, 2.6, 2, 1.4];
  const m = tentacle(s, pts, radii, FLESH.slice(0, 6));
  // suckers on the inner (left/lower) side
  for (let i = 1; i < pts.length - 1; i++) {
    const p = pts[i] as P;
    const q = pts[i + 1] as P;
    const dxv = q[0] - p[0];
    const dyv = q[1] - p[1];
    const l = Math.hypot(dxv, dyv) || 1;
    const nx = dyv / l;
    const ny = -dxv / l;
    const sx = Math.round(p[0] - nx * ((radii[i] ?? 2) - 0.5));
    const sy = Math.round(p[1] - ny * ((radii[i] ?? 2) - 0.5));
    if (m.has(sx, sy)) s.set(sx, sy, FLESH[5]).set(sx, sy + 1, FLESH[2]);
  }
  // glowing lure tip
  const tip = pts[pts.length - 1] as P;
  const lure = new Mask(48, 48).disc(tip[0], tip[1], pose === "hurt" ? 1.5 : 2.2);
  shade(s, lure, [RAMPS.lamp[3], RAMPS.lamp[4], RAMPS.lamp[5]], { bias: 0.5 });
  s.set(tip[0], tip[1], "#ffffff");
  glows.push({
    x: tip[0],
    y: tip[1],
    r: pose === "attack" ? 10 : 8,
    color: RAMPS.lamp[3],
    strength: pose === "hurt" ? 0.35 : 0.6,
  });
  // broken ground at the base
  const g = new Mask(48, 48);
  g.poly([
    [18, 44],
    [21, 40],
    [24, 41],
    [27, 39],
    [31, 40],
    [34, 42],
    [37, 44],
  ]);
  g.sub(m);
  g.each((x, y) => {
    if (y > 43) g.del(x, y);
  });
  shade(s, g, RAMPS.rock.slice(1, 6), { kx: 0.5 });
  s.set(23, 41, RAMPS.rock[1]).set(32, 41, RAMPS.rock[1]);
  return { s, glows };
}

// ============================================================================================
// Lumen Eater (boss, 96x96)
// ============================================================================================

function drawLumenEater(pose: EnemyPose): Comp {
  const S = 96;
  const s = new Spr(S, S);
  const glows: Glow[] = [];
  const { bob, lunge, recoil } = poseDelta(pose);
  const L = RAMPS.lamp;
  const U = RAMPS.umbra;
  const ch = CHITIN;
  // spine path from the ground up to the head
  const hx = 40 - lunge * 7 + recoil * 6;
  const hy = 38 + bob + lunge * 5 - recoil * 4;
  const spine: P[] = [
    [64, 94],
    [67, 82],
    [66, 70],
    [62, 59],
    [55 - lunge * 3 + recoil * 2, 50 + bob],
    [hx + 8, hy + 2],
  ];
  // back tendrils (void)
  const tendril = (pts: P[], rad: number[]) => {
    const m = new Mask(S, S).chain(pts, rad);
    shade(s, m, [U[0], U[1], U[1], U[2], U[3]], { kx: 0.5 });
  };
  const sw = pose === "idle1" ? 2 : 0;
  tendril(
    [
      [70, 86],
      [80, 78],
      [86, 70 + sw],
      [91, 66 + sw],
    ],
    [2.5, 1.8, 1.2, 0.5],
  );
  tendril(
    [
      [66, 66],
      [76, 58 - sw],
      [80, 48],
      [86, 44 - sw],
    ],
    [2.5, 1.8, 1.2, 0.5],
  );
  // body segments, base -> head
  const segs = 9;
  for (let i = 0; i < segs; i++) {
    const t = i / (segs - 1);
    const f = t * (spine.length - 1);
    const k = Math.min(spine.length - 2, Math.floor(f));
    const u = f - k;
    const a = spine[k] as P;
    const b = spine[k + 1] as P;
    const x = a[0] + (b[0] - a[0]) * u;
    const y = a[1] + (b[1] - a[1]) * u;
    const r = 15 - t * 3;
    const m = new Mask(S, S).ellipse(x, y, r, r * 0.8);
    contactShadow(s, m, 0.5);
    shade(s, m, ch.slice(0, 6), { kx: 0.55 });
    // plate edge (lower) + back ridge spikes
    m.each((px, py) => {
      if (!m.has(px, py + 1)) s.set(px, py, ch[0]);
    });
    const sx = Math.round(x + r * 0.75);
    const sy = Math.round(y - r * 0.55);
    s.line(sx, sy, sx + 4, sy - 3, ch[3]).set(sx + 5, sy - 4, ch[5]);
    s.set(sx + 1, sy, ch[1]);
    // faint bioluminescent seam
    if (i % 2 === 0) s.set(Math.round(x - r * 0.3), Math.round(y - r * 0.55), RAMPS.crystal[3]);
  }
  // rubble mound at the base
  const mound = new Mask(S, S).poly([
    [36, 95],
    [42, 86],
    [50, 84],
    [56, 87],
    [62, 83],
    [74, 84],
    [82, 88],
    [90, 95],
  ]);
  mound.each((x, y) => {
    if (y > 91) mound.del(x, y);
  });
  shade(s, mound, RAMPS.rock.slice(1, 6), { kx: 0.5 });
  const rk = artRng(5);
  for (let i = 0; i < 18; i++) {
    const x = Math.round(38 + rk() * 50);
    const y = Math.round(86 + rk() * 5);
    if (mound.has(x, y)) s.set(x, y, rk() > 0.5 ? RAMPS.rock[5] : RAMPS.rock[1]);
  }
  for (const [x, y, w] of [
    [33, 90, 3],
    [88, 89, 2],
    [44, 83, 2],
  ] as const) {
    const m = new Mask(S, S).ellipse(x, y, w, w * 0.7);
    shade(s, m, RAMPS.rock.slice(1, 6), {});
  }
  // head
  const head = new Mask(S, S).ellipse(hx + 6, hy, 14, 17);
  contactShadow(s, head, 0.5);
  shade(s, head, ch.slice(0, 6), { kx: 0.6 });
  // crown plates / horns
  for (const [ox, oy, tx, ty] of [
    [8, -15, 14, -22],
    [12, -11, 20, -15],
    [2, -16, 4, -24],
  ] as const) {
    const m = new Mask(S, S).capsule(hx + ox, hy + oy, hx + tx, hy + ty, 2, 0.6);
    shade(s, m, ch.slice(1, 6), { bias: 0.4 });
  }
  // mouth: a huge ring facing left
  const mx = hx - 1;
  const my = hy + 1;
  const mrx = pose === "attack" ? 9 : pose === "hurt" ? 6 : 8;
  const mry = pose === "attack" ? 16 : pose === "hurt" ? 11 : 14;
  const lip = new Mask(S, S).ellipse(mx, my, mrx + 2, mry + 2);
  shade(s, lip, FLESH.slice(1, 6), { kx: 0.6, bias: 0.2 });
  const throat = new Mask(S, S).ellipse(mx, my, mrx, mry);
  // concentric light rings (stolen lamp light)
  const dim = pose === "hurt" ? 1 : 0;
  throat.each((x, y) => {
    const d = Math.hypot((x - mx + 2) / mrx, (y - my) / mry);
    const idx = d > 0.85 ? 1 : d > 0.65 ? 2 : d > 0.42 ? 3 : d > 0.2 ? 4 : 5;
    s.set(x, y, tone(L, idx - dim));
  });
  // teeth ring pointing inward
  const teeth = 16;
  for (let i = 0; i < teeth; i++) {
    const a = (i / teeth) * Math.PI * 2;
    const ox = Math.cos(a);
    const oy = Math.sin(a);
    const bx = mx + ox * (mrx + 0.5);
    const by = my + oy * (mry + 0.5);
    const tx = mx + ox * (mrx - 3.5);
    const ty = my + oy * (mry - 4.5);
    const nx = -oy;
    const ny = ox;
    const m = new Mask(S, S).poly([
      [bx + nx * 1.6, by + ny * 1.6],
      [tx, ty],
      [bx - nx * 1.6, by - ny * 1.6],
    ]);
    m.add(Math.round(tx), Math.round(ty));
    shade(s, m, RAMPS.bone.slice(1, 6), { kx: 0.5, bias: 0.4 });
  }
  // inner throat ring of smaller teeth glints
  for (const [x, y] of arcPts(mx, my, Math.min(mrx, mry) * 0.55, 0, 360)) {
    if ((x + y) % 3 === 0) s.set(x, y, L[5]);
  }
  // cluster of small pale eyes above the maw
  for (const [ox, oy] of [
    [6, -14],
    [9, -12],
    [11, -15],
    [8, -17],
  ] as const) {
    s.set(hx + ox, hy + oy, U[5]).set(hx + ox + 1, hy + oy, U[3]);
    glows.push({ x: hx + ox, y: hy + oy, r: 2.5, color: U[4], strength: 0.5 });
  }
  // front void tendrils curling around the maw
  const lash = pose === "attack" ? -8 : pose === "hurt" ? 4 : 0;
  tendril(
    [
      [hx + 4, hy + 15],
      [hx - 4 + lash, hy + 22],
      [hx - 12 + lash, hy + 22 - sw],
      [hx - 18 + lash * 1.5, hy + 17],
    ],
    [2.6, 2, 1.3, 0.5],
  );
  tendril(
    [
      [52, 74],
      [42 + lash / 2, 78],
      [33 + lash, 76 + sw],
      [27 + lash, 80],
    ],
    [2.6, 2, 1.3, 0.5],
  );
  // light motes being drawn into the maw
  if (pose !== "hurt") {
    const motes: P[] = [
      [mx - 16, my - 8],
      [mx - 20, my + 2],
      [mx - 14, my + 9],
      [mx - 25, my - 4],
      [mx - 22, my + 12],
    ];
    motes.forEach(([x, y], i) => {
      s.set(x, y, i % 2 ? L[4] : L[5]);
      if (i < 3) s.set(x + 1, y, L[2]);
    });
  }
  const str = pose === "attack" ? 0.7 : pose === "hurt" ? 0.3 : 0.5;
  glows.push({ x: mx, y: my, r: 30, color: L[3], strength: str * 0.6 });
  glows.push({ x: mx - 2, y: my, r: 9, color: L[5], strength: str * 0.55 });
  if (pose === "attack") {
    // roar: light streaks spraying out
    for (const [ox, oy] of [
      [-14, -10],
      [-16, 0],
      [-14, 10],
    ] as const) {
      for (const [x, y] of linePts(mx - 9, my + oy / 3, mx + ox - 4, my + oy))
        if (!s.has(x, y)) s.set(x, y, L[4]);
    }
  }
  return { s, glows };
}

// ============================================================================================
// Dispatch
// ============================================================================================

function compose(id: EnemyArtId, pose: EnemyPose): Comp {
  switch (id) {
    case "huskMiner":
      return drawHusk(pose);
    case "huskForeman":
      return drawForeman(pose);
    case "gloamCrawler":
      return drawCrawler(pose);
    case "voidWisp":
      return drawWisp(pose);
    case "shardback":
      return drawShardback(pose);
    case "umbralStalker":
      return drawStalker(pose);
    case "mycelidTender":
      return drawMycelid(pose);
    case "lumenEater":
      return drawLumenEater(pose);
    case "mawTendril":
      return drawMawTendril(pose);
    default:
      return drawHusk(pose);
  }
}

const SCAV_POSE: Record<EnemyPose, MercPose> = {
  idle0: "idle0",
  idle1: "idle1",
  attack: "attack",
  hurt: "hurt",
};

/** Enemy sprite facing LEFT on a transparent background. */
export function drawEnemy(id: EnemyArtId, pose: EnemyPose): HTMLCanvasElement {
  if (id === "scavCutter") return drawHostileMerc(SCAV_CUTTER, SCAV_POSE[pose]);
  if (id === "scavGunner") return drawHostileMerc(SCAV_GUNNER, SCAV_POSE[pose]);
  return finishEnemy(compose(id, pose));
}

/**
 * Portrait crop per enemy: [x, y, k]. k = 2 -> 12x12 crop Scale2x'd to 24x24 (faces);
 * k = 1 -> native 24x24 crop (creatures whose read is their whole shape).
 */
const PORTRAIT_CROP: Record<EnemyArtId, readonly [number, number, 1 | 2]> = {
  huskMiner: [11, 12, 2],
  huskForeman: [14, 6, 2],
  gloamCrawler: [3, 20, 1],
  voidWisp: [12, 9, 1],
  shardback: [2, 19, 1],
  scavCutter: [0, 0, 2],
  scavGunner: [0, 0, 2],
  umbralStalker: [7, 20, 2],
  mycelidTender: [12, 10, 1],
  lumenEater: [22, 18, 1],
  mawTendril: [12, 4, 1],
};

export function drawEnemyPortrait(id: EnemyArtId): HTMLCanvasElement {
  if (id === "scavCutter") return drawHostileMercPortrait(SCAV_CUTTER);
  if (id === "scavGunner") return drawHostileMercPortrait(SCAV_GUNNER);
  const c = compose(id, "idle0");
  const [ox, oy, k] = PORTRAIT_CROP[id];
  const n = k === 2 ? 12 : 24;
  const crop = new Spr(n, n);
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) crop.setN(x, y, c.s.get(ox + x, oy + y));
  const out = k === 2 ? scale2x(crop) : crop;
  rim(out, 1, COLD_RIM, 0.3);
  const glows = c.glows
    .map((g) => ({
      ...g,
      x: (g.x - ox) * k + (k - 1),
      y: (g.y - oy) * k + (k - 1),
      r: g.r * (k === 2 ? 1.4 : 0.8),
    }))
    .filter((g) => g.x >= -4 && g.y >= -4 && g.x < 28 && g.y < 28);
  return finish(out, glows, false);
}
