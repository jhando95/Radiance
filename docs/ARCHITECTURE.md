# Radiance — Technical Architecture

Related decisions: [ADR 0001 (tech stack)](adr/0001-tech-stack.md),
[ADR 0002 (networking model)](adr/0002-networking-model.md).

## 1. Overview

```
┌──────────────────────── packages/client (browser / desktop) ───────────────────────────┐
│ Phaser scenes ──input──▶ GameSession.command(RunCommand)                               │
│      ▲                     │                                                           │
│      └── RunView + events ─┤ OfflineSession: runs @radiance/core locally (solo, saves) │
│                            └ OnlineSession:  JSON over WebSocket ──────────┐           │
│ art/  procedural pixel art   audio/  synthesized SFX + generative music    │           │
└────────────────────────────────────────────────────────────────────────────┼───────────┘
┌───────────────────────── packages/server (Node) ───────────────────────────▼───────────┐
│ ws ─▶ parseClientMessage (zod) ─▶ RoomManager ─▶ applyRunCommand (core)                │
│                                         └─▶ viewFor(run, player) per member            │
└────────────────────────────────────────────────────────────────────────────────────────┘
┌──────────────────────── packages/core (pure TypeScript) ───────────────────────────────┐
│ content/  skills · disciplines/origins · perks · items/affixes · enemies/encounters    │
│ merc.ts   stats, leveling, loot       combat/  ranks, initiative, skills, AI, light    │
│ run/      map, expedition state machine, client views    protocol.ts   sim/  bots      │
│ NO DOM · NO Node APIs · NO I/O · NO Math.random · NO Date                              │
└────────────────────────────────────────────────────────────────────────────────────────┘
```

**The single most important rule: game rules live only in `@radiance/core`.** The client renders
views and sends intent. The server validates and relays. Offline play, online play, tests, the
simulator and replays all run the same code.

## 2. Core engine

### 2.1 State, commands, events

- **`RunState`** is the whole expedition: players, mercs (formation order), map, current node,
  votes, lamp charge, ore, stash, the current `CombatState` (if any), reward, and RNG streams. It is
  plain JSON.
- **`RunCommand`** is a player's intent: `vote`, `useSkill`, `continue`, `equip`, `unequip`,
  `setSkills`, `choosePerk`, `swap`, `refuel`.
- **`applyRunCommand(run, playerId, cmd) → { ok, state, events } | { ok: false, error }`** is the
  only way state changes. It clones the state and never mutates its input.
- **Events** (`hit`, `miss`, `status`, `tick`, `move`, `died`, `lamp`, `levelUp`, `loot`, …) describe
  what happened, in order. The client animates them, then renders the new view.

### 2.2 Combat flow (`combat/flow.ts`)

`advance()` runs the turn loop. It builds a round's initiative queue (speed + d4), pops units, and
applies start-of-turn effects (DoTs, regen, perk triggers, stun). **Enemy turns resolve immediately**
via the AI. The loop **stops when a merc must act**, which waits for its owner's `useSkill`. After a
skill resolves, `advance()` continues. This keeps the server stateless between commands and makes
every enemy action part of the event stream of the command that led to it.

`skillBlocker()` and `validTargets()` are shared: the UI uses them to grey out skills and highlight
targets, and the engine uses them to reject illegal commands.

### 2.3 Determinism rules

1. **No `Math.random()`.** Use `stream(run, name)`, a seeded sfc32 generator stored in the state.
2. **One stream per purpose** (`map`, `loot`, `combat`, `ai`, `nodes`, `vote`, `perks:<mercId>`),
   so changing one system doesn't reshuffle every other system's rolls.
3. **No wall-clock time or `Date`** in rules. Use integer math (round after multipliers).
4. **Save format = seed + squad setups + command log.** `replayRun()` must reproduce a full
   expedition exactly. A test plays a whole bot expedition and checks this.

### 2.4 Content as data

