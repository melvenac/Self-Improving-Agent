import { describe, it, expect, afterEach } from "vitest";
import { readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import {
  buildingChecksSectionFromRoot,
  extractBuildingChecksSection,
  gitHashObjectStdin,
  normalizeLf,
  parseSectionShaFromMdc,
  writeDeveloperBuildingChecksMdc,
} from "../../src/pipelines/sync/developer-building-checks.js";
import { expectRepoClean, mkFleetAeTemp, REPO_ROOT, seedFleetAeCursorProject } from "./fleet-ae-harness.js";

describe("F1: gen-cursor-rules output is byte-stable", () => {
  let dir: string;

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
    expectRepoClean(REPO_ROOT);
  });

  it("a second run is a no-op and the .mdc body equals the Building checks section", () => {
    dir = mkFleetAeTemp("fleet-ae-f1-");
    seedFleetAeCursorProject(dir);
    const first = writeDeveloperBuildingChecksMdc(dir);
    expect(first.changed).toBe(true);
    const second = writeDeveloperBuildingChecksMdc(dir);
    expect(second.changed).toBe(false);
    const mdc = normalizeLf(readFileSync(join(dir, ".cursor/rules/developer-building-checks.mdc"), "utf8"));
    const section = buildingChecksSectionFromRoot(dir);
    expect(mdc).toContain(section);
    expect(extractBuildingChecksSection(mdc)).toBe(section);
    const headerSha = parseSectionShaFromMdc(mdc);
    expect(headerSha).toBe(gitHashObjectStdin(section));
    expect(headerSha).not.toBe(gitHashObjectStdin(readFileSync(join(dir, ".agents/roles/developer.md"), "utf8")));
  });
});
