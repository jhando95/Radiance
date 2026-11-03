import { randomBytes, randomInt, randomUUID } from "node:crypto";
import { createServer } from "node:http";
import { parseClientMessage, type ServerMessage } from "@radiance/core";
import { WebSocket, WebSocketServer } from "ws";
import { type Connection, RoomManager } from "./rooms";

const PORT = Number(process.env.PORT ?? 8787);
const MAX_MESSAGE_BYTES = 16 * 1024;
const MAX_MESSAGES_PER_SECOND = 20;
const HEARTBEAT_MS = 15_000;
// Unambiguous characters only (no 0/O, 1/I/L) so codes are easy to read aloud.
const CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

const rooms = new RoomManager({
  makeCode: () =>
    Array.from({ length: 5 }, () => CODE_ALPHABET[randomInt(CODE_ALPHABET.length)]).join(""),
  makeToken: () => randomUUID(),
  makeSeed: () => randomBytes(8).toString("hex"),
  now: () => Date.now(),
});

// Plain HTTP endpoint for load balancer / platform health checks.
const http = createServer((req, res) => {
  if (req.url === "/health") {
    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify({ ok: true, rooms: rooms.roomCount }));
    return;
  }
  res.writeHead(404).end();
});

const wss = new WebSocketServer({ server: http, maxPayload: MAX_MESSAGE_BYTES });

interface SocketState {
  alive: boolean;
  windowStart: number;
  messagesInWindow: number;
}

wss.on("connection", (socket: WebSocket) => {
  const meta: SocketState = { alive: true, windowStart: Date.now(), messagesInWindow: 0 };
  const conn: Connection = {
    peer: {
      send(msg: ServerMessage) {
        if (socket.readyState === WebSocket.OPEN) socket.send(JSON.stringify(msg));
      },
    },
  };

  socket.on("pong", () => {
    meta.alive = true;
  });

  socket.on("message", (data, isBinary) => {
    const now = Date.now();
    if (now - meta.windowStart >= 1000) {
      meta.windowStart = now;
      meta.messagesInWindow = 0;
    }
    if (++meta.messagesInWindow > MAX_MESSAGES_PER_SECOND) {
      conn.peer.send({ t: "error", message: "Slow down." });
      return;
    }
    if (isBinary) return;
    const parsed = parseClientMessage(data.toString());
    if (!parsed.ok) {
      conn.peer.send({ t: "error", message: parsed.error });
      return;
    }
    try {
      rooms.handle(conn, parsed.value);
    } catch (err) {
      // A thrown error here is a bug in core/server, not bad input. Log it, keep serving.
      console.error("Error handling message", parsed.value, err);
      conn.peer.send({ t: "error", message: "Server error." });
    }
  });

  socket.on("close", () => rooms.disconnect(conn));
  (socket as WebSocket & { meta?: SocketState }).meta = meta;
});

const heartbeat = setInterval(() => {
  for (const socket of wss.clients) {
    const meta = (socket as WebSocket & { meta?: SocketState }).meta;
    if (!meta) continue;
    if (!meta.alive) {
      socket.terminate();
      continue;
    }
    meta.alive = false;
    socket.ping();
  }
  const removed = rooms.sweep();
  if (removed > 0) console.log(`Swept ${removed} idle room(s)`);
}, HEARTBEAT_MS);

wss.on("close", () => clearInterval(heartbeat));

http.listen(PORT, () => {
  console.log(`Radiance server listening on :${PORT} (ws + /health)`);
});

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.on(signal, () => {
    console.log(`${signal} received, shutting down`);
    wss.close();
    http.close(() => process.exit(0));
  });
}
