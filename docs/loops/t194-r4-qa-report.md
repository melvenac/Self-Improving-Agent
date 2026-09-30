# QA 235: T-194 r4 (the planner seat hook), after QA 234's REJECT

**Verdict: REJECT.** r4 fixes all of QA 234's findings, each tested through the real built CLI:

- D3 (a relative target resolved against the root instead of the cwd);
- the reversed outside-repo deny;
- case-varied paths;
- the `GH_REPO=` prefix half;
- the exact-match grant;
- `gh.exe` and `"gh"`.

Every developer mutant is red, CI is green, and nothing regresses. **One row is short, and a second defect sits in the
class r4-6 was opened to close:**

- **D4 (blocker for r4-2; from r1, not a regression): a `~` target is a shell expansion that the hook neither expands
  nor refuses.** It resolves `~/…` as `<cwd>/~/…`, which never lands in a protected path, so it is allowed. The shell
  writes it to `$HOME/…`. The planner's checkout is `~/Worktrees/sia-planner` (`.agents/AGENT.md`), so
  `echo x > ~/Worktrees/sia-planner/open-brain/src/cli.ts` is a PH-1 write, and the hook allows it. The same path
  written as `$HOME/…` is denied as undeterminable. r4-2 says a target whose location cannot be determined is denied
  with a named cause.
- **D5 (Major; from r1, not a regression): three more spellings of `gh pr merge` skip the merge check:** `GH pr merge 2`,
  `gh.EXE pr merge 2` and `gh --repo other/x pr merge 1`. Each is allowed with no grant and no fetch. I verified all
  three run: Git Bash resolves `GH` and `gh.EXE` to the same binary, and gh honours `--repo` before the subcommand.

If the planner rules D4 and D5 outside T-194, as not-a-sandbox residue, every scored r4 row is met and this candidate
would be an ACCEPT. I am not making that ruling.

- **QA:** 235, record session 235. Claude Code on **Opus 5.5 (`claude-opus-5-5`)**, headless `claude -p`, laptop
  DESKTOP-0GV3HAD (D-068).
- **Dispatch commit (working copy):** `abd206d408164f4ed9a1fd410e3b895ae0ea2786` (`git -C C:/qa-scratch/qa235-wt log -1`).
- **Candidate:** `d37e09dc4bd38cec0306e542773c3ab881602d6e` on `origin/loop/t194-planner-hook`. The code is in `2e1a0591`,
  on a merge of master (`14be2d94`); the tip adds the handoff and the mutant diffs. The candidate contains `9b3a4a2c`.
  **Base for red:** `c1f1cb483c1afcb1a3cb3f28207e2a75153b1c97`.
- **Evidence:** `docs/loops/t194-r4-qa-report.E_t.json`. `node build/harness/cli.js validate evidence <file>`, run in
  the candidate build, exits **0**.
- **Scripts and raw outputs:** `docs/loops/qa-235/evidence/`:
  - `qa235-probe.mjs` → `probe-cand-out.json` and `probe-base-out.json` (88 rows each);
  - `qa235-probe-summary.mjs` checks the case-varied SUMMARY.md write;
  - `qa235-mutants.mjs` → `mutants-dev-out.json` and `mutants-qa-out.json`;
  - `qa235-run.mjs` sets TEMP and TMP to `C:\qa-tmp`.

  My mutant diffs are in `docs/loops/qa-235/mutants/`.

## Local runs (candidate `d37e09dc`, TEMP/TMP = `C:\qa-tmp`)

| Command | Exit | Result |
| --- | --- | --- |
| `npm ci` | 0 | installed |
| `npm run build` | 0 | built |
| `npx tsc --noEmit` | 0 | no output |
| `npx vitest run tests/planner-hook` | 0 | 4 files, **129 passed** (matches the handoff) |

The base `c1f1cb48` also builds (exit 0, `build stamped c1f1cb4`) for the red side of the probes. I did not run the full
suite locally; the tcm run below covers it.

## Rows

