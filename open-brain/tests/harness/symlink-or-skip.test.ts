import { lstatSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import type { TestContext } from "vitest";
import { bindSymlinkTest, symlinkSyncOrSkip } from "./symlink-or-skip.js";

const dirs: string[] = [];
afterEach(() => {
  for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true });
});

function epermPlant(): never {
  const err = new Error("operation not permitted") as NodeJS.ErrnoException;
  err.code = "EPERM";
  throw err;
}

describe("symlink EPERM", () => {
  it("EPERM skips and the reason names EPERM and says it is not a pass", () => {
    const notes: string[] = [];
    bindSymlinkTest({
      skip(note?: string) {
        notes.push(note ?? "");
        throw new Error("skipped");
      },
    } as TestContext);
    expect(() => symlinkSyncOrSkip("target", join(tmpdir(), "no-such-link"), undefined, epermPlant)).toThrow(/skipped/);
    expect(notes[0]).toContain("EPERM");
    expect(notes[0]).toMatch(/not a pass/);
  });

  it("an error other than EPERM is thrown and is not a skip", () => {
    const notes: string[] = [];
    bindSymlinkTest({
      skip(note?: string) {
        notes.push(note ?? "");
        throw new Error("skipped");
      },
    } as TestContext);
    const enoent = () => {
      const err = new Error("no such file") as NodeJS.ErrnoException;
      err.code = "ENOENT";
      throw err;
    };
    let caught: NodeJS.ErrnoException | undefined;
    try {
      symlinkSyncOrSkip("target", join(tmpdir(), "no-such-link"), undefined, enoent);
    } catch (err) {
      caught = err as NodeJS.ErrnoException;
    }
    expect(caught?.code).toBe("ENOENT");
    expect(notes).toEqual([]);
  });

  it("a real symlinkSync that returns EPERM skips with that reason; a created link is not a skip", () => {
    const dir = mkdtempSync(join(tmpdir(), "symlink-real-"));
    dirs.push(dir);
    const link = join(dir, "link");
    const notes: string[] = [];
    bindSymlinkTest({
      skip(note?: string) {
        notes.push(note ?? "");
        throw new Error("skipped");
      },
    } as TestContext);
    let threw = "";
    try {
      symlinkSyncOrSkip("target-need-not-exist", link);
    } catch (err) {
      threw = err instanceof Error ? err.message : String(err);
    }
    if (notes.length > 0) {
      expect(threw).toBe("skipped");
      expect(notes[0]).toContain("EPERM");
      expect(notes[0]).toMatch(/not a pass/);
      return;
    }
    expect(threw, threw).toBe("");
    expect(lstatSync(link).isSymbolicLink()).toBe(true);
  });
});
