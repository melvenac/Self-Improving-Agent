/** The heavy suite's vitest JSON report, written in the suite's cwd (T-283). Not the SUITE_VITEST_JSON env var, which names a test fixture. */
export const SUITE_VITEST_REPORT = "suite-vitest.json";

/**
 * T-283: the arguments for `npx vitest` in cli-suite-run.ts, which runs under shell:true (Windows reaches npx.cmd only
 * through a shell). Node joins shell arguments with spaces and quotes none of them, so no element may hold a path: an
 * absolute --outputFile split on a cwd with a space (the QA PC's home). vitest resolves --outputFile against
 * config.root, which vitest.config.ts sets to the cwd.
 */
export function suiteVitestArgs(): string[] {
  return ["vitest", "run", "--reporter=json", "--outputFile", SUITE_VITEST_REPORT];
}
