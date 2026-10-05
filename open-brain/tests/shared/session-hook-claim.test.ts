import { describe, it, expect, beforeAll, beforeEach, afterEach } from "vitest";
import { existsSync, mkdirSync, mkdtempSync, readdirSync, rmSync, utimesSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { pathToFileURL } from "node:url";
import { spawnAsync } from "../spawn-async.js";
import {
  HOOK_CLAIM_TTL_MS,
  SWEEP_CAP,
  clearHookClaimsForTest,
  dedupeCursorHookRuns,
  sweepExpiredClaimsForTest,
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

  it("expired claims other than the one being claimed are removed, at most 32 per call", () => {
    const dir = join(home, ".claude", "open-brain", "hook-claims");
    mkdirSync(dir, { recursive: true });
    const stale = (Date.now() - HOOK_CLAIM_TTL_MS - 5_000) / 1000;
    const old = join(dir, "sessionStart-old-other.claim");
    const aside = join(dir, "sessionEnd-old-other.claim.stale.1");
    const fresh = join(dir, "sessionStart-fresh-other.claim");
    writeFileSync(old, "old\n");
    writeFileSync(aside, "aside\n");
    writeFileSync(fresh, "fresh\n");
    utimesSync(old, stale, stale);
    utimesSync(aside, stale, stale);
    expect(tryClaimHookRun(home, "sessionStart", "keeper")).toBe("claimed");
    const names = readdirSync(dir);
    expect(names).not.toContain("sessionStart-old-other.claim");
    expect(names).not.toContain("sessionEnd-old-other.claim.stale.1");
    expect(names).toContain("sessionStart-fresh-other.claim");
    expect(names).toContain("sessionStart-keeper.claim");
  });

  it("sweep never unlinks the keep path even when that claim file is past TTL", () => {
    const dir = join(home, ".claude", "open-brain", "hook-claims");
    mkdirSync(dir, { recursive: true });
    const keep = join(dir, "sessionStart-keep-me.claim");
    const other = join(dir, "sessionStart-other.claim");
    const stale = (Date.now() - HOOK_CLAIM_TTL_MS - 5_000) / 1000;
    writeFileSync(keep, "keep\n");
    writeFileSync(other, "other\n");
    utimesSync(keep, stale, stale);
    utimesSync(other, stale, stale);
    sweepExpiredClaimsForTest(home, HOOK_CLAIM_TTL_MS, keep);
    expect(existsSync(keep)).toBe(true);
    expect(existsSync(other)).toBe(false);
  });

  it("sweep removes at most SWEEP_CAP stale files when more than 32 exist", () => {
    const dir = join(home, ".claude", "open-brain", "hook-claims");
    mkdirSync(dir, { recursive: true });
    const stale = (Date.now() - HOOK_CLAIM_TTL_MS - 5_000) / 1000;
    for (let i = 0; i < 40; i++) {
      const p = join(dir, `sessionStart-sweepold-${i}.claim`);
      writeFileSync(p, "x\n");
      utimesSync(p, stale, stale);
    }
    expect(tryClaimHookRun(home, "sessionStart", "sweep-cap")).toBe("claimed");
    const remainingStale = readdirSync(dir).filter((n) => n.startsWith("sessionStart-sweepold-") && n.endsWith(".claim"));
    expect(remainingStale.length).toBe(40 - SWEEP_CAP);
  });

  it("sweep ignores a directory entry in hook-claims without throwing", () => {
    const dir = join(home, ".claude", "open-brain", "hook-claims");
    mkdirSync(join(dir, "oops"), { recursive: true });
    expect(() => tryClaimHookRun(home, "sessionStart", "eisdir")).not.toThrow();
    expect(tryClaimHookRun(home, "sessionStart", "eisdir")).toBe("duplicate");
  });

  it("sessionEnd: duplicate claim is rejected like sessionStart", () => {
    const id = "end-1";
    expect(tryClaimHookRun(home, "sessionEnd", id)).toBe("claimed");
    expect(tryClaimHookRun(home, "sessionEnd", id)).toBe("duplicate");
  });
});

