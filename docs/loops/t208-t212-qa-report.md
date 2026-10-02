# QA 254 report: T-208 (fetch before currency) + T-212 (handoff check attributes by trailer)

**By:** QA 254 (headless Claude Code, Opus 5.5), record session 254, 2026-10-02. **Dispatch:**
`docs/loops/qa-254-t208-t212-dispatch.md`. **Dispatch tree:** `~/qa-scratch/qa254-wt` at
`5ec37cdf4d5566237bb3ecfc552d77cc0b486e69` (`git -C ~/qa-scratch/qa254-wt log -1 --format=%H`).
**Candidates:** T-208 `e442b955f2b713c7bdddb1edb5bb86253dfe0203` (`~/qa-scratch/qa254-t208`, = `origin/loop/t208-fetch-first`),
T-212 `626f7d1347d3080ae2dd15022391f4f402a6d495` (`~/qa-scratch/qa254-t212`; branch tip `1e61ccb2` = `origin/loop/t212-trailer-attribution`).
**Base:** `79d1f5d915e2fb89680afec51ead485c9cf4e893` (`~/qa-scratch/qa254-base`).

Job class LIGHT: touched test files, neighbours, mutants on those files only, `gh` reads. No full suite. **No live Jev
call.** No fetch from or push to the real origin except this report's push; every fixture origin is a local bare repo
or a path that does not exist, and every hook run had `HOME` set to a scratch directory. `node_modules` was copied from
QA 253's tree (`package-lock.json` byte-identical) because `npm ci` was not permitted in this job. No issue or PR was
created, commented on or edited. QA scripts: `~/qa-tmp/{vt.mjs,mut.mjs,t208-fx.mjs,t208-time.mjs,t208-after.mjs,t212-fx.mts}`.

## Verdicts

- **T-208 (`e442b955`): REJECT.** A failed start fetch rewrites `FETCH_HEAD`. The FAILED line then names the failed
  attempt's time as "a fetch from <time>", and afterwards `ob_start` and `/sync` read **"level with origin/master,
  compared against the last fetch (<that time>)"** while origin is ahead. This is T-208's own evidence scenario, now
  carrying a fresh-looking timestamp, and base does not do it (rows 3b, 5). Second defect: the `<cause>` is the last
  stderr line, which is `and the repository exists.` for a missing path and for every SSH failure. This repo's origin
  is SSH.
- **T-212 (`626f7d13`): ACCEPT.** Every row met. Notes below; none blocks.
- **Pair: REJECT** (T-208). T-212 is stacked on T-208 and carries `e442b955`, so its branch cannot merge as it is
  until T-208 is fixed or T-212 is rebased.

## T-208 rows

### 1. Confined: MET

`git diff --stat 79d1f5d9...e442b955`:

```
 docs/loops/t208/mutants/skip-fetch.diff            |  13 ++
 open-brain/src/cli-bootstrap.ts                    |   7 +-
 .../src/pipelines/session-start/tree-currency.ts   |  70 +++++++++-
 .../session-start/tree-currency-fetch.test.ts      | 149 +++++++++++++++++++++
```

### 2. Red then green: MET

The candidate's `tree-currency-fetch.test.ts` copied onto base source: **7 failed (7)**. Rows 1 and 5 (startup and
resume) fail with `expected 'Project detected: …' to contain 'THIS TREE IS STALE: 1 commit behind o…'` and
`… not to contain 'origin/feature'`. Row 2 fails with `expected undefined to be defined` (base printed `Tree currency:
level with origin/master …`). Row 3 and the success row fail with `fetchOrigin is not a function`. At the candidate:
**7 passed (7)**.

### 3. Own fixtures (`~/qa-tmp/t208-fx.mjs`, the real hook `src/cli-bootstrap.ts` via tsx, local bare origins)

At the candidate, 10 of 11 pass. The failure is an edge case (3b-edge below).

