# T-194 r5 developer handoff (Forge, QA PC DESKTOP-O4EGB1E, Sonnet 5.5)

Candidate: `loop/t194-planner-hook`. Dispatch: `docs/loops/t194-r5-dispatch.md`. Base: r4 tip `d37e09dc`, `origin/master`
`717a5509` merged in first by a merge commit (`70ecf612`), no force. The hook is NOT registered in any settings file.

## Evidence (this tree, Windows 10, Node 22, run SEQUENTIALLY; free RAM 2.82 GB before the mutants)

| Step | Result |
|---|---|
| `npm ci` | exit 0 (185 packages) |
| `npm run build` | exit 0, `build stamped 491d8a7` (first build); `tsc --noEmit` exit 0 at the final product `8bd1541d` (and at HEAD) |
| `vitest run tests/planner-hook` (final) | **exit 0, 6 files, 431 tests passed** |
| the same r5 tests against the **r4 product** (`git checkout d37e09dc -- open-brain/src/planner-hook`) | **exit 1: 141 failed of 296** (the red side), then restored |
| mutants | 50 diffs. Run 1: **46 killed, 4 survived**. Run 2 (the 4 survivors, plus one that failed to typecheck): all killed. Run 3 (one more survivor): killed. Results: `docs/loops/t194-r5/mutants/results-run1.json`, `results-run2-survivors.json`, `results-run3-longpath.json` |

The first local run was not green: 10 failures, all real (list under "What the first run found"). Nothing was pushed before this.

## The properties, clause by clause (test = where it is pinned, mutant = what kills it)

**P1, one canonicaliser.** `classifyTarget` / `toRepoRelative` in `paths.ts`; every Bash and PowerShell target and the Edit/Write
file tools go through it. Resolved against `payload.cwd`, slashes normalised, `.`/`..` applied, case folded on a Windows drive.
- Non-literal target refused with a named cause: leading `~` / `~user`, `$`, backtick, `* ? [`, `{ }`, `( )` in a shell target.
  Tests: `r5.test.ts` "P1 non-literal" (named rows + file tools), `r5-property.test.ts` non-literal family (200 generated).
  Mutants: `p1-tilde-allowed`, `p1-glob-allowed`, `p1-brace-allowed`, `p1-dollar-backtick-allowed`, `p1-paren-allowed`,
  `p1-filetool-literal-off`.
- Same-line `cd`/`pushd`/`Set-Location` plus any file write is refused, even outside the repo (Atlas ruling 1; the refusal text says
  "split them into two commands"). Tests: "P1 cd" rows, property cd family (200) and its no-write controls (60).
  Mutant: `p1-cd-allowed`.
- Location: cwd, case, `\\.\` and `\\?\` prefixes, `/mnt` and `/cygdrive` forms, NTFS trailing dots/spaces and `name:stream`, 8.3 short
  names. Mutants: `p1-cwd-ignored`, `p1-case-folded-off`, `p1-longpath-off`, `p1-ntfs-dots-off`, `p1-shortname-off`.
- Targets: redirects (`> >> >| &> 2>`), `tee` (every file), `cp`/`mv`/`install`/`ln` (destination, `-t`, `--target-directory=`), `sed -i`
  (`-e`/`-f` aware), nested code (`bash -c`, `$( )`, backticks, `eval`). Mutants: `p1-tee-first-only`, `p1-cp-t-ignored`,
  `p1-sed-e-files`, `p1-nested-not-parsed`, and `p1-heredoc-body-parsed` (heredoc bodies and quoted prose are data, so a commit
  message with `>` or a backtick is not a write).
- Generated: 400 path spellings (case, absolute/relative, `./`, `x/../` detours, `//`, backslashes, quote variants, cwd x 9, 17 Bash
  writers x 7 chains, PowerShell writers, Edit, Write). Oracle: `path.resolve` (win32 on this checkout) plus a protected-prefix list
  written in the test.

**P2, the merge grammar.** `analyzeGhMerge` in `git.ts`. A merge is any gh word (file name, any case, any extension, quotes removed,
or a substituted word) followed by `pr` then `merge`, flags anywhere, also inside nested code. The only no-grant form is one whole
command line `gh pr merge <ref> [--squash --merge --rebase --delete-branch -s -m -r -d]`: no prefix, wrapper, boundary, redirect,
substitution, other flag, or flag before `pr`. Tests: `r5.test.ts` (not-exact rows, exact rows, code-PR rows, non-merge
controls, grant rows), property merge family (300 generated + 100 non-merge). Mutants: `p2-gh-case-sensitive`,
`p2-gh-extension-kept`, `p2-any-flag-allowed`, `p2-boundary-ignored`, `p2-redirect-allowed`, `p2-substituted-name-not-gh`,
`p2-nested-merge-not-seen`, `p2-repo-flag-ignored`, `p2-subshell-callop`.
Note: `GH pr merge 2` and `gh.EXE pr merge 2` are in the exact grammar (case-insensitive gh word): they are READ, then denied for a code
PR and allowed for a docs-only one, as r4 treats `gh.exe`. They are not allowed unread.

