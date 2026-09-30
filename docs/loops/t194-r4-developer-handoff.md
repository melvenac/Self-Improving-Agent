# T-194 r4: developer handoff

Developer (Claude Code, Sonnet, headless on the QA PC, D-068). Branch `loop/t194-planner-hook`.
Code commit `2e1a0591`, on top of a merge of `origin/master` (merge commit, no force). Dispatch: `docs/loops/t194-r4-dispatch.md`.

## Local runs (TEMP/TMP = `C:/Users/Aaron Melven/dev-scratch/tmp`; the full suite was not run, memory)

| Command | Exit | Summary |
| --- | --- | --- |
| `npm ci` | 0 | installed (13 audit warnings, unchanged) |
| `npm run build` | 0 | `build stamped 14be2d9` |
| `npx tsc --noEmit` | 0 | no output |
| `npx vitest run tests/planner-hook` | 0 | 4 files passed, 129/129 tests passed |

Only the four files in `tests/planner-hook/` import `src/planner-hook`. No CI was run (D-061). The hook is not registered anywhere.

## Rows to tests and mutants

New tests are in `open-brain/tests/planner-hook/r4.test.ts`. Mutant diffs (local only, T-207) are in
`docs/loops/t194-r4/mutants/`, with `results.json`. Each mutant applied as a one-spot edit, typechecked (tsc 0)
and turned `vitest run tests/planner-hook` red (exit 1). Restored afterwards; `git status` on `src/` was clean.
I did not capture per-mutant failure counts.

| Dispatch item | Change | Test (describe) | Mutant (red) |
| --- | --- | --- | --- |
| 1 D3 | `toRepoRelative(raw, root, cwd)` resolves relative targets against `payload.cwd`; Bash and file tools | "D3": cwd `open-brain/` `echo x > src/cli.ts`; `sed -i`; cwd `.agents/` `echo {} > state.json`; relative Edit from `open-brain/`; plus controls (same text from a cwd where it is not protected → allow) | `d3-bash-root`, `d3-file-root` |
| 2 outside allowed | `toRepoRelative` returns `outside: true`; both callers allow it. Denied only when undeterminable: a `$`/backtick target, or a relative path with a non-absolute cwd, each naming the cause | "outside the repo is allowed": `npm test 2> C:/qa-tmp/log.txt`, `/tmp` redirect, Write outside (absolute and `../`), look-alike outside path; "D3": `../` from a subdirectory cwd is still denied; undeterminable rows | `outside-deny-bash`, `outside-deny-file`, `expansion-allowed`, `cwd-not-absolute` |
| 3 case | protected and view predicates take `ci`, true when the root is a Windows drive | "case": predicate rows, `toRepoRelative` ci flag; through-the-hook row runs on win32 only (skipIf elsewhere) | `case-artifact`, `case-view` |
| 4 prefix half | rows only (code was right) | "the prefix half": `GH_REPO=other/x gh pr merge 1 --squash`, `env GH_REPO=… gh pr merge 1` → deny, zero fetches | `prefix-half` |
| 5 exact grant | `grantMatchesCommand` is whitespace-normalised equality (`*` still matches all) | "the grant matches exactly": `--repo other/x` and `--force` not covered, grant not consumed; exact command consumed | `grant-prefix` |
| 6 gh.exe / quoted | `gh`, `gh.exe`, either quoted, in the merge regex, the ref extractor and the leading-command check | "gh.exe and a quoted gh": allow for docs PR (fetch read), deny for code PR, deny with `--repo`/chained, zero fetches | `gh-exe`, `gh-quote` |

## Changed existing tests (r3.test.ts) and why

- The three "denied outside the repo" rows are gone (ruling reversed); `toRepoRelative` unit rows now expect `outside: true` and the `ci` flag.
- The grant rows that relied on prefix matching (`gh pr merge 5 --squash` under a `gh pr merge 5` grant; `--no-verify` under a push grant) now assert the exact-match rule.
- Absolute Bash targets in r3 are now quoted. The fixture repo path is under `C:/Users/Aaron Melven/…` (spaces). An unquoted path is cut at the space by the shell itself, and r3 had passed only because the cut half was "outside → deny". With outside allowed that masking is gone, so the fixtures quote as a real command would.

## Not covered (for QA)

- `cd open-brain && echo x > src/cli.ts`: the hook resolves against `payload.cwd` (the cwd at call time), not against a `cd` inside the same command. Not in the dispatch; same class as the static-detection limit already in the deny text.
- A `~/…` target is treated as outside the repo (allowed); `$VAR` and backtick targets are denied as undeterminable, which will also refuse `2> $TMP/log`.
- Case-insensitivity keys off the repo root being a Windows drive, not `process.platform`.
- Live registration (PH-8 live half) is untouched.
