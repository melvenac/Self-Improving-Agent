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
    const configScore = scoreConfigStructure(result.checks);

    // DB-dependent categories use placeholder inputs when DB is unavailable
    // These will be wired to real DB queries when the db module is built
    const qualityScore = scoreKnowledgeQuality({
      helpful: 0, harmful: 0, neutral: 0,
      totalEntries: 0, ratedEntries: 0, duplicateClusters: 0,
    });
    const stalenessScore = scoreStaleness({
      staleRatio: 0, lowSuccessCount: 0,
      summarizedSessions: 0, eligibleSessions: 0,
    });
    const coverageScore = scoreCoverage({
      domainsWithEntries: 0, totalDomains: 0,
      matureCount: 0, provenCount: 0, totalEntries: 0,
      skillsImplemented: 0, proposalClusters: 0,
    });

    const historyEntries = readHistory(paths.scoreHistory);
    const trend = calculateTrend(historyEntries);
    const healthScore = scorePipelineHealth({
      lastHookRun: null, scoreTrend: trend, lastShadowRecall: null,
    });

    const categories: CategoryScore[] = [
      configScore, qualityScore, stalenessScore, coverageScore, healthScore,
    ];
    const total = categories.reduce((sum, c) => sum + c.score, 0);

    const scoreResult: ScoreResult = {
      total,
      categories,
      date: new Date().toISOString().split("T")[0],
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
} else {
  console.log("Usage: open-brain <command> [options]");
  console.log("");
  console.log("Commands:");
  console.log("  sync [--check] [--score [--json]] [--history]");
  process.exit(1);
}
