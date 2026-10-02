import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, mkdirSync, cpSync, readFileSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { applyStateOps } from "../../src/shared/state-writer.js";

/**
 * T-163 (1): a close-out can only append or update ITS OWN entry. Two developer checkouts share a
 * seat NAME, which is how v2's seat-keyed slot let one erase the other (record 118); here the
 * second writes after the first, even claiming the first's session number, and the first's
 * handoff and session uuid must survive in state.json AND in the rendered next-session.md.
 */
describe("close-outs append, they do not overwrite (T-163)", () => {
  let dir: string;
  const A = "aaaaaaaa-0000-4000-8000-00000000000a";
  const B = "bbbbbbbb-0000-4000-8000-00000000000b";
  const read = () => JSON.parse(readFileSync(join(dir, ".agents", "state.json"), "utf8"));

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "t163-append-"));
    for (const d of ["TASKS", "SESSIONS", "SYSTEM"]) mkdirSync(join(dir, ".agents", d), { recursive: true });
    writeFileSync(join(dir, ".agents", "SYSTEM", "SUMMARY.md"), "# Summary\n");
    writeFileSync(join(dir, "package.json"), '{"version":"1.0.0"}');
    cpSync(join(import.meta.dirname, "../fixtures-state/state.json"), join(dir, ".agents", "state.json"));
  });
  afterEach(() => rmSync(dir, { recursive: true, force: true, maxRetries: 3, retryDelay: 50 }));

  function closeOut(session: number, uuid: string, checkout: string, text: string): void {
    const r = applyStateOps(dir, {
      session, expected_revision: read().revision, session_uuid: uuid, checkout, render: true,
      ops: [{ op: "set_handoff", seat: "developer", pick_up: text, watch_out: [], open_questions: [] }],
    });
    if (!r.ok) throw new Error(r.error);
  }

  it("a second developer's set_handoff, even under the first's session number, leaves the first's handoff and session uuid in place", () => {
    closeOut(200, A, "sia-builder", "A's handoff text");
    closeOut(201, B, "sia-forge", "B's first handoff");
    closeOut(200, B, "sia-forge", "B's second handoff, claiming A's number");

    const s = read();
    const handoffs = s.handoffs.map((h: { session_uuid: string; pick_up: string }) => [h.session_uuid, h.pick_up]);
    expect(handoffs).toContainEqual([A, "A's handoff text"]);
    expect(handoffs).toContainEqual([B, "B's second handoff, claiming A's number"]);
    expect(handoffs).not.toContainEqual([B, "B's first handoff"]); // B updated its OWN entry
    expect(s.sessions.map((x: { uuid: string }) => x.uuid)).toEqual(expect.arrayContaining([A, B]));
    expect(s.sessions.find((x: { uuid: string }) => x.uuid === A).n).toBe(200);

    const view = readFileSync(join(dir, ".agents", "SESSIONS", "next-session.md"), "utf8");
    expect(view).toContain("A's handoff text");
    expect(view).toContain("B's second handoff");
  });
});
