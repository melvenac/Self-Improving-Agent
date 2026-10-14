import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, cpSync, rmSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { applyStateOps } from "../../src/shared/state-writer.js";

/**
 * T-271: an ob_state refusal names EVERY issue of each invalid op and prints that op's expected shape, so a seat learns an
 * op's shape in one round trip, not one field per attempt (Prism, session 1: four dry-run refusals in 70 s).
 */
const fixturesDir = join(import.meta.dirname, "../fixtures");
const stateFixture = join(import.meta.dirname, "../fixtures-state/state.json");
const STATE = ".agents/state.json";
const SESSION = 55; // the fixture's last session is 54
const UUID = "u-t271";

const ADD_VERIFIED_SHAPE = `{op: "add_verified", id?: string, claim: string (non-empty), evidence: [{type: string, path: string, observation: string}] (non-empty)}`;
const SET_HANDOFF_SHAPE = String.raw`{op: "set_handoff", seat: "planner"|"developer"|"qa", pick_up: string, watch_out: [string | {text: string (non-empty), expires?: integer (> 0) | string (matching /^\d{4}-\d{2}-\d{2}$/)}], open_questions: [string | {text: string (non-empty), resolved_by?: string (non-empty), owner?: string (non-empty)}], loop_state?: {open_prs: [{ref: string (non-empty), qa_status: "not_started"|"in_progress"|"accepted"|"rejected"|"not_required", note: string}], frozen_sha: string | null, questions_for_aaron: [string], rulings: [string]} | null}`;
const UPDATE_TASK_SHAPE = `{op: "update_task", id: string, title?: string (non-empty), priority?: "P0"|"P1"|"P2"|"P3", status?: "open"|"in_progress"|"blocked", assignee?: string (non-empty) | null, append_note?: string (non-empty), replace_note?: string, replace_other_sessions?: true}`;
const OP_NAMES = "open_task, update_task, close_task, reopen_task, add_verified, reopen_verified, add_gap, update_gap, close_gap, reopen_gap, add_decision, set_standing, set_objective, set_handoff";

// Prism's first attempt, reconstructed from the planner's evaluation (the transcript stays out of this public repo): the
// claim under the wrong key, the evidence as a string, and the planner handoff's loop_state as a string.
const ATTEMPT_1 = [
  { op: "add_verified", what: "PR #1 merged", evidence: "PR #1 merged" },
  { op: "set_handoff", seat: "planner", pick_up: "x", watch_out: [], open_questions: [], loop_state: "idle" },
];
const FIXED = [
  { op: "add_verified", claim: "PR #1 merged", evidence: [{ type: "pr", path: "#1", observation: "merged" }] },
  { op: "set_handoff", seat: "planner", pick_up: "x", watch_out: [], open_questions: [], loop_state: { open_prs: [], frozen_sha: null, questions_for_aaron: [], rulings: [] } },
];

