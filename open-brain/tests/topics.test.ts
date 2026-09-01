import { describe, it, expect, beforeEach, afterEach } from "vitest";
import Database from "better-sqlite3";
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { initSchemaV2, indexKnowledge } from "../src/db-v2.js";
import { planTopics, writeTopics, TOPICS_MARKER, TYPE_TAGS } from "../src/pipelines/topics/index.js";

/**
 * Topic notes are the connective layer `vault-writer` never emits. They are a
 * browsing affordance only — nothing in retrieval follows a wikilink — so these
 * tests pin structure and safety, not relevance.
 */
function makeDb(): Database.Database {
  const db = new Database(":memory:");
  initSchemaV2(db);
  return db;
}

describe("topics generator", () => {
  let vault: string;
  let db: Database.Database;

  beforeEach(() => {
    vault = mkdtempSync(join(tmpdir(), "ob-topics-"));
    db = makeDb();
  });

  afterEach(() => {
    try { rmSync(vault, { recursive: true }); } catch { /* Windows race */ }
  });

  function seed(folder: string, name: string, tags: string) {
    const path = join(vault, "Experiences", folder, `${name}.md`);
    mkdirSync(join(vault, "Experiences", folder), { recursive: true });
    writeFileSync(path, `# ${name}\n`, "utf8");
    indexKnowledge(db, {
      vaultPath: path, key: `${folder}-${name}`, content: "c", tags, source: "agent", projectDir: null,
    });
  }

  it("groups entries by subject tag once the threshold is met", () => {
    for (let i = 0; i < 3; i++) seed("General", `convex-${i}`, "convex,deployment");
    const plans = planTopics(db, vault, { min: 3 });

    expect(plans.map((p) => p.tag).sort()).toEqual(["convex", "deployment"]);
    expect(plans[0].links).toHaveLength(3);
  });

  it("excludes type-shaped tags, which pile up rather than cluster", () => {
    for (let i = 0; i < 10; i++) seed("General", `g-${i}`, "gotcha,pattern,convex");
    const plans = planTopics(db, vault, { min: 3 });

    expect(plans.map((p) => p.tag)).toEqual(["convex"]);
    expect(TYPE_TAGS.has("gotcha")).toBe(true);
  });

  it("drops tags below the threshold", () => {
    seed("General", "lonely", "obscure-tag");
    for (let i = 0; i < 5; i++) seed("General", `common-${i}`, "docker");

    expect(planTopics(db, vault, { min: 5 }).map((p) => p.tag)).toEqual(["docker"]);
  });

  it("links by basename when it is unique", () => {
    for (let i = 0; i < 3; i++) seed("General", `unique-${i}`, "docker");
    const plans = planTopics(db, vault, { min: 3 });

    expect(plans[0].links).toContain("unique-0");
  });

  it("falls back to the vault-relative path when a basename repeats", () => {
    // Same filename in two project folders: a bare [[name]] would resolve to
    // whichever Obsidian picked, silently linking the wrong note.
    seed("ProjectA", "shared-name", "docker");
    seed("ProjectB", "shared-name", "docker");
    seed("General", "other", "docker");

    const plans = planTopics(db, vault, { min: 3 });

    expect(plans[0].links).toContain("Experiences/ProjectA/shared-name");
    expect(plans[0].links).toContain("Experiences/ProjectB/shared-name");
    expect(plans[0].links).toContain("other");
  });

  describe("writeTopics", () => {
    it("writes one marked note per tag", () => {
      for (let i = 0; i < 3; i++) seed("General", `d-${i}`, "docker");
      const result = writeTopics(vault, planTopics(db, vault, { min: 3 }));

      expect(result.written).toEqual(["docker.md"]);
      const text = readFileSync(join(vault, "Topics", "docker.md"), "utf8");
      expect(text).toContain(`generated: ${TOPICS_MARKER}`);
      expect(text).toContain("[[d-0]]");
    });

    it("removes a topic that has fallen below the threshold", () => {
      for (let i = 0; i < 3; i++) seed("General", `d-${i}`, "docker");
      writeTopics(vault, planTopics(db, vault, { min: 3 }));
      expect(existsSync(join(vault, "Topics", "docker.md"))).toBe(true);

      const result = writeTopics(vault, planTopics(db, vault, { min: 99 }));

      expect(result.removed).toEqual(["docker.md"]);
      expect(existsSync(join(vault, "Topics", "docker.md"))).toBe(false);
    });

    it("never touches a hand-written note in Topics/", () => {
      // v1's Maps of Content were hand-made. Clobbering one would destroy work
      // nobody asked us to touch, so the marker gates every write and delete.
      mkdirSync(join(vault, "Topics"), { recursive: true });
      const mine = join(vault, "Topics", "docker.md");
      writeFileSync(mine, "---\ntype: project\n---\nmy own notes\n", "utf8");
      for (let i = 0; i < 3; i++) seed("General", `d-${i}`, "docker");

      const result = writeTopics(vault, planTopics(db, vault, { min: 3 }));

      expect(result.skippedForeign).toContain("docker.md");
      expect(result.written).not.toContain("docker.md");
      expect(readFileSync(mine, "utf8")).toContain("my own notes");
    });

    it("is idempotent — a second run rewrites the same set", () => {
      for (let i = 0; i < 3; i++) seed("General", `d-${i}`, "docker");
      const plans = planTopics(db, vault, { min: 3 });

      const first = writeTopics(vault, plans);
      const second = writeTopics(vault, plans);

      expect(second.written).toEqual(first.written);
      expect(second.removed).toEqual([]);
      expect(second.skippedForeign).toEqual([]);
    });

    it("ignores archived entries", () => {
      for (let i = 0; i < 3; i++) seed("General", `d-${i}`, "docker");
      db.prepare(`UPDATE knowledge_index SET archived_into = 0 WHERE key = 'General-d-0'`).run();

      const plans = planTopics(db, vault, { min: 1 });
      expect(plans[0].links).toHaveLength(2);
    });
  });
});
