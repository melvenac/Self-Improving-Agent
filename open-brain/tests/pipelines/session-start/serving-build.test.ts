import { describe, it, expect, afterAll } from "vitest";
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describeServingBuild } from "../../../src/pipelines/session-start/serving-build.js";
import { handleStart } from "../../../src/server.js";

/**
 * T-233 A. The serving tree is a real clone whose origin is a local bare repository; the build's commit comes from
 * `open-brain/build/build-info.json`, exactly as write-build-info.mjs stamps it. Three fixtures: behind, level, and
 * no build-info; plus the unreadable shapes, each of which must say "not checked" and never print nothing.
 */
const made: string[] = [];
afterAll(() => {
  for (const d of made) rmSync(d, { recursive: true, force: true });
});

const git = (cwd: string, ...args: string[]): string =>
  execFileSync("git", args, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();

interface Fixture {
  tree: string;
  buildDir: string;
  commits: string[]; // oldest first, all on origin/master
}

/** A serving tree with `n` commits on origin/master, all fetched. */
function servingTree(n: number): Fixture {
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
  for (let i = 0; i < n; i++) {
    writeFileSync(join(seed, "f.txt"), `v${i}\n`);
    git(seed, "add", "-A");
    git(seed, "commit", "-q", "-m", `c${i}`);
    commits.push(git(seed, "rev-parse", "HEAD"));
  }
  git(seed, "push", "-q", "origin", "master");
  execFileSync("git", ["clone", "-q", origin, tree], { stdio: "ignore" });
  const buildDir = join(tree, "open-brain", "build");
  mkdirSync(buildDir, { recursive: true });
  return { tree, buildDir, commits };
}

const stamp = (f: Fixture, commit: string | null, extra: Record<string, unknown> = {}): void => {
  writeFileSync(join(f.buildDir, "build-info.json"), JSON.stringify({ commit, builtAt: "2026-10-01T10:00:00.000Z", reason: null, ...extra }, null, 2));
};

describe("T-233 A the serving build is named, and a stale one is loud", { timeout: 60_000 }, () => {
  it("BEHIND: a build 3 commits behind origin/master says so, with the distance", () => {
    const f = servingTree(5);
    stamp(f, f.commits[1]!); // commits 2, 3, 4 are newer
    const line = describeServingBuild(f.buildDir);
    expect(line).toContain("SERVING BUILD IS STALE");
    expect(line).toContain("is 3 commits behind origin/master");
    expect(line).toContain(f.commits[1]!.slice(0, 7));
    expect(line).toContain("(built 2026-10-01T10:00:00.000Z)");
    expect(line).not.toContain("level with");
  });

  it("BEHIND by one is singular", () => {
    const f = servingTree(3);
    stamp(f, f.commits[1]!);
    expect(describeServingBuild(f.buildDir)).toContain("is 1 commit behind origin/master");
  });

  it("LEVEL: a build at origin/master names the tree and says level, qualified by the last fetch", () => {
    const f = servingTree(3);
    stamp(f, f.commits[2]!);
    const line = describeServingBuild(f.buildDir);
    expect(line.startsWith("Serving build: ")).toBe(true);
    expect(line).toContain("is level with origin/master");
    expect(line).toContain("not the network");
    expect(line).not.toContain("STALE");
  });

  it("a build older than its own tree's HEAD names both commits (the build is what is served)", () => {
    const f = servingTree(3);
    stamp(f, f.commits[2]!);
    // The tree's HEAD moves on while the build stays: HEAD is not the build's commit.
    git(f.tree, "config", "user.email", "t@example.invalid");
    git(f.tree, "config", "user.name", "t");
    writeFileSync(join(f.tree, "local.txt"), "x");
    git(f.tree, "add", "-A");
    git(f.tree, "commit", "-q", "-m", "local");
    const line = describeServingBuild(f.buildDir);
    expect(line).toContain("the tree's HEAD is");
    expect(line).toContain("not the build's commit");
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
    expect(line).not.toContain("level with");
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
