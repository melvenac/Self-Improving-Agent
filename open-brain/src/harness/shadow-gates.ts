/**
 * The two gates slice four runs OUT OF a loop and IN SHADOW: the developer done-gate on one merged
 * diff (4.3), and the QA-score gate on one `E_t` (4.4).
 *
 * ## Shadow means the decision is a record and nothing else
 *
 * A runner writes one gate record, once, and returns. The decision it computes (`proceed`,
 * `reject`) is a field in that record. It is never an exit code, never a write to an `E_t` or a
 * report, never a merge. `runLoop`'s done-gate is different on purpose: a reject there fails the
 * loop (`runtime.ts`, `gate-rejected`). That is the runtime's ruled behaviour, and exactly the
 * shape these runners must not copy. A runner exits non-zero only when it could not do its job
 * (a bad input, a gate that was unreachable), never because Jev said no.
 *
 * ## One request per subject
 *
 * Each runner sends all of a subject's questions in one batched request. If the API refuses the
 * batch the runner records the refusal and stops; it does not split the batch into more calls.
 *
 * ## The key
 *
 * Read by `JevTransport` from the environment it is given, at call time, and nowhere else. Every
 * record is passed through `redact` against that same environment before it is validated and
 * written, so an answer, a note or an error that echoes the key never reaches a file.
 */

import { createHash, randomUUID } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import {
  DONE_GATE_QUESTIONS,
  DryRunTransport,
  JevTransport,
  buildJevRequest,
  redact,
  type GateAnswer,
  type GatePayload,
  type GateTransport,
} from "./gate.js";
import {
  SLICE_RECORDS_DIR,
  gitBlobSha,
  openAttempt,
  outcomeOfError,
  toPosix,
  writeSliceRecord,
  type OutcomeClass,
  type ShadowDoneRecord,
  type Subject,
} from "./gate-records.js";
import { decideDoneGate, loadPolicies, policiesDir, type GateDecision } from "./policies.js";
import { committedPaths, gitTry } from "./git.js";
import { validatePlan, type Plan } from "./schema.js";

export class ShadowRunError extends Error {
  readonly exitCode: number;
  constructor(message: string, exitCode = 1) {
    super(message);
    this.name = "ShadowRunError";
    this.exitCode = exitCode;
  }
}

export type ShadowMode = "live" | "dry-run";

/** What a shadow runner says about what it did to the outcome. Fixed text: it is the same every time. */
export const SHADOW_RUNTIME_ACTION = "shadow: recorded only; no outcome was changed";

/** The sha256 of a policy file's bytes, as every record's `policy_hash`. */
export function policyHash(dir: string, file: string): string {
  return createHash("sha256").update(readFileSync(join(dir, file))).digest("hex");
}

/** First unused `<stem>.<kind>.<timestamp>.json` under `dir`, so a record is never overwritten. */
export function allocateRecordPath(dir: string, stem: string, kind: "G_done" | "G_qa", at: Date): string {
  const base = at.toISOString().replace(/:/g, "-");
  for (let n = 0; n < 1000; n += 1) {
    const path = join(dir, `${stem}.${kind}.${base}${n === 0 ? "" : `-${n}`}.json`);
    if (!existsSync(path)) return path;
  }
  throw new ShadowRunError(`cannot allocate a record path under ${dir}`);
}

export interface ConsultInput {
  mode: ShadowMode;
  env: NodeJS.ProcessEnv;
  transport?: GateTransport;
  /** Injected so a test can hold the request open or echo the key. Used only when no `transport` is given. */
  fetchImpl?: typeof fetch;
  payload: GatePayload;
  subject: Subject;
  /** Repo-relative path the record will be written at; named in the ledger line. */
  recordPath: string;
  ledgerPath?: string;
  at: Date;
}

export interface ConsultResult {
  answer: GateAnswer | null;
  error: Error | null;
  attempt_id: string;
  attempt: number;
  retry_of: string | null;
  attempted_at: string | null;
  outcome_class: OutcomeClass;
}

/**
 * Send one batched request, with the attempt written BEFORE it leaves (S4-7a), and settle the
 * attempt when it returns. Never throws for a gate failure: the failure is the result.
 */
