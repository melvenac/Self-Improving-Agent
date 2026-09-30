# QA 234: T-194 r3 (the planner seat hook), after QA 233's REJECT

**Verdict: REJECT.** r3 fixes both of QA 233's blockers:

- D1: absolute paths in both slash forms are now denied for PH-1, PH-2 and PH-6, from any cwd.
- D2: a docs-only merge no longer allows anything chained after it.

The grant rule, `--repo` and D-066 are also met, and every mutant that typechecks is red except one QA mutant. CI is
green on the candidate. **One defect remains, and it is in the row the dispatch told me to test with a cwd that is not the
repo root:**

- **D3 (blocker by QA 233's standard; not a regression):** a **relative** Bash write target is resolved against the repo
  root, not against the shell's cwd (`payload.cwd`). With cwd `open-brain/`:
  - `echo x > src/cli.ts` → **allow**;
  - `sed -i s/a/b/ src/cli.ts` → **allow**.

  With cwd `.agents/`, `echo {} > state.json` → **allow**. Each of these writes a PH-1 or PH-2 file. Claude Code keeps
  the Bash cwd between calls, so this is the ordinary state after any `cd open-brain && npm test`.

The planner may rule D3 outside T-194. It was also the base's behaviour, and r3's dispatch item 1 said "resolve …
against the repo root", which the developer did literally. If the planner rules that way, every scored r3 row is met
and this candidate would be an ACCEPT. I am not making that ruling.

- **QA:** 234, record session 234. Claude Code on **Opus 5.5 (`claude-opus-5-5`)**, headless `claude -p`, laptop
  DESKTOP-0GV3HAD (D-068).
- **Dispatch commit (working copy):** `96ebd400403999ff06b29c770d9f853597736abc` (`git -C C:/qa-scratch/qa234-wt log -1`).
- **Candidate:** tip `c1f1cb483c1afcb1a3cb3f28207e2a75153b1c97` on `origin/loop/t194-planner-hook`. The code commit is
  `c1c907da`; the tip adds the handoff and mutant diffs. The candidate contains master's `9b3a4a2c` (checked with
  `merge-base --is-ancestor`). **Base for red:** `699789e1a21763d1e7e4e15a6a501cbbf4756f83`.
- **Evidence:** `docs/loops/t194-r3-qa-report.E_t.json`. `node build/harness/cli.js validate evidence <file>`, run in
  the candidate build, exits **0**.
- **Scripts and raw outputs:** `docs/loops/qa-234/evidence/`:
  - `qa234-probe.mjs` → `probe-cand-out.json` and `probe-base-out.json`;
  - `qa234-probe2.mjs` → `probe2-cand-out.json` and `probe2-mut-prefix-out.json`;
  - `qa234-mutants.mjs` → `mutants-out.json`;
  - `qa234-run.mjs` sets TEMP and TMP to `C:\qa-tmp`.

  The mutant diffs are in `docs/loops/qa-234/mutants/`.

## Local runs (candidate `c1f1cb48`, TEMP/TMP = `C:\qa-tmp`)

| Command | Exit | Result |
| --- | --- | --- |
| `npm ci` | 0 | 185 packages |
| `npm run build` | 0 | `build stamped c1f1cb4` |
| `npx tsc --noEmit` | 0 | no output |
| `npx vitest run tests/planner-hook` | 0 | 3 files, **105 passed** |

The base `699789e1` also builds (exit 0, `build stamped 699789e`) for the red side of the probes. I did not run the full
suite locally; the tcm run below covers it.

## Rows

