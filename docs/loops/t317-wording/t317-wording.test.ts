/**
 * T-317 wording follow-up: since T-317 S1 a sessions[] row no longer satisfies the /end record gate on the new layout;
 * only this session's set_handoff does. The RECORD NOT UPDATED advice still offered "ob_state ops that write sessions[]".
 */
import { describe, it, expect } from "vitest";
import { describeRecordNotUpdated, type SessionWorkScan } from "../../src/shared/end-record-guard.js";

const work: SessionWorkScan = { status: "ok", since: "abc1234", branches: ["fix/x"], commits: 2, commitShas: ["a", "b"], tags: [], versionBump: false, unattributed: 0 };

describe("T-317 wording: the RECORD NOT UPDATED advice", () => {
  it("W1: names this session's set_handoff and no longer offers a sessions[] write", () => {
    const text = describeRecordNotUpdated(work, { updated: false, layout: "new", detail: "no set_handoff for session u-1" }, "abc1234");
    expect(text).toContain("RECORD NOT UPDATED: 2 commit(s) since abc1234 (no set_handoff for session u-1)");
    expect(text).toContain("Update the record (ob_state set_handoff for this session, or next-session.md on the old layout)");
    expect(text).not.toContain("sessions[]");
    expect(text.endsWith("or pass record_ok with a reason to close anyway.")).toBe(true);
  });
});
