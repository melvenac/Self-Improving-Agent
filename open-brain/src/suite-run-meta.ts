/**
 * T-168 suite meta. Counts and the process exit code are separate so a
 * G-042 unhandled vitest error (exit 1, zero failed tests) stays visible.
 */

import type { CensusResult } from "./suite-census.js";
import type { OwnerSource } from "./suite-owner.js";

export interface VitestCounts {
  passed: number;
  failed: number;
  errors: number;
}

export interface SuiteMeta {
  git_sha: string;
  seat: string;
  lease_status: string;
  owner_pid: number | null;
  owner_source: OwnerSource;
  owner_reason: string | null;
  lease_take_exit: number | null;
  lease_release_exit: number | null;
  census: {
    source: CensusResult["source"] | "ci";
    timestamp: string;
    available: boolean;
    reason: string | null;
    agents: CensusResult["agents"];
    busy_sia: string[];
    samples: number;
  };
  vitest: {
    passed: number | null;
    failed: number | null;
    errors: number | null;
    exit_code: number | null;
  };
  ci?: {
    runner_name: string;
    runner_labels: string[];
    timestamp: string;
    concurrent_jobs: string;
  };
}

export function sidecarStillLive(writtenAtIso: string, ttlMs: number, nowMs: number): boolean {
  const t = Date.parse(writtenAtIso);
  if (Number.isNaN(t)) return false;
  return nowMs - t <= ttlMs;
}

export function leaseStatusFromExit(exitCode: number | null): string {
  if (exitCode === null) return "skipped";
  if (exitCode === 0) return "taken";
  if (exitCode === 10) return "held";
  if (exitCode === 11) return "malformed";
  return `exit_${exitCode}`;
}

/** Vitest JSON reporter (v3): numPassedTests, numFailedTests. Unhandled errors are not a count; exit_code carries them. */
export function vitestCountsFromJson(body: unknown): VitestCounts {
  if (body === null || typeof body !== "object") return { passed: 0, failed: 0, errors: 0 };
  const row = body as {
    numPassedTests?: unknown;
    numFailedTests?: unknown;
    unhandledErrors?: unknown;
  };
  const n = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : 0);
  // unhandledErrors is not a vitest JSON field. G-042 is the process exit_code
  // beside these counts. errors stays 0 unless a caller supplies the number.
  return { passed: n(row.numPassedTests), failed: n(row.numFailedTests), errors: n(row.unhandledErrors) };
}

export function buildSuiteMeta(input: {
  gitSha: string;
  seat: string;
  leaseExit: number | null;
  census: CensusResult;
  vitest: { counts: VitestCounts | null; exitCode: number | null };
  ownerPid?: number | null;
  ownerSource?: OwnerSource;
  ownerReason?: string | null;
  leaseStatus?: string;
  leaseTakeExit?: number | null;
  leaseReleaseExit?: number | null;
}): SuiteMeta {
  return {
    git_sha: input.gitSha,
    seat: input.seat,
    lease_status: input.leaseStatus ?? leaseStatusFromExit(input.leaseExit),
    owner_pid: input.ownerPid ?? null,
    owner_source: input.ownerSource ?? "none",
    owner_reason: input.ownerReason ?? null,
    lease_take_exit: input.leaseTakeExit === undefined ? input.leaseExit : input.leaseTakeExit,
    lease_release_exit: input.leaseReleaseExit ?? null,
    census: {
      source: input.census.source,
      timestamp: input.census.timestamp,
      available: input.census.available,
      reason: input.census.reason,
      agents: input.census.agents,
      busy_sia: input.census.busySia,
      samples: input.census.samples,
    },
    vitest: {
      passed: input.vitest.counts?.passed ?? null,
      failed: input.vitest.counts?.failed ?? null,
      errors: input.vitest.counts?.errors ?? null,
      exit_code: input.vitest.exitCode,
    },
  };
}

export function buildCiSuiteMeta(input: {
  gitSha: string;
  runnerName: string;
  runnerLabels: string[];
  timestamp: string;
  concurrentJobs: string;
}): SuiteMeta {
  return {
    git_sha: input.gitSha,
    seat: "ci",
    lease_status: "skipped",
    owner_pid: null,
    owner_source: "none",
    owner_reason: null,
    lease_take_exit: null,
    lease_release_exit: null,
    census: {
      source: "ci",
      timestamp: input.timestamp,
      available: false,
      reason: "census unavailable: CI runner has no hub census",
      agents: [],
      busy_sia: [],
      samples: 0,
    },
    vitest: { passed: null, failed: null, errors: null, exit_code: null },
    ci: {
      runner_name: input.runnerName,
      runner_labels: input.runnerLabels,
      timestamp: input.timestamp,
      concurrent_jobs: input.concurrentJobs,
    },
  };
}
