/**
 * Per-look style: palettes (from the shared SKIN / HAIR / TINTS ramps so appearance
 * choices map 1:1 to the pixel generator), body dimensions and skeleton constants.
 */
import type { ArmorWeight, Discipline, LampKind, MercLook } from "../../mercs";
import { HAIR, RAMPS, RARITY_COLORS, type Ramp, SKIN, TINTS } from "../../palette";
import { seeded } from "../ink";
import { dim, type Mat, mat, matR, mixHex, RIM, RIM_HOT, STEEL } from "./kit";

/** Skeleton constants (unscaled render px, root space y up = negative). */
export const SK = {
  pelvisY: -150,
  /** Pelvis canvas pivot y; hip sockets / torso attach are measured from the pelvis top. */
  pelvisPivotY: 30,
  hipSocketY: 44,
  torsoAtY: 16,
  thigh: 66,
  shin: 62,
  ankleY: -14,
  shoulderDy: 70,
  neckDy: 78,
  upper: 54,
  fore: 48,
  /** Grip (fist centre) below the elbow pivot. */
  grip: 62,
} as const;

export interface Dims {
  sh: number;
  waist: number;
  hip: number;
  arm: number;
  fore: number;
  hand: number;
  thigh: number;
  shin: number;
  neck: number;
  foot: number;
  stance: number;
}

const BODY: readonly Dims[] = [
  {
    sh: 92,
    waist: 56,
    hip: 56,
    arm: 10.5,
    fore: 9.5,
    hand: 11,
    thigh: 14,
    shin: 11.5,
    neck: 8.5,
    foot: 1,
    stance: 0.9,
  },
  {
    sh: 108,
    waist: 66,
    hip: 64,
    arm: 12.5,
    fore: 11.5,
    hand: 12.5,
    thigh: 16.5,
    shin: 13.5,
    neck: 10.5,
    foot: 1.08,
    stance: 1,
  },
  {
    sh: 132,
    waist: 86,
    hip: 78,
    arm: 16.5,
    fore: 15,
    hand: 14.5,
    thigh: 20.5,
    shin: 17,
    neck: 14,
    foot: 1.18,
    stance: 1.12,
  },
];

export interface MercStyle {
  look: MercLook;
  hostile: boolean;
  d: Discipline;
  armor: ArmorWeight;
  lamp: LampKind;
  tier: number;
  body: number;
  D: Dims;
  seed: number;
  rng(salt: number): () => number;
  skinR: Ramp;
  skin: Mat;
  hairR: Ramp;
  hair: Mat;
  priR: Ramp;
  pri: Mat;
  secR: Ramp;
  sec: Mat;
  /** Bright trim tone from the secondary tint. */
  trim: string;
  pants: Mat;
  boot: Mat;
  glove: Mat;
  leather: Mat;
  plate: Mat;
  mail: Mat;
  tierColor: string;
  tierHi: string;
  paint: string;
  lens: string;
  lensHi: string;
  far(m: Mat): Mat;
}

const clampI = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, Math.round(v)));
const pick = <T>(arr: readonly T[], i: number): T =>
  arr[((Math.round(i) % arr.length) + arr.length) % arr.length] as T;

const CHARCOAL = ["#0b0b0e", "#17171c", "#25252c", "#383842", "#53535f"];
const TIER_COLORS = [
  RARITY_COLORS.common,
  RARITY_COLORS.uncommon,
  RARITY_COLORS.rare,
  RARITY_COLORS.epic,
  RARITY_COLORS.relic,
];

function lum(hex: string): number {
  const n = Number.parseInt(hex.slice(1, 7), 16);
  return (((n >> 16) & 255) * 0.3 + ((n >> 8) & 255) * 0.59 + (n & 255) * 0.11) / 255;
}

