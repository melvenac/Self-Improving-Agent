#!/usr/bin/env node
/**
 * Clean re-migration: v1 knowledge → v2 knowledge_index
 * - Drops old contentless FTS and rebuilds as content-backed with triggers
 * - Adds missing columns (content, project_dir, source, success_rate, archived_into)
 * - Drops all existing v2 knowledge_index entries, resets autoincrement
 * - Re-migrates all active v1 entries using key-based matching
 * - Creates vault files for entries missing from Obsidian Vault v2
 * - FTS auto-populated via INSERT triggers
 */

import { createRequire } from 'module';
import { homedir } from 'os';
import { join } from 'path';
import { existsSync, mkdirSync, writeFileSync } from 'fs';

const require = createRequire(join(homedir(), '.claude', 'knowledge-mcp', 'node_modules', '_placeholder.js'));
const Database = require('better-sqlite3');

const V1_DB_PATH = join(homedir(), '.claude', 'context-mode', 'knowledge.db');
const V2_DB_PATH = join(homedir(), '.claude', 'open-brain', 'knowledge-v2.db');
const VAULT_DIR = join(homedir(), 'Obsidian Vault v2');

function slugify(text) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, ' ')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function deriveProject(projectDir) {
  if (!projectDir) return 'General';
  const parts = projectDir.replace(/\\/g, '/').split('/');
  return parts[parts.length - 1] || 'General';
}

// Open both DBs
const v1 = new Database(V1_DB_PATH, { readonly: true });
const v2 = new Database(V2_DB_PATH);

// ── Schema migration: add missing columns + rebuild FTS ──────────────────────

// Add missing columns (safe if they already exist)
const existingCols = new Set(
  v2.prepare('PRAGMA table_info(knowledge_index)').all().map(c => c.name)
);

const addCol = (name, def) => {
  if (!existingCols.has(name)) {
    v2.exec(`ALTER TABLE knowledge_index ADD COLUMN ${name} ${def}`);
    console.log(`Added column: ${name}`);
  }
};

addCol('content', "TEXT NOT NULL DEFAULT ''");
addCol('source', "TEXT DEFAULT 'manual'");
addCol('project_dir', 'TEXT');
addCol('success_rate', 'REAL DEFAULT NULL');
addCol('archived_into', 'INTEGER DEFAULT NULL');

// Drop old contentless FTS and triggers, rebuild as content-backed
// ── Read v1 entries first ─────────────────────────────────────────────────────

// Deduplicate by key — keep the latest (highest id) entry per key
const v1Entries = v1.prepare(`
  SELECT id, key, content, tags, source, created_at, updated_at, project_dir,
         recall_count, last_recalled, helpful_count, harmful_count, neutral_count,
         success_rate, maturity
  FROM knowledge
  WHERE archived_into IS NULL
    AND id = (SELECT MAX(k2.id) FROM knowledge k2 WHERE k2.key = knowledge.key AND k2.archived_into IS NULL)
  ORDER BY id
`).all();

console.log(`\nV1 active entries: ${v1Entries.length}`);
console.log(`V2 entries before: ${v2.prepare('SELECT COUNT(*) as c FROM knowledge_index').get().c}`);

// ── Drop old FTS + triggers + data (order matters to avoid SQLITE_CORRUPT_VTAB) ─

// 1. Drop triggers first so DELETE doesn't fire on stale FTS
v2.exec(`DROP TRIGGER IF EXISTS ki_ai`);
v2.exec(`DROP TRIGGER IF EXISTS ki_ad`);
v2.exec(`DROP TRIGGER IF EXISTS ki_au`);
// 2. Drop old FTS (contentless or otherwise)
v2.exec(`DROP TABLE IF EXISTS knowledge_fts`);
console.log('Dropped old FTS + triggers');
// 3. Clear knowledge_index with no triggers active
v2.exec(`DELETE FROM knowledge_index`);
v2.exec(`DELETE FROM sqlite_sequence WHERE name = 'knowledge_index'`);
console.log('V2 knowledge_index cleared (autoincrement reset)');

// 4. Rebuild FTS as content-backed with triggers
v2.exec(`
  CREATE VIRTUAL TABLE knowledge_fts USING fts5(
    key, content, tags,
    content=knowledge_index,
    content_rowid=id,
    tokenize='porter unicode61'
  );

  CREATE TRIGGER ki_ai AFTER INSERT ON knowledge_index BEGIN
    INSERT INTO knowledge_fts(rowid, key, content, tags)
    VALUES (new.id, new.key, new.content, new.tags);
  END;

  CREATE TRIGGER ki_ad AFTER DELETE ON knowledge_index BEGIN
    INSERT INTO knowledge_fts(knowledge_fts, rowid, key, content, tags)
    VALUES ('delete', old.id, old.key, old.content, old.tags);
  END;

  CREATE TRIGGER ki_au AFTER UPDATE ON knowledge_index BEGIN
    INSERT INTO knowledge_fts(knowledge_fts, rowid, key, content, tags)
    VALUES ('delete', old.id, old.key, old.content, old.tags);
    INSERT INTO knowledge_fts(rowid, key, content, tags)
    VALUES (new.id, new.key, new.content, new.tags);
  END;
`);
console.log('Rebuilt FTS as content-backed with triggers');
console.log('V2 knowledge_index cleared (autoincrement reset)');

