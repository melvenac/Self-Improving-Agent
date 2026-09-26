/**
 * T179-2: a session that ends with committed loop work and no handoff WARNS,
 * and never blocks. Real git repositories throughout; the hook row runs the
 * real SessionEnd entry point with a real payload on stdin.
 */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { execFileSync, spawnSync } from "node:child_process";
import {
  checkSessionHandoff,
  sessionStartFromTranscript,
  recordMissingHandoff,
  takeMissingHandoffNotices,
  describeMissing,
  MARKER_REL,
} from "../../src/shared/handoff-guard.js";

const tsxCli = join(import.meta.dirname, "../../node_modules/tsx/dist/cli.mjs");
const hookEntry = join(import.meta.dirname, "../../src/cli-session-end.ts");

function git(cwd: string, ...args: string[]): string {
  return execFileSync("git", args, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
}
/** Commit with an explicit committer date, so the session window is exact. */
function commitAt(dir: string, when: string, file: string, msg: string): string {
  mkdirSync(join(dir, file, ".."), { recursive: true });
  writeFileSync(join(dir, file), `${msg}\n`);
  git(dir, "add", "-A");
  execFileSync("git", ["-c", "user.email=t@example.com", "-c", "user.name=T", "commit", "-q", "-m", msg], {
    cwd: dir, stdio: "ignore", env: { ...process.env, GIT_COMMITTER_DATE: when, GIT_AUTHOR_DATE: when },
  });
  return git(dir, "rev-parse", "HEAD");
}

const BEFORE = "2026-09-25T10:00:00Z";
const START = "2026-09-25T12:00:00.000Z";
const DURING = "2026-09-25T13:00:00Z";

describe("handoff guard (T179-2)", () => {
  let dir: string;
  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "t179-guard-"));
    git(dir, "init", "-q", "-b", "master");
    mkdirSync(join(dir, ".agents", "SESSIONS"), { recursive: true });
    const base = commitAt(dir, BEFORE, "README.md", "base");
    git(dir, "update-ref", "refs/remotes/origin/master", base);
  });
  afterEach(() => rmSync(dir, { recursive: true, force: true, maxRetries: 3, retryDelay: 50 }));

  it("MISSING: commits on a loop/* branch in the session and no handoff — names the branch and the count", () => {
    git(dir, "checkout", "-q", "-b", "loop/t183-r2");
    commitAt(dir, DURING, "src/a.ts", "round 2 work");
    commitAt(dir, DURING, "src/b.ts", "a mutant's fix");
    const c = checkSessionHandoff(dir, START);
    expect(c.status).toBe("missing");
    expect(c.branches).toEqual(["loop/t183-r2"]);
    expect(c.commits).toBe(2);
    expect(describeMissing(c, "u-1")).toMatch(/^HANDOFF MISSING: session u-1 committed 2 commit\(s\) on loop\/t183-r2 since 2026-09-25T12:00:00\.000Z/);
  });

  it("OK: a handoff committed on ANY loop/* branch by the session covers its red-check and mutant branches", () => {
    git(dir, "checkout", "-q", "-b", "loop/t179-redcheck");
    commitAt(dir, DURING, "tests/red.test.ts", "red first");
    git(dir, "checkout", "-q", "-b", "loop/t179-mut-key");
    commitAt(dir, DURING, "src/mut.ts", "mutant");
    git(dir, "checkout", "-q", "-b", "loop/t179-end", "loop/t179-redcheck");
    commitAt(dir, DURING, "docs/loops/t179-developer-handoff.md", "handoff");
    const c = checkSessionHandoff(dir, START);
    expect(c.status).toBe("ok");
    expect(c.handoffs).toEqual(["docs/loops/t179-developer-handoff.md"]);
    expect(c.branches.sort()).toEqual(["loop/t179-end", "loop/t179-mut-key", "loop/t179-redcheck"]);
  });

  it("a commit BEFORE the session started is not this session's", () => {
    git(dir, "checkout", "-q", "-b", "loop/old");
    commitAt(dir, BEFORE, "src/a.ts", "yesterday's work");
    expect(checkSessionHandoff(dir, START).status).toBe("no-work");
  });

  it("a handoff committed BEFORE the session does not cover this session's work", () => {
    git(dir, "checkout", "-q", "-b", "loop/x");
    commitAt(dir, BEFORE, "docs/loops/x-developer-handoff.md", "an earlier session's handoff");
    commitAt(dir, DURING, "src/a.ts", "this session's work");
    expect(checkSessionHandoff(dir, START).status).toBe("missing");
  });

  it("work already on origin/master is not counted, and a non-loop branch is not checked", () => {
    git(dir, "checkout", "-q", "-b", "docs/notes");
    commitAt(dir, DURING, "docs/n.md", "a docs branch");
    git(dir, "checkout", "-q", "-b", "loop/merged");
    const sha = commitAt(dir, DURING, "src/a.ts", "merged already");
    git(dir, "update-ref", "refs/remotes/origin/master", sha);
    expect(checkSessionHandoff(dir, START).status).toBe("no-work");
  });

  it("a handoff under another name is NOT recognised (a stated limit, pinned so it cannot change silently)", () => {
    git(dir, "checkout", "-q", "-b", "loop/x");
    commitAt(dir, DURING, "docs/loops/x-notes.md", "notes, not a handoff");
    expect(checkSessionHandoff(dir, START).status).toBe("missing");
  });

  it("UNKNOWN, saying why, when the session's start is not known — never a pass", () => {
    const c = checkSessionHandoff(dir, null);
    expect(c.status).toBe("unknown");
    expect(c.reason).toMatch(/start could not be read/);
  });

  it("reads the session start from the FIRST timestamp in the transcript, skipping lines without one", () => {
    const t = join(dir, "t.jsonl");
    writeFileSync(t, ['{"type":"summary"}', "not json", '{"timestamp":"2026-09-25T12:00:00.000Z","type":"user"}', '{"timestamp":"2026-09-25T15:00:00.000Z"}'].join("\n"));
    expect(sessionStartFromTranscript(t)).toBe(START);
    expect(sessionStartFromTranscript(join(dir, "absent.jsonl"))).toBeNull();
    expect(sessionStartFromTranscript(undefined)).toBeNull();
  });

  it("the warning is recorded for the next greeting and shown ONCE", () => {
    git(dir, "checkout", "-q", "-b", "loop/x");
    commitAt(dir, DURING, "src/a.ts", "work");
    const c = checkSessionHandoff(dir, START);
    recordMissingHandoff(dir, "u-1", c);
    expect(existsSync(join(dir, MARKER_REL))).toBe(true);
    const first = takeMissingHandoffNotices(dir);
    expect(first).toHaveLength(1);
    expect(first[0]).toContain("HANDOFF MISSING: session u-1");
    expect(takeMissingHandoffNotices(dir)).toEqual([]);
    expect(readFileSync(join(dir, ".agents/SESSIONS/.missing-handoff.shown.jsonl"), "utf8")).toContain("u-1");
  });
});

