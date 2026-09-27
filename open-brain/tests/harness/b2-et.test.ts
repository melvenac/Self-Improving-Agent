/**
 * Loop 15 slice 3, candidate B part 2 — QA 132's BE-0..BE-8.
 *
 * Each row is a document or a command. A failure message includes what the
 * validator or the runtime actually returned, so a red run against the unfixed
 * product shows the reason the row names.
 *
 * The parser is loaded dynamically: on the unfixed product the module is
 * absent, and the failure is "no parser", which is BE-4's red.
 */
import { describe, it, expect, beforeAll, beforeEach, afterEach } from "vitest";
import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { jsonSchemas, validateDeveloperReport, validateEvidence, validatePlan } from "../../src/harness/schema.js";
import { runLoop, type LoopConfig } from "../../src/harness/runtime.js";
import { StubDeveloper, StubPlanner, StubQa, type RoleContext, type RoleSession } from "../../src/harness/roles.js";
import { exitingChecks, makeRepo, requireGit, type RepoFixture } from "./fixture.js";

const EVIDENCE_SCHEMA = resolve(__dirname, "../../src/harness/schemas/evidence.schema.json");
const PLAN_SCHEMA = resolve(__dirname, "../../src/harness/schemas/plan.schema.json");
const TSX = resolve(__dirname, "../../node_modules/tsx/dist/cli.mjs");
const CLI = resolve(__dirname, "../../src/harness/cli.ts");

/** Human-seat form, documented in schema.ts: digits, then hyphenated lowercase segments. */
const HUMAN_LOOP = "15-slice-3";

const passingCheck = {
  command: "node -e ...",
  exit_code: 0,
  passed: true,
  duration_ms: 12,
  detail: "exit 0 in 12ms",
};

/** Default row is `not_evaluated`, so a loop-id test is not also an order test. */
function evidence(over: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    loop: "t001",
    candidate_git: { sha: "a".repeat(40), branch: "main", frozen_at: "2026-09-27T00:00:00.000Z" },
    runtime_checks: { build: passingCheck, unit: { ...passingCheck } },
    requirements: [],
    acceptance: [{ id: "A1", status: "not_evaluated", evidence: "nobody looked" }],
    regressions: [],
    gaps: [],
    notes: "",
    ...over,
  };
}

function detail(doc: unknown): string {
  const r = validateEvidence(doc);
  return r.ok ? "ACCEPTED" : r.problems.join(" | ");
}

function stringEnums(node: unknown, acc: string[][] = []): string[][] {
  if (Array.isArray(node)) {
    for (const item of node) stringEnums(item, acc);
    return acc;
  }
  if (node && typeof node === "object") {
    const record = node as Record<string, unknown>;
    if (Array.isArray(record.enum) && record.enum.every((item) => typeof item === "string")) {
      acc.push([...(record.enum as string[])]);
    }
    for (const value of Object.values(record)) stringEnums(value, acc);
  }
  return acc;
}

const LEGACY_CRITERIA_A = `preamble\n\`\`\`qa-unrunnable
U1: network egress by a role process — the runtime has no network view and this seat does not capture traffic
U2: writes by a role outside the repository other than its runtime-chosen deliverable path — not observable by the runtime
U3: on win32, processes that outlive a NORMALLY-exiting role (R22 narrowed by ruling (b): no job object; a named limit in every iteration record); on every platform, processes that escape the role's process group or parent chain (setsid on POSIX, double-fork orphaning on win32) and processes started through a service or scheduler
U4: writes to the REAL ~/.gitconfig, $XDG_CONFIG_HOME/git/config or system gitconfig — machine-wide, Aaron's files; CA-4c/4e/4f/4g are probed via HOME, XDG_CONFIG_HOME, GIT_CONFIG_GLOBAL and GIT_CONFIG_SYSTEM simulation only
U5: the quality or correctness of the model-backed role's output in the first real run (CA-9) — an observation, not acceptance
U6: argv parsing INSIDE the native claude.exe — the binary's own command-line parser, not instrumentable by this seat; CA-2.4 verifies the runtime's resolution and spawn with an observable target
\`\`\`\ntrailer\n`;

