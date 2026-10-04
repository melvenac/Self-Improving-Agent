#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { resolve, join, dirname, basename } from "node:path";
import { homedir } from "node:os";
import { existsSync, readFileSync, writeFileSync, readdirSync, mkdirSync, appendFileSync, statSync } from "node:fs";
import type Database from "better-sqlite3";

import { runSync } from "./pipelines/sync/index.js";
// The MCP server IS the memory half — it already requires the native build to
// load — so it supplies the memory checks statically. Loop 13: memory may
// import core, and this is that direction.
import * as memoryChecks from "./pipelines/sync/checks-memory.js";
import {
  scoreConfigStructure,
  scoreKnowledgeQuality,
  scoreStaleness,
  scoreCoverage,
  scorePipelineHealth,
} from "./pipelines/sync/scorer.js";
import { appendScore, readHistory, calculateTrend } from "./pipelines/sync/history.js";
import { sessionStart, type StateFileSize } from "./pipelines/session-start/index.js";
import { describeTreeCurrency } from "./pipelines/session-start/tree-currency.js";
import { describeRoleFiles, renderRoleDocs, recordRoleReads } from "./pipelines/session-start/role-files.js";
import { greetingFlag, handoffCheckout } from "./pipelines/session-start/greeting-flags.js";
import { focusLine, seatsLine, seatOrder } from "./pipelines/session-start/focus.js";
import { resolveCheckoutSeat } from "./pipelines/session-start/seat-map.js";
import { SeatName, schemaVersionAdvice, type Seat } from "./shared/state-schema.js";
import { readAgentIdentity } from "./pipelines/session-start/agent-identity.js";
import { describeHubPresence } from "./pipelines/session-start/hub-presence.js";
import { countWords, estimateTokens } from "./pipelines/session-start/state-reader.js";
import { renderState, missingHandoffLine } from "./pipelines/session-start/state-render.js";
import { describeServingBuild } from "./pipelines/session-start/serving-build.js";
import { renderBriefing, describeUsage, describeWorkingTree, describeSkills } from "./pipelines/session-start/briefing.js";
import { describeLatestBrief } from "./pipelines/session-start/latest-brief.js";
import { formatScanCounts } from "./pipelines/session-start/scan-counts.js";
import { resolveRepoRoot, describeNoRoot } from "./shared/repo-root.js";
import { applyStateOps, readState, DONE_RETENTION_SESSIONS, RECORD_RETENTION_SESSIONS } from "./shared/state-writer.js";
import { openV2Database, getKnowledgeQualityStats, getStalenessStats, getCoverageStats as getCoverageStatsV2, recordSession, recordChunk, recordRecallEvent, recordFeedbackEvent, archiveKnowledgeEntry, checkSchemaSkew, type SchemaSkew, type RecallTrigger } from "./db-v2.js";
import { sessionEndV2 } from "./pipelines/session-end/index-v2.js";
import { resolveRecalledIdsObserved, formatRecalledResolution, formatForeignWriter, readRecalledFile } from "./pipelines/session-end/recalled-ids.js";
import { readLastInvocationTs } from "./pipelines/session-end/invocation-logger.js";
import { computeScore as computeScoreShared } from "./pipelines/sync/score.js";
import { invocationLogSuffix } from "./pipelines/sync/score-line.js";
import { resolvePaths, canonicalizeProjectDir, projectDisplayName, obsidianVaultDir } from "./shared/paths.js";
import { byPidDir, processStartTime, proveSession, type ProvenSession } from "./shared/process-session.js";
import { formatShadowReport, readShadowLog } from "./pipelines/shadow/index.js";
import { slugify, archiveVaultNote } from "./vault-writer.js";
import { findToolCallScaffolding, scaffoldRejectionMessage } from "./shared/content-guard.js";
import { recallRankExpr, type Rating, type Maturity } from "./lifecycle.js";
import type { CategoryScore, ScoreResult } from "./pipelines/sync/types.js";

// --- V2 Database singleton ---

const V2_DB_PATH = process.env.KNOWLEDGE_V2_DB || join(homedir(), ".claude", "open-brain", "knowledge-v2.db");
// Resolved per call, not once at import. As a frozen const this ignored
// OPEN_BRAIN_VAULT_DIR, so the server tests wrote summaries for their temp
// projects into the real vault — 57 `ob-server-*` files had accumulated there
// since April before anyone noticed.
const v2VaultDir = () => obsidianVaultDir();

let _v2db: Database.Database | null = null;
let _schemaSkew: SchemaSkew | null = null;
function getV2Db(): Database.Database {
  if (_v2db) return _v2db;
  _v2db = openV2Database(V2_DB_PATH);
  _schemaSkew = checkSchemaSkew(_v2db);
  return _v2db;
}

/**
 * One warning line when this build is older than the schema stamped in the DB
 * — i.e. a newer build has already migrated it and this session simply has not
 * reconnected. Empty when healthy. Version skew between concurrent per-session
 * writers is permitted by the architecture and was detected by nothing until
 * a stale default contaminated a young column (Session 52).
 */
function skewWarning(): string {
  if (!_schemaSkew?.writerIsStale) return "";
  return `\nWARNING: this server's build writes schema v${_schemaSkew.codeVersion} but the database is `
    + `stamped v${_schemaSkew.dbVersion} by a newer build. This session is running old code against a `
    + `newer schema — run /mcp reconnect open-brain here before trusting its writes.`;
}

/**
 * T-003: the session this server can PROVE is its own, read at EVERY
 * attributed write and never cached, because one server outlives many
 * sessions (`/clear`) and a reconnected one has no memory at all. See
 * shared/process-session.ts for the proof and its limits.
 *
 * There is no in-memory registration and no fallback. The per-project slot in
 * active-session.json is never read here: it holds whichever session in the
 * checkout started last, and adopting it was the defect ("v0.21.0 fixed an
 * absence by introducing a wrong value"). No proof means no id, with the
 * reason, and every caller refuses or says "not logged" out loud.
 *
 * The parent is `process.ppid`, NEVER `CLAUDE_PID`: in an MCP server that
 * variable is inherited from whoever launched claude, so it names the OUTER
 * session when claude runs inside another one (T-003 Step 0b).
 */
let _parentStart: { pid: number; start: string | null } | null = null;
function writeSessionId(): ProvenSession {
  const parent = process.ppid;
  // The parent is fixed for this process's life, so its start time is read
  // once (it costs a process spawn on Windows). The pid is re-checked anyway.
  if (!_parentStart || _parentStart.pid !== parent) _parentStart = { pid: parent, start: processStartTime(parent) };
  return proveSession(byPidDir(resolvePaths(process.cwd()).activeSession), parent, _parentStart.start);
}

/**
 * The session an attributed write may use, given the id its caller NAMED (if
 * any). A named id is a claim to check, never a source: it must equal the
 * proven one. Returns the refusal text when the write must not happen.
 */
function attributedSession(named: string | null | undefined): { id: string | null; refusal?: string; reason?: string } {
  const proven = writeSessionId();
  const claim = named && named !== "none" ? named : null;
  if (proven.id === null) {
    if (claim) return { id: null, refusal: `${claim} cannot be checked: this server cannot prove its session (${proven.reason}). Nothing written.` };
    return { id: null, reason: proven.reason };
  }
  if (claim && claim !== proven.id) {
    return { id: null, refusal: `${claim} is not this server's session: this server's parent process ${proven.pid} is session ${proven.id}. Nothing written.` };
  }
  return { id: proven.id };
}
const _recalledKnowledgeIds = new Set<number>();

// Re-exported so existing importers (and tests) keep working; the shadow
// harness imports them from shared/fts.js directly. `export ... from` alone
// would not bind these names in this module's scope, so import as well.
import { sanitizeFtsQuery, broadenFtsQuery } from "./shared/fts.js";
export { sanitizeFtsQuery, broadenFtsQuery };

// --- Exported handler functions (testable without MCP transport) ---

export interface ToolResponse {
  [key: string]: unknown;
  content: { type: "text"; text: string }[];
  isError?: boolean;
}

