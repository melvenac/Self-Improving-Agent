import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, cpSync, readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { tmpdir } from "node:os";
import DatabaseCtor from "better-sqlite3";
import { rmSync } from "node:fs";
import {
  syncReadmeVersion,
  syncPrdVersion,
  checkChangelog,
  checkClaudeMd,
  checkTemplate,
  checkObsidianVault,
  checkVaultIndexParity,
  checkVaultPathRefs,
  checkSkillIndex,
  checkTemplatePersonalNames,
  checkSchemaVersion,
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

    it("resolves a script nested under a subdirectory", () => {
      // The Session 47 dashboard move exposed this: matching from `scripts/`
      // onward left the leading segment behind, and the tail resolved nowhere.
      mkdirSync(join(tempDir, "open-brain", "scripts"), { recursive: true });
      writeFileSync(join(tempDir, "open-brain", "scripts", "dashboard.mjs"), "// x\n");
      writeFileSync(join(tempDir, "README.md"), "Run `node open-brain/scripts/dashboard.mjs` to start.\n");

      const result = checkReadmeRefs(tempDir);
      expect(result.severity).toBe("pass");
    });

    it("still catches a missing script under a subdirectory", () => {
      writeFileSync(join(tempDir, "README.md"), "Run `node open-brain/scripts/gone.mjs`.\n");
      const result = checkReadmeRefs(tempDir);
      expect(result.severity).toBe("issue");
      expect(result.message).toContain("open-brain/scripts/gone.mjs");
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

  describe("checkVaultIndexParity", () => {
    /**
     * Builds a vault + a knowledge_index containing only the rows given, so each
     * divergence class can be produced deliberately rather than hoped for.
     */
    function scenario(notes: string[], indexedPaths: string[]): { vault: string; db: string } {
      const vault = mkdtempSync(join(tmpdir(), "ob-parity-vault-"));
      const db = join(mkdtempSync(join(tmpdir(), "ob-parity-db-")), "k.db");
      for (const n of notes) {
        const full = join(vault, n);
        mkdirSync(dirname(full), { recursive: true });
        writeFileSync(full, "# note\n");
      }
      const d = new DatabaseCtor(db);
      d.exec("CREATE TABLE knowledge_index (id INTEGER PRIMARY KEY, key TEXT, vault_path TEXT)");
      const ins = d.prepare("INSERT INTO knowledge_index (key, vault_path) VALUES (?, ?)");
      for (const p of indexedPaths) ins.run(p.replace(/[\\/]/g, "-"), join(vault, p));
      d.close();
      return { vault, db };
    }

    it("passes when every note has a matching index row", () => {
      const { vault, db } = scenario(["Experiences/General/a.md"], ["Experiences/General/a.md"]);
      const r = checkVaultIndexParity(vault, db);
      expect(r.severity).toBe("pass");
    });

    it("reports a duplicate when the same note is filed under two folders", () => {
      const { vault, db } = scenario(
        ["Experiences/General/a.md", "Experiences/ProjX/a.md"],
        ["Experiences/ProjX/a.md"],
      );
      const r = checkVaultIndexParity(vault, db);
      expect(r.severity).toBe("warn");
      expect(r.message).toContain("1 duplicate note");
      expect(r.message).toContain("counts it twice");
      expect(r.message).not.toContain("unindexed note");
    });

    it("reports an unindexed note distinctly from a duplicate", () => {
      const { vault, db } = scenario(
        ["Experiences/General/a.md", "Experiences/General/lonely.md"],
        ["Experiences/General/a.md"],
      );
      const r = checkVaultIndexParity(vault, db);
      expect(r.message).toContain("1 unindexed note");
      expect(r.message).not.toContain("duplicate note");
    });

    it("reports an index row whose vault file is gone", () => {
      const { vault, db } = scenario(["Experiences/General/a.md"], ["Experiences/General/a.md", "Experiences/General/deleted.md"]);
      const r = checkVaultIndexParity(vault, db);
      expect(r.message).toContain("1 index row");
    });

    it("ignores Summaries/, which session-end writes and never indexes", () => {
      const { vault, db } = scenario(
        ["Experiences/General/a.md", "Summaries/2026-08-08-proj.md"],
        ["Experiences/General/a.md"],
      );
      expect(checkVaultIndexParity(vault, db).severity).toBe("pass");
    });

    it("is not applicable rather than failing when the DB does not exist", () => {
      const vault = mkdtempSync(join(tmpdir(), "ob-parity-novault-"));
      const r = checkVaultIndexParity(vault, join(vault, "nope.db"));
      expect(r.severity).toBe("pass");
    });
  });

  describe("checkVaultPathRefs", () => {
    /**
     * An isolated fake home, so the check never reads the developer's real
     * ~/.claude and the result cannot depend on the machine it runs on.
     */
    function writeDoc(root: string, rel: string, body: string): void {
      const full = join(root, rel);
      mkdirSync(dirname(full), { recursive: true });
      writeFileSync(full, body);
    }

    let home: string;
    beforeEach(() => {
      home = mkdtempSync(join(tmpdir(), "ob-vaultrefs-home-"));
    });

    it("passes when nothing references the v1 vault", () => {
      writeDoc(tempDir, "scripts/notes.md", "Reads `~/Obsidian Vault v2/Experiences/`.");
      expect(checkVaultPathRefs(tempDir, home).severity).toBe("pass");
    });

    it("flags a v1 reference in a slash command", () => {
      writeDoc(tempDir, ".claude/commands/start.md", "Read ~/Obsidian Vault/Skill-Candidates/SKILL-INDEX.md");
      const result = checkVaultPathRefs(tempDir, home);
      expect(result.severity).toBe("issue");
      expect(result.message).toContain("start.md");
    });

    it("does not mistake the v2 path for a v1 reference", () => {
      writeDoc(tempDir, "project-template/guide.md", "~/Obsidian Vault v2/Summaries/ and Obsidian Vault v2\\Experiences");
      expect(checkVaultPathRefs(tempDir, home).severity).toBe("pass");
    });

    it("ignores a bare mention with no path separator", () => {
      writeDoc(tempDir, "scripts/prose.md", "The Obsidian Vault holds every experience note.");
      expect(checkVaultPathRefs(tempDir, home).severity).toBe("pass");
    });

    it("exempts records of what was true then, not stale instructions", () => {
      writeDoc(tempDir, "project-template/CHANGELOG.md", "Exported to `Obsidian Vault/Checkpoints/` in v1.");
      writeDoc(tempDir, "scripts/tests/fixture.md", "Path: ~/Obsidian Vault/Experiences");
      writeDoc(tempDir, "project-template/superpowers/plans/2026-03-26-x.md", "Write to ~/Obsidian Vault/Sessions/");
      expect(checkVaultPathRefs(tempDir, home).severity).toBe("pass");
    });

    it("scans live user directories outside the repo", () => {
      writeDoc(home, ".cursor/commands/start.md", "Read ~/Obsidian Vault/.skill-proposals-pending.json");
      const result = checkVaultPathRefs(tempDir, home);
      expect(result.severity).toBe("issue");
      expect(result.message).toContain("~");
    });

    it("flags the global CLAUDE.md, which is read as standing instruction", () => {
      writeDoc(home, ".claude/CLAUDE.md", "- **Vault writer log:** `~/Obsidian Vault/.vault-writer.log`");
      const result = checkVaultPathRefs(tempDir, home);
      expect(result.severity).toBe("issue");
      expect(result.message).toContain("CLAUDE.md");
    });

    it("flags the project CLAUDE.md too", () => {
      writeDoc(tempDir, "CLAUDE.md", "Knowledge lives in ~/Obsidian Vault/Experiences/");
      expect(checkVaultPathRefs(tempDir, home).severity).toBe("issue");
    });

    it("tolerates absent directories rather than throwing", () => {
      expect(() => checkVaultPathRefs(join(tempDir, "nope"), join(home, "nope"))).not.toThrow();
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

  describe("checkSkillIndex", () => {
    const writeIndex = (body: string): string => {
      const vault = join(tempDir, "vault");
      mkdirSync(join(vault, "Skill-Candidates"), { recursive: true });
      writeFileSync(join(vault, "Skill-Candidates", "SKILL-INDEX.md"), body);
      return vault;
    };

    it("passes when SKILL-INDEX.md is absent", () => {
      expect(checkSkillIndex(join(tempDir, "vault")).severity).toBe("pass");
    });

    it("passes on a well-formed index and reports the skill count", () => {
      const vault = writeIndex(
        "# Skill Index\n\n## Skills\n\n"
        + "| Name | File | Domain | Problem Class | Source Project | Version |\n"
        + "|---|---|---|---|---|---|\n"
        + "| Convex Patterns | `convex.md` | convex | data-modeling | Open Brain | 1.0 |\n",
      );
      const result = checkSkillIndex(vault);
      expect(result.severity).toBe("pass");
      expect(result.message).toContain("1 skill(s)");
    });

    it("fails sync when a row is malformed", () => {
      const vault = writeIndex(
        "# Skill Index\n\n## Skills\n\n"
        + "| Name | File | Domain | Problem Class | Source Project | Version |\n"
        + "|---|---|---|---|---|---|\n"
        + "| Convex Patterns | `convex.md` |\n",
      );
      const result = checkSkillIndex(vault);
      expect(result.severity).toBe("issue");
      expect(result.message).toContain("1 malformed skill row(s)");
    });
  });

  describe("checkTemplatePersonalNames", () => {
    const writeTemplateFile = (rel: string, content: string): void => {
      const full = join(tempDir, "project-template", rel);
      mkdirSync(dirname(full), { recursive: true });
      writeFileSync(full, content);
    };

    it("passes on a template with no personal names", () => {
      writeTemplateFile(".claude/commands/start.md", "Greet the user by name.\n");
      expect(checkTemplatePersonalNames(tempDir).severity).toBe("pass");
    });

    it("fails when a template file ships a personal name", () => {
      writeTemplateFile(".claude/commands/start.md", "Greet Aaron by name. You are Clark.\n");
      const result = checkTemplatePersonalNames(tempDir);
      expect(result.severity).toBe("issue");
      expect(result.message).toContain("Aaron");
    });

    it("does not trip on the repo URL containing melvenac", () => {
      writeTemplateFile("README.md", "git clone https://github.com/melvenac/Self-Improving-Agent.git\n");
      expect(checkTemplatePersonalNames(tempDir).severity).toBe("pass");
    });

    it("catches lowercase names — the guard is case-insensitive", () => {
      writeTemplateFile(".claude/commands/start.md", "you are clark\n");
      expect(checkTemplatePersonalNames(tempDir).severity).toBe("issue");
    });
  });

  describe("checkSchemaVersion", () => {
    const makeDb = (version: number): string => {
      const dbPath = join(tempDir, "skew.db");
      const db = new DatabaseCtor(dbPath);
      db.pragma(`user_version = ${version}`);
      db.close();
      return dbPath;
    };

    it("passes when the DB is absent", () => {
      expect(checkSchemaVersion(join(tempDir, "nope.db")).severity).toBe("pass");
    });

    it("passes when the stamp matches this build", async () => {
      const { SCHEMA_VERSION } = await import("../../../src/db-v2.js");
      expect(checkSchemaVersion(makeDb(SCHEMA_VERSION)).severity).toBe("pass");
    });

    it("fails when a newer build has stamped the DB — this build is the stale writer", async () => {
      const { SCHEMA_VERSION } = await import("../../../src/db-v2.js");
      const result = checkSchemaVersion(makeDb(SCHEMA_VERSION + 1));
      expect(result.severity).toBe("issue");
      expect(result.message).toContain("newer build");
    });

    it("warns, not fails, when the DB is merely behind — it heals on next open", () => {
      expect(checkSchemaVersion(makeDb(0)).severity).toBe("warn");
    });

    it("warns when project-template/ is absent", () => {
      expect(checkTemplatePersonalNames(tempDir).severity).toBe("warn");
    });
  });
});
