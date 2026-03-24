# Obsidian Learning System Consolidation — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Consolidate the learning system from Open Brain MCP + Obsidian into a single Obsidian vault with Smart Connections MCP for semantic search, full automation, and visual browsability.

**Architecture:** All knowledge (sessions, experiences, topics) lives as WikiLinked markdown in `~/Obsidian Vault/`. A SessionEnd hook auto-captures sessions and extracts experiences. Smart Connections plugin provides semantic search via MCP for programmatic retrieval. A one-time migration script moves existing Open Brain data into the vault.

**Tech Stack:** Node.js (v22.9.0), better-sqlite3, Obsidian, Smart Connections plugin + MCP server

**Spec:** `docs/superpowers/specs/2026-03-18-obsidian-learning-system-consolidation-design.md`

---

## File Structure

```
~/Obsidian Vault/
├── Sessions/                    # NEW — auto-generated session logs
├── Experiences/                 # NEW — extracted lessons
├── Topics/                      # NEW — auto-generated hub notes
├── Summaries/                   # NEW — lightweight session recaps
├── Guidelines/                  # EXISTING — skills (unchanged)
├── Templates/                   # EXISTING — skill template (unchanged)
├── .vault-writer.log            # NEW — hook error log

~/.claude/knowledge-mcp/scripts/
├── auto-index.mjs               # EXISTING — context-mode indexer (unchanged)
├── vault-writer.mjs             # NEW — SessionEnd hook: session log + experience extraction + topic linking
├── vault-migration.mjs          # NEW — one-time migration from knowledge.db
├── vault-recovery.mjs           # NEW — backfill missed sessions
└── vault-utils.mjs              # NEW — shared helpers (markdown generation, WikiLink scanning, topic matching)
```

---

## Task 0: Install & Verify Smart Connections

**Files:**
- Modify: `~/Obsidian Vault/.obsidian/community-plugins.json` (via Obsidian UI)

This task is manual — done through Obsidian's UI, not code.

- [ ] **Step 1: Install Smart Connections plugin in Obsidian**

Open Obsidian → Settings → Community Plugins → Browse → Search "Smart Connections" → Install → Enable.

- [ ] **Step 2: Let Smart Connections index the vault**

Smart Connections will run an initial indexing pass. Wait for it to complete (check the status indicator in Obsidian).

- [ ] **Step 3: Verify MCP server availability**

Check Smart Connections settings for an MCP server option. If available, enable it and note the exact MCP tool names exposed. If NOT available, document this — we'll proceed with the vault structure and hook automation regardless, and use grep-based search as the interim retrieval method.

Expected: Smart Connections exposes an MCP tool for semantic lookup. Record the exact tool name and parameters.

- [ ] **Step 4: Document findings**

Create a file at `~/.claude/knowledge-mcp/scripts/smart-connections-mcp-notes.md` recording:
- Whether MCP server is available
- Exact tool names and parameter signatures
- Any configuration needed in `~/.claude/settings.json`

---

## Task 1: Vault Folder Structure & Templates

**Files:**
- Create: `~/Obsidian Vault/Sessions/.gitkeep`
- Create: `~/Obsidian Vault/Experiences/.gitkeep`
- Create: `~/Obsidian Vault/Topics/.gitkeep`
- Create: `~/Obsidian Vault/Summaries/.gitkeep`
- Create: `~/Obsidian Vault/Templates/session-template.md`
- Create: `~/Obsidian Vault/Templates/experience-template.md`
- Create: `~/Obsidian Vault/Templates/topic-template.md`

- [ ] **Step 1: Create vault folders**

```bash
mkdir -p ~/Obsidian\ Vault/Sessions
mkdir -p ~/Obsidian\ Vault/Experiences
mkdir -p ~/Obsidian\ Vault/Topics
mkdir -p ~/Obsidian\ Vault/Summaries
```

- [ ] **Step 2: Create session template**

Write `~/Obsidian Vault/Templates/session-template.md`:

```markdown
---
date: {{date}}
project: {{project}}
tags: []
type: session
---

## What Was Done


## Key Decisions


## Gotchas


## See Also

```

- [ ] **Step 3: Create experience template**

Write `~/Obsidian Vault/Templates/experience-template.md`:

