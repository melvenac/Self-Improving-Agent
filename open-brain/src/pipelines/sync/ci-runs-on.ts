/**
 * Evaluates the `test` job's `runs-on` expression from `.github/workflows/ci.yml`.
 * Uses a YAML parser (never regex) and a named evaluator for the four cases in T-192.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { parse as parseYaml } from "yaml";

export const TCM_RUNNER = ["self-hosted", "linux", "tcm"] as const;
export const UBUNTU_RUNNER = "ubuntu-latest";

/** Context fields the ci.yml `runs-on` expression reads. */
export interface CiRunsOnContext {
  event_name: string;
  ref: string;
  hosted: boolean;
}

/**
 * Evaluates the pinned expression after T-192:
 * `inputs.hosted && 'ubuntu-latest' || fromJSON('["self-hosted", "linux", "tcm"]')`
 */
export function evaluateCiTestRunsOn(ctx: CiRunsOnContext): string | readonly string[] {
  return ctx.hosted ? UBUNTU_RUNNER : TCM_RUNNER;
}

/** Reads the `test` job `runs-on` string from ci.yml at `projectRoot`. */
export function readCiTestRunsOnExpr(projectRoot: string): string {
  const raw = readFileSync(join(projectRoot, ".github/workflows/ci.yml"), "utf-8");
  const doc = parseYaml(raw) as { jobs?: { test?: { "runs-on"?: unknown } } };
  const runsOn = doc?.jobs?.test?.["runs-on"];
  if (typeof runsOn !== "string") {
    throw new Error("ci.yml test job runs-on is missing or not a string");
  }
  return runsOn.trim();
}

/** True when the checked-in expression matches the T-192 pin (hosted-only fallback). */
export function ciTestRunsOnExprMatchesPin(expr: string): boolean {
  const norm = expr.replace(/\s+/g, " ");
  return norm.includes("inputs.hosted") && norm.includes("ubuntu-latest") && norm.includes('fromJSON(\'["self-hosted", "linux", "tcm"]\')')
    && !norm.includes("github.event_name == 'push'");
}
