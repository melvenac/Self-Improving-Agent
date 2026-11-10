import { describe, it, expect, afterEach } from "vitest";
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
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

  it("T341-5: a repo with no .cursor/ skips, even when developer.md has no Building checks section", () => {
    dir = mkFleetAeTemp("fleet-ae-t341-");
    mkdirSync(join(dir, ".agents", "roles"), { recursive: true });
    writeFileSync(join(dir, ".agents/roles/developer.md"), "# Developer\n\nNo building checks here.\n", "utf8");
    const r = checkCursorRulesCurrent(dir);
    expect(r.severity, r.message).toBe("skip");
    expect(r.message).toContain("This is not a pass.");
  });

  it("T341-6: with .cursor/ present, a missing section is still an issue", () => {
    dir = mkFleetAeTemp("fleet-ae-t341-");
    mkdirSync(join(dir, ".agents", "roles"), { recursive: true });
    mkdirSync(join(dir, ".cursor"), { recursive: true });
    writeFileSync(join(dir, ".agents/roles/developer.md"), "# Developer\n\nNo building checks here.\n", "utf8");
    expect(checkCursorRulesCurrent(dir).severity).toBe("issue");
  });
});
