import { readFileSync, unlinkSync, existsSync } from "node:fs";

export interface OutwardGrant {
  command: string;
  expires_at?: string;
}

export function grantPath(repoRoot: string): string {
  return `${repoRoot}/open-brain/.planner-outward-grant`;
}

export function readOutwardGrant(repoRoot: string): OutwardGrant | null {
  const path = grantPath(repoRoot);
  if (!existsSync(path)) return null;
  let raw: string;
  try {
    raw = readFileSync(path, "utf-8").trim();
  } catch {
    return null;
  }
  if (!raw) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!parsed || typeof parsed !== "object") return null;
  const command = (parsed as Record<string, unknown>).command;
  if (typeof command !== "string" || !command.trim()) return null;
  const expires_at = (parsed as Record<string, unknown>).expires_at;
  const grant: OutwardGrant = { command: command.trim() };
  if (typeof expires_at === "string" && expires_at.trim()) grant.expires_at = expires_at.trim();
  if (grant.expires_at) {
    const t = Date.parse(grant.expires_at);
    if (!Number.isFinite(t) || t < Date.now()) return null;
  }
  return grant;
}

export function consumeOutwardGrant(repoRoot: string): void {
  const path = grantPath(repoRoot);
  try {
    if (existsSync(path)) unlinkSync(path);
  } catch {
    /* best-effort consumption */
  }
}

const squash = (s: string): string => s.trim().replace(/\s+/g, " ");

/**
 * Grant matches only the exact command, whitespace-normalised (T-194 r4). A grant for
 * `gh pr merge 5` covers no `--repo other/x` and no `&& git push ...`; a grant for
 * `git push origin loop/x` covers no `--force`.
 */
export function grantMatchesCommand(grant: OutwardGrant, command: string): boolean {
  if (grant.command === "*") return true;
  return squash(command) === squash(grant.command);
}
