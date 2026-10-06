import { readFileSync } from "node:fs";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { describe, expect, it } from "vitest";
import { CAL2_MAX_WIRE_BYTES, readCal2Input } from "../../src/harness/cal2-frozen.js";

const ROOT = join(import.meta.dirname, "../../..");
const RUNLIST = join(ROOT, "docs/loops/jev-calibration-2/runlist.json");
const TSX = join(import.meta.dirname, "../../node_modules/tsx/dist/cli.mjs");

describe("JEV-CAL-2 DEV r2 SIZE — runlist wire bodies under ceiling", () => {
  it("every dev and held-out runlist input is at most 90_000 wire bytes", () => {
    const runlist = JSON.parse(readFileSync(RUNLIST, "utf-8")) as {
      phases: { dev: { input: string }[]; heldout: { input: string }[] };
    };
    const bodies: number[] = [];
    for (const phase of ["dev", "heldout"] as const) {
      for (const row of runlist.phases[phase]) {
        const { wireBody } = readCal2Input(join(ROOT, row.input));
        expect(wireBody.length).toBeLessThanOrEqual(CAL2_MAX_WIRE_BYTES);
        bodies.push(wireBody.length);
      }
    }
    const expected = runlist.phases.dev.length + runlist.phases.heldout.length;
    expect(bodies.length).toBe(expected);
  });

  it("wire-size-report.mjs reports zero over 90 KB for dev and heldout", () => {
    const r = spawnSync(process.execPath, [TSX, join(ROOT, "docs/loops/jev-calibration-2/wire-size-report.mjs")], {
      encoding: "utf-8",
      cwd: ROOT,
    });
    expect(r.status).toBe(0);
    const j = JSON.parse(r.stdout) as { dev: { over_90kb: number }; heldout: { over_90kb: number } };
    expect(j.dev.over_90kb).toBe(0);
    expect(j.heldout.over_90kb).toBe(0);
  });
});
