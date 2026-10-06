import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { hubRoomGuardViolations, hubRoomSectionFromStart } from "../../../src/pipelines/sync/hub-room-guard.js";

/**
 * T-228: relay's A2A Loop 13 contract for `hub-talk` exit codes (A2A-Hub master 8e59f58, docs/loops/loop-13-design-ruling.md).
 * Every Cursor-facing copy of the hub rule carries all four codes for `--inbox` and `--say`, including 3 (unavailable or
 * throttled) with its stderr line and its backoff, so a seat does not read a throttled hub as a refusal.
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
  "comes only from --wait",
  "seat with a waker does not run",
  "if you see it, end the turn",
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

  it("no Cursor copy tells a waker seat to wait again on exit 2 (HUBROOM-TURN-END r2)", () => {
    for (const rel of COPIES) {
      expect(read(rel)).not.toContain("wait again");
    }
  });

  it("the two hub-room.mdc copies are identical (the repo's own rule and the template's)", () => {
    expect(read(".cursor/rules/hub-room.mdc")).toBe(read("project-template/.cursor/rules/hub-room.mdc"));
  });

  const QA_REWORDINGS = {
    R1: "After posting, run hub-talk --wait for the next atlas turn.",
    R2: "When the post succeeds, run the `talk` line again with `--wait` and handle the next atlas turn in this run.",
    R3: "Then keep listening: append the seat file's `wait` suffix to the talk line and act on what it prints before you end the turn.",
    R4: "After posting, run the talk line with --wait --wait-timeout 3500.",
  } as const;

  const MDC_ANCHOR = "Post when the work is done, not a bare acknowledgement.";
  const plantMdc = (mdc: string, line: string) => mdc.replace(MDC_ANCHOR, `${MDC_ANCHOR}\n\n${line}`);
  const plantStartHub = (start: string, suffix: string) => {
    const lines = start.split("\n");
    const at = lines.findIndex((l) => l.trim() === "### Hub room");
    expect(at).toBeGreaterThan(-1);
    const hubLine = lines[at + 1];
    lines[at + 1] = `${hubLine} ${suffix}`;
    return lines.join("\n");
  };

  const guardTargets: { label: string; text: () => string }[] = [
    { label: ".cursor/rules/hub-room.mdc", text: () => read(".cursor/rules/hub-room.mdc") },
    { label: "project-template/.cursor/rules/hub-room.mdc", text: () => read("project-template/.cursor/rules/hub-room.mdc") },
    {
      label: "start.md Hub room section",
      text: () => hubRoomSectionFromStart(read("project-template/.cursor/commands/start.md")),
    },
  ];

  it("tracked hub copies pass the sentence guard (HUBROOM-GUARD)", () => {
    for (const { label, text } of guardTargets) {
      expect(hubRoomGuardViolations(text()), label).toEqual([]);
    }
  });

  it("QA-281 rewordings R1–R4 fail the sentence guard in every copy (HUBROOM-GUARD G1)", () => {
    for (const [id, line] of Object.entries(QA_REWORDINGS)) {
      const mdc = read(".cursor/rules/hub-room.mdc");
      const start = read("project-template/.cursor/commands/start.md");
      expect(hubRoomGuardViolations(plantMdc(mdc, line)), `${id} mdc`).not.toEqual([]);
      expect(hubRoomGuardViolations(hubRoomSectionFromStart(plantStartHub(start, line))), `${id} start`).not.toEqual([]);
    }
  });

  it("hub-room.mdc cites A2A-Hub shared.md Hub transport at b6a8de79 and D-120 (HUBROOM-TURN-END amendment 1)", () => {
    const cite = "b6a8de79";
    const section = "Hub transport: how a seat waits";
    for (const rel of [".cursor/rules/hub-room.mdc", "project-template/.cursor/rules/hub-room.mdc"]) {
      const t = read(rel);
      expect(t).toContain(cite);
      expect(t).toContain(section);
      expect(t).toContain("D-120:");
      expect(t).toContain("never waits inside its turn");
    }
  });

  it("start.md Hub section cites b6a8de79 and shared.md Hub transport (HUBROOM-TURN-END amendment 1)", () => {
    const t = read("project-template/.cursor/commands/start.md");
    expect(t).toContain("b6a8de79");
    expect(t).toContain("Hub transport: how a seat waits");
    expect(t).toContain("D-120:");
  });

  it("every changed Hub-room line in start.md is a complete line of the cursor_only table, so cursor-start-parity waives it (and only it)", () => {
    const table = JSON.parse(read("docs/loops/cursor-start-differences.json")) as { cursor_only: string[] };
    const lines = read("project-template/.cursor/commands/start.md").split("\n");
    const at = lines.indexOf("### Hub room");
    expect(at).toBeGreaterThan(-1);
    const section = lines.slice(at + 1).filter((l) => l.trim() !== "");
    const hubLines = section.filter((l) => /hub-talk|exit 3|Turn-end and wait/.test(l));
    expect(hubLines.length).toBeGreaterThanOrEqual(2);
    for (const l of hubLines) expect(table.cursor_only, l.slice(0, 60)).toContain(l);
  });
});
