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
import { describeRoleFiles } from "./pipelines/session-start/role-files.js";
import { describeDerivedArtifacts } from "./pipelines/session-start/derived-artifacts.js";
import { describeTreeCurrency, fetchOrigin } from "./pipelines/session-start/tree-currency.js";
import { describeDriftLine } from "./pipelines/session-start/drift-line.js";
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
import { byPidDir, findCursorAgentHostPid, processStartTime, writeProcessSession } from "./shared/process-session.js";
import { takeMissingHandoffNotices } from "./shared/handoff-guard.js";

// Anti-loop: read hook input from stdin to detect subagent context.
// Claude Code includes `agent_id` when the hook fires inside a subagent.
// The same payload carries `session_id` — the authoritative session UUID.
let hookInput: { agent_id?: string; cwd?: string; session_id?: string } = {};
{
  let raw = "";
  try {
    const chunks: Buffer[] = [];
    for await (const chunk of process.stdin) chunks.push(chunk as Buffer);
    raw = Buffer.concat(chunks).toString().trim();
  } catch {
    // stdin genuinely unavailable — no payload was offered. Continue: an IDE
    // that supplies nothing is a supported case, and is why a uuid is generated
    // below rather than demanded.
  }
  if (raw) {
    try {
      hookInput = JSON.parse(raw);
    } catch (err) {
      // F4: a payload that was OFFERED and could not be parsed is refused, and
      // NOTHING is written.
      //
      // This used to be swallowed. The hook then fell through with an empty
      // payload, read `process.cwd()` — the shell's directory, not the session's
      // — printed a plausible greeting for the wrong project, GENERATED a session
      // uuid and stamped it into that project's slot. Every part of that looks
      // right and none of it is: it is G-044's family, an instrument that changes
      // what it measures while answering about somewhere else.
      //
      // Observed twice from two seats, both times through the same mechanism: a
      // Windows path in the payload whose backslashes are invalid JSON escapes.
      //
      // Absent and malformed are different and must not be treated alike. Absent
      // is supported; malformed means the caller tried to say something and this
      // process could not hear it, and proceeding invents the answer.
      process.stderr.write(
        `SessionStart hook REFUSED: the payload on stdin is not valid JSON — ${err instanceof Error ? err.message : String(err)}\n` +
          `Nothing was written: no session was registered and no identity was resolved. ` +
          `A malformed payload is not an absent one; proceeding would have greeted this shell's working directory with a generated session id.\n`,
      );
      process.exit(1);
    }
  }
}

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

// Payload, then the registration flag. The proof block below must use this
// same result: detectIde(payload, "claude") ignores `--ide cursor`, and a
// Cursor hook launched from a Claude shell would write a Claude proof (D5).
const ideFlagIndex = process.argv.indexOf("--ide");
const registeredAs =
  ideFlagIndex >= 0 && process.argv[ideFlagIndex + 1]
    ? process.argv[ideFlagIndex + 1].toLowerCase()
    : currentIde();
const ide = detectIde(payload, registeredAs);
const lines: string[] = [];

