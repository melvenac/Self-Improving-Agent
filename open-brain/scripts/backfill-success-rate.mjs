#!/usr/bin/env node
/**
 * Backfill `success_rate` onto knowledge_index rows written before v0.15.0.
 *
 * Two populations need correcting:
 *
 *   NULL   — updateFeedbackV2 bumped the counter column and never computed a
 *            rate, so 304 of 364 rows carried NULL. `NULL < 0.3` is never true,
 *            which is what made apoptosis unreachable independently of the
 *            missing `harmful` vocabulary.
 *
 *   stale  — a handful of rows follow helpful/(helpful+harmful+neutral), the
 *            formula the old test mock used. lifecycle.ts and
 *            apoptosisFlaggedExpr both exclude neutral, so those rows are
 *            scored against a definition nothing else in the system shares.
 *
 * This script only recomputes. It deliberately does NOT prune, archive, or flag
 * anything: every counter in the DB was recorded while the negative signal was
 * unreachable, so a low rate today reflects a broken instrument rather than a
 * bad entry. Ratings gathered from here on are the ones worth acting on.
 *
 * Usage:
 *   node scripts/backfill-success-rate.mjs [--apply]
 *
 * Defaults to a dry run; pass --apply to write.
 */
import Database from "better-sqlite3";
import { homedir } from "os";
import { join } from "path";

const DB_PATH =
  process.env.KNOWLEDGE_V2_DB ||
  join(homedir(), ".claude", "open-brain", "knowledge-v2.db");

const apply = process.argv.includes("--apply");

const db = new Database(DB_PATH);

// Canonical definition — mirrors evaluateLifecycle (lifecycle.ts) and
// apoptosisFlaggedExpr: neutral counts toward neither side.
const canonical = (helpful, harmful) =>
  helpful + harmful > 0 ? helpful / (helpful + harmful) : null;

const rows = db
  .prepare(
    `SELECT id, key, helpful, harmful, neutral, success_rate FROM knowledge_index`
  )
  .all();

const changes = [];
for (const r of rows) {
  const want = canonical(r.helpful, r.harmful);
  const have = r.success_rate;
  const differs =
    want === null
      ? have !== null
      : have === null || Math.abs(have - want) > 1e-9;
  if (differs) changes.push({ ...r, want });
}

console.log(`DB: ${DB_PATH}`);
console.log(`Rows: ${rows.length}   Needing correction: ${changes.length}`);

const nulled = changes.filter((c) => c.success_rate === null).length;
const restated = changes.length - nulled;
console.log(`  never computed (NULL): ${nulled}`);
console.log(`  computed under the old formula: ${restated}`);

if (restated > 0) {
  console.log(`\nRestated rows:`);
  for (const c of changes.filter((c) => c.success_rate !== null).slice(0, 20)) {
    console.log(
      `  [${c.id}] ${String(c.key ?? "no key").slice(0, 40).padEnd(42)}` +
        `h=${c.helpful} hm=${c.harmful} nt=${c.neutral}   ` +
        `${c.success_rate.toFixed(3)} -> ${c.want === null ? "NULL" : c.want.toFixed(3)}`
    );
  }
}

// What this would mean for apoptosis, reported but not acted on.
const wouldFlag = changes.filter(
  (c) => c.want !== null && c.want < 0.3 && c.helpful + c.harmful >= 5
);
console.log(
  `\nRows that would sit below the apoptosis threshold afterwards: ${wouldFlag.length}` +
    (wouldFlag.length
      ? ` (reported only — nothing is pruned or flagged by this script)`
      : ``)
);

if (!apply) {
  console.log(`\nDry run. Re-run with --apply to write these ${changes.length} rows.`);
  db.close();
  process.exit(0);
}

const update = db.prepare(
  `UPDATE knowledge_index SET success_rate = ?, updated_at = ? WHERE id = ?`
);
const now = new Date().toISOString();
const run = db.transaction((list) => {
  for (const c of list) update.run(c.want, now, c.id);
});
run(changes);

console.log(`\nApplied. ${changes.length} rows updated.`);
db.close();
