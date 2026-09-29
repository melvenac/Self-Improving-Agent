import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { mkdtempSync, rmSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnAsync } from "../spawn-async.js";
import { runPlannerHook } from "../../src/planner-hook/run.js";
import { formatDeny } from "../../src/planner-hook/emit.js";
import { grantPath, readOutwardGrant } from "../../src/planner-hook/grant.js";
import { SUMMARY_BEGIN, SUMMARY_END } from "../../src/pipelines/state-views/index.js";

const OPEN_BRAIN_ROOT = join(dirname(fileURLToPath(import.meta.url)), "../..");
const HOOK = "src/cli-planner-hook.ts";
const SPAWN_TIMEOUT = 60_000;

let repo: string;

function writeAgentLocal(role: string): void {
  writeFileSync(
    join(repo, ".agents", "AGENT.local.md"),
    `---\nname: Atlas\nrole: ${role}\npartner: Forge\n---\n`,
    "utf-8",
  );
}

function writeSummary(outsideProse = "# Project Summary\n\n## Notes\n\nProse stays.\n"): string {
  const region = `${SUMMARY_BEGIN}\n> generated\n${SUMMARY_END}`;
  const content = `${outsideProse}\n${region}\n`;
  mkdirSync(join(repo, ".agents", "SYSTEM"), { recursive: true });
  writeFileSync(join(repo, ".agents", "SYSTEM", "SUMMARY.md"), content, "utf-8");
  return content;
}

function payload(tool: string, tool_input: Record<string, unknown>) {
  return { cwd: repo, hook_event_name: "PreToolUse", tool_name: tool, tool_input };
}

async function runHookCli(body: unknown): Promise<{ status: number; stdout: string; stderr: string }> {
  const r = await spawnAsync("npx", ["tsx", HOOK], {
    input: JSON.stringify(body),
    env: { ...process.env, CLAUDE_PROJECT_DIR: repo },
    shell: true,
    cwd: OPEN_BRAIN_ROOT,
  });
  return { status: r.status ?? -1, stdout: r.stdout ?? "", stderr: r.stderr ?? "" };
}

beforeAll(() => {
  repo = mkdtempSync(join(tmpdir(), "planner-hook-"));
  mkdirSync(join(repo, ".agents"), { recursive: true });
  mkdirSync(join(repo, ".agents", "SYSTEM"), { recursive: true });
  mkdirSync(join(repo, ".agents", "TASKS"), { recursive: true });
  mkdirSync(join(repo, ".agents", "SESSIONS"), { recursive: true });
  mkdirSync(join(repo, "open-brain", "src"), { recursive: true });
  mkdirSync(join(repo, "docs", "loops"), { recursive: true });
  writeFileSync(join(repo, "package.json"), '{"name":"fixture"}\n', "utf-8");
  writeFileSync(join(repo, "open-brain", "package.json"), '{"name":"open-brain"}\n', "utf-8");
});

afterAll(() => rmSync(repo, { recursive: true, force: true }));

beforeEach(() => {
  writeAgentLocal("planner");
  const g = grantPath(repo);
  if (existsSync(g)) rmSync(g);
});

describe("PH-1 — artifact writes denied", () => {
  it.each([
    ["Edit", { file_path: "open-brain/src/cli.ts", old_string: "a", new_string: "b" }],
    ["Write", { file_path: "open-brain/tests/foo.test.ts", content: "x" }],
    ["NotebookEdit", { notebook_path: "scripts/notebook.ipynb", cell_idx: 0, is_new_cell: true, cell_language: "python", old_string: "", new_string: "x" }],
    ["Write", { file_path: "package.json", content: "{}" }],
  ])("%s to protected path is denied and names planner.md Authority", (tool, input) => {
    const r = runPlannerHook(payload(tool, input));
    expect(r.decision).toBe("deny");
    expect(r.reason).toContain('planner.md, "Authority"');
    expect(r.reason).toContain(input.file_path ?? input.notebook_path);
  });
});