```markdown
---
date: {{date}}
project: {{project}}
type: {{experience-type}}
tags: []
source: "[[{{source-session}}]]"
---

## Trigger


## Action


## Context


## Outcome


## See Also

```

- [ ] **Step 4: Create topic template**

Write `~/Obsidian Vault/Templates/topic-template.md`:

```markdown
---
type: {{topic-type}}
aliases: []
---

{{description}}

## See Also

```

- [ ] **Step 5: Commit**

```bash
cd ~/Obsidian\ Vault
git add Sessions/ Experiences/ Topics/ Summaries/ Templates/session-template.md Templates/experience-template.md Templates/topic-template.md
git commit -m "feat: add learning system vault structure and templates"
```

---

## Task 2: Shared Utilities Module

**Files:**
- Create: `~/.claude/knowledge-mcp/scripts/vault-utils.mjs`

- [ ] **Step 1: Write vault-utils.mjs**

This module provides shared helpers used by the vault-writer, migration, and recovery scripts.

```javascript
import { existsSync, readFileSync, writeFileSync, appendFileSync, readdirSync, statSync } from 'fs';
import { join, basename } from 'path';
import { homedir } from 'os';

const VAULT_PATH = join(homedir(), 'Obsidian Vault');
const SESSIONS_DIR = join(VAULT_PATH, 'Sessions');
const EXPERIENCES_DIR = join(VAULT_PATH, 'Experiences');
const TOPICS_DIR = join(VAULT_PATH, 'Topics');
const SUMMARIES_DIR = join(VAULT_PATH, 'Summaries');
const LOG_PATH = join(VAULT_PATH, '.vault-writer.log');

// Initial seed topics — derived from project domain tags and known tools
const SEED_TOPICS = [
  { name: 'convex', type: 'tool', description: 'Reactive backend-as-a-service used across multiple projects' },
  { name: 'nextjs', type: 'tool', description: 'React framework for web apps' },
  { name: 'stripe', type: 'tool', description: 'Payment processing for makerspace memberships' },
  { name: 'sqlite', type: 'tool', description: 'Embedded database used by Open Brain and context-mode' },
  { name: 'docker', type: 'tool', description: 'Container platform for VPS deployments' },
  { name: 'python', type: 'tool', description: 'Used for CLI pipelines and automation' },
  { name: 'blender', type: 'tool', description: '3D modeling tool used in Banderwocky pipeline' },
  { name: 'roundcube', type: 'tool', description: 'Webmail client on mail server VPS' },
  { name: 'gemini', type: 'tool', description: 'Google AI model used for mail server AI reply' },
  { name: 'mcp', type: 'concept', description: 'Model Context Protocol — tool interface for AI agents' },
  { name: 'tarrant-county-makerspace', type: 'project', description: 'Community makerspace owned by Aaron — website rebuild in progress' },
  { name: 'open-brain', type: 'project', description: 'Personal AI memory/database system (Next.js + Convex + MCP)' },
  { name: 'banderwocky-pipeline', type: 'project', description: "Brian's Etsy laser-cut design pipeline" },
  { name: 'voice-assistant', type: 'project', description: 'Self-hosted voice assistant competing with Alexa' },
];

export { VAULT_PATH, SESSIONS_DIR, EXPERIENCES_DIR, TOPICS_DIR, SUMMARIES_DIR, LOG_PATH, SEED_TOPICS };

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
```

- [ ] **Step 2: Verify module loads**

```bash
node -e "import('./vault-utils.mjs').then(m => console.log('OK, seed topics:', m.SEED_TOPICS.length))"
```

Expected: `OK, seed topics: 14`

- [ ] **Step 3: Commit**

```bash
cd ~/.claude/knowledge-mcp/scripts
git add vault-utils.mjs
git commit -m "feat: add vault-utils shared helpers for learning system"
```

---

## Task 3: Migration Script

**Files:**
- Create: `~/.claude/knowledge-mcp/scripts/vault-migration.mjs`

- [ ] **Step 1: Write vault-migration.mjs**

