# Widen Extraction + Unified Format Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Widen vault-writer extraction to capture planning discussions, architecture decisions, and workarounds. Unify experience format across automated and curated writers. Reverse data flow to SQLite-first.

**Architecture:** vault-writer.mjs scans session events using existing categories + new conversation-scanning regexes. Matched experiences write to knowledge.db first (structured text for FTS5), then generate Obsidian `.md` mirrors (YAML frontmatter). `/end` skill updated to use same format with `SOURCE: agent`.

**Tech Stack:** Node.js, better-sqlite3, ESM modules

---

## File Structure

| File | Responsibility | Action |
|------|---------------|--------|
| `scripts/vault-utils.mjs` | Shared constants, helpers, new `mirrorToObsidian()` | Modify |
| `scripts/vault-writer.mjs` | SessionEnd extraction pipeline | Modify (major) |
| `~/.claude/commands/end.md` | `/end` skill experience format | Modify (minor) |

Both script files exist in two locations that must stay in sync:
- **Repo:** `C:/Users/melve/Projects/Self-Improving-Agent/scripts/`
- **Installed:** `C:/Users/melve/.claude/knowledge-mcp/scripts/`

Edit the **repo** copies, then copy to installed location in the final task.

---

### Task 1: Add `mirrorToObsidian()` to vault-utils.mjs

**Files:**
- Modify: `scripts/vault-utils.mjs`

- [ ] **Step 1: Read current vault-utils.mjs**

Read `scripts/vault-utils.mjs` to get current content in context for editing.

- [ ] **Step 2: Add `mirrorToObsidian` function**

Add this function after the existing `writeIfNew` function (after line 153):

```javascript
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
    files ? `files: [${files}]` : null,
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
```

- [ ] **Step 3: Add `mirrorToObsidian` to the exports**

The function uses `export` keyword so it's already exported. Verify `EXPERIENCES_DIR` and `today` are available in scope (they are — defined at top of file).

- [ ] **Step 4: Commit**

```bash
git add scripts/vault-utils.mjs
git commit -m "feat: add mirrorToObsidian() for SQLite-first data flow"
```

---

### Task 2: Add conversation scanning patterns to vault-writer.mjs

**Files:**
- Modify: `scripts/vault-writer.mjs`

- [ ] **Step 1: Read current vault-writer.mjs**

Read `scripts/vault-writer.mjs` to get current content in context for editing.

- [ ] **Step 2: Add pattern constants after the existing quality gate constants (after line 30)**

```javascript
// --- Conversation scanning patterns (hybrid extraction) ---
const PLANNING_PATTERNS = [
  /\blet'?s go with\b/i,
  /\bthe approach is\b/i,
  /\bwe decided\b/i,
  /\bthe plan is\b/i,
  /\bI want to build\b/i,
  /\bshould we\b/i,
  /\bI('m| am) thinking\b/i,
  /\bthe strategy\b/i,
];

const ARCHITECTURE_PATTERNS = [
  /\bchose .{3,30} over\b/i,
  /\btrade-?off\b/i,
  /\binstead of\b/i,
  /\bthe reason (?:is|was)\b/i,
  /\barchitecture\b/i,
  /\bdata flow\b/i,
];

const WORKAROUND_PATTERNS = [
  /\bworkaround\b/i,
  /\bhack\b/i,
  /\btemporary fix\b/i,
  /\buntil we\b/i,
  /\bfor now we\b/i,
  /\bfixed by\b/i,
];

const ROOT_CAUSE_PATTERNS = [
  /\broot cause\b/i,
  /\bthe issue was\b/i,
  /\bturns out\b/i,
  /\bthe problem (?:is|was)\b/i,
  /\bdoesn'?t support\b/i,
  /\bincompatible\b/i,
];

const EXPLICIT_MARKERS = [
  /\bremember this\b/i,
  /\bnote that\b/i,
  /\bimportant:/i,
  /\blesson learned\b/i,
];

// Map pattern arrays to experience subtypes
const CONVERSATION_PATTERNS = [
  { patterns: PLANNING_PATTERNS, subtype: 'planning' },
  { patterns: ARCHITECTURE_PATTERNS, subtype: 'decision' },
  { patterns: WORKAROUND_PATTERNS, subtype: 'workaround' },
  { patterns: ROOT_CAUSE_PATTERNS, subtype: 'gotcha' },
  { patterns: EXPLICIT_MARKERS, subtype: 'pattern' },
];
```

