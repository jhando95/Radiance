/**
 * Gameplay wiring: registers gameplay scenes and implements the title-menu flow
 * (solo / host / join / resume) on top of GameSession.
 */
import type { MercSetup } from "@radiance/core";
import type * as Phaser from "phaser";
import { flow } from "../app/flow";
import { gameplayScenes, SCENES } from "../app/scenes";
import { getSettings, onSettingsChange } from "../app/settings";
import { audio, installAudioUnlock } from "../audio";
import { uiSoundHooks } from "../ui/theme";
import { goTo } from "../app/transitions";
import { globals, sceneForPhase } from "../game/globals";
import { hasOfflineSave, OfflineSession } from "../net/offline";
import { defaultServerUrl, OnlineSession } from "../net/online";
import { BattleScene } from "./BattleScene";
import { ExpeditionScene } from "./ExpeditionScene";
import { LobbyScene } from "./LobbyScene";
import { openPause } from "./PauseOverlay";
import { SquadScene, type SquadSceneData } from "./SquadScene";
import { SummaryScene } from "./SummaryScene";

// ---- Audio wiring ---------------------------------------------------------------
installAudioUnlock();
const applyVolumes = () => {
  const s = getSettings();
  audio.setVolumes({ master: s.masterVolume, music: s.musicVolume, sfx: s.sfxVolume });
};
applyVolumes();
onSettingsChange(applyVolumes);
audio.setMusic("title");
uiSoundHooks.hover = () => audio.play("uiHover");
uiSoundHooks.click = () => audio.play("uiClick");
uiSoundHooks.back = () => audio.play("uiBack");
uiSoundHooks.error = () => audio.play("uiError");

gameplayScenes.push(SquadScene, LobbyScene, ExpeditionScene, BattleScene, SummaryScene);

const CHARACTER_KEY = "character";

function playerName(fallback = "Captain"): string {
  const name = getSettings().playerName?.trim();
  return name || fallback;
}

function sceneKeyFor(phase: string): string {
  const s = sceneForPhase(phase);
  return s === "combat" ? SCENES.combat : s === "summary" ? SCENES.summary : SCENES.expedition;
}

function endSession(): void {
  const s = globals.session;
  if (s instanceof OfflineSession) s.abandon();
  s?.close();
  globals.session = null;
}

globals.openPause = (scene: Phaser.Scene) =>
  openPause(scene, {
    abandonWarning:
      globals.session?.mode === "online"
        ? "Leave this co-op expedition? Your crew can carry on without you."
        : "Abandon this expedition? Your squad and loot will be lost.",
    onAbandon: (s) => {
      endSession();
      audio.setMusic("title");
      goTo(s, SCENES.title);
    },
  });

globals.openCharacter = (scene: Phaser.Scene, mercId?: string) => {
  const session = globals.session;
  if (!session || !scene.scene.manager.keys[CHARACTER_KEY]) return;
  if (scene.scene.isActive(CHARACTER_KEY)) return;
  scene.scene.pause();
  scene.scene.launch(CHARACTER_KEY, {
    session,
    ...(mercId ? { mercId } : {}),
    onClose: () => scene.scene.resume(),
  });
  scene.scene.bringToTop(CHARACTER_KEY);
};

flow.register({
  startSolo(scene) {
    const session = new OfflineSession(playerName());
    globals.session = session;
    const data: SquadSceneData = {
      slots: 4,
      title: "Assemble your squad",
      onConfirm: (setups: MercSetup[]) => {
        session.submitSquad(setups);
        session.startGame();
        goTo(scene.scene.get(SCENES.squad), SCENES.expedition);
      },
      onBack: () => {
        globals.session = null;
        audio.setMusic("title");
        goTo(scene.scene.get(SCENES.squad), SCENES.title);
      },
    };
    goTo(scene, SCENES.squad, data);
  },
  hostOnline(scene, name) {
    globals.session = new OnlineSession(defaultServerUrl(), { kind: "create", name: name || playerName() });
    goTo(scene, SCENES.lobby);
  },
  joinOnline(scene, name, code) {
    globals.session = new OnlineSession(defaultServerUrl(), {
      kind: "join",
      code: code.trim().toUpperCase(),
      name: name || playerName(),
    });
    goTo(scene, SCENES.lobby);
  },
  resume(scene) {
    const session = new OfflineSession(playerName());
    if (!session.resume() || !session.currentView) return;
    globals.session = session;
    goTo(scene, sceneKeyFor(session.currentView.phase));
  },
  canResume: () => hasOfflineSave(),
});

// Dev-only handle for automated playtests (Playwright) and console debugging.
if (import.meta.env.DEV || new URLSearchParams(location.search).has("test")) {
  void import("@radiance/core").then((core) => {
    (window as unknown as { __radiance: unknown }).__radiance = { globals, flow, core };
  });
}
