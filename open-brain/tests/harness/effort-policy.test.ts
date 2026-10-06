/**
 * T-173. The effort policy is data. These rows pin the shipped table and the
 * max-over-targets rule (a doc beside an unmatched source file stays at the
 * stage base). Mutants M1-M6 are local edits, not part of this history.
 */

import { describe, it, expect } from "vitest";
import { mkdtempSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  EFFORT_LOWERING_MARK,
  EFFORT_POLICY_FILE,
  chooseEffort,
  loadEffortPolicy,
  policiesDir,
  policyJsonSchemas,
  PolicyUnreadable,
  type EffortPolicy,
} from "../../src/harness/policies.js";
import { serialiseSchema } from "../../src/harness/schema.js";
import { policySchemaFileName, schemaDir } from "../../src/harness/cli.js";
import { Allowlist } from "../../src/harness/workspace.js";
import { claudeAdapter, commandAdapter, ProcessRole, type RoleContext } from "../../src/harness/roles.js";
import type { Plan } from "../../src/harness/schema.js";

const shipped = (): EffortPolicy => loadEffortPolicy();

const choose = (
  stage: "planner" | "developer" | "qa",
  repairTargets: string[],
  attempt = 1,
  policy: EffortPolicy = shipped(),
) => chooseEffort({ policy, stage, repairTargets, attempt });

describe("T-173 effort policy", () => {
  it("the shipped file states the lowering rule and the default table", () => {
    const policy = shipped();
    expect(policy.description).toContain(EFFORT_LOWERING_MARK);
    expect(policy.levels).toEqual(["low", "medium", "high", "xhigh", "max"]);
    expect(policy.stages).toEqual({ planner: "high", developer: "high", qa: "max" });
    expect(policy.paths.map((rule) => [rule.id, rule.level])).toEqual([
      ["harness-security", "xhigh"],
      ["docs-version", "medium"],
    ]);
    expect(policy.retry).toBe("one-up");
  });

  it("drift: policy-effort.schema.json matches the derived schema", () => {
    const file = policySchemaFileName("effort");
    expect(file).toBe("policy-effort.schema.json");
    const onDisk = readFileSync(join(schemaDir(), file), "utf-8");
    expect(onDisk).toBe(serialiseSchema(policyJsonSchemas().effort));
    expect(onDisk).toContain(EFFORT_LOWERING_MARK);
  });

  it("R1 qa with no paths at attempt 1 is max", () => {
    expect(choose("qa", []).level).toBe("max");
  });

  it("R2 developer plus harness/git.ts is xhigh", () => {
    const choice = choose("developer", ["open-brain/src/harness/git.ts"]);
    expect(choice.level).toBe("xhigh");
    expect(choice.path_rule).toBe("harness-security");
  });

  it("R3 developer plus a doc is medium", () => {
    const choice = choose("developer", ["docs/loops/x.md"]);
    expect(choice.level).toBe("medium");
    expect(choice.path_rule).toBe("docs-version");
  });

  it("R4 that doc on attempt 2 steps to high", () => {
    const choice = choose("developer", ["docs/loops/x.md"], 2);
    expect(choice.level).toBe("high");
    expect(choice.retry_bumped).toBe(true);
  });

  it("R5 git.ts and a doc together is xhigh, and attempt 2 is max", () => {
    expect(choose("developer", ["open-brain/src/harness/git.ts", "docs/loops/x.md"]).level).toBe("xhigh");
    expect(choose("developer", ["open-brain/src/harness/git.ts", "docs/loops/x.md"], 2).level).toBe("max");
  });

  it("R6 planner with empty repair_targets at attempt 1 is high", () => {
    const choice = choose("planner", []);
    expect(choice.level).toBe("high");
    expect(choice.path_rule).toBeNull();
  });

  it("R7 qa on attempt 2 stays max", () => {
    const choice = choose("qa", [], 2);
    expect(choice.level).toBe("max");
    expect(choice.retry_bumped).toBe(false);
  });

  it("R8 a level absent from the ladder is refused", () => {
    const dir = mkdtempSync(join(tmpdir(), "t173-r8-"));
    const policy = shipped();
    writeFileSync(
      join(dir, EFFORT_POLICY_FILE),
      JSON.stringify({ ...policy, stages: { ...policy.stages, developer: "ultra" } }),
    );
    expect(() => loadEffortPolicy(dir)).toThrow(PolicyUnreadable);
    writeFileSync(
      join(dir, EFFORT_POLICY_FILE),
      JSON.stringify({
        ...policy,
        levels: ["medium", "high", "xhigh", "max"],
        stages: { ...policy.stages, developer: "low" },
      }),
    );
    expect(() => loadEffortPolicy(dir)).toThrow(/not on the levels ladder/);
  });

  it("R9 a missing effort.json throws and does not spawn", async () => {
    const dir = mkdtempSync(join(tmpdir(), "t173-r9-"));
    const marker = join(dir, "spawned");
    const role = new ProcessRole("developer", {
      adapter: commandAdapter(
        process.execPath,
        ["-e", "require('fs').writeFileSync(process.env.MARKER, '1')"],
        ["MARKER"],
      ),
      envSet: { MARKER: marker },
      policiesDir: dir,
    });
    const ctx: RoleContext = {
      role: "developer",
      loop: "t001",
      repoRoot: dir,
      attempt: 1,
      allowlist: new Allowlist([]),
      previousProblems: [],
      schema: null,
      plan: null,
      candidate: null,
      checks: null,
      write: () => {},
    };
    await expect(role.execute(ctx)).rejects.toThrow(PolicyUnreadable);
    expect(existsSync(marker)).toBe(false);
  });

  it("R10 adapter args contain --effort and the resolved level", () => {
    const args = claudeAdapter().args({ sessionId: "s", effort: "high" });
    const at = args.indexOf("--effort");
    expect(at).toBeGreaterThan(-1);
    expect(args[at + 1]).toBe("high");
    expect(() => claudeAdapter().args({ sessionId: "s", effort: "" })).toThrow(/effort policy/);
  });

  it("R11 the process record carries the level beside the result", async () => {
    const dir = mkdtempSync(join(tmpdir(), "t173-r11-"));
    const role = new ProcessRole("developer", {
      adapter: commandAdapter(process.execPath, [
        "-e",
        "require('fs').writeFileSync(process.env.HOH_DELIVERABLE_PATH, '{\"ok\":true}\\n')",
      ]),
    });
    const plan = { repair_targets: ["open-brain/src/harness/git.ts"] } as Plan;
    const ctx: RoleContext = {
      role: "developer",
      loop: "t001",
      repoRoot: dir,
      attempt: 1,
      allowlist: new Allowlist([]),
      previousProblems: [],
      schema: null,
      plan,
      candidate: null,
      checks: null,
      write: () => {},
    };
    const record = await role.execute(ctx);
    expect(record.effort.level).toBe("xhigh");
    expect(record.effort.path_rule).toBe("harness-security");
    expect(record.outcome.exitCode).toBe(0);
  });

  it("R12 developer, docs/x.md plus an unmatched source file, attempt 1 is high", () => {
    const choice = choose("developer", ["docs/x.md", "open-brain/src/foo.ts"]);
    expect(choice.level).toBe("high");
    expect(choice.path_rule).toBeNull();
  });
});
