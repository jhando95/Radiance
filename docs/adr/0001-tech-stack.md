# ADR 0001 — Tech stack: TypeScript + Phaser + Node, with a pure rules core

- **Status:** Accepted (2026-11-03)
- **Context owner:** project lead

## Context

We're building a 2D turn-based roguelike deckbuilder with 1–4 player online co-op. The main needs:

- **Shared rules between client and server.** Online play needs an authority that runs the same
  rules as the client's offline mode.
- **Determinism and testability.** Seeds, replays, save files and balance simulation all depend
  on the rules being a pure, headless function.
- **Fast iteration** for a small team (possibly one person) working with AI coding assistants.
- **Shipping targets:** browser builds for easy playtesting with friends via a link, then
  desktop/Steam. Consoles are not a launch goal.
- The visuals are 2D cards, panels, sprites, tweens and particles. There's no 3D or physics.

## Options considered

### A. Godot 4 (C# or GDScript)

- ✅ Excellent free editor and a strong 2D toolchain. It ships to desktop and consoles (consoles
  through third parties), and Steam integration via GodotSteam is mature.
- ✅ It's a proven fit for this exact genre: Mega Crit moved _Slay the Spire 2_ to Godot (C#)
  after the 2023 Unity runtime-fee controversy, and it hit record concurrent players for the
  engine at launch.
- ⚠️ A dedicated authoritative server means running headless Godot or reimplementing the rules.
  Sharing code between game and server is possible in C# but takes more setup.
- ⚠️ Iteration with headless tests and CI is workable but heavier than plain TS or Node.

### B. Unity

- ✅ Mature ecosystem and netcode options.
- ❌ Licensing and pricing history is a risk, the editor is heavy, and it's a poor fit for fast
  headless iteration in CI.

### C. TypeScript everywhere: Phaser client, Node server, shared pure-TS core ✅ **chosen**

- ✅ **One language and one rules implementation** for client, server, tests, simulator and
  tooling. The server literally imports the same `applyCommand`.
- ✅ **Instant distribution for playtests:** send a URL. No installs, which matters a lot for
  co-op playtests.
- ✅ The fastest test and CI loop. The core engine's tests run in under a second.
- ✅ It's a proven commercial path: web-tech games (Phaser and others) ship on Steam via Electron.
  _Vampire Survivors_ is the best-known example; it shipped on Phaser + Electron before its later
  engine port.
- ⚠️ Console ports would need a rewrite or a wrapper. This is accepted because consoles aren't a
  launch goal.
- ⚠️ Fewer built-in editor tools (no scene editor). Card and UI layouts are code-driven, which
  works for this genre. Layout tooling can be added later if needed.

## Decision

Use **TypeScript** throughout:

- `@radiance/core`: a pure, deterministic rules engine with no DOM or Node dependencies.
- `@radiance/server`: Node + `ws`, authoritative rooms.
- `@radiance/client`: **Phaser 4** + Vite, with DOM for menus.
- Tooling: pnpm workspaces, Vitest, Biome, esbuild, GitHub Actions.

## Consequences

- Rules must stay engine-agnostic. If we ever move to Godot (for example, for consoles), the
  core's tests and docs become the spec for a C# port, and data-driven content ports
  mechanically.
- We own the network layer, which is about 300 lines today. That's acceptable for a turn-based
  game. Revisit Colyseus or Nakama if we need matchmaking, persistence or horizontal scale.
- Desktop builds go through Electron + steamworks.js (to be evaluated in M5).

## Revisit if…

- Console release becomes a priority before 1.0, or
- the art direction needs effects beyond what WebGL and Phaser can do comfortably, or
- the browser build stops being useful for playtesting.
