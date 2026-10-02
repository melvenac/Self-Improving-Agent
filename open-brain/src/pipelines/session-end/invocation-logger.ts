import Database from "better-sqlite3";
import { existsSync, readdirSync, readFileSync, appendFileSync } from "fs";
import { join, basename } from "path";
import { homedir } from "os";

// ─── Types ──────────────────────────────────────────────────────────────────

interface SessionMeta {
  session_id: string;
  project_dir: string;
}

interface InvocationEvent {
  type: string;
  data: string;
  created_at: string;
}

export interface InvocationEntry {
  ts: string;
  type: "skill" | "mcp" | "command";
  name: string;
  session: string;
  project: string;
}

export interface InvocationLogResult {
  logged: number;
  /** Sessions already in the log (deduplicated): a benign skip, counted on its own. */
  skippedSessions: number;
  /** T-048: session dbs that could not be opened or read. */
  unreadableSessions: number;
  /** T-048: events read whose append to the log failed. */
  appendFailures: number;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80);
}

function projectFromDir(dir: string | null): string {
  if (!dir) return "unknown";
  return slugify(basename(dir));
}

// ─── Core ───────────────────────────────────────────────────────────────────

const INVOCATION_LOG_PATH = join(homedir(), ".claude", "open-brain", "skill-invocations.jsonl");

/** A present log that is not a list of timestamps, or that cannot be read.
 *  The return is that word. Null is not a return value; a missing file is null
 *  from the caller. */
function unusableLog(kind: "corrupt" | "unreadable", detail?: string): string {
  return detail ? `${kind}: ${detail}` : kind;
}

/**
 * Timestamp of the most recent logged invocation.
 * Returns null when the file is missing. An empty file returns "empty".
 * A file that cannot be read returns an unreadable string. A file with no
 * usable timestamp returns "corrupt".
 *
 * Scans all entries rather than trusting the last line: entries are appended per
 * session and backfill can write older sessions after newer ones.
 */
export function readLastInvocationTs(logPath: string = INVOCATION_LOG_PATH): string | null {
  if (!existsSync(logPath)) return null;
  try {
    const raw = readFileSync(logPath, "utf8");
    if (raw.trim() === "") return "empty";
    const lines = raw.split("\n").filter(Boolean);
    let newest: number | null = null;
    let newestRaw: string | null = null;
    for (const line of lines) {
      try {
        const ts = (JSON.parse(line) as Partial<InvocationEntry>).ts;
        if (!ts) continue;
        const parsed = new Date(ts).getTime();
        if (Number.isNaN(parsed)) continue;
        if (newest === null || parsed > newest) {
          newest = parsed;
          newestRaw = ts;
        }
      } catch {
        // Skip malformed lines rather than failing the whole score.
      }
    }
    return newestRaw ?? unusableLog("corrupt");
  } catch (err) {
    return unusableLog("unreadable", err instanceof Error ? err.message : String(err));
  }
}
const SESSIONS_DB_DIR = join(homedir(), ".claude", "context-mode", "sessions");

/**
 * Extract skill/mcp/command invocations from session .db files and append to JSONL log.
 * Skips sessions already logged (deduplication by session_id).
 */
export function logInvocations(sessionsDbDir: string = SESSIONS_DB_DIR, logPath: string = INVOCATION_LOG_PATH): InvocationLogResult {
  if (!existsSync(sessionsDbDir)) {
    return { logged: 0, skippedSessions: 0, unreadableSessions: 0, appendFailures: 0 };
  }

  // Read already-logged session IDs
  const loggedSessions = new Set<string>();
  if (existsSync(logPath)) {
    try {
      const lines = readFileSync(logPath, "utf8").split("\n").filter(Boolean);
      for (const line of lines) {
        try {
          const entry = JSON.parse(line) as { session?: string };
          if (entry.session) loggedSessions.add(entry.session);
        } catch { /* skip malformed lines */ }
      }
    } catch { /* file read error — proceed without dedup */ }
  }

  const dbFiles = readdirSync(sessionsDbDir).filter((f) => f.endsWith(".db"));
  let totalLogged = 0;
  let skippedSessions = 0;
  let unreadableSessions = 0;
  let appendFailures = 0;

  for (const file of dbFiles) {
    const filePath = join(sessionsDbDir, file);
    let sessionDb: Database.Database | null = null;
    try {
      sessionDb = new Database(filePath, { readonly: true });

      const hasEvents = sessionDb
        .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='session_events'")
        .get();
      if (!hasEvents) { sessionDb.close(); continue; }

      const meta = sessionDb
        .prepare("SELECT session_id, project_dir FROM session_meta LIMIT 1")
        .get() as SessionMeta | undefined;

      if (!meta || loggedSessions.has(meta.session_id)) {
        sessionDb.close();
        if (meta) skippedSessions++;
        continue;
      }

      const invocations = sessionDb
        .prepare(
          "SELECT type, data, created_at FROM session_events WHERE type IN ('skill', 'mcp') OR (type = 'user_prompt' AND data LIKE '/%') ORDER BY id"
        )
        .all() as InvocationEvent[];
      sessionDb.close();

      const project = projectFromDir(meta.project_dir);
      const seenCommands = new Set<string>();

      for (const inv of invocations) {
        const rawData = (inv.data || "").trim();
        if (!rawData) continue;

        let invType: "skill" | "mcp" | "command";
        let name: string;

        if (inv.type === "skill") {
          invType = "skill";
          name = rawData;
          seenCommands.add(name);
        } else if (inv.type === "mcp") {
          invType = "mcp";
          name = rawData.split(":")[0].trim();
        } else if (inv.type === "user_prompt" && rawData.startsWith("/")) {
          const cmdMatch = rawData.match(/^\/(\S+)/);
          if (!cmdMatch) continue;
          name = cmdMatch[1];
          if (seenCommands.has(name)) continue;
          invType = "command";
        } else {
          continue;
        }

        const entry: InvocationEntry = {
          ts: inv.created_at,
          type: invType,
          name,
          session: meta.session_id,
          project,
        };

        try {
          appendFileSync(logPath, JSON.stringify(entry) + "\n");
          totalLogged++;
        } catch { appendFailures++; }
      }
    } catch {
      unreadableSessions++;
      // A db that opened but could not be read must not stay open: on Windows it locks the file.
      try { sessionDb?.close(); } catch { /* already closed */ }
    }
  }

  return { logged: totalLogged, skippedSessions, unreadableSessions, appendFailures };
}
