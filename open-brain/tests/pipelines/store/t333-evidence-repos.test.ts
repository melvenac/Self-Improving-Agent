import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { spawnSync } from "node:child_process";
import Database from "better-sqlite3";
import { initSchemaV2 } from "../../../src/db-v2.js";
import {
  ghRunResolver,
  renderResolverScope,
  repoSetResolver,
  reposUnder,
} from "../../../src/pipelines/store/evidence-report.js";

/**
 * T-333: the shadow's resolver across several repos, and the opt-in CI run resolver. Real temp repos, so the git
 * commands are the ones the CLI runs; gh is injected, so no row touches the network. The live store is never opened.
 */

const cliEntry = join(import.meta.dirname, "../../../src/cli.ts");
const tsxCli = join(import.meta.dirname, "../../../node_modules/tsx/dist/cli.mjs");

let dir: string;
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "t333-"));
});
afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

function git(cwd: string, ...args: string[]): string {
  const r = spawnSync("git", ["-c", "user.name=t", "-c", "user.email=t@example.com", "-c", "commit.gpgsign=false", ...args], { cwd, encoding: "utf8" });
  if (r.status !== 0) throw new Error(`git ${args.join(" ")}: ${r.stderr}`);
  return r.stdout.trim();
}

/** A repo at dir/<name> with one commit holding `file`. Returns its commit sha. */
function repo(name: string, file: string): string {
  const root = join(dir, name);
  mkdirSync(join(root, file, ".."), { recursive: true });
  git(dir, "init", "-q", name);
  writeFileSync(join(root, file), `${name}\n`);
  git(root, "add", "-A");
  git(root, "commit", "-q", "-m", "one");
  return git(root, "rev-parse", "HEAD");
}

describe("T-333: evidence-report across repos", () => {
  it("R1: reposUnder lists direct children with a .git, a worktree's .git file included, and nothing else", () => {
    repo("a", "x.txt");
    mkdirSync(join(dir, "plain"));
    mkdirSync(join(dir, "wt"));
    writeFileSync(join(dir, "wt", ".git"), "gitdir: elsewhere\n");
    mkdirSync(join(dir, "plain", "nested", ".git"), { recursive: true });
    writeFileSync(join(dir, "file.txt"), "x");
    expect(reposUnder(dir)).toEqual([join(dir, "a"), join(dir, "wt")]);
  });

  it("R2: a sha resolves in any repo, in full or as a prefix; a blob and an unknown sha do not", () => {
    const a = repo("a", "x.txt");
    const b = repo("b", "y.txt");
    const blob = git(join(dir, "b"), "rev-parse", "HEAD:y.txt");
    const { resolver } = repoSetResolver([join(dir, "a"), join(dir, "b")]);
    expect(resolver.sha(a)).toBe(true);
    expect(resolver.sha(b)).toBe(true);
    expect(resolver.sha(b.slice(0, 8))).toBe(true);
    expect(resolver.sha(blob)).toBe(false);
    expect(resolver.sha("0123456789abcdef")).toBe(false);
  });

  it("R3: a path resolves in any repo, as written or under open-brain/", () => {
    repo("a", "tests/one.test.ts");
    repo("b", "open-brain/tests/two.test.ts");
    const { resolver } = repoSetResolver([join(dir, "a"), join(dir, "b")]);
    expect(resolver.path("tests/one.test.ts")).toBe(true);
    expect(resolver.path("tests/two.test.ts")).toBe(true);
    expect(resolver.path("tests/three.test.ts")).toBe(false);
  });

  it("R4: a repo that cannot be read is skipped and named, and the others still answer", () => {
    const a = repo("a", "x.txt");
    git(dir, "init", "-q", "empty");
    const set = repoSetResolver([join(dir, "a"), join(dir, "empty")]);
    expect(set.repos).toEqual([join(dir, "a")]);
    expect(set.skipped.map((s) => s.repo)).toEqual([join(dir, "empty")]);
    expect(set.resolver.sha(a)).toBe(true);
    const text = renderResolverScope(set);
    expect(text).toContain("resolved against 1 repo(s)");
    expect(text).toContain(`skipped ${join(dir, "empty")}:`);
  });

  it("R5: no readable repo at all is refused, not reported as a store with no evidence", () => {
    git(dir, "init", "-q", "empty");
    expect(() => repoSetResolver([join(dir, "empty")])).toThrow("no readable git checkout");
  });

  it("R6: gh: success resolves, a 404 does not, and any other failure throws", () => {
    const seen: string[][] = [];
    const answer = (status: number | null, stderr: string) => ghRunResolver("o/r", (args) => {
      seen.push(args);
      return { status, stderr };
    });
    expect(answer(0, "")("123456789")).toBe(true);
    expect(seen[0]).toEqual(["api", "repos/o/r/actions/runs/123456789", "--silent"]);
    expect(answer(1, "gh: Not Found (HTTP 404)\n")("123456789")).toBe(false);
    expect(() => answer(1, "gh: Bad credentials (HTTP 401)\n")("123456789")).toThrow("gh could not answer");
    expect(() => answer(null, "spawnSync gh ENOENT")("123456789")).toThrow("gh could not answer");
  });

  it("R7: the CLI counts a sha from a second repo only under --repos-under, and refuses a bad --runs-repo", () => {
    repo("a", "x.txt");
    const b = repo("b", "y.txt");
    const db = join(dir, "store.db");
    const d = new Database(db);
    initSchemaV2(d);
    d.prepare(
      "INSERT INTO knowledge_index (vault_path, key, content, tags, source, created_at, updated_at) VALUES ('k.md', 'k', ?, '', 'test', '2026-10-10T12:00:00.000Z', '2026-10-10T12:00:00.000Z')",
    ).run(`fixed in ${b}`);
    d.close();
    const run = (...a: string[]) =>
      spawnSync(process.execPath, [tsxCli, cliEntry, "evidence-report", "--db", db, "--as-of", "2026-11-01T00:00:00.000Z", ...a], { encoding: "utf8", timeout: 60_000 });
    const one = run("--repo", join(dir, "a"));
    expect(one.status, one.stderr).toBe(0);
    expect(one.stdout).toContain("entries: 1 live; evidenced 0 ");
    expect(one.stdout).not.toContain("pointers resolved against");
    const many = run("--repos-under", dir);
    expect(many.status, many.stderr).toBe(0);
    expect(many.stdout).toContain("entries: 1 live; evidenced 1 ");
    expect(many.stdout).toContain("pointers resolved against 2 repo(s)");
    const bad = run("--repos-under", dir, "--runs-repo", "not a slug");
    expect(bad.status).toBe(2);
    expect(bad.stderr).toContain("evidence-report refused: --runs-repo");
  }, 120_000);
});
