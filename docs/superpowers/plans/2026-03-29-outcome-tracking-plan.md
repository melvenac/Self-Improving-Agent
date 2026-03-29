# Outcome Tracking + Skill Lifecycle Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add outcome tracking (helpful/neutral/harmful feedback) and skill lifecycle (progenitor/proven/mature/apoptosis) to the Knowledge MCP server.

**Architecture:** Five new columns on the existing `knowledge` table, a new `kb_feedback` MCP tool, lifecycle evaluation logic in a new `lifecycle.ts` module, maturity boost in `kb_recall` ranking, and session-scoped recall tracking for `/end` integration.

**Tech Stack:** TypeScript, better-sqlite3, @modelcontextprotocol/sdk, zod

---

## File Structure

| File | Responsibility |
|---|---|
| `knowledge-mcp/src/lifecycle.ts` | **NEW** — lifecycle config, evaluate transitions, maturity boost calculator |
| `knowledge-mcp/src/db.ts` | Add migration, `recordFeedback()`, `getKnowledgeById()`, `getRecalledIds()` helpers, modify recall to track IDs |
| `knowledge-mcp/src/server.ts` | Add `kb_feedback` tool, modify `kb_recall` to apply maturity boost + track IDs, add maturity to `kb_list` and `kb_stats` |

---

### Task 1: Add Schema Migration

**Files:**
- Modify: `knowledge-mcp/src/db.ts:185-211` (inside `runMigrations`)

- [ ] **Step 1: Add the 5 new column migrations to `runMigrations`**

In `knowledge-mcp/src/db.ts`, add these migrations after the existing `last_recalled` migration (after line 209):

```typescript
  // Migration: add outcome tracking columns to knowledge
  try {
    db.exec("ALTER TABLE knowledge ADD COLUMN helpful_count INTEGER NOT NULL DEFAULT 0");
  } catch {
    // Column already exists — ignore
  }
  try {
    db.exec("ALTER TABLE knowledge ADD COLUMN harmful_count INTEGER NOT NULL DEFAULT 0");
  } catch {
    // Column already exists — ignore
  }
  try {
    db.exec("ALTER TABLE knowledge ADD COLUMN neutral_count INTEGER NOT NULL DEFAULT 0");
  } catch {
    // Column already exists — ignore
  }
  try {
    db.exec("ALTER TABLE knowledge ADD COLUMN success_rate REAL DEFAULT NULL");
  } catch {
    // Column already exists — ignore
  }
  try {
    db.exec("ALTER TABLE knowledge ADD COLUMN maturity TEXT NOT NULL DEFAULT 'progenitor'");
  } catch {
    // Column already exists — ignore
  }
```

- [ ] **Step 2: Build and verify migration runs cleanly**

Run:
```bash
cd knowledge-mcp && npm run build && node -e "require('./build/db.js').getKnowledgeDb()"
```
Expected: No errors. The migration adds columns to existing DB without data loss.

- [ ] **Step 3: Verify columns exist in the database**

Run:
```bash
cd knowledge-mcp && node -e "const db = require('./build/db.js').getKnowledgeDb(); const row = db.prepare('SELECT helpful_count, harmful_count, neutral_count, success_rate, maturity FROM knowledge LIMIT 1').get(); console.log('Migration OK — columns exist'); if(row) console.log(row);"
```
Expected: "Migration OK — columns exist" and existing rows show defaults (0, 0, 0, null, 'progenitor').

- [ ] **Step 4: Commit**

```bash
git add knowledge-mcp/src/db.ts
git commit -m "feat(knowledge-mcp): add outcome tracking schema migration

Adds 5 columns to knowledge table: helpful_count, harmful_count,
neutral_count, success_rate, maturity. Safe ALTER TABLE migrations
that skip if columns already exist."
```

---

### Task 2: Create Lifecycle Engine

**Files:**
- Create: `knowledge-mcp/src/lifecycle.ts`

- [ ] **Step 1: Create the lifecycle module**

Create `knowledge-mcp/src/lifecycle.ts`:

