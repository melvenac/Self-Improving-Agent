import { describe, it, expect } from "vitest";
import { buildDoneGateQuestions, planRowQuestionId } from "../../src/harness/gate.js";
import { decideDoneGate, type DoneGatePolicy } from "../../src/harness/policies.js";

const basePolicy: DoneGatePolicy = {
  gate: "developer-done",
  diff_matches_plan_min: 0.7,
  touches_out_of_scope_max: 0.3,
  local_tests_support_claim_min: 0.6,
  stuck_repeating_prior_failure_max: 0.6,
  risk_of_regression_rollback_at_or_above: 1.5,
  hand_to_qa_requires_green_checks: true,
};

describe("Jev calibration 2 — per-requirement-row done gate", () => {
  const plan = { acceptance: [{ id: "T1", observable: "runs vitest" }, { id: "T2", observable: "updates docs" }] };

  it("default policy keeps diff_matches_plan question", () => {
    const qs = buildDoneGateQuestions(plan, basePolicy);
    expect(qs.some((q) => q.id === "diff_matches_plan")).toBe(true);
    expect(qs.some((q) => q.id === planRowQuestionId("T1"))).toBe(false);
  });

  it("requirement_rows policy swaps diff_matches_plan for per-row nouls and combines them", () => {
    const policy: DoneGatePolicy = { ...basePolicy, plan_match: "requirement_rows", requirement_row_min_noul: 0.8 };
    const qs = buildDoneGateQuestions(plan, policy);
    expect(qs.some((q) => q.id === "diff_matches_plan")).toBe(false);
    expect(qs.filter((q) => q.id.startsWith("plan_row:")).length).toBe(2);
    const answers = {
      [planRowQuestionId("T1")]: { noul: 0.9 },
      [planRowQuestionId("T2")]: { noul: 0.5 },
      touches_out_of_scope: { noul: 0.1 },
      local_tests_support_claim: { noul: 0.9 },
      stuck_repeating_prior_failure: { noul: 0.1 },
      risk_of_regression: { score: 0.2 },
    };
    const d = decideDoneGate(answers, policy, { checksPassed: true, planAcceptanceIds: ["T1", "T2"] });
    expect(d.verdict).toBe("reject");
    expect(d.reasons.some((r) => r.startsWith(planRowQuestionId("T2")))).toBe(true);
    const ok = decideDoneGate(
      { ...answers, [planRowQuestionId("T2")]: { noul: 0.85 } },
      policy,
      { checksPassed: true, planAcceptanceIds: ["T1", "T2"] },
    );
    expect(ok.verdict).toBe("proceed");
  });

  it("checks rule can reject under requirement_rows while counterfactual proceeds", () => {
    const policy: DoneGatePolicy = { ...basePolicy, plan_match: "requirement_rows" };
    const answers = {
      [planRowQuestionId("T1")]: { noul: 0.95 },
      [planRowQuestionId("T2")]: { noul: 0.95 },
      touches_out_of_scope: { noul: 0.05 },
      local_tests_support_claim: { noul: 0.9 },
      stuck_repeating_prior_failure: { noul: 0.05 },
      risk_of_regression: { score: 0.2 },
    };
    const built = decideDoneGate(answers, policy, { checksPassed: false, checksSource: "none", planAcceptanceIds: ["T1", "T2"] });
    const cf = decideDoneGate(answers, policy, { checksPassed: true, planAcceptanceIds: ["T1", "T2"] });
    expect(built.verdict).toBe("reject");
    expect(cf.verdict).toBe("proceed");
  });
});
