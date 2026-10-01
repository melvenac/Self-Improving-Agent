# Entities

> Conceptual entities the Self-Improving Agent system operates on. Rewritten for T-169: the earlier text
> described the entities Loop 10 cut (see PRD.md, "Not in this product"). Tables below are in
> `open-brain/src/db-v2.ts`.

## Entity Overview

| Entity | Description | Storage Location |
|---|---|---|
| **Experience** | A lesson learned, structured as TRIGGER/ACTION/CONTEXT/OUTCOME/CONCEPTS | `<vault>/Experiences/*.md` |
| **Session Log** | Record of one coding session's work and outcomes | `<vault>/Sessions/*.md` |
| **Summary** | Enriched session summary (What/Why/How/Lessons) | `<vault>/Summaries/*.md` |
| **Topic** | A subject note with backlinks to related experiences | `<vault>/Topics/*.md` |
| **Project Record** | The single record of project state: tasks, decisions, session number | `.agents/state.json`, written only through `ob_state` |
| **Rendered View** | INBOX.md, task.md, next-session.md, the marked region of SUMMARY.md | `.agents/`, generated from the record |
| **Project Context** | PRD, entities, rules, decisions for one codebase | `.agents/SYSTEM/` in each project |
| **Loop Artifact** | Brief (`D_t`), QA evidence (`E_t`), gate verdicts, per-loop git tags | `docs/loops/`, `artifacts/iterations/` |
| **Shadow Verdict** | What the runtime would have done at a merge, and what Aaron did | `docs/loops/shadow-merge/ledger.jsonl` |

`<vault>` is `OPEN_BRAIN_VAULT_DIR`, default `~/Obsidian Vault v2` (`scripts/setup.mjs`). Obsidian is a viewer and
never a prerequisite.

## Relationships

```
Sessions ──produce──> Experiences ──tagged by──> Domain
                          └──update──> Topics (via WikiLinks)

Project Record ──rendered as──> Views ──read by──> /start ──shapes──> Session
Tasks and decisions ──written through ob_state──> Project Record
Brief (D_t) ──> Developer ──> Candidate (A_t) ──> QA ──> Evidence (E_t) ──> Shadow Verdict
```

## Experience Format

YAML frontmatter:
```yaml
---
title: Short description of the lesson
project: Project Name
domain: comma, separated, tags
date: YYYY-MM-DD
type: gotcha | pattern | decision | fix | optimization
last-used: YYYY-MM-DD
retrieval-count: N
---
```

Body sections: `## TRIGGER`, `## ACTION`, `## CONTEXT`, `## OUTCOME`, `## CONCEPTS`

The recall trigger injects an entry's `ACTION` beside the tool result of a matching command
(`open-brain/src/trigger/`).

## Entity Storage (v2)

Knowledge content lives in the vault as .md files (source of truth). `knowledge-v2.db` is the retrieval index
plus a `content` copy that exists to be indexed by FTS5, not to be edited.

| Store | Table | What it holds |
|---|---|---|
| **`knowledge_index`** | `knowledge-v2.db` | vault_path, key, tags, feedback counters, recall_count, fact_kind |
| **`knowledge_fts`** | `knowledge-v2.db` | FTS5 external-content index over `knowledge_index` |
| **`recall_log`**, **`feedback_log`** | `knowledge-v2.db` | What was recalled, and what an agent judged about it |
| **`trigger_fires`** | `knowledge-v2.db` | Every recall-trigger invocation: `not-asked`, `silent` or `injected` |
| **`chunks`** | `knowledge-v2.db` | Session chunks (cold tier, ephemeral) |
| **`sessions`** | `knowledge-v2.db` | Session records (UUID, timestamps, project) |

Recall is FTS5 keyword search ranked by BM25 with recency decay and a failure boost. Store is vault-first (write
the .md, then index it in SQLite).

`knowledge_index` also keeps a `maturity` column holding a label last written before Loop 10. Nothing computes it
(`open-brain/src/lifecycle.ts`), and it does not affect ranking.

### `fact_kind`: state vs event

Which **update rule** a fact obeys, which is a different axis from the `type` field above:

| Kind | Meaning | Correct update |
|---|---|---|
| `state` | one current value that changes: a path, a version, a port, an owner | **replace** |
| `event` | a timestamped thing that happened: a gotcha, a decision, a lesson | **append** |
| `NULL` | **unclassified**, not a synonym for `event` | none |

The rules are opposites. Replacing an event destroys history; appending a state leaves two live answers to one
question with nothing marking which is current. `knowledge_index` can only append, so every changed state fact
has left its predecessor recallable.

**Not validated by the schema.** SQLite cannot add a CHECK via `ALTER TABLE`, so a constraint would hold on fresh
databases and not on migrated ones; one shape everywhere beats a guarantee half the installs lack. Validate with
`isFactKind`.

New columns go in `ADDED_COLUMNS` (`db-v2.ts`) **and** the DDL, because `CREATE TABLE IF NOT EXISTS` reaches new
installs only.

## Changelog

| Date | Change | Session |
|---|---|---|
| 2026-03-23 | Initial entity documentation | Scaffold session |
| 2026-09-30 | Rewritten to what ships; cut entities removed (T-169) | Developer job, dispatch t169 |
