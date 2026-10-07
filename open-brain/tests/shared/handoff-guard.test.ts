/**
 * T179-2: a session that ends with committed loop work and no handoff WARNS,
 * and never blocks. Real git repositories throughout; the hook row runs the
 * real SessionEnd entry point with a real payload on stdin.
 */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, existsSync, readFileSync } from "node:fs";
import { endRecordProjectDir } from "../../src/shared/end-record-store.js";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { execFileSync, spawnSync } from "node:child_process";
import {
  checkSessionHandoff,
  sessionStartFromTranscript,
  sessionIdsFromTranscript,
  recordMissingHandoff,
  takeMissingHandoffNotices,
  describeMissing,
  MARKER_REL,
} from "../../src/shared/handoff-guard.js";
import { applyStateOps } from "../../src/shared/state-writer.js";

const tsxCli = join(import.meta.dirname, "../../node_modules/tsx/dist/cli.mjs");
const hookEntry = join(import.meta.dirname, "../../src/cli-session-end.ts");

function git(cwd: string, ...args: string[]): string {
  return execFileSync("git", args, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
}
/**
 * Commit with an explicit committer date, so the session window is exact. T-212: a commit is
 * this session's by its Claude-Session TRAILER (default: this session's), never by author;
 * pass null for a commit with no trailer.
 */
function commitAt(dir: string, when: string, file: string, msg: string, trailer: string | null = ME_TRAILER, author = "T"): string {
  mkdirSync(join(dir, file, ".."), { recursive: true });
  writeFileSync(join(dir, file), `${msg}\n`);
  git(dir, "add", "-A");
  execFileSync("git", ["-c", "user.email=t@example.com", "-c", "user.name=" + author, "commit", "-q", "-m", msg, ...(trailer === null ? [] : ["-m", trailer])], {
    cwd: dir, stdio: "ignore", env: { ...process.env, GIT_COMMITTER_DATE: when, GIT_AUTHOR_DATE: when },
  });
  return git(dir, "rev-parse", "HEAD");
}

// T-212: this session's id as the trailer carries it (https://claude.ai/code/session_<X>), and another seat's.
const ME = "01MeMeMeMeMeMeMeMeMeMeMe";
const OTHER = "01OtherOtherOtherOtherOth";
const ME_TRAILER = `Claude-Session: https://claude.ai/code/session_${ME}`;
const OTHER_TRAILER = `Claude-Session: https://claude.ai/code/session_${OTHER}`;
const IDS = [ME];

const BEFORE = "2026-09-25T10:00:00Z";
const START = "2026-09-25T12:00:00.000Z";
const DURING = "2026-09-25T13:00:00Z";

describe("handoff guard (T179-2)", () => {
  let dir: string;
  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "t179-guard-"));
    process.env.KNOWLEDGE_V2_DB = join(dir, "scratch.db");
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
    const c = checkSessionHandoff(dir, START, IDS);
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
    const c = checkSessionHandoff(dir, START, IDS);
    expect(c.status).toBe("ok");
    expect(c.handoffs).toEqual(["docs/loops/t179-developer-handoff.md"]);
    expect(c.branches.sort()).toEqual(["loop/t179-end", "loop/t179-mut-key", "loop/t179-redcheck"]);
  });

  it("a commit BEFORE the session started is not this session's", () => {
    git(dir, "checkout", "-q", "-b", "loop/old");
    commitAt(dir, BEFORE, "src/a.ts", "yesterday's work");
    expect(checkSessionHandoff(dir, START, IDS).status).toBe("no-work");
  });

  it("a handoff committed BEFORE the session does not cover this session's work", () => {
    git(dir, "checkout", "-q", "-b", "loop/x");
    commitAt(dir, BEFORE, "docs/loops/x-developer-handoff.md", "an earlier session's handoff");
    commitAt(dir, DURING, "src/a.ts", "this session's work");
    expect(checkSessionHandoff(dir, START, IDS).status).toBe("missing");
  });

  it("T-246 END-FIX r2: master work with set_handoff is ok (E2 record, not loop handoff only)", () => {
    commitAt(dir, DURING, "src/on-master.ts", "worth-it style work on master");
    const uuid = "00000137-0000-4000-8000-00000000aaaa";
    mkdirSync(join(dir, ".agents", "TASKS"), { recursive: true });
    mkdirSync(join(dir, ".agents", "SYSTEM"), { recursive: true });
    writeFileSync(join(dir, ".agents", "TASKS", "INBOX.md"), "# Inbox\n");
    writeFileSync(join(dir, ".agents", "TASKS", "task.md"), "# Task\n");
    writeFileSync(join(dir, ".agents", "SYSTEM", "SUMMARY.md"), "# Summary\n");
    const statePath = join(import.meta.dirname, "../fixtures-state/state.json");
    writeFileSync(join(dir, ".agents", "state.json"), readFileSync(statePath, "utf8"));
    const rev = JSON.parse(readFileSync(join(dir, ".agents", "state.json"), "utf8")).revision as number;
    applyStateOps(dir, {
      session: 99,
      expected_revision: rev,
      session_uuid: uuid,
      checkout: "sia-test",
      ops: [{ op: "set_handoff", seat: "developer", pick_up: "pick up", watch_out: [], open_questions: [] }],
    });
    const c = checkSessionHandoff(dir, START, IDS, uuid);
    expect(c.status).toBe("ok");
    expect(c.commits).toBe(1);
    expect(c.handoffs.length).toBeGreaterThan(0);
  });

  it("a handoff under another name is NOT recognised (a stated limit, pinned so it cannot change silently)", () => {
    git(dir, "checkout", "-q", "-b", "loop/x");
    commitAt(dir, DURING, "docs/loops/x-notes.md", "notes, not a handoff");
    expect(checkSessionHandoff(dir, START, IDS).status).toBe("missing");
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

  describe("T-212: attribution by the Claude-Session trailer, never by git identity", () => {
    it("row 1: two seats share one git identity and the commits carry no trailer: UNATTRIBUTED, not blamed on this seat", () => {
      // This checkout's own git identity is the one the other seat's commits carry.
      git(dir, "config", "user.name", "Aaron Melven");
      git(dir, "checkout", "-q", "-b", "loop/rivet-work");
      commitAt(dir, DURING, "src/a.ts", "another seat's work", null, "Aaron Melven");
      commitAt(dir, DURING, "src/b.ts", "more of it", null, "Aaron Melven");
      const c = checkSessionHandoff(dir, START, IDS);
      expect(c.status).toBe("no-work");
      expect(c.commits).toBe(0);
      expect(c.unattributed).toBe(2);
      expect(c.branches).toEqual([]);
    });

    it("row 2: a trailer naming another seat's session is not counted against this seat", () => {
      git(dir, "checkout", "-q", "-b", "loop/other");
      commitAt(dir, DURING, "src/a.ts", "the other seat's work", OTHER_TRAILER);
      const c = checkSessionHandoff(dir, START, IDS);
      expect(c.status).toBe("no-work");
      expect(c.commits).toBe(0);
      expect(c.unattributed).toBe(0);
    });

    it("row 3: a trailer for this seat's session is still counted, mixed in with the others", () => {
      git(dir, "checkout", "-q", "-b", "loop/mixed");
      commitAt(dir, DURING, "src/a.ts", "the other seat's work", OTHER_TRAILER);
      commitAt(dir, DURING, "src/b.ts", "no trailer", null);
      commitAt(dir, DURING, "src/c.ts", "mine");
      const c = checkSessionHandoff(dir, START, IDS);
      expect(c.status).toBe("missing");
      expect(c.commits).toBe(1);
      expect(c.unattributed).toBe(1);
      expect(c.branches).toEqual(["loop/mixed"]);
    });

    it("a handoff committed by ANOTHER seat's session does not cover this session's work", () => {
      git(dir, "checkout", "-q", "-b", "loop/x");
      commitAt(dir, DURING, "src/a.ts", "mine");
      commitAt(dir, DURING, "docs/loops/x-developer-handoff.md", "the other seat's handoff", OTHER_TRAILER);
      expect(checkSessionHandoff(dir, START, IDS).status).toBe("missing");
    });

    it("UNKNOWN, saying why, when the transcript carries no session id: never a pass and never identity", () => {
      git(dir, "checkout", "-q", "-b", "loop/x");
      commitAt(dir, DURING, "src/a.ts", "work");
      const c = checkSessionHandoff(dir, START, []);
      expect(c.status).toBe("unknown");
      expect(c.reason).toMatch(/never by git identity/);
    });

    it("reads this session's id from the transcript's bridge-session line", () => {
      const t = join(dir, "t.jsonl");
      writeFileSync(t, ['{"type":"summary"}', `{"type":"bridge-session","bridgeSessionId":"cse_${ME}"}`].join("\n"));
      expect(sessionIdsFromTranscript(t)).toEqual([ME]);
      expect(sessionIdsFromTranscript(join(dir, "absent.jsonl"))).toEqual([]);
      expect(sessionIdsFromTranscript(undefined)).toEqual([]);
    });
  });

  it("the warning is recorded for the next greeting and shown ONCE", () => {
    git(dir, "checkout", "-q", "-b", "loop/x");
    commitAt(dir, DURING, "src/a.ts", "work");
    const c = checkSessionHandoff(dir, START, IDS);
    recordMissingHandoff(dir, "u-1", c);
    const storeDir = endRecordProjectDir(dir);
    expect(existsSync(join(storeDir, ".missing-handoff.jsonl"))).toBe(true);
    expect(existsSync(join(dir, MARKER_REL))).toBe(false);
    const first = takeMissingHandoffNotices(dir);
    expect(first).toHaveLength(1);
    expect(first[0]).toContain("HANDOFF MISSING: session u-1");
    expect(takeMissingHandoffNotices(dir)).toEqual([]);
    expect(readFileSync(join(storeDir, ".missing-handoff.shown.jsonl"), "utf8")).toContain("u-1");
  });
});

