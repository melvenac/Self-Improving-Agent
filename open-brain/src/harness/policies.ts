/**
 * Gate thresholds as **data**, and the code that applies them.
 *
 * `docs/HOH-JEV.md` §4: *"Thresholds live in `harness/policies/`, never in a
 * prompt."* The reason is not tidiness. A threshold written into a prompt is a
 * number the model is asked to apply to itself; a threshold written into a
 * string literal is a number nobody can change without a source edit and a
 * rebuild. Neither can be tuned by the person the numbers are for.
 *
 * ## Three parts, and each is a different kind of thing
 *
 * 1. **The zod schemas here** are the contract: what a policy file may contain
 *    and what each field means. `.strict()` throughout, so a typo in a policy
 *    file is a refusal rather than a silently ignored key — the alternative is
 *    a run whose threshold came from the default because the name was
 *    misspelled.
 * 2. **The JSON files in `policies/`** are the values, read from disk at run
 *    time. Changing one changes the runtime's decision with no source change,
 *    which is exactly what A6 asserts.
 * 3. **`policies/policy.schema.json`** is DERIVED from (1), the `D-021`
 *    pattern, and a drift test compares it byte for byte.
 *
 * ## The asymmetry that shapes every policy below
 *
 * **`noul` answers carry no `confidence` field** — the returned number *is* the
 * probability. Only `choice` and `score` carry one. This was measured on the
 * wire on 2026-09-19, not read from the docs. So a policy phrased *"reject if X
 * is low with high confidence"* is expressible for a score and **not** for a
 * noul, and every noul rule here is a threshold on the value itself.
 *
 * ## Fail closed, including on absence
 *
 * A missing answer is a rejection, never a pass. *Missing evidence is
 * `untested`, never `pass`* is the QA rule; the same thing at a gate is a gate
 * that cannot be made to approve by failing to answer it.
 *
 * **And the limit that outranks all of these numbers:** typed output guarantees
 * the interface, not truth. A schema-valid answer is not a correct one. These
 * thresholds are a starting position and `docs/HOH-JEV.md` §9 says so —
 * nothing here has been calibrated against a loop.
 */

import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";

/* ------------------------------------------------------------------------- *
 * Answer shapes — the three Jev primitives as they come back
 * ------------------------------------------------------------------------- */

export const NoulAnswerSchema = z.object({ noul: z.number().min(0).max(1) });

export const ChoiceAnswerSchema = z.object({
  choice: z.string(),
  probabilities: z.record(z.string(), z.number()).optional(),
  confidence: z.number().min(0).max(1).optional(),
});

export const ScoreAnswerSchema = z.object({
  score: z.number(),
  /** An OBJECT in the response, keyed by index, while the request sends a list. */
  legend: z.record(z.string(), z.string()).optional(),
  probabilities: z.record(z.string(), z.number()).optional(),
  confidence: z.number().min(0).max(1).optional(),
});

export type NoulAnswer = z.infer<typeof NoulAnswerSchema>;
export type ChoiceAnswer = z.infer<typeof ChoiceAnswerSchema>;
export type ScoreAnswer = z.infer<typeof ScoreAnswerSchema>;

/* ------------------------------------------------------------------------- *
 * Policy shapes
 * ------------------------------------------------------------------------- */

const probability = z.number().min(0).max(1);