```javascript
import Database from 'better-sqlite3';
import { existsSync, readdirSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import {
  SESSIONS_DIR, EXPERIENCES_DIR, SUMMARIES_DIR,
  slugify, log, writeIfNew, projectFromDir,
  getExistingTopics, findTopicMentions, linkToTopic, wikiLinks,
  SEED_TOPICS, TOPICS_DIR
} from './vault-utils.mjs';

const KNOWLEDGE_DB = join(homedir(), '.claude', 'context-mode', 'knowledge.db');
const SESSIONS_SOURCE = join(homedir(), '.claude', 'context-mode', 'sessions');

const DRY_RUN = process.argv.includes('--dry-run');

function main() {
  console.log(DRY_RUN ? '=== DRY RUN ===' : '=== MIGRATING ===');

  // Phase 1: Seed topics
  seedTopics();

  // Phase 2: Migrate session .db files
  migrateSessions();

  // Phase 3: Migrate stored experiences from knowledge.db
  migrateKnowledge();

  // Phase 4: Migrate summaries from knowledge.db
  migrateSummaries();

  // Phase 5: Update topic links across all new files
  updateTopicLinks();

  console.log('=== DONE ===');
}

function seedTopics() {
  console.log('\n--- Seeding topics ---');
  for (const { name, type, description } of SEED_TOPICS) {
    const path = join(TOPICS_DIR, `${name}.md`);
    if (existsSync(path)) {
      console.log(`  SKIP: ${name} (exists)`);
      continue;
    }
    const content = `---\ntype: ${type}\naliases: []\n---\n\n${description || ''}\n\n## See Also\n`;
    if (DRY_RUN) {
      console.log(`  WOULD CREATE: ${name}.md`);
    } else {
      writeIfNew(path, content);
      console.log(`  CREATED: ${name}.md`);
    }
  }
}

function migrateSessions() {
  console.log('\n--- Migrating sessions ---');
  if (!existsSync(SESSIONS_SOURCE)) {
    console.log('  No sessions directory found');
    return;
  }

  const dbFiles = readdirSync(SESSIONS_SOURCE).filter(f => f.endsWith('.db'));
  console.log(`  Found ${dbFiles.length} session .db files`);

  for (const dbFile of dbFiles) {
    try {
      const dbPath = join(SESSIONS_SOURCE, dbFile);
      const db = new Database(dbPath, { readonly: true });

      // Get session metadata
      const meta = db.prepare('SELECT * FROM session_meta LIMIT 1').get();
      if (!meta) { db.close(); continue; }

      const date = meta.started_at ? meta.started_at.slice(0, 10) : 'unknown-date';
      const project = projectFromDir(meta.project_dir);

      // Get session events — focus on prompts and tool results
      const events = db.prepare(
        "SELECT type, category, data FROM session_events WHERE category IN ('prompt', 'tool_result', 'assistant', 'file_change', 'error') ORDER BY id"
      ).all();

      // Extract meaningful content
      let whatWasDone = [];
      let decisions = [];
      let gotchas = [];
      let allText = '';

      for (const event of events) {
        let parsed;
        try { parsed = JSON.parse(event.data); } catch { continue; }
        const text = parsed.content || parsed.message || parsed.text || '';
        allText += ' ' + text;

        // Heuristic: look for decision/gotcha keywords
        if (/decided|decision|chose|went with/i.test(text) && text.length > 20 && text.length < 500) {
          decisions.push(text.trim().split('\n')[0].slice(0, 200));
        }
        if (/gotcha|caveat|careful|watch out|doesn't work|broke|failed|workaround/i.test(text) && text.length > 20 && text.length < 500) {
          gotchas.push(text.trim().split('\n')[0].slice(0, 200));
        }
      }

      // Summarize what was done from prompts
      const prompts = events.filter(e => e.category === 'prompt');
      for (const p of prompts.slice(0, 5)) {
        try {
          const parsed = JSON.parse(p.data);
          const text = parsed.content || parsed.message || '';
          if (text.length > 10) whatWasDone.push('- ' + text.trim().split('\n')[0].slice(0, 200));
        } catch {}
      }

      // Build filename
      const briefTopic = slugify(whatWasDone[0]?.slice(2, 50) || 'session');
      const filename = `${date}-${project}-${briefTopic}.md`;

      // Detect topics
      const existingTopics = getExistingTopics();
      const mentions = findTopicMentions(allText, existingTopics);

      const content = `---
date: ${date}
project: ${project}
tags: [${mentions.join(', ')}]
type: session
source_db: "${dbFile}"
---

## What Was Done
${whatWasDone.slice(0, 10).join('\n') || '(migrated session — review for details)'}

## Key Decisions
${decisions.slice(0, 5).map(d => '- ' + d).join('\n') || '(none extracted)'}

## Gotchas
${gotchas.slice(0, 5).map(g => '- ' + g).join('\n') || '(none extracted)'}

## See Also
${wikiLinks(mentions) || '(no topics matched)'}
`;

      if (DRY_RUN) {
        console.log(`  WOULD CREATE: Sessions/${filename} (${events.length} events, ${mentions.length} topics)`);
      } else {
        writeIfNew(join(SESSIONS_DIR, filename), content);
        console.log(`  CREATED: Sessions/${filename}`);
      }

      db.close();
    } catch (err) {
      const msg = `ERROR migrating ${dbFile}: ${err.message}`;
      console.error(`  ${msg}`);
      log(msg);
    }
  }
}

