/**
 * Slice four's gate records: the strict schemas, the refusing writer, the write-ahead attempt
 * ledger, and the command that counts the attempts (S4-4a, S4-7a, S4-7b).
 *
 * ## Why a record is refused twice
 *
 * {@link writeSliceRecord} refuses a record that lacks `source` or `plan_provenance`, and
 * `harness validate gate-record` refuses a hand-written file that lacks them. A hand edit, or a
 * later writer, would get past the first alone.
 *
 * ## Why an attempt is written BEFORE the request
 *
 * A call that dies in flight may have reached Jev and been billed. A record written only after
 * `dispatch` returns or throws leaves no trace of it, so a count taken from the records is a count
 * of the calls that came back. {@link beginAttempt} appends a line to an append-only ledger first.
 * The count is taken from the ledger and the records together, never from memory.
 */

import { appendFileSync, closeSync, existsSync, fsyncSync, mkdirSync, openSync, readFileSync, readdirSync, statSync, writeSync } from "node:fs";
import { createHash, randomUUID } from "node:crypto";
import { dirname, join, relative, resolve } from "node:path";
import { z } from "zod";
import { LOOP_ID_PATTERN } from "./schema.js";

export const RECORD_SOURCES = ["seat", "runtime"] as const;
export const PLAN_PROVENANCES = ["reconstructed-after", "written-before"] as const;

/** `answered`, or one of `gate.ts`'s `GateFailureClass` values. `unavailable` is no request at all. */
export const OUTCOME_CLASSES = [
  "answered",
  "auth",
  "request-invalid",
  "rate-limited",
  "overloaded",
  "unexpected-status",
  "transport",
  "malformed-response",
  "unavailable",
] as const;
export type OutcomeClass = (typeof OUTCOME_CLASSES)[number];

/** Only these three may be retried (S4-7b.2). The others are defects, and the item stops. */
export const RETRYABLE_OUTCOMES: readonly OutcomeClass[] = ["transport", "rate-limited", "overloaded"];

/** The one tracked directory slice four's records and its attempt ledger live in (ruling 3). */
export const SLICE_RECORDS_DIR = "docs/loops/loop-15-slice-4-records";
export const SLICE_LEDGER_FILE = "attempts.jsonl";

/** The budget ceiling (D-072, brief section 5) and the retry ceiling. */
export const MAX_ATTEMPTS_TOTAL = 20;
export const MAX_RETRIES_TOTAL = 3;

const sha40 = z.string().regex(/^[0-9a-f]{40}$/, "must be a full 40-character sha");
const jsonObject = z.record(z.string(), z.unknown());

export const SubjectSchema = z.strictObject({
  gate: z.string().min(1),
  key: z.string().min(1),
  blob: z.string().min(1),
});
export type Subject = z.infer<typeof SubjectSchema>;

/** The fields every gate record carries, as `GateRecord` in artifacts.ts. */
const common = {
  gate: z.string().min(1),
  loop: z.string().regex(LOOP_ID_PATTERN, "loop must be a runtime id (t001) or a human-seat id (15-slice-3)"),
  mode: z.string().min(1),
  sent: z.boolean(),
  requested_at: z.string().min(1),
  answered_at: z.string().nullable(),
  model_requested: z.string().min(1),
  model_resolved: z.string().nullable(),
  request: jsonObject,
  answer: jsonObject.nullable(),
  usage: jsonObject.nullable(),
  decision: jsonObject.nullable(),
  runtime_action: z.string(),
  note: z.string(),
  /** S4-4a. Required, never defaulted, never optional. */
  source: z.enum(RECORD_SOURCES),
  plan_provenance: z.enum(PLAN_PROVENANCES),
};

/** S4-7b: what makes a retry tell apart from a re-roll. Required on every slice-four record. */
const attemptFields = {
  attempt_id: z.string().min(1),
  subject: SubjectSchema,
  attempt: z.number().int().min(1),
  retry_of: z.string().min(1).nullable(),
  outcome_class: z.enum(OUTCOME_CLASSES),
  /** Set before the request leaves; null only when nothing was attempted (dry run). */
  attempted_at: z.string().nullable(),
  policy_hash: z.string().regex(/^[0-9a-f]{64}$/, "must be a sha256"),
};

/** The loop's own `G_done` (runtime.ts): the common fields and the provenance, nothing more. */
export const RuntimeDoneRecordSchema = z.strictObject({ ...common });