// T-003: the SESSION PROOF, written FIRST — before anything slow — because the
// host runs no tool call of this session until this hook has finished (measured
// 3 of 3, T-003 Step 0b), and a proof that lands late is a window in which the
// server reads the previous session's. The server reads the file named by its
// own parent pid; see shared/process-session.ts.
//
// CLAUDE_PID is right HERE: the host sets it for hooks, to the claude process
// the hook belongs to (measured, even when claude was launched from another
// session). The server must not read it; its copy is inherited.
//
// Written only from a payload id (never a generated one: the proof is the
// host's word, not ours), only for Claude Code (another host sets no
// CLAUDE_PID, and a Cursor server may not attribute: ruling Q2), and never with
// an unreadable start time (the server would refuse it anyway).
const proofLine: string = (() => {
  const payloadId = resolveSessionId(hookInput as Record<string, unknown>);
  const claudePid = Number(process.env.CLAUDE_PID);
  if (!payloadId) return "Session proof NOT written: the payload carried no session id.";
  if (ide === "cursor") {
    if (payload.cursor_version === undefined || payload.cursor_version === null) {
      return "Session proof NOT written: cursor payload has no cursor_version (D5), so this session's server will refuse attributed writes.";
    }
    const hostPid = findCursorAgentHostPid(process.pid);
    if (hostPid === null) {
      return "Session proof NOT written: no cursor-agent host process found in the hook's ancestor chain, so this session's server will refuse attributed writes.";
    }
    const procStart = processStartTime(hostPid);
    if (procStart === null) {
      return `Session proof NOT written: the start time of cursor-agent host process ${hostPid} could not be read, so this session's server will refuse attributed writes.`;
    }
    try {
      writeProcessSession(byPidDir(resolvePaths(cwd).activeSession), {
        session_id: payloadId.uuid,
        claude_pid: hostPid,
        proc_start: procStart,
        ide: "cursor",
        written_at: new Date().toISOString(),
        ...(typeof payload.transcript_path === "string" ? { transcript_path: payload.transcript_path } : {}),
      });
      return `Session proof written: session ${payloadId.uuid} for cursor-agent host process ${hostPid}.`;
    } catch (err) {
      return `Session proof NOT written: ${err instanceof Error ? err.message : String(err)} — this session's server will refuse attributed writes.`;
    }
  }
  if (ide !== "claude") return "Session proof NOT written: this host is not Claude Code, so its server cannot attribute writes (T-003, ruling Q2).";
  if (!Number.isInteger(claudePid) || claudePid <= 0) return `Session proof NOT written: CLAUDE_PID is ${process.env.CLAUDE_PID === undefined ? "unset" : `"${process.env.CLAUDE_PID}"`}, so the claude process is unknown and this session's server will refuse attributed writes.`;
  const procStart = processStartTime(claudePid);
  if (procStart === null) return `Session proof NOT written: the start time of claude process ${claudePid} could not be read, so this session's server will refuse attributed writes.`;
  try {
    writeProcessSession(byPidDir(resolvePaths(cwd).activeSession), {
      session_id: payloadId.uuid,
      claude_pid: claudePid,
      proc_start: procStart,
      ide: "claude",
      written_at: new Date().toISOString(),
      ...(typeof payload.transcript_path === "string" ? { transcript_path: payload.transcript_path } : {}),
    });
    return `Session proof written: session ${payloadId.uuid} for claude process ${claudePid}.`;
  } catch (err) {
    return `Session proof NOT written: ${err instanceof Error ? err.message : String(err)} — this session's server will refuse attributed writes.`;
  }
})();

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
  // T-208: fetch FIRST (bounded, pruning), on every SessionStart event: the hook
  // is registered without a matcher, so startup and resume take this one path.
  // The outcome rides into the currency lines, which say so when it failed.
  for (const line of describeTreeCurrency(cwd, { fetch: fetchOrigin(cwd) }).lines) lines.push(line);
  // T-208 r3: drift beside currency, on startup and resume (same check ob_start reports).
  lines.push(describeDriftLine(cwd));
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
lines.push(proofLine);

// Written to disk as well as printed, because printing only helps in an IDE
// that injects hook stdout into agent context. The MCP server falls back to
// this file when the agent has no UUID to pass.
// `ide` is the payload-then-flag result computed above, shared with the proof
// block. Cursor also executes ~/.claude/settings.json hooks, and that copy has
// no --ide flag, so registration alone would label a Cursor session "claude".

// THE SLOT IS WRITTEN ONLY WHEN THE PAYLOAD SUPPLIED AN ID.
//
// A generated uuid is fine to PRINT — /start picks it up and registers it, and a
// stable per-session key is what the system needs. Writing it into the
// checkout's slot is a different act: the slot is that checkout's session
// identity, read as a fallback by every later write, and stamping a value
// nobody asked for over it is the defect regardless of the payload's shape.
//
// It cost this loop a real session: running the hook to check which seat a
// checkout is overwrote that checkout's live session id with a generated one.
// Checking identity reassigned identity.
//
// Absence is reported rather than silent, because a slot that was not written
// and a slot that was written with the right value look identical afterwards.
if (!resolved) {
  lines.push(
    `Session slot NOT written: the payload carried no session id, so nothing was stamped over this checkout's identity. ` +
      `The id above is generated for this greeting; register it with ob_set_session.`,
  );
}

try {
  const projectKey = canonicalizeProjectDir(cwd) || cwd;
  if (resolved) writeActiveSession(resolvePaths(cwd).activeSession, activeSessionKey(projectKey, ide), {
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
    workspace_unusable_roots: workspace.unusable_roots,
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

// The role files, NAMED here and LOADED by ob_start. C1's remainder is G-032 —
// `.agents/roles/` tracked and read by nothing — and the split is deliberate:
// this hook fires for every session including ones that never run /start, so the
// PROBLEMS (a missing, untracked or stale role file) must be announced here,
// while the content belongs where the seat is actually briefed. Printing both in
// both places would double ~245 lines into every session's context.
if (hasAgents) {
  const roles = describeRoleFiles(cwd, identity);
  for (const line of roles.lines) lines.push(line);
  for (const p of roles.problems) {
    lines.push("");
    lines.push(p);
  }
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

// T179-2: a previous session in this checkout ended with committed loop work
// and no handoff. Its SessionEnd hook recorded that; shown here ONCE, because
// whether a SessionEnd hook's output reaches anyone is up to the host.
if (hasAgents) {
  for (const notice of takeMissingHandoffNotices(cwd)) {
    lines.push("");
    lines.push(notice);
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
