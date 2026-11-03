/**
 * UI kit drawn at native pixel scale (the game scales 3x/4x with nearest-neighbour):
 * riveted dark-metal panels with brass trim, rarity slots, buttons, bar frames, the soft
 * light-cone sprite used to cut holes in the darkness overlay, and the title wordmark.
 */
import { INK, mix, RAMPS, RARITY_COLORS } from "./palette";
import { makeCanvas, Pix } from "./pixel";

const { void: VOID, steel, lamp, bone } = RAMPS;

type Rarity = "common" | "uncommon" | "rare" | "epic" | "relic" | "empty";

/** Panel interior colors (flat so 9-slice centers stretch cleanly). */
const PANEL_FILL = mix(VOID[1], steel[0], 0.6);
const INSET_FILL = mix(VOID[0], VOID[1], 0.5);

/**
 * Dark riveted-metal panel with a thin brass trim. 4px border:
 *  ring 0 INK, ring 1 brass trim, rings 2-3 steel frame (bevelled), corners carry rivets.
 */
export function drawPanel(
  w: number,
  h: number,
  variant: "default" | "inset" | "highlight" = "default",
): HTMLCanvasElement {
  const W = Math.max(12, Math.round(w));
  const H = Math.max(12, Math.round(h));
  const p = new Pix(W, H);
  const inset = variant === "inset";
  const hi = variant === "highlight";

  const trimLight = hi ? lamp[3] : inset ? lamp[1] : lamp[2];
  const trimDark = hi ? lamp[2] : inset ? lamp[0] : lamp[1];
  const glint = hi ? lamp[5] : inset ? lamp[2] : lamp[4];
  const frameLight = inset ? steel[0] : steel[3];
  const frameMid = inset ? VOID[1] : steel[1];
  const frameDark = inset ? steel[1] : steel[0];

  // ring 0: ink
  p.rect(0, 0, W, H, INK);
  // ring 1: brass trim, lit top/left (inset reverses)
  const tl = inset ? trimDark : trimLight;
  const br = inset ? trimLight : trimDark;
  p.hline(1, W - 2, 1, tl).vline(1, 1, H - 2, tl);
  p.hline(1, W - 2, H - 2, br).vline(W - 2, 1, H - 2, br);
  // rings 2-3: steel frame bevel
  p.rect(2, 2, W - 4, H - 4, frameMid);
  p.hline(2, W - 3, 2, frameLight).vline(2, 2, H - 3, frameLight);
  p.hline(2, W - 3, H - 3, frameDark).vline(W - 3, 2, H - 3, frameDark);
  // interior + inner lip (1px darker line right inside the frame, lit on bottom/right)
  p.rect(4, 4, W - 8, H - 8, inset ? INSET_FILL : PANEL_FILL);
  p.hline(3, W - 4, 3, INK).vline(3, 3, H - 4, INK);
  p.hline(3, W - 4, H - 4, inset ? frameMid : frameDark).vline(
    W - 4,
    3,
    H - 4,
    inset ? frameMid : frameDark,
  );
  // corner rivets (inside the 4x4 corner slices)
  const rivet = (x: number, y: number) => {
    p.px(x, y, inset ? steel[2] : steel[4]);
    p.px(x + 1, y, inset ? steel[1] : steel[3]);
    p.px(x, y + 1, inset ? steel[1] : steel[3]);
    p.px(x + 1, y + 1, INK);
  };
  rivet(2, 2);
  rivet(W - 4, 2);
  rivet(2, H - 4);
  rivet(W - 4, H - 4);
  // corner trim notches in brass
  for (const [x, y] of [
    [1, 1],
    [W - 2, 1],
    [1, H - 2],
    [W - 2, H - 2],
  ] as const) {
    p.px(x, y, glint);
  }
  if (hi) {
    // warm outer glint on the ink ring corners
    p.px(0, 0, lamp[2])
      .px(W - 1, 0, lamp[2])
      .px(0, H - 1, lamp[2])
      .px(W - 1, H - 1, lamp[2]);
  }
  return p.canvas;
}

