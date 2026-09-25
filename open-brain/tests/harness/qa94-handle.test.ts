/**
 * QA PROBE, NOT FOR MERGE. Loop 15 slice three, QA record session 94, scoring candidate A6 dc35b24.
 *
 * Dispatch section 3(a): does any test exercise R60's SECOND condition, the identity check on the OPENED HANDLE?
 * The developer's "handle" mutant (3c12e2f) sets rejectHandle = true, so it rejects EVERY handle: it breaks reading,
 * it does not remove the re-check. This file builds the race deterministically through a test seam: node:fs's
 * openSync is wrapped, and on the first open of the watched path (after observe()'s realpath + stat have matched the
 * base identity) the seam renames a DIFFERENT file over that path, then performs the real open. The handle is then a
 * different file than the one the path lookup identified. R60: "the opened handle is checked, before any byte is
 * read, and is still that file". So the swapped-in file's hash must not reach the record.
 *
 * Runs on win32 and POSIX alike: no symlinks, only rename-over. Controls in the same file:
 *   - SEAM-CONTROL: the seam fires but writes the SAME file in place, so the handle is the base file: it IS read,
 *     and the new bytes are hashed. This shows the seam itself does not block reads.
 *   - NO-SEAM CONTROL: the same swap done BEFORE compare() (not inside open) is caught by the object test (path
 *     identity), and is not read. This shows the victim's hash is detectable in the record by this instrument.
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

import { mkdtempSync, readFileSync, renameSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { MachineConfigWatch } from "../../src/harness/configwatch.js";

const h16 = (b: Buffer | string) => createHash("sha256").update(b).digest("hex").slice(0, 16);
const say = (tag: string, o: unknown) => console.log(`${tag} ${JSON.stringify(o, (_k, v) => (typeof v === "bigint" ? String(v) : v))}`);

describe("QA 94 probe (not for merge): R60's handle re-check, by a deterministic swap inside open", { timeout: 60_000 }, () => {
  let dir: string;
  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "qa94-handle-"));
    seam.target = "";
    seam.act = null;
    seam.fired = 0;
  });
  afterEach(() => {
    seam.act = null;
    rmSync(dir, { recursive: true, force: true });
  });

  const setup = () => {
    const cfg = join(dir, ".gitconfig");
    writeFileSync(cfg, "[user]\n\tname = handle-base\n");
    const victim = join(dir, "victim");
    const secret = "[user]\n\tname = VICTIM-HANDLE-SWAP\n";
    writeFileSync(victim, secret);
    const watch = new MachineConfigWatch([{ scope: "global", path: cfg, source: "qa94" }]);
    watch.captureBase();
    watch.begin("developer");
    return { cfg, victim, secret, watch, baseIno: statSync(cfg, { bigint: true }).ino };
  };

  it("HANDLE-SWAP: a different file renamed over the path between the identity check and the open is not read", () => {
    const { cfg, victim, secret, watch, baseIno } = setup();
    seam.target = cfg;
    seam.act = () => renameSync(victim, cfg);
    const found = watch.compare();
    const blob = JSON.stringify(found);
    const nowIno = statSync(cfg, { bigint: true }).ino;
    say("QA94-HANDLE-SWAP", { fired: seam.fired, baseIno: String(baseIno), nowIno: String(nowIno), victimHash: h16(secret), inRecord: blob.includes(h16(secret)), found });
    expect(seam.fired, "plant: the seam ran inside open").toBe(1);
    expect(readFileSync(cfg, "utf-8"), "plant: the path now holds the victim's bytes").toBe(secret);
    expect(nowIno, "plant: the path now names a different inode").not.toBe(baseIno);
    expect(blob, "R60(2): the swapped-in file's bytes are not read").not.toContain(h16(secret));
  });

  it("SEAM-CONTROL: the seam fires but edits the SAME file in place; it is read and hashed", () => {
    const { cfg, watch, baseIno } = setup();
    const edited = "[user]\n\tname = handle-edited-in-place\n";
    seam.target = cfg;
    seam.act = () => writeFileSync(cfg, edited);
    const found = watch.compare();
    const blob = JSON.stringify(found);
    say("QA94-SEAM-CONTROL", { fired: seam.fired, sameIno: statSync(cfg, { bigint: true }).ino === baseIno, editHash: h16(edited), inRecord: blob.includes(h16(edited)), found });
    expect(seam.fired).toBe(1);
    expect(statSync(cfg, { bigint: true }).ino, "plant: still the base inode").toBe(baseIno);
    expect(blob, "the in-place edit is hashed").toContain(h16(edited));
  });

  it("NO-SEAM CONTROL: the same swap before compare() is caught by the object test and not read", () => {
    const { cfg, victim, secret, watch } = setup();
    renameSync(victim, cfg);
    const found = watch.compare();
    const blob = JSON.stringify(found);
    say("QA94-NOSEAM-CONTROL", { fired: seam.fired, inRecord: blob.includes(h16(secret)), found });
    expect(seam.fired).toBe(0);
    expect(blob).not.toContain(h16(secret));
    expect(found.length, "the different file is reported").toBeGreaterThan(0);
  });
});