```typescript
// Lifecycle engine — evaluates maturity transitions and apoptosis
// Adapted from STEM Agent thresholds for session-based cadence

export const LIFECYCLE_CONFIG = {
  /** Minimum non-neutral ratings before judging */
  apoptosisMinActivations: 5,
  /** Success rate below this = apoptosis candidate */
  apoptosisThreshold: 0.3,
  /** Helpful ratings needed for progenitor → proven */
  provenMinHelpful: 3,
  /** Helpful ratings needed for proven → mature */
  matureMinHelpful: 7,
  /** Minimum success rate to advance maturity */
  advanceMinSuccessRate: 0.5,
} as const;

export type Maturity = "progenitor" | "proven" | "mature";
export type Rating = "helpful" | "harmful" | "neutral";

export interface FeedbackEntry {
  id: number;
  helpful_count: number;
  harmful_count: number;
  neutral_count: number;
  success_rate: number | null;
  maturity: Maturity;
  source: string;
}

export interface LifecycleResult {
  newSuccessRate: number | null;
  newMaturity: Maturity;
  apoptosis: boolean;
  /** true = auto-delete, false = flag for approval */
  autoDelete: boolean;
  transitionMessage: string | null;
}

export function evaluateLifecycle(
  entry: FeedbackEntry,
  rating: Rating,
): LifecycleResult {
  // Increment counts
  const helpful = entry.helpful_count + (rating === "helpful" ? 1 : 0);
  const harmful = entry.harmful_count + (rating === "harmful" ? 1 : 0);
  const neutral = entry.neutral_count + (rating === "neutral" ? 1 : 0);
  const nonNeutral = helpful + harmful;

  // Recalculate success rate (null if only neutral ratings)
  const newSuccessRate = nonNeutral > 0 ? helpful / nonNeutral : null;

  // Check apoptosis
  const apoptosis =
    nonNeutral >= LIFECYCLE_CONFIG.apoptosisMinActivations &&
    newSuccessRate !== null &&
    newSuccessRate < LIFECYCLE_CONFIG.apoptosisThreshold;

  const autoDelete = apoptosis && entry.source !== "manual";

  // Evaluate maturity advancement (only if not being pruned)
  let newMaturity = entry.maturity;
  let transitionMessage: string | null = null;

  if (apoptosis) {
    if (autoDelete) {
      transitionMessage = `Apoptosis: auto-pruned (${helpful} helpful, ${harmful} harmful, rate ${newSuccessRate!.toFixed(2)}, source: ${entry.source})`;
    } else {
      transitionMessage = `Apoptosis candidate: flagged for review (${helpful} helpful, ${harmful} harmful, rate ${newSuccessRate!.toFixed(2)}, source: manual)`;
    }
  } else if (newSuccessRate !== null && newSuccessRate >= LIFECYCLE_CONFIG.advanceMinSuccessRate) {
    if (entry.maturity === "progenitor" && helpful >= LIFECYCLE_CONFIG.provenMinHelpful) {
      newMaturity = "proven";
      transitionMessage = `Promoted: progenitor → proven (${helpful} helpful, rate ${newSuccessRate.toFixed(2)})`;
    } else if (entry.maturity === "proven" && helpful >= LIFECYCLE_CONFIG.matureMinHelpful) {
      newMaturity = "mature";
      transitionMessage = `Promoted: proven → mature (${helpful} helpful, rate ${newSuccessRate.toFixed(2)})`;
    }
  }

  return { newSuccessRate, newMaturity, apoptosis, autoDelete, transitionMessage };
}

/**
 * Maturity boost multiplier for kb_recall ranking.
 * Applied to BM25 weighted_rank (lower = better match, so we divide by boost).
 */
export function maturityBoost(maturity: Maturity, successRate: number | null): number {
  let boost = 1.0;
  if (maturity === "mature") boost = 1.5;
  else if (maturity === "proven") boost = 1.2;

  // Penalty for low success rate (but not yet at apoptosis)
  if (successRate !== null && successRate < LIFECYCLE_CONFIG.apoptosisThreshold) {
    boost *= 0.5;
  }

  return boost;
}
```

- [ ] **Step 2: Build to verify no type errors**

Run:
```bash
cd knowledge-mcp && npm run build
```
Expected: Clean build with no errors.

- [ ] **Step 3: Commit**

```bash
git add knowledge-mcp/src/lifecycle.ts
git commit -m "feat(knowledge-mcp): add lifecycle engine

Evaluates maturity transitions (progenitor → proven → mature) and
apoptosis (auto-prune non-manual entries below 0.3 success rate).
Adapted from STEM Agent thresholds for session-based cadence."
```

