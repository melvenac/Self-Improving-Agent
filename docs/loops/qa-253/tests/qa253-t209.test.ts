// QA 253, own T-209 fixtures. Copied into open-brain/tests/pipelines/session-start/ of the tree under test.
import { describe, it, expect } from "vitest";
import { renderState } from "../../../src/pipelines/session-start/state-render.js";
import type { State } from "../../../src/shared/state-schema.js";

const gap = (id: string, opened_session: number) => ({ id, what: `gap ${id}`, evidence: "", recommended_update: "", opened_session });
const base = {
  schema_version: 2, revision: 1, project: { name: "qa253" }, objective: { text: "o", since_session: 1 },
  tasks: [], verified: [], decisions: [], handoffs: [], sessions: [],
};
const ids = (gaps: ReturnType<typeof gap>[]): string[] =>
  renderState({ ...base, gaps } as unknown as State, "x").filter((l) => /^ {2}G-\d+ — /.test(l)).map((l) => /^ {2}(G-\d+)/.exec(l)![1]);

describe("QA253 T-209", () => {
  it("Q253-2a: sessions 54, 150, 65, ids not in session order -> 150, 65, 54", () => {
    // G-007 opened in 150, G-030 in 54, G-012 in 65: id order would be 007, 012, 030.
    expect(ids([gap("G-030", 54), gap("G-007", 150), gap("G-012", 65)])).toEqual(["G-007", "G-012", "G-030"]);
  });

  it("Q253-2b: same session, ids descending NUMERICALLY: G-100 before G-99", () => {
    expect(ids([gap("G-99", 60), gap("G-100", 60)])).toEqual(["G-100", "G-99"]);
    expect(ids([gap("G-100", 60), gap("G-99", 60)])).toEqual(["G-100", "G-99"]);
  });

  it("Q253-2c: same session, G-10 before G-9 before G-2", () => {
    expect(ids([gap("G-2", 7), gap("G-10", 7), gap("G-9", 7)])).toEqual(["G-10", "G-9", "G-2"]);
  });

  it("Q253-2d: session order beats id order (mutant: id only)", () => {
    expect(ids([gap("G-100", 10), gap("G-005", 200)])).toEqual(["G-005", "G-100"]);
  });
});
