/**
 * Scene transitions and camera helpers. All shell scenes move between each other with
 * `goTo`, which fades the current camera to black, starts the target scene and fades it in.
 */
import * as Phaser from "phaser";
import { hexToRgb } from "../art/palette";
import { COLORS, DURATION } from "../ui/theme";
import { getSettings } from "./settings";

const [FADE_R, FADE_G, FADE_B] = hexToRgb(COLORS.bg);
const transitioning = new WeakSet<Phaser.Scene>();

export interface GoToOptions {
  /** Fade-out duration in ms (default 280). */
  duration?: number;
  /** Fade-in duration for the target scene in ms (default: same as duration). */
  fadeIn?: number;
}

/** True while `scene` is fading out toward another scene. */
export function isTransitioning(scene: Phaser.Scene): boolean {
  return transitioning.has(scene);
}

/**
 * Fade `scene` to black, then start scene `key` (stopping `scene`) and fade it in.
 * Repeated calls during a transition are ignored.
 */
export function goTo(scene: Phaser.Scene, key: string, data?: object, opts?: GoToOptions): void {
  if (transitioning.has(scene)) return;
  transitioning.add(scene);
  const out = opts?.duration ?? DURATION.fade;
  const fadeIn = opts?.fadeIn ?? out;
  const target = scene.scene.get(key);
  if (target) {
    target.events.once(Phaser.Scenes.Events.CREATE, () => {
      target.cameras.main.fadeIn(fadeIn, FADE_R, FADE_G, FADE_B);
    });
  }
  const finish = () => {
    transitioning.delete(scene);
    scene.scene.start(key, data);
  };
  scene.input.enabled = false;
  const cam = scene.cameras.main;
  if (out <= 0 || !cam) {
    finish();
    return;
  }
  cam.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, finish);
  cam.fadeOut(out, FADE_R, FADE_G, FADE_B);
  scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
    transitioning.delete(scene);
    scene.input.enabled = true;
  });
}

/** Fade a freshly created scene in from black (for scenes started without `goTo`). */
export function fadeIn(scene: Phaser.Scene, duration: number = DURATION.fade): void {
  scene.cameras.main.fadeIn(duration, FADE_R, FADE_G, FADE_B);
}

/** Camera shake that respects the Screen Shake setting. Intensity is a fraction of the view. */
export function shake(scene: Phaser.Scene, duration = 180, intensity = 0.006): void {
  if (!getSettings().screenShake) return;
  scene.cameras.main.shake(duration, intensity);
}

/** Quick white/amber flash (e.g. crits, flares). */
export function flash(scene: Phaser.Scene, duration = 120, color: string = COLORS.accentPale): void {
  const [r, g, b] = hexToRgb(color);
  scene.cameras.main.flash(duration, r, g, b);
}
