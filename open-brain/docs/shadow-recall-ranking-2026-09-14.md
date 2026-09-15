# Shadow-recall ranking assessment — Loop 5 (C1)

**Date:** 2026-09-14 · **Branch:** `loop/5-ranking-cut` · **Base:** `master` @ `8aa2f2b`
**Question:** should the interim cut be taken — `matureBoost: 1.0, provenBoost: 1.0` in `LIFECYCLE_CONFIG`?

## Verdict

**No. Do not take the cut.** `no_maturity` does not beat `live`, so the brief's own
precondition for changing the constants is not met.

**And do not take the opposite cut either.** `maturity_strong` appears to beat `live`
decisively, but that result is confounded by label leakage (below) and is not evidence.

The honest finding is not a number, it is that **this harness cannot currently answer
questions about the maturity constants at all** — for backfilled replay or in production.
Recommendation: change nothing in `LIFECYCLE_CONFIG`; fix the confound before asking again.

## Method

`scripts/shadow-backfill.mjs` replays every eligible past session through the production
`evaluateSession` — not a reimplementation. Eligible = at least one logged query in
`recall_log` and at least one `helpful` label in `feedback_log`. **36 sessions, 0 skipped**,
`limit=5`, 1227 returned entries per strategy.

This exists because the session-end shadow stage scores only the session that just ended,
so the log held **8** scored sessions against a `MIN_SESSIONS_FOR_VERDICT` of 10. The
history was already in the DB; only the replay was missing.

**Metric directions, stated explicitly** (the brief warns the naive metric reads backwards —
the v1 harness scored strategies by pre-existing positive feedback, which rewarded
resurfacing frequently-recalled entries and would have scored the age-inversion bug as an
improvement):

| metric | direction | meaning |
|---|---|---|
| nDCG | **higher is better** | gain 1 for a `helpful` entry, discounted by rank position |
| MRR | **higher is better** | reciprocal rank of the first `helpful` entry |
| precision | **higher is better** | share of returned entries rated `helpful` |
| harmful | **lower is better** | count of `harmful`-rated entries returned |
| labeled | neither | sample size — how many returned entries carried any label |

**Worked example.** A query returns 5 ids and the 2nd is the only one this session rated
`helpful`. MRR contribution = 1/2 = 0.5. DCG = 1/log2(2+1) = 0.631; with one helpful entry
in the corpus the ideal DCG = 1/log2(0+2) = 1.0, so nDCG = 0.631. Move that same entry to
position 1 and MRR = 1.0, nDCG = 1.0 — both rise. Higher is better, in both.

## Results

```
strategy          sessions   nDCG     MRR    prec   harmful  labeled/returned
maturity_strong      36  0.1510  0.2239  0.1200       3   379/1227
no_recency           36  0.1389  0.2080  0.1076       2   368/1227
live                 36  0.1271  0.1853  0.0987       3   319/1227
bm25_only            36  0.1265  0.1891  0.0963       3   331/1227
no_maturity          36  0.1205  0.1774  0.0952       3   257/1227
recency_strong       36  0.1026  0.1518  0.0843       3   220/1227
```

Paired per-session head-to-head vs `live`, on nDCG:

| strategy | win | loss | tie | mean nDCG diff |
|---|---|---|---|---|
| `maturity_strong` | 22 | 6 | 8 | **+0.0239** |
| `no_recency` | 19 | 8 | 9 | +0.0119 |
| `bm25_only` | 11 | 15 | 10 | −0.0006 |
| `no_maturity` | **7** | **12** | 17 | **−0.0065** |
| `recency_strong` | 5 | 22 | 9 | −0.0244 |

The strategies do reorder — `no_maturity` changes the result in 19/36 sessions, so the
ties are real ties and not a no-op.

## Why `maturity_strong`'s win is not evidence

**Helpful ratings are what promote maturity.** `evaluateMaturity` advances
progenitor → proven → mature on helpful count and success rate, and the promotion is
written during the same session-end run whose labels the harness then scores against.

So a replay boosts entries by the maturity they hold **today**, and an entry rated helpful
in the replayed session may be boosted today *because of that very rating*. The scoring
labels and the ranking signal share a cause, pointing the wrong way round.

Measured enrichment:

- corpus baseline: **7.1%** of live entries are proven or mature (39 of 550)
- entries ever rated helpful: **23.4%** are proven or mature (22 of 94)

A **3.3× enrichment** of exactly the signal `matureBoost` multiplies, concentrated in
exactly the entries that score points. `maturity_strong` wins by leaning on it harder;
`no_maturity` loses by discarding it. Both movements are predicted by the leakage alone,
with or without any real relevance effect.

**This is not only a backfill artifact.** `runShadowStage` runs after the feedback stage by
design — its module docstring says so, because the session's labels must exist first. But
feedback also promotes maturity, so the live harness scores its strategies against maturity
values that the very labels being scored have just updated. The confound is in production.

Two further limitations, both pre-existing and documented in `evaluate.ts`:

- **Presentation bias.** Labels only exist for entries some ranking actually showed. The
  docstring says this handicaps variants against `live`, because "every labeled entry is by
  construction something `live` returned." **That assumption no longer holds here:** ratings
  were historically resolved from `.recalled-entries.json`, which accumulated ids across
  sessions (see the 2026-09-14 retraction in `decisions.md`), so `feedback_log` contains
  labels for entries the session's own `live` recall never returned. `live` has 319 labeled
  of 1227 while `maturity_strong` has 379 — the incumbent is not the best-labeled strategy,
  which is the opposite of what the docstring predicts.
- **Replay uses today's corpus.** `recency` is `julianday('now')` and `knowledge_index`
  contains entries created after the replayed sessions. Historical entries are uniformly
  older now than they were then, which systematically penalises `recency_strong` and
  flatters `no_recency`. Their rows above should be read as suggestive at best.

## What would make this answerable

Score against maturity **as of the session being replayed**, not as of today. `feedback_log`
carries `created_at`, so a per-session maturity snapshot is reconstructible without new
instrumentation. Until that exists, every strategy touching `matureBoost` / `provenBoost`
is measuring its own reflection, and the honest sample size for the maturity question is 0
regardless of how many sessions are logged.

## Incidental finding — not fixed, out of Loop 5 scope

`maturityBoost()` (`lifecycle.ts:110`) is referenced nowhere but comments. Its docstring
says the boost is applied by **dividing** the BM25 rank; `recallRankExpr` **multiplies**.
Both are correct for their own arithmetic — bm25 is negative, so multiplying by a boost > 1
sorts an entry earlier — but the comment at `lifecycle.ts:142` claims the query and
`maturityBoost()` "cannot drift apart" when nothing keeps them aligned and they already
describe opposite operations. A trap for whoever revives the function.

## Change made

**None to `LIFECYCLE_CONFIG`.** Added `scripts/shadow-backfill.mjs` and this report.

## Reproduce

```
cd open-brain && npm run build && node scripts/shadow-backfill.mjs
```