Skills, perks, items, affixes, enemies and encounters are typed data built from small vocabularies:
**skill effects** (`damage`, `heal`, `status`, `move`, `cleanse`, `beacon`, `lampCharge`, `cooldowns`,
`guard`), **perk mods** (flat stats), **skill mods** (per-skill cooldown, damage, extra effects),
**triggers** (`kill`, `crit`, `hit`, `turnStart`) and **conditions** (vs unlit, vs marked, low HP, …).
Tooltips are generated from the same data (`describe.ts`), so text can't drift from behavior. New
mechanics go in as new effect kinds, never as `if (skill.id === …)`.

### 2.5 Hidden information

`viewFor(run, viewer)` strips RNG state and **masks unlit enemies' HP and cooldowns** (darkness is a
gameplay mechanic, so the client must not even receive that data). The server only ever sends
views.

## 3. Networking

See [ADR 0002](adr/0002-networking-model.md). In short: an authoritative Node server, the zod-validated
JSON protocol (`PROTOCOL_VERSION` 2), room codes, reconnect tokens and redacted snapshots after every
accepted command. The **lobby** collects each player's mercenaries (the squad is always 4, split by
`slotsForPlayers`). The run then starts with every merc owned by its creator. Only a merc's owner
can command it.

## 4. Client

- **Scenes:** Boot → Title → (Lobby) → Squad builder → Expedition ⇄ Combat → Summary, plus overlay
  scenes (Character sheet, Pause, Settings, How to Play, Credits, toasts). Gameplay scenes are
  registered in `scenes/gameplay.ts`, which also implements the title-menu flow.
- **`GameSession`** (`net/`) hides offline vs online. Solo runs save to localStorage as seed + log
  and can be resumed.
- **Combat rendering** keeps a sprite per unit, plays the event queue as tweens (lunges, projectiles,
  hit flashes, floating numbers, deaths), then syncs to the authoritative view. A 320×180 darkness
  canvas, scaled ×4, cuts light pools around the squad and lit enemies.
- **Art** (`art/`): procedural pixel art from one palette. Mercs are composed from appearance and
  equipment (`art/look.ts` maps game data to looks). Every texture is generated once and cached by
  key. Dev galleries: `/gallery-characters.html`, `/gallery-env.html`, `/squad-lab.html`,
  `/character-lab.html`, `/audio-lab.html`.
- **Audio** (`audio/`): Web Audio synthesis. SFX recipes, plus a lookahead scheduler for generative
  music per mood. Darkness closes filters and swells drones.

## 5. Tooling

| Concern       | Tool                                                                        |
| ------------- | --------------------------------------------------------------------------- |
| Monorepo      | pnpm workspaces (`packages/*`)                                              |
| Language      | TypeScript 7 (strict, `noUncheckedIndexedAccess`)                           |
| Client        | Phaser 4 + Vite                                                             |
| Server        | Node + `ws`, `tsx` in dev, esbuild bundle for prod                          |
| Tests         | Vitest (core rules, full bot expeditions, replay, protocol, rooms)          |
| Lint / format | Biome                                                                       |
| Balance       | `pnpm sim -- --runs 200`: bots play whole expeditions per squad composition |
| CI            | GitHub Actions: lint → typecheck → test → build → sim smoke test            |

## 6. Directory map

```
packages/core/src
  content/      skills, disciplines+origins, perks, items+affixes, enemies+encounters
  combat/       ctx (helpers, streams), light, skills (targeting & resolution), ai, flow
  run/          map generation, run state machine, view redaction
  merc.ts       stats, leveling & perk offers, loot generation
  describe.ts   tooltip text from data
  protocol.ts   wire schemas
  sim/          bots, presets, expedition simulator
packages/server/src  rooms.ts (RoomManager), main.ts (ws/http)
packages/client/src
  app/          settings, scene registry, flow hooks, transitions, texture cache
  ui/           widgets (Button, Panel, Tooltip, Modal, Toast, TextInput, Slider…), theme
  art/          palette, pixel toolkit, mercs, enemies, icons, backgrounds, ui kit, look mapping
  audio/        synthesized SFX & music
  net/          GameSession, OfflineSession, OnlineSession
  game/         globals, unit art adapter
  scenes/       Boot, Title, Settings, HowToPlay, Credits, Pause, Squad, Lobby, Expedition,
                Battle (combat), Character, Summary
```
