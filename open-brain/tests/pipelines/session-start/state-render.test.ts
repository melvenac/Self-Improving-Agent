import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { renderState, newestGapFirst, VERIFIED_FULL_TEXT, GAP_CLIP } from "../../../src/pipelines/session-start/state-render.js";
import { newestHandoffPerInstance, newestHandoffForSeat } from "../../../src/shared/state-schema.js";
import type { State } from "../../../src/shared/state-schema.js";
import { readRepoRecord } from "../../helpers/repo-record.js";

/**
 * `renderState` composes what `ob_start` returns whenever `state.json` is valid —
 * which is to say, what every session start actually reads. It had no test file
 * at all until this one: the change that removed task notes from it passed 579
 * tests without a single assertion noticing, while the equivalent change to the
 * INBOX view was caught immediately by a test that pinned the old format.
 *
 * The renderer with no coverage was the one that mattered.
 */

const state: State = {
  schema_version: 2,
  revision: 14,
  project: { name: "test-project" },
  objective: { text: "prove the renderer is a view, not a dump", since_session: 60 },
  tasks: [
    {
      id: "T-100",
      title: "a short scannable title",
      priority: "P0",
      status: "open",
      opened_session: 1,
      closed_session: null,
      supersedes: null,
      note: "RATIONALE-SENTINEL: a paragraph of reasoning that belongs in state.json, not in the startup read.",
    },
    {
      id: "T-101",
      title: "an in-progress item",
      priority: "P1",
      status: "in_progress",
      opened_session: 2,
      closed_session: null,
      supersedes: "T-099",
      note: null,
    },
    {
      id: "T-102",
      title: "a finished item",
      priority: "P2",
      status: "done",
      opened_session: 1,
      closed_session: 3,
      supersedes: null,
      note: "closure note",
    },
  ],
  verified: [],
  gaps: [],
  decisions: [],
  handoffs: [{ seat: "developer", session: 60, pick_up: "here", watch_out: ["a hazard"], open_questions: [] , loop_state: null, session_uuid: "u-60", checkout: "sia-builder" }],
  sessions: [{ n: 60, date: "2026-09-17", uuid: "u-60", seat: "developer", checkout: "sia-builder" }],
} as unknown as State;

