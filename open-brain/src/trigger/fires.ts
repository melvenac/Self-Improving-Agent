/**
 * The fire record — every invocation of the trigger, in one of three states.
 *
 * Brief §2's mandatory repair, and R16. `ob_recalled` reporting *no knowledge
 * entries recalled this session* could not distinguish **nothing asked** from
 * **asked, and nothing relevant**, and for five loops that silence was read
 * as inconclusive when it was the answer (`G-039`). The same defect in the
 * memory layer that rule 11 names everywhere else: an instrument that cannot
 * tell "nothing there" from "I did not look".
 *
 * So after this loop every fire is recorded whether or not it surfaced
 * anything, and the three states are counted separately:
 *
 *   - **not-asked** — no element of the command was recognised. The store was
 *     never consulted. This is the overwhelming majority of `Bash` calls and
 *     it is the number that says how narrow the derivation is.
 *   - **silent** — the store WAS consulted and nothing cleared the floor.
 *     This is the number that says whether the floor is set sensibly.
 *   - **injected** — ids went to the model, and only these are rateable at
 *     `/end` (ruling 6).
 *
 * Fires, hits and injections are three different counts and the record can
 * now show all three.
 *
 * ## What this module may write, and what it may not
 *
 * It writes `trigger_fires` and, for an injection, `recall_log` with the
 * `hook` trigger value. It writes nothing else. The store is otherwise opened
 * read-only by the query path: a trigger that runs on every `Bash` call and
 * can write anything it likes is a new channel into the memory half with no
 * seat behind it (brief §3).
 */

import { appendFileSync, readdirSync, readFileSync, renameSync, unlinkSync } from "node:fs";
import { basename, dirname, join } from "node:path";
import type Database from "better-sqlite3";
import { recordRecallEvent } from "../db-v2.js";
import { formatCommandFireLog } from "./command-log.js";
import { parsePendingFireLine } from "./pending-fires.js";

/** The three states of one invocation. See the module header. */
export type FireState = "not-asked" | "silent" | "injected";

export interface FireRecord {
  sessionUuid: string;
  /** The command text the hook was invoked for. */
  command: string;
  /** The derived FTS expression — empty exactly when the state is `not-asked`. */
  query: string;
  state: FireState;
  /** Ids injected, in rank order. Empty unless the state is `injected`. */
  injectedIds: number[];
}

/**
 * Record one invocation, and — only for an injection — the recall itself.
 *
 * The two writes are one transaction. A fire recorded as `injected` whose
 * `recall_log` rows are missing would make the entry unrateable at `/end`
 * while the census says it reached the agent; the opposite would put an
 * unaccounted-for row in the rated set. Neither half is useful alone.
 */
