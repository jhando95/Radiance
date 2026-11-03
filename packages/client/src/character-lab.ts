/**
 * Dev page for the character sheet (character-lab.html). Boots Phaser with a stand-in map
 * scene and launches CharacterScene over it, driven by a fake GameSession that runs
 * @radiance/core locally — so equip / skills / perks / refuel really go through the rules.
 *
 * Query params: ?merc=m1..m4  ?phase=map|reward|combat  ?stash=<count>  ?seed=<string>
 */
import "@fontsource/pixelify-sans/400.css";
import "@fontsource/pixelify-sans/600.css";
import "@fontsource/pixelify-sans/700.css";
import {
  applyRunCommand,
  createRun,
  defaultSquad,
  grantXp,
  type Item,
  type MercSetup,
  type Rarity,
  type RunCommand,
  type RunState,
  rollItem,
  seedRng,
  viewFor,
} from "@radiance/core";
import * as Phaser from "phaser";
import { ensureUiTextures, iconTexture, mapBackdropTexture } from "./app/textures";
import { Emitter, type GameSession, type SessionEvent } from "./net/session";
import {
  CHARACTER_SCENE_KEY,
  CharacterScene,
  type CharacterSceneData,
} from "./scenes/CharacterScene";
import { BACKDROP_SCALE, COLORS, FONT_FAMILY, GAME_H, GAME_W, TEXT } from "./ui/theme";

const params = new URLSearchParams(window.location.search);
const SEED = params.get("seed") ?? "character-lab";
const PLAYER = "p1";

// ---------------------------------------------------------------------------------------
// Lab data: a mid-expedition run with leveled mercs, pending perk offers and a full stash.

function buildRun(): RunState {
  const names = ["Brask Hollow", "Vesk Arn", "Ilo Marrow", "Sefa Lumen"];
  const squad: MercSetup[] = defaultSquad().map((s, i) => ({ ...s, name: names[i] ?? s.name }));
  let run = createRun({
    seed: SEED,
    players: [
      { id: "p1", name: "Vesna" },
      { id: "p2", name: "Kade" },
    ],
    mercs: squad.map((setup, i) => ({ ownerId: i < 2 ? "p1" : "p2", setup })),
  });
  run = structuredClone(run);

  // Levels: p1's mercs keep pending perk offers; p2's choose everything.
  const xp = [300, 170, 460, 230];
  run.mercs.forEach((m, i) => {
    grantXp(m, xp[i] ?? 100, seedRng(`${SEED}:perks:${m.id}`));
  });

  // Loot: a varied stash, guaranteed to include some of every rarity.
  const r = seedRng(`${SEED}:loot`);
  const count = Number.parseInt(params.get("stash") ?? "34", 10);
  const rarities: (Rarity | undefined)[] = ["relic", "epic", "rare", "uncommon"];
  const disciplines = run.mercs.map((m) => m.discipline);
  for (let i = 0; i < count; i++) {
    const minRarity = rarities[i % 9];
    const item: Item = rollItem(r, run.nextUid++, {
      ilvl: 1 + (i % 5),
      rarityBonus: 40,
      disciplines,
      ...(minRarity ? { minRarity } : {}),
    });
    run.stash.push(item);
  }
  run.ore = 145;
  run.lampCharge = 62;

  // Gear up and spend some perk picks through the real rules.
  const apply = (pid: string, cmd: RunCommand) => {
    const res = applyRunCommand(run, pid, cmd);
    if (res.ok) run = res.state;
  };
  const best = (slot: Item["slot"], discipline?: string) =>
    run.stash.find((it) => it.slot === slot && (slot !== "weapon" || isFor(it, discipline)));
  for (const m of [...run.mercs]) {
    const owner = m.ownerId;
    const trinket = best("trinket");
    if (trinket) apply(owner, { type: "equip", mercId: m.id, itemUid: trinket.uid });
    if (m.ownerId === "p2") {
      const weapon = best("weapon", m.discipline);
      if (weapon) apply(owner, { type: "equip", mercId: m.id, itemUid: weapon.uid });
      const lamp = best("lamp");
      if (lamp && m.discipline !== "lamplighter")
        apply(owner, { type: "equip", mercId: m.id, itemUid: lamp.uid });
    }
    // Choose all but the last offer for p1, everything for p2.
    const merc = () => run.mercs.find((x) => x.id === m.id);
    const keep = owner === "p1" ? 1 : 0;
    while ((merc()?.perkOffers.length ?? 0) > keep) {
      const offer = merc()?.perkOffers[0];
      const perkId = offer?.[0];
      if (!perkId) break;
      apply(owner, { type: "choosePerk", mercId: m.id, perkId });
    }
  }
  // Wear and tear.
  const hurt = run.mercs[1];
  if (hurt) hurt.hp = Math.max(1, Math.round(hurt.hp * 0.55));
  const phase = params.get("phase");
  if (phase === "reward" || phase === "combat" || phase === "map") run.phase = phase;
  return run;
}

