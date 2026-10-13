import { describe, it, expect, afterAll } from "vitest";
import { execFileSync } from "node:child_process";
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { parseState, type State } from "../../../src/shared/state-schema.js";
import * as b from "../../../src/pipelines/session-start/briefing.js";
import * as checks from "../../../src/pipelines/sync/checks.js";
import * as srv from "../../../src/server.js";

/**
 * T-167: /start shows what the project is for (the PRD's own Problem Statement paragraph, one line in the briefing), and a
 * missing PRD is an ISSUE in /sync where the repo opted into that line (greeting.json `briefing_problem`).
 * Namespace imports, so a missing export fails its rows rather than the file.
 */
const REPO = resolve(import.meta.dirname, "../../../..");
const FIXTURE = JSON.parse(readFileSync(resolve(import.meta.dirname, "../../fixtures-state/state.json"), "utf8"));
const made: string[] = [];
afterAll(() => {
  for (const d of made) rmSync(d, { recursive: true, force: true });
});

function tmp(prefix = "t167-"): string {
  const d = mkdtempSync(join(tmpdir(), prefix));
  made.push(d);
  return d;
}
function write(root: string, rel: string, body: string): void {
  const abs = join(root, rel);
  mkdirSync(join(abs, ".."), { recursive: true });
  writeFileSync(abs, body);
}
const flagOn = (root: string): void => write(root, ".agents/SYSTEM/greeting.json", JSON.stringify({ briefing_problem: true }));

const PARA = "AI coding sessions start cold. Every agent re-reads the project from scratch.";

describe("P1: syncPrdVersion with no PRD", () => {
  it("flag on: an ISSUE naming the missing problem statement, in check and fix mode", () => {
    const root = tmp();
    flagOn(root);
    for (const checkOnly of [true, false]) {
      const r = checks.syncPrdVersion("1.0.0", root, checkOnly);
      expect(r.severity, `checkOnly=${checkOnly}`).toBe("issue");
      expect(r.message).toContain("no problem statement");
    }
  });

  it("no greeting.json: unchanged, a warn reading exactly `PRD.md not found`", () => {
    const root = tmp();
    const r = checks.syncPrdVersion("1.0.0", root, true);
    expect(r.severity).toBe("warn");
    expect(r.message).toBe("PRD.md not found");
  });
});

describe("P2: describeProblemStatement on fixtures", () => {
  it("(a) the section's first paragraph, not the table after it", () => {
    const root = tmp();
    write(
      root,
      ".agents/SYSTEM/PRD.md",
      ["# PRD", "", "## Problem Statement", "", "<!-- a note to the writer,", "across lines -->", "AI coding sessions start cold.", "Every agent re-reads the project from scratch.", "", "| Claim | Verdict |", "|---|---|", "| a | b |", "", "## Next", "", "Other text."].join("\n"),
    );
    const line = b.describeProblemStatement(root);
    expect(line).toBe(`PROBLEM (.agents/SYSTEM/PRD.md): ${PARA}`);
    expect(line).not.toContain("|");
  });

  it("(a2) a table first is skipped: the first paragraph that is not a table is the statement", () => {
    const root = tmp();
    write(root, ".agents/SYSTEM/PRD.md", ["## Problem Statement", "| x | y |", "|---|---|", "", PARA, "", "## Next"].join("\n"));
    expect(b.describeProblemStatement(root)).toBe(`PROBLEM (.agents/SYSTEM/PRD.md): ${PARA}`);
  });

  it("(b) a 500-character paragraph is clipped, and the clip names the length", () => {
    const root = tmp();
    write(root, ".agents/SYSTEM/PRD.md", ["## Problem Statement", "", "a".repeat(500), ""].join("\n"));
    const line = b.describeProblemStatement(root);
    expect(line.startsWith("PROBLEM (.agents/SYSTEM/PRD.md): ")).toBe(true);
    expect(line.endsWith("… (500 chars)")).toBe(true);
  });

  it("(c) no PRD", () => {
    expect(b.describeProblemStatement(tmp())).toBe("PROBLEM: not shown (no PRD.md in .agents/SYSTEM/, docs/ or the repo root)");
  });

  it("(d) no heading", () => {
    const root = tmp();
    write(root, "docs/PRD.md", "# PRD\n\n## Overview\n\nSomething.\n");
    expect(b.describeProblemStatement(root)).toBe('PROBLEM: not shown (docs/PRD.md has no "## Problem Statement" heading)');
  });

  it("(e) an empty section", () => {
    const root = tmp();
    write(root, "PRD.md", "# PRD\n\n## Problem Statement\n\n<!-- fill me in -->\n\n## Next\n\nText.\n");
    expect(b.describeProblemStatement(root)).toBe(`PROBLEM: not shown (PRD.md's "## Problem Statement" section is empty)`);
  });

  it("(f) the template's `**Problem Statement:**` field form is not parsed: the no-heading line, never the example", () => {
    const root = tmp();
    mkdirSync(join(root, ".agents", "SYSTEM"), { recursive: true });
    copyFileSync(join(REPO, "project-template", ".agents", "SYSTEM", "PRD.md"), join(root, ".agents", "SYSTEM", "PRD.md"));
    const line = b.describeProblemStatement(root);
    expect(line).toBe('PROBLEM: not shown (.agents/SYSTEM/PRD.md has no "## Problem Statement" heading)');
    expect(line).not.toContain("FitTrack");
  });

  it("(g) .agents/SYSTEM/ wins over docs/ (the resolver's order)", () => {
    const root = tmp();
    write(root, "docs/PRD.md", "## Problem Statement\n\nThe docs copy.\n");
    write(root, ".agents/SYSTEM/PRD.md", `## Problem Statement\n\n${PARA}\n`);
    expect(b.describeProblemStatement(root)).toBe(`PROBLEM (.agents/SYSTEM/PRD.md): ${PARA}`);
  });
});