The r4-1 to r4-3 probes run through the **real built CLI** (`build/cli-planner-hook.js`), with fixture JSON on stdin and a
fixture checkout at `C:/qa-scratch/qa235-fx-cand`. Exit 2 means deny and exit 0 means allow. The r4-4 to r4-6 probes run
through `runPlannerHookAsync` with a fetch recorder, so a zero-fetch claim can be checked. The fixture is identical for
the base build.

| Row | Status | What shows it |
| --- | --- | --- |
| **r4-1, D3** | **met** | **From cwd `open-brain/`**, each of these exits **2**: `echo x > src/cli.ts`, `sed -i s/a/b/ src/cli.ts`, a relative Edit and a relative Write of `src/cli.ts`, `tee src/x.ts`, `cp … tests/x.ts`, `mv … package.json` and `2>> src/x.log`. **From cwd `.agents/`**, these exit 2: `echo {} > state.json`, `> TASKS/INBOX.md`, and a relative Write of `state.json`. From cwd `open-brain/src`, `> cli.ts` exits 2. The cwd also exits 2 when given in **backslash**, **trailing-slash** and **Git Bash `/c/…`** forms. **Through `../`:** from `docs/loops` to src, from `docs` to state.json, from `open-brain` to `scripts/`, and from `open-brain/src` to the root `package.json`, each exits 2. **Controls exit 0:** the same text from `docs/loops` or `scratch/`, and `notes.md` from `open-brain`. On base, 13 of the deny probes exit 0. |
| **r4-2, outside allowed** | **partial (D4)** | **Outside the repo is met.** Each of these exits **0**: `npm test 2> C:/qa-tmp/log.txt` (cwd root and `open-brain/`); redirects outside in both slash forms, to `/tmp` and via `../`; a Write outside (fwd and back); an Edit to a look-alike `…/qa235-outside/open-brain/src/cli.ts`; a Write to a prefix-sharing sibling `qa235-fx-cand-x/open-brain/src`. Base denies all ten. **Undeterminable is met for `$` and backticks.** `$TMP/x.txt`, `"${HOME}/x.txt"`, `` `pwd`/x.txt ``, and a relative Bash or Write target with a non-absolute cwd each exit 2 with "…cannot be determined". **Not for `~`:** see D4. |
| **r4-3, case** | **met** | Each of these exits **2**: `OPEN-BRAIN/SRC/cli.ts` as an absolute Edit (fwd and back), a relative Edit from the root, and a Bash redirect (relative and absolute); `.AGENTS/STATE.JSON`, `.agents/tasks/inbox.md`, `Package.JSON` and `SCRIPTS/x.sh`; an upper-cased root; a lower-case drive letter; and cwd `OPEN-BRAIN` with `> SRC/cli.ts`. Base allows all of these except the two root and drive forms. A case-varied SUMMARY.md marked-region Write is denied, but no test pins it (the Minor below). |
| **r4-4, prefix half** | **met** | These are each **denied with 0 fetches**: `GH_REPO=other/x gh pr merge 1 --squash`, `env GH_REPO=other/x gh pr merge 1`, `GH_HOST=evil gh pr merge 1`, `GH_REPO=other/x gh.exe pr merge 1` and `command gh pr merge 1`. The control `gh pr merge 1 --squash` is allowed after 2 fetches. **QA 234's `qa-r32-prefix` is red:** its committed diff no longer applies, because r4 moved the check into `startsWithGhPrMerge`. The same edit made to that helper fails 2 tests, as do the developer's `prefix-half` and my `qa-r44-env-prefix-ok`. |
| **r4-5, exact grant** | **met** | A grant for `gh pr merge 1` does not cover `… --repo other/x` or `… -R other/x`: both are denied with 0 fetches, and the grant file is still present. It also does not cover `gh pr merge 12`. A grant for `git push origin loop/x` does not cover `--force`, `-f`, `--force-with-lease` or `&& git push --force origin master`; the grant is still present after each. The exact command with extra spaces and a tab (`  gh   pr merge 2\t--squash `) is allowed and consumes its grant, as does an exact `git push --force origin loop/x` grant. On base, the `--repo` and `--force` lines are allowed and consume the grant. |
| **r4-6, `gh.exe` / `"gh"`** | **met** | `gh.exe`, `"gh"`, `'gh'` and `"gh.exe"` with `pr merge 2` (a code PR) are each **denied** after reading the list ("unlisted path"). With PR 1 (docs only), `gh.exe` and `"gh"` are **allowed** after 2 fetches. A quoted full path, `"C:/Program Files/GitHub CLI/gh.exe" pr merge 2`, is denied with 0 fetches. Base allows all of them with 0 fetches. The row as written is met; **D5** covers three spellings outside it. |
| **Mutants** | **met** | See Mutants. All 12 developer mutants land, typecheck and are red. I ran 11 of my own (two for r4-1, two for r4-2, and at least one for every other row): 10 are red and 1 survived, a test gap. |
| **Regression: r3, PH and r2 rows** | **met** | `hook.test.ts` and `docs-merge.test.ts` (PH-4, PH-5, PH-7, r2-3, r2-4) are **unchanged** from `c1f1cb48`, as are `prfiles.ts`, `summary.ts`, `emit.ts` and `cli-planner-hook.ts`. `git diff --stat` lists only bash, git, grant, paths, run, r3.test and r4.test. All of them pass. The `r3.test.ts` edits do three things: drop the three outside-repo deny rows (reversed by the ruling), turn the two grant-prefix rows into exact-match rows (r4-5), and quote absolute Bash targets. Quoting is needed because an unquoted path with a space is cut by the shell itself, so r3 had passed on the outside deny of the cut half. **Spot probes:** r3-1 (an absolute backslash Edit, and a quoted `state.json` redirect from `docs/loops`) → deny; r3-2 (a docs merge `&&` a force push) → deny with 0 fetches; r3-4 (`--repo=`) → deny with 0 fetches; P7 (a force push alone) → deny; a standing push to `loop/x` → allow. |

