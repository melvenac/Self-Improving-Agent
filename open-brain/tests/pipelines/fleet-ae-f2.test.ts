import { describe, it, expect, afterEach } from "vitest";
import { readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { checkCursorRulesCurrent, writeDeveloperBuildingChecksMdc } from "../../src/pipelines/sync/developer-building-checks.js";
import { expectRepoClean, mkFleetAeTemp, REPO_ROOT, seedFleetAeCursorProject } from "./fleet-ae-harness.js";

describe("F2: cursor-rules-current fails on drift", () => {
  let dir: string;
  let savedRole: string;

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
    expectRepoClean(REPO_ROOT);
  });

  it("editing the section without regenerating makes sync FAIL naming the file; regenerating passes", () => {
    dir = mkFleetAeTemp("fleet-ae-f2-");
    seedFleetAeCursorProject(dir);
    savedRole = readFileSync(join(dir, ".agents/roles/developer.md"), "utf8");
    writeDeveloperBuildingChecksMdc(dir);
    const marker = "## Building checks";
    const at = savedRole.indexOf(marker);
    expect(at).toBeGreaterThanOrEqual(0);
    writeFileSync(
      join(dir, ".agents/roles/developer.md"),
      `${savedRole.slice(0, at + marker.length)}\n\nDRIFT PROBE LINE\n${savedRole.slice(at + marker.length)}`,
      "utf8",
    );
    const bad = checkCursorRulesCurrent(dir);
    expect(bad.severity).toBe("issue");
    expect(bad.name).toBe("cursor-rules-current");
    expect(bad.message).toContain("developer-building-checks.mdc");
    writeFileSync(join(dir, ".agents/roles/developer.md"), savedRole, "utf8");
    writeDeveloperBuildingChecksMdc(dir);
    expect(checkCursorRulesCurrent(dir).severity).toBe("pass");
  });
});
