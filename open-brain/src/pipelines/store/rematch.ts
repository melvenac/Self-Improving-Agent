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
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import type Database from "better-sqlite3";
import { indexKnowledge, type FactKind } from "../../db-v2.js";

/** The value after `MATCH: `: one of the four kinds `/end` step 2 writes (D-155). */
const MATCH_VALUE = /^(none|(command|path|error):\s*\S.*)$/;
const MATCH_LINE = /^MATCH:[^\r\n]*/m;

export type RematchResult =
  | { ok: true; id: number; key: string; vaultPath: string; before: string; after: string; unchanged: boolean; dryRun: boolean }
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

/** The text's one `MATCH:` line, or why there is not exactly one. */
function oneMatchLine(text: string, where: string): { line: string } | { error: string } {
  const lines = text.split(/\r?\n/).filter((l) => l.startsWith("MATCH:"));
  if (lines.length !== 1) return { error: `${where} has ${lines.length} MATCH: line(s); rematch rewrites exactly one` };
  return { line: lines[0]! };
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

  const inIndex = oneMatchLine(row.content, `entry ${id}'s indexed content`);
  if ("error" in inIndex) return { ok: false, error: inIndex.error };
  if (!existsSync(row.vault_path)) return { ok: false, error: `entry ${id}'s note is missing: ${row.vault_path}` };
  const note = readFileSync(row.vault_path, "utf-8");
  const inNote = oneMatchLine(note, `entry ${id}'s note`);
  if ("error" in inNote) return { ok: false, error: inNote.error };

  const before = inIndex.line;
  const base = { ok: true as const, id, key: row.key, vaultPath: row.vault_path, before, after };
  if (before === after && inNote.line === after) return { ...base, unchanged: true, dryRun: opts.dryRun === true };
  if (opts.dryRun) return { ...base, unchanged: false, dryRun: true };

  writeFileSync(row.vault_path, note.replace(MATCH_LINE, () => after), "utf-8");
  try {
    indexKnowledge(db, {
      vaultPath: row.vault_path,
      key: row.key,
      tags: row.tags ?? "",
      content: row.content.replace(MATCH_LINE, () => after),
      source: row.source,
      projectDir: row.project_dir ?? undefined,
      factKind: (row.fact_kind as FactKind | null) ?? undefined,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(`entry ${id}: the note was rewritten but the index update failed (${msg}); the index still holds "${before}"`);
  }
  return { ...base, unchanged: false, dryRun: false };
}
