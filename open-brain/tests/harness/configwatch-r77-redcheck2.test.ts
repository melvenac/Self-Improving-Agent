/**
 * R77 rows shown red at 819679d. Tests only. EACCES skips on win32; tcm is the read.
 */
import { describe, it, expect, beforeAll, beforeEach, afterEach } from "vitest";
import { chmodSync, mkdirSync, readFileSync, unlinkSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { runLoop, type LoopConfig } from "../../src/harness/runtime.js";
import { StubDeveloper, StubPlanner, StubQa } from "../../src/harness/roles.js";
import { exitingChecks, makeRepo, requireGit, type RepoFixture } from "./fixture.js";
import { scratch } from "./candidate-a-fixture.js";

const isWin = process.platform === "win32";

describe("R77 red at 819679d", { timeout: 60_000 }, () => {
  let repo: RepoFixture;
  let tmp: { dir: string; cleanup: () => Promise<void> };
  beforeAll(() => requireGit());
  beforeEach(() => {
    repo = makeRepo("r77-");
    tmp = scratch("r77-out-");
  });
  afterEach(async () => {
    try { chmodSync(join(repo.root, ".git/hooks"), 0o755); } catch { /* already */ }
    await repo.cleanup();
    await tmp.cleanup();
  });

  it.skipIf(isWin)("R77-BEGIN-UNLISTED: an unreadable hooks directory before the role refuses config-watch-unestablished", async () => {
    const hooks = join(repo.root, ".git/hooks");
    let ran = false;
    chmodSync(hooks, 0o000);
    const loop: LoopConfig = {
      repoRoot: repo.root, loop: "t001",
      roles: {
        planner: new StubPlanner(),
        developer: { role: "developer", run: async (ctx) => { ran = true; return new StubDeveloper().run(ctx); } },
        qa: new StubQa(),
      },
      checks: exitingChecks(0, 0),
      log: () => {},
    };
    let thrown = "";
    let r: Awaited<ReturnType<typeof runLoop>> | null = null;
    try { r = await runLoop(loop); } catch (e) { thrown = (e as Error).message; }
    finally { try { chmodSync(hooks, 0o755); } catch { /* already */ } }
    const record = JSON.stringify(r);
    expect(thrown, "the loop does not throw").toBe("");
    expect(r!.failure?.code, "the watch was not established").toBe("config-watch-unestablished");
    expect(record, "the record names the directory").toContain(hooks);
    expect(record, "the record names the code").toContain("EACCES");
    expect(ran, "the role did not run").toBe(false);
  });

  it.skipIf(isWin)("R77-CLOSE-UNLISTED: an unreadable hooks directory is stage-changed-config and is not 'no files'", async () => {
    const hooks = join(repo.root, ".git/hooks");
    const planted = join(hooks, "r77-hidden");
    const loop: LoopConfig = {
      repoRoot: repo.root, loop: "t001",
      roles: {
        planner: new StubPlanner(),
        developer: { role: "developer", run: async (ctx) => {
          const d = await new StubDeveloper().run(ctx);
          writeFileSync(planted, "planted\n");
          chmodSync(hooks, 0o000);
          return d;
        } },
        qa: new StubQa(),
      },
      checks: exitingChecks(0, 0),
      log: () => {},
    };
    let thrown = "";
    let r: Awaited<ReturnType<typeof runLoop>> | null = null;
    try { r = await runLoop(loop); } catch (e) { thrown = (e as Error).message; }
    finally { try { chmodSync(hooks, 0o755); } catch { /* already */ } }
    const record = JSON.stringify(r);
    expect(thrown, "the loop does not throw").toBe("");
    expect(r!.failure?.code, "an unlisted directory fails the stage").toBe("stage-changed-config");
    expect(record, "the record names the directory").toContain(hooks);
    expect(record, "rollback does not run").toContain("Rollback was not performed");
    expect(readFileSync(planted, "utf-8"), "the planted hook is still there").toBe("planted\n");
  });

  it.skipIf(isWin)("R77-UNRESTORED-HOOK: a hook replaced by a directory stops before git", async () => {
    const hook = join(repo.root, ".git/hooks/r77-plant");
    writeFileSync(hook, "#!/bin/sh\n");
    const loop: LoopConfig = {
      repoRoot: repo.root, loop: "t001",
      roles: {
        planner: new StubPlanner(),
        developer: { role: "developer", run: async (ctx) => {
          const d = await new StubDeveloper().run(ctx);
          unlinkSync(hook);
          mkdirSync(hook);
          return d;
        } },
        qa: new StubQa(),
      },
      checks: exitingChecks(0, 0),
      log: () => {},
    };
    let thrown = "";
    let r: Awaited<ReturnType<typeof runLoop>> | null = null;
    try { r = await runLoop(loop); } catch (e) { thrown = (e as Error).message; }
    const record = JSON.stringify(r);
    expect(thrown, "the loop does not throw").toBe("");
    expect(r!.failure?.code, "unrestored hook stops before git").toBe("stage-changed-config");
    expect(record, "the record names the hook").toContain(hook);
    expect(record, "rollback does not run").toContain("Rollback was not performed");
    expect(r!.failure?.code, "not a git failure").not.toBe("runtime-git-failed");
  });
});
