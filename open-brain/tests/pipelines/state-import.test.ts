import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, cpSync, rmSync, readFileSync, writeFileSync, existsSync, readdirSync, statSync, mkdirSync } from "node:fs";
import { join, relative } from "node:path";
import { tmpdir } from "node:os";
import {
  runDraft,
  runCommit,
  takeSnapshot,
  planSummaryRemoval,
  importTasks,
  importDecisions,
  importHandoff,
  DRAFT_REL,
  REPORT_REL,
  STATE_REL,
  type ImportReport,
} from "../../src/pipelines/state-import/index.js";
import { parseState, StateSchema } from "../../src/shared/state-schema.js";
import { applyStateOps } from "../../src/shared/state-writer.js";
import { readViewHeaders } from "../../src/pipelines/sync/checks-state.js";

const fixture = join(import.meta.dirname, "../fixtures-import");
const TODAY = "2026-09-14";

/** Every file under dir as relative path → bytes. */
function tree(dir: string, skip: (rel: string) => boolean = () => false): Map<string, Buffer> {
  const out = new Map<string, Buffer>();
  const walk = (d: string) => {
    for (const name of readdirSync(d)) {
      const p = join(d, name);
      const rel = relative(dir, p).replace(/\\/g, "/");
      if (skip(rel)) continue;
      if (statSync(p).isDirectory()) walk(p);
      else out.set(rel, readFileSync(p));
    }
  };
  walk(dir);
  return out;
}

function section(text: string, heading: string): string {
  const lines = text.split(/\r?\n/);
  const start = lines.findIndex((l) => l === heading);
  if (start === -1) throw new Error(`heading not found: ${heading}`);
  let end = start + 1;
  while (end < lines.length && !lines[end].startsWith("## ")) end++;
  return lines.slice(start, end).join("\n");
}

function inboxReport(): ImportReport["inbox"] {
  const zero = () => ({ open: 0, in_progress: 0, blocked: 0, done: 0 });
  return {
    items: 0, box_counts: zero(), by_priority: { P0: zero(), P1: zero(), P2: zero(), P3: zero() }, by_status: zero(),
    completed_section_items: 0, unparsed: [], superseded_links: [], sessions: { parsed: 0, inferred_open_as_current: 0, inferred_done_as_retention_edge: 0 },
    title_fallbacks: [], retention_eligible_on_first_write: 0,
  };
}