export const PlanGatePolicySchema = z
  .object({
    gate: z.literal("plan"),
    /** Reject below this. §4: "Reject has_observable_acceptance below 0.7". */
    has_observable_acceptance_min: probability,
    /** Reject at or above this score… */
    scope_size_reject_at_or_above: z.number(),
    /** …but only when the model is at least this confident. Scores carry confidence. */
    scope_size_reject_confidence_min: probability,
    preserves_validated_min: probability,
    addresses_top_failures_min: probability,
    /**
     * Whether `addresses_top_failures` is judged at all when there are no
     * prior failures to address.
     *
     * A threshold on a question with no referent is not a measurement. QA's F5:
     * the developer's accidental live call rejected the stub plan on
     * `addresses_top_failures 0.32` with `prior_failures: []` — which on the
     * CLI path makes the done gate unreachable and would leave A7 observing one
     * gate instead of two. A switch rather than a number, and it is data like
     * every other value here.
     */
    addresses_top_failures_requires_prior_failures: z.boolean(),
    /**
     * §4 rejects `repair_only` "unless S is already feature-complete", which is
     * a fact about the system and not about the plan. It is a switch rather
     * than a threshold, and it defaults to the rejecting side.
     */
    treat_system_as_feature_complete: z.boolean(),
    /** `stop_ship` halts only with deterministic-check and QA-history support. */
    stop_ship_requires_deterministic_failure: z.boolean(),
    stop_ship_requires_qa_history: z.boolean(),
  })
  .strict();

export const DoneGatePolicySchema = z
  .object({
    gate: z.literal("developer-done"),
    diff_matches_plan_min: probability,
    touches_out_of_scope_max: probability,
    local_tests_support_claim_min: probability,
    stuck_repeating_prior_failure_max: probability,
    /** Roll back at or above this score WHEN the deterministic checks failed. */
    risk_of_regression_rollback_at_or_above: z.number(),
    /** Hand to QA only with green deterministic checks. Exit codes, never the gate. */
    hand_to_qa_requires_green_checks: z.boolean(),
  })
  .strict();

/**
 * T-155. Gates stay optional until Jev is calibrated, so a missing gate record
 * is not `undefined` unless the flag says it is required. The fail-closed
 * flags are the default; turning one off is a recorded decision, not a default.
 */
/**
 * CC-1.2. The E_t inputs a verdict other than `undefined` needs. The merge gate
 * reads this list (shadow-merge.ts), so it cannot drift from behaviour. Both
 * literals in MERGE_MINIMUM_INPUTS must stay listed; more may be added.
 */
export const MERGE_INPUT_NAMES = ["runtime_checks", "E_t.acceptance", "E_t.requirements"] as const;
export const MERGE_MINIMUM_INPUTS = ["runtime_checks", "E_t.acceptance"] as const;

export const MergePolicySchema = z
  .object({
    gate: z.literal("merge"),
    required_inputs: z
      .array(z.enum(MERGE_INPUT_NAMES))
      .refine((names) => MERGE_MINIMUM_INPUTS.every((n) => names.includes(n)), {
        message: `required_inputs must list at least ${MERGE_MINIMUM_INPUTS.join(" and ")}`,
      }),
    require_plan_gate: z.boolean(),
    require_done_gate: z.boolean(),
    unmet_is_would_not_merge: z.boolean(),
    not_evaluated_is_would_not_merge: z.boolean(),
    partial_is_would_not_merge: z.boolean(),
    failed_check_is_would_not_merge: z.boolean(),
    gate_reject_or_halt_is_would_not_merge: z.boolean(),
  })
  .strict();

/**
 * 4.4. The QA-score gate, in shadow: what the gate would have decided about one `E_t`. The values
 * are a starting position chosen without data (HOH-JEV section 9), and the gate decides nothing
 * about a verdict: its decision is a field in a record.
 */
export const QaScorePolicySchema = z
  .object({
    gate: z.literal("qa-score"),
    /** Reject when `regression_of_validated` is above this. */
    regression_of_validated_max: probability,
    /** Reject when `artifact_complete_enough_to_stop` is below this. */
    artifact_complete_enough_to_stop_min: probability,
    /** Reject when any `fail` carries a severity at or above this. */
    fail_severity_reject_at_or_above: z.number(),
    /** Reject when any requirement is `fail`. */
    any_fail_is_reject: z.boolean(),
    /** Reject when any requirement is `untested`: missing evidence is not approval. */
    untested_is_reject: z.boolean(),
  })
  .strict();

export const QA_SCORE_POLICY_FILE = "qa-score.json";

