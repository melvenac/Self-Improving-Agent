import { describe, it, expect, beforeAll } from "vitest";
import { spawnSync } from "node:child_process";
import { join } from "node:path";

const CAL2 = join(import.meta.dirname, "../../../docs/loops/jev-calibration-2");

type Run = {
  qa_no: number;
  resolved: boolean;
  prefix: string | null;
  prefix_source: string | null;
  branch: string | null;
  report_path: string | null;
  notes: string[];
  reason: string | null;
};
type Row = { items: string[]; sha: string | null; sha_from: string | null; label: string | null; conflict: boolean; head_note?: string };
type Parsed = { rows: Row[]; skipped: { why: string }[] };
type Out = { real: Record<string, Run>; fake: Record<string, unknown>; verdicts: Record<string, Parsed> };

let out: Out;

describe("jev-calibration-2/resolve.mjs and verdicts.mjs (JEV-CAL-2 r2)", () => {
  beforeAll(() => {
    // check.mjs reads origin refs through git; a failure to run it is a failure of every row below, not a skip.
    const r = spawnSync(process.execPath, [join(CAL2, "check.mjs")], { cwd: CAL2, encoding: "utf-8", timeout: 120_000, maxBuffer: 1 << 26 });
    expect(r.status, r.stderr).toBe(0);
    out = JSON.parse(r.stdout) as Out;
  }, 130_000);

  describe("a report is found from the run's own text, never from the dispatch file name", () => {
    it("QA 258: dispatch qa-258-b4-dispatch.md, prefix b4-misc, report qa/b4-misc-report", () => {
      const r = out.real["258"];
      expect(r.resolved).toBe(true);
      expect(r.prefix).toBe("b4-misc");
      expect(r.prefix_source).toBe("headless-prompt");
      expect(r.branch).toBe("origin/qa/b4-misc-report");
      expect(r.report_path).toBe("docs/loops/b4-misc-qa-report.md");
      // the slug the old collector guessed from the file name is NOT the report's name
      expect(r.branch).not.toBe("origin/qa/b4-report");
    });

    it("QA 279: prefix s161g, report qa/s161g-report", () => {
      const r = out.real["279"];
      expect([r.resolved, r.prefix, r.branch, r.report_path]).toEqual([true, "s161g", "origin/qa/s161g-report", "docs/loops/s161g-qa-report.md"]);
    });

    it("QA 255: prefix b1-start, report qa/b1-start-report", () => {
      const r = out.real["255"];
      expect([r.resolved, r.prefix, r.branch, r.report_path]).toEqual([true, "b1-start", "origin/qa/b1-start-report", "docs/loops/b1-start-qa-report.md"]);
    });
  });

  describe("a run that cannot be resolved is returned with the reason, and nothing is guessed", () => {
    it("a prefix whose branch is not on origin", () => {
      const r = out.fake.branch_missing as Run;
      expect(r.resolved).toBe(false);
      expect(r.prefix).toBe("zz-nope");
      expect(r.reason).toMatch(/^branch missing: origin\/qa\/zz-nope-report/);
      expect(r.report_path).toBeNull();
    });
    it("no prompt and no dispatch at all", () => {
      const r = out.fake.nothing_stated as Run;
      expect([r.resolved, r.prefix]).toEqual([false, null]);
      expect(r.reason).toMatch(/no headless prompt and no dispatch/);
    });
    it("a literal <prefix> in the dispatch and no prefix line in the prompt resolves nothing", () => {
      const r = out.fake.no_prefix as Run;
      expect([r.resolved, r.prefix]).toEqual([false, null]);
      expect(r.reason).toMatch(/^no prefix stated/);
    });
    it("a branch that holds no report file under the stated name", () => {
      const r = out.fake.report_file_missing as Run;
      expect(r.resolved).toBe(false);
      expect(r.reason).toMatch(/^report file missing/);
    });
  });

  describe("order: the prompt's prefix line first, then the dispatch's Commit line", () => {
    it("falls back to the dispatch Commit line when the prompt names no prefix", () => {
      const r = out.fake.from_dispatch as Run;
      expect([r.resolved, r.prefix, r.branch]).toEqual([true, "cd", "origin/qa/cd-report"]);
      expect(r.prefix_source).toMatch(/^dispatch-commit-line/);
    });
    it("the prompt wins when the two disagree, and the run says so", () => {
      const r = out.fake.prompt_wins as Run;
      expect([r.resolved, r.prefix]).toEqual([true, "ef"]);
      expect(r.notes.join(" ")).toContain("qa/gh-report");
    });
    it("the QA numbers are the prompts on master from the floor up, with no cap", () => {
      expect(out.fake.runs as number[]).toEqual([250, 281]);
    });
  });

  describe("one case per PR verdict, read from the report's own table or lines", () => {
    it("a verdict table: heads from the head column, a batch row is not a case, INCOMPLETE is unlabelled", () => {
      const p = out.verdicts.table;
      expect(p.rows.map((r) => [r.items[0], r.sha, r.label])).toEqual([
        ["#10", "aaaaaaa1111", "ACCEPT"],
        ["#11", "bbbbbbb2222", "REJECT"],
        ["#12", "ccccccc3333", null],
      ]);
      expect(p.skipped.map((s) => s.why)).toEqual(["group verdict, not a PR"]);
    });
    it("verdict lines: the head is read from the line; a pair line and a quoted ACCEPT are not cases", () => {
      const p = out.verdicts.lines;
      expect(p.rows.map((r) => [r.items[0], r.sha, r.label])).toEqual([
        ["T-5", "eeeeeee5555", "ACCEPT"],
        ["T-6", "fffffff6666", "REJECT"],
      ]);
    });
    it("two tasks in one commit are ONE case, REJECT because one of them is", () => {
      const p = out.verdicts.shared_head;
      expect(p.rows).toHaveLength(1);
      expect(p.rows[0].items).toEqual(["T-8", "T-9"]);
      expect(p.rows[0].label).toBe("REJECT");
      expect(p.rows[0].sha_from).toBe("candidate-field");
    });
    it("a head-less restatement folds into the row that has the head, once", () => {
      const p = out.verdicts.head_less;
      expect(p.rows).toHaveLength(1);
      expect(p.rows[0].items).toEqual(["#20"]);
      expect(p.rows[0].sha_from).toBe("led-by-item");
    });
    it("a table whose verdict column says Result is read (QA 281); a mutant table's Result column is not; a dash head is no head", () => {
      const p = out.verdicts.result_column;
      expect(p.rows.map((r) => [r.items[0], r.sha, r.label, r.head_note ?? null])).toEqual([
        ["#30", "1111111aaaa", "ACCEPT", null],
        ["#31", null, null, expect.stringMatching(/head column is empty/)],
      ]);
    });
    it("a report with no verdicts gives no rows", () => {
      expect(out.verdicts.empty.rows).toEqual([]);
    });
  });
});
