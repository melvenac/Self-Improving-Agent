# QA 268 report: session-160 batch c (#393 r2 narrow, #397)

**By:** QA 268 (headless Claude Code, Opus), record session 160, 2026-10-03 (UTC 2026-10-04).
**Dispatch:** `docs/loops/qa-268-s160c-dispatch.md`. **Dispatch tree:** `git -C ~/qa-scratch/qa268-wt log -1 --format=%H` =
`7779e6fee1fc1ee013ad6523dcb5a2e115e9dbda`.
**Job class:** LIGHT. One test file per vitest run, no full suite, no live Jev call, `gh` used read-only.

## Verdicts

| PR | Pinned head | Verdict |
|---|---|---|
| #393 (T-236 slice 2, r2) | `6f145faf9d1bba962d281e16285fcb59b14b68c7` | **ACCEPT** |
| #397 (T-237) | `3e95016c92844b67113ae44f9d9c7ed362335587` | **REJECT** (one finding, F1: the presence worst-case bound is no longer an upper bound) |
| Batch | f8345f1b + #393 + #397 = `0c66cb9a` (local only) | REJECT (because #397 is rejected; the merge itself is clean and green) |

Both heads were unmoved at start (`gh pr view`: `headRefOid` equal to the pins, both OPEN, base master).
Master had moved from `f8345f1b` to `7779e6fe`, but only in `.agents/`, `docs/loops/` and state. **No file under
`open-brain/` and no `CHANGELOG.md` change.** Both PRs' merge-base with current master is still `f8345f1b`, so the
dispatch's merge base holds.

## Trees

| Tree | Commit |
|---|---|
| `qa268-wt` | `7779e6fe` (dispatch) |
| `qa268-pr393` | `6f145faf` |
| `qa268-pr397` | `3e95016c` |
| `qa268-base397` | `f8345f1b` (master's `hub-presence.ts`, used for #397's red-first) |
| `qa268-merge` | `f8345f1b`, then `--no-ff` merge of `6f145faf` (`4f247ec0`, tree identical to `6f145faf`), then `--no-ff` merge of `3e95016c` (`0c66cb9a`) |
| `qa268-ctl267` | `6e55119b` (QA 267's broken merge, used only as the scanner's control) |

**TMPDIR:** I could not set it. The permission layer refused every `TMPDIR=… cmd` and `export TMPDIR` form, the same as
QA 267. The tests made their fixtures with `mkdtemp` under the default tmpdir, and every fixture is removed by the tests'
own `afterAll`. Nothing was written outside the scratch trees, the tmp dir and the OS tmpdir. `npm ci` printed that
three install scripts (better-sqlite3, two esbuild) were not run under `allowScripts`; vitest and tsc ran regardless.

## #393 round 2 (narrow)

### Row 1: range-diff: PASS

```
git range-diff f5512b6a~1..4020a42b origin/master..6f145faf
1:  f5512b6a = 1:  f5512b6a T-236 slice 2 base: A2A fixture and the byte-identical golden, from UNCHANGED master
2:  e4d4f46d = 2:  e4d4f46d T-236 slice 2: handoff caps, expires, owner, NEXT-by-ids and the briefing budget ...
3:  4020a42b = 3:  4020a42b T-236 slice 2: land handoff_caps OFF for SIA (briefing_budget stays ON)
```

All three are `=`. The only new commit is `6f145faf`, with parents `4020a42b` and `f8345f1b`. I read the merge in full
three ways:

- `git diff 4020a42b 6f145faf` brings in master's 24 files from #387, #388 and #391, as expected.
- `git show --cc 6f145faf` shows one hunk that differs from both parents: `greeting.json`.
- `git show --remerge-diff 6f145faf`, which compares the commit to git's own automatic merge, shows exactly two hand
  changes:
  1. `greeting.json`: the add/add conflict is resolved to the three keys.
  2. `server.ts`: the second `import { greetingFlag } from "./pipelines/session-start/greeting-flags.js";` (the
     #393-side line 35) is deleted.

There is nothing else: no semantic edit hidden in the merge.

### Row 2: one import: PASS

- `grep -c "import { greetingFlag }" open-brain/src/server.ts` returns **1** (line 27). The three call sites are
  377 (`briefing_budget`), 425 (`role_docs_by_sha`) and 492 (`handoff_caps`).
- `greeting.json` is `{"briefing_budget":true,"handoff_caps":false,"role_docs_by_sha":true}`, with keys in sorted order.

### Row 3: merged with master: PASS

The tree is `qa268-merge` at `4f247ec0` (f8345f1b merged with 6f145faf; `git diff 6f145faf HEAD` is empty).

- `npx tsc --noEmit`: exit 0. `npm run typecheck:tests`: exit 0.
- **Node load:** I compiled with `npx tsc --outDir qa268-build` inside the scratch tree, which uses the package's
  `"type": "module"`. `node --check qa268-build/server.js` exits **0**, and the built file has 1 `greetingFlag` import.
  - **Control:** a copy with the import line duplicated (`server-dupctl.js`) gives `node --check` exit **1** with
    `SyntaxError: Identifier 'greetingFlag' has already been declared`. The check therefore catches the defect QA 267 found.
- Tests, one file per run:

| File | Result |
|---|---|
| `server.test.ts` | 35/35 |
| `role-docs-by-sha.test.ts` | 11/11 |
| `a2a-byte-identical.test.ts` | 3/3 |
| `briefing-budget.test.ts` | 31/31 |

### Row 4: CI: PASS

`gh pr checks 393`: `test` **pass**, 3m5s, run **37161339592** (matches the developer's report). The run is
`event: pull_request` with `headSha 6f145faf…`, conclusion `success`. `changed` passes and `test-windows` is skipped
(opt-in). The job's checkout fetched `refs/remotes/pull/393/merge` (`3d151d3c`), so it tested the PR merged into the
master of that moment.

### Row 5: the class, not the line: PASS, with a finding about the gate

- **Scan:** `docs/loops/qa-268/qa268-dup-imports.mjs` uses TypeScript's own parser to count every local binding that an
  import introduces (default, namespace, named and `type`, including multi-line imports), file by file.
  - On the merged tree's `src`: **102 files, 1124 import bindings, 0 duplicates.**
  - On the batch merge `0c66cb9a`: the same, 0 duplicates.
  - On `tests/`: 184 files, 0 duplicates.
  - **Control:** on QA 267's broken merge `6e55119b` it reports `DUP src/server.ts: greetingFlag at lines 27, 35`
    and exits 1.
- **Would a CI step have caught it?** Yes, both typecheck steps would, but only on a tree that holds both PRs.
  - `ci.yml` runs `npx tsc --noEmit` (`tsconfig.json` includes `src/**/*`).
  - It also runs `npm run typecheck:tests`, whose `tsconfig.tests.json` includes **`src/**/*` and `tests/**/*`**.
    `--listFilesOnly` shows all 102 `src` files, `server.ts` among them. So `typecheck:tests` does cover `src`, and QA
    267 saw both steps fail with TS2300 at the merge.
- **Why the gate missed it:** each PR's `test` ran against the master of its own moment.
  - The PR workflow fires only on `opened` and `synchronize`, so a PR is not re-tested when master moves under it.
  - Master's ruleset has `required_status_checks: [test]` with **`strict_required_status_checks_policy: false`**, so a
    stale green `test` satisfies the gate.
  - The only CI that would have gone red is the `push` run on master, after the second merge had already landed.
  - The batch merge row is therefore the only pre-merge detector for this class. This is not a #393 defect. It is
    recorded for the planner (gap G1).

## #397 rows

### Row 6: confined: PASS

- `git diff --stat f8345f1b 3e95016c` lists 3 files: `CHANGELOG.md` (+3),
  `open-brain/src/pipelines/session-start/hub-presence.ts` (+8/−5) and
  `open-brain/tests/pipelines/session-start/hub-presence.test.ts` (+37).
- It has two commits: `d4507be6` (tests only) and `3e95016c` (the fix).
- **A2A's field names are unchanged:** `sessionId`, `unread`, `pollingNow` and `pollAgeMs`. Only
  `PresenceRoom.pollAgeMs` widens from `number` to `number | null`, and the validator's reason text changes from
  `is not a finite number` to `is not a finite number or null`. No other `src` or test file asserts on the old text.

### Row 7: red then green: PASS

I copied head's test file into `qa268-base397`, so it ran against master's `hub-presence.ts`.

| | Result |
|---|---|
| **Master** | **6 failed, 34 passed (40)** |
| **Head** | **40 passed (40)** |

- **Row 1 (T237-1):** red on master. `presence: UNKNOWN (malformed body: agents[0].rooms[0].pollAgeMs is not a finite
  number)`: one null room blanked every partner. Green at head, where grok renders `listener not polling` and
  cursor-infra renders `3 unread since 5m`.
- **Row 2 (T237-2):**
  - The null case is red on master: `undefined`, because the whole block was UNKNOWN.
  - The absent case is red on master with `"  cursor-infra: listener not polling, 2 unread since 0s"`.
  - Both are green at head with `… 2 unread, no listener poll recorded` and no `since`.
- **Row 3 (T237-3):** a string, a boolean and Infinity (`1e999`) are red on master **only on the new reason wording**.
  Master already called them malformed, so these are guard rows, not fix rows, as the PR body says. NaN passes on both,
  because it fails at `JSON.parse`. All of them are green at head, each producing exactly one UNKNOWN line.

### Row 8: mutants: PASS

`qa268-mutants.mjs` lands each mutant, runs `tsc --noEmit` and then the one test file, and restores `src` from HEAD.
`src` was clean after every run. The diffs are in `docs/loops/qa-268/mutants/`.

| Mutant | tsc | Result | Killed by |
|---|---|---|---|
| **DEV-M1:** null maps to 0 (the no-poll branch only for `undefined`; `formatPollAge(pollAgeMs ?? 0)`) | 0 | 1 failed / 40 | T237-2 (null) |
| **QA-M1:** only null fixed; absent still prints `since 0s` | 0 | 1 failed / 40 | T237-2 (absent) |
| **QA-M2:** the validator drops a null room instead of accepting it (a plausible lazy fix) | 0 | 2 failed / 40 | T237-1 and T237-2 (null) |
| QA-P3 (probe): a falsy check (`!room.pollAgeMs`) makes a real 0 ms age print `no listener poll recorded` | 0 | **0 failed / 40, survives** | none (gap G2, minor) |

### Row 9: wording: the rows PASS; FINDING F1 (major) against #397

- **Rows:** the new line is `listener not polling, N unread, no listener poll recorded`.
  - It matches R1's `^ {2}\S.*: (listener polling|listener not polling|absent)` and has no `seen`, `\bread\b` or
    `acknowledg` (`unread` has no word boundary before `read`), checked directly on the rendered line.
  - R1's own fixture never renders the new line, so R1 alone would not have caught a bad word in it.
  - `hub-presence.test.ts` passes 40/40 at head and `greeting-size.test.ts` passes 11/11 at head.
- **F1: `presenceBlockUpperBound` is no longer an upper bound.**
  - **The contract:** the function (`hub-presence.ts:259-281`, unchanged by the PR) builds the presence block's
    "WORST-CASE … every partner in the longest live form" for `/sync`'s `greeting-size` check (QA 225 major 3).
    `checkGreetingSize` prints that number as `presence block N (worst-case upper bound, not fetched)`.
  - **How #397 broke it:** the bound is built with `unread: 999, pollAgeMs: 99d`, which gives `999 unread since 99d`.
    #397 adds a longer live form: `, no listener poll recorded` is 27 characters against 10 for ` since 99d`.
    Before #397 a null room could not render at all (UNKNOWN), and an absent age rendered the shorter `since 0s`.
  - **Proof** (`docs/loops/qa-268/qa268-bound-probe.test.ts`): a fixture named `sia-planner` gets the real
    `hub-partner-seats.json`. The probe renders the block through `formatPartnerLine` with each partner at 999 unread
    and `pollAgeMs: null`, then compares it with `presenceBlockUpperBound`.

    | | Bound | Real block | Probe |
    |---|---|---|---|
    | **Head `3e95016c`** | 313 chars | **364** | fails: the bound is 51 chars short, 3 partners × 17 |
    | **Master `f8345f1b`** | 313 | 310 | passes |

    #397 introduced the regression.
  - **Impact:** 51 characters against a 40,000 limit, so a real ISSUE is unlikely. But `/sync` now prints a number
    labelled "worst-case upper bound" that is not one, and that is the invariant the bound exists for.
  - **Why the PR's tests miss it:** `greeting-size.test.ts:227` pins the *old* worst form (`999 unread since 99d`) as
    the expected text, so it stays green and asserts the wrong worst case.
  - **Fix, demonstrated locally and not pushed** (`docs/loops/qa-268/pr397-qa-demo-bound-fix.diff`):
    - In `presenceBlockUpperBound`, render each partner with both `pollAgeMs: 99d` and `pollAgeMs: null` and keep the
      longer line.
    - Result: tsc 0, the probe passes (bound 364 = real block 364) and `hub-presence` is 40/40.
    - `greeting-size.test.ts` then goes 1 failed / 11 at line 227, as expected. That row has to pin
      `999 unread, no listener poll recorded`. The fix therefore touches `greeting-size.test.ts`, a fourth file outside
      the planner's three-file scope, and that needs the planner's word.

### Row 10: CI: PASS

`gh pr checks 397`: `test` **pass**, 3m0s, run **37161480519**. It is `event: pull_request` with `headSha 3e95016c…`,
conclusion `success`. `changed` passes and `test-windows` is skipped.

## Batch merge row

### Row 11: PASS (mechanically)

In `qa268-merge` I started from `f8345f1b`, merged `6f145faf` (`4f247ec0`), then merged `3e95016c` (`0c66cb9a`).

- **No conflicts.** `CHANGELOG.md` merged cleanly, because #393 does not touch it relative to `f8345f1b` (its
  CHANGELOG lines come in from master through the r2 merge).
- `npx tsc --noEmit`: exit 0. `npm run typecheck:tests`: exit 0.
- `hub-presence.test.ts`: 40/40. `server.test.ts`: 35/35.
- The duplicate-import scan over `src` finds 0.
- F1 is present at the merge too, since it is #397's code. The batch verdict is REJECT only because #397 is.

## Findings

- **F1 (major, #397):** the presence worst-case bound understates the real block by 17 chars per partner (51 for the
  planner seat), so `/sync`'s "worst-case upper bound" label is false. Fix: the bound takes the longer of the age form
  and the no-poll form, and `greeting-size.test.ts:227` pins the no-poll form. The fix was demonstrated locally.

## Gaps (not blocking)

- **G1 (process):** stale-green PR checks. `strict_required_status_checks_policy: false`, together with PR CI on
  `opened`/`synchronize` only, means that two PRs can each be green and still be red together. Only the batch merge row
  or master's push CI sees it (row 5).
- **G2 (#397, minor):** no row pins `unread > 0` with a numeric `pollAgeMs: 0`, so a falsy-check mutant survives (QA-P3).
- **G3 (#397):** R1's wording row does not render the new no-poll line, so its word ban does not guard it. QA checked
  the line by hand.

## Artifacts (on `qa/s160c-report`)

- `docs/loops/qa-268/qa268-dup-imports.mjs`: the row 5 scanner.
- `docs/loops/qa-268/qa268-mutants.mjs` and `docs/loops/qa-268/mutants/*.diff`: row 8.
- `docs/loops/qa-268/qa268-bound-probe.test.ts`: the F1 probe. Run it from `open-brain/tests/`, because its imports
  are relative to that directory.
- `docs/loops/qa-268/pr397-qa-demo-bound-fix.diff`: the F1 fix demonstration.
- `docs/loops/s160c-qa-report.E_t.json`.

QA-268: REPORT COMPLETE
