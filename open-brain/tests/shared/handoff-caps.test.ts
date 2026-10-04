import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, cpSync, rmSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { applyStateOps } from "../../src/shared/state-writer.js";
import { HANDOFF_CAPS, handoffCapViolations } from "../../src/shared/handoff-caps.js";
import { parseState, type State } from "../../src/shared/state-schema.js";

/**
 * T-236 slice 2 (a) and (e): the handoff caps are enforced by the WRITER, only where a repo opted in (`handoff_caps`), and only on the
 * entry being written. `expires` and `owner` are optional in the schema either way. Fixtures are a real copy of the state fixture;
 * nothing here reads a real repo.
 */
const fixturesDir = join(import.meta.dirname, "../fixtures");
const stateFixture = join(import.meta.dirname, "../fixtures-state/state.json");
const STATE = ".agents/state.json";
const SESSION = 55;

const read = (root: string): State => {
  const r = parseState(readFileSync(join(root, STATE), "utf-8"));
  if (!r.ok) throw new Error(r.error);
  return r.data;
};
const oneLine = (n: number): string => "w".repeat(n);

describe("T-236 slice 2: handoff caps (writer) and the optional expires / owner fields", () => {
  let root: string;
  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), "t236-caps-"));
    cpSync(fixturesDir, root, { recursive: true });
    cpSync(stateFixture, join(root, STATE));
  });
  afterEach(() => rmSync(root, { recursive: true, force: true }));

  const write = (handoff: { pick_up?: string; watch_out?: unknown[]; open_questions?: unknown[] }, opts: { caps?: boolean; uuid?: string; dry?: boolean; session?: number } = {}) => {
    const rev = read(root).revision;
    return applyStateOps(root, {
      session: opts.session ?? SESSION,
      expected_revision: rev,
      session_uuid: opts.uuid ?? "u-1",
      checkout: "sia-forge",
      dry_run: opts.dry,
      handoff_caps: opts.caps,
      ops: [{ op: "set_handoff", seat: "developer", pick_up: handoff.pick_up ?? "Here", watch_out: handoff.watch_out ?? [], open_questions: handoff.open_questions ?? [] }],
    });
  };

  it("the optional fields: a watch-out object with a session or ISO-date expiry, and a question owner, are accepted and stored as written", () => {
    const r = write({
      watch_out: ["plain", { text: "until 162", expires: 162 }, { text: "until the 12th", expires: "2026-10-12" }, { text: "no expiry" }],
      open_questions: ["plain q", { text: "Aaron's call", owner: "aaron" }, { text: "both", owner: "aaron", resolved_by: "D-1" }],
    });
    expect(r.ok, r.error).toBe(true);
    const h = read(root).handoffs.find((x) => x.session_uuid === "u-1")!;
    expect(h.watch_out).toEqual(["plain", { text: "until 162", expires: 162 }, { text: "until the 12th", expires: "2026-10-12" }, { text: "no expiry" }]);
    expect(h.open_questions).toEqual(["plain q", { text: "Aaron's call", owner: "aaron" }, { text: "both", owner: "aaron", resolved_by: "D-1" }]);
  });

  it.each([
    ["an unknown key on a watch-out", { text: "x", expries: 3 }],
    ["an empty watch-out text", { text: "" }],
    ["a zero session expiry", { text: "x", expires: 0 }],
    ["a negative session expiry", { text: "x", expires: -4 }],
    ["a fractional session expiry", { text: "x", expires: 1.5 }],
    ["a non-date string expiry", { text: "x", expires: "tomorrow" }],
  ])("%s is refused by the schema, caps on or off", (_n, bad) => {
    for (const caps of [false, true]) {
      const r = write({ watch_out: [bad] }, { caps });
      expect(r.ok).toBe(false);
    }
  });

  it.each([
    ["an empty owner", { text: "q", owner: "" }],
    ["an unknown key on a question", { text: "q", ownr: "aaron" }],
  ])("%s is refused by the schema", (_n, bad) => {
    expect(write({ open_questions: [bad] }).ok).toBe(false);
  });

  it("OFF (the default, and A2A's state): a seventeen-watch-out, multi-line, 2 KB-pick_up handoff is accepted untouched", () => {
    const many = Array.from({ length: 17 }, (_, i) => `watch-out ${i}: ${oneLine(600)}\nsecond line`);
    const pick = "p".repeat(2000);
    for (const caps of [undefined, false]) {
      const r = write({ pick_up: pick, watch_out: many }, { caps });
      expect(r.ok, r.error).toBe(true);
    }
    const h = read(root).handoffs.find((x) => x.session_uuid === "u-1")!;
    expect(h.watch_out).toEqual(many);
    expect(h.pick_up).toBe(pick);
  });

  it("ON: exactly at the caps is accepted (3 watch-outs of 200 chars, pick_up of 400)", () => {
    const r = write({ pick_up: "p".repeat(HANDOFF_CAPS.pickUpChars), watch_out: [oneLine(200), { text: oneLine(200), expires: 170 }, oneLine(200)] }, { caps: true });
    expect(r.ok, r.error).toBe(true);
  });

  it("ON: a fourth watch-out is refused, naming the count and the cap, and NOTHING is written", () => {
    const before = readFileSync(join(root, STATE), "utf-8");
    const r = write({ watch_out: ["a", "b", "c", "d"] }, { caps: true });
    expect(r.ok).toBe(false);
    expect(r.error).toContain("handoff_caps is on for this repo");
    expect(r.error).toContain("4 watch-outs, the cap is 3");
    expect(readFileSync(join(root, STATE), "utf-8")).toBe(before);
  });

  it("ON: a watch-out over 200 chars is refused, naming which one and how long", () => {
    const r = write({ watch_out: ["ok", oneLine(201)] }, { caps: true });
    expect(r.ok).toBe(false);
    expect(r.error).toContain("watch-out 2 is 201 chars, the cap is 200");
  });

  it("ON: a watch-out that spans lines is refused, in a string or in an object", () => {
    expect(write({ watch_out: ["one\ntwo"] }, { caps: true }).error).toContain("watch-out 1 spans more than one line");
    expect(write({ watch_out: ["fine", { text: "a\r\nb", expires: 170 }] }, { caps: true }).error).toContain("watch-out 2 spans more than one line");
  });

  it("ON: a pick_up over 400 chars is refused, naming its length", () => {
    const r = write({ pick_up: "p".repeat(401) }, { caps: true });
    expect(r.ok).toBe(false);
    expect(r.error).toContain("pick_up is 401 chars, the cap is 400");
  });

  it("ON: every violation is named in one refusal, not just the first", () => {
    const r = write({ pick_up: "p".repeat(500), watch_out: ["a", "b", "c", oneLine(250)] }, { caps: true });
    expect(r.error).toContain("pick_up is 500 chars");
    expect(r.error).toContain("4 watch-outs, the cap is 3");
    expect(r.error).toContain("watch-out 4 is 250 chars");
  });

  it("ON: a dry run is refused the same way, so the caller learns before writing", () => {
    expect(write({ watch_out: ["a", "b", "c", "d"] }, { caps: true, dry: true }).ok).toBe(false);
  });

  it("ON never reaches back: an over-cap handoff already in the record is left byte for byte, and another seat's compliant write is accepted beside it", () => {
    const many = Array.from({ length: 12 }, (_, i) => `old ${i}: ${oneLine(400)}`);
    expect(write({ pick_up: "q".repeat(900), watch_out: many }, { uuid: "old-session" }).ok).toBe(true);
    const old = read(root).handoffs.find((x) => x.session_uuid === "old-session")!;

    const r = write({ pick_up: "short", watch_out: ["one"] }, { caps: true, uuid: "new-session", session: SESSION + 1 });
    expect(r.ok, r.error).toBe(true);
    const after = read(root);
    expect(after.handoffs.find((x) => x.session_uuid === "old-session")).toEqual(old);
    expect(after.handoffs.find((x) => x.session_uuid === "new-session")!.watch_out).toEqual(["one"]);

    // and an op that is not a handoff is not subject to the caps at all
    const t = applyStateOps(root, { session: SESSION + 1, expected_revision: after.revision, session_uuid: "new-session", checkout: "sia-forge", handoff_caps: true, ops: [{ op: "open_task", title: "unrelated", priority: "P3" }] });
    expect(t.ok, t.error).toBe(true);
  });

  it("handoffCapViolations is empty for a handoff within the caps, and counts an object's text, not its keys", () => {
    expect(handoffCapViolations("p", [])).toEqual([]);
    expect(handoffCapViolations("p", [{ text: oneLine(200), expires: 3 }])).toEqual([]);
    expect(handoffCapViolations("p", [{ text: oneLine(201), expires: 3 }])).toHaveLength(1);
  });
});
