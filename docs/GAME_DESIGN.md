# Radiance — Game Design Document

> Living document. Numbers are starting points, to be tuned with the bot simulator and playtests.
> Status: **pre-production** (milestone M0 done, see [ROADMAP.md](ROADMAP.md)).

## 1. Elevator pitch

**Radiance** is a roguelike deckbuilder for **1–4 players, online co-op**. The sun has gone out.
A party of Lightbearers carries the last Lantern **down** through the Umbral Deep, a drowned
world under the old city, to rekindle the Heartfire at its core. Each player builds their own
deck, but the party shares one pool of light. Spend it well and together you can do what no one
could do alone.

It belongs to the same genre as Slay the Spire, Monster Train and Inscryption: turn-based card
combat against enemies whose intents you can read, a branching map, and a deck that grows over a
run. Radiance is its own game with its own setting, characters, cards and systems. It must never
copy another game's names, art, cards or encounters.

## 2. Design pillars

1. **Together is stronger than the sum of its parts.** The best plays involve a teammate: shared
   Radiance, ally-targeted cards, illuminating for each other. Co-op is designed in from the start,
   not bolted on.
2. **Readable tactics.** Like the genre's best, combat is near-perfect information. Darkness is the
   one deliberate exception, and it is a puzzle to solve rather than plain randomness.
3. **Solo is first-class.** Every co-op mechanic has a meaning in solo play. A solo run is a
   complete experience, not a lesser one.
4. **Every run tells a story.** The map, events and keepsakes create memorable "remember when…"
   moments, and those moments are better shared.
5. **Respect the player's time.** Simultaneous turns mean co-op is never "wait for three people."
   A solo run takes 45–75 minutes and a co-op run about the same.

## 3. Core loop

```
 Lobby ─▶ Pick class ─▶ Stratum map ─▶ Node (fight / event / shop / hearth / elite)
                             ▲                    │
                             │                    ▼
                         Next node ◀── Rewards (cards, gold, keepsakes)
                             │
                   Boss ─▶ Next stratum ─▶ … ─▶ Heartfire (final boss) ─▶ Run end ─▶ Unlocks
```

- **Run:** 3 strata (acts) plus a finale. Each stratum is a branching map of roughly 15 rows that
  ends in a boss.
- **Death:** In co-op, a player at 0 HP is **Downed**, not dead. The run ends only when every
  player is down at the same moment.

## 4. Combat

### 4.1 Familiar foundations (genre conventions)

- 3 **Energy** per turn and a 5-card draw. The hand is discarded at end of turn, and the discard
  pile reshuffles into the draw pile when it runs out.
- **Block** absorbs damage and resets at the start of your turn.
- Enemies show **intents** (attack, defend, buff, debuff) one turn ahead.
- Statuses: **Strength** (+damage), **Weak** (−25% damage dealt), **Vulnerable** (+50% damage
  taken). Duration statuses tick down at the end of their owner's turn.

### 4.2 Radiance's signature systems

| System                | What it is                                                                                                         | Why it exists                                                                                                                                                                 |
| --------------------- | ------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Radiance** (shared) | A party-wide resource, 0–10. _Kindle_ cards add to it; _Radiant_ cards spend it on top of Energy.                  | The core co-op hook. One player charges and another spends, so "should I spend the team's light?" becomes a real conversation. In solo it works like a second, slower energy. |
| **Veil & Illuminate** | Some enemies are **Veiled**: their intents read `???`. _Illuminate_ effects reveal them for the rest of the fight. | Gives information a cost and gives scouting classes a role. In co-op one player lights the way for the others.                                                                |
| **Ally targeting**    | Cards can target a teammate: give Block, heal, grant Energy, and later hand them a card.                           | Makes support play feel active rather than passive.                                                                                                                           |
| **Downed & Rekindle** | Downed players skip turns. _Rekindle_ cards (rare) or a Hearth visit bring them back at partial HP.                | Removes the "one player died, now they watch for 40 minutes" problem.                                                                                                         |

### 4.3 Co-op turn structure: simultaneous planning

All players act **at the same time** during the player phase, in any order and interleaved. Each
player presses **End Turn** and can undo it until everyone has. When every living player is ready,
enemies act in order, then the next turn starts.

