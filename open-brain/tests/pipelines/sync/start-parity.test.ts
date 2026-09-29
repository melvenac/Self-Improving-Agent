import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
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
