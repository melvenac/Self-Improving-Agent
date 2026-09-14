import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { readJson } from "../../shared/fs-utils.js";
import { parseState } from "../../shared/state-schema.js";
import type { ProjectState, SessionMode, StateFileKey, StateFileSize, StateJsonResult } from "./types.js";

export interface ReadProjectStateOptions {
  /** Per-file line budget. Omitted = whole file, no truncation. */
  stateBudgetLines?: number;
}

export function readProjectState(projectRoot: string, options: ReadProjectStateOptions = {}): ProjectState {
  const hasAgents = existsSync(join(projectRoot, ".agents"));
  const hasMeta = existsSync(join(projectRoot, ".agents", "META"));

  let mode: SessionMode = "lightweight";
  if (hasAgents && hasMeta) mode = "meta";
  else if (hasAgents) mode = "project";

  const pkg = readJson<{ version: string }>(join(projectRoot, "package.json"));
  const version = pkg?.version ?? "0.0.0";

  const summaryDir = hasMeta ? ".agents/META" : ".agents/SYSTEM";
  const files: Array<{ key: Exclude<StateFileKey, "stateJson">; rel: string }> = [
    { key: "summary", rel: `${summaryDir}/SUMMARY.md` },
    { key: "inbox", rel: ".agents/TASKS/INBOX.md" },
    { key: "taskFile", rel: ".agents/TASKS/task.md" },
    { key: "nextSession", rel: ".agents/SESSIONS/next-session.md" },
  ];

  const content: Record<Exclude<StateFileKey, "stateJson">, string | null> = {
    summary: null, inbox: null, taskFile: null, nextSession: null,
  };
  const sizes: StateFileSize[] = [];

  for (const { key, rel } of files) {
    const read = readOptional(join(projectRoot, rel), options.stateBudgetLines);
    content[key] = read.content;
    sizes.push({ file: key, path: rel, ...measure(read) });
  }

  // state.json is never truncated: it is a record, and a cut record is not a
  // record. It joins the size block only when present, so the block stays
  // byte-identical to v0.28.0 for every project that has no file yet.
  const stateJson = readStateJson(projectRoot);
  if (stateJson.present) {
    const read = readOptional(join(projectRoot, STATE_JSON_REL));
    sizes.push({ file: "stateJson", path: STATE_JSON_REL, ...measure(read) });
  }

  return {
    mode,
    version,
    summary: content.summary,
    inbox: content.inbox,
    taskFile: content.taskFile,
    nextSession: content.nextSession,
    hasAgents,
    hasMeta,
    sizes,
    stateJson,
  };
}

export const STATE_JSON_REL = ".agents/state.json";

/**
 * Reads `.agents/state.json` against the strict schema. Three outcomes, all
 * distinguishable: absent (`present: false`), present but invalid (`valid:
 * false` with the zod path in `error`), present and valid (`data`).
 */
export function readStateJson(projectRoot: string): StateJsonResult {
  const path = join(projectRoot, STATE_JSON_REL);
  if (!existsSync(path)) return { present: false, valid: false };
  const parsed = parseState(readFileSync(path, "utf-8"));
  return parsed.ok
    ? { present: true, valid: true, data: parsed.data }
    : { present: true, valid: false, error: parsed.error };
}

export interface OptionalRead {
  content: string | null;
  truncated: boolean;
  /** Full line count of the file on disk (0 when absent). */
  sourceLines: number;
}

/**
 * Reads a state file if it exists. With no budget the whole file comes back.
 * With a budget, a file longer than `maxLines` is cut and marked — the flag,
 * not the "...(truncated)" marker in the text, is what callers must check.
 * The 50-line default this used to carry silently dropped 150+ lines of
 * SUMMARY.md and 170+ of INBOX.md on this repo, and nothing surfaced it.
 */
export function readOptional(path: string, maxLines?: number): OptionalRead {
  if (!existsSync(path)) return { content: null, truncated: false, sourceLines: 0 };
  const content = readFileSync(path, "utf-8");
  const lines = content.split("\n");
  if (maxLines !== undefined && maxLines >= 0 && lines.length > maxLines) {
    return {
      content: lines.slice(0, maxLines).join("\n") + "\n...(truncated)",
      truncated: true,
      sourceLines: lines.length,
    };
  }
  return { content, truncated: false, sourceLines: lines.length };
}

export function countWords(text: string): number {
  const trimmed = text.trim();
  return trimmed === "" ? 0 : trimmed.split(/\s+/).length;
}

/** chars/4, rounded up. See StateFileSize for why this estimator. */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

function measure(read: OptionalRead): Omit<StateFileSize, "file" | "path"> {
  if (read.content === null) {
    return { present: false, lines: 0, sourceLines: 0, words: 0, estTokens: 0, truncated: false };
  }
  return {
    present: true,
    lines: read.content.split("\n").length,
    sourceLines: read.sourceLines,
    words: countWords(read.content),
    estTokens: estimateTokens(read.content),
    truncated: read.truncated,
  };
}
