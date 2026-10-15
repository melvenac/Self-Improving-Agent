import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as fs from "node:fs";
import * as os from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import Database from "better-sqlite3";
import { initSchemaV2, initTriggerFires } from "../src/db-v2.js";
import { writeTriggerKeys } from "../src/trigger/keys-writer.js";
import { spawnAsync } from "./spawn-async.js";

/**
 * T-294: the registration snippet names the build that is running and the
 * D-157 file-half matcher. T-170 follow-ups: trigger-keys refuses stray args,
 * SessionEnd names a sidecar failure apart from the reconcile, and a failed
 * rename leaves no tmp file behind.
 */

const OPEN_BRAIN_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const TSX_CLI = join(OPEN_BRAIN_ROOT, "node_modules", "tsx", "dist", "cli.mjs");
const PLANNER_HOOK = join(OPEN_BRAIN_ROOT, "src", "cli-planner-hook.ts");
const CLI = join(OPEN_BRAIN_ROOT, "src", "cli.ts");
const SESSION_END = join(OPEN_BRAIN_ROOT, "src", "cli-session-end.ts");
const SPAWN_TIMEOUT = 120_000;

let dir: string;
beforeEach(() => {
  dir = fs.mkdtempSync(join(os.tmpdir(), "t294-"));
});
afterEach(() => fs.rmSync(dir, { recursive: true, force: true }));

function envWithout(...names: string[]): NodeJS.ProcessEnv {
  const env = { ...process.env };
  for (const n of names) delete env[n];
  return env;
}

async function printRegistration(...extra: string[]) {
  const r = await spawnAsync(process.execPath, [TSX_CLI, PLANNER_HOOK, "--print-registration", ...extra], {
    env: envWithout("CLAUDE_PROJECT_DIR"),
    cwd: dir,
  });
  const json = r.stdout
    .split(/\r?\n/)
    .filter((l) => !l.startsWith("#"))
    .join("\n");
  return { ...r, snippet: JSON.parse(json) as any };
}

function freshStore(p: string): void {
  const db = new Database(p);
  initSchemaV2(db);
  initTriggerFires(db);
  db.close();
}

describe("T-294 — the registration snippet", () => {
  it("P1: run from a non-repo cwd, the command names this build's cli-planner-hook.js", async () => {
    const r = await printRegistration();
    expect(r.status).toBe(0);
    expect(r.snippet.hooks.PreToolUse[0].hooks[0].command).toBe(
      `node "${join(OPEN_BRAIN_ROOT, "build", "cli-planner-hook.js")}"`,
    );
  }, SPAWN_TIMEOUT);

  it("P2: the default matcher is the D-157 file half", async () => {
    const r = await printRegistration();
    expect(r.snippet.hooks.PreToolUse[0].matcher).toBe("Edit|Write|NotebookEdit");
  }, SPAWN_TIMEOUT);

  it("P3: --all prints the full matcher", async () => {
    const r = await printRegistration("--all");
    expect(r.snippet.hooks.PreToolUse[0].matcher).toBe("Edit|Write|NotebookEdit|Bash|PowerShell");
  }, SPAWN_TIMEOUT);
});

describe("T-170 follow-ups", () => {
  async function triggerKeys(...extra: string[]) {
    return spawnAsync(process.execPath, [TSX_CLI, CLI, "trigger-keys", ...extra], {
      env: { ...process.env, KNOWLEDGE_V2_DB: join(dir, "absent", "knowledge-v2.db") },
      cwd: dir,
    });
  }

  it("K1: trigger-keys refuses a stray argument with exit 2", async () => {
    const r = await triggerKeys("--bogus");
    expect(r.status).toBe(2);
    expect(r.stderr).toContain("trigger-keys refused");
    expect(r.stderr).toContain("Nothing was run");
  }, SPAWN_TIMEOUT);

  it("K1b: trigger-keys with no store exits 1 and says so", async () => {
    const r = await triggerKeys();
    expect(r.status).toBe(1);
    expect(r.stdout).toContain("trigger keys: no store at");
  }, SPAWN_TIMEOUT);

  it("K2: a sidecar write that throws at SessionEnd says NOT REFRESHED, not NOT RECONCILED", async () => {
    const dbPath = join(dir, "store", "knowledge-v2.db");
    fs.mkdirSync(dirname(dbPath));
    freshStore(dbPath);
    fs.mkdirSync(join(dirname(dbPath), "recall-trigger-keys.json"));
    const r = await spawnAsync(process.execPath, [TSX_CLI, SESSION_END], {
      input: JSON.stringify({ session_id: "t294-k2", hook_event_name: "SessionEnd" }),
      env: {
        ...process.env,
        CLAUDE_PROJECT_DIR: dir,
        OPEN_BRAIN_VAULT_DIR: join(dir, "no-vault"),
        KNOWLEDGE_V2_DB: dbPath,
        RECALL_TRIGGER_LOG: join(dir, "store", "recall-trigger.log"),
      },
      cwd: dir,
    });
    expect(r.status).toBe(0);
    expect(r.stdout).toContain("trigger keys NOT REFRESHED");
    expect(r.stdout).not.toContain("NOT RECONCILED");
  }, SPAWN_TIMEOUT);

  it("K3: a rename that fails throws and leaves no .tmp- file", () => {
    const dbPath = join(dir, "knowledge-v2.db");
    freshStore(dbPath);
    const p = join(dir, "keys-target");
    fs.mkdirSync(p);
    const db = new Database(dbPath);
    try {
      expect(() => writeTriggerKeys(db, p)).toThrow();
    } finally {
      db.close();
    }
    expect(fs.readdirSync(dirname(p)).filter((n) => n.includes(".tmp-"))).toEqual([]);
  });
});
