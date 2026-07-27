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
import { runHealthChecks } from "./pipelines/session-start/health-checks.js";
import { readAgentIdentity, readMailboxState } from "./pipelines/session-start/agent-identity.js";

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

if (hookInput.agent_id) {
  process.exit(0);
}

const cwd = hookInput.cwd || process.cwd();
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
if (hookInput.session_id) {
  lines.push(`SESSION_UUID: ${hookInput.session_id}`);
}

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
