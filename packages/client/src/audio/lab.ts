/** Dev page: audition every SFX and music mood, tweak mix/darkness, run offline render checks. */

import {
  _engine,
  audio,
  installAudioUnlock,
  MUSIC_MOODS,
  type MusicMood,
  SFX_NAMES,
  type Sfx,
} from "./index";
import { type RenderStats, renderMoodTable, renderSfxTable, renderStress } from "./offline";

const GROUPS: readonly (readonly [string, readonly Sfx[]])[] = [
  [
    "UI",
    [
      "uiHover",
      "uiClick",
      "uiBack",
      "uiError",
      "uiConfirm",
      "turnStart",
      "skillSelect",
      "targetSelect",
    ],
  ],
  [
    "Hits",
    ["hitPhysical", "hitRadiant", "hitVoid", "hitFire", "hitToxic", "crit", "miss", "block"],
  ],
  ["Status", ["heal", "buff", "debuff", "stun", "bleed", "burn", "dotTick"]],
  ["Units", ["move", "downed", "enemyDeath", "revive"]],
  ["Attacks", ["gunshot", "bladeSlash", "hammerImpact", "castRadiant", "castVoid", "flare"]],
  ["Lamp", ["lampDrain", "lampRefuel", "lightUp"]],
  ["Rewards", ["lootCommon", "lootRare", "lootRelic", "levelUp", "perkChosen", "equip", "ore"]],
  ["Map / outcome", ["mapStep", "victory", "defeat", "bossRoar"]],
];

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  text?: string,
  cls?: string,
): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  if (text !== undefined) e.textContent = text;
  if (cls) e.className = cls;
  return e;
}

function byId(id: string): HTMLElement {
  const e = document.getElementById(id);
  if (!e) throw new Error(`missing #${id}`);
  return e;
}

installAudioUnlock();

// ---- status
const status = byId("status");
setInterval(() => {
  const on = audio.unlocked;
  status.textContent = on
    ? `unlocked · ${_engine.context?.sampleRate ?? 0} Hz`
    : "locked (click to unlock)";
  status.classList.toggle("on", on);
}, 250);

// ---- sliders
const sliders = byId("sliders");
function slider(label: string, value: number, onInput: (v: number) => void): void {
  const wrap = el("label");
  const caption = el("span", `${label}: ${value.toFixed(2)}`);
  const input = el("input");
  input.type = "range";
  input.min = "0";
  input.max = "1";
  input.step = "0.01";
  input.value = String(value);
  input.setAttribute("aria-label", label);
  input.addEventListener("input", () => {
    const v = Number(input.value);
    caption.textContent = `${label}: ${v.toFixed(2)}`;
    onInput(v);
  });
  wrap.append(caption, input);
  sliders.append(wrap);
}
const vols = _engine.getVolumes();
slider("Master", vols.master, (v) => audio.setVolumes({ master: v }));
slider("Music", vols.music, (v) => audio.setVolumes({ music: v }));
slider("SFX", vols.sfx, (v) => audio.setVolumes({ sfx: v }));
slider("Darkness", _engine.getDarkness(), (v) => audio.setDarkness(v));

// ---- music
const moods = byId("moods");
const moodButtons = new Map<MusicMood, HTMLButtonElement>();
for (const mood of MUSIC_MOODS) {
  const b = el("button", mood);
  b.type = "button";
  b.dataset.mood = mood;
  b.addEventListener("click", () => {
    audio.unlock();
    audio.setMusic(mood);
    for (const [m, btn] of moodButtons) btn.classList.toggle("active", m === mood);
  });
  moodButtons.set(mood, b);
  moods.append(b);
}

// ---- sfx
const sfx = byId("sfx");
const covered = new Set<Sfx>();
for (const [label, names] of GROUPS) {
  sfx.append(el("div", label, "group-label"));
  for (const name of names) {
    covered.add(name);
    const b = el("button", name);
    b.type = "button";
    b.dataset.sfx = name;
    b.addEventListener("click", () => {
      audio.unlock();
      audio.play(name);
    });
    sfx.append(b);
  }
}
const missing = SFX_NAMES.filter((n) => !covered.has(n));
if (missing.length > 0) {
  sfx.append(el("div", "Other", "group-label"));
  for (const name of missing) {
    const b = el("button", name);
    b.type = "button";
    b.dataset.sfx = name;
    b.addEventListener("click", () => audio.play(name));
    sfx.append(b);
  }
}

// ---- offline test
function table(title: string, rows: RenderStats[]): HTMLElement {
  const wrap = el("div");
  wrap.append(el("h2", title));
  const t = el("table");
  const head = el("tr");
  for (const h of ["name", "peak", "peak (mastered)", "RMS dB", "audible s", "ok"])
    head.append(el("th", h));
  t.append(head);
  for (const r of rows) {
    const tr = el("tr");
    tr.append(
      el("td", r.name),
      el("td", r.peak.toFixed(3), r.peak >= 1 ? "bad" : ""),
      el("td", r.peakMastered.toFixed(3), r.peakMastered >= 1 ? "bad" : ""),
      el("td", r.rmsDb.toFixed(1)),
      el("td", r.audibleSec.toFixed(2)),
      el("td", r.ok ? "yes" : "NO", r.ok ? "good" : "bad"),
    );
    t.append(tr);
  }
  wrap.append(t);
  return wrap;
}

async function runAll(): Promise<{
  sfx: RenderStats[];
  moods: RenderStats[];
  stress: RenderStats;
}> {
  const out = byId("offline");
  out.replaceChildren(el("span", "rendering…"));
  const sfxRows = await renderSfxTable();
  const moodRows = await renderMoodTable();
  const stress = await renderStress();
  out.replaceChildren(
    table("SFX", sfxRows),
    table("Music (12 s, darkness 0.3)", moodRows),
    table("Stress", [stress]),
  );
  return { sfx: sfxRows, moods: moodRows, stress };
}

byId("run-offline").addEventListener("click", () => {
  void runAll();
});

declare global {
  interface Window {
    radianceAudioLab?: {
      audio: typeof audio;
      engine: typeof _engine;
      renderSfxTable: typeof renderSfxTable;
      renderMoodTable: typeof renderMoodTable;
      runAll: typeof runAll;
    };
  }
}

window.radianceAudioLab = { audio, engine: _engine, renderSfxTable, renderMoodTable, runAll };
