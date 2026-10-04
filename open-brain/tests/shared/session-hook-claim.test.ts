import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync, utimesSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { pathToFileURL } from "node:url";
import { spawnAsync } from "../spawn-async.js";
import {
  HOOK_CLAIM_TTL_MS,
  clearHookClaimsForTest,
  dedupeCursorHookRuns,
  tryClaimHookRun,
} from "../../src/shared/session-hook-claim.js";

describe("session-hook-claim (T-235 P2-7)", () => {
  let home: string;

  beforeEach(() => {
    home = mkdtempSync(join(tmpdir(), "ob-claim-home-"));
    clearHookClaimsForTest(home);
  });

  afterEach(() => {
    rmSync(home, { recursive: true, force: true, maxRetries: 3, retryDelay: 50 });
  });

  it("R1: second sessionStart claim for the same cursor session is duplicate", () => {
    const id = "11111111-2222-3333-4444-555555555555";
    expect(tryClaimHookRun(home, "sessionStart", id)).toBe("claimed");
    expect(tryClaimHookRun(home, "sessionStart", id)).toBe("duplicate");
  });

  it("R2: different session ids each claim sessionStart", () => {
    expect(tryClaimHookRun(home, "sessionStart", "aaaa")).toBe("claimed");
    expect(tryClaimHookRun(home, "sessionStart", "bbbb")).toBe("claimed");
  });

  it("R3: dedupe applies only when cursor_version is present (Claude-shaped payload skips guard)", () => {
    const cc = { session_id: "cc-1" };
    const cursor = { session_id: "cur-1", cursor_version: "1.0" };
    expect(dedupeCursorHookRuns(cc, "claude")).toBe(false);
    expect(dedupeCursorHookRuns(cursor, "claude")).toBe(true);
  });

  it("R4: after TTL a stale claim allows a full re-run", () => {
    const id = "ttl-session-1";
    expect(tryClaimHookRun(home, "sessionStart", id, 50)).toBe("claimed");
    expect(tryClaimHookRun(home, "sessionStart", id, 50)).toBe("duplicate");
    const claimPath = join(home, ".claude", "open-brain", "hook-claims", `sessionStart-${id}.claim`);
    const stale = Date.now() - HOOK_CLAIM_TTL_MS - 5_000;
    utimesSync(claimPath, stale / 1000, stale / 1000);
    expect(tryClaimHookRun(home, "sessionStart", id, HOOK_CLAIM_TTL_MS)).toBe("claimed");
  });

  it("race: two concurrent sessionStart claims — exactly one wins", async () => {
    const id = "race-session-1";
    const claimMod = pathToFileURL(join(__dirname, "../../src/shared/session-hook-claim.ts")).href;
    const scriptPath = join(home, "race.mjs");
    writeFileSync(
      scriptPath,
      `import { tryClaimHookRun } from "${claimMod}";
const r = tryClaimHookRun(process.env.HOME, "sessionStart", ${JSON.stringify(id)});
console.log(r);`,
    );
    const env = { ...process.env, HOME: home, USERPROFILE: home };
    const { createRequire } = await import("node:module");
    const tsxCli = createRequire(import.meta.url).resolve("tsx/cli");
    const runOne = () => spawnAsync(process.execPath, [tsxCli, scriptPath], { env });
    const [r1, r2] = await Promise.all([runOne(), runOne()]);
    if (r1.status !== 0) throw new Error(r1.stderr || "race child 1 failed");
    if (r2.status !== 0) throw new Error(r2.stderr || "race child 2 failed");
    const outcomes = [r1.stdout.trim(), r2.stdout.trim()].sort();
    expect(outcomes).toEqual(["claimed", "duplicate"]);
  });

  it("sessionEnd: duplicate claim is rejected like sessionStart", () => {
    const id = "end-1";
    expect(tryClaimHookRun(home, "sessionEnd", id)).toBe("claimed");
    expect(tryClaimHookRun(home, "sessionEnd", id)).toBe("duplicate");
  });
});
