# T-194 r7 developer handoff (Forge, QA PC DESKTOP-O4EGB1E, Sonnet 5.5)

Candidate: `loop/t194-planner-hook`. Dispatch: `docs/loops/t194-r7-dispatch.md`. Base: r6 `9cf8c7eb`; `origin/master` (`ed051380`) merged in first by a merge
commit, no force. **The hook is not registered in any settings file.**

## What r7 is

r6 inverted the default for CONSTRUCTS and left two gaps: CHARACTERS and COMMAND WORDS (QA 241's six classes D-A to D-F). r7 closes both the same way.

| Clause | What the hook now does |
|---|---|
| **P0a** characters | PowerShell: any character outside printable ASCII (plus tab, newline, carriage return, which have their own rules) is refused, `not statically parseable: non-ASCII character U+XXXX`. Bash: non-ASCII only inside an ASCII single or double quote; anywhere else refused the same way. |
| **P0b** one validator | `validateTarget` (`paths.ts`) is the ONE function every write target goes through: literal, shape (provider path `::`, drive-relative `C:name`, non-ASCII), location, protected-path test. Sources: Bash redirects, tee, cp, mv, install, sed -i, scp's local end; PowerShell `>` `>>` `2>`, every cmdlet `-Path`/`-LiteralPath`/`-FilePath`/`-Destination`/positional, `New-Item -Name`; the Edit/Write/NotebookEdit file tools. The gate's PowerShell redirect targets get the same shape check (D-A). |
| **P0c** command words | A Bash command word must be in `BASH_ALLOWED_COMMANDS` (`bash-commands.ts`, table below), or `command not allowed: <word>`. A path as the command word is refused (`./git` is not `git`). `node` only as `node <file.js\|.mjs\|.cjs> [args]`, so `-e`, `--eval`, `-p`, `--print`, `-r`, `--import` are refused in every spelling. `curl` is read-only; `rg --pre`, `ssh -F`, `ProxyCommand`, `LocalCommand` are refused; a shell only as exactly `-c '<string>'`. |
| **P0d** environment | A leading `NAME=value` (also after `env`) with `GIT_*`, `GH_REPO`, `GH_HOST` (and `GH_CONFIG_DIR`, `GH_TOKEN`, `GITHUB_TOKEN`, ...): `git/gh config through the environment`. Beyond the dispatch: `PATH`, `HOME`, `USERPROFILE`, `XDG_CONFIG_HOME`, `NODE_OPTIONS`, `BASH_ENV`, `LD_PRELOAD`... (what runs, or which config is read). |
| **D-C** | `New-Item -Name <n>` with no `-Path` targets `<cwd>/<n>`; with `-Path` the name is also checked on its own (`docs` + `C:name` hides the drive-relative form once joined). |
| **CI on Linux** | The `r6-qa237` rows tagged `case` expect a deny only where the file system folds case (the fixture root is a Windows drive); elsewhere they are not required to deny. |

## Evidence (this tree, Windows 10, Node 22; Aaron approved heavy runs in this window)

| Step | Result |
|---|---|
| `npm run build` / `tsc --noEmit` | exit 0 / exit 0, at the final product (`build stamped 80d0a30`) |
| `vitest run tests/planner-hook` (final, unmutated) | **exit 0, 14 files, 1,101 tests** |
| the four r7 test files against the **r6 product** | exit 1, **190 failed of 276** (taken before the last 11 rows were added) |
| mutants | **139, all killed and typecheck** (50 r5 + 42 P0 + 13 for the rulings + 34 for r7) |
| QA 241's rows | all pass; see below |

### The mutants: what ran, and what did not

**The dispatch asked for ONE pass on a free machine. The pass ran in chunks, not as one pass, and here is exactly why.**
- A first attempt (chunks of 12, vitest's default workers) was **stopped by the system for low memory at the first mutant** (0 of 139 ran); it
  left `r5-p1-tilde-allowed` applied to `paths.ts`, which I reverted from git before anything else. Clark reported `sia-builder` was also working on this PC.
- Atlas then ruled a ONE capped retry: one worker (`--pool=forks --maxWorkers=1`), chunks of 4, a chunk SKIPPED when under 1.2 GB is free or another vitest runs.
  That ran all 35 chunks, **none skipped, none killed**, in one background command (`run-chunks.mjs`, logs in `mutants/logs/pass1-chunks.log`):
  **134 killed, 5 survived, 0 failed to typecheck.**
- Each survivor was a test gap or a duplicated check, fixed, then the **16 mutants that touch the changed code were re-run** (`logs/rerun-chunk0-3.log`): all killed.
  `final-summary.json` holds each mutant's last verdict and which run it came from (123 from the pass, 16 from the re-run).
- **So 123 kills are against the source and tests as they stood before the last fix** (the character check split, 11 rows); I did not re-run those 123 against the final
  state. The suite is unmutated-green at the final state. QA 246 runs all 139 in one pass on the laptop.

| Survivor in the pass | Why | Fix |
|---|---|---|
| `r7-ps-nonascii-allowed`, `r7-nonascii-controls-allowed`, `r7-nonascii-del-allowed` | the token-level shape check ALSO refused non-ASCII, so the whole-command P0a check was redundant | `pathShapeProblem(text, checkAscii)`: the gate's token check no longer looks at characters; P0a owns them |
| `r7-gate-ps-2redirect-shape` | no row for a `2>` provider-path/drive-relative target at the gate | rows for `> >> 2> 2>> 1> 3> 6>` |
| `r7-node-extension-case` | no `node x.json` / `x.jsx` / `x.js.txt` row | rows added |

## The allow-list (`BASH_ALLOWED_COMMANDS`, each entry with a reason)

The planner's working set, as the dispatch asked (git, gh, npm, npx, node, ls, cat, echo, printf, grep, rg, head, tail, wc, diff, pwd, which, date, mkdir, cp, mv, tee, sed, test,
true, false, ssh, scp, curl) plus what I could derive without the planner's session logs (cd/pushd/popd, rm/rmdir/touch, install, cmp/comm, jq, stat, file, du, basename, dirname,
realpath, readlink, checksums, tr/cut/uniq, uname/whoami/hostname/sleep). **I did not have the planner's actual sessions to derive from; that is a judgement, and QA or the planner should add
what is missing.** `sh -c`/`bash -c` stay (the string is gated in turn, so the allow-list applies inside it). NOT on the list on purpose: perl, python, ruby, php, awk, find, sort, xargs, trap, mapfile,
eval, source, `.`, export, set, read, alias, wget, dd, tar, zip, rsync, kill, every other shell.

