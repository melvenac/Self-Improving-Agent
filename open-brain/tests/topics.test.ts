import { describe, it, expect, beforeEach, afterEach } from "vitest";
import Database from "better-sqlite3";
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { initSchemaV2, indexKnowledge } from "../src/db-v2.js";
import {
  planTopics, writeTopics, findOrphans,
  TOPICS_MARKER, TYPE_TAGS, UNSORTED_TOPIC,
} from "../src/pipelines/topics/index.js";

/**
 * Topic notes are the connective layer `vault-writer` never emitted. They are a
 * browsing affordance only — nothing in retrieval follows a wikilink — so these
 * tests pin structure, safety, and the no-orphan guarantee, not relevance.
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

  function seed(folder: string, name: string, tags: string, projectDir: string | null = null) {
    const path = join(vault, "Experiences", folder, `${name}.md`);
    mkdirSync(join(vault, "Experiences", folder), { recursive: true });
    writeFileSync(path, `# ${name}\n`, "utf8");
    indexKnowledge(db, {
      vaultPath: path, key: `${folder}-${name}`, content: "c", tags, source: "agent", projectDir,
    });
  }

  function seedSummary(name: string, project: string, tags?: string) {
    mkdirSync(join(vault, "Summaries"), { recursive: true });
    const fm = ["---", `sessionId: s-${name}`, `project: ${project}`, "date: 2026-09-01"];
    if (tags) fm.push(`tags: [${tags}]`);
    fm.push("---", "", "session notes", "");
    writeFileSync(join(vault, "Summaries", `${name}.md`), fm.join("\n"), "utf8");
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

  it("gives a below-threshold tag no topic of its own — but does not strand the note", () => {
    seed("General", "lonely", "obscure-tag");
    for (let i = 0; i < 5; i++) seed("General", `common-${i}`, "docker");

    const plans = planTopics(db, vault, { min: 5 });

    expect(plans.map((p) => p.tag)).not.toContain("obscure-tag");
    expect(findOrphans(db, vault, { min: 5 })).toEqual([]);
  });

  it("links by basename when it is unique", () => {
    for (let i = 0; i < 3; i++) seed("General", `unique-${i}`, "docker");
    expect(planTopics(db, vault, { min: 3 })[0].links).toContain("unique-0");
  });

  it("falls back to the vault-relative path when a basename repeats", () => {
    // Same filename in two project folders: a bare [[name]] would resolve to
    // whichever Obsidian picked, silently linking the wrong note.
    seed("ProjectA", "shared-name", "docker");
    seed("ProjectB", "shared-name", "docker");
    seed("General", "other", "docker");

    const links = planTopics(db, vault, { min: 3 })[0].links;

    expect(links).toContain("Experiences/ProjectA/shared-name");
    expect(links).toContain("Experiences/ProjectB/shared-name");
    expect(links).toContain("other");
  });

  describe("the no-orphan guarantee", () => {
    // The fallbacks are deliberately NOT gated by `min`. A threshold that can
    // strand a note would make "no orphans" a hope rather than a guarantee.
    it("falls back to the project when no tag qualifies", () => {
      seed("Widgets", "only-note", "very-rare-tag", "c:/users/x/projects/widgets");

      const plans = planTopics(db, vault, { min: 5 });

      expect(plans.map((p) => p.tag)).toContain("widgets");
      expect(findOrphans(db, vault, { min: 5 })).toEqual([]);
    });

    it("falls back to unsorted when there is no tag and no project", () => {
      seed("General", "nothing-at-all", "");

      const plans = planTopics(db, vault, { min: 5 });

      expect(plans.map((p) => p.tag)).toContain(UNSORTED_TOPIC);
      expect(findOrphans(db, vault, { min: 5 })).toEqual([]);
    });

    it("does not treat 'General' as a project — that is unsorted, named honestly", () => {
      seed("General", "generic", "rare", "general");

      const plans = planTopics(db, vault, { min: 5 });

      expect(plans.map((p) => p.tag)).not.toContain("general");
      expect(plans.map((p) => p.tag)).toContain(UNSORTED_TOPIC);
    });

    it("leaves nothing orphaned across a mixed corpus", () => {
      for (let i = 0; i < 6; i++) seed("General", `d-${i}`, "docker");
      seed("General", "typed-only", "gotcha,pattern");
      seed("Widgets", "project-only", "", "c:/users/x/projects/widgets");
      seed("General", "bare", "");
      seedSummary("2026-09-01-widgets", "Widgets");
      seedSummary("2026-09-01-nothing", "");

      expect(findOrphans(db, vault, { min: 5 })).toEqual([]);
    });
  });

  describe("summaries", () => {
    it("groups a summary under its project", () => {
      seedSummary("2026-09-01-widgets", "Widgets");

      const plans = planTopics(db, vault, { min: 5 });
      const widgets = plans.find((p) => p.tag === "widgets");

      expect(widgets?.links).toContain("2026-09-01-widgets");
    });

    it("puts a summary under its project even when its tags also qualify", () => {
      for (let i = 0; i < 5; i++) seed("General", `d-${i}`, "docker");
      seedSummary("2026-09-01-widgets", "Widgets", "docker, session-summary");

      const plans = planTopics(db, vault, { min: 5 });

      expect(plans.find((p) => p.tag === "widgets")?.links).toContain("2026-09-01-widgets");
      expect(plans.find((p) => p.tag === "docker")?.links).toContain("2026-09-01-widgets");
    });

    it("treats session-summary as a type tag, not a subject", () => {
      expect(TYPE_TAGS.has("session-summary")).toBe(true);
    });

    it("sends a projectless summary to unsorted rather than dropping it", () => {
      seedSummary("2026-09-01-orphan", "");

      const plans = planTopics(db, vault, { min: 5 });

      expect(plans.find((p) => p.tag === UNSORTED_TOPIC)?.links).toContain("2026-09-01-orphan");
    });
  });

  describe("writeTopics", () => {
    it("writes one marked note per tag", () => {
      for (let i = 0; i < 3; i++) seed("General", `d-${i}`, "docker");
      const result = writeTopics(vault, planTopics(db, vault, { min: 3 }));

      expect(result.written).toContain("docker.md");
      const text = readFileSync(join(vault, "Topics", "docker.md"), "utf8");
      expect(text).toContain(`generated: ${TOPICS_MARKER}`);
      expect(text).toContain("[[d-0]]");
    });

    it("removes a topic that no longer has a plan", () => {
      for (let i = 0; i < 3; i++) seed("General", `d-${i}`, "docker");
      writeTopics(vault, planTopics(db, vault, { min: 3 }));
      expect(existsSync(join(vault, "Topics", "docker.md"))).toBe(true);

      // Raising the threshold moves these notes to unsorted; docker.md must go.
      const result = writeTopics(vault, planTopics(db, vault, { min: 99 }));

      expect(result.removed).toContain("docker.md");
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

      expect(planTopics(db, vault, { min: 1 })[0].links).toHaveLength(2);
    });
  });
});
