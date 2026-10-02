# QA 258, batch B4 (b4-misc): #289, #290, #294, #299, #302

**By:** QA 258 (headless Claude Code, Opus), 2026-10-02, on the DESKTOP. Dispatch: `docs/loops/qa-258-b4-dispatch.md`.
**Dispatch tree:** `git -C ~/qa-scratch/qa258-wt log -1 --format=%H` = `117dc4e3621dd9d5cb69a5461b945598d60023e3`.
**Job class:** LIGHT. One test file per vitest invocation, mutants on touched files only, `gh` reads only. No full suite,
no live Jev call, and no fetch from or push to the real origin except this report's push. Fixtures used local bare repos.
Hook entrypoints ran with HOME, USERPROFILE and KNOWLEDGE_V2_DB isolated under `C:/qa-tmp/qa258/`.

**Method:** five helper agents ran one PR each in parallel, and a sixth ran the batch merge. Each worked in its own
`C:/qa-scratch/qa258-pr<N>` and `qa258-base<N>` trees, which ended clean at their pinned SHAs. Their raw logs and helper
scripts are in `C:/qa-tmp/qa258/<pr>/` on the desktop. Those files are local and not committed. I checked the #302
blocking finding against the code myself (see row 9).

| PR | Task | Head | Base used | Verdict |
|---|---|---|---|---|
| #289 | T-208 r3 | `be32de21` | `50700414` | **ACCEPT** |
| #290 | T-212 | `f707a09c` | `9f6d20df` | **ACCEPT** |
| #294 | T-215 | `39c3cca7` | `50700414` | **ACCEPT** |
| #299 | T-050 | `483061d0` | `00552846` | **ACCEPT** (one follow-up) |
| #302 | T-048 | `ac4323f4` | `00552846` | **REJECT** (row 9, zero not reported at every site) |

All five pinned heads equal the PRs' `headRefOid` on GitHub. **Merge authority:** B4 is outside Aaron's overnight
pre-approval, so each ACCEPT still waits for his word.

---

## #289, T-208 r3: ACCEPT

1. **Confined: met.** 11 files, +576/-7. They are the handoff, 5 mutant diffs, `cli-bootstrap.ts`, `drift-line.ts`
   (new), `tree-currency.ts`, and the new tests `tree-currency-fetch.test.ts` and `drift-line.test.ts`. Every file
   belongs to T-208.
2. **Red then green: met.**
   - `tree-currency-fetch.test.ts`: on base source `Tests  12 failed (12)`, exit 1. On head `Tests  12 passed (12)`,
     exit 0.
   - `drift-line.test.ts`: on base it fails at import (`no tests`). With only `drift-line.ts` added it gives
     `Tests  6 failed | 1 passed (7)`, exit 1. On head `Tests  7 passed (7)`, exit 0.
   - The existing `tree-currency.test.ts` still gives `13 passed (13)` on head. `tsc --noEmit` exits 0.
3. **Mutants: met.**
   - Developer's `last-stderr-line.diff`: `Tests  1 failed | 11 passed (12)`.
   - QA mutant, which records the attempted time as the last fetch: `Tests  3 failed | 9 passed (12)`. Under it the
     3b/5 rows fail, and callers that don't fetch read "level". Both reverted.
