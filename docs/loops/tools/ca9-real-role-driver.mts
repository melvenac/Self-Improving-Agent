/**
 * CA-9 — the first real ProcessRole run. One loop, a scratch repo with no
 * remote, the developer seat played by headless `claude -p` through the
 * runtime. Everything the runtime records is written to this directory.
 */
import { execFileSync } from "node:child_process";
import { appendFileSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { runLoop } from "../../../open-brain/src/harness/runtime.ts";
import { claudeAdapter, ProcessRole, StubPlanner, StubQa } from "../../../open-brain/src/harness/roles.ts";

// Output goes to a temp dir; pass another as argv[2].
const out = process.argv[2] ?? require_tmp();
function require_tmp(): string {
  return join(tmpdir(), `hoh-ca9-${Date.now()}`);
}
const repo = join(out, `target-${Date.now()}`);
mkdirSync(out, { recursive: true });
mkdirSync(repo, { recursive: true });
const g = (args: string[]) => execFileSync("git", args, { cwd: repo, encoding: "utf-8" }).trim();
g(["init", "--initial-branch=main"]);
g(["config", "user.name", "CA-9 scratch"]);
g(["config", "user.email", "ca9@example.invalid"]);
writeFileSync(join(repo, "README.md"), "# CA-9 scratch target\n");
g(["add", "README.md"]);
g(["commit", "--no-verify", "--no-gpg-sign", "-m", "base"]);

// A sentinel in the PARENT, so the child's own printed environment can show it absent.
process.env.TYPESAFE_API_KEY = "ca9-sentinel-not-a-real-key";
process.env.CLAUDE_CODE_CHILD_SESSION = "1";

const logFile = join(out, "loop.log");
writeFileSync(logFile, "");
const log = (l: string) => appendFileSync(logFile, `${new Date().toISOString()} ${l}\n`);

const planner = new StubPlanner({
  objective: "docs/hello.md exists and contains exactly one line: hello from the developer role",
  tasks: [
    "Create docs/hello.md with exactly one line: hello from the developer role",
    "Run this command and put its exact output, as one string, in R_t.claims: node -e \"console.log(['TYPESAFE_API_KEY','CLAUDE_CODE_CHILD_SESSION','CLAUDE_CODE_FORCE_SESSION_PERSISTENCE'].map(k=>k+'='+(process.env[k]===undefined?'<absent>':process.env[k])).join(';'))\"",
  ],
  out_of_scope: ["any other file"],
  preserve: ["README.md is unchanged"],
  acceptance: [{ id: "A1", observable: "docs/hello.md contains exactly: hello from the developer role", type: "blackbox" }],
  repair_targets: [],
  new_capability: "a model-backed developer role completes a stage inside the HoH runtime",
});

const developer = new ProcessRole("developer", { adapter: claudeAdapter(), timeoutMs: 15 * 60_000 });

const started = new Date().toISOString();
const r = await runLoop({
  repoRoot: repo,
  loop: "t001",
  roles: { planner, developer, qa: new StubQa() },
  developerAllowlist: ["docs/hello.md", "artifacts/iterations/t001/"],
  checks: {
    build: { command: process.execPath, args: ["-e", "process.exit(0)"], timeoutMs: 30_000 },
    unit: {
      command: process.execPath,
      args: ["-e", "const t=require('fs').readFileSync('docs/hello.md','utf8');process.exit(t.trim()==='hello from the developer role'?0:1)"],
      timeoutMs: 30_000,
    },
  },
  log,
});
const finished = new Date().toISOString();

writeFileSync(
  join(out, "result.json"),
  JSON.stringify(
    {
      started,
      finished,
      repo,
      status: r.status,
      exitCode: r.exitCode,
      failure: r.failure,
      baseSha: r.baseSha,
      candidateSha: r.candidateSha,
      evidenceSha: r.evidenceSha,
      tags: r.tags,
      checks: r.checks,
      configVerdicts: r.configVerdicts.map((v) => ({ stage: v.stage, ok: v.ok, examined: v.examined, changes: v.changes })),
      machineConfigFindings: r.machineConfigFindings,
      findings: r.findings,
      developerReport: r.developerReport,
      developerRun: r.developerRun,
    },
    null,
    2,
  ),
);
console.log(`status=${r.status} exit=${r.exitCode} failure=${r.failure?.code ?? "none"} candidate=${r.candidateSha ?? "-"}`);
