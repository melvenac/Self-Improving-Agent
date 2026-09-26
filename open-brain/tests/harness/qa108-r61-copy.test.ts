/**
 * QA PROBE, NOT FOR MERGE. QA 108: the candidate's R61 row from configwatch-links.test.ts (A10 4b7a5ae, lines
 * 1090-1105), copied VERBATIM except `it.skipIf(isWin)` -> `it`, so that its narrowed detector can be measured under
 * mutants on this win32 PC (which can make file symlinks). The fixture lines are the links file's own.
 */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { lstatSync, mkdirSync, symlinkSync } from "node:fs";
import { join } from "node:path";
import { MachineConfigWatch } from "../../src/harness/configwatch.js";
import { scratch } from "./candidate-a-fixture.js";

describe("QA 108 copy of the candidate's R61 row (not for merge)", () => {
  let tmp: { dir: string; cleanup: () => Promise<void> };
  beforeEach(() => { tmp = scratch("q108-r61-"); });
  afterEach(async () => { await tmp.cleanup(); });

  it("R61 (copy): a link that does not resolve is reported unwatched and is not claimed as read", () => {
    const home = join(tmp.dir, "r61-home");
    mkdirSync(home);
    const cfg = join(home, ".gitconfig");
    symlinkSync("missing-r61-target", cfg);
    expect(lstatSync(cfg).isSymbolicLink(), "plant: dangling link").toBe(true);
    const watch = new MachineConfigWatch([{ scope: "global", path: cfg, source: "test" }]);
    const notes = watch.baseNotes().join("\n");
    expect(notes, notes).not.toContain("read through that target");
    expect(notes).toMatch(/unwatched|did not resolve/);
    watch.begin("developer");
    const blob = JSON.stringify(watch.compare());
    expect(blob + notes).toContain(cfg);
    expect(blob, "not claimed as read").not.toMatch(/"(before|after)":"[0-9a-f]{16}/);
    expect(blob, "the link's facts").toContain("ino");
  });
});