export function recordFire(db: Database.Database, fire: FireRecord): void {
  if (!fire.sessionUuid) return;

  // Guard the contract the DDL cannot express: the state and the ids must
  // agree. A caller that says `injected` with no ids has lost the ids
  // somewhere, and recording that as an injection would inflate the count
  // that answers this loop's question.
  if (fire.state === "injected" && fire.injectedIds.length === 0) {
    throw new Error("recordFire: state 'injected' with no ids — the injection is the ids");
  }
  if (fire.state !== "injected" && fire.injectedIds.length > 0) {
    throw new Error(`recordFire: state '${fire.state}' with ${fire.injectedIds.length} id(s) — only an injection carries ids`);
  }
  if (fire.state === "not-asked" && fire.query !== "") {
    throw new Error("recordFire: state 'not-asked' with a query — a derived query means the store was asked");
  }

  const now = new Date().toISOString();
  const commandLog = formatCommandFireLog(fire.command);
  const insert = db.prepare(
    `INSERT INTO trigger_fires (session_uuid, command, query, state, injected_ids, created_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
  );

  db.transaction(() => {
    insert.run(fire.sessionUuid, commandLog, fire.query, fire.state, JSON.stringify(fire.injectedIds), now);
    if (fire.state === "injected") {
      // `hook`, never `explicit`: nobody asked. R6, and the reason is in
      // db-v2's RECALL_TRIGGERS comment.
      recordRecallEvent(db, fire.sessionUuid, fire.query, fire.injectedIds, "hook");

      // R7 (amendment 1): an INJECTED entry bumps the recall counters; a
      // looked-at one does not. The counter means "this reached an agent",
      // and an injected entry did — it was put in front of a seat beside a
      // tool result. An entry the query considered and the floor excluded was
      // never in front of anyone, and counting it would inflate exactly the
      // number `/start`'s pruning maintenance reads when it asks which
      // entries have never been recalled.
      //
      // Nothing else in this file writes to `knowledge_index`, and the query
      // path holds a read-only handle, so "looked-at does not bump" is
      // structural rather than a rule this code remembers to follow.
      //
      // `datetime('now')` rather than the ISO string above, to match what
      // `ob_recall` writes into the same column — two writers of one column
      // disagreeing on format is a defect this repo has paid for elsewhere.
      const bump = db.prepare(
        `UPDATE knowledge_index
            SET recall_count = COALESCE(recall_count, 0) + 1,
                last_recalled_at = datetime('now')
          WHERE id = ?`,
      );
      for (const id of fire.injectedIds) bump.run(id);
    }
  })();
}

/**
 * A claim file is removed only on a LATER run once it is at least this old: a
 * hook that opened the pending file before the rename may still append to the
 * claim, and the re-read before removal is what picks that line up.
 */
export const STALE_CLAIM_MS = 10 * 60 * 1000;

export interface ReconcileResult {
  inserted: number;
  duplicate: number;
  unreadable: number;
}

export interface ReconcileOptions {
  /** The clock stale claims are judged against. Defaults to now. */
  now?: Date;
  /** Test seam: runs after the claimed text is read, where a late hook's append lands. */
  afterClaim?: (claimedPath: string) => void;
}

const CLAIM_RE = /\.claim-\d+-(\d+)$/;

/**
 * T-159: move the hook's not-asked lines (pending-fires.ts) into
 * `trigger_fires`. Every session's lines, since each carries its own session
 * and time; at SessionEnd and at `ob_end`.
 *
 * The file is claimed by rename (the `claimMarker` shape), so two reconcilers
 * never read the same live file and a hook appending afterwards starts a new
 * one. A hook that opened the file BEFORE the rename writes into the claim
 * instead, so a claim is kept and re-read, de-duplicated, by a later run once
 * it is `STALE_CLAIM_MS` old, and only then removed. The insert is
 * `WHERE NOT EXISTS` on the whole line, which makes a re-read, a re-append and
 * two concurrent reconcilers all harmless. On a DB error nothing was
 * committed, so the claimed text is appended back to the live file.
 */
export function reconcilePendingFires(
  db: Database.Database,
  path: string,
  opts: ReconcileOptions = {},
): ReconcileResult {
  const nowMs = (opts.now ?? new Date()).getTime();
  const result: ReconcileResult = { inserted: 0, duplicate: 0, unreadable: 0 };

  // Claims from earlier runs, old enough that no hook can still be writing.
  const stale: Array<{ path: string; text: string }> = [];
  const prefix = `${basename(path)}.claim-`;
  let names: string[] = [];
  try {
    names = readdirSync(dirname(path));
  } catch {
    /* no directory, so nothing pending */
  }
  for (const name of names) {
    if (!name.startsWith(prefix)) continue;
    const m = CLAIM_RE.exec(name);
    if (!m || nowMs - Number(m[1]) < STALE_CLAIM_MS) continue;
    const full = join(dirname(path), name);
    try {
      stale.push({ path: full, text: readFileSync(full, "utf-8") });
    } catch {
      /* another reconciler removed it */
    }
  }

  let claimed: string | null = `${path}.claim-${process.pid}-${Date.now()}`;
  try {
    renameSync(path, claimed);
  } catch {
    claimed = null; // nothing pending, or another reconciler took it
  }
  const fresh = claimed ? readFileSync(claimed, "utf-8") : "";
  if (claimed) opts.afterClaim?.(claimed);

  const insert = db.prepare(
    `INSERT INTO trigger_fires (session_uuid, command, query, state, injected_ids, created_at)
     SELECT ?, ?, '', 'not-asked', '[]', ?
      WHERE NOT EXISTS (
        SELECT 1 FROM trigger_fires
         WHERE session_uuid = ? AND created_at = ? AND command = ? AND state = 'not-asked')`,
  );
  const apply = (text: string, count: boolean): void => {
    for (const line of text.split(/\r?\n/)) {
      if (!line.trim()) continue;
      const fire = parsePendingFireLine(line);
      if (!fire) {
        if (count) result.unreadable++;
        continue;
      }
      const r = insert.run(fire.session_uuid, fire.command, fire.created_at, fire.session_uuid, fire.created_at, fire.command);
      if (r.changes > 0) result.inserted++;
      else if (count) result.duplicate++;
    }
  };

  try {
    db.transaction(() => {
      apply(fresh, true);
      // A stale claim was counted when it was claimed; only a late line in it is new.
      for (const s of stale) apply(s.text, false);
    }).immediate();
  } catch (err) {
    if (fresh) {
      try {
        appendFileSync(path, fresh.endsWith("\n") ? fresh : `${fresh}\n`, "utf-8");
      } catch {
        /* the claim file still holds it, and a later run re-reads it */
      }
    }
    throw err;
  }

  for (const s of stale) {
    try {
      unlinkSync(s.path);
    } catch {
      /* already gone */
    }
  }
  return result;
}

/** The one line SessionEnd and `ob_end` print for a reconcile. */
export function formatReconcileLine(r: ReconcileResult): string {
  if (r.inserted + r.duplicate + r.unreadable === 0) return "trigger fires: nothing pending";
  return `trigger fires: ${r.inserted} not-asked fire(s) reconciled (${r.duplicate} already recorded, ${r.unreadable} unreadable line(s) not reconciled)`;
}

/** The three counts for one session — A8's census. */
export function fireCounts(db: Database.Database, sessionUuid: string): Record<FireState, number> {
  const counts: Record<FireState, number> = { "not-asked": 0, silent: 0, injected: 0 };
  if (!sessionUuid) return counts;

  const rows = db
    .prepare(`SELECT state, COUNT(*) AS n FROM trigger_fires WHERE session_uuid = ? GROUP BY state`)
    .all(sessionUuid) as Array<{ state: FireState; n: number }>;

  for (const row of rows) counts[row.state] = row.n;
  return counts;
}

/** Ids this session's trigger actually injected, in first-seen order. */
export function injectedIds(db: Database.Database, sessionUuid: string): number[] {
  if (!sessionUuid) return [];
  const rows = db
    .prepare(
      `SELECT injected_ids FROM trigger_fires
        WHERE session_uuid = ? AND state = 'injected' ORDER BY id`,
    )
    .all(sessionUuid) as Array<{ injected_ids: string }>;

  const seen: number[] = [];
  for (const row of rows) {
    for (const id of JSON.parse(row.injected_ids) as number[]) {
      if (!seen.includes(id)) seen.push(id);
    }
  }
  return seen;
}
