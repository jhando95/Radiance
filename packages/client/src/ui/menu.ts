import { CLASS_IDS, getClass } from "@radiance/core";
import type { LobbyInfo } from "../net/session";
import { el } from "./dom";

export interface MenuChoice {
  name: string;
  classId: string;
}

export interface MenuHandlers {
  offline(choice: MenuChoice, botClasses: string[]): void;
  create(choice: MenuChoice): void;
  join(choice: MenuChoice, code: string): void;
  rejoin(): void;
}

const NAME_KEY = "radiance:name";

function remembered(): string {
  try {
    return localStorage.getItem(NAME_KEY) ?? "";
  } catch {
    return "";
  }
}

function remember(name: string): void {
  try {
    localStorage.setItem(NAME_KEY, name);
  } catch {
    // ignore
  }
}

function classSelect(value: string, onChange?: (v: string) => void): HTMLSelectElement {
  const select = el(
    "select",
    {},
    ...CLASS_IDS.map((id) =>
      el("option", { value: id }, `${getClass(id).name} — ${getClass(id).blurb}`),
    ),
  );
  select.value = value;
  if (onChange) select.addEventListener("change", () => onChange(select.value));
  return select;
}

export function renderHome(root: HTMLElement, h: MenuHandlers, canRejoin: boolean): void {
  const name = el("input", { value: remembered(), maxLength: 24, placeholder: "Your name" });
  const cls = classSelect(CLASS_IDS[0] as string);
  const code = el("input", { maxLength: 8, placeholder: "CODE" });
  code.style.textTransform = "uppercase";

  const choice = (): MenuChoice | null => {
    const n = name.value.trim();
    if (!n) {
      name.focus();
      return null;
    }
    remember(n);
    return { name: n, classId: cls.value };
  };
  const button = (label: string, onClick: () => void, secondary = false) => {
    const b = el("button", { className: secondary ? "secondary" : "" }, label);
    b.addEventListener("click", onClick);
    return b;
  };
  const otherClass = () => CLASS_IDS.find((c) => c !== cls.value) ?? (CLASS_IDS[0] as string);

  root.replaceChildren(
    el(
      "div",
      { className: "card" },
      el("h1", {}, "RADIANCE"),
      el("p", { className: "sub" }, "Carry the light down together."),
      el("label", {}, "Name", name),
      el("label", {}, "Class", cls),
      canRejoin && button("Rejoin last online game", () => h.rejoin()),
      el(
        "div",
        { className: "row" },
        button(
          "Play solo",
          () => {
            const c = choice();
            if (c) h.offline(c, []);
          },
          true,
        ),
        button(
          "Solo + bot ally",
          () => {
            const c = choice();
            if (c) h.offline(c, [otherClass()]);
          },
          true,
        ),
      ),
      el("div", { className: "divider" }),
      button("Create online room", () => {
        const c = choice();
        if (c) h.create(c);
      }),
      el(
        "div",
        { className: "row" },
        code,
        button("Join", () => {
          const c = choice();
          if (c && code.value.trim()) h.join(c, code.value.trim().toUpperCase());
        }),
      ),
    ),
  );
}

export function renderLobby(
  root: HTMLElement,
  lobby: LobbyInfo,
  me: string,
  actions: { start(): void; leave(): void; setClass(classId: string): void },
): void {
  const isHost = lobby.hostId === me;
  const mine = lobby.players.find((p) => p.id === me);
  const start = el("button", { disabled: !isHost }, isHost ? "Start" : "Waiting for host…");
  start.addEventListener("click", () => actions.start());
  const leave = el("button", { className: "secondary" }, "Leave");
  leave.addEventListener("click", () => actions.leave());

  root.replaceChildren(
    el(
      "div",
      { className: "card" },
      el("p", { className: "sub" }, "Share this code with friends"),
      el("div", { className: "code" }, lobby.code),
      el(
        "ul",
        { className: "players" },
        ...lobby.players.map((p) =>
          el(
            "li",
            {},
            el(
              "span",
              {},
              `${p.name}${p.id === lobby.hostId ? " ★" : ""}${p.id === me ? " (you)" : ""}`,
            ),
            el(
              "span",
              { className: "muted" },
              `${getClass(p.classId).name}${p.connected ? "" : " · offline"}`,
            ),
          ),
        ),
      ),
      el(
        "label",
        {},
        "Your class",
        classSelect(mine?.classId ?? (CLASS_IDS[0] as string), actions.setClass),
      ),
      el("p", { className: "muted" }, `${lobby.players.length}/4 players`),
      el("div", { className: "row" }, leave, start),
    ),
  );
}