describe("session-hook-claim barrier on the built module", { timeout: 900_000 }, () => {
  const built = join(__dirname, "../../build/shared/session-hook-claim.js");
  const obRoot = join(__dirname, "../..");

  beforeAll(async () => {
    const tsc = join(obRoot, "node_modules/typescript/lib/tsc.js");
    const r = await spawnAsync(process.execPath, [tsc, "-p", join(obRoot, "tsconfig.json")], { cwd: obRoot });
    if (r.status !== 0) throw new Error(r.stderr || r.stdout || "tsc failed");
    if (!existsSync(built)) throw new Error(`built module missing: ${built}`);
  }, 120_000);

  async function barrierTrials(
    procs: number,
    trialCount: number,
    stale: boolean,
  ): Promise<{ exact: number; doubles: number; throws: number; sample: string }> {
    let exact = 0;
    let doubles = 0;
    let throws = 0;
    let sample = "";
    const mod = pathToFileURL(built).href;
    for (let i = 0; i < trialCount; i++) {
      const trialHome = mkdtempSync(join(tmpdir(), "ob-claim-race-"));
      try {
        const id = `race-${procs}-${i}`;
        if (stale) {
          const dir = join(trialHome, ".claude", "open-brain", "hook-claims");
          mkdirSync(dir, { recursive: true });
          const claim = join(dir, `sessionStart-${id}.claim`);
          writeFileSync(claim, "old\n");
          const old = (Date.now() - HOOK_CLAIM_TTL_MS - 60_000) / 1000;
          utimesSync(claim, old, old);
        }
        const start = Date.now() + 400;
        const scriptPath = join(trialHome, "race.mjs");
        writeFileSync(
          scriptPath,
          `const { tryClaimHookRun } = await import(${JSON.stringify(mod)});
const start = ${start};
while (Date.now() < start) {}
process.stdout.write(String(tryClaimHookRun(process.env.HOME, "sessionStart", ${JSON.stringify(id)})));
`,
        );
        const env = { ...process.env, HOME: trialHome, USERPROFILE: trialHome };
        const runs = await Promise.all(
          Array.from({ length: procs }, () => spawnAsync(process.execPath, [scriptPath], { env })),
        );
        const failed = runs.some((r) => r.status !== 0);
        if (failed) {
          throws++;
          if (!sample) {
            sample = runs.map((r) => `status=${r.status} out=${JSON.stringify(r.stdout)} err=${JSON.stringify(r.stderr)}`).join("\n");
          }
        }
        const claimed = runs.filter((r) => (r.stdout ?? "").trim() === "claimed").length;
        if (!failed && claimed === 1) exact++;
        else if (claimed > 1) doubles++;
      } finally {
        rmSync(trialHome, { recursive: true, force: true, maxRetries: 3, retryDelay: 50 });
      }
    }
    return { exact, doubles, throws, sample };
  }

  it("fresh claims: 2 children spin to one instant, 20 trials, exactly one wins", async () => {
    const r = await barrierTrials(2, 20, false);
    expect(r.throws).toBe(0);
    expect(r.doubles).toBe(0);
    expect(r.exact).toBe(20);
  });

  it("stale claims N=2: 100 trials, zero double claims and zero throws", async () => {
    const r = await barrierTrials(2, 100, true);
    expect(r.throws, r.sample).toBe(0);
    expect(r.doubles, r.sample).toBe(0);
    expect(r.exact).toBe(100);
  });

  it("stale claims N=3: 100 trials, zero double claims and zero throws", async () => {
    const r = await barrierTrials(3, 100, true);
    expect(r.throws, r.sample).toBe(0);
    expect(r.doubles, r.sample).toBe(0);
    expect(r.exact).toBe(100);
  });

  it("stale claims N=8: 100 trials run 1, zero double claims and zero throws", async () => {
    const r = await barrierTrials(8, 100, true);
    expect(r.throws, r.sample).toBe(0);
    expect(r.doubles, r.sample).toBe(0);
    expect(r.exact).toBe(100);
  });

  it("stale claims N=8: 100 trials run 2, zero double claims and zero throws", async () => {
    const r = await barrierTrials(8, 100, true);
    expect(r.throws, r.sample).toBe(0);
    expect(r.doubles, r.sample).toBe(0);
    expect(r.exact).toBe(100);
  });

  it("stale claims N=8: 100 trials run 3, zero double claims and zero throws", async () => {
    const r = await barrierTrials(8, 100, true);
    expect(r.throws, r.sample).toBe(0);
    expect(r.doubles, r.sample).toBe(0);
    expect(r.exact).toBe(100);
  });
});
