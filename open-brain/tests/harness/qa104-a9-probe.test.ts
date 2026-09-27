/**
 * QA PROBE, NOT FOR MERGE. Loop 15 slice three, QA record session 104, scoring candidate A9 6bd97f2.
 *
 * Read from configwatch.ts at 6bd97f2 (blob 1e1e3183) before any run:
 * - compare(): every row carries `changed`, set from hashes (read/read), from sameId (size, mtimeNs, dev, ino, nlink,
 *   kind) and from "this branch is a change". runtime.ts skips a finding only when `changed` is false (R72).
 * - `stageBefore(opened)` returns the hash (read), the bare word "unreadable" (a failed read), the bare word "absent"
 *   (realpath/stat failed, for ANY code), or `stage start <facts>`. Only when BOTH sides are unreadable does "before"
 *   become `unreadable; stage start <facts>`.
 * - A read record prints the hash alone on each side: no facts.
 * - The change text for an unread path is `not read: base <loop base>; current <end>`.
 * - The handle text when the object gained a name inside open is
 *   `handle is a different file; the object gained a name inside open; not read; <facts>`.
 * - Repository side: readState records a refused read (EACCES/EPERM) as `readError: "unreadable"` with the facts.
 *
 * Rulings-16: R72 (never silent, decided from the comparison; "A placeholder (`unreadable`, `absent`) never stands
 * alone for a side that has facts"; both sides, including an unreadable repository file); R73 (every watched path, in
 * every stage's record, carries type, dev, ino, nlink, size, mtimeNs, "Changed or not, read or not"; where lstat fails,
 * the record says so with the error code, never an empty side); R74 (labels `loop base`, `stage start`, `current`;
 * `type` on every side; the gained-a-name text says exactly that, "not 'different file'").
 *
 * Every test prints a QA104-... line with what it saw and asserts its own plant first. Assertions state the RULING;
 * a red test is an observation to be read with its printed line. OBS-... tests assert only their plant.
 */
import { describe, it, expect, beforeAll, beforeEach, afterEach } from "vitest";
import { createHash } from "node:crypto";
import {
  appendFileSync, chmodSync, linkSync, lstatSync, mkdirSync, readFileSync, renameSync, symlinkSync, unlinkSync,
  utimesSync, writeFileSync,
} from "node:fs";
import { join } from "node:path";
import { runLoop, type LoopConfig } from "../../src/harness/runtime.js";
import { StubDeveloper, StubPlanner, StubQa } from "../../src/harness/roles.js";
import { ConfigWatch, MachineConfigWatch, resolveGitDirs } from "../../src/harness/configwatch.js";
import { exitingChecks, makeRepo, requireGit, type RepoFixture } from "./fixture.js";
import { scratch } from "./candidate-a-fixture.js";

const isWin = process.platform === "win32";
const h16 = (b: Buffer | string) => createHash("sha256").update(b).digest("hex").slice(0, 16);
const say = (tag: string, o: unknown) => console.log(`${tag} ${JSON.stringify(o, (_k, v) => (typeof v === "bigint" ? String(v) : v))}`);
const facts = (p: string) => {
  const s = lstatSync(p, { bigint: true });
  return { dev: String(s.dev), ino: String(s.ino), nlink: String(s.nlink), size: String(s.size), mtimeNs: String(s.mtimeNs) };
};
type Row = { stage: string; path: string; before: string; after: string; changed?: boolean };
const eaccesOn = (p: string) => {
  try { readFileSync(p); return false; } catch (e) { return (e as NodeJS.ErrnoException).code === "EACCES"; }
};

