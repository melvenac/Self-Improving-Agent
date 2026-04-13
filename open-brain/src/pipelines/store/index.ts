import Database from 'better-sqlite3';
import { writeExperience, writeFailure } from '../../vault-writer.js';
import { indexKnowledge } from '../../db-v2.js';

// ─── Interfaces ──────────────────────────────────────────────────────────────

export interface StoreInput {
  db: Database.Database;
  vaultDir: string;
  key: string;
  tags: string[];
  content: string;
  project: string;
}

export interface StoreFailureInput {
  db: Database.Database;
  vaultDir: string;
  key: string;
  tags: string[];
  attempted: string;
  whyFailed: string;
  whatWorked: string;
  project: string;
}

export interface StoreResult {
  vaultPath: string | null;
}

// ─── store ───────────────────────────────────────────────────────────────────

/**
 * Vault-first storage: write .md to vault, then index metadata in SQLite.
 * Returns null vaultPath if entry already exists (dedup).
 */
export function store(input: StoreInput): StoreResult {
  const { db, vaultDir, key, tags, content, project } = input;

  const vaultPath = writeExperience(vaultDir, {
    key,
    tags,
    content,
    created: new Date().toISOString(),
    maturity: 'progenitor',
    helpful: 0,
    harmful: 0,
    neutral: 0,
    project,
    source: 'kb_store',
  });

  if (vaultPath === null) {
    return { vaultPath: null };
  }

  indexKnowledge(db, {
    vaultPath,
    key,
    tags: tags.join(','),
    content,
  });

  return { vaultPath };
}

// ─── storeFailure ─────────────────────────────────────────────────────────────

/**
 * Writes a failure .md to vault, then indexes metadata in SQLite.
 * Returns null vaultPath if entry already exists (dedup).
 */
export function storeFailure(input: StoreFailureInput): StoreResult {
  const { db, vaultDir, key, tags, attempted, whyFailed, whatWorked, project } = input;

  const vaultPath = writeFailure(vaultDir, {
    key,
    tags,
    attempted,
    why_failed: whyFailed,
    what_worked: whatWorked,
    created: new Date().toISOString(),
    project,
  });

  if (vaultPath === null) {
    return { vaultPath: null };
  }

  const content = `## Attempted\n${attempted}\n\n## Why Failed\n${whyFailed}\n\n## What Worked\n${whatWorked}`;

  indexKnowledge(db, {
    vaultPath,
    key: `failure-${key}`,
    tags: ['failure', ...tags].join(','),
    content,
  });

  return { vaultPath };
}
