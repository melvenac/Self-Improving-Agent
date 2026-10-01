# T-194 r6 developer handoff (Forge, QA PC DESKTOP-O4EGB1E, Sonnet 5.5)

Candidate: `loop/t194-planner-hook`. Dispatch: `docs/loops/t194-r6-dispatch.md` (Atlas, on `origin/docs/session-155f`). Base: r5 `7a3a4441`;
`origin/master` merged in first by a merge commit (`5f0621a7`), no force. **The hook is not registered in any settings file.**

## What r6 is

A new first rule, **P0, the parse gate** (`open-brain/src/planner-hook/parse-gate.ts`). A Bash or PowerShell command is looked at by
P1, P2, P2b and P3 only if every word is inside a small accepted grammar. Anything else is refused as
`not statically parseable: <construct>`, and the construct is named. The gate is a second, strict scanner: it does not depend on
`shell-words.ts`'s idea of a word.

**Honest account of "the parser gets smaller": it did not.** The gate is new code (~750 lines) in front of r5's. I kept r5's tokeniser
paths (heredoc skipping, `$( )` and backtick bodies, escape handling, `eval` / `pwsh -Command` nesting) because (a) r5's 50 mutants must
stay red, (b) `sh -c '<string>'` is still parseable and still nested, and (c) they are defence in depth. Most of them are now UNREACHABLE
through the hook, because the gate refuses the input first; `r6-depth.test.ts` calls them directly so removing one is still seen. Deleting
them is a safe follow-up; it was not done here.

## Evidence (this tree, Windows 10, Node 22; every step run sequentially, with Aaron's approval in this window)

| Step | Result |
|---|---|
| `npm ci` | exit 0 (185 packages) |
| `npm run build` | exit 0 (stamped at the commit it was built from) |
| `tsc --noEmit` | exit 0, at the final product |
| `vitest run tests/planner-hook` (final) | **exit 0, 10 files, 813 tests** |
| the three r6 test files against the **r5 product** | exit 1, **173 failed of 365** (taken when the r6 files held 365 tests; they hold more now) |
| mutants | **105 diffs, all 105 killed and typecheck** (42 P0, 50 r5, 13 for the rulings) — over 14 runs, see below |
| QA 237's 1,555 cases (`r6-qa237.test.ts`) | all pass, on 7 sources; counts below |

**The first local run was not green:** 43 failures in the first full run. Real fixes are listed under "What the first runs found".

### The mutants (`docs/loops/t194-r6/mutants/`; logs in `logs/`, final state in `final-summary.json`)

The full 105 did NOT run in one pass. The first attempt was **stopped by the system for low memory** after 13 mutants (Aaron then said to run in
batches), and it left one mutant applied to `bash.ts`, which I restored with `git checkout` before anything else. Then 12-at-a-time batches.
Two of those crashed on STALE diffs (I had edited `parse-gate.ts` after generating them), so all diffs were regenerated and the unrun,
surviving and non-typechecking mutants re-run in four more batches, then five more. **A mutant that survived led to a new test row each time**:

| Survivor | Why it survived | Fix |
|---|---|---|
| r5 `p1-heredoc-body-parsed`, `p2-boundary-ignored`, `p2-substituted-name-not-gh`, `p3-dynamic-allowed`, `p2b-expanded-*` (3) | the gate refuses their input first, so the guarded code is dead through the hook | `r6-depth.test.ts` calls the P1, P2, P2b functions directly (and the heredoc row needed a body line that is harmful when read as a command) |
| `p0-sed-file-script-allowed`, `p0-newline-allowed` | the same check was written twice in `parse-gate.ts` | removed the duplicates; added `sed --file=` and `sed --expression=` rows |
| `p0-ps-tilde-allowed` | no PowerShell tilde row | row added |
| `p0-ps-ambiguous-parameter-allowed` | no ambiguous-prefix row | `Get-ChildItem docs -F` / `-Fi` rows |
| `r6-foreign-url-read`, `r6-foreign-url-repo-name` | my foreign-URL row differed from origin in BOTH owner and repository | rows that differ in one only |
| three mutants failed to typecheck (`p0-git-alias`, `r5-p2b-leading-options`, `r6-cp-attached-t`) | a mutant that does not compile proves nothing | the mutant text was changed so it compiles, then re-run |

