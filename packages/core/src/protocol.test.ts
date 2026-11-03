import { describe, expect, it } from "vitest";
import { PROTOCOL_VERSION, parseClientMessage } from "./protocol";

describe("parseClientMessage", () => {
  it("accepts a valid createRoom", () => {
    const r = parseClientMessage(
      JSON.stringify({ t: "createRoom", v: PROTOCOL_VERSION, name: "Ada", classId: "warden" }),
    );
    expect(r.ok).toBe(true);
  });

  it("normalizes room codes", () => {
    const r = parseClientMessage({
      t: "joinRoom",
      v: PROTOCOL_VERSION,
      code: " abcd ",
      name: "Bo",
      classId: "seeker",
    });
    expect(r.ok && r.value.t === "joinRoom" && r.value.code).toBe("ABCD");
  });

  it.each([
    ["not json", "{nope"],
    ["unknown type", { t: "hack" }],
    ["bad class", { t: "createRoom", v: PROTOCOL_VERSION, name: "A", classId: "god" }],
    [
      "long name",
      { t: "createRoom", v: PROTOCOL_VERSION, name: "x".repeat(99), classId: "warden" },
    ],
    ["wrong version", { t: "createRoom", v: 999, name: "A", classId: "warden" }],
    ["bad command", { t: "command", command: { type: "playCard", cardUid: -1 } }],
  ])("rejects %s", (_label, msg) => {
    expect(parseClientMessage(msg).ok).toBe(false);
  });
});
