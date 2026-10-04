import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * T-236: the per-repo greeting opt-ins, ONE reader for ONE file (planner ruling, session 160).
 *
 * Every T-236 behaviour is OPT-IN PER REPO, DEFAULT OFF: A2A shares this renderer, and a default
 * that changed A2A's /start would be a ruling, not a side effect (Relay's amendment). An absent
 * file, an unreadable or malformed file, a non-boolean value and an absent key all mean false,
 * which is today's output.
 *
 * Keys: briefing_budget, handoff_caps, missing_handoff, role_docs_by_sha. Keep them sorted in the tracked file.
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

export function greetingFlag(projectRoot: string, key: string): boolean {
  return readGreetingFlags(projectRoot)[key] === true;
}
