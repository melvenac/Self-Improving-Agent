/**
 * T-193. Real git worktrees in a scratch repository. The rows are the final
 * rows: a loop-named folder is an issue, the main checkout and a seat folder
 * pass, a missing seat file is a skip, and a different seat list is what the
 * check reads.
 */
import { describe, it, expect, afterEach } from "vitest";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { execFileSync } from "node:child_process";
import { checkWorktreeLayout, WORKTREE_SEATS_REL } from "../../../src/pipelines/sync/worktree-layout.js";

const LIMIT =
  "LIMIT: sees registered worktrees only. An orphan directory with no git registration is not seen.";

const SIA_SEATS = ["planner", "builder", "forge", "infra", "research", "qa"];

function git(cwd: string, ...args: string[]): string {
  return execFileSync("git", args, {
    cwd,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    windowsHide: true,
  }).trim();
}

function commitAll(cwd: string, msg: string): void {
  git(cwd, "add", "-A");
  execFileSync("git", ["-c", "user.email=t@example.com", "-c", "user.name=T", "commit", "-q", "-m", msg], {
    cwd,
    stdio: ["ignore", "pipe", "pipe"],
    windowsHide: true,
  });
}

function writeSeats(root: string, project: string, seats: string[]): void {
  const full = join(root, ...WORKTREE_SEATS_REL.split("/"));
  mkdirSync(join(full, ".."), { recursive: true });
  writeFileSync(full, `${JSON.stringify({ project, seats }, null, 2)}\n`);
}

function porcelainCount(main: string): number {
  return git(main, "worktree", "list", "--porcelain")
    .split(/\r?\n/)
    .filter((l) => l.startsWith("worktree ")).length;
}

interface Fixture {
  parent: string;
  main: string;
}

function initMain(): Fixture {
  const parent = mkdtempSync(join(tmpdir(), "wt-layout-"));
  const main = join(parent, "not-a-seat");
  mkdirSync(main);
  git(main, "init", "-q", "-b", "master");
  writeFileSync(join(main, "README"), "x\n");
  commitAll(main, "init");
  return { parent, main };
}

function addWorktree(main: string, parent: string, folder: string, branch: string): string {
  const dest = join(parent, folder);
  git(main, "worktree", "add", "-q", "-b", branch, dest);
  return dest;
}

function destroy(f: Fixture): void {
  try {
    const paths = git(f.main, "worktree", "list", "--porcelain")
      .split(/\r?\n/)
      .filter((l) => l.startsWith("worktree "))
      .map((l) => l.slice("worktree ".length));
    for (const p of paths.slice(1)) {
      try {
        git(f.main, "worktree", "remove", "--force", p);
      } catch {
        // The parent remove below still deletes the directory.
      }
    }
  } catch {
    // Not a repository, or already removed.
  }
  rmSync(f.parent, { recursive: true, force: true, maxRetries: 5, retryDelay: 50 });
}

describe("checkWorktreeLayout", () => {
  const fixtures: Fixture[] = [];
  afterEach(() => {
    for (const f of fixtures.splice(0)) destroy(f);
  });

  it("a loop-named folder is an ISSUE naming the folder, its branch, and why; the seat folder is not", () => {
    const f = initMain();
    fixtures.push(f);
    writeSeats(f.main, "sia", SIA_SEATS);
    commitAll(f.main, "seats");
    const seat = addWorktree(f.main, f.parent, "sia-qa", "seat");
    addWorktree(f.main, f.parent, "loop-t193", "loop/bad");
    const walked = porcelainCount(f.main);
    expect(walked).toBe(3);

    for (const root of [f.main, seat]) {
      const r = checkWorktreeLayout(root);
      expect(r.name).toBe("worktree-layout");
      expect(r.report).toBe(true);
      expect(r.severity, `${r.severity}: ${r.message}`).toBe("issue");
      expect(r.message).toContain('folder "loop-t193"');
      expect(r.message).toContain("branch refs/heads/loop/bad");
      expect(r.message).toContain('is not "sia"-<seat>');
      expect(r.message).toContain(`Walked ${walked}`);
      expect(r.message).toContain(LIMIT);
      expect(r.message).not.toContain('folder "sia-qa"');
      expect(r.message).not.toContain('folder "not-a-seat"');
    }
  });

  it("the main checkout and a seat folder pass, and the walked count is the porcelain count", () => {
    const f = initMain();
    fixtures.push(f);
    writeSeats(f.main, "sia", SIA_SEATS);
    addWorktree(f.main, f.parent, "sia-builder", "seat-builder");
    // Registered nowhere. The check must not count it and must not name it.
    mkdirSync(join(f.parent, "sia-qa2-gpt-cand"));
    const walked = porcelainCount(f.main);
    expect(walked).toBe(2);

    const r = checkWorktreeLayout(f.main);
    expect(r.severity, `${r.severity}: ${r.message}`).toBe("pass");
    expect(r.report).toBe(true);
    expect(r.message).toContain(`Walked ${walked}`);
    expect(r.message).toContain('or "sia"-<seat>');
    expect(r.message).toContain(LIMIT);
    expect(r.message).not.toContain("sia-qa2-gpt-cand");
    expect(r.message).not.toContain('folder "not-a-seat"');
  });

  it("a project with no seat file is a SKIP, never a pass", () => {
    const f = initMain();
    fixtures.push(f);
    addWorktree(f.main, f.parent, "loop-t193", "loop/bad");

    const r = checkWorktreeLayout(f.main);
    expect(r.severity, `${r.severity}: ${r.message}`).toBe("skip");
    expect(r.severity).not.toBe("pass");
    expect(r.report).toBe(true);
    expect(r.message).toContain(".agents/SYSTEM/worktree-seats.json");
    expect(r.message).toContain("not a pass");
    expect(r.message).toContain("not classified");
    expect(r.message).toContain(LIMIT);
  });

  it("a different seat list is what passes — proj-alpha is accepted when the file says so", () => {
    const f = initMain();
    fixtures.push(f);
    writeSeats(f.main, "proj", ["alpha"]);
    addWorktree(f.main, f.parent, "proj-alpha", "alpha");
    const walked = porcelainCount(f.main);
    expect(walked).toBe(2);

    const r = checkWorktreeLayout(f.main);
    expect(r.severity, `${r.severity}: ${r.message}`).toBe("pass");
    expect(r.message).toContain(`Walked ${walked}`);
    expect(r.message).toContain('or "proj"-<seat>');
    expect(r.message).toContain(LIMIT);
  });

  it("git failing to list worktrees is not a pass", () => {
    const parent = mkdtempSync(join(tmpdir(), "wt-layout-nogit-"));
    fixtures.push({ parent, main: parent });
    writeSeats(parent, "sia", SIA_SEATS);
    const r = checkWorktreeLayout(parent);
    expect(r.severity, `${r.severity}: ${r.message}`).toBe("issue");
    expect(r.severity).not.toBe("pass");
    expect(r.message).toContain("not a git repository");
    expect(r.message).toContain("not a pass");
    expect(r.message).toContain(LIMIT);
  });

  it("runSync is wired to checkWorktreeLayout", () => {
    const src = readFileSync(join(import.meta.dirname, "../../../src/pipelines/sync/index.ts"), "utf8");
    expect(src).toContain("checks.push(checkWorktreeLayout(options.projectRoot))");
  });
});
