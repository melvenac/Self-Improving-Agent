import Database from "better-sqlite3";
import { existsSync, statSync } from "node:fs";
import { resolve } from "node:path";
import { initTriggerFires } from "./db-v2.js";
import {
  commandCellToString,
  formatCommandFireLog,
  isCanonicalCommandFireLog,
} from "./trigger/command-log.js";

export const SCRUB_HELD_STORE_MESSAGE =
  "another connection holds the store: stop the MCP server and close Claude Code sessions (hooks) first, then rerun";

export const SCRUB_READONLY_STORE_MESSAGE = "store is read-only";

function sqliteCode(err: unknown): string | undefined {
  if (err && typeof err === "object" && "code" in err) {
    return String((err as { code: string }).code);
  }
  return undefined;
}

function rethrowScrubOpenError(err: unknown): never {
  const code = sqliteCode(err);
  if (code === "SQLITE_READONLY") throw new Error(SCRUB_READONLY_STORE_MESSAGE);
  if (code === "SQLITE_BUSY" || code === "SQLITE_LOCKED") {
    throw new Error(SCRUB_HELD_STORE_MESSAGE);
  }
  const msg = err instanceof Error ? err.message : String(err);
  if (/readonly/i.test(msg)) throw new Error(SCRUB_READONLY_STORE_MESSAGE);
  if (/locked/i.test(msg)) throw new Error(SCRUB_HELD_STORE_MESSAGE);
  throw err;
}

export interface ScrubTriggerFiresResult {
  dbPath: string;
  rowsScanned: number;
  rowsRewritten: number;
  dryRun: boolean;
}

function assertAllCommandsCanonical(db: Database.Database): void {
  const rows = db.prepare("SELECT command FROM trigger_fires").all() as Array<{ command: unknown }>;
  for (const { command } of rows) {
    const stored = commandCellToString(command);
    if (!isCanonicalCommandFireLog(stored) || formatCommandFireLog(stored) !== stored) {
      throw new Error("scrub verification failed: not all trigger_fires.command values are canonical");
    }
  }
}

function freelistCount(db: Database.Database): number {
  return Number(db.pragma("freelist_count", { simple: true })) || 0;
}

function walCheckpointBusy(db: Database.Database): number {
  const rows = db.pragma("wal_checkpoint(TRUNCATE)") as Array<{ busy?: number }>;
  const busy = rows[0]?.busy;
  return typeof busy === "number" ? busy : -1;
}

function assertWalTruncated(dbPath: string): void {
  const walPath = `${dbPath}-wal`;
  if (!existsSync(walPath)) return;
  const size = statSync(walPath).size;
  if (size !== 0) {
    throw new Error(`scrub verification failed: WAL file is ${size} bytes (expected 0)`);
  }
}

function scanPending(db: Database.Database): {
  rowsScanned: number;
  pending: Array<{ id: number; after: string }>;
} {
  const select = db.prepare("SELECT id, command FROM trigger_fires");
  const pending: Array<{ id: number; after: string }> = [];
  let rowsScanned = 0;
  for (const row of select.iterate() as Iterable<{ id: number; command: unknown }>) {
    rowsScanned += 1;
    const before = commandCellToString(row.command);
    const after = formatCommandFireLog(before);
    if (after !== before) pending.push({ id: row.id, after });
  }
  return { rowsScanned, pending };
}

/**
 * Rewrite every `trigger_fires.command` to `formatCommandFireLog` and reclaim pages.
 * `dbPath` must already be resolved absolute. Throws on failure; CLI maps to exit 1.
 */
export function runScrubTriggerFires(
  dbPath: string,
  options: { dryRun?: boolean; busyTimeoutMs?: number } = {},
): ScrubTriggerFiresResult {
  const resolved = resolve(dbPath);
  const dryRun = options.dryRun ?? false;

  if (dryRun) {
    let db: Database.Database;
    try {
      db = new Database(resolved, { readonly: true, fileMustExist: true });
    } catch (err) {
      rethrowScrubOpenError(err);
    }
    try {
      const { rowsScanned, pending } = scanPending(db);
      return { dbPath: resolved, rowsScanned, rowsRewritten: pending.length, dryRun: true };
    } finally {
      db.close();
    }
  }

  let db: Database.Database;
  try {
    db = new Database(resolved, { fileMustExist: true });
    db.pragma(`busy_timeout = ${options.busyTimeoutMs ?? 5000}`);
    initTriggerFires(db);
  } catch (err) {
    rethrowScrubOpenError(err);
  }

  let rowsScanned = 0;
  let rowsRewritten = 0;
  try {
    const scanned = scanPending(db);
    rowsScanned = scanned.rowsScanned;
    const pending = scanned.pending;

    if (pending.length > 0) {
      const update = db.prepare("UPDATE trigger_fires SET command = ? WHERE id = ?");
      const apply = db.transaction(() => {
        for (const { id, after } of pending) update.run(after, id);
      });
      apply();
      rowsRewritten = pending.length;
    }

    assertAllCommandsCanonical(db);

    const needVacuum = rowsRewritten > 0 || freelistCount(db) > 0;
    if (needVacuum) {
      try {
        db.exec("VACUUM");
      } catch (err) {
        const code = sqliteCode(err);
        if (code === "SQLITE_READONLY") throw new Error(SCRUB_READONLY_STORE_MESSAGE);
        if (code === "SQLITE_BUSY" || code === "SQLITE_LOCKED") throw new Error(SCRUB_HELD_STORE_MESSAGE);
        throw new Error("scrub verification failed: VACUUM");
      }
    }

    const busy = walCheckpointBusy(db);
    if (busy !== 0) {
      throw new Error(`scrub verification failed: wal_checkpoint busy=${busy} (expected 0)`);
    }

    db.close();
    assertWalTruncated(resolved);
  } catch (err) {
    try {
      db.close();
    } catch {
      /* */
    }
    if (err instanceof Error && err.message.startsWith("scrub verification failed:")) throw err;
    if (err instanceof Error && err.message === SCRUB_HELD_STORE_MESSAGE) throw err;
    if (err instanceof Error && err.message === SCRUB_READONLY_STORE_MESSAGE) throw err;
    rethrowScrubOpenError(err);
  }

  return { dbPath: resolved, rowsScanned, rowsRewritten, dryRun: false };
}

export function printScrubTriggerFiresResult(result: ScrubTriggerFiresResult): void {
  console.log(result.dbPath);
  console.log(`rows scanned: ${result.rowsScanned}`);
  if (result.dryRun) {
    console.log(`would rewrite: ${result.rowsRewritten}`);
  } else {
    console.log(`rows rewritten: ${result.rowsRewritten}`);
  }
}