---

### Task 3: Add DB Helpers for Feedback

**Files:**
- Modify: `knowledge-mcp/src/db.ts:650-670` (knowledge section)

- [ ] **Step 1: Add `getKnowledgeById` function**

Add after the `deleteKnowledge` function (after line 687) in `knowledge-mcp/src/db.ts`:

```typescript
export function getKnowledgeById(id: number): {
  id: number;
  key: string | null;
  content: string;
  tags: string | null;
  source: string;
  helpful_count: number;
  harmful_count: number;
  neutral_count: number;
  success_rate: number | null;
  maturity: string;
} | undefined {
  const db = getKnowledgeDb();
  return db
    .prepare(
      "SELECT id, key, content, tags, source, helpful_count, harmful_count, neutral_count, success_rate, maturity FROM knowledge WHERE id = ?"
    )
    .get(id) as {
    id: number;
    key: string | null;
    content: string;
    tags: string | null;
    source: string;
    helpful_count: number;
    harmful_count: number;
    neutral_count: number;
    success_rate: number | null;
    maturity: string;
  } | undefined;
}
```

- [ ] **Step 2: Add `recordFeedback` function**

Add immediately after `getKnowledgeById`:

```typescript
export function recordFeedback(
  id: number,
  rating: "helpful" | "harmful" | "neutral",
  newSuccessRate: number | null,
  newMaturity: string,
): void {
  const db = getKnowledgeDb();
  const col =
    rating === "helpful" ? "helpful_count"
    : rating === "harmful" ? "harmful_count"
    : "neutral_count";

  db.prepare(
    `UPDATE knowledge
     SET ${col} = ${col} + 1,
         success_rate = ?,
         maturity = ?,
         updated_at = datetime('now')
     WHERE id = ?`
  ).run(newSuccessRate, newMaturity, id);
}
```

- [ ] **Step 3: Add `deleteKnowledgeById` function for apoptosis**

Add immediately after `recordFeedback`:

```typescript
export function deleteKnowledgeById(id: number): boolean {
  const db = getKnowledgeDb();
  const result = db.prepare("DELETE FROM knowledge WHERE id = ?").run(id);
  return result.changes > 0;
}
```

- [ ] **Step 4: Build to verify**

Run:
```bash
cd knowledge-mcp && npm run build
```
Expected: Clean build.

- [ ] **Step 5: Commit**

```bash
git add knowledge-mcp/src/db.ts
git commit -m "feat(knowledge-mcp): add feedback DB helpers

getKnowledgeById, recordFeedback, deleteKnowledgeById — support
for outcome tracking and apoptosis."
```

---

### Task 4: Add Session-Scoped Recall Tracking

**Files:**
- Modify: `knowledge-mcp/src/db.ts:342-413` (knowledge search section in `recall`)
- Modify: `knowledge-mcp/src/server.ts:1-16` (imports)

- [ ] **Step 1: Add a module-level recall tracker in `db.ts`**

Add after the `normalizePath` function (after line 232) in `knowledge-mcp/src/db.ts`:

```typescript
// Session-scoped set of knowledge IDs recalled this session.
// Reset when MCP server restarts (acceptable — feedback is best-effort).
const _recalledKnowledgeIds = new Set<number>();

export function getRecalledKnowledgeIds(): number[] {
  return [..._recalledKnowledgeIds];
}

export function clearRecalledKnowledgeIds(): void {
  _recalledKnowledgeIds.clear();
}
```

- [ ] **Step 2: Track recalls in the knowledge search section**

In `knowledge-mcp/src/db.ts`, inside the `recall` function, find the block that updates recall counts (around line 402-408). Add tracking to the existing loop:

Replace:
```typescript
        for (const row of kRows) {
          updateRecall.run(row.id);
        }
```

With:
```typescript
        for (const row of kRows) {
          updateRecall.run(row.id);
          _recalledKnowledgeIds.add(row.id);
        }
```

- [ ] **Step 3: Build to verify**

Run:
```bash
cd knowledge-mcp && npm run build
```
Expected: Clean build.

- [ ] **Step 4: Commit**

```bash
git add knowledge-mcp/src/db.ts
git commit -m "feat(knowledge-mcp): track recalled knowledge IDs per session

Module-level Set tracks which knowledge entries were recalled,
enabling /end to ask for feedback on the right entries."
```

