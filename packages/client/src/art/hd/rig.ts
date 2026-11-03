/**
 * Cut-out rig: HD characters are built from separate part canvases (torso, head, arms,
 * weapon…) attached in a bone hierarchy and animated by blending between named poses. This
 * is the same cut-out/skeletal approach painted 2D games use, done procedurally.
 *
 * COORDINATES (all in RENDER pixels, 1080p scale):
 * - Root space: origin (0,0) is the ground point between the feet; +x is the character's
 *   FRONT (rigs are authored facing right), -y is up.
 * - `pivot`: the joint point inside the part's own canvas (e.g. shoulder of an arm).
 * - `at`: where that pivot sits — in ROOT space for root parts (parent null), or in the
 *   PARENT PART'S CANVAS coordinates for child parts (e.g. the shoulder socket on the torso).
 * - Pose transforms rotate (degrees, + = clockwise) / offset (px) / scale a part about its
 *   pivot; children inherit their parent's transform.
 */
import * as Phaser from "phaser";

export type HdPose = "idle" | "breathe" | "windup" | "attack" | "cast" | "hurt" | "downed";
export const HD_POSES: readonly HdPose[] = [
  "idle",
  "breathe",
  "windup",
  "attack",
  "cast",
  "hurt",
  "downed",
];

export interface RigPart {
  id: string;
  canvas: HTMLCanvasElement;
  pivot: readonly [number, number];
  parent: string | null;
  at: readonly [number, number];
  /** Draw order; higher = in front. */
  z: number;
}

export interface PartTransform {
  rot?: number;
  x?: number;
  y?: number;
  sx?: number;
  sy?: number;
  alpha?: number;
}

/** Per-part transforms for a pose. Missing parts use identity. */
export type RigPoseDef = Readonly<Record<string, PartTransform>>;

export interface RigGlow {
  /** Part the glow follows. */
  part: string;
  /** Position in that part's canvas px. */
  x: number;
  y: number;
  radius: number;
  color: string;
  alpha?: number;
}

export interface RigDef {
  /** Stable unique id (used for texture keys); include everything that changes the look. */
  id: string;
  parts: RigPart[];
  poses: Partial<Record<HdPose, RigPoseDef>>;
  /** Approximate standing height in render px (for UI layout, markers, bars). */
  height: number;
  /** Approximate width in render px. */
  width: number;
  /** Light sources that bloom additively (lanterns, eyes, void orbs). */
  glows?: RigGlow[];
}

// ---------------------------------------------------------------------------
// Math
// ---------------------------------------------------------------------------

type M = [number, number, number, number, number, number]; // a b c d e f

const ID: M = [1, 0, 0, 1, 0, 0];
const mul = (m: M, n: M): M => [
  m[0] * n[0] + m[2] * n[1],
  m[1] * n[0] + m[3] * n[1],
  m[0] * n[2] + m[2] * n[3],
  m[1] * n[2] + m[3] * n[3],
  m[0] * n[4] + m[2] * n[5] + m[4],
  m[1] * n[4] + m[3] * n[5] + m[5],
];
const translate = (x: number, y: number): M => [1, 0, 0, 1, x, y];
const rotate = (deg: number): M => {
  const r = (deg * Math.PI) / 180;
  const c = Math.cos(r);
  const s = Math.sin(r);
  return [c, s, -s, c, 0, 0];
};
const scale = (sx: number, sy: number): M => [sx, 0, 0, sy, 0, 0];
const apply = (m: M, x: number, y: number): [number, number] => [
  m[0] * x + m[2] * y + m[4],
  m[1] * x + m[3] * y + m[5],
];

function lerpT(
  a: PartTransform | undefined,
  b: PartTransform | undefined,
  t: number,
): Required<PartTransform> {
  const g = (o: PartTransform | undefined, k: keyof PartTransform, d: number) => o?.[k] ?? d;
  const l = (k: keyof PartTransform, d: number) => g(a, k, d) + (g(b, k, d) - g(a, k, d)) * t;
  return {
    rot: l("rot", 0),
    x: l("x", 0),
    y: l("y", 0),
    sx: l("sx", 1),
    sy: l("sy", 1),
    alpha: l("alpha", 1),
  };
}

