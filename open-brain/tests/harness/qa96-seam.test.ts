/**
 * QA PROBE, NOT FOR MERGE. Loop 15 slice three, QA record session 96, candidate A7 d223d1d.
 *
 * R67 (D-042): "The same two conditions are re-checked on the opened handle before any byte is read." Condition 2 is
 * "the base file (same dev, ino and type) OR a regular file with exactly one name (nlink 1)". At d223d1d the handle
 * check is `!st.isFile() || st.dev !== dev || st.ino !== ino` against the PRE-OPEN stat: nlink is not re-checked.
 *
 * The seam (QA 94's, as the developer's configwatch-a7-seam.test.ts also uses): wrap node:fs openSync; on the first
 * open of the watched path, act, then perform the real open.
 *   HANDLE-NLINK         a new single-name file (not the base object) gains a SECOND name inside open. By R67's words
 *                        the handle now fails condition 2. Is it read?
 *   HANDLE-NLINK-BASE    the same act on the BASE object: condition 2 holds by "the base file", nlink ignored. Read.
 *   HANDLE-NLINK-CONTROL the new single-name file with no seam act: read.
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

import { linkSync, mkdtempSync, renameSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { MachineConfigWatch } from "../../src/harness/configwatch.js";

const h16 = (b: Buffer | string) => createHash("sha256").update(b).digest("hex").slice(0, 16);
const say = (tag: string, o: unknown) => console.log(`${tag} ${JSON.stringify(o)}`);

describe("QA 96 seam (not for merge): R67's condition 2 on the handle", { timeout: 60_000 }, () => {
  let dir: string;
  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "qa96-seam-"));
    seam.target = "";
    seam.act = null;
    seam.fired = 0;
  });
  afterEach(() => {
    seam.act = null;
    rmSync(dir, { recursive: true, force: true });
  });

  const setup = (replace: boolean) => {
    const cfg = join(dir, ".gitconfig");
    writeFileSync(cfg, "[user]\n\tname = seam-base\n");
    const watch = new MachineConfigWatch([{ scope: "global", path: cfg, source: "qa96" }]);
    watch.captureBase();
    watch.begin("developer");
    const body = replace ? "[user]\n\tname = seam-new-single-name\n" : "[user]\n\tname = seam-base-edited\n";
    if (replace) {
      writeFileSync(`${cfg}.new`, body);
      renameSync(`${cfg}.new`, cfg);
    } else writeFileSync(cfg, body);
    return { cfg, watch, body };
  };

  it("HANDLE-NLINK: a new single-name file gains a second name inside open: R67 says re-check, so not read", () => {
    const { cfg, watch, body } = setup(true);
    const pre = statSync(cfg).nlink;
    seam.target = cfg;
    seam.act = () => linkSync(cfg, join(dir, "second-name"));
    const found = watch.compare();
    const blob = JSON.stringify(found);
    say("QA96-HANDLE-NLINK", { fired: seam.fired, pre, post: statSync(cfg).nlink, read: blob.includes(h16(body)), found });
    expect(seam.fired, "plant: the seam fired inside open").toBe(1);
    expect(pre, "plant: one name before open").toBe(1);
    expect(statSync(cfg).nlink, "plant: two names at the handle").toBe(2);
    expect(blob, "R67: condition 2 fails on the handle (not the base object, two names)").not.toContain(h16(body));
  });

  it("HANDLE-NLINK-BASE: the base object gains a second name inside open: read (the base file, nlink ignored)", () => {
    const { cfg, watch, body } = setup(false);
    seam.target = cfg;
    seam.act = () => linkSync(cfg, join(dir, "second-name"));
    const found = watch.compare();
    const blob = JSON.stringify(found);
    say("QA96-HANDLE-NLINK-BASE", { fired: seam.fired, read: blob.includes(h16(body)), found });
    expect(seam.fired).toBe(1);
    expect(blob).toContain(h16(body));
  });

  it("HANDLE-NLINK-CONTROL: the new single-name file with no act inside open is read", () => {
    const { cfg, watch, body } = setup(true);
    const found = watch.compare();
    const blob = JSON.stringify(found);
    say("QA96-HANDLE-NLINK-CONTROL", { read: blob.includes(h16(body)), found });
    expect(statSync(cfg).nlink).toBe(1);
    expect(blob).toContain(h16(body));
  });
});