- [ ] **Step 3: Update MIN_DECISION_LENGTH from 40 to 25**

Change line 26:
```javascript
const MIN_DECISION_LENGTH = 25;  // lowered from 40 — monitor via Obsidian
```

Also change line 27:
```javascript
const MIN_GOTCHA_LENGTH = 25;
```

- [ ] **Step 4: Commit**

```bash
git add scripts/vault-writer.mjs
git commit -m "feat: add conversation scanning patterns and lower min length thresholds"
```

---

### Task 3: Add conversation scanning to the event processing loop

**Files:**
- Modify: `scripts/vault-writer.mjs`

- [ ] **Step 1: Read vault-writer.mjs again for editing context**

Read `scripts/vault-writer.mjs` to get current content.

- [ ] **Step 2: Add `conversationMatches` array and scanning logic**

After the existing event loop (after line 226, after the gotcha detection block), add a new scanning block. First, add the array declaration near the other arrays (near line 185, after `let allText = '';`):

```javascript
  const conversationMatches = [];  // { text, subtype, userPrompt }
```

Then, at the end of the event processing loop (inside the `for (const event of allEvents)` block, after the gotcha detection), add:

```javascript
    // --- Conversation scanning (hybrid extraction) ---
    if (!isSystemNoise && text.length > 25 && text.length < 2000) {
      for (const { patterns, subtype } of CONVERSATION_PATTERNS) {
        for (const regex of patterns) {
          if (regex.test(text)) {
            conversationMatches.push({
              text: text.trim(),
              subtype,
              matchedPattern: regex.source,
            });
            break;  // one match per pattern group per event
          }
        }
        // Don't break outer loop — same event could match multiple groups
      }
    }
```

Note: `isSystemNoise` is already defined earlier in the loop at the gotcha detection block. However it's scoped inside an `if` block. Move the `isSystemNoise` declaration to the top of the loop body so it's available for both gotcha detection and conversation scanning:

Move this line from inside the gotcha block to right after `const text = event.data || '';`:
```javascript
    const isSystemNoise = /^<local-command|^<command-name|^<system-reminder/i.test(text.trim());
```

And update the gotcha detection block to use the shared variable (remove the duplicate declaration).

- [ ] **Step 3: After the event loop, build the user prompt context map**

After the event loop closes, before the quality gate check, add:

```javascript
  // Build context map: for each event index, find the preceding user prompt
  const userPrompts = [];
  for (const event of allEvents) {
    if (event.type === 'user_prompt') {
      const text = event.data || '';
      const isNoise = /^<local-command|^<command-name|^<command-message|^<local-command-stdout|^<system-reminder/i.test(text.trim());
      if (!isNoise && text.length > 10) {
        userPrompts.push(text.trim().split('\n').slice(0, 5).join('\n').slice(0, 500));
      }
    }
  }
  // Attach most recent user prompt to each conversation match as context
  let promptIdx = 0;
  for (const event of allEvents) {
    if (event.type === 'user_prompt') {
      const text = event.data || '';
      if (!(/^<local-command|^<command-name|^<system-reminder/i.test(text.trim())) && text.length > 10) {
        promptIdx++;
      }
    }
    for (const match of conversationMatches) {
      if (match.text === (event.data || '').trim() && !match.userPrompt) {
        match.userPrompt = userPrompts[Math.max(0, promptIdx - 1)] || '';
        break;
      }
    }
  }
```

- [ ] **Step 4: Commit**

```bash
git add scripts/vault-writer.mjs
git commit -m "feat: add conversation scanning loop with user prompt context"
```

---

### Task 4: Rewrite experience extraction to SQLite-first with unified format

**Files:**
- Modify: `scripts/vault-writer.mjs`

- [ ] **Step 1: Read vault-writer.mjs for editing context**

Read `scripts/vault-writer.mjs`.

- [ ] **Step 2: Add import for `mirrorToObsidian`**

Update the import from vault-utils.mjs (line 18-20) to include the new function:

```javascript
import {
  SESSIONS_DIR, EXPERIENCES_DIR, LOGS_DIR,
  slugify, today, log, writeIfNew, projectFromDir,
  getExistingTopics, findTopicMentions, linkToTopic, wikiLinks,
  mirrorToObsidian
} from './vault-utils.mjs';
```

- [ ] **Step 3: Add `writeExperienceToDb` function**

Add this function before the existing `extractStructuredExperiences` function:

