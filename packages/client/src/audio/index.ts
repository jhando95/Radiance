/**
 * Radiance audio: fully procedural (Web Audio API, no asset files).
 *
 *   import { audio, installAudioUnlock } from "./audio";
 *   installAudioUnlock();          // once at boot
 *   audio.setMusic("title");       // remembered until the first gesture unlocks audio
 *   audio.play("uiClick");
 */

import { AudioEngine } from "./engine";
import type { AudioVolumes, MusicMood, PlayOptions, Sfx } from "./types";

export type { AudioVolumes, MusicMood, PlayOptions, Sfx } from "./types";
export { MUSIC_MOODS, SFX_NAMES } from "./types";

export interface RadianceAudio {
  /** Must be called from a user gesture (first click/keypress) to unlock the AudioContext; safe to call repeatedly. */
  unlock(): void;
  play(sfx: Sfx, opts?: PlayOptions): void;
  /** Crossfades ~1.5 s; idempotent if same mood. Remembered before unlock. */
  setMusic(mood: MusicMood): void;
  setVolumes(v: Partial<AudioVolumes>): void;
  /** Darkness 0 (bright) .. 1 (pitch dark): music/ambience gets more ominous. */
  setDarkness(d: number): void;
  readonly unlocked: boolean;
}

const engine = new AudioEngine();

export const audio: RadianceAudio = {
  unlock: () => engine.unlock(),
  play: (sfx, opts) => engine.play(sfx, opts),
  setMusic: (mood) => engine.setMusic(mood),
  setVolumes: (v) => engine.setVolumes(v),
  setDarkness: (d) => engine.setDarkness(d),
  get unlocked() {
    return engine.unlocked;
  },
};

/**
 * Attaches one-time pointerdown/keydown/touchend listeners that unlock audio. Listeners are removed
 * once the context is actually running (a gesture that fails to unlock keeps them armed).
 */
export function installAudioUnlock(target: HTMLElement | Window = window): void {
  const events = ["pointerdown", "keydown", "touchend"] as const;
  const handler = (): void => {
    audio.unlock();
    // resume() is async; check shortly after so a failed attempt keeps listening.
    setTimeout(() => {
      if (audio.unlocked) {
        for (const e of events) target.removeEventListener(e, handler, true);
      }
    }, 100);
  };
  for (const e of events) target.addEventListener(e, handler, { capture: true, passive: true });
}

/** Internal engine (lab/debug only). */
export const _engine = engine;
