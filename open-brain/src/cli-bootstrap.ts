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
import { readAgentIdentity, readMailboxState } from "./pipelines/session-start/agent-identity.js";
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

// Agent identity — read .agents/AGENT.md if present and emit identity + mailbox state.
const identity = readAgentIdentity(cwd);
if (identity) {
  const partner = identity.partner ? `partner: ${identity.partner}` : "no partner";
  const channel = identity.mailbox_channel ? `channel: ${identity.mailbox_channel}` : "no channel";
  lines.push(`Agent: ${identity.name} (${identity.role}) — ${partner}, ${channel}`);

  if (identity.mailbox_channel && identity.partner) {
    const mailbox = readMailboxState(home, identity.mailbox_channel, identity.name, identity.partner);
    if (mailbox) {
      const msg = mailbox.messageCount > 0
        ? `${mailbox.messageCount} message${mailbox.messageCount === 1 ? "" : "s"} in ${mailbox.inboxFile}`
        : `no new messages`;
      const dec = mailbox.lastDecision ? `, last decision ${mailbox.lastDecision}` : "";
      lines.push(`Mailbox: ${msg}${dec}`);
    }
  }
}

// Health checks
const health = runHealthChecks(home);

for (const w of health.warnings) {
  lines.push("");
  lines.push(`WARNING: ${w.message}`);
}

if (health.pendingSkillProposals > 0) {
  lines.push("");
  lines.push(`Skill proposals pending: ${health.pendingSkillProposals} cluster(s) ready for review.`);
}

if (lines.length > 0) {
  console.log(lines.join("\n"));
}
