import { describe, it, expect, beforeAll, beforeEach, afterEach } from "vitest";
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { validatePlan } from "../../src/harness/schema.js";
import { makeRepo, requireGit, type RepoFixture } from "./fixture.js";

/**
 * Black-box tests: the real CLI, in a real process, against a real repository.
 *
 * **No shell.** `tsx` is invoked through its own entry module with
 * `process.execPath`, rather than through `npx` with `shell: true` on Windows.
 * That is not fussiness — a shell in the way is what ate the `^` in
 * `<sha>^{commit}` in this project's record, and a test harness that needs a
 * shell cannot assert that the thing it tests does not.
 */
const TSX = resolve(__dirname, "../../node_modules/tsx/dist/cli.mjs");
const CLI = resolve(__dirname, "../../src/harness/cli.ts");

const EXIT_ZERO = "node -e process.exit(0)";
const EXIT_ONE = "node -e process.exit(1)";

interface Run {
  status: number | null;
  stdout: string;
  stderr: string;
}

function harness(args: readonly string[], cwd: string): Run {
  const r = spawnSync(process.execPath, [TSX, CLI, ...args], {
    cwd,
    encoding: "utf-8",
    shell: false,
    timeout: 120_000,
  });
  if (r.error) throw r.error;
  return { status: r.status, stdout: r.stdout ?? "", stderr: r.stderr ?? "" };
}

