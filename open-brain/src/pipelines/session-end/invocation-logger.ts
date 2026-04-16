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
  skippedSessions: number;
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

const INVOCATION_LOG_PATH = join(homedir(), ".claude", "knowledge-mcp", "skill-invocations.jsonl");
const SESSIONS_DB_DIR = join(homedir(), ".claude", "context-mode", "sessions");

/**
 * Extract skill/mcp/command invocations from session .db files and append to JSONL log.
 * Skips sessions already logged (deduplication by session_id).
 */
export function logInvocations(): InvocationLogResult {
  if (!existsSync(SESSIONS_DB_DIR)) {
    return { logged: 0, skippedSessions: 0 };
  }

  // Read already-logged session IDs
  const loggedSessions = new Set<string>();
  if (existsSync(INVOCATION_LOG_PATH)) {
    try {
      const lines = readFileSync(INVOCATION_LOG_PATH, "utf8").split("\n").filter(Boolean);
      for (const line of lines) {
        try {
          const entry = JSON.parse(line) as { session?: string };
          if (entry.session) loggedSessions.add(entry.session);
        } catch { /* skip malformed lines */ }
      }
    } catch { /* file read error — proceed without dedup */ }
  }

  const dbFiles = readdirSync(SESSIONS_DB_DIR).filter((f) => f.endsWith(".db"));
  let totalLogged = 0;
  let skippedSessions = 0;

  for (const file of dbFiles) {
    const filePath = join(SESSIONS_DB_DIR, file);
    try {
      const sessionDb = new Database(filePath, { readonly: true });

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
          appendFileSync(INVOCATION_LOG_PATH, JSON.stringify(entry) + "\n");
          totalLogged++;
        } catch { /* append error — skip */ }
      }
    } catch { /* session db read error — skip */ }
  }

  return { logged: totalLogged, skippedSessions };
}
