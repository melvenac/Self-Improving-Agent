/**
 * R179-1 (as amended) and R179-3: retention, "newest" and "last" are decided by
 * WRITE ORDER, never by the session number.
 *
 * QA 125's D1: for a session the record had not seen, the number was the
 * caller's, unchecked, and retention compared it. One write numbered 1124 for
 * 124 dropped two OTHER sessions' handoffs and session records (A6), the wrong
 * number could never be corrected (A6b, G-047), and a session passing its local
 * greeting number (T-164: Forge 124 greeted as 6) superseded its OWN new
 * handoff in the write that made it (A6c). QA's rows are reproduced here with
 * QA's numbers and uuids (docs/loops/qa-scripts-t179/c1-attack.mjs); each must
 * show NO erasure at all.
 *
 * Every assertion reads state.json back from disk after the write.
 */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, cpSync, rmSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { applyStateOps } from "../../src/shared/state-writer.js";
import { lastSession, newestHandoffPerInstance, parseState } from "../../src/shared/state-schema.js";

const fixturesDir = join(import.meta.dirname, "../fixtures");
const stateFixture = join(import.meta.dirname, "../fixtures-state/state.json");
const STATE = ".agents/state.json";

type H = { seat: string; pick_up: string; session: number; session_uuid: string | null; checkout: string | null };
type S = { n: number; uuid: string | null; seat: string | null; checkout: string | null };
type Raw = { revision: number; handoffs: H[]; sessions: S[] };

/** QA 125's uuid shape: U(124) = 00000124-0000-4000-8000-000000000124. */
const U = (n: number) => `${String(n).padStart(8, "0")}-0000-4000-8000-${String(n).padStart(12, "0")}`;

