import { describe, it, expect, beforeAll, beforeEach, afterEach } from "vitest";
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join, resolve } from "node:path";
import {
  changedPaths,
  commitPaths,
  currentBranch,
  DENIED_SUBCOMMANDS,
  git,
  GitRefused,
  gitTry,
  headSha,
  isClean,
  isRepo,
  refExists,
  resolveRef,
  revertPaths,
  tagAt,
} from "../../src/harness/git.js";
import { makeRepo, rawGit, requireGit, type RepoFixture } from "./fixture.js";

describe("harness git wrapper", () => {
  let repo: RepoFixture;

  beforeAll(() => requireGit());
  beforeEach(() => { repo = makeRepo("harness-git-"); });
  afterEach(() => repo.cleanup());

  describe("the outward-facing deny list", () => {
    it.each(DENIED_SUBCOMMANDS.map((s) => [s]))("refuses git %s", (sub) => {
      expect(() => git(repo.root, [sub, "origin"])).toThrow(GitRefused);
    });

    it("refuses a denied subcommand hidden behind leading global options", () => {
      // `-c` and `-C` take a value; the scan must step over it rather than
      // mistake the value for the subcommand and wave the push through.
      expect(() => git(repo.root, ["-c", "http.sslVerify=false", "push", "origin", "main"])).toThrow(GitRefused);
      expect(() => git(repo.root, ["-C", repo.root, "--no-pager", "push"])).toThrow(GitRefused);
    });

    it("refuses an empty argument list rather than guessing a subcommand", () => {
      expect(() => git(repo.root, [])).toThrow(GitRefused);
    });

    it("still allows the subcommands the runtime needs", () => {
      expect(() => git(repo.root, ["status", "--porcelain"])).not.toThrow();
      expect(() => git(repo.root, ["rev-parse", "HEAD"])).not.toThrow();
    });

    it("contains no git push anywhere in the harness source", () => {
      // The deny list is one mechanism; this is the other.
      //
      // The first version of this test reported git.ts as an offender, and it
      // was right about the text and wrong about the question: it had matched
      // the DENIED_SUBCOMMANDS array, where "push" appears precisely because it
      // is forbidden. The exclusion below is narrow and named — rename the
      // constant and the exclusion stops applying, so the scan re-fires rather
      // than silently widening.
      const NETWORK_SUBCOMMAND = /\[\s*["'](?:push|fetch|pull|clone)["']/;

      // Validate the detector against a known positive before trusting a
      // negative. A scan that cannot find a planted hit proves nothing.
      expect(NETWORK_SUBCOMMAND.test('git(repoRoot, ["push", "origin", "main"])')).toBe(true);
      expect(NETWORK_SUBCOMMAND.test('git(repoRoot, ["status", "--porcelain"])')).toBe(false);

      const dir = resolve(__dirname, "../../src/harness");
      const walk = (d: string, out: string[] = []): string[] => {
        for (const e of readdirSync(d, { withFileTypes: true })) {
          if (e.isDirectory()) walk(join(d, e.name), out);
          else if (e.name.endsWith(".ts")) out.push(join(d, e.name));
        }
        return out;
      };
      const files = walk(dir);
      expect(files.length, "harness source file count — the scan must prove it looked").toBeGreaterThanOrEqual(8);

      const denyListBlock = /export const DENIED_SUBCOMMANDS[\s\S]*?\];/;
      const offenders: string[] = [];
      let scanned = 0;
      for (const f of files) {
        const src = readFileSync(f, "utf-8").replace(denyListBlock, "");
        scanned += 1;
        if (NETWORK_SUBCOMMAND.test(src)) offenders.push(f);
      }
      expect(scanned).toBe(files.length);
      expect(offenders, `harness source invokes a network git subcommand: ${offenders.join(", ")}`).toEqual([]);
    });
  });

  describe("shell-free argument handling", () => {
    it("passes ^{commit} to git verbatim", () => {
      // cmd.exe ate the ^ in this exact expression and handed git `{commit}`,
      // which is the loudest failure in this project's error record. With
      // shell:false there is no shell to eat it.
      const sha = repo.sha();
      expect(resolveRef(repo.root, sha)).toBe(sha);
      expect(refExists(repo.root, "HEAD")).toBe(true);
    });

    it("handles a path containing a space and a caret", () => {
      repo.write("a file^with odd chars.md", "x\n");
      expect(changedPaths(repo.root)).toContain("a file^with odd chars.md");
      const sha = commitPaths(repo.root, ["a file^with odd chars.md"], "odd path");
      expect(sha).toMatch(/^[0-9a-f]{40}$/);
      expect(isClean(repo.root)).toBe(true);
    });
  });

  describe("changedPaths", () => {
    it("lists files inside a new directory, not the directory alone", () => {
      // A directory-only listing would let `secret/thing.ts` be reported as
      // `secret/`, which a prefix allowlist might well permit.
      repo.write("nested/deep/thing.ts", "export {};\n");
      const changed = changedPaths(repo.root);
      expect(changed).toContain("nested/deep/thing.ts");
      expect(changed).not.toContain("nested/");
    });

    it("reports both sides of a rename", () => {
      repo.write("before.md", "content\n");
      repo.commitAll("add before.md");
      rawGit(repo.root, ["mv", "before.md", "after.md"]);
      const changed = changedPaths(repo.root);
      expect(changed).toContain("after.md");
      expect(changed).toContain("before.md");
    });

    it("reports a clean tree as zero paths", () => {
      expect(changedPaths(repo.root)).toEqual([]);
      expect(isClean(repo.root)).toBe(true);
    });

    it("does not report gitignored files", () => {
      repo.write(".gitignore", "ignored/\n");
      repo.commitAll("add gitignore");
      repo.write("ignored/output.txt", "build output\n");
      expect(changedPaths(repo.root)).toEqual([]);
    });
  });

  describe("tags", () => {
    it("creates an annotated tag at a given sha", () => {
      const sha = repo.sha();
      tagAt(repo.root, "loop-001-developer", sha, "candidate");
      expect(resolveRef(repo.root, "loop-001-developer")).toBe(sha);
    });

    it("refuses to move a tag that already exists", () => {
      const first = repo.sha();
      tagAt(repo.root, "loop-001-developer", first, "candidate");
      repo.write("more.md", "x\n");
      const second = repo.commitAll("second");
      expect(() => tagAt(repo.root, "loop-001-developer", second, "moved")).toThrow(GitRefused);
      // The marker still points where it did. A rollback marker that moves is not a marker.
      expect(resolveRef(repo.root, "loop-001-developer")).toBe(first);
    });
  });

  describe("revertPaths", () => {
    it("restores a tracked file that was modified", () => {
      repo.write("tracked.md", "original\n");
      repo.commitAll("add tracked");
      repo.write("tracked.md", "tampered\n");
      revertPaths(repo.root, ["tracked.md"]);
      expect(readFileSync(join(repo.root, "tracked.md"), "utf-8")).toBe("original\n");
    });

    it("removes an untracked file, which `git checkout --` cannot", () => {
      // Both halves are needed: a revert that left untracked writes on disk
      // would report success while the violation survived.
      repo.write("outside/secret.txt", "written outside the allowlist\n");
      expect(existsSync(join(repo.root, "outside/secret.txt"))).toBe(true);
      revertPaths(repo.root, ["outside/secret.txt"]);
      expect(existsSync(join(repo.root, "outside/secret.txt"))).toBe(false);
      expect(isClean(repo.root)).toBe(true);
    });
  });

  describe("failure reporting", () => {
    it("throws with git's stderr rather than returning an empty string", () => {
      // A wrapper that returned "" on failure would be the || echo 0 defect:
      // the caller cannot tell "no answer" from "the answer is nothing".
      expect(() => git(repo.root, ["rev-parse", "--verify", "no-such-ref^{commit}"])).toThrow(/failed in/);
    });

    it("gitTry reports ok from the exit status, not from stdout looking plausible", () => {
      const r = gitTry(repo.root, ["rev-parse", "--verify", "--quiet", "no-such-ref^{commit}"]);
      expect(r.ok).toBe(false);
      expect(refExists(repo.root, "no-such-ref")).toBe(false);
    });

    it("commitPaths refuses an empty change set", () => {
      expect(() => commitPaths(repo.root, [], "nothing")).toThrow(GitRefused);
    });
  });

  describe("repository detection", () => {
    it("recognises a real repository and its branch", () => {
      expect(isRepo(repo.root)).toBe(true);
      expect(currentBranch(repo.root)).toBe("main");
      expect(headSha(repo.root)).toMatch(/^[0-9a-f]{40}$/);
    });
  });
});
