/**
 * T-322: rewrite one stored lesson's `MATCH:` line in place, keeping its id and its counts.
 *
 * `ob_store` refuses a repeated event key (only a recorded `state` replaces in place), and `ob_forget` then a
 * fresh store loses the row's ratings and recall history: `feedback_log` and `recall_log` point at the id and
 * have no foreign key. This edits the one line in the vault note and re-indexes the row through
 * `indexKnowledge`, whose ON CONFLICT(key) update leaves the lifecycle columns (counters, `recall_count`,
 * `last_recalled_at`, `created_at`, the id) as they were.
 *
 * Vault-first, like `store`: the note is written before the index, and a note that is missing refuses rather
 * than re-indexing text no file holds. The caller refreshes the trigger key sidecar afterwards.
 *
 * T-162: a lesson whose note AND indexed content both have NO `MATCH:` line gets one appended (`added`), so a
 * lesson stored before D-155 can be keyed without losing its counts. `none` is refused there: a lesson with no
 * key is already lookup-only. A note and an index that disagree (one line against none) refuse.
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import type Database from "better-sqlite3";
import { indexKnowledge, type FactKind } from "../../db-v2.js";

/** The value after `MATCH: `: one of the four kinds `/end` step 2 writes (D-155). */
const MATCH_VALUE = /^(none|(command|path|error):\s*\S.*)$/;
const MATCH_LINE = /^MATCH:[^\r\n]*/m;

export type RematchResult =
  | { ok: true; id: number; key: string; vaultPath: string; before: string | null; after: string; added: boolean; unchanged: boolean; dryRun: boolean }
  | { ok: false; error: string };

interface Row {
  id: number;
  key: string;
  vault_path: string;
  content: string;
  tags: string | null;
  source: string;
  project_dir: string | null;
  fact_kind: string | null;
  archived_into: number | null;
}

/** The text's `MATCH:` lines. */
function matchLines(text: string): string[] {
  return text.split(/\r?\n/).filter((l) => l.startsWith("MATCH:"));
}

/**
 * T-162: `text` with `line` added as the last line of its body, in the text's own line ending. A state note's
 * `## Log` holds what is no longer true, so the line goes before it, at the end of the current value.
 */
function appendMatchLine(text: string, line: string): string {
  const nl = text.includes("\r\n") ? "\r\n" : "\n";
  const lines = text.split(/\r?\n/);
  let end = lines.indexOf("## Log");
  if (end === -1) end = lines.length;
  let at = end;
  while (at > 0 && lines[at - 1]!.trim() === "") at--;
  lines.splice(at, 0, line);
  return lines.join(nl);
}

export function rematch(db: Database.Database, id: number, match: string, opts: { dryRun?: boolean } = {}): RematchResult {
  const value = match.trim();
  if (!MATCH_VALUE.test(value)) {
    return { ok: false, error: `"${match}" is not a MATCH value: expected none, command: <key>, path: <glob> or error: <text>` };
  }
  const after = `MATCH: ${value}`;

  const row = db
    .prepare("SELECT id, key, vault_path, content, tags, source, project_dir, fact_kind, archived_into FROM knowledge_index WHERE id = ?")
    .get(id) as Row | undefined;
  if (!row) return { ok: false, error: `no entry with id ${id}` };
  if (row.archived_into !== null) return { ok: false, error: `entry ${id} is archived (into ${row.archived_into})` };

  const inIndex = matchLines(row.content);
  if (inIndex.length > 1) {
    return { ok: false, error: `entry ${id}'s indexed content has ${inIndex.length} MATCH: line(s); rematch rewrites exactly one` };
  }
  if (!existsSync(row.vault_path)) return { ok: false, error: `entry ${id}'s note is missing: ${row.vault_path}` };
  const note = readFileSync(row.vault_path, "utf-8");
  const inNote = matchLines(note);
  if (inNote.length > 1) {
    return { ok: false, error: `entry ${id}'s note has ${inNote.length} MATCH: line(s); rematch rewrites exactly one` };
  }
  if (inNote.length !== inIndex.length) {
    return {
      ok: false,
      error: `entry ${id}'s note has ${inNote.length} MATCH: line(s) and its indexed content has ${inIndex.length}; they disagree, so nothing is written`,
    };
  }
  const adding = inIndex.length === 0;
  if (adding && value === "none") {
    return { ok: false, error: `entry ${id} has 0 MATCH: line(s): with no key it is already lookup-only, so there is no "MATCH: none" to add` };
  }

  const before = adding ? null : inIndex[0]!;
  const base = { ok: true as const, id, key: row.key, vaultPath: row.vault_path, before, after, added: adding };
  if (!adding && before === after && inNote[0] === after) return { ...base, unchanged: true, dryRun: opts.dryRun === true };
  if (opts.dryRun) return { ...base, unchanged: false, dryRun: true };

  const put = (text: string): string => (adding ? appendMatchLine(text, after) : text.replace(MATCH_LINE, () => after));
  writeFileSync(row.vault_path, put(note), "utf-8");
  try {
    indexKnowledge(db, {
      vaultPath: row.vault_path,
      key: row.key,
      tags: row.tags ?? "",
      content: put(row.content),
      source: row.source,
      projectDir: row.project_dir ?? undefined,
      factKind: (row.fact_kind as FactKind | null) ?? undefined,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    const held = before ?? "no MATCH: line";
    throw new Error(`entry ${id}: the note was rewritten but the index update failed (${msg}); the index still holds "${held}"`);
  }
  return { ...base, unchanged: false, dryRun: false };
}
