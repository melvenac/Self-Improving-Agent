import { describe, it, expect, afterEach } from "vitest";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, readFileSync } from "node:fs";
import { join, basename } from "node:path";
import { tmpdir } from "node:os";
import { renderState } from "../../../src/pipelines/session-start/state-render.js";
import { handleStart } from "../../../src/server.js";
import { byPidDir, processStartTime, writeProcessSession } from "../../../src/shared/process-session.js";
import type { Handoff, SessionRecord, State } from "../../../src/shared/state-schema.js";
import { readRepoRecord, REPO_ROOT } from "../../helpers/repo-record.js";

/**
 * T-199. A seat session that wrote the record but left no handoff is DETECTED at
 * that checkout's next /start. Sessions are attributed by CHECKOUT (the
 * project-root basename the writer stamps), not by seat: a session that never
 * called set_handoff has seat null, and that null is exactly the case detected.
 */
const MISSING = "Handoff MISSING:";

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

function text(state: State, opts: Record<string, unknown> = {}): string {
  return renderState(state, "0.0.0", { seat: "developer", projectRoot: join(tmpdir(), "sia-forge"), ...opts }).join("\n");
}

describe("T-199 HO-1: the last session of this checkout wrote the record and left no handoff", () => {
  it("prints one line naming the seat, number, uuid, checkout and first write revision", () => {
    const s = stateWith([session(12, "uuid-b", "sia-forge", 30)], []);
    const out = text(s);
    expect(out).toContain(
      `${MISSING} the last developer session (#12, uuid-b, checkout sia-forge, first write rev 30) wrote the record but left no handoff`,
    );
    expect(out.split(MISSING).length - 1).toBe(1);
  });

  it("names the NEWEST session when an older one has a handoff and the newest does not", () => {
    const s = stateWith(
      [session(11, "uuid-a", "sia-forge", 20), session(12, "uuid-b", "sia-forge", 30)],
      [handoff("uuid-a", "sia-forge", 20, 11)],
    );
    const out = text(s);
    expect(out).toContain("(#12, uuid-b, checkout sia-forge");
    expect(out).not.toContain("uuid-a, checkout");
  });

  it("orders by first_rev, not by the order sessions[] happens to list them", () => {
    const s = stateWith(
      [session(12, "uuid-b", "sia-forge", 30), session(11, "uuid-a", "sia-forge", 20)],
      [handoff("uuid-a", "sia-forge", 20, 11)],
    );
    expect(text(s)).toContain("(#12, uuid-b, checkout sia-forge");
  });

  it("a handoff that exists for a DIFFERENT session does not satisfy it: a matching session_uuid is required", () => {
    const s = stateWith(
      [session(12, "uuid-b", "sia-forge", 30)],
      [handoff("uuid-other", "sia-forge", 31, 12)],
    );
    expect(text(s)).toContain(MISSING);
  });

  it("is printed when handoffs[] is EMPTY, not only beside the handoff listing", () => {
    const s = stateWith([session(3, "uuid-c", "sia-forge", 5)], []);
    expect(s.handoffs).toHaveLength(0);
    expect(text(s)).toContain(MISSING);
  });

  it("labels the line with the checkout when the reader's seat is unresolved", () => {
    const s = stateWith([session(12, "uuid-b", "sia-forge", 30)], []);
    expect(text(s, { seat: null })).toContain(`${MISSING} the last sia-forge session (#12`);
  });

  it("does not count the CURRENT session: it has written but its handoff is not due yet", () => {
    const s = stateWith(
      [session(11, "uuid-a", "sia-forge", 20), session(12, "uuid-cur", "sia-forge", 30)],
      [handoff("uuid-a", "sia-forge", 20, 11)],
    );
    expect(text(s, { sessionUuid: "uuid-cur" })).not.toContain(MISSING);
    const prior = stateWith(
      [session(11, "uuid-a", "sia-forge", 20), session(12, "uuid-cur", "sia-forge", 30)],
      [],
    );
    expect(text(prior, { sessionUuid: "uuid-cur" })).toContain("(#11, uuid-a, checkout sia-forge");
  });
});