**Declared limit (reported, not scored): a `cd` inside the command line.** `cd open-brain && echo x > src/cli.ts` and
`(cd open-brain; echo x > src/cli.ts)`, both from cwd root, exit **0**. That confirms the handoff. **The limit is stated
only in the developer handoff** ("Not covered"). The refusal text (`BASH_WRITE_LIMIT`: "Static Bash write detection only:
redirects, sed -i, tee, cp and mv targets. It stops mistakes…; it is not a sandbox") does not name it, and no document
outside `docs/loops/` does.

## Defects

**D4: blocker for r4-2; from r1, not a regression. A `~` write target is neither expanded nor refused.**
- **Cause:** `refusedWriteTarget` (`bash.ts`) refuses a target containing `$` or a backtick. `~` is not in that set.
  `toRepoRelative` treats `~/x` as a relative path and joins it to the cwd (`<cwd>/~/x`). That is inside the repo and on
  no protected prefix, so the write is allowed. The shell expands a leading `~` to `$HOME` first (`echo ~/…` prints
  `/c/Users/Aaron/…` on this laptop). File tools take the same route through `checkFileTool`.
- **Probes** (`probe-cand-out.json`):
  - `echo x > ~/qa235-fx/open-brain/src/cli.ts` → **allow**;
  - `echo x > $HOME/qa235-fx/open-brain/src/cli.ts` → **deny**, "contains a shell expansion, so its location cannot be
    determined";
  - a Write to `file_path: "~/qa235-fx/open-brain/src/cli.ts"` → **allow**.

  Base allows all three.
- **Why it counts:**
  - Every seat's checkout is under `~` (`.agents/AGENT.md`: "Atlas's checkout is `~/Worktrees/sia-planner`"), so
    `~/Worktrees/sia-planner/open-brain/src/cli.ts` is an ordinary way to name a PH-1 file.
  - r4-2 is explicit that a target whose location cannot be determined is denied with a named cause, and the hook
    already applies that rule to `$HOME`.
  - The handoff says a `~/…` target "is treated as outside the repo (allowed)". That is not what the code does: it
    treats the target as inside the cwd.
- **Fix direction:**
  - refuse a leading `~` (and `~user`) the same way as `$` ("contains a shell expansion"), for Bash targets and for file
    tools;
  - alternatively, expand `~` from `payload`/`HOME` and resolve the result, though a refusal is simpler and matches
    `$HOME`;
  - add rows for `~/…/open-brain/src/cli.ts`, and a mutant that drops the check.

**D5: Major; from r1, not a regression; same class as r4-6. Three spellings of `gh pr merge` skip the merge check.**
- **Cause:** `GH_PR_MERGE_RE` is case-sensitive, and it needs `pr` to follow `gh` directly.
- **Probes** (`probe-cand-out.json`, fetch recorder). Each of these is **allowed with 0 fetches and no grant**:
  - `GH pr merge 2`, with PR 2 touching `open-brain/src`;
  - `gh.EXE pr merge 2`;
  - `gh --repo other/x pr merge 1`.
- **Verified in a real shell on this laptop:**
  - `type GH gh.EXE` resolves both to `/c/Program Files/GitHub CLI/…`, so both run gh;
  - `gh --repo cli/cli pr list --state merged --limit 1` listed a **cli/cli** PR, so a global `--repo` placed before `pr`
    is honoured.

  So `gh -R melvenac/Self-Improving-Agent pr merge <code PR>` would merge a code PR with no grant.
- **Fix direction:**
  - match `gh` case-insensitively (`/i` on the `gh(?:\.exe)?` part);
  - allow flags between `gh` and `pr`, for example `gh(?:\.exe)?["']?(?:\s+-\S+(?:\s+\S+)?)*\s+pr\s+merge`, or treat any
    `gh … pr … merge` as a merge;
  - have `ghRepoFlag` and the start check see a flag placed before `pr`;
  - add rows and a mutant.

**Minor: the case-varied SUMMARY.md region write has no test.** My `qa-r43-summary-cs` passes `isSummaryPath(relPath)`
without `ci`, and it survives with 129 of 129 passing. The candidate's code is right:

- **candidate** (`qa235-probe-summary.mjs`): a Write that rewrites the marked region of `.AGENTS/SYSTEM/summary.md` →
  **deny**;
- **base:** the same Write → **allow**.

Add one row.

**Observations (not scored; for the planner):**
- **The PowerShell tool is not in the matcher.** The registration snippet's matcher is `Edit|Write|NotebookEdit|Bash`.
  Claude Code on Windows also offers a `PowerShell` tool, which this QA session had. A planner seat with it could run
  `Set-Content open-brain/src/cli.ts …` or `gh pr merge 2` without the hook firing. That is outside r4. It is a decision
  about what the seat is offered.
- **The `"*"` grant** still matches anything, compound commands included (`grantMatchesCommand`). It is unchanged, and
  it is Aaron's hand.
- The handoff's claim that the unquoted-path fixtures had passed on a cut half is consistent with the code, and the
  quoting change is sound.

## Mutants (all local; T-207; none pushed)

Each mutant was applied to a clean `d37e09dc` tree (`C:/qa-scratch/qa235-mut`) and checked as landed (`git diff --numstat`:
1 file, 1 line for each). It was then run through `tsc --noEmit` and `vitest run tests/planner-hook` (129 tests), and
`src/` was restored. Developer mutants were applied from their committed `.diff` files. Mine are exact string edits in
`qa235-mutants.mjs`, and their diffs are in `docs/loops/qa-235/mutants/`.

| Mutant | Row | Applied | tsc | tests/planner-hook |
| --- | --- | --- | --- | --- |
| d3-bash-root (dev) | r4-1 | clean | 0 | **red**, 5 failed |
| d3-file-root (dev) | r4-1 | clean | 0 | **red**, 3 failed |
| outside-deny-bash (dev) | r4-2 | clean | 0 | **red**, 1 failed |
| outside-deny-file (dev) | r4-2 | clean | 0 | **red**, 2 failed |
| expansion-allowed (dev) | r4-2 | clean | 0 | **red**, 1 failed |
| cwd-not-absolute (dev) | r4-2 | clean | 0 | **red**, 2 failed |
| case-artifact (dev) | r4-3 | clean | 0 | **red**, 2 failed |
| case-view (dev) | r4-3 | clean | 0 | **red**, 2 failed |
| prefix-half (dev) | r4-4 | clean | 0 | **red**, 2 failed |
| grant-prefix (dev) | r4-5 | clean | 0 | **red**, 5 failed |
| gh-exe (dev) | r4-6 | clean | 0 | **red**, 4 failed |
| gh-quote (dev) | r4-6 | clean | 0 | **red**, 3 failed |
| QA 234 qa-r32-prefix, as committed | r4-4 | **does not apply** (context moved into `startsWithGhPrMerge`) | n/a | n/a |
| **qa234-qa-r32-prefix-port** (`startsWithGhPrMerge` tests the unanchored regex) | r4-4 | clean | 0 | **red**, 2 failed |
| **qa-r41-resolve-root** (`toRepoRelative` joins a relative path to the root, not the cwd) | r4-1 | clean | 0 | **red**, 7 failed |
| **qa-r41-cwd-raw** (the cwd is not converted to forward slashes) | r4-1 | clean | 0 | **red**, 14 failed |
| **qa-r42-outside-cause** (outside → `ok:false` with a cause) | r4-2 | clean | 0 | **red**, 4 failed |
| **qa-r42-dollar-dropped** (only a backtick counts as an expansion) | r4-2 | clean | 0 | **red**, 1 failed |
| **qa-r43-ci-off** (`toRepoRelative` never sets `ci`) | r4-3 | clean | 0 | **red**, 4 failed |
| **qa-r43-summary-cs** (`isSummaryPath` without `ci`) | r4-3 | clean | 0 | **SURVIVED**, 129 passed (Minor) |
| **qa-r44-env-prefix-ok** (the start check accepts `[env] VAR=x` prefixes) | r4-4 | clean | 0 | **red**, 2 failed |
| **qa-r45-no-squash** (the grant compares trimmed text, without collapsing whitespace) | r4-5 | clean | 0 | **red**, 3 failed |
| **qa-r46-ref-old** (r3's ref extractor, which misses `gh.exe` and `"gh"`) | r4-6 | clean | 0 | **red**, 5 failed |
| **qa-r46-start-no-exe** (the start check drops `.exe`) | r4-6 | clean | 0 | **red**, 3 failed |

The handoff's claims for its 12 mutants (applied, tsc 0, red) **reproduce**. It gave no failure counts; the counts above
are mine.

## CI (tcm, D-061): 2 runs, `windows=true` not used

| Branch | Run id | headSha | Run conclusion | `test` job |
| --- | --- | --- | --- | --- |
| `qa/t194-r4-ci-candidate` | 36731891365 | `d37e09dc4bd38cec0306e542773c3ab881602d6e` | **success** | 109943476212: **success**, 2061 passed / 7 skipped (2068), 140 files |
| `qa/t194-r4-ci-base` | 36731900973 | `c1f1cb483c1afcb1a3cb3f28207e2a75153b1c97` | **success** | 109943507764: **success**, 1994 passed / 6 skipped (2000), 138 files |

- `changed` succeeded and `test-windows` was skipped in both runs.
- The candidate's extra tests are r4.test.ts plus master's merged-in shadow-merge work (`tests/harness/shadow-merge.test.ts`).
- Pushing this report starts one more run of its own (T-178). It proves nothing about the candidate.

## Open for the planner

1. **D4 (`~`): rule on scope.** Either r5 refuses a leading `~` as an expansion, which is small (see Fix direction), or
   the planner rules it outside T-194.
2. **D5 (`GH`, `gh.EXE`, and flags before `pr`): rule on scope.** It is the same class as r4-6, which the planner put in
   scope.
3. If the planner rules both D4 and D5 out, every scored r4 row is met and the candidate stands as an ACCEPT.
4. **The `cd` limit.** It is confirmed, and it is stated only in the handoff. If it stays, the refusal text or the
   planner's role doc should say so.
5. **The PowerShell tool is outside the matcher.** This is an observation about what the seat is offered, not an r4
   defect.
6. **No live check.** The hook is unregistered (this QA registered it nowhere), so PH-8's live half stays
   `not_evaluated`.

## Model

Claude Code, Opus 5.5 (`claude-opus-5-5`), headless `claude -p`, laptop DESKTOP-0GV3HAD, 2026-09-30. The builder was
Claude Code Sonnet. I built none of T-194.

QA-235: REPORT COMPLETE
