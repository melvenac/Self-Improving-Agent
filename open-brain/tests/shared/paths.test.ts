import { describe, it, expect } from "vitest";
import { resolvePaths } from "../../src/shared/paths.js";

describe("resolvePaths", () => {
  it("resolves project root from a given directory", () => {
    const paths = resolvePaths(process.cwd());
    expect(paths.projectRoot).toBeTruthy();
    expect(paths.packageJson).toContain("package.json");
  });

  it("resolves home-relative paths", () => {
    const paths = resolvePaths(process.cwd());
    expect(paths.knowledgeDb).toContain("knowledge.db");
    expect(paths.obsidianVault).toContain("Obsidian Vault");
    expect(paths.scoreHistory).toContain("score-history.jsonl");
    expect(paths.settingsJson).toContain("settings.json");
  });
});