describe("the SessionEnd hook runs the guard and NEVER blocks (T179-2)", () => {
  let dir: string;
  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "t179-hook-"));
    process.env.KNOWLEDGE_V2_DB = join(dir, "scratch.db");
  });
  afterEach(() => rmSync(dir, { recursive: true, force: true, maxRetries: 3, retryDelay: 50 }));

  function hook(payload: Record<string, unknown>) {
    return spawnSync(process.execPath, [tsxCli, hookEntry], {
      cwd: dir,
      input: JSON.stringify(payload),
      encoding: "utf8",
      timeout: 90_000,
      // No DB at this path, so the memory stages exit early AFTER the guard ran.
      env: { ...process.env, CLAUDE_PROJECT_DIR: dir, KNOWLEDGE_V2_DB: join(dir, "scratch.db") },
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
    writeFileSync(transcript, `{"timestamp":"${START}"}\n{"type":"bridge-session","bridgeSessionId":"cse_${ME}"}\n`);

    const r = hook({ session_id: "11111111-2222-4333-8444-555555555555", transcript_path: transcript, hook_event_name: "SessionEnd", reason: "clear" });
    expect(r.status, r.stdout + r.stderr).toBe(0);
    expect(r.stdout).toContain("HANDOFF MISSING: session 11111111-2222-4333-8444-555555555555 committed 1 commit(s) on loop/x");
    expect(r.stderr).toContain("HANDOFF MISSING");
    expect(existsSync(join(endRecordProjectDir(dir), ".missing-handoff.jsonl"))).toBe(true);
    expect(existsSync(join(dir, MARKER_REL))).toBe(false);
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
