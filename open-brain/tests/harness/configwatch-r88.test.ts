/**
 * R88. A read failure at the window's open refuses the stage
 * config-watch-unestablished, before the role runs, and the reason names
 * the path and the code. chmod of a file is Linux; these rows skip on win32.
 * tcm is the read.
 */
import { describe, it, expect, beforeAll, beforeEach, afterEach } from "vitest";
import { chmodSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { resolveGitDirs } from "../../src/harness/configwatch.js";
import { runLoop, type LoopConfig, type LoopResult } from "../../src/harness/runtime.js";
import { StubDeveloper, StubPlanner, StubQa } from "../../src/harness/roles.js";
import { exitingChecks, makeRepo, requireGit, type RepoFixture } from "./fixture.js";

const isWin = process.platform === "win32";

describe("R88 a read failure at open refuses the stage", { timeout: 60_000 }, () => {
  let repo: RepoFixture;
  beforeAll(() => requireGit());
  beforeEach(() => { repo = makeRepo("r88-"); });
  afterEach(async () => { await repo.cleanup(); });

  const run = async (plant: (hook: string) => void): Promise<{ result: LoopResult; ran: boolean; hook: string }> => {
    const hook = join(resolveGitDirs(repo.root).commonDir, "hooks", "pre-commit");
    writeFileSync(hook, "#!/bin/sh\n");
    plant(hook);
    let ran = false;
    const loop: LoopConfig = {
      repoRoot: repo.root,
      loop: "t001",
      roles: {
        planner: new StubPlanner(),
        developer: {
          role: "developer",
          run: async (ctx) => {
            ran = true;
            return new StubDeveloper().run(ctx);
          },
        },
        qa: new StubQa(),
      },
      checks: exitingChecks(0, 0),
      log: () => {},
    };
    try {
      const result = await runLoop(loop);
      return { result, ran, hook };
    } finally {
      try { chmodSync(hook, 0o644); } catch { /* already */ }
    }
  };

  it.skipIf(isWin)("R88-EACCES-AT-OPEN: an unreadable hook at open refuses the stage and names EACCES", async () => {
    const { result, ran, hook } = await run((path) => chmodSync(path, 0o000));
    expect(result.failure?.code, "a read failure at open refuses the stage").toBe("config-watch-unestablished");
    expect(ran, "the role does not run").toBe(false);
    expect(result.failure?.reason ?? "", "the reason names the path").toContain(hook);
    expect(result.failure?.reason ?? "", "the reason names EACCES").toContain("EACCES");
  });
});
