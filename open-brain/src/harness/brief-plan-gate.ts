/**
 * T-195 — D_t beside interactive briefs, CLI plan gate, and dispatch refusal.
 *
 * Interactive briefs live under `docs/loops/` as markdown. Each carries:
 *   `<stem>.D_t.json`          — the planner's machine plan
 *   `<stem>.G_plan.<id>.json`  — one plan-gate decision record per run (never overwritten)
 *
 * The runtime's in-loop gate path (`runtime.ts`) is unchanged; this module is for
 * briefs the planner writes before dispatching a developer seat.
 */

import { createHash } from "node:crypto";
import { existsSync, openSync, readFileSync, readdirSync, closeSync, writeSync } from "node:fs";
import { basename, dirname, isAbsolute, join, relative, resolve } from "node:path";
import type { GateRecord } from "./artifacts.js";
import { renderGateRecord } from "./artifacts.js";
import {
  buildJevRequest,
  DryRunTransport,
  GateCallFailed,
  GateUnavailable,
  JevTransport,
  PLAN_GATE_QUESTIONS,
  redact,
  type GateAnswer,
  type GatePayload,
  type GateTransport,
} from "./gate.js";
import {
  decidePlanGate,
  loadPolicies,
  POLICY_FILES,
  policiesDir,
  type GateDecision,
  type PlanGateContext,
} from "./policies.js";
import { validatePlan, type Plan } from "./schema.js";
import { gitTry } from "./git.js";
import { gitBlobSha, openAttempt, outcomeOfError, toPosix, type OutcomeClass, type Subject } from "./gate-records.js";

export class BriefPlanGateError extends Error {
  readonly exitCode: number;
  constructor(message: string, exitCode = 1) {
    super(message);
    this.name = "BriefPlanGateError";
    this.exitCode = exitCode;
  }
}

/** Sidecar path for a brief's D_t: `foo-brief.md` → `foo-brief.D_t.json`. */
export function briefDtPath(briefPath: string): string {
  const abs = resolve(briefPath);
  if (abs.endsWith(".md")) return `${abs.slice(0, -3)}.D_t.json`;
  return `${abs}.D_t.json`;
}

/** Infer the brief markdown path from a D_t sidecar, when present. */
export function briefPathFromDt(dtPath: string): string | null {
  const abs = resolve(dtPath);
  if (!abs.endsWith(".D_t.json")) return null;
  const candidate = `${abs.slice(0, -".D_t.json".length)}.md`;
  return existsSync(candidate) ? candidate : null;
}

const GATE_RECORD_RE = /^(.+)\.G_plan\.([0-9T\-:.Z]+)\.json$/;

/** List decision-record paths for a brief, oldest first. */
export function listBriefGateRecords(briefPath: string): string[] {
  const dir = dirname(resolve(briefPath));
  const stem = basename(briefPath).replace(/\.md$/i, "");
  const prefix = `${stem}.G_plan.`;
  return readdirSync(dir)
    .filter((name) => name.startsWith(prefix) && name.endsWith(".json"))
    .map((name) => join(dir, name))
    .sort();
}

/** Allocate the next never-overwritten record path beside the brief. */
export function nextBriefGateRecordPath(briefPath: string, at: Date = new Date(), collision = 0): string {
  const dir = dirname(resolve(briefPath));
  const stem = basename(briefPath).replace(/\.md$/i, "");
  const baseId = at.toISOString().replace(/:/g, "-");
  const id = collision === 0 ? baseId : `${baseId}-${collision}`;
  return join(dir, `${stem}.G_plan.${id}.json`);
}

/** First unused path for `at`, bumping `-N` when two runs share a timestamp (DT-4). */
export function allocateBriefGateRecordPath(briefPath: string, at: Date = new Date()): string {
  for (let collision = 0; collision < 1000; collision += 1) {
    const path = nextBriefGateRecordPath(briefPath, at, collision);
    if (!existsSync(path)) return path;
  }
  throw new BriefPlanGateError(`cannot allocate gate record beside ${briefPath}`, 1);
}

function writeGateRecordExclusive(path: string, content: string): void {
  try {
    const fd = openSync(path, "wx");
    try {
      writeSync(fd, content, undefined, "utf-8");
    } finally {
      closeSync(fd);
    }
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code;
    if (code === "EEXIST") {
      throw new BriefPlanGateError(`gate record already exists: ${path}`, 1);
    }
    throw err;
  }
}

