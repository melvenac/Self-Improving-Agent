# Outcome Tracking + Skill Lifecycle Design

**Date:** 2026-03-29
**Status:** Approved
**Scope:** Gaps 1 (Apoptosis), 2 (Maturation), foundation for Gap 3 (Consolidation)

## Context

The Self-Improving Agent stores experiences and knowledge in a SQLite FTS5 database via Knowledge MCP. Currently, `kb_recall` ranks results by BM25 + recency decay, and the only usage metric is `recall_count`. There is no signal for whether recalled knowledge was actually useful, no lifecycle tracking, and no mechanism to prune persistently unhelpful content.

The STEM Agent (alfredcs/stem-agent) implements a biologically-inspired skill lifecycle with maturation stages and apoptosis. Their architecture is a persistent multi-user server with pgvector + PostgreSQL, which doesn't fit our session-based single-user model. However, their core patterns — `recordOutcome` with running averages, maturity thresholds, and source-based apoptosis gating — translate directly.

## Design Decisions

| Decision | Choice | Rationale |
|---|---|---|
| Feedback timing | Primary at `/end`, secondary inline via MCP tool | Low friction at natural checkpoint; inline available for mid-session corrections |
| Success metric | Ternary: helpful / neutral / harmful | Neutral excludes from success rate; distinguishes content problems (harmful) from retrieval problems (neutral) |
| Apoptosis gating | Split by source: auto-extracted auto-prunes, manual requires approval | Respects manual curation effort; matches STEM Agent's crystallized-vs-plugin distinction |
| Thresholds | 5 min activations, 0.3 apoptosis, 3/7 maturation, 0.5 advance rate | Adapted from STEM Agent for session-based cadence (~1 session/day vs hundreds/day) |

## Schema Changes

### Existing `knowledge` table — add 5 columns

```sql
ALTER TABLE knowledge ADD COLUMN helpful_count INTEGER NOT NULL DEFAULT 0;
ALTER TABLE knowledge ADD COLUMN harmful_count INTEGER NOT NULL DEFAULT 0;
ALTER TABLE knowledge ADD COLUMN neutral_count INTEGER NOT NULL DEFAULT 0;
ALTER TABLE knowledge ADD COLUMN success_rate REAL DEFAULT NULL;
ALTER TABLE knowledge ADD COLUMN maturity TEXT NOT NULL DEFAULT 'progenitor';
```

**Maturity values:** `progenitor` | `proven` | `mature`

**Success rate formula:** `helpful_count / (helpful_count + harmful_count)`. NULL when both are 0 (only neutral ratings exist).

No new tables required.

## New MCP Tool: `kb_feedback`

```typescript
kb_feedback(id: number, rating: 'helpful' | 'harmful' | 'neutral'): void
```

**Behavior:**
1. Increment the appropriate count column (`helpful_count`, `harmful_count`, or `neutral_count`)
2. Recalculate `success_rate` (skip if `helpful_count + harmful_count === 0`)
3. Evaluate lifecycle transitions (see below)
4. Return updated entry summary (id, key, new counts, success_rate, maturity)

**Availability:** Registered as an MCP tool alongside `kb_store`, `kb_recall`, etc. Callable anytime during a session.

## Lifecycle Engine

Evaluated after every `kb_feedback` call:

### Maturation (promotion)

| Transition | Condition |
|---|---|
| Progenitor -> Proven | `helpful_count >= 3` AND `success_rate >= 0.5` |
| Proven -> Mature | `helpful_count >= 7` AND `success_rate >= 0.5` |

Maturity only advances, never regresses (except via apoptosis which deletes entirely).

### Apoptosis (pruning)

**Trigger:** `(helpful_count + harmful_count) >= 5` AND `success_rate < 0.3`

**Gated by source:**
- `source != 'manual'` (i.e., `'agent'`, `'import'`, or any non-manual source) -> **auto-delete**. Log deletion to `~/.vault-writer.log` with reason.
- `source = 'manual'` -> **flag only**. Added to flagged list surfaced during `/start` monthly maintenance. Aaron approves or dismisses.

### Thresholds (configurable starting points)

```typescript
const LIFECYCLE_CONFIG = {
  apoptosisMinActivations: 5,       // Don't judge until N non-neutral ratings
  apoptosisThreshold: 0.3,          // Below this success rate = prune candidate
  provenMinHelpful: 3,              // Helpful ratings to reach "proven"
  matureMinHelpful: 7,              // Helpful ratings to reach "mature"
  advanceMinSuccessRate: 0.5,       // Minimum success rate to advance maturity
};
```

