/**
 * Slice four, G4 — the 4.3 reconstructions (S4-4b): eight D_t files, each rebuilt AFTER the work,
 * from the diff's prose brief only, by a seat that did not build the diff.
 *
 * The building seats below are copied from the planner's mapping file,
 * `docs/loops/loop-15-slice-4-reconstruction-map.md` (docs commit c3ba18e4, PR #249), which names
 * each one from the diff's developer handoff on origin/master at 2448a6ea. QA checks the
 * reconstructions against that file; this table is the same check made at build time.
 */

import { describe, it, expect } from "vitest";
import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { PlanSchema, validatePlan } from "../../src/harness/schema.js";
import { harnessEnv } from "./s4-canary.js";

const REPO = resolve(__dirname, "../../..");
const RECORDS = "docs/loops/loop-15-slice-4-records";
const TSX = resolve(__dirname, "../../node_modules/tsx/dist/cli.mjs");
const CLI = resolve(__dirname, "../../src/harness/cli.ts");

interface Row {
  pr: number;
  diff: string;
  loop: string;
  brief: string;
  /** Checkout plus model, as the map names it. */
  builtBy: string;
}

const MAP: readonly Row[] = [
  { pr: 182, diff: "A", loop: "15-slice-3-a", brief: "docs/loops/loop-15-slice-3-brief.md", builtBy: "grok seat, Grok 4.7" },
  { pr: 165, diff: "B part 1", loop: "15-slice-3-b1", brief: "docs/loops/loop-15-slice-3-b-step1-brief.md", builtBy: "sia-infra, Claude Opus 5.5" },
  { pr: 187, diff: "B part 2", loop: "15-slice-3-b2", brief: "docs/loops/loop-15-slice-3-b2-brief.md", builtBy: "sia-forge, Grok 4.7" },
  { pr: 195, diff: "C", loop: "15-slice-3-c", brief: "docs/loops/loop-15-slice-3-c-brief.md", builtBy: "sia-forge, Claude Code" },
  { pr: 209, diff: "T-195", loop: "15-t195", brief: "docs/loops/t194-t195-dispatch.md", builtBy: "sia-forge, Grok 4.7" },
  { pr: 227, diff: "T-198", loop: "15-t198", brief: "docs/loops/t198-presence-dispatch.md", builtBy: "sia-forge, Claude Code" },
  { pr: 220, diff: "T-196/T-197", loop: "15-t196-t197", brief: "docs/loops/t196-t197-dispatch.md", builtBy: "cursor-infra, Cursor" },
  { pr: 218, diff: "T-158", loop: "15-t158", brief: "docs/loops/t158-t164-dispatch.md", builtBy: "cursor-infra, Cursor" },
];

const RECONSTRUCTOR = "sia-builder";

const dtPath = (pr: number): string => `${RECORDS}/pr-${pr}.D_t.json`;
const load = (pr: number): Record<string, unknown> => JSON.parse(readFileSync(resolve(REPO, dtPath(pr)), "utf-8")) as Record<string, unknown>;

/** The blob a path has in HEAD, from git (immune to a checkout's line-ending settings). */
const blobAtHead = (path: string): string =>
  execFileSync("git", ["rev-parse", `HEAD:${path}`], { cwd: REPO, encoding: "utf-8", shell: false }).trim();

const validPlan = () => ({
  loop: "15-x",
  objective: "o",
  tasks: ["t"],
  out_of_scope: ["x"],
  preserve: ["p"],
  acceptance: [{ id: "A1", observable: "o", type: "blackbox" as const }],
  repair_targets: ["r"],
  new_capability: "c",
});

