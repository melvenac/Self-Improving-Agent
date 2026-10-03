import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, cpSync, rmSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { applyStateOps } from "../../src/shared/state-writer.js";
import { parseState, type State } from "../../src/shared/state-schema.js";
import { renderBriefing } from "../../src/pipelines/session-start/briefing.js";

/**
 * QA 267 probe, row 10 (#393, flag ON, scratch fixture). Written by QA, independent of the developer's rows.
 * Place at open-brain/tests/shared/. Reads only the repo's own test fixtures; writes only a mkdtemp copy.
 */
const fixturesDir = join(import.meta.dirname, "../fixtures");
const stateFixture = join(import.meta.dirname, "../fixtures-state/state.json");
const STATE = ".agents/state.json";
const read = (root: string): State => {
  const r = parseState(readFileSync(join(root, STATE), "utf-8"));
  if (!r.ok) throw new Error(r.error);
  return r.data;
};

describe("QA 267 row 10a: set_handoff caps, flag ON", () => {
  let root: string;
  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), "qa267-caps-"));
    cpSync(fixturesDir, root, { recursive: true });
    cpSync(stateFixture, join(root, STATE));
  });
  afterEach(() => rmSync(root, { recursive: true, force: true }));

  const write = (pick_up: string, watch_out: unknown[], caps: boolean | undefined) =>
    applyStateOps(root, {
      session: 77, expected_revision: read(root).revision, session_uuid: "qa267", checkout: "qa267",
      handoff_caps: caps,
      ops: [{ op: "set_handoff", seat: "developer", pick_up, watch_out, open_questions: [] }],
    } as Parameters<typeof applyStateOps>[1]);

  it("one write breaking all four caps is refused, names EVERY violation, and writes nothing", () => {
    const before = readFileSync(join(root, STATE), "utf-8");
    const r = write("p".repeat(401), ["a", "x".repeat(201), "two\nlines", "d"], true);
    expect(r.ok).toBe(false);
    const e = r.error ?? "";
    expect(e).toContain("pick_up is 401 chars");
    expect(e).toContain("4 watch-outs");
    expect(e).toContain("watch-out 2 is 201 chars");
    expect(e).toContain("watch-out 3 spans more than one line");
    expect(readFileSync(join(root, STATE), "utf-8")).toBe(before);
  });

  it("an object watch-out's text is capped too", () => {
    const r = write("ok", [{ text: "y".repeat(201), expires: 99 }], true);
    expect(r.ok).toBe(false);
    expect(r.error).toContain("watch-out 1 is 201 chars");
  });

  it("exactly at the caps (3 x 200 chars, 400-char pick_up) is accepted", () => {
    const r = write("p".repeat(400), ["a".repeat(200), "b".repeat(200), "c".repeat(200)], true);
    expect(r.ok, r.error).toBe(true);
  });

  it("flag absent or false: the same over-cap write is accepted", () => {
    expect(write("p".repeat(401), ["a", "x".repeat(201), "two\nlines", "d"], undefined).ok).toBe(true);
    expect(write("p".repeat(401), ["a", "x".repeat(201), "two\nlines", "d"], false).ok).toBe(true);
  });
});

