import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { execFileSync } from "node:child_process";
import { findHandoffCommit } from "../../../src/pipelines/session-start/handoff-provenance.js";

/**
 * The close-out SHA is DERIVED because it cannot be stored: the commit that
 * contains a handoff write does not exist at the moment of that write. A
 * `recorded_at` field would hold the commit BEFORE the close-out and be wrong
 * for exactly the purpose it was added for (rule 14).
 */
function git(cwd: string, ...args: string[]): string {
  return execFileSync("git", args, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
}

const BASE = {
  project: { name: "fixture" },
  objective: null,
  tasks: [],
  verified: [],
  gaps: [],
  decisions: [],
};

function writeV2(dir: string, revision: number, handoffs: unknown[]): void {
  mkdirSync(join(dir, ".agents"), { recursive: true });
  writeFileSync(
    join(dir, ".agents", "state.json"),
    JSON.stringify(
      { schema_version: 2, revision, ...BASE, handoffs, last_session: { n: 1, date: "2026-01-01", uuid: null, seat: null } },
      null,
      2
    ) + "\n"
  );
}

function writeV1(dir: string, revision: number, handoff: unknown): void {
  mkdirSync(join(dir, ".agents"), { recursive: true });
  writeFileSync(
    join(dir, ".agents", "state.json"),
    JSON.stringify(
      { schema_version: 1, revision, ...BASE, handoff, last_session: { n: 1, date: "2026-01-01", uuid: null } },
      null,
      2
    ) + "\n"
  );
}

function handoff(seat: string, pick_up: string, session = 1) {
  return { seat, pick_up, watch_out: [], open_questions: [], session, loop_state: null };
}

function commit(dir: string, message: string): string {
  git(dir, "add", "-A");
  git(dir, "commit", "-q", "-m", message);
  return git(dir, "rev-parse", "HEAD");
}

function init(dir: string): void {
  git(dir, "init", "-q", "-b", "master");
  git(dir, "config", "user.email", "t@example.com");
  git(dir, "config", "user.name", "T");
}

describe("findHandoffCommit", () => {
  let dir: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "handoff-prov-"));
    init(dir);
  });

  afterEach(async () => {
    await import("node:fs/promises").then((fs) => fs.rm(dir, { recursive: true, force: true }));
  });

  it("names the commit where that seat's handoff last changed", () => {
    writeV2(dir, 1, [handoff("qa", "first")]);
    commit(dir, "one");
    writeV2(dir, 2, [handoff("qa", "second")]);
    const target = commit(dir, "two");
    writeV2(dir, 3, [handoff("qa", "second"), handoff("developer", "dev")]);
    commit(dir, "three — a DIFFERENT seat writes");

    const p = findHandoffCommit(dir, "qa");
    // The developer's later write must not be reported as the QA seat's close-out.
    expect(p.commit).toBe(target);
    expect(p.note).toBeNull();
  });

  it("CROSSES A SCHEMA MIGRATION rather than stopping at it", () => {
    // Found by running it on the real repository: the v1 -> v2 migration rewrote
    // every entry's bytes, so comparing whole entries made the MIGRATION COMMIT
    // the close-out for every seat — the greeting named a developer commit as the
    // QA seat's close-out. Accurate to "where this entry last changed", and the
    // wrong answer to "where did this seat write this".
    writeV1(dir, 1, { pick_up: "the real close-out", watch_out: [], open_questions: [], session: 70 });
    const realCloseOut = commit(dir, "session 70 close-out — QA seat");

    writeV2(dir, 2, [handoff("qa", "the real close-out", 70)]);
    commit(dir, "migrate v1 -> v2");
    writeFileSync(join(dir, "unrelated.txt"), "x\n");
    commit(dir, "unrelated work");

    const p = findHandoffCommit(dir, "qa");
    expect(p.commit).toBe(realCloseOut);
  });

  it("ignores a change that only reshapes the container", () => {
    // The general form of the case above: adding or filling a field that is not
    // the seat's words must not reattribute those words to whoever did it.
    // A QA seat, not a planner: a planner handoff with `loop_state: null` is
    // REFUSED by the schema (C3 — the rows may be empty but not absent), so a
    // planner fixture here would be testing a state that cannot exist. The
    // schema caught that when this test was first written.
    writeV2(dir, 1, [handoff("qa", "words that do not change", 5)]);
    const target = commit(dir, "qa close-out");

    const withRows = {
      ...handoff("qa", "words that do not change", 5),
      loop_state: { open_prs: [], frozen_sha: "abc", questions_for_aaron: [], rulings: [] },
    };
    writeV2(dir, 2, [withRows]);
    commit(dir, "someone fills in loop_state");

    expect(findHandoffCommit(dir, "qa").commit).toBe(target);
  });

  it("FAILS CLOSED when the entry is older than the bound, naming the bound", () => {
    writeV2(dir, 1, [handoff("qa", "unchanged forever")]);
    commit(dir, "the close-out");
    for (let i = 0; i < 4; i++) {
      writeV2(dir, 2 + i, [handoff("qa", "unchanged forever")]);
      writeFileSync(join(dir, `f${i}.txt`), "x\n");
      commit(dir, `noise ${i}`);
    }

    const p = findHandoffCommit(dir, "qa", 3);
    expect(p.commit).toBeNull();
    expect(p.note).toMatch(/unchanged through all 3 commits examined/);
    expect(p.searched).toBe(3);
    // Never a blank and never a guess: "older than the window" is a different
    // answer from "no commit", and only one of them means look further back.
    expect(p.note).toMatch(/no SHA is claimed/);
  });

  it("says there is nothing to trace when that seat has no handoff", () => {
    writeV2(dir, 1, [handoff("qa", "only qa here")]);
    commit(dir, "one");

    const p = findHandoffCommit(dir, "planner");
    expect(p.commit).toBeNull();
    expect(p.note).toMatch(/no committed handoff for "planner"/);
  });

  it("says so outside a git repository rather than returning a commit", () => {
    const plain = mkdtempSync(join(tmpdir(), "handoff-nogit-"));
    writeV2(plain, 1, [handoff("qa", "x")]);
    const p = findHandoffCommit(plain, "qa");
    expect(p.commit).toBeNull();
    expect(p.note).toBeTruthy();
  });
});
