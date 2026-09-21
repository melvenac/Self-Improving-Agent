/**
 * One invocation of the trigger, end to end: derive, query, record, decide
 * what (if anything) the model is told.
 *
 * This is the whole decision in one function so that the hook entry point has
 * no judgement of its own — the entry point reads stdin, calls this, prints.
 * The three states of R16 are produced here and nowhere else, so there is one
 * place where "was the store asked" is answered.
 */

import type Database from "better-sqlite3";
import { deriveQuery, queryStore } from "./query.js";
import { recordFire, type FireState } from "./fires.js";
import type { TriggerPolicy } from "./policy.js";

export interface TriggerRunInput {
  db: Database.Database;
  sessionUuid: string;
  command: string;
  policy: TriggerPolicy;
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
  const query = deriveQuery(input.command);

  if (!query) {
    recordFire(input.db, {
      sessionUuid: input.sessionUuid,
      command: input.command,
      query: "",
      state: "not-asked",
      injectedIds: [],
    });
    return { state: "not-asked", ids: [] };
  }

  const hits = queryStore({
    db: input.db,
    command: input.command,
    floor: input.policy.relevance_floor,
    limit: input.policy.max_injected,
  });

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
