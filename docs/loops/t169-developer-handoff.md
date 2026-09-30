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
