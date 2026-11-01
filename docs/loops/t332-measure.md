# T-332 measure: evidence-gated lesson writes

Measured 2026-10-31 (DB clock 2026-11-01T01:36Z). READ-ONLY: the live DB was opened with
better-sqlite3 `{readonly: true, fileMustExist: true}`; git and gh were used only for reads
(`cat-file --batch-check`, `ls-tree`, `log --name-only`, `gh pr list`, `gh api GET .../actions/runs/<id>`).
Nothing was written to the DB, the main checkout, or the record.

Source idea: RSI research #3 ("a lesson may enter the recall-eligible store only with a deterministic
evidence pointer"), and its avoid list items 2 (LLM self-judged success), 5 (ranking on ratings /
a maturity ladder) and 9 (tuning recall constants against the queries that judge them).

Code was read at the main checkout, `35a7d870` (it is behind origin/master; the planner worktree is at
`aefc8ff4`). Path pointers were resolved against the planner worktree tree at `aefc8ff4`.

## Headline

1. Of the 302 entries written in the last 30 days, **41 (13.6%)** carry a strict pointer that resolves
   (commit sha, tests/ path, docs/loops/ path, CI run id); 82 (27.2%) if a PR number counts.
2. Of the **1,441 trigger injections** in the last 30 days, **84 (5.8%)** were of an entry with a strict
   resolving pointer (195, 13.5%, counting PR numbers). By distinct entry: 16 of 104.
3. One entry, id 299 `pipe-to-tail-masks-exit-code`, is **707 of the 1,441 injections (49%)** and has no
   pointer of any kind. A gate removes the most-served lesson in the store first.

## 1. Code: where a pointer could live and where a filter would go

### Write paths (no evidence field exists today)

- `knowledge_index` (db-v2.ts:119) columns: id, vault_path, key, content, tags, source, project_dir,
  maturity (retained label, R-011), helpful/harmful/neutral, recall_count, last_recalled_at,
  archived_into, fact_kind, created_at, updated_at; live DBs also keep the dead success_rate.
  **There is no metadata/JSON column.** `chunks.metadata` exists but only for session-linked chunks.
- `ob_store` (server.ts:929, `handleStore`) -> `pipelines/store/index.ts` `store()` -> vault note via
  `writeExperience` + `indexKnowledge`. Args: content, key, tags, source (free text, default "manual"),
  scope, project_dir, kind. The only free field that could carry a pointer today is `source`, and it is
  already used inconsistently (69 distinct values, from "agent" to "session fdd581a1 ..., PR #146").
- `ob_store_chunk` (server.ts:1266) writes the vault file then a raw `INSERT INTO knowledge_index`
  (server.ts ~1378) with source = category; session_id goes to `chunks` via `recordChunk`, not to the
  knowledge row.
- Other `indexKnowledge` writers: `pipelines/store/index.ts` (4 sites: adopt, state replace, normal,
  failure) and `pipelines/store/rematch.ts:103`. A write-time gate has to cover all of them plus the
  chunk INSERT, or it has a hole.

Candidate carriers: (a) a new nullable `evidence TEXT` column (JSON list of pointers + resolution
status) written by `indexKnowledge` and the chunk INSERT, mirrored to a frontmatter `evidence:` field
so the vault stays the source of truth; (b) a tag convention (`evidence:<sha>`), which costs no schema
but mixes into FTS matching; (c) derived, not declared: extract pointers from content+source at read
time, as this measurement did. No new field.

### Read paths (where a recall-eligible filter would go)

Every recall query already shares one live-row clause, `k.archived_into IS NULL`. An eligibility filter
is one more clause at the same places:

- trigger: `trigger/query.ts:298` `queryStore` (BM25 floor, LIMIT 5) - feeds trigger_fires and
  recall_log `recall_trigger='hook'`.
- `ob_recall`: `server.ts:~805` (`recallRankExpr`, project/tag filters). Also serves `/end` dedup
  (`purpose: 'dedup'`, 823 rows in 30 days). **Dedup must never be gated**: a hidden entry is a
  duplicate waiting to be written.
- shadow harness: `pipelines/shadow/evaluate.ts:126` (has to match whatever the live path does).
- `searchFts` (db-v2.ts:474) has no archived filter at all; not a recall-serving path that I found.
- /start injects nothing from knowledge now (no FTS query under pipelines/session-start), consistent
  with avoid item 4.

