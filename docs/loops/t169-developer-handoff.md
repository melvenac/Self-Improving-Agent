# T-169 developer handoff

**By:** developer seat (headless Claude Code Sonnet, QA PC, D-068). **Branch:** `docs/t169-prd-readme` off
`origin/master` 61b5b4c. **Scope:** docs and config only. Edited: `.agents/SYSTEM/PRD.md`, `README.md`,
`.agents/retirements.json`, `.agents/SYSTEM/ENTITIES.md`, and this file. No product code, no test, no
`state.json`, no rendered view. **Aaron reads this before it merges** (dispatch, D-032).

## PRD.md (rewritten)

**Changed:** problem statement kept and re-tested against the Step-Back's four verdicts; "What ships" (10 items);
the TypeSafe/Jev dependency; "Not in this product"; **Success metrics** (new); lessons not about memory;
"Still open" (idea B named as open, not done); tech stack. The interim stale note is deleted.

| Claim | Source |
|---|---|
| Four verdicts, 677 vs 24,887 words, idea B open, audience "both", lessons list, seat boundary | Planner's Step-Back summary in `docs/loops/t169-dispatch.md` (the artifact itself was not readable; not independently verified) |
| 14 tools | `CLAUDE.md`; `open-brain/src/server.ts` |
| state.json written only via `ob_state`; views | `CLAUDE.md`; `open-brain/src/pipelines/state-views/` |
| Recall = FTS5, BM25, recency decay, failure boost | `open-brain/src/lifecycle.ts` (`LIFECYCLE_CONFIG`) |
| Recall trigger, `trigger_fires` states | `open-brain/src/trigger/`, `db-v2.ts:83`; README text carried over |
| HoH runtime, three gates, policies as data | `open-brain/src/harness/`, `policies/{plan-gate,developer-done,merge}.json`, `docs/HOH-JEV.md` |
| Shadow gate verdicts and ledger; one row, `undefined`, `merged` | `harness/shadow-merge.ts:12`; `docs/loops/shadow-merge/ledger.jsonl` |
| Runtime never merges or pushes; exit criterion | D-019 |
| Key per project, never committed, none shipped | D-070 |
| Calibration needs 5+ runtime diffs | D-071; D-033/D-036 for the slice |
| `/bootstrap` | `CHANGELOG.md` 0.45.0 |
| Seats, A2A holds no memory | `CLAUDE.md` Agent Identity; `.agents/roles/` |
| `greeting-size` 40,000, `module-boundary` | `open-brain sync --check` output below |
| `ob_score` five categories | README text carried over; `pipelines/sync/scorer.ts` |
| Cut list | Loop 10 C2; R-002, R-004, new R-011; `lifecycle.ts` header comment |
| Node 22 LTS, a bump is deliberate | `CLAUDE.md` |

**Left out because unsourced:** any hit-rate or numeric target for the recall trigger, and the Step-Back's
p-values (0.035, 0.688), which appear only in the planner's summary with no code path or record id.
**One thing to check:** the PRD's success metric 3 says the trigger's hit rate "can be read from the table"; I did
not query a live `trigger_fires` table, so that is an inference from the schema, not a measurement.

## README.md (rewritten)

Removed: the maturity boosts and lifecycle rows, the reflection cycle, skill proposals, Smart Connections and
the v24 warning, the four-tier table (Hot/Warm/Cold, Obsidian as prerequisite), the auto-feedback paragraph
naming the cut arm, the dashboard's maturity claim, the "roles are still stubs" paragraph, the A2A Wrapper
section (`a2a-wrapper/` does not exist in the tree). Added: the TypeSafe key section (D-070), `/bootstrap` in
the commands table, the shadow merge gate row, the seats paragraph, Obsidian as optional. Setup steps are the
old ones, kept working (`scripts/setup.mjs`, manual hooks), unrun on a fresh machine here.

## retirements.json

- `.agents/SYSTEM/PRD.md` removed from `historical`.
- **R-011 added**: maturity lifecycle (boosts, Progenitor/Proven/Mature, `success_rate`, apoptosis), Loop 10 C2,
  pattern `maturity lifecycle|maturity boosts?|apoptosis|success_rate|\bprogenitor\b` (case-insensitive).
  It is deliberately not the bare word `maturity`: the column and the `Maturity` type still exist
  (`lifecycle.ts`, `db-v2.ts:126`) and nothing computes them.
