/**
 * R80. The gained-name and lost-name texts do not say "different file".
 * The loop base is labelled `loop base`. Type-change and absent-to-symlink texts carry facts.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
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

import { appendFileSync, linkSync, lstatSync, mkdirSync, mkdtempSync, realpathSync, renameSync, rmSync, statSync, symlinkSync, unlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { MachineConfigWatch } from "../../src/harness/configwatch.js";

const isWin = process.platform === "win32";
const h16 = (b: string) => createHash("sha256").update(b).digest("hex").slice(0, 16);

describe("R80 true words", () => {
  let dir: string;
  beforeEach(() => {
    dir = realpathSync(mkdtempSync(join(tmpdir(), "r80-")));
    seam.target = "";
    seam.act = null;
    seam.fired = 0;
  });
  afterEach(() => {
    seam.act = null;
    rmSync(dir, { recursive: true, force: true });
  });

  it("R74-GAINED-BASE: the base object gains a name inside open, and the text does not say different file", () => {
    const cfg = join(dir, ".gitconfig");
    const body = "[user]\n\tname = gained-base\n";
    writeFileSync(cfg, body);
    const watch = new MachineConfigWatch([{ scope: "global", path: cfg, source: "r80" }]);
    watch.captureBase();
    watch.begin("developer");
    seam.target = cfg;
    seam.act = () => linkSync(cfg, join(dir, "second"));
    const row = watch.compare().find((f) => f.path === cfg)!;
    expect(seam.fired).toBe(1);
    expect(statSync(cfg).nlink).toBe(2);
    expect(row.after).not.toContain(h16(body));
    expect(row.after).toContain("the object gained a name inside open");
    expect(row.after).not.toContain("different file");
    expect(row.after).toContain(`ino ${statSync(cfg, { bigint: true }).ino} nlink 2`);
  });

  it("R74-GAINED-NEW: a new file gains a name inside open, and the text does not say different file", () => {
    const cfg = join(dir, ".gitconfig");
    writeFileSync(cfg, "[user]\n\tname = base\n");
    const watch = new MachineConfigWatch([{ scope: "global", path: cfg, source: "r80" }]);
    watch.captureBase();
    watch.begin("developer");
    const body = "[user]\n\tname = gained-new\n";
    writeFileSync(`${cfg}.new`, body);
    renameSync(`${cfg}.new`, cfg);
    seam.target = cfg;
    seam.act = () => linkSync(cfg, join(dir, "second"));
    const row = watch.compare().find((f) => f.path === cfg)!;
    expect(seam.fired).toBe(1);
    expect(row.after).not.toContain(h16(body));
    expect(row.after).toContain("the object gained a name inside open");
    expect(row.after).not.toContain("different file");
  });

  it("R74-LOST-NAME: the same object loses a name inside open", () => {
    const cfg = join(dir, ".gitconfig");
    writeFileSync(cfg, "[user]\n\tname = lost\n");
    linkSync(cfg, join(dir, "second"));
    const watch = new MachineConfigWatch([{ scope: "global", path: cfg, source: "r80" }]);
    watch.captureBase();
    watch.begin("developer");
    appendFileSync(cfg, "[core]\n\tx = 1\n");
    seam.target = cfg;
    seam.act = () => unlinkSync(join(dir, "second"));
    const row = watch.compare().find((f) => f.path === cfg)!;
    expect(seam.fired).toBe(1);
    expect(statSync(cfg).nlink).toBe(1);
    expect(row.after).toContain("the object lost a name inside open");
    expect(row.after).not.toContain("different file");
  });

  it("R74-LABELS: the change text labels the loop base", () => {
    const cfg = join(dir, ".gitconfig");
    writeFileSync(cfg, "[user]\n\tname = labels\n");
    const watch = new MachineConfigWatch([{ scope: "global", path: cfg, source: "r80" }]);
    watch.captureBase();
    watch.begin("developer");
    const other = join(dir, "other");
    writeFileSync(other, "[user]\n\tname = two\n");
    unlinkSync(cfg);
    linkSync(other, cfg);
    watch.compare();
    watch.begin("qa");
    appendFileSync(cfg, "[core]\n\tx = 1\n");
    const row = watch.compare().find((f) => f.path === cfg)!;
    expect(row.before).toContain("stage start");
    expect(row.after).toContain("loop base");
    expect(row.after).toContain("current");
    expect(row.after).toMatch(/type file/);
  });

  it.skipIf(isWin)("R80-TYPECHANGE-FACTS: a planted symlink's text carries the current facts", () => {
    const cfg = join(dir, ".gitconfig");
    writeFileSync(cfg, "[user]\n\tname = tc\n");
    const watch = new MachineConfigWatch([{ scope: "global", path: cfg, source: "r80" }]);
    watch.captureBase();
    watch.begin("developer");
    const elsewhere = join(dir, "elsewhere");
    writeFileSync(elsewhere, "[user]\n\tname = else\n");
    unlinkSync(cfg);
    symlinkSync(elsewhere, cfg);
    const row = watch.compare().find((f) => f.path === cfg)!;
    const st = lstatSync(cfg, { bigint: true });
    expect(row.after).toContain("type change");
    expect(row.after).toContain(`ino ${st.ino}`);
    expect(row.after).toMatch(/type symlink/);
  });

  it.skipIf(isWin)("R80-ABSENT-SYMLINK-FACTS: a link where nothing was carries the current facts", () => {
    const cfg = join(dir, ".gitconfig");
    const watch = new MachineConfigWatch([{ scope: "global", path: cfg, source: "r80" }]);
    watch.captureBase();
    watch.begin("developer");
    const elsewhere = join(dir, "elsewhere");
    writeFileSync(elsewhere, "[user]\n\tname = else\n");
    symlinkSync(elsewhere, cfg);
    const row = watch.compare().find((f) => f.path === cfg)!;
    const st = lstatSync(cfg, { bigint: true });
    expect(row.after).toContain("absent → symlink");
    expect(row.after).toContain(`ino ${st.ino}`);
    expect(row.after).toMatch(/type symlink/);
  });
});
