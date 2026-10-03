/**
 * T-235 Phase 0: setup.mjs found no open-brain/ on the QA PC because its repo root
 * was taken from a URL pathname, which keeps a space as %20.
 */
import { describe, it, expect } from "vitest";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { pathToFileURL } from "node:url";
// @ts-expect-error — a plain .mjs module outside the TypeScript project
import { repoRootFrom } from "../../scripts/setup-hooks.mjs";

describe("setup.mjs repo root (T-235)", () => {
  it("decodes a space in the path instead of leaving %20", () => {
    const root = join(tmpdir(), "Aaron Melven", "Projects", "Self-Improving-Agent");
    const url = pathToFileURL(join(root, "scripts", "setup.mjs")).href;
    expect(url).toContain("%20");
    expect(repoRootFrom(url)).toBe(resolve(root));
  });

  it("leaves a path without special characters unchanged", () => {
    const root = join(tmpdir(), "plain", "repo");
    expect(repoRootFrom(pathToFileURL(join(root, "scripts", "setup.mjs")).href)).toBe(resolve(root));
  });
});
