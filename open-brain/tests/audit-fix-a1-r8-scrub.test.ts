import { describe, it, expect, afterEach } from "vitest";
import { mkdtempSync, rmSync, readFileSync, chmodSync, constants, existsSync } from "node:fs";
import { createHash } from "node:crypto";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { spawnSync } from "node:child_process";
import Database from "better-sqlite3";
import { initSchemaV2, indexKnowledge } from "../src/db-v2.js";
import { runScrubTriggerFires, SCRUB_READONLY_STORE_MESSAGE } from "../src/scrub-trigger-fires.js";

const SESSION = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee";
const cliEntry = join(import.meta.dirname, "../src/cli.ts");
const tsxCli = join(import.meta.dirname, "../node_modules/tsx/dist/cli.mjs");

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

function scrubCli(...args: string[]): { status: number | null; stdout: string; stderr: string } {
  const r = spawnSync(process.execPath, [tsxCli, cliEntry, "scrub-trigger-fires", ...args], {
    encoding: "utf8",
    cwd: join(import.meta.dirname, ".."),
  });
  return { status: r.status, stdout: r.stdout ?? "", stderr: r.stderr ?? "" };
}

function fileSha256(path: string): string {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

describe("AUDIT-FIX r8 — scrub structural verification and CLI guards", () => {
  it('exits 0 when knowledge_index contains "npm run build" and trigger row is scrubbed to npm', () => {
    const td = mkdtempSync(join(tmpdir(), "audit-r8-npm-"));
    tmpDirs.push(td);
    const dbPath = join(td, "k.db");

    const seed = new Database(dbPath);
    initSchemaV2(seed);
    indexKnowledge(seed, {
      vaultPath: "note.md",
      key: "build-note",
      content: "Use npm run build for releases.",
      tags: "",
      source: "test",
    });
    seed
      .prepare(
        `INSERT INTO trigger_fires (session_uuid, command, query, state, injected_ids, created_at)
         VALUES (?, ?, '', 'silent', '[]', datetime('now'))`,
      )
      .run(SESSION, "npm run build --secret-token");
    seed.close();

    const result = runScrubTriggerFires(resolve(dbPath));
    expect(result.rowsRewritten).toBe(1);
    runScrubTriggerFires(resolve(dbPath));
  });

  it("refuses empty --db with exit 2", () => {
    const r = scrubCli("--db", "");
    expect(r.status).toBe(2);
    expect(r.stderr).toContain("non-empty");
  });

  it("refuses a missing store path", () => {
    const missing = join(tmpdir(), `no-such-store-${Date.now()}.db`);
    const r = scrubCli("--db", missing);
    expect(r.status).toBe(1);
    expect(r.stderr.length).toBeGreaterThan(0);
  });

  it("--dry-run leaves the database file hash unchanged and prints would rewrite", () => {
    const td = mkdtempSync(join(tmpdir(), "audit-r8-dry-"));
    tmpDirs.push(td);
    const dbPath = join(td, "k.db");

    const seed = new Database(dbPath);
    initSchemaV2(seed);
    seed
      .prepare(
        `INSERT INTO trigger_fires (session_uuid, command, query, state, injected_ids, created_at)
         VALUES (?, ?, '', 'silent', '[]', datetime('now'))`,
      )
      .run(SESSION, "curl https://secret.example");
    seed.close();

    const before = fileSha256(dbPath);
    const r = scrubCli("--db", dbPath, "--dry-run");
    expect(r.status).toBe(0);
    expect(r.stdout).toContain("would rewrite: 1");
    expect(r.stdout).not.toContain("rows rewritten:");
    expect(fileSha256(dbPath)).toBe(before);
    expect(existsSync(`${dbPath}-wal`)).toBe(false);
  });

  it("reports store is read-only for a read-only database file", () => {
    const td = mkdtempSync(join(tmpdir(), "audit-r8-ro-"));
    tmpDirs.push(td);
    const dbPath = join(td, "k.db");

    const seed = new Database(dbPath);
    initSchemaV2(seed);
    seed
      .prepare(
        `INSERT INTO trigger_fires (session_uuid, command, query, state, injected_ids, created_at)
         VALUES (?, ?, '', 'silent', '[]', datetime('now'))`,
      )
      .run(SESSION, "git status --secret");
    seed.close();

    chmodSync(dbPath, constants.S_IRUSR | constants.S_IRGRP | constants.S_IROTH);

    expect(() => runScrubTriggerFires(resolve(dbPath))).toThrow(SCRUB_READONLY_STORE_MESSAGE);

    chmodSync(dbPath, constants.S_IRUSR | constants.S_IWUSR);
  });
});
