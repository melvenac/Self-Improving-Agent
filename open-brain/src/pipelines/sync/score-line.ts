import type { CategoryScore } from "./types.js";

/**
 * One category line of `open-brain sync --score`.
 *
 * Pipeline Health names the invocation-log state it scored, unless that state
 * is `ran`. A missing, empty, corrupt, or unreadable log otherwise prints as
 * the same `0/10`.
 */
/** The parenthetical r2b prints, and the two server.ts score renderers print. Empty when the log ran. */
export function invocationLogSuffix(cat: CategoryScore): string {
  const log = cat.details.invocationLog;
  return cat.name === "Pipeline Health" && typeof log === "string" && log !== "ran"
    ? ` (invocation log: ${log})`
    : "";
}

export function formatScoreCategoryLine(cat: CategoryScore): string {
  const bar = "█".repeat(Math.round((cat.score / cat.max) * 20)).padEnd(20, "░");
  return `  ${bar} ${cat.name}: ${cat.score}/${cat.max}${invocationLogSuffix(cat)}`;
}
