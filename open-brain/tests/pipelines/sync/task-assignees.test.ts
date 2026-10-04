import { describe, it, expect, afterEach } from "vitest";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, readFileSync, cpSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { checkTaskAssignees } from "../../../src/pipelines/sync/task-assignees.js";

/**
 * T-236 (c) C1. `tasks[].assignee` is a key of hub-partner-seats.json `seats`. The writer does not read the map, so a
 * /sync check does: an assignee that is not a seat is an ISSUE naming the task and the value; nothing to check is a
 * SKIP with its reason, never a pass. It also says when briefing_focus is on without briefing_budget (inert).
 */
const REPO = join(import.meta.dirname, "../../../..");
const SIA = JSON.parse(readFileSync(join(import.meta.dirname, "../../fixtures-state/state.json"), "utf8"));
const OPEN: string[] = SIA.tasks.filter((t: { status: string }) => t.status !== "done").map((t: { id: string }) => t.id);
const roots: string[] = [];

function project(opts: { assign?: Record<string, string>; map?: boolean; state?: boolean; flags?: Record<string, boolean> } = {}): string {
  const root = mkdtempSync(join(tmpdir(), "t236c-assignees-"));
  roots.push(root);
  mkdirSync(join(root, ".agents", "SYSTEM"), { recursive: true });
  if (opts.map !== false) cpSync(join(REPO, ".agents", "SYSTEM", "hub-partner-seats.json"), join(root, ".agents", "SYSTEM", "hub-partner-seats.json"));
  if (opts.state !== false) {
    const raw = structuredClone(SIA);
    raw.tasks = raw.tasks.map((t: { id: string }) => (opts.assign?.[t.id] ? { ...t, assignee: opts.assign[t.id] } : t));
    writeFileSync(join(root, ".agents", "state.json"), JSON.stringify(raw));
  }
  if (opts.flags) writeFileSync(join(root, ".agents", "SYSTEM", "greeting.json"), JSON.stringify(opts.flags));
  return root;
}

afterEach(() => {
  for (const r of roots.splice(0)) rmSync(r, { recursive: true, force: true });
});

describe("T-236 (c) C1 /sync task-assignees", () => {
  it("an assignee that is not a seat in the map is an issue naming the task and the value", () => {
    const r = checkTaskAssignees(project({ assign: { [OPEN[0]]: "infra", [OPEN[1]]: "cursor-infra" } }));
    expect(r.name).toBe("task-assignees");
    expect(r.severity).toBe("issue");
    expect(r.message).toContain(`${OPEN[1]} assignee "cursor-infra" is not a seat in .agents/SYSTEM/hub-partner-seats.json`);
    expect(r.message).not.toContain(`${OPEN[0]} assignee`);
  });

  it("every assignee a map seat: pass, saying how many it checked", () => {
    const r = checkTaskAssignees(project({ assign: { [OPEN[0]]: "infra", [OPEN[1]]: "builder" } }));
    expect(r.severity).toBe("pass");
    expect(r.message).toMatch(/^2 assigned task\(s\), every assignee a seat in the map/);
  });

  it("no map, or no record, is a SKIP with its reason, not a pass", () => {
    expect(checkTaskAssignees(project({ map: false }))).toMatchObject({ severity: "skip" });
    expect(checkTaskAssignees(project({ map: false })).message).toMatch(/no seat map/);
    expect(checkTaskAssignees(project({ state: false })).message).toMatch(/no \.agents\/state\.json/);
  });

  it("briefing_focus on without briefing_budget is reported, because it renders nothing", () => {
    const r = checkTaskAssignees(project({ flags: { briefing_focus: true } }));
    expect(r.severity).toBe("warn");
    expect(r.message).toContain("briefing_focus has no effect without briefing_budget");
  });
});