export async function consult(input: ConsultInput): Promise<ConsultResult> {
  const live = input.mode === "live";
  const transport: GateTransport =
    input.transport ?? (live ? new JevTransport({ env: input.env, fetchImpl: input.fetchImpl, log: () => {} }) : new DryRunTransport(() => {}, input.env));
  const attempt =
    live && input.ledgerPath !== undefined
      ? openAttempt(input.ledgerPath, { gate: input.payload.gate, subject: input.subject, recordPath: input.recordPath, mode: input.mode, at: input.at })
      : null;
  const base = {
    attempt_id: attempt?.attempt_id ?? randomUUID(),
    attempt: attempt?.attempt ?? 1,
    retry_of: attempt?.retry_of ?? null,
    attempted_at: live ? (attempt?.attempted_at ?? input.at.toISOString()) : null,
  };
  try {
    const answer = await transport.dispatch(input.payload);
    const answered = answer.consulted && answer.answers !== null;
    // A dry run made no request: its outcome is `unavailable`, which the count never includes.
    const outcome: OutcomeClass = answered ? "answered" : live ? "transport" : "unavailable";
    attempt?.finish(outcome);
    return { answer, error: null, outcome_class: outcome, ...base };
  } catch (err) {
    const outcome = outcomeOfError(err);
    attempt?.finish(outcome);
    return { answer: null, error: err as Error, outcome_class: outcome, ...base };
  }
}

/** The note for a failed call: the class and the message, never the response body. */
export function failureNote(err: Error): string {
  const cls = (err as { classification?: string }).classification;
  const status = (err as { status?: number | null }).status;
  return cls === undefined ? err.message : `${cls} (HTTP ${status ?? "none"}): ${err.message}`;
}

/* ------------------------------------------------------------------------- *
 * 4.3 — the developer done-gate on one merged diff
 * ------------------------------------------------------------------------- */

/** Where the test exit codes came from. `none` means no exit code is recorded for that SHA. */
export interface ChecksInput {
  /** `E_t:<path>@<blob>`, `ci:<run id>`, or `none`. */
  source: string;
  build_exit: number | null;
  unit_exit: number | null;
}

export const NO_CHECKS: ChecksInput = { source: "none", build_exit: null, unit_exit: null };

/** Read `runtime_checks` out of an `E_t`, naming the file and its blob as the source. */
export function checksFromEvidence(path: string): ChecksInput {
  const abs = resolve(path);
  const bytes = readFileSync(abs);
  const json = JSON.parse(bytes.toString("utf-8")) as { runtime_checks?: { build?: { exit_code?: number | null }; unit?: { exit_code?: number | null } } };
  const build = json.runtime_checks?.build?.exit_code;
  const unit = json.runtime_checks?.unit?.exit_code;
  if (typeof build !== "number" || typeof unit !== "number") return NO_CHECKS;
  return { source: `E_t:${toPosix(path)}@${gitBlobSha(bytes)}`, build_exit: build, unit_exit: unit };
}

export interface RunShadowDoneOptions {
  repoRoot: string;
  pr: number;
  mergeCommit: string;
  scoredSha: string;
  baseSha: string;
  /** The reconstructed D_t the diff is scored against. */
  dtPath: string;
  checks: ChecksInput;
  mode: ShadowMode;
  env?: NodeJS.ProcessEnv;
  transport?: GateTransport;
  fetchImpl?: typeof fetch;
  recordsDir?: string;
  ledgerPath?: string;
  policiesDir?: string;
  at?: Date;
  /** `reconstructed-after` for slice four's eight diffs. */
  planProvenance?: "reconstructed-after" | "written-before";
}

export interface RunShadowResult {
  recordPath: string;
  record: ShadowDoneRecord;
  decision: GateDecision | null;
  /** 0 whenever the runner did its job, whatever the gate answered. */
  exitCode: number;
}

const SHA_RE = /^[0-9a-f]{40}$/;

function readDt(path: string): { plan: Plan; bytes: Buffer } {
  let bytes: Buffer;
  try {
    bytes = readFileSync(path);
  } catch (err) {
    throw new ShadowRunError(`cannot read ${path}: ${(err as Error).message}`, 2);
  }
  let json: unknown;
  try {
    json = JSON.parse(bytes.toString("utf-8"));
  } catch (err) {
    throw new ShadowRunError(`${path}: not JSON: ${(err as Error).message}`, 1);
  }
  const v = validatePlan(json);
  if (!v.ok) throw new ShadowRunError(`${path}: ${v.problems.join("; ")}`, 1);
  return { plan: v.value, bytes };
}

