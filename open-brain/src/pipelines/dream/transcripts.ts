import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";
import type { SessionTranscript, TranscriptRef, TranscriptTurn } from "./types.js";

/**
 * Reading session transcripts from ~/.claude/projects/<project>/<uuid>.jsonl.
 *
 * Each file is one JSON object per line, and most lines are not conversation:
 * a 500-line transcript is mostly `mode`, `permission-mode`, `last-prompt`,
 * `attachment`, `file-history-*`, `ai-title` and `queue-operation` rows. Only
 * `user` and `assistant` rows carry text worth reconciling against memory.
 */

/** Row types that carry no conversational text. Everything else is ignored too. */
const CONVERSATIONAL_TYPES = new Set(["user", "assistant"]);

export function transcriptsRoot(home: string = homedir()): string {
  return process.env.OPEN_BRAIN_TRANSCRIPTS_DIR || join(home, ".claude", "projects");
}

export interface ListOptions {
  /** Only transcripts modified at or after this epoch-ms. */
  sinceMs: number;
  /** Session ids already reconciled; skipped so repeat runs converge. */
  excludeSessionIds?: Iterable<string>;
  root?: string;
}

/**
 * Locate candidate transcripts, newest first.
 *
 * Ordering is by mtime rather than filename because session UUIDs carry no
 * time component.
 */
export function listSessionTranscripts(opts: ListOptions): TranscriptRef[] {
  const root = opts.root ?? transcriptsRoot();
  const exclude = new Set(opts.excludeSessionIds ?? []);
  const refs: TranscriptRef[] = [];

  let projects: string[];
  try {
    projects = readdirSync(root);
  } catch {
    return refs; // No transcripts directory is an empty window, not an error.
  }

  for (const project of projects) {
    const dir = join(root, project);
    let files: string[];
    try {
      files = readdirSync(dir).filter((f) => f.endsWith(".jsonl"));
    } catch {
      continue; // A stray file where a directory was expected.
    }
    for (const file of files) {
      const sessionId = file.replace(/\.jsonl$/, "");
      if (exclude.has(sessionId)) continue;
      const path = join(dir, file);
      let mtimeMs: number;
      try {
        mtimeMs = statSync(path).mtimeMs;
      } catch {
        continue;
      }
      if (mtimeMs < opts.sinceMs) continue;
      refs.push({ sessionId, project, path, mtimeMs });
    }
  }

  return refs.sort((a, b) => b.mtimeMs - a.mtimeMs);
}

/**
 * Flatten a message body to plain text.
 *
 * `content` is either a bare string or an array of blocks. Only `text` blocks
 * are kept: tool calls and their results are the agent's mechanics, and quoting
 * them as evidence of what the user said would be misleading.
 */
function extractText(content: unknown): string {
  if (typeof content === "string") return content;
  if (!Array.isArray(content)) return "";
  const parts: string[] = [];
  for (const block of content) {
    if (block && typeof block === "object" && (block as { type?: string }).type === "text") {
      const text = (block as { text?: unknown }).text;
      if (typeof text === "string") parts.push(text);
    }
  }
  return parts.join("\n");
}

/**
 * Parse one transcript into its conversational turns.
 *
 * Malformed lines are skipped rather than thrown on: transcripts are written
 * continuously and the final line of an open session is routinely a partial
 * write. Failing the whole pass because the newest session is mid-flush would
 * make dream unable to run precisely when there is most to reconcile.
 */
export function readTranscript(ref: TranscriptRef): SessionTranscript {
  const turns: TranscriptTurn[] = [];
  let raw = "";
  try {
    raw = readFileSync(ref.path, "utf-8");
  } catch {
    return { ...ref, turns };
  }

  const lines = raw.split("\n");
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!line.trim()) continue;
    let row: { type?: string; message?: { role?: string; content?: unknown } };
    try {
      row = JSON.parse(line);
    } catch {
      continue;
    }
    if (!row.type || !CONVERSATIONAL_TYPES.has(row.type)) continue;
    const role = row.message?.role;
    if (role !== "user" && role !== "assistant") continue;

    const text = extractText(row.message?.content).trim();
    if (!text) continue;

    turns.push({
      sessionId: ref.sessionId,
      project: ref.project,
      line: i + 1, // 1-based, to match what an editor shows
      role,
      text,
    });
  }

  return { ...ref, turns };
}

/** Convenience: locate and parse in one call, newest session first. */
export function readSessionTranscripts(opts: ListOptions): SessionTranscript[] {
  return listSessionTranscripts(opts).map(readTranscript);
}
