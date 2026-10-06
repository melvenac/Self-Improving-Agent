import { describe, expect, it } from "vitest";
import { spawnSync } from "node:child_process";
import { resolve } from "node:path";

const TSX = resolve(import.meta.dirname, "../../node_modules/tsx/dist/cli.mjs");
const SCORE = resolve(import.meta.dirname, "../../../docs/loops/jev-calibration-2/score.mjs");

describe("JEV-CAL-2 DEV r2 F2 — score.mjs runlist join", () => {
  it("--selftest includes buildRowsFromRunlist dt.path join", () => {
    const r = spawnSync(process.execPath, [TSX, SCORE, "--selftest"], { encoding: "utf-8" });
    expect(r.status).toBe(0);
    expect(r.stdout).toContain("buildRowsFromRunlist joins on dt.path");
  });
});
