import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { execAsync } from "../../spawn-async.js";
import { describeDerivedArtifacts } from "../../../src/pipelines/session-start/derived-artifacts.js";

/**
 * Git failure is NOT swallowed here: if `git` misbehaves these throw and the
 * tests fail, rather than returning early and reporting green (G-029).
 */
//
// Awaited, not execSync (G-042): this file's git calls were one stretch of 23-28 s with no macrotask under load.
// execAsync throws exactly where execSync did.
async function initRepo(dir: string): Promise<string> {
  const run = async (cmd: string) => (await execAsync(cmd, { cwd: dir })).trim();
  await run("git init -q -b main");
  await run('git config user.email "t@example.com"');
  await run('git config user.name "T"');
  writeFileSync(join(dir, "seed.txt"), "seed\n");
  await run("git add -A");
  await run("git commit -q -m seed");
  return run("git rev-parse HEAD");
}

describe("describeDerivedArtifacts", () => {
  let dir: string;
  let head: string;

  const writeMeta = (meta: unknown): void => {
    mkdirSync(join(dir, ".gitnexus"), { recursive: true });
    writeFileSync(join(dir, ".gitnexus", "meta.json"), JSON.stringify(meta));
  };
  const writeInfo = (info: unknown): void => {
    mkdirSync(join(dir, "open-brain", "build"), { recursive: true });
    writeFileSync(join(dir, "open-brain", "build", "build-info.json"), JSON.stringify(info));
  };

  beforeEach(async () => {
    dir = mkdtempSync(join(tmpdir(), "derived-"));
    head = await initRepo(dir);
  });
  afterEach(() => rmSync(dir, { recursive: true, force: true }));

  it("says NOTHING when neither artifact exists — most projects on this machine", () => {
    // This hook runs for every project. A repo with no index and no build must
    // not be told about tools it does not use.
    expect(describeDerivedArtifacts(dir)).toEqual([]);
  });

  it("says NOTHING when both artifacts are current", () => {
    writeMeta({ lastCommit: head, branch: "main" });
    writeInfo({ commit: head, builtAt: "2026-09-17T00:00:00.000Z", reason: null });
    expect(describeDerivedArtifacts(dir)).toEqual([]);
  });

  it("NEVER prints an all-clear — silence is the only success output", () => {
    // The failure this guards: a line saying "artifacts OK" that actually means
    // "not checked". Absent and current must be indistinguishable in OUTPUT,
    // because neither is actionable — and nothing is emitted that could be read
    // as verification.
    writeMeta({ lastCommit: head, branch: "main" });
    writeInfo({ commit: head, builtAt: "2026-09-17T00:00:00.000Z", reason: null });
    const current = describeDerivedArtifacts(dir);
    const absent = describeDerivedArtifacts(mkdtempSync(join(tmpdir(), "derived-empty-")));
    expect(current).toEqual([]);
    expect(absent).toEqual([]);
    for (const line of [...current, ...absent]) {
      expect(line).not.toMatch(/\b(ok|clear|fine|current|fresh|up to date)\b/i);
    }
  });

  it("reports a stale build as STALE, naming the check", async () => {
    writeInfo({ commit: head, builtAt: "2026-09-17T00:00:00.000Z", reason: null });
    writeFileSync(join(dir, "x.txt"), "x\n");
    await execAsync("git add -A && git commit -q -m x", { cwd: dir });
    const lines = describeDerivedArtifacts(dir);
    expect(lines).toHaveLength(1);
    expect(lines[0]).toContain("STALE: build-freshness");
  });

  it("reports an ageing index as AGEING, not STALE", async () => {
    writeMeta({ lastCommit: head, branch: "main" });
    writeFileSync(join(dir, "y.txt"), "y\n");
    await execAsync("git add -A && git commit -q -m y", { cwd: dir });
    const lines = describeDerivedArtifacts(dir);
    expect(lines).toHaveLength(1);
    expect(lines[0]).toContain("AGEING: gitnexus-index");
    expect(lines[0]).toContain("behind HEAD");
  });

  it("mentions no tool by name when that tool's artifact is absent", async () => {
    // Only a stale BUILD here, no index at all.
    writeInfo({ commit: head, builtAt: "2026-09-17T00:00:00.000Z", reason: null });
    await execAsync("git commit -q --allow-empty -m z", { cwd: dir });
    const lines = describeDerivedArtifacts(dir);
    expect(lines.join(" ")).not.toContain("gitnexus");
  });

  it("reports both when both are bad", async () => {
    writeMeta({ lastCommit: head, branch: "main" });
    writeInfo({ commit: head, builtAt: "2026-09-17T00:00:00.000Z", reason: null });
    await execAsync("git commit -q --allow-empty -m both", { cwd: dir });
    expect(describeDerivedArtifacts(dir)).toHaveLength(2);
  });

  it("keeps the greeting short — the full provenance stays in /sync", async () => {
    writeMeta({ lastCommit: head, branch: "main" });
    await execAsync("git commit -q --allow-empty -m long", { cwd: dir });
    const [line] = describeDerivedArtifacts(dir);
    expect(line.length).toBeLessThanOrEqual(220);
    expect(line).not.toContain("LIMIT:");
  });

  it("does not throw where there is no git repository at all", () => {
    const bare = mkdtempSync(join(tmpdir(), "derived-nogit-"));
    try {
      mkdirSync(join(bare, "open-brain", "build"), { recursive: true });
      expect(() => describeDerivedArtifacts(bare)).not.toThrow();
    } finally {
      rmSync(bare, { recursive: true, force: true });
    }
  });
});