describe("state import (Loop 4 C1) on a fixture built from this repo's prose files", () => {
  let root: string;

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), "ob-import-"));
    cpSync(fixture, root, { recursive: true });
  });

  afterEach(() => {
    rmSync(root, { recursive: true, force: true, maxRetries: 3, retryDelay: 50 });
  });

  it("--draft writes a schema-valid draft + report and changes nothing else; counts match the hand count of INBOX boxes (V5)", () => {
    const before = tree(root);
    const r = runDraft(root, TODAY);
    expect(r.validation).toEqual({ ok: true });
    const after = tree(root);
    expect([...after.keys()].filter((k) => !before.has(k)).sort()).toEqual([DRAFT_REL, REPORT_REL]);
    for (const [k, v] of before) expect(after.get(k)!.equals(v)).toBe(true);

    const parsed = parseState(readFileSync(join(root, DRAFT_REL), "utf-8"));
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    const s = parsed.data;
    expect(s.revision).toBe(0);
    expect(s.project).toEqual({ name: "self-improving-agent" });

    // Hand count of the fixture INBOX: 55 `[ ]`, 3 `[~]`, 0 `[!]`, 85 `[x]` = 143 items.
    const rep = r.draft.report.inbox;
    expect(rep.box_counts).toEqual({ open: 55, in_progress: 3, blocked: 0, done: 85 });
    expect(rep.items).toBe(143);
    expect(s.tasks).toHaveLength(143);
    // 14 `[superseded…]` items flip to done → 42 open / 3 in_progress / 0 blocked / 98 done.
    expect(rep.superseded_links).toHaveLength(14);
    expect(rep.by_status).toEqual({ open: 42, in_progress: 3, blocked: 0, done: 98 });
    expect(rep.by_priority).toEqual({
      P0: { open: 14, in_progress: 0, blocked: 0, done: 30 },
      P1: { open: 18, in_progress: 2, blocked: 0, done: 35 },
      P2: { open: 9, in_progress: 1, blocked: 0, done: 18 },
      P3: { open: 1, in_progress: 0, blocked: 0, done: 15 },
    });
    expect(rep.completed_section_items).toBe(15);
    // Every [superseded] item is done and is pointed at by the item above it.
    const superseded = s.tasks.filter((t) => /^\[superseded/i.test(t.title));
    expect(superseded).toHaveLength(14);
    for (const t of superseded) {
      expect(t.status).toBe("done");
      const idx = s.tasks.findIndex((x) => x.id === t.id);
      expect(s.tasks[idx - 1].supersedes).toBe(t.id);
    }
    // R2 holds on every imported row.
    for (const t of s.tasks) expect(t.status === "done").toBe(t.closed_session !== null);
    // Sessions: parsed vs inferred are reported, and the two legend lines are the only unparsed lines.
    expect(rep.sessions).toEqual({ parsed: 126, inferred_open_as_current: 8, inferred_done_as_retention_edge: 9 });
    expect(rep.unparsed.map((u) => u.line)).toEqual([3, 4]);
    expect(rep.title_fallbacks.map((t) => t.line)).toEqual([227, 228]);

    // Title / note rule on the first item: bold lead up to the first " — ", the rest verbatim in the note.
    expect(s.tasks[0]).toMatchObject({ id: "T-001", priority: "P0", status: "open", opened_session: 54, closed_session: null });
    expect(s.tasks[0].title).toBe("Loop 4 — dogfood: migrate this repo's `.agents/` to `state.json`, switch `/end` to `ob_state`, run on it".split(" — ")[0]);
    expect(s.tasks[0].note).toContain("NEW (Session 54)");

    // Decisions, handoff, objective, seeds, last_session.
    // Synthetic DECISIONS.md: partial date, full date, no date, one unnumbered heading, one trailing undated.
    expect(s.decisions.map((d) => d.id)).toEqual(["ADR-001", "ADR-002", "ADR-003", "ADR-004"]);
    expect(s.decisions[0]).toEqual({ id: "ADR-001", title: "A partial date is kept in the note, not the date field", date: TODAY, note: "imported; original date partial: 2026-03" });
    expect(s.decisions[1]).toEqual({ id: "ADR-002", title: "A full date is kept as written", date: "2026-03-22", note: "" });
    expect(s.decisions[2].note).toBe("imported; original date unknown");
    expect(s.decisions[3].note).toBe("imported; original date unknown");
    expect(r.draft.report.decisions).toMatchObject({ imported: 4, date_from_line: 1, date_unknown: 2, date_partial: [{ id: "ADR-001", original: "2026-03" }] });
    expect(r.draft.report.decisions.skipped).toHaveLength(1);
    expect(r.draft.report.decisions.skipped[0].heading).toContain("### ADR: An unnumbered heading");
    expect(s.objective!.text.startsWith("**Loop 4 of the extraction evaluation")).toBe(true);
    expect(s.objective!.since_session).toBe(54);
    expect(s.handoff.session).toBe(54);
    expect(s.handoff.watch_out).toHaveLength(9);
    expect(s.handoff.open_questions).toHaveLength(2);
    expect(s.handoff.pick_up).toMatch(/^Loop 4 per /);
    expect(s.verified.map((v) => v.id)).toEqual(["V-001", "V-002", "V-003", "V-004", "V-005"]);
    expect(s.gaps.map((g) => g.id)).toEqual(["G-001", "G-002", "G-003", "G-004", "G-005", "G-006"]);
    expect(s.last_session).toEqual({ n: 54, date: TODAY, uuid: "00000000-0000-4000-8000-000000000054" });

    const report = readFileSync(join(root, REPORT_REL), "utf-8");
    expect(report).toContain("| **all** | 42 | 3 | 0 | 98 | 143 |");
    expect(report).toContain("- status blockquote after the title (line 1): 74 `>` lines");
    expect(report).toContain("- `## Current State` through the next `## ` heading: 105 lines");
    expect(report).toContain("Draft validates against StateSchema.");
  });

  it("--draft refuses when state.json already exists", () => {
    mkdirSync(join(root, ".agents"), { recursive: true });
    writeFileSync(join(root, STATE_REL), "{}");
    expect(() => runDraft(root, TODAY)).toThrow(/already exists — the importer runs once/);
    expect(existsSync(join(root, DRAFT_REL))).toBe(false);
  });

  it("--commit: snapshot byte-complete before any change (P2), state.json rev 0, SUMMARY cut (line counts), four views rendered, draft moved, prose sections byte-identical (P8), second commit refuses (V5)", () => {
    runDraft(root, TODAY);
    const preCommit = tree(root);
    const summaryBefore = readFileSync(join(root, ".agents/SYSTEM/SUMMARY.md"), "utf-8");

    const r = runCommit(root, TODAY, { version: "0.30.0" });

    // P2: the snapshot equals the pre-commit tree (everything under .agents/, minus archive/), byte for byte.
    const snapRel = relative(root, r.snapshot.dir).replace(/\\/g, "/");
    expect(snapRel).toBe(".agents/archive/pre-state-migration-2026-09-14");
    const snap = tree(r.snapshot.dir);
    const expected = new Map([...preCommit].filter(([k]) => k.startsWith(".agents/") && !k.startsWith(".agents/archive/")).map(([k, v]) => [k.slice(".agents/".length), v]));
    expect([...snap.keys()].sort()).toEqual([...expected.keys()].sort());
    for (const [k, v] of expected) expect(snap.get(k)!.equals(v)).toBe(true);
    expect(r.snapshot.files).toBe(expected.size);

    // state.json at revision 0, canonical.
    const st = parseState(readFileSync(join(root, STATE_REL), "utf-8"));
    expect(st.ok).toBe(true);
    if (st.ok) expect(st.data.revision).toBe(0);
    expect(readFileSync(join(root, STATE_REL), "utf-8")).toBe(preCommit.get(DRAFT_REL)!.toString("utf-8"));

    // SUMMARY: blockquote and Current State gone, counts reported, prose sections identical.
    expect(r.summary).toMatchObject({ blockquote_lines: 74, current_state_lines: 105, total_lines_removed: 181 });
    const summaryAfter = readFileSync(join(root, ".agents/SYSTEM/SUMMARY.md"), "utf-8");
    expect(summaryAfter).not.toContain("## Current State");
    expect(summaryAfter).not.toContain("> **Last Updated:**");
    expect(summaryAfter).toContain("<!-- state:begin -->");
    for (const h of ["## Architecture Overview", "## Search Architecture (v0.6.0)", "## Key Distinction", "## Research Context (Session 8)"]) {
      expect(section(summaryAfter, h)).toBe(section(summaryBefore, h));
    }
    expect(summaryAfter.split(/\r?\n/).length).toBeLessThan(summaryBefore.split(/\r?\n/).length - 100);

    // Four views rendered with the rev 0 header.
    expect(r.rendered).toEqual([".agents/TASKS/INBOX.md", ".agents/TASKS/task.md", ".agents/SESSIONS/next-session.md", ".agents/SYSTEM/SUMMARY.md"]);
    for (const h of readViewHeaders(root)) expect(h).toMatchObject({ present: true, rev: 0, version: "0.30.0" });

    // Draft + report moved into the snapshot.
    expect(existsSync(join(root, DRAFT_REL))).toBe(false);
    expect(existsSync(join(root, REPORT_REL))).toBe(false);
    expect(r.moved.sort()).toEqual([`${snapRel}/state.draft.json`, `${snapRel}/state.import-report.md`].sort());

    // Second commit refuses; so does a re-draft.
    expect(() => runCommit(root, TODAY)).toThrow(/already exists — the importer runs once/);
    expect(() => runDraft(root, TODAY)).toThrow(/already exists/);

    // P3: the writer accepts the migrated file — first real write bumps to revision 1.
    const w = applyStateOps(root, { session: 55, expected_revision: 0, ops: [{ op: "end_session", n: 55, date: "2026-09-14", uuid: null }], version: "0.30.0" });
    expect(w.ok).toBe(true);
    expect(w.revision_after).toBe(1);
    // Retention on the first write drops the done items closed ≤ 52 (session 55 − 3).
    expect(w.dropped_task_ids.length).toBeGreaterThan(50);
  });

  it("--commit refuses without a draft, on a draft that does not validate, and on an existing snapshot without --force-snapshot", () => {
    expect(() => runCommit(root, TODAY)).toThrow(/state\.draft\.json not found/);
    runDraft(root, TODAY);
    const draftPath = join(root, DRAFT_REL);
    const good = readFileSync(draftPath, "utf-8");
    writeFileSync(draftPath, good.replace('"revision": 0', '"revision": -1'));
    expect(() => runCommit(root, TODAY)).toThrow(/does not validate at revision/);
    writeFileSync(draftPath, good);
    mkdirSync(join(root, ".agents/archive/pre-state-migration-2026-09-14"), { recursive: true });
    expect(() => runCommit(root, TODAY)).toThrow(/snapshot .* already exists — pass --force-snapshot/);
    expect(existsSync(join(root, STATE_REL))).toBe(false);
    const forced = runCommit(root, TODAY, { forceSnapshot: true });
    expect(existsSync(forced.statePath)).toBe(true);
  });

  it("takeSnapshot excludes archive/ and refuses a second run without force", () => {
    mkdirSync(join(root, ".agents/archive/old"), { recursive: true });
    writeFileSync(join(root, ".agents/archive/old/x.md"), "old");
    const s = takeSnapshot(root, TODAY, false);
    expect(existsSync(join(s.dir, "TASKS/INBOX.md"))).toBe(true);
    expect(existsSync(join(s.dir, "archive"))).toBe(false);
    expect(() => takeSnapshot(root, TODAY, false)).toThrow(/already exists/);
    expect(takeSnapshot(root, TODAY, true).dir).toBe(s.dir);
  });
});

