import { existsSync, readFileSync, writeFileSync, appendFileSync, readdirSync, statSync } from 'fs';
import { join, basename } from 'path';
import { homedir } from 'os';

const VAULT_PATH = join(homedir(), 'Obsidian Vault');
const SESSIONS_DIR = join(VAULT_PATH, 'Sessions');
const EXPERIENCES_DIR = join(VAULT_PATH, 'Experiences');
const TOPICS_DIR = join(VAULT_PATH, 'Topics');
const SUMMARIES_DIR = join(VAULT_PATH, 'Summaries');
const LOGS_DIR = join(VAULT_PATH, 'Logs');
const LOG_PATH = join(VAULT_PATH, '.vault-writer.log');

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

export { VAULT_PATH, SESSIONS_DIR, EXPERIENCES_DIR, TOPICS_DIR, SUMMARIES_DIR, LOGS_DIR, LOG_PATH, SEED_TOPICS };

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
 * Count how many files in Sessions/ and Experiences/ mention a topic name.
 * Used for the 2-file threshold before auto-creating a topic note.
 */
export function countTopicMentions(topicName) {
  let count = 0;
  const regex = new RegExp(`\\b${topicName.replace(/-/g, '[- ]')}\\b`, 'i');
  for (const dir of [SESSIONS_DIR, EXPERIENCES_DIR]) {
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
 * Extract project name from a project directory path.
 */
export function projectFromDir(dir) {
  if (!dir) return 'unknown';
  const name = basename(dir);
  return slugify(name);
}
