#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { resolve, join, dirname } from "node:path";
import { homedir } from "node:os";
import { existsSync, readFileSync, writeFileSync, readdirSync, mkdirSync, appendFileSync, statSync } from "node:fs";
import type Database from "better-sqlite3";

import { runSync } from "./pipelines/sync/index.js";
import {
  scoreConfigStructure,
  scoreKnowledgeQuality,
  scoreStaleness,
  scoreCoverage,
  scorePipelineHealth,
} from "./pipelines/sync/scorer.js";
import { appendScore, readHistory, calculateTrend } from "./pipelines/sync/history.js";
import { sessionStart } from "./pipelines/session-start/index.js";
import { openV2Database, getKnowledgeQualityStats, getStalenessStats, getCoverageStats as getCoverageStatsV2, recordSession, recordChunk, recordRecallEvent, recordFeedbackEvent, archiveKnowledgeEntry, checkSchemaSkew, type SchemaSkew } from "./db-v2.js";
import { sessionEndV2 } from "./pipelines/session-end/index-v2.js";
import { resolveRecalledIds } from "./pipelines/session-end/recalled-ids.js";
import { readLastInvocationTs } from "./pipelines/session-end/invocation-logger.js";
import { computeScore as computeScoreShared } from "./pipelines/sync/score.js";
import { resolvePaths, canonicalizeProjectDir, projectDisplayName, obsidianVaultDir } from "./shared/paths.js";
import { readActiveSession, activeSessionKey, currentIde, isStaleSession, sessionEntryAgeMs, resolveWriteSession } from "./shared/active-session.js";
import { formatShadowReport, readShadowLog } from "./pipelines/shadow/index.js";
import { slugify, archiveVaultNote } from "./vault-writer.js";
import { findToolCallScaffolding, scaffoldRejectionMessage } from "./shared/content-guard.js";
import { evaluateLifecycle, apoptosisFlaggedExpr, formatApoptosisQueue, recallRankExpr, type ApoptosisCandidate, type FeedbackEntry, type Rating, type Maturity } from "./lifecycle.js";
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

let _activeSessionId: string | null = null;

/**
 * Times a write path had to recover the session from the slot file because the
 * in-memory registration was gone — i.e. operations that v0.19.x and earlier
 * would have silently not logged. Surfaced unconditionally in ob_stats: a
 * harness regression shows up as this number climbing, not as rows quietly
 * not existing. Per-instance by nature — the loss it counts is per-instance.
 */
let _sessionSelfRegistrations = 0;

/**
 * Session id for recall/feedback writes, self-registering from the hook's slot
 * file after a reconnect. Returns why there is no id when there is none, so
 * every caller can say "not logged" out loud instead of skipping silently.
 */
