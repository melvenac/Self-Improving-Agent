/**
 * R83. A contained lstat failure (kind other + a code) is unreadable at every
 * consumer, never absent. chmod 0600 lists the directory and refuses search,
 * so these rows skip on win32. tcm is the read.
 */
import { describe, it, expect, beforeAll, beforeEach, afterEach } from "vitest";
import { chmodSync, lstatSync, readdirSync, readFileSync, rmSync, writeFileSync, appendFileSync } from "node:fs";
import { join } from "node:path";
import { ConfigWatch, resolveGitDirs } from "../../src/harness/configwatch.js";
import { runLoop, type LoopConfig, type LoopResult } from "../../src/harness/runtime.js";
import { StubDeveloper, StubPlanner, StubQa } from "../../src/harness/roles.js";
import { exitingChecks, makeRepo, requireGit, type RepoFixture } from "./fixture.js";

const isWin = process.platform === "win32";

const errnoCode = (fn: () => void): string => {
  try {
    fn();
    return "none";
  } catch (e) {
    return (e as NodeJS.ErrnoException).code ?? (e as Error).message;
  }
};

describe("R83 contained lstat failure is unreadable", { timeout: 60_000 }, () => {
  let repo: RepoFixture;
  beforeAll(() => requireGit());
  beforeEach(() => {
    repo = makeRepo("r83-");
  });
  afterEach(async () => {
    try { chmodSync(join(repo.root, ".git", "hooks"), 0o755); } catch { /* already */ }
    await repo.cleanup();
  });

  const hooksOf = () => join(repo.root, ".git", "hooks");

  const emptyHooks = (): void => {
    for (const name of readdirSync(hooksOf())) rmSync(join(hooksOf(), name), { recursive: true, force: true });
  };

  const loop = (act: () => void): LoopConfig => ({
    repoRoot: repo.root,
    loop: "t001",
    roles: {
      planner: new StubPlanner(),
      developer: {
        role: "developer",
        run: async (ctx) => {
          const d = await new StubDeveloper().run(ctx);
          act();
          return d;
        },
      },
      qa: new StubQa(),
    },
    checks: exitingChecks(0, 0),
    log: () => {},
  });

  const run = async (act: () => void): Promise<{ r: LoopResult | null; thrown: string }> => {
    let r: LoopResult | null = null;
    let thrown = "";
    try {
      r = await runLoop(loop(act));
    } catch (e) {
      thrown = (e as Error).message;
    } finally {
      try { chmodSync(hooksOf(), 0o755); } catch { /* already */ }
    }
    return { r, thrown };
  };

  it.skipIf(isWin)("R83-NOSEARCH-PLANT: a hook planted in a hooks directory that lists but cannot be searched fails the stage", async () => {
    const hooks = hooksOf();
    emptyHooks();
    const plant = join(hooks, "post-checkout");
    const body = "#!/bin/sh\necho r83-plant\n";
    let lstatCode = "";
    const { r, thrown } = await run(() => {
      writeFileSync(plant, body);
      chmodSync(plant, 0o755);
      chmodSync(hooks, 0o600);
      lstatCode = errnoCode(() => lstatSync(plant));
    });
    const change = r?.configVerdicts.flatMap((v) => v.changes).find((c) => c.path === plant) ?? null;
    expect(lstatCode, "the directory lists and lstat of the planted name fails EACCES").toBe("EACCES");
    expect(thrown, "the loop does not throw").toBe("");
    expect(r!.failure?.code, "a planted hook in an unsearchable directory fails the stage").toBe("stage-changed-config");
    expect(change, "the failed lstat is recorded against the planted path").not.toBeNull();
    expect(change?.kind, "a contained failure is not a deletion").not.toBe("deleted");
    expect(change?.after ?? "", "a contained failure is not absent").not.toBe("absent");
    expect(change?.after ?? "", "the record carries unreadable and the code").toContain("unreadable (EACCES)");
  });

  it.skipIf(isWin)("R83-NOSEARCH-KEEP: a hook present at begin and unsearchable at close is not deleted to absent", async () => {
    const hooks = hooksOf();
    const keep = join(hooks, "r83-keep");
    const body = "#!/bin/sh\necho r83-keep\n";
    writeFileSync(keep, body);
    chmodSync(keep, 0o755);
    let lstatCode = "";
    const { r, thrown } = await run(() => {
      chmodSync(hooks, 0o600);
      lstatCode = errnoCode(() => lstatSync(keep));
    });
    const change = r?.configVerdicts.flatMap((v) => v.changes).find((c) => c.path === keep) ?? null;
    expect(lstatCode, "lstat of a listed name fails EACCES").toBe("EACCES");
    expect(thrown, "the loop does not throw").toBe("");
    expect(r!.failure?.code, "an unsearchable hook fails the stage").toBe("stage-changed-config");
    expect(change?.kind, "present hooks are never recorded deleted").not.toBe("deleted");
    expect(change?.after ?? "", "present hooks are never recorded absent").not.toBe("absent");
    expect(change?.after ?? "", "the record carries unreadable and the code").toContain("unreadable (EACCES)");
    expect(readFileSync(keep, "utf-8"), "the restore does not remove a path it could read at begin").toBe(body);
  });

  it.skipIf(isWin)("R83-BEGIN-UNSEARCHABLE: a user's hook already unsearchable at begin survives, and is never recorded created", async () => {
    const hooks = hooksOf();
    const user = join(hooks, "pre-commit");
    const body = "#!/bin/sh\necho the-users-own-hook\n";
    writeFileSync(user, body);
    chmodSync(user, 0o755);
    chmodSync(hooks, 0o600);
    const { r, thrown } = await run(() => {
      chmodSync(hooks, 0o755);
      appendFileSync(user, "echo role-edit\n");
    });
    const changes = r?.configVerdicts.flatMap((v) => v.changes).filter((c) => c.path === user) ?? [];
    const after = (() => {
      try { return readFileSync(user, "utf-8"); } catch { return "(deleted)"; }
    })();
    expect(thrown, "the loop does not throw").toBe("");
    expect(after, "the restore never removes a path it never read").not.toBe("(deleted)");
    expect(after.startsWith(body), "the user's hook survives the loop").toBe(true);
    expect(changes.some((c) => c.kind === "created"), "a path recorded unreadable at begin is never created").toBe(false);
  });

  it.skipIf(isWin)("R83-BEGIN-DIFF: begin records an lstat failure on a route that changed since the loop base, and the restore does not remove it", () => {
    const hooks = hooksOf();
    const hook = join(hooks, "r83-begin");
    const body = "#!/bin/sh\necho r83-begin\n";
    writeFileSync(hook, body);
    chmodSync(hook, 0o755);
    const watch = new ConfigWatch(resolveGitDirs(repo.root), repo.root);
    watch.captureBase();
    chmodSync(hooks, 0o600);
    const lstatCode = errnoCode(() => lstatSync(hook));
    watch.begin("developer");
    chmodSync(hooks, 0o755);
    appendFileSync(hook, "echo role-edit\n");
    const verdict = watch.closeAndRestore();
    const change = verdict.changes.find((c) => c.path === hook) ?? null;
    let after = "(deleted)";
    try { after = readFileSync(hook, "utf-8"); } catch { /* deleted */ }
    expect(lstatCode, "begin sees an lstat failure, not an absent file").toBe("EACCES");
    expect(change?.kind, "begin does not record the path as created from absent").not.toBe("created");
    expect(change?.before ?? "", "begin carries unreadable and the code").toContain("unreadable (EACCES)");
    expect(after, "the restore never removes a path begin never read").toContain("echo r83-begin");
  });
});
