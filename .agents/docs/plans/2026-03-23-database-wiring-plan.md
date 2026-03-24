# Database Wiring Redesign — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the wiring between three knowledge stores so federated search works reliably across all of them.

**Architecture:** Keep all three stores (CC Memory, Open Brain SQLite, Obsidian Vault). Define write authority, add cross-store mirroring via vault-writer.mjs, configure Smart Connections embeddings, update the retrieval protocol for federated search, and trim CC memory to bootstrap scope.

**Tech Stack:** Node.js (ESM), better-sqlite3, Smart Connections Obsidian plugin, Claude Code hooks/settings

**Spec:** `docs/superpowers/specs/2026-03-23-database-wiring-design.md`

---

## File Structure

| File | Action | Responsibility |
|---|---|---|
| `~/.claude/knowledge-mcp/scripts/vault-writer.mjs` | Modify | Add `mirrorToOpenBrain()` function after Stage 2 |
| `~/.claude/CLAUDE.md` | Modify | Update retrieval protocol for federated search |
| `~/Obsidian Vault/.obsidian/plugins/smart-connections/data.json` | Modify | Configure embedding model |
| `~/.claude/projects/C--Users-melve/memory/MEMORY.md` | Modify | Trim index after cleanup |
| `~/.claude/projects/C--Users-melve/memory/*.md` | Delete (some) | Remove files outside CC memory authority |
| `~/.claude/knowledge-mcp/scripts/verify-mirrors.mjs` | Create | Mirror verification script |

**Note:** The canonical vault-writer lives at `~/.claude/knowledge-mcp/scripts/vault-writer.mjs` (referenced by SessionEnd hook in settings.json). The copy at `Self-Improving-Agent/scripts/` is the source repo — changes should be made in the repo and copied to the hook location.

---

## Task 1: Configure Smart Connections Embeddings

**Prerequisite for federated search leg 2. Must be done first.**

**Files:**
- Modify: `~/Obsidian Vault/.obsidian/plugins/smart-connections/data.json`

- [ ] **Step 1: Check current Smart Connections plugin state**

Run the Smart Connections validate tool to see current status:
```
mcp__smart-connections__validate()
mcp__smart-connections__stats()
```

- [ ] **Step 2: Configure embedding model via Obsidian UI**

Open Obsidian, go to Settings → Smart Connections → Embedding Model. Select a local model (transformers.js — no API cost) or an API-based model if Aaron prefers quality. Local is recommended for the evaluation week.

- [ ] **Step 3: Trigger initial embedding generation**

In Obsidian Smart Connections settings, click "Force Refresh" to generate embeddings for all vault files. Wait for completion (may take several minutes for 215+ files).

- [ ] **Step 4: Verify semantic search works**

```
mcp__smart-connections__lookup(query: "Stripe webhook verification", limit: 5)
```

Expected: Returns relevant files from `Experiences/` or `Topics/`. If no Stripe experience exists, try a query matching known content like `"convex development patterns"`.

