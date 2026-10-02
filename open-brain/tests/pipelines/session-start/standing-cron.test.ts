/**
 * T-211: the standing status cron lives in seat data and `ob_start` prints it (SR-1 to SR-6).
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
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

  it("SR-2b a local file carrying ONLY status_to still wins over a full AGENT.md, and is INVALID (QA 249 F2, mutant a)", () => {
    seatFile(root, "AGENT.md", [...IDENTITY, ...KEYS("7,37 * * * *", "clark", "docs/rule.md")]);
    seatFile(root, "AGENT.local.md", [...IDENTITY, "status_to: atlas-sia"]);
    expect(readStandingCron(root)).toBe("Standing cron: INVALID in .agents/AGENT.local.md: status_cron is missing");
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
    // The boundary itself: 60 is out (QA 249 F3, mutant b), 59 is in.
    seatFile(root, "AGENT.local.md", [...IDENTITY, ...KEYS("60 * * * *")]);
    expect(readStandingCron(root)).toBe('Standing cron: INVALID in .agents/AGENT.local.md: status_cron minute field "60" is out of range 0-59');
    seatFile(root, "AGENT.local.md", [...IDENTITY, ...KEYS("59 * * * *")]);
    expect(readStandingCron(root)).toContain("Standing cron: 59 * * * * ");
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

  it("SR-7 the template's documented example, taken from the template file itself, prints the present-shape line (QA 249 F4)", () => {
    const template = readFileSync(join(import.meta.dirname, "../../../../project-template/.agents/AGENT.md"), "utf-8");
    const block = template.match(/```\n(status_cron:[\s\S]*?)```/);
    expect(block, "the template documents the three keys in a fenced block").not.toBeNull();
    // Only the placeholders are filled in; every other character is the template's.
    const example = block![1]!.replace("<agent-name>", "clark").replace("<role>", "planner").split("\n").filter((l) => l.trim() !== "");
    expect(example).toHaveLength(3);
    seatFile(root, "AGENT.local.md", [...IDENTITY, ...example]);
    expect(readStandingCron(root)).toBe(
      "Standing cron: */20 * * * * → status to clark (rule: .agents/roles/planner.md). Create it with CronCreate before the briefing ends.",
    );
  });

  const templateExample = (): string[] => {
    const template = readFileSync(join(import.meta.dirname, "../../../../project-template/.agents/AGENT.md"), "utf-8");
    const block = template.match(/```\n(status_cron:[\s\S]*?)```/);
    expect(block, "the template documents the three keys in a fenced block").not.toBeNull();
    return block![1]!.split("\n").filter((l) => l.trim() !== "");
  };

  it("SR-8 T-224: the template example copied VERBATIM names the unfilled placeholder, not 'missing'", () => {
    const example = templateExample();
    expect(example).toHaveLength(3);
    seatFile(root, "AGENT.local.md", [...IDENTITY, ...example]);
    expect(readStandingCron(root)).toBe("Standing cron: INVALID in .agents/AGENT.local.md: status_to is an unfilled placeholder (<agent-name>)");
  });

  it("SR-8b T-224: a placeholder left INSIDE a value (the rule path) is named too, once the recipient is filled", () => {
    const example = templateExample().map((l) => l.replace("<agent-name>", "clark"));
    seatFile(root, "AGENT.local.md", [...IDENTITY, ...example]);
    expect(readStandingCron(root)).toBe("Standing cron: INVALID in .agents/AGENT.local.md: status_rule is an unfilled placeholder (<role>)");
  });

  it("SR-8c T-224: a placeholder still counts as unset; a truly absent or empty key still says missing", () => {
    seatFile(root, "AGENT.local.md", [...IDENTITY, 'status_cron: "*/20 * * * *"', "status_rule: .agents/roles/planner.md"]);
    expect(readStandingCron(root)).toBe("Standing cron: INVALID in .agents/AGENT.local.md: status_to is missing");
    seatFile(root, "AGENT.local.md", [...IDENTITY, 'status_cron: "*/20 * * * *"', "status_to:", "status_rule: .agents/roles/planner.md"]);
    expect(readStandingCron(root)).toBe("Standing cron: INVALID in .agents/AGENT.local.md: status_to is missing");
    // A file whose only cron keys are placeholders carries none of them: unchanged from before.
    seatFile(root, "AGENT.local.md", [...IDENTITY, "status_to: <agent-name>"]);
    expect(readStandingCron(root)).toBe("Standing cron: none in seat data.");
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
      // Nothing else differs. The word count line counts the words of the added line, so it is excluded by name.
      const rest = (ls: string[]): string[] => ls.filter((l) => !l.startsWith("Standing cron:") && !l.startsWith("Total returned words:"));
      expect(rest(lb)).toEqual(rest(la));
      expect(rest(la).length).toBeGreaterThan(20);
    } finally {
      rmSync(bare, { recursive: true, force: true });
      rmSync(keyed, { recursive: true, force: true });
    }
  });
});
