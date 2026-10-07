/**
 * QA 290 L1: `--commit` → `install-commands` with no git commit between; step 8 status list.
 */
import { describe, it, expect, afterEach } from "vitest";
import { cli, cleanupTmps, preStateProject, importCommit, git } from "./import-cmds-harness.js";

function statusPaths(dir: string): string[] {
  const out = git(dir, "status", "--short", "--untracked-files=all");
  if (!out) return [];
  return out
    .split("\n")
    .map((line) => {
      const rest = line.slice(3).trim();
      if (rest.startsWith('"') && rest.endsWith('"')) return rest.slice(1, -1).replace(/\\/g, "/");
      const p = rest.replace(/\\/g, "/");
      return p.startsWith("agents/") ? `.${p}` : p;
    })
    .filter((p) => !p.startsWith(".agents/archive/"))
    .sort();
}

describe("QA290 L1: import path one Bootstrap SIA commit", () => {
  afterEach(() => cleanupTmps());

  it("commit then install-commands with no git commit between matches step 8 import-path list", () => {
    const dir = preStateProject();
    importCommit(dir);
    expect(cli(["bootstrap", "install-commands", dir], dir).status).toBe(0);
    expect(statusPaths(dir)).toEqual(
      [
        ".agents/SESSIONS/next-session.md",
        ".agents/SYSTEM/SUMMARY.md",
        ".agents/TASKS/INBOX.md",
        ".agents/TASKS/task.md",
        ".agents/state.json",
        ".claude/commands/end.md",
        ".claude/commands/start.md",
        ".claude/commands/sync.md",
        ".claude/commands/task.md",
      ].sort(),
    );
  });
});
