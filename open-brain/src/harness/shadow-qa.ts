/**
 * 4.4 — the QA-score gate on one `E_t`, out of loop and in shadow.
 *
 * Missing evidence is `untested`, computed here and never asked, and Jev's answer for a row that
 * was not asked is ignored. All of an `E_t`'s questions go in ONE batched request. The `E_t` is
 * copied beside its record and the original is never written. The decision is a field in the
 * record; see `shadow-gates.ts` for what shadow means.
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import {
  QA_COMPLETE_QUESTION_ID,
  QA_REGRESSION_QUESTION_ID,
  buildJevRequest,
  buildQaScoreQuestions,
  e_tStateForJev,
  qaResultQuestionId,
  qaSeverityQuestionId,
  redact,
  type GatePayload,
  type GateTransport,
} from "./gate.js";
import { SLICE_RECORDS_DIR, gitBlobSha, toPosix, writeSliceRecord, type ShadowQaRecord, type Subject } from "./gate-records.js";
import { decideQaScore, loadQaScorePolicy, policiesDir, type GateDecision } from "./policies.js";
import { gitTry } from "./git.js";
import { validateEvidence } from "./schema.js";
import {
  SHADOW_RUNTIME_ACTION,
  ShadowRunError,
  allocateRecordPath,
  consult,
  failureNote,
  policyHash,
  type ShadowMode,
} from "./shadow-gates.js";

export interface EvidenceRef {
  branch: string;
  commit: string;
  /** Repo-relative path of the E_t at that commit. */
  path: string;
}

export interface RunShadowQaOptions {
  repoRoot: string;
  evidence: EvidenceRef;
  /** Names the copy and the record: `<stem>.E_t.json` and `<stem>.G_qa.<id>.json` in `recordsDir`. */
  stem: string;
  mode: ShadowMode;
  env?: NodeJS.ProcessEnv;
  transport?: GateTransport;
  fetchImpl?: typeof fetch;
  recordsDir?: string;
  ledgerPath?: string;
  policiesDir?: string;
  at?: Date;
  planProvenance?: "reconstructed-after" | "written-before";
}

export interface RunShadowQaResult {
  recordPath: string;
  copyPath: string;
  record: ShadowQaRecord;
  decision: GateDecision | null;
  exitCode: number;
}

interface EvidenceRow {
  from: "requirements" | "acceptance";
  id: string;
  status: string;
  evidence: string;
}

const SHA_RE = /^[0-9a-f]{40}$/;

/** Statuses that mean the QA seat did not observe the item. Code, not Jev, decides these are untested. */
const UNOBSERVED_STATUSES: readonly string[] = ["not_evaluated", "pending"];

const hasEvidence = (r: EvidenceRow): boolean => !UNOBSERVED_STATUSES.includes(r.status) && r.evidence.trim() !== "";

/** Read the E_t at its commit, and prove the bytes are the blob that path has there. */
function readEvidenceBytes(repoRoot: string, ref: EvidenceRef): { text: string; blob: string } {
  const spec = `${ref.commit}:${ref.path}`;
  const blobId = gitTry(repoRoot, ["rev-parse", "--verify", "--quiet", spec]);
  if (!blobId.ok || !SHA_RE.test(blobId.stdout)) throw new ShadowRunError(`${spec} does not resolve in ${repoRoot}`, 2);
  const shown = gitTry(repoRoot, ["show", spec]);
  if (!shown.ok) throw new ShadowRunError(`cannot read ${spec}: ${shown.stderr}`, 2);
  // `gitTry` trims, so the one trailing newline an E_t ends with may be gone. Put it back only if
  // that reproduces the blob exactly; anything else is a copy that is not the original.
  for (const candidate of [shown.stdout, `${shown.stdout}\n`]) {
    if (gitBlobSha(candidate) === blobId.stdout) return { text: candidate, blob: blobId.stdout };
  }
  throw new ShadowRunError(`the bytes read from ${spec} do not reproduce its blob ${blobId.stdout}; refusing to copy`, 1);
}

const numberAt = (v: unknown, key: string): number | null => {
  const o = v as Record<string, unknown> | undefined | null;
  return o !== undefined && o !== null && typeof o[key] === "number" ? (o[key] as number) : null;
};