function writeSessionId(): { id: string | null; selfRegistered: boolean; reason?: string } {
  const cwd = process.cwd();
  const slot = _activeSessionId ? null : readActiveSession(
    resolvePaths(cwd).activeSession,
    activeSessionKey(canonicalizeProjectDir(cwd) || cwd, currentIde()),
  );
  const resolved = resolveWriteSession(_activeSessionId, slot);
  if (resolved.selfRegistered && resolved.id) {
    _activeSessionId = resolved.id;
    _sessionSelfRegistrations++;
  }
  return resolved;
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
    const projectRoot = resolve(args.project_root ?? ".");
    const result = runSync({ projectRoot, checkOnly: args.check_only ?? false, score: args.score ?? false, scoreJson: false, history: false });

    const lines: string[] = [];
    lines.push(`Sync — v${result.version}`);

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

    lines.push(`\nSummary: ${result.passed.length} passed, ${result.fixed.length} fixed, ${result.warnings.length} warnings, ${result.issues.length} issues`);

    if (args.score) {
      const scoreResult = computeScore(projectRoot, result.checks);
      lines.push(`\nHealth Score: ${scoreResult.total}/100`);
      for (const cat of scoreResult.categories) {
        const pct = Math.round((cat.score / cat.max) * 100);
        lines.push(`  ${cat.name}: ${cat.score}/${cat.max} (${pct}%)`);
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

export async function handleStart(args: {
  project_root?: string;
}): Promise<ToolResponse> {
  try {
    const projectRoot = resolve(args.project_root ?? ".");
    const result = sessionStart({ projectRoot, homePath: homedir(), sessionId: _activeSessionId });

    const lines: string[] = [];
    lines.push(`Session Start — ${result.state.mode} mode`);
    lines.push(`Project: v${result.state.version}`);

    if (result.drift.length > 0) {
      lines.push(`\nDrift detected:`);
      for (const d of result.drift) {
        lines.push(`  ${d.field}: expected ${d.expected}, got ${d.actual}${d.fixed ? " (fixed)" : ""}`);
      }
    }

    if (result.session.logPath) {
      lines.push(`\nSession #${result.session.sessionNumber}`);
      lines.push(`Log: ${result.session.logPath}`);
      lines.push(`Session ID: ${result.session.sessionId ?? "discovery failed"}`);
    }

    lines.push(`\nState: ${result.state.summary ? "SUMMARY loaded" : "no SUMMARY"}`);
    lines.push(`Inbox: ${result.state.inbox ? "INBOX loaded" : "no INBOX"}`);

    if (result.health.warnings.length > 0) {
      lines.push(`\nWarnings:`);
      for (const w of result.health.warnings) {
        lines.push(`  [${w.category}] ${w.message}`);
      }
    }

    if (result.health.pendingSkillProposals > 0) {
      lines.push(`\nSkill proposals pending: ${result.health.pendingSkillProposals} cluster(s) ready for review.`);
    }

    return { content: [{ type: "text", text: lines.join("\n") }] };
  } catch (err) {
    return {
      content: [{ type: "text", text: `ob_start error: ${err instanceof Error ? err.message : String(err)}` }],
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
    const v2db = getV2Db();

    // recall_log is authoritative when the session is known; the file is only
    // consulted when it names this same session. See resolveRecalledIds.
    const resolved = resolveRecalledIds({
      db: v2db,
      sessionId: args.session_id || null,
      explicitIds: args.recalled_entry_ids,
      filePaths: [resolve(projectRoot, ".recalled-entries.json")],
      readFile: (p) => { try { return readFileSync(p, "utf-8"); } catch { return null; } },
    });
    const recalledIds = resolved.ids;

    const result = sessionEndV2({
      db: v2db,
      vaultDir: v2VaultDir(),
      agentsDir: resolve(projectRoot, ".agents"),
      sessionId: args.session_id || "",
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
    const originLine =
      `  Recalled ids: ${recalledIds.length} from ${resolved.origin}` +
      (resolved.rejected
        ? `\n  Ignored ${resolved.rejected.path}: ${resolved.rejected.reason}`
        : ``);

    const shadowLine = result.shadow.evaluated
      ? `  Shadow recall: ${result.shadow.strategies} strategies over ${result.shadow.queries} queries (best: ${result.shadow.leader})`
      : `  Shadow recall: skipped (${result.shadow.skipped})`;

    const shadowReport = formatShadowReport(readShadowLog(resolvePaths(projectRoot).shadowLog));

    return {
      content: [{
        type: "text",
        text: `Session End:\n  Summary: ${result.summary.written ? "written" : "skipped"}${result.summary.selfGenerated ? " (self-generated)" : ""}\n${originLine}\n  Feedback: ${result.feedback.processed} entries rated\n  Reflection: ${result.reflection.flagged} clusters flagged\n  Invocations: ${result.invocations.logged} logged\n  Skill scan: ${result.skillScan.clusters} clusters (${result.skillScan.pendingProposals} pending proposals)\n${shadowLine}\n\n${shadowReport}`,
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
    const projectRoot = resolve(args.project_root ?? ".");
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
      const result = runSync({ projectRoot, checkOnly: true, score: false, scoreJson: false, history: false });
      const scoreResult = computeScore(projectRoot, result.checks);

      lines.push(`Health Score: ${scoreResult.total}/100`);
      for (const cat of scoreResult.categories) {
        const pct = Math.round((cat.score / cat.max) * 100);
        lines.push(`  ${cat.name}: ${cat.score}/${cat.max} (${pct}%)`);
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
  "Start a new session — reads project state, detects drift, discovers session UUID, creates session log.",
  {
    project_root: z.string().optional().describe("Project root directory (defaults to cwd)"),
  },
  async (args) => handleStart(args)
);

server.tool(
  "ob_end",
  "End a session — self-generate summary from session .db, auto-rate recalled knowledge, write vault summary, flag reflection clusters.",
  {
    project_root: z.string().optional().describe("Project root directory (defaults to cwd)"),
    session_id: z.string().nullable().optional().default(null).describe("Session UUID (null if unknown)"),
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
  "Register the active session ID. Call once at session start for provenance tracking.",
  {
    session_id: z.string().optional().describe(
      "The session UUID. Omit (or pass \"none\") when the IDE does not surface one — "
      + "the UUID recorded by the SessionStart hook is used instead."
    ),
    project_dir: z.string().optional().describe("Current working directory"),
  },
  async ({ session_id, project_dir }) => {
    const cwd = project_dir || process.cwd();

    // Fall back to the hook's file handoff. Cursor does not reliably put the
    // hook's stdout into agent context, so a Cursor agent has no UUID to pass
    // and previously registered nothing at all — leaving recall_log and
    // feedback_log empty and shadow recall with no ground truth.
    let resolvedFrom = "argument";
    let staleWarning = "";
    if (!session_id || session_id === "none") {
      const ide = currentIde();
      const active = readActiveSession(
        resolvePaths(cwd).activeSession,
        activeSessionKey(canonicalizeProjectDir(cwd) || cwd, ide),
      );
      if (!active) {
        return {
          content: [{
            type: "text" as const,
            text: `Error: no session_id given and no active session recorded for `
              + `ide "${ide}" in this project. Check that the SessionStart hook is `
              + `registered for this IDE, and that its MCP registration sets `
              + `OPEN_BRAIN_IDE. Re-run scripts/setup.mjs if unsure.`,
          }],
          isError: true,
        };
      }
      session_id = active.uuid;
      resolvedFrom = `hook file (${active.source}, ide ${active.ide ?? "unset"})`;

      // A slot the SessionStart hook never refreshed keeps answering forever. A
      // Cursor seat was handed a sixteen-day-old UUID in this same confident
      // wording and filed a session's worth of chunks and ratings under it. The
      // read still succeeds — the id is better than nothing — but it stops
      // sounding like a live registration.
      if (isStaleSession(active)) {
        const ageMs = sessionEntryAgeMs(active);
        const age = ageMs === null
          ? "an unreadable timestamp"
          : `${Math.floor(ageMs / 86_400_000)}d ${Math.floor((ageMs % 86_400_000) / 3_600_000)}h old`;
        staleWarning = `\n\nWARNING: this id came from a slot ${age} (started_at `
          + `${active.started_at || "missing"}), not from a fresh session start. The `
          + `SessionStart hook for ide "${ide}" has not run in this workspace, so work `
          + `may be filed under a previous session. Check that the hook is registered `
          + `and actually executing before trusting this id.`;
      }
    }

    _activeSessionId = session_id;

    // Persist as well as hold in memory: an in-memory-only registration left no
    // record to verify against after the session ended, which is why the
    // SESSION_UUID wiring had to be checked by hand every time.
    let persisted = false;
    try {
      recordSession(getV2Db(), session_id, canonicalizeProjectDir(project_dir));
      persisted = true;
    } catch {
      // Registration must not fail the session if the DB is unavailable.
    }

    return {
      content: [{
        type: "text" as const,
        text: `Session registered: ${session_id}${project_dir ? ` (${project_dir})` : ""}`
          + ` [via ${resolvedFrom}]`
          + (persisted ? "" : " — warning: not persisted to the sessions table")
          + staleWarning,
      }],
    };
  }
);

// --- ob_recall ---
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
  async ({ queries, project, global: globalSearch, tags, verbose, limit, trigger }) => {
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
          k.maturity, k.success_rate,
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
        success_rate: number | null; snippet: string; created_at: string;
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
        if (session.id) {
          try {
            recordRecallEvent(v2db, session.id, query, rows.map((r) => r.id), trigger);
          } catch { /* non-critical */ }
          if (session.selfRegistered) {
            results.push(`_(session ${session.id} self-registered from the hook slot after a server restart)_`);
          }
        } else {
          results.push(`_(NOT LOGGED: no active session — ${session.reason === "stale-slot" ? "the hook slot is stale" : "no hook slot found"}; run ob_set_session to restore recall logging)_`);
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
server.tool(
  "ob_feedback",
  "Record whether a recalled knowledge entry was helpful, harmful, or neutral. Drives maturity promotion and apoptosis.",
  {
    id: z.coerce.number().describe("Knowledge entry ID"),
    rating: z.enum(["helpful", "harmful", "neutral"]).describe("Was this knowledge helpful, harmful, or neutral?"),
  },
  async ({ id, rating }) => {
    const v2db = getV2Db();
    const entry = v2db.prepare(
      // vault_path is selected for the apoptosis branch: the note has to be
      // archived before the row goes, and after the DELETE there is nothing
      // left to look it up from.
      "SELECT id, key, content, tags, source, helpful, harmful, neutral, success_rate, maturity, vault_path FROM knowledge_index WHERE id = ?"
    ).get(id) as {
      id: number; key: string | null; content: string; tags: string | null; source: string;
      helpful: number; harmful: number; neutral: number; success_rate: number | null; maturity: string;
      vault_path: string | null;
    } | undefined;

    if (!entry) {
      return { content: [{ type: "text" as const, text: `Error: no knowledge entry with id ${id}.` }], isError: true };
    }

    const feedbackEntry: FeedbackEntry = {
      id: entry.id, helpful: entry.helpful, harmful: entry.harmful, neutral: entry.neutral,
      success_rate: entry.success_rate, maturity: entry.maturity as Maturity, source: entry.source,
    };

    const result = evaluateLifecycle(feedbackEntry, rating as Rating);

    // Log the rating as an event before any apoptosis delete — the aggregate
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

    if (result.autoDelete) {
      // Archive rather than unlink: apoptosis fires with no human in the loop,
      // so destroying a readable note automatically is the wrong default.
      let archivedTo: string | null = null;
      try {
        archivedTo = archiveVaultNote(v2VaultDir(), entry.vault_path);
      } catch { /* non-critical — still archive the row */ }

      // Soft-delete. The row used to be hard-DELETEd here, which was the more
      // destructive half of the same decision the note-archiving above already
      // rejected: `feedback_log` and `recall_log` carry no foreign key, so the
      // rating history that justified the prune survived as rows pointing at an
      // id that no longer existed — unreachable, and indistinguishable from
      // never having been rated. Retiring the row keeps the verdict auditable
      // and makes the prune reversible by clearing one column.
      //
      // The counters are written in the same statement, so the archived row
      // records the rating that crossed the threshold rather than the state
      // just before it.
      archiveKnowledgeEntry(v2db, id, {
        rating: rating as Rating,
        successRate: result.newSuccessRate,
        maturity: result.newMaturity,
      });

      try {
        const logPath = join(v2VaultDir(), ".vault-writer.log");
        appendFileSync(logPath, `[${new Date().toISOString()}] APOPTOSIS: id=${id} key="${entry.key || ""}" ${result.transitionMessage}${archivedTo ? ` archived=${archivedTo}` : ""}\n`);
      } catch { /* non-critical */ }
      return {
        content: [{
          type: "text" as const,
          text: `${result.transitionMessage}\nEntry ${id} (${entry.key || "no key"}) has been archived — it no longer appears in recall, lists, or stats.`
            + (archivedTo ? `\nIts note was moved to Archive/.` : "")
            + `\nNothing was destroyed: the row and its rating history remain. To restore it, clear archived_into; to remove it for good, use ob_forget.`,
        }],
      };
    }

    const col = rating; // v2 columns: helpful, harmful, neutral
    v2db.prepare(`
      UPDATE knowledge_index SET ${col} = ${col} + 1, success_rate = ?, maturity = ?, updated_at = datetime('now') WHERE id = ?
    `).run(result.newSuccessRate, result.newMaturity, id);

    const lines = [
      `Feedback recorded for entry ${id} (${entry.key || "no key"}): ${rating}`,
      `Counts: ${entry.helpful + (rating === "helpful" ? 1 : 0)} helpful, ${entry.harmful + (rating === "harmful" ? 1 : 0)} harmful, ${entry.neutral + (rating === "neutral" ? 1 : 0)} neutral`,
      `Success rate: ${result.newSuccessRate !== null ? result.newSuccessRate.toFixed(2) : "N/A"}`,
      `Maturity: ${result.newMaturity}`,
    ];
    if (result.transitionMessage) lines.push(`Lifecycle: ${result.transitionMessage}`);

    return { content: [{ type: "text" as const, text: lines.join("\n") }] };
  }
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

    let sql = "SELECT id, key, content, tags, source, project_dir, created_at, maturity, success_rate FROM knowledge_index WHERE archived_into IS NULL";
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
      maturity: string; success_rate: number | null;
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

    // Same contract for ratings: where each rated id came from, with the
    // pre-column era its own bucket rather than a healthy-looking zero.
    const originCensus = v2db.prepare(
      "SELECT COALESCE(rating_origin, '(pre-column)') as o, COUNT(*) as count FROM feedback_log GROUP BY o ORDER BY count DESC"
    ).all() as Array<{ o: string; count: number }>;

    // Which ARM produced each rating, crossed with the verdict. This is the
    // census the lifecycle work is blocked on: `heuristic` rows come from a
    // tag-substring topic-mention detector that cannot emit `harmful`, so a
    // `helpful` there means "mentioned", not "worked". Crossed rather than
    // summed because the interesting cell is `supplied` x `harmful` — the only
    // combination that can ever make an apoptosis threshold satisfiable.
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
      `Rating origin census:`,
      ...originCensus.map(r => `  ${r.o}: ${r.count}`),
      ``,
      `Rating method x verdict:`,
      ...methodCensus.map(r => `  ${r.m} / ${r.r}: ${r.count}`),
      `  (heuristic cannot produce 'harmful' — a helpful there means "tag mentioned in summary")`,
      ``,
      // Unconditional, including at zero — a line that only appears when
      // something went wrong reads identically to a healthy silence.
      `Session self-registrations (this server instance): ${_sessionSelfRegistrations}`,
      `Schema: code v${_schemaSkew?.codeVersion ?? "?"}, database v${_schemaSkew?.dbVersion ?? "?"}${_schemaSkew?.writerIsStale ? " — STALE WRITER" : ""}`,
    ];

    // Entries that crossed the apoptosis threshold and survived because they
    // were stored manually. Until now "flagged for review" appeared only in the
    // one ob_feedback response that crossed the line, so the review queue could
    // not be listed at all.
    const flagged = v2db.prepare(
      `SELECT id, key, helpful, harmful, success_rate FROM knowledge_index k
       WHERE archived_into IS NULL AND ${apoptosisFlaggedExpr("k")}
       ORDER BY success_rate ASC, (helpful + harmful) DESC`
    ).all() as ApoptosisCandidate[];

    lines.push(...formatApoptosisQueue(flagged));

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
    const resolved = resolveRecalledIds({
      db: v2db,
      sessionId: session.id,
      explicitIds: [],
      filePaths: [resolve(process.cwd(), ".recalled-entries.json")],
      readFile: (p) => { try { return readFileSync(p, "utf-8"); } catch { return null; } },
    });

    const ids = resolved.ids;
    if (ids.length === 0) {
      const why = resolved.rejected
        ? `\nIgnored ${resolved.rejected.path}: ${resolved.rejected.reason}`
        : session.id ? "" : `\nNo session id: ${session.reason ?? "unknown"}`;
      return { content: [{ type: "text" as const, text: `No knowledge entries recalled this session.${why}` }] };
    }

    const lines = [`Recalled ${ids.length} entries this session (source: ${resolved.origin}):`, ""];
    for (const id of ids) {
      const entry = v2db.prepare("SELECT id, key, maturity FROM knowledge_index WHERE id = ?").get(id) as { id: number; key: string | null; maturity: string } | undefined;
      if (entry) lines.push(`  [${entry.id}] ${entry.key || "(no key)"} — ${entry.maturity}`);
      else lines.push(`  [${id}] (deleted)`);
    }

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
    session_id: z.string().optional().describe("Session UUID for provenance"),
    phase: z.number().optional().describe("Phase number for multi-phase work"),
  },
  async ({ content, key, tags, category, project_dir, session_id, phase }) => {
    // Same guard as ob_store: a chunk is stored the same way and leaks the same way.
    const chunkScaffold = findToolCallScaffolding(content);
    if (chunkScaffold) {
      return { content: [{ type: "text" as const, text: scaffoldRejectionMessage(chunkScaffold) }], isError: true };
    }

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
         helpful, harmful, neutral, success_rate, recall_count, last_recalled_at, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, 'progenitor', 0, 0, 0, NULL, 0, NULL, ?, ?)
    `).run(vaultPath, key, content, [category, ...tags || []].join(", "), category, normalizedProject, now, now);

    const id = Number(result.lastInsertRowid);

    // Session provenance: knowledge_index has no session column, so link the
    // artifact to its producing session here. Stores the vault path, not a
    // second copy of the text — the vault file stays the source of truth.
    const sessionUuid = session_id ?? writeSessionId().id;
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
          + (linkedToSession ? `\n  Session: ${sessionUuid}` : ""),
      }],
    };
  }
);

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
