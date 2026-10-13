import { existsSync } from "node:fs";
import { join } from "node:path";

/**
 * Resolve a project document across the locations the framework supports.
 * `.agents/SYSTEM/` is the convention (matching checkSummary); `docs/` and the
 * repo root are legacy fallbacks so older layouts keep working.
 */
export function resolveDocPath(projectRoot: string, filename: string): string | null {
  const candidates = [
    join(projectRoot, ".agents", "SYSTEM", filename),
    join(projectRoot, "docs", filename),
    join(projectRoot, filename),
  ];
  return candidates.find((p) => existsSync(p)) ?? null;
}
