import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, readFileSync, cpSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { parseState, type State } from "../../../src/shared/state-schema.js";
import { resolveCheckoutSeat } from "../../../src/pipelines/session-start/seat-map.js";
import { focusLine, seatsLine, seatOrder } from "../../../src/pipelines/session-start/focus.js";
import { describeHubPresence } from "../../../src/pipelines/session-start/hub-presence.js";
import { BRIEFING_BUDGET, renderBriefing, type BriefingInput } from "../../../src/pipelines/session-start/briefing.js";
import { handleStart } from "../../../src/server.js";

/**
 * T-236 (c), plan docs/loops/t236c-plan.md (ruled by atlas-sia, s160). FOCUS names THIS seat's assigned task, the seat
 * resolved by CHECKOUT; SEATS names every map seat's, with presence words only from the roster ob_start already fetched.
 */
const REPO = join(import.meta.dirname, "../../../..");
const SEAT_MAP = join(REPO, ".agents", "SYSTEM", "hub-partner-seats.json");
const FIXTURES = join(import.meta.dirname, "../../fixtures-state");
const SIA = JSON.parse(readFileSync(join(FIXTURES, "state.json"), "utf8"));
const parents: string[] = [];

/** The fixture's open tasks, so rows assign real ids rather than invented ones. */
const OPEN: string[] = SIA.tasks.filter((t: { status: string }) => t.status !== "done").map((t: { id: string }) => t.id);
/** A fixture task's own status: rows assert it, never assume it (T-005 is in_progress in the fixture). */
const statusOf = (id: string): string => SIA.tasks.find((t: { id: string }) => t.id === id).status;
const DONE: string = SIA.tasks.find((t: { status: string }) => t.status === "done").id;

function stateWith(assign: Record<string, { assignee?: string | null; priority?: string; title?: string; status?: string }>): State {
  const raw = structuredClone(SIA);
  raw.tasks = raw.tasks.map((t: Record<string, unknown>) => (assign[t.id as string] ? { ...t, ...assign[t.id as string] } : t));
  const parsed = parseState(JSON.stringify(raw));
  if (!parsed.ok) throw new Error(`fixture invalid: ${parsed.error}`);
  return parsed.data;
}

/** A directory NAMED as the checkout, carrying the real seat map (and optionally a lying AGENT.local.md). */
function checkout(name: string, agentName?: string): string {
  const parent = mkdtempSync(join(tmpdir(), "t236c-"));
  parents.push(parent);
  const root = join(parent, name);
  mkdirSync(join(root, ".agents", "SYSTEM"), { recursive: true });
  cpSync(SEAT_MAP, join(root, ".agents", "SYSTEM", "hub-partner-seats.json"));
  if (agentName) writeFileSync(join(root, ".agents", "AGENT.local.md"), `---\nname: ${agentName}\nrole: developer\npartner: Atlas\n---\n`);
  return root;
}

afterEach(() => {
  for (const p of parents.splice(0)) rmSync(p, { recursive: true, force: true });
});

describe("T-236 (c) FOCUS", () => {
  it("F1 the checkout's seat (infra) gets its assigned task, though AGENT.local.md names another seat", () => {
    const state = stateWith({ [OPEN[0]]: { assignee: "infra", priority: "P1", title: "Short title" } });
    const line = focusLine(state, resolveCheckoutSeat(checkout("sia-infra", "Builder")));
    expect(line).toBe(`FOCUS: ${OPEN[0]} Short title (P1, ${statusOf(OPEN[0])})`);
  });

  it("F2 no assigned task: 'none assigned in the record', and no task id from NEXT or the objective", () => {
    const state = stateWith({ [OPEN[0]]: { assignee: "builder" } });
    const line = focusLine(state, resolveCheckoutSeat(checkout("sia-infra")));
    expect(line).toBe("FOCUS: none assigned in the record");
    expect(line).not.toMatch(/\bT-\d+/);
  });

  it("F3 an unlisted checkout says so; the main checkout carries no seat and gets no FOCUS line", () => {
    const state = stateWith({ [OPEN[0]]: { assignee: "infra" } });
    expect(focusLine(state, resolveCheckoutSeat(checkout("sia-scratch", "Infra")))).toBe("FOCUS: seat unknown for checkout sia-scratch");
    expect(focusLine(state, resolveCheckoutSeat(checkout("Self-Improving-Agent")))).toBeNull();
  });

  it("F4 several assigned: the highest priority first, then +N more with its pointer", () => {
    const state = stateWith({
      [OPEN[0]]: { assignee: "infra", priority: "P2", title: "low" },
      [OPEN[1]]: { assignee: "infra", priority: "P0", title: "high" },
      [OPEN[2]]: { assignee: "infra", priority: "P1", title: "mid" },
    });
    expect(focusLine(state, resolveCheckoutSeat(checkout("sia-infra")))).toBe(
      `FOCUS: ${OPEN[1]} high (P0, ${statusOf(OPEN[1])}) · +2 more: state.json tasks[] (assignee)`,
    );
  });

  it("F5 a done task is never the focus, whoever it was assigned to", () => {
    const state = stateWith({ [DONE]: { assignee: "infra" } });
    expect(focusLine(state, resolveCheckoutSeat(checkout("sia-infra")))).toBe("FOCUS: none assigned in the record");
  });
});

