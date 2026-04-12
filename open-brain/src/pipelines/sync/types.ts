export type CheckSeverity = "pass" | "warn" | "issue" | "fixed";

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
  checks: CheckResult[];
  fixed: CheckResult[];
  issues: CheckResult[];
  warnings: CheckResult[];
  passed: CheckResult[];
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