```javascript
/**
 * Write an experience to knowledge.db in unified structured text format.
 * Then generate an Obsidian .md mirror.
 * Returns { key, written: true/false }.
 */
function writeExperienceToDb(opts) {
  const { title, project, date, subtype, tags, files, trigger, action, context, outcome } = opts;
  const key = `${date}-${subtype}-${slugify(title)}`;

  // Build FTS5-optimized structured text
  const content = [
    `[EXPERIENCE] ${title}`,
    `PROJECT: ${project}`,
    `DOMAIN: ${tags}`,
    `DATE: ${date}`,
    `TYPE: ${subtype}`,
    `SOURCE: vault-writer`,
    '',
    `TRIGGER: ${trigger}`,
    `ACTION: ${action}`,
    `CONTEXT: ${context}`,
    `OUTCOME: ${outcome}`,
  ].join('\n');

  // Write to knowledge.db
  if (!existsSync(KNOWLEDGE_DB_PATH)) {
    log(`DB SKIP: knowledge.db not found at ${KNOWLEDGE_DB_PATH}`);
    return { key, written: false };
  }

  let db;
  try {
    db = new Database(KNOWLEDGE_DB_PATH);
  } catch (err) {
    log(`DB ERROR: could not open knowledge.db: ${err.message}`);
    return { key, written: false };
  }

  try {
    const existing = db.prepare('SELECT id FROM knowledge WHERE key = ? AND source = ?').get(key, 'vault-writer');
    const now = new Date().toISOString();
    const enrichedTags = [tags, `file-touch:${(files || []).join(',')}`, subtype].filter(Boolean).join(', ');

    if (existing) {
      db.prepare('UPDATE knowledge SET content = ?, tags = ?, updated_at = ?, project_dir = ? WHERE id = ?')
        .run(content, enrichedTags, now, project, existing.id);
      log(`DB UPDATE: ${key}`);
    } else {
      db.prepare('INSERT INTO knowledge (key, content, tags, source, permanent, created_at, updated_at, project_dir) VALUES (?, ?, ?, ?, 1, ?, ?, ?)')
        .run(key, content, enrichedTags, 'vault-writer', now, now, project);
      log(`DB INSERT: ${key}`);
    }

    // Generate Obsidian mirror
    const fileList = Array.isArray(files) ? files.join(', ') : (files || '');
    const mdPath = mirrorToObsidian({
      key, content, tags: enrichedTags, source: 'vault-writer',
      project, date, subtype, files: fileList, outcome: outcome || 'unknown'
    });
    log(`MIRROR: ${mdPath}`);

    return { key, written: true };
  } catch (err) {
    log(`DB ERROR: ${key}: ${err.message}`);
    return { key, written: false };
  } finally {
    db.close();
  }
}
```

- [ ] **Step 4: Commit**

```bash
git add scripts/vault-writer.mjs
git commit -m "feat: add writeExperienceToDb for SQLite-first experience writing"
```

---

### Task 5: Refactor `extractStructuredExperiences` to use unified writer + add filter logging

**Files:**
- Modify: `scripts/vault-writer.mjs`

- [ ] **Step 1: Read vault-writer.mjs for editing context**

Read `scripts/vault-writer.mjs`.

- [ ] **Step 2: Replace `extractStructuredExperiences` function**

Replace the entire `extractStructuredExperiences` function (lines 338-438) with:

```javascript
/**
 * Extract experiences from structured session data and conversation matches.
 * Writes to knowledge.db first, then mirrors to Obsidian.
 */
function extractStructuredExperiences(decisions, gotchas, conversationMatches, project, dateStr, topics, experienceFiles, filesChanged = []) {
  let count = 0;

  const fileTags = [...new Set(
    filesChanged
      .map(f => f.split(/[\\/]/).pop())
      .filter(f => f && !f.startsWith('.'))
      .map(f => f.toLowerCase())
  )].slice(0, 10);

  const tagStr = [...topics, ...fileTags].join(', ');
  const fileBasenames = filesChanged.slice(0, 5).map(f => f.split(/[\\/]/).pop());

  // --- Process decisions (from event.category === 'decision') ---
  for (const text of decisions) {
    if (count >= MAX_EXPERIENCES_PER_SESSION) {
      log(`SKIP (decision): MAX_CAP reached (${count}/${MAX_EXPERIENCES_PER_SESSION})`);
      break;
    }
    if (text.length < MIN_DECISION_LENGTH) {
      log(`SKIP (decision): LENGTH ${text.length} < ${MIN_DECISION_LENGTH}: "${text.slice(0, 60)}"`);
      continue;
    }

    const firstLine = text.split('\n')[0].slice(0, 200);
    const title = firstLine.slice(0, 80);

    const dupMatch = findSemanticDuplicate(firstLine);
    if (dupMatch) {
      log(`SKIP (decision): DEDUP ${dupMatch.score} similar to ${dupMatch.path}: "${firstLine.slice(0, 60)}"`);
      continue;
    }

    const result = writeExperienceToDb({
      title,
      project,
      date: dateStr,
      subtype: 'decision',
      tags: tagStr,
      files: fileBasenames,
      trigger: firstLine,
      action: text.slice(0, 500).replace(/\n/g, ' '),
      context: 'Auto-extracted from decision event category.',
      outcome: 'Review and enrich with actual outcome.',
    });

    if (result.written) {
      experienceFiles.push({ slug: result.key, content: text });
      count++;
    }
  }

  // --- Process gotchas (from keyword matching) ---
  for (const text of gotchas) {
    if (count >= MAX_EXPERIENCES_PER_SESSION) {
      log(`SKIP (gotcha): MAX_CAP reached (${count}/${MAX_EXPERIENCES_PER_SESSION})`);
      break;
    }
    if (text.length < MIN_GOTCHA_LENGTH) {
      log(`SKIP (gotcha): LENGTH ${text.length} < ${MIN_GOTCHA_LENGTH}: "${text.slice(0, 60)}"`);
      continue;
    }

    const firstLine = text.split('\n')[0].slice(0, 200);
    const title = firstLine.slice(0, 80);

    const dupMatch = findSemanticDuplicate(firstLine);
    if (dupMatch) {
      log(`SKIP (gotcha): DEDUP ${dupMatch.score} similar to ${dupMatch.path}: "${firstLine.slice(0, 60)}"`);
      continue;
    }

    const result = writeExperienceToDb({
      title,
      project,
      date: dateStr,
      subtype: 'gotcha',
      tags: tagStr,
      files: fileBasenames,
      trigger: firstLine,
      action: text.slice(0, 500).replace(/\n/g, ' '),
      context: 'Auto-extracted from gotcha keyword match.',
      outcome: 'Review and enrich with the fix or workaround.',
    });

    if (result.written) {
      experienceFiles.push({ slug: result.key, content: text });
      count++;
    }
  }

  // --- Process conversation matches (new hybrid extraction) ---
  for (const match of conversationMatches) {
    if (count >= MAX_EXPERIENCES_PER_SESSION) {
      log(`SKIP (${match.subtype}): MAX_CAP reached (${count}/${MAX_EXPERIENCES_PER_SESSION})`);
      break;
    }
    if (match.text.length < MIN_DECISION_LENGTH) {
      log(`SKIP (${match.subtype}): LENGTH ${match.text.length} < ${MIN_DECISION_LENGTH}: "${match.text.slice(0, 60)}"`);
      continue;
    }

    const firstLine = match.text.split('\n')[0].slice(0, 200);
    const title = firstLine.slice(0, 80);

    const dupMatch = findSemanticDuplicate(firstLine);
    if (dupMatch) {
      log(`SKIP (${match.subtype}): DEDUP ${dupMatch.score} similar to ${dupMatch.path}: "${firstLine.slice(0, 60)}"`);
      continue;
    }

    // Check against already-extracted experiences this session (avoid dups within same run)
    const alreadyExtracted = experienceFiles.some(e =>
      e.content.slice(0, 80) === match.text.slice(0, 80)
    );
    if (alreadyExtracted) {
      log(`SKIP (${match.subtype}): INTRA_SESSION dup: "${firstLine.slice(0, 60)}"`);
      continue;
    }

    const contextStr = match.userPrompt
      ? `User asked: ${match.userPrompt}\n\nAgent response: ${match.text.slice(0, 1000)}`
      : match.text.slice(0, 1000);

    const result = writeExperienceToDb({
      title,
      project,
      date: dateStr,
      subtype: match.subtype,
      tags: tagStr,
      files: fileBasenames,
      trigger: `Matched pattern: ${match.matchedPattern}`,
      action: firstLine,
      context: contextStr,
      outcome: 'Auto-captured. Review and enrich with actual outcome.',
    });

    if (result.written) {
      experienceFiles.push({ slug: result.key, content: match.text });
      count++;
    }
  }

  log(`Extraction complete: ${count} experiences written (decisions=${decisions.length}, gotchas=${gotchas.length}, conversation=${conversationMatches.length})`);
}
```

