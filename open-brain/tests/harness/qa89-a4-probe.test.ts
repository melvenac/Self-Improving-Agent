/**
 * QA PROBE, NOT FOR MERGE. Loop 15 slice three, QA record session 89, scoring candidate A4 f9a1aa8.
 *
 * POSIX-only measurements that this seat cannot make on its win32 machine (file symlinks are EPERM there):
 *   A4-1  R49 "whole resolution ... through any link that was there at base": when the FINAL component of a
 *         machine-config path is a link at base (a dotfiles `~/.gitconfig -> dotfiles/gitconfig`, which R35
 *         allows), is the link's TARGET part of the compared resolution? Predicted from configwatch.ts
 *         componentPaths/resolutionMismatch/snap at f9a1aa8: no, so a swapped target is read and hashed.
 *   B3    CA-15 (b)3 in the row's shape: a symlink at a hook ENTRY the snapshot recorded, victim mode 0644.
 *   R29   the mode-000 read run with a link actually planted.
 *   R35   on Linux, the base link is recorded with its type and target.
 * Every observation is also printed (QA89-...) so the CI log carries it whichever way an assertion goes.
 */
import { describe, it, expect, beforeAll, beforeEach, afterEach } from "vitest";
import { createHash } from "node:crypto";
import {
  appendFileSync, chmodSync, linkSync, lstatSync, mkdirSync, readFileSync, renameSync, symlinkSync, unlinkSync,
  writeFileSync, existsSync,
} from "node:fs";
import { join } from "node:path";
import { runLoop, type LoopConfig } from "../../src/harness/runtime.js";
import { StubDeveloper, StubPlanner, StubQa } from "../../src/harness/roles.js";
import { ConfigWatch, MachineConfigWatch, resolveGitDirs } from "../../src/harness/configwatch.js";
import { exitingChecks, makeRepo, requireGit, type RepoFixture } from "./fixture.js";
import { scratch } from "./candidate-a-fixture.js";

const isWin = process.platform === "win32";
const h16 = (b: Buffer | string) => createHash("sha256").update(b).digest("hex").slice(0, 16);
const say = (tag: string, o: unknown) => console.log(`${tag} ${JSON.stringify(o)}`);

