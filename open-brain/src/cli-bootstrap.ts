#!/usr/bin/env node

/**
 * SessionStart hook entry point — thin CLI wrapper.
 * Reads hook input from stdin, detects subagent context (anti-loop),
 * runs health checks, and prints output for session context injection.
 *
 * Replaces scripts/session-bootstrap.mjs with compiled TypeScript.
 */

import { existsSync } from "fs";
import { join } from "path";
import { randomUUID } from "crypto";
import { runHealthChecks } from "./pipelines/session-start/health-checks.js";
import { readAgentIdentity } from "./pipelines/session-start/agent-identity.js";
import { describeDerivedArtifacts } from "./pipelines/session-start/derived-artifacts.js";
import { describeTreeCurrency } from "./pipelines/session-start/tree-currency.js";
import {
  resolveSessionId,
  writeActiveSession,
  activeSessionKey,
  currentIde,
  detectIde,
  describeWorkspaceDir,
  resolveAgentIdentity,
} from "./shared/active-session.js";
import { resolvePaths, canonicalizeProjectDir } from "./shared/paths.js";

// Anti-loop: read hook input from stdin to detect subagent context.
// Claude Code includes `agent_id` when the hook fires inside a subagent.
// The same payload carries `session_id` — the authoritative session UUID.
let hookInput: { agent_id?: string; cwd?: string; session_id?: string } = {};
try {
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) chunks.push(chunk as Buffer);
  const raw = Buffer.concat(chunks).toString().trim();
  if (raw) hookInput = JSON.parse(raw);
} catch { /* stdin unavailable — continue as main session */ }

// Anti-loop. Claude Code marks subagents with `agent_id`; Cursor marks them
// with `is_background_agent`. Neither should register a session.
if (hookInput.agent_id || (hookInput as Record<string, unknown>).is_background_agent === true) {
  process.exit(0);
}

// Cursor runs hooks with cwd set to its CONFIG dir, not the open workspace, so
// process.cwd() would key the slot under ~/.cursor and ob_set_session — which
// looks up the real workspace — would never find it. `workspace_roots` is the
// authoritative source when present.
const payload = hookInput as Record<string, unknown>;
const workspace = describeWorkspaceDir(payload, hookInput.cwd || process.cwd());
const cwd = workspace.dir;
const home = process.env.HOME || process.env.USERPROFILE || "";
const lines: string[] = [];

// Project detection
const hasAgents = existsSync(join(cwd, ".agents"));
const hasMeta = hasAgents && existsSync(join(cwd, ".agents", "META"));

if (hasAgents) {
  lines.push(`Project detected: ${cwd} (.agents/ found${hasMeta ? ", META mode" : ""})`);
} else {
  lines.push("No .agents/ detected — general session.");
}

// Tree currency, printed as early as the project line and BEFORE the seat
// identity or anything read from the record. A stale checkout answers every
// other question correctly about a version of the project that is no longer the
// current one, so a seat must learn it first rather than last. Same function
// ob_start calls — one implementation, three surfaces, for the reason
// derived-artifacts.ts states about itself: two copies of a freshness rule
// drift, and the drift is silent.
if (hasAgents) {
  for (const line of describeTreeCurrency(cwd).lines) lines.push(line);
}

// Session UUID — emit so /start can pick it up and call ob_set_session.
// Taken from the hook payload, never from a filesystem scan: at SessionStart
// this session's transcript .jsonl does not exist yet, so scanning
// ~/.claude/projects/ by mtime either finds nothing or — worse — returns the
// PREVIOUS session's UUID and mis-attributes everything stored this session.
//
// Two things changed after Cursor testing showed no UUID ever reached a Cursor
// session. First, the payload field is resolved across several spellings rather
// than only Claude Code's `session_id`. Second, when the IDE supplies no
// identifier at all we generate one: what the system needs is a STABLE
// PER-SESSION KEY, not the IDE's own id, and this hook runs exactly once per
// session. Without that, Cursor sessions had no provenance whatsoever.
const resolved = resolveSessionId(hookInput as Record<string, unknown>);
const sessionUuid = resolved?.uuid ?? randomUUID();
const uuidSource = resolved?.source ?? "generated";

