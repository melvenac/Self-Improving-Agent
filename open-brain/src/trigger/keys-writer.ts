/**
 * T-170: write the recall trigger's key sidecar from the store.
 *
 * The hook reads this file instead of the store so a command that asks nothing
 * loads no better-sqlite3 (T-159). It is written to a temp name and renamed
 * onto the real one, so a reader never sees half a file.
 */

import { renameSync, unlinkSync, writeFileSync } from "node:fs";
import type Database from "better-sqlite3";
import { parseCommandKey, type CommandKey } from "./match-keys.js";

const COMMAND_LINE = /^MATCH:\s*command:/m;

export function writeTriggerKeys(db: Database.Database, path: string): { written: number; unusable: number } {
  const rows = db
    .prepare(
      `SELECT id, content FROM knowledge_index
        WHERE archived_into IS NULL AND content LIKE '%MATCH:%' ORDER BY id`,
    )
    .all() as Array<{ id: number; content: string }>;

  const keys: CommandKey[] = [];
  let unusable = 0;
  for (const row of rows) {
    if (!COMMAND_LINE.test(row.content)) continue;
    const fragments = parseCommandKey(row.content);
    if (fragments) keys.push({ id: row.id, fragments });
    else unusable++;
  }

  const tmp = `${path}.tmp-${process.pid}`;
  writeFileSync(tmp, JSON.stringify({ generated_at: new Date().toISOString(), keys }), "utf-8");
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
