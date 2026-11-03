# Radiance — Game Design Document

> Living document. Numbers are starting points, tuned with the bot simulator (`pnpm sim`) and
> playtests. Status: **playable prototype** (see [ROADMAP.md](ROADMAP.md)).

## 1. Pitch

**Radiance** is a **co-op tactical RPG roguelite for 1–4 players**. You lead a squad of four
mercenaries dropped onto dark moons and sunless worlds to scavenge **old-world relics and rare
minerals**. Down there, light is the most precious resource you carry: your lamp decides how much of
the dark you can see, how hard the things living in it hit, and how rich the haul will be.

- **Combat:** side-view, ranked and turn-based, in the style of Darkest Dungeon: four positions per
  side, an initiative order, and skills that only work from (and against) certain ranks. It is
  **ability based**: skills with **cooldowns**, passives, items and equipment. There are no cards.
- **Builds:** the main pillar. Discipline × origin × level-up perks × randomized loot (rarities and
  affixes, relics with unique perks) × skill loadout × appearance.
- **Co-op:** the squad is always four mercs. With friends, each player owns and controls their own
  mercs (2+2, 2+1+1 or 1+1+1+1). You vote on the route, share the stash and the lamp, and win or lose
  together.

## 2. Pillars

1. **Light is life.** Every system touches light: lamp charge, light radius, lit and unlit enemies,
   umbral monsters, flares and beacons, and the loot bonus for pushing on in the dark.
2. **Your mercenary, your build.** Two mercs of the same discipline should end a run playing
   differently.
3. **Readable tactics.** Ranks, turn order, cooldowns and statuses are always visible. Darkness is the
   only deliberate fog, and you can always fight it.
4. **Better together.** Guard and heal another player's merc, light targets for them, pass loot
   around. Solo works too: one player commands all four.
5. **Short, replayable expeditions.** An expedition is about 30–45 minutes with fresh maps, loot and
   perk offers every time.

## 3. Core loop

```
Title ─▶ (Co-op lobby) ─▶ Squad builder ─▶ Expedition map ─┬─▶ Combat ─▶ Rewards ─┐
                                              ▲            ├─▶ Cache / Vein / Camp / Derelict
                                              └────────────┴────────────────────────┘
                     … 7 stops through 3 biomes ─▶ Boss: The Lumen Eater ─▶ Summary
```

**Expedition map:** 9 rows, descending from the **Ashen Surface** through the **Dusk Mines** into the
**Crystal Hollows**. Node types:

| Node | What happens |
|---|---|
| Hostiles | A fight. XP, ore, often loot. |
| Elite | A hard fight. Guaranteed rare-or-better loot. |
| Supply cache | Two items and some ore. |
| Mineral vein | Lots of ore, but costs extra lamp charge. |
| Camp | Everyone heals 40%, downed mercs get up, +20 lamp. |
| Derelict | Gamble: treasure, a trap, or an ambush. |
| Boss | The Lumen Eater and its tendrils. |

Each stop drains **7 lamp charge**.

## 4. Combat

- **Ranks 1–4** per side. Rank 1 is the front. Each skill lists the ranks it can be used **from** and
  the ranks it can **target**. Dead enemies are removed and the rest shuffle forward. Downed mercs
  keep their place.
- **Initiative:** each round, every living unit acts once, ordered by `speed + d4`. Haste and slow
  modify speed.
- **Skills:** each merc equips **4 of their discipline's 6 skills**, plus *Reposition* (swap with an
  adjacent ally) and *Hold*. Skills have **cooldowns** measured in that merc's turns.
- **Hit and crit:** `hit = accuracy + skill modifier − dodge − blind − darkness penalty`, clamped to
  5–97%. Crits multiply by `1 + crit damage` (base +50%).
- **Damage:** `weapon roll × skill multiplier × (1 + damage% + element% + empower − weaken + mark + conditional perks)`.
  Physical damage is reduced by **protection** (minus corrode). Radiant, void, fire and toxic damage
  are reduced by resistances, which can be negative (weaknesses).
- **Statuses:** bleed, burn and poison (damage over time, with stacks), stun, mark, guard, shield,
  blind, corrode, haste, slow, regen, empower, weaken, taunt, evasive and lit. Debuffs roll against
  the target's resistances.
- **Downed:** a merc at 0 HP is downed. A Lamplighter's *Kindle Wounds* can **rekindle** them
  mid-fight. After a won fight they get back up at 1 HP. If every merc is down, the expedition ends.

### 4.1 Light (the signature system)

- The squad's **light radius** comes from its brightest lamp (Oil 2, Arc 3, Shroud 1) plus perks and
  affixes, minus the **lamp-charge penalty** (−1 below 50%, −2 below 25%), plus temporary Beacons.
