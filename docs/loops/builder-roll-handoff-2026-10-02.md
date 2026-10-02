# Builder (sia-builder) roll handoff, 2026-10-02, record session 157

**By:** Forge (Claude Code, sia-builder checkout on the QA PC). **Written at Atlas's usage STOP.** Nothing is uncommitted; every branch below is pushed. Nothing of mine is merged. `origin/master` was `41864860` when written.
**Rules in force:** LIGHT jobs only; **one test file per vitest invocation** (a multi-file or directory run is HEAVY and needs a slot from clark); `tsc --noEmit` is fine; CI covers the suite. Use `--force-with-lease` only on the branches a dispatch names.

## Where everything is (code SHA = the commit QA should freeze; the branch tip may be a later docs-only commit)

| PR | task | branch | code SHA | CI on the head |
|---|---|---|---|---|
| #287 | T-209 + T-210 (round 2) | `loop/t209-t210-render` | `0085e78a81e445d942965efce1c358fb9e83f57e` | green (all finished, 0 failing) |
| #291 | T-183 (D-100) cut + P2/P3 counts, stacked on #287 | `loop/t183-render-cut` | `f76392d2963ad549defee2e52fecc5ba8eee20b6` | green |
| #297 | T-226 start.md brief text, stacked on #287 | `loop/t226-start-brief-text` | `ba22373c` (tip `fc71d9696527f97f28ac6a7c4cd8ee572e0fa1f0`) | green |
| #292 | T-224 placeholder reason | `loop/t224-placeholder-reason` | `4c2129d3dbe91486488d98ddb64b85c8b2d7c3c8` | green, **but see defect 1** |
| #293 | T-223 pin the PR concurrency group | `loop/t223-pin-pr-group` | `c2d52d8a4521d9a521d85b8416ce873aae836aa0` | green |
| #299 | T-050 foreign-writer detector | `loop/t050-foreign-writer` | `ddea392b37a9a6b6abbeb0cf7e0b230d06e14e9d` (tip `483061d0`) | green |
| #302 | T-048 dropped counts + audit table | `loop/t048-dropped-counts` | `b47eb897d4719271459ecc031f123995ca2212ba` (tip `ac4323f4`) | green |
| #304 | backlog audit (docs only) | `docs/backlog-audit` | `fb65f77f65ba3c2881d90b393abb1b295a4d7864` | green |
| #312 | T-148 legend: ruling on and retiring a task | `loop/t148-legend-retire` | `9a42f7db9307ff2afac016d56eca18a896d50f7b` (tip `19714baa`) | **green (checked)** |
| #313 | T-065 drop `paths.knowledgeDb` | `loop/t065-drop-knowledgedb` | `3b3b6c2a6242712bde4a6d9c672566609e6c88ea` (tip `1c865761`) | **green (checked)** |
| #314 | T-042 vault-pollution check | `loop/t042-vault-pollution` | `41c87b16c2aadbd1a268277911c372d604c095e8` (tip `b20d99a4`) | **green (checked)** |
| none (no PR open) | Jev calibration 1, Phase 1 set | `loop/jev-calibration-1-set` | freeze `a26e44d0559b9ad855578d3297c3e61debaee71e`, tip `fd3e9642` | PR #285 was Atlas's to merge; not re-checked |

Per-task evidence (red before, green after, mutants) is in each branch's handoff: `docs/loops/t209-t210-developer-handoff.md`, `session-157-builder-2-handoff.md` (T-183, T-224, T-223 and the dispatch-3 addendum, on the T-183 branch), `t226-developer-handoff.md`, `t050-developer-handoff.md`, `t048-developer-handoff.md`, `t148-developer-handoff.md`, `t065-developer-handoff.md`, `t042-developer-handoff.md`, `docs/loops/jev-calibration-1-set-handoff.md`, `docs/loops/backlog-audit-2026-10-02.md`.
Some of those handoffs quote earlier SHAs: #291's and #297's handoffs were written before the round-2 rebase, so their SHAs are stale. **The table above is current; it wins.**

## Open items, in order

1. **Defect in #292 (T-224), Atlas ruled YES, fold into the next round after the reset, do not push now.** `PLACEHOLDER` in `open-brain/src/pipelines/session-start/agent-identity.ts:121` reads `/<[^<>s]+>/`, which excludes the letter "s" instead of whitespace (the backslash was lost in a shell-quoted edit). A placeholder like `<status>` is not detected. The tests did not catch it because `<agent-name>` and `<role>` contain no "s". **Fix:** `/<[^<>\s]+>/`, plus a standing-cron row with an "s" in the placeholder (for example `status_to: <status-agent>`), red first. It is the same defect class as the T-209 regex bug in QA 253 (`/(d+)s*$/`). **I checked the other branches for it** (`git diff origin/master..<branch>` scanned for dropped backslashes in regexes): only #292, #291 and #297 (the latter two carried the T-209 copy, now fixed) had any.
2. **Process lesson, so it is not repeated:** edits made through `node -e '...'` in a shell, or sed with a replacement containing backslash escapes, lose backslashes silently. Both regex defects came from that. Use the Edit/Write tools, or a script file written with Write, for any code containing `\`. And run the file that pins the behaviour you changed (`server.test.ts` for anything in the greeting) before claiming a branch is done: round 1 of T-183 and T-209 skipped it.
3. **Not done from rulings and findings:**
   - T-048's deferred findings (the five to go in the record, and the 18 rows in sia-forge's files) are in `t048-developer-handoff.md`; nothing to build.
   - The tracked `.agents/TASKS/INBOX.md` keeps the old legend until the next `ob_state` write re-renders it (after #312 merges).
   - `master` showed a failed `workflow_dispatch` CI run (36984810269) for `5ec37cdf` while its push run was green; not mine, not investigated.
4. **Next work, if Atlas wants more:** the backlog audit's top 10 are done through T-148, T-065 and T-042. Left: T-186 (BOM in `applySummaryRegion`; run `impact` first, rated HIGH; PR #308 `loop/t186-summary-bom` is open and is **not mine**), T-188, T-184, T-182, T-156, T-168, T-225 item 4. T-167's remaining half is in `sync/checks.ts` (sia-forge's).
5. **Standing:** the planner decides every merge (D-019, Aaron's). Reports go to `atlas-sia`, or `clark` if unreachable. The repo is public: no issues and no comments; the only PR actions are the ones a dispatch authorises.

## Environment facts that bit this session
- The Bash tool mangles `git ref:path` (MSYS) and heredocs that contain a line `EOF` or odd quoting can abort the whole command: write files with the Write tool.
- `GitNexus` has no index in this checkout, so `impact` could not run; callers were checked by `git grep`.
- Local CLI build is stale (`build-freshness` issue); `node open-brain/node_modules/tsx/dist/cli.mjs open-brain/src/cli.ts sync --check` runs from source.
- The standing `sync --check` issues (build-freshness, worktree-layout, cursor-hook-compat, plus greeting-size until #291 merges) are not from these branches.