/** 4.3: one merged diff scored out of loop, in shadow. */
export const ShadowDoneRecordSchema = z.strictObject({
  ...common,
  ...attemptFields,
  pr: z.number().int().min(1),
  merge_commit: sha40,
  scored_sha: sha40,
  base_sha: sha40,
  dt: z.strictObject({ path: z.string().min(1), blob: z.string().min(1) }),
  /** `E_t:<path>@<blob>`, `ci:<run id>`, or `none` (then `checks_passed` is false). */
  checks_source: z.string().min(1),
  checks_passed: z.boolean(),
  diffstat: z.array(z.string()),
  /** Calibration 2 frozen runner: the input case id (join key for score.mjs). */
  cal2_case_id: z.string().min(1).optional(),
  /** Redacted HTTP response body when the frozen transport received a non-2xx. */
  response_detail: z.string().max(4000).optional(),
});

export const QaResultSchema = z.strictObject({
  id: z.string().min(1),
  from: z.enum(["requirements", "acceptance"]),
  result: z.enum(["pass", "fail", "untested"]),
  /** Where `result` came from: Jev's answer, or code (missing evidence is computed, not asked). */
  decided_by: z.enum(["jev", "code"]),
  severity: z.number().nullable(),
});

/** 4.4: one E_t scored, in shadow. */
export const ShadowQaRecordSchema = z.strictObject({
  ...common,
  ...attemptFields,
  e_t_ref: z.strictObject({
    branch: z.string().min(1),
    commit: z.string().min(1),
    path: z.string().min(1),
    blob: z.string().min(1),
  }),
  results: z.array(QaResultSchema),
  missing: z.array(z.string()),
  regression_of_validated: z.number().nullable(),
  artifact_complete_enough_to_stop: z.number().nullable(),
});

export type RuntimeDoneRecord = z.infer<typeof RuntimeDoneRecordSchema>;
export type ShadowDoneRecord = z.infer<typeof ShadowDoneRecordSchema>;
export type ShadowQaRecord = z.infer<typeof ShadowQaRecordSchema>;
export type SliceGateRecord = RuntimeDoneRecord | ShadowDoneRecord | ShadowQaRecord;

/** The derived JSON Schema's source: any one of the three shapes. */
export const GateRecordSchema = z.union([RuntimeDoneRecordSchema, ShadowDoneRecordSchema, ShadowQaRecordSchema]);

/** The derived JSON Schema (`schemas/gate-record.schema.json`), the D-021 pattern. */
export function gateRecordJsonSchema(): Record<string, unknown> {
  return {
    ...(z.toJSONSchema(GateRecordSchema, { io: "input" }) as Record<string, unknown>),
    title: "G_done / G_qa gate record",
    description:
      "A gate record: the loop's own G_done (runtime), a shadow G_done for one merged diff, or a " +
      "shadow G_qa for one E_t. source and plan_provenance are required on all three. LIMIT: rules " +
      "that span records (at most one answered record per subject, a valid retry_of, at most 3 " +
      "retries, at most 20 attempts) are enforced by `harness count-attempts` and are not " +
      "expressible here. Derived from open-brain/src/harness/gate-records.ts; do not edit by hand.",
  };
}

export type GateRecordValidation =
  | { ok: true; kind: "runtime-done" | "shadow-done" | "shadow-qa"; value: SliceGateRecord }
  | { ok: false; problems: string[] };

const describeIssues = (issues: readonly z.core.$ZodIssue[]): string[] =>
  issues.map((i) => `${i.path.length > 0 ? i.path.join(".") : "(root)"}: ${i.message}`);

/**
 * Validate a record against the shape its `gate` names. The shape is chosen by the record's own
 * `gate` and by whether it names a `pr`, never by its loop id (S4-4a.5).
 */
export function validateGateRecord(input: unknown): GateRecordValidation {
  if (input === null || typeof input !== "object" || Array.isArray(input)) {
    return { ok: false, problems: ["(root): a gate record is a JSON object"] };
  }
  const gate = (input as Record<string, unknown>).gate;
  const pick =
    gate === "qa-score"
      ? ([ShadowQaRecordSchema, "shadow-qa"] as const)
      : gate === "developer-done" && "pr" in (input as Record<string, unknown>)
        ? ([ShadowDoneRecordSchema, "shadow-done"] as const)
        : gate === "developer-done"
          ? ([RuntimeDoneRecordSchema, "runtime-done"] as const)
          : null;
  if (pick === null) {
    return { ok: false, problems: [`gate: "${String(gate)}" is not a G_done or G_qa record (developer-done, qa-score)`] };
  }
  const r = pick[0].safeParse(input);
  return r.success
    ? { ok: true, kind: pick[1], value: r.data as SliceGateRecord }
    : { ok: false, problems: describeIssues(r.error.issues) };
}