export async function handleSync(args: {
  project_root?: string;
  check_only?: boolean;
  score?: boolean;
}): Promise<ToolResponse> {
  try {
    // Loop 10 R1: `runtime: "mcp-server"` is the point of calling sync from here.
    // The state-schema check parses the live state.json with THIS process's loaded
    // schema, so a failure here — where the CLI passes — is the schema-staleness
    // signal that cost two loops of record-keeping.
    const result = runSync({ projectRoot: resolve(args.project_root ?? "."), checkOnly: args.check_only ?? false, score: args.score ?? false, scoreJson: false, history: false, runtime: "mcp-server", memoryChecks });
    const projectRoot = result.projectRoot;

    const lines: string[] = [];
    lines.push(`Sync — v${result.version}`);
    if (projectRoot !== resolve(args.project_root ?? ".")) lines.push(`Root: ${projectRoot} (resolved upward from ${resolve(args.project_root ?? ".")})`);

    if (result.fixed.length > 0) {
      lines.push(`\nFIXED:`);
      for (const c of result.fixed) lines.push(`  ${c.name}: ${c.message}`);
    }
    if (result.issues.length > 0) {
      lines.push(`\nISSUES:`);
      for (const c of result.issues) lines.push(`  ${c.name}: ${c.message}`);
    }
    if (result.warnings.length > 0) {
      lines.push(`\nWARNINGS:`);
      for (const c of result.warnings) lines.push(`  ${c.name}: ${c.message}`);
    }

    if (result.skipped.length > 0) {
      lines.push(`\nSKIPPED:`);
      for (const c of result.skipped) lines.push(`  ${c.name}: ${c.message}`);
    }
    const reported = result.checks.filter((c) => c.report);
    if (reported.length > 0) {
      lines.push(`\nREPORTED (printed whatever the severity):`);
      for (const c of reported) lines.push(`  ${c.name} [${c.severity}]: ${c.message}`);
    }

    lines.push(`\nSummary: ${result.passed.length} passed, ${result.fixed.length} fixed, ${result.warnings.length} warnings, ${result.issues.length} issues, ${result.skipped.length} skipped`);

    if (args.score) {
      const scoreResult = computeScore(projectRoot, result.checks);
      lines.push(`\nHealth Score: ${scoreResult.total}/100`);
      for (const cat of scoreResult.categories) {
        const pct = Math.round((cat.score / cat.max) * 100);
        lines.push(`  ${cat.name}: ${cat.score}/${cat.max} (${pct}%)${invocationLogSuffix(cat)}`);
      }
      // /sync --score is the route actually used in practice; without this the
      // trend history silently stopped collecting (no entries Apr–Jul 2026).
      appendScore(resolvePaths(projectRoot).scoreHistory, scoreResult);
      lines.push(`\nAppended to score history.`);
    }

    return { content: [{ type: "text", text: lines.join("\n") }] };
  } catch (err) {
    return {
      content: [{ type: "text", text: `ob_sync error: ${err instanceof Error ? err.message : String(err)}` }],
      isError: true,
    };
  }
}

export interface StartArgs {
  project_root?: string;
  /** Per-file line budget for the state files. Omitted = whole files. */
  state_budget_lines?: number;
  /** Test seam, deliberately NOT in the tool schema: the build directory describeServingBuild reads. Default: the running build. */
  serving_build_dir?: string;
}

/** Display names for the four state files, keyed as in StateFileSize.file. */
const STATE_FILE_LABEL: Record<StateFileSize["file"], string> = {
  summary: "SUMMARY.md",
  inbox: "INBOX.md",
  taskFile: "task.md",
  nextSession: "next-session.md",
  stateJson: "state.json",
};

export async function handleStart(args: StartArgs): Promise<ToolResponse> {
  try {
    const projectRoot = resolve(args.project_root ?? ".");
    const proven = writeSessionId();
    const result = sessionStart({
      projectRoot,
      homePath: homedir(),
      // The PROVEN session (T-003). null means there is no proof: do not
      // discover, or a shared checkout stamps the other session's transcript.
      sessionId: proven.id,
      stateBudgetLines: args.state_budget_lines,
    });
    const sessionIdLine = proven.id === null
      ? `Session ID: none — ${proven.reason}`
      : `Session ID: ${result.session.sessionId ?? "discovery failed"}`;

    const lines: string[] = [];

    // FIRST, before the mode, the version, the drift line or the record itself.
    // A seat reading a stale tree's record needs to know that before it reads
    // any of it — on 2026-09-20 one read a rev-50 record as current and reported
    // four false claims about the project, with every other instrument green.
    // The line names `origin/master` and disclaims drift in its own words, so a
    // reader seeing it above `Drift: none` cannot take either as the other's
    // confirmation. See pipelines/session-start/tree-currency.ts.
    // T-233 A: the SERVING build comes before even that, because it is the code producing this greeting.
    const serving = describeServingBuild(args.serving_build_dir);
    lines.push(serving);
    lines.push(...describeTreeCurrency(projectRoot).lines);
    lines.push("");

    lines.push(`Session Start — ${result.state.mode} mode`);
    // The name is the record's (bootstrap-fix BF-8, frogger F12): the header
    // printed `Project: v0.0.1` while the State block below said `frogger v0.0.1`.
    const recordName = result.state.stateJson.data?.project.name ?? null;
    lines.push(recordName ? `Project: ${recordName} v${result.state.version}` : `Project: v${result.state.version}`);

    // Drift is a result, not an instruction: the caller relays it, it does not
    // re-derive it. An explicit "none" line keeps an empty drift[] observable.
    if (result.drift.length > 0) {
      lines.push(`\nDrift detected (${result.drift.length}):`);
      for (const d of result.drift) {
        lines.push(`  ${d.field}: expected ${d.expected}, got ${d.actual}${d.fixed ? " (fixed)" : " (not fixed)"}`);
      }
    } else {
      lines.push(`\nDrift: none`);
    }

    // T-210: the newest brief by git commit date, so the briefing does not guess it from file names.
    // Omitted when there is no brief; says so when git could not answer.
    const latestBrief = describeLatestBrief(projectRoot);
    if (latestBrief) lines.push(latestBrief);

    if (result.session.logPath) {
      const localNote =
        result.session.sessionNumberSource === "local"
          ? " (local — from this checkout's session logs; no valid state.json)"
          : "";
      lines.push(
        `\nSession #${result.session.sessionNumber}${result.session.reused ? " (existing log for this session id — reused, nothing created)" : localNote}`,
      );
      lines.push(`Log: ${result.session.logPath}`);
      lines.push(sessionIdLine);
    } else if (result.session.skippedReason) {
      lines.push(`\nSession log: ${result.session.skippedReason}`);
      lines.push(sessionIdLine);
    }

    if (result.health.warnings.length > 0) {
      lines.push(`\nWarnings:`);
      for (const w of result.health.warnings) {
        lines.push(`  [${w.category}] ${w.message}`);
      }
    }
    // T-048 round 2: what the two scans could not read, at zero too.
    lines.push(...formatScanCounts(result.session, result.health));

    // Seat identity and the role knowledge that goes with it (C1 / G-032).
    //
    // `readAgentIdentity` is a READ-ONLY door: it parses AGENT.local.md then
    // AGENT.md and writes nothing. That matters on its own — the only other way
    // to ask which seat a checkout greets as was to run the SessionStart hook,
    // which calls writeActiveSession and, given no session id, GENERATES one and
    // stamps it over the checkout's slot. Checking identity reassigned identity.
    //
    // The CONTENT is returned, not just the filenames. A greeting that named the
    // files without loading them would satisfy "the greeting says it did" and
    // leave G-032 exactly where it was: tracked, and read by nothing.
    const roles = describeRoleFiles(projectRoot, readAgentIdentity(projectRoot));
    lines.push("");
    lines.push(
      roles.seat
        ? `Seat: ${roles.seat.name} (${roles.seat.role})${roles.seat.partner ? ` — partner: ${roles.seat.partner}` : ""}`
        : `Seat: UNRESOLVED`
    );
    lines.push(...roles.lines);
    if (roles.problems.length > 0) {
      lines.push(`
ROLE KNOWLEDGE PROBLEMS (${roles.problems.length}):`);
      for (const p of roles.problems) lines.push(`  ${p}`);
    }

    const presence = await describeHubPresence({
      projectRoot,
      identity: roles.seat,
      callerLabel: "open-brain MCP server",
    });
    if (presence.lines.length > 0) {
      lines.push("");
      lines.push(...presence.lines);
    }

    // Size block precedes the content so a reader sees what is coming before
    // it arrives. Estimator: chars/4 rounded up (see StateFileSize).
    lines.push(`\n## Sizes (tokens estimated as chars/4)`);
    for (const s of result.sizes) {
      if (!s.present) {
        lines.push(`  ${STATE_FILE_LABEL[s.file]} (${s.path}): absent`);
        continue;
      }
      const cut = s.truncated ? `yes (${s.lines} of ${s.sourceLines} source lines)` : "no";
      lines.push(`  ${STATE_FILE_LABEL[s.file]} (${s.path}): ${s.lines} lines, ${s.words} words, ~${s.estTokens} tokens, truncated: ${cut}`);
    }

    // The state itself. A valid state.json replaces the four prose files (they
    // stay in the size block above so the shrink is visible). An invalid one
    // says so and falls back. Absent leaves v0.28.0 output untouched. Each
    // prose file sits under its own header; "absent" is spelled out so a
    // missing file and an empty one never look alike.
    const sj = result.state.stateJson;
    if (sj.present && sj.valid && sj.data) {
      // The reader's OWN seat, so the greeting renders this seat's handoff and
      // names the others by their close-out commit. A greeting that shows the
      // developer's handoff to the planner is C4 failing on the row C2 exists for.
      // T-239: with handoff_by_checkout on, only THIS checkout's handoff is "yours", in both renders.
      const ownCheckout = handoffCheckout(projectRoot);
      lines.push(...renderState(sj.data, result.state.version, {
        seat: roles.seat && isSeat(roles.seat.role) ? roles.seat.role : null,
        projectRoot,
        ownCheckout,
      }));
      // T-233 B: the whole briefing, rendered here, so /start prints it instead of assembling it.
      lines.push("", ...renderBriefing({
        serving,
        state: sj.data,
        version: result.state.version,
        seat: roles.seat && isSeat(roles.seat.role) ? roles.seat.role : null,
        ownCheckout,
        sessionNumber: result.session.logPath ? result.session.sessionNumber : null,
        sessionNote: result.session.skippedReason,
        date: new Date().toISOString().slice(0, 10),
        drift: result.drift,
        usage: describeUsage(projectRoot),
        latestBrief,
        workingTree: describeWorkingTree(projectRoot),
        skills: describeSkills(projectRoot),
        // T-236 slice 2: OPT-IN per repo (.agents/SYSTEM/greeting.json); absent means the original layout, byte for byte.
        budget: greetingFlag(projectRoot, "briefing_budget"),
        // T-236 (c): OPT-IN, and only with the budget. The seat is the CHECKOUT's; presence is the roster fetched above.
        ...(greetingFlag(projectRoot, "briefing_budget") && greetingFlag(projectRoot, "briefing_focus")
          ? {
              focus: {
                focus: focusLine(sj.data, resolveCheckoutSeat(projectRoot)),
                seats: ((order) => (order ? seatsLine(sj.data, order, presence.statusByHubName ?? null) : null))(seatOrder(projectRoot)),
              },
            }
          : {}),
        // T-199, opt-in: a repo without `missing_handoff` renders exactly as before.
        missingHandoff: greetingFlag(projectRoot, "missing_handoff")
          ? missingHandoffLine(sj.data, { projectRoot, sessionUuid: proven.id, seat: roles.seat && isSeat(roles.seat.role) ? roles.seat.role : null })
          : null,
      }));
    } else {
      // F3: an unknown schema_version REFUSES, with no prose fallback.
      //
      // `ob_state` already refused a record it could not parse; `ob_start` did
      // not — it printed one notice line and then fell back to 59k characters of
      // prose, so a session started from a stale build against a migrated record
      // got a greeting that looked like the pre-state.json regime. The merge
      // choreography counts on that failure being loud, and it was loud on the
      // write side only.
      //
      // Narrow on purpose: this is the VERSION being unknown to this build, not
      // any invalid file. A record that is merely malformed still falls back,
      // because the prose is then the best available answer.
      if (sj.present && !sj.valid && sj.errorPath === "schema_version") {
        lines.push(
          `\nSTATE RECORD REFUSED: ${sj.error}.`,
          `This build cannot read this record's schema version. NOT falling back to the prose files: they are a DIFFERENT and older account of the project, and a greeting built from them would look ordinary while describing a state the record has moved past.`,
          versionAdviceFor(projectRoot) ?? `Rebuild the checkout this process runs from against a commit carrying the record's schema, then start again.`,
        );
        const text = lines.join("\n");
        return {
          content: [{ type: "text", text: `${text}\n\nTotal returned words: ${countWords(text)} (~${estimateTokens(text)} tokens)` }],
          isError: true,
        };
      }
      if (sj.present && !sj.valid) {
        lines.push(`\nstate.json invalid at ${sj.error} — falling back to files`);
      }
      // T-199, opt-in: the detector reads the record, so with no readable record it says it did not check.
      if (greetingFlag(projectRoot, "missing_handoff")) {
        lines.push(`\nHandoff check: not checked (${sj.present ? "state.json invalid" : "no .agents/state.json"}, so there is no record to read)`);
      }
      const content: Record<string, string | null> = {
        summary: result.state.summary,
        inbox: result.state.inbox,
        taskFile: result.state.taskFile,
        nextSession: result.state.nextSession,
      };
      for (const s of result.sizes) {
        if (s.file === "stateJson") continue;
        lines.push(`\n## ${STATE_FILE_LABEL[s.file]}`);
        const body = content[s.file];
        lines.push(body === null ? "absent" : body.replace(/\s+$/, ""));
      }
    }

    // The role knowledge itself, last: it is reference material the seat reads
    // once and refers back to, not a briefing it reads top to bottom.
    // T-236: with role_docs_by_sha on, a doc this seat already read at this sha is one line. The
    // read is recorded only after its full text is in `lines`, and only here.
    const roleDocs = renderRoleDocs(projectRoot, roles.files, roles.seat, greetingFlag(projectRoot, "role_docs_by_sha"));
    lines.push(...roleDocs.lines);
    const unrecorded = recordRoleReads(projectRoot, roles.seat, roleDocs.printedFull, new Date());
    if (unrecorded) lines.push(`\n${unrecorded}`);

    // Total is of everything above it — the measurement Part 1 of the
    // evaluation asks for. Computed last so it counts the real return.
    const text = lines.join("\n");
    const totalWords = countWords(text);
    return {
      content: [{ type: "text", text: `${text}\n\nTotal returned words: ${totalWords} (~${estimateTokens(text)} tokens)` }],
    };
  } catch (err) {
    return {
      content: [{ type: "text", text: `ob_start error: ${err instanceof Error ? err.message : String(err)}` }],
      isError: true,
    };
  }
}