- **(a) Origin moved after the last fetch: MET.** Origin advanced 2 commits; the clone did not fetch. Startup and
  resume both print `THIS TREE IS STALE: 2 commits behind origin/master — record here rev 10, at origin/master rev 12`,
  and no `level`.
- **(b) Unreachable origin: PARTIAL.** Origin URL is a path that does not exist. The output (startup and resume) is:
  ```
  fetch FAILED: and the repository exists.; currency is against a fetch from 2026-10-02T08:26:50.097Z
  Tree currency: no difference seen against origin/master (record here rev 10, at origin/master rev 10) as of that old fetch, and not confirmed since. …
  ```
  The shape is right and `level` is absent on the `current` path. Three defects:
  1. **The time is not the old fetch.** In `~/qa-tmp/t208-time.mjs`, the last good fetch was at `08:28:05.049Z`.
     After a 4 s pause, the hook ran at `08:28:09.073Z` and printed **`a fetch from 2026-10-02T08:28:10.816Z`**, which
     is the failed attempt. `FETCH_HEAD` mtime after the hook is `08:28:10.816Z` and its size is **0**. `git fetch`
     truncates `FETCH_HEAD` even when it fails, and `readLastFetchAt` reads that file's mtime. The hang case is the
     same: old fetch `08:28:11.117Z`, printed `08:28:16.563Z`. The handoff's claim that the line "ends with an ISO time
     (the old fetch)" is false. The candidate's row 2 checks only the ISO format, so it cannot see this.
  2. **`ob_start` and `/sync` then say `level` against a moved origin** (`~/qa-tmp/t208-after.mjs`). The last good
     fetch was at `08:28:52.238Z`, then origin moved +1 and became unreachable, and the hook failed. The next
     `describeTreeCurrency(root)` (the exact call at `server.ts:242` and `checks.ts:1804`) prints:
     `Tree currency: level with origin/master (record here rev 1, at origin/master rev 1) — compared against the last fetch (2026-10-02T08:28:56.835Z), not the network.`
     That is unqualified `level`, with a timestamp from seconds ago, against an origin that is 1 commit ahead. **At
     base, the same sequence prints the true old time `08:29:05.023Z`**, because base never runs a failing fetch. T-208
     makes the stale comparison look fresh.
  3. **The cause is not a cause.** `fetchOrigin` keeps the last non-empty stderr line. For a missing path, git prints
     `fatal: '<path>' does not appear to be a git repository` / `fatal: Could not read from remote repository.` /
     `Please make sure you have the correct access rights` / `and the repository exists.`. The cause shown is
     `and the repository exists.` SSH failures print the same tail (checked with `ls-remote git@nonexistent.invalid:x/y.git`),
     and this repo's origin is `git@github-sia:melvenac/Self-Improving-Agent.git`. So any non-timeout failure in real
     use would print a cause that names nothing.
  - **3b-edge, FAIL:** a failed fetch on a tree whose commits are level but whose working record is behind passes the
    lines through unchanged. The output has `THE RECORD HERE IS BEHIND although the commits are level with
    origin/master` after the FAILED line, so the dispatch's literal test ("the word `level` does not appear after it")
    fails. Similarly, `ahead` keeps `Not stale; local work is not yet on master` after a failed fetch. These are minor
    next to the two defects above.
