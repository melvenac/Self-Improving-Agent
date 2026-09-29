import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { checkHubSeats } from "../../../src/pipelines/sync/hub-seats.js";

const TALK = "HUB_URL={hub_url} node <A2A-Hub>/scripts/hub-talk.mjs --as {hub_name} --session {room}";

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
    writeFileSync(join(dir(), "hub-seats.json"), JSON.stringify(body));
  }

  it("skips when the data file is absent", () => {
    expect(checkHubSeats(root).severity).toBe("skip");
  });

  it("is red when the file names a seat worktree-seats.json does not have", () => {
    writeHub({ talk: TALK, seats: { stranger: { hub_name: "x", cursor: true, room: "k1" } } });
    const result = checkHubSeats(root);
    expect(result.severity).toBe("issue");
    expect(result.message).toContain("stranger");
    expect(result.message).toContain("worktree-seats.json");
  });

  it("is red when a Cursor seat has no room", () => {
    writeHub({ talk: TALK, seats: { infra: { hub_name: "cursor-infra", cursor: true } } });
    const result = checkHubSeats(root);
    expect(result.severity).toBe("issue");
    expect(result.message).toContain("infra");
    expect(result.message).toContain("no room");
  });

  it("is green when every Cursor seat has a room and every name is a worktree seat", () => {
    writeHub({
      talk: TALK,
      seats: {
        planner: { hub_name: "atlas", cursor: false },
        infra: { hub_name: "cursor-infra", cursor: true, room: "k5702788wctxj75begyt4x2k5x8f6mav" },
      },
    });
    expect(checkHubSeats(root).severity).toBe("pass");
  });
});
