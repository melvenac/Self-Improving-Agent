/**
 * CA-15 — a restore must not write, delete or chmod outside the repository
 * through a junction at a watched path (a), a junction at an ancestor (b),
 * or a hard link (c). Probes use a scratch victim. POSIX symlink cases are
 * skipped on win32, where creating a file symlink is EPERM without privilege.
 */

import { describe, it, expect, beforeAll, beforeEach, afterEach } from "vitest";
import { createHash } from "node:crypto";
import {
  appendFileSync,
  chmodSync,
  lstatSync,
  mkdirSync,
  statSync,
  utimesSync,
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
import { ConfigWatch, MachineConfigWatch, resolveGitDirs, routeEnd } from "../../src/harness/configwatch.js";
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
      expect(lstatSync(config).isSymbolicLink(), "plant: config is a symlink").toBe(true);
      const probe = join(tmp.dir, "b1-probe");
      symlinkSync(victim, probe);
      writeFileSync(probe, "through-link");
      expect(readFileSync(victim, "utf-8"), "control: a write through the link changes the victim").toBe("through-link");
      writeFileSync(victim, "SYM-CANARY");
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
        expect(lstatSync(hooks).isSymbolicLink(), "plant: hooks is a symlink").toBe(true);
        const probe = join(tmp.dir, "b2-probe");
        symlinkSync(victim, probe);
        writeFileSync(join(probe, "through.txt"), "through");
        expect(readFileSync(canary, "utf-8"), "control: a write through the link changes the victim").toBe("HOOKS-SYM-CANARY");
        expect(readFileSync(join(victim, "through.txt"), "utf-8")).toBe("through");
        unlinkSync(join(victim, "through.txt"));
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
      expect(lstatSync(dot).isSymbolicLink(), "plant: .git is a symlink").toBe(true);
      const probe = join(tmp.dir, "b6-probe");
      symlinkSync(victim, probe);
      writeFileSync(join(probe, "through.txt"), "through");
      expect(namesOf(victim), "control: a write through the link changes the victim").toContain("through.txt");
      unlinkSync(join(victim, "through.txt"));
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
    const reread = qa.find((f) => /^[0-9a-f]{16}$/.test(f.before) && /^[0-9a-f]{16}$/.test(f.after) && f.before !== f.after);
    expect(reread, JSON.stringify(qa)).toBeUndefined();
    // R54: the link was already reported in developer. The qa edit is bytes
    // behind a path the read gate forbids, so it is not re-reported as a change.
    // R65: the path is still in the qa record.
    expect(qa.some((f) => f.path === cfg), JSON.stringify(qa)).toBe(true);
    expect(JSON.stringify(qa)).not.toContain("VICTIM-R44-EDITED");
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
    expect(lstatSync(cfg).isSymbolicLink(), "plant: .gitconfig is a symlink").toBe(true);
    const probe = join(tmp.dir, "b4-probe");
    symlinkSync(victim, probe);
    writeFileSync(probe, "[user]\n\tname = THROUGH\n");
    expect(readFileSync(victim, "utf-8"), "control: a write through the link changes the victim").toContain("THROUGH");
    writeFileSync(victim, bytes);
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

  it.skipIf(isWin)("R55: the base link's target replaced by a new file is read (D-042)", () => {
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
    expect(blob, blob).toContain(hash);
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

  it("R59: qa reads a machine file restored to its base resolution and does not say not read", () => {
    const home = join(tmp.dir, "r59-revert-home");
    mkdirSync(home);
    const cfg = join(home, ".gitconfig");
    const original = "[user]\n\tname = base-r59\n";
    writeFileSync(cfg, original);
    const restored = createHash("sha256").update(original).digest("hex").slice(0, 16);
    const aside = join(tmp.dir, "r59-aside");
    const watch = new MachineConfigWatch([{ scope: "global", path: cfg, source: "test" }]);
    watch.begin("developer");
    renameSync(cfg, aside);
    const victim = join(tmp.dir, "r59-victim");
    writeFileSync(victim, "[user]\n\tname = V1-R59\n");
    linkSync(victim, cfg);
    expect(lstatSync(cfg).nlink, "plant: developer left a hard link").toBe(2);
    const dev = watch.compare();
    expect(JSON.stringify(dev)).toContain("not read");
    watch.begin("qa");
    unlinkSync(cfg);
    renameSync(aside, cfg);
    const qa = watch.compare();
    const blob = JSON.stringify(qa);
    expect(blob, blob).not.toContain("not read");
    expect(blob, blob).toContain(restored);
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
    writeFileSync(cfg, "[user]\n\tname = base\n");
    const watch = new MachineConfigWatch([{ scope: "global", path: cfg, source: "test" }]);
    watch.begin("developer");
    unlinkSync(cfg);
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
      const blob = JSON.stringify(watch.compare());
      expect(blob).not.toContain(hash);
      expect(blob).not.toContain("MODE0-LINK-SECRET");
      expect(blob).not.toContain("unreadable");
      expect(blob).toContain("not read");
    } finally {
      chmodSync(victim, 0o644);
    }
  });

  /**
   * R60. The OS resolves the link. An in-place edit of the base file is hashed.
   * Red at 4c1287f: the route walk stops short (relative `..`, and a link with
   * two components after it) and the path is silently unread.
   */
  it.skipIf(isWin)("R60: an in-place edit through a stow relative link is read and hashed", () => {
    const home = join(tmp.dir, "r60-stow-home");
    const dotfiles = join(tmp.dir, "r60-dotfiles");
    mkdirSync(home);
    mkdirSync(dotfiles);
    const target = join(dotfiles, "gitconfig");
    writeFileSync(target, "[user]\n\tname = base\n");
    const cfg = join(home, ".gitconfig");
    symlinkSync(join("..", "r60-dotfiles", "gitconfig"), cfg);
    expect(lstatSync(cfg).isSymbolicLink(), "plant: stow link climbs out with ..").toBe(true);
    const watch = new MachineConfigWatch([{ scope: "global", path: cfg, source: "test" }]);
    const notes = watch.baseNotes().join("\n");
    watch.begin("developer");
    const edited = "[user]\n\tname = stow-edited-in-place\n";
    writeFileSync(target, edited);
    const hash = createHash("sha256").update(edited).digest("hex").slice(0, 16);
    const blob = JSON.stringify(watch.compare());
    if (notes.includes("read through")) expect(blob, notes).toContain(hash);
    expect(blob, blob).toContain(hash);
  });

  it.skipIf(isWin)("R60: an in-place edit below a linked config directory is read and hashed", () => {
    const real = join(tmp.dir, "r60-real-xdg");
    mkdirSync(join(real, "git"), { recursive: true });
    const target = join(real, "git", "config");
    writeFileSync(target, "[user]\n\tname = base\n");
    const xdg = join(tmp.dir, "r60-xdg-link");
    symlinkSync(real, xdg);
    const cfg = join(xdg, "git", "config");
    expect(lstatSync(xdg).isSymbolicLink(), "plant: the config home is a link with two components after it").toBe(true);
    const watch = new MachineConfigWatch([{ scope: "xdg", path: cfg, source: "test" }]);
    watch.begin("developer");
    const edited = "[user]\n\tname = anchor-edited-in-place\n";
    writeFileSync(target, edited);
    const hash = createHash("sha256").update(edited).digest("hex").slice(0, 16);
    const blob = JSON.stringify(watch.compare());
    expect(blob, blob).toContain(hash);
  });

  it.skipIf(isWin)("R60: a different file reached through a stow link is not read, and both resolutions are named", () => {
    const home = join(tmp.dir, "r60-swap-home");
    const dotfiles = join(tmp.dir, "r60-swap-dotfiles");
    mkdirSync(home);
    mkdirSync(dotfiles);
    const target = join(dotfiles, "gitconfig");
    writeFileSync(target, "[user]\n\tname = base\n");
    const cfg = join(home, ".gitconfig");
    symlinkSync(join("..", "r60-swap-dotfiles", "gitconfig"), cfg);
    const watch = new MachineConfigWatch([{ scope: "global", path: cfg, source: "test" }]);
    watch.begin("developer");
    const victim = join(tmp.dir, "r60-swap-victim");
    const bytes = Buffer.from("[user]\n\tname = VICTIM-R60\n");
    writeFileSync(victim, bytes);
    const victimHash = createHash("sha256").update(bytes).digest("hex").slice(0, 16);
    const baseIno = lstatSync(target).ino;
    unlinkSync(target);
    linkSync(victim, target);
    expect(lstatSync(target).nlink, "plant: target nlink 2").toBe(2);
    const nowIno = lstatSync(target).ino;
    expect(nowIno, "plant: the base inode and the current inode differ").not.toBe(baseIno);
    const blob = JSON.stringify(watch.compare());
    expect(blob, blob).not.toContain(victimHash);
    expect(blob).toContain("not read");
    expect(blob).toContain(target);
    expect(blob).toContain("nlink 2");
    expect(blob, "the base identity is in the record").toContain(String(baseIno));
    expect(blob, "the current identity is in the record and differs").toContain(String(nowIno));
  });

  it.skipIf(isWin)("R61: a link that does not resolve is reported unwatched and is not claimed as read", () => {
    const home = join(tmp.dir, "r61-home");
    mkdirSync(home);
    const cfg = join(home, ".gitconfig");
    symlinkSync("missing-r61-target", cfg);
    expect(lstatSync(cfg).isSymbolicLink(), "plant: dangling link").toBe(true);
    const watch = new MachineConfigWatch([{ scope: "global", path: cfg, source: "test" }]);
    const notes = watch.baseNotes().join("\n");
    expect(notes, notes).not.toContain("read through that target");
    expect(notes).toMatch(/unwatched|did not resolve/);
    watch.begin("developer");
    const blob = JSON.stringify(watch.compare());
    expect(blob + notes).toContain(cfg);
    expect(blob).not.toMatch(/[0-9a-f]{16}/);
  });

  it("R62: a repository file new since the loop base and untouched by the stage is no change", () => {
    const dirs = resolveGitDirs(repo.root);
    const watch = new ConfigWatch(dirs, repo.root);
    watch.captureBase();
    const created = join(dirs.commonDir, "hooks", "r62-new");
    writeFileSync(created, "new-since-base\n");
    watch.begin("developer");
    const v = watch.closeAndRestore();
    const blob = JSON.stringify(v);
    expect(v.ok, blob).toBe(true);
    expect(v.changes, blob).toEqual([]);
    expect(blob).not.toContain("COULD NOT BE PUT BACK");

    const control = new ConfigWatch(dirs, repo.root);
    control.captureBase();
    control.begin("developer");
    const during = join(dirs.commonDir, "hooks", "r62-during");
    writeFileSync(during, "during-stage\n");
    const cv = control.closeAndRestore();
    expect(cv.ok, JSON.stringify(cv)).toBe(false);
    expect(cv.changes.some((c) => c.path === during), JSON.stringify(cv)).toBe(true);
  });

  /**
   * R60 routeChain rest. A link with two components after it must not double
   * the path (`hooks/hooks`). Red at 4c1287f: the chain ends at that absent
   * doubled path, so a type change of the real file is not what the record names.
   */
  it.skipIf(isWin)("R60: a repository link with two components after it names the real file, not a doubled path", () => {
    const dest = join(tmp.dir, "r60-rest-dest");
    mkdirSync(join(dest, "hooks"), { recursive: true });
    const hook = join(dest, "hooks", "post-commit");
    writeFileSync(hook, "#!/bin/sh\nexit 0\n");
    const link = join(tmp.dir, "r60-rest-link");
    symlinkSync(dest, link);
    expect(lstatSync(link).isSymbolicLink(), "plant: link with hooks/post-commit after it").toBe(true);
    const end = routeEnd(tmp.dir, join(link, "hooks", "post-commit"));
    expect(end, String(end)).toBe(hook);
    expect(String(end)).not.toContain("hooks/hooks");
  });

  const h16 = (b: Buffer | string) => createHash("sha256").update(b).digest("hex").slice(0, 16);

  it("R64: a repository file rewritten between base and the stage, then untouched, is no change", () => {
    const dirs = resolveGitDirs(repo.root);
    const refs = join(dirs.commonDir, "info", "refs");
    const line = "0000000000000000000000000000000000000000\trefs/heads/main\n";
    writeFileSync(refs, line);
    const watch = new ConfigWatch(dirs, repo.root);
    watch.captureBase();
    const lock = `${refs}.lock`;
    writeFileSync(lock, line);
    renameSync(lock, refs);
    watch.begin("developer");
    const v = watch.closeAndRestore();
    const blob = JSON.stringify(v);
    expect(v.ok, blob).toBe(true);
    expect(v.changes, blob).toEqual([]);
    expect(blob).not.toContain("COULD NOT BE PUT BACK");
  });

  it("R65: an unchanged machine path appears in the stage record as read", () => {
    const home = join(tmp.dir, "r65-home");
    mkdirSync(home);
    const cfg = join(home, ".gitconfig");
    const body = "[user]\n\tname = r65-base\n";
    writeFileSync(cfg, body);
    const watch = new MachineConfigWatch([{ scope: "global", path: cfg, source: "test" }]);
    watch.begin("developer");
    const found = watch.compare();
    const blob = JSON.stringify(found);
    expect(found.some((f) => f.path === cfg), blob).toBe(true);
    expect(blob, blob).toContain(h16(body));
  });

  it.skipIf(isWin)("R65: a path unreadable at base is recorded unreadable, never absent", () => {
    const home = join(tmp.dir, "r65-000-home");
    mkdirSync(home);
    const cfg = join(home, ".gitconfig");
    writeFileSync(cfg, "[user]\n\tname = r65-000\n");
    chmodSync(cfg, 0o000);
    try {
      let code = "";
      try {
        readFileSync(cfg);
      } catch (err) {
        code = (err as NodeJS.ErrnoException).code ?? "";
      }
      if (code !== "EACCES") throw new Error(`direct read did not throw EACCES (code ${code || "none"})`);
      const watch = new MachineConfigWatch([{ scope: "global", path: cfg, source: "test" }]);
      const notes = watch.baseNotes().join("\n");
      watch.begin("developer");
      const blob = notes + JSON.stringify(watch.compare());
      expect(blob, blob).toContain(cfg);
      expect(blob).toContain("unreadable");
      expect(blob).not.toContain('"before":"absent"');
    } finally {
      chmodSync(cfg, 0o644);
    }
  });

  it("R67: a lock-and-rename in one stage and an in-place append in the next are both hashed", () => {
    const home = join(tmp.dir, "r67-home");
    mkdirSync(home);
    const cfg = join(home, ".gitconfig");
    writeFileSync(cfg, "[user]\n\tname = r67-base\n");
    const watch = new MachineConfigWatch([{ scope: "global", path: cfg, source: "test" }]);
    watch.begin("developer");
    const replaced = "[user]\n\tname = r67-replaced\n\temail = a7@example.invalid\n";
    writeFileSync(`${cfg}.lock`, replaced);
    renameSync(`${cfg}.lock`, cfg);
    const dev = watch.compare();
    const devBlob = JSON.stringify(dev);
    expect(devBlob, devBlob).toContain(h16(replaced));
    watch.begin("qa");
    const appended = `${replaced}[core]\n\tqa = appended-in-place\n`;
    writeFileSync(cfg, appended);
    const qaBlob = JSON.stringify(watch.compare());
    expect(qaBlob, qaBlob).toContain(h16(replaced));
    expect(qaBlob, qaBlob).toContain(h16(appended));
  });

  it("R67: a hard link made elsewhere does not stop an in-place read", () => {
    const home = join(tmp.dir, "r67-hl-home");
    mkdirSync(home);
    const cfg = join(home, ".gitconfig");
    writeFileSync(cfg, "[user]\n\tname = r67-hl-base\n");
    const watch = new MachineConfigWatch([{ scope: "global", path: cfg, source: "test" }]);
    watch.begin("developer");
    linkSync(cfg, join(tmp.dir, "r67-elsewhere"));
    expect(lstatSync(cfg).nlink, "plant: a second name elsewhere").toBe(2);
    const edited = "[user]\n\tname = r67-hl-edited\n";
    writeFileSync(cfg, edited);
    const blob = JSON.stringify(watch.compare());
    expect(blob, blob).toContain(h16(edited));
  });

  it.skipIf(isWin)("R67: the base link's target replaced by a new single-name file is read", () => {
    const home = join(tmp.dir, "r67-r-home");
    const dot = join(home, "dot");
    mkdirSync(dot, { recursive: true });
    const target = join(dot, "gitconfig");
    writeFileSync(target, "[user]\n\tname = base\n");
    const cfg = join(home, ".gitconfig");
    symlinkSync(join("dot", "gitconfig"), cfg);
    const watch = new MachineConfigWatch([{ scope: "global", path: cfg, source: "test" }]);
    watch.begin("developer");
    const nb = "[user]\n\tname = NEW-FILE-R67\n";
    writeFileSync(`${target}-new`, nb);
    renameSync(`${target}-new`, target);
    expect(lstatSync(target).nlink, "plant: the replacement has one name").toBe(1);
    const blob = JSON.stringify(watch.compare());
    expect(blob, blob).toContain(h16(nb));
  });

  it("R66 R50: an in-place edit of a hook hard-linked at base is a change", () => {
    const dirs = resolveGitDirs(repo.root);
    const hook = join(dirs.commonDir, "hooks", "post-commit");
    const bytes = Buffer.from("#!/bin/sh\nexit 0\n");
    writeFileSync(hook, bytes);
    const other = join(tmp.dir, "r50-other-name");
    linkSync(hook, other);
    expect(lstatSync(hook).nlink, "plant: hard-linked at base").toBe(2);
    const watch = new ConfigWatch(dirs, repo.root);
    watch.captureBase();
    watch.begin("developer");
    writeFileSync(hook, "#!/bin/sh\necho edited\n");
    const v = watch.closeAndRestore();
    const blob = JSON.stringify(v);
    expect(v.ok, blob).toBe(false);
    expect(v.changes.some((c) => c.path === hook), blob).toBe(true);
  });

  it.skipIf(isWin)("R66: a symlink planted at the watched path is a type change and is not read", () => {
    const home = join(tmp.dir, "r66-aps-home");
    mkdirSync(home);
    const cfg = join(home, ".gitconfig");
    writeFileSync(cfg, "[user]\n\tname = aps-base\n");
    const watch = new MachineConfigWatch([{ scope: "global", path: cfg, source: "test" }]);
    watch.begin("developer");
    const real = join(home, "real-gitconfig");
    renameSync(cfg, real);
    symlinkSync(real, cfg);
    const edited = "[user]\n\tname = aps-edited-through-the-new-link\n";
    writeFileSync(cfg, edited);
    expect(lstatSync(cfg).isSymbolicLink(), "plant: a link at the watched path").toBe(true);
    const blob = JSON.stringify(watch.compare());
    expect(blob, blob).toContain("type change");
    expect(blob).not.toContain(h16(edited));
  });

  it.skipIf(isWin)("R66 TRADE-DIFF: a mid-path link to a different file names both resolutions and both identities", () => {
    const xdg = join(tmp.dir, "r66-td-xdg");
    mkdirSync(join(xdg, "git"), { recursive: true });
    const cfg = join(xdg, "git", "config");
    writeFileSync(cfg, "[user]\n\tname = td-base\n");
    const baseIno = lstatSync(cfg).ino;
    const watch = new MachineConfigWatch([{ scope: "xdg", path: cfg, source: "test" }]);
    watch.begin("developer");
    const outside = join(tmp.dir, "r66-td-outside");
    mkdirSync(outside);
    const secret = "[user]\n\tname = VICTIM-TDIFF\n";
    const outsideFile = join(outside, "config");
    writeFileSync(outsideFile, secret);
    renameSync(join(xdg, "git"), join(xdg, "git-aside"));
    symlinkSync(outside, join(xdg, "git"));
    const nowIno = lstatSync(outsideFile).ino;
    const blob = JSON.stringify(watch.compare());
    expect(blob, blob).not.toContain(h16(secret));
    expect(blob).toContain(outsideFile);
    expect(blob).toContain(cfg);
    expect(blob, "base identity").toContain(String(baseIno));
    expect(blob, "current identity").toContain(String(nowIno));
  });

  it("R68: an in-place write to an unread machine path reports both fact sets", () => {
    const home = join(tmp.dir, "r68-home");
    mkdirSync(home);
    const cfg = join(home, ".gitconfig");
    writeFileSync(cfg, "[user]\n\tname = r68-base\n");
    const watch = new MachineConfigWatch([{ scope: "global", path: cfg, source: "test" }]);
    watch.begin("developer");
    const other = join(tmp.dir, "r68-other");
    const first = "[user]\n\tname = r68-two-name\n";
    writeFileSync(other, first);
    unlinkSync(cfg);
    linkSync(other, cfg);
    expect(lstatSync(cfg).nlink, "plant: two names").toBe(2);
    watch.compare();
    watch.begin("qa");
    const edited = `${first}[core]\n\tqa = in-place\n`;
    writeFileSync(cfg, edited);
    const qa = watch.compare();
    const row = qa.find((f) => f.path === cfg);
    const blob = JSON.stringify(qa);
    expect(row, blob).toBeTruthy();
    expect(row!.before, blob).not.toBe(row!.after);
    expect(row!.before).toContain("size");
    expect(row!.before).toContain("mtimeNs");
    expect(row!.after).toContain("size");
    expect(row!.after).toContain("mtimeNs");
    expect(blob).not.toContain(h16(edited));
    expect(blob).toContain("not read");
  });

  it("R69: a machine path absent at base is read once it appears as a single-name file", () => {
    const home = join(tmp.dir, "r69-home");
    mkdirSync(home);
    const cfg = join(home, ".gitconfig");
    const watch = new MachineConfigWatch([{ scope: "global", path: cfg, source: "test" }]);
    watch.begin("developer");
    const body = "[user]\n\tname = r69-created\n";
    writeFileSync(cfg, body);
    expect(lstatSync(cfg).nlink).toBe(1);
    const blob = JSON.stringify(watch.compare());
    expect(blob, blob).toContain(h16(body));
    expect(blob).toContain("absent");
  });

  it("R69: a two-name file appearing where the path was absent is not read", () => {
    const home = join(tmp.dir, "r69-two-home");
    mkdirSync(home);
    const cfg = join(home, ".gitconfig");
    const watch = new MachineConfigWatch([{ scope: "global", path: cfg, source: "test" }]);
    watch.begin("developer");
    const other = join(tmp.dir, "r69-two-other");
    const body = "[user]\n\tname = r69-two-secret\n";
    writeFileSync(other, body);
    linkSync(other, cfg);
    expect(lstatSync(cfg).nlink).toBe(2);
    const blob = JSON.stringify(watch.compare());
    expect(blob, blob).not.toContain(h16(body));
    expect(blob).toContain("not read");
  });

  it("R71: an unread repository record prints both fact sets", () => {
    const dirs = resolveGitDirs(repo.root);
    const watch = new ConfigWatch(dirs, repo.root);
    watch.begin("developer");
    watch.closeAndRestore();
    const config = join(dirs.commonDir, "config");
    const victim = join(tmp.dir, "r71-victim");
    writeFileSync(victim, "# R71-A\n");
    unlinkSync(config);
    linkSync(victim, config);
    expect(lstatSync(config).nlink).toBe(2);
    watch.begin("qa");
    writeFileSync(victim, "# R71-BB\n");
    const v = watch.closeAndRestore();
    const row = v.changes.find((c) => c.path === config);
    const blob = JSON.stringify(v);
    expect(row, blob).toBeTruthy();
    expect(row!.before, blob).not.toBe(row!.after);
    expect(row!.before).toContain("size");
    expect(row!.before).toContain("mtimeNs");
    expect(row!.after).toContain("size");
    expect(row!.after).toContain("mtimeNs");
    expect(blob).not.toContain(h16("# R71-A\n"));
    expect(blob).not.toContain(h16("# R71-BB\n"));
  });

  const facts = (p: string) => {
    const st = lstatSync(p, { bigint: true });
    return { ino: String(st.ino), size: String(st.size), mtimeNs: String(st.mtimeNs), nlink: String(st.nlink) };
  };

  it("R73: a stable unread machine record carries the lstat facts", () => {
    const home = join(tmp.dir, "r73-home");
    mkdirSync(home);
    const cfg = join(home, ".gitconfig");
    writeFileSync(cfg, "[user]\n\tname = r73-base\n");
    const watch = new MachineConfigWatch([{ scope: "global", path: cfg, source: "test" }]);
    watch.begin("developer");
    const other = join(tmp.dir, "r73-other");
    writeFileSync(other, "[user]\n\tname = r73-two\n");
    unlinkSync(cfg);
    linkSync(other, cfg);
    watch.compare();
    watch.begin("qa");
    const f = facts(cfg);
    const row = watch.compare().find((x) => x.path === cfg);
    expect(f.nlink).toBe("2");
    expect(row?.changed).toBe(false);
    expect(row?.after, JSON.stringify(row)).toContain("not read");
    expect(row?.after).toContain(f.ino);
    expect(row?.after).toContain(`size ${f.size}`);
    expect(row?.after).toContain(f.mtimeNs);
    expect(row?.after).toMatch(/type file/);
  });

  it("R73: a directory at the path carries its facts", () => {
    const home = join(tmp.dir, "r73-dir-home");
    mkdirSync(home);
    const cfg = join(home, ".gitconfig");
    mkdirSync(cfg);
    const f = facts(cfg);
    const watch = new MachineConfigWatch([{ scope: "global", path: cfg, source: "test" }]);
    watch.begin("developer");
    const row = watch.compare().find((x) => x.path === cfg);
    expect(row?.after, JSON.stringify(row)).toContain("not read");
    expect(row?.after).toContain(f.ino);
    expect(row?.changed).toBe(false);
  });

  it.skipIf(isWin)("R73: a stable unreadable file says unreadable and carries its facts", () => {
    const home = join(tmp.dir, "r73-un-home");
    mkdirSync(home);
    const cfg = join(home, ".gitconfig");
    writeFileSync(cfg, "[user]\n\tname = r73-un\n");
    chmodSync(cfg, 0o000);
    const f = facts(cfg);
    const watch = new MachineConfigWatch([{ scope: "global", path: cfg, source: "test" }]);
    watch.begin("developer");
    const row = watch.compare().find((x) => x.path === cfg);
    chmodSync(cfg, 0o644);
    expect(row?.after, JSON.stringify(row)).toContain("unreadable");
    expect(row?.after).toContain(f.ino);
  });

  it.skipIf(isWin)("R72: an in-place write to an unreadable file is a change", () => {
    const home = join(tmp.dir, "r72-home");
    mkdirSync(home);
    const cfg = join(home, ".gitconfig");
    writeFileSync(cfg, "[user]\n\tname = r72-base\n");
    const watch = new MachineConfigWatch([{ scope: "global", path: cfg, source: "test" }]);
    watch.begin("developer");
    chmodSync(cfg, 0o200);
    watch.compare();
    watch.begin("qa");
    const start = facts(cfg);
    appendFileSync(cfg, "[core]\n\tr72 = later\n");
    const end = facts(cfg);
    const row = watch.compare().find((x) => x.path === cfg);
    chmodSync(cfg, 0o644);
    expect(end.size).not.toBe(start.size);
    expect(row?.changed, JSON.stringify(row)).toBe(true);
    expect(row?.before).not.toBe(row?.after);
    expect(row?.before).toContain("unreadable");
    expect(row?.after).toContain("unreadable");
    expect(row?.before).toContain(`size ${start.size}`);
    expect(row?.after).toContain(`size ${end.size}`);
  });

  it.skipIf(isWin)("R72: an unreadable repository file is reported from its facts, not dropped", () => {
    const dirs = resolveGitDirs(repo.root);
    const config = join(dirs.commonDir, "config");
    const watch = new ConfigWatch(dirs, repo.root);
    watch.begin("developer");
    chmodSync(config, 0o200);
    const start = facts(config);
    appendFileSync(config, "\n# r72-repo\n");
    const end = facts(config);
    const v = watch.closeAndRestore();
    chmodSync(config, 0o644);
    const row = v.changes.find((c) => c.path === config);
    expect(end.size).not.toBe(start.size);
    expect(row, JSON.stringify(v)).toBeTruthy();
    expect(row!.before).not.toBe(row!.after);
    expect(row!.after).toContain("unreadable");
    expect(row!.after).toContain(`size ${end.size}`);
  });

  it.skipIf(isWin)("R71 A6-5: a failed read at stage start is the word unreadable, not absent", () => {
    const home = join(tmp.dir, "r71-un-home");
    mkdirSync(home);
    const cfg = join(home, ".gitconfig");
    writeFileSync(cfg, "[user]\n\tname = r71-un-base\n");
    const watch = new MachineConfigWatch([{ scope: "global", path: cfg, source: "test" }]);
    watch.begin("developer");
    chmodSync(cfg, 0o000);
    watch.compare();
    watch.begin("qa");
    chmodSync(cfg, 0o644);
    writeFileSync(cfg, "[user]\n\tname = r71-un-qa\n");
    const row = watch.compare().find((x) => x.path === cfg);
    expect(row?.before).toBe("unreadable");
    expect(row?.changed).toBe(true);
  });

  it("R74: the word base names the loop base, and both sides print type", () => {
    const home = join(tmp.dir, "r74-home");
    mkdirSync(home);
    const cfg = join(home, ".gitconfig");
    writeFileSync(cfg, "[user]\n\tname = r74-base\n");
    const base = facts(cfg);
    const watch = new MachineConfigWatch([{ scope: "global", path: cfg, source: "test" }]);
    watch.begin("developer");
    const other = join(tmp.dir, "r74-other");
    writeFileSync(other, "[user]\n\tname = r74-two\n");
    unlinkSync(cfg);
    linkSync(other, cfg);
    watch.compare();
    const start = facts(cfg);
    watch.begin("qa");
    appendFileSync(cfg, "[core]\n\tr74 = later\n");
    const row = watch.compare().find((x) => x.path === cfg)!;
    const baseSeg = /not read: base (.*?); current/.exec(row.after)?.[1] ?? "";
    expect(base.ino).not.toBe(start.ino);
    expect(baseSeg, row.after).toContain(`ino ${base.ino}`);
    expect(baseSeg).not.toContain(`ino ${start.ino}`);
    expect(row.before).toMatch(/type file/);
    expect(row.after).toMatch(/type file/);
    expect(row.before).toContain("stage start");
    expect(row.before).toContain(`size ${start.size}`);
  });

  it("R75: size alone, with mtime pinned, is a change", () => {
    const home = join(tmp.dir, "r75-size-home");
    mkdirSync(home);
    const cfg = join(home, ".gitconfig");
    writeFileSync(cfg, "[user]\n\tname = r75-size\n");
    const watch = new MachineConfigWatch([{ scope: "global", path: cfg, source: "test" }]);
    watch.begin("developer");
    const other = join(tmp.dir, "r75-size-other");
    writeFileSync(other, "[user]\n\tname = r75-size-two\n");
    unlinkSync(cfg);
    linkSync(other, cfg);
    utimesSync(cfg, 1_700_000_000, 1_700_000_000);
    watch.compare();
    watch.begin("qa");
    const start = facts(cfg);
    appendFileSync(cfg, "[core]\n\tr75 = size\n");
    utimesSync(cfg, 1_700_000_000, 1_700_000_000);
    const end = facts(cfg);
    const row = watch.compare().find((x) => x.path === cfg);
    expect(end.mtimeNs).toBe(start.mtimeNs);
    expect(end.size).not.toBe(start.size);
    expect(row?.changed).toBe(true);
    expect(row?.before).toContain(`size ${start.size}`);
    expect(row?.after).toContain(`size ${end.size}`);
  });

  it("R75: mtimeNs alone, same size, is a change", () => {
    const home = join(tmp.dir, "r75-mtime-home");
    mkdirSync(home);
    const cfg = join(home, ".gitconfig");
    writeFileSync(cfg, "[user]\n\tname = r75-mtime\n");
    const watch = new MachineConfigWatch([{ scope: "global", path: cfg, source: "test" }]);
    watch.begin("developer");
    const other = join(tmp.dir, "r75-mtime-other");
    const body = "[user]\n\tname = r75-mtime-two\n";
    writeFileSync(other, body);
    unlinkSync(cfg);
    linkSync(other, cfg);
    utimesSync(cfg, 1_700_000_000, 1_700_000_000);
    watch.compare();
    watch.begin("qa");
    const start = facts(cfg);
    writeFileSync(cfg, "X".repeat(statSync(cfg).size));
    utimesSync(cfg, 1_700_000_010, 1_700_000_010);
    const end = facts(cfg);
    const row = watch.compare().find((x) => x.path === cfg);
    expect(end.size).toBe(start.size);
    expect(end.mtimeNs).not.toBe(start.mtimeNs);
    expect(row?.changed).toBe(true);
    expect(row?.before).not.toBe(row?.after);
  });
});
