/**
 * JEV-CAL-2: send the frozen `request` field from a calibration input file byte-for-byte.
 * Does not rebuild from git or D_t.
 */

import { createHash } from "node:crypto";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { basename, dirname, join, relative, resolve } from "node:path";
import {
  GateCallFailed,
  GateUnavailable,
  JEV_ENDPOINT,
  JEV_KEY_VAR,
  JEV_MIN_MODEL,
  jevModelAtLeast,
  redact,
  type GateAnswer,
  type GatePayload,
  type GateTransport,
} from "./gate.js";
import { gitBlobSha, toPosix, writeSliceRecord, type ShadowDoneRecord, type Subject } from "./gate-records.js";
import {
  DoneGatePolicySchema,
  PolicyUnreadable,
  decideDoneGate,
  type DoneGatePolicy,
  type GateDecision,
} from "./policies.js";
import { validatePlan, type Plan } from "./schema.js";
import {
  SHADOW_RUNTIME_ACTION,
  ShadowRunError,
  allocateRecordPath,
  consult,
  failureNote,
  policyHash,
  type ShadowMode,
} from "./shadow-gates.js";

export const CAL2_INPUT_WRAPPER_KEYS = new Set([
  "base_sha",
  "candidate_sha",
  "case_id",
  "case_no",
  "checks_hint",
  "diff_paths_excluded",
  "label",
  "leak_details",
  "leak_hits",
  "merge_commit",
  "plan_redacted_sentences",
  "policy",
  "request",
]);

export const WIRE_REQUEST_KEYS = new Set(["model", "state", "questions"]);

/** Extract the raw JSON value bytes of the top-level `request` property (for byte-identical wire bodies). */
export function sliceTopLevelRequestBytes(fileUtf8: string): Buffer {
  const m = /"request"\s*:\s*/.exec(fileUtf8);
  if (!m) throw new ShadowRunError('input file has no top-level "request" field', 2);
  let i = m.index + m[0].length;
  while (i < fileUtf8.length && /[\s\r\n]/.test(fileUtf8[i]!)) i += 1;
  const start = i;
  if (fileUtf8[i] !== "{") throw new ShadowRunError("request field is not a JSON object", 2);
  let depth = 0;
  let inString = false;
  let escape = false;
  for (; i < fileUtf8.length; i += 1) {
    const c = fileUtf8[i]!;
    if (inString) {
      if (escape) escape = false;
      else if (c === "\\") escape = true;
      else if (c === '"') inString = false;
      continue;
    }
    if (c === '"') {
      inString = true;
      continue;
    }
    if (c === "{") depth += 1;
    else if (c === "}") {
      depth -= 1;
      if (depth === 0) return Buffer.from(fileUtf8.slice(start, i + 1), "utf-8");
    }
  }
  throw new ShadowRunError("request field JSON is truncated", 2);
}

export function loadDoneGatePolicyFile(path: string): DoneGatePolicy {
  const abs = resolve(path);
  if (!existsSync(abs)) throw new PolicyUnreadable(`policy file missing: ${abs}`);
  let parsed: unknown;
  try {
    parsed = JSON.parse(readFileSync(abs, "utf-8"));
  } catch (err) {
    throw new PolicyUnreadable(`policy file ${abs} is not valid JSON: ${(err as Error).message}`);
  }
  const r = DoneGatePolicySchema.safeParse(parsed);
  if (!r.success) {
    const problems = r.error.issues.map((issue) => `${issue.path.join(".") || "(root)"}: ${issue.message}`);
    throw new PolicyUnreadable(`policy file ${abs} does not match the done-gate schema: ${problems.join("; ")}`);
  }
  return r.data;
}

export function validateCal2InputWrapper(parsed: Record<string, unknown>): void {
  for (const key of Object.keys(parsed)) {
    if (!CAL2_INPUT_WRAPPER_KEYS.has(key)) {
      throw new ShadowRunError(`input file has disallowed top-level field "${key}"`, 2);
    }
  }
  if (parsed.request === undefined || typeof parsed.request !== "object" || parsed.request === null || Array.isArray(parsed.request)) {
    throw new ShadowRunError('input file "request" must be a JSON object', 2);
  }
  const req = parsed.request as Record<string, unknown>;
  if ("label" in req) throw new ShadowRunError('input request must not carry a top-level "label" field', 2);
  for (const key of Object.keys(req)) {
    if (!WIRE_REQUEST_KEYS.has(key)) {
      throw new ShadowRunError(`input request has disallowed field "${key}" (wire shape is model, state, questions only)`, 2);
    }
  }
}

