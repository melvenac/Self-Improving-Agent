/**
 * QA PROBE, NOT FOR MERGE. Loop 15 slice three, QA record session 94, scoring candidate A6 dc35b24.
 *
 * POSIX-only where a file symlink or mode 000 is needed. Read from configwatch.ts at dc35b24 before any run:
 * MachineConfigWatch.observe() resolves with realpathSync.native + statSync, compares (kind, dev, ino, nlink) to the
 * loop base, then opens the PATH and compares fstat on the handle. compare() writes a finding only when something
 * changed; baseNotes() writes a note only for a link on the path as written, or a base state of "unwatched".
 *
 * Dispatch section 3(c): D-041's trade in both directions, and a third case rulings-13 did not name.
 *   TRADE-SAME     a new symlink planted mid-path that leads to the SAME base file: may be read (allowed).
 *   TRADE-DIFF     a new symlink planted mid-path that leads to a DIFFERENT file: not read, reported, both
 *                  resolutions named.
 *   REPOINT        the base link itself repointed to an outside file: not read; the record names the current
 *                  resolved path (R60: "the resolved path and the identity").
 *   HARDLINK-SAME  third-case candidate: a HARD link to the base file is made ELSEWHERE (the base path and the
 *                  object are untouched; only nlink moves). R60's identity includes nlink, so this is "a different
 *                  file" by the ruling. What happens to a later in-place edit, in a later stage?
 *   REUSE          third-case candidate: the base file is deleted and a new file with the SAME (dev, ino, nlink) is
 *                  put at the path (inode reuse). Not the base file; identical identity. Is it read?
 *   UNREAD-BASE    a path unreadable at base (mode 000), later made readable and edited: what does "before" say?
 * Dispatch section 3(d): R61, every watched path in a reported state at every stage.
 *   R61-UNIT       four base states (read / unwatched / not read: unreadable / not read: not a file); a stage with no act.
 *   R61-LOOP       runLoop, three machine paths; a stage with a hard link made elsewhere, then a stage that edits in place.
 *
 * Every test prints a QA94-... line with what it saw. Each asserts its own plant.
 */
import { describe, it, expect, beforeAll, beforeEach, afterEach } from "vitest";
import { createHash } from "node:crypto";
import {
  appendFileSync, chmodSync, linkSync, lstatSync, mkdirSync, readFileSync, renameSync, statSync, symlinkSync,
  unlinkSync, writeFileSync,
} from "node:fs";
import { join } from "node:path";
import { runLoop, type LoopConfig } from "../../src/harness/runtime.js";
import { StubDeveloper, StubPlanner, StubQa } from "../../src/harness/roles.js";
import { MachineConfigWatch } from "../../src/harness/configwatch.js";
import { exitingChecks, makeRepo, requireGit, type RepoFixture } from "./fixture.js";
import { scratch } from "./candidate-a-fixture.js";

const isWin = process.platform === "win32";
const h16 = (b: Buffer | string) => createHash("sha256").update(b).digest("hex").slice(0, 16);
const say = (tag: string, o: unknown) => console.log(`${tag} ${JSON.stringify(o, (_k, v) => (typeof v === "bigint" ? String(v) : v))}`);

