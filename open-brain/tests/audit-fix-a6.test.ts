import { describe, it, expect, afterEach } from "vitest";
import { mkdtempSync, rmSync, mkdirSync, writeFileSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import { resolveOwnKey } from "../src/pipelines/session-start/hub-presence.js";

let tmpDirs: string[] = [];

afterEach(() => {
  for (const d of tmpDirs) rmSync(d, { recursive: true, force: true, maxRetries: 3, retryDelay: 50 });
  tmpDirs = [];
});

describe("AUDIT-FIX A6 — resolveOwnKey path confinement", () => {
  it('refuses keyName "..\\..\\x" and does not return a key outside keyDir', () => {
    const td = mkdtempSync(join(tmpdir(), "audit-a6-"));
    tmpDirs.push(td);
    const keyDir = join(td, "keys");
    writeFileSync(join(td, "stolen.key"), "s".repeat(40));
    const r = resolveOwnKey("http://localhost:8787", "..\\..\\stolen", keyDir);
    expect(r.ok).toBe(false);
    if (r.ok) expect(r.key).not.toBe("s".repeat(40));
  });

  it('refuses keyName "../x" and does not read keys outside the hub subdirectory', () => {
    const td = mkdtempSync(join(tmpdir(), "audit-a6b-"));
    tmpDirs.push(td);
    const keyDir = join(td, "keys");
    const hubSub = join(keyDir, "localhost-8787");
    mkdirSync(hubSub, { recursive: true });
    writeFileSync(join(hubSub, "legit.key"), "k".repeat(40));
    writeFileSync(join(td, "outside.key"), "o".repeat(40));

    const r = resolveOwnKey("http://localhost:8787", "../outside", keyDir);
    expect(r.ok).toBe(false);
    if (r.ok) expect(r.key).not.toBe("o".repeat(40));
  });
});
