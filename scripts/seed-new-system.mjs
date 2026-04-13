#!/usr/bin/env node
/**
 * seed-new-system.mjs — One-time migration script
 *
 * Reads the old knowledge DB, scores entries via triageEntries,
 * and writes cherry-picked entries to the new Obsidian vault + new DB.
 *
 * Prerequisites:
 *   - Old DB at ~/.claude/context-mode/knowledge.db
 *   - New vault at ~/Obsidian Vault v2/
 *   - open-brain built: cd open-brain && npm run build
 *
 * Usage:
 *   node scripts/seed-new-system.mjs            # full migration
 *   node scripts/seed-new-system.mjs --dry-run   # triage report only
 */

import { homedir } from 'os';
import { join } from 'path';
import { existsSync, mkdirSync } from 'fs';
import { createRequire } from 'module';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// better-sqlite3 is CJS in open-brain/node_modules — resolve from there
const openBrainRequire = createRequire(join(__dirname, '..', 'open-brain', 'package.json'));
const Database = openBrainRequire('better-sqlite3');

// ─── Imports from open-brain build output ───────────────────────────────────

const { triageEntries } = await import('../open-brain/build/migration/score-entries.js');
const { initSchemaV2 } = await import('../open-brain/build/db-v2.js');
const { writeExperience, writeSummary } = await import('../open-brain/build/vault-writer.js');

// ─── Paths ──────────────────────────────────────────────────────────────────

const OLD_DB_PATH = join(homedir(), '.claude', 'context-mode', 'knowledge.db');
const NEW_DB_PATH = join(homedir(), '.claude', 'open-brain', 'knowledge-v2.db');
const NEW_VAULT = join(homedir(), 'Obsidian Vault v2');

const DRY_RUN = process.argv.includes('--dry-run');

// ─── Helpers ────────────────────────────────────────────────────────────────

function inferProject(entry) {
  const tags = (entry.tags || '').toLowerCase();
  if (tags.includes('self-improving-agent')) return 'Self-Improving-Agent';
  if (tags.includes('tarrant-county-makerspace') || tags.includes('tcm')) return 'Tarrant-County-Makerspace';
  if (tags.includes('trading-bot')) return 'Trading-Bot';
  return 'General';
}

function log(msg) {
  console.log(`[seed] ${msg}`);
}

// ─── 1. Validate prerequisites ─────────────────────────────────────────────

if (!existsSync(OLD_DB_PATH)) {
  console.error(`Old DB not found: ${OLD_DB_PATH}`);
  process.exit(1);
}

if (!existsSync(NEW_VAULT)) {
  console.error(`New vault not found: ${NEW_VAULT}`);
  console.error('Run Task 4 first to create the vault structure.');
  process.exit(1);
}

log(`Old DB: ${OLD_DB_PATH}`);
log(`New vault: ${NEW_VAULT}`);
log(`New DB: ${NEW_DB_PATH}`);
log(`Mode: ${DRY_RUN ? 'DRY RUN' : 'LIVE'}`);
console.log('');

// ─── 2. Read old entries ────────────────────────────────────────────────────

const oldDb = new Database(OLD_DB_PATH, { readonly: true });

// Detect available columns — feedback columns may not exist in older schemas
let hasFeedbackCols = false;
try {
  const cols = oldDb.pragma('table_info(knowledge)').map(c => c.name);
  hasFeedbackCols = cols.includes('helpful_count');
} catch {
  // table_info failed — assume no feedback columns
}

let selectSql;
if (hasFeedbackCols) {
  selectSql = `
    SELECT id, key, content, tags,
           COALESCE(helpful_count, 0)  AS helpful,
           COALESCE(harmful_count, 0)  AS harmful,
           COALESCE(neutral_count, 0)  AS neutral,
           COALESCE(recall_count, 0)   AS recall_count,
           COALESCE(maturity, 'progenitor') AS maturity,
           created_at
    FROM knowledge
  `;
} else {
  selectSql = `
    SELECT id, key, content, tags,
           0 AS helpful,
           0 AS harmful,
           0 AS neutral,
           0 AS recall_count,
           'progenitor' AS maturity,
           created_at
    FROM knowledge
  `;
}

const entries = oldDb.prepare(selectSql).all();
log(`Read ${entries.length} entries from old DB`);

// ─── 3. Score and triage ────────────────────────────────────────────────────

const { migrate, maybe, skip } = triageEntries(entries);

// ─── 4. Print triage report ─────────────────────────────────────────────────

console.log('');
console.log('=== TRIAGE REPORT ===');
console.log(`  MIGRATE (score >= 3): ${migrate.length}`);
for (const e of migrate) {
  console.log(`    [${e.score}] ${e.key}`);
}

console.log(`  MAYBE   (score 1-2): ${maybe.length}`);
for (const e of maybe) {
  console.log(`    [${e.score}] ${e.key}`);
}

