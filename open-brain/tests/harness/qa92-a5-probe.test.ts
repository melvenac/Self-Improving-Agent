/**
 * QA PROBE, NOT FOR MERGE. Loop 15 slice three, QA record session 92, scoring candidate A5 4c1287f.
 * v3 (QA 94): the two route prints are optional, because A6 removed recordChain; nothing else changed.
 *
 * POSIX-only (file and relative directory symlinks are EPERM on this seat's win32 machine). Siblings of A4-1 that
 * R55's route walk may not reach, read from configwatch.ts at 4c1287f before any run:
 *
 *   routeChain -> linkTargetAnchor: a RELATIVE link target is anchored at the link's own directory, and
 *   lexicalPaths(anchor, dest) returns no segments when relative(anchor, dest) starts with "..". So a link whose
 *   relative target climbs OUT of its own directory (GNU stow writes exactly these: ../../dotfiles/...) contributes
 *   only its directory to the route; the object it leads to is not on the route at all. Predicted at A5:
 *     - an in-place edit of the base target (R55's allowed read) is NOT hashed, and a role's append through the
 *       link is not reported (CA-4f);
 *     - a swapped target is not read, and NOT REPORTED either (R55: "on any difference ... report it").
 *   At A4 the lexical chain ended at the link itself, so snap read through it: the edit was hashed and a swapped
 *   final target was read (A4-1's class).
 *
 * Every test prints a QA92-... line with what it saw, so the CI log carries the observation whichever way an
 * assertion goes. Each asserts its own plant. Controls: the relative-DOWNWARD and absolute link-to-link shapes.
 */
