import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { spawnAsync } from '../spawn-async.js';
import { mkdtempSync, rmSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import Database from 'better-sqlite3';
import { initSchemaV2, indexKnowledge } from '../../src/db-v2.js';
import { loadPolicy } from '../../src/trigger/policy.js';

/**
 * A5 and A6 — the hook as the host invokes it.
 *
 * BLACK BOX: the entry point is run as a child process with JSON on stdin,
 * and every assertion is on what came back out — stdout, stderr, exit code,
 * the log file. Nothing here imports the hook's internals, because the thing
 * under test is the contract with Claude Code and an in-process call would
 * assert a different one.
 *
 * EVERY PAYLOAD IS BUILT WITH JSON.stringify AND NEVER BY HAND. QA's Loop 14
 * lesson: a payload hand-written with Windows backslashes is invalid JSON,
 * and before the repair the hook then greeted the shell's own directory while
 * looking entirely healthy. Two of that seat's negative checks were reading
 * its own checkout.
 *
 * A5's POSITIVE CASE RUNS AT SCALE, THROUGH THE REAL PATH (R20). The store
 * below holds 599 documents, and the hook reads the SHIPPED floor from the
 * policy file — no floor override, no shortcut. A ten-document fixture cannot
 * meet this row: at that size bm25's IDF collapses and entry 299 itself
 * scores about 5e-6, so a positive there would be measuring the fixture
 * rather than the path. A5's negatives are fixture-independent (R16): they
 * are `not asked`, and no query is run at all.
 */

const ENTRY_299 = [
  '[EXPERIENCE] Piping to tail/head masks the real exit code',
  'TRIGGER: any time output is trimmed with tail or head AND the exit status of that command matters.',
  'ACTION: Read PIPESTATUS instead of the exit code the pipeline reports, because tail exit code is not the command exit code.',
  'CONTEXT: I read a zero from a pipe and reported a false success.',
].join('\n');

const G039_COMMAND = 'npx vitest run 2>&1 | tail -8; echo $?';
const SESSION = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';

let dir: string;
let dbPath: string;
let logPath: string;

/** The hook's entry point, run through tsx exactly as the host runs node. */
const HOOK = 'src/cli-recall-trigger.ts';

interface HookResult { status: number; stdout: string; stderr: string }

/**
 * spawnSync, NOT execFileSync, and the difference was found by a mutant.
 *
 * execFileSync RETURNS ONLY STDOUT. The first version of this harness threw
 * away stderr and hardcoded `stderr: ''` on the success path, so every
 * `expect(result.stderr).toBe('')` below passed without ever looking — on the
 * exact observable R15 exists for. A mutant that made every failure write to
 * stderr survived the whole file. The instrument could not see the thing it
 * was asserting about, which is this loop's own subject one layer down.
 */
async function runHook(payload: unknown, env: Record<string, string> = {}): Promise<HookResult> {
  // Awaited, not spawnSync: twelve synchronous spawns were one stretch of 86-99 s with no macrotask under load (G-042).
  const r = await spawnAsync('npx', ['tsx', HOOK], {
    input: JSON.stringify(payload),
    env: { ...process.env, KNOWLEDGE_V2_DB: dbPath, RECALL_TRIGGER_LOG: logPath, ...env },
    shell: true,
  });
  return { status: r.status ?? -1, stdout: r.stdout ?? '', stderr: r.stderr ?? '' };
}

const postToolUse = (command: string, session = SESSION) => ({
  session_id: session,
  transcript_path: join(dir, 'transcript.jsonl'),
  cwd: dir,
  permission_mode: 'default',
  hook_event_name: 'PostToolUse',
  tool_name: 'Bash',
  tool_input: { command },
  tool_response: 'output the seat is about to read',
});

const logLines = (): string[] =>
  existsSync(logPath) ? readFileSync(logPath, 'utf-8').split('\n').filter((l) => l.trim() !== '') : [];

/**
 * ONE TRANSACTION, and it is not a tidiness preference — it is the fix for a
 * CI failure this file caused.
 *
 * Unlike the other fixtures here, this store is FILE-BACKED: a child process
 * has to open it, so `:memory:` is not available. `indexKnowledge` runs its
 * own statement, so 599 calls were 599 implicit transactions and 599 fsyncs.
 * Measured on the developer machine: **2999ms that way, 148ms wrapped**. That
 * was survivable locally and it blew vitest's 10s HOOK timeout on the slower
 * CI runner — where the whole file then reported 12 tests skipped, which
 * reads like a missing suite rather than a slow one.
 *
 * The explicit timeout below is defence in depth rather than the fix. A
 * timeout is not a correctness property: raising it alone would have left a
 * three-second setup that grows with the fixture, and the next person to add
 * documents would rediscover this on CI instead of here.
 */
beforeAll(() => {
  dir = mkdtempSync(join(tmpdir(), 'trigger-hook-'));
  dbPath = join(dir, 'knowledge-v2.db');
  logPath = join(dir, 'recall-trigger.log');

  const db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  initSchemaV2(db);
  const add = (key: string, content: string) =>
    indexKnowledge(db, { vaultPath: `${key}.md`, key, content, tags: '', source: 'test' });

  const filler = [
    'Convex validators reject an argument whose shape does not match the declared type.',
    'The vault is the source of truth and the database index is rebuildable from it.',
    'A worktree shares the object store with its clone and has its own HEAD.',
    'Session provenance is keyed to the uuid the hook payload carried.',
    'Maturity promotion tracks recall volume rather than usefulness.',
  ];
  db.transaction(() => {
    for (let i = 0; i < 598; i++) add(`filler-${i}`, `${filler[i % filler.length]} Document ${i}.`);
    add('pipe-to-tail-masks-exit-code', ENTRY_299);
  })();
  db.close();
}, 60_000);

afterAll(() => rmSync(dir, { recursive: true, force: true }));

beforeEach(() => {
  if (existsSync(logPath)) rmSync(logPath);
});

/**
 * Each row here SPAWNS A PROCESS — about 2.5s through tsx on this machine,
 * and more under a full-suite run. vitest's 5s default turned four of these
 * red in the full suite while every one passed alone, which is a timeout
 * masquerading as a failure. The generous number is the honest one; A10
 * measures the hook's real cost from the BUILT entry point, not from this.
 */
const SPAWN_TIMEOUT = 60_000;

// EVERY row in this file needs it, INCLUDING the `it.each` block. The three
// `it.each` rows were missed when the timeout was first added — a bulk edit
// matched `it(` and not `it.each([...])(`  — and they inherited the 5s
// default. They passed alone and timed out under a full-suite run, which is
// the same failure shape as the CI hook timeout this commit fixes, one layer
// out: a setting believed to be applied everywhere and applied not quite
// everywhere, with the gap only visible under load.

describe('A5 — what the hook emits', () => {
  it('POSITIVE, at scale, through the shipped floor: additionalContext carries 299 and its ACTION', async () => {
    const result = await runHook(postToolUse(G039_COMMAND));

    expect(result.status).toBe(0);
    const emitted = JSON.parse(result.stdout) as {
      hookSpecificOutput: { hookEventName: string; additionalContext: string };
    };

    expect(emitted.hookSpecificOutput.hookEventName).toBe('PostToolUse');
    expect(emitted.hookSpecificOutput.additionalContext).toContain('PIPESTATUS');

    // The id, read from the store rather than assumed.
    const db = new Database(dbPath, { readonly: true });
    const { id } = db.prepare('SELECT id FROM knowledge_index WHERE key = ?')
      .get('pipe-to-tail-masks-exit-code') as { id: number };
    db.close();
    expect(emitted.hookSpecificOutput.additionalContext).toContain(String(id));

    // No decision fields, on the emitted JSON itself (R2). That the host
    // would ignore them on PostToolUse is a fact cited from the hooks
    // reference, not something a mutant here proves.
    expect(Object.keys(emitted)).toEqual(['hookSpecificOutput']);
    expect(JSON.stringify(emitted)).not.toContain('permissionDecision');
    expect(JSON.stringify(emitted)).not.toContain('updatedInput');
    expect(result.stderr).toBe('');
  }, SPAWN_TIMEOUT);

  it('the POLICY FILE is what let 299 through — raise the floor and the same call goes silent', async () => {
    // Guards the positive above, and it needed strengthening: asserting only
    // that the emission happened cannot tell a policy-driven floor from an
    // internal default. Both directions, same command, same store, one
    // number changed on disk.
    const high = mkdtempSync(join(tmpdir(), 'trigger-high-'));
    writeFileSync(
      join(high, 'recall-trigger.json'),
      JSON.stringify({ ...loadPolicy(), relevance_floor: 1e9 }),
      'utf-8',
    );

    expect((await runHook(postToolUse(G039_COMMAND), { TRIGGER_POLICY_DIR: high })).stdout.trim()).toBe('');
    expect((await runHook(postToolUse(G039_COMMAND))).stdout.trim()).not.toBe('');
    rmSync(high, { recursive: true, force: true });
  }, SPAWN_TIMEOUT);

  it.each([
    ['git status --porcelain'],
    ['ls -la'],
    ['zzqx --flurb wibble'],
  ])('NEGATIVE: %s emits nothing at all — no key, no stdout, no stderr', async (command) => {
    const result = await runHook(postToolUse(command));

    expect(result.status).toBe(0);
    // Not "additionalContext is empty" — NOTHING. Present-and-empty is a fail
    // (R2), and an empty reminder trains the reader to skip the channel just
    // as a "no relevant entries" line would.
    expect(result.stdout.trim()).toBe('');
    expect(result.stderr).toBe('');
  }, SPAWN_TIMEOUT);

  it('ignores a tool that is not Bash, and says nothing about it', async () => {
    const result = await runHook({
      session_id: SESSION, hook_event_name: 'PostToolUse',
      tool_name: 'Read', tool_input: { file_path: '/tmp/x' },
    });
    expect(result.status).toBe(0);
    expect(result.stdout.trim()).toBe('');
    expect(result.stderr).toBe('');
  }, SPAWN_TIMEOUT);

  it('the fire is recorded for every invocation, in the right state', async () => {
    const db = new Database(dbPath, { readonly: true });
    const rows = db.prepare('SELECT state, COUNT(*) AS n FROM trigger_fires GROUP BY state')
      .all() as Array<{ state: string; n: number }>;
    db.close();

    const byState = Object.fromEntries(rows.map((r) => [r.state, r.n]));
    // The rows above ran: two injections and three not-asked, at least.
    expect(byState.injected).toBeGreaterThanOrEqual(2);
    expect(byState['not-asked']).toBeGreaterThanOrEqual(3);
  }, SPAWN_TIMEOUT);
});

describe('A6 — three failures, and the model hears none of them', () => {
  it('store path absent', async () => {
    const missing = join(dir, 'no-such-store.db');
    const result = await runHook(postToolUse(G039_COMMAND), { KNOWLEDGE_V2_DB: missing });

    expect(result.status).toBe(0);
    expect(result.stdout.trim()).toBe('');
    expect(result.stderr).toBe('');
    expect(logLines()).toHaveLength(1);
    // The message now comes from better-sqlite3's own refusal to open a
    // file that must exist, because that is the single guard (see the hook's
    // comment). Asserted on the file, not on my own wording of it.
    expect(logLines()[0]).toMatch(/trigger failed|unable to open/i);

    // AND the absent store was not helpfully created — an empty new database
    // would report a clean miss forever, which is indistinguishable from a
    // store with nothing relevant.
    expect(existsSync(missing)).toBe(false);
  }, SPAWN_TIMEOUT);

  it('store locked by another writer', async () => {
    const locker = new Database(dbPath);
    locker.pragma('locking_mode = EXCLUSIVE');
    locker.exec('BEGIN EXCLUSIVE');
    try {
      const result = await runHook(postToolUse(G039_COMMAND));

      expect(result.status).toBe(0);
      expect(result.stdout.trim()).toBe('');
      expect(result.stderr).toBe('');
      expect(logLines()).toHaveLength(1);
    } finally {
      locker.exec('ROLLBACK');
      locker.close();
    }
  }, SPAWN_TIMEOUT);

  it('past its own deadline: the work finished, and the result is still not emitted', async () => {
    // The deadline is data, so the case is reachable without a slow query:
    // point the hook at a policy whose deadline is 1ms and every invocation
    // is late. What is asserted is the EMISSION rule — a reminder that
    // arrives after the seat has read the result belongs nowhere.
    const lateDir = mkdtempSync(join(tmpdir(), 'trigger-late-'));
    const shipped = loadPolicy();
    writeFileSync(
      join(lateDir, 'recall-trigger.json'),
      JSON.stringify({ ...shipped, deadline_ms: 1 }),
      'utf-8',
    );

    const result = await runHook(postToolUse(G039_COMMAND), { TRIGGER_POLICY_DIR: lateDir });

    expect(result.status).toBe(0);
    expect(result.stdout.trim()).toBe('');
    expect(result.stderr).toBe('');
    expect(logLines()).toHaveLength(1);
    expect(logLines()[0]).toContain('deadline exceeded');
  }, SPAWN_TIMEOUT);

  it('a malformed payload is logged and dropped, NOT refused with a non-zero exit', async () => {
    // Deliberately unlike SessionStart's F4. That hook runs once and a
    // refusal is visible; this one runs after every tool call, and a host
    // that malforms payloads would turn a memory feature into a wall of
    // stderr in front of the model — on an event where stderr IS shown to it.
    const r = await spawnAsync('npx', ['tsx', HOOK], {
      input: '{ "tool_name": "Bash", ',
      env: { ...process.env, KNOWLEDGE_V2_DB: dbPath, RECALL_TRIGGER_LOG: logPath },
      shell: true,
    });
    const result = { status: r.status ?? -1, stdout: r.stdout ?? '', stderr: r.stderr ?? '' };

    expect(result.status).toBe(0);
    expect(result.stdout.trim()).toBe('');
    expect(result.stderr).toBe('');
    expect(logLines()[0]).toContain('not valid JSON');
  }, SPAWN_TIMEOUT);

  it('POSITIVE CONTROL: the same harness on a healthy store DOES emit', async () => {
    // Every row in this block asserts an absence. Without this, a broken
    // runHook — a bad path, a spawn that never starts — would make all five
    // pass. This is the row that proves the harness can see an emission.
    const result = await runHook(postToolUse(G039_COMMAND));
    expect(result.status).toBe(0);
    expect(result.stdout).toContain('additionalContext');
    expect(logLines()).toHaveLength(0);
  }, SPAWN_TIMEOUT);
});
