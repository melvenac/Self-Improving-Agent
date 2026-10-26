/**
 * T-170: write the recall trigger's key sidecar from the store.
 *
 * The hook reads this file instead of the store so a command that asks nothing
 * loads no better-sqlite3 (T-159). It is written to a temp name and renamed
 * onto the real one, so a reader never sees half a file.
 */

import { renameSync, unlinkSync, writeFileSync } from "node:fs";
import type Database from "better-sqlite3";
import { parseCommandKey, parseErrorKey, parsePathKey, type CommandKey, type ErrorKey, type PathKey } from "./match-keys.js";

const COMMAND_LINE = /^MATCH:\s*command:/m;
const ERROR_LINE = /^MATCH:\s*error:/m;
const PATH_LINE = /^MATCH:\s*path:/m;

export function writeTriggerKeys(db: Database.Database, path: string): { written: number; unusable: number } {
  const rows = db
    .prepare(
      `SELECT id, content FROM knowledge_index
        WHERE archived_into IS NULL AND content LIKE '%MATCH:%' ORDER BY id`,
    )
    .all() as Array<{ id: number; content: string }>;

  const keys: CommandKey[] = [];
  // T-170 (ii, iii): error and path keys ride the same file. The counts returned stay the command keys'.
  const errorKeys: ErrorKey[] = [];
  const pathKeys: PathKey[] = [];
  let unusable = 0;
  for (const row of rows) {
    if (ERROR_LINE.test(row.content)) {
      const text = parseErrorKey(row.content);
      if (text !== null) errorKeys.push({ id: row.id, text });
    }
    if (PATH_LINE.test(row.content)) {
      const glob = parsePathKey(row.content);
      if (glob !== null) pathKeys.push({ id: row.id, glob });
    }
    if (!COMMAND_LINE.test(row.content)) continue;
    const fragments = parseCommandKey(row.content);
    if (fragments) keys.push({ id: row.id, fragments });
    else unusable++;
  }

  const tmp = `${path}.tmp-${process.pid}`;
  writeFileSync(tmp, JSON.stringify({ generated_at: new Date().toISOString(), keys, errorKeys, pathKeys }), "utf-8");
  try {
    renameSync(tmp, path);
  } catch (err) {
    try {
      unlinkSync(tmp);
    } catch {
      /* already gone */
    }
    throw err;
  }
  return { written: keys.length, unusable };
}