describe("state import parsing rules (unit)", () => {
  it("INBOX rules: box → status, priority from section, title/note split, session markers, superseded link, unparsed lines reported", () => {
    const text = [
      "# Inbox",
      "> legend line",
      "",
      "## P0 — Critical",
      "",
      "- [x] **Fixed thing — FIXED (Session 50, v0.15.0).** Details here. (Sessions 49, 50)",
      "- [ ] **[superseded] Original finding: fixed thing** (Session 49). Old text.",
      "- [~] **In flight** — working on it",
      "  continued on the next line",
      "- [!] **Blocked** — waiting",
      "stray prose line",
      "",
      "## P2 — Medium",
      "",
      "- [ ] No bold here. Second sentence.",
      "- [x] Old done item with no session at all",
      "",
      "## Completed",
      "",
      "- [x] **Ancient** — done long ago (Sessions 40-41)",
      "",
    ].join("\n");
    const rep = inboxReport();
    const tasks = importTasks(text, 55, rep);
    expect(tasks.map((t) => [t.id, t.priority, t.status, t.opened_session, t.closed_session, t.supersedes])).toEqual([
      ["T-001", "P0", "done", 49, 50, "T-002"],
      ["T-002", "P0", "done", 49, 49, null],
      ["T-003", "P0", "in_progress", 55, null, null],
      ["T-004", "P0", "blocked", 55, null, null],
      ["T-005", "P2", "open", 55, null, null],
      ["T-006", "P2", "done", 52, 52, null],
      ["T-007", "P3", "done", 40, 41, null],
    ]);
    expect(tasks[0].title).toBe("Fixed thing");
    expect(tasks[0].note).toBe("**FIXED (Session 50, v0.15.0).** Details here. (Sessions 49, 50)");
    expect(tasks[2].note).toBe("working on it continued on the next line");
    expect(tasks[4].title).toBe("No bold here.");
    expect(tasks[4].note).toBe("Second sentence.");
    // Boxes as written: `[ ]` ×2 (one of them [superseded]), `[~]`, `[!]`, `[x]` ×3. Imported: the superseded one is done.
    expect(rep.box_counts).toEqual({ open: 2, in_progress: 1, blocked: 1, done: 3 });
    expect(rep.by_status).toEqual({ open: 1, in_progress: 1, blocked: 1, done: 4 });
    expect(rep.superseded_links).toEqual([{ from: "T-001", from_line: 6, to: "T-002", to_line: 7 }]);
    expect(rep.unparsed).toEqual([
      { line: 2, text: "> legend line", reason: "not an item, heading or blank line — ignored (kept in the snapshot)" },
      { line: 11, text: "stray prose line", reason: "not an item, heading or blank line — ignored (kept in the snapshot)" },
    ]);
    expect(rep.sessions).toEqual({ parsed: 3, inferred_open_as_current: 3, inferred_done_as_retention_edge: 1 });
    expect(rep.title_fallbacks).toEqual([{ line: 15, title: "No bold here." }, { line: 16, title: "Old done item with no session at all" }]);
    expect(rep.completed_section_items).toBe(1);
    for (const t of tasks) expect(StateSchema.shape.tasks.element.safeParse(t).success).toBe(true);
  });

  it("DECISIONS rules: full date kept, partial and missing dates fall back to the migration date with a note, unnumbered ADR skipped", () => {
    const text = [
      "### ADR-001: First", "", "- **Date:** 2026-03-22", "body",
      "### ADR-002: Second", "", "- **Date:** 2026-03", "body",
      "### ADR-003: Third", "", "body only",
      "### ADR: Unnumbered", "", "body",
      "### ADR-003: Duplicate", "",
    ].join("\n");
    const rep: ImportReport["decisions"] = { imported: 0, date_from_line: 0, date_partial: [], date_unknown: 0, skipped: [] };
    const d = importDecisions(text, "2026-09-14", rep);
    expect(d).toEqual([
      { id: "ADR-001", title: "First", date: "2026-03-22", note: "" },
      { id: "ADR-002", title: "Second", date: "2026-09-14", note: "imported; original date partial: 2026-03" },
      { id: "ADR-003", title: "Third", date: "2026-09-14", note: "imported; original date unknown" },
    ]);
    expect(rep).toMatchObject({ imported: 3, date_from_line: 1, date_unknown: 1, date_partial: [{ id: "ADR-002", original: "2026-03" }] });
    expect(rep.skipped.map((s) => s.reason)).toEqual(["ADR heading without a number — no id can be assigned", "duplicate id ADR-003"]);
  });

  it("next-session rules: pick_up text, watch_out bullets, open_questions bullets (empty when absent), other sections reported", () => {
    const rep: ImportReport["handoff"] = { pick_up_lines: 0, watch_out: 0, open_questions: 0, sections_not_imported: [] };
    const h = importHandoff("# H\n\n## Pick up here (x)\n\nDo this.\nThen that.\n\n### Refs\n\n- a\n\n### Watch out for\n\n- one\n- two\n", 55, rep);
    expect(h).toEqual({ pick_up: "Do this.\nThen that.", watch_out: ["one", "two"], open_questions: [], session: 55 });
    expect(rep).toEqual({ pick_up_lines: 2, watch_out: 2, open_questions: 0, sections_not_imported: ["Refs"] });
    expect(importHandoff(null, 55, rep)).toEqual({ pick_up: "", watch_out: [], open_questions: [], session: 55 });
  });

  it("SUMMARY surgery removes exactly the title blockquote and the Current State section and leaves everything else byte for byte", () => {
    const text = "# Title\n\n> **Status:** old\n> more\n\n## Current State\n\nstuff\n- a\n\n## Architecture\n\nkeep\n\n## Last\nend\n";
    const p = planSummaryRemoval(text);
    expect(p.text).toBe("# Title\n## Architecture\n\nkeep\n\n## Last\nend\n");
    // 4 lines for the status block (blank, 2× `>`, blank) + 5 for the section.
    expect(p.report).toEqual({ title_line: 1, blockquote_lines: 2, current_state_lines: 5, total_lines_removed: 9, kept_headings: ["Architecture", "Last"] });
    // No blockquote: nothing after the title is touched.
    const none = planSummaryRemoval("# T\n\n## Architecture\nkeep\n");
    expect(none.text).toBe("# T\n\n## Architecture\nkeep\n");
    expect(none.report.total_lines_removed).toBe(0);
  });
});
