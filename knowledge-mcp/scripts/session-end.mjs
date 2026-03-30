#!/usr/bin/env node
/**
 * session-end.mjs — Consolidated SessionEnd hook.
 *
 * Pipeline:
 *   Stage 1: Index — session events → knowledge.db chunks
 *   Stage 2: Skill scan — cluster experiences for skill candidates
 *
 * CLI flags:
 *   --backfill-sessions    Reprocess all .db files
 *   --backfill-summaries   Write existing SQLite summaries to Obsidian
 *   --backfill-vectors     Embed all knowledge + summaries into knowledge_vec
 */

import { existsSync, readdirSync, readFileSync, writeFileSync, appendFileSync, statSync, unlinkSync } from 'fs';
import { join, basename } from 'path';
import { homedir } from 'os';
import Database from 'better-sqlite3';
import * as sqliteVec from 'sqlite-vec';

// ---------------------------------------------------------------------------
// Paths
// ---------------------------------------------------------------------------
const HOME = homedir();
const VAULT_PATH = join(HOME, 'Obsidian Vault');
const EXPERIENCES_DIR = join(VAULT_PATH, 'Experiences');
const LOGS_DIR = join(VAULT_PATH, 'Logs');
const LOG_PATH = join(LOGS_DIR, 'vault-writer.log');

const KB_DIR = join(HOME, '.claude', 'context-mode');
const KB_PATH = join(KB_DIR, 'knowledge.db');
const SESSIONS_DB_DIR = join(KB_DIR, 'sessions');

// Skill-scan paths
const CANDIDATES_FILE = join(VAULT_PATH, 'Guidelines', 'SKILL-CANDIDATES.md');
const SKILL_INDEX_FILE = join(VAULT_PATH, 'Guidelines', 'SKILL-INDEX.md');
const CLUSTER_THRESHOLD = 3;

// ---------------------------------------------------------------------------
// Inlined utilities (from vault-utils.mjs)
// ---------------------------------------------------------------------------

function slugify(text) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 80);
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

function log(message) {
  const timestamp = new Date().toISOString();
  try { appendFileSync(LOG_PATH, `[${timestamp}] [session-end] ${message}\n`); } catch {}
  console.error(`[session-end] ${message}`);
}

function projectFromDir(dir) {
  if (!dir) return 'unknown';
  return slugify(basename(dir));
}

// ---------------------------------------------------------------------------
// Stage 1: Index — session events → knowledge.db chunks
// ---------------------------------------------------------------------------

function categorize(event) {
  switch (event.type) {
    case 'user_prompt': return 'prompt';
    case 'mcp': return 'tool_result';
    case 'file_modify':
    case 'file_create': return 'file_change';
    case 'file_read': return 'file_read';
    case 'error': return 'error';
    case 'bash':
    case 'command': return 'command_output';
    default: return event.category || 'other';
  }
}

function labelSource(event) {
  const data = event.data;
  if (!data) return event.type;
  if (event.type === 'mcp' && data.length < 100) return data;
  if (event.type === 'user_prompt') return data.length > 80 ? data.substring(0, 80) + '...' : data;
  if (['file_modify', 'file_create', 'file_read'].includes(event.type)) return data.length > 120 ? data.substring(0, 120) + '...' : data;
  return event.type;
}

function chunk(content, maxSize = 2000) {
  if (content.length <= maxSize) return [content];
  const chunks = [];
  const lines = content.split('\n');
  let current = '';
  for (const line of lines) {
    if (current.length + line.length + 1 > maxSize && current.length > 0) {
      chunks.push(current);
      current = line;
    } else {
      current += (current ? '\n' : '') + line;
    }
  }
  if (current) chunks.push(current);
  return chunks;
}