---

### Task 5: Add `kb_feedback` MCP Tool

**Files:**
- Modify: `knowledge-mcp/src/server.ts:1-16` (imports)
- Modify: `knowledge-mcp/src/server.ts:509-520` (before `main()`)

- [ ] **Step 1: Update imports in `server.ts`**

Replace the import block at the top of `knowledge-mcp/src/server.ts`:

```typescript
import {
  recall,
  getStats,
  pruneExpired,
  getKnowledgeDb,
  insertKnowledge,
  deleteKnowledge,
  listKnowledge,
  insertSummary,
  getUnsummarizedSessionIds,
  getSessionChunks,
} from "./db.js";
```

With:

```typescript
import {
  recall,
  getStats,
  pruneExpired,
  getKnowledgeDb,
  insertKnowledge,
  deleteKnowledge,
  deleteKnowledgeById,
  listKnowledge,
  insertSummary,
  getUnsummarizedSessionIds,
  getSessionChunks,
  getKnowledgeById,
  recordFeedback,
  getRecalledKnowledgeIds,
  clearRecalledKnowledgeIds,
} from "./db.js";
```

Also add the lifecycle import after the db import:

```typescript
import { evaluateLifecycle, type Rating, type FeedbackEntry } from "./lifecycle.js";
```

- [ ] **Step 2: Add the `kb_feedback` tool registration**

Add before the `// Start the server` comment (before line 511) in `knowledge-mcp/src/server.ts`:

```typescript
// --- kb_feedback: Record outcome feedback for a knowledge entry ---
server.tool(
  "kb_feedback",
  "Record whether a recalled knowledge entry was helpful, harmful, or neutral. Used during /end or mid-session to track outcome quality. Drives maturity promotion and apoptosis.",
  {
    id: z
      .number()
      .describe("Knowledge entry ID"),
    rating: z
      .enum(["helpful", "harmful", "neutral"])
      .describe("Was this knowledge entry helpful, harmful, or neutral?"),
  },
  async ({ id, rating }) => {
    const entry = getKnowledgeById(id);
    if (!entry) {
      return {
        content: [
          { type: "text" as const, text: `Error: no knowledge entry with id ${id}.` },
        ],
        isError: true,
      };
    }

    const feedbackEntry: FeedbackEntry = {
      id: entry.id,
      helpful_count: entry.helpful_count,
      harmful_count: entry.harmful_count,
      neutral_count: entry.neutral_count,
      success_rate: entry.success_rate,
      maturity: entry.maturity as FeedbackEntry["maturity"],
      source: entry.source,
    };

    const result = evaluateLifecycle(feedbackEntry, rating as Rating);

    if (result.autoDelete) {
      deleteKnowledgeById(id);
      return {
        content: [
          {
            type: "text" as const,
            text: `${result.transitionMessage}\nEntry ${id} (${entry.key || "no key"}) has been removed.`,
          },
        ],
      };
    }

    recordFeedback(id, rating as Rating, result.newSuccessRate, result.newMaturity);

    const lines = [
      `Feedback recorded for entry ${id} (${entry.key || "no key"}): ${rating}`,
      `Counts: ${entry.helpful_count + (rating === "helpful" ? 1 : 0)} helpful, ${entry.harmful_count + (rating === "harmful" ? 1 : 0)} harmful, ${entry.neutral_count + (rating === "neutral" ? 1 : 0)} neutral`,
      `Success rate: ${result.newSuccessRate !== null ? result.newSuccessRate.toFixed(2) : "N/A"}`,
      `Maturity: ${result.newMaturity}`,
    ];

    if (result.transitionMessage) {
      lines.push(`Lifecycle: ${result.transitionMessage}`);
    }

    return {
      content: [{ type: "text" as const, text: lines.join("\n") }],
    };
  }
);

// --- kb_recalled: List knowledge entries recalled this session ---
server.tool(
  "kb_recalled",
  "List knowledge entry IDs recalled during this session. Use at /end time to know which entries to ask for feedback on.",
  {},
  async () => {
    const ids = getRecalledKnowledgeIds();
    if (ids.length === 0) {
      return {
        content: [
          { type: "text" as const, text: "No knowledge entries were recalled this session." },
        ],
      };
    }

    const lines = ["## Recalled This Session", ""];
    for (const id of ids) {
      const entry = getKnowledgeById(id);
      if (entry) {
        lines.push(
          `- **[${id}]** ${entry.key || "(no key)"} — maturity: ${entry.maturity}, success_rate: ${entry.success_rate !== null ? entry.success_rate.toFixed(2) : "N/A"}`
        );
      }
    }

    return {
      content: [{ type: "text" as const, text: lines.join("\n") }],
    };
  }
);
```