describe("renderState — the startup read", () => {
  const text = renderState(state, "0.34.0").join("\n");

  it("renders a task as status, id and title only", () => {
    expect(text).toContain("[open] T-100 a short scannable title");
    expect(text).toContain("[in_progress] T-101 an in-progress item (supersedes T-099)");
  });

  it("does NOT render task notes", () => {
    // Pinned as an absence so reinstating notes argues with a failing test rather
    // than sliding back in. On state rev 14 the notes were 5,795 of 7,899 rendered
    // words — trimming INBOX.md alone left every one of them in this call.
    expect(text).not.toContain("RATIONALE-SENTINEL");
    expect(text).not.toContain("a paragraph of reasoning");
  });

  it("lists active tasks and counts done ones rather than listing them", () => {
    expect(text).toContain("Tasks (2 active; done: 1)");
    expect(text).not.toContain("T-102");
  });

  it("keeps the READER'S OWN handoff whole — it is the one prose-shaped thing that stays", () => {
    const own = renderState(state, "0.34.0", { seat: "developer" }).join("\n");
    expect(own).toContain("Your handoff — developer");
    expect(own).toContain("pick up: here");
    expect(own).toContain("- a hazard");
  });

  it("does NOT render another seat's handoff as though it were yours", () => {
    // G-046, and the reason C2 exists: with one project-wide slot the second
    // seat to close out overwrote the first, and a fresh session read the last
    // writer's pick-up as its own. A greeting that shows the developer's handoff
    // to the planner is C4 failing on the row C2 exists for.
    const asPlanner = renderState(state, "0.34.0", { seat: "planner" }).join("\n");
    expect(asPlanner).not.toContain("Your handoff");
    expect(asPlanner).toContain("no handoff recorded for this seat (planner)");
    // The developer's is still NAMED — withholding it entirely would be its own
    // kind of silence — but as another seat's, not as this reader's.
    expect(asPlanner).toContain("Other handoffs (newest per seat and checkout");
    expect(asPlanner).toContain("developer [sia-builder] (session 60)");
  });

  it("T-163: the reader's own handoff is the NEWEST of its seat, and the greeting does not grow with the array", () => {
    const entry = (session: number, checkout: string, pick_up: string) => ({
      seat: "developer", session, pick_up, watch_out: [`watch ${session}`], open_questions: [], loop_state: null, session_uuid: `u-${session}`, checkout,
    });
    const few: State = { ...state, handoffs: [entry(60, "sia-builder", "OLD"), entry(70, "sia-builder", "NEW")] } as unknown as State;
    const many: State = {
      ...state,
      handoffs: [...Array.from({ length: 10 }, (_, i) => entry(40 + i, "sia-builder", `ANCIENT ${i}`)), entry(60, "sia-builder", "OLD"), entry(70, "sia-builder", "NEW")],
    } as unknown as State;
    const a = renderState(few, "x", { seat: "developer" });
    const b = renderState(many, "x", { seat: "developer" });
    const text = b.join("\n");
    expect(text).toContain("Your handoff — developer [sia-builder], session 70:");
    expect(text).toContain("pick up: NEW");
    expect(text).not.toContain("ANCIENT");
    expect(text).not.toContain("pick up: OLD");
    expect(text).toContain("(11 older handoff(s) superseded within their seat and checkout are in the record, not shown)");
    // Same number of lines for 2 entries and 12: the array grew, the greeting did not.
    expect(b.length).toBe(a.length);
  });

  it("T-163: another CHECKOUT of the same seat is named, not hidden — a still-open seat stays visible", () => {
    const e = (session: number, checkout: string) => ({
      seat: "developer", session, pick_up: `words from ${checkout}`, watch_out: [], open_questions: [], loop_state: null, session_uuid: `u-${checkout}`, checkout,
    });
    const s: State = { ...state, handoffs: [e(107, "sia-forge"), e(118, "sia-builder")] } as unknown as State;
    const text = renderState(s, "x", { seat: "developer" }).join("\n");
    expect(text).toContain("Your handoff — developer [sia-builder], session 118:");
    expect(text).toContain("developer [sia-forge] (session 107)");
    expect(text).toContain("words from sia-forge");
  });

  it("says the reader's seat is unresolved rather than picking one", () => {
    expect(text).toContain("READER'S SEAT UNRESOLVED");
    expect(text).not.toContain("Your handoff");
  });

  it("prints the version only when supplied, never a guess", () => {
    expect(text).toContain("Project: test-project v0.34.0");
    expect(renderState(state).join("\n")).toContain("Project: test-project");
    expect(renderState(state).join("\n")).not.toContain("v0.34.0");
  });
});

/**
 * T-183: the greeting stopped fitting one tool result (98,679 characters at rev
 * 130, a third of it gap text), so gaps and verified claims are clipped to one
 * line. The protection is that a clip is never silent: the marker, the full
 * length and where the full text lives are printed every time one happens.
 */