export async function runShadowQaGate(options: RunShadowQaOptions): Promise<RunShadowQaResult> {
  const repoRoot = resolve(options.repoRoot);
  const env = options.env ?? process.env;
  const at = options.at ?? new Date();
  const { text, blob } = readEvidenceBytes(repoRoot, options.evidence);
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch (err) {
    throw new ShadowRunError(`${options.evidence.path}: not JSON: ${(err as Error).message}`, 1);
  }
  const valid = validateEvidence(json);
  if (!valid.ok) throw new ShadowRunError(`${options.evidence.path}: ${valid.problems.join("; ")}`, 1);
  const ev = valid.value;

  const rows: EvidenceRow[] = [
    ...ev.requirements.map((r) => ({ from: "requirements" as const, id: r.id, status: r.status, evidence: r.evidence })),
    ...ev.acceptance.map((r) => ({ from: "acceptance" as const, id: r.id, status: r.status, evidence: r.evidence })),
  ];
  const asked = rows.filter(hasEvidence);
  const questions = buildQaScoreQuestions(asked.map((r) => ({ from: r.from, id: r.id })));

  const pDir = options.policiesDir ?? policiesDir();
  const policy = loadQaScorePolicy(pDir);
  const payload: GatePayload = {
    gate: "qa-score",
    loop: ev.loop,
    model: "jev-latest",
    questions,
    context: {
      e_t: e_tStateForJev(ev),
      e_t_ref: { ...options.evidence, blob },
      note: "Rows without evidence are not asked; they are recorded untested by code. Requirement statuses are omitted from the Jev request.",
    },
  };

  const recordsDir = resolve(options.recordsDir ?? join(repoRoot, SLICE_RECORDS_DIR));
  const recordPath = allocateRecordPath(recordsDir, options.stem, "G_qa", at);
  const copyPath = join(recordsDir, `${options.stem}.E_t.json`);
  const subject: Subject = { gate: "qa-score", key: `${options.evidence.commit}:${options.evidence.path}`, blob };

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
  const missing: string[] = [];
  const results: ShadowQaRecord["results"] = [];
  for (const row of rows) {
    if (!hasEvidence(row)) {
      results.push({ id: row.id, from: row.from, result: "untested", decided_by: "code", severity: null });
      continue;
    }
    const choice = (answers?.[qaResultQuestionId(row.from, row.id)] as { choice?: unknown } | undefined)?.choice;
    if (choice !== "pass" && choice !== "fail" && choice !== "untested") {
      // Not answered: untested, and named. Never a default pass.
      results.push({ id: row.id, from: row.from, result: "untested", decided_by: "code", severity: null });
      if (answers !== null) missing.push(qaResultQuestionId(row.from, row.id));
      continue;
    }
    let severity: number | null = null;
    if (choice === "fail") {
      severity = numberAt(answers?.[qaSeverityQuestionId(row.from, row.id)], "score");
      if (severity === null) missing.push(qaSeverityQuestionId(row.from, row.id));
    }
    results.push({ id: row.id, from: row.from, result: choice, decided_by: "jev", severity });
  }
  const regression = numberAt(answers?.[QA_REGRESSION_QUESTION_ID], "noul");
  const complete = numberAt(answers?.[QA_COMPLETE_QUESTION_ID], "noul");
  const decision =
    answers === null
      ? null
      : decideQaScore(
          {
            results: results.map((r) => ({ id: r.id, result: r.result, severity: r.severity })),
            regressionOfValidated: regression,
            artifactCompleteEnoughToStop: complete,
            missing,
          },
          policy,
        );

  const record: ShadowQaRecord = {
    gate: "qa-score",
    loop: ev.loop,
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
    policy_hash: policyHash(pDir, "qa-score.json"),
    e_t_ref: { ...options.evidence, blob },
    results,
    missing,
    regression_of_validated: regression,
    artifact_complete_enough_to_stop: complete,
  };

  const safe = redact(record, env);
  // The copy goes down first, exclusively: a record is never written beside an E_t that is not there.
  mkdirSync(recordsDir, { recursive: true });
  if (existsSync(copyPath)) {
    if (gitBlobSha(readFileSync(copyPath)) !== blob) throw new ShadowRunError(`${copyPath} exists and is not the E_t at ${options.evidence.commit}`, 1);
  } else {
    writeFileSync(copyPath, text, { flag: "wx", encoding: "utf-8" });
  }
  writeSliceRecord(recordPath, safe);
  return { recordPath, copyPath, record: safe, decision, exitCode: result.error !== null ? 1 : 0 };
}
