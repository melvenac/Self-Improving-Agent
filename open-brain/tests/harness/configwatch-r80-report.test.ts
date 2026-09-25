/**
 * R72. The runtime reports a machine finding because `changed` is true.
 * Equal texts do not hide it. A mutant that reports only when the texts differ goes red here.
 */
import { describe, it, expect } from "vitest";
import { machineChangeReported } from "../../src/harness/runtime.js";

describe("R72 runtime decision", () => {
  it("R72-EQUAL-TEXT: equal texts are still reported when the comparison says changed", () => {
    expect(machineChangeReported({ before: "same", after: "same", changed: true })).toBe(true);
    expect(machineChangeReported({ before: "same", after: "same", changed: false })).toBe(false);
  });
});
