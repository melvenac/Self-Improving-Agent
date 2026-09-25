/**
 * QA PROBE, NOT FOR MERGE. Loop 15 slice three, QA record session 104, candidate A9 6bd97f2.
 *
 * The seam (QA 94's, as the candidate's configwatch-a7-seam.test.ts uses): wrap node:fs openSync; on the first open of
 * the watched path, act, then perform the real open.
 *
 *   R74-GAINED-BASE      the BASE object gains a second name inside open (QA 96's HANDLE-NLINK-BASE shape). Rulings-16
 *                        Q3: refused on both routes. R74: "the text says exactly that, not 'different file'".
 *   R74-GAINED-NEW       the same for a new single-name file (the single-name route).
 *   R74-LOST-NAME        the base object, two names at base, LOSES one inside open: same dev/ino, nlink 2 -> 1.
 *                        Observation: what does the text say of the same object?
 *   R74-SWAPPED-CONTROL  inside open, a different file is renamed onto the path: "different file" is then true.
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

import { linkSync, mkdtempSync, realpathSync, renameSync, rmSync, statSync, unlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { MachineConfigWatch } from "../../src/harness/configwatch.js";

const h16 = (b: Buffer | string) => createHash("sha256").update(b).digest("hex").slice(0, 16);
const say = (tag: string, o: unknown) => console.log(`${tag} ${JSON.stringify(o, (_k, v) => (typeof v === "bigint" ? String(v) : v))}`);

describe("QA 104 seam (not for merge): R74's handle texts at A9", { timeout: 60_000 }, () => {
  let dir: string;
  beforeEach(() => {
    dir = realpathSync(mkdtempSync(join(tmpdir(), "qa104-seam-")));
    seam.target = "";
    seam.act = null;
    seam.fired = 0;
  });
  afterEach(() => {
    seam.act = null;
    rmSync(dir, { recursive: true, force: true });
  });

  const start = (body: string, replace: boolean) => {
    const cfg = join(dir, ".gitconfig");
    writeFileSync(cfg, "[user]\n\tname = seam-base\n");
    const watch = new MachineConfigWatch([{ scope: "global", path: cfg, source: "qa104" }]);
    watch.captureBase();
    watch.begin("developer");
    if (replace) {
      writeFileSync(`${cfg}.new`, body);
      renameSync(`${cfg}.new`, cfg);
    } else writeFileSync(cfg, body);
    return { cfg, watch };
  };

  it("R74-GAINED-BASE: the base object gains a second name inside open: the text says so, not 'different file'", () => {
    const body = "[user]\n\tname = gained-base\n";
    const { cfg, watch } = start(body, false);
    seam.target = cfg;
    seam.act = () => linkSync(cfg, join(dir, "second-name"));
    const row = watch.compare().find((f) => f.path === cfg)!;
    const ino = String(statSync(cfg, { bigint: true }).ino);
    say("QA104-R74-GAINED-BASE", { fired: seam.fired, nlink: statSync(cfg).nlink, ino, row });
    expect(seam.fired, "plant: the seam fired").toBe(1);
    expect(statSync(cfg).nlink, "plant: two names").toBe(2);
    expect(JSON.stringify(row), "Q3: refused on both routes").not.toContain(h16(body));
    expect(row.after, "R74: the gained name is named").toContain("gained a name inside open");
    expect(row.after, "R73: facts, nlink 2 from the handle").toContain(`ino ${ino} nlink 2`);
    expect(row.after, "R74: not 'different file'").not.toContain("different file");
  });

  it("R74-GAINED-NEW: a new single-name file gains a second name inside open: the text says so, not 'different file'", () => {
    const body = "[user]\n\tname = gained-new\n";
    const { cfg, watch } = start(body, true);
    seam.target = cfg;
    seam.act = () => linkSync(cfg, join(dir, "second-name"));
    const row = watch.compare().find((f) => f.path === cfg)!;
    say("QA104-R74-GAINED-NEW", { fired: seam.fired, row });
    expect(seam.fired).toBe(1);
    expect(JSON.stringify(row)).not.toContain(h16(body));
    expect(row.after).toContain("gained a name inside open");
    expect(row.after, "R74: not 'different file'").not.toContain("different file");
  });

  it("R74-LOST-NAME (observation): two names at the stage's end-open, one removed inside open: what the text says", () => {
    const cfg = join(dir, ".gitconfig");
    writeFileSync(cfg, "[user]\n\tname = lost-base\n");
    linkSync(cfg, join(dir, "base-second"));
    const watch = new MachineConfigWatch([{ scope: "global", path: cfg, source: "qa104" }]);
    watch.captureBase();
    watch.begin("developer");
    appendFileSync2(cfg);
    seam.target = cfg;
    seam.act = () => unlinkSync(join(dir, "base-second"));
    const row = watch.compare().find((f) => f.path === cfg)!;
    say("QA104-R74-LOST-NAME", { fired: seam.fired, nlink: statSync(cfg).nlink, row });
    expect(seam.fired).toBe(1);
    expect(statSync(cfg).nlink, "plant: one name after open").toBe(1);
  });

  it("R74-SWAPPED-CONTROL: inside open, a different file is renamed onto the path: 'different file' is true", () => {
    const { cfg, watch } = start("[user]\n\tname = swapped-new\n", true);
    seam.target = cfg;
    seam.act = () => {
      writeFileSync(`${cfg}.other`, "[user]\n\tname = swapped-other\n");
      renameSync(`${cfg}.other`, cfg);
    };
    const row = watch.compare().find((f) => f.path === cfg)!;
    say("QA104-R74-SWAPPED-CONTROL", { fired: seam.fired, row });
    expect(seam.fired).toBe(1);
    expect(row.after).toContain("handle is a different file");
    expect(row.after).not.toContain("gained a name");
  });
});

function appendFileSync2(p: string): void {
  writeFileSync(p, "[user]\n\tname = lost-base-edited\n", { flag: "a" });
}
