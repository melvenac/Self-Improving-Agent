# QA 271: #404 (T-204 machine lease) rows 14 and 15, on WINDOWS

**By:** Atlas (planner), 2026-10-03, record session 160. This completes QA 269's INCOMPLETE verdict for #404. QA 269
(report `docs/loops/s160d-qa-report.md` on `qa/s160d-report` @ `56ebcf37`) met rows 1, 4 and 13. It could not run rows
14 and 15, because its host was Linux and the harness is PowerShell.

**Host:** the DESKTOP (Windows), booked by clark after Gauge T-091. **Opus. Job class: LIGHT:** one harness run per
head, plus the mutants. No vitest, no full suite.

**Merge authority:** Aaron's batch approval ("Merge all four", 2026-10-03, in the planner's window) did NOT cover #404.
An ACCEPT here goes to him.

**Pinned head:** #404 `5add91379641ef211f98b2f79d1551c0090821eb`. Under D-117 the PR may show a later head that only
adds a merge of master. QA the pinned SHA.

## Safety: this is a real machine

- Run the harness ONLY with `USERPROFILE` (and `HOME`) pointed at a fresh scratch folder under `C:/qa-tmp`. Never touch
  the real `%USERPROFILE%\machine-lease`.
- Before you start, check that the real `C:\Users\melve\machine-lease` folder is ABSENT, and check again at the end.
  If it was present at the start, record its listing (names and times only), touch nothing, and report it.
- Never run the real `qa-queue.ps1` against the live queue. Run only the harness.

## Rows

14. **Harness.** At `5add9137`, `machine-lease-harness.ps1` must pass all 24 rows. Against master's `qa-queue.ps1`
    (`git show origin/master:<path>` into the scratch tree), the 7 queue rows must be RED: R8, R8b, R8c, R9, R9b, R9c
    and R9d. Quote the exit codes and per-row results.
15. **Mutants.** Re-run the developer's `nonatomic` mutant (it should kill R5; run it 30 times, because it is a race)
    and `nostart` (it should kill R3). Then write one of your own: the queue skips the lease call. Each must lose only
    its own row(s). Confirm every edit landed before running.
16. **Crash release.** Take the lease with a child PowerShell process, then kill that process. The next taker must
    see the lease as stale (the pid plus creation-time check) and take it. Report what it printed.

## Rules (headless Claude Code)

- You are **QA 271**, prefix `t204w`. Push ONLY `qa/t204w-*` branches, and only through
  `node docs/loops/qa-271/push-qa.mjs <branch>`, run from your `qa271-wt` tree.
- **Never create, comment on or edit an issue or a PR.** Use `gh` only to read.
- From real config and key files report only counts, names and paths, never values (G-051).
- Commit `docs/loops/t204w-qa-report.md` and its `.E_t.json` on `qa/t204w-report`.
- One verdict for #404, with the pinned SHA. The report's last line is exactly `QA-271: REPORT COMPLETE`.