| Word | Reason |
|---|---|
| `git` | the planner's own tool; subcommands are checked against git's own commands (P0), pushes and merges by P2b |
| `gh` | pull requests and checks; subcommands are checked against gh's own commands (P0), merges by P2 |
| `npm` | runs the project's scripts |
| `npx` | runs a package's binary (tsc, vitest, gitnexus) |
| `node` | only as `node <file.js/.mjs/.cjs> [args]`: no option before the script, so --eval, -e, -p, --print, -r and --import are refused in every spelling |
| `ssh` | reaches the other seats' machines; the remote side is outside this hook (D-019) |
| `scp` | copies to or from another machine; the remote side is outside this hook (D-019); the local end is read as a write target |
| `curl` | read-only fetches; any option that writes a file is refused |
| `ls` | list a directory |
| `cat` | read files |
| `head` | read the start of a file |
| `tail` | read the end of a file |
| `wc` | count lines |
| `diff` | compare files |
| `cmp` | compare files byte by byte |
| `comm` | compare two sorted files |
| `grep` | search text |
| `rg` | search text (--pre and --hostname-bin run programs and are refused) |
| `jq` | read JSON |
| `stat` | file metadata |
| `file` | file type |
| `du` | disk use |
| `basename` | path arithmetic |
| `dirname` | path arithmetic |
| `realpath` | path arithmetic |
| `readlink` | path arithmetic |
| `md5sum` | checksum |
| `sha256sum` | checksum |
| `shasum` | checksum |
| `tr` | translate characters in a pipe |
| `cut` | select columns in a pipe |
| `uniq` | collapse duplicate lines in a pipe |
| `echo` | print text |
| `printf` | print text |
| `pwd` | print the working directory |
| `which` | locate a program |
| `date` | print the date |
| `uname` | platform name |
| `whoami` | user name |
| `hostname` | host name |
| `sleep` | wait |
| `test` | conditions |
| `true` | exit status |
| `false` | exit status |
| `tee` | write a stream to files |
| `cp` | copy files |
| `mv` | move files |
| `install` | copy files with a mode |
| `sed` | edit text; the script is read by the parse gate (no w, no e, no -f), -i targets by P1 |
| `mkdir` | create a directory (the target is not read; limit text) |
| `rm` | delete files (the target is not read; limit text) |
| `rmdir` | delete a directory (the target is not read; limit text) |
| `touch` | create or touch a file (the target is not read; limit text) |
| `cd` | change directory (a cd on the same line as a write is refused by P1) |
| `pushd` | change directory (same rule as cd) |
| `popd` | change directory (same rule as cd) |
| `env` | only with no options; the command after it is checked as well |
| `command` | only with no options; the command after it is checked as well |
| `nohup` | only with no options; the command after it is checked as well |
| `sh` | only as `sh -c '<string>'`; the string is gated in turn |
| `bash` | only as `bash -c '<string>'`; the string is gated in turn |

## Generators and QA 241's probes

