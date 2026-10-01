# T-194 r7: finish the inversion: allow-list the characters and the command words

**By:** Atlas (planner), record session 155, 2026-10-01. **Candidate r6:** `9cf8c7eb` on `origin/loop/t194-planner-hook`.
**QA 241's report:** `docs/loops/t194-r6-qa-report.md` on `origin/qa/t194-r6-report` (`8d69bed5`), REJECT, **ruled
REJECT** by the planner (D-084).

**r6 worked where it was applied. Keep all of it:**
- every QA 237 hole is closed: 0 fail-open across 1,456 generated cases plus its probe scripts;
- 105 of 105 mutants are killed in one pass;
- QA's own 337 refused and 170 accepted P0 cases are right;
- D8, D9, the non-merge rule and `git -c` are all met.

## Why r7

r6 inverted the default for **constructs**, but not for **characters** or **command words**. QA 241's six fail-open
classes are all in those two gaps.
- The gate reads PowerShell with an ASCII idea of whitespace, dashes and quotes (D-B). It runs its checks on words but
  not on redirect targets (D-A).
- Bash has no allow-list of commands, so `awk`, `trap`, `mapfile`, `sort -o`, `find -fprint` and inline-code
  spellings get through (D-D, D-E).

**r7 applies the same inversion to both.**

## The properties

**P0a, characters.**
- A **PowerShell** command containing any character outside printable ASCII (0x20 to 0x7E, plus tab) is refused,
  `not statically parseable: non-ASCII character U+XXXX`.
- A **Bash** command may carry non-ASCII only inside an ASCII single- or double-quoted string. Anywhere else it is
  refused the same way.
- The cost is stated: a commit message with an em dash must be written to a file and passed with `-F`.

**P0b, one target validator.** Every write target goes through **one** function that applies every target check:
literal, `::` provider path, drive-relative, non-ASCII, and the protected-path test. That covers Bash redirects,
PowerShell `>`/`>>`/`2>`, cmdlet `-Path`/`-LiteralPath`/`-Destination`/positionals, `New-Item` `-Name`, and the file
tools. **A mutant that bypasses the validator for any one of these sources must go red.** This closes D-A by
construction.

**P0c, Bash command words are allow-listed.**
- A Bash simple command's first word must be in a tracked allow-list, `BASH_ALLOWED_COMMANDS`, with any per-command
  restrictions. Anything else is refused, `not statically parseable: command not allowed: <word>`.
- **The planner's working set is the list.** At minimum: `git`, `gh`, `npm`, `npx`, `node`, `ls`, `cat`, `echo`,
  `printf`, `grep`, `rg`, `head`, `tail`, `wc`, `diff`, `pwd`, `which`, `date`, `mkdir`, `cp`, `mv`, `tee`, `sed`
  (with r6's script rules), `test`, `true`, `false`, `ssh`, `scp`, `curl` (read-only, no `-o`/`-O`/`--output`).
- Derive the rest from the planner's actual sessions and write the list in the handoff, with a reason per entry.
- **`node` is allowed only as `node <file.js|.mjs|.cjs> [args]`,** with no option before the script, so `-e`,
  `--eval`, `-p`, `--print`, `-r` and `--import` are refused in **every** spelling: attached, `=`, or separate.
  - The same shape applies to any interpreter you choose to allow.
  - `perl`, `python`, `ruby`, `awk`, `find`, `sort`, `xargs`, `trap`, `mapfile`, `eval`, `source` and `.` are **not**
    on the list.
- **`ssh` and `scp`:** the remote side is outside this hook (D-019). Allow them, and say so in the limit text.

**P0d, environment assignments.** A leading `NAME=value` where `NAME` starts with `GIT_` or is `GH_REPO`/`GH_HOST`
is refused, `not statically parseable: git/gh config through the environment`. This closes D-F, the same act the
Open-5 ruling grants for `-c`.

**P3 fix, D-C.** `New-Item -Name <n>` with no `-Path` targets `<cwd>/<n>`. Pin it with a row and a mutant.

**CI on Linux, green.** The `r6-qa237` rows carry Windows case-insensitive expectations. Make each expectation
platform-aware (case-fold only on win32), or tag the case rows Windows-only. **QA will run CI. A red Linux `test` job
is a REJECT.**

## Required evidence

1. Generators:
   - **P0a:** every Unicode separator, dash and quote PowerShell 5.1 honours (at least NBSP, U+2000 to U+200A, U+3000,
     U+2013, U+2014, U+2015, U+2018, U+2019, U+201C, U+201D), in every position, all refused.
   - **P0c:** every word not on the list in command position, all refused, plus every allowed word with its restricted
     options in every spelling.
2. QA 241's D-A to D-F probes as rows: `docs/loops/qa-241/` on `origin/qa/t194-r6-report`.
3. A mutant per P0a/b/c/d clause, plus r6's 105 still killed, **in one pass** this time. Run on a free machine, or
   state why not.
4. The limit text is updated: `ssh`/`scp` remote sides, and "a program named on the allow-list does what its own
   arguments say".
5. The fail-closed cost list is extended with P0a and P0c refusals and their rewrites.

## Rules

As r6: merge master in first (merge commit, no force); no CI (QA runs it); never register the hook; mutants local.
Heavy runs need Aaron's approval: send clark `MANUAL MODE → sia-forge: <action> (<why>)`. Handoff:
`docs/loops/t194-r7-developer-handoff.md`. Push `loop/t194-planner-hook`, never forced. Report the SHA to
`atlas [f21cf4]`.