- **26 allowed referrers were listed on R-011** (product code, tests, one skill). The check's own referrer list
  produced them; **I did not read each file to write a specific `why`**, and the `why` says so. A planner may
  want them tightened. They are code and test files this job may not edit.
- PRD.md added as an obituary referrer on R-002, R-004 and R-011.
- `$declined` rewritten as RESOLVED, pointing at R-011 (its "not backfilled" claim was no longer true).
- The JSON round-trips byte for byte before my edit, so the diff is only the change.

## ENTITIES.md (rewritten)

Removed the Skill, Skill Candidate, `reflection_log`, `dream`, success_rate, maturity-boost and apoptosis text
that the check flagged (R-003, R-004). Added the project record, views, loop artifacts, shadow verdict, and the
tables in `db-v2.ts` (`knowledge_index`, `knowledge_fts`, `recall_log`, `feedback_log`, `trigger_fires`,
`chunks`, `sessions`). `fact_kind` section kept. It still says a stored `maturity` label survives, because it does.

## Verification

```
npm ci && npm run build            (open-brain/)  -> EXIT=0, "build stamped 61b5b4c"
node open-brain/build/cli.js sync --check
  retirements [pass]: 11 retirements across 6 event classes, 78 allowed referrers all present and still naming
  their retirement, 0 unexpected across 328 live files read ...
  Summary: 32 passed, 0 fixed, 2 warnings, 2 issues, 2 skipped
```

Before my edits the same command gave 3 issues: `retirements` (ENTITIES.md: dream, reflection queue),
`worktree-layout` and `greeting-size`. Now `retirements` passes. **The 2 remaining issues are not from these
edits:** `worktree-layout` (my scratch folders `t169` etc. are not named `sia-<seat>`) and `greeting-size`
(50,250 chars, state render 26,213 plus role files 23,427, neither edited here). Both are the baseline.

Retired-term grep over README.md, PRD.md, ENTITIES.md (maturity, Progenitor, apoptosis, reflection, skill-scan,
dream, Smart Connections): **README.md 0 hits; ENTITIES.md 1 hit** (line 72, the `maturity` column that still
exists); **PRD.md 6 hits**, all in "Not in this product" and its trailing note, which is what the new R-011,
R-002 and R-004 referrer entries allow. `dream`: 0 hits anywhere in the three files.

