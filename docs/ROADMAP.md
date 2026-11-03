# Radiance — Roadmap

Each milestone has a clear **exit test**. Estimates assume one developer working part-time with AI
assistance. Treat them as rough sizing, not deadlines.

## ✅ M0 — Foundation (done)

Goal: prove the architecture end to end before building content.

- [x] pnpm monorepo: `core`, `server`, `client`; TypeScript strict, Biome, Vitest, CI
- [x] Deterministic RNG with named streams; seed + command log replay
- [x] Combat rules: energy, draw, block, statuses, intents, shared **Radiance**, **Veil/Illuminate**, ally targeting, downed players, victory/defeat
- [x] 2 classes (Warden, Seeker), 7 cards, 3 enemies, 3 encounters
- [x] Authoritative WebSocket server: room codes, 4-player cap, reconnect tokens, rate limits, health check
- [x] Phaser client: lobby, combat scene, click-to-target, end turn / undo; offline mode with bot allies
- [x] Bot simulator (`pnpm sim`), which already found a co-op scaling issue (see GDD §4.4)

**Exit test (met):** two browsers join a room by code, play cards, end turns together, survive a
page reload, and a solo player can play offline with a bot ally.

## M1 — Combat that feels good (~3–5 weeks)

- [ ] **Animation queue** driven by `CombatEvent`s (card fly-to-target, hit flashes, intent reveal, Radiance pip fill); input locked while it plays
- [ ] Card interactions: hover zoom, drag-to-target with an arrow, keyboard shortcuts (1–9, E, Esc)
- [ ] **Powers** and **trigger hooks** (`onTurnStart`, `onCardPlayed`, `onDamageTaken`…), the base for keepsakes
- [ ] More effects: exhaust, retain, discard, card generation, X-cost, multi-hit, Burn, Taunt
- [ ] ~30 cards per prototype class plus ~10 neutral/co-op cards
- [ ] 8 normal enemies, 2 elites, 1 boss with phases
- [ ] Fix the co-op difficulty curve (target: win rate within ±5% across party sizes in `pnpm sim`)
- [ ] Playwright E2E co-op test in CI
- [ ] Pings: click an enemy or intent to highlight it for teammates

**Exit test:** a 2-player online combat against the boss is tense, readable and feels juicy;
the sim shows balanced party sizes.

## M2 — The run (~4–6 weeks)

- [ ] `RunState` + run state machine: map → node → rewards → map (combat becomes a sub-state)
- [ ] Map generator (layered DAG, seeded) + **party voting**
- [ ] Per-player card rewards, gold, card upgrades
- [ ] Hearth (heal / upgrade / revive), Shop (buy, remove, gift gold), Treasure
- [ ] Keepsakes (hook-based, ~25)
- [ ] Data-driven events (~10), including 2–3 co-op events
- [ ] Save and resume: persist seed + log; server rebuilds rooms after restart (SQLite)
- [ ] Bot takeover for a disconnected player (optional per room)

**Exit test:** a full stratum (15 nodes + boss) is playable solo and in co-op, and can be resumed
after a server restart.

## M3 — Online polish & first public build (~3–4 weeks)

- [ ] Deploy: client to static hosting, server to Fly.io/Render with `wss://`
- [ ] Emotes, a ready-state UI, "waiting on X" indicators, optional turn timer
- [ ] Spectating downed players' teammates' hands; better reconnection UX
- [ ] Desync and bug reports: one click exports seed + log + version
- [ ] Basic, opt-in telemetry: run outcomes, card pick rates (for balance)
- [ ] Settings: volume, animation speed, colorblind-safe intent colors, UI scale

**Exit test:** friends can play a full stratum over the internet with only a link.

## M4 — Vertical slice (~6–8 weeks)

- [ ] Art direction pass: card frame, enemy art for Stratum 1, backgrounds, VFX for light and dark
- [ ] Audio: music for the map, combat and boss; SFX set; adaptive Radiance chord
- [ ] Title screen, class select, run summary, unlock screen
- [ ] Closed playtest (10–20 people) → iterate

**Exit test:** a stranger can watch a 2-minute clip and understand what is special about
Radiance (shared light, illuminating the dark).

## M5 — Early Access (~4–6 months)

- [ ] Classes 3 & 4 (Cinderwright, Echo); 2–3 strata; ~200 cards; Dimming levels 1–10
- [ ] Meta-progression and unlocks
- [ ] Desktop build: Electron + steamworks.js (achievements, cloud saves, friend invites, overlay)
- [ ] Steam store page, trailer, wishlists; Steam Deck verification
- [ ] Localization pipeline (string tables; card text is already generated from data)

## M6 — 1.0

- [ ] Full content targets (GDD §10), final act and finale, Dimming 15, daily seeded runs
- [ ] Optional: Steam P2P host mode (runs `RoomManager` in the host client) to cut server costs
- [ ] Optional: mod support (content is data; expose a loader)

## Risks and mitigations

| Risk                                  | Mitigation                                                                                                                                       |
| ------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| Co-op balance becomes unmanageable    | Simulator from day 1; target ±5% win rate by party size; co-op-only cards and scaling knobs                                                      |
| Scope creep (genre is content-hungry) | Content targets per milestone; data-driven effects make each card cheap; vertical slice before breadth                                           |
| Networking bugs and desyncs           | Single authority; deterministic replay; seed + log in every bug report                                                                           |
| Looking like a clone                  | Signature systems (shared Radiance, Veil/Illuminate, downed/rekindle), original setting and art direction; never copy names, cards or encounters |
| Web tech limits on desktop or Steam   | Proven Electron path; keep core engine-agnostic so a port stays possible (ADR 0001)                                                              |
