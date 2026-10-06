import { describe, it, expect } from "vitest";
import { spawnSync } from "node:child_process";
import { join } from "node:path";

const ROOT = join(import.meta.dirname, "../../..");
const CAL2 = join(ROOT, "docs/loops/jev-calibration-2");
const TSX = join(import.meta.dirname, "../../node_modules/tsx/dist/cli.mjs");

function phrases(text: string): string[] {
  const r = spawnSync(
    process.execPath,
    [
      TSX,
      "-e",
      `import { verdictLeakPhrasesInText } from './leak.mjs';
console.log(JSON.stringify(verdictLeakPhrasesInText(${JSON.stringify(text)})));`,
    ],
    { cwd: CAL2, encoding: "utf-8" },
  );
  expect(r.status).toBe(0);
  return JSON.parse(r.stdout.trim()) as string[];
}

describe("jev-calibration-2 verdict leak detector", () => {
  it("known positives: QA verdict wording", () => {
    expect(phrases("QA 279 REJECT on row 7")).not.toHaveLength(0);
    expect(phrases("r2 was rejected by QA 275 because the diff was empty")).not.toHaveLength(0);
    expect(phrases("VERDICT: ACCEPT after review")).not.toHaveLength(0);
  });

  it("known negatives: code and test verbs", () => {
    expect(phrases("export function accept() {")).toHaveLength(0);
    expect(phrases("it rejects a stale lock when the timer fires")).toHaveLength(0);
    expect(phrases("the rejection path returns duplicate")).toHaveLength(0);
  });
});