So **the "run the mutants once" condition was not met**: 105 mutants, 14 batches, every one killed in the last run that counted. The
earlier kills were against earlier test sets (tests only grew); I did not re-run all 105 against the final tests.

## P0's classes, mapped to a test and a mutant (red against r5, then green)

Named rows: `r6.test.ts` (list in `r6-cases.ts`: 89 Bash and 51 PowerShell refusals, each naming its construct); generator:
`r6-gate-property.test.ts` (**over 800 refused cases** placed at a write target, a git subcommand, a gh subcommand, a wrapper position,
after an operator, behind `env`/`command`, inside `sh -c`; **about 300 accepted cases**, judged by P1-P3).

| P0 class | Bash/PS | Mutant that goes red |
|---|---|---|
| backslash (outside single quotes; inside double quotes) | Bash | `p0-backslash-allowed`, `p0-backslash-in-dq-allowed` |
| `#` at the start of a word | Bash, PS | `p0-comment-allowed`, `p0-ps-comment-allowed` |
| reserved words | Bash | `p0-reserved-word-allowed` |
| heredoc, here-string | Bash | `p0-heredoc-allowed` |
| code fed to a shell (`sh`, `bash`... only as `-c '<string>'`) | Bash | `p0-shell-stdin-allowed` |
| wrapper with options (`env`, `command`, `nohup`) | Bash | `p0-wrapper-options-allowed` |
| unlisted wrappers (`timeout`, `nice`, `xargs`, `sudo`, `eval`...) | Bash | `p0-unlisted-wrapper-allowed` |
| `sed` `w`, `e`, `s///w`, `s///e`, `-f` | Bash | `p0-sed-w-allowed`, `p0-sed-e-allowed`, `p0-sed-s-flags-allowed`, `p0-sed-file-script-allowed` |
| `$`, `$'...'`, backtick, `{ }`, `( )`, glob, tilde, `&`, fd redirects, newline | Bash | `p0-dollar-allowed`, `p0-dollar-in-dq-allowed`, `p0-backtick-allowed`, `p0-brace-allowed`, `p0-paren-allowed`, `p0-glob-allowed`, `p0-tilde-allowed`, `p0-background-allowed`, `p0-fd-redirect-allowed`, `p0-newline-allowed` |
| inline code (`node -e`, `python -c`, `perl -e`, stdin `-`) | Bash | `p0-inline-code-allowed` |
| git alias, gh alias or extension | both | `p0-git-alias-allowed`, `p0-gh-alias-allowed` |
| unknown / ambiguous parameter (incl. the common ones) | PS | `p0-ps-unknown-parameter-allowed`, `p0-ps-ambiguous-parameter-allowed` |
| unknown cmdlet | PS | `p0-ps-unknown-cmdlet-allowed` |
| splat, `( )`, script block, provider path, drive-relative, `<# #>`, `[type]::`, `$`, tilde, dot-source, newline | PS | `p0-ps-splat-allowed`, `p0-ps-paren-allowed`, `p0-ps-script-block-allowed`, `p0-ps-provider-path-allowed`, `p0-ps-drive-relative-allowed`, `p0-ps-block-comment-allowed`, `p0-ps-type-literal-allowed`, `p0-ps-dollar-allowed`, `p0-ps-tilde-allowed`, `p0-ps-dot-source-allowed`, `p0-ps-newline-allowed` |
| `Invoke-Expression`, `iex`, `Invoke-Command`, `Start-Process`, `powershell`/`pwsh`, `iwr`, `curl`..., `& ` on anything but gh | PS | `p0-ps-dynamic-command-allowed`, `p0-ps-call-operator-allowed` |

