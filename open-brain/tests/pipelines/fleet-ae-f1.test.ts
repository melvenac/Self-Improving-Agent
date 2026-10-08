import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  buildingChecksSectionFromRoot,
  extractBuildingChecksSection,
  normalizeLf,
  writeDeveloperBuildingChecksMdc,
} from "../../src/pipelines/sync/developer-building-checks.js";

const ROOT = join(import.meta.dirname, "../../..");

describe("F1: gen-cursor-rules output is byte-stable", () => {
  it("a second run is a no-op and the .mdc body equals the Building checks section", () => {
    const first = writeDeveloperBuildingChecksMdc(ROOT);
    expect(first.changed).toBe(false);
    const second = writeDeveloperBuildingChecksMdc(ROOT);
    expect(second.changed).toBe(false);
    const mdc = normalizeLf(readFileSync(join(ROOT, ".cursor/rules/developer-building-checks.mdc"), "utf8"));
    const section = buildingChecksSectionFromRoot(ROOT);
    expect(mdc).toContain(section);
    expect(extractBuildingChecksSection(mdc)).toBe(section);
  });
});
