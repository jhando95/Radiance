# Radiance — Roadmap

Each milestone has an **exit test**. Estimates are rough sizing for a small team working with AI
assistance.

## ✅ M0 — Foundation
Monorepo, deterministic core, authoritative server, CI. (The original card prototype was replaced in
M1.)

## ✅ M1 — Playable prototype (current)
- [x] **Ranked ability combat:** ranks, initiative, 30 merc skills with cooldowns, 17 statuses,
  guard/taunt, crits, elements and resistances
- [x] **Light system:** lamp charge, light radius, lit/unlit, umbral enemies, flares/beacons, loot
  bonus in the dark
- [x] **Builds:** 5 disciplines, 8 origins, ~55 perks, 18 item bases, 24 affixes, 5 rarities, relics
  with unique perks
- [x] **Expedition:** 9-row map across 3 biomes, 7 node types, rewards, XP/levels, camp, refuel
- [x] 11 enemies, including an elite and the Lumen Eater boss
- [x] **Co-op:** lobby with room codes, squad split by player count, per-merc ownership, route voting,
  shared stash, reconnect
- [x] **Client:** title, settings, how-to-play, credits, squad builder (full appearance
  customization), expedition map, combat with lighting and animations, character sheet/inventory,
  rewards, summary, pause
- [x] Procedural pixel art (mercs, enemies, icons, backdrops, UI) and synthesized audio
- [x] Solo save/resume (seed + command log)
- [x] Bot simulator for whole expeditions (`pnpm sim`), plus tests including exact replay of a full
  expedition

**Exit test:** a stranger can start a solo expedition, customize four mercs, fight through to the
boss, equip loot and pick perks. Two friends can do the same online with a room code.

## M2 — Feel & balance (~3–4 weeks)
- [ ] Balance pass with the simulator: target 55–65% bot win rate for a balanced squad, and no
  discipline below 40%
- [ ] Skill VFX per skill (projectiles, slashes, light bursts), hit-stop, camera punch; boss intro
- [ ] Better bot allies (fill in for absent co-op players), turn timer option
- [ ] Tooltips everywhere (statuses in the combat log, an enemy intel panel)
- [ ] Combat log panel and a speed-up toggle for enemy turns
- [ ] Playwright E2E in CI (solo run to first fight; co-op lobby → departure)

## M3 — Depth (~4–6 weeks)
- [ ] **Events** with choices (data-driven), including co-op dilemmas
- [ ] **Mercenary company** meta-layer: roster persists between expeditions (server accounts or local
  profiles), recruit market, base upgrades, injuries and quirks
- [ ] Crafting: refine ore, reroll affixes, upgrade rarity
- [ ] 2 new disciplines, 2 new biomes / a second moon, 10 new enemies, 2 bosses
- [ ] Trinket set bonuses, more relics

## M4 — Online polish & public playtest (~3 weeks)
- [ ] Deploy: static client (Cloudflare Pages / itch.io) and server (Fly.io) over `wss://`
- [ ] Server persistence for runs (seed + log in SQLite), resume after server restart
- [ ] Emotes and pings, spectating, "kick idle player → bot"
- [ ] Opt-in telemetry for balance; one-click bug report (seed + log)

## M5 — Vertical slice & Steam (~2–3 months)
- [ ] Art pass: hand-tuned key sprites on top of the procedural base, portraits, boss animation
- [ ] Desktop build (Electron + steamworks.js): friend invites, achievements, cloud saves
- [ ] Store page, trailer, Steam Deck verification, localization pipeline

## Risks

| Risk | Mitigation |
|---|---|
| Build combinatorics break balance | Simulator, per-discipline win-rate targets, perk pools per discipline |
| Co-op downtime (waiting for others' turns) | Fast enemy turns, animation speed setting, turn timer, bot fill-in |
| Procedural art ceiling | Strong palette and lighting now; hand-authored overrides later through the same API |
| Looking like a Darkest Dungeon clone | Light/ore/relic economy, sci-fi frontier setting, co-op ownership, loot affixes, no stress system |