describe("QA 104 probe (not for merge): R72-R74 at A9", { timeout: 120_000 }, () => {
  let repo: RepoFixture;
  let tmp: { dir: string; cleanup: () => Promise<void> };
  beforeAll(() => requireGit());
  beforeEach(() => {
    repo = makeRepo("qa104-probe-");
    tmp = scratch("qa104-probe-out-");
  });
  afterEach(async () => {
    await repo.cleanup();
    await tmp.cleanup();
  });

  const one = (path: string) => new MachineConfigWatch([{ scope: "global", path, source: "qa104" }]);
  const home = (name: string) => {
    const h = join(tmp.dir, name);
    mkdirSync(h);
    return { h, cfg: join(h, ".gitconfig") };
  };
  const rowOf = (rows: Row[], p: string) => rows.find((x) => x.path === p);

  // --------------------------------------------------------------- R72: a placeholder never stands alone ---------
  it.skipIf(isWin)("R72-BEFORE-BARE-READ: unreadable at qa's start (facts known), made readable and edited: before carries the facts", () => {
    const { cfg } = home("bbr-home");
    writeFileSync(cfg, "[user]\n\tname = bbr-base\n");
    const watch = one(cfg);
    watch.captureBase();
    watch.begin("developer");
    chmodSync(cfg, 0o000);
    const eacces = eaccesOn(cfg);
    watch.compare();
    const start = facts(cfg);
    watch.begin("qa");
    chmodSync(cfg, 0o644);
    writeFileSync(cfg, "[user]\n\tname = bbr-qa\n");
    const q = rowOf(watch.compare() as Row[], cfg)!;
    say("QA104-R72-BEFORE-BARE-READ", { eacces, start, q });
    expect(eacces, "plant: EACCES at qa's start (not root)").toBe(true);
    expect(q.changed, "a change").toBe(true);
    expect(q.before, "R71: the failed read says unreadable").toContain("unreadable");
    expect(q.before, "R72: the placeholder does not stand alone; R73: the stage-start ino").toContain(`ino ${start.ino}`);
  });

  it.skipIf(isWin)("R72-BEFORE-BARE-TWONAME: unreadable at qa's start; qa replaces it with a two-name file: before carries the facts", () => {
    const { cfg } = home("bbt-home");
    writeFileSync(cfg, "[user]\n\tname = bbt-base\n");
    const watch = one(cfg);
    watch.captureBase();
    watch.begin("developer");
    chmodSync(cfg, 0o000);
    const eacces = eaccesOn(cfg);
    watch.compare();
    const start = facts(cfg);
    watch.begin("qa");
    writeFileSync(`${cfg}.new`, "[user]\n\tname = bbt-two\n");
    renameSync(`${cfg}.new`, cfg);
    linkSync(cfg, join(tmp.dir, "bbt-second"));
    const end = facts(cfg);
    const q = rowOf(watch.compare() as Row[], cfg)!;
    say("QA104-R72-BEFORE-BARE-TWONAME", { eacces, start, end, q });
    expect(eacces, "plant: EACCES at qa's start").toBe(true);
    expect(end.nlink, "plant: two names").toBe("2");
    expect(q.changed, "a change").toBe(true);
    expect(q.before, "R72/R73: the stage-start ino").toContain(`ino ${start.ino}`);
  });

  it.skipIf(isWin)("R72-BEFORE-BARE-LINK: unreadable at qa's start; qa plants a symlink at the path: before carries the facts", () => {
    const { cfg } = home("bbl-home");
    writeFileSync(cfg, "[user]\n\tname = bbl-base\n");
    const watch = one(cfg);
    watch.captureBase();
    watch.begin("developer");
    chmodSync(cfg, 0o000);
    watch.compare();
    const start = facts(cfg);
    watch.begin("qa");
    const elsewhere = join(tmp.dir, "bbl-elsewhere");
    writeFileSync(elsewhere, "[user]\n\tname = bbl-elsewhere\n");
    unlinkSync(cfg);
    symlinkSync(elsewhere, cfg);
    const q = rowOf(watch.compare() as Row[], cfg)!;
    say("QA104-R72-BEFORE-BARE-LINK", { start, q });
    expect(lstatSync(cfg).isSymbolicLink(), "plant: a link at the path").toBe(true);
    expect(q.changed, "a change").toBe(true);
    expect(q.before, "R72/R73: the stage-start ino").toContain(`ino ${start.ino}`);
  });

  it.skipIf(isWin)("R72-UNREADABLE-LOOP: runLoop; developer makes ~/.gitconfig mode 0200; qa appends: a qa line", async () => {
    const { h, cfg } = home("ul-home");
    writeFileSync(cfg, "[user]\n\tname = ul-base\n");
    const xdg = join(tmp.dir, "ul-xdg");
    mkdirSync(xdg);
    const system = join(tmp.dir, "ul-system.gitconfig");
    writeFileSync(system, "");
    const env: NodeJS.ProcessEnv = { ...process.env, HOME: h, USERPROFILE: h, XDG_CONFIG_HOME: xdg, GIT_CONFIG_SYSTEM: system };
    delete env.GIT_CONFIG_GLOBAL;
    let eacces = false;
    let start: Record<string, string> = {};
    let end: Record<string, string> = {};
    const cfgLoop: LoopConfig = {
      repoRoot: repo.root, loop: "t001", env,
      roles: {
        planner: new StubPlanner(),
        developer: { role: "developer", run: async (ctx) => {
          const d = await new StubDeveloper().run(ctx);
          chmodSync(cfg, 0o200);
          eacces = eaccesOn(cfg);
          return d;
        } },
        qa: { role: "qa", run: async (ctx) => {
          start = facts(cfg);
          appendFileSync(cfg, "[core]\n\tqa104 = write-only-later\n");
          end = facts(cfg);
          return new StubQa().run(ctx);
        } },
      },
      checks: exitingChecks(0, 0),
      log: () => {},
    };
    const r = await runLoop(cfgLoop).finally(() => chmodSync(cfg, 0o644));
    const mine = r.machineConfigFindings.filter((x) => x.path === cfg);
    const lines = r.findings.filter((l) => l.includes(cfg));
    say("QA104-R72-UNREADABLE-LOOP", { status: r.status, failure: r.failure?.code ?? null, eacces, start, end, mine, lines });
    expect(eacces, "plant: EACCES after the developer's chmod").toBe(true);
    expect(end.size, "plant: the qa append landed").not.toBe(start.size);
    expect(end.ino, "plant: in place").toBe(start.ino);
    expect(lines.some((l) => l.includes("the qa stage")), "R72/CA-4f: the qa write to an unreadable file is a line").toBe(true);
  });

  // --------------------------------------------------------------- R72: the repository side -----------------------
  it.skipIf(isWin)("R72-REPO-UNREADABLE-AT-START: .git/config mode 0200 BEFORE the window opens, appended: reported with both fact sets", () => {
    const dirs = resolveGitDirs(repo.root);
    const config = join(dirs.commonDir, "config");
    chmodSync(config, 0o200);
    const eacces = eaccesOn(config);
    const start = facts(config);
    const watch = new ConfigWatch(dirs, repo.root);
    let begun = "ok";
    try { watch.begin("developer"); } catch (e) { begun = `threw ${(e as Error).message}`; }
    appendFileSync(config, "\n# qa104-repo-unreadable\n");
    const end = facts(config);
    let v: ReturnType<ConfigWatch["closeAndRestore"]> | null = null;
    let closed = "ok";
    try { v = watch.closeAndRestore(); } catch (e) { closed = `threw ${(e as Error).message}`; }
    chmodSync(config, 0o644);
    const row = v?.changes.find((c) => c.path === config);
    say("QA104-R72-REPO-UNREADABLE-AT-START", { eacces, begun, closed, start, end, row, ok: v?.ok, unrestored: v?.unrestored, message: v?.message });
    expect(eacces, "plant: EACCES").toBe(true);
    expect(end.size, "plant: the append landed").not.toBe(start.size);
    expect(begun, "the window opens").toBe("ok");
    expect(row, "R72: the write is a change").toBeTruthy();
    expect(row!.before, "R72: before has its facts").toContain(`size ${start.size}`);
    expect(row!.after, "R72: after has its facts").toContain(`size ${end.size}`);
    expect(v!.ok, "a change is not ok").toBe(false);
  });

  it.skipIf(isWin)("OBS-REPO-UNREADABLE-STABLE: .git/config mode 0200 before the window, untouched: no change (control)", () => {
    const dirs = resolveGitDirs(repo.root);
    const config = join(dirs.commonDir, "config");
    chmodSync(config, 0o200);
    const watch = new ConfigWatch(dirs, repo.root);
    let v: ReturnType<ConfigWatch["closeAndRestore"]> | null = null;
    let err = "";
    try { watch.begin("developer"); v = watch.closeAndRestore(); } catch (e) { err = (e as Error).message; }
    chmodSync(config, 0o644);
    say("QA104-OBS-REPO-UNREADABLE-STABLE", { err, ok: v?.ok, changes: v?.changes, unrestored: v?.unrestored });
    expect(eaccesOn(config) === false, "plant: readable again").toBe(true);
  });

  // --------------------------------------------------------------- R73: facts on every record -------------------
  it("R73-READ-STABLE-FACTS: a read, single-name ~/.gitconfig untouched: the record carries the facts (\"read or not\")", () => {
    const { cfg } = home("rsf-home");
    writeFileSync(cfg, "[user]\n\tname = rsf\n");
    const f = facts(cfg);
    const watch = one(cfg);
    watch.captureBase();
    watch.begin("developer");
    const d = rowOf(watch.compare() as Row[], cfg)!;
    say("QA104-R73-READ-STABLE-FACTS", { facts: f, d });
    expect(d.after, "plant: read (the hash)").toContain(h16("[user]\n\tname = rsf\n"));
    expect(d.changed, "no change").toBe(false);
    expect(d.after, "R73: ino in the record, read or not").toContain(f.ino);
    expect(d.after, "R73: type in the record").toMatch(/type file/);
  });

  it("R73-READ-CHANGE-FACTS: a read file appended in place: both sides carry the facts", () => {
    const { cfg } = home("rcf-home");
    writeFileSync(cfg, "[user]\n\tname = rcf\n");
    const watch = one(cfg);
    watch.captureBase();
    const start = facts(cfg);
    watch.begin("developer");
    appendFileSync(cfg, "[core]\n\tqa104 = rcf\n");
    const end = facts(cfg);
    const d = rowOf(watch.compare() as Row[], cfg)!;
    say("QA104-R73-READ-CHANGE-FACTS", { start, end, d });
    expect(d.changed, "a change").toBe(true);
    expect(d.before, "R73: stage-start size").toContain(`size ${start.size}`);
    expect(d.after, "R73: current size").toContain(`size ${end.size}`);
  });

  it("R73-DANGLING-STABLE: ~/.gitconfig is a symlink to a missing file at base, untouched: lstat succeeds, so facts", () => {
    const { cfg } = home("dgl-home");
    symlinkSync(join(tmp.dir, "dgl-missing"), cfg);
    const f = facts(cfg);
    const watch = one(cfg);
    watch.captureBase();
    watch.begin("developer");
    const d = rowOf(watch.compare() as Row[], cfg)!;
    say("QA104-R73-DANGLING-STABLE", { lstat: f, d });
    expect(lstatSync(cfg).isSymbolicLink(), "plant: lstat succeeds on the link").toBe(true);
    expect(d.changed, "no change").toBe(false);
    expect(d.after, "R73: the lstat facts (the link's ino)").toContain(f.ino);
  });

  it("R73-LSTAT-FAIL-STABLE: ~/.gitconfig absent throughout: the record names the failure with its code", () => {
    const { cfg } = home("lfs-home");
    const watch = one(cfg);
    watch.captureBase();
    watch.begin("developer");
    const d = rowOf(watch.compare() as Row[], cfg)!;
    say("QA104-R73-LSTAT-FAIL-STABLE", { d });
    expect(d.changed).toBe(false);
    expect(d.after, "R73: the error code").toContain("ENOENT");
  });

  it("R73-ABSENT-BEFORE-CODE: absent at qa's start; qa hard-links an outside file in: 'before' names the failure with its code", () => {
    const { cfg } = home("abc-home");
    const watch = one(cfg);
    watch.captureBase();
    watch.begin("developer");
    watch.compare();
    watch.begin("qa");
    const outside = join(tmp.dir, "abc-outside");
    writeFileSync(outside, "[user]\n\tname = abc\n");
    linkSync(outside, cfg);
    const q = rowOf(watch.compare() as Row[], cfg)!;
    say("QA104-R73-ABSENT-BEFORE-CODE", { q });
    expect(q.changed, "a change").toBe(true);
    expect(q.before, "R73: where lstat fails, the record says so with the error code").toContain("ENOENT");
    expect(q.after, "R74: no fabricated facts for an absent loop base").not.toContain("dev null");
  });

  it.skipIf(isWin)("R73-PARENT-EACCES: HOME mode 000 across the stage boundary, then restored and edited: never 'absent'", () => {
    const { h, cfg } = home("pe-home");
    writeFileSync(cfg, "[user]\n\tname = pe-base\n");
    const watch = one(cfg);
    watch.captureBase();
    watch.begin("developer");
    chmodSync(h, 0o000);
    let code = "";
    try { lstatSync(cfg); } catch (e) { code = (e as NodeJS.ErrnoException).code ?? ""; }
    const dev = rowOf(watch.compare() as Row[], cfg)!;
    watch.begin("qa");
    chmodSync(h, 0o755);
    appendFileSync(cfg, "[core]\n\tqa104 = pe\n");
    const q = rowOf(watch.compare() as Row[], cfg)!;
    say("QA104-R73-PARENT-EACCES", { code, dev, q });
    expect(code, "plant: lstat fails with EACCES at the boundary").toBe("EACCES");
    expect(q.changed, "a change").toBe(true);
    expect(q.before, "R73: the file existed; the record says lstat failed, with its code").not.toBe("absent");
    expect(q.before, "R73: the code").toContain("EACCES");
  });

  // --------------------------------------------------------------- R74: labels ----------------------------------
  it("R74-LABELS: two-name at qa's start (loop base a different, read file), appended: loop base / stage start / current, type everywhere", () => {
    const { cfg } = home("lb-home");
    writeFileSync(cfg, "[user]\n\tname = lb-base\n");
    const baseFacts = facts(cfg);
    const watch = one(cfg);
    watch.captureBase();
    watch.begin("developer");
    writeFileSync(`${cfg}.new`, "[user]\n\tname = lb-two\n");
    renameSync(`${cfg}.new`, cfg);
    linkSync(cfg, join(tmp.dir, "lb-second"));
    watch.compare();
    const startFacts = facts(cfg);
    watch.begin("qa");
    appendFileSync(cfg, "[core]\n\tqa104 = lb\n");
    const q = rowOf(watch.compare() as Row[], cfg)!;
    say("QA104-R74-LABELS", { baseFacts, startFacts, q });
    expect(baseFacts.ino, "plant: base and stage start differ").not.toBe(startFacts.ino);
    expect(q.before, "R74: stage start").toContain("stage start");
    expect(q.before).toMatch(/type file/);
    expect(q.after, "R74: current").toContain("current");
    expect((q.after.match(/type file/g) ?? []).length, "R74: type on both fact sets in 'after'").toBe(2);
    expect(q.after, "R74: the loop base is labelled `loop base`").toContain("loop base");
  });

  it("R74-TYPECHANGE-TYPE: a symlink planted at a read path: every fact set in the text carries type", () => {
    const { cfg } = home("tc-home");
    writeFileSync(cfg, "[user]\n\tname = tc-base\n");
    const watch = one(cfg);
    watch.captureBase();
    watch.begin("developer");
    const elsewhere = join(tmp.dir, "tc-elsewhere");
    writeFileSync(elsewhere, "[user]\n\tname = tc-elsewhere\n");
    unlinkSync(cfg);
    symlinkSync(elsewhere, cfg);
    const d = rowOf(watch.compare() as Row[], cfg)!;
    const sets = (d.after.match(/dev \d+ ino \d+/g) ?? []).length;
    const types = (d.after.match(/type \w+ dev/g) ?? []).length;
    say("QA104-R74-TYPECHANGE-TYPE", { d, sets, types });
    expect(lstatSync(cfg).isSymbolicLink(), "plant").toBe(true);
    expect(d.changed).toBe(true);
    expect(d.after).toContain("type change");
    expect(sets, "fact sets present").toBeGreaterThan(0);
    expect(types, "R74: type on every fact set").toBe(sets);
  });

  // --------------------------------------------------------------- R75: the size mutant's wider kill set ----------
  // The candidate's R72 and R74 tests, copied, printing whether the stage's write moved mtimeNs. If mtimeNs did not
  // move, size is the only fact that differs, and dropping size from sameId hides the write: a timing dependency.
  // The -MTIME-MOVED twins force mtimeNs to move; under M-dev9-size they must stay green if that is the whole reason.
  const candR72 = (forceMtime: boolean) => {
    const { cfg } = home(forceMtime ? "c72m-home" : "c72-home");
    writeFileSync(cfg, "[user]\n\tname = r72-base\n");
    const watch = one(cfg);
    watch.begin("developer");
    chmodSync(cfg, 0o200);
    watch.compare();
    watch.begin("qa");
    const start = facts(cfg);
    appendFileSync(cfg, "[core]\n\tr72 = later\n");
    if (forceMtime) utimesSync(cfg, 1_700_000_100, 1_700_000_100);
    const end = facts(cfg);
    const row = rowOf(watch.compare() as Row[], cfg);
    chmodSync(cfg, 0o644);
    return { start, end, row };
  };
  it.skipIf(isWin)("R75-SIZE-REASON-R72: the candidate's R72 shape; did mtimeNs move? (printed)", () => {
    const { start, end, row } = candR72(false);
    say("QA104-R75-SIZE-REASON-R72", { mtimeMoved: start.mtimeNs !== end.mtimeNs, start, end, row });
    expect(end.size).not.toBe(start.size);
    expect(row?.changed).toBe(true);
  });
  it.skipIf(isWin)("R75-SIZE-REASON-R72-MTIME-MOVED: the same with mtimeNs forced to move: a change without size", () => {
    const { start, end, row } = candR72(true);
    say("QA104-R75-SIZE-REASON-R72-MTIME-MOVED", { start, end, row });
    expect(end.mtimeNs, "plant").not.toBe(start.mtimeNs);
    expect(row?.changed).toBe(true);
  });
  const candR74 = (forceMtime: boolean) => {
    const { cfg } = home(forceMtime ? "c74m-home" : "c74-home");
    writeFileSync(cfg, "[user]\n\tname = r74-base\n");
    const watch = one(cfg);
    watch.begin("developer");
    const other = join(tmp.dir, forceMtime ? "c74m-other" : "c74-other");
    writeFileSync(other, "[user]\n\tname = r74-two\n");
    unlinkSync(cfg);
    linkSync(other, cfg);
    watch.compare();
    const start = facts(cfg);
    watch.begin("qa");
    appendFileSync(cfg, "[core]\n\tr74 = later\n");
    if (forceMtime) utimesSync(cfg, 1_700_000_200, 1_700_000_200);
    const end = facts(cfg);
    const row = rowOf(watch.compare() as Row[], cfg);
    return { start, end, row };
  };
  it("R75-SIZE-REASON-R74: the candidate's R74 shape; did mtimeNs move? (printed)", () => {
    const { start, end, row } = candR74(false);
    say("QA104-R75-SIZE-REASON-R74", { mtimeMoved: start.mtimeNs !== end.mtimeNs, start, end, row });
    expect(row?.changed).toBe(true);
  });
  it("R75-SIZE-REASON-R74-MTIME-MOVED: the same with mtimeNs forced to move: a change without size", () => {
    const { start, end, row } = candR74(true);
    say("QA104-R75-SIZE-REASON-R74-MTIME-MOVED", { start, end, row });
    expect(end.mtimeNs, "plant").not.toBe(start.mtimeNs);
    expect(row?.changed).toBe(true);
  });

  // --------------------------------------------------------------- observations, not scored -----------------------
  it("OBS-READ-SAMEBYTES-RENAME: a read file replaced by lock-and-rename with IDENTICAL bytes: changed?", () => {
    const { cfg } = home("sb-home");
    const body = "[user]\n\tname = sb\n";
    writeFileSync(cfg, body);
    const watch = one(cfg);
    watch.captureBase();
    watch.begin("developer");
    const before = facts(cfg);
    writeFileSync(`${cfg}.lock`, body);
    renameSync(`${cfg}.lock`, cfg);
    const after = facts(cfg);
    const d = rowOf(watch.compare() as Row[], cfg)!;
    say("QA104-OBS-READ-SAMEBYTES-RENAME", { before, after, d });
    expect(after.ino, "plant: a new object").not.toBe(before.ino);
  });
});
