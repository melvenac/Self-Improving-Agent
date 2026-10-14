import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import Database from 'better-sqlite3';
import * as dbV2 from '../../src/db-v2.js';
import * as fires from '../../src/trigger/fires.js';
import * as server from '../../src/server.js';
import { spawnAsync } from '../spawn-async.js';

/**
 * T-159 — a not-asked recall-trigger fire costs only the interpreter: no
 * store, no zod. It is one line in a pending file beside the store, reconciled
 * into trigger_fires at SessionEnd and at ob_end.
 *
 * The new module is imported dynamically so that, before it exists, each row
 * is red on its own rather than the whole file failing to collect.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const pf: any = await import('../../src/trigger/pending-fires.js').catch(() => ({}));
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const F: any = fires;

const ROOT = path.join(import.meta.dirname, '..', '..');
const HOOK = path.join(ROOT, 'src', 'cli-recall-trigger.ts');
const SESSION_END = path.join(ROOT, 'src', 'cli-session-end.ts');
const TSX_CLI = path.join(ROOT, 'node_modules', 'tsx', 'dist', 'cli.mjs');
const SPY = path.join(import.meta.dirname, 'load-spy.cjs');
const G039 = 'npx vitest run 2>&1 | tail -8; echo $?';
const ISO_MS = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;
const SPAWN_TIMEOUT = 120_000;

let dir: string;
beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 't159-'));
});
afterEach(() => fs.rmSync(dir, { recursive: true, force: true }));

const bash = (command: string, session?: string) => ({
  ...(session ? { session_id: session } : {}),
  hook_event_name: 'PostToolUse',
  tool_name: 'Bash',
  tool_input: { command },
});
const shell = (command: string, session: string) => ({
  session_id: session,
  hook_event_name: 'postToolUse',
  tool_name: 'Shell',
  tool_input: { command },
});

async function runHook(payload: unknown, env: Record<string, string>) {
  const r = await spawnAsync(process.execPath, [TSX_CLI, HOOK], {
    input: JSON.stringify(payload),
    env: { ...process.env, ...env },
    cwd: ROOT,
  });
  return { status: r.status, stdout: r.stdout, stderr: r.stderr };
}

function freshStore(p: string): void {
  const db = new Database(p);
  dbV2.initSchemaV2(db);
  db.close();
}

const pendingFile = (dbPath: string) => path.join(path.dirname(dbPath), 'recall-trigger-pending.jsonl');
const readLines = (p: string): string[] =>
  fs.existsSync(p) ? fs.readFileSync(p, 'utf-8').split('\n').filter((l) => l.trim() !== '') : [];

function line(session: string, createdAt: string, command = 'git'): string {
  return JSON.stringify({ session_uuid: session, created_at: createdAt, command, state: 'not-asked' });
}

describe('N1 — the not-asked fast path loads nothing heavy', () => {
  async function spied(command: string) {
    const dbPath = path.join(dir, 'knowledge-v2.db'); // ABSENT
    const out = path.join(dir, `spy-${Math.random().toString(36).slice(2)}.json`);
    const r = await spawnAsync(process.execPath, ['--require', SPY, '--import', 'tsx/esm', HOOK], {
      input: JSON.stringify(bash(command, 'n1-session')),
      env: { ...process.env, KNOWLEDGE_V2_DB: dbPath, RECALL_TRIGGER_LOG: path.join(dir, 'log.txt'), LOAD_SPY_OUT: out },
      cwd: ROOT,
    });
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
    return { r, heavy, dbPath, resolvedCount: seen.resolved.length, resolved: seen.resolved };
  }

  it('git status --porcelain: exit 0, silent, nothing heavy, one pending line, no store; G-039 does load them', async () => {
    const { r, heavy, dbPath, resolvedCount } = await spied('git status --porcelain');
    expect(r.status).toBe(0);
    expect(r.stdout).toBe('');
    expect(r.stderr).toBe('');
    expect(resolvedCount).toBeGreaterThan(0); // the spy saw the hook's own imports
    expect(heavy).toEqual({ native: false, bsqlite: false, zod: false, dbV2: false, policy: false });
    expect(readLines(pendingFile(dbPath))).toHaveLength(1);
    expect(fs.existsSync(dbPath)).toBe(false);

    // Positive control: the asked path through the same spy.
    const control = await spied(G039);
    expect(control.r.status).toBe(0);
    expect(control.heavy).toEqual({ native: true, bsqlite: true, zod: true, dbV2: true, policy: true });
    expect(fs.existsSync(control.dbPath)).toBe(false);
  }, SPAWN_TIMEOUT);

  it('T-286: a trimmer pipeline with no $? read takes the same fast path: nothing heavy, one pending line, no store', async () => {
    const { r, heavy, dbPath } = await spied('git log --oneline | tail -5');
    expect(r.status).toBe(0);
    expect(r.stdout).toBe('');
    expect(heavy).toEqual({ native: false, bsqlite: false, zod: false, dbV2: false, policy: false });
    expect(readLines(pendingFile(dbPath))).toHaveLength(1);
    expect(fs.existsSync(dbPath)).toBe(false);
  }, SPAWN_TIMEOUT);

  it('N1b: from the hook entry on, every specifier resolves to a node: builtin or one of the four fast-path modules', async () => {
    const { r, resolved } = await spied('git status --porcelain');
    expect(r.status).toBe(0);
    // What precedes the entry is the tsx loader itself (and the spy), not the hook.
    const entry = resolved.findIndex((x) => /\/src\/cli-recall-trigger\.(ts|js)$/.test(x.url));
    expect(entry).toBeGreaterThanOrEqual(0);
    const allowed = /\/src\/(cli-recall-trigger|trigger\/query|trigger\/pending-fires|trigger\/command-log)\.(ts|js)$/;
    const outside = resolved.slice(entry).filter((x) => !x.url.startsWith('node:') && !allowed.test(x.url));
    expect(outside).toEqual([]);
  }, SPAWN_TIMEOUT);
});

describe('N2 — a pending line never carries secret bytes', () => {
  // The secret commands of tests/audit-fix-a1-r5.test.ts.
  const secretCommands: Array<{ command: string; secret: string }> = [
    { command: 'deploy --token abc123supersecrettokenvalue', secret: 'abc123super' },
    { command: 'export TYPESAFE_API_KEY=sk-live-abcdefghijklmnop', secret: 'sk-live' },
    { command: 'curl https://user:pass@api.example.com/v1', secret: 'pass@' },
    { command: 'git clone https://x-access-token:ghp_abc123xyz@github.com/o/r', secret: 'ghp_abc' },
    { command: 'http --headers Authorization: Bearer eyJhbGciOiJIUz', secret: 'eyJhbGci' },
    { command: 'curl -H "X-Api-Key: supersecret12345"', secret: 'supersecret' },
    { command: 'curl -u alice:bobsecret https://example.com', secret: 'bobsecret' },
    { command: '{"api_key": "my-secret-value"}', secret: 'my-secret' },
    { command: 'export password=SuperSecret1', secret: 'SuperSecret' },
    { command: 'cfg api_key=abc123hexvalue', secret: 'abc123hex' },
    { command: 'env Token=MyTokenValue', secret: 'MyToken' },
    { command: 'github_token=gho_abcdefghijklmnop', secret: 'gho_abc' },
    { command: 'SECRET_KEY=shhh', secret: 'shhh' },
    { command: 'AWS_SECRET_ACCESS_KEY=AKIASECRET', secret: 'AKIASECRET' },
    { command: 'PRIVATE_KEY=-----BEGIN', secret: 'BEGIN' },
    { command: 'mysql -pS3cretPass! db', secret: 'S3cretPass' },
    { command: "run.sh 'ghp_abcdefghijklmnopqrstuvwxyz1234567890'", secret: 'ghp_abc' },
    { command: 'node -e eyJhbGciOiJIUzI1NiJ9.payload.sig', secret: 'eyJhbGci' },
    { command: 'ghp_abcdefghijklmnopqrstuvwxyz1234567890 status', secret: 'ghp_abc' },
    { command: 'C:\\secrets\\ghp_abcdefghijklmnopqrstuvwxyz1234567890 push', secret: 'ghp_abc' },
    { command: 'echo correct-horse-battery | docker login -u user --password-stdin', secret: 'correct-horse' },
    { command: 'printf winter2026 | sudo -S id', secret: 'winter2026' },
    { command: 'git\u00a0status --porcelain supersecret', secret: 'supersecret' },
  ];

  it('every line has the four keys, an ISO time with ms, state not-asked, and no secret', () => {
    const p = path.join(dir, 'pending.jsonl');
    for (const { command } of secretCommands) pf.appendPendingNotAsked(p, { sessionUuid: 'n2', command }, new Date());
    const text = fs.readFileSync(p, 'utf-8');
    const lines = readLines(p);
    expect(lines).toHaveLength(secretCommands.length);
    for (const l of lines) {
      const o = JSON.parse(l) as Record<string, unknown>;
      expect(Object.keys(o).sort()).toEqual(['command', 'created_at', 'session_uuid', 'state']);
      expect(o.created_at).toMatch(ISO_MS);
      expect(o.state).toBe('not-asked');
      expect(pf.parsePendingFireLine(l)).not.toBeNull();
    }
    for (const { secret } of secretCommands) expect(text.toLowerCase()).not.toContain(secret.toLowerCase());
  });
});

describe('N3 — the hook writes not-asked fires to the pending file, not the store', () => {
  it('three not-asked + G-039: no not-asked rows, one asked row, three lines, empty log; no session writes nothing', async () => {
    const dbPath = path.join(dir, 'knowledge-v2.db');
    const logPath = path.join(dir, 'recall-trigger.log');
    freshStore(dbPath);
    const env = { KNOWLEDGE_V2_DB: dbPath, RECALL_TRIGGER_LOG: logPath };

    for (const c of ['git status --porcelain', 'ls -la', 'zzqx --flurb wibble', G039]) {
      const r = await runHook(bash(c, 'n3-session'), env);
      expect(r.status).toBe(0);
      expect(r.stderr).toBe('');
    }

    const db = new Database(dbPath, { readonly: true });
    const rows = db.prepare('SELECT state, COUNT(*) AS n FROM trigger_fires GROUP BY state').all() as Array<{ state: string; n: number }>;
    db.close();
    const byState = Object.fromEntries(rows.map((r) => [r.state, r.n]));
    expect(byState['not-asked'] ?? 0).toBe(0);
    expect((byState.silent ?? 0) + (byState.injected ?? 0)).toBeGreaterThanOrEqual(1);
    expect(readLines(pendingFile(dbPath))).toHaveLength(3);
    expect(readLines(logPath)).toEqual([]);

    const r = await runHook(bash('git status', undefined), env);
    expect(r.status).toBe(0);
    expect(readLines(pendingFile(dbPath))).toHaveLength(3);
  }, SPAWN_TIMEOUT);
});

describe('N4-N6 — reconcilePendingFires', () => {
  let db: Database.Database;
  let p: string;
  beforeEach(() => {
    db = new Database(path.join(dir, 'knowledge-v2.db'));
    dbV2.initSchemaV2(db);
    p = path.join(dir, 'recall-trigger-pending.jsonl');
  });
  afterEach(() => db.close());

  const allRows = () =>
    db.prepare('SELECT session_uuid, command, query, state, injected_ids, created_at FROM trigger_fires ORDER BY id').all() as Array<Record<string, string>>;

  const three = [
    line('A', '2026-10-13T10:00:00.001Z'),
    line('A', '2026-10-13T10:00:00.002Z', 'ls'),
    line('B', '2026-10-13T10:00:00.003Z'),
  ];

  it('N4: 3 inserted, 2 unreadable; each row keeps its time; query empty; ids []', () => {
    const raw = JSON.stringify({ session_uuid: 'A', created_at: '2026-10-13T10:00:00.004Z', command: 'git push --token abc', state: 'not-asked' });
    fs.writeFileSync(p, `${three.join('\n')}\n${raw}\n{"session_uuid":"A","crea`);
    const r = F.reconcilePendingFires(db, p);
    expect(r).toEqual({ inserted: 3, duplicate: 0, unreadable: 2 });
    const rows = allRows();
    expect(rows.map((x) => x.created_at)).toEqual(['2026-10-13T10:00:00.001Z', '2026-10-13T10:00:00.002Z', '2026-10-13T10:00:00.003Z']);
    expect(rows.map((x) => x.session_uuid)).toEqual(['A', 'A', 'B']);
    for (const x of rows) {
      expect(x.query).toBe('');
      expect(x.injected_ids).toBe('[]');
      expect(x.state).toBe('not-asked');
    }
    expect(JSON.stringify(rows)).not.toContain('abc');
  });

  it('N5: idempotent — twice, re-appended, and two connections at once', () => {
    fs.writeFileSync(p, `${three.join('\n')}\n`);
    expect(F.reconcilePendingFires(db, p).inserted).toBe(3);
    expect(F.reconcilePendingFires(db, p)).toEqual({ inserted: 0, duplicate: 0, unreadable: 0 });
    fs.writeFileSync(p, `${three.join('\n')}\n`);
    expect(F.reconcilePendingFires(db, p)).toEqual({ inserted: 0, duplicate: 3, unreadable: 0 });
    expect(allRows()).toHaveLength(3);

    // Two reconcilers holding the same lines (each claimed its own copy).
    const other = path.join(dir, 'other');
    fs.mkdirSync(other);
    const d1 = path.join(dir, 'two.db');
    freshStore(d1);
    const c1 = new Database(d1);
    const c2 = new Database(d1);
    try {
      const p1 = path.join(dir, 'p1.jsonl');
      const p2 = path.join(other, 'p2.jsonl');
      fs.writeFileSync(p1, `${three.join('\n')}\n`);
      fs.writeFileSync(p2, `${three.join('\n')}\n`);
      const a = F.reconcilePendingFires(c1, p1);
      const b = F.reconcilePendingFires(c2, p2);
      expect(a.inserted + b.inserted).toBe(3);
      expect((c1.prepare('SELECT COUNT(*) AS n FROM trigger_fires').get() as { n: number }).n).toBe(3);
    } finally {
      c1.close();
      c2.close();
    }
  });

  it('N6: a late writer into the live file and into the claim is picked up exactly once; the stale claim is removed', () => {
    fs.writeFileSync(p, `${three.join('\n')}\n`);
    let claimedPath = '';
    const first = F.reconcilePendingFires(db, p, {
      afterClaim: (c: string) => {
        claimedPath = c;
        fs.appendFileSync(p, `${line('C', '2026-10-13T10:00:01.000Z')}\n`);
        fs.appendFileSync(c, `${line('D', '2026-10-13T10:00:02.000Z')}\n`);
      },
    });
    expect(first.inserted).toBe(3);
    expect(claimedPath).not.toBe(p);
    expect(fs.existsSync(claimedPath)).toBe(true); // kept until it is stale

    const later = new Date(Date.now() + F.STALE_CLAIM_MS + 1000);
    const second = F.reconcilePendingFires(db, p, { now: later });
    expect(second.inserted).toBe(2);
    expect(fs.existsSync(claimedPath)).toBe(false);
    const sessions = allRows().map((x) => x.session_uuid);
    expect(sessions.filter((s) => s === 'C')).toHaveLength(1);
    expect(sessions.filter((s) => s === 'D')).toHaveLength(1);
    expect(sessions).toHaveLength(5);

    const third = F.reconcilePendingFires(db, p, { now: new Date(later.getTime() + F.STALE_CLAIM_MS * 2) });
    expect(third.inserted).toBe(0);
    expect(allRows()).toHaveLength(5);
  });

  it('N6b: on the real clock, a reconcile right after one that kept a claim leaves the claim alone', () => {
    fs.writeFileSync(p, `${three.join('\n')}\n`);
    let claimedPath = '';
    const first = F.reconcilePendingFires(db, p, {
      afterClaim: (c: string) => {
        claimedPath = c;
        fs.appendFileSync(c, `${line('D', '2026-10-13T10:00:02.000Z')}\n`);
      },
    });
    expect(first.inserted).toBe(3);
    expect(fs.existsSync(claimedPath)).toBe(true);

    const second = F.reconcilePendingFires(db, p); // no `now`: the claim is seconds old
    expect(second.inserted).toBe(0);
    expect(fs.existsSync(claimedPath)).toBe(true);
    expect(allRows()).toHaveLength(3);
  });

  it('N6c: the stale re-read counts no duplicate and no unreadable line beside its inserts', () => {
    fs.writeFileSync(p, `${three.join('\n')}\n`);
    F.reconcilePendingFires(db, p, {
      afterClaim: (c: string) => {
        fs.appendFileSync(p, `${line('C', '2026-10-13T10:00:01.000Z')}\n`);
        fs.appendFileSync(c, `${line('D', '2026-10-13T10:00:02.000Z')}\n`);
      },
    });
    const later = new Date(Date.now() + F.STALE_CLAIM_MS + 1000);
    expect(F.reconcilePendingFires(db, p, { now: later })).toEqual({ inserted: 2, duplicate: 0, unreadable: 0 });
  });

  it('N8: a DB error throws, puts the claimed lines back in the live file, keeps the claim and writes no row', () => {
    db.exec(`CREATE TRIGGER t159_abort BEFORE INSERT ON trigger_fires BEGIN SELECT RAISE(ABORT, 'induced'); END;`);
    const text = `${three.join('\n')}\n`;
    fs.writeFileSync(p, text);
    let claimedPath = '';
    expect(() => F.reconcilePendingFires(db, p, { afterClaim: (c: string) => (claimedPath = c) })).toThrow(/induced/);
    expect(readLines(p)).toEqual(three);
    expect(claimedPath).not.toBe('');
    expect(fs.existsSync(claimedPath)).toBe(true);
    expect(allRows()).toHaveLength(0);
  });

  it('N11: only ENOENT from the claim rename means nothing pending; EPERM throws and leaves the live file', () => {
    const text = `${three.join('\n')}\n`;
    fs.writeFileSync(p, text);
    const failing = (code: string) => () => {
      throw Object.assign(new Error(`${code}: induced rename failure`), { code });
    };
    expect(() => F.reconcilePendingFires(db, p, { rename: failing('EPERM') })).toThrow(/EPERM/);
    expect(fs.readFileSync(p, 'utf-8')).toBe(text);
    expect(allRows()).toHaveLength(0);

    expect(F.reconcilePendingFires(db, p, { rename: failing('ENOENT') })).toEqual({ inserted: 0, duplicate: 0, unreadable: 0 });
    expect(fs.readFileSync(p, 'utf-8')).toBe(text);
    expect(allRows()).toHaveLength(0);
  });
});

describe('N10 — parsePendingFireLine refuses what the hook never writes', () => {
  it('a time without milliseconds, and a fifth key, are both null', () => {
    expect(pf.parsePendingFireLine(line('A', '2026-10-13T12:00:00.000Z'))).not.toBeNull(); // the control
    expect(pf.parsePendingFireLine(line('A', '2026-10-13T12:00:00Z'))).toBeNull();
    const five = JSON.stringify({ session_uuid: 'A', created_at: '2026-10-13T12:00:00.000Z', command: 'git', state: 'not-asked', extra: 1 });
    expect(pf.parsePendingFireLine(five)).toBeNull();
  });
});

describe('N7 — end to end: the hook, then SessionEnd; and ob_end', () => {
  async function sessionEnd(env: Record<string, string>, session: string) {
    return spawnAsync(process.execPath, [TSX_CLI, SESSION_END], {
      input: JSON.stringify({ session_id: session, hook_event_name: 'SessionEnd' }),
      env: { ...process.env, CLAUDE_PROJECT_DIR: dir, OPEN_BRAIN_VAULT_DIR: path.join(dir, 'no-vault'), ...env },
      cwd: dir,
    });
  }

  it('Cursor X ×2 and Bash Y ×1, then SessionEnd for Y: 3 reconciled; rerun nothing pending; absent DB creates nothing', async () => {
    const dbPath = path.join(dir, 'store', 'knowledge-v2.db');
    fs.mkdirSync(path.dirname(dbPath));
    freshStore(dbPath);
    const env = { KNOWLEDGE_V2_DB: dbPath, RECALL_TRIGGER_LOG: path.join(dir, 'store', 'recall-trigger.log') };

    await runHook(shell('git status', 'n7-X'), env);
    await runHook(shell('ls -la', 'n7-X'), env);
    await runHook(bash('git log --oneline', 'n7-Y'), env);
    expect(readLines(pendingFile(dbPath))).toHaveLength(3);

    const end = await sessionEnd(env, 'n7-Y');
    expect(end.stdout).toContain('[session-end] trigger fires: 3 not-asked fire(s) reconciled (0 already recorded, 0 unreadable line(s) not reconciled)');
    const db = new Database(dbPath, { readonly: true });
    const counts = Object.fromEntries(
      (db.prepare("SELECT session_uuid AS s, COUNT(*) AS n FROM trigger_fires WHERE state = 'not-asked' GROUP BY s").all() as Array<{ s: string; n: number }>).map((r) => [r.s, r.n]),
    );
    db.close();
    expect(counts).toEqual({ 'n7-X': 2, 'n7-Y': 1 });

    const rerun = await sessionEnd(env, 'n7-Z');
    expect(rerun.stdout).toContain('[session-end] trigger fires: nothing pending');

    const absentDir = path.join(dir, 'absent');
    fs.mkdirSync(absentDir);
    const absent = path.join(absentDir, 'knowledge-v2.db');
    await sessionEnd({ KNOWLEDGE_V2_DB: absent }, 'n7-W');
    expect(fs.readdirSync(absentDir)).toEqual([]);
  }, SPAWN_TIMEOUT);

  it('ob_end reconciles pending lines and says so', async () => {
    const dbPath = process.env.KNOWLEDGE_V2_DB!;
    if (!fs.existsSync(dbPath)) freshStore(dbPath);
    const p = pendingFile(dbPath);
    fs.writeFileSync(p, `${line('n7-endsess', '2026-10-13T11:00:00.001Z')}\n${line('n7-endsess', '2026-10-13T11:00:00.002Z', 'ls')}\n`);

    const res = await server.handleEnd({ project_root: dir, session_summary: 't159' });
    const text = res.content[0].text;
    expect(text).toContain('trigger fires: 2 not-asked fire(s) reconciled');
    const db = new Database(dbPath, { readonly: true });
    const n = (db.prepare("SELECT COUNT(*) AS n FROM trigger_fires WHERE session_uuid = 'n7-endsess'").get() as { n: number }).n;
    db.close();
    expect(n).toBe(2);
    expect(fs.existsSync(p)).toBe(false);
  }, SPAWN_TIMEOUT);

  it('N7c: a store that refuses the insert — SessionEnd exits 0, says NOT RECONCILED, and carries on', async () => {
    const dbPath = path.join(dir, 'store', 'knowledge-v2.db');
    fs.mkdirSync(path.dirname(dbPath));
    freshStore(dbPath);
    const w = new Database(dbPath);
    w.exec(`CREATE TRIGGER t159_abort BEFORE INSERT ON trigger_fires BEGIN SELECT RAISE(ABORT, 'induced'); END;`);
    w.close();
    const env = { KNOWLEDGE_V2_DB: dbPath, RECALL_TRIGGER_LOG: path.join(dir, 'store', 'recall-trigger.log') };

    await runHook(shell('git status', 'n7c-X'), env);
    await runHook(shell('ls -la', 'n7c-X'), env);
    await runHook(bash('git log --oneline', 'n7c-Y'), env);
    expect(readLines(pendingFile(dbPath))).toHaveLength(3);

    const end = await sessionEnd(env, 'n7c-Y');
    expect(end.status).toBe(0);
    const failed = end.stdout.indexOf('[session-end] trigger fires NOT RECONCILED: ');
    const next = end.stdout.indexOf('[session-end] v2 vault not found, skipping.');
    expect(failed).toBeGreaterThanOrEqual(0);
    expect(next).toBeGreaterThan(failed);
    expect(readLines(pendingFile(dbPath))).toHaveLength(3);
  }, SPAWN_TIMEOUT);

  it('N9: a dry-run ob_end leaves the pending file byte for byte and says it did not reconcile', async () => {
    const dbPath = process.env.KNOWLEDGE_V2_DB!;
    if (!fs.existsSync(dbPath)) freshStore(dbPath);
    const p = pendingFile(dbPath);
    const text = `${line('n9-dry', '2026-10-13T11:30:00.001Z')}\n${line('n9-dry', '2026-10-13T11:30:00.002Z', 'ls')}\n`;
    fs.writeFileSync(p, text);
    try {
      const res = await server.handleEnd({ project_root: dir, session_summary: 't159 n9', dry_run: true });
      expect(res.content[0].text).toContain('trigger fires: not reconciled (dry run)');
      expect(fs.readFileSync(p, 'utf-8')).toBe(text);
      const db = new Database(dbPath, { readonly: true });
      const n = (db.prepare("SELECT COUNT(*) AS n FROM trigger_fires WHERE session_uuid = 'n9-dry'").get() as { n: number }).n;
      db.close();
      expect(n).toBe(0);
    } finally {
      fs.rmSync(p, { force: true });
    }
  }, SPAWN_TIMEOUT);
});