export class GateRecordRefused extends Error {
  readonly problems: readonly string[];
  constructor(problems: readonly string[]) {
    super(`gate record refused: ${problems.join("; ")}`);
    this.name = "GateRecordRefused";
    this.problems = problems;
  }
}

/**
 * Write one record, once. A record the schema refuses is refused BEFORE any file exists, and a
 * second write to the same path is refused (exclusive create, the `brief-plan-gate.ts` pattern).
 */
export function writeSliceRecord(path: string, record: unknown): void {
  const v = validateGateRecord(record);
  if (!v.ok) throw new GateRecordRefused(v.problems);
  mkdirSync(dirname(path), { recursive: true });
  let fd: number;
  try {
    fd = openSync(path, "wx");
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "EEXIST") {
      throw new GateRecordRefused([`a record already exists at ${path}; a gate record is written once`]);
    }
    throw err;
  }
  try {
    writeSync(fd, `${JSON.stringify(v.value, null, 2)}\n`, undefined, "utf-8");
    fsyncSync(fd);
  } finally {
    closeSync(fd);
  }
}

/* ------------------------------------------------------------------------- *
 * The write-ahead attempt ledger
 * ------------------------------------------------------------------------- */

export interface AttemptBegin {
  event: "begin";
  attempt_id: string;
  gate: string;
  subject: Subject;
  attempt: number;
  /** The `record_path` of the record this retries, or null for a first attempt. */
  retry_of: string | null;
  /** Where this attempt's record will be written, repo-relative with forward slashes. */
  record_path: string;
  attempted_at: string;
  mode: string;
}

export interface AttemptEnd {
  event: "end";
  attempt_id: string;
  outcome_class: OutcomeClass;
  completed_at: string;
}

export const toPosix = (p: string): string => p.split("\\").join("/");

function appendDurably(ledger: string, line: object): void {
  mkdirSync(dirname(ledger), { recursive: true });
  appendFileSync(ledger, `${JSON.stringify(line)}\n`, "utf-8");
  const fd = openSync(ledger, "r+");
  try {
    fsyncSync(fd);
  } finally {
    closeSync(fd);
  }
}

/** Append the begin line. Call this BEFORE the request is made, so a call that dies leaves a trace. */
export function beginAttempt(ledger: string, begin: Omit<AttemptBegin, "event">): void {
  appendDurably(ledger, { event: "begin", ...begin });
}

export function endAttempt(ledger: string, end: Omit<AttemptEnd, "event">): void {
  appendDurably(ledger, { event: "end", ...end });
}

/** The next `attempt` number and the retry link for a subject, from what the ledger already holds. */
export function nextAttemptFor(ledger: string, subject: Subject): { attempt: number; previous: string | null } {
  // `unavailable` made no request (no key), so it is not an attempt and is never a retry's parent.
  const mine = readLedger(ledger).filter((a) => sameSubject(a.subject, subject) && a.outcome_class !== "unavailable");
  return { attempt: mine.length + 1, previous: mine.length === 0 ? null : mine[mine.length - 1]!.record_path };
}

/** A git blob sha for some bytes: what `git hash-object` prints, without a process. */
export function gitBlobSha(content: Buffer | string): string {
  const buf = typeof content === "string" ? Buffer.from(content, "utf-8") : content;
  return createHash("sha1").update(`blob ${buf.length}\0`).update(buf).digest("hex");
}

/** Which outcome a thrown dispatch error stands for. */
export function outcomeOfError(err: unknown): OutcomeClass {
  const name = (err as { name?: string }).name;
  if (name === "GateUnavailable") return "unavailable";
  const cls = (err as { classification?: string }).classification;
  return (OUTCOME_CLASSES as readonly string[]).includes(cls ?? "") ? (cls as OutcomeClass) : "transport";
}

export interface OpenAttempt {
  attempt_id: string;
  attempt: number;
  retry_of: string | null;
  attempted_at: string;
  /** Append the end line. Safe to call once. */
  finish(outcome: OutcomeClass): void;
}

/**
 * Write the begin line and return the fields every record of this attempt carries. The caller
 * dispatches AFTER this returns, and calls `finish` with the outcome when the dispatch settles.
 */
