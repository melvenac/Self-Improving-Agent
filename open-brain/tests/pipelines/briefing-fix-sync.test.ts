/**
 * BRIEFING-FIX BF-N4: section sha without git hash-object process.
 */
import { describe, it, expect, afterEach } from "vitest";
import { readFileSync } from "node:fs";
import { cpSync, mkdtempSync, mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  expectedDeveloperBuildingChecksMdc,
  parseSectionShaFromMdc,
} from "../../src/pipelines/sync/developer-building-checks.js";
import { REPO_ROOT } from "./fleet-ae-harness.js";

const FIXED_SHA = "2d74077c035433e79572fe9b39c6240f6137b3f0";

describe("BF-N4: section sha without git on PATH", () => {
  let dir: string;
  afterEach(() => {
    if (dir) rmSync(dir, { recursive: true, force: true });
  });

  it("PATH emptied: expectedDeveloperBuildingChecksMdc matches fixed section-sha from committed .mdc", () => {
    dir = mkdtempSync(join(tmpdir(), "bf-n4-"));
    mkdirSync(join(dir, ".agents", "roles"), { recursive: true });
    mkdirSync(join(dir, ".agents", "SYSTEM"), { recursive: true });
    mkdirSync(join(dir, ".cursor", "rules"), { recursive: true });
    cpSync(join(REPO_ROOT, ".agents/SYSTEM/required-block.json"), join(dir, ".agents/SYSTEM/required-block.json"));
    cpSync(join(REPO_ROOT, ".agents/roles/developer.md"), join(dir, ".agents/roles/developer.md"));
    const savedPath = process.env.PATH;
    try {
      process.env.PATH = "";
      const mdc = expectedDeveloperBuildingChecksMdc(dir);
      expect(parseSectionShaFromMdc(mdc)).toBe(FIXED_SHA);
      const committed = parseSectionShaFromMdc(
        readFileSync(join(REPO_ROOT, ".cursor/rules/developer-building-checks.mdc"), "utf8"),
      );
      expect(committed).toBe(FIXED_SHA);
    } finally {
      process.env.PATH = savedPath;
    }
  });

  it("source does not call git hash-object", () => {
    const src = readFileSync(join(REPO_ROOT, "open-brain/src/pipelines/sync/developer-building-checks.ts"), "utf8");
    expect(src).not.toMatch(/gitHashObjectStdin/);
    expect(src).not.toMatch(/execFileSync\(\s*["']git["']/);
  });
});
