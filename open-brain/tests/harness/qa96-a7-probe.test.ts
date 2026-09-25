/**
 * QA PROBE, NOT FOR MERGE. Loop 15 slice three, QA record session 96, scoring candidate A7 d223d1d.
 *
 * Read from configwatch.ts at d223d1d (blob e2334c4f) before any run:
 * - MachineConfigWatch.observe(): realpath + stat; READ only if the realpath equals base's AND (same dev/ino/kind as
 *   base, OR a file with nlink 1). Then openSync + fstat: the handle must match the pre-open stat's dev/ino (nlink is
 *   NOT re-checked on the handle).
 * - A path ABSENT at base has base.resolvedPath null, so a file created there later fails condition 1: never read.
 * - MachineSnap carries no size or mtimeNs. compare()'s sameId() is (lexicalKind, resolvedPath, kind, dev, ino,
 *   nlink): an in-place write to an UNREAD machine path during a stage leaves sameId true, and the stage's entry is
 *   the stable `not read: <reason>` with before === after, which runtime.ts skips as "no change".
 * - compare(): when the stage's START was not read, "before" is written from the LOOP BASE (base.hash, "absent" or
 *   `type:<kind>`), not from the stage's start.
 *
 * Rulings-14: R64 (an unread side compares type, dev, ino, nlink, size, mtimeNs; any difference is a change,
 * reported "not read" with both sets of facts); R65 (every watched path in every stage record in exactly one state;
 * "not read, with the reason and the R64 facts"; "unreadable" never "absent"; a stage whose start was not read shows
 * its stage-start facts as "before", never the loop base's hash); R67 / D-042 (the read gate).
 *
 * Every test prints a QA96-... line with what it saw, and asserts its own plant. Assertions state the RULING; a red
 * test here is an observation to be read with its printed line, not a verdict by itself.
 */
import { describe, it, expect, beforeAll, beforeEach, afterEach } from "vitest";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  appendFileSync, chmodSync, linkSync, lstatSync, mkdirSync, readFileSync, renameSync, statSync, unlinkSync,
  writeFileSync,
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
/** Findings whose two sides differ: what runtime.ts writes as a change line (it skips before === after). */
const changes = (fs: { before: string; after: string }[]) => fs.filter((f) => f.before !== f.after);