export type PlanGatePolicy = z.infer<typeof PlanGatePolicySchema>;
export type QaScorePolicy = z.infer<typeof QaScorePolicySchema>;
export type DoneGatePolicy = z.infer<typeof DoneGatePolicySchema>;
export type MergePolicy = z.infer<typeof MergePolicySchema>;

export interface Policies {
  plan: PlanGatePolicy;
  done: DoneGatePolicy;
}

export const POLICY_FILES = { plan: "plan-gate.json", done: "developer-done.json" } as const;

export class PolicyUnreadable extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PolicyUnreadable";
  }
}

/**
 * Where the policy files live, resolved from this module rather than from cwd.
 *
 * The built CLI reads them from `build/harness/policies/`, which the build's
 * asset copy puts there. A missing directory is a refusal naming the build
 * step — never a fall back to a default, which would be a run whose thresholds
 * nobody chose.
 */
export function policiesDir(): string {
  return join(dirname(fileURLToPath(import.meta.url)), "policies");
}

/** Read and validate both policy files. Throws {@link PolicyUnreadable} on anything wrong. */
export function loadPolicies(dir: string = policiesDir()): Policies {
  if (!existsSync(dir)) {
    throw new PolicyUnreadable(
      `no policy directory at ${dir}. Gate thresholds are data and there is no built-in default — ` +
        `a run with thresholds nobody chose is worse than a run that refuses. If this is a built ` +
        `copy, the asset step did not run: npm run build.`,
    );
  }
  const read = <T>(file: string, schema: z.ZodType<T>): T => {
    const path = join(dir, file);
    if (!existsSync(path)) throw new PolicyUnreadable(`policy file missing: ${path}`);
    let parsed: unknown;
    try {
      parsed = JSON.parse(readFileSync(path, "utf-8"));
    } catch (err) {
      throw new PolicyUnreadable(`policy file ${path} is not valid JSON: ${(err as Error).message}`);
    }
    const r = schema.safeParse(parsed);
    if (!r.success) {
      const problems = r.error.issues.map((i) => `${i.path.join(".") || "(root)"}: ${i.message}`);
      throw new PolicyUnreadable(`policy file ${path} does not match the policy schema: ${problems.join("; ")}`);
    }
    return r.data;
  };
  return {
    plan: read(POLICY_FILES.plan, PlanGatePolicySchema),
    done: read(POLICY_FILES.done, DoneGatePolicySchema),
  };
}

/**
 * The merge policy is loaded on its own. `loadPolicies` stays plan + done so a
 * caller that writes only those two files into a temp directory still passes.
 */
export function loadMergePolicy(dir: string = policiesDir()): MergePolicy {
  const path = join(dir, "merge.json");
  if (!existsSync(path)) throw new PolicyUnreadable(`policy file missing: ${path}`);
  let parsed: unknown;
  try {
    parsed = JSON.parse(readFileSync(path, "utf-8"));
  } catch (err) {
    throw new PolicyUnreadable(`policy file ${path} is not valid JSON: ${(err as Error).message}`);
  }
  const r = MergePolicySchema.safeParse(parsed);
  if (!r.success) {
    const problems = r.error.issues.map((i) => `${i.path.join(".") || "(root)"}: ${i.message}`);
    throw new PolicyUnreadable(`policy file ${path} does not match the policy schema: ${problems.join("; ")}`);
  }
  return r.data;
}

/** The QA-score policy is loaded on its own, like the merge policy: `loadPolicies` stays plan + done. */
export function loadQaScorePolicy(dir: string = policiesDir()): QaScorePolicy {
  const path = join(dir, QA_SCORE_POLICY_FILE);
  if (!existsSync(path)) throw new PolicyUnreadable(`policy file missing: ${path}`);
  let parsed: unknown;
  try {
    parsed = JSON.parse(readFileSync(path, "utf-8"));
  } catch (err) {
    throw new PolicyUnreadable(`policy file ${path} is not valid JSON: ${(err as Error).message}`);
  }
  const r = QaScorePolicySchema.safeParse(parsed);
  if (!r.success) {
    const problems = r.error.issues.map((i) => `${i.path.join(".") || "(root)"}: ${i.message}`);
    throw new PolicyUnreadable(`policy file ${path} does not match the policy schema: ${problems.join("; ")}`);
  }
  return r.data;
}

