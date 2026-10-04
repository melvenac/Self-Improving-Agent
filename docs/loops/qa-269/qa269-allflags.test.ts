import { describe, it, expect, afterEach } from "vitest";
import { mkdtempSync, mkdirSync, rmSync, readFileSync, cpSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { parseState } from "../src/shared/state-schema.js";
import { resolveCheckoutSeat } from "../src/pipelines/session-start/seat-map.js";
import { focusLine, seatsLine, seatOrder } from "../src/pipelines/session-start/focus.js";
import { MISSING_HANDOFF_MAX_CHARS } from "../src/pipelines/session-start/state-render.js";
import { BRIEFING_BUDGET, renderBriefing, type BriefingInput } from "../src/pipelines/session-start/briefing.js";

/**
 * QA 269 batch row 16 (not for merge): #401's B1 worst case (every section past its cap, 400-char titles, every seat
 * assigned, FOCUS + SEATS) with #402's notice ON as well, at the longest realistic form (8-char seat "research",
 * 36-char uuid, 4-digit session, 6-digit rev), and with the notice at MISSING_HANDOFF_MAX_CHARS exactly.
 */
const REPO = join(import.meta.dirname, "../..");
const SIA = JSON.parse(readFileSync(join(import.meta.dirname, "fixtures-state", "state.json"), "utf8"));
const parents: string[] = [];
afterEach(() => { for (const p of parents.splice(0)) rmSync(p, { recursive: true, force: true }); });

const long = (head: string, n: number) => `${head} ${"x".repeat(n)}`;
function input(notice: string): BriefingInput {
  const raw = structuredClone(SIA);
  raw.objective = { text: `${"Objective ".repeat(200)} T-1 T-2 T-3 T-4 T-5 T-6 T-7 T-8`, since_session: 5 };
  const seats = ["planner", "builder", "forge", "infra", "qa", "research"];
  let n = 0;
  raw.tasks = raw.tasks.map((t: { status: string }) => (t.status !== "done" ? { ...t, title: long("Title", 400), assignee: seats[n++ % seats.length], status: n <= 6 ? "blocked" : t.status, priority: n <= 4 ? "P0" : "P2" } : t));
  raw.handoffs = [{
    ...raw.handoffs[0], seat: "developer", checkout: "sia-infra", session_uuid: "dev", first_rev: 50,
    pick_up: "Pick up ".repeat(300),
    watch_out: Array.from({ length: 17 }, (_, i) => long(`watch ${i}:`, 700)).concat([{ text: "x", expires: 1 } as unknown as string]),
    open_questions: [...Array.from({ length: 8 }, (_, i) => ({ text: long(`wait ${i}`, 500), owner: "aaron" })), ...Array.from({ length: 8 }, (_, i) => long(`open ${i}`, 500)), { text: "r", resolved_by: "D-1" }],
  }];
  const parsed = parseState(JSON.stringify(raw));
  if (!parsed.ok) throw new Error(parsed.error);
  const state = parsed.data;
  const parent = mkdtempSync(join(tmpdir(), "qa269-all-"));
  parents.push(parent);
  const root = join(parent, "sia-infra");
  mkdirSync(join(root, ".agents", "SYSTEM"), { recursive: true });
  cpSync(join(REPO, ".agents", "SYSTEM", "hub-partner-seats.json"), join(root, ".agents", "SYSTEM", "hub-partner-seats.json"));
  const presence = { atlas: "absent", "cursor-builder": "not polling", grok: "absent", "cursor-infra": "polling" } as const;
  return {
    state, version: "9.9.9", seat: "developer", sessionNumber: 160, sessionNote: null, date: "2026-10-03",
    drift: Array.from({ length: 6 }, (_, i) => ({ field: `field${i}`, expected: "e".repeat(80), actual: "a".repeat(80), fixed: false })) as BriefingInput["drift"],
    serving: "Build abc1234 · STALE: 123 code commits behind, ahead by 45 → ask Aaron to update",
    usage: "Usage: STOP (weekly 98%) · park, push WIP · 5h 14%",
    latestBrief: "Latest brief: docs/loops/t236-brief.md (2026-10-03)",
    workingTree: `Working tree: 9 uncommitted: ${"a/b/c.ts, ".repeat(8)}+1 more`,
    skills: "Skills: self-improving-agent-gotchas, self-improving-agent-guide",
    budget: true,
    focus: { focus: focusLine(state, resolveCheckoutSeat(root)), seats: seatsLine(state, seatOrder(root)!, presence) },
    missingHandoff: notice,
  };
}

describe("QA 269 every flag on", () => {
  const realistic = "Handoff MISSING: last research session #9999 (aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee, rev 999999) wrote the record, left no handoff; fix: ob_state set_handoff";
  it.each([["realistic", realistic], ["at the 160 cap", realistic.padEnd(MISSING_HANDOFF_MAX_CHARS, "x")]])("%s notice: <= 30 lines and <= 4096 chars", (label, notice) => {
    const lines = renderBriefing(input(notice));
    const text = lines.join("\n");
    const i = lines.findIndex((l) => l.startsWith("PICK UP HERE"));
    console.log(`QA269-ALL ${label}: notice ${notice.length} chars, ${lines.length} lines, ${text.length} chars; header starts FOCUS=${lines[i]!.startsWith("PICK UP HERE · FOCUS:")}; body ends with notice=${lines[i + 1]!.endsWith(notice)}; SEATS line=${lines[i - 1]!.startsWith("SEATS:")}`);
    expect(lines.length).toBeLessThanOrEqual(BRIEFING_BUDGET.lines);
    expect(text.length).toBeLessThanOrEqual(BRIEFING_BUDGET.chars);
    expect(lines[i]).toMatch(/^PICK UP HERE · FOCUS: /);
    expect(lines[i + 1]!.endsWith(` · ${notice}`)).toBe(true);
  });
});
