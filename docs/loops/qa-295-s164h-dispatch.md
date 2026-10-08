# QA 295, session-164 batch h: #516 FLEET-AE r2

**By:** Atlas (planner), 2026-10-08, record session 164. **Machine:** the laptop (Windows), launched by clark.
**Read first:** QA 294's report (`origin/qa/s164g-report`, `docs/loops/s164g-qa-report.md`), and
`docs/loops/fleet-deterministic-dispatch.md` at the dispatch SHA. Rows A1 and A3 and row F3 changed after QA 294
(#524). Reuse QA 294's scripts and its mutant `qa/s164g-m4`.
**Do not read** any hub room or developer report until your report is pushed.
**Merge:** under SG-1 (D-135). The planner sends your ACCEPT to clark. **Gates:** the Makerspace import.

**Narrow:** one test file per vitest run, mutants on touched files only, `tsc --noEmit`, `npm run typecheck:tests`,
`gh` reads. No full suite.

**Pinned head (CI `test` green; mutant runs read red by the planner):** `0ac17a7e155ec90b993c2e6084ac52a1a66845fd`
(CI 37795146033). It merges master `5bd23e6b` into r1. Mutants, each one commit on the head:

| Branch | Run | Mutant |
|---|---|---|
| `loop/fleet-ae-mut-1` | 37795197604 | the header hashes the whole file |
| `loop/fleet-ae-mut-2` | 37795401852 | STANDING RULES placed above WATCH OUT |
| `loop/fleet-ae-mut-3` | 37795439942 | `required-block.json` ignored, and the old `requiredBlock` read instead |

Confirm with `gh pr view 516` that the head still equals this pin. If it moved, stop and report INCOMPLETE.

## Rows

1. **Confined.** List every file from r1 (`1bc4d20d`) to the head, leaving out master's changes. `.gitignore` gains
   exactly one line: `!/.agents/SYSTEM/required-block.json`. `.agents/state.json` is untouched, and no decision is
   tagged `standing`.
2. **Mutant runs.** Each red run's failing tests are the rows its mutant targets.
3. **A1 (QA 294's blocking finding).** Regenerate on the head.
   - The header names the path, the heading, and `section-sha <hash> (git hash-object of the extracted section)`.
   - The hash equals `git hash-object --stdin` of the section that you extract independently.
   - The header does not read as a file blob.
   - A test goes red if the generator hashes the whole file.
   - Then check that an edit OUTSIDE the section leaves `/sync` passing (`node open-brain/build/cli.js sync --check`),
     and an edit INSIDE it makes `/sync` fail.
4. **A3.**
   - `git ls-files .agents/SYSTEM/required-block.json` lists it on a fresh clone of the head.
   - It resolves to the `.mdc` body.
   - `hub-partner-seats.json` has no `requiredBlock`.
   - SIA's hub-seats `/sync` check still passes.
5. **E3 placement.** Re-apply QA 294's `qa/s164g-m4` source change on the head. A test must now go red. Through the real
   MCP path, the section sits between WATCH OUT and OPEN QUESTIONS.
6. **Hygiene.** Run F1, F2 and F8 on a mutant that makes each one red. `git status` in the checkout is clean afterwards.
7. **Regression (short).** QA 294's rows 5, 6 and 7 (E through MCP, backward compatibility against master's real record
   copy, Windows CRLF plus a spaced path), one pass each.

## Rules (headless Claude Code)

- You are **QA 295**, prefix `s164h`. Push ONLY `qa/s164h-*` branches, and only through
  `node docs/loops/qa-295/push-qa.mjs <branch>`, run from your `qa295-wt` tree.
- **Never create, comment on or edit an issue or a PR.** Use `gh` only to read.
- Never write a live `.agents/state.json`; copy it to `C:/qa-tmp` first. Never read the real knowledge DB, the real
  open-brain data dir or a real vault for anything but counts, names and paths (G-051). Make no live Jev call. Never
  print a key.
- **Sandbox (D-131):** list every command run with the sandbox disabled under `Unsandboxed commands`, with its purpose
  and every path it touched, or write `Unsandboxed commands: none`.
- Commit `docs/loops/s164h-qa-report.md` on `qa/s164h-report`. Put the verdict, with its pinned head, first. The
  report's last line is exactly `QA-295: REPORT COMPLETE`.
