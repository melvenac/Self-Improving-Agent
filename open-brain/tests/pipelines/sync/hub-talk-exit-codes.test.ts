import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * T-228: relay's A2A Loop 13 contract for `hub-talk` exit codes (A2A-Hub master 8e59f58, docs/loops/loop-13-design-ruling.md).
 * Every Cursor-facing copy of the hub rule carries all four codes for `--inbox` and `--say`, including 3 (unavailable or
 * throttled) with its stderr line and its backoff, so a seat does not read a throttled hub as "the window elapsed" or as a refusal.
 */
const repo = join(process.cwd(), "..");
const read = (rel: string): string => readFileSync(join(repo, rel), "utf-8").replace(/\r\n/g, "\n");

const COPIES = ["project-template/.cursor/commands/start.md", ".cursor/rules/hub-room.mdc", "project-template/.cursor/rules/hub-room.mdc"];

/** Phrases that must appear, each in every copy. */
const REQUIRED = [
  "exit 0",
  "exit 1",
  "exit 2",
  "exit 3",
  "a turn was printed",
  "act on it",
  "refused or called wrong",
  "do not retry",
  "the window elapsed",
  "wait again",
  "unavailable or throttled",
  "[hub-talk] retry status=<code|network> retry-after=<seconds|unknown>",
  "wait `retry-after` seconds",
  "back off 5 s doubling to 60 s",
  "5 consecutive exit-3 results over 2 minutes with no `retry-after`",
  "stop and report",
];

describe("T-228 hub-talk exit codes 0, 1, 2 and 3 in every Cursor copy of the hub rule", () => {
  for (const rel of COPIES) {
    it(`${rel} carries the whole contract`, () => {
      const t = read(rel);
      for (const phrase of REQUIRED) expect(t.toLowerCase(), `${rel}: ${phrase}`).toContain(phrase.toLowerCase());
    });
  }

  it("the old two-code wording ('and again on exit 2' / 'Exit 2: run the same command again') is gone", () => {
    expect(read("project-template/.cursor/commands/start.md")).not.toContain("and again on exit 2");
    for (const rel of [".cursor/rules/hub-room.mdc", "project-template/.cursor/rules/hub-room.mdc"]) {
      expect(read(rel)).not.toContain("Exit 2: run the same command again");
    }
  });

  it("the two hub-room.mdc copies are identical (the repo's own rule and the template's)", () => {
    expect(read(".cursor/rules/hub-room.mdc")).toBe(read("project-template/.cursor/rules/hub-room.mdc"));
  });

  it("hub-room.mdc does not tell a Cursor seat to run hub-talk --wait (HUBROOM-TURN-END)", () => {
    for (const rel of [".cursor/rules/hub-room.mdc", "project-template/.cursor/rules/hub-room.mdc"]) {
      expect(read(rel)).not.toContain("--wait");
    }
  });

  it("every changed Hub-room line in start.md is a complete line of the cursor_only table, so cursor-start-parity waives it (and only it)", () => {
    const table = JSON.parse(read("docs/loops/cursor-start-differences.json")) as { cursor_only: string[] };
    const lines = read("project-template/.cursor/commands/start.md").split("\n");
    const at = lines.indexOf("### Hub room");
    expect(at).toBeGreaterThan(-1);
    const section = lines.slice(at + 1).filter((l) => l.trim() !== "");
    const hubLines = section.filter((l) => /hub-talk|exit 3/.test(l));
    expect(hubLines.length).toBeGreaterThanOrEqual(2);
    for (const l of hubLines) expect(table.cursor_only, l.slice(0, 60)).toContain(l);
  });
});
