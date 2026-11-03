# Radiance

A roguelike deckbuilder for **1–4 players with online co-op**. Carry the last light down into the
dark, together.

> Status: **M0 — Foundation**. Playable combat prototype, solo or online co-op, with programmer
> art. See the [roadmap](docs/ROADMAP.md).

## Documents

| Doc                                           | What's in it                                                              |
| --------------------------------------------- | ------------------------------------------------------------------------- |
| [Game Design](docs/GAME_DESIGN.md)            | Pillars, combat, co-op systems, classes, run structure, content targets   |
| [Architecture](docs/ARCHITECTURE.md)          | Core/server/client split, determinism rules, networking, tooling, testing |
| [Roadmap](docs/ROADMAP.md)                    | Milestones M0–M6 with exit tests, risks                                   |
| [ADR 0001](docs/adr/0001-tech-stack.md)       | Why TypeScript + Phaser + Node (vs Godot/Unity)                           |
| [ADR 0002](docs/adr/0002-networking-model.md) | Why an authoritative server with snapshots and simultaneous turns         |

## Quick start

Requires **Node 22+** and **pnpm 10** (`corepack enable` will provide it).

```bash
pnpm install
```

```bash
pnpm dev
```

`pnpm dev` starts the co-op server on `ws://localhost:8787` and the client on
`http://localhost:5173`.

- **Solo:** open the client and choose _Play solo_ or _Solo + bot ally_. This runs fully in the
  browser with no server.
- **Co-op on one machine:** open two browser windows. Choose _Create online room_ in one, then
  enter the code and click _Join_ in the other.
- **Co-op over LAN:** friends open `http://<your-ip>:5173`. The client connects to
  `ws://<your-ip>:8787` automatically. To point it elsewhere, set `VITE_SERVER_URL` (see
  `packages/client/.env.example`).

Controls: click a card, then click a target. **E** ends the turn (press again to undo). **Esc**
cancels.

## Scripts

| Command                     | Does                                                                    |
| --------------------------- | ----------------------------------------------------------------------- |
| `pnpm dev`                  | Server (watch) + client (HMR)                                           |
| `pnpm test`                 | All unit tests (Vitest)                                                 |
| `pnpm typecheck`            | TypeScript across packages                                              |
| `pnpm lint` / `pnpm format` | Biome check / auto-fix                                                  |
| `pnpm build`                | Client static build + bundled server (`packages/server/dist/server.js`) |
| `pnpm sim -- --runs 2000`   | Bot balance simulator: win rate / turns / HP lost per encounter × party |
| `pnpm check`                | Everything CI runs                                                      |

## Layout

```
packages/core     Pure deterministic rules engine (shared by client, server, tests, simulator)
packages/server   Authoritative WebSocket room server
packages/client   Phaser 4 + Vite game client (offline and online)
docs/             Design, architecture, roadmap, decision records
```