/** Sorted parts with parents first (for FK). */
function order(def: RigDef): RigPart[] {
  const out: RigPart[] = [];
  const done = new Set<string>();
  const visit = (p: RigPart) => {
    if (done.has(p.id)) return;
    if (p.parent) {
      const parent = def.parts.find((q) => q.id === p.parent);
      if (parent) visit(parent);
    }
    done.add(p.id);
    out.push(p);
  };
  for (const p of def.parts) visit(p);
  return out;
}

/** World matrix per part for a set of transforms. The matrix maps part-canvas px → root px. */
export function solve(
  def: RigDef,
  pose: Record<string, Required<PartTransform>>,
): Map<string, { m: M; alpha: number }> {
  const result = new Map<string, { m: M; alpha: number }>();
  for (const part of order(def)) {
    const t = pose[part.id] ?? { rot: 0, x: 0, y: 0, sx: 1, sy: 1, alpha: 1 };
    const parent = part.parent ? result.get(part.parent) : undefined;
    // pivot placement in parent space, then local pose about the pivot, then canvas offset.
    let m = parent ? parent.m : ID;
    m = mul(m, translate(part.at[0] + t.x, part.at[1] + t.y));
    m = mul(m, rotate(t.rot));
    m = mul(m, scale(t.sx, t.sy));
    m = mul(m, translate(-part.pivot[0], -part.pivot[1]));
    result.set(part.id, { m, alpha: (parent?.alpha ?? 1) * t.alpha });
  }
  return result;
}

export function blendPose(
  def: RigDef,
  a: HdPose,
  b: HdPose,
  t: number,
): Record<string, Required<PartTransform>> {
  const pa = def.poses[a] ?? {};
  const pb = def.poses[b] ?? def.poses.idle ?? {};
  const out: Record<string, Required<PartTransform>> = {};
  for (const part of def.parts) out[part.id] = lerpT(pa[part.id], pb[part.id], t);
  return out;
}

/** Render a pose to a canvas (portraits, UI cards, galleries). `crop` in root px. */
export function bakeRig(
  def: RigDef,
  pose: HdPose = "idle",
  opts: {
    scale?: number;
    crop?: { x: number; y: number; w: number; h: number };
    flip?: boolean;
  } = {},
): HTMLCanvasElement {
  const s = opts.scale ?? 1;
  const crop = opts.crop ?? {
    x: -def.width * 0.75,
    y: -def.height * 1.15,
    w: def.width * 1.5,
    h: def.height * 1.25,
  };
  const c = document.createElement("canvas");
  c.width = Math.ceil(crop.w * s);
  c.height = Math.ceil(crop.h * s);
  const ctx = c.getContext("2d");
  if (!ctx) return c;
  const solved = solve(def, blendPose(def, pose, pose, 0));
  for (const part of [...def.parts].sort((p, q) => p.z - q.z)) {
    const w = solved.get(part.id);
    if (!w) continue;
    ctx.save();
    ctx.globalAlpha = w.alpha;
    ctx.setTransform(s, 0, 0, s, -crop.x * s, -crop.y * s);
    ctx.transform(...w.m);
    ctx.drawImage(part.canvas, 0, 0);
    ctx.restore();
  }
  for (const g of def.glows ?? []) {
    const w = solved.get(g.part);
    if (!w) continue;
    const [gx, gy] = apply(w.m, g.x, g.y);
    const x = (gx - crop.x) * s;
    const y = (gy - crop.y) * s;
    const grad = ctx.createRadialGradient(x, y, 0, x, y, g.radius * s);
    grad.addColorStop(0, hexA(g.color, g.alpha ?? 0.6));
    grad.addColorStop(1, hexA(g.color, 0));
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    ctx.fillStyle = grad;
    ctx.fillRect(x - g.radius * s, y - g.radius * s, g.radius * 2 * s, g.radius * 2 * s);
    ctx.restore();
  }
  if (opts.flip) {
    const f = document.createElement("canvas");
    f.width = c.width;
    f.height = c.height;
    const fctx = f.getContext("2d");
    if (fctx) {
      fctx.translate(f.width, 0);
      fctx.scale(-1, 1);
      fctx.drawImage(c, 0, 0);
      return f;
    }
  }
  return c;
}

