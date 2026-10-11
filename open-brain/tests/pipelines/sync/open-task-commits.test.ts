/**
 * T-256 rows (docs/loops/t256-stale-open-task-check-brief.md): /sync warns when a CODE commit on HEAD names an
 * open or in_progress task. Every row is a real git repository in a temp dir.
 */
import { describe, it, expect, afterEach } from "vitest";
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";
import { tmpdir } from "node:os";
import { execFileSync } from "node:child_process";
import { checkOpenTaskCommits } from "../../../src/pipelines/sync/open-task-commits.js";
import { execRunner, type CommandRunner } from "../../../src/pipelines/sync/checks-state.js";

const tmps: string[] = [];
afterEach(() => {
  for (const d of tmps.splice(0)) rmSync(d, { recursive: true, force: true, maxRetries: 3, retryDelay: 50 });
});
function tmp(prefix: string): string {
  const d = mkdtempSync(join(tmpdir(), prefix));
  tmps.push(d);
  return d;
}
function git(cwd: string, ...args: string[]): string {
  return execFileSync("git", args, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
}
function repo(prefix: string): string {
  const d = tmp(prefix);
  git(d, "init", "-q", "-b", "master");
  return d;
}
let n = 0;
/** Writes each listed file, adds ONLY those files, commits with `subject`, returns the full sha. */
function commitFiles(dir: string, subject: string, files: string[]): string {
  for (const f of files) {
    mkdirSync(dirname(join(dir, f)), { recursive: true });
    writeFileSync(join(dir, f), `${subject} ${++n}\n`);
  }
  git(dir, "add", "--", ...files);
  git(dir, "-c", "user.email=t@example.com", "-c", "user.name=T", "commit", "-q", "-m", subject);
  return git(dir, "rev-parse", "HEAD");
}
type T = { id: string; status: string; note: string };
/** The check reads .agents/state.json as JSON; it is never committed (commitFiles adds only listed files). */
function writeState(dir: string, tasks: T[]): void {
  mkdirSync(join(dir, ".agents"), { recursive: true });
  writeFileSync(join(dir, ".agents", "state.json"), JSON.stringify({ tasks }, null, 2) + "\n");
}
const TAIL = 'Suppress one with "stays open after <sha7>" in its note';
const hit = (id: string, status: string, sha: string, subject: string) =>
  `${id} is ${status} but ${sha.slice(0, 7)} '${subject}' on HEAD touches code; close it with evidence or note why it stays open`;

describe("T-256: open-task-commits", () => {
  it("T256-1 warns on the newest code commit naming each open or in_progress task", () => {
    const d = repo("t256-1-");
    writeState(d, [{ id: "T-7", status: "open", note: "" }, { id: "T-8", status: "in_progress", note: "" }]);
    commitFiles(d, "init", ["src/seed.ts"]);
    commitFiles(d, "T-7: first", ["src/a.ts"]);
    const c2 = commitFiles(d, "T-8 and T-7: second", ["open-brain/src/b.ts"]);
    const r = checkOpenTaskCommits(d);
    expect(r).toEqual({
      name: "open-task-commits",
      report: true,
      severity: "warn",
      message: `2 open task(s) named by a code commit: ${hit("T-7", "open", c2, "T-8 and T-7: second")} | ${hit("T-8", "in_progress", c2, "T-8 and T-7: second")}. scanned 3 non-merge commits (bound 1500) against 2 open/in_progress task(s). ${TAIL}`,
    });
  });

  it("T256-2 docs-only commits do not trip it", () => {
    const d = repo("t256-2-");
    writeState(d, [{ id: "T-7", status: "open", note: "" }]);
    commitFiles(d, "init", ["src/seed.ts"]);
    commitFiles(d, "docs: T-7 brief", ["docs/loops/t7.md", ".agents/notes.json", "README.md", "open-brain/NOTES.md"]);
    commitFiles(d, "docs: T-7 round 2", ["docs/tools/x.ts"]);
    const r = checkOpenTaskCommits(d);
    expect(r.severity).toBe("pass");
    expect(r.message).toMatch(/^0 open tasks named by a code commit; scanned 3 non-merge commits \(bound 1500\) against 1 open\/in_progress task\(s\)\. LIMIT: subjects only, merges skipped/);
  });

  it("T256-3 done and blocked never warn", () => {
    const d = repo("t256-3-");
    writeState(d, [{ id: "T-7", status: "done", note: "" }, { id: "T-8", status: "blocked", note: "" }, { id: "T-9", status: "open", note: "" }]);
    commitFiles(d, "init", ["src/seed.ts"]);
    commitFiles(d, "T-7: fix", ["src/a.ts"]);
    commitFiles(d, "T-8: part", ["src/b.ts"]);
    const r = checkOpenTaskCommits(d);
    expect(r.severity).toBe("pass");
    expect(r.message).toMatch(/^0 open tasks named by a code commit; scanned 3 non-merge commits \(bound 1500\) against 1 open\/in_progress task\(s\)\./);
  });

  it("T256-4 matches whole-word ids only", () => {
    const d = repo("t256-4-");
    writeState(d, [{ id: "T-24", status: "open", note: "" }, { id: "T-245", status: "done", note: "" }]);
    commitFiles(d, "init", ["src/seed.ts"]);
    commitFiles(d, "T-245: done work", ["src/a.ts"]);
    commitFiles(d, "QAT-24 thing", ["src/b.ts"]);
    commitFiles(d, "t-24 lowercase", ["src/c.ts"]);
    const r1 = checkOpenTaskCommits(d);
    expect(r1.severity).toBe("pass");
    expect(r1.message).toMatch(/^0 open tasks named by a code commit; scanned 4 non-merge commits/);
    const cd = commitFiles(d, "fix (T-24)", ["src/d.ts"]);
    const r2 = checkOpenTaskCommits(d);
    expect(r2.severity).toBe("warn");
    expect(r2.message).toContain(hit("T-24", "open", cd, "fix (T-24)"));
  });

  it("T256-5 suppression keys on the newest commit", () => {
    const d = repo("t256-5-");
    writeState(d, [{ id: "T-7", status: "open", note: "" }]);
    commitFiles(d, "init", ["src/seed.ts"]);
    const c1 = commitFiles(d, "T-7: partial", ["src/a.ts"]);
    const r1 = checkOpenTaskCommits(d);
    expect(r1.severity).toBe("warn");
    expect(r1.message).toContain(hit("T-7", "open", c1, "T-7: partial"));
    writeState(d, [{ id: "T-7", status: "open", note: `part 1 landed; stays open after ${c1.slice(0, 7)} for the CLI half` }]);
    const r2 = checkOpenTaskCommits(d);
    expect(r2.severity).toBe("pass");
    const c2 = commitFiles(d, "T-7: CLI half", ["src/cli.ts"]);
    const r3 = checkOpenTaskCommits(d);
    expect(r3.severity).toBe("warn");
    expect(r3.message).toContain(hit("T-7", "open", c2, "T-7: CLI half"));
    expect(r3.message).not.toContain(c1.slice(0, 7));
  });

  it("T256-6 skips with a reason", () => {
    // (a) not a git repository, with a ceiling so an enclosing repo cannot be found
    const da = tmp("t256-6a-");
    writeState(da, [{ id: "T-7", status: "open", note: "" }]);
    const prev = process.env.GIT_CEILING_DIRECTORIES;
    process.env.GIT_CEILING_DIRECTORIES = dirname(da);
    try {
      const ra = checkOpenTaskCommits(da);
      expect(ra.severity).toBe("skip");
      expect(ra.message).toMatch(/^skipped — not a git repository \(.+\); open-task commits: unknown$/);
    } finally {
      if (prev === undefined) delete process.env.GIT_CEILING_DIRECTORIES;
      else process.env.GIT_CEILING_DIRECTORIES = prev;
    }
    // (b) git not installed
    const rb = checkOpenTaskCommits(da, () => ({ ok: false, error: "git not found (ENOENT)" }));
    expect(rb.message).toBe("skipped — git is not installed; open-task commits: unknown");
    // (c) shallow clone
    const dc = repo("t256-6c-");
    writeState(dc, [{ id: "T-7", status: "open", note: "" }]);
    commitFiles(dc, "init", ["src/seed.ts"]);
    commitFiles(dc, "T-7: x", ["src/a.ts"]);
    writeFileSync(join(dc, ".git", "shallow"), git(dc, "rev-parse", "HEAD") + "\n");
    const rc = checkOpenTaskCommits(dc);
    expect(rc).toEqual({
      name: "open-task-commits",
      report: true,
      severity: "skip",
      message: "skipped — shallow clone, the history this check reads is not here (fetch full history to run it); open-task commits: unknown",
    });
    // (d) no state file
    const dd = tmp("t256-6d-");
    const rd = checkOpenTaskCommits(dd);
    expect(rd.message).toBe("skipped — no .agents/state.json; open-task commits: unknown");
  });

  it("T256-7 runs two git calls however many tasks are open", () => {
    const d = repo("t256-7-");
    writeState(d, ["T-1", "T-2", "T-3", "T-4", "T-5"].map((id) => ({ id, status: "open", note: "" })));
    commitFiles(d, "T-1: a", ["src/a.ts"]);
    commitFiles(d, "T-2: b", ["src/b.ts"]);
    commitFiles(d, "T-3: c", ["src/c.ts"]);
    const calls: Array<{ cmd: string; args: string[] }> = [];
    const counting: CommandRunner = (cmd, args, cwd) => {
      calls.push({ cmd, args });
      return execRunner(cmd, args, cwd);
    };
    const r = checkOpenTaskCommits(d, counting);
    expect(r.severity).toBe("warn");
    expect(r.message).toMatch(/^3 open task\(s\) named by a code commit: /);
    expect(calls).toEqual([
      { cmd: "git", args: ["rev-parse", "--is-shallow-repository"] },
      { cmd: "git", args: ["-c", "core.quotepath=off", "log", "--no-merges", "--max-count=1500", "--name-only", "--format=%x1e%H%x1f%s", "HEAD"] },
    ]);
  });

  it("T256-8 runSync is wired to checkOpenTaskCommits", () => {
    const needle = "checks.push(checkOpenTaskCommits(options.projectRoot))";
    const wired = (src: string) => src.split("\n").some((line) => {
      const trimmed = line.trim();
      return trimmed.length > 0
        && !trimmed.startsWith("//")
        && !trimmed.startsWith("*")
        && !trimmed.startsWith("/*")
        && trimmed.includes(needle);
    });
    expect(wired(`${needle};`)).toBe(true);
    expect(wired(`// ${needle};`)).toBe(false);
    const src = readFileSync(join(import.meta.dirname, "../../../src/pipelines/sync/index.ts"), "utf8");
    expect(wired(src)).toBe(true);
  });
});
