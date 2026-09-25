/**
 * QA PROBE, NOT FOR MERGE. Loop 15 slice three, QA record session 99, candidate A8 9e2dd5d.
 *
 * The seam (QA 94's, as the developer's configwatch-a7-seam.test.ts uses): wrap node:fs openSync; on the first open of
 * the watched path, act, then perform the real open. At 9e2dd5d the handle check is
 * `!st.isFile() || st.dev !== dev || st.ino !== ino || Number(st.nlink) !== nlink` against the pre-open stat (R70).
 *
 *   R70-APPEARED-NLINK   absent at base; a single-name file appears (R69 would read it) and gains a second name
 *                        inside open. R70: not read.
 *   R70-HANDLE-FACTS     the "handle is a different file" record: does it carry R68's facts?
 *   GAP-PARENT-SWAP      (R37's named limit, rulings-15 R70: recorded, not scored.) Inside open, the parent directory
 *                        is swapped for a link to a directory holding a DIFFERENT single-name file. Read?
 *   GAP-OBJECT-MOVED     (the same limit.) Inside open, the gated object is moved to another directory and the
 *                        parent swapped for a link to it: the same dev/ino, one name, a different parent realpath.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { createHash } from "node:crypto";

const seam = vi.hoisted(() => ({ target: "", act: null as null | (() => void), fired: 0 }));
vi.mock("node:fs", async (importOriginal) => {
  const m = await importOriginal<typeof import("node:fs")>();
  const openSync = ((...a: Parameters<typeof m.openSync>) => {
    if (seam.act && String(a[0]) === seam.target) {
      const act = seam.act;
      seam.act = null;
      seam.fired++;
      act();
    }
    return m.openSync(...a);
  }) as typeof m.openSync;
  return { ...m, default: { ...m, openSync }, openSync };
});

import { linkSync, lstatSync, mkdirSync, mkdtempSync, realpathSync, renameSync, rmSync, statSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { MachineConfigWatch } from "../../src/harness/configwatch.js";

const isWin = process.platform === "win32";
const h16 = (b: Buffer | string) => createHash("sha256").update(b).digest("hex").slice(0, 16);
const say = (tag: string, o: unknown) => console.log(`${tag} ${JSON.stringify(o, (_k, v) => (typeof v === "bigint" ? String(v) : v))}`);
const dirLink = (target: string, at: string) => symlinkSync(target, at, isWin ? "junction" : "dir");

describe("QA 99 seam (not for merge): R70 and R37's gap at A8", { timeout: 60_000 }, () => {
  let dir: string;
  beforeEach(() => {
    dir = realpathSync(mkdtempSync(join(tmpdir(), "qa99-seam-")));
    seam.target = "";
    seam.act = null;
    seam.fired = 0;
  });
  afterEach(() => {
    seam.act = null;
    rmSync(dir, { recursive: true, force: true });
  });

  it("R70-APPEARED-NLINK: absent at base; the appeared single-name file gains a second name inside open: not read", () => {
    const cfg = join(dir, ".gitconfig");
    const watch = new MachineConfigWatch([{ scope: "global", path: cfg, source: "qa99" }]);
    watch.captureBase();
    watch.begin("developer");
    const body = "[user]\n\tname = appeared-then-linked-in-open\n";
    writeFileSync(cfg, body);
    const pre = statSync(cfg).nlink;
    seam.target = cfg;
    seam.act = () => linkSync(cfg, join(dir, "second-name"));
    const found = watch.compare();
    const blob = JSON.stringify(found);
    say("QA99-R70-APPEARED-NLINK", { fired: seam.fired, pre, post: statSync(cfg).nlink, read: blob.includes(h16(body)), found });
    expect(seam.fired, "plant: the seam fired inside open").toBe(1);
    expect(pre, "plant: one name before open").toBe(1);
    expect(statSync(cfg).nlink, "plant: two names at the handle").toBe(2);
    expect(blob, "R70: nlink re-checked on the handle").not.toContain(h16(body));
  });

  it("R70-APPEARED-CONTROL: the same appearance with no act inside open is read", () => {
    const cfg = join(dir, ".gitconfig");
    const watch = new MachineConfigWatch([{ scope: "global", path: cfg, source: "qa99" }]);
    watch.captureBase();
    watch.begin("developer");
    const body = "[user]\n\tname = appeared-control\n";
    writeFileSync(cfg, body);
    const found = watch.compare();
    say("QA99-R70-APPEARED-CONTROL", { found });
    expect(JSON.stringify(found)).toContain(h16(body));
  });

  it("R70-HANDLE-FACTS: the handle record (a second name inside open) carries the R68 facts", () => {
    const cfg = join(dir, ".gitconfig");
    writeFileSync(cfg, "[user]\n\tname = hf-base\n");
    const watch = new MachineConfigWatch([{ scope: "global", path: cfg, source: "qa99" }]);
    watch.captureBase();
    watch.begin("developer");
    writeFileSync(`${cfg}.new`, "[user]\n\tname = hf-new\n");
    renameSync(`${cfg}.new`, cfg);
    seam.target = cfg;
    seam.act = () => linkSync(cfg, join(dir, "hf-second"));
    const found = watch.compare();
    const ino = String(statSync(cfg, { bigint: true }).ino);
    const row = found.find((f) => f.path === cfg)!;
    say("QA99-R70-HANDLE-FACTS", { ino, row });
    expect(seam.fired).toBe(1);
    expect(row.after, "the handle reason").toContain("handle is a different file");
    expect(row.after, "R68: the facts").toContain(ino);
  });

  it("GAP-PARENT-SWAP (R37 limit, recorded): parent swapped inside open for a link to a dir holding a DIFFERENT file", () => {
    const xdg = join(dir, "xdg");
    const gitDir = join(xdg, "git");
    mkdirSync(gitDir, { recursive: true });
    const cfg = join(gitDir, "config");
    const watch = new MachineConfigWatch([{ scope: "xdg", path: cfg, source: "qa99" }]);
    watch.captureBase();
    watch.begin("developer");
    writeFileSync(cfg, "[user]\n\tname = gap-own\n");
    const elsewhere = join(dir, "elsewhere");
    mkdirSync(elsewhere);
    const secret = "[user]\n\tname = VICTIM-GAP-SWAP\n";
    writeFileSync(join(elsewhere, "config"), secret);
    seam.target = cfg;
    seam.act = () => {
      renameSync(gitDir, join(xdg, "git-old"));
      dirLink(elsewhere, gitDir);
    };
    const found = watch.compare();
    const blob = JSON.stringify(found);
    say("QA99-GAP-PARENT-SWAP", { fired: seam.fired, parentIsLink: lstatSync(gitDir).isSymbolicLink(), victimRead: blob.includes(h16(secret)), found });
    expect(seam.fired).toBe(1);
    expect(blob, "the handle's dev/ino differ: not read").not.toContain(h16(secret));
  });

  it("GAP-OBJECT-MOVED (R37 limit, recorded): the gated object moved out and its new directory linked in, inside open", () => {
    const xdg = join(dir, "xdg");
    const gitDir = join(xdg, "git");
    mkdirSync(gitDir, { recursive: true });
    const cfg = join(gitDir, "config");
    const watch = new MachineConfigWatch([{ scope: "xdg", path: cfg, source: "qa99" }]);
    watch.captureBase();
    watch.begin("developer");
    const body = "[user]\n\tname = gap-moved\n";
    writeFileSync(cfg, body);
    const elsewhere = join(dir, "elsewhere");
    mkdirSync(elsewhere);
    seam.target = cfg;
    seam.act = () => {
      renameSync(cfg, join(elsewhere, "config"));
      renameSync(gitDir, join(xdg, "git-old"));
      dirLink(elsewhere, gitDir);
    };
    const found = watch.compare();
    const blob = JSON.stringify(found);
    say("QA99-GAP-OBJECT-MOVED", { fired: seam.fired, read: blob.includes(h16(body)), nlink: statSync(cfg).nlink, found });
    expect(seam.fired).toBe(1);
  });
});
