import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import Database from "better-sqlite3";
import { openV2Database, migrateAddedColumns, indexKnowledge } from "../../../src/db-v2.js";
import { runDream, censusByKind, loadLiveEntries } from "../../../src/pipelines/dream/index.js";
import { entry } from "./fixtures.js";

const NOW = new Date("2026-08-07T00:00:00Z");
const SINCE = new Date("2026-07-31T00:00:00Z");

let dir: string;
let dbPath: string;
let emptyTranscripts: string;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "dream-run-"));
  dbPath = join(dir, "knowledge-v2.db");
  // A transcript root that exists but holds nothing, so the window is genuinely
  // empty rather than accidentally reading the real ~/.claude/projects.
  emptyTranscripts = join(dir, "transcripts");
  mkdirSync(emptyTranscripts, { recursive: true });
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

function seed(db: Database.Database, rows: { key: string; content: string; factKind?: "state" | "event" }[]) {
  for (const r of rows) {
    indexKnowledge(db, {
      vaultPath: `Experiences/General/${r.key}.md`,
      key: r.key,
      tags: "",
      content: r.content,
      factKind: r.factKind ?? null,
    });
  }
}

describe("migrateAddedColumns", () => {
  it("adds fact_kind to a database created before the column existed", () => {
    // The pre-migration shape, minus fact_kind. `CREATE TABLE IF NOT EXISTS`
    // would silently no-op on this, which is the whole reason the migration
    // exists.
    const db = new Database(dbPath);
    db.exec(`
      CREATE TABLE knowledge_index (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        vault_path TEXT NOT NULL UNIQUE,
        key TEXT NOT NULL UNIQUE,
        content TEXT NOT NULL DEFAULT '',
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
    `);
    db.prepare(`INSERT INTO knowledge_index (vault_path, key, content, created_at, updated_at) VALUES (?, ?, ?, ?, ?)`)
      .run("a.md", "a", "legacy row", NOW.toISOString(), NOW.toISOString());

    expect(migrateAddedColumns(db)).toEqual(["knowledge_index.fact_kind"]);

    const row = db.prepare(`SELECT fact_kind FROM knowledge_index WHERE key = 'a'`).get() as { fact_kind: unknown };
    // Legacy rows are unclassified, not silently declared events.
    expect(row.fact_kind).toBeNull();
    db.close();
  });

  it("is a no-op on a database that already has the column", () => {
    const db = openV2Database(dbPath);
    expect(migrateAddedColumns(db)).toEqual([]);
    expect(migrateAddedColumns(db)).toEqual([]);
    db.close();
  });

  it("adds recall_trigger to a recall_log created before the column existed", () => {
    const db = new Database(dbPath);
    db.exec(`
      CREATE TABLE recall_log (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        session_uuid TEXT NOT NULL,
        query TEXT NOT NULL,
        knowledge_id INTEGER NOT NULL,
        rank INTEGER NOT NULL,
        created_at TEXT NOT NULL
      );
    `);
    db.prepare(`INSERT INTO recall_log (session_uuid, query, knowledge_id, rank, created_at) VALUES (?, ?, ?, ?, ?)`)
      .run("s", "q", 1, 1, NOW.toISOString());

    expect(migrateAddedColumns(db)).toEqual(["recall_log.recall_trigger"]);

    const row = db.prepare(`SELECT recall_trigger FROM recall_log`).get() as { recall_trigger: unknown };
    // Pre-column rows are unknowable, not silently declared explicit.
    expect(row.recall_trigger).toBeNull();
    db.close();
  });

  it("skips a table that does not exist rather than throwing on the ALTER", () => {
    // A bare DB with only knowledge_index: recall_log is the DDL's job, and
    // migrating a missing table used to die with "no such table".
    const db = new Database(dbPath);
    db.exec(`
      CREATE TABLE knowledge_index (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        vault_path TEXT NOT NULL UNIQUE,
        key TEXT NOT NULL UNIQUE,
        content TEXT NOT NULL DEFAULT '',
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
    `);
    expect(migrateAddedColumns(db)).toEqual(["knowledge_index.fact_kind"]);
    db.close();
  });
});

