/**
 * HD mercenaries: procedurally illustrated, cut-out rigged characters in the gothic-ink
 * style (see ./ink.ts). One rig per look (memoized), authored facing right.
 *
 * Construction: ./merc/style.ts derives palettes & proportions from the MercLook, the body /
 * head / gear modules draw each part canvas, and ./merc/pose.ts bakes semantic pose specs
 * (IK hands & feet, world-space weapon angles) into plain FK poses for RigSprite.
 */
import type { MercLook } from "../mercs";
import {
  apronPart,
  collarPart,
  footPart,
  forearmGeo,
  forearmPart,
  pelvisGeo,
  pelvisPart,
  shinGeo,
  shinPart,
  thighPart,
  tailPart,
  torsoPart,
  upperArmPart,
} from "./merc/body";
import {
  arcFxPart,
  beltLanternPart,
  bladePart,
  flarePart,
  maulPart,
  muzzleFlashPart,
  orbPart,
  riflePart,
  STAFF,
  shieldPart,
  staffPart,
} from "./merc/gear";
import { headPart } from "./merc/head";
import { bonePart, makePart, type PartSpec } from "./merc/kit";
import { type RigInfo, solvePoses } from "./merc/pose";
import { portraitSpec, poseSpecs } from "./merc/poses";
import { lookKey, styleOf } from "./merc/style";
import { RAMPS } from "../palette";
import {
  bakeRig,
  blendPose,
  type HdPose,
  type PartTransform,
  type RigDef,
  type RigGlow,
  type RigPoseDef,
  solve,
} from "./rig";

export interface MercRigOptions {
  hostile?: boolean;
}

const cache = new Map<string, RigDef>();
const portraits = new Map<string, HTMLCanvasElement>();

/** Approximate head-top height of a standing merc (render px). */
export const MERC_HEIGHT = 316;

/** Build (memoized) the HD cut-out rig for a merc look. Authored facing right. */
export function buildMercRig(look: MercLook, opts: MercRigOptions = {}): RigDef {
  const key = `${lookKey(look, !!opts.hostile)}@1`;
  let def = cache.get(key);
  if (!def) {
    def = build(look, !!opts.hostile, 1);
    cache.set(key, def);
  }
  return def;
}

/** 192×192 head-and-shoulders bust facing right, transparent background. */
export function mercPortraitHD(look: MercLook, opts: MercRigOptions = {}): HTMLCanvasElement {
  const key = lookKey(look, !!opts.hostile);
  let c = portraits.get(key);
  if (!c) {
    c = portrait(look, !!opts.hostile);
    portraits.set(key, c);
  }
  return c;
}

const PORTRAIT_SCALE = 1.9;
const PORTRAIT_SIZE = 192;

function portrait(look: MercLook, hostile: boolean): HTMLCanvasElement {
  const k = PORTRAIT_SCALE;
  const def = build(look, hostile, k, true);
  const solved = solve(def, blendPose(def, "idle", "idle", 0));
  const head = def.parts.find((p) => p.id === "head");
  const w = head ? solved.get("head") : undefined;
  let hx = 0;
  let hy = -260 * k;
  if (head && w) {
    // Head pivot (neck base) in root space.
    const [a, b, c, d, e, f] = w.m;
    const [px, py] = head.pivot;
    hx = a * px + c * py + e;
    hy = b * px + d * py + f;
  }
  const S = PORTRAIT_SIZE;
  return bakeRig(def, "idle", {
    scale: 1,
    crop: { x: hx - S * 0.5 + 4 * k, y: hy - S * 0.66, w: S, h: S },
  });
}

