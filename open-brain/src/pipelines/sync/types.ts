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
}

export interface SyncOptions {
  projectRoot: string;
  checkOnly: boolean;
  score: boolean;
  scoreJson: boolean;
  history: boolean;
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
