# QA 249: T-164 port + T-211 standing cron (report)

**By:** QA seat, record session 249, headless Claude Code (Opus 5.5) on Plumb (Linux, Node v22.22.1), 2026-10-02.
**Dispatch:** `docs/loops/qa-249-t164-t211-dispatch.md` at `8961ba1fede1a69ce53c143fcacd9efacd95d34f`
(`git -C ~/qa-scratch/qa249-wt log -1 --format=%H` → `8961ba1fede1a69ce53c143fcacd9efacd95d34f`).
**Candidates:** T-164 `fbf94ae63dcd49c37b96a113e9c5a1f389077b0e` (`origin/loop/t164-port`, PR #270), T-211
`9f6fcea4abf42c1a98219aec639be5d6f10f63ed` (`origin/loop/t211-standing-cron`, PR #272). Both branch heads were read back
equal to these SHAs. **Base:** `bea385b2` = `git merge-base origin/master fbf94ae6`.
**Trees:** `~/qa-scratch/qa249-wt` (dispatch), `~/qa-scratch/qa249-t164`, `~/qa-scratch/qa249-t211`, all detached.

## Verdict: REJECT

**One blocking finding (F1):** the SC-2 refusal names the **lowest unused** session number, not the next one. On a
record shaped like the live one it says "next free number is **1**". QA's own SC-2 test is red on both candidates.
Everything else is green: the port is faithful, the live case, SC-1/3/4/5, SR-1 to SR-6, the full suite and CI.

## Rows

| # | Row | Result |
| --- | --- | --- |
| 1 | Confined | **met**, with the extra files named below |
| 2 | Port faithful | **met**: range-diff shows identical hunks |
| 3 | SC-1 to SC-5; SC-2 by QA's own test | **not met**: SC-2 fails on the live-shaped record (F1). SC-1, SC-3, SC-4, SC-5 met |
| 4 | Live case 16 logs / record 155 → 156, then reuse | **met** |
| 5 | SR-1 to SR-6; QA mutants (a), (b) | SR rows **met**; **both QA mutants survive** (F2, F3) |
| 6 | Developer's mutants SC-4, SR-5a, SR-5b red | **met** |
| 7 | Full suite at `9f6fcea4` | **met**: 0 failed; 1 unattributed RPC error (D-083) |
| 8 | CI | **met**: run 36968685032 success |

### 1. Confined

`git diff --stat bea385b2 fbf94ae6` (17 files): `open-brain/src/pipelines/session-start/{index,session-log,types}.ts`,
`server.ts`, `shared/state-schema.ts`, `shared/state-writer.ts`; tests `record-session-number`, `session-log`,
`state-import`, `sync/record-erasure`, `server`, `shared/closeout-erasure`, `shared/session-order`,
`shared/state-writer`; `docs/loops/t164-port-developer-handoff.md`. **Outside the list:**

- `docs/loops/t164-developer-handoff.md`: the record-221 handoff, cherry-picked in with `38417eb3`.
- `docs/loops/t164-port/mutants/sc4-local-count-restored.diff`: the SC-4 mutant artifact.

`git diff --stat fbf94ae6 9f6fcea4` (10 files): `agent-identity.ts`, `server.ts` (import plus one `lines.push` in
`handleStart`), `.claude/commands/start.md`, `project-template/.claude/commands/start.md`,
`docs/loops/cursor-start-differences.json`, `project-template/.agents/AGENT.md`, `standing-cron.test.ts`,
`docs/loops/t211-developer-handoff.md`. **Outside the list:**

- `docs/loops/t211/mutants/sr5a-line-dropped.diff`, `docs/loops/t211/mutants/sr5b-reads-only-agent-md.diff`: mutant
  artifacts.

All four outside files are docs-only. No source file outside either list is touched.

### 2. The port is faithful

`git range-diff 38417eb3~1..567657af bea385b2..ea44fca2`:

- `38417eb3 ! 911c1a8b`: the only difference is the `(cherry picked from commit 38417eb3…)` line in the message.
- `567657af ! ea44fca2`: the same, `(cherry picked from commit 567657af…)` only.
- `9dfa6300 < -`: "docs: fill T-164 mutant SHA in handoff" (1 line in `docs/loops/t164-developer-handoff.md`) was
  **not ported**. That is a docs-only omission: the cherry-picked old handoff keeps its unfilled mutant-SHA
  placeholder. The new port handoff supersedes it.

No hunk differs from the original, so no hunk needs a master-movement explanation. This agrees with the developer's
claim of "Conflicts: none". `tsc --noEmit` exits 0 at both `fbf94ae6` and `9f6fcea4`.

### 3. SC-1 to SC-5 at `fbf94ae6`

Developer tests at `fbf94ae6`: `record-session-number`, `session-log`, `server`, `state-writer`, 4 files, **91
passed**.

- **SC-1 met.** Local 6 and record 76 greet 77 and create `Session_77.md`.
- **SC-2 NOT met (F1).** This is QA's own test, `docs/loops/qa-249/tests/qa249-t164.test.ts`. It uses two separate
  fixture checkouts, A and B, at the same revision, and each one runs `ob_set_session` plus `ob_start` through
  `handleStart`. Then A's first `applyStateOps` registers N for uuid A. B pulls A's `state.json` (the shared record)
  and writes N for uuid B.
  - Record `1..5`: both greet `Session #6`. A writes and gets ok. B is refused with `…; next free number is 7`. Green.
  - Record `76, 147..155`: both greet `Session #156`. A writes and gets ok. B is refused, but with
    `session number 156 is already recorded for uuid aaaaaaaa-…; next free number is 1`. **Red.** It is red at
    `fbf94ae6` and again at `9f6fcea4`.
- **SC-3 met.** With no `state.json`, the greeting is 7 and the line carries
  `(local — from this checkout's session logs; no valid state.json)`.
- **SC-4 met.** See row 6.
- **SC-5 met.** See row 4, and the developer's `server.test.ts` reuse test.

**F1 (blocking).** `nextFreeSessionNumber` (`state-schema.ts`) returns the lowest n that is not in `sessions[]`. The
greeting, by contrast, uses `max(n)+1` (`nextGreetingSessionNumber`). The live record is sparse: at `9f6fcea4`,
`.agents/state.json` holds 12 sessions, `76, 147..156`, with 145 numbers missing below 156. It also already holds
**two sessions numbered 156** (uuids `734793c2…` and `83f0e630…`): exactly the collision T-164 exists to stop. On
that record, the refusal T-164 adds would tell the second seat to take session **1**. A seat that follows the
refusal writes a number far below every recorded session. SC-2 says the refusal "names the next free `n`", and the
QA brief says it "names N+1". The developer's SC-2 test cannot see this, because its record starts empty, where
lowest-free equals max+1. Suggested fix, not applied: compute the refusal's number as `max(n)+1`, the same rule the
greeting uses.

### 4. The live case

The fixture has 16 local logs and record sessions 153, 154 and 155 (the local counter says 17). The first
`ob_start`, through `handleStart`, printed:

```
Session #156
Log: /tmp/qa249-live-3G1AhR/.agents/SESSIONS/Session_156.md
Session ID: aaaaaaaa-0000-4000-8000-000000000249
```

`Session_156.md` was created and carries the uuid. No `Session_17.md` exists, and there are 17 logs in total. A second
`ob_start` in the same session printed `Session #156 (existing log for this session id — reused, nothing created)`,
and the log list was unchanged (SC-5). This is green at `fbf94ae6` and at `9f6fcea4`.

### 5. SR-1 to SR-6 at `9f6fcea4`

`standing-cron.test.ts`: **6 passed**. SR-1, SR-2, SR-3, SR-4 (`"4 * *"` gives `has 3 fields, expected 5`, and
`"61 * * * *"` gives `minute field "61" is out of range 0-59`), SR-4b and SR-6 are all green.

On SR-6, T-164's numbering is untouched: `fbf94ae6..9f6fcea4` does not touch `index.ts`, `session-log.ts`,
`types.ts`, `state-schema.ts` or `state-writer.ts`. My live-case test at `9f6fcea4` still greets 156 and reuses.

The line is built in `server.ts` `handleStart`, right after `Seat:`, by `readStandingCron` in `agent-identity.ts`.

**QA mutants** (diffs in `docs/loops/qa-249/mutants/`; `tsc --noEmit` exits 0 for both):

- **(a) `qa249-a-status-to-only-no-shadow.diff`.** A local file whose only key is `status_to` is skipped, so
  `AGENT.md` wins. Result: all 6 SR tests pass. **The mutant survives (F2).** A broader variant that skips any file
  without `status_cron` is caught, but **only by SR-4b** (case 3, local `status_to`+`status_rule`). SR-2 never
  catches it, because no row puts a partial local file in front of a full `AGENT.md`.
- **(b) `qa249-b-minute-accepts-60.diff`.** The range check is `value > spec.max + (i === 0 ? 1 : 0)`, so the minute
  field accepts 60 and the message stays `0-59`. Result: all 6 SR tests pass. **The mutant survives (F3).** SR-4 tests
  61, not the boundary 60.

The behaviour itself is correct on the candidate. QA's probes (`docs/loops/qa-249/tests/qa249-t211.test.ts`, 4
passed) show:

- A `status_to`-only local file shadows `AGENT.md` and prints `INVALID in .agents/AGENT.local.md: status_cron is
  missing`.
- `60` prints `minute field "60" is out of range 0-59`.
- `59` is accepted.

F2 and F3 are coverage gaps, not defects.

**F4 (minor, not blocking).** The template's documented example in `project-template/.agents/AGENT.md`, copied into
frontmatter verbatim with its trailing `# a 5-field cron, local time` comment, prints
`Standing cron: INVALID in .agents/AGENT.local.md: status_cron has 11 fields, expected 5`. It is reported, not
dropped, so it does not break SR-4. But the documented example does not work as written.

**F5 (minor).** SR-5's row says that dropping the line "goes red on SR-1 or SR-2". SR-5a actually goes red only on
SR-6, because SR-1 and SR-2 call `readStandingCron` directly rather than `ob_start`. The handoff states this
honestly. The `ob_start`-level guard is SR-6.

### 6. The developer's mutants

- **SC-4** (`docs/loops/t164-port/mutants/sc4-local-count-restored.diff` on `fbf94ae6`): `record-session-number`
  gives 2 failed and 4 passed. SC-1 fails with `expected 7 to be 77`. The live case fails with
  `expected 17 to be 156`. **Red.**
- **SR-5a** (`sr5a-line-dropped.diff` on `9f6fcea4`): 1 failed and 5 passed. SR-6 fails with
  `expected [] to deeply equal [ 'Standing cron: none in seat data.' ]`. **Red.**
- **SR-5b** (`sr5b-reads-only-agent-md.diff` on `9f6fcea4`): 5 failed and 1 passed. SR-1, SR-2, SR-4, SR-4b and
  SR-6 fail; SR-3 passes. **Red.**

Each tree was restored with `git checkout --` after its run.

### 7. Full suite at `9f6fcea4`

`npm ci`, then `vitest run` (open-brain/), on a clean tree:

- **Test Files 150 passed (150).**
- **Tests 2110 passed | 5 skipped (2115).**
- **0 failed.**
- **Errors 1:** `[vitest-worker]: Timeout calling "onTaskUpdate"`. It is unattributed to any test, so it is
  environmental (D-083).
- Duration 484 s.

### 8. CI

Pushed `qa/t164-t211-ci-candidate` at `9f6fcea4` through `push-qa.mjs`, which read it back equal. There was 1 run:
**run 36968685032**, event push, `headSha` `9f6fcea4abf42c1a98219aec639be5d6f10f63ed`, **conclusion success**. Its
jobs: `changed` success, **`test` success** (4m1s; Install, Typecheck and Test all passed), `test-windows` skipped.

## Process notes

- `TMPDIR` could not be set in this harness: the env-prefixed command was refused by the permission layer. Vitest
  fixtures therefore went under `/tmp` (fixture paths above), and each was removed by its `afterEach`. Nothing was
  written outside `~/qa-scratch`, `~/qa-tmp` or `/tmp` test fixtures. No live `state.json`, DB, settings or
  `AGENT.local.md` was written. No Jev call was made. `gh` was used to read CI only.
- QA's test files ran inside the candidate scratch trees (`tests/qa249/`, uncommitted there). Copies are in
  `docs/loops/qa-249/tests/`.

## Findings

- **F1 (blocking, SC-2):** the refusal names the lowest unused n (1 on the live-shaped record) instead of N+1.
- **F2 (coverage):** QA mutant (a) survives all SR rows.
- **F3 (coverage):** QA mutant (b) survives all SR rows.
- **F4 (minor):** the template example with its inline comment prints INVALID.
- **F5 (minor):** SR-5a is caught by SR-6, not by SR-1 or SR-2 as the row reads.
- **Note:** `9dfa6300` (an old-handoff SHA fill) was not ported.

QA-249: REPORT COMPLETE