describe("renderState — T-183 clipped gaps and verified claims", () => {
  const LONG_GAP = `First sentence of a long gap. ${"Detail that must not reach the greeting. ".repeat(10)}`;
  const LONG_GAP_NO_STOP = "x".repeat(200);
  const SHORT_GAP = "A short gap. Two sentences, still under the limit.";
  const LONG_CLAIM = `${"A verified claim that runs well past its limit ".repeat(4)}and keeps going.`;
  const clipped: State = {
    ...state,
    verified: [
      { id: "V-001", claim: LONG_CLAIM, evidence: [{}, {}] as never, since_session: 1, status: "active" },
      { id: "V-002", claim: "short claim", evidence: [{}] as never, since_session: 1, status: "active" },
    ],
    gaps: [
      { id: "G-001", what: LONG_GAP, evidence: "", recommended_update: "", opened_session: 54 },
      { id: "G-002", what: SHORT_GAP, evidence: "", recommended_update: "", opened_session: 55 },
      { id: "G-003", what: LONG_GAP_NO_STOP, evidence: "", recommended_update: "", opened_session: 56 },
      { id: "G-004", what: "line one\nline two", evidence: "", recommended_update: "", opened_session: 57 },
    ],
  } as unknown as State;
  const lines = renderState(clipped, "0.44.2");
  const line = (id: string) => lines.filter((l) => l.startsWith(`  ${id} — `));

  it("T183-2: a gap over the limit is ONE line, cut at its first sentence, with the marker and full length", () => {
    const g = line("G-001");
    expect(g).toHaveLength(1);
    expect(g[0]).toBe(
      `  G-001 — First sentence of a long gap.… (${LONG_GAP.length} chars; full text: state.json gaps[G-001]) (opened session 54)`
    );
    expect(lines.join("\n")).not.toContain("Detail that must not reach the greeting");
  });

  it("T183-2: with no sentence end inside the limit, the cut is at the limit — and still marked", () => {
    expect(line("G-003")[0]).toBe(
      `  G-003 — ${"x".repeat(140)}… (${LONG_GAP_NO_STOP.length} chars; full text: state.json gaps[G-003]) (opened session 56)`
    );
  });

  it("T183-2: a gap under the limit is printed whole, with no marker", () => {
    expect(line("G-002")).toEqual([`  G-002 — ${SHORT_GAP} (opened session 55)`]);
  });

  it("a closed gap is not listed as open (TG-1)", () => {
    const withTombstone = {
      ...clipped,
      gaps: [
        ...clipped.gaps,
        { id: "G-009", what: "closed text that must not render", evidence: "", recommended_update: "", opened_session: 1, status: "closed" as const, closed_session: 2, closed_rev: 3 },
      ],
    };
    const text = renderState(withTombstone, "0.44.2").join("\n");
    expect(text).toContain("Gaps (4):");
    expect(text).not.toContain("G-009");
    expect(text).not.toContain("closed text that must not render");
  });

  it("a gap with a line break is still one line, and the break counts as a clip", () => {
    expect(line("G-004")).toEqual([`  G-004 — line one… (17 chars; full text: state.json gaps[G-004]) (opened session 57)`]);
    // No rendered line may begin with gap text: one gap, one line.
    expect(lines).not.toContain("line two (opened session 57)");
  });

  it("clips a verified claim at its own limit and keeps the evidence count", () => {
    const v = line("V-001");
    expect(v).toHaveLength(1);
    expect(v[0]).toMatch(new RegExp(`… \\(${LONG_CLAIM.length} chars; full text: state\\.json verified\\[V-001\\]\\) \\(2 evidence\\)$`));
    const body = v[0].slice("  V-001 — ".length, v[0].indexOf("…"));
    expect(body.length).toBeLessThanOrEqual(100);
    expect(line("V-002")).toEqual(["  V-002 — short claim (1 evidence)"]);
  });

  it("verified is its count plus the newest 10, and the omission is counted and named", () => {
    const many = Array.from({ length: 15 }, (_, i) => ({
      id: `V-${String(i + 1).padStart(3, "0")}`,
      claim: `claim ${i + 1}`,
      evidence: [],
      since_session: 1,
      status: i === 1 ? "reopened" : "active",
    }));
    const out = renderState({ ...state, verified: many } as unknown as State, "x");
    const text = out.join("\n");
    expect(text).toContain(`Verified (${many.length}):`);
    // Newest ten by append order: V-006..V-015. V-002 is reopened, so it stays whatever its age.
    for (let n = 6; n <= 15; n++) expect(out).toContain(`  V-${String(n).padStart(3, "0")} — claim ${n} (0 evidence)`);
    expect(out).toContain("  V-002 — claim 2 (0 evidence) [REOPENED]");
    for (const n of [1, 3, 4, 5]) expect(text).not.toContain(`V-00${n} —`);
    expect(out).toContain(`  … 4 older verified claim(s) not shown (${many.length} total); all of them: node open-brain/build/cli.js state show --json`);
    expect(VERIFIED_FULL_TEXT).toBe("node open-brain/build/cli.js state show --json");
  });

  it("prints no omission line when nothing was omitted", () => {
    expect(lines.join("\n")).not.toContain("not shown");
  });

  it("the marker is present exactly when text was cut, for every gap and claim", () => {
    for (const g of clipped.gaps) {
      const cut = g.what.length > 140 || /[\r\n]/.test(g.what);
      expect(line(g.id)[0].includes("full text: state.json"), g.id).toBe(cut);
    }
  });
});

