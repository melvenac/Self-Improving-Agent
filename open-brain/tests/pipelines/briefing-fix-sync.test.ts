/**
 * BRIEFING-FIX BF-N4: section sha without git hash-object process.
 */
import { describe, it, expect, afterEach } from "vitest";
import { readFileSync } from "node:fs";
import { cpSync, mkdtempSync, mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  buildingChecksSectionFromRoot,
  expectedDeveloperBuildingChecksMdc,
  parseSectionShaFromMdc,
} from "../../src/pipelines/sync/developer-building-checks.js";
import { gitBlobSha } from "../../src/harness/gate-records.js";
import { REPO_ROOT } from "./fleet-ae-harness.js";

describe("BF-N4: section sha without git on PATH", () => {
  let dir: string;
  afterEach(() => {
    if (dir) rmSync(dir, { recursive: true, force: true });
  });

  it("expectedDeveloperBuildingChecksMdc matches gitBlobSha in process (no git hash-object)", () => {
    dir = mkdtempSync(join(tmpdir(), "bf-n4-"));
    mkdirSync(join(dir, ".agents", "roles"), { recursive: true });
    mkdirSync(join(dir, ".agents", "SYSTEM"), { recursive: true });
    mkdirSync(join(dir, ".cursor", "rules"), { recursive: true });
    cpSync(join(REPO_ROOT, ".agents/SYSTEM/required-block.json"), join(dir, ".agents/SYSTEM/required-block.json"));
    cpSync(join(REPO_ROOT, ".agents/roles/developer.md"), join(dir, ".agents/roles/developer.md"));
    const section = buildingChecksSectionFromRoot(dir);
    const fixtureSha = gitBlobSha(section);
    const mdc = expectedDeveloperBuildingChecksMdc(dir);
    expect(parseSectionShaFromMdc(mdc)).toBe(fixtureSha);
    const src = readFileSync(join(REPO_ROOT, "open-brain/src/pipelines/sync/developer-building-checks.ts"), "utf8");
    expect(src).not.toMatch(/gitHashObjectStdin/);
    expect(src).not.toMatch(/execFileSync\(\s*["']git["']/);
  });
});
