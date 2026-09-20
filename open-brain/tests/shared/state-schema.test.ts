import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { parseState, serializeState, type State } from "../../src/shared/state-schema.js";

const fixturePath = join(import.meta.dirname, "../fixtures-state/state.json");
const fixtureText = readFileSync(fixturePath, "utf-8");

function valid(): State {
  const r = parseState(fixtureText);
  if (!r.ok) throw new Error(r.error);
  return r.data;
}

/** Same data as the fixture, top-level and nested keys in a different order. */
function reorderKeys(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(reorderKeys);
  if (value === null || typeof value !== "object") return value;
  const obj = value as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  for (const k of Object.keys(obj).sort().reverse()) out[k] = reorderKeys(obj[k]);
  return out;
}

describe("state-schema (Loop 2, read side)", () => {
  it("parses the realistic fixture", () => {
    const data = valid();
    expect(data.schema_version).toBe(2);
    expect(data.revision).toBe(7);
    expect(data.tasks.length).toBeGreaterThanOrEqual(25);
    expect(data.tasks.filter((t) => t.status === "done").length).toBeGreaterThanOrEqual(10);
    expect(data.verified).toHaveLength(8);
    expect(data.verified.every((v) => v.evidence.length >= 1)).toBe(true);
    expect(data.gaps).toHaveLength(5);
    expect(data.decisions).toHaveLength(6);
    expect(data.handoffs).toHaveLength(1);
    expect(data.handoffs[0].seat).toBe("developer");
    expect(data.handoffs[0].pick_up.length).toBeGreaterThan(0);
  });

  it("rejects text that is not JSON, naming the root", () => {
    const r = parseState("{ not json");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/^\$: not valid JSON/);
  });

  it("names the path of a missing required field", () => {
    const data = valid() as unknown as Record<string, unknown>;
    delete data.handoffs;
    const r = parseState(JSON.stringify(data));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/^handoffs: /);
  });

  /** Loop 4 R2: closed_session is non-null exactly when status is done — both directions refuse. */
  it("refuses a done task with closed_session null, and an open task with closed_session set (R2)", () => {
    const doneNoClose = valid();
    const done = doneNoClose.tasks.find((t) => t.status === "done")!;
    done.closed_session = null;
    const r1 = parseState(JSON.stringify(doneNoClose));
    expect(r1.ok).toBe(false);
    if (!r1.ok) expect(r1.error).toBe(`tasks.${doneNoClose.tasks.indexOf(done)}.closed_session: closed_session must be set when status is "done" and null otherwise`);

    const openWithClose = valid();
    const open = openWithClose.tasks.find((t) => t.status !== "done")!;
    open.closed_session = 54;
    const r2 = parseState(JSON.stringify(openWithClose));
    expect(r2.ok).toBe(false);
    if (!r2.ok) expect(r2.error).toMatch(/^tasks\.\d+\.closed_session: /);

    // The committed fixture satisfies the rule in every row.
    for (const t of valid().tasks) expect(t.status === "done").toBe(t.closed_session !== null);
  });

  it("names the path of a bad enum inside a task", () => {
    const data = valid();
    (data.tasks[3] as unknown as { status: string }).status = "finished";
    const r = parseState(JSON.stringify(data));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/^tasks\.3\.status: /);
  });

  it("rejects an unknown key at the top level (strict)", () => {
    const data = valid() as unknown as Record<string, unknown>;
    data.notes = "typo'd field";
    const r = parseState(JSON.stringify(data));
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.error).toContain("$:");
      expect(r.error).toContain("notes");
    }
  });

  it("rejects an unknown key inside a task (strict at every level)", () => {
    const data = valid();
    (data.tasks[0] as unknown as Record<string, unknown>).owner = "someone";
    const r = parseState(JSON.stringify(data));
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.error).toContain("tasks.0");
      expect(r.error).toContain("owner");
    }
  });

  it("rejects a wrong schema_version and a malformed date", () => {
    const v = valid() as unknown as Record<string, unknown>;
    // 1, not 2: v2 is now the accepted version, so the old value is what must
    // be refused. A v1 record failing to parse is the whole reason the literal
    // is a literal — every copy moves in one commit or a missed one is loud.
    v.schema_version = 1;
    const r1 = parseState(JSON.stringify(v));
    expect(r1.ok).toBe(false);
    if (!r1.ok) expect(r1.error).toMatch(/^schema_version: /);

    const d = valid();
    d.decisions[0].date = "14/09/2026";
    const r2 = parseState(JSON.stringify(d));
    expect(r2.ok).toBe(false);
    if (!r2.ok) expect(r2.error).toBe("decisions.0.date: expected YYYY-MM-DD");
  });

  it("serializeState is idempotent and canonical across key orders", () => {
    const once = serializeState(valid());
    const again = serializeState(parseState(once).data!);
    expect(again).toBe(once);

    const reordered = JSON.stringify(reorderKeys(JSON.parse(fixtureText)));
    const r = parseState(reordered);
    expect(r.ok).toBe(true);
    if (r.ok) expect(serializeState(r.data)).toBe(once);

    expect(once.endsWith("\n")).toBe(true);
    expect(once.startsWith('{\n  "schema_version": 2,\n  "revision": 7,\n  "project": {')).toBe(true);
  });

  it("the committed fixture is already in canonical form", () => {
    expect(serializeState(valid())).toBe(fixtureText.replace(/\r\n/g, "\n"));
  });
});
