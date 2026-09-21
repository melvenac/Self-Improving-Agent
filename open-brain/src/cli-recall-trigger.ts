#!/usr/bin/env node

/**
 * PostToolUse hook entry point — the recall trigger.
 *
 * A third sibling of `cli-bootstrap.ts` and `cli-session-end.ts`, not of
 * `server.ts`: it reads a hook payload from stdin, does one thing, prints,
 * and exits. It holds no judgement of its own — `runTrigger` decides
 * everything and this file is the edge.
 *
 * ## PostToolUse, and why not PreToolUse (R1)
 *
 * Both events accept `hookSpecificOutput.additionalContext`, and both insert
 * it next to the tool result. They differ in whether blocking is POSSIBLE:
 * the hooks reference's exit-code table gives `PreToolUse` "Yes — blocks the
 * tool call" and `PostToolUse` "No — shows stderr to Claude; the tool already
 * ran". `PreToolUse` also honours `permissionDecision` and `updatedInput`;
 * `PostToolUse` honours neither.
 *
 * Brief ruling 2 says the trigger never blocks. On `PreToolUse` that is a
 * promise this code keeps; on `PostToolUse` the host cannot honour a block
 * even if this code emitted one. Deterministic-first: prefer the event where
 * the property is structural. The moment is right for this act anyway — the
 * damage in G-039 is done when the seat READS the trimmed output and the `0`,
 * and that is exactly where the reminder lands.
 *
 * ## Fails silent to the model, loud to the log (A6, R3, R15)
 *
 * Every failure path — no store, a locked store, a bad payload, a slow query
 * past the deadline — ends the same way: **exit 0, nothing on stdout, nothing
 * on stderr, one line in the log file.** Exit 0 matters because a
 * `PostToolUse` hook that exits non-zero has its stderr SHOWN TO THE MODEL, so
 * a stack trace would be an injection through the other channel. The tool call
 * itself is out of reach by then and cannot be affected either way.
 *
 * The log is `recall-trigger.log`, beside the store.
 */

import { appendFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { homedir } from "node:os";
import Database from "better-sqlite3";
import { initTriggerFires } from "./db-v2.js";
import { loadPolicy } from "./trigger/policy.js";
import { runTrigger } from "./trigger/run.js";

const DB_PATH = process.env.KNOWLEDGE_V2_DB || join(homedir(), ".claude", "open-brain", "knowledge-v2.db");
const LOG_PATH = process.env.RECALL_TRIGGER_LOG || join(dirname(DB_PATH), "recall-trigger.log");

/**
 * The only thing this process ever says about a failure.
 *
 * Best-effort by design: if the log itself cannot be written there is nowhere
 * left to complain to, and complaining on stderr is the one thing that would
 * reach the model.
 */
function logFailure(what: string, err?: unknown): void {
  const detail = err instanceof Error ? err.message : err === undefined ? "" : String(err);
  try {
    appendFileSync(LOG_PATH, `${new Date().toISOString()} ${what}${detail ? `: ${detail}` : ""}\n`, "utf-8");
  } catch {
    /* nowhere left to say it, and stderr is not an option */
  }
}

async function main(): Promise<void> {
  const started = Date.now();

  let raw = "";
  try {
    const chunks: Buffer[] = [];
    for await (const chunk of process.stdin) chunks.push(chunk as Buffer);
    raw = Buffer.concat(chunks).toString().trim();
  } catch (err) {
    logFailure("stdin unreadable", err);
    return;
  }
  if (!raw) {
    logFailure("empty payload");
    return;
  }

  let payload: Record<string, unknown>;
  try {
    payload = JSON.parse(raw) as Record<string, unknown>;
  } catch (err) {
    // Unlike SessionStart (F4), a malformed payload here is NOT a refusal
    // with a non-zero exit: this hook runs after every tool call, and a host
    // that malforms payloads would turn a memory feature into a wall of
    // stderr in front of the model. Logged and dropped.
    logFailure("payload is not valid JSON", err);
    return;
  }

  if (payload.tool_name !== "Bash") return;

  const command = (payload.tool_input as Record<string, unknown> | undefined)?.command;
  if (typeof command !== "string" || command.trim() === "") return;

  const sessionUuid = typeof payload.session_id === "string" ? payload.session_id : "";
  if (!sessionUuid) {
    // No session means the fire cannot be keyed to anything, and an
    // unattributable fire is worse than none: it would inflate the census
    // this loop exists to make trustworthy.
    logFailure("no session_id in payload — fire not recorded");
    return;
  }

  let policy;
  try {
    // The directory override exists for A6's deadline case and for QA:
    // pointing the hook at a different policy directory is how the floor and
    // the deadline are changed WITHOUT a source change (ruling 5).
    policy = loadPolicy(process.env.TRIGGER_POLICY_DIR || undefined);
  } catch (err) {
    logFailure("policy unreadable", err);
    return;
  }

  // Two connections, deliberately (brief §3). The query path gets a
  // READ-ONLY handle so it cannot write even by mistake; the fire record gets
  // the writable one. `fileMustExist` keeps a missing store a failure rather
  // than letting better-sqlite3 helpfully create an empty one and report a
  // clean miss — a new empty database is indistinguishable from a store with
  // nothing relevant, and that is the exact confusion this loop exists to end.
  let readDb: Database.Database | undefined;
  let writeDb: Database.Database | undefined;
  try {
    // `fileMustExist` is the ONLY guard on an absent store, deliberately.
    // There was an existsSync check here too, and a mutant that turned this
    // flag off survived the whole file because the earlier check answered
    // first — a redundant guard makes the real one untestable. One guard,
    // and a missing store is a refusal rather than a helpfully created empty
    // database that would report a clean miss forever.
    readDb = new Database(DB_PATH, { readonly: true, fileMustExist: true });

    // NOT openV2Database. That runs the column migrations and the
    // project_dir canonicalisation, both of which walk the whole store —
    // acceptable once per server start, absurd after every Bash call. And it
    // would set no busy timeout until after those writes, so a locked store
    // would block this hook for the default five seconds while the seat
    // waits. Plain open, timeout to zero FIRST, then the one table this hook
    // needs. A locked store now fails immediately, which is what A6 asserts.
    writeDb = new Database(DB_PATH);
    writeDb.pragma("busy_timeout = 0");
    initTriggerFires(writeDb);

    const outcome = runTrigger({ db: writeDb, readDb, sessionUuid, command, policy });

    // The deadline is checked HERE, after the synchronous work, and it
    // governs only whether the result may still be emitted. A reminder that
    // arrives after the seat has read the result and moved on is attached to
    // the wrong moment; the host's own `timeout` is what bounds the duration.
    const elapsed = Date.now() - started;
    if (elapsed > policy.deadline_ms) {
      logFailure(`deadline exceeded (${elapsed}ms > ${policy.deadline_ms}ms) — not emitting`);
      return;
    }

    if (outcome.additionalContext === undefined) return;

    // The key is present ONLY on an injection (A5, R2). No decision fields,
    // ever: `permissionDecision` and `updatedInput` are ignored on this event,
    // and emitting one would still be a claim this hook has no business
    // making.
    process.stdout.write(
      `${JSON.stringify({
        hookSpecificOutput: {
          hookEventName: "PostToolUse",
          additionalContext: outcome.additionalContext,
        },
      })}\n`,
    );
  } catch (err) {
    logFailure("trigger failed", err);
  } finally {
    try { readDb?.close(); } catch { /* closing a failed open */ }
    try { writeDb?.close(); } catch { /* closing a failed open */ }
  }
}

main().then(
  () => process.exit(0),
  (err) => {
    // Nothing should reach here; if it does, it still exits 0. A non-zero
    // exit on PostToolUse puts stderr in front of the model.
    logFailure("unhandled", err);
    process.exit(0);
  },
);