export function openAttempt(
  ledger: string,
  input: { gate: string; subject: Subject; recordPath: string; mode: string; at?: Date },
): OpenAttempt {
  const { attempt, previous } = nextAttemptFor(ledger, input.subject);
  const attempted_at = (input.at ?? new Date()).toISOString();
  const attempt_id = randomUUID();
  beginAttempt(ledger, {
    attempt_id,
    gate: input.gate,
    subject: input.subject,
    attempt,
    retry_of: previous,
    record_path: toPosix(input.recordPath),
    attempted_at,
    mode: input.mode,
  });
  let finished = false;
  return {
    attempt_id,
    attempt,
    retry_of: previous,
    attempted_at,
    finish(outcome: OutcomeClass): void {
      if (finished) return;
      finished = true;
      endAttempt(ledger, { attempt_id, outcome_class: outcome, completed_at: new Date().toISOString() });
    },
  };
}

export interface AttemptView {
  attempt_id: string;
  subject: Subject;
  attempt: number;
  retry_of: string | null;
  record_path: string;
  attempted_at: string | null;
  mode: string;
  /** `null` while the attempt is incomplete: begun, never ended. */
  outcome_class: OutcomeClass | null;
  from: "ledger" | "record";
}

const subjectKey = (s: Subject): string => `${s.gate}\u0000${s.key}\u0000${s.blob}`;
const sameSubject = (a: Subject, b: Subject): boolean => subjectKey(a) === subjectKey(b);

/** Read the ledger. An unreadable line is an error, not a skipped line: the count must not shrink silently. */
export function readLedger(ledger: string): AttemptView[] {
  if (!existsSync(ledger)) return [];
  const byId = new Map<string, AttemptView>();
  const lines = readFileSync(ledger, "utf-8").split("\n");
  lines.forEach((raw, i) => {
    if (raw.trim() === "") return;
    let row: Record<string, unknown>;
    try {
      row = JSON.parse(raw) as Record<string, unknown>;
    } catch {
      throw new Error(`${ledger}:${i + 1}: not JSON; a count taken past it would be short`);
    }
    if (row.event === "begin") {
      const b = row as unknown as AttemptBegin;
      byId.set(b.attempt_id, {
        attempt_id: b.attempt_id,
        subject: b.subject,
        attempt: b.attempt,
        retry_of: b.retry_of,
        record_path: b.record_path,
        attempted_at: b.attempted_at,
        mode: b.mode,
        outcome_class: null,
        from: "ledger",
      });
    } else if (row.event === "end") {
      const e = row as unknown as AttemptEnd;
      const view = byId.get(e.attempt_id);
      if (view === undefined) throw new Error(`${ledger}:${i + 1}: an end line for an attempt that never began (${e.attempt_id})`);
      view.outcome_class = e.outcome_class;
    } else {
      throw new Error(`${ledger}:${i + 1}: unknown event "${String(row.event)}"`);
    }
  });
  return [...byId.values()];
}

/** Every gate record (`G_plan`, `G_done`, `G_qa`, with or without a stem) under `dir`, recursively. */
export function recordFiles(dir: string): string[] {
  if (!existsSync(dir)) return [];
  const out: string[] = [];
  const walk = (d: string): void => {
    for (const name of readdirSync(d)) {
      const p = join(d, name);
      if (statSync(p).isDirectory()) walk(p);
      else if (/\.json$/.test(name) && /(^|\.)G_(plan|done|qa)(\.|$)/.test(name)) out.push(p);
    }
  };
  walk(dir);
  return out.sort();
}

export interface AttemptReport {
  total: number;
  retries: number;
  answered: number;
  incomplete: number;
  attempts: AttemptView[];
  /** One line per breach. Empty means the three rules and the ceiling hold. */
  violations: string[];
  files_scanned: { ledger: number; records: number };
}

/**
 * The S4-7a counting command: attempts from the ledger and from the live records, the S4-7b
 * checks, and the ceiling. `attempted_at` non-null is what counts, not `sent`, because a
 * transport failure leaves `sent: false` even when the request may have arrived.
 */
