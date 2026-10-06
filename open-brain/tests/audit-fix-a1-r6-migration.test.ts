import { describe, it, expect, afterEach } from "vitest";
import { mkdtempSync, rmSync, readFileSync, existsSync, chmodSync, constants } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import Database from "better-sqlite3";
import { initSchemaV2, openV2Database } from "../src/db-v2.js";
import {
  isTriggerFireCommandMigrationDone,
  runTriggerFireCommandMigration,
  TRIGGER_FIRE_COMMAND_MIGRATION_KEY,
} from "../src/trigger/fire-command-migration.js";
import {
  commandCellToString,
  formatCommandFireLog,
  migrateStoredCommandFireLog,
} from "../src/trigger/command-log.js";

const SESSION = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee";

let tmpDirs: string[] = [];

afterEach(() => {
  for (const d of tmpDirs) {
    try {
      chmodSync(d, constants.S_IRWXU);
    } catch {
      /* temp dir may already be gone */
    }
    rmSync(d, { recursive: true, force: true, maxRetries: 3, retryDelay: 50 });
  }
  tmpDirs = [];
});

function countSecretBytes(paths: string[], secrets: string[]): number {
  let hits = 0;
  for (const p of paths) {
    if (!existsSync(p)) continue;
    const buf = readFileSync(p);
    for (const secret of secrets) {
      if (buf.includes(secret)) hits += 1;
    }
  }
  return hits;
}

describe("AUDIT-FIX A1 r6 — trigger_fires migration hardening", () => {
  it("after open, no planted secret bytes remain in db or -wal", () => {
    const td = mkdtempSync(join(tmpdir(), "audit-r6-wal-"));
    tmpDirs.push(td);
    const dbPath = join(td, "knowledge-v2.db");
    const secrets: string[] = [];

    const seed = new Database(dbPath);
    initSchemaV2(seed);
    const insert = seed.prepare(
      `INSERT INTO trigger_fires (session_uuid, command, query, state, injected_ids, created_at)
       VALUES (?, ?, '', 'silent', '[]', datetime('now'))`,
    );
    for (let i = 0; i < 203; i++) {
      const secret = `probe-secret-${i.toString(16).padStart(8, "0")}-END`;
      secrets.push(secret);
      insert.run(SESSION, `curl -H "Authorization: Bearer ${secret}"`);
    }
    seed.close();

    const db = openV2Database(dbPath);
    db.close();

    const paths = [dbPath, `${dbPath}-wal`, `${dbPath}-shm`];
    expect(countSecretBytes(paths, secrets)).toBe(0);
  });

  it("runTriggerFireCommandMigration does not throw on a read-only connection", () => {
    const td = mkdtempSync(join(tmpdir(), "audit-r6-ro-"));
    tmpDirs.push(td);
    const dbPath = join(td, "knowledge-v2.db");

    const seed = new Database(dbPath);
    initSchemaV2(seed);
    seed
      .prepare(
        `INSERT INTO trigger_fires (session_uuid, command, query, state, injected_ids, created_at)
         VALUES (?, ?, '', 'silent', '[]', datetime('now'))`,
      )
      .run(SESSION, "deploy --token readonly-secret-xyzzy");
    seed.close();

    const ro = new Database(dbPath, { readonly: true });
    expect(() => runTriggerFireCommandMigration(ro)).not.toThrow();
    ro.close();

    openV2Database(dbPath).close();
  });

  it("retries migration after a lock prevented the first run", () => {
    const td = mkdtempSync(join(tmpdir(), "audit-r6-lock-"));
    tmpDirs.push(td);
    const dbPath = join(td, "knowledge-v2.db");
    const raw = "http --headers Authorization: Bearer locked-secret-abc";

    const seed = new Database(dbPath);
    initSchemaV2(seed);
    seed
      .prepare(
        `INSERT INTO trigger_fires (session_uuid, command, query, state, injected_ids, created_at)
         VALUES (?, ?, '', 'silent', '[]', datetime('now'))`,
      )
      .run(SESSION, raw);
    seed.close();

    const holder = new Database(dbPath);
    holder.exec("BEGIN IMMEDIATE");

    const blocked = new Database(dbPath);
    blocked.pragma("busy_timeout = 100");
    runTriggerFireCommandMigration(blocked);
    expect(isTriggerFireCommandMigrationDone(blocked)).toBe(false);
    blocked.close();

    holder.exec("ROLLBACK");
    holder.close();

    const after = openV2Database(dbPath);
    const row = after.prepare("SELECT command FROM trigger_fires").get() as { command: string };
    expect(row.command).toBe("http");
    expect(isTriggerFireCommandMigrationDone(after)).toBe(true);
    after.close();
  });

  it("does not throw on NULL or BLOB command cells", () => {
    expect(migrateStoredCommandFireLog(commandCellToString(null))).toBe("?");
    const blob = Buffer.from("git push secret-token", "utf8");
    expect(migrateStoredCommandFireLog(commandCellToString(blob))).toBe("git");
  });

  it("steady-state open skips migration when done-marker is set", () => {
    const td = mkdtempSync(join(tmpdir(), "audit-r6-marker-"));
    tmpDirs.push(td);
    const dbPath = join(td, "knowledge-v2.db");

    openV2Database(dbPath).close();

    const probe = new Database(dbPath);
    const row = probe
      .prepare("SELECT value FROM ob_store_meta WHERE key = ?")
      .get(TRIGGER_FIRE_COMMAND_MIGRATION_KEY) as { value: string };
    expect(row.value).toBe("1");
    probe.close();
  });
});

describe("AUDIT-FIX A1 r6 — accepted program-name secret limit", () => {
  it("stores a lowercase secret that is a valid program token (pinned behaviour)", () => {
    const secret = "winter2026";
    expect(formatCommandFireLog(secret)).toBe(secret);
    expect(formatCommandFireLog(`${secret} --password-stdin`)).toBe(secret);
  });
});