4. **CI: met.** `test  pass  2m49s` in run **37005482571**, headSha `be32de21`.
5. **QA 254's failures: met.** Checked on local bare-repo fixtures, with origin 2 commits ahead.
   - **3b and 5:**
     - The fetch fails because origin was repointed to a missing path after an earlier successful fetch.
     - Neither the startup hook, the resume hook, ob_start (`handleStart`) nor `/sync` (`composeGreeting`) says
       "level". Each leads with `fetch FAILED: fatal: …does not appear to be a git repository; currency is against a
       fetch from 12:40:54.523Z`.
     - That time is the last **successful** fetch: the success marker's mtime did not change across the failed runs.
     - A manual failed `git fetch` that empties FETCH_HEAD leaves the time unchanged.
     - Once the remote is restored, the hook prints `THIS TREE IS STALE: 2 commits behind`.
   - **SSH-style stderr:** the printed cause is `fatal: Could not read from remote repository.`, not the last line
     `and the repository exists.`
   - **Drift line, startup and resume:**
     - A drifted SUMMARY is named: `summary-version: expected 1.2.3, got 0.0.1`.
     - A clean fixture reads `Drift: none`.
     - Invalid JSON, a schema-invalid file and a `state.json` that is a directory all read `Drift: not checked (…)`.
   - **Hanging remote bounded:** the upload-pack helper sleeps 300 s. The hook exits 0 after **16,390 ms** (startup),
     **16,453 ms** (resume) and **16,517 ms** (fake ssh), printing `timed out after 15000 ms`.

**Follow-ups, none blocking:**
- (a) When the fetch times out, the hung child process (upload-pack or ssh) is left running, because the kill reaches
  git but not its child. QA killed them by hand.
- (b) An INBOX.md that disagrees with `state.json` still reads `Drift: none`, because no rendered view is compared to
  `state.json`. The handoff discloses this.
- (c) The cause shown is git's generic `fatal:` line, not ssh's more specific `Permission denied (publickey).`
- (d) With no earlier fetch, the line says "an unknown time" and then "as of that old fetch".

## #290, T-212: ACCEPT

1. **Confined: met.** `9f6d20df..f707a09c` changes 5 files, +250/-33: `handoff-guard.ts`, `cli-session-end.ts`,
   `handoff-guard.test.ts`, the handoff, and `t212/mutants/identity-fallback.diff`. No T-208 file is carried.
2. **Red then green: met.** `handoff-guard.test.ts` on base source: `Tests  6 failed | 11 passed (17)`, exit 1, the
   same 6 failures QA 254 saw. On head: `Tests  17 passed (17)`, exit 0.
3. **Mutants: met.**
   - Developer's `identity-fallback.diff`: `Tests  1 failed | 16 passed (17)`, failing on
     `expected 'missing' to be 'no-work'`. The QA fixtures give 6 failed of 18.
   - QA mutant `mut2-body-scan`, which reads the trailer from any paragraph: the unit file survives with
     `17 passed (17)`. The QA fixture 8f (non-final paragraph) kills it, 1 failed of 18. This is a **test gap**: the
     developer's suite does not pin final-paragraph-only.
4. **CI: met.** `test pass 2m40s`, run **37004018054** (pull_request), headSha `f707a09c`. `test-windows` was skipped.
6. **#290 equals QA 254's ACCEPT: met, with every hunk explained.**
   - `git diff 626f7d13 9b076970 -- open-brain/` is **not empty**. It touches 4 files:
     - The three session-start files are T-208's changes, dropped by the rebase off T-208. They equal pre-T-208 master
       `79d1f5d9`.
     - `ci-runs-on.test.ts` matches master's own change between `79d1f5d9` and `9f6d20df` exactly.
   - The three T-212 files have an empty diff, and `git range-diff` prints `626f7d13 = 9b076970`.
   - `9b076970..f707a09c` is two docs-only commits, `77e225bd` and `f707a09c`, with an empty `open-brain/` diff.
   - Re-run of QA 254's rows 8a to 8e and 10 at `f707a09c`: the real `src/cli-session-end.ts` ran through tsx on fixture
     repos, giving `18 passed, 0 failed (18)`.
     - **8a:** `no-work`, 2 commits UNATTRIBUTED, no HANDOFF MISSING.
     - **8c:** HANDOFF MISSING on stdout and stderr, exit 0. It reads `ok` once a handoff is committed.
     - **8d:** `handoff check NOT RUN`.
     - **10:** `committed 3 commit(s) on loop/x, loop/x-redcheck since 2026-09-25T12:00:00.000Z`. With the handoff:
       `handoff committed (...); 1 loop/* commit(s) ... UNATTRIBUTED`.
   - QA 254's 8e note still stands, and does not block: the id match is `includes`, so a trailer for `session_<X>Z` is
     also counted as `<X>`'s.