- **P0a** (`r7-gate-property.test.ts`): 32 characters (NBSP, U+2000 to U+200A, U+3000, en/em dash, horizontal bar, curly single and double quotes, low-9 quotes, minus sign, fullwidth `>` and hyphen,
  zero-width space, BOM, soft hyphen, next line, line separator, an accented letter, an emoji) x 11 PowerShell positions (between cmdlet and path, between source and destination, after a redirect,
  as a parameter dash, as a common-parameter dash, as a path quote, inside a word, at the end, at the start, inside single and double quotes): **all refused, naming the character**. Bash: the same
  characters x 8 positions: refused outside quotes, parsed inside ASCII quotes.
- **P0c**: over 100 command words not on the list x 8 placements (alone, after `&&`, after a pipe, behind `env`, `command`, `nohup`, inside `sh -c`, after `;`): **all refused, naming the word**; every
  word on the list x 4 placements: **all parse**; node / curl / rg / ssh restricted spellings refused and plain ones parsed.
- **QA 241** (`r7-qa241.test.ts`, rows from `qa241-rows.json`, extracted from QA's own `probe-r6.mjs` and `gen-p0.mjs` by `extract-qa241-rows.mjs`; plus the five `probe-ps-redirect.mjs` targets):
  probe-r6 87 rows pass (1 allow-row superseded); gen-p0 **339 of 339 refused cases refused with their construct named**; **167 of 170 accepted cases still parse**, 3 are now refused by r7 on purpose:
  `GIT_PAGER=cat git log` (P0d), `sort README.md` and `awk '{print}' README.md` (P0c). (`comm` is on the list; QA's fourth, `comm a.txt b.txt`, still parses.)
- QA 237's 1,555 rows still pass (`r6-qa237.test.ts`).
- **P0b per source** (`r7-depth.test.ts`): 22 write sources x 3 shape problems x (shape refused, ASCII docs target allowed, protected target refused), calling the target collector directly, because the gate
  shadows the validator for PowerShell through the hook. Each source has a mutant (`r7-validator-skip-*`).

## Fail-closed cost, extended (`docs/loops/t194-r7/cost-list.txt`, from `cost-list.mjs`; every rewrite is accepted, checked by `check-rewrites.mjs`)

All r6 rows still hold, plus: a PowerShell commit message with an em dash (write it to a file, `git commit -F`); a PowerShell path with an accented letter; curly quotes pasted into a command;
a Bash write to a non-ASCII file name (the validator refuses it even in quotes); `python`, `awk`, `find`, `sort`, `xargs`, `export`, `chmod`, `wget` (not on the list); `curl -o`; `node -e` and `node --version`;
`./node_modules/.bin/vitest` (a path as the command; use `npx vitest`); `GIT_DIR=x git status`; `GH_REPO=o/x gh pr view 1` (use `--repo`); `rg --pre`; `ssh -F`.

## The limit text (`BASH_WRITE_LIMIT`)

States, in both directions: the remote side of `ssh` and `scp` is outside the hook (D-019); a program on the allow-list does what its own arguments say; `rm`, `touch`, `mkdir` and `git checkout` write
targets that are not read; symlinks and junctions; a merge through the GitHub API. It no longer mentions `dd` or `curl -o` (refused now). `r7.test.ts` checks that every item it names as out of reach is in fact allowed.

## Supersedes (tests edited on purpose)

- `r6-cases.ts`: `python`, `perl`, `find -exec`, `awk -i` now name `command not allowed: <word>` instead of an inline-code message. New row `bash -lc` (a shell only as exactly `-c`).
- `r4.test.ts`, `r5.test.ts`: `env GH_REPO=...` is refused by P0d before P2 reads the merge; the path-qualified `"C:/Program Files/GitHub CLI/gh.exe" pr merge 1` row is gone (a path as the command word is refused);
  `gh pr merge 1 && x` became `&& echo x`.
- `r5-property.test.ts`: the merge and git generators treat a Bash command word that is a path as refused.
- `r7-qa241.test.ts`: an exact-grammar merge QA saw refused for want of a token is allowed after a read with the test's fake GitHub, as in r6.

## Not covered, said plainly

- **Nothing ran on Linux or in CI** (D-061); the platform-aware `case` rows are untested on Linux. QA runs CI; a red Linux job is a reject, and I cannot show it green.
- The allow-list is my judgement of the planner's working set (see above).
- Real PowerShell 5.1: P0a means the gate no longer needs to know which Unicode characters 5.1 honours, and the PowerShell parameter tables are still mine.
- 123 of the 139 kills are against the state before the last fix (see "The mutants").
- `ssh`/`scp` options other than `-F`, `ProxyCommand`, `LocalCommand`, `PermitLocalCommand`, `KnownHostsCommand`, `Match exec` are not read; `scp` with two remote ends is not a local write.
- A Bash command that the planner could run before (`sort`, `find`, `awk`, `comm`-like helpers) now has to be rewritten; the cost list names the common ones.
