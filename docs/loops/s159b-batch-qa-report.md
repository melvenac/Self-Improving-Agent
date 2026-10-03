# QA 265 report: session-159 batch 2 (#374 r2 narrow, #377, #378, #379, #382)

**By:** QA 265 (headless Claude Code, Opus 5.5), record session 159, prefix `s159b-batch`. Dispatch:
`docs/loops/qa-265-s159b-dispatch.md`.
**Dispatch tree:** `git -C ~/qa-scratch/qa265-wt log -1 --format=%H` = `0c1f84327bd4da670ff45bfa5370830e5ccee2c6`.
**origin/master at start:** `0c1f8432`. Its code (open-brain, project-template, .claude) is identical to `5a7bf167`, the
master named in the dispatch (`git diff --stat 5a7bf167 0c1f8432 -- open-brain project-template .claude` is empty).
**Job class:** LIGHT. Touched test files only, one file per vitest invocation, no full suite, no live Jev call. `gh` was used
to read only.

## Pinned heads

Every head equalled its pin when the job started (`gh pr view`). All five PRs are OPEN and based on `master`.

| PR | Pinned head | Head at start | Merge base with master |
|---|---|---|---|
| #374 | `40105c1fa2ed6d40f85cbd18660e178d7ff787b7` | same | `5a7bf167` |
| #377 | `da6cdd97101318da51f995dfec0e1bff6430ae79` | same | `1a54588c` (pre-#371) |
| #378 | `b24ea6a0a43b9b92188e130ec814f502e457ae4b` | same | `1a54588c` (pre-#371) |
| #379 | `89ab68b25c4a642f275e5dd7dcf575b373e328f4` | same | `1a54588c` (pre-#371) |
| #382 | `688001ec55974314f1c846a709bba4cc476fded1` | same | `5a7bf167` |

Trees: `~/qa-scratch/qa265-pr<N>` at each head, `~/qa-scratch/qa265-base<N>` at `origin/master` (`0c1f8432`), and
`~/qa-scratch/qa265-merge` for row 10. Each tree had its own `npm ci` (npm 11 blocked install scripts; the better-sqlite3
binary was present and loaded).

## Deviations from the setup (stated, not hidden)