export function countAttempts(options: { ledger?: string; recordsDir?: string; max?: number; repoRoot?: string }): AttemptReport {
  const max = options.max ?? MAX_ATTEMPTS_TOTAL;
  const root = resolve(options.repoRoot ?? process.cwd());
  const attempts: AttemptView[] = options.ledger === undefined ? [] : readLedger(options.ledger);
  const ledgerRows = attempts.length;
  const known = new Set(attempts.map((a) => a.attempt_id));
  const violations: string[] = [];
  let recordsScanned = 0;

  for (const file of options.recordsDir === undefined ? [] : recordFiles(options.recordsDir)) {
    recordsScanned += 1;
    let json: Record<string, unknown>;
    try {
      json = JSON.parse(readFileSync(file, "utf-8")) as Record<string, unknown>;
    } catch {
      violations.push(`${file}: not JSON`);
      continue;
    }
    if (json.mode !== "live" || json.attempted_at === null || json.attempted_at === undefined) continue;
    const id = typeof json.attempt_id === "string" ? json.attempt_id : `record:${file}`;
    if (known.has(id)) continue;
    known.add(id);
    attempts.push({
      attempt_id: id,
      subject: json.subject as Subject,
      attempt: typeof json.attempt === "number" ? json.attempt : 0,
      retry_of: typeof json.retry_of === "string" ? json.retry_of : null,
      record_path: toPosix(relative(root, resolve(file))),
      attempted_at: String(json.attempted_at),
      mode: "live",
      outcome_class: typeof json.outcome_class === "string" ? (json.outcome_class as OutcomeClass) : null,
      from: "record",
    });
  }

  // `unavailable` is a refusal before any request was built (no key), so it is not a call.
  const live = attempts.filter((a) => a.mode === "live" && a.attempted_at !== null && a.outcome_class !== "unavailable");
  const bySubject = new Map<string, AttemptView[]>();
  for (const a of live) {
    if (a.subject === undefined || a.subject === null) {
      violations.push(`${a.record_path}: no subject; it cannot be grouped`);
      continue;
    }
    const k = subjectKey(a.subject);
    bySubject.set(k, [...(bySubject.get(k) ?? []), a]);
  }

  const byPath = new Map(live.map((a) => [a.record_path, a]));
  /**
   * D-092 ruling 3 / D-093: an attempt after a non-retryable outcome that got NO answer is a fresh
   * attempt, not a retry. "No answer" is read from the parent's own record (`answer` is null), and
   * a record that cannot be read proves nothing, so it is not assumed unanswered.
   */
  const unansweredParent = (prior: AttemptView): boolean => {
    try {
      const rec = JSON.parse(readFileSync(resolve(root, prior.record_path), "utf-8")) as Record<string, unknown>;
      return rec.answer === null;
    } catch {
      return false;
    }
  };
  let retries = 0;
  for (const group of bySubject.values()) {
    const label = `${group[0]!.subject.gate} ${group[0]!.subject.key}`;
    const answered = group.filter((a) => a.outcome_class === "answered");
    if (answered.length > 1) {
      violations.push(`${label}: ${answered.length} answered records; a second answered record is a re-roll`);
    }
    group.forEach((a, i) => {
      if (i === 0) {
        if (a.retry_of !== null) violations.push(`${a.record_path}: the first record for ${label} names retry_of ${a.retry_of}`);
        return;
      }
      const prior = a.retry_of === null ? undefined : byPath.get(a.retry_of);
      if (prior === undefined || !sameSubject(prior.subject, a.subject)) {
        retries += 1;
        violations.push(`${a.record_path}: retry_of ${String(a.retry_of)} does not name an earlier record for ${label}`);
        return;
      }
      if (prior.outcome_class !== null && !RETRYABLE_OUTCOMES.includes(prior.outcome_class) && unansweredParent(prior)) return;
      retries += 1;
      if (prior.outcome_class === null || !RETRYABLE_OUTCOMES.includes(prior.outcome_class)) {
        violations.push(
          `${a.record_path}: retries ${prior.record_path}, whose outcome is ${String(prior.outcome_class)}; ` +
            `only ${RETRYABLE_OUTCOMES.join(", ")} may be retried`,
        );
      }
    });
  }
  if (retries > MAX_RETRIES_TOTAL) violations.push(`${retries} retries in total; the ceiling is ${MAX_RETRIES_TOTAL}`);
  if (live.length > max) violations.push(`${live.length} live attempts; the ceiling is ${max}`);

  return {
    total: live.length,
    retries,
    answered: live.filter((a) => a.outcome_class === "answered").length,
    incomplete: live.filter((a) => a.outcome_class === null).length,
    attempts: live,
    violations,
    files_scanned: { ledger: ledgerRows, records: recordsScanned },
  };
}