/** The derived JSON Schema files, one per policy. `D-021`'s shape. */
export function policyJsonSchemas(): Record<"plan" | "done" | "merge" | "qa", Record<string, unknown>> {
  return {
    qa: {
      ...(z.toJSONSchema(QaScorePolicySchema, { io: "input" }) as Record<string, unknown>),
      title: "QA-score gate policy",
      description:
        "Thresholds for the QA-score gate, which runs in shadow and decides nothing about a verdict. " +
        "Values are data and may be edited; the SHAPE is derived from open-brain/src/harness/policies.ts " +
        "and this file must not be edited by hand. " +
        "LIMIT: missing evidence is recorded untested by code and is never asked of the gate. " +
        "PROVENANCE: docs/HOH-JEV.md section 4 gives the SHAPE of QA scoring and no thresholds at all; " +
        "every number in the shipped qa-score.json is a starting position chosen without data, PROVISIONAL.",
    },
    plan: {
      ...(z.toJSONSchema(PlanGatePolicySchema, { io: "input" }) as Record<string, unknown>),
      title: "Plan gate policy",
      description:
        "Thresholds for the plan gate. Values are data and may be edited; the SHAPE is derived " +
        "from open-brain/src/harness/policies.ts and this file must not be edited by hand. " +
        "LIMIT: noul answers carry no confidence field, so every noul rule is a threshold on the " +
        "value itself and no noul rule can be conditioned on confidence. " +
        "PROVENANCE: only has_observable_acceptance_min (0.7) and the 'scope_size near 2 at high " +
        "confidence rejects' rule come from docs/HOH-JEV.md §4. Every other number in the shipped " +
        "plan-gate.json is the developer's starting position, chosen without data. " +
        "LIMIT: these numbers are a starting position, not a calibration (docs/HOH-JEV.md §9).",
    },
    done: {
      ...(z.toJSONSchema(DoneGatePolicySchema, { io: "input" }) as Record<string, unknown>),
      title: "Developer done-gate policy",
      description:
        "Thresholds for the developer done-gate. Values are data and may be edited; the SHAPE is " +
        "derived from open-brain/src/harness/policies.ts and this file must not be edited by hand. " +
        "LIMIT: whether tests passed is read from process exit codes and is never asked of the " +
        "gate; no threshold here can make a red build green. " +
        "PROVENANCE: docs/HOH-JEV.md §4 gives the RULES (hand to QA when diff_matches_plan is " +
        "high, touches_out_of_scope low and tests green; roll back when stuck_repeating_prior_" +
        "failure is high, or risk_of_regression is high AND tests failed) and no numbers at all. " +
        "Every number in the shipped developer-done.json is the developer's starting position.",
    },
    merge: {
      ...(z.toJSONSchema(MergePolicySchema, { io: "input" }) as Record<string, unknown>),
      title: "Shadow merge policy",
      description:
        "Flags for the shadow merge gate (T-155). Values are data and may be edited; the SHAPE is " +
        "derived from open-brain/src/harness/policies.ts and this file must not be edited by hand. " +
        "LIMIT: require_plan_gate and require_done_gate default false until Jev is calibrated. " +
        "A required gate with no record is undefined, never would-merge. " +
        "PROVENANCE: the fail-closed flags are the candidate C criteria, not a calibration.",
    },
  };
}

/* ------------------------------------------------------------------------- *
 * Applying a policy
 * ------------------------------------------------------------------------- */

export type GateVerdict = "proceed" | "reject" | "halt";

