import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, existsSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import Database from 'better-sqlite3';
import { spawnAsync } from './spawn-async.js';
import * as dbV2 from '../src/db-v2.js';
import * as frontmatter from '../src/shared/parse-frontmatter.js';
import * as vaultWriter from '../src/vault-writer.js';
import * as topics from '../src/pipelines/topics/index.js';

/**
 * T-243: the #484 audit lows (brief: docs/loops/t243-audit-lows-brief.md).
 *
 * L1  the recall-trigger log never quotes a malformed payload.
 * Y1  single-quoted YAML scalars and inline-array items parse as YAML says.
 * P1  a summary's project and its tag slug are one slug, so one topic.
 * D1  the trust boundaries are written down in SECURITY.md.
 */

const SPAWN_TIMEOUT = 180_000;
const HOOK = 'src/cli-recall-trigger.ts';

describe('L1: the recall-trigger log withholds the payload', () => {
  let dir: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 't243-l1-'));
  });

  afterEach(() => {
    try { rmSync(dir, { recursive: true, force: true }); } catch { /* Windows race */ }
  });

  // Written by hand on purpose: both are payloads that are NOT valid JSON.
  const payloads = [
    'ghp_T243SECRET',
    '{"tool_name":"Bash","session_id":"s","tool_input":{"command": ghp_T243SECRETxyz}}',
  ];

  for (const [i, input] of payloads.entries()) {
    it(`malformed payload ${i + 1} is logged without its text`, async () => {
      const logPath = join(dir, 'recall-trigger.log');
      const r = await spawnAsync('npx', ['tsx', HOOK], {
        input,
        env: { ...process.env, KNOWLEDGE_V2_DB: join(dir, 'k.db'), RECALL_TRIGGER_LOG: logPath },
        shell: true,
      });

      expect(r.status).toBe(0);
      expect((r.stdout ?? '').trim()).toBe('');
      expect(r.stderr ?? '').toBe('');
      expect(existsSync(logPath)).toBe(true);
      const log = readFileSync(logPath, 'utf-8');
      const lines = log.split('\n').filter(Boolean);
      expect(lines).toHaveLength(1);
      expect(lines[0]).toContain('payload is not valid JSON');
      expect(log).not.toContain('T243');
    }, SPAWN_TIMEOUT);
  }
});

describe('Y1: single-quoted YAML', () => {
  it('parses single-quoted scalars, inline-array items and quoted numbers', () => {
    const fm = frontmatter.parseFrontmatter(
      ['---', "key: 'x: y'", "tags: ['a', 'b, c', 'it''s']", "n: '123'", 'm: 42', '---', '', 'body'].join('\n'),
    );
    expect(fm.key).toBe('x: y');
    expect(fm.tags).toEqual(['a', 'b, c', "it's"]);
    expect(fm.n).toBe('123');
    expect(fm.m).toBe(42);
  });

  it('an unterminated single quote falls back to the raw text', () => {
    expect(frontmatter.parseInlineArray("alpha, 'broken")).toEqual(["alpha, 'broken"]);
  });

  it("a key containing single quotes round-trips through writeExperience", () => {
    const vault = mkdtempSync(join(tmpdir(), 't243-y1-'));
    try {
      const path = vaultWriter.writeExperience(vault, {
        key: "'quoted'", tags: ['a'], content: 'c', created: '2026-10-13', maturity: 'proven',
        helpful: 0, harmful: 0, neutral: 0, project: 'General', source: 'agent',
      });
      expect(path).not.toBeNull();
      const fm = frontmatter.parseFrontmatter(readFileSync(path!, 'utf-8'));
      expect(fm.key).toBe("'quoted'");
    } finally {
      rmSync(vault, { recursive: true, force: true });
    }
  });
});

describe('P1: one project slug', () => {
  it('summaries for "C++ Tools" land under c-tools only, and a non-ASCII project keeps its name', () => {
    const vault = mkdtempSync(join(tmpdir(), 't243-p1-'));
    const db = new Database(':memory:');
    try {
      dbV2.initSchemaV2(db);
      for (let d = 1; d <= 5; d++) {
        vaultWriter.writeSummary(vault, {
          sessionId: `s-${d}`, project: 'C++ Tools', date: `2026-09-0${d}`, content: 'notes',
        });
      }
      vaultWriter.writeSummary(vault, { sessionId: 's-6', project: '项目', date: '2026-09-06', content: 'notes' });

      const plans = topics.planTopics(db, vault, { min: 5 });
      const byTag = new Map(plans.map((p) => [p.tag, p.links]));

      expect(byTag.has('c-tools')).toBe(true);
      expect(byTag.has('c++-tools')).toBe(false);
      expect(byTag.get('c-tools')).toHaveLength(5);
      for (const [tag, links] of byTag) {
        if (tag === 'c-tools') continue;
        expect(links.some((l) => l.includes('c-tools'))).toBe(false);
      }
      expect(byTag.has('项目')).toBe(true);
    } finally {
      db.close();
      rmSync(vault, { recursive: true, force: true });
    }
  });
});

describe('D1: trust boundaries are written down', () => {
  it('SECURITY.md names the boundaries and no longer claims no network calls', () => {
    const security = readFileSync(
      fileURLToPath(new URL('../../.agents/SYSTEM/SECURITY.md', import.meta.url)),
      'utf-8',
    );
    for (const needle of ['.gitnexus/run.cjs', 'project_root', 'OPEN_BRAIN_VAULT_DIR', 'cli-recall-trigger.js', 'shell-equivalent']) {
      expect(security).toContain(needle);
    }
    expect(security).not.toContain('No network calls');
  });
});
