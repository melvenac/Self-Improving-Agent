import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runHealthChecks } from "../../../src/pipelines/session-start/health-checks.js";
import { SKILL_SCAN_ENABLED } from "../../../src/shared/skill-scan-flag.js";

/**
 * Loop 9 R1 — the skill scan is off, and BOTH ends must be off together.
 *
 * The acceptance condition is not "the generator stopped". It is that no stale
 * count is announced afterwards. `.skill-proposals-pending.json` is deliberately
 * not deleted, so a session start that still reads it would keep reporting "39
 * pending" from a file nothing maintains — an absence reported as a healthy
 * number, which is Rule 4 and precisely the failure this repair exists to avoid.
 */
describe("R1 skill scan disabled", () => {
  let home: string;
  let vault: string;
  const prev = process.env.OPEN_BRAIN_VAULT_DIR;

  beforeEach(() => {
    home = mkdtempSync(join(tmpdir(), "ob-skillscan-off-"));
    vault = join(home, "Obsidian Vault v2");
    mkdirSync(vault, { recursive: true });
    process.env.OPEN_BRAIN_VAULT_DIR = vault;
  });

  afterEach(() => {
    if (prev === undefined) delete process.env.OPEN_BRAIN_VAULT_DIR;
    else process.env.OPEN_BRAIN_VAULT_DIR = prev;
    rmSync(home, { recursive: true, force: true, maxRetries: 3, retryDelay: 50 });
  });

  it("is off", () => {
    expect(SKILL_SCAN_ENABLED).toBe(false);
  });

  it("reports no pending proposals even when a populated pending file is present", () => {
    // The exact situation after the ruling: the file survives from the last scan
    // that ran, carrying a real count, and nothing is maintaining it any more.
    writeFileSync(
      join(vault, ".skill-proposals-pending.json"),
      JSON.stringify([
        { tag: "reference", count: 3, files: ["a", "b", "c"], date: "2026-09-01" },
        { tag: "handoff", count: 3, files: ["d", "e", "f"], date: "2026-09-01" },
      ]),
    );

    const health = runHealthChecks(home);
    expect(health.pendingSkillProposals).toBe(0);
  });

  it("leaves the pending file on disk — the scan is derived, nothing is deleted", () => {
    const p = join(vault, ".skill-proposals-pending.json");
    writeFileSync(p, JSON.stringify([{ tag: "ranking", count: 5, files: [], date: "2026-09-01" }]));
    runHealthChecks(home);
    expect(existsSync(p)).toBe(true);
  });

  it("reports no pending proposals when the file is absent either", () => {
    const health = runHealthChecks(home);
    expect(health.pendingSkillProposals).toBe(0);
  });
});
