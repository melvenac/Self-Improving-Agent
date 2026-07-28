import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, cpSync, readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { rmSync } from "node:fs";
import {
  syncReadmeVersion,
  syncPrdVersion,
  checkChangelog,
  checkClaudeMd,
  checkTemplate,
  checkObsidianVault,
  checkRules,
  checkReadmeRefs,
  checkHookConfigs,
  checkSummary,
  checkSpecProvenance,
  resolveDocPath,
} from "../../../src/pipelines/sync/checks.js";

const fixturesDir = join(import.meta.dirname, "../../fixtures");

describe("version sync checks", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), "ob-sync-"));
    cpSync(fixturesDir, tempDir, { recursive: true });
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true, maxRetries: 3, retryDelay: 50 });
  });

  describe("syncReadmeVersion", () => {
    it("detects version mismatch and fixes it", () => {
      const result = syncReadmeVersion("0.6.0", tempDir, false);
      expect(result.severity).toBe("fixed");
      expect(result.autoFixed).toBe(true);
      const readme = readFileSync(join(tempDir, "README.md"), "utf-8");
      expect(readme).toContain("**Latest: v0.6.0**");
    });

    it("reports mismatch without fixing in check-only mode", () => {
      const result = syncReadmeVersion("0.6.0", tempDir, true);
      expect(result.severity).toBe("issue");
      expect(result.autoFixed).toBeUndefined();
      const readme = readFileSync(join(tempDir, "README.md"), "utf-8");
      expect(readme).toContain("**Latest: v0.5.0**");
    });

    it("passes when versions match", () => {
      const result = syncReadmeVersion("0.5.0", tempDir, false);
      expect(result.severity).toBe("pass");
    });

    it("warns when README.md is missing", () => {
      const result = syncReadmeVersion("0.6.0", join(tempDir, "nonexistent"), false);
      expect(result.severity).toBe("warn");
    });

    it("warns when README has no version pattern", () => {
      writeFileSync(join(tempDir, "README.md"), "# No version here\n");
      const result = syncReadmeVersion("0.6.0", tempDir, false);
      expect(result.severity).toBe("warn");
    });
  });

  describe("syncPrdVersion", () => {
    it("detects PRD version mismatch and fixes it", () => {
      const result = syncPrdVersion("0.6.0", tempDir, false);
      expect(result.severity).toBe("fixed");
      const prd = readFileSync(join(tempDir, "docs", "PRD.md"), "utf-8");
      expect(prd).toContain("| Version | 0.6.0 |");
    });

    it("passes when versions match", () => {
      const result = syncPrdVersion("0.5.0", tempDir, false);
      expect(result.severity).toBe("pass");
    });

    it("reports mismatch without fixing in check-only mode", () => {
      const result = syncPrdVersion("0.6.0", tempDir, true);
      expect(result.severity).toBe("issue");
      const prd = readFileSync(join(tempDir, "docs", "PRD.md"), "utf-8");
      expect(prd).toContain("| Version | 0.5.0 |");
    });

    it("warns when PRD.md is missing", () => {
      const result = syncPrdVersion("0.6.0", join(tempDir, "nonexistent"), false);
      expect(result.severity).toBe("warn");
    });
  });

});

