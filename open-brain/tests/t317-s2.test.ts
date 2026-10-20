/** T-317 S2: a handoff written before this session's later work is stale; the /end gate refuses it (readers only). */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { handleEnd } from "../src/server.js";
import { applyStateOps, readState } from "../src/shared/state-writer.js";
import { checkRecordUpdated } from "../src/shared/end-record-guard.js";
import {
  cleanupProof,
  commitAt,
  DURING,
  initNewLayoutRepo,
  initScratchDb,
  proveSessionWithTranscript,
  SESSION_UUID,
  text,
  writeTranscript,
} from "./end-fix.harness.js";

describe("T-317 S2: the /end gate refuses a handoff older than this session's last work", () => {
  let dir: string;
  const statePath = (): string => join(dir, ".agents", "state.json");
  const state = (): Record<string, any> => JSON.parse(readFileSync(statePath(), "utf8"));
  const write = (op: Record<string, unknown>): void => {
    const r = applyStateOps(dir, { session: 99, expected_revision: state().revision as number, session_uuid: SESSION_UUID, checkout: "sia-test", ops: [op] });
    expect(r.ok, JSON.stringify(r)).toBe(true);
  };
  /** S3 is not shipped, so nothing stamps last_work_rev: set it on this session's row by hand, after the key it follows. */
  const stampLastWork = (rev: number): void => {
    const s = state();
    s.sessions = s.sessions.map((row: Record<string, unknown>) => (row.uuid === SESSION_UUID ? { ...row, last_work_rev: rev } : row));
    writeFileSync(statePath(), JSON.stringify(s, null, 2) + "\n");
  };
  const handoffRev = (): number => state().handoffs.find((h: Record<string, unknown>) => h.session_uuid === SESSION_UUID).written_rev as number;
  const handoff = { op: "set_handoff", seat: "developer", pick_up: "pick up", watch_out: [], open_questions: [] };

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "t317-s2-"));
    initNewLayoutRepo(dir);
    const tr = writeTranscript(dir);
    proveSessionWithTranscript(dir, tr);
    commitAt(dir, DURING, "src/a.ts", "on master");
    initScratchDb();
  });
  afterEach(() => {
    cleanupProof();
    rmSync(dir, { recursive: true, force: true });
  });

  it("R1: work stamped after the handoff makes ob_end refuse with HANDOFF STALE", async () => {
    write(handoff);
    stampLastWork(handoffRev() + 1);
    const r = await handleEnd({ project_root: dir, session_id: SESSION_UUID, dry_run: true, session_summary: "s" });
    expect(r.isError).toBe(true);
    expect(text(r)).toMatch(/^RECORD NOT UPDATED:/);
    expect(text(r)).toContain(`HANDOFF STALE: written at rev ${handoffRev()}; this session wrote rev ${handoffRev() + 1} after it. Re-run ob_state set_handoff`);
  });

  it("R2 (guard): work stamped AT the handoff's revision is not stale", async () => {
    write(handoff);
    stampLastWork(handoffRev());
    const r = await handleEnd({ project_root: dir, session_id: SESSION_UUID, dry_run: true, session_summary: "s" });
    expect(r.isError).not.toBe(true);
    expect(text(r)).toContain("Session End:");
  });

  it("R3 (guard): with no last_work_rev stamped, S1's rule stands and the handoff passes", async () => {
    write({ op: "add_decision", title: "a decision", date: "2026-10-20", note: "n" });
    write(handoff);
    // T-317 S3: the writer now stamps last_work_rev, so remove it by hand: a record a pre-S3 build wrote carries none.
    const s = state();
    for (const r of s.sessions) delete r.last_work_rev;
    writeFileSync(statePath(), JSON.stringify(s, null, 2) + "\n");
    const r = await handleEnd({ project_root: dir, session_id: SESSION_UUID, dry_run: true, session_summary: "s" });
    expect(r.isError).not.toBe(true);
  });

  it("R4: a state.json carrying last_work_rev reads, and a later write keeps the field", () => {
    write(handoff);
    stampLastWork(7);
    expect(readState(dir).ok).toBe(true);
    // T-317 S3: a handoff-only write keeps the stamp; a work write now restamps it (t317-s3 R4).
    write(handoff);
    expect(state().sessions.find((x: Record<string, unknown>) => x.uuid === SESSION_UUID).last_work_rev).toBe(7);
  });

  it("R5: the shared check the SessionEnd hook uses reports the same stale handoff", () => {
    write(handoff);
    stampLastWork(handoffRev() + 2);
    const c = checkRecordUpdated(dir, null, SESSION_UUID, [SESSION_UUID]);
    expect(c.updated).toBe(false);
    expect(c.detail).toContain("HANDOFF STALE");
  });
});
