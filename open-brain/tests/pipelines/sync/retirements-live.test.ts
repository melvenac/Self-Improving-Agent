import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { checkRetirements } from "../../../src/pipelines/sync/checks.js";

/**
 * T-215: R-011's maturity-lifecycle cut, checked on THIS repository's real tree and record.
 * The fixture rows in checks.test.ts prove the check works; this one proves the record is
 * clean: the check passes, and no allowed referrer is still marked as an owed fix.
 */
const root = resolve(import.meta.dirname, "../../../..");

describe("R-011 on the live tree (T-215)", { timeout: 60_000 }, () => {
  it("the retirements check passes, with no unexpected referrer", () => {
    const r = checkRetirements(root);
    expect(r.severity, r.message).toBe("pass");
    expect(r.message).toContain("0 unexpected");
  });

  it("no allowed referrer is still marked as a live reference awaiting a fix", () => {
    const record = JSON.parse(readFileSync(join(root, ".agents", "retirements.json"), "utf8")) as {
      retirements: Array<{ id: string; allowed_referrers: Array<{ path: string; why: string }> }>;
    };
    const r011 = record.retirements.find((r) => r.id === "R-011")!;
    const owed = r011.allowed_referrers.filter((a) => /^LIVE REFERENCE, NOT AN OBITUARY/.test(a.why)).map((a) => a.path);
    expect(owed).toEqual([]);
  });
});