/**
 * The base behaviour for another seat's line, stated independently of the
 * renderer: its first non-blank line, cut to 157 characters plus "..." when it is
 * over 160.
 */
function otherSeatLine(pickUp: string): string {
  const line = pickUp.split(/\r?\n/).find((l) => l.trim()) ?? "";
  if (!line) return "(nothing recorded)";
  return line.length > 160 ? `${line.slice(0, 157)}...` : line;
}

/**
 * R183-1, with fixtures that hold whatever the real record happens to contain:
 * the real record's questions for Aaron are all short and single-sentence today,
 * so a clip of them is invisible there. These items are long, multi-sentence and
 * over the gap clip, and the other seats' lines sit either side of 160.
 */
describe("renderState — R183-1 the loop state and other seats' lines are not clipped", () => {
  const long = (tag: string) =>
    `${tag} first sentence ends here. ` + "A second sentence runs on well past the gap clip of one hundred and forty characters. ".repeat(3);
  const mid = "M".repeat(150); // over 60, under 160: printed whole
  const over = "L".repeat(200); // over 160: cut to 157 plus "..."
  const withLoop: State = {
    ...state,
    handoffs: [
      {
        seat: "planner",
        session: 61,
        pick_up: "planner pick-up",
        watch_out: [],
        open_questions: [],
        loop_state: {
          open_prs: [],
          frozen_sha: null,
          questions_for_aaron: [long("QUESTION")],
          rulings: [long("RULING")],
        },
      },
      { seat: "developer", session: 60, pick_up: `${mid}\nsecond line`, watch_out: [], open_questions: [], loop_state: null },
      { seat: "qa", session: 59, pick_up: over, watch_out: [], open_questions: [], loop_state: null },
    ],
  };

  it("the fixture's items are over the gap clip, so a clip would change them", () => {
    expect(long("X").length).toBeGreaterThan(GAP_CLIP);
  });

  it("prints every loop-state ruling and question for Aaron whole", () => {
    const lines = renderState(withLoop, "x", { seat: "planner" });
    expect(lines).toContain(`      - ${long("RULING")}`);
    expect(lines).toContain(`      - ${long("QUESTION")}`);
  });

  it("prints another seat's first line whole up to 160, and cuts it to 157 plus '...' above", () => {
    const lines = renderState(withLoop, "x", { seat: "planner" });
    expect(lines).toContain(`    ${mid}`);
    expect(lines).toContain(`    ${"L".repeat(157)}...`);
  });
});

/**
 * T183-3: the render against THIS repository's own record. Every handoff
 * watch-out and open question is byte-identical to state.json's (start.md: never
 * summarise it, never drop items for length), and the tasks and objective are
 * unchanged by the clip.
 */
