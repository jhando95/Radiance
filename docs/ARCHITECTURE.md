# Radiance — Technical Architecture

Related decisions: [ADR 0001 (tech stack)](adr/0001-tech-stack.md),
[ADR 0002 (networking model)](adr/0002-networking-model.md).

## 1. Overview

```
┌───────────────────────── packages/client (browser / desktop) ─────────────────────────┐
│  Phaser scenes  ──clicks──▶  GameSession.command(cmd)                                 │
│       ▲                        │                                                      │
│       └── CombatView + events ─┤  OfflineSession: runs @radiance/core locally         │
│                                └  OnlineSession:  JSON over WebSocket ───────┐        │
└──────────────────────────────────────────────────────────────────────────────┼────────┘
                                                                               │
┌────────────────────────── packages/server (Node) ────────────────────────────▼────────┐
│  ws transport ─▶ parseClientMessage (zod) ─▶ RoomManager ─▶ applyCommand (core)       │
│                                                     └─▶ viewFor(state, player) per member
└───────────────────────────────────────────────────────────────────────────────────────┘
                     ▲                                        ▲
┌────────────────────┴──── packages/core (pure TypeScript) ───┴─────────────────────────┐
│  rng · types · content (cards/enemies/classes) · combat (rules) · view (redaction)    │
│  protocol (wire schemas) · sim (bots + balance simulator)                             │
│  NO DOM, NO Node APIs, NO I/O, NO Math.random, NO Date                                │
└───────────────────────────────────────────────────────────────────────────────────────┘
```

**The single most important rule: game rules live only in `@radiance/core`.** The client draws
state and sends intent. The server validates and relays. Both run the _same_ core code, so
offline play, online play, tests, the simulator and replays all behave identically.

## 2. The core engine

### 2.1 State, commands, events

- **`CombatState`** is plain JSON: numbers, strings, arrays and plain objects. It has no classes,
  Maps or functions, so it can be cloned, diffed, saved, sent over the wire and compared with
  `toEqual`.
- **`Command`** is what a player _wants_ to do: `playCard`, `endTurn`, `cancelEndTurn`.
- **`applyCommand(state, playerId, command) → { ok, state, events } | { ok: false, error }`** is
  the only way state changes. It never mutates its input: it clones the state, then mutates the
  clone.
- **`CombatEvent[]`** records _what happened_ (damage, block, draw, enemyMove…). Clients use
  events to animate. The state alone is enough to render a correct frame.
- **`canPlayCard`** is shared validation. The UI uses it to grey out cards, and `applyCommand`
  uses it to reject illegal plays. One rule, one implementation.

### 2.2 Determinism rules

These rules let co-op, saves, replays and bug reports work. Breaking one is a bug.

1. **No `Math.random()`.** Use `stream(state, name)` from `combat/state.ts`, which returns a
   seeded sfc32 generator whose state is stored _in the game state_.
2. **Separate streams per purpose** (`deck:<playerId>`, `enemies:ai`, `enemies:setup`, `cards`).
   Then one player's shuffle never changes what an enemy does, and adding a new random effect
   doesn't reshuffle every existing seed.
3. **No wall-clock time, no `Date`, no locale-dependent formatting** in rules.
4. **Integer math** for gameplay numbers (`Math.floor` after multipliers). Avoid accumulating
   floats in state.
5. **Iteration order must be defined:** arrays, or objects with string keys in insertion order.
   Never rely on `Set` or `Map` ordering of computed keys in rules.
6. **Save format = seed + command log.** `replay(options, log)` must reproduce the state exactly.
   A test enforces this.

### 2.3 Content as data

Cards, enemies, classes and encounters are typed TypeScript objects (`content/*.ts`) built from a
small **effect vocabulary** (`damage`, `block`, `draw`, `radiance`, `status`, `illuminate`,
`heal`, …). Benefits:

- Card text is **generated** from effects (`describeCard`), so text and behavior can't drift apart.
- The simulator and bots understand every card without special-casing.
- Content can later move to JSON or spreadsheets for designers and modders without changing the
  engine.

When a card needs genuinely new behavior, **add a new effect kind** (with tests) instead of
writing `if (card.id === "...")`. Keepsakes and powers (M1–M2) will use the same approach through
**trigger hooks** (`onTurnStart`, `onCardPlayed`, `onDamageTaken`, …) that run effect lists.

### 2.4 Hidden information

`viewFor(state, viewerId)` builds what a client may see:

- **RNG state is stripped.** With it, a client could predict draws and enemy rolls.
- **Draw pile order is hidden.** The contents are sorted.
- **Veiled intents are removed** until the enemy is illuminated.

The server only ever sends views, never raw state. Offline mode uses the same function so both
paths render identically.

## 3. Networking

The full reasoning is in [ADR 0002](adr/0002-networking-model.md).

- **Model:** an authoritative server sends **state snapshots**. Clients send commands. The server
  runs `applyCommand` and sends each member their own `viewFor` plus the events.
- **Why this works for Radiance:** the game is turn-based and low-frequency (a few commands per
  second at peak), the state is small (a few KB), and snapshots make reconnection trivial (just
  send the current view).
- **Protocol** (`core/src/protocol.ts`): JSON messages discriminated by `t`, with a protocol
  version on join. Every client message is validated with zod before use. Names, codes and
  command shapes are bounded.
