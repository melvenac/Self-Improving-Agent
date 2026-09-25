/**
 * R66. The openSync seam is the instrument: a test fails when the runtime
 * opens a path it must not. The handle re-check renames a different file
 * over the watched path inside open; that file's bytes must not be read,
 * and the record must say the handle is a different file.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createHash } from "node:crypto";

const seam = vi.hoisted(() => ({
  target: "",
  act: null as null | (() => void),
  fired: 0,
  opened: [] as string[],
}));
vi.mock("node:fs", async (importOriginal) => {
  const m = await importOriginal<typeof import("node:fs")>();
  const openSync = ((...a: Parameters<typeof m.openSync>) => {
    seam.opened.push(String(a[0]));
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

import { chmodSync, linkSync, mkdirSync, mkdtempSync, readFileSync, renameSync, rmSync, statSync, symlinkSync, unlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { MachineConfigWatch } from "../../src/harness/configwatch.js";

const isWin = process.platform === "win32";
const h16 = (b: Buffer | string) => createHash("sha256").update(b).digest("hex").slice(0, 16);

describe("R66 — openSync seam", { timeout: 60_000 }, () => {
  let dir: string;
  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "a7-seam-"));
    seam.target = "";
    seam.act = null;
    seam.fired = 0;
    seam.opened = [];
  });
  afterEach(() => {
    seam.act = null;
    rmSync(dir, { recursive: true, force: true });
  });

  it("R66: a different file renamed over the path inside open is not read, and the handle reason is recorded", () => {
    const cfg = join(dir, ".gitconfig");
    writeFileSync(cfg, "[user]\n\tname = handle-base\n");
    const victim = join(dir, "victim");
    const secret = "[user]\n\tname = VICTIM-HANDLE-SWAP\n";
    writeFileSync(victim, secret);
    const watch = new MachineConfigWatch([{ scope: "global", path: cfg, source: "test" }]);
    watch.captureBase();
    watch.begin("developer");
    const baseIno = statSync(cfg, { bigint: true }).ino;
    seam.target = cfg;
    seam.act = () => renameSync(victim, cfg);
    const blob = JSON.stringify(watch.compare());
    expect(seam.fired, "plant: the seam ran inside open").toBe(1);
    expect(readFileSync(cfg, "utf-8")).toBe(secret);
    expect(statSync(cfg, { bigint: true }).ino).not.toBe(baseIno);
    expect(blob, blob).not.toContain(h16(secret));
    expect(blob).toContain("handle is a different file");
  });

  it("R66: the seam editing the same file in place is read", () => {
    const cfg = join(dir, ".gitconfig");
    writeFileSync(cfg, "[user]\n\tname = handle-base\n");
    const watch = new MachineConfigWatch([{ scope: "global", path: cfg, source: "test" }]);
    watch.captureBase();
    watch.begin("developer");
    const edited = "[user]\n\tname = handle-edited-in-place\n";
    const baseIno = statSync(cfg, { bigint: true }).ino;
    seam.target = cfg;
    seam.act = () => writeFileSync(cfg, edited);
    const blob = JSON.stringify(watch.compare());
    expect(seam.fired).toBe(1);
    expect(statSync(cfg, { bigint: true }).ino).toBe(baseIno);
    expect(blob, blob).toContain(h16(edited));
  });

  it.skipIf(isWin)("R66 R29: the runtime never opens the victim path", () => {
    const home = join(dir, "home");
    mkdirSync(home);
    const victim = join(dir, "victim");
    writeFileSync(victim, "[user]\n\tname = MODE0-LINK-SECRET\n");
    chmodSync(victim, 0o000);
    const cfg = join(home, ".gitconfig");
    writeFileSync(cfg, "[user]\n\tname = base\n");
    const watch = new MachineConfigWatch([{ scope: "global", path: cfg, source: "test" }]);
    watch.begin("developer");
    unlinkSync(cfg);
    symlinkSync(victim, cfg);
    seam.opened = [];
    try {
      let code = "";
      try {
        readFileSync(cfg);
      } catch (err) {
        code = (err as NodeJS.ErrnoException).code ?? "";
      }
      if (code !== "EACCES") throw new Error(`read through the link did not throw EACCES (code ${code || "none"})`);
      watch.compare();
      const opened = seam.opened.join("\n");
      expect(opened, opened).not.toContain(victim);
      expect(opened).not.toContain(cfg);
    } finally {
      chmodSync(victim, 0o644);
    }
  });

  it("R70: a second name gained inside open is not read", () => {
    const cfg = join(dir, ".gitconfig");
    const body = "[user]\n\tname = r70-base\n";
    writeFileSync(cfg, body);
    const watch = new MachineConfigWatch([{ scope: "global", path: cfg, source: "test" }]);
    watch.captureBase();
    watch.begin("developer");
    const second = join(dir, "r70-second");
    seam.target = cfg;
    seam.act = () => linkSync(cfg, second);
    const found = watch.compare();
    const row = found.find((f) => f.path === cfg);
    const blob = JSON.stringify(found);
    expect(seam.fired, "plant: the seam ran inside open").toBe(1);
    expect(statSync(cfg).nlink, "plant: nlink 2 on the handle").toBe(2);
    expect(row, blob).toBeTruthy();
    expect(row!.after, blob).not.toContain(h16(body));
    expect(row!.after).toContain("handle is a different file");
    expect(row!.after).toContain("gained a name inside open");
    expect(row!.after).toContain(String(statSync(cfg, { bigint: true }).ino));
  });
});