describe("harness CLI", { timeout: 120_000 }, () => {
  let repo: RepoFixture;

  beforeAll(() => {
    requireGit();
    expect(existsSync(TSX), `tsx entry not found at ${TSX}`).toBe(true);
    expect(existsSync(CLI), `harness CLI not found at ${CLI}`).toBe(true);
  });
  beforeEach(() => { repo = makeRepo("harness-cli-"); });
  afterEach(() => repo.cleanup());

  describe("argument handling refuses rather than defaulting — T-150", () => {
    it("prints usage and exits non-zero with no subcommand", () => {
      const r = harness([], repo.root);
      expect(r.status).toBe(2);
      expect(r.stdout).toContain("harness run --loop");
      // A bare invocation must not have run anything.
      expect(existsSync(join(repo.root, "artifacts"))).toBe(false);
    });

    it("exits 0 for an explicit help request", () => {
      expect(harness(["help"], repo.root).status).toBe(0);
    });

    it("refuses an unknown subcommand", () => {
      const r = harness(["destroy"], repo.root);
      expect(r.status).toBe(2);
      expect(r.stderr).toContain('unknown subcommand "destroy"');
    });

    it("refuses an unrecognised flag instead of selecting the default action", () => {
      const r = harness(["run", "--loop", "t001", "--yolo"], repo.root);
      expect(r.status).toBe(2);
      expect(r.stderr).toContain('unrecognised argument "--yolo"');
      expect(existsSync(join(repo.root, "artifacts"))).toBe(false);
    });

    it("refuses a flag whose value is missing", () => {
      const r = harness(["run", "--loop", "--dry-run"], repo.root);
      expect(r.status).toBe(2);
      expect(r.stderr).toContain("--loop needs a value");
    });

    it("requires --loop", () => {
      const r = harness(["run"], repo.root);
      expect(r.status).toBe(2);
      expect(r.stderr).toContain("--loop is required");
    });

    it("refuses a malformed loop id", () => {
      expect(harness(["run", "--loop", "loop-1"], repo.root).status).toBe(2);
    });

    it("refuses a non-numeric --max-attempts", () => {
      const r = harness(["run", "--loop", "t001", "--max-attempts", "lots"], repo.root);
      expect(r.status).toBe(2);
      expect(r.stderr).toContain("--max-attempts must be a positive integer");
    });
  });

  describe("A1 — a full loop from the command line", () => {
    const runLoopCli = (extra: readonly string[] = []) =>
      harness(
        ["run", "--loop", "t001", "--repo", repo.root, "--build-cmd", EXIT_ZERO, "--unit-cmd", EXIT_ZERO, ...extra],
        repo.root,
      );

    it("exits 0 and writes the three artifacts", () => {
      const r = runLoopCli();
      expect(r.status, `stderr: ${r.stderr}\nstdout: ${r.stdout}`).toBe(0);
      for (const f of ["D_t.md", "A_t.gitref", "E_t.json"]) {
        expect(existsSync(join(repo.root, `artifacts/iterations/t001/${f}`)), `${f} missing`).toBe(true);
      }
    });

    it("writes a plan artifact that validates against the plan schema", () => {
      // Amendment 1: the binding requirement is that the plan artifact
      // validates, not what it is called. D_t.json is the source of truth and
      // D_t.md is its rendered view — the same shape as state.json and its
      // four rendered views in this repo.
      runLoopCli();
      const plan = JSON.parse(readFileSync(join(repo.root, "artifacts/iterations/t001/D_t.json"), "utf-8"));
      expect(validatePlan(plan).ok).toBe(true);
    });

    it("tags the loop with zero-padded three-digit numbers", () => {
      // Amendment 1: loop-001-developer, not loop-1-developer.
      runLoopCli();
      const tags = spawnSync("git", ["tag", "--list"], { cwd: repo.root, encoding: "utf-8", shell: false }).stdout;
      expect(tags).toContain("loop-001-developer");
      expect(tags).toContain("loop-001-qa");
      expect(tags).not.toContain("loop-1-developer");
    });

    it("exits non-zero when a deterministic check is red, and says so", () => {
      const r = harness(
        ["run", "--loop", "t001", "--repo", repo.root, "--build-cmd", EXIT_ONE, "--unit-cmd", EXIT_ZERO],
        repo.root,
      );
      expect(r.status).toBe(1);
      expect(r.stdout).toContain("checks RED");
      // The loop still completed and still produced evidence about the red build.
      expect(existsSync(join(repo.root, "artifacts/iterations/t001/E_t.json"))).toBe(true);
    });

    it("emits a machine-readable result with --json", () => {
      const r = harness(
        ["run", "--loop", "t001", "--repo", repo.root, "--build-cmd", EXIT_ZERO, "--unit-cmd", EXIT_ZERO, "--json"],
        repo.root,
      );
      expect(r.status).toBe(0);
      const parsed = JSON.parse(r.stdout) as { status: string; candidateSha: string; tags: string[] };
      expect(parsed.status).toBe("completed");
      expect(parsed.candidateSha).toMatch(/^[0-9a-f]{40}$/);
      expect(parsed.tags).toContain("loop-001-base");
    });

    it("fails with a recorded reason on a dirty tree", () => {
      repo.write("stray.md", "x\n");
      const r = harness(["run", "--loop", "t001", "--repo", repo.root, "--build-cmd", EXIT_ZERO, "--unit-cmd", EXIT_ZERO], repo.root);
      expect(r.status).toBe(1);
      expect(r.stdout).toContain("dirty-tree");
    });
  });

  describe("A6 — dry run from the command line", () => {
    it("prints the gate payloads and completes", () => {
      const r = harness(
        ["run", "--loop", "t001", "--repo", repo.root, "--build-cmd", EXIT_ZERO, "--unit-cmd", EXIT_ZERO, "--dry-run"],
        repo.root,
      );
      expect(r.status).toBe(0);
      expect(r.stdout).toContain("NOT sent");
      expect(r.stdout).toContain('"gate": "plan"');
    });
  });

  describe("schemas", () => {
    it("prints both derived schemas", () => {
      const r = harness(["schemas"], repo.root);
      expect(r.status).toBe(0);
      expect(r.stdout).toContain("D_t — HoH loop plan");
      expect(r.stdout).toContain("E_t — HoH loop evidence");
    });

    it("refuses an unknown flag", () => {
      expect(harness(["schemas", "--overwrite-everything"], repo.root).status).toBe(2);
    });
  });
});
