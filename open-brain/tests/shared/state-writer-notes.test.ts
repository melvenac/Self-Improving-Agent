/**
 * T-171 (widened by QA 125's D4): a note is never replaced silently.
 *
 * `update_task` and `close_task` used to take `note` and REPLACE the task's note
 * with it, and neither the dry run nor the write said so. Found in session 78: a
 * one-sentence correction written as an addition would have erased T-169's
 * 1,869-character note, and the dry run printed only "Applied (1): update_task
 * T-169". The first two rows are that shape, and they fail on the old writer by
 * LOSING THE TEXT, which is the failure this file exists for.
 */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, cpSync, rmSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { applyStateOps, type WriteResult } from "../../src/shared/state-writer.js";

const fixturesDir = join(import.meta.dirname, "../fixtures");
const stateFixture = join(import.meta.dirname, "../fixtures-state/state.json");
const STATE = ".agents/state.json";
const SESSION = 55;
const ME = "writer-uuid-a";
const OTHER = "other-uuid-b";

/** 1,869 characters, first line distinct, as T-169's note was when the defect was found. */
const FIRST_LINE = "T-169 ORIGINAL: at Loop 15 close, rewrite PRD.md and README.md against what ships.";
const LONG = (FIRST_LINE + "\n" + "x".repeat(2000)).slice(0, 1869);
const ADDITION = "Correction: README.md is rewritten too, not only PRD.md.";

type RawTask = { id: string; note: string; note_by?: string[] | null };

function raw(root: string): { revision: number; tasks: RawTask[] } {
  return JSON.parse(readFileSync(join(root, STATE), "utf-8"));
}
function note(root: string, id: string): string {
  return raw(root).tasks.find((t) => t.id === id)!.note;
}
function noteBy(root: string, id: string): string[] | null | undefined {
  return raw(root).tasks.find((t) => t.id === id)!.note_by;
}
/**
 * Seed a note straight into the scratch record. Sets `note_by` only where the
 * schema carries it, so the same seed runs against the writer before and after
 * T-171 — the red run is the old writer on THESE rows.
 */
function seed(root: string, id: string, text: string, by: string[] | null): void {
  const s = JSON.parse(readFileSync(join(root, STATE), "utf-8"));
  const t = s.tasks.find((x: RawTask) => x.id === id);
  t.note = text;
  if ("note_by" in t) t.note_by = by;
  writeFileSync(join(root, STATE), JSON.stringify(s, null, 2) + "\n");
}
function write(root: string, ops: unknown[], extra: { dry_run?: boolean; session_uuid?: string | null } = {}): WriteResult {
  return applyStateOps(root, {
    session: SESSION,
    expected_revision: raw(root).revision,
    ops,
    session_uuid: "session_uuid" in extra ? extra.session_uuid : ME,
    dry_run: extra.dry_run,
  });
}
const changes = (r: WriteResult): string[] => (r as WriteResult & { note_changes?: string[] }).note_changes ?? [];

