import { describe, it, expect, beforeEach, afterEach } from "vitest";
import Database from "better-sqlite3";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { initSchemaV2, indexKnowledge, recordSession } from "../src/db-v2.js";
import { sessionEndV2 } from "../src/pipelines/session-end/index-v2.js";
import { recordMissingHandoff, type HandoffCheck } from "../src/shared/handoff-guard.js";
import { endRecordProjectDir } from "../src/shared/end-record-store.js";
import { recentFetchOk } from "../src/pipelines/session-start/tree-currency.js";
import { appendShadowLog, readShadowLog, type ShadowLogEntry } from "../src/pipelines/shadow/index.js";

// T-245 Option A: a doubled run of each stage is harmless.

const C: HandoffCheck = { status: "missing", since: "2026-10-11T00:00:00Z", branches: ["loop/x"], commits: 1, handoffs: [], unattributed: 0 };

describe("T-245 idempotent stages", () => {
  let tmp: string;
  let savedDb: string | undefined;

  beforeEach(() => {
    tmp = mkdtempSync(join(tmpdir(), "t245-"));
    savedDb = process.env.KNOWLEDGE_V2_DB;
    // endRecordProjectDir derives its store from this; without it the test
    // writes under the real ~/.claude/open-brain (G-044).
    process.env.KNOWLEDGE_V2_DB = join(tmp, "knowledge-v2.db");
  });

  afterEach(() => {
    if (savedDb === undefined) delete process.env.KNOWLEDGE_V2_DB;
    else process.env.KNOWLEDGE_V2_DB = savedDb;
    rmSync(tmp, { recursive: true, force: true });
  });

  const nonEmptyLines = (path: string) => readFileSync(path, "utf8").split("\n").filter((l) => l.trim());

  it("ID-1: recordMissingHandoff appends once per session", () => {
    recordMissingHandoff(tmp, "u-1", C);
    recordMissingHandoff(tmp, "u-1", C);
    expect(nonEmptyLines(join(endRecordProjectDir(tmp), ".missing-handoff.jsonl"))).toHaveLength(1);
  });

  it("ID-1b: a different session still appends", () => {
    recordMissingHandoff(tmp, "u-1", C);
    recordMissingHandoff(tmp, "u-2", C);
    expect(nonEmptyLines(join(endRecordProjectDir(tmp), ".missing-handoff.jsonl"))).toHaveLength(2);
  });

  it("ID-2: a fetch younger than the TTL is reused; an old or absent one is not", () => {
    const repo = join(tmp, "r");
    mkdirSync(repo);
    spawnSync("git", ["init", "-q", repo]);
    const marker = join(repo, ".git", "sia-fetch-ok");
    writeFileSync(marker, "x\n");
    const T0 = statSync(marker).mtimeMs;
    expect(recentFetchOk(repo, 120_000, T0 + 1000)).toEqual({ ok: true, at: new Date(T0).toISOString(), cause: null });
    expect(recentFetchOk(repo, 120_000, T0 + 200_000)).toBeNull();
    rmSync(marker);
    expect(recentFetchOk(repo, 120_000, T0)).toBeNull();
  });

  it("ID-3: a doubled session end writes one feedback row and moves the counter once", () => {
    const db = new Database(":memory:");
    initSchemaV2(db);
    const vault = mkdtempSync(join(tmpdir(), "t245-vault-"));
    const agents = mkdtempSync(join(tmpdir(), "t245-agents-"));
    try {
      indexKnowledge(db, {
        vaultPath: join(vault, "Experiences", "General", "e.md"), key: "e", content: "c", tags: "alpha", source: "agent", projectDir: undefined,
      });
      const id = (db.prepare(`SELECT id FROM knowledge_index WHERE key = ?`).get("e") as { id: number }).id;
      recordSession(db, "s1", null);
      const run = () =>
        sessionEndV2({
          db, vaultDir: vault, agentsDir: agents, sessionId: "s1",
          sessionSummary: "x", project: "General",
          recalledEntryIds: [id], entryRatings: { [id]: "harmful" }, dryRun: false,
        });
      run();
      run();
      expect((db.prepare(`SELECT COUNT(*) AS n FROM feedback_log`).get() as { n: number }).n).toBe(1);
      expect((db.prepare(`SELECT harmful FROM knowledge_index WHERE id = ?`).get(id) as { harmful: number }).harmful).toBe(1);
    } finally {
      for (const d of [vault, agents]) {
        try { rmSync(d, { recursive: true }); } catch { /* Windows race */ }
      }
    }
  });

  it("ID-4: the shadow log holds one line per session", () => {
    const log = join(tmp, "shadow.jsonl");
    const e = (u: string) => ({ date: "2026-10-11", session_uuid: u, queries: [], label_counts: {}, scores: {}, as_of: null, excluded_not_yet_created: 0 }) as unknown as ShadowLogEntry;
    expect(appendShadowLog(log, e("s1"))).toBe(true);
    expect(appendShadowLog(log, e("s1"))).toBe(false);
    expect(appendShadowLog(log, e("s2"))).toBe(true);
    expect(readShadowLog(log).map((x) => x.session_uuid)).toEqual(["s1", "s2"]);
  });
});