/** Fence bytes from origin/qa/b-et-criteria-report @ 758a255, the qa-declared block. */
const CRITERIA_B = `before\n\`\`\`qa-declared
[unrunnable]
[out-of-scope]
BC-1: verdict undefined when any acceptance item is pending (R10(c)); needs C's verdict function
BC-2: declared ids excluded from the verdict, read at the criteria SHA (R10(d), R3); needs C's verdict function
BC-3: an E_t-listed id absent from the block counts not_evaluated (rulings-1 R3 refinement); needs C's verdict function
BC-4: the verdict weight of order: attributed (R10(b) is silent); unruled, and needs C
BC-5: pairing human-seat E_t files with criteria SHAs and Aaron's merges, keyed by loop id; needs C's ledger
\`\`\`\nafter\n`;

async function parseDeclared(text: string): Promise<{
  present: boolean;
  unrunnable?: readonly string[];
  outOfScope?: readonly string[];
}> {
  let mod: { parseDeclared: (input: string) => { present: boolean; unrunnable?: readonly string[]; outOfScope?: readonly string[] } };
  try {
    mod = await import("../../src/harness/declared.js");
  } catch (err) {
    throw new Error(`no parser: ${(err as Error).message}`);
  }
  return mod.parseDeclared(text);
}

function harness(args: readonly string[], cwd: string): { status: number | null; stdout: string; stderr: string } {
  const r = spawnSync(process.execPath, [TSX, CLI, ...args], {
    cwd,
    encoding: "utf-8",
    shell: false,
    timeout: 120_000,
  });
  if (r.error) throw r.error;
  return { status: r.status, stdout: r.stdout ?? "", stderr: r.stderr ?? "" };
}

const validPlan = () => ({
  loop: "t001",
  objective: "one loop",
  tasks: ["run"],
  out_of_scope: ["nothing"],
  preserve: ["the suite"],
  acceptance: [{ id: "A1", observable: "files exist", type: "blackbox" as const }],
  repair_targets: ["a gap"],
  new_capability: "the harness records evidence",
});

describe("BE-0 scope guards", () => {
  it("BE-0.1 PlanSchema keeps ^t\\d{3,}$", () => {
    const r = validatePlan({ ...validPlan(), loop: HUMAN_LOOP });
    expect(r.ok, r.ok ? "ACCEPTED" : r.problems.join(" | ")).toBe(false);
  });

  it("BE-0.1 DeveloperReportSchema keeps ^t\\d{3,}$", () => {
    const r = validateDeveloperReport({
      loop: HUMAN_LOOP,
      summary: "a human-seat id is not a runtime loop",
      changes: [],
      commands: [],
      claims: [],
    });
    expect(r.ok, r.ok ? "ACCEPTED" : r.problems.join(" | ")).toBe(false);
  });

  it("BE-0.1 plan.schema.json loop pattern is unchanged", () => {
    const plan = JSON.parse(readFileSync(PLAN_SCHEMA, "utf-8")) as { properties: { loop: { pattern: string } } };
    expect(plan.properties.loop.pattern).toBe("^t\\d{3,}$");
  });

  it("BE-1.2 harness run --loop 15-slice-3 still exits 2", () => {
    const r = harness(["run", "--loop", HUMAN_LOOP], process.cwd());
    expect(r.status, `${r.stderr}\n${r.stdout}`).toBe(2);
    expect(r.stderr).toContain("--loop must look like t001");
  });
});

describe("BE-1 loop id", () => {
  it("BE-1.1 accepts a runtime id t001", () => {
    expect(detail(evidence())).toBe("ACCEPTED");
  });

  it("BE-1.1 accepts the human-seat id 15-slice-3", () => {
    expect(detail(evidence({ loop: HUMAN_LOOP }))).toBe("ACCEPTED");
  });

  it("BE-1.1 accepts the documented human-seat form 15-slice-3-b", () => {
    expect(detail(evidence({ loop: "15-slice-3-b" }))).toBe("ACCEPTED");
  });

  it.each(["", " ", "a/b", "a\\b", "..", "../x", "15-slice-3\nextra"])(
    "BE-1.1 refuses %j",
    (loop) => {
      expect(detail(evidence({ loop }))).not.toBe("ACCEPTED");
    },
  );
});