export interface GateDecision {
  gate: string;
  verdict: GateVerdict;
  /** Every rule that fired, in the order it was evaluated. Empty on a clean proceed. */
  reasons: string[];
  /** The threshold values actually applied, so the artifact records what was used. */
  applied: Record<string, number | boolean>;
  /** Questions the answer set did not contain. Any one of these forces a reject. */
  missing: string[];
  /**
   * Questions whose rule did not apply, with no bearing on the verdict.
   *
   * Reported rather than silently skipped: a rule that did not fire and a rule
   * that passed are different facts, and a reader of the artifact must not have
   * to infer which happened.
   */
  notApplicable: string[];
}

/** Pull one typed answer out of the map, or null when it is absent or malformed. */
function typed<T>(
  answers: Record<string, unknown> | null,
  id: string,
  schema: z.ZodType<T>,
): T | null {
  if (answers === null) return null;
  const raw = answers[id];
  if (raw === undefined) return null;
  const r = schema.safeParse(raw);
  return r.success ? r.data : null;
}

export interface PlanGateContext {
  /** True when the deterministic checks of the PREVIOUS loop failed. */
  deterministicFailure: boolean;
  /** True when QA history supports a stop-ship. Never inferred from the gate. */
  qaHistorySupportsStopShip: boolean;
  /**
   * Whether the state sent to the gate carried any prior failures.
   *
   * Read from the state the runtime assembled, never from the gate's answer —
   * *do not ask a model anything code can compute.*
   */
  hasPriorFailures: boolean;
}

/**
 * Apply the plan-gate policy.
 *
 * Reads only from `policy` and `ctx` — **no number in this function**. That is
 * the property A6 rests on, and `tests/harness/policies.test.ts` asserts it by
 * scanning this source with a fixture that must match and one that must not.
 */
export function decidePlanGate(
  answers: Record<string, unknown> | null,
  policy: PlanGatePolicy,
  ctx: PlanGateContext,
): GateDecision {
  const reasons: string[] = [];
  const missing: string[] = [];
  const notApplicable: string[] = [];
  const applied: Record<string, number | boolean> = {
    has_observable_acceptance_min: policy.has_observable_acceptance_min,
    scope_size_reject_at_or_above: policy.scope_size_reject_at_or_above,
    scope_size_reject_confidence_min: policy.scope_size_reject_confidence_min,
    preserves_validated_min: policy.preserves_validated_min,
    addresses_top_failures_min: policy.addresses_top_failures_min,
    addresses_top_failures_requires_prior_failures: policy.addresses_top_failures_requires_prior_failures,
    treat_system_as_feature_complete: policy.treat_system_as_feature_complete,
    stop_ship_requires_deterministic_failure: policy.stop_ship_requires_deterministic_failure,
    stop_ship_requires_qa_history: policy.stop_ship_requires_qa_history,
  };

  const noul = (id: string, min: number): void => {
    const a = typed(answers, id, NoulAnswerSchema);
    if (a === null) {
      missing.push(id);
      return;
    }
    if (a.noul < min) reasons.push(`${id} ${a.noul} is below the required ${min}`);
  };

  noul("has_observable_acceptance", policy.has_observable_acceptance_min);
  noul("preserves_validated", policy.preserves_validated_min);
  if (policy.addresses_top_failures_requires_prior_failures && !ctx.hasPriorFailures) {
    // Asked, so the answer is on the record; not judged, because there is
    // nothing for it to be about.
    notApplicable.push("addresses_top_failures");
  } else {
    noul("addresses_top_failures", policy.addresses_top_failures_min);
  }

  const scope = typed(answers, "scope_size", ScoreAnswerSchema);
  // A score with no confidence is MISSING, not a score with low confidence.
  // Defaulting the absent value to zero would make this rule unable to fire —
  // fail-open, in the one direction that matters — and a score answer that
  // arrived without the confidence the API documents is a malformed answer
  // rather than a cautious one.
  if (scope === null || scope.confidence === undefined) missing.push("scope_size");
  else if (
    scope.score >= policy.scope_size_reject_at_or_above &&
    scope.confidence >= policy.scope_size_reject_confidence_min
  ) {
    reasons.push(
      `scope_size ${scope.score} at confidence ${scope.confidence} is at or above the ` +
        `rejecting score ${policy.scope_size_reject_at_or_above} at or above confidence ` +
        `${policy.scope_size_reject_confidence_min}`,
    );
  }

  const mode = typed(answers, "plan_mode", ChoiceAnswerSchema);
  let halt = false;
  if (mode === null) missing.push("plan_mode");
  else if (mode.choice === "repair_only" && !policy.treat_system_as_feature_complete) {
    reasons.push(`plan_mode repair_only is rejected while the system is not treated as feature-complete`);
  } else if (mode.choice === "stop_ship") {
    const supported =
      (!policy.stop_ship_requires_deterministic_failure || ctx.deterministicFailure) &&
      (!policy.stop_ship_requires_qa_history || ctx.qaHistorySupportsStopShip);
    if (supported) {
      halt = true;
      reasons.push(`plan_mode stop_ship, supported by the deterministic checks and QA history`);
    } else {
      reasons.push(
        `plan_mode stop_ship is NOT supported by the deterministic checks or QA history — ` +
          `a halt on the gate alone is refused, so this is a rejection rather than a halt`,
      );
    }
  }

  if (missing.length > 0) {
    reasons.push(`the gate did not answer: ${missing.join(", ")} — missing evidence is not approval`);
  }

  const verdict: GateVerdict = halt ? "halt" : reasons.length > 0 ? "reject" : "proceed";
  return { gate: "plan", verdict, reasons, applied, missing, notApplicable };
}

