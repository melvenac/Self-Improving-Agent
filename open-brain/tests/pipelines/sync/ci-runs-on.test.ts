import { describe, it, expect } from "vitest";
import { join } from "node:path";
import {
  evaluateCiTestRunsOn,
  readCiTestRunsOnExpr,
  ciTestRunsOnExprMatchesPin,
  TCM_RUNNER,
  UBUNTU_RUNNER,
  type CiRunsOnContext,
} from "../../../src/pipelines/sync/ci-runs-on.js";

const repoRoot = join(import.meta.dirname, "../../../..");

/** Pre-T-192 expression — mutant: master push selects ubuntu-latest again. */
function evaluatePreT192(ctx: CiRunsOnContext): string | readonly string[] {
  const masterPush = ctx.event_name === "push" && ctx.ref === "refs/heads/master";
  return (masterPush || ctx.hosted) ? UBUNTU_RUNNER : TCM_RUNNER;
}

describe("ci.yml test job runs-on (T-192 item 1)", () => {
  const cases: Array<[string, CiRunsOnContext, string | readonly string[]]> = [
    ["master push → tcm", { event_name: "push", ref: "refs/heads/master", hosted: false }, TCM_RUNNER],
    ["dispatch → tcm", { event_name: "workflow_dispatch", ref: "refs/heads/master", hosted: false }, TCM_RUNNER],
    ["dispatch hosted=true → ubuntu-latest", { event_name: "workflow_dispatch", ref: "refs/heads/master", hosted: true }, UBUNTU_RUNNER],
    ["push to non-master branch → tcm", { event_name: "push", ref: "refs/heads/feature/x", hosted: false }, TCM_RUNNER],
  ];

  it("parses ci.yml with a YAML parser and the pinned expression matches T-192", () => {
    const expr = readCiTestRunsOnExpr(repoRoot);
    expect(expr).toContain("${{");
    expect(ciTestRunsOnExprMatchesPin(expr)).toBe(true);
    expect(expr).not.toContain("github.event_name == 'push'");
  });

  for (const [label, ctx, want] of cases) {
    it(`evaluateCiTestRunsOn: ${label}`, () => {
      expect(evaluateCiTestRunsOn(ctx)).toEqual(want);
    });
  }

  it("mutant: restoring the master-push clause makes master push select ubuntu-latest (first case red)", () => {
    const ctx = cases[0][1];
    expect(evaluateCiTestRunsOn(ctx)).toEqual(TCM_RUNNER);
    expect(evaluatePreT192(ctx)).toBe(UBUNTU_RUNNER);
  });
});
