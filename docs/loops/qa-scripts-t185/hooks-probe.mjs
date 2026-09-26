#!/usr/bin/env node
// QA 120 (T-185): the three hooks run as README.md:115-117 / setup.mjs register them (no argv; payload on stdin),
// against a scratch project and scratch state. Prints exit code and first stdout/stderr lines for each.
// Usage: node hooks-probe.mjs <tree>
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, realpathSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { spawnSync } from "node:child_process";
import { pathToFileURL } from "node:url";

const tree = process.argv[2];
const TMP = realpathSync(tmpdir());
const root = mkdtempSync(join(TMP, "qa120-hooks-"));
const proj = join(root, "proj");
mkdirSync(join(proj, ".agents", "SYSTEM"), { recursive: true });
mkdirSync(join(proj, ".agents", "SESSIONS"), { recursive: true });
writeFileSync(join(proj, "package.json"), JSON.stringify({ name: "fixture", version: "1.2.3" }) + "\n");
const state = join(root, "_state"); mkdirSync(state);
const env = { ...process.env, HOME: state, USERPROFILE: state, CLAUDE_PROJECT_DIR: proj,
  KNOWLEDGE_V2_DB: join(state, "knowledge-v2.db"), OPEN_BRAIN_VAULT_DIR: join(state, "vault"),
  OPEN_BRAIN_ACTIVE_SESSION: join(state, "active-session.json"),
  OPEN_BRAIN_SCORE_HISTORY: join(state, "score-history.jsonl"), OPEN_BRAIN_SHADOW_LOG: join(state, "shadow.jsonl") };
// A real (empty, schema-initialised) v2 DB, so SessionEnd and the trigger run their pipelines rather than skip.
{
  const { openV2Database } = await import(pathToFileURL(join(tree, "open-brain", "build", "db-v2.js")).href);
  openV2Database(env.KNOWLEDGE_V2_DB).close();
  mkdirSync(env.OPEN_BRAIN_VAULT_DIR, { recursive: true });
}
const sid = "11111111-2222-3333-4444-555555555555";
const hooks = [
  ["SessionStart cli-bootstrap.js", "cli-bootstrap.js", { session_id: sid, cwd: proj, hook_event_name: "SessionStart" }],
  ["SessionEnd cli-session-end.js", "cli-session-end.js", { session_id: sid, cwd: proj, hook_event_name: "SessionEnd", transcript_path: join(state, "none.jsonl") }],
  ["PostToolUse(Bash) cli-recall-trigger.js", "cli-recall-trigger.js", { session_id: sid, cwd: proj, hook_event_name: "PostToolUse", tool_name: "Bash", tool_input: { command: "npx vitest run 2>&1 | tail -8" }, tool_response: { stdout: "" } }],
];
for (const [name, file, payload] of hooks) {
  const r = spawnSync(process.execPath, [join(tree, "open-brain", "build", file)], { cwd: proj, env, input: JSON.stringify(payload), encoding: "utf8", timeout: 120_000 });
  const first = (s) => (s || "").trim().split(/\r?\n/).filter(Boolean).slice(0, 2).join(" | ").slice(0, 200);
  console.log(`| ${name} | ${r.status} | ${first(r.stdout) || "(empty)"} | ${first(r.stderr) || "(empty)"} |`);
}
rmSync(root, { recursive: true, force: true });
