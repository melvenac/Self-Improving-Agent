/**
 * Sync checks that read the knowledge database — the MEMORY side of the sync
 * pipeline.
 *
 * Split out of `checks.ts` in Loop 13 (the module boundary). These three checks
 * were the *entire* code-level crossing from protocol code into memory code:
 * `cli.ts -> pipelines/sync/index.ts -> pipelines/sync/checks.ts`, where
 * `checks.ts` held a value import of `better-sqlite3` and so dragged a native
 * build into every path that merely wanted to validate a version string.
 *
 * **Nothing here is imported by core.** `runSync` receives these through
 * `SyncOptions.memoryChecks`, supplied by a composition root that has already
 * established the memory module is installed. Core declares the shape; memory
 * provides it; the dependency arrow points one way and a checker can assert it.
 *
 * The checks themselves are unchanged — Loop 13 C2 moves a boundary, it does
 * not fix what is behind it.
 */
import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import Database from "better-sqlite3";
import type { CheckResult } from "./types.js";
import { SCHEMA_VERSION } from "../../db-v2.js";

/**
 * Vault notes and their index rows drifting apart.
 *
 * The vault is documented vault-first: the markdown is the source of truth and
 * the DB indexes it. Nothing enforced that, and the two diverge silently in both
 * directions. Three unrelated producers were found in one audit — the v1->v2
 * migration wrote notes without indexing them, a test suite wrote into the real
 * vault, and deleting an entry removes the row while leaving the file.
 *
 * The damage is not that a row is missing. The note sits in `Experiences/`
 * looking like captured knowledge while being
 * invisible to `ob_recall` — knowledge that is on disk but can never be
 * retrieved. One such note was driving a live skill proposal when this was
 * written.
 *
 * Reported as a warning, not an issue: this is data state needing per-note
 * triage (index it, or delete it), not something a commit should block on, and
 * unlike the version checks it cannot be auto-fixed.
 */
