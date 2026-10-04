import { describe, it, expect, afterEach } from "vitest";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, readFileSync, copyFileSync } from "node:fs";
import { join, basename } from "node:path";
import { tmpdir } from "node:os";
import { checkMissingHandoff, missingHandoffLine, MISSING_HANDOFF_MAX_CHARS } from "../../../src/pipelines/session-start/state-render.js";
import { renderBriefing, BRIEFING_BUDGET, BRIEFING_END, BRIEFING_START, type BriefingInput } from "../../../src/pipelines/session-start/briefing.js";
import { handleStart } from "../../../src/server.js";
import { byPidDir, processStartTime, writeProcessSession } from "../../../src/shared/process-session.js";
import { parseState, type Handoff, type SessionRecord, type State } from "../../../src/shared/state-schema.js";
import { readRepoRecord, REPO_ROOT } from "../../helpers/repo-record.js";

/**
 * T-199. A seat session that wrote the record but left no handoff is DETECTED at that checkout's next /start.
 *
 * Ported from Forge's loop/t199-missing-handoff (bdc74209 red rows, 34468921 product; base abae5f92), onto #393's head with
 * three rulings applied: the line is in the BRIEFING (the State block is not what /start prints), the label is the T-203 map's
 * seat for the checkout, and the whole thing is OPT-IN per repo (greeting.json `missing_handoff`, default OFF) so A2A's render
 * is unchanged. Sessions are attributed by CHECKOUT, the project-root basename the writer stamps: a session that never called
 * set_handoff has seat null, and that null is exactly the case detected.
 */
const MISSING = "Handoff MISSING:";
const NOT_CHECKED = "Handoff check: not checked";
const ROOT = join(tmpdir(), "sia-forge");

function session(n: number, uuid: string | null, checkout: string | null, first_rev: number | null, seat: SessionRecord["seat"] = null): SessionRecord {
  return { n, date: "2026-09-30", uuid, seat, checkout, first_rev };
}

function handoff(uuid: string | null, checkout: string | null, first_rev: number | null, n: number): Handoff {
  return {
    seat: "developer", session: n, pick_up: `pick up ${n}`, watch_out: [], open_questions: [],
    loop_state: null, session_uuid: uuid, checkout, first_rev,
  } as unknown as Handoff;
}

function stateWith(sessions: SessionRecord[], handoffs: Handoff[]): State {
  const s = structuredClone(readRepoRecord().state);
  s.sessions = sessions;
  s.handoffs = handoffs;
  return s;
}

const line = (state: State, opts: Record<string, unknown> = {}): string | null =>
  missingHandoffLine(state, { seat: "developer", projectRoot: ROOT, ...opts });

describe("T-199 HO-1: the last session of this checkout wrote the record and left no handoff", () => {
  it("prints one line naming the seat, number, uuid and first write revision", () => {
    const l = line(stateWith([session(12, "uuid-b", "sia-forge", 30)], []));
    expect(l).toBe(`${MISSING} last developer session #12 (uuid-b, rev 30) wrote the record, left no handoff; fix: ob_state set_handoff`);
  });

  it("names the NEWEST session when an older one has a handoff and the newest does not", () => {
    const l = line(stateWith(
      [session(11, "uuid-a", "sia-forge", 20), session(12, "uuid-b", "sia-forge", 30)],
      [handoff("uuid-a", "sia-forge", 20, 11)],
    ));
    expect(l).toContain("#12 (uuid-b");
    expect(l).not.toContain("uuid-a");
  });

  it("orders by first_rev, not by the order sessions[] happens to list them", () => {
    const l = line(stateWith(
      [session(12, "uuid-b", "sia-forge", 30), session(11, "uuid-a", "sia-forge", 20)],
      [handoff("uuid-a", "sia-forge", 20, 11)],
    ));
    expect(l).toContain("#12 (uuid-b");
  });

  it("a handoff that exists for a DIFFERENT session does not satisfy it: a matching session_uuid is required", () => {
    const l = line(stateWith([session(12, "uuid-b", "sia-forge", 30)], [handoff("uuid-other", "sia-forge", 31, 12)]));
    expect(l).toContain(MISSING);
  });

  it("is reported when handoffs[] is EMPTY, not only beside a handoff listing", () => {
    const s = stateWith([session(3, "uuid-c", "sia-forge", 5)], []);
    expect(s.handoffs).toHaveLength(0);
    expect(line(s)).toContain(MISSING);
  });

  it("labels the line with the checkout when neither the map, the session nor the reader names a seat", () => {
    const l = line(stateWith([session(12, "uuid-b", "sia-forge", 30)], []), { seat: null });
    expect(l).toContain(`${MISSING} last sia-forge session #12`);
  });

  it("does not count the CURRENT session: it has written but its handoff is not due yet", () => {
    const s = stateWith(
      [session(11, "uuid-a", "sia-forge", 20), session(12, "uuid-cur", "sia-forge", 30)],
      [handoff("uuid-a", "sia-forge", 20, 11)],
    );
    expect(line(s, { sessionUuid: "uuid-cur" })).toBeNull();
    const prior = stateWith([session(11, "uuid-a", "sia-forge", 20), session(12, "uuid-cur", "sia-forge", 30)], []);
    expect(line(prior, { sessionUuid: "uuid-cur" })).toContain("#11 (uuid-a");
  });
});