- [ ] **Step 3: Build to verify**

Run:
```bash
cd knowledge-mcp && npm run build
```
Expected: Clean build with no errors.

- [ ] **Step 4: Commit**

```bash
git add knowledge-mcp/src/server.ts
git commit -m "feat(knowledge-mcp): add kb_feedback and kb_recalled tools

kb_feedback records helpful/harmful/neutral ratings, evaluates
lifecycle transitions (promotion and apoptosis).
kb_recalled lists which entries were recalled this session for
/end feedback collection."
```

---

### Task 6: Add Maturity Boost to `kb_recall` Ranking

**Files:**
- Modify: `knowledge-mcp/src/db.ts:346-400` (knowledge search SQL in `recall`)
- Modify: `knowledge-mcp/src/server.ts` (already has lifecycle import from Task 5)

- [ ] **Step 1: Import `maturityBoost` in `db.ts`**

Add at the top of `knowledge-mcp/src/db.ts` after the existing imports:

```typescript
import { maturityBoost, type Maturity } from "./lifecycle.js";
```

- [ ] **Step 2: Modify the knowledge search SQL to include maturity columns**

In `knowledge-mcp/src/db.ts`, in the `recall` function, find the knowledge SQL query (around line 348). Replace the SELECT to include maturity and success_rate:

Replace:
```typescript
    let knowledgeSql = `
      SELECT
        k.id,
        k.key,
        k.content,
        k.tags,
        k.source,
        k.project_dir,
        snippet(knowledge_fts, 1, '>>', '<<', '...', 128) as snippet,
        k.created_at,
        (bm25(knowledge_fts) * (1.0 + MAX(0, julianday('now') - julianday(k.created_at)) * 0.005)) as weighted_rank
      FROM knowledge_fts
      JOIN knowledge k ON k.id = knowledge_fts.rowid
      WHERE knowledge_fts MATCH ?
    `;
```

With:
```typescript
    let knowledgeSql = `
      SELECT
        k.id,
        k.key,
        k.content,
        k.tags,
        k.source,
        k.project_dir,
        k.maturity,
        k.success_rate,
        snippet(knowledge_fts, 1, '>>', '<<', '...', 128) as snippet,
        k.created_at,
        (bm25(knowledge_fts) * (1.0 + MAX(0, julianday('now') - julianday(k.created_at)) * 0.005)) as weighted_rank
      FROM knowledge_fts
      JOIN knowledge k ON k.id = knowledge_fts.rowid
      WHERE knowledge_fts MATCH ?
    `;
```

- [ ] **Step 3: Update the row type and apply maturity boost**

Find the row type declaration for knowledge results (around line 375). Add `maturity` and `success_rate` to the type:

Replace:
```typescript
    const kRows = db.prepare(knowledgeSql).all(...kParams) as Array<{
        id: number;
        key: string | null;
        content: string;
        tags: string | null;
        source: string;
        project_dir: string | null;
        snippet: string;
        created_at: string;
        weighted_rank: number;
      }>;
```

With:
```typescript
    const kRows = db.prepare(knowledgeSql).all(...kParams) as Array<{
        id: number;
        key: string | null;
        content: string;
        tags: string | null;
        source: string;
        project_dir: string | null;
        maturity: string;
        success_rate: number | null;
        snippet: string;
        created_at: string;
        weighted_rank: number;
      }>;
```

Then in the loop that builds results from kRows (around line 387), apply the boost. Replace:
```typescript
      for (const row of kRows) {
        results.push({
          source: row.key || row.source || "stored knowledge",
          category: "knowledge",
          snippet: row.snippet,
          content: row.content,
          session_started: row.created_at,
          project_dir: row.project_dir,
          created_at: row.created_at,
          tags: row.tags ? row.tags.split(",").map((t) => t.trim()) : [],
          result_type: "knowledge",
          weighted_rank: row.weighted_rank,
        });
      }
```