describe("runDream", () => {
  it("returns no candidates and no error on an empty corpus", () => {
    const db = openV2Database(dbPath);
    const { report, kindCensus } = runDream({ db, now: NOW, since: SINCE, transcriptsRoot: emptyTranscripts });
    expect(report.candidates).toHaveLength(0);
    expect(report.entriesExamined).toBe(0);
    expect(report.sessionsExamined).toHaveLength(0);
    expect(kindCensus).toEqual({ state: 0, event: 0, unclassified: 0, recorded: 0 });
    db.close();
  });

  it("is idempotent — a second run over an unchanged corpus proposes the same set", () => {
    const db = openV2Database(dbPath);
    seed(db, [
      { key: "db-location", content: "The database lives at ~/.claude/context-mode/knowledge.db currently." },
      { key: "db-location-v2", content: "Storage is now under open-brain. Override via KNOWLEDGE_V2_DB; defaults to WAL." },
      { key: "checkpoint-row", content: "[CHECKPOINT] Session 40 state." },
    ]);

    const first = runDream({ db, now: NOW, since: SINCE, transcriptsRoot: emptyTranscripts });
    const second = runDream({ db, now: NOW, since: SINCE, transcriptsRoot: emptyTranscripts });

    // The failure this guards is non-convergence: rejected findings resurfacing
    // every night forever.
    expect(second.report.candidates).toEqual(first.report.candidates);
    expect(second.kindCensus).toEqual(first.kindCensus);
    db.close();
  });

  it("never runs findStale — disuse does not discriminate", () => {
    const db = openV2Database(dbPath);
    seed(db, [{ key: "ancient", content: "Something nobody has needed in a year." }]);
    db.prepare(`UPDATE knowledge_index SET created_at = '2025-01-01T00:00:00.000Z', recall_count = 0`).run();

    const { report } = runDream({ db, now: NOW, since: SINCE, transcriptsRoot: emptyTranscripts });
    expect(report.candidates.some((c) => c.kind === "stale")).toBe(false);
    db.close();
  });

  it("excludes archived rows from the corpus it examines", () => {
    const db = openV2Database(dbPath);
    seed(db, [{ key: "live-one", content: "still here" }, { key: "gone", content: "[CHECKPOINT] archived" }]);
    db.prepare(`UPDATE knowledge_index SET archived_into = 1 WHERE key = 'gone'`).run();

    expect(loadLiveEntries(db)).toHaveLength(1);
    const { report } = runDream({ db, now: NOW, since: SINCE, transcriptsRoot: emptyTranscripts });
    expect(report.entriesExamined).toBe(1);
    expect(report.candidates.some((c) => c.kind === "misfiled")).toBe(false);
    db.close();
  });

  it("persists a recorded fact_kind through a store-and-read round trip", () => {
    const db = openV2Database(dbPath);
    seed(db, [{ key: "rate", content: "Retainer figure.", factKind: "state" }]);
    const [row] = loadLiveEntries(db);
    expect(row.fact_kind).toBe("state");
    db.close();
  });
});

describe("censusByKind", () => {
  it("counts recorded labels separately from inferred ones", () => {
    const census = censusByKind([
      entry({ id: 1, fact_kind: "state", content: "no markers" }),
      entry({ id: 2, fact_kind: "event", content: "no markers" }),
      entry({ id: 3, content: "The vault lives at ~/Obsidian Vault v2." }),
      entry({ id: 4, content: "## What was attempted\nA thing." }),
      entry({ id: 5, content: "Prose about nothing in particular." }),
    ]);
    expect(census).toEqual({ state: 2, event: 2, unclassified: 1, recorded: 2 });
  });
});
