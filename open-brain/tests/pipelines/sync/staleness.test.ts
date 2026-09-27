import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { execAsync } from "../../spawn-async.js";
import { checkGitNexusIndex, checkBuildFreshness } from "../../../src/pipelines/sync/checks.js";

/**
 * These fixtures need a real git repository, because both checks ask git
 * questions — does this ref exist, is this commit present, how far behind.
 *
 * G-029 is the trap: its regression test shelled out to git inside a try/catch
 * with a bare `return` on failure, so a machine where git misbehaved reported
 * green without testing anything. Here git failure is NOT swallowed — `initRepo`
 * lets the error throw, so a broken git FAILS these tests rather than passing
 * them. That is the whole difference.
 */
//
// Awaited, not execSync (G-042): this file's git calls were one stretch of 52-67 s with no macrotask under load.
// execAsync throws exactly where execSync did, so the property above holds.
async function initRepo(dir: string): Promise<string> {
  const run = async (cmd: string) => (await execAsync(cmd, { cwd: dir })).trim();
  await run("git init -q -b main");
  await run('git config user.email "t@example.com"');
  await run('git config user.name "T"');
  writeFileSync(join(dir, "seed.txt"), "seed\n");
  await run("git add -A");
  await run('git commit -q -m seed');
  return run("git rev-parse HEAD");
}

describe("checkGitNexusIndex", () => {
  let dir: string;
  let head: string;

  const writeMeta = (meta: unknown): void => {
    mkdirSync(join(dir, ".gitnexus"), { recursive: true });
    writeFileSync(join(dir, ".gitnexus", "meta.json"), JSON.stringify(meta));
  };

  beforeEach(async () => {
    dir = mkdtempSync(join(tmpdir(), "stale-idx-"));
    head = await initRepo(dir);
  });
  afterEach(() => rmSync(dir, { recursive: true, force: true }));

  it("skips with a reason where there is no .gitnexus/, and says it is not a pass", () => {
    const r = checkGitNexusIndex(dir);
    expect(r.severity).toBe("skip");
    expect(r.message).toContain("not a pass");
    expect(r.severity).not.toBe("pass");
  });

  it("passes when the index is at HEAD, and carries the ref it measured against", () => {
    writeMeta({ lastCommit: head, branch: "main", indexedAt: "2026-09-17T00:00:00.000Z" });
    const r = checkGitNexusIndex(dir);
    expect(r.severity).toBe("pass");
    // A derived number must carry what it was derived from: two seats measured
    // 137 and 138 an hour apart and both were right.
    expect(r.message).toContain("measured against HEAD");
    expect(r.message).toContain("LIMIT:");
  });

  it("warns with a count when merely behind", async () => {
    writeMeta({ lastCommit: head, branch: "main" });
    writeFileSync(join(dir, "b.txt"), "b\n");
    await execAsync("git add -A && git commit -q -m b", { cwd: dir });
    const r = checkGitNexusIndex(dir);
    expect(r.severity).toBe("warn");
    expect(r.message).toContain("1 commit(s) behind");
  });

  it("a dead branch pin on a CURRENT index is not staleness — the SHA is the anchor", () => {
    // Regression for a false positive this check actually had. A successful
    // reindex at 08e6486 left branch: "loop/4-dogfood" — a deleted branch —
    // because the tree was detached and the analyzer kept the old name. Judging
    // by the branch reported ISSUE on a fresh index, which is the exact case the
    // check exists to catch, and would teach people to ignore it.
    writeMeta({ lastCommit: head, branch: "loop/4-dogfood" });
    const r = checkGitNexusIndex(dir);
    expect(r.severity).toBe("pass");
    expect(r.message).toContain("not evidence of staleness");
  });

  it("a dead branch pin on a BEHIND index still reports the count, and stays a warn", async () => {
    writeMeta({ lastCommit: head, branch: "loop/4-dogfood" });
    writeFileSync(join(dir, "d.txt"), "d\n");
    await execAsync("git add -A && git commit -q -m d", { cwd: dir });
    const r = checkGitNexusIndex(dir);
    expect(r.severity).toBe("warn");
    expect(r.message).toContain("1 commit(s) behind");
  });

  it("treats an indexed commit absent from the repo as UNDEFINED, not zero", () => {
    writeMeta({ lastCommit: "0".repeat(40), branch: "main" });
    const r = checkGitNexusIndex(dir);
    expect(r.severity).toBe("issue");
    expect(r.message).toContain("UNDEFINED, not zero");
  });

  it("fails on meta.json with no lastCommit rather than assuming current", () => {
    writeMeta({ branch: "main" });
    const r = checkGitNexusIndex(dir);
    expect(r.severity).toBe("issue");
    expect(r.severity).not.toBe("pass");
  });

  it("fails on unreadable meta.json rather than skipping past it", () => {
    mkdirSync(join(dir, ".gitnexus"), { recursive: true });
    writeFileSync(join(dir, ".gitnexus", "meta.json"), "{ not json");
    const r = checkGitNexusIndex(dir);
    expect(r.severity).toBe("issue");
    expect(r.message).toContain("unreadable");
  });
});

