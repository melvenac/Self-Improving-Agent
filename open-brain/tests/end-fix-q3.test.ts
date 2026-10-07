/** Q3 — new layout, commits on master, set_handoff for this uuid → closes */
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

describe("end-fix Q3", () => {
  let dir: string;
  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "endfix-q3-"));
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

  it("refuses without set_handoff, then closes after set_handoff for this session", async () => {
    const refused = await handleEnd({ project_root: dir, session_id: SESSION_UUID, dry_run: true });
    expect(refused.isError).toBe(true);
    expect(text(refused)).toMatch(/^RECORD NOT UPDATED:/);

    const rev = JSON.parse(readFileSync(join(dir, ".agents", "state.json"), "utf8")).revision as number;
    applyStateOps(dir, {
      session: 99,
      expected_revision: rev,
      session_uuid: SESSION_UUID,
      checkout: "sia-test",
      ops: [{ op: "set_handoff", seat: "developer", pick_up: "pick up", watch_out: [], open_questions: [] }],
    });

    const ok = await handleEnd({ project_root: dir, session_id: SESSION_UUID, dry_run: true, session_summary: "s" });
    expect(ok.isError).not.toBe(true);
    expect(text(ok)).toContain("Session End:");
  });
});
