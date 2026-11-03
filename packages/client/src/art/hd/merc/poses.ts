/**
 * Discipline pose tables (semantic specs solved by ./pose.ts). Root space: ground y = 0,
 * +x = facing direction. Hands/feet are targets; weapon angles are world degrees with the
 * weapon authored pointing UP (0 = upright, +90 = pointing forward, -90 = pointing back).
 */
import type { HdPose } from "../rig";
import { RIFLE, STAFF } from "./gear";
import { breatheOf, type PoseSpec } from "./pose";
import type { MercStyle } from "./style";

type Specs = Record<HdPose, PoseSpec>;

function downed(extra: Partial<PoseSpec> = {}): PoseSpec {
  return {
    pelvis: { x: 22, y: 110, rot: -86 },
    torso: 3,
    head: 16,
    limpFeet: -78,
    ...extra,
    fk: {
      thighF: { rot: -6 },
      shinF: { rot: 14 },
      thighB: { rot: 8 },
      shinB: { rot: 22 },
      uArmF: { rot: -24 },
      fArmF: { rot: -30 },
      uArmB: { rot: 20 },
      fArmB: { rot: 12 },
      tail: { rot: 50 },
      apron: { rot: -20 },
      lantern: { rot: -40 },
      ...(extra.fk ?? {}),
    },
  };
}

function hurt(base: PoseSpec, extra: Partial<PoseSpec>): PoseSpec {
  const p = base.pelvis ?? {};
  return {
    ...base,
    pelvis: { x: (p.x ?? 0) - 22, y: (p.y ?? 0) + 2, rot: -5 },
    torso: (base.torso ?? 0) - 16,
    head: -22,
    fk: { ...(base.fk ?? {}), tail: { rot: -14 }, lantern: { rot: -16 }, apron: { rot: -10 } },
    ...extra,
  };
}

/** Neutral bust pose for portraits: arms relaxed, gear hidden. */
export function portraitSpec(): PoseSpec {
  const hide = { alpha: 0 };
  return {
    torso: 2,
    head: -3,
    feet: { F: [30, -14], B: [-34, -14] },
    handF: [-36, -146],
    handB: [46, -150],
    fk: { weapon: hide, blade2: hide, shield: hide, orb: hide, lantern: hide, fx: hide },
  };
}

