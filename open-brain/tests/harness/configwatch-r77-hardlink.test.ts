/**
 * R77-MODE000-HARDLINK. A hard link is kind file, so a chmod of the watched path
 * changes the outside inode. EACCES skips on win32; tcm is the read.
 */
import { describe, it, expect, beforeAll, beforeEach, afterEach } from "vitest";
import { chmodSync, linkSync, lstatSync, readFileSync, unlinkSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { runLoop, type LoopConfig } from "../../src/harness/runtime.js";
import { StubDeveloper, StubPlanner, StubQa } from "../../src/harness/roles.js";
import { exitingChecks, makeRepo, requireGit, type RepoFixture } from "./fixture.js";
import { scratch } from "./candidate-a-fixture.js";

const isWin = process.platform === "win32";

describe("R77 hard link restore", { timeout: 60_000 }, () => {
  let repo: RepoFixture;
  let tmp: { dir: string; cleanup: () => Promise<void> };
  beforeAll(() => requireGit());
  beforeEach(() => {
    repo = makeRepo("r77-hl-");
    tmp = scratch("r77-hl-out-");
  });
  afterEach(async () => {
    try { chmodSync(join(repo.root, ".git/hooks"), 0o755); } catch { /* already */ }
    await repo.cleanup();
    await tmp.cleanup();
  });

  it.skipIf(isWin)("R77-MODE000-HARDLINK: restoring a mode-000 hard link does not change the outside victim", async () => {
    const hook = join(repo.root, ".git/hooks/r77-hl");
    const original = Buffer.from("hook-bytes\n");
    writeFileSync(hook, original);
    const victim = join(tmp.dir, "victim");
    writeFileSync(victim, "victim-bytes\n");
    chmodSync(victim, 0o644);
    let afterRoleMode = -1;
    let afterRoleBytes = "";
    const loop: LoopConfig = {
      repoRoot: repo.root, loop: "t001",
      roles: {
        planner: new StubPlanner(),
        developer: { role: "developer", run: async (ctx) => {
          const d = await new StubDeveloper().run(ctx);
          unlinkSync(hook);
          linkSync(victim, hook);
          chmodSync(hook, 0o000);
          afterRoleMode = lstatSync(victim).mode & 0o777;
          afterRoleBytes = readFileSync(victim, "utf-8");
          return d;
        } },
        qa: new StubQa(),
      },
      checks: exitingChecks(0, 0),
      log: () => {},
    };
    let thrown = "";
    let r: Awaited<ReturnType<typeof runLoop>> | null = null;
    let modeNow = -1;
    let bytesNow = "";
    try {
      r = await runLoop(loop);
      modeNow = lstatSync(victim).mode & 0o777;
      bytesNow = readFileSync(victim, "utf-8");
    } catch (e) {
      thrown = (e as Error).message;
    } finally {
      try { chmodSync(victim, 0o644); } catch { /* already */ }
    }
    expect(thrown, "the loop does not throw").toBe("");
    expect(modeNow, "the victim mode is what the role left").toBe(afterRoleMode);
    expect(bytesNow, "the victim bytes are what the role left").toBe(afterRoleBytes);
    const hookIno = lstatSync(hook, { bigint: true }).ino;
    const victimIno = lstatSync(victim, { bigint: true }).ino;
    expect(hookIno === victimIno, "the watched path is a new file").toBe(false);
    expect(readFileSync(hook).equals(original), "the hook bytes are the original").toBe(true);
    expect(r!.failure?.code, "the stage still records the change").toBe("stage-changed-config");
  });
});
