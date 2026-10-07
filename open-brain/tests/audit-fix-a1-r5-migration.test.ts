import { describe, it, expect, afterEach } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import Database from "better-sqlite3";
import { initSchemaV2 } from "../src/db-v2.js";
import { runScrubTriggerFires } from "../src/scrub-trigger-fires.js";

const SESSION = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee";

let tmpDirs: string[] = [];

afterEach(() => {
  for (const d of tmpDirs) rmSync(d, { recursive: true, force: true, maxRetries: 3, retryDelay: 50 });
  tmpDirs = [];
});

describe("AUDIT-FIX A1 r5 — scrub trigger_fires.command", () => {
  it("rewrites a master-shape raw row with Bearer token; second scrub is a no-op", () => {
    const td = mkdtempSync(join(tmpdir(), "audit-r5-mig-"));
    tmpDirs.push(td);
    const dbPath = join(td, "knowledge-v2.db");

    const seed = new Database(dbPath);
    initSchemaV2(seed);
    const raw = "http --headers Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9";
    seed
      .prepare(
        `INSERT INTO trigger_fires (session_uuid, command, query, state, injected_ids, created_at)
         VALUES (?, ?, '', 'silent', '[]', datetime('now'))`,
      )
      .run(SESSION, raw);
    seed.close();

    runScrubTriggerFires(dbPath);
    const db1 = new Database(dbPath, { readonly: true });
    const afterFirst = db1.prepare("SELECT command FROM trigger_fires").get() as { command: string };
    expect(afterFirst.command).toBe("http");
    expect(afterFirst.command).not.toContain("eyJ");
    db1.close();

    const second = runScrubTriggerFires(dbPath);
    expect(second.rowsRewritten).toBe(0);
    const db2 = new Database(dbPath, { readonly: true });
    const afterSecond = db2.prepare("SELECT command FROM trigger_fires").get() as { command: string };
    expect(afterSecond.command).toBe("http");
    db2.close();
  });

  it("rewrites r4 hash rows to program-only", () => {
    const td = mkdtempSync(join(tmpdir(), "audit-r5-mig-r4-"));
    tmpDirs.push(td);
    const dbPath = join(td, "knowledge-v2.db");

    const seed = new Database(dbPath);
    initSchemaV2(seed);
    seed
      .prepare(
        `INSERT INTO trigger_fires (session_uuid, command, query, state, injected_ids, created_at)
         VALUES (?, ?, '', 'not-asked', '[]', datetime('now'))`,
      )
      .run(SESSION, "echo correct-horse #deadbeef0000");
    seed.close();

    runScrubTriggerFires(dbPath);
    const db = new Database(dbPath, { readonly: true });
    const row = db.prepare("SELECT command FROM trigger_fires").get() as { command: string };
    expect(row.command).toBe("echo");
    expect(row.command).not.toContain("correct");
    db.close();
  });
});
