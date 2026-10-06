import { describe, it, expect, afterEach } from "vitest";
import { mkdtempSync, rmSync, readFileSync, existsSync, chmodSync, constants } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { spawnSync } from "node:child_process";
import Database from "better-sqlite3";
import { initSchemaV2, openV2Database } from "../src/db-v2.js";
import {
  runScrubTriggerFires,
  SCRUB_HELD_STORE_MESSAGE,
  printScrubTriggerFiresResult,
} from "../src/scrub-trigger-fires.js";
import { commandCellToString, formatCommandFireLog } from "../src/trigger/command-log.js";

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

function plantRow(db: Database.Database, command: string): void {
  db.prepare(
    `INSERT INTO trigger_fires (session_uuid, command, query, state, injected_ids, created_at)
     VALUES (?, ?, '', 'silent', '[]', datetime('now'))`,
  ).run(SESSION, command);
}

function scrubCli(dbPath: string, ...extra: string[]): { status: number | null; stdout: string; stderr: string } {
  const r = spawnSync(
    process.execPath,
    [tsxCli, cliEntry, "scrub-trigger-fires", "--db", dbPath, ...extra],
    { encoding: "utf8", cwd: join(import.meta.dirname, "..") },
  );
  return { status: r.status, stdout: r.stdout ?? "", stderr: r.stderr ?? "" };
}

describe("AUDIT-FIX r7 — scrub-trigger-fires CLI", () => {
  const shapeCases: Array<{ label: string; command: string }> = [
    { label: "password", command: "p@ssw0rd deploy --token x" },
    { label: "token=", command: "cfg token=abc rest" },
    { label: "hunter2!", command: "run hunter2! --verbose" },
    { label: "nbsp", command: `git\u00a0status secret` },
    { label: "tab", command: "npm\ttest\tsecret" },
    { label: "newline", command: "node\n-e\nsecret" },
    { label: "uppercase", command: "GIT push secret" },
    { label: "equals", command: "export password=secret" },
    { label: "pipe", command: "echo secret | docker login" },
    { label: "semicolon", command: "a;curl secret" },
    { label: "colon", command: "http://user:pass@host" },
    { label: "slash", command: "curl https://host/secret/path" },
    { label: "at", command: "curl user@host.local" },
  ];

  for (const { label, command } of shapeCases) {
    it(`rewrites reviewer shape: ${label}`, () => {
      const td = mkdtempSync(join(tmpdir(), `audit-r7-${label}-`));
      tmpDirs.push(td);
      const dbPath = join(td, "k.db");
      const seed = new Database(dbPath);
      initSchemaV2(seed);
      plantRow(seed, command);
      seed.close();

      const first = runScrubTriggerFires(dbPath);
      expect(first.rowsRewritten).toBe(1);
      const probe = new Database(dbPath, { readonly: true });
      const row = probe.prepare("SELECT command FROM trigger_fires").get() as { command: string };
      expect(row.command).toBe(formatCommandFireLog(command));
      probe.close();
    });
  }

  it("treats NULL or BLOB command cells as text without throwing", () => {
    expect(formatCommandFireLog(commandCellToString(null))).toBe("?");
    expect(formatCommandFireLog(commandCellToString(Buffer.from("git push x", "utf8")))).toBe(
      "git",
    );
  });

  it("second run rewrites 0 rows (idempotent)", () => {
    const td = mkdtempSync(join(tmpdir(), "audit-r7-idem-"));
    tmpDirs.push(td);
    const dbPath = join(td, "k.db");
    const seed = new Database(dbPath);
    initSchemaV2(seed);
    plantRow(seed, "curl -H Bearer secret-token-xyz");
    seed.close();

    runScrubTriggerFires(dbPath);
    const second = runScrubTriggerFires(dbPath);
    expect(second.rowsRewritten).toBe(0);
  });

  it("exits non-zero with held-store message when another connection holds the db", () => {
    const td = mkdtempSync(join(tmpdir(), "audit-r7-busy-"));
    tmpDirs.push(td);
    const dbPath = join(td, "k.db");
    const seed = new Database(dbPath);
    initSchemaV2(seed);
    plantRow(seed, "curl secret");
    seed.close();

    const holder = new Database(dbPath);
    try {
      holder.exec("BEGIN IMMEDIATE");
      expect(() => runScrubTriggerFires(dbPath, { busyTimeoutMs: 50 })).toThrow(
        SCRUB_HELD_STORE_MESSAGE,
      );
    } finally {
      try {
        holder.exec("ROLLBACK");
      } catch {
        /* */
      }
      holder.close();
    }
  });

  it("Bearer secret absent from db+wal after successful scrub; CLI prints counts", () => {
    const td = mkdtempSync(join(tmpdir(), "audit-r7-bearer-"));
    tmpDirs.push(td);
    const dbPath = join(td, "k.db");
    const secret = "Bearer-planted-secret-unique-7f3a";
    const raw = `http --headers Authorization: ${secret}`;

    const seed = new Database(dbPath);
    initSchemaV2(seed);
    plantRow(seed, raw);
    seed.close();

    const result = runScrubTriggerFires(dbPath);
    expect(result.bytesFoundAfter).toBe(0);
    const buf = readFileSync(dbPath);
    expect(buf.includes(secret)).toBe(false);
    if (existsSync(`${dbPath}-wal`)) {
      expect(readFileSync(`${dbPath}-wal`).includes(secret)).toBe(false);
    }

    const out: string[] = [];
    const log = console.log;
    console.log = (line?: unknown) => {
      out.push(String(line));
    };
    printScrubTriggerFiresResult(result);
    console.log = log;
    expect(out.join("\n")).toContain("rows scanned: 1");
    expect(out.join("\n")).toContain("rows rewritten: 1");
    expect(out.join("\n")).toContain("bytes found after: 0");

    const cli = scrubCli(dbPath, "--dry-run");
    expect(cli.status).toBe(0);
    expect(cli.stdout).toContain("rows rewritten: 0");
  });
});

describe("AUDIT-FIX r7 — openV2Database without open-time migration", () => {
  it("does not rewrite trigger_fires.command on open (scrub is explicit)", () => {
    const td = mkdtempSync(join(tmpdir(), "audit-r7-no-open-scrub-"));
    tmpDirs.push(td);
    const dbPath = join(td, "knowledge-v2.db");

    const seed = new Database(dbPath);
    initSchemaV2(seed);
    const raw = "deploy --token still-raw-until-scrub";
    plantRow(seed, raw);
    seed.close();

    const db = openV2Database(dbPath);
    const row = db.prepare("SELECT command FROM trigger_fires").get() as { command: string };
    expect(row.command).toBe(raw);
    db.close();
  });
});