function hexA(hex: string, a: number): string {
  const n = Number.parseInt(hex.slice(1, 7), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}

// ---------------------------------------------------------------------------
// Phaser runtime
// ---------------------------------------------------------------------------

const GLOW_TEX = "rig.glow";

function ensureGlowTexture(scene: Phaser.Scene): void {
  if (scene.textures.exists(GLOW_TEX)) return;
  const c = document.createElement("canvas");
  c.width = c.height = 128;
  const ctx = c.getContext("2d");
  if (!ctx) return;
  const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
  g.addColorStop(0, "rgba(255,255,255,1)");
  g.addColorStop(0.3, "rgba(255,255,255,0.45)");
  g.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 128, 128);
  scene.textures.addCanvas(GLOW_TEX, c)?.setFilter(Phaser.Textures.FilterMode.LINEAR);
}

export interface RigSpriteOptions {
  /** Display scale relative to authored render px (1/RENDER_SCALE shows at 1:1 on a 1080p canvas). */
  scale?: number;
  /** Face left (enemies) instead of right. */
  flip?: boolean;
  /** Start in this pose. */
  pose?: HdPose;
}

/**
 * Animated rig as a Phaser container. Parts are flat Images (sorted by z) positioned each
 * frame by forward kinematics, so arms can pass behind/in front of the torso freely.
 */
export class RigSprite extends Phaser.GameObjects.Container {
  readonly def: RigDef;
  private readonly images = new Map<string, Phaser.GameObjects.Image>();
  private readonly glowImages: { glow: RigGlow; image: Phaser.GameObjects.Image }[] = [];
  private from: HdPose = "idle";
  private to: HdPose = "idle";
  /** Blend progress from `from` to `to` (tweened). */
  private readonly anim = { t: 1 };
  private tween: Phaser.Tweens.Tween | null = null;
  private idleTween: Phaser.Tweens.Tween | null = null;
  private current: HdPose = "idle";
  private readonly rigBody: Phaser.GameObjects.Container;
  /** Multiplier on all animation durations (settings: animation speed). */
  speed = 1;

  constructor(scene: Phaser.Scene, x: number, y: number, def: RigDef, opts: RigSpriteOptions = {}) {
    super(scene, x, y);
    this.def = def;
    this.rigBody = scene.add.container(0, 0);
    this.add(this.rigBody);
    const s = opts.scale ?? 1;
    this.rigBody.setScale(opts.flip ? -s : s, s);
    for (const part of [...def.parts].sort((a, b) => a.z - b.z)) {
      const key = `rig.${def.id}.${part.id}`;
      if (!scene.textures.exists(key)) {
        scene.textures.addCanvas(key, part.canvas)?.setFilter(Phaser.Textures.FilterMode.LINEAR);
      }
      const img = scene.add.image(0, 0, key).setOrigin(0, 0);
      this.images.set(part.id, img);
      this.rigBody.add(img);
    }
    if (def.glows?.length) {
      ensureGlowTexture(scene);
      for (const glow of def.glows) {
        const image = scene.add
          .image(0, 0, GLOW_TEX)
          .setTint(Number.parseInt(glow.color.slice(1, 7), 16))
          .setAlpha(glow.alpha ?? 0.6)
          .setBlendMode(Phaser.BlendModes.ADD)
          .setScale((glow.radius * 2) / 128);
        this.glowImages.push({ glow, image });
        this.rigBody.add(image);
      }
    }
    this.current = opts.pose ?? "idle";
    this.from = this.to = this.current;
    this.layout();
    scene.add.existing(this);
    this.once(Phaser.GameObjects.Events.DESTROY, () => {
      this.tween?.stop();
      this.idleTween?.stop();
    });
  }

  get pose(): HdPose {
    return this.current;
  }

  /** Top of the head in this container's local (display) space, for markers and labels. */
  get headY(): number {
    return -this.def.height * Math.abs(this.rigBody.scaleY);
  }

  /** Width in display px. */
  get displayW(): number {
    return this.def.width * Math.abs(this.rigBody.scaleX);
  }

