import { describe, it, expect, beforeEach, afterEach } from "vitest";
import Database from "better-sqlite3";
import { mkdtempSync, mkdirSync, writeFileSync, existsSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { initSchemaV2, indexKnowledge, recordSession } from "../src/db-v2.js";
import { planRelocate, applyRelocate, detectMissingProjects } from "../src/relocate.js";

/**
 * A path used as an identity key breaks when the path is renamed, and the
 * breakage is silent: project-scoped recall returns a partial result shaped
 * exactly like a complete one.
 */
function makeDb(): Database.Database {
  const db = new Database(":memory:");
  initSchemaV2(db);
  return db;
}

describe("relocate", () => {
  let vault: string;
  let db: Database.Database;

  beforeEach(() => {
    vault = mkdtempSync(join(tmpdir(), "ob-relocate-"));
    db = makeDb();
  });

  afterEach(() => {
    try { rmSync(vault, { recursive: true }); } catch { /* Windows race */ }
  });

  function seedNote(folder: string, name: string, projectDir: string): string {
    const dir = join(vault, "Experiences", folder);
    mkdirSync(dir, { recursive: true });
    const path = join(dir, `${name}.md`);
    writeFileSync(path, `# ${name}\n`, "utf8");
    indexKnowledge(db, {
      vaultPath: path,
      key: `${folder}-${name}`,
      content: "content",
      tags: "alpha",
      source: "agent",
      projectDir,
    });
    return path;
  }

  it("counts the rows and notes a rename would move", () => {
    seedNote("Old Project", "one", "c:/users/x/projects/old project");
    seedNote("Old Project", "two", "c:/users/x/projects/old project");
    recordSession(db, "s1", "c:/users/x/projects/old project");

    const plan = planRelocate(db, vault, "c:/users/x/projects/old project", "c:/users/x/projects/old-project");

    expect(plan.knowledgeRows).toBe(2);
    expect(plan.sessionRows).toBe(1);
    expect(plan.noteMoves).toHaveLength(2);
    expect(plan.toDisplay).toBe("old-project");
  });

  it("moves rows, sessions and notes together", () => {
    const before = seedNote("Old Project", "one", "c:/users/x/projects/old project");
    recordSession(db, "s1", "c:/users/x/projects/old project");

    const plan = planRelocate(db, vault, "c:/users/x/projects/old project", "c:/users/x/projects/old-project");
    const result = applyRelocate(db, plan);

    expect(result.knowledgeRows).toBe(1);
    expect(result.sessionRows).toBe(1);
    expect(result.notesMoved).toBe(1);
    expect(result.noteFailures).toEqual([]);

    expect(existsSync(before)).toBe(false);
    expect(existsSync(join(vault, "Experiences", "old-project", "one.md"))).toBe(true);

    const row = db.prepare(`SELECT project_dir, vault_path FROM knowledge_index`).get() as
      { project_dir: string; vault_path: string };
    expect(row.project_dir).toBe("c:/users/x/projects/old-project");
    expect(row.vault_path).toContain("old-project");
  });

  it("refuses to overwrite a same-named note already in the target folder", () => {
    seedNote("Old Project", "clash", "c:/users/x/projects/old project");
    seedNote("old-project", "clash", "c:/users/x/projects/old-project");

    const plan = planRelocate(db, vault, "c:/users/x/projects/old project", "c:/users/x/projects/old-project");

    expect(plan.collisions).toHaveLength(1);
    expect(plan.noteMoves).toHaveLength(0);

    applyRelocate(db, plan);
    // Both notes still on disk — a name clash is two notes, not one to replace.
    expect(existsSync(join(vault, "Experiences", "Old Project", "clash.md"))).toBe(true);
    expect(existsSync(join(vault, "Experiences", "old-project", "clash.md"))).toBe(true);
  });

  it("leaves a note filed outside the project folder where it is", () => {
    const stray = join(vault, "Experiences", "General", "stray.md");
    mkdirSync(join(vault, "Experiences", "General"), { recursive: true });
    writeFileSync(stray, "# stray\n", "utf8");
    indexKnowledge(db, {
      vaultPath: stray, key: "stray", content: "c", tags: "alpha",
      source: "agent", projectDir: "c:/users/x/projects/old project",
    });

    const plan = planRelocate(db, vault, "c:/users/x/projects/old project", "c:/users/x/projects/old-project");
    expect(plan.noteMoves).toHaveLength(0);

    applyRelocate(db, plan);
    // Row is relocated; the note keeps its location.
    const row = db.prepare(`SELECT project_dir, vault_path FROM knowledge_index`).get() as
      { project_dir: string; vault_path: string };
    expect(row.project_dir).toBe("c:/users/x/projects/old-project");
    expect(row.vault_path).toBe(stray);
  });

  it("rejects a no-op rename rather than reporting a successful one", () => {
    expect(() => planRelocate(db, vault, "C:/Users/X/Projects/Thing", "c:\\users\\x\\projects\\thing"))
      .toThrow(/same value/);
  });

  describe("detectMissingProjects", () => {
    it("reports a project directory that no longer exists", () => {
      seedNote("Ghost", "one", "c:/users/x/projects/ghost-that-never-existed");

      const missing = detectMissingProjects(db);

      expect(missing).toHaveLength(1);
      expect(missing[0].projectDir).toBe("c:/users/x/projects/ghost-that-never-existed");
      expect(missing[0].entries).toBe(1);
    });

    it("does not report a directory that does exist", () => {
      const real = mkdtempSync(join(tmpdir(), "ob-real-project-"));
      try {
        seedNote("Real", "one", real.replace(/\\/g, "/").toLowerCase());
        expect(detectMissingProjects(db)).toHaveLength(0);
      } finally {
        try { rmSync(real, { recursive: true }); } catch { /* Windows race */ }
      }
    });

    it("ignores global entries, which have no directory to check", () => {
      indexKnowledge(db, {
        vaultPath: join(vault, "Experiences", "General", "g.md"),
        key: "g", content: "c", tags: "alpha", source: "agent", projectDir: null,
      });

      expect(detectMissingProjects(db)).toHaveLength(0);
    });
  });
});
