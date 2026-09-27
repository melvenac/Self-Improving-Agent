import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, cpSync, rmSync, readFileSync, existsSync, readdirSync, statSync, mkdirSync, writeFileSync } from "node:fs";
import { basename, join, relative } from "node:path";
import { tmpdir } from "node:os";
import {
  applyStateOps,
  applyRetention,
  nextId,
  validateResultState,
  DONE_RETENTION_SESSIONS,
  readState as readStateDoor,
  type WriteResult,
} from "../../src/shared/state-writer.js";
import { parseState, type State } from "../../src/shared/state-schema.js";

const fixturesDir = join(import.meta.dirname, "../fixtures");
const stateFixture = join(import.meta.dirname, "../fixtures-state/state.json");
const STATE = ".agents/state.json";
const SESSION = 55; // fixture last_session is 54

/** Every file under root as relative path → bytes, for "touched nothing else" checks. */
function snapshot(root: string): Map<string, string> {
  const out = new Map<string, string>();
  const walk = (dir: string) => {
    for (const name of readdirSync(dir)) {
      const p = join(dir, name);
      if (statSync(p).isDirectory()) walk(p);
      else out.set(relative(root, p).replace(/\\/g, "/"), readFileSync(p, "utf-8"));
    }
  };
  walk(root);
  return out;
}

function readState(root: string): State {
  const r = parseState(readFileSync(join(root, STATE), "utf-8"));
  if (!r.ok) throw new Error(r.error);
  return r.data;
}

function expectRefused(r: WriteResult, pattern: RegExp): void {
  expect(r.ok).toBe(false);
  expect(r.error).toMatch(pattern);
  expect(r.applied).toEqual([]);
  expect(r.rendered).toEqual([]);
}