describe("QA 89 probe (not for merge): POSIX measurements on A4", { timeout: 120_000 }, () => {
  let repo: RepoFixture;
  let tmp: { dir: string; cleanup: () => Promise<void> };
  beforeAll(() => requireGit());
  beforeEach(() => {
    repo = makeRepo("qa89-probe-");
    tmp = scratch("qa89-probe-out-");
  });
  afterEach(async () => {
    await repo.cleanup();
    await tmp.cleanup();
  });

  /** HOME/.gitconfig -> dot/gitconfig, a file symlink at base. */
  const dotfiles = (name: string) => {
    const home = join(tmp.dir, `${name}-home`);
    const dot = join(tmp.dir, `${name}-dot`);
    mkdirSync(home);
    mkdirSync(dot);
    const target = join(dot, "gitconfig");
    writeFileSync(target, "[user]\n\tname = dotfiles-base\n");
    const cfg = join(home, ".gitconfig");
    symlinkSync(target, cfg);
    expect(lstatSync(cfg).isSymbolicLink(), "plant: the base link is a symlink").toBe(true);
    return { home, dot, target, cfg };
  };

  it.skipIf(isWin)("A4-1 CONTROL: the base link's target edited in place is read, and its hash reaches the record", () => {
    const { target, cfg } = dotfiles("ctl");
    const watch = new MachineConfigWatch([{ scope: "global", path: cfg, source: "qa89" }]);
    watch.begin("developer");
    const edited = "[user]\n\tname = dotfiles-edited-in-place\n";
    writeFileSync(target, edited);
    const found = watch.compare();
    say("QA89-A4-1-CONTROL", { expectHash: h16(edited), found });
    expect(JSON.stringify(found), "the instrument can see a hash through the base link").toContain(h16(edited));
  });

  it.skipIf(isWin)("A4-1 H: the base link's target replaced by a HARD link to an outside file is not read", () => {
    const { target, cfg } = dotfiles("h");
    const watch = new MachineConfigWatch([{ scope: "global", path: cfg, source: "qa89" }]);
    watch.begin("developer");
    const victim = join(tmp.dir, "victim-h");
    writeFileSync(victim, "[user]\n\tname = VICTIM-A4-1-H\n");
    const hv = h16(readFileSync(victim));
    unlinkSync(target);
    linkSync(victim, target);
    expect(lstatSync(target).nlink, "plant: nlink 2").toBe(2);
    const dev = watch.compare();
    watch.begin("qa");
    appendFileSync(victim, "# qa edit\n");
    const hv2 = h16(readFileSync(victim));
    const qa = watch.compare();
    const blob = JSON.stringify([...dev, ...qa]);
    say("QA89-A4-1-H", { hv, hv2, inRecord: { hv: blob.includes(hv), hv2: blob.includes(hv2) }, dev, qa });
    expect(blob, "the outside file's hash is in the record").not.toContain(hv);
    expect(blob, "the outside file's qa-stage hash is in the record").not.toContain(hv2);
  });

  it.skipIf(isWin)("A4-1 J: the base link's target DIRECTORY replaced by a symlink to an outside dir is not read", () => {
    const { dot, cfg } = dotfiles("j");
    const watch = new MachineConfigWatch([{ scope: "global", path: cfg, source: "qa89" }]);
    watch.begin("developer");
    const victim = join(tmp.dir, "victim-j");
    mkdirSync(victim);
    writeFileSync(join(victim, "gitconfig"), "[user]\n\tname = VICTIM-A4-1-J\n");
    const hv = h16(readFileSync(join(victim, "gitconfig")));
    renameSync(dot, `${dot}-aside`);
    symlinkSync(victim, dot);
    expect(lstatSync(dot).isSymbolicLink(), "plant: dot is a symlink").toBe(true);
    const found = watch.compare();
    const blob = JSON.stringify(found);
    say("QA89-A4-1-J", { hv, inRecord: blob.includes(hv), found });
    expect(blob, "the outside file's hash is in the record").not.toContain(hv);
  });

  it.skipIf(isWin)("A4-1 R: the base link's target replaced by a NEW file (rename-over) is not read (R49: final ino)", () => {
    const { target, cfg } = dotfiles("r");
    const watch = new MachineConfigWatch([{ scope: "global", path: cfg, source: "qa89" }]);
    watch.begin("developer");
    const nb = "[user]\n\tname = NEW-FILE-A4-1-R\n";
    writeFileSync(`${target}-new`, nb);
    renameSync(`${target}-new`, target);
    const found = watch.compare();
    const blob = JSON.stringify(found);
    say("QA89-A4-1-R", { hn: h16(nb), inRecord: blob.includes(h16(nb)), found });
    expect(blob).not.toContain(h16(nb));
  });

  it.skipIf(isWin)("A4-1 LOOP: the same H shape through runLoop, with the base link named in the record", async () => {
    const { home, target, cfg } = dotfiles("loop");
    const xdg = join(tmp.dir, "loop-xdg");
    mkdirSync(xdg);
    const system = join(tmp.dir, "loop-system.gitconfig");
    writeFileSync(system, "");
    const env: NodeJS.ProcessEnv = { ...process.env, HOME: home, USERPROFILE: home, XDG_CONFIG_HOME: xdg, GIT_CONFIG_SYSTEM: system };
    delete env.GIT_CONFIG_GLOBAL;
    const victim = join(tmp.dir, "victim-loop");
    writeFileSync(victim, "[user]\n\tname = VICTIM-A4-1-LOOP\n");
    const hv = h16(readFileSync(victim));
    let hv2 = "";
    const cfgLoop: LoopConfig = {
      repoRoot: repo.root, loop: "t001", env,
      roles: {
        planner: new StubPlanner(),
        developer: { role: "developer", run: async (ctx) => { const d = await new StubDeveloper().run(ctx); unlinkSync(target); linkSync(victim, target); return d; } },
        qa: { role: "qa", run: async (ctx) => { appendFileSync(victim, "# qa\n"); hv2 = h16(readFileSync(victim)); return new StubQa().run(ctx); } },
      },
      checks: exitingChecks(0, 0),
      log: () => {},
    };
    const r = await runLoop(cfgLoop);
    const mf = JSON.stringify(r.machineConfigFindings);
    const baseNote = r.findings.filter((f) => f.includes("link at base"));
    say("QA89-A4-1-LOOP", { status: r.status, failure: r.failure?.code ?? null, hv, hv2, inRecord: { hv: mf.includes(hv), hv2: mf.includes(hv2) }, machine: r.machineConfigFindings, baseNote, cfgIsLink: lstatSync(cfg).isSymbolicLink() });
    expect(baseNote.some((f) => f.includes(cfg)), "R46: the base link is named").toBe(true);
    expect(mf, "the outside file's hash is in the record").not.toContain(hv);
    expect(mf).not.toContain(hv2);
  });

  it.skipIf(isWin)("B3 row shape: a symlink at a hook ENTRY the snapshot recorded does not chmod the victim", () => {
    const dirs = resolveGitDirs(repo.root);
    const hooks = join(dirs.commonDir, "hooks");
    mkdirSync(hooks, { recursive: true });
    const hook = join(hooks, "pre-commit");
    writeFileSync(hook, "#!/bin/sh\nexit 0\n");
    chmodSync(hook, 0o755);
    const configMode = lstatSync(join(dirs.commonDir, "config")).mode & 0o777;
    const umask = process.umask();
    // The instrument: a chmod through a link reaches its target on this platform.
    const v0 = join(tmp.dir, "b3-instrument");
    writeFileSync(v0, "i");
    chmodSync(v0, 0o644);
    const l0 = join(tmp.dir, "b3-instrument-link");
    symlinkSync(v0, l0);
    chmodSync(l0, 0o755);
    const instrumentSees = (lstatSync(v0).mode & 0o777) === 0o755;

    const watch = new ConfigWatch(dirs);
    watch.begin("developer");
    const victim = join(tmp.dir, "b3-victim");
    writeFileSync(victim, "B3-VICTIM");
    chmodSync(victim, 0o644);
    renameSync(hook, `${hook}-aside`);
    symlinkSync(victim, hook);
    const planted = lstatSync(hook).isSymbolicLink();
    const v = watch.closeAndRestore();
    const victimMode = lstatSync(victim).mode & 0o777;
    say("QA89-B3", { umask: umask.toString(8), configMode: configMode.toString(8), hookSnapshotMode: "755", instrumentSees, planted, victimMode: victimMode.toString(8), victimBytes: readFileSync(victim, "utf-8"), hookAfterIsLink: lstatSync(hook).isSymbolicLink(), unrestored: v.unrestored });
    expect(instrumentSees).toBe(true);
    expect(planted).toBe(true);
    expect(victimMode).toBe(0o644);
    expect(readFileSync(victim, "utf-8")).toBe("B3-VICTIM");
  });

  it.skipIf(isWin)("R29 row shape: a link planted to a mode-000 victim is not read, and a read attempt would show", () => {
    // Known positive first: a base file made unreadable during the stage is read (the gate allows it) and the
    // failed read surfaces as "unreadable" in the record.
    const home0 = join(tmp.dir, "r29-ctl-home");
    mkdirSync(home0);
    const c0 = join(home0, ".gitconfig");
    writeFileSync(c0, "[user]\n\tname = r29-ctl\n");
    const w0 = new MachineConfigWatch([{ scope: "global", path: c0, source: "qa89" }]);
    w0.begin("developer");
    chmodSync(c0, 0o000);
    let ctlBlob = "";
    try {
      ctlBlob = JSON.stringify(w0.compare());
    } finally {
      chmodSync(c0, 0o644);
    }

    const home = join(tmp.dir, "r29-home");
    mkdirSync(home);
    const cfg = join(home, ".gitconfig");
    writeFileSync(cfg, "[user]\n\tname = r29-base\n");
    const victim = join(tmp.dir, "r29-victim");
    writeFileSync(victim, "[user]\n\tname = R29-SECRET\n");
    chmodSync(victim, 0o000);
    try {
      let code = "";
      try { readFileSync(victim); } catch (err) { code = (err as NodeJS.ErrnoException).code ?? ""; }
      if (code !== "EACCES") throw new Error(`mode 000 direct read did not throw EACCES (code ${code || "none"})`);
      const w = new MachineConfigWatch([{ scope: "global", path: cfg, source: "qa89" }]);
      w.begin("developer");
      unlinkSync(cfg);
      symlinkSync(victim, cfg);
      const planted = lstatSync(cfg).isSymbolicLink();
      const blob = JSON.stringify(w.compare());
      say("QA89-R29", { ctlShowsUnreadable: ctlBlob.includes("unreadable"), ctlBlob, planted, blob });
      expect(ctlBlob, "known positive: a read attempt that fails shows as unreadable").toContain("unreadable");
      expect(planted).toBe(true);
      expect(blob, "a read through the planted link was attempted").not.toContain("unreadable");
    } finally {
      chmodSync(victim, 0o644);
    }
  });

  it.skipIf(isWin)("R35 on Linux: a symlink at $XDG_CONFIG_HOME/git at base proceeds and is recorded with type and target", async () => {
    const home = join(tmp.dir, "r35-home");
    mkdirSync(home);
    const xdg = join(tmp.dir, "r35-xdg");
    mkdirSync(xdg);
    const dot = join(tmp.dir, "r35-dot");
    mkdirSync(dot);
    writeFileSync(join(dot, "config"), "[user]\n\tname = dotfiles\n");
    symlinkSync(dot, join(xdg, "git"));
    const system = join(tmp.dir, "r35-system.gitconfig");
    writeFileSync(system, "");
    const env: NodeJS.ProcessEnv = { ...process.env, HOME: home, USERPROFILE: home, XDG_CONFIG_HOME: xdg, GIT_CONFIG_SYSTEM: system };
    delete env.GIT_CONFIG_GLOBAL;
    const r = await runLoop({ repoRoot: repo.root, loop: "t001", env, roles: { planner: new StubPlanner(), developer: new StubDeveloper(), qa: new StubQa() }, checks: exitingChecks(0, 0), log: () => {} });
    const notes = r.findings.filter((f) => f.includes("link at base"));
    say("QA89-R35", { status: r.status, failure: r.failure?.code ?? null, notes, dotExists: existsSync(dot) });
    expect(r.failure, r.failure?.reason).toBeNull();
    expect(notes.some((f) => f.includes(join(xdg, "git")) && f.includes("symlink") && f.includes(dot))).toBe(true);
  });
});
