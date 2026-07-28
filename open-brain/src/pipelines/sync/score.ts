import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";
import type Database from "better-sqlite3";

import {
  scoreConfigStructure,
  scoreKnowledgeQuality,
  scoreStaleness,
  scoreCoverage,
  scorePipelineHealth,
} from "./scorer.js";
import { readHistory, calculateTrend } from "./history.js";
import type { CheckResult, CategoryScore, ScoreResult } from "./types.js";
import {
  getKnowledgeQualityStats,
  getStalenessStats,
  getCoverageStats as getCoverageStatsV2,
} from "../../db-v2.js";
import { readLastInvocationTs } from "../session-end/invocation-logger.js";
import { readShadowLog } from "../shadow/index.js";
import { resolvePaths } from "../../shared/paths.js";

/**
 * Compute the 0-100 protocol health score.
 *
 * This lives outside server.ts so the MCP server and the CLI share one
 * implementation. They previously had separate scoring paths reading different
 * databases — the CLI scored against the retired v1 knowledge.db while the
 * server scored against v2 — and reported different totals for the same repo.
 *
 * The caller supplies the open v2 database so this stays testable and does not
 * own connection lifetime.
 */
export function computeScore(
  projectRoot: string,
  checks: CheckResult[],
  v2db: Database.Database,
): ScoreResult {
  const paths = resolvePaths(projectRoot);
  const configScore = scoreConfigStructure(checks);

  // Domain tags scope the coverage score to this project's subject areas.
  const domainsPath = join(projectRoot, ".agents", "SYSTEM", "domains.json");
  let domainTags: string[] = [];
  if (existsSync(domainsPath)) {
    try {
      const domains = JSON.parse(readFileSync(domainsPath, "utf-8"));
      domainTags = domains.domains ?? domains.tags ?? [];
    } catch { /* malformed domains.json should not break scoring */ }
  }

  // Skill proposal counts come from the vault, not the DB.
  const vaultPath = join(homedir(), "Obsidian Vault");
  let skillsImplemented = 0;
  let proposalClusters = 0;
  const candidatesPath = join(vaultPath, "Skill-Candidates", "SKILL-CANDIDATES.md");
  const skillIndexPath = join(vaultPath, "Skill-Candidates", "SKILL-INDEX.md");
  if (existsSync(candidatesPath)) {
    const content = readFileSync(candidatesPath, "utf-8");
    proposalClusters = (content.match(/### \S+ \(\d+ experiences?\)/g) || []).length;
  }
  if (existsSync(skillIndexPath)) {
    const content = readFileSync(skillIndexPath, "utf-8");
    skillsImplemented = (content.match(/has skill/g) || []).length;
  }

  const qualityScore = scoreKnowledgeQuality(getKnowledgeQualityStats(v2db));
  const stalenessScore = scoreStaleness(getStalenessStats(v2db));

  const coverageRaw = getCoverageStatsV2(v2db, domainTags);
  coverageRaw.skillsImplemented = skillsImplemented;
  coverageRaw.proposalClusters = proposalClusters;
  const coverageScore = scoreCoverage(coverageRaw);

  const trend = calculateTrend(readHistory(paths.scoreHistory));
  const healthScore = scorePipelineHealth({
    lastHookRun: readLastInvocationTs(),
    scoreTrend: trend,
    shadowSessions: readShadowLog(paths.shadowLog).length,
  });

  const categories: CategoryScore[] = [
    configScore, qualityScore, stalenessScore, coverageScore, healthScore,
  ];

  return {
    total: categories.reduce((sum, c) => sum + c.score, 0),
    categories,
    date: new Date().toISOString().split("T")[0],
  };
}
