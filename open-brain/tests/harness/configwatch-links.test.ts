/**
 * CA-15 — a restore must not write, delete or chmod outside the repository
 * through a junction at a watched path (a), a junction at an ancestor (b),
 * or a hard link (c). Probes use a scratch victim. POSIX symlink cases are
 * skipped on win32, where creating a file symlink is EPERM without privilege.
 */

import { describe, it, expect, beforeAll, beforeEach, afterEach } from "vitest";
import { createHash } from "node:crypto";
import {
  lstatSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  renameSync,
  symlinkSync,
  writeFileSync,
  linkSync,
  rmdirSync,
  unlinkSync,
} from "node:fs";
import { join } from "node:path";
import { runLoop, LoopRefused, type LoopConfig } from "../../src/harness/runtime.js";
import { StubDeveloper, StubPlanner, StubQa } from "../../src/harness/roles.js";
import { ConfigWatch, MachineConfigWatch, resolveGitDirs } from "../../src/harness/configwatch.js";
import { exitingChecks, makeRepo, rawGit, requireGit, type RepoFixture } from "./fixture.js";
import { scratch } from "./candidate-a-fixture.js";

const isWin = process.platform === "win32";

function namesOf(dir: string): string[] {
  return readdirSync(dir).sort();
}

/** Put a renamed `.git` back so cleanup cannot walk a junction into the victim. */
function repairGit(root: string): void {
  const dot = join(root, ".git");
  const aside = join(root, ".git-aside");
  try {
    if (lstatSync(dot).isSymbolicLink()) rmdirSync(dot);
  } catch {
    // already gone
  }
  try {
    if (lstatSync(aside).isDirectory()) renameSync(aside, dot);
  } catch {
    // the test never moved it
  }
}

