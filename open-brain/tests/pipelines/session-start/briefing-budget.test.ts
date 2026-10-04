import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { parseState, type State } from "../../../src/shared/state-schema.js";
import { BRIEFING_BUDGET, BRIEFING_END, BRIEFING_START, renderBriefing, type BriefingInput } from "../../../src/pipelines/session-start/briefing.js";
import { HANDOFF_CAPS } from "../../../src/shared/handoff-caps.js";

/**
 * T-236 slice 2 (a) expiry, (d) NEXT, (e) WAITING ON AARON, (f) the budget. Everything here runs the budgeted layout (`budget: true`)
 * unless a row says OFF. The OFF rows, and A2A's real record, are pinned byte for byte in a2a-byte-identical.test.ts.
 */
const FIXTURES = join(import.meta.dirname, "../../fixtures-state");
const SIA = JSON.parse(readFileSync(join(FIXTURES, "state.json"), "utf8"));
const A2A = readFileSync(join(FIXTURES, "a2a-state-1c200b41.json"), "utf8");

type RawHandoff = Record<string, unknown>;
function stateWith(handoffs: RawHandoff[], extra: Record<string, unknown> = {}): State {
  const raw = structuredClone(SIA);
  raw.handoffs = handoffs.map((h, n) => ({ ...raw.handoffs[0], seat: "developer", session_uuid: `u-${n}`, checkout: "sia-forge", first_rev: 100 + n, ...h }));
  Object.assign(raw, extra);
  const parsed = parseState(JSON.stringify(raw));
  if (!parsed.ok) throw new Error(`fixture invalid: ${parsed.error}`);
  return parsed.data;
}

const input = (state: State, over: Partial<BriefingInput> = {}): BriefingInput => ({
  state,
  version: "9.9.9",
  seat: "developer",
  sessionNumber: 160,
  sessionNote: null,
  date: "2026-10-03",
  drift: [],
  serving: "Build abc1234 · current",
  usage: "Usage: GREEN → dispatches open",
  latestBrief: "Latest brief: docs/loops/t236-brief.md (2026-10-03)",
  workingTree: "Working tree: clean",
  skills: "Skills: self-improving-agent-gotchas, self-improving-agent-guide",
  budget: true,
  ...over,
});