describe("BE-2 order", () => {
  const FIVE = ["met", "unmet", "partial", "not_evaluated", "pending"];

  it("BE-2.1 the derived acceptance enum is exactly the five statuses, in the file and from zod", () => {
    const onDisk = JSON.parse(readFileSync(EVIDENCE_SCHEMA, "utf-8"));
    const derived = jsonSchemas().evidence;
    expect(stringEnums(onDisk)).toContainEqual(FIVE);
    expect(stringEnums(derived)).toContainEqual(FIVE);
    // requirements stay at four. pending is an acceptance observation.
    expect(stringEnums(onDisk)).toContainEqual(["met", "unmet", "partial", "not_evaluated"]);
    for (const values of stringEnums(onDisk)) {
      if (values.includes("met")) expect(values).not.toContain("attributed");
    }
  });

  it("BE-2.1 refuses status attributed and met_attributed", () => {
    expect(detail(evidence({ acceptance: [{ id: "A1", status: "attributed", evidence: "x" }] }))).not.toBe("ACCEPTED");
    expect(detail(evidence({ acceptance: [{ id: "A1", status: "met_attributed", evidence: "x" }] }))).not.toBe("ACCEPTED");
  });

  it("BE-2.2 accepts met with order shown and met with order attributed", () => {
    expect(detail(evidence({ acceptance: [{ id: "A1", status: "met", order: "shown", evidence: "seen" }] }))).toBe("ACCEPTED");
    const attributed = validateEvidence(evidence({
      acceptance: [{ id: "A1", status: "met", order: "attributed", evidence: "order attributed" }],
    }));
    expect(attributed.ok, attributed.ok ? "ACCEPTED" : attributed.problems.join(" | ")).toBe(true);
    if (!attributed.ok) return;
    expect(attributed.value.acceptance[0]!.status).toBe("met");
    expect(attributed.value.acceptance[0]!.order).toBe("attributed");
  });

  it("BE-2.2 refuses met with order inferred, and met with no order names order", () => {
    expect(detail(evidence({ acceptance: [{ id: "A1", status: "met", order: "inferred", evidence: "x" }] }))).not.toBe("ACCEPTED");
    const missing = validateEvidence(evidence({ acceptance: [{ id: "A1", status: "met", evidence: "observed" }] }));
    expect(missing.ok, missing.ok ? "ACCEPTED" : missing.problems.join(" | ")).toBe(false);
    if (missing.ok) return;
    expect(missing.problems.join("\n")).toMatch(/order/);
  });

  it("BE-2.3 partial may carry order or omit it, and inferred is refused", () => {
    expect(detail(evidence({ acceptance: [{ id: "A1", status: "partial", evidence: "half" }] }))).toBe("ACCEPTED");
    expect(detail(evidence({ acceptance: [{ id: "A1", status: "partial", order: "shown", evidence: "half" }] }))).toBe("ACCEPTED");
    expect(detail(evidence({ acceptance: [{ id: "A1", status: "partial", order: "inferred", evidence: "half" }] }))).not.toBe("ACCEPTED");
  });

  it.each(["unmet", "not_evaluated", "pending"] as const)(
    "BE-2.3 %s omits order and refuses it",
    (status) => {
      expect(detail(evidence({ acceptance: [{ id: "A1", status, evidence: "x" }] }))).toBe("ACCEPTED");
      const withOrder = detail(evidence({ acceptance: [{ id: "A1", status, order: "shown", evidence: "x" }] }));
      expect(withOrder).not.toBe("ACCEPTED");
      expect(withOrder).toMatch(/order/);
    },
  );
});

