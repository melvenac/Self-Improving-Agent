import { describe, it, expect, afterEach } from 'vitest';
import Database from 'better-sqlite3';
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { initSchemaV2, indexKnowledge } from '../../src/db-v2.js';
import * as run from '../../src/trigger/run.js';
import type { TriggerPolicy } from '../../src/trigger/policy.js';

/**
 * T-313: a stored entry written for one seat's ops skill (a `<seat>-ops` tag, or a path into
 * `.claude/skills/<seat>-ops`) does not fire for another seat. Measured 10-24 on the live store: 78 of 864 live
 * entries name a seat, and replaying the injected fires by each session's registered project put about 60 of 194
 * seat-specific injections in another seat's session (approximate: a project's identity is not always its seat's).
 * The seat is the hook's checkout identity, falling back to the project the session registered; an unresolved seat
 * fires everything, as before.
 *
 * `seat.js` is imported through a variable so the red commit runs: a missing module is a failing row, not a file
 * that cannot load.
 */

const POLICY: TriggerPolicy = { relevance_floor: -1000, max_injected: 1, deadline_ms: 2000, provenance: 't313' };
const G039 = 'npx vitest run 2>&1 | tail -8; echo $?';
const ELEMENT = '[EXPERIENCE] Piping to tail masks the exit code\nACTION: Read ${PIPESTATUS[0]}, because tail exit code is not the command exit code.';
const KEYED = '[EXPERIENCE] k\nMATCH: command: `git show <ref>:<path>`\nACTION: use a forward slash in the path';
const KEYED_CMD = 'git show origin/master:src/a.ts';

const SEAT_MODULE = '../../src/trigger/seat.js';
const seatMod = async () => (await import(SEAT_MODULE)) as {
  entrySeat: (content: string, tags: string) => string | null;
  resolveTriggerSeat: (db: Database.Database, sessionUuid: string, cwd: string | null) => string | null;
};

const dbs: Database.Database[] = [];
const dirs: string[] = [];
afterEach(() => {
  for (const db of dbs.splice(0)) db.close();
  for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true });
});

function store(entries: Array<{ key: string; content: string; tags: string }>): { db: Database.Database; id: (k: string) => number } {
  const db = new Database(':memory:');
  dbs.push(db);
  initSchemaV2(db);
  for (const e of entries) indexKnowledge(db, { vaultPath: `${e.key}.md`, key: e.key, content: e.content, tags: e.tags, source: 'test' });
  return { db, id: (k) => (db.prepare('SELECT id FROM knowledge_index WHERE key = ?').get(k) as { id: number }).id };
}

const lastQuery = (db: Database.Database) =>
  (db.prepare('SELECT query FROM trigger_fires ORDER BY id DESC LIMIT 1').get() as { query: string }).query;

function checkout(name: string | null): string {
  const d = mkdtempSync(join(tmpdir(), 't313-'));
  dirs.push(d);
  if (name !== null) {
    mkdirSync(join(d, '.agents'));
    writeFileSync(join(d, '.agents', 'AGENT.local.md'), `---\nname: ${name}\nrole: planner\n---\n`);
  }
  return d;
}

