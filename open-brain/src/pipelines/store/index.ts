import Database from 'better-sqlite3';
import { existsSync, readFileSync } from 'fs';
import {
  writeExperience,
  writeFailure,
  experiencePath,
  noteBody,
  splitStateLog,
  replaceStateNote,
  type ExperienceInput,
} from '../../vault-writer.js';
import { indexKnowledge, type FactKind } from '../../db-v2.js';

// ─── Interfaces ──────────────────────────────────────────────────────────────

export interface StoreInput {
  db: Database.Database;
  vaultDir: string;
  key: string;
  tags: string[];
  content: string;
  /** Vault subdirectory name — a display label, not a path. */
  project: string;
  /**
   * Canonical project directory, or null for a global entry.
   *
   * Distinct from `project` above and easy to confuse: that one names a vault
   * folder, this one is the value `ob_recall` filters on. Omitting it is how
   * 62% of rows ended up with a NULL `project_dir` and out of reach of every
   * project-scoped query.
   */
  projectDir?: string | null;
  source?: string;
  /** See `FactKind`. Omitted leaves the entry unclassified. */
  factKind?: FactKind | null;
}

export interface StoreFailureInput {
  db: Database.Database;
  vaultDir: string;
  key: string;
  tags: string[];
  attempted: string;
  whyFailed: string;
  whatWorked: string;
  project: string;
}

export interface StoreResult {
  vaultPath: string | null;
  /**
   * True when the note already existed on disk unindexed and was indexed in
   * place rather than written. Callers must say so: "stored" would imply the
   * content they passed was persisted, and it was not — the file won.
   */
  adopted?: boolean;
  /** A recorded `state` replaced its predecessor's value in place (T-022). */
  replaced?: { id: number; demotedAt: string };
  /** On a refusal over an indexed note: that row's `fact_kind` (null = unlabelled). */
  existingKind?: string | null;
  /** A `state` re-stored with the value it already holds: nothing was written. */
  unchanged?: true;
}

interface KnownRow {
  id: number;
  key: string;
  vault_path: string;
  fact_kind: string | null;
  archived_into: number | null;
}

// ─── store ───────────────────────────────────────────────────────────────────

/**
 * Vault-first storage: write .md to vault, then index metadata in SQLite.
 * Returns null vaultPath if entry already exists (dedup), except that a
 * recorded `state` re-stored under its own key replaces its value (T-022).
 */
export function store(input: StoreInput): StoreResult {
  const { db, vaultDir, key, tags, content, project } = input;
  const source = input.source ?? 'ob_store';

  const note: ExperienceInput = {
    key,
    tags,
    content,
    created: new Date().toISOString(),
    maturity: 'progenitor',
    helpful: 0,
    harmful: 0,
    neutral: 0,
    project,
    source,
  };
  const vaultPath = writeExperience(vaultDir, note);

  // `writeExperience` refuses to overwrite, so an existing note means this key
  // was already stored. Callers must report that rather than treat it as a
  // write — with one exception (T-022): a RECORDED `state` stored again under
  // its own key replaces its value, and the old value moves to the note's
  // `## Log`. Only when the incoming kind is `state` AND the row indexing the
  // note has exactly this key, is itself a `state`, and is not archived. A state
  // never replaces an event or an unlabelled row. The row keeps its id and its
  // `created_at`, so its ratings and recall history attach to the new value.
  //
  // Or unless the note is unindexed. The vault is documented vault-first, yet a
  // file with no index row had no way in: `ob_store` refused, so the only route
  // was a hand-written SQL insert. That is the gap that let 10 notes sit in the
  // vault feeding `skill-scan` while `ob_recall` could not see them. An existing
  // file is a genuine conflict only when the index already knows about it;
  // otherwise the right move is to adopt it.
  //
  // The file's own content is indexed, not the caller's. Vault-first means the
  // markdown wins, and silently indexing different text than the note holds
  // would recreate the divergence in a subtler form.
  if (vaultPath === null) {
    const existing = experiencePath(vaultDir, project, key);
    const known = db
      .prepare("SELECT id, key, vault_path, fact_kind, archived_into FROM knowledge_index WHERE LOWER(REPLACE(vault_path, '\\', '/')) = ?")
      .get(existing.replace(/\\/g, "/").toLowerCase()) as KnownRow | undefined;

    if (known) {
      const replaces =
        input.factKind === 'state' &&
        known.key === key &&
        known.fact_kind === 'state' &&
        known.archived_into === null &&
        existsSync(known.vault_path);
      if (!replaces) return { vaultPath: null, existingKind: known.fact_kind };

      const current = splitStateLog(noteBody(readFileSync(known.vault_path, "utf-8"))).current;
      if (current.trim() === content.trim()) {
        return { vaultPath: known.vault_path, unchanged: true };
      }

      const demotedAt = new Date().toISOString();
      replaceStateNote(known.vault_path, note, demotedAt);

      try {
        indexKnowledge(db, {
          vaultPath: known.vault_path,
          key,
          tags: tags.join(','),
          content,
          source,
          projectDir: input.projectDir ?? undefined,
          factKind: 'state',
        });
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        throw new Error(`state "${key}": the vault note was rewritten but the index update failed (${msg}); the index still holds the previous value`);
      }

      return { vaultPath: known.vault_path, replaced: { id: known.id, demotedAt } };
    }

    if (!existsSync(existing)) {
      return { vaultPath: null };
    }

    // A note that already carries a `## Log` is indexed by its current value
    // only: the log is what the note says is no longer true.
    const raw = readFileSync(existing, "utf-8");
    const body = splitStateLog(noteBody(raw)).current.trim();

    indexKnowledge(db, {
      vaultPath: existing,
      key,
      tags: tags.join(','),
      content: body,
      source,
      projectDir: input.projectDir ?? undefined,
      factKind: input.factKind ?? null,
    });

    return { vaultPath: existing, adopted: true };
  }

  indexKnowledge(db, {
    vaultPath,
    key,
    tags: tags.join(','),
    content,
    source,
    projectDir: input.projectDir ?? undefined,
    factKind: input.factKind ?? null,
  });

  return { vaultPath };
}

// ─── storeFailure ─────────────────────────────────────────────────────────────

/**
 * Writes a failure .md to vault, then indexes metadata in SQLite.
 * Returns null vaultPath if entry already exists (dedup).
 */
export function storeFailure(input: StoreFailureInput): StoreResult {
  const { db, vaultDir, key, tags, attempted, whyFailed, whatWorked, project } = input;

  const vaultPath = writeFailure(vaultDir, {
    key,
    tags,
    attempted,
    why_failed: whyFailed,
    what_worked: whatWorked,
    created: new Date().toISOString(),
    project,
  });

  if (vaultPath === null) {
    return { vaultPath: null };
  }

  const content = `## Attempted\n${attempted}\n\n## Why Failed\n${whyFailed}\n\n## What Worked\n${whatWorked}`;

  indexKnowledge(db, {
    vaultPath,
    key: `failure-${key}`,
    tags: ['failure', ...tags].join(','),
    content,
  });

  return { vaultPath };
}
