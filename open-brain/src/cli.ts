#!/usr/bin/env node

import { resolve } from "node:path";
import { runSync } from "./pipelines/sync/index.js";
import {
  scoreConfigStructure,
  scoreKnowledgeQuality,
  scoreStaleness,
  scoreCoverage,
  scorePipelineHealth,
} from "./pipelines/sync/scorer.js";
import { appendScore, readHistory, calculateTrend } from "./pipelines/sync/history.js";
import { resolvePaths } from "./shared/paths.js";
import type { ScoreResult, CategoryScore } from "./pipelines/sync/types.js";

const args = process.argv.slice(2);
const command = args[0];

if (command === "sync") {
  const checkOnly = args.includes("--check");
  const score = args.includes("--score");
  const scoreJson = args.includes("--json");
  const history = args.includes("--history");
  const projectRoot = resolve(args.find((a) => !a.startsWith("--") && a !== "sync") ?? ".");

  if (history) {
    const paths = resolvePaths(projectRoot);
    const entries = readHistory(paths.scoreHistory);
    if (entries.length === 0) {
      console.log("No score history found.");
    } else {
      const trend = calculateTrend(entries);
      console.log(`Score History (${entries.length} entries):`);
      for (const entry of entries.slice(-10)) {
        console.log(`  ${entry.date}: ${entry.total}/100`);
      }
      console.log(`Trend: ${trend}`);
    }
    process.exit(0);
  }

  const result = runSync({ projectRoot, checkOnly, score, scoreJson, history });

  // Print results
  console.log(`\nSync — v${result.version}\n`);

  if (result.fixed.length > 0) {
    console.log("FIXED:");
    for (const c of result.fixed) console.log(`  ${c.name}: ${c.message}`);
    console.log();
  }

  if (result.issues.length > 0) {
    console.log("ISSUES:");
    for (const c of result.issues) console.log(`  ${c.name}: ${c.message}`);
    console.log();
  }

  if (result.warnings.length > 0) {
    console.log("WARNINGS:");
    for (const c of result.warnings) console.log(`  ${c.name}: ${c.message}`);
    console.log();
  }

  console.log(
    `Summary: ${result.passed.length} passed, ${result.fixed.length} fixed, ${result.warnings.length} warnings, ${result.issues.length} issues`
  );

  if (score) {
    const paths = resolvePaths(projectRoot);
    const { existsSync } = await import("node:fs");

    // Score against the same v2 database the MCP server uses. This path used to
    // open the retired v1 knowledge.db, so `open-brain sync --score` and
    // `ob_score` reported different totals for the same repo.
    const { computeScore } = await import("./pipelines/sync/score.js");
    const { openV2Database } = await import("./db-v2.js");

    if (!existsSync(paths.knowledgeV2Db)) {
      console.error(`Knowledge database not found at ${paths.knowledgeV2Db} — cannot score.`);
      process.exit(1);
    }

    const v2db = openV2Database(paths.knowledgeV2Db);
    let computed: ScoreResult;
    try {
      computed = computeScore(projectRoot, result.checks, v2db);
    } finally {
      v2db.close();
    }

    const categories: CategoryScore[] = computed.categories;
    const total = computed.total;

    const scoreResult: ScoreResult = {
      total,
      categories,
      date: computed.date,
    };

    if (scoreJson) {
      console.log(JSON.stringify(scoreResult, null, 2));
    } else {
      console.log(`\nHealth Score: ${total}/100\n`);
      for (const cat of categories) {
        const bar = "█".repeat(Math.round((cat.score / cat.max) * 20)).padEnd(20, "░");
        console.log(`  ${bar} ${cat.name}: ${cat.score}/${cat.max}`);
      }
      appendScore(paths.scoreHistory, scoreResult);
      console.log(`\nAppended to score history.`);
    }
  }

  if (checkOnly && result.issues.length > 0) {
    process.exit(1);
  }
} else if (command === "start") {
  const projectRoot = resolve(args.find((a) => !a.startsWith("--") && a !== "start") ?? ".");

  // Dynamic import to avoid loading session-start code when running sync
  const { sessionStart } = await import("./pipelines/session-start/index.js");
  const { homedir } = await import("node:os");
  const result = sessionStart({ projectRoot, homePath: homedir() });

  console.log(`\nSession Start — ${result.state.mode} mode`);
  console.log(`Project: v${result.state.version}`);

  if (result.drift.length > 0) {
    console.log(`\nDrift detected:`);
    for (const d of result.drift) {
      console.log(`  ${d.field}: expected ${d.expected}, got ${d.actual}`);
    }
  }

  if (result.session.logPath) {
    console.log(`\nSession log: ${result.session.logPath}`);
    console.log(`Session ID: ${result.session.sessionId ?? "discovery failed"}`);
  }

  console.log(`\nState: ${result.state.summary ? "SUMMARY loaded" : "no SUMMARY"}`);
  console.log(`Inbox: ${result.state.inbox ? "INBOX loaded" : "no INBOX"}`);
} else if (command === "end") {
  const projectRoot = resolve(args.find((a) => !a.startsWith("--") && a !== "end") ?? ".");
  const dryRun = args.includes("--dry-run");

  const { sessionEnd } = await import("./pipelines/session-end/index.js");
  const { homedir } = await import("node:os");
  const { join } = await import("node:path");
  const { readFileSync, readdirSync, writeFileSync, existsSync } = await import("node:fs");
  const { readJson } = await import("./shared/fs-utils.js");

  const paths = resolvePaths(projectRoot);
  const home = homedir();

  // Read recalled entries from session start
  const recalledPath = join(projectRoot, ".agents", ".recalled-entries.json");
  const recalled = readJson<{ entries: { id: number }[] }>(recalledPath);
  const recalledIds = recalled?.entries.map((e) => e.id) ?? [];

  // Read experience files from vault
  const experiencesPath = join(paths.obsidianVault, "experiences");
  let experienceFiles: { name: string; content: string }[] = [];
  if (existsSync(experiencesPath)) {
    const files = readdirSync(experiencesPath).filter((f: string) => f.endsWith(".md"));
    experienceFiles = files.map((f: string) => ({
      name: f,
      content: readFileSync(join(experiencesPath, f), "utf-8"),
    }));
  }

  // Previous skill counts — placeholder until wired to real SKILL-CANDIDATES.md parser
  const previousSkillCounts = new Map<string, number>();

  console.log(`\nSession End${dryRun ? " (dry run)" : ""}`);
  console.log(`Project: ${projectRoot}`);
  console.log(`Recalled entries: ${recalledIds.length}`);

  // Chunk store and knowledge store require DB connection
  // CLI mode uses no-op stores — real integration via MCP server
  const noopChunkStore = {
    insertChunk: () => {},
    insertSession: () => {},
    getIndexedSessionFiles: () => [] as string[],
  };
  const noopKnowledgeStore = {
    getEntry: () => null,
    updateFeedback: () => {},
    getEntryCounters: () => null,
  };

  const result = sessionEnd({
    options: { projectRoot, homePath: home, sessionId: null, recalledEntryIds: recalledIds, dryRun },
    sessionSummary: "", // Summary provided by agent via MCP, not CLI
    sessionFiles: [],   // Session files read by MCP server, not CLI
    experienceFiles,
    previousSkillCounts,
    chunkStore: noopChunkStore,
    knowledgeStore: noopKnowledgeStore,
    vaultExperiencesPath: experiencesPath,
    readVaultFile: (p: string) => { try { return readFileSync(p, "utf-8"); } catch { return null; } },
    writeVaultFile: (p: string, c: string) => { if (!dryRun) writeFileSync(p, c, "utf-8"); },
  });

  console.log(`\nChunks: ${result.chunks.sessionsIndexed} sessions, ${result.chunks.chunksCreated} chunks`);
  console.log(`Feedback: ${result.feedback.processed} entries rated`);
  console.log(`Frontmatter: ${result.frontmatter.filesUpdated} files updated`);
  console.log(`Skills: ${result.skills.clusters.length} clusters, ${result.skills.pendingProposals} proposals, ${result.skills.approaching} approaching`);

  if (result.chunks.errors.length > 0) {
    console.log(`\nChunk errors: ${result.chunks.errors.join(", ")}`);
  }
  if (result.feedback.errors.length > 0) {
    console.log(`Feedback errors: ${result.feedback.errors.join(", ")}`);
  }
  if (result.frontmatter.errors.length > 0) {
    console.log(`Frontmatter errors: ${result.frontmatter.errors.join(", ")}`);
  }
} else if (command === "dream") {
  const { runDream } = await import("./pipelines/dream/index.js");
  const { formatReport } = await import("./pipelines/dream/report.js");
  const { openV2Database } = await import("./db-v2.js");
  const { existsSync } = await import("node:fs");

  const asJson = args.includes("--json");

  // `--dry-run` is the default rather than an option, so an overnight run that
  // forgets a flag reports instead of mutating. `--apply` is the only way to
  // reach a write path, and there is none yet — say so plainly rather than
  // exiting 0 and letting the caller believe changes landed.
  if (args.includes("--apply")) {
    console.error(
      "dream --apply: nothing to apply. The deterministic pass proposes only;\n" +
      "adjudication and application belong to the model leg, which is not built.\n" +
      "Run without --apply to see the report."
    );
    process.exit(1);
  }

  // 7 days, not the reference implementation's 24h. Measured session counts on
  // this corpus: 24h -> 2, 72h -> 2, 7d -> 17. A window that collapses onto a
  // single day cannot show the cross-session patterns dreaming exists to find.
  const sinceArg = args.find((a) => a.startsWith("--since="));
  const days = sinceArg ? Number(sinceArg.slice("--since=".length)) : 7;
  if (!Number.isFinite(days) || days <= 0) {
    console.error(`Invalid --since: expected a positive number of days, got "${sinceArg}".`);
    process.exit(1);
  }

  const paths = resolvePaths(resolve("."));
  if (!existsSync(paths.knowledgeV2Db)) {
    console.error(`Knowledge database not found at ${paths.knowledgeV2Db} — nothing to reconcile.`);
    process.exit(1);
  }

  const now = new Date();
  const since = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);

  const db = openV2Database(paths.knowledgeV2Db);
  let result;
  try {
    result = runDream({ db, now, since, maxPerKind: 20 });
  } finally {
    db.close();
  }

  if (asJson) {
    console.log(JSON.stringify(result, null, 2));
  } else {
    const { report, kindCensus } = result;
    console.log(`\nDream — ${report.entriesExamined} live entries, ${report.sessionsExamined.length} sessions since ${since.toISOString().slice(0, 10)}\n`);

    // Printed before the candidates because it is what says whether to trust
    // them: a classifier calling nothing `state` yields no state-pair proposals,
    // and a report of zero would otherwise read as a clean corpus.
    console.log(
      `Fact kinds: ${kindCensus.state} state, ${kindCensus.event} event, ` +
      `${kindCensus.unclassified} unclassified (${kindCensus.recorded} recorded, rest inferred)\n`
    );

    console.log(report.candidates.length === 0 ? "No candidates." : formatReport(report));
    console.log(`\nRead-only. Nothing was written.`);
  }
} else {
  console.log("Usage: open-brain <command> [options]");
  console.log("");
  console.log("Commands:");
  console.log("  sync [--check] [--score [--json]] [--history]");
  console.log("  start                                     Start a session");
  console.log("  end [--dry-run]                            End a session");
  console.log("  dream [--since=<days>] [--json]            Reconcile stored memory (read-only)");
  process.exit(1);
}
