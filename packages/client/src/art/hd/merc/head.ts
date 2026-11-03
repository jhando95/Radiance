/**
 * Merc head: 3/4 face turned right with inked features, 8 hair styles, 4 headgear types,
 * markings (scar, war paint, cyber eye) and hostile red lenses. Includes the neck.
 */
import { RAMPS } from "../../palette";
import { blob, ellipse, poly } from "../ink";
import type { RigGlow } from "../rig";
import { torsoGeo } from "./body";
import {
  BONE,
  BRASS,
  boundsOf,
  buckle,
  clipTo,
  crossHatch,
  fblob,
  folds,
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
  matR,
  mixHex,
  type PartSpec,
  type Pt,
  ragged,
  rivet,
  scratches,
  softGlow,
  STEEL,
  STEEL_DARK,
  stitches,
  stroke,
  tintMat,
  wash,
  withAlpha,
} from "./kit";
import type { MercStyle } from "./style";

export const HEAD = { W: 150, H: 190, cx: 66, cy: 74, pivot: [68, 122] as Pt, ks: 1.14 };

export function headPart(S: MercStyle): { spec: PartSpec; glows: RigGlow[] } {
  const tg = torsoGeo(S);
  const glows: RigGlow[] = [];
  const { cx, cy } = HEAD;
  const L = (x: number, y: number): Pt => [cx + x, cy + y];
  const Lp = (pts: readonly (readonly [number, number])[]): Pt[] => pts.map(([x, y]) => L(x, y));
  const r = S.rng(101);
  const jaw = [-1.5, 0, 2.5][S.body] ?? 0;
  const chin = (r() - 0.5) * 3;
  const noseKind = Math.floor(r() * 3);
  const beard = S.look.headgear !== 3 && r() < 0.32;
  const stubble = !beard && r() < 0.5;
  const browTilt = 2 + r() * 2;
  const hg = S.look.headgear;
  const cowl = S.d === "hexer" && (hg === 0 || hg === 1);
  const hooded = hg === 1 || cowl;
  const helmet = hg === 4;
  const hairStyle = Math.max(0, Math.min(7, Math.round(S.look.hair)));
  const skin = S.skin;
  const lineCol = mixHex(S.skinR[0] ?? INK, INK, 0.55);

  const headOutline = Lp([
    [-2, -28],
    [14, -25],
    [24, -15],
    [27, -3],
    [26, 6],
    [27.5, 16],
    [26 + chin * 0.3, 24],
    [20 + chin, 31],
    [6 + jaw, 30],
    [-8 - jaw, 22],
    [-14, 12],
    [-24, 1],
    [-23, -15],
    [-13, -25],
  ]);

  const hoodMat: Mat = cowl ? tintMat(S.sec, RAMPS.umbra[1], 0.45) : S.sec;

  const draw = (ctx: CanvasRenderingContext2D) => {
    // ---------- back layers ----------
    if (hooded) {
      // Hood back mass + drape.
      const back = Lp([
        [24, -26],
        [12, -40],
        [-12, -42],
        [-34, -28],
        [-40, -2],
        [-36, 26],
        [-28, 50],
        [-4, 56],
        [20, 50],
        [24, 34],
      ]);
      fblob(ctx, back, tintMat(hoodMat, INK, 0.45), { ol: 3.6, hatch: 4 }, 0.4);
    } else if (!helmet || hairStyle === 3 || hairStyle === 4) {
      if (hairStyle === 3) {
        // Ponytail.
        const tail = Lp([
          [-20, -12],
          [-14, -6],
          [-22, 14],
          [-30, 36],
          [-30, 58],
          [-38, 66],
          [-40, 40],
          [-36, 10],
        ]);
        fblob(ctx, tail, S.hair, { ol: 3, hatch: 4 }, 0.5);
        for (let i = 0; i < 4; i++) {
          line(ctx, Lp([
            [-24 - i * 2, -4],
            [-30 - i, 24],
            [-34 - i * 0.5, 52],
          ]), 1.4);
        }
        fell(ctx, L(-23, -2)[0], L(-23, -2)[1], 5, 4, LEATHER, { ol: 2, hatch: false }, 0.5);
      } else if (hairStyle === 4) {
        // Braids.
        for (const [bx, by, len] of [
          [-18, 6, 58],
          [-26, 0, 54],
        ] as const) {
          for (let i = 0; i < 7; i++) {
            const t = i / 6;
            const x = bx - t * 8;
            const y = by + t * len;
            fell(ctx, L(x, y)[0], L(x, y)[1], 4.6 - t, 5.4, S.hair, { ol: 1.8, hatch: false }, -0.25);
          }
          fell(ctx, L(bx - 8, by + len + 5)[0], L(bx - 8, by + len + 5)[1], 3, 3, BRASS, {
            ol: 1.4,
            hatch: false,
          });
        }
      }
    }

    // ---------- neck ----------
    const nw = S.D.neck;
    const neck = Lp([
      [-nw * 0.9 - 2, 16],
      [nw + 8, 22],
      [nw + 6, 54],
      [-nw - 6, 54],
    ]);
    fblob(ctx, neck, skin, { ol: 3.2, hatch: 4 }, 0.25);
    // Shadow under jaw.
    clipTo(ctx, blob(neck, 0.25), () => {
      flat(
        ctx,
        poly(
          Lp([
            [-20, 14],
            [28, 22],
            [26, 34],
            [-20, 36],
          ]),
        ),
        withAlpha(skin.deep, 0.75),
      );
    });
    // Adam's apple / tendon.
    line(
      ctx,
      Lp([
        [nw * 0.4, 34],
        [nw * 0.2, 48],
      ]),
      1.4,
      lineCol,
    );

    // ---------- skull & face ----------
    fblob(ctx, headOutline, skin, { ol: 3.8, hatch: 4, depth: 13 }, 0.45);
    // Cheek/jaw cel shadow (sharp) on the far-back plane.
    clipTo(ctx, blob(headOutline, 0.45), () => {
      flat(
        ctx,
        poly(
          Lp([
            [-30, -30],
            [-2, -30],
            [2, -10],
            [8, 14],
            [16, 34],
            [-30, 34],
          ]),
        ),
        withAlpha(skin.shade, 0.55),
      );
      // Eye socket shade.
      flat(ctx, ellipse(L(13, 2)[0], L(13, 2)[1], 9, 5.5), withAlpha(skin.shade, 0.85));
      flat(ctx, ellipse(L(24, 2)[0], L(24, 2)[1], 4, 4.5), withAlpha(skin.shade, 0.7));
      // Lit cheekbone plane.
      flat(
        ctx,
        poly(
          Lp([
            [14, 8],
            [24, 7],
            [25, 14],
            [16, 15],
          ]),
        ),
        withAlpha(skin.light, 0.45),
      );
    });
    // Ear.
    const ear = L(-9, 4);
    fell(ctx, ear[0], ear[1], 5.6, 8.6, skin, { ol: 2.6, hatch: false, depth: 3 }, 0.1);
    line(
      ctx,
      Lp([
        [-7, -1],
        [-11, 3],
        [-8, 9],
      ]),
      1.8,
      lineCol,
    );
    if (S.hostile || r() < 0.4) {
      // Ring earring.
      ctx.save();
      ctx.strokeStyle = INK;
      ctx.lineWidth = 2.4;
      ctx.beginPath();
      ctx.arc(ear[0] - 1, ear[1] + 10, 2.6, 0, Math.PI * 2);
      ctx.stroke();
      ctx.strokeStyle = RAMPS.lamp[3];
      ctx.lineWidth = 1.2;
      ctx.stroke();
      ctx.restore();
    }
    // Jaw line + cheek.
    line(
      ctx,
      Lp([
        [-6 - jaw, 18],
        [4, 26],
        [14 + chin, 29],
      ]),
      1.6,
      lineCol,
      [0.4, 0.4],
    );
    line(
      ctx,
      Lp([
        [10, 8],
        [16, 13],
      ]),
      1.4,
      lineCol,
    );
    // Beard / stubble.
    if (beard) {
      const bd = Lp([
        [-10, 4],
        [-4, 12],
        [8, 16],
        [18, 18],
        [27, 17],
        [27, 26],
        [20 + chin, 36],
        [6, 36],
        [-8 - jaw, 24],
        [-14, 10],
      ]);
      fblob(ctx, bd, S.hair, { ol: 2.8, hatch: 4 }, 0.4);
      for (let i = 0; i < 6; i++) {
        const x = -6 + i * 5;
        line(
          ctx,
          Lp([
            [x, 18 + (i > 3 ? 1 : 0)],
            [x + 1, 30],
          ]),
          1.3,
          withAlpha(INK, 0.7),
        );
      }
      // Mouth gap.
      line(
        ctx,
        Lp([
          [18, 21],
          [26, 20],
        ]),
        2.2,
      );
    } else if (stubble) {
      clipTo(ctx, blob(headOutline, 0.45), () => {
        const rr = S.rng(102);
        ctx.fillStyle = withAlpha(S.hairR[0] ?? INK, 0.55);
        for (let i = 0; i < 70; i++) {
          const x = -12 + rr() * 40;
          const y = 12 + rr() * 20;
          if (x > 24 && y < 20) continue;
          ctx.fillRect(cx + x, cy + y, 1.2, 1.2);
        }
      });
    }

    // ---------- features ----------
    const eyeY = 2;
    const drawEyes = (glowCol?: string) => {
      if (glowCol) {
        for (const [ex, rx] of [
          [13, 4],
          [24.5, 2.6],
        ] as const) {
          flat(ctx, ellipse(L(ex, eyeY)[0], L(ex, eyeY)[1], rx, 1.8), glowCol);
          softGlow(ctx, L(ex, eyeY)[0], L(ex, eyeY)[1], 8, glowCol, 0.6);
        }
        return;
      }
      // Near eye.
      const ne = L(13, eyeY);
      flat(
        ctx,
        blob(
          [
            [ne[0] - 5, ne[1] + 0.5],
            [ne[0] + 0.5, ne[1] - 2.6],
            [ne[0] + 5.2, ne[1] - 0.6],
            [ne[0] + 0.5, ne[1] + 2.2],
          ],
          0.6,
        ),
        mixHex(RAMPS.bone[4], skin.shade, 0.35),
      );
      flat(ctx, ellipse(ne[0] + 2, ne[1] - 0.2, 2.3, 2.4), "#1a1216");
      flat(ctx, ellipse(ne[0] + 2.6, ne[1] - 1, 0.8, 0.8), RAMPS.lamp[5]);
      line(
        ctx,
        [
          [ne[0] - 5.5, ne[1] + 0.8],
          [ne[0] - 1, ne[1] - 3],
          [ne[0] + 5.8, ne[1] - 0.8],
        ],
        2.4,
        INK,
        [0.2, 0.3],
      );
      line(
        ctx,
        [
          [ne[0] - 3, ne[1] + 3.6],
          [ne[0] + 3.5, ne[1] + 3.4],
        ],
        1,
        withAlpha(lineCol, 0.7),
      );
      // Far eye (foreshortened).
      const fe = L(24.5, eyeY);
      flat(
        ctx,
        blob(
          [
            [fe[0] - 2.4, fe[1]],
            [fe[0] + 0.4, fe[1] - 2.2],
            [fe[0] + 2.4, fe[1] - 0.2],
            [fe[0], fe[1] + 1.8],
          ],
          0.6,
        ),
        mixHex(RAMPS.bone[4], skin.shade, 0.5),
      );
      flat(ctx, ellipse(fe[0] + 0.8, fe[1] - 0.2, 1.4, 2), "#1a1216");
      line(
        ctx,
        [
          [fe[0] - 2.6, fe[1] + 0.2],
          [fe[0] + 2.8, fe[1] - 0.9],
        ],
        2,
        INK,
        [0.2, 0.3],
      );
    };
    const cyber = S.look.marking === 3;
    const shadowEyes = hooded && cowl;
    if (!shadowEyes) drawEyes();
    // Brows.
    line(
      ctx,
      Lp([
        [5, -5 - browTilt],
        [11, -5 - browTilt * 0.5],
        [18, -3.5],
      ]),
      3.6,
      mixHex(S.hairR[0] ?? INK, INK, 0.4),
      [0.15, 0.35],
    );
    line(
      ctx,
      Lp([
        [21.5, -3.5],
        [26.5, -5],
      ]),
      2.8,
      mixHex(S.hairR[0] ?? INK, INK, 0.4),
      [0.3, 0.2],
    );
    // Brow furrow.
    line(
      ctx,
      Lp([
        [19.5, -7],
        [20, -2],
      ]),
      1.2,
      lineCol,
    );
    // Nose.
    const noseTip = noseKind === 1 ? 33 : noseKind === 2 ? 31 : 32;
    const nose = Lp([
      [24, -2],
      [noseKind === 1 ? 30 : 28, 4],
      [noseTip, 12],
      [noseTip - 2, 14.5],
      [25, 14.5],
    ]);
    fpoly(ctx, nose, skin, { ol: 2.4, hatch: false, depth: 3 });
    flat(ctx, ellipse(L(26.5, 12.8)[0], L(26.5, 12.8)[1], 1.6, 1.1), lineCol);
    line(
      ctx,
      Lp([
        [21, 12],
        [19, 17],
      ]),
      1.2,
      withAlpha(lineCol, 0.8),
    );
    // Mouth (grim set).
    if (!beard) {
      line(
        ctx,
        Lp([
          [17, 21.5],
          [21, 20.5],
          [26.5, 20.2],
        ]),
        2.2,
        INK,
        [0.3, 0.2],
      );
      line(
        ctx,
        Lp([
          [19.5, 24.2],
          [24.5, 24],
        ]),
        1.2,
        withAlpha(lineCol, 0.8),
      );
      flat(
        ctx,
        poly(
          Lp([
            [19, 22.5],
            [25.5, 22],
            [25, 23.6],
            [19.5, 23.8],
          ]),
        ),
        withAlpha(skin.light, 0.5),
      );
    }

    // ---------- markings ----------
    if (S.look.marking === 1) {
      const sc = Lp([
        [6, -12],
        [11, 0],
        [17, 14],
      ]);
      line(
        ctx,
        sc.map(([x, y]) => [x + 0.8, y + 0.6] as Pt),
        3.6,
        withAlpha(skin.deep, 0.9),
      );
      line(ctx, sc, 2.4, mixHex(skin.light, RAMPS.bone[5], 0.4));
      stitches(ctx, sc, 3.6, 4, INK, 0.6);
    } else if (S.look.marking === 2) {
      clipTo(ctx, blob(headOutline, 0.45), () => {
        flat(
          ctx,
          poly(
            Lp([
              [2, -4],
              [30, -6],
              [30, 6],
              [4, 8],
            ]),
          ),
          withAlpha(S.paint, 0.82),
        );
        for (const dx of [8, 14]) {
          line(
            ctx,
            Lp([
              [dx, 6],
              [dx + 0.5, 13],
              [dx + 1, 19],
            ]),
            2.6,
            withAlpha(S.paint, 0.85),
            [0, 0.8],
          );
        }
        flat(
          ctx,
          poly(
            Lp([
              [12, 26],
              [26, 25],
              [24, 30],
              [12, 30],
            ]),
          ),
          withAlpha(S.paint, 0.7),
        );
      });
      if (!shadowEyes) drawEyes();
    } else if (cyber) {
      const plate = Lp([
        [5, -6],
        [20, -7],
        [21, 9],
        [7, 12],
        [3, 4],
      ]);
      fpoly(ctx, plate, STEEL_DARK, { ol: 2.6, hatch: false, depth: 4 });
      rivet(ctx, L(6, -3)[0], L(6, -3)[1], 1.4);
      rivet(ctx, L(8, 9)[0], L(8, 9)[1], 1.4);
      line(
        ctx,
        Lp([
          [3, 5],
          [-6, 8],
        ]),
        1.6,
        RAMPS.steel[2],
      );
      const col = S.hostile ? RAMPS.rust[4] : RAMPS.crystal[4];
      const e = L(13, 1.5);
      flat(ctx, ellipse(e[0], e[1], 4.4, 4.4), INK);
      flat(ctx, ellipse(e[0], e[1], 3.2, 3.2), col);
      flat(ctx, ellipse(e[0] + 0.6, e[1] - 0.4, 1.3, 1.3), "#ffffff");
      softGlow(ctx, e[0], e[1], 10, col, 0.7);
      glows.push({ part: "head", x: e[0], y: e[1], radius: 22, color: col, alpha: 0.55 });
    }

    // ---------- hair ----------
    const capPts = Lp([
      [21, -11],
      [16, -25],
      [2, -32],
      [-14, -29],
      [-25, -16],
      [-27, 0],
      [-22, 14],
      [-15, 10],
      [-9, -3],
      [2, -6],
      [12, -7],
    ]);
    const strands = (pts: readonly (readonly [number, number])[][], w = 1.5) => {
      for (const s of pts) line(ctx, Lp(s), w, withAlpha(INK, 0.8), [0.2, 0.6]);
    };
    const highlight = (pts: readonly (readonly [number, number])[]) =>
      glint(ctx, Lp(pts), 2, S.hairR[2] ?? "#ffffff");
    const stubbleCap = () => {
      clipTo(ctx, blob(headOutline, 0.45), () => {
        flat(ctx, poly(capPts), withAlpha(S.hairR[0] ?? INK, 0.55));
        const rr = S.rng(103);
        ctx.fillStyle = withAlpha(S.hairR[0] ?? INK, 0.8);
        for (let i = 0; i < 90; i++) {
          const x = -26 + rr() * 46;
          const y = -32 + rr() * 44;
          ctx.fillRect(cx + x, cy + y, 1.1, 1.1);
        }
      });
      line(
        ctx,
        Lp([
          [20, -11],
          [10, -7],
          [-2, -6],
          [-9, -3],
        ]),
        1.4,
        withAlpha(INK, 0.5),
      );
    };
    if (!hooded && !helmet) {
      switch (hairStyle) {
        case 0:
          stubbleCap();
          break;
        case 2: {
          stubbleCap();
          const crest = Lp([
            [20, -18],
            [24, -30],
            [14, -34],
            [14, -46],
            [2, -42],
            [-2, -54],
            [-10, -42],
            [-20, -48],
            [-22, -34],
            [-32, -32],
            [-28, -18],
            [-30, -6],
            [-22, -10],
            [-12, -26],
            [4, -30],
          ]);
          fpoly(ctx, crest, S.hair, { ol: 3, hatch: 4, depth: 8 });
          strands([
            [
              [12, -28],
              [12, -40],
            ],
            [
              [0, -32],
              [-2, -48],
            ],
            [
              [-14, -28],
              [-18, -42],
            ],
          ]);
          highlight([
            [16, -30],
            [10, -36],
            [2, -38],
          ]);
          break;
        }
        case 6: {
          stubbleCap();
          fell(ctx, L(-6, -38)[0], L(-6, -38)[1], 10, 9, S.hair, { ol: 3, hatch: 4 });
          fpoly(
            ctx,
            Lp([
              [-14, -40],
              [-26, -48],
              [-30, -40],
              [-16, -34],
            ]),
            S.hair,
            { ol: 2.4, hatch: false },
          );
          fcaps(ctx, L(-8, -30)[0], L(-8, -30)[1], L(-3, -30)[0], L(-3, -30)[1], 3, 3, LEATHER, {
            ol: 1.6,
            hatch: false,
          });
          strands([
            [
              [-12, -42],
              [-4, -44],
              [2, -38],
            ],
          ]);
          // Back-pulled hair lines.
          strands([
            [
              [16, -20],
              [2, -28],
              [-6, -30],
            ],
            [
              [-20, -6],
              [-12, -22],
              [-8, -30],
            ],
          ]);
          break;
        }
        case 7: {
          // Wild mane.
          const rr = S.rng(104);
          const mane: Pt[] = [];
          const n = 15;
          for (let i = 0; i <= n; i++) {
            const a = -Math.PI * 0.08 - (i / n) * Math.PI * 1.25;
            const rad = i % 2 === 0 ? 37 + rr() * 6 : 27;
            mane.push(L(-4 + Math.cos(a) * rad * 0.95, -6 + Math.sin(a) * rad));
          }
          mane.push(...Lp([
            [-22, 18],
            [-14, 8],
            [-8, -4],
            [6, -4],
            [16, -6],
            [24, -10],
          ]));
          fpoly(ctx, mane, S.hair, { ol: 3.2, hatch: 4, depth: 10 });
          strands([
            [
              [10, -22],
              [-2, -30],
              [-16, -26],
            ],
            [
              [-20, -14],
              [-28, -2],
              [-28, 10],
            ],
            [
              [4, -12],
              [-6, -18],
            ],
          ]);
          highlight([
            [18, -20],
            [8, -30],
            [-4, -34],
          ]);
          break;
        }
        default: {
          // Cap-based styles: 1 crop, 3 tied, 4 braids, 5 swept fringe.
          fpoly(ctx, capPts, S.hair, { ol: 3, hatch: 4, depth: 9 });
          strands([
            [
              [16, -22],
              [2, -28],
              [-10, -26],
            ],
            [
              [-14, -22],
              [-22, -10],
              [-22, 6],
            ],
            [
              [8, -12],
              [-4, -18],
              [-14, -14],
            ],
          ]);
          highlight([
            [14, -24],
            [2, -30],
            [-10, -28],
          ]);
          if (hairStyle === 5) {
            const fr = Lp([
              [-8, -30],
              [10, -32],
              [24, -26],
              [34, -14],
              [30, -12],
              [32, -2],
              [24, -8],
              [22, -2],
              [16, -10],
              [6, -12],
            ]);
            fpoly(ctx, fr, S.hair, { ol: 3, hatch: 4, depth: 7 });
            strands([
              [
                [6, -26],
                [20, -20],
                [30, -6],
              ],
              [
                [0, -22],
                [14, -16],
                [22, -6],
              ],
            ]);
            highlight([
              [8, -30],
              [22, -24],
              [30, -16],
            ]);
          }
          if (hairStyle === 3 || hairStyle === 4) {
            strands([
              [
                [14, -14],
                [0, -20],
                [-18, -10],
              ],
            ]);
          }
          break;
        }
      }
    }

    // ---------- headgear ----------
    if (hooded) {
      const shell = Lp([
        [25, -25],
        [14, -38],
        [-8, -42],
        [-30, -30],
        [-38, -6],
        [-35, 22],
        [-26, 46],
        [-8, 54],
        [10, 46],
        [6, 30],
        [-1, 14],
        [-3, -2],
        [6, -16],
        [16, -21],
      ]);
      const rr = S.rng(105);
      // Ragged rim for the cowl.
      fblob(ctx, shell, hoodMat, { ol: 3.6, hatch: 4, depth: 12 }, 0.35);
      // Inner rim band.
      line(
        ctx,
        Lp([
          [25, -24],
          [16, -20],
          [6, -15],
          [-2, -2],
          [0, 14],
          [6, 30],
        ]),
        3,
        hoodMat.light,
        [0.1, 0.3],
      );
      folds(ctx, [
        Lp([
          [-10, -34],
          [-24, -14],
          [-28, 14],
        ]),
        Lp([
          [4, -36],
          [-12, -18],
        ]),
        Lp([
          [-18, 24],
          [-12, 44],
        ]),
      ]);
      if (cowl) {
        // Tattered edge + deep face shadow, glowing eyes.
        for (let i = 0; i < 4; i++) {
          const p = L(-30 + i * 9, 44 + rr() * 6);
          fpoly(
            ctx,
            [
              [p[0] - 4, p[1] - 6],
              [p[0] + 4, p[1] - 6],
              [p[0] + rr() * 3, p[1] + 8 + rr() * 6],
            ],
            hoodMat,
            { ol: 2, hatch: false },
          );
        }
        clipTo(ctx, blob(headOutline, 0.45), () => {
          const g = ctx.createLinearGradient(0, cy - 30, 0, cy + 22);
          g.addColorStop(0, "rgba(10,6,18,0.92)");
          g.addColorStop(0.7, "rgba(10,6,18,0.78)");
          g.addColorStop(1, "rgba(10,6,18,0.1)");
          ctx.fillStyle = g;
          ctx.fillRect(cx - 30, cy - 34, 64, 60);
        });
        crossHatch(ctx, blob(headOutline, 0.45), boundsOf(headOutline), 4, 0.25, true);
        if (!S.hostile) drawEyes(RAMPS.umbra[4]);
        glows.push({
          part: "head",
          x: L(16, eyeY)[0],
          y: L(16, eyeY)[1],
          radius: 18,
          color: S.hostile ? RAMPS.rust[3] : RAMPS.umbra[4],
          alpha: 0.4,
        });
      } else {
        clipTo(ctx, blob(headOutline, 0.45), () => {
          flat(
            ctx,
            poly(
              Lp([
                [-30, -34],
                [30, -34],
                [30, -8],
                [10, -4],
                [-30, 4],
              ]),
            ),
            "rgba(10,6,18,0.45)",
          );
        });
      }
    }
    if (hg === 2 && !S.hostile) {
      // Goggles pushed up on the forehead.
      const band = Lp([
        [-26, -16],
        [-4, -22],
        [22, -20],
        [22, -12],
        [-4, -14],
        [-26, -8],
      ]);
      fblob(ctx, band, LEATHER_DARK, { ol: 2.6, hatch: false }, 0.3);
      goggleLenses(ctx, L(10, -19), L(23, -18), RAMPS.crystal[3], RAMPS.crystal[5], false);
    }
    if (hg === 3) {
      // Rebreather.
      const hose = Lp([
        [30, 30],
        [26, 42],
        [12, 50],
        [-4, 50],
        [-16, 44],
      ]);
      line(ctx, hose, 8.5, INK);
      line(ctx, hose, 5.5, RAMPS.rock[3]);
      for (let i = 1; i < 12; i++) {
        const t = i / 12;
        const a = hose[Math.floor(t * (hose.length - 1))] as Pt;
        const b = hose[Math.min(hose.length - 1, Math.floor(t * (hose.length - 1)) + 1)] as Pt;
        const f = t * (hose.length - 1) - Math.floor(t * (hose.length - 1));
        const x = a[0] + (b[0] - a[0]) * f;
        const y = a[1] + (b[1] - a[1]) * f;
        stroke(
          ctx,
          [
            [x - 2, y - 2.5],
            [x + 2, y + 2.5],
          ],
          1.2,
          INK,
          0.7,
        );
      }
      strapLine(ctx, L(14, 8), L(-8, 2));
      strapLine(ctx, L(14, 24), L(-8, 18));
      const mask = Lp([
        [14, 6],
        [24, 5],
        [33, 12],
        [35, 22],
        [30, 31],
        [18, 32],
        [11, 24],
      ]);
      fblob(ctx, mask, S.hostile ? matR(RAMPS.rust, 2) : STEEL_DARK, { ol: 3, depth: 6 }, 0.45);
      for (let i = 0; i < 3; i++) {
        stroke(
          ctx,
          Lp([
            [20 + i * 4, 12],
            [21 + i * 4, 28],
          ]),
          1.4,
          INK,
          0.7,
        );
      }
      fcaps(ctx, L(31, 24)[0], L(31, 24)[1], L(37, 32)[0], L(37, 32)[1], 6.5, 6, STEEL, {
        ol: 2.6,
        hatch: false,
      });
      stroke(
        ctx,
        [L(34, 23), L(30, 28)],
        1.4,
        INK,
        0.8,
      );
      flat(ctx, ellipse(L(38, 33)[0], L(38, 33)[1], 4, 4.5, -0.6), RAMPS.rock[1], 1.8);
      scratches(ctx, S.rng(106), boundsOf(mask), 3);
    }
    if (helmet) {
      const shell = Lp([
        [27, -5],
        [25, -21],
        [12, -34],
        [-10, -35],
        [-27, -22],
        [-32, 0],
        [-30, 18],
        [-18, 16],
        [-11, 2],
        [4, -4],
        [16, -5],
      ]);
      fblob(ctx, shell, S.plate, { ol: 3.8, hatch: 4, depth: 12 }, 0.35);
      // Crest ridge + brim.
      line(
        ctx,
        Lp([
          [22, -24],
          [8, -36],
          [-12, -36],
          [-28, -22],
        ]),
        3,
      );
      glint(ctx, Lp([
        [16, -28],
        [6, -32],
        [-4, -32],
      ]), 2.2, RAMPS.steel[5]);
      fpoly(
        ctx,
        Lp([
          [10, -12],
          [30, -10],
          [34, -4],
          [12, -5],
        ]),
        S.plate,
        { ol: 2.8, hatch: false, depth: 3 },
      );
      // Cheek guard.
      fpoly(
        ctx,
        Lp([
          [-10, -2],
          [6, -6],
          [10, 20],
          [2, 26],
          [-6, 22],
        ]),
        S.plate,
        { ol: 3, depth: 5 },
      );
      rivet(ctx, L(0, 2)[0], L(0, 2)[1], 1.8);
      rivet(ctx, L(2, 16)[0], L(2, 16)[1], 1.8);
      for (let i = 0; i < 4; i++) rivet(ctx, L(-20 + i * 11, -12 - (i === 1 || i === 2 ? 5 : 0))[0], L(-20 + i * 11, -12 - (i === 1 || i === 2 ? 5 : 0))[1], 1.6);
      // Headlamp housing.
      fcaps(ctx, L(-6, -24)[0], L(-6, -24)[1], L(6, -26)[0], L(6, -26)[1], 5, 5, STEEL_DARK, {
        ol: 2.4,
        hatch: false,
      });
      flat(ctx, ellipse(L(9, -26)[0], L(9, -26)[1], 2.4, 4.6), RAMPS.lamp[2], 1.8);
      scratches(ctx, S.rng(107), boundsOf(shell), 6);
    }
    if (S.hostile) {
      // Red-lensed goggles over the eyes.
      if (!hooded) {
        const band = Lp([
          [-27, -6],
          [-4, -4],
          [22, -3],
          [22, 6],
          [-4, 5],
          [-27, 3],
        ]);
        fblob(ctx, band, LEATHER_DARK, { ol: 2.6, hatch: false }, 0.3);
      }
      goggleLenses(ctx, L(13, 1), L(25, 1), RAMPS.rust[3], RAMPS.rust[5], true);
      glows.push({ part: "head", x: L(18, 1)[0], y: L(18, 1)[1], radius: 20, color: RAMPS.rust[3], alpha: 0.45 });
    }
  };

  return {
    spec: {
      id: "head",
      ks: HEAD.ks,
      w: HEAD.W,
      h: HEAD.H,
      pivot: HEAD.pivot,
      parent: "torso",
      at: tg.neck,
      z: 11,
      draw,
    },
    glows: glows.map((g) => ({ ...g, x: g.x * HEAD.ks, y: g.y * HEAD.ks, radius: g.radius * HEAD.ks })),
  };
}

