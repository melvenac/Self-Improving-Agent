# QA 248: Loop 15 slice four, step 4 RE-RUN: the live Jev calls and the close-out

**By:** Atlas (planner), record session 156, 2026-10-02. **This re-runs QA 245**, which got HTTP 401 on its first
call (D-092, `docs/loops/qa-245-rulings.md`). **Code under use:** `origin/master` at or after T-220's merge.
**Seat:** the QA seat, headless Claude Code on Opus, on the **laptop**.

**Job class: LIGHT** (clark's booking, QA 2 of 2). The job runs `npm ci`, the build, `tsc --noEmit`, the harness
commands, which call the Typesafe API, the key scan and the touched harness tests. **No Convex stack, no mutants,
no full vitest suite.**

**Key:** Aaron issued a new `TYPESAFE_API_KEY` at about 04:05Z, as a User environment variable on the laptop.
clark checked it with an empty POST and got 422, so auth passes. The launcher starts the seat from a **fresh**
process so that it inherits the new value. **Budget:** Aaron said "the $5 covers the api calls". There is no pause
to check usage, but every record keeps `usage`.

## Base

Everything in `docs/loops/qa-245-s4-step4-dispatch.md` applies unless an amendment below changes it. Read that file
first, then these amendments in order.

## Amendments (D-092)

1. **Budget.** 13 primary calls: 4.2 once, 4.3 eight times, 4.4 five times. At most 3 retries. **The total in
   `count-attempts` must stay ≤ 17, counting QA 245's existing `auth` record**, so 17 is the dispatch's own
   ceiling. Before the next call, run `harness count-attempts`. If that call would take the total past 17, stop and
   write "Open for the planner".
2. **On `auth`, stop ALL items** (ruling 2). On `request-invalid`, `unexpected-status` or `malformed-response`, stop
   that item and go on to the next one.
3. **The new 4.2 attempt is not a re-roll** (ruling 3). QA 245's record has no answer. If `count-attempts` flags a
   second record for the plan subject with no `retry_of`, quote the flag and cite ruling 3. **Never edit or delete
   QA 245's record.**
4. **Drop `harness validate gate-record` for 4.2** (F1). Keep it for every `G_done` and `G_qa`.
5. **The key scan (K1):** the scan must print the **absolute path** of the transcript it scanned, and that path must
   be this session's own `.jsonl`. Name the session id in the report. The transcript category passes only if the
   path it printed is that file.
6. **The close-out tables** come from `harness closeout-tables` on master at or after T-220. Check that the output
   has the `E_t source: the criteria Terms table` line. Regenerate the existing close-out in place; do not hand-edit
   the tables.
7. **TEMP and TMP** are set by the launcher. Do not set them yourself.

## Rules

- You are **QA 248**, prefix `s4-rerun`. Push ONLY `qa/s4-rerun-*` branches, and only through
  `node docs/loops/qa-248/push-qa.mjs <branch>`. That is QA 245's helper with the prefix changed; the planner has
  already checked that it refuses other prefixes, a second argument and a missing local branch. Do not edit it.
- The report is `docs/loops/loop-15-slice-4-step4-rerun-qa-report.md` with its `.E_t.json`, on
  `qa/s4-rerun-report`. Commit every new gate record, the ledger, the close-out and the scan output alongside it.
- The key rules are unchanged from QA 245: never print the key, never write it anywhere, and never put it on a
  command line.
- Make no CI run, open no issue or PR, and write no comment (the repo is PUBLIC).
- The last line is exactly `QA-248: REPORT COMPLETE`.
