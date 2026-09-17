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
  schema_version: 1,
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
  handoff: { session: 60, pick_up: "here", watch_out: ["a hazard"], open_questions: [] },
  last_session: { n: 60, date: "2026-09-17", uuid: null },
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

  it("keeps the handoff whole — it is the one prose-shaped thing that stays", () => {
    expect(text).toContain("pick up: here");
    expect(text).toContain("- a hazard");
  });

  it("prints the version only when supplied, never a guess", () => {
    expect(text).toContain("Project: test-project v0.34.0");
    expect(renderState(state).join("\n")).toContain("Project: test-project");
    expect(renderState(state).join("\n")).not.toContain("v0.34.0");
  });
});
