import { ambienceLevel, createGraph, darkCutoff, type Graph, taper } from "./graph";
import { MoodPlayer, makeMood } from "./music";
import { RECIPES } from "./sfx";
import { rand, type Voice } from "./synth";
import type { AudioVolumes, MusicMood, PlayOptions, Sfx } from "./types";

const TICK_MS = 25;
const LOOKAHEAD = 0.12;
/** Background tabs throttle timers to ~1 Hz; schedule further ahead so music doesn't gap. */
const HIDDEN_LOOKAHEAD = 1.6;
const MAX_SFX = 24;
const SFX_MIN_GAP = 0.03;
const CROSSFADE = 1.5;

type AudioContextCtor = typeof AudioContext;

function audioContextCtor(): AudioContextCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as {
    AudioContext?: AudioContextCtor;
    webkitAudioContext?: AudioContextCtor;
  };
  return w.AudioContext ?? w.webkitAudioContext ?? null;
}

const clamp01 = (x: number): number => (Number.isFinite(x) ? Math.max(0, Math.min(1, x)) : 0);

interface Dying {
  player: MoodPlayer;
  at: number;
}

export class AudioEngine {
  private ctx: AudioContext | null = null;
  private graph: Graph | null = null;
  private volumes: AudioVolumes = { master: 0.8, music: 0.6, sfx: 0.85 };
  private darkness = 0;
  private mood: MusicMood = "none";
  private current: MoodPlayer | null = null;
  private dying: Dying[] = [];
  private timer: ReturnType<typeof setInterval> | null = null;
  private readonly lastPlayed = new Map<Sfx, number>();
  private activeSfx = 0;

  get unlocked(): boolean {
    return this.ctx !== null && this.ctx.state === "running";
  }

  /** The live AudioContext, if unlocked (for debugging/tests). */
  get context(): AudioContext | null {
    return this.ctx;
  }

  unlock(): void {
    try {
      if (!this.ctx) {
        const Ctor = audioContextCtor();
        if (!Ctor) return;
        let ctx: AudioContext;
        try {
          ctx = new Ctor({ latencyHint: "interactive" });
        } catch {
          ctx = new Ctor();
        }
        this.ctx = ctx;
        this.graph = createGraph(ctx, {
          limiter: true,
          darkness: this.darkness,
          mood: this.mood,
          ambience: true,
        });
        this.applyVolumes(true);
        ctx.addEventListener("statechange", () => this.onStateChange());
        this.timer = setInterval(() => this.tick(), TICK_MS);
        if (this.mood !== "none") this.startMood(this.mood);
      }
      const ctx = this.ctx;
      if (ctx.state !== "running") {
        void ctx.resume().catch(() => {});
      }
      // iOS Safari: playing a buffer inside the gesture fully unlocks output.
      const src = ctx.createBufferSource();
      src.buffer = ctx.createBuffer(1, 1, ctx.sampleRate);
      src.connect(ctx.destination);
      src.start();
      src.onended = () => src.disconnect();
    } catch {
      // Audio is never allowed to break the game.
    }
  }

  play(sfx: Sfx, opts: PlayOptions = {}): void {
    const ctx = this.ctx;
    const g = this.graph;
    if (!ctx || !g || ctx.state !== "running") return;
    const recipe = RECIPES[sfx];
    if (!recipe) return;
    const now = ctx.currentTime;
    const last = this.lastPlayed.get(sfx);
    if (last !== undefined && now - last < SFX_MIN_GAP) return;
    if (this.activeSfx >= MAX_SFX) return;
    this.lastPlayed.set(sfx, now);

    const vol = Math.max(0, Math.min(4, opts.volume ?? 1)) * rand(0.94, 1.06);
    if (vol <= 0) return;
    const pitch = Math.max(0.25, Math.min(4, opts.pitch ?? 1)) * rand(0.96, 1.04);
    const dry = ctx.createGain();
    dry.gain.value = vol;
    const wet = ctx.createGain();
    wet.gain.value = vol;
    wet.connect(g.sfxWet);
    let pan: StereoPannerNode | null = null;
    if (opts.pan && ctx.createStereoPanner) {
      pan = ctx.createStereoPanner();
      pan.pan.value = Math.max(-1, Math.min(1, opts.pan));
      dry.connect(pan);
      pan.connect(g.sfxVol);
    } else {
      dry.connect(g.sfxVol);
    }
    const voice: Voice = {
      ctx,
      noise: g.rig.noise,
      out: dry,
      wet,
      echo: null,
      t: now + 0.005,
      p: pitch,
    };
    this.activeSfx++;
    try {
      recipe(voice);
    } catch {
      // ignore
    }
    setTimeout(() => {
      dry.disconnect();
      wet.disconnect();
      pan?.disconnect();
      this.activeSfx--;
    }, 1600);
  }

