#!/usr/bin/env node
/**
 * backfill-concepts.mjs — Add CONCEPTS line + domain tags to existing knowledge entries
 *
 * Reads all knowledge entries, generates a CONCEPTS line from title/content,
 * expands tags with domain concepts, updates content + tags in SQLite,
 * and re-embeds vectors.
 *
 * Usage: node knowledge-mcp/scripts/backfill-concepts.mjs [--dry-run]
 */

import Database from 'better-sqlite3';
import { join } from 'path';
import { homedir } from 'os';

const DRY_RUN = process.argv.includes('--dry-run');
const KB_PATH = join(homedir(), '.claude', 'context-mode', 'knowledge.db');

// --- Domain tag expansion map ---
// Maps implementation tags → broader domain concept tags
const TAG_EXPANSION = {
  // Payments & billing
  stripe:       ['payments', 'billing'],
  checkout:     ['payments', 'billing'],
  subscription: ['payments', 'billing'],
  webhook:      ['event-handling', 'integration'],

  // Auth & identity
  clerk:        ['authentication', 'identity'],
  oauth:        ['authentication', 'identity'],
  auth:         ['authentication', 'identity'],

  // Frontend
  tailwind:     ['styling', 'frontend'],
  css:          ['styling', 'frontend'],
  shadcn:       ['styling', 'frontend', 'ui-components'],
  nextjs:       ['frontend', 'web-framework'],
  next:         ['frontend', 'web-framework'],
  react:        ['frontend', 'ui-components'],

  // Backend & data
  convex:       ['backend', 'database', 'serverless'],
  sqlite:       ['database', 'storage'],
  fts5:         ['search', 'database'],

  // Infrastructure
  docker:       ['deployment', 'infrastructure', 'containers'],
  coolify:      ['deployment', 'infrastructure', 'hosting'],
  traefik:      ['deployment', 'networking', 'reverse-proxy'],
  aws:          ['deployment', 'cloud', 'infrastructure'],
  cloudflare:   ['deployment', 'networking', 'dns'],
  vps:          ['deployment', 'infrastructure', 'server'],

  // Dev tools
  git:          ['version-control', 'dev-tools'],
  github:       ['version-control', 'ci-cd'],
  typescript:   ['language', 'dev-tools'],

  // Platform
  windows:      ['platform', 'os-specific'],

  // AI & agents
  mcp:          ['ai-tooling', 'model-context-protocol'],
  agents:       ['ai-agents', 'automation'],
  claude:       ['ai-tooling', 'llm'],

  // Media
  replicate:    ['ai-media', 'image-generation'],
  flux:         ['ai-media', 'image-generation'],
  lora:         ['ai-media', 'model-training'],

  // Specific tools
  notebooklm:   ['research', 'knowledge-management'],
  telegram:     ['messaging', 'communication'],
  roundcube:    ['email', 'self-hosted'],
};

// --- CONCEPTS line generator ---
function generateConcepts(key, content, tags) {
  // Extract title from [EXPERIENCE] or [RESEARCH] line
  const titleMatch = content.match(/\[(?:EXPERIENCE|RESEARCH)\]\s*(.+?)(?:\n|$)/);
  const title = titleMatch ? titleMatch[1].trim() : key.replace(/-/g, ' ');

  // Extract PROJECT line
  const projectMatch = content.match(/PROJECT:\s*(.+?)(?:\n|$)/);
  const project = projectMatch ? projectMatch[1].trim() : '';

  // Extract DOMAIN line
  const domainMatch = content.match(/DOMAIN:\s*(.+?)(?:\n|$)/);
  const domain = domainMatch ? domainMatch[1].trim() : '';

  // Extract TRIGGER line for context
  const triggerMatch = content.match(/TRIGGER:\s*(.+?)(?:\n|$)/);
  const trigger = triggerMatch ? triggerMatch[1].trim() : '';

  // Build concept tags from expanded tags
  const expandedTags = new Set();
  for (const tag of tags) {
    const expansions = TAG_EXPANSION[tag.toLowerCase()];
    if (expansions) {
      for (const exp of expansions) expandedTags.add(exp);
    }
  }

  // Construct CONCEPTS sentence
  const parts = [title];
  if (project && project !== 'general') parts.push(`in ${project}`);
  if (expandedTags.size > 0) {
    const conceptList = [...expandedTags].slice(0, 4).join(', ');
    parts.push(`(${conceptList})`);
  }

  return parts.join(' ');
}