describe("T-171: a note is never replaced silently", () => {
  let root: string;

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), "ob-t171-"));
    cpSync(fixturesDir, root, { recursive: true });
    cpSync(stateFixture, join(root, STATE));
  });
  afterEach(() => {
    rmSync(root, { recursive: true, force: true, maxRetries: 3, retryDelay: 50 });
  });

  // ---- the T-169 shape: red on the old writer by losing text ----

  it("the T-169 shape: a bare `note` on update_task, meant as an addition, does not erase a 1,869-character note", () => {
    seed(root, "T-009", LONG, [ME]);
    const r = write(root, [{ op: "update_task", id: "T-009", note: ADDITION }]);
    expect(note(root, "T-009")).toBe(LONG);
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/`note` is retired on update_task \(T-171\).*append_note.*replace_note/);
  });

  it("D4: a bare `note` on close_task does not erase the note either", () => {
    seed(root, "T-005", LONG, [ME]);
    const r = write(root, [{ op: "close_task", id: "T-005", note: ADDITION }]);
    expect(note(root, "T-005")).toBe(LONG);
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/`note` is retired on close_task \(T-171\).*append_note.*replace_note/);
  });

  // ---- adding and replacing are different, named, and both reported ----

  it("append_note adds to the note, and the dry run and the write both report it with sizes", () => {
    seed(root, "T-009", LONG, [ME]);
    const bytes = readFileSync(join(root, STATE), "utf-8");
    const added = ` — ${ADDITION}`.length;
    const expected = `T-009 note APPENDED: +${added} chars (1869 -> ${1869 + added})`;

    const dry = write(root, [{ op: "update_task", id: "T-009", append_note: ADDITION }], { dry_run: true });
    expect(dry.ok).toBe(true);
    expect(changes(dry)).toEqual([expected]);
    expect(readFileSync(join(root, STATE), "utf-8")).toBe(bytes);

    const r = write(root, [{ op: "update_task", id: "T-009", append_note: ADDITION }]);
    expect(changes(r)).toEqual([expected]);
    expect(note(root, "T-009")).toBe(`${LONG} — ${ADDITION}`);
  });

  it("replace_note on the writer's own note is reported with both sizes and the removed text's first line, in the dry run and the write", () => {
    seed(root, "T-009", LONG, [ME]);
    const expected = `T-009 note REPLACED: 1869 chars -> ${ADDITION.length} chars; removed text begins: "${FIRST_LINE}"`;
    const dry = write(root, [{ op: "update_task", id: "T-009", replace_note: ADDITION }], { dry_run: true });
    expect(changes(dry)).toEqual([expected]);
    expect(note(root, "T-009")).toBe(LONG);
    const r = write(root, [{ op: "update_task", id: "T-009", replace_note: ADDITION }]);
    expect(r.ok).toBe(true);
    expect(changes(r)).toEqual([expected]);
    expect(note(root, "T-009")).toBe(ADDITION);
    expect(noteBy(root, "T-009")).toEqual([ME]);
  });

  it("a replace that keeps every character of the old note says nothing was removed", () => {
    seed(root, "T-009", "short", [ME]);
    const r = write(root, [{ op: "update_task", id: "T-009", replace_note: "short, and longer" }]);
    expect(changes(r)).toEqual(["T-009 note REPLACED: 5 chars -> 17 chars; no text removed"]);
  });

  it("append_note and replace_note together are refused", () => {
    seed(root, "T-009", LONG, [ME]);
    const r = write(root, [{ op: "update_task", id: "T-009", append_note: "a", replace_note: "b" }]);
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/append_note or replace_note, not both/);
    expect(note(root, "T-009")).toBe(LONG);
  });

  // ---- another session's note ----

  it("replace_note on a note another session wrote is refused, naming that session, and nothing is written", () => {
    seed(root, "T-009", LONG, [OTHER]);
    const r = write(root, [{ op: "update_task", id: "T-009", replace_note: ADDITION }]);
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/T-009's note holds text written by session other-uuid-b/);
    expect(r.error).toMatch(/replace_other_sessions: true/);
    expect(note(root, "T-009")).toBe(LONG);
  });

  it("with replace_other_sessions: true it replaces, the report names the session whose text went, and the note becomes the writer's", () => {
    seed(root, "T-009", LONG, [OTHER, ME]);
    const r = write(root, [{ op: "update_task", id: "T-009", replace_note: ADDITION, replace_other_sessions: true }]);
    expect(r.ok).toBe(true);
    expect(changes(r)).toEqual([
      `T-009 note REPLACED: 1869 chars -> ${ADDITION.length} chars; removed text begins: "${FIRST_LINE}"; text by other session(s) removed: other-uuid-b`,
    ]);
    expect(noteBy(root, "T-009")).toEqual([ME]);
    // Now it is the writer's own: a second replace needs no flag.
    expect(write(root, [{ op: "update_task", id: "T-009", replace_note: "again" }]).ok).toBe(true);
  });

  it("a note with no recorded author (written before per-note keys) counts as another session's", () => {
    // T-010's fixture note predates the key.
    const before = note(root, "T-010");
    const r = write(root, [{ op: "update_task", id: "T-010", replace_note: ADDITION }]);
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/T-010's note holds text written by an unrecorded session/);
    expect(note(root, "T-010")).toBe(before);
    // Appending to it is allowed, and the note stays unattributed: the old text is still in it.
    const a = write(root, [{ op: "update_task", id: "T-010", append_note: ADDITION }]);
    expect(a.ok).toBe(true);
    expect(noteBy(root, "T-010")).toBeNull();
  });

  it("an unregistered writer cannot prove any note is its own, so its replace is refused", () => {
    seed(root, "T-009", LONG, [ME]);
    const r = write(root, [{ op: "update_task", id: "T-009", replace_note: ADDITION }], { session_uuid: null });
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/this write has no registered session/);
    expect(note(root, "T-009")).toBe(LONG);
  });

  it("replacing an EMPTY note needs no flag and removes nothing", () => {
    // T-008's fixture note is empty.
    const r = write(root, [{ op: "update_task", id: "T-008", replace_note: "first words" }], { session_uuid: null });
    expect(r.ok).toBe(true);
    expect(changes(r)).toEqual(["T-008 note REPLACED: 0 chars -> 11 chars; no text removed"]);
  });

  // ---- close_task (D4), open_task, reopen_task ----

  it("close_task follows the same rules: append reported, a foreign replace refused", () => {
    seed(root, "T-005", LONG, [OTHER]);
    const refused = write(root, [{ op: "close_task", id: "T-005", replace_note: "done" }]);
    expect(refused.ok).toBe(false);
    expect(refused.error).toMatch(/^ops\[0\] \(close_task\): T-005's note holds text written by session other-uuid-b/);
    expect(raw(root).tasks.find((t) => t.id === "T-005")).toMatchObject({ note: LONG });

    const r = write(root, [{ op: "close_task", id: "T-005", append_note: "shipped" }]);
    expect(r.ok).toBe(true);
    expect(changes(r)).toEqual([`T-005 note APPENDED: +${" — shipped".length} chars (1869 -> ${1869 + " — shipped".length})`]);
    expect(note(root, "T-005")).toBe(`${LONG} — shipped`);
    expect(noteBy(root, "T-005")).toEqual([OTHER, ME]);
  });

  it("open_task reports the note it sets and keys it to the writer; reopen_task reports its append", () => {
    const r = write(root, [{ op: "open_task", title: "New", priority: "P2", note: "why" }]);
    expect(changes(r)).toEqual(["T-028 note SET: 0 -> 3 chars"]);
    expect(noteBy(root, "T-028")).toEqual([ME]);

    const re = write(root, [{ op: "reopen_task", id: "T-001", note: "regressed" }]);
    const before = "Loop 1, v0.28.0".length;
    const added = " — regressed".length;
    expect(changes(re)).toEqual([`T-001 note APPENDED: +${added} chars (${before} -> ${before + added})`]);
  });

  it("an op that does not touch the note reports no note change", () => {
    const r = write(root, [{ op: "update_task", id: "T-009", status: "in_progress" }]);
    expect(r.ok).toBe(true);
    expect(changes(r)).toEqual([]);
  });
});
