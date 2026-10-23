import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { checkoutOf } from "../../shared/state-schema.js";

/**
 * T-236: the per-repo greeting opt-ins, ONE reader for ONE file (planner ruling, session 160).
 *
 * Every T-236 behaviour is OPT-IN PER REPO, DEFAULT OFF: A2A shares this renderer, and a default
 * that changed A2A's /start would be a ruling, not a side effect (Relay's amendment). An absent
 * file, an unreadable or malformed file, a non-boolean value and an absent key all mean false,
 * which is today's output.
 *
 * Keys: brief_dir (string), record_branch (string, T-298), briefing_budget, briefing_focus, briefing_problem, greeting_metrics, handoff_by_checkout, handoff_caps, maybe_shipped, merged_citations, missing_handoff, reads_owed_own, role_docs_by_sha, state_compact. Keep them sorted in the tracked file.
 */
export const GREETING_FLAGS_REL = ".agents/SYSTEM/greeting.json";

export function readGreetingFlags(projectRoot: string): Readonly<Record<string, boolean>> {
  const abs = join(projectRoot, GREETING_FLAGS_REL);
  if (!existsSync(abs)) return {};
  let data: unknown;
  try {
    data = JSON.parse(readFileSync(abs, "utf8"));
  } catch {
    return {};
  }
  if (typeof data !== "object" || data === null || Array.isArray(data)) return {};
  const flags: Record<string, boolean> = {};
  for (const [k, v] of Object.entries(data)) if (typeof v === "boolean") flags[k] = v;
  return flags;
}

/**
 * T-298: one STRING key from the same file (`brief_dir`). An absent file or key, a malformed file and a non-string value are
 * all null. Validation of the value belongs to the caller, which says what was wrong.
 */
export function greetingString(projectRoot: string, key: string): string | null {
  const abs = join(projectRoot, GREETING_FLAGS_REL);
  if (!existsSync(abs)) return null;
  try {
    const data: unknown = JSON.parse(readFileSync(abs, "utf8"));
    if (typeof data !== "object" || data === null || Array.isArray(data)) return null;
    const v = (data as Record<string, unknown>)[key];
    return typeof v === "string" ? v : null;
  } catch {
    return null;
  }
}

export function greetingFlag(projectRoot: string, key: string): boolean {
  return readGreetingFlags(projectRoot)[key] === true;
}

/**
 * T-239: the checkout whose handoff is this reader's own, or undefined when `handoff_by_checkout` is off (the default), which
 * keeps the role-wide pick-up A2A prints. The value is `checkoutOf`, the derivation the writer stamps handoffs with.
 */
export function handoffCheckout(projectRoot: string): string | undefined {
  return greetingFlag(projectRoot, "handoff_by_checkout") ? checkoutOf(projectRoot) : undefined;
}
