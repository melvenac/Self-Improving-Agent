/**
 * T-193 red commit. This check does not classify worktrees: every root
 * passes. The final rows in worktree-layout.test.ts run against that.
 */
import type { CheckResult } from "./types.js";

export const WORKTREE_SEATS_REL = ".agents/SYSTEM/worktree-seats.json";

export function checkWorktreeLayout(_projectRoot: string): CheckResult {
  return {
    name: "worktree-layout",
    severity: "pass",
    message: "worktree-layout does not classify worktrees",
    report: true,
  };
}
