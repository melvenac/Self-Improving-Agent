import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { readFileSync, writeFileSync, mkdtempSync, rmSync, cpSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { tmpdir } from "node:os";
import { parse as parseYaml } from "yaml";

const repoRoot = join(import.meta.dirname, "../../../..");
const TCM_RUNNER = ["self-hosted", "linux", "tcm"] as const;
const UBUNTU_RUNNER = "ubuntu-latest";

const PRE_T192_RUNS_ON =
  '${{ ((github.event_name == \'push\' && github.ref == \'refs/heads/master\') || inputs.hosted) && \'ubuntu-latest\' || fromJSON(\'["self-hosted", "linux", "tcm"]\') }}';

export type CiGithubContext = {
  event_name: string;
  ref: string;
  inputs: { hosted: boolean };
};

type CiWorkflowDoc = {
  on?: Record<string, unknown>;
  jobs?: { test?: { "runs-on"?: unknown } };
};

function readCiWorkflow(projectRoot: string): CiWorkflowDoc {
  const raw = readFileSync(join(projectRoot, ".github/workflows/ci.yml"), "utf-8");
  return parseYaml(raw) as CiWorkflowDoc;
}

/** Parses the `test` job `runs-on` field from ci.yml (YAML parser, not regex). */
export function readCiTestRunsOnExpr(projectRoot: string): string {
  const runsOn = readCiWorkflow(projectRoot)?.jobs?.test?.["runs-on"];
  if (typeof runsOn !== "string") throw new Error("ci.yml test job runs-on is missing or not a string");
  return runsOn.trim();
}

export const PR_PATHS_IGNORE = ["docs/**", "README.md"] as const;

/** Reads the workflow `on:` triggers from ci.yml. */
export function readCiWorkflowTriggers(projectRoot: string): Record<string, unknown> {
  return readCiWorkflow(projectRoot).on ?? {};
}

/** Evaluates the expression string read from ci.yml for the GitHub context given. */
export function evaluateRunsOnExpression(runsOn: string, ctx: CiGithubContext): string | string[] {
  const m = runsOn.match(/^\$\{\{\s*(.+)\s*\}\}$/s);
  if (!m) throw new Error(`runs-on is not a GitHub expression: ${runsOn}`);
  const fn = new Function("inputs", "github", "fromJSON", `return (${m[1].trim()});`);
  return fn(ctx.inputs, { event_name: ctx.event_name, ref: ctx.ref }, JSON.parse) as string | string[];
}

function patchCiRunsOn(projectRoot: string, runsOn: string) {
  const path = join(projectRoot, ".github/workflows/ci.yml");
  const lines = readFileSync(path, "utf-8").split(/\r?\n/);
  const idx = lines.findIndex((l) => /^\s*runs-on:/.test(l));
  if (idx < 0) throw new Error("runs-on line not found");
  lines[idx] = `    runs-on: ${runsOn}`;
  writeFileSync(path, lines.join("\n"));
}

describe("ci.yml test job runs-on (T-192 item 1)", () => {
  const cases: Array<[string, CiGithubContext, string | readonly string[]]> = [
    ["master push → tcm", { event_name: "push", ref: "refs/heads/master", inputs: { hosted: false } }, TCM_RUNNER],
    ["dispatch → tcm", { event_name: "workflow_dispatch", ref: "refs/heads/master", inputs: { hosted: false } }, TCM_RUNNER],
    ["dispatch hosted=true → ubuntu-latest", { event_name: "workflow_dispatch", ref: "refs/heads/master", inputs: { hosted: true } }, UBUNTU_RUNNER],
    ["push to non-master branch → tcm", { event_name: "push", ref: "refs/heads/feature/x", inputs: { hosted: false } }, TCM_RUNNER],
  ];

  it("evaluates the expression parsed from ci.yml for four cases", () => {
    const expr = readCiTestRunsOnExpr(repoRoot);
    for (const [label, ctx, want] of cases) {
      expect(evaluateRunsOnExpression(expr, ctx), label).toEqual(want);
    }
  });

  it("pull_request paths-ignore is exactly docs/** and README.md; push and dispatch have no paths filter (D-055)", () => {
    const on = readCiWorkflowTriggers(repoRoot);
    expect(on.push).toEqual({ branches: ["master"] });
    expect(on.pull_request).toEqual({ "paths-ignore": [...PR_PATHS_IGNORE] });
    expect(on.workflow_dispatch).toBeTypeOf("object");
    expect(on.workflow_dispatch).not.toHaveProperty("paths");
    expect(on.workflow_dispatch).not.toHaveProperty("paths-ignore");
  });

  describe("mutant: ci.yml runs-on restored to pre-T-192 master-push clause", () => {
    let scratch: string;

    beforeEach(() => {
      scratch = mkdtempSync(join(tmpdir(), "ob-ci-yml-mut-"));
      mkdirSync(join(scratch, ".github/workflows"), { recursive: true });
      cpSync(join(repoRoot, ".github/workflows/ci.yml"), join(scratch, ".github/workflows/ci.yml"));
      patchCiRunsOn(scratch, PRE_T192_RUNS_ON);
    });

    afterEach(() => {
      rmSync(scratch, { recursive: true, force: true });
    });

    it("master push row goes red (ubuntu-latest, not tcm)", () => {
      const [label, ctx, want] = cases[0];
      const mutantExpr = readCiTestRunsOnExpr(scratch);
      expect(evaluateRunsOnExpression(mutantExpr, ctx), label).not.toEqual(want);
      expect(evaluateRunsOnExpression(mutantExpr, ctx)).toBe(UBUNTU_RUNNER);
    });
  });
});
