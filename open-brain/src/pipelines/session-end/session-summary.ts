import Database from "better-sqlite3";
import { existsSync, readdirSync, statSync } from "fs";
import { join } from "path";
import { homedir } from "os";

// ─── Types ──────────────────────────────────────────────────────────────────

interface SessionMeta {
  session_id: string;
  project_dir: string;
  started_at: string;
  last_event_at: string;
  event_count: number;
}

interface SessionEvent {
  id: number;
  type: string;
  data: string;
  created_at: string;
}

export interface SessionSummaryResult {
  sessionId: string;
  project: string;
  summary: string;
  eventCount: number;
}

// Event types that carry useful content for a session summary
const SUMMARY_EVENT_TYPES = ["user_prompt", "intent", "decision", "skill", "mcp", "error_tool"];

// ─── Core ───────────────────────────────────────────────────────────────────

/**
 * Find the most recent session .db file, optionally matching a session ID.
 */
function findSessionDb(sessionsDir: string, targetSessionId?: string): string | null {
  if (!existsSync(sessionsDir)) return null;

  const dbFiles = readdirSync(sessionsDir)
    .filter((f) => f.endsWith(".db"))
    .map((f) => ({
      name: f,
      path: join(sessionsDir, f),
      mtime: statSync(join(sessionsDir, f)).mtimeMs,
    }))
    .sort((a, b) => b.mtime - a.mtime); // newest first

  if (dbFiles.length === 0) return null;

  if (targetSessionId) {
    for (const file of dbFiles) {
      try {
        const db = new Database(file.path, { readonly: true });
        const meta = db.prepare("SELECT session_id FROM session_meta LIMIT 1").get() as
          | { session_id: string }
          | undefined;
        db.close();
        if (meta?.session_id === targetSessionId) return file.path;
      } catch {
        continue;
      }
    }
    return null;
  }

  // No target — return most recent
  return dbFiles[0].path;
}

/**
 * Extract a text summary from a session .db file.
 * Concatenates user prompts, intents, decisions, and other high-signal events
 * into a summary string suitable for tag matching and vault writing.
 */
export function extractSessionSummary(
  sessionDbPath: string,
  maxLength: number = 4000
): SessionSummaryResult | null {
  if (!existsSync(sessionDbPath)) return null;

  let db: Database.Database;
  try {
    db = new Database(sessionDbPath, { readonly: true });
  } catch {
    return null;
  }

  try {
    // Verify table exists
    const hasEvents = db
      .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='session_events'")
      .get();
    if (!hasEvents) return null;

    const meta = db.prepare("SELECT * FROM session_meta LIMIT 1").get() as SessionMeta | undefined;
    if (!meta) return null;

    const placeholders = SUMMARY_EVENT_TYPES.map(() => "?").join(", ");
    const events = db
      .prepare(
        `SELECT id, type, data, created_at FROM session_events
         WHERE type IN (${placeholders}) AND data IS NOT NULL AND data != ''
         ORDER BY id`
      )
      .all(...SUMMARY_EVENT_TYPES) as SessionEvent[];

    if (events.length === 0) return null;

    // Build summary: label each event type for readability
    const parts: string[] = [];
    let totalLength = 0;

    for (const event of events) {
      const prefix = formatEventPrefix(event.type);
      const text = `${prefix}: ${event.data.trim()}`;

      if (totalLength + text.length > maxLength) {
        // Truncate last entry to fit
        const remaining = maxLength - totalLength;
        if (remaining > 50) {
          parts.push(text.slice(0, remaining) + "...");
        }
        break;
      }

      parts.push(text);
      totalLength += text.length + 1; // +1 for newline
    }

    const summary = parts.join("\n");

    return {
      sessionId: meta.session_id,
      project: meta.project_dir?.split(/[/\\]/).filter(Boolean).pop() || "General",
      summary,
      eventCount: meta.event_count,
    };
  } finally {
    db.close();
  }
}

function formatEventPrefix(type: string): string {
  switch (type) {
    case "user_prompt":
      return "User";
    case "intent":
      return "Intent";
    case "decision":
      return "Decision";
    case "skill":
      return "Skill";
    case "mcp":
      return "MCP";
    case "error_tool":
      return "Error";
    default:
      return type;
  }
}

/**
 * Get the session summary for a given session ID (or the most recent session).
 * This is the main entry point — reads from ~/.claude/context-mode/sessions/.
 */
export function getSessionSummary(sessionId?: string): SessionSummaryResult | null {
  const sessionsDir = join(homedir(), ".claude", "context-mode", "sessions");
  const dbPath = findSessionDb(sessionsDir, sessionId);
  if (!dbPath) return null;
  return extractSessionSummary(dbPath);
}
