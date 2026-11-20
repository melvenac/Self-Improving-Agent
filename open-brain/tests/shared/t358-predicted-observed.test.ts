/**
 * T-358: a task records its predicted effect before the change and its observed effect at close.
 *
 * `predicted` is written on open_task or update_task, `observed` on update_task or close_task. The writer keeps three
 * rules: no `observed` without `predicted`, no change to `predicted` once `observed` is set, and no close of a task
 * that has `predicted` and no `observed`. A task with neither field behaves exactly as before.
 */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, cpSync, rmSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { applyStateOps, opShape, type WriteResult } from "../../src/shared/state-writer.js";
import { parseState, serializeState } from "../../src/shared/state-schema.js";

const fixturesDir = join(import.meta.dirname, "../fixtures");
const stateFixture = join(import.meta.dirname, "../fixtures-state/state.json");
const STATE = ".agents/state.json";
const SESSION = 55; // the fixture's last session is 54
const UUID = "u-t358";

const PRED = "After this ships, a start with a read owed prints the reminder once.";
const PRED2 = "After this ships, the reminder prints once and never on a dry run.";
const OBS = "Held: printed once on the first applied write; a dry run printed nothing.";
const OBS2 = "Did not hold on the second start: the reminder printed twice.";

const NO_OBSERVED = (id: string) =>
  `${id} has a predicted effect and no observed effect: close it with observed: "<what happened>" (it may say the prediction did not hold, or was not measured and why)`;
const NO_PREDICTED = (id: string) => `${id} has no predicted effect to compare with; set predicted first`;
const PREDICTION_FIXED = (id: string) => `${id} already has an observed effect; a prediction cannot change after the result is recorded`;

const UPDATE_TASK_SHAPE = `{op: "update_task", id: string, title?: string (non-empty), priority?: "P0"|"P1"|"P2"|"P3", status?: "open"|"in_progress"|"blocked", assignee?: string (non-empty) | null, predicted?: string (non-empty), observed?: string (non-empty), append_note?: string (non-empty), replace_note?: string, replace_other_sessions?: true}`;
const CLOSE_TASK_SHAPE = `{op: "close_task", id: string, observed?: string (non-empty), append_note?: string (non-empty), replace_note?: string, replace_other_sessions?: true}`;

type RawTask = Record<string, unknown> & { id: string; status: string; note: string };

