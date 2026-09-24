/**
 * CA-15 — a restore must not write, delete or chmod outside the repository
 * through a junction at a watched path (a), a junction at an ancestor (b),
 * or a hard link (c). Probes use a scratch victim. POSIX symlink cases are
 * skipped on win32, where creating a file symlink is EPERM without privilege.
 */

import { describe, it, expect, beforeAll, beforeEach, afterEach } from "vitest";
import { createHash } from "node:crypto";
import {
  chmodSync,
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

  it.skipIf(isWin)("R35: a symlink at $XDG_CONFIG_HOME/git at base proceeds past preflight", async () => {
    const xdg = join(tmp.dir, "xdg-r35-posix");
    const dot = join(tmp.dir, "r35-posix-dot");
    mkdirSync(dot);
    writeFileSync(join(dot, "config"), "[user]\n\tname = base\n");
    mkdirSync(xdg);
    symlinkSync(dot, join(xdg, "git"));
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
    const note = proceeded.findings.find((f) => f.includes(join(xdg, "git")) && f.includes("link at base"));
    expect(note, JSON.stringify(proceeded.findings)).toBeDefined();
    expect(note).toContain("type symlink");
    expect(note).toContain(`readlink ${dot}`);
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
    // R54: the link was already reported in developer. The qa edit is bytes
    // behind a path the read gate forbids, so it is not re-reported.
    expect(qa, JSON.stringify(qa)).toEqual([]);
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

  it.skipIf(isWin)("R52 (b)3: chmod through a link leaves the victim's mode unchanged", () => {
    const victim = join(tmp.dir, "r52-chmod-victim");
    writeFileSync(victim, "chmod-victim");
    chmodSync(victim, 0o644);
    const probe = join(tmp.dir, "r52-chmod-probe");
    symlinkSync(victim, probe);
    chmodSync(probe, 0o600);
    expect(lstatSync(victim).mode & 0o777, "the instrument can see a chmod through the link").toBe(0o600);
    chmodSync(victim, 0o644);

    const dirs = resolveGitDirs(repo.root);
    const watch = new ConfigWatch(dirs);
    watch.begin("developer");
    const config = join(dirs.commonDir, "config");
    renameSync(config, join(dirs.commonDir, "config-aside-r52"));
    symlinkSync(victim, config);
    watch.closeAndRestore();
    expect(lstatSync(victim).mode & 0o777).toBe(0o644);
    expect(readFileSync(victim, "utf-8")).toBe("chmod-victim");
  });

  it.skipIf(isWin)("R52 (b)4: HOME/.gitconfig as a symlink to a file is reported and not read", () => {
    const home = join(tmp.dir, "r52-b4-home");
    mkdirSync(home);
    const cfg = join(home, ".gitconfig");
    writeFileSync(cfg, "[user]\n\tname = base\n");
    const watch = new MachineConfigWatch([{ scope: "global", path: cfg, source: "test" }]);
    watch.begin("developer");
    const victim = join(tmp.dir, "r52-b4-victim");
    const bytes = Buffer.from("[user]\n\tname = VICTIM-R52-B4\n");
    writeFileSync(victim, bytes);
    const victimHash = createHash("sha256").update(bytes).digest("hex").slice(0, 16);
    unlinkSync(cfg);
    symlinkSync(victim, cfg);
    const found = watch.compare();
    const blob = JSON.stringify(found);
    expect(blob, blob).not.toContain(victimHash);
    expect(blob).toContain("not read");
    expect(readFileSync(victim)).toEqual(bytes);
  });

  it.skipIf(isWin)("R52 R29: mode 000 shows EACCES on a direct read, and the bytes are not recorded", () => {
    const home = join(tmp.dir, "r52-mode0-home");
    mkdirSync(home);
    const cfg = join(home, ".gitconfig");
    const bytes = Buffer.from("[user]\n\tname = MODE0-SECRET\n");
    writeFileSync(cfg, bytes);
    chmodSync(cfg, 0o000);
    try {
      let code = "";
      try {
        readFileSync(cfg);
      } catch (err) {
        code = (err as NodeJS.ErrnoException).code ?? "";
      }
      if (code !== "EACCES") {
        throw new Error(`mode 000 direct read did not throw EACCES (code ${code || "none"}); not skipping`);
      }
      const hash = createHash("sha256").update(bytes).digest("hex").slice(0, 16);
      const watch = new MachineConfigWatch([{ scope: "global", path: cfg, source: "test" }]);
      watch.begin("developer");
      const blob = JSON.stringify(watch.compare());
      expect(blob).not.toContain(hash);
      expect(blob).not.toContain("MODE0-SECRET");
    } finally {
      chmodSync(cfg, 0o644);
    }
  });

  it.skipIf(isWin)("R52 control: a write through the link changes the victim, and a plant without the runtime does not", () => {
    const victim = join(tmp.dir, "r52-write-victim");
    writeFileSync(victim, "before");
    const link = join(tmp.dir, "r52-write-link");
    symlinkSync(victim, link);
    writeFileSync(link, "after");
    expect(readFileSync(victim, "utf-8")).toBe("after");

    const plantedVictim = join(tmp.dir, "r52-plant-victim");
    mkdirSync(plantedVictim);
    writeFileSync(join(plantedVictim, "canary.txt"), "PLANT");
    const planted = join(tmp.dir, "r52-planted");
    symlinkSync(plantedVictim, planted);
    expect(readFileSync(join(plantedVictim, "canary.txt"), "utf-8")).toBe("PLANT");
    expect(namesOf(plantedVictim)).toEqual(["canary.txt"]);
  });

  /**
   * R55. The final component is a link at base (`~/.gitconfig` → `dot/gitconfig`).
   * Red at f9a1aa8 on Linux: the chain held the link and snap read the swapped target.
   * Turns red by reverting `routeChain` so a final link is not followed (A4's `componentPaths`).
   */
  it.skipIf(isWin)("R55 CONTROL: the base link's target edited in place is read", () => {
    const home = join(tmp.dir, "r55-ctl-home");
    const dot = join(home, "dot");
    mkdirSync(dot, { recursive: true });
    const target = join(dot, "gitconfig");
    writeFileSync(target, "[user]\n\tname = base\n");
    const cfg = join(home, ".gitconfig");
    symlinkSync(join("dot", "gitconfig"), cfg);
    expect(lstatSync(cfg).isSymbolicLink(), "plant: .gitconfig is a symlink").toBe(true);
    const watch = new MachineConfigWatch([{ scope: "global", path: cfg, source: "test" }]);
    watch.begin("developer");
    const edited = "[user]\n\tname = dotfiles-edited-in-place\n";
    writeFileSync(target, edited);
    const hash = createHash("sha256").update(edited).digest("hex").slice(0, 16);
    const found = watch.compare();
    expect(JSON.stringify(found), JSON.stringify(found)).toContain(hash);
    expect(readFileSync(target, "utf-8")).toBe(edited);
  });

  it.skipIf(isWin)("R55: the base link's target replaced by a hard link is not read", () => {
    const home = join(tmp.dir, "r55-h-home");
    const dot = join(home, "dot");
    mkdirSync(dot, { recursive: true });
    const target = join(dot, "gitconfig");
    writeFileSync(target, "[user]\n\tname = base\n");
    const cfg = join(home, ".gitconfig");
    symlinkSync(join("dot", "gitconfig"), cfg);
    expect(lstatSync(cfg).isSymbolicLink(), "plant: .gitconfig is a symlink").toBe(true);
    const watch = new MachineConfigWatch([{ scope: "global", path: cfg, source: "test" }]);
    watch.begin("developer");
    const victim = join(tmp.dir, "r55-h-victim");
    const bytes = Buffer.from("[user]\n\tname = VICTIM-R55-H\n");
    writeFileSync(victim, bytes);
    const victimHash = createHash("sha256").update(bytes).digest("hex").slice(0, 16);
    unlinkSync(target);
    linkSync(victim, target);
    expect(lstatSync(target).nlink, "plant: target nlink 2").toBe(2);
    const dev = watch.compare();
    watch.begin("qa");
    writeFileSync(victim, "[user]\n\tname = VICTIM-R55-H-QA\n");
    const qaHash = createHash("sha256").update(readFileSync(victim)).digest("hex").slice(0, 16);
    const qa = watch.compare();
    const blob = JSON.stringify([...dev, ...qa]);
    expect(blob, blob).not.toContain(victimHash);
    expect(blob, blob).not.toContain(qaHash);
    expect(blob).toContain("not read");
  });

  it.skipIf(isWin)("R55: the base link's target directory replaced by a symlink is not read", () => {
    const home = join(tmp.dir, "r55-j-home");
    const dot = join(home, "dot");
    mkdirSync(dot, { recursive: true });
    writeFileSync(join(dot, "gitconfig"), "[user]\n\tname = base\n");
    const cfg = join(home, ".gitconfig");
    symlinkSync(join("dot", "gitconfig"), cfg);
    const watch = new MachineConfigWatch([{ scope: "global", path: cfg, source: "test" }]);
    watch.begin("developer");
    const victim = join(tmp.dir, "r55-j-victim");
    mkdirSync(victim);
    const bytes = Buffer.from("[user]\n\tname = VICTIM-R55-J\n");
    writeFileSync(join(victim, "gitconfig"), bytes);
    const victimHash = createHash("sha256").update(bytes).digest("hex").slice(0, 16);
    renameSync(dot, `${dot}-aside`);
    symlinkSync(victim, dot);
    expect(lstatSync(dot).isSymbolicLink(), "plant: dot is a symlink").toBe(true);
    const blob = JSON.stringify(watch.compare());
    expect(blob, blob).not.toContain(victimHash);
    expect(blob).toContain("not read");
  });

  it.skipIf(isWin)("R55: the base link's target replaced by a new file is not read", () => {
    const home = join(tmp.dir, "r55-r-home");
    const dot = join(home, "dot");
    mkdirSync(dot, { recursive: true });
    const target = join(dot, "gitconfig");
    writeFileSync(target, "[user]\n\tname = base\n");
    const cfg = join(home, ".gitconfig");
    symlinkSync(join("dot", "gitconfig"), cfg);
    const watch = new MachineConfigWatch([{ scope: "global", path: cfg, source: "test" }]);
    watch.begin("developer");
    const nb = "[user]\n\tname = NEW-FILE-R55\n";
    writeFileSync(`${target}-new`, nb);
    renameSync(`${target}-new`, target);
    const hash = createHash("sha256").update(nb).digest("hex").slice(0, 16);
    const blob = JSON.stringify(watch.compare());
    expect(blob, blob).not.toContain(hash);
    expect(blob).toContain("not read");
  });

  /**
   * R57. The second stage's begin must not hash a repository file whose route
   * differs from the loop's base. Red at f9a1aa8: `begin` called `readState`
   * with no gate. Turns red by reading inside `begin` whenever the route differs.
   */
  it("R57: a later stage does not read a repository file whose route differs from the loop base", () => {
    const dirs = resolveGitDirs(repo.root);
    const watch = new ConfigWatch(dirs);
    watch.begin("developer");
    watch.closeAndRestore();
    const config = join(dirs.commonDir, "config");
    const victim = join(tmp.dir, "r57-victim");
    const bytes = Buffer.from("# VICTIM-R57\n");
    writeFileSync(victim, bytes);
    const victimHash = createHash("sha256").update(bytes).digest("hex").slice(0, 16);
    unlinkSync(config);
    linkSync(victim, config);
    expect(lstatSync(config).nlink, "plant: config nlink 2").toBe(2);
    watch.begin("qa");
    writeFileSync(victim, "# VICTIM-R57-QA\n");
    const qaHash = createHash("sha256").update(readFileSync(victim)).digest("hex").slice(0, 16);
    const v = watch.closeAndRestore();
    const blob = JSON.stringify(v);
    expect(blob, blob).not.toContain(victimHash);
    expect(blob, blob).not.toContain(qaHash);
    expect(blob).toContain("not read");
    expect(readFileSync(victim, "utf-8")).toContain("VICTIM-R57-QA");
  });

  it.skipIf(isWin)("R58 (b)3: a symlink planted on a hook entry does not change the victim, and the modes differ", () => {
    const dirs = resolveGitDirs(repo.root);
    const hook = join(dirs.commonDir, "hooks", "post-commit");
    writeFileSync(hook, "#!/bin/sh\nexit 0\n");
    chmodSync(hook, 0o755);
    const snapMode = lstatSync(hook).mode & 0o777;
    const victim = join(tmp.dir, "r58-b3-victim");
    writeFileSync(victim, "victim");
    chmodSync(victim, 0o644);
    const victimMode = lstatSync(victim).mode & 0o777;
    expect(snapMode, `snapshot ${snapMode.toString(8)} victim ${victimMode.toString(8)}`).not.toBe(victimMode);

    const probe = join(tmp.dir, "r58-b3-probe");
    symlinkSync(victim, probe);
    writeFileSync(probe, "through-link");
    expect(readFileSync(victim, "utf-8"), "control: a write through the link changes the victim").toBe("through-link");
    writeFileSync(victim, "victim");

    const watch = new ConfigWatch(dirs);
    watch.begin("developer");
    unlinkSync(hook);
    symlinkSync(victim, hook);
    expect(lstatSync(hook).isSymbolicLink(), "plant: hook entry is a symlink").toBe(true);
    expect(readFileSync(victim, "utf-8"), "control: the plant itself leaves the victim").toBe("victim");
    watch.closeAndRestore();
    expect(lstatSync(victim).mode & 0o777).toBe(victimMode);
    expect(readFileSync(victim, "utf-8")).toBe("victim");
  });

  it.skipIf(isWin)("R58 R29: a link to a mode-000 victim is not read", () => {
    const home = join(tmp.dir, "r58-r29-home");
    mkdirSync(home);
    const victim = join(tmp.dir, "r58-r29-victim");
    const bytes = Buffer.from("[user]\n\tname = MODE0-LINK-SECRET\n");
    writeFileSync(victim, bytes);
    chmodSync(victim, 0o000);
    const cfg = join(home, ".gitconfig");
    symlinkSync(victim, cfg);
    expect(lstatSync(cfg).isSymbolicLink(), "plant: .gitconfig is a link to the mode-000 victim").toBe(true);
    try {
      let code = "";
      try {
        readFileSync(cfg);
      } catch (err) {
        code = (err as NodeJS.ErrnoException).code ?? "";
      }
      if (code !== "EACCES") throw new Error(`read through the link did not throw EACCES (code ${code || "none"})`);
      const hash = createHash("sha256").update(bytes).digest("hex").slice(0, 16);
      const watch = new MachineConfigWatch([{ scope: "global", path: cfg, source: "test" }]);
      watch.begin("developer");
      const blob = JSON.stringify(watch.compare());
      expect(blob).not.toContain(hash);
      expect(blob).not.toContain("MODE0-LINK-SECRET");
    } finally {
      chmodSync(victim, 0o644);
    }
  });
});
