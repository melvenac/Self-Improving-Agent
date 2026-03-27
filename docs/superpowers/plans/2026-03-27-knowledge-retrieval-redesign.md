# Knowledge Retrieval Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Improve knowledge retrieval quality by adding recency weighting, structured experience format, session quality gate, and removing Smart Connections from agent retrieval.

**Architecture:** Four phases executed in order. Phase 1 (quick wins) touches Knowledge MCP SQL and vault-writer tags. Phase 2 (structured experiences) rewrites vault-writer output format and adds a quality gate. Phase 3 (unified retrieval) simplifies /start. Phase 4 (aging) adds session summarization.

**Tech Stack:** TypeScript (Knowledge MCP server), JavaScript/ESM (vault-writer hooks), SQLite FTS5, Markdown (slash commands)

---

## Phase 1: Quick Wins

### Task 1: Add Recency Weighting to kb_recall Chunks Query

**Files:**
- Modify: `knowledge-mcp/src/db.ts:244-284` (chunks search in `recall()`)

- [ ] **Step 1: Modify chunks ORDER BY to include time decay**

In `knowledge-mcp/src/db.ts`, in the `recall()` function, replace the chunks query ORDER BY clause. Change:

```typescript
    sql += ` ORDER BY bm25(chunks_fts) LIMIT ?`;
```

To:

```typescript
    sql += ` ORDER BY (bm25(chunks_fts) * (1.0 / (1.0 + (julianday('now') - julianday(c.created_at)) * 0.02))) LIMIT ?`;
```

This applies a time-decay multiplier: yesterday = 0.98x, 7 days = 0.88x, 30 days = 0.63x, 90 days = 0.36x. Note: `bm25()` returns negative values (closer to 0 = better match), so the multiplication preserves the ranking direction correctly.

- [ ] **Step 2: Verify bm25 sign behavior**

BM25 in SQLite FTS5 returns negative values (more negative = better match). Multiplying by a positive decay factor (0-1) makes the value less negative (closer to 0), which would actually hurt recent results. We need to handle this:

```typescript
    sql += ` ORDER BY (bm25(chunks_fts) / (1.0 + (julianday('now') - julianday(c.created_at)) * 0.02)) LIMIT ?`;
```

Division instead of multiplication: dividing a negative BM25 score by a number < 1 makes it MORE negative (better rank). Recent results get divided by ~1.0 (unchanged), old results get divided by ~2.8 (boosted less).

- [ ] **Step 3: Commit**

```bash
cd knowledge-mcp
git add src/db.ts
git commit -m "feat: add recency weighting to kb_recall chunks query"
```

### Task 2: Add Recency Weighting to kb_recall Knowledge Query

**Files:**
- Modify: `knowledge-mcp/src/db.ts:326-349` (knowledge search in `recall()`)

- [ ] **Step 1: Modify knowledge ORDER BY with slower decay**

Knowledge entries are curated — they should decay slower (0.005 instead of 0.02). Change:

```typescript
    knowledgeSql += ` ORDER BY bm25(knowledge_fts) LIMIT ?`;
```

To:

```typescript
    knowledgeSql += ` ORDER BY (bm25(knowledge_fts) / (1.0 + (julianday('now') - julianday(k.created_at)) * 0.005)) LIMIT ?`;
```

This means knowledge decays 4x slower: 30 days = 0.87x, 90 days = 0.69x.

- [ ] **Step 2: Commit**

```bash
git add src/db.ts
git commit -m "feat: add recency weighting to kb_recall knowledge query"
```

### Task 3: Add Recency Weighting to kb_recall Summaries Query

**Files:**
- Modify: `knowledge-mcp/src/db.ts:382-409` (summaries search in `recall()`)

- [ ] **Step 1: Modify summaries ORDER BY**

Change:

```typescript
          ORDER BY bm25(summaries_fts)
```

To:

```typescript
          ORDER BY (bm25(summaries_fts) / (1.0 + (julianday('now') - julianday(sm.created_at)) * 0.02))
```

- [ ] **Step 2: Commit**

```bash
git add src/db.ts
git commit -m "feat: add recency weighting to kb_recall summaries query"
```