function migrateKnowledge() {
  console.log('\n--- Migrating stored experiences ---');
  if (!existsSync(KNOWLEDGE_DB)) {
    console.log('  knowledge.db not found');
    return;
  }

  const db = new Database(KNOWLEDGE_DB, { readonly: true });
  const rows = db.prepare('SELECT * FROM knowledge ORDER BY created_at').all();
  console.log(`  Found ${rows.length} stored experiences`);

  const existingTopics = getExistingTopics();

  for (const row of rows) {
    const date = row.created_at ? row.created_at.slice(0, 10) : 'unknown-date';
    const project = projectFromDir(row.project_dir) || 'global';
    const slug = slugify(row.key || row.content.slice(0, 50));
    const filename = `${slug}.md`;
    const tags = row.tags ? row.tags.split(',').map(t => t.trim()) : [];
    const mentions = findTopicMentions(row.content, existingTopics);

    const content = `---
date: ${date}
project: ${project}
type: pattern
tags: [${tags.join(', ')}]
source: "migrated from Open Brain knowledge.db"
---

## Trigger
(review and refine — migrated content below)

## Action
${row.content.trim()}

## Context
Migrated from Open Brain knowledge.db (key: ${row.key || 'none'}, permanent: ${row.permanent})

## Outcome
(review and document — migrated content)

## See Also
${wikiLinks(mentions) || '(no topics matched)'}
`;

    if (DRY_RUN) {
      console.log(`  WOULD CREATE: Experiences/${filename}`);
    } else {
      writeIfNew(join(EXPERIENCES_DIR, filename), content);
      console.log(`  CREATED: Experiences/${filename}`);
    }
  }

  db.close();
}