describe("R179-1: a session number orders nothing", () => {
  let root: string;
  const raw = (): Raw => JSON.parse(readFileSync(join(root, STATE), "utf-8")) as Raw;
  const hand = (session: number, uuid: string, pickUp: string, checkout: string, seat = "developer") => {
    const r = applyStateOps(root, {
      session,
      expected_revision: raw().revision,
      session_uuid: uuid,
      checkout,
      ops: [{ op: "set_handoff", seat, pick_up: pickUp, watch_out: [], open_questions: [] }],
    } as Parameters<typeof applyStateOps>[1]);
    expect(r.ok, r.error).toBe(true);
    return r;
  };
  const handoffUuids = () => raw().handoffs.map((h) => h.session_uuid);
  const sessionUuids = () => raw().sessions.map((s) => s.uuid);

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), "ob-session-order-"));
    cpSync(fixturesDir, root, { recursive: true });
    cpSync(stateFixture, join(root, STATE));
  });
  afterEach(() => rmSync(root, { recursive: true, force: true, maxRetries: 3, retryDelay: 50 }));

  it("A6: a mistyped number (1124 for 124) removes NO other session's handoff or session record", () => {
    hand(118, U(118), "Forge 118 handoff", "sia-builder");
    hand(120, U(120), "QA 120 handoff", "sia-qa", "qa");
    hand(121, U(121), "QA 121 handoff", "sia-qa", "qa");
    const r = hand(1124, U(124), "Forge 124, typo 1124", "sia-builder");
    expect(r.superseded).toEqual([]);
    for (const u of [U(118), U(120), U(121), U(124)]) {
      expect(handoffUuids(), `handoff ${u.slice(0, 8)} was removed`).toContain(u);
      expect(sessionUuids(), `session ${u.slice(0, 8)} was removed`).toContain(u);
    }
  });

  it("A6b: the wrong number stays a LABEL — the session's next write erases nothing, and 'last session' is by write order", () => {
    hand(118, U(118), "Forge 118 handoff", "sia-builder");
    hand(120, U(120), "QA 120 handoff", "sia-qa", "qa");
    hand(1124, U(124), "Forge 124, typo 1124", "sia-builder");
    hand(125, U(125), "QA 125 handoff", "sia-qa", "qa");
    const fix = hand(124, U(124), "Forge 124 corrected", "sia-builder");
    // G-047 still holds: a recorded session keeps its number. It orders nothing.
    expect(raw().sessions.find((s) => s.uuid === U(124))?.n).toBe(1124);
    expect(fix.superseded).toEqual([]);
    expect(handoffUuids()).toEqual(expect.arrayContaining([U(118), U(120), U(124), U(125)]));
    // 125 first wrote AFTER 124, so it is the last session despite 1124 > 125.
    const parsed = parseState(readFileSync(join(root, STATE), "utf-8"));
    if (!parsed.ok) throw new Error(parsed.error);
    expect(lastSession(parsed.data)?.uuid).toBe(U(125));
  });

  it("A6c: a session passing its LOCAL greeting number (6) keeps its own new handoff, and the reader is shown it", () => {
    hand(118, U(118), "Forge 118 handoff", "sia-builder");
    hand(124, U(124), "infra 124", "sia-infra");
    const r = hand(6, U(6), "Forge, local number 6", "sia-builder");
    expect(r.superseded).toEqual([]);
    expect(handoffUuids()).toEqual(expect.arrayContaining([U(6), U(118), U(124)]));
    const parsed = parseState(readFileSync(join(root, STATE), "utf-8"));
    if (!parsed.ok) throw new Error(parsed.error);
    const shown = newestHandoffPerInstance(parsed.data.handoffs).filter((h) => h.checkout === "sia-builder");
    expect(shown.map((h) => h.session_uuid)).toEqual([U(6)]);
  });

  it("A2 as QA wrote it: two sessions of one seat and checkout numbered 11 apart, nothing between — the first is KEPT (a number does not age anything)", () => {
    hand(200, U(200), "first dev session", "sia-builder");
    hand(211, U(201), "second dev session", "sia-builder");
    expect(handoffUuids()).toEqual(expect.arrayContaining([U(200), U(201)]));
  });

  it("A5 as QA wrote it: a jump to 500 drops nothing — the newest per (seat, checkout) and builder@111 all stay", () => {
    hand(110, U(110), "infra dev, old, only one", "sia-infra");
    hand(111, U(111), "builder dev old", "sia-builder");
    hand(115, U(115), "builder dev newer", "sia-builder");
    const r = hand(500, U(500), "far future qa", "sia-qa", "qa");
    expect(r.superseded).toEqual([]);
    expect(handoffUuids()).toEqual(expect.arrayContaining([U(110), U(111), U(115), U(500)]));
  });

  it("retention counts SESSIONS WRITTEN SINCE: the older of one (seat, checkout) leaves once more than 10 distinct sessions have first written after it, and not at 10", () => {
    hand(1, U(1), "old builder", "sia-builder");
    // Nine other sessions, then the builder's successor: 10 sessions after U(1).
    for (let i = 2; i <= 10; i++) hand(1, U(i), `other ${i}`, `other-${i}`, "qa");
    hand(1, U(11), "new builder", "sia-builder");
    expect(handoffUuids(), "dropped at exactly 10 sessions since").toContain(U(1));
    // The 11th session since.
    const r = hand(1, U(12), "one more", "other-12", "qa");
    expect(handoffUuids(), "kept at 11 sessions since").not.toContain(U(1));
    expect(sessionUuids()).not.toContain(U(1));
    expect(r.superseded.join(" ")).toContain(U(1));
    // Its successor, and every other checkout's only entry, stay.
    expect(handoffUuids()).toEqual(expect.arrayContaining([U(11), U(2), U(12)]));
  });
});