- **Rooms:** a 5-character code from an alphabet with no look-alike characters. There's a 4-player
  cap and no joining after start. Each player gets a reconnect **token**. The room is swept after
  10 minutes with nobody connected.
- **Abuse limits:** 8 KB max message size, 20 messages/second per socket, heartbeat pings, and a
  health endpoint for the hosting platform.
- **`RoomManager` is transport-agnostic.** It talks to `Peer.send()`, so unit tests use arrays,
  production uses WebSockets, and a future **Steam P2P host mode** can run the same RoomManager
  inside the host's desktop client.

### Scaling path (only when needed)

1. A single small VM handles thousands of concurrent turn-based rooms. Rooms are in-memory, so
   the server needs one process, or sticky routing by room code.
2. If snapshots grow (a full run state with maps and decks), send JSON patches against the last
   acknowledged `version`.
3. For persistence and mid-run server restarts, store `seed + command log` per room in
   SQLite/Redis and rebuild with `replay()`.

## 4. Client

- **Phaser 4** for rendering, input, tweens, audio and asset loading.
- **Scenes** (`client/src/scenes`) render a `CombatView` and turn input into commands. They hold
  **no rules**.
- **`GameSession` interface:** `OfflineSession` (core in-browser, optional bot allies to test
  co-op alone) and `OnlineSession` (WebSocket, auto-reconnect with backoff, rejoin token in
  `sessionStorage`). Scenes can't tell which one they have.
- **Menus and lobby are plain DOM** (`client/src/ui`), built with a helper that only creates text
  nodes for untrusted strings (no `innerHTML` with player names).
- **Current rendering** rebuilds the scene graph on each state change, with simple floating
  numbers from events. **M1** replaces this with an **animation queue**: events become tweens
  played in sequence, and the authoritative state is applied when the queue drains.

## 5. Tooling

| Concern                    | Tool                                                  | Notes                                                                             |
| -------------------------- | ----------------------------------------------------- | --------------------------------------------------------------------------------- |
| Package manager / monorepo | **pnpm workspaces**                                   | `packages/*`; workspace packages export TS source directly                        |
| Language                   | **TypeScript 7** (strict, `noUncheckedIndexedAccess`) | `pnpm typecheck`                                                                  |
| Client build / dev server  | **Vite**                                              | HMR on `pnpm dev:client`                                                          |
| Server dev / build         | **tsx** (watch) / **esbuild** (bundle)                | `dist/server.js` is self-contained except `ws`                                    |
| Tests                      | **Vitest**                                            | `packages/*/src/**/*.test.ts`                                                     |
| Lint + format              | **Biome**                                             | One fast tool; `pnpm format` fixes                                                |
| Balance                    | **Bot simulator**                                     | `pnpm sim -- --runs 2000` prints win rate, turns and HP lost by encounter × party |
| E2E                        | **Playwright** (planned in CI)                        | Two browser contexts: host creates, guest joins, both play                        |
| CI                         | **GitHub Actions**                                    | lint → typecheck → test → build → sim smoke test                                  |

## 6. Testing strategy

1. **Core unit tests:** every effect kind, status, targeting rule and phase transition.
2. **Determinism tests:** replaying a recorded log reproduces identical state, and bot games are
   reproducible from their seed.
3. **Simulation:** thousands of bot combats per change. Bots must never issue an invalid command,
   and combats must always end (no stalemates). CI runs a small smoke version.
4. **Server room tests:** create, join, start, command, reject, rejoin, sweep, all without
   sockets.
5. **E2E (M1):** Playwright drives two real browsers through a co-op turn. A version of this was
   used to verify M0 by hand.

## 7. Deployment (planned)

- **Client:** a static build (`packages/client/dist`) on Cloudflare Pages, Netlify, GitHub Pages
  or itch.io. Set `VITE_SERVER_URL` to the server's `wss://` URL.
- **Server:** a single container or VM (Fly.io, Render, Railway or a $5 VPS). Use
  `pnpm --filter @radiance/server build && node packages/server/dist/server.js`. Health check at
  `/health`. Put TLS (wss) in front via the platform.
- **Desktop / Steam (M5):** wrap the client in **Electron** with **steamworks.js** for overlay,
  achievements, cloud saves, friend invites and (optionally) Steam relay networking for host mode.
  Tauri is a lighter alternative to evaluate, but the Electron + Steam path is better trodden.

## 8. Directory map

```
packages/
  core/
    src/rng.ts              seeded PRNG + helpers
    src/types.ts            state, content, command and event types
    src/content/            cards, enemies, classes, encounters (data)
    src/combat/state.ts     constants, RNG streams, lookups, damage math
    src/combat/effects.ts   effect resolution for cards and enemy moves
    src/combat/combat.ts    createCombat, applyCommand, canPlayCard, replay
    src/combat/view.ts      viewFor (redaction), describeCard, describeIntent
    src/protocol.ts         zod-validated wire protocol
    src/sim/                bot + simulator
    scripts/simulate.ts     `pnpm sim`
  server/
    src/rooms.ts            RoomManager (transport-agnostic)
    src/main.ts             ws + http entrypoint, limits, heartbeat
  client/
    src/net/                GameSession, OfflineSession, OnlineSession
    src/scenes/             Phaser scenes
    src/ui/                 DOM menus, lobby, toast
docs/                       design, architecture, roadmap, ADRs
```
