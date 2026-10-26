import { describe, it, expect, afterEach } from 'vitest';
import Database from 'better-sqlite3';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { initSchemaV2, indexKnowledge } from '../../src/db-v2.js';
import * as mk from '../../src/trigger/match-keys.js';
import { writeTriggerKeys } from '../../src/trigger/keys-writer.js';
import { pendingFiresPath } from '../../src/trigger/pending-fires.js';
import * as run from '../../src/trigger/run.js';
import type { TriggerPolicy } from '../../src/trigger/policy.js';
import { spawnAsync } from '../spawn-async.js';

/**
 * T-170 part (iii): a lesson's `MATCH: path:` key is matched against the file an Edit or Write call touched
 * (`tool_input.file_path`). 50 live lessons carried a path key on 10-26 and none was ever read: the hook returned before
 * any lookup for a tool that is not a shell. The keys ride the command keys' sidecar as `pathKeys`; the asked path
 * re-reads each entry and re-tests it, so a stale sidecar can cost a miss, never a wrong injection. An Edit or Write
 * whose file matches no key leaves nothing behind: no fire row and no pending not-asked line.
 *
 * The new functions are looked up by name so the rows also run (and go red) against the product before this change.
 */
type PathKey = { id: number; glob: string };
const fn = mk as unknown as {
  parsePathKey: (content: string) => string | null;
  pathMatchesKey: (glob: string, filePath: string, home?: string) => boolean;
  matchingPathKeyIds: (keys: PathKey[], filePath: string, home?: string) => number[];
  readTriggerPathKeys: (p: string) => PathKey[];
};

const ROOT = path.join(import.meta.dirname, '..', '..');
const HOOK = path.join(ROOT, 'src', 'cli-recall-trigger.ts');
const TSX_CLI = path.join(ROOT, 'node_modules', 'tsx', 'dist', 'cli.mjs');
const POLICY: TriggerPolicy = { relevance_floor: -1000, max_injected: 1, deadline_ms: 2000, provenance: 't170-iii' };

const HTTP = '[EXPERIENCE] h\nMATCH: path: convex/http.ts (checkout args)\nACTION: read the checkout args before editing http.ts';
const BRIEF = '[EXPERIENCE] b\nMATCH: path: `docs/loops/*brief*.md`\nACTION: run the brief checklist';
const PROSE = '[EXPERIENCE] p\nMATCH: path: agent-dashboard server/aggregate.js parkedOnDemand\nACTION: z';
const GIT_CMD = '[EXPERIENCE] c\nMATCH: command: `git show <ref>:<path>`\nACTION: use a forward slash in the path';

const dbs: Database.Database[] = [];
const dirs: string[] = [];
afterEach(() => {
  for (const db of dbs.splice(0)) db.close();
  for (const d of dirs.splice(0)) fs.rmSync(d, { recursive: true, force: true, maxRetries: 3, retryDelay: 50 });
});
const tmp = (): string => {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 't170p-'));
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

