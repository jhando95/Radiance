/**
 * Player settings: a tiny typed store persisted to localStorage. Storage may be missing or
 * throw (private mode, blocked site data), so every access is guarded and we always fall back
 * to defaults. Fullscreen is not persisted (browsers require a user gesture to enter it).
 */

export type AnimationSpeed = 0.5 | 1 | 1.5 | 2;
export const ANIMATION_SPEEDS: readonly AnimationSpeed[] = [0.5, 1, 1.5, 2];

export interface Settings {
  /** 0..1 */
  masterVolume: number;
  /** 0..1 */
  musicVolume: number;
  /** 0..1 */
  sfxVolume: number;
  animationSpeed: AnimationSpeed;
  screenShake: boolean;
  damageNumbers: boolean;
  /** Use shape/pattern cues (not only color) for enemy intents and elements. */
  colorblindIntents: boolean;
  playerName: string;
  lastServerUrl: string;
}

export const DEFAULT_SETTINGS: Readonly<Settings> = Object.freeze({
  masterVolume: 0.8,
  musicVolume: 0.7,
  sfxVolume: 0.8,
  animationSpeed: 1,
  screenShake: true,
  damageNumbers: true,
  colorblindIntents: false,
  playerName: "",
  lastServerUrl: "",
});

export const PLAYER_NAME_MAX = 16;

const STORAGE_KEY = "radiance.settings.v1";

type Listener = (settings: Readonly<Settings>, changed: ReadonlyArray<keyof Settings>) => void;

const listeners = new Set<Listener>();
let current: Settings = load();

function clamp01(v: unknown, fallback: number): number {
  return typeof v === "number" && Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : fallback;
}

function sanitize(raw: Partial<Record<keyof Settings, unknown>>): Settings {
  const d = DEFAULT_SETTINGS;
  const speed = ANIMATION_SPEEDS.includes(raw.animationSpeed as AnimationSpeed)
    ? (raw.animationSpeed as AnimationSpeed)
    : d.animationSpeed;
  const bool = (v: unknown, f: boolean) => (typeof v === "boolean" ? v : f);
  const str = (v: unknown, f: string, max = 256) => (typeof v === "string" ? v.slice(0, max) : f);
  return {
    masterVolume: clamp01(raw.masterVolume, d.masterVolume),
    musicVolume: clamp01(raw.musicVolume, d.musicVolume),
    sfxVolume: clamp01(raw.sfxVolume, d.sfxVolume),
    animationSpeed: speed,
    screenShake: bool(raw.screenShake, d.screenShake),
    damageNumbers: bool(raw.damageNumbers, d.damageNumbers),
    colorblindIntents: bool(raw.colorblindIntents, d.colorblindIntents),
    playerName: str(raw.playerName, d.playerName, PLAYER_NAME_MAX).trim(),
    lastServerUrl: str(raw.lastServerUrl, d.lastServerUrl),
  };
}

function load(): Settings {
  try {
    const text = globalThis.localStorage?.getItem(STORAGE_KEY);
    if (!text) return { ...DEFAULT_SETTINGS };
    const parsed: unknown = JSON.parse(text);
    if (!parsed || typeof parsed !== "object") return { ...DEFAULT_SETTINGS };
    return sanitize(parsed as Partial<Record<keyof Settings, unknown>>);
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

function save(): void {
  try {
    globalThis.localStorage?.setItem(STORAGE_KEY, JSON.stringify(current));
  } catch {
    /* storage unavailable: settings still apply for this session */
  }
}

/** Current settings (read-only snapshot; do not mutate). */
export function getSettings(): Readonly<Settings> {
  return current;
}

/** Merge a patch, validate it, persist, and notify listeners of the keys that changed. */
export function updateSettings(patch: Partial<Settings>): Readonly<Settings> {
  const next = sanitize({ ...current, ...patch });
  const changed = (Object.keys(next) as Array<keyof Settings>).filter(
    (k) => next[k] !== current[k],
  );
  if (changed.length === 0) return current;
  current = next;
  save();
  for (const cb of [...listeners]) {
    try {
      cb(current, changed);
    } catch (err) {
      console.error("settings listener failed", err);
    }
  }
  return current;
}

/** Subscribe to settings changes. Returns an unsubscribe function. */
export function onSettingsChange(cb: Listener): () => void {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

/** Restore every setting to its default. */
export function resetSettings(): Readonly<Settings> {
  return updateSettings({ ...DEFAULT_SETTINGS });
}

/** Effective volumes (master multiplied in). */
export function effectiveVolume(channel: "music" | "sfx"): number {
  const s = current;
  return s.masterVolume * (channel === "music" ? s.musicVolume : s.sfxVolume);
}

/** Scale a gameplay animation duration by the player's animation speed. */
export function animDuration(ms: number): number {
  return ms / current.animationSpeed;
}