/**
 * The version-direction advice for this project's record, or null. An older
 * record is MIGRATED; rebuilding (the only advice this refusal gave before
 * T-163) would change nothing for it.
 */
function versionAdviceFor(projectRoot: string): string | null {
  try {
    const advice = schemaVersionAdvice(readFileSync(join(projectRoot, ".agents", "state.json"), "utf-8"));
    return advice ? advice.charAt(0).toUpperCase() + advice.slice(1) + "." : null;
  } catch {
    return null;
  }
}

export interface StateArgs {
  project_root?: string;
  session: number;
  expected_revision: number;
  ops: unknown[];
  dry_run?: boolean;
  render?: boolean;
}

/**
 * ob_state (Loop 3): the only door to writing .agents/state.json. Thin over
 * applyStateOps; the WriteResult is rendered in the tool's usual text style.
 */
export async function handleState(args: StateArgs): Promise<ToolResponse> {
  try {
    const projectRoot = resolve(args.project_root ?? ".");
    // T-163: the WRITING session is this server's registered session, never an
    // op argument, so a batch cannot write under another session's uuid. The
    // checkout's declared seat labels the session record; set_handoff's own
    // seat overrides it.
    const identity = readAgentIdentity(projectRoot);
    const stateSession = attributedSession(null);
    const r = applyStateOps(projectRoot, {
      session: args.session,
      expected_revision: args.expected_revision,
      ops: args.ops,
      dry_run: args.dry_run,
      render: args.render,
      // T-003: the PROVEN session. With none, set_handoff refuses (T-163) and the
      // reason is added to the refusal below.
      session_uuid: stateSession.id,
      seat: identity && isSeat(identity.role) ? identity.role : null,
      // T-236 slice 2: OPT-IN per repo; the caps apply to the handoff being written, never to existing ones.
      handoff_caps: greetingFlag(projectRoot, "handoff_caps"),
    });
    const lines: string[] = [];
    if (!r.ok) {
      lines.push(`ob_state refused: ${r.error}`);
      if (r.revision_before >= 0) lines.push(`Revision: ${r.revision_before} (unchanged)`);
      lines.push(`Nothing written.`);
      if (stateSession.id === null) lines.push(`No proven session (T-003): ${stateSession.reason}`);
      // Loop 10 R2 — the refusal names its remedy.
      //
      // Fail-closed is correct and stays. What was missing is that this was
      // diagnosed only because the session holding the error also held the
      // context for the schema change that caused it. A fresh reader sees
      // "expected string, received undefined" and suspects the FILE, when the
      // cause may be that this server process holds a schema older than the file
      // — an MCP server keeps its schema for the life of the process, and only a
      // human can reconnect it.
      // F2: ONLY on a schema_version mismatch, and branching on the parse
      // PATH rather than on the wording. The old condition was
      // /schema|expected .* received|invalid/i, which matches nearly every
      // refusal this tool can produce — `ops[0] invalid at priority` is an
      // ordinary bad argument and was told to reconnect the server.
      //
      // And the advice itself was wrong. A reconnect restarts the server from
      // the SAME BUILD; when the schema change lives on a branch that build does
      // not have — which is the case that actually occurred — reconnecting
      // changes nothing. What is needed is a build carrying the schema.
      if (r.error_path === "schema_version") {
        lines.push(
          `This process's schema does not match the file's. A RECONNECT ALONE MAY NOT FIX IT: it restarts this server from the same build, so if the schema change is in a build this one does not have — a branch, or a checkout that has not been rebuilt — nothing changes. Rebuild the checkout this server runs from, then reconnect it, then confirm with \`ob_sync\`'s state-schema check, which reports which process parsed the file. Confirm by a read ordered after the write, never by the reconnect message: a stale server reports success.`,
        );
      }
      return { content: [{ type: "text", text: lines.join("\n") }], isError: true };
    }
    lines.push(`ob_state ${r.dry_run ? "dry run — nothing written" : "applied"}`);
    lines.push(`Revision: ${r.revision_before} → ${r.revision_after}`);
    lines.push(`Applied (${r.applied.length}):`);
    for (const a of r.applied) lines.push(`  ${a.op}${a.id ? ` ${a.id}` : ""}`);
    lines.push(`Dropped done tasks (retention ${DONE_RETENTION_SESSIONS} sessions): ${r.dropped_task_ids.length ? r.dropped_task_ids.join(", ") : "none"}`);
    // T-157: printed unconditionally, not folded into the line above. The
    // evictions that cost this project two tasks were reported as one clause
    // among several and read as routine.
    // T-232: one line however many; the per-id NOTE comes only in the write a task crosses the boundary.
    if (r.kept_cited_task_ids.length) lines.push(`KEPT despite retention (id cited in the tracked tree): ${r.kept_cited_task_ids.length} — ${r.kept_cited_task_ids.join(", ")}`);
    if (r.removed_gap_ids.length) lines.push(`Closed gaps removed: ${r.removed_gap_ids.join(", ")}`);
    // T-163: an entry leaves the per-session arrays only by retention, and says so.
    if (r.superseded.length) lines.push(`Superseded (a newer entry of the same seat and checkout, with >${RECORD_RETENTION_SESSIONS} sessions written since; or a legacy handoff whose seat has written a keyed one): ${r.superseded.join("; ")}`);
    // T-171: every note set, appended to or replaced, with sizes — dry run included.
    for (const c of r.note_changes) lines.push(`NOTE CHANGE: ${c}`);
    // Anything the writer did differently from what was asked.
    for (const n of r.notes) lines.push(`NOTE: ${n}`);
    lines.push(`${r.dry_run ? "Would render" : "Rendered"} (${r.rendered.length}): ${r.rendered.length ? r.rendered.join(", ") : "none (render: false)"}`);
    return { content: [{ type: "text", text: lines.join("\n") }] };
  } catch (err) {
    return {
      content: [{ type: "text", text: `ob_state error: ${err instanceof Error ? err.message : String(err)}` }],
      isError: true,
    };
  }
}

