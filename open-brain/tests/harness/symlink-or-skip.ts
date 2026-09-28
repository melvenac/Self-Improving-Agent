import { symlinkSync } from "node:fs";
import type { TestContext } from "vitest";

let current: TestContext | undefined;

export function bindSymlinkTest(ctx: TestContext): void {
  current = ctx;
}

/**
 * Record 198 red stub. Calls the real symlinkSync and lets EPERM throw.
 * The row that passes a plant throwing EPERM fails against this, because
 * nothing skips.
 */
export function symlinkSyncOrSkip(
  target: string,
  path: string,
  type?: "dir" | "file" | "junction",
  _plant?: typeof symlinkSync,
): void {
  void current;
  void _plant;
  if (type) symlinkSync(target, path, type);
  else symlinkSync(target, path);
}
