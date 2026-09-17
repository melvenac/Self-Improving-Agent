import { describe, it, expect, beforeEach, afterEach } from "vitest";
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
    // The skill-scan stage resolves the vault from the environment rather than
    // from the vaultDir argument, so without this it writes SKILL-CANDIDATES.md
    // into the real vault whenever the suite runs. Same reason score-history and
    // shadow-log carry env overrides — see shared/paths.ts.
    process.env.OPEN_BRAIN_VAULT_DIR = vaultDir;
  });

  afterEach(() => {
    delete process.env.OPEN_BRAIN_VAULT_DIR;
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
      // This test is about the fallback arm's behaviour, so it opts in. The arm
      // is off by default — see the gate tests below.
      enableHeuristicRatings: true,
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

  it("stamps every rating with the resolver's origin, and unspecified when absent", () => {
    const seed = (key: string) => {
      indexKnowledge(db, {
        vaultPath: `/vault/Experiences/test/${key}.md`,
        key,
        tags: "typescript",
        content: "content",
      });
      return (db.prepare("SELECT id FROM knowledge_index WHERE key = ?").get(key) as { id: number }).id;
    };

    const withOrigin = seed("origin-stamped");
    sessionEndV2(makeInput(db, vaultDir, agentsDir, {
      recalledEntryIds: [withOrigin],
      recalledOrigin: "recall-log",
      enableHeuristicRatings: true,
    }));

    const withoutOrigin = seed("origin-absent");
    sessionEndV2(makeInput(db, vaultDir, agentsDir, {
      sessionId: "test-session-002",
      recalledEntryIds: [withoutOrigin],
      enableHeuristicRatings: true,
    }));

    const origins = db
      .prepare("SELECT knowledge_id, rating_origin FROM feedback_log ORDER BY id")
      .all() as Array<{ knowledge_id: number; rating_origin: string }>;
    expect(origins).toEqual([
      { knowledge_id: withOrigin, rating_origin: "recall-log" },
      { knowledge_id: withoutOrigin, rating_origin: "unspecified" },
    ]);
  });

  // Loop 7 R2. Fixing the session-uuid bug in cli-session-end.ts switches this
  // arm on for the first time in the rating_method column's life. It emits
  // `helpful` on a tag substring appearing in the summary — mentioned, not
  // worked — into a success_rate whose corpus mean (0.311) sits a hundredth
  // above the apoptosis threshold (0.3). The repair and the switch-on are kept
  // separate deliberately; these tests pin that separation.
  describe("heuristic rating arm gate", () => {
    const seedEntry = (key: string) => {
      indexKnowledge(db, {
        vaultPath: `/vault/Experiences/test/${key}.md`,
        key,
        tags: "typescript",
        content: "content",
      });
      return (db.prepare("SELECT id FROM knowledge_index WHERE key = ?").get(key) as { id: number }).id;
    };

    it("rates nothing when the agent supplied no judgment (default: arm off)", () => {
      const entryId = seedEntry("gated-off");
      const before = (db.prepare("SELECT helpful, neutral FROM knowledge_index WHERE id = ?")
        .get(entryId) as { helpful: number; neutral: number });

      const result = sessionEndV2(makeInput(db, vaultDir, agentsDir, {
        // A summary that WOULD match the tag, so the arm is only silent because
        // it is gated — not because the substring test failed.
        sessionSummary: "Worked on typescript all day",
        recalledEntryIds: [entryId],
      }));

      expect(result.feedback.processed).toBe(0);
      expect(result.feedback.ratings).toHaveLength(0);

      // Skipped, not recorded as neutral: a fallback neutral is indistinguishable
      // from a rater's considered "retrieved and not used".
      const after = (db.prepare("SELECT helpful, neutral FROM knowledge_index WHERE id = ?")
        .get(entryId) as { helpful: number; neutral: number });
      expect(after).toEqual(before);

      const events = db.prepare("SELECT COUNT(*) c FROM feedback_log").get() as { c: number };
      expect(events.c).toBe(0);
    });

    it("still records an explicit judgment while the arm is off", () => {
      const entryId = seedEntry("supplied-passes-gate");

      const result = sessionEndV2(makeInput(db, vaultDir, agentsDir, {
        sessionSummary: "nothing matching here",
        recalledEntryIds: [entryId],
        entryRatings: { [entryId]: "harmful" },
      }));

      expect(result.feedback.ratings).toEqual([{ id: entryId, rating: "harmful" }]);

      const row = db.prepare("SELECT rating, rating_method FROM feedback_log").get() as
        { rating: string; rating_method: string };
      expect(row).toEqual({ rating: "harmful", rating_method: "supplied" });
    });

    it("rates via the fallback only when explicitly enabled", () => {
      const entryId = seedEntry("gated-on");

      const result = sessionEndV2(makeInput(db, vaultDir, agentsDir, {
        sessionSummary: "Worked on typescript all day",
        recalledEntryIds: [entryId],
        enableHeuristicRatings: true,
      }));

      expect(result.feedback.ratings).toEqual([{ id: entryId, rating: "helpful" }]);

      const row = db.prepare("SELECT rating_method FROM feedback_log").get() as
        { rating_method: string };
      expect(row.rating_method).toBe("heuristic");
    });
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
      // Asserts feedback still runs under dryRun, which needs a rating to exist.
      enableHeuristicRatings: true,
    });

    const result = sessionEndV2(input);

    // Summary should NOT be written
    expect(result.summary.written).toBe(false);
    const summariesDir = path.join(vaultDir, "Summaries");
    expect(fs.existsSync(summariesDir)).toBe(false);

    // Feedback still runs in dry-run
    expect(result.feedback.processed).toBe(1);
    expect(result.feedback.ratings[0].rating).toBe("helpful");

  });
});

