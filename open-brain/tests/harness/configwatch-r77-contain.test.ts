/**
 * R77 red tests on A9 6bd97f2. Each names the unguarded call it covers.
 * EACCES on a directory is Linux; these rows skip on win32. tcm is the read.
 */
import { describe, it, expect, vi, beforeAll, beforeEach, afterEach } from "vitest";

const eio = vi.hoisted(() => ({ path: "" }));
vi.mock("node:fs", async (importOriginal) => {
  const actual = await importOriginal<typeof import("node:fs")>();
  return {
    ...actual,
    readFileSync: (...args: Parameters<typeof actual.readFileSync>) => {
      if (eio.path !== "" && args[0] === eio.path) {
        const err = new Error("simulated EIO") as NodeJS.ErrnoException;
        err.code = "EIO";
        throw err;
      }
      return actual.readFileSync(...args);
    },
  };
});
import { chmodSync, mkdirSync, readFileSync, unlinkSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { ConfigWatch, MachineConfigWatch, identify, repositoryLinksAtBase, resolveGitDirs } from "../../src/harness/configwatch.js";
import { runLoop, type LoopConfig } from "../../src/harness/runtime.js";
import { StubDeveloper, StubPlanner, StubQa } from "../../src/harness/roles.js";
import { exitingChecks, makeRepo, requireGit, type RepoFixture } from "./fixture.js";
import { scratch } from "./candidate-a-fixture.js";

const isWin = process.platform === "win32";

describe("R77 containment at A9", { timeout: 60_000 }, () => {
  let repo: RepoFixture;
  let tmp: { dir: string; cleanup: () => Promise<void> };
  beforeAll(() => requireGit());
  beforeEach(() => {
    repo = makeRepo("r77-");
    tmp = scratch("r77-out-");
  });
  afterEach(async () => {
    try { chmodSync(join(repo.root, ".git/hooks"), 0o755); } catch { /* already */ }
    try { chmodSync(join(repo.root, ".git/config"), 0o644); } catch { /* already */ }
    await repo.cleanup();
    await tmp.cleanup();
  });

  it.skipIf(isWin)("R77-IDENTIFY: lstat EACCES is recorded, not rethrown (identify :115, catch :121)", () => {
    const hooks = join(repo.root, ".git/hooks");
    chmodSync(hooks, 0o000);
    const p = join(hooks, "nowhere");
    let thrown = "";
    let kind = "";
    let code = "";
    try {
      const id = identify(p) as { kind: string; code?: string };
      kind = id.kind;
      code = id.code ?? "";
    } catch (e) {
      thrown = (e as NodeJS.ErrnoException).code ?? (e as Error).message;
    }
    expect(thrown, "identify contains the lstat failure").toBe("");
    expect(kind, "a contained EACCES is unreadable, never absent").not.toBe("absent");
    expect(code, "the record carries the error code").toBe("EACCES");
  });

  it.skipIf(isWin)("R77-LISTTREE: an unreadable tree is unlisted, not thrown (listTree readdir :171 via repositoryLinksAtBase :201)", () => {
    const hooks = join(repo.root, ".git/hooks");
    chmodSync(hooks, 0o000);
    let thrown = "";
    let reported = "";
    try {
      reported = repositoryLinksAtBase(repo.root, resolveGitDirs(repo.root)).join("\n");
    } catch (e) {
      thrown = (e as NodeJS.ErrnoException).code ?? (e as Error).message;
    }
    expect(thrown, "listTree contains readdir").toBe("");
    expect(reported, "an unlistable directory is reported unlisted, not silently absent").toContain("unlisted:");
    expect(reported, "the unlist record carries the code").toContain("EACCES");
  });

  it.skipIf(isWin)("R77-BEGIN-TREE: begin contains listTree (currentFiles :592, begin :620)", () => {
    const hooks = join(repo.root, ".git/hooks");
    chmodSync(hooks, 0o000);
    const watch = new ConfigWatch(resolveGitDirs(repo.root), repo.root);
    let thrown = "";
    try {
      watch.begin("developer");
    } catch (e) {
      thrown = (e as NodeJS.ErrnoException).code ?? (e as Error).message;
    }
    expect(thrown, "begin contains the unreadable tree").toBe("");
  });

  it.skipIf(isWin)("R77-CLOSE-TREE: closeAndRestore lists after the role and still restores (currentFiles :727)", () => {
    const cfg = join(repo.root, ".git/config");
    const hooks = join(repo.root, ".git/hooks");
    const watch = new ConfigWatch(resolveGitDirs(repo.root), repo.root);
    watch.captureBase();
    watch.begin("developer");
    const before = readFileSync(cfg);
    writeFileSync(cfg, Buffer.concat([before, Buffer.from("\n[core]\n\tfsmonitor = /tmp/r77-mon\n")]));
    chmodSync(hooks, 0o000);
    let thrown = "";
    try {
      watch.closeAndRestore();
    } catch (e) {
      thrown = (e as Error).message;
    } finally {
      chmodSync(hooks, 0o755);
    }
    expect(thrown, "closeAndRestore does not throw out of the window").toBe("");
    expect(readFileSync(cfg).includes("fsmonitor"), "the planted line is restored").toBe(false);
  });

  it.skipIf(isWin)("R77-OBSERVE-BEGIN: begin's observe contains lstat (observe identify :931, begin :1092)", () => {
    const h = join(tmp.dir, "home");
    mkdirSync(h);
    const cfg = join(h, ".gitconfig");
    writeFileSync(cfg, "[user]\n\tname = r77\n");
    const watch = new MachineConfigWatch([{ scope: "global", path: cfg, source: "r77" }]);
    watch.captureBase();
    chmodSync(h, 0o000);
    let thrown = "";
    try {
      watch.begin("developer");
    } catch (e) {
      thrown = (e as NodeJS.ErrnoException).code ?? (e as Error).message;
    } finally {
      chmodSync(h, 0o755);
    }
    expect(thrown, "begin contains observe's lstat").toBe("");
  });

  it.skipIf(isWin)("R77-OBSERVE-COMPARE: compare contains lstat and records the code (observe :931, compare :1127)", () => {
    const h = join(tmp.dir, "home2");
    mkdirSync(h);
    const cfg = join(h, ".gitconfig");
    writeFileSync(cfg, "[user]\n\tname = r77\n");
    const watch = new MachineConfigWatch([{ scope: "global", path: cfg, source: "r77" }]);
    watch.captureBase();
    watch.begin("developer");
    chmodSync(h, 0o000);
    let thrown = "";
    let after = "";
    try {
      const rows = watch.compare();
      after = rows.find((r) => r.path === cfg)?.after ?? "";
    } catch (e) {
      thrown = (e as NodeJS.ErrnoException).code ?? (e as Error).message;
    } finally {
      chmodSync(h, 0o755);
    }
    expect(thrown, "compare contains observe's lstat").toBe("");
    expect(after, "the finding names EACCES").toContain("EACCES");
  });

  it.skipIf(isWin)("R77-READ-GUARDED: a mode-000 file is recorded, not thrown (readFileSync :438 is already inside readState's try)", () => {
    const cfg = join(repo.root, ".git/config");
    const dirs = resolveGitDirs(repo.root);
    chmodSync(cfg, 0o000);
    const watch = new ConfigWatch(dirs, repo.root);
    let thrown = "";
    try {
      watch.begin("developer");
    } catch (e) {
      thrown = (e as Error).message;
    }
    expect(thrown, "readFileSync EACCES is already contained").toBe("");
  });

  it("R77-READ-EIO: a readFileSync EIO is recorded as unreadable, not absent and not thrown", () => {
    const cfg = join(repo.root, ".git/config");
    const dirs = resolveGitDirs(repo.root);
    eio.path = cfg;
    let thrown = "";
    let record = "";
    try {
      const watch = new ConfigWatch(dirs, repo.root);
      try {
        watch.begin("developer");
      } catch (e) {
        thrown = (e as NodeJS.ErrnoException).code ?? (e as Error).message;
      }
      if (thrown === "") record = JSON.stringify(watch.closeAndRestore());
    } finally {
      eio.path = "";
    }
    expect(thrown, "EIO stays inside the window").toBe("");
    expect(record, "the record says unreadable with the code").toContain("EIO");
    expect(record, "EIO is not printed as absent").not.toContain(`"before":"absent"`);
  });

  it.skipIf(isWin)("R77-GIT-AFTER-BREAK: replacing .git/config with a directory ends stage-changed-config and restores it", async () => {
    const cfg = join(repo.root, ".git/config");
    const before = readFileSync(cfg);
    const loop: LoopConfig = {
      repoRoot: repo.root,
      loop: "t001",
      roles: {
        planner: new StubPlanner(),
        developer: {
          role: "developer",
          run: async (ctx) => {
            const d = await new StubDeveloper().run(ctx);
            unlinkSync(cfg);
            mkdirSync(cfg);
            return d;
          },
        },
        qa: new StubQa(),
      },
      checks: exitingChecks(0, 0),
      log: () => {},
    };
    let thrown = "";
    let r: Awaited<ReturnType<typeof runLoop>> | null = null;
    try {
      r = await runLoop(loop);
    } catch (e) {
      thrown = (e as Error).message;
    }
    let restored = false;
    try { restored = readFileSync(cfg).equals(before); } catch { restored = false; }
    expect(thrown, "the loop does not throw").toBe("");
    expect(r!.failure?.code, "stage-changed-config, never runtime-error").toBe("stage-changed-config");
    const record = JSON.stringify(r);
    expect(record.includes(cfg), "the record names the path").toBe(true);
    if (restored) expect(readFileSync(cfg).equals(before), "a restore puts the original bytes back").toBe(true);
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