describe('T-313: a seat-specific entry fires only for its own seat', () => {
  it('S1 entrySeat: a <seat>-ops tag or a skills path names the seat; a hyphenated skill and a bare $S path name none', async () => {
    const { entrySeat } = await seatMod();
    expect(entrySeat('ACTION: x', 'github,ci,atlas-ops')).toBe('atlas');
    expect(entrySeat('ACTION: run C:/Users/u/.claude/skills/clark-ops/scripts/launch.sh', '')).toBe('clark');
    expect(entrySeat('ACTION: run C:\\Users\\u\\.claude\\skills\\maker-ops\\scripts\\x.sh', 'tooling')).toBe('maker');
    expect(entrySeat('ACTION: see ~/.claude/skills/clark-ops/', 'relay-ops')).toBe('relay');
    expect(entrySeat('ACTION: x', 'mail-server-ops,gotcha')).toBeNull();
    expect(entrySeat('ACTION: run ~/.claude/skills/mail-server-ops/scripts/x.sh', '')).toBeNull();
    expect(entrySeat('ACTION: bash $S/pr-status.sh', 'github')).toBeNull();
    expect(entrySeat('ACTION: x', '')).toBeNull();
  });

  it('S2 element path: an entry tagged for another seat is skipped and recorded as seat-skip', async () => {
    const { db, id } = store([{ key: 'tail', content: ELEMENT, tags: 'atlas-ops' }]);
    const out = run.runTrigger({ db, sessionUuid: 's2', command: G039, policy: POLICY, seat: 'clark' } as never);
    expect(out.state).toBe('silent');
    expect(out.ids).toEqual([]);
    expect(lastQuery(db)).toContain(`seat-skip:${id('tail')}`);
  });

  it('S3 element path: the own seat, an unresolved seat and an untagged entry still fire', async () => {
    const { db, id } = store([{ key: 'tail', content: ELEMENT, tags: 'atlas-ops' }]);
    for (const [session, seat] of [['s3a', 'Atlas'], ['s3b', null]] as const) {
      const out = run.runTrigger({ db, sessionUuid: session, command: G039, policy: POLICY, seat } as never);
      expect(out.state).toBe('injected');
      expect(out.ids).toEqual([id('tail')]);
      expect(lastQuery(db)).not.toContain('seat-skip');
    }
    const plain = store([{ key: 'tail', content: ELEMENT, tags: 'gotcha' }]);
    const out = run.runTrigger({ db: plain.db, sessionUuid: 's3c', command: G039, policy: POLICY, seat: 'clark' } as never);
    expect(out.state).toBe('injected');
  });

  it('S4 keyed path: a keyed entry whose path names another seat is skipped; for its own seat it fires', async () => {
    const content = `${KEYED} with ~/.claude/skills/atlas-ops/scripts/x.sh`;
    const { db, id } = store([{ key: 'k', content, tags: '' }]);
    const other = run.runTrigger({ db, sessionUuid: 's4a', command: KEYED_CMD, policy: POLICY, keyIds: [id('k')], seat: 'maker' } as never);
    expect(other.state).toBe('silent');
    expect(lastQuery(db)).toBe(`match:${id('k')} seat-skip:${id('k')}`);
    const own = run.runTrigger({ db, sessionUuid: 's4b', command: KEYED_CMD, policy: POLICY, keyIds: [id('k')], seat: 'atlas' } as never);
    expect(own.state).toBe('injected');
    expect(lastQuery(db)).toBe(`match:${id('k')}`);
  });

  it('S5 resolveTriggerSeat: the checkout identity first, else the registered project, else null; never throws', async () => {
    const { resolveTriggerSeat } = await seatMod();
    const { db } = store([]);
    const atlas = checkout('Atlas');
    const bare = checkout(null);
    const fleet = checkout('Clark');
    db.prepare('INSERT INTO sessions (uuid, project_dir, started_at) VALUES (?, ?, ?)').run('u-fleet', fleet, '2026-10-24T00:00:00Z');
    expect(resolveTriggerSeat(db, 'u-fleet', atlas)).toBe('atlas');
    expect(resolveTriggerSeat(db, 'u-fleet', bare)).toBe('clark');
    expect(resolveTriggerSeat(db, 'u-none', bare)).toBeNull();
    expect(resolveTriggerSeat(db, 'u-fleet', null)).toBe('clark');
    const empty = new Database(':memory:');
    dbs.push(empty);
    expect(resolveTriggerSeat(empty, 'u-fleet', bare)).toBeNull();
  });

  it('S6 the hook resolves the seat from its payload cwd and passes it to runTrigger', () => {
    const src = readFileSync(join(import.meta.dirname, '..', '..', 'src', 'cli-recall-trigger.ts'), 'utf8');
    expect(src).toContain('resolveTriggerSeat(readDb, sessionUuid, cwd)');
    expect(src).toContain('policy, keyIds, seat })');
  });
});
