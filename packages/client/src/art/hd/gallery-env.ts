/**
 * Dev gallery for the HD environment art, icons and UI kit. Open /hd-env.html
 * (optional `?only=backdrops|map|icons|ui` to render one section).
 */
import "@fontsource/cinzel/900.css";
import "@fontsource/alegreya-sans/500.css";
import type { Biome } from "../backgrounds";
import { ICON_IDS, type IconId } from "../icons";
import { drawBackdropHD, drawMapBackdropHD } from "./backdrops";
import { drawIconHD, drawSkillIconHD } from "./iconsHD";
import { canvas, ctx2d } from "./ink";
import {
  BAR_INSET,
  drawBarFrameHD,
  drawButtonHD,
  drawPanelHD,
  drawSlotHD,
  drawTitleLogoHD,
} from "./uiHD";

const only = new URLSearchParams(location.search).get("only");
const show = (s: string) => !only || only.split(",").includes(s);

function el<K extends keyof HTMLElementTagNameMap>(tag: K, text?: string): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  if (text) e.textContent = text;
  return e;
}
function section(id: string): HTMLElement {
  const s = document.getElementById(id);
  if (!s) throw new Error(`missing #${id}`);
  return s;
}
const timings: string[] = [];
function timed<T>(label: string, fn: () => T): T {
  const t0 = performance.now();
  const r = fn();
  timings.push(`${label}: ${(performance.now() - t0).toFixed(1)} ms`);
  return r;
}
function sample(parent: HTMLElement, c: HTMLCanvasElement, label: string) {
  const d = el("div");
  d.className = "sample";
  d.append(c, el("span", label));
  parent.append(d);
}
/** Exposed for screenshot scripts: full-resolution composites. */
const exported: Record<string, HTMLCanvasElement> = {};
(window as unknown as { __hd: typeof exported }).__hd = exported;

// ---------------------------------------------------------------------------
// Backdrops
// ---------------------------------------------------------------------------

function composite(layers: HTMLCanvasElement[]): HTMLCanvasElement {
  const c = canvas(1920, 1080);
  const ctx = ctx2d(c);
  for (const l of layers) ctx.drawImage(l, (1920 - l.width) / 2, 0);
  return c;
}

