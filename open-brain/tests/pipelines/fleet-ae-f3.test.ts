import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  buildingChecksSectionFromRoot,
  extractBuildingChecksSection,
  normalizeLf,
  requiredBlockSectionText,
} from "../../src/pipelines/sync/developer-building-checks.js";

const ROOT = join(import.meta.dirname, "../../..");

describe("F3: requiredBlock matches F1 section", () => {
  it("requiredBlock resolves to the same section text written into the .mdc", () => {
    const fromBlock = requiredBlockSectionText(ROOT);
    const fromRole = buildingChecksSectionFromRoot(ROOT);
    expect(fromBlock).toBe(fromRole);
    const mdc = normalizeLf(readFileSync(join(ROOT, ".cursor/rules/developer-building-checks.mdc"), "utf8"));
    expect(extractBuildingChecksSection(mdc)).toBe(fromBlock);
  });
});