export function poseSpecs(S: MercStyle): Specs {
  const st = S.D.stance;
  const b = S.body;
  const wide = [0.92, 1, 1.12][b] ?? 1;
  switch (S.d) {
    case "vanguard": {
      const idle: PoseSpec = {
        pelvis: { x: -6, y: 10 },
        torso: 5,
        head: -5,
        feet: { F: [46 * st, -14], B: [-50 * st, -14] },
        handF: [4, -176],
        weapon: -22,
        handB: [40 * wide, -188],
        off: 4,
      };
      return {
        idle,
        breathe: breatheOf(idle),
        windup: {
          pelvis: { x: -18, y: 6 },
          torso: -12,
          head: -6,
          feet: { F: [38 * st, -14], B: [-56 * st, -14] },
          handF: [-26, -262],
          bendF: "back",
          weapon: -118,
          handB: [36, -204],
          off: -8,
          fk: { tail: { rot: -6 }, apron: { rot: -6 } },
        },
        attack: {
          pelvis: { x: 44, y: 18 },
          torso: 22,
          head: 8,
          feet: { F: [104 * st, -14], B: [-28 * st, -14, 22] },
          handF: [106, -166],
          weapon: 122,
          handB: [86, -204],
          off: 24,
          fk: { fx: { alpha: 1 }, tail: { rot: 26 }, apron: { rot: 14 }, lantern: { rot: 24 } },
        },
        cast: {
          pelvis: { x: -4, y: 12 },
          torso: -6,
          head: -12,
          feet: { F: [46 * st, -14], B: [-50 * st, -14] },
          handF: [-6, -270],
          bendF: "back",
          weapon: -6,
          handB: [60 * wide, -218],
          off: -2,
          fk: { tail: { rot: 6 } },
        },
        hurt: hurt(idle, { handF: [-8, -188], weapon: -48, handB: [22, -178], off: -16 }),
        downed: downed({
          place: { weapon: [-34, -16, 92], shield: [-112, -22, -96] },
        }),
      };
    }
    case "gunner": {
      const fore = { part: "weapon", pt: [RIFLE.x + 8, RIFLE.foreY] as const };
      const idle: PoseSpec = {
        pelvis: { x: -4, y: 5 },
        torso: 3,
        head: -3,
        feet: { F: [38 * st, -14], B: [-42 * st, -14] },
        handF: [8, -194],
        weapon: -38,
        handB: { part: "weapon", pt: [RIFLE.x + 6, RIFLE.gy + 44] },
      };
      return {
        idle,
        breathe: breatheOf(idle),
        windup: {
          pelvis: { x: -8, y: 8 },
          torso: 5,
          head: 10,
          feet: { F: [40 * st, -14], B: [-46 * st, -14] },
          handF: [-4, -216],
          bendF: "back",
          weapon: 90,
          handB: fore,
          fk: { tail: { rot: -3 } },
        },
        attack: {
          pelvis: { x: -18, y: 6 },
          torso: -6,
          head: -2,
          feet: { F: [36 * st, -14], B: [-48 * st, -14, 8] },
          handF: [-14, -222],
          bendF: "back",
          weapon: 78,
          handB: fore,
          fk: { fx: { alpha: 1 }, tail: { rot: -10 }, lantern: { rot: -14 } },
        },
        cast: {
          pelvis: { x: -8, y: 8 },
          torso: -10,
          head: -14,
          feet: { F: [42 * st, -14], B: [-46 * st, -14] },
          handF: [-2, -226],
          bendF: "back",
          weapon: 46,
          handB: fore,
          fk: { fx: { alpha: 0.9 } },
        },
        hurt: hurt(idle, { handF: [-10, -178], weapon: 8 }),
        downed: downed({ place: { weapon: [-20, -12, 96] } }),
      };
    }
    case "lamplighter": {
      const upper = { part: "weapon", pt: [STAFF.x, STAFF.gy - 40] as const };
      const idle: PoseSpec = {
        pelvis: { x: -2, y: 4 },
        torso: 2,
        head: -3,
        feet: { F: [34 * st, -14], B: [-38 * st, -14] },
        handF: [46, -182],
        weapon: 3,
        handB: upper,
        fk: { fx: { alpha: 0 } },
      };
      return {
        idle,
        breathe: breatheOf(idle, 0.6),
        windup: {
          pelvis: { x: -12, y: 6 },
          torso: -9,
          head: -6,
          feet: { F: [34 * st, -14], B: [-42 * st, -14] },
          handF: [-6, -214],
          weapon: -30,
          handB: upper,
          fk: { fx: { alpha: 0.2 }, tail: { rot: -4 } },
        },
        attack: {
          pelvis: { x: 32, y: 10 },
          torso: 14,
          head: 6,
          feet: { F: [84 * st, -14], B: [-34 * st, -14, 16] },
          handF: [74, -204],
          weapon: 62,
          handB: upper,
          fk: { fx: { alpha: 0.7 }, tail: { rot: 22 }, apron: { rot: 12 }, lantern: { rot: 20 } },
        },
        cast: {
          pelvis: { x: -4, y: 2 },
          torso: -7,
          head: -16,
          feet: { F: [36 * st, -14], B: [-40 * st, -14] },
          handF: [40, -262],
          bendF: "back",
          weapon: 10,
          handB: [80, -230],
          fk: { fx: { alpha: 1 }, tail: { rot: 6 } },
        },
        hurt: hurt(idle, { handF: [20, -186], weapon: -14, handB: upper }),
        downed: downed({ place: { weapon: [-90, -14, 100] } }),
      };
    }
    case "reaver": {
      const idle: PoseSpec = {
        pelvis: { x: -4, y: 18 },
        torso: 15,
        head: -13,
        feet: { F: [46 * st, -14], B: [-52 * st, -14, 10] },
        handF: [-12, -172],
        weapon: 66,
        handB: [58, -194],
        off: 34,
        fk: { tail: { rot: -4 } },
      };
      return {
        idle,
        breathe: breatheOf(idle, 1.4),
        windup: {
          pelvis: { x: -20, y: 22 },
          torso: 4,
          head: -6,
          feet: { F: [40 * st, -14], B: [-58 * st, -14, 12] },
          handF: [-58, -222],
          bendF: "back",
          weapon: -56,
          handB: [-14, -236],
          bendB: "back",
          off: -40,
          fk: { tail: { rot: -14 } },
        },
        attack: {
          pelvis: { x: 60, y: 26 },
          torso: 28,
          head: -10,
          feet: { F: [122 * st, -14], B: [-14 * st, -14, 26] },
          handF: [122, -164],
          weapon: 128,
          handB: [104, -148],
          off: 150,
          fk: { fx: { alpha: 1 }, tail: { rot: 30 }, lantern: { rot: 26 } },
        },
        cast: {
          pelvis: { x: 6, y: 28 },
          torso: 20,
          head: -16,
          feet: { F: [52 * st, -14], B: [-54 * st, -14, 14] },
          handF: [38, -214],
          weapon: -14,
          handB: [52, -210],
          off: 36,
          fk: { tail: { rot: 10 } },
        },
        hurt: hurt(idle, { handF: [-30, -190], weapon: 28, handB: [20, -172], off: 6, head: -24 }),
        downed: downed({
          place: { weapon: [-50, -10, 96], blade2: [80, -8, 84] },
        }),
      };
    }
    default: {
      // hexer
      const idle: PoseSpec = {
        pelvis: { x: -2, y: 7 },
        torso: 8,
        head: 2,
        feet: { F: [32 * st, -14], B: [-38 * st, -14] },
        handF: [44, -204],
        bendF: "down",
        orb: [12, -36],
        handB: [40, -152],
      };
      return {
        idle,
        breathe: breatheOf(idle, 0.8),
        windup: {
          pelvis: { x: -10, y: 8 },
          torso: -5,
          head: -4,
          feet: { F: [30 * st, -14], B: [-42 * st, -14] },
          handF: [-12, -244],
          bendF: "back",
          orb: [-2, -32],
          handB: [24, -184],
          fk: { fx: { alpha: 0.25 }, tail: { rot: -6 } },
        },
        attack: {
          pelvis: { x: 24, y: 9 },
          torso: 16,
          head: 6,
          feet: { F: [70 * st, -14], B: [-30 * st, -14, 12] },
          handF: [96, -216],
          orb: [30, -10],
          handB: [70, -192],
          fk: { fx: { alpha: 0.8 }, tail: { rot: 20 }, apron: { rot: 10 }, lantern: { rot: 18 } },
        },
        cast: {
          pelvis: { x: -2, y: 4 },
          torso: -6,
          head: -12,
          feet: { F: [32 * st, -14], B: [-40 * st, -14] },
          handF: [62, -264],
          bendF: "down",
          orb: [8, -36],
          handB: [66, -212],
          fk: { fx: { alpha: 1 }, tail: { rot: 8 } },
        },
        hurt: hurt(idle, { handF: [10, -196], orb: [-8, -40], handB: [16, -160] }),
        downed: downed({ fk: { orb: { alpha: 0.35 } }, place: { orb: [-70, -20, 0] } }),
      };
    }
  }
}
