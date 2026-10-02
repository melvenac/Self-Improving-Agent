import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync, writeFileSync, mkdirSync, cpSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { sessionStart } from "../../../src/pipelines/session-start/index.js";
import { findNextSessionNumber, nextGreetingSessionNumber } from "../../../src/pipelines/session-start/session-log.js";
import { applyStateOps } from "../../../src/shared/state-writer.js";
import { readProjectState } from "../../../src/pipelines/session-start/state-reader.js";

describe("T-164 SC-1 — greeting number from the record", () => {
  let root: string;

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), "t164-sc1-"));
    mkdirSync(join(root, ".agents", "SESSIONS"), { recursive: true });
    for (let i = 1; i <= 6; i++) {
      writeFileSync(join(root, ".agents", "SESSIONS", `Session_${i}.md`), `# Session ${i}\n`);
    }
    const state = {
      schema_version: 3,
      revision: 1,
      project: { name: "fixture" },
      objective: null,
      tasks: [],
      verified: [],
      gaps: [],
      decisions: [],
      handoffs: [],
      sessions: [{ n: 76, date: "2026-09-28", uuid: "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee", seat: "planner", checkout: "sia-planner", first_rev: 1 }],
    };
    writeFileSync(join(root, ".agents", "state.json"), `${JSON.stringify(state, null, 2)}\n`, "utf-8");
  });

  afterEach(() => rmSync(root, { recursive: true, force: true }));

  it("local logs say 6 and the record says 76 → greeting is 77 and Session_77.md is created", () => {
    const state = readProjectState(root);
    expect(nextGreetingSessionNumber(root, state.stateJson)).toEqual({ sessionNumber: 77, source: "record" });

    const r = sessionStart({ projectRoot: root, homePath: root, sessionId: "11111111-1111-1111-1111-111111111111" });
    expect(r.session.sessionNumber).toBe(77);
    expect(r.session.sessionNumberSource).toBe("record");
    expect(r.session.logPath).toContain("Session_77.md");
  });
});

describe("T-164 SC-2 — provisional number until first write", () => {
  let root: string;
  const STATE = join(".agents", "state.json");

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), "t164-sc2-"));
    cpSync(join(import.meta.dirname, "../../fixtures"), root, { recursive: true });
    const state = {
      schema_version: 3,
      revision: 0,
      project: { name: "fixture" },
      objective: null,
      tasks: [],
      verified: [],
      gaps: [],
      decisions: [],
      handoffs: [],
      sessions: [],
    };
    writeFileSync(join(root, STATE), `${JSON.stringify(state, null, 2)}\n`, "utf-8");
  });

  afterEach(() => rmSync(root, { recursive: true, force: true }));

  it("two checkouts at the same rev greet the same next number", () => {
    const a = nextGreetingSessionNumber(root, readProjectState(root).stateJson);
    const b = nextGreetingSessionNumber(root, readProjectState(root).stateJson);
    expect(a).toEqual({ sessionNumber: 1, source: "record" });
    expect(b).toEqual(a);
  });

  it("refuses a write when session n is held by a different uuid, naming the next free n", () => {
    const first = applyStateOps(root, {
      expected_revision: 0,
      session: 1,
      session_uuid: "uuid-a",
      checkout: "sia-planner",
      ops: [{ op: "set_objective", text: "test" }],
    });
    expect(first.ok).toBe(true);

    const second = applyStateOps(root, {
      expected_revision: 1,
      session: 1,
      session_uuid: "uuid-b",
      checkout: "sia-planner",
      ops: [{ op: "set_objective", objective: "collision" }],
    });
    expect(second.ok).toBe(false);
    expect(second.error).toContain("uuid-a");
    expect(second.error).toContain("next free number is 2");
  });

  // QA 249 F1 (D-095): on the live-shaped sparse record the refusal must name the
  // same number the greeting does, max(n)+1, never the lowest unused n.
  it("on a sparse record (76, 147..155) the refusal names max(n)+1, the number the greeting names", () => {
    const ns = [76, 147, 148, 149, 150, 151, 152, 153, 154, 155];
    const sessions = ns.map((n, i) => ({
      n, date: "2026-10-01", uuid: `cccccccc-0000-4000-8000-${String(n).padStart(12, "0")}`, seat: "planner", checkout: "sia-planner", first_rev: i + 1,
    }));
    const state = { schema_version: 3, revision: 300, project: { name: "fixture" }, objective: null, tasks: [], verified: [], gaps: [], decisions: [], handoffs: [], sessions };
    writeFileSync(join(root, STATE), `${JSON.stringify(state, null, 2)}\n`, "utf-8");

    const greeting = nextGreetingSessionNumber(root, readProjectState(root).stateJson).sessionNumber;
    expect(greeting).toBe(156);
    const refused = applyStateOps(root, {
      expected_revision: 300,
      session: 155,
      session_uuid: "uuid-late",
      checkout: "sia-planner",
      ops: [{ op: "set_objective", text: "collision" }],
    });
    expect(refused.ok).toBe(false);
    expect(refused.error).toContain(`next free number is ${greeting}`);
  });
});

