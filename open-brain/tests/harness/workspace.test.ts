import { describe, it, expect, beforeAll, beforeEach, afterEach } from "vitest";
import {
  Allowlist,
  enforceAllowlist,
  normaliseRepoPath,
  requireCleanTree,
  verifyFrozen,
} from "../../src/harness/workspace.js";
import { makeRepo, requireGit, type RepoFixture } from "./fixture.js";

describe("normaliseRepoPath", () => {
  it("accepts an ordinary repo-relative path", () => {
    expect(normaliseRepoPath("src/harness/git.ts")).toMatchObject({ ok: true, value: "src/harness/git.ts" });
  });

  it("unifies backslashes, so a Windows-shaped path compares against POSIX rules", () => {
    expect(normaliseRepoPath("src\\harness\\git.ts").value).toBe("src/harness/git.ts");
  });

  it("strips . segments without altering meaning", () => {
    expect(normaliseRepoPath("./docs/./loops/x.md").value).toBe("docs/loops/x.md");
  });

  it.each([
    ["../outside.md", "escapes"],
    ["src/../../etc/passwd", "escapes"],
    ["/etc/passwd", "absolute"],
    ["C:/Windows/system32", "absolute"],
    ["", "empty"],
    ['"quoted/path.md"', "quotePath"],
  ])("refuses %s rather than repairing it", (input, expected) => {
    const r = normaliseRepoPath(input);
    expect(r.ok).toBe(false);
    expect(r.reason).toMatch(new RegExp(expected, "i"));
  });

  it("refuses a path that resolves to the repository root", () => {
    expect(normaliseRepoPath(".").ok).toBe(false);
  });
});

describe("Allowlist", () => {
  it("permits an exact file rule and nothing beside it", () => {
    const a = new Allowlist(["artifacts/iterations/t001/E_t.json"]);
    expect(a.permits("artifacts/iterations/t001/E_t.json")).toBe(true);
    expect(a.permits("artifacts/iterations/t001/E_t.json.bak")).toBe(false);
    expect(a.permits("artifacts/iterations/t001/D_t.md")).toBe(false);
  });

  it("permits anything under a directory rule", () => {
    const a = new Allowlist(["artifacts/iterations/t001/"]);
    expect(a.permits("artifacts/iterations/t001/E_t.json")).toBe(true);
    expect(a.permits("artifacts/iterations/t001/deep/nested.txt")).toBe(true);
  });

  it("does not let a directory rule leak to a sibling with a shared prefix", () => {
    // "artifacts/iterations/t001/" must not permit "artifacts/iterations/t0011/x".
    const a = new Allowlist(["artifacts/iterations/t001/"]);
    expect(a.permits("artifacts/iterations/t0011/x.txt")).toBe(false);
  });

  it("refuses everything when the rule set is empty — there is no 'no allowlist'", () => {
    const a = new Allowlist([]);
    expect(a.permits("anything.md")).toBe(false);
    expect(a.describe()).toContain("nothing may be written");
  });

  it("matches case-sensitively, so a case variant is refused rather than assumed", () => {
    const a = new Allowlist(["docs/"]);
    expect(a.permits("docs/x.md")).toBe(true);
    expect(a.permits("DOCS/x.md")).toBe(false);
  });

  it("refuses to be built from a rule that escapes the repository", () => {
    expect(() => new Allowlist(["../elsewhere/"])).toThrow(/not a usable repo path/);
  });
});

