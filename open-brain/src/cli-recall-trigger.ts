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
 *
 * ## The not-asked fast path (T-159)
 *
 * Half of all fires derive no query. Those load nothing heavy: the static
 * imports below are node builtins, `deriveQuery` (whose module takes
 * better-sqlite3 as a type only), `pending-fires.ts` and `match-keys.ts` (the
 * T-170 key sidecar, read as JSON), and a not-asked fire
 * is one appended line beside the store, reconciled into `trigger_fires` at
 * SessionEnd and at `ob_end`. better-sqlite3, db-v2, the policy loader (zod)
 * and run.js are imported only on the asked path. A static import of any of
 * them here puts their load cost back on every Bash call.
 */

import { appendFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { homedir } from "node:os";
import type Database from "better-sqlite3";
import { deriveQuery } from "./trigger/query.js";
import { appendPendingNotAsked, pendingFiresPath } from "./trigger/pending-fires.js";
import { matchingKeyIds, readTriggerKeys, triggerKeysPath } from "./trigger/match-keys.js";

const DB_PATH = process.env.KNOWLEDGE_V2_DB || join(homedir(), ".claude", "open-brain", "knowledge-v2.db");
const LOG_PATH = process.env.RECALL_TRIGGER_LOG || join(dirname(DB_PATH), "recall-trigger.log");

/**
 * Shell commands the recall trigger may act on. Claude Code PostToolUse/Bash uses
 * `Bash`. Cursor postToolUse was measured live (T-235 P2-5, 2026-10-04,
 * scratch t235-p25-measure, cursor-agent 2026.10.01-e373342): tool_name `Shell`
 * only — no other names are allowlisted without a new measurement row.
 */
export const CURSOR_MEASURED_SHELL_TOOL_NAMES = new Set<string>(["Shell"]);

/**
 * Shell tool names Claude Code sends on PostToolUse and PostToolUseFailure. `Bash` is the original; `PowerShell` was
 * measured live (T-170-II-PS, G-060, 2026-10-15, QA PC, claude 2.1.296, docs/loops/t170-ii/powershell-reply.md): its
 * payload has Bash's shape and `tool_input.command` is the command exactly. No other names without a new measurement row.
 */
export const CLAUDE_CODE_MEASURED_SHELL_TOOL_NAMES = new Set<string>(["Bash", "PowerShell"]);

/**
 * Extract the shell command from a PostToolUse / postToolUse hook payload, or
 * null when this event is not one the trigger handles.
 */
export function shellCommandFromHookPayload(payload: Record<string, unknown>): string | null {
  const toolName = payload.tool_name;
  if (typeof toolName === "string" && CLAUDE_CODE_MEASURED_SHELL_TOOL_NAMES.has(toolName)) {
    const command = (payload.tool_input as Record<string, unknown> | undefined)?.command;
    return typeof command === "string" && command.trim() !== "" ? command : null;
  }
  if (typeof toolName === "string" && CURSOR_MEASURED_SHELL_TOOL_NAMES.has(toolName)) {
    const command = (payload.tool_input as Record<string, unknown> | undefined)?.command;
    return typeof command === "string" && command.trim() !== "" ? command : null;
  }
  return null;
}

/**
 * The event name to answer with (G-059). Claude Code fires PostToolUseFailure, not PostToolUse, for a Bash call
 * that exits non-zero; the answer names the event it was called on. Anything else, including Cursor's
 * `postToolUse`, keeps the PostToolUse answer it has always had.
 */
export function outputHookEventName(payload: Record<string, unknown>): "PostToolUse" | "PostToolUseFailure" {
  return payload.hook_event_name === "PostToolUseFailure" ? "PostToolUseFailure" : "PostToolUse";
}

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
  } catch {
    // Unlike SessionStart (F4), a malformed payload here is NOT a refusal
    // with a non-zero exit: this hook runs after every tool call, and a host
    // that malforms payloads would turn a memory feature into a wall of
    // stderr in front of the model. Logged and dropped. The parser's message
    // is NOT logged: it quotes the payload (T-243).
    logFailure(`payload is not valid JSON (${raw.length} chars; parser message withheld: it quotes the payload)`);
    return;
  }

  const command = shellCommandFromHookPayload(payload);
  if (command === null) return;

  const sessionUuid = typeof payload.session_id === "string" ? payload.session_id : "";
  if (!sessionUuid) {
    // No session means the fire cannot be keyed to anything, and an
    // unattributable fire is worse than none: it would inflate the census
    // this loop exists to make trustworthy.
    logFailure("no session_id in payload — fire not recorded");
    return;
  }

  // T-159: AFTER the session check, so an unattributable fire is still
  // dropped rather than written to the pending file. T-170: a command that
  // matches a lesson's `MATCH: command:` key in the sidecar is asked too.
  const keyIds = matchingKeyIds(readTriggerKeys(triggerKeysPath(DB_PATH)), command);
  if (deriveQuery(command) === "" && keyIds.length === 0) {
    try {
      appendPendingNotAsked(pendingFiresPath(DB_PATH), { sessionUuid, command }, new Date());
    } catch (err) {
      logFailure("not-asked fire not recorded", err);
    }
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
    // T-159: the asked path's modules, loaded only here (see the header).
    const { default: Database } = await import("better-sqlite3");
    const { initTriggerFires } = await import("./db-v2.js");
    const { runTrigger } = await import("./trigger/run.js");
    const { loadPolicy } = await import("./trigger/policy.js");

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

    // The deadline clock starts after the imports, as it did when they were
    // static. It also leaves out the stdin read, the payload parse and
    // `loadPolicy`, all of which run before it.
    const started = Date.now();

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

    const outcome = runTrigger({ db: writeDb, readDb, sessionUuid, command, policy, keyIds });

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
          hookEventName: outputHookEventName(payload),
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
