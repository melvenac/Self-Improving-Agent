import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync, writeFileSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { watchBuild, attachBuildWatch } from "../../src/shared/build-watch.js";

/**
 * T-315 (D-161): the server reports a new build only when a different valid stamp is on disk and nothing is in flight.
 * Timers are off (intervalMs 0); check() is driven directly.
 */
const A = "a".repeat(40);
const B = "b".repeat(40);

describe("T-315: watchBuild", () => {
  let dir: string;
  const stamp = (commit: string | null): void => {
    const p = join(dir, "build-info.json");
    if (commit === null) rmSync(p, { force: true });
    else writeFileSync(p, JSON.stringify({ commit, builtAt: "t" }));
  };
  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "t315-"));
    stamp(A);
  });
  afterEach(() => rmSync(dir, { recursive: true, force: true }));

  it("R1: a new stamp while a request is in flight waits for its response, then reports once", () => {
    const seen: string[] = [];
    const w = watchBuild({ buildDir: dir, loaded: A, intervalMs: 0, onNewBuild: (c) => seen.push(c) });
    w.begin();
    stamp(B);
    expect(w.check()).toBe(false);
    expect(seen).toEqual([]);
    w.end();
    expect(seen).toEqual([B]);
    expect(w.check()).toBe(false);
    expect(seen).toEqual([B]);
  });

  it("R2: an idle check sees a new stamp at once", () => {
    const seen: string[] = [];
    const w = watchBuild({ buildDir: dir, loaded: A, intervalMs: 0, onNewBuild: (c) => seen.push(c) });
    stamp(B);
    expect(w.check()).toBe(true);
    expect(seen).toEqual([B]);
  });

  it("R3: a rebuild in progress (no stamp, or an unstamped file) and the same stamp are not a new build", () => {
    const seen: string[] = [];
    const w = watchBuild({ buildDir: dir, loaded: A, intervalMs: 0, onNewBuild: (c) => seen.push(c) });
    expect(w.check()).toBe(false);
    stamp(null);
    expect(w.check()).toBe(false);
    writeFileSync(join(dir, "build-info.json"), JSON.stringify({ reason: "dirty tree" }));
    expect(w.check()).toBe(false);
    expect(seen).toEqual([]);
  });

  it("R4: a process that loaded no stamp never reports", () => {
    const seen: string[] = [];
    const w = watchBuild({ buildDir: dir, loaded: null, intervalMs: 0, onNewBuild: (c) => seen.push(c) });
    stamp(B);
    expect(w.check()).toBe(false);
    expect(seen).toEqual([]);
  });

  it("R5: attachBuildWatch counts host requests until their responses are sent; notifications are not requests", async () => {
    const seen: string[] = [];
    const w = watchBuild({ buildDir: dir, loaded: A, intervalMs: 0, onNewBuild: (c) => seen.push(c) });
    const handled: unknown[] = [];
    const sent: unknown[] = [];
    const transport = {
      onmessage: (m: unknown) => void handled.push(m),
      send: async (m: unknown) => void sent.push(m),
    };
    attachBuildWatch(transport, w);
    transport.onmessage({ jsonrpc: "2.0", id: 7, method: "tools/call", params: {} });
    transport.onmessage({ jsonrpc: "2.0", method: "notifications/initialized" });
    stamp(B);
    expect(w.check()).toBe(false);
    await transport.send({ jsonrpc: "2.0", method: "notifications/tools/list_changed" });
    expect(seen).toEqual([]);
    await transport.send({ jsonrpc: "2.0", id: 7, result: {} });
    expect(seen).toEqual([B]);
    expect(handled).toHaveLength(2);
    expect(sent).toHaveLength(2);
  });

  it("R6 (T-315 revert): server.ts does not wire the watch, so a rebuild never makes a running server exit", () => {
    const src = readFileSync(join(import.meta.dirname, "..", "..", "src", "server.ts"), "utf8");
    expect(src).not.toContain("./shared/build-watch.js");
    expect(src).not.toContain("attachBuildWatch(");
    expect(src).not.toContain("process.exit(0)");
    expect(src).toContain("server.connect(transport).catch(");
  });
});