describe("QA 96 probe (not for merge): R64/R65 on the machine side, and D-042's trade", { timeout: 120_000 }, () => {
  let repo: RepoFixture;
  let tmp: { dir: string; cleanup: () => Promise<void> };
  beforeAll(() => requireGit());
  beforeEach(() => {
    repo = makeRepo("qa96-probe-");
    tmp = scratch("qa96-probe-out-");
  });
  afterEach(async () => {
    await repo.cleanup();
    await tmp.cleanup();
  });

  const one = (path: string) => new MachineConfigWatch([{ scope: "global", path, source: "qa96" }]);

  // ---------------------------------------------------------------- R64 / R65 on the machine side ----------------
  it("ABSENT-BASE-UNIT: absent at base, created in developer, appended IN PLACE in qa: the qa write is a change", () => {
    const home = join(tmp.dir, "abu-home");
    mkdirSync(home);
    const cfg = join(home, ".gitconfig");
    const watch = one(cfg);
    watch.captureBase();
    watch.begin("developer");
    writeFileSync(cfg, "[user]\n\temail = abu@example.invalid\n");
    const dev = watch.compare();
    const atQaStart = facts(cfg);
    watch.begin("qa");
    appendFileSync(cfg, "[core]\n\tqa96 = appended-in-place\n");
    const atQaEnd = facts(cfg);
    const qa = watch.compare();
    say("QA96-ABSENT-BASE-UNIT", { dev, qa, atQaStart, atQaEnd, qaChanges: changes(qa).length });
    expect(atQaEnd.ino, "plant: in place (same inode)").toBe(atQaStart.ino);
    expect(atQaEnd.size, "plant: the size moved").not.toBe(atQaStart.size);
    expect(changes(dev).length, "the creation is reported in developer").toBeGreaterThan(0);
    expect(changes(qa).length, "R64: size/mtime differ on an unread side, so the qa write is a change").toBeGreaterThan(0);
  });

  it("ABSENT-BASE-LOOP: no ~/.gitconfig at base; developer runs `git config --global`; qa appends in place", async () => {
    const home = join(tmp.dir, "abl-home");
    mkdirSync(home);
    const globalCfg = join(home, ".gitconfig");
    const xdg = join(tmp.dir, "abl-xdg");
    mkdirSync(xdg);
    const system = join(tmp.dir, "abl-system.gitconfig");
    writeFileSync(system, "");
    const env: NodeJS.ProcessEnv = { ...process.env, HOME: home, USERPROFILE: home, XDG_CONFIG_HOME: xdg, GIT_CONFIG_SYSTEM: system };
    delete env.GIT_CONFIG_GLOBAL;
    let qaHash = "";
    let devFacts: Record<string, string> = {};
    let qaFacts: Record<string, string> = {};
    const cfgLoop: LoopConfig = {
      repoRoot: repo.root, loop: "t001", env,
      roles: {
        planner: new StubPlanner(),
        developer: { role: "developer", run: async (ctx) => {
          const d = await new StubDeveloper().run(ctx);
          execFileSync("git", ["config", "--global", "user.email", "qa96@example.invalid"], { env, cwd: home });
          devFacts = facts(globalCfg);
          return d;
        } },
        qa: { role: "qa", run: async (ctx) => {
          appendFileSync(globalCfg, "[core]\n\tqa96 = appended-in-place\n");
          qaFacts = facts(globalCfg);
          qaHash = h16(readFileSync(globalCfg));
          return new StubQa().run(ctx);
        } },
      },
      checks: exitingChecks(0, 0),
      log: () => {},
    };
    const r = await runLoop(cfgLoop);
    const byStage: Record<string, string[]> = {};
    for (const f of r.machineConfigFindings.filter((x) => x.path === globalCfg)) (byStage[f.stage] ??= []).push(`${f.before} -> ${f.after}`);
    const lines = r.findings.filter((l) => l.includes(globalCfg));
    say("QA96-ABSENT-BASE-LOOP", { status: r.status, failure: r.failure?.code ?? null, devFacts, qaFacts, byStage, lines, qaHash, qaHashInRecord: JSON.stringify(r).includes(qaHash) });
    expect(readFileSync(globalCfg, "utf-8"), "plant: git config created the file").toContain("qa96@example.invalid");
    expect(qaFacts.ino, "plant: the qa append is in place").toBe(devFacts.ino);
    expect(qaFacts.size, "plant: and it changed the size").not.toBe(devFacts.size);
    expect(lines.some((l) => l.includes("the developer stage")), "CA-4f: the developer's write is a reported line").toBe(true);
    expect(lines.some((l) => l.includes("the qa stage")), "CA-4f never silent / R64: the qa stage's in-place write is a reported line").toBe(true);
  });

  it("TWO-NAME-LATER: the path replaced by a new two-name file (not read, R67), then appended in place in qa", () => {
    const home = join(tmp.dir, "tnl-home");
    mkdirSync(home);
    const cfg = join(home, ".gitconfig");
    writeFileSync(cfg, "[user]\n\tname = tnl-base\n");
    const watch = one(cfg);
    watch.captureBase();
    watch.begin("developer");
    const mine = join(tmp.dir, "tnl-second-name");
    writeFileSync(`${cfg}.new`, "[user]\n\tname = tnl-two-names\n");
    renameSync(`${cfg}.new`, cfg);
    linkSync(cfg, mine);
    const dev = watch.compare();
    const atQaStart = facts(cfg);
    watch.begin("qa");
    appendFileSync(cfg, "[core]\n\tqa96 = appended-in-place\n");
    const atQaEnd = facts(cfg);
    const qa = watch.compare();
    say("QA96-TWO-NAME-LATER", { dev, qa, atQaStart, atQaEnd });
    expect(atQaStart.nlink, "plant: two names").toBe("2");
    expect(atQaEnd.ino, "plant: in place").toBe(atQaStart.ino);
    expect(JSON.stringify(dev), "R67: a new two-name file is not read").not.toContain(h16("[user]\n\tname = tnl-two-names\n"));
    expect(changes(qa).length, "R64: the in-place write to the unread file is a change").toBeGreaterThan(0);
  });

  it.skipIf(isWin)("WRITEONLY-LATER: mode 0200 in developer (unreadable, writable), appended in qa", () => {
    const home = join(tmp.dir, "wol-home");
    mkdirSync(home);
    const cfg = join(home, ".gitconfig");
    writeFileSync(cfg, "[user]\n\tname = wol-base\n");
    const watch = one(cfg);
    watch.captureBase();
    watch.begin("developer");
    chmodSync(cfg, 0o200);
    let eacces = false;
    try { readFileSync(cfg); } catch (e) { eacces = (e as NodeJS.ErrnoException).code === "EACCES"; }
    const dev = watch.compare();
    const atQaStart = facts(cfg);
    watch.begin("qa");
    appendFileSync(cfg, "[core]\n\tqa96 = appended-write-only\n");
    const atQaEnd = facts(cfg);
    const qa = watch.compare();
    chmodSync(cfg, 0o644);
    say("QA96-WRITEONLY-LATER", { eacces, dev, qa, atQaStart, atQaEnd });
    expect(eacces, "plant: EACCES on a direct read (not root)").toBe(true);
    expect(atQaEnd.size, "plant: the append landed").not.toBe(atQaStart.size);
    expect(changes(qa).length, "R64: the write to the unreadable file is a change").toBeGreaterThan(0);
  });

  it("R65-FACTS: a machine path that is NOT READ carries the reason and the R64 facts in every stage record", () => {
    const home = join(tmp.dir, "rf-home");
    mkdirSync(home);
    const cfg = join(home, ".gitconfig");
    const watch = one(cfg);
    watch.captureBase();
    watch.begin("developer");
    writeFileSync(cfg, "[user]\n\temail = rf@example.invalid\n");
    watch.compare();
    const f = facts(cfg);
    watch.begin("qa");
    const qa = watch.compare();
    const blob = JSON.stringify(qa);
    say("QA96-R65-FACTS", { facts: f, qa });
    expect(qa.filter((x) => x.path === cfg).length, "R65: exactly one entry for the path in the qa record").toBe(1);
    expect(blob, "R65: not read").toContain("not read");
    expect(blob, "R65/R64: ino").toContain(f.ino);
    expect(blob, "R65/R64: size").toContain(`size ${f.size}`);
    expect(blob, "R65/R64: mtimeNs").toContain(f.mtimeNs);
  });

  it("R65-EVERY-LOOP: runLoop, three paths (read / absent / empty file), no act: each path once in every stage", async () => {
    const home = join(tmp.dir, "rel-home");
    mkdirSync(home);
    const globalCfg = join(home, ".gitconfig");
    writeFileSync(globalCfg, "[user]\n\tname = rel-base\n");
    const xdg = join(tmp.dir, "rel-xdg");
    mkdirSync(xdg);
    const system = join(tmp.dir, "rel-system.gitconfig");
    writeFileSync(system, "");
    const env: NodeJS.ProcessEnv = { ...process.env, HOME: home, USERPROFILE: home, XDG_CONFIG_HOME: xdg, GIT_CONFIG_SYSTEM: system };
    delete env.GIT_CONFIG_GLOBAL;
    const r = await runLoop({
      repoRoot: repo.root, loop: "t001", env,
      roles: { planner: new StubPlanner(), developer: new StubDeveloper(), qa: new StubQa() },
      checks: exitingChecks(0, 0), log: () => {},
    });
    const paths = [globalCfg, join(xdg, "git", "config"), system];
    const stages = [...new Set(r.machineConfigFindings.map((f) => f.stage))];
    const count: Record<string, number> = {};
    for (const f of r.machineConfigFindings) count[`${f.stage} ${f.path}`] = (count[`${f.stage} ${f.path}`] ?? 0) + 1;
    say("QA96-R65-EVERY-LOOP", { status: r.status, stages, count, findings: r.machineConfigFindings, changeLines: r.findings.filter((l) => l.startsWith("machine-wide")) });
    expect(r.status).toBe("completed");
    expect(stages.length, "at least one stage recorded").toBeGreaterThan(0);
    for (const s of stages) for (const p of paths) expect(count[`${s} ${p}`], `R65: ${s} ${p} exactly once`).toBe(1);
    expect(r.findings.filter((l) => l.startsWith("machine-wide")), "no act, no change line").toEqual([]);
  });

  it("STAGE-START-UNREAD: qa's start is a two-name file (not read); qa removes the second name, so the end is read", () => {
    const home = join(tmp.dir, "ssu-home");
    mkdirSync(home);
    const cfg = join(home, ".gitconfig");
    const baseBody = "[user]\n\tname = ssu-base\n";
    writeFileSync(cfg, baseBody);
    const watch = one(cfg);
    watch.captureBase();
    watch.begin("developer");
    const second = join(tmp.dir, "ssu-second");
    writeFileSync(`${cfg}.new`, "[user]\n\tname = ssu-two-names\n");
    renameSync(`${cfg}.new`, cfg);
    linkSync(cfg, second);
    const dev = watch.compare();
    const atQaStart = facts(cfg);
    watch.begin("qa");
    unlinkSync(second);
    const qa = watch.compare();
    const q = qa.find((f) => f.path === cfg);
    say("QA96-STAGE-START-UNREAD", { baseHash: h16(baseBody), dev, qa, atQaStart });
    expect(atQaStart.nlink, "plant: two names at qa's start").toBe("2");
    expect(q, "the path is in the qa record").toBeDefined();
    expect(q!.before, "R65: a stage whose start was not read never shows the loop base's hash as 'before'").not.toBe(h16(baseBody));
  });

  // ---------------------------------------------------------------- D-042's trade, dispatch 2(c) -----------------
  it("TRADE-LOCKRENAME: a lock-and-rename (new single-name file at the same real path) is read, both hashes", () => {
    const home = join(tmp.dir, "tlr-home");
    mkdirSync(home);
    const cfg = join(home, ".gitconfig");
    const baseBody = "[user]\n\tname = tlr-base\n";
    writeFileSync(cfg, baseBody);
    const watch = one(cfg);
    watch.captureBase();
    const baseIno = statSync(cfg).ino;
    watch.begin("developer");
    const nb = "[user]\n\tname = tlr-renamed-over\n";
    writeFileSync(`${cfg}.lock`, nb);
    renameSync(`${cfg}.lock`, cfg);
    const found = watch.compare();
    say("QA96-TRADE-LOCKRENAME", { found, baseIno: String(baseIno), nowIno: String(statSync(cfg).ino) });
    expect(statSync(cfg).ino, "plant: a new inode").not.toBe(baseIno);
    expect(found.some((f) => f.before === h16(baseBody) && f.after === h16(nb)), "D-042: both hashes").toBe(true);
  });

  it("TRADE-HARDLINK-ELSEWHERE: a hard link to the base file made elsewhere does not stop reads (two stages)", () => {
    const home = join(tmp.dir, "the-home");
    mkdirSync(home);
    const cfg = join(home, ".gitconfig");
    writeFileSync(cfg, "[user]\n\tname = the-base\n");
    const watch = one(cfg);
    watch.captureBase();
    watch.begin("developer");
    linkSync(cfg, join(repo.root, "the-elsewhere"));
    const dev = watch.compare();
    watch.begin("qa");
    appendFileSync(cfg, "[core]\n\tqa96 = the-later\n");
    const later = h16(readFileSync(cfg));
    const qa = watch.compare();
    say("QA96-TRADE-HARDLINK-ELSEWHERE", { dev, qa, later });
    expect(statSync(cfg).nlink, "plant: two names").toBe(2);
    expect(JSON.stringify(qa), "D-042: the base object is read whatever its nlink").toContain(later);
  });

  it("TRADE-NEW-TWO-NAME: a new file with two names at the same real path is not read, and is reported", () => {
    const home = join(tmp.dir, "tntn-home");
    mkdirSync(home);
    const cfg = join(home, ".gitconfig");
    writeFileSync(cfg, "[user]\n\tname = tntn-base\n");
    const watch = one(cfg);
    watch.captureBase();
    watch.begin("developer");
    const outside = join(tmp.dir, "tntn-outside");
    const secret = "[user]\n\tname = VICTIM-TNTN\n";
    writeFileSync(outside, secret);
    unlinkSync(cfg);
    linkSync(outside, cfg);
    const found = watch.compare();
    const blob = JSON.stringify(found);
    say("QA96-TRADE-NEW-TWO-NAME", { found, nlink: statSync(cfg).nlink });
    expect(statSync(cfg).nlink, "plant: two names").toBe(2);
    expect(blob, "D-042: not read").not.toContain(h16(secret));
    expect(changes(found).length, "reported").toBeGreaterThan(0);
  });

  it("THIRD-MOVE-IN: an outside file RENAMED into the path (one name, same real path) — observation", () => {
    const home = join(tmp.dir, "tmi-home");
    mkdirSync(home);
    const cfg = join(home, ".gitconfig");
    writeFileSync(cfg, "[user]\n\tname = tmi-base\n");
    const watch = one(cfg);
    watch.captureBase();
    watch.begin("developer");
    const outside = join(tmp.dir, "tmi-outside-file");
    const secret = "[user]\n\tname = OUTSIDE-MOVED-IN\n";
    writeFileSync(outside, secret);
    renameSync(outside, cfg);
    const found = watch.compare();
    const blob = JSON.stringify(found);
    say("QA96-THIRD-MOVE-IN", { read: blob.includes(h16(secret)), found });
    expect(statSync(cfg).nlink, "plant: one name").toBe(1);
  });

  it("THIRD-LINK-UNLINK: link(outside, path) then unlink(outside): the outside object at the path with one name — observation", () => {
    const home = join(tmp.dir, "tlu-home");
    mkdirSync(home);
    const cfg = join(home, ".gitconfig");
    writeFileSync(cfg, "[user]\n\tname = tlu-base\n");
    const watch = one(cfg);
    watch.captureBase();
    watch.begin("developer");
    const outside = join(tmp.dir, "tlu-outside-file");
    const secret = "[user]\n\tname = OUTSIDE-LINK-UNLINK\n";
    writeFileSync(outside, secret);
    unlinkSync(cfg);
    linkSync(outside, cfg);
    unlinkSync(outside);
    const found = watch.compare();
    const blob = JSON.stringify(found);
    say("QA96-THIRD-LINK-UNLINK", { read: blob.includes(h16(secret)), found });
    expect(statSync(cfg).nlink, "plant: one name").toBe(1);
  });

  it("BASE-TWO-NAME: a file already hard-linked at base is read at base and after an in-place edit (control)", () => {
    const home = join(tmp.dir, "btn-home");
    mkdirSync(home);
    const cfg = join(home, ".gitconfig");
    writeFileSync(cfg, "[user]\n\tname = btn-base\n");
    linkSync(cfg, join(tmp.dir, "btn-other-name"));
    const watch = one(cfg);
    watch.captureBase();
    watch.begin("developer");
    writeFileSync(cfg, "[user]\n\tname = btn-edited\n");
    const found = watch.compare();
    say("QA96-BASE-TWO-NAME", { found });
    expect(JSON.stringify(found), "D-042: the base file, nlink ignored").toContain(h16("[user]\n\tname = btn-edited\n"));
  });
});
