/**
 * Pose authoring for merc rigs. Poses are written semantically — pelvis/torso/head
 * transforms, ankle targets, hand targets in ROOT space, weapon angles in WORLD degrees —
 * and solved at build time into plain per-part FK transforms (2-bone IK for legs & arms,
 * flat feet, weapons aimed in world space). RigSprite then just blends the baked poses.
 */
import type { HdPose, PartTransform, RigDef, RigPoseDef } from "../rig";
import { solve } from "../rig";
import type { Pt } from "./kit";

type T = Required<PartTransform>;
type M = [number, number, number, number, number, number];

export type HandTarget = Pt | { part: string; pt: Pt };
export type Bend = "down" | "up" | "back" | "fwd";

export interface PoseSpec {
  pelvis?: PartTransform;
  torso?: number;
  torsoSy?: number;
  head?: number;
  /** Ankle targets in root space [x, y, footWorldRot?]. */
  feet?: { F: readonly [number, number, number?]; B: readonly [number, number, number?] };
  /** Limp legs (downed): FK only; feet take this world rotation. */
  limpFeet?: number;
  handF?: HandTarget;
  handB?: HandTarget;
  bendF?: Bend;
  bendB?: Bend;
  /** World rotation (deg) of the main weapon (authored pointing up). */
  weapon?: number;
  /** World rotation of the off-hand item (shield / second blade). */
  off?: number;
  /** Orb position relative to the near grip (world px). */
  orb?: Pt;
  /** Extra per-part FK (tails, apron, fx alpha, limbs when no IK). */
  fk?: Record<string, PartTransform>;
  /** Place parts in world space [x, y, rot] (dropped gear). */
  place?: Record<string, readonly [number, number, number]>;
}

export interface RigInfo {
  gripF: Pt;
  gripB: Pt;
  ankleF: Pt;
  ankleB: Pt;
  offId?: string;
  fxIds: string[];
}

const ident = (): T => ({ rot: 0, x: 0, y: 0, sx: 1, sy: 1, alpha: 1 });
const DEG = 180 / Math.PI;
const norm = (d: number) => {
  let a = d % 360;
  if (a > 180) a -= 360;
  if (a <= -180) a += 360;
  return a;
};

