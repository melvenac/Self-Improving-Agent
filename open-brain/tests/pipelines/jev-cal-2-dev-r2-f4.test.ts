import { describe, expect, it } from "vitest";
import { GateCallFailed } from "../../src/harness/gate.js";
import { classifyFrozenHttp } from "../../src/harness/cal2-frozen.js";

describe("JEV-CAL-2 DEV r2 F4 — frozen HTTP classification", () => {
  it("maps 401/403 to auth", () => {
    const e = classifyFrozenHttp(401, "", "");
    expect(e).toBeInstanceOf(GateCallFailed);
    expect(e.classification).toBe("auth");
    expect(e.retryable).toBe(false);
  });

  it("maps 400 max_tokens_exceeded to request-invalid", () => {
    const body = JSON.stringify({ detail: { error_type: "max_tokens_exceeded" } });
    const e = classifyFrozenHttp(400, body, body);
    expect(e.classification).toBe("request-invalid");
    expect(e.detail).toContain("max_tokens");
  });

  it("maps 503 to transport", () => {
    const e = classifyFrozenHttp(503, "busy", "busy");
    expect(e.classification).toBe("transport");
  });
});