### What was cut, and what the design must not repeat

- **R-004 reflection queue**: cut because `reflection_log` held 0 rows after six months - a stage nothing
  wrote to. A declared `evidence` field that agents do not populate dies the same way. The measure for
  that is the share of new entries carrying evidence (13.6% strict today, derived from prose that was
  never written to satisfy a gate).
- **R-011 maturity lifecycle**: boosts flat, success_rate excluded 72.5% neutral ratings, apoptosis 0 rows.
  The gate must not become a ladder (no "evidenced" boost tiers, no promotion, nothing computed from
  helpful/harmful). Pointer resolution is deterministic and binary, which is what keeps it on the right
  side of avoid items 2 and 5.

## 2. Measurements

All queries ran against `C:/Users/melve/.claude/open-brain/knowledge-v2.db`. "30 days" =
`created_at >= strftime('%Y-%m-%dT%H:%M:%fZ','now','-30 days')` = `2026-10-02T01:36:24Z`.

### 2.1 Shape

`SELECT COUNT(*), SUM(archived_into IS NULL) FROM knowledge_index` -> 924 rows, 924 live.

`SELECT COALESCE(fact_kind,'(null)'), COUNT(*) FROM knowledge_index GROUP BY 1`:

| fact_kind | n |
|---|---|
| event | 520 |
| (null, unclassified) | 384 |
| state | 20 |

`SELECT source, COUNT(*) FROM knowledge_index GROUP BY source` (bucketed): manual 401, agent 391,
free-text other 62, external media (youtube/http/paper/arxiv) 31, checkpoint 31, docs 6, spec 1, note 1.

`SELECT substr(created_at,1,7), COUNT(*) FROM knowledge_index GROUP BY 1`:

| month | entries | strict pass | lenient pass (+PR) |
|---|---|---|---|
| 2026-03 | 112 | 0 | 3 |
| 2026-04 | 105 | 3 | 9 |
| 2026-05 | 48 | 4 | 7 |
| 2026-06 | 17 | 0 | 0 |
| 2026-07 | 53 | 0 | 0 |
| 2026-08 | 119 | 7 | 17 |
| 2026-09 | 168 | 25 | 31 |
| 2026-10 | 302 | 41 | 82 |
| total | 924 | 80 (8.7%) | 149 (16.1%) |

The rate is rising (0% in March, 13.6% strict in October) without any gate asking for it.

`chunks`: 69 checkpoint, 1 spec (`SELECT category, COUNT(*) FROM chunks GROUP BY 1`).

### 2.2 Pointer-like content and how much resolves

Text scanned per entry = content + source + key + tags. Patterns (JS regex):

- sha: `\b[0-9a-f]{7,40}\b`, must contain a digit and a letter, after removing UUIDs
- tests path: `(?:[\w.-]+/)*tests?/[\w./-]+\.(ts|js|mjs|cjs|tsx|py)\b`
- loops path: `docs/loops/[\w./-]+\.(md|json)\b`
- PR: `\bPR\s*#?(\d+)`, `pull/(\d+)`, or `#(\d+)` after whitespace
- CI run: `\b(run( id)?|runs/|run_id[=:]?)\s*#?(\d{9,12})\b`
- session UUID: `8-4-4-4-12` hex

Resolution:

- sha: `git -C <repo> cat-file --batch-check` with `<sha>^{commit}` across all 25 git repos in
  `~/Projects` (lenient: any repo; blob/ambiguous/missing = no).
- tests / loops path: present in `git ls-tree -r --name-only HEAD` of the planner worktree (exact,
  `open-brain/`-prefixed, or as a suffix). Also checked against every path in
  `git log --all --name-only`: identical counts, so no pointer has rotted yet.
- PR: number in `gh pr list -R melvenac/Self-Improving-Agent --state all --limit 3000` (1,077 PRs),
  only for entries whose project_dir is SIA or NULL.
- CI run: `gh api repos/melvenac/Self-Improving-Agent/actions/runs/<id>` succeeds.
- session UUID: present in `sessions.uuid`.

| pointer | entries with one | entries where one resolves |
|---|---|---|
| commit sha | 134 | 68 (106 of 202 distinct candidates) |
| tests/ path | 26 | 13 |
| docs/loops/ path | 11 | 6 |
| PR number | 112 | 96 |
| CI run id | 4 | 3 (2 of 3 distinct ids) |
| session UUID | 2 | 0 |
| any of sha/test/loop/PR/run | 237 (25.6%) | 149 lenient (16.1%) |
| strict (no PR) | - | 80 (8.7%) |