With:
```typescript
      for (const row of kRows) {
        // Apply maturity boost: divide weighted_rank by boost (lower rank = better)
        const boost = maturityBoost(
          (row.maturity || "progenitor") as Maturity,
          row.success_rate,
        );
        results.push({
          source: row.key || row.source || "stored knowledge",
          category: "knowledge",
          snippet: row.snippet,
          content: row.content,
          session_started: row.created_at,
          project_dir: row.project_dir,
          created_at: row.created_at,
          tags: row.tags ? row.tags.split(",").map((t) => t.trim()) : [],
          result_type: "knowledge",
          weighted_rank: row.weighted_rank / boost,
        });
      }
```

- [ ] **Step 4: Build to verify**

Run:
```bash
cd knowledge-mcp && npm run build
```
Expected: Clean build.

- [ ] **Step 5: Commit**

```bash
git add knowledge-mcp/src/db.ts
git commit -m "feat(knowledge-mcp): apply maturity boost to kb_recall ranking

Mature entries get 1.5x boost, proven 1.2x. Entries below 0.3
success rate get 0.5x penalty. Applied as divisor on weighted_rank."
```

---

### Task 7: Add Maturity to `kb_stats` and `kb_list`

**Files:**
- Modify: `knowledge-mcp/src/server.ts:209-254` (kb_stats handler)
- Modify: `knowledge-mcp/src/server.ts:378-403` (kb_list handler)
- Modify: `knowledge-mcp/src/db.ts:490-553` (getStats)
- Modify: `knowledge-mcp/src/db.ts:689-729` (listKnowledge)

- [ ] **Step 1: Add maturity distribution to `getStats` in `db.ts`**

In `knowledge-mcp/src/db.ts`, in the `getStats` function, add after the `topTags` query (around line 532):

```typescript
  const maturityDist = db
    .prepare(
      "SELECT COALESCE(maturity, 'progenitor') as maturity, COUNT(*) as count FROM knowledge GROUP BY maturity ORDER BY count DESC"
    )
    .all() as Array<{ maturity: string; count: number }>;
```

Add `maturity_distribution` to the `KbStats` interface (around line 476):
```typescript
  maturity_distribution: Array<{ maturity: string; count: number }>;
```

Add it to the return object (around line 541):
```typescript
    maturity_distribution: maturityDist,
```

- [ ] **Step 2: Display maturity distribution in `kb_stats` handler in `server.ts`**

In `knowledge-mcp/src/server.ts`, in the `kb_stats` handler, add after the top_tags section (around line 249):

```typescript
    if (stats.maturity_distribution.length > 0) {
      lines.push("");
      lines.push("### Knowledge Maturity");
      for (const m of stats.maturity_distribution) {
        lines.push(`- ${m.maturity}: ${m.count}`);
      }
    }
```

- [ ] **Step 3: Add maturity to `listKnowledge` return type and queries in `db.ts`**

In the `listKnowledge` function, update both SELECT queries to include `maturity, success_rate`. Replace:
```
"SELECT id, key, content, tags, source, project_dir, created_at FROM knowledge
```
With (in both the project-scoped and global queries):
```
"SELECT id, key, content, tags, source, project_dir, created_at, maturity, success_rate FROM knowledge
```

Update the return type to include:
```typescript
  maturity: string;
  success_rate: number | null;
```

- [ ] **Step 4: Show maturity in `kb_list` handler in `server.ts`**

In the `kb_list` handler, update the line that builds each entry display (around line 393). Replace:
```typescript
      lines.push(
        `**[${e.id}]** ${scopeLabel} ${e.key ? `\`${e.key}\` — ` : ""}${e.content.length > 120 ? e.content.substring(0, 120) + "..." : e.content}`
      );
```

With:
```typescript
      const matLabel = e.maturity !== "progenitor" ? ` [${e.maturity}]` : "";
      const rateLabel = e.success_rate !== null ? ` (${(e.success_rate * 100).toFixed(0)}%)` : "";
      lines.push(
        `**[${e.id}]** ${scopeLabel}${matLabel}${rateLabel} ${e.key ? `\`${e.key}\` — ` : ""}${e.content.length > 120 ? e.content.substring(0, 120) + "..." : e.content}`
      );
```

