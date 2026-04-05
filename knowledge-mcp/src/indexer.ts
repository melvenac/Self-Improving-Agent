import Database from "better-sqlite3";
import { readdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import {
  getSessionsDir,
  getIndexedSessionIds,
  getSession,
  insertSession,
  updateSessionEventCount,
  deleteChunksForSession,
  deleteSummaryForSession,
  insertChunk,
  insertTags,
} from "./db.js";
import { extractTags } from "./tags.js";

interface SessionEvent {
  id: number;
  session_id: string;
  type: string;
  category: string;
  priority: number;
  data: string;
  source_hook: string;
  created_at: string;
}

interface SessionMeta {
  session_id: string;
  project_dir: string | null;
  started_at: string;
  last_event_at: string | null;
  event_count: number;
}

function categorizeEvent(event: SessionEvent): string {
  switch (event.type) {
    case "user_prompt":
      return "prompt";
    case "mcp":
      return "tool_result";
    case "file_modify":
    case "file_create":
      return "file_change";
    case "file_read":
      return "file_read";
    case "error":
      return "error";
    case "bash":
    case "command":
      return "command_output";
    default:
      return event.category || "other";
  }
}

function sourceLabel(event: SessionEvent): string {
  const data = event.data;
  if (!data) return event.type;

  if (event.type === "mcp" && data.length < 100) return data;

  if (event.type === "user_prompt") {
    return data.length > 80 ? data.substring(0, 80) + "..." : data;
  }

  if (
    event.type === "file_modify" ||
    event.type === "file_create" ||
    event.type === "file_read"
  ) {
    return data.length > 120 ? data.substring(0, 120) + "..." : data;
  }

  return event.type;
}

function chunkContent(content: string, maxChunkSize: number = 2000): string[] {
  if (content.length <= maxChunkSize) return [content];

  const chunks: string[] = [];
  const lines = content.split("\n");
  let current = "";

  for (const line of lines) {
    if (
      current.length + line.length + 1 > maxChunkSize &&
      current.length > 0
    ) {
      chunks.push(current);
      current = line;
    } else {
      current += (current ? "\n" : "") + line;
    }
  }

  if (current) chunks.push(current);
  return chunks;
}

export function indexSessionFile(dbFilePath: string): {
  sessionId: string;
  eventsIndexed: number;
  chunksCreated: number;
  tagsCreated: number;
  status: "new" | "updated" | "skipped";
} {
  if (!existsSync(dbFilePath)) {
    throw new Error(`Session file not found: ${dbFilePath}`);
  }

  const sessionDb = new Database(dbFilePath, { readonly: true });

  const hasEvents = sessionDb
    .prepare(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='session_events'"
    )
    .get();

  if (!hasEvents) {
    sessionDb.close();
    throw new Error(`No session_events table in ${dbFilePath}`);
  }

  const meta = sessionDb
    .prepare("SELECT * FROM session_meta LIMIT 1")
    .get() as SessionMeta | undefined;

  if (!meta) {
    sessionDb.close();
    throw new Error(`No session metadata in ${dbFilePath}`);
  }

  // Check for deduplication: is this session already indexed?
  const existingSession = getSession(meta.session_id);
  if (existingSession) {
    // Compare event counts — if unchanged, skip
    if (
      existingSession.event_count_at_index !== null &&
      existingSession.event_count_at_index >= meta.event_count
    ) {
      sessionDb.close();
      return {
        sessionId: meta.session_id,
        eventsIndexed: 0,
        chunksCreated: 0,
        tagsCreated: 0,
        status: "skipped",
      };
    }

    // Session has new events — delete old chunks and re-index
    deleteChunksForSession(meta.session_id);
    deleteSummaryForSession(meta.session_id);
  }

  // Read all events
  const events = sessionDb
    .prepare("SELECT * FROM session_events ORDER BY id")
    .all() as SessionEvent[];

  sessionDb.close();

  if (!existingSession) {
    // New session
    insertSession(
      meta.session_id,
      dbFilePath,
      meta.project_dir,
      meta.started_at,
      meta.last_event_at,
      meta.event_count
    );
  } else {
    // Update existing session's event count
    updateSessionEventCount(meta.session_id, meta.event_count);
  }

  // Chunk, index, and tag events
  let chunksCreated = 0;
  let tagsCreated = 0;

  for (const event of events) {
    if (!event.data || event.data.trim().length === 0) continue;

    const category = categorizeEvent(event);
    const source = sourceLabel(event);
    const chunks = chunkContent(event.data);

    for (const chunk of chunks) {
      const chunkId = insertChunk(
        meta.session_id,
        source,
        category,
        chunk,
        JSON.stringify({
          type: event.type,
          source_hook: event.source_hook,
          priority: event.priority,
          event_id: event.id,
        }),
        event.created_at,
        meta.project_dir
      );
      chunksCreated++;

      // Extract and insert tags
      const tags = extractTags(chunk, category, source);
      if (tags.length > 0) {
        insertTags(chunkId, tags);
        tagsCreated += tags.length;
      }
    }
  }

  return {
    sessionId: meta.session_id,
    eventsIndexed: events.length,
    chunksCreated,
    tagsCreated,
    status: existingSession ? "updated" : "new",
  };
}

export function indexAllUnindexed(): {
  indexed: number;
  updated: number;
  skipped: number;
  errors: string[];
} {
  const sessionsDir = getSessionsDir();
  if (!existsSync(sessionsDir)) {
    return {
      indexed: 0,
      updated: 0,
      skipped: 0,
      errors: ["Sessions directory not found"],
    };
  }

  const files = readdirSync(sessionsDir).filter((f) => f.endsWith(".db"));

  let indexed = 0;
  let updated = 0;
  let skipped = 0;
  const errors: string[] = [];

  for (const file of files) {
    const filePath = join(sessionsDir, file);

    try {
      const result = indexSessionFile(filePath);
      switch (result.status) {
        case "new":
          indexed++;
          break;
        case "updated":
          updated++;
          break;
        case "skipped":
          skipped++;
          break;
      }
    } catch (err) {
      errors.push(
        `${file}: ${err instanceof Error ? err.message : String(err)}`
      );
    }
  }

  return { indexed, updated, skipped, errors };
}
