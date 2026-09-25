/**
 * QA PROBE, NOT FOR MERGE. Loop 15 slice three, QA record session 108, candidate A10 4b7a5ae (product tree ecf1f62).
 *
 * Shapes of this seat's own, per dispatch item 2 (R77 per helper: identify, listTree, readState, the stop before git;
 * a restore never acts on the OLD path, with hard-link and symlink shapes), item 3 (R82 on win32: junctions and
 * ENOENT resolutions are never machine-config-unobservable), item 4 (R78-R80 texts), and item 6 (QA 99's
 * R71-UNREADABLE-START / -AT-BASE re-scored in R79's form).
 *
 * Every row prints one `Q108-<NAME> {json}` line with what it observed, then asserts what the ruling says.
 * A spawnSync spy counts git subprocesses started after the role returned (`gitAfterRole`): a stop before git
 * (rulings-18 R77.4) must show none.
 */
import { describe, it, expect, vi, beforeAll, beforeEach, afterEach } from "vitest";

const spy = vi.hoisted(() => ({ armed: false, calls: [] as string[] }));
vi.mock("node:child_process", async (importOriginal) => {
  const m = await importOriginal<typeof import("node:child_process")>();
  const spawnSync = ((...a: unknown[]) => {
    if (spy.armed) {
      const args = Array.isArray(a[1]) ? (a[1] as string[]) : [];
      const sub = args.filter((x, i) => !x.startsWith("-") && args[i - 1] !== "-c");
      spy.calls.push(`${String(a[0])} ${sub.slice(0, 3).join(" ")}`);
    }
    return (m.spawnSync as (...x: unknown[]) => unknown)(...a);
  }) as typeof m.spawnSync;
  return { ...m, default: { ...m, spawnSync }, spawnSync };
});

import { createHash } from "node:crypto";
import {
  appendFileSync, chmodSync, existsSync, linkSync, lstatSync, mkdirSync, readdirSync, readFileSync, renameSync,
  rmSync, statSync, symlinkSync, truncateSync, unlinkSync, writeFileSync,
} from "node:fs";
import { join } from "node:path";
import { ConfigWatch, MachineConfigWatch, resolveGitDirs } from "../../src/harness/configwatch.js";
import { runLoop, type LoopConfig, type LoopResult } from "../../src/harness/runtime.js";
import { StubDeveloper, StubPlanner, StubQa } from "../../src/harness/roles.js";
import { exitingChecks, makeRepo, requireGit, type RepoFixture } from "./fixture.js";
import { scratch } from "./candidate-a-fixture.js";

const isWin = process.platform === "win32";
const say = (tag: string, o: unknown) =>
  console.log(`${tag} ${JSON.stringify(o, (_k, v) => (typeof v === "bigint" ? String(v) : v))}`);
const h16 = (b: Buffer | string) => createHash("sha256").update(b).digest("hex").slice(0, 16);
const code = (f: () => unknown): string => {
  try { f(); return "none"; } catch (e) { return (e as NodeJS.ErrnoException).code ?? (e as Error).message; }
};
const modeOf = (p: string) => lstatSync(p).mode & 0o777;
const inoOf = (p: string) => String(lstatSync(p, { bigint: true }).ino);
const PLANT = "[core]\n\tfsmonitor = /nonexistent/q108-monitor\n";

type Run = { r: LoopResult | null; thrown: string; gitAfterRole: string[]; record: string };

/** runLoop with a developer that runs the stub, then `act`; the spy is armed from the role's return. */
async function loopWith(repo: RepoFixture, act: () => void, env?: NodeJS.ProcessEnv): Promise<Run> {
  const loop: LoopConfig = {
    repoRoot: repo.root, loop: "t001", ...(env ? { env } : {}),
    roles: {
      planner: new StubPlanner(),
      developer: { role: "developer", run: async (ctx) => {
        const d = await new StubDeveloper().run(ctx);
        act();
        spy.calls = [];
        spy.armed = true;
        return d;
      } },
      qa: new StubQa(),
    },
    checks: exitingChecks(0, 0),
    log: () => {},
  };
  let r: LoopResult | null = null;
  let thrown = "";
  try { r = await runLoop(loop); } catch (e) { thrown = (e as Error).message; } finally { spy.armed = false; }
  const gitAfterRole = spy.calls.filter((c) => /(^|[\\/ ])git(\.exe)?( |$)/i.test(c) || /^git /.test(c));
  return { r, thrown, gitAfterRole, record: JSON.stringify(r, (_k, v) => (typeof v === "bigint" ? String(v) : v)) };
}

const summary = (x: Run) => ({
  thrown: x.thrown,
  failure: x.r?.failure ? { stage: x.r.failure.stage, code: x.r.failure.code, reason: x.r.failure.reason.slice(0, 700) } : null,
  status: x.r?.status,
  gitAfterRole: x.gitAfterRole.slice(0, 6),
  gitAfterRoleCount: x.gitAfterRole.length,
  verdicts: x.r?.configVerdicts.map((v) => ({
    stage: v.stage, ok: v.ok, changes: v.changes, unrestored: v.unrestored, unlisted: v.unlisted,
    message: v.message.slice(0, 900),
  })),
});