export interface EndArgs {
  project_root?: string;
  session_id?: string | null;
  session_summary?: string;
  recalled_entry_ids?: number[];
  entry_ratings?: Record<string, "helpful" | "harmful" | "neutral">;
  dry_run?: boolean;
}

export async function handleEnd(args: EndArgs): Promise<ToolResponse> {
  try {
    const projectRoot = resolve(args.project_root ?? ".");
    // T-003: a named session_id is checked against the proven one, never
    // trusted: ob_end writes ratings under it.
    const endSession = attributedSession(args.session_id);
    if (endSession.refusal) {
      return { content: [{ type: "text" as const, text: `ob_end refused: ${endSession.refusal}` }], isError: true };
    }
    const v2db = getV2Db();

    // recall_log is authoritative when the session is known; the file is only
    // consulted when it names this same session. See resolveRecalledIds.
    // No named id means the proven one. end.md calls ob_end that way, and a
    // rating ob_recalled lists is in recall_log under that id (D3).
    const endedId = endSession.id;
    const { resolved, foreign } = resolveRecalledIdsObserved({
      db: v2db,
      sessionId: endedId,
      explicitIds: args.recalled_entry_ids,
      filePaths: [resolve(projectRoot, ".recalled-entries.json")],
      readFile: readRecalledFile,
    });
    const recalledIds = resolved.ids;

    const result = sessionEndV2({
      db: v2db,
      vaultDir: v2VaultDir(),
      agentsDir: resolve(projectRoot, ".agents"),
      sessionId: endedId ?? "",
      sessionSummary: args.session_summary || "",
      project: projectRoot.split(/[/\\]/).filter(Boolean).pop() || "General",
      recalledEntryIds: recalledIds,
      // 'none' means no ids resolved, so no rating is created and no origin is
      // needed; passing undefined lets the record default to 'unspecified'.
      recalledOrigin: resolved.origin === "none" ? undefined : resolved.origin,
      // JSON object keys arrive as strings; the pipeline keys by entry id.
      entryRatings: args.entry_ratings
        ? Object.fromEntries(
            Object.entries(args.entry_ratings).map(([id, r]) => [Number(id), r])
          )
        : undefined,
      dryRun: args.dry_run || false,
      shadowLogPath: resolvePaths(projectRoot).shadowLog,
    });

    // Name the source, always — including when it is the boring one. Reporting
    // only the interesting case is what made v0.14.1's apoptosis block and a
    // stale server produce identical output. Without this line, `Feedback: N
    // entries rated` reads the same whether the ids came from recall_log or
    // from a file belonging to someone else's session.
    // Same lines the session-end hook prints, including the reason a none-origin
    // resolved nothing. The count alone made "no session id" and "no recall_log
    // rows" look identical.
    // T-050: who wrote .recalled-entries.json, observed beside the resolution and never fed into it.
    const originLine = [...formatRecalledResolution(resolved), ...formatForeignWriter(foreign)].join("\n");

    const shadowLine = result.shadow.evaluated
      ? `  Shadow recall: ${result.shadow.strategies} strategies over ${result.shadow.queries} queries (best: ${result.shadow.leader})`
      : `  Shadow recall: skipped (${result.shadow.skipped})`;

    const shadowReport = formatShadowReport(readShadowLog(resolvePaths(projectRoot).shadowLog));

    return {
      content: [{
        type: "text",
        text: `Session End:\n  Summary: ${result.summary.written ? "written" : "skipped"}${result.summary.selfGenerated ? " (self-generated)" : ""}\n${originLine}\n  Feedback: ${result.feedback.processed} entries rated\n  Invocations: ${result.invocations.logged} logged (${result.invocations.skippedSessions} already logged, ${result.invocations.unreadableSessions} unreadable, ${result.invocations.appendFailures} append failed)\n${shadowLine}\n\n${shadowReport}`,
      }],
    };
  } catch (err) {
    return {
      content: [{ type: "text", text: `ob_end error: ${err instanceof Error ? err.message : String(err)}` }],
      isError: true,
    };
  }
}

export async function handleScore(args: {
  project_root?: string;
  history_only?: boolean;
}): Promise<ToolResponse> {
  try {
    const startDir = resolve(args.project_root ?? ".");
    const projectRoot = resolveRepoRoot(startDir);
    if (!projectRoot) {
      return { content: [{ type: "text", text: `ob_score refused: ${describeNoRoot(startDir)}` }], isError: true };
    }
    const paths = resolvePaths(projectRoot);
    const lines: string[] = [];

    if (args.history_only) {
      const entries = readHistory(paths.scoreHistory);
      if (entries.length === 0) {
        lines.push("No score history found.");
      } else {
        const trend = calculateTrend(entries);
        lines.push(`Score History (${entries.length} entries):`);
        for (const entry of entries.slice(-10)) {
          lines.push(`  ${entry.date}: ${entry.total}/100`);
        }
        lines.push(`Trend: ${trend}`);
      }
    } else {
      // Run checks to feed config score
      const result = runSync({ projectRoot, checkOnly: true, score: false, scoreJson: false, history: false, runtime: "mcp-server", memoryChecks });
      const scoreResult = computeScore(projectRoot, result.checks);

      lines.push(`Health Score: ${scoreResult.total}/100`);
      for (const cat of scoreResult.categories) {
        const pct = Math.round((cat.score / cat.max) * 100);
        lines.push(`  ${cat.name}: ${cat.score}/${cat.max} (${pct}%)${invocationLogSuffix(cat)}`);
      }

      // Append to history
      appendScore(paths.scoreHistory, scoreResult);
      lines.push(`\nAppended to score history.`);

      // Show trend
      const entries = readHistory(paths.scoreHistory);
      if (entries.length > 1) {
        const trend = calculateTrend(entries);
        lines.push(`Trend: ${trend}`);
      }
    }

    return { content: [{ type: "text", text: lines.join("\n") }] };
  } catch (err) {
    return {
      content: [{ type: "text", text: `ob_score error: ${err instanceof Error ? err.message : String(err)}` }],
      isError: true,
    };
  }
}

// --- MCP Server Registration ---

const server = new McpServer({
  name: "open-brain",
  version: "0.1.0",
});

server.tool(
  "ob_sync",
  "Run version sync checks and structural validation. Optionally compute health score.",
  {
    project_root: z.string().optional().describe("Project root directory (defaults to cwd)"),
    check_only: z.boolean().optional().default(false).describe("Report issues without auto-fixing"),
    score: z.boolean().optional().default(false).describe("Compute health score after checks"),
  },
  async (args) => handleSync(args)
);

server.tool(
  "ob_start",
  "Start a new session. When .agents/state.json is valid this returns a `## State` render of it — objective, tasks by priority (titles only), verified, gaps, decisions, handoff, last session — which REPLACES the four prose files; their sizes are still reported but their text is not returned. When state.json is absent or invalid it falls back to the full text of SUMMARY, INBOX, task and next-session. Also detects drift, creates the session log, and reports per-file sizes. Call ob_set_session first so the registered session id is used.",
  {
    project_root: z.string().optional().describe("Project root directory (defaults to cwd)"),
    state_budget_lines: z.number().int().min(0).optional().describe("Per-file line budget for the state files. Omit for the whole files (default). Truncation is reported per file."),
  },
  async (args) => handleStart(args)
);

server.tool(
  "ob_state",
  "Write .agents/state.json through typed operations (open_task, update_task, close_task, reopen_task, add_verified, reopen_verified, add_gap, update_gap, close_gap, add_decision, set_objective, set_handoff). Every write records this session (its registered uuid) in sessions[]; set_handoff writes THIS session's handoff and cannot touch another session's, and refuses when no session is registered. end_session is retired (schema v3, T-163). Task notes (T-171): update_task and close_task take append_note (adds) or replace_note (replaces) — never `note`, which is refused; a replace that would remove another session's text, or text with no recorded author, is refused unless the op also sets replace_other_sessions: true; every note change is printed with its sizes, dry run included. Atomic: all ops apply or none. Requires the file to exist and expected_revision to match; bumps revision, applies done-task retention, and regenerates INBOX.md, task.md, next-session.md and the marked region of SUMMARY.md. An empty ops array with render: true re-renders the views without touching state.json or its revision.",
  {
    project_root: z.string().optional().describe("Project root directory (defaults to cwd)"),
    session: z.number().int().min(0).describe("Current session number — stamped on opened/closed/verified items"),
    expected_revision: z.number().int().min(0).describe("The revision you read from ob_start / the file; refused on mismatch"),
    ops: z.array(z.record(z.string(), z.unknown())).describe("Ordered operations, each {op: <name>, ...args}; empty = re-render views only"),
    dry_run: z.boolean().optional().default(false).describe("Validate and report without writing anything"),
    render: z.boolean().optional().default(true).describe("Regenerate the view files after writing (default true)"),
  },
  async (args) => handleState(args)
);

