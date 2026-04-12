#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { resolve } from "node:path";
import { homedir } from "node:os";
import { existsSync, readFileSync, writeFileSync, readdirSync } from "node:fs";

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
import { sessionEnd } from "./pipelines/session-end/index.js";
import { createDb } from "./db.js";
import { resolvePaths } from "./shared/paths.js";
import { readJson } from "./shared/fs-utils.js";
import type { CategoryScore, ScoreResult } from "./pipelines/sync/types.js";

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
    const result = sessionStart({ projectRoot, homePath: homedir() });

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
    const paths = resolvePaths(projectRoot);
    const home = homedir();
    const dryRun = args.dry_run ?? false;

    // Read recalled entries from file if none provided
    let recalledIds = args.recalled_entry_ids ?? [];
    if (recalledIds.length === 0) {
      const recalledPath = resolve(projectRoot, ".agents", ".recalled-entries.json");
      const recalled = readJson<{ entries: { id: number }[] }>(recalledPath);
      recalledIds = recalled?.entries.map((e) => e.id) ?? [];
    }

    // Read experience files from vault
    const experiencesPath = resolve(paths.obsidianVault, "experiences");
    let experienceFiles: { name: string; content: string }[] = [];
    if (existsSync(experiencesPath)) {
      const files = readdirSync(experiencesPath).filter((f: string) => f.endsWith(".md"));
      experienceFiles = files.map((f: string) => ({
        name: f,
        content: readFileSync(resolve(experiencesPath, f), "utf-8"),
      }));
    }

    // Previous skill counts — placeholder until wired to real parser
    const previousSkillCounts = new Map<string, number>();

    // Open DB for real stores
    const db = createDb(paths.knowledgeDb);
    try {
      const result = sessionEnd({
        options: { projectRoot, homePath: home, sessionId: args.session_id ?? null, recalledEntryIds: recalledIds, dryRun },
        sessionSummary: args.session_summary ?? "",
        sessionFiles: [],
        experienceFiles,
        previousSkillCounts,
        chunkStore: db,
        knowledgeStore: db,
        vaultExperiencesPath: experiencesPath,
        readVaultFile: (p: string) => { try { return readFileSync(p, "utf-8"); } catch { return null; } },
        writeVaultFile: (p: string, c: string) => { if (!dryRun) writeFileSync(p, c, "utf-8"); },
      });

      const lines: string[] = [];
      lines.push(`Session End${dryRun ? " (dry run)" : ""}`);
      lines.push(`Chunks: ${result.chunks.sessionsIndexed} sessions, ${result.chunks.chunksCreated} chunks`);
      lines.push(`Feedback: ${result.feedback.processed} entries rated`);
      lines.push(`Frontmatter: ${result.frontmatter.filesUpdated} files updated`);
      lines.push(`Skills: ${result.skills.clusters.length} clusters, ${result.skills.pendingProposals} proposals, ${result.skills.approaching} approaching`);

      const errors = [
        ...result.chunks.errors.map((e) => `chunk: ${e}`),
        ...result.feedback.errors.map((e) => `feedback: ${e}`),
        ...result.frontmatter.errors.map((e) => `frontmatter: ${e}`),
      ];
      if (errors.length > 0) {
        lines.push(`\nErrors:`);
        for (const e of errors) lines.push(`  ${e}`);
      }

      return { content: [{ type: "text", text: lines.join("\n") }] };
    } finally {
      db.close();
    }
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
  "End a session — index chunks, auto-rate recalled knowledge, sync frontmatter to vault, scan for skill candidates.",
  {
    project_root: z.string().optional().describe("Project root directory (defaults to cwd)"),
    session_id: z.string().nullable().optional().default(null).describe("Session UUID (null if unknown)"),
    session_summary: z.string().optional().default("").describe("Session summary text for tag matching"),
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

// --- Shared scoring logic ---
export function computeScore(projectRoot: string, checks: import("./pipelines/sync/types.js").CheckResult[]): ScoreResult {
  const paths = resolvePaths(projectRoot);
  const configScore = scoreConfigStructure(checks);

  let qualityScore, stalenessScore, coverageScore;
  if (existsSync(paths.knowledgeDb)) {
    const db = createDb(paths.knowledgeDb);
    try {
      qualityScore = scoreKnowledgeQuality(db.getKnowledgeStats());
      stalenessScore = scoreStaleness(db.getStalenessStats());
      coverageScore = scoreCoverage(db.getCoverageStats(10));
    } finally {
      db.close();
    }
  } else {
    qualityScore = scoreKnowledgeQuality({
      helpful: 0, harmful: 0, neutral: 0,
      totalEntries: 0, ratedEntries: 0, duplicateClusters: 0,
    });
    stalenessScore = scoreStaleness({
      staleRatio: 0, lowSuccessCount: 0,
      summarizedSessions: 0, eligibleSessions: 0,
    });
    coverageScore = scoreCoverage({
      domainsWithEntries: 0, totalDomains: 0,
      matureCount: 0, provenCount: 0, totalEntries: 0,
      skillsImplemented: 0, proposalClusters: 0,
    });
  }

  const historyEntries = readHistory(paths.scoreHistory);
  const trend = calculateTrend(historyEntries);
  const healthScore = scorePipelineHealth({
    lastHookRun: null, scoreTrend: trend, lastShadowRecall: null,
  });

  const categories: CategoryScore[] = [
    configScore, qualityScore, stalenessScore, coverageScore, healthScore,
  ];
  const total = categories.reduce((sum, c) => sum + c.score, 0);

  return {
    total,
    categories,
    date: new Date().toISOString().split("T")[0],
  };
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