### Task 4: Replace Type-Based Sort with Unified Recency-Weighted Sort

**Files:**
- Modify: `knowledge-mcp/src/db.ts:430-435` (final sort in `recall()`)

- [ ] **Step 1: Return weighted_rank from each query**

Each of the three queries now uses a recency-weighted ORDER BY, but the final sort still uses type-based ordering. We need to expose the weighted rank and sort by it globally.

Add `weighted_rank` to the SELECT and `RecallResult` interface:

In the `RecallResult` interface (line 204), add:

```typescript
export interface RecallResult {
  source: string;
  category: string;
  snippet: string;
  content: string;
  session_started: string;
  project_dir: string | null;
  created_at: string;
  tags: string[];
  result_type: "chunk" | "knowledge" | "summary";
  weighted_rank: number;
}
```

- [ ] **Step 2: Add weighted_rank to chunks SELECT**

Change the chunks SQL SELECT to include the weighted rank as a column:

```typescript
    let sql = `
      SELECT
        c.id as chunk_id,
        c.source,
        c.category,
        snippet(chunks_fts, 2, '>>', '<<', '...', 128) as snippet,
        c.content,
        s.started_at as session_started,
        s.project_dir,
        c.created_at,
        (bm25(chunks_fts) / (1.0 + (julianday('now') - julianday(c.created_at)) * 0.02)) as weighted_rank
      FROM chunks_fts
      JOIN chunks c ON c.id = chunks_fts.rowid
      JOIN sessions s ON s.id = c.session_id
      WHERE chunks_fts MATCH ?
    `;
```

Update the ORDER BY to use the alias:

```typescript
    sql += ` ORDER BY weighted_rank LIMIT ?`;
```

Add `weighted_rank: number` to the row type and push it into results:

```typescript
      results.push({
        ...existingFields,
        weighted_rank: row.weighted_rank,
      });
```

- [ ] **Step 3: Add weighted_rank to knowledge SELECT**

Same pattern — add the column to the SELECT:

```typescript
        (bm25(knowledge_fts) / (1.0 + (julianday('now') - julianday(k.created_at)) * 0.005)) as weighted_rank
```

Update ORDER BY:

```typescript
    knowledgeSql += ` ORDER BY weighted_rank LIMIT ?`;
```

Push `weighted_rank` into results.

- [ ] **Step 4: Add weighted_rank to summaries SELECT**

```typescript
            (bm25(summaries_fts) / (1.0 + (julianday('now') - julianday(sm.created_at)) * 0.02)) as weighted_rank
```

Update ORDER BY and push into results.

- [ ] **Step 5: Replace type-based sort with weighted_rank sort**

Replace the final sort (lines 430-434):

```typescript
  // Sort all results by weighted rank (more negative = better match)
  results.sort((a, b) => a.weighted_rank - b.weighted_rank);
```

- [ ] **Step 6: Commit**

```bash
git add src/db.ts
git commit -m "feat: unified recency-weighted ranking across all result types"
```

### Task 5: Add File-Touch Tagging to Vault-Writer Experiences

**Files:**
- Modify: `scripts/vault-writer.mjs:336-436` (`extractStructuredExperiences()`)

- [ ] **Step 1: Pass filesChanged into extractStructuredExperiences**

Change the function call at line 275:

```javascript
  extractStructuredExperiences(decisions, gotchas, project, dateStr, mentions, experienceFiles);
```

To:

```javascript
  extractStructuredExperiences(decisions, gotchas, project, dateStr, mentions, experienceFiles, filesChanged);
```

- [ ] **Step 2: Update function signature and add file tags**

Change the function signature at line 336:

```javascript
function extractStructuredExperiences(decisions, gotchas, project, dateStr, topics, experienceFiles, filesChanged = []) {
```

After line 337 (`let count = 0;`), add file tag extraction:

```javascript
  // Extract basenames from file paths for tagging
  const fileTags = [...new Set(
    filesChanged
      .map(f => f.split(/[\\/]/).pop())  // basename
      .filter(f => f && !f.startsWith('.'))
      .map(f => f.toLowerCase())
  )].slice(0, 10);  // cap at 10 file tags
```

- [ ] **Step 3: Include file tags in experience frontmatter**