describe("T-199 HO-2: no line when nothing is missing", () => {
  it("the last session's handoff exists", () => {
    const s = stateWith([session(12, "uuid-b", "sia-forge", 30)], [handoff("uuid-b", "sia-forge", 30, 12)]);
    expect(text(s)).not.toContain(MISSING);
  });

  it("an older session lacks a handoff but a newer one has one: only the last counts", () => {
    const s = stateWith(
      [session(11, "uuid-a", "sia-forge", 20), session(12, "uuid-b", "sia-forge", 30)],
      [handoff("uuid-b", "sia-forge", 30, 12)],
    );
    expect(text(s)).not.toContain(MISSING);
  });

  it("another checkout's session without a handoff is not this checkout's", () => {
    const s = stateWith(
      [session(12, "uuid-b", "sia-forge", 30), session(13, "uuid-x", "sia-builder", 40)],
      [handoff("uuid-b", "sia-forge", 30, 12)],
    );
    expect(text(s)).not.toContain(MISSING);
    // "Last session" still names uuid-x on its own line; what must not appear is the missing-handoff form.
    expect(text(s)).not.toContain("uuid-x, checkout");
  });

  it("legacy sessions (null checkout or null uuid) cannot be attributed and are never named", () => {
    const s = stateWith([session(9, "uuid-old", null, null), session(10, null, "sia-forge", 12)], []);
    expect(text(s)).not.toContain(MISSING);
  });

  it("with no project root the checkout is unknown, so nothing is detected", () => {
    const s = stateWith([session(12, "uuid-b", "sia-forge", 30)], []);
    expect(renderState(s, "0.0.0", { seat: "developer" }).join("\n")).not.toContain(MISSING);
  });
});

describe("T-199 end to end through handleStart", () => {
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

  function project(sessions: SessionRecord[], handoffs: Handoff[]): void {
    tmp = mkdtempSync(join(tmpdir(), "ob-t199-"));
    mkdirSync(join(tmp, ".agents", "SESSIONS"), { recursive: true });
    writeFileSync(join(tmp, "package.json"), JSON.stringify({ version: "1.0.0" }));
    writeFileSync(join(tmp, ".agents", "SESSIONS", "SESSION_TEMPLATE.md"), "template");
    writeFileSync(join(tmp, ".agents", "state.json"), JSON.stringify(stateWith(sessions, handoffs), null, 2));
  }

  it("ob_start prints the line for this checkout's last session, and the proven CURRENT session is not counted", async () => {
    project([], []);
    const checkout = basename(tmp);
    writeFileSync(
      join(tmp, ".agents", "state.json"),
      JSON.stringify(stateWith([session(7, "uuid-prev", checkout, 10), session(8, "uuid-current", checkout, 20)], [handoff("uuid-prev", checkout, 10, 7)]), null, 2),
    );
    proveOwn("uuid-current");
    const withoutSelf = (await handleStart({ project_root: tmp })).content[0].text;
    expect(withoutSelf).not.toContain(MISSING);

    writeFileSync(
      join(tmp, ".agents", "state.json"),
      JSON.stringify(stateWith([session(7, "uuid-prev", checkout, 10), session(8, "uuid-current", checkout, 20)], []), null, 2),
    );
    const named = (await handleStart({ project_root: tmp })).content[0].text;
    expect(named).toContain(`${MISSING} the last`);
    expect(named).toContain(`(#7, uuid-prev, checkout ${checkout}`);
    expect(named).not.toContain("uuid-current, checkout");
  });
});

describe("T-199 HO-3: planner.md no longer tells a planner there is one handoff slot", () => {
  const planner = readFileSync(join(REPO_ROOT, ".agents", "roles", "planner.md"), "utf8");

  it("the stale 'one handoff slot / unfixed' paragraph is gone", () => {
    expect(planner).not.toMatch(/one `?handoff`? slot/);
    expect(planner).not.toMatch(/unfixed/);
  });

  it("it names set_handoff and the per-seat, per-checkout entry", () => {
    expect(planner).toContain("set_handoff");
    expect(planner).toMatch(/per seat|each seat|per-seat/);
  });
});
