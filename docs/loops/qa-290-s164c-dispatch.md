# QA 290, session-164 batch c: #498 IMPORT-CMDS and #499 T-247 pins

**By:** Atlas (planner), 2026-10-07, record session 164. **Machine:** the laptop (Windows) after QA 289, or Plumb
(Linux) if the laptop is busy. On Plumb, confirm `/home/melvenac/builds/BUILDING` is absent first, and write in the
report that the Windows rows did not run.
**Read first:** `docs/loops/import-commands-brief.md` (C1–C4, I1–I9) and QA 288's report (`origin/qa/s164a-report`,
rows 5 and 15 and the findings H1, H2 and G1, which #499 pins).
**Do not read** any hub room until your report is pushed.
**Merge authority:** both change `open-brain/src`, so each merge is Aaron's word. **Gates:** #498 is on the Makerspace
import path.

**Narrow:** one test file per vitest run, mutants on touched files only, `tsc --noEmit`, `npm run typecheck:tests`,
`gh` reads. No full suite.

**Pinned heads (CI `test` green, mutant runs red; read by the planner):**

| PR | Task | Head | CI | Red-first mutant runs |
|---|---|---|---|---|
| #498 | IMPORT-CMDS | `fee2bb50639fc78ba79ba91ced657042f599158e` | 37643767212 | mut-1 37644218347, mut-2 37644223289, mut-3 37644228713. Each is one commit on `759fe100`, the head's parent. The head adds only `cli-args.test.ts`. |
| #499 | T-247 | `433c503b8317f36d99e40ed093218dad65ecc29e` | 37643480418 | mut-h1 37643942123, mut-h2 37643947033, mut-g1 37643951488. Each is one commit on the head. |

Confirm with `gh pr view` that each PR head still equals its pin. If either moved, stop and report INCOMPLETE.

## Every PR

1. **Confined.** List every file in each `git diff origin/master...<head>`. #498: the bootstrap pipeline, the
   CLI spec, the session-start render, their tests, `project-template/.claude/commands/bootstrap.md` and `CHANGELOG.md`.
   #499: `vault-writer.ts`, `scrub-trigger-fires.ts`, their tests, `hub-talk-exit-codes.test.ts` and `CHANGELOG.md`.
2. **Mutant runs.** For each red run, confirm that the failing tests are the rows its mutant targets, not an
   unrelated failure.
3. **Batch merge.** Merge both heads onto `<DISPATCH_SHA>`. Run `tsc --noEmit` and `typecheck:tests`, then every
   touched test file once each.

## #498 IMPORT-CMDS

4. **I1–I8, re-derived.** Build temp repos yourself:
   - a pre-state project with an old `start.md` and `end.md`;
   - the record imported with `state import --commit` run against the temp project;
   - a dirty tree;
   - a `.claude/commands/other.md` and a `settings.local.json`.

   Drive the real CLI (`bootstrap check`, `bootstrap install-commands`) and the real `ob_start` path. Record the output
   lines you saw.
5. **The whole `/bootstrap` import path, as written.** Follow `project-template/.claude/commands/bootstrap.md` step by
   step on a pre-state temp project. Steps 6, 7 and 7b must leave one clean `Bootstrap SIA` commit at step 8.
   - `git status --short --untracked-files=all` at step 8 must list exactly what the text says.
   - **If installing the commands leaves files that step 8's list does not name, that is a finding** (the developer
     flagged this).
6. **Refusals.** `install-commands`:
   - on a fresh-install project;
   - on an invalid `state.json`;
   - outside a repository;
   - with a read-only `.claude/commands/`.

   Each refuses with a reason, writes nothing, and exits non-zero.
7. **Your own mutants:** (a) OLD files are deleted instead of archived; (b) `SIA` detection compares after
   normalising line endings (should it, given CRLF checkouts? Say which is right); (c) the C4 line prints on a
   fresh-install project. Name the red test, or report a finding.
8. **Windows:** CRLF old files, a spaced path, and a template checked out with `core.autocrlf=true`. A CRLF checkout
   of the template must not make the installed file read as `OLD` against itself.

## #499 T-247

9. **Each pin fails for its own reason.** Re-apply QA 288's mutants (b) (`assertPathUnderDir` a no-op), (g)
   (`secure_delete` removed) and the clause→sentence widening, each on #499's head. Each must turn a #499 test red.
10. **H1's new guard.** `writeSummary` with a non-ISO `date` (`../x`, `2026-13-01`, `2026-10-07T00:00`, an empty
    string) refuses before any path is built. Today's caller (ISO date) still writes.
11. **H2's byte test.** The developer says the byte-reclaim test stays green without the pragma on Linux. Run it on
    Windows with the pragma removed and report whether it is red. Either result is information, not a finding.

## Rules (headless Claude Code)

- You are **QA 290**, prefix `s164c`. Push ONLY `qa/s164c-*` branches, and only through
  `node docs/loops/qa-290/push-qa.mjs <branch>`, run from your `qa290-wt` tree.
- **Never create, comment on or edit an issue or a PR.** Use `gh` only to read.
- Never read the real knowledge DB or a real vault for anything other than counts, names and paths (G-051). Make no
  live Jev call. Never print a key.
- **Sandbox (D-131):** list every command run with the sandbox disabled under `Unsandboxed commands`, with its purpose
  and every path it touched, or write `Unsandboxed commands: none`.
- Commit `docs/loops/s164c-qa-report.md` on `qa/s164c-report`. Put one verdict per PR, with its pinned head, first.
  The report's last line is exactly `QA-290: REPORT COMPLETE`.