describe('T-170 (iii): path keys', () => {
  it('P1 parsePathKey: the backticked span, else the text before a parenthetical; prose, short or absent is null', () => {
    expect(fn.parsePathKey(HTTP)).toBe('convex/http.ts');
    expect(fn.parsePathKey(BRIEF)).toBe('docs/loops/*brief*.md');
    expect(fn.parsePathKey('x\nMATCH: path: C:\\Users\\x\\src\\a.ts\nACTION: y')).toBe('C:/Users/x/src/a.ts');
    expect(fn.parsePathKey(PROSE)).toBeNull();
    expect(fn.parsePathKey('x\nMATCH: path: *.md\nACTION: y')).toBeNull();
    expect(fn.parsePathKey(GIT_CMD)).toBeNull();
  });

  it('P2 pathMatchesKey: a relative key matches the tail on a segment boundary; * stays in a segment; ** crosses', () => {
    expect(fn.pathMatchesKey('convex/http.ts', 'C:\\repo\\convex\\http.ts')).toBe(true);
    expect(fn.pathMatchesKey('convex/http.ts', 'convex/http.ts')).toBe(true);
    expect(fn.pathMatchesKey('convex/http.ts', 'C:/repo/myconvex/http.ts')).toBe(false);
    expect(fn.pathMatchesKey('docs/loops/*brief*.md', 'C:/w/docs/loops/t170-iii-brief.md')).toBe(true);
    expect(fn.pathMatchesKey('docs/loops/*brief*.md', 'C:/w/docs/loops/x/t-brief.md')).toBe(false);
    expect(fn.pathMatchesKey('open-brain/**/*.test.ts', '/r/open-brain/tests/trigger/a.test.ts')).toBe(true);
    expect(fn.pathMatchesKey('src/app/(app)/admin/page.tsx', 'C:/r/src/app/(app)/admin/page.tsx')).toBe(true);
  });

  it('P3 pathMatchesKey: case-insensitive; ~/ is under home; an absolute key must match the whole path', () => {
    expect(fn.pathMatchesKey('Convex/HTTP.ts', 'c:/repo/convex/http.ts')).toBe(true);
    const sh = 'C:\\Users\\me\\.claude\\skills\\atlas-ops\\scripts\\x.sh';
    expect(fn.pathMatchesKey('~/.claude/skills/*-ops/scripts/*.sh', sh, 'C:\\Users\\me')).toBe(true);
    expect(fn.pathMatchesKey('~/.claude/skills/*-ops/scripts/*.sh', sh, 'C:\\Users\\other')).toBe(false);
    expect(fn.pathMatchesKey('C:/W/*-reply.md', 'C:\\W\\t1-reply.md')).toBe(true);
    expect(fn.pathMatchesKey('C:/W/*-reply.md', 'C:/W/sub/t1-reply.md')).toBe(false);
    expect(fn.pathMatchesKey('/srv/app.ts', '/x/srv/app.ts')).toBe(false);
  });

  it('P4 matchingPathKeyIds: longest key first; a bad sidecar reads as []', () => {
    const keys = [{ id: 2, glob: 'http.ts' }, { id: 1, glob: 'convex/http.ts' }, { id: 3, glob: 'convex/stripe.ts' }];
    expect(fn.matchingPathKeyIds(keys, 'C:/r/convex/http.ts')).toEqual([1, 2]);
    const p = path.join(tmp(), 'k.json');
    fs.writeFileSync(p, JSON.stringify({ keys: [], errorKeys: [], pathKeys: [{ id: 'x', glob: 1 }] }));
    expect(fn.readTriggerPathKeys(p)).toEqual([]);
  });

  it('P5 writeTriggerKeys writes pathKeys beside the command keys and returns the command counts unchanged', () => {
    const { db, ids } = memory({ http: HTTP, prose: PROSE, cmd: GIT_CMD });
    const p = path.join(tmp(), 'recall-trigger-keys.json');
    expect(writeTriggerKeys(db, p)).toEqual({ written: 1, unusable: 0 });
    const file = JSON.parse(fs.readFileSync(p, 'utf-8')) as { keys: unknown[]; pathKeys: PathKey[] };
    expect(file.keys).toEqual([{ id: ids.cmd, fragments: ['git show', ':'] }]);
    expect(file.pathKeys).toEqual([{ id: ids.http, glob: 'convex/http.ts' }]);
  });

  it('P6 runTrigger: a path key matching the file injects its entry, once per session, recorded as path-match', () => {
    const { db, ids } = memory({ http: HTTP });
    const file = 'C:\\repo\\convex\\http.ts';
    const out = run.runTrigger({ db, sessionUuid: 'p6', command: `Edit ${file}`, policy: POLICY, filePath: file, pathKeyIds: [ids.http] } as never);
    expect(out.state).toBe('injected');
    expect(out.ids).toEqual([ids.http]);
    expect(out.additionalContext).toContain('read the checkout args');
    expect(lastQuery(db)).toContain(`path-match:${ids.http}`);
    const again = run.runTrigger({ db, sessionUuid: 'p6', command: `Edit ${file}`, policy: POLICY, filePath: file, pathKeyIds: [ids.http] } as never);
    expect(again.state).toBe('silent');
  });

  it('P7 runTrigger: a stale sidecar id whose key does not match this file is re-tested and not injected', () => {
    const { db, ids } = memory({ http: HTTP });
    const file = 'C:/repo/convex/stripe.ts';
    const out = run.runTrigger({ db, sessionUuid: 'p7', command: `Write ${file}`, policy: POLICY, filePath: file, pathKeyIds: [ids.http] } as never);
    expect(out.state).toBe('silent');
    expect(out.ids).toEqual([]);
  });

  async function hook(payload: Record<string, unknown>) {
    const d = tmp();
    const dbPath = path.join(d, 'knowledge-v2.db');
    const db = new Database(dbPath);
    let ids: Record<string, number>;
    try {
      ids = seed(db, { http: HTTP });
      writeTriggerKeys(db, mk.triggerKeysPath(dbPath));
    } finally {
      db.close();
    }
    const r = await spawnAsync(process.execPath, [TSX_CLI, HOOK], {
      input: JSON.stringify(payload),
      env: { ...process.env, KNOWLEDGE_V2_DB: dbPath, RECALL_TRIGGER_LOG: path.join(d, 'log.txt') },
      cwd: ROOT,
    });
    const fires = (): number => {
      const ro = new Database(dbPath, { readonly: true });
      try {
        const t = ro.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'trigger_fires'").get();
        return t ? (ro.prepare('SELECT COUNT(*) AS n FROM trigger_fires').get() as { n: number }).n : 0;
      } finally {
        ro.close();
      }
    };
    return { r, ids, dbPath, fires };
  }

  it('P8 the hook: an Edit whose file matches a path key gets the entry on PostToolUse', async () => {
    const { r, ids } = await hook({
      session_id: 'p8', hook_event_name: 'PostToolUse', tool_name: 'Edit',
      tool_input: { file_path: 'C:\\repo\\convex\\http.ts', old_string: 'a', new_string: 'b' },
      tool_response: { filePath: 'C:\\repo\\convex\\http.ts' },
    });
    expect(r.status).toBe(0);
    const out = JSON.parse(r.stdout) as { hookSpecificOutput: { hookEventName: string; additionalContext: string } };
    expect(out.hookSpecificOutput.hookEventName).toBe('PostToolUse');
    expect(out.hookSpecificOutput.additionalContext).toContain(`[stored knowledge ${ids.http}`);
  }, 120_000);

  it('P9 the hook: a Write whose file matches no key says nothing and leaves no fire row and no pending line', async () => {
    const { r, dbPath, fires } = await hook({
      session_id: 'p9', hook_event_name: 'PostToolUse', tool_name: 'Write',
      tool_input: { file_path: 'C:/repo/convex/stripe.ts', content: 'x' },
    });
    expect(r.status).toBe(0);
    expect(r.stdout.trim()).toBe('');
    expect(fires()).toBe(0);
    expect(fs.existsSync(pendingFiresPath(dbPath))).toBe(false);
  }, 120_000);
});
