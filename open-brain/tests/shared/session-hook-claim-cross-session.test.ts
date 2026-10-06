import { describe, it, expect, beforeAll } from "vitest";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { spawnAsync } from "../spawn-async.js";
import { runMixedCrossSessionTrials } from "./claim-barrier-trials.js";

describe("session-hook-claim cross-session (T-235 P2-7 r7 F9)", () => {
  const built = join(__dirname, "../../build/shared/session-hook-claim.js");
  const obRoot = join(__dirname, "../..");

  beforeAll(async () => {
    const tsc = join(obRoot, "node_modules/typescript/lib/tsc.js");
    const r = await spawnAsync(process.execPath, [tsc, "-p", join(obRoot, "tsconfig.json")], { cwd: obRoot });
    if (r.status !== 0) throw new Error(r.stderr || r.stdout || "tsc failed");
    if (!existsSync(built)) throw new Error(`built module missing: ${built}`);
  }, 120_000);

  it(
    "F9: N=8 mixed=2 cross-session row has 0 race-sid doubles/zero and other sessions claim",
    { timeout: 180_000 },
    async () => {
      const r = await runMixedCrossSessionTrials(built, 8, 2, 20);
      expect(r.throws, r.sample).toBe(0);
      expect(r.late, r.sample).toBe(0);
      expect(r.doubles, r.sample).toBe(0);
      expect(r.zeroClaims, r.sample).toBe(0);
      expect(r.otherZeroClaims ?? 0, r.sample).toBe(0);
      expect(r.exact).toBe(20);
    },
  );

  it("F9 RED on 57d86689 src (subprocess gate)", { timeout: 300_000 }, async () => {
    const script = join(__dirname, "../../scripts/claim-r7-gate-check.mts");
    const r = await spawnAsync(process.execPath, ["--import", "tsx", script, "f9", "57d86689"], {
      cwd: join(__dirname, "../.."),
    });
    expect(r.status).toBe(0);
    expect(r.stdout.trim()).toBe("RED");
  });
});
