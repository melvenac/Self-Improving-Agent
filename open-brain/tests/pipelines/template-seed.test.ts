import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const templateDir = join(import.meta.dirname, "../../../project-template");

/**
 * Loop 4 C5 / V8 shipped a revision-0 `state.json` seed in the template. The
 * bootstrap fix (BF-2, frogger F2) removed it: `state import` is the only thing
 * that writes a record, it refuses when one exists, and nothing substituted the
 * seed's `{{PROJECT}}`. That a scaffolded project's `/start` renders
 * `State (state.json rev 0)` is now asserted end to end, through the importer,
 * in bootstrap-fix.test.ts.
 */
describe("project-template/.agents", () => {
  it("ships no state.json seed", () => {
    expect(existsSync(join(templateDir, ".agents", "state.json"))).toBe(false);
  });

  it("the template's gitignore (shipped without the dot) tracks exactly the five state files and AGENT.md", () => {
    const text = readFileSync(join(templateDir, "gitignore"), "utf-8");
    const rules = text.split(/\r?\n/).filter((l) => l.startsWith("/.agents") || l.startsWith("!/.agents"));
    expect(rules).toEqual([
      "/.agents/*",
      "!/.agents/state.json",
      "!/.agents/AGENT.md",
      "!/.agents/TASKS/",
      "/.agents/TASKS/*",
      "!/.agents/TASKS/INBOX.md",
      "!/.agents/TASKS/task.md",
      "!/.agents/SESSIONS/",
      "/.agents/SESSIONS/*",
      "!/.agents/SESSIONS/next-session.md",
      "!/.agents/SYSTEM/",
      "/.agents/SYSTEM/*",
      "!/.agents/SYSTEM/SUMMARY.md",
    ]);
    // The repo root carries the same block (C4, both places).
    const rootLines = readFileSync(join(templateDir, "..", ".gitignore"), "utf-8").split(/\r?\n/);
    for (const r of rules) expect(rootLines).toContain(r);
  });

  it("root and template gitignore ignore A2A-Hub waker runtime files only under .cursor/", () => {
    const wakerRules = ["/.cursor/wake.lock", "/.cursor/waker.pid", "/.cursor/wake-prompt-*.txt"];
    const templateText = readFileSync(join(templateDir, "gitignore"), "utf-8");
    const rootText = readFileSync(join(templateDir, "..", ".gitignore"), "utf-8");
    for (const r of wakerRules) {
      expect(templateText).toContain(r);
      expect(rootText).toContain(r);
    }
    expect(rootText).toContain("!/.claude/commands/");
    expect(rootText).not.toMatch(/^\/\.cursor\/\*$/m);
  });

  it("the template's gitattributes (shipped without the dot) keeps .agents/ LF", () => {
    const lines = readFileSync(join(templateDir, "gitattributes"), "utf-8").split(/\r?\n/).filter((l) => l && !l.startsWith("#"));
    expect(lines).toEqual(["/.agents/** text eol=lf"]);
  });
});
