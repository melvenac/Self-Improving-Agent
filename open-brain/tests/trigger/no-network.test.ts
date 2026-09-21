import { describe, it, expect, afterEach } from 'vitest';
import http from 'node:http';
import https from 'node:https';
import net from 'node:net';
import tls from 'node:tls';
import dns from 'node:dns';
import Database from 'better-sqlite3';
import { initSchemaV2, indexKnowledge } from '../../src/db-v2.js';
import { deriveQuery, queryStore } from '../../src/trigger/query.js';
import { runTrigger, actionOf } from '../../src/trigger/run.js';
import { fireCounts, injectedIds } from '../../src/trigger/fires.js';
import { loadPolicy } from '../../src/trigger/policy.js';

/**
 * A11's fourth clause, and brief §3: **a test that fails if a network call is
 * attempted covers the trigger's module.**
 *
 * This was missing from candidate 1 and is QA's F1. The property held — there
 * is no network code in `src/trigger/` — but the guard the brief named did not
 * exist, and *the property holding today* and *a guard that notices when it
 * stops holding* are different things. That distinction is this loop's whole
 * subject, so shipping without it was the wrong shape twice over.
 *
 * ## Why a tripwire and not a source scan
 *
 * A grep for `fetch(` over `src/trigger/` would be a source-text scan, and
 * `G-040` is what those do: the scan that fired on the constant listing
 * forbidden subcommands, and the one that fired on a comment reading *the fix
 * is not shell: true*. It would also miss every indirect route — a transitive
 * import, a dynamic `require`, a native binding that opens a socket.
 *
 * So the check is at RUN TIME, over every network primitive a Node process can
 * reach, while the trigger's whole path executes. It records attempts rather
 * than only throwing, so a failure names what was called.
 *
 * ## The instrument is validated on known positives, in the same test (T-156)
 *
 * A tripwire that is installed wrongly records nothing and looks exactly like
 * a clean run. Every surface below is therefore fired deliberately once, and
 * the tripwire must see each one, before the negative is believed.
 */

type Attempt = string;

interface Tripwire {
  attempts: Attempt[];
  restore: () => void;
}

/**
 * Patch every outbound network surface to record and refuse.
 *
 * `net.Socket.prototype.connect` is the one that matters most: `http`,
 * `https` and `tls` all reach the network through it, so a route that avoided
 * the named module functions still trips this. The others are patched anyway,
 * because a recorded attempt naming `https.request` is a better failure
 * message than one naming a socket.
 */
function armTripwire(): Tripwire {
  const attempts: Attempt[] = [];
  const saved: Array<() => void> = [];

  const patch = <T extends object, K extends keyof T>(obj: T, key: K, label: string): void => {
    const original = obj[key];
    saved.push(() => { obj[key] = original; });
    obj[key] = ((...args: unknown[]) => {
      attempts.push(`${label}(${String(args[0] ?? '').slice(0, 60)})`);
      throw new Error(`network call attempted: ${label}`);
    }) as T[K];
  };

  patch(globalThis as unknown as { fetch: unknown }, 'fetch', 'fetch');
  patch(http, 'request', 'http.request');
  patch(http, 'get', 'http.get');
  patch(https, 'request', 'https.request');
  patch(https, 'get', 'https.get');
  patch(net, 'connect', 'net.connect');
  patch(net.Socket.prototype as unknown as { connect: unknown }, 'connect', 'net.Socket#connect');
  patch(tls, 'connect', 'tls.connect');
  patch(dns, 'lookup', 'dns.lookup');
  patch(dns.promises as unknown as { lookup: unknown }, 'lookup', 'dns.promises.lookup');

  return { attempts, restore: () => { for (const undo of saved.reverse()) undo(); } };
}

const G039_COMMAND = 'npx vitest run 2>&1 | tail -8; echo $?';
const SESSION = 'no-net00-0000-0000-0000-000000000000';

const seed = (): Database.Database => {
  const db = new Database(':memory:');
  initSchemaV2(db);
  indexKnowledge(db, {
    vaultPath: 'pipe.md',
    key: 'pipe-to-tail-masks-exit-code',
    content:
      'Piping to tail masks the real exit code.\nACTION: Read PIPESTATUS instead of the exit code the pipeline reports, because tail exit code is not the command exit code.',
    tags: '',
    source: 'test',
  });
  return db;
};

