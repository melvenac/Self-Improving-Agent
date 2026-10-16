import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import Database from 'better-sqlite3';
import { initSchemaV2, indexKnowledge } from '../../src/db-v2.js';
import { writeTriggerKeys } from '../../src/trigger/keys-writer.js';
import { triggerKeysPath } from '../../src/trigger/match-keys.js';
import { spawnAsync } from '../spawn-async.js';

/**
 * T-170 part (ii) step 2 (G-060) — Claude Code's `PowerShell` tool sends Bash's
 * payload shape (T-170-II-PS, docs/loops/t170-ii/powershell-reply.md). The recall
 * trigger admits that exact name, and the README registers it with `Bash|PowerShell`.
 *
 * `cli-recall-trigger` is NOT imported here: it calls `main()` at module load,
 * so every row goes through the spawned hook or reads README.md.
 */

const ROOT = path.join(import.meta.dirname, '..', '..');
const REPO = path.join(ROOT, '..');
const HOOK = path.join(ROOT, 'src', 'cli-recall-trigger.ts');
const TSX_CLI = path.join(ROOT, 'node_modules', 'tsx', 'dist', 'cli.mjs');
const SPAWN_TIMEOUT = 120_000;

const A_CONTENT = '[EXPERIENCE] a\nMATCH: command: `git show <ref>:<path>`\nACTION: use a forward slash in the path';

let dir: string;
beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 't170ii2-'));
});
afterEach(() => fs.rmSync(dir, { recursive: true, force: true, maxRetries: 3, retryDelay: 50 }));

function seed(dbPath: string, entries: Record<string, string>): Record<string, number> {
  const db = new Database(dbPath);
  try {
    initSchemaV2(db);
    const ids: Record<string, number> = {};
    for (const [key, content] of Object.entries(entries)) {
      indexKnowledge(db, { vaultPath: `${key}.md`, key, content, tags: '', source: 'test' });
      ids[key] = (db.prepare('SELECT id FROM knowledge_index WHERE key = ?').get(key) as { id: number }).id;
    }
    return ids;
  } finally {
    db.close();
  }
}

const pendingLines = (dbPath: string): string[] => {
  const p = path.join(path.dirname(dbPath), 'recall-trigger-pending.jsonl');
  return fs.existsSync(p) ? fs.readFileSync(p, 'utf-8').split('\n').filter((l) => l.trim() !== '') : [];
};

async function runHook(payload: unknown, env: Record<string, string>) {
  return spawnAsync(process.execPath, [TSX_CLI, HOOK], {
    input: JSON.stringify(payload),
    env: { ...process.env, ...env },
    cwd: ROOT,
  });
}

const ps = (command: string, session: string, event: string): Record<string, unknown> => ({
  session_id: session,
  hook_event_name: event,
  tool_name: 'PowerShell',
  tool_input: { command, description: 'probe' },
  duration_ms: 12,
  ...(event === 'PostToolUseFailure'
    ? { error: 'Exit code 128\nfatal: invalid object name', is_interrupt: false }
    : { tool_response: { stdout: '', stderr: '', interrupted: false, isImage: false } }),
});

type HookOut = { hookSpecificOutput: { hookEventName: string; additionalContext: string } };

/** Seed A, write the sidecar, run the hook on `payload`; returns A's id and the parsed answer. */
async function keyedRun(payload: Record<string, unknown>): Promise<{ A: number; out: HookOut }> {
  const dbPath = path.join(dir, 'knowledge-v2.db');
  const { a: A } = seed(dbPath, { a: A_CONTENT });
  const db = new Database(dbPath);
  try {
    writeTriggerKeys(db, triggerKeysPath(dbPath));
  } finally {
    db.close();
  }
  const r = await runHook(payload, {
    KNOWLEDGE_V2_DB: dbPath,
    RECALL_TRIGGER_LOG: path.join(dir, 'log.txt'),
  });
  expect(r.status).toBe(0);
  return { A, out: JSON.parse(r.stdout) as HookOut };
}