describe("T-199 HO-2: no line when nothing is missing", () => {
  it("the last session's handoff exists", () => {
    expect(line(stateWith([session(12, "uuid-b", "sia-forge", 30)], [handoff("uuid-b", "sia-forge", 30, 12)]))).toBeNull();
  });

  it("an older session lacks a handoff but a newer one has one: only the last counts", () => {
    const s = stateWith(
      [session(11, "uuid-a", "sia-forge", 20), session(12, "uuid-b", "sia-forge", 30)],
      [handoff("uuid-b", "sia-forge", 30, 12)],
    );
    expect(line(s)).toBeNull();
  });

  it("another checkout's session without a handoff is not this checkout's", () => {
    const s = stateWith(
      [session(12, "uuid-b", "sia-forge", 30), session(13, "uuid-x", "sia-builder", 40)],
      [handoff("uuid-b", "sia-forge", 30, 12)],
    );
    expect(line(s)).toBeNull();
  });

  it("a checkout with NO session in the record is clear, not missing (a dev seat that never wrote through ob_state is normal)", () => {
    expect(line(stateWith([session(13, "uuid-x", "sia-builder", 40)], []))).toBeNull();
    expect(line(stateWith([], []))).toBeNull();
  });
});

describe("T-199 HO-6: what cannot be checked is NAMED, never silent", () => {
  it("no project root: the checkout is unknown", () => {
    const s = stateWith([session(12, "uuid-b", "sia-forge", 30)], []);
    expect(missingHandoffLine(s, { seat: "developer" })).toBe(`${NOT_CHECKED} (no project root, so the checkout is unknown)`);
  });

  it("every session of this checkout carries no uuid: none can be matched to a handoff", () => {
    const s = stateWith([session(9, "uuid-old", null, null), session(10, null, "sia-forge", 12)], []);
    const l = line(s)!;
    expect(l).toContain(NOT_CHECKED);
    expect(l).toContain("1 session(s) of checkout sia-forge carry no uuid");
    expect(l).not.toContain(MISSING);
  });

  it("a legacy session (null checkout) is never attributed to this checkout", () => {
    expect(line(stateWith([session(9, "uuid-old", null, null)], []))).toBeNull();
  });
});

describe("T-199 HO-5: the label is the T-203 map's seat for the CHECKOUT, never the identity", () => {
  let tmp: string;
  afterEach(() => { try { rmSync(tmp, { recursive: true }); } catch { /* Windows race */ } });

  function checkoutRoot(name: string): string {
    tmp = mkdtempSync(join(tmpdir(), "ob-t199-map-"));
    const root = join(tmp, name);
    mkdirSync(join(root, ".agents", "SYSTEM"), { recursive: true });
    copyFileSync(join(REPO_ROOT, ".agents", "SYSTEM", "hub-partner-seats.json"), join(root, ".agents", "SYSTEM", "hub-partner-seats.json"));
    return root;
  }

  it.each([["sia-builder", "builder"], ["sia-infra", "infra"], ["sia-forge", "forge"]])("%s resolves to %s although every one carries the identity 'developer'", (checkout, seat) => {
    const root = checkoutRoot(checkout);
    const s = stateWith([session(12, "uuid-b", checkout, 30)], []);
    // The reader's identity role is passed as 'planner' to prove the map, not the identity, names the seat.
    expect(missingHandoffLine(s, { seat: "planner", projectRoot: root })).toContain(`last ${seat} session #12`);
  });

  it("a checkout the map does not list falls back to the session's own seat, then the checkout, and never to the reader's identity first", () => {
    const root = checkoutRoot("sia-unlisted");
    const s = stateWith([session(12, "uuid-b", "sia-unlisted", 30, "qa")], []);
    expect(missingHandoffLine(s, { seat: "planner", projectRoot: root })).toContain("last qa session #12");
  });
});

