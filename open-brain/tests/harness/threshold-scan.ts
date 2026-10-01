/**
 * The threshold scan, and the scope that was A6's actual defect.
 *
 * ## What went wrong the first time
 *
 * The first candidate scanned **one region of one file** — `policies.ts` below
 * its `Applying a policy` marker — and called that "no threshold hides in the
 * decision code". QA planted `"… Answer at least 0.7 if so."` into the
 * `has_observable_acceptance` prompt in `gate.ts` and the whole harness suite
 * stayed green: 17/17 in the policy tests, 234/234 overall.
 *
 * **The detector was fine. It was pointed at the wrong place.** `docs/HOH-JEV.md`
 * §4 says thresholds live in `harness/policies/` and *never in a prompt*, and
 * the prompts were outside every scan in the repository. So was `runtime.ts`,
 * where the state each gate judges is assembled.
 *
 * This lives in its own module rather than inside one test file because three
 * things now need it: the scan itself, its fixtures, and the assertion that its
 * scope has not quietly narrowed again.
 *
 * ## What it can and cannot see
 *
 * It reads **code**, with comments stripped, and looks for a decimal literal.
 * That catches `0.7` in a prompt string, in a comparison, or in a context
 * object. It does **not** catch a threshold spelled `7 / 10`, one assembled
 * from a template, or one written into a file this list does not name — which
 * is why the scope is asserted as data rather than left implicit.
 */

import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const SRC = resolve(here, "../../src/harness");

export interface ThresholdScanTarget {
  /** File name under `src/harness/`. */
  file: string;
  /**
   * Scan from the first occurrence of this marker to the end of the file, or
   * the whole file when null.
   *
   * `policies.ts` is the one place a threshold is *supposed* to appear — in the
   * zod schema's range bounds and in the shipped documentation strings — so it
   * is scanned from the point where thresholds start being APPLIED.
   */
  from: string | null;
}

/**
 * Everywhere a threshold could hide and still reach a decision.
 *
 * Asserted as a list by `policies.test.ts`, so narrowing it is a test change
 * someone has to make on purpose rather than an omission nobody notices.
 */
export const THRESHOLD_SCAN_TARGETS: readonly ThresholdScanTarget[] = [
  // Where the numbers are applied.
  { file: "policies.ts", from: "Applying a policy" },
  // Where the questions are written. §4's "never in a prompt".
  { file: "gate.ts", from: null },
  // Where the state each gate judges is assembled.
  { file: "runtime.ts", from: null },
  // Slice four's runners assemble what each shadow gate's decision receives (QA 240 G6): a literal
  // here is a threshold, the same as one in a prompt.
  { file: "shadow-gates.ts", from: null },
  { file: "shadow-qa.ts", from: null },
];

/** Strip block and line comments. **This scan is about code.** */
function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
}

/**
 * Every decimal literal in a fragment of code.
 *
 * The lookarounds keep it off version strings and property paths: in
 * `jev-1.13.0` the `1.13` is followed by `.`, and in `a.1.2` preceded by one.
 */
export function thresholdLiterals(source: string): string[] {
  return [...stripComments(source).matchAll(/(?<![\w.])\d+\.\d+(?![\w.])/g)].map((m) => m[0]!);
}

export interface ThresholdRegion {
  file: string;
  text: string;
}

/**
 * The exact text each target contributes, so a test can assert the scan looked
 * at something.
 *
 * Throws when a file or a marker is missing rather than returning an empty
 * region: *a check must prove it looked*, and a scan over a path that no longer
 * resolves reports a clean result having read nothing.
 */
export function thresholdScanRegions(): ThresholdRegion[] {
  return THRESHOLD_SCAN_TARGETS.map((target) => {
    const path = join(SRC, target.file);
    const source = readFileSync(path, "utf-8");
    if (target.from === null) return { file: target.file, text: source };
    const at = source.lastIndexOf(target.from);
    if (at < 0) {
      throw new Error(
        `the marker "${target.from}" is gone from ${target.file}, so this scan would have read ` +
          `nothing and reported it clean. Restore the marker or change the target.`,
      );
    }
    return { file: target.file, text: source.slice(at) };
  });
}

export interface ThresholdOffender {
  file: string;
  literal: string;
}

/** Every threshold literal found in any scanned region of the shipped source. */
export function scanThresholds(): ThresholdOffender[] {
  const out: ThresholdOffender[] = [];
  for (const region of thresholdScanRegions()) {
    for (const literal of thresholdLiterals(region.text)) out.push({ file: region.file, literal });
  }
  return out;
}
