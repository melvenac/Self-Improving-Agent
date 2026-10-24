import type Database from "better-sqlite3";
import { readAgentIdentity } from "../pipelines/session-start/agent-identity.js";

/**
 * T-313: the seat a stored entry was written for, lowercased, or null when it names none. A `<seat>-ops` tag names it,
 * and so does a path into `.claude/skills/<seat>-ops`; the tag wins. A hyphenated skill (`mail-server-ops`) names no
 * seat, so its entries fire for everyone.
 */
export function entrySeat(content: string, tags: string): string | null {
  for (const tag of tags.split(",")) {
    const m = /^([a-z0-9]+)-ops$/i.exec(tag.trim());
    if (m) return m[1].toLowerCase();
  }
  const path = /\.claude[\\/]+skills[\\/]+([a-z0-9]+)-ops(?![\w-])/i.exec(content);
  return path ? path[1].toLowerCase() : null;
}

/**
 * T-313: the session's seat, lowercased, or null. The checkout the hook runs in answers first (its AGENT.local.md or
 * AGENT.md name). A checkout with no identity falls back to the project the session registered with ob_set_session:
 * clark's sessions start in ~/Worktrees, which has no identity, and register projects/fleet, which names Clark.
 * Never throws: an unreadable file or a missing table is null, and null fires every entry, as before T-313.
 */
export function resolveTriggerSeat(db: Database.Database, sessionUuid: string, cwd: string | null): string | null {
  try {
    const here = cwd ? readAgentIdentity(cwd) : null;
    if (here) return here.name.toLowerCase();
    const row = db.prepare(`SELECT project_dir FROM sessions WHERE uuid = ?`).get(sessionUuid) as
      | { project_dir: string | null }
      | undefined;
    const there = row?.project_dir ? readAgentIdentity(row.project_dir) : null;
    return there ? there.name.toLowerCase() : null;
  } catch {
    return null;
  }
}