describe("the SessionEnd hook runs the guard and NEVER blocks (T179-2)", () => {
  let dir: string;
  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "t179-hook-"));
  });
  afterEach(() => rmSync(dir, { recursive: true, force: true, maxRetries: 3, retryDelay: 50 }));

  function hook(payload: Record<string, unknown>) {
    return spawnSync(process.execPath, [tsxCli, hookEntry], {
      cwd: dir,
      input: JSON.stringify(payload),
      encoding: "utf8",
      timeout: 90_000,
      // No DB at this path, so the memory stages exit early AFTER the guard ran.
      env: { ...process.env, CLAUDE_PROJECT_DIR: dir, KNOWLEDGE_V2_DB: join(dir, "no-such.db") },
    });
  }

  it("warns on stdout AND stderr, records the marker, and exits 0", () => {
    git(dir, "init", "-q", "-b", "master");
    mkdirSync(join(dir, ".agents", "SESSIONS"), { recursive: true });
    const base = commitAt(dir, BEFORE, "README.md", "base");
    git(dir, "update-ref", "refs/remotes/origin/master", base);
    git(dir, "checkout", "-q", "-b", "loop/x");
    commitAt(dir, DURING, "src/a.ts", "work, no handoff");
    const transcript = join(dir, "t.jsonl");
    writeFileSync(transcript, `{"timestamp":"${START}"}\n`);

    const r = hook({ session_id: "11111111-2222-4333-8444-555555555555", transcript_path: transcript, hook_event_name: "SessionEnd", reason: "clear" });
    expect(r.status, r.stdout + r.stderr).toBe(0);
    expect(r.stdout).toContain("HANDOFF MISSING: session 11111111-2222-4333-8444-555555555555 committed 1 commit(s) on loop/x");
    expect(r.stderr).toContain("HANDOFF MISSING");
    expect(existsSync(join(dir, MARKER_REL))).toBe(true);
  }, 120_000);

  it("outside a git repository it says NOT RUN and still exits 0", () => {
    mkdirSync(join(dir, ".agents"), { recursive: true });
    const transcript = join(dir, "t.jsonl");
    writeFileSync(transcript, `{"timestamp":"${START}"}\n`);
    const r = hook({ session_id: "u", transcript_path: transcript });
    expect(r.status, r.stdout + r.stderr).toBe(0);
    expect(r.stdout).toMatch(/handoff check NOT RUN/);
  }, 120_000);
});