**P2b, git (Atlas ruling 2).** `gitRestrictedIn` in `git.ts` replaces r4's regexes (`isForcePush` etc. are gone; nothing else used them).
Git word read like the gh word; global options skipped (`-C <dir>`, `-c k=v`, `--git-dir[=]`, `--work-tree`, `--no-pager`...); then
`merge` and `tag` always need a grant; a push needs one unless STANDING: remote `origin`, every refspec a plain branch under `loop/ qa/
docs/ chore/`, none of `--force*`, `-f` in a short cluster, `+src:dst`, `:dst` (delete), `--tags --follow-tags --mirror --all --prune
--delete -d`, a bare push, or a substituted argument. A grant matches exactly (r4-5). Tests: `r5.test.ts` P2b (need-grant rows and
not-restricted rows), property git family (300 generated + 40 exact-grant uses). Mutants (16): `p2b-*`.

**P3, PowerShell.** Matcher `Edit|Write|NotebookEdit|Bash|PowerShell` (`registration.ts`); tool name read without case; cmdlets
`Set-Content`/`Add-Content`/`Out-File`/`Clear-Content`/`Tee-Object`, `New-Item` (`-Name` joined), `Copy-Item`, `Move-Item`,
`Rename-Item`, `Remove-Item` and their aliases, `-Path`/`-LiteralPath`/`-FilePath`/`-Destination`, parameter prefixes (`-Lit`, `-Dest`), comma
lists, `>`/`>>`; `Invoke-Expression`/`iex`/`Invoke-Command` and a script block that writes are refused; `& gh`, `.\gh.exe`. Mutants:
`p3-matcher-without-powershell`, `p3-powershell-tool-ignored`, `p3-tool-name-case`, `p3-dynamic-allowed`, `p3-param-prefix-off`,
`p3-move-source-ignored`, `p3-newitem-name-ignored`.

## What the first run found (all fixed, each now has a row)

1. A redirect target swallowed a closing `)`: `(echo x > f)` was read as the target `f)` and refused. Fixed in `shell-words.ts`.
2. The 8.3 short-name rule refused every outside path under a short temp dir (`AARONM~1`). It now counts only a short name past the
   point where the path leaves the root's own spelling.
3. `git push origin :loop/x` (delete) was read as standing. Fixed.
4. Test data: backslashes lost in two lists (my heredoc), and two named rows wrongly said `GH pr merge 2` needs no read.
5. After run 1, four mutants survived. Each exposed a hole in the TESTS, one of them a real gap: `git push origin +HEAD:loop/x` and
   `loop/$BR` were not pinned. Also `p1-longpath-off` survived because the glob rule (`?` in `\\?\`) refused it first; a `\\.\` row now
   isolates the prefix rule. The fixture now uses the long (`realpath`) temp path, which exposed that two generators did not quote a path with
   a space ("Aaron Melven").

## Beyond the dispatch (named, as ruled)

- `mv` and `Move-Item` also check their SOURCE (a move deletes it) (Atlas ruling 3).
- P2b, git, was added by Atlas ruling 2.
- `install`, `ln`, `Rename-Item`, `Clear-Content`, `Tee-Object` are read as writers.
- A path with an 8.3 short name past the shared root is refused.

## Supersedes (r4 behaviour changed on purpose)

- A `cd` in the same line as a write is refused (r4 declared this a limit).
- A leading `~` is refused (QA 235 D4); r4 treated it as inside the cwd.
- `gh --repo x pr merge`, `GH`, `gh.EXE` are read (QA 235 D5).
- `git merge-base` is no longer read as `git merge`; `git push origin feature/x` now needs a grant (r4 allowed any push whose text
  contained `loop/ qa/ docs/ chore/` anywhere).
- r4 files unchanged: `hook.test.ts`, `docs-merge.test.ts`, `r3.test.ts`, `r4.test.ts` all pass as they were.

## Out of reach (also in `BASH_WRITE_LIMIT`, so the refusal text carries it)

A path a script builds at runtime (`node x.js` writing `src/`); other write commands (`rm`, `touch`, `dd`, `curl -o`, `git checkout`,
`perl -pi`, `awk -i`); symlinks and junctions; a merge through the GitHub API (`curl`, `gh api`); a `bash -c` string nested more than four
levels; `Rename-Item`'s second argument (a new NAME, not a path) is not resolved, though its source is checked. `cd` plus a write is
refused rather than followed.

## Not covered, said plainly

- The probes: I used the QA 235 probe script (`qa235-probe.mjs`, from `origin/qa/t194-r4-report`) row by row, and the QA 234 and QA 233
  reports' tables. I did not have the QA 233/234 probe scripts themselves. Rows derived from the reports, not the scripts.
- Cursor and the Linux path of the code were not run (this is a Windows checkout; the Windows-only rows ran, the POSIX oracle branch did
  not). CI was not run (D-061).
- The mutants were run once, then only the survivors again (two further runs, 5 and 1 mutants) after adding rows. The tests only grew
  between runs, so the 45 mutants killed in run 1 stay killed; I did not re-run them all.
- Fail-closed cost: the hook now refuses some commands a planner may want (`cd X && cmd > /tmp/out`, a redirect to `$TMPDIR/x`, a
  target with `(` or `{`). Each refusal names its cause.
- `docs/loops/t194-r5/mutants/specs.mjs` and `make-diffs.mjs` write the diffs; `run-mutants.mjs` runs them. The diffs are evidence and are
  not applied to the branch.
