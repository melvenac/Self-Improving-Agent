import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { parseState, type State } from "../../../src/shared/state-schema.js";
import { renderBriefing, type BriefingInput } from "../../../src/pipelines/session-start/briefing.js";

// T-309: the budgeted NEXT says when the objective names a done task, on that task's own row, so it costs no line.
const SIA = JSON.parse(readFileSync(join(import.meta.dirname, "../../fixtures-state/state.json"), "utf8"));
const STALE = "(objective names a done task: update it with set_objective)";

type RawTask = { id: string; status: string; title: string };
const done = (SIA.tasks as RawTask[]).find((t) => t.status === "done")!;
const open = (SIA.tasks as RawTask[]).find((t) => t.status === "open" && t.id.length === done.id.length)!;

function stateWith(objective: string, titles: Record<string, string> = {}): State {
  const raw = structuredClone(SIA);
  raw.objective = { text: objective, since_session: 5 };
  raw.tasks = raw.tasks.map((t: RawTask) => (titles[t.id] ? { ...t, title: titles[t.id] } : t));
  const parsed = parseState(JSON.stringify(raw));
  if (!parsed.ok) throw new Error(`fixture invalid: ${parsed.error}`);
  return parsed.data;
}

const input = (state: State): BriefingInput => ({
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
});

function next(state: State): string[] {
  const lines = renderBriefing(input(state));
  const at = lines.indexOf("NEXT");
  const out: string[] = [];
  for (let i = at + 1; at >= 0 && i < lines.length && lines[i]!.startsWith("- "); i++) out.push(lines[i]!);
  return out;
}

describe("T-309: a done task in the objective says the objective is stale", () => {
  it("fixture: a done task and an open task with ids of the same length", () => {
    expect(done, "fixture has a done task").toBeTruthy();
    expect(open, "fixture has an open task").toBeTruthy();
  });

  it("D1: the done task's row is marked done and says to update the objective", () => {
    const rows = next(stateWith(`Verify ${done.id}, then ${open.id}.`));
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatch(new RegExp(`^- \\[done\\] ${done.id} `));
    expect(rows[0]!.endsWith(` ${STALE}`), rows[0]).toBe(true);
  });

  it("D2: an open task's row carries no stale note", () => {
    const rows = next(stateWith(`Do ${open.id}.`));
    expect(rows).toHaveLength(1);
    expect(rows[0]).not.toContain("set_objective");
  });

  it("D3: with long titles the done row, note included, is no longer than an open row", () => {
    const long = `Title ${"x".repeat(400)}`;
    const rows = next(stateWith(`Do ${done.id} and ${open.id}.`, { [done.id]: long, [open.id]: long }));
    expect(rows).toHaveLength(2);
    expect(rows[0]!.endsWith(` ${STALE}`), rows[0]).toBe(true);
    expect(rows[0]!.length, `${rows[0]!.length} vs ${rows[1]!.length}`).toBeLessThanOrEqual(rows[1]!.length);
  });

  it("D4: the stale note is the exported constant, so the row and any doc quote one string", async () => {
    const mod = await import("../../../src/pipelines/session-start/briefing.js");
    expect((mod as unknown as Record<string, unknown>).STALE_OBJECTIVE).toBe(STALE);
  });
});
