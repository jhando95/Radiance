import * as Phaser from "phaser";
import { OfflineSession } from "./net/offline";
import { defaultServerUrl, hasRejoin, OnlineSession } from "./net/online";
import type { GameSession } from "./net/session";
import { CombatScene, HEIGHT, WIDTH } from "./scenes/CombatScene";
import { type MenuHandlers, renderHome, renderLobby } from "./ui/menu";
import { toast } from "./ui/toast";

const menu = document.getElementById("menu") as HTMLElement;
let game: Phaser.Game | null = null;
let session: GameSession | null = null;

function showMenu(): void {
  menu.hidden = false;
}

function hideMenu(): void {
  menu.hidden = true;
}

function ensureGame(s: GameSession): void {
  if (game) {
    game.scene.start("combat", { session: s });
    return;
  }
  game = new Phaser.Game({
    type: Phaser.AUTO,
    width: WIDTH,
    height: HEIGHT,
    parent: "game",
    backgroundColor: "#0d0b14",
    scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
    scene: [],
  });
  game.scene.add("combat", CombatScene, true, { session: s });
}

function leave(): void {
  session?.close();
  session = null;
  game?.scene.stop("combat");
  goHome();
}

function begin(s: GameSession): void {
  session = s;
  let inCombat = false;
  s.subscribe((e) => {
    if (e.type === "error") toast(e.message);
    if (e.type === "lobby" && !inCombat) {
      renderLobby(menu, e.lobby, s.playerId, {
        start: () => s.startGame(),
        leave,
        setClass: (c) => s.setClass(c),
      });
      showMenu();
    }
    if (e.type === "error" && !inCombat && s.mode === "online" && !s.playerId) goHome();
  });
  // Subscribe before the first state arrives so the scene receives it.
  s.subscribe((e) => {
    if (e.type === "state" && !inCombat) {
      inCombat = true;
      hideMenu();
      // The scene reads session.currentView on boot, so no state is lost.
      ensureGame(s);
    }
  });
}

const handlers: MenuHandlers = {
  offline(choice, botClasses) {
    const s = new OfflineSession({ ...choice, botClasses });
    begin(s);
    s.startGame();
  },
  create(choice) {
    begin(new OnlineSession(defaultServerUrl(), { kind: "create", ...choice }));
  },
  join(choice, code) {
    begin(new OnlineSession(defaultServerUrl(), { kind: "join", code, ...choice }));
  },
  rejoin() {
    begin(new OnlineSession(defaultServerUrl(), { kind: "rejoin" }));
  },
};

function goHome(): void {
  renderHome(menu, handlers, hasRejoin());
  showMenu();
}

goHome();