export interface DoneGateContext {
  /** From process exit codes. Never asked of the gate (§3, §4). */
  checksPassed: boolean;
  /** Where the exit codes came from; `none` means none were supplied (T-222 F6). Absent: from process exit codes. */
  checksSource?: string;
}

/** Apply the developer done-gate policy. No number in this function; see {@link decidePlanGate}. */
export function decideDoneGate(
  answers: Record<string, unknown> | null,
  policy: DoneGatePolicy,
  ctx: DoneGateContext,
): GateDecision {
  const reasons: string[] = [];
  const missing: string[] = [];
  const applied: Record<string, number | boolean> = {
    diff_matches_plan_min: policy.diff_matches_plan_min,
    touches_out_of_scope_max: policy.touches_out_of_scope_max,
    local_tests_support_claim_min: policy.local_tests_support_claim_min,
    stuck_repeating_prior_failure_max: policy.stuck_repeating_prior_failure_max,
    risk_of_regression_rollback_at_or_above: policy.risk_of_regression_rollback_at_or_above,
    hand_to_qa_requires_green_checks: policy.hand_to_qa_requires_green_checks,
  };

  const need = (id: string): NoulAnswer | null => {
    const a = typed(answers, id, NoulAnswerSchema);
    if (a === null) missing.push(id);
    return a;
  };

  const matches = need("diff_matches_plan");
  if (matches !== null && matches.noul < policy.diff_matches_plan_min) {
    reasons.push(`diff_matches_plan ${matches.noul} is below the required ${policy.diff_matches_plan_min}`);
  }

  const outOfScope = need("touches_out_of_scope");
  if (outOfScope !== null && outOfScope.noul > policy.touches_out_of_scope_max) {
    reasons.push(`touches_out_of_scope ${outOfScope.noul} is above the permitted ${policy.touches_out_of_scope_max}`);
  }

  const supportsClaim = need("local_tests_support_claim");
  if (supportsClaim !== null && supportsClaim.noul < policy.local_tests_support_claim_min) {
    reasons.push(
      `local_tests_support_claim ${supportsClaim.noul} is below the required ` +
        `${policy.local_tests_support_claim_min}`,
    );
  }

  const stuck = need("stuck_repeating_prior_failure");
  if (stuck !== null && stuck.noul > policy.stuck_repeating_prior_failure_max) {
    reasons.push(
      `stuck_repeating_prior_failure ${stuck.noul} is above the permitted ` +
        `${policy.stuck_repeating_prior_failure_max} — roll back rather than retry the same failure`,
    );
  }

  const risk = typed(answers, "risk_of_regression", ScoreAnswerSchema);
  if (risk === null) missing.push("risk_of_regression");
  else if (risk.score >= policy.risk_of_regression_rollback_at_or_above && !ctx.checksPassed) {
    reasons.push(
      `risk_of_regression ${risk.score} is at or above ${policy.risk_of_regression_rollback_at_or_above} ` +
        `AND the deterministic checks failed — the score alone would not be enough`,
    );
  }

  // The exit codes, not the gate. §3: never ask Jev whether tests passed.
  if (policy.hand_to_qa_requires_green_checks && !ctx.checksPassed) {
    reasons.push(
      ctx.checksSource === "none"
        ? `no deterministic checks were supplied`
        : `the deterministic checks failed (read from process exit codes, not from the gate)`,
    );
  }

  if (missing.length > 0) {
    reasons.push(`the gate did not answer: ${missing.join(", ")} — missing evidence is not approval`);
  }

  return {
    gate: "developer-done",
    verdict: reasons.length > 0 ? "reject" : "proceed",
    reasons,
    applied,
    missing,
    notApplicable: [],
  };
}

