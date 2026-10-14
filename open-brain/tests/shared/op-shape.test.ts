import { describe, it, expect } from "vitest";
import { z } from "zod";
import { renderJsonShape, describeShape, SHAPE_MAX } from "../../src/shared/op-shape.js";
import { opNames, opShape } from "../../src/shared/state-writer.js";

describe("T-271 op-shape: an op's expected shape from its zod schema", () => {
  it.each([
    [{ anyOf: [{ type: "string" }, { type: "null" }] }, "string | null"],
    [{ type: "string", const: "x" }, `"x"`],
    [{ type: "string", enum: ["a", "b"] }, `"a"|"b"`],
    [{ type: "array", items: { type: "string" }, minItems: 1 }, "[string] (non-empty)"],
    [{ type: "array", items: { type: "string" }, minItems: 2 }, "[string] (>= 2 items)"],
    [{ type: "array", items: { type: "boolean" } }, "[boolean]"],
    [{ type: "string", minLength: 1, pattern: "^a$" }, "string (non-empty, matching /^a$/)"],
    [{ type: "string", minLength: 3 }, "string (length >= 3)"],
    [{ type: "integer", exclusiveMinimum: 0, maximum: Number.MAX_SAFE_INTEGER }, "integer (> 0)"],
    [{ type: "integer", minimum: Number.MIN_SAFE_INTEGER, maximum: Number.MAX_SAFE_INTEGER }, "integer"],
    [{ type: "number", minimum: 0 }, "number (>= 0)"],
    [{ type: "object", properties: { a: { type: "string" }, b: { type: "boolean" } }, required: ["a"] }, "{a: string, b?: boolean}"],
    [{ type: "null" }, "null"],
    [{}, "unknown"],
  ])("S1 renderJsonShape(%j) is %s", (node, text) => {
    expect(renderJsonShape(node as Record<string, unknown>)).toBe(text);
  });

  it("S2 describeShape goes through z.toJSONSchema, and cuts at SHAPE_MAX", () => {
    expect(describeShape(z.strictObject({ op: z.literal("close_gap"), id: z.string() }))).toBe(`{op: "close_gap", id: string}`);
    const values = Array.from({ length: 200 }, (_, i) => `value_${i}`) as [string, ...string[]];
    const long = describeShape(z.strictObject({ k: z.enum(values) }));
    expect(long).toHaveLength(SHAPE_MAX);
    expect(long.endsWith("…")).toBe(true);
  });

  it("S3 every op has a shape, in OpSchema order, and an unknown name has none", () => {
    expect(opNames()).toEqual(["open_task", "update_task", "close_task", "reopen_task", "add_verified", "reopen_verified", "add_gap", "update_gap", "close_gap", "reopen_gap", "add_decision", "set_standing", "set_objective", "set_handoff"]);
    for (const n of opNames()) {
      const s = opShape(n)!;
      expect(s.startsWith(`{op: "${n}"`), s).toBe(true);
      expect(s.length).toBeLessThanOrEqual(SHAPE_MAX);
    }
    expect(opShape("delete_everything")).toBeNull();
  });
});
