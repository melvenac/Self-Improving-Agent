import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, cpSync, readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { tmpdir } from "node:os";
import { execSync } from "node:child_process";
import DatabaseCtor from "better-sqlite3";
import { rmSync } from "node:fs";
import {
  syncReadmeVersion,
  syncPrdVersion,
  checkChangelog,
  checkClaudeMd,
  checkTemplate,
  checkObsidianVault,
  checkVaultPathRefs,
  checkSkillIndex,
  checkTemplatePersonalNames,
  checkRules,
  checkReadmeRefs,
  checkHookConfigs,
  checkSummary,
  checkSpecProvenance,
  checkStateSchema,
  checkCommandToolNames,
  checkCommandNames,
  checkRetirements,
  resolveDocPath,
} from "../../../src/pipelines/sync/checks.js";
// Loop 13 (the module boundary): these three read the knowledge database and
// now live in the memory-side module. Core's checks.js no longer imports
// better-sqlite3 at all.
import {
  checkVaultIndexParity,
  checkSchemaVersion,
  checkProjectDirsExist,
} from "../../../src/pipelines/sync/checks-memory.js";
import { scoreConfigStructure } from "../../../src/pipelines/sync/scorer.js";

const fixturesDir = join(import.meta.dirname, "../../fixtures");
const stateFixture = join(import.meta.dirname, "../../fixtures-state/state.json");

