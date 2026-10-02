/**
 * T-163 / T163-1: a close-out can only add its own record.
 *
 * Step 0 (record session 118) measured the failure on a scratch copy of this
 * repository at rev 131: two developer sessions ran end.md's A7b batch in
 * sequence, and the second ERASED the first's handoff (one `developer` slot) and
 * its last_session uuid — the uuid went from one tracked occurrence to zero,
 * which is the rev-61 / rev-62 signature T-163 was opened on.
 *
 * Every protection below has a row. The writing session's uuid is stamped by
 * the WRITER from `session_uuid` (the server passes its registered session);
 * it is never an op argument, so no batch can write under another session.
 */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, cpSync, rmSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { applyStateOps } from "../../src/shared/state-writer.js";

const fixturesDir = join(import.meta.dirname, "../fixtures");
const stateFixture = join(import.meta.dirname, "../fixtures-state/state.json");
const STATE = ".agents/state.json";

const A = "aaaaaaaa-1111-4111-8111-000000000055";
const B = "bbbbbbbb-2222-4222-8222-000000000056";

type Raw = {
  revision: number;
  handoffs: Array<{ seat: string; pick_up: string; session: number; session_uuid?: string | null; checkout?: string | null }>;
  sessions?: Array<{ n: number; uuid: string | null; seat: string | null; checkout?: string | null }>;
};

function raw(root: string): Raw {
  return JSON.parse(readFileSync(join(root, STATE), "utf-8")) as Raw;
}

function handoff(root: string, session: number, uuid: string | null, pickUp: string, checkout = "sia-builder", seat = "developer") {
  return applyStateOps(root, {
    session,
    expected_revision: raw(root).revision,
    session_uuid: uuid,
    checkout,
    ops: [{ op: "set_handoff", seat, pick_up: pickUp, watch_out: [`watch ${pickUp}`], open_questions: [] }],
  } as Parameters<typeof applyStateOps>[1]);
}

describe("T163-1: a close-out can only add its own record", () => {
  let root: string;

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), "ob-closeout-erasure-"));
    cpSync(fixturesDir, root, { recursive: true });
    cpSync(stateFixture, join(root, STATE));
  });

  afterEach(() => {
    rmSync(root, { recursive: true, force: true, maxRetries: 3, retryDelay: 50 });
  });

  it("two sessions of the SAME seat hand off in sequence and the first's handoff survives, word for word", () => {
    expect(handoff(root, 55, A, "from session A").ok).toBe(true);
    expect(handoff(root, 56, B, "from session B").ok).toBe(true);
    const after = raw(root);
    const a = after.handoffs.find((h) => h.pick_up === "from session A");
    const b = after.handoffs.find((h) => h.pick_up === "from session B");
    expect(a, "session A's handoff was erased by session B").toBeDefined();
    expect(b).toBeDefined();
    expect(a!.session_uuid).toBe(A);
    expect(b!.session_uuid).toBe(B);
    expect(a!.session).toBe(55);
  });

  it("both sessions' uuids are in the record afterwards — the evidence T-163 exists to protect", () => {
    handoff(root, 55, A, "from session A");
    handoff(root, 56, B, "from session B");
    const text = readFileSync(join(root, STATE), "utf-8");
    expect(text.split(A).length - 1, "session A's uuid left the record").toBeGreaterThanOrEqual(1);
    expect(text.split(B).length - 1).toBeGreaterThanOrEqual(1);
    const uuids = (raw(root).sessions ?? []).map((s) => s.uuid);
    expect(uuids).toContain(A);
    expect(uuids).toContain(B);
  });

  it("ANY state write records the writing session, not only a close-out (sessions[] no longer depends on /end)", () => {
    const r = applyStateOps(root, {
      session: 55,
      expected_revision: raw(root).revision,
      session_uuid: A,
      checkout: "sia-builder",
      ops: [{ op: "add_decision", title: "d", date: "2026-09-25", note: "n" }],
    } as Parameters<typeof applyStateOps>[1]);
    expect(r.ok).toBe(true);
    const s = (raw(root).sessions ?? []).find((x) => x.uuid === A);
    expect(s, "a write by session A left no session record").toBeDefined();
    expect(s!.n).toBe(55);
    expect(s!.checkout).toBe("sia-builder");
  });

  it("the same session writing again UPDATES its own handoff rather than adding a second", () => {
    handoff(root, 55, A, "first");
    handoff(root, 55, A, "second");
    const mine = raw(root).handoffs.filter((h) => h.session_uuid === A);
    expect(mine).toHaveLength(1);
    expect(mine[0].pick_up).toBe("second");
  });

  it("set_handoff REFUSES when no session is registered, and writes nothing", () => {
    const before = readFileSync(join(root, STATE), "utf-8");
    const r = handoff(root, 55, null, "unattributed");
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/set_handoff.*no registered session/);
    expect(readFileSync(join(root, STATE), "utf-8")).toBe(before);
  });

  it("the session uuid is NOT an op argument: a set_handoff naming one is refused", () => {
    const r = applyStateOps(root, {
      session: 56,
      expected_revision: raw(root).revision,
      session_uuid: B,
      checkout: "sia-builder",
      ops: [{ op: "set_handoff", seat: "developer", session_uuid: A, pick_up: "impersonating A", watch_out: [], open_questions: [] }],
    } as Parameters<typeof applyStateOps>[1]);
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/ops\[0\] invalid/);
  });

  it("end_session is RETIRED and refuses, naming why", () => {
    const r = applyStateOps(root, {
      session: 55,
      expected_revision: raw(root).revision,
      session_uuid: A,
      ops: [{ op: "end_session", n: 55, date: "2026-09-25", uuid: A, seat: "developer" }],
    } as Parameters<typeof applyStateOps>[1]);
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/end_session.*retired/);
  });

  // Retention counts the distinct sessions that FIRST WROTE after an entry, not
  // session numbers (R179-1 as amended): `others(k)` writes k sessions in
  // checkouts of their own, each its instance's only entry.
  const others = (k: number) => {
    for (let i = 0; i < k; i++) handoff(root, 42 + i, `cccccccc-3333-4333-8333-${String(i).padStart(12, "0")}`, `other ${i}`, `other-${i}`, "qa");
  };

  it("retention drops a superseded entry of the SAME seat and checkout once more than 10 sessions have written since", () => {
    handoff(root, 40, A, "old builder handoff", "sia-builder");
    others(10);
    handoff(root, 41, B, "new builder handoff", "sia-builder"); // the 11th session since A
    const picks = raw(root).handoffs.map((h) => h.pick_up);
    expect(picks).not.toContain("old builder handoff");
    expect(picks).toContain("new builder handoff");
  });

  it("retention NEVER drops another checkout's newest entry, however many sessions have written since — a still-open seat keeps its handoff", () => {
    handoff(root, 40, A, "grok in sia-forge", "sia-forge");
    others(12);
    handoff(root, 56, B, "forge in sia-builder", "sia-builder");
    const picks = raw(root).handoffs.map((h) => h.pick_up);
    expect(picks).toContain("grok in sia-forge");
    expect(picks).toContain("forge in sia-builder");
  });

  it("retention keeps a superseded entry when 10 or fewer sessions have written since", () => {
    handoff(root, 46, A, "recent builder handoff", "sia-builder");
    others(9);
    handoff(root, 5600, B, "newer builder handoff", "sia-builder"); // the 10th since A, numbered absurdly
    const picks = raw(root).handoffs.map((h) => h.pick_up);
    expect(picks).toContain("recent builder handoff");
  });
});
