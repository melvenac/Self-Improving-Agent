import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { renderState, VERIFIED_FULL_TEXT, GAP_CLIP } from "../../../src/pipelines/session-start/state-render.js";
import { parseState } from "../../../src/shared/state-schema.js";
import type { State } from "../../../src/shared/state-schema.js";

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
  handoffs: [{ seat: "developer", session: 60, pick_up: "here", watch_out: ["a hazard"], open_questions: [] , loop_state: null }],
  last_session: { n: 60, date: "2026-09-17", uuid: null , seat: null },
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
    expect(asPlanner).toContain("Other seats' handoffs");
    expect(asPlanner).toContain("developer (session");
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
  const statePath = join(__dirname, "..", "..", "..", "..", ".agents", "state.json");
  const parsed = parseState(readFileSync(statePath, "utf-8"));
  if (!parsed.ok) throw new Error(`the repository's own state.json does not parse: ${parsed.error}`);
  const real = parsed.data;

  it("walks a non-empty set of handoff items (a vacuous pass is not a pass)", () => {
    const items = real.handoffs.flatMap((h) => [...h.watch_out, ...h.open_questions]);
    expect(items.length).toBeGreaterThan(0);
  });

  for (const h of real.handoffs) {
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
      for (const o of real.handoffs.filter((x) => x !== h)) expect(lines).toContain(`    ${otherSeatLine(o.pick_up)}`);
    });
  }

  it("walks a non-empty set of other-seat lines", () => {
    expect(real.handoffs.length).toBeGreaterThan(1);
  });

  it("leaves the objective and every active task title unchanged", () => {
    const text = renderState(real, "x").join("\n");
    if (real.objective) expect(text).toContain(`Objective: ${real.objective.text} (since session ${real.objective.since_session})`);
    const active = real.tasks.filter((t) => t.status !== "done");
    expect(active.length).toBeGreaterThan(0);
    for (const t of active) expect(text).toContain(`${t.id} ${t.title}`);
  });
});