describe("the plan schema carries reconstruction provenance (S4-4b.2)", () => {
  it("S1 a plan without reconstructed_by and reconstructed_from still validates (written-before)", () => {
    expect(validatePlan(validPlan()).ok).toBe(true);
  });

  it("S2 both fields set together validate; one without the other is refused; a bad blob is refused", () => {
    const from = { path: "docs/loops/x.md", blob: "a".repeat(40) };
    expect(validatePlan({ ...validPlan(), reconstructed_by: "sia-builder", reconstructed_from: from }).ok).toBe(true);
    expect(validatePlan({ ...validPlan(), reconstructed_by: "sia-builder" }).ok).toBe(false);
    expect(validatePlan({ ...validPlan(), reconstructed_from: from }).ok).toBe(false);
    expect(validatePlan({ ...validPlan(), reconstructed_by: "sia-builder", reconstructed_from: { ...from, blob: "abc" } }).ok).toBe(false);
    expect(validatePlan({ ...validPlan(), reconstructed_by: "", reconstructed_from: from }).ok).toBe(false);
    expect(validatePlan({ ...validPlan(), reconstructed_by: "sia-builder", reconstructed_from: { ...from, extra: 1 } }).ok).toBe(false);
  });

  it("S3 the derived plan.schema.json lists both fields as optional properties", () => {
    const schema = JSON.parse(readFileSync(resolve(__dirname, "../../src/harness/schemas/plan.schema.json"), "utf-8")) as {
      properties: Record<string, unknown>;
      required: string[];
    };
    expect(Object.keys(schema.properties)).toContain("reconstructed_by");
    expect(Object.keys(schema.properties)).toContain("reconstructed_from");
    expect(schema.required).not.toContain("reconstructed_by");
    expect(schema.required).not.toContain("reconstructed_from");
    expect(PlanSchema).toBeDefined();
  });
});

describe("the eight reconstructed D_t files (S4-4b)", () => {
  it("R0 exactly eight D_t files exist under the records directory", () => {
    const found = readdirSync(resolve(REPO, RECORDS)).filter((n) => n.endsWith(".D_t.json")).sort();
    expect(found).toEqual(MAP.map((r) => `pr-${r.pr}.D_t.json`).sort());
  });

  for (const row of MAP) {
    describe(`PR ${row.pr} (${row.diff})`, () => {
      it("R1 validates, and its loop id is a seat id, not a runtime-shaped tNNN", () => {
        const json = load(row.pr);
        const v = validatePlan(json);
        expect(v.ok, v.ok ? "" : v.problems.join(" | ")).toBe(true);
        expect(json.loop).toBe(row.loop);
        expect(String(json.loop)).not.toMatch(/^t\d{3,}$/);
      });

      it("R2 names its reconstructing seat, and that seat is not the one that built the diff", () => {
        const json = load(row.pr);
        expect(json.reconstructed_by).toBe(RECONSTRUCTOR);
        expect(row.builtBy.toLowerCase()).not.toContain(RECONSTRUCTOR);
        expect(row.builtBy.toLowerCase()).not.toContain(String(json.reconstructed_by).toLowerCase());
      });

      it("R3 names the prose brief it was built from, by path and by the blob that path has in HEAD", () => {
        const json = load(row.pr) as { reconstructed_from: { path: string; blob: string } };
        expect(json.reconstructed_from.path).toBe(row.brief);
        expect(existsSync(resolve(REPO, row.brief))).toBe(true);
        expect(json.reconstructed_from.blob).toBe(blobAtHead(row.brief));
      });

      it("R4 cites no developer handoff and no sha other than its source blob", () => {
        // A reconstruction is from prose. This is the weaker, mechanical half of that: the file
        // does not name a handoff, a merge commit or a scored head, which are the code's side.
        const text = readFileSync(resolve(REPO, dtPath(row.pr)), "utf-8");
        expect(text).not.toMatch(/developer-handoff/);
        expect(text).not.toMatch(/\b[0-9a-f]{40}\b(?<!"blob": "[0-9a-f]{40})/); // the only 40-hex allowed is the blob
      });

      it("R5 contains no occurrence of the forbidden word (S4-5b)", () => {
        const text = readFileSync(resolve(REPO, dtPath(row.pr)), "utf-8");
        expect(text).not.toMatch(new RegExp(`\\b${"calibrat"}${"ed"}\\b`, "i"));
      });
    });
  }

  it("R6 `harness validate plan` exits 0 on all eight", () => {
    for (const row of MAP) {
      const r = spawnSync(process.execPath, [TSX, CLI, "validate", "plan", resolve(REPO, dtPath(row.pr))], {
        cwd: REPO,
        encoding: "utf-8",
        shell: false,
        timeout: 120_000,
        env: harnessEnv(),
      });
      if (r.error) throw r.error;
      expect(r.status, `${row.pr}: ${r.stdout}${r.stderr}`).toBe(0);
    }
  });
});
