import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { execSync } from "node:child_process";
import { describeDerivedArtifacts } from "../../../src/pipelines/session-start/derived-artifacts.js";

/**
 * Git failure is NOT swallowed here: if `git` misbehaves these throw and the
 * tests fail, rather than returning early and reporting green (G-029).
 */
function initRepo(dir: string): string {
  const run = (cmd: string) => execSync(cmd, { cwd: dir, stdio: ["ignore", "pipe", "pipe"] }).toString().trim();
  run("git init -q -b main");
  run('git config user.email "t@example.com"');
  run('git config user.name "T"');
  writeFileSync(join(dir, "seed.txt"), "seed\n");
  run("git add -A");
  run("git commit -q -m seed");
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

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "derived-"));
    head = initRepo(dir);
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

  it("reports a stale build as STALE, naming the check", () => {
    writeInfo({ commit: head, builtAt: "2026-09-17T00:00:00.000Z", reason: null });
    writeFileSync(join(dir, "x.txt"), "x\n");
    execSync("git add -A && git commit -q -m x", { cwd: dir, stdio: "ignore" });
    const lines = describeDerivedArtifacts(dir);
    expect(lines).toHaveLength(1);
    expect(lines[0]).toContain("STALE: build-freshness");
  });

  it("reports an ageing index as AGEING, not STALE", () => {
    writeMeta({ lastCommit: head, branch: "main" });
    writeFileSync(join(dir, "y.txt"), "y\n");
    execSync("git add -A && git commit -q -m y", { cwd: dir, stdio: "ignore" });
    const lines = describeDerivedArtifacts(dir);
    expect(lines).toHaveLength(1);
    expect(lines[0]).toContain("AGEING: gitnexus-index");
    expect(lines[0]).toContain("behind HEAD");
  });

  it("mentions no tool by name when that tool's artifact is absent", () => {
    // Only a stale BUILD here, no index at all.
    writeInfo({ commit: head, builtAt: "2026-09-17T00:00:00.000Z", reason: null });
    execSync("git commit -q --allow-empty -m z", { cwd: dir, stdio: "ignore" });
    const lines = describeDerivedArtifacts(dir);
    expect(lines.join(" ")).not.toContain("gitnexus");
  });

  it("reports both when both are bad", () => {
    writeMeta({ lastCommit: head, branch: "main" });
    writeInfo({ commit: head, builtAt: "2026-09-17T00:00:00.000Z", reason: null });
    execSync("git commit -q --allow-empty -m both", { cwd: dir, stdio: "ignore" });
    expect(describeDerivedArtifacts(dir)).toHaveLength(2);
  });

  it("keeps the greeting short — the full provenance stays in /sync", () => {
    writeMeta({ lastCommit: head, branch: "main" });
    execSync("git commit -q --allow-empty -m long", { cwd: dir, stdio: "ignore" });
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
