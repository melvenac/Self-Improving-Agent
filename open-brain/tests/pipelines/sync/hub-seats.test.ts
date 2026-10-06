import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { checkHubSeats } from "../../../src/pipelines/sync/hub-seats.js";

const TALK = "HUB_URL={hub_url} node <A2A-Hub>/scripts/hub-talk.mjs --as {hub_name} --session {room}";
const READERS = {
  "cursor-infra": {
    partners: [{ label: "Atlas", hub_as: "atlas", session_id: "k5702788wctxj75begyt4x2k5x8f6mav" }],
  },
};

const DISPATCH_CC = { via: "session", name: "infra", host: "qa-pc" };
const DISPATCH_CURSOR = {
  via: "hub-room",
  hub_name: "cursor-infra",
  room: "k5702788wctxj75begyt4x2k5x8f6mav",
  waker: "cursor-infra-waker",
};

describe("checkHubSeats", () => {
  let root: string;
  const dir = () => join(root, ".agents", "SYSTEM");

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), "ob-hub-seats-"));
    mkdirSync(dir(), { recursive: true });
    writeFileSync(join(dir(), "worktree-seats.json"), JSON.stringify({ seats: ["planner", "infra"] }));
  });

  afterEach(() => {
    rmSync(root, { recursive: true, force: true, maxRetries: 3, retryDelay: 50 });
  });

  function writeHub(body: unknown) {
    writeFileSync(join(dir(), "hub-partner-seats.json"), JSON.stringify(body));
  }

  it("skips when the data file is absent", () => {
    const result = checkHubSeats(root);
    const line = `  ${result.name}: ${result.message}`;
    expect(result.severity).toBe("skip");
    expect(line).toBe("  hub-seats: not checked: no seat file");
  });

  it("is red when the file ob_start reads has no readers map", () => {
    writeHub({
      talk: TALK,
      seats: {
        infra: {
          hub_name: "cursor-infra",
          runtime: "cursor",
          host: "qa-pc",
          model: "composer-2.5",
          dispatch: { cursor: DISPATCH_CURSOR, claude_code: DISPATCH_CC },
        },
      },
    });
    const result = checkHubSeats(root);
    expect(result.severity).toBe("issue");
    expect(result.message).toContain("readers");
  });

  it("is red when runtime is missing", () => {
    writeHub({
      talk: TALK,
      readers: READERS,
      seats: { infra: { hub_name: "cursor-infra", host: "qa-pc", model: "x", dispatch: { cursor: DISPATCH_CURSOR, claude_code: DISPATCH_CC } } },
    });
    expect(checkHubSeats(root).message).toContain("no runtime");
  });

  it("is red when the file names a seat worktree-seats.json does not have", () => {
    writeHub({
      talk: TALK,
      readers: READERS,
      seats: {
        stranger: {
          hub_name: "x",
          runtime: "cursor",
          host: "h",
          model: "m",
          dispatch: { cursor: { ...DISPATCH_CURSOR, hub_name: "x", room: "k1" }, claude_code: DISPATCH_CC },
        },
      },
    });
    const result = checkHubSeats(root);
    expect(result.severity).toBe("issue");
    expect(result.message).toContain("stranger");
    expect(result.message).toContain("worktree-seats.json");
  });

  it("is red when a cursor runtime seat has no room", () => {
    writeHub({
      talk: TALK,
      readers: READERS,
      seats: {
        infra: {
          hub_name: "cursor-infra",
          runtime: "cursor",
          host: "qa-pc",
          model: "composer-2.5",
          dispatch: { cursor: { ...DISPATCH_CURSOR, room: "" }, claude_code: DISPATCH_CC },
        },
      },
    });
    const result = checkHubSeats(root);
    expect(result.severity).toBe("issue");
    expect(result.message).toContain("infra");
    expect(result.message).toContain("no room");
  });

  // G-056 (QA 279 #434 F1): this row used to be named for a deleted key and set `room: ""`, which r1's
  // fallback also called an issue, so r1's fallback put back verbatim survived it. Each case below builds
  // the dispatch.cursor block WITHOUT the key (or with a non-string value) while the top-level room stays.
  const cursorSeatWithTopLevelRoom = (dispatchCursor: Record<string, unknown>) => ({
    talk: TALK,
    readers: READERS,
    seats: {
      infra: {
        hub_name: "cursor-infra",
        runtime: "cursor",
        host: "qa-pc",
        model: "composer-2.5",
        room: DISPATCH_CURSOR.room,
        dispatch: { cursor: dispatchCursor, claude_code: DISPATCH_CC },
      },
    },
  });

  it("dispatch room deleted, top-level kept is an issue", () => {
    const { room: _room, ...withoutRoom } = DISPATCH_CURSOR;
    expect("room" in withoutRoom).toBe(false);
    writeHub(cursorSeatWithTopLevelRoom(withoutRoom));
    const result = checkHubSeats(root);
    expect(result.severity).toBe("issue");
    expect(result.message).toContain("no room");
    expect(result.message).toContain("not a fallback");
  });

  it.each([
    ["null", null],
    ["an empty string", ""],
    ["whitespace", "   "],
    ["a number", 42],
  ])("dispatch room %s, top-level kept is an issue", (_label, value) => {
    writeHub(cursorSeatWithTopLevelRoom({ ...DISPATCH_CURSOR, room: value }));
    const result = checkHubSeats(root);
    expect(result.severity).toBe("issue");
    expect(result.message).toContain("no room");
    expect(result.message).toContain("not a fallback");
  });

  it("the same seat with its dispatch room present is green (control for the rows above)", () => {
    writeHub(cursorSeatWithTopLevelRoom({ ...DISPATCH_CURSOR }));
    expect(checkHubSeats(root).severity).toBe("pass");
  });

  it("the two differ is an issue", () => {
    writeHub({
      talk: TALK,
      readers: READERS,
      seats: {
        infra: {
          hub_name: "cursor-infra",
          runtime: "cursor",
          host: "qa-pc",
          model: "composer-2.5",
          room: "k-other-room-not-the-dispatch-one",
          dispatch: { cursor: DISPATCH_CURSOR, claude_code: DISPATCH_CC },
        },
      },
    });
    const result = checkHubSeats(root);
    expect(result.severity).toBe("issue");
    expect(result.message).toContain("differs from dispatch.cursor.room");
  });

  it("is green when every cursor runtime seat has a room and every name is a worktree seat", () => {
    writeHub({
      talk: TALK,
      readers: READERS,
      seats: {
        planner: {
          hub_name: "atlas",
          runtime: "claude-code",
          host: "desktop",
          model: "sonnet",
          dispatch: {
            cursor: { via: "hub-room", hub_name: "atlas", room: "", waker: "atlas-waker" },
            claude_code: { via: "session", name: "atlas", host: "desktop" },
          },
        },
        infra: {
          hub_name: "cursor-infra",
          runtime: "cursor",
          host: "qa-pc",
          model: "composer-2.5",
          dispatch: { cursor: DISPATCH_CURSOR, claude_code: DISPATCH_CC },
        },
      },
    });
    expect(checkHubSeats(root).severity).toBe("pass");
  });
});