- There's no waiting for a turn order, and you can watch teammates' plays as they happen
  (teammates' hands are visible to everyone).
- The server's order of arrival is authoritative. Since the rules are deterministic, everyone sees
  the same result.
- Planned options: an optional turn timer for public groups, plus **pings and emotes** for
  coordination ("I'll take the left one", pointing at an intent).

### 4.4 Co-op scaling

- Enemy HP is multiplied by `1 + k × (players − 1)`, with **k = 0.7** for now (`ENEMY_HP_SCALE_PER_EXTRA_PLAYER`).
- Each single-target enemy attack targets one player, shown in the intent ("⚔ 12 → Bo").
- **Known issue (found by the simulator):** with the current numbers, co-op is _easier_ than solo,
  because incoming damage is spread across more players. Fixes to evaluate in M1: raise k toward
  1.0, scale enemy damage or hit count, add "each player" attacks, or add an elite modifier at 3–4
  players.
  Target: ±5% win rate across party sizes at equal skill.

## 5. Classes

There are four classes at launch, one per player slot. Two are prototyped.

| Class            | Fantasy                                | Mechanical identity                                                  | Status    |
| ---------------- | -------------------------------------- | -------------------------------------------------------------------- | --------- |
| **Warden**       | Shield-bearer, guardian of the Lantern | Block (including on allies), Taunt (later), generates Radiance       | Prototype |
| **Seeker**       | Scout with a hooded lantern            | Illuminate, Vulnerable, spends Radiance in bursts                    | Prototype |
| **Cinderwright** | Smith who works the last embers        | Burn stacks, self-damage for power, upgrades cards mid-combat        | Planned   |
| **Echo**         | Bound spirit that remembers            | Replays and copies cards, including **the last card an ally played** | Planned   |

Each class has about 75 cards at 1.0: 10 starter, ~35 common, ~20 uncommon, ~10 rare. There are
also about 40 neutral cards, some marked **co-op only**, which are offered only in parties of 2+.

## 6. Run structure

- **Map:** a layered DAG per stratum with node types Fight, Elite, Event, Shop, Hearth (rest),
  Treasure and Boss. The party **votes** on the next node, and ties are broken by the seeded RNG.
  Splitting the party is a stretch goal.
- **Rewards:** each player gets **their own** card reward (pick 1 of 3 or skip) and gold. Gold can
  be gifted to an ally at shops. Boss keepsakes are picked one by one in rotating order.
- **Keepsakes:** passive run-long items (the genre's "relics"), about 120 at 1.0. They're built on
  trigger hooks (on turn start, on card played, on kindle…) so they stay data-driven.
- **Hearth (rest):** heal 30%, or upgrade a card, or revive a Downed ally.
- **Events:** text scenarios with choices. Some are **co-op events** where the party chooses
  together, or where one player's sacrifice benefits another.

## 7. Progression and replayability

- **Unlocks:** new cards, keepsakes and classes are unlocked by playing. Only content is unlocked,
  never power.
- **Dimming levels:** a 15-level difficulty ladder unlocked by winning. Each level adds one
  modifier, and in co-op the lowest level any player has unlocked applies.
- **Seeds:** every run is reproducible from its seed. Seeded and daily runs are cheap because the
  engine is deterministic.

## 8. Online and social

- **Modes:** solo offline, co-op online (2–4) via a **room code**, and later Steam friend invites.
- **Joining:** before the run starts. Mid-run, a disconnected player's character waits (bot
  takeover is optional) and they can rejoin at any point with their reconnect token.
- **Out of scope for 1.0:** matchmaking with strangers, PvP and couch co-op.

## 9. Art and audio direction (to be explored in M4)

- **Look:** painterly 2D. Deep indigo darkness against warm gold light, and light itself is the
  UI's accent color (the Radiance meter, illuminated enemies, playable-card glow).
- **Readability first:** intents, numbers and statuses must be readable at 720p and on a Steam
  Deck.
- **Audio:** low, echoing ambience in the Deep, with warm tonal "kindle" sounds that build into a
  chord as the party's Radiance fills.

## 10. Content targets

|                        | Prototype (M0, now) | Vertical slice (M4) | Early Access (M5) | 1.0        |
| ---------------------- | ------------------- | ------------------- | ----------------- | ---------- |
| Classes                | 2                   | 2                   | 3–4               | 4          |
| Cards                  | 7                   | ~70                 | ~200              | ~340       |
| Enemies (incl. elites) | 3                   | ~15                 | ~35               | ~50        |
| Bosses                 | 0                   | 1                   | 4                 | 7          |
| Keepsakes              | 0                   | ~25                 | ~80               | ~120       |
| Events                 | 0                   | ~10                 | ~30               | ~50        |
| Strata                 | combat only         | 1                   | 2–3               | 3 + finale |
