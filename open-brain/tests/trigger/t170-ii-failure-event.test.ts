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
 * T-170 part (ii) step 1 (G-059) — Claude Code fires PostToolUseFailure, not
 * PostToolUse, for a Bash call that exits non-zero. The recall trigger answers
 * with the event it was called on, and the README registers it on that event.
 *
 * `cli-recall-trigger` is NOT imported here: it calls `main()` at module load,
 * so every row goes through the spawned hook.
 */

const ROOT = path.join(import.meta.dirname, '..', '..');
const REPO = path.join(ROOT, '..');
const HOOK = path.join(ROOT, 'src', 'cli-recall-trigger.ts');
const TSX_CLI = path.join(ROOT, 'node_modules', 'tsx', 'dist', 'cli.mjs');
const SPAWN_TIMEOUT = 120_000;

const A_CONTENT = '[EXPERIENCE] a\nMATCH: command: `git show <ref>:<path>`\nACTION: use a forward slash in the path';

let dir: string;
beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 't170ii-'));
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

const fail = (command: string, session: string): Record<string, unknown> => ({
  session_id: session,
  hook_event_name: 'PostToolUseFailure',
  tool_name: 'Bash',
  tool_input: { command },
  error: 'Exit code 128\nfatal: invalid object name',
  is_interrupt: false,
  duration_ms: 12,
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

describe('F — the trigger answers the event it was called on', () => {
  it('F1: a PostToolUseFailure payload is answered as PostToolUseFailure, with the keyed entry', async () => {
    const { A, out } = await keyedRun(fail('git show nosuchref:src/a.ts', 'f1'));
    expect(out.hookSpecificOutput.hookEventName).toBe('PostToolUseFailure');
    expect(out.hookSpecificOutput.additionalContext).toContain(`[stored knowledge ${A}`);
  }, SPAWN_TIMEOUT);

  it('F2: a PostToolUse payload is still answered as PostToolUse', async () => {
    const payload = fail('git show nosuchref:src/a.ts', 'f2');
    payload.hook_event_name = 'PostToolUse';
    delete payload.error;
    delete payload.is_interrupt;
    const { out } = await keyedRun(payload);
    expect(out.hookSpecificOutput.hookEventName).toBe('PostToolUse');
  }, SPAWN_TIMEOUT);

  it('F3: a lower-case postToolUseFailure is answered as PostToolUse', async () => {
    const payload = fail('git show nosuchref:src/a.ts', 'f3');
    payload.hook_event_name = 'postToolUseFailure';
    const { out } = await keyedRun(payload);
    expect(out.hookSpecificOutput.hookEventName).toBe('PostToolUse');
  }, SPAWN_TIMEOUT);

  it('F4: no sidecar, a not-asked failing command takes the T-159 fast path', async () => {
    const dbPath = path.join(dir, 'knowledge-v2.db');
    seed(dbPath, { a: A_CONTENT });
    const r = await runHook(fail('ls -la', 'f4'), {
      KNOWLEDGE_V2_DB: dbPath,
      RECALL_TRIGGER_LOG: path.join(dir, 'log.txt'),
    });
    expect(r.status).toBe(0);
    expect(r.stdout).toBe('');
    expect(pendingLines(dbPath)).toHaveLength(1);
  }, SPAWN_TIMEOUT);

  it('F6: no hook_event_name is answered as PostToolUse', async () => {
    const payload = fail('git show nosuchref:src/a.ts', 'f6');
    delete payload.hook_event_name;
    const { out } = await keyedRun(payload);
    expect(out.hookSpecificOutput.hookEventName).toBe('PostToolUse');
  }, SPAWN_TIMEOUT);
});

describe('F5 — the README registers the trigger on PostToolUseFailure', () => {
  it('F5: the "Register the hooks" jsonc block has a PostToolUseFailure Bash entry for cli-recall-trigger.js', () => {
    const text = fs.readFileSync(path.join(REPO, 'README.md'), 'utf-8').replace(/\r\n/g, '\n');
    const h = text.indexOf('**2. Register the hooks**');
    const o = text.indexOf('```jsonc', h);
    const c = text.indexOf('\n```', o + 1);
    expect([h >= 0, o >= 0, c >= 0]).toEqual([true, true, true]);
    const block = text.slice(o, c);
    const needle = '"PostToolUseFailure": [{ "matcher": "Bash|PowerShell"';
    expect(block).toContain(needle);
    const line = block.split('\n').find((l) => l.includes(needle));
    expect(line).toContain('cli-recall-trigger.js');
  });
});
