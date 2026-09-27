/**
 * QA 169 calibration probes, not for merge.
 *
 * CAL169-R90-R77 follows R90's absent-at-open/lstat-failed-at-close branch
 * through ConfigWatch.closeAndRestore() into runtime.ts. The path remains
 * unobservable, so R77 still requires an unrestored entry and a stop before git.
 *
 * CAL169-R94 pins both sides of the required ci.yml merge resolution.
 */
import { describe, it, expect, vi, beforeAll, beforeEach, afterEach } from "vitest";

const spy = vi.hoisted(() => ({ armed: false, calls: [] as string[] }));
vi.mock("node:child_process", async (importOriginal) => {
  const m = await importOriginal<typeof import("node:child_process")>();
  const spawnSync = ((...args: unknown[]) => {
    if (spy.armed) {
      const argv = Array.isArray(args[1]) ? (args[1] as string[]) : [];
      spy.calls.push(`${String(args[0])} ${argv.join(" ")}`);
    }
    return (m.spawnSync as (...xs: unknown[]) => unknown)(...args);
  }) as typeof m.spawnSync;
  return { ...m, default: { ...m, spawnSync }, spawnSync };
});

import { chmodSync, lstatSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { resolveGitDirs } from "../../src/harness/configwatch.js";
import { runLoop, type LoopConfig } from "../../src/harness/runtime.js";
import { StubDeveloper, StubPlanner, StubQa } from "../../src/harness/roles.js";
import { exitingChecks, makeRepo, requireGit, type RepoFixture } from "./fixture.js";

const isWin = process.platform === "win32";
const errnoCode = (fn: () => void): string => {
  try {
    fn();
    return "none";
  } catch (error) {
    return (error as NodeJS.ErrnoException).code ?? (error as Error).message;
  }
};

describe("QA 169 A12 probes", { timeout: 60_000 }, () => {
  let repo: RepoFixture;

  beforeAll(() => requireGit());
  beforeEach(() => {
    repo = makeRepo("cal169-");
    spy.armed = false;
    spy.calls = [];
  });
  afterEach(async () => {
    spy.armed = false;
    try { chmodSync(join(repo.root, ".git"), 0o755); } catch { /* already restored */ }
    await repo.cleanup();
  });

  it.skipIf(isWin)("CAL169-R90-R77: unobservable absent path remains unrestored and stops before git", async () => {
    const gitDir = join(repo.root, ".git");
    const worktree = join(resolveGitDirs(repo.root).gitDir, "config.worktree");
    let lstatCode = "";
    const loop: LoopConfig = {
      repoRoot: repo.root,
      loop: "t001",
      roles: {
        planner: new StubPlanner(),
        developer: {
          role: "developer",
          run: async (ctx) => {
            const deliverable = await new StubDeveloper().run(ctx);
            chmodSync(gitDir, 0o600);
            lstatCode = errnoCode(() => lstatSync(worktree));
            spy.calls = [];
            spy.armed = true;
            return deliverable;
          },
        },
        qa: new StubQa(),
      },
      checks: exitingChecks(0, 0),
      log: () => {},
    };

    const result = await runLoop(loop);
    spy.armed = false;
    chmodSync(gitDir, 0o755);
    const verdict = result.configVerdicts.find((entry) => entry.stage === "developer");
    const change = verdict?.changes.find((entry) => entry.path === worktree);
    const gitAfterRole = spy.calls.filter((call) => /(^|[\\/ ])git(?:\.exe)?(?: |$)/i.test(call));
    const observed = {
      lstatCode,
      failure: result.failure?.code ?? null,
      change,
      unrestored: verdict?.unrestored ?? [],
      gitAfterRole,
    };
    console.log(`CAL169-R90-R77 ${JSON.stringify(observed)}`);

    expect(lstatCode).toBe("EACCES");
    expect(change?.before).toBe("absent");
    expect(change?.after).toBe("unobservable (EACCES); unreadable (EACCES); no facts: lstat failed");
    expect.soft(verdict?.unrestored.some((entry) => entry.includes(worktree)),
      "R77: a path that was neither removed nor restored remains unrestored").toBe(true);
    expect.soft(gitAfterRole, "R77: stop before any git call").toEqual([]);
  });

  it("CAL169-R94: ci merge retains verbose Linux reporting and the Windows job", () => {
    const workflow = readFileSync(resolve(process.cwd(), "..", ".github", "workflows", "ci.yml"), "utf8");
    expect(workflow).toContain("npm test -- --reporter=verbose");
    expect(workflow).toContain("test-windows:");
  });
});