// ── Migrate ──────────────────────────────────────────────────────────────────

// FTS is auto-populated by INSERT trigger — no manual FTS insert needed
const insertKI = v2.prepare(`
  INSERT INTO knowledge_index
    (vault_path, key, content, tags, source, project_dir, maturity,
     helpful, harmful, neutral, success_rate,
     recall_count, last_recalled_at, created_at, updated_at)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`);

let migrated = 0;
let vaultCreated = 0;

const migrateAll = v2.transaction(() => {
  for (const entry of v1Entries) {
    const project = deriveProject(entry.project_dir);
    const slug = slugify(entry.key);
    const vaultPath = join(VAULT_DIR, 'Experiences', project, `${slug}.md`);

    // Create vault file if missing
    if (!existsSync(vaultPath)) {
      const tagsArr = entry.tags ? entry.tags.split(',').map(t => t.trim()).join(', ') : '';
      const frontmatter = [
        '---',
        `key: ${entry.key}`,
        `tags: [${tagsArr}]`,
        `created: ${entry.created_at}`,
        `maturity: ${entry.maturity || 'progenitor'}`,
        `helpful: ${entry.helpful_count || 0}`,
        `harmful: ${entry.harmful_count || 0}`,
        `neutral: ${entry.neutral_count || 0}`,
        `project: ${project}`,
        `source: ${entry.source || 'manual'}`,
        '---',
      ].join('\n');

      mkdirSync(join(VAULT_DIR, 'Experiences', project), { recursive: true });
      writeFileSync(vaultPath, `${frontmatter}\n\n${entry.content}\n`, 'utf-8');
      vaultCreated++;
    }

    // Insert into knowledge_index (FTS auto-populated by trigger)
    insertKI.run(
      vaultPath,
      entry.key,
      entry.content,
      entry.tags || '',
      entry.source || 'manual',
      entry.project_dir || null,
      entry.maturity || 'progenitor',
      entry.helpful_count || 0,
      entry.harmful_count || 0,
      entry.neutral_count || 0,
      entry.success_rate ?? null,
      entry.recall_count || 0,
      entry.last_recalled || null,
      entry.created_at,
      entry.updated_at
    );

    migrated++;
  }
});

migrateAll();

// ── Verify ───────────────────────────────────────────────────────────────────

const v2After = v2.prepare('SELECT COUNT(*) as c FROM knowledge_index').get().c;
const ftsAfter = v2.prepare('SELECT COUNT(*) as c FROM knowledge_fts').get().c;

console.log(`\nMigration complete:`);
console.log(`  Migrated: ${migrated}`);
console.log(`  Vault files created: ${vaultCreated}`);
console.log(`  V2 knowledge_index: ${v2After}`);
console.log(`  V2 FTS entries: ${ftsAfter}`);

// Verify content and project_dir populated
const withContent = v2.prepare("SELECT COUNT(*) as c FROM knowledge_index WHERE content != ''").get().c;
const withProject = v2.prepare("SELECT COUNT(*) as c FROM knowledge_index WHERE project_dir IS NOT NULL").get().c;
console.log(`  With content: ${withContent}`);
console.log(`  With project_dir: ${withProject}`);

// Verify FTS works with snippet
try {
  const testResult = v2.prepare(`
    SELECT ki.id, ki.key, snippet(knowledge_fts, 1, '>>', '<<', '...', 64) as snippet
    FROM knowledge_fts f
    JOIN knowledge_index ki ON ki.id = f.rowid
    WHERE knowledge_fts MATCH 'harness'
    LIMIT 1
  `).get();
  console.log(`\nFTS snippet test: ${testResult ? `id:${testResult.id} "${testResult.key}" → ${testResult.snippet.slice(0,80)}...` : 'no results'}`);
} catch (err) {
  console.log(`FTS snippet test FAILED: ${err.message}`);
}

// Sample entries
const sample = v2.prepare(`SELECT id, key FROM knowledge_index ORDER BY id LIMIT 5`).all();
console.log(`\nSample entries (new v2 IDs):`);
sample.forEach(r => console.log(`  id:${r.id} → ${r.key}`));

v1.close();
v2.close();