describe("QA 108 probe (not for merge): A10", { timeout: 120_000 }, () => {
  let repo: RepoFixture;
  let tmp: { dir: string; cleanup: () => Promise<void> };
  const undo: string[] = [];
  beforeAll(() => requireGit());
  beforeEach(() => {
    repo = makeRepo("q108-");
    tmp = scratch("q108-out-");
    undo.length = 0;
  });
  afterEach(async () => {
    for (const p of [...undo].reverse()) { try { chmodSync(p, 0o755); } catch { /* gone */ } }
    try { chmodSync(join(repo.root, ".git"), 0o755); } catch { /* already */ }
    try { chmodSync(join(repo.root, ".git", "hooks"), 0o755); } catch { /* already */ }
    await repo.cleanup();
    await tmp.cleanup();
  });

  const gitDir = () => join(repo.root, ".git");
  const cfgPath = () => join(repo.root, ".git", "config");
  const hooksPath = () => join(repo.root, ".git", "hooks");
  const emptyHooks = () => { for (const n of readdirSync(hooksPath())) rmSync(join(hooksPath(), n), { recursive: true, force: true }); };

  // ---------------------------------------------------------------- R77: identify (lstat) --------------------------
  it.skipIf(isWin)("Q108-IDENTIFY-NOSEARCH-KEEP: hooks made readable but not searchable (0600): a kept hook is never 'absent' or 'deleted'", async () => {
    const hooks = hooksPath();
    const keep = join(hooks, "q108-keep");
    writeFileSync(keep, "#!/bin/sh\necho keep\n");
    chmodSync(keep, 0o755);
    const before = readFileSync(cfgPath());
    let lstatCode = "";
    let readdirCode = "";
    undo.push(hooks);
    const x = await loopWith(repo, () => {
      appendFileSync(cfgPath(), PLANT);
      chmodSync(hooks, 0o600);
      lstatCode = code(() => lstatSync(keep));
      readdirCode = code(() => readdirSync(hooks));
    });
    chmodSync(hooks, 0o755);
    const change = x.r?.configVerdicts.flatMap((v) => v.changes).find((c) => c.path === keep) ?? null;
    const cfgRestored = readFileSync(cfgPath()).equals(before);
    say("Q108-IDENTIFY-NOSEARCH-KEEP", { lstatCode, readdirCode, change, cfgRestored, keepStill: existsSync(keep), ...summary(x) });
    expect(lstatCode, "plant: lstat of a name inside fails EACCES").toBe("EACCES");
    expect(readdirCode, "plant: the directory still lists").toBe("none");
    expect(x.thrown, "no exception out of runLoop").toBe("");
    expect(x.r!.failure?.code, "R77: the stage fails stage-changed-config").toBe("stage-changed-config");
    expect(cfgRestored, "CA-4a: .git/config put back by bytes").toBe(true);
    expect(change?.kind ?? "", "R77.5: a contained failure never reads as deleted").not.toBe("deleted");
    expect(change?.after ?? "", "R77.5: a contained failure never reads as absent").not.toBe("absent");
  });

  it.skipIf(isWin)("Q108-IDENTIFY-NOSEARCH-PLANT: an empty hooks dir; the role plants a hook and makes hooks 0600: the stage fails and names it", async () => {
    const hooks = hooksPath();
    emptyHooks();
    const plant = join(hooks, "post-checkout");
    let lstatCode = "";
    undo.push(hooks);
    const x = await loopWith(repo, () => {
      writeFileSync(plant, "#!/bin/sh\necho planted\n");
      chmodSync(plant, 0o755);
      chmodSync(hooks, 0o600);
      lstatCode = code(() => lstatSync(plant));
    });
    chmodSync(hooks, 0o755);
    const plantAfter = existsSync(plant) ? readFileSync(plant, "utf-8") : "(absent)";
    say("Q108-IDENTIFY-NOSEARCH-PLANT", { lstatCode, plantAfter, recordNamesPlant: x.record.includes("post-checkout"), ...summary(x) });
    expect(lstatCode, "plant: lstat EACCES").toBe("EACCES");
    expect(x.thrown).toBe("");
    expect(x.record.includes("post-checkout"), "R77: the failed call is recorded against that path").toBe(true);
    expect(x.r!.failure?.code, "R77: a failed call is a finding that fails the stage").toBe("stage-changed-config");
  });

  it("Q108-IDENTIFY-NOSEARCH-PLANT-CONTROL: the same plant with hooks left searchable is caught and removed", async () => {
    const hooks = hooksPath();
    emptyHooks();
    const plant = join(hooks, "post-checkout");
    const x = await loopWith(repo, () => {
      writeFileSync(plant, "#!/bin/sh\necho planted\n");
      chmodSync(plant, 0o755);
    });
    say("Q108-IDENTIFY-NOSEARCH-PLANT-CONTROL", { plantAfter: existsSync(plant), ...summary(x) });
    expect(x.r!.failure?.code).toBe("stage-changed-config");
    expect(x.record.includes("post-checkout")).toBe(true);
    expect(existsSync(plant), "the planted hook was removed").toBe(false);
  });

  // ---------------------------------------------------------------- R77: listTree (readdir) ------------------------
  it.skipIf(isWin)("Q108-LISTTREE-SUBDIR: a subdirectory of hooks made 0000 after a write inside it: unlisted, unrestorable, stop before git", async () => {
    const sub = join(hooksPath(), "q108-sub");
    mkdirSync(sub);
    const inner = join(sub, "inner");
    writeFileSync(inner, "base\n");
    undo.push(sub);
    const x = await loopWith(repo, () => {
      writeFileSync(inner, "role\n");
      chmodSync(sub, 0o000);
    });
    chmodSync(sub, 0o755);
    const innerAfter = readFileSync(inner, "utf-8");
    say("Q108-LISTTREE-SUBDIR", { innerAfter, ...summary(x) });
    expect(x.thrown).toBe("");
    expect(x.r!.failure?.code).toBe("stage-changed-config");
    expect(x.record).toContain(`unlisted: ${sub} (EACCES)`);
    expect(x.record).toContain("unrestorable: under unlisted");
    expect(innerAfter, "R77.8: no restore write into the unlisted directory").toBe("role\n");
    expect(x.gitAfterRole, "R77.4: no git call after the role").toEqual([]);
  });

  it.skipIf(isWin)("Q108-LISTTREE-EXECONLY: hooks made 0100 (search, no read) after a hook was rewritten: unlisted, stop before git", async () => {
    const hooks = hooksPath();
    const keep = join(hooks, "pre-commit");
    writeFileSync(keep, "#!/bin/sh\nexit 0\n");
    chmodSync(keep, 0o755);
    undo.push(hooks);
    let lstatCode = "";
    const x = await loopWith(repo, () => {
      writeFileSync(keep, "#!/bin/sh\necho role-rewrote\n");
      chmodSync(hooks, 0o100);
      lstatCode = code(() => lstatSync(keep));
    });
    chmodSync(hooks, 0o755);
    const keepAfter = readFileSync(keep, "utf-8");
    say("Q108-LISTTREE-EXECONLY", { lstatCode, keepAfter, ...summary(x) });
    expect(lstatCode, "plant: a known name is still lstat-able (and git could exec it)").toBe("none");
    expect(x.r!.failure?.code).toBe("stage-changed-config");
    expect(x.record).toContain(`unlisted: ${hooks} (EACCES)`);
    expect(x.gitAfterRole, "R77.4: no git call after the role").toEqual([]);
  });

  // ---------------------------------------------------------------- R77: readState (read) ---------------------------
  it("Q108-READSTATE-TOOLARGE: .git/config appended then extended to 3 GiB: recorded with the code, restored, stage fails", async () => {
    const before = readFileSync(cfgPath());
    let readCode = "";
    const x = await loopWith(repo, () => {
      appendFileSync(cfgPath(), PLANT);
      truncateSync(cfgPath(), 3 * 2 ** 30);
      readCode = code(() => readFileSync(cfgPath()));
    });
    const size = statSync(cfgPath()).size;
    const cfgRestored = size < 1e6 && readFileSync(cfgPath()).equals(before);
    say("Q108-READSTATE-TOOLARGE", { readCode, sizeAfter: size, cfgRestored, ...summary(x) });
    expect(readCode, "plant: readFileSync fails with a code other than EACCES").toBe("ERR_FS_FILE_TOO_LARGE");
    expect(x.thrown).toBe("");
    expect(x.record, "R77: recorded with its code").toContain("ERR_FS_FILE_TOO_LARGE");
    expect(x.r!.failure?.code).toBe("stage-changed-config");
    expect(cfgRestored, "restored by bytes").toBe(true);
  });

  it("Q108-READSTATE-TOOLARGE-AT-BEGIN (observation): a 3 GiB .git/config already there when the window opens, untouched", () => {
    const dirs = resolveGitDirs(repo.root);
    appendFileSync(cfgPath(), "\n");
    truncateSync(cfgPath(), 3 * 2 ** 30);
    const watch = new ConfigWatch(dirs, repo.root);
    let thrown = "";
    let v: ReturnType<ConfigWatch["closeAndRestore"]> | null = null;
    try { watch.captureBase(); watch.begin("developer"); v = watch.closeAndRestore(); } catch (e) { thrown = (e as Error).message; }
    say("Q108-READSTATE-TOOLARGE-AT-BEGIN", { thrown, ok: v?.ok, changes: v?.changes, unrestored: v?.unrestored, message: v?.message.slice(0, 600) });
    truncateSync(cfgPath(), 10);
    expect(thrown, "begin and close contain the read").toBe("");
  });

  // ---------------------------------------------------------------- R77.4: the stop before git ---------------------
  it.skipIf(isWin)("Q108-STOP-DOTGIT-RO: config planted, then .git made 0555 so nothing can be put back: stop before git, named", async () => {
    undo.push(gitDir());
    const x = await loopWith(repo, () => {
      appendFileSync(cfgPath(), PLANT);
      chmodSync(gitDir(), 0o555);
    });
    chmodSync(gitDir(), 0o755);
    const planted = readFileSync(cfgPath(), "utf-8").includes("q108-monitor");
    say("Q108-STOP-DOTGIT-RO", { plantedAfter: planted, ...summary(x) });
    expect(x.thrown).toBe("");
    expect(x.r!.failure?.code).toBe("stage-changed-config");
    expect(x.r!.failure?.reason ?? "", "the reason names .git/config").toContain(cfgPath());
    expect(x.r!.failure?.reason ?? "").toContain("Rollback was not performed");
    expect(x.gitAfterRole, "R77.4: no git call after the role").toEqual([]);
  });

  it("Q108-STOP-CONFIG-NONEMPTY-DIR: .git/config replaced by a non-empty directory: stop before git, not removed recursively", async () => {
    const x = await loopWith(repo, () => {
      unlinkSync(cfgPath());
      mkdirSync(cfgPath());
      writeFileSync(join(cfgPath(), "inside"), "x\n");
    });
    const stillDir = lstatSync(cfgPath()).isDirectory() && existsSync(join(cfgPath(), "inside"));
    say("Q108-STOP-CONFIG-NONEMPTY-DIR", { stillDir, ...summary(x) });
    rmSync(cfgPath(), { recursive: true, force: true });
    writeFileSync(cfgPath(), "[core]\n\trepositoryformatversion = 0\n");
    expect(x.thrown).toBe("");
    expect(x.r!.failure?.code).toBe("stage-changed-config");
    expect(x.r!.failure?.reason ?? "").toContain("Rollback was not performed");
    expect(stillDir, "R77.4: no recursive remove").toBe(true);
    expect(x.gitAfterRole, "R77.4: no git call after the role").toEqual([]);
  });

  it("Q108-STOP-HOOK-DIR: a hook replaced by a directory (the developer's R77-UNRESTORED-HOOK shape, on every platform)", async () => {
    const hook = join(hooksPath(), "q108-plant");
    writeFileSync(hook, "#!/bin/sh\n");
    const x = await loopWith(repo, () => { unlinkSync(hook); mkdirSync(hook); });
    say("Q108-STOP-HOOK-DIR", summary(x));
    expect(x.r!.failure?.code).toBe("stage-changed-config");
    expect(x.record).toContain("Rollback was not performed");
    expect(x.gitAfterRole, "R77.4: no git call after the role").toEqual([]);
  });

  // ---------------------------------------------------------------- R77: the OLD path, hard links -------------------
  it("Q108-HARDLINK-CONFIG-RO: .git/config replaced by a hard link to an outside file, then made read-only: the outside file is untouched", async () => {
    const before = readFileSync(cfgPath());
    const victim = join(tmp.dir, "victim");
    writeFileSync(victim, "victim-bytes\n" + PLANT);
    chmodSync(victim, 0o644);
    undo.push(victim);
    let afterRole = { mode: -1, bytes: "", ino: "" };
    const x = await loopWith(repo, () => {
      unlinkSync(cfgPath());
      linkSync(victim, cfgPath());
      chmodSync(cfgPath(), 0o444);
      afterRole = { mode: modeOf(victim), bytes: h16(readFileSync(victim)), ino: inoOf(victim) };
    });
    const now = { mode: modeOf(victim), bytes: h16(readFileSync(victim)), ino: inoOf(victim), nlink: lstatSync(victim).nlink };
    const cfgIno = inoOf(cfgPath());
    const cfgRestored = readFileSync(cfgPath()).equals(before);
    say("Q108-HARDLINK-CONFIG-RO", { afterRole, now, cfgIno, cfgRestored, ...summary(x) });
    expect(x.thrown).toBe("");
    expect(now.mode, "the victim's mode is what the role left").toBe(afterRole.mode);
    expect(now.bytes, "the victim's bytes are what the role left").toBe(afterRole.bytes);
    expect(cfgIno === now.ino, "the watched path is a new file, not the victim").toBe(false);
    expect(cfgRestored, "the config bytes are the original").toBe(true);
    expect(x.r!.failure?.code).toBe("stage-changed-config");
  });

  it.skipIf(isWin)("Q108-HARDLINK-CONFIG-000: .git/config replaced by a hard link to an outside file, then mode 000", async () => {
    const before = readFileSync(cfgPath());
    const victim = join(tmp.dir, "victim0");
    writeFileSync(victim, "victim0-bytes\n");
    chmodSync(victim, 0o640);
    undo.push(victim);
    let afterRole = { mode: -1, ino: "" };
    let afterBytes = "";
    const x = await loopWith(repo, () => {
      afterBytes = h16(readFileSync(victim));
      unlinkSync(cfgPath());
      linkSync(victim, cfgPath());
      chmodSync(cfgPath(), 0o000);
      afterRole = { mode: modeOf(victim), ino: inoOf(victim) };
    });
    const nowMode = modeOf(victim);
    chmodSync(victim, 0o640);
    const nowBytes = h16(readFileSync(victim));
    const cfgRestored = readFileSync(cfgPath()).equals(before);
    say("Q108-HARDLINK-CONFIG-000", { afterRole, nowMode, afterBytes, nowBytes, cfgRestored, ...summary(x) });
    expect(nowMode, "the victim's mode is what the role left (000)").toBe(afterRole.mode);
    expect(nowBytes).toBe(afterBytes);
    expect(cfgRestored).toBe(true);
    expect(x.r!.failure?.code).toBe("stage-changed-config");
  });

  it("Q108-HARDLINK-NEWHOOK: a new hook that is a hard link to an outside file: removed, the outside file untouched", async () => {
    const victim = join(tmp.dir, "victim-hook");
    writeFileSync(victim, "#!/bin/sh\necho victim\n");
    chmodSync(victim, 0o755);
    const hook = join(hooksPath(), "post-checkout");
    let afterRole = { mode: -1, bytes: "" };
    const x = await loopWith(repo, () => {
      linkSync(victim, hook);
      chmodSync(hook, 0o555);
      afterRole = { mode: modeOf(victim), bytes: h16(readFileSync(victim)) };
    });
    undo.push(victim);
    const now = { mode: modeOf(victim), bytes: h16(readFileSync(victim)), nlink: lstatSync(victim).nlink };
    say("Q108-HARDLINK-NEWHOOK", { afterRole, now, hookAfter: existsSync(hook), ...summary(x) });
    expect(now.mode).toBe(afterRole.mode);
    expect(now.bytes).toBe(afterRole.bytes);
    expect(existsSync(hook), "the planted link is gone").toBe(false);
    expect(x.r!.failure?.code).toBe("stage-changed-config");
  });

  // ---------------------------------------------------------------- R77: the OLD path, symlinks ---------------------
  it("Q108-SYMLINK-CONFIG: .git/config replaced by a file symlink to a read-only outside file: the outside file is untouched", async () => {
    const before = readFileSync(cfgPath());
    const victim = join(tmp.dir, "victim-link");
    writeFileSync(victim, "victim-link-bytes\n" + PLANT);
    chmodSync(victim, 0o444);
    undo.push(victim);
    const pre = { mode: modeOf(victim), bytes: h16(readFileSync(victim)), ino: inoOf(victim) };
    const x = await loopWith(repo, () => { unlinkSync(cfgPath()); symlinkSync(victim, cfgPath(), "file"); });
    const now = { mode: modeOf(victim), bytes: h16(readFileSync(victim)), ino: inoOf(victim) };
    const cfgKind = lstatSync(cfgPath()).isSymbolicLink() ? "symlink" : lstatSync(cfgPath()).isFile() ? "file" : "other";
    const cfgRestored = cfgKind === "file" && readFileSync(cfgPath()).equals(before);
    say("Q108-SYMLINK-CONFIG", { pre, now, cfgKind, cfgRestored, ...summary(x) });
    expect(now, "the victim is untouched").toEqual(pre);
    expect(cfgRestored, "a regular file with the original bytes").toBe(true);
    expect(x.r!.failure?.code).toBe("stage-changed-config");
  });

  it("Q108-SYMLINK-CONFIG-DANGLING: .git/config replaced by a dangling symlink to an outside name: the restore never creates it", async () => {
    const before = readFileSync(cfgPath());
    const target = join(tmp.dir, "made-by-restore-cfg");
    const x = await loopWith(repo, () => { unlinkSync(cfgPath()); symlinkSync(target, cfgPath(), "file"); });
    const created = existsSync(target);
    const cfgRestored = !lstatSync(cfgPath()).isSymbolicLink() && readFileSync(cfgPath()).equals(before);
    say("Q108-SYMLINK-CONFIG-DANGLING", { created, cfgRestored, ...summary(x) });
    expect(created, "the outside target was never created").toBe(false);
    expect(cfgRestored).toBe(true);
    expect(x.r!.failure?.code).toBe("stage-changed-config");
  });

  it("Q108-SYMLINK-HOOK-DANGLING: a hook replaced by a dangling symlink to an outside name: never created, hook restored", async () => {
    const hook = join(hooksPath(), "q108-keep");
    writeFileSync(hook, "#!/bin/sh\necho keep\n");
    const target = join(tmp.dir, "made-by-restore-hook");
    const x = await loopWith(repo, () => { unlinkSync(hook); symlinkSync(target, hook, "file"); });
    const created = existsSync(target);
    const restored = !lstatSync(hook).isSymbolicLink() && readFileSync(hook, "utf-8") === "#!/bin/sh\necho keep\n";
    say("Q108-SYMLINK-HOOK-DANGLING", { created, restored, ...summary(x) });
    expect(created).toBe(false);
    expect(restored).toBe(true);
    expect(x.r!.failure?.code).toBe("stage-changed-config");
  });

  it("Q108-DIRLINK-HOOK: a hook replaced by a directory link (junction on win32) to an outside directory: outside untouched", async () => {
    const hook = join(hooksPath(), "q108-keep");
    writeFileSync(hook, "#!/bin/sh\necho keep\n");
    const outside = join(tmp.dir, "outside-dir");
    mkdirSync(outside);
    writeFileSync(join(outside, "inner"), "inner-bytes\n");
    const x = await loopWith(repo, () => { unlinkSync(hook); symlinkSync(outside, hook, isWin ? "junction" : "dir"); });
    const outsideOk = existsSync(join(outside, "inner")) && readFileSync(join(outside, "inner"), "utf-8") === "inner-bytes\n";
    const restored = !lstatSync(hook).isSymbolicLink() && lstatSync(hook).isFile() && readFileSync(hook, "utf-8") === "#!/bin/sh\necho keep\n";
    say("Q108-DIRLINK-HOOK", { outsideOk, outsideList: readdirSync(outside), restored, ...summary(x) });
    expect(outsideOk).toBe(true);
    expect(readdirSync(outside)).toEqual(["inner"]);
    expect(restored).toBe(true);
    expect(x.r!.failure?.code).toBe("stage-changed-config");
  });

  // ---------------------------------------------------------------- R82: machine side --------------------------------
  const machineEnv = (name: string) => {
    const h = join(tmp.dir, `${name}-home`);
    mkdirSync(h);
    const xdg = join(tmp.dir, `${name}-xdg`);
    mkdirSync(xdg);
    const system = join(tmp.dir, `${name}-system.gitconfig`);
    writeFileSync(system, "");
    const env: NodeJS.ProcessEnv = { ...process.env, HOME: h, USERPROFILE: h, XDG_CONFIG_HOME: xdg, GIT_CONFIG_SYSTEM: system };
    delete env.GIT_CONFIG_GLOBAL;
    return { h, xdg, env, global: join(h, ".gitconfig"), xdgCfg: join(xdg, "git", "config") };
  };
  const one = (path: string) => new MachineConfigWatch([{ scope: "global", path, source: "q108" }]);

  it.skipIf(isWin)("Q108-R82-ABSENT-THEN-EACCES (unit): absent at the stage start (observed), written and hidden by the role: unobservable", () => {
    const h = join(tmp.dir, "aea");
    mkdirSync(h);
    const cfg = join(h, ".gitconfig");
    const watch = one(cfg);
    watch.captureBase();
    watch.begin("developer");
    writeFileSync(cfg, PLANT);
    chmodSync(h, 0o000);
    undo.push(h);
    const lstatCode = code(() => lstatSync(cfg));
    let row: ReturnType<MachineConfigWatch["compare"]>[number] | undefined;
    try { row = watch.compare().find((f) => f.path === cfg); } finally { chmodSync(h, 0o755); }
    say("Q108-R82-ABSENT-THEN-EACCES", { lstatCode, row });
    expect(lstatCode).toBe("EACCES");
    expect(row?.unobservableCode, "R82: observable at the start (absent), unobservable at close").toBe("EACCES");
  });

  it.skipIf(isWin)("Q108-R82-ABSENT-THEN-EACCES-LOOP: the same through runLoop, on the XDG path", async () => {
    const m = machineEnv("aeal");
    undo.push(m.xdg);
    const x = await loopWith(repo, () => {
      mkdirSync(join(m.xdg, "git"));
      writeFileSync(m.xdgCfg, PLANT);
      chmodSync(m.xdg, 0o000);
    }, m.env);
    chmodSync(m.xdg, 0o755);
    const rows = x.r?.machineConfigFindings.filter((f) => f.path === m.xdgCfg) ?? [];
    say("Q108-R82-ABSENT-THEN-EACCES-LOOP", { rows, ...summary(x) });
    expect(x.r!.failure?.code, "R82: the runtime could not see it, so the stage fails").toBe("machine-config-unobservable");
  });

  it.skipIf(isWin)("Q108-R82-NOTAFILE-THEN-EACCES (unit): a directory at ~/.gitconfig (deliberate not-read) then HOME 000", () => {
    const h = join(tmp.dir, "naf");
    mkdirSync(h);
    const cfg = join(h, ".gitconfig");
    mkdirSync(cfg);
    const watch = one(cfg);
    watch.captureBase();
    watch.begin("developer");
    chmodSync(h, 0o000);
    undo.push(h);
    let row: ReturnType<MachineConfigWatch["compare"]>[number] | undefined;
    try { row = watch.compare().find((f) => f.path === cfg); } finally { chmodSync(h, 0o755); }
    say("Q108-R82-NOTAFILE-THEN-EACCES", { row });
    expect(row?.unobservableCode, "R82: a deliberate not-read is an observation; then unobservable").toBe("EACCES");
  });

  it.skipIf(isWin)("Q108-R82-TWONAME-THEN-EACCES (unit): a two-name file at the stage start (not read) then HOME 000", () => {
    const h = join(tmp.dir, "tn");
    mkdirSync(h);
    const cfg = join(h, ".gitconfig");
    writeFileSync(cfg, "[user]\n\tname = tn\n");
    const watch = one(cfg);
    watch.captureBase();
    watch.begin("planner");
    writeFileSync(`${cfg}.new`, "[user]\n\tname = tn2\n");
    renameSync(`${cfg}.new`, cfg);
    linkSync(cfg, join(tmp.dir, "tn-second"));
    watch.compare();
    watch.begin("developer");
    chmodSync(h, 0o000);
    undo.push(h);
    let rows: ReturnType<MachineConfigWatch["compare"]> = [];
    try { rows = watch.compare(); } finally { chmodSync(h, 0o755); }
    const row = rows.find((f) => f.path === cfg);
    say("Q108-R82-TWONAME-THEN-EACCES", { row });
    expect(row?.unobservableCode, "R82").toBe("EACCES");
  });

  it.skipIf(isWin)("Q108-R82-UNREADABLE-AT-START-CONTROL (unit): already unreadable at the stage start: environment, changed false, no code", () => {
    const h = join(tmp.dir, "uas");
    mkdirSync(h);
    const cfg = join(h, ".gitconfig");
    writeFileSync(cfg, "[user]\n\tname = uas\n");
    const watch = one(cfg);
    watch.captureBase();
    chmodSync(cfg, 0o000);
    undo.push(cfg);
    let row: ReturnType<MachineConfigWatch["compare"]>[number] | undefined;
    try { watch.begin("developer"); row = watch.compare().find((f) => f.path === cfg); } finally { chmodSync(cfg, 0o644); }
    say("Q108-R82-UNREADABLE-AT-START-CONTROL", { row });
    expect(row?.changed).toBe(false);
    expect(row?.unobservableCode ?? null).toBe(null);
  });

  it.skipIf(isWin)("Q108-R82-READ-THEN-FILE000 (unit, observation): read at the start, the file itself made 000", () => {
    const h = join(tmp.dir, "rtf");
    mkdirSync(h);
    const cfg = join(h, ".gitconfig");
    writeFileSync(cfg, "[user]\n\tname = rtf\n");
    const watch = one(cfg);
    watch.captureBase();
    watch.begin("developer");
    chmodSync(cfg, 0o000);
    undo.push(cfg);
    let row: ReturnType<MachineConfigWatch["compare"]>[number] | undefined;
    try { row = watch.compare().find((f) => f.path === cfg); } finally { chmodSync(cfg, 0o644); }
    say("Q108-R82-READ-THEN-FILE000", { row });
    expect(row).toBeTruthy();
  });

  it("Q108-R82-ELOOP (unit, observation): read at the start, replaced by a symlink loop", () => {
    const h = join(tmp.dir, "eloop");
    mkdirSync(h);
    const cfg = join(h, ".gitconfig");
    writeFileSync(cfg, "[user]\n\tname = eloop\n");
    const watch = one(cfg);
    watch.captureBase();
    watch.begin("developer");
    unlinkSync(cfg);
    symlinkSync(join(h, "loop-b"), cfg, "file");
    symlinkSync(cfg, join(h, "loop-b"), "file");
    const realCode = code(() => statSync(cfg));
    const row = watch.compare().find((f) => f.path === cfg);
    say("Q108-R82-ELOOP", { realCode, row });
    expect(realCode).toBe("ELOOP");
    expect(row?.unobservableCode, "R82 lists ELOOP among the codes meaning 'could not see'").toBe("ELOOP");
  });

  // win32-first (R82 made precise at turn 107; tcm cannot run a junction). They run on Linux too, with dir symlinks.
  it("Q108-R82-XDG-JUNCTION-EMPTY: XDG git dir (read config) replaced by a junction to an empty dir: ENOENT is absence, never unobservable", async () => {
    const m = machineEnv("xje");
    mkdirSync(join(m.xdg, "git"));
    writeFileSync(m.xdgCfg, "[user]\n\tname = xje\n");
    const empty = join(tmp.dir, "xje-empty");
    mkdirSync(empty);
    const x = await loopWith(repo, () => {
      renameSync(join(m.xdg, "git"), join(m.xdg, "git-old"));
      symlinkSync(empty, join(m.xdg, "git"), isWin ? "junction" : "dir");
    }, m.env);
    const rows = x.r?.machineConfigFindings.filter((f) => f.path === m.xdgCfg && f.stage === "developer") ?? [];
    say("Q108-R82-XDG-JUNCTION-EMPTY", { rows, ...summary(x) });
    expect(x.thrown).toBe("");
    expect(x.r!.failure?.code ?? "none").not.toBe("machine-config-unobservable");
    expect(rows.some((r) => r.changed), "a visible change is reported").toBe(true);
  });

  it("Q108-R82-XDG-DANGLING-JUNCTION: XDG git dir replaced by a junction to a directory that does not exist", async () => {
    const m = machineEnv("xdj");
    mkdirSync(join(m.xdg, "git"));
    writeFileSync(m.xdgCfg, "[user]\n\tname = xdj\n");
    const gone = join(tmp.dir, "xdj-gone");
    const x = await loopWith(repo, () => {
      renameSync(join(m.xdg, "git"), join(m.xdg, "git-old"));
      mkdirSync(gone);
      symlinkSync(gone, join(m.xdg, "git"), isWin ? "junction" : "dir");
      rmSync(gone, { recursive: true });
    }, m.env);
    const rows = x.r?.machineConfigFindings.filter((f) => f.path === m.xdgCfg && f.stage === "developer") ?? [];
    say("Q108-R82-XDG-DANGLING-JUNCTION", { rows, ...summary(x) });
    expect(x.thrown).toBe("");
    expect(x.r!.failure?.code ?? "none").not.toBe("machine-config-unobservable");
  });

  it("Q108-R82-HOME-RENAMED: HOME renamed away (the read ~/.gitconfig resolves ENOENT)", async () => {
    const m = machineEnv("hr");
    writeFileSync(m.global, "[user]\n\tname = hr\n");
    const x = await loopWith(repo, () => { renameSync(m.h, `${m.h}-away`); }, m.env);
    try { renameSync(`${m.h}-away`, m.h); } catch { /* already */ }
    const rows = x.r?.machineConfigFindings.filter((f) => f.path === m.global && f.stage === "developer") ?? [];
    say("Q108-R82-HOME-RENAMED", { rows, ...summary(x) });
    expect(x.thrown).toBe("");
    expect(x.r!.failure?.code ?? "none").not.toBe("machine-config-unobservable");
    expect(x.record).toContain("absent (ENOENT)");
  });

  it("Q108-R82-PARENT-IS-FILE: XDG git dir replaced by a regular file (ENOTDIR on POSIX)", async () => {
    const m = machineEnv("pif");
    mkdirSync(join(m.xdg, "git"));
    writeFileSync(m.xdgCfg, "[user]\n\tname = pif\n");
    let lcode = "";
    const x = await loopWith(repo, () => {
      renameSync(join(m.xdg, "git"), join(m.xdg, "git-old"));
      writeFileSync(join(m.xdg, "git"), "not a dir\n");
      lcode = code(() => lstatSync(m.xdgCfg));
    }, m.env);
    const rows = x.r?.machineConfigFindings.filter((f) => f.path === m.xdgCfg && f.stage === "developer") ?? [];
    say("Q108-R82-PARENT-IS-FILE", { lcode, rows, ...summary(x) });
    expect(x.thrown).toBe("");
    expect(x.r!.failure?.code ?? "none").not.toBe("machine-config-unobservable");
  });

  // ---------------------------------------------------------------- R80: link facts (win32 can make file links) -----
  it("Q108-R80-TYPECHANGE-FACTS: the developer's shape, on every platform: the link's lstat facts and the labelled resolved facts", () => {
    const h = join(tmp.dir, "tc");
    mkdirSync(h);
    const cfg = join(h, ".gitconfig");
    writeFileSync(cfg, "[user]\n\tname = tc\n");
    const watch = one(cfg);
    watch.captureBase();
    watch.begin("developer");
    const elsewhere = join(h, "elsewhere");
    writeFileSync(elsewhere, "[user]\n\tname = else\n");
    unlinkSync(cfg);
    symlinkSync(elsewhere, cfg, "file");
    const row = watch.compare().find((f) => f.path === cfg)!;
    const link = lstatSync(cfg, { bigint: true });
    const target = statSync(elsewhere, { bigint: true });
    say("Q108-R80-TYPECHANGE-FACTS", { row, linkIno: String(link.ino), targetIno: String(target.ino) });
    expect(row.after).toContain("type change");
    expect(row.after).toMatch(new RegExp(`link: type symlink dev \\d+ ino ${link.ino} nlink \\d+ size \\d+ mtimeNs \\d+ readlink `));
    expect(row.after).toContain(`readlink ${elsewhere}`);
    expect(row.after).toMatch(new RegExp(`resolves to: type file dev \\d+ ino ${target.ino} `));
    expect(row.before, "the read side: hash and facts").toMatch(/^[0-9a-f]{16} type file dev \d+ ino \d+ nlink 1 size \d+ mtimeNs \d+$/);
  });

  it("Q108-R80-ABSENT-SYMLINK-FACTS: the developer's shape, on every platform", () => {
    const h = join(tmp.dir, "as");
    mkdirSync(h);
    const cfg = join(h, ".gitconfig");
    const watch = one(cfg);
    watch.captureBase();
    watch.begin("developer");
    const elsewhere = join(h, "elsewhere");
    writeFileSync(elsewhere, "[user]\n\tname = else\n");
    symlinkSync(elsewhere, cfg, "file");
    const row = watch.compare().find((f) => f.path === cfg)!;
    const link = lstatSync(cfg, { bigint: true });
    const target = statSync(elsewhere, { bigint: true });
    say("Q108-R80-ABSENT-SYMLINK-FACTS", { row });
    expect(row.before).toBe("absent (ENOENT)");
    expect(row.after).toContain("absent → symlink");
    expect(row.after).toMatch(new RegExp(`link: type symlink dev \\d+ ino ${link.ino} `));
    expect(row.after).toMatch(new RegExp(`resolves to: type file dev \\d+ ino ${target.ino} `));
  });

  it("Q108-R80-TYPECHANGE-DANGLING: read at the start, replaced by a dangling symlink: link facts, 'does not resolve (ENOENT)'", () => {
    const h = join(tmp.dir, "tcd");
    mkdirSync(h);
    const cfg = join(h, ".gitconfig");
    writeFileSync(cfg, "[user]\n\tname = tcd\n");
    const watch = one(cfg);
    watch.captureBase();
    watch.begin("developer");
    unlinkSync(cfg);
    symlinkSync(join(h, "nowhere"), cfg, "file");
    const row = watch.compare().find((f) => f.path === cfg)!;
    const link = lstatSync(cfg, { bigint: true });
    say("Q108-R80-TYPECHANGE-DANGLING", { row, linkIno: String(link.ino) });
    expect(row.changed).toBe(true);
    expect(row.after).toContain(`ino ${link.ino}`);
    expect(row.after).toContain("does not resolve (ENOENT)");
    expect(row.unobservableCode ?? null, "ENOENT is absence").toBe(null);
  });

  it("Q108-R80-ANCESTOR-JUNCTION-TEXT (observation, dispatch item 4): the XDG git dir replaced by a junction to a dir with a config", () => {
    const xdg = join(tmp.dir, "aj-xdg");
    mkdirSync(join(xdg, "git"), { recursive: true });
    const cfg = join(xdg, "git", "config");
    writeFileSync(cfg, "[user]\n\tname = aj\n");
    const watch = new MachineConfigWatch([{ scope: "xdg", path: cfg, source: "q108" }]);
    watch.captureBase();
    watch.begin("developer");
    const other = join(tmp.dir, "aj-other");
    mkdirSync(other);
    writeFileSync(join(other, "config"), "[user]\n\tname = aj-other\n");
    renameSync(join(xdg, "git"), join(xdg, "git-old"));
    symlinkSync(other, join(xdg, "git"), isWin ? "junction" : "dir");
    const row = watch.compare().find((f) => f.path === cfg)!;
    const linkIno = String(lstatSync(join(xdg, "git"), { bigint: true }).ino);
    const targetIno = String(statSync(join(other, "config"), { bigint: true }).ino);
    say("Q108-R80-ANCESTOR-JUNCTION-TEXT", { row, linkIno, targetIno, hasLinkIno: row.after.includes(`ino ${linkIno}`), hasTargetIno: row.after.includes(`ino ${targetIno}`), hasLinkLabel: row.after.includes("link: type symlink") });
    expect(row.changed).toBe(true);
    expect(row.after).toContain("type change");
  });

  it("Q108-R79-ANCESTOR-ZEROED: XDG git absent at the loop base; the role plants a junction to an empty dir: no zeroed facts, the code named", () => {
    const xdg = join(tmp.dir, "az-xdg");
    mkdirSync(xdg);
    const cfg = join(xdg, "git", "config");
    const watch = new MachineConfigWatch([{ scope: "xdg", path: cfg, source: "q108" }]);
    watch.captureBase();
    watch.begin("developer");
    const empty = join(tmp.dir, "az-empty");
    mkdirSync(empty);
    symlinkSync(empty, join(xdg, "git"), isWin ? "junction" : "dir");
    const row = watch.compare().find((f) => f.path === cfg)!;
    say("Q108-R79-ANCESTOR-ZEROED", { row });
    expect(row.changed).toBe(true);
    expect(row.after, "R79: a placeholder never pretends to be facts").not.toContain("dev null");
    expect(row.after, "R79: absent carries the resolution error").toContain("ENOENT");
  });

  it("Q108-R79-ANCESTOR-TYPECHANGE-ZEROED: the XDG git dir (read config) replaced by a junction to an empty dir: no zeroed current side", () => {
    const xdg = join(tmp.dir, "atz-xdg");
    mkdirSync(join(xdg, "git"), { recursive: true });
    const cfg = join(xdg, "git", "config");
    writeFileSync(cfg, "[user]\n\tname = atz\n");
    const watch = new MachineConfigWatch([{ scope: "xdg", path: cfg, source: "q108" }]);
    watch.captureBase();
    watch.begin("developer");
    const empty = join(tmp.dir, "atz-empty");
    mkdirSync(empty);
    renameSync(join(xdg, "git"), join(xdg, "git-old"));
    symlinkSync(empty, join(xdg, "git"), isWin ? "junction" : "dir");
    const row = watch.compare().find((f) => f.path === cfg)!;
    say("Q108-R79-ANCESTOR-TYPECHANGE-ZEROED", { row });
    expect(row.changed).toBe(true);
    expect(row.after, "R79: a placeholder never pretends to be facts").not.toContain("dev null");
  });

  it("Q108-R79-ELOOP-ALONE: read at the start, a symlink loop at close: the unobservable side still carries the link's lstat facts", () => {
    const h = join(tmp.dir, "ela");
    mkdirSync(h);
    const cfg = join(h, ".gitconfig");
    writeFileSync(cfg, "[user]\n\tname = ela\n");
    const watch = one(cfg);
    watch.captureBase();
    watch.begin("developer");
    unlinkSync(cfg);
    symlinkSync(join(h, "loop-b"), cfg, "file");
    symlinkSync(cfg, join(h, "loop-b"), "file");
    const linkIno = inoOf(cfg);
    const row = watch.compare().find((f) => f.path === cfg)!;
    say("Q108-R79-ELOOP-ALONE", { row, linkIno });
    expect(row.unobservableCode).toBe("ELOOP");
    expect(row.after, "R79: a placeholder is never alone for a side that has facts (lstat saw the link)").toContain(`ino ${linkIno}`);
  });

  it.skipIf(isWin)("Q108-R79-FILE000-ALONE: read at the start, the file made 000: the unobservable side still carries its lstat facts", () => {
    const h = join(tmp.dir, "f0a");
    mkdirSync(h);
    const cfg = join(h, ".gitconfig");
    writeFileSync(cfg, "[user]\n\tname = f0a\n");
    const watch = one(cfg);
    watch.captureBase();
    watch.begin("developer");
    appendFileSync(cfg, "[core]\n\tx = 1\n");
    chmodSync(cfg, 0o000);
    undo.push(cfg);
    const ino = inoOf(cfg);
    let row: ReturnType<MachineConfigWatch["compare"]>[number] | undefined;
    try { row = watch.compare().find((f) => f.path === cfg); } finally { chmodSync(cfg, 0o644); }
    say("Q108-R79-FILE000-ALONE", { row, ino });
    expect(row?.unobservableCode).toBe("EACCES");
    expect(row?.after ?? "", "R79: lstat succeeded, so the side has facts").toContain(`ino ${ino}`);
  });

  it.skipIf(isWin)("Q108-FIFO-CONFIG (observation): .git/config replaced by a FIFO: what the record says, and whether it is restored", async () => {
    const before = readFileSync(cfgPath());
    const { execFileSync } = await import("node:child_process");
    const x = await loopWith(repo, () => {
      unlinkSync(cfgPath());
      execFileSync("mkfifo", [cfgPath()]);
    });
    const kind = lstatSync(cfgPath()).isFIFO() ? "fifo" : lstatSync(cfgPath()).isFile() ? "file" : "other";
    const restored = kind === "file" && readFileSync(cfgPath()).equals(before);
    const change = x.r?.configVerdicts.flatMap((v) => v.changes).find((c) => c.path === cfgPath()) ?? null;
    say("Q108-FIFO-CONFIG", { kind, restored, change, ...summary(x) });
    if (kind === "fifo") { unlinkSync(cfgPath()); writeFileSync(cfgPath(), before); }
    expect(x.thrown).toBe("");
  });

  it("Q108-R61-WIN: R61's shape on every platform (a dangling link): not claimed as read, by the old and the new detector", () => {
    const h = join(tmp.dir, "r61");
    mkdirSync(h);
    const cfg = join(h, ".gitconfig");
    symlinkSync("missing-q108-target", cfg, "file");
    const watch = one(cfg);
    watch.begin("developer");
    const blob = JSON.stringify(watch.compare());
    const oldHits = blob.match(/[0-9a-f]{16,}/g) ?? [];
    const nonDecimal = oldHits.filter((s) => /[a-f]/.test(s));
    say("Q108-R61-WIN", { blob, oldHits, nonDecimal });
    expect(blob, "the new detector: no side opens with a hash").not.toMatch(/"(before|after)":"[0-9a-f]{16}/);
    expect(nonDecimal, "every 16-hex run the old detector would match is a decimal fact, not a hash").toEqual([]);
    expect(blob).toContain("ino");
  });

  // ---------------------------------------------------------------- R79: QA 99's rows in R79's form ------------------
  it.skipIf(isWin)("Q108-R71-UNREADABLE-START-R79: QA 99's shape; before is 'unreadable; stage start <facts>', never absent", () => {
    const h = join(tmp.dir, "uls");
    mkdirSync(h);
    const cfg = join(h, ".gitconfig");
    writeFileSync(cfg, "[user]\n\tname = uls-base\n");
    const watch = one(cfg);
    watch.captureBase();
    watch.begin("developer");
    chmodSync(cfg, 0o000);
    undo.push(cfg);
    watch.compare();
    const start = { ino: inoOf(cfg), size: String(lstatSync(cfg).size) };
    watch.begin("qa");
    chmodSync(cfg, 0o644);
    writeFileSync(cfg, "[user]\n\tname = uls-qa\n");
    const q = watch.compare().find((x) => x.path === cfg)!;
    say("Q108-R71-UNREADABLE-START-R79", { start, q });
    expect(q.before).toMatch(/^unreadable; stage start type file dev \d+ ino \d+ nlink 1 size \d+ mtimeNs \d+$/);
    expect(q.before).toContain(`ino ${start.ino} nlink 1 size ${start.size} `);
    expect(q.before).not.toContain("absent");
    expect(q.changed).toBe(true);
  });

  it.skipIf(isWin)("Q108-R71-UNREADABLE-AT-BASE-R79: QA 99's shape; mode 000 at base, edited in developer: 'unreadable; stage start <facts>'", () => {
    const h = join(tmp.dir, "uab");
    mkdirSync(h);
    const cfg = join(h, ".gitconfig");
    writeFileSync(cfg, "[user]\n\tname = uab-base\n");
    chmodSync(cfg, 0o000);
    undo.push(cfg);
    const start = { ino: inoOf(cfg), size: String(lstatSync(cfg).size) };
    const watch = one(cfg);
    watch.captureBase();
    watch.begin("developer");
    chmodSync(cfg, 0o644);
    writeFileSync(cfg, "[user]\n\tname = uab-dev\n");
    const d = watch.compare().find((x) => x.path === cfg)!;
    say("Q108-R71-UNREADABLE-AT-BASE-R79", { start, d });
    expect(d.before).toMatch(/^unreadable; stage start type file /);
    expect(d.before).toContain(`ino ${start.ino} nlink 1 size ${start.size} `);
    expect(d.before).not.toContain("absent");
  });

  // ---------------------------------------------------------------- R77 + R82 together (observation) ---------------
  it.skipIf(isWin)("Q108-BOTH (observation): the role plants config, makes hooks 000 AND HOME 000: which code, and does the reason name both", async () => {
    const m = machineEnv("both");
    writeFileSync(m.global, "[user]\n\tname = both\n");
    const before = readFileSync(cfgPath());
    undo.push(hooksPath(), m.h);
    const x = await loopWith(repo, () => {
      appendFileSync(cfgPath(), PLANT);
      chmodSync(hooksPath(), 0o000);
      chmodSync(m.h, 0o000);
    }, m.env);
    chmodSync(hooksPath(), 0o755);
    chmodSync(m.h, 0o755);
    const cfgRestored = readFileSync(cfgPath()).equals(before);
    say("Q108-BOTH", { cfgRestored, reasonNamesHooks: (x.r?.failure?.reason ?? "").includes(hooksPath()), ...summary(x) });
    expect(x.thrown).toBe("");
    expect(x.gitAfterRole).toEqual([]);
  });
});
