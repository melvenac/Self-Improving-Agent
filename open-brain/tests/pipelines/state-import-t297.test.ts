// T-297 step 1: what a live project's prose carries reaches the record, or is named where it does not.
import { describe, it, expect } from "vitest";
import { mkdtempSync, mkdirSync, cpSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { spawnAsync } from "../spawn-async.js";
import {
  importDecisions, importHandoff, describeHandoffSeat, findLastSession, describeLastSession, decisionsWarning, type ImportReport,
} from "../../src/pipelines/state-import/index.js";

const fixture = join(import.meta.dirname, "../fixtures-import");
const cliEntry = join(import.meta.dirname, "../../src/cli.ts");
const tsxCli = join(import.meta.dirname, "../../node_modules/tsx/dist/cli.mjs");
const decRep = (): ImportReport["decisions"] => ({ imported: 0, date_from_line: 0, date_partial: [], date_unknown: 0, skipped: [] });
const hRep = (): ImportReport["handoff"] => ({ pick_up_lines: 0, watch_out: 0, open_questions: 0, sections_not_imported: [], not_imported: [] });
const NEXT_PROSE = "# Next session\n\n**Brand** first.\nSecond line.\n\n## Start here\n\ncmd\n\n## Waiting on Aaron\n\n1. pick a design\n";

describe("T-297 step 1", () => {
  it("D1: a dated log imports as D-001.. oldest first, same-date entries in file order, beside an ADR", () => {
    const text = [
      "# Decisions", "",
      "## 2026-10-16 — Renamed", "", "body", "",
      "## 2026-09-05 — Brand", "", "body", "",
      "## 2026-09-05 – Lifecycle", "", "body", "",
      "### ADR-007: Old style", "", "- **Date:** 2026-01-02", "",
    ].join("\n");
    const rep = decRep();
    expect(importDecisions(text, "2026-10-16", rep)).toEqual([
      { id: "ADR-007", title: "Old style", date: "2026-01-02", note: "" },
      { id: "D-001", title: "Brand", date: "2026-09-05", note: "" },
      { id: "D-002", title: "Lifecycle", date: "2026-09-05", note: "" },
      { id: "D-003", title: "Renamed", date: "2026-10-16", note: "" },
    ]);
    expect(rep).toMatchObject({ imported: 4, dated: 3, date_from_line: 1, skipped: [] });
  });

  it("D2: decisionsWarning names a DECISIONS.md with text and nothing imported, and is silent otherwise", () => {
    const base = { decisions: { ...decRep(), imported: 0 }, sources: { decisions: { path: ".agents/SYSTEM/DECISIONS.md", present: true, lines: 12 } } } as unknown as ImportReport;
    expect(decisionsWarning(base)).toBe("WARNING: .agents/SYSTEM/DECISIONS.md has 12 lines and no ADR (`### ADR-N: title`) or dated entry (`## YYYY-MM-DD — title`): 0 decisions will be imported");
    expect(decisionsWarning({ ...base, decisions: { ...decRep(), imported: 1 } } as ImportReport)).toBeNull();
    expect(decisionsWarning({ ...base, sources: { decisions: { path: "x", present: false, lines: 0 } } } as unknown as ImportReport)).toBeNull();
  });

  it("H1: with no 'Pick up here', the preamble and every section are named and pick_up points to the snapshot", () => {
    const rep = hRep();
    const h = importHandoff(NEXT_PROSE, 5, rep);
    expect(rep.sections_not_imported).toEqual(["(text before the first ## heading: 2 lines)", "Start here", "Waiting on Aaron"]);
    expect(rep.pick_up_lines).toBe(0);
    expect(h.pick_up).toBe('Imported from a prose next-session.md with no "Pick up here" section. Not imported: (text before the first ## heading: 2 lines); Start here; Waiting on Aaron. They are in the pre-migration snapshot under .agents/archive/ in the checkout that ran the import; re-enter what is current with ob_state set_handoff.');
    expect(h.open_questions).toEqual([]);
  });

  it("H2: a 'Pick up here' section is imported as written; other sections are still named, with no pointer", () => {
    const rep = hRep();
    const h = importHandoff("# H\n\n## Pick up here\n\nDo this.\n\n## Housekeeping\n\n- x\n", 5, rep);
    expect(h.pick_up).toBe("Do this.");
    expect(rep.sections_not_imported).toEqual(["Housekeeping"]);
  });

  it("S1: a declared role that is not a seat says how to fix it", () => {
    expect(describeHandoffSeat({ seat: "developer", declared_role: "implementation", assumed: true })).toBe(
      'Handoff seat: developer, ASSUMED: the declared role "implementation" is not a seat (planner, developer or qa); set role: in .agents/AGENT.md (or AGENT.local.md) to planner, developer or qa');
  });

  it("L1-L3: the last session's date comes from the heading, then a Date line, else the migration date is named", () => {
    const root = mkdtempSync(join(tmpdir(), "ob-t297-"));
    try {
      const dir = join(root, "SESSIONS");
      mkdirSync(dir);
      writeFileSync(join(dir, "Session_3.md"), "# Session 3 — Applying the design (2026-09-04)\n\nbody\n");
      const l1 = findLastSession(dir, "2026-10-16");
      expect({ date: l1.date, why: l1.date_why }).toEqual({ date: "2026-09-04", why: "read from the log heading" });
      expect(describeLastSession(l1)).toBeNull();

      writeFileSync(join(dir, "Session_4.md"), "# Session 4\n\n**Date:** 2026-09-10\n");
      const l2 = findLastSession(dir, "2026-10-16");
      expect({ n: l2.n, date: l2.date, why: l2.date_why }).toEqual({ n: 4, date: "2026-09-10", why: "read from the log's Date line" });

      writeFileSync(join(dir, "Session_5.md"), "# Session 5\n\nno date here\n");
      const l3 = findLastSession(dir, "2026-10-16");
      expect(l3.date).toBe("2026-10-16");
      expect(describeLastSession(l3)).toBe(".agents/SESSIONS/Session_5.md: no date in its heading or in a Date line. Date used: 2026-10-16, the migration date, because the log heading has no date.");
    } finally {
      rmSync(root, { recursive: true, force: true, maxRetries: 3, retryDelay: 50 });
    }
  });

  it("C1: the draft CLI prints the decisions warning and the not-imported handoff sections", async () => {
    const root = mkdtempSync(join(tmpdir(), "ob-t297-cli-"));
    try {
      cpSync(fixture, root, { recursive: true });
      writeFileSync(join(root, ".agents/SYSTEM/DECISIONS.md"), "# Decisions\n\nSome prose, and no heading the importer reads.\n");
      writeFileSync(join(root, ".agents/SESSIONS/next-session.md"), NEXT_PROSE);
      const r = await spawnAsync(process.execPath, [tsxCli, cliEntry, "state", "import", "--draft", root], { cwd: root, env: process.env });
      if (r.error) throw r.error;
      expect(r.stdout).toMatch(/WARNING: \.agents\/SYSTEM\/DECISIONS\.md has \d+ lines and no ADR/);
      expect(r.stdout).toContain("Handoff: 3 section(s) NOT imported ((text before the first ## heading: 2 lines); Start here; Waiting on Aaron); they stay only in the snapshot, and pick_up will point to it");
    } finally {
      rmSync(root, { recursive: true, force: true, maxRetries: 3, retryDelay: 50 });
    }
  });
});
