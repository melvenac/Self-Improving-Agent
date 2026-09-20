import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { execFileSync } from "node:child_process";
import { detachToUpstream, verifyDetached } from "../../src/pipelines/detach/index.js";

/**
 * A real clone with a real remote and a real branch. The thing under test is
 * whether work can be lost, so every fixture that matters actually creates the
 * commits that would be lost.
 */
function git(cwd: string, ...args: string[]): string {
  return execFileSync("git", args, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
}

function makeClone(root: string): string {
  const origin = join(root, "origin.git");
  const seed = join(root, "seed");
  const clone = join(root, "clone");
  mkdirSync(origin);
  mkdirSync(seed);
  git(origin, "init", "-q", "--bare", "-b", "master");
  git(seed, "init", "-q", "-b", "master");
  git(seed, "config", "user.email", "t@example.com");
  git(seed, "config", "user.name", "T");
  writeFileSync(join(seed, "a.txt"), "seed\n");
  git(seed, "add", "-A");
  git(seed, "commit", "-q", "-m", "seed");
  git(seed, "remote", "add", "origin", origin);
  git(seed, "push", "-q", "origin", "master");
  execFileSync("git", ["clone", "-q", origin, clone], { stdio: ["ignore", "pipe", "pipe"] });
  git(clone, "config", "user.email", "t@example.com");
  git(clone, "config", "user.name", "T");
  return clone;
}

describe("detachToUpstream", () => {
  let root: string;

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), "detach-"));
  });

  afterEach(async () => {
    await import("node:fs/promises").then((fs) => fs.rm(root, { recursive: true, force: true }));
  });

  it("detaches a branch checkout onto origin/master and VERIFIES the end state", () => {
    const clone = makeClone(root);
    expect(git(clone, "symbolic-ref", "--short", "HEAD")).toBe("master");

    const r = detachToUpstream(clone, { noFetch: true });
    expect(r.ok).toBe(true);
    expect(r.error).toBeNull();
    // Read back from git, not from the result: a success message is not the
    // change having landed.
    expect(() => git(clone, "symbolic-ref", "--short", "HEAD")).toThrow();
    expect(git(clone, "rev-parse", "HEAD")).toBe(git(clone, "rev-parse", "origin/master"));
    expect(r.steps.join("\n")).toMatch(/verified: detached at/);
  });

  it("REFUSES when HEAD carries commits origin/master does not — the work-loss case", () => {
    // This is the whole reason the command exists rather than the two git calls.
    // A detached HEAD leaves these reachable only through the reflog, and a seat
    // running this after a push it believed succeeded loses the session.
    const clone = makeClone(root);
    writeFileSync(join(clone, "work.txt"), "session work\n");
    git(clone, "add", "-A");
    git(clone, "commit", "-q", "-m", "unpushed session work");
    const before = git(clone, "rev-parse", "HEAD");

    const r = detachToUpstream(clone, { noFetch: true });
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/HEAD carries 1 commit\(s\)/);
    expect(r.error).toMatch(/unpushed session work/);
    expect(r.error).toMatch(/reflog/);
    expect(r.unmerged).toHaveLength(1);
    // Nothing moved.
    expect(git(clone, "rev-parse", "HEAD")).toBe(before);
    expect(git(clone, "symbolic-ref", "--short", "HEAD")).toBe("master");
  });

  it("--force proceeds past that refusal, and only then", () => {
    // The negative half: the guard must be overridable deliberately, or seats
    // will work around it, and it must NOT be overridden by default.
    const clone = makeClone(root);
    writeFileSync(join(clone, "work.txt"), "x\n");
    git(clone, "add", "-A");
    git(clone, "commit", "-q", "-m", "local");

    expect(detachToUpstream(clone, { noFetch: true }).ok).toBe(false);
    const forced = detachToUpstream(clone, { noFetch: true, force: true });
    expect(forced.ok).toBe(true);
    expect(forced.steps.join("\n")).toMatch(/--force: proceeding with 1 commit/);
    expect(git(clone, "rev-parse", "HEAD")).toBe(git(clone, "rev-parse", "origin/master"));
  });

  it("REFUSES a dirty tree and names the paths", () => {
    const clone = makeClone(root);
    writeFileSync(join(clone, "a.txt"), "edited, uncommitted\n");

    const r = detachToUpstream(clone, { noFetch: true });
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/working tree is not clean/);
    expect(r.error).toMatch(/a\.txt/);
    expect(git(clone, "symbolic-ref", "--short", "HEAD")).toBe("master");
  });

  it("reports 'nothing to do' when already detached at the target", () => {
    const clone = makeClone(root);
    git(clone, "checkout", "-q", "--detach", "origin/master");

    const r = detachToUpstream(clone, { noFetch: true });
    expect(r.ok).toBe(true);
    expect(r.steps.join("\n")).toMatch(/already detached at .* — nothing to do/);
  });

  it("dry run changes nothing and says what it would do", () => {
    const clone = makeClone(root);
    const before = git(clone, "rev-parse", "HEAD");

    const r = detachToUpstream(clone, { noFetch: true, dryRun: true });
    expect(r.ok).toBe(true);
    expect(r.steps.join("\n")).toMatch(/would run: git checkout --detach origin\/master/);
    expect(git(clone, "rev-parse", "HEAD")).toBe(before);
    expect(git(clone, "symbolic-ref", "--short", "HEAD")).toBe("master");
  });

  it("says when it skipped the fetch, so a reader knows which comparison they got", () => {
    const clone = makeClone(root);
    const r = detachToUpstream(clone, { noFetch: true });
    expect(r.fetched).toBe(false);
    expect(r.steps.join("\n")).toMatch(/skipped git fetch/);
    expect(r.steps.join("\n")).toMatch(/only as current as the last fetch/);
  });

  it("detaches onto origin/master even when the local master has moved ahead", () => {
    // shared.md carries this as a correction, not a preference: the original
    // brief said `--detach master`, which is wrong the moment another worktree
    // holds that branch behind. The local ref is not the remote's answer.
    const clone = makeClone(root);
    const upstream = git(clone, "rev-parse", "origin/master");
    writeFileSync(join(clone, "local.txt"), "x\n");
    git(clone, "add", "-A");
    git(clone, "commit", "-q", "-m", "local master moves ahead");

    const r = detachToUpstream(clone, { noFetch: true, force: true });
    expect(r.ok).toBe(true);
    expect(git(clone, "rev-parse", "HEAD")).toBe(upstream);
    expect(git(clone, "rev-parse", "master")).not.toBe(upstream);
  });

  // Unit-tested directly because it cannot be reached through detachToUpstream on
  // a working git: it exists for the case where `git checkout --detach` exits 0
  // and the tree is not detached at the target. Disabling it left all ten
  // integration tests above GREEN, which is why it is a named function and has
  // its own assertions — the guard against trusting an exit code was itself
  // being trusted rather than tested.
  describe("verifyDetached (the end-state read-back)", () => {
    it("accepts only a detached HEAD at the target", () => {
      expect(verifyDetached("abc123", "abc123", null)).toEqual({ ok: true });
    });

    it("refuses when HEAD is at the target but STILL ON A BRANCH", () => {
      const r = verifyDetached("abc123", "abc123", "master");
      expect(r.ok).toBe(false);
      if (r.ok) return;
      expect(r.error).toMatch(/not detached/);
      expect(r.error).toMatch(/on branch master/);
    });

    it("refuses when detached at the WRONG commit", () => {
      const r = verifyDetached("deadbee", "abc123", null);
      expect(r.ok).toBe(false);
      if (r.ok) return;
      expect(r.error).toMatch(/HEAD is deadbee/);
    });

    it("refuses when HEAD could not be read at all — null is not the target", () => {
      const r = verifyDetached(null, "abc123", null);
      expect(r.ok).toBe(false);
      if (r.ok) return;
      expect(r.error).toMatch(/HEAD is unknown/);
    });
  });

  it("refuses outside a git work tree", () => {
    const plain = join(root, "plain");
    mkdirSync(plain);
    const r = detachToUpstream(plain, { noFetch: true });
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/not inside a git work tree/);
  });

  it("refuses when the upstream ref does not exist", () => {
    const solo = join(root, "solo");
    mkdirSync(solo);
    git(solo, "init", "-q", "-b", "master");
    git(solo, "config", "user.email", "t@example.com");
    git(solo, "config", "user.name", "T");
    writeFileSync(join(solo, "a.txt"), "x\n");
    git(solo, "add", "-A");
    git(solo, "commit", "-q", "-m", "seed");

    const r = detachToUpstream(solo, { noFetch: true });
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/origin\/master does not exist/);
  });
});