import { describe, it, expect, beforeAll, beforeEach, afterEach } from "vitest";
import { createHash } from "node:crypto";
import {
  appendFileSync, linkSync, lstatSync, mkdirSync, readFileSync, readlinkSync, renameSync, symlinkSync, unlinkSync,
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
const say = (tag: string, o: unknown) => console.log(`${tag} ${JSON.stringify(o)}`);

describe("QA 92 probe (not for merge): R55 route siblings on POSIX", { timeout: 120_000 }, () => {
  let repo: RepoFixture;
  let tmp: { dir: string; cleanup: () => Promise<void> };
  beforeAll(() => requireGit());
  beforeEach(() => {
    repo = makeRepo("qa92-probe-");
    tmp = scratch("qa92-probe-out-");
  });
  afterEach(async () => {
    await repo.cleanup();
    await tmp.cleanup();
  });

  /** HOME/.gitconfig -> ../<n>-dot/gitconfig: a relative target that climbs out of HOME. */
  const stowGlobal = (n: string) => {
    const home = join(tmp.dir, `${n}-home`);
    const dot = join(tmp.dir, `${n}-dot`);
    mkdirSync(home);
    mkdirSync(dot);
    const target = join(dot, "gitconfig");
    writeFileSync(target, "[user]\n\tname = stow-base\n");
    const cfg = join(home, ".gitconfig");
    symlinkSync(join("..", `${n}-dot`, "gitconfig"), cfg);
    expect(lstatSync(cfg).isSymbolicLink(), "plant: .gitconfig is a symlink").toBe(true);
    expect(readlinkSync(cfg).startsWith(".."), "plant: its target is relative and climbs out").toBe(true);
    expect(readFileSync(cfg, "utf-8"), "plant: the link resolves to the target").toBe("[user]\n\tname = stow-base\n");
    return { home, dot, target, cfg };
  };

  /** $XDG/git -> ../<n>-dotgit: a relative DIRECTORY link at an intermediate position that climbs out of XDG. */
  const stowXdgDir = (n: string) => {
    const xdg = join(tmp.dir, `${n}-xdg`);
    const dotgit = join(tmp.dir, `${n}-dotgit`);
    mkdirSync(xdg);
    mkdirSync(dotgit);
    const target = join(dotgit, "config");
    writeFileSync(target, "[user]\n\tname = stow-xdg-base\n");
    symlinkSync(join("..", `${n}-dotgit`), join(xdg, "git"));
    const cfg = join(xdg, "git", "config");
    expect(lstatSync(join(xdg, "git")).isSymbolicLink(), "plant: $XDG/git is a symlink").toBe(true);
    expect(readFileSync(cfg, "utf-8"), "plant: the path resolves to the target").toBe("[user]\n\tname = stow-xdg-base\n");
    return { xdg, dotgit, target, cfg };
  };

  /** $XDG/git/config -> ../../<n>-dotfiles/git/config: stow's own shape for a nested file. */
  const stowXdgFile = (n: string) => {
    const xdg = join(tmp.dir, `${n}-xdg`);
    const dotfiles = join(tmp.dir, `${n}-dotfiles`, "git");
    mkdirSync(join(xdg, "git"), { recursive: true });
    mkdirSync(dotfiles, { recursive: true });
    const target = join(dotfiles, "config");
    writeFileSync(target, "[user]\n\tname = stow-xdgfile-base\n");
    const cfg = join(xdg, "git", "config");
    symlinkSync(join("..", "..", `${n}-dotfiles`, "git", "config"), cfg);
    expect(lstatSync(cfg).isSymbolicLink(), "plant: $XDG/git/config is a symlink").toBe(true);
    expect(readFileSync(cfg, "utf-8"), "plant: the link resolves to the target").toBe("[user]\n\tname = stow-xdgfile-base\n");
    return { xdg, target, cfg };
  };

  it.skipIf(isWin)("STOW-CTL: a stow link's target edited in place is hashed (R55's allowed read)", () => {
    const { target, cfg } = stowGlobal("sctl");
    const watch = new MachineConfigWatch([{ scope: "global", path: cfg, source: "qa92" }]);
    watch.captureBase();
    const notes = watch.baseNotes();
    watch.begin("developer");
    const edited = "[user]\n\tname = stow-edited-in-place\n";
    writeFileSync(target, edited);
    const found = watch.compare();
    say("QA92-STOW-CTL", { link: readlinkSync(cfg), expectHash: h16(edited), inRecord: JSON.stringify(found).includes(h16(edited)), found, notes });
    expect(JSON.stringify(found), "the in-place edit's hash reaches the record").toContain(h16(edited));
  });

  it.skipIf(isWin)("STOW-H: a stow link's target swapped for a hard link to an outside file is not read, and is reported", () => {
    const { target, cfg } = stowGlobal("sh");
    const watch = new MachineConfigWatch([{ scope: "global", path: cfg, source: "qa92" }]);
    watch.begin("developer");
    const victim = join(tmp.dir, "sh-victim");
    writeFileSync(victim, "[user]\n\tname = VICTIM-STOW-H\n");
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
    say("QA92-STOW-H", { hv, hv2, inRecord: { hv: blob.includes(hv), hv2: blob.includes(hv2) }, devFindings: dev.length, qaFindings: qa.length, dev, qa });
    expect(blob, "the outside file's hash is in the record").not.toContain(hv);
    expect(blob, "the outside file's qa hash is in the record").not.toContain(hv2);
    expect(dev.length, "R55: the changed object is reported in the stage that changed it").toBeGreaterThan(0);
  });

  it.skipIf(isWin)("XDGDIR-CTL: an in-place edit beyond a relative directory link that climbs out is hashed", () => {
    const { target, cfg } = stowXdgDir("dctl");
    const watch = new MachineConfigWatch([{ scope: "xdg", path: cfg, source: "qa92" }]);
    watch.begin("developer");
    const edited = "[user]\n\tname = xdgdir-edited\n";
    writeFileSync(target, edited);
    const found = watch.compare();
    say("QA92-XDGDIR-CTL", { expectHash: h16(edited), inRecord: JSON.stringify(found).includes(h16(edited)), found });
    expect(JSON.stringify(found)).toContain(h16(edited));
  });

  it.skipIf(isWin)("XDGDIR-H: a hard link swapped in beyond a relative directory link is not read, and is reported", () => {
    const { target, cfg } = stowXdgDir("dh");
    const watch = new MachineConfigWatch([{ scope: "xdg", path: cfg, source: "qa92" }]);
    watch.begin("developer");
    const victim = join(tmp.dir, "dh-victim");
    writeFileSync(victim, "[user]\n\tname = VICTIM-XDGDIR-H\n");
    const hv = h16(readFileSync(victim));
    unlinkSync(target);
    linkSync(victim, target);
    expect(lstatSync(target).nlink, "plant: nlink 2").toBe(2);
    const dev = watch.compare();
    const blob = JSON.stringify(dev);
    say("QA92-XDGDIR-H", { hv, inRecord: blob.includes(hv), devFindings: dev.length, dev });
    expect(blob).not.toContain(hv);
    expect(dev.length, "the changed object is reported").toBeGreaterThan(0);
  });

  it.skipIf(isWin)("XDGFILE-CTL: stow's nested-file shape ($XDG/git/config -> ../../dotfiles/git/config), edited in place, is hashed", () => {
    const { target, cfg } = stowXdgFile("fctl");
    const watch = new MachineConfigWatch([{ scope: "xdg", path: cfg, source: "qa92" }]);
    watch.begin("developer");
    const edited = "[user]\n\tname = xdgfile-edited\n";
    writeFileSync(target, edited);
    const found = watch.compare();
    say("QA92-XDGFILE-CTL", { link: readlinkSync(cfg), expectHash: h16(edited), inRecord: JSON.stringify(found).includes(h16(edited)), found });
    expect(JSON.stringify(found)).toContain(h16(edited));
  });

  it.skipIf(isWin)("DOWN-CTL (known negative for the shape): a relative target that stays below its directory, edited in place, is hashed", () => {
    const home = join(tmp.dir, "down-home");
    mkdirSync(join(home, "dot"), { recursive: true });
    const target = join(home, "dot", "gitconfig");
    writeFileSync(target, "[user]\n\tname = down-base\n");
    const cfg = join(home, ".gitconfig");
    symlinkSync(join("dot", "gitconfig"), cfg);
    expect(lstatSync(cfg).isSymbolicLink()).toBe(true);
    const watch = new MachineConfigWatch([{ scope: "global", path: cfg, source: "qa92" }]);
    watch.begin("developer");
    const edited = "[user]\n\tname = down-edited\n";
    writeFileSync(target, edited);
    const found = watch.compare();
    say("QA92-DOWN-CTL", { expectHash: h16(edited), inRecord: JSON.stringify(found).includes(h16(edited)), found });
    expect(JSON.stringify(found)).toContain(h16(edited));
  });

  it.skipIf(isWin)("ABS2: an absolute link to a link, both at base; the second link repointed is not read and is reported; an in-place edit is hashed", () => {
    const home = join(tmp.dir, "abs2-home");
    const mid = join(tmp.dir, "abs2-mid");
    const dot = join(tmp.dir, "abs2-dot");
    mkdirSync(home); mkdirSync(mid); mkdirSync(dot);
    const target = join(dot, "gitconfig");
    writeFileSync(target, "[user]\n\tname = abs2-base\n");
    const link2 = join(mid, "gitconfig");
    symlinkSync(target, link2);
    const cfg = join(home, ".gitconfig");
    symlinkSync(link2, cfg);
    expect(lstatSync(cfg).isSymbolicLink() && lstatSync(link2).isSymbolicLink(), "plant: two links").toBe(true);
    const watch = new MachineConfigWatch([{ scope: "global", path: cfg, source: "qa92" }]);
    watch.begin("developer");
    const edited = "[user]\n\tname = abs2-edited\n";
    writeFileSync(target, edited);
    const ctl = watch.compare();
    watch.begin("qa");
    const victim = join(tmp.dir, "abs2-victim");
    writeFileSync(victim, "[user]\n\tname = VICTIM-ABS2\n");
    const hv = h16(readFileSync(victim));
    unlinkSync(link2);
    symlinkSync(victim, link2);
    const qa = watch.compare();
    say("QA92-ABS2", { ctlInRecord: JSON.stringify(ctl).includes(h16(edited)), ctl, victimInRecord: JSON.stringify(qa).includes(hv), qaFindings: qa.length, qa });
    expect(JSON.stringify(ctl)).toContain(h16(edited));
    expect(JSON.stringify(qa)).not.toContain(hv);
    expect(qa.length).toBeGreaterThan(0);
  });

  /**
   * v2 (added after the first A5 run, win32 finding r35anchorEdit): routeChain builds `rest` cumulatively
   * (relative(paths[i], p) for every later p) and joins them all, so a link with TWO OR MORE components after it
   * yields a doubled path (<dest>/git/git/config). Two Linux shapes of that mechanism, absolute targets only.
   */
  it.skipIf(isWin)("ANCHOR-EDIT: $XDG_CONFIG_HOME itself a symlink at base (absolute); git/config edited in place is hashed", () => {
    const realXdg = join(tmp.dir, "anc-real-xdg");
    mkdirSync(join(realXdg, "git"), { recursive: true });
    const target = join(realXdg, "git", "config");
    writeFileSync(target, "[user]\n\tname = anchor-base\n");
    const xdg = join(tmp.dir, "anc-xdg");
    symlinkSync(realXdg, xdg);
    const cfg = join(xdg, "git", "config");
    expect(lstatSync(xdg).isSymbolicLink(), "plant: $XDG_CONFIG_HOME is a symlink").toBe(true);
    expect(readFileSync(cfg, "utf-8")).toBe("[user]\n\tname = anchor-base\n");
    const watch = new MachineConfigWatch([{ scope: "xdg", path: cfg, source: "qa92" }]);
    watch.begin("developer");
    const edited = "[user]\n\tname = anchor-edited\n";
    writeFileSync(target, edited);
    const found = watch.compare();
    const route = (typeof (watch as any).recordChain === "function" ? ((watch as any).recordChain(cfg) as Array<{ kind: string; path: string }>).slice(-3).map((c) => `${c.kind} ${c.path}`) : ["recordChain absent at this candidate"]);
    say("QA92-ANCHOR-EDIT", { expectHash: h16(edited), inRecord: JSON.stringify(found).includes(h16(edited)), found, routeTail: route });
    expect(JSON.stringify(found)).toContain(h16(edited));
  });

  it.skipIf(isWin)("VIADIR-EDIT: ~/.gitconfig -> an absolute target through a symlinked directory with two components after it; an in-place edit is hashed", () => {
    const real = join(tmp.dir, "via-real");
    mkdirSync(join(real, "sub"), { recursive: true });
    const target = join(real, "sub", "gitconfig");
    writeFileSync(target, "[user]\n\tname = via-base\n");
    const lnk = join(tmp.dir, "via-lnk");
    symlinkSync(real, lnk);
    const home = join(tmp.dir, "via-home");
    mkdirSync(home);
    const cfg = join(home, ".gitconfig");
    symlinkSync(join(lnk, "sub", "gitconfig"), cfg);
    expect(lstatSync(cfg).isSymbolicLink() && lstatSync(lnk).isSymbolicLink(), "plant: two links").toBe(true);
    expect(readFileSync(cfg, "utf-8")).toBe("[user]\n\tname = via-base\n");
    const watch = new MachineConfigWatch([{ scope: "global", path: cfg, source: "qa92" }]);
    watch.begin("developer");
    const edited = "[user]\n\tname = via-edited\n";
    writeFileSync(target, edited);
    const found = watch.compare();
    const route = (typeof (watch as any).recordChain === "function" ? ((watch as any).recordChain(cfg) as Array<{ kind: string; path: string }>).slice(-3).map((c) => `${c.kind} ${c.path}`) : ["recordChain absent at this candidate"]);
    say("QA92-VIADIR-EDIT", { expectHash: h16(edited), inRecord: JSON.stringify(found).includes(h16(edited)), found, routeTail: route });
    expect(JSON.stringify(found)).toContain(h16(edited));
  });

  /** CA-4f's own probe shape through runLoop: a role appends to ~/.gitconfig, which is a stow link at base. */
  it.skipIf(isWin)("STOW-LOOP: CA-4f through runLoop: the developer appends through a stow link at base; the write is reported with both hashes", async () => {
    const { home, target, cfg } = stowGlobal("sloop");
    const xdg = join(tmp.dir, "sloop-xdg");
    mkdirSync(xdg);
    const system = join(tmp.dir, "sloop-system.gitconfig");
    writeFileSync(system, "");
    const env: NodeJS.ProcessEnv = { ...process.env, HOME: home, USERPROFILE: home, XDG_CONFIG_HOME: xdg, GIT_CONFIG_SYSTEM: system };
    delete env.GIT_CONFIG_GLOBAL;
    const baseHash = h16(readFileSync(target));
    let afterHash = "";
    const cfgLoop: LoopConfig = {
      repoRoot: repo.root, loop: "t001", env,
      roles: {
        planner: new StubPlanner(),
        developer: { role: "developer", run: async (ctx) => { const d = await new StubDeveloper().run(ctx); appendFileSync(cfg, "[user]\n\tname = role-append\n"); afterHash = h16(readFileSync(target)); return d; } },
        qa: new StubQa(),
      },
      checks: exitingChecks(0, 0),
      log: () => {},
    };
    const r = await runLoop(cfgLoop);
    const mine = r.machineConfigFindings.filter((f) => f.path === cfg);
    const notes = r.findings.filter((f) => f.includes("link at base"));
    say("QA92-STOW-LOOP", { status: r.status, failure: r.failure?.code ?? null, baseHash, afterHash, findings: mine, notes, targetHasAppend: readFileSync(target, "utf-8").includes("role-append") });
    expect(readFileSync(target, "utf-8"), "plant: the append reached the target").toContain("role-append");
    expect(mine.length, "CA-4f: the write is reported").toBe(1);
    expect(mine[0]?.stage).toBe("developer");
    expect(mine[0]?.before).toBe(baseHash);
    expect(mine[0]?.after).toBe(afterHash);
  });
});