class Builder {
  readonly t: Record<string, T> = {};
  private cache: Map<string, { m: M; alpha: number }> | null = null;
  constructor(private readonly def: RigDef) {
    for (const p of def.parts) this.t[p.id] = ident();
  }
  has(id: string) {
    return id in this.t;
  }
  set(id: string, tr: PartTransform) {
    const cur = this.t[id];
    if (!cur) return;
    Object.assign(cur, tr);
    this.cache = null;
  }
  private world() {
    this.cache ??= solve(this.def, this.t) as Map<string, { m: M; alpha: number }>;
    return this.cache;
  }
  part(id: string) {
    return this.def.parts.find((p) => p.id === id);
  }
  /** Canvas point of a part → root space. */
  wpt(id: string, p: Pt): Pt {
    const w = this.world().get(id);
    if (!w) return [0, 0];
    const m = w.m;
    return [m[0] * p[0] + m[2] * p[1] + m[4], m[1] * p[0] + m[3] * p[1] + m[5]];
  }
  wrot(id: string | null): number {
    if (!id) return 0;
    const w = this.world().get(id);
    if (!w) return 0;
    return Math.atan2(w.m[1], w.m[0]) * DEG;
  }
  setWorldRot(id: string, deg: number) {
    const p = this.part(id);
    if (!p) return;
    this.set(id, { rot: norm(deg - this.wrot(p.parent)) });
  }
  placeWorld(id: string, x: number, y: number, rot: number) {
    const p = this.part(id);
    if (!p) return;
    const pm = p.parent ? this.world().get(p.parent)?.m : ([1, 0, 0, 1, 0, 0] as M);
    if (!pm) return;
    const [a, b, c, d, e, f] = pm;
    const det = a * d - b * c || 1;
    const lx = (d * (x - e) - c * (y - f)) / det;
    const ly = (-b * (x - e) + a * (y - f)) / det;
    this.set(id, { x: lx - p.at[0], y: ly - p.at[1] });
    this.setWorldRot(id, rot);
  }
  /** Two-bone IK: rotate `upper` & `lower` so `end` (lower canvas px) reaches `target`. */
  ik2(upper: string, lower: string, end: Pt, target: Pt, prefer: (e: Pt) => number) {
    const up = this.part(upper);
    const lo = this.part(lower);
    if (!up || !lo) return;
    const S = this.wpt(upper, up.pivot);
    const v1: Pt = [lo.at[0] - up.pivot[0], lo.at[1] - up.pivot[1]];
    const v2: Pt = [end[0] - lo.pivot[0], end[1] - lo.pivot[1]];
    const L1 = Math.hypot(v1[0], v1[1]);
    const L2 = Math.hypot(v2[0], v2[1]);
    const rest1 = Math.atan2(v1[1], v1[0]);
    const rest2 = Math.atan2(v2[1], v2[0]);
    const D: Pt = [target[0] - S[0], target[1] - S[1]];
    const dist = Math.max(Math.abs(L1 - L2) + 0.5, Math.min(L1 + L2 - 0.5, Math.hypot(D[0], D[1])));
    const base = Math.atan2(D[1], D[0]);
    const a = Math.acos(Math.max(-1, Math.min(1, (L1 * L1 + dist * dist - L2 * L2) / (2 * L1 * dist))));
    const T2: Pt = [S[0] + Math.cos(base) * dist, S[1] + Math.sin(base) * dist];
    let best: { a1: number; a2: number; score: number } | null = null;
    for (const sg of [1, -1]) {
      const a1 = base + sg * a;
      const E: Pt = [S[0] + Math.cos(a1) * L1, S[1] + Math.sin(a1) * L1];
      const a2 = Math.atan2(T2[1] - E[1], T2[0] - E[0]);
      const score = prefer(E);
      if (!best || score > best.score) best = { a1, a2, score };
    }
    if (!best) return;
    const parentRot = this.wrot(up.parent);
    const w1 = (best.a1 - rest1) * DEG;
    const w2 = (best.a2 - rest2) * DEG;
    this.set(upper, { rot: norm(w1 - parentRot) });
    this.set(lower, { rot: norm(w2 - w1) });
  }
}

const BENDS: Record<Bend, (e: Pt) => number> = {
  down: (e) => e[1] - e[0] * 0.35,
  up: (e) => -e[1],
  back: (e) => -e[0],
  fwd: (e) => e[0],
};

function solveSpec(def: RigDef, info: RigInfo, spec: PoseSpec): Record<string, PartTransform> {
  const b = new Builder(def);
  for (const id of info.fxIds) b.set(id, { alpha: 0 });
  for (const [id, tr] of Object.entries(spec.fk ?? {})) b.set(id, tr);
  if (spec.pelvis) b.set("pelvis", spec.pelvis);
  if (spec.torso !== undefined || spec.torsoSy !== undefined)
    b.set("torso", { rot: spec.torso ?? 0, sy: spec.torsoSy ?? 1 });
  if (spec.head !== undefined) b.set("head", { rot: spec.head });
  if (spec.feet) {
    for (const side of ["F", "B"] as const) {
      const f = spec.feet[side];
      b.ik2(`thigh${side}`, `shin${side}`, side === "F" ? info.ankleF : info.ankleB, [f[0], f[1]], BENDS.fwd);
      b.setWorldRot(`foot${side}`, f[2] ?? 0);
    }
  } else if (spec.limpFeet !== undefined) {
    b.setWorldRot("footF", spec.limpFeet);
    b.setWorldRot("footB", spec.limpFeet + 8);
  }
  const target = (h: HandTarget): Pt => {
    if (Array.isArray(h)) return h as Pt;
    const o = h as { part: string; pt: Pt };
    return b.wpt(o.part, o.pt);
  };
  if (spec.handF) b.ik2("uArmF", "fArmF", info.gripF, target(spec.handF), BENDS[spec.bendF ?? "down"]);
  if (spec.weapon !== undefined && b.has("weapon")) b.setWorldRot("weapon", spec.weapon);
  if (spec.handB) b.ik2("uArmB", "fArmB", info.gripB, target(spec.handB), BENDS[spec.bendB ?? "down"]);
  if (spec.off !== undefined && info.offId) b.setWorldRot(info.offId, spec.off);
  if (spec.orb && b.has("orb")) {
    const g = b.wpt("fArmF", info.gripF);
    b.placeWorld("orb", g[0] + spec.orb[0], g[1] + spec.orb[1], 0);
  }
  for (const [id, p] of Object.entries(spec.place ?? {})) b.placeWorld(id, p[0], p[1], p[2]);
  // Re-apply explicit fk alpha/rot overrides that IK may not touch (fx alpha etc.).
  for (const [id, tr] of Object.entries(spec.fk ?? {})) {
    if (tr.alpha !== undefined) b.set(id, { alpha: tr.alpha });
  }
  const out: Record<string, PartTransform> = {};
  for (const [id, tr] of Object.entries(b.t)) {
    const o: PartTransform = {};
    if (Math.abs(tr.rot) > 0.01) o.rot = Math.round(tr.rot * 100) / 100;
    if (Math.abs(tr.x) > 0.01) o.x = Math.round(tr.x * 100) / 100;
    if (Math.abs(tr.y) > 0.01) o.y = Math.round(tr.y * 100) / 100;
    if (tr.sx !== 1) o.sx = tr.sx;
    if (tr.sy !== 1) o.sy = tr.sy;
    if (tr.alpha !== 1) o.alpha = tr.alpha;
    out[id] = o;
  }
  return out;
}

