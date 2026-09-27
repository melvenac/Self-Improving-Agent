import type { CategoryScore } from "./types.js";

/**
 * One category line of `open-brain sync --score`.
 *
 * Pipeline Health names the invocation-log state it scored, unless that state
 * is `ran`. A missing, empty, corrupt, or unreadable log otherwise prints as
 * the same `0/10`.
 */
export function formatScoreCategoryLine(cat: CategoryScore): string {
  const bar = "█".repeat(Math.round((cat.score / cat.max) * 20)).padEnd(20, "░");
  return `  ${bar} ${cat.name}: ${cat.score}/${cat.max}`;
}