- Enemies in ranks ≤ radius are **lit**. Flares and radiant skills also light individual enemies
  (the *Lit* status).
- **Unlit enemies:** you have −15 accuracy against them and can't crit, and their health is hidden.
  *Darkvision* (Void-Born, Dark-Adapted, Shadowborn) ignores the penalty.
- **Umbral enemies** (wisps, stalkers, crawlers and the boss) deal +20% damage while unlit, get +10
  dodge in the dark, and are weak to radiant damage.
- **Risk and reward:** loot rarity rises as the lamp dims (+10 / +25 / +45%).
- Enemies fight back against your light: *Lamp Smash*, *Engulf the Light* and *Devour Light* drain
  charge or shrink the radius.

## 5. Builds

| Layer | Options (prototype) | Notes |
|---|---|---|
| **Discipline** | Vanguard, Gunner, Lamplighter, Reaver, Hexer | Base stats, growth, 6 skills, weapon family |
| **Origin** | Ex-Miner, Void-Born, Corp Deserter, Ice Hauler, Sun Penitent, Gutter Medic, Rail-War Veteran, Scrap Prophet | Stat package and identity |
| **Perks** | ~55 (24 general, 6 per discipline, 7 relic) | Pick 1 of 3 on each level-up (max level 10). Stat, skill-modifying, triggered and conditional perks |
| **Equipment** | Weapon, Armor, Lamp, 2 Trinkets | Common → Uncommon → Rare → Epic → **Relic** |
| **Affixes** | 24 prefixes/suffixes | 0–3 per item by rarity, values scale with item level |
| **Relics** | Named items with a unique perk | e.g. *Eclipse Shard*: +35% damage to unlit targets |
| **Skill loadout** | 4 of 6 | Swappable between fights |
| **Appearance** | Body, skin, hair, hair color, primary/secondary colors, headgear, markings | Sprites also reflect armor weight, lamp type and weapon rarity |

Example builds the systems already support:
- **Night Stalker Reaver:** Void-Born, Shadowborn, Eclipse, Shroud Lamp. Fights in the dark,
  bleeds, executes.
- **Lighthouse Lamplighter:** Scrap Prophet, Lightbringer, Lamp Warden, Arc Lamp with *of the Beacon*.
  Lights all four ranks.
- **Plague Hexer:** Plaguebringer, Festering, Rot Curse + Hex of Frailty. Stacks damage over time on
  marked targets.
- **Bulwark Vanguard:** Unbreakable, Warden's Oath, Reactive Plating. Guards the squad's healer.

## 6. Co-op

- **Lobby:** a room code, up to 4 players. The host departs when every player has built their mercs.
- **Ownership:** each merc belongs to one player. When it's that merc's turn, only its owner can act
  (others see "Waiting for…").
- **Route voting:** everyone votes and the majority wins. Ties are broken by the seeded RNG.
- **Shared:** stash, ore and lamp. Anyone can equip stash items on *their own* mercs.
- **Rewards:** everyone presses Continue.
- **Reconnects:** a dropped player rejoins with their token and gets the current state.

## 7. Enemies (prototype roster)

| Enemy | Biome | Role |
|---|---|---|
| Scav Cutter / Scav Gunner | Surface | Rival mercs: bleed, blind, snipe |
| Gloam Crawler | Surface / Mines | Fast umbral biter, bleeds, focuses the weak |
| Husk Miner | Mines | Reanimated miner; *Lamp Smash* drains the lamp |
| Mycelid Tender | Mines / Hollows | Healer, poison clouds |
| Void Wisp | Mines / Hollows | Umbral caster, shrinks your light |
| Shardback | Hollows | Armored crystal tank, guards allies |
| Umbral Stalker | Hollows | High-dodge assassin, deadly in the dark |
| Husk Foreman | Elite | Drill stun, area attacks, empowers allies |
| **The Lumen Eater** | Boss | Devours light, marks and weakens, flanked by Maw Tendrils |

## 8. Art and audio

- **Procedural pixel art:** every sprite, icon, backdrop and UI frame is drawn in code from one
  curated palette (`client/src/art/palette.ts`). Cold indigo dark against warm amber lamp light, with
  element accents. Characters are composed from layers so customization and gear show up on the
  sprite.
- **Lighting:** a darkness overlay with light pools around the squad and lit enemy ranks, so you can
  literally see your light radius.
- **Audio:** fully synthesized SFX and generative music per mood (title, map, combat, elite, boss,
  camp). Darkness makes the soundtrack more ominous.

## 9. Future content (see roadmap)

More disciplines (Rigger with drones, Warden of Chains), more biomes and moons, events with
choices, a persistent **mercenary company** (roster between expeditions, base upgrades, recruit
market), injuries and quirks, item crafting and refining ore, daily seeded expeditions, and Steam
release with friend invites.
