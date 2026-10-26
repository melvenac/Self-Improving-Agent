import { describe, it, expect, afterEach } from 'vitest';
import Database from 'better-sqlite3';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { initSchemaV2, indexKnowledge } from '../../src/db-v2.js';
import * as mk from '../../src/trigger/match-keys.js';
import { writeTriggerKeys } from '../../src/trigger/keys-writer.js';
import * as run from '../../src/trigger/run.js';
import type { TriggerPolicy } from '../../src/trigger/policy.js';
import { spawnAsync } from '../spawn-async.js';

/**
 * T-170 part (ii): a lesson's `MATCH: error:` key is matched against a failed shell call's error text
 * (PostToolUseFailure's `error` field). 30 live lessons carried an error key on 10-24 and none was ever read. The keys
 * ride the command keys' sidecar as `errorKeys`; the asked path re-reads each entry and re-tests it, so a stale sidecar
 * can cost a miss, never a wrong injection. With one slot, an error key goes before a command key.
 *
 * The new functions are looked up by name so the rows also run (and go red) against the product before this change.
 */
type ErrorKey = { id: number; text: string };
const fn = mk as unknown as {
  parseErrorKey: (content: string) => string | null;
  matchingErrorKeyIds: (keys: ErrorKey[], error: string) => number[];
  readTriggerErrorKeys: (p: string) => ErrorKey[];
};

const ROOT = path.join(import.meta.dirname, '..', '..');
const HOOK = path.join(ROOT, 'src', 'cli-recall-trigger.ts');
const TSX_CLI = path.join(ROOT, 'node_modules', 'tsx', 'dist', 'cli.mjs');
const POLICY: TriggerPolicy = { relevance_floor: -1000, max_injected: 1, deadline_ms: 2000, provenance: 't170-err' };

const PS_ERR = "[EXPERIENCE] ps\nMATCH: error: \"Variable reference is not valid. ':' was not followed by a valid variable name character\"\nACTION: wrap the variable as ${name}: in PowerShell strings";
const GIT_ERR = '[EXPERIENCE] g\nMATCH: error: "fatal: invalid object name"\nACTION: fetch the ref first';
const GIT_CMD = '[EXPERIENCE] c\nMATCH: command: `git show <ref>:<path>`\nACTION: use a forward slash in the path';
const PS_FAILURE = "Exit code 1\nAt line:1 char:7\nVariable reference is not valid. ':' was not\nfollowed by a valid variable name character.";

const dbs: Database.Database[] = [];
const dirs: string[] = [];
afterEach(() => {
  for (const db of dbs.splice(0)) db.close();
  for (const d of dirs.splice(0)) fs.rmSync(d, { recursive: true, force: true, maxRetries: 3, retryDelay: 50 });
});
const tmp = (): string => {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 't170err-'));
  dirs.push(d);
  return d;
};

function seed(db: Database.Database, entries: Record<string, string>): Record<string, number> {
  initSchemaV2(db);
  const ids: Record<string, number> = {};
  for (const [key, content] of Object.entries(entries)) {
    indexKnowledge(db, { vaultPath: `${key}.md`, key, content, tags: '', source: 'test' });
    ids[key] = (db.prepare('SELECT id FROM knowledge_index WHERE key = ?').get(key) as { id: number }).id;
  }
  return ids;
}
const memory = (entries: Record<string, string>) => {
  const db = new Database(':memory:');
  dbs.push(db);
  return { db, ids: seed(db, entries) };
};
const lastQuery = (db: Database.Database) =>
  (db.prepare('SELECT query FROM trigger_fires ORDER BY id DESC LIMIT 1').get() as { query: string }).query;