export class FrozenWireTransport implements GateTransport {
  readonly name: string;
  readonly wireBody: Buffer;
  readonly sentBodies: Buffer[] = [];
  private readonly mode: ShadowMode;
  private readonly env: NodeJS.ProcessEnv;
  private readonly fetchImpl?: typeof fetch;
  private readonly sink: (line: string) => void;

  constructor(wireBody: Buffer, mode: ShadowMode, env: NodeJS.ProcessEnv, fetchImpl?: typeof fetch, sink: (line: string) => void = () => {}) {
    this.wireBody = wireBody;
    this.mode = mode;
    this.env = env;
    this.fetchImpl = fetchImpl;
    this.sink = sink;
    this.name = mode === "live" ? "jev-frozen-wire" : "dry-run-frozen-wire";
  }

  async dispatch(_payload: GatePayload): Promise<GateAnswer> {
    this.sentBodies.push(this.wireBody);
    if (this.mode === "dry-run") {
      this.sink(`--- frozen request (dry run, NOT sent): developer-done ---`);
      this.sink(redact(this.wireBody.toString("utf-8").slice(0, 4000), this.env));
      return {
        gate: "developer-done",
        answers: null,
        consulted: false,
        note: "dry run — frozen wire body recorded; no request was made.",
      };
    }
    const key = this.env[JEV_KEY_VAR];
    if (typeof key !== "string" || key.trim() === "") {
      throw new GateUnavailable(`${JEV_KEY_VAR} is not set; no request was sent.`);
    }
    if (typeof this.fetchImpl !== "function") {
      throw new GateUnavailable("no fetch implementation for live frozen request");
    }
    const response = await this.fetchImpl(JEV_ENDPOINT, {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: new Uint8Array(this.wireBody),
      signal: AbortSignal.timeout(30_000),
    });
    const raw = await response.text().catch(() => "");
    const safe = redact(raw, this.env).slice(0, 2000);
    if (!response.ok) {
      throw new GateCallFailed("transport", response.status, `developer-done: HTTP ${response.status}`, safe);
    }
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      throw new GateCallFailed("malformed-response", response.status, "response body is not JSON", safe);
    }
    const answers = (parsed as { answers?: Record<string, unknown> }).answers ?? null;
    const resolvedModel = (parsed as { model?: string }).model ?? null;
    if (!jevModelAtLeast(resolvedModel, JEV_MIN_MODEL)) {
      throw new GateCallFailed("malformed-response", response.status, `resolved model ${String(resolvedModel)} below ${JEV_MIN_MODEL}`);
    }
    return {
      gate: "developer-done",
      answers,
      consulted: true,
      note: "",
      resolvedModel,
      usage: (parsed as { usage?: Record<string, unknown> }).usage ?? null,
    };
  }
}

export type Cal2RunlistPhase = "dev" | "heldout";

export interface RunShadowDoneFrozenOptions {
  repoRoot: string;
  inputPath: string;
  policyPath: string;
  /** Must match the runlist row when runlist validation is used. */
  phase: Cal2RunlistPhase;
  /** Set when the CLI passed --phase explicitly (required for held-out rows). */
  phaseDeclared?: boolean;
  caseId?: string;
  runlistPath?: string;
  mode: ShadowMode;
  env?: NodeJS.ProcessEnv;
  transport?: GateTransport;
  fetchImpl?: typeof fetch;
  recordsDir?: string;
  ledgerPath?: string;
  at?: Date;
}

export interface RunShadowDoneFrozenResult {
  recordPath: string;
  record: ShadowDoneRecord;
  decision: GateDecision | null;
  exitCode: number;
  wireBody: Buffer;
}

export function findRunlistEntry(
  runlist: { phases: { dev: RunlistRow[]; heldout: RunlistRow[] } },
  caseId: string,
): { row: RunlistRow; phase: Cal2RunlistPhase } | null {
  for (const phase of ["dev", "heldout"] as const) {
    const row = runlist.phases[phase].find((e) => e.case_id === caseId);
    if (row) return { row, phase };
  }
  return null;
}

export interface RunlistRow {
  case_id: string;
  phase: Cal2RunlistPhase;
  input: string;
  policy: string;
  label: string;
  merge_commit: string;
  scored_sha: string;
  base_sha: string;
}

