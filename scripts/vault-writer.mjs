/**
 * vault-writer.mjs — SessionEnd hook
 * Auto-captures Claude Code sessions into the Obsidian vault.
 *
 * Stage 1: Session Log — extract events from most recent .db, write to Sessions/
 * Stage 2: Experience Extraction — scan for decisions/gotchas, write to Experiences/
 * Stage 3: Topic Linking — update Topics/ See Also sections with backlinks
 */

import { existsSync, readdirSync, statSync, writeFileSync, readFileSync, appendFileSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import { execSync } from 'child_process';
import Database from 'better-sqlite3';
import {
  SESSIONS_DIR, EXPERIENCES_DIR, LOGS_DIR,
  slugify, today, log, writeIfNew, projectFromDir,
  getExistingTopics, findTopicMentions, linkToTopic, wikiLinks
} from './vault-utils.mjs';
import { syncProjects } from './vault-sync-projects.mjs';

const KNOWLEDGE_DB_PATH = join(homedir(), '.claude', 'context-mode', 'knowledge.db');

const SESSIONS_DB_DIR = join(homedir(), '.claude', 'context-mode', 'sessions');

// Minimum quality thresholds for auto-extracted experiences
const MIN_DECISION_LENGTH = 40;  // decisions shorter than this are too vague
const MIN_GOTCHA_LENGTH = 40;
const MAX_EXPERIENCES_PER_SESSION = 3;  // cap to avoid noise
const DEDUP_SIMILARITY_THRESHOLD = 0.80;  // skip if existing experience is this similar
const VAULT_PATH_FOR_CLI = join(homedir(), 'Obsidian Vault');

// --- CLI entry point ---
if (process.argv.includes('--backfill')) {
  try {
    backfillMirror();
  } catch (err) {
    log(`FATAL (backfill): ${err.message}\n${err.stack}`);
    logErrorToVault(err);
  }
} else {
  try {
    main();
  } catch (err) {
    log(`FATAL: ${err.message}\n${err.stack}`);
    logErrorToVault(err);
  }
}

/**
 * Backfill mode: mirror ALL existing experience files to Open Brain.
 */
function backfillMirror() {
  if (!existsSync(EXPERIENCES_DIR)) {
    log('BACKFILL: No Experiences directory found');
    return;
  }
  const files = readdirSync(EXPERIENCES_DIR)
    .filter(f => f.endsWith('.md'))
    .map(f => join(EXPERIENCES_DIR, f));

  log(`BACKFILL: Found ${files.length} experience files to mirror`);
  mirrorToOpenBrain(files);
  log('BACKFILL: Complete');
}

/**
 * Write error to a visible Obsidian note in Logs/ so it shows in the graph.
 */
function logErrorToVault(err) {
  try {
    const errorFile = join(LOGS_DIR, 'vault-writer-errors.md');
    const timestamp = new Date().toISOString();
    const entry = `\n### ${timestamp}\n\`\`\`\n${err.message}\n${err.stack?.slice(0, 500) || ''}\n\`\`\`\n`;

    if (existsSync(errorFile)) {
      appendFileSync(errorFile, entry);
    } else {
      const header = `---\ntype: error-log\n---\n\n# Vault Writer Errors\n\nAuto-captured errors from \`vault-writer.mjs\`. If this file appears in your graph, check what went wrong.\n`;
      writeFileSync(errorFile, header + entry);
    }
  } catch { /* don't throw from error handler */ }
}

function main() {
  // --- Stage 1: Find most recent .db and extract session log ---
  const dbPath = findMostRecentDb();
  if (!dbPath) {
    log('No session .db files found — skipping vault write');
    return;
  }

  log(`Processing: ${dbPath}`);
  const db = new Database(dbPath, { readonly: true });

  const meta = db.prepare('SELECT * FROM session_meta ORDER BY last_event_at DESC LIMIT 1').get();
  if (!meta) {
    log('No session_meta rows — skipping');
    db.close();
    return;
  }

  const allEvents = db.prepare(
    'SELECT type, category, data FROM session_events ORDER BY id'
  ).all();

  const dbFilename = dbPath.split(/[\\/]/).pop();
  db.close();

  const project = projectFromDir(meta.project_dir);
  const dateStr = today();

  // Extract meaningful content from events (raw text, not JSON)
  const whatWasDone = [];
  const decisions = [];
  const gotchas = [];
  const filesChanged = [];
  let allText = '';

  for (const event of allEvents) {
    const text = event.data || '';

    // User prompts — raw text
    if (event.type === 'user_prompt') {
      allText += ' ' + text;
      if (text.length > 10) {
        whatWasDone.push('- ' + text.trim().split('\n')[0].slice(0, 200));
      }
    }

    // Decisions — raw text from the agent
    if (event.category === 'decision') {
      allText += ' ' + text;
      if (text.length > 10) {
        decisions.push(text.trim().split('\n')[0].slice(0, 200));
      }
    }

    // File operations — data is the file path
    if (event.category === 'file' && (event.type === 'file_edit' || event.type === 'file_write')) {
      filesChanged.push(text.trim());
    }

    // Subagent completions
    if (event.type === 'subagent_completed') {
      allText += ' ' + text.slice(0, 500);
    }

    // Gotcha detection
    if (/gotcha|caveat|careful|watch out|doesn't work|broke|failed|workaround|bug|error/i.test(text) && text.length > 20 && text.length < 500) {
      if (event.category !== 'file') {
        gotchas.push(text.trim().split('\n')[0].slice(0, 200));
      }
    }
  }

  // Build filename
  const briefTopic = slugify(whatWasDone[0]?.slice(2, 50) || 'session');
  const idSuffix = meta.session_id ? meta.session_id.slice(0, 8) : Math.random().toString(36).slice(2, 10);
  const sessionSlug = `${dateStr}-${project}-${briefTopic}-${idSuffix}`;

  // Detect topics
  const existingTopics = getExistingTopics();
  const mentions = findTopicMentions(allText, existingTopics);

  const sessionBody = `---
date: ${dateStr}
project: ${project}
tags: [${mentions.join(', ')}]
type: session
source_db: "${dbFilename}"
---

## What Was Done
${whatWasDone.slice(0, 10).join('\n') || '(no prompts captured)'}

## Files Changed
${filesChanged.slice(0, 15).map(f => '- \`' + f + '\`').join('\n') || '(none)'}

## Key Decisions
${decisions.slice(0, 5).map(d => '- ' + d).join('\n') || '(none extracted)'}

## Gotchas
${gotchas.slice(0, 5).map(g => '- ' + g).join('\n') || '(none extracted)'}

## See Also
${wikiLinks(mentions) || '(no topics matched)'}
`;

  const sessionFile = join(SESSIONS_DIR, `${sessionSlug}.md`);
  const wrote = writeIfNew(sessionFile, sessionBody);
  if (wrote) log(`Wrote session log: ${sessionFile}`);

  // --- Stage 2: Experience Extraction ---
  const experienceFiles = [];

  extractStructuredExperiences(decisions, gotchas, project, dateStr, mentions, experienceFiles);

  // --- Stage 2.5: Mirror experiences to Open Brain (knowledge.db) ---
  if (experienceFiles.length > 0) {
    const expPaths = experienceFiles.map(e => join(EXPERIENCES_DIR, `${e.slug}.md`));
    mirrorToOpenBrain(expPaths);
  }

  // --- Stage 3: Topic Linking ---
  // Link session file to topics
  for (const topicName of mentions) {
    linkToTopic(topicName, sessionSlug);
  }

  // Link experience files to topics
  for (const { slug, content } of experienceFiles) {
    const expTopics = getExistingTopics();
    const expMentions = findTopicMentions(content, expTopics);
    for (const topicName of expMentions) {
      linkToTopic(topicName, slug);
    }
  }

  // --- Stage 4: Sync project docs ---
  try {
    const syncResult = syncProjects();
    if (syncResult.synced > 0) {
      log(`Synced ${syncResult.synced} project docs to vault`);
    }
  } catch (err) {
    log(`WARN: project sync failed: ${err.message}`);
  }

  log(`Done — session: ${sessionSlug}, experiences: ${experienceFiles.length}, topic links: ${mentions.length}`);
}

/**
 * Find the most recently modified .db file in the sessions directory.
 */
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

/**
 * Extract experiences from structured session data (decisions and gotchas).
 * Only writes experiences that meet minimum quality thresholds.
 */
function extractStructuredExperiences(decisions, gotchas, project, dateStr, topics, experienceFiles) {
  let count = 0;

  // Process decisions — these are from the agent's decision events
  for (const text of decisions) {
    if (count >= MAX_EXPERIENCES_PER_SESSION) break;
    if (text.length < MIN_DECISION_LENGTH) continue;

    const firstLine = text.split('\n')[0].slice(0, 200);
    const title = slugify(firstLine.slice(0, 50));
    const slug = `${dateStr}-decision-${title}`;

    const content = `---
date: ${dateStr}
project: ${project}
type: decision
tags: [${topics.join(', ')}]
source: auto-extracted
---

## Trigger
${firstLine}

## Action
${text.slice(0, 500)}

## Context
Session on ${dateStr} in **${project}**.

## Outcome
Auto-captured. Review and enrich if this decision had significant impact.

## See Also
${wikiLinks(topics) || '(no topics matched)'}
`;

    // Semantic dedup check
    const dupMatch = findSemanticDuplicate(firstLine);
    if (dupMatch) {
      log(`DEDUP SKIP (decision): "${firstLine.slice(0, 60)}..." similar to ${dupMatch.path} (${dupMatch.similarity})`);
      continue;
    }

    const expFile = join(EXPERIENCES_DIR, `${slug}.md`);
    const wrote = writeIfNew(expFile, content);
    if (wrote) {
      log(`Wrote decision experience: ${expFile}`);
      experienceFiles.push({ slug, content });
      count++;
    }
  }

  // Process gotchas — these are lines matching gotcha/error patterns
  for (const text of gotchas) {
    if (count >= MAX_EXPERIENCES_PER_SESSION) break;
    if (text.length < MIN_GOTCHA_LENGTH) continue;

    const firstLine = text.split('\n')[0].slice(0, 200);
    const title = slugify(firstLine.slice(0, 50));
    const slug = `${dateStr}-gotcha-${title}`;

    // Semantic dedup check
    const dupMatch = findSemanticDuplicate(firstLine);
    if (dupMatch) {
      log(`DEDUP SKIP (gotcha): "${firstLine.slice(0, 60)}..." similar to ${dupMatch.path} (${dupMatch.similarity})`);
      continue;
    }

    const content = `---
date: ${dateStr}
project: ${project}
type: gotcha
tags: [${topics.join(', ')}]
source: auto-extracted
---

## Trigger
${firstLine}

## Action
${text.slice(0, 500)}

## Context
Encountered during session on ${dateStr} in **${project}**.

## Outcome
Auto-captured. Review and enrich with the specific fix or workaround.

## See Also
${wikiLinks(topics) || '(no topics matched)'}
`;

    const expFile = join(EXPERIENCES_DIR, `${slug}.md`);
    const wrote = writeIfNew(expFile, content);
    if (wrote) {
      log(`Wrote gotcha experience: ${expFile}`);
      experienceFiles.push({ slug, content });
      count++;
    }
  }
}

/**
 * Parse YAML frontmatter from a markdown file.
 * Returns { frontmatter: {}, body: string }.
 */
function parseFrontmatter(text) {
  const match = text.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!match) return { frontmatter: {}, body: text };

  const yamlBlock = match[1];
  const body = match[2];
  const frontmatter = {};

  for (const line of yamlBlock.split('\n')) {
    const colonIdx = line.indexOf(':');
    if (colonIdx === -1) continue;
    const key = line.slice(0, colonIdx).trim();
    let value = line.slice(colonIdx + 1).trim();

    // Handle YAML arrays like [tag1, tag2]
    if (value.startsWith('[') && value.endsWith(']')) {
      value = value.slice(1, -1).split(',').map(s => s.trim()).filter(Boolean);
    }
    // Handle quoted strings
    if (typeof value === 'string' && /^["'].*["']$/.test(value)) {
      value = value.slice(1, -1);
    }
    frontmatter[key] = value;
  }

  return { frontmatter, body };
}

/**
 * Mirror experience files into Open Brain's knowledge.db for FTS5 search via kb_recall.
 * Uses UPSERT pattern: check if key exists, then UPDATE or INSERT.
 */
function mirrorToOpenBrain(experienceFilePaths) {
  if (!existsSync(KNOWLEDGE_DB_PATH)) {
    log(`MIRROR SKIP: knowledge.db not found at ${KNOWLEDGE_DB_PATH}`);
    return;
  }

  let db;
  try {
    db = new Database(KNOWLEDGE_DB_PATH);
  } catch (err) {
    log(`MIRROR ERROR: could not open knowledge.db: ${err.message}`);
    return;
  }

  const now = new Date().toISOString();
  const selectStmt = db.prepare('SELECT id FROM knowledge WHERE key = ? AND source = ?');
  const updateStmt = db.prepare(
    'UPDATE knowledge SET content = ?, tags = ?, updated_at = ? WHERE id = ?'
  );
  const insertStmt = db.prepare(
    'INSERT INTO knowledge (key, content, tags, source, permanent, created_at, updated_at) VALUES (?, ?, ?, ?, 1, ?, ?)'
  );

  let mirrored = 0;
  let errors = 0;

  for (const filePath of experienceFilePaths) {
    try {
      if (!existsSync(filePath)) {
        log(`MIRROR WARN: file not found: ${filePath}`);
        continue;
      }

      const raw = readFileSync(filePath, 'utf-8');
      const { frontmatter, body } = parseFrontmatter(raw);

      const filename = filePath.split(/[\\/]/).pop().replace(/\.md$/, '');
      const tags = Array.isArray(frontmatter.tags)
        ? frontmatter.tags.join(', ')
        : (frontmatter.tags || '');

      // Add vault-mirror tag to distinguish these entries
      const tagStr = tags ? `${tags}, vault-mirror` : 'vault-mirror';

      const existing = selectStmt.get(filename, 'vault-mirror');
      if (existing) {
        updateStmt.run(body, tagStr, now, existing.id);
      } else {
        insertStmt.run(filename, body, tagStr, 'vault-mirror', now, now);
      }
      mirrored++;
    } catch (err) {
      log(`MIRROR ERROR: ${filePath}: ${err.message}`);
      errors++;
    }
  }

  db.close();
  log(`MIRROR: ${mirrored} experiences mirrored to Open Brain (${errors} errors)`);
}

/**
 * Check if a similar experience already exists using Smart Connections CLI.
 * Returns { path, score } if a duplicate is found above threshold, null otherwise.
 */
function findSemanticDuplicate(text) {
  try {
    const query = text.slice(0, 100).replace(/["`$\\]/g, '');
    const result = execSync(
      `smart-cli lookup "${query}" --limit=3 --format=json`,
      { env: { ...process.env, OBSIDIAN_VAULT: VAULT_PATH_FOR_CLI }, timeout: 15000, encoding: 'utf-8' }
    );

    // Extract JSON array from mixed output (model loading lines precede it)
    const jsonStart = result.indexOf('[');
    if (jsonStart === -1) return null;
    const jsonStr = result.slice(jsonStart);
    const parsed = JSON.parse(jsonStr);

    if (parsed && parsed.length > 0) {
      // Find the first result that's in Experiences/ (not a block reference)
      for (const item of parsed) {
        const path = item.path || '';
        if (path.includes('Experiences/') && !path.includes('#') && item.score >= DEDUP_SIMILARITY_THRESHOLD) {
          return { path, score: item.score.toFixed(2) };
        }
      }
    }
  } catch (err) {
    // If smart-cli fails, skip dedup and allow the write
    log(`DEDUP WARN: smart-cli failed: ${err.message}`);
  }
  return null;
}