In both the decision template (line 348) and gotcha template (line 404), change the tags line:

```javascript
tags: [${topics.join(', ')}]
```

To:

```javascript
tags: [${[...topics, ...fileTags].join(', ')}]
```

- [ ] **Step 4: Commit**

```bash
git add scripts/vault-writer.mjs
git commit -m "feat: add file-touch tags to auto-extracted experiences"
```

### Task 6: Remove Smart Connections from /start Federated Search

**Files:**
- Modify: `commands/start.md` (Part B3 federated search section)

- [ ] **Step 1: Read current start.md**

Read `commands/start.md` to find the Part B3 federated search section.

- [ ] **Step 2: Remove Smart Connections call**

In Part B3, remove the `mcp__smart-connections__lookup` instruction. Keep only `kb_recall` as the retrieval path.

Change the section from running searches in parallel (kb_recall + Smart Connections + fallback) to just:

```markdown
### B3. Knowledge recall
- **Knowledge MCP:** `kb_recall(queries: [Q1, Q2], project: cwd, limit: 5)` — methodology-focused queries, not file-specific
- Smart Connections is no longer used for agent retrieval (kept for personal Obsidian browsing only)
```

- [ ] **Step 3: Update B5 dedup section**

Since there's only one source now, simplify the dedup step:

```markdown
### B5. Rewrite for today's task
- Rewrite each experience as **directly actionable** guidance for today's context
- Drop anything that matched by keyword but isn't actually useful
- Surface max **3 experiences** + **2 skills** as non-prescriptive context
```

Remove any mention of "prefer Obsidian version if duplicates" since we're no longer searching both.

- [ ] **Step 4: Commit**

```bash
git add commands/start.md
git commit -m "feat: remove Smart Connections from agent retrieval, use kb_recall only"
```

### Task 7: Build and Deploy Knowledge MCP Changes

**Files:**
- Build: `knowledge-mcp/`

- [ ] **Step 1: Build the Knowledge MCP server**

```bash
cd knowledge-mcp && npm run build
```

Expected: Clean build with no errors.

- [ ] **Step 2: Copy updated vault-writer to installed location**

```bash
cp scripts/vault-writer.mjs ~/.claude/knowledge-mcp/scripts/vault-writer.mjs
```

- [ ] **Step 3: Verify kb_recall still works**

Test by running a kb_recall query in the next session or via:

```bash
claude --print "Run kb_recall with queries ['vault-writer'] and report the results"
```

- [ ] **Step 4: Commit and tag Phase 1**

```bash
git add -A
git commit -m "chore: Phase 1 complete — recency weighting, file tags, SC removal"
```

---

## Phase 2: Structured Experiences

### Task 8: Add Session Quality Gate to Vault-Writer

**Files:**
- Modify: `scripts/vault-writer.mjs:228-233` (existing `hasContent` check)

- [ ] **Step 1: Replace minimal hasContent check with quality gate**

Replace the current check (lines 228-233):

```javascript
  const hasContent = whatWasDone.length > 0 || filesChanged.length > 0 || decisions.length > 0 || gotchas.length > 0;
  if (!hasContent) {
    log('Session had no meaningful content (only system noise) — skipping vault write');
    return;
  }
```

With a substantive quality gate:

```javascript
  // Quality gate: skip sessions that don't meet minimum substance thresholds
  const meaningfulPrompts = whatWasDone.filter(line => line.length > 22); // "- " + 20 chars
  const totalTextLength = allText.trim().length;

  const passesQualityGate = (
    (meaningfulPrompts.length >= 3) ||
    (filesChanged.length >= 1 && meaningfulPrompts.length >= 1) ||
    (decisions.length >= 1) ||
    (gotchas.length >= 1)
  ) && totalTextLength > 200;

  if (!passesQualityGate) {
    log(`SKIP: session too thin (prompts=${meaningfulPrompts.length}, files=${filesChanged.length}, decisions=${decisions.length}, gotchas=${gotchas.length}, text=${totalTextLength}chars)`);
    return;
  }
```

- [ ] **Step 2: Commit**

```bash
git add scripts/vault-writer.mjs
git commit -m "feat: add session quality gate — skip thin sessions"
```

