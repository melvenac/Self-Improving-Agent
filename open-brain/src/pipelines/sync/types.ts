/**
 * "skip" is a check that could not run for a stated reason and says so. It is
 * printed and counted, never folded into "pass": a skipped check that looks
 * like a pass is the silent-zero shape this repo keeps finding.
 */
export type CheckSeverity = "pass" | "warn" | "issue" | "fixed" | "skip";

export interface CheckResult {
  name: string;
  severity: CheckSeverity;
  message: string;
  autoFixed?: boolean;
  /**
   * Printed whatever the severity (Loop 4 R4/R7): the number in the message
   * — a CI conclusion, a marker count — is the point, and a pass that is not
   * shown is indistinguishable from a check that never ran.
   */
  report?: boolean;
}

/**
 * Which process is running the checks.
 *
 * Loop 10 R1. This exists for `state-schema`, which parses the live
 * `.agents/state.json` with **the calling process's own loaded schema**. The same
 * code passing in one runtime and failing in the other is the entire signal: an
 * MCP server holds its schema for the life of the process, so a loop that changes
 * the schema leaves a running server unable to read the file it must write — and
 * `/sync` from the CLI is a different process that cannot see the server's loaded
 * code at all. A check that does not say which runtime produced it cannot
 * distinguish those two cases.
 */
export type SyncRuntime = "cli" | "mcp-server";

export interface SyncOptions {
  projectRoot: string;
  checkOnly: boolean;
  score: boolean;
  scoreJson: boolean;
  history: boolean;
  /** Defaults to "cli". `ob_sync` passes "mcp-server". */
  runtime?: SyncRuntime;
}

export interface SyncResult {
  version: string;
  /** The root actually checked, after walking up from the given directory (R4). */
  projectRoot: string;
  checks: CheckResult[];
  fixed: CheckResult[];
  issues: CheckResult[];
  warnings: CheckResult[];
  passed: CheckResult[];
  skipped: CheckResult[];
}

export interface CategoryScore {
  name: string;
  score: number;
  max: number;
  details: Record<string, number>;
}

export interface ScoreResult {
  total: number;
  categories: CategoryScore[];
  date: string;
}

export interface ScoreHistoryEntry {
  total: number;
  categories: Record<string, number>;
  date: string;
}
