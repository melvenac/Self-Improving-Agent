/**
 * T-179 merge round: the importer and T-163's schema v3 meet here. `state import
 * --commit` creates the record, so it must create one `ob_state` accepts and the
 * migration leaves alone — v3 in, v3 out.
 *
 * The importer's stamping rule: everything it writes came from prose an EARLIER
 * session wrote, so nothing is stamped with the importing run's session. The
 * imported handoff is a legacy entry (session_uuid and checkout null) exactly as
 * a v2 entry is after migration; sessions[0] is the prose log's last session
 * with its own uuid (null when the log named none), seat and checkout null. The
 * first ob_state write by a real session then adds that session's own entries
 * beside them.
 *
 * Written before any fix and run red against origin/master's importer (which
 * wrote schema v2); see docs/loops/t179-merge-developer-handoff.md.
 */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, cpSync, rmSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { runDraft, runCommit, STATE_REL } from "../../src/pipelines/state-import/index.js";
import { StateSchema } from "../../src/shared/state-schema.js";
import { applyStateOps } from "../../src/shared/state-writer.js";
import { migrateStateText, migrateStateFile } from "../../src/pipelines/state-migrate/index.js";

const fixture = join(import.meta.dirname, "../fixtures-import");
const TODAY = "2026-09-14";
const WRITER = "11111111-2222-4333-8444-555555555555";

describe("T-179 merge: an import writes a schema v3 record that ob_state accepts (v3 in, v3 out)", () => {
  let root: string;
  beforeEach(() => { root = mkdtempSync(join(tmpdir(), "ob-import-v3-")); cpSync(fixture, root, { recursive: true }); });
  afterEach(() => { rmSync(root, { recursive: true, force: true, maxRetries: 3, retryDelay: 50 }); });

  function importAndRead(): string {
    runDraft(root, TODAY);
    runCommit(root, TODAY, { version: "0.30.0" });
    return readFileSync(join(root, STATE_REL), "utf-8");
  }

  it("the committed record is schema v3 with sessions[] and no last_session, and parses against the current schema", () => {
    const text = importAndRead();
    const raw = JSON.parse(text) as Record<string, unknown>;
    expect(raw.schema_version).toBe(3);
    expect(Object.keys(raw)).not.toContain("last_session");
    expect(Object.keys(raw)).toContain("sessions");
    const parsed = StateSchema.safeParse(raw);
    expect(parsed.success ? "ok" : JSON.stringify(parsed.error.issues)).toBe("ok");
  });

  it("the stamping rule: the imported handoff is legacy (no session_uuid, no checkout) and sessions[0] is the prose log's session", () => {
    const s = StateSchema.parse(JSON.parse(importAndRead()));
    expect(s.handoffs).toHaveLength(1);
    expect(s.handoffs[0]).toMatchObject({ seat: "developer", session: 54, session_uuid: null, checkout: null });
    expect(s.sessions).toEqual([{ n: 54, date: TODAY, uuid: "00000000-0000-4000-8000-000000000054", seat: null, checkout: null }]);
    // T-175 still holds on the v3 record.
    expect(s.verified).toEqual([]);
    expect(s.gaps).toEqual([]);
  });

  it("ob_state's writer accepts it: a registered session's set_handoff lands beside the legacy entry, which survives", () => {
    importAndRead();
    const w = applyStateOps(root, {
      session: 55,
      expected_revision: 0,
      session_uuid: WRITER,
      checkout: "sia-builder",
      today: TODAY,
      ops: [
        { op: "open_task", title: "first task after import", priority: "P2" },
        { op: "set_handoff", seat: "developer", pick_up: "after import", watch_out: [], open_questions: [] },
      ],
    });
    expect(w.error ?? "ok").toBe("ok");
    expect(w.ok).toBe(true);
    expect(w.revision_after).toBe(1);
    const s = StateSchema.parse(JSON.parse(readFileSync(join(root, STATE_REL), "utf-8")));
    expect(s.handoffs.map((h) => h.session_uuid)).toEqual([null, WRITER]);
    expect(s.handoffs.find((h) => h.session_uuid === WRITER)).toMatchObject({ seat: "developer", checkout: "sia-builder", session: 55 });
    expect(s.sessions.map((x) => x.uuid)).toEqual(["00000000-0000-4000-8000-000000000054", WRITER]);
  });

  it("the migration leaves the imported record unchanged: nothing to write, same revision, same bytes on disk", () => {
    const before = importAndRead();
    const pure = migrateStateText(before, {});
    expect(pure.ok).toBe(true);
    expect(pure.output).toBeNull();
    expect(pure).toMatchObject({ from: 3, to: 3, revisionBefore: 0, revisionAfter: 0 });
    const onDisk = migrateStateFile(join(root, STATE_REL), {});
    expect(onDisk.ok).toBe(true);
    expect(readFileSync(join(root, STATE_REL), "utf-8")).toBe(before);
  });
});
