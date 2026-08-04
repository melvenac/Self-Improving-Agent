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
import { openV2Database, getKnowledgeQualityStats, getStalenessStats, getCoverageStats as getCoverageStatsV2, recordSession, recordChunk, recordRecallEvent, recordFeedbackEvent } from "./db-v2.js";
import { sessionEndV2 } from "./pipelines/session-end/index-v2.js";
import { readLastInvocationTs } from "./pipelines/session-end/invocation-logger.js";
import { computeScore as computeScoreShared } from "./pipelines/sync/score.js";
import { resolvePaths, canonicalizeProjectDir, obsidianVaultDir } from "./shared/paths.js";
import { readActiveSession, activeSessionKey, currentIde } from "./shared/active-session.js";
import { formatShadowReport, readShadowLog } from "./pipelines/shadow/index.js";
import { readJson } from "./shared/fs-utils.js";
import { slugify, writeExperience } from "./vault-writer.js";
import { evaluateLifecycle, recallRankExpr, type FeedbackEntry, type Rating, type Maturity } from "./lifecycle.js";
import type { CategoryScore, ScoreResult } from "./pipelines/sync/types.js";

// --- V2 Database singleton ---

const V2_DB_PATH = process.env.KNOWLEDGE_V2_DB || join(homedir(), ".claude", "open-brain", "knowledge-v2.db");
// Resolved per call, not once at import. As a frozen const this ignored
// OPEN_BRAIN_VAULT_DIR, so the server tests wrote summaries for their temp
// projects into the real vault — 57 `ob-server-*` files had accumulated there
// since April before anyone noticed.
const v2VaultDir = () => obsidianVaultDir();

let _v2db: Database.Database | null = null;
function getV2Db(): Database.Database {
  if (_v2db) return _v2db;
  _v2db = openV2Database(V2_DB_PATH);
  return _v2db;
}

let _activeSessionId: string | null = null;
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
  dry_run?: boolean;
}

export async function handleEnd(args: EndArgs): Promise<ToolResponse> {
  try {
    const projectRoot = resolve(args.project_root ?? ".");
    const v2db = getV2Db();

    // Read recalled entries from file if none provided
    let recalledIds = args.recalled_entry_ids ?? [];
    if (recalledIds.length === 0) {
      const recalledPath = resolve(projectRoot, ".recalled-entries.json");
      const recalled = readJson<{ entries: { id: number }[] }>(recalledPath);
      recalledIds = recalled?.entries.map((e) => e.id) ?? [];
    }

    const result = sessionEndV2({
      db: v2db,
      vaultDir: v2VaultDir(),
      agentsDir: resolve(projectRoot, ".agents"),
      sessionId: args.session_id || "",
      sessionSummary: args.session_summary || "",
      project: projectRoot.split(/[/\\]/).filter(Boolean).pop() || "General",
      recalledEntryIds: recalledIds,
      dryRun: args.dry_run || false,
      shadowLogPath: resolvePaths(projectRoot).shadowLog,
    });

    const shadowLine = result.shadow.evaluated
      ? `  Shadow recall: ${result.shadow.strategies} strategies over ${result.shadow.queries} queries (best: ${result.shadow.leader})`
      : `  Shadow recall: skipped (${result.shadow.skipped})`;

    const shadowReport = formatShadowReport(readShadowLog(resolvePaths(projectRoot).shadowLog));

    return {
      content: [{
        type: "text",
        text: `Session End:\n  Summary: ${result.summary.written ? "written" : "skipped"}${result.summary.selfGenerated ? " (self-generated)" : ""}\n  Feedback: ${result.feedback.processed} entries rated\n  Reflection: ${result.reflection.flagged} clusters flagged\n  Invocations: ${result.invocations.logged} logged\n  Skill scan: ${result.skillScan.clusters} clusters (${result.skillScan.pendingProposals} pending proposals)\n${shadowLine}\n\n${shadowReport}`,
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
          + (persisted ? "" : " — warning: not persisted to the sessions table"),
      }],
    };
  }
);

