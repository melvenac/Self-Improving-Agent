import { basename } from "node:path";
import type { ChunkStore, ChunkIndexResult } from "./types.js";

export interface SessionFile {
  path: string;
  content: string;
}

export function categorizeEvent(event: { type: string; name?: string }): string {
  if (event.type === "error") return "error";
  if (event.type === "human" || event.type === "assistant") return "prompt";
  if (event.type === "tool_use" || event.type === "tool_result") {
    const name = event.name ?? "";
    if (name === "Read" || name === "Glob" || name === "Grep") return "file_read";
    if (name === "Edit" || name === "Write") return "file_change";
    if (name === "Bash") return "command_output";
    return "other";
  }
  return "other";
}

export function chunkContent(content: string, maxSize = 2000): string[] {
  if (!content) return [];
  if (content.length <= maxSize) return [content];
  const chunks: string[] = [];
  for (let i = 0; i < content.length; i += maxSize) {
    chunks.push(content.slice(i, i + maxSize));
  }
  return chunks;
}

export function indexSessionChunks(
  sessionFiles: SessionFile[],
  store: ChunkStore,
  projectDir: string
): ChunkIndexResult {
  const alreadyIndexed = new Set(store.getIndexedSessionFiles());
  let sessionsIndexed = 0;
  let chunksCreated = 0;
  const errors: string[] = [];

  for (const file of sessionFiles) {
    const filename = basename(file.path);
    if (alreadyIndexed.has(filename)) continue;

    const sessionId = filename.replace(/\.jsonl$/, "");
    let eventCount = 0;
    const lines = file.content.split("\n");

    for (let lineNum = 0; lineNum < lines.length; lineNum++) {
      const line = lines[lineNum].trim();
      if (!line) continue;

      let event: { type: string; name?: string; content?: string };
      try {
        event = JSON.parse(line);
      } catch {
        errors.push(`sess${sessionId}: parse error at line ${lineNum + 1} in ${filename}`);
        continue;
      }

      eventCount++;
      const category = categorizeEvent(event);
      const raw = typeof event.content === "string" ? event.content : JSON.stringify(event);
      const chunks = chunkContent(raw);

      for (const chunk of chunks) {
        store.insertChunk({
          session_id: sessionId,
          source: file.path,
          category,
          content: chunk,
          metadata: JSON.stringify({ line: lineNum + 1, type: event.type, name: event.name }),
          project_dir: projectDir,
        });
        chunksCreated++;
      }
    }

    const now = new Date().toISOString();
    store.insertSession({
      id: sessionId,
      db_file: filename,
      project_dir: projectDir,
      started_at: now,
      ended_at: now,
      event_count: eventCount,
    });
    sessionsIndexed++;
  }

  return { sessionsIndexed, chunksCreated, errors };
}
