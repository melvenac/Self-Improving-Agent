#!/usr/bin/env node
/**
 * Auto-index script for SessionEnd hook.
 * Scans the context-mode sessions directory and indexes any new .db files
 * into the Open Brain knowledge base.
 */

import { join } from "node:path";
import { homedir } from "node:os";
import { readdirSync, existsSync } from "node:fs";
import Database from "better-sqlite3";

const HOME = homedir();
const KB_DIR = join(HOME, ".claude", "context-mode");
const KB_PATH = join(KB_DIR, "knowledge.db");
const SESSIONS_DIR = join(KB_DIR, "sessions");

if (!existsSync(SESSIONS_DIR)) {
  console.error("No sessions directory found at", SESSIONS_DIR);
  process.exit(0);
}

if (!existsSync(KB_PATH)) {
  console.error("Knowledge DB not found at", KB_PATH);
  process.exit(0);
}

// Open knowledge DB and get already-indexed session IDs
const kb = new Database(KB_PATH);
const indexed = new Set(
  kb.prepare("SELECT id FROM sessions").all().map((r) => r.id)
);

// Scan for session .db files
const dbFiles = readdirSync(SESSIONS_DIR).filter((f) => f.endsWith(".db"));
let newCount = 0;

for (const file of dbFiles) {
  const filePath = join(SESSIONS_DIR, file);

  try {
    const sessionDb = new Database(filePath, { readonly: true });

    // Check if it has the expected tables
    const hasEvents = sessionDb
      .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='session_events'")
      .get();

    if (!hasEvents) {
      sessionDb.close();
      continue;
    }

    const meta = sessionDb
      .prepare("SELECT * FROM session_meta LIMIT 1")
      .get();

    if (!meta || indexed.has(meta.session_id)) {
      sessionDb.close();
      continue;
    }

    // Read events
    const events = sessionDb
      .prepare("SELECT * FROM session_events ORDER BY id")
      .all();
    sessionDb.close();

    // Insert session
    kb.prepare(
      `INSERT OR IGNORE INTO sessions (id, db_file, project_dir, started_at, ended_at, event_count, indexed_at)
       VALUES (?, ?, ?, ?, ?, ?, datetime('now'))`
    ).run(meta.session_id, filePath, meta.project_dir, meta.started_at, meta.last_event_at, meta.event_count);

    // Chunk and insert events
    for (const event of events) {
      if (!event.data || event.data.trim().length === 0) continue;

      const category = categorize(event);
      const source = labelSource(event);
      const chunks = chunk(event.data);

      for (const c of chunks) {
        kb.prepare(
          `INSERT INTO chunks (session_id, source, category, content, metadata, created_at, indexed_at)
           VALUES (?, ?, ?, ?, ?, ?, datetime('now'))`
        ).run(
          meta.session_id,
          source,
          category,
          c,
          JSON.stringify({ type: event.type, source_hook: event.source_hook, priority: event.priority, event_id: event.id }),
          event.created_at
        );
      }
    }

    newCount++;
  } catch (err) {
    console.error(`Error indexing ${file}:`, err.message);
  }
}

kb.close();
console.error(`Auto-index complete: ${newCount} new session(s) indexed.`);

// --- Helpers ---

function categorize(event) {
  switch (event.type) {
    case "user_prompt": return "prompt";
    case "mcp": return "tool_result";
    case "file_modify":
    case "file_create": return "file_change";
    case "file_read": return "file_read";
    case "error": return "error";
    case "bash":
    case "command": return "command_output";
    default: return event.category || "other";
  }
}

function labelSource(event) {
  const data = event.data;
  if (!data) return event.type;
  if (event.type === "mcp" && data.length < 100) return data;
  if (event.type === "user_prompt") return data.length > 80 ? data.substring(0, 80) + "..." : data;
  if (["file_modify", "file_create", "file_read"].includes(event.type)) return data.length > 120 ? data.substring(0, 120) + "..." : data;
  return event.type;
}

function chunk(content, maxSize = 2000) {
  if (content.length <= maxSize) return [content];
  const chunks = [];
  const lines = content.split("\n");
  let current = "";
  for (const line of lines) {
    if (current.length + line.length + 1 > maxSize && current.length > 0) {
      chunks.push(current);
      current = line;
    } else {
      current += (current ? "\n" : "") + line;
    }
  }
  if (current) chunks.push(current);
  return chunks;
}
