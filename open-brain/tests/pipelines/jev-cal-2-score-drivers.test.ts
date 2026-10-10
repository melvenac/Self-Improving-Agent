import { describe, it, expect } from "vitest";
import { spawnSync } from "node:child_process";
import { resolve } from "node:path";

const TSX = resolve(import.meta.dirname, "../../node_modules/tsx/dist/cli.mjs");
const SCORE = resolve(import.meta.dirname, "../../../docs/loops/jev-calibration-2/score.mjs");

describe("jev-calibration-2/score.mjs", () => {
  it("--selftest passes including F6 driver attribution", () => {
    const r = spawnSync(process.execPath, [TSX, SCORE, "--selftest"], { encoding: "utf-8" });
    expect(r.status).toBe(0);
    expect(r.stdout ?? r.stderr).toContain("drivers() counts T-222 F6");
  });
});