### Task 9: New Structured Experience Format

**Files:**
- Modify: `scripts/vault-writer.mjs:336-436` (`extractStructuredExperiences()`)

- [ ] **Step 1: Rewrite decision experience template**

Replace the decision template (lines 348-370) with structured tuple format:

```javascript
    const content = `---
date: ${dateStr}
project: ${project}
type: experience
subtype: decision
tags: [${[...topics, ...fileTags].join(', ')}]
files: [${filesChanged.slice(0, 5).map(f => f.split(/[\\/]/).pop()).join(', ')}]
outcome: unknown
source: auto-extracted
---

situation: "${firstLine.replace(/"/g, '\\"')}"

action: "${text.slice(0, 500).replace(/"/g, '\\"').replace(/\n/g, ' ')}"

outcome_detail: "Auto-captured. Review and enrich with actual outcome."

learned: "Auto-captured. Add the key takeaway from this decision."
`;
```

- [ ] **Step 2: Rewrite gotcha experience template**

Replace the gotcha template (lines 404-435) with the same structured format but `subtype: gotcha`:

```javascript
    const content = `---
date: ${dateStr}
project: ${project}
type: experience
subtype: gotcha
tags: [${[...topics, ...fileTags].join(', ')}]
files: [${filesChanged.slice(0, 5).map(f => f.split(/[\\/]/).pop()).join(', ')}]
outcome: failure
source: auto-extracted
---

situation: "${firstLine.replace(/"/g, '\\"')}"

action: "${text.slice(0, 500).replace(/"/g, '\\"').replace(/\n/g, ' ')}"

outcome_detail: "Auto-captured. Review and enrich with the fix or workaround."

learned: "Auto-captured. Add what to do differently next time."
`;
```

- [ ] **Step 3: Commit**

```bash
git add scripts/vault-writer.mjs
git commit -m "feat: structured experience format — situation/action/outcome tuples"
```

### Task 10: Stop Writing Sessions to Obsidian Vault

**Files:**
- Modify: `scripts/vault-writer.mjs:152-306` (`main()` function)

- [ ] **Step 1: Remove session markdown write**

In the `main()` function, remove the session file write (lines 268-270):

```javascript
  const sessionFile = join(SESSIONS_DIR, `${sessionSlug}.md`);
  const wrote = writeIfNew(sessionFile, sessionBody);
  if (wrote) log(`Wrote session log: ${sessionFile}`);
```

Replace with a log-only entry:

```javascript
  log(`Session processed: ${sessionSlug} (prompts=${whatWasDone.length}, files=${filesChanged.length}, decisions=${decisions.length}, gotchas=${gotchas.length})`);
```

- [ ] **Step 2: Remove session topic linking**

Remove lines 285-288 (linking session file to topics):

```javascript
  // --- Stage 3: Topic Linking ---
  // Link session file to topics
  for (const topicName of mentions) {
    linkToTopic(topicName, sessionSlug);
  }
```

Keep the experience topic linking (lines 290-296) — experiences still get vault markdown for QC.

- [ ] **Step 3: Remove SESSIONS_DIR from vault-utils.mjs exports if no longer used**

Check if anything else imports `SESSIONS_DIR`. If only vault-writer used it for session writes, it can stay (backfillSessions still references it for checking already-captured files).

Actually, `backfillSessions()` in vault-writer.mjs still reads `SESSIONS_DIR` to check `alreadyCaptured`. Keep the export but add a comment:

```javascript
// SESSIONS_DIR is used by backfillSessions() to check already-captured sessions (legacy)
```

- [ ] **Step 4: Commit**

```bash
git add scripts/vault-writer.mjs scripts/vault-utils.mjs
git commit -m "feat: stop writing sessions to Obsidian vault — FTS5 is primary store"
```

### Task 11: Update Mirror to Use Structured Format

**Files:**
- Modify: `scripts/vault-writer.mjs:474-535` (`mirrorToOpenBrain()`)

- [ ] **Step 1: Update mirror to handle new YAML frontmatter fields**

