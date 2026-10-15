import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import Database from 'better-sqlite3';
import { initSchemaV2, indexKnowledge } from '../../src/db-v2.js';
import { runTrigger } from '../../src/trigger/run.js';
import { deriveQuery } from '../../src/trigger/query.js';
import type { TriggerPolicy } from '../../src/trigger/policy.js';
import * as server from '../../src/server.js';
import { spawnAsync } from '../spawn-async.js';

/**
 * T-170 (D-155, option A) — the recall trigger reads a lesson's
 * `MATCH: command:` line, injects a keyed entry at most once per session, and
 * ob_store reports the key rather than refusing a lesson without one.
 *
 * The two new modules are imported dynamically so that, before they exist,
 * each row is red on its own rather than the whole file failing to collect.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mk: any = await import('../../src/trigger/match-keys.js').catch(() => ({}));
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const kw: any = await import('../../src/trigger/keys-writer.js').catch(() => ({}));

const ROOT = path.join(import.meta.dirname, '..', '..');
const REPO = path.join(ROOT, '..');
const HOOK = path.join(ROOT, 'src', 'cli-recall-trigger.ts');
const TSX_CLI = path.join(ROOT, 'node_modules', 'tsx', 'dist', 'cli.mjs');
const SPY = path.join(import.meta.dirname, 'load-spy.cjs');
const SPAWN_TIMEOUT = 120_000;

const POLICY: TriggerPolicy = { relevance_floor: 8, max_injected: 1, deadline_ms: 2000, provenance: 't170' };

const A_CONTENT = '[EXPERIENCE] a\nMATCH: command: `git show <ref>:<path>`\nACTION: use a forward slash in the path';
const B_CONTENT = 'MATCH: path: src/x.ts';
const C_CONTENT = '[EXPERIENCE] c\nMATCH: command: `git show <ref>:<path>`\nACTION: archived';
const D_CONTENT = 'MATCH: command: `npm ci`';
const E_CONTENT = '[EXPERIENCE] e\nACTION: read PIPESTATUS, not the tail exit code';

let dir: string;
beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 't170-'));
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

const lastQuery = (db: Database.Database): string =>
  (db.prepare('SELECT query FROM trigger_fires ORDER BY id DESC LIMIT 1').get() as { query: string }).query;

describe('K — parseCommandKey, commandMatchesKey, readTriggerKeys, matchingKeyIds', () => {
  it('K1: a backticked span is the key; <placeholders> are wildcards', () => {
    expect(mk.parseCommandKey('[EXPERIENCE] x\nMATCH: command: `git show <ref>:<path>` (on Windows)\nTRIGGER: y')).toEqual(['git show', ':']);
  });

  it('K2: without a span, the text is cut at " ("', () => {
    expect(mk.parseCommandKey('MATCH: command: claude -p (headless job prompt)')).toEqual(['claude -p']);
  });

  it('K3: … is a wildcard', () => {
    expect(mk.parseCommandKey("MATCH: command: `while read x; do … ssh …; done <<'EOF'`")).toEqual(['while read x; do', 'ssh', "; done <<'EOF'"]);
  });

  it('K4: a key under MATCH_KEY_MIN_CHARS is null', () => {
    expect(mk.parseCommandKey('MATCH: command: `npm ci` (run by a fork)')).toBeNull();
  });

  it('K5: path, error, none and no line are all null', () => {
    for (const c of ['MATCH: path: src/db/migrate.ts', 'MATCH: error: "boom"', 'MATCH: none — lookup only', 'no match line']) {
      expect(mk.parseCommandKey(c)).toBeNull();
    }
  });

  it('K6: fragments must occur in order', () => {
    expect(mk.commandMatchesKey(['git show', ':'], 'git show origin/master:src/x.ts')).toBe(true);
    expect(mk.commandMatchesKey(['git show', ':'], 'cat a:b && git show')).toBe(false);
  });

  it('K7: whitespace runs in the command collapse to one space', () => {
    expect(mk.commandMatchesKey(['gh pr view', '--json headRefOid'], 'gh  pr view 12\n  --json headRefOid,mergeStateStatus')).toBe(true);
  });

  it('K8: matching is case-sensitive', () => {
    expect(mk.commandMatchesKey(['git show'], 'Git Show HEAD')).toBe(false);
  });

  it('K9: readTriggerKeys returns [] on any failure and the keys otherwise', () => {
    expect(mk.readTriggerKeys(path.join(dir, 'absent.json'))).toEqual([]);
    const bad = path.join(dir, 'bad.json');
    fs.writeFileSync(bad, 'not json');
    expect(mk.readTriggerKeys(bad)).toEqual([]);
    const good = path.join(dir, 'good.json');
    fs.writeFileSync(good, '{"generated_at":"x","keys":[{"id":1,"fragments":["git show"]}]}');
    expect(mk.readTriggerKeys(good)).toEqual([{ id: 1, fragments: ['git show'] }]);
  });

  it('K10: matchingKeyIds sorts by key length descending, then id ascending', () => {
    const keys = [
      { id: 5, fragments: ['git show'] },
      { id: 9, fragments: ['git show', 'origin/main:'] },
      { id: 3, fragments: ['git show'] },
      { id: 7, fragments: ['tar -x'] },
    ];
    expect(mk.matchingKeyIds(keys, 'git show origin/main:a.ts')).toEqual([9, 3, 5]);
  });
});

describe('W — writeTriggerKeys', () => {
  it('W1: live command keys only; an unusable one is counted; no tmp file left', () => {
    const dbPath = path.join(dir, 'knowledge-v2.db');
    const ids = seed(dbPath, { a: A_CONTENT, b: B_CONTENT, c: C_CONTENT, d: D_CONTENT });
    const db = new Database(dbPath);
    try {
      db.prepare('UPDATE knowledge_index SET archived_into = ? WHERE id = ?').run(ids.a, ids.c);
      const p = path.join(dir, 'recall-trigger-keys.json');
      expect(kw.writeTriggerKeys(db, p)).toEqual({ written: 1, unusable: 1 });
      const file = JSON.parse(fs.readFileSync(p, 'utf-8')) as { keys: unknown };
      expect(file.keys).toEqual([{ id: ids.a, fragments: ['git show', ':'] }]);
      expect(fs.readdirSync(dir).filter((f) => f.includes('.tmp-'))).toEqual([]);
    } finally {
      db.close();
    }
  });
});

describe('R — runTrigger with keyIds', () => {
  let db: Database.Database;
  let ids: Record<string, number>;
  const open = (entries: Record<string, string>) => {
    const dbPath = path.join(dir, 'knowledge-v2.db');
    ids = seed(dbPath, entries);
    db = new Database(dbPath);
  };
  afterEach(() => db?.close());

  it('R1: a keyed entry is injected for a command the element path does not ask about', () => {
    open({ a: A_CONTENT });
    const A = ids.a;
    const out = runTrigger({ db, sessionUuid: 's1', command: 'git show origin/master:src/a.ts', policy: POLICY, keyIds: [A] } as never);
    expect(out.state).toBe('injected');
    expect(out.ids).toEqual([A]);
    expect(out.additionalContext).toContain(`[stored knowledge ${A}`);
    expect(out.additionalContext).toContain('use a forward slash in the path');
    expect(lastQuery(db)).toBe(`match:${A}`);
  });

  it('R2: at most once per session', () => {
    open({ a: A_CONTENT });
    const A = ids.a;
    const call = (session: string) =>
      runTrigger({ db, sessionUuid: session, command: 'git show origin/master:src/a.ts', policy: POLICY, keyIds: [A] } as never);
    expect(call('s1').state).toBe('injected');
    const second = call('s1');
    expect(second.state).toBe('silent');
    expect(second.ids).toEqual([]);
    expect(lastQuery(db)).toBe(`match:${A}`);
    expect(call('s2').state).toBe('injected');
  });

  it('R3: the element hit keeps priority for the one slot', () => {
    open({ a: A_CONTENT, e: E_CONTENT });
    const command = 'git show a:b | tail -3; echo $?';
    const out = runTrigger({
      db,
      sessionUuid: 's3',
      command,
      policy: { ...POLICY, relevance_floor: -1000 },
      keyIds: [ids.a],
    } as never);
    expect(out.state).toBe('injected');
    expect(out.ids).toEqual([ids.e]);
    // Ruling 4: the recorded query names the keyed ids even when the element hit took the slot.
    expect(lastQuery(db)).toBe(`${deriveQuery(command)} match:${ids.a}`);
  });

  it('R4: archived, unkeyed and non-matching ids are re-tested against the store and stay silent', () => {
    open({ a: A_CONTENT, b: B_CONTENT, c: C_CONTENT });
    db.prepare('UPDATE knowledge_index SET archived_into = ? WHERE id = ?').run(ids.a, ids.c);
    const cases: Array<[number, string]> = [
      [ids.c, 'git show origin/master:src/a.ts'],
      [ids.b, 'git show origin/master:src/a.ts'],
      [ids.a, 'git log --oneline'],
    ];
    for (const [id, command] of cases) {
      const out = runTrigger({ db, sessionUuid: `s4-${id}-${command}`, command, policy: POLICY, keyIds: [id] } as never);
      expect(out.state).toBe('silent');
      expect(out.ids).toEqual([]);
      expect(lastQuery(db)).toBe(`match:${id}`);
    }
  });

  it('R5: no keyIds and no query is not-asked, unchanged', () => {
    open({ a: A_CONTENT });
    const out = runTrigger({ db, sessionUuid: 's5', command: 'git status', policy: POLICY, keyIds: [] } as never);
    expect(out.state).toBe('not-asked');
    expect(lastQuery(db)).toBe('');
  });
});

describe('H — the hook reads the sidecar', () => {
  const bash = (command: string, session: string) => ({
    session_id: session,
    hook_event_name: 'PostToolUse',
    tool_name: 'Bash',
    tool_input: { command },
  });
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

  it('H1: a sidecar key reaches the asked path and injects', async () => {
    const dbPath = path.join(dir, 'knowledge-v2.db');
    const { a: A } = seed(dbPath, { a: A_CONTENT });
    const db = new Database(dbPath);
    try {
      kw.writeTriggerKeys(db, mk.triggerKeysPath(dbPath));
    } finally {
      db.close();
    }
    const r = await runHook(bash('git show origin/master:src/a.ts', 'h1'), {
      KNOWLEDGE_V2_DB: dbPath,
      RECALL_TRIGGER_LOG: path.join(dir, 'log.txt'),
    });
    expect(r.status).toBe(0);
    const out = JSON.parse(r.stdout) as { hookSpecificOutput: { additionalContext: string } };
    expect(out.hookSpecificOutput.additionalContext).toContain(`[stored knowledge ${A}`);
  }, SPAWN_TIMEOUT);

  it('H2: no sidecar, the same command takes the fast path', async () => {
    const dbPath = path.join(dir, 'knowledge-v2.db');
    seed(dbPath, { a: A_CONTENT });
    const r = await runHook(bash('git show origin/master:src/a.ts', 'h2'), {
      KNOWLEDGE_V2_DB: dbPath,
      RECALL_TRIGGER_LOG: path.join(dir, 'log.txt'),
    });
    expect(r.status).toBe(0);
    expect(r.stdout).toBe('');
    expect(pendingLines(dbPath)).toHaveLength(1);
  }, SPAWN_TIMEOUT);

  it('H3: a sidecar that matches nothing loads nothing heavy', async () => {
    const dbPath = path.join(dir, 'knowledge-v2.db'); // ABSENT
    fs.writeFileSync(
      path.join(dir, 'recall-trigger-keys.json'),
      '{"generated_at":"x","keys":[{"id":1,"fragments":["git show",":"]}]}',
    );
    const out = path.join(dir, 'spy.json');
    const r = await spawnAsync(process.execPath, ['--require', SPY, '--import', 'tsx/esm', HOOK], {
      input: JSON.stringify(bash('git status --porcelain', 'h3')),
      env: { ...process.env, KNOWLEDGE_V2_DB: dbPath, RECALL_TRIGGER_LOG: path.join(dir, 'log.txt'), LOAD_SPY_OUT: out },
      cwd: ROOT,
    });
    expect(r.status).toBe(0);
    const seen = JSON.parse(fs.readFileSync(out, 'utf-8')) as {
      dlopen: string[];
      resolved: Array<{ specifier: string; url: string }>;
    };
    const heavy = {
      native: seen.dlopen.some((f) => /better_sqlite3\.node$/.test(f)),
      bsqlite: seen.resolved.some((x) => x.specifier === 'better-sqlite3'),
      zod: seen.resolved.some((x) => x.specifier === 'zod'),
      dbV2: seen.resolved.some((x) => /\/src\/db-v2\.(ts|js)$/.test(x.url)),
      policy: seen.resolved.some((x) => /\/src\/trigger\/policy\.(ts|js)$/.test(x.url)),
    };
    expect(heavy).toEqual({ native: false, bsqlite: false, zod: false, dbV2: false, policy: false });
    expect(pendingLines(dbPath)).toHaveLength(1);
  }, SPAWN_TIMEOUT);
});

describe('S — ob_store reports the key and refreshes the sidecar', () => {
  let prevVault: string | undefined;
  const tag = Math.random().toString(36).slice(2, 8);
  const textOf = (res: { content: { text: string }[] }) => res.content.map((c) => c.text).join('\n');

  beforeEach(() => {
    prevVault = process.env.OPEN_BRAIN_VAULT_DIR;
    process.env.OPEN_BRAIN_VAULT_DIR = fs.mkdtempSync(path.join(dir, 'vault-'));
  });
  afterEach(() => {
    process.env.OPEN_BRAIN_VAULT_DIR = prevVault;
  });

  it('S1: a command key is reported and lands in the sidecar', async () => {
    const reply = textOf(await server.handleStore({
      content: '[EXPERIENCE] s1\nMATCH: command: `git switch -c <b> origin/master`\nACTION: x',
      key: `t170-s1-${tag}`,
      kind: 'event',
    }));
    expect(reply).toContain('— match: command (the recall trigger reads it)');
    const id = Number(/\(id: (\d+)\)/.exec(reply)?.[1]);
    const sidecar = JSON.parse(fs.readFileSync(mk.triggerKeysPath(process.env.KNOWLEDGE_V2_DB!), 'utf-8')) as {
      keys: Array<{ id: number; fragments: string[] }>;
    };
    expect(sidecar.keys.find((k) => k.id === id)).toEqual({ id, fragments: ['git switch -c', 'origin/master'] });
  });

  it('S2: no line, an error key and a short command key are reported, not refused', async () => {
    const none = textOf(await server.handleStore({ content: `[EXPERIENCE] s2 none ${tag}\nACTION: x`, key: `t170-s2a-${tag}`, kind: 'event' }));
    expect(none).toContain('— lookup-only: no MATCH: line (D-155)');
    const err = textOf(await server.handleStore({ content: `[EXPERIENCE] s2 err ${tag}\nMATCH: error: "boom"\nACTION: x`, key: `t170-s2b-${tag}`, kind: 'event' }));
    expect(err).toContain('— match: error (stored; the trigger does not read error keys yet)');
    const short = textOf(await server.handleStore({ content: `[EXPERIENCE] s2 short ${tag}\nMATCH: command: \`npm ci\`\nACTION: x`, key: `t170-s2c-${tag}`, kind: 'event' }));
    expect(short).toContain('— match: command line present but under 6 characters, so lookup-only');
  });

  it('S3: a state store says nothing about a key', async () => {
    const reply = textOf(await server.handleStore({ content: `s3 value ${tag}`, key: `t170-s3-${tag}`, kind: 'state' }));
    expect(reply).toContain('Stored knowledge (id:');
    expect(reply).not.toContain('— match:');
    expect(reply).not.toContain('— lookup-only');
  });
});

describe('E — /end step 2 names the reader', () => {
  it('E1: the three copies say the trigger reads MATCH: command:', () => {
    for (const rel of ['.claude/commands/end.md', 'project-template/.claude/commands/end.md', 'project-template/.cursor/commands/end.md']) {
      const text = fs.readFileSync(path.join(REPO, rel), 'utf-8').replace(/\r\n/g, '\n');
      expect(text, rel).toContain('**The recall\ntrigger reads `MATCH: command:`** (T-170)');
      expect(text, rel).not.toContain('Nothing reads');
    }
  });
});