By kind: event 59 strict / 114 lenient of 520; unclassified 21 / 35 of 384; **state 0 / 0 of 20**
(a state is a current value - a path, an owner - and has nothing to point at; a gate must exempt it).
By source: checkpoint 15/31 lenient, manual 91/401, agent 31/391, other 12/101.

**The PR column is close to meaningless as evidence.** With 1,077 SIA PRs, any `#N` up to 1077 in an SIA
or global entry "resolves"; 69 entries pass on a PR number alone and 57 of those have NULL project_dir,
so the number may name another repo's PR. Strict is the honest gate; lenient is shown for comparison.

Unresolved samples show why resolution matters: `#15909` / `#12256` (upstream issue numbers), `#1`
in a worth-it entry, short shas from Tarrant-County-Makerspace that are not commits in any local repo
(`231aa9a`, `bcf2ea4`), and a 32-hex string that is not a sha at all.

### 2.3 What was served in the last 30 days, and what a gate would keep

Trigger: `SELECT injected_ids FROM trigger_fires WHERE state='injected' AND created_at >= :since`,
ids parsed from the JSON array and counted. `ob_recall`: `SELECT knowledge_id, COUNT(*) FROM recall_log
WHERE created_at >= :since AND COALESCE(recall_purpose,'') <> 'dedup' AND COALESCE(recall_trigger,'')
<> 'hook' GROUP BY 1` (hook rows duplicate trigger_fires one for one: 1,441 = 1,441).

| | rows | distinct entries |
|---|---|---|
| trigger injections | 1,441 (fires with state injected) | 104 |
| ob_recall explicit (non-dedup) | 53 | 37 |
| ob_recall dedup (/end) | 823 (808 explicit + 15 unspecified) | 357 + 13 (excluded: must stay ungated) |
| served total (trigger + explicit) | 1,494 | 141 (all still present) |

Lifetime counter: `SELECT COUNT(*), SUM(recall_count>0), SUM(recall_count) FROM knowledge_index` ->
736 of 924 entries recalled at least once, 5,394 total; 409 have `last_recalled_at` in the window.
(recall_count is incremented by `recordRecall` and also counts dedup recalls; not used below.)

Share of SERVED that would pass:

| served set | n | strict pass | lenient pass |
|---|---|---|---|
| distinct entries, trigger + explicit | 141 | 19 (13.5%) | 36 (25.5%) |
| injections weighted by count | 1,494 | 87 (5.8%) | 199 (13.3%) |
| trigger only, distinct | 104 | 16 (15.4%) | 32 (30.8%) |
| trigger only, weighted | 1,441 | 84 (5.8%) | 195 (13.5%) |
| served entries created in the window | 105 | 16 | 32 |
| ... weighted | 738 | 84 | 195 |

Top trigger entries (30 days): 299 `pipe-to-tail-masks-exit-code` 707 (no pointer), 697
`brief-grep-premise-measured-on-base` 94 (no), 714 `maker-use-main-sh-for-pinned-reads` 55 (no), 710
`compose-up-service-recreates-diverged-dependency` 51 (lenient yes), 751 `skills-audit-without-session-...`
40 (no), 632 31 (no), 766 28 (no), 718 24 (no), 733 `stacked-release-name-the-carrier-pr` 22 (lenient
yes), 658 `merge-batch-stop-on-red` 18 (lenient yes).

