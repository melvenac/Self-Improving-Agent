import { describe, it, expect } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * T-315 (D-161): a running server never exits on a new build. The exit-and-respawn route failed live (10-20: every server
 * exited and Claude Code respawned none), so the build reaches a running seat through build-proxy.ts instead
 * (tests/t315-proxy.test.ts). The watch that drove the exit, shared/build-watch.ts, was cut with T-320.
 */
describe("T-315: the server does not exit on a new build", () => {
  it("R6 (T-315 revert): server.ts does not wire the watch, so a rebuild never makes a running server exit", () => {
    const src = readFileSync(join(import.meta.dirname, "..", "..", "src", "server.ts"), "utf8");
    expect(src).not.toContain("./shared/build-watch.js");
    expect(src).not.toContain("attachBuildWatch(");
    expect(src).not.toContain("process.exit(0)");
    expect(src).toContain("server.connect(transport).catch(");
  });

  it("R7 (T-320): the unused watch module is gone", () => {
    expect(existsSync(join(import.meta.dirname, "..", "..", "src", "shared", "build-watch.ts"))).toBe(false);
  });
});