describe("T-199 HO-4: the line is in the BRIEFING, once, and the budgeted layout gets no extra line", () => {
  const base = (state: State, over: Partial<BriefingInput> = {}): BriefingInput => ({
    state, version: "9.9.9", seat: "developer", sessionNumber: 160, sessionNote: null, date: "2026-10-03", drift: [],
    serving: "Build abc1234 · current", usage: "Usage: GREEN → dispatches open", latestBrief: null,
    workingTree: "Working tree: clean", skills: "Skills: none", ...over,
  });
  const NOTICE = `${MISSING} last builder session #156 (734793c2-0000-4000-8000-000000000000, rev 263) wrote the record, left no handoff; fix: ob_state set_handoff`;
  const own = (): State => stateWith([], [handoff("u-own", "sia-builder", 1, 5)]);

  it("legacy layout: its own line right after the pick-up, before WATCH OUT or the end, printed once", () => {
    const lines = renderBriefing(base(own(), { missingHandoff: NOTICE }));
    const at = lines.indexOf(NOTICE);
    expect(at).toBeGreaterThan(lines.indexOf("PICK UP HERE"));
    expect(lines[at - 1]).toBe("pick up 5");
    expect(lines.filter((l) => l.includes(MISSING))).toHaveLength(1);
    expect(lines[0]).toBe(BRIEFING_START);
    expect(lines.at(-1)).toBe(BRIEFING_END);
  });

  it("budgeted layout: appended to the pick-up line, so the line count is UNCHANGED and the notice appears once", () => {
    const without = renderBriefing(base(own(), { budget: true }));
    const withIt = renderBriefing(base(own(), { budget: true, missingHandoff: NOTICE }));
    expect(withIt).toHaveLength(without.length);
    expect(withIt[withIt.indexOf("PICK UP HERE") + 1]).toBe(`pick up 5 · ${NOTICE}`);
    expect(withIt.join("\n").split(MISSING)).toHaveLength(2);
  });

  it("budgeted layout with no handoff of its own: the notice rides the 'none recorded' line", () => {
    const s = stateWith([], []);
    const withIt = renderBriefing(base(s, { budget: true, missingHandoff: NOTICE }));
    expect(withIt[withIt.indexOf("PICK UP HERE") + 1]).toBe(`none recorded for this seat (developer) · ${NOTICE}`);
  });

  it("absent or null prints nothing in either layout: the render is byte-identical to one that never heard of the field", () => {
    for (const budget of [false, true]) {
      const a = renderBriefing(base(own(), { budget }));
      expect(renderBriefing(base(own(), { budget, missingHandoff: null }))).toEqual(a);
      expect(renderBriefing(base(own(), { budget, missingHandoff: undefined }))).toEqual(a);
    }
  });

  it("the notice for a realistic worst case (7-char seat, 36-char uuid, 4-digit session, 6-digit rev) fits its cap", () => {
    const s = stateWith([session(1234, "00000000-0000-4000-8000-000000000000", "sia-builder", 123456)], []);
    const l = missingHandoffLine(s, { seat: "developer", projectRoot: join(tmpdir(), "sia-builder") })!;
    expect(l.length, l).toBeLessThanOrEqual(MISSING_HANDOFF_MAX_CHARS);
  });

  it("the budget still holds with the notice on and a pick-up at its cap", () => {
    const s = stateWith([], [{ ...handoff("u-own", "sia-builder", 1, 5), pick_up: "Pick up ".repeat(300) } as Handoff]);
    const lines = renderBriefing(base(s, { budget: true, missingHandoff: NOTICE }));
    expect(lines.length).toBeLessThanOrEqual(BRIEFING_BUDGET.lines);
  });
});