  private layout(): void {
    const pose = blendPose(this.def, this.from, this.to, this.anim.t);
    const solved = solve(this.def, pose);
    for (const [id, img] of this.images) {
      const w = solved.get(id);
      if (!w) continue;
      const [a, b, c, d, e, f] = w.m;
      // Decompose (no skew in our rigs): rotation + scale + translation.
      const sx = Math.hypot(a, b);
      const sy = (a * d - b * c) / (sx || 1);
      img.setPosition(e, f);
      img.setRotation(Math.atan2(b, a));
      img.setScale(sx, sy);
      img.setAlpha(w.alpha);
    }
    for (const { glow, image } of this.glowImages) {
      const w = solved.get(glow.part);
      if (!w) continue;
      const [gx, gy] = apply(w.m, glow.x, glow.y);
      image.setPosition(gx, gy);
    }
  }

  /** Blend to a pose over `ms`. Resolves when the blend finishes. */
  play(pose: HdPose, ms = 160, ease = "Quad.out"): Promise<void> {
    this.stopIdle();
    this.tween?.stop();
    // Start from wherever we are now (snapshot as the new "from").
    this.from = this.anim.t >= 1 ? this.to : this.blendTarget();
    this.to = pose;
    this.current = pose;
    this.anim.t = 0;
    return new Promise((resolve) => {
      this.tween = this.scene.tweens.add({
        targets: this.anim,
        t: 1,
        duration: Math.max(1, ms / this.speed),
        ease,
        onUpdate: () => this.layout(),
        onComplete: () => {
          this.layout();
          resolve();
        },
      });
    });
  }

  private blendTarget(): HdPose {
    return this.anim.t < 0.5 ? this.from : this.to;
  }

  /** Breathing idle loop (idle ⇄ breathe). */
  idle(): void {
    if (this.current === "downed") return;
    this.tween?.stop();
    this.stopIdle();
    this.from = "idle";
    this.to = "breathe";
    this.current = "idle";
    this.anim.t = 0;
    this.idleTween = this.scene.tweens.add({
      targets: this.anim,
      t: 1,
      duration: 1100 + ((this.def.id.length * 37) % 300),
      yoyo: true,
      repeat: -1,
      ease: "Sine.inOut",
      onUpdate: () => this.layout(),
    });
  }

  private stopIdle(): void {
    this.idleTween?.stop();
    this.idleTween = null;
  }

  /** Wind up, strike, hold, recover. */
  async attack(): Promise<void> {
    await this.play("windup", 170, "Quad.out");
    await this.play("attack", 90, "Expo.out");
    await new Promise((r) => this.scene.time.delayedCall(140 / this.speed, r));
    await this.play("idle", 220, "Quad.inOut");
    this.idle();
  }

  async cast(): Promise<void> {
    await this.play("cast", 220, "Back.out");
    await new Promise((r) => this.scene.time.delayedCall(200 / this.speed, r));
    await this.play("idle", 240, "Quad.inOut");
    this.idle();
  }

  async hurt(): Promise<void> {
    await this.play("hurt", 70, "Expo.out");
    await this.play("idle", 260, "Quad.out");
    this.idle();
  }

  async down(): Promise<void> {
    await this.play("downed", 380, "Bounce.out");
  }

  async rise(): Promise<void> {
    await this.play("idle", 400, "Back.out");
    this.idle();
  }

  /** Tint every part (dim in darkness, flash white on hit). */
  setTintAll(color: number, fill = false): this {
    for (const img of this.images.values()) {
      img.setTint(color);
      img.setTintMode(fill ? Phaser.TintModes.FILL : Phaser.TintModes.MULTIPLY);
    }
    return this;
  }

  clearTintAll(): this {
    for (const img of this.images.values()) {
      img.clearTint();
      img.setTintMode(Phaser.TintModes.MULTIPLY);
    }
    return this;
  }

  flash(ms = 80): void {
    this.setTintAll(0xffffff, true);
    this.scene.time.delayedCall(ms, () => this.clearTintAll());
  }

  setGlowAlpha(mult: number): void {
    for (const { glow, image } of this.glowImages) image.setAlpha((glow.alpha ?? 0.6) * mult);
  }
}
