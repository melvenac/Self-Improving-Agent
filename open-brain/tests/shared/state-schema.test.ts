import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { parseState, serializeState, lastSession, newestHandoffPerInstance, newestHandoffForSeat, schemaVersionAdvice, type State } from "../../src/shared/state-schema.js";

const fixturePath = join(import.meta.dirname, "../fixtures-state/state.json");
const fixtureText = readFileSync(fixturePath, "utf-8");

function valid(): State {
  const r = parseState(fixtureText);
  if (!r.ok) throw new Error(r.error);
  return r.data;
}

/** Same data as the fixture, top-level and nested keys in a different order. */
function reorderKeys(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(reorderKeys);
  if (value === null || typeof value !== "object") return value;
  const obj = value as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  for (const k of Object.keys(obj).sort().reverse()) out[k] = reorderKeys(obj[k]);
  return out;
}

describe("state-schema (Loop 2, read side)", () => {
  it("parses the realistic fixture", () => {
    const data = valid();
    expect(data.schema_version).toBe(3);
    expect(data.revision).toBe(7);
    expect(data.tasks.length).toBeGreaterThanOrEqual(25);
    expect(data.tasks.filter((t) => t.status === "done").length).toBeGreaterThanOrEqual(10);
    expect(data.verified).toHaveLength(8);
    expect(data.verified.every((v) => v.evidence.length >= 1)).toBe(true);
    expect(data.gaps).toHaveLength(5);
    expect(data.decisions).toHaveLength(6);
    expect(data.handoffs).toHaveLength(1);
    expect(data.handoffs[0].seat).toBe("developer");
    expect(data.handoffs[0].pick_up.length).toBeGreaterThan(0);
  });

  it("rejects text that is not JSON, naming the root", () => {
    const r = parseState("{ not json");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/^\$: not valid JSON/);
  });

  it("names the path of a missing required field", () => {
    const data = valid() as unknown as Record<string, unknown>;
    delete data.handoffs;
    const r = parseState(JSON.stringify(data));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/^handoffs: /);
  });

  /** Loop 4 R2: closed_session is non-null exactly when status is done — both directions refuse. */
  it("refuses a done task with closed_session null, and an open task with closed_session set (R2)", () => {
    const doneNoClose = valid();
    const done = doneNoClose.tasks.find((t) => t.status === "done")!;
    done.closed_session = null;
    const r1 = parseState(JSON.stringify(doneNoClose));
    expect(r1.ok).toBe(false);
    if (!r1.ok) expect(r1.error).toBe(`tasks.${doneNoClose.tasks.indexOf(done)}.closed_session: closed_session must be set when status is "done" and null otherwise`);

    const openWithClose = valid();
    const open = openWithClose.tasks.find((t) => t.status !== "done")!;
    open.closed_session = 54;
    const r2 = parseState(JSON.stringify(openWithClose));
    expect(r2.ok).toBe(false);
    if (!r2.ok) expect(r2.error).toMatch(/^tasks\.\d+\.closed_session: /);

    // The committed fixture satisfies the rule in every row.
    for (const t of valid().tasks) expect(t.status === "done").toBe(t.closed_session !== null);
  });

  it("names the path of a bad enum inside a task", () => {
    const data = valid();
    (data.tasks[3] as unknown as { status: string }).status = "finished";
    const r = parseState(JSON.stringify(data));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/^tasks\.3\.status: /);
  });

  it("rejects an unknown key at the top level (strict)", () => {
    const data = valid() as unknown as Record<string, unknown>;
    data.notes = "typo'd field";
    const r = parseState(JSON.stringify(data));
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.error).toContain("$:");
      expect(r.error).toContain("notes");
    }
  });

  it("rejects an unknown key inside a task (strict at every level)", () => {
    const data = valid();
    (data.tasks[0] as unknown as Record<string, unknown>).owner = "someone";
    const r = parseState(JSON.stringify(data));
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.error).toContain("tasks.0");
      expect(r.error).toContain("owner");
    }
  });

  it("rejects a wrong schema_version and a malformed date", () => {
    const v = valid() as unknown as Record<string, unknown>;
    // 2, not 3: v3 is now the accepted version (T-163), so the previous value is
    // what must be refused. An older record failing to parse is the whole reason
    // the literal is a literal — every copy moves or a missed one is loud.
    v.schema_version = 2;
    const r1 = parseState(JSON.stringify(v));
    expect(r1.ok).toBe(false);
    if (!r1.ok) expect(r1.error).toMatch(/^schema_version: /);

    const d = valid();
    d.decisions[0].date = "14/09/2026";
    const r2 = parseState(JSON.stringify(d));
    expect(r2.ok).toBe(false);
    if (!r2.ok) expect(r2.error).toBe("decisions.0.date: expected YYYY-MM-DD");
  });

  it("serializeState is idempotent and canonical across key orders", () => {
    const once = serializeState(valid());
    const again = serializeState(parseState(once).data!);
    expect(again).toBe(once);

    const reordered = JSON.stringify(reorderKeys(JSON.parse(fixtureText)));
    const r = parseState(reordered);
    expect(r.ok).toBe(true);
    if (r.ok) expect(serializeState(r.data)).toBe(once);

    expect(once.endsWith("\n")).toBe(true);
    expect(once.startsWith('{\n  "schema_version": 3,\n  "revision": 7,\n  "project": {')).toBe(true);
  });

  it("the committed fixture is already in canonical form", () => {
    expect(serializeState(valid())).toBe(fixtureText.replace(/\r\n/g, "\n"));
  });

  // ---- schema v3 (T-163): per-session handoffs and sessions[] ----

  const h = (over: Record<string, unknown>) => ({ seat: "developer", pick_up: "p", watch_out: [], open_questions: [], session: 60, loop_state: null, session_uuid: "u-1", checkout: "sia-builder", first_rev: 10, ...over });

  it("refuses two handoffs from the same session_uuid", () => {
    const d = valid() as unknown as Record<string, unknown>;
    d.handoffs = [h({}), h({ pick_up: "q" })];
    const r = parseState(JSON.stringify(d));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toBe("handoffs: handoffs must hold at most one entry per session_uuid");
  });

  it("accepts two handoffs of one seat from DIFFERENT sessions — the v2 rule that made them collide is gone", () => {
    const d = valid() as unknown as Record<string, unknown>;
    d.handoffs = [h({}), h({ session_uuid: "u-2", session: 61, first_rev: 11 })];
    expect(parseState(JSON.stringify(d)).ok).toBe(true);
  });

  it("refuses two LEGACY (null session_uuid) handoffs for one seat, and accepts one per seat", () => {
    const d = valid() as unknown as Record<string, unknown>;
    d.handoffs = [h({ session_uuid: null, checkout: null, first_rev: null }), h({ session_uuid: null, checkout: null, first_rev: null, session: 61 })];
    const r = parseState(JSON.stringify(d));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/at most one legacy/);
    d.handoffs = [h({ session_uuid: null, checkout: null, first_rev: null }), h({ seat: "qa", session_uuid: null, checkout: null, first_rev: null })];
    expect(parseState(JSON.stringify(d)).ok).toBe(true);
  });

  it("refuses two sessions[] entries with one uuid, and refuses a record still carrying last_session", () => {
    const d = valid() as unknown as Record<string, unknown>;
    const s = { n: 60, date: "2026-09-25", uuid: "u-1", seat: "developer", checkout: "sia-builder", first_rev: 10 };
    d.sessions = [s, { ...s, n: 61 }];
    const r = parseState(JSON.stringify(d));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toBe("sessions: sessions must hold at most one entry per uuid");
    const legacy = valid() as unknown as Record<string, unknown>;
    legacy.last_session = { n: 1, date: "2026-09-25", uuid: null, seat: null };
    expect(parseState(JSON.stringify(legacy)).ok).toBe(false);
  });

  it("schemaVersionAdvice names the remedy for the DIRECTION of the mismatch, and nothing otherwise", () => {
    expect(schemaVersionAdvice(JSON.stringify({ schema_version: 2 }))).toMatch(/OLDER than this build's v3: migrate it with `node open-brain\/build\/cli\.js state migrate --dry-run \.agents\/state\.json`/);
    expect(schemaVersionAdvice(JSON.stringify({ schema_version: 4 }))).toMatch(/NEWER than this build's v3: rebuild/);
    expect(schemaVersionAdvice(JSON.stringify({ schema_version: 3 }))).toBeNull();
    expect(schemaVersionAdvice("{ not json")).toBeNull();
    expect(schemaVersionAdvice(JSON.stringify({}))).toBeNull();
  });

  it("lastSession is DERIVED by WRITE ORDER (first_rev), never by n: the later entry on a tie, legacy (null) before every keyed one, null when none", () => {
    const s = (n: number, uuid: string, first_rev: number | null) => ({ n, date: "2026-09-25", uuid, seat: null, checkout: null, first_rev });
    expect(lastSession({ sessions: [] })).toBeNull();
    // The numbers contradict the order on purpose: 1124 first wrote BEFORE 9.
    expect(lastSession({ sessions: [s(5, "a", 3), s(1124, "b", 4), s(9, "c", 5)] })!.uuid).toBe("c");
    expect(lastSession({ sessions: [s(9, "a", 4), s(9, "b", 4)] })!.uuid).toBe("b");
    expect(lastSession({ sessions: [s(500, "legacy", null), s(1, "keyed", 1)] })!.uuid).toBe("keyed");
  });

  it("newestHandoffPerInstance keeps one per (seat, checkout) by first_rev, never by session number; legacy null checkout is its own instance", () => {
    const all = [
      h({ session_uuid: "a", session: 1124, first_rev: 20 }),
      h({ session_uuid: "b", session: 6, first_rev: 25 }),
      h({ session_uuid: "c", session: 40, checkout: "sia-forge", first_rev: 5 }),
      h({ session_uuid: null, checkout: null, session: 900, first_rev: null }),
      h({ session_uuid: "d", session: 57, seat: "qa", first_rev: 22 }),
    ] as unknown as Parameters<typeof newestHandoffPerInstance>[0];
    expect(newestHandoffPerInstance(all).map((x) => x.session_uuid)).toEqual(["b", "c", null, "d"]);
    expect(newestHandoffForSeat(all, "developer")!.session_uuid).toBe("b");
    expect(newestHandoffForSeat(all, "planner")).toBeNull();
  });

  it("a task carries closed_rev only when done (R179-1 extended to done tasks)", () => {
    const d = valid() as unknown as { tasks: Array<Record<string, unknown>> };
    const open = d.tasks.find((t) => t.status !== "done")!;
    open.closed_rev = 12;
    const r = parseState(JSON.stringify(d));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/closed_rev must be null unless status is "done"/);
  });

  it("T-171: note_by is [] exactly when the note is empty — text with no authors, or no text with authors, is refused", () => {
    for (const [note, note_by] of [["words", []], ["", null]] as const) {
      const d = valid() as unknown as { tasks: Array<Record<string, unknown>> };
      Object.assign(d.tasks[0], { note, note_by });
      const r = parseState(JSON.stringify(d));
      expect([note, r.ok]).toEqual([note, false]);
      if (!r.ok) expect(r.error).toMatch(/note_by must be \[\] exactly when note is empty/);
    }
    for (const [note, note_by] of [["words", null], ["words", ["u"]], ["", []]] as const) {
      const d = valid() as unknown as { tasks: Array<Record<string, unknown>> };
      Object.assign(d.tasks[0], { note, note_by });
      expect([note, note_by, parseState(JSON.stringify(d)).ok]).toEqual([note, note_by, true]);
    }
  });
});
