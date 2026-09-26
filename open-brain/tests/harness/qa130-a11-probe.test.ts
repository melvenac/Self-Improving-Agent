/**
 * QA PROBE, NOT FOR MERGE. Loop 15 slice three, QA record session 130, candidate A11 bbf9d07 (product tree ef2a8a7).
 *
 * Shapes of this seat's own for rulings-19 R83-R88 and R85b, beside QA 108's probes (re-run byte-exact):
 * - R83/R88: a hooks dir already unsearchable when the loop opens; .git itself unsearchable after a plant; a nested
 *   unsearchable dir; the :227 answer (a tree whose lstat fails is refused at begin); a directory at .git/config.
 * - R84: a dangling link at the stage start (observed), then HOME 000.
 * - R85/R85b: a link above the path (the XDG git dir) when the file or the link's target cannot be seen; a link at
 *   the path whose target dir cannot be searched; the repository side's text for an lstat failure.
 * - R86: an ancestor junction on every platform, and an ancestor link planted where the loop base was absent.
 * - R88: a read failure other than EACCES at the open (a 3 GiB hook), and a deliberate not-read at the open.
 *
 * Every row prints one `Q130-<NAME> {json}` line with what it observed, then asserts what the ruling says.
 * A spawnSync spy counts git subprocesses started after the role returned (QA 108's `gitAfterRole`).
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

import {
  appendFileSync, chmodSync, existsSync, lstatSync, mkdirSync, readdirSync, readFileSync, renameSync, rmSync,
  statSync, symlinkSync, truncateSync, unlinkSync, writeFileSync,
} from "node:fs";
import { join } from "node:path";
import { ConfigWatch, MachineConfigWatch, repositoryLinksAtBase, resolveGitDirs } from "../../src/harness/configwatch.js";
import { runLoop, type LoopConfig, type LoopResult } from "../../src/harness/runtime.js";
import { StubDeveloper, StubPlanner, StubQa } from "../../src/harness/roles.js";
import { exitingChecks, makeRepo, requireGit, type RepoFixture } from "./fixture.js";
import { scratch } from "./candidate-a-fixture.js";

const isWin = process.platform === "win32";
const say = (tag: string, o: unknown) =>
  console.log(`${tag} ${JSON.stringify(o, (_k, v) => (typeof v === "bigint" ? String(v) : v))}`);
const code = (f: () => unknown): string => {
  try { f(); return "none"; } catch (e) { return (e as NodeJS.ErrnoException).code ?? (e as Error).message; }
};
const inoOf = (p: string) => String(lstatSync(p, { bigint: true }).ino);
const statIno = (p: string) => String(statSync(p, { bigint: true }).ino);
const PLANT = "[core]\n\tfsmonitor = /nonexistent/q130-monitor\n";

type Run = { r: LoopResult | null; thrown: string; gitAfterRole: string[]; record: string; roleRan: boolean };

/** runLoop with a developer that runs the stub, then `act`; the spy is armed from the role's return. */
async function loopWith(repo: RepoFixture, act: () => void, env?: NodeJS.ProcessEnv): Promise<Run> {
  let roleRan = false;
  const loop: LoopConfig = {
    repoRoot: repo.root, loop: "t001", ...(env ? { env } : {}),
    roles: {
      planner: new StubPlanner(),
      developer: { role: "developer", run: async (ctx) => {
        roleRan = true;
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
  return { r, thrown, gitAfterRole, roleRan, record: JSON.stringify(r, (_k, v) => (typeof v === "bigint" ? String(v) : v)) };
}

const summary = (x: Run) => ({
  thrown: x.thrown,
  roleRan: x.roleRan,
  failure: x.r?.failure ? { stage: x.r.failure.stage, code: x.r.failure.code, reason: x.r.failure.reason.slice(0, 900) } : null,
  status: x.r?.status,
  gitAfterRoleCount: x.gitAfterRole.length,
  verdicts: x.r?.configVerdicts.map((v) => ({
    stage: v.stage, ok: v.ok, changes: v.changes.filter((c) => !c.path.endsWith(".sample")),
    unrestored: v.unrestored.filter((u) => !u.includes(".sample")), unlisted: v.unlisted,
  })),
});

describe("QA 130 probe (not for merge): A11", { timeout: 120_000 }, () => {
  let repo: RepoFixture;
  let tmp: { dir: string; cleanup: () => Promise<void> };
  const undo: string[] = [];
  beforeAll(() => requireGit());
  beforeEach(() => {
    repo = makeRepo("q130-");
    tmp = scratch("q130-out-");
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

  // ---------------------------------------------------------------- R83 with R88: at the window's open -------------
  it.skipIf(isWin)("Q130-R88-NOSEARCH-AT-OPEN: a user's hook in a hooks dir already 0600 when the loop opens: refused, named with EACCES, the role never runs, the hook untouched", async () => {
    const hooks = hooksPath();
    emptyHooks();
    const user = join(hooks, "pre-commit");
    const body = "#!/bin/sh\necho the-users-own-hook\n";
    writeFileSync(user, body);
    chmodSync(user, 0o755);
    chmodSync(hooks, 0o600);
    undo.push(hooks);
    const lstatCode = code(() => lstatSync(user));
    const x = await loopWith(repo, () => { appendFileSync(user, "echo role-edit\n"); });
    chmodSync(hooks, 0o755);
    const after = existsSync(user) ? readFileSync(user, "utf-8") : "(deleted)";
    say("Q130-R88-NOSEARCH-AT-OPEN", { lstatCode, after, ...summary(x) });
    expect(lstatCode).toBe("EACCES");
    expect(x.thrown).toBe("");
    expect(x.r!.failure?.code, "R88 (R77.6's form): a path the window cannot snapshot refuses the stage").toBe("config-watch-unestablished");
    expect(x.r!.failure?.reason ?? "", "the reason names the path and the code").toContain(`unreadable: ${user} (EACCES)`);
    expect(x.roleRan, "the role did not run").toBe(false);
    expect(after, "R83 (b): the user's hook survives").toBe(body);
  });

  it.skipIf(isWin)("Q130-R83-DOTGIT-NOSEARCH: config planted, then .git made 0600 (lists, cannot be searched): unreadable with its code, never deleted/absent, stop before git", async () => {
    undo.push(gitDir());
    let lstatCode = "";
    const x = await loopWith(repo, () => {
      appendFileSync(cfgPath(), PLANT);
      chmodSync(gitDir(), 0o600);
      lstatCode = code(() => lstatSync(cfgPath()));
    });
    chmodSync(gitDir(), 0o755);
    const change = x.r?.configVerdicts.flatMap((v) => v.changes).find((c) => c.path === cfgPath()) ?? null;
    say("Q130-R83-DOTGIT-NOSEARCH", { lstatCode, change, ...summary(x) });
    expect(lstatCode).toBe("EACCES");
    expect(x.thrown).toBe("");
    expect(x.r!.failure?.code).toBe("stage-changed-config");
    expect(change?.kind ?? "", "R83: never deleted").not.toBe("deleted");
    expect(change?.after ?? "", "R83: unreadable with the code").toContain("unreadable (EACCES)");
    expect(x.gitAfterRole, "R77.4: no git call after the role").toEqual([]);
  });

  it.skipIf(isWin)("Q130-R83-SUBDIR-NOSEARCH-PLANT: a file planted in a hooks subdirectory, the subdirectory made 0600: fails the stage, never created-from-absent-then-unlinked, stop before git", async () => {
    const sub = join(hooksPath(), "q130-sub");
    mkdirSync(sub);
    undo.push(sub);
    const plant = join(sub, "planted");
    let lstatCode = "";
    const x = await loopWith(repo, () => {
      writeFileSync(plant, "#!/bin/sh\necho planted\n");
      chmodSync(sub, 0o600);
      lstatCode = code(() => lstatSync(plant));
    });
    chmodSync(sub, 0o755);
    const change = x.r?.configVerdicts.flatMap((v) => v.changes).find((c) => c.path === plant) ?? null;
    say("Q130-R83-SUBDIR-NOSEARCH-PLANT", { lstatCode, change, plantStill: existsSync(plant), ...summary(x) });
    expect(lstatCode).toBe("EACCES");
    expect(x.r!.failure?.code).toBe("stage-changed-config");
    expect(change?.after ?? "", "R83").toContain("unreadable (EACCES)");
    expect(x.gitAfterRole, "R77.4").toEqual([]);
  });

  it.skipIf(isWin)("Q130-R85-REPO-UNREADABLE-ZEROED: the repository side's text for a failed lstat prints no zeroed facts and no invented type (R85's search, whole file)", async () => {
    const hooks = hooksPath();
    emptyHooks();
    const plant = join(hooks, "post-checkout");
    undo.push(hooks);
    const x = await loopWith(repo, () => {
      writeFileSync(plant, "#!/bin/sh\necho planted\n");
      chmodSync(plant, 0o755);
      chmodSync(hooks, 0o600);
    });
    chmodSync(hooks, 0o755);
    const change = x.r?.configVerdicts.flatMap((v) => v.changes).find((c) => c.path === plant) ?? null;
    const unrestored = x.r?.configVerdicts.flatMap((v) => v.unrestored).filter((u) => u.includes("post-checkout")) ?? [];
    say("Q130-R85-REPO-UNREADABLE-ZEROED", { change, unrestored, failure: x.r?.failure?.code });
    expect(change?.after ?? "", "R83").toContain("unreadable (EACCES)");
    expect(change?.after ?? "", "R85: no zeroed dev for a path whose lstat failed").not.toContain("dev null");
    expect(change?.after ?? "", "R85: no zeroed size").not.toContain("size 0");
  });

  it.skipIf(isWin)("Q130-R83-227 (unit): .git unsearchable: repositoryLinksAtBase lists nothing, and begin cannot be established (unlisted and read failures named)", () => {
    const dirs = resolveGitDirs(repo.root);
    const watch = new ConfigWatch(dirs, repo.root);
    chmodSync(gitDir(), 0o600);
    undo.push(gitDir());
    let links: string[] = [];
    let unlisted: readonly string[] = [];
    let reads: readonly string[] = [];
    let thrown = "";
    try {
      links = repositoryLinksAtBase(repo.root, dirs);
      watch.captureBase();
      watch.begin("developer");
      unlisted = watch.unlistedAtOpen();
      reads = watch.readFailuresAtOpen();
    } catch (e) { thrown = (e as Error).message; } finally { chmodSync(gitDir(), 0o755); }
    say("Q130-R83-227", { thrown, links, unlisted, reads });
    expect(thrown).toBe("");
    expect(unlisted.some((u) => u.includes("hooks") && u.includes("EACCES")), "the tree the :227 scan skips is unlisted at begin").toBe(true);
    expect(reads.some((u) => u.includes(`unreadable: ${cfgPath()} (EACCES)`)), "R88: the config is a read failure at open").toBe(true);
  });

  it("Q130-R83-DIR-AT-CONFIG (observation): .git/config replaced by an EMPTY directory: what the record says, stop before git", async () => {
    const x = await loopWith(repo, () => {
      unlinkSync(cfgPath());
      mkdirSync(cfgPath());
    });
    const stillDir = lstatSync(cfgPath()).isDirectory();
    const change = x.r?.configVerdicts.flatMap((v) => v.changes).find((c) => c.path === cfgPath()) ?? null;
    say("Q130-R83-DIR-AT-CONFIG", { stillDir, change, ...summary(x) });
    if (stillDir) { rmSync(cfgPath(), { recursive: true, force: true }); writeFileSync(cfgPath(), "[core]\n\trepositoryformatversion = 0\n"); }
    expect(x.thrown).toBe("");
    expect(x.r!.failure?.code).toBe("stage-changed-config");
    expect(x.gitAfterRole, "R77.4").toEqual([]);
  });

  // ---------------------------------------------------------------- R88: other codes, and what is not a failure -----
  it("Q130-R88-TOOLARGE-AT-OPEN: a hook already 3 GiB when the loop opens: refused config-watch-unestablished with its code; the role never runs", async () => {
    const hook = join(hooksPath(), "pre-commit");
    writeFileSync(hook, "#!/bin/sh\n");
    truncateSync(hook, 3 * 2 ** 30);
    const readCode = code(() => readFileSync(hook));
    let x: Run;
    try { x = await loopWith(repo, () => {}); } finally { truncateSync(hook, 10); }
    say("Q130-R88-TOOLARGE-AT-OPEN", { readCode, ...summary(x) });
    expect(readCode).toBe("ERR_FS_FILE_TOO_LARGE");
    expect(x.thrown).toBe("");
    expect(x.r!.failure?.code, "R88").toBe("config-watch-unestablished");
    expect(x.r!.failure?.reason ?? "").toContain(`unreadable: ${hook} (ERR_FS_FILE_TOO_LARGE)`);
    expect(x.roleRan).toBe(false);
  });

  it("Q130-R88-NOTREAD-IS-NOT-A-FAILURE (unit): a hook whose identity changed since the loop base is a deliberate not-read at the open, not a read failure", () => {
    const hook = join(hooksPath(), "pre-commit");
    writeFileSync(hook, "#!/bin/sh\necho base\n");
    const watch = new ConfigWatch(resolveGitDirs(repo.root), repo.root);
    watch.captureBase();
    writeFileSync(`${hook}.new`, "#!/bin/sh\necho replaced\n");
    renameSync(`${hook}.new`, hook);
    watch.begin("developer");
    const reads = watch.readFailuresAtOpen();
    const unlisted = watch.unlistedAtOpen();
    say("Q130-R88-NOTREAD-IS-NOT-A-FAILURE", { reads, unlisted });
    expect(reads, "a deliberate not-read (D-041) is an observation, never a failure").toEqual([]);
  });

  // ---------------------------------------------------------------- R84 ------------------------------------------------
  const one = (path: string) => new MachineConfigWatch([{ scope: "global", path, source: "q130" }]);
  const xdgOne = (path: string) => new MachineConfigWatch([{ scope: "xdg", path, source: "q130" }]);

  it.skipIf(isWin)("Q130-R84-DANGLING-THEN-EACCES (unit): a dangling link at ~/.gitconfig at the stage start (observed), then HOME 000: unobservable, the stage fails", () => {
    const h = join(tmp.dir, "dte");
    mkdirSync(h);
    const cfg = join(h, ".gitconfig");
    symlinkSync(join(h, "nowhere"), cfg, "file");
    const watch = one(cfg);
    watch.captureBase();
    watch.begin("developer");
    chmodSync(h, 0o000);
    undo.push(h);
    let row: ReturnType<MachineConfigWatch["compare"]>[number] | undefined;
    try { row = watch.compare().find((f) => f.path === cfg); } finally { chmodSync(h, 0o755); }
    say("Q130-R84-DANGLING-THEN-EACCES", { row });
    expect(row?.unobservableCode, "R84: observed at the start (a link, absent target), unobservable at close").toBe("EACCES");
    expect(row?.after ?? "", "R85b: no zeros").not.toContain("dev null");
  });

  // ---------------------------------------------------------------- R85 / R85b: links ---------------------------------
  /** XDG git dir is a directory link at the loop base, to `target`, holding `config`. */
  const xdgViaLink = (name: string) => {
    const xdg = join(tmp.dir, `${name}-xdg`);
    mkdirSync(xdg);
    const target = join(tmp.dir, `${name}-target`);
    mkdirSync(target);
    writeFileSync(join(target, "config"), "[user]\n\tname = via\n");
    symlinkSync(target, join(xdg, "git"), isWin ? "junction" : "dir");
    const cfg = join(xdg, "git", "config");
    return { xdg, target, cfg, link: join(xdg, "git") };
  };

  it.skipIf(isWin)("Q130-R85-VIA-FILE000 (unit): the XDG git dir is a link at base (read through); the file is made 000: the unobservable side carries the resolved file's facts and the link's", () => {
    const v = xdgViaLink("vf");
    const watch = xdgOne(v.cfg);
    watch.captureBase();
    watch.begin("developer");
    appendFileSync(join(v.target, "config"), "[core]\n\tx = 1\n");
    chmodSync(join(v.target, "config"), 0o000);
    undo.push(join(v.target, "config"));
    const fileIno = statIno(join(v.target, "config"));
    const linkIno = inoOf(v.link);
    let row: ReturnType<MachineConfigWatch["compare"]>[number] | undefined;
    try { row = watch.compare().find((f) => f.path === v.cfg); } finally { chmodSync(join(v.target, "config"), 0o644); }
    say("Q130-R85-VIA-FILE000", { row, fileIno, linkIno });
    expect(row?.unobservableCode).toBe("EACCES");
    expect(row?.after ?? "", "R86: the link's lstat").toContain(`ino ${linkIno}`);
    expect(row?.after ?? "", "R85/R85b: observe has the resolved file's facts (stat succeeded); they are printed").toContain(`ino ${fileIno}`);
  });

  it.skipIf(isWin)("Q130-R85-VIA-TARGET000 (unit): the XDG git dir is a link at base; its target dir is made 000: the parent link's lstat is printed, no zeros", () => {
    const v = xdgViaLink("vt");
    const watch = xdgOne(v.cfg);
    watch.captureBase();
    watch.begin("developer");
    chmodSync(v.target, 0o000);
    undo.push(v.target);
    const linkIno = inoOf(v.link);
    let row: ReturnType<MachineConfigWatch["compare"]>[number] | undefined;
    try { row = watch.compare().find((f) => f.path === v.cfg); } finally { chmodSync(v.target, 0o755); }
    say("Q130-R85-VIA-TARGET000", { row, linkIno });
    expect(row?.unobservableCode).toBe("EACCES");
    expect(row?.after ?? "").toContain("link: type symlink");
    expect(row?.after ?? "", "R85b: a parent link that was lstat'd prints that lstat").toContain(`ino ${linkIno}`);
    expect(row?.after ?? "").not.toContain("dev null");
  });

  it.skipIf(isWin)("Q130-R85-LINK-TARGET000 (unit): ~/.gitconfig is a link at base to a file in a dir made 000: the link side, labelled, 'does not resolve (EACCES)'", () => {
    const h = join(tmp.dir, "lt");
    mkdirSync(h);
    const d = join(tmp.dir, "lt-dir");
    mkdirSync(d);
    writeFileSync(join(d, "real"), "[user]\n\tname = lt\n");
    const cfg = join(h, ".gitconfig");
    symlinkSync(join(d, "real"), cfg, "file");
    const watch = one(cfg);
    watch.captureBase();
    watch.begin("developer");
    chmodSync(d, 0o000);
    undo.push(d);
    const linkIno = inoOf(cfg);
    let row: ReturnType<MachineConfigWatch["compare"]>[number] | undefined;
    try { row = watch.compare().find((f) => f.path === cfg); } finally { chmodSync(d, 0o755); }
    say("Q130-R85-LINK-TARGET000", { row, linkIno });
    expect(row?.unobservableCode).toBe("EACCES");
    expect(row?.after ?? "").toContain(`link: type symlink dev`);
    expect(row?.after ?? "").toContain(`ino ${linkIno}`);
    expect(row?.after ?? "").toContain("does not resolve (EACCES)");
  });

  it("Q130-R85-ELOOP-LABEL (unit): read at the start, a symlink loop at close: the unobservable side is the labelled link side, 'does not resolve (ELOOP)'", () => {
    const h = join(tmp.dir, "elb");
    mkdirSync(h);
    const cfg = join(h, ".gitconfig");
    writeFileSync(cfg, "[user]\n\tname = elb\n");
    const watch = one(cfg);
    watch.captureBase();
    watch.begin("developer");
    unlinkSync(cfg);
    symlinkSync(join(h, "loop-b"), cfg, "file");
    symlinkSync(cfg, join(h, "loop-b"), "file");
    const linkIno = inoOf(cfg);
    const row = watch.compare().find((f) => f.path === cfg)!;
    say("Q130-R85-ELOOP-LABEL", { row, linkIno });
    expect(row.unobservableCode).toBe("ELOOP");
    expect(row.after, "R85: a link side carries its linkSide").toContain(`link: type symlink dev`);
    expect(row.after).toContain(`ino ${linkIno}`);
    expect(row.after).toContain("does not resolve (ELOOP)");
  });

  // ---------------------------------------------------------------- R86 on every platform -----------------------------
  it("Q130-R86-ANCESTOR-JUNCTION: the developer's R86 shape on every platform (a junction on win32): the link's lstat, labelled", () => {
    const xdg = join(tmp.dir, "r86w-xdg");
    mkdirSync(join(xdg, "git"), { recursive: true });
    const cfg = join(xdg, "git", "config");
    writeFileSync(cfg, "[user]\n\tname = r86\n");
    const watch = xdgOne(cfg);
    watch.captureBase();
    watch.begin("developer");
    const other = join(tmp.dir, "r86w-other");
    mkdirSync(other);
    writeFileSync(join(other, "config"), "[user]\n\tname = r86-other\n");
    renameSync(join(xdg, "git"), join(xdg, "git-old"));
    symlinkSync(other, join(xdg, "git"), isWin ? "junction" : "dir");
    const linkIno = inoOf(join(xdg, "git"));
    const targetIno = statIno(join(other, "config"));
    const row = watch.compare().find((f) => f.path === cfg)!;
    say("Q130-R86-ANCESTOR-JUNCTION", { row, linkIno, targetIno });
    expect(row.after).toContain("type change");
    expect(row.after).toContain("link: type symlink");
    expect(row.after).toContain(`ino ${linkIno}`);
    expect(row.after, "and the resolved file").toContain(`ino ${targetIno}`);
  });

  it("Q130-R86-ABSENT-ANCESTOR-LINK: the XDG git dir absent at the loop base; the role plants a junction to a dir WITH a config: the link's lstat, as for a link at the path", () => {
    const xdg = join(tmp.dir, "aal-xdg");
    mkdirSync(xdg);
    const cfg = join(xdg, "git", "config");
    const watch = xdgOne(cfg);
    watch.captureBase();
    watch.begin("developer");
    const other = join(tmp.dir, "aal-other");
    mkdirSync(other);
    writeFileSync(join(other, "config"), "[user]\n\tname = aal\n");
    symlinkSync(other, join(xdg, "git"), isWin ? "junction" : "dir");
    const linkIno = inoOf(join(xdg, "git"));
    const row = watch.compare().find((f) => f.path === cfg)!;
    say("Q130-R86-ABSENT-ANCESTOR-LINK", { row, linkIno });
    expect(row.changed).toBe(true);
    expect(row.after).toContain("absent → symlink");
    expect(row.after, "R86/R79: the link's lstat facts (a link AT the path prints them in this branch)").toContain(`ino ${linkIno}`);
  });
});