The mirror function parses frontmatter and sends `body` to Knowledge MCP. With the new structured format, the body now contains `situation:`, `action:`, `outcome_detail:`, `learned:` fields. The mirror should include frontmatter metadata (subtype, files, outcome) in the tags string for better retrieval.

After line 513 (`const tagStr = ...`), add:

```javascript
      // Include structured metadata in tags for better FTS5 retrieval
      const subtype = frontmatter.subtype || '';
      const outcome = frontmatter.outcome || '';
      const files = Array.isArray(frontmatter.files)
        ? frontmatter.files.join(', ')
        : (frontmatter.files || '');
      const enrichedTagStr = [tagStr, subtype, outcome, files].filter(Boolean).join(', ');
```

Then use `enrichedTagStr` instead of `tagStr` in the INSERT/UPDATE calls.

- [ ] **Step 2: Commit**

```bash
git add scripts/vault-writer.mjs
git commit -m "feat: mirror structured metadata to Knowledge MCP tags"
```

### Task 12: Build, Deploy, and Test Phase 2

**Files:**
- Build: `knowledge-mcp/`, `scripts/`

- [ ] **Step 1: Copy updated vault-writer to installed location**

```bash
cp scripts/vault-writer.mjs ~/.claude/knowledge-mcp/scripts/vault-writer.mjs
cp scripts/vault-utils.mjs ~/.claude/knowledge-mcp/scripts/vault-utils.mjs
```

- [ ] **Step 2: Test quality gate by checking vault-writer log after next session**

After completing a session, check:

```bash
tail -20 ~/Obsidian\ Vault/.vault-writer.log
```

Verify thin sessions show `SKIP: session too thin` and substantive sessions get processed.