## Retrieval Boost

Modify `kb_recall` BM25 ranking to incorporate maturity and success rate:

```typescript
// Applied as a multiplier to the existing weighted_rank
function maturityBoost(entry: KnowledgeEntry): number {
  // Maturity bonus
  let boost = 1.0;
  if (entry.maturity === 'mature') boost = 1.5;
  else if (entry.maturity === 'proven') boost = 1.2;

  // Penalty for low success rate (but not yet at apoptosis)
  if (entry.success_rate !== null && entry.success_rate < 0.3) {
    boost *= 0.5;
  }

  return boost;
}
```

The BM25 score is multiplied by this boost before final ranking. This means mature experiences surface ahead of unproven ones when relevance is similar.

## `/end` Integration

Add a feedback collection step to the `/end` flow:

1. Query which knowledge entries had their `recall_count` incremented this session (compare against session start snapshot, or track IDs during the session)
2. Present to Aaron: "These experiences were recalled this session:"
   ```
   1. [ID 42] "Always run /sync before committing" — helpful / neutral / harmful?
   2. [ID 87] "Windows path normalization gotcha" — helpful / neutral / harmful?
   ```
3. For each response, call `kb_feedback(id, rating)`
4. Report any lifecycle transitions: "Experience #42 promoted to proven (3 helpful, 0 harmful)"
5. Report any apoptosis: "Experience #103 auto-pruned (1 helpful, 4 harmful, source: agent)"

If Aaron skips the feedback step (or the session ends without `/end`), no feedback is recorded — conservative default.

## `/start` Monthly Maintenance Addition

Add to existing periodic maintenance flow:

1. **Maturity distribution report:**
   ```
   Knowledge health: 45 progenitor, 12 proven, 3 mature
   ```
2. **Manual entries flagged for apoptosis:** List any `source = 'manual'` entries below threshold. Aaron approves or dismisses.
3. **Retrieval quality alerts:** Flag entries with `neutral_count > 5` AND `helpful_count < 2` — these are being recalled frequently but never helping. Likely a retrieval/keyword-match problem, not a content problem.

## Session Tracking: Which Entries Were Recalled?

To know which entries to ask about at `/end`, we need to track recalls within a session. Two options:

**Chosen approach:** Track in-memory during the MCP server's lifetime. The `kb_recall` handler already increments `recall_count` — also push the entry ID onto a session-scoped `Set<number>`. At feedback time (or `/end`), read from this set. If the MCP server restarts mid-session, the set is lost — acceptable since feedback is best-effort.

**Alternative (not chosen):** Add a `last_recall_session` column. Rejected because it adds schema complexity for marginal benefit.

## Files to Create/Modify

| File | Change |
|---|---|
| `knowledge-mcp/src/db.ts` | Add migration for 5 new columns |
| `knowledge-mcp/src/tools.ts` | Add `kb_feedback` tool registration |
| `knowledge-mcp/src/tools.ts` | Modify `kb_recall` to apply maturity boost |
| `knowledge-mcp/src/tools.ts` | Track recalled IDs in session-scoped set |
| `knowledge-mcp/src/lifecycle.ts` | New file: lifecycle engine (evaluate transitions, apoptosis logic) |
| `knowledge-mcp/scripts/auto-index.mjs` | No changes needed |
| `.claude/commands/end.md` | Add feedback collection step to `/end` flow |
| `.claude/commands/start.md` | Add maturity report + flagged entries to monthly maintenance |

## Out of Scope

- **Gap 3 (Experience Consolidation):** This design provides the foundation (maturity tracking, success rates) but does not implement the consolidation pass itself. That will be a separate spec building on this infrastructure.
- **Gap 5 (Semantic Search):** sqlite-vec integration is independent and not required for outcome tracking.
- **Embedding-based skill matching:** Our skills remain markdown guidelines matched by keyword/tag. Vector matching is a future enhancement.

## Reference

- STEM Agent source analysis: KB #165
- Gap analysis: `docs/gap-analysis-next-gen-frameworks.md`
- STEM Agent thresholds: `COMMITTED_THRESHOLD=3, MATURE_THRESHOLD=10, ADVANCE_MIN_SUCCESS=0.6, REGRESSION_THRESHOLD=0.3`
- Adapted for session cadence: reduced mature threshold (10->7), reduced min activations (10->5), reduced advance rate (0.6->0.5)
