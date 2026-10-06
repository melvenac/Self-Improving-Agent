import { describe, it, expect } from "vitest";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

const ROOT = join(import.meta.dirname, "../../..");
const CAL2 = join(ROOT, "docs/loops/jev-calibration-2");
const TSX = join(import.meta.dirname, "../../node_modules/tsx/dist/cli.mjs");

describe("jev-calibration-2 inputs", () => {
  it("refuses an empty diff (base equals candidate)", () => {
    const r = spawnSync(
      process.execPath,
      [
        TSX,
        "-e",
        `import { buildGDoneRequestForCase } from './inputs.mjs';
const x = buildGDoneRequestForCase({ case_id:'x', case_no:1, base_sha:'${"a".repeat(40)}', candidate_sha:'${"a".repeat(40)}', plan_blob:'b', dispatch_path:'p' }, { plan_match:'requirement_rows' }, { gitFn: () => '' });
console.log(JSON.stringify(x));`,
      ],
      { cwd: CAL2, encoding: "utf-8" },
    );
    expect(r.status).toBe(0);
    expect(JSON.parse(r.stdout.trim()).refuse).toBe("empty-diff-range");
  });

  it("held-out case ids do not appear in phase dev", () => {
    const runlist = JSON.parse(readFileSync(join(CAL2, "runlist.json"), "utf-8")) as {
      phases: { dev: { case_id: string }[]; heldout: { case_id: string }[] };
    };
    const held = new Set(runlist.phases.heldout.map((e) => e.case_id));
    for (const e of runlist.phases.dev) expect(held.has(e.case_id)).toBe(false);
    expect(runlist.phases.heldout).toHaveLength(34);
    expect(runlist.phases.dev).toHaveLength(33);
  });

  it("leak-excluded cases do not appear in any runlist phase", () => {
    const inputs = JSON.parse(readFileSync(join(CAL2, "inputs.json"), "utf-8")) as {
      built: { case_id: string; leak_excluded: boolean }[];
    };
    const runlist = JSON.parse(readFileSync(join(CAL2, "runlist.json"), "utf-8")) as {
      phases: { dev: { case_id: string }[]; heldout: { case_id: string }[] };
    };
    const excluded = new Set(inputs.built.filter((b) => b.leak_excluded).map((b) => b.case_id));
    const inRunlist = [...runlist.phases.dev, ...runlist.phases.heldout].map((e) => e.case_id);
    for (const id of inRunlist) expect(excluded.has(id)).toBe(false);
    expect(inRunlist.length).toBe(runlist.phases.dev.length + runlist.phases.heldout.length);
  });

  it("MANIFEST input hashes change when an input byte changes", () => {
    const manifestPath = join(CAL2, "MANIFEST.json");
    const before = JSON.parse(readFileSync(manifestPath, "utf-8")) as { hashes: { inputs: Record<string, string> } };
    const first = Object.keys(before.hashes.inputs).sort()[0]!;
    const path = join(CAL2, first);
    const orig = readFileSync(path, "utf-8");
    writeFileSync(path, orig + "\n");
    const r = spawnSync(process.execPath, [TSX, join(CAL2, "manifest.mjs")], { cwd: CAL2, encoding: "utf-8" });
    expect(r.status).toBe(0);
    const after = JSON.parse(readFileSync(manifestPath, "utf-8")) as { hashes: { inputs: Record<string, string> } };
    expect(after.hashes.inputs[first]).not.toBe(before.hashes.inputs[first]);
    writeFileSync(path, orig);
    spawnSync(process.execPath, [TSX, join(CAL2, "manifest.mjs")], { cwd: CAL2 });
  });
});
