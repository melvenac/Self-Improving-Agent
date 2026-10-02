/**
 * T-216 — plan and evidence share ONE loop-id rule, so a planner brief's D_t
 * (seat id, e.g. `15-slice-4`) passes `harness validate plan` and the plan gate.
 */

import { describe, it, expect } from "vitest";
import { copyFileSync, mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import {
  EVIDENCE_LOOP_PATTERN,
  EvidenceSchema,
  LOOP_ID_PATTERN,
  PlanSchema,
  validateDeveloperReport,
  validatePlan,
} from "../../src/harness/schema.js";

const TSX = resolve(__dirname, "../../node_modules/tsx/dist/cli.mjs");
const CLI = resolve(__dirname, "../../src/harness/cli.ts");
const SLICE4_DT = resolve(__dirname, "../../../docs/loops/loop-15-slice-4-brief.D_t.json");
const SLICE4_BRIEF = resolve(__dirname, "../../../docs/loops/loop-15-slice-4-brief.md");

const plan = (loop: string) => ({
  loop,
  objective: "one loop",
  tasks: ["run"],
  out_of_scope: ["nothing"],
  preserve: ["the suite"],
  acceptance: [{ id: "A1", observable: "files exist", type: "blackbox" as const }],
  repair_targets: ["a gap"],
  new_capability: "the harness records evidence",
});

function harness(args: readonly string[], cwd: string) {
  const r = spawnSync(process.execPath, [TSX, CLI, ...args], {
    cwd,
    encoding: "utf-8",
    shell: false,
    timeout: 120_000,
  });
  if (r.error) throw r.error;
  return { status: r.status, stdout: r.stdout ?? "", stderr: r.stderr ?? "" };
}

describe("T-216 shared loop-id rule", { timeout: 120_000 }, () => {
  it("L1 plan accepts a seat id and a runtime id", () => {
    for (const loop of ["15-slice-4", "15-slice-3-c", "t001", "t1234"]) {
      const r = validatePlan(plan(loop));
      expect(r.ok, `${loop}: ${r.ok ? "ok" : r.problems.join(" | ")}`).toBe(true);
    }
  });

  it("L2 plan refuses an empty id, a slash, ../x, a bare number, a dot and a space", () => {
    for (const loop of ["", "15/slice", "../x", "15", "15-slice.4", "15 slice", "15-slice-4\n"]) {
      expect(validatePlan(plan(loop)).ok, JSON.stringify(loop)).toBe(false);
    }
  });

  it("L2b T-217: plan refuses upper case, which a case-insensitive copy of the pattern would accept", () => {
    for (const loop of ["T001", "15-Slice-4", "15-SLICE-4", "t001A"]) {
      expect(validatePlan(plan(loop)).ok, JSON.stringify(loop)).toBe(false);
    }
  });

  /** The regex a schema's `loop` field applies, read from zod's own check list. */
  const loopRegex = (schema: unknown): RegExp => {
    const checks = (schema as { shape: { loop: { _zod: { def: { checks: { _zod: { def: { format?: string; pattern?: RegExp } } }[] } } } } }).shape.loop._zod.def.checks;
    const found = checks.filter((c) => c._zod.def.format === "regex");
    expect(found, "the loop field must carry exactly one regex check").toHaveLength(1);
    return found[0]!._zod.def.pattern as RegExp;
  };

  it("L3b T-217: PlanSchema's and EvidenceSchema's loop regex IS LOOP_ID_PATTERN, by identity", () => {
    expect(loopRegex(PlanSchema)).toBe(LOOP_ID_PATTERN);
    expect(loopRegex(EvidenceSchema)).toBe(LOOP_ID_PATTERN);
    // Identity, not equality: a copy with the same source and an added flag, or an identical literal,
    // survives the derived JSON Schema (it drops flags and compares text) and every row that only
    // reads accept and refuse.
    expect(loopRegex(PlanSchema)).not.toBe(/^(?:t\d{3,}|[0-9]+(?:-[a-z0-9]+)+)$/);
    expect(loopRegex(PlanSchema).flags).toBe("");
  });

  it("L3 plan and evidence use the same exported constant", () => {
    expect(EVIDENCE_LOOP_PATTERN).toBe(LOOP_ID_PATTERN);
    const planSchema = JSON.parse(
      readFileSync(resolve(__dirname, "../../src/harness/schemas/plan.schema.json"), "utf-8"),
    ) as { properties: { loop: { pattern: string } } };
    const evSchema = JSON.parse(
      readFileSync(resolve(__dirname, "../../src/harness/schemas/evidence.schema.json"), "utf-8"),
    ) as { properties: { loop: { pattern: string } } };
    expect(planSchema.properties.loop.pattern).toBe(evSchema.properties.loop.pattern);
  });

  it("L4 the developer report stays runtime-only (tNNN)", () => {
    const base = { summary: "s", changes: [], commands: [], claims: [] };
    expect(validateDeveloperReport({ ...base, loop: "t001" }).ok).toBe(true);
    expect(validateDeveloperReport({ ...base, loop: "15-slice-4" }).ok).toBe(false);
  });

  it("L5 validate plan exits 0 on the slice-four D_t, unedited", () => {
    const r = harness(["validate", "plan", SLICE4_DT], process.cwd());
    expect(r.status, `${r.stderr}\n${r.stdout}`).toBe(0);
  });

  it("L6 plan-gate dry-run reaches the gate on the slice-four D_t without a loop-id refusal", () => {
    const dir = mkdtempSync(join(tmpdir(), "t216-"));
    const dt = join(dir, "loop-15-slice-4-brief.D_t.json");
    const brief = join(dir, "loop-15-slice-4-brief.md");
    copyFileSync(SLICE4_DT, dt);
    copyFileSync(SLICE4_BRIEF, brief);
    const r = harness(["plan-gate", dt, "--brief", brief, "--mode", "dry-run", "--repo", dir], dir);
    const out = `${r.stderr}\n${r.stdout}`;
    expect(out).not.toContain("loop must");
    expect(out).toContain("G_plan");
  });
});