/** 20x20 item/skill slot, border tinted by rarity. */
export function drawSlot(rarity: Rarity = "empty"): HTMLCanvasElement {
  const p = new Pix(20, 20);
  const empty = rarity === "empty";
  const base = empty ? steel[2] : RARITY_COLORS[rarity];
  const light = empty ? steel[3] : mix(base, "#ffffff", 0.35);
  const dark = empty ? steel[1] : mix(base, INK, 0.55);
  // outer ink with clipped corners
  p.rect(1, 0, 18, 20, INK).rect(0, 1, 20, 18, INK);
  // rarity frame
  p.rect(1, 1, 18, 18, base);
  p.hline(2, 17, 1, light).vline(1, 2, 17, light);
  p.hline(2, 17, 18, dark).vline(18, 2, 17, dark);
  p.px(1, 1, INK).px(18, 1, INK).px(1, 18, INK).px(18, 18, INK);
  // inner ink
  p.rect(2, 2, 16, 16, INK);
  // recessed well with an inner shadow (top/left dark, bottom/right faint rim)
  const well = empty ? INSET_FILL : mix(VOID[1], base, 0.12);
  p.rect(3, 3, 14, 14, well);
  p.hline(3, 16, 3, VOID[0]).vline(3, 3, 16, VOID[0]);
  p.hline(4, 16, 16, mix(well, base, 0.25)).vline(16, 4, 16, mix(well, base, 0.25));
  // corner studs
  const stud = empty ? steel[3] : light;
  p.px(2, 2, stud).px(17, 2, stud).px(2, 17, stud).px(17, 17, stud);
  if (empty) {
    // faint dashed cross-hair to read as an empty socket
    for (let i = 6; i <= 13; i += 2) p.px(i, 9, VOID[2]).px(9, i, VOID[2]);
  } else if (rarity === "relic" || rarity === "epic") {
    // ornate notches at the edge centers
    p.px(9, 0, base).px(10, 0, base).px(9, 19, base).px(10, 19, base);
    p.px(0, 9, base).px(0, 10, base).px(19, 9, base).px(19, 10, base);
  }
  return p.canvas;
}

/** Bevelled metal button with brass trim. Pressed shifts the face down 1px. */
export function drawButton(
  w: number,
  h: number,
  state: "idle" | "hover" | "pressed" | "disabled",
): HTMLCanvasElement {
  const W = Math.max(8, Math.round(w));
  const H = Math.max(8, Math.round(h));
  const p = new Pix(W, H);
  const pal = {
    idle: { face: steel[1], top: steel[2], bot: steel[0], trim: lamp[2], trimHi: lamp[3] },
    hover: {
      face: mix(steel[1], lamp[1], 0.35),
      top: mix(steel[2], lamp[2], 0.45),
      bot: mix(steel[0], lamp[0], 0.4),
      trim: lamp[3],
      trimHi: lamp[5],
    },
    pressed: { face: steel[0], top: VOID[0], bot: steel[1], trim: lamp[1], trimHi: lamp[2] },
    disabled: { face: VOID[1], top: VOID[2], bot: VOID[0], trim: VOID[2], trimHi: VOID[3] },
  }[state];

  // ink outline with rounded (clipped) corners
  p.rect(1, 0, W - 2, H, INK).rect(0, 1, W, H - 2, INK);
  // drop lip (bottom 1px shows the button's thickness unless pressed)
  const lip = state === "pressed" ? 0 : 1;
  const y0 = 1 + (state === "pressed" ? 1 : 0);
  const fh = H - 2 - lip - (state === "pressed" ? 1 : 0);
  if (lip) p.hline(2, W - 3, H - 2, state === "disabled" ? VOID[0] : lamp[0]);
  // trim ring
  p.rect(1, y0, W - 2, fh, pal.trim);
  p.hline(2, W - 3, y0, pal.trimHi);
  p.px(1, y0, INK)
    .px(W - 2, y0, INK)
    .px(1, y0 + fh - 1, INK)
    .px(W - 2, y0 + fh - 1, INK);
  // face
  p.rect(2, y0 + 1, W - 4, fh - 2, pal.face);
  p.hline(2, W - 3, y0 + 1, pal.top);
  p.hline(2, W - 3, y0 + fh - 2, pal.bot);
  return p.canvas;
}