describe("renderState — T183-3 the real record's handoffs are verbatim", () => {
  // T-163: read at the CURRENT schema. On a branch that moves the schema the
  // live file is one version behind until it is migrated after merge, so the
  // helper migrates it in memory (writing nothing) and says which it did.
  const { state: real } = readRepoRecord();
  // The entries a reader is shown: the newest per seat is "yours", the newest
  // per seat and checkout is named. Older entries are record-only.
  const visible = newestHandoffPerInstance(real.handoffs);
  const ownEntries = [...new Set(real.handoffs.map((h) => h.seat))].map((seat) => newestHandoffForSeat(real.handoffs, seat)!);

  it("walks a non-empty set of handoff items (a vacuous pass is not a pass)", () => {
    const items = ownEntries.flatMap((h) => [...h.watch_out, ...h.open_questions]);
    expect(items.length).toBeGreaterThan(0);
  });

  for (const h of ownEntries) {
    it(`renders the ${h.seat} seat's watch-outs and open questions as whole lines, byte-identical`, () => {
      const lines = renderState(real, "x", { seat: h.seat });
      for (const w of [...h.watch_out, ...h.open_questions]) expect(lines).toContain(`    - ${w}`);
      expect(lines).toContain(`  pick up: ${h.pick_up}`);
    });

    // R183-1: the loop state (rulings, questions for Aaron) is part of "the loop
    // state unchanged" (brief §2.3), and nothing held it until QA 114 (q10, q19).
    it(`renders the ${h.seat} seat's loop-state rulings and questions for Aaron as whole lines, byte-identical`, () => {
      const lines = renderState(real, "x", { seat: h.seat });
      const ls = h.loop_state;
      for (const item of ls ? [...ls.rulings, ...ls.questions_for_aaron] : []) expect(lines).toContain(`      - ${item}`);
    });

    // R183-1: each OTHER seat's named line is unchanged from the base (q18).
    it(`renders the other seats' lines for the ${h.seat} reader unchanged`, () => {
      const lines = renderState(real, "x", { seat: h.seat });
      for (const o of visible.filter((x) => x !== h)) expect(lines).toContain(`    ${otherSeatLine(o.pick_up)}`);
    });
  }

  it("walks a non-empty set of other-seat lines", () => {
    expect(visible.length).toBeGreaterThan(1);
  });

  // D-100 changed this row on purpose: it used to require every title whole. A title over 100 characters is now
  // cut to its first 100 plus an ellipsis (stated here independently of the renderer); every other title is whole.
  it("leaves the objective unchanged and every active task title whole, or cut at 100 with an ellipsis (D-100)", () => {
    const text = renderState(real, "x").join("\n");
    if (real.objective) expect(text).toContain(`Objective: ${real.objective.text} (since session ${real.objective.since_session})`);
    const active = real.tasks.filter((t) => t.status !== "done");
    expect(active.length).toBeGreaterThan(0);
    for (const t of active) expect(text).toContain(`${t.id} ${t.title.length > 100 ? `${t.title.slice(0, 100).trimEnd()}…` : t.title}`);
  });
});

/**
 * T-209: the gaps list is newest-first. At 40 open gaps the old order (append order,
 * so oldest first) showed a starting session G-001..G-007 and hid G-049 and G-042..G-045,
 * the ones that bite. Open session descending, then id descending.
 */
describe("renderState — T-209 gaps newest-first", () => {
  const gap = (id: string, opened_session: number) => ({ id, what: `gap ${id}`, evidence: "", recommended_update: "", opened_session });
  // Append order is NOT session order (G-005 was opened before G-002), and G-002/G-003 tie on session.
  const fixture: State = {
    ...state,
    gaps: [gap("G-001", 54), gap("G-005", 54), gap("G-002", 60), gap("G-003", 60), gap("G-049", 150), gap("G-1000", 60)],
  } as unknown as State;
  const rendered = () => renderState(fixture, "x").filter((l) => /^ {2}G-\d+ — /.test(l)).map((l) => /^ {2}(G-\d+)/.exec(l)![1]);

  it("T209-1: the newest gap renders first; ties break by id, highest first", () => {
    // 150; then the 60s by id descending (numeric: G-1000 > G-003 > G-002); then the 54s.
    expect(rendered()).toEqual(["G-049", "G-1000", "G-003", "G-002", "G-005", "G-001"]);
  });

  it("T209-2: the render does not mutate the record's gap order", () => {
    const before = fixture.gaps.map((g) => g.id);
    renderState(fixture, "x");
    expect(fixture.gaps.map((g) => g.id)).toEqual(before);
  });

  it("T209-3: the count line and the closed-gap filter are unchanged", () => {
    const withClosed = { ...fixture, gaps: [...fixture.gaps, { ...gap("G-999", 200), status: "closed" as const, closed_session: 201, closed_rev: 3 }] } as unknown as State;
    const text = renderState(withClosed, "x").join("\n");
    expect(text).toContain("Gaps (6):");
    expect(text).not.toContain("G-999");
  });

  it("T209-4: ids tie-break by NUMBER, not by text: G-100 before G-99 in one session", () => {
    const s: State = { ...state, gaps: [gap("G-99", 70), gap("G-100", 70), gap("G-98", 70)] } as unknown as State;
    expect(renderState(s, "x").filter((l) => /^ {2}G-\d+ — /.test(l)).map((l) => /^ {2}(G-\d+)/.exec(l)![1])).toEqual(["G-100", "G-99", "G-98"]);
  });

  it("T209-5: G-10, G-9 and G-2 in one session render 10, 9, 2 (text order would give 9, 2, 10)", () => {
    const s: State = { ...state, gaps: [gap("G-2", 70), gap("G-10", 70), gap("G-9", 70)] } as unknown as State;
    expect(renderState(s, "x").filter((l) => /^ {2}G-\d+ — /.test(l)).map((l) => /^ {2}(G-\d+)/.exec(l)![1])).toEqual(["G-10", "G-9", "G-2"]);
  });

  it("T209-6: the comparator itself, so a fixture where text and number order differ is in the candidate's own tests", () => {
    const ids = ["G-9", "G-100", "G-2", "G-10", "G-99"].map((id) => ({ id, opened_session: 5 }));
    expect([...ids].sort(newestGapFirst).map((g) => g.id)).toEqual(["G-100", "G-99", "G-10", "G-9", "G-2"]);
    expect(newestGapFirst({ id: "G-1", opened_session: 9 }, { id: "G-999", opened_session: 8 })).toBeLessThan(0);
  });
});