function build(look: MercLook, hostile: boolean, k: number, portraitMode = false): RigDef {
  const S = styleOf(look, hostile);
  const specs: PartSpec[] = [];
  const glows: RigGlow[] = [];
  const pg = pelvisGeo(S);
  const fg = forearmGeo(S);
  const sg = shinGeo(S);

  specs.push(
    pelvisPart(S),
    thighPart(S, true),
    shinPart(S, true),
    footPart(S, true),
    thighPart(S, false),
    shinPart(S, false),
    footPart(S, false),
    torsoPart(S),
    collarPart(S),
  );
  const head = headPart(S);
  specs.push(head.spec);
  glows.push(...head.glows);
  specs.push(
    upperArmPart(S, true),
    forearmPart(S, true),
    upperArmPart(S, false),
    forearmPart(S, false, S.d === "hexer" ? "claw" : "fist"),
  );
  const tail = tailPart(S);
  if (tail) specs.push(tail);
  const apron = apronPart(S);
  if (apron) specs.push(apron);
  const lantern = beltLanternPart(S, pg.hook);
  if (lantern) {
    specs.push(lantern.spec);
    glows.push(...lantern.glows);
  }

  let offId: string | undefined;
  const fxIds: string[] = [];
  const addGear = (g: { spec: PartSpec; glows: RigGlow[] }) => {
    specs.push(g.spec);
    glows.push(...g.glows);
  };
  switch (S.d) {
    case "vanguard": {
      addGear(maulPart(S, fg.grip));
      specs.push(shieldPart(S, [fg.cx, fg.pivot[1] + 28]));
      offId = "shield";
      if (!portraitMode) {
        specs.push(
          arcFxPart(S, "pelvis", [pg.cx + 40, pg.pivot[1] - 60], RAMPS.lamp, {
            R: 150,
            a0: -1.9,
            a1: 0.55,
            thick: 46,
          }),
        );
        fxIds.push("fx");
      }
      break;
    }
    case "gunner": {
      addGear(riflePart(S, fg.grip));
      if (!portraitMode) {
        specs.push(muzzleFlashPart(S));
        fxIds.push("fx");
      }
      break;
    }
    case "lamplighter": {
      addGear(staffPart(S, fg.grip));
      if (!portraitMode) {
        specs.push(flarePart(S, "weapon", [STAFF.x, STAFF.lampY], RAMPS.lamp));
        fxIds.push("fx");
      }
      break;
    }
    case "reaver": {
      addGear(bladePart(S, "weapon", "fArmF", fg.grip, 12.5, false));
      addGear(bladePart(S, "blade2", "fArmB", fg.grip, 2.3, true));
      offId = "blade2";
      if (!portraitMode) {
        specs.push(
          arcFxPart(S, "pelvis", [pg.cx + 70, pg.pivot[1] - 40], ["", "", "#c4d3e6", "#e8f0ff", "", "#ffffff"], {
            R: 128,
            a0: -1.7,
            a1: 0.9,
            double: true,
            thick: 34,
          }),
        );
        fxIds.push("fx");
      }
      break;
    }
    default: {
      addGear(orbPart(S, fg.grip));
      if (!portraitMode) {
        specs.push(flarePart(S, "orb", [50, 50], S.hostile ? RAMPS.rust : RAMPS.umbra));
        fxIds.push("fx");
      }
      break;
    }
  }

  // Solve poses on the unscaled skeleton.
  const bones: RigDef = {
    id: "bones",
    parts: specs.map(bonePart),
    poses: {},
    height: MERC_HEIGHT,
    width: 120,
  };
  const info: RigInfo = {
    gripF: fg.grip,
    gripB: fg.grip,
    ankleF: sg.ankle,
    ankleB: sg.ankle,
    offId,
    fxIds,
  };
  const specTable = poseSpecs(S);
  if (portraitMode) specTable.idle = portraitSpec();
  const poses = solvePoses(bones, info, specTable);

  const parts = specs.map((s) => makePart(s, k));
  const scaled: Partial<Record<HdPose, RigPoseDef>> = {};
  for (const [pose, p] of Object.entries(poses) as [HdPose, RigPoseDef][]) {
    const o: Record<string, PartTransform> = {};
    for (const [id, tr] of Object.entries(p)) {
      o[id] = {
        ...tr,
        ...(tr.x !== undefined ? { x: tr.x * k } : {}),
        ...(tr.y !== undefined ? { y: tr.y * k } : {}),
      };
    }
    scaled[pose] = o;
  }
  return {
    id: `merc.${lookKey(look, hostile)}${k === 1 ? "" : `@${k}`}`,
    parts,
    poses: scaled,
    height: MERC_HEIGHT * k,
    width: (S.D.sh + 20) * k,
    glows: glows.map((g) => ({ ...g, x: g.x * k, y: g.y * k, radius: g.radius * k })),
  };
}
