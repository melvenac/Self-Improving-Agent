import { describe, it, expect } from "vitest";
import { join } from "node:path";
import { resolvePaths, obsidianVaultDir, canonicalizeProjectDir, projectDisplayName } from "../../src/shared/paths.js";

describe("projectDisplayName", () => {
  // The regression: the display name used to be rebuilt from the canonical
  // path, which is fully lowercased on Windows, so vault notes landed in
  // Experiences/self-improving-agent/ next to Experiences/Self-Improving-Agent/.
  it("preserves the case of the directory name", () => {
    expect(projectDisplayName("C:/Users/melve/Projects/Self-Improving-Agent"))
      .toBe("Self-Improving-Agent");
  });

  it("does NOT agree with a name rebuilt from the canonical form", () => {
    const raw = "C:/Users/melve/Projects/Self-Improving-Agent";
    const fromCanonical = canonicalizeProjectDir(raw)!.split("/").pop();

    expect(fromCanonical).toBe("self-improving-agent");
    expect(projectDisplayName(raw)).not.toBe(fromCanonical);
  });

  it("handles backslashes", () => {
    expect(projectDisplayName("C:\\Users\\melve\\Projects\\A2A-Hub")).toBe("A2A-Hub");
  });

  it("ignores a trailing separator", () => {
    expect(projectDisplayName("C:/Users/melve/Projects/Mail-Server/")).toBe("Mail-Server");
    expect(projectDisplayName("C:/Users/melve/Projects/Mail-Server\\")).toBe("Mail-Server");
  });

  it("collapses repeated separators", () => {
    expect(projectDisplayName("C://Users//melve//Projects//Trading-Bot")).toBe("Trading-Bot");
  });

  it("falls back when there is nothing to derive from", () => {
    expect(projectDisplayName(null)).toBe("General");
    expect(projectDisplayName("")).toBe("General");
    expect(projectDisplayName(undefined, "general")).toBe("general");
  });
});

describe("resolvePaths", () => {
  it("resolves project root from a given directory", () => {
    const paths = resolvePaths(process.cwd());
    expect(paths.projectRoot).toBeTruthy();
    expect(paths.packageJson).toContain("package.json");
  });

  it("resolves home-relative paths", () => {
    const paths = resolvePaths(process.cwd());
    expect(paths.knowledgeDb).toContain("knowledge.db");
    expect(paths.scoreHistory).toContain("score-history.jsonl");
    expect(paths.settingsJson).toContain("settings.json");
  });
});

describe("obsidianVaultDir", () => {
  // The suite sets OPEN_BRAIN_VAULT_DIR globally (tests/setup-env.ts), so the
  // default has to be asserted with the override lifted.
  it("defaults to the v2 vault under home", () => {
    const override = process.env.OPEN_BRAIN_VAULT_DIR;
    delete process.env.OPEN_BRAIN_VAULT_DIR;
    try {
      expect(obsidianVaultDir("/home/someone")).toBe(join("/home/someone", "Obsidian Vault v2"));
    } finally {
      if (override !== undefined) process.env.OPEN_BRAIN_VAULT_DIR = override;
    }
  });

  it("honours OPEN_BRAIN_VAULT_DIR so callers can be redirected", () => {
    const override = process.env.OPEN_BRAIN_VAULT_DIR;
    process.env.OPEN_BRAIN_VAULT_DIR = "/tmp/some-vault";
    try {
      expect(obsidianVaultDir("/home/someone")).toBe("/tmp/some-vault");
      expect(resolvePaths(process.cwd()).obsidianVault).toBe("/tmp/some-vault");
    } finally {
      if (override === undefined) delete process.env.OPEN_BRAIN_VAULT_DIR;
      else process.env.OPEN_BRAIN_VAULT_DIR = override;
    }
  });
});
