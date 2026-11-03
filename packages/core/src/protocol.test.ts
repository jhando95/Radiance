import { describe, expect, it } from "vitest";
import { PROTOCOL_VERSION, parseClientMessage } from "./protocol";
import { CLASS_PRESETS } from "./sim/presets";

describe("parseClientMessage", () => {
  it("accepts valid messages", () => {
    expect(parseClientMessage({ t: "createRoom", v: PROTOCOL_VERSION, name: "Ada" }).ok).toBe(true);
    expect(parseClientMessage({ t: "submitSquad", mercs: [CLASS_PRESETS.vanguard] }).ok).toBe(true);
    expect(
      parseClientMessage({
        t: "command",
        command: { type: "useSkill", unitId: "m1", skillId: "rend", targetId: "e1" },
      }).ok,
    ).toBe(true);
  });

  it.each([
    ["junk", "{nope"],
    ["unknown", { t: "hack" }],
    [
      "bad discipline",
      { t: "submitSquad", mercs: [{ ...CLASS_PRESETS.vanguard, discipline: "god" }] },
    ],
    [
      "appearance out of range",
      {
        t: "submitSquad",
        mercs: [
          {
            ...CLASS_PRESETS.vanguard,
            appearance: { ...CLASS_PRESETS.vanguard?.appearance, skin: 99 },
          },
        ],
      },
    ],
    ["too many mercs", { t: "submitSquad", mercs: Array(5).fill(CLASS_PRESETS.vanguard) }],
    ["old protocol", { t: "createRoom", v: 1, name: "A" }],
    ["bad command", { t: "command", command: { type: "setSkills", mercId: "m1", skills: ["a"] } }],
  ])("rejects %s", (_l, msg) => {
    expect(parseClientMessage(msg).ok).toBe(false);
  });
});