/** Solve all poses; rotations are unwrapped toward idle so blends take the short way. */
export function solvePoses(
  def: RigDef,
  info: RigInfo,
  specs: Record<HdPose, PoseSpec>,
): Partial<Record<HdPose, RigPoseDef>> {
  const out: Partial<Record<HdPose, Record<string, PartTransform>>> = {};
  for (const [pose, spec] of Object.entries(specs) as [HdPose, PoseSpec][]) {
    out[pose] = solveSpec(def, info, spec);
  }
  const idle = out.idle ?? {};
  const unwrapTo = (pose: Record<string, PartTransform>, ref: Record<string, PartTransform>) => {
    for (const [id, tr] of Object.entries(pose)) {
      if (tr.rot === undefined) continue;
      const r0 = ref[id]?.rot ?? 0;
      let r = tr.rot;
      while (r - r0 > 180) r -= 360;
      while (r - r0 < -180) r += 360;
      tr.rot = r;
    }
  };
  for (const [pose, p] of Object.entries(out) as [HdPose, Record<string, PartTransform>][]) {
    if (pose === "attack") continue;
    if (pose !== "idle") unwrapTo(p, idle);
  }
  if (out.attack) unwrapTo(out.attack, out.windup ?? idle);
  return out;
}

/** Breathing variant of an idle spec: chest rise, slight sway; feet stay planted. */
export function breatheOf(idle: PoseSpec, sway = 1): PoseSpec {
  const lift = (h: HandTarget | undefined, dy: number): HandTarget | undefined =>
    h === undefined ? undefined : Array.isArray(h) ? [(h as Pt)[0] + 0.6 * sway, (h as Pt)[1] + dy] : h;
  const fk: Record<string, PartTransform> = {};
  for (const [id, tr] of Object.entries(idle.fk ?? {})) fk[id] = { ...tr };
  fk.tail = { ...(fk.tail ?? {}), rot: (fk.tail?.rot ?? 0) + 3 * sway };
  fk.apron = { ...(fk.apron ?? {}), rot: (fk.apron?.rot ?? 0) + 2 * sway };
  fk.lantern = { ...(fk.lantern ?? {}), rot: (fk.lantern?.rot ?? 0) + 4 * sway };
  fk.collar = { ...(fk.collar ?? {}), y: -0.8 };
  const p = idle.pelvis ?? {};
  return {
    ...idle,
    pelvis: { ...p, y: (p.y ?? 0) - 1.8 },
    torso: (idle.torso ?? 0) - 1.4,
    torsoSy: 1.018,
    head: (idle.head ?? 0) + 2.2,
    handF: lift(idle.handF, -4),
    handB: lift(idle.handB, -3.5),
    weapon: idle.weapon !== undefined ? idle.weapon + 1.8 * sway : undefined,
    off: idle.off !== undefined ? idle.off + 1.5 * sway : undefined,
    orb: idle.orb ? [idle.orb[0], idle.orb[1] - 5] : undefined,
    fk,
  };
}
