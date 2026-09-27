/**
 * T-048 round 2. Each row fails at 1646567: the two situations share one
 * value, and the session-end line does not name them.
 */
import { describe, it, expect, afterEach } from "vitest";
import Database from "better-sqlite3";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { initSchemaV2, indexKnowledge } from "../src/db-v2.js";
import { formatSessionEndLines, sessionEndV2, type SessionEndV2Input } from "../src/pipelines/session-end/index-v2.js";
import { readLastInvocationTs } from "../src/pipelines/session-end/invocation-logger.js";
import { scorePipelineHealth } from "../src/pipelines/sync/scorer.js";

const dirs: string[] = [];
function scratch(): string {
  const dir = mkdtempSync(join(tmpdir(), "t048-r2-"));
  dirs.push(dir);
  return dir;
}
afterEach(() => {
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true, maxRetries: 3, retryDelay: 50 });
});

function memoryDb(): Database.Database {
  const db = new Database(":memory:");
  initSchemaV2(db);
  return db;
}

function seed(db: Database.Database, key: string): number {
  indexKnowledge(db, {
    vaultPath: `/vault/Experiences/test/${key}.md`,
    key,
    tags: "typescript",
    content: "content",
  });
  return (db.prepare("SELECT id FROM knowledge_index WHERE key = ?").get(key) as { id: number }).id;
}

function linesFor(db: Database.Database, overrides: Partial<SessionEndV2Input>): string {
  const vault = scratch();
  const result = sessionEndV2({
    db,
    vaultDir: vault,
    agentsDir: scratch(),
    sessionId: "test-session-001",
    sessionSummary: "Worked on typescript patterns",
    project: "test-project",
    recalledEntryIds: [],
    dryRun: true,
    ...overrides,
  });
  return formatSessionEndLines(result).join("\n");
}

function writeSessionDb(dir: string, name: string, setup: (db: Database.Database) => void): void {
  const db = new Database(join(dir, name));
  setup(db);
  db.close();
}