function isFor(item: Item, discipline: string | undefined): boolean {
  const map: Record<string, string> = {
    breachMaul: "vanguard",
    longRifle: "gunner",
    lanternStaff: "lamplighter",
    twinBlades: "reaver",
    voidFocus: "hexer",
  };
  return map[item.baseId] === discipline;
}

// ---------------------------------------------------------------------------------------
// Fake session: runs core locally for player p1.

class LabSession implements GameSession {
  readonly mode = "offline";
  readonly playerId = PLAYER;
  readonly isHost = true;
  readonly lobby = null;
  currentView: GameSession["currentView"];
  readonly log: RunCommand[] = [];
  private readonly emitter = new Emitter<SessionEvent>();

  constructor(public run: RunState) {
    this.currentView = viewFor(run, PLAYER);
  }

  subscribe(listener: (event: SessionEvent) => void): () => void {
    return this.emitter.on(listener);
  }

  command(cmd: RunCommand): void {
    this.log.push(cmd);
    // Async like a real network/offline session.
    queueMicrotask(() => {
      const res = applyRunCommand(this.run, PLAYER, cmd);
      if (!res.ok) {
        this.emitter.emit({ type: "error", message: res.error });
        return;
      }
      this.run = res.state;
      this.currentView = viewFor(this.run, PLAYER);
      this.emitter.emit({ type: "state", view: this.currentView, events: res.events });
    });
  }

  submitSquad(): void {}
  startGame(): void {}
  close(): void {}
}

// ---------------------------------------------------------------------------------------
// Stand-in expedition scene underneath the overlay.

class LabMapScene extends Phaser.Scene {
  constructor(private readonly session: LabSession) {
    super({ key: "labMap" });
  }

  create(): void {
    ensureUiTextures(this);
    this.add.image(GAME_W / 2, GAME_H / 2, mapBackdropTexture(this, 3)).setScale(BACKDROP_SCALE);
    this.add.image(GAME_W / 2 - 150, GAME_H / 2, iconTexture(this, "ui_lamp")).setScale(4);
    this.add
      .text(GAME_W / 2 - 110, GAME_H / 2, "Expedition map (lab) — press C", {
        ...TEXT.heading,
        color: COLORS.textDim,
      })
      .setOrigin(0, 0.5);
    this.input.keyboard?.on("keydown-C", () => this.open());
    this.open(params.get("merc") ?? undefined);
  }

  open(mercId?: string): void {
    if (this.scene.isActive(CHARACTER_SCENE_KEY)) return;
    const data: CharacterSceneData = {
      session: this.session,
      ...(mercId ? { mercId } : {}),
      onClose: () => console.info("[lab] character sheet closed"),
    };
    this.scene.launch(CHARACTER_SCENE_KEY, data);
  }
}

async function boot(): Promise<void> {
  await Promise.race([
    Promise.all([
      document.fonts.load(`16px ${FONT_FAMILY}`),
      document.fonts.load(`600 16px ${FONT_FAMILY}`),
      document.fonts.load(`700 16px ${FONT_FAMILY}`),
    ]).then(() => document.fonts.ready),
    new Promise((r) => setTimeout(r, 3000)),
  ]);
  const session = new LabSession(buildRun());
  const game = new Phaser.Game({
    type: Phaser.AUTO,
    width: GAME_W,
    height: GAME_H,
    parent: "game",
    backgroundColor: "#07060b",
    pixelArt: true,
    dom: { createContainer: true },
    scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
    scene: [],
  });
  game.scene.add(CHARACTER_SCENE_KEY, CharacterScene, false);
  game.scene.add("labMap", new LabMapScene(session), true);
  (window as unknown as { __lab: unknown }).__lab = { game, session };
}

void boot();