- [ ] **Step 3: Commit**

```bash
git add scripts/vault-writer.mjs
git commit -m "feat: refactor extractStructuredExperiences with unified writer and filter logging"
```

---

### Task 6: Update `main()` to pass conversation matches and remove old Obsidian-first mirroring

**Files:**
- Modify: `scripts/vault-writer.mjs`

- [ ] **Step 1: Read vault-writer.mjs for editing context**

Read `scripts/vault-writer.mjs`.

- [ ] **Step 2: Update the `extractStructuredExperiences` call in `main()`**

Find the call at approximately line 282:
```javascript
  extractStructuredExperiences(decisions, gotchas, project, dateStr, mentions, experienceFiles, filesChanged);
```

Replace with:
```javascript
  extractStructuredExperiences(decisions, gotchas, conversationMatches, project, dateStr, mentions, experienceFiles, filesChanged);
```

- [ ] **Step 3: Remove the old Stage 2.5 mirror block**

Find and remove the block at approximately lines 285-289:
```javascript
  // --- Stage 2.5: Mirror experiences to Knowledge MCP (knowledge.db) ---
  if (experienceFiles.length > 0) {
    const expPaths = experienceFiles.map(e => join(EXPERIENCES_DIR, `${e.slug}.md`));
    mirrorToOpenBrain(expPaths);
  }
```

This is no longer needed — `writeExperienceToDb` handles both DB writes and Obsidian mirrors in one pass.

- [ ] **Step 4: Remove the old `mirrorToOpenBrain` function**

Find and remove the entire `mirrorToOpenBrain` function (approximately lines 476-545). It's replaced by `writeExperienceToDb` + `mirrorToObsidian`.

