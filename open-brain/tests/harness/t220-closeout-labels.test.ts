/**
 * T-220 (D-092 F2 and F4): the `no E_t` label comes from a source that does not depend on a G_qa
 * having run, and a G_plan record carries repo-relative paths.
 */

import { describe, it, expect } from "vitest";
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { isAbsolute, join, resolve } from "node:path";
import { buildCloseoutTables } from "../../src/harness/closeout-tables.js";
import { writeSliceRecord } from "../../src/harness/gate-records.js";
import { runBriefPlanGate } from "../../src/harness/brief-plan-gate.js";

const REAL_RECORDS = resolve(__dirname, "../../../docs/loops/loop-15-slice-4-records");

const TERMS = [
  "| Diff | PR | Merge | Merged head (`^2`) | QA `E_t` (branch, `candidate_git.sha`) |",
  "| --- | --- | --- | --- | --- |",
  "| A | #182 | `677c1dd5` | `0d44374e` | none on any `qa/*` branch |",
  "| B part 1 | #165 | `7640b935` | `285a8b2e` | none |",
  "| C | #195 | `ddd43526` | `fcc31254` | `qa/c-r4-report`, `c3394272` |",
  "| T-195 | #209 | `7fcbfa0e` | `5b3e5257` | `qa/t195-r2-report`, `647cc74e` |",
].join("\n");

/** A repo-shaped temp tree: docs/loops/<records dir>, the criteria file beside it, and D_t files. */
function fixture(withCriteria: boolean, prs: number[]): { root: string; records: string } {
  const root = mkdtempSync(join(tmpdir(), "t220-"));
  const records = join(root, "docs/loops/loop-15-slice-4-records");
  mkdirSync(records, { recursive: true });
  if (withCriteria) writeFileSync(join(root, "docs/loops/loop-15-slice-4-criteria.md"), `# criteria\n\n### Terms\n\n${TERMS}\n`);
  for (const pr of prs) writeFileSync(join(records, `pr-${pr}.D_t.json`), "{}");
  return { root, records };
}

/** The row for `pr` in the "Diffs and what was scored" table (an earlier table also has per-PR rows). */
const row = (md: string, pr: number): string =>
  md.slice(md.indexOf("### Diffs and what was scored")).split("\n").find((l) => l.startsWith(`| ${pr} |`)) ?? "";

describe("T-220 F2: the E_t label", { timeout: 120_000 }, () => {
  it("L1 with no G_qa at all, a diff that has an E_t reads `not called` and one that has none reads `not scored: no E_t`", () => {
    const { records } = fixture(true, [182, 165, 195, 209]);
    const md = buildCloseoutTables({ recordsDir: records }).markdown;
    expect(row(md, 195)).toBe("| 195 | not scored | not called |");
    expect(row(md, 209)).toBe("| 209 | not scored | not called |");
    expect(row(md, 182)).toBe("| 182 | not scored | not scored: no E_t |");
    expect(row(md, 165)).toBe("| 165 | not scored | not scored: no E_t |");
  });

  it("L2 a diff with a G_qa is `scored`, whichever the source says", () => {
    const { records } = fixture(true, [195]);
    writeSliceRecord(join(records, "pr-195.G_qa.a.json"), qaRecord(195));
    expect(row(buildCloseoutTables({ recordsDir: records }).markdown, 195)).toBe("| 195 | not scored | scored |");
  });

  it("L3 a diff the Terms table does not list is `E_t unknown`, never `no E_t`", () => {
    const { records } = fixture(true, [999]);
    expect(row(buildCloseoutTables({ recordsDir: records }).markdown, 999)).toBe("| 999 | not scored | not scored: E_t unknown |");
  });

  it("L4 the output names where the E_t facts came from, and with no criteria file says it fell back", () => {
    const withTable = buildCloseoutTables({ recordsDir: fixture(true, [195]).records }).markdown;
    expect(withTable).toContain("E_t source: the criteria Terms table (4 rows)");
    const without = buildCloseoutTables({ recordsDir: fixture(false, [195]).records }).markdown;
    expect(without).toContain("E_t source: none");
  });

  it("L5 no doubled full stop after `No scored records`", () => {
    const md = buildCloseoutTables({ recordsDir: fixture(true, [195]).records }).markdown;
    expect(md).toContain("No scored records.");
    expect(md).not.toContain("records..");
    expect(md).not.toMatch(/\.\.\s/);
  });

  it("L6 on the real records directory the five diffs that have an E_t are not labelled `no E_t`", () => {
    const md = buildCloseoutTables({ recordsDir: REAL_RECORDS }).markdown;
    for (const pr of [195, 209, 218, 220, 227]) expect(row(md, pr), `PR ${pr}`).not.toContain("no E_t");
    for (const pr of [182, 165, 187]) expect(row(md, pr), `PR ${pr}`).toContain("not scored: no E_t");
  });
});

describe("T-220 F4: G_plan records carry repo-relative paths", { timeout: 120_000 }, () => {
  it("P1 brief, dt and the spec_excerpt source are repo-relative with forward slashes", async () => {
    const root = mkdtempSync(join(tmpdir(), "t220-plan-"));
    mkdirSync(join(root, "docs/loops"), { recursive: true });
    writeFileSync(join(root, "docs/loops/x-brief.md"), "# x\n");
    writeFileSync(
      join(root, "docs/loops/x-brief.D_t.json"),
      JSON.stringify({
        loop: "15-x",
        objective: "o",
        tasks: ["t"],
        out_of_scope: ["x"],
        preserve: ["p"],
        acceptance: [{ id: "A1", observable: "o", type: "blackbox" }],
        repair_targets: ["r"],
        new_capability: "c",
      }),
    );
    const r = await runBriefPlanGate({ dtPath: join(root, "docs/loops/x-brief.D_t.json"), repoRoot: root, mode: "dry-run", env: {} });
    const rec = JSON.parse(readFileSync(r.recordPath, "utf-8")) as { brief: string; dt: string; sources: { spec_excerpt: string } };
    expect(rec.brief).toBe("docs/loops/x-brief.md");
    expect(rec.dt).toBe("docs/loops/x-brief.D_t.json");
    expect(isAbsolute(rec.brief) || isAbsolute(rec.dt)).toBe(false);
    expect(rec.sources.spec_excerpt).toContain("docs/loops/x-brief.md");
    const text = readFileSync(r.recordPath, "utf-8");
    expect(text).not.toContain(root.split("\\").join("/"));
    expect(text).not.toContain(root.split("\\").join("\\\\"));
    expect(text).not.toMatch(/[A-Za-z]:[\\/]/);
  });
});

function qaRecord(pr: number): Record<string, unknown> {
  return {
    gate: "qa-score",
    loop: `15-t${pr}`,
    mode: "live",
    sent: true,
    requested_at: "t",
    answered_at: "t",
    model_requested: "jev-latest",
    model_resolved: "jev-1.13.0",
    request: {},
    answer: {},
    usage: null,
    decision: null,
    runtime_action: "shadow: recorded only; no outcome was changed",
    note: "",
    source: "seat",
    plan_provenance: "reconstructed-after",
    attempt_id: `q${pr}`,
    subject: { gate: "qa-score", key: "k", blob: "b" },
    attempt: 1,
    retry_of: null,
    outcome_class: "answered",
    attempted_at: "t",
    policy_hash: "c".repeat(64),
    e_t_ref: { branch: "qa/x", commit: "a".repeat(40), path: "p", blob: "b" },
    results: [],
    missing: [],
    regression_of_validated: 0.1,
    artifact_complete_enough_to_stop: 0.9,
  };
}