function runStage1Index() {
  log('Stage 1: Index — session events → knowledge.db chunks');

  if (!existsSync(SESSIONS_DB_DIR)) {
    log('Stage 1: No sessions directory found — skipping');
    return;
  }
  if (!existsSync(KB_PATH)) {
    log('Stage 1: Knowledge DB not found — skipping');
    return;
  }

  const kb = new Database(KB_PATH);
  const indexed = new Set(
    kb.prepare('SELECT id FROM sessions').all().map(r => r.id)
  );

  const dbFiles = readdirSync(SESSIONS_DB_DIR).filter(f => f.endsWith('.db'));
  let newCount = 0;

  for (const file of dbFiles) {
    const filePath = join(SESSIONS_DB_DIR, file);
    try {
      const sessionDb = new Database(filePath, { readonly: true });

      const hasEvents = sessionDb
        .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='session_events'")
        .get();
      if (!hasEvents) { sessionDb.close(); continue; }

      const meta = sessionDb.prepare('SELECT * FROM session_meta LIMIT 1').get();
      if (!meta || indexed.has(meta.session_id)) { sessionDb.close(); continue; }

      const events = sessionDb.prepare('SELECT * FROM session_events ORDER BY id').all();
      sessionDb.close();

      kb.prepare(
        `INSERT OR IGNORE INTO sessions (id, db_file, project_dir, started_at, ended_at, event_count, indexed_at)
         VALUES (?, ?, ?, ?, ?, ?, datetime('now'))`
      ).run(meta.session_id, filePath, meta.project_dir, meta.started_at, meta.last_event_at, meta.event_count);

      for (const event of events) {
        if (!event.data || event.data.trim().length === 0) continue;
        const category = categorize(event);
        const source = labelSource(event);
        const chunks = chunk(event.data);
        for (const c of chunks) {
          kb.prepare(
            `INSERT INTO chunks (session_id, source, category, content, metadata, created_at, indexed_at)
             VALUES (?, ?, ?, ?, ?, ?, datetime('now'))`
          ).run(
            meta.session_id, source, category, c,
            JSON.stringify({ type: event.type, source_hook: event.source_hook, priority: event.priority, event_id: event.id }),
            event.created_at
          );
        }
      }
      newCount++;
    } catch (err) {
      log(`Stage 1: Error indexing ${file}: ${err.message}`);
    }
  }

  kb.close();
  log(`Stage 1: Complete — ${newCount} new session(s) indexed`);
}

// ---------------------------------------------------------------------------
// Stage 2: Skill scan — cluster experiences for skill candidates
// ---------------------------------------------------------------------------

const NOISE_TAGS = new Set([
  'test', 'marker', 'green-flamingo', 'purple-octopus',
  'session-summary', 'gotcha', 'pattern', 'decision', 'fix', 'optimization'
]);