describe("validation checks", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), "ob-val-"));
    cpSync(fixturesDir, tempDir, { recursive: true });
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true, maxRetries: 3, retryDelay: 50 });
  });

  describe("checkChangelog", () => {
    it("passes when current version has a changelog entry", () => {
      const result = checkChangelog("0.6.0", tempDir);
      expect(result.severity).toBe("pass");
    });

    it("issues when current version has no changelog entry", () => {
      const result = checkChangelog("0.7.0", tempDir);
      expect(result.severity).toBe("issue");
    });

    it("warns when CHANGELOG.md is missing", () => {
      const result = checkChangelog("0.6.0", join(tempDir, "nonexistent"));
      expect(result.severity).toBe("warn");
    });
  });

  describe("checkReadmeRefs", () => {
    it("passes when README has no script refs or all refs exist", () => {
      // Fixture README has no scripts/ refs by default — should pass
      const result = checkReadmeRefs(tempDir);
      expect(result.severity).toBe("pass");
    });

    it("issues when README references a missing script", () => {
      writeFileSync(join(tempDir, "README.md"), "See scripts/nonexistent.mjs for usage\n");
      const result = checkReadmeRefs(tempDir);
      expect(result.severity).toBe("issue");
    });

    it("warns when README.md is missing", () => {
      const result = checkReadmeRefs(join(tempDir, "nonexistent"));
      expect(result.severity).toBe("warn");
    });
  });

  describe("checkHookConfigs", () => {
    it("passes when settings.json has no hooks", () => {
      const settingsPath = join(tempDir, "settings.json");
      writeFileSync(settingsPath, JSON.stringify({ hooks: {} }));
      const result = checkHookConfigs(settingsPath);
      expect(result.severity).toBe("pass");
    });

    it("issues when a hook references a missing file", () => {
      const settingsPath = join(tempDir, "settings.json");
      writeFileSync(settingsPath, JSON.stringify({
        hooks: {
          PostToolUse: [{ command: "node /nonexistent/script.mjs" }],
        },
      }));
      const result = checkHookConfigs(settingsPath);
      expect(result.severity).toBe("issue");
    });

    it("warns when settings.json is missing", () => {
      const result = checkHookConfigs(join(tempDir, "nonexistent.json"));
      expect(result.severity).toBe("warn");
    });
  });

  describe("checkSummary", () => {
    it("passes when SUMMARY.md contains the version", () => {
      mkdirSync(join(tempDir, ".agents", "SYSTEM"), { recursive: true });
      writeFileSync(join(tempDir, ".agents", "SYSTEM", "SUMMARY.md"), "# Summary\nVersion: 0.6.0\n");
      const result = checkSummary("0.6.0", tempDir);
      expect(result.severity).toBe("pass");
    });

    it("issues when SUMMARY.md does not contain the version", () => {
      mkdirSync(join(tempDir, ".agents", "SYSTEM"), { recursive: true });
      writeFileSync(join(tempDir, ".agents", "SYSTEM", "SUMMARY.md"), "# Summary\nVersion: 0.5.0\n");
      const result = checkSummary("0.6.0", tempDir);
      expect(result.severity).toBe("issue");
    });

    it("warns when SUMMARY.md is missing", () => {
      rmSync(join(tempDir, ".agents", "SYSTEM", "SUMMARY.md"), { force: true });
      const result = checkSummary("0.6.0", tempDir);
      expect(result.severity).toBe("warn");
    });
  });

  describe("checkClaudeMd", () => {
    it("warns when CLAUDE.md is missing", () => {
      const result = checkClaudeMd(tempDir);
      expect(result.severity).toBe("warn");
    });

    it("passes when CLAUDE.md exists with no dir refs", () => {
      writeFileSync(join(tempDir, "CLAUDE.md"), "# Claude\nNo directory refs here.\n");
      const result = checkClaudeMd(tempDir);
      expect(result.severity).toBe("pass");
    });
  });

  describe("checkObsidianVault", () => {
    it("warns when vault directory is missing", () => {
      const result = checkObsidianVault(join(tempDir, "fake-vault"));
      expect(result.severity).toBe("warn");
    });

    it("passes when vault has all expected directories", () => {
      const vaultPath = join(tempDir, "vault");
      for (const d of ["Experiences", "Sessions", "Skill-Candidates", "Summaries"]) {
        mkdirSync(join(vaultPath, d), { recursive: true });
      }
      const result = checkObsidianVault(vaultPath);
      expect(result.severity).toBe("pass");
    });

    it("warns when vault is missing some expected directories", () => {
      const vaultPath = join(tempDir, "vault");
      mkdirSync(join(vaultPath, "Experiences"), { recursive: true });
      const result = checkObsidianVault(vaultPath);
      expect(result.severity).toBe("warn");
    });
  });

  describe("checkTemplate", () => {
    it("warns when project-template/ is missing", () => {
      const result = checkTemplate(tempDir);
      expect(result.severity).toBe("warn");
    });

    it("passes when project-template/ has .agents and .claude", () => {
      mkdirSync(join(tempDir, "project-template", ".agents"), { recursive: true });
      mkdirSync(join(tempDir, "project-template", ".claude"), { recursive: true });
      const result = checkTemplate(tempDir);
      expect(result.severity).toBe("pass");
    });

    it("issues when project-template/ is missing required dirs", () => {
      mkdirSync(join(tempDir, "project-template"), { recursive: true });
      const result = checkTemplate(tempDir);
      expect(result.severity).toBe("issue");
    });
  });

  describe("syncPrdVersion formats", () => {
    it("matches a bolded label with a v-prefixed version", () => {
      mkdirSync(join(tempDir, ".agents", "SYSTEM"), { recursive: true });
      writeFileSync(
        join(tempDir, ".agents", "SYSTEM", "PRD.md"),
        "| Field | Value |\n|---|---|\n| **Version** | v0.7.1 |\n"
      );

      expect(syncPrdVersion("0.7.1", tempDir, true).severity).toBe("pass");
    });

    it("preserves bolding and the v-prefix when auto-fixing", () => {
      mkdirSync(join(tempDir, ".agents", "SYSTEM"), { recursive: true });
      const prd = join(tempDir, ".agents", "SYSTEM", "PRD.md");
      writeFileSync(prd, "| **Version** | v0.6.0 |\n");

      const result = syncPrdVersion("0.7.1", tempDir, false);

      expect(result.severity).toBe("fixed");
      expect(readFileSync(prd, "utf-8")).toContain("| **Version** | v0.7.1 |");
    });

    it("still handles the plain unbolded style", () => {
      mkdirSync(join(tempDir, ".agents", "SYSTEM"), { recursive: true });
      const prd = join(tempDir, ".agents", "SYSTEM", "PRD.md");
      writeFileSync(prd, "| Version | 0.6.0 |\n");

      expect(syncPrdVersion("0.7.1", tempDir, false).severity).toBe("fixed");
      expect(readFileSync(prd, "utf-8")).toContain("| Version | 0.7.1 |");
    });
  });

  describe("resolveDocPath", () => {
    it("prefers .agents/SYSTEM/ over docs/ and the repo root", () => {
      mkdirSync(join(tempDir, ".agents", "SYSTEM"), { recursive: true });
      mkdirSync(join(tempDir, "docs"), { recursive: true });
      writeFileSync(join(tempDir, ".agents", "SYSTEM", "PRD.md"), "system\n");
      writeFileSync(join(tempDir, "docs", "PRD.md"), "docs\n");
      writeFileSync(join(tempDir, "PRD.md"), "root\n");

      expect(resolveDocPath(tempDir, "PRD.md")).toBe(
        join(tempDir, ".agents", "SYSTEM", "PRD.md")
      );
    });

    it("falls back to docs/ when .agents/SYSTEM/ has no copy", () => {
      mkdirSync(join(tempDir, "docs"), { recursive: true });
      writeFileSync(join(tempDir, "docs", "RULES.md"), "docs\n");

      expect(resolveDocPath(tempDir, "RULES.md")).toBe(join(tempDir, "docs", "RULES.md"));
    });

    it("falls back to the repo root as the last resort", () => {
      writeFileSync(join(tempDir, "RULES.md"), "root\n");

      expect(resolveDocPath(tempDir, "RULES.md")).toBe(join(tempDir, "RULES.md"));
    });

    it("returns null when the document exists nowhere", () => {
      expect(resolveDocPath(tempDir, "NOPE.md")).toBeNull();
    });
  });

  describe("checkRules", () => {
    it("passes when RULES.md lives in .agents/SYSTEM/", () => {
      mkdirSync(join(tempDir, ".agents", "SYSTEM"), { recursive: true });
      writeFileSync(join(tempDir, ".agents", "SYSTEM", "RULES.md"), "# Rules\n");

      expect(checkRules(tempDir).severity).toBe("pass");
    });
  });

  describe("checkSpecProvenance", () => {
    it("warns when specs/ directory is missing", () => {
      const result = checkSpecProvenance(tempDir);
      expect(result.severity).toBe("warn");
    });

    it("passes when specs/ directory exists", () => {
      mkdirSync(join(tempDir, "specs"), { recursive: true });
      writeFileSync(join(tempDir, "specs", "example.md"), "# Spec\n");
      const result = checkSpecProvenance(tempDir);
      expect(result.severity).toBe("pass");
    });
  });

  describe("checkRules", () => {
    it("warns when RULES.md is missing", () => {
      const result = checkRules(tempDir);
      expect(result.severity).toBe("warn");
    });

    it("passes when RULES.md exists", () => {
      writeFileSync(join(tempDir, "RULES.md"), "# Rules\n");
      const result = checkRules(tempDir);
      expect(result.severity).toBe("pass");
    });
  });
});
