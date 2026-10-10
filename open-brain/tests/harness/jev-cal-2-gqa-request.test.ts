import { describe, it, expect } from "vitest";
import { buildJevRequest, e_tStateForJev } from "../../src/harness/gate.js";

describe("Jev calibration 2 — G_qa request omits E_t statuses", () => {
  const ev = {
    loop: "qa-test",
    candidate_git: { sha: "a".repeat(40), branch: "loop/x", frozen_at: "2026-10-01T00:00:00Z" },
    runtime_checks: { build: { exit_code: 0 }, unit: { exit_code: 0 } },
    requirements: [{ id: "R1", status: "met", evidence: "saw it", severity: "minor" }],
    acceptance: [{ id: "A1", status: "unmet", evidence: "thin", order: "shown" }],
    regressions: [],
    gaps: [],
    notes: "",
  };

  it("e_tStateForJev drops met/unmet statuses from rows sent to Jev", () => {
    const state = e_tStateForJev(ev);
    expect(state.requirements).toEqual([{ id: "R1", evidence: "saw it", severity: "minor" }]);
    expect(state.acceptance).toEqual([{ id: "A1", evidence: "thin", order: "shown" }]);
    const wire = JSON.stringify(buildJevRequest({ gate: "qa-score", loop: "x", model: "jev-latest", questions: [], context: { e_t: state } }));
    expect(wire).not.toMatch(/"status"\s*:\s*"met"/);
    expect(wire).not.toMatch(/"status"\s*:\s*"unmet"/);
  });
});