export function readCal2Input(inputPath: string): { parsed: Record<string, unknown>; wireBody: Buffer; fileUtf8: string } {
  const abs = resolve(inputPath);
  let fileUtf8: string;
  try {
    fileUtf8 = readFileSync(abs, "utf-8");
  } catch (err) {
    throw new ShadowRunError(`cannot read ${abs}: ${(err as Error).message}`, 2);
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(fileUtf8);
  } catch (err) {
    throw new ShadowRunError(`${abs}: not JSON: ${(err as Error).message}`, 1);
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new ShadowRunError(`${abs}: root must be an object`, 1);
  }
  const obj = parsed as Record<string, unknown>;
  validateCal2InputWrapper(obj);
  const wireBody = sliceTopLevelRequestBytes(fileUtf8);
  return { parsed: obj, wireBody, fileUtf8 };
}

export function assertRunlistPhaseGuards(
  options: RunShadowDoneFrozenOptions,
  inputRel: string,
  policyRel: string,
): void {
  if (!options.runlistPath || !options.caseId) return;
  const runlist = JSON.parse(readFileSync(resolve(options.runlistPath), "utf-8")) as {
    phases: { dev: RunlistRow[]; heldout: RunlistRow[] };
  };
  const found = findRunlistEntry(runlist, options.caseId);
  if (!found) throw new ShadowRunError(`case_id ${options.caseId} not in runlist`, 2);
  if (found.phase === "heldout" && options.phaseDeclared !== true) {
    throw new ShadowRunError("held-out runlist rows require an explicit --phase heldout on the command line", 2);
  }
  if (found.phase !== options.phase) {
    throw new ShadowRunError(
      `runlist phase is ${found.phase} but --phase ${options.phase} was given; they must match`,
      2,
    );
  }
  if (toPosix(found.row.input) !== toPosix(inputRel)) {
    throw new ShadowRunError(`runlist input ${found.row.input} does not match --request ${inputRel}`, 2);
  }
  if (toPosix(found.row.policy) !== toPosix(policyRel)) {
    throw new ShadowRunError(`runlist policy ${found.row.policy} does not match --policy ${policyRel}`, 2);
  }
  if (found.phase === "heldout" && options.phase !== "heldout") {
    throw new ShadowRunError("held-out runlist rows require --phase heldout", 2);
  }
}

/** No documented byte cap in HOH-JEV; 413 would be the HTTP signal if the API refuses. */
export const JEV_REQUEST_SIZE_HINT_BYTES = null as number | null;

export function requestSizeStats(wireBodies: number[]): {
  n: number;
  min: number;
  max: number;
  median: number;
  over_hint: number;
} {
  const sorted = [...wireBodies].sort((a, b) => a - b);
  const n = sorted.length;
  const median = n === 0 ? 0 : n % 2 === 1 ? sorted[(n - 1) / 2]! : Math.round((sorted[n / 2 - 1]! + sorted[n / 2]!) / 2);
  return {
    n,
    min: sorted[0] ?? 0,
    max: sorted[n - 1] ?? 0,
    median,
    over_hint: JEV_REQUEST_SIZE_HINT_BYTES === null ? 0 : sorted.filter((b) => b > JEV_REQUEST_SIZE_HINT_BYTES).length,
  };
}

