/**
 * R77/R82 rows shown red at 4ba3297. Tests only. EACCES skips on win32; tcm is the read.
 */
import { describe, it, expect, beforeAll, beforeEach, afterEach } from "vitest";
import { chmodSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { runLoop, type LoopConfig } from "../../src/harness/runtime.js";
import { StubDeveloper, StubPlanner, StubQa } from "../../src/harness/roles.js";
import { exitingChecks, makeRepo, requireGit, type RepoFixture } from "./fixture.js";
import { scratch } from "./candidate-a-fixture.js";

const isWin = process.platform === "win32";

describe("R77 and R82 red at 4ba3297", { timeout: 60_000 }, () => {
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

  it.skipIf(isWin)("R77-UNLISTED-CONTENTS: a file under an unlisted directory is unrestorable, never deleted or absent", async () => {
    const hooks = join(repo.root, ".git/hooks");
    const planted = join(hooks, "r77-kept");
    writeFileSync(planted, "kept\n");
    const loop: LoopConfig = {
      repoRoot: repo.root, loop: "t001",
      roles: {
        planner: new StubPlanner(),
        developer: { role: "developer", run: async (ctx) => {
          const d = await new StubDeveloper().run(ctx);
          chmodSync(hooks, 0o000);
          return d;
        } },
        qa: new StubQa(),
      },
      checks: exitingChecks(0, 0),
      log: () => {},
    };
    let r: Awaited<ReturnType<typeof runLoop>> | null = null;
    try { r = await runLoop(loop); } finally { try { chmodSync(hooks, 0o755); } catch { /* already */ } }
    const record = JSON.stringify(r);
    const change = r!.configVerdicts?.flatMap((v) => v.changes).find((c) => c.path === planted);
    expect(record, "unrestorable under the unlisted directory").toContain("unrestorable: under unlisted");
    expect(change?.kind, "not deleted").not.toBe("deleted");
    expect(change?.after ?? "", "not absent").not.toContain("absent");
    expect(readFileSync(planted, "utf-8"), "no restore write").toBe("kept\n");
  });

  it.skipIf(isWin)("R77-READ-FAILS-STAGE: mode 000 on .git/config fails the stage and the mode is restored", async () => {
    const cfg = join(repo.root, ".git/config");
    const before = readFileSync(cfg);
    const loop: LoopConfig = {
      repoRoot: repo.root, loop: "t001",
      roles: {
        planner: new StubPlanner(),
        developer: { role: "developer", run: async (ctx) => {
          const d = await new StubDeveloper().run(ctx);
          chmodSync(cfg, 0o000);
          return d;
        } },
        qa: new StubQa(),
      },
      checks: exitingChecks(0, 0),
      log: () => {},
    };
    let r: Awaited<ReturnType<typeof runLoop>> | null = null;
    try { r = await runLoop(loop); } finally { try { chmodSync(cfg, 0o644); } catch { /* already */ } }
    expect(r!.failure?.code, "a contained read failure fails the stage").toBe("stage-changed-config");
    expect(JSON.stringify(r), "the record says unreadable").toContain("unreadable");
    expect(statSync(cfg).mode & 0o777, "the owner mode is restored").not.toBe(0);
    expect(readFileSync(cfg).equals(before), "the bytes are the original").toBe(true);
  });

  it.skipIf(isWin)("R82-MACHINE-UNOBSERVABLE: HOME made mode 000 fails the stage with a machine code", async () => {
    const h = join(tmp.dir, "r82-home");
    mkdirSync(h);
    const cfg = join(h, ".gitconfig");
    writeFileSync(cfg, "[user]\n\tname = r82\n");
    const xdg = join(tmp.dir, "r82-xdg");
    mkdirSync(xdg);
    const system = join(tmp.dir, "r82-system.gitconfig");
    writeFileSync(system, "");
    const env: NodeJS.ProcessEnv = { ...process.env, HOME: h, USERPROFILE: h, XDG_CONFIG_HOME: xdg, GIT_CONFIG_SYSTEM: system };
    delete env.GIT_CONFIG_GLOBAL;
    const loop: LoopConfig = {
      repoRoot: repo.root, loop: "t001", env,
      roles: {
        planner: new StubPlanner(),
        developer: { role: "developer", run: async (ctx) => {
          const d = await new StubDeveloper().run(ctx);
          chmodSync(h, 0o000);
          return d;
        } },
        qa: new StubQa(),
      },
      checks: exitingChecks(0, 0),
      log: () => {},
    };
    let r: Awaited<ReturnType<typeof runLoop>> | null = null;
    try { r = await runLoop(loop); } finally { try { chmodSync(h, 0o755); } catch { /* already */ } }
    const record = JSON.stringify(r);
    expect(r!.failure?.code, "a machine path the runtime cannot see fails the stage").toBe("machine-config-unobservable");
    expect(record, "the record names the path").toContain(cfg);
    expect(record, "the record names the code").toContain("EACCES");
  });
});
