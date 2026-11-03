export const SFX_NAMES = [
  "uiHover",
  "uiClick",
  "uiBack",
  "uiError",
  "uiConfirm",
  "turnStart",
  "skillSelect",
  "targetSelect",
  "hitPhysical",
  "hitRadiant",
  "hitVoid",
  "hitFire",
  "hitToxic",
  "crit",
  "miss",
  "block",
  "heal",
  "buff",
  "debuff",
  "stun",
  "bleed",
  "burn",
  "dotTick",
  "move",
  "downed",
  "enemyDeath",
  "revive",
  "gunshot",
  "bladeSlash",
  "hammerImpact",
  "castRadiant",
  "castVoid",
  "flare",
  "lampDrain",
  "lampRefuel",
  "lightUp",
  "lootCommon",
  "lootRare",
  "lootRelic",
  "levelUp",
  "perkChosen",
  "equip",
  "ore",
  "mapStep",
  "victory",
  "defeat",
  "bossRoar",
] as const;

export type Sfx = (typeof SFX_NAMES)[number];

export const MUSIC_MOODS = [
  "title",
  "map",
  "combat",
  "elite",
  "boss",
  "camp",
  "victory",
  "defeat",
  "none",
] as const;

export type MusicMood = (typeof MUSIC_MOODS)[number];

/** All values 0..1. */
export interface AudioVolumes {
  master: number;
  music: number;
  sfx: number;
}

export interface PlayOptions {
  /** Gain multiplier (default 1). */
  volume?: number;
  /** Pitch multiplier (default 1). */
  pitch?: number;
  /** Stereo position -1..1 (default 0). */
  pan?: number;
}
