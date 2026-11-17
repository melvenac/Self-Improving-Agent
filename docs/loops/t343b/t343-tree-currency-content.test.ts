/**
 * T-343: the stale-tree warning counted commits, not content.
 *
 * Two greetings on 2026-11-17 printed THIS TREE IS STALE in capitals. One was 1 commit behind,
 * and the commit was the merge of the tree's own records PR: its tree was identical to HEAD's.
 * The other was 3 commits behind with the record at the same revision on both sides and one
 * workflow file different, under a line saying the record here describes an older state.
 *
 * Every row clones and commits with real git, as tree-currency.test.ts does and for its reason.
 * Rows 5 and 6 need a git call to FAIL after the commit count succeeded, which no real
 * repository does on request, so execFileSync is wrapped: it runs the real git unless the
 * row's gate refuses that call.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { appendFileSync, mkdtempSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { rm } from "node:fs/promises";
import { dirname, join } from "node:path";
import { tmpdir } from "node:os";
import { execFileSync } from "node:child_process";
import { describeTreeCurrency } from "../../../src/pipelines/session-start/tree-currency.js";

const gate = vi.hoisted(() => ({ refuse: null as ((args: string[]) => boolean) | null, refused: 0 }));

vi.mock("node:child_process", async (importOriginal) => {
  const m = await importOriginal<typeof import("node:child_process")>();
  const execFileSync = ((...a: unknown[]) => {
    const args = Array.isArray(a[1]) ? (a[1] as string[]) : [];
    if (a[0] === "git" && gate.refuse !== null && gate.refuse(args)) {
      gate.refused += 1;
      throw new Error("T343 gate: git refused");
    }
    return (m.execFileSync as (...x: unknown[]) => unknown)(...a);
  }) as typeof m.execFileSync;
  return { ...m, default: { ...m, execFileSync }, execFileSync };
});

const SPAWN_TIMEOUT_MS = 30_000;
const DRIFT = "Not the drift line: drift compares the rendered views to .agents/state.json within this tree.";
const STALE_TAIL = "Anything read from the record here describes an older state of the project than the one master carries.";
/** greeting-metrics.ts ALARM_PATTERNS.tree_stale, which is not exported. */
const TREE_STALE_ALARM = /^THIS TREE IS STALE/m;

