import { describe, it, expect, afterEach } from "vitest";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { checkCursorRulesCurrent } from "../../src/pipelines/sync/developer-building-checks.js";
import { writeDeveloperBuildingChecksMdc } from "../../src/pipelines/sync/developer-building-checks.js";

const ROOT = join(import.meta.dirname, "../../..");
const ROLE = join(ROOT, ".agents/roles/developer.md");
const MDC = join(ROOT, ".cursor/rules/developer-building-checks.mdc");

describe("F2: cursor-rules-current fails on drift", () => {
  let savedRole: string;

  afterEach(() => {
    writeFileSync(ROLE, savedRole, "utf8");
    writeDeveloperBuildingChecksMdc(ROOT);
  });

  it("editing the section without regenerating makes sync FAIL naming the file; regenerating passes", () => {
    savedRole = readFileSync(ROLE, "utf8");
    writeDeveloperBuildingChecksMdc(ROOT);
    const marker = "## Building checks";
    const at = savedRole.indexOf(marker);
    expect(at).toBeGreaterThanOrEqual(0);
    writeFileSync(ROLE, `${savedRole.slice(0, at + marker.length)}\n\nDRIFT PROBE LINE\n${savedRole.slice(at + marker.length)}`, "utf8");
    const bad = checkCursorRulesCurrent(ROOT);
    expect(bad.severity).toBe("issue");
    expect(bad.name).toBe("cursor-rules-current");
    expect(bad.message).toContain("developer-building-checks.mdc");
    writeFileSync(ROLE, savedRole, "utf8");
    writeDeveloperBuildingChecksMdc(ROOT);
    const ok = checkCursorRulesCurrent(ROOT);
    expect(ok.severity).toBe("pass");
    expect(readFileSync(MDC, "utf8").length).toBeGreaterThan(100);
  });
});
