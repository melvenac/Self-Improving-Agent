/** T-317 S1: on the new layout, ob_end's record gate needs this session's set_handoff; another record write is not enough. */
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

describe("T-317 S1: a record write without set_handoff does not pass the /end gate", () => {
  let dir: string;
  const rev = (): number => JSON.parse(readFileSync(join(dir, ".agents", "state.json"), "utf8")).revision as number;
  const write = (op: Record<string, unknown>): void => {
    const r = applyStateOps(dir, { session: 99, expected_revision: rev(), session_uuid: SESSION_UUID, checkout: "sia-test", ops: [op] });
    expect(r.ok, JSON.stringify(r)).toBe(true);
  };

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "t317-s1-"));
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

  it("R1: a session whose only record write is add_decision is refused, and told set_handoff is what counts", async () => {
    write({ op: "add_decision", title: "a decision", date: "2026-10-20", note: "n" });
    const r = await handleEnd({ project_root: dir, session_id: SESSION_UUID, dry_run: true });
    expect(r.isError).toBe(true);
    expect(text(r)).toMatch(/^RECORD NOT UPDATED:/);
    expect(text(r)).toContain("other record writes by this session do not count: run ob_state set_handoff");
  });

  it("R2 (guard): the same session closes once it sets its handoff", async () => {
    write({ op: "add_decision", title: "a decision", date: "2026-10-20", note: "n" });
    write({ op: "set_handoff", seat: "developer", pick_up: "pick up", watch_out: [], open_questions: [] });
    const r = await handleEnd({ project_root: dir, session_id: SESSION_UUID, dry_run: true, session_summary: "s" });
    expect(r.isError).not.toBe(true);
    expect(text(r)).toContain("Session End:");
  });
});
