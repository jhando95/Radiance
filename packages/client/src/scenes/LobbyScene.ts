import type { MercSetup } from "@radiance/core";
import * as Phaser from "phaser";
import { SCENES } from "../app/scenes";
import { iconTexture, mapBackdropTexture } from "../app/textures";
import { goTo } from "../app/transitions";
import { audio } from "../audio";
import { globals, sceneForPhase } from "../game/globals";
import type { GameSession, LobbyInfo, SessionEvent } from "../net/session";
import { Button } from "../ui/Button";
import { toast } from "../ui/Toast";
import { COLOR_NUM, COLORS, GAME_H, GAME_W, TEXT } from "../ui/theme";

/** Online co-op lobby: share the code, build your mercs, depart together. */
export class LobbyScene extends Phaser.Scene {
  private session!: GameSession;
  private layer!: Phaser.GameObjects.Container;
  private unsubscribe: (() => void) | null = null;
  private leaving = false;
  private mySquad: MercSetup[] | null = null;

  constructor() {
    super({ key: SCENES.lobby });
  }

  init(data: { squad?: MercSetup[] }): void {
    this.session = globals.session as GameSession;
    this.leaving = false;
    if (data?.squad) this.mySquad = data.squad;
  }

  create(): void {
    this.add.image(GAME_W / 2, GAME_H / 2, mapBackdropTexture(this, 3)).setScale(4);
    this.add.rectangle(0, 0, GAME_W, GAME_H, 0x05040a, 0.55).setOrigin(0);
    this.layer = this.add.container(0, 0);
    audio.setMusic("title");
    this.unsubscribe = this.session.subscribe((e) => this.onSession(e));
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.unsubscribe?.());
    if (this.mySquad) this.session.submitSquad(this.mySquad);
    this.render();
    if (this.session.currentView) this.leave(sceneForPhase(this.session.currentView.phase));
  }

  private onSession(e: SessionEvent): void {
    if (e.type === "lobby") this.render();
    else if (e.type === "state") this.leave(sceneForPhase(e.view.phase));
    else if (e.type === "error") {
      toast(this, e.message, "error");
      if (!this.session.playerId) this.backToTitle();
    } else if (e.type === "status") this.render();
  }

  private leave(target: "expedition" | "combat" | "summary"): void {
    if (this.leaving) return;
    this.leaving = true;
    goTo(
      this,
      target === "combat"
        ? SCENES.combat
        : target === "summary"
          ? SCENES.summary
          : SCENES.expedition,
    );
  }

  private backToTitle(): void {
    if (this.leaving) return;
    this.leaving = true;
    this.session.close();
    globals.session = null;
    goTo(this, SCENES.title);
  }

  private render(): void {
    this.layer.removeAll(true);
    const lobby: LobbyInfo | null = this.session.lobby;
    const cx = GAME_W / 2;
    this.layer.add(this.add.text(cx, 60, "CO-OP EXPEDITION", TEXT.title).setOrigin(0.5));
    if (!lobby) {
      this.layer.add(
        this.add.text(cx, GAME_H / 2, "Connecting to the relay…", TEXT.bodyDim).setOrigin(0.5),
      );
      this.layer.add(
        new Button(this, cx, GAME_H - 80, {
          label: "Back",
          kind: "secondary",
          onClick: () => this.backToTitle(),
        }),
      );
      return;
    }
    this.layer.add(
      this.add.text(cx, 120, "Share this code with your crew", TEXT.bodyDim).setOrigin(0.5),
    );
    const code = this.add
      .text(cx, 170, lobby.code, {
        ...TEXT.display,
        fontSize: "56px",
        letterSpacing: 12,
      } as Phaser.Types.GameObjects.Text.TextStyle)
      .setOrigin(0.5);
    this.layer.add(code);

    const me = lobby.players.find((p) => p.id === this.session.playerId);
    lobby.players.forEach((p, i) => {
      const y = 250 + i * 64;
      const row = this.add
        .rectangle(cx, y, 560, 56, 0x0e0c16, 0.95)
        .setStrokeStyle(2, p.id === this.session.playerId ? COLOR_NUM.accent : 0x34305a);
      const icon = this.add
        .image(cx - 250, y, iconTexture(this, p.id === lobby.hostId ? "ui_crown" : "ui_player"))
        .setScale(2);
      const name = this.add.text(
        cx - 220,
        y - 12,
        `${p.name}${p.id === this.session.playerId ? " (you)" : ""}`,
        TEXT.subheading,
      );
      const info = this.add
        .text(
          cx + 260,
          y - 10,
          `${p.slots} merc${p.slots === 1 ? "" : "s"} · ${p.ready ? "READY" : p.connected ? "building squad…" : "offline"}`,
          {
            ...TEXT.small,
            color: p.ready ? COLORS.success : COLORS.textDim,
          },
        )
        .setOrigin(1, 0);
      this.layer.add([row, icon, name, info]);
    });
    const slots = me?.slots ?? 1;
    this.layer.add(
      this.add
        .text(
          cx,
          270 + lobby.players.length * 64,
          `The squad is always four mercenaries, split between players. You command ${slots}.`,
          TEXT.small,
        )
        .setOrigin(0.5),
    );
    const build = new Button(this, cx - 160, GAME_H - 110, {
      label: me?.ready ? "Edit mercenaries" : "Create mercenaries",
      width: 300,
      kind: me?.ready ? "secondary" : "primary",
      onClick: () => {
        goTo(this, SCENES.squad, {
          slots,
          title: `Your mercenaries (${slots} of 4)`,
          ...(this.mySquad?.length === slots ? { initial: this.mySquad } : {}),
          onConfirm: (setups: MercSetup[]) => {
            const squadScene = this.scene.get(SCENES.squad);
            goTo(squadScene, SCENES.lobby, { squad: setups });
          },
          onBack: () => goTo(this.scene.get(SCENES.squad), SCENES.lobby),
        });
      },
    });
    const allReady = lobby.players.every((p) => p.ready);
    const isHost = lobby.hostId === this.session.playerId;
    const depart = new Button(this, cx + 160, GAME_H - 110, {
      label: isHost ? (allReady ? "Depart!" : "Waiting for crew…") : "Host departs",
      width: 300,
      kind: "primary",
      disabled: !isHost || !allReady,
      onClick: () => this.session.startGame(),
    });
    const back = new Button(this, cx, GAME_H - 44, {
      label: "Leave",
      width: 200,
      height: 40,
      kind: "danger",
      onClick: () => this.backToTitle(),
    });
    this.layer.add([build, depart, back]);
  }
}
