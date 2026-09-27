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

/** A summary that was not extracted, with the reason on the session-end line. */
export interface SessionSummarySkipped {
  skipped: string;
}

function errorText(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

// Event types that carry useful content for a session summary
const SUMMARY_EVENT_TYPES = ["user_prompt", "intent", "decision", "skill", "mcp", "error_tool"];

// ─── Core ───────────────────────────────────────────────────────────────────

/**
 * Find the most recent session .db file, optionally matching a session ID.
 */
function findSessionDb(
  sessionsDir: string,
  targetSessionId?: string,
): string | SessionSummarySkipped | null {
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
    const unreadable: string[] = [];
    for (const file of dbFiles) {
      let db: Database.Database | null = null;
      try {
        db = new Database(file.path, { readonly: true });
        const meta = db.prepare("SELECT session_id FROM session_meta LIMIT 1").get() as
          | { session_id: string }
          | undefined;
        if (meta?.session_id === targetSessionId) return file.path;
      } catch (err) {
        // An open that throws is not "no db has this session" (SILENT 14).
        unreadable.push(errorText(err));
      } finally {
        db?.close();
      }
    }
    if (unreadable.length > 0) {
      return { skipped: `unreadable while finding session db: ${unreadable.join("; ")}` };
    }
    return { skipped: "no db holds this session" };
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
): SessionSummaryResult | SessionSummarySkipped | null {
  if (!existsSync(sessionDbPath)) return null;

  let db: Database.Database;
  try {
    db = new Database(sessionDbPath, { readonly: true });
  } catch (err) {
    return { skipped: `summary db unreadable: ${errorText(err)}` };
  }

  try {
    // Verify table exists
    const hasEvents = db
      .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='session_events'")
      .get();
    if (!hasEvents) return { skipped: "no session_events" };

    const meta = db.prepare("SELECT * FROM session_meta LIMIT 1").get() as SessionMeta | undefined;
    if (!meta) return { skipped: "no session_meta" };

    const placeholders = SUMMARY_EVENT_TYPES.map(() => "?").join(", ");
    const events = db
      .prepare(
        `SELECT id, type, data, created_at FROM session_events
         WHERE type IN (${placeholders}) AND data IS NOT NULL AND data != ''
         ORDER BY id`
      )
      .all(...SUMMARY_EVENT_TYPES) as SessionEvent[];

    if (events.length === 0) return { skipped: "no events" };

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
  } catch (err) {
    // better-sqlite3 reports a garbage file on the first statement, not the
    // constructor. That throw used to escape session end (SILENT 15).
    return { skipped: `summary db unreadable: ${errorText(err)}` };
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
export function getSessionSummary(
  sessionId?: string,
  sessionsDir: string = join(homedir(), ".claude", "context-mode", "sessions"),
): SessionSummaryResult | SessionSummarySkipped | null {
  const found = findSessionDb(sessionsDir, sessionId);
  if (found && typeof found === "object") return found;
  if (!found) return { skipped: sessionId ? "no db holds this session" : "no session db" };
  const summary = extractSessionSummary(found);
  if (summary && "skipped" in summary) return null;
  return summary;
}