describe("QA 267 row 10b: the budgeted briefing, flag ON", () => {
  const base = () => {
    const r = parseState(readFileSync(stateFixture, "utf-8"));
    if (!r.ok) throw new Error(r.error);
    return r.data;
  };
  const input = (state: State, budget = true) => ({
    state, version: "1.0.0", sessionNumber: 160, sessionNote: null, date: "2026-10-03", drift: [],
    serving: "Build x · current", usage: "Usage: GREEN", latestBrief: null, workingTree: "Working tree: clean", skills: "Skills: none",
    seat: "developer" as const, budget,
  });
  const withHandoff = (s: State, h: { watch_out?: unknown[]; open_questions?: unknown[]; pick_up?: string }): State => {
    const d = s.handoffs.find((x) => x.seat === "developer")!;
    Object.assign(d, h);
    return s;
  };

  it("expired watch-outs (session < 160, date < today) are dropped and counted; the last session and today still print", () => {
    const s = withHandoff(base(), { watch_out: [
      { text: "OLD-SESSION", expires: 159 }, { text: "OLD-DATE", expires: "2026-10-02" },
      { text: "LAST-SESSION", expires: 160 }, { text: "TODAY", expires: "2026-10-03" },
    ] });
    const out = renderBriefing(input(s)).join("\n");
    expect(out).not.toContain("OLD-SESSION");
    expect(out).not.toContain("OLD-DATE");
    expect(out).toContain("LAST-SESSION");
    expect(out).toContain("TODAY");
    expect(out).toContain("2 expired, not shown");
  });

  it("WAITING ON AARON lists only unresolved owner:aaron questions, and is absent when there are none", () => {
    const s = withHandoff(base(), { open_questions: [
      { text: "AARON-OPEN", owner: "aaron" }, { text: "AARON-DONE", owner: "aaron", resolved_by: "D-1" },
      { text: "RELAY-OWNED", owner: "relay" }, "PLAIN-Q",
    ] });
    const out = renderBriefing(input(s)).join("\n");
    const waiting = out.slice(out.indexOf("WAITING ON AARON:"));
    expect(out).toContain("WAITING ON AARON:");
    expect(waiting.split("\n").slice(0, 3).join("\n")).toContain("AARON-OPEN");
    expect(out).not.toContain("AARON-DONE");
    expect(waiting.split("\n")[1]).not.toContain("RELAY-OWNED");
    const none = withHandoff(base(), { open_questions: ["PLAIN-Q", { text: "RELAY-OWNED", owner: "relay" }] });
    expect(renderBriefing(input(none)).join("\n")).not.toContain("WAITING ON AARON");
  });

  it("NEXT only when the objective names task ids, then exactly those", () => {
    const s = base();
    expect(renderBriefing(input(s)).join("\n")).not.toMatch(/^NEXT$/m);
    s.objective = { text: "Do T-002 and then T-999.", since_session: 160 };
    const out = renderBriefing(input(s));
    const at = out.indexOf("NEXT");
    expect(at).toBeGreaterThan(-1);
    expect(out[at + 1]).toContain("T-002");
    expect(out[at + 2]).toBe("- T-999 (not in the record)");
    expect(out[at + 3]).toBe("PICK UP HERE");
  });

  it("worst case fits 30 lines and 4,096 chars, and every cut section says +N more: <pointer>", () => {
    const s = base();
    const long = (tag: string, i: number) => `${tag}-${i} ${"z".repeat(600)}\nsecond line`;
    s.objective = { text: `${"o".repeat(900)} T-001 T-002 T-003 T-004 T-005 T-006`, since_session: 1 };
    withHandoff(s, {
      pick_up: "p".repeat(3000),
      watch_out: Array.from({ length: 17 }, (_, i) => long("W", i)),
      open_questions: [
        ...Array.from({ length: 9 }, (_, i) => ({ text: long("A", i), owner: "aaron" })),
        ...Array.from({ length: 9 }, (_, i) => long("Q", i)),
      ],
    });
    for (const t of s.tasks.slice(0, 12)) { t.status = "blocked"; t.priority = "P0"; }
    const text = renderBriefing(input(s)).join("\n");
    const lines = text.split("\n");
    expect(lines.length).toBeLessThanOrEqual(30);
    expect(text.length).toBeLessThanOrEqual(4096);
    expect(text).toMatch(/^\+4 more: state\.json tasks\[\]$/m);
    expect(text).toMatch(/^\+14 more: state\.json handoffs\[\]\.watch_out$/m);
    expect(text).toMatch(/^\+7 more: state\.json handoffs\[\]\.open_questions$/m);
    // The fixture already holds blocked tasks: 14 P0/P1 blocked in all, 3 named.
    expect(text).toContain("blocked: T-001, T-002, T-003, +11 more: state.json tasks[]");
    console.log(`QA267 worst case: ${lines.length} lines, ${text.length} chars`);
  });

  it("flag off: the same state renders the original layout (no budgeted section names)", () => {
    const s = withHandoff(base(), { open_questions: [{ text: "AARON-OPEN", owner: "aaron" }] });
    expect(renderBriefing(input(s, false)).join("\n")).not.toContain("WAITING ON AARON");
  });
});
