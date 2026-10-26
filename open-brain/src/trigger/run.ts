/**
 * One invocation of the trigger, end to end: derive, query, record, decide
 * what (if anything) the model is told.
 *
 * This is the whole decision in one function so that the hook entry point has
 * no judgement of its own — the entry point reads stdin, calls this, prints.
 *
 * T-159: the hook no longer reaches this for a not-asked fire. It checks
 * `deriveQuery` itself and appends the fire to the pending file
 * (pending-fires.ts), which `reconcilePendingFires` moves into
 * `trigger_fires` later, so it never loads the store for half its calls. The
 * not-asked branch below stays for in-process callers and tests, and it
 * records the same row the reconcile does.
 */

import type Database from "better-sqlite3";
import { deriveQuery, queryStore } from "./query.js";
import { injectedIds, recordFire, type FireState } from "./fires.js";
import { commandMatchesKey, errorMatchesKey, parseCommandKey, parseErrorKey, parsePathKey, pathMatchesKey } from "./match-keys.js";
import type { TriggerPolicy } from "./policy.js";
import { entrySeat } from "./seat.js";

export interface TriggerRunInput {
  /** Writable: the fire record, and nothing else. */
  db: Database.Database;
  /**
   * Read-only handle for the query (brief §3). Defaults to `db` so tests and
   * in-process callers need only one connection; the hook passes a genuinely
   * read-only one so the query path CANNOT write even by mistake.
   */
  readDb?: Database.Database;
  sessionUuid: string;
  command: string;
  policy: TriggerPolicy;
  /** Ids the sidecar prefilter matched; re-tested here against the store (T-170). */
  keyIds?: number[];
  /** T-313: the session's seat (resolveTriggerSeat). An entry written for another seat does not fire; null fires all. */
  seat?: string | null;
  /** T-170 (ii): a failed call's error text, and the ids the sidecar's error keys matched in it (re-tested here). */
  error?: string;
  errorKeyIds?: number[];
  /** T-170 (iii): the file an Edit or Write call touched, and the ids the sidecar's path keys matched (re-tested here). */
  filePath?: string;
  pathKeyIds?: number[];
}

export interface TriggerOutcome {
  state: FireState;
  ids: number[];
  /**
   * The string to hand the host as `hookSpecificOutput.additionalContext`,
   * or `undefined` when there is nothing to say.
   *
   * `undefined`, not `""`. A5 as ruled in amendment 1 R2: on a silent fire
   * the KEY IS ABSENT — present-and-empty is a fail. Ruling 3's *silent means
   * silent* is about the channel, not just the content: a reminder saying
   * "no relevant entries" trains the reader to skip the channel, and an empty
   * one does the same thing while looking harmless.
   */
  additionalContext?: string;
}

/**
 * Pull the `ACTION:` field out of a vault experience.
 *
 * The vault template gives every experience `TRIGGER:` and `ACTION:` fields,
 * and `ACTION` is the part that is useful at the moment of the act — it says
 * what to do instead. §7.8 records that shape as a fact about the store, not
 * a design instruction, so this degrades rather than depends: an entry with
 * no `ACTION:` field contributes its first non-empty line instead.
 */
export function actionOf(content: string): string {
  const lines = content.split(/\r?\n/);
  const start = lines.findIndex((l) => /^\s*ACTION:/.test(l));
  if (start === -1) {
    return lines.find((l) => l.trim().length > 0)?.trim() ?? "";
  }
  const out = [lines[start].replace(/^\s*ACTION:\s*/, "").trim()];
  for (const line of lines.slice(start + 1)) {
    // Stop at the next FIELD: marker; keep wrapped continuation lines.
    if (/^\s*[A-Z][A-Z ]{2,}:/.test(line)) break;
    if (line.trim().length === 0) break;
    out.push(line.trim());
  }
  return out.join(" ").trim();
}

/**
 * Run the trigger for one command.
 *
 * Never throws for an ordinary miss — a miss is a state, not an error. The
 * caller wraps this so that a genuine failure (an unreadable store, a locked
 * database) leaves the tool call untouched and goes to the log rather than to
 * the model (A6, R3, R15).
 */