describe("T-358 a task's predicted and observed effect", () => {
  let root: string;
  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), "ob-t358-"));
    cpSync(fixturesDir, root, { recursive: true });
    cpSync(stateFixture, join(root, STATE));
  });
  afterEach(() => {
    rmSync(root, { recursive: true, force: true, maxRetries: 3, retryDelay: 50 });
  });

  const text = (): string => readFileSync(join(root, STATE), "utf-8");
  const raw = (): { revision: number; tasks: RawTask[] } => JSON.parse(text());
  const task = (id: string): RawTask => raw().tasks.find((t) => t.id === id)!;
  const write = (ops: unknown[], dry_run = false): WriteResult =>
    applyStateOps(root, { session: SESSION, expected_revision: raw().revision, ops, dry_run, session_uuid: UUID });
  /** A write that must be refused with exactly this text, leaving the file byte for byte. */
  const refused = (ops: unknown[], error: string): void => {
    const before = text();
    const r = write(ops);
    expect(r.ok).toBe(false);
    expect(r.error).toBe(error);
    expect(text()).toBe(before);
  };

  it("E1 a record with neither key is valid, and a write does not stamp the keys onto any task", () => {
    const parsed = parseState(text());
    expect(parsed.ok).toBe(true);
    expect(raw().tasks.some((t) => "predicted" in t || "observed" in t)).toBe(false);
    const r = write([{ op: "update_task", id: "T-008", title: "renamed" }]);
    expect(r.ok).toBe(true);
    expect(task("T-008").title).toBe("renamed");
    expect(raw().tasks.some((t) => "predicted" in t || "observed" in t)).toBe(false);
  });

  it("E2 open_task stores predicted and prints its size; without it the key is absent", () => {
    const r = write([{ op: "open_task", id: "T-900", title: "with a prediction", priority: "P2", predicted: PRED }, { op: "open_task", id: "T-901", title: "without one", priority: "P2" }]);
    expect(r.ok).toBe(true);
    expect(task("T-900").predicted).toBe(PRED);
    expect("observed" in task("T-900")).toBe(false);
    expect("predicted" in task("T-901")).toBe(false);
    expect(r.note_changes).toEqual([`T-900 predicted SET: ${PRED.length} chars`]);
  });

  it("E3 a dry run prints the same line and writes nothing", () => {
    const before = text();
    const r = write([{ op: "update_task", id: "T-008", predicted: PRED }], true);
    expect(r.ok).toBe(true);
    expect(r.dry_run).toBe(true);
    expect(r.note_changes).toEqual([`T-008 predicted SET: ${PRED.length} chars`]);
    expect(text()).toBe(before);
  });

  it("E4 update_task sets predicted, and replaces it while there is no observed", () => {
    const a = write([{ op: "update_task", id: "T-008", predicted: PRED }]);
    expect(a.ok).toBe(true);
    expect(task("T-008").predicted).toBe(PRED);
    const b = write([{ op: "update_task", id: "T-008", predicted: PRED2 }]);
    expect(b.ok).toBe(true);
    expect(task("T-008").predicted).toBe(PRED2);
    expect(b.note_changes).toEqual([`T-008 predicted SET: ${PRED2.length} chars`]);
    expect(task("T-008").status).toBe("open");
  });

  it("E5 update_task sets observed on a task that has predicted, and prints its size", () => {
    expect(write([{ op: "update_task", id: "T-008", predicted: PRED }]).ok).toBe(true);
    const r = write([{ op: "update_task", id: "T-008", observed: OBS }]);
    expect(r.ok).toBe(true);
    expect(task("T-008").predicted).toBe(PRED);
    expect(task("T-008").observed).toBe(OBS);
    expect(r.note_changes).toEqual([`T-008 observed SET: ${OBS.length} chars`]);
  });

  it("E6 predicted cannot change once observed is set", () => {
    expect(write([{ op: "update_task", id: "T-008", predicted: PRED }, { op: "update_task", id: "T-008", observed: OBS }]).ok).toBe(true);
    refused([{ op: "update_task", id: "T-008", predicted: PRED2 }], `ops[0] (update_task): ${PREDICTION_FIXED("T-008")}`);
    refused([{ op: "update_task", id: "T-008", predicted: PRED2, observed: OBS2 }], `ops[0] (update_task): ${PREDICTION_FIXED("T-008")}`);
    expect(task("T-008").predicted).toBe(PRED);
  });

  it("E7 observed without predicted is refused on update_task; both in one op are stored", () => {
    refused([{ op: "update_task", id: "T-008", observed: OBS }], `ops[0] (update_task): ${NO_PREDICTED("T-008")}`);
    const r = write([{ op: "update_task", id: "T-009", predicted: PRED, observed: OBS }]);
    expect(r.ok).toBe(true);
    expect(task("T-009").predicted).toBe(PRED);
    expect(task("T-009").observed).toBe(OBS);
    expect(r.note_changes).toEqual([`T-009 predicted SET: ${PRED.length} chars`, `T-009 observed SET: ${OBS.length} chars`]);
  });

  it("E8 observed without predicted is refused on close_task, and the task stays open", () => {
    refused([{ op: "close_task", id: "T-008", observed: OBS }], `ops[0] (close_task): ${NO_PREDICTED("T-008")}`);
    expect(task("T-008").status).toBe("open");
  });

  it("E9 close_task refuses a task that has predicted and no observed, with the exact text", () => {
    expect(write([{ op: "update_task", id: "T-008", predicted: PRED }]).ok).toBe(true);
    refused([{ op: "close_task", id: "T-008" }], `ops[0] (close_task): ${NO_OBSERVED("T-008")}`);
    refused([{ op: "close_task", id: "T-008", append_note: "merged" }], `ops[0] (close_task): ${NO_OBSERVED("T-008")}`);
    expect(task("T-008").status).toBe("open");
    expect(task("T-008").closed_session).toBeNull();
  });

  it("E10 close_task with observed in the same op closes the task and prints the size", () => {
    expect(write([{ op: "update_task", id: "T-008", predicted: PRED }]).ok).toBe(true);
    const rev = raw().revision;
    const r = write([{ op: "close_task", id: "T-008", observed: OBS2 }]);
    expect(r.ok).toBe(true);
    const t = task("T-008");
    expect(t.status).toBe("done");
    expect(t.closed_session).toBe(SESSION);
    expect(t.closed_rev).toBe(rev + 1);
    expect(t.predicted).toBe(PRED);
    expect(t.observed).toBe(OBS2);
    expect(r.note_changes).toEqual([`T-008 observed SET: ${OBS2.length} chars`]);
  });

  it("E11 a task whose observed was set earlier closes with no observed in the close op", () => {
    expect(write([{ op: "update_task", id: "T-008", predicted: PRED, observed: OBS }]).ok).toBe(true);
    const r = write([{ op: "close_task", id: "T-008" }]);
    expect(r.ok).toBe(true);
    expect(task("T-008").status).toBe("done");
    expect(task("T-008").observed).toBe(OBS);
    expect(r.note_changes).toEqual([]);
  });

  it("E12 a task with neither field closes exactly as before: no new key, no printed line", () => {
    const keysBefore = Object.keys(task("T-008"));
    const r = write([{ op: "close_task", id: "T-008" }]);
    expect(r.ok).toBe(true);
    expect(task("T-008").status).toBe("done");
    expect(Object.keys(task("T-008"))).toEqual(keysBefore);
    expect(r.note_changes).toEqual([]);
  });

  it("E13 the rules see earlier ops of the same batch, and a refused batch writes nothing", () => {
    refused([{ op: "update_task", id: "T-008", predicted: PRED }, { op: "close_task", id: "T-008" }], `ops[1] (close_task): ${NO_OBSERVED("T-008")}`);
    expect("predicted" in task("T-008")).toBe(false);
    const r = write([{ op: "update_task", id: "T-008", predicted: PRED }, { op: "close_task", id: "T-008", observed: OBS }]);
    expect(r.ok).toBe(true);
    expect(task("T-008").status).toBe("done");
    expect(r.note_changes).toEqual([`T-008 predicted SET: ${PRED.length} chars`, `T-008 observed SET: ${OBS.length} chars`]);
  });

  it("E14 the ops stay strict: a misspelt key, a field on the wrong op and an empty value are refused", () => {
    const bad: Array<[unknown, string]> = [
      [{ op: "open_task", id: "T-900", title: "x", priority: "P2", predict: PRED }, "open_task"],
      [{ op: "open_task", id: "T-900", title: "x", priority: "P2", observed: OBS }, "open_task"],
      [{ op: "close_task", id: "T-008", predicted: PRED }, "close_task"],
      [{ op: "update_task", id: "T-008", predicted: "" }, "update_task"],
      [{ op: "close_task", id: "T-008", observed: "" }, "close_task"],
    ];
    for (const [op, name] of bad) {
      const before = text();
      const r = write([op]);
      expect(r.ok, JSON.stringify(op)).toBe(false);
      expect(r.error).toMatch(/^ops\[0\] invalid at /);
      expect(r.error).toContain(`  ops[0] ${name} expects: `);
      expect(text()).toBe(before);
    }
    expect(write([{ op: "open_task", id: "T-900", title: "x", priority: "P2", predict: PRED }]).error).toContain(`Unrecognized key: "predict"`);
  });

  it("E15 the expected shape a refusal prints names the new fields on each op", () => {
    expect(opShape("update_task")).toBe(UPDATE_TASK_SHAPE);
    expect(opShape("close_task")).toBe(CLOSE_TASK_SHAPE);
    const open = opShape("open_task")!;
    expect(open.endsWith("assignee?: string (non-empty), predicted?: string (non-empty)}"), open).toBe(true);
    expect(open).not.toContain("observed");
    expect(opShape("reopen_task")).toBe(`{op: "reopen_task", id: string, note: string (non-empty)}`);
  });

  it("E16 both fields reach the disk after closed_rev and assignee, and survive serialize then parse", () => {
    expect(write([{ op: "update_task", id: "T-008", assignee: "builder", predicted: PRED, observed: OBS }]).ok).toBe(true);
    const keys = Object.keys(task("T-008"));
    expect(keys.slice(-4)).toEqual(["closed_rev", "assignee", "predicted", "observed"]);
    const parsed = parseState(text());
    expect(parsed.ok).toBe(true);
    if (parsed.ok) {
      expect(serializeState(parsed.data)).toBe(text());
      const t = parsed.data.tasks.find((x) => x.id === "T-008")!;
      expect(t.predicted).toBe(PRED);
      expect(t.observed).toBe(OBS);
    }
  });

  it("E17 reopen_task leaves both fields; a later close may replace observed, and prints it", () => {
    expect(write([{ op: "update_task", id: "T-008", predicted: PRED }, { op: "close_task", id: "T-008", observed: OBS }]).ok).toBe(true);
    const re = write([{ op: "reopen_task", id: "T-008", note: "regressed" }]);
    expect(re.ok).toBe(true);
    expect(task("T-008").status).toBe("open");
    expect(task("T-008").predicted).toBe(PRED);
    expect(task("T-008").observed).toBe(OBS);
    refused([{ op: "update_task", id: "T-008", predicted: PRED2 }], `ops[0] (update_task): ${PREDICTION_FIXED("T-008")}`);
    const r = write([{ op: "close_task", id: "T-008", observed: OBS2 }]);
    expect(r.ok).toBe(true);
    expect(task("T-008").observed).toBe(OBS2);
    expect(r.note_changes).toEqual([`T-008 observed SET: ${OBS2.length} chars`]);
  });

  it("E18 the ob_state description names both fields and the close rule", () => {
    const server = readFileSync(join(import.meta.dirname, "../../src/server.ts"), "utf-8");
    const line = server.split("\n").find((l) => l.includes("Write .agents/state.json through typed operations"));
    expect(line).toContain("Task effects (T-358): open_task and update_task take predicted");
    expect(line).toContain("update_task and close_task take observed");
    expect(line).toContain("close_task refuses a task that has predicted and no observed");
  });
});
