/**
 * R85. No side stands alone. A failed lstat at stage start prints its code,
 * an unobservable close carries the facts observe() has, and an ancestor
 * link's current side names ENOENT instead of zeroed facts. Directory chmod
 * and a directory symlink are Linux; these rows skip on win32. tcm is the read.
 */
import { describe, it, expect, beforeAll, beforeEach, afterEach } from "vitest";
import { chmodSync, mkdirSync, renameSync, symlinkSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { MachineConfigWatch } from "../../src/harness/configwatch.js";
import { runLoop, type LoopConfig, type LoopResult } from "../../src/harness/runtime.js";
import { StubDeveloper, StubPlanner, StubQa } from "../../src/harness/roles.js";
import { exitingChecks, makeRepo, requireGit, type RepoFixture } from "./fixture.js";
import { scratch } from "./candidate-a-fixture.js";

const isWin = process.platform === "win32";

describe("R85 no side stands alone", { timeout: 60_000 }, () => {
  let repo: RepoFixture;
  let tmp: { dir: string; cleanup: () => Promise<void> };
  beforeAll(() => requireGit());
  beforeEach(() => {
    repo = makeRepo("r85-");
    tmp = scratch("r85-out-");
  });
  afterEach(async () => {
    await repo.cleanup();
    await tmp.cleanup();
  });

  const envFor = (home: string, xdg: string): NodeJS.ProcessEnv => {
    mkdirSync(xdg, { recursive: true });
    const system = join(tmp.dir, "r85-system.gitconfig");
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

  it.skipIf(isWin)("R85-START-LSTAT: a stage start whose lstat failed prints the code, never the word absent", async () => {
    const home = join(tmp.dir, "r85-start");
    mkdirSync(home);
    const cfg = join(home, ".gitconfig");
    writeFileSync(cfg, "[user]\n\tname = r85\n");
    const xdg = join(tmp.dir, "r85-start-xdg");
    chmodSync(home, 0o000);
    const r = await run(envFor(home, xdg), () => chmodSync(home, 0o755), home);
    const row = r?.machineConfigFindings.find((f) => f.path === cfg && f.stage === "developer");
    expect(row, "the developer stage records the path").toBeTruthy();
    expect(row!.before, "a failed lstat is not the word absent").not.toBe("absent");
    expect(row!.before, "the stage start names the code").toContain("EACCES");
  });

  it.skipIf(isWin)("R85-UNOBSERVABLE-FACTS: unobservable (code) carries the facts observe() has", async () => {
    const home = join(tmp.dir, "r85-facts");
    mkdirSync(home);
    const cfg = join(home, ".gitconfig");
    writeFileSync(cfg, "[user]\n\tname = r85\n");
    const xdg = join(tmp.dir, "r85-facts-xdg");
    const r = await run(envFor(home, xdg), () => chmodSync(home, 0o000), home);
    const row = r?.machineConfigFindings.find((f) => f.path === cfg && f.unobservableCode === "EACCES");
    expect(r!.failure?.code, "the close that cannot see the path fails the stage").toBe("machine-config-unobservable");
    expect(row, "the finding carries the code").toBeTruthy();
    expect(row!.after, "the unobservable side is not the code alone").toContain("dev ");
  });

  it.skipIf(isWin)("R85-ANCESTOR-ENOENT: an ancestor link planted where the path was absent names ENOENT and prints no zeroed facts", () => {
    const xdg = join(tmp.dir, "r85-anc-xdg");
    mkdirSync(xdg);
    const cfg = join(xdg, "git", "config");
    const watch = new MachineConfigWatch([{ scope: "xdg", path: cfg, source: "r85" }]);
    watch.captureBase();
    watch.begin("developer");
    const empty = join(tmp.dir, "r85-anc-empty");
    mkdirSync(empty);
    symlinkSync(empty, join(xdg, "git"), "dir");
    const row = watch.compare().find((f) => f.path === cfg);
    expect(row, "the ancestor link is recorded against the config path").toBeTruthy();
    expect(row!.after, "the current side names ENOENT").toContain("ENOENT");
    expect(row!.after, "the current side does not print zeroed dev").not.toContain("dev null");
    expect(row!.after, "the current side does not print zeroed nlink").not.toContain("nlink 0");
  });

  it.skipIf(isWin)("R85-ANCESTOR-TYPECHANGE: an ancestor link that replaces a read config names ENOENT and prints no zeroed facts", () => {
    const xdg = join(tmp.dir, "r85-at-xdg");
    mkdirSync(join(xdg, "git"), { recursive: true });
    const cfg = join(xdg, "git", "config");
    writeFileSync(cfg, "[user]\n\tname = r85\n");
    const watch = new MachineConfigWatch([{ scope: "xdg", path: cfg, source: "r85" }]);
    watch.captureBase();
    watch.begin("developer");
    const empty = join(tmp.dir, "r85-at-empty");
    mkdirSync(empty);
    renameSync(join(xdg, "git"), join(xdg, "git-old"));
    symlinkSync(empty, join(xdg, "git"), "dir");
    const row = watch.compare().find((f) => f.path === cfg);
    expect(row, "the type change is recorded against the config path").toBeTruthy();
    expect(row!.after, "the current side names ENOENT").toContain("ENOENT");
    expect(row!.after, "the current side does not print zeroed dev").not.toContain("dev null");
  });
});