## The rulings, mapped

| Ruling | Test (in `r6.test.ts` unless noted) | Mutant |
|---|---|---|
| D3 `cp -tDIR`, `-vt DIR`, `--target`, `--t` | "D3" rows | `r6-cp-attached-t`, `r6-cp-long-prefix` (and r5 `p1-cp-t-ignored`) |
| D4 `/dev/..` is not the null device | "D4" rows | `r6-dev-prefix-sink`, `r6-dev-dotdot-normalise-late` |
| D8 `#N` | "D8, D9" (unquoted refused by P0; quoted `'#1'` is PR 1, read) | `p0-comment-allowed` |
| D9 a foreign pull URL needs a grant, not read | "D8, D9", `docs-merge.test.ts` | `r6-foreign-url-read`, `r6-foreign-url-repo-name` |
| Open 4: a merge is gh's first two positional words, `pr merge` | "Open 4" rows | `r6-nonmerge-token-rule`, `r6-nonmerge-global-flag-value` |
| Open 5: `git -c alias./remote./url./include./includeIf./core.` needs a grant | "Open 5" rows | `r6-git-c-keys-allowed` |
| D17: the limit text states what is still true, nothing it states is caught | "D17" (3 rows: phrases present, caught items absent, every named item really allowed) | `r6-limit-claims-caught-item` |
| QA 237 survivors `qa-p1-install-ignored`, `qa-p3-comma-list-off` | "install is a writer", "comma list" rows | `r6-install-ignored`, `r6-comma-quoted-split-off` |
| D13 `New-Item -Type` | "D13" rows | `r6-ps-param-table-type` |

## QA 237's probes (`docs/loops/t194-r6/qa237-rows.json`, produced by `extract-qa237-rows.mjs` from QA's own scripts)