Entry 299 is the clearest case against a hard gate: its lesson is backed by a real incident ("I
reported a false success because of it", 2026-07-26), but the evidence is a session transcript, not a
pointer this scan or any resolver can follow. Under "existing entries stay eligible" it survives; the
gate's real bite is on new entries, where it would have withheld 89 of the 105 served-new entries
(654 of 738 injections, strict).

### 2.4 Limits of these numbers

- A pointer that resolves is not a pointer that supports the lesson. Nothing here checks relevance,
  and nothing deterministic can. Under a hard gate the cheapest compliant write is "attach HEAD's sha" -
  the metric-gaming failure research #7 is about.
- sha resolution is lenient (any of 25 repos). Path and PR resolution only checks SIA; a pointer into
  another repo counts as unresolved, so cross-project entries are undercounted.
- Prose was never written to satisfy a gate, so these are floor rates for "would carry evidence if asked".
- 30-day window is a single sample dominated by one entry; weighted shares move a lot with entry 299.

## 3. Design options

### A. Hard gate at write

`ob_store` / `ob_store_chunk` / every `indexKnowledge` caller refuses a new event-kind entry without a
resolving pointer (declared `evidence` arg). Existing entries grandfathered.

- For: simplest rule to state; nothing un-evidenced ever enters.
- Against: on today's rate it refuses ~86% of new lessons (strict). Writers will attach a nearby sha to
  get through, which makes the pointer column worthless and cannot be detected. Loses lessons whose
  evidence is a transcript (entry 299's kind). Six write sites to cover. Irreversible in effect: a
  refused lesson is not recorded anywhere.

### B. Soft gate at recall (exclude or demote)

Write is unchanged; the trigger's `queryStore` (and optionally `ob_recall`, never dedup) adds
`AND (evidence_ok OR created_at < :cutoff)` or a demotion term in `recallRankExpr`.

- For: nothing is lost; reversible by deleting a clause.
- Against: demotion is a ranking constant (avoid item 9: it must be judged on a replay set it was not
  tuned on, research #6). Exclusion with no outcome measure is a policy bet: without T-331's withheld
  arm there is no way to know whether evidenced entries help more than un-evidenced ones. And a demote
  tier next to a no-demote tier is the start of a ladder (R-011).

### C. Shadow mode: derive, resolve, report would-be exclusions (no behaviour change)

A pure deterministic extractor + resolver (the patterns in 2.2), and an `open-brain evidence-report`
CLI that prints: share of entries per week with a strict resolving pointer, and of trigger injections
in the window, how many and which ids a gate would have withheld. Computed from `knowledge_index`
content and the existing `trigger_fires` rows on each run - no new column, no new table, no new stage
to keep fed.

- For: zero recall-path change; no stage that can sit at 0 rows (R-004) because it reads rows the system
  already writes; answers the two research #3 measures directly; becomes the input to B once T-331 can
  say whether evidenced entries earn their place.
- Against: derived evidence only (what the prose happens to cite). A declared `evidence` field can
  follow later if the report shows writers would use it.

## 4. Recommendation

**C, shadow mode, derived evidence, report-only.** Re-run after T-331's withheld arm has data, and only
then consider B as an exclusion on the trigger path (not demotion, not ob_recall's dedup path, never A).
A hard gate today removes ~86% of new lessons on a pointer type (PR number) or a pointer property
(resolves) that does not establish the lesson is true.

## 5. What Aaron must rule on

1. Which pointer types count as evidence: commit sha, tests/ path, docs/loops/ path, CI run id - and
   whether a PR number counts (measured: it is near-trivially satisfiable in SIA).
2. Derived (scan content, as here) vs declared (`evidence` arg on ob_store, frontmatter field).
   Declared is the R-004 risk; derived is the gaming-free floor.
3. Backfill: existing entries stay eligible (research default), or the gate applies to all 924.
4. Exempt `fact_kind = 'state'` (20 entries, 0 can carry a pointer) and external-media entries
   (youtube/paper sources, 31) from any gate - yes/no.
5. Scope of any later enforcement: trigger only, or ob_recall explicit too. Dedup stays ungated either
   way (proposed as fixed, not a choice).
6. Whether B waits on T-331 (withheld arm) for an outcome measure. Recommended: yes.

## 6. Small first build (shadow)

- `open-brain/src/evidence.ts`: `extractPointers(text)` and `resolvePointers(pointers, repos)`; pure,
  deterministic, unit-tested on fixtures including the false positives in 2.2 (UUID prefixes, `#1`,
  upstream issue numbers, 32-hex non-shas, blob shas).
- `open-brain evidence-report [--days 30]` CLI: read-only DB open; prints the 2.1 strict/lenient per
  month, the 2.3 served table, and the withheld id list for the window.
- No schema change, no change to `queryStore`, `ob_recall`, `ob_store` or the session-end pipeline.
- Acceptance: on the live DB at a fixed `--as-of 2026-11-01T01:36:24Z` the report reproduces this
  file's numbers (80 strict / 149 lenient of 924; 84 / 195 of 1,441 injections) within the resolution
  noise of repos that gained commits since.
