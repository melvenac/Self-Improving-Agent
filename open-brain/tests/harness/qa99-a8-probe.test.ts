/**
 * QA PROBE, NOT FOR MERGE. Loop 15 slice three, QA record session 99, scoring candidate A8 9e2dd5d.
 *
 * Read from configwatch.ts at 9e2dd5d (blob db75d772) before any run:
 * - observe(): R69's `appeared` = gate absent at base (resolvedPath null) AND kind file AND nlink 1 AND lstat of the
 *   path as written is a file AND basename(realpath) === basename(path) AND parent realpath (non-null) equals the
 *   parent realpath at base. A symlink planted at the path returns "type change" earlier, independently.
 * - The handle re-check compares dev, ino, type AND nlink with the pre-open stat (R70).
 * - compare(): sameId now includes size and mtimeNs (R68). `stageBefore(opened)` writes "before" from the STAGE START
 *   (hash; "unreadable"; "absent"; or `type … dev … ino … nlink … size … mtimeNs …`) (R71).
 * - The stable unread entry (sameId true) is still `not read: <reason>` / `unreadable` / `unwatched: …`, with no
 *   facts; the changed "unreadable" entry is `unreadable` on both sides.
 *
 * Rulings-15: R68 (an unread machine path carries type, dev, ino, nlink, size, mtimeNs "in its stage record and its
 * attribution"; an in-place write to it is a change, "not read", with both sets of facts); R69 (absent at base may be
 * read once it appears iff parent realpath equal, name unchanged, regular file with nlink 1; re-checked on the
 * handle); R70; R71 (stage-start facts as "before"; "unreadable" never "absent"; no two identical placeholder sides).
 *
 * Every test prints a QA99-... line with what it saw and asserts its own plant first. Assertions state the RULING; a
 * red test here is an observation to be read with its printed line, not a verdict by itself. Tests named OBS-... assert
 * only their plant and print the behaviour.
 */
import { describe, it, expect, beforeAll, beforeEach, afterEach } from "vitest";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  appendFileSync, chmodSync, existsSync, linkSync, lstatSync, mkdirSync, readFileSync, renameSync, statSync, symlinkSync,
  unlinkSync, utimesSync, writeFileSync,
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
const facts = (p: string) => {
  const s = lstatSync(p, { bigint: true });
  return { dev: String(s.dev), ino: String(s.ino), nlink: String(s.nlink), size: String(s.size), mtimeNs: String(s.mtimeNs) };
};
type F = { stage: string; path: string; before: string; after: string };
/** Findings whose two sides differ: what runtime.ts writes as a change line (it skips before === after). */
const changes = (fs: F[]) => fs.filter((f) => f.before !== f.after);
/** A directory link: a junction on win32 (no privilege needed), a symlink elsewhere. */
const dirLink = (target: string, at: string) => symlinkSync(target, at, isWin ? "junction" : "dir");