console.log(`  SKIP    (score 0):   ${skip.length}`);
for (const e of skip) {
  console.log(`    [${e.score}] ${e.key}`);
}
console.log('');

if (DRY_RUN) {
  log('Dry run complete. No files written.');
  oldDb.close();
  process.exit(0);
}

// ─── 5. Create new DB ──────────────────────────────────────────────────────

const newDbDir = dirname(NEW_DB_PATH);
if (!existsSync(newDbDir)) {
  mkdirSync(newDbDir, { recursive: true });
  log(`Created directory: ${newDbDir}`);
}

const newDb = new Database(NEW_DB_PATH);
newDb.pragma('journal_mode = WAL');
newDb.pragma('foreign_keys = ON');
initSchemaV2(newDb);
log('New DB initialized with v2 schema');

// ─── 6. Write migrate entries to vault + new DB ────────────────────────────

let entriesWritten = 0;
let entriesSkippedDup = 0;

const insertIndex = newDb.prepare(`
  INSERT OR IGNORE INTO knowledge_index
    (vault_path, key, tags, maturity, helpful, harmful, neutral, recall_count, created_at, updated_at)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`);

const insertFts = newDb.prepare(`
  INSERT INTO knowledge_fts (rowid, key, content, tags)
  VALUES (?, ?, ?, ?)
`);

const allToMigrate = [...migrate, ...maybe];
log(`Migrating ${allToMigrate.length} entries (${migrate.length} migrate + ${maybe.length} maybe)`);

const writeTransaction = newDb.transaction(() => {
  for (const entry of allToMigrate) {
    const project = inferProject(entry);
    const tags = entry.tags
      ? entry.tags.split(',').map(t => t.trim()).filter(Boolean)
      : [];

    const vaultPath = writeExperience(NEW_VAULT, {
      key: entry.key,
      tags,
      content: entry.content || '',
      created: entry.created_at || new Date().toISOString(),
      maturity: entry.maturity || 'progenitor',
      helpful: entry.helpful || 0,
      harmful: entry.harmful || 0,
      neutral: entry.neutral || 0,
      project,
      source: 'migration-v1',
    });

    if (vaultPath === null) {
      entriesSkippedDup++;
      continue;
    }

    const info = insertIndex.run(
      vaultPath,
      entry.key,
      entry.tags || '',
      entry.maturity || 'progenitor',
      entry.helpful || 0,
      entry.harmful || 0,
      entry.neutral || 0,
      entry.recall_count || 0,
      entry.created_at || new Date().toISOString(),
      new Date().toISOString()
    );

    if (info.changes > 0) {
      insertFts.run(info.lastInsertRowid, entry.key, entry.content || '', entry.tags || '');
    }

    entriesWritten++;
  }
});

writeTransaction();

log(`Entries written to vault: ${entriesWritten}`);
if (entriesSkippedDup > 0) {
  log(`Entries skipped (already exist): ${entriesSkippedDup}`);
}

// ─── 7. Write summaries ────────────────────────────────────────────────────

let summariesWritten = 0;

// The old DB may have 'content' or 'summary' column — try both
let summaryRows = [];
try {
  summaryRows = oldDb.prepare('SELECT * FROM summaries').all();
} catch {
  log('No summaries table found in old DB — skipping');
}

if (summaryRows.length > 0) {
  const writeSummaryTransaction = newDb.transaction(() => {
    for (const row of summaryRows) {
      const content = row.content || row.summary || '';
      if (!content) continue;

      const result = writeSummary(NEW_VAULT, {
        sessionId: row.session_id || row.uuid || `legacy-${row.id}`,
        project: 'Self-Improving-Agent',
        date: (row.created_at || new Date().toISOString()).slice(0, 10),
        model: row.model || 'unknown',
        content,
      });

      if (result !== null) {
        summariesWritten++;
      }
    }
  });

  writeSummaryTransaction();
}

log(`Summaries written to vault: ${summariesWritten}`);

// ─── 8. Cleanup and summary ────────────────────────────────────────────────

oldDb.close();
newDb.close();

console.log('');
console.log('=== MIGRATION COMPLETE ===');
console.log(`  Entries written:    ${entriesWritten}`);
console.log(`  Entries skipped:    ${entriesSkippedDup} (duplicate)`);
console.log(`  Summaries written:  ${summariesWritten}`);
console.log(`  New DB:             ${NEW_DB_PATH}`);
console.log(`  Vault:              ${NEW_VAULT}`);
console.log('');
console.log('Next steps:');
console.log('  1. Open "Obsidian Vault v2" in Obsidian');
console.log('  2. Install Smart Connections plugin');
console.log('  3. Run initial embedding pass');
console.log('  4. Update ~/.claude/CLAUDE.md to point to new paths');
