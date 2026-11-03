/** Dev gallery for icons, backdrops and the UI kit. Open /gallery-env.html. */
import { type Biome, drawBackdrop, drawMapBackdrop } from "./backgrounds";
import { drawIcon, ICON_IDS, type IconId } from "./icons";
import { makeCanvas, upscale } from "./pixel";
import { drawBarFrame, drawButton, drawLightCone, drawPanel, drawSlot, drawTitleLogo } from "./ui";

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  text?: string,
): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  if (text) e.textContent = text;
  return e;
}

function section(id: string): HTMLElement {
  const s = document.getElementById(id);
  if (!s) throw new Error(`missing #${id}`);
  return s;
}

function sample(parent: HTMLElement, c: HTMLCanvasElement, label: string, scale: number) {
  const d = el("div");
  d.className = "sample";
  d.append(upscale(c, scale), el("span", label));
  parent.append(d);
}

const timings: string[] = [];
function timed<T>(label: string, fn: () => T): T {
  const t0 = performance.now();
  const r = fn();
  timings.push(`${label}: ${(performance.now() - t0).toFixed(1)}ms`);
  return r;
}

// ---- icons ----
{
  const root = section("icons");
  root.append(el("h2", `Icons (16x16 @3x) — ${ICON_IDS.length}`));
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
  for (const [name, test] of groups) {
    root.append(el("h3", name));
    const grid = el("div");
    grid.className = "grid";
    for (const id of ICON_IDS.filter(test)) {
      const cell = el("div");
      cell.className = "cell";
      cell.append(upscale(drawIcon(id as IconId), 3), el("span", id));
      grid.append(cell);
    }
    root.append(grid);
  }
  timings.push(`all icons: ${(performance.now() - t0).toFixed(1)}ms`);
  // 1x strip for readability check
  root.append(el("h3", "1x and 2x readability strip"));
  const strip = makeCanvas(ICON_IDS.length * 18, 18);
  const sctx = strip.getContext("2d");
  if (sctx) {
    sctx.fillStyle = "#151220";
    sctx.fillRect(0, 0, strip.width, strip.height);
    ICON_IDS.forEach((id, i) => {
      sctx.drawImage(drawIcon(id), i * 18 + 1, 1);
    });
  }
  root.append(strip, upscale(strip, 2));
}

// ---- UI kit ----
{
  const root = section("ui");
  root.append(el("h2", "UI kit (@3x)"));
  const r1 = el("div");
  r1.className = "row";
  sample(r1, drawTitleLogo(), "drawTitleLogo()", 3);
  root.append(r1);
  const r2 = el("div");
  r2.className = "row";
  sample(r2, drawPanel(80, 44), "panel default 80x44", 3);
  sample(r2, drawPanel(80, 44, "inset"), "panel inset", 3);
  sample(r2, drawPanel(80, 44, "highlight"), "panel highlight", 3);
  sample(r2, drawPanel(12, 12), "panel 12x12 (min)", 3);
  root.append(r2);
  const r3 = el("div");
  r3.className = "row";
  for (const r of ["empty", "common", "uncommon", "rare", "epic", "relic"] as const) {
    const slot = drawSlot(r);
    if (r !== "empty") {
      const ctx = slot.getContext("2d");
      const icon = drawIcon(
        r === "common"
          ? "item_trinket_coin"
          : r === "uncommon"
            ? "item_trinket_vial"
            : r === "rare"
              ? "item_trinket_shard"
              : r === "epic"
                ? "item_weapon_hexer"
                : "item_lamp_oil",
      );
      const c = makeCanvas(20, 20);
      const cctx = c.getContext("2d");
      if (ctx && cctx) {
        cctx.drawImage(slot, 0, 0);
        cctx.drawImage(icon, 2, 2);
        sample(r3, c, `slot ${r} + icon`, 3);
      }
    }
    sample(r3, slot, `slot ${r}`, 3);
  }
  root.append(r3);
  const r4 = el("div");
  r4.className = "row";
  for (const st of ["idle", "hover", "pressed", "disabled"] as const)
    sample(r4, drawButton(48, 16, st), `button ${st}`, 3);
  root.append(r4);
  const r5 = el("div");
  r5.className = "row";
  for (const w of [40, 64, 100]) {
    const f = drawBarFrame(w);
    const c = makeCanvas(w, 6);
    const ctx = c.getContext("2d");
    if (ctx) {
      ctx.drawImage(f, 0, 0);
      ctx.fillStyle = w === 64 ? "#f2a93b" : "#bd4a2e";
      ctx.fillRect(2, 1, Math.floor((w - 4) * 0.66), 4);
      ctx.fillStyle = w === 64 ? "#ffd36e" : "#e78450";
      ctx.fillRect(2, 1, Math.floor((w - 4) * 0.66), 1);
    }
    sample(r5, f, `bar frame w=${w}`, 3);
    sample(r5, c, "with fill", 3);
  }
  const cone = drawLightCone(24);
  const cbg = makeCanvas(48, 48);
  const cctx = cbg.getContext("2d");
  if (cctx) {
    cctx.fillStyle = "#222";
    cctx.fillRect(0, 0, 48, 48);
    cctx.drawImage(cone, 0, 0);
  }
  sample(r5, cbg, "light cone r=24", 3);
  root.append(r5);
}