describe('T-170 (ii): error keys', () => {
  it('K1 parseErrorKey: the quoted text, escapes undone, whitespace folded; short or absent is null', () => {
    expect(fn.parseErrorKey(PS_ERR)).toBe("Variable reference is not valid. ':' was not followed by a valid variable name character");
    expect(fn.parseErrorKey('x\nMATCH: error: "authentication_error\\",\\"message\\":\\"invalid x-api-key\\""\nACTION: y')).toBe(
      'authentication_error","message":"invalid x-api-key"',
    );
    expect(fn.parseErrorKey('x\nMATCH: error: refused-resolve\nACTION: y')).toBe('refused-resolve');
    expect(fn.parseErrorKey('x\nMATCH: error: "boom"\nACTION: y')).toBeNull();
    expect(fn.parseErrorKey(GIT_CMD)).toBeNull();
  });

  it('K2 matchingErrorKeyIds: a key found across line breaks in the error, longest first; a bad sidecar reads as []', () => {
    const keys = [{ id: 2, text: 'not valid' }, { id: 1, text: "Variable reference is not valid. ':' was not followed" }, { id: 3, text: 'no such thing' }];
    expect(fn.matchingErrorKeyIds(keys, PS_FAILURE)).toEqual([1, 2]);
    const p = path.join(tmp(), 'k.json');
    fs.writeFileSync(p, JSON.stringify({ keys: [], errorKeys: [{ id: 'x', text: 1 }] }));
    expect(fn.readTriggerErrorKeys(p)).toEqual([]);
  });

  it('K3 writeTriggerKeys writes errorKeys beside the command keys and returns the command counts unchanged', () => {
    const { db, ids } = memory({ ps: PS_ERR, cmd: GIT_CMD });
    const p = path.join(tmp(), 'recall-trigger-keys.json');
    expect(writeTriggerKeys(db, p)).toEqual({ written: 1, unusable: 0 });
    const file = JSON.parse(fs.readFileSync(p, 'utf-8')) as { keys: unknown[]; errorKeys: ErrorKey[] };
    expect(file.keys).toEqual([{ id: ids.cmd, fragments: ['git show', ':'] }]);
    expect(file.errorKeys).toEqual([{ id: ids.ps, text: "Variable reference is not valid. ':' was not followed by a valid variable name character" }]);
  });

  it('K4 runTrigger: an error key found in the error text injects its entry and is recorded as error-match', () => {
    const { db, ids } = memory({ ps: PS_ERR });
    const out = run.runTrigger({ db, sessionUuid: 'k4', command: 'Write-Host "$a:b"', policy: POLICY, error: PS_FAILURE, errorKeyIds: [ids.ps] } as never);
    expect(out.state).toBe('injected');
    expect(out.ids).toEqual([ids.ps]);
    expect(out.additionalContext).toContain('wrap the variable');
    expect(lastQuery(db)).toContain(`error-match:${ids.ps}`);
  });

  it('K5 runTrigger: a stale sidecar id whose key is not in this error is re-tested and not injected', () => {
    const { db, ids } = memory({ ps: PS_ERR });
    const out = run.runTrigger({ db, sessionUuid: 'k5', command: 'ls nope', policy: POLICY, error: 'Exit code 2\nls: cannot access', errorKeyIds: [ids.ps] } as never);
    expect(out.state).toBe('silent');
    expect(out.ids).toEqual([]);
  });

  it('K6 runTrigger: with one slot, the error key goes before a matching command key', () => {
    const { db, ids } = memory({ cmd: GIT_CMD, git: GIT_ERR });
    const out = run.runTrigger({
      db, sessionUuid: 'k6', command: 'git show origin/master:src/a.ts', policy: POLICY,
      keyIds: [ids.cmd], error: 'Exit code 128\nfatal: invalid object name', errorKeyIds: [ids.git],
    } as never);
    expect(out.ids).toEqual([ids.git]);
  });

  async function hook(payload: Record<string, unknown>) {
    const d = tmp();
    const dbPath = path.join(d, 'knowledge-v2.db');
    const db = new Database(dbPath);
    let ids: Record<string, number>;
    try {
      ids = seed(db, { ps: PS_ERR });
      writeTriggerKeys(db, mk.triggerKeysPath(dbPath));
    } finally {
      db.close();
    }
    const r = await spawnAsync(process.execPath, [TSX_CLI, HOOK], {
      input: JSON.stringify(payload),
      env: { ...process.env, KNOWLEDGE_V2_DB: dbPath, RECALL_TRIGGER_LOG: path.join(d, 'log.txt') },
      cwd: ROOT,
    });
    return { r, ids };
  }

  it('K7 the hook: a failing PowerShell call whose error carries the key gets the entry on PostToolUseFailure', async () => {
    const { r, ids } = await hook({
      session_id: 'k7', hook_event_name: 'PostToolUseFailure', tool_name: 'PowerShell',
      tool_input: { command: 'Write-Host "$a:b"' }, error: PS_FAILURE, is_interrupt: false, duration_ms: 9,
    });
    expect(r.status).toBe(0);
    const out = JSON.parse(r.stdout) as { hookSpecificOutput: { hookEventName: string; additionalContext: string } };
    expect(out.hookSpecificOutput.hookEventName).toBe('PostToolUseFailure');
    expect(out.hookSpecificOutput.additionalContext).toContain(`[stored knowledge ${ids.ps}`);
  }, 120_000);

  it('K8 the hook: a successful call with no error field is not asked by error keys (guard)', async () => {
    const { r } = await hook({
      session_id: 'k8', hook_event_name: 'PostToolUse', tool_name: 'PowerShell',
      tool_input: { command: 'Write-Host ok' }, tool_response: { stdout: PS_FAILURE, stderr: '' },
    });
    expect(r.status).toBe(0);
    expect(r.stdout.trim()).toBe('');
  }, 120_000);
});