function git(cwd: string, ...args: string[]): string {
  return execFileSync("git", args, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
}

function writeState(dir: string, revision: number): void {
  mkdirSync(join(dir, ".agents"), { recursive: true });
  writeFileSync(
    join(dir, ".agents", "state.json"),
    JSON.stringify(
      {
        schema_version: 1,
        revision,
        project: { name: "fixture" },
        objective: null,
        tasks: [],
        verified: [],
        gaps: [],
        decisions: [],
        handoff: { pick_up: "", watch_out: [], open_questions: [], session: 0 },
        last_session: { n: 0, date: "2026-01-01", uuid: null },
      },
      null,
      2
    ) + "\n"
  );
}

/** A bare origin, a seed that pushes to it, and a clone. With `record` false the repo has no .agents/ at all. */
function makeClone(root: string, record = true): { clone: string; seed: string } {
  const origin = join(root, "origin.git");
  const seed = join(root, "seed");
  const clone = join(root, "clone");
  mkdirSync(origin);
  mkdirSync(seed);
  git(origin, "init", "-q", "--bare", "-b", "master");
  git(seed, "init", "-q", "-b", "master");
  git(seed, "config", "user.email", "t@example.com");
  git(seed, "config", "user.name", "T");
  if (record) writeState(seed, 1);
  else writeFileSync(join(seed, "readme.md"), "no record here\n");
  git(seed, "add", "-A");
  git(seed, "commit", "-q", "-m", "seed");
  git(seed, "remote", "add", "origin", origin);
  git(seed, "push", "-q", "origin", "master");
  execFileSync("git", ["clone", "-q", origin, clone], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
  git(clone, "config", "user.email", "t@example.com");
  git(clone, "config", "user.name", "T");
  return { clone, seed };
}

/** One commit on origin/master that writes one file, WITHOUT fetching in the clone. */
function pushFile(seed: string, rel: string, text: string): void {
  mkdirSync(dirname(join(seed, rel)), { recursive: true });
  writeFileSync(join(seed, rel), text);
  git(seed, "add", "-A");
  git(seed, "commit", "-q", "-m", `write ${rel}`);
  git(seed, "push", "-q", "origin", "master");
}

/**
 * The first instance: the clone sits on a records branch at rev 2, and origin/master is the
 * merge commit of that branch. 1 commit behind, 0 ahead, the two trees identical.
 */
function mergedRecordsBranch(root: string): string {
  const { clone, seed } = makeClone(root);
  git(seed, "checkout", "-q", "-b", "side");
  writeState(seed, 2);
  git(seed, "add", "-A");
  git(seed, "commit", "-q", "-m", "records rev 2");
  git(seed, "push", "-q", "origin", "side");
  git(seed, "checkout", "-q", "master");
  git(seed, "merge", "-q", "--no-ff", "-m", "Merge the records branch", "side");
  git(seed, "push", "-q", "origin", "master");
  git(clone, "fetch", "-q", "origin");
  git(clone, "checkout", "-q", "--detach", "origin/side");
  return clone;
}

/** The second instance: 3 commits behind, all three to one workflow file, the record untouched at rev 1. */
function threeCodeCommitsBehind(root: string): string {
  const { clone, seed } = makeClone(root);
  pushFile(seed, ".github/workflows/ci.yml", "one\n");
  pushFile(seed, ".github/workflows/ci.yml", "two\n");
  pushFile(seed, ".github/workflows/ci.yml", "three\n");
  git(clone, "fetch", "-q", "origin");
  return clone;
}

const FAILED_FETCH = { ok: false, at: "2026-11-17T00:00:00.000Z", cause: "x" };

describe("T-343 the stale-tree warning reads content, not a commit count", { timeout: SPAWN_TIMEOUT_MS }, () => {
  let root: string;

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), "t343-"));
    gate.refuse = null;
    gate.refused = 0;
  });

  afterEach(async () => {
    gate.refuse = null;
    await rm(root, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 });
  });

  it("T343-1 one merge commit behind with an identical tree is level: no STALE line, the count stays visible", () => {
    const clone = mergedRecordsBranch(root);
    expect(git(clone, "rev-parse", "HEAD^{tree}")).toBe(git(clone, "rev-parse", "origin/master^{tree}"));

    const r = describeTreeCurrency(clone);
    expect(r.headBehind).toBe(1);
    expect(r.headAhead).toBe(0);
    expect(r.severity).toBe("current");
    expect(r.lines).toEqual([
      "Tree currency: level with origin/master (record here rev 2, at origin/master rev 2; 1 commit behind with the same content) " +
        `\u2014 compared against the last fetch (${r.lastFetchAt ?? "fetch time unknown"}), not the network. ${DRIFT}`,
    ]);
    expect(r.lines.join("\n")).not.toMatch(TREE_STALE_ALARM);
  });

  it("T343-2 three commits behind, same record, one other file: a calm line that says so, and no tree_stale alarm", () => {
    const clone = threeCodeCommitsBehind(root);

    const r = describeTreeCurrency(clone);
    expect(r.headBehind).toBe(3);
    expect(r.severity).toBe("behind-code");
    expect(r.lines).toEqual([
      "Tree currency: 3 commits behind origin/master, record current with origin/master " +
        "(record here rev 1, at origin/master rev 1); 1 non-record file differs. " +
        `Compared against the last fetch (${r.lastFetchAt ?? "fetch time unknown"}), not the network. ${DRIFT}`,
    ]);
    expect(r.lastFetchAt).not.toBeNull();
    const text = r.lines.join("\n");
    expect(text).not.toMatch(TREE_STALE_ALARM);
    expect(text).not.toContain("older state");
  });

  it("T343-3 same revision but a record file differs: the STALE warning", () => {
    const { clone, seed } = makeClone(root);
    pushFile(seed, "code.txt", "code\n");
    pushFile(seed, ".agents/TASKS/INBOX.md", "# inbox\n");
    git(clone, "fetch", "-q", "origin");

    const r = describeTreeCurrency(clone);
    expect(r.recordRevisionHere).toBe(1);
    expect(r.recordRevisionUpstream).toBe(1);
    expect(r.severity).toBe("behind");
    expect(r.lines).toHaveLength(3);
    expect(r.lines[0]).toBe(
      `THIS TREE IS STALE: 2 commits behind origin/master \u2014 record here rev 1, at origin/master rev 1. ${STALE_TAIL}`
    );
  });

  it("T343-4 the revision differs: all three STALE lines, byte for byte", () => {
    const { clone, seed } = makeClone(root);
    writeState(seed, 2);
    git(seed, "add", "-A");
    git(seed, "commit", "-q", "-m", "rev 2");
    git(seed, "push", "-q", "origin", "master");
    git(clone, "fetch", "-q", "origin");

    const r = describeTreeCurrency(clone);
    expect(r.severity).toBe("behind");
    expect(r.lines).toEqual([
      `THIS TREE IS STALE: 1 commit behind origin/master \u2014 record here rev 1, at origin/master rev 2. ${STALE_TAIL}`,
      "  This compares THIS CHECKOUT to origin/master. It is not the drift line: drift compares the rendered views to " +
        ".agents/state.json within this tree, and a stale tree is perfectly self-consistent.",
      `  Compared against the last fetch (${r.lastFetchAt ?? "fetch time unknown"}), not the network \u2014 run \`git fetch origin\` to refresh the comparison.`,
    ]);
  });

  it("T343-5 the tree hashes cannot be read: the STALE warning, not level", () => {
    const clone = mergedRecordsBranch(root);
    gate.refuse = (args) => args.some((x) => x.endsWith("^{tree}"));
    const r = describeTreeCurrency(clone);
    gate.refuse = null;

    expect(gate.refused).toBeGreaterThan(0);
    expect(r.severity).toBe("behind");
    expect(r.lines).toHaveLength(3);
    expect(r.lines[0]).toBe(
      `THIS TREE IS STALE: 1 commit behind origin/master \u2014 record here rev 2, at origin/master rev 2. ${STALE_TAIL}`
    );
  });

  it("T343-6 the file list cannot be read: the STALE warning, not the calm line", () => {
    const clone = threeCodeCommitsBehind(root);
    gate.refuse = (args) => args[0] === "diff";
    const r = describeTreeCurrency(clone);
    gate.refuse = null;

    expect(gate.refused).toBe(1);
    expect(r.severity).toBe("behind");
    expect(r.lines).toHaveLength(3);
    expect(r.lines[0]).toBe(
      `THIS TREE IS STALE: 3 commits behind origin/master \u2014 record here rev 1, at origin/master rev 1. ${STALE_TAIL}`
    );
  });

  it("T343-7 no record on either side and a file differs: the STALE warning, never 'record current'", () => {
    const { clone, seed } = makeClone(root, false);
    pushFile(seed, "code.txt", "code\n");
    git(clone, "fetch", "-q", "origin");

    const r = describeTreeCurrency(clone);
    expect(r.recordRevisionHere).toBeNull();
    expect(r.recordRevisionUpstream).toBeNull();
    expect(r.severity).toBe("behind");
    expect(r.lines[0]).toBe(
      `THIS TREE IS STALE: 1 commit behind origin/master \u2014 record here no record, at origin/master no record. ${STALE_TAIL}`
    );
  });

  it("T343-8 after a FAILED fetch the calm line does not say the record is current", () => {
    const clone = threeCodeCommitsBehind(root);

    const r = describeTreeCurrency(clone, { fetch: FAILED_FETCH });
    expect(r.severity).toBe("behind-code");
    expect(r.lines).toHaveLength(2);
    expect(r.lines[0]).toMatch(/^fetch FAILED: x; currency is against a fetch from /);
    expect(r.lines[1]).toContain(
      "Tree currency: 3 commits behind origin/master, record showing no difference from origin/master " +
        "(record here rev 1, at origin/master rev 1); 1 non-record file differs."
    );
    const text = r.lines.join("\n");
    expect(text).not.toContain("record current with");
    expect(text).not.toContain("level with");
    expect(text).not.toMatch(TREE_STALE_ALARM);
  });

  it("T343-9 after a FAILED fetch the identical-tree case reads 'no difference seen', never level", () => {
    const clone = mergedRecordsBranch(root);

    const r = describeTreeCurrency(clone, { fetch: FAILED_FETCH });
    expect(r.severity).toBe("current");
    expect(r.lines).toHaveLength(2);
    expect(r.lines[0]).toMatch(/^fetch FAILED: x; currency is against a fetch from /);
    expect(r.lines[1]).toContain(
      "Tree currency: no difference seen against origin/master (record here rev 2, at origin/master rev 2) as of that old fetch, and not confirmed since."
    );
    const text = r.lines.join("\n");
    expect(text).not.toContain("level with");
    expect(text).not.toMatch(TREE_STALE_ALARM);
  });

  it("T343-10 only code differs between the commits but the working copy's record is behind: the STALE warning", () => {
    const clone = threeCodeCommitsBehind(root);
    writeState(clone, 0); // uncommitted: the diff of the commits cannot see it, the revision read can

    const r = describeTreeCurrency(clone);
    expect(r.recordRevisionHere).toBe(0);
    expect(r.recordRevisionUpstream).toBe(1);
    expect(r.severity).toBe("behind");
    expect(r.lines[0]).toBe(
      `THIS TREE IS STALE: 3 commits behind origin/master \u2014 record here rev 0, at origin/master rev 1. ${STALE_TAIL}`
    );
  });

  // ---- T-343 review (PR #1125): F1 the working copy under .agents/, F2 the two diff flags, and the nits ----

  /** Level clone and seed, with a second TRACKED record file (.agents/TASKS/INBOX.md) on both sides. */
  function withInbox(): { clone: string; seed: string } {
    const { clone, seed } = makeClone(root);
    pushFile(seed, ".agents/TASKS/INBOX.md", "# inbox\n");
    git(clone, "fetch", "-q", "origin");
    git(clone, "merge", "-q", "--ff-only", "origin/master");
    return { clone, seed };
  }

  it("T343-11 (review v) an uncommitted edit to a record file that keeps the revision: the STALE warning", () => {
    const { clone, seed } = withInbox();
    pushFile(seed, "code.txt", "code\n");
    git(clone, "fetch", "-q", "origin");
    appendFileSync(join(clone, ".agents", "TASKS", "INBOX.md"), "local edit\n");
    expect(git(clone, "status", "--porcelain", "--", ".agents")).toContain(".agents/TASKS/INBOX.md");

    const r = describeTreeCurrency(clone);
    expect(r.severity).toBe("behind");
    expect(r.lines).toHaveLength(3);
    expect(r.lines[0]).toBe(
      `THIS TREE IS STALE: 1 commit behind origin/master \u2014 record here rev 1, at origin/master rev 1. ${STALE_TAIL}`
    );
  });

  it("T343-12 (review vi) identical tree, but state.json edited in place with the revision kept: the STALE warning", () => {
    const clone = mergedRecordsBranch(root);
    const statePath = join(clone, ".agents", "state.json");
    writeFileSync(statePath, readFileSync(statePath, "utf8").replace('"fixture"', '"EDITED"'));
    expect(git(clone, "status", "--porcelain", "--", ".agents")).toContain(".agents/state.json");

    const r = describeTreeCurrency(clone);
    expect(r.recordRevisionHere).toBe(2);
    expect(r.severity).toBe("behind");
    expect(r.lines).toHaveLength(3);
    expect(r.lines[0]).toBe(
      `THIS TREE IS STALE: 1 commit behind origin/master \u2014 record here rev 2, at origin/master rev 2. ${STALE_TAIL}`
    );
  });

  it("T343-13 this session's log, untracked and NOT ignored under .agents/, does not force STALE: the calm line", () => {
    const clone = threeCodeCommitsBehind(root);
    mkdirSync(join(clone, ".agents", "SESSIONS"), { recursive: true });
    writeFileSync(join(clone, ".agents", "SESSIONS", "Session_9.md"), "# Session 9\n");
    expect(git(clone, "status", "--porcelain", "--", ".agents")).toContain("?? .agents/SESSIONS/");

    const r = describeTreeCurrency(clone);
    expect(r.severity).toBe("behind-code");
    expect(r.lines).toHaveLength(1);
    expect(r.lines[0]).toContain("record current with origin/master (record here rev 1, at origin/master rev 1); 1 non-record file differs.");
  });

  it("T343-14 an IGNORED untracked file under .agents/ does not force STALE: the calm line", () => {
    const clone = threeCodeCommitsBehind(root);
    mkdirSync(join(clone, ".git", "info"), { recursive: true });
    appendFileSync(join(clone, ".git", "info", "exclude"), "\n.agents/AGENT.local.md\n");
    writeFileSync(join(clone, ".agents", "AGENT.local.md"), "local\n");
    expect(git(clone, "status", "--porcelain", "--", ".agents")).toBe("");

    const r = describeTreeCurrency(clone);
    expect(r.severity).toBe("behind-code");
    expect(r.lines).toHaveLength(1);
    expect(r.lines[0]).toContain("record current with origin/master (record here rev 1, at origin/master rev 1); 1 non-record file differs.");
  });

  it("T343-15 (review iii) upstream moved a record file out of .agents/, revision unchanged: the STALE warning", () => {
    const { clone, seed } = withInbox();
    mkdirSync(join(seed, "docs"));
    git(seed, "mv", ".agents/TASKS/INBOX.md", "docs/INBOX.md");
    git(seed, "commit", "-q", "-m", "move the inbox out of the record");
    git(seed, "push", "-q", "origin", "master");
    git(clone, "fetch", "-q", "origin");

    const r = describeTreeCurrency(clone);
    expect(r.recordRevisionHere).toBe(1);
    expect(r.recordRevisionUpstream).toBe(1);
    expect(r.severity).toBe("behind");
    expect(r.lines[0]).toBe(
      `THIS TREE IS STALE: 1 commit behind origin/master \u2014 record here rev 1, at origin/master rev 1. ${STALE_TAIL}`
    );
  });

  it("T343-16 (review iv) upstream added a non-ASCII-named file under .agents/: the STALE warning", () => {
    const { clone, seed } = makeClone(root);
    pushFile(seed, ".agents/notes-\u00fc.md", "notes\n");
    git(clone, "fetch", "-q", "origin");

    const r = describeTreeCurrency(clone);
    expect(r.recordRevisionHere).toBe(1);
    expect(r.recordRevisionUpstream).toBe(1);
    expect(r.severity).toBe("behind");
    expect(r.lines[0]).toBe(
      `THIS TREE IS STALE: 1 commit behind origin/master \u2014 record here rev 1, at origin/master rev 1. ${STALE_TAIL}`
    );
  });

  it("T343-17 two non-record files: the plural, '2 non-record files differ'", () => {
    const { clone, seed } = makeClone(root);
    pushFile(seed, "code.txt", "code\n");
    pushFile(seed, "lib/b.txt", "b\n");
    git(clone, "fetch", "-q", "origin");

    const r = describeTreeCurrency(clone);
    expect(r.severity).toBe("behind-code");
    expect(r.lines).toEqual([
      "Tree currency: 2 commits behind origin/master, record current with origin/master " +
        "(record here rev 1, at origin/master rev 1); 2 non-record files differ. " +
        `Compared against the last fetch (${r.lastFetchAt ?? "fetch time unknown"}), not the network. ${DRIFT}`,
    ]);
  });

  it("T343-18 a record behind that git status is told not to see (skip-worktree): the revision check still gives STALE", () => {
    const clone = threeCodeCommitsBehind(root);
    git(clone, "update-index", "--skip-worktree", ".agents/state.json");
    writeState(clone, 0);
    expect(git(clone, "status", "--porcelain", "--", ".agents")).toBe("");

    const r = describeTreeCurrency(clone);
    expect(r.recordRevisionHere).toBe(0);
    expect(r.severity).toBe("behind");
    expect(r.lines[0]).toBe(
      `THIS TREE IS STALE: 3 commits behind origin/master \u2014 record here rev 0, at origin/master rev 1. ${STALE_TAIL}`
    );
  });

  it("T343-19 the working-copy status cannot be read: the STALE warning, not the calm line", () => {
    const clone = threeCodeCommitsBehind(root);
    gate.refuse = (args) => args[0] === "status";
    const r = describeTreeCurrency(clone);
    gate.refuse = null;

    expect(gate.refused).toBe(1);
    expect(r.severity).toBe("behind");
    expect(r.lines).toHaveLength(3);
    expect(r.lines[0]).toBe(
      `THIS TREE IS STALE: 3 commits behind origin/master \u2014 record here rev 1, at origin/master rev 1. ${STALE_TAIL}`
    );
  });
});