describe("BE-3 pending", () => {
  it("BE-3.1 accepts acceptance status pending and refuses other spellings", () => {
    const ok = validateEvidence(evidence({ acceptance: [{ id: "A8", status: "pending", evidence: "CI did not exist yet" }] }));
    expect(ok.ok, ok.ok ? "ACCEPTED" : ok.problems.join(" | ")).toBe(true);
    if (!ok.ok) return;
    expect(ok.value.acceptance[0]!.status).toBe("pending");
    expect(detail(evidence({ acceptance: [{ id: "A8", status: "Pending", evidence: "x" }] }))).not.toBe("ACCEPTED");
    expect(detail(evidence({ acceptance: [{ id: "A8", status: "pending ", evidence: "x" }] }))).not.toBe("ACCEPTED");
  });

  it("BE-3.1 requirements keep four statuses: pending is refused there", () => {
    const refused = detail(evidence({
      requirements: [{ id: "R1", status: "pending", evidence: "not an observation row", severity: "info" }],
    }));
    expect(refused).not.toBe("ACCEPTED");
    expect(detail(evidence({
      requirements: [{ id: "R1", status: "not_evaluated", evidence: "not looked at", severity: "info" }],
    }))).toBe("ACCEPTED");
  });

  it("BE-3.3 E_t has no verdict field", () => {
    expect(detail(evidence({ verdict: "would-merge" }))).not.toBe("ACCEPTED");
    expect(detail(evidence({ would_merge: true }))).not.toBe("ACCEPTED");
    const schema = jsonSchemas().evidence as { properties?: Record<string, unknown> };
    expect(schema.properties?.verdict).toBeUndefined();
    expect(schema.properties?.would_merge).toBeUndefined();
    expect(schema.properties?.out_of_scope).toBeUndefined();
    expect(schema.properties?.invisible).toBeUndefined();
  });
});

describe("BE-4 declared lists", () => {
  it("BE-4.1 absent and present-but-empty are different results", async () => {
    const absent = await parseDeclared("this file has no fence\n");
    const empty = await parseDeclared("```qa-declared\n[unrunnable]\n[out-of-scope]\n```\n");
    expect(absent).toEqual({ present: false });
    expect(empty).toEqual({ present: true, unrunnable: [], outOfScope: [] });
    expect(absent).not.toEqual(empty);
  });

  it("BE-4.2 valid unrunnable list and valid out-of-scope list stay separate", async () => {
    const unrunnable = await parseDeclared("```qa-declared\n[unrunnable]\nU1: cannot run\n[out-of-scope]\n```\n");
    expect(unrunnable).toEqual({ present: true, unrunnable: ["U1"], outOfScope: [] });
    const outOfScope = await parseDeclared("```qa-declared\n[unrunnable]\n[out-of-scope]\nA4: not this candidate\n```\n");
    expect(outOfScope).toEqual({ present: true, unrunnable: [], outOfScope: ["A4"] });
  });

  it("BE-4.2 refuses an id in both lists", async () => {
    await expect(parseDeclared("```qa-declared\n[unrunnable]\nX1: a\n[out-of-scope]\nX1: b\n```\n")).rejects.toThrow(/both/);
  });

  it("BE-4.2 refuses an id twice in one list", async () => {
    await expect(parseDeclared("```qa-declared\n[unrunnable]\nX1: a\nX1: b\n[out-of-scope]\n```\n")).rejects.toThrow(/twice/);
  });

  it("BE-4.2 refuses a line that is not ID: text", async () => {
    await expect(parseDeclared("```qa-declared\n[unrunnable]\nnot an id line\n[out-of-scope]\n```\n")).rejects.toThrow(/ID: text/);
  });

  it("BE-4.2 refuses more than one block", async () => {
    const text = "```qa-unrunnable\nU1: old\n```\n```qa-declared\n[unrunnable]\n[out-of-scope]\n```\n";
    await expect(parseDeclared(text)).rejects.toThrow(/more than one/);
  });

  it("BE-4.3 legacy qa-unrunnable block returns U1–U6 and no out-of-scope ids", async () => {
    const parsed = await parseDeclared(LEGACY_CRITERIA_A);
    expect(parsed).toEqual({
      present: true,
      unrunnable: ["U1", "U2", "U3", "U4", "U5", "U6"],
      outOfScope: [],
    });
  });

  it("BE-4.4 this criteria file returns empty unrunnable and BC-1–BC-5", async () => {
    const parsed = await parseDeclared(CRITERIA_B);
    expect(parsed).toEqual({
      present: true,
      unrunnable: [],
      outOfScope: ["BC-1", "BC-2", "BC-3", "BC-4", "BC-5"],
    });
  });

  it("BE-4.5 E_t carries neither list: omitting the ids validates, and the list keys are refused", () => {
    // Omission is the mechanism. The declaration lives in the criteria file, not on E_t.
    expect(detail(evidence())).toBe("ACCEPTED");
    expect(detail(evidence({ out_of_scope: ["A4"] }))).not.toBe("ACCEPTED");
    expect(detail(evidence({ invisible: ["U1"] }))).not.toBe("ACCEPTED");
    expect(detail(evidence({ acceptance: [{ id: "A4", status: "out_of_scope", evidence: "x" }] }))).not.toBe("ACCEPTED");
  });
});