describe("applyStateOps (Loop 3 writer)", () => {
  let root: string;
  let before: string;

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), "ob-state-writer-"));
    cpSync(fixturesDir, root, { recursive: true });
    cpSync(stateFixture, join(root, STATE));
    before = readFileSync(join(root, STATE), "utf-8");
  });

  afterEach(() => {
    rmSync(root, { recursive: true, force: true, maxRetries: 3, retryDelay: 50 });
  });

  // ---- V1: refusals, atomicity, dry run, revision ----

  it("refuses a revision mismatch naming both values and writes nothing (V1)", () => {
    const r = applyStateOps(root, { session: SESSION, expected_revision: 6, ops: [{ op: "set_objective", text: "x" }] });
    expectRefused(r, /revision mismatch: expected_revision 6 but \.agents\/state\.json is at revision 7/);
    expect(r.revision_before).toBe(7);
    expect(r.revision_after).toBe(7);
    expect(readFileSync(join(root, STATE), "utf-8")).toBe(before);
    expect(existsSync(join(root, ".agents/TASKS/task.md"))).toBe(false);
  });

  it("an unknown id refuses the whole batch — earlier valid ops are not applied (V1)", () => {
    const r = applyStateOps(root, {
      session: SESSION, expected_revision: 7,
      ops: [
        { op: "open_task", title: "would be T-028", priority: "P1" },
        { op: "close_task", id: "T-999" },
      ],
    });
    expectRefused(r, /^ops\[1\] \(close_task\): unknown task T-999$/);
    expect(readFileSync(join(root, STATE), "utf-8")).toBe(before);
    expect(readState(root).tasks.some((t) => t.id === "T-028")).toBe(false);
  });

  it("an op with bad arguments refuses with its index and zod path (V1)", () => {
    const r = applyStateOps(root, { session: SESSION, expected_revision: 7, ops: [{ op: "open_task", title: "x", priority: "P7" }] });
    expectRefused(r, /^ops\[0\] invalid at priority: /);
    const unknownOp = applyStateOps(root, { session: SESSION, expected_revision: 7, ops: [{ op: "delete_everything" }] });
    expectRefused(unknownOp, /^ops\[0\] invalid at op: /);
    const extraKey = applyStateOps(root, { session: SESSION, expected_revision: 7, ops: [{ op: "close_gap", id: "G-001", force: true }] });
    expectRefused(extraKey, /^ops\[0\] invalid at /);
    expect(readFileSync(join(root, STATE), "utf-8")).toBe(before);
  });

  it("the result-schema gate names the path; it is unit-tested because validated ops cannot reach it (V1)", () => {
    const s = readState(root) as unknown as Record<string, unknown>;
    s.revision = -1;
    const r = validateResultState(s);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/^result would not validate at revision: .* — nothing written$/);
    const t = readState(root);
    (t.tasks[0] as unknown as Record<string, unknown>).owner = "x";
    const r2 = validateResultState(t);
    expect(r2.ok).toBe(false);
    if (!r2.ok) expect(r2.error).toContain("tasks.0");
  });

  it("writes atomically: canonical bytes, no temp file left behind, revision +1 per call (V1)", () => {
    const r1 = applyStateOps(root, { session: SESSION, expected_revision: 7, ops: [{ op: "set_objective", text: "first" }] });
    expect(r1.ok).toBe(true);
    expect(r1.revision_before).toBe(7);
    expect(r1.revision_after).toBe(8);
    expect(readState(root).revision).toBe(8);
    const r2 = applyStateOps(root, { session: SESSION, expected_revision: 8, ops: [{ op: "set_objective", text: "second" }] });
    expect(r2.revision_after).toBe(9);
    expect(readState(root).revision).toBe(9);
    // Stale revision after a successful write is refused.
    expectRefused(applyStateOps(root, { session: SESSION, expected_revision: 8, ops: [{ op: "set_objective", text: "x" }] }), /revision mismatch/);

    const leftovers = readdirSync(join(root, ".agents")).filter((f) => f.includes(".tmp-"));
    expect(leftovers).toEqual([]);
    for (const dir of [".agents/TASKS", ".agents/SESSIONS", ".agents/SYSTEM"]) {
      expect(readdirSync(join(root, dir)).filter((f) => f.includes(".tmp-"))).toEqual([]);
    }
    // Canonical: parse + serialize reproduces the bytes on disk.
    const text = readFileSync(join(root, STATE), "utf-8");
    expect(text.endsWith("\n")).toBe(true);
    expect(text.startsWith('{\n  "schema_version": 3,\n  "revision": 9,')).toBe(true);
  });

  it("dry_run returns the full result and changes nothing on disk (V1)", () => {
    const snap = snapshot(root);
    const r = applyStateOps(root, {
      session: SESSION, expected_revision: 7, dry_run: true,
      ops: [{ op: "close_task", id: "T-005" }, { op: "open_task", title: "dry", priority: "P2" }],
    });
    expect(r.ok).toBe(true);
    expect(r.dry_run).toBe(true);
    expect(r.revision_after).toBe(8);
    expect(r.applied).toEqual([{ op: "close_task", id: "T-005" }, { op: "open_task", id: "T-028" }]);
    expect(r.rendered).toEqual([".agents/TASKS/INBOX.md", ".agents/TASKS/task.md", ".agents/SESSIONS/next-session.md", ".agents/SYSTEM/SUMMARY.md"]);
    expect(snapshot(root)).toEqual(snap);
    expect(readFileSync(join(root, STATE), "utf-8")).toBe(before);
  });

  // ---- V2: one test per op ----

  it("open_task assigns T-NNN, sets status open and opened_session (V2)", () => {
    const r = applyStateOps(root, { session: SESSION, expected_revision: 7, ops: [
      { op: "open_task", title: "New thing", priority: "P1", note: "n", supersedes: "T-024" },
      { op: "open_task", title: "Another", priority: "P3" },
    ] });
    expect(r.applied).toEqual([{ op: "open_task", id: "T-028" }, { op: "open_task", id: "T-029" }]);
    const t = readState(root).tasks.find((x) => x.id === "T-028")!;
    expect(t).toEqual({ id: "T-028", title: "New thing", priority: "P1", status: "open", opened_session: SESSION, closed_session: null, supersedes: "T-024", note: "n", note_by: null, closed_rev: null });
    expectRefused(applyStateOps(root, { session: SESSION, expected_revision: 8, ops: [{ op: "open_task", title: "x", priority: "P0", supersedes: "T-404" }] }), /supersedes unknown task T-404/);
    expectRefused(applyStateOps(root, { session: SESSION, expected_revision: 8, ops: [{ op: "open_task", id: "T-028", title: "dup", priority: "P0" }] }), /task T-028 already exists/);
  });

  it("update_task changes fields, refuses status done and refuses a done task (V2)", () => {
    const r = applyStateOps(root, { session: SESSION, expected_revision: 7, ops: [
      { op: "update_task", id: "T-008", title: "Renamed", priority: "P0", status: "in_progress", replace_note: "moving" },
    ] });
    expect(r.ok).toBe(true);
    const t = readState(root).tasks.find((x) => x.id === "T-008")!;
    expect(t).toMatchObject({ title: "Renamed", priority: "P0", status: "in_progress", note: "moving", opened_session: 54, closed_session: null });
    expectRefused(applyStateOps(root, { session: SESSION, expected_revision: 8, ops: [{ op: "update_task", id: "T-008", status: "done" }] }), /^ops\[0\] invalid at status: /);
    expectRefused(applyStateOps(root, { session: SESSION, expected_revision: 8, ops: [{ op: "update_task", id: "T-001", append_note: "x" }] }), /task T-001 is done/);
    expectRefused(applyStateOps(root, { session: SESSION, expected_revision: 8, ops: [{ op: "update_task", id: "T-777", append_note: "x" }] }), /unknown task T-777/);
  });

  it("close_task sets done + closed_session, and refuses a second close (V2)", () => {
    const r = applyStateOps(root, { session: SESSION, expected_revision: 7, ops: [{ op: "close_task", id: "T-005", replace_note: "shipped", replace_other_sessions: true }] });
    expect(r.applied).toEqual([{ op: "close_task", id: "T-005" }]);
    const t = readState(root).tasks.find((x) => x.id === "T-005")!;
    expect(t).toMatchObject({ status: "done", closed_session: SESSION, note: "shipped" });
    expectRefused(applyStateOps(root, { session: SESSION, expected_revision: 8, ops: [{ op: "close_task", id: "T-005" }] }), /already done \(closed session 55\)/);
  });

  /** Loop 4 R1: a regression reopens the same task; the note is appended, not replaced. */
  it("reopen_task moves done → open, clears closed_session, appends the note, and refuses a task that is not done (R1)", () => {
    const r = applyStateOps(root, { session: SESSION, expected_revision: 7, ops: [{ op: "reopen_task", id: "T-001", note: "regressed in 0.30.1" }] });
    expect(r.applied).toEqual([{ op: "reopen_task", id: "T-001" }]);
    const t = readState(root).tasks.find((x) => x.id === "T-001")!;
    expect(t).toMatchObject({ status: "open", closed_session: null, opened_session: 53, note: "Loop 1, v0.28.0 — regressed in 0.30.1" });
    // It is an ordinary open task again: update and close both work.
    const r2 = applyStateOps(root, { session: SESSION, expected_revision: 8, ops: [{ op: "update_task", id: "T-001", status: "in_progress" }, { op: "close_task", id: "T-001", replace_note: "fixed again", replace_other_sessions: true }] });
    expect(r2.ok).toBe(true);
    expect(readState(root).tasks.find((x) => x.id === "T-001")).toMatchObject({ status: "done", closed_session: SESSION, note: "fixed again" });
    // Refusals: not done, unknown, empty note.
    expectRefused(applyStateOps(root, { session: SESSION, expected_revision: 9, ops: [{ op: "reopen_task", id: "T-005", note: "x" }] }), /task T-005 is not done \(status in_progress\)/);
    expectRefused(applyStateOps(root, { session: SESSION, expected_revision: 9, ops: [{ op: "reopen_task", id: "T-999", note: "x" }] }), /unknown task T-999/);
    expectRefused(applyStateOps(root, { session: SESSION, expected_revision: 9, ops: [{ op: "reopen_task", id: "T-001", note: "" }] }), /^ops\[0\] invalid at note: /);
    // A task with no prior note gets the note verbatim.
    applyStateOps(root, { session: SESSION, expected_revision: 9, ops: [{ op: "reopen_task", id: "T-002", note: "back" }] });
    expect(readState(root).tasks.find((x) => x.id === "T-002")!.note).toBe("back");
  });

  /** Loop 4 R3: an empty batch re-renders the views and is a no-op on state.json. */
  it("ops: [] with render: true re-renders the views, leaves revision and state.json bytes unchanged, and runs no retention (R3)", () => {
    const r = applyStateOps(root, { session: 60, expected_revision: 7, ops: [], render: true, version: "9.9.9" });
    expect(r.ok).toBe(true);
    expect(r.revision_before).toBe(7);
    expect(r.revision_after).toBe(7);
    expect(r.applied).toEqual([]);
    expect(r.dropped_task_ids).toEqual([]); // session 60 would have dropped every done task if retention ran
    expect(r.rendered).toEqual([".agents/TASKS/INBOX.md", ".agents/TASKS/task.md", ".agents/SESSIONS/next-session.md", ".agents/SYSTEM/SUMMARY.md"]);
    expect(readFileSync(join(root, STATE), "utf-8")).toBe(before);
    const header = "<!-- generated from .agents/state.json rev 7 by open-brain v9.9.9 — do not edit; change state via ob_state -->";
    expect(readFileSync(join(root, ".agents/TASKS/INBOX.md"), "utf-8").startsWith(header)).toBe(true);
    expect(readFileSync(join(root, ".agents/SYSTEM/SUMMARY.md"), "utf-8")).toContain(header);
    // The revision did not move, so the same expected_revision still writes.
    expect(applyStateOps(root, { session: SESSION, expected_revision: 7, ops: [{ op: "set_objective", text: "x" }] }).revision_after).toBe(8);
  });

  it("add_verified assigns V-NNN with since_session and requires evidence (V2)", () => {
    const ev = { type: "test", path: "open-brain/tests/x.test.ts", observation: "green" };
    const r = applyStateOps(root, { session: SESSION, expected_revision: 7, ops: [{ op: "add_verified", claim: "It holds", evidence: [ev] }] });
    expect(r.applied).toEqual([{ op: "add_verified", id: "V-009" }]);
    const v = readState(root).verified.find((x) => x.id === "V-009")!;
    expect(v).toEqual({ id: "V-009", claim: "It holds", evidence: [ev], since_session: SESSION, status: "verified" });
    expectRefused(applyStateOps(root, { session: SESSION, expected_revision: 8, ops: [{ op: "add_verified", claim: "x", evidence: [] }] }), /^ops\[0\] invalid at evidence: /);
  });

  it("reopen_verified flips status and appends the evidence record (V2)", () => {
    const ev = { type: "regression", path: "open-brain/src/server.ts", observation: "broke again" };
    const r = applyStateOps(root, { session: SESSION, expected_revision: 7, ops: [{ op: "reopen_verified", id: "V-001", evidence: ev }] });
    expect(r.ok).toBe(true);
    const v = readState(root).verified.find((x) => x.id === "V-001")!;
    expect(v.status).toBe("reopened");
    expect(v.evidence).toHaveLength(2);
    expect(v.evidence[1]).toEqual(ev);
    expectRefused(applyStateOps(root, { session: SESSION, expected_revision: 8, ops: [{ op: "reopen_verified", id: "V-404", evidence: ev }] }), /unknown verified V-404/);
  });

  it("add_gap assigns G-NNN; close_gap removes it and reports the removal (V2)", () => {
    const r = applyStateOps(root, { session: SESSION, expected_revision: 7, ops: [
      { op: "add_gap", what: "w", evidence: "e", recommended_update: "r" },
      { op: "close_gap", id: "G-001" },
    ] });
    expect(r.applied).toEqual([{ op: "add_gap", id: "G-006" }, { op: "close_gap", id: "G-001" }]);
    expect(r.removed_gap_ids).toEqual(["G-001"]);
    const gaps = readState(root).gaps;
    expect(gaps.map((g) => g.id)).toEqual(["G-002", "G-003", "G-004", "G-005", "G-006"]);
    expect(gaps.find((g) => g.id === "G-006")).toEqual({ id: "G-006", what: "w", evidence: "e", recommended_update: "r", opened_session: SESSION });
    expectRefused(applyStateOps(root, { session: SESSION, expected_revision: 8, ops: [{ op: "close_gap", id: "G-001" }] }), /unknown gap G-001/);
  });

  /**
   * ADR-021: gaps are amendable. Before this op the only way to correct a gap's
   * text was close + re-add, which silently minted a new id and reset
   * opened_session — losing exactly the history the gap list exists to keep.
   */
  it("update_gap amends a gap in place, keeping its id and opened_session (Loop 6, R1)", () => {
    const before = readState(root).gaps.find((g) => g.id === "G-002")!;
    const r = applyStateOps(root, { session: SESSION + 5, expected_revision: 7, ops: [
      { op: "update_gap", id: "G-002", what: "corrected text" },
    ] });
    expect(r.ok).toBe(true);
    expect(r.applied).toEqual([{ op: "update_gap", id: "G-002" }]);

    const after = readState(root).gaps.find((g) => g.id === "G-002")!;
    expect(after.what).toBe("corrected text");
    expect(after.opened_session).toBe(before.opened_session);
    expect(after.evidence).toBe(before.evidence);
    expect(after.recommended_update).toBe(before.recommended_update);
  });

  it("update_gap changes only the fields supplied, and refuses an empty amendment", () => {
    const r = applyStateOps(root, { session: SESSION, expected_revision: 7, ops: [
      { op: "update_gap", id: "G-003", evidence: "new evidence", recommended_update: "new rec" },
    ] });
    expect(r.ok).toBe(true);
    const g = readState(root).gaps.find((x) => x.id === "G-003")!;
    expect(g.evidence).toBe("new evidence");
    expect(g.recommended_update).toBe("new rec");

    expectRefused(
      applyStateOps(root, { session: SESSION, expected_revision: 8, ops: [{ op: "update_gap", id: "G-003" }] }),
      /nothing to change/,
    );
    expectRefused(
      applyStateOps(root, { session: SESSION, expected_revision: 8, ops: [{ op: "update_gap", id: "G-404", what: "x" }] }),
      /unknown gap G-404/,
    );
  });

  it("add_decision appends in order with D-NNN (V2, R2)", () => {
    const r = applyStateOps(root, { session: SESSION, expected_revision: 7, ops: [
      { op: "add_decision", title: "Older date, added later", date: "2026-01-01", note: "" },
    ] });
    expect(r.applied).toEqual([{ op: "add_decision", id: "D-007" }]);
    const d = readState(root).decisions;
    expect(d[d.length - 1]).toEqual({ id: "D-007", title: "Older date, added later", date: "2026-01-01", note: "" });
    expectRefused(applyStateOps(root, { session: SESSION, expected_revision: 8, ops: [{ op: "add_decision", title: "x", date: "01/01/2026", note: "" }] }), /^ops\[0\] invalid at date: expected YYYY-MM-DD/);
  });

  it("set_objective sets text + since_session, and null clears it (V2)", () => {
    applyStateOps(root, { session: SESSION, expected_revision: 7, ops: [{ op: "set_objective", text: "Ship Loop 3" }] });
    expect(readState(root).objective).toEqual({ text: "Ship Loop 3", since_session: SESSION });
    applyStateOps(root, { session: SESSION, expected_revision: 8, ops: [{ op: "set_objective", text: null }] });
    expect(readState(root).objective).toBeNull();
  });

  // ---- schema v3 (T-163): handoffs per SESSION, sessions[] per write ----
  // The fixture carries one legacy (v2-migrated) developer handoff at session 54
  // and one legacy session record for session 54.

  const LEGACY_HANDOFF = () => readState(root).handoffs.find((h) => h.session_uuid === null)!;

  it("set_handoff writes THIS session's entry, stamped with its uuid, checkout and first-write revision, and leaves ANOTHER seat's legacy entry alone", () => {
    const legacy = LEGACY_HANDOFF(); // the fixture's is a developer's
    const r = applyStateOps(root, { session: SESSION, expected_revision: 7, session_uuid: "u-1", checkout: "sia-qa", ops: [{ op: "set_handoff", seat: "qa", pick_up: "Here", watch_out: ["a"], open_questions: [] }] });
    expect(r.ok).toBe(true);
    expect(readState(root).handoffs).toEqual([
      legacy,
      { seat: "qa", pick_up: "Here", watch_out: ["a"], open_questions: [], session: SESSION, loop_state: null, session_uuid: "u-1", checkout: "sia-qa", first_rev: 8 },
    ]);
  });

  it("R179-3: the first keyed handoff of the legacy entry's OWN seat supersedes it, and the write reports it", () => {
    const r = applyStateOps(root, { session: SESSION, expected_revision: 7, session_uuid: "u-1", checkout: "sia-builder", ops: [{ op: "set_handoff", seat: "developer", pick_up: "Here", watch_out: [], open_questions: [] }] });
    expect(r.ok).toBe(true);
    expect(readState(root).handoffs.map((h) => h.session_uuid)).toEqual(["u-1"]);
    expect(r.superseded).toEqual(["handoff developer@54 (developer, legacy, session 54)"]);
  });

  it("the checkout defaults to the project root's basename", () => {
    applyStateOps(root, { session: SESSION, expected_revision: 7, session_uuid: "u-1", ops: [{ op: "set_handoff", seat: "developer", pick_up: "x", watch_out: [], open_questions: [] }] });
    expect(readState(root).handoffs.find((h) => h.session_uuid === "u-1")?.checkout).toBe(basename(root));
  });

  it("two SEATS in two sessions both keep their handoffs — G-046, now by construction", () => {
    applyStateOps(root, { session: SESSION, expected_revision: 7, session_uuid: "dev", ops: [{ op: "set_handoff", seat: "developer", pick_up: "dev", watch_out: [], open_questions: [] }] });
    const r = applyStateOps(root, { session: SESSION, expected_revision: 8, session_uuid: "qa", ops: [{ op: "set_handoff", seat: "qa", pick_up: "qa", watch_out: [], open_questions: [] }] });
    expect(r.ok).toBe(true);
    const hs = readState(root).handoffs;
    expect(hs.find((h) => h.session_uuid === "dev")?.pick_up).toBe("dev");
    expect(hs.find((h) => h.session_uuid === "qa")?.pick_up).toBe("qa");
  });

  it("a session holds ONE handoff: a second set_handoff in the same batch replaces its first", () => {
    const r = applyStateOps(root, {
      session: SESSION, expected_revision: 7, session_uuid: "u-1",
      ops: [
        { op: "set_handoff", seat: "developer", pick_up: "first", watch_out: [], open_questions: [] },
        { op: "set_handoff", seat: "developer", pick_up: "second", watch_out: [], open_questions: [] },
      ],
    });
    expect(r.ok).toBe(true);
    expect(readState(root).handoffs.filter((h) => h.session_uuid === "u-1").map((h) => h.pick_up)).toEqual(["second"]);
  });

  it("set_handoff REFUSES a seat outside the closed set, and a planner handoff with no loop_state", () => {
    const unknownSeat = applyStateOps(root, {
      session: SESSION,
      expected_revision: 7,
      session_uuid: "u-1",
      ops: [{ op: "set_handoff", seat: "builder", pick_up: "x", watch_out: [], open_questions: [] }],
    });
    expectRefused(unknownSeat, /ops\[0\] invalid at seat/);

    // C3: the rows may be EMPTY but not ABSENT. A planner handoff without them
    // is the remembered version of the thing that has to be run.
    const noRows = applyStateOps(root, {
      session: SESSION,
      expected_revision: 7,
      session_uuid: "u-1",
      ops: [{ op: "set_handoff", seat: "planner", pick_up: "x", watch_out: [], open_questions: [] }],
    });
    expectRefused(noRows, /must carry loop_state/);

    // ...and the EMPTY form is accepted, or the distinction would be a ban.
    const empty = applyStateOps(root, {
      session: SESSION,
      expected_revision: 7,
      session_uuid: "u-1",
      ops: [
        {
          op: "set_handoff",
          seat: "planner",
          pick_up: "x",
          watch_out: [],
          open_questions: [],
          loop_state: { open_prs: [], frozen_sha: null, questions_for_aaron: [], rulings: [] },
        },
      ],
    });
    expect(empty.ok).toBe(true);
  });

  it("every write records its session in sessions[] with the seat it handed off as and its checkout", () => {
    applyStateOps(root, { session: SESSION, expected_revision: 7, session_uuid: "u-1", checkout: "sia-builder", today: "2026-09-15", ops: [{ op: "set_handoff", seat: "developer", pick_up: "p", watch_out: [], open_questions: [] }] });
    expect(readState(root).sessions.find((s) => s.uuid === "u-1")).toEqual({ n: SESSION, date: "2026-09-15", uuid: "u-1", seat: "developer", checkout: "sia-builder", first_rev: 8 });
  });

  it("a write with no set_handoff labels its session with the caller's resolved seat, or null", () => {
    applyStateOps(root, { session: SESSION, expected_revision: 7, session_uuid: "u-1", seat: "qa", ops: [{ op: "set_objective", text: "x" }] });
    applyStateOps(root, { session: SESSION, expected_revision: 8, session_uuid: "u-2", ops: [{ op: "set_objective", text: "y" }] });
    const ss = readState(root).sessions;
    expect(ss.find((s) => s.uuid === "u-1")?.seat).toBe("qa");
    expect(ss.find((s) => s.uuid === "u-2")?.seat).toBeNull();
  });

  it("a write with NO registered session is not attributed, says so, and leaves sessions[] unchanged", () => {
    const before = readState(root).sessions;
    const r = applyStateOps(root, { session: SESSION, expected_revision: 7, ops: [{ op: "set_objective", text: "x" }] });
    expect(r.ok).toBe(true);
    expect(r.notes.join(" ")).toMatch(/no registered session: this write is not attributed/);
    expect(readState(root).sessions).toEqual(before);
  });

  it("G-047: a session writing again keeps its recorded number, stamps the WHOLE BATCH with it, and says so", () => {
    // The number counts SESSIONS, not writes. One developer seat-session once
    // took three numbers in slice two; and when only the close-out slot was
    // normalised, the record said a handoff was written in session 72 while the
    // slot said 71. A fix that leaves the record inconsistent is not a fix.
    applyStateOps(root, { session: 55, expected_revision: 7, session_uuid: "same", ops: [{ op: "set_objective", text: "x" }] });
    const second = applyStateOps(root, {
      session: 56,
      expected_revision: 8,
      session_uuid: "same",
      today: "2026-09-16",
      ops: [
        { op: "set_handoff", seat: "developer", pick_up: "second write", watch_out: [], open_questions: [] },
        { op: "open_task", title: "opened in the same batch", priority: "P2" },
      ],
    });
    expect(second.ok).toBe(true);
    const s = readState(root);
    const mine = s.sessions.filter((x) => x.uuid === "same");
    expect(mine).toHaveLength(1);
    expect(mine[0].n).toBe(55);
    expect(mine[0].date).toBe("2026-09-16");
    expect(s.handoffs.find((h) => h.session_uuid === "same")?.session).toBe(55);
    expect(s.tasks.find((t) => t.title === "opened in the same batch")?.opened_session).toBe(55);
    expect(second.notes.join(" ")).toMatch(/already recorded as session 55.*EVERY op in this batch was stamped 55/);
  });

  it("a DIFFERENT uuid takes its own entry and its own number, with no note", () => {
    applyStateOps(root, { session: 55, expected_revision: 7, session_uuid: "one", ops: [{ op: "set_objective", text: "x" }] });
    const next = applyStateOps(root, { session: 56, expected_revision: 8, session_uuid: "two", ops: [{ op: "set_objective", text: "y" }] });
    expect(next.ok).toBe(true);
    const ss = readState(root).sessions;
    expect(ss.find((x) => x.uuid === "one")?.n).toBe(55);
    expect(ss.find((x) => x.uuid === "two")?.n).toBe(56);
    expect(next.notes).toEqual([]);
  });

  it("an empty batch (re-render) records no session", () => {
    const before = readState(root).sessions;
    applyStateOps(root, { session: SESSION, expected_revision: 7, session_uuid: "u-1", ops: [], render: true });
    expect(readState(root).sessions).toEqual(before);
  });

  // ---- V3: retention ----

  it("drops done tasks once 3 DISTINCT sessions have first written after the close — whatever the numbers — and lists the ids (V3, R179-1)", () => {
    // Fixture done tasks were closed before v3 (closed_rev null), so they order
    // before every keyed session: the third keyed session to write drops them.
    const w = (n: number, uuid: string) => applyStateOps(root, { session: n, expected_revision: readState(root).revision, session_uuid: uuid, ops: [{ op: "set_objective", text: uuid }] });
    const done = readState(root).tasks.filter((t) => t.status === "done").map((t) => t.id);
    expect(done).toEqual(["T-001", "T-002", "T-003", "T-004", "T-018", "T-019", "T-020", "T-021", "T-022", "T-023", "T-026"]);
    expect(w(9999, "s-1").dropped_task_ids).toEqual([]); // a huge number ages nothing
    expect(w(1, "s-2").dropped_task_ids).toEqual([]);
    const r = w(2, "s-3");
    expect(r.dropped_task_ids).toEqual(done);
    expect(readState(root).tasks).toHaveLength(27 - 11);
    // A task closed NOW (closed_rev = this write's revision) needs three more.
    const c = applyStateOps(root, { session: 3, expected_revision: readState(root).revision, session_uuid: "s-3", ops: [{ op: "close_task", id: "T-005" }] });
    expect(readState(root).tasks.find((t) => t.id === "T-005")!.closed_rev).toBe(c.revision_after);
    expect(w(4, "s-4").dropped_task_ids).toEqual([]);
    expect(w(5, "s-5").dropped_task_ids).toEqual([]);
    expect(w(6, "s-6").dropped_task_ids).toEqual(["T-005"]);
  });

  it("T-157: retention KEEPS a done task whose id the tracked tree cites", () => {
    // Twice in two consecutive writes, retention destroyed a task other tracked
    // documents referred to by id — T-151, which G-031 exists to correct, and
    // T-153, cited by three files. Both survived only because a seat happened to
    // read one line of dry-run output and then grep the tree by hand.
    // Three keyed sessions in the record: every legacy done task is eligible.
    const aged = () => {
      const x = readState(root);
      for (let i = 0; i < 3; i++) x.sessions.push({ n: 60 + i, date: "2026-09-26", uuid: `aged-${i}`, seat: null, checkout: "c", first_rev: 8 + i });
      return x;
    };
    const s = aged();
    const before = s.tasks.filter((t) => t.status === "done").map((t) => t.id);
    expect(before).toContain("T-001");

    const uncited = applyRetention(aged(), new Map()).dropped;
    expect(uncited).toContain("T-001");

    const { dropped, kept } = applyRetention(s, new Map([["T-001", ["docs/loops/some-closeout.md"]]]));
    expect(kept).toEqual(["T-001"]);
    expect(dropped).not.toContain("T-001");
    expect(s.tasks.some((t) => t.id === "T-001")).toBe(true);
    // The others still go. The guard must protect the cited one, not disable
    // retention: a check that keeps everything cannot fail and is not a check.
    // Asserted as "one fewer than without the citation" rather than a hardcoded
    // list, so it tests the difference the citation made and nothing else.
    expect(dropped).toEqual(uncited.filter((id) => id !== "T-001"));
    expect(dropped.length).toBe(uncited.length - 1);
    expect(dropped.length).toBeGreaterThan(0);
    expect(DONE_RETENTION_SESSIONS).toBe(3);
  });

  it("retention never touches verified, gaps or decisions", () => {
    for (let i = 0; i < 3; i++) applyStateOps(root, { session: 99, expected_revision: 7 + i, session_uuid: `s-${i}`, ops: [{ op: "set_objective", text: `x${i}` }] });
    const s = readState(root);
    expect(s.verified).toHaveLength(8);
    expect(s.gaps).toHaveLength(5);
    expect(s.decisions).toHaveLength(6);
    expect(s.tasks.every((t) => t.status !== "done")).toBe(true);
  });

  // ---- P4 / P5 ----

  it("touches only state.json, the three views and SUMMARY.md — every other file is byte-identical (P4)", () => {
    // Extra prose files that must survive untouched.
    mkdirSync(join(root, ".agents", "SYSTEM"), { recursive: true });
    writeFileSync(join(root, ".agents", "SYSTEM", "PRD.md"), "# PRD\nkeep me\n");
    writeFileSync(join(root, ".agents", "SESSIONS", "Session_3.md"), "# Session 3\n");
    writeFileSync(join(root, "notes.md"), "not state\n");
    const beforeSnap = snapshot(root);

    const r = applyStateOps(root, { session: SESSION, expected_revision: 7, ops: [{ op: "close_task", id: "T-005" }] });
    expect(r.ok).toBe(true);

    const afterSnap = snapshot(root);
    const changed = [...new Set([...beforeSnap.keys(), ...afterSnap.keys()])].filter((k) => beforeSnap.get(k) !== afterSnap.get(k)).sort();
    expect(changed).toEqual([
      ".agents/SESSIONS/next-session.md",
      ".agents/SYSTEM/SUMMARY.md",
      ".agents/TASKS/INBOX.md",
      ".agents/TASKS/task.md",
      ".agents/state.json",
    ]);
    // SUMMARY: only the marked region moved; the fixture prose is still there verbatim.
    const summary = afterSnap.get(".agents/SYSTEM/SUMMARY.md")!;
    expect(summary).toContain("# Project Summary");
    expect(summary).toContain("- Knowledge recall with recency weighting");
    expect(summary).toContain("<!-- state:begin -->");
  });

  it("render: false writes state.json only", () => {
    const beforeSnap = snapshot(root);
    const r = applyStateOps(root, { session: SESSION, expected_revision: 7, render: false, ops: [{ op: "set_objective", text: "x" }] });
    expect(r.rendered).toEqual([]);
    const afterSnap = snapshot(root);
    const changed = [...afterSnap.keys()].filter((k) => beforeSnap.get(k) !== afterSnap.get(k));
    expect(changed).toEqual([".agents/state.json"]);
  });

  it("never creates state.json: absent refuses, invalid refuses, nothing appears on disk (P5)", () => {
    rmSync(join(root, STATE));
    const r = applyStateOps(root, { session: SESSION, expected_revision: 0, ops: [{ op: "set_objective", text: "x" }] });
    expectRefused(r, /state\.json is absent — this writer never creates it/);
    expect(r.revision_before).toBe(-1);
    expect(existsSync(join(root, STATE))).toBe(false);
    expect(existsSync(join(root, ".agents/TASKS/task.md"))).toBe(false);

    writeFileSync(join(root, STATE), "{ \"schema_version\": 1 }");
    const r2 = applyStateOps(root, { session: SESSION, expected_revision: 0, ops: [{ op: "set_objective", text: "x" }] });
    expectRefused(r2, /state\.json invalid at schema_version: /);
    expect(readFileSync(join(root, STATE), "utf-8")).toBe("{ \"schema_version\": 1 }");
  });

  it("nextId pads and ignores foreign ids", () => {
    expect(nextId("T", [])).toBe("T-001");
    expect(nextId("T", ["T-009", "T-010", "V-999", "T-x"])).toBe("T-011");
    expect(nextId("D", ["D-100"])).toBe("D-101");
  });
});

