import { existsSync, readFileSync, writeFileSync, appendFileSync, readdirSync, statSync, mkdirSync } from 'fs';
import { join, basename } from 'path';
import { homedir } from 'os';

const VAULT_PATH = join(homedir(), 'Obsidian Vault');
const EXPERIENCES_DIR = join(VAULT_PATH, 'Experiences');
const TOPICS_DIR = join(VAULT_PATH, 'Topics');
const SUMMARIES_DIR = join(VAULT_PATH, 'Summaries');
const LOGS_DIR = join(VAULT_PATH, 'Logs');
const LOG_PATH = join(LOGS_DIR, 'vault-writer.log');

// Seed topics for topic detection. Add your own projects and tools here.
// These help the vault-writer auto-link experiences to topic notes.
// Format: { name: 'topic-slug', type: 'tool'|'concept'|'project', description: '...' }
const SEED_TOPICS = [
  // Common tools (add/remove based on your stack)
  { name: 'sqlite', type: 'tool', description: 'Embedded database used by knowledge-mcp' },
  { name: 'docker', type: 'tool', description: 'Container platform for deployments' },
  { name: 'mcp', type: 'concept', description: 'Model Context Protocol — tool interface for AI agents' },
  // Add your projects below, e.g.:
  // { name: 'my-project', type: 'project', description: 'Description of your project' },
];

export { VAULT_PATH, EXPERIENCES_DIR, TOPICS_DIR, SUMMARIES_DIR, LOGS_DIR, LOG_PATH, SEED_TOPICS };

/**
 * Slugify a string for use as a filename.
 */
export function slugify(text) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 80);
}

/**
 * Get today's date as YYYY-MM-DD.
 */
