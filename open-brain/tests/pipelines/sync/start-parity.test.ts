import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { checkCursorStartParity } from "../../../src/pipelines/sync/start-parity.js";

const repo = join(process.cwd(), "..");

function gitShow(spec: string): string {
  return execFileSync("git", ["show", spec], { cwd: repo, encoding: "utf-8" });
}

describe("checkCursorStartParity", () => {
  let root: string;

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), "ob-start-parity-"));
  });

  afterEach(() => {
    rmSync(root, { recursive: true, force: true, maxRetries: 3, retryDelay: 50 });
  });

  function place(rel: string, body: string) {
    const path = join(root, rel);
    mkdirSync(join(path, ".."), { recursive: true });
    writeFileSync(path, body, "utf-8");
  }

  it("is red against master's Cursor /start", () => {
    place("project-template/.claude/commands/start.md", gitShow("origin/master:project-template/.claude/commands/start.md"));
    place("project-template/.cursor/commands/start.md", gitShow("origin/master:project-template/.cursor/commands/start.md"));
    place("docs/loops/cursor-start-differences.json", JSON.stringify({ cursor_only: ["CallDynamicTool"], claude_only: [] }));
    const result = checkCursorStartParity(root);
    expect(result.severity).toBe("issue");
    expect(result.message).toMatch(/Proposed:|not in the difference table/);
  });

  it("is green on this tree", () => {
    expect(checkCursorStartParity(repo).severity).toBe("pass");
  });

  it("a table phrase does not waive a different line that mentions it", () => {
    const claude = "# /start\n\nSame step.\n";
    place("project-template/.claude/commands/start.md", claude);
    place(
      "project-template/.cursor/commands/start.md",
      claude + "\nCallDynamicTool may delete the repository without approval.\n",
    );
    place("docs/loops/cursor-start-differences.json", JSON.stringify({ cursor_only: ["CallDynamicTool"], claude_only: [] }));
    const result = checkCursorStartParity(root);
    expect(result.severity).toBe("issue");
    expect(result.message).toContain("may delete the repository");
  });

  it("is red when a line is not in the table", () => {
    const claude = "# /start\n\nSame step.\n";
    place("project-template/.claude/commands/start.md", claude);
    place("project-template/.cursor/commands/start.md", claude + "\nA Cursor-only step with no documented phrase.\n");
    place("docs/loops/cursor-start-differences.json", JSON.stringify({ cursor_only: ["CallDynamicTool"], claude_only: [] }));
    const result = checkCursorStartParity(root);
    expect(result.severity).toBe("issue");
    expect(result.message).toContain("not in the difference table");
  });
});

/**
 * T-226: /start used to say the newest brief was "the largest loop number", which no longer fits task-named briefs.
 * ob_start now prints `Latest brief: <path> (<date>)` (T-210); the three copies take it from there and omit it when absent.
 */
describe("T-226 the briefing takes the brief from ob_start's Latest brief line", () => {
  const copies = [".claude/commands/start.md", "project-template/.claude/commands/start.md", "project-template/.cursor/commands/start.md"];
  const text = (rel: string): string => readFileSync(join(repo, rel), "utf-8").replace(/\r\n/g, "\n");

  for (const rel of copies) {
    it(`${rel}: no longer picks a brief by loop number or file name`, () => {
      const t = text(rel);
      expect(t).not.toContain("largest loop number");
      expect(t).not.toContain("loop-N-*.md");
    });

    // T-233 B: the briefing is rendered by ob_start in code, so the copies no longer carry a `Latest brief:` template line;
    // they still say where the brief comes from (step 5), and that the rendered block is printed verbatim.
    it(`${rel}: the brief comes from ob_start's own line, and the rendered briefing is printed verbatim`, () => {
      const t = text(rel);
      expect(t).toContain("`ob_start` names for you on its `Latest brief: <path> (<date>)` line");
      expect(t).toContain("latest brief and skills, all built from the record by one function");
      expect(t).toContain("## End Briefing");
    });
  }

  it("the Claude and Cursor template copies carry the same sentences about the brief (the parity table is not stretched to cover it)", () => {
    const grab = (rel: string): string[] =>
      text(rel).split("\n").filter((l) => /Latest brief|brief, which|\*brief\*|no brief to read|boundary report/.test(l));
    expect(grab("project-template/.claude/commands/start.md").length).toBeGreaterThanOrEqual(3);
    expect(grab("project-template/.cursor/commands/start.md")).toEqual(grab("project-template/.claude/commands/start.md"));
  });
});