Tests that read these files: **none read the live copies.** `checks.test.ts`, `state-writer*.test.ts` and the
others name `README.md` or `PRD.md` only as temp-dir fixtures. I ran `tests/pipelines/sync/checks.test.ts`
(the retirements check's tests): 102 passed. I did not run the full suite. No CI (D-061).

## For the planner (outside this repo, not edited)

- `~/.claude/CLAUDE.md` still describes the maturity lifecycle.
- Still describing it inside the repo, untouched (not in scope): `open-brain/scripts/dashboard.mjs` ("maturity
  lifecycle" in its header), `open-brain/src/pipelines/sync/scorer.ts` (Coverage category scores `maturity`),
  `.agents/skills/self-improving-agent-guide/SKILL.md`, and `project-template/README.md` line 5 ("Session
  lifecycle is global ... `~/.claude/commands/`") which conflicts with 0.45.0's "commands always installed in
  the project".
- The Step-Back artifact's dated part for Loops 12 to 16 (T-169 part 4) is not done; a headless job cannot edit it.
- I did not check that the PRD's `Version` (v0.44.2) will track the 0.45.0 release.


## r2 — R-011 allowed referrers made honest

Each file was read at every matching line. The blanket `why` is gone (0 hits for "not re-read one by one"). Fixed in docs/skills: `self-improving-agent-guide/SKILL.md` line 59 (said recall is ranked by maturity) and line 196 (checklist expected maturity data); it is now an obituary. **10 entries are LIVE in code or tests and are NOT edited** — each `why` begins `LIVE REFERENCE, NOT AN OBITUARY — fix owed:` and the planner opens the code task. Several files also hold the retained `maturity` label (R-011's note keeps it deliberately); those are called out per file and are not counted as LIVE.

| path | class | line(s) | why | LIVE? |
|---|---|---|---|---|
| .agents/SYSTEM/PRD.md | obituary | see why | obituary — the PRD's 'Not in this product' list names the cut lifecycle | no |
| .agents/skills/self-improving-agent-guide/SKILL.md | obituary | see why | Lines 75-81 say the lifecycle and apoptosis were cut in Loop 10 and the columns are inert, and line 188 is the v0.4.0 history entry annotated as cut; the two lines that presented maturity as a live ranking input (59, 196) were rewritten in T-169 r2. | no |
| open-brain/scripts/backfill-success-rate.mjs | LIVE | see why | LIVE REFERENCE, NOT AN OBITUARY — fix owed: the whole script (header 3-14, SELECT 53, UPDATE 105) recomputes and writes `success_rate` and reports rows "below the apoptosis threshold" (87-92) as if the column and threshold existed; new databases do not declare the column (db-v2.ts:130), so it would throw. Delete the script. | LIVE |
| open-brain/scripts/dashboard.mjs | LIVE | see why | LIVE REFERENCE, NOT AN OBITUARY — fix owed: reads `success_rate` from the row query (52), buckets by maturity (248), offers a Progenitor filter (571-582), colours maturity badges (469, 748-758) and renders a "Success Rate" column and detail line (884, 932) as live data; the column is no longer written, so it shows frozen pre-Loop-10 values as current. | LIVE |
| open-brain/scripts/shadow-backfill.mjs | historical | see why | Line 14 is the "REPAIRED IN LOOP 6" comment recording that maturity/success_rate used to be read as-of-today; a record of a past repair. (Its `coverage` branch at 80-86 reads a ReplayCoverage that no longer exists and is dead, but is not matched by the pattern.) | no |
| open-brain/src/db-v2.ts | LIVE | see why | LIVE REFERENCE, NOT AN OBITUARY — fix owed: the comment at 66-67 says ratings "move success_rate, which gates apoptosis and boosts ranking" in the present tense, and the doc at 526 says "Retire an entry by apoptosis" for the archive helper `ob_forget` also uses. Lines 19, 130-133, 396-399, 425, 499-511, 628-632, 867-870, 968 are obituaries and 126/444 are the retained maturity label default. | LIVE |
| open-brain/src/lifecycle.ts | obituary | see why | The header block at 4-34 is the Loop 10 C2 obituary (apoptosis never fired, success_rate cannot discriminate, boosts already 1.0) with the reviving observation and the recovery SHA; 56 and 60 name the retained `Maturity` type and the cut `success_rate` while stating nothing computes them. | no |
| open-brain/src/pipelines/session-end/index-v2.ts | obituary | see why | Line 33 explains, in the past tense, that the heuristic rating arm cut in R-010 left `harmful` unreachable and made the apoptosis threshold unsatisfiable; line 114 records that the pre-feedback lifecycle capture is gone because ranking no longer reads maturity or success_rate. | no |
| open-brain/src/pipelines/session-end/recalled-ids.ts | LIVE | see why | LIVE REFERENCE, NOT AN OBITUARY — fix owed: the header at 14-16 says "Since v0.15.0 the same ratings move `success_rate`, which gates apoptosis and feeds `maturityBoost` ranking" in the present tense, and 152 points at `formatApoptosisQueue`, which no longer exists. | LIVE |
| open-brain/src/pipelines/shadow/evaluate.ts | obituary | see why | Lines 106-111 record that the lifecycle-snapshot substitution (E9b) that JOINed maturity and success_rate overrides is gone because `recallRankExpr` no longer reads either column. | no |
| open-brain/src/pipelines/shadow/index.ts | obituary | see why | Lines 145-149 record that the `snapshot` input of lifecycle values is gone because ranking no longer reads maturity or success_rate, and name the trigger that would restore it. | no |
| open-brain/src/pipelines/store/index.ts | historical | see why | Line 66 stamps the constant label `maturity: 'progenitor'` on a new entry's frontmatter; that is the retained stored label R-011's note deliberately did not retire (nothing computes or promotes it), not the cut lifecycle behaviour. | no |
| open-brain/src/pipelines/sync/checks.ts | obituary | see why | Lines 827-828 cite Loop 11's finding that `ob_feedback` was falsely described as driving maturity promotion and apoptosis after the Loop 10 cuts, as the worked example of what the check cannot catch. | no |
| open-brain/src/server.ts | LIVE | see why | LIVE REFERENCE, NOT AN OBITUARY — fix owed: the comment at 1063 says vault_path is selected "for the apoptosis branch" of ob_feedback, a branch that no longer exists (1093 says so), and 1266 says a supplied x harmful cell is "the only combination that can ever make an apoptosis threshold satisfiable" in the present tense. Lines 1077, 1093, 1117, 1309 are obituaries, 566 is history, and 1222, 1279, 1368-1370, 1460 read or write the retained maturity label. | LIVE |
| open-brain/src/shared/active-session.ts | LIVE | see why | LIVE REFERENCE, NOT AN OBITUARY — fix owed: the doc comment at 180 says "the maturity lifecycle rates entries with no idea what produced them", presenting the cut lifecycle as a running consumer of the model field. | LIVE |
| open-brain/src/vault-writer.ts | LIVE | see why | LIVE REFERENCE, NOT AN OBITUARY — fix owed: the doc comment at 107 says "apoptosis fires automatically" as the reason archiveVaultNote moves rather than unlinks; apoptosis is cut and nothing fires automatically. Line 11 is the retained maturity label in the frontmatter type. | LIVE |
| open-brain/tests/db-v2.test.ts | pin | see why | Line 146 asserts the stored maturity column still defaults to 'progenitor', pinning the retained label value R-011 deliberately kept. | no |
| open-brain/tests/index-upsert.test.ts | LIVE | see why | LIVE REFERENCE, NOT AN OBITUARY — fix owed: lines 96 and 132 assert `after.success_rate` equals `before.success_rate` (and 126 passes `successRate: 1.0`), but new databases do not declare the column, so both sides are undefined and the assertions are vacuous; they read a cut column as if live. | LIVE |
| open-brain/tests/pipelines/session-end/index-v2.test.ts | historical | see why | Lines 152-157 are the "Loop 7 R2" comment recording why the heuristic-arm tests were written (a success_rate corpus mean of 0.311 against a 0.3 apoptosis threshold), above a describe block already titled "CUT in Loop 12 (R-010)". | no |
| open-brain/tests/pipelines/sync/scorer-integration.test.ts | pin | see why | Lines 78-84 assert `getStalenessStats().lowSuccessCount` is 0 because success_rate no longer exists, so a reinstatement has to argue with a failing test. | no |
| open-brain/tests/ranking.test.ts | LIVE | see why | LIVE REFERENCE, NOT AN OBITUARY — fix owed: lines 122-128 assert an entry with success rate 0.1 is demoted below one at 0.9 and 130-136 assert a mature entry outranks an older progenitor, both presenting cut behaviour as live and contradicting the pins at 98-120 and 166-178 (they pass only by tie-order, `successRate` is not stored); 75-96 still say "while the boost is suspended". Lines 80-120 and 166-178 are legitimate pins. | LIVE |
| open-brain/tests/server.test.ts | historical | see why | Line 192 is a task-title fixture string ("Choose an apoptosis threshold with a defensible gate") asserted in ob_start blocked-task output; it is a title from the state record, not a claim about behaviour. | no |
| open-brain/tests/setup-env.ts | historical | see why | Line 49 names an "apoptosis-reachability" suite in a comment recording which suites reset OPEN_BRAIN_VAULT_DIR on 2026-08-31; the suite no longer exists and the line records that incident. | no |
| open-brain/tests/shadow-strategies.test.ts | pin | see why | Lines 80-99 assert that two entries differing only in maturity score identically and no override can change that (maturity is not a ranking input); 32 and 81 are the retained-label fixture values that test uses. | no |
| open-brain/tests/trigger/fires.test.ts | LIVE | see why | LIVE REFERENCE, NOT AN OBITUARY — fix owed: the comment at 125 says ratings in recall_log "move success_rate, which gates apoptosis" in the present tense, as the reason a silent fire must not reach the rated set; neither exists now. | LIVE |
| open-brain/tests/vault-archive.test.ts | historical | see why | Line 78 is a fixture object whose `maturity: "progenitor"` fills the retained stored label required by the frontmatter type; it exercises archiving, not the lifecycle. | no |
| open-brain/tests/vault-writer.test.ts | historical | see why | Lines 66 and 117 are fixture objects whose `maturity: "progenitor"` fills the retained stored label required by the frontmatter type; they exercise note writing, not the lifecycle. | no |

Verification: `npm run build` ok; `sync --check` retirements [pass] (78 allowed referrers present and naming their retirement; the other two issues, worktree-layout and greeting-size, are environmental and predate this change); checks.test.ts, t048-r1b.test.ts, t048-unreadable.test.ts: 124 passed.
