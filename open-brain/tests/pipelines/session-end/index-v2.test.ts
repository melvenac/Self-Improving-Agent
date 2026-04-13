import { describe, it, expect, beforeEach } from "vitest";
import Database from "better-sqlite3";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { sessionEndV2, type SessionEndV2Input } from "../../../src/pipelines/session-end/index-v2.js";
import { initSchemaV2, indexKnowledge } from "../../../src/db-v2.js";

function makeTempDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), "session-end-v2-"));
}

function makeDb(): Database.Database {
  const db = new Database(":memory:");
  initSchemaV2(db);
  return db;
}

function makeInput(
  db: Database.Database,
  vaultDir: string,
  agentsDir: string,
  overrides: Partial<SessionEndV2Input> = {}
): SessionEndV2Input {
  return {
    db,
    vaultDir,
    agentsDir,
    sessionId: "test-session-001",
    sessionSummary: "Worked on typescript patterns and interfaces today",
    project: "test-project",
    recalledEntryIds: [],
    dryRun: false,
    ...overrides,
  };
}

describe("sessionEndV2", () => {
  let db: Database.Database;
  let vaultDir: string;
  let agentsDir: string;

  beforeEach(() => {
    db = makeDb();
    vaultDir = makeTempDir();
    agentsDir = makeTempDir();
  });

  it("writes session summary to vault Summaries/ dir", () => {
    const input = makeInput(db, vaultDir, agentsDir, {
      sessionSummary: "Session about typescript and dependency injection",
      project: "my-project",
    });

    const result = sessionEndV2(input);

    expect(result.summary.written).toBe(true);

    const summariesDir = path.join(vaultDir, "Summaries");
    expect(fs.existsSync(summariesDir)).toBe(true);

    const files = fs.readdirSync(summariesDir);
    expect(files.length).toBe(1);
    expect(files[0]).toMatch(/^\d{4}-\d{2}-\d{2}-my-project\.md$/);

    const content = fs.readFileSync(path.join(summariesDir, files[0]), "utf-8");
    expect(content).toContain("test-session-001");
    expect(content).toContain("Session about typescript and dependency injection");
  });

  it("runs auto-feedback on recalled entries", () => {
    // Seed an entry whose tags overlap with the session summary
    indexKnowledge(db, {
      vaultPath: "/vault/Experiences/test/typescript-patterns.md",
      key: "typescript-patterns",
      tags: "typescript,patterns",
      content: "Use interfaces for DI",
    });

    const row = db
      .prepare("SELECT id, helpful FROM knowledge_index WHERE key = ?")
      .get("typescript-patterns") as { id: number; helpful: number };

    expect(row).toBeDefined();
    const entryId = row.id;
    const helpfulBefore = row.helpful;

    const input = makeInput(db, vaultDir, agentsDir, {
      sessionSummary: "Worked on typescript patterns and interfaces today",
      recalledEntryIds: [entryId],
    });

    const result = sessionEndV2(input);

    expect(result.feedback.processed).toBe(1);
    expect(result.feedback.ratings).toHaveLength(1);
    expect(result.feedback.ratings[0].id).toBe(entryId);
    expect(result.feedback.ratings[0].rating).toBe("helpful");

    const updated = db
      .prepare("SELECT helpful FROM knowledge_index WHERE id = ?")
      .get(entryId) as { helpful: number };
    expect(updated.helpful).toBe(helpfulBefore + 1);
  });

  it("flags reflection clusters when 3+ entries share a tag", () => {
    // Seed 3 entries with the same tag to trigger cluster detection
    for (let i = 1; i <= 3; i++) {
      indexKnowledge(db, {
        vaultPath: `/vault/Experiences/test/entry-${i}.md`,
        key: `entry-${i}`,
        tags: "shared-tag,other",
        content: `Entry ${i} content`,
      });
    }

    const input = makeInput(db, vaultDir, agentsDir);
    const result = sessionEndV2(input);

    expect(result.reflection.flagged).toBeGreaterThan(0);

    const queuePath = path.join(agentsDir, "reflection-queue.json");
    expect(fs.existsSync(queuePath)).toBe(true);

    const queue = JSON.parse(fs.readFileSync(queuePath, "utf-8"));
    expect(queue.clusters).toBeDefined();
    const sharedTagCluster = queue.clusters.find(
      (c: { tag: string }) => c.tag === "shared-tag"
    );
    expect(sharedTagCluster).toBeDefined();
  });

  it("skips vault writes in dry-run mode", () => {
    // Seed an entry so feedback can still run
    indexKnowledge(db, {
      vaultPath: "/vault/Experiences/test/dry-run-entry.md",
      key: "dry-run-entry",
      tags: "typescript",
      content: "Entry for dry run test",
    });

    const row = db
      .prepare("SELECT id FROM knowledge_index WHERE key = ?")
      .get("dry-run-entry") as { id: number };

    const input = makeInput(db, vaultDir, agentsDir, {
      sessionSummary: "typescript was used extensively",
      recalledEntryIds: [row.id],
      dryRun: true,
    });

    const result = sessionEndV2(input);

    // Summary should NOT be written
    expect(result.summary.written).toBe(false);
    const summariesDir = path.join(vaultDir, "Summaries");
    expect(fs.existsSync(summariesDir)).toBe(false);

    // Feedback still runs in dry-run
    expect(result.feedback.processed).toBe(1);
    expect(result.feedback.ratings[0].rating).toBe("helpful");

    // Reflection queue should NOT be written
    const queuePath = path.join(agentsDir, "reflection-queue.json");
    expect(fs.existsSync(queuePath)).toBe(false);
    expect(result.reflection.flagged).toBe(0);
  });
});