- [ ] **Step 5: Run dedup audit on Experiences/**

With embeddings now working, check for duplicate experiences that slipped through while `findSemanticDuplicate()` was silently failing:

```bash
# List all experience files for manual review
ls ~/Obsidian\ Vault/Experiences/
```

For each pair of similar-looking files, use Smart Connections to check similarity. Remove true duplicates (keep the richer version).

- [ ] **Step 6: Commit note**

No code commit for this task — it's Obsidian plugin configuration. Document what model was chosen in the session log.

---

## Task 2: Add Mirror A to vault-writer (Obsidian → Open Brain)

**The core new functionality. Ensures `kb_recall` can find decisions and experiences.**

**Files:**
- Modify: `scripts/vault-writer.mjs` (source repo)
- Copy to: `~/.claude/knowledge-mcp/scripts/vault-writer.mjs` (hook location)

- [ ] **Step 1: Read the current vault-writer.mjs**

Read `~/.claude/knowledge-mcp/scripts/vault-writer.mjs` to understand current structure. Key locations:
- Imports at top (already has `better-sqlite3`)
- Stage 2: `extractStructuredExperiences()` — this is where new experiences are created
- The `main()` function orchestration

- [ ] **Step 2: Identify the knowledge.db schema**

Open the database and confirm the `knowledge` table columns:
```javascript
import Database from 'better-sqlite3';
import { homedir } from 'os';
import { join } from 'path';

const db = new Database(join(homedir(), '.claude', 'context-mode', 'knowledge.db'));
const schema = db.prepare("SELECT sql FROM sqlite_master WHERE name='knowledge'").get();
console.log(schema.sql);
```

Confirm columns: `id, key, content, tags, source, permanent, created_at, updated_at, project_dir`
Confirm if there's a UNIQUE constraint on `key`.

- [ ] **Step 3: Write the `mirrorToOpenBrain()` function**

Add after the existing imports and constants:

```javascript
const KNOWLEDGE_DB_PATH = join(homedir(), '.claude', 'context-mode', 'knowledge.db');

function mirrorToOpenBrain(experienceFiles) {
  if (!experienceFiles || experienceFiles.length === 0) return;

  let db;
  try {
    db = new Database(KNOWLEDGE_DB_PATH);
  } catch (err) {
    console.error(`[mirror] Cannot open knowledge.db: ${err.message}`);
    return;
  }

  // Prepare UPSERT — update if key exists, insert if not
  const upsert = db.prepare(`
    INSERT INTO knowledge (key, content, tags, source, permanent, created_at, updated_at, project_dir)
    VALUES (@key, @content, @tags, @source, 1, datetime('now'), datetime('now'), @project_dir)
    ON CONFLICT(key) DO UPDATE SET
      content = @content,
      tags = @tags,
      updated_at = datetime('now'),
      project_dir = @project_dir
  `);

  let mirrored = 0;
  for (const filePath of experienceFiles) {
    try {
      const raw = readFileSync(filePath, 'utf-8');
      const { frontmatter, body } = parseFrontmatter(raw);
      const key = path.basename(filePath, '.md');
      const tags = Array.isArray(frontmatter.tags) ? JSON.stringify(frontmatter.tags) : '[]';
      const projectDir = frontmatter.project || null;

      upsert.run({
        key,
        content: body.trim(),
        tags,
        source: 'vault-mirror',
        project_dir: projectDir
      });
      mirrored++;
    } catch (err) {
      console.error(`[mirror] Failed to mirror ${filePath}: ${err.message}`);
    }
  }

  db.close();
  console.log(`[mirror] Mirrored ${mirrored}/${experienceFiles.length} experiences to Open Brain`);
}
```

**Note:** This assumes `parseFrontmatter()` already exists in vault-writer. If not, it needs to be extracted from the existing code or added. Check during Step 1.

- [ ] **Step 4: Verify `parseFrontmatter()` exists or add it**

If vault-writer doesn't have a frontmatter parser, add a minimal one:

```javascript
function parseFrontmatter(raw) {
  const match = raw.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!match) return { frontmatter: {}, body: raw };

  const frontmatter = {};
  for (const line of match[1].split('\n')) {
    const [k, ...rest] = line.split(':');
    if (k && rest.length) {
      let val = rest.join(':').trim();
      // Handle YAML arrays like [tag1, tag2]
      if (val.startsWith('[') && val.endsWith(']')) {
        val = val.slice(1, -1).split(',').map(s => s.trim());
      }
      frontmatter[k.trim()] = val;
    }
  }
  return { frontmatter, body: match[2] };
}
```

- [ ] **Step 5: Wire mirrorToOpenBrain into main()**

In the `main()` function, after Stage 2 (experience extraction), add:

```javascript
// Stage 2.5: Mirror new experiences to Open Brain
console.log('\n--- Stage 2.5: Mirror to Open Brain ---');
mirrorToOpenBrain(experienceFiles);
```

Where `experienceFiles` is the array of file paths created in Stage 2. Check how Stage 2 currently returns/tracks created files — may need to collect paths into an array.

- [ ] **Step 6: Test locally**

Run vault-writer manually to verify mirroring works:

```bash
node ~/.claude/knowledge-mcp/scripts/vault-writer.mjs
```

Then verify the data landed in Open Brain:

```
kb_recall(queries: ["vault-mirror"], limit: 5)
```

Or check directly:
```bash
node -e "
import Database from 'better-sqlite3';
import { homedir } from 'os';
import { join } from 'path';
const db = new Database(join(homedir(), '.claude', 'context-mode', 'knowledge.db'));
const rows = db.prepare(\"SELECT key, source FROM knowledge WHERE source='vault-mirror' LIMIT 10\").all();
console.log(rows);
db.close();
"
```

- [ ] **Step 7: Backfill existing experiences**

Mirror all existing 26 experience files (not just new ones). Run a one-time backfill:

```javascript
// Add a --backfill flag to vault-writer
// When present, read all files in Experiences/ and mirror them
```

Or call `mirrorToOpenBrain()` with all experience file paths once.

- [ ] **Step 8: Copy updated script to hook location**

```bash
cp scripts/vault-writer.mjs ~/.claude/knowledge-mcp/scripts/vault-writer.mjs
```

- [ ] **Step 9: Commit**

```bash
git add scripts/vault-writer.mjs
git commit -m "feat: add Mirror A — sync Obsidian experiences to Open Brain SQLite

Adds mirrorToOpenBrain() to vault-writer that UPSERTs experiences into
the knowledge table with source='vault-mirror'. Runs after Stage 2
in the SessionEnd hook. Includes --backfill flag for existing experiences."
```

---

## Task 3: Create Mirror Verification Script

**Files:**
- Create: `scripts/verify-mirrors.mjs`
- Copy to: `~/.claude/knowledge-mcp/scripts/verify-mirrors.mjs`

- [ ] **Step 1: Write verification script**

```javascript
#!/usr/bin/env node
import Database from 'better-sqlite3';
import { readdirSync, readFileSync } from 'fs';
import { join, basename } from 'path';
import { homedir } from 'os';

const VAULT_EXPERIENCES = join(homedir(), 'Obsidian Vault', 'Experiences');
const KNOWLEDGE_DB = join(homedir(), '.claude', 'context-mode', 'knowledge.db');

// Count Obsidian experiences
const obsidianFiles = readdirSync(VAULT_EXPERIENCES).filter(f => f.endsWith('.md'));
const obsidianKeys = new Set(obsidianFiles.map(f => basename(f, '.md')));

// Count Open Brain mirrors
const db = new Database(KNOWLEDGE_DB);
const obRows = db.prepare("SELECT key FROM knowledge WHERE source='vault-mirror'").all();
const obKeys = new Set(obRows.map(r => r.key));
db.close();

// Compare
const inObsidianOnly = [...obsidianKeys].filter(k => !obKeys.has(k));
const inOBOnly = [...obKeys].filter(k => !obsidianKeys.has(k));

console.log(`Obsidian Experiences: ${obsidianKeys.size}`);
console.log(`Open Brain mirrors:   ${obKeys.size}`);
console.log(`In sync:              ${obsidianKeys.size - inObsidianOnly.length}`);

if (inObsidianOnly.length > 0) {
  console.log(`\nMissing from Open Brain (${inObsidianOnly.length}):`);
  inObsidianOnly.forEach(k => console.log(`  - ${k}`));
}

if (inOBOnly.length > 0) {
  console.log(`\nOrphaned in Open Brain (${inOBOnly.length}):`);
  inOBOnly.forEach(k => console.log(`  - ${k}`));
}

if (inObsidianOnly.length === 0 && inOBOnly.length === 0) {
  console.log('\nMirrors are in sync.');
}
```

- [ ] **Step 2: Test it**

```bash
node scripts/verify-mirrors.mjs
```

Expected: Shows counts and any mismatches. After Task 2 backfill, should show "Mirrors are in sync."

- [ ] **Step 3: Commit**

```bash
git add scripts/verify-mirrors.mjs
git commit -m "feat: add mirror verification script

Compares Obsidian Experiences/ against Open Brain knowledge entries
with source='vault-mirror'. Reports mismatches in either direction."
```

---

## Task 4: Update Retrieval Protocol for Federated Search

**Files:**
- Modify: `~/.claude/CLAUDE.md` (Retrieval Protocol section)

- [ ] **Step 1: Read the current retrieval protocol**

Read `~/.claude/CLAUDE.md` and find the "### Retrieval Protocol" section. Note the current step numbering.

- [ ] **Step 2: Add the write authority table to CLAUDE.md**

Insert the authority table from the spec (Section 1) into CLAUDE.md above the retrieval protocol, so future sessions know which store is canonical for each data type.

- [ ] **Step 3: Rewrite the retrieval protocol**

Replace the existing retrieval protocol with the federated search version. Key changes:

1. Step 1 stays the same (check CC memory for bootstrap)
2. Step 2: Decompose into sub-queries (stays the same)
3. **Step 3 (rewritten):** Federated search — run THREE searches in parallel:
   - `kb_recall(queries, project: cwd, limit: 5)` — FTS5 across sessions, knowledge, summaries
   - `mcp__smart-connections__lookup(query, limit: 5)` — semantic search across vault
   - Scan MEMORY.md index descriptions for keyword matches
4. **Step 4 (new):** Merge results — dedup by content similarity, tag with source `[OB]`/`[SC]`/`[CC]`, rank FTS5 > semantic > CC memory, cap at 5 results
5. Steps 5-7: Keep existing skill index check, skill candidates check, rewrite-and-inject
6. **Add degraded mode note:** If Smart Connections returns errors, fall back to grep over `Experiences/` and `Guidelines/`

- [ ] **Step 4: Update the /recall skill if it references retrieval steps**

Check if `commands/recall.md` or the /recall skill has its own retrieval instructions that need updating to match.

- [ ] **Step 5: Test the new protocol manually**

In a new conversation, run /recall and verify:
- kb_recall returns results
- smart-connections lookup returns results
- CC memory scan works
- Results are presented with source tags

- [ ] **Step 6: Commit CLAUDE.md changes**

This file is outside the repo, so no git commit. Document the change in the session log.

---

## Task 5: CC Memory Cleanup

**Do this LAST — after federated search is working so nothing is lost.**

**Files:**
- Modify: `~/.claude/projects/C--Users-melve/memory/MEMORY.md`
- Delete: select files from `~/.claude/projects/C--Users-melve/memory/`

- [ ] **Step 1: Test federated search covers the data**

Before removing any CC memory file, verify its content is findable via kb_recall or smart-connections:

For each candidate file:
```
kb_recall(queries: ["<key topic from file>"], global: true, limit: 3)
```

If results come back, the file is redundant in CC memory.

- [ ] **Step 2: Back up CC memory before changes**

CC memory is outside the git repo, so deletions can't be reverted with `git revert`. Create a backup first:

```bash
cp -r ~/.claude/projects/C--Users-melve/memory/ ~/.claude/projects/C--Users-melve/memory-backup-2026-03-23/
```

- [ ] **Step 3: Review and remove candidates**

Review each file against the authority table:

| File | Keep/Remove | Reason |
|---|---|---|
| `project_ai_first_framework.md` | Remove | Archived, in git history |
| `project_learning_system.md` | Remove | Describes this repo, derivable from .agents/SUMMARY.md |
| `project_experience_critique.md` | Remove | Single feature decision, should be an experience |
| `feedback_notebooklm_self_describe.md` | Remove | Marked as moved to global, stale reference |

For each removal:
```bash
rm ~/.claude/projects/C--Users-melve/memory/<filename>.md
```

- [ ] **Step 4: Update MEMORY.md index**

Remove the deleted files from the index. Keep all remaining entries.

- [ ] **Step 5: Verify nothing broke**

Run /recall in a test conversation and confirm the removed content is still findable via federated search.

- [ ] **Step 6: Note in session log**

Document which files were removed and why. No git commit (CC memory is outside the repo) but this should be tracked.

---

## Task 6: End-to-End Validation

- [ ] **Step 1: Trigger a full SessionEnd cycle**

End a conversation and verify:
1. vault-writer runs (check `~/.Obsidian Vault/.vault-writer.log`)
2. Session log appears in `Sessions/`
3. Any extracted experiences appear in `Experiences/`
4. Mirror A fires — new experiences appear in Open Brain with `source='vault-mirror'`

- [ ] **Step 2: Run mirror verification**

```bash
node scripts/verify-mirrors.mjs
```

Expected: "Mirrors are in sync."

- [ ] **Step 3: Test federated search end-to-end**

Start a new conversation and ask about something from a recent session:
```
"Clark, what did we decide about the database architecture?"
```

Verify the answer pulls from multiple stores and tags sources.

- [ ] **Step 4: Update .agents/ state files**

Update `.agents/SYSTEM/SUMMARY.md` — reflect the new wiring architecture.
Update `.agents/TASKS/INBOX.md` — mark P0 database architecture as done, unblock vault-writer extraction filters.
Update `.agents/TASKS/task.md` — clear or set next objective.

- [ ] **Step 5: Commit state updates**

```bash
git add docs/ scripts/
git commit -m "feat: database wiring redesign complete — federated search across 3 stores

Implements ADR-005: write authority, Mirror A (Obsidian→OpenBrain),
federated search protocol, Smart Connections config, CC memory cleanup.
Evaluation period: through 2026-03-30."
```

- [ ] **Step 6: Push to GitHub**

```bash
git push origin master --tags
```
