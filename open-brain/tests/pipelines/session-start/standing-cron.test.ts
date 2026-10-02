/**
 * T-211: the standing status cron lives in seat data and `ob_start` prints it (SR-1 to SR-6).
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { readStandingCron } from "../../../src/pipelines/session-start/agent-identity.js";
import { handleStart } from "../../../src/server.js";

const IDENTITY = ["name: Atlas", "role: planner", "partner: Forge"];
const KEYS = (cron: string, to = "relay-a2a", rule = ".agents/roles/planner.md"): string[] => [
  `status_cron: "${cron}"`,
  `status_to: ${to}`,
  `status_rule: ${rule}`,
];

function seatFile(dir: string, file: string, lines: string[]): void {
  mkdirSync(join(dir, ".agents"), { recursive: true });
  writeFileSync(join(dir, ".agents", file), `---\n${lines.join("\n")}\n---\n\n# body\n`, "utf-8");
}

describe("T-211 standing cron in seat data", { timeout: 120_000 }, () => {
  let root: string;
  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), "t211-"));
  });
  afterEach(() => rmSync(root, { recursive: true, force: true }));

  it("SR-1 the three keys in AGENT.local.md print the present-shape line with those values, verbatim", () => {
    seatFile(root, "AGENT.local.md", [...IDENTITY, ...KEYS("*/20 * * * *")]);
    expect(readStandingCron(root)).toBe(
      "Standing cron: */20 * * * * → status to relay-a2a (rule: .agents/roles/planner.md). Create it with CronCreate before the briefing ends.",
    );
  });

  it("SR-2 AGENT.md's keys are printed when the local file lacks them, and a local file that HAS the keys overrides the tracked one", () => {
    seatFile(root, "AGENT.md", [...IDENTITY, ...KEYS("7,37 * * * *", "clark", "docs/rule.md")]);
    seatFile(root, "AGENT.local.md", [...IDENTITY]);
    expect(readStandingCron(root)).toBe(
      "Standing cron: 7,37 * * * * → status to clark (rule: docs/rule.md). Create it with CronCreate before the briefing ends.",
    );
    seatFile(root, "AGENT.local.md", [...IDENTITY, ...KEYS("15 * * * *", "atlas-sia", ".agents/roles/planner.md")]);
    expect(readStandingCron(root)).toBe(
      "Standing cron: 15 * * * * → status to atlas-sia (rule: .agents/roles/planner.md). Create it with CronCreate before the briefing ends.",
    );
  });

  it("SR-3 with neither file carrying them it says none in seat data", () => {
    seatFile(root, "AGENT.md", IDENTITY);
    expect(readStandingCron(root)).toBe("Standing cron: none in seat data.");
    seatFile(root, "AGENT.local.md", IDENTITY);
    expect(readStandingCron(root)).toBe("Standing cron: none in seat data.");
    // No agent files at all is also "none", not a crash.
    const empty = mkdtempSync(join(tmpdir(), "t211-empty-"));
    try {
      expect(readStandingCron(empty)).toBe("Standing cron: none in seat data.");
    } finally {
      rmSync(empty, { recursive: true, force: true });
    }
  });

  it("SR-4 a cron with too few fields, or a field out of range, prints INVALID with the file and the reason", () => {
    seatFile(root, "AGENT.local.md", [...IDENTITY, ...KEYS("4 * *")]);
    expect(readStandingCron(root)).toBe("Standing cron: INVALID in .agents/AGENT.local.md: status_cron has 3 fields, expected 5");
    seatFile(root, "AGENT.local.md", [...IDENTITY, ...KEYS("61 * * * *")]);
    expect(readStandingCron(root)).toBe('Standing cron: INVALID in .agents/AGENT.local.md: status_cron minute field "61" is out of range 0-59');
    seatFile(root, "AGENT.local.md", [...IDENTITY, ...KEYS("0 24 * * *")]);
    expect(readStandingCron(root)).toContain('hour field "24" is out of range 0-23');
    seatFile(root, "AGENT.local.md", [...IDENTITY, ...KEYS("0 0 32 * *")]);
    expect(readStandingCron(root)).toContain('day-of-month field "32" is out of range 1-31');
    seatFile(root, "AGENT.local.md", [...IDENTITY, ...KEYS("0 0 1 13 *")]);
    expect(readStandingCron(root)).toContain('month field "13" is out of range 1-12');
    seatFile(root, "AGENT.local.md", [...IDENTITY, ...KEYS("0 0 1 1 8")]);
    expect(readStandingCron(root)).toContain('day-of-week field "8" is out of range 0-7');
    seatFile(root, "AGENT.local.md", [...IDENTITY, ...KEYS("*/0 * * * *")]);
    expect(readStandingCron(root)).toContain("INVALID");
    seatFile(root, "AGENT.local.md", [...IDENTITY, ...KEYS("a * * * *")]);
    expect(readStandingCron(root)).toContain("INVALID");
    // An invalid tracked file is named as such.
    rmSync(join(root, ".agents", "AGENT.local.md"));
    seatFile(root, "AGENT.md", [...IDENTITY, ...KEYS("4 * *")]);
    expect(readStandingCron(root)).toContain("INVALID in .agents/AGENT.md:");
  });

  it("SR-4b a cron key without status_to or status_rule is INVALID, never silently dropped", () => {
    seatFile(root, "AGENT.local.md", [...IDENTITY, 'status_cron: "0 * * * *"']);
    expect(readStandingCron(root)).toBe("Standing cron: INVALID in .agents/AGENT.local.md: status_to is missing");
    seatFile(root, "AGENT.local.md", [...IDENTITY, 'status_cron: "0 * * * *"', "status_to: clark"]);
    expect(readStandingCron(root)).toBe("Standing cron: INVALID in .agents/AGENT.local.md: status_rule is missing");
    seatFile(root, "AGENT.local.md", [...IDENTITY, "status_to: clark", "status_rule: x.md"]);
    expect(readStandingCron(root)).toBe("Standing cron: INVALID in .agents/AGENT.local.md: status_cron is missing");
  });

  it("SR-6 ob_start prints the line in the seat block, and every other greeting line is unchanged by it", async () => {
    const make = (extra: string[]): string => {
      const dir = mkdtempSync(join(tmpdir(), "t211-greet-"));
      writeFileSync(join(dir, "package.json"), JSON.stringify({ version: "1.0.0" }));
      mkdirSync(join(dir, ".agents", "SYSTEM"), { recursive: true });
      mkdirSync(join(dir, ".agents", "TASKS"), { recursive: true });
      mkdirSync(join(dir, ".agents", "SESSIONS"), { recursive: true });
      writeFileSync(join(dir, ".agents", "SYSTEM", "SUMMARY.md"), "# Summary\n");
      writeFileSync(join(dir, ".agents", "TASKS", "INBOX.md"), "# Inbox\n");
      writeFileSync(join(dir, ".agents", "TASKS", "task.md"), "# Task\n");
      writeFileSync(join(dir, ".agents", "SESSIONS", "next-session.md"), "# Handoff\n");
      seatFile(dir, "AGENT.local.md", [...IDENTITY, ...extra]);
      return dir;
    };
    const norm = (text: string, dir: string): string[] => text.split(dir).join("<ROOT>").split("\n");
    const bare = make([]);
    const keyed = make(KEYS("*/20 * * * *"));
    try {
      const a = (await handleStart({ project_root: bare })).content[0]!.text;
      const b = (await handleStart({ project_root: keyed })).content[0]!.text;
      const la = norm(a, bare);
      const lb = norm(b, keyed);
      expect(la.filter((l) => l.startsWith("Standing cron:"))).toEqual(["Standing cron: none in seat data."]);
      expect(lb.filter((l) => l.startsWith("Standing cron:"))).toEqual([
        "Standing cron: */20 * * * * → status to relay-a2a (rule: .agents/roles/planner.md). Create it with CronCreate before the briefing ends.",
      ]);
      // The line sits right after the Seat line.
      const seatAt = lb.findIndex((l) => l.startsWith("Seat: "));
      expect(seatAt).toBeGreaterThanOrEqual(0);
      expect(lb[seatAt + 1]).toMatch(/^Standing cron: /);
      // Nothing else differs.
      expect(lb.filter((l) => !l.startsWith("Standing cron:"))).toEqual(la.filter((l) => !l.startsWith("Standing cron:")));
    } finally {
      rmSync(bare, { recursive: true, force: true });
      rmSync(keyed, { recursive: true, force: true });
    }
  });
});
