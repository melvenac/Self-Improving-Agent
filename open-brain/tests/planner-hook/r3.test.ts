/**
 * T-194 r3 — the fixes for QA 233's REJECT of 699789e1:
 * D1 absolute paths (PH-1, PH-2, PH-6; QA probes P9-P15), D2 compound commands after a docs-only
 * merge (P3, P4), the grant prefix match, `--repo`, and D-066 (`.agents/assignments.json`, P6).
 * Every input comes from a fixture; the CLI child gets a built env, never inherited process.env (G-044).
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { mkdtempSync, rmSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnAsync } from "../spawn-async.js";
import { runPlannerHook, runPlannerHookAsync } from "../../src/planner-hook/run.js";
import { grantMatchesCommand, grantPath, readOutwardGrant } from "../../src/planner-hook/grant.js";
import { toRepoRelative } from "../../src/planner-hook/paths.js";
import type { FetchLike } from "../../src/planner-hook/prfiles.js";

const OPEN_BRAIN_ROOT = join(dirname(fileURLToPath(import.meta.url)), "../..");
const SPAWN_TIMEOUT = 60_000;
const TOKEN_ENV = { GH_TOKEN: "test-token" } as NodeJS.ProcessEnv;

let repo: string;
let home: string;
let fwd: string; // repo root, forward slashes
let back: string; // repo root, backslashes

const slashForms = (rel: string): string[] => [`${fwd}/${rel}`, `${back}\\${rel.replace(/\//g, "\\")}`];

const payload = (tool: string, tool_input: Record<string, unknown>) => ({
  cwd: repo,
  hook_event_name: "PreToolUse",
  tool_name: tool,
  tool_input,
});
const bash = (command: string) => payload("Bash", { command });

function fakeFetch(filenames: string[], calls: string[] = []): FetchLike {
  return async (url) => {
    calls.push(url);
    if (new URL(url).pathname.endsWith("/files")) {
      return { ok: true, status: 200, json: async () => filenames.map((filename) => ({ filename, status: "modified" })) };
    }
    return { ok: true, status: 200, json: async () => ({ changed_files: filenames.length }) };
  };
}

beforeAll(() => {
  repo = mkdtempSync(join(tmpdir(), "planner-r3-"));
  home = mkdtempSync(join(tmpdir(), "planner-r3-home-"));
  for (const d of [".agents/SYSTEM", ".agents/TASKS", ".agents/SESSIONS", "open-brain/src", "docs/loops", ".git"]) {
    mkdirSync(join(repo, d), { recursive: true });
  }
  writeFileSync(join(repo, "package.json"), '{"name":"fixture"}\n', "utf-8");
  writeFileSync(join(repo, "open-brain", "package.json"), '{"name":"open-brain"}\n', "utf-8");
  writeFileSync(
    join(repo, ".git", "config"),
    '[remote "origin"]\n\turl = https://github.com/melvenac/Self-Improving-Agent.git\n',
    "utf-8",
  );
  fwd = repo.replace(/\\/g, "/");
  back = repo.replace(/\//g, "\\");
});

afterAll(() => {
  rmSync(repo, { recursive: true, force: true });
  rmSync(home, { recursive: true, force: true });
});

beforeEach(() => {
  writeFileSync(join(repo, ".agents", "AGENT.local.md"), "---\nname: Atlas\nrole: planner\npartner: Forge\n---\n", "utf-8");
  if (existsSync(grantPath(repo))) rmSync(grantPath(repo));
});

describe("D1 / PH-1 — an absolute path to source is denied (P9, P10, P13)", () => {
  it.each([0, 1])("Edit open-brain/src/cli.ts, absolute, slash form %i", (i) => {
    const file_path = slashForms("open-brain/src/cli.ts")[i];
    const r = runPlannerHook(payload("Edit", { file_path, old_string: "a", new_string: "b" }));
    expect(r.decision).toBe("deny");
    expect(r.reason).toContain('planner.md, "Authority"');
    expect(r.reason).toContain(file_path);
  });

  it("through the real CLI: absolute target exits 2 with a deny, like the relative one (P13 vs P14)", async () => {
    const env = {
      PATH: process.env.PATH ?? "",
      SystemRoot: process.env.SystemRoot ?? "",
      ComSpec: process.env.ComSpec ?? "",
      APPDATA: process.env.APPDATA ?? "",
      CLAUDE_PROJECT_DIR: repo,
    } as NodeJS.ProcessEnv;
    const run = async (file_path: string) => {
      const r = await spawnAsync("npx", ["tsx", "src/cli-planner-hook.ts"], {
        input: JSON.stringify(payload("Edit", { file_path, old_string: "a", new_string: "b" })),
        env,
        shell: true,
        cwd: OPEN_BRAIN_ROOT,
      });
      return { status: r.status ?? -1, stdout: r.stdout ?? "" };
    };
    const abs = await run(slashForms("open-brain/src/cli.ts")[1]);
    expect(abs.status).toBe(2);
    expect(abs.stdout).toContain('"permissionDecision"');
    expect((await run("open-brain/src/cli.ts")).status).toBe(2);
  }, SPAWN_TIMEOUT);
});

describe("D1 / PH-2 — an absolute state.json or view is denied (P11)", () => {
  it.each([
    [".agents/state.json", 0],
    [".agents/state.json", 1],
    [".agents/TASKS/INBOX.md", 0],
    [".agents/TASKS/INBOX.md", 1],
  ])("Write %s, absolute, slash form %i", (rel, i) => {
    const file_path = slashForms(rel)[i];
    const r = runPlannerHook(payload("Write", { file_path, content: "{}" }));
    expect(r.decision).toBe("deny");
    expect(r.reason).toContain("ob_state");
  });
});

describe("D1 / PH-6 — an absolute Bash write target is denied (P15)", () => {
  it.each([0, 1])("redirect into open-brain/src, absolute, slash form %i", (i) => {
    const r = runPlannerHook(bash(`echo x > ${slashForms("open-brain/src/hit.ts")[i]}`));
    expect(r.decision).toBe("deny");
    expect(r.reason).toContain("not a sandbox");
  });

  it.each([
    (t: string) => `sed -i s/a/b ${t}`,
    (t: string) => `cat x | tee ${t}`,
    (t: string) => `cp README.md ${t}`,
    (t: string) => `mv README.md ${t}`,
  ])("sed/tee/cp/mv with an absolute target (form %#)", (mk) => {
    expect(runPlannerHook(bash(mk(slashForms("open-brain/src/hit.ts")[0]))).decision).toBe("deny");
    expect(runPlannerHook(bash(mk(`${fwd}/.agents/state.json`))).decision).toBe("deny");
  });

  it("a redirect to /dev/null and to a docs path inside the repo are still allowed", () => {
    expect(runPlannerHook(bash("git status 2>/dev/null")).decision).toBe("allow");
    expect(runPlannerHook(bash(`echo x > "${fwd}/docs/loops/note.md"`)).decision).toBe("allow");
  });

  it("a QUOTED absolute target (a repo path with spaces) is resolved whole, not cut at the space", () => {
    const spaced = "/Users/A B/proj";
    expect(toRepoRelative(`${spaced}/open-brain/src/a.ts`, spaced)).toEqual({ ok: true, rel: "open-brain/src/a.ts" });
    for (const q of ['"', "'"]) {
      const cmd = `echo x > ${q}${fwd}/open-brain/src/hit.ts${q}`;
      expect(runPlannerHook(bash(cmd)).decision).toBe("deny");
    }
    expect(runPlannerHook(bash(`cp README.md "${fwd}/.agents/state.json"`)).decision).toBe("deny");
  });
});

describe("D1 — outside the repo, or not made relative, is denied with a cause", () => {
  it("an absolute Write outside the repo is denied and says so", () => {
    const outside = `${dirname(fwd)}/elsewhere/x.md`;
    const r = runPlannerHook(payload("Write", { file_path: outside, content: "x" }));
    expect(r.decision).toBe("deny");
    expect(r.reason).toContain("outside the repository");
  });

  it("a relative path that climbs out of the repo is denied", () => {
    const r = runPlannerHook(payload("Write", { file_path: "../elsewhere/x.md", content: "x" }));
    expect(r.decision).toBe("deny");
    expect(r.reason).toContain("climbs out of the repository");
  });

  it("an absolute Bash redirect outside the repo is denied and says so", () => {
    const r = runPlannerHook(bash(`echo x > ${dirname(fwd)}/elsewhere/x.txt`));
    expect(r.decision).toBe("deny");
    expect(r.reason).toContain("outside the repository");
  });

  it("an absolute docs/loops Write inside the repo is still allowed (both forms)", () => {
    for (const file_path of slashForms("docs/loops/t194-brief.md")) {
      expect(runPlannerHook(payload("Write", { file_path, content: "# b\n" })).decision).toBe("allow");
    }
  });

  it("toRepoRelative: both slash forms, Git Bash /c/ form, drive case, dot segments", () => {
    expect(toRepoRelative("C:\\r\\open-brain\\src\\a.ts", "C:/r")).toEqual({ ok: true, rel: "open-brain/src/a.ts" });
    expect(toRepoRelative("c:/R/open-brain/src/a.ts", "C:\\r")).toEqual({ ok: true, rel: "open-brain/src/a.ts" });
    expect(toRepoRelative("/c/r/docs/x.md", "C:/r")).toEqual({ ok: true, rel: "docs/x.md" });
    expect(toRepoRelative("C:/r/docs/../open-brain/src/a.ts", "C:/r")).toEqual({ ok: true, rel: "open-brain/src/a.ts" });
    expect(toRepoRelative("./docs/x.md", "C:/r")).toEqual({ ok: true, rel: "docs/x.md" });
    expect(toRepoRelative("C:/rx/docs/x.md", "C:/r").ok).toBe(false);
    expect(toRepoRelative("C:/r/../other/x", "C:/r").ok).toBe(false);
    expect(toRepoRelative("/tmp/repo/scripts/a.sh", "/tmp/repo")).toEqual({ ok: true, rel: "scripts/a.sh" });
  });
});

describe("D2 — a docs-only merge allows nothing chained after it (P3, P4)", () => {
  const run = (command: string, files: string[], calls: string[] = []) =>
    runPlannerHookAsync(bash(command), {}, { env: TOKEN_ENV, home, fetchImpl: fakeFetch(files, calls) });

  it("P3: docs merge && force push to master is denied", async () => {
    const r = await run("gh pr merge 12 --squash && git push --force origin master", ["docs/a.md"]);
    expect(r.decision).toBe("deny");
  });

  it("P4: docs merge && a second merge is denied, and no file list is read for it", async () => {
    const calls: string[] = [];
    const r = await run("gh pr merge 12 && gh pr merge 13", ["docs/a.md"], calls);
    expect(r.decision).toBe("deny");
    expect(r.reason).toContain("not a single gh pr merge invocation");
    expect(calls).toEqual([]);
  });

  it.each([
    "gh pr merge 12 || echo x",
    "gh pr merge 12 ; echo x",
    "gh pr merge 12 | cat",
    "gh pr merge 12\ngit push origin master",
    "gh pr merge 12 --body $(whoami)",
    "gh pr merge 12 --body `whoami`",
    "(gh pr merge 12)",
    "gh pr merge 12 & echo x",
    "echo hi && gh pr merge 12",
  ])("compound %j is denied without a grant", async (command) => {
    expect((await run(command, ["docs/a.md"])).decision).toBe("deny");
  });

  it("the single invocation is still allowed with no grant (positive control)", async () => {
    expect((await run("gh pr merge 12 --squash --delete-branch", ["docs/a.md"])).decision).toBe("allow");
  });

  it("a compound line falls through to the grant: an exact grant for the whole line allows it, once", async () => {
    const cmd = "gh pr merge 12 && gh pr merge 13";
    writeFileSync(grantPath(repo), JSON.stringify({ command: cmd }), "utf-8");
    expect((await run(cmd, ["docs/a.md"])).decision).toBe("allow");
    expect(existsSync(grantPath(repo))).toBe(false);
  });
});

describe("grant prefix match applies the same single-invocation rule", () => {
  it("a grant for `gh pr merge 5` does not cover `gh pr merge 5 && git push --force origin master`", () => {
    writeFileSync(grantPath(repo), JSON.stringify({ command: "gh pr merge 5" }), "utf-8");
    const r = runPlannerHook(bash("gh pr merge 5 && git push --force origin master"));
    expect(r.decision).toBe("deny");
    expect(readOutwardGrant(repo)).not.toBeNull(); // not consumed by the refused line
  });

  it("the grant still covers its own invocation with flags, and is consumed", () => {
    writeFileSync(grantPath(repo), JSON.stringify({ command: "gh pr merge 5" }), "utf-8");
    expect(runPlannerHook(bash("gh pr merge 5 --squash")).decision).toBe("allow");
    expect(readOutwardGrant(repo)).toBeNull();
  });

  it("grantMatchesCommand: prefix plus a chain, a pipe or a substitution does not match", () => {
    const g = { command: "git push origin loop/x" };
    expect(grantMatchesCommand(g, "git push origin loop/x")).toBe(true);
    expect(grantMatchesCommand(g, "git push origin loop/x --no-verify")).toBe(true);
    expect(grantMatchesCommand(g, "git push origin loop/x && rm -rf /")).toBe(false);
    expect(grantMatchesCommand(g, "git push origin loop/x | sh")).toBe(false);
    expect(grantMatchesCommand(g, "git push origin loop/x $(id)")).toBe(false);
  });
});

describe("--repo never checks origin's PR N", () => {
  it.each([
    "gh pr merge 5 --repo other/x",
    "gh pr merge 5 -R other/x",
    "gh pr merge 5 --repo=other/x",
  ])("%s is denied naming --repo, with no read of origin's PR", async (command) => {
    const calls: string[] = [];
    const r = await runPlannerHookAsync(bash(command), {}, { env: TOKEN_ENV, home, fetchImpl: fakeFetch(["docs/a.md"], calls) });
    expect(r.decision).toBe("deny");
    expect(r.reason).toContain("--repo");
    expect(calls).toEqual([]);
  });
});

describe("D-066 — .agents/assignments.json is on the docs-merge allowlist (P6)", () => {
  it("a PR touching only docs and .agents/assignments.json merges with no grant", async () => {
    const r = await runPlannerHookAsync(
      bash("gh pr merge 12 --squash"),
      {},
      { env: TOKEN_ENV, home, fetchImpl: fakeFetch(["docs/a.md", ".agents/assignments.json"]) },
    );
    expect(r.decision).toBe("allow");
  });
});
