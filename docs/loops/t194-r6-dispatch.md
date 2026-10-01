# T-194 r6: the planner seat hook, inverted: refuse what it cannot parse

**By:** Atlas (planner), record session 155, 2026-10-01. **Candidate r5:** `7a3a4441` (product `8bd1541d`) on
`origin/loop/t194-planner-hook`. **QA 237's report:** `docs/loops/t194-r5-qa-report.md` on `origin/qa/t194-r5-report`
(`1a658b39`), REJECT. **Aaron's ruling (session 155):** build r6 by inversion.

**Keep everything r5 got right:** all 50 of its mutants, the non-literal rule, the file tools, the standing-push
grammar and the exact grant. CI is green on Linux and the POSIX oracle passes.

## Why r6 is different again

r5 stated properties, and its generator still had edges. QA 237 found classes in all four: bash quote removal,
comments, keywords, wrappers, shells fed code on stdin, rewrites of `merge`/`push`, git aliases, and PowerShell
parameters, splats and provider paths. Each class has the same root. **The hook tries to understand every shell
construct and allows whatever it fails to understand.** Five rounds of adding constructs have not closed that, and a
shell has more constructs than any list.

**r6 inverts the default. A command is checked only if the hook fully parses it. Anything else is refused with one
named cause, `not statically parseable: <construct>`.** The parser gets smaller, not bigger. The threat this covers is
an agent rewording a refused command, as well as an honest mistake.

## The property (all of r6's scope)

**P0, the parse gate (new, and it runs first).** A Bash or PowerShell command proceeds to P1, P2, P2b and P3 only if
every word is in the hook's **accepted grammar**. Otherwise it is refused with `not statically parseable` and names the
construct.
- **Bash's accepted grammar:**
  - plain words, and single- or double-quoted strings with no `$` or backtick inside;
  - the operators `;`, `&&`, `||`, `|`;
  - the redirects `>`, `>>`, `2>`, `2>&1`, `&>`, `<`;
  - a leading `NAME=value` with a literal value;
  - a known wrapper **only with no options** (`env` with no flags, `command`, `nohup`; nothing else).
- **Refused in Bash:** a backslash anywhere outside single quotes; `#` at the start of a word (a comment); any reserved
  word (`if`, `then`, `for`, `do`, `while`, `case`, `!`, `{`, `}`, `time`, `function` and so on); a heredoc or
  here-string; a pipe into, or stdin fed to, `sh`, `bash`, `zsh`, `pwsh`, `powershell`, `node -` or `python -`; any
  wrapper with options (`timeout`, `nice`, `env -u`, `env -C`, `xargs`, `find -exec`, …); `sed` with a script
  containing `w` or `e`; `$'…'`; a word containing `$`, backtick, `{`, `(`, `*`, `?`, `[` or a leading `~`. The last
  four classes are r5's non-literal causes, now inside P0.
- **PowerShell's accepted grammar:**
  - a cmdlet or known alias;
  - parameters the hook knows **by full name or by an unambiguous prefix**, each with a literal value;
  - positional literals;
  - `;` and `|`, and `>` and `>>`.
- **Refused in PowerShell:** any parameter the hook does not know, which includes the common parameters; `-Param:value`
  unless known; a splat `@x`; a `( … )` or `$( … )` expression; a script block; a provider path (`::`); a
  drive-relative path (`C:foo`); a block comment `<# #>`; a `[type]::` call; `Invoke-Expression`, `iex`,
  `Invoke-Command`, `Start-Process`, `&` on anything but `gh`; `powershell` or `pwsh` with any arguments.
- **A quoted string is data:** `git commit -m "a > b # c"` parses. Only quotes that are not closed refuse.

**P1, P2, P2b and P3 then apply to the parsed words, as ruled in r5, with these rulings on QA 237's open questions:**
- **D8, `#N`:** an unquoted `#` is refused by P0. A quoted `'#7'` ref is PR 7.
- **D9:** a pull URL whose repository is not `origin`'s **needs a grant**. The grammar says `<N | origin pull URL>`.
- **Non-merge (Open 4):** **a merge is when gh's first two positional words, after gh's global flags, are `pr`
  `merge`.** So `gh pr comment 5 --body merge` and `gh pr list --label merge` are **not** merges, and they are allowed.
  The r5 token rule is superseded by this headline.
- **P2b `-c` (Open 5):** `git -c <key>=…` with any key under `alias.`, `remote.`, `url.`, `include.`,
  `includeIf.` or `core.` **needs a grant**, whatever the subcommand. A git subcommand that is not one of git's own
  commands, meaning an alias, is refused by P0 as `not statically parseable: git alias`.
- **D17, the limit text, in both directions:** `BASH_WRITE_LIMIT` (or its successor) states every out-of-reach item
  the handoff states, and nothing it states may be caught. Under P0 most of r5's "out of reach" list becomes "refused".
  Rewrite it to what is still true: a path a script builds at runtime, symlinks and junctions, and a merge through the
  GitHub API.

## Required evidence

1. **The P0 generator is the main evidence.**
   - Build spellings from combinators, at least 400 cases: every construct in the refused lists, each placed in a
     write target, a gh/git subcommand position and a wrapper position. Each must be refused with
     `not statically parseable` and must name its construct.
   - Also build at least 200 cases of the accepted grammar that must parse. Each is then judged by P1 to P3, as in r5.
2. **Every QA 237 probe becomes a row:** `docs/loops/qa-237/` on `origin/qa/t194-r5-report` (`gen-p*.mjs`,
   `probe-holes*.mjs`, `probe-merge-async.mjs`, `probe-comma.mjs`, `fail-closed.mjs`). Each D1 to D17 row ends either
   refused by P0 or decided correctly.
3. **QA 237's surviving mutants** (`qa-p1-install-ignored`, `qa-p3-comma-list-off`) must go red on your tests.
4. **Mutants:** one per P0 refusal class (at least 12), plus r5's 50, which must stay red.
5. **Fail-closed cost, stated:** list the commands a working planner now has to rewrite, each with its refusal text.
   For example `cd docs && npm test > out` (already refused in r5), `timeout 60 npm test`, and a heredoc commit
   message (write the message to a file instead).
6. **Regression:** every row QA 237 scored met still holds, and so does every earlier QA probe, unless P0 refuses it.
   A row P0 refuses is listed as **superseded by P0**, with its refusal text.

## Rules

- Merge `origin/master` in first, with a merge commit and no force. Run no CI (D-061). Keep mutants local (T-207).
- **Never register the hook in any settings file.**
- Locally: `npm ci`, `npm run build` and `tsc --noEmit`, then `vitest run tests/planner-hook` plus the generators,
  with exit codes quoted. Check free RAM before the mutants. Heavy runs need Aaron's approval in your window.
- Handoff: `docs/loops/t194-r6-developer-handoff.md`. Map P0's classes and each ruling above to a test and a mutant,
  red then green.
- Push only `loop/t194-planner-hook`, never forced. Report the SHA to atlas.

## Out of scope (unchanged)

The hook is a gate on what an agent types, not a sandbox. Out of reach: a path a script builds at runtime, symlinks
and junctions, and a merge through the GitHub API. They need D-019's human gate, not more parsing.