- **(c) Hanging remote: MET.** `remote.origin.uploadpack` is a node script that sleeps 300 s, and the full hook runs
  with the default 15 s bound. **Wall time 16 677 ms (startup) and 16 667 ms (resume)**, exit 0, first line
  `fetch FAILED: timed out after 15000 ms; currency is against a fetch from …`. (The time is again the failed
  attempt's; see (b).)
- **(d) Prune: MET.** `origin/loop/gone` deleted on the origin. Refs before the hook were `origin/loop/gone`,
  `origin/loop/stays` and `origin/master`; after the hook, `origin/loop/stays` and `origin/master`. Startup and resume
  both.
- **(e) Resume: MET.** (a) through (d) all ran with `source: "resume"` and gave the same results. The hook has no
  branch on `source`, and `scripts/setup-hooks.mjs:58` registers SessionStart with `matcher: ''`.

### 4. Own mutants (`~/qa-tmp/mut.mjs`; each `tsc --noEmit` 0)

| mutant | candidate `tree-currency-fetch.test.ts` | QA fixtures |
| --- | --- | --- |
| (a) skip the fetch (`fetch: (void fetchOrigin, undefined)`) | **killed**: 5 failed / 2 passed (rows 1 ×2, 5 ×2, 2) | **killed**: all 8 (3a–3d, startup and resume) |
| (b) drop `timeout: timeoutMs` | **killed**: row 3 only (`expected 'and the repository exists.' to contain 'timed out after 1500 ms'`; the 4 s sleep ends on its own) | **killed**: 3c ×2; the hook hung until QA's 120 s cap (exit 143) |
| (c) say `level` after a failed fetch (`false ? […] : result.lines`) | **killed**: rows 2 and 3 (`not to contain 'level with'`) | **killed**: 3b ×2, 3c ×2 |

No mutant was written for the timestamp defect, because the code already behaves that way. Neither suite catches it.

### 5. `ob_start` states its fetch time; `/start` has no fetch step: MET as worded, but see 3b

`describeTreeCurrency(clone)` with no `fetch` option (the `ob_start` path, `server.ts:242`), after a good fetch, prints:
`Tree currency: level with origin/master (record here rev 10, at origin/master rev 10) — compared against the last fetch (2026-10-02T08:27:35.378Z), not the network.`
After a failed hook fetch, that same time is the failed attempt's (3b.2).

`git grep -n -i fetch -- .claude/commands/start.md project-template/.claude/commands/start.md .cursor/commands/start.md project-template/.cursor/commands/start.md`
at `e442b955`: **no match (exit 1)**. `git diff --stat 79d1f5d9 e442b955 -- '*start.md'`: empty.

### Not a dispatch row

T-208's note added an acceptance row in planner session 153: "fires on SessionStart resume as well as startup, **and
prints tree currency and drift in one line**". Resume is met. The hook still prints no drift (`cli-bootstrap.ts`
contains "drift" only in a comment), and the handoff does not mention it. Planner to rule.

## T-212 rows

### 6. Confined: MET (the caller hunk is 3 lines, not 1)

`git diff --stat e442b955...626f7d13`: `open-brain/src/cli-session-end.ts | 6 +-`, `open-brain/src/shared/handoff-guard.ts | 81 ++++--`,
`open-brain/tests/shared/handoff-guard.test.ts | 93 ++++--`. `1e61ccb2` adds only the handoff and
`docs/loops/t212/mutants/identity-fallback.diff`. The `cli-session-end.ts` hunk:

```diff
-import { checkSessionHandoff, describeMissing, recordMissingHandoff, sessionStartFromTranscript } from "./shared/handoff-guard.js";
+import { checkSessionHandoff, describeMissing, recordMissingHandoff, sessionIdsFromTranscript, sessionStartFromTranscript } from "./shared/handoff-guard.js";
@@ -77,7 +77,7 @@
-    const check = checkSessionHandoff(dir, sessionStartFromTranscript(hookPayload.transcript_path));
+    const check = checkSessionHandoff(dir, sessionStartFromTranscript(hookPayload.transcript_path), sessionIdsFromTranscript(hookPayload.transcript_path));
@@ -86,7 +86,7 @@
-      console.log(`[session-end] handoff check: ${check.status === "ok" ? `handoff committed (${check.handoffs.join(", ")})` : "no loop/* commits this session"}`);
+      console.log(`[session-end] handoff check: ${check.status === "ok" ? `handoff committed (${check.handoffs.join(", ")})` : "no loop/* commits attributed to this session"}${check.unattributed > 0 ? `; ${check.unattributed} loop/* commit(s) in the window carry no Claude-Session trailer: UNATTRIBUTED, not counted for any seat` : ""}`);
```