/**
 * T-183 cut (D-100): the greeting shows the newest 10 open gaps and a count line, and clips task titles at 100
 * characters. The count comes from gaps[], never from what was rendered, so a clip cannot make it lie.
 */
describe("renderState — T-183 gaps cap and task-title clip (D-100)", () => {
  const gap = (n: number, opened_session: number, extra: object = {}) => ({
    id: `G-${String(n).padStart(3, "0")}`, what: `gap ${n}`, evidence: "", recommended_update: "", opened_session, ...extra,
  });
  const many = (open: number, closed = 0): State =>
    ({
      ...state,
      gaps: [
        ...Array.from({ length: open }, (_, i) => gap(i + 1, 50 + i)),
        ...Array.from({ length: closed }, (_, i) => gap(900 + i, 200, { status: "closed", closed_session: 201, closed_rev: 3 })),
      ],
    }) as unknown as State;
  const gapLines = (s: State) => renderState(s, "x").filter((l) => /^ {2}G-\d+ — /.test(l));

  it("C183-1: 40 open gaps render exactly 10 lines, the newest, and a count line with the true totals", () => {
    const out = renderState(many(40, 3), "x");
    const lines = out.filter((l) => /^ {2}G-\d+ — /.test(l));
    expect(lines).toHaveLength(10);
    expect(lines[0]).toContain("G-040");
    expect(lines[9]).toContain("G-031");
    expect(out).toContain("  … and 30 older open gaps (40 open in all): state.json gaps[]");
    expect(out.join("\n")).toContain("Gaps (40):");
  });

  it("C183-2: 10 or fewer open gaps have no count line", () => {
    for (const n of [0, 1, 10]) {
      const text = renderState(many(n, 2), "x").join("\n");
      expect(text, `${n} open`).not.toContain("older open gap");
    }
    expect(gapLines(many(10))).toHaveLength(10);
  });

  it("C183-2b: 11 open gaps render 10 and say there is 1 older (singular is still counted, not omitted)", () => {
    const out = renderState(many(11), "x");
    expect(out.filter((l) => /^ {2}G-\d+ — /.test(l))).toHaveLength(10);
    expect(out).toContain("  … and 1 older open gaps (11 open in all): state.json gaps[]");
  });

  it("C183-3: a 250-character task title renders as its first 100 characters plus an ellipsis, id and status intact", () => {
    const title = `${"t".repeat(99)}X${"u".repeat(150)}`;
    expect(title).toHaveLength(250);
    const long = { ...state, tasks: [{ ...state.tasks[0], id: "T-777", status: "blocked", title }] } as unknown as State;
    const line = renderState(long, "x").find((l) => l.includes("T-777"))!;
    expect(line).toBe(`    [blocked] T-777 ${"t".repeat(99)}X…`);
    expect(line).not.toContain("u");
  });

  it("C183-3b: a title of exactly 100 characters, and a short one, are not touched", () => {
    const hundred = "h".repeat(100);
    const s = { ...state, tasks: [{ ...state.tasks[0], id: "T-778", title: hundred }, { ...state.tasks[1], id: "T-779", title: "short" }] } as unknown as State;
    const out = renderState(s, "x");
    expect(out).toContain(`    [open] T-778 ${hundred}`);
    expect(out).toContain("    [in_progress] T-779 short (supersedes T-099)");
  });
});
