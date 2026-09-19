/**
 * Deliverable schemas for the HoH loop — `D_t` (the plan) and `E_t` (the
 * evidence), from `docs/HOH-JEV.md` §5.
 *
 * ## Why zod is the source and the `.json` files are derived
 *
 * The brief names `plan.schema.json` and `evidence.schema.json` as
 * deliverables. Hand-maintaining a JSON Schema beside a runtime validator is
 * two statements of one shape, and this repo's record is mostly the same
 * defect: a number, a count or a rule copied into a second place and falsified
 * by an ordinary edit to the first. So the zod schema is the single source and
 * the JSON files are **derived** by {@link jsonSchemas}. `schemas.test.ts`
 * regenerates and compares, so a drifted file fails the suite rather than
 * shipping.
 *
 * The JSON files are not decoration: they are the role-facing contract. The
 * retry message hands the offending role its schema, and the dry-run gate
 * payload embeds it. Slice two's prompts point at the same files.
 *
 * ## What this module CANNOT do, stated here so nobody trusts it past it
 *
 * 1. **A schema-valid deliverable is not a correct one.** *Typed output
 *    guarantees the interface, not truth* — TypeSafe's own line, and it is this
 *    project's lesson arriving from outside. Nothing here reads a plan for
 *    sense; it reads it for shape.
 * 2. **It validates what it is handed.** If a role writes to disk and reports
 *    something else, the shape check passes. That gap is covered by the
 *    workspace allowlist and the frozen ref, not here.
 */

import { z } from "zod";

/** Acceptance criterion inside a plan: what will be observed, and how. */
export const AcceptanceCriterionSchema = z.strictObject({
  id: z.string().min(1),
  observable: z.string().min(1),
  type: z.enum(["blackbox", "whitebox"]),
});

/**
 * `stop_ship` — the only escape from the "one new capability" rule.
 *
 * It is deliberately awkward: `requested` must be the literal `true` and the
 * justification must be a real sentence. An escape hatch that is easy to reach
 * is not a rule, and `new_capability: ""` with `stop_ship: {}` beside it would
 * be exactly the silent widening this whole loop exists to stop.
 */
export const StopShipSchema = z.strictObject({
  requested: z.literal(true),
  justification: z.string().min(20),
});

/**
 * `D_t` — the plan for one loop.
 *
 * **One rejection, not two, and the asymmetry is deliberate.**
 * **`new_capability` must be non-empty** unless `stop_ship` is requested and
 * justified.
 *
 * ## Why `repair_targets` may be empty — overturned on review, recorded here
 *
 * The first version of this schema also refused an empty `repair_targets`,
 * reading the source rule as symmetric: *"a loop that is only repair collapses
 * into local patching; one that is only capability abandons what the last loop
 * found"*. **The reading was faithful to the sentence and the rule was in the
 * wrong layer.**
 *
 * `new_capability` is checkable from `D_t` alone. *"Repairs outstanding
 * problems"* is only checkable against `E_{t-1}` — **which this schema never
 * sees.** It cannot know whether there was anything to repair. So a symmetric
 * schema rule refuses the two cases where there legitimately is nothing:
 * **the first loop of a project, which has no `E_{t-1}` at all, and any loop
 * following a clean `E_t`.** The runtime would have deadlocked on start and
 * again on success.
 *
 * The paper's own plan gate names `capability_increment` — *"adds a small new
 * observable capability with little repair"* — as a valid category. For a gate
 * to judge that against prior evidence, the schema has to let it through.
 * **The rule belongs in slice two's `addresses_top_failures` gate question,
 * which can see `E_{t-1}`, not here.**
 */
export const PlanSchema = z
  .strictObject({
    loop: z.string().regex(/^t\d{3,}$/, "loop must look like t001"),
    objective: z.string().min(1),
    tasks: z.array(z.string().min(1)).min(1),
    out_of_scope: z.array(z.string().min(1)),
    preserve: z.array(z.string().min(1)),
    acceptance: z.array(AcceptanceCriterionSchema).min(1),
    repair_targets: z.array(z.string().min(1)),
    new_capability: z.string(),
    stop_ship: StopShipSchema.optional(),
  })
  .superRefine((plan, ctx) => {
    if (plan.new_capability.trim() === "" && plan.stop_ship === undefined) {
      ctx.addIssue({
        code: "custom",
        path: ["new_capability"],
        message:
          "empty new_capability is refused unless stop_ship is explicitly requested and justified",
      });
    }
    const seen = new Set<string>();
    for (const [i, a] of plan.acceptance.entries()) {
      if (seen.has(a.id)) {
        ctx.addIssue({
          code: "custom",
          path: ["acceptance", i, "id"],
          message: `duplicate acceptance id "${a.id}" — ids are how evidence is matched to criteria`,
        });
      }
      seen.add(a.id);
    }
  });

/**
 * One deterministic check result.
 *
 * `exit_code` is the verdict and `passed` is derived from it. Nothing in this
 * runtime reads stdout to decide whether a check passed — see `checks.ts`,
 * which is where the number comes from, and acceptance A7.
 *
 * `exit_code` is nullable because a command that could not be spawned at all
 * has no exit code. That is a failure, never a pass: `passed` is `false` and
 * the reason travels in `detail`.
 */
export const CheckOutcomeSchema = z.strictObject({
  command: z.string().min(1),
  exit_code: z.number().int().nullable(),
  passed: z.boolean(),
  duration_ms: z.number().int().nonnegative(),
  detail: z.string(),
});

