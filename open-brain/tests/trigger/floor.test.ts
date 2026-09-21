import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import Database from 'better-sqlite3';
import { initSchemaV2, indexKnowledge } from '../../src/db-v2.js';
import { queryStore } from '../../src/trigger/query.js';
import {
  loadPolicy,
  policyDir,
  policyJsonSchema,
  serialisePolicySchema,
  TriggerPolicySchema,
  POLICY_FILE,
  POLICY_SCHEMA_FILE,
} from '../../src/trigger/policy.js';

/**
 * A4 — the relevance floor is DATA, and changing the data changes the
 * behaviour with no source change.
 *
 * ## Why this fixture has six hundred documents in it
 *
 * The floor is compared against bm25, and bm25's IDF term depends on how many
 * documents in the corpus carry each term. Measured 2026-09-20: against the
 * live store (599 entries) the G-039 query scores entry 299 at 14.01 and its
 * weakest match at 6.03; against a three-row fixture every score collapses to
 * roughly 5e-6, because a term present in most of a tiny corpus says almost
 * nothing.
 *
 * So a small fixture cannot test this value. At the shipped floor a three-row
 * store is silent for EVERY input, and "the floor silenced the weak match"
 * would pass with the floor doing no work at all — a green row whose green
 * means something other than what it says, which is the class amendment 1 §1
 * records twice. The corpus below is therefore built to production scale, and
 * the assertions check the SHIPPED number rather than a convenient one.
 */

/** The shipped floor's neighbourhood, measured against the live store. */
const STRONG = [
  'Piping to tail masks the real exit code — and I reported a false success because of it.',
  'TRIGGER: any time output is trimmed with tail or head AND the exit status of that command matters.',
  'ACTION: read PIPESTATUS instead of the status the pipeline reports, because tail exit code is not the command exit code.',
  'The exit code you read after a pipe is tail exit code. Read the real exit code from the process.',
].join(' ');

/**
 * All three terms, once each, buried in an unrelated document. This is the
 * entry the floor exists to keep out: it MATCHES the precise query, so the
 * conjunction cannot exclude it and only relevance can.
 */
const WEAK = [
  'Deployment runbook for the staging environment.',
  'Bring the containers up with compose, wait for the health check, and confirm the migration ran.',
  'The dashboard shows request counts, latency percentiles and error rates for each service.',
  'If a container refuses to start, read the tail of its log before restarting it.',
  'A non-zero exit from the migration step means the schema is half applied.',
  'The deploy code lives beside the compose file and is versioned with the service.',
  'Rotate the credentials quarterly and record the rotation in the operations log.',
  'Backups run nightly and are verified weekly by restoring into a scratch database.',
  'Traefik terminates TLS and routes by host rule; the certificate resolver is shared.',
  'Volume mounts are declared in the compose file and survive a container replacement.',
].join(' ');

const G039_COMMAND = 'npx vitest run 2>&1 | tail -8; echo $?';

let db: Database.Database;

beforeAll(() => {
  db = new Database(':memory:');
  initSchemaV2(db);

  const add = (key: string, content: string) =>
    indexKnowledge(db, { vaultPath: `${key}.md`, key, content, tags: '', source: 'test' });

  // 597 documents that do not carry the query's terms, so the corpus has
  // production-like term statistics rather than a fixture's.
  const filler = [
    'Convex validators reject an argument whose shape does not match the declared type.',
    'The vault is the source of truth and the database index is rebuildable from it.',
    'A worktree shares the object store with its clone and has its own HEAD.',
    'Session provenance is keyed to the uuid the hook payload carried.',
    'Maturity promotion tracks recall volume rather than usefulness.',
  ];
  for (let i = 0; i < 597; i++) add(`filler-${i}`, `${filler[i % filler.length]} Document ${i}.`);

  add('pipe-to-tail-masks-exit-code', STRONG);
  add('staging-runbook', WEAK);
});

afterAll(() => db.close());