describe("QA 94 probe (not for merge): D-041's trade and R61 on POSIX", { timeout: 120_000 }, () => {
  let repo: RepoFixture;
  let tmp: { dir: string; cleanup: () => Promise<void> };
  beforeAll(() => requireGit());
  beforeEach(() => {
    repo = makeRepo("qa94-probe-");
    tmp = scratch("qa94-probe-out-");
  });
  afterEach(async () => {
    await repo.cleanup();
    await tmp.cleanup();
  });

  /** $XDG/git/config, a plain file at base, no links anywhere. */
  const plainXdg = (n: string) => {
    const xdg = join(tmp.dir, `${n}-xdg`);
    mkdirSync(join(xdg, "git"), { recursive: true });
    const cfg = join(xdg, "git", "config");
    writeFileSync(cfg, `[user]\n\tname = ${n}-base\n`);
    expect(lstatSync(cfg).isFile() && lstatSync(join(xdg, "git")).isDirectory(), "plant: plain file, plain dir").toBe(true);
    return { xdg, cfg };
  };

  it.skipIf(isWin)("TRADE-SAME: a new link mid-path to the SAME base file is read; an in-place edit after it is hashed", () => {
    const { xdg, cfg } = plainXdg("tsame");
    const watch = new MachineConfigWatch([{ scope: "xdg", path: cfg, source: "qa94" }]);
    watch.captureBase();
    const baseIno = statSync(cfg).ino;
    watch.begin("developer");
    renameSync(join(xdg, "git"), join(xdg, "git-real"));
    symlinkSync(join(xdg, "git-real"), join(xdg, "git"));
    expect(lstatSync(join(xdg, "git")).isSymbolicLink(), "plant: $XDG/git is now a link").toBe(true);
    expect(statSync(cfg).ino, "plant: the same object is reached").toBe(baseIno);
    const edited = "[user]\n\tname = tsame-edited\n";
    writeFileSync(cfg, edited);
    const found = watch.compare();
    say("QA94-TRADE-SAME", { editHash: h16(edited), inRecord: JSON.stringify(found).includes(h16(edited)), found });
    expect(JSON.stringify(found), "D-041: the same file through a new link may be read").toContain(h16(edited));
  });

  it.skipIf(isWin)("TRADE-DIFF: a new link mid-path to a DIFFERENT file is not read, and both resolutions are named", () => {
    const { xdg, cfg } = plainXdg("tdiff");
    const watch = new MachineConfigWatch([{ scope: "xdg", path: cfg, source: "qa94" }]);
    watch.captureBase();
    watch.begin("developer");
    const outside = join(tmp.dir, "tdiff-outside");
    mkdirSync(outside);
    const secret = "[user]\n\tname = VICTIM-TDIFF\n";
    writeFileSync(join(outside, "config"), secret);
    renameSync(join(xdg, "git"), join(xdg, "git-aside"));
    symlinkSync(outside, join(xdg, "git"));
    expect(readFileSync(cfg, "utf-8"), "plant: the path now reaches the outside file").toBe(secret);
    const found = watch.compare();
    const blob = JSON.stringify(found);
    say("QA94-TRADE-DIFF", { victimHash: h16(secret), inRecord: blob.includes(h16(secret)), found });
    expect(blob, "not read").not.toContain(h16(secret));
    expect(found.length, "reported").toBeGreaterThan(0);
    expect(blob, "the current resolution is named").toContain(join(outside, "config"));
    expect(blob, "the base resolution is named").toContain(cfg);
  });

  it.skipIf(isWin)("REPOINT: the base stow link repointed to an outside file is not read, and names the resolved path", () => {
    const home = join(tmp.dir, "rp-home");
    const dot = join(tmp.dir, "rp-dot");
    mkdirSync(home); mkdirSync(dot);
    const target = join(dot, "gitconfig");
    writeFileSync(target, "[user]\n\tname = rp-base\n");
    const cfg = join(home, ".gitconfig");
    symlinkSync(join("..", "rp-dot", "gitconfig"), cfg);
    const watch = new MachineConfigWatch([{ scope: "global", path: cfg, source: "qa94" }]);
    watch.captureBase();
    watch.begin("developer");
    const victim = join(tmp.dir, "rp-victim");
    const secret = "[user]\n\tname = VICTIM-REPOINT\n";
    writeFileSync(victim, secret);
    unlinkSync(cfg);
    symlinkSync(victim, cfg);
    expect(readFileSync(cfg, "utf-8"), "plant: repointed").toBe(secret);
    const found = watch.compare();
    const blob = JSON.stringify(found);
    say("QA94-REPOINT", { inRecord: blob.includes(h16(secret)), namesVictim: blob.includes(victim), namesTarget: blob.includes(target), found });
    expect(blob).not.toContain(h16(secret));
    expect(blob, "R60: the current resolution is named").toContain(victim);
    expect(blob, "R60: the base resolution is named").toContain(target);
  });

  it.skipIf(isWin)("HARDLINK-SAME: a hard link made ELSEWHERE to the base file; a later-stage in-place edit — is it reported?", () => {
    const { cfg } = plainXdg("hls");
    const watch = new MachineConfigWatch([{ scope: "xdg", path: cfg, source: "qa94" }]);
    watch.captureBase();
    const baseIno = statSync(cfg).ino;
    watch.begin("developer");
    const elsewhere = join(repo.root, "not-config-at-all");
    linkSync(cfg, elsewhere);
    expect(statSync(cfg).ino, "plant: the same object").toBe(baseIno);
    expect(statSync(cfg).nlink, "plant: nlink 2").toBe(2);
    const dev = watch.compare();
    watch.begin("qa");
    const edited = "[user]\n\tname = hls-edited-in-a-later-stage\n";
    appendFileSync(cfg, edited);
    expect(statSync(cfg).ino, "plant: still the base object").toBe(baseIno);
    const qa = watch.compare();
    say("QA94-HARDLINK-SAME", { dev, qa, qaEditHash: h16(readFileSync(cfg)), qaInRecord: JSON.stringify(qa).includes(h16(readFileSync(cfg))) });
    expect(dev.length, "the identity change is reported in its stage").toBeGreaterThan(0);
    expect(qa.length, "R61/CA-4f: the later stage's write to the SAME base object is reported").toBeGreaterThan(0);
  });

  it.skipIf(isWin)("REUSE: the base file deleted and a new file given its inode number: is the new file read?", () => {
    const { xdg, cfg } = plainXdg("reuse");
    const watch = new MachineConfigWatch([{ scope: "xdg", path: cfg, source: "qa94" }]);
    watch.captureBase();
    const base = statSync(cfg, { bigint: true });
    watch.begin("developer");
    const secret = "[user]\n\tname = VICTIM-REUSE-NOT-THE-BASE-FILE\n";
    unlinkSync(cfg);
    const scratchDir = join(xdg, "git");
    const tried: string[] = [];
    let got = false;
    for (let i = 0; i < 4000 && !got; i++) {
      const p = join(scratchDir, `n${i}`);
      writeFileSync(p, secret);
      if (statSync(p, { bigint: true }).ino === base.ino) {
        renameSync(p, cfg);
        got = true;
      } else tried.push(p);
    }
    for (const p of tried) unlinkSync(p);
    const now = statSync(cfg, { bigint: true });
    const found = watch.compare();
    const blob = JSON.stringify(found);
    say("QA94-REUSE", { reused: got, attempts: tried.length + (got ? 1 : 0), baseIno: String(base.ino), nowIno: String(now.ino), nlink: String(now.nlink), victimHash: h16(secret), readAndHashed: blob.includes(h16(secret)), found });
    // Observation only: the ruling defines identity as (type, dev, ino, nlink), so a reused inode IS "the base file"
    // by its words. Asserted: the plant, when the filesystem gave the inode back.
    if (got) expect(now.ino === base.ino && now.nlink === base.nlink && now.dev === base.dev, "plant: identical identity").toBe(true);
  });

  it.skipIf(isWin)("UNREAD-BASE: a path unreadable at base, made readable and edited: the record's 'before' is not 'absent'", () => {
    const home = join(tmp.dir, "ub-home");
    mkdirSync(home);
    const cfg = join(home, ".gitconfig");
    writeFileSync(cfg, "[user]\n\tname = ub-base\n");
    chmodSync(cfg, 0o000);
    let eacces = false;
    try { readFileSync(cfg); } catch (e) { eacces = (e as NodeJS.ErrnoException).code === "EACCES"; }
    const watch = new MachineConfigWatch([{ scope: "global", path: cfg, source: "qa94" }]);
    watch.captureBase();
    const notes = watch.baseNotes();
    watch.begin("developer");
    chmodSync(cfg, 0o644);
    const edited = "[user]\n\tname = ub-edited\n";
    writeFileSync(cfg, edited);
    const found = watch.compare();
    say("QA94-UNREAD-BASE", { eacces, notes, found });
    expect(eacces, "plant: EACCES at base (not running as root)").toBe(true);
    expect(notes.join("\n") + JSON.stringify(found), "R61: the base state is reported").toContain(cfg);
    expect(found[0]?.before, "the path existed at base; 'absent' is a claim the runtime did not observe").not.toBe("absent");
  });

  it.skipIf(isWin)("R61-UNIT: four base states, one stage with no act: every path is in a reported state", () => {
    const home = join(tmp.dir, "r61u");
    mkdirSync(home);
    const readP = join(home, "read.gitconfig");
    writeFileSync(readP, "[user]\n\tname = r61-read\n");
    const dangling = join(home, "dangling.gitconfig");
    symlinkSync("r61-missing", dangling);
    const unreadable = join(home, "unreadable.gitconfig");
    writeFileSync(unreadable, "[user]\n\tname = r61-000\n");
    chmodSync(unreadable, 0o000);
    const dir = join(home, "dir.gitconfig");
    mkdirSync(dir);
    const paths = [readP, dangling, unreadable, dir];
    const watch = new MachineConfigWatch(paths.map((path, i) => ({ scope: ["global", "xdg", "system", "global"][i] as "global", path, source: "qa94" })));
    watch.captureBase();
    const notes = watch.baseNotes();
    watch.begin("developer");
    const found = watch.compare();
    const record = notes.join("\n") + "\n" + JSON.stringify(found);
    const present = Object.fromEntries(paths.map((p) => [p.split("/").pop(), record.includes(p)]));
    say("QA94-R61-UNIT", { present, notes, found, readHash: h16(readFileSync(readP)), readHashInRecord: record.includes(h16(readFileSync(readP))) });
    for (const p of paths) expect(record, `R61: ${p} is in the record with its state`).toContain(p);
  });

  it.skipIf(isWin)("R61-LOOP: runLoop; every machine path in every stage's record; a hard link elsewhere, then an in-place edit", async () => {
    const home = join(tmp.dir, "r61l-home");
    mkdirSync(home);
    const globalCfg = join(home, ".gitconfig");
    writeFileSync(globalCfg, "[user]\n\tname = r61l-base\n");
    const xdg = join(tmp.dir, "r61l-xdg");
    mkdirSync(join(xdg, "git"), { recursive: true });
    symlinkSync("r61l-missing", join(xdg, "git", "config"));
    const system = join(tmp.dir, "r61l-system.gitconfig");
    writeFileSync(system, "");
    const env: NodeJS.ProcessEnv = { ...process.env, HOME: home, USERPROFILE: home, XDG_CONFIG_HOME: xdg, GIT_CONFIG_SYSTEM: system };
    delete env.GIT_CONFIG_GLOBAL;
    const elsewhere = join(tmp.dir, "r61l-elsewhere");
    let qaHash = "";
    const cfgLoop: LoopConfig = {
      repoRoot: repo.root, loop: "t001", env,
      roles: {
        planner: new StubPlanner(),
        developer: { role: "developer", run: async (ctx) => { const d = await new StubDeveloper().run(ctx); linkSync(globalCfg, elsewhere); return d; } },
        qa: { role: "qa", run: async (ctx) => { appendFileSync(globalCfg, "[user]\n\tname = r61l-qa-append\n"); qaHash = h16(readFileSync(globalCfg)); return new StubQa().run(ctx); } },
      },
      checks: exitingChecks(0, 0),
      log: () => {},
    };
    const r = await runLoop(cfgLoop);
    const byStage: Record<string, string[]> = {};
    for (const f of r.machineConfigFindings) (byStage[f.stage] ??= []).push(`${f.path} ${f.before} -> ${f.after}`);
    const baseNotes = r.findings.filter((f) => f.startsWith("machine config "));
    say("QA94-R61-LOOP", {
      status: r.status, failure: r.failure?.code ?? null, paths: [globalCfg, join(xdg, "git", "config"), system],
      baseNotes, byStage, qaHash, qaHashInRecord: JSON.stringify(r).includes(qaHash), nlinkNow: statSync(globalCfg).nlink,
    });
    expect(statSync(globalCfg).nlink, "plant: the developer's hard link").toBe(2);
    expect(readFileSync(globalCfg, "utf-8"), "plant: the qa append").toContain("r61l-qa-append");
    expect(byStage.qa?.some((l) => l.startsWith(globalCfg)) ?? false, "R61/CA-4f: the qa stage's write to ~/.gitconfig is in the record").toBe(true);
  });
});