describe("BE-5 and BE-6", () => {
  it("BE-5.3 the derived description names the rules JSON Schema cannot express", () => {
    const onDisk = JSON.parse(readFileSync(EVIDENCE_SCHEMA, "utf-8")) as { description: string };
    const derived = String((jsonSchemas().evidence as { description?: string }).description);
    for (const text of [onDisk.description, derived]) {
      expect(text).toContain("LIMIT");
      expect(text).toContain("duplicate acceptance");
      expect(text).toContain("order is required on a met");
      expect(text).toContain("unrunnable");
      expect(text).toContain("out-of-scope");
      expect(text).toContain("separate");
      expect(text).toContain("names each run id");
    }
  });

  it("BE-6 the R10 table validates without flattening", async () => {
    const doc = evidence({
      loop: HUMAN_LOOP,
      acceptance: [
        { id: "A1", status: "met", order: "attributed", evidence: "reproduced; temporal order attributed" },
        { id: "A8", status: "pending", evidence: "CI run did not exist yet" },
      ],
    });
    const parsed = validateEvidence(doc);
    expect(parsed.ok, parsed.ok ? "ACCEPTED" : parsed.problems.join(" | ")).toBe(true);
    if (!parsed.ok) return;
    const byId = new Map(parsed.value.acceptance.map((row) => [row.id, row]));
    expect(byId.get("A1")?.status).toBe("met");
    expect(byId.get("A1")?.order).toBe("attributed");
    expect(byId.get("A1")?.status).not.toBe("partial");
    expect(byId.get("A8")?.status).toBe("pending");
    expect(byId.get("A8")?.status).not.toBe("unmet");
    expect(byId.get("A8")?.status).not.toBe("not_evaluated");
    for (const id of ["A4", "A5", "A6", "A7"]) expect(byId.has(id)).toBe(false);
    const declared = await parseDeclared(
      "```qa-declared\n[unrunnable]\n[out-of-scope]\nA4: out of scope\nA5: out of scope\nA6: out of scope\nA7: out of scope\n```\n",
    );
    expect(declared.outOfScope).toEqual(["A4", "A5", "A6", "A7"]);
    expect(declared.unrunnable).toEqual([]);
  });
});

describe("BE-7 validate evidence", { timeout: 60_000 }, () => {
  let dir: string;

  beforeEach(() => { dir = mkdtempSync(join(tmpdir(), "b2-validate-")); });

  it("BE-7.1 exits 0 on a valid file and prints every problem on an invalid one", () => {
    const validPath = join(dir, "valid.json");
    const invalidPath = join(dir, "invalid.json");
    writeFileSync(validPath, JSON.stringify(evidence({
      acceptance: [{ id: "A1", status: "met", order: "shown", evidence: "seen" }],
    })));
    // met without order is a refinement the derived JSON Schema cannot see.
    // A JSON-Schema validator would accept this file. validateEvidence must not.
    const invalidDoc = evidence({ acceptance: [{ id: "A1", status: "met", evidence: "no order" }] });
    writeFileSync(invalidPath, JSON.stringify(invalidDoc));

    const valid = harness(["validate", "evidence", validPath], dir);
    expect(valid.status, `${valid.stderr}\n${valid.stdout}`).toBe(0);

    const invalid = harness(["validate", "evidence", invalidPath], dir);
    const expected = validateEvidence(invalidDoc);
    expect(expected.ok).toBe(false);
    if (expected.ok) return;
    expect(invalid.status, `${invalid.stderr}\n${invalid.stdout}`).not.toBe(0);
    expect(invalid.stdout.trim().split(/\r?\n/)).toEqual(expected.problems);
  });
});

