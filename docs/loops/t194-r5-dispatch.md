# T-194 r5: the planner seat hook, redefined by property, not by spelling

**Planner session 153 (resumed), 2026-10-01.** Candidate r4: `d37e09dc` (code `2e1a0591`) on
`origin/loop/t194-planner-hook`. QA 235's report: `docs/loops/t194-r4-qa-report.md` on `origin/qa/t194-r4-report`
(`e6e1d085`). **r4 met every scored row it was given: D3, outside-repo, case, the `GH_REPO=` prefix, the exact grant,
and `gh.exe`. Keep all of it.**

## Why r5 is different: the planner's own dispatch gap

This is the third REJECT in a row, and the cause is the briefs, not the builds.

| Round | What the dispatch listed | What QA found next |
|---|---|---|
| r2 → r3 | absolute paths; chained commands after a docs merge | relative paths resolve against the root, not the cwd |
| r3 → r4 | the cwd; `GH_REPO=`; `gh.exe`; `"gh"` | `~`; `GH`; `gh.EXE`; flags before `pr` |
| r4 → r5 | (r4 met all of them) | the PowerShell tool is not in the matcher at all |

Each round enumerated the spellings the last QA found. The developer fixed exactly those, and QA found the next spelling
in the same class. This is rulings-16's rule from slice three: *"a rule defined by a list of what it covers leaks at the
list's edge."* **r5 states each property once and requires the developer to defend it against spellings nobody has
listed.**

## The three properties (the whole of r5's scope)

**P1. A write target is protected if, and only if, the location the tool will actually write to falls under a
protected path.**
- One canonicaliser, used by every caller (Bash targets and file tools), produces that location. It resolves against
  `payload.cwd`, normalises slashes, resolves `.` and `..`, and compares case-insensitively on a Windows drive.
- **A target that is not a literal path is refused, with a named cause.** That covers any shell expansion: `~` or
  `~user` at the start, `$`, a backtick, glob characters `* ? [`, and brace expansion `{`. Do not expand it; refuse it.
  This closes QA 235's D4.
- **A command that changes directory before a write is refused as undeterminable.** That covers `cd`, `pushd`, or
  `Set-Location` anywhere in the same command line, including inside `( … )`, together with any detected write
  target. This closes the declared `cd` limit, instead of documenting it.

**P2. A command is a merge if gh would run `pr merge`. Only one exact grammar is allowed without a grant.**
- Tokenise the command, respecting quotes.
- A token is gh if its basename, with quotes and any extension removed, equals `gh` case-insensitively. That covers
  `GH`, `gh.EXE`, `"C:/…/gh.exe"` and `'gh'`.
- It is a merge if the tokens after that gh token contain `pr` and then `merge`, with ANY flags in between or before
  `pr`. That covers `gh --repo x pr merge` and `gh -R x pr merge`.
- **The no-grant allow applies only to this exact grammar:** `gh pr merge <N | origin pull URL>`, optionally followed
  by flags from `{--squash, --merge, --rebase, --delete-branch, -s, -m, -r, -d}`.
- Anything else that is a merge needs a grant. That includes `--repo`/`-R` anywhere, an env prefix, a chained command,
  or any other flag. This closes QA 235's D5 by class.

**P3. The seat's shell tools are all matched.**
- Add `PowerShell` to the matcher.
- Apply P1 to PowerShell write targets: `Set-Content`, `Add-Content`, `Out-File`, `New-Item`, `Copy-Item`,
  `Move-Item`, `Remove-Item`, `>` and `>>`. Read the target from `-Path`, `-LiteralPath`, `-Destination` or the first
  positional argument.
- Apply P2 to `gh` invoked from PowerShell, including `&` and `.\gh.exe`.
- A PowerShell command whose targets cannot be determined statically, such as `Invoke-Expression` or a script block
  that writes, is refused with a named cause.

## Required evidence

1. **A property test, not just example rows.** Generate spellings for P1 and P2 from combinators, at least 200 cases
   each:
   - case variants; slash variants; quote variants;
   - `.exe` and full-path variants; flag permutations before and after `pr`;
   - cwd and `..` combinations; every expansion character.

   Assert the property for each case, comparing the hook's verdict to what an INDEPENDENT oracle says the shell would
   do. For paths, the oracle is `path.resolve` against the cwd plus the protected-prefix check. Commit the generator.
2. **Every probe QA 233, 234 and 235 ran becomes a row.** They are in `docs/loops/qa-23{3,4,5}/evidence/`.
3. **Mutants:** one per property clause, and each must go red. Keep them local, and commit their diffs under
   `docs/loops/t194-r5/mutants/`.
4. **Regression:** every row QA 235 scored `met` still passes, unchanged, except where a rule above supersedes it.
5. **The limit text.** `BASH_WRITE_LIMIT`, or its successor, states exactly what is still out of reach, for example a
   path computed at runtime by a script. Nothing out of reach may be described only in the handoff.

## Rules (unchanged)

- Merge `origin/master` in first, with a merge commit and no force. Run no CI (D-061). Keep mutants local (T-207).
- Never register the hook in any settings file. Registering it is Aaron's hand, after an ACCEPT.
- Locally: `npm ci`, `npm run build` and `tsc --noEmit`, then `vitest run tests/planner-hook` plus the property test.
  Quote the exit codes.
- Handoff: `docs/loops/t194-r5-developer-handoff.md`. It maps each property clause to its test, with red and then
  green, and gives the generator's case count.

## Out of scope (stated, so QA does not have to ask)

The hook stops mistakes; it is not a sandbox. The following are out of reach, and the limit text must say so:
- a path built at runtime inside a script the command runs, such as `node x.js` writing `src/`;
- a merge done through the GitHub API with `curl` or `gh api`.

These need a different control (D-019's human gate), not more spellings.