server.tool(
  "ob_end",
  "End a session — self-generate summary from session .db, record any entry_ratings passed, write the vault summary, log invocations. (The reflection queue was cut in Loop 10; this no longer flags reflection clusters.)",
  {
    project_root: z.string().optional().describe("Project root directory (defaults to cwd)"),
    session_id: z.string().nullable().optional().default(null).describe("Session UUID (null if unknown). Checked against the proven session: a different id refuses (T-003)."),
    session_summary: z.string().optional().default("").describe("Session summary text for tag matching (self-generates if empty)"),
    recalled_entry_ids: z.array(z.number()).optional().default([]).describe("IDs of knowledge entries recalled this session"),
    entry_ratings: z.record(z.string(), z.enum(["helpful", "harmful", "neutral"])).optional().describe("Explicit per-entry judgments keyed by entry ID, e.g. {\"42\": \"harmful\"}. Rate an entry harmful when it was applied and proved wrong or misleading — not merely when it went unused. Entries omitted here fall back to tag matching against the summary."),
    dry_run: z.boolean().optional().default(false).describe("Run feedback but skip vault writes"),
  },
  async (args) => handleEnd(args)
);

server.tool(
  "ob_score",
  "Compute health score (0-100) and show trend history.",
  {
    project_root: z.string().optional().describe("Project root directory (defaults to cwd)"),
    history_only: z.boolean().optional().default(false).describe("Only show score history, don't compute new score"),
  },
  async (args) => handleScore(args)
);

// ============================================================
// ob_* tools — knowledge lifecycle
// ============================================================

// --- ob_set_session ---
server.tool(
  "ob_set_session",
  "Check and record this session. The session id is PROVEN from the SessionStart hook's per-process record, never taken from the argument: an id other than the proven one is refused, and with no proof nothing is registered and attributed writes refuse (T-003). Call once at session start.",
  {
    session_id: z.string().optional().describe(
      "The session UUID, as a claim to check against the proven one. Omit (or pass \"none\") to register "
      + "the proven id without naming it."
    ),
    project_dir: z.string().optional().describe("Current working directory"),
  },
  async (args) => handleSetSession(args)
);

export interface SetSessionArgs {
  session_id?: string;
  project_dir?: string;
}

/**
 * T-003: ob_set_session is a CHECK, not a source.
 *
 * It used to take the id from its argument (unchecked: QA 125's A7) or, with
 * none, from the per-project slot (T-003's adoption), and hold it in memory,
 * where it outlived the session that set it (`/clear`, A9) and was lost by a
 * reconnect (A8). Now the id is the PROVEN one (writeSessionId): an argument
 * that differs from it is refused, naming both, and with no proof nothing is
 * registered. Registering changes no write: every attributed write reads the
 * proof itself. What this call still does is persist the proven id to the
 * sessions table and say, in its answer, where the id came from.
 *
 * R179-2's different-checkout refusal stood here. It is superseded, not lost:
 * it refused registering as ANOTHER checkout's recorded session, and no id but
 * this server's own can register now, in any checkout.
 */
export async function handleSetSession(args: SetSessionArgs): Promise<ToolResponse> {
  const project_dir = args.project_dir;
  const claim = args.session_id && args.session_id !== "none" ? args.session_id : null;
  const proven = writeSessionId();
  const refuse = (text: string): ToolResponse => ({ content: [{ type: "text" as const, text }], isError: true });

  if (proven.id === null) {
    return refuse(
      `ob_set_session refused: this server cannot prove its session (${proven.reason}). Nothing registered. `
        + `Until it can, attributed writes refuse or say "not logged": ob_state's set_handoff, the recall and feedback logs, ob_end and ob_store_chunk with a session_id. `
        + `In Claude Code the SessionStart hook writes the proof; a host that writes none (Cursor) cannot attribute (T-003, ruling Q2).`
        + (claim ? ` The id given, ${claim}, was not used: an argument is a claim to check, not proof.` : ""),
    );
  }
  if (claim && claim !== proven.id) {
    return refuse(
      `ob_set_session refused: ${claim} is not this server's session: this server's parent process ${proven.pid} is session ${proven.id}. `
        + `Nothing registered; attributed writes use ${proven.id}.`,
    );
  }

  // Persist as well as report: an in-memory-only registration left no record to
  // verify against after the session ended, which is why the SESSION_UUID
  // wiring had to be checked by hand every time.
  let persisted = false;
  try {
    recordSession(getV2Db(), proven.id, canonicalizeProjectDir(project_dir));
    persisted = true;
  } catch {
    // Registration must not fail the session if the DB is unavailable.
  }

  return {
    content: [{
      type: "text" as const,
      text: `Session registered: ${proven.id}${project_dir ? ` (${project_dir})` : ""}`
        + ` [via process proof: parent ${proven.pid}]`
        + (claim ? "" : " (no id given; the proven id was used)")
        + (persisted ? "" : " — warning: not persisted to the sessions table"),
    }],
  };
}

// --- ob_recall ---
export async function handleRecall(args: {
  queries: string[];
  project?: string;
  global?: boolean;
  tags?: string[];
  verbose?: boolean;
  limit?: number;
  trigger?: RecallTrigger;
}): Promise<ToolResponse> {
  const {
    queries,
    project,
    global: globalSearch = false,
    tags,
    verbose = false,
    limit = 5,
    trigger = "unspecified",
  } = args;
    const v2db = getV2Db();
    const normalizedProject = canonicalizeProjectDir(project);
    const results: string[] = [];

    for (const query of queries) {
      // Build the query once; only the MATCH expression differs between the
      // precise (AND) attempt and the broadened (OR) fallback.
      const buildSql = () => {
        let sql = `
        SELECT
          k.id, k.key, k.content, k.tags, k.source, k.project_dir,
          k.maturity,
          snippet(knowledge_fts, 1, '>>', '<<', '...', 128) as snippet,
          k.created_at,
          ${recallRankExpr("k")} as weighted_rank
        FROM knowledge_fts
        JOIN knowledge_index k ON k.id = knowledge_fts.rowid
        WHERE knowledge_fts MATCH ?
        AND k.archived_into IS NULL
      `;
        const params: unknown[] = [];

        if (!globalSearch && normalizedProject) {
          sql += ` AND (k.project_dir IS NULL OR k.project_dir LIKE ?)`;
          params.push(`%${normalizedProject}%`);
        }

        if (tags && tags.length > 0) {
          for (const tag of tags) {
            sql += ` AND k.tags LIKE ?`;
            params.push(`%${tag}%`);
          }
        }

        sql += ` ORDER BY weighted_rank LIMIT ?`;
        params.push(limit);
        return { sql, params };
      };

      type RecallRow = {
        id: number; key: string | null; content: string; tags: string | null;
        source: string; project_dir: string | null; maturity: string;
        snippet: string; created_at: string;
        weighted_rank: number;
      };

      const run = (matchExpr: string): RecallRow[] => {
        const { sql, params } = buildSql();
        return v2db.prepare(sql).all(matchExpr, ...params) as RecallRow[];
      };

      try {
        let rows = run(sanitizeFtsQuery(query));

        // Precision first, recall second: a multi-word query is conjunctive in
        // FTS5, so an exact-match miss is common and used to surface as "no
        // results" even when dozens of entries matched most of the terms.
        // Only widens when the precise query underfilled — never removes a hit.
        let broadened = false;
        if (rows.length < limit) {
          const orQuery = broadenFtsQuery(query);
          if (orQuery) {
            const seen = new Set(rows.map((r) => r.id));
            for (const row of run(orQuery)) {
              if (rows.length >= limit) break;
              if (seen.has(row.id)) continue;
              seen.add(row.id);
              rows.push(row);
              broadened = true;
            }
          }
        }

        results.push(`## ${query}`);
        if (rows.length === 0) {
          results.push("No results found.\n");
          continue;
        }
        if (broadened) {
          results.push("_(some results matched only part of the query)_");
        }

        // Ground truth for the shadow-recall harness: what this query returned,
        // in the order the agent saw it. Best-effort — a logging failure must
        // never break a recall — but never a SILENT skip: a recall that is not
        // logged says so in its own output.
        const session = writeSessionId();
        if (session.id !== null) {
          try {
            recordRecallEvent(v2db, session.id, query, rows.map((r) => r.id), trigger);
          } catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            results.push(`_(NOT LOGGED: recall log write failed — ${message})_`);
          }
        } else {
          results.push(`_(NOT LOGGED: this server cannot prove its session — ${session.reason})_`);
        }

        // Track recall hits
        const updateRecall = v2db.prepare(
          "UPDATE knowledge_index SET recall_count = COALESCE(recall_count, 0) + 1, last_recalled_at = datetime('now') WHERE id = ?"
        );
        for (const row of rows) {
          updateRecall.run(row.id);
          _recalledKnowledgeIds.add(row.id);

          // Maturity and recency are applied in weighted_rank (see recallRankExpr),
          // so ordering is already correct here — nothing further to compute.
          const idTag = ` (id: ${row.id})`;
          results.push(`### [stored knowledge] ${row.key || row.source}${idTag}`);
          results.push(`Session: ${row.created_at} | Project: ${row.project_dir || "unknown"}`);
          results.push(verbose ? row.content : row.snippet);
          if (row.tags) results.push(`Tags: ${row.tags}`);
          results.push("");
        }
      } catch {
        results.push(`## ${query}\nFTS search error — index may be empty.\n`);
      }
    }

    return { content: [{ type: "text" as const, text: results.join("\n") + skewWarning() }] };
}

