import { describe, it, expect, afterEach } from "vitest";
import { mkdtempSync, rmSync, readFileSync, chmodSync, constants, existsSync } from "node:fs";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";
import Database from "better-sqlite3";
import { initSchemaV2, initTriggerFires } from "../src/db-v2.js";
import { runScrubTriggerFires } from "../src/scrub-trigger-fires.js";
import { commandCellToString, formatCommandFireLog } from "../src/trigger/command-log.js";

const SESSION = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee";

const PLANTED_SECRETS = [
  "Bearer-planted-r9-kill-probe-alpha",
  "supersecret-token-r9-beta-9f2c",
] as const;

let tmpDirs: string[] = [];

afterEach(() => {
  for (const d of tmpDirs) {
    try {
      chmodSync(d, constants.S_IRWXU);
    } catch {
      /* */
    }
    rmSync(d, { recursive: true, force: true, maxRetries: 3, retryDelay: 50 });
  }
  tmpDirs = [];
});

function countSecretBytes(paths: string[], secret: string): number {
  const needle = Buffer.from(secret, "utf8");
  let n = 0;
  for (const p of paths) {
    if (!existsSync(p)) continue;
    const hay = readFileSync(p);
    for (let i = 0; i <= hay.length - needle.length; i += 1) {
      if (hay.subarray(i, i + needle.length).equals(needle)) n += 1;
    }
  }
  return n;
}

/** Simulate scrub interrupted after UPDATE commit, before VACUUM. */
function simulateUpdateCommittedWithoutVacuum(dbPath: string): void {
  const db = new Database(dbPath, { fileMustExist: true });
  initTriggerFires(db);
  const pending: Array<{ id: number; after: string }> = [];
  const rows = db.prepare("SELECT id, command FROM trigger_fires").all() as Array<{
    id: number;
    command: unknown;
  }>;
  for (const row of rows) {
    const before = commandCellToString(row.command);
    const after = formatCommandFireLog(before);
    if (after !== before) pending.push({ id: row.id, after });
  }
  const update = db.prepare("UPDATE trigger_fires SET command = ? WHERE id = ?");
  const apply = db.transaction(() => {
    for (const { id, after } of pending) update.run(after, id);
  });
  apply();
  db.close();
}

describe("AUDIT-FIX r9 — always VACUUM after secure_delete", () => {
  it("rerun after simulated kill removes planted secret bytes from k.db and -wal", () => {
    const td = mkdtempSync(join(tmpdir(), "audit-r9-kill-"));
    tmpDirs.push(td);
    const dbPath = join(td, "k.db");

    const seed = new Database(dbPath);
    initSchemaV2(seed);
    for (const secret of PLANTED_SECRETS) {
      const raw = `curl --header Authorization:${secret} https://example.test`;
      seed
        .prepare(
          `INSERT INTO trigger_fires (session_uuid, command, query, state, injected_ids, created_at)
           VALUES (?, ?, '', 'silent', '[]', datetime('now'))`,
        )
        .run(SESSION, raw);
    }
    seed.close();

    simulateUpdateCommittedWithoutVacuum(dbPath);

    const pathsAfterKill = [dbPath, `${dbPath}-wal`];
    const beforeRerun = PLANTED_SECRETS.reduce(
      (sum, s) => sum + countSecretBytes(pathsAfterKill, s),
      0,
    );
    expect(beforeRerun).toBeGreaterThan(0);

    const result = runScrubTriggerFires(resolve(dbPath));
    expect(result.rowsRewritten).toBe(0);

    const afterRerun = PLANTED_SECRETS.reduce(
      (sum, s) => sum + countSecretBytes(pathsAfterKill, s),
      0,
    );
    expect(afterRerun).toBe(0);

    runScrubTriggerFires(resolve(dbPath));
  });
});