describe("enforceAllowlist against a real tree", () => {
  let repo: RepoFixture;
  beforeAll(() => requireGit());
  beforeEach(() => { repo = makeRepo("harness-allow-"); });
  afterEach(() => repo.cleanup());

  it("passes when every change is inside the allowlist, and reports what it examined", () => {
    repo.write("artifacts/iterations/t001/D_t.md", "# plan\n");
    const v = enforceAllowlist(repo.root, new Allowlist(["artifacts/"]));
    expect(v.ok).toBe(true);
    expect(v.permitted).toEqual(["artifacts/iterations/t001/D_t.md"]);
    expect(v.examined).toBe(1);
    expect(v.message).toContain("examined 1 changed path");
    expect(v.message).toContain("LIMIT");
  });

  it("refuses a write outside the allowlist and names it", () => {
    repo.write("artifacts/iterations/t001/D_t.md", "# plan\n");
    repo.write("src/secret.ts", "export const leaked = true;\n");
    const v = enforceAllowlist(repo.root, new Allowlist(["artifacts/"]));
    expect(v.ok).toBe(false);
    expect(v.violations).toEqual(["src/secret.ts"]);
    expect(v.message).toContain("src/secret.ts");
  });

  it("reports zero examined on a clean tree, which is not the same as passing over work", () => {
    const v = enforceAllowlist(repo.root, new Allowlist(["artifacts/"]));
    expect(v.ok).toBe(true);
    expect(v.examined).toBe(0);
    expect(v.message).toContain("examined 0 changed path");
  });

  it("counts a file written deep inside an unlisted new directory", () => {
    // The failure this guards: git reporting `unlisted/` and a prefix rule
    // happening to permit the directory while the file inside is the payload.
    repo.write("unlisted/deep/deeper/payload.ts", "x\n");
    const v = enforceAllowlist(repo.root, new Allowlist(["artifacts/"]));
    expect(v.violations).toEqual(["unlisted/deep/deeper/payload.ts"]);
  });
});

describe("requireCleanTree", () => {
  let repo: RepoFixture;
  beforeAll(() => requireGit());
  beforeEach(() => { repo = makeRepo("harness-clean-"); });
  afterEach(() => repo.cleanup());

  it("passes on a clean tree", () => {
    expect(requireCleanTree(repo.root, "developer").ok).toBe(true);
  });

  it("refuses a dirty tree and says why a dirty start cannot be held to an allowlist", () => {
    repo.write("stray.md", "left over\n");
    const r = requireCleanTree(repo.root, "developer");
    expect(r.ok).toBe(false);
    expect(r.reason).toContain("stray.md");
    expect(r.reason).toContain("cannot be held to its allowlist");
  });
});

describe("verifyFrozen — acceptance A3", () => {
  let repo: RepoFixture;
  beforeAll(() => requireGit());
  beforeEach(() => { repo = makeRepo("harness-frozen-"); });
  afterEach(() => repo.cleanup());

  const candidateOf = (repoFixture: RepoFixture) => ({
    sha: repoFixture.sha(),
    branch: "main",
    frozenAt: "2026-09-19T00:00:00.000Z",
  });

  it("verifies a candidate whose tree has not moved", () => {
    const c = candidateOf(repo);
    const v = verifyFrozen(repo.root, c);
    expect(v.ok).toBe(true);
    expect(v.observedSha).toBe(c.sha);
  });

  it("refuses when HEAD has moved past the candidate", () => {
    const c = candidateOf(repo);
    repo.write("later.md", "a commit made after the freeze\n");
    const moved = repo.commitAll("moved past the candidate");
    expect(moved).not.toBe(c.sha);

    const v = verifyFrozen(repo.root, c);
    expect(v.ok).toBe(false);
    expect(v.reason).toContain("the tree has moved from the candidate");
    expect(v.reason).toContain(c.sha);
    expect(v.observedSha).toBe(moved);
  });

  it("refuses when HEAD is right but the working tree is dirty", () => {
    // Reported separately from a moved HEAD on purpose: "someone committed
    // past it" and "someone edited a file in place" are different accidents
    // with different fixes, and one verdict for both would hide which happened.
    const c = candidateOf(repo);
    repo.write("README.md", "# edited in place after the freeze\n");

    const v = verifyFrozen(repo.root, c);
    expect(v.ok).toBe(false);
    expect(v.observedSha).toBe(c.sha);
    expect(v.dirtyPaths).toContain("README.md");
    expect(v.reason).toContain("the working tree is dirty");
  });

  it("refuses rather than throwing when the directory is not a repository", () => {
    const v = verifyFrozen("/definitely/not/a/repo", candidateOf(repo));
    expect(v.ok).toBe(false);
    expect(v.observedSha).toBeNull();
  });
});
