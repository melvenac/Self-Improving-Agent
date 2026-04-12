import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, cpSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { runSync } from "../../../src/pipelines/sync/index.js";

describe("runSync", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), "ob-sync-int-"));
    cpSync(join(import.meta.dirname, "../../fixtures"), tempDir, { recursive: true });
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  it("runs all checks and returns structured result", () => {
    const result = runSync({
      projectRoot: tempDir,
      checkOnly: false,
      score: false,
      scoreJson: false,
      history: false,
    });
    expect(result.version).toBe("0.6.0");
    expect(result.checks.length).toBeGreaterThan(0);
    // Should have auto-fixed the README version
    expect(result.fixed.some((c) => c.name === "readme-version")).toBe(true);
  });

  it("does not auto-fix in check-only mode", () => {
    const result = runSync({
      projectRoot: tempDir,
      checkOnly: true,
      score: false,
      scoreJson: false,
      history: false,
    });
    expect(result.fixed).toHaveLength(0);
    expect(result.issues.some((c) => c.name === "readme-version")).toBe(true);
  });

  it("categorizes results correctly", () => {
    const result = runSync({
      projectRoot: tempDir,
      checkOnly: false,
      score: false,
      scoreJson: false,
      history: false,
    });
    for (const check of result.checks) {
      if (check.severity === "fixed") expect(result.fixed).toContain(check);
      if (check.severity === "issue") expect(result.issues).toContain(check);
      if (check.severity === "warn") expect(result.warnings).toContain(check);
      if (check.severity === "pass") expect(result.passed).toContain(check);
    }
  });

  it("reads version from package.json", () => {
    const result = runSync({
      projectRoot: tempDir,
      checkOnly: false,
      score: false,
      scoreJson: false,
      history: false,
    });
    expect(result.version).toBe("0.6.0");
  });
});