describe("checkBuildFreshness", () => {
  let dir: string;
  let head: string;

  const writeInfo = (info: unknown): void => {
    mkdirSync(join(dir, "open-brain", "build"), { recursive: true });
    writeFileSync(join(dir, "open-brain", "build", "build-info.json"), JSON.stringify(info));
  };

  beforeEach(async () => {
    dir = mkdtempSync(join(tmpdir(), "stale-build-"));
    head = await initRepo(dir);
  });
  afterEach(() => rmSync(dir, { recursive: true, force: true }));

  it("skips when there is no build, and says it is not a pass", () => {
    const r = checkBuildFreshness(dir);
    expect(r.severity).toBe("skip");
    expect(r.message).toContain("not a pass");
  });

  it("passes when the stamp matches HEAD, and states what it cannot see", () => {
    writeInfo({ commit: head, builtAt: "2026-09-17T00:00:00.000Z", reason: null });
    const r = checkBuildFreshness(dir);
    expect(r.severity).toBe("pass");
    expect(r.message).toContain("LIMIT: compares commits, not working-tree edits");
  });

  it("fails when the build was made from a different commit", async () => {
    writeInfo({ commit: head, builtAt: "2026-09-17T00:00:00.000Z", reason: null });
    writeFileSync(join(dir, "c.txt"), "c\n");
    await execAsync("git add -A && git commit -q -m c", { cwd: dir });
    const r = checkBuildFreshness(dir);
    expect(r.severity).toBe("issue");
    expect(r.message).toContain("was made from");
  });

  it("in a MAIN checkout, names the hooks and server as affected", async () => {
    writeInfo({ commit: head, builtAt: "2026-09-17T00:00:00.000Z", reason: null });
    await execAsync("git commit -q --allow-empty -m moved", { cwd: dir });
    const r = checkBuildFreshness(dir);
    expect(r.severity).toBe("issue");
    expect(r.message).toContain("a stale server reports success");
  });

  it("in a LINKED WORKTREE, says the hooks and server are UNAFFECTED", async () => {
    // The consequence was asserted unconditionally and is true only in the main
    // checkout: both hooks hardcode absolute paths into the MAIN tree's build,
    // so here a stale build means a stale local CLI and nothing more. Two of the
    // three trees on this machine are linked. Rule 14 — a statement true where
    // it was written, used as an invariant.
    //
    // This is pinned by a test precisely because nothing pinned it before: the
    // wording could be re-universalised by the next edit with nothing to catch
    // it, which is the shape of the defect itself.
    const wt = join(dir, "..", `wt-${Date.now()}`);
    try {
      await execAsync(`git worktree add -q --detach "${wt}"`, { cwd: dir });
      mkdirSync(join(wt, "open-brain", "build"), { recursive: true });
      writeFileSync(
        join(wt, "open-brain", "build", "build-info.json"),
        JSON.stringify({ commit: "0".repeat(40), builtAt: "2026-09-17T00:00:00.000Z", reason: null }),
      );
      const r = checkBuildFreshness(wt);
      expect(r.severity).toBe("issue");
      expect(r.message).toContain("local CLI in this checkout is stale");
      expect(r.message).toContain("unaffected");
      // The main-checkout claim must NOT appear here.
      expect(r.message).not.toContain("a stale server reports success");
    } finally {
      try {
        await execAsync(`git worktree remove --force "${wt}"`, { cwd: dir });
      } catch {
        rmSync(wt, { recursive: true, force: true });
      }
    }
  });

  it("the UNSTAMPED message carries the same tree-aware consequence, not a universal one", async () => {
    // The same false invariant lived in a second message that was not flagged:
    // the unstamped branch also asserted the hooks run from this tree. Fixing
    // only the reported instance would have left the defect one branch away.
    const wt = join(dir, "..", `wt2-${Date.now()}`);
    try {
      await execAsync(`git worktree add -q --detach "${wt}"`, { cwd: dir });
      mkdirSync(join(wt, "open-brain", "build"), { recursive: true });
      const r = checkBuildFreshness(wt);
      expect(r.severity).toBe("issue");
      expect(r.message).toContain("UNKNOWN");
      expect(r.message).toContain("unaffected");
      expect(r.message).not.toContain("a stale server reports success");
    } finally {
      try {
        await execAsync(`git worktree remove --force "${wt}"`, { cwd: dir });
      } catch {
        rmSync(wt, { recursive: true, force: true });
      }
    }
  });

  it("reports an UNSTAMPED build as unknown, never as fresh", () => {
    // This is the main tree's real state before this change shipped: a build
    // that may well be current, but cannot be vouched for. Refusing to vouch is
    // the point — it must not read the same as a verified match.
    mkdirSync(join(dir, "open-brain", "build"), { recursive: true });
    const r = checkBuildFreshness(dir);
    expect(r.severity).toBe("issue");
    expect(r.message).toContain("UNKNOWN");
    expect(r.severity).not.toBe("pass");
  });

  it("reports a build stamped with a null commit as unknown, and gives the recorded reason", () => {
    writeInfo({ commit: null, builtAt: "2026-09-17T00:00:00.000Z", reason: "git rev-parse failed: not a repository" });
    const r = checkBuildFreshness(dir);
    expect(r.severity).toBe("issue");
    expect(r.message).toContain("not a repository");
    expect(r.message).toContain("UNKNOWN, not fresh");
  });

  it("fails on unreadable build-info.json rather than passing", () => {
    mkdirSync(join(dir, "open-brain", "build"), { recursive: true });
    writeFileSync(join(dir, "open-brain", "build", "build-info.json"), "{ not json");
    const r = checkBuildFreshness(dir);
    expect(r.severity).toBe("issue");
    expect(r.message).toContain("unreadable");
  });
});