describe('W — the trigger admits Claude Code\'s PowerShell tool', () => {
  it('W1: a PowerShell PostToolUseFailure is answered as PostToolUseFailure, with the keyed entry', async () => {
    const { A, out } = await keyedRun(ps('git show nosuchref:src/a.ts', 'w1', 'PostToolUseFailure'));
    expect(out.hookSpecificOutput.hookEventName).toBe('PostToolUseFailure');
    expect(out.hookSpecificOutput.additionalContext).toContain(`[stored knowledge ${A}`);
  }, SPAWN_TIMEOUT);

  it('W2: a PowerShell PostToolUse is answered as PostToolUse, with the keyed entry', async () => {
    const { A, out } = await keyedRun(ps('git show nosuchref:src/a.ts', 'w2', 'PostToolUse'));
    expect(out.hookSpecificOutput.hookEventName).toBe('PostToolUse');
    expect(out.hookSpecificOutput.additionalContext).toContain(`[stored knowledge ${A}`);
  }, SPAWN_TIMEOUT);

  it('W3: no sidecar, a PowerShell call enters the census as a not-asked fire', async () => {
    const dbPath = path.join(dir, 'knowledge-v2.db');
    seed(dbPath, { a: A_CONTENT });
    const r = await runHook(ps('Get-ChildItem C:\\t170ii2', 'w3', 'PostToolUse'), {
      KNOWLEDGE_V2_DB: dbPath,
      RECALL_TRIGGER_LOG: path.join(dir, 'log.txt'),
    });
    expect(r.status).toBe(0);
    expect(r.stdout).toBe('');
    expect(pendingLines(dbPath)).toHaveLength(1);
  }, SPAWN_TIMEOUT);

  it('W4: a lower-case powershell tool name is not admitted', async () => {
    const dbPath = path.join(dir, 'knowledge-v2.db');
    seed(dbPath, { a: A_CONTENT });
    const db = new Database(dbPath);
    try {
      writeTriggerKeys(db, triggerKeysPath(dbPath));
    } finally {
      db.close();
    }
    const payload = ps('git show nosuchref:src/a.ts', 'w4', 'PostToolUseFailure');
    payload.tool_name = 'powershell';
    const r = await runHook(payload, {
      KNOWLEDGE_V2_DB: dbPath,
      RECALL_TRIGGER_LOG: path.join(dir, 'log.txt'),
    });
    expect(r.status).toBe(0);
    expect(r.stdout).toBe('');
    expect(pendingLines(dbPath)).toHaveLength(0);
  }, SPAWN_TIMEOUT);

  it('W5: no sidecar, a blank PowerShell command is still dropped', async () => {
    const dbPath = path.join(dir, 'knowledge-v2.db');
    seed(dbPath, { a: A_CONTENT });
    const r = await runHook(ps('   ', 'w5', 'PostToolUse'), {
      KNOWLEDGE_V2_DB: dbPath,
      RECALL_TRIGGER_LOG: path.join(dir, 'log.txt'),
    });
    expect(r.status).toBe(0);
    expect(r.stdout).toBe('');
    expect(pendingLines(dbPath)).toHaveLength(0);
  }, SPAWN_TIMEOUT);
});

describe('W6 — the README registers the trigger with Bash|PowerShell', () => {
  it('W6: both cli-recall-trigger.js lines in the "Register the hooks" jsonc block match Bash|PowerShell', () => {
    const text = fs.readFileSync(path.join(REPO, 'README.md'), 'utf-8').replace(/\r\n/g, '\n');
    const h = text.indexOf('**2. Register the hooks**');
    const o = text.indexOf('```jsonc', h);
    const c = text.indexOf('\n```', o + 1);
    expect([h >= 0, o >= 0, c >= 0]).toEqual([true, true, true]);
    const lines = text.slice(o, c).split('\n').filter((l) => l.includes('cli-recall-trigger.js'));
    expect(lines).toHaveLength(2);
    for (const line of lines) expect(line).toContain('"matcher": "Bash|PowerShell"');
  });
});