function migrateSummaries() {
  console.log('\n--- Migrating summaries ---');
  if (!existsSync(KNOWLEDGE_DB)) return;

  const db = new Database(KNOWLEDGE_DB, { readonly: true });
  const rows = db.prepare('SELECT * FROM summaries ORDER BY created_at').all();
  console.log(`  Found ${rows.length} summaries`);

  // Group by date
  const byDate = new Map();
  for (const row of rows) {
    const date = row.created_at ? row.created_at.slice(0, 10) : 'unknown-date';
    if (!byDate.has(date)) byDate.set(date, []);
    byDate.get(date).push(row);
  }

  for (const [date, summaries] of byDate) {
    const filename = `${date}-summary.md`;
    const content = `---
date: ${date}
type: summary
---

${summaries.map(s => `### Session: ${s.session_id}\n${s.summary}\n`).join('\n')}
`;

    if (DRY_RUN) {
      console.log(`  WOULD CREATE: Summaries/${filename}`);
    } else {
      writeIfNew(join(SUMMARIES_DIR, filename), content);
      console.log(`  CREATED: Summaries/${filename}`);
    }
  }

  db.close();
}

function updateTopicLinks() {
  console.log('\n--- Updating topic links ---');
  if (DRY_RUN) {
    console.log('  (skipped in dry-run)');
    return;
  }

  const existingTopics = getExistingTopics();

  // Scan all new session and experience files
  for (const dir of [SESSIONS_DIR, EXPERIENCES_DIR]) {
    if (!existsSync(dir)) continue;
    for (const file of readdirSync(dir)) {
      if (!file.endsWith('.md')) continue;
      const content = readFileSync(join(dir, file), 'utf-8');
      const mentions = findTopicMentions(content, existingTopics);
      const linkName = file.replace('.md', '');
      for (const topic of mentions) {
        linkToTopic(topic, linkName);
      }
    }
  }

  console.log('  Topic links updated');
}

main();
```

- [ ] **Step 2: Run dry-run to preview migration**

```bash
cd ~/.claude/knowledge-mcp/scripts
node vault-migration.mjs --dry-run
```

Expected: Lists all files that would be created without writing anything. Review for sanity — reasonable filenames, correct counts (expect ~37 sessions, ~16 experiences, ~4 summaries).

- [ ] **Step 3: Run actual migration**

```bash
node vault-migration.mjs
```

Expected: Creates markdown files in the vault. Verify a few samples manually.

- [ ] **Step 4: Verify in Obsidian**

Open Obsidian, check:
- Sessions/ has ~37 files with frontmatter and WikiLinks
- Experiences/ has ~16 files
- Topics/ has seed topics with See Also backlinks
- Graph view shows connections between sessions, experiences, and topics

- [ ] **Step 5: Commit vault changes**

```bash
cd ~/Obsidian\ Vault
git add Sessions/ Experiences/ Topics/ Summaries/
git commit -m "feat: migrate learning system data from Open Brain to Obsidian vault"
```

- [ ] **Step 6: Commit migration script**

```bash
cd ~/.claude/knowledge-mcp/scripts
git add vault-migration.mjs
git commit -m "feat: add one-time migration script from Open Brain to Obsidian vault"
```

---

## Task 4: SessionEnd Vault Writer Hook

**Files:**
- Create: `~/.claude/knowledge-mcp/scripts/vault-writer.mjs`
- Modify: `~/.claude/settings.json`

- [ ] **Step 1: Write vault-writer.mjs**

```javascript
import Database from 'better-sqlite3';
import { existsSync, readdirSync, statSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import {
  SESSIONS_DIR, EXPERIENCES_DIR, SUMMARIES_DIR,
  slugify, today, log, writeIfNew, projectFromDir,
  getExistingTopics, findTopicMentions, linkToTopic, wikiLinks
} from './vault-utils.mjs';

const SESSIONS_SOURCE = join(homedir(), '.claude', 'context-mode', 'sessions');

async function main() {
  try {
    // Find the most recently modified .db file
    const dbFile = getMostRecentSession();
    if (!dbFile) {
      log('No session .db file found');
      return;
    }

    log(`Processing session: ${dbFile}`);

    // Stage 1: Write session log
    const sessionInfo = writeSessionLog(dbFile);
    if (!sessionInfo) return;

    // Stage 2: Extract experiences
    extractExperiences(sessionInfo);

    // Stage 3: Update topic links
    updateTopicLinks(sessionInfo);

    log(`Session captured: ${sessionInfo.filename}`);
  } catch (err) {
    log(`ERROR: ${err.message}\n${err.stack}`);
  }
}

function getMostRecentSession() {
  if (!existsSync(SESSIONS_SOURCE)) return null;
  const files = readdirSync(SESSIONS_SOURCE)
    .filter(f => f.endsWith('.db'))
    .map(f => ({
      name: f,
      path: join(SESSIONS_SOURCE, f),
      mtime: statSync(join(SESSIONS_SOURCE, f)).mtimeMs
    }))
    .sort((a, b) => b.mtime - a.mtime);

  return files[0] || null;
}

function writeSessionLog(dbFile) {
  const db = new Database(dbFile.path, { readonly: true });

  const meta = db.prepare('SELECT * FROM session_meta LIMIT 1').get();
  if (!meta) { db.close(); return null; }

  // Check if already captured
  const date = meta.started_at ? meta.started_at.slice(0, 10) : today();
  const project = projectFromDir(meta.project_dir);

  const events = db.prepare(
    "SELECT type, category, data FROM session_events WHERE category IN ('prompt', 'tool_result', 'assistant', 'file_change', 'error') ORDER BY id"
  ).all();

  let whatWasDone = [];
  let decisions = [];
  let gotchas = [];
  let allText = '';

  for (const event of events) {
    let parsed;
    try { parsed = JSON.parse(event.data); } catch { continue; }
    const text = parsed.content || parsed.message || parsed.text || '';
    allText += ' ' + text;

    if (/decided|decision|chose|went with/i.test(text) && text.length > 20 && text.length < 500) {
      decisions.push(text.trim().split('\n')[0].slice(0, 200));
    }
    if (/gotcha|caveat|careful|watch out|doesn't work|broke|failed|workaround/i.test(text) && text.length > 20 && text.length < 500) {
      gotchas.push(text.trim().split('\n')[0].slice(0, 200));
    }
  }

  const prompts = events.filter(e => e.category === 'prompt');
  for (const p of prompts.slice(0, 5)) {
    try {
      const parsed = JSON.parse(p.data);
      const text = parsed.content || parsed.message || '';
      if (text.length > 10) whatWasDone.push('- ' + text.trim().split('\n')[0].slice(0, 200));
    } catch {}
  }

  const briefTopic = slugify(whatWasDone[0]?.slice(2, 50) || 'session');
  const filename = `${date}-${project}-${briefTopic}.md`;

  const existingTopics = getExistingTopics();
  const mentions = findTopicMentions(allText, existingTopics);

  const content = `---
date: ${date}
project: ${project}
tags: [${mentions.join(', ')}]
type: session
source_db: "${dbFile.name}"
---

## What Was Done
${whatWasDone.slice(0, 10).join('\n') || '(auto-captured session)'}

## Key Decisions
${decisions.slice(0, 5).map(d => '- ' + d).join('\n') || '(none detected)'}

## Gotchas
${gotchas.slice(0, 5).map(g => '- ' + g).join('\n') || '(none detected)'}

## See Also
${wikiLinks(mentions) || ''}
`;

  const written = writeIfNew(join(SESSIONS_DIR, filename), content);
  db.close();

  if (!written) {
    log(`Session already captured: ${filename}`);
    return null;
  }

  return { filename: filename.replace('.md', ''), date, project, decisions, gotchas, mentions, allText };
}

function extractExperiences(sessionInfo) {
  const existingTopics = getExistingTopics();

  // Create experience files for decisions
  for (const decision of sessionInfo.decisions.slice(0, 3)) {
    const slug = slugify(decision.slice(0, 50));
    const filename = `${slug}.md`;
    const mentions = findTopicMentions(decision, existingTopics);

    const content = `---
date: ${sessionInfo.date}
project: ${sessionInfo.project}
type: decision
tags: [${sessionInfo.mentions.join(', ')}]
source: "[[${sessionInfo.filename}]]"
---

## Trigger
(auto-extracted — review and refine)

## Action
${decision}

## Context
Auto-extracted from session ${sessionInfo.filename}

## Outcome
(auto-extracted — review and document)

## See Also
[[${sessionInfo.filename}]] ${wikiLinks(mentions)}
`;
    writeIfNew(join(EXPERIENCES_DIR, filename), content);
  }

  // Create experience files for gotchas
  for (const gotcha of sessionInfo.gotchas.slice(0, 3)) {
    const slug = slugify(gotcha.slice(0, 50));
    const filename = `${slug}.md`;
    const mentions = findTopicMentions(gotcha, existingTopics);

    const content = `---
date: ${sessionInfo.date}
project: ${sessionInfo.project}
type: gotcha
tags: [${sessionInfo.mentions.join(', ')}]
source: "[[${sessionInfo.filename}]]"
---

## Trigger
(auto-extracted — review and refine)

## Action
${gotcha}

## Context
Auto-extracted from session ${sessionInfo.filename}

## Outcome
(auto-extracted — review and document)

## See Also
[[${sessionInfo.filename}]] ${wikiLinks(mentions)}
`;
    writeIfNew(join(EXPERIENCES_DIR, filename), content);
  }
}

function updateTopicLinks(sessionInfo) {
  const existingTopics = getExistingTopics();
  const allMentions = findTopicMentions(sessionInfo.allText, existingTopics);

  for (const topic of allMentions) {
    linkToTopic(topic, sessionInfo.filename);
  }
}

main();
```

- [ ] **Step 2: Test the hook manually against the most recent session**

```bash
cd ~/.claude/knowledge-mcp/scripts
node vault-writer.mjs
```

Expected: Creates a session log in Sessions/, possibly experience files in Experiences/, updates topic See Also sections. Check the output and verify files.

- [ ] **Step 3: Register the hook in settings.json**

Read `~/.claude/settings.json`, find the existing `SessionEnd` hooks array, and add the vault-writer as a second entry:

```json
{
  "type": "command",
  "command": "node \"C:\\Users\\melve\\.claude\\knowledge-mcp\\scripts\\vault-writer.mjs\""
}
```

This goes alongside the existing `auto-index.mjs` hook — both run on every SessionEnd.

- [ ] **Step 4: Verify hook coexistence**

Start a new Claude Code session, do something trivial, end the session. Check:
1. `auto-index.mjs` still runs (knowledge.db updated)
2. `vault-writer.mjs` creates a new session in Obsidian vault
3. No errors in `.vault-writer.log`

- [ ] **Step 5: Commit**

```bash
cd ~/.claude/knowledge-mcp/scripts
git add vault-writer.mjs
git commit -m "feat: add SessionEnd vault-writer hook for auto-capture"
```

---

## Task 5: Recovery Script

**Files:**
- Create: `~/.claude/knowledge-mcp/scripts/vault-recovery.mjs`

- [ ] **Step 1: Write vault-recovery.mjs**

```javascript
import { existsSync, readdirSync, readFileSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import { SESSIONS_DIR, log } from './vault-utils.mjs';

const SESSIONS_SOURCE = join(homedir(), '.claude', 'context-mode', 'sessions');

function main() {
  console.log('=== Scanning for missed sessions ===');

  if (!existsSync(SESSIONS_SOURCE)) {
    console.log('No sessions directory found');
    return;
  }

  // Get all .db filenames from session source
  const dbFiles = new Set(
    readdirSync(SESSIONS_SOURCE).filter(f => f.endsWith('.db'))
  );

  // Get all source_db references from existing session logs
  const capturedDbs = new Set();
  if (existsSync(SESSIONS_DIR)) {
    for (const file of readdirSync(SESSIONS_DIR)) {
      if (!file.endsWith('.md')) continue;
      const content = readFileSync(join(SESSIONS_DIR, file), 'utf-8');
      const match = content.match(/source_db:\s*"([^"]+)"/);
      if (match) capturedDbs.add(match[1]);
    }
  }

  // Find uncaptured sessions
  const missed = [...dbFiles].filter(f => !capturedDbs.has(f));
  console.log(`Found ${dbFiles.size} total sessions, ${capturedDbs.size} captured, ${missed.length} missed`);

  if (missed.length === 0) {
    console.log('No missed sessions!');
    return;
  }

  console.log('\nMissed sessions:');
  for (const f of missed) {
    console.log(`  - ${f}`);
  }

  console.log('\nTo backfill, run the migration script which will skip already-captured sessions.');
  console.log('  node vault-migration.mjs');
}

main();
```

- [ ] **Step 2: Test recovery script**

```bash
node vault-recovery.mjs
```

Expected: Reports how many sessions are captured vs missed.

- [ ] **Step 3: Commit**

```bash
cd ~/.claude/knowledge-mcp/scripts
git add vault-recovery.mjs
git commit -m "feat: add vault-recovery script for backfilling missed sessions"
```

---

## Task 6: Update Global CLAUDE.md

**Files:**
- Modify: `~/.claude/CLAUDE.md`

- [ ] **Step 1: Update retrieval protocol**

Replace the current `kb_recall`-based retrieval with Smart Connections MCP lookup (or grep-based fallback if Smart Connections MCP is unavailable — check findings from Task 0 Step 4).

Update the "Retrieval Protocol" section:
- Replace `kb_recall` references with Smart Connections MCP tool (or `grep -rl` + `Read` as fallback)
- Keep the same guardrails: max 3 experiences + 2 skills
- Search targets: `~/Obsidian Vault/Experiences/`, `~/Obsidian Vault/Sessions/`, `~/Obsidian Vault/Guidelines/`

- [ ] **Step 2: Update accumulation protocol**

Replace the current `kb_store`-based accumulation with a note that accumulation is now automatic via the SessionEnd hook. The `/end` skill can optionally trigger a manual review pass to improve auto-extracted experiences.

- [ ] **Step 3: Update key paths table**

Replace Open Brain references with vault paths:

| Resource | Path |
|---|---|
| Sessions | `~/Obsidian Vault/Sessions/` |
| Experiences | `~/Obsidian Vault/Experiences/` |
| Topics | `~/Obsidian Vault/Topics/` |
| Skills | `~/Obsidian Vault/Guidelines/` |
| Skill Index | `~/Obsidian Vault/Guidelines/SKILL-INDEX.md` |
| Hook Log | `~/Obsidian Vault/.vault-writer.log` |

- [ ] **Step 4: Remove Open Brain as learning system dependency**

Remove references to `kb_recall`, `kb_store`, `kb_store_summary`, `kb_list`, `kb_prune`, `kb_forget` from the learning system section. Add a note that Open Brain remains as a standalone product project.

- [ ] **Step 5: Commit**

```bash
cd ~/.claude
git add CLAUDE.md
git commit -m "feat: update global CLAUDE.md — learning system now uses Obsidian vault"
```

---

## Task 7: Update Learning System Docs

**Files:**
- Modify: `~/Projects/AI-First-Developement-Framwork/docs/learning-system/current-protocols.md`
- Modify: `~/Projects/AI-First-Developement-Framwork/docs/learning-system/gaps.md`
- Modify: `~/.claude/projects/C--Users-melve/memory/project_learning_system.md`
- Modify: `~/.claude/projects/C--Users-melve/memory/project_self_improving_agent.md`

- [ ] **Step 1: Update current-protocols.md**

Rewrite to reflect the new Obsidian-based architecture:
- Retrieval: Smart Connections MCP (or grep fallback) instead of `kb_recall`
- Accumulation: automatic via SessionEnd hook instead of manual `/end`
- Storage: vault markdown instead of SQLite
- Experience format: same structure, now as individual .md files with WikiLinks

- [ ] **Step 2: Update gaps.md**

Mark completed gaps:
- ~~No Automatic Session Capture Safety Net~~ → DONE (SessionEnd hook)
- ~~No Visual Knowledge Graph~~ → DONE (Obsidian graph view + WikiLinks)
- ~~No Conversation Import~~ → DONE (migration script)

Update remaining gaps with new context.

- [ ] **Step 3: Update memory files**

Update `project_learning_system.md` and `project_self_improving_agent.md` to reflect that the learning system now runs on Obsidian, not Open Brain.

- [ ] **Step 4: Commit**

```bash
cd ~/Projects/AI-First-Developement-Framwork
git add docs/learning-system/
git commit -m "docs: update learning system docs for Obsidian consolidation"

cd ~/.claude/projects/C--Users-melve/memory
git add project_learning_system.md project_self_improving_agent.md
git commit -m "docs: update memory files for Obsidian-based learning system"
```

---

## Task 8: End-to-End Verification

- [ ] **Step 1: Evaluate auto-index.mjs dependency**

Test whether context-mode's `ctx_search` still works without `auto-index.mjs` running. If `ctx_search` depends on `knowledge.db` being populated by `auto-index.mjs`, keep the hook. If `ctx_search` uses its own indexing, the hook can be retired. Document the finding.

- [ ] **Step 2: Note dedup limitation**

The current vault-writer uses filename-based dedup (`writeIfNew`) which won't catch semantically duplicate experiences with different slugs. Once Smart Connections MCP is verified (Task 0), a future iteration should add semantic dedup: call Smart Connections lookup before writing, update existing file if similarity exceeds threshold. For now, filename dedup prevents exact duplicates.

- [ ] **Step 3: Verify migration data in Obsidian**

Open Obsidian graph view. Confirm:
- Topic nodes are connected to session and experience nodes
- Clicking a topic shows backlinks to relevant sessions
- Search finds experiences by keyword

- [ ] **Step 4: Test auto-capture end-to-end**

Start a new Claude Code session, do some work, end the session. Verify:
- New session log appears in Sessions/
- Experiences extracted if decisions/gotchas detected
- Topic notes updated with new backlinks
- `.vault-writer.log` shows success, no errors
- Obsidian graph updates with new connections

- [ ] **Step 5: Test retrieval at session start**

Start another Claude Code session. Verify Clark searches the vault (via Smart Connections MCP or grep) and surfaces relevant experiences.

- [ ] **Step 6: Test recovery script**

```bash
node ~/.claude/knowledge-mcp/scripts/vault-recovery.mjs
```

Verify it correctly reports captured vs missed sessions after the test.
