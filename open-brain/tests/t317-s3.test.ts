/** T-317 S3: the writer stamps sessions[].last_work_rev, so a handoff written before later work is refused end to end. */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { handleEnd } from "../src/server.js";
import { applyStateOps } from "../src/shared/state-writer.js";
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

describe("T-317 S3: record writes stamp last_work_rev and a stale handoff is refused end to end", () => {
  let dir: string;
  const state = (): Record<string, any> => JSON.parse(readFileSync(join(dir, ".agents", "state.json"), "utf8"));
  const row = (): Record<string, unknown> => state().sessions.find((x: Record<string, unknown>) => x.uuid === SESSION_UUID);
  const write = (...ops: Record<string, unknown>[]): void => {
    const r = applyStateOps(dir, { session: 99, expected_revision: state().revision as number, session_uuid: SESSION_UUID, checkout: "sia-test", ops });
    expect(r.ok, JSON.stringify(r)).toBe(true);
  };
  const end = () => handleEnd({ project_root: dir, session_id: SESSION_UUID, dry_run: true, session_summary: "s" });
  const handoff = { op: "set_handoff", seat: "developer", pick_up: "pick up", watch_out: [], open_questions: [] };
  const decision = { op: "add_decision", title: "a decision", date: "2026-10-20", note: "n" };

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "t317-s3-"));
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

  it("R1 (guard): work, then the handoff: ob_end closes", async () => {
    write(decision);
    write(handoff);
    const r = await end();
    expect(r.isError).not.toBe(true);
    expect(text(r)).toContain("Session End:");
  });

  it("R2: the handoff, then work: ob_end refuses with HANDOFF STALE naming both revisions", async () => {
    write(handoff);
    const at = state().revision as number;
    write(decision);
    const r = await end();
    expect(r.isError).toBe(true);
    expect(text(r)).toContain(`HANDOFF STALE: written at rev ${at}; this session wrote rev ${at + 1} after it. Re-run ob_state set_handoff`);
  });

  it("R3 (guard): re-setting the handoff after that work closes the session", async () => {
    write(handoff);
    write(decision);
    write(handoff);
    const r = await end();
    expect(r.isError).not.toBe(true);
  });

  it("R4: a work write stamps its revision, and a handoff-only write keeps the stamp", () => {
    write(decision);
    const worked = state().revision as number;
    expect(row().last_work_rev).toBe(worked);
    write(handoff);
    expect(row().last_work_rev).toBe(worked);
  });

  it("R5 (guard): work and the handoff in ONE batch are not stale", async () => {
    write(decision, handoff);
    const r = await end();
    expect(r.isError).not.toBe(true);
  });
});