export async function runShadowDoneFrozen(options: RunShadowDoneFrozenOptions): Promise<RunShadowDoneFrozenResult> {
  const repoRoot = resolve(options.repoRoot);
  const inputAbs = resolve(options.inputPath);
  const policyAbs = resolve(options.policyPath);
  const { parsed, wireBody } = readCal2Input(inputAbs);
  const inputRel = toPosix(relative(repoRoot, inputAbs));
  const policyRel = toPosix(relative(repoRoot, policyAbs));
  assertRunlistPhaseGuards(options, inputRel, policyRel);

  const policy = loadDoneGatePolicyFile(policyAbs);
  const request = parsed.request as Record<string, unknown>;
  const state = request.state as Record<string, unknown>;
  const planRaw = state.plan;
  const v = validatePlan(planRaw);
  if (!v.ok) throw new ShadowRunError(`frozen request state.plan invalid: ${v.problems.join("; ")}`, 1);
  const plan: Plan = v.value;
  const checks = state.checks as { source?: string; build?: { exit_code?: number | null }; unit?: { exit_code?: number | null } };
  const checksPassed =
    typeof checks?.build?.exit_code === "number" &&
    typeof checks?.unit?.exit_code === "number" &&
    checks.build.exit_code === 0 &&
    checks.unit.exit_code === 0;
  const checksSource = typeof checks?.source === "string" ? checks.source : "none";
  const scored = (state.scored_diff as { scored_sha?: string })?.scored_sha ?? String(parsed.candidate_sha ?? "");
  const merge = String(parsed.merge_commit ?? scored);
  const base = String(parsed.base_sha ?? "");
  const prRaw =
    typeof (state.scored_diff as { pr?: number })?.pr === "number"
      ? (state.scored_diff as { pr: number }).pr
      : Number(parsed.case_no ?? 1);
  const pr = Number.isInteger(prRaw) && prRaw >= 1 ? prRaw : 1;

  const env = options.env ?? process.env;
  const at = options.at ?? new Date();
  const recordsDir = resolve(options.recordsDir ?? join(repoRoot, "docs/loops/jev-calibration-2/records"));
  const stem = `cal2-${parsed.case_id ?? "case"}`;
  const recordPath = allocateRecordPath(recordsDir, stem, "G_done", at);
  const subject: Subject = { gate: "developer-done", key: scored, blob: createHash("sha256").update(wireBody).digest("hex") };

  const transport =
    options.transport ??
    new FrozenWireTransport(wireBody, options.mode, env, options.fetchImpl);

  const result = await consult({
    mode: options.mode,
    env,
    transport,
    payload: {
      gate: "developer-done",
      loop: plan.loop,
      model: String(request.model ?? "jev-latest"),
      questions: [],
      context: state as GatePayload["context"],
    },
    subject,
    recordPath: toPosix(relative(repoRoot, recordPath)),
    ledgerPath: options.ledgerPath,
    at,
  });

  const answers = result.answer?.answers ?? null;
  const decision =
    answers === null
      ? null
      : decideDoneGate(answers, policy, {
          checksPassed,
          checksSource,
          planAcceptanceIds: policy.plan_match === "requirement_rows" ? plan.acceptance.map((a) => a.id) : undefined,
        });

  const requestObj = JSON.parse(wireBody.toString("utf-8")) as Record<string, unknown>;
  const record: ShadowDoneRecord = {
    gate: "developer-done",
    loop: plan.loop,
    mode: options.mode,
    sent: result.answer?.consulted ?? false,
    requested_at: at.toISOString(),
    answered_at: result.answer === null ? null : new Date().toISOString(),
    model_requested: String(requestObj.model ?? "jev-latest"),
    model_resolved: result.answer?.resolvedModel ?? null,
    request: requestObj,
    answer: answers,
    usage: (result.answer?.usage ?? null) as Record<string, unknown> | null,
    decision: decision === null ? null : ({ ...decision } as unknown as Record<string, unknown>),
    runtime_action: SHADOW_RUNTIME_ACTION,
    note: result.error !== null ? failureNote(result.error) : (result.answer?.note ?? ""),
    source: "seat",
    plan_provenance: "written-before",
    attempt_id: result.attempt_id,
    subject,
    attempt: result.attempt,
    retry_of: result.retry_of,
    outcome_class: result.outcome_class,
    attempted_at: result.attempted_at,
    policy_hash: policyHash(dirname(policyAbs), basename(policyAbs)),
    pr,
    merge_commit: merge,
    scored_sha: scored,
    base_sha: base,
    dt: { path: inputRel, blob: gitBlobSha(readFileSync(inputAbs)) },
    checks_source: checksSource,
    checks_passed: checksPassed,
    diffstat: Array.isArray(state.diffstat) ? (state.diffstat as string[]) : [],
  };

  const safe = redact(record, env);
  writeSliceRecord(recordPath, safe);
  return { recordPath, record: safe, decision, exitCode: result.error !== null ? 1 : 0, wireBody };
}

export function reportCal2RequestSizes(
  repoRoot: string,
  inputsDir: string,
): ReturnType<typeof requestSizeStats> & { sizes_kb: { min: number; max: number; median: number } } {
  const dir = resolve(repoRoot, inputsDir);
  const bodies: number[] = [];
  for (const f of readdirSync(dir)) {
    if (!f.endsWith(".G_done-request.json")) continue;
    const { wireBody } = readCal2Input(join(dir, f));
    bodies.push(wireBody.length);
  }
  const stats = requestSizeStats(bodies);
  return {
    ...stats,
    sizes_kb: {
      min: Math.round(stats.min / 1024),
      max: Math.round(stats.max / 1024),
      median: Math.round(stats.median / 1024),
    },
  };
}
