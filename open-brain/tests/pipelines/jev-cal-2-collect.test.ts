import { describe, it, expect, beforeAll } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const run = promisify(execFile);

const ROOT = join(import.meta.dirname, "../../..");
const CAL2 = join(ROOT, "docs/loops/jev-calibration-2");

type Pool = Record<string, number> & {
  plan_by_source: Record<string, number>;
  heads_unresolved: number;
  base_invariant_failures: number;
  diff_files: { n: number; min: number; median: number; max: number };
  diff_lines: { n: number; min: number; median: number; max: number };
  conflicts: number;
  checks_recorded: number;
  held_out_candidates: { total: number; ACCEPT: number; REJECT: number; with_plan: number; no_plan: number };
};
type Case = {
  case_id: string; qa_no: number; label: string | null; candidate_sha: string; plan: string; plan_source: string | null;
  cal1_seen: boolean; leak_group: boolean; pair: string[]; provenance: string; head_resolved: boolean;
  pr: number | null; merged: boolean; base_sha: string | null; base_how: string; label_disputed: boolean;
  diff: { files: number; insertions: number; deletions: number; paths: string[] } | null;
  pr_files_check: { checked: boolean; ok?: boolean; overlap?: number };
  checks_hint: { checks: string; reason?: string; test_job?: string; ci_run_id?: number; build_exit: number | null; unit_exit: number | null };
};
type Collected = {
  cases: Case[];
  pairs: { rejected: string; fixed: string; rejected_qa: number; fixed_qa: number }[];
  conflicts: { candidate_sha: string; case_id: string; kept: { qa_no: number; label: string | null }; other: { qa_no: number; label: string | null } }[];
  unresolved: { qa_no: number; scope: string; reason: string }[];
  runs: { qa_no: number; resolved: boolean }[];
  pool: Pool;
};

describe("jev-calibration-2/collect.mjs (JEV-CAL-2 r2: one case per PR verdict, QA 250 onward)", () => {
  let pool: Pool;
  let col: Collected;
  beforeAll(async () => {
    // Asynchronous on purpose: a synchronous spawn blocks the worker for the whole run (about 70 s) and vitest reports
    // `Timeout calling "onTaskUpdate"` as an unhandled error, which fails the run with every test green.
    await run(process.execPath, [join(CAL2, "collect.mjs")], { cwd: CAL2, encoding: "utf-8", timeout: 240_000, maxBuffer: 1 << 26 });
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

  it("a head this checkout does not hold is kept and flagged, so the counts do not depend on the object store", () => {
    // CI's clone lacks some PR heads that a developer's checkout has; a case dropped for that would change every count.
    expect(pool.heads_unresolved).toBe(col.cases.filter((c) => !c.head_resolved).length);
    for (const c of col.cases) expect(c.candidate_sha).toMatch(/^[0-9a-f]{7,40}$/);
    for (const c of col.cases.filter((x) => x.head_resolved)) expect(c.candidate_sha).toHaveLength(40);
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
    const labelled = col.cases.filter((c) => !c.leak_group && !c.cal1_seen && !c.label_disputed && c.label !== null);
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

  it("F1: every resolved head has a base that is not the head, and base..head holds a diff", () => {
    // r2 took the newest commit of head..master for a merged PR, so base == candidate for 66 of 88 cases: an empty diff.
    expect(pool.base_invariant_failures).toBe(0);
    const resolved = col.cases.filter((c) => c.head_resolved);
    expect(resolved.length).toBeGreaterThan(0);
    for (const c of resolved) {
      expect(c.base_sha, c.case_id).not.toBeNull();
      expect(c.base_sha, `${c.case_id}: base equals candidate (${c.base_how})`).not.toBe(c.candidate_sha);
      expect(c.diff?.files ?? 0, `${c.case_id}: empty base..candidate diff`).toBeGreaterThan(0);
    }
    // and the diff touches the PR's files wherever the PR's file list is recorded
    for (const c of resolved.filter((x) => x.pr_files_check.checked)) expect(c.pr_files_check.ok, c.case_id).toBe(true);
    expect(pool.diff_files.min).toBeGreaterThan(0);
    expect(pool.diff_lines.n).toBe(resolved.length);
  });

  it("F1: a merged PR's base is the master side of its merge commit; an unmerged PR's is its merge-base with master", () => {
    const merged = col.cases.filter((c) => c.head_resolved && c.merged);
    expect(merged.length).toBeGreaterThan(0);
    for (const c of merged) expect(c.base_how, c.case_id).toMatch(/^(merge-commit first parent|no merge commit)/);
    for (const c of col.cases.filter((x) => x.head_resolved && !x.merged)) expect(c.base_how, c.case_id).toMatch(/not merged/);
  });

  it("F2: QA 281's table (its verdict column says Result) gives #445 r4 ACCEPT, and the three rejected rounds pair with it", () => {
    const r4 = col.cases.find((c) => c.case_id === "qa281-pr445-r4");
    expect(r4?.label).toBe("ACCEPT");
    expect(col.pairs.filter((p) => p.fixed === "qa281-pr445-r4").map((p) => p.rejected).sort()).toEqual(["qa277-pr445", "qa279-pr445-r2", "qa280-pr445-r3"]);
    // #457 and #458 have no pinned head in that table and are listed, not given someone else's head
    expect(col.unresolved.some((u) => u.qa_no === 281 && /#457/.test(JSON.stringify(u)))).toBe(true);
  });

  it("F3: the CI test job is recorded per head from gh-facts.json, and a head without a CI run says why", () => {
    const facts = JSON.parse(readFileSync(join(CAL2, "gh-facts.json"), "utf-8")) as { checks: Record<string, { none?: boolean; test_job?: string }> };
    const recorded = Object.values(facts.checks).filter((c) => !c.none);
    expect(recorded.length).toBeGreaterThanOrEqual(80);
    expect(pool.checks_recorded + pool.checks_none).toBe(pool.total);
    for (const c of col.cases) {
      if (c.checks_hint.checks === "recorded") {
        expect(["success", "failure"]).toContain(c.checks_hint.test_job);
        expect(c.checks_hint.ci_run_id).toBeGreaterThan(0);
        expect(c.checks_hint.build_exit === 0 || c.checks_hint.build_exit === 1 || c.checks_hint.build_exit === null).toBe(true);
      } else {
        expect((c.checks_hint.reason ?? "").length, c.case_id).toBeGreaterThan(10);
      }
    }
    // a head whose CI test job passed has build_exit 0 and unit_exit 0, so gate-as-built and Jev-alone can differ
    for (const c of col.cases.filter((x) => x.checks_hint.test_job === "success")) expect([c.checks_hint.build_exit, c.checks_hint.unit_exit]).toEqual([0, 0]);
  });

  it("the QA 273 / QA 274 disagreement on #427 270b550b is a conflict and the case stays out of the held-out candidates", () => {
    const k = col.conflicts.find((x) => x.candidate_sha.startsWith("270b550b"));
    expect(k).toBeDefined();
    expect([k?.kept.label, k?.other.label]).toEqual(["REJECT", "ACCEPT"]);
    const c = col.cases.find((x) => x.case_id === k?.case_id);
    expect(c?.label_disputed).toBe(true);
    const heldOut = col.cases.filter((x) => !x.leak_group && !x.cal1_seen && !x.label_disputed && x.label !== null);
    expect(heldOut.some((x) => x.case_id === k?.case_id)).toBe(false);
    expect(pool.held_out_candidates.total).toBe(heldOut.length);
    expect(pool.conflicts).toBe(col.conflicts.length);
  });
});
