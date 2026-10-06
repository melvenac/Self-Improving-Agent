import { describe, it, expect, beforeAll } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

const ROOT = join(import.meta.dirname, "../../..");
const CAL2 = join(ROOT, "docs/loops/jev-calibration-2");

type Pool = Record<string, number> & {
  plan_by_source: Record<string, number>;
  held_out_candidates: { total: number; ACCEPT: number; REJECT: number; with_plan: number; no_plan: number };
};
type Case = {
  case_id: string; qa_no: number; label: string | null; candidate_sha: string; plan: string; plan_source: string | null;
  cal1_seen: boolean; leak_group: boolean; pair: string[]; provenance: string;
};
type Collected = {
  cases: Case[];
  pairs: { rejected: string; fixed: string; rejected_qa: number; fixed_qa: number }[];
  unresolved: { qa_no: number; scope: string; reason: string }[];
  runs: { qa_no: number; resolved: boolean }[];
  pool: Pool;
};

describe("jev-calibration-2/collect.mjs (JEV-CAL-2 r2: one case per PR verdict, QA 250 onward)", () => {
  let pool: Pool;
  let col: Collected;
  beforeAll(() => {
    const r = spawnSync(process.execPath, [join(CAL2, "collect.mjs")], { cwd: CAL2, encoding: "utf-8", timeout: 240_000 });
    expect(r.status, r.stderr).toBe(0);
    expect(existsSync(join(CAL2, "pool.json"))).toBe(true);
    pool = JSON.parse(readFileSync(join(CAL2, "pool.json"), "utf-8")) as Pool;
    col = JSON.parse(readFileSync(join(CAL2, "collect.json"), "utf-8")) as Collected;
  }, 250_000);

  it("writes pool.json with verdict and provenance counts", () => {
    expect(pool.total).toBeGreaterThan(0);
    expect(pool.ACCEPT + pool.REJECT + pool.unlabelled).toBe(pool.total);
    expect(pool.seat_built + pool.runtime_built).toBe(pool.total);
    expect(pool.leak_group).toBeGreaterThanOrEqual(0);
    expect(pool.headline_pool).toBe(pool.total - pool.leak_group);
  });

  it("covers every QA run from 250 up to the highest prompt, with no cap, and lists each run it could not use", () => {
    expect(pool.min_qa).toBe(250);
    expect(col.runs[0].qa_no).toBe(250);
    expect(pool.max_qa).toBe(col.runs[col.runs.length - 1].qa_no);
    expect(pool.runs_considered).toBe(col.runs.length);
    // every run is either a source of cases or named in the unresolved list: none vanishes
    for (const run of col.runs) {
      const gave = col.cases.some((c) => c.qa_no === run.qa_no);
      const listed = col.unresolved.some((u) => u.qa_no === run.qa_no);
      expect(gave || listed, `QA ${run.qa_no} gave no case and is not in the unresolved list`).toBe(true);
    }
    for (const u of col.unresolved) expect(u.reason.length).toBeGreaterThan(10);
  });

  it("is one case per PR verdict: a report with several PRs gives several cases, and no head repeats", () => {
    expect(col.cases.filter((c) => c.qa_no === 279)).toHaveLength(5);
    expect(col.cases.filter((c) => c.qa_no === 258)).toHaveLength(5);
    const heads = col.cases.map((c) => c.candidate_sha);
    expect(new Set(heads).size).toBe(heads.length);
  });

  it("the pool is big enough to fill a held-out set of 30 with 12 per verdict (the reason for this round)", () => {
    const h = pool.held_out_candidates;
    expect(h.total).toBeGreaterThanOrEqual(30);
    expect(h.ACCEPT).toBeGreaterThanOrEqual(12);
    expect(h.REJECT).toBeGreaterThanOrEqual(12);
  });

  it("every case says whether it has a plan and where it came from", () => {
    expect(pool.plan + pool.no_plan).toBe(pool.total);
    for (const c of col.cases) {
      expect(["plan", "no-plan"]).toContain(c.plan);
      if (c.plan === "plan") expect(["task-brief", "qa-dispatch-section", "qa-dispatch-whole"]).toContain(c.plan_source);
      else expect(c.plan_source).toBeNull();
    }
  });

  it("tags calibration 1's cases as seen, and keeps them out of the held-out candidates", () => {
    expect(pool.cal1_seen).toBe(col.cases.filter((c) => c.cal1_seen).length);
    const labelled = col.cases.filter((c) => !c.leak_group && !c.cal1_seen && c.label !== null);
    expect(pool.held_out_candidates.total).toBe(labelled.length);
  });

  it("tags rejected-then-fixed pairs, and a PR that is still rejected is not one", () => {
    const byId = new Map(col.cases.map((c) => [c.case_id, c]));
    expect(col.pairs.length).toBeGreaterThan(0);
    for (const p of col.pairs) {
      expect(byId.get(p.rejected)?.label).toBe("REJECT");
      expect(byId.get(p.fixed)?.label).toBe("ACCEPT");
      expect(p.fixed_qa).toBeGreaterThan(p.rejected_qa);
    }
    // #437 is REJECT in QA 275, 279 and 280 and has never been ACCEPTed
    expect(col.cases.filter((c) => /^qa\d+-pr437/.test(c.case_id)).every((c) => c.label === "REJECT")).toBe(true);
    expect(col.pairs.some((p) => /pr437/.test(p.rejected) || /pr437/.test(p.fixed))).toBe(false);
    // #427 r2 (QA 275, REJECT) was fixed in r3 (QA 277, ACCEPT)
    expect(col.pairs.some((p) => p.rejected === "qa275-pr427-r2" && p.fixed === "qa277-pr427-r3")).toBe(true);
  });
});
