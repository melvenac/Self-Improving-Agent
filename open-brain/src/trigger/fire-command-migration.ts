import type Database from "better-sqlite3";
import {
  commandCellToString,
  isCanonicalCommandFireLog,
  migrateStoredCommandFireLog,
} from "./command-log.js";

export const TRIGGER_FIRE_COMMAND_MIGRATION_KEY = "trigger_fires_command_v2";

/** Rows that are definitely not canonical; JS re-checks before UPDATE. */
export const NON_CANONICAL_TRIGGER_FIRE_SQL = `
  SELECT id, command FROM trigger_fires
  WHERE command IS NULL
     OR command != '?'
     AND (
       length(command) > 25
       OR instr(command, ' ') > 0
       OR instr(command, '#') > 0
       OR command NOT GLOB '[a-z]*'
     )
`;

export function ensureObStoreMetaTable(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS ob_store_meta (
      key TEXT PRIMARY KEY NOT NULL,
      value TEXT NOT NULL
    );
  `);
}

export function isTriggerFireCommandMigrationDone(db: Database.Database): boolean {
  ensureObStoreMetaTable(db);
  const row = db
    .prepare("SELECT value FROM ob_store_meta WHERE key = ?")
    .get(TRIGGER_FIRE_COMMAND_MIGRATION_KEY) as { value: string } | undefined;
  return row?.value === "1";
}

function markTriggerFireCommandMigrationDone(db: Database.Database): void {
  ensureObStoreMetaTable(db);
  db.prepare(
    "INSERT OR REPLACE INTO ob_store_meta (key, value) VALUES (?, '1')",
  ).run(TRIGGER_FIRE_COMMAND_MIGRATION_KEY);
}

function reclaimFreedPages(db: Database.Database): void {
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      db.exec("VACUUM");
      db.pragma("wal_checkpoint(TRUNCATE)");
      return;
    } catch {
      if (attempt === 2) return;
    }
  }
}

/**
 * Rewrite non-canonical `trigger_fires.command` values in one transaction.
 * Returns how many rows were updated. May throw (caller must catch).
 */
export function migrateTriggerFireCommands(db: Database.Database): number {
  const select = db.prepare(NON_CANONICAL_TRIGGER_FIRE_SQL);
  const pending: Array<{ id: number; after: string }> = [];
  for (const row of select.iterate() as Iterable<{ id: number; command: unknown }>) {
    const before = commandCellToString(row.command);
    if (isCanonicalCommandFireLog(before)) continue;
    const after = migrateStoredCommandFireLog(before);
    if (after !== before) pending.push({ id: row.id, after });
  }
  if (pending.length === 0) return 0;
  const update = db.prepare("UPDATE trigger_fires SET command = ? WHERE id = ?");
  const migrate = db.transaction(() => {
    for (const { id, after } of pending) update.run(after, id);
  });
  migrate();
  return pending.length;
}

function migrationErrorCode(err: unknown): string | undefined {
  if (err && typeof err === "object" && "code" in err) {
    return String((err as { code: string }).code);
  }
  return undefined;
}

/**
 * Best-effort migration + WAL reclaim. Never throws; logs one line on failure.
 */
export function runTriggerFireCommandMigration(db: Database.Database): void {
  try {
    ensureObStoreMetaTable(db);
    if (isTriggerFireCommandMigrationDone(db)) return;

    const updated = migrateTriggerFireCommands(db);
    if (updated > 0) reclaimFreedPages(db);
    markTriggerFireCommandMigrationDone(db);
  } catch (err) {
    const code = migrationErrorCode(err) ?? "unknown";
    const message = err instanceof Error ? err.message : String(err);
    console.error(
      `[open-brain] trigger_fires.command migration skipped (${code}): ${message}`,
    );
  }
}
