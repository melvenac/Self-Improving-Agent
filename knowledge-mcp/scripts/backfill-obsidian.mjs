#!/usr/bin/env node
/**
 * backfill-obsidian.mjs — Write all knowledge DB entries as markdown files to Obsidian
 *
 * Reads all entries from the knowledge table and writes each as a .md file
 * with YAML frontmatter into Experiences/ or Research/ based on content type.
 *
 * Usage: node knowledge-mcp/scripts/backfill-obsidian.mjs [--dry-run]
 *
 * Run from: C:\Users\melve\Projects\Self-Improving-Agent\knowledge-mcp\
 */

import Database from 'better-sqlite3';
import { join } from 'path';
import { homedir } from 'os';
import { writeFileSync, mkdirSync, existsSync } from 'fs';

const DRY_RUN = process.argv.includes('--dry-run');

const KB_PATH = join(homedir(), '.claude', 'context-mode', 'knowledge.db');
const VAULT_PATH = join(homedir(), 'Obsidian Vault');
const EXPERIENCES_DIR = join(VAULT_PATH, 'Experiences');
const RESEARCH_DIR = join(VAULT_PATH, 'Research');

// --- Helpers ---

function extractLine(content, label) {
  const match = content.match(new RegExp(`${label}:\\s*(.+?)(?:\\n|$)`));
  return match ? match[1].trim() : null;
}

function formatDate(dateStr) {
  if (!dateStr) return null;
  // Handle ISO strings like "2025-01-15T10:30:00Z" or "2025-01-15"
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return null;
  return d.toISOString().slice(0, 10);
}

function safeName(key, id) {
  if (key && key.trim()) {
    // Sanitize key for use as filename
    return key.replace(/[\\/:*?"<>|]/g, '-').trim();
  }
  return `entry-${id}`;
}

function buildFrontmatter(fields) {
  const lines = ['---'];
  if (fields.date)     lines.push(`date: ${fields.date}`);
  if (fields.project)  lines.push(`project: "${fields.project}"`);
  if (fields.type)     lines.push(`type: ${fields.type}`);
  if (fields.domain?.length)  lines.push(`domain: [${fields.domain.map(d => `"${d}"`).join(', ')}]`);
  if (fields.tags?.length)    lines.push(`tags: [${fields.tags.map(t => `"${t}"`).join(', ')}]`);
  if (fields.maturity) lines.push(`maturity: ${fields.maturity}`);
  lines.push('---');
  return lines.join('\n');
}

// --- Main ---

async function main() {
  console.log(`${DRY_RUN ? '[DRY RUN] ' : ''}Backfill Obsidian from knowledge DB`);
  console.log(`DB:           ${KB_PATH}`);
  console.log(`Experiences:  ${EXPERIENCES_DIR}`);
  console.log(`Research:     ${RESEARCH_DIR}\n`);

  // Ensure target dirs exist
  if (!DRY_RUN) {
    mkdirSync(EXPERIENCES_DIR, { recursive: true });
    mkdirSync(RESEARCH_DIR, { recursive: true });
  }

  const db = new Database(KB_PATH);
  const rows = db.prepare(
    'SELECT id, key, content, tags, source, project_dir, created_at, maturity, success_rate FROM knowledge ORDER BY id'
  ).all();
  db.close();

  console.log(`Found ${rows.length} knowledge entries\n`);

  let writtenExperiences = 0;
  let writtenResearch = 0;
  let skipped = 0;

  for (const row of rows) {
    const content = row.content || '';

    // --- Determine destination ---
    // Research: starts with [RESEARCH] anywhere in first line, or starts with "# "
    const firstLine = content.split('\n')[0] || '';
    const isResearch = firstLine.includes('[RESEARCH]') || firstLine.startsWith('# ');
    const destDir = isResearch ? RESEARCH_DIR : EXPERIENCES_DIR;

    // --- Extract metadata from content ---
    const typeFromContent = extractLine(content, 'TYPE');
    const type = typeFromContent || 'experience';

    const projectFromContent = extractLine(content, 'PROJECT');
    const project = projectFromContent || (row.project_dir ? row.project_dir.split(/[\\/]/).pop() : null) || 'general';

    const dateFromContent = extractLine(content, 'DATE');
    const date = formatDate(dateFromContent) || formatDate(row.created_at) || new Date().toISOString().slice(0, 10);

    const domainFromContent = extractLine(content, 'DOMAIN');
    const domainTags = domainFromContent
      ? domainFromContent.split(',').map(d => d.trim()).filter(Boolean)
      : [];

    // All tags from DB (comma-separated)
    const allTags = row.tags
      ? row.tags.split(',').map(t => t.trim()).filter(Boolean)
      : [];

    // --- Build filename ---
    const filename = safeName(row.key, row.id) + '.md';
    const destPath = join(destDir, filename);

    // --- Build markdown ---
    const frontmatter = buildFrontmatter({
      date,
      project,
      type,
      domain: domainTags,
      tags: allTags,
      maturity: row.maturity || 'Progenitor',
    });

    const markdown = `${frontmatter}\n\n${content}\n`;

    if (DRY_RUN) {
      const dest = isResearch ? 'Research/' : 'Experiences/';
      console.log(`[${row.id}] ${dest}${filename}`);
      console.log(`  type=${type}  project=${project}  date=${date}  domain=[${domainTags.join(', ')}]`);
    } else {
      writeFileSync(destPath, markdown, 'utf8');
    }

    if (isResearch) writtenResearch++;
    else writtenExperiences++;
  }

  console.log(`\nDone!`);
  console.log(`  Experiences/ : ${writtenExperiences}`);
  console.log(`  Research/    : ${writtenResearch}`);
  console.log(`  Skipped      : ${skipped}`);
  if (DRY_RUN) console.log('\n  (Dry run — no files written)');
}

main().catch(err => { console.error(err); process.exit(1); });