/** 6px-tall frame for HP/XP bars. Fill area is x∈[2, w-3], y∈[1, 4]. */
export function drawBarFrame(w: number): HTMLCanvasElement {
  const W = Math.max(8, Math.round(w));
  const p = new Pix(W, 6);
  p.rect(1, 0, W - 2, 6, INK).rect(0, 1, W, 4, INK);
  // track
  p.rect(2, 1, W - 4, 4, VOID[0]);
  p.hline(2, W - 3, 1, mix(VOID[0], INK, 0.5));
  p.hline(2, W - 3, 4, VOID[1]);
  // brass end caps
  p.vline(1, 1, 4, lamp[2]).px(1, 1, lamp[3]);
  p.vline(W - 2, 1, 4, lamp[1]).px(W - 2, 1, lamp[2]);
  // tick marks every 10px to read as a gauge
  for (let x = 12; x < W - 3; x += 10) p.px(x, 4, VOID[2]);
  return p.canvas;
}

/**
 * Soft radial light sprite (white -> transparent, smooth). Used with destination-out
 * (or ERASE blend) to cut holes in the darkness overlay. Canvas size = radius * 2.
 */
export function drawLightCone(radius: number): HTMLCanvasElement {
  const r = Math.max(2, Math.round(radius));
  const c = makeCanvas(r * 2, r * 2);
  const ctx = c.getContext("2d");
  if (!ctx) return c;
  const g = ctx.createRadialGradient(r, r, 0, r, r, r);
  // smoothstep-like falloff: bright plateau, long soft tail
  const stops = 12;
  for (let i = 0; i <= stops; i++) {
    const t = i / stops;
    const a = 1 - t * t * (3 - 2 * t);
    g.addColorStop(t, `rgba(255,255,255,${(a ** 1.4).toFixed(4)})`);
  }
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, r * 2, r * 2);
  return c;
}

// ---------------------------------------------------------------------------------------
// Title wordmark
// ---------------------------------------------------------------------------------------

const GLYPHS: Record<string, string[]> = {
  R: [
    "######.",
    "##...##",
    "##...##",
    "##...##",
    "######.",
    "##.##..",
    "##..##.",
    "##...##",
    "##...##",
  ],
  A: [
    "..###..",
    ".##.##.",
    "##...##",
    "##...##",
    "##...##",
    "#######",
    "##...##",
    "##...##",
    "##...##",
  ],
  D: [
    "#####..",
    "##..##.",
    "##...##",
    "##...##",
    "##...##",
    "##...##",
    "##...##",
    "##..##.",
    "#####..",
  ],
  I: ["####", ".##.", ".##.", ".##.", ".##.", ".##.", ".##.", ".##.", "####"],
  N: [
    "##...##",
    "###..##",
    "###..##",
    "####.##",
    "##.####",
    "##..###",
    "##..###",
    "##...##",
    "##...##",
  ],
  C: [
    ".#####.",
    "##...##",
    "##.....",
    "##.....",
    "##.....",
    "##.....",
    "##.....",
    "##...##",
    ".#####.",
  ],
  E: [
    "#######",
    "##.....",
    "##.....",
    "##.....",
    "######.",
    "##.....",
    "##.....",
    "##.....",
    "#######",
  ],
};