// --- ob_recall ---
server.tool(
  "ob_recall",
  "Search across all stored knowledge. Returns ranked results. By default, results are scoped to the project you specify. Set `global: true` to search across all projects.",
  {
    queries: z.array(z.string()).min(1).describe("Search queries — batch all questions in one call"),
    project: z.string().optional().describe("Your current working directory — used to scope results"),
    global: z.boolean().optional().default(false).describe("If true, search across ALL projects"),
    tags: z.array(z.string()).optional().describe("Filter by tags"),
    verbose: z.boolean().optional().default(false).describe("If true, return full content instead of snippets"),
    limit: z.number().optional().default(5).describe("Results per query (default: 5)"),
  },
  async ({ queries, project, global: globalSearch, tags, verbose, limit }) => {
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
        // never break a recall.
        if (_activeSessionId) {
          try {
            recordRecallEvent(v2db, _activeSessionId, query, rows.map((r) => r.id));
          } catch { /* non-critical */ }
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

    return { content: [{ type: "text" as const, text: results.join("\n") }] };
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
  },
  async ({ content, key, tags, source, scope, project_dir }) => {
    const v2db = getV2Db();
    const now = new Date().toISOString();
    const tagsStr = tags ? tags.join(", ") : "";
    const effectiveProject = scope === "project" ? canonicalizeProjectDir(project_dir) : null;

    // Derive vault path
    const slug = slugify(key || "unnamed");
    const projectName = effectiveProject
      ? effectiveProject.split("/").pop() || "General"
      : "General";
    const vaultPath = join(v2VaultDir(), "Experiences", projectName, `${slug}.md`);

    // Write vault file
    writeExperience(v2VaultDir(), {
      key: key || "unnamed",
      tags: tags || [],
      content,
      created: now,
      maturity: "progenitor",
      helpful: 0, harmful: 0, neutral: 0,
      project: projectName,
      source: source || "manual",
    });

    // Insert into DB (FTS auto-populated by trigger)
    const result = v2db.prepare(`
      INSERT INTO knowledge_index
        (vault_path, key, content, tags, source, project_dir, maturity,
         helpful, harmful, neutral, success_rate, recall_count, last_recalled_at, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, 'progenitor', 0, 0, 0, NULL, 0, NULL, ?, ?)
    `).run(vaultPath, key || null, content, tagsStr, source || "manual", effectiveProject, now, now);

    const id = Number(result.lastInsertRowid);
    const scopeLabel = effectiveProject ? ` [project: ${effectiveProject}]` : " [global]";

    return {
      content: [{ type: "text" as const, text: `Stored knowledge (id: ${id})${key ? ` with key "${key}"` : ""}${scopeLabel}${tags && tags.length > 0 ? ` — tags: ${tags.join(", ")}` : ""}` }],
    };
  }
);

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
      "SELECT id, key, content, tags, source, helpful, harmful, neutral, success_rate, maturity FROM knowledge_index WHERE id = ?"
    ).get(id) as {
      id: number; key: string | null; content: string; tags: string | null; source: string;
      helpful: number; harmful: number; neutral: number; success_rate: number | null; maturity: string;
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
    if (_activeSessionId) {
      try {
        recordFeedbackEvent(v2db, _activeSessionId, id, rating as Rating);
      } catch { /* non-critical */ }
    }

    if (result.autoDelete) {
      v2db.prepare("DELETE FROM knowledge_index WHERE id = ?").run(id);
      try {
        const logPath = join(v2VaultDir(), ".vault-writer.log");
        appendFileSync(logPath, `[${new Date().toISOString()}] APOPTOSIS: id=${id} key="${entry.key || ""}" ${result.transitionMessage}\n`);
      } catch { /* non-critical */ }
      return { content: [{ type: "text" as const, text: `${result.transitionMessage}\nEntry ${id} (${entry.key || "no key"}) has been removed.` }] };
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
    let deleted = 0;
    if (id) deleted = v2db.prepare("DELETE FROM knowledge_index WHERE id = ?").run(id).changes;
    else if (key) deleted = v2db.prepare("DELETE FROM knowledge_index WHERE key = ?").run(key).changes;

    return {
      content: [{ type: "text" as const, text: deleted > 0 ? `Removed ${deleted} knowledge entry(ies).` : `No knowledge found with ${id ? `id ${id}` : `key "${key}"`}.` }],
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

    const lines = [
      `## Knowledge Stats`,
      `Total entries: ${knowledge.c}`,
      `Rated entries: ${rated.c}`,
      `Database: ${V2_DB_PATH} (${(dbSize / 1024).toFixed(0)} KB)`,
      ``,
      `Maturity distribution:`,
      ...maturityDist.map(m => `  ${m.maturity}: ${m.count}`),
    ];

    return { content: [{ type: "text" as const, text: lines.join("\n") }] };
  }
);

// --- ob_recalled ---
server.tool(
  "ob_recalled",
  "List knowledge entry IDs recalled this session. Used by session-end for auto-feedback.",
  {},
  async () => {
    const ids = Array.from(_recalledKnowledgeIds);
    if (ids.length === 0) {
      return { content: [{ type: "text" as const, text: "No knowledge entries recalled this session." }] };
    }

    const v2db = getV2Db();
    const lines = [`Recalled ${ids.length} entries this session:`, ""];
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
    const v2db = getV2Db();
    const now = new Date().toISOString();
    const date = now.slice(0, 10);
    const tagsStr = tags ? tags.join(", ") : "";
    const normalizedProject = canonicalizeProjectDir(project_dir);
    const projectSlug = normalizedProject
      ? normalizedProject.split("/").pop() || "general"
      : "general";
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
    const sessionUuid = session_id ?? _activeSessionId;
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
