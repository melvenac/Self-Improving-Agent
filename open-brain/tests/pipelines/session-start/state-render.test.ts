import { describe, it, expect } from "vitest";
import { renderState } from "../../../src/pipelines/session-start/state-render.js";
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
