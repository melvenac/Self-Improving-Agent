import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { existsSync, mkdtempSync, rmSync, statSync, utimesSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { HOOK_CLAIM_TTL_MS, claimHookRun, releaseHookClaim, shouldClaimHookRun } from "../../src/shared/hook-claim.js";

// T-245 Option A: one claim per doubled Cursor hook. Every `now` is passed
// explicitly: no fake timers, no sleeps.
const T0 = Date.parse("2026-10-11T12:00:00Z");

describe("hook-claim (T-245)", () => {
  let dir: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "t245-claim-"));
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it("HC-1: the first run claims, and leaves a claim file", () => {
    expect(claimHookRun({ kind: "start", sessionId: "s-1", dir, now: T0 })).toBe("claimed");
    expect(existsSync(join(dir, "start-s-1.claim"))).toBe(true);
  });

  it("HC-2: a second run inside the TTL skips", () => {
    claimHookRun({ kind: "start", sessionId: "s-1", dir, now: T0 });
    expect(claimHookRun({ kind: "start", sessionId: "s-1", dir, now: T0 + 1000 })).toBe("skip");
  });

  it("HC-3: a stale claim is replaced, and the new claim is fresh", () => {
    claimHookRun({ kind: "start", sessionId: "s-1", dir, now: T0 });
    const file = join(dir, "start-s-1.claim");
    utimesSync(file, (T0 - 200_000) / 1000, (T0 - 200_000) / 1000);
    expect(claimHookRun({ kind: "start", sessionId: "s-1", dir, now: T0 })).toBe("claimed");
    expect(statSync(file).mtimeMs).toBeGreaterThan(T0 - 200_000 + 1000);
  });

  it("HC-4: start and end are separate keys", () => {
    claimHookRun({ kind: "start", sessionId: "s-1", dir, now: T0 });
    expect(claimHookRun({ kind: "end", sessionId: "s-1", dir, now: T0 })).toBe("claimed");
  });

  it("HC-5: a Cursor payload claims on session_id, then conversation_id", () => {
    expect(shouldClaimHookRun({ cursor_version: "1.2.3", session_id: "abc" })).toBe("abc");
    expect(shouldClaimHookRun({ cursor_version: "1.2.3", conversation_id: "c1" })).toBe("c1");
  });

  it("HC-6: Claude Code is never claimed, and no id means no claim", () => {
    expect(shouldClaimHookRun({ session_id: "abc" })).toBeNull();
    expect(shouldClaimHookRun({ cursor_version: "1.2.3" })).toBeNull();
  });

  it("HC-7: a broken claim directory fails open", () => {
    const f = join(dir, "not-a-dir");
    writeFileSync(f, "x");
    let result: string | undefined;
    expect(() => {
      result = claimHookRun({ kind: "start", sessionId: "s-1", dir: join(f, "sub"), now: T0 });
    }).not.toThrow();
    expect(result).toBe("claimed");
  });

  it("HC-8: the session id is sanitised into the file name", () => {
    claimHookRun({ kind: "start", sessionId: "a/b:c", dir, now: T0 });
    expect(existsSync(join(dir, "start-a_b_c.claim"))).toBe(true);
  });

  it("HC-9: the TTL boundary claims", () => {
    claimHookRun({ kind: "start", sessionId: "s-1", dir, now: T0 });
    const file = join(dir, "start-s-1.claim");
    utimesSync(file, T0 / 1000, T0 / 1000);
    expect(claimHookRun({ kind: "start", sessionId: "s-1", dir, now: T0 + HOOK_CLAIM_TTL_MS })).toBe("claimed");
  });

  it("HC-10: claiming one kind releases the other", () => {
    expect(claimHookRun({ kind: "start", sessionId: "X", dir, now: T0 })).toBe("claimed");
    releaseHookClaim({ kind: "start", sessionId: "X", dir });
    expect(claimHookRun({ kind: "start", sessionId: "X", dir, now: T0 + 1000 })).toBe("claimed");
  });

  it("HC-11: releasing a missing claim is a no-op", () => {
    expect(() => releaseHookClaim({ kind: "end", sessionId: "nope", dir })).not.toThrow();
    expect(() => releaseHookClaim({ kind: "end", sessionId: "nope", dir: join(dir, "missing", "sub") })).not.toThrow();
  });
});
