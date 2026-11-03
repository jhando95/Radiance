/**
 * Wire protocol shared by client and server. Every message from a client is untrusted
 * and MUST be parsed with `parseClientMessage` before use.
 */
import { z } from "zod";
import type { CombatView } from "./combat/view";
import { CLASS_IDS } from "./content";
import type { CombatEvent, PlayerId } from "./types";

export const PROTOCOL_VERSION = 1;

const name = z.string().trim().min(1).max(24);
const classId = z.enum(CLASS_IDS as [string, ...string[]]);
const roomCode = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^[A-Z0-9]{4,8}$/);

export const commandSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("playCard"),
    cardUid: z.number().int().nonnegative(),
    targetId: z.string().max(32).optional(),
  }),
  z.object({ type: z.literal("endTurn") }),
  z.object({ type: z.literal("cancelEndTurn") }),
]);

export const clientMessageSchema = z.discriminatedUnion("t", [
  z.object({ t: z.literal("createRoom"), v: z.literal(PROTOCOL_VERSION), name, classId }),
  z.object({
    t: z.literal("joinRoom"),
    v: z.literal(PROTOCOL_VERSION),
    code: roomCode,
    name,
    classId,
  }),
  z.object({
    t: z.literal("rejoin"),
    v: z.literal(PROTOCOL_VERSION),
    code: roomCode,
    token: z.string().min(16).max(64),
  }),
  z.object({ t: z.literal("setClass"), classId }),
  z.object({ t: z.literal("startGame") }),
  z.object({ t: z.literal("command"), command: commandSchema }),
]);

export type ClientMessage = z.infer<typeof clientMessageSchema>;

export interface LobbyPlayer {
  id: PlayerId;
  name: string;
  classId: string;
  connected: boolean;
}

export type ServerMessage =
  | { t: "welcome"; code: string; playerId: PlayerId; token: string }
  | { t: "lobby"; code: string; hostId: PlayerId; players: LobbyPlayer[]; started: boolean }
  | { t: "state"; view: CombatView; events: CombatEvent[] }
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
  return { ok: true, value: parsed.data };
}