function parseTags(content) {
  const fmMatch = content.match(/^---\n([\s\S]*?)\n---/);
  if (!fmMatch) return [];
  const tagsMatch = fmMatch[1].match(/tags:\s*\[([^\]]*)\]/);
  if (!tagsMatch) return [];
  return tagsMatch[1].split(',').map(t => t.trim().replace(/['"]/g, '')).filter(Boolean);
}

function parsePreviousCounts(content) {
  const counts = {};
  const dateMatch = content.match(/date:\s*(\S+)/);
  const previousDate = dateMatch ? dateMatch[1] : null;
  const clusterRegex = /###\s+(\S+)\s+\((\d+)\s+experiences?\)/g;
  let match;
  while ((match = clusterRegex.exec(content)) !== null) {
    const tag = match[1];
    const count = parseInt(match[2]);
    if (!counts[tag]) counts[tag] = count;
  }
  return { counts, previousDate };
}

function parseExistingSkills(content) {
  const skills = [];
  const lower = content.toLowerCase();
  const knownTags = ['convex', 'docker', 'deployment', 'python', 'ai-first', 'replicate', 'coolify', 'stripe'];
  for (const tag of knownTags) {
    if (lower.includes(tag)) skills.push(tag);
  }
  return skills;
}

function runStage2SkillScan() {
  log('Stage 2: Skill scan — cluster experiences for skill candidates');

  if (!existsSync(EXPERIENCES_DIR)) {
    log('Stage 2: Experiences directory not found — skipping');
    return;
  }

  const files = readdirSync(EXPERIENCES_DIR).filter(f => f.endsWith('.md'));
  const clusters = {};

  for (const file of files) {
    try {
      const content = readFileSync(join(EXPERIENCES_DIR, file), 'utf8');
      const tags = parseTags(content);
      for (const tag of tags) {
        if (NOISE_TAGS.has(tag)) continue;
        if (!clusters[tag]) clusters[tag] = [];
        clusters[tag].push(file.replace('.md', ''));
      }
    } catch (err) {
      log(`Stage 2: Error reading ${file}: ${err.message}`);
    }
  }

  const significant = Object.entries(clusters)
    .filter(([_, files]) => files.length >= CLUSTER_THRESHOLD)
    .sort((a, b) => b[1].length - a[1].length);

  const approaching = Object.entries(clusters)
    .filter(([_, files]) => files.length === CLUSTER_THRESHOLD - 1)
    .sort((a, b) => a[0].localeCompare(b[0]));

  let previousCounts = {};
  let previousDate = null;
  if (existsSync(CANDIDATES_FILE)) {
    try {
      const prev = readFileSync(CANDIDATES_FILE, 'utf8');
      const parsed = parsePreviousCounts(prev);
      previousCounts = parsed.counts;
      previousDate = parsed.previousDate;
    } catch {}
  }

  let existingSkills = [];
  if (existsSync(SKILL_INDEX_FILE)) {
    try {
      existingSkills = parseExistingSkills(readFileSync(SKILL_INDEX_FILE, 'utf8'));
    } catch {}
  }

  const newClusters = [];
  const growingClusters = [];

  for (const [tag, tagFiles] of significant) {
    const prevCount = previousCounts[tag] || 0;
    if (prevCount === 0) {
      newClusters.push({ tag, count: tagFiles.length, files: tagFiles });
    } else if (tagFiles.length > prevCount) {
      growingClusters.push({ tag, count: tagFiles.length, prevCount, files: tagFiles });
    }
  }

  // Write updated SKILL-CANDIDATES.md
  let md = `---\ndate: ${today()}\ntype: skill-scan\nprevious-scan: ${previousDate || 'none'}\n---\n\n`;
  md += `# Skill Candidates\n\n`;
  md += `> Auto-generated by \`session-end.mjs\` on ${today()}.\n`;
  md += `> Clusters of ${CLUSTER_THRESHOLD}+ experiences suggest a reusable skill could be distilled.\n\n`;
  md += `## By Tag\n\n`;

  for (const [tag, tagFiles] of significant) {
    const hasSkill = existingSkills.includes(tag);
    const isNew = !previousCounts[tag];
    const isGrowing = previousCounts[tag] && tagFiles.length > previousCounts[tag];
    const status = [];
    if (hasSkill) status.push('has skill');
    if (isNew) status.push('NEW');
    if (isGrowing) status.push('growing');

    md += `### ${tag} (${tagFiles.length} experiences)${status.length ? ' — ' + status.join(', ') : ''}\n\n`;
    if (hasSkill) {
      md += `**Status:** Skill exists — consider updating if new experiences add novel patterns\n\n`;
    } else {
      md += `**Potential skill:** "${tag}" patterns and gotchas\n\n`;
    }
    for (const f of tagFiles) {
      md += `- [[${f}]]\n`;
    }
    md += '\n';
  }

  if (approaching.length > 0) {
    md += `## Approaching Threshold (${CLUSTER_THRESHOLD - 1} experiences)\n\n`;
    for (const [tag, tagFiles] of approaching) {
      if (NOISE_TAGS.has(tag)) continue;
      md += `- **${tag}** (${tagFiles.length}) — one more experience triggers proposal\n`;
    }
    md += '\n';
  }

  if (previousDate) {
    md += `## Scan Diff (vs ${previousDate})\n\n`;
    md += `| Cluster | Previous | Current | Change |\n|---|---|---|---|\n`;
    const allTags = new Set([...Object.keys(previousCounts), ...significant.map(([t]) => t)]);
    for (const tag of [...allTags].sort()) {
      const prev = previousCounts[tag] || 0;
      const curr = clusters[tag]?.length || 0;
      if (curr < CLUSTER_THRESHOLD && prev < CLUSTER_THRESHOLD) continue;
      const change = prev === 0 ? 'NEW' : curr === prev ? 'unchanged' : `+${curr - prev}`;
      md += `| ${tag} | ${prev || '—'} | ${curr} | ${change} |\n`;
    }
    md += '\n';
  }

  md += `---\n\n*Last scan: ${today()}. Runs automatically at session end via session-end.mjs hook.*\n`;

  writeFileSync(CANDIDATES_FILE, md);

  // Write marker for new proposals
  if (newClusters.length > 0) {
    const markerPath = join(VAULT_PATH, '.skill-proposals-pending.json');
    const proposals = newClusters.map(c => ({ tag: c.tag, count: c.count, files: c.files, date: today() }));
    writeFileSync(markerPath, JSON.stringify(proposals, null, 2));
    log(`Stage 2: Wrote ${newClusters.length} pending proposal(s)`);
  }

  log(`Stage 2: Complete — ${significant.length} clusters, ${newClusters.length} new, ${growingClusters.length} growing (scanned ${files.length} experiences)`);
}

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

function findMostRecentDb() {
  if (!existsSync(SESSIONS_DB_DIR)) return null;
  const files = readdirSync(SESSIONS_DB_DIR).filter(f => f.endsWith('.db'));
  if (files.length === 0) return null;

  let newest = null;
  let newestMtime = 0;
  for (const file of files) {
    const fullPath = join(SESSIONS_DB_DIR, file);
    const stat = statSync(fullPath);
    if (stat.mtimeMs > newestMtime) {
      newestMtime = stat.mtimeMs;
      newest = fullPath;
    }
  }
  return newest;
}

// ---------------------------------------------------------------------------
// CLI: --backfill-sessions
// ---------------------------------------------------------------------------

function backfillSessions() {
  log('Backfill: reprocessing all .db files');

  if (!existsSync(SESSIONS_DB_DIR)) {
    log('Backfill: No sessions directory found');
    return;
  }
  if (!existsSync(KB_PATH)) {
    log('Backfill: Knowledge DB not found');
    return;
  }

  const kb = new Database(KB_PATH);
  const indexed = new Set(
    kb.prepare('SELECT id FROM sessions').all().map(r => r.id)
  );

  const dbFiles = readdirSync(SESSIONS_DB_DIR).filter(f => f.endsWith('.db'));
  let processed = 0;
  let skipped = 0;

  for (const file of dbFiles) {
    const filePath = join(SESSIONS_DB_DIR, file);
    try {
      const sessionDb = new Database(filePath, { readonly: true });
      const hasEvents = sessionDb
        .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='session_events'")
        .get();
      if (!hasEvents) { sessionDb.close(); skipped++; continue; }

      const meta = sessionDb.prepare('SELECT * FROM session_meta LIMIT 1').get();
      if (!meta) { sessionDb.close(); skipped++; continue; }
      if (indexed.has(meta.session_id)) { sessionDb.close(); skipped++; continue; }

      const events = sessionDb.prepare('SELECT * FROM session_events ORDER BY id').all();
      sessionDb.close();

      kb.prepare(
        `INSERT OR IGNORE INTO sessions (id, db_file, project_dir, started_at, ended_at, event_count, indexed_at)
         VALUES (?, ?, ?, ?, ?, ?, datetime('now'))`
      ).run(meta.session_id, filePath, meta.project_dir, meta.started_at, meta.last_event_at, meta.event_count);

      for (const event of events) {
        if (!event.data || event.data.trim().length === 0) continue;
        const category = categorize(event);
        const source = labelSource(event);
        const chunks = chunk(event.data);
        for (const c of chunks) {
          kb.prepare(
            `INSERT INTO chunks (session_id, source, category, content, metadata, created_at, indexed_at)
             VALUES (?, ?, ?, ?, ?, ?, datetime('now'))`
          ).run(
            meta.session_id, source, category, c,
            JSON.stringify({ type: event.type, source_hook: event.source_hook, priority: event.priority, event_id: event.id }),
            event.created_at
          );
        }
      }
      processed++;
    } catch (err) {
      log(`Backfill: Error on ${file}: ${err.message}`);
    }
  }

  kb.close();
  log(`Backfill sessions: ${processed} processed, ${skipped} skipped`);
}

// ---------------------------------------------------------------------------
// CLI: --backfill-summaries — write existing SQLite summaries to Obsidian
// ---------------------------------------------------------------------------

async function backfillSummaries() {
  log('Backfill summaries: reading from knowledge.db, writing to Obsidian');

  if (!existsSync(KB_PATH)) {
    log('Backfill summaries: Knowledge DB not found');
    return;
  }

  // Dynamic import of the repo-level vault-utils for writeSummaryToObsidian
  let writeSummaryToObsidian;
  try {
    const vaultUtils = await import('../../scripts/vault-utils.mjs');
    writeSummaryToObsidian = vaultUtils.writeSummaryToObsidian;
  } catch (err) {
    log(`Backfill summaries: Could not import vault-utils: ${err.message}`);
    return;
  }

  const db = new Database(KB_PATH, { readonly: true });
  let rows;
  try {
    rows = db.prepare('SELECT * FROM summaries ORDER BY created_at').all();
  } catch (err) {
    log(`Backfill summaries: No summaries table or query failed: ${err.message}`);
    db.close();
    return;
  }
  db.close();

  if (!rows || rows.length === 0) {
    log('Backfill summaries: No summaries found');
    return;
  }

  let written = 0;
  for (const row of rows) {
    try {
      const tags = row.tags ? row.tags.split(',').map(t => t.trim()) : [];
      const files = row.files_touched ? row.files_touched.split(',').map(f => f.trim()) : [];
      writeSummaryToObsidian({
        sessionId: row.session_id,
        sessionNumber: row.id,
        projectSlug: projectFromDir(row.project_dir),
        date: row.created_at ? row.created_at.split('T')[0] : today(),
        tags,
        files,
        summary: row.summary || row.content || '',
      });
      written++;
    } catch (err) {
      log(`Backfill summaries: Error on ${row.session_id}: ${err.message}`);
    }
  }

  log(`Backfill summaries: ${written}/${rows.length} written to Obsidian`);
}

// ---------------------------------------------------------------------------
// CLI: --backfill-vectors — embed all knowledge + summaries into knowledge_vec
// ---------------------------------------------------------------------------

async function backfillVectors() {
  log('Backfill vectors: embedding all knowledge + summaries');

  if (!existsSync(KB_PATH)) {
    log('Backfill vectors: Knowledge DB not found');
    return;
  }

  // Dynamic import of the MCP server build for embedding functions
  let initEmbeddings, embedText, vecToBuffer;
  try {
    const embedModule = await import('../build/embed.js');
    initEmbeddings = embedModule.initEmbeddings;
    embedText = embedModule.embedText;
    vecToBuffer = embedModule.vecToBuffer;
  } catch (err) {
    log(`Backfill vectors: Could not import embed module: ${err.message}`);
    log('Backfill vectors: Ensure knowledge-mcp is built (npm run build)');
    return;
  }

  const ready = await initEmbeddings();
  if (!ready) {
    log('Backfill vectors: Embeddings not available (model may not be installed)');
    return;
  }

  const db = new Database(KB_PATH);
  try {
    sqliteVec.load(db);
  } catch (err) {
    log(`Backfill vectors: sqlite-vec load failed: ${err.message}`);
    db.close();
    return;
  }

  // Embed knowledge entries
  let knowledgeRows;
  try {
    knowledgeRows = db.prepare('SELECT id, content FROM knowledge').all();
  } catch {
    knowledgeRows = [];
  }

  let kEmbedded = 0;
  for (const row of knowledgeRows) {
    try {
      if (!process.argv.includes('--force')) {
        const existing = db.prepare('SELECT rowid FROM knowledge_vec WHERE rowid = ?').get(BigInt(row.id));
        if (existing) continue;
      }

      const vec = await embedText(row.content);
      if (vec) {
        const rid = BigInt(row.id);
        db.prepare('DELETE FROM knowledge_vec WHERE rowid = ?').run(rid);
        db.prepare('INSERT INTO knowledge_vec (rowid, embedding) VALUES (?, ?)').run(rid, vecToBuffer(vec));
        kEmbedded++;
      }
    } catch (err) {
      log(`Backfill vectors: Error embedding knowledge ${row.id}: ${err.message}`);
    }
  }

  // Embed summaries (negative rowids per convention in db.ts)
  let summaryRows;
  try {
    summaryRows = db.prepare('SELECT id, summary FROM summaries').all();
  } catch {
    summaryRows = [];
  }

  let sEmbedded = 0;
  for (const row of summaryRows) {
    try {
      const negId = BigInt(-row.id);
      if (!process.argv.includes('--force')) {
        const existing = db.prepare('SELECT rowid FROM knowledge_vec WHERE rowid = ?').get(negId);
        if (existing) continue;
      }

      const text = row.summary || row.content || '';
      if (!text) continue;
      const vec = await embedText(text);
      if (vec) {
        db.prepare('DELETE FROM knowledge_vec WHERE rowid = ?').run(negId);
        db.prepare('INSERT INTO knowledge_vec (rowid, embedding) VALUES (?, ?)').run(negId, vecToBuffer(vec));
        sEmbedded++;
      }
    } catch (err) {
      log(`Backfill vectors: Error embedding summary ${row.id}: ${err.message}`);
    }
  }

  db.close();
  log(`Backfill vectors: ${kEmbedded} knowledge + ${sEmbedded} summaries embedded`);
}

// ---------------------------------------------------------------------------
// Auto-feedback: rate recalled entries based on summary domain overlap
// ---------------------------------------------------------------------------

async function autoFeedback() {
  const recalledPath = join(HOME, '.claude', 'context-mode', '.recalled-entries.json');
  if (!existsSync(recalledPath)) {
    log('Auto-feedback: no .recalled-entries.json — skipping');
    return;
  }

  let recalled;
  try {
    recalled = JSON.parse(readFileSync(recalledPath, 'utf8'));
  } catch (err) {
    log(`Auto-feedback: failed to parse recalled entries: ${err.message}`);
    return;
  }

  if (!recalled.entries || recalled.entries.length === 0) {
    log('Auto-feedback: no recalled entries to rate');
    return;
  }

  // Find the most recent session summary
  const db = new Database(KB_PATH, { readonly: true });
  let summary;
  try {
    summary = db.prepare(
      'SELECT sm.summary FROM summaries sm ORDER BY sm.created_at DESC LIMIT 1'
    ).get();
  } catch {
    log('Auto-feedback: no summaries found');
    db.close();
    return;
  }
  db.close();

  if (!summary || !summary.summary) {
    log('Auto-feedback: latest summary is empty');
    return;
  }

  const summaryLower = summary.summary.toLowerCase();

  // Rate each recalled knowledge entry
  const dbWrite = new Database(KB_PATH);
  let rated = 0;

  for (const entry of recalled.entries) {
    if (entry.source !== 'knowledge' || !entry.id) continue;

    // Get the entry's tags and current feedback counts
    const row = dbWrite.prepare(
      'SELECT tags, helpful_count, harmful_count, neutral_count FROM knowledge WHERE id = ?'
    ).get(entry.id);

    if (!row) continue;

    const tags = row.tags ? row.tags.split(',').map(t => t.trim().toLowerCase()) : [];

    // Check if any tag (longer than 2 chars) appears in the summary
    const overlap = tags.some(tag => tag.length > 2 && summaryLower.includes(tag));
    const rating = overlap ? 'helpful' : 'neutral';

    // Calculate new success rate and maturity
    const helpful = (row.helpful_count || 0) + (rating === 'helpful' ? 1 : 0);
    const harmful = row.harmful_count || 0;
    const neutral = (row.neutral_count || 0) + (rating === 'neutral' ? 1 : 0);
    const total = helpful + harmful + neutral;
    const successRate = total > 0 ? helpful / total : null;

    // Maturity progression: Progenitor → Proven (3 helpful, ≥0.5 rate) → Mature (7 helpful)
    let maturity = 'progenitor';
    if (helpful >= 7) maturity = 'mature';
    else if (helpful >= 3 && successRate >= 0.5) maturity = 'proven';

    // Update the knowledge entry
    const col = rating === 'helpful' ? 'helpful_count' : 'neutral_count';
    dbWrite.prepare(
      `UPDATE knowledge SET ${col} = ${col} + 1, success_rate = ?, maturity = ?, updated_at = datetime('now') WHERE id = ?`
    ).run(successRate, maturity, entry.id);

    log(`Auto-feedback: ${entry.key || entry.id} → ${rating} (${maturity}, rate=${successRate?.toFixed(2)})`);
    rated++;
  }

  dbWrite.close();

  // Clean up the recalled entries file
  try { unlinkSync(recalledPath); } catch {}

  log(`Auto-feedback: rated ${rated} entries`);
}

// ---------------------------------------------------------------------------
// Main entry point
// ---------------------------------------------------------------------------

import { fileURLToPath } from 'url';
const __filename = fileURLToPath(import.meta.url);
const isDirectRun = process.argv[1] && __filename.replace(/\\/g, '/').toLowerCase() === process.argv[1].replace(/\\/g, '/').toLowerCase();

if (isDirectRun) {
  const args = process.argv.slice(2);

  if (args.includes('--backfill-sessions')) {
    try {
      backfillSessions();
    } catch (err) {
      log(`FATAL (backfill-sessions): ${err.message}\n${err.stack}`);
    }
  } else if (args.includes('--backfill-summaries')) {
    try {
      await backfillSummaries();
    } catch (err) {
      log(`FATAL (backfill-summaries): ${err.message}\n${err.stack}`);
    }
  } else if (args.includes('--backfill-vectors')) {
    try {
      await backfillVectors();
    } catch (err) {
      log(`FATAL (backfill-vectors): ${err.message}\n${err.stack}`);
    }
  } else {
    // Normal pipeline: Stage 1 → Stage 2
    try {
      runStage1Index();
    } catch (err) {
      log(`Stage 1 FAILED: ${err.message}\n${err.stack}`);
    }

    try {
      runStage2SkillScan();
    } catch (err) {
      log(`Stage 2 FAILED: ${err.message}\n${err.stack}`);
    }

    try {
      await autoFeedback();
    } catch (err) {
      log(`Auto-feedback FAILED: ${err.message}\n${err.stack}`);
    }

    log('Pipeline complete');
  }
}

// Export for potential programmatic use
export { runStage1Index, runStage2SkillScan };
