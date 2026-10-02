# QA 258, batch B4: session-start fetch and attribution, maturity cut, session-end counts (#289, #290, #294, #299, #302)

**By:** Atlas (planner), 2026-10-02, record session 157, under Aaron's batch-QA rule.

**Merge authority:** B4 is **NOT** covered by Aaron's overnight pre-approval, which names QA 255 to 257 only. An
ACCEPT here waits for his word.

**QA runs on Opus. Job class: LIGHT.** That means touched test files, **one test file per vitest invocation**, mutants
on touched files only, and `gh` reads. No full suite. **Make no live Jev call. Never fetch from or push to the real
origin, except your own report push**: T-208's rows use local bare-repo fixtures.

**Pinned heads.** All are based on master.

| PR | Task | Head | Dev handoff | Prior QA |
|---|---|---|---|---|
| #289 | T-208 r3: fetch before currency, plus the drift line | `be32de21d7d448b5c91b4cfa5411698842c97d80` | `docs/loops/t208-r3-developer-handoff.md`, plus the r2 section in `docs/loops/t208-t212-developer-handoff.md` on #290's branch | QA 254 REJECT (D-102) |
| #290 | T-212: handoff check attributes by trailer (rebased off T-208) | `f707a09c6b61833d5499998d22403037908ebd01` | `docs/loops/t208-t212-developer-handoff.md` | QA 254 ACCEPT at `626f7d13`. Re-verify it is the same content: code `9b076970` |
| #294 | T-215: maturity cut, plus the S4-9.2 allowance table | `39c3cca738081670ab6bb593645f210eab73917e` | `docs/loops/t215-developer-handoff.md` | none |
| #299 | T-050: foreign-writer detector | `483061d04bafe0ac64c4c5692e1dc19e6840b16a` | `docs/loops/t050-developer-handoff.md` | none |
| #302 | T-048: dropped counts (not the sync files) | `ac4323f46eb35527ce0eceeeef6ac6d6afc8cb60` | `docs/loops/t048-developer-handoff.md` | none |

## Rows for each PR

1. **Confined.**
2. **Red then green.** Quote the counts.
3. **One mutant of your own**, plus one of the developer's.
4. **CI on the head.** Run `gh pr checks <n>` and quote `test` and the run id.

## Rows specific to B4

5. **#289, QA 254's failures:**
   - **3b and 5:** the fetch fails while origin is ahead. Neither the hook, nor `ob_start`, nor `/sync` reads `level`.
     The time they name is the last **successful** fetch.
   - **SSH-style stderr:** the cause is the `fatal:` line.
   - **The drift line on startup and resume:** a drifted fixture is named, a clean one reads `none`, and an unreadable
     `state.json` reads `not checked`.
   - **A hanging remote is bounded.** Quote the wall time.
6. **#290 equals QA 254's ACCEPT.** Run `git diff 626f7d13 9b076970 -- open-brain/`: it must be empty, or explain
   every hunk.
   - Re-run QA 254's T-212 rows 8a to 8e and row 10 at `f707a09c`.
7. **#294:**
   - S4-9.2 passes with the `ALLOWED_TEST_LOSSES` table, and the table's counts use the guard's own regex.
   - A third file losing a test still fails.
   - The filename-only mutant goes red.
   - The retirements check passes with the reduced R-011 allowlist.
   - `dashboard.mjs` no longer presents `success_rate` or maturity as live. Read it and quote the relevant lines.
   - `backfill-success-rate.mjs` is deleted.
8. **#299:**
   - The detector reads `.recalled-entries.json` only to report.
   - The ids it returns never reach `resolveRecalledIds`: show the call graph by grep.
   - It reports `none present` when the file is absent, and that is distinct from `not checked`.
9. **#302:** pick 3 of the fixed sites. Each one reports its dropped count, including at zero, and is red before.
10. **Batch merge order.** On a scratch branch from `origin/master`, merge in this order: #290, #289, #294, #302, #299.
    - #299 and #302 both touch session-end files, so a trivial conflict is possible. Report it and do not resolve it.
    - On the merged result, run each touched test file, one per invocation, plus `tsc --noEmit`.

## Rules (headless Claude Code)

- You are **QA 258**, and your prefix is `b4-misc`. Push ONLY `qa/b4-misc-*`, and only through
  `node docs/loops/qa-258/push-qa.mjs <branch>`, run from your `qa258-wt` tree.
- **Never create, comment on or edit an issue or a PR.** Use `gh` only to read.
- From real config files (`~/.claude.json`, `settings.json`, `.mcp.json`, env) report **only counts, key names,
  server names and command paths, never values.** Scan every file you commit for key and token patterns before you
  commit it.
- Commit `docs/loops/b4-misc-qa-report.md` with its `.E_t.json` on `qa/b4-misc-report`.
- Give one verdict line per PR, and a batch verdict.
- The last line is exactly `QA-258: REPORT COMPLETE`.
