/** END-FIX r2 (QA 289): M5/M6/N4 pins and E4 record-after-ob_end guard */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, readFileSync, rmSync, utimesSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { handleEnd } from "../src/server.js";
import { checkRecordUpdated } from "../src/shared/end-record-guard.js";
import { applyStateOps } from "../src/shared/state-writer.js";
import {
  AFTER_END,
  cleanupProof,
  commitAt,
  DURING,
  initNewLayoutRepo,
  initScratchDb,
  proveSessionWithTranscript,
  SESSION_UUID,
  START,
  text,
  writeTranscript,
} from "./end-fix.harness.js";

describe("end-fix r2 pins (QA 289)", () => {
  let dir: string;
  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "endfix-r2-"));
    initNewLayoutRepo(dir);
    const tr = writeTranscript(dir);
    proveSessionWithTranscript(dir, tr);
    commitAt(dir, DURING, "src/a.ts", "work");
    initScratchDb();
  });
  afterEach(() => {
    cleanupProof();
    rmSync(dir, { recursive: true, force: true });
  });

  it("M5: E4 record check uses ob_end_at, not session start (set_handoff before ob_end does not clear work-after)", () => {
    const rev = JSON.parse(readFileSync(join(dir, ".agents", "state.json"), "utf8")).revision as number;
    applyStateOps(dir, {
      session: 99,
      expected_revision: rev,
      session_uuid: SESSION_UUID,
      checkout: "sia-test",
      ops: [{ op: "set_handoff", seat: "developer", pick_up: "before end", watch_out: [], open_questions: [] }],
    });
    const statePath = join(dir, ".agents", "state.json");
    const t = Date.parse(DURING) / 1000;
    utimesSync(statePath, t, t);
    const atEnd = checkRecordUpdated(dir, START, SESSION_UUID, [], { changesAfter: AFTER_END });
    expect(atEnd.updated).toBe(false);
    const atStart = checkRecordUpdated(dir, START, SESSION_UUID, []);
    expect(atStart.updated).toBe(true);
  });

  it("M6: record_ok empty string is refused", async () => {
    const res = await handleEnd({ project_root: dir, session_id: SESSION_UUID, dry_run: true, record_ok: "" });
    expect(res.isError).toBe(true);
    expect(text(res)).toMatch(/record_ok must be a non-empty reason/);
  });

  it("B3: ob_end prints RECORD NOT CHECKED when session work scan is unknown", async () => {
    const badTr = join(dir, "no-start.jsonl");
    writeFileSync(badTr, '{"type":"bridge-session","bridgeSessionId":"cse_01MeMeMeMeMeMeMeMeMeMeMe"}\n');
    proveSessionWithTranscript(dir, badTr);
    const res = await handleEnd({ project_root: dir, session_id: SESSION_UUID, dry_run: true });
    expect(text(res)).toContain("RECORD NOT CHECKED:");
    expect(text(res)).toContain("start could not be read");
  });

  it("N4: record_ok whitespace only is refused", async () => {
    const res = await handleEnd({ project_root: dir, session_id: SESSION_UUID, dry_run: true, record_ok: "   " });
    expect(res.isError).toBe(true);
    expect(text(res)).toMatch(/whitespace only/);
  });
});