- **TMPDIR was not set to `~/qa-tmp`.** The permission layer refused every command that set an environment variable
  inline (`TMPDIR=... npx ...`). Tests therefore wrote their fixtures to the OS tmpdir (`/tmp`). The real home was not
  touched: `tests/setup-env.ts` redirects the score history, shadow log, active session, knowledge DB and vault into a
  `mkdtemp` directory. The tests that need a home (#378's row, all of `mcp-command-paths`) create their own temporary home.
- **`ln` and `cp` were refused** too, so test files were moved between trees with `git checkout <sha> -- <path>` and
  restored with `git checkout HEAD -- <path>`. Every mutant was made with the Edit tool and reverted with
  `git checkout -- <path>`. `git status --short` was empty after each revert.
- **#374's dispatch mutant ran on the Cursor template copy, not the `.claude` one.** The Edit tool refused
  `project-template/.claude/commands/start.md` as a sensitive path. The dispatch asks for "ONE template copy", so the
  `.cursor` copy meets the row. It is also the copy the developer used.

## Row 1: confined (`git diff --stat origin/master...<head>`)

| PR | Files | Outside the task? |
|---|---|---|
| #374 | `.claude/commands/start.md`, both template `start.md` copies, `briefing.ts`, `serving-build.ts`, and the tests `briefing`, `latest-brief`, `serving-build`, `state-views`, `start-parity` (10 files) | No. Round 2 adds only `3e80fb15`: briefing.ts, serving-build.ts and three tests (row 5). |
| #377 | `cli-session-end.ts`, `recalled-ids.ts`, `server.ts`, `recalled-ids.test.ts`, `server.test.ts` | No |
| #378 | `tests/server.test.ts` only (+28) | No. Test-only, as the PR says. |
| #379 | `sync/checks.ts`, `mcp-command-paths.test.ts` | No |
| #382 | `CHANGELOG.md`, `server.ts`, `state-writer.ts`, `server.test.ts` | No. The CHANGELOG entry is the task's own. |

## #374 r2 (narrow): row 5

- **Range-diff:** `git range-diff 1115ee19..7e0509e1 1115ee19..3e80fb15` gives `1: 7e0509e1 = 1: 7e0509e1` and adds one
  commit, `3e80fb15`. The head `40105c1f` merges master (`5a7bf167`) into it, and `git show --remerge-diff 40105c1f`
  is empty, so there were no conflict edits. `3e80fb15` touches exactly the three items: `start-parity.test.ts` (one
  regex), `serving-build.ts` + row, and `briefing.ts` + row. **Nothing else changed.** QA 264's six QA-263 mutants are
  not re-run, because their rows were not touched.
- **T-226 row:** green at the head (start-parity 11/11). The grab is `/…|\*brief\.md|…/`, and
  `toBeGreaterThanOrEqual(3)` is unchanged, so the threshold is still 3. Red-first: r1's test (`7e0509e1` version) against
  the r2 templates gives 1 failed / 10 passed with `expected 2 to be greater than or equal to 3`. That is QA 264's CI
  failure, reproduced.
  **Dispatch mutant** (the `*brief.md` sentence deleted from the Cursor template copy): 2 failed / 11. The failures are this
  row (`expected [ …(2) ] to deeply equal [ …(3) ]`) and `checkCursorStartParity > is green on this tree`. **Red.**
  (Observation: the r2 grab run against master's templates, which lack F7's wording, also returns 2. The grab and F7's
  template wording only hold together, and they ship together in this PR.)
- **SERVED_PATHS:** now includes `"project-template"`. The new row (a commit touching only
  `project-template/.cursor/commands/start.md` reads `STALE: 1 code commit behind`) passes at the head (17/17). On
  master's source it is 1 failed / 16 (`current (1 records-on…`). The developer's mutant (drop `project-template`) gives
  1 failed / 17. **Red.**
- **STOP band word:** the branch for `weekly >= WEEKLY_STOP` (98) returns a literal `Usage: STOP (weekly N%)`. The row
  covers GREEN, AMBER, RED and STOP at 98, a GREEN-led level at 99, and 97 staying `Usage: GREEN (5h 4%, resets…`.
  Head 48/48. Master's source: the row fails (`Usage: GREEN (weekly 98%)…`), and so does the r1 F7 wording row, because
  master's start.md lacks it.
  **QA mutant (own):** `STOP` only when the file's level starts with GREEN, otherwise the file's word. Result: 1 failed / 48
  (`Usage: AMBER (weekly 98%)`). **Red.**
  **QA mutant 2 (own, boundary):** `WEEKLY_STOP = 97`. Result: 2 failed / 48 (this row's 97 case and F2). **Red.**
- **CI:** run `37115232157` (pull_request, head `40105c1f`): `test` success, with the steps `Typecheck` and
  `Typecheck tests` both success. Locally at the head: `tsc --noEmit` 0 and `npm run typecheck:tests` 0.
- **Carried from the PR body (not a QA finding):** after merge, the home copies `~/.claude/commands/start.md` and
  `~/.cursor/commands/start.md` need a refresh, or `/sync` reports mirror-parity. QA did not read or touch them.

**#374 verdict: ACCEPT** (r2: all three items met; nothing else changed).

## #377: T-229, rows 2–4 and 6

- **Row 6, call sites:** `grep "readFile:" src` returns exactly three injection sites, and each one is `readFile: readRecalledFile`:
  `cli-session-end.ts:127`, `server.ts:577` (handleEnd) and `server.ts:1381`. Each passes it into
  `resolveRecalledIdsObserved`, which calls `resolveRecalledIds` and `detectForeignWriter` with the same reader. Both
  wrap `readFile(path)` in try/catch: the resolver `continue`s, and the detector records `{path, code}` in `unreadable`.
  So a thrown read cannot escape into the SessionEnd hook or the MCP handler. `readRecalledFile` returns null only for
  `code === "ENOENT"` and rethrows everything else.
- **Row 2, red then green:** on master's source, `recalled-ids.test.ts` is 6 failed / 23 passed (29) and `server.test.ts`
  is 1 failed / 30 passed (31), the handleEnd EISDIR row. At the head: 29/29 and 31/31. Both match the PR body.
- **Row 3, developer's mutant** ("resolver does not catch"): recalled-ids 1 failed / 29 (FW-9), and server 1 failed / 31
  (the handleEnd EISDIR row). **Red.**
  **QA mutant (own):** `readRecalledFile` rethrows only EISDIR and treats every other code as absent
  (`code !== "EISDIR" → null`). Result: **survives**, recalled-ids 29/29 and server 31/31. The FW-7 rows inject
  EACCES/EBUSY throwers straight into the detector. The only test of `readRecalledFile` itself uses a real directory,
  which is EISDIR. So "only ENOENT is absent" is pinned for EISDIR and not for EACCES, EBUSY or ENOTDIR. The code is
  right on inspection, and the test is narrower than the claim. **Non-blocking gap G1.**
- **Row 4, CI:** run `37113710230` (pull_request, head `da6cdd97`): `test` success. This is a pre-#371 head, so CI did not run
  `typecheck:tests`. Locally at the head, `npm run typecheck:tests` exits **2** with 4 errors, all of them master's pre-#371
  ones: `recalled-ids.test.ts(248)` (fixed on master by #371), `ranking.test.ts` ×2 and `shadow-strategies.test.ts`.
  None is in a line this PR adds. On the batch merge it exits 0 (row 10).
- Also noted: the `server.ts:1381` and `cli-session-end.ts` sites have no row of their own. The PR body gives Atlas's ruling
  on this, and QA checked each point above.

**#377 verdict: ACCEPT** (G1 non-blocking).

## #378: T-230, rows 2–4 and 7

- **Row 7:** the row makes both scans run. It proves a session id (`proveOwn` + `handleSetSession`, with `.agents/SESSIONS`
  from `proseProject`) and points HOME/USERPROFILE at a temporary home containing `.claude/projects/some-project`. Both
  variables are restored in `finally`. It asserts `\nSession logs unreadable: 0\n` and
  `\nTranscript directories unreadable: 0\n`. **QA 261's mutant Q1** (`lines.push(...formatScanCounts(...))` →
  `void formatScanCounts;`, tsc clean) gives 1 failed / 31, this row. **Red.**
- **Row 3, QA mutant (own):** push only the first line (`lines.push(formatScanCounts(...)[0])`, tsc clean). Result: 1 failed / 31,
  with `expected … to contain '\nTranscript directories unreadable: …'`. **Red**, so both lines are pinned separately.
- **Row 2:** the PR is test-only, and master already prints the lines (#302). The new test against master's source is
  31/31 green, as expected for a pin. The head is 31/31. The red evidence is the mutants above.
- **Row 4, CI:** run `37113792954` (pull_request, head `b24ea6a0`): `test` success. It is a pre-#371 head and has no
  `Typecheck tests` step. Locally at the head, `typecheck:tests` exits **2** with the same 4 pre-#371 errors, none in
  `server.test.ts`. It exits 0 on the batch merge.

**#378 verdict: ACCEPT.**

## #379: T-231, rows 2–4 and 8

- **Row 8:** each of the 12 `it.each` cases asserts `severity === "warn"`, `not checked: `, its exact `expected()` fragment and
  `This is not a full pass.`, so all 12 pinned fragments are asserted. The ABSENT row (no `mcpServers`, `projects` or
  `enabledPlugins` key) asserts `pass` and no `not checked`. The nothing-else-checkable row asserts `skip` and the named
  fragment. **QA's earlier mutant B** (`settingsAbsent = !settings.ok`) gives 2 failed / 45 (G and the new G'). **Red.**
- **Row 2:** on master's source, 13 failed / 32 passed (45): the 12 container rows plus the SKIP row. At the head, 45/45. Both
  match the PR body.
- **Row 3, QA mutant (own):** `containerOf` treats `null` as absent (`v === undefined || v === null → {}`). Result: 1 failed /
  45 (`the global mcpServers is null`). **Red.**
- **QA probe** (`docs/loops/qa-265/qa265-probe-379.test.ts`, run from the head's `tests/pipelines/sync/`): 3/3 passed.
  - P1: `.mcp.json` `{mcpServers: null}` gives WARN (`mcpServers (.mcp.json): entry is not an object`). It falls back to the
    top-level map and is caught as a malformed server entry.
  - P2: a project entry that is a string is WARN and named.
  - P3: `~/.claude.json` = `null` is WARN, `top level is null, not an object`.
- **Row 4, CI:** run `37113923809` (pull_request, head `89ab68b2`): `test` success. It is a pre-#371 head. Locally,
  `typecheck:tests` exits **2** with the same 4 pre-#371 errors, and exits 0 on the batch merge.

**#379 verdict: ACCEPT.**

## #382: T-232, rows 2–4 and 9

- **Row 9:** the row's `write()` asserts `ob_state applied` on all four writes. Writes 1–2 have no per-id NOTE. Write 3
  (crossing) has exactly 2 per-id NOTEs (`toHaveLength(2)`), the T-001 NOTE text and
  `KEPT despite retention (id cited in the tracked tree): 2 — T-001, T-002`. Write 4 (a no-op for retention) has the summary
  line and `match(perId)` null.
  On inspection, the summary is pushed from one site only (`server.ts:530`). The test asserts that it is present, not that it
  appears exactly once. **Non-blocking gap G2:** no assertion counts summary lines.
- **Row 2:** on master's source, 1 failed / 30 passed (31), failing on the summary line (`expected 'ob_state applied\nRevision: 9 → 10…' to contain 'KEPT despite retention…`).
  At the head, 31/31.
- **Row 3, developer's M1** (per-id NOTE for every kept id, which is master's behaviour): 1 failed / 31
  (`expected [ 'retention KEPT done task', …(1) ] to be null`). **Red.**
  **QA mutant (own):** NOTE only for the first crossing id (`crossed.slice(0, 1)`): 1 failed / 31
  (`expected [ 'retention KEPT done task' ] to have a length of 2 but got 1`). **Red.**
- **Row 4, CI:** run `37115305682` (pull_request, head `688001ec`): `test` success, with the steps `Typecheck` and `Typecheck tests`
  both success. Locally: `tsc --noEmit` 0 and `typecheck:tests` 0.

**#382 verdict: ACCEPT** (G2 non-blocking).

## Row 10: batch merge

`~/qa-scratch/qa265-merge` was created from `origin/master` (`0c1f8432`), and the PRs were merged in this order: #374 → `2964e34b`,
#377 → `bf7f434a`, #378 → `0a192caa`, #379 → `ecd373d6`, #382 → `f7b11fdb`. **No conflicts.** #377, #378 and #382 all
touch `server.ts`/`server.test.ts`, and all three merged automatically. The merge was not pushed.

On `f7b11fdb`:
- `tsc --noEmit`: exit 0.
- `npm run typecheck:tests`: **exit 0**. The 4 pre-#371 errors seen at the #377/#378/#379 heads are gone once they sit on master.
- Touched test files, one per invocation:

| Test file | Result |
|---|---|
| `server.test.ts` | 33/33 (30 on master + #377, #378 and #382's rows) |
| `recalled-ids.test.ts` | 29/29 |
| `mcp-command-paths.test.ts` | 45/45 |
| `briefing.test.ts` | 48/48 |
| `serving-build.test.ts` | 17/17 |
| `latest-brief.test.ts` | 25/25 |
| `state-views.test.ts` | 18/18 |
| `start-parity.test.ts` | 11/11 |

## Findings (none blocking)

- **G1 (#377):** the "only ENOENT is absent" check in `readRecalledFile` is pinned for EISDIR only. QA's mutant (rethrow
  EISDIR alone) survives both files. To close it, add a fake-fs or EACCES-style row for `readRecalledFile` itself.
- **G2 (#382):** the no-op write asserts that the summary line is present, not that it appears exactly once. It is correct on
  inspection (one push site).
- **Process (#374, carried):** refresh the home `start.md` copies after merge.

## Mutant diffs

These are in `docs/loops/qa-265/mutants/`, prefixed `pr<N>-dev-` (the developer's, re-run) or `pr<N>-qa-` (QA's own).

## Verdicts

- `#374 r2`: **ACCEPT** at `40105c1fa2ed6d40f85cbd18660e178d7ff787b7`
- `#377`: **ACCEPT** at `da6cdd97101318da51f995dfec0e1bff6430ae79` (G1 non-blocking)
- `#378`: **ACCEPT** at `b24ea6a0a43b9b92188e130ec814f502e457ae4b`
- `#379`: **ACCEPT** at `89ab68b25c4a642f275e5dd7dcf575b373e328f4`
- `#382`: **ACCEPT** at `688001ec55974314f1c846a709bba4cc476fded1` (G2 non-blocking)
- **Batch: ACCEPT.** Merge order #374, #377, #378, #379, #382 is clean. Merge authority stays with Aaron, per PR.

QA-265: REPORT COMPLETE
