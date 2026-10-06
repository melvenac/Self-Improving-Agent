import { describe, it, expect } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

const ROOT = join(import.meta.dirname, "../../..");
const CAL2 = join(ROOT, "docs/loops/jev-calibration-2");
describe("jev-calibration-2/collect.mjs", () => {
  it("writes pool.json with verdict and provenance counts for QA 253+", { timeout: 120_000 }, () => {
    const r = spawnSync(process.execPath, [join(CAL2, "collect.mjs")], { cwd: CAL2, encoding: "utf-8", timeout: 120_000 });
    expect(r.status).toBe(0);
    expect(existsSync(join(CAL2, "pool.json"))).toBe(true);
    const pool = JSON.parse(readFileSync(join(CAL2, "pool.json"), "utf-8")) as Record<string, number>;
    expect(pool.total).toBeGreaterThan(0);
    expect(pool.ACCEPT + pool.REJECT + pool.unlabelled).toBe(pool.total);
    expect(pool.seat_built + pool.runtime_built).toBe(pool.total);
    expect(pool.leak_group).toBeGreaterThanOrEqual(0);
    expect(pool.headline_pool).toBe(pool.total - pool.leak_group);
  });
});
