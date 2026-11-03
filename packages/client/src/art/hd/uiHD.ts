/**
 * HD UI kit (all sizes in render px): blackened-iron frames with brass/amber trim, rivets,
 * subtle engraving and worn edges; calm, dark interiors that stay readable behind text.
 *
 *   drawPanelHD(w, h, variant)    9-slice safe border = UI_HD.panelSlice (30 px)
 *   drawSlotHD(rarity, size)      item/skill slot, rarity-coloured inner rim + glow
 *   drawButtonHD(w, h, state, kind) 9-slice safe border = UI_HD.buttonSlice (18 px)
 *   drawBarFrameHD(w, h)          bar frame with a TRANSPARENT interior: draw your fill
 *                                 first at (BAR_INSET.x, BAR_INSET.y, w - 2x, h - 2y), then
 *                                 this frame on top. drawBarBackHD(w, h) is the empty trough.
 *   drawTitleLogoHD()             "RADIANCE" wordmark, 1100x220
 *
 * Edge strips of panels/buttons are uniform along their length (only corners carry
 * ornaments), so 9-slicing at the documented sizes never stretches a rivet or corner piece.
 *
 * Title font: the logo uses Cinzel 900 (`@fontsource/cinzel/900.css`). Await
 * `document.fonts.load('900 64px "Cinzel"')` before the first call; `TITLE_FONT_READY()`
 * reports whether it is loaded. Until it is, the logo renders with a serif fallback and is
 * NOT memoized, so a later call (after the font loads) produces the proper wordmark.
 * All outputs are memoized per argument set.
 */
import { RARITY_COLORS } from "../palette";
import { canvas, ctx2d, INK_COLOR, mixHex, seeded, withAlpha } from "./ink";

export const UI_HD = { panelSlice: 30, buttonSlice: 18 } as const;

/** Fill area inside a bar frame: x from BAR_INSET.x to w - BAR_INSET.x, y likewise. */
export const BAR_INSET = { x: 7, y: 5 } as const;

export type PanelVariant = "default" | "inset" | "highlight";
export type SlotRarity = "common" | "uncommon" | "rare" | "epic" | "relic" | "empty";
export type ButtonState = "idle" | "hover" | "pressed" | "disabled";
export type ButtonKind = "primary" | "secondary" | "danger";

const BRASS = { hi: "#ffe39a", lt: "#f2b65a", mid: "#c7801f", dk: "#7a3d12", deep: "#3b1f0e" };
const IRON = { hi: "#6a7488", lt: "#4a5264", mid: "#2c313d", dk: "#191c24", deep: "#0c0d12" };

const memo = new Map<string, HTMLCanvasElement>();
function cached(key: string, make: () => HTMLCanvasElement): HTMLCanvasElement {
  const hit = memo.get(key);
  if (hit) return hit;
  const c = make();
  memo.set(key, c);
  return c;
}

// ---------------------------------------------------------------------------
// Shared bits
// ---------------------------------------------------------------------------

function rrect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.roundRect(x, y, Math.max(0, w), Math.max(0, h), Math.max(0, Math.min(r, w / 2, h / 2)));
}

/** Chamfered (cut-corner) rectangle path. */
function chamfer(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, c: number) {
  const k = Math.min(c, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + k, y);
  ctx.lineTo(x + w - k, y);
  ctx.lineTo(x + w, y + k);
  ctx.lineTo(x + w, y + h - k);
  ctx.lineTo(x + w - k, y + h);
  ctx.lineTo(x + k, y + h);
  ctx.lineTo(x, y + h - k);
  ctx.lineTo(x, y + k);
  ctx.closePath();
}

