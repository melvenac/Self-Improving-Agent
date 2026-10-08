import { describe, it, expect } from "vitest";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  buildingChecksSectionFromRoot,
  extractBuildingChecksSection,
  normalizeLf,
  requiredBlockSectionText,
} from "../../src/pipelines/sync/developer-building-checks.js";
import { REPO_ROOT } from "./fleet-ae-harness.js";

describe("F3: required-block.json matches F1 section", () => {
  it("required-block.json is tracked, resolves to the same section as the .mdc, and hub-partner-seats has no requiredBlock", () => {
    const tracked = execFileSync("git", ["ls-files", ".agents/SYSTEM/required-block.json"], {
      cwd: REPO_ROOT,
      encoding: "utf8",
    }).trim();
    expect(tracked).toBe(".agents/SYSTEM/required-block.json");
    const seats = JSON.parse(readFileSync(join(REPO_ROOT, ".agents/SYSTEM/hub-partner-seats.json"), "utf8")) as Record<
      string,
      unknown
    >;
    expect(seats.requiredBlock).toBeUndefined();
    const fromBlock = requiredBlockSectionText(REPO_ROOT);
    const fromRole = buildingChecksSectionFromRoot(REPO_ROOT);
    expect(fromBlock).toBe(fromRole);
    const mdc = normalizeLf(readFileSync(join(REPO_ROOT, ".cursor/rules/developer-building-checks.mdc"), "utf8"));
    expect(extractBuildingChecksSection(mdc)).toBe(fromBlock);
  });
});