The handoff and dispatch both say "one line". There are three: the import, the call, and the no-work/ok message
(which now reports UNATTRIBUTED). All three are needed for the feature and stay in the only caller. Not blocking.

### 7. Red then green: MET

The candidate's `handoff-guard.test.ts` on `e442b955` source: **6 failed | 11 passed (17)**. Row 1 and row 2 fail with
`expected 'missing' to be 'no-work'`, row 3 with `expected 3 to be 1`, the other-seat handoff with `expected 'ok' to be
'missing'`, the no-id case with `expected 'missing' to be 'unknown'`, and the reader with `sessionIdsFromTranscript is
not a function`. At the candidate: **17 passed (17)**.

### 8. Own fixtures (`~/qa-tmp/t212-fx.mts`): 19 of 19 at the candidate

Every repo uses the shared identity `Aaron Melven`. Each real SessionEnd hook run (`src/cli-session-end.ts`) had a
scratch HOME and `KNOWLEDGE_V2_DB`.

- **(a) Shared identity, no trailer: MET.** Two untrailered commits on `loop/x`. Result
  `{"status":"no-work","commits":0,"unattributed":2}`. The real hook exits 0 and prints `handoff check: no loop/* commits
  attributed to this session; 2 loop/* commit(s) in the window carry no Claude-Session trailer: UNATTRIBUTED, not
  counted for any seat`. No HANDOFF MISSING.
- **(b) Trailer for another session: MET.** `{"status":"no-work","commits":0,"unattributed":0}`.
- **(c) Trailer for this session: MET.** `{"status":"missing","commits":1}`. The real hook prints `HANDOFF MISSING:
  session … committed 1 commit(s) on loop/x …` on stdout and stderr, exit 0. With a `docs/loops/*-handoff.md` added
  under this session's trailer: `{"status":"ok","commits":2}`.
- **(d) No `bridge-session` line: MET.** `sessionIdsFromTranscript` returns `[]` and the status is `unknown`, with the
  reason `this session's Claude-Session id could not be read from its transcript …`. The real hook prints `handoff
  check NOT RUN: …`. Never a pass.
- **(e) `cse_<X>` in the transcript, `session_<X>` in the trailer: MET.** The id was read through
  `sessionIdsFromTranscript` (not fed in by hand) as `["01QaMeQaMeQaMeQaMeQaMeQa"]`, and the commit was counted.
  - Observation: matching is `trailer.includes(id)`, so a trailer for `session_<X>Z` is counted as `<X>`'s. Real ids
    are fixed length (24 characters, as on master), so this does not matter in practice.
  - Not verified by QA: that a real transcript's `cse_<X>` equals a real trailer's `session_<X>`. Only 1 of the 17
    transcripts on this machine has a `bridgeSessionId` line (`cse_01R33wj1Cx34bdntZMwpX2bo`), and no commit carries
    that id. The developer says they checked it on their own transcript.
- **(f) Case and whitespace.** Git's `%(trailers:key=…)` does the parsing.
  - **Counted:** key `claude-session:` and key `CLAUDE-SESSION:` (key match is case-insensitive); extra spaces after
    the colon; a space before the colon; `Session_` capitalised in the URL; a bare id with no URL; a trailer after
    `Co-Authored-By`; two trailers where the second is this session's.
  - **Ignored, read as another session's:** the id lower-cased in the value. The match is case-sensitive, which is
    correct, because ids are case-sensitive.
  - **UNATTRIBUTED:** a trailer that is not in the last paragraph, because git does not see it as a trailer.

  None of this matters in practice. The trailer is written by the tool, and every failure mode falls to "not
  counted", never to "blamed".

### 9. Own mutant: fall back to identity: KILLED

The mutant counts an untrailered commit as this session's when its author equals `git config user.name`. `tsc` 0.

- Candidate test: **2 failed | 15 passed**. Row 1 fails with `expected 'missing' to be 'no-work'`. Row 3 fails only
  incidentally: `git config user.name` throws because that test repo has no `user.name`.
