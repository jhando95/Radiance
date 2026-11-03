# CLAUDE.md — working on Radiance

Radiance is a co-op (1–4 players) roguelike deckbuilder. It's a TypeScript monorepo:
`packages/core` (rules), `packages/server` (authoritative ws rooms), `packages/client` (Phaser 4 + Vite).
Read `docs/ARCHITECTURE.md` before structural changes and `docs/GAME_DESIGN.md` before content changes.

## Commands

- `pnpm install`: set up
- `pnpm check`: lint + typecheck + test + build. **Run before every push.**
- `pnpm test`, `pnpm typecheck`, `pnpm lint`, `pnpm format`
- `pnpm sim -- --runs 1000`: bot balance simulator; run after any card, enemy or number change
- `pnpm dev`: server on :8787 + client on :5173

## Hard rules

1. **Game rules live only in `packages/core`.** The client renders `CombatView`s and sends
   `Command`s through `GameSession`. The server validates and relays. Never duplicate a rule in
   client or server code.
2. **Core is pure and deterministic.** It has no DOM, Node APIs, I/O, `Math.random()`, `Date`, or
   timers. Randomness comes only from `stream(state, "<name>")`. Add a new named stream rather than
   reusing one for an unrelated purpose.
3. **State is plain JSON.** It has no classes, Maps, Sets, functions or `undefined`-dependent
   logic. `applyCommand` must not mutate its input.
4. **Content is data.** Cards and enemies are built from effect kinds. For new behavior, add an
   effect kind in `combat/effects.ts` (plus `describeEffect` text and tests). Don't special-case
   card ids.
5. **Never send raw `CombatState` to a client.** Always use `viewFor`. RNG state and draw order
   are secret.
6. **Validate every client message** with the zod schemas in `core/src/protocol.ts`. Bump
   `PROTOCOL_VERSION` on breaking wire changes.
7. **Untrusted strings** (player names) go into the DOM only as text nodes (`ui/dom.ts` `el()`),
   never `innerHTML`.
8. Keep the game original. The genre conventions are fine, but don't copy names, cards, enemies,
   art or text from other games.

## Testing expectations

- Every new effect, status or rule gets a unit test in `packages/core`.
- The determinism tests (`replay` equality, reproducible bot games) must keep passing.
- Server behavior is tested through `RoomManager` with fake peers (`rooms.test.ts`).
- If you change balance numbers, include before/after `pnpm sim` output in the PR description.

## Conventions

- Imports have no file extensions (bundler resolution). Workspace packages export TS source.
- Biome formats with 2 spaces and 100 columns. Let `pnpm format` decide formatting.
- Tests sit next to code as `*.test.ts`.