export function today() {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Log a message to the vault writer log file.
 */
export function log(message) {
  const timestamp = new Date().toISOString();
  appendFileSync(LOG_PATH, `[${timestamp}] ${message}\n`);
}

/**
 * Get all existing topic names from the Topics/ folder.
 * Returns a Map of lowercase name -> filename (without .md).
 */
export function getExistingTopics() {
  const topics = new Map();
  if (!existsSync(TOPICS_DIR)) return topics;
  for (const file of readdirSync(TOPICS_DIR)) {
    if (file.endsWith('.md')) {
      const name = file.replace('.md', '');
      topics.set(name.toLowerCase(), name);
    }
  }
  return topics;
}

/**
 * Scan text for topic mentions. Returns array of matched topic filenames.
 * Case-insensitive matching against existing topic names.
 */
export function findTopicMentions(text, existingTopics) {
  const mentions = [];
  const lowerText = text.toLowerCase();
  for (const [lowerName, fileName] of existingTopics) {
    // Match whole word only (avoid partial matches)
    const regex = new RegExp(`\\b${lowerName.replace(/-/g, '[- ]')}\\b`, 'i');
    if (regex.test(lowerText)) {
      mentions.push(fileName);
    }
  }
  return mentions;
}

/**
 * Count how many files in Summaries/ and Experiences/ mention a topic name.
 * Used for the 2-file threshold before auto-creating a topic note.
 */
export function countTopicMentions(topicName) {
  let count = 0;
  const regex = new RegExp(`\\b${topicName.replace(/-/g, '[- ]')}\\b`, 'i');
  for (const dir of [SUMMARIES_DIR, EXPERIENCES_DIR]) {
    if (!existsSync(dir)) continue;
    for (const file of readdirSync(dir)) {
      if (!file.endsWith('.md')) continue;
      const content = readFileSync(join(dir, file), 'utf-8');
      if (regex.test(content)) count++;
    }
  }
  return count;
}

/**
 * Generate WikiLinks string from an array of topic names.
 */
export function wikiLinks(topics) {
  return topics.map(t => `[[${t}]]`).join(' ');
}

/**
 * Append a WikiLink to a topic note's "See Also" section.
 * Creates the topic note if it doesn't exist and meets the 2-file threshold.
 */
export function linkToTopic(topicName, targetLink, topicType = 'concept') {
  const topicPath = join(TOPICS_DIR, `${topicName}.md`);
  const wikiLink = `[[${targetLink}]]`;

  if (existsSync(topicPath)) {
    const content = readFileSync(topicPath, 'utf-8');
    if (content.includes(wikiLink)) return; // already linked
    // Append to See Also section
    const updated = content.trimEnd() + '\n' + wikiLink + '\n';
    writeFileSync(topicPath, updated);
  } else {
    // Check 2-file threshold before creating
    const mentions = countTopicMentions(topicName);
    if (mentions < 2) return; // not enough mentions yet

    const note = `---
type: ${topicType}
aliases: []
---

## See Also
${wikiLink}
`;
    writeFileSync(topicPath, note);
  }
}

/**
 * Write a markdown file. Does NOT overwrite if file already exists.
 * Returns true if written, false if skipped.
 */
export function writeIfNew(filePath, content) {
  if (existsSync(filePath)) {
    log(`SKIP: ${filePath} already exists`);
    return false;
  }
  writeFileSync(filePath, content);
  return true;
}

/**
 * Generate an Obsidian .md mirror from a knowledge.db experience entry.
 * Overwrites if exists — knowledge.db is source of truth.
 * @param {object} entry - { key, content, tags, source, project, date, subtype, files, outcome }
 */
export function mirrorToObsidian(entry) {
  const { key, content, tags, source, project, date, subtype, files, outcome } = entry;

  // Parse tags string into array
  const tagList = (tags || '').split(',').map(t => t.trim()).filter(Boolean);

  // Build YAML frontmatter
  const frontmatter = [
    '---',
    `date: ${date || today()}`,
    `project: ${project || 'unknown'}`,
    `type: experience`,
    `subtype: ${subtype || 'decision'}`,
    `tags: [${tagList.join(', ')}]`,
    files ? `files: [${files.split(',').map(f => f.trim()).filter(Boolean).join(', ')}]` : null,
    `outcome: ${outcome || 'unknown'}`,
    `source: ${source || 'vault-writer'}`,
    '---',
  ].filter(Boolean).join('\n');

  // Convert structured text body to markdown sections
  const body = content
    .replace(/^TRIGGER:\s*/m, '## Trigger\n')
    .replace(/^ACTION:\s*/m, '## Action\n')
    .replace(/^CONTEXT:\s*/m, '## Context\n')
    .replace(/^OUTCOME:\s*/m, '## Outcome\n')
    // Strip the header lines that are now in frontmatter
    .replace(/^\[EXPERIENCE\].*\n/m, '')
    .replace(/^PROJECT:.*\n/m, '')
    .replace(/^DOMAIN:.*\n/m, '')
    .replace(/^DATE:.*\n/m, '')
    .replace(/^TYPE:.*\n/m, '')
    .replace(/^SOURCE:.*\n/m, '')
    .trim();

  const mdContent = `${frontmatter}\n\n${body}\n`;
  const filePath = join(EXPERIENCES_DIR, `${key}.md`);
  writeFileSync(filePath, mdContent);
  return filePath;
}

/**
 * Extract project name from a project directory path.
 */
export function projectFromDir(dir) {
  if (!dir) return 'unknown';
  const name = basename(dir);
  return slugify(name);
}

/**
 * Write a session summary to the Obsidian Vault Summaries/ folder.
 * Idempotent: if a file with the same session_id exists, it is overwritten.
 * Same-day collision: appends -2, -3, etc. if a different session already owns the base filename.
 *
 * @param {object} opts
 * @param {string} opts.sessionId - Unique session identifier
 * @param {number} opts.sessionNumber - Session number for display
 * @param {string} opts.projectSlug - Slugified project name
 * @param {string} opts.date - Date string YYYY-MM-DD
 * @param {string[]} opts.tags - Array of tag strings
 * @param {string[]} opts.files - Array of file paths touched
 * @param {string} opts.summary - Markdown body of the summary
 * @returns {string} Path to the written file
 */
export function writeSummaryToObsidian({ sessionId, sessionNumber, projectSlug, date, tags, files, summary }) {
  // Ensure Summaries directory exists
  if (!existsSync(SUMMARIES_DIR)) {
    mkdirSync(SUMMARIES_DIR, { recursive: true });
  }

  const dateStr = date || today();
  const slug = projectSlug || 'unknown';
  const baseName = `${dateStr}-${slug}`;

  // Scan existing files for matching session_id — overwrite if found
  let targetPath = null;
  if (existsSync(SUMMARIES_DIR)) {
    for (const file of readdirSync(SUMMARIES_DIR)) {
      if (!file.endsWith('.md')) continue;
      const filePath = join(SUMMARIES_DIR, file);
      const content = readFileSync(filePath, 'utf-8');
      if (content.includes(`session_id: ${sessionId}`)) {
        targetPath = filePath;
        break;
      }
    }
  }

  // No existing file for this session — find a free filename
  if (!targetPath) {
    const candidate = join(SUMMARIES_DIR, `${baseName}.md`);
    if (!existsSync(candidate)) {
      targetPath = candidate;
    } else {
      // Check if the existing file belongs to a different session
      const existing = readFileSync(candidate, 'utf-8');
      if (existing.includes(`session_id: ${sessionId}`)) {
        targetPath = candidate;
      } else {
        // Same-day collision — find next available suffix
        let suffix = 2;
        while (true) {
          const suffixed = join(SUMMARIES_DIR, `${baseName}-${suffix}.md`);
          if (!existsSync(suffixed)) {
            targetPath = suffixed;
            break;
          }
          const suffixedContent = readFileSync(suffixed, 'utf-8');
          if (suffixedContent.includes(`session_id: ${sessionId}`)) {
            targetPath = suffixed;
            break;
          }
          suffix++;
        }
      }
    }
  }

  // Build YAML frontmatter
  const tagList = (tags || []).map(t => t.trim()).filter(Boolean);
  const fileList = (files || []).map(f => f.trim()).filter(Boolean);

  const frontmatter = [
    '---',
    `date: ${dateStr}`,
    `project: ${slug}`,
    `session: ${sessionNumber || 0}`,
    `session_id: ${sessionId}`,
    `type: summary`,
    `tags: [${tagList.join(', ')}]`,
    `files: [${fileList.join(', ')}]`,
    '---',
  ].join('\n');

  const mdContent = `${frontmatter}\n\n${summary || ''}\n`;
  writeFileSync(targetPath, mdContent);
  return targetPath;
}
