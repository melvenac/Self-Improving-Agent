/**
 * Shared fixture for the T-194 r5 tests: a temporary checkout the hook resolves as the repo, a fake
 * GitHub that answers `pulls/N` from a table, and payload builders. Nothing here registers the hook.
 */
import { mkdtempSync, realpathSync, rmSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runPlannerHook, runPlannerHookAsync } from "../../src/planner-hook/run.js";
import { grantPath } from "../../src/planner-hook/grant.js";
import type { FetchLike } from "../../src/planner-hook/prfiles.js";

export const TOKEN_ENV = { GH_TOKEN: "test-token" } as NodeJS.ProcessEnv;

/** PR 1 touches docs only; PR 2 touches source. */
export const PRS: Record<string, string[]> = { "1": ["docs/loops/x.md"], "2": ["open-brain/src/cli.ts"] };

export interface Fixture {
  repo: string;
  home: string;
  /** The checkout path with forward slashes. */
  fwd: string;
  /** True when the checkout is on a Windows drive, where NTFS folds case. */
  windows: boolean;
  calls: string[];
  /** `cwd` joined under the checkout, forward slashes. */
  sub(rel: string): string;
  payload(tool: string, tool_input: Record<string, unknown>, cwd?: string): Record<string, unknown>;
  bash(command: string, cwd?: string): ReturnType<typeof runPlannerHook>;
  ps(command: string, cwd?: string): ReturnType<typeof runPlannerHook>;
  /** Through the async entry point with the fake GitHub; records every fetch in `calls`. */
  merge(tool: "Bash" | "PowerShell", command: string, cwd?: string): ReturnType<typeof runPlannerHookAsync>;
  edit(file_path: string, cwd?: string): ReturnType<typeof runPlannerHook>;
  write(file_path: string, cwd?: string): ReturnType<typeof runPlannerHook>;
  resetGrant(): void;
  dispose(): void;
}

const DIRS = [
  ".agents/SYSTEM", ".agents/TASKS", ".agents/SESSIONS", "open-brain/src", "open-brain/tests", "open-brain/build",
  "scripts", "hooks", "docs/loops", "scratch", ".git",
];

function fakeFetch(calls: string[]): FetchLike {
  return async (url) => {
    calls.push(url);
    const m = url.match(/pulls\/(\d+)(\/files)?/);
    const files = m ? PRS[m[1]] : undefined;
    if (!files) return { ok: false, status: 404, json: async () => ({}) };
    if (m && m[2]) {
      const page = Number(new URL(url).searchParams.get("page") ?? "1");
      return { ok: true, status: 200, json: async () => (page === 1 ? files.map((filename) => ({ filename, status: "modified" })) : []) };
    }
    return { ok: true, status: 200, json: async () => ({ changed_files: files.length }) };
  };
}

export function makeFixture(label: string): Fixture {
  // The long spelling: a temp dir under an 8.3 profile name (AARONM~1) would make every outside-path row also trip the
  // short-name rule, and a row meant for the long-path prefix or the case fold could pass for that reason instead.
  const repo = realpathSync.native(mkdtempSync(join(tmpdir(), `planner-${label}-`)));
  const home = realpathSync.native(mkdtempSync(join(tmpdir(), `planner-${label}-home-`)));
  for (const d of DIRS) mkdirSync(join(repo, d), { recursive: true });
  writeFileSync(join(repo, "package.json"), '{"name":"fx"}\n', "utf-8");
  writeFileSync(join(repo, "open-brain", "package.json"), '{"name":"open-brain"}\n', "utf-8");
  writeFileSync(
    join(repo, ".git", "config"),
    '[remote "origin"]\n\turl = https://github.com/melvenac/Self-Improving-Agent.git\n',
    "utf-8",
  );
  writeFileSync(join(repo, ".agents", "AGENT.local.md"), "---\nname: Atlas\nrole: planner\npartner: Forge\n---\n", "utf-8");
  const fwd = repo.replace(/\\/g, "/");
  const calls: string[] = [];
  const sub = (rel: string): string => (rel ? `${fwd}/${rel}` : fwd);
  const payload = (tool: string, tool_input: Record<string, unknown>, cwd: string = fwd) => ({
    cwd,
    hook_event_name: "PreToolUse",
    tool_name: tool,
    tool_input,
  });
  return {
    repo,
    home,
    fwd,
    windows: /^[A-Za-z]:\//.test(fwd),
    calls,
    sub,
    payload,
    bash: (command, cwd) => runPlannerHook(payload("Bash", { command }, cwd)),
    ps: (command, cwd) => runPlannerHook(payload("PowerShell", { command }, cwd)),
    merge: (tool, command, cwd) => {
      calls.length = 0;
      return runPlannerHookAsync(payload(tool, { command }, cwd), {}, { env: TOKEN_ENV, home, fetchImpl: fakeFetch(calls) });
    },
    edit: (file_path, cwd) => runPlannerHook(payload("Edit", { file_path, old_string: "a", new_string: "b" }, cwd)),
    write: (file_path, cwd) => runPlannerHook(payload("Write", { file_path, content: "{}" }, cwd)),
    resetGrant: () => {
      if (existsSync(grantPath(repo))) rmSync(grantPath(repo));
    },
    dispose: () => {
      rmSync(repo, { recursive: true, force: true });
      rmSync(home, { recursive: true, force: true });
    },
  };
}
