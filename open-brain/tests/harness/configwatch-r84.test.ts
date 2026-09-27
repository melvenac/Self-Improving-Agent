/**
 * R84. Observable at the stage start is not the same as read. An absence, a
 * non-file, or a deliberate not-read that cannot be observed at close fails
 * the stage. A path already unobservable at the start is the environment.
 * chmod of a directory is Linux; these rows skip on win32. tcm is the read.
 */
import { describe, it, expect, beforeAll, beforeEach, afterEach } from "vitest";
import { chmodSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { runLoop, type LoopConfig, type LoopResult } from "../../src/harness/runtime.js";
import { StubDeveloper, StubPlanner, StubQa } from "../../src/harness/roles.js";
import { exitingChecks, makeRepo, requireGit, type RepoFixture } from "./fixture.js";
import { scratch } from "./candidate-a-fixture.js";

const isWin = process.platform === "win32";

describe("R84 observed is not the same as read", { timeout: 60_000 }, () => {
  let repo: RepoFixture;
  let tmp: { dir: string; cleanup: () => Promise<void> };
  beforeAll(() => requireGit());
  beforeEach(() => {
    repo = makeRepo("r84-");
    tmp = scratch("r84-out-");
  });
  afterEach(async () => {
    await repo.cleanup();
    await tmp.cleanup();
  });

  const envFor = (home: string): NodeJS.ProcessEnv => {
    const xdg = join(tmp.dir, `${home.split(/[\\/]/).pop()}-xdg`);
    mkdirSync(xdg, { recursive: true });
    const system = join(tmp.dir, `${home.split(/[\\/]/).pop()}-system.gitconfig`);
    writeFileSync(system, "");
    const env: NodeJS.ProcessEnv = { ...process.env, HOME: home, USERPROFILE: home, XDG_CONFIG_HOME: xdg, GIT_CONFIG_SYSTEM: system };
    delete env.GIT_CONFIG_GLOBAL;
    return env;
  };

  const run = async (env: NodeJS.ProcessEnv, act: () => void, home: string): Promise<LoopResult | null> => {
    const loop: LoopConfig = {
      repoRoot: repo.root,
      loop: "t001",
      env,
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
    };
    let r: LoopResult | null = null;
    try {
      r = await runLoop(loop);
    } finally {
      try { chmodSync(home, 0o755); } catch { /* already */ }
    }
    return r;
  };

  it.skipIf(isWin)("R84-ABSENT-THEN-EACCES: a global config absent at the stage start, then unobservable, fails the stage", async () => {
    const home = join(tmp.dir, "r84-absent");
    mkdirSync(home);
    const cfg = join(home, ".gitconfig");
    const r = await run(envFor(home), () => chmodSync(home, 0o000), home);
    const record = JSON.stringify(r);
    expect(r!.failure?.code, "an observed absence that cannot be seen at close fails the stage").toBe("machine-config-unobservable");
    expect(record, "the record names the path").toContain(cfg);
    expect(record, "the record names the code").toContain("EACCES");
  });

  it.skipIf(isWin)("R84-NOT-A-FILE-THEN-EACCES: a global config that is a directory at the stage start, then unobservable, fails the stage", async () => {
    const home = join(tmp.dir, "r84-notafile");
    mkdirSync(home);
    const cfg = join(home, ".gitconfig");
    mkdirSync(cfg);
    const r = await run(envFor(home), () => chmodSync(home, 0o000), home);
    const record = JSON.stringify(r);
    expect(r!.failure?.code, "an observed non-file that cannot be seen at close fails the stage").toBe("machine-config-unobservable");
    expect(record, "the record names the path").toContain(cfg);
    expect(record, "the record names the code").toContain("EACCES");
  });

  it.skipIf(isWin)("R84-ALREADY-UNOBSERVABLE: a global config unobservable at the stage start stays the environment", async () => {
    const home = join(tmp.dir, "r84-env");
    mkdirSync(home);
    writeFileSync(join(home, ".gitconfig"), "[user]\n\tname = r84\n");
    chmodSync(home, 0o000);
    const r = await run(envFor(home), () => {}, home);
    expect(r!.failure?.code, "already unobservable at the start is not a stage failure").not.toBe("machine-config-unobservable");
  });
});