describe("T-236 (c) SEATS", () => {
  it("S1 every map seat in map order, each with its highest-priority task id or —, and (+N) for more", () => {
    const state = stateWith({
      [OPEN[0]]: { assignee: "builder", priority: "P1" },
      [OPEN[1]]: { assignee: "infra", priority: "P0" },
      [OPEN[2]]: { assignee: "infra", priority: "P2" },
      [DONE]: { assignee: "forge" },
    });
    const order = seatOrder(checkout("sia-infra"));
    expect(order?.map((s) => s.seat)).toEqual(["planner", "builder", "forge", "infra", "qa", "research"]);
    expect(seatsLine(state, order!, null)).toBe(`SEATS: planner — · builder ${OPEN[0]} · forge — · infra ${OPEN[1]} (+1) · qa — · research —`);
  });

  it("S3 with no roster there are no presence words at all", () => {
    const state = stateWith({ [OPEN[0]]: { assignee: "builder" } });
    const line = seatsLine(state, seatOrder(checkout("sia-planner"))!, null)!;
    expect(line).not.toMatch(/polling|absent/);
  });

  describe("S2 presence comes from the ONE roster fetch ob_start already makes", () => {
    let keyDir: string;
    const HUB = "http://hub.test:4000";
    const saved = { HUB_URL: process.env.HUB_URL, A2A_KEY_DIR: process.env.A2A_KEY_DIR };
    const map = JSON.parse(readFileSync(SEAT_MAP, "utf8"));
    const room = (hubAs: string) => map.readers.atlas.partners.find((p: { hub_as: string }) => p.hub_as === hubAs).session_id;
    const roster = {
      agents: [
        { name: "cursor-builder", rooms: [{ sessionId: room("cursor-builder"), unread: 0, pollingNow: true, pollAgeMs: 1000 }] },
        { name: "cursor-infra", rooms: [{ sessionId: room("cursor-infra"), unread: 2, pollingNow: false, pollAgeMs: 60_000 }] },
      ],
    };
    let calls: string[];

    beforeEach(() => {
      keyDir = mkdtempSync(join(tmpdir(), "t236c-keys-"));
      mkdirSync(join(keyDir, "hub.test-4000"), { recursive: true });
      writeFileSync(join(keyDir, "hub.test-4000", "atlas.key"), `atlas-${"k".repeat(40)}`);
      process.env.HUB_URL = HUB;
      process.env.A2A_KEY_DIR = keyDir;
      calls = [];
      vi.spyOn(globalThis, "fetch").mockImplementation(async (url: string | URL | Request) => {
        calls.push(String(url));
        return new Response(JSON.stringify(roster), { status: 200, headers: { "Content-Type": "application/json" } });
      });
    });
    afterEach(() => {
      vi.restoreAllMocks();
      for (const [k, v] of Object.entries(saved)) {
        if (v === undefined) delete process.env[k];
        else process.env[k] = v;
      }
      rmSync(keyDir, { recursive: true, force: true });
    });

    it("the presence block hands SEATS a status per hub name, from its single fetch", async () => {
      const root = checkout("sia-planner");
      const block = await describeHubPresence({ projectRoot: root, identity: null, callerLabel: "vitest" });
      expect(calls).toHaveLength(1);
      expect(block.statusByHubName).toEqual({ "cursor-builder": "polling", "cursor-infra": "not polling", grok: "absent" });
      const state = stateWith({ [OPEN[0]]: { assignee: "builder" } });
      expect(seatsLine(state, seatOrder(root)!, block.statusByHubName ?? null)).toBe(
        `SEATS: planner — · builder ${OPEN[0]} polling · forge — absent · infra — not polling · qa — · research —`,
      );
    });

    it("ob_start (budget + focus on) prints FOCUS and SEATS with presence words, and fetched the roster exactly once", async () => {
      const root = checkout("sia-planner");
      for (const d of ["TASKS", "SESSIONS"]) mkdirSync(join(root, ".agents", d), { recursive: true });
      writeFileSync(join(root, "package.json"), JSON.stringify({ version: "1.0.0" }));
      writeFileSync(join(root, ".agents", "SESSIONS", "SESSION_TEMPLATE.md"), "# Session N\n");
      writeFileSync(join(root, ".agents", "SYSTEM", "greeting.json"), JSON.stringify({ briefing_budget: true, briefing_focus: true }));
      const raw = structuredClone(SIA);
      raw.tasks = raw.tasks.map((t: { id: string }) => (t.id === OPEN[0] ? { ...t, assignee: "planner", title: "Plan it" } : t.id === OPEN[1] ? { ...t, assignee: "builder" } : t));
      writeFileSync(join(root, ".agents", "state.json"), JSON.stringify(raw, null, 2));
      const text = (await handleStart({ project_root: root })).content[0].text;
      expect(calls.filter((u) => u.startsWith(HUB))).toHaveLength(1);
      expect(text).toMatch(new RegExp(`\\nPICK UP HERE · FOCUS: ${OPEN[0]} Plan it \\(P\\d, \\w+\\)\\n`));
      expect(text).toContain(`SEATS: planner ${OPEN[0]} · builder ${OPEN[1]} polling · forge — absent · infra — not polling · qa — · research —`);
    });
  });
});

