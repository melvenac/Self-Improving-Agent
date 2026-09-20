import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import {
  jsonSchemas,
  serialiseSchema,
  validateEvidence,
  validatePlan,
  type Plan,
} from "../../src/harness/schema.js";

/** A plan that passes, so each test can break exactly one thing. */
const validPlan = (): Plan => ({
  loop: "t001",
  objective: "The harness runs one loop end to end.",
  tasks: ["run the three stages"],
  out_of_scope: ["Jev client"],
  preserve: ["/start keeps working"],
  acceptance: [{ id: "A1", observable: "three artifact files exist", type: "blackbox" }],
  repair_targets: ["nothing enforces the seat boundaries"],
  new_capability: "harness runs a loop end to end",
});

const passingCheck = {
  command: "node -e ...",
  exit_code: 0,
  passed: true,
  duration_ms: 12,
  detail: "exit 0 in 12ms",
};

const validEvidence = (): Record<string, unknown> => ({
  loop: "t001",
  candidate_git: { sha: "a".repeat(40), branch: "main", frozen_at: "2026-09-19T00:00:00.000Z" },
  runtime_checks: { build: passingCheck, unit: passingCheck },
  requirements: [],
  acceptance: [{ id: "A1", status: "met", evidence: "observed the three files" }],
  regressions: [],
  gaps: [],
  notes: "",
});

describe("D_t schema", () => {
  it("accepts a well-formed plan", () => {
    const r = validatePlan(validPlan());
    expect(r.ok).toBe(true);
  });

  it("refuses an empty new_capability when stop_ship is absent", () => {
    const r = validatePlan({ ...validPlan(), new_capability: "   " });
    expect(r.ok).toBe(false);
    if (r.ok) throw new Error("unreachable");
    expect(r.problems.join("\n")).toContain("new_capability");
    expect(r.problems.join("\n")).toContain("stop_ship");
  });

  it("accepts an empty new_capability when stop_ship is requested AND justified", () => {
    const r = validatePlan({
      ...validPlan(),
      new_capability: "",
      stop_ship: { requested: true, justification: "The suite is red on master and nothing may ship until it is green." },
    });
    expect(r.ok).toBe(true);
  });

  it("refuses a stop_ship whose justification is a token gesture", () => {
    // The escape hatch is deliberately awkward. An easy one is not a rule.
    const r = validatePlan({
      ...validPlan(),
      new_capability: "",
      stop_ship: { requested: true, justification: "because" },
    });
    expect(r.ok).toBe(false);
  });

  it("refuses stop_ship: { requested: false } rather than reading it as an opt-out", () => {
    const r = validatePlan({
      ...validPlan(),
      new_capability: "",
      stop_ship: { requested: false, justification: "a".repeat(30) },
    });
    expect(r.ok).toBe(false);
  });

  it("ACCEPTS an empty repair_targets — the first loop of a project has nothing to repair", () => {
    // Overturned on review. An earlier version of this schema refused this,
    // reading the source rule as symmetric. The reading was faithful to the
    // sentence and the rule was in the wrong layer: "repairs outstanding
    // problems" is only answerable against E_{t-1}, which the schema never
    // sees. These two tests are the cases that rule deadlocked.
    const r = validatePlan({ ...validPlan(), repair_targets: [] });
    expect(r.ok).toBe(true);
  });

  it("ACCEPTS an empty repair_targets after a clean previous loop", () => {
    const r = validatePlan({
      ...validPlan(),
      repair_targets: [],
      new_capability: "adds one small observable capability with little repair",
    });
    expect(r.ok).toBe(true);
  });

  it("still requires repair_targets to be present as an array", () => {
    // Allowed to be empty is not the same as optional: an omitted field would
    // mean "nobody considered it", which is not the same fact as "nothing to
    // repair" and must not render identically.
    const plan = validPlan() as Partial<Plan>;
    delete plan.repair_targets;
    expect(validatePlan(plan).ok).toBe(false);
  });

  it("refuses an unknown key instead of ignoring it", () => {
    const r = validatePlan({ ...validPlan(), sneaky: true });
    expect(r.ok).toBe(false);
    if (r.ok) throw new Error("unreachable");
    expect(r.problems.join("\n")).toMatch(/sneaky/i);
  });

  it("refuses duplicate acceptance ids, because ids are how evidence is matched", () => {
    const r = validatePlan({
      ...validPlan(),
      acceptance: [
        { id: "A1", observable: "one", type: "blackbox" },
        { id: "A1", observable: "two", type: "whitebox" },
      ],
    });
    expect(r.ok).toBe(false);
    if (r.ok) throw new Error("unreachable");
    expect(r.problems.join("\n")).toContain("duplicate acceptance id");
  });

  it("refuses a loop id that is not tNNN", () => {
    expect(validatePlan({ ...validPlan(), loop: "loop-1" }).ok).toBe(false);
  });

  it("reports the path of each problem, so a retry can be told what to fix", () => {
    const r = validatePlan({ ...validPlan(), tasks: [], acceptance: [] });
    expect(r.ok).toBe(false);
    if (r.ok) throw new Error("unreachable");
    expect(r.problems.some((p) => p.startsWith("tasks:"))).toBe(true);
    expect(r.problems.some((p) => p.startsWith("acceptance:"))).toBe(true);
  });
});