## #294, T-215: ACCEPT

1. **Confined: met.** 17 files, +214/-215. Each one is an R-011 owed entry, its test, the S4-9.2 guard, or the handoff
   and mutants. Both `server.ts` hunks are comment-only.
2. **Red then green: met.**
   - Head, each file exit 0: s4-guards `14 passed (14)`, retirements-live `2 passed (2)`, ranking `10 passed (10)`,
     index-upsert `10 passed (10)`, cli-flags `32 passed (32)`, trigger/fires `14 passed (14)`, sync/checks
     `102 passed (102)`.
   - The base guard file run on head gives `1 failed | 12 passed (13)`: "cli-flags lost a test: 18 ≥ 19".
   - The head guard file run on base gives `1 failed | 13 passed (14)`: two stale allowances.
   - retirements-live run on base gives `1 failed | 1 passed (2)`: 10 entries still owed.
3. **Mutants: met.**
   - Developer's `dashboard-success-rate.diff` turns retirements-live red, `1 failed | 1 passed (2)`.
   - QA mutant, which re-declares `success_rate` in `db-v2.ts`: index-upsert at head gives `2 failed | 8 passed (10)`,
     while the base test file still passes `10 passed (10)`.
4. **CI: met.** `test pass 2m35s`, run **37004853773**, headSha `39c3cca7`.
7. **Row 7 checks: all met.**
   - **S4-9.2 passes with `ALLOWED_TEST_LOSSES`.** QA counted with the guard's own regex in an independent script:
     - cli-flags goes 19→18 and ranking 11→10. Both counts hold at the guard's fixed `BASE = 2448a6ea` and at the PR
       base.
     - These are the only losses across the 15 changed test files, and they match the table exactly.
   - **A third file losing a test still fails.**
     - Method: committed in a throwaway local clone and pointed git at it with `GIT_DIR`, removing one test from
       `fires.test.ts`.
     - Result: `fires.test.ts lost a test (14 -> 13) with no matching allowance`.
     - Two other rows (D1, F1) also fail under that setup. A control run with the same setup and no mutant shows they
       come from the setup, not the PR.
   - **Filename-only mutant** (developer's `filename-only-allowance.diff`) goes red: `1 failed | 13 passed (14)`.
   - **Retirements check** passes with the reduced R-011 allowlist: 75 allowed referrers (78 at base), 0 unexpected,
     R-011 owed entries 0 (10 at base).
   - **`dashboard.mjs`** at head has no `success_rate` at all (`grep -n success_rate` finds no match). Maturity appears
     only labelled "pre-Loop-10, frozen" in the chart title, filter, column and detail line, with one muted badge
     colour.
   - **`backfill-success-rate.mjs`** exists at base and is deleted at head. `git grep` finds only history docs and the
     CHANGELOG, no code.
   - **`tsc --noEmit`** exits 0.
   - **Minor, not blocking:**
     - Both allowance entries share one reason string.
     - There is no CHANGELOG entry.
     - A NULL maturity reads "unlabelled" in the filter, and choosing it matches no rows.
     - Exact-count allowances will force a table edit at the next test-count change in those two files.

## #299, T-050: ACCEPT (one follow-up)

1. **Confined: met.** 5 files, +182/-9: the handoff, `cli-session-end.ts`, `recalled-ids.ts`, `server.ts` and
   `recalled-ids.test.ts`. The code is all in `ddea392b`; `483061d0` adds only the handoff.
2. **Red then green: met.**
   - `recalled-ids.test.ts` on base source: `Tests  6 failed | 17 passed (23)`, exit 1. FW-1 to FW-6 fail with
     `detectForeignWriter is not a function`.
   - On head: `Tests  23 passed (23)`, exit 0.
3. **Mutants: met.**
   - Developer's, named in the handoff, appends the file's ids to `resolved.ids`: FW-5 kills it,
     `1 failed | 22 passed (23)`.
   - QA mutant 1, an absent file reads `not checked`: FW-3 kills it, `1 failed | 22 passed (23)`.
   - QA mutant 2, an unparseable file is skipped silently: FW-4 kills it, `1 failed | 22 passed (23)`.
4. **CI: met.** `test` passes in run **36981306790** (push) and run **36981312652** (pull_request), headSha
   `483061d0`.
8. **Row 8 checks:**
   - **Reads only to report: met.**
     - `recalled-ids.ts` imports no `fs`, and has no writeFile, unlink, rename, rmSync or appendFile.
     - It reads only through the caller's `readFile`.
     - A real-file run left the fixture's bytes and mtime unchanged.
   - **Ids never reach `resolveRecalledIds`: met.**
     - `detectForeignWriter` has one caller, `recalled-ids.ts:250`, inside `resolveRecalledIdsObserved`. It runs after
       `resolveRecalledIds` at :249.
     - `resolveRecalledIdsObserved` is called from `cli-session-end.ts:120`, `server.ts:543` (ob_end) and
       `server.ts:1348` (ob_recalled).
     - At each call site, the detector's result goes only to `formatForeignWriter`, which produces text.
   - **`none present` vs `not checked`: met as worded.**
     - Absent file: `none present`.
     - Foreign file: `FOUND ... names session X, not Y`.
     - Own file: `none (1 file read…)`.
     - No session id: `not checked`.
   - **Follow-up:** a path that exists but cannot be read (here a directory, EISDIR) also reads `none present`, and
     EBUSY or EACCES likely do the same. The cause is the callers' `readFile` wrapper, which predates this PR and turns
     any error into "no file". This does not affect which entries are rated. Suggested fix: report any error other
     than ENOENT as `not checked (<code>)`.
   - **`tsc --noEmit`:** exit 0.

## #302, T-048: REJECT

1. **Confined: met.** 13 files, +409/-32. Every hunk is a dropped-count site, DC-1 to DC-8, or the code that carries
   its count. `sync/checks-state.ts` (DC-8) and `sync/hub-seats.ts` (DC-6) are touched. The handoff explains why: the
   barred files are `sync/checks.ts` and `sync/index.ts`, and neither is in the diff.
2. **Red then green: met.**
   - `t048-dropped-counts.test.ts`: on base `Tests  9 failed (9)`, exit 1. On head `Tests  9 passed (9)`, exit 0.
   - `checks-state.test.ts`: on base `Tests  2 failed | 20 passed (22)`, exit 1. On head `Tests  22 passed (22)`,
     exit 0.
   - **Disclosure:** the helper's first base run of `t048-dropped-counts.test.ts` did not isolate HOME. That base code
     ignores the test's paths and reads the real context-mode sessions directory read-only. It logged 0 and wrote
     nothing, and the file was red again when re-run isolated.
3. **Mutants: met.** The handoff has no mutant diff, so the developer's M1 was rebuilt from its description.
   - M1 (developer), with `unreadableSessions++` removed: DC-1 kills it, `1 failed | 8 passed (9)`.
   - Q1 (QA), with `deleted++` removed in `checks-state.ts`: DC-8 kills it. It survives `checks-state.test.ts` at
     `22 passed`.
   - Q2 (QA), with the health-checks threshold changed to `> 1`: DC-5 kills it.
4. **CI: met.** `test pass` in run **36982043381** (push) and run **36982048552** (pull_request), at `ac4323f4`.
9. **Three fixed sites: partial, unmet at one site.** Each site is red on base.
   - **Invocation logger (session-end, DC-1/2): met.** With nothing dropped it prints
     `Invocations: 0 logged (0 already logged, 0 unreadable, 0 append failed)`.
   - **Merge markers (sync, DC-8): met.** With nothing dropped it prints
     `...; 0 tracked files not scanned (0 deleted, 0 unreadable, 0 binary)`.
   - **Recalled ids (session-end, DC-3): unmet at zero.**
     - The returned object carries `droppedEntries: 0`, but `formatRecalledResolution` prints the line only when the
       count is non-zero (`recalled-ids.ts:167`, `if (resolved.droppedEntries)`). A reader sees `Recalled ids: 2 from
       file`, the same as on base.
     - Test DC-3b (`t048-dropped-counts.test.ts:76-84`) asserts that silence on purpose:
       `expect(formatRecalledResolution(r).join("\n")).not.toContain("Dropped")`.
     - The T-048 research table (`docs/loops/research/t048-silent-drops.md:67`) says this function "prints the count,
       the origin, and the reason, including at zero". QA 258 checked this against the code.
   - **The other sites:** DC-4, DC-5 and DC-6 also report only when something was dropped. DC-7's new `unusable_roots`
     field is never read by any caller in `src/`.
   - `tsc --noEmit` exits 0.
   - **The fix is small:** print the count at zero at DC-3 to DC-6, and show `unusable_roots` to a reader. If the
     planner rules that a zero in the returned data is enough, this becomes ACCEPT with nothing else blocking.

---

## Row 10, batch merge order: met

- **Setup:** a scratch worktree `C:/qa-scratch/qa258-merge` from `117dc4e3` (origin/master), on a local branch
  `qa258-scratch-merge`. It was never pushed.
- **Merges:** `--no-ff`, in the order #290, #289, #294, #302, #299.
- **Ancestry:** no head is an ancestor of another, and `--cherry-mark` finds no patch-equivalent commits. #290 does not
  carry #289's commits. Every merge was a true 3-way merge.

| PR | Result | Files git auto-merged |
|---|---|---|
| #290 | clean | none |
| #289 | clean | none |
| #294 | clean | `server.ts` |
| #302 | clean | `recalled-ids.ts`, `server.ts`, `active-session.ts` |
| #299 | clean | `cli-session-end.ts`, `recalled-ids.ts`, `server.ts` |

There was **no conflict** between #302 and #299, so nothing was aborted. The merged HEAD is `7c874ba5` (local only), and
there are no conflict markers.

Checks on the merged result: `tsc --noEmit` exits 0. Each touched test file ran in its own invocation, and every one
exited 0:

| Test file | Result |
|---|---|
| cli-flags | `32 passed (32)` |
| harness/s4-guards | `14 passed (14)` |
| index-upsert | `10 passed (10)` |
| session-end/recalled-ids | `23 passed (23)` |
| session-start/drift-line | `7 passed (7)` |
| session-start/tree-currency-fetch | `12 passed (12)` |
| sync/checks-state | `22 passed (22)` |
| sync/retirements-live | `2 passed (2)` |
| ranking | `10 passed (10)` |
| shared/handoff-guard | `17 passed (17)` |
| t048-dropped-counts | `9 passed (9)` |
| trigger/fires | `14 passed (14)` |

A clean textual merge plus tsc and these 12 files is the evidence. The full suite was not run, as a LIGHT job requires.

## Verdicts

- VERDICT #289 (T-208 r3): ACCEPT
- VERDICT #290 (T-212): ACCEPT
- VERDICT #294 (T-215): ACCEPT
- VERDICT #299 (T-050): ACCEPT
- VERDICT #302 (T-048): REJECT. Row 9: the recalled-ids site, DC-3, does not report its dropped count at zero, and its
  own test pins that silence. DC-4, DC-5 and DC-6 are also silent at zero, and DC-7's count is never shown.
- **Batch verdict: REJECT**, because #302 is rejected. The other four can be ruled on separately, and their merge order
  is clean. Every ACCEPT still needs Aaron's word, since B4 is outside the overnight pre-approval.

QA-258: REPORT COMPLETE