| Row | Status | What shows it |
| --- | --- | --- |
| **r3-1, D1** | **partial** | **Absolute paths: met.** Through the **real built CLI**, with fixture input and cwd = root, `open-brain/` and `docs/loops/`, each of these exits **2** with a deny naming the rule and the path: Edit to `open-brain/src/cli.ts` in both slash forms, a Write to `.agents/state.json` (fwd) and to `INBOX.md` (back), and a Bash redirect to src (fwd) and to state.json (back, quoted). That is 18 of 18; base: 18 of 18 exit 0. The docs/loops control exits 0 in every cwd. P9, P10, P11 and P15 → deny, and P13 → exit 2 (all allow or exit 0 on base). The Git Bash `/c/…` form, `sed -i`, `tee`, `cp`, `mv` and NotebookEdit also deny with absolute targets. **Outside the repo: met.** A sibling directory, a prefix-sharing sibling (`qa234-fx-x/…`), a UNC path, a Bash redirect outside the repo and a relative `../` are each denied, **naming the cause** ("is outside the repository (…)" or "climbs out of the repository"). **Partial because of D3:** with cwd ≠ root, a relative target is resolved against the wrong directory (Q4, four probes, all allow). |
| **r3-2, D2** | met | Each of these → **deny, with no fetch**: P3 and P4, and after a docs merge `&&` (with and without spaces), `\|\|`, `;`, `\|`, LF, CRLF, `$(…)`, backticks, `&`, a subshell, docs `&&` code, a `cd … &&` prefix, `GH_REPO=… gh pr merge`, and `env GH_REPO=… gh pr merge`. On base, 12 of these 13 separator variants → allow, each after fetching. The subshell alone was already denied on base. **r2-1 does not regress:** a single docs merge → allow (P1, and Q6 controls with `--squash --delete-branch` and a number ref), fetching `pulls/N` and `pulls/N/files`. |
| **r3-3, grant** | met | With a grant for `gh pr merge 5`, each of these → **deny**: `… && git push --force origin master`, `…; git tag v9`, `… \| sh` and `…\ngit push …`. The grant file is still present after all four. On base, the `&&` line → allow and consumes the grant. `gh pr merge 5 --squash` → allow and consumes it (control). `gh pr merge 50` → deny. |
| **r3-4, `--repo`** | met | `--repo other/x`, `--repo=other/x`, `-R other/x`, `-Rother/x`, `--repo other/x 1` (flag first) and `-R other/x 1 --squash` → **deny**, each naming "--repo/-R names another repository", with **0 fetches** (fetch recorder). On base, the four flag-last forms → allow after reading origin's PR 1. A pull URL of another repository (`github.com/other/x/pull/1`) reads `other/x/pulls/1`, **not origin's**, which is consistent. |
| **r3-5, D-066** | met | P6 (`.agents/assignments.json` only) → allow with no grant (base: deny, "unlisted path"). r3.test's D-066 row passes; the developer's `d066` mutant is red. |
| **r3-6, mutants** | met, with one QA survivor | See Mutants. All 9 developer mutants apply cleanly, typecheck (tsc 0) and are red, including ph1-tc, ph2-tc and ph3-tc (r1's ph1 to ph3 replaced), d1-file, d1-bash and d2-compound. My own 8 all typecheck, with at least one per row r3-1 to r3-4: **7 red, 1 survived** (`qa-r32-prefix`, a test gap below, not a code defect). |
| **Regression: PH and r2 rows QA 233 scored met** | met | PH-4, PH-5, PH-7, r2-3 and r2-4 are carried by `hook.test.ts` and `docs-merge.test.ts`. Both are **byte-identical** between 699789e1 and c1f1cb48 (`git diff --stat` is empty), as are `prfiles.ts`, `summary.ts`, `emit.ts` and `cli-planner-hook.ts`, and all of them pass on the candidate. P7 (a force push alone) → deny. P8 (a docs merge with a code grant present) → allow, and the grant's bytes and mtime are unchanged. P2 (a code merge) → deny. QA 233's m1 to m5 and q1 to q4 were not re-run; the tests that killed them are unchanged and green. |

**Re-scoring the rows QA 233 left short:**
- PH-1 and PH-2 are now met for Claude Code's absolute Edit and Write paths.
- PH-3 is met.
- r2-1 and r2-2 are met: D2 is fixed, and P4 no longer lets a second PR through unread.
- **PH-6 stays partial (D3).**
- PH-8's live half stays `not_evaluated` (the dispatch).

## Defects

**D3: blocker by QA 233's standard; from r1, not a regression. A relative Bash write target is resolved against the repo root, not the cwd.**
- **Cause:** `detectBashWriteTargets(command, repoRoot)` (`bash.ts`) passes each target to `toRepoRelative(p, repoRoot)`.
  For a relative `p`, that returns `posix.normalize(p)` unchanged, as though the shell's cwd were the root.
  `payload.cwd` never reaches `bash.ts`. The shell resolves `src/cli.ts` against its cwd.
- **Probes** (`probe-cand-out.json` Q4; each is also allowed on base):
  - cwd `C:/qa-scratch/qa234-fx/open-brain`, `echo x > src/cli.ts` → **allow**;
  - the same cwd, `sed -i s/a/b/ src/cli.ts` → **allow**;
  - cwd `C:/qa-scratch/qa234-fx/.agents`, `echo {} > state.json` → **allow**;
  - cwd `open-brain/`, an Edit with the relative `src/cli.ts` → **allow**. This is the same cause in `checkFileTool`, but it
    matters less, because Claude Code sends absolute file paths.
- **Why it counts:**
  - The target is statically detectable: `payload.cwd` is in the hook input. QA 233 used that test to put P15 inside PH-6.
  - Claude Code's Bash cwd persists between calls, so a planner that ran `cd open-brain` for anything is in this state.
- **Fix direction:**
  - resolve a relative target against `payload.cwd` (for Bash, and for file tools with a relative path), then make it
    repo-relative with `toRepoRelative`;
  - add rows with cwd `open-brain/` and `.agents/`;
  - a mutant that resolves against the root again must be red.

**Minor: the prefix half of the single-invocation check has no test.** `qa-r32-prefix` drops
`!/^gh\s+pr\s+merge\b/.test(…)` and leaves only the separator test. It survives: 105 of 105 pass. On a build of that mutant,
`GH_REPO=other/x gh pr merge 1 --squash` and `env GH_REPO=other/x gh pr merge 1` → **allow**, after reading **origin's**
PR 1, and gh would merge `other/x#1` (`probe2-mut-prefix-out.json`). The candidate denies both
(`probe2-cand-out.json`), so the code is right, but nothing pins it. r3.test's only prefix row is
`echo hi && gh pr merge 12`, which is also compound. Add a `GH_REPO=` row.

**Minor: case-varied absolute paths.** `C:/…/qa234-fx/OPEN-BRAIN/SRC/cli.ts` → **allow** (Q5). `toRepoRelative`
lowercases the root comparison on Windows, but it keeps the original case of the remainder, so the case-sensitive
`ARTIFACT_PREFIXES` do not match. NTFS would write the protected file. Claude Code sends the path as the model wrote it,
so this takes an unusual path, not a normal mistake. The same is true of relative paths on base.

**Observations (not scored; for the planner):**
- **The grant path still covers `--repo`.** A grant for `gh pr merge 1` allows `gh pr merge 1 --repo other/x` (a
  prefix plus a single invocation). r3-4 is about the no-grant path, but the grant was presumably for origin's PR 1.
- **r1-scope evasions, unchanged from base:**
  - `gh.exe pr merge 2` and `"gh" pr merge 2` → allow: `GH_PR_MERGE_RE` needs `gh` followed by whitespace.
  - A grant for `git push origin loop/x` also covers `git push origin loop/x --force` (prefix).
  - The hook's own text says it stops mistakes and is not a sandbox.
- **A behaviour change the handoff flags:** Bash redirects to any path outside the repo are now denied, for example
  `npm test 2> C:/qa-tmp/log.txt` and `git log > /tmp/log.txt` (O3). `/dev/*` is exempt. This follows dispatch item 1
  literally. If the planner needs a scratch redirect, it is a decision.

## Mutants (all local; T-207; none pushed)

Each mutant was applied to a clean `c1f1cb48` tree in `C:/qa-scratch/qa234-mut`. It was checked as landed (`git diff --stat`:
1 file, 1 line for each), then run through `tsc --noEmit` and `vitest run tests/planner-hook` (105 tests), and `src/` was
restored. The developer's mutants were applied from their committed `.diff` files; mine are exact string edits in
`qa234-mutants.mjs`. The diffs are in `docs/loops/qa-234/mutants/`.

| Mutant | Row | Applied | tsc | tests/planner-hook |
| --- | --- | --- | --- | --- |
| ph1-tc (dev) | PH-1 | clean | 0 | **red**, 8 failed |
| ph2-tc (dev) | PH-2 | clean | 0 | **red**, 8 failed |
| ph3-tc (dev) | PH-3 | clean | 0 | **red**, 43 failed |
| d1-file (dev) | r3-1 | clean | 0 | **red**, 9 failed |
| d1-bash (dev) | r3-1 | clean | 0 | **red**, 8 failed |
| d2-compound (dev) | r3-2 | clean | 0 | **red**, 11 failed |
| grant-prefix (dev) | r3-3 | clean | 0 | **red**, 2 failed |
| repo-flag (dev) | r3-4 | clean | 0 | **red**, 3 failed |
| d066 (dev) | r3-5 | clean | 0 | **red**, 1 failed |
| **qa-r31-backslash** (backslashes not converted) | r3-1 | clean | 0 | **red**, 6 failed |
| **qa-r31-outside-ok** (outside the repo → ok) | r3-1 | clean | 0 | **red**, 3 failed |
| **qa-r31-case** (root comparison case-sensitive) | r3-1 | clean | 0 | **red**, 9 failed |
| **qa-r32-pipe-nl** (`\|` and newline dropped from COMPOUND_RE) | r3-2 | clean | 0 | **red**, 4 failed |
| **qa-r32-prefix** (the `^gh pr merge` half dropped) | r3-2 | clean | 0 | **SURVIVED**, 105 passed (see Minor) |
| **qa-r33-grant-side** (single-invocation tested on the grant, not the command) | r3-3 | clean | 0 | **red**, 2 failed |
| **qa-r34-no-R** (`-R` not recognised) | r3-4 | clean | 0 | **red**, 1 failed |
| **qa-r34-fetch-first** (`--repo` denies, but only after reading origin's PR) | r3-4 | clean | 0 | **red**, 3 failed (the zero-fetch assertion) |

The developer's handoff claims for the nine mutants (tsc 0, red, and the same failure counts) **reproduce exactly**. D1
and D2 now have red mutants, which QA 233 could not build. There is no mutant for D3, because the candidate already
allows those inputs and no test covers them.

## CI (tcm, D-061): 2 runs, `windows=true` not used

| Branch | Run id | headSha | Run conclusion | `test` job |
| --- | --- | --- | --- | --- |
| `qa/t194-r3-ci-candidate` | 36723415135 | `c1f1cb483c1afcb1a3cb3f28207e2a75153b1c97` | **success** | 109914118111: **success**, 1994 passed / 6 skipped (2000), 138 files |
| `qa/t194-r3-ci-base` | 36723422366 | `699789e1a21763d1e7e4e15a6a501cbbf4756f83` | failure | 109914140242: **failure**, 1 failed / 1889 passed / 6 skipped (1896), 133 files |

- **The base's one failure is base-shared:** `tests/shared/state-schema.test.ts` › T-171 r3b, "origin/master's real
  state.json parses, and a missing note_by is null". That is the failure master fixed in `9b3a4a2c`. The base lacks the
  fix, and the candidate has it and passes. **No failure is new.**
- `changed` succeeded and `test-windows` was skipped in both runs.
- Pushing this report starts one more run of its own (T-178). It proves nothing about the candidate.

## Open for the planner

1. **D3: rule on scope.** Either r4 resolves relative targets against `payload.cwd`, which is small (see Fix direction),
   or the planner rules relative-under-a-subdirectory-cwd outside T-194. In that case the scored rows are all met.
2. **The grant covers `--repo`**, and **outside-repo Bash redirects are now denied** (Observations). Each is a decision,
   not a defect.
3. **A `GH_REPO=` test row** closes the `qa-r32-prefix` survivor.
4. **No live check.** The hook is unregistered (never registered by this QA), so PH-8's live half stays `not_evaluated`.

## Model

Claude Code, Opus 5.5 (`claude-opus-5-5`), headless `claude -p`, laptop DESKTOP-0GV3HAD, 2026-09-30. The builder was
Claude Code Sonnet. I built none of T-194.

QA-234: REPORT COMPLETE