describe("E_t schema", () => {
  it("accepts a well-formed evidence report", () => {
    expect(validateEvidence(validEvidence()).ok).toBe(true);
  });

  it("refuses a short or non-hex candidate sha", () => {
    expect(
      validateEvidence({
        ...validEvidence(),
        candidate_git: { sha: "abc1234", branch: "main", frozen_at: "now" },
      }).ok,
    ).toBe(false);
  });

  it("refuses evidence with no acceptance findings at all", () => {
    // A report that evaluated nothing must not validate as a report.
    expect(validateEvidence({ ...validEvidence(), acceptance: [] }).ok).toBe(false);
  });

  it("carries not_evaluated as a distinct status from met", () => {
    const r = validateEvidence({
      ...validEvidence(),
      acceptance: [{ id: "A1", status: "not_evaluated", evidence: "nobody looked at this one" }],
    });
    expect(r.ok).toBe(true);
    if (!r.ok) throw new Error("unreachable");
    expect(r.value.acceptance[0]!.status).toBe("not_evaluated");
  });

  it("requires a null exit_code to be spelled out rather than omitted", () => {
    const noCode = { ...passingCheck } as Record<string, unknown>;
    delete noCode.exit_code;
    expect(
      validateEvidence({ ...validEvidence(), runtime_checks: { build: noCode, unit: passingCheck } }).ok,
    ).toBe(false);
  });
});

describe("derived JSON Schema files", () => {
  const dir = resolve(__dirname, "../../src/harness/schemas");

  /**
   * The on-disk files are DERIVED from the zod schemas. This is the check that
   * keeps them from becoming a second, drifting statement of the same shape —
   * which is the defect family most of this project's record is made of.
   */
  it.each([
    ["plan", "plan.schema.json"],
    ["evidence", "evidence.schema.json"],
  ] as const)("%s.schema.json matches what the zod schema derives", (kind, file) => {
    const onDisk = readFileSync(join(dir, file), "utf-8");
    const derived = serialiseSchema(jsonSchemas()[kind]);
    expect(
      onDisk,
      `${file} has drifted from src/harness/schema.ts. Regenerate: npx tsx src/harness/cli.ts schemas --write`,
    ).toBe(derived);
  });

  it("states in the file the rules JSON Schema cannot express", () => {
    // A reader who validates against the JSON file alone would see a plan pass
    // that the runtime refuses. The limit is written where they will be.
    const plan = JSON.parse(readFileSync(join(dir, "plan.schema.json"), "utf-8")) as { description: string };
    expect(plan.description).toContain("new_capability");
    expect(plan.description).toContain("LIMIT");
    // And states the rule that was DELIBERATELY not made a schema rule, so a
    // reader does not reintroduce it.
    expect(plan.description).toContain("repair_targets is required but MAY be empty");
  });

  it("marks additionalProperties false, so an unknown key is refused by the file too", () => {
    const plan = JSON.parse(readFileSync(join(dir, "plan.schema.json"), "utf-8")) as {
      additionalProperties: boolean;
    };
    expect(plan.additionalProperties).toBe(false);
  });
});