- [ ] **Step 5: Build to verify**

Run:
```bash
cd knowledge-mcp && npm run build
```
Expected: Clean build.

- [ ] **Step 6: Commit**

```bash
git add knowledge-mcp/src/db.ts knowledge-mcp/src/server.ts
git commit -m "feat(knowledge-mcp): show maturity in kb_stats and kb_list

kb_stats displays maturity distribution. kb_list shows maturity
badge and success rate percentage per entry."
```

---

### Task 8: Manual Integration Test

**Files:** None (testing only)

- [ ] **Step 1: Sync the build to the installed location**

If using `--dev` symlinks, just rebuild. Otherwise:
```bash
cd knowledge-mcp && npm run build
cp knowledge-mcp/src/*.ts ~/.claude/knowledge-mcp/src/ && cd ~/.claude/knowledge-mcp && npm run build
```

Or if setup.mjs --dev was used (symlinks), just:
```bash
cd knowledge-mcp && npm run build
```

- [ ] **Step 2: Verify kb_feedback works via MCP**

In a new Claude Code session (or restart the MCP server), test:
1. Call `kb_recall` with a query that returns knowledge entries — note the IDs
2. Call `kb_feedback(id, "helpful")` — verify it returns updated counts and maturity
3. Call `kb_feedback(id, "helpful")` two more times — verify promotion to "proven" after 3rd
4. Call `kb_recalled` — verify it lists the entries recalled this session
5. Call `kb_stats` — verify maturity distribution section appears

- [ ] **Step 3: Verify apoptosis for non-manual entries**

1. Store a test entry: `kb_store(content: "test apoptosis", source: "agent")`
2. Note the ID
3. Call `kb_feedback(id, "harmful")` 5 times
4. On the 5th call, verify the entry is auto-deleted and the message says "Apoptosis"

- [ ] **Step 4: Verify manual entries are protected**

1. Store a test entry: `kb_store(content: "test manual protection")`  (default source = manual)
2. Note the ID
3. Call `kb_feedback(id, "harmful")` 5 times
4. Verify the entry is NOT deleted — message says "flagged for review"

- [ ] **Step 5: Verify maturity boost in recall ranking**

1. Call `kb_list` — verify maturity badges show up
2. Call `kb_recall` with a query that matches both a mature and progenitor entry
3. Verify the mature entry ranks higher (if BM25 scores are similar)

---

### Task 9: Version Bump, CHANGELOG, and Tag

**Files:**
- Modify: `package.json`
- Modify: `knowledge-mcp/package.json`
- Modify: `CHANGELOG.md`
- Modify: `README.md`

- [ ] **Step 1: Run `/sync` to check current state**

- [ ] **Step 2: Bump version to v0.4.0 (new feature)**

Update `package.json` version to `"0.4.0"`.

- [ ] **Step 3: Add CHANGELOG entry**

```markdown
## [v0.4.0] - 2026-03-29

### Added
- **Outcome tracking:** `kb_feedback` tool records helpful/harmful/neutral ratings for knowledge entries
- **Skill lifecycle:** Maturity stages (progenitor → proven → mature) with automatic promotion based on helpful ratings
- **Apoptosis:** Auto-prunes non-manual knowledge entries below 0.3 success rate after 5 ratings; manual entries flagged for approval
- **Maturity boost:** `kb_recall` ranks mature entries 1.5x higher, proven 1.2x; low-success entries penalized 0.5x
- **Session recall tracking:** `kb_recalled` tool lists which entries were recalled this session (for `/end` feedback collection)
- **Stats enhancement:** `kb_stats` shows maturity distribution; `kb_list` shows maturity badge and success rate
```

- [ ] **Step 4: Update README if needed**

Add `kb_feedback` and `kb_recalled` to any tools/commands table in README.

- [ ] **Step 5: Run `/sync` to propagate version**

- [ ] **Step 6: Commit, tag, and push**

```bash
git add -A
git commit -m "feat: v0.4.0 — outcome tracking and skill lifecycle

Adds kb_feedback (helpful/harmful/neutral), maturity stages
(progenitor/proven/mature), apoptosis for auto-extracted entries,
maturity boost in kb_recall, and session recall tracking."

git tag -a v0.4.0 -m "v0.4.0 — outcome tracking and skill lifecycle"
git push origin master --tags
```
