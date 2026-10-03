import { describe, it, expect, afterAll } from "vitest";
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { describeServingBuild } from "../../../src/pipelines/session-start/serving-build.js";
import { handleStart } from "../../../src/server.js";

/**
 * T-233 A, T-234 A. The serving tree is a real clone whose origin is a local bare repository; the build's commit comes from
 * `open-brain/build/build-info.json`, exactly as write-build-info.mjs stamps it. Fixtures: behind (by served code), behind by
 * records only, level, ahead, diverged, and no build-info; plus the unreadable shapes, each of which must say "not checked"
 * and never print nothing. The strings are pinned exactly: the shape is the contract.
 */
const made: string[] = [];
afterAll(() => {
  for (const d of made) rmSync(d, { recursive: true, force: true });
});

const git = (cwd: string, ...args: string[]): string =>
  execFileSync("git", args, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();

interface Fixture {
  tree: string;
  seed: string;
  buildDir: string;
  commits: string[]; // oldest first, all on origin/master
}

/** A serving tree with `n` commits on origin/master, all fetched. Each commit touches `files` (default: a served path). */
function servingTree(n: number, files: string[] = ["open-brain/src/f.txt"]): Fixture {
  return servingTreeOf(Array.from({ length: n }, () => files));
}

/** A serving tree whose origin/master commits touch exactly `perCommit[i]`, oldest first, all fetched. */
function servingTreeOf(perCommit: string[][]): Fixture {
  const root = mkdtempSync(join(tmpdir(), "t233a-"));
  made.push(root);
  const origin = join(root, "origin.git");
  const seed = join(root, "seed");
  const tree = join(root, "tree");
  mkdirSync(origin);
  mkdirSync(seed);
  git(origin, "init", "-q", "--bare", "-b", "master");
  git(seed, "init", "-q", "-b", "master");
  git(seed, "config", "user.email", "t@example.invalid");
  git(seed, "config", "user.name", "t");
  git(seed, "remote", "add", "origin", origin);
  const commits: string[] = [];
  for (const [i, files] of perCommit.entries()) {
    for (const f of files) {
      mkdirSync(dirname(join(seed, f)), { recursive: true });
      writeFileSync(join(seed, f), `v${i}\n`);
    }
    git(seed, "add", "-A");
    git(seed, "commit", "-q", "-m", `c${i}`);
    commits.push(git(seed, "rev-parse", "HEAD"));
  }
  git(seed, "push", "-q", "origin", "master");
  execFileSync("git", ["clone", "-q", origin, tree], { stdio: "ignore" });
  const buildDir = join(tree, "open-brain", "build");
  mkdirSync(buildDir, { recursive: true });
  return { tree, seed, buildDir, commits };
}

const stamp = (f: Fixture, commit: string | null, extra: Record<string, unknown> = {}): void => {
  writeFileSync(join(f.buildDir, "build-info.json"), JSON.stringify({ commit, builtAt: "2026-10-01T10:00:00.000Z", reason: null, ...extra }, null, 2));
};

/** `n` local commits in the serving tree that origin/master lacks; returns the tip. */
function localCommits(f: Fixture, n: number): string {
  git(f.tree, "config", "user.email", "t@example.invalid");
  git(f.tree, "config", "user.name", "t");
  for (let i = 1; i <= n; i++) {
    writeFileSync(join(f.tree, `local${i}.txt`), "x");
    git(f.tree, "add", "-A");
    git(f.tree, "commit", "-q", "-m", `local${i}`);
  }
  return git(f.tree, "rev-parse", "HEAD");
}

const short = (sha: string): string => sha.slice(0, 7);

describe("T-233 A the serving build is named, and a stale one is loud", { timeout: 60_000 }, () => {
  it("BEHIND: a build 3 served-code commits behind origin/master says so, with the distance", () => {
    const f = servingTree(5);
    stamp(f, f.commits[1]!); // commits 2, 3, 4 are newer
    expect(describeServingBuild(f.buildDir)).toBe(`Build ${short(f.commits[1]!)} · STALE: 3 code commits behind → ask Aaron to update`);
  });

  it("BEHIND by one is singular", () => {
    const f = servingTree(3);
    stamp(f, f.commits[1]!);
    expect(describeServingBuild(f.buildDir)).toBe(`Build ${short(f.commits[1]!)} · STALE: 1 code commit behind → ask Aaron to update`);
  });

  it("LEVEL: a build at origin/master says current, with no path and no timestamp", () => {
    const f = servingTree(3);
    stamp(f, f.commits[2]!);
    const line = describeServingBuild(f.buildDir);
    expect(line).toBe(`Build ${short(f.commits[2]!)} · current`);
    expect(line).not.toContain(f.tree);
    expect(line).not.toContain("2026-10-01");
  });

  it("the line is about the BUILD's commit, not the tree's HEAD (the build is what is served)", () => {
    const f = servingTree(3);
    stamp(f, f.commits[2]!);
    // The tree's HEAD moves on while the build stays: HEAD is not the build's commit. That commit is local, so origin/master
    // is not ahead of the build and the build is not ahead of origin/master. No HEAD note: the shape carries no extras.
    git(f.tree, "config", "user.email", "t@example.invalid");
    git(f.tree, "config", "user.name", "t");
    writeFileSync(join(f.tree, "local.txt"), "x");
    git(f.tree, "add", "-A");
    git(f.tree, "commit", "-q", "-m", "local");
    expect(describeServingBuild(f.buildDir)).toBe(`Build ${short(f.commits[2]!)} · current`);
  });

  // The path set that counts as SERVED: open-brain/ (except its tests), scripts/, .claude/ and package.json.
  it("RECORDS ONLY: commits touching only .agents/ and docs/ are not a stale build (false stale, clark 2026-10-03)", () => {
    const f = servingTreeOf([["open-brain/src/a.ts"], [".agents/state.json"], ["docs/loops/x.md", ".agents/TASKS/INBOX.md"]]);
    stamp(f, f.commits[0]!);
    const line = describeServingBuild(f.buildDir);
    expect(line).toBe(`Build ${short(f.commits[0]!)} · current (2 records-only commits behind)`);
    expect(line).not.toContain("STALE");
  });

  it("RECORDS ONLY by one is singular, and open-brain/tests changes are not served either", () => {
    const f = servingTreeOf([["open-brain/src/a.ts"], ["open-brain/tests/a.test.ts"]]);
    stamp(f, f.commits[0]!);
    expect(describeServingBuild(f.buildDir)).toBe(`Build ${short(f.commits[0]!)} · current (1 records-only commit behind)`);
  });

  it("only SERVED commits are counted: 4 code commits among records say 4, not 5 or 7", () => {
    const f = servingTreeOf([
      ["open-brain/src/a.ts"],
      ["open-brain/src/b.ts"],
      [".agents/state.json"],
      [".claude/commands/start.md"],
      ["docs/x.md"],
      ["scripts/setup.mjs"],
      ["package.json"],
      [".agents/SESSIONS/next-session.md"],
    ]);
    stamp(f, f.commits[0]!);
    expect(describeServingBuild(f.buildDir)).toBe(`Build ${short(f.commits[0]!)} · STALE: 4 code commits behind → ask Aaron to update`);
  });

  it("project-template/ is served (via /bootstrap and setup.mjs's Cursor copy), so a commit touching only it is a stale build (QA 264)", () => {
    const f = servingTreeOf([["open-brain/src/a.ts"], ["project-template/.cursor/commands/start.md"]]);
    stamp(f, f.commits[0]!);
    expect(describeServingBuild(f.buildDir)).toBe(`Build ${short(f.commits[0]!)} · STALE: 1 code commit behind → ask Aaron to update`);
  });

  it("a commit touching served code AND records counts as code", () => {
    const f = servingTreeOf([["open-brain/src/a.ts"], [".agents/state.json", "open-brain/package.json"]]);
    stamp(f, f.commits[0]!);
    expect(describeServingBuild(f.buildDir)).toBe(`Build ${short(f.commits[0]!)} · STALE: 1 code commit behind → ask Aaron to update`);
  });

  it("AHEAD (F6): a build at a local commit origin/master lacks is 'ahead by N', never 'current'", () => {
    const f = servingTree(2);
    const built = localCommits(f, 2);
    stamp(f, built);
    const line = describeServingBuild(f.buildDir);
    expect(line).toBe(`Build ${short(built)} · ahead by 2 (unmerged local commits)`);
    expect(line).not.toContain("current");
  });

  it("DIVERGED: ahead of origin/master AND behind its served code says both", () => {
    const f = servingTree(2);
    const built = localCommits(f, 1);
    // origin/master moves on with a served change this build lacks.
    mkdirSync(join(f.seed, "open-brain", "src"), { recursive: true });
    writeFileSync(join(f.seed, "open-brain", "src", "new.ts"), "n");
    git(f.seed, "add", "-A");
    git(f.seed, "commit", "-q", "-m", "served change");
    git(f.seed, "push", "-q", "origin", "master");
    git(f.tree, "fetch", "-q", "origin");
    stamp(f, built);
    expect(describeServingBuild(f.buildDir)).toBe(`Build ${short(built)} · STALE: 1 code commit behind, ahead by 1 → ask Aaron to update`);
  });

  it("NO BUILD-INFO: not checked, with the reason, never nothing", () => {
    const f = servingTree(2);
    const line = describeServingBuild(f.buildDir);
    expect(line).toMatch(/^Serving build: not checked \(.*build-info\.json does not exist/);
  });

  it("an unreadable build-info is not checked", () => {
    const f = servingTree(2);
    writeFileSync(join(f.buildDir, "build-info.json"), "{ not json");
    expect(describeServingBuild(f.buildDir)).toMatch(/^Serving build: not checked \(.*is unreadable/);
  });

  it("a build stamped with no commit (the stamp's own failure) is not checked and carries the reason", () => {
    const f = servingTree(2);
    stamp(f, null, { reason: "git rev-parse failed: x" });
    const line = describeServingBuild(f.buildDir);
    expect(line).toMatch(/^Serving build: not checked \(the build was not stamped with a commit \(git rev-parse failed: x\)\)/);
  });

  it("a commit the tree has never seen is not checked: the distance is unknown, not zero", () => {
    const f = servingTree(2);
    stamp(f, "1".repeat(40));
    const line = describeServingBuild(f.buildDir);
    expect(line).toMatch(/^Serving build: not checked \(/);
    expect(line).toContain("is unknown");
    expect(line).not.toContain("current");
  });

  it("a build directory that is not inside a git tree is not checked", () => {
    const root = mkdtempSync(join(tmpdir(), "t233a-nogit-"));
    made.push(root);
    const buildDir = join(root, "open-brain", "build");
    mkdirSync(buildDir, { recursive: true });
    writeFileSync(join(buildDir, "build-info.json"), JSON.stringify({ commit: "a".repeat(40), builtAt: "x", reason: null }));
    expect(describeServingBuild(buildDir)).toMatch(/^Serving build: not checked \(.*git cannot read/);
  });

  it("ob_start prints it as the FIRST line (under test the server runs from src, so it says not checked)", async () => {
    const root = mkdtempSync(join(tmpdir(), "t233a-start-"));
    made.push(root);
    execFileSync("git", ["init", "-q"], { cwd: root, stdio: "ignore" });
    writeFileSync(join(root, "package.json"), JSON.stringify({ version: "1.0.0" }));
    for (const d of ["SYSTEM", "TASKS", "SESSIONS"]) mkdirSync(join(root, ".agents", d), { recursive: true });
    for (const [rel, body] of [["SYSTEM/SUMMARY.md", "# S\n"], ["TASKS/INBOX.md", "# I\n"], ["TASKS/task.md", "# T\n"], ["SESSIONS/next-session.md", "# N\n"]] as const) {
      writeFileSync(join(root, ".agents", rel), body);
    }
    const first = (await handleStart({ project_root: root })).content[0]!.text.split("\n")[0]!;
    expect(first.startsWith("Serving build: ")).toBe(true);
  });
});
