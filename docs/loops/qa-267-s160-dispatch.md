# QA 267, session-160 batch: #387, #388, #391, #393

**By:** Atlas (planner), 2026-10-03, record session 160. Aaron's instruction in the planner's window: "book QA 267 for
#387 and #388, plus whatever T-236 slices are still to come." The two T-236 slices are #391 and #393. FOCUS/SEATS (item
(c)) waits for T-203 and is not in this batch.

**Merge authority:** none pre-approved. An ACCEPT waits for one batch approval from Aaron naming every PR and SHA.

**QA runs on Opus** (all four were built by Claude Code Sonnet seats). **Job class: LIGHT:** touched test files, **one
test file per vitest invocation**, mutants on touched files only, `tsc --noEmit`, `npm run typecheck:tests`, and `gh`
reads. No full suite, no live Jev call, and nothing run against the real home directory.

**Master at dispatch:** `a68d0393` (#394 merged).

**Pinned heads:**

| PR | Task | Head | Scope note |
|---|---|---|---|
| #387 | T-232 follow-up: the retention summary line appears exactly once per write | `9d1ed0c5` (full SHA from `gh pr view 387 --json headRefOid`) | test-only, `server.test.ts` |
| #388 | T-229 follow-up: only ENOENT counts as absent in `readRecalledFile` (EACCES/EPERM/EBUSY/ENOTDIR/EMFILE) | `913a5a43` | test-only, `recalled-ids.test.ts` |
| #391 | T-236 slice 1: role docs printed in full only when changed since this seat's last read (closes T-183) | `b2096051` | adds `greeting-flags.ts`, `greeting.json`, A2A fixture |
| #393 | T-236 slice 2: handoff caps, expires, owner, NEXT-by-ids, briefing budget (all opt-in) | `4020a42b` | 3 commits: goldens first (`f5512b6a`), feature (`e4d4f46d`), flag ruling (`4020a42b`) |

Resolve each short SHA to its full SHA and write both into the report. If a head has moved when you start, QA the
pinned SHA and say so. Never QA an unpinned head.

Brief: `docs/loops/t236-brief.md`, plus T-236's note in `.agents/state.json`, which holds the rulings, the opt-in
amendment and the flag ruling. #387's ruling is in T-232's note and #388's is in T-229's note.

## Rows for every PR

1. **Confined.** List the files each PR changes beyond `origin/master`. Flag any file outside the task. The planner's
   counts are 1 / 1 / 8 / 16 files, from `git diff --name-only origin/master...<head>` at `a68d0393`.
2. **Red then green.** Run the new or changed test files against master's source (they should fail) and against the
   head (they should pass), and quote the counts. #387 and #388 are pins on product code that is already correct, so
   for them the red evidence is the product mutant in row 3. Do not report a red run on master for those two.
3. **Mutants.** Write one product mutant of your own and re-run one of the developer's named in the PR body. Each must
   turn a row red. Run `tsc --noEmit` on every mutant before counting it, and confirm the edit landed.
4. **CI (read only).** Run `gh pr checks <n>` and record the `test` result and run id.

## Rows specific to T-236 (#391, #393)

5. **Flag OFF is byte-identical.** Both PRs claim that with `greeting.json` absent or set to `false`, output is
   byte-identical to master's renderer. Check this on the A2A fixture and on SIA's fixture. For #393, confirm that the
   golden `a2a-1c200b41-render.golden.txt` was committed in `f5512b6a` before any product change: `git show --stat`
   that commit, and run the golden test at that commit against master's `src`.
6. **The A2A fixture is the ruled one.** `open-brain/tests/fixtures-state/a2a-state-1c200b41.json` must be 260,229
   bytes, have sha256 `8892464b6608a82c38fa63e878b2458412fbbd12a15471c0d6aea94f21004549` and blob `3cc195a5…`, and be
   identical in both PRs.
7. **One flag reader.** `greeting-flags.ts` and the `.gitignore` allowlist line must be byte-identical in #391 and
   #393 (the planner measured `6168e07e` and `143ad2bb` in both). No other file may parse `greeting.json`; check with
   `git grep greeting.json -- open-brain/src` at the merged tree.
8. **The flag values ruled for SIA.** #391's `greeting.json` sets `role_docs_by_sha: true`; #393's sets
   `briefing_budget: true` and `handoff_caps: false`. The handoff caps stay off until the D-110 split.
9. **#391 records a read only after printing it.** Show that `recordRoleReads` is called only from `handleStart` after
   the full text is in the output, and that `describeRoleFiles` and `composeGreeting` (the greeting-size check) never
   record. Re-run the developer's M3 or M4.
10. **#393 caps (flag on, in a scratch fixture).** `set_handoff` refuses four watch-outs, a watch-out longer than 200
    characters or spanning more than one line, and a `pick_up` longer than 400 characters, naming every violation.
    An expired watch-out is dropped and counted. `WAITING ON AARON` lists only unresolved `owner: aaron` questions.
    NEXT appears only when the objective names task ids. The worst-case budget fits 30 lines and 4,096 characters,
    and the overflow prints `+N more: <pointer>`.
11. **A2A safety.** Every new schema field is optional. The A2A fixture still parses with master's schema, and
    `renderBriefing` over it with every flag absent matches the golden.

## Batch merge row

12. In `~/qa-scratch/qa267-merge`, start from `a68d0393` and merge the pinned heads in order #387, #388, #391, #393.
    **The planner's own trial run showed one conflict:** `.agents/SYSTEM/greeting.json` at #393, between
    `"role_docs_by_sha": true` (from #391) and `"briefing_budget": true, "handoff_caps": false` (from #393). The other
    three merges and the shared `server.test.ts` edits (#387 and #393) merged cleanly. Resolve it to the three keys in
    sorted order (`briefing_budget: true`, `handoff_caps: false`, `role_docs_by_sha: true`). Then run `tsc --noEmit`,
    `npm run typecheck:tests` and these test files, one per run: `server.test.ts`, `recalled-ids.test.ts`,
    `role-docs-by-sha.test.ts`, `role-files.test.ts`, `a2a-byte-identical.test.ts`, `briefing-budget.test.ts`,
    `handoff-caps.test.ts` and `briefing.test.ts`. Quote the counts.

## Rules (headless Claude Code)

- You are **QA 267**, prefix `s160b`. Push ONLY `qa/s160b-*` branches, and only through
  `node docs/loops/qa-267/push-qa.mjs <branch>`, run from your `qa267-wt` tree.
- **Never create, comment on or edit an issue or a PR.** Use `gh` only to read.
- From real config and key files report only counts, names and paths, never values (G-051).
- Commit `docs/loops/s160b-qa-report.md` and its `.E_t.json` on `qa/s160b-report`.
- Give one verdict per PR in the report (ACCEPT / REJECT / INCOMPLETE) with the pinned SHA. The report's last line is
  exactly `QA-267: REPORT COMPLETE`.