- [ ] **Step 3: Verify no new session files appear in Obsidian Sessions/**

```bash
ls -lt ~/Obsidian\ Vault/Sessions/ | head -5
```

No new files should appear after the change. Experiences/ should still get new files.

- [ ] **Step 4: Commit and tag Phase 2**

```bash
git add -A
git commit -m "chore: Phase 2 complete — structured experiences, quality gate, no vault sessions"
```

---

## Phase 3: Unified Retrieval

### Task 13: Simplify /start to Single Retrieval Path

**Files:**
- Modify: `commands/start.md`

- [ ] **Step 1: Rewrite Part B3 as single kb_recall call**

Replace the federated search section with:

```markdown
### B3. Knowledge recall (single path)
- **Knowledge MCP:** `kb_recall(queries: [Q1, Q2], project: cwd, limit: 5)`
- Results are now recency-weighted — recent experiences rank higher automatically
- If results < 3 for project scope, broaden: `kb_recall(queries: [Q1, Q2], global: true, limit: 5)`
```

- [ ] **Step 2: Remove fallback grep over Obsidian vault**

Remove the line:
```markdown
- **Fallback:** If Smart Connections errors, `grep -rl` over `~/Obsidian Vault/Experiences/`
```

This is no longer needed — kb_recall is the single retrieval path.

- [ ] **Step 3: Commit**

```bash
git add commands/start.md
git commit -m "feat: /start uses single kb_recall retrieval path with auto-broadening"
```

---

## Phase 4: Aging Pipeline

### Task 14: Add Recall Count Tracking

**Files:**
- Modify: `knowledge-mcp/src/db.ts` (migration + recall function)

- [ ] **Step 1: Add migration for recall_count and last_recalled columns**

In `runMigrations()`, add:

```typescript
  // Migration: add recall tracking to knowledge
  try {
    db.exec("ALTER TABLE knowledge ADD COLUMN recall_count INTEGER DEFAULT 0");
  } catch {
    // Column already exists — ignore
  }
  try {
    db.exec("ALTER TABLE knowledge ADD COLUMN last_recalled TEXT");
  } catch {
    // Column already exists — ignore
  }
```

- [ ] **Step 2: Increment recall_count on knowledge results**

At the end of the knowledge search section in `recall()`, after collecting results, add:

```typescript
    // Track recall hits for knowledge entries
    if (kRows.length > 0) {
      const updateRecall = db.prepare(
        "UPDATE knowledge SET recall_count = recall_count + 1, last_recalled = datetime('now') WHERE id = ?"
      );
      for (const row of kRows) {
        updateRecall.run(row.id);
      }
    }
```

- [ ] **Step 3: Commit**

```bash
cd knowledge-mcp
git add src/db.ts
git commit -m "feat: track recall counts on knowledge entries"
```

### Task 15: Add Session Summarization Helpers

**Files:**
- Modify: `knowledge-mcp/src/db.ts` (new functions)

- [ ] **Step 1: Add function to find sessions needing summarization**

Add after `getUnsummarizedSessionIds()`:

```typescript
export function getAgingSessions(olderThanDays: number = 7): Array<{
  id: string;
  project_dir: string | null;
  started_at: string;
  chunk_count: number;
}> {
  const db = getKnowledgeDb();
  return db.prepare(`
    SELECT s.id, s.project_dir, s.started_at,
           (SELECT COUNT(*) FROM chunks WHERE session_id = s.id) as chunk_count
    FROM sessions s
    LEFT JOIN summaries sm ON sm.session_id = s.id
    WHERE sm.id IS NULL
    AND julianday('now') - julianday(s.started_at) > ?
    AND s.event_count >= 3
    ORDER BY s.started_at ASC
    LIMIT 10
  `).all(olderThanDays) as Array<{
    id: string;
    project_dir: string | null;
    started_at: string;
    chunk_count: number;
  }>;
}
```

- [ ] **Step 2: Add function to prune raw chunks after summarization**

```typescript
export function pruneChunksForSummarizedSessions(olderThanDays: number = 30): number {
  const db = getKnowledgeDb();
  const result = db.prepare(`
    DELETE FROM chunks
    WHERE session_id IN (
      SELECT s.id FROM sessions s
      JOIN summaries sm ON sm.session_id = s.id
      WHERE julianday('now') - julianday(s.started_at) > ?
    )
  `).run(olderThanDays);
  return result.changes;
}
```

- [ ] **Step 3: Commit**

```bash
git add src/db.ts
git commit -m "feat: add aging session helpers for summarization pipeline"
```

### Task 16: Build, Deploy, and Final Tag

- [ ] **Step 1: Build Knowledge MCP**

```bash
cd knowledge-mcp && npm run build
```

- [ ] **Step 2: Copy all scripts to installed location**

```bash
cp scripts/vault-writer.mjs ~/.claude/knowledge-mcp/scripts/vault-writer.mjs
cp scripts/vault-utils.mjs ~/.claude/knowledge-mcp/scripts/vault-utils.mjs
```

- [ ] **Step 3: Update CHANGELOG.md**

Add entry for v0.3.0:

```markdown
## [v0.3.0] - 2026-03-27

Knowledge retrieval redesign: recency weighting, structured experiences, quality gate.

### Added
- Recency-weighted ranking in kb_recall — recent results rank higher via time-decay on BM25 scores
- File-touch tagging — experiences include basenames of modified files as tags
- Session quality gate — vault-writer skips sessions below substance thresholds
- Structured experience format — situation/action/outcome tuples replace prose templates
- Recall count tracking on knowledge entries
- Aging session helpers for future summarization pipeline

### Changed
- kb_recall uses unified recency-weighted sort instead of type-based ordering
- Vault-writer no longer writes session files to Obsidian vault (FTS5 is primary store)
- /start uses single kb_recall retrieval path (Smart Connections removed from agent retrieval)
- Experience mirror includes structured metadata (subtype, files, outcome) in FTS5 tags

### Removed
- Smart Connections from /start federated search (kept for personal Obsidian browsing)
- Session markdown files no longer written to Obsidian Sessions/ directory
```

- [ ] **Step 4: Bump package.json to v0.3.0**

```json
"version": "0.3.0"
```

- [ ] **Step 5: Update SUMMARY.md and INBOX.md**

Update `.agents/SYSTEM/SUMMARY.md` current state to reflect v0.3.0 changes.
Mark relevant INBOX items as done.

- [ ] **Step 6: Final commit and tag**

```bash
git add -A
git commit -m "feat: v0.3.0 — knowledge retrieval redesign"
git tag -a v0.3.0 -m "Knowledge retrieval redesign: recency weighting, structured experiences, quality gate"
git push origin master --tags
```