function strapLine(ctx: CanvasRenderingContext2D, a: Pt, b: Pt) {
  line(ctx, [a, b], 5, INK, [0, 0]);
  line(ctx, [a, b], 3, RAMPS.leather[2], [0, 0]);
}

function goggleLenses(
  ctx: CanvasRenderingContext2D,
  near: Pt,
  far: Pt,
  glass: string,
  hi: string,
  glowing: boolean,
) {
  // Far lens (foreshortened), bridge, near lens.
  fell(ctx, far[0], far[1], 4.4, 6.2, BRASS, { ol: 2.4, hatch: false });
  flat(ctx, ellipse(far[0] + 0.5, far[1], 2.8, 4.4), glass);
  stroke(ctx, [
    [near[0] + 6, near[1]],
    [far[0] - 3.5, far[1]],
  ], 2.4, INK);
  fell(ctx, near[0], near[1], 7.6, 7.6, BRASS, { ol: 2.6, hatch: false });
  flat(ctx, ellipse(near[0], near[1], 5.4, 5.4), glass);
  flat(ctx, ellipse(near[0] - 1.6, near[1] + 1.6, 3.4, 3.4), withAlpha(INK, 0.35));
  glint(ctx, [
    [near[0] + 1, near[1] - 3.6],
    [near[0] + 3.6, near[1] - 1],
  ], 1.6, hi);
  if (glowing) {
    softGlow(ctx, near[0], near[1], 12, glass, 0.55);
    softGlow(ctx, far[0], far[1], 8, glass, 0.45);
  }
  rivet(ctx, near[0] - 6, near[1] + 3, 1.2);
}

