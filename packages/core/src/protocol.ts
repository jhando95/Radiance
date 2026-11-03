/**
 * Wire protocol shared by client and server. Every client message is untrusted and MUST be
 * parsed with `parseClientMessage` before use.
 */
import { z } from "zod";
import { APPEARANCE_OPTIONS, DISCIPLINE_IDS, ORIGIN_IDS } from "./content";
import type { RunView } from "./run/view";
import type { PlayerId, RunEvent } from "./types";
import { EQUIP_SLOTS } from "./types";

export const PROTOCOL_VERSION = 2;

const name = z.string().trim().min(1).max(24);
const id = z.string().min(1).max(32);
const roomCode = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^[A-Z0-9]{4,8}$/);

const appearanceSchema = z.object(
  Object.fromEntries(
    Object.entries(APPEARANCE_OPTIONS).map(([k, n]) => [
      k,
      z
        .number()
        .int()
        .min(0)
        .max(n - 1),
    ]),
  ) as Record<keyof typeof APPEARANCE_OPTIONS, z.ZodNumber>,
);

export const mercSetupSchema = z.object({
  name,
  discipline: z.enum(DISCIPLINE_IDS as [string, ...string[]]),
  origin: z.enum(ORIGIN_IDS as [string, ...string[]]),
  appearance: appearanceSchema,
  skills: z.array(id).max(6),
});

const equipSlot = z.enum(["weapon", "armor", "lamp", "trinket1", "trinket2"] satisfies typeof EQUIP_SLOTS[number][]);

export const runCommandSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("vote"), nodeId: id }),
  z.object({ type: z.literal("useSkill"), unitId: id, skillId: id, targetId: id.optional() }),
  z.object({ type: z.literal("continue") }),
  z.object({
    type: z.literal("equip"),
    mercId: id,
    itemUid: z.number().int().nonnegative(),
    slot: equipSlot.optional(),
  }),
  z.object({ type: z.literal("unequip"), mercId: id, slot: equipSlot }),
  z.object({ type: z.literal("setSkills"), mercId: id, skills: z.array(id).length(4) }),
  z.object({ type: z.literal("choosePerk"), mercId: id, perkId: id }),
  z.object({ type: z.literal("swap"), mercA: id, mercB: id }),
  z.object({ type: z.literal("refuel") }),
]);

export const clientMessageSchema = z.discriminatedUnion("t", [
  z.object({ t: z.literal("createRoom"), v: z.literal(PROTOCOL_VERSION), name }),
  z.object({ t: z.literal("joinRoom"), v: z.literal(PROTOCOL_VERSION), code: roomCode, name }),
  z.object({
    t: z.literal("rejoin"),
    v: z.literal(PROTOCOL_VERSION),
    code: roomCode,
    token: z.string().min(16).max(64),
  }),
  z.object({ t: z.literal("submitSquad"), mercs: z.array(mercSetupSchema).min(1).max(4) }),
  z.object({ t: z.literal("startGame") }),
  z.object({ t: z.literal("command"), command: runCommandSchema }),
]);

export type ClientMessage = z.infer<typeof clientMessageSchema>;

export interface LobbyPlayer {
  id: PlayerId;
  name: string;
  connected: boolean;
  /** Number of mercenaries this player controls. */
  slots: number;
  /** Has submitted their mercenaries. */
  ready: boolean;
}

export type ServerMessage =
  | { t: "welcome"; code: string; playerId: PlayerId; token: string }
  | { t: "lobby"; code: string; hostId: PlayerId; players: LobbyPlayer[]; started: boolean }
  | { t: "state"; view: RunView; events: RunEvent[] }
  | { t: "error"; message: string };

export type ParseResult<T> = { ok: true; value: T } | { ok: false; error: string };

export function parseClientMessage(raw: unknown): ParseResult<ClientMessage> {
  let data = raw;
  if (typeof raw === "string") {
    try {
      data = JSON.parse(raw);
    } catch {
      return { ok: false, error: "Malformed JSON." };
    }
  }
  const parsed = clientMessageSchema.safeParse(data);
  if (!parsed.success) return { ok: false, error: "Invalid message." };
  return { ok: true, value: parsed.data as ClientMessage };
}