describe("PH-2 — rendered views and state.json denied", () => {
  it.each([
    ".agents/TASKS/INBOX.md",
    ".agents/TASKS/task.md",
    ".agents/SESSIONS/next-session.md",
    ".agents/state.json",
  ])("Edit %s is denied and names ob_state", (path) => {
    const r = runPlannerHook(payload("Edit", { file_path: path, old_string: "a", new_string: "b" }));
    expect(r.decision).toBe("deny");
    expect(r.reason).toContain("ob_state");
    expect(r.reason).toContain(path);
  });

  it("Edit outside SUMMARY marked region passes", () => {
    const content = writeSummary();
    const r = runPlannerHook(
      payload("Edit", {
        file_path: ".agents/SYSTEM/SUMMARY.md",
        old_string: "Prose stays.",
        new_string: "Prose edited.",
      }),
      { summaryContent: content },
    );
    expect(r.decision).toBe("allow");
  });

  it("Edit inside SUMMARY marked region is denied", () => {
    const content = writeSummary();
    const r = runPlannerHook(
      payload("Edit", {
        file_path: ".agents/SYSTEM/SUMMARY.md",
        old_string: "> generated",
        new_string: "> tampered",
      }),
      { summaryContent: content },
    );
    expect(r.decision).toBe("deny");
    expect(r.reason).toContain("SUMMARY.md marked region");
  });
});

describe("PH-3 — outward git acts need grant", () => {
  it.each([
    "git merge origin/master",
    "git tag v1.0.0",
    "git push --tags",
    "git push --force origin loop/x",
    "git push origin master",
    "gh pr merge 99 --merge",
  ])("denies %s without grant and names D-038/D-032", (command) => {
    const r = runPlannerHook(payload("Bash", { command }));
    expect(r.decision).toBe("deny");
    expect(r.reason).toContain("D-038");
  });

  it("allows restricted command once when grant file exists, then consumes it", () => {
    writeFileSync(grantPath(repo), JSON.stringify({ command: "git merge origin/master" }), "utf-8");
    const cmd = "git merge origin/master";
    expect(runPlannerHook(payload("Bash", { command: cmd })).decision).toBe("allow");
    expect(readOutwardGrant(repo)).toBeNull();
    expect(runPlannerHook(payload("Bash", { command: cmd })).decision).toBe("deny");
  });
});

describe("PH-4 — allowed planner acts", () => {
  it("Write under docs/loops/ passes", () => {
    const r = runPlannerHook(
      payload("Write", { file_path: "docs/loops/t194-brief.md", content: "# brief\n" }),
    );
    expect(r.decision).toBe("allow");
  });

  it.each([
    "git status",
    "git log -1",
    "git fetch origin",
    "git diff HEAD",
    "git push origin docs/my-branch",
    "git push origin loop/t194-planner-hook",
  ])("Bash %s passes without grant", (command) => {
    expect(runPlannerHook(payload("Bash", { command })).decision).toBe("allow");
  });

  it("gh pr merge allowlist is testable via injected prChangedPaths (live path uses PH-3 grant)", () => {
    const r = runPlannerHook(payload("Bash", { command: "gh pr merge 12 --merge" }), {
      prChangedPaths: () => ["docs/loops/x.md", "README.md"],
    });
    expect(r.decision).toBe("allow");
  });

  it("gh pr merge without grant is denied on the live hook path", () => {
    expect(runPlannerHook(payload("Bash", { command: "gh pr merge 12 --merge" })).decision).toBe("deny");
  });
});

describe("PH-5 — fail closed and non-planner passthrough", () => {
  it("missing AGENT.local.md is denied", () => {
    rmSync(join(repo, ".agents", "AGENT.local.md"));
    const r = runPlannerHook(payload("Read", { file_path: "docs/x.md" }));
    expect(r.decision).toBe("deny");
    expect(r.reason).toContain("AGENT.local.md");
  });

  it("malformed frontmatter is denied", () => {
    writeFileSync(join(repo, ".agents", "AGENT.local.md"), "no frontmatter\n", "utf-8");
    const r = runPlannerHook(payload("Read", { file_path: "docs/x.md" }));
    expect(r.decision).toBe("deny");
    expect(r.reason).toContain("role");
  });

  it("developer role passes through", () => {
    const r = runPlannerHook(payload("Write", { file_path: "open-brain/src/x.ts", content: "x" }), {
      role: "developer",
    });
    expect(r.decision).toBe("passthrough");
  });
});