export interface QaScoreInput {
  /** One per requirement or acceptance row, already reduced from the gate's answers. */
  results: readonly { id: string; result: "pass" | "fail" | "untested"; severity: number | null }[];
  regressionOfValidated: number | null;
  artifactCompleteEnoughToStop: number | null;
  /** Ids the gate did not answer. Any one of these forces a reject. */
  missing: readonly string[];
}

/** Apply the QA-score policy. No number in this function; see {@link decidePlanGate}. */
export function decideQaScore(input: QaScoreInput, policy: QaScorePolicy): GateDecision {
  const reasons: string[] = [];
  const applied: Record<string, number | boolean> = {
    regression_of_validated_max: policy.regression_of_validated_max,
    artifact_complete_enough_to_stop_min: policy.artifact_complete_enough_to_stop_min,
    fail_severity_reject_at_or_above: policy.fail_severity_reject_at_or_above,
    any_fail_is_reject: policy.any_fail_is_reject,
    untested_is_reject: policy.untested_is_reject,
  };
  const missing = [...input.missing];
  if (input.regressionOfValidated === null) missing.push("regression_of_validated");
  else if (input.regressionOfValidated > policy.regression_of_validated_max) {
    reasons.push(
      `regression_of_validated ${input.regressionOfValidated} is above the permitted ${policy.regression_of_validated_max}`,
    );
  }
  if (input.artifactCompleteEnoughToStop === null) missing.push("artifact_complete_enough_to_stop");
  else if (input.artifactCompleteEnoughToStop < policy.artifact_complete_enough_to_stop_min) {
    reasons.push(
      `artifact_complete_enough_to_stop ${input.artifactCompleteEnoughToStop} is below the required ` +
        `${policy.artifact_complete_enough_to_stop_min}`,
    );
  }
  const failed = input.results.filter((r) => r.result === "fail");
  if (policy.any_fail_is_reject && failed.length > 0) {
    reasons.push(`${failed.length} requirement(s) failed: ${failed.map((r) => r.id).join(", ")}`);
  }
  for (const f of failed) {
    if (f.severity !== null && f.severity >= policy.fail_severity_reject_at_or_above) {
      reasons.push(`${f.id} failed at severity ${f.severity}, at or above ${policy.fail_severity_reject_at_or_above}`);
    }
  }
  const untested = input.results.filter((r) => r.result === "untested");
  if (policy.untested_is_reject && untested.length > 0) {
    reasons.push(`${untested.length} requirement(s) untested: ${untested.map((r) => r.id).join(", ")} — missing evidence is not approval`);
  }
  if (missing.length > 0) {
    reasons.push(`the gate did not answer: ${missing.join(", ")} — missing evidence is not approval`);
  }
  return {
    gate: "qa-score",
    verdict: reasons.length > 0 ? "reject" : "proceed",
    reasons,
    applied,
    missing,
    notApplicable: [],
  };
}