// --- Expand tags ---
function expandTags(existingTags) {
  const expanded = new Set(existingTags);
  for (const tag of existingTags) {
    const expansions = TAG_EXPANSION[tag.toLowerCase()];
    if (expansions) {
      for (const exp of expansions) expanded.add(exp);
    }
  }
  return [...expanded];
}

// --- Insert CONCEPTS line into content ---
function insertConceptsLine(content, conceptsLine) {
  // Don't add if already has CONCEPTS
  if (content.includes('CONCEPTS:')) return content;

  // Insert after SOURCE line if present, or after TYPE line, or after DOMAIN line
  for (const marker of ['SOURCE:', 'TYPE:', 'DOMAIN:']) {
    const idx = content.indexOf(marker);
    if (idx !== -1) {
      const lineEnd = content.indexOf('\n', idx);
      if (lineEnd !== -1) {
        return content.slice(0, lineEnd + 1) + `CONCEPTS: ${conceptsLine}\n` + content.slice(lineEnd + 1);
      }
    }
  }

  // For entries without standard format (research, vault-mirror orphans),
  // prepend CONCEPTS line after the first line
  const firstNewline = content.indexOf('\n');
  if (firstNewline !== -1) {
    return content.slice(0, firstNewline + 1) + `CONCEPTS: ${conceptsLine}\n` + content.slice(firstNewline + 1);
  }

  return `CONCEPTS: ${conceptsLine}\n${content}`;
}

// --- Main ---
async function main() {
  console.log(`${DRY_RUN ? '[DRY RUN] ' : ''}Backfill concepts + domain tags`);
  console.log(`DB: ${KB_PATH}\n`);

  const db = new Database(KB_PATH);

  const rows = db.prepare('SELECT id, key, content, tags FROM knowledge ORDER BY id').all();
  console.log(`Found ${rows.length} knowledge entries\n`);

  // Note: vector re-embedding handled separately via session-end.mjs --backfill-vectors

  const updateStmt = DRY_RUN ? null : db.prepare(
    "UPDATE knowledge SET content = ?, tags = ?, updated_at = datetime('now') WHERE id = ?"
  );
  // Vector re-embedding is handled separately via session-end.mjs --backfill-vectors
  // because sqlite-vec extension isn't available in standalone better-sqlite3

  let updated = 0;
  let skipped = 0;

  for (const row of rows) {
    const existingTags = row.tags ? row.tags.split(',').map(t => t.trim()).filter(Boolean) : [];

    // Generate concepts
    const conceptsLine = generateConcepts(row.key || '', row.content, existingTags);

    // Expand tags
    const newTags = expandTags(existingTags);

    // Insert CONCEPTS line
    const newContent = insertConceptsLine(row.content, conceptsLine);

    // Check if anything changed
    const tagsChanged = newTags.length !== existingTags.length;
    const contentChanged = newContent !== row.content;

    if (!contentChanged && !tagsChanged) {
      skipped++;
      continue;
    }

    const newTagsStr = newTags.join(', ');

    if (DRY_RUN) {
      console.log(`[${row.id}] ${row.key}`);
      if (contentChanged) console.log(`  + CONCEPTS: ${conceptsLine}`);
      if (tagsChanged) {
        const added = newTags.filter(t => !existingTags.includes(t));
        console.log(`  + Tags: ${added.join(', ')}`);
      }
      console.log();
      updated++;
      continue;
    }

    // Apply update (triggers handle FTS sync)
    updateStmt?.run(newContent, newTagsStr, row.id);
    updated++;

  }

  db.close();

  console.log(`\nDone!`);
  console.log(`  Updated: ${updated}`);
  console.log(`  Skipped (no changes): ${skipped}`);
  if (!DRY_RUN) console.log(`\n  Run 'node knowledge-mcp/scripts/session-end.mjs --backfill-vectors' to re-embed vectors.`);
}

main().catch(err => { console.error(err); process.exit(1); });