export function runTrigger(input: TriggerRunInput): TriggerOutcome {
  // T-170 (iii): a file event has no shell command to derive a query from.
  const derived = input.filePath !== undefined ? "" : deriveQuery(input.command);
  const keyIds = input.keyIds ?? [];
  const errorKeyIds = input.errorKeyIds ?? [];
  const pathKeyIds = input.pathKeyIds ?? [];

  if (!derived && keyIds.length === 0 && errorKeyIds.length === 0 && pathKeyIds.length === 0) {
    recordFire(input.db, {
      sessionUuid: input.sessionUuid,
      command: input.command,
      query: "",
      state: "not-asked",
      injectedIds: [],
    });
    return { state: "not-asked", ids: [] };
  }

  const readDb = input.readDb ?? input.db;
  // T-313: an entry written for one seat's ops skill does not fire for another seat. A skipped element hit keeps its
  // slot: the query's limit is unchanged, so a lower-ranked entry does not replace it.
  const seat = input.seat?.trim().toLowerCase() || null;
  const skipped: number[] = [];
  const tagsOf = readDb.prepare(`SELECT tags FROM knowledge_index WHERE id = ?`);
  const forOtherSeat = (h: { id: number; content: string }): boolean => {
    if (seat === null) return false;
    const owner = entrySeat(h.content, (tagsOf.get(h.id) as { tags: string | null } | undefined)?.tags ?? "");
    if (owner === null || owner === seat) return false;
    skipped.push(h.id);
    return true;
  };
  const found: Array<{ id: number; key: string | null; content: string }> = derived
    ? queryStore({
        db: readDb,
        command: input.command,
        floor: input.policy.relevance_floor,
        limit: input.policy.max_injected,
      })
    : [];
  const hits = found.filter((h) => !forOtherSeat(h));

  // T-170: keyed entries fill the slots the element path left. The sidecar
  // only prefiltered them, so each is re-read and re-tested here: a stale
  // sidecar can cost a miss, never a wrong injection. A keyed entry is
  // injected at most once per session, and no relevance floor applies — it is
  // not a bm25 match.
  if (hits.length < input.policy.max_injected && (keyIds.length > 0 || errorKeyIds.length > 0 || pathKeyIds.length > 0)) {
    const already = injectedIds(input.db, input.sessionUuid);
    const byId = readDb.prepare(
      `SELECT id, key, content FROM knowledge_index WHERE id = ? AND archived_into IS NULL`,
    );
    // T-170 (ii): an error key first. The failure's own text names the mistake more exactly than the command does.
    for (const id of errorKeyIds) {
      if (hits.length >= input.policy.max_injected) break;
      const row = byId.get(id) as { id: number; key: string | null; content: string } | undefined;
      if (!row) continue;
      const key = parseErrorKey(row.content);
      if (key === null || !errorMatchesKey(key, input.error ?? "")) continue;
      if (already.includes(row.id) || hits.some((h) => h.id === row.id)) continue;
      if (forOtherSeat(row)) continue;
      hits.push(row);
    }
    // T-170 (iii): a path key, re-tested against the file the call touched.
    for (const id of pathKeyIds) {
      if (hits.length >= input.policy.max_injected) break;
      const row = byId.get(id) as { id: number; key: string | null; content: string } | undefined;
      if (!row) continue;
      const glob = parsePathKey(row.content);
      if (glob === null || !pathMatchesKey(glob, input.filePath ?? "")) continue;
      if (already.includes(row.id) || hits.some((h) => h.id === row.id)) continue;
      if (forOtherSeat(row)) continue;
      hits.push(row);
    }
    for (const id of keyIds) {
      if (hits.length >= input.policy.max_injected) break;
      const row = byId.get(id) as { id: number; key: string | null; content: string } | undefined;
      if (!row) continue;
      const fragments = parseCommandKey(row.content);
      if (!fragments || !commandMatchesKey(fragments, input.command)) continue;
      if (already.includes(row.id) || hits.some((h) => h.id === row.id)) continue;
      if (forOtherSeat(row)) continue;
      hits.push(row);
    }
  }

  const query = [
    derived,
    keyIds.length ? `match:${keyIds.join(",")}` : "",
    errorKeyIds.length ? `error-match:${errorKeyIds.join(",")}` : "",
    pathKeyIds.length ? `path-match:${pathKeyIds.join(",")}` : "",
    skipped.length ? `seat-skip:${skipped.join(",")}` : "",
  ]
    .filter(Boolean)
    .join(" ");

  if (hits.length === 0) {
    recordFire(input.db, {
      sessionUuid: input.sessionUuid,
      command: input.command,
      query,
      state: "silent",
      injectedIds: [],
    });
    return { state: "silent", ids: [] };
  }

  const ids = hits.map((h) => h.id);
  recordFire(input.db, {
    sessionUuid: input.sessionUuid,
    command: input.command,
    query,
    state: "injected",
    injectedIds: ids,
  });

  const additionalContext = hits
    .map((h) => `[stored knowledge ${h.id}${h.key ? ` — ${h.key}` : ""}] ${actionOf(h.content)}`)
    .join("\n");

  return { state: "injected", ids, additionalContext };
}
