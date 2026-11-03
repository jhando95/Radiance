# ADR 0002 — Networking: authoritative server, state snapshots, owned units

- **Status:** Accepted (2026-11-03)

## Context

Co-op for 1–4 players, turn-based, with hidden information (draw order, veiled intents, and RNG
state that predicts both). Players are friends joining by room code. There's no competitive
ranking, but we still don't want a modified client to be able to cheat in a friend's game, and we
want rejoining to be painless.

## Options considered

| Model                                          | How it works                                                                          | Verdict                                                                                                                                                                                                                  |
| ---------------------------------------------- | ------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Deterministic lockstep**                     | Every client runs the sim; only commands are exchanged.                               | ❌ Every client must hold the full state _including RNG_, so hidden information leaks. Desyncs are hard to debug, and late joins or reconnects need a full replay.                                                       |
| **Host-authoritative P2P**                     | One player's client is the server.                                                    | ⚠️ No server costs, and it's how many Steam co-op games work. But if the host leaves the room ends, NAT traversal is needed, and the host can cheat. **Keep as a future mode** (Steam relay) using the same RoomManager. |
| **Dedicated authoritative server + snapshots** | Clients send commands; the server applies them and sends each player a redacted view. | ✅ **Chosen.** Simple, cheat-resistant, hides information, and reconnecting means "send the current view". The bandwidth is trivial for a turn-based game.                                                               |
| Managed backend (Colyseus, Nakama, Photon)     | Framework rooms and state sync.                                                       | ⏸ Not needed yet. Our room logic is small. Revisit for matchmaking, accounts or scale.                                                                                                                                   |

## Decision

1. **Authoritative Node server.** It is the only place online state changes, via
   `@radiance/core`'s `applyCommand`.
2. **Full redacted snapshots** (`viewFor`) plus an event list after each accepted command. The
   state carries a `version` counter for future delta or ack schemes.
3. **Initiative turns with unit ownership** (revised 2026-11-03 for ranked ability combat). Every
   merc is owned by one player. The engine pauses whenever a merc must act and accepts `useSkill`
   only from its owner. Enemy turns resolve on the server as part of the previous command, so
   there is no idle network chatter. Route choices use votes, and rewards use everyone pressing
   Continue.
4. **Command log + seed** is kept per room. It is the replay and save format, and the basis for
   server-restart recovery.
5. **The server validates everything:** a zod schema at the boundary, then rule validation in
   core. Clients are never trusted.

## Consequences

- No client-side prediction. Actions take one round trip to show up (around 50–150 ms), which is
  fine for a card game. If it ever feels sluggish, the client can _optimistically_ apply a command
  locally with core and reconcile on the next snapshot. This is safe because core is deterministic
  for the information the client has.
- Server costs exist but are small: one small instance handles thousands of rooms.
- Host-migration is not needed with dedicated servers. With a future P2P host mode it would be.