lines.push(`SESSION_UUID: ${sessionUuid}`);

// Written to disk as well as printed, because printing only helps in an IDE
// that injects hook stdout into agent context. The MCP server falls back to
// this file when the agent has no UUID to pass.
// Scoped per IDE: `--ide cursor` (set by setup.mjs when it registers the Cursor
// hook), else OPEN_BRAIN_IDE, else "claude". Without this, Claude Code and
// Cursor on the same repo overwrite each other's slot and one of them adopts
// the other's session UUID.
const ideFlagIndex = process.argv.indexOf("--ide");
const registeredAs =
  ideFlagIndex >= 0 && process.argv[ideFlagIndex + 1]
    ? process.argv[ideFlagIndex + 1].toLowerCase()
    : currentIde();

// The payload wins over the flag. Cursor also executes ~/.claude/settings.json
// hooks, and that copy has no --ide flag, so registration alone would label a
// Cursor session "claude" and let it overwrite a real Claude Code slot.
const ide = detectIde(payload, registeredAs);

try {
  const projectKey = canonicalizeProjectDir(cwd) || cwd;
  writeActiveSession(resolvePaths(cwd).activeSession, activeSessionKey(projectKey, ide), {
    uuid: sessionUuid,
    project_dir: cwd,
    source: uuidSource,
    started_at: new Date().toISOString(),
    ide,
    // Diagnostic: Cursor runs hooks with cwd set to the CONFIG dir (~/.cursor,
    // ~/.claude) rather than the open workspace, so `cwd` above is wrong and the
    // slot lands under the wrong project. The workspace path must therefore come
    // from the payload — but nobody has seen Cursor's payload shape, and guessing
    // it once already produced a wrong answer (`conversation_id`). Record the
    // keys so the next hook fire reports the schema instead of us inferring it.
    // Keys only, never values: payloads can carry paths and identifiers.
    payload_keys: Object.keys(hookInput as Record<string, unknown>).sort(),
    hook_cwd: process.cwd(),
    // Keys alone could not settle whether a home-dir slot meant an empty
    // `workspace_roots` or a Cursor window genuinely opened at ~. Record which
    // input won and how many roots were on offer, so the answer is read rather
    // than re-argued.
    dir_source: workspace.dir_source,
    workspace_root_count: workspace.root_count,
    ...resolveAgentIdentity(payload),
  });
} catch { /* provenance is best-effort — never fail session start */ }

// Agent identity — read .agents/AGENT.md if present. The mailbox block that stood
// here is gone with the transport (Loop 12 C4): coordination moved to A2A and the
// durable half to docs/loops/, so there is no channel left to count messages in.
const identity = readAgentIdentity(cwd);
if (identity) {
  const partner = identity.partner ? `partner: ${identity.partner}` : "no partner";
  lines.push(`Agent: ${identity.name} (${identity.role}) — ${partner}`);
}

// Derived artifacts — the index and the build. Reported HERE as well as in
// /sync because /sync guards the commit moment, while a stale index misleads
// `impact` mid-edit and a stale build makes the MCP server answer from another
// commit, both potentially hours from any commit. Prints NOTHING when the
// artifacts are current or absent: the only output is a problem. See
// pipelines/session-start/derived-artifacts.ts for why it calls the same
// functions /sync does rather than repeating the comparison.
if (hasAgents) {
  for (const line of describeDerivedArtifacts(cwd)) {
    lines.push("");
    lines.push(line);
  }
}

// Health checks
const health = runHealthChecks(home);

for (const w of health.warnings) {
  lines.push("");
  lines.push(`WARNING: ${w.message}`);
}

if (lines.length > 0) {
  console.log(lines.join("\n"));
}
