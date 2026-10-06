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
  it("refuses ../../escape and does not read a key planted at td/escape.key (master path)", () => {
    const td = mkdtempSync(join(tmpdir(), "audit-a6-"));
    tmpDirs.push(td);
    const keyDir = join(td, "keys");
    const hubSub = join(keyDir, "localhost-8787");
    mkdirSync(hubSub, { recursive: true });
    const secret = "s".repeat(40);
    writeFileSync(join(td, "escape.key"), secret);

    const r = resolveOwnKey("http://localhost:8787", "../../escape", keyDir);
    expect(r.ok).toBe(false);
    if (r.ok) expect(r.key).not.toBe(secret);
  });

  it('refuses "../outside" and does not read a sibling of the hub key directory', () => {
    const td = mkdtempSync(join(tmpdir(), "audit-a6b-"));
    tmpDirs.push(td);
    const keyDir = join(td, "keys");
    const hubSub = join(keyDir, "localhost-8787");
    mkdirSync(hubSub, { recursive: true });
    const secret = "o".repeat(40);
    writeFileSync(join(keyDir, "outside.key"), secret);

    const r = resolveOwnKey("http://localhost:8787", "../outside", keyDir);
    expect(r.ok).toBe(false);
    if (r.ok) expect(r.key).not.toBe(secret);
  });
});