/** Speckle/scratch texture clipped to the current path, alpha-only. */
function grime(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, seed: number, amt: number) {
  const rnd = seeded(seed);
  const n = Math.round(w * h * 0.004 * amt);
  for (let i = 0; i < n; i++) {
    const px = x + rnd() * w;
    const py = y + rnd() * h;
    const light = rnd() < 0.35;
    ctx.fillStyle = light ? `rgba(255,235,200,${0.05 + rnd() * 0.07})` : `rgba(0,0,0,${0.12 + rnd() * 0.2})`;
    if (rnd() < 0.15) {
      ctx.fillRect(px, py, 2 + rnd() * 8, 1);
    } else {
      ctx.beginPath();
      ctx.arc(px, py, 0.5 + rnd() * 1.1, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

function rivet(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, tone: "brass" | "iron" = "brass") {
  const pal = tone === "brass" ? BRASS : IRON;
  ctx.fillStyle = INK_COLOR;
  ctx.beginPath();
  ctx.arc(x, y + 0.6, r + 1.3, 0, Math.PI * 2);
  ctx.fill();
  const g = ctx.createRadialGradient(x - r * 0.4, y - r * 0.45, r * 0.1, x, y, r);
  g.addColorStop(0, pal.hi);
  g.addColorStop(0.45, pal.lt);
  g.addColorStop(1, pal.dk);
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
}

/** Ornate brass corner piece in the top-left 30x30 cell (mirror with transforms). */
function cornerPiece(ctx: CanvasRenderingContext2D, glow: boolean) {
  // L bracket
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(3, 3);
  ctx.lineTo(28, 3);
  ctx.lineTo(28, 8);
  ctx.lineTo(13, 10);
  ctx.lineTo(10, 13);
  ctx.lineTo(8, 28);
  ctx.lineTo(3, 28);
  ctx.closePath();
  const g = ctx.createLinearGradient(3, 3, 22, 22);
  g.addColorStop(0, BRASS.hi);
  g.addColorStop(0.4, BRASS.mid);
  g.addColorStop(1, BRASS.dk);
  ctx.fillStyle = g;
  ctx.fill();
  ctx.lineWidth = 1.5;
  ctx.strokeStyle = INK_COLOR;
  ctx.stroke();
  // spike / fleur toward the interior
  ctx.beginPath();
  ctx.moveTo(10, 13);
  ctx.lineTo(13, 10);
  ctx.lineTo(22, 22);
  ctx.closePath();
  ctx.fillStyle = BRASS.lt;
  ctx.fill();
  ctx.stroke();
  ctx.restore();
  if (glow) {
    const gg = ctx.createRadialGradient(11, 11, 0, 11, 11, 14);
    gg.addColorStop(0, "rgba(255,200,110,0.55)");
    gg.addColorStop(1, "rgba(255,200,110,0)");
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    ctx.fillStyle = gg;
    ctx.fillRect(0, 0, 30, 30);
    ctx.restore();
  }
  rivet(ctx, 10.5, 10.5, 3.6);
}

function eachCorner(ctx: CanvasRenderingContext2D, w: number, h: number, fn: () => void) {
  for (const [sx, sy] of [
    [1, 1],
    [-1, 1],
    [1, -1],
    [-1, -1],
  ] as const) {
    ctx.save();
    ctx.translate(sx > 0 ? 0 : w, sy > 0 ? 0 : h);
    ctx.scale(sx, sy);
    fn();
    ctx.restore();
  }
}

// ---------------------------------------------------------------------------
// Panel
// ---------------------------------------------------------------------------

/** Gothic iron/brass panel; 9-slice safe border = 30 px. */
export function drawPanelHD(w: number, h: number, variant: PanelVariant = "default"): HTMLCanvasElement {
  const W = Math.max(64, Math.round(w));
  const H = Math.max(64, Math.round(h));
  return cached(`panel:${W}x${H}:${variant}`, () => {
    const c = canvas(W, H);
    const ctx = ctx2d(c);
    const inset = variant === "inset";
    const hi = variant === "highlight";

    // 1) ink edge + iron frame band (bevelled)
    rrect(ctx, 0, 0, W, H, 10);
    ctx.fillStyle = INK_COLOR;
    ctx.fill();
    rrect(ctx, 2, 2, W - 4, H - 4, 9);
    const fg = ctx.createLinearGradient(0, 0, 0, H);
    fg.addColorStop(0, inset ? IRON.mid : IRON.lt);
    fg.addColorStop(Math.min(0.5, 24 / H), IRON.mid);
    fg.addColorStop(1 - Math.min(0.5, 24 / H), IRON.dk);
    fg.addColorStop(1, IRON.deep);
    ctx.fillStyle = fg;
    ctx.fill();
    // band texture (edges only; interior is redrawn below)
    ctx.save();
    rrect(ctx, 2, 2, W - 4, H - 4, 9);
    ctx.clip();
    grime(ctx, 0, 0, W, H, W * 7 + H, 1.2);
    ctx.restore();
    // bevel: light top/left inner line, dark bottom/right
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = "rgba(200,210,230,0.22)";
    ctx.beginPath();
    ctx.moveTo(4, H - 12);
    ctx.lineTo(4, 12);
    ctx.quadraticCurveTo(4, 4, 12, 4);
    ctx.lineTo(W - 12, 4);
    ctx.stroke();
    ctx.strokeStyle = "rgba(0,0,0,0.5)";
    ctx.beginPath();
    ctx.moveTo(W - 4, 12);
    ctx.lineTo(W - 4, H - 12);
    ctx.quadraticCurveTo(W - 4, H - 4, W - 12, H - 4);
    ctx.lineTo(12, H - 4);
    ctx.stroke();

    // 2) brass trim line (or iron groove for inset)
    const tr = inset ? 9 : 11;
    rrect(ctx, tr - 1.5, tr - 1.5, W - (tr - 1.5) * 2, H - (tr - 1.5) * 2, 6);
    ctx.lineWidth = inset ? 2 : 5.5;
    ctx.strokeStyle = INK_COLOR;
    ctx.stroke();
    rrect(ctx, tr - 1.5, tr - 1.5, W - (tr - 1.5) * 2, H - (tr - 1.5) * 2, 6);
    if (inset) {
      ctx.lineWidth = 1;
      ctx.strokeStyle = "rgba(160,170,190,0.18)";
    } else {
      const bg = ctx.createLinearGradient(0, 0, 0, H);
      bg.addColorStop(0, hi ? BRASS.hi : BRASS.lt);
      bg.addColorStop(0.5, hi ? BRASS.lt : BRASS.mid);
      bg.addColorStop(1, BRASS.dk);
      ctx.lineWidth = 2.6;
      ctx.strokeStyle = bg;
    }
    ctx.stroke();
    if (hi) {
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      rrect(ctx, tr - 1.5, tr - 1.5, W - (tr - 1.5) * 2, H - (tr - 1.5) * 2, 6);
      ctx.lineWidth = 6;
      ctx.strokeStyle = "rgba(242,169,59,0.22)";
      ctx.stroke();
      ctx.restore();
    }

    // 3) interior (inset at 20): calm, dark, faint gradient + vignette + grain
    const ip = inset ? 14 : 19;
    rrect(ctx, ip - 2, ip - 2, W - (ip - 2) * 2, H - (ip - 2) * 2, 5);
    ctx.fillStyle = INK_COLOR;
    ctx.fill();
    rrect(ctx, ip, ip, W - ip * 2, H - ip * 2, 4);
    const ig = ctx.createLinearGradient(0, ip, 0, H - ip);
    if (inset) {
      ig.addColorStop(0, "#08070c");
      ig.addColorStop(1, "#0c0a12");
    } else {
      ig.addColorStop(0, hi ? "#1f1820" : "#18141f");
      ig.addColorStop(0.5, "#120f18");
      ig.addColorStop(1, "#0c0a10");
    }
    ctx.fillStyle = ig;
    ctx.fill();
    ctx.save();
    rrect(ctx, ip, ip, W - ip * 2, H - ip * 2, 4);
    ctx.clip();
    if (hi) {
      const wg = ctx.createRadialGradient(W / 2, ip, 0, W / 2, ip, Math.max(W, H) * 0.7);
      wg.addColorStop(0, "rgba(242,169,59,0.13)");
      wg.addColorStop(1, "rgba(242,169,59,0)");
      ctx.fillStyle = wg;
      ctx.fillRect(0, 0, W, H);
    }
    // inner shadow cast by the frame
    for (const [x0, y0, x1, y1, a] of [
      [0, ip, 0, ip + 14, 0.55],
      [ip, 0, ip + 10, 0, 0.35],
      [W - ip, 0, W - ip - 10, 0, 0.35],
      [0, H - ip, 0, H - ip - 8, 0.3],
    ] as const) {
      const sg = ctx.createLinearGradient(x0, y0, x1, y1);
      sg.addColorStop(0, `rgba(0,0,0,${a})`);
      sg.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = sg;
      ctx.fillRect(0, 0, W, H);
    }
    grime(ctx, ip, ip, W - ip * 2, H - ip * 2, W + H * 13, inset ? 0.25 : 0.35);
    ctx.restore();
    // faint highlight under the inner lip (bottom edge reflection)
    ctx.strokeStyle = "rgba(255,220,170,0.06)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(ip + 6, H - ip + 0.5);
    ctx.lineTo(W - ip - 6, H - ip + 0.5);
    ctx.stroke();

    // 4) corner pieces (inside the 30x30 corner cells)
    if (!inset) eachCorner(ctx, W, H, () => cornerPiece(ctx, hi));
    else
      eachCorner(ctx, W, H, () => {
        rivet(ctx, 7.5, 7.5, 2.6, "iron");
      });
    return c;
  });
}

// ---------------------------------------------------------------------------
// Slot
// ---------------------------------------------------------------------------

/** Item/skill slot frame; rarity-coloured inner rim and glow. */
export function drawSlotHD(rarity: SlotRarity = "empty", size = 96): HTMLCanvasElement {
  const S = Math.max(24, Math.round(size));
  return cached(`slot:${rarity}:${S}`, () => {
    const c = canvas(S, S);
    const ctx = ctx2d(c);
    const k = S / 96;
    ctx.scale(k, k);
    const empty = rarity === "empty";
    const col = empty ? "#5a5466" : RARITY_COLORS[rarity];
    // frame
    rrect(ctx, 0, 0, 96, 96, 11);
    ctx.fillStyle = INK_COLOR;
    ctx.fill();
    rrect(ctx, 2, 2, 92, 92, 10);
    const fg = ctx.createLinearGradient(0, 0, 0, 96);
    fg.addColorStop(0, IRON.hi);
    fg.addColorStop(0.18, IRON.lt);
    fg.addColorStop(0.6, IRON.mid);
    fg.addColorStop(1, IRON.deep);
    ctx.fillStyle = fg;
    ctx.fill();
    ctx.save();
    rrect(ctx, 2, 2, 92, 92, 10);
    ctx.clip();
    grime(ctx, 0, 0, 96, 96, 77 + S, 1.4);
    ctx.restore();
    // recess
    rrect(ctx, 9, 9, 78, 78, 6);
    ctx.fillStyle = INK_COLOR;
    ctx.fill();
    rrect(ctx, 11, 11, 74, 74, 5);
    const rg = ctx.createRadialGradient(48, 44, 4, 48, 50, 54);
    rg.addColorStop(0, empty ? "#15121c" : mixHex("#120f18", col, 0.16));
    rg.addColorStop(0.7, "#0b0910");
    rg.addColorStop(1, "#050408");
    ctx.fillStyle = rg;
    ctx.fill();
    ctx.save();
    rrect(ctx, 11, 11, 74, 74, 5);
    ctx.clip();
    const sh = ctx.createLinearGradient(0, 11, 0, 26);
    sh.addColorStop(0, "rgba(0,0,0,0.6)");
    sh.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = sh;
    ctx.fillRect(0, 0, 96, 96);
    if (!empty) {
      // inner rarity glow rising from the rim
      for (const [x0, y0, x1, y1] of [
        [0, 85, 0, 60],
        [11, 0, 30, 0],
        [85, 0, 66, 0],
        [0, 11, 0, 28],
      ] as const) {
        const gg = ctx.createLinearGradient(x0, y0, x1, y1);
        gg.addColorStop(0, withAlpha(col, rarity === "common" ? 0.12 : 0.3));
        gg.addColorStop(1, withAlpha(col, 0));
        ctx.fillStyle = gg;
        ctx.fillRect(0, 0, 96, 96);
      }
    } else {
      // empty socket: faint engraved diamond
      ctx.strokeStyle = "rgba(160,150,180,0.12)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(48, 30);
      ctx.lineTo(66, 48);
      ctx.lineTo(48, 66);
      ctx.lineTo(30, 48);
      ctx.closePath();
      ctx.stroke();
    }
    ctx.restore();
    // rarity rim
    rrect(ctx, 11, 11, 74, 74, 5);
    ctx.lineWidth = empty ? 1.2 : 2.4;
    ctx.strokeStyle = withAlpha(col, empty ? 0.35 : 0.95);
    ctx.stroke();
    // top bevel highlight on the frame
    ctx.strokeStyle = "rgba(220,228,245,0.25)";
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(4.5, 80);
    ctx.lineTo(4.5, 13);
    ctx.quadraticCurveTo(4.5, 4.5, 13, 4.5);
    ctx.lineTo(83, 4.5);
    ctx.stroke();
    // corner brackets in rarity colour (brass for empty/common)
    const bc = empty || rarity === "common" ? BRASS.mid : col;
    eachCorner(ctx, 96, 96, () => {
      ctx.beginPath();
      ctx.moveTo(5, 22);
      ctx.lineTo(5, 5);
      ctx.lineTo(22, 5);
      ctx.lineTo(22, 9.5);
      ctx.lineTo(9.5, 9.5);
      ctx.lineTo(9.5, 22);
      ctx.closePath();
      ctx.fillStyle = INK_COLOR;
      ctx.lineWidth = 3;
      ctx.strokeStyle = INK_COLOR;
      ctx.stroke();
      const g = ctx.createLinearGradient(5, 5, 22, 22);
      g.addColorStop(0, mixHex(bc, "#ffffff", 0.45));
      g.addColorStop(1, mixHex(bc, "#000000", 0.35));
      ctx.fillStyle = empty ? withAlpha(BRASS.dk, 0.9) : g;
      ctx.fill();
    });
    if (rarity === "relic" || rarity === "epic") {
      // a jewel at the top centre
      ctx.save();
      ctx.translate(48, 6);
      ctx.beginPath();
      ctx.moveTo(0, -4.5);
      ctx.lineTo(6, 1);
      ctx.lineTo(0, 6.5);
      ctx.lineTo(-6, 1);
      ctx.closePath();
      ctx.fillStyle = INK_COLOR;
      ctx.lineWidth = 3;
      ctx.strokeStyle = INK_COLOR;
      ctx.stroke();
      const jg = ctx.createLinearGradient(-6, -4, 6, 6);
      jg.addColorStop(0, mixHex(col, "#ffffff", 0.6));
      jg.addColorStop(1, mixHex(col, "#000000", 0.3));
      ctx.fillStyle = jg;
      ctx.fill();
      ctx.restore();
    }
    if (rarity === "relic") {
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      rrect(ctx, 10, 10, 76, 76, 6);
      ctx.lineWidth = 5;
      ctx.strokeStyle = withAlpha(col, 0.25);
      ctx.stroke();
      ctx.restore();
    }
    return c;
  });
}

// ---------------------------------------------------------------------------
// Button
// ---------------------------------------------------------------------------

const FACES: Record<ButtonKind, { top: string; bot: string; rim: string; rimDk: string; glow: string }> = {
  primary: { top: "#a35a1c", bot: "#4a220a", rim: BRASS.lt, rimDk: BRASS.dk, glow: "#ffb84a" },
  secondary: { top: "#3c4252", bot: "#171a22", rim: "#b98a4a", rimDk: "#4a3018", glow: "#d8b070" },
  danger: { top: "#8a2a22", bot: "#33090c", rim: "#c27a5a", rimDk: "#4d1518", glow: "#ff6a4a" },
};

/** Forged button; 9-slice safe border = 18 px. */
export function drawButtonHD(w: number, h: number, state: ButtonState, kind: ButtonKind = "primary"): HTMLCanvasElement {
  const W = Math.max(40, Math.round(w));
  const H = Math.max(36, Math.round(h));
  return cached(`btn:${W}x${H}:${state}:${kind}`, () => {
    const c = canvas(W, H);
    const ctx = ctx2d(c);
    const f = FACES[kind];
    const dis = state === "disabled";
    const hov = state === "hover";
    const prs = state === "pressed";
    const face = dis
      ? { top: "#2e2c33", bot: "#17161b", rim: "#5a5660", rimDk: "#2a282e", glow: "#000000" }
      : {
          ...f,
          top: hov ? mixHex(f.top, "#ffd38a", 0.18) : prs ? mixHex(f.top, "#000000", 0.3) : f.top,
          bot: prs ? mixHex(f.bot, "#000000", 0.2) : f.bot,
        };
    const ch = 9;
    // hover glow in the outer 3px
    if (hov) {
      ctx.save();
      chamfer(ctx, 0.5, 0.5, W - 1, H - 1, ch + 1);
      ctx.lineWidth = 3;
      ctx.strokeStyle = withAlpha(face.glow, 0.45);
      ctx.stroke();
      ctx.restore();
    }
    // ink + iron frame
    chamfer(ctx, 2, 2, W - 4, H - 4, ch);
    ctx.fillStyle = INK_COLOR;
    ctx.fill();
    chamfer(ctx, 3.5, 3.5, W - 7, H - 7, ch - 1);
    const fr = ctx.createLinearGradient(0, 0, 0, H);
    fr.addColorStop(0, dis ? "#3a383e" : face.rim);
    fr.addColorStop(0.5, dis ? "#2a282e" : mixHex(face.rim, face.rimDk, 0.5));
    fr.addColorStop(1, dis ? "#1a191d" : face.rimDk);
    ctx.fillStyle = fr;
    ctx.fill();
    // face
    const py = prs ? 1.5 : 0;
    chamfer(ctx, 7, 7 + py, W - 14, H - 14, ch - 3);
    ctx.fillStyle = INK_COLOR;
    ctx.fill();
    chamfer(ctx, 8, 8 + py, W - 16, H - 16, ch - 3.5);
    const fg = ctx.createLinearGradient(0, 8, 0, H - 8);
    fg.addColorStop(0, face.top);
    fg.addColorStop(0.55, mixHex(face.top, face.bot, 0.6));
    fg.addColorStop(1, face.bot);
    ctx.fillStyle = fg;
    ctx.fill();
    ctx.save();
    chamfer(ctx, 8, 8 + py, W - 16, H - 16, ch - 3.5);
    ctx.clip();
    grime(ctx, 8, 8, W - 16, H - 16, W * 3 + H, dis ? 0.6 : 0.9);
    if (prs) {
      const sg = ctx.createLinearGradient(0, 8, 0, 20);
      sg.addColorStop(0, "rgba(0,0,0,0.55)");
      sg.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = sg;
      ctx.fillRect(0, 0, W, H);
    } else if (!dis) {
      // glossy upper sheen
      const sh = ctx.createLinearGradient(0, 8, 0, H * 0.55);
      sh.addColorStop(0, `rgba(255,230,180,${hov ? 0.28 : 0.16})`);
      sh.addColorStop(1, "rgba(255,230,180,0)");
      ctx.fillStyle = sh;
      ctx.fillRect(0, 0, W, H * 0.55);
    }
    if (hov) {
      const gg = ctx.createRadialGradient(W / 2, H, 0, W / 2, H, Math.max(W, H) * 0.7);
      gg.addColorStop(0, withAlpha(face.glow, 0.28));
      gg.addColorStop(1, withAlpha(face.glow, 0));
      ctx.fillStyle = gg;
      ctx.fillRect(0, 0, W, H);
    }
    ctx.restore();
    // engraved inner line
    chamfer(ctx, 11.5, 11.5 + py, W - 23, H - 23, ch - 5);
    ctx.lineWidth = 1;
    ctx.strokeStyle = dis ? "rgba(255,255,255,0.05)" : "rgba(255,225,170,0.16)";
    ctx.stroke();
    // top bevel highlight of the frame
    ctx.strokeStyle = dis ? "rgba(255,255,255,0.08)" : `rgba(255,240,200,${hov ? 0.6 : 0.4})`;
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(ch + 3, 4.5);
    ctx.lineTo(W - ch - 3, 4.5);
    ctx.stroke();
    // corner studs (inside the 18px corner cells)
    for (const [x, y] of [
      [10.5, 10.5],
      [W - 10.5, 10.5],
      [10.5, H - 10.5],
      [W - 10.5, H - 10.5],
    ] as const) {
      if (H < 44) continue;
      rivet(ctx, x, y + py * 0.5, 2.2, dis ? "iron" : "brass");
    }
    if (dis) {
      ctx.fillStyle = "rgba(8,6,12,0.25)";
      chamfer(ctx, 2, 2, W - 4, H - 4, ch);
      ctx.fill();
    }
    return c;
  });
}

// ---------------------------------------------------------------------------
// Bars
// ---------------------------------------------------------------------------

/** Bar frame (default h = 22) with a transparent interior; fill area at BAR_INSET. */
export function drawBarFrameHD(w: number, h = 22): HTMLCanvasElement {
  const W = Math.max(BAR_INSET.x * 2 + 8, Math.round(w));
  const H = Math.max(BAR_INSET.y * 2 + 4, Math.round(h));
  return cached(`bar:${W}x${H}`, () => {
    const c = canvas(W, H);
    const ctx = ctx2d(c);
    const ix = BAR_INSET.x;
    const iy = BAR_INSET.y;
    const r = Math.min(6, H / 2);
    // frame ring = outer rounded rect minus the inner fill window
    const ring = () => {
      ctx.beginPath();
      ctx.roundRect(0, 0, W, H, r);
      ctx.roundRect(ix, iy, W - ix * 2, H - iy * 2, Math.max(1, r - 3));
    };
    ring();
    ctx.fillStyle = INK_COLOR;
    ctx.fill("evenodd");
    ctx.beginPath();
    ctx.roundRect(1.5, 1.5, W - 3, H - 3, r - 1);
    ctx.roundRect(ix - 1.5, iy - 1.5, W - ix * 2 + 3, H - iy * 2 + 3, Math.max(1, r - 2));
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, IRON.hi);
    g.addColorStop(0.45, IRON.lt);
    g.addColorStop(1, IRON.dk);
    ctx.fillStyle = g;
    ctx.fill("evenodd");
    // brass end caps
    for (const x0 of [1.5, W - ix + 0.5]) {
      ctx.save();
      ctx.beginPath();
      ctx.roundRect(x0, 1.5, ix - 2, H - 3, Math.max(1, r - 1));
      const bg = ctx.createLinearGradient(0, 0, 0, H);
      bg.addColorStop(0, BRASS.hi);
      bg.addColorStop(0.5, BRASS.mid);
      bg.addColorStop(1, BRASS.dk);
      ctx.fillStyle = bg;
      ctx.fill();
      ctx.lineWidth = 1;
      ctx.strokeStyle = INK_COLOR;
      ctx.stroke();
      ctx.restore();
    }
    // inner window ink line
    ctx.beginPath();
    ctx.roundRect(ix - 0.5, iy - 0.5, W - ix * 2 + 1, H - iy * 2 + 1, Math.max(1, r - 3));
    ctx.lineWidth = 1.2;
    ctx.strokeStyle = INK_COLOR;
    ctx.stroke();
    // glass: inner top shadow and a thin highlight line over the fill
    const ih = H - iy * 2;
    ctx.save();
    ctx.beginPath();
    ctx.rect(ix, iy, W - ix * 2, ih);
    ctx.clip();
    const sh = ctx.createLinearGradient(0, iy, 0, iy + Math.max(2, ih * 0.5));
    sh.addColorStop(0, "rgba(0,0,0,0.45)");
    sh.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = sh;
    ctx.fillRect(ix, iy, W - ix * 2, ih);
    ctx.fillStyle = "rgba(255,245,225,0.22)";
    ctx.fillRect(ix + 2, iy + Math.max(1, ih * 0.22), W - ix * 2 - 4, Math.max(1, ih * 0.12));
    const bt = ctx.createLinearGradient(0, iy + ih * 0.6, 0, iy + ih);
    bt.addColorStop(0, "rgba(0,0,0,0)");
    bt.addColorStop(1, "rgba(0,0,0,0.3)");
    ctx.fillStyle = bt;
    ctx.fillRect(ix, iy, W - ix * 2, ih);
    ctx.restore();
    // top bevel highlight
    ctx.strokeStyle = "rgba(230,236,250,0.3)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(ix, 2);
    ctx.lineTo(W - ix, 2);
    ctx.stroke();
    return c;
  });
}

/** The empty trough to draw under a bar fill (same size as the frame). */
export function drawBarBackHD(w: number, h = 22): HTMLCanvasElement {
  const W = Math.max(BAR_INSET.x * 2 + 8, Math.round(w));
  const H = Math.max(BAR_INSET.y * 2 + 4, Math.round(h));
  return cached(`barback:${W}x${H}`, () => {
    const c = canvas(W, H);
    const ctx = ctx2d(c);
    ctx.beginPath();
    ctx.roundRect(BAR_INSET.x - 1, BAR_INSET.y - 1, W - BAR_INSET.x * 2 + 2, H - BAR_INSET.y * 2 + 2, 2);
    const g = ctx.createLinearGradient(0, BAR_INSET.y, 0, H - BAR_INSET.y);
    g.addColorStop(0, "#040306");
    g.addColorStop(1, "#14111b");
    ctx.fillStyle = g;
    ctx.fill();
    return c;
  });
}

// ---------------------------------------------------------------------------
// Title logo
// ---------------------------------------------------------------------------

const TITLE_FONT_STACK = '"Cinzel", "Trajan Pro", "Cormorant SC", Georgia, serif';

/** True once Cinzel 900 is available for the title wordmark. */
export const TITLE_FONT_READY = (): boolean => {
  try {
    return document.fonts.check('900 64px "Cinzel"');
  } catch {
    return false;
  }
};

/** "RADIANCE" wordmark, 1100x220: forged gothic letters, ink outline, bevel, gold, glow. */
export function drawTitleLogoHD(): HTMLCanvasElement {
  const ready = TITLE_FONT_READY();
  const hit = ready ? memo.get("logo") : undefined;
  if (hit) return hit;
  const W = 1100;
  const H = 220;
  const c = canvas(W, H);
  const ctx = ctx2d(c);
  const word = "RADIANCE";
  const spacing = 16;
  let size = 150;
  const setFont = () => {
    ctx.font = `900 ${size}px ${TITLE_FONT_STACK}`;
    (ctx as CanvasRenderingContext2D & { letterSpacing: string }).letterSpacing = `${spacing}px`;
  };
  setFont();
  let tw = ctx.measureText(word).width - spacing;
  if (tw > 960) {
    size = Math.floor((size * 960) / tw);
    setFont();
    tw = ctx.measureText(word).width - spacing;
  }
  const x0 = (W - tw) / 2;
  const base = 150;
  const capTop = base - size * 0.7;

  // letter mask canvas (reused for bevel passes)
  const mask = canvas(W, H);
  const m = ctx2d(mask);
  const drawText = (cx: CanvasRenderingContext2D, dx = 0, dy = 0) => {
    cx.font = ctx.font;
    (cx as CanvasRenderingContext2D & { letterSpacing: string }).letterSpacing = `${spacing}px`;
    cx.textBaseline = "alphabetic";
    cx.fillText(word, x0 + dx, base + dy);
  };

  // 1) back glow + horizon flare
  ctx.save();
  ctx.translate(W / 2, base - size * 0.36);
  ctx.scale(1, 0.3);
  const bg = ctx.createRadialGradient(0, 0, 0, 0, 0, W * 0.5);
  bg.addColorStop(0, "rgba(242,169,59,0.42)");
  bg.addColorStop(0.45, "rgba(199,113,28,0.14)");
  bg.addColorStop(1, "rgba(199,113,28,0)");
  ctx.fillStyle = bg;
  ctx.fillRect(-W / 2, -H * 2, W, H * 4);
  ctx.restore();

  // 2) drop shadow + heavy ink outline
  ctx.save();
  ctx.lineJoin = "round";
  ctx.textBaseline = "alphabetic";
  ctx.shadowColor = "rgba(0,0,0,0.85)";
  ctx.shadowBlur = 18;
  ctx.shadowOffsetY = 8;
  ctx.strokeStyle = INK_COLOR;
  ctx.lineWidth = 18;
  ctx.strokeText(word, x0, base);
  ctx.restore();
  // 3) dark brass outer rim
  ctx.save();
  ctx.lineJoin = "round";
  const rimG = ctx.createLinearGradient(0, capTop, 0, base);
  rimG.addColorStop(0, "#8a4a14");
  rimG.addColorStop(0.5, "#5a2a0c");
  rimG.addColorStop(1, "#2e1406");
  ctx.strokeStyle = rimG;
  ctx.lineWidth = 9;
  ctx.strokeText(word, x0, base);
  ctx.strokeStyle = INK_COLOR;
  ctx.lineWidth = 2.5;
  ctx.strokeText(word, x0, base);
  ctx.restore();

  // 4) metallic gold fill on the mask, with bevel, engraving and grain
  const fill = ctx.createLinearGradient(0, capTop, 0, base);
  fill.addColorStop(0, "#fff6d6");
  fill.addColorStop(0.22, "#ffd77a");
  fill.addColorStop(0.47, "#e89a35");
  fill.addColorStop(0.5, "#7a3a10");
  fill.addColorStop(0.56, "#b8661c");
  fill.addColorStop(0.8, "#f2b14a");
  fill.addColorStop(1, "#ffd98a");
  m.fillStyle = fill;
  drawText(m);
  m.save();
  m.globalCompositeOperation = "source-atop";
  // bevel: lit top-left edges
  const hl = canvas(W, H);
  const h1 = ctx2d(hl);
  h1.fillStyle = "#fff8e0";
  drawText(h1);
  h1.globalCompositeOperation = "destination-out";
  drawText(h1, 2.5, 3);
  m.globalAlpha = 0.85;
  m.drawImage(hl, 0, 0);
  // bevel: shaded bottom-right edges
  const sl = canvas(W, H);
  const s1 = ctx2d(sl);
  s1.fillStyle = "#3b1606";
  drawText(s1);
  s1.globalCompositeOperation = "destination-out";
  drawText(s1, -2.5, -3);
  m.globalAlpha = 0.8;
  m.drawImage(sl, 0, 0);
  m.globalAlpha = 1;
  // engraving: fine horizontal lines + speckled wear
  m.fillStyle = "rgba(60,25,5,0.14)";
  for (let y = Math.floor(capTop); y < base; y += 4) m.fillRect(0, y, W, 1);
  const rnd = seeded(1977);
  for (let i = 0; i < 900; i++) {
    m.fillStyle = rnd() < 0.5 ? "rgba(70,30,5,0.35)" : "rgba(255,250,230,0.3)";
    m.fillRect(x0 + rnd() * tw, capTop + rnd() * (base - capTop), 1 + rnd() * 2, 1);
  }
  m.restore();
  ctx.drawImage(mask, 0, 0);

  // 5) inner warm glow + lens flare at the top of the "I"
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  ctx.globalAlpha = 0.18;
  ctx.filter = "blur(6px)";
  ctx.drawImage(mask, 0, 0);
  ctx.restore();
  ctx.font = `900 ${size}px ${TITLE_FONT_STACK}`;
  (ctx as CanvasRenderingContext2D & { letterSpacing: string }).letterSpacing = `${spacing}px`;
  const before = ctx.measureText("RAD").width;
  const iw = ctx.measureText("I").width - spacing;
  const fx = x0 + before + iw / 2;
  const fy = capTop + 2;
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  const lg = ctx.createLinearGradient(fx - 420, 0, fx + 420, 0);
  lg.addColorStop(0, "rgba(255,211,110,0)");
  lg.addColorStop(0.5, "rgba(255,235,180,0.75)");
  lg.addColorStop(1, "rgba(255,211,110,0)");
  ctx.fillStyle = lg;
  ctx.fillRect(fx - 420, fy - 1, 840, 2);
  const fg = ctx.createRadialGradient(fx, fy, 0, fx, fy, 46);
  fg.addColorStop(0, "rgba(255,250,230,0.95)");
  fg.addColorStop(0.2, "rgba(255,211,110,0.55)");
  fg.addColorStop(1, "rgba(255,170,60,0)");
  ctx.fillStyle = fg;
  ctx.fillRect(fx - 46, fy - 46, 92, 92);
  ctx.strokeStyle = "rgba(255,245,215,0.85)";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(fx, fy - 34);
  ctx.lineTo(fx, fy + 34);
  ctx.stroke();
  ctx.restore();

  // 6) forged ornament rule beneath: brass line with a lamp-diamond centre
  const ry = base + 26;
  ctx.save();
  for (const sd of [-1, 1]) {
    const g = ctx.createLinearGradient(W / 2, 0, W / 2 + sd * (tw / 2 + 10), 0);
    g.addColorStop(0, "#f2b14a");
    g.addColorStop(1, "rgba(199,113,28,0)");
    ctx.fillStyle = INK_COLOR;
    ctx.fillRect(sd < 0 ? W / 2 - tw / 2 - 10 : W / 2 + 14, ry - 3, tw / 2 - 4, 6);
    ctx.fillStyle = g;
    ctx.fillRect(sd < 0 ? W / 2 - tw / 2 - 10 : W / 2 + 14, ry - 1.5, tw / 2 - 4, 3);
  }
  ctx.translate(W / 2, ry);
  ctx.beginPath();
  ctx.moveTo(0, -12);
  ctx.lineTo(12, 0);
  ctx.lineTo(0, 12);
  ctx.lineTo(-12, 0);
  ctx.closePath();
  ctx.fillStyle = INK_COLOR;
  ctx.lineWidth = 5;
  ctx.strokeStyle = INK_COLOR;
  ctx.stroke();
  const dg = ctx.createLinearGradient(-10, -10, 10, 10);
  dg.addColorStop(0, "#fff3c4");
  dg.addColorStop(0.5, "#f2a93b");
  dg.addColorStop(1, "#7a3d12");
  ctx.fillStyle = dg;
  ctx.fill();
  ctx.globalCompositeOperation = "lighter";
  const gg = ctx.createRadialGradient(0, 0, 0, 0, 0, 30);
  gg.addColorStop(0, "rgba(255,211,110,0.6)");
  gg.addColorStop(1, "rgba(255,211,110,0)");
  ctx.fillStyle = gg;
  ctx.fillRect(-30, -30, 60, 60);
  ctx.restore();

  if (ready) memo.set("logo", c);
  return c;
}