const render = (state: State, over: Partial<BriefingInput> = {}): string[] => renderBriefing(input(state, over));
const section = (lines: string[], header: string): string[] => {
  const at = lines.indexOf(header);
  if (at < 0) return [];
  const heads = new Set(["OBJECTIVE", "NEXT", "PICK UP HERE", "WATCH OUT", "WAITING ON AARON:", "OPEN QUESTIONS"]);
  let end = at + 1;
  while (end < lines.length && !heads.has(lines[end]!) && !/^(Gaps: |Working tree|Latest brief|Skills: |## End)/.test(lines[end]!)) end++;
  return lines.slice(at + 1, end);
};
const long = (tag: string, n: number): string => `${tag} ${"x".repeat(n)}`;

describe("(a) expiry: a watch-out that carries `expires` is dropped after it, counted, never silently", () => {
  const withWatch = (watch_out: unknown[]) => stateWith([{ watch_out }]);

  it("a session expiry is the LAST session the item prints in: printed at 162, dropped at 163", () => {
    const state = withWatch(["keep", { text: "until 162", expires: 162 }]);
    expect(section(render(state, { sessionNumber: 162 }), "WATCH OUT")).toEqual(["- keep", "- until 162"]);
    expect(section(render(state, { sessionNumber: 163 }), "WATCH OUT")).toEqual(["- keep", "1 expired, not shown"]);
  });

  it("an ISO-date expiry is the last DAY it prints: printed on the date, dropped the day after", () => {
    const state = withWatch([{ text: "until the 3rd", expires: "2026-10-03" }]);
    expect(section(render(state, { date: "2026-10-03" }), "WATCH OUT")).toEqual(["- until the 3rd"]);
    expect(section(render(state, { date: "2026-10-04" }), "WATCH OUT")).toEqual(["1 expired, not shown"]);
  });

  it("a session expiry with NO session number is kept: fail toward showing, never toward dropping", () => {
    const state = withWatch([{ text: "kept", expires: 3 }]);
    expect(section(render(state, { sessionNumber: null, sessionNote: "no log created" }), "WATCH OUT")).toEqual(["- kept"]);
  });

  it("an item with no `expires` never expires, and a string is exactly a string", () => {
    const state = withWatch(["a string", { text: "an object, no expiry" }]);
    expect(section(render(state, { sessionNumber: 99999, date: "2099-01-01" }), "WATCH OUT")).toEqual(["- a string", "- an object, no expiry"]);
  });

  it("when EVERY watch-out has expired the section still says so, rather than vanishing", () => {
    const state = withWatch([{ text: "old", expires: 1 }, { text: "older", expires: 2 }]);
    expect(section(render(state), "WATCH OUT")).toEqual(["2 expired, not shown"]);
  });

  it("OFF: expiry is not applied, and an object prints its text (the field is stored, not enforced, where a repo did not opt in)", () => {
    const state = withWatch(["plain", { text: "expired long ago", expires: 1 }]);
    const lines = render(state, { budget: false });
    expect(lines).toContain("- plain");
    expect(lines).toContain("- expired long ago");
    expect(lines.join("\n")).not.toContain("expired, not shown");
  });
});

describe("(a) the watch-out cap on what an older, uncapped handoff prints", () => {
  it("seventeen long watch-outs print three, each cut with its length named, and the rest are pointed at", () => {
    const many = Array.from({ length: 17 }, (_, i) => long(`item ${i}:`, 600));
    const sec = section(render(stateWith([{ watch_out: many }])), "WATCH OUT");
    expect(sec).toHaveLength(HANDOFF_CAPS.watchOuts + 1);
    for (const line of sec.slice(0, 3)) {
      expect(line.startsWith("- item ")).toBe(true);
      expect(line).toMatch(/… \(\d+ chars\)$/);
      expect(line.length).toBeLessThanOrEqual(2 + HANDOFF_CAPS.watchOutChars + 20);
    }
    expect(sec[3]).toBe("+14 more: state.json handoffs[].watch_out");
  });

  it("cut and expired share one note line", () => {
    const watch_out = [...Array.from({ length: 5 }, (_, i) => `live ${i}`), { text: "gone", expires: 1 }];
    expect(section(render(stateWith([{ watch_out }])), "WATCH OUT").at(-1)).toBe("+2 more: state.json handoffs[].watch_out · 1 expired, not shown");
  });

  it("a short string watch-out renders as `- text`, the same line the default layout prints (the union changed nothing for it)", () => {
    const state = stateWith([{ watch_out: ["w1"] }]);
    expect(render(state, { budget: false })).toContain("- w1");
    expect(section(render(state), "WATCH OUT")).toEqual(["- w1"]);
  });
});

describe("(e) WAITING ON AARON, from open questions that carry owner aaron", () => {
  const q = (text: string, extra: Record<string, unknown> = {}) => ({ text, ...extra });

  it("lists unresolved questions owned by aaron, across seats, labelled with the seat that holds them", () => {
    const state = stateWith([
      { seat: "developer", checkout: "sia-forge", open_questions: [q("dev asks aaron", { owner: "aaron" }), q("dev's own", { owner: "atlas" }), "plain"] },
      { seat: "qa", checkout: "sia-qa", session_uuid: "u-qa", open_questions: [q("qa asks aaron", { owner: "Aaron" })] },
    ]);
    expect(section(render(state), "WAITING ON AARON:")).toEqual(["- dev asks aaron (developer)", "- qa asks aaron (qa)"]);
  });

  it("omits the section when nothing is waiting, a resolved question is not waiting, and an ownerless question never is", () => {
    const state = stateWith([{ open_questions: [q("answered", { owner: "aaron", resolved_by: "D-9" }), q("no owner"), "plain"] }]);
    expect(render(state)).not.toContain("WAITING ON AARON:");
  });

  it("reads each seat's CURRENT handoff only: a superseded one's question is not waiting", () => {
    const state = stateWith([
      { first_rev: 10, session_uuid: "old", open_questions: [q("stale", { owner: "aaron" })] },
      { first_rev: 20, session_uuid: "new", open_questions: [] },
    ]);
    expect(render(state)).not.toContain("WAITING ON AARON:");
  });

  it("an aaron-owned question is shown once: under WAITING, not again under OPEN QUESTIONS", () => {
    const state = stateWith([{ open_questions: [q("for aaron", { owner: "aaron" }), "for anyone"] }]);
    const lines = render(state);
    expect(section(lines, "WAITING ON AARON:")).toEqual(["- for aaron (developer)"]);
    expect(section(lines, "OPEN QUESTIONS")).toEqual(["- for anyone"]);
  });

  it("past two, the rest are pointed at, never dropped silently", () => {
    const state = stateWith([{ open_questions: ["a", "b", "c", "d"].map((t) => q(t, { owner: "aaron" })) }]);
    expect(section(render(state), "WAITING ON AARON:")).toEqual(["- a (developer)", "- b (developer)", "+2 more: state.json handoffs[].open_questions"]);
  });

  it("OFF: the owner is stored, not rendered: no WAITING section in the default layout", () => {
    const state = stateWith([{ open_questions: [q("for aaron", { owner: "aaron" })] }]);
    const lines = render(state, { budget: false });
    expect(lines).not.toContain("WAITING ON AARON:");
    expect(lines).toContain("- for aaron");
  });
});

describe("(d) NEXT only when the objective names task ids, and then exactly those", () => {
  const objective = (text: string) => ({ objective: { text, since_session: 5 } });
  const ids = (n: number) => (SIA.tasks as Array<{ id: string; status: string }>).filter((t) => t.status !== "done").slice(0, n).map((t) => t.id);

  it("an objective with no id gets NO NEXT section at all, and none of the backlog's order is printed", () => {
    const lines = render(stateWith([{}], objective("Ship the thing, no ids here.")));
    expect(lines).not.toContain("NEXT");
    expect(lines.join("\n")).not.toMatch(/\[P0\]/);
  });

  it("an objective that names ids lists exactly those, in the order named and once each", () => {
    const [a, b] = ids(2);
    const lines = render(stateWith([{}], objective(`Do ${b} then ${a}, and ${b} again.`)));
    const tasks = SIA.tasks as Array<{ id: string; title: string; priority: string }>;
    const [ta, tb] = [tasks.find((t) => t.id === a)!, tasks.find((t) => t.id === b)!];
    expect(section(lines, "NEXT")).toEqual([`- [${tb.priority}] ${b} ${tb.title}`, `- [${ta.priority}] ${a} ${ta.title}`].map((l) => (l.length > 400 ? l : l)));
  });

  it("an id that is not in the record is named as such, never skipped or invented", () => {
    expect(section(render(stateWith([{}], objective("Do T-99999 now."))), "NEXT")).toEqual(["- T-99999 (not in the record)"]);
  });

  it("a done task is marked done, not dressed as work to start", () => {
    const done = (SIA.tasks as Array<{ id: string; status: string }>).find((t) => t.status === "done");
    expect(done, "fixture has a done task").toBeTruthy();
    expect(section(render(stateWith([{}], objective(`Verify ${done!.id}.`))), "NEXT")[0]).toMatch(new RegExp(`^- \\[done\\] ${done!.id} `));
  });

  it("past two ids the rest are pointed at", () => {
    const three = ids(3);
    const sec = section(render(stateWith([{}], objective(`Do ${three.join(", ")}.`))), "NEXT");
    expect(sec).toHaveLength(3);
    expect(sec[2]).toBe("+1 more: state.json tasks[]");
  });

  it("OFF: the default layout still prints the backlog's top and its disclaimer", () => {
    const lines = render(stateWith([{}], objective("No ids.")), { budget: false });
    expect(lines).toContain("NEXT");
    expect(lines.join("\n")).toContain("Backlog order, not a decision");
  });
});

describe("(f) the budget: ~4 KB and ~30 lines, with per-section caps and a pointer on every cut", () => {
  const size = (lines: string[]): { lines: number; chars: number } => ({ lines: lines.length, chars: lines.join("\n").length });

  /** Every section at or past its cap, with long text everywhere a writer can put some. */
  const worst = (): State => {
    const raw = structuredClone(SIA);
    raw.objective = { text: `${"Objective ".repeat(200)} T-1 T-2 T-3 T-4 T-5 T-6 T-7 T-8`, since_session: 5 };
    let seen = 0;
    raw.tasks = raw.tasks.map((t: { status: string }) => (t.status !== "done" && seen++ < 6 ? { ...t, status: "blocked", priority: seen <= 4 ? "P0" : "P2" } : t));
    raw.handoffs = [
      {
        ...raw.handoffs[0], seat: "developer", checkout: "sia-forge", session_uuid: "dev", first_rev: 50,
        pick_up: "Pick up ".repeat(300),
        watch_out: Array.from({ length: 17 }, (_, i) => long(`watch ${i}:`, 700)).concat([{ text: "x", expires: 1 } as unknown as string]),
        open_questions: [...Array.from({ length: 8 }, (_, i) => ({ text: long(`wait ${i}`, 500), owner: "aaron" })), ...Array.from({ length: 8 }, (_, i) => long(`open ${i}`, 500)), { text: "r", resolved_by: "D-1" }],
      },
    ];
    const parsed = parseState(JSON.stringify(raw));
    if (!parsed.ok) throw new Error(parsed.error);
    return parsed.data;
  };
  const drift = Array.from({ length: 6 }, (_, i) => ({ field: `field${i}`, expected: "e".repeat(80), actual: "a".repeat(80), fixed: false })) as BriefingInput["drift"];

  it("the budget constants are the brief's: ~4 KB and ~30 lines", () => {
    expect(BRIEFING_BUDGET).toEqual({ lines: 30, chars: 4096 });
  });

  it("WORST CASE: every section past its cap, long everything, drift, a stale serving line and a long usage line, still fits", () => {
    const lines = render(worst(), {
      drift,
      serving: "Build abc1234 · STALE: 123 code commits behind, ahead by 45 → ask Aaron to update",
      usage: "Usage: STOP (weekly 98%) · park, push WIP · 5h 14%",
      workingTree: `Working tree: 9 uncommitted: ${"a/b/c.ts, ".repeat(8)}+1 more`,
    });
    const { lines: n, chars } = size(lines);
    expect(n, `${n} lines`).toBeLessThanOrEqual(BRIEFING_BUDGET.lines);
    expect(chars, `${chars} chars`).toBeLessThanOrEqual(BRIEFING_BUDGET.chars);
    expect(lines[0]).toBe(BRIEFING_START);
    expect(lines.at(-1)).toBe(BRIEFING_END);
  });

  it("WORST CASE with the T-199 missing-handoff notice ON: still 30 lines and 4096 chars (the notice rides the pick-up line, so it costs no line)", () => {
    const notice = `Handoff MISSING: last builder session #1234 (00000000-0000-4000-8000-000000000000, rev 123456) wrote the record, left no handoff; fix: ob_state set_handoff`;
    const lines = render(worst(), {
      drift,
      serving: "Build abc1234 · STALE: 123 code commits behind, ahead by 45 → ask Aaron to update",
      usage: "Usage: STOP (weekly 98%) · park, push WIP · 5h 14%",
      workingTree: `Working tree: 9 uncommitted: ${"a/b/c.ts, ".repeat(8)}+1 more`,
      missingHandoff: notice,
    });
    const { lines: n, chars } = size(lines);
    expect(lines.join("\n")).toContain(notice);
    expect(n, `${n} lines`).toBeLessThanOrEqual(BRIEFING_BUDGET.lines);
    expect(chars, `${chars} chars`).toBeLessThanOrEqual(BRIEFING_BUDGET.chars);
  });

  it("WORST CASE keeps the facts that decide a session: every section header is present, each cut ends with its pointer", () => {
    const lines = render(worst(), { drift });
    for (const h of ["OBJECTIVE", "NEXT", "PICK UP HERE", "WATCH OUT", "WAITING ON AARON:", "OPEN QUESTIONS"]) expect(lines, h).toContain(h);
    const text = lines.join("\n");
    expect(text).toContain("+14 more: state.json handoffs[].watch_out");
    expect(text).toContain("+6 more: state.json handoffs[].open_questions");
    expect(text).toContain("+6 more: state.json tasks[]");
    expect(text).toMatch(/Gaps: \d+ open/);
    expect(text).toMatch(/blocked: .*\+\d+ more: state\.json tasks\[\]/);
    expect(text).toContain("1 expired, not shown");
    expect(text).toContain("(1 resolved, not shown)");
  });

  it("an SIA-shaped record (twelve long watch-outs, as measured on 2026-10-03) renders far inside the budget", () => {
    const state = stateWith([{ pick_up: "p".repeat(1000), watch_out: Array.from({ length: 12 }, (_, i) => long(`rule ${i}:`, 550)), open_questions: ["q1", "q2"] }]);
    const { lines, chars } = size(render(state));
    expect(lines).toBeLessThanOrEqual(BRIEFING_BUDGET.lines);
    expect(chars).toBeLessThanOrEqual(BRIEFING_BUDGET.chars);
    expect(chars, "the default layout on the same record is several times larger").toBeLessThan(size(render(state, { budget: false })).chars);
  });

  it.each(["planner", "developer", "qa", null] as const)("A2A's REAL record (rev 179, seventeen long watch-outs) fits the budget when a repo opts in, for seat %s", (seat) => {
    const parsed = parseState(A2A);
    if (!parsed.ok) throw new Error(parsed.error);
    const { lines, chars } = size(render(parsed.data, { seat, serving: "Build abc1234 · current" }));
    expect(lines).toBeLessThanOrEqual(BRIEFING_BUDGET.lines);
    expect(chars).toBeLessThanOrEqual(BRIEFING_BUDGET.chars);
  });

  it("a cut line says how long the text was; short text is untouched and carries no marker", () => {
    const sec = section(render(stateWith([{ watch_out: [long("w", 300), "short"] }])), "WATCH OUT");
    expect(sec[0]).toMatch(/^- w x+… \(302 chars\)$/);
    expect(sec[1]).toBe("- short");
  });

  it("OFF is the original layout: same lines with budget false and with the key absent, and longer than the budgeted one", () => {
    const state = worst();
    const base = input(state);
    const absent = { ...base } as Partial<BriefingInput>;
    delete absent.budget;
    expect(renderBriefing({ ...base, budget: false })).toEqual(renderBriefing(absent as BriefingInput));
    expect(renderBriefing({ ...base, budget: false }).join("\n").length).toBeGreaterThan(BRIEFING_BUDGET.chars);
  });
});