  setMusic(mood: MusicMood): void {
    if (mood === this.mood) return;
    this.mood = mood;
    if (!this.ctx || !this.graph) return;
    this.startMood(mood);
    this.updateAmbience();
  }

  setVolumes(v: Partial<AudioVolumes>): void {
    const next = { ...this.volumes };
    if (v.master !== undefined) next.master = clamp01(v.master);
    if (v.music !== undefined) next.music = clamp01(v.music);
    if (v.sfx !== undefined) next.sfx = clamp01(v.sfx);
    this.volumes = next;
    this.applyVolumes(false);
  }

  getVolumes(): AudioVolumes {
    return { ...this.volumes };
  }

  setDarkness(d: number): void {
    this.darkness = clamp01(d);
    const ctx = this.ctx;
    const g = this.graph;
    if (!ctx || !g) return;
    const now = ctx.currentTime;
    g.darkFilter.frequency.setTargetAtTime(darkCutoff(this.darkness), now, 0.5);
    this.current?.setDarkness(this.darkness, now);
    this.updateAmbience();
  }

  getDarkness(): number {
    return this.darkness;
  }

  getMood(): MusicMood {
    return this.mood;
  }

  private startMood(mood: MusicMood): void {
    const ctx = this.ctx;
    const g = this.graph;
    if (!ctx || !g) return;
    const now = ctx.currentTime;
    const stinger = mood === "victory" || mood === "defeat";
    if (this.current) {
      const end = this.current.stop(now, stinger ? 0.6 : CROSSFADE);
      this.dying.push({ player: this.current, at: end });
      this.current = null;
    }
    if (mood === "none") return;
    const player = new MoodPlayer(mood, makeMood(mood), g.rig, g.musicIn, this.darkness);
    player.start(now + 0.05);
    this.current = player;
    if (ctx.state === "running") player.schedule(now + LOOKAHEAD, now);
  }

  private tick(): void {
    const ctx = this.ctx;
    if (!ctx || ctx.state === "suspended" || ctx.state === "closed") return;
    const now = ctx.currentTime;
    const hidden = typeof document !== "undefined" && document.hidden;
    const cur = this.current;
    if (cur) {
      cur.schedule(now + (hidden ? HIDDEN_LOOKAHEAD : LOOKAHEAD), now);
      if (cur.finished) {
        // Stinger done: let its tail ring, then release it. The mood stays set (silence).
        this.dying.push({ player: cur, at: cur.stop(now + 3, 2) });
        this.current = null;
      }
    }
    if (this.dying.length > 0) {
      this.dying = this.dying.filter((d) => {
        if (d.at > now) return true;
        d.player.disconnect();
        return false;
      });
    }
  }

  private onStateChange(): void {
    const ctx = this.ctx;
    if (ctx?.state === "running") this.tick();
  }

  private applyVolumes(immediate: boolean): void {
    const ctx = this.ctx;
    const g = this.graph;
    if (!ctx || !g) return;
    const now = ctx.currentTime;
    const set = (p: AudioParam, v: number) => {
      if (immediate) p.value = v;
      else p.setTargetAtTime(v, now, 0.04);
    };
    set(g.masterVol.gain, taper(this.volumes.master));
    set(g.musicVol.gain, taper(this.volumes.music));
    set(g.sfxVol.gain, taper(this.volumes.sfx));
  }

  private updateAmbience(): void {
    const ctx = this.ctx;
    const g = this.graph;
    if (!ctx || !g) return;
    g.ambience.gain.setTargetAtTime(ambienceLevel(this.darkness, this.mood), ctx.currentTime, 0.8);
  }

  /** Stop everything and close the context (tests / hot reload). */
  dispose(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    void this.ctx?.close().catch(() => {});
    this.ctx = null;
    this.graph = null;
    this.current = null;
    this.dying = [];
  }
}