// ---- backdrops ----
function composite(layers: HTMLCanvasElement[]): HTMLCanvasElement {
  const c = makeCanvas(320, 180);
  const ctx = c.getContext("2d");
  if (!ctx) return c;
  for (const l of layers) ctx.drawImage(l, Math.round((320 - l.width) / 2), 0);
  return c;
}

function darkTest(base: HTMLCanvasElement, lights: [number, number, number][]): HTMLCanvasElement {
  const c = makeCanvas(320, 180);
  const ctx = c.getContext("2d");
  const ov = makeCanvas(320, 180);
  const octx = ov.getContext("2d");
  if (!ctx || !octx) return c;
  ctx.drawImage(base, 0, 0);
  octx.fillStyle = "rgba(5,4,10,0.6)";
  octx.fillRect(0, 0, 320, 180);
  octx.globalCompositeOperation = "destination-out";
  for (const [x, y, r] of lights) octx.drawImage(drawLightCone(r), x - r, y - r);
  ctx.drawImage(ov, 0, 0);
  return c;
}

{
  const root = section("backdrops");
  root.append(el("h2", "Battle backdrops (composited @4x, then darkness test)"));
  const biomes: Biome[] = ["duskMines", "crystalHollows", "ashenSurface"];
  for (const biome of biomes) {
    const bd = timed(`${biome}`, () => drawBackdrop(biome, 1));
    const comp = composite(bd.layers);
    const wrap = el("div");
    wrap.className = "bd";
    wrap.id = `bd-${biome}`;
    wrap.append(el("h3", `${biome} — seed 1 (${bd.layers.length} layers)`));
    const c4 = upscale(comp, 4);
    // ground guide marks for feet at y=160
    wrap.append(c4);
    root.append(wrap);
    const wrapD = el("div");
    wrapD.className = "bd";
    wrapD.id = `bdd-${biome}`;
    wrapD.append(el("h3", `${biome} — darkness overlay test`));
    wrapD.append(
      upscale(
        darkTest(comp, [
          [110, 140, 70],
          [215, 140, 60],
        ]),
        4,
      ),
    );
    root.append(wrapD);
    const lay = el("div");
    lay.className = "row";
    lay.id = `bdl-${biome}`;
    bd.layers.forEach((l, i) => {
      const bg = makeCanvas(l.width, l.height);
      const ctx = bg.getContext("2d");
      if (ctx) {
        ctx.fillStyle = "#ff00ff";
        ctx.fillRect(0, 0, l.width, l.height);
        ctx.drawImage(l, 0, 0);
      }
      sample(lay, bg, `layer ${i} (${l.width}x${l.height})`, 1);
    });
    root.append(lay);
  }
  const alt = el("div");
  alt.className = "row";
  alt.id = "bd-seeds";
  alt.append(el("h3", "seed variety (seed 2, 3) @2x"));
  for (const biome of biomes)
    for (const seed of [2, 3])
      sample(alt, composite(drawBackdrop(biome, seed).layers), `${biome} ${seed}`, 2);
  root.append(alt);
}

{
  const root = section("map");
  root.append(el("h2", "Map / title backdrop @4x"));
  const m = timed("map", () => drawMapBackdrop(1));
  const c = makeCanvas(320, 180);
  const ctx = c.getContext("2d");
  if (ctx) {
    ctx.drawImage(m, 0, 0);
    const logo = drawTitleLogo();
    ctx.drawImage(logo, Math.round((320 - logo.width) / 2), 40);
  }
  const w = el("div");
  w.id = "map-bd";
  w.append(upscale(m, 4), el("h3", "with title logo"), upscale(c, 4));
  root.append(w);
}

const t = document.getElementById("timing");
if (t) t.textContent = timings.join("  |  ");