export function policyFileHash(dir: string = policiesDir()): string {
  const path = join(dir, POLICY_FILES.plan);
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

export interface BriefPlanGateSources {
  spec_excerpt: string;
  plan_summary: string;
  prior_failures: string;
  validated_behaviours: string;
  changed_area_hints: string;
}

/**
 * A path as a record should carry it: relative to the repository, forward slashes (T-220, D-092 F4).
 * An absolute path in a tracked record names a local checkout (for example a QA scratch tree) and
 * means nothing on another machine. A path outside the repository is reduced to its file name
 * rather than written as `../..` or as an absolute path.
 */
export function repoRelative(repoRoot: string, abs: string): string {
  const rel = relative(resolve(repoRoot), resolve(abs));
  if (rel === "" || rel.startsWith("..") || isAbsolute(rel)) return basename(abs);
  return toPosix(rel);
}

/** Build HOH-JEV §4 plan-gate state and name where each field came from. */
export function buildBriefPlanGateContext(
  plan: Plan,
  briefPath: string | null,
  repoRoot: string,
): { context: Record<string, unknown>; sources: BriefPlanGateSources } {
  const spec_excerpt =
    briefPath !== null && existsSync(briefPath)
      ? readFileSync(briefPath, "utf-8").slice(0, 4000)
      : plan.objective;
  const specSource =
    briefPath !== null && existsSync(briefPath)
      ? `brief markdown (${repoRelative(repoRoot, briefPath)}, first 4000 chars)`
      : "D_t.objective (brief file absent)";

  const priorFailures = [...plan.repair_targets];
  let priorSource = "D_t.repair_targets";
  const statePath = join(repoRoot, ".agents/state.json");
  if (existsSync(statePath)) {
    try {
      const state = JSON.parse(readFileSync(statePath, "utf-8")) as {
        gaps?: { id: string; title?: string }[];
      };
      const gapTitles = (state.gaps ?? []).map((g) => g.title ?? g.id);
      if (gapTitles.length > 0) {
        priorFailures.push(...gapTitles);
        priorSource = "D_t.repair_targets + state.json gaps[]";
      }
    } catch {
      // Unreadable state is not a reason to invent prior failures.
    }
  }

  const validated = [...plan.preserve];
  let validatedSource = "D_t.preserve";
  if (existsSync(statePath)) {
    try {
      const state = JSON.parse(readFileSync(statePath, "utf-8")) as {
        verified?: { id: string; title?: string }[];
      };
      const verifiedTitles = (state.verified ?? []).map((v) => v.title ?? v.id);
      if (verifiedTitles.length > 0) {
        validated.push(...verifiedTitles);
        validatedSource = "D_t.preserve + state.json verified[]";
      }
    } catch {
      /* keep D_t.preserve only */
    }
  }

  const changedHints = [...plan.tasks, ...plan.out_of_scope.map((x) => `out-of-scope: ${x}`)];

  return {
    context: {
      spec_excerpt,
      plan_summary: plan.objective,
      prior_failures: priorFailures,
      validated_behaviours: validated,
      changed_area_hints: changedHints,
      plan,
    },
    sources: {
      spec_excerpt: specSource,
      plan_summary: "D_t.objective",
      prior_failures: priorSource,
      validated_behaviours: validatedSource,
      changed_area_hints: "D_t.tasks + D_t.out_of_scope",
    },
  };
}

export interface BriefGateRecord extends GateRecord {
  brief: string;
  dt: string;
  policy_hash: string;
  sources: BriefPlanGateSources;
  feedback?: string;
  /** S4-7b. Present when the run was given an attempt ledger (a live run for the slice's budget). */
  attempt_id?: string;
  subject?: Subject;
  attempt?: number;
  retry_of?: string | null;
  outcome_class?: OutcomeClass;
  attempted_at?: string | null;
}

export type BriefPlanGateMode = "live" | "dry-run";

export interface RunBriefPlanGateOptions {
  dtPath: string;
  repoRoot?: string;
  briefPath?: string | null;
  mode: BriefPlanGateMode;
  transport?: GateTransport;
  env?: NodeJS.ProcessEnv;
  at?: Date;
  /**
   * Append-only attempt ledger (S4-7a). When set on a live run, the attempt is written BEFORE the
   * request, so a call that dies in flight still leaves a trace and still counts.
   */
  ledgerPath?: string;
  /** Injected so a test can hold the request open. Used only when no `transport` is given. */
  fetchImpl?: typeof fetch;
}

export interface RunBriefPlanGateResult {
  recordPath: string;
  record: BriefGateRecord;
  decision: GateDecision | null;
  exitCode: number;
}

function readPlanFile(dtPath: string): Plan {
  let text: string;
  try {
    text = readFileSync(dtPath, "utf-8");
  } catch (err) {
    throw new BriefPlanGateError(`cannot read ${dtPath}: ${(err as Error).message}`, 2);
  }
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch (err) {
    throw new BriefPlanGateError(`(root): not JSON: ${(err as Error).message}`, 1);
  }
  const validated = validatePlan(json);
  if (!validated.ok) {
    throw new BriefPlanGateError(validated.problems.join("\n"), 1);
  }
  return validated.value;
}

function planGateContext(priorFailures: readonly string[]): PlanGateContext {
  return {
    deterministicFailure: false,
    qaHistorySupportsStopShip: false,
    hasPriorFailures: priorFailures.length > 0,
  };
}

/** DT-5 — failing questions with value and threshold, for the planner to act on. */
export function formatPlanGateFeedback(decision: GateDecision, answers: Record<string, unknown> | null): string {
  const lines: string[] = [];
  for (const reason of decision.reasons) {
    lines.push(reason);
  }
  for (const id of decision.missing) {
    lines.push(`${id}: (missing) — no answer returned`);
  }
  if (answers !== null) {
    for (const [id, raw] of Object.entries(answers)) {
      if (typeof raw !== "object" || raw === null) continue;
      const answer = raw as Record<string, unknown>;
      if ("noul" in answer && typeof answer.noul === "number") {
        const min = decision.applied[`${id}_min`] ?? decision.applied.has_observable_acceptance_min;
        if (typeof min === "number" && answer.noul < min) {
          lines.push(`${id} ${answer.noul} < ${min}`);
        }
      }
    }
  }
  return lines.join("\n");
}

export async function runBriefPlanGate(options: RunBriefPlanGateOptions): Promise<RunBriefPlanGateResult> {
  const repoRoot = resolve(options.repoRoot ?? process.cwd());
  const dtPath = resolve(options.dtPath);
  const plan = readPlanFile(dtPath);
  const briefPath = options.briefPath ?? briefPathFromDt(dtPath);
  if (briefPath === null) {
    throw new BriefPlanGateError(
      `cannot locate brief markdown for ${dtPath}; pass --brief or place ${basename(dtPath).replace(/\.D_t\.json$/, ".md")} beside it`,
      2,
    );
  }
  const briefAbs = resolve(briefPath);
  const policies = loadPolicies();
  const policyHash = policyFileHash();
  const { context, sources } = buildBriefPlanGateContext(plan, briefAbs, repoRoot);
  const priorFailures = context.prior_failures as string[];
  const payload: GatePayload = {
    gate: "plan",
    loop: plan.loop,
    model: "jev-latest",
    questions: PLAN_GATE_QUESTIONS,
    context,
  };
  const env = options.env ?? process.env;
  const at = options.at ?? new Date();
  const recordPath = allocateBriefGateRecordPath(briefAbs, at);
  const requestedAt = at.toISOString();

  const record: BriefGateRecord = {
    gate: "plan",
    loop: plan.loop,
    mode: options.mode,
    sent: false,
    requested_at: requestedAt,
    answered_at: null,
    model_requested: payload.model,
    model_resolved: null,
    request: redact(buildJevRequest(payload), env),
    answer: null,
    usage: null,
    decision: null,
    runtime_action: "",
    note: "",
    brief: repoRelative(repoRoot, briefAbs),
    dt: repoRelative(repoRoot, dtPath),
    policy_hash: policyHash,
    sources,
  };

  const transport =
    options.transport ??
    (options.mode === "dry-run"
      ? new DryRunTransport(() => {}, env)
      : new JevTransport({ env, fetchImpl: options.fetchImpl, log: () => {} }));

  // The record is redacted as it is written: an answer, a note or a model string that echoes the
  // key is a record that leaks it, and the transport only redacts what it puts in an error.
  const persist = (): void => writeGateRecordExclusive(recordPath, renderGateRecord(redact(record, env)));

  // S4-7a: the attempt goes on disk BEFORE the request leaves.
  const attempt =
    options.ledgerPath !== undefined && options.mode === "live"
      ? openAttempt(options.ledgerPath, {
          gate: "plan",
          subject: {
            gate: "plan",
            key: toPosix(relative(repoRoot, dtPath)),
            blob: gitBlobSha(readFileSync(dtPath)),
          },
          recordPath: toPosix(relative(repoRoot, recordPath)),
          mode: options.mode,
          at,
        })
      : null;
  if (attempt !== null) {
    record.attempt_id = attempt.attempt_id;
    record.subject = {
      gate: "plan",
      key: toPosix(relative(repoRoot, dtPath)),
      blob: gitBlobSha(readFileSync(dtPath)),
    } satisfies Subject;
    record.attempt = attempt.attempt;
    record.retry_of = attempt.retry_of;
    record.attempted_at = attempt.attempted_at;
    record.outcome_class = "transport";
  }

  let answer: GateAnswer;
  try {
    answer = await transport.dispatch(payload);
  } catch (err) {
    const message =
      err instanceof GateCallFailed
        ? `${err.classification} (HTTP ${err.status ?? "none"}): ${err.message}`
        : err instanceof GateUnavailable
          ? (err as Error).message
          : (err as Error).message;
    record.runtime_action = "refused — the plan gate could not be reached";
    record.note = message;
    if (attempt !== null) {
      record.outcome_class = outcomeOfError(err);
      attempt.finish(record.outcome_class);
    }
    persist();
    throw new BriefPlanGateError(redact(message, env), 1);
  }

  if (attempt !== null) {
    record.outcome_class = answer.consulted && answer.answers !== null ? "answered" : "transport";
    attempt.finish(record.outcome_class);
  }
  record.sent = answer.consulted;
  record.answered_at = new Date().toISOString();
  record.answer = answer.answers;
  record.model_resolved = answer.resolvedModel ?? null;
  record.usage = (answer.usage ?? null) as Record<string, unknown> | null;
  record.note = answer.note;

  if (!answer.consulted || answer.answers === null) {
    record.runtime_action = "no decision — dry run or transport did not consult";
    record.note = answer.note;
    persist();
    return { recordPath, record, decision: null, exitCode: 0 };
  }

  const decision = decidePlanGate(answer.answers, policies.plan, planGateContext(priorFailures));
  record.decision = { ...decision } as unknown as Record<string, unknown>;
  if (decision.verdict !== "proceed") {
    record.feedback = formatPlanGateFeedback(decision, answer.answers);
    record.runtime_action = `rejected by policy (${decision.verdict})`;
    persist();
    const out = record.feedback ?? decision.reasons.join("\n");
    throw new BriefPlanGateError(redact(out, env), 1);
  }

  record.runtime_action = "proceeded — policy found no rule against it";
  persist();
  return { recordPath, record, decision, exitCode: 0 };
}

export interface DispatchCheckResult {
  ok: boolean;
  reasons: string[];
  /** origin/master SHA used for the brief blob comparison (DT-9). */
  checked_sha?: string;
}

function relInRepo(repoRoot: string, absPath: string): string {
  return relative(repoRoot, absPath).split("\\").join("/");
}

/**
 * DT-9 (D-062): the brief and D_t as dispatched must match their blobs at origin/master.
 * Refuses when a path is absent on master or its working-tree content differs.
 */
export function checkBriefReachableFromMaster(
  repoRoot: string,
  briefPath: string,
  dtPath: string,
  upstream = "origin/master",
): { ok: boolean; sha: string; reasons: string[] } {
  const master = gitTry(repoRoot, ["rev-parse", "--verify", "--quiet", upstream]);
  if (!master.ok || !/^[0-9a-f]{40}$/.test(master.stdout)) {
    return { ok: false, sha: "", reasons: [`${upstream} could not be resolved`] };
  }
  const masterSha = master.stdout;
  const reasons: string[] = [];
  for (const abs of [briefPath, dtPath]) {
    const rel = relInRepo(repoRoot, abs);
    if (!existsSync(abs)) {
      reasons.push(`${rel}: missing on disk`);
      continue;
    }
    const masterBlob = gitTry(repoRoot, ["rev-parse", "--verify", "--quiet", `${upstream}:${rel}`]);
    if (!masterBlob.ok || !/^[0-9a-f]{40}$/.test(masterBlob.stdout)) {
      reasons.push(`${rel}: absent on ${upstream} ${masterSha}`);
      continue;
    }
    const diskBlob = gitTry(repoRoot, ["hash-object", abs]);
    if (!diskBlob.ok || diskBlob.stdout !== masterBlob.stdout) {
      reasons.push(`${rel}: differs from ${upstream} ${masterSha}`);
    }
  }
  return { ok: reasons.length === 0, sha: masterSha, reasons };
}

/**
 * DT-7 — refuse dispatch when the brief lacks a valid D_t or a passing live gate record.
 * Checked locally by the planner before hub dispatch; not CI (D-055 skips docs-only pushes).
 */
export function checkBriefDispatchReady(briefPath: string, repoRoot: string = process.cwd()): DispatchCheckResult {
  const reasons: string[] = [];
  const briefAbs = resolve(briefPath);
  if (!existsSync(briefAbs)) {
    return { ok: false, reasons: [`brief not found: ${briefAbs}`] };
  }
  const dtPath = briefDtPath(briefAbs);
  if (!existsSync(dtPath)) {
    reasons.push(`missing D_t sidecar: ${dtPath}`);
    return { ok: false, reasons };
  }
  let json: unknown;
  try {
    json = JSON.parse(readFileSync(dtPath, "utf-8"));
  } catch (err) {
    return { ok: false, reasons: [`D_t is not JSON: ${(err as Error).message}`] };
  }
  const validated = validatePlan(json);
  if (!validated.ok) {
    return { ok: false, reasons: validated.problems.map((p) => `D_t invalid: ${p}`) };
  }
  const reach = checkBriefReachableFromMaster(repoRoot, briefAbs, dtPath);
  if (!reach.ok) {
    return { ok: false, reasons: reach.reasons, checked_sha: reach.sha };
  }
  const records = listBriefGateRecords(briefAbs);
  if (records.length === 0) {
    reasons.push("no plan-gate decision record beside the brief — run harness plan-gate first");
    return { ok: false, reasons };
  }
  const liveRecords = records.filter((path) => {
    try {
      const rec = JSON.parse(readFileSync(path, "utf-8")) as BriefGateRecord;
      return rec.mode === "live";
    } catch {
      return false;
    }
  });
  if (liveRecords.length === 0) {
    reasons.push("no live plan-gate decision record — run harness plan-gate --mode live");
    return { ok: false, reasons };
  }
  const latest = liveRecords[liveRecords.length - 1]!;
  let latestRecord: BriefGateRecord;
  try {
    latestRecord = JSON.parse(readFileSync(latest, "utf-8")) as BriefGateRecord;
  } catch (err) {
    return { ok: false, reasons: [`latest gate record is not JSON: ${(err as Error).message}`] };
  }
  if (latestRecord.mode !== "live" || !latestRecord.sent) {
    reasons.push(
      `latest live gate record ${basename(latest)} was not consulted (mode=${latestRecord.mode}, sent=${latestRecord.sent})`,
    );
  }
  const verdict = (latestRecord.decision as GateDecision | null)?.verdict;
  if (verdict !== "proceed") {
    reasons.push(`latest gate record verdict is ${verdict ?? "absent"}, not proceed`);
  }
  return { ok: reasons.length === 0, reasons, checked_sha: reach.sha };
}

/** Stub transport for tests; live hub send is T-194. */
export interface BriefDispatchTransport {
  send(message: string): void | Promise<void>;
}

export interface RunBriefDispatchOptions {
  briefPath: string;
  message: string;
  repoRoot?: string;
  transport?: BriefDispatchTransport;
}

export interface RunBriefDispatchResult {
  ok: boolean;
  reasons: string[];
  checked_sha?: string;
}

/**
 * DT-7 — planner dispatch path: refuse before any send when dispatch-check would fail.
 * Planner runs: `harness dispatch <brief.md> --say "..." [--repo <root>]`
 */
export async function runBriefDispatch(options: RunBriefDispatchOptions): Promise<RunBriefDispatchResult> {
  const repoRoot = resolve(options.repoRoot ?? process.cwd());
  const briefAbs = resolve(options.briefPath);
  const check = checkBriefDispatchReady(briefAbs, repoRoot);
  if (!check.ok) {
    return { ok: false, reasons: check.reasons, checked_sha: check.checked_sha };
  }
  const transport = options.transport ?? {
    send(message: string): void {
      process.stdout.write(`${message}\n`);
    },
  };
  await transport.send(options.message);
  return { ok: true, reasons: [] };
}

/** Parse a gate-record filename; exposed for tests. */
export function parseBriefGateRecordName(name: string): { stem: string; id: string } | null {
  const m = name.match(GATE_RECORD_RE);
  if (!m) return null;
  return { stem: m[1]!, id: m[2]! };
}
