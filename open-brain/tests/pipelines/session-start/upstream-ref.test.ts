/**
 * T-250: resolveUpstreamRef and default-branch wiring (UR-1..UR-8).
 */
import { describe, it, expect, afterEach } from "vitest";
import { execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { resolveUpstreamRef, FALLBACK_UPSTREAM } from "../../../src/pipelines/session-start/upstream-ref.js";
import { describeTreeCurrency } from "../../../src/pipelines/session-start/tree-currency.js";
import { resolveRecordSource } from "../../../src/pipelines/session-start/record-source.js";
import { isBehindUpstream } from "../../../src/pipelines/session-start/role-files.js";

const tmps: string[] = [];
afterEach(() => {
  for (const d of tmps.splice(0)) rmSync(d, { recursive: true, force: true, maxRetries: 3, retryDelay: 50 });
});
function rootDir(): string {
  const d = mkdtempSync(join(tmpdir(), "t250-"));
  tmps.push(d);
  return d;
}

function git(cwd: string, ...args: string[]): string {
  return execFileSync("git", args, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
}

function writeState(dir: string, revision: number): void {
  mkdirSync(join(dir, ".agents"), { recursive: true });
  writeFileSync(
    join(dir, ".agents", "state.json"),
    JSON.stringify(
      {
        schema_version: 3,
        revision,
        project: { name: "fixture" },
        objective: null,
        tasks: [],
        gaps: [],
        decisions: [],
        handoffs: [],
        sessions: [],
      },
      null,
      2,
    ) + "\n",
  );
}

function setupRemote(root: string, defaultBranch: "main" | "master"): { work: string; seed: string } {
  const remote = join(root, "remote.git");
  const seed = join(root, "seed");
  const work = join(root, "work");
  mkdirSync(remote);
  mkdirSync(seed);
  git(remote, "init", "-q", "--bare", "-b", defaultBranch);
  git(seed, "init", "-q", "-b", defaultBranch);
  git(seed, "config", "user.email", "t@example.com");
  git(seed, "config", "user.name", "T");
  writeState(seed, 1);
  git(seed, "add", "-A");
  git(seed, "commit", "-q", "-m", "seed");
  git(seed, "remote", "add", "origin", remote);
  git(seed, "push", "-q", "origin", defaultBranch);
  execFileSync("git", ["clone", "-q", remote, work], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
  git(work, "config", "user.email", "t@example.com");
  git(work, "config", "user.name", "T");
  return { work, seed };
}

describe("T-250 upstream ref", { timeout: 30_000 }, () => {
  it("UR-1: cloned repo with origin/HEAD → origin/main resolves origin/main", () => {
    const { work } = setupRemote(rootDir(), "main");
    expect(resolveUpstreamRef(work)).toBe("origin/main");
  });

  it("UR-2: origin/HEAD deleted still falls back to origin/main", () => {
    const { work } = setupRemote(rootDir(), "main");
    git(work, "remote", "set-head", "origin", "-d");
    expect(resolveUpstreamRef(work)).toBe("origin/main");
  });

  it("UR-3: default branch master resolves origin/master", () => {
    const { work } = setupRemote(rootDir(), "master");
    expect(resolveUpstreamRef(work)).toBe("origin/master");
  });

  it("UR-4: no remote keeps FALLBACK and skip text names origin/master", () => {
    const dir = rootDir();
    git(dir, "init", "-q", "-b", "main");
    expect(resolveUpstreamRef(dir)).toBe("origin/master");
    expect(resolveUpstreamRef(dir)).toBe(FALLBACK_UPSTREAM);
    const tc = describeTreeCurrency(dir);
    expect(tc.lines[0]).toContain("origin/master does not exist in this checkout");
  });

  it("UR-5: symbolic-ref to develop wins over main fallback", () => {
    const root = rootDir();
    const { work, seed } = setupRemote(root, "main");
    git(seed, "checkout", "-q", "-b", "develop");
    writeFileSync(join(seed, "develop.txt"), "d\n");
    git(seed, "add", "-A");
    git(seed, "commit", "-q", "-m", "develop");
    git(seed, "push", "-q", "origin", "develop");
    git(work, "fetch", "-q", "origin");
    git(work, "remote", "set-head", "origin", "develop");
    expect(resolveUpstreamRef(work)).toBe("origin/develop");
  });

  it("UR-6: after fetch, tree currency uses origin/main and reports behind", () => {
    const root = rootDir();
    const { work, seed } = setupRemote(root, "main");
    writeState(seed, 2);
    git(seed, "add", "-A");
    git(seed, "commit", "-q", "-m", "second");
    git(seed, "push", "-q", "origin", "main");
    git(work, "fetch", "-q", "origin");
    const r = describeTreeCurrency(work);
    expect(r.severity).not.toBe("skip");
    expect(r.upstreamRef).toBe("origin/main");
    expect(r.headBehind).toBe(1);
    const text = r.lines.join("\n");
    expect(text).toContain("origin/main");
    expect(text).not.toContain("NOT CHECKED");
  });

  it("UR-7: record source uses origin/main on main-default clone", () => {
    const { work } = setupRemote(rootDir(), "main");
    const rs = resolveRecordSource(work);
    expect(rs.upstreamRef).toBe("origin/main");
    expect(rs.line).not.toContain("does not exist in this checkout");
  });

  it("UR-8: isBehindUpstream compares blob at upstream ref", () => {
    const root = rootDir();
    const { work, seed } = setupRemote(root, "main");
    writeFileSync(join(seed, "a.md"), "upstream\n");
    git(seed, "add", "a.md");
    git(seed, "commit", "-q", "-m", "upstream a");
    git(seed, "push", "-q", "origin", "main");
    git(work, "fetch", "-q", "origin");
    writeFileSync(join(work, "a.md"), "local\n");
    git(work, "add", "a.md");
    git(work, "commit", "-q", "-m", "local a");
    expect(isBehindUpstream(work, "a.md", "origin/main")).toBe(true);
    git(work, "checkout", "-q", "origin/main", "--", "a.md");
    git(work, "add", "a.md");
    git(work, "commit", "-q", "-m", "match upstream");
    expect(isBehindUpstream(work, "a.md", "origin/main")).toBe(false);
  });
});