export function lookKey(look: MercLook, hostile: boolean): string {
  return [
    look.discipline,
    look.body,
    look.skin,
    look.hair,
    look.hairColor,
    look.primary,
    look.secondary,
    look.headgear,
    look.marking,
    look.armor,
    look.lamp,
    look.weaponTier,
    hostile ? "h" : "f",
  ].join(".");
}

function hashStr(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function styleOf(look: MercLook, hostile: boolean): MercStyle {
  const body = clampI(look.body, 0, 2);
  const D = BODY[body] as Dims;
  const seed = hashStr(lookKey(look, hostile));
  const skinR = pick(SKIN, look.skin);
  const hairR = pick(HAIR, look.hairColor);
  let priR: Ramp = pick(TINTS, look.primary).ramp;
  let secR: Ramp = pick(TINTS, look.secondary).ramp;
  if (hostile) {
    // Rival scavs: rust & charcoal bias, grimier.
    priR = priR.map((c, i) => mixHex(c, CHARCOAL[i] ?? c, 0.45));
    secR = secR.map((c, i) => mixHex(c, RAMPS.rust[i] ?? c, 0.4));
  }
  const at = (r: Ramp, i: number) => r[Math.max(0, Math.min(r.length - 1, i))] ?? "#000000";
  const pri = matR(priR, 2);
  const sec = matR(secR, 2);
  const skin = mat(at(skinR, 0), at(skinR, 1), at(skinR, 2), at(skinR, 3));
  skin.light = mixHex(at(skinR, 3), RAMPS.lamp[5], 0.18);
  const hair = mat(
    mixHex(at(hairR, 0), "#000000", 0.3),
    at(hairR, 0),
    at(hairR, 1),
    at(hairR, 2),
    RIM,
  );
  const rock = RAMPS.rock;
  const pantsR = [0, 1, 2, 3, 4].map((i) => mixHex(at(secR, i), at(rock, i + 1), 0.55));
  const pants = matR(pantsR, 2);
  const boot = matR(RAMPS.leather, 2);
  const glove = matR(RAMPS.leather, 2);
  const leather = matR(RAMPS.leather, 3);
  // Plate: primary tint over steel.
  const plateR = [0, 1, 2, 3, 4, 5].map((i) =>
    mixHex(at(RAMPS.steel, i), at(priR, Math.min(4, i)), 0.5),
  );
  const plate = matR(plateR, 3, RIM_HOT);
  const mail = matR(RAMPS.steel, 2);
  const tier = clampI(look.weaponTier, 0, 4);
  const tierColor = tier === 0 ? RAMPS.steel[3] : (TIER_COLORS[tier] ?? RAMPS.steel[3]);
  const tierHi = tier === 0 ? RAMPS.steel[4] : mixHex(tierColor, "#ffffff", 0.45);
  const trimCand = at(secR, 4);
  const trim = lum(trimCand) < 0.25 ? mixHex(trimCand, RAMPS.bone[4], 0.5) : trimCand;
  const paintCand = at(secR, 4);
  const paint = hostile
    ? RAMPS.rust[3]
    : lum(paintCand) < 0.35 || Math.abs(lum(paintCand) - lum(at(skinR, 2))) < 0.12
      ? RAMPS.bone[5]
      : paintCand;
  return {
    look,
    hostile,
    d: look.discipline,
    armor: look.armor,
    lamp: look.lamp,
    tier,
    body,
    D,
    seed,
    rng: (salt: number) => seeded((seed ^ Math.imul(salt + 1, 0x9e3779b1)) >>> 0),
    skinR,
    skin,
    hairR,
    hair,
    priR,
    pri,
    secR,
    sec,
    trim,
    pants,
    boot,
    glove,
    leather,
    plate,
    mail,
    tierColor,
    tierHi,
    paint,
    lens: hostile ? RAMPS.rust[3] : RAMPS.crystal[3],
    lensHi: hostile ? RAMPS.rust[5] : RAMPS.crystal[5],
    far: (m: Mat) => dim(m, 0.3),
  };
}

export { STEEL };