- QA fixtures: **8a** fails with `{"status":"missing","commits":2,"unattributed":0}` and the hook blames the session.
  **10-missing** fails because 4 commits are counted instead of 3. 17 of 19 pass.

### 10. Regression: the check still warns for a seat with trailers: MET

Commits on `loop/x` and `loop/x-redcheck` carry this session's trailer: one written with git's own `--trailer`, one
after `Co-Authored-By`, one plain. One untrailered commit is mixed in, and there is no handoff. Result
`{"status":"missing","commits":3,"unattributed":1}`. The real hook prints `HANDOFF MISSING: session … committed 3
commit(s) on loop/x, loop/x-redcheck since 2026-09-25T12:00:00.000Z …` on stdout and stderr, exit 0. After a handoff
is committed under the trailer, it prints `handoff check: handoff committed (docs/loops/qa254-y-developer-handoff.md);
1 loop/* commit(s) … UNATTRIBUTED`. T-212 did not make the check inert for trailered seats. Of the last 300 commits on
`origin/master`, every recent seat commit carries a `Claude-Session` trailer.

Consequence, also stated in the handoff: a session whose transcript has no `bridge-session` line now always gets
`NOT RUN`. On this QA machine that is 16 of 17 transcripts, but QA seats commit to `qa/*`, not `loop/*`.

## Both

### 11. Nothing else moved: MET

- `tsc --noEmit`: **exit 0** at `e442b955` and at `626f7d13`.
- Touched tests plus neighbours: `tests/pipelines/session-start` (all), `tests/pipelines/session-end`,
  `tests/shared/handoff-guard.test.ts`, `tests/cli-bootstrap.test.ts`. Result: **19 files, 223 passed, exit 0 at T-208**;
  **19 files, 229 passed, exit 0 at T-212**.
- With `bootstrap-fix{,-r3,-r4}.test.ts` and `qa135-bootstrap.test.ts` added, all tests pass (23 files, 286 at T-208,
  292 at T-212), but vitest exits 1 on `Error: [vitest-worker]: Timeout calling "onTaskUpdate"`. **The same set at
  base `79d1f5d9` gives the same error** (22 files, 279 passed, exit 1). It predates the candidates and is an
  environment issue: workers on this machine are starved by long `spawnSync` tests.

### 12. CI on the heads (read only)

| head | run | event | conclusion | `test` | other jobs |
| --- | --- | --- | --- | --- | --- |
| `e442b955` | 36979508568 | push | success | success | changed success, test-windows skipped |
| `e442b955` | 36979522661 | pull_request | success | success | changed success, test-windows skipped |
| `626f7d13` | none | (`gh run list --commit` is empty; it was never a branch tip on its own) | | | |
| `1e61ccb2` | 36979509712 | push | success | success | changed success, test-windows skipped |
| `1e61ccb2` | 36979526571 | pull_request | success | success | changed success, test-windows skipped |

`1e61ccb2` differs from `626f7d13` only in `docs/loops/` (the handoff and a mutant diff), so its runs cover T-212's
code. `test-windows` was skipped on every run, so the Windows hang note in the handoff is not checked by CI.

## For the developer (T-208 r2)

- Read `lastFetchAt` **before** the fetch, or pass the pre-fetch value into the FAILED line, and make sure a failed fetch
  does not leave `FETCH_HEAD`'s mtime as the "last fetch". For example, use `--no-write-fetch-head` and record the
  time of a successful fetch somewhere else, or restore the old mtime on failure. Add a row that asserts the printed
  time equals the pre-hook `FETCH_HEAD` mtime, and a row that `describeTreeCurrency(root)` after a failed hook does not
  say `level` against a moved origin.
- Take the `fatal:` line, or the first stderr line, as the cause, not the last line.
- Decide the wording of `record-behind` and `ahead` after a failed fetch.

QA-254: REPORT COMPLETE