describe("T-271 an ob_state refusal names every issue and the op's shape", () => {
  let root: string;
  let before: string;
  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), "ob-t271-"));
    cpSync(fixturesDir, root, { recursive: true });
    cpSync(stateFixture, join(root, STATE));
    before = readFileSync(join(root, STATE), "utf-8");
  });
  afterEach(() => {
    rmSync(root, { recursive: true, force: true, maxRetries: 3, retryDelay: 50 });
  });
  const write = (ops: unknown[], dry_run = false) =>
    applyStateOps(root, { session: SESSION, expected_revision: 7, ops, dry_run, session_uuid: UUID });

  it("A1 Prism's first attempt: one refusal names every issue of both ops, each with its shape", () => {
    const r = write(ATTEMPT_1);
    expect(r.ok).toBe(false);
    expect(r.error!.split("\n")).toEqual([
      "ops[0] invalid at claim: Invalid input: expected string, received undefined",
      `  ops[0] add_verified: 3 issues: claim: Invalid input: expected string, received undefined; evidence: Invalid input: expected array, received string; $: Unrecognized key: "what"`,
      `  ops[0] add_verified expects: ${ADD_VERIFIED_SHAPE}`,
      "  ops[1] invalid at loop_state: Invalid input: expected object, received string",
      `  ops[1] set_handoff expects: ${SET_HANDOFF_SHAPE}`,
    ]);
    expect(readFileSync(join(root, STATE), "utf-8")).toBe(before);
  });

  it("A2 evidence entries that are not objects: every entry is named", () => {
    const r = write([{ op: "add_verified", claim: "PR #1 merged", evidence: ["PR #1 merged", "CI green"] }]);
    expect(r.error!.split("\n")).toEqual([
      "ops[0] invalid at evidence.0: Invalid input: expected object, received string",
      "  ops[0] add_verified: 2 issues: evidence.0: Invalid input: expected object, received string; evidence.1: Invalid input: expected object, received string",
      `  ops[0] add_verified expects: ${ADD_VERIFIED_SHAPE}`,
    ]);
  });

  it("A3 the fixed batch passes a dry run (a valid batch is unchanged)", () => {
    const r = write(FIXED, true);
    expect(r.ok, r.error).toBe(true);
    expect(r.error).toBeUndefined();
    expect(r.applied.map((a) => a.op)).toEqual(["add_verified", "set_handoff"]);
    expect(readFileSync(join(root, STATE), "utf-8")).toBe(before);
  });

  it("A4 a dry run refuses with the same text as a write", () => {
    const wet = write(ATTEMPT_1);
    const dry = write(ATTEMPT_1, true);
    expect(dry.ok).toBe(false);
    expect(dry.dry_run).toBe(true);
    expect(dry.error).toBe(wet.error);
    expect(dry.error).toContain("  ops[1] set_handoff expects: ");
  });

  it("A5 an unknown op names the ops there are", () => {
    const r = write([{ op: "delete_everything" }]);
    expect(r.error!.split("\n")).toEqual(["ops[0] invalid at op: Invalid input", `  ops[0] op must be one of: ${OP_NAMES}`]);
  });

  it("A6 a retired field still refuses first, and the rest of the op is checked too", () => {
    const r = write([{ op: "update_task", id: "T-001", note: "x", priority: "P9" }]);
    const lines = r.error!.split("\n");
    expect(lines[0]).toMatch(/^ops\[0\] \(update_task\): `note` is retired on update_task \(T-171\)/);
    expect(lines.slice(1)).toEqual([
      `  ops[0] update_task: 1 issue: priority: Invalid option: expected one of "P0"|"P1"|"P2"|"P3"`,
      `  ops[0] update_task expects: ${UPDATE_TASK_SHAPE}`,
    ]);
  });

  it("A7 an op with more than 8 issues lists 8 and counts the rest", () => {
    const r = write([{ op: "set_handoff", seat: "x", pick_up: 1, watch_out: [1, 2, 3, 4, 5, 6, 7, 8], open_questions: 0 }]);
    expect(r.error!.split("\n")).toEqual([
      `ops[0] invalid at seat: Invalid option: expected one of "planner"|"developer"|"qa"`,
      `  ops[0] set_handoff: 11 issues: seat: Invalid option: expected one of "planner"|"developer"|"qa"; pick_up: Invalid input: expected string, received number; watch_out.0: Invalid input; watch_out.1: Invalid input; watch_out.2: Invalid input; watch_out.3: Invalid input; watch_out.4: Invalid input; watch_out.5: Invalid input; and 3 more`,
      `  ops[0] set_handoff expects: ${SET_HANDOFF_SHAPE}`,
    ]);
  });

  it("A8 a batch with more than 5 invalid ops describes 5 and counts the rest", () => {
    const r = write(Array.from({ length: 7 }, () => ({ op: "close_gap" })));
    const lines = r.error!.split("\n");
    expect(lines).toHaveLength(11);
    expect(lines[0]).toBe("ops[0] invalid at id: Invalid input: expected string, received undefined");
    expect(lines[1]).toBe(`  ops[0] close_gap expects: {op: "close_gap", id: string}`);
    expect(lines[8]).toBe("  ops[4] invalid at id: Invalid input: expected string, received undefined");
    expect(lines[9]).toBe(`  ops[4] close_gap expects: {op: "close_gap", id: string}`);
    expect(lines[10]).toBe("  and 2 more invalid op(s) not shown");
    expect(r.error).not.toContain("ops[5]");
  });

  it("A9 a semantic refusal still names its one op, as before T-271", () => {
    const r = write([{ op: "close_task", id: "T-999" }, { op: "set_handoff" }]);
    expect(r.error).toBe("ops[0] (close_task): unknown task T-999");
  });

  it("A10 the ob_state description says what a refusal carries", () => {
    const server = readFileSync(join(import.meta.dirname, "../../src/server.ts"), "utf-8");
    const line = server.split("\n").find((l) => l.includes("Write .agents/state.json through typed operations"));
    expect(line).toContain("A refusal lists every invalid field of an invalid op");
    expect(line).toContain("prints that op's expected shape");
  });
});
