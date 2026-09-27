import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { execFileSync } from "node:child_process";
import { describeTreeCurrency } from "../../../src/pipelines/session-start/tree-currency.js";

/**
 * Every row clones and commits with real git. DIVERGED timed out at vitest's 5 s
 * default on Windows (QA 135, QA 138 O-c, Forge 141), and BEHIND and two more
 * did in record 147's runs (6.7 s), so the whole block has it (R5-4).
 */
const SPAWN_TIMEOUT_MS = 30_000;

/**
 * A real clone with a real remote, because the thing under test is exactly the
 * relationship between a checkout and its remote-tracking ref. A fixture that
 * faked `origin/master` would test the fake.
 *
 * G-029 is the trap this avoids: its regression test ran git inside try/catch
 * with a bare `return` on failure, so a machine where git misbehaved reported
 * green. Here `git` is called through a helper that lets the error THROW, so a
 * broken git fails these tests rather than passing them.
 *
 * The condition under test is the one that actually occurred on 2026-09-20: a
 * developer seat started on a branch two merges behind origin/master, greeted
 * itself from a rev-50 record, and reported four record claims that were false
 * at rev 52 — with `Drift: none` the whole time, because drift compares the
 * views to state.json WITHIN the tree and both were internally consistent.
 */
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

/** A bare origin plus a clone of it, both real. Returns the clone's path. */
function makeClone(root: string): { clone: string; origin: string } {
  const origin = join(root, "origin.git");
  const seed = join(root, "seed");
  const clone = join(root, "clone");
  mkdirSync(origin);
  mkdirSync(seed);
  git(origin, "init", "-q", "--bare", "-b", "master");

  git(seed, "init", "-q", "-b", "master");
  git(seed, "config", "user.email", "t@example.com");
  git(seed, "config", "user.name", "T");
  writeState(seed, 1);
  git(seed, "add", "-A");
  git(seed, "commit", "-q", "-m", "seed");
  git(seed, "remote", "add", "origin", origin);
  git(seed, "push", "-q", "origin", "master");

  execFileSync("git", ["clone", "-q", origin, clone], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
  git(clone, "config", "user.email", "t@example.com");
  git(clone, "config", "user.name", "T");
  return { clone, origin };
}

/** Adds one commit to origin, via the seed tree, WITHOUT fetching in the clone. */
function advanceOrigin(root: string, revision: number, message: string): void {
  const seed = join(root, "seed");
  writeState(seed, revision);
  git(seed, "add", "-A");
  git(seed, "commit", "-q", "-m", message);
  git(seed, "push", "-q", "origin", "master");
}

describe("describeTreeCurrency", { timeout: SPAWN_TIMEOUT_MS }, () => {
  let root: string;

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), "tree-currency-"));
  });

  afterEach(async () => {
    // Awaited async rm, not rmSync: G-042 — synchronous recursive removal over
    // .git directories blocked the vitest worker's event loop past its reporter
    // heartbeat, and the suite exited 1 while printing "805 passed".
    await import("node:fs/promises").then((fs) => fs.rm(root, { recursive: true, force: true }));
  });

  it("reports current when the clone is level with origin/master", () => {
    const { clone } = makeClone(root);
    const r = describeTreeCurrency(clone);
    expect(r.severity).toBe("current");
    expect(r.headBehind).toBe(0);
    expect(r.headAhead).toBe(0);
    expect(r.recordRevisionHere).toBe(1);
    expect(r.recordRevisionUpstream).toBe(1);
  });

  it("SAYS SO when current — a silent pass would look like a check that did not run", () => {
    // This is the assertion that drove the design. The first version of this
    // module returned no lines when the tree was level, following the silence
    // rule in derived-artifacts.ts. That rule belongs to a hook running in every
    // project on the machine, most of which have no derived artifacts; it does
    // not belong here, where a current tree and an unchecked one would render
    // identically. `Drift: none` prints for the same reason.
    const { clone } = makeClone(root);
    const r = describeTreeCurrency(clone);
    expect(r.lines.length).toBeGreaterThan(0);
    const text = r.lines.join("\n");
    expect(text).toMatch(/origin\/master/);
    expect(text).toMatch(/fetch/i);
    expect(text).toMatch(/drift/i);
  });

  it("reports BEHIND with the commit count and both record revisions", () => {
    const { clone } = makeClone(root);
    advanceOrigin(root, 2, "second");
    advanceOrigin(root, 3, "third");
    git(clone, "fetch", "-q", "origin");

    const r = describeTreeCurrency(clone);
    expect(r.severity).toBe("behind");
    expect(r.headBehind).toBe(2);
    expect(r.headAhead).toBe(0);
    expect(r.recordRevisionHere).toBe(1);
    expect(r.recordRevisionUpstream).toBe(3);

    const text = r.lines.join("\n");
    expect(text).toMatch(/2 commits behind/);
    expect(text).toMatch(/rev 1 .*rev 3|rev 1.*origin\/master.*rev 3/s);
  });

  it("names the comparison so it cannot be read as the drift line", () => {
    const { clone } = makeClone(root);
    advanceOrigin(root, 2, "second");
    git(clone, "fetch", "-q", "origin");

    const text = describeTreeCurrency(clone).lines.join("\n");
    // Drift compares the views to state.json inside one tree; this compares the
    // tree to origin/master. A reader seeing both must be able to tell which
    // question each answered, from the lines themselves.
    expect(text).toMatch(/origin\/master/);
    expect(text).toMatch(/drift/i);
  });

  it("states that the comparison is only as fresh as the last fetch", () => {
    const { clone } = makeClone(root);
    const text = describeTreeCurrency(clone).lines.join("\n");
    expect(text).toMatch(/fetch/i);
  });

  it("RESOLVES a real last-fetch timestamp, rather than reporting it unknown", () => {
    // The assertion above passes on the string "fetch time unknown", which is
    // what the first implementation printed in EVERY tree — including one
    // fetched minutes earlier — because `git rev-parse --git-path` returns an
    // absolute WINDOWS path (`C:/...`) and the code tested for a leading "/" to
    // decide whether to resolve it against the project root. It fell back to
    // null, which reads as caution and was actually a broken instrument.
    //
    // This is the assertion with teeth: after a real fetch there must be a real
    // timestamp. A test that only looks for the word "fetch" accepts the defect
    // it was written to exclude.
    const { clone } = makeClone(root);
    advanceOrigin(root, 2, "second");
    git(clone, "fetch", "-q", "origin");

    const r = describeTreeCurrency(clone);
    expect(r.lastFetchAt).not.toBeNull();
    expect(r.lastFetchAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
    expect(Date.parse(r.lastFetchAt as string)).toBeGreaterThan(Date.now() - 10 * 60 * 1000);
    expect(r.lines.join("\n")).not.toMatch(/fetch time unknown/);
  });

  it("finds FETCH_HEAD in a LINKED WORKTREE, where it is not under .git/", () => {
    // Every seat checkout in this repo is a linked worktree, whose git dir is
    // .git/worktrees/<name>/ in the main repo — not a .git directory of its own.
    // A hardcoded `.git/FETCH_HEAD` returns null in exactly the trees this runs
    // in, so the fixture is a real worktree. (developer.md: a test about
    // worktrees creates a worktree.)
    const { clone } = makeClone(root);
    git(clone, "fetch", "-q", "origin");
    const linked = join(root, "linked");
    git(clone, "worktree", "add", "-q", "--detach", linked, "HEAD");

    const r = describeTreeCurrency(linked);
    expect(r.severity).not.toBe("skip");
    expect(r.lastFetchAt).not.toBeNull();
    expect(r.recordRevisionUpstream).toBe(1);
  });

  it("SKIPS with a reason when there is no origin/master, and never passes", () => {
    const solo = join(root, "solo");
    mkdirSync(solo);
    git(solo, "init", "-q", "-b", "master");
    git(solo, "config", "user.email", "t@example.com");
    git(solo, "config", "user.name", "T");
    writeState(solo, 1);
    git(solo, "add", "-A");
    git(solo, "commit", "-q", "-m", "seed");

    const r = describeTreeCurrency(solo);
    expect(r.severity).toBe("skip");
    expect(r.skipReason).toBeTruthy();
    expect(r.lines.join("\n")).toMatch(/not a pass/i);
    expect(r.severity).not.toBe("current");
  });

  it("SKIPS with a reason outside a git repository", () => {
    const plain = join(root, "plain");
    mkdirSync(plain);
    writeState(plain, 1);

    const r = describeTreeCurrency(plain);
    expect(r.severity).toBe("skip");
    expect(r.lines.join("\n")).toMatch(/not a pass/i);
  });

  it("reports ahead without calling it behind, and stays quiet about staleness", () => {
    const { clone } = makeClone(root);
    writeState(clone, 2);
    git(clone, "add", "-A");
    git(clone, "commit", "-q", "-m", "local work");

    const r = describeTreeCurrency(clone);
    expect(r.severity).toBe("ahead");
    expect(r.headBehind).toBe(0);
    expect(r.headAhead).toBe(1);
  });

  it("reports DIVERGED when both sides moved", () => {
    const { clone } = makeClone(root);
    advanceOrigin(root, 2, "upstream work");
    git(clone, "fetch", "-q", "origin");
    writeState(clone, 99);
    git(clone, "add", "-A");
    git(clone, "commit", "-q", "-m", "local work");

    const r = describeTreeCurrency(clone);
    expect(r.severity).toBe("diverged");
    expect(r.headBehind).toBe(1);
    expect(r.headAhead).toBe(1);
  });

  it("reports the record revision as unknown rather than 0 when state.json is absent upstream", () => {
    const origin = join(root, "origin.git");
    const seed = join(root, "seed");
    const clone = join(root, "clone");
    mkdirSync(origin);
    mkdirSync(seed);
    git(origin, "init", "-q", "--bare", "-b", "master");
    git(seed, "init", "-q", "-b", "master");
    git(seed, "config", "user.email", "t@example.com");
    git(seed, "config", "user.name", "T");
    writeFileSync(join(seed, "readme.md"), "no record here\n");
    git(seed, "add", "-A");
    git(seed, "commit", "-q", "-m", "seed");
    git(seed, "remote", "add", "origin", origin);
    git(seed, "push", "-q", "origin", "master");
    execFileSync("git", ["clone", "-q", origin, clone], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });

    const r = describeTreeCurrency(clone);
    // Absent must not read as revision 0 — that is the silent-zero shape.
    expect(r.recordRevisionHere).toBeNull();
    expect(r.recordRevisionUpstream).toBeNull();
    expect(r.severity).toBe("current");
  });

  it("reports a record revision behind even when HEAD is level, and says both numbers", () => {
    // The record and the commit graph can disagree: a tree can be level on
    // commits while its state.json was reverted or hand-edited. The line must
    // carry both numbers rather than infer one from the other.
    const { clone } = makeClone(root);
    writeState(clone, 0);

    const r = describeTreeCurrency(clone);
    expect(r.headBehind).toBe(0);
    expect(r.recordRevisionHere).toBe(0);
    expect(r.recordRevisionUpstream).toBe(1);
    expect(r.severity).toBe("record-behind");
    expect(r.lines.join("\n")).toMatch(/rev 0/);
  });
});
