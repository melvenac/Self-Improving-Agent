import { describe, it, expect } from "vitest";
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, realpathSync, symlinkSync, existsSync } from "node:fs";
import { join, sep } from "node:path";
import { tmpdir } from "node:os";
import { spawnSync } from "node:child_process";

/**
 * QA 120 (T-185): try to make a test in the style of tests/cli-flags.test.ts spawn the CLI against a
 * checkout outside the temp dir. `inScratch` and `cli` are copied VERBATIM from cli-flags.test.ts at
 * 9473b0d (they are not exported). The "checkout" is a stand-in project, QA120_VICTIM, created by the
 * runner script outside the temp dir (C:\qa-scratch\t185-victim) — never the real repository.
 * Copy this file into open-brain/tests/ of a scratch clone to run it.
 */

const cliEntry = join(import.meta.dirname, "../src/cli.ts");
const tsxCli = join(import.meta.dirname, "../node_modules/tsx/dist/cli.mjs");
const TMP = realpathSync(tmpdir());
interface Run { status: number | null; stdout: string; stderr: string }
function inScratch(dir: string): void {
  const real = realpathSync(dir);
  if (!real.startsWith(TMP + sep)) throw new Error(`refusing to run the CLI outside the temp dir: ${real}`);
}
function cli(cwd: string, ...args: string[]): Run {
  inScratch(cwd);
  const r = spawnSync(process.execPath, [tsxCli, cliEntry, ...args], { cwd, encoding: "utf8", env: process.env, timeout: 90_000 });
  return { status: r.status, stdout: r.stdout ?? "", stderr: r.stderr ?? "" };
}

const VICTIM = process.env.QA120_VICTIM!;
const readme = () => readFileSync(join(VICTIM, "README.md"), "utf8");

describe("QA 120: inScratch", () => {
  it("premise: the victim is outside the temp dir and a fixing sync would change it", () => {
    expect(VICTIM).toBeTruthy();
    expect(realpathSync(VICTIM).startsWith(TMP + sep)).toBe(false);
    expect(readme()).toContain("**Latest: v0.0.1**");
  });

  it("A1: cwd = the victim -> inScratch throws before anything spawns", () => {
    expect(() => cli(VICTIM, "sync")).toThrow(/outside the temp dir/);
    expect(readme()).toContain("**Latest: v0.0.1**");
  });

  it("A2: cwd = a junction inside the temp dir that points at the victim -> realpath sees through it", () => {
    const j = join(mkdtempSync(join(TMP, "qa120-j-")), "link");
    symlinkSync(VICTIM, j, "junction");
    expect(existsSync(join(j, "README.md"))).toBe(true);
    expect(() => cli(j, "sync")).toThrow(/outside the temp dir/);
    expect(readme()).toContain("**Latest: v0.0.1**");
  });

  it("A3: cwd inside the temp dir, the VICTIM passed as the positional -> the guard does not look at it", () => {
    const cwd = mkdtempSync(join(TMP, "qa120-p-"));
    const r = cli(cwd, "sync", VICTIM);
    // Recorded, not hoped: exit 0 and the victim's README rewritten means the guard was bypassed.
    console.log(`A3 status=${r.status} README now: ${JSON.stringify(readme().split("\n")[2])}`);
    expect(r.status).toBe(0);
    expect(readme()).not.toContain("**Latest: v0.0.1**");
  }, 120_000);
});
