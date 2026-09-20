/**
 * Deterministic checks — build and unit tests — whose verdict is the **process
 * exit code** and nothing else.
 *
 * Acceptance A7. The rule it encodes is narrow and specific: *reading the
 * number instead of the output*. In this project's own record, `head`'s exit
 * code was captured instead of `node`'s and produced a green zero from a server
 * that had crashed, **inside the test for whether the thing installs**. The
 * defence is not care. It is that no function here is given stdout to judge.
 *
 * `runCheck` returns the outcome; it never throws on a failing command, because
 * a failing build is an ANSWER. It returns `passed: false` with `exit_code:
 * null` when the command could not be spawned at all — a distinct fact from
 * "ran and failed", and never a pass.
 */

import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import type { CheckOutcome } from "./schema.js";

export interface CheckSpec {
  /** Executable, run with no shell. */
  command: string;
  args: readonly string[];
  /** Milliseconds before the check is killed and recorded as failed. */
  timeoutMs?: number;
}

export interface DeterministicChecks {
  build: CheckSpec;
  unit: CheckSpec;
}

/**
 * How to invoke npm **without a shell**, which on Windows is not "npm.cmd".
 *
 * ## The defect this exists to fix
 *
 * The first version picked `npm.cmd` on win32 and spawned it with
 * `shell: false`. **Node 18.20/20.12/22 refuse to spawn a batch file that
 * way** — the fix for CVE-2024-27980 — so every default check died with
 * `EINVAL` on the platform this repo is developed on. The runtime recorded that
 * honestly as a failure, which is why acceptance A7 still held, and the loop
 * exited 1: **a stranger following the README got a red loop from the first
 * command.** QA found it by running the documented command verbatim. The suite
 * did not, because it asserted the command's NAME and never ran it.
 *
 * The fix is not `shell: true`. A shell is how `^` got eaten and how an exit
 * code stops belonging to the process under test. Instead we spawn **node with
 * npm's own JavaScript entry point**, which is a real executable running a real
 * script, with arguments passed verbatim.
 *
 * Returns `null` when npm cannot be located, and the caller turns that into a
 * recorded failure naming the problem. **It never falls back to a bare `"npm"`
 * that would `ENOENT` on win32 and look like a different fault.**
 */
export function resolveNpm(): { command: string; args: string[] } | null {
  const fromEnv = process.env.npm_execpath;
  if (fromEnv && fromEnv.endsWith(".js") && existsSync(fromEnv)) {
    return { command: process.execPath, args: [fromEnv] };
  }
  const nodeDir = dirname(process.execPath);
  const candidates = [
    join(nodeDir, "node_modules", "npm", "bin", "npm-cli.js"),
    join(nodeDir, "..", "lib", "node_modules", "npm", "bin", "npm-cli.js"),
    join(nodeDir, "..", "node_modules", "npm", "bin", "npm-cli.js"),
  ];
  for (const c of candidates) {
    if (existsSync(c)) return { command: process.execPath, args: [c] };
  }
  // On a POSIX box `npm` is an ordinary executable and spawns fine without a
  // shell. On win32 it is not, so there is deliberately no fallback there.
  if (process.platform !== "win32") return { command: "npm", args: [] };
  return null;
}

/** A check that cannot run, expressed as a spec so the failure is recorded rather than thrown. */
const unresolvableNpm = (what: string): CheckSpec => ({
  command: process.execPath,
  args: [
    "-e",
    `console.error(${JSON.stringify(
      `npm could not be located for the ${what} check. Set npm_execpath, or pass --build-cmd/--unit-cmd.`,
    )}); process.exit(127);`,
  ],
  timeoutMs: 30_000,
});

/** The checks a loop runs when the caller names none. */
export function defaultChecks(): DeterministicChecks {
  const npm = resolveNpm();
  if (!npm) {
    return { build: unresolvableNpm("build"), unit: unresolvableNpm("unit") };
  }
  return {
    build: {
      command: npm.command,
      args: [...npm.args, "--prefix", "open-brain", "run", "build"],
      timeoutMs: 300_000,
    },
    unit: {
      command: npm.command,
      args: [...npm.args, "--prefix", "open-brain", "test"],
      timeoutMs: 900_000,
    },
  };
}