describe('A11 — the trigger attempts no network call, and the tripwire can see one', () => {
  let wire: Tripwire | undefined;
  afterEach(() => { wire?.restore(); wire = undefined; });

  it('KNOWN POSITIVE: the tripwire catches every surface it claims to cover', () => {
    // Fired before the negative is believed. A tripwire installed on the wrong
    // object records nothing and is indistinguishable from a clean run — the
    // same shape as the harness that could not see stderr (candidate 1, M18).
    wire = armTripwire();
    const w = wire;

    const fire = (label: string, f: () => unknown) => {
      expect(f, `${label} should have tripped the wire`).toThrow(/network call attempted/);
    };

    fire('fetch', () => (globalThis.fetch as unknown as (u: string) => unknown)('https://example.invalid/'));
    fire('http.request', () => http.request('http://example.invalid/'));
    fire('http.get', () => http.get('http://example.invalid/'));
    fire('https.request', () => https.request('https://example.invalid/'));
    fire('https.get', () => https.get('https://example.invalid/'));
    fire('net.connect', () => net.connect(80, 'example.invalid'));
    fire('net.Socket#connect', () => new net.Socket().connect(80, 'example.invalid'));
    fire('tls.connect', () => tls.connect(443, 'example.invalid'));
    fire('dns.lookup', () => dns.lookup('example.invalid', () => {}));
    fire('dns.promises.lookup', () => dns.promises.lookup('example.invalid'));

    expect(w.attempts).toHaveLength(10);
    expect(w.attempts.join(' ')).toContain('net.Socket#connect');
  });

  it('THE CLAIM: the whole trigger path runs with the wire armed and trips nothing', () => {
    const db = seed();
    wire = armTripwire();
    const w = wire;

    try {
      // Every exported surface of the trigger's module, in the order the hook
      // uses them. `loadPolicy` reads from disk, `queryStore` reads SQLite,
      // `runTrigger` writes the fire — none of it may touch a socket.
      const policy = loadPolicy();
      expect(deriveQuery(G039_COMMAND)).toBe('"tail" "exit" "code"');
      expect(queryStore({ db, command: G039_COMMAND, floor: -Infinity }).length).toBeGreaterThan(0);

      const outcome = runTrigger({ db, sessionUuid: SESSION, command: G039_COMMAND, policy: { ...policy, relevance_floor: -Infinity } });
      expect(outcome.state).toBe('injected');
      expect(actionOf(outcome.additionalContext ?? '')).not.toBe('');

      // And the paths that do NOT inject, which take different branches.
      runTrigger({ db, sessionUuid: SESSION, command: 'git status --porcelain', policy });
      runTrigger({ db, sessionUuid: SESSION, command: G039_COMMAND, policy: { ...policy, relevance_floor: 1e9 } });

      expect(fireCounts(db, SESSION)).toEqual({ 'not-asked': 1, silent: 1, injected: 1 });
      expect(injectedIds(db, SESSION).length).toBe(1);
    } finally {
      db.close();
    }

    // The assertion the row exists for. Named contents, not just a length, so
    // a failure says which surface was reached.
    expect(w.attempts).toEqual([]);
  });

  it('a planted network call INSIDE the trigger path would turn the row above red', () => {
    // The mutant, written as a test rather than left to a mutation run: this
    // is what candidate 1 was missing. If the trigger ever reaches a socket —
    // directly, transitively, or through a dependency — the shape below is
    // what the claim row would produce.
    const db = seed();
    wire = armTripwire();
    const w = wire;

    const triggerWithANetworkCall = () => {
      deriveQuery(G039_COMMAND);
      try {
        (globalThis.fetch as unknown as (u: string) => unknown)('https://jev.example.invalid/rank');
      } catch {
        /* the tripwire threw; the point is that it RECORDED */
      }
      return queryStore({ db, command: G039_COMMAND, floor: -Infinity });
    };

    triggerWithANetworkCall();
    db.close();

    expect(w.attempts).not.toEqual([]);
    expect(w.attempts[0]).toContain('fetch');
  });
});
