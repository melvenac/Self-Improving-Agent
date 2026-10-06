import Database from "better-sqlite3";
import { existsSync, readFileSync } from "node:fs";
import { initTriggerFires } from "./db-v2.js";
import { commandCellToString, formatCommandFireLog } from "./trigger/command-log.js";

export const SCRUB_HELD_STORE_MESSAGE =
  "another connection holds the store: stop the MCP server and hooks, then rerun";

function isStoreHeldError(err: unknown): boolean {
  if (err && typeof err === "object" && "code" in err) {
    const code = String((err as { code: string }).code);
    if (code === "SQLITE_BUSY" || code === "SQLITE_LOCKED" || code === "SQLITE_READONLY") {
      return true;
    }
  }
  const msg = err instanceof Error ? err.message : String(err);
  return /locked|readonly/i.test(msg);
}

function failIfStoreHeld(err: unknown): never {
  if (isStoreHeldError(err)) throw new Error(SCRUB_HELD_STORE_MESSAGE);
  throw err;
}

export interface ScrubTriggerFiresResult {
  rowsScanned: number;
  rowsRewritten: number;
  bytesFoundAfter: number;
}

function countSecretBytes(paths: string[], needles: string[]): number {
  let hits = 0;
  for (const p of paths) {
    if (!existsSync(p)) continue;
    const buf = readFileSync(p);
    for (const needle of needles) {
      if (needle.length === 0) continue;
      if (buf.includes(needle)) hits += 1;
    }
  }
  return hits;
}

function walCheckpointBusy(db: Database.Database): number {
  const rows = db.pragma("wal_checkpoint(TRUNCATE)") as Array<{ busy?: number }>;
  const busy = rows[0]?.busy;
  return typeof busy === "number" ? busy : -1;
}

/**
 * Rewrite every `trigger_fires.command` to `formatCommandFireLog` and reclaim pages.
 * Exits via thrown errors; CLI maps them to stderr + exit 1.
 */
export function runScrubTriggerFires(
  dbPath: string,
  options: { dryRun?: boolean; busyTimeoutMs?: number } = {},
): ScrubTriggerFiresResult {
  const dryRun = options.dryRun ?? false;
  let db: Database.Database;
  try {
    db = new Database(dbPath);
    db.pragma(`busy_timeout = ${options.busyTimeoutMs ?? 5000}`);
    initTriggerFires(db);
  } catch (err) {
    failIfStoreHeld(err);
  }

  const select = db.prepare("SELECT id, command FROM trigger_fires");
  const pending: Array<{ id: number; before: string; after: string }> = [];
  let rowsScanned = 0;

  try {
    for (const row of select.iterate() as Iterable<{ id: number; command: unknown }>) {
      rowsScanned += 1;
      const before = commandCellToString(row.command);
      const after = formatCommandFireLog(before);
      if (after !== before) pending.push({ id: row.id, before, after });
    }
  } catch (err) {
    db.close();
    failIfStoreHeld(err);
  }

  const replacedValues = pending.map((p) => p.before);

  if (dryRun) {
    db.close();
    return { rowsScanned, rowsRewritten: pending.length, bytesFoundAfter: 0 };
  }

  try {
    if (pending.length > 0) {
      const update = db.prepare("UPDATE trigger_fires SET command = ? WHERE id = ?");
      const apply = db.transaction(() => {
        for (const { id, after } of pending) update.run(after, id);
      });
      apply();
    }

    db.exec("VACUUM");

    const busy = walCheckpointBusy(db);
    if (busy !== 0) throw new Error(SCRUB_HELD_STORE_MESSAGE);
  } catch (err) {
    db.close();
    if (err instanceof Error && err.message === SCRUB_HELD_STORE_MESSAGE) throw err;
    failIfStoreHeld(err);
  }

  db.close();

  const paths = [dbPath, `${dbPath}-wal`, `${dbPath}-shm`];
  const bytesFoundAfter = countSecretBytes(paths, replacedValues);
  if (bytesFoundAfter !== 0) {
    throw new Error(`scrub verification failed: ${bytesFoundAfter} replaced value(s) still on disk`);
  }

  return { rowsScanned, rowsRewritten: pending.length, bytesFoundAfter: 0 };
}

export function printScrubTriggerFiresResult(result: ScrubTriggerFiresResult): void {
  console.log(`rows scanned: ${result.rowsScanned}`);
  console.log(`rows rewritten: ${result.rowsRewritten}`);
  console.log(`bytes found after: ${result.bytesFoundAfter}`);
}
