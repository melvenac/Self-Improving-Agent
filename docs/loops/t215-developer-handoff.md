# T-215: finish the maturity-lifecycle cut in code, developer handoff

**By:** Forge (developer seat, `sia-forge`, Claude Sonnet 5.5), 2026-10-02. **Branch:** `loop/t215-maturity-cut` from `origin/master` `8b7aa952`. **Dispatch:** atlas-sia, session 157 (LIGHT). **Acceptance:** T-215's note plus R-011's `allowed_referrers` in `.agents/retirements.json`. Not merged; one PR.

## The list, checked against the files first

All ten `LIVE REFERENCE, NOT AN OBITUARY` entries were still true when I started, except one drift: **`server.ts` line numbers had moved** (1063 and 1266 in the entry, 1071 and 1274 on the tree). `tests/db-v2.test.ts` and the other non-owed entries are unchanged. `active-session.ts` stopped naming R-011 once its comment was fixed, so its entry is deleted rather than reclassified.

## What changed

| Entry | Fix | R-011 entry |
| --- | --- | --- |
| `scripts/backfill-success-rate.mjs` | deleted; its `--aply` test in `cli-flags.test.ts` deleted with it (the script was the only thing it ran) | deleted |
| `scripts/dashboard.mjs` | `success_rate` dropped from the view, the Rate column, and the detail line (colspan 8 to 7); maturity labelled "pre-Loop-10, frozen" in the chart title, filter and column; the filter lists the labels actually stored, and no label is hard-coded, so the file no longer names the lifecycle at all | deleted |
| `tests/ranking.test.ts` | success-rate demotion test inverted to an exact tie; mature-over-older-progenitor test deleted; "while the boost is suspended" titles and comment corrected | reclassified (true why) |
| `tests/index-upsert.test.ts` | the two `success_rate` comparisons replaced with `not.toHaveProperty('success_rate')`; the dead `successRate: 1.0` input removed | reclassified |
| comments: `db-v2.ts`, `recalled-ids.ts`, `active-session.ts`, `vault-writer.ts`, `tests/trigger/fires.test.ts`, `server.ts` | present tense rewritten to past tense, `formatApoptosisQueue` pointer removed; **`server.ts` hunks are comment lines only** (two hunks), to stay clear of #287 | `active-session.ts` deleted; the rest reclassified |

R-011 went from 78 to 75 allowed referrers (the message of `checkRetirements`); none now begins with `LIVE REFERENCE`.

## Red evidence

- **ranking, success rate:** the old test passes only on insertion order. Same test with the two `add` calls swapped: `expected 'failing.md' to be 'healthy.md'` (red). **ranking, mature over progenitor:** this one was not tie order, it was *recency*: with `maturity` changed to `'progenitor'` the test still passed, so it proved nothing about maturity (the file's first test already pins recency). Deleted for that reason.
- **index-upsert:** with the column declared (`ALTER TABLE knowledge_index ADD COLUMN success_rate REAL` added after `initSchemaV2`) the **old** assertions stay green (10 passed: they compare `undefined` to `undefined` or two copies of the same value), and the **new** ones go red (2 failed: `preserves every lifecycle field` and `ignores lifecycle inputs on conflict`).
- **new test** `tests/pipelines/sync/retirements-live.test.ts` (checks this repo's real tree and record): passes on the new record (2 passed). Against the *old* `retirements.json` it is red on both rows (the check says `allowed referrer open-brain/scripts/backfill-success-rate.mjs no longer exists ... dashboard.mjs no longer names it`; the second row finds 10 owed entries).
- **mutant** `docs/loops/t215/mutants/dashboard-success-rate.diff` (re-adds `success_rate` to the dashboard's view): `retirements-live` goes red with `retired names still referenced outside the record: open-brain/scripts/dashboard.mjs names maturity lifecycle`. The check is per file, so this only works because the dashboard now has **zero** matches and is no longer an allowed referrer; had it kept the word `progenitor`, the mutant would have passed silently.

## Runs

`tsc --noEmit` 0. Touched tests: `ranking`, `index-upsert`, `trigger/fires`, `cli-flags`, `retirements-live`, `sync/checks`, `db-v2` and `pipelines/session-end` (211 passed, 9 files). `node --check scripts/dashboard.mjs` ok; I did not start the dashboard server or look at the page. Not run: the full suite, `/sync` (stale local build).

## For the planner

- The dashboard note in Aaron's global CLAUDE.md can be pointed at this PR once it lands.
- A re-added `success_rate` mention anywhere *outside* a file's allowed list is caught. Inside an already-allowed file it is not (per-file allowance); that is the check's design, not changed here.
- `server.ts` still reads `COALESCE(maturity, 'progenitor')` at ob_stats and inserts the label at store; both are the retained label and stay allowed.