/** "RADIANCE" in chunky gold pixel letters with bevel, ink outline, glow and a flare. */
export function drawTitleLogo(): HTMLCanvasElement {
  const word = "RADIANCE";
  const SC = 2; // glyph cell -> pixels
  const GAP = 3;
  const glyphH = 9 * SC;
  let textW = 0;
  for (const ch of word) textW += (GLYPHS[ch]?.[0]?.length ?? 0) * SC + GAP;
  textW -= GAP;
  const W = 140;
  const H = 28;
  const ox = Math.floor((W - textW) / 2);
  const oy = Math.floor((H - glyphH) / 2);

  // 1) mask of letter pixels
  const mask = new Uint8Array(W * H);
  let x = ox;
  for (const ch of word) {
    const g = GLYPHS[ch] ?? [];
    const gw = (g[0]?.length ?? 0) * SC;
    g.forEach((row, gy) => {
      for (let gx = 0; gx < row.length; gx++) {
        if (row[gx] !== "#") continue;
        for (let j = 0; j < SC; j++)
          for (let i = 0; i < SC; i++) mask[(oy + gy * SC + j) * W + x + gx * SC + i] = 1;
      }
    });
    x += gw + GAP;
  }
  const m = (xx: number, yy: number) =>
    xx >= 0 && yy >= 0 && xx < W && yy < H ? (mask[yy * W + xx] ?? 0) : 0;

  const p = new Pix(W, H);
  // 2) soft amber glow behind the word
  {
    const ctx = p.ctx;
    const g = ctx.createRadialGradient(W / 2, H / 2, 2, W / 2, H / 2, W * 0.55);
    g.addColorStop(0, "rgba(242,169,59,0.30)");
    g.addColorStop(0.5, "rgba(199,113,28,0.12)");
    g.addColorStop(1, "rgba(199,113,28,0)");
    ctx.save();
    ctx.scale(1, 0.32);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H / 0.32);
    ctx.restore();
  }
  // 3) drop shadow + ink outline (outline drawn around the mask, shadow 1px lower)
  for (let yy = 0; yy < H; yy++) {
    for (let xx = 0; xx < W; xx++) {
      if (m(xx, yy)) continue;
      if (m(xx, yy - 2) || m(xx - 1, yy - 2) || m(xx + 1, yy - 2)) p.px(xx, yy, lamp[0]);
    }
  }
  for (let yy = 0; yy < H; yy++) {
    for (let xx = 0; xx < W; xx++) {
      if (m(xx, yy)) continue;
      if (m(xx - 1, yy) || m(xx + 1, yy) || m(xx, yy - 1) || m(xx, yy + 1) || m(xx, yy - 1 - 0))
        p.px(xx, yy, INK);
    }
  }
  // 4) letter fill: vertical gold ramp + bevel (top-left lit, bottom-right shade)
  const ramp = [lamp[5], lamp[4], lamp[4], lamp[3], lamp[3], lamp[2]];
  for (let yy = 0; yy < H; yy++) {
    for (let xx = 0; xx < W; xx++) {
      if (!m(xx, yy)) continue;
      const t = (yy - oy) / glyphH;
      let c = ramp[Math.min(ramp.length - 1, Math.floor(t * ramp.length))] as string;
      // horizon line: a darker band through the middle, like a lamp's reflection
      if (yy === oy + Math.floor(glyphH * 0.5)) c = lamp[2];
      if (!m(xx, yy - 1) || !m(xx - 1, yy)) c = t < 0.5 ? lamp[5] : lamp[4];
      else if (!m(xx, yy + 1) || !m(xx + 1, yy)) c = t < 0.5 ? lamp[2] : lamp[1];
      p.px(xx, yy, c);
    }
  }
  // 5) lens flare through the "I": thin bright line + 4-point star
  let ix = ox;
  for (const ch of word) {
    const gw = (GLYPHS[ch]?.[0]?.length ?? 0) * SC;
    if (ch === "I") break;
    ix += gw + GAP;
  }
  const fx = ix + 3;
  const fy = oy - 2;
  for (let xx = 0; xx < W; xx++) {
    const d = Math.abs(xx - fx) / (W * 0.5);
    const a = Math.max(0, 0.75 - d) * 0.9;
    if (a > 0 && !m(xx, fy)) p.px(xx, fy, lamp[4], a);
  }
  p.px(fx, fy, "#ffffff").px(fx + 1, fy, "#ffffff");
  for (let k = 1; k <= 3; k++) {
    const a = 1 - k / 4;
    p.px(fx, fy - k, lamp[5], a).px(fx + 1, fy - k, lamp[5], a * 0.6);
  }
  p.glow(fx, fy, 6, lamp[4], 0.55);
  // tiny bone-colored base line to anchor the word
  for (let xx = ox + 4; xx < ox + textW - 4; xx++) {
    const d = Math.abs(xx - W / 2) / (textW / 2);
    p.px(xx, oy + glyphH + 3, bone[2], Math.max(0, 0.6 - d * 0.6));
  }
  return p.canvas;
}
