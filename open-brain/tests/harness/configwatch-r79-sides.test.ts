/**
 * R79. A side prints everything the runtime has. Placeholders do not stand alone.
 * Rows from QA 104 that this ruling must turn green.
 */
import { describe, it, expect, beforeAll, beforeEach, afterEach } from "vitest";
import { chmodSync, linkSync, lstatSync, mkdirSync, readFileSync, renameSync, symlinkSync, unlinkSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { MachineConfigWatch } from "../../src/harness/configwatch.js";
import { requireGit } from "./fixture.js";
import { scratch } from "./candidate-a-fixture.js";

const isWin = process.platform === "win32";
const facts = (p: string) => {
  const s = lstatSync(p, { bigint: true });
  return { ino: String(s.ino), nlink: String(s.nlink) };
};
const eaccesOn = (p: string) => {
  try { readFileSync(p); return false; } catch (e) { return (e as NodeJS.ErrnoException).code === "EACCES"; }
};

describe("R79 sides carry what the runtime has", () => {
  let tmp: { dir: string; cleanup: () => Promise<void> };
  beforeAll(() => requireGit());
  beforeEach(() => { tmp = scratch("r79-"); });
  afterEach(async () => { await tmp.cleanup(); });

  const one = (path: string) => new MachineConfigWatch([{ scope: "global", path, source: "r79" }]);
  const home = (name: string) => {
    const h = join(tmp.dir, name);
    mkdirSync(h);
    return join(h, ".gitconfig");
  };

  it.skipIf(isWin)("R72-BEFORE-BARE-READ: unreadable at stage start, then edited: before carries the facts", () => {
    const cfg = home("bbr");
    writeFileSync(cfg, "[user]\n\tname = bbr\n");
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
    const q = watch.compare().find((x) => x.path === cfg)!;
    expect(eacces, "plant").toBe(true);
    expect(q.changed, "a change").toBe(true);
    expect(q.before, "unreadable").toContain("unreadable");
    expect(q.before, "stage-start ino").toContain(`ino ${start.ino}`);
  });

  it.skipIf(isWin)("R72-BEFORE-BARE-TWONAME: unreadable at stage start, then a two-name file: before carries the facts", () => {
    const cfg = home("bbt");
    writeFileSync(cfg, "[user]\n\tname = bbt\n");
    const watch = one(cfg);
    watch.captureBase();
    watch.begin("developer");
    chmodSync(cfg, 0o000);
    watch.compare();
    const start = facts(cfg);
    watch.begin("qa");
    writeFileSync(`${cfg}.new`, "[user]\n\tname = bbt-two\n");
    renameSync(`${cfg}.new`, cfg);
    linkSync(cfg, join(tmp.dir, "bbt-second"));
    const q = watch.compare().find((x) => x.path === cfg)!;
    expect(facts(cfg).nlink, "plant").toBe("2");
    expect(q.before, "stage-start ino").toContain(`ino ${start.ino}`);
  });

  it.skipIf(isWin)("R72-BEFORE-BARE-LINK: unreadable at stage start, then a symlink: before carries the facts", () => {
    const cfg = home("bbl");
    writeFileSync(cfg, "[user]\n\tname = bbl\n");
    const watch = one(cfg);
    watch.captureBase();
    watch.begin("developer");
    chmodSync(cfg, 0o000);
    watch.compare();
    const start = facts(cfg);
    watch.begin("qa");
    const elsewhere = join(tmp.dir, "bbl-elsewhere");
    writeFileSync(elsewhere, "[user]\n\tname = elsewhere\n");
    unlinkSync(cfg);
    symlinkSync(elsewhere, cfg);
    const q = watch.compare().find((x) => x.path === cfg)!;
    expect(q.before, "stage-start ino").toContain(`ino ${start.ino}`);
  });

  it.skipIf(isWin)("R73-DANGLING-STABLE: a dangling symlink untouched carries the link's lstat facts", () => {
    const cfg = home("dgl");
    symlinkSync(join(tmp.dir, "dgl-missing"), cfg);
    const f = facts(cfg);
    const watch = one(cfg);
    watch.captureBase();
    watch.begin("developer");
    const d = watch.compare().find((x) => x.path === cfg)!;
    expect(d.changed, "no change").toBe(false);
    expect(d.after, "the link's ino").toContain(f.ino);
  });

  it("R73-ABSENT-BEFORE-CODE: absent at stage start, then a hard link: before names ENOENT and the base is not zeroed", () => {
    const cfg = home("abc");
    const watch = one(cfg);
    watch.captureBase();
    watch.begin("developer");
    watch.compare();
    watch.begin("qa");
    const outside = join(tmp.dir, "abc-outside");
    writeFileSync(outside, "[user]\n\tname = abc\n");
    linkSync(outside, cfg);
    const q = watch.compare().find((x) => x.path === cfg)!;
    expect(q.changed, "a change").toBe(true);
    expect(q.before, "ENOENT").toContain("ENOENT");
    expect(q.after, "no zeroed loop base").not.toContain("dev null");
    expect(q.after, "absent at loop base").toContain("absent at loop base");
  });
});
