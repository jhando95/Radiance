/**
 * Minimal pixel-art drawing toolkit. Art is authored at native resolution on a small
 * grid, then displayed scaled up with nearest-neighbour filtering (Phaser `pixelArt: true`).
 *
 * Coordinates are integer pixels; (0,0) is top-left. Colors are "#rrggbb" strings
 * (optionally with alpha via `alpha` args). Empty string = transparent / skip.
 */
import { INK } from "./palette";

/** Deterministic tiny PRNG for art variation (mulberry32). Never use Math.random in art. */
export function artRng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function makeCanvas(w: number, h: number): HTMLCanvasElement {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  return c;
}

export class Pix {
  readonly canvas: HTMLCanvasElement;
  readonly ctx: CanvasRenderingContext2D;

  constructor(
    readonly w: number,
    readonly h: number,
  ) {
    this.canvas = makeCanvas(w, h);
    const ctx = this.canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) throw new Error("2D canvas unavailable");
    ctx.imageSmoothingEnabled = false;
    this.ctx = ctx;
  }

  px(x: number, y: number, color: string, alpha = 1): this {
    if (!color || x < 0 || y < 0 || x >= this.w || y >= this.h) return this;
    this.ctx.globalAlpha = alpha;
    this.ctx.fillStyle = color;
    this.ctx.fillRect(Math.round(x), Math.round(y), 1, 1);
    this.ctx.globalAlpha = 1;
    return this;
  }

  rect(x: number, y: number, w: number, h: number, color: string, alpha = 1): this {
    if (!color || w <= 0 || h <= 0) return this;
    this.ctx.globalAlpha = alpha;
    this.ctx.fillStyle = color;
    this.ctx.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
    this.ctx.globalAlpha = 1;
    return this;
  }

  /** Horizontal span from x0 to x1 inclusive. */
  hline(x0: number, x1: number, y: number, color: string, alpha = 1): this {
    const a = Math.min(x0, x1);
    return this.rect(a, y, Math.abs(x1 - x0) + 1, 1, color, alpha);
  }

  vline(x: number, y0: number, y1: number, color: string, alpha = 1): this {
    const a = Math.min(y0, y1);
    return this.rect(x, a, 1, Math.abs(y1 - y0) + 1, color, alpha);
  }

  /** Bresenham line. */
  line(x0: number, y0: number, x1: number, y1: number, color: string, alpha = 1): this {
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
      this.px(x, y, color, alpha);
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

  /** Filled ellipse centered at (cx, cy) with radii rx, ry. */
  ellipse(cx: number, cy: number, rx: number, ry: number, color: string, alpha = 1): this {
    for (let y = -ry; y <= ry; y++) {
      for (let x = -rx; x <= rx; x++) {
        if ((x * x) / (rx * rx + 0.25) + (y * y) / (ry * ry + 0.25) <= 1) {
          this.px(cx + x, cy + y, color, alpha);
        }
      }
    }
    return this;
  }

  disc(cx: number, cy: number, r: number, color: string, alpha = 1): this {
    return this.ellipse(cx, cy, r, r, color, alpha);
  }

  /** Fill a polygon (scanline, even-odd). Points are [x,y] pairs. */
  poly(points: ReadonlyArray<readonly [number, number]>, color: string, alpha = 1): this {
    if (points.length < 3) return this;
    const ys = points.map((p) => p[1]);
    const minY = Math.floor(Math.min(...ys));
    const maxY = Math.ceil(Math.max(...ys));
    for (let y = minY; y <= maxY; y++) {
      const xs: number[] = [];
      for (let i = 0; i < points.length; i++) {
        const [ax, ay] = points[i] as readonly [number, number];
        const [bx, by] = points[(i + 1) % points.length] as readonly [number, number];
        const yc = y + 0.5;
        if ((ay <= yc && by > yc) || (by <= yc && ay > yc)) {
          xs.push(ax + ((yc - ay) / (by - ay)) * (bx - ax));
        }
      }
      xs.sort((a, b) => a - b);
      for (let i = 0; i + 1 < xs.length; i += 2) {
        const x0 = Math.round(xs[i] as number);
        const x1 = Math.round(xs[i + 1] as number) - 1;
        if (x1 >= x0) this.hline(x0, x1, y, color, alpha);
      }
    }
    return this;
  }

  /** Read a pixel's alpha (0..255). */
  alphaAt(x: number, y: number): number {
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return 0;
    return this.ctx.getImageData(x, y, 1, 1).data[3] ?? 0;
  }

  /**
   * Add a 1px outline around all opaque pixels (outside only). The single biggest
   * readability win for small sprites against dark backgrounds.
   */
  outline(color = INK, diagonal = false): this {
    const img = this.ctx.getImageData(0, 0, this.w, this.h);
    const src = img.data;
    const out = new Uint8ClampedArray(src);
    const [r, g, b] = [
      Number.parseInt(color.slice(1, 3), 16),
      Number.parseInt(color.slice(3, 5), 16),
      Number.parseInt(color.slice(5, 7), 16),
    ];
    const opaque = (x: number, y: number) =>
      x >= 0 && y >= 0 && x < this.w && y < this.h && (src[(y * this.w + x) * 4 + 3] ?? 0) > 40;
    for (let y = 0; y < this.h; y++) {
      for (let x = 0; x < this.w; x++) {
        if (opaque(x, y)) continue;
        const n =
          opaque(x - 1, y) ||
          opaque(x + 1, y) ||
          opaque(x, y - 1) ||
          opaque(x, y + 1) ||
          (diagonal &&
            (opaque(x - 1, y - 1) ||
              opaque(x + 1, y - 1) ||
              opaque(x - 1, y + 1) ||
              opaque(x + 1, y + 1)));
        if (n) {
          const i = (y * this.w + x) * 4;
          out[i] = r;
          out[i + 1] = g;
          out[i + 2] = b;
          out[i + 3] = 255;
        }
      }
    }
    img.data.set(out);
    this.ctx.putImageData(img, 0, 0);
    return this;
  }

  /** Draw another canvas onto this one at integer offset (optionally mirrored). */
  stamp(src: HTMLCanvasElement, x: number, y: number, flipX = false, alpha = 1): this {
    this.ctx.save();
    this.ctx.globalAlpha = alpha;
    if (flipX) {
      this.ctx.translate(x + src.width, y);
      this.ctx.scale(-1, 1);
      this.ctx.drawImage(src, 0, 0);
    } else {
      this.ctx.drawImage(src, Math.round(x), Math.round(y));
    }
    this.ctx.restore();
    return this;
  }

  /** Soft additive-ish glow (radial gradient) — use sparingly for lamps/magic. */
  glow(cx: number, cy: number, r: number, color: string, strength = 0.6): this {
    const g = this.ctx.createRadialGradient(cx + 0.5, cy + 0.5, 0, cx + 0.5, cy + 0.5, r);
    g.addColorStop(0, withAlpha(color, strength));
    g.addColorStop(1, withAlpha(color, 0));
    this.ctx.save();
    this.ctx.globalCompositeOperation = "lighter";
    this.ctx.fillStyle = g;
    this.ctx.fillRect(cx - r, cy - r, r * 2 + 1, r * 2 + 1);
    this.ctx.restore();
    return this;
  }
}

export function withAlpha(hex: string, a: number): string {
  const n = Number.parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}

/** Mirror a canvas horizontally (e.g. enemies face left, mercs face right). */
export function flipCanvas(src: HTMLCanvasElement): HTMLCanvasElement {
  const out = makeCanvas(src.width, src.height);
  const ctx = out.getContext("2d");
  if (!ctx) return src;
  ctx.translate(src.width, 0);
  ctx.scale(-1, 1);
  ctx.drawImage(src, 0, 0);
  return out;
}

/** Nearest-neighbour upscale (for DOM previews; Phaser scales itself). */
export function upscale(src: HTMLCanvasElement, factor: number): HTMLCanvasElement {
  const out = makeCanvas(src.width * factor, src.height * factor);
  const ctx = out.getContext("2d");
  if (!ctx) return src;
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(src, 0, 0, out.width, out.height);
  return out;
}

/** Ordered 4x4 Bayer threshold (0..1) for dithered gradients in backgrounds. */
const BAYER4 = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
export function bayer(x: number, y: number): number {
  return ((BAYER4[(y & 3) * 4 + (x & 3)] as number) + 0.5) / 16;
}
