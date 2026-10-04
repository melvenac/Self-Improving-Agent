import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { z } from "zod";
import { KEY_ORDER, assertKeyOrder, keyOrderGaps, parseState, schemaObjectSlots, serializeState, type State } from "../../src/shared/state-schema.js";

/**
 * T-238. serializeState writes ONLY the keys KEY_ORDER lists for a slot, so a schema field missing from KEY_ORDER validated,
 * applied, printed "applied" and vanished from disk (tasks[].assignee, #401). Every row here is DERIVED from the zod schemas
 * (`schemaObjectSlots` walks StateSchema), not from a hand-written list of slots or fields.
 */
const fixture = readFileSync(join(import.meta.dirname, "../fixtures-state/state.json"), "utf-8");
const valid = (): State => {
  const r = parseState(fixture);
  if (!r.ok) throw new Error(r.error);
  return r.data;
};

const slots = schemaObjectSlots();
/** The slots with an object entry in KEY_ORDER: everything except the string-or-object union variants. */
const ordered = [...slots].filter(([slot]) => KEY_ORDER[slot] !== undefined);
const sorted = (xs: readonly string[]): string[] => [...xs].sort();

describe("T-238 row 1: for every slot, KEY_ORDER[slot] and the schema's shape keys are EQUAL SETS", () => {
  it("the walker saw the real schema: at least the thirteen slots known at 2026-10-03, and the root", () => {
    // Assert the count of what was walked: a walker that finds nothing must not read as 'no gaps'.
    expect(slots.size).toBeGreaterThanOrEqual(13);
    expect(slots.has("$")).toBe(true);
    for (const known of ["tasks", "handoffs", "sessions", "gaps", "open_prs", "loop_state"]) expect(slots.has(known), known).toBe(true);
  });

  it.each(ordered.map(([slot, shapes]) => [slot, shapes] as const))("slot %s: KEY_ORDER lists exactly the schema's keys", (slot, shapes) => {
    expect(shapes).toHaveLength(1);
    expect(sorted(KEY_ORDER[slot]!)).toEqual(shapes[0]);
  });

  it("every slot of the schema has an entry, except the string-or-object union variants", () => {
    const without = [...slots.keys()].filter((s) => KEY_ORDER[s] === undefined);
    expect(sorted(without)).toEqual(["open_questions", "watch_out"]);
  });

  it("KEY_ORDER names no slot the schema does not have", () => {
    for (const slot of Object.keys(KEY_ORDER)) expect(slots.has(slot), slot).toBe(true);
  });

  it("keyOrderGaps() is empty and assertKeyOrder() does not throw, on the live schema", () => {
    expect(keyOrderGaps()).toEqual([]);
    expect(() => assertKeyOrder()).not.toThrow();
  });
});

describe("T-238: the guard is shown a known positive before a negative is trusted", () => {
  const without = (slot: string, key: string): Record<string, string[]> => ({
    ...Object.fromEntries(Object.entries(KEY_ORDER).map(([k, v]) => [k, [...v]])),
    [slot]: KEY_ORDER[slot]!.filter((k) => k !== key),
  });

  it("a KEY_ORDER entry that lost a key is reported, naming the slot and the field, and says the field would be dropped", () => {
    const gaps = keyOrderGaps(without("tasks", "assignee"));
    expect(gaps).toEqual([`slot "tasks": schema field "assignee" is not in KEY_ORDER, so serializeState would drop it from disk`]);
    expect(() => assertKeyOrder(without("tasks", "assignee"))).toThrow(/serializeState refused.*"assignee".*lose data/);
  });

  it("a KEY_ORDER entry with an extra key, a duplicate, a missing slot and an unknown slot are each reported", () => {
    const base = Object.fromEntries(Object.entries(KEY_ORDER).map(([k, v]) => [k, [...v]]));
    expect(keyOrderGaps({ ...base, tasks: [...base.tasks!, "ghost"] })).toEqual([`slot "tasks": KEY_ORDER lists "ghost", which no schema object in that slot has`]);
    expect(keyOrderGaps({ ...base, tasks: [...base.tasks!, "id"] })).toEqual([`slot "tasks": KEY_ORDER lists a key twice`]);
    const { sessions: _dropped, ...noSessions } = base;
    expect(keyOrderGaps(noSessions)).toEqual([`slot "sessions" has no KEY_ORDER entry, so serializeState would order its keys by chance`]);
    expect(keyOrderGaps({ ...base, phantom: ["a"] })).toEqual([`KEY_ORDER has an entry for "phantom", which is not a slot of StateSchema`]);
  });

  it("the walker finds a nested slot behind array, nullable, optional and union wrappers", () => {
    const probe = z.strictObject({
      a: z.array(z.strictObject({ b: z.string() })).nullable(),
      c: z.strictObject({ d: z.number() }).optional(),
      e: z.union([z.string(), z.strictObject({ f: z.string() })]),
    });
    const found = schemaObjectSlots(probe);
    expect([...found.keys()].sort()).toEqual(["$", "a", "c", "e"]);
    expect(found.get("a")).toEqual([["b"]]);
    expect(found.get("e")).toEqual([["f"]]);
  });

  it("the walker REFUSES a zod type it cannot see through, instead of reporting a clean result", () => {
    expect(() => schemaObjectSlots(z.strictObject({ r: z.record(z.string(), z.string()) }))).toThrow(/cannot see through zod type "record" at slot "r"/);
  });
});

describe("T-238 row 3: serializeState loses no field, and refuses rather than lose one", () => {
  it("every field of the fixture survives serialize then parse (nothing vanishes from disk)", () => {
    const before = valid();
    const after = parseState(serializeState(before));
    expect(after.ok).toBe(true);
    if (after.ok) expect(after.data).toEqual(before);
  });

  it("a task's assignee, the field that vanished in #401, survives the write", () => {
    const s = valid();
    s.tasks[0] = { ...s.tasks[0]!, assignee: "builder" };
    const written = JSON.parse(serializeState(s)) as State;
    expect(written.tasks[0]!.assignee).toBe("builder");
  });
});