/**
 * Score one merged diff through `gate.ts` with the CURRENT `developer-done.json`, out of loop.
 *
 * The diffstat is recomputed from `base_sha..scored_sha`. The test exit codes come from `checks`,
 * a recorded source: Jev is never asked whether tests passed (HOH-JEV §4), and `none` means the
 * decision is computed with `checksPassed: false` and says so in `checks_source`.
 */
export async function runShadowDoneGate(options: RunShadowDoneOptions): Promise<RunShadowResult> {
  const repoRoot = resolve(options.repoRoot);
  const env = options.env ?? process.env;
  const at = options.at ?? new Date();
  for (const [name, value] of [["merge_commit", options.mergeCommit], ["scored_sha", options.scoredSha], ["base_sha", options.baseSha]] as const) {
    if (!SHA_RE.test(value)) throw new ShadowRunError(`${name} must be a full 40-character sha, got "${value}"`, 2);
    const found = gitTry(repoRoot, ["cat-file", "-e", `${value}^{commit}`]);
    if (!found.ok) throw new ShadowRunError(`${name} ${value} is not a commit in ${repoRoot}`, 2);
  }
  const dtAbs = resolve(options.dtPath);
  const { plan, bytes } = readDt(dtAbs);
  const dtRel = toPosix(relative(repoRoot, dtAbs));

  const diffstat = committedPaths(repoRoot, options.baseSha, options.scoredSha);
  const checksPassed = options.checks.build_exit === 0 && options.checks.unit_exit === 0;
  const pDir = options.policiesDir ?? policiesDir();
  const policy = loadPolicies(pDir).done;

  const payload: GatePayload = {
    gate: "developer-done",
    loop: plan.loop,
    model: "jev-latest",
    questions: DONE_GATE_QUESTIONS,
    context: {
      plan,
      candidate: options.scoredSha,
      diffstat,
      checks: {
        source: options.checks.source,
        build: { exit_code: options.checks.build_exit },
        unit: { exit_code: options.checks.unit_exit },
      },
      prior_failures: [...plan.repair_targets],
      scored_diff: { pr: options.pr, base_sha: options.baseSha, scored_sha: options.scoredSha, merge_commit: options.mergeCommit },
    },
  };

  const recordsDir = resolve(options.recordsDir ?? join(repoRoot, SLICE_RECORDS_DIR));
  const stem = `pr-${options.pr}`;
  const recordPath = allocateRecordPath(recordsDir, stem, "G_done", at);
  const subject: Subject = { gate: "developer-done", key: options.scoredSha, blob: gitBlobSha(bytes) };

  const result = await consult({
    mode: options.mode,
    env,
    transport: options.transport,
    fetchImpl: options.fetchImpl,
    payload,
    subject,
    recordPath: toPosix(relative(repoRoot, recordPath)),
    ledgerPath: options.ledgerPath,
    at,
  });

  const answers = result.answer?.answers ?? null;
  const decision = answers === null ? null : decideDoneGate(answers, policy, { checksPassed });
  const record: ShadowDoneRecord = {
    gate: "developer-done",
    loop: plan.loop,
    mode: options.mode,
    sent: result.answer?.consulted ?? false,
    requested_at: at.toISOString(),
    answered_at: result.answer === null ? null : new Date().toISOString(),
    model_requested: payload.model,
    model_resolved: result.answer?.resolvedModel ?? null,
    request: buildJevRequest(payload),
    answer: answers,
    usage: (result.answer?.usage ?? null) as Record<string, unknown> | null,
    decision: decision === null ? null : ({ ...decision } as unknown as Record<string, unknown>),
    runtime_action: SHADOW_RUNTIME_ACTION,
    note: result.error !== null ? failureNote(result.error) : (result.answer?.note ?? ""),
    source: "seat",
    plan_provenance: options.planProvenance ?? "reconstructed-after",
    attempt_id: result.attempt_id,
    subject,
    attempt: result.attempt,
    retry_of: result.retry_of,
    outcome_class: result.outcome_class,
    attempted_at: result.attempted_at,
    policy_hash: policyHash(pDir, "developer-done.json"),
    pr: options.pr,
    merge_commit: options.mergeCommit,
    scored_sha: options.scoredSha,
    base_sha: options.baseSha,
    dt: { path: dtRel, blob: subject.blob },
    checks_source: options.checks.source,
    checks_passed: checksPassed,
    diffstat,
  };

  const safe = redact(record, env);
  writeSliceRecord(recordPath, safe);
  return { recordPath, record: safe, decision, exitCode: result.error !== null ? 1 : 0 };
}
