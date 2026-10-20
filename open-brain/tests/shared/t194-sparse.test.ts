import { describe, it, expect, afterAll } from "vitest";
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { citedGapIds, citedTaskIds } from "../../src/shared/state-writer.js";

/**
 * T-194 sparse planner checkout: the retention and gap-id scans must cite the same ids in a sparse checkout as in a
 * full one. A worktree `git grep` skips files outside the cone; the index still holds them.
 */
const made: string[] = [];
afterAll(() => {
  for (const d of made) rmSync(d, { recursive: true, force: true, maxRetries: 3, retryDelay: 50 });
});
const git = (cwd: string, ...args: string[]): void => {
  execFileSync("git", ["-c", "user.name=t", "-c", "user.email=t@t", ...args], { cwd, stdio: "ignore" });
};

/** A committed repo: src/cite.ts cites T-901 and G-901, docs/note.md cites T-902. */
function repo(): string {
  const root = mkdtempSync(join(tmpdir(), "t194-sparse-"));
  made.push(root);
  git(root, "init", "-q", "-b", "master");
  mkdirSync(join(root, "src"));
  mkdirSync(join(root, "docs"));
  writeFileSync(join(root, "src", "cite.ts"), "// T-901 and G-901\n");
  writeFileSync(join(root, "docs", "note.md"), "see T-902\n");
  git(root, "add", "-A");
  git(root, "commit", "-q", "-m", "fixture");
  return root;
}

describe("T-194: the citation scans read past a sparse checkout's cone", () => {
  it("R1: in a sparse checkout (cone: docs) a task id cited only in src/ is still cited", () => {
    const root = repo();
    git(root, "sparse-checkout", "set", "--cone", "docs");
    expect(readdirSync(root)).not.toContain("src");
    const cited = citedTaskIds(root);
    expect(cited.get("T-901")).toEqual(["src/cite.ts"]);
    expect(cited.get("T-902")).toEqual(["docs/note.md"]);
  });

  it("R2: in a full checkout an unstaged edit to a tracked file still cites its id", () => {
    const root = repo();
    writeFileSync(join(root, "docs", "note.md"), "see T-902 and T-903\n");
    const cited = citedTaskIds(root);
    expect(cited.get("T-903")).toEqual(["docs/note.md"]);
    expect(cited.get("T-901")).toEqual(["src/cite.ts"]);
  });

  it("R3: in a sparse checkout a gap id cited only in src/ is still cited, so add_gap cannot reuse it", () => {
    const root = repo();
    git(root, "sparse-checkout", "set", "--cone", "docs");
    const scan = citedGapIds(root);
    expect(scan.ok).toBe(true);
    if (!scan.ok) return;
    expect(scan.cited.get("G-901")).toEqual(["src/cite.ts"]);
  });
});