describe("T-164 SC-3 — local fallback without state.json", () => {
  let root: string;

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), "t164-sc3-"));
    mkdirSync(join(root, ".agents", "SESSIONS"), { recursive: true });
    writeFileSync(join(root, ".agents", "SESSIONS", "Session_1.md"), "");
    writeFileSync(join(root, ".agents", "SESSIONS", "Session_6.md"), "");
  });

  afterEach(() => rmSync(root, { recursive: true, force: true }));

  it("uses the local count and marks the source local", () => {
    const state = readProjectState(root);
    expect(state.stateJson.present).toBe(false);
    const r = sessionStart({ projectRoot: root, homePath: root, sessionId: "local-id" });
    expect(r.session.sessionNumber).toBe(7);
    expect(r.session.sessionNumberSource).toBe("local");
  });
});

describe("T-164 SC-5 — second ob_start reuses the log", () => {
  let root: string;

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), "t164-sc5-"));
    mkdirSync(join(root, ".agents", "SESSIONS"), { recursive: true });
    const state = {
      schema_version: 3,
      revision: 0,
      project: { name: "fixture" },
      objective: null,
      tasks: [],
      verified: [],
      gaps: [],
      decisions: [],
      handoffs: [],
      sessions: [],
    };
    writeFileSync(join(root, ".agents", "state.json"), `${JSON.stringify(state, null, 2)}\n`, "utf-8");
  });

  afterEach(() => rmSync(root, { recursive: true, force: true }));

  it("reuses the existing log for the same session id", () => {
    const first = sessionStart({ projectRoot: root, homePath: root, sessionId: "same-id" });
    const second = sessionStart({ projectRoot: root, homePath: root, sessionId: "same-id" });
    expect(second.session.reused).toBe(true);
    expect(second.session.sessionNumber).toBe(first.session.sessionNumber);
    expect(second.session.logPath).toBe(first.session.logPath);
  });
});

describe("T-164 live case — a checkout whose local logs say 17 greets the record's 156 (D-091 port)", () => {
  let root: string;

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), "t164-live-"));
    mkdirSync(join(root, ".agents", "SESSIONS"), { recursive: true });
    // Sixteen local logs: the local counter alone would greet 17.
    for (let i = 1; i <= 16; i++) {
      writeFileSync(join(root, ".agents", "SESSIONS", `Session_${i}.md`), `# Session ${i}\n`);
    }
    const sessions = [153, 154, 155].map((n) => ({
      n,
      date: "2026-10-01",
      uuid: `aaaaaaaa-bbbb-cccc-dddd-${String(n).padStart(12, "0")}`,
      seat: "planner",
      checkout: "sia-planner",
      first_rev: n,
    }));
    const state = { schema_version: 3, revision: 200, project: { name: "fixture" }, objective: null, tasks: [], verified: [], gaps: [], decisions: [], handoffs: [], sessions };
    writeFileSync(join(root, ".agents", "state.json"), `${JSON.stringify(state, null, 2)}\n`, "utf-8");
  });

  afterEach(() => rmSync(root, { recursive: true, force: true }));

  it("the local count is 17, the record's last session is 155, and the greeting is 156", () => {
    expect(findNextSessionNumber(root), "the precondition: the local counter says 17").toBe(17);
    const r = sessionStart({ projectRoot: root, homePath: root, sessionId: "22222222-2222-2222-2222-222222222222" });
    expect(r.session.sessionNumber).toBe(156);
    expect(r.session.sessionNumberSource).toBe("record");
    expect(r.session.logPath).toContain("Session_156.md");
  });
});