describe("CA-15 — restore does not follow links", { timeout: 120_000 }, () => {
  let repo: RepoFixture;
  let tmp: { dir: string; cleanup: () => Promise<void> };

  beforeAll(() => requireGit());
  beforeEach(() => {
    repo = makeRepo("harness-link-");
    tmp = scratch("harness-link-out-");
  });
  afterEach(async () => {
    repairGit(repo.root);
    await repo.cleanup();
    await tmp.cleanup();
  });

  const loopConfig = (over: Partial<LoopConfig> = {}): LoopConfig => ({
    repoRoot: repo.root,
    loop: "t001",
    roles: { planner: new StubPlanner(), developer: new StubDeveloper(), qa: new StubQa() },
    checks: exitingChecks(0, 0),
    log: () => {},
    ...over,
  });

  it.skipIf(!isWin)(
    "R41: non-recursive rmdir removes a win32 junction and leaves the victim (win32 only: symlinkSync type junction is a junction here; on POSIX it is a symlink and rmdir throws ENOTDIR)",
    () => {
    const victim = join(tmp.dir, "victim");
    const canary = join(victim, "canary.txt");
    const link = join(tmp.dir, "link");
    mkdirSync(victim);
    writeFileSync(canary, "CANARY-BYTES");
    symlinkSync(victim, link, "junction");
    rmdirSync(link);
    expect(() => lstatSync(link)).toThrow();
    expect(readFileSync(canary, "utf-8")).toBe("CANARY-BYTES");
    expect(lstatSync(victim).isDirectory()).toBe(true);
  },
  );

  it("(a) a junction at .git/info does not write or delete the victim", () => {
    const dirs = resolveGitDirs(repo.root);
    const watch = new ConfigWatch(dirs);
    watch.begin("developer");
    const info = join(dirs.commonDir, "info");
    const aside = join(dirs.commonDir, "info-aside");
    const victim = join(tmp.dir, "victim-info");
    const canary = join(victim, "canary.txt");
    mkdirSync(victim);
    writeFileSync(canary, "INFO-CANARY");
    const beforeNames = namesOf(victim);
    renameSync(info, aside);
    symlinkSync(victim, info, "junction");
    const v = watch.closeAndRestore();
    expect(readFileSync(canary, "utf-8")).toBe("INFO-CANARY");
    expect(namesOf(victim)).toEqual(beforeNames);
    expect(lstatSync(info).isDirectory()).toBe(true);
    expect(lstatSync(info).isSymbolicLink()).toBe(false);
    expect(v.ok).toBe(false);
    expect(v.unrestored).toEqual([]);
  });

  it("(c) a hard link created inside .git/hooks does not change the victim", () => {
    const dirs = resolveGitDirs(repo.root);
    const watch = new ConfigWatch(dirs);
    watch.begin("developer");
    const victim = join(tmp.dir, "victim-hook-hard");
    writeFileSync(victim, "HOOK-HARD-CANARY");
    const hook = join(dirs.commonDir, "hooks", "post-commit");
    linkSync(victim, hook);
    expect(lstatSync(hook).nlink).toBe(2);
    watch.closeAndRestore();
    expect(readFileSync(victim, "utf-8")).toBe("HOOK-HARD-CANARY");
    expect(() => lstatSync(hook)).toThrow();
  });

  describe("POSIX symlinks", () => {
    it.skipIf(isWin)("a symlink at .git/config does not overwrite the victim", () => {
      const dirs = resolveGitDirs(repo.root);
      const config = join(dirs.commonDir, "config");
      const watch = new ConfigWatch(dirs);
      watch.begin("developer");
      const victim = join(tmp.dir, "victim-sym");
      writeFileSync(victim, "SYM-CANARY");
      renameSync(config, join(dirs.commonDir, "config-aside"));
      symlinkSync(victim, config);
      expect(lstatSync(config).isSymbolicLink()).toBe(true);
      const v = watch.closeAndRestore();
      expect(readFileSync(victim, "utf-8")).toBe("SYM-CANARY");
      expect(lstatSync(config).isSymbolicLink()).toBe(false);
      expect(v.message).toContain("put back");
    });

    it.skipIf(isWin)(
      "CA-15 (b)2: a directory symlink at .git/hooks is removed via the ENOTDIR fallback and the victim is untouched",
      () => {
        const dirs = resolveGitDirs(repo.root);
        const watch = new ConfigWatch(dirs);
        watch.begin("developer");
        const hooks = join(dirs.commonDir, "hooks");
        const aside = join(dirs.commonDir, "hooks-aside-posix");
        const victim = join(tmp.dir, "victim-hooks-sym");
        const canary = join(victim, "canary.txt");
        mkdirSync(victim);
        writeFileSync(canary, "HOOKS-SYM-CANARY");
        renameSync(hooks, aside);
        symlinkSync(victim, hooks);
        expect(lstatSync(hooks).isSymbolicLink()).toBe(true);
        const v = watch.closeAndRestore();
        expect(readFileSync(canary, "utf-8")).toBe("HOOKS-SYM-CANARY");
        expect(lstatSync(hooks).isSymbolicLink()).toBe(false);
        expect(lstatSync(hooks).isDirectory()).toBe(true);
        expect(v.unrestored).toEqual([]);
      },
    );

    it.skipIf(isWin)("a symlink at .git does not write the victim and claims no restore", () => {
      const dirs = resolveGitDirs(repo.root);
      const watch = new ConfigWatch(dirs);
      watch.begin("developer");
      const victim = join(tmp.dir, "victim-git-sym");
      mkdirSync(victim);
      writeFileSync(join(victim, "canary.txt"), "GIT-SYM-CANARY");
      const beforeNames = namesOf(victim);
      const dot = join(repo.root, ".git");
      renameSync(dot, join(repo.root, ".git-aside"));
      symlinkSync(victim, dot);
      const v = watch.closeAndRestore();
      expect(readFileSync(join(victim, "canary.txt"), "utf-8")).toBe("GIT-SYM-CANARY");
      expect(namesOf(victim)).toEqual(beforeNames);
      expect(v.ancestorLink).toBe(dot);
      expect(v.message).not.toMatch(/put back/);
    });
  });

  it("(a) a junction at .git/hooks does not write or delete the victim", () => {
    const dirs = resolveGitDirs(repo.root);
    const watch = new ConfigWatch(dirs);
    watch.begin("developer");
    const hooks = join(dirs.commonDir, "hooks");
    const aside = join(dirs.commonDir, "hooks-aside");
    const victim = join(tmp.dir, "victim");
    const canary = join(victim, "canary.txt");
    mkdirSync(victim);
    writeFileSync(canary, "HOOKS-CANARY");
    const beforeNames = namesOf(victim);
    renameSync(hooks, aside);
    symlinkSync(victim, hooks, "junction");
    const v = watch.closeAndRestore();
    expect(readFileSync(canary, "utf-8")).toBe("HOOKS-CANARY");
    expect(namesOf(victim)).toEqual(beforeNames);
    expect(lstatSync(hooks).isSymbolicLink()).toBe(false);
    expect(lstatSync(hooks).isDirectory()).toBe(true);
    expect(v.ok).toBe(false);
    expect(v.message).toContain("hooks");
    expect(v.message).toContain("put back");
    expect(v.unrestored).toEqual([]);
  });

  it("(a) a junction entry inside .git/hooks does not write the victim", () => {
    const dirs = resolveGitDirs(repo.root);
    const watch = new ConfigWatch(dirs);
    watch.begin("developer");
    const victim = join(tmp.dir, "victim-entry");
    const canary = join(victim, "canary.txt");
    mkdirSync(victim);
    writeFileSync(canary, "ENTRY-CANARY");
    const beforeNames = namesOf(victim);
    const entry = join(dirs.commonDir, "hooks", "sub");
    symlinkSync(victim, entry, "junction");
    watch.closeAndRestore();
    expect(readFileSync(canary, "utf-8")).toBe("ENTRY-CANARY");
    expect(namesOf(victim)).toEqual(beforeNames);
    expect(() => lstatSync(entry)).toThrow();
  });

  it("(b) a junction at .git writes nothing into the victim and claims no restore", () => {
    const dirs = resolveGitDirs(repo.root);
    const watch = new ConfigWatch(dirs);
    watch.begin("developer");
    const victim = join(tmp.dir, "victim-git");
    const canary = join(victim, "canary.txt");
    mkdirSync(victim);
    writeFileSync(canary, "GIT-CANARY");
    const beforeNames = namesOf(victim);
    const dot = join(repo.root, ".git");
    const aside = join(repo.root, ".git-aside");
    renameSync(dot, aside);
    symlinkSync(victim, dot, "junction");
    const v = watch.closeAndRestore();
    expect(readFileSync(canary, "utf-8")).toBe("GIT-CANARY");
    expect(namesOf(victim)).toEqual(beforeNames);
    expect(v.ancestorLink).toBe(dot);
    expect(v.message).toContain(dot);
    expect(v.message).not.toMatch(/put back/);
  });

  it("(c) a hard link at .git/config does not change the victim's bytes", () => {
    const dirs = resolveGitDirs(repo.root);
    const config = join(dirs.commonDir, "config");
    const watch = new ConfigWatch(dirs);
    watch.begin("developer");
    const victim = join(tmp.dir, "victim-hard");
    writeFileSync(victim, "HARD-CANARY");
    renameSync(config, join(dirs.commonDir, "config-aside"));
    linkSync(victim, config);
    expect(lstatSync(config).nlink).toBe(2);
    const v = watch.closeAndRestore();
    expect(readFileSync(victim, "utf-8")).toBe("HARD-CANARY");
    expect(lstatSync(config).nlink).toBe(1);
    expect(v.ok).toBe(false);
    expect(v.message).toContain("config");
    expect(v.message).toContain("put back");
  });

  it("(b) a loop whose role junctions .git does not roll back through it", async () => {
    const victim = join(tmp.dir, "victim-loop");
    const canary = join(victim, "canary.txt");
    mkdirSync(victim);
    writeFileSync(canary, "LOOP-CANARY-TOKEN");
    const beforeNames = namesOf(victim);
    const r = await runLoop(
      loopConfig({
        roles: {
          planner: new StubPlanner(),
          developer: {
            role: "developer",
            run: async (ctx) => {
              const deliverable = await new StubDeveloper().run(ctx);
              const dot = join(ctx.repoRoot, ".git");
              renameSync(dot, join(ctx.repoRoot, ".git-aside"));
              symlinkSync(victim, dot, "junction");
              return deliverable;
            },
          },
          qa: new StubQa(),
        },
      }),
    );
    expect(r.failure?.code).toBe("stage-changed-config");
    expect(r.failure?.reason).toContain("Rollback was not performed");
    expect(r.failure?.reason).toContain(".git");
    expect(r.failure?.reason).not.toMatch(/put back/);
    expect(readFileSync(canary, "utf-8")).toBe("LOOP-CANARY-TOKEN");
    expect(namesOf(victim)).toEqual(beforeNames);
    const failed = readFileSync(join(repo.root, "artifacts/iterations/t001/FAILED.md"), "utf-8");
    expect(failed).not.toContain("LOOP-CANARY-TOKEN");
  });

  it("a junction at a watched path at base is refused before any tag", () => {
    const hooks = join(repo.root, ".git", "hooks");
    const aside = join(repo.root, ".git", "hooks-aside");
    const victim = join(tmp.dir, "base-hooks");
    mkdirSync(victim);
    writeFileSync(join(victim, "canary.txt"), "BASE-CANARY");
    renameSync(hooks, aside);
    symlinkSync(victim, hooks, "junction");
    const head = repo.sha();
    let caught: unknown = null;
    try {
      void runLoop(loopConfig());
    } catch (err) {
      caught = err;
    } finally {
      try {
        if (lstatSync(hooks).isSymbolicLink()) rmdirSync(hooks);
      } catch {
        // already removed
      }
      try {
        renameSync(aside, hooks);
      } catch {
        // already back
      }
    }
    expect(caught).toBeInstanceOf(LoopRefused);
    expect((caught as LoopRefused).code).toBe("link-at-base");
    expect((caught as Error).message).toContain("hooks");
    expect(repo.sha()).toBe(head);
    expect(rawGit(repo.root, ["tag", "--list", "loop-001-base"])).toBe("");
    expect(readFileSync(join(victim, "canary.txt"), "utf-8")).toBe("BASE-CANARY");
  });

  it.skipIf(!isWin)("R35: a machine-config junction at base is not refused, and one planted later is a type change", async () => {
    const xdg = join(tmp.dir, "xdg");
    const gitDir = join(xdg, "git");
    mkdirSync(gitDir, { recursive: true });
    writeFileSync(join(gitDir, "config"), "[user]\n\tname = base\n");
    const env = {
      ...process.env,
      HOME: tmp.dir,
      USERPROFILE: tmp.dir,
      XDG_CONFIG_HOME: xdg,
      GIT_CONFIG_GLOBAL: join(tmp.dir, ".gitconfig"),
      GIT_CONFIG_SYSTEM: join(tmp.dir, "system.gitconfig"),
    };
    writeFileSync(env.GIT_CONFIG_GLOBAL, "");
    writeFileSync(env.GIT_CONFIG_SYSTEM, "");
    const proceeded = await runLoop(loopConfig({ env }));
    expect(proceeded.failure, proceeded.failure?.reason).toBeNull();
    expect(proceeded.findings.some((f) => f.includes(gitDir) && f.includes("link at base"))).toBe(false);

    const victim = join(tmp.dir, "xdg-victim");
    mkdirSync(victim);
    writeFileSync(join(victim, "canary.txt"), "XDG-CANARY-TOKEN");
    const planted = await runLoop(
      loopConfig({
        env,
        loop: "t002",
        roles: {
          planner: new StubPlanner(),
          developer: {
            role: "developer",
            run: async (ctx) => {
              const deliverable = await new StubDeveloper().run(ctx);
              renameSync(gitDir, join(xdg, "git-aside"));
              symlinkSync(victim, gitDir, "junction");
              return deliverable;
            },
          },
          qa: new StubQa(),
        },
      }),
    );
    expect(planted.failure, planted.failure?.reason).toBeNull();
    expect(planted.findings.some((f) => f.includes("type change") && f.includes(gitDir))).toBe(true);
    expect(readFileSync(join(victim, "canary.txt"), "utf-8")).toBe("XDG-CANARY-TOKEN");
    expect(namesOf(victim)).toEqual(["canary.txt"]);
    const blob = JSON.stringify(planted.findings) + (planted.failure?.reason ?? "");
    expect(blob).not.toContain("XDG-CANARY-TOKEN");
  });

  it("R44: a machine-config link planted after base is not read through on the next stage", () => {
    const xdg = join(tmp.dir, "xdg-r44");
    const gitDir = join(xdg, "git");
    mkdirSync(gitDir, { recursive: true });
    const cfg = join(gitDir, "config");
    writeFileSync(cfg, "[user]\n\tname = base\n");
    const watch = new MachineConfigWatch([{ scope: "xdg", path: cfg, source: "test" }]);
    watch.begin("developer");

    const victim = join(tmp.dir, "r44-victim");
    mkdirSync(victim);
    writeFileSync(join(victim, "config"), "[user]\n\tname = VICTIM-R44\n");
    renameSync(gitDir, join(xdg, "git-aside"));
    symlinkSync(victim, gitDir, "junction");

    const dev = watch.compare();
    expect(dev.some((f) => f.after.includes("not read"))).toBe(true);

    watch.begin("qa");
    writeFileSync(join(victim, "config"), "[user]\n\tname = VICTIM-R44-EDITED\n");
    const qa = watch.compare();
    const reread = qa.find((f) => /^[0-9a-f]{16}$/.test(f.before) && /^[0-9a-f]{16}$/.test(f.after));
    expect(reread, JSON.stringify(qa)).toBeUndefined();
    expect(qa.some((f) => f.after.includes("not read"))).toBe(true);
    expect(readFileSync(join(victim, "config"), "utf-8")).toContain("VICTIM-R44-EDITED");
  });

  it("R45: a junction at a tree root that was absent is removed and the absence restored", () => {
    const wt = join(tmp.dir, "wt-r45");
    rawGit(repo.root, ["worktree", "add", "-b", "wt-r45", wt]);
    const dirs = resolveGitDirs(wt);
    const info = join(dirs.gitDir, "info");
    expect(dirs.gitDir).not.toBe(dirs.commonDir);
    expect(() => lstatSync(info)).toThrow();

    const watch = new ConfigWatch(dirs, wt);
    watch.begin("developer");
    const victim = join(tmp.dir, "r45-victim");
    const canary = join(victim, "canary.txt");
    mkdirSync(victim);
    writeFileSync(canary, "R45-CANARY");
    symlinkSync(victim, info, "junction");

    const v = watch.closeAndRestore();
    expect(v.ok).toBe(false);
    const root = v.changes.find((c) => c.path === info);
    expect(root, v.message).toBeTruthy();
    expect(root?.before).toBe("absent");
    expect(root?.after).toContain("type:symlink");
    expect(root?.after).toContain(`readlink:${victim}`);
    expect(() => lstatSync(info)).toThrow();
    expect(readFileSync(canary, "utf-8")).toBe("R45-CANARY");
    expect(namesOf(victim)).toEqual(["canary.txt"]);
  });

  it("R45: a machine-config path absent at base, later a link, is reported and not read", () => {
    const xdg = join(tmp.dir, "xdg-r45");
    mkdirSync(xdg);
    const gitDir = join(xdg, "git");
    const cfg = join(gitDir, "config");
    const watch = new MachineConfigWatch([{ scope: "xdg", path: cfg, source: "test" }]);
    watch.begin("developer");

    const victim = join(tmp.dir, "r45-xdg-victim");
    mkdirSync(victim);
    writeFileSync(join(victim, "config"), "[user]\n\tname = VICTIM-R45\n");
    symlinkSync(victim, gitDir, "junction");

    const found = watch.compare();
    expect(found).toHaveLength(1);
    expect(found[0]?.before).toBe("absent");
    expect(found[0]?.after).toContain("absent → symlink");
    expect(found[0]?.after).toContain(victim);
    expect(found[0]?.after).toContain("not read through");
    expect(found[0]?.after).not.toContain("VICTIM-R45");
    expect(found.some((f) => /^[0-9a-f]{16}$/.test(f.after))).toBe(false);
    expect(readFileSync(join(victim, "config"), "utf-8")).toContain("VICTIM-R45");
    expect(lstatSync(gitDir).isSymbolicLink()).toBe(true);
  });

  it("R46: a tree-root link is named with its type and readlink target", () => {
    const dirs = resolveGitDirs(repo.root);
    const watch = new ConfigWatch(dirs);
    watch.begin("developer");
    const hooks = join(dirs.commonDir, "hooks");
    const aside = join(dirs.commonDir, "hooks-aside-r46");
    const victim = join(tmp.dir, "r46-hooks");
    mkdirSync(victim);
    writeFileSync(join(victim, "canary.txt"), "R46-HOOKS");
    renameSync(hooks, aside);
    symlinkSync(victim, hooks, "junction");
    const v = watch.closeAndRestore();
    const root = v.changes.find((c) => c.path === hooks);
    expect(root, v.message).toBeTruthy();
    expect(root?.after).toContain("type:symlink");
    expect(root?.after).toContain(`readlink:${victim}`);
    expect(lstatSync(hooks).isDirectory()).toBe(true);
    expect(readFileSync(join(victim, "canary.txt"), "utf-8")).toBe("R46-HOOKS");
  });

  it("R46: a link entry is named with its type and readlink target", () => {
    const dirs = resolveGitDirs(repo.root);
    const watch = new ConfigWatch(dirs);
    watch.begin("developer");
    const victim = join(tmp.dir, "r46-entry");
    mkdirSync(victim);
    writeFileSync(join(victim, "canary.txt"), "R46-ENTRY");
    const entry = join(dirs.commonDir, "hooks", "sub");
    symlinkSync(victim, entry, "junction");
    const v = watch.closeAndRestore();
    const row = v.changes.find((c) => c.path === entry);
    expect(row, v.message).toBeTruthy();
    expect(row?.after).toContain("type:symlink");
    expect(row?.after).toContain(`readlink:${victim}`);
    expect(() => lstatSync(entry)).toThrow();
    expect(readFileSync(join(victim, "canary.txt"), "utf-8")).toBe("R46-ENTRY");
  });

  it("R46: baseNotes names a link at a parent component of a machine-config path", () => {
    const xdg = join(tmp.dir, "xdg-r46");
    const victim = join(tmp.dir, "r46-base-victim");
    mkdirSync(xdg);
    mkdirSync(victim);
    writeFileSync(join(victim, "config"), "[user]\n\tname = base\n");
    const gitDir = join(xdg, "git");
    symlinkSync(victim, gitDir, "junction");
    const watch = new MachineConfigWatch([{ scope: "xdg", path: join(gitDir, "config"), source: "test" }]);
    const notes = watch.baseNotes();
    expect(notes.some((n) => n.includes(gitDir) && n.includes("type symlink") && n.includes(victim))).toBe(true);
  });

  it("R43: a hard link that replaces a watched file is not read", () => {
    const dirs = resolveGitDirs(repo.root);
    const config = join(dirs.commonDir, "config");
    const watch = new ConfigWatch(dirs);
    watch.begin("developer");
    const victim = join(tmp.dir, "r43-victim");
    const bytes = Buffer.from("R43-VICTIM-BYTES\n");
    writeFileSync(victim, bytes);
    const victimHash = createHash("sha256").update(bytes).digest("hex").slice(0, 16);
    unlinkSync(config);
    linkSync(victim, config);
    const v = watch.closeAndRestore();
    const row = v.changes.find((c) => c.path === config);
    expect(row, v.message).toBeTruthy();
    expect(row?.after).not.toContain(victimHash);
    expect(row?.after).toContain("not read");
    expect(readFileSync(victim)).toEqual(bytes);
    expect(lstatSync(config).nlink).toBe(1);
    expect(lstatSync(victim).nlink).toBe(1);
  });

  it("R43: a machine-config hard link is not read", () => {
    const home = join(tmp.dir, "r43-home");
    mkdirSync(home);
    const cfg = join(home, ".gitconfig");
    writeFileSync(cfg, "[user]\n\tname = base\n");
    const watch = new MachineConfigWatch([{ scope: "global", path: cfg, source: "test" }]);
    watch.begin("developer");
    const victim = join(tmp.dir, "r43-machine-victim");
    const bytes = Buffer.from("[user]\n\tname = VICTIM-R43\n");
    writeFileSync(victim, bytes);
    const victimHash = createHash("sha256").update(bytes).digest("hex").slice(0, 16);
    unlinkSync(cfg);
    linkSync(victim, cfg);
    const found = watch.compare();
    expect(found).toHaveLength(1);
    expect(found[0]?.after).not.toContain(victimHash);
    expect(found[0]?.after).toContain("not read");
    expect(readFileSync(victim)).toEqual(bytes);
    expect(lstatSync(cfg).isSymbolicLink()).toBe(false);
  });

  it("R49: a machine-config file absent at base, later a hard link, is reported from lstat and not read", () => {
    const xdg = join(tmp.dir, "xdg-r49-absent");
    const gitDir = join(xdg, "git");
    mkdirSync(gitDir, { recursive: true });
    const cfg = join(gitDir, "config");
    const watch = new MachineConfigWatch([{ scope: "xdg", path: cfg, source: "test" }]);
    watch.begin("developer");
    const victim = join(tmp.dir, "r49-absent-victim");
    const bytes = Buffer.from("[user]\n\tname = VICTIM-R49-ABSENT\n");
    writeFileSync(victim, bytes);
    const victimHash = createHash("sha256").update(bytes).digest("hex").slice(0, 16);
    linkSync(victim, cfg);
    expect(lstatSync(cfg).nlink).toBe(2);
    const found = watch.compare();
    const blob = JSON.stringify(found);
    expect(blob, blob).not.toContain(victimHash);
    expect(found[0]?.path).toBe(cfg);
    expect(found[0]?.after).toContain("not read");
    expect(found[0]?.after).toContain("nlink 2");
    expect(readFileSync(victim)).toEqual(bytes);
  });

  it("R49: a directory replaced beyond a machine-config link at base is not read", () => {
    const xdg = join(tmp.dir, "xdg-r49-j");
    const dot = join(tmp.dir, "r49-dot-j");
    mkdirSync(dot);
    writeFileSync(join(dot, "config"), "[user]\n\tname = base-j\n");
    mkdirSync(xdg);
    const gitDir = join(xdg, "git");
    symlinkSync(dot, gitDir, "junction");
    const watch = new MachineConfigWatch([{ scope: "xdg", path: join(gitDir, "config"), source: "test" }]);
    watch.begin("developer");
    const victim = join(tmp.dir, "r49-j-victim");
    mkdirSync(victim);
    const bytes = Buffer.from("[user]\n\tname = VICTIM-R49-J\n");
    writeFileSync(join(victim, "config"), bytes);
    const victimHash = createHash("sha256").update(bytes).digest("hex").slice(0, 16);
    renameSync(dot, join(tmp.dir, "r49-dot-j-aside"));
    symlinkSync(victim, dot, "junction");
    const found = watch.compare();
    const blob = JSON.stringify(found);
    expect(blob, blob).not.toContain(victimHash);
    expect(blob).toContain("not read");
    expect(readFileSync(join(victim, "config"))).toEqual(bytes);
  });

  it("R49: a hard link beyond a machine-config link at base is not read", () => {
    const xdg = join(tmp.dir, "xdg-r49-h");
    const dot = join(tmp.dir, "r49-dot-h");
    mkdirSync(dot);
    const baseCfg = join(dot, "config");
    writeFileSync(baseCfg, "[user]\n\tname = base-h\n");
    mkdirSync(xdg);
    const gitDir = join(xdg, "git");
    symlinkSync(dot, gitDir, "junction");
    const watch = new MachineConfigWatch([{ scope: "xdg", path: join(gitDir, "config"), source: "test" }]);
    watch.begin("developer");
    const victim = join(tmp.dir, "r49-h-victim");
    const bytes = Buffer.from("[user]\n\tname = VICTIM-R49-H\n");
    writeFileSync(victim, bytes);
    const victimHash = createHash("sha256").update(bytes).digest("hex").slice(0, 16);
    unlinkSync(baseCfg);
    linkSync(victim, baseCfg);
    expect(lstatSync(baseCfg).nlink).toBe(2);
    const found = watch.compare();
    const blob = JSON.stringify(found);
    expect(blob, blob).not.toContain(victimHash);
    expect(blob).toContain("not read");
    expect(readFileSync(victim)).toEqual(bytes);
  });

  it("R49: a repository file absent at base is not read when it appears", () => {
    const dirs = resolveGitDirs(repo.root);
    const watch = new ConfigWatch(dirs);
    watch.begin("developer");
    const hook = join(dirs.commonDir, "hooks", "post-commit");
    const bytes = Buffer.from("#!/bin/sh\necho R49-REPO\n");
    writeFileSync(hook, bytes);
    const hash = createHash("sha256").update(bytes).digest("hex").slice(0, 16);
    const v = watch.closeAndRestore();
    const blob = JSON.stringify(v.changes) + v.message;
    expect(blob, blob).not.toContain(hash);
    expect(blob).toContain("not read");
  });

  it("R50: a hard link already at a repository file at base is no change and carries no exception text", () => {
    const dirs = resolveGitDirs(repo.root);
    const config = join(dirs.commonDir, "config");
    const bytes = readFileSync(config);
    const victim = join(tmp.dir, "r50-victim");
    writeFileSync(victim, bytes);
    unlinkSync(config);
    linkSync(victim, config);
    expect(lstatSync(config).nlink).toBe(2);
    const watch = new ConfigWatch(dirs);
    watch.begin("planner");
    const v = watch.closeAndRestore();
    const blob = JSON.stringify(v) ;
    expect(blob, blob).not.toContain("equals");
    expect(blob).not.toContain("TypeError");
    expect(blob).not.toContain("Cannot read properties");
    expect(v.ok, blob).toBe(true);
    expect(v.changes, blob).toEqual([]);
    expect(v.unrestored, blob).toEqual([]);
    expect(readFileSync(victim)).toEqual(bytes);
    expect(lstatSync(config).nlink).toBe(2);
  });
});