describe("PH-6 — Bash write detection", () => {
  it.each([
    "echo x > open-brain/src/hit.ts",
    "sed -i s/a/b open-brain/src/hit.ts",
    "cat x | tee open-brain/src/hit.ts",
    "cp README.md open-brain/src/hit.ts",
    "mv README.md .agents/state.json",
  ])("denies %s and states the static limit", (command) => {
    const r = runPlannerHook(payload("Bash", { command }));
    expect(r.decision).toBe("deny");
    expect(r.reason).toContain("not a sandbox");
  });
});

describe("PH-7 — JSON parser, not text matching", () => {
  it("CLI denies malformed JSON with exit 2 and permissionDecision", async () => {
    const r = await spawnAsync("npx", ["tsx", HOOK], {
      input: '{ "tool_name": "Bash", ',
      env: { ...process.env, CLAUDE_PROJECT_DIR: repo },
      shell: true,
      cwd: OPEN_BRAIN_ROOT,
    });
    expect(r.status).toBe(2);
    const out = JSON.parse(r.stdout ?? "{}") as {
      hookSpecificOutput: { permissionDecision: string; permissionDecisionReason: string };
    };
    expect(out.hookSpecificOutput.permissionDecision).toBe("deny");
    expect(out.hookSpecificOutput.permissionDecisionReason).toContain("JSON");
  }, SPAWN_TIMEOUT);
});

describe("PH-8 — CLI deny contract and Windows paths", () => {
  it("denied Edit exits 2 with permissionDecision deny on stdout", async () => {
    const r = await runHookCli({
      cwd: repo,
      hook_event_name: "PreToolUse",
      tool_name: "Edit",
      tool_input: {
        file_path: "open-brain\\src\\cli.ts",
        old_string: "a",
        new_string: "b",
      },
    });
    expect(r.status).toBe(2);
    expect(r.stderr).toBe("");
    const out = JSON.parse(r.stdout) as {
      hookSpecificOutput: { permissionDecision: string; hookEventName: string };
    };
    expect(out.hookSpecificOutput.hookEventName).toBe("PreToolUse");
    expect(out.hookSpecificOutput.permissionDecision).toBe("deny");
  });

  it("allowed docs/loops Write exits 0 with empty stdout", async () => {
    const r = await runHookCli({
      cwd: repo,
      hook_event_name: "PreToolUse",
      tool_name: "Write",
      tool_input: { file_path: "docs/loops/live.md", content: "ok" },
    });
    expect(r.status).toBe(0);
    expect(r.stdout.trim()).toBe("");
  });

  it("non-planner role exits 0 (passthrough) even for artifact path", async () => {
    writeAgentLocal("developer");
    const r = await runHookCli({
      cwd: repo,
      hook_event_name: "PreToolUse",
      tool_name: "Write",
      tool_input: { file_path: "open-brain/src/x.ts", content: "x" },
    });
    expect(r.status).toBe(0);
  });
}, SPAWN_TIMEOUT);

describe("registration snippet", () => {
  it("--print-registration emits PreToolUse matcher and build path", async () => {
    const r = await spawnAsync("npx", ["tsx", HOOK, "--print-registration"], {
      env: { ...process.env, CLAUDE_PROJECT_DIR: repo },
      shell: true,
      cwd: OPEN_BRAIN_ROOT,
    });
    expect(r.status).toBe(0);
    expect(r.stdout).toContain("cli-planner-hook.js");
    expect(r.stdout).toContain("PreToolUse");
    expect(r.stdout).toContain("Edit|Write|NotebookEdit|Bash");
  }, SPAWN_TIMEOUT);
});

describe("formatDeny", () => {
  it("never embeds permissionDecision as a substring hunt over raw JSON text", () => {
    const line = formatDeny('test "quotes" and \\ slashes');
    const parsed = JSON.parse(line.trim());
    expect(parsed.hookSpecificOutput.permissionDecision).toBe("deny");
  });
});