describe("BE runtime", { timeout: 60_000 }, () => {
  let repo: RepoFixture;

  beforeAll(() => requireGit());
  beforeEach(() => { repo = makeRepo("b2-et-"); });
  afterEach(() => repo.cleanup());

  const config = (qa: RoleSession): LoopConfig => ({
    repoRoot: repo.root,
    loop: "t001",
    roles: { planner: new StubPlanner(), developer: new StubDeveloper(), qa },
    checks: exitingChecks(0, 0),
    log: () => {},
  });

  class FixedQa implements RoleSession {
    readonly role = "qa" as const;
    calls = 0;
    constructor(private readonly build: (ctx: RoleContext) => Record<string, unknown>) {}
    run(ctx: RoleContext): unknown {
      this.calls += 1;
      const base = new StubQa().run(ctx) as Record<string, unknown>;
      return { ...base, ...this.build(ctx) };
    }
  }

  it("BE-1.3 refuses E_t.loop t002 at once and commits no E_t.json", async () => {
    const qa = new FixedQa(() => ({ loop: "t002" }));
    const r = await runLoop(config(qa));
    const et = join(repo.root, "artifacts/iterations/t001/E_t.json");
    const committedLoop = existsSync(et)
      ? (JSON.parse(readFileSync(et, "utf-8")) as { loop?: string }).loop ?? "(no loop)"
      : "(absent)";
    expect(r.status, `code=${r.failure?.code ?? "none"} calls=${qa.calls} E_t.loop=${committedLoop}`).toBe("failed");
    expect(r.failure?.code).toBe("evidence-loop-mismatch");
    expect(qa.calls).toBe(1);
    expect(existsSync(et)).toBe(false);
  });

  it("BE-1.3 refuses a schema-valid human-seat id that is not this run", async () => {
    const qa = new FixedQa(() => ({ loop: HUMAN_LOOP }));
    const r = await runLoop(config(qa));
    const et = join(repo.root, "artifacts/iterations/t001/E_t.json");
    expect(r.status, `code=${r.failure?.code ?? "none"} ${r.failure?.reason ?? ""}`).toBe("failed");
    expect(r.failure?.code).toBe("evidence-loop-mismatch");
    expect(existsSync(et)).toBe(false);
  });

  it("BE-2.4 keeps order attributed on the committed E_t", async () => {
    const qa = new FixedQa(() => ({
      acceptance: [{ id: "A1", status: "met", order: "attributed", evidence: "temporal order attributed" }],
    }));
    const r = await runLoop(config(qa));
    expect(r.status, `${r.failure?.code ?? ""} ${r.failure?.reason ?? ""} ${(r.failure?.problems ?? []).join(" | ")}`).toBe("completed");
    const committed = JSON.parse(readFileSync(join(repo.root, "artifacts/iterations/t001/E_t.json"), "utf-8")) as {
      acceptance: { order?: string; status: string }[];
    };
    expect(committed.acceptance[0]?.status).toBe("met");
    expect(committed.acceptance[0]?.order).toBe("attributed");
  });

  it("BE-3.2 keeps status pending on the committed E_t", async () => {
    const qa = new FixedQa(() => ({
      acceptance: [{ id: "A8", status: "pending", evidence: "CI run did not exist yet" }],
    }));
    const r = await runLoop(config(qa));
    expect(r.status, `${r.failure?.code ?? ""} ${(r.failure?.problems ?? []).join(" | ")}`).toBe("completed");
    const committed = JSON.parse(readFileSync(join(repo.root, "artifacts/iterations/t001/E_t.json"), "utf-8")) as {
      acceptance: { status: string }[];
    };
    expect(committed.acceptance[0]?.status).toBe("pending");
  });
});