/** Stand-in squad and enemies (simple dark figures, feet on y = 750) for readability checks. */
function standIns(ctx: CanvasRenderingContext2D) {
  const figs: [number, number, boolean][] = [
    [300, 290, false],
    [450, 300, false],
    [600, 280, false],
    [745, 310, false],
    [1175, 300, true],
    [1325, 330, true],
    [1480, 280, true],
    [1630, 340, true],
  ];
  for (const [x, h, enemy] of figs) {
    const w = h * 0.36;
    ctx.save();
    ctx.fillStyle = "rgba(0,0,0,0.45)";
    ctx.beginPath();
    ctx.ellipse(x, 752, w * 0.75, 12, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = enemy ? "#3a2026" : "#2a2a36";
    ctx.strokeStyle = "#0b0810";
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.roundRect(x - w / 2, 750 - h * 0.82, w, h * 0.82, w * 0.3);
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(x, 750 - h * 0.86, w * 0.32, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = enemy ? "#b05a3a" : "#e0a050";
    ctx.fillRect(x + (enemy ? -w / 2 + 3 : w / 2 - 9), 750 - h * 0.78, 6, h * 0.7);
    ctx.restore();
  }
}

function darknessPreview(base: HTMLCanvasElement): HTMLCanvasElement {
  const c = canvas(1920, 1080);
  const ctx = ctx2d(c);
  ctx.drawImage(base, 0, 0);
  standIns(ctx);
  const dark = canvas(1920, 1080);
  const d = ctx2d(dark);
  d.fillStyle = "rgba(5,4,10,0.55)";
  d.fillRect(0, 0, 1920, 1080);
  d.globalCompositeOperation = "destination-out";
  const pools: [number, number, number][] = [
    [517, 650, 430],
    [1180, 650, 230],
    [1330, 650, 230],
  ];
  for (const [x, y, r] of pools) {
    d.save();
    d.translate(x, y);
    d.scale(1, 0.75);
    const g = d.createRadialGradient(0, 0, 0, 0, 0, r);
    g.addColorStop(0, "rgba(0,0,0,1)");
    g.addColorStop(0.55, "rgba(0,0,0,0.7)");
    g.addColorStop(1, "rgba(0,0,0,0)");
    d.fillStyle = g;
    d.fillRect(-r, -r, r * 2, r * 2);
    d.restore();
  }
  ctx.drawImage(dark, 0, 0);
  // HUD line
  ctx.fillStyle = "rgba(8,6,12,0.85)";
  ctx.fillRect(0, 858, 1920, 222);
  return c;
}

if (show("backdrops")) {
  const root = section("backdrops");
  root.append(el("h2", "Battle backdrops (1920x1080 composited; right = darkness-overlay preview)"));
  const biomes: Biome[] = ["duskMines", "crystalHollows", "ashenSurface"];
  for (const biome of biomes) {
    for (const seed of [2, 1, 4]) {
      root.append(el("h3", `${biome} — seed ${seed}`));
      const bd = timed(`${biome}#${seed}`, () => drawBackdropHD(biome, seed));
      const comp = composite(bd.layers);
      const prev = darknessPreview(comp);
      exported[`${biome}_${seed}`] = comp;
      exported[`${biome}_${seed}_dark`] = prev;
      const row = el("div");
      row.className = "bdrow";
      row.append(comp, prev);
      root.append(row);
      if (seed === 2) {
        bd.layers.forEach((l, i) => {
          exported[`${biome}_${seed}_L${i}`] = l;
        });
      }
    }
  }
}

if (show("map")) {
  const root = section("map");
  root.append(el("h2", "Map / title backdrop"));
  for (const seed of [1, 2]) {
    const m = timed(`map#${seed}`, () => drawMapBackdropHD(seed));
    exported[`map_${seed}`] = m;
    const c = canvas(1920, 1080);
    const ctx = ctx2d(c);
    ctx.drawImage(m, 0, 0);
    const row = el("div");
    row.className = "bdrow";
    row.append(c);
    root.append(row);
  }
}

// ---------------------------------------------------------------------------
// Icons
// ---------------------------------------------------------------------------

if (show("icons")) {
  const root = section("icons");
  root.append(el("h2", `Icons — ${ICON_IDS.length} (96 render px, then 48)`));
  const groups: [string, (id: string) => boolean][] = [
    ["Skills: Vanguard", (id) => /shieldBash|bulwark|provoke|seismic|grapple|rally/.test(id)],
    ["Skills: Gunner", (id) => /aimed|suppress|flare|piercing|pointBlank|quickReload/.test(id)],
    ["Skills: Lamplighter", (id) => /kindle|radiantLash|beacon|purge|blinding|warmth/.test(id)],
    ["Skills: Reaver", (id) => /rend|lunge|flurry|execute|shadowstep|hamstring/.test(id)],
    ["Skills: Hexer", (id) => /voidBolt|hexOf|siphon|umbral|snuff|rotCurse/.test(id)],
    ["Skills: Common & Enemy", (id) => /skill_(move|wait|enemy)/.test(id)],
    ["Statuses", (id) => id.startsWith("status_")],
    ["Items", (id) => id.startsWith("item_")],
    ["Map nodes", (id) => id.startsWith("node_")],
    ["Stats & UI", (id) => id.startsWith("stat_") || id.startsWith("ui_")],
    ["Elements", (id) => id.startsWith("elem_")],
    ["Disciplines", (id) => id.startsWith("disc_")],
  ];
  const t0 = performance.now();
  for (const id of ICON_IDS) drawIconHD(id, 96);
  timings.push(`all ${ICON_IDS.length} icons @96: ${(performance.now() - t0).toFixed(1)} ms`);
  const t1 = performance.now();
  for (const id of ICON_IDS) drawIconHD(id, 48);
  timings.push(`all icons @48: ${(performance.now() - t1).toFixed(1)} ms`);
  for (const [name, test] of groups) {
    root.append(el("h3", name));
    const grid = el("div");
    grid.className = "grid";
    const ids = ICON_IDS.filter(test) as IconId[];
    for (const id of ids) {
      const cell = el("div");
      cell.className = "cell";
      cell.append(drawIconHD(id, 96), el("span", id));
      grid.append(cell);
    }
    root.append(grid);
    const small = el("div");
    small.className = "grid";
    small.style.marginTop = "4px";
    for (const id of ids) {
      const cell = el("div");
      cell.className = "cell";
      cell.append(drawIconHD(id, 48));
      small.append(cell);
    }
    root.append(small);
  }
  root.append(el("h3", "Skill-framed variant (drawSkillIconHD) at 96 and 48, and inside slots"));
  const framed = el("div");
  framed.className = "grid";
  const skills = ICON_IDS.filter((id) => id.startsWith("skill_")) as IconId[];
  for (const id of skills) framed.append(drawSkillIconHD(id, 96));
  root.append(framed);
  const framed2 = el("div");
  framed2.className = "grid";
  framed2.style.marginTop = "6px";
  for (const id of skills) framed2.append(drawSkillIconHD(id, 48));
  root.append(framed2);
  const inSlots = el("div");
  inSlots.className = "grid";
  inSlots.style.marginTop = "6px";
  const rar = ["common", "uncommon", "rare", "epic", "relic"] as const;
  ICON_IDS.filter((id) => id.startsWith("item_")).forEach((id, i) => {
    const s = drawSlotHD(rar[i % rar.length], 96);
    const c = canvas(96, 96);
    const ctx = ctx2d(c);
    ctx.drawImage(s, 0, 0);
    ctx.drawImage(drawIconHD(id as IconId, 72), 12, 12);
    inSlots.append(c);
  });
  root.append(inSlots);
}

// ---------------------------------------------------------------------------
// UI kit
// ---------------------------------------------------------------------------

function textOn(c: HTMLCanvasElement, text: string, size: number, color: string, y?: number) {
  const ctx = ctx2d(c);
  ctx.font = `600 ${size}px "Alegreya Sans", sans-serif`;
  ctx.fillStyle = color;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(text, c.width / 2, y ?? c.height / 2 + 1);
  return c;
}

async function drawUi() {
  const root = section("ui");
  root.append(el("h2", "UI kit"));
  root.append(el("h3", "Panels (default / inset / highlight) and a large 900x500 panel"));
  let row = el("div");
  row.className = "row";
  for (const v of ["default", "inset", "highlight"] as const) {
    const p = timed(`panel ${v}`, () => drawPanelHD(380, 240, v));
    sample(row, textOn(p, `Panel — ${v}`, 26, "#d8cbb0"), `drawPanelHD(380,240,"${v}")`);
  }
  sample(row, drawPanelHD(160, 90), "160x90");
  root.append(row);
  row = el("div");
  row.className = "row";
  const big = timed("panel 900x500", () => drawPanelHD(900, 500));
  {
    const ctx = ctx2d(big);
    ctx.font = '900 40px "Cinzel", serif';
    ctx.fillStyle = "#f2c46e";
    ctx.textAlign = "left";
    ctx.fillText("Expedition Ledger", 56, 92);
    ctx.font = '500 24px "Alegreya Sans", sans-serif';
    ctx.fillStyle = "#cfc4ae";
    const lines = [
      "The lamp burns low. Three days of oil remain, and the vein runs deeper still.",
      "Mercenaries: 4 / 4 — morale steady. Ore: 312. Relics recovered: 2.",
      "Readable body text must sit calmly on the panel interior.",
    ];
    lines.forEach((l, i) => {
      ctx.fillText(l, 56, 160 + i * 40);
    });
    const inset = drawPanelHD(360, 170, "inset");
    ctx.drawImage(inset, 56, 290);
    const hi = drawPanelHD(360, 170, "highlight");
    ctx.drawImage(hi, 470, 290);
  }
  sample(row, big, "drawPanelHD(900,500) with inset + highlight children");
  root.append(row);

  root.append(el("h3", "Slots (96 and 64)"));
  row = el("div");
  row.className = "row";
  for (const r of ["empty", "common", "uncommon", "rare", "epic", "relic"] as const) {
    sample(row, drawSlotHD(r, 96), r);
  }
  for (const r of ["empty", "common", "uncommon", "rare", "epic", "relic"] as const) {
    sample(row, drawSlotHD(r, 64), `${r} 64`);
  }
  root.append(row);

  root.append(el("h3", "Buttons (kind × state)"));
  for (const k of ["primary", "secondary", "danger"] as const) {
    row = el("div");
    row.className = "row";
    for (const s of ["idle", "hover", "pressed", "disabled"] as const) {
      const b = drawButtonHD(270, 72, s, k);
      const col = s === "disabled" ? "#77707a" : k === "primary" ? "#fff0cf" : "#e8dcc6";
      sample(row, textOn(b, k === "danger" ? "Abandon" : k === "primary" ? "Embark" : "Inventory", 28, col, 36 + (s === "pressed" ? 2 : 0)), `${k} / ${s}`);
    }
    sample(row, drawButtonHD(140, 56, "idle", k), "140x56");
    root.append(row);
  }

  root.append(el("h3", `Bar frames (BAR_INSET = ${JSON.stringify(BAR_INSET)})`));
  row = el("div");
  row.className = "row";
  const fills: [number, number, string, string][] = [
    [360, 22, "#bd4a2e", "#e78450"],
    [360, 22, "#c7711c", "#ffd36e"],
    [240, 16, "#7546b8", "#a87fe2"],
    [480, 30, "#2f5f26", "#8fd25a"],
  ];
  for (const [w, h, a, b] of fills) {
    const f = drawBarFrameHD(w, h);
    const c = canvas(w, h);
    const ctx = ctx2d(c);
    const iw = w - BAR_INSET.x * 2;
    const ih = h - BAR_INSET.y * 2;
    const g = ctx.createLinearGradient(0, BAR_INSET.y, 0, BAR_INSET.y + ih);
    g.addColorStop(0, b);
    g.addColorStop(1, a);
    ctx.fillStyle = g;
    ctx.fillRect(BAR_INSET.x, BAR_INSET.y, iw * 0.68, ih);
    ctx.drawImage(f, 0, 0);
    sample(row, c, `${w}x${h}`);
  }
  root.append(row);

  root.append(el("h3", "Title logo"));
  try {
    await document.fonts.load('900 64px "Cinzel"');
  } catch {
    // fall through: logo uses its fallback stack
  }
  row = el("div");
  row.className = "row";
  const logo = timed("title logo", () => drawTitleLogoHD());
  exported.logo = logo;
  const back = canvas(logo.width + 80, logo.height + 80);
  const bctx = ctx2d(back);
  bctx.drawImage(drawMapBackdropHD(1), 400, 120, back.width, back.height, 0, 0, back.width, back.height);
  bctx.drawImage(logo, 40, 40);
  exported.logoOnMap = back;
  sample(row, back, `drawTitleLogoHD() ${logo.width}x${logo.height}`);
  root.append(row);
}

async function main() {
  if (show("ui")) await drawUi();
  const t = document.getElementById("timing");
  if (t) t.textContent = timings.join("\n");
  (window as unknown as { __done: boolean }).__done = true;
}
void main();
