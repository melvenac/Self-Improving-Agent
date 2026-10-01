/**
 * T-194 r4 — the fixes for QA 234's REJECT of c1f1cb48 and the planner's rulings on it:
 * D3 relative targets resolve against payload.cwd (Q4), a path outside the repo is ALLOWED,
 * protected prefixes match case-insensitively on Windows, the prefix half of the single-invocation
 * check, exact-match grants, and `gh.exe` / `"gh"`.
 * Every input comes from a fixture; the hook is driven through its functions, never registered.
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { mkdtempSync, rmSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { runPlannerHook, runPlannerHookAsync } from "../../src/planner-hook/run.js";
import { grantMatchesCommand, grantPath, readOutwardGrant } from "../../src/planner-hook/grant.js";
import { isProtectedArtifactPath, isRenderedViewPath, toRepoRelative } from "../../src/planner-hook/paths.js";
import type { FetchLike } from "../../src/planner-hook/prfiles.js";

const TOKEN_ENV = { GH_TOKEN: "test-token" } as NodeJS.ProcessEnv;

let repo: string;
let home: string;
let fwd: string;

const at = (cwd: string, tool: string, tool_input: Record<string, unknown>) => ({
  cwd,
  hook_event_name: "PreToolUse",
  tool_name: tool,
  tool_input,
});
const sub = (rel: string) => `${fwd}/${rel}`;
const bashAt = (cwd: string, command: string) => at(cwd, "Bash", { command });

function fakeFetch(filenames: string[], calls: string[] = []): FetchLike {
  return async (url) => {
    calls.push(url);
    if (new URL(url).pathname.endsWith("/files")) {
      return { ok: true, status: 200, json: async () => filenames.map((filename) => ({ filename, status: "modified" })) };
    }
    return { ok: true, status: 200, json: async () => ({ changed_files: filenames.length }) };
  };
}

const runAsync = (command: string, files: string[], calls: string[] = []) =>
  runPlannerHookAsync(bashAt(repo, command), {}, { env: TOKEN_ENV, home, fetchImpl: fakeFetch(files, calls) });

beforeAll(() => {
  repo = mkdtempSync(join(tmpdir(), "planner-r4-"));
  home = mkdtempSync(join(tmpdir(), "planner-r4-home-"));
  for (const d of [".agents/SYSTEM", ".agents/TASKS", "open-brain/src", "docs/loops", "scratch", ".git"]) {
    mkdirSync(join(repo, d), { recursive: true });
  }
  writeFileSync(
    join(repo, ".git", "config"),
    '[remote "origin"]\n\turl = https://github.com/melvenac/Self-Improving-Agent.git\n',
    "utf-8",
  );
  fwd = repo.replace(/\\/g, "/");
});

afterAll(() => {
  rmSync(repo, { recursive: true, force: true });
  rmSync(home, { recursive: true, force: true });
});

beforeEach(() => {
  writeFileSync(join(repo, ".agents", "AGENT.local.md"), "---\nname: Atlas\nrole: planner\npartner: Forge\n---\n", "utf-8");
  if (existsSync(grantPath(repo))) rmSync(grantPath(repo));
});

describe("D3 — a relative target resolves against payload.cwd (QA 234 Q4)", () => {
  it("cwd open-brain/: `echo x > src/cli.ts` is denied", () => {
    const r = runPlannerHook(bashAt(sub("open-brain"), "echo x > src/cli.ts"));
    expect(r.decision).toBe("deny");
    expect(r.reason).toContain("src/cli.ts");
  });

  it("cwd open-brain/: `sed -i s/a/b/ src/cli.ts` is denied", () => {
    expect(runPlannerHook(bashAt(sub("open-brain"), "sed -i s/a/b/ src/cli.ts")).decision).toBe("deny");
  });

  it("cwd .agents/: `echo {} > state.json` is denied", () => {
    expect(runPlannerHook(bashAt(sub(".agents"), "echo '{}' > state.json")).decision).toBe("deny");
  });

  it("cwd open-brain/: a relative Edit of src/cli.ts is denied", () => {
    const r = runPlannerHook(at(sub("open-brain"), "Edit", { file_path: "src/cli.ts", old_string: "a", new_string: "b" }));
    expect(r.decision).toBe("deny");
    expect(r.reason).toContain('planner.md, "Authority"');
  });

  it("the same relative text from a cwd where it is NOT protected is allowed (the cwd is what decides)", () => {
    expect(runPlannerHook(bashAt(sub("docs/loops"), "echo x > src/cli.ts")).decision).toBe("allow");
    expect(runPlannerHook(bashAt(sub("scratch"), "echo '{}' > state.json")).decision).toBe("allow");
  });

  it("a protected path reached through ../ from a subdirectory cwd is still denied", () => {
    expect(runPlannerHook(bashAt(sub("docs/loops"), "echo x > ../../open-brain/src/cli.ts")).decision).toBe("deny");
    const r = runPlannerHook(at(sub("docs"), "Write", { file_path: "../.agents/state.json", content: "{}" }));
    expect(r.decision).toBe("deny");
    expect(r.reason).toContain("ob_state");
  });

  it("toRepoRelative: relative against a cwd, and a cwd that is not absolute cannot locate it", () => {
    expect(toRepoRelative("src/cli.ts", "C:/r", "C:\\r\\open-brain")).toEqual({
      ok: true,
      outside: false,
      rel: "open-brain/src/cli.ts",
      ci: true,
    });
    const r = toRepoRelative("src/cli.ts", "C:/r", "open-brain");
    expect(r.ok).toBe(false);
  });
});

describe("outside the repo is allowed; only an undeterminable path is denied (named cause)", () => {
  it("`npm test 2> C:/qa-tmp/log.txt` and a redirect to a scratch path outside the repo are allowed", () => {
    expect(runPlannerHook(bashAt(repo, "npm test 2> C:/qa-tmp/log.txt")).decision).toBe("allow");
    expect(runPlannerHook(bashAt(repo, `echo x > ${dirname(fwd)}/elsewhere/x.txt`)).decision).toBe("allow");
    expect(runPlannerHook(bashAt(repo, "git log > /tmp/log.txt")).decision).toBe("allow");
  });

  it("a Write to a scratch path outside the repo is allowed, absolute and relative-with-../", () => {
    expect(runPlannerHook(at(repo, "Write", { file_path: `${dirname(fwd)}/elsewhere/x.md`, content: "x" })).decision).toBe("allow");
    expect(runPlannerHook(at(repo, "Write", { file_path: "../elsewhere/x.md", content: "x" })).decision).toBe("allow");
  });

  it("an outside path that merely looks protected (…/open-brain/src/…) is allowed", () => {
    expect(runPlannerHook(at(repo, "Write", { file_path: `${dirname(fwd)}/other/open-brain/src/a.ts`, content: "x" })).decision).toBe("allow");
  });

  // r6: the same commands are now refused by the P0 parse gate before P1 reads the target; the refusal still names the construct.
  it("a Bash target with a shell expansion is denied, naming the cause", () => {
    for (const cmd of ["echo x > $HOME/x.txt", "echo x > `pwd`/x.txt"]) {
      const r = runPlannerHook(bashAt(repo, cmd));
      expect(r.decision).toBe("deny");
      expect(r.reason).toMatch(/cannot be determined|denied — not statically parseable/);
    }
  });

  it("a relative Write with a cwd that is not an absolute path is denied, naming the cause", () => {
    const r = runPlannerHook(at("open-brain", "Write", { file_path: "notes.md", content: "x" }), { role: "planner" });
    expect(r.decision).toBe("deny");
    expect(r.reason).toContain("cannot be determined");
  });
});

describe("case — protected prefixes match case-insensitively on a Windows root", () => {
  it("predicates: ci matches OPEN-BRAIN/SRC/cli.ts and .AGENTS/STATE.JSON; case-sensitive does not", () => {
    expect(isProtectedArtifactPath("OPEN-BRAIN/SRC/cli.ts", true)).toBe(true);
    expect(isProtectedArtifactPath("OPEN-BRAIN/SRC/cli.ts")).toBe(false);
    expect(isProtectedArtifactPath("Open-Brain/Package.JSON", true)).toBe(true);
    expect(isRenderedViewPath(".AGENTS/state.JSON", true)).toBe(true);
    expect(isRenderedViewPath(".AGENTS/state.JSON")).toBe(false);
  });

  it("a Windows root yields ci, a POSIX root does not", () => {
    expect(toRepoRelative("C:/R/OPEN-BRAIN/SRC/cli.ts", "C:/r")).toMatchObject({ rel: "OPEN-BRAIN/SRC/cli.ts", ci: true });
    expect(toRepoRelative("/R/OPEN-BRAIN/SRC/cli.ts", "/R")).toMatchObject({ ci: false });
  });

  it.skipIf(process.platform !== "win32")("through the hook (Windows): an upper-case absolute path is denied", () => {
    const file_path = `${fwd}/OPEN-BRAIN/SRC/cli.ts`;
    expect(runPlannerHook(at(repo, "Edit", { file_path, old_string: "a", new_string: "b" })).decision).toBe("deny");
    expect(runPlannerHook(bashAt(repo, `echo x > "${fwd}/.AGENTS/STATE.JSON"`)).decision).toBe("deny");
    expect(runPlannerHook(bashAt(sub("OPEN-BRAIN"), "echo x > SRC/cli.ts")).decision).toBe("deny");
  });
});

describe("the prefix half of the single-invocation check (QA 234 qa-r32-prefix)", () => {
  it.each([
    "GH_REPO=other/x gh pr merge 1 --squash",
    "env GH_REPO=other/x gh pr merge 1",
  ])("%s is denied with zero fetches", async (command) => {
    const calls: string[] = [];
    const r = await runAsync(command, ["docs/a.md"], calls);
    expect(r.decision).toBe("deny");
    expect(r.reason).toContain("not a single gh pr merge invocation");
    expect(calls).toEqual([]);
  });
});

describe("the grant matches exactly", () => {
  it("a grant for `gh pr merge 1` does not cover `--repo other/x`, and is not consumed", async () => {
    writeFileSync(grantPath(repo), JSON.stringify({ command: "gh pr merge 1" }), "utf-8");
    const r = await runAsync("gh pr merge 1 --repo other/x", ["docs/a.md"]);
    expect(r.decision).toBe("deny");
    expect(readOutwardGrant(repo)).not.toBeNull();
  });

  it("a grant for `git push origin loop/x` does not cover `--force`, and is not consumed", () => {
    writeFileSync(grantPath(repo), JSON.stringify({ command: "git push origin loop/x" }), "utf-8");
    expect(runPlannerHook(bashAt(repo, "git push origin loop/x --force")).decision).toBe("deny");
    expect(readOutwardGrant(repo)).not.toBeNull();
  });

  it("the exact command, whitespace-normalised, is covered and consumes the grant", () => {
    writeFileSync(grantPath(repo), JSON.stringify({ command: "git push origin loop/x --force" }), "utf-8");
    expect(runPlannerHook(bashAt(repo, "git  push origin   loop/x --force")).decision).toBe("allow");
    expect(readOutwardGrant(repo)).toBeNull();
  });

  it("grantMatchesCommand: exact only", () => {
    const g = { command: "gh pr merge 1" };
    expect(grantMatchesCommand(g, "  gh   pr merge 1 ")).toBe(true);
    expect(grantMatchesCommand(g, "gh pr merge 1 --repo other/x")).toBe(false);
    expect(grantMatchesCommand(g, "gh pr merge 12")).toBe(false);
  });
});

describe("gh.exe and a quoted gh go through the same merge check", () => {
  it.each(["gh.exe pr merge 2", '"gh" pr merge 2', "'gh.exe' pr merge 2"])("%s with a docs-only PR is allowed, after reading it", async (command) => {
    const calls: string[] = [];
    expect((await runAsync(command, ["docs/a.md"], calls)).decision).toBe("allow");
    expect(calls.length).toBeGreaterThan(0);
  });

  it.each(["gh.exe pr merge 2", '"gh" pr merge 2'])("%s with a code PR is denied and names the merge check", async (command) => {
    const r = await runAsync(command, ["open-brain/src/cli.ts"]);
    expect(r.decision).toBe("deny");
    expect(r.reason).toContain("unlisted path");
  });

  it("gh.exe with --repo, and chained, are denied with zero fetches", async () => {
    const calls: string[] = [];
    expect((await runAsync("gh.exe pr merge 2 --repo other/x", ["docs/a.md"], calls)).decision).toBe("deny");
    expect((await runAsync('"gh" pr merge 2 && git push origin master', ["docs/a.md"], calls)).decision).toBe("deny");
    expect(calls).toEqual([]);
  });
});