export function checkVaultIndexParity(vaultPath: string, dbPath: string): CheckResult {
  if (!existsSync(vaultPath) || !existsSync(dbPath)) {
    return { name: "vault-index-parity", severity: "pass", message: "Vault or knowledge DB absent — parity not applicable" };
  }

  const norm = (p: string) => p.replace(/\\/g, "/").toLowerCase();

  let indexed: Set<string>;
  let rows: Array<{ vault_path: string }>;
  try {
    const db = new Database(dbPath, { readonly: true, fileMustExist: true });
    rows = db.prepare("SELECT vault_path FROM knowledge_index WHERE vault_path IS NOT NULL").all() as Array<{ vault_path: string }>;
    db.close();
    indexed = new Set(rows.map((r) => norm(r.vault_path)));
  } catch (err) {
    return { name: "vault-index-parity", severity: "warn", message: `Could not read knowledge DB: ${(err as Error).message}` };
  }

  // Only the directories the ob_ tools write and index. Summaries/ is written by
  // session-end and deliberately not indexed, so scanning it would be all noise.
  const scanned = ["Experiences", "Checkpoints"];
  const walk = (dir: string): string[] => {
    const out: string[] = [];
    let entries;
    try { entries = readdirSync(dir, { withFileTypes: true }); } catch { return out; }
    for (const e of entries) {
      const full = join(dir, e.name);
      if (e.isDirectory()) out.push(...walk(full));
      else if (e.name.endsWith(".md")) out.push(full);
    }
    return out;
  };

  const files = scanned.flatMap((d) => walk(join(vaultPath, d)));
  const unmatched = files.filter((f) => !indexed.has(norm(f)));
  const dangling = rows.filter((r) => !existsSync(r.vault_path));

  // An unmatched file whose *basename* is indexed under a different folder is a
  // second copy of an indexed note, not an unindexed one. The distinction is the
  // whole point: a duplicate means the vault holds two copies of one
  // experience, while an unindexed note is simply unreachable. Reporting both
  // as "not in the index" hides the first entirely.
  const indexedNames = new Set([...indexed].map((p) => p.slice(p.lastIndexOf("/") + 1)));
  const nameOf = (f: string) => norm(f).slice(norm(f).lastIndexOf("/") + 1);
  const duplicates = unmatched.filter((f) => indexedNames.has(nameOf(f)));
  const unindexed = unmatched.filter((f) => !indexedNames.has(nameOf(f)));

  if (unmatched.length === 0 && dangling.length === 0) {
    return { name: "vault-index-parity", severity: "pass", message: `Vault and index agree (${files.length} notes)` };
  }

  const rel = (f: string) => f.replace(vaultPath, "").replace(/\\/g, "/").replace(/^\//, "");
  const parts: string[] = [];
  if (duplicates.length > 0) {
    parts.push(`${duplicates.length} duplicate note(s) — same note filed under two folders, so the vault holds two copies of one experience: ${rel(duplicates[0])}`);
  }
  if (unindexed.length > 0) {
    parts.push(`${unindexed.length} unindexed note(s) — present in the vault but unreachable by ob_recall: ${rel(unindexed[0])}`);
  }
  if (dangling.length > 0) {
    parts.push(`${dangling.length} index row(s) whose vault file is missing`);
  }
  return { name: "vault-index-parity", severity: "warn", message: parts.join("; ") };
}

/**
 * This build's schema version against the stamp in the live database.
 *
 * Per-session MCP servers pick up new code only when their own session
 * reconnects, so two writers can run different builds against one DB
 * indefinitely — proven live in Session 52, when a v0.18.0 server's default
 * contaminated a column a v0.19.x server had already moved past. The stamp
 * (SQLite user_version, written forward-only by openV2Database) is what lets
 * an older writer learn it is behind; this check reads it at the commit gate.
 */
export function checkSchemaVersion(dbPath: string): CheckResult {
  if (!existsSync(dbPath)) {
    return { name: "schema-version", severity: "pass", message: "Knowledge DB absent — nothing to compare" };
  }

  let dbVersion: number;
  try {
    const db = new Database(dbPath, { readonly: true, fileMustExist: true });
    dbVersion = Number(db.pragma("user_version", { simple: true })) || 0;
    db.close();
  } catch (err) {
    return { name: "schema-version", severity: "warn", message: `Could not read knowledge DB: ${(err as Error).message}` };
  }

  if (dbVersion === SCHEMA_VERSION) {
    return { name: "schema-version", severity: "pass", message: `Schema stamp matches this build (v${SCHEMA_VERSION})` };
  }
  if (dbVersion > SCHEMA_VERSION) {
    return {
      name: "schema-version",
      severity: "issue",
      message: `This build writes schema v${SCHEMA_VERSION} but the DB is stamped v${dbVersion} by a newer build — running stale code; rebuild or pull before writing`,
    };
  }
  return {
    name: "schema-version",
    severity: "warn",
    message: `DB stamped v${dbVersion}, this build writes v${SCHEMA_VERSION} — heals on the next openV2Database (no server has opened the DB since this build)`,
  };
}

/**
 * Project directories recorded in the DB that no longer exist on disk.
 *
 * `project_dir` is an identity key derived from a path, so renaming a directory
 * silently orphans everything keyed to the old name. Renaming
 * `Tarrant County Makerspace` to `Tarrant-County-Makerspace` — spaces are awful
 * to `cd` into — stranded 16 entries and 15 vault notes, and a project-scoped
 * `ob_recall` from the real repo then returned about 60% of that project's
 * memory while looking exactly like a complete result.
 *
 * Asks the filesystem rather than guessing a normalization rule: this catches
 * any rename, move or deletion, where folding spaces to hyphens would corrupt
 * every project whose directory legitimately contains a space.
 *
 * **Warn, never issue.** A directory can be legitimately absent — an archived
 * project, a different machine, work that was never a repo — and only a person
 * knows whether a missing path means "renamed to that one" or "gone". Failing
 * the commit gate over history that is merely old would be the wrong trade.
 */
export function checkProjectDirsExist(dbPath: string): CheckResult {
  if (!existsSync(dbPath)) {
    return { name: "project-dirs", severity: "pass", message: "Knowledge DB absent — nothing to check" };
  }

  let rows: { p: string; c: number }[];
  try {
    const db = new Database(dbPath, { readonly: true, fileMustExist: true });
    rows = db
      .prepare(`
        SELECT project_dir AS p, COUNT(*) AS c FROM knowledge_index
        WHERE project_dir IS NOT NULL AND project_dir != '' AND project_dir LIKE '%/%'
        GROUP BY project_dir
      `)
      .all() as { p: string; c: number }[];
    db.close();
  } catch (err) {
    return { name: "project-dirs", severity: "warn", message: `Could not read knowledge DB: ${(err as Error).message}` };
  }

  const missing = rows.filter((r) => !existsSync(r.p)).sort((a, b) => b.c - a.c);
  if (missing.length === 0) {
    return { name: "project-dirs", severity: "pass", message: `All ${rows.length} project directories resolve on disk` };
  }

  const detail = missing.map((m) => `${m.p} (${m.c})`).join(", ");
  return {
    name: "project-dirs",
    severity: "warn",
    message:
      `${missing.length} project director${missing.length === 1 ? "y" : "ies"} no longer exist${missing.length === 1 ? "s" : ""} — ` +
      `entries are unreachable by project-scoped recall: ${detail}. ` +
      `Fold a renamed one forward with: open-brain relocate --from "<old>" --to "<new>" --apply`,
  };
}