/**
 * Loop 10 C2 — the skill scan and its proposal machinery are CUT.
 *
 * Loop 9 R1 had already switched the generator off behind a flag; this loop
 * removed the code, because six months of operation produced 0 skills from 39
 * proposals none of which was ever acted on. These tests survive the deletion
 * because what they assert is still the guarantee that matters and is now
 * structural rather than flag-gated: a session end writes no pending file, and
 * it does not touch one left over from before. The third test in this block
 * pinned `result.skillScan`, a field that no longer exists, and went with it.
 *
 * `.skill-proposals-pending.json` is deliberately never deleted — the scan was
 * derived, not a store.
 */
describe("sessionEndV2 after the skill scan was cut (Loop 10 C2)", () => {
  let db: Database.Database;
  let vaultDir: string;
  let agentsDir: string;

  beforeEach(() => {
    db = makeDb();
    vaultDir = makeTempDir();
    agentsDir = makeTempDir();
    process.env.OPEN_BRAIN_VAULT_DIR = vaultDir;
  });

  afterEach(() => {
    delete process.env.OPEN_BRAIN_VAULT_DIR;
  });

  /**
   * Seeds notes the old generator would cluster on: three sharing one tag is
   * exactly the threshold it fired at. Without this the temp vault has no
   * Experiences/ dir, the pipeline returns early, and these tests pass whether
   * the flag is on or off - tests that cannot fail, which is the defect this
   * loop exists to catch. Verified by flipping SKILL_SCAN_ENABLED to true:
   * all three then go red.
   */
  function seedClusterableNotes() {
    const expDir = path.join(vaultDir, "Experiences", "proj");
    fs.mkdirSync(expDir, { recursive: true });
    for (const n of ["one", "two", "three"]) {
      fs.writeFileSync(
        path.join(expDir, `${n}.md`),
        `---\ntags: [idempotency, deployment]\n---\n\nACTION: do the thing\n`,
      );
    }
  }

  it("writes neither the pending marker nor SKILL-CANDIDATES.md", () => {
    seedClusterableNotes();

    sessionEndV2(makeInput(db, vaultDir, agentsDir, {
      sessionSummary: "session with clusterable notes present",
      project: "my-project",
    }));

    expect(fs.existsSync(path.join(vaultDir, ".skill-proposals-pending.json"))).toBe(false);
    expect(fs.existsSync(path.join(vaultDir, "Skill-Candidates", "SKILL-CANDIDATES.md"))).toBe(false);
  });

  it("does not overwrite or delete a pending file left over from before the ruling", () => {
    seedClusterableNotes();
    const p = path.join(vaultDir, ".skill-proposals-pending.json");
    const before = JSON.stringify([{ tag: "reference", count: 3, files: ["a"], date: "2026-09-01" }]);
    fs.writeFileSync(p, before);

    sessionEndV2(makeInput(db, vaultDir, agentsDir, {
      sessionSummary: "session after the ruling",
      project: "my-project",
    }));

    // Nothing is deleted — the scan is derived, not a store — and nothing is
    // rewritten either, because the generator never ran.
    expect(fs.readFileSync(p, "utf-8")).toBe(before);
  });
});