describe("P3: this repository", () => {
  it("states its own problem from .agents/SYSTEM/PRD.md, with no table", () => {
    const line = b.describeProblemStatement(REPO);
    expect(line.startsWith("PROBLEM (.agents/SYSTEM/PRD.md): ")).toBe(true);
    expect(line.length).toBeGreaterThan(60);
    expect(line).not.toContain("|");
  });
});

describe("P4: rendering", () => {
  const parsed = parseState(JSON.stringify(FIXTURE));
  if (!parsed.ok) throw new Error(parsed.error);
  const state: State = parsed.data;
  const input = (over: Partial<b.BriefingInput> = {}): b.BriefingInput => ({
    state,
    version: "9.9.9",
    seat: "developer",
    sessionNumber: 160,
    sessionNote: null,
    date: "2026-10-13",
    drift: [],
    serving: "Build abc1234 · current",
    usage: "Usage: GREEN → dispatches open",
    latestBrief: null,
    workingTree: "Working tree: clean",
    skills: "Skills: none",
    ...over,
  });
  const PROBLEM = `PROBLEM (.agents/SYSTEM/PRD.md): ${PARA}`;

  for (const budget of [false, true]) {
    const layout = budget ? "budgeted" : "default";
    it(`${layout}: the PROBLEM line sits immediately above OBJECTIVE`, () => {
      const lines = b.renderBriefing(input({ budget, problem: PROBLEM }));
      const at = lines.indexOf("OBJECTIVE");
      expect(at).toBeGreaterThan(0);
      if (budget) expect(lines[at - 1]).toBe(PROBLEM);
      else {
        // The default layout separates sections with one blank line: "", PROBLEM, "", OBJECTIVE.
        expect(lines.slice(at - 3, at + 1)).toEqual(["", PROBLEM, "", "OBJECTIVE"]);
        expect(lines[at - 4]).not.toBe("");
      }
      expect(lines.filter((l) => l.startsWith("PROBLEM")).length).toBe(1);
    });

    it(`${layout}: problem absent or null renders exactly as without the field`, () => {
      const without = b.renderBriefing(input({ budget }));
      expect(b.renderBriefing(input({ budget, problem: null }))).toEqual(without);
      expect(b.renderBriefing(input({ budget, problem: undefined }))).toEqual(without);
      expect(without.some((l) => l.startsWith("PROBLEM"))).toBe(false);
    });
  }
});

describe("P5: handleStart carries the line only where the repo opted in", { timeout: 120_000 }, () => {
  function project(flag: boolean): string {
    const root = tmp("t167-start-");
    execFileSync("git", ["init", "-q"], { cwd: root });
    execFileSync("git", ["config", "user.email", "t@example.invalid"], { cwd: root });
    execFileSync("git", ["config", "user.name", "t"], { cwd: root });
    writeFileSync(join(root, "package.json"), JSON.stringify({ version: "1.0.0" }));
    for (const [rel, body] of [["SYSTEM/SUMMARY.md", "# S\n"], ["TASKS/INBOX.md", "# I\n"], ["TASKS/task.md", "# T\n"], ["SESSIONS/next-session.md", "# N\n"]] as const) {
      write(root, join(".agents", rel), body);
    }
    write(root, ".agents/state.json", JSON.stringify(FIXTURE, null, 2) + "\n");
    write(root, ".agents/AGENT.local.md", ["---", "name: Fixture", "role: developer", "partner: Other", "---", ""].join("\n"));
    write(root, ".agents/SYSTEM/PRD.md", `# PRD\n\n## Problem Statement\n\n${PARA}\n`);
    if (flag) flagOn(root);
    execFileSync("git", ["add", "-A"], { cwd: root });
    execFileSync("git", ["commit", "-q", "-m", "seed"], { cwd: root });
    return root;
  }
  const blockOf = (text: string): string[] => {
    const lines = text.split("\n");
    return lines.slice(lines.indexOf(b.BRIEFING_START), lines.indexOf(b.BRIEFING_END) + 1);
  };

  it("flag on: the Briefing block holds the PROBLEM line", async () => {
    const text = (await srv.handleStart({ project_root: project(true) })).content[0]!.text;
    expect(blockOf(text)).toContain(`PROBLEM (.agents/SYSTEM/PRD.md): ${PARA}`);
  });

  it("flag off: no line starts with PROBLEM", async () => {
    const text = (await srv.handleStart({ project_root: project(false) })).content[0]!.text;
    const block = blockOf(text);
    expect(block.length).toBeGreaterThan(2);
    expect(block.some((l) => l.startsWith("PROBLEM"))).toBe(false);
  });
});

describe("P6: the budget", () => {
  it("BRIEFING_BUDGET is { lines: 31, chars: 4400 }", () => {
    expect(b.BRIEFING_BUDGET).toEqual({ lines: 31, chars: 4400 });
  });
});