describe('A4 — the floor is read from data', () => {
  it('the shipped policy validates against its own contract', () => {
    const policy = loadPolicy();
    expect(TriggerPolicySchema.safeParse(policy).success).toBe(true);
    expect(policy.max_injected).toBeGreaterThanOrEqual(1);
  });

  it('R19: the shipped floor carries the corpus and date it was measured against', () => {
    // The floor is a cut on a scale that moves with the store's size, which
    // the loop accepted as a limit rather than repairing. A limit nobody can
    // see is not stated — so the provenance is required by the contract AND
    // checked for the two things that make it re-measurable: how big the
    // corpus was, and when. A free-text field nobody asserts on is the same
    // rot one step later.
    const { provenance } = loadPolicy();
    expect(provenance).toMatch(/\b599\b/);
    expect(provenance).toMatch(/\b\d{4}-\d{2}-\d{2}\b/);
    expect(provenance).toContain(String(loadPolicy().relevance_floor));
  });

  it('the corpus is at production scale, so the shipped number means here what it means live', () => {
    // Guards the guard. If this fixture ever shrinks, bm25's IDF term
    // collapses and every score with it — at which point the shipped floor
    // silences everything and the two rows below pass with the floor doing no
    // work. Measured here: 20.98 (strong) and 4.28 (weak), against 14.01 and
    // 6.03 for the real store's best and weakest match on 2026-09-20. The
    // assertion is on the SHAPE of that — both on the live scale, and the
    // shipped floor strictly between them — not on the exact numbers, which
    // are bm25's to change.
    const scored = queryStore({ db, command: G039_COMMAND, floor: -Infinity, limit: 10 });
    const strong = scored.find((h) => h.key === 'pipe-to-tail-masks-exit-code');
    const weak = scored.find((h) => h.key === 'staging-runbook');
    const floor = loadPolicy().relevance_floor;

    expect(strong!.relevance).toBeGreaterThan(floor);
    expect(weak!.relevance).toBeLessThan(floor);
    // Not a toy corpus: a three-row fixture scores everything near 5e-6.
    expect(strong!.relevance).toBeGreaterThan(1);
  });

  it('at the SHIPPED floor: the strong entry is injected and the weak one is not', () => {
    // Both directions in one test (T-156). A floor that silences everything
    // would pass the negative half alone, which is how a vacuous threshold
    // survives.
    const { relevance_floor } = loadPolicy();
    const keys = queryStore({ db, command: G039_COMMAND, floor: relevance_floor, limit: 10 }).map((h) => h.key);

    expect(keys).toContain('pipe-to-tail-masks-exit-code');
    expect(keys).not.toContain('staging-runbook');
  });

  it('the weak entry really does MATCH the precise query — the floor is what excludes it', () => {
    // Without this, the row above passes because the conjunction missed the
    // decoy, and the floor is again untested. Asserted with the floor removed.
    const keys = queryStore({ db, command: G039_COMMAND, floor: -Infinity, limit: 10 }).map((h) => h.key);
    expect(keys).toContain('staging-runbook');
  });

  describe('changing the data changes the behaviour, with no source change', () => {
    let dir: string;

    beforeEach(() => {
      dir = mkdtempSync(join(tmpdir(), 'trigger-policy-'));
    });

    afterEach(() => rmSync(dir, { recursive: true, force: true }));

    const writePolicy = (floor: number, maxInjected = 1) =>
      writeFileSync(
        join(dir, POLICY_FILE),
        `${JSON.stringify(
          { relevance_floor: floor, max_injected: maxInjected, deadline_ms: 2000, provenance: 'test fixture, 599 entries, 2026-09-20' },
          null,
          2,
        )}\n`,
        'utf-8',
      );

    it('lowered: the same call injects the weak entry; restored: silent again', () => {
      const shipped = loadPolicy().relevance_floor;
      const hits = (floor: number) =>
        queryStore({ db, command: G039_COMMAND, floor, limit: 10 }).map((h) => h.key);

      writePolicy(shipped);
      expect(hits(loadPolicy(dir).relevance_floor)).not.toContain('staging-runbook');

      writePolicy(0);
      expect(hits(loadPolicy(dir).relevance_floor)).toContain('staging-runbook');

      writePolicy(shipped);
      expect(hits(loadPolicy(dir).relevance_floor)).not.toContain('staging-runbook');
    });

    it('refuses a policy file with an unknown key rather than ignoring it', () => {
      writeFileSync(
        join(dir, POLICY_FILE),
        JSON.stringify({ relevance_floor: 8, max_injected: 1, deadline_ms: 2000, provenance: 'x', relevence_floor: 0 }),
        'utf-8',
      );
      expect(() => loadPolicy(dir)).toThrow(/does not match the policy schema/);
    });

    it('refuses a missing policy file rather than defaulting', () => {
      expect(() => loadPolicy(dir)).toThrow(/not found/);
    });

    it('refuses a malformed policy file', () => {
      writeFileSync(join(dir, POLICY_FILE), '{ "relevance_floor": 8,', 'utf-8');
      expect(() => loadPolicy(dir)).toThrow(/not valid JSON/);
    });
  });

  it('the derived schema file has not drifted from the zod contract (D-021)', () => {
    const onDisk = readFileSync(join(policyDir(), POLICY_SCHEMA_FILE), 'utf-8');
    expect(onDisk).toBe(serialisePolicySchema(policyJsonSchema()));
  });

  it('the shipped values and the derived schema agree on the key set', () => {
    const values = JSON.parse(readFileSync(join(policyDir(), POLICY_FILE), 'utf-8')) as Record<string, unknown>;
    const schema = policyJsonSchema() as { properties: Record<string, unknown> };
    expect(Object.keys(values).sort()).toEqual(Object.keys(schema.properties).sort());
  });

  it('the floor is not also written as a literal in the query code (ruling 5)', () => {
    // A source-text scan, so T-156 applies: validated against a known
    // positive AND a known negative in the same test, because a scan that
    // matches nothing is indistinguishable from a scan that is broken. G-040
    // is this defect in the other direction — a scan that fired on the
    // sentence forbidding the thing.
    const scan = (source: string, value: string): boolean =>
      // Comments stripped first: the module header discusses `tail -8` and
      // quotes measured scores, and a scan that reads prose as code would go
      // red on its own documentation.
      source.replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, '').includes(value);

    const shipped = String(loadPolicy().relevance_floor);
    const real = readFileSync(new URL('../../src/trigger/query.ts', import.meta.url), 'utf-8');

    // KNOWN POSITIVE — the scan sees a planted threshold.
    expect(scan(`const floor = ${shipped}; // planted`, shipped)).toBe(true);
    // KNOWN NEGATIVE — and does not see one inside a comment.
    expect(scan(`// the floor is ${shipped} and lives in policy\nconst x = 1;`, shipped)).toBe(false);
    // THE CLAIM.
    expect(scan(real, shipped)).toBe(false);

    // What this cannot do, stated rather than implied: it looks for ONE
    // number in ONE file. A threshold hand-edited under another name, or into
    // another module, passes it.
  });
});