describe("T-048 round 2", () => {
  it("SILENT 5 names a vanished knowledge row separately from an omitted judgment", () => {
    const db = memoryDb();
    const omitted = seed(db, "still-here");
    const vanished = 999001;
    const before = db.prepare("SELECT neutral FROM knowledge_index WHERE id = ?").get(omitted) as { neutral: number };

    const text = linesFor(db, {
      recalledEntryIds: [vanished, omitted],
      sessionSummary: "Worked on typescript all day",
    });

    expect(text, "the missing row is named").toContain(
      `Feedback vanished: ${vanished} (no knowledge_index row)`,
    );
    expect(text, "the omitted judgment is named on its own line").toContain(
      `Feedback omitted: ${omitted} (no judgment)`,
    );
    expect(text, "the two ids are not one gap").not.toContain(
      `Feedback vanished: ${vanished}, ${omitted}`,
    );
    const after = db.prepare("SELECT neutral FROM knowledge_index WHERE id = ?").get(omitted) as { neutral: number };
    expect(after.neutral, "an omitted judgment is not recorded as neutral").toBe(before.neutral);
  });

  it("SILENT 16 counts only a feedback_log write that landed, and names the one that threw", () => {
    const db = memoryDb();
    const id = seed(db, "rated");
    const before = db.prepare("SELECT helpful FROM knowledge_index WHERE id = ?").get(id) as { helpful: number };
    db.exec("DROP TABLE feedback_log");

    const text = linesFor(db, {
      recalledEntryIds: [id],
      entryRatings: { [id]: "helpful" },
    });

    expect(text, "a thrown write is not counted").toContain("Feedback: 0 entries");
    expect(text, "the thrown write is named").toContain(`Feedback NOT WRITTEN: ${id}`);
    const after = db.prepare("SELECT helpful FROM knowledge_index WHERE id = ?").get(id) as { helpful: number };
    expect(after.helpful, "the counter moves only with the event row").toBe(before.helpful);
  });

  it("SILENT 6 tells a corrupt log from an unreadable log, and the health score says which", () => {
    const dir = scratch();
    const corrupt = join(dir, "corrupt.jsonl");
    writeFileSync(corrupt, "garbage\n{not json}\n");
    const unreadable = join(dir, "not-a-file");
    mkdirSync(unreadable);
    const missing = join(dir, "missing.jsonl");

    const corruptRead = readLastInvocationTs(corrupt);
    const unreadableRead = readLastInvocationTs(unreadable);
    expect(corruptRead, "a corrupt log is not the missing-file null").not.toBeNull();
    expect(unreadableRead, "an unreadable log is not the missing-file null").not.toBeNull();
    expect(String(corruptRead)).toContain("corrupt");
    expect(String(unreadableRead)).toContain("unreadable");
    expect(String(corruptRead)).not.toContain("unreadable");
    expect(readLastInvocationTs(missing), "a missing log stays null").toBeNull();

    const corruptScore = scorePipelineHealth({ lastHookRun: corruptRead, scoreTrend: "unknown" });
    const unreadableScore = scorePipelineHealth({ lastHookRun: unreadableRead, scoreTrend: "unknown" });
    expect(JSON.stringify(corruptScore.details), "the score names corrupt").toContain("corrupt");
    expect(JSON.stringify(unreadableScore.details), "the score names unreadable").toContain("unreadable");
    expect(JSON.stringify(corruptScore.details)).not.toContain("unreadable");
  });

  it("SILENT 14 says an unreadable session db is not 'no db holds this session'", () => {
    const unreadableDir = scratch();
    writeFileSync(join(unreadableDir, "bad.db"), "not a sqlite database");
    const absentDir = scratch();
    writeSessionDb(absentDir, "other.db", (db) => {
      db.exec("CREATE TABLE session_meta (session_id TEXT)");
      db.prepare("INSERT INTO session_meta (session_id) VALUES (?)").run("someone-else");
    });

    const unreadable = linesFor(memoryDb(), {
      sessionSummary: "",
      sessionId: "wanted-session",
      sessionsDir: unreadableDir,
    });
    const absent = linesFor(memoryDb(), {
      sessionSummary: "",
      sessionId: "wanted-session",
      sessionsDir: absentDir,
    });

    expect(unreadable).toContain("Summary: skipped — unreadable while finding session db");
    expect(absent).toContain("Summary: skipped — no db holds this session");
    expect(absent).not.toContain("unreadable while finding session db");
    expect(unreadable).not.toContain("no db holds this session");
  });

  it("SILENT 15 gives each summary-skip cause its own printed reason", () => {
    const cases: Array<[string, (dir: string) => void]> = [
      ["summary db unreadable", (dir) => writeFileSync(join(dir, "bad.db"), "not a sqlite database")],
      ["no session_events", (dir) => writeSessionDb(dir, "s.db", (db) => {
        db.exec("CREATE TABLE session_meta (session_id TEXT)");
      })],
      ["no session_meta", (dir) => writeSessionDb(dir, "s.db", (db) => {
        db.exec(`
          CREATE TABLE session_events (id INTEGER PRIMARY KEY, type TEXT, data TEXT, created_at TEXT);
          CREATE TABLE session_meta (session_id TEXT, project_dir TEXT, started_at TEXT, last_event_at TEXT, event_count INTEGER);
        `);
      })],
      ["no events", (dir) => writeSessionDb(dir, "s.db", (db) => {
        db.exec(`
          CREATE TABLE session_events (id INTEGER PRIMARY KEY, type TEXT, data TEXT, created_at TEXT);
          CREATE TABLE session_meta (session_id TEXT, project_dir TEXT, started_at TEXT, last_event_at TEXT, event_count INTEGER);
        `);
        db.prepare(
          "INSERT INTO session_meta (session_id, project_dir, started_at, last_event_at, event_count) VALUES (?, ?, ?, ?, ?)",
        ).run("s", "/tmp/proj", "t", "t", 0);
      })],
    ];

    for (const [reason, setup] of cases) {
      const dir = scratch();
      setup(dir);
      const text = linesFor(memoryDb(), { sessionSummary: "", sessionId: "", sessionsDir: dir });
      expect(text, reason).toContain(`Summary: skipped — ${reason}`);
    }
  });
});
