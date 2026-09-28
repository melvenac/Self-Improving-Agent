import { symlinkSync } from "node:fs";
import type { TestContext } from "vitest";

let current: TestContext | undefined;

export function bindSymlinkTest(ctx: TestContext): void {
  current = ctx;
}

const SKIP = "skipped — symlinkSync returned EPERM (no symlink privilege on Windows). This is not a pass.";

/**
 * Create a symlink. On EPERM, skip the current test and name the code.
 * Any other error is thrown. Catching EPERM and continuing would be a pass,
 * and this does not do that.
 */
export function symlinkSyncOrSkip(
  target: string,
  path: string,
  type?: "dir" | "file" | "junction",
  plant: typeof symlinkSync = symlinkSync,
): void {
  try {
    if (type) plant(target, path, type);
    else plant(target, path);
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code;
    if (code === "EPERM") {
      if (!current) throw err;
      current.skip(SKIP);
    }
    throw err;
  }
}