describe("QA 99 probe (not for merge): R68-R71 at A8", { timeout: 120_000 }, () => {
  let repo: RepoFixture;
  let tmp: { dir: string; cleanup: () => Promise<void> };
  beforeAll(() => requireGit());
  beforeEach(() => {
    repo = makeRepo("qa99-probe-");
    tmp = scratch("qa99-probe-out-");
  });
  afterEach(async () => {
    await repo.cleanup();
    await tmp.cleanup();
  });

  const one = (path: string, scope: "global" | "xdg" = "global") => new MachineConfigWatch([{ scope, path, source: "qa99" }]);
  const home = (name: string) => {
    const h = join(tmp.dir, name);
    mkdirSync(h);
    return { h, cfg: join(h, ".gitconfig") };
  };

  // ------------------------------------------------------------------ R69: what appears is read, and its edges ----
  it("R69-GITCONFIG-FIRST: no ~/.gitconfig at base; developer `git config --global`; qa appends: both hashes", async () => {
    const { h, cfg } = home("gcf-home");
    const xdg = join(tmp.dir, "gcf-xdg");
    mkdirSync(xdg);
    const system = join(tmp.dir, "gcf-system.gitconfig");
    writeFileSync(system, "");
    const env: NodeJS.ProcessEnv = { ...process.env, HOME: h, USERPROFILE: h, XDG_CONFIG_HOME: xdg, GIT_CONFIG_SYSTEM: system };
    delete env.GIT_CONFIG_GLOBAL;
    let devHash = "";
    let qaHash = "";
    let devFacts: Record<string, string> = {};
    let qaFacts: Record<string, string> = {};
    const cfgLoop: LoopConfig = {
      repoRoot: repo.root, loop: "t001", env,
      roles: {
        planner: new StubPlanner(),
        developer: { role: "developer", run: async (ctx) => {
          const d = await new StubDeveloper().run(ctx);
          execFileSync("git", ["config", "--global", "user.email", "qa99@example.invalid"], { env, cwd: h });
          devFacts = facts(cfg);
          devHash = h16(readFileSync(cfg));
          return d;
        } },
        qa: { role: "qa", run: async (ctx) => {
          appendFileSync(cfg, "[core]\n\tqa99 = appended-in-place\n");
          qaFacts = facts(cfg);
          qaHash = h16(readFileSync(cfg));
          return new StubQa().run(ctx);
        } },
      },
      checks: exitingChecks(0, 0),
      log: () => {},
    };
    const r = await runLoop(cfgLoop);
    const mine = r.machineConfigFindings.filter((x) => x.path === cfg);
    const dev = mine.find((f) => f.stage === "developer");
    const qa = mine.find((f) => f.stage === "qa");
    const lines = r.findings.filter((l) => l.includes(cfg));
    say("QA99-R69-GITCONFIG-FIRST", { status: r.status, devFacts, qaFacts, devHash, qaHash, mine, lines });
    expect(devFacts.nlink, "plant: git config left one name").toBe("1");
    expect(qaFacts.ino, "plant: the qa append is in place").toBe(devFacts.ino);
    expect(qaFacts.size, "plant: the size moved").not.toBe(devFacts.size);
    expect(r.status).toBe("completed");
    expect(dev, "developer entry").toBeDefined();
    expect(dev!.before, "R71: absent at the developer stage's start").toBe("absent");
    expect(dev!.after, "R69: the created file is read").toBe(devHash);
    expect(qa, "qa entry").toBeDefined();
    expect(qa!.before, "R69/CA-4f: qa before = the developer's bytes").toBe(devHash);
    expect(qa!.after, "R69/CA-4f: qa after = the appended bytes").toBe(qaHash);
    expect(lines.some((l) => l.includes("the developer stage")), "a developer line").toBe(true);
    expect(lines.some((l) => l.includes("the qa stage")), "a qa line").toBe(true);
  });

  it("R69-HARDLINK-APPEAR: absent at base; an outside file hard-linked in (nlink 2): not read, reported with facts", () => {
    const { cfg } = home("hla-home");
    const watch = one(cfg);
    watch.captureBase();
    watch.begin("developer");
    const outside = join(tmp.dir, "hla-outside");
    const secret = "[user]\n\tname = VICTIM-HLA\n";
    writeFileSync(outside, secret);
    linkSync(outside, cfg);
    const f = facts(cfg);
    const found = watch.compare();
    const blob = JSON.stringify(found);
    say("QA99-R69-HARDLINK-APPEAR", { facts: f, found });
    expect(f.nlink, "plant: two names").toBe("2");
    expect(blob, "R69: nlink 2 is not read").not.toContain(h16(secret));
    expect(changes(found).length, "reported").toBeGreaterThan(0);
    expect(blob, "R68: facts ino").toContain(f.ino);
    expect(blob, "R68: facts size").toContain(`size ${f.size}`);
    expect(blob, "R68: facts mtimeNs").toContain(f.mtimeNs);
  });

  it("R69-CREATED-THEN-LINKED: absent at base; the role creates the file, then gives it a second name: not read", () => {
    const { cfg } = home("ctl-home");
    const watch = one(cfg);
    watch.captureBase();
    watch.begin("developer");
    const body = "[user]\n\tname = ctl-own\n";
    writeFileSync(cfg, body);
    linkSync(cfg, join(tmp.dir, "ctl-second"));
    const found = watch.compare();
    const blob = JSON.stringify(found);
    say("QA99-R69-CREATED-THEN-LINKED", { nlink: statSync(cfg).nlink, found });
    expect(statSync(cfg).nlink, "plant: two names").toBe(2);
    expect(blob, "R69: nlink 2 is not read").not.toContain(h16(body));
    expect(changes(found).length, "reported").toBeGreaterThan(0);
  });

  it("R69-SYMLINK-APPEAR-SAMENAME: absent at base; a symlink at the name to another dir's .gitconfig: not read", () => {
    const { cfg } = home("sas-home");
    const other = join(tmp.dir, "sas-other");
    mkdirSync(other);
    const target = join(other, ".gitconfig");
    const secret = "[user]\n\tname = VICTIM-SAS\n";
    writeFileSync(target, secret);
    const watch = one(cfg);
    watch.captureBase();
    watch.begin("developer");
    symlinkSync(target, cfg, "file");
    const found = watch.compare();
    const blob = JSON.stringify(found);
    say("QA99-R69-SYMLINK-APPEAR-SAMENAME", { lstatLink: lstatSync(cfg).isSymbolicLink(), targetNlink: statSync(target).nlink, found });
    expect(lstatSync(cfg).isSymbolicLink(), "plant: a symlink at the name").toBe(true);
    expect(statSync(target).nlink, "plant: the target has one name").toBe(1);
    expect(blob, "R69: a symlink is not read").not.toContain(h16(secret));
    expect(changes(found).length, "reported").toBeGreaterThan(0);
  });

  it("R69-SYMLINK-APPEAR-OTHERNAME: absent at base; a symlink at the name to a differently named file: not read", () => {
    const { cfg } = home("sao-home");
    const target = join(tmp.dir, "sao-victim");
    const secret = "[user]\n\tname = VICTIM-SAO\n";
    writeFileSync(target, secret);
    const watch = one(cfg);
    watch.captureBase();
    watch.begin("developer");
    symlinkSync(target, cfg, "file");
    const found = watch.compare();
    const blob = JSON.stringify(found);
    say("QA99-R69-SYMLINK-APPEAR-OTHERNAME", { found });
    expect(lstatSync(cfg).isSymbolicLink(), "plant").toBe(true);
    expect(blob, "R69: a symlink is not read").not.toContain(h16(secret));
    expect(changes(found).length, "reported").toBeGreaterThan(0);
  });

  it("R69-PARENT-LINK-XDG: xdg/git is a dir at base with no config; it is replaced by a dir link to elsewhere/config: not read", () => {
    const xdg = join(tmp.dir, "plx-xdg");
    const gitDir = join(xdg, "git");
    mkdirSync(gitDir, { recursive: true });
    const cfg = join(gitDir, "config");
    const elsewhere = join(tmp.dir, "plx-elsewhere");
    mkdirSync(elsewhere);
    const secret = "[user]\n\tname = VICTIM-PLX\n";
    writeFileSync(join(elsewhere, "config"), secret);
    const watch = one(cfg, "xdg");
    watch.captureBase();
    watch.begin("developer");
    renameSync(gitDir, join(xdg, "git-old"));
    dirLink(elsewhere, gitDir);
    const found = watch.compare();
    const blob = JSON.stringify(found);
    say("QA99-R69-PARENT-LINK-XDG", { parentIsLink: lstatSync(gitDir).isSymbolicLink(), nlink: statSync(cfg).nlink, found });
    expect(lstatSync(gitDir).isSymbolicLink(), "plant: the parent is a link").toBe(true);
    expect(statSync(cfg).nlink, "plant: a single-name file at the name").toBe(1);
    expect(blob, "R69: parent realpath differs, not read").not.toContain(h16(secret));
    expect(changes(found).length, "reported").toBeGreaterThan(0);
  });

  it("R69-PARENT-LINK-HOME: HOME is a dir at base with no .gitconfig; HOME is replaced by a dir link to elsewhere: not read", () => {
    const { h, cfg } = home("plh-home");
    const elsewhere = join(tmp.dir, "plh-elsewhere");
    mkdirSync(elsewhere);
    const secret = "[user]\n\tname = VICTIM-PLH\n";
    writeFileSync(join(elsewhere, ".gitconfig"), secret);
    const watch = one(cfg);
    watch.captureBase();
    watch.begin("developer");
    renameSync(h, join(tmp.dir, "plh-home-old"));
    dirLink(elsewhere, h);
    const found = watch.compare();
    const blob = JSON.stringify(found);
    say("QA99-R69-PARENT-LINK-HOME", { parentIsLink: lstatSync(h).isSymbolicLink(), found });
    expect(lstatSync(h).isSymbolicLink(), "plant: HOME is a link").toBe(true);
    expect(statSync(cfg).nlink, "plant").toBe(1);
    expect(blob, "R69: parent realpath differs, not read").not.toContain(h16(secret));
    expect(changes(found).length, "reported").toBeGreaterThan(0);
  });

  it("R69-RENAMED-CASE: absent at base; a file whose on-disk name differs from the watched name (case) resolves at it: not read", () => {
    const { h, cfg } = home("rnc-home");
    const watch = one(cfg);
    watch.captureBase();
    watch.begin("developer");
    const secret = "[user]\n\tname = RENAMED-CASE\n";
    writeFileSync(join(h, ".GITCONFIG"), secret);
    const insensitive = existsSync(cfg);
    const found = watch.compare();
    const blob = JSON.stringify(found);
    say("QA99-R69-RENAMED-CASE", { insensitive, found });
    if (!insensitive) {
      // Case-sensitive FS: `.GITCONFIG` is not at the watched name at all. Nothing to measure.
      expect(blob).not.toContain(h16(secret));
      return;
    }
    expect(blob, "R69: the name is not unchanged, not read").not.toContain(h16(secret));
    expect(changes(found).length, "reported").toBeGreaterThan(0);
  });

  it.skipIf(isWin)("R69-FIFO-APPEAR: absent at base; a FIFO appears at the name: not opened, not read, no hang", () => {
    const { cfg } = home("fifo-home");
    const watch = one(cfg);
    watch.captureBase();
    watch.begin("developer");
    execFileSync("mkfifo", [cfg]);
    const found = watch.compare();
    say("QA99-R69-FIFO-APPEAR", { isFifo: lstatSync(cfg).isFIFO(), found });
    expect(lstatSync(cfg).isFIFO(), "plant").toBe(true);
    expect(JSON.stringify(found), "R69: not a regular file").toContain("not read");
  });

  it("OBS-R69-RENAMED-INTO-PLACE: absent at base; written under another name and renamed to .gitconfig (git's own way)", () => {
    const { cfg } = home("rip-home");
    const watch = one(cfg);
    watch.captureBase();
    watch.begin("developer");
    const body = "[user]\n\tname = renamed-into-place\n";
    writeFileSync(`${cfg}.lock`, body);
    renameSync(`${cfg}.lock`, cfg);
    const found = watch.compare();
    say("QA99-OBS-R69-RENAMED-INTO-PLACE", { read: JSON.stringify(found).includes(h16(body)), found });
    expect(statSync(cfg).nlink).toBe(1);
  });

  it("OBS-R69-PARENT-NEWDIR: xdg/git replaced by a NEW real directory at the same path (realpath equal), config created", () => {
    const xdg = join(tmp.dir, "pnd-xdg");
    const gitDir = join(xdg, "git");
    mkdirSync(gitDir, { recursive: true });
    const cfg = join(gitDir, "config");
    const baseDirIno = String(statSync(gitDir, { bigint: true }).ino);
    const watch = one(cfg, "xdg");
    watch.captureBase();
    watch.begin("developer");
    renameSync(gitDir, join(xdg, "git-old"));
    mkdirSync(gitDir);
    const body = "[user]\n\tname = pnd-new-dir\n";
    writeFileSync(cfg, body);
    const found = watch.compare();
    say("QA99-OBS-R69-PARENT-NEWDIR", { baseDirIno, nowDirIno: String(statSync(gitDir, { bigint: true }).ino), read: JSON.stringify(found).includes(h16(body)), found });
    expect(lstatSync(gitDir).isDirectory(), "plant: a real directory").toBe(true);
  });

  it("OBS-R69-PARENT-ABSENT-AT-BASE: no xdg/git at base; the role creates xdg/git/config", () => {
    const xdg = join(tmp.dir, "pab-xdg");
    mkdirSync(xdg);
    const cfg = join(xdg, "git", "config");
    const watch = one(cfg, "xdg");
    watch.captureBase();
    watch.begin("developer");
    mkdirSync(join(xdg, "git"));
    const body = "[user]\n\tname = pab\n";
    writeFileSync(cfg, body);
    const found = watch.compare();
    say("QA99-OBS-R69-PARENT-ABSENT-AT-BASE", { read: JSON.stringify(found).includes(h16(body)), changes: changes(found).length, found });
    expect(statSync(cfg).nlink).toBe(1);
  });

  it("OBS-R69-MOVE-IN-ABSENT: absent at base; an outside single-name file renamed into the path", () => {
    const { cfg } = home("mia-home");
    const watch = one(cfg);
    watch.captureBase();
    watch.begin("developer");
    const outside = join(tmp.dir, "mia-outside");
    const secret = "[user]\n\tname = OUTSIDE-MOVED-IN-ABSENT\n";
    writeFileSync(outside, secret);
    renameSync(outside, cfg);
    const found = watch.compare();
    say("QA99-OBS-R69-MOVE-IN-ABSENT", { read: JSON.stringify(found).includes(h16(secret)), found });
    expect(existsSync(outside)).toBe(false);
  });

  it("R69-APPEARED-THEN-LINKED-LATER: created in developer (read); qa adds a name elsewhere and appends: not read, reported", () => {
    const { cfg } = home("atl-home");
    const watch = one(cfg);
    watch.captureBase();
    watch.begin("developer");
    const body = "[user]\n\tname = atl-dev\n";
    writeFileSync(cfg, body);
    const dev = watch.compare();
    watch.begin("qa");
    linkSync(cfg, join(tmp.dir, "atl-elsewhere"));
    appendFileSync(cfg, "[core]\n\tqa99 = atl-later\n");
    const later = h16(readFileSync(cfg));
    const f = facts(cfg);
    const qa = watch.compare();
    const q = qa.find((x) => x.path === cfg);
    say("QA99-R69-APPEARED-THEN-LINKED-LATER", { dev, qa, facts: f });
    expect(JSON.stringify(dev), "R69: the created file read in developer").toContain(h16(body));
    expect(f.nlink, "plant").toBe("2");
    expect(JSON.stringify(qa), "R69: nlink 2, not read").not.toContain(later);
    expect(q && q.before !== q.after, "reported as a change").toBe(true);
    expect(q!.after, "R68: current facts").toContain(`size ${f.size}`);
  });

  // ------------------------------------------------------------------ R68: facts on every unread record -----------
  const twoNameAtDeveloper = (name: string) => {
    const { cfg } = home(`${name}-home`);
    writeFileSync(cfg, `[user]\n\tname = ${name}-base\n`);
    const watch = one(cfg);
    watch.captureBase();
    watch.begin("developer");
    writeFileSync(`${cfg}.new`, `[user]\n\tname = ${name}-two-names\n`);
    renameSync(`${cfg}.new`, cfg);
    linkSync(cfg, join(tmp.dir, `${name}-second`));
    const dev = watch.compare();
    return { cfg, watch, dev };
  };

  it("R68-STABLE-UNREAD: a two-name (unread) path untouched in qa: the qa stage record carries the R68 facts", () => {
    const { cfg, watch, dev } = twoNameAtDeveloper("su");
    const f = facts(cfg);
    watch.begin("qa");
    const qa = watch.compare();
    const q = qa.find((x) => x.path === cfg);
    say("QA99-R68-STABLE-UNREAD", { dev, qa, facts: f });
    expect(f.nlink, "plant").toBe("2");
    expect(q, "one entry").toBeDefined();
    expect(q!.after, "not read").toContain("not read");
    expect(q!.after, "R68: ino in the stage record").toContain(f.ino);
    expect(q!.after, "R68: size in the stage record").toContain(`size ${f.size}`);
    expect(q!.after, "R68: mtimeNs in the stage record").toContain(f.mtimeNs);
  });

  it("R68-TWO-NAME-LATER-FACTS: an in-place write to the unread two-name file: both fact sets, each with its size", () => {
    const { cfg, watch } = twoNameAtDeveloper("tnf");
    const start = facts(cfg);
    watch.begin("qa");
    appendFileSync(cfg, "[core]\n\tqa99 = tnf-later\n");
    const end = facts(cfg);
    const qa = watch.compare();
    const q = qa.find((x) => x.path === cfg);
    say("QA99-R68-TWO-NAME-LATER-FACTS", { start, end, q });
    expect(end.ino, "plant: in place").toBe(start.ino);
    expect(q && q.before !== q.after, "R68: a change").toBe(true);
    expect(q!.before, "R71: before = the stage-start facts").toContain(`size ${start.size}`);
    expect(q!.after, "R68: the current facts").toContain(`size ${end.size}`);
    expect(q!.before, "R68: type in 'before'").toMatch(/type file/);
    expect(q!.after, "R68: type in 'after'").toMatch(/type file/);
  });

  // Each R68 fact on its own: integer-second mtimes are set with utimesSync, so they compare exactly.
  const pinned = (name: string) => {
    const { cfg, watch } = twoNameAtDeveloper(name);
    utimesSync(cfg, 1_700_000_000, 1_700_000_000);
    return { cfg, watch };
  };

  it("R68-SIZE-ONLY: an in-place append to an unread file, its mtime put back exactly: the size difference is a change", () => {
    const { cfg, watch } = pinned("so");
    const start = facts(cfg);
    watch.begin("qa");
    appendFileSync(cfg, "[core]\n\tqa99 = size-only\n");
    utimesSync(cfg, 1_700_000_000, 1_700_000_000);
    const end = facts(cfg);
    const q = watch.compare().find((x) => x.path === cfg);
    say("QA99-R68-SIZE-ONLY", { start, end, q });
    expect(end.mtimeNs, "plant: mtime put back").toBe(start.mtimeNs);
    expect(end.size, "plant: size moved").not.toBe(start.size);
    expect(end.ino, "plant: in place").toBe(start.ino);
    expect(q && q.before !== q.after, "R68: size alone is a change").toBe(true);
  });

  it("R68-MTIME-ONLY: a same-size in-place overwrite of an unread file with a new mtime: a change", () => {
    const { cfg, watch } = pinned("mo");
    const start = facts(cfg);
    const len = readFileSync(cfg).length;
    watch.begin("qa");
    writeFileSync(cfg, "X".repeat(len), { flag: "r+" });
    utimesSync(cfg, 1_700_000_010, 1_700_000_010);
    const end = facts(cfg);
    const q = watch.compare().find((x) => x.path === cfg);
    say("QA99-R68-MTIME-ONLY", { start, end, q });
    expect(end.size, "plant: same size").toBe(start.size);
    expect(end.mtimeNs, "plant: mtime moved").not.toBe(start.mtimeNs);
    expect(end.ino, "plant: in place").toBe(start.ino);
    expect(q && q.before !== q.after, "R68: mtime alone is a change").toBe(true);
  });

  it("R68-NOT-A-FILE: a directory at the path at base (not read): every stage record carries the facts", () => {
    const { cfg } = home("naf-home");
    mkdirSync(cfg);
    const f = facts(cfg);
    const watch = one(cfg);
    watch.captureBase();
    watch.begin("developer");
    const dev = watch.compare();
    const d = dev.find((x) => x.path === cfg);
    say("QA99-R68-NOT-A-FILE", { facts: f, dev });
    expect(d!.after, "not read").toContain("not read");
    expect(d!.after, "R68: ino").toContain(f.ino);
  });

  it.skipIf(isWin)("R68-UNREADABLE-LATER: mode 0200 at qa's start, appended in qa: a change, with facts", () => {
    const { cfg } = home("ul-home");
    writeFileSync(cfg, "[user]\n\tname = ul-base\n");
    const watch = one(cfg);
    watch.captureBase();
    watch.begin("developer");
    chmodSync(cfg, 0o200);
    let eacces = false;
    try { readFileSync(cfg); } catch (e) { eacces = (e as NodeJS.ErrnoException).code === "EACCES"; }
    const dev = watch.compare();
    const start = facts(cfg);
    watch.begin("qa");
    appendFileSync(cfg, "[core]\n\tqa99 = ul-later\n");
    const end = facts(cfg);
    const qa = watch.compare();
    chmodSync(cfg, 0o644);
    const q = qa.find((x) => x.path === cfg);
    say("QA99-R68-UNREADABLE-LATER", { eacces, dev, qa, start, end });
    expect(eacces, "plant: EACCES (not root)").toBe(true);
    expect(end.size, "plant: the append landed").not.toBe(start.size);
    expect(q && q.before !== q.after, "R68: an in-place write to an unread path is a change (never silent)").toBe(true);
  });

  it.skipIf(isWin)("R68-UNREADABLE-STABLE: mode 000 at base, untouched: the record says unreadable, with the facts", () => {
    const { cfg } = home("us-home");
    writeFileSync(cfg, "[user]\n\tname = us-base\n");
    chmodSync(cfg, 0o000);
    const f = facts(cfg);
    const watch = one(cfg);
    watch.captureBase();
    watch.begin("developer");
    const dev = watch.compare();
    chmodSync(cfg, 0o644);
    const d = dev.find((x) => x.path === cfg);
    say("QA99-R68-UNREADABLE-STABLE", { facts: f, dev });
    expect(d!.after, "R71: unreadable").toContain("unreadable");
    expect(d!.after, "R68: ino in the record").toContain(f.ino);
  });

  // ------------------------------------------------------------------ R71: true texts ----------------------------
  it.skipIf(isWin)("R71-UNREADABLE-START: unreadable at qa's start, made readable and edited in qa: before 'unreadable'", () => {
    const { cfg } = home("uls-home");
    const baseBody = "[user]\n\tname = uls-base\n";
    writeFileSync(cfg, baseBody);
    const watch = one(cfg);
    watch.captureBase();
    watch.begin("developer");
    chmodSync(cfg, 0o000);
    watch.compare();
    watch.begin("qa");
    chmodSync(cfg, 0o644);
    writeFileSync(cfg, "[user]\n\tname = uls-qa\n");
    const qa = watch.compare();
    const q = qa.find((x) => x.path === cfg);
    say("QA99-R71-UNREADABLE-START", { baseHash: h16(baseBody), qa });
    expect(q!.before, "R71: a failed read says unreadable").toBe("unreadable");
  });

  it.skipIf(isWin)("R71-UNREADABLE-AT-BASE: mode 000 at base, made readable and edited in developer: never 'absent'", () => {
    const { cfg } = home("uab-home");
    writeFileSync(cfg, "[user]\n\tname = uab-base\n");
    chmodSync(cfg, 0o000);
    const watch = one(cfg);
    watch.captureBase();
    watch.begin("developer");
    chmodSync(cfg, 0o644);
    writeFileSync(cfg, "[user]\n\tname = uab-dev\n");
    const dev = watch.compare();
    const d = dev.find((x) => x.path === cfg);
    say("QA99-R71-UNREADABLE-AT-BASE", { dev });
    expect(d!.before, "R71: never absent").not.toBe("absent");
    expect(d!.before, "R71: unreadable").toBe("unreadable");
  });

  it("R71-BASE-LABEL: TWO-NAME at qa's start (loop base was a different, read file): the text labelled 'base' is the loop base", () => {
    const { cfg } = home("bl-home");
    writeFileSync(cfg, "[user]\n\tname = bl-base\n");
    const baseFacts = facts(cfg);
    const watch = one(cfg);
    watch.captureBase();
    watch.begin("developer");
    writeFileSync(`${cfg}.new`, "[user]\n\tname = bl-two\n");
    renameSync(`${cfg}.new`, cfg);
    linkSync(cfg, join(tmp.dir, "bl-second"));
    watch.compare();
    const startFacts = facts(cfg);
    watch.begin("qa");
    appendFileSync(cfg, "[core]\n\tqa99 = bl\n");
    const qa = watch.compare();
    const q = qa.find((x) => x.path === cfg)!;
    const baseSeg = /not read: base (.*?); current/.exec(q.after)?.[1] ?? "";
    say("QA99-R71-BASE-LABEL", { baseFacts, startFacts, after: q.after, baseSeg });
    expect(baseFacts.ino, "plant: base and stage start are different objects").not.toBe(startFacts.ino);
    expect(baseSeg, "R71: the facts labelled 'base' are the loop base's").toContain(`ino ${baseFacts.ino}`);
  });
});