describe("T-236 (c) B1 the worst case still fits the budget with FOCUS and SEATS on", () => {
  const long = (head: string, n: number) => `${head} ${"x".repeat(n)}`;
  it("every section past its cap, long titles, every seat assigned: <= 30 lines and <= 4096 chars", () => {
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
    const root = checkout("sia-infra");
    const presence = { atlas: "absent", "cursor-builder": "not polling", grok: "absent", "cursor-infra": "polling" } as const;
    const input: BriefingInput = {
      state, version: "9.9.9", seat: "developer", sessionNumber: 160, sessionNote: null, date: "2026-10-03",
      drift: Array.from({ length: 6 }, (_, i) => ({ field: `field${i}`, expected: "e".repeat(80), actual: "a".repeat(80), fixed: false })) as BriefingInput["drift"],
      serving: "Build abc1234 · STALE: 123 code commits behind, ahead by 45 → ask Aaron to update",
      usage: "Usage: STOP (weekly 98%) · park, push WIP · 5h 14%",
      latestBrief: "Latest brief: docs/loops/t236-brief.md (2026-10-03)",
      workingTree: `Working tree: 9 uncommitted: ${"a/b/c.ts, ".repeat(8)}+1 more`,
      skills: "Skills: self-improving-agent-gotchas, self-improving-agent-guide",
      budget: true,
      focus: { focus: focusLine(state, resolveCheckoutSeat(root)), seats: seatsLine(state, seatOrder(root)!, presence) },
    };
    const lines = renderBriefing(input);
    const text = lines.join("\n");
    expect(lines.length, `${lines.length} lines`).toBeLessThanOrEqual(BRIEFING_BUDGET.lines);
    expect(text.length, `${text.length} chars`).toBeLessThanOrEqual(BRIEFING_BUDGET.chars);
    expect(text).toMatch(/\nPICK UP HERE · FOCUS: T-\d+ Title x+… \(P\d, \w+\) · \+\d+ more: state\.json tasks\[\] \(assignee\)\n/);
    expect(text).toMatch(/\nSEATS: planner T-\d+ \(\+\d+\)/);
    expect(text).toContain("Latest brief: docs/loops/t236-brief.md (2026-10-03) · Skills: self-improving-agent-gotchas");
    console.log(`B1-MEASURE ${lines.length} lines ${text.length} chars`);
  });
});