server.tool(
  "ob_recall",
  "Search across all stored knowledge. Returns ranked results. Passing `project` scopes results to that project's entries plus global ones. Omitting `project` searches every project — the same reach as `global: true` — so pass it when you want scoping.",
  {
    queries: z.array(z.string()).min(1).describe("Search queries — batch all questions in one call"),
    project: z.string().optional().describe("Your current working directory — used to scope results"),
    global: z.boolean().optional().default(false).describe("If true, search across ALL projects"),
    tags: z.array(z.string()).optional().describe("Filter by tags"),
    verbose: z.boolean().optional().default(false).describe("If true, return full content instead of snippets"),
    limit: z.number().optional().default(5).describe("Results per query (default: 5)"),
    trigger: z.enum(["start", "checkpoint", "explicit", "unspecified"]).optional().default("unspecified")
      .describe("How this recall reached the agent: 'start' = session-start injection, 'checkpoint' = checkpoint restoration, 'explicit' = deliberate mid-task fetch. ALWAYS pass one of the first three; an omitted trigger is recorded as 'unspecified' (a countable labeling gap, never assumed to be a deliberate fetch). Recorded for analysis — injection and on-demand fetch are different treatments."),
  },
  async (args) => handleRecall(args),
);

// --- ob_store ---
server.tool(
  "ob_store",
  "Store a piece of knowledge. By default stored globally. Set scope to 'project' and pass project_dir to scope it.",
  {
    content: z.string().describe("The knowledge to store"),
    key: z.string().optional().describe("Short label for easy retrieval"),
    tags: z.array(z.string()).optional().describe("Tags for categorization"),
    source: z.string().optional().default("manual").describe("Where this knowledge came from"),
    scope: z.enum(["global", "project"]).optional().default("global").describe("Scope: global or project"),
    project_dir: z.string().optional().describe("Project directory (only when scope is 'project')"),
    kind: z.enum(["state", "event"]).optional().describe(
      "'state' = one current value that changes (a path, a version, an owner) — replace it. " +
      "'event' = a timestamped thing that happened (a gotcha, a decision, a lesson) — append it. " +
      "Recorded for reconciliation; storing still appends either way."
    ),
  },
  async ({ content, key, tags, source, scope, project_dir, kind }) => {
    // Refuse a body that ran past its own close. Eight entries were stored this
    // way on 2026-08-31; four of them lost their tags to the swallowed argument
    // and nothing noticed for a month.
    const scaffold = findToolCallScaffolding(content);
    if (scaffold) {
      return { content: [{ type: "text" as const, text: scaffoldRejectionMessage(scaffold) }], isError: true };
    }

    const v2db = getV2Db();
    const effectiveProject = scope === "project" ? canonicalizeProjectDir(project_dir) : null;
    // From the raw dir, not `effectiveProject` — see projectDisplayName.
    const projectName = effectiveProject ? projectDisplayName(project_dir) : "General";

    // `key` is optional in this schema but NOT NULL UNIQUE in the table, so a
    // keyless store used to die on the constraint — and a placeholder would die
    // on the *second* one, since two "unnamed" rows collide. Derive something
    // stable from the content instead: two stores that derive the same key are
    // saying near-enough the same thing that dedup is the right outcome.
    const effectiveKey = key || deriveKey(content);

    // Routed through the store pipeline rather than writing here. This tool used
    // to issue its own bare INSERT while the pipeline used INSERT OR REPLACE, so
    // re-storing an existing key raised "UNIQUE constraint failed" — and
    // re-storing an existing key is precisely what a `state` fact does.
    const { store } = await import("./pipelines/store/index.js");
    const result = store({
      db: v2db,
      vaultDir: v2VaultDir(),
      key: effectiveKey,
      tags: tags || [],
      content,
      project: projectName,
      projectDir: effectiveProject,
      source: source || "manual",
      factKind: kind ?? null,
    });

    const scopeLabel = effectiveProject ? ` [project: ${effectiveProject}]` : " [global]";

    if (result.adopted) {
      return {
        content: [{
          type: "text" as const,
          text:
            `Indexed existing vault note "${effectiveKey}"${scopeLabel} — the file was already on disk but absent from the index. ` +
            `Its own content was indexed, not the text passed here (the vault is the source of truth).\n  Vault: ${result.vaultPath}`,
        }],
      };
    }

    if (result.vaultPath === null) {
      return {
        content: [{
          type: "text" as const,
          text:
            `Not stored — "${effectiveKey}" already exists in the vault${scopeLabel}. ` +
            `Nothing was written. Store under a different key, or use ob_forget first if you meant to replace it.`,
        }],
      };
    }

    const row = v2db.prepare(`SELECT id FROM knowledge_index WHERE vault_path = ?`)
      .get(result.vaultPath) as { id: number } | undefined;

    const kindLabel = kind ? ` — kind: ${kind}` : "";
    return {
      content: [{ type: "text" as const, text: `Stored knowledge (id: ${row?.id ?? "?"}) with key "${effectiveKey}"${scopeLabel}${tags && tags.length > 0 ? ` — tags: ${tags.join(", ")}` : ""}${kindLabel}` }],
    };
  }
);

/** First few meaningful words of the content, as a fallback key. */
function deriveKey(content: string): string {
  const words = content
    .replace(/[^\p{L}\p{N}\s-]/gu, " ")
    .split(/\s+/)
    .filter((w) => w.length > 2)
    .slice(0, 6)
    .join("-");
  return slugify(words) || "unnamed";
}

// --- ob_feedback ---
export async function handleFeedback(args: { id: number; rating: "helpful" | "harmful" | "neutral" }): Promise<ToolResponse> {
  const { id, rating } = args;
    const v2db = getV2Db();
    const entry = v2db.prepare(
      // vault_path is still selected, though nothing in this handler reads it: the
      // apoptosis branch that archived the note before deleting the row is cut.
      "SELECT id, key, content, tags, source, helpful, harmful, neutral, maturity, vault_path FROM knowledge_index WHERE id = ?"
    ).get(id) as {
      id: number; key: string | null; content: string; tags: string | null; source: string;
      helpful: number; harmful: number; neutral: number; maturity: string;
      vault_path: string | null;
    } | undefined;

    if (!entry) {
      return { content: [{ type: "text" as const, text: `Error: no knowledge entry with id ${id}.` }], isError: true };
    }

    // Loop 10 C2: `evaluateLifecycle` is gone with E3, and apoptosis with E18.
    // The rating is still recorded — the ratings path (E4) is KEEP — but nothing
    // derives a maturity transition or a prune verdict from it any more.

    // Log the rating as an event — the aggregate
    // counters carry no timestamps and no session, so this is the only record
    // that can tell the shadow harness which session judged what.
    const feedbackSession = writeSessionId();
    if (feedbackSession.id) {
      try {
        // A single ob_feedback call is its own provenance: the caller named the
        // id directly rather than rating a resolved recall list.
        recordFeedbackEvent(v2db, feedbackSession.id, id, rating as Rating, "direct", "direct");
      } catch { /* non-critical */ }
    }

    // Loop 10 C2 (E18): the apoptosis auto-delete arm that stood here is gone. It
    // never fired — `archived_into` non-null was 0 rows across the whole corpus —
    // because it gated on a success rate that excluded neutral and therefore read
    // 1.0 for almost everything ever rated. `ob_forget` remains the way to retire
    // an entry, with a human in the loop, which is what actually happened.

    const col = rating; // v2 columns: helpful, harmful, neutral
    v2db.prepare(`
      UPDATE knowledge_index SET ${col} = ${col} + 1, updated_at = datetime('now') WHERE id = ?
    `).run(id);

    const lines = [
      `Feedback recorded for entry ${id} (${entry.key || "no key"}): ${rating}`,
      `Counts: ${entry.helpful + (rating === "helpful" ? 1 : 0)} helpful, ${entry.harmful + (rating === "harmful" ? 1 : 0)} harmful, ${entry.neutral + (rating === "neutral" ? 1 : 0)} neutral`,
    ];
    if (feedbackSession.id === null) {
      lines.push(`NOT LOGGED: this server cannot prove its session — ${feedbackSession.reason}`);
    }

    return { content: [{ type: "text" as const, text: lines.join("\n") }] };
}