describe("T-199 end to end through handleStart (opt-in: greeting.json missing_handoff)", () => {
  let tmp: string;
  afterEach(() => {
    rmSync(byPidDir(process.env.OPEN_BRAIN_ACTIVE_SESSION!), { recursive: true, force: true });
    try { rmSync(tmp, { recursive: true }); } catch { /* Windows race */ }
  });

  function proveOwn(id: string): void {
    writeProcessSession(byPidDir(process.env.OPEN_BRAIN_ACTIVE_SESSION!), {
      session_id: id, claude_pid: process.ppid, proc_start: processStartTime(process.ppid)!, ide: "claude",
      written_at: new Date().toISOString(),
    });
  }

  function project(stateText: string | null, flags: Record<string, boolean | undefined> | null): void {
    tmp = mkdtempSync(join(tmpdir(), "ob-t199-"));
    mkdirSync(join(tmp, ".agents", "SESSIONS"), { recursive: true });
    mkdirSync(join(tmp, ".agents", "SYSTEM"), { recursive: true });
    writeFileSync(join(tmp, "package.json"), JSON.stringify({ version: "1.0.0" }));
    writeFileSync(join(tmp, ".agents", "SESSIONS", "SESSION_TEMPLATE.md"), "template");
    if (stateText !== null) writeFileSync(join(tmp, ".agents", "state.json"), stateText);
    if (flags !== null) writeFileSync(join(tmp, ".agents", "SYSTEM", "greeting.json"), JSON.stringify(flags));
  }

  const record = (sessions: SessionRecord[], handoffs: Handoff[]): string => JSON.stringify(stateWith(sessions, handoffs), null, 2);
  const briefingOf = (text: string): string => text.slice(text.indexOf(BRIEFING_START), text.indexOf(BRIEFING_END));

  it.each([[false], [true]])("flag ON (briefing_budget %s): the Briefing names this checkout's last session; the proven CURRENT session is not counted", async (budget) => {
    project("{}", { missing_handoff: true, briefing_budget: budget });
    const checkout = basename(tmp);
    writeFileSync(join(tmp, ".agents", "state.json"), record([session(7, "uuid-prev", checkout, 10), session(8, "uuid-current", checkout, 20)], [handoff("uuid-prev", checkout, 10, 7)]));
    proveOwn("uuid-current");
    expect(briefingOf((await handleStart({ project_root: tmp })).content[0].text)).not.toContain(MISSING);

    writeFileSync(join(tmp, ".agents", "state.json"), record([session(7, "uuid-prev", checkout, 10), session(8, "uuid-current", checkout, 20)], []));
    const named = briefingOf((await handleStart({ project_root: tmp })).content[0].text);
    expect(named).toContain(`${MISSING} last`);
    expect(named).toContain("#7 (uuid-prev, rev 10)");
    expect(named).not.toContain("uuid-current");
  });

  it("flag OFF or absent: no Handoff line anywhere, though the condition holds (A2A's render is unchanged)", async () => {
    for (const flags of [null, {}, { missing_handoff: false }] as const) {
      project("{}", flags);
      const checkout = basename(tmp);
      writeFileSync(join(tmp, ".agents", "state.json"), record([session(7, "uuid-prev", checkout, 10)], []));
      proveOwn("uuid-current");
      const out = (await handleStart({ project_root: tmp })).content[0].text;
      expect(out).not.toContain("Handoff MISSING");
      expect(out).not.toContain(NOT_CHECKED);
      rmSync(tmp, { recursive: true, force: true });
    }
  });

  it("flag ON and the record unreadable: says it did not check, in the prose fallback", async () => {
    project("{ not json", { missing_handoff: true });
    proveOwn("uuid-current");
    const out = (await handleStart({ project_root: tmp })).content[0].text;
    expect(out).toContain(`${NOT_CHECKED} (state.json invalid, so there is no record to read)`);
  });

  it("A2A's record (a2a-state-1c200b41): flag absent prints no Handoff line; flag on equals the pure check on the same record", async () => {
    const a2a = readFileSync(join(import.meta.dirname, "../../fixtures-state/a2a-state-1c200b41.json"), "utf8");
    const parsed = parseState(a2a);
    if (!parsed.ok) throw new Error(parsed.error);
    project(a2a, null);
    proveOwn("uuid-current");
    const off = (await handleStart({ project_root: tmp })).content[0].text;
    expect(off).not.toContain("Handoff MISSING");
    expect(off).not.toContain(NOT_CHECKED);

    writeFileSync(join(tmp, ".agents", "SYSTEM", "greeting.json"), JSON.stringify({ missing_handoff: true }));
    const on = (await handleStart({ project_root: tmp })).content[0].text;
    const expected = missingHandoffLine(parsed.data, { projectRoot: tmp, sessionUuid: "uuid-current" });
    expect(checkMissingHandoff(parsed.data, { projectRoot: tmp, sessionUuid: "uuid-current" }).kind).toBe(expected === null ? "clear" : expected.startsWith(MISSING) ? "missing" : "not-checked");
    expect(on.includes(expected ?? "\u0000never")).toBe(expected !== null);
  });
});
