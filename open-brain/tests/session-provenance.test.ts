import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Database from 'better-sqlite3';
import {
  initSchemaV2,
  recordSession,
  getSessionByUuid,
  recordChunk,
  getChunksForSession,
} from '../src/db-v2.js';

/**
 * The sessions and chunks tables existed in the v2 schema from the start but
 * nothing wrote to them, leaving no way to answer "what did session X produce?"
 * after the fact.
 */
describe('session provenance', () => {
  let db: Database.Database;

  beforeEach(() => {
    db = new Database(':memory:');
    initSchemaV2(db);
  });

  afterEach(() => db.close());

  const UUID = '11111111-2222-3333-4444-555555555555';

  it('records a session and reads it back by uuid', () => {
    const id = recordSession(db, UUID, 'c:/projects/demo');
    const row = getSessionByUuid(db, UUID);

    expect(id).toBeGreaterThan(0);
    expect(row?.uuid).toBe(UUID);
    expect(row?.project_dir).toBe('c:/projects/demo');
    expect(row?.started_at).toBeTruthy();
  });

  it('is idempotent — re-registering the same uuid does not duplicate', () => {
    const first = recordSession(db, UUID, 'c:/projects/demo');
    const second = recordSession(db, UUID, 'c:/projects/demo');

    expect(second).toBe(first);
    expect(db.prepare('SELECT COUNT(*) n FROM sessions').get()).toEqual({ n: 1 });
  });

  it('accepts a session whose project_dir is not yet known', () => {
    // project_dir is NOT NULL in the schema, but callers may register the uuid
    // before the cwd is resolved.
    recordSession(db, UUID, null);
    expect(getSessionByUuid(db, UUID)?.project_dir).toBe('unknown');
  });

  it('fills in a real project_dir on a later registration', () => {
    recordSession(db, UUID, null);
    recordSession(db, UUID, 'c:/projects/demo');

    expect(getSessionByUuid(db, UUID)?.project_dir).toBe('c:/projects/demo');
  });

  it('does not downgrade a known project_dir back to unknown', () => {
    recordSession(db, UUID, 'c:/projects/demo');
    recordSession(db, UUID, null);

    expect(getSessionByUuid(db, UUID)?.project_dir).toBe('c:/projects/demo');
  });

  it('links chunks to the producing session', () => {
    const sessionRowId = recordSession(db, UUID, 'c:/projects/demo');
    recordChunk(db, sessionRowId, 'checkpoint', '/vault/Checkpoints/a.md', { key: 'a' });
    recordChunk(db, sessionRowId, 'spec', '/vault/Specs/b.md', { key: 'b' });

    const chunks = getChunksForSession(db, UUID);
    expect(chunks).toHaveLength(2);
    expect(chunks.map((c) => c.category)).toEqual(['checkpoint', 'spec']);
    expect(chunks[0].content).toBe('/vault/Checkpoints/a.md');
    expect(JSON.parse(chunks[0].metadata).key).toBe('a');
  });

  it('counts events on the session as chunks are added', () => {
    const sessionRowId = recordSession(db, UUID, 'c:/projects/demo');
    recordChunk(db, sessionRowId, 'checkpoint', '/vault/a.md');
    recordChunk(db, sessionRowId, 'checkpoint', '/vault/b.md');

    expect(getSessionByUuid(db, UUID)?.event_count).toBe(2);
  });

  it('returns no chunks for an unknown session', () => {
    expect(getChunksForSession(db, 'no-such-uuid')).toEqual([]);
  });

  it('keeps chunks from different sessions separate', () => {
    const a = recordSession(db, UUID, 'c:/a');
    const b = recordSession(db, 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee', 'c:/b');
    recordChunk(db, a, 'checkpoint', '/vault/a.md');
    recordChunk(db, b, 'checkpoint', '/vault/b1.md');
    recordChunk(db, b, 'checkpoint', '/vault/b2.md');

    expect(getChunksForSession(db, UUID)).toHaveLength(1);
    expect(getChunksForSession(db, 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee')).toHaveLength(2);
  });
});