server.tool(
  "ob_feedback",
  "Record whether a recalled knowledge entry was helpful, harmful, or neutral. Increments the entry's counter and writes a feedback_log row; nothing is derived from it further (maturity promotion was cut with E3 and apoptosis with E18 in Loop 10). Use ob_forget to retire an entry.",
  {
    id: z.coerce.number().describe("Knowledge entry ID"),
    rating: z.enum(["helpful", "harmful", "neutral"]).describe("Was this knowledge helpful, harmful, or neutral?"),
  },
  async ({ id, rating }) => handleFeedback({ id, rating }),
);

// --- ob_forget ---
server.tool(
  "ob_forget",
  "Remove a piece of stored knowledge by ID or key.",
  {
    id: z.number().optional().describe("Knowledge entry ID to remove"),
    key: z.string().optional().describe("Knowledge key to remove"),
  },
  async ({ id, key }) => {
    if (!id && !key) {
      return { content: [{ type: "text" as const, text: "Error: provide either an id or key to delete." }], isError: true };
    }
    const v2db = getV2Db();

    // Archive the notes before dropping the rows. Deleting the row alone left
    // the markdown in `Experiences/`, where skill-scan kept counting it while
    // ob_recall could no longer reach it.
    const doomed = (id
      ? v2db.prepare("SELECT vault_path FROM knowledge_index WHERE id = ?").all(id)
      : v2db.prepare("SELECT vault_path FROM knowledge_index WHERE key = ?").all(key)
    ) as { vault_path: string | null }[];

    let archived = 0;
    for (const row of doomed) {
      try {
        if (archiveVaultNote(v2VaultDir(), row.vault_path)) archived++;
      } catch { /* a note we cannot move must not block removing the row */ }
    }

    let deleted = 0;
    if (id) deleted = v2db.prepare("DELETE FROM knowledge_index WHERE id = ?").run(id).changes;
    else if (key) deleted = v2db.prepare("DELETE FROM knowledge_index WHERE key = ?").run(key).changes;

    return {
      content: [{
        type: "text" as const,
        text: deleted > 0
          ? `Removed ${deleted} knowledge entry(ies).${archived > 0 ? ` Moved ${archived} vault note(s) to Archive/.` : ""}`
          : `No knowledge found with ${id ? `id ${id}` : `key "${key}"`}.`,
      }],
    };
  }
);

// --- ob_list ---
server.tool(
  "ob_list",
  "List stored knowledge entries. Pass project to see only global + project-scoped entries.",
  {
    limit: z.number().optional().default(20).describe("Max entries to return"),
    project: z.string().optional().describe("Filter to global + this project's entries"),
  },
  async ({ limit, project }) => {
    const v2db = getV2Db();
    const normalizedProject = canonicalizeProjectDir(project);

    let sql = "SELECT id, key, content, tags, source, project_dir, created_at, maturity FROM knowledge_index WHERE archived_into IS NULL";
    const params: unknown[] = [];
    if (normalizedProject) {
      sql += " AND (project_dir IS NULL OR project_dir LIKE ?)";
      params.push(`%${normalizedProject}%`);
    }
    sql += " ORDER BY created_at DESC LIMIT ?";
    params.push(limit);

    const entries = v2db.prepare(sql).all(...params) as Array<{
      id: number; key: string | null; content: string; tags: string | null;
      source: string; project_dir: string | null; created_at: string;
      maturity: string;
    }>;

    if (entries.length === 0) {
      return { content: [{ type: "text" as const, text: "No stored knowledge entries yet." }] };
    }

    const lines = ["## Stored Knowledge", ""];
    for (const e of entries) {
      const scopeLabel = e.project_dir ? `[project]` : `[global]`;
      lines.push(`**[${e.id}]** ${scopeLabel} ${e.key ? `\`${e.key}\` — ` : ""}${e.content.length > 120 ? e.content.substring(0, 120) + "..." : e.content}`);
      if (e.tags) lines.push(`  Tags: ${e.tags}`);
      lines.push(`  Source: ${e.source} | Created: ${e.created_at}${e.project_dir ? ` | Project: ${e.project_dir}` : ""}`);
      lines.push("");
    }

    return { content: [{ type: "text" as const, text: lines.join("\n") }] };
  }
);

// --- ob_stats ---
server.tool(
  "ob_stats",
  "Show knowledge database statistics.",
  {},
  async () => {
    const v2db = getV2Db();
    const knowledge = v2db.prepare("SELECT COUNT(*) as c FROM knowledge_index WHERE archived_into IS NULL").get() as { c: number };
    const maturityDist = v2db.prepare(
      "SELECT COALESCE(maturity, 'progenitor') as maturity, COUNT(*) as count FROM knowledge_index WHERE archived_into IS NULL GROUP BY maturity ORDER BY count DESC"
    ).all() as Array<{ maturity: string; count: number }>;

    const rated = v2db.prepare(
      "SELECT COUNT(*) as c FROM knowledge_index WHERE (helpful + harmful + neutral) > 0 AND archived_into IS NULL"
    ).get() as { c: number };

    let dbSize = 0;
    try { dbSize = statSync(V2_DB_PATH).size; } catch { /* ignore */ }

    // The recall corpus states its own labeling quality before anyone analyzes
    // it: 'unspecified' counts callers that omitted the trigger (a labeling
    // gap, not a treatment), '(pre-column)' counts rows older than v0.18.0.
    const triggerCensus = v2db.prepare(
      "SELECT COALESCE(recall_trigger, '(pre-column)') as t, COUNT(*) as count FROM recall_log GROUP BY t ORDER BY count DESC"
    ).all() as Array<{ t: string; count: number }>;

    // The trigger's three states, across every session (Loop 16 R16, A8).
    //
    // This is the denominator the memory half never had. 'not-asked' says how
    // narrow the derivation is, 'silent' says whether the floor is set
    // sensibly, 'injected' says how often anything actually reached a seat —
    // and the difference between the first two is the distinction `ob_recalled`
    // could not make for five loops (G-039). Zero rows is itself an answer
    // here and is printed as three zeros rather than an omitted section: an
    // absent census reads as "not measured", which is the failure this table
    // exists to end.
    const fireCensus = v2db.prepare(
      "SELECT state, COUNT(*) as count FROM trigger_fires GROUP BY state ORDER BY count DESC"
    ).all() as Array<{ state: string; count: number }>;
    const fireCounts: Record<string, number> = { "not-asked": 0, silent: 0, injected: 0 };
    for (const row of fireCensus) fireCounts[row.state] = row.count;

    // Same contract for ratings: where each rated id came from, with the
    // pre-column era its own bucket rather than a healthy-looking zero.
    const originCensus = v2db.prepare(
      "SELECT COALESCE(rating_origin, '(pre-column)') as o, COUNT(*) as count FROM feedback_log GROUP BY o ORDER BY count DESC"
    ).all() as Array<{ o: string; count: number }>;

    // Which ARM produced each rating, crossed with the verdict. This is the
    // census the lifecycle work is blocked on. The `heuristic` arm that would
    // have skewed it was CUT in Loop 12 (R-010) having never written a row, so
    // every row here came from a judgment rather than a topic-mention detector. Crossed rather than
    // summed because the interesting cell is `supplied` x `harmful` (the
    // apoptosis threshold it once fed is cut).
    const methodCensus = v2db.prepare(
      `SELECT COALESCE(rating_method, '(pre-column)') as m, rating as r, COUNT(*) as count
       FROM feedback_log GROUP BY m, r ORDER BY m, r`
    ).all() as Array<{ m: string; r: string; count: number }>;

    const lines = [
      `## Knowledge Stats`,
      `Total entries: ${knowledge.c}`,
      `Rated entries: ${rated.c}`,
      `Database: ${V2_DB_PATH} (${(dbSize / 1024).toFixed(0)} KB)`,
      ``,
      `Maturity distribution:`,
      ...maturityDist.map(m => `  ${m.maturity}: ${m.count}`),
      ``,
      `Recall trigger census:`,
      ...triggerCensus.map(r => `  ${r.t}: ${r.count}`),
      ``,
      `Trigger fires (every invocation, whether or not it surfaced anything):`,
      `  not asked (no recognised element): ${fireCounts["not-asked"]}`,
      `  asked, silent (nothing cleared the floor): ${fireCounts.silent}`,
      `  asked, injected: ${fireCounts.injected}`,
      ``,
      `Rating origin census:`,
      ...originCensus.map(r => `  ${r.o}: ${r.count}`),
      ``,
      `Rating method x verdict:`,
      ...methodCensus.map(r => `  ${r.m} / ${r.r}: ${r.count}`),
      `  (the heuristic arm was cut in Loop 12 and never wrote a row; NULL means pre-column)`,
      ``,
      // Unconditional, including at zero — a line that only appears when
      // something went wrong reads identically to a healthy silence.
      // T-003: the self-registration count went with slot adoption. What replaces
      // it is the proof itself, read now, with the reason when there is none.
      (() => {
        const p = writeSessionId();
        return p.id !== null
          ? `Session proof (this server instance): ${p.id}, via parent process ${p.pid}`
          : `Session proof (this server instance): NONE — ${p.reason}`;
      })(),
      `Schema: code v${_schemaSkew?.codeVersion ?? "?"}, database v${_schemaSkew?.dbVersion ?? "?"}${_schemaSkew?.writerIsStale ? " — STALE WRITER" : ""}`,
    ];

    // Loop 10 C2 (E18): the apoptosis review queue is gone with the gate that fed
    // it. It listed entries that had crossed a threshold on `success_rate` — a
    // rate that excluded neutral, and so read 1.0 for almost everything. Loop 9
    // measured the resulting penalty firing on 2 entries out of 554.

    return { content: [{ type: "text" as const, text: lines.join("\n") }] };
  }
);

