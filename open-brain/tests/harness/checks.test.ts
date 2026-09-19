import { describe, it, expect } from "vitest";
import {
  defaultChecks,
  reconcileReportedChecks,
  runCheck,
  runDeterministicChecks,
} from "../../src/harness/checks.js";
import { exitingCheck, exitingChecks } from "./fixture.js";

/**
 * Acceptance A7 — the verdict comes from the exit code.
 *
 * The defect these guard against is in this project's own record: `head`'s exit
 * code was captured instead of `node`'s and produced a green zero from a server
 * that had crashed, inside the test for whether the thing installs. So the
 * central cases here are commands whose STDOUT and EXIT CODE disagree.
 */
describe("runCheck", () => {
  it("passes on exit 0", () => {
    const r = runCheck(exitingCheck(0), process.cwd());
    expect(r.exit_code).toBe(0);
    expect(r.passed).toBe(true);
  });

  it("fails on a non-zero exit", () => {
    const r = runCheck(exitingCheck(1), process.cwd());
    expect(r.exit_code).toBe(1);
    expect(r.passed).toBe(false);
  });

  it("fails on exit 1 even when stdout says every test passed", () => {
    // The whole point. A command that prints success and exits non-zero is a
    // failure, and nothing here is given the text to be fooled by.
    const r = runCheck(exitingCheck(1, "All 648 tests passed! Build succeeded. OK."), process.cwd());
    expect(r.passed).toBe(false);
    expect(r.exit_code).toBe(1);
  });

  it("passes on exit 0 even when stdout is full of the word error", () => {
    const r = runCheck(exitingCheck(0, "error error FAILED error"), process.cwd());
    expect(r.passed).toBe(true);
  });

  it("carries a non-zero exit code through verbatim rather than normalising it", () => {
    expect(runCheck(exitingCheck(2), process.cwd()).exit_code).toBe(2);
    expect(runCheck(exitingCheck(127), process.cwd()).exit_code).toBe(127);
  });

  it("records a command that could not be spawned as a failure with a null exit code", () => {
    // "Did not run" and "ran and failed" are different facts. Neither is a pass.
    const r = runCheck({ command: "definitely-not-a-real-binary-xyzzy", args: [] }, process.cwd());
    expect(r.passed).toBe(false);
    expect(r.exit_code).toBeNull();
    expect(r.detail).toContain("A command that did not run is not a command that passed");
  });

  it("records a timeout as a failure rather than letting it hang the loop", () => {
    const r = runCheck(
      { command: process.execPath, args: ["-e", "setTimeout(()=>{}, 60000)"], timeoutMs: 400 },
      process.cwd(),
    );
    expect(r.passed).toBe(false);
    expect(r.exit_code).toBeNull();
  });

  it("measures a duration and reports the command it ran", () => {
    const r = runCheck(exitingCheck(0), process.cwd());
    expect(r.duration_ms).toBeGreaterThanOrEqual(0);
    expect(r.command).toContain(process.execPath);
  });
});

describe("runDeterministicChecks", () => {
  it("is green only when both checks exit 0", () => {
    expect(runDeterministicChecks(exitingChecks(0, 0), process.cwd()).allPassed).toBe(true);
  });

  it.each([
    [1, 0],
    [0, 1],
    [1, 1],
  ])("is red when build exits %i and unit exits %i", (b, u) => {
    expect(runDeterministicChecks(exitingChecks(b, u), process.cwd()).allPassed).toBe(false);
  });

  it("runs the unit check even when the build fails, so the report is complete", () => {
    const r = runDeterministicChecks(exitingChecks(1, 0), process.cwd());
    expect(r.build.passed).toBe(false);
    expect(r.unit.exit_code).toBe(0);
  });
});

describe("no process in the harness is spawned through a shell", () => {
  /**
   * A7 as a property of the source, not of one observed run.
   *
   * An exit code that happens to be right in the run you watched does not tell
   * you a shell was not in the way — `head`'s exit code standing in for
   * `node`'s was green in every run until someone looked at the source. So this
   * asserts the source directly, and validates its own patterns against planted
   * positives first.
   */
  const SHELL_TRUE = /shell:\s*true/;
  const SHELL_PLATFORM = /shell:\s*process\.platform/;
  const TEMPLATE_COMMAND = /(?:execSync|exec)\s*\(\s*`/;

  it("validates its patterns against known positives before trusting a negative", () => {
    expect(SHELL_TRUE.test("spawnSync(cmd, args, { shell: true })")).toBe(true);
    expect(SHELL_PLATFORM.test('{ shell: process.platform === "win32" }')).toBe(true);
    expect(TEMPLATE_COMMAND.test("execSync(`npm run ${task}`)")).toBe(true);
    expect(SHELL_TRUE.test("spawnSync(cmd, args, { shell: false })")).toBe(false);
  });

  it("finds no shell spawn in any harness source file", async () => {
    const { readdirSync, readFileSync } = await import("node:fs");
    const { join, resolve } = await import("node:path");
    const dir = resolve(__dirname, "../../src/harness");
    const walk = (d: string, out: string[] = []): string[] => {
      for (const e of readdirSync(d, { withFileTypes: true })) {
        if (e.isDirectory()) walk(join(d, e.name), out);
        else if (e.name.endsWith(".ts")) out.push(join(d, e.name));
      }
      return out;
    };
    const files = walk(dir);
    expect(files.length, "the scan must prove it looked").toBeGreaterThanOrEqual(8);

    const offenders: string[] = [];
    for (const f of files) {
      const src = readFileSync(f, "utf-8");
      if (SHELL_TRUE.test(src) || SHELL_PLATFORM.test(src) || TEMPLATE_COMMAND.test(src)) offenders.push(f);
    }
    expect(offenders, `harness source spawns through a shell: ${offenders.join(", ")}`).toEqual([]);
  });
});

describe("defaultChecks", () => {
  it("names npm without a shell, and points at open-brain", () => {
    const d = defaultChecks();
    expect(d.build.command).toMatch(/^npm(\.cmd)?$/);
    expect(d.build.args).toContain("open-brain");
    expect(d.unit.args).toContain("test");
  });
});

describe("reconcileReportedChecks", () => {
  const measured = runDeterministicChecks(exitingChecks(1, 0), process.cwd());

  it("accepts a report that omits runtime_checks entirely", () => {
    expect(reconcileReportedChecks(measured, undefined).ok).toBe(true);
  });

  it("accepts a report that agrees with the measurement", () => {
    const r = reconcileReportedChecks(measured, { build: measured.build, unit: measured.unit });
    expect(r.ok).toBe(true);
  });

  it("refuses a report claiming the build passed when the runtime measured a failure", () => {
    // A QA seat that fabricates a green build is exactly what a separate QA
    // seat exists to make visible. The runtime refuses rather than overwriting.
    const r = reconcileReportedChecks(measured, {
      build: { ...measured.build, exit_code: 0, passed: true },
      unit: measured.unit,
    });
    expect(r.ok).toBe(false);
    expect(r.problems.join(" ")).toContain("runtime_checks.build");
    expect(r.problems.join(" ")).toContain("the runtime measured");
  });

  it("names both checks when both disagree", () => {
    const r = reconcileReportedChecks(measured, {
      build: { ...measured.build, exit_code: 0, passed: true },
      unit: { ...measured.unit, exit_code: 9, passed: false },
    });
    expect(r.problems).toHaveLength(2);
  });
});
