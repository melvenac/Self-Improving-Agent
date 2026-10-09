/**
 * T-254: build line names the loaded commit vs disk (SP-1..SP-6).
 */
import { describe, it, expect, afterEach } from "vitest";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { describeServingBuild, readStampedCommit } from "../../../src/pipelines/session-start/serving-build.js";

const A = "a".repeat(40);
const B = "b".repeat(40);
const BUILT = "2026-10-09T16:42:00Z";

const tmps: string[] = [];
afterEach(() => {
  for (const d of tmps.splice(0)) rmSync(d, { recursive: true, force: true, maxRetries: 3, retryDelay: 50 });
});

function buildDir(body: Record<string, unknown>): string {
  const d = mkdtempSync(join(tmpdir(), "t254-"));
  tmps.push(d);
  writeFileSync(join(d, "build-info.json"), JSON.stringify(body));
  return d;
}

describe("T-254 stale process build line", () => {
  it("SP-1: loaded commit differs from disk → STALE PROCESS line", () => {
    const dir = buildDir({ commit: B, builtAt: BUILT });
    expect(describeServingBuild(dir, A)).toBe(
      "Build aaaaaaa · STALE PROCESS: disk has bbbbbbb (built 2026-10-09T16:42:00Z) → /mcp reconnect open-brain",
    );
  });

  it("SP-2: loaded matches disk → no STALE PROCESS", () => {
    const dir = buildDir({ commit: B, builtAt: BUILT });
    expect(describeServingBuild(dir, B)).not.toContain("STALE PROCESS");
  });

  it("SP-3: explicit buildDir without loaded pin → disk-only line, no STALE PROCESS", () => {
    const dir = buildDir({ commit: B, builtAt: BUILT });
    const a = describeServingBuild(dir, null);
    const b = describeServingBuild(dir);
    expect(a).not.toContain("STALE PROCESS");
    expect(b).not.toContain("STALE PROCESS");
    expect(a).toBe(b);
  });

  it("SP-4: missing builtAt uses unrecorded time in STALE PROCESS", () => {
    const dir = buildDir({ commit: B });
    expect(describeServingBuild(dir, A)).toContain("(built an unrecorded time)");
  });

  it("SP-5: readStampedCommit validates 40-hex commit", () => {
    const noFile = mkdtempSync(join(tmpdir(), "t254-"));
    tmps.push(noFile);
    const notJson = buildDir({});
    writeFileSync(join(notJson, "build-info.json"), "not json");
    const badHex = buildDir({ commit: "abc" });
    const good = buildDir({ commit: B });
    expect(readStampedCommit(noFile)).toBe(null);
    expect(readStampedCommit(notJson)).toBe(null);
    expect(readStampedCommit(badHex)).toBe(null);
    expect(readStampedCommit(good)).toBe(B);
  });

  it("SP-6: LOADED_COMMIT is module-level const; buildDir guard keeps fixture dirs off LOADED_COMMIT", () => {
    const src = readFileSync(
      fileURLToPath(new URL("../../../src/pipelines/session-start/serving-build.ts", import.meta.url)),
      "utf8",
    );
    expect(src).toMatch(/^export const LOADED_COMMIT: string \| null = readStampedCommit\(runningBuildDir\(\)\);$/m);
    expect(src).toMatch(/buildDir === undefined \? LOADED_COMMIT : null/);
  });
});