// --- ob_recalled ---
server.tool(
  "ob_recalled",
  "List knowledge entry IDs recalled this session. Used by session-end for auto-feedback.",
  {},
  async () => {
    const v2db = getV2Db();

    // Routed through resolveRecalledIds rather than reading the in-memory set
    // directly. Two reasons, both observed live:
    //
    // 1. The set is empty after `/mcp reconnect`, so this tool reported "none
    //    recalled" in exactly the sessions that had reconnected — the same
    //    in-memory-state loss v0.21.0 fixed for the write paths.
    // 2. `.recalled-entries.json` is per-PROJECT, not per-session. On
    //    2026-09-01 two concurrent sessions in this repo shared one file, and
    //    the second read the first's ids at close-out. Rating from those would
    //    have attributed one session's recalls to another for entries it never
    //    saw. resolveRecalledIds compares the file's `session_id` and refuses a
    //    mismatch; reading the file raw does not.
    const session = writeSessionId();
    const { resolved, foreign } = resolveRecalledIdsObserved({
      db: v2db,
      sessionId: session.id,
      explicitIds: [],
      filePaths: [resolve(process.cwd(), ".recalled-entries.json")],
      readFile: readRecalledFile,
    });

    const ids = resolved.ids;
    if (ids.length === 0) {
      const why = resolved.rejected
        ? `\nIgnored ${resolved.rejected.path}: ${resolved.rejected.reason}`
        : session.id !== null ? "" : `\nNo session id: ${session.reason}`;
      return { content: [{ type: "text" as const, text: `No knowledge entries recalled this session.${why}\n${formatForeignWriter(foreign).join("\n")}` }] };
    }

    // Which of these the HOOK put in front of the agent, as opposed to the
    // agent fetching them (Loop 16, A8). They are rated the same way and they
    // are not the same evidence: an entry fetched on demand was wanted, an
    // injected one was not asked for, and the whole question this loop exists
    // to answer is whether the second kind is worth anything.
    const hookInjected = new Set(
      (v2db.prepare(
        "SELECT DISTINCT knowledge_id FROM recall_log WHERE session_uuid = ? AND recall_trigger = 'hook'"
      ).all(session.id ?? "") as Array<{ knowledge_id: number }>).map((r) => r.knowledge_id),
    );

    const lines = [`Recalled ${ids.length} entries this session (source: ${resolved.origin}):`, ""];
    for (const id of ids) {
      const entry = v2db.prepare("SELECT id, key, maturity FROM knowledge_index WHERE id = ?").get(id) as { id: number; key: string | null; maturity: string } | undefined;
      const how = hookInjected.has(id) ? " [hook-injected]" : "";
      if (entry) lines.push(`  [${entry.id}] ${entry.key || "(no key)"} — ${entry.maturity}${how}`);
      else lines.push(`  [${id}] (deleted)${how}`);
    }
    lines.push("", ...formatForeignWriter(foreign));

    return { content: [{ type: "text" as const, text: lines.join("\n") }] };
  }
);

// --- ob_store_chunk: vault-first checkpoint/chunk storage ---
server.tool(
  "ob_store_chunk",
  "Store a checkpoint or knowledge chunk as a vault markdown file with DB index. Vault-first: the file is the source of truth, the DB entry is a rebuildable index.",
  {
    content: z.string().describe("The checkpoint content (what was accomplished, key context, files touched)"),
    key: z.string().describe("Short identifier (e.g. 'auth-refactor-phase-1')"),
    tags: z.array(z.string()).optional().describe("Tags for categorization"),
    category: z.enum(["checkpoint", "spec", "note", "other"]).optional().default("checkpoint").describe("Chunk category"),
    project_dir: z.string().optional().describe("Project working directory"),
    session_id: z.string().optional().describe("Session UUID for provenance. Checked against the proven session: a different id refuses (T-003). Omit to link the proven one."),
    phase: z.number().optional().describe("Phase number for multi-phase work"),
  },
  async (args) => handleStoreChunk(args)
);

export interface StoreChunkArgs {
  content: string;
  key: string;
  tags?: string[];
  category?: "checkpoint" | "spec" | "note" | "other";
  project_dir?: string;
  session_id?: string;
  phase?: number;
}

/** ob_store_chunk, exported so its session check is testable without the transport (T-003). */
export async function handleStoreChunk(args: StoreChunkArgs): Promise<ToolResponse> {
  const { content, key, tags, project_dir, phase } = args;
  const category = args.category ?? "checkpoint";
  // Same guard as ob_store: a chunk is stored the same way and leaks the same way.
  const chunkScaffold = findToolCallScaffolding(content);
  if (chunkScaffold) {
    return { content: [{ type: "text" as const, text: scaffoldRejectionMessage(chunkScaffold) }], isError: true };
  }
  // T-003: a named session_id is a claim, checked before anything is written.
  // With none named the chunk is linked to the PROVEN session, or to none.
  const chunkSession = attributedSession(args.session_id);
  if (chunkSession.refusal) {
    return { content: [{ type: "text" as const, text: `ob_store_chunk refused: ${chunkSession.refusal}` }], isError: true };
  }
  const session_id = chunkSession.id;

  const v2db = getV2Db();
  const now = new Date().toISOString();
  const date = now.slice(0, 10);
  const tagsStr = tags ? tags.join(", ") : "";
  const normalizedProject = canonicalizeProjectDir(project_dir);
  // Same rule as ob_store: the canonical path is lowercased, so the display
  // name comes from the raw dir. Matches existing checkpoint filenames.
  const projectSlug = normalizedProject ? projectDisplayName(project_dir, "general") : "general";
  const slug = slugify(key);
  const phaseStr = phase != null ? `-phase-${phase}` : "";

  // Vault-first: write markdown file
  const categoryDir = category === "checkpoint" ? "Checkpoints" : category === "spec" ? "Specs" : "Chunks";
  const fileName = `${date}-${projectSlug}-${slug}${phaseStr}.md`;
  const vaultPath = join(v2VaultDir(), categoryDir, fileName);

  const frontmatter = [
    "---",
    `type: ${category}`,
    `key: ${key}`,
    `project: ${projectSlug}`,
    `date: ${date}`,
    ...(session_id ? [`session: ${session_id}`] : []),
    ...(phase != null ? [`phase: ${phase}`] : []),
    `tags: [${[category, ...tags || []].join(", ")}]`,
    ...(normalizedProject ? [`working_dir: ${normalizedProject}`] : []),
    "---",
  ].join("\n");

  const fileContent = `${frontmatter}\n\n${content}\n`;

  mkdirSync(join(v2VaultDir(), categoryDir), { recursive: true });
  writeFileSync(vaultPath, fileContent, "utf-8");

  // DB index: store in knowledge_index so ob_recall can find it
  const result = v2db.prepare(`
    INSERT INTO knowledge_index
      (vault_path, key, content, tags, source, project_dir, maturity,
       helpful, harmful, neutral, recall_count, last_recalled_at, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, 'progenitor', 0, 0, 0, 0, NULL, ?, ?)
  `).run(vaultPath, key, content, [category, ...tags || []].join(", "), category, normalizedProject, now, now);

  const id = Number(result.lastInsertRowid);

  // Session provenance: knowledge_index has no session column, so link the
  // artifact to its producing session here. Stores the vault path, not a
  // second copy of the text — the vault file stays the source of truth.
  const sessionUuid = session_id;
  let linkedToSession = false;
  if (sessionUuid) {
    try {
      const sessionRowId = recordSession(v2db, sessionUuid, normalizedProject);
      recordChunk(v2db, sessionRowId, category, vaultPath, { key, knowledge_index_id: id, phase });
      linkedToSession = true;
    } catch {
      // Provenance is additive — never fail the store because of it.
    }
  }

  return {
    content: [{
      type: "text" as const,
      text: `${category === "checkpoint" ? "Checkpoint" : "Chunk"} stored (id: ${id}):\n  Key: ${key}\n  Vault: ${vaultPath}\n  Tags: ${[category, ...tags || []].join(", ")}`
        + (linkedToSession ? `\n  Session: ${sessionUuid}` : "")
        + (chunkSession.id === null ? `\n  Session: NOT linked — ${chunkSession.reason}` : ""),
    }],
  };
}

// --- Shared scoring logic ---
// The implementation lives in pipelines/sync/score.ts so the CLI uses the same
// one. This wrapper just supplies the server's open v2 database handle.
export function computeScore(
  projectRoot: string,
  checks: import("./pipelines/sync/types.js").CheckResult[],
): ScoreResult {
  return computeScoreShared(projectRoot, checks, getV2Db());
}

// --- Server startup (only when run directly, not when imported) ---
const isDirectRun = process.argv[1]?.endsWith("server.js") || process.argv[1]?.endsWith("server.ts");
if (isDirectRun) {
  const transport = new StdioServerTransport();
  server.connect(transport).catch((err) => {
    console.error("open-brain server failed:", err);
    process.exit(1);
  });
}

/** Narrows a declared seat role to the closed set the record accepts. */
function isSeat(role: string): role is Seat {
  return SeatName.safeParse(role).success;
}