const render = (spec: CheckSpec): string => [spec.command, ...spec.args].join(" ");

/**
 * Run one check and report its outcome.
 *
 * **`shell: false`.** The command and its arguments reach the process verbatim,
 * which is what makes the exit code attributable: with a shell in the way the
 * status can belong to the shell, or to the last element of a pipeline, rather
 * than to the thing under test.
 */
export function runCheck(spec: CheckSpec, cwd: string): CheckOutcome {
  const started = Date.now();
  const r = spawnSync(spec.command, [...spec.args], {
    cwd,
    encoding: "utf-8",
    shell: false,
    timeout: spec.timeoutMs ?? 300_000,
    stdio: ["ignore", "pipe", "pipe"],
  });
  const duration = Date.now() - started;

  if (r.error) {
    return {
      command: render(spec),
      exit_code: null,
      passed: false,
      duration_ms: duration,
      detail: `could not run: ${r.error.message}. A command that did not run is not a command that passed.`,
    };
  }
  if (r.signal) {
    return {
      command: render(spec),
      exit_code: null,
      passed: false,
      duration_ms: duration,
      detail: `killed by signal ${r.signal} after ${duration}ms (timeout ${spec.timeoutMs ?? 300_000}ms)`,
    };
  }

  const code = r.status;
  if (code === null) {
    return {
      command: render(spec),
      exit_code: null,
      passed: false,
      duration_ms: duration,
      detail: "process reported no exit status — treated as failure, never as a pass",
    };
  }

  return {
    command: render(spec),
    exit_code: code,
    // The whole point of the module: this expression, and no other.
    passed: code === 0,
    duration_ms: duration,
    detail:
      code === 0
        ? `exit 0 in ${duration}ms`
        : `exit ${code} in ${duration}ms; last stderr line: ${lastLine(r.stderr) || "(none)"}`,
  };
}

/**
 * A stderr line is carried into `detail` for a human reading the report.
 *
 * It is not consulted by anything. If this function returned the wrong line, or
 * an empty string, no verdict would change.
 */
function lastLine(stderr: string | null): string {
  if (!stderr) return "";
  const lines = stderr.split(/\r?\n/).filter((l) => l.trim() !== "");
  return lines.length > 0 ? lines[lines.length - 1]!.slice(0, 300) : "";
}

export interface CheckRunResults {
  build: CheckOutcome;
  unit: CheckOutcome;
  allPassed: boolean;
}

/** Run both checks in order. The build runs first; the unit run happens regardless. */
export function runDeterministicChecks(checks: DeterministicChecks, cwd: string): CheckRunResults {
  const build = runCheck(checks.build, cwd);
  const unit = runCheck(checks.unit, cwd);
  return { build, unit, allPassed: build.passed && unit.passed };
}

/**
 * Whether a role-supplied `runtime_checks` block agrees with what was measured.
 *
 * The QA role may report the checks, but it does not get to *decide* them. A
 * disagreement is a defect in the evidence and is refused, rather than
 * overwritten — silently replacing the role's numbers with the runtime's would
 * hide a role that is fabricating results, which is precisely the thing a
 * separate QA seat exists to make visible.
 */
export function reconcileReportedChecks(
  measured: CheckRunResults,
  reported: { build: CheckOutcome; unit: CheckOutcome } | undefined,
): { ok: boolean; problems: string[] } {
  if (!reported) return { ok: true, problems: [] };
  const problems: string[] = [];
  for (const key of ["build", "unit"] as const) {
    const m = measured[key];
    const r = reported[key];
    if (r.exit_code !== m.exit_code || r.passed !== m.passed) {
      problems.push(
        `runtime_checks.${key}: the report says exit_code=${r.exit_code} passed=${r.passed}, ` +
          `the runtime measured exit_code=${m.exit_code} passed=${m.passed}`,
      );
    }
  }
  return { ok: problems.length === 0, problems };
}