- [ ] **Step 5: Also remove the session markdown write to Obsidian Sessions/**

The spec says FTS5 is primary store, sessions no longer written to Obsidian. Find the session body template string (approximately lines 253-275) and the `writeIfNew` call that writes it. Replace with just a log line:

```javascript
  // Session data stays in knowledge.db (via auto-index.mjs) — no Obsidian session file
  log(`Session processed: ${sessionSlug} (prompts=${whatWasDone.length}, files=${filesChanged.length}, decisions=${decisions.length}, gotchas=${gotchas.length}, conversation=${conversationMatches.length})`);
```

Keep the `sessionSlug` construction — it's used in the log line and by Stage 4.

- [ ] **Step 6: Verify the `writeIfNew` import is still needed**

Check if `writeIfNew` is used anywhere else in vault-writer.mjs. If the session write was the only caller, it can be removed from the import. However, `backfillMirror` still uses Obsidian files so keep the import for now.

- [ ] **Step 7: Commit**

```bash
git add scripts/vault-writer.mjs
git commit -m "feat: wire conversation scanning into main(), remove old Obsidian-first mirroring"
```

---

### Task 7: Update `/end` skill format

**Files:**
- Modify: `C:/Users/melve/.claude/commands/end.md`

- [ ] **Step 1: Read end.md for editing context**

Read `C:/Users/melve/.claude/commands/end.md` lines 142-155.

- [ ] **Step 2: Update the experience format block**

Replace lines 143-155:
```
For anything the hooks would miss, use `kb_store` directly:
```
[EXPERIENCE] {short-title}
PROJECT: {project-name or "general"}
DOMAIN: {domain-tags}
DATE: {today's date}
TYPE: {gotcha | pattern | decision | fix | optimization}

TRIGGER: {when this is relevant}
ACTION: {what to do}
CONTEXT: {what was happening}
OUTCOME: {what happened}
```
```

With:
```
For anything the hooks would miss, use `kb_store` directly:
```
[EXPERIENCE] {short-title}
PROJECT: {project-name or "general"}
DOMAIN: {domain-tags}
DATE: {today's date}
TYPE: {gotcha | pattern | decision | planning | workaround | fix | optimization}
SOURCE: agent

TRIGGER: {when this is relevant}
ACTION: {what to do or what was decided}
CONTEXT: {the full exchange — what was the user asking, what reasoning led here}
OUTCOME: {what happened, what to do differently}
```
```

- [ ] **Step 3: Commit**

```bash
git add ~/.claude/commands/end.md
git commit -m "feat: update /end experience format with SOURCE field and expanded types"
```

---

### Task 8: Manual test — run vault-writer on a recent session

**Files:**
- No file changes — testing only

- [ ] **Step 1: Run vault-writer manually from the repo directory**

```bash
cd C:/Users/melve/.claude/knowledge-mcp && node scripts/vault-writer.mjs
```

- [ ] **Step 2: Check the log for extraction activity**

```bash
cat "C:/Users/melve/Obsidian Vault/Logs/vault-writer.log" | tail -30
```

Expected: Log lines showing SKIP reasons for filtered items and DB INSERT/MIRROR lines for extracted experiences. Every filtered item should have a SKIP log with the reason.

- [ ] **Step 3: Check knowledge.db for new unified-format entries**

```bash
cd C:/Users/melve/.claude/knowledge-mcp && node -e "
const D=require('better-sqlite3');
const db=new D(require('os').homedir()+'/.claude/context-mode/knowledge.db',{readonly:true});
const rows=db.prepare(\"SELECT key, substr(content,1,200) as preview FROM knowledge WHERE source='vault-writer' ORDER BY created_at DESC LIMIT 3\").all();
rows.forEach(r=>console.log(r.key, '|', r.preview));
db.close();
"
```

Expected: Entries starting with `[EXPERIENCE]` in structured text format.

- [ ] **Step 4: Check Obsidian mirror files**

```bash
ls -lt "C:/Users/melve/Obsidian Vault/Experiences/" | head -5
```

Expected: New `.md` files with YAML frontmatter matching the knowledge.db entries.

- [ ] **Step 5: Verify filter logging works**

Search the log for SKIP lines:
```bash
grep "SKIP" "C:/Users/melve/Obsidian Vault/Logs/vault-writer.log" | tail -10
```

Expected: Lines like `SKIP (decision): LENGTH 18 < 25: "short text"` showing the filter reason.

---

### Task 9: Copy updated scripts to installed location

**Files:**
- Copy: `scripts/vault-writer.mjs` → `~/.claude/knowledge-mcp/scripts/vault-writer.mjs`
- Copy: `scripts/vault-utils.mjs` → `~/.claude/knowledge-mcp/scripts/vault-utils.mjs`

- [ ] **Step 1: Copy both files**

```bash
cp scripts/vault-writer.mjs "$HOME/.claude/knowledge-mcp/scripts/vault-writer.mjs"
cp scripts/vault-utils.mjs "$HOME/.claude/knowledge-mcp/scripts/vault-utils.mjs"
```

- [ ] **Step 2: Verify the installed copies match**

```bash
diff scripts/vault-writer.mjs "$HOME/.claude/knowledge-mcp/scripts/vault-writer.mjs"
diff scripts/vault-utils.mjs "$HOME/.claude/knowledge-mcp/scripts/vault-utils.mjs"
```

Expected: No output (files are identical).

- [ ] **Step 3: Commit all changes with version bump**

```bash
git add scripts/vault-writer.mjs scripts/vault-utils.mjs docs/
git commit -m "feat: v0.3.1 — widen extraction patterns, unified experience format, SQLite-first data flow

- Widen extraction: planning, architecture, workaround, root cause patterns
- Unified format: structured text for FTS5, YAML frontmatter for Obsidian
- SQLite-first: write to knowledge.db, generate Obsidian mirrors
- Filter logging: every SKIP logged with reason (LENGTH, DEDUP, MAX_CAP)
- Lower MIN_LENGTH threshold from 40 to 25 chars
- Fix log path: vault-writer.log now in Logs/ not vault root"
```

---

### Task 10: Update SUMMARY.md and INBOX.md

**Files:**
- Modify: `.agents/SYSTEM/SUMMARY.md`
- Modify: `.agents/TASKS/INBOX.md`

- [ ] **Step 1: Update SUMMARY.md**

Update the "What's working" section to reflect the new extraction patterns and unified format. Remove the `recall_count` tracking claim (it's not in the schema). Update "What's next" to remove the completed P1 item.

- [ ] **Step 2: Update INBOX.md**

Mark "Widen vault-writer extraction patterns" as `[x]` done. Add a new P2 item: "Monitor extraction quality — review Obsidian Experiences/ after 5 sessions, adjust MIN_LENGTH and patterns."

- [ ] **Step 3: Commit**

```bash
git add .agents/
git commit -m "docs: update SUMMARY and INBOX for v0.3.1 extraction improvements"
```
