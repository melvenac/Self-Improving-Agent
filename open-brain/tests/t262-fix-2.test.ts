import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { checkTemplatePersonalNames } from "../src/pipelines/sync/checks.js";

const repoRoot = join(import.meta.dirname, "../..");
const read = (rel: string) => readFileSync(join(repoRoot, rel), "utf8");

const END_FILES = [
  ".claude/commands/end.md",
  "project-template/.claude/commands/end.md",
  "project-template/.cursor/commands/end.md",
];
const CURSOR_END = "project-template/.cursor/commands/end.md";

describe("T-262 fix 2", () => {
  it("N1: the template carries no personal names", () => {
    expect(checkTemplatePersonalNames(repoRoot).severity).toBe("pass");
  });

  it("N2: the three end.md files name no coordinator by name", () => {
    for (const f of END_FILES) {
      const text = read(f);
      expect(text, f).not.toMatch(/\bclark\b/i);
      expect(text, f).toContain("for the coordinator to take to the user");
    }
  });

  it("N3: the Cursor end.md does not promise a SessionEnd hook", () => {
    const text = read(CURSOR_END);
    expect(text).not.toContain("named in the next");
    expect(text).toContain("Under Cursor no SessionEnd hook runs");
  });

  it("N4: the Throws doc comment sits on auditSkills, not TranscriptFile", () => {
    const lines = readFileSync(
      join(repoRoot, "open-brain/src/pipelines/skills-audit/index.ts"),
      "utf8",
    ).split(/\r?\n/);
    const fn = lines.findIndex((l) => l.startsWith("export function auditSkills("));
    const iface = lines.findIndex((l) => l.startsWith("interface TranscriptFile {"));
    expect(fn).toBeGreaterThan(0);
    expect(iface).toBeGreaterThan(0);
    expect(lines[fn - 1]).toMatch(/^\/\*\* Throws an Error/);
    expect(lines[iface - 1]).not.toContain("Throws");
  });
});