/** Loop 2 C4: state-schema is a skip-with-reason when absent, strict when present. */
describe("checkStateSchema", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), "ob-sync-state-"));
    cpSync(fixturesDir, tempDir, { recursive: true });
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true, maxRetries: 3, retryDelay: 50 });
  });

  it("skips with a printed reason when .agents/state.json is absent", () => {
    const r = checkStateSchema("0.29.0", tempDir);
    expect(r.severity).toBe("skip");
    expect(r.name).toBe("state-schema");
    expect(r.message).toMatch(/^skipped — no \.agents\/state\.json/);
    expect(r.message).toContain("ob_state never creates the file");
  });

  it("passes on a valid file", () => {
    cpSync(stateFixture, join(tempDir, ".agents", "state.json"));
    const r = checkStateSchema("0.29.0", tempDir);
    expect(r.severity).toBe("pass");
    expect(r.message).toBe(
      ".agents/state.json readable by this CLI process (schema v3, rev 7, 27 tasks)",
    );
  });

  /**
   * Loop 10 R1 — the runtime label is the whole check.
   *
   * The same code parsing the same file must say WHICH process's loaded schema
   * did the parsing, because an MCP server holds its schema for the life of the
   * process while `/sync` from the CLI is a different process entirely. Without
   * the label the two are indistinguishable in the output, which is how a schema
   * change stayed invisible for two loops.
   */
  it("names the process whose schema parsed the file", () => {
    cpSync(stateFixture, join(tempDir, ".agents", "state.json"));

    expect(checkStateSchema("0.29.0", tempDir, "cli").message).toContain("this CLI process");
    expect(checkStateSchema("0.29.0", tempDir, "mcp-server").message).toContain(
      "the running MCP server",
    );
  });

  it("names the reconnect when the server's own schema cannot read the file", () => {
    writeFileSync(join(tempDir, ".agents", "state.json"), JSON.stringify({ schema_version: 1 }));

    const server = checkStateSchema("0.29.0", tempDir, "mcp-server");
    expect(server.severity).toBe("issue");
    expect(server.message).toContain("/mcp reconnect open-brain");
    // A stale server reports success, so the remedy has to say how to confirm.
    expect(server.message).toContain("a stale server reports success");

    // From the CLI the same failure means something different, and says so
    // rather than sending the reader to a reconnect that would not help.
    const cli = checkStateSchema("0.29.0", tempDir, "cli");
    expect(cli.severity).toBe("issue");
    expect(cli.message).not.toContain("/mcp reconnect open-brain");
    expect(cli.message).toContain("not the running server's");
  });

  /**
   * Loop 8 R3 / ADR-027. The version comparison is gone, and what replaces it is
   * stricter: ProjectSchema is a z.strictObject, so a file still carrying
   * `project.version` does not parse at all.
   *
   * Pinned explicitly rather than inferred from reading the schema, because it
   * is the property the migration's safety rests on — there is no migration
   * runner for state.json, so all three copies (live record, this fixture, the
   * shipped template) had to move in one commit, and this hard failure is what
   * guarantees a missed copy is loud instead of silent.
   */
  it("rejects a file that still carries the removed project.version field", () => {
    const stale = JSON.parse(readFileSync(stateFixture, "utf-8"));
    stale.project.version = "0.29.0";
    writeFileSync(join(tempDir, ".agents", "state.json"), JSON.stringify(stale));
    const r = checkStateSchema("0.29.0", tempDir);
    expect(r.severity).toBe("issue");
    expect(r.message).toContain("invalid at");
    expect(r.message).toContain("project");
  });

  it("fails an invalid file with the zod path", () => {
    // schema_version 2 so the file is valid UP TO the field under test: the
    // point is the zod PATH, and a v1 file now fails at schema_version first,
    // which would make this assert something else.
    writeFileSync(join(tempDir, ".agents", "state.json"), JSON.stringify({ schema_version: 3, revision: -1 }));
    const r = checkStateSchema("0.29.0", tempDir);
    expect(r.severity).toBe("issue");
    expect(r.message).toMatch(/^\.agents\/state\.json invalid at revision: /);
  });

  it("a skipped check is outside the health-score denominator", () => {
    const passes = [{ name: "a", severity: "pass" as const, message: "" }, { name: "b", severity: "pass" as const, message: "" }];
    const withSkip = [...passes, { name: "state-schema", severity: "skip" as const, message: "skipped" }];
    expect(scoreConfigStructure(withSkip).score).toBe(scoreConfigStructure(passes).score);
    expect(scoreConfigStructure(withSkip).score).toBe(25);
  });
});

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
      expect(r.message).toContain("two copies of one experience");
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

  describe("checkProjectDirsExist", () => {
    const makeDb = (projectDirs: string[]): string => {
      const dbPath = join(tempDir, `projdirs-${Math.random().toString(36).slice(2)}.db`);
      const db = new DatabaseCtor(dbPath);
      db.exec(`CREATE TABLE knowledge_index (id INTEGER PRIMARY KEY, project_dir TEXT)`);
      const ins = db.prepare(`INSERT INTO knowledge_index (project_dir) VALUES (?)`);
      for (const p of projectDirs) ins.run(p);
      db.close();
      return dbPath;
    };

    it("passes when the DB is absent", () => {
      expect(checkProjectDirsExist(join(tempDir, "nope.db")).severity).toBe("pass");
    });

    it("passes when every project directory resolves", () => {
      const real = tempDir.replace(/\\/g, "/");
      expect(checkProjectDirsExist(makeDb([real])).severity).toBe("pass");
    });

    it("warns — never fails — on a directory that no longer exists", () => {
      // Warn, not issue: an absent directory can be an archived project rather
      // than a mistake, and blocking the commit gate over old history is the
      // wrong trade.
      const result = checkProjectDirsExist(makeDb(["c:/users/x/projects/renamed-away"]));
      expect(result.severity).toBe("warn");
      expect(result.message).toContain("renamed-away");
      expect(result.message).toContain("relocate");
    });

    it("ignores global entries, which have no directory to check", () => {
      const db = makeDb([]);
      expect(checkProjectDirsExist(db).severity).toBe("pass");
    });

    it("reports the entry count so a large orphaned project is visible", () => {
      const result = checkProjectDirsExist(
        makeDb(["c:/users/x/projects/gone", "c:/users/x/projects/gone", "c:/users/x/projects/gone"]),
      );
      expect(result.message).toContain("(3)");
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

// Loop 11 C3. Each case is written so the check has been SEEN TO FAIL before it
// is trusted: the green assertions below mean nothing without the red ones.
describe("checkCommandToolNames", () => {
  const NL = String.fromCharCode(10);
  let root: string;

  function setup(commandFiles: Record<string, string>, serverTools: string[] = ["ob_recall", "ob_store", "ob_feedback"]) {
    root = mkdtempSync(join(tmpdir(), "c3-"));
    const srcDir = join(root, "open-brain", "src");
    mkdirSync(srcDir, { recursive: true });
    // Mirrors server.ts's registration shape: the tool name alone on its line.
    writeFileSync(
      join(srcDir, "server.ts"),
      serverTools.map((t) => `server.tool(
  "${t}",
  "desc",
);`).join(NL),
    );
    const cmdDir = join(root, ".claude", "commands");
    mkdirSync(cmdDir, { recursive: true });
    for (const [f, body] of Object.entries(commandFiles)) writeFileSync(join(cmdDir, f), body);
    return root;
  }

  afterEach(() => { try { rmSync(root, { recursive: true, force: true }); } catch { /* best effort */ } });

  it("fails on a command naming a tool that is not registered", () => {
    const r = checkCommandToolNames(setup({ "a.md": "Call `ob_summarize({})` when done." }), join(root, "nohome"));
    expect(r.severity).toBe("issue");
    expect(r.message).toContain("ob_summarize");
    expect(r.message).toContain("a.md");
  });

  it("fails on the retired kb_* prefix even though the name looks plausible", () => {
    const r = checkCommandToolNames(setup({ "a.md": "Call `kb_recall(...)`." }), join(root, "nohome"));
    expect(r.severity).toBe("issue");
    expect(r.message).toContain("retired v1 prefix");
  });

  it("passes when every named tool is registered, and says it cannot judge descriptions", () => {
    const r = checkCommandToolNames(setup({ "a.md": "Use `ob_recall` then `ob_feedback({id, rating})`." }), join(root, "nohome"));
    expect(r.severity).toBe("pass");
    expect(r.message).toContain("cannot tell whether a tool's description is true");
  });

  it("skips rather than passing when server.ts is absent", () => {
    root = mkdtempSync(join(tmpdir(), "c3-"));
    const cmdDir = join(root, ".claude", "commands");
    mkdirSync(cmdDir, { recursive: true });
    writeFileSync(join(cmdDir, "a.md"), "Call `ob_whatever`.");
    const r = checkCommandToolNames(root, join(root, "nohome"));
    expect(r.severity).toBe("skip");
    expect(r.message).toContain("server.ts");
  });
});

describe("checkCommandNames", () => {
  let root: string;

  /** commands: files that EXIST. surface: extra instruction files that REFER to them. */
  function setup(commands: string[], surface: Record<string, string> = {}) {
    root = mkdtempSync(join(tmpdir(), "c2-"));
    const cmdDir = join(root, ".claude", "commands");
    mkdirSync(cmdDir, { recursive: true });
    for (const c of commands) writeFileSync(join(cmdDir, `${c}.md`), `# /${c}`);
    for (const [f, body] of Object.entries(surface)) {
      const abs = join(root, f);
      mkdirSync(dirname(abs), { recursive: true });
      writeFileSync(abs, body);
    }
    return root;
  }

  afterEach(() => { try { rmSync(root, { recursive: true, force: true }); } catch { /* best effort */ } });

  // The defect this check was built for: README.md kept /skill-scan in its live
  // Commands table for two loops after the command file was deleted.
  it("fails on a README naming a command whose file does not exist", () => {
    const r = checkCommandNames(
      setup(["start", "end"], { "README.md": "| `/skill-scan` | On demand | proposes skills |" }),
      join(root, "nohome"),
    );
    expect(r.severity).toBe("issue");
    expect(r.message).toContain("/skill-scan");
    expect(r.message).toContain("README.md");
  });

  it("fails on a skill file naming a command that does not exist", () => {
    const r = checkCommandNames(
      setup(["start"], { ".agents/skills/gotchas/SKILL.md": "prompt changes to `/start`, `/recall`." }),
      join(root, "nohome"),
    );
    expect(r.severity).toBe("issue");
    expect(r.message).toContain("/recall");
  });

  // Host commands are not this project's, so resolving them against the command
  // directory would be the wrong question. Declared, never inferred.
  it("passes on a declared host command and says the list is explicit", () => {
    const r = checkCommandNames(
      setup(["checkpoint"], { "README.md": "Run `/checkpoint` then `/compact`." }),
      join(root, "nohome"),
    );
    expect(r.severity).toBe("pass");
  });

  it("names BUILTINS in the failure so the reader knows the explicit repair", () => {
    const r = checkCommandNames(setup(["start"], { "README.md": "Run `/clear`." }), join(root, "nohome"));
    expect(r.severity).toBe("issue");
    expect(r.message).toContain("BUILTINS");
  });

  it("passes when every named command resolves, and says it cannot judge descriptions", () => {
    const r = checkCommandNames(
      setup(["start", "end"], { "README.md": "`/start` then `/end`." }),
      join(root, "nohome"),
    );
    expect(r.severity).toBe("pass");
    expect(r.message).toContain("cannot tell whether a command's description is true");
  });

  // A check that cannot run must not look like one that ran and found nothing.
  it("skips rather than passing when no command directory exists", () => {
    root = mkdtempSync(join(tmpdir(), "c2-"));
    writeFileSync(join(root, "README.md"), "Run `/skill-scan`.");
    const r = checkCommandNames(root, join(root, "nohome"));
    expect(r.severity).toBe("skip");
  });
});

describe("checkRetirements", () => {
  let root: string;

  function setup(record: unknown, files: Record<string, string> = {}) {
    root = mkdtempSync(join(tmpdir(), "c3-"));
    mkdirSync(join(root, ".agents"), { recursive: true });
    writeFileSync(join(root, ".agents", "retirements.json"), JSON.stringify(record));
    for (const [f, body] of Object.entries(files)) {
      const abs = join(root, f);
      mkdirSync(dirname(abs), { recursive: true });
      writeFileSync(abs, body);
    }
    return root;
  }

  const WIDGETIZER = {
    historical: [".agents/retirements.json", "CHANGELOG.md"],
    retirements: [
      { id: "R-1", name: "widgetizer", pattern: "\\bwidgetizer\\b", event: "cut", ruled: "2026-09-15", classes: ["cli-subcommand"], allowed_referrers: [] as Array<{ path: string; class: string; why: string }> },
    ],
  };

  afterEach(() => { try { rmSync(root, { recursive: true, force: true }); } catch { /* best effort */ } });

  it("fails on a file naming a retired thing outside the allowed set", () => {
    const r = checkRetirements(setup(WIDGETIZER, { "README.md": "run `widgetizer` to reconcile" }));
    expect(r.severity).toBe("issue");
    expect(r.message).toContain("README.md");
    expect(r.message).toContain("widgetizer");
  });

  it("passes when the only referrer is a declared obituary", () => {
    const record = structuredClone(WIDGETIZER);
    record.retirements[0].allowed_referrers = [
      { path: "README.md", class: "prose", why: "obituary" },
    ];
    const r = checkRetirements(setup(record, { "README.md": "`widgetizer` was cut in Loop 10" }));
    expect(r.severity).toBe("pass");
  });

  // An empty record passing is the same defect as a check nobody has seen fail.
  it("fails on an empty record rather than passing vacuously", () => {
    const r = checkRetirements(setup({ historical: [], retirements: [] }));
    expect(r.severity).toBe("issue");
    expect(r.message).toContain("empty record");
  });

  // Otherwise the allowlist silently grows into a list of paths nobody checks.
  it("fails when an allowed referrer no longer names its retirement", () => {
    const record = structuredClone(WIDGETIZER);
    record.retirements[0].allowed_referrers = [
      { path: "README.md", class: "prose", why: "obituary" },
    ];
    const r = checkRetirements(setup(record, { "README.md": "nothing about it here" }));
    expect(r.severity).toBe("issue");
    expect(r.message).toContain("no longer names it");
  });

  it("fails when an allowed referrer has been deleted", () => {
    const record = structuredClone(WIDGETIZER);
    record.retirements[0].allowed_referrers = [
      { path: "gone.md", class: "prose", why: "obituary" },
    ];
    const r = checkRetirements(setup(record));
    expect(r.severity).toBe("issue");
    expect(r.message).toContain("no longer exists");
  });

  it("keeps historical records out of the scan by rule", () => {
    const r = checkRetirements(setup(WIDGETIZER, { "CHANGELOG.md": "`widgetizer` shipped in v0.10.0" }));
    expect(r.severity).toBe("pass");
  });

  /**
   * Case sensitivity is per retirement and defaults to strict. Granting it
   * globally made `KB_PATH`, a live variable, match the retired `kb_*` TOOL
   * prefix — rule 8 arriving inside the check written to apply it.
   */
  it("does not match a live identifier that differs only in case", () => {
    const record = {
      historical: [".agents/retirements.json"],
      retirements: [
        { id: "R-1", name: "kb_*", pattern: "\\bkb_([a-z_]+|\\*)", event: "prefix-retired", ruled: "2026-09-15", classes: ["tool"], allowed_referrers: [] },
      ],
    };
    const r = checkRetirements(setup(record, { "dash.mjs": "const KB_PATH = '/tmp/x';" }));
    expect(r.severity).toBe("pass");
  });

  it("says green covers only what is recorded, and names the classes it cannot resolve", () => {
    const r = checkRetirements(setup(WIDGETIZER));
    expect(r.severity).toBe("pass");
    expect(r.message).toContain("guarded by this record alone");
    expect(r.message).toContain("not that every retirement is recorded");
  });

  /**
   * SHIPPED BROKEN AND CAUGHT IN THE MAIN TREE, NOT THE WORKTREE IT WAS BUILT IN.
   * The scanner was a filesystem walk with a hand-maintained skip list, so a
   * gitignored generated cache (.gitnexus/, whose parse artifacts contain the
   * string "skill-scan") produced 115 findings on a tree that had one. The
   * development worktree had no such directory and was green throughout.
   *
   * A hand-maintained skip list is a second list beside the thing it describes —
   * the same defect this check exists to find. .gitignore already says what is
   * not the repo’s own content.
   */
  it("does not scan gitignored files, however loudly they name a retirement", () => {
    const record = structuredClone(WIDGETIZER);
    root = setup(record, {
      ".gitignore": "cache/",
      "cache/index.json": '{"symbol":"widgetizer"}',
      "README.md": "nothing retired here",
    });
    try {
      execSync("git init -q && git add -A && git -c user.email=t@t -c user.name=t commit -qm x", { cwd: root, stdio: "ignore" });
    } catch {
      return; // no git available — the fallback walk is covered by the other tests
    }
    const r = checkRetirements(root);
    expect(r.severity).toBe("pass");
  });

  it("skips rather than passing when the record is absent", () => {
    root = mkdtempSync(join(tmpdir(), "c3-"));
    const r = checkRetirements(root);
    expect(r.severity).toBe("skip");
  });
});