export const RequirementFindingSchema = z.strictObject({
  id: z.string().min(1),
  status: z.enum(["met", "unmet", "partial", "not_evaluated"]),
  evidence: z.string().min(1),
  severity: z.enum(["blocker", "major", "minor", "info"]),
});

/**
 * Acceptance findings carry `not_evaluated` on purpose.
 *
 * **Missing evidence is a gap, not a pass** (brief §7). A criterion nobody
 * looked at and a criterion that was checked and held must not render
 * identically, which is rule 11 applied to the evidence record itself.
 */
export const AcceptanceFindingSchema = z.strictObject({
  id: z.string().min(1),
  status: z.enum(["met", "unmet", "partial", "not_evaluated"]),
  evidence: z.string().min(1),
});

/** `E_t` — the evidence report for one loop, written by the QA seat. */
export const EvidenceSchema = z
  .strictObject({
    loop: z.string().regex(/^t\d{3,}$/, "loop must look like t001"),
    candidate_git: z.strictObject({
      sha: z.string().regex(/^[0-9a-f]{40}$/, "candidate sha must be a full 40-character sha"),
      branch: z.string().min(1),
      frozen_at: z.string().min(1),
    }),
    runtime_checks: z.strictObject({
      build: CheckOutcomeSchema,
      unit: CheckOutcomeSchema,
    }),
    requirements: z.array(RequirementFindingSchema),
    acceptance: z.array(AcceptanceFindingSchema).min(1),
    regressions: z.array(z.string().min(1)),
    gaps: z.array(z.string().min(1)),
    notes: z.string(),
  })
  .superRefine((ev, ctx) => {
    const seen = new Set<string>();
    for (const [i, a] of ev.acceptance.entries()) {
      if (seen.has(a.id)) {
        ctx.addIssue({
          code: "custom",
          path: ["acceptance", i, "id"],
          message: `duplicate acceptance id "${a.id}" in the evidence`,
        });
      }
      seen.add(a.id);
    }
  });

export type Plan = z.infer<typeof PlanSchema>;
export type Evidence = z.infer<typeof EvidenceSchema>;
export type CheckOutcome = z.infer<typeof CheckOutcomeSchema>;
export type AcceptanceCriterion = z.infer<typeof AcceptanceCriterionSchema>;

/** Which deliverable a validation concerns. Used for messages and file names. */
export type DeliverableKind = "plan" | "evidence";

export interface ValidationSuccess<T> {
  ok: true;
  value: T;
}

export interface ValidationFailure {
  ok: false;
  /** One line per problem, `path: message`, stable enough to assert on. */
  problems: string[];
}

export type ValidationOutcome<T> = ValidationSuccess<T> | ValidationFailure;

const describe = (issues: readonly z.core.$ZodIssue[]): string[] =>
  issues.map((i) => {
    const path = i.path.length > 0 ? i.path.join(".") : "(root)";
    return `${path}: ${i.message}`;
  });

export function validatePlan(input: unknown): ValidationOutcome<Plan> {
  const r = PlanSchema.safeParse(input);
  return r.success ? { ok: true, value: r.data } : { ok: false, problems: describe(r.error.issues) };
}

export function validateEvidence(input: unknown): ValidationOutcome<Evidence> {
  const r = EvidenceSchema.safeParse(input);
  return r.success ? { ok: true, value: r.data } : { ok: false, problems: describe(r.error.issues) };
}

export function validateDeliverable(
  kind: DeliverableKind,
  input: unknown,
): ValidationOutcome<Plan | Evidence> {
  return kind === "plan" ? validatePlan(input) : validateEvidence(input);
}

/**
 * The derived JSON Schema for each deliverable.
 *
 * `io: "input"` because these describe what a role must PRODUCE, not what the
 * runtime hands on afterwards. Custom refinements — the `new_capability` and
 * `repair_targets` rules above — are **not representable in JSON Schema** and
 * are therefore absent from the derived files. That is a real limit and it is
 * written into the generated file's own description rather than left for a
 * reader to discover by having a valid-looking plan refused.
 */
export function jsonSchemas(): Record<DeliverableKind, Record<string, unknown>> {
  return {
    plan: {
      ...(z.toJSONSchema(PlanSchema, { io: "input" }) as Record<string, unknown>),
      title: "D_t — HoH loop plan",
      description:
        "The plan for one HoH loop. LIMIT: one rule this schema cannot express is enforced by " +
        "the runtime and not by JSON Schema — new_capability must be non-empty unless stop_ship " +
        "is requested and justified. repair_targets is required but MAY be empty: whether a plan " +
        "repairs enough is only answerable against the previous loop's evidence, which this " +
        "schema never sees, so it belongs to the plan gate and not here. " +
        "Derived from open-brain/src/harness/schema.ts; do not edit by hand.",
    },
    evidence: {
      ...(z.toJSONSchema(EvidenceSchema, { io: "input" }) as Record<string, unknown>),
      title: "E_t — HoH loop evidence",
      description:
        "The QA evidence report for one HoH loop. LIMIT: runtime_checks are supplied by the " +
        "runtime from process exit codes, not by the QA role; a role-supplied value that " +
        "disagrees with the measurement is refused. " +
        "Derived from open-brain/src/harness/schema.ts; do not edit by hand.",
    },
  };
}

/** Stable serialisation, so the on-disk file and the derived one compare byte for byte. */
export function serialiseSchema(schema: Record<string, unknown>): string {
  return `${JSON.stringify(schema, null, 2)}\n`;
}