describe("R179-1 extended to done tasks: a done task ages by sessions written since its close, never by number", () => {
  let root: string;
  type T = { id: string; status: string };
  const raw = (): { revision: number; tasks: T[] } => JSON.parse(readFileSync(join(root, STATE), "utf-8"));
  const write = (session: number, uuid: string, ops: unknown[]) => {
    const r = applyStateOps(root, { session, expected_revision: raw().revision, session_uuid: uuid, checkout: "sia-builder", ops } as Parameters<typeof applyStateOps>[1]);
    expect(r.ok, r.error).toBe(true);
    return r;
  };
  const doneIds = () => raw().tasks.filter((t) => t.status === "done").map((t) => t.id).sort();

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), "ob-done-order-"));
    cpSync(fixturesDir, root, { recursive: true });
    cpSync(stateFixture, join(root, STATE));
  });
  afterEach(() => rmSync(root, { recursive: true, force: true, maxRetries: 3, retryDelay: 50 }));

  it("one write numbered 1124 drops NO done task — neither one just closed nor the record's older ones", () => {
    write(118, U(118), [{ op: "open_task", id: "T-900", title: "closed by 118", priority: "P2" }, { op: "close_task", id: "T-900" }]);
    const before = doneIds();
    expect(before).toContain("T-900");
    const r = write(1124, U(124), [{ op: "add_decision", title: "typo", date: "2026-09-26", note: "numbered 1124" }]);
    expect(r.dropped_task_ids).toEqual([]);
    expect(doneIds()).toEqual(before);
  });

  it("a done task leaves once 3 DISTINCT sessions have first written after its closing write, and not at 2; the same session writing again does not age it", () => {
    write(118, U(118), [{ op: "open_task", id: "T-900", title: "closed by 118", priority: "P2" }, { op: "close_task", id: "T-900" }]);
    write(119, U(119), [{ op: "add_decision", title: "a", date: "2026-09-26", note: "n" }]);
    write(119, U(119), [{ op: "add_decision", title: "a again", date: "2026-09-26", note: "n" }]);
    write(120, U(120), [{ op: "add_decision", title: "b", date: "2026-09-26", note: "n" }]);
    expect(doneIds(), "dropped after only 2 sessions").toContain("T-900");
    const r = write(121, U(121), [{ op: "add_decision", title: "c", date: "2026-09-26", note: "n" }]);
    expect(doneIds()).not.toContain("T-900");
    expect(r.dropped_task_ids).toContain("T-900");
  });
});

describe("R179-3: a legacy handoff is superseded by its seat's first keyed handoff", () => {
  let root: string;
  const raw = (): Raw => JSON.parse(readFileSync(join(root, STATE), "utf-8")) as Raw;
  const write = (uuid: string, seat: string) =>
    applyStateOps(root, {
      session: 60,
      expected_revision: raw().revision,
      session_uuid: uuid,
      checkout: "sia-builder",
      ops: [{ op: "set_handoff", seat, pick_up: `${seat} keyed`, watch_out: [], open_questions: [], ...(seat === "planner" ? { loop_state: { open_prs: [], frozen_sha: null, questions_for_aaron: [], rulings: [] } } : {}) }],
    } as Parameters<typeof applyStateOps>[1]);

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), "ob-legacy-yield-"));
    cpSync(fixturesDir, root, { recursive: true });
    cpSync(stateFixture, join(root, STATE));
  });
  afterEach(() => rmSync(root, { recursive: true, force: true, maxRetries: 3, retryDelay: 50 }));

  it("the fixture's legacy developer@54 survives ANOTHER seat's keyed handoff, and leaves at the first keyed DEVELOPER handoff, reported", () => {
    const legacy = () => raw().handoffs.filter((h) => h.session_uuid === null && h.seat === "developer");
    expect(legacy()).toHaveLength(1);
    const q = write(U(60), "qa");
    expect(q.ok, q.error).toBe(true);
    expect(legacy(), "a qa handoff superseded the developer's legacy entry").toHaveLength(1);
    const d = write(U(61), "developer");
    expect(d.ok, d.error).toBe(true);
    expect(legacy()).toHaveLength(0);
    expect(d.superseded.join(" ")).toMatch(/handoff developer@54 \(developer, legacy, session 54\)/);
  });

  it("the legacy SESSION record is never superseded — it carries the uuid the migration kept", () => {
    const legacyUuid = raw().sessions[0].uuid;
    expect(legacyUuid).not.toBeNull();
    for (let i = 0; i < 13; i++) expect(write(U(100 + i), "developer").ok).toBe(true);
    expect(raw().sessions.map((s) => s.uuid)).toContain(legacyUuid);
  });
});