A row passes when the hook decides what QA's oracle required, or when P0 refuses it ("superseded by P0"). Because a P0 refusal satisfies
any expectation, `r6-qa237.test.ts` also pins how many rows P1-P3 still decide (it must exceed half of QA's allow/read/grant rows):

| Source | Rows | Refused by P0 | Decided by P1-P3 |
|---|---:|---:|---:|
| probe-holes | 64 | 32 | 32 |
| probe-holes2 | 29 | 26 | 3 |
| gen-p1 | 400 | 277 | 123 |
| gen-p2 | 380 | 113 | 267 |
| gen-p2b | 300 | 131 | 169 |
| gen-p3 | 360 | 267 | 93 |
| fail-closed | 22 | 8 | 14 |

Row judgement exceptions, all in `judge()` with a reason: (1) an exact-grammar control QA saw refused for want of a GitHub token is allowed after a
read here, because the test supplies a fake GitHub; (2) QA's r5-era "standing push" rows that carry `-c core.` etc. are superseded by Open 5.

## What the first runs found (all fixed, each now has a row)

1. **PowerShell `-Path:"x"`** skipped the unknown-parameter check: I treated any token containing quotes as plain data. Now a token is a parameter
   if it does not START with a quote. (QA's gen-p3 caught this; real hole.)
2. **Unquoted comma list as an argument to `git`/`gh`** (`git push origin loop/x,master`): PowerShell passes an array, the hook read one word. Now refused.
3. **`Out-File -Path`** was refused as unknown although it is a real alias; added.
4. The gate's own refusal text contains the phrase `not statically parseable` (it is in the limit text), so my "not refused by the gate" tests were
   vacuous. They now look for the refusal's PREFIX.
5. My fake GitHub knew only PRs 1 and 2; QA's made every PR docs-only. Fixed in the fixture.
6. Generators of mine produced commands the gate rightly refuses (`( )` chains, newline forms, `>|`, `& git`, `loop/$BR` as a grant target). Fixed.

## Supersedes (tests edited on purpose; r4's `hook.test.ts`, `r3.test.ts` unchanged)

- `docs-merge.test.ts`: the row that ALLOWED a foreign pull URL after reading that repository is replaced by two rows (foreign: needs a grant, nothing read;
  origin: read). D9.
- `r4.test.ts`: two rows used `echo {} > state.json` as an unprotected write; braces are now refused, so they use `'{}'`. One reason matcher accepts the P0 refusal.
- `r5.test.ts`: the heredoc commit-message rows are replaced (a heredoc is refused: write the message to a file, or use single-quoted `-m`); reason
  matchers on non-literal and grant rows accept the P0 refusal; `loop/$BR` and `$(...)` rows are refused by P0 first.
- `r5-property.test.ts`: generators no longer produce `( )` chains, `>|`, `& git`, newline cd forms, or `$( )`, because those are refused now.
- **r5 behaviours the gate now refuses**: heredoc bodies as data, `$( )`/backtick nesting, newline and `( )`, `>|`, `& git`, `GIT MERGE` (not a git command), `git -c ... ` alias keys,
  `git push origin loop/$BR`, an unquoted `#`, a backslash anywhere outside single quotes.

## Fail-closed cost (`cost-list.txt`, from `cost-list.mjs` against the built hook; `check-rewrites.mjs` confirms each rewrite is accepted)

31 commands a planner may type, every one denied, each with its refusal text and a rewrite that works. The ones Atlas named:
- `cd docs && npm test > out`: refused (cd plus a write: split them); rewrite `npm --prefix docs test > out`.
- `timeout 60 npm test`: refused (`timeout` is an unlisted wrapper); rewrite `npm test`.
- a heredoc commit message: refused (`$` inside double quotes / heredoc); write the message to a file, `git commit -F file`.
- also: `ls docs/*.md` (glob), `~/x` (tilde), `git status # note` (comment), `$VAR`, `$(...)`, `for`/`if` loops, multi-line commands, `xargs`, `find -exec`,
  `sudo`, `node -e`, `(cd x; y)`, `cmd &`, git and gh aliases, PowerShell `{ }`, `$var`, `(expr)`, `-ErrorAction`, `Export-Csv`, `[type]::`, `powershell -Command`.

## Beyond the dispatch

- PowerShell: `$null` alone is accepted (`> $null` is too common to refuse); an unquoted comma in a native-command argument is refused; `Out-File -Path` accepted;
  module-qualified cmdlets refused; `iwr`, `curl`, `wget`, `saps`, `ii`, `Add-Type`, `New-Object` and others refused by name.
- Bash: `awk -i`, `node -e`/`-p`, `python -c`, `perl -e`, `ruby -e`, `php -r`, `find -exec` refused; `git` and `gh` subcommands are checked against lists of their own commands.
- A pull URL is compared with origin case-insensitively, owner and repository separately.

## Not covered, said plainly

- **Nothing ran on Linux or in CI** (D-061); the POSIX branch of the oracle ran on r5's CI, not on this change.
- The gate treats **an unquoted comma in PowerShell native arguments**, **8.3 short names**, and **drive-relative paths** conservatively; none of that is checked against a real shell on this change.
- Real PowerShell 5.1 parameter prefixes were checked against my own tables only; QA's oracle used PS 5.1 itself for r5 and may find a cmdlet or alias I did not tabulate (an unknown one is REFUSED, so the failure direction is closed).
- The refusal list for Bash is a list: a command word I did not name that runs code (`env`-like wrappers I did not think of) would not be refused by name. P1-P3 still see its arguments.
- `r6-depth.test.ts` tests code that the hook can no longer reach; deleting that code is the follow-up the dispatch's "smaller" asks for.
- Out of reach, as in the limit text: what a program the command runs does with its own arguments; Bash `rm`/`touch`/`dd`/`curl -o`/`git checkout`; symlinks and junctions; a merge through the GitHub API.