describe("G-006: readState — the read door", () => {
  let root: string;

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), "ob-state-read-"));
    cpSync(fixturesDir, root, { recursive: true });
  });

  afterEach(() => {
    rmSync(root, { recursive: true, force: true, maxRetries: 3, retryDelay: 50 });
  });

  it("reads and validates without writing anything", () => {
    cpSync(stateFixture, join(root, STATE));
    const before = snapshot(root);

    const r = readStateDoor(root);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.data.revision).toBe(7);
    expect(r.data.sessions.map((s) => s.n)).toEqual([54]);
    expect(r.path).toBe(join(root, STATE));

    // The whole point of a read door: nothing on disk moves.
    expect(snapshot(root)).toEqual(before);
  });

  it("refuses an absent state.json without creating it", () => {
    const r = readStateDoor(root);
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.error).toMatch(/is absent — run the migration first/);
    expect(existsSync(join(root, STATE))).toBe(false);
  });

  it("refuses an invalid state.json rather than returning a partial", () => {
    mkdirSync(join(root, ".agents"), { recursive: true });
    writeFileSync(join(root, STATE), JSON.stringify({ schema_version: 1, revision: "not a number" }));
    const r = readStateDoor(root);
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.error).toMatch(/invalid at/);
  });

  it("describes a broken file the same way the write door does", () => {
    const read = readStateDoor(root);
    const write = applyStateOps(root, { session: SESSION, expected_revision: 0, ops: [{ op: "set_objective", text: "x" }] });
    expect(read.ok).toBe(false);
    expect(write.ok).toBe(false);
    if (read.ok || write.ok) return;
    // Both name the same file and the same condition.
    expect(read.error).toContain(STATE);
    expect(write.error).toContain(STATE);
    expect(read.error).toMatch(/absent/);
    expect(write.error).toMatch(/absent/);
  });
});
