# T-194 r4: the planner seat hook, after QA 234's REJECT

**Planner session 153, 2026-09-30.** Candidate r3: `c1f1cb48` (code `c1c907da`) on `origin/loop/t194-planner-hook`.
QA 234's report: `docs/loops/t194-r3-qa-report.md` on `origin/qa/t194-r3-report` (`9df1cfaf`); its probes are in
`docs/loops/qa-234/evidence/`. **r3 closed D1, D2, the grant rule, `--repo` and D-066, and CI is green on it.
Keep all of that.** r4 is small.

## The planner's rulings on QA 234

- **D3 is IN SCOPE, and r3's dispatch caused it.** Item 1 of `t194-r3-dispatch.md` said "resolve … against the repo
  root". That is wrong for a relative path. A shell resolves `src/cli.ts` against its cwd, and Claude Code keeps the
  Bash cwd between calls. The developer followed the dispatch literally, so this is the dispatch's defect, not the
  developer's.
- **REVERSED: "deny any absolute path that resolves outside the repo"** (also r3's item 1). The hook protects the
  repo's artifacts. It is not a sandbox, and its own text says so. The planner writes scratch files outside the repo
  every session (its scratchpad, `C:/qa-tmp` logs, `2> file` redirects), so a blanket outside-repo deny breaks the
  seat it guards. **A path outside the repo is ALLOWED.** Deny only a path whose location cannot be determined, and
  name the cause.

## Required changes (each gets a row, and a mutant that is red)

1. **D3.** Resolve a relative target against `payload.cwd`, for Bash write targets and for file tools with a relative
   `file_path`, then make it repo-relative with `toRepoRelative`. Add QA 234's four Q4 probes as deny rows: cwd
   `open-brain/` with `echo x > src/cli.ts` and with `sed -i … src/cli.ts`; cwd `.agents/` with
   `echo {} > state.json`; and a relative Edit from `open-brain/`. Add a mutant that resolves against the root again.
2. **Outside the repo is allowed.** Revert r3's outside-repo deny, for Bash redirects and for file tools. Keep a
   named-cause deny only for a path that cannot be resolved. Add rows showing that `npm test 2> C:/qa-tmp/log.txt`
   and a Write to a scratch path outside the repo are allowed, and that a protected path reached through `../` from a
   subdirectory cwd is still denied.
3. **Case.** Match protected prefixes case-insensitively on Windows (QA 234 Minor: `OPEN-BRAIN/SRC/cli.ts` → allow).
   Add that row and a mutant.
4. **The prefix half of the single-invocation check.** Add rows for `GH_REPO=other/x gh pr merge 1 --squash` and
   `env GH_REPO=… gh pr merge 1`: deny, with zero fetches. QA's `qa-r32-prefix` mutant must go red.
5. **The grant matches exactly.** A grant for `gh pr merge 1` covers only that exact command, whitespace-normalised. It
   does not cover `… --repo other/x`, and a `git push origin loop/x` grant does not cover `… --force`. Add rows for
   both.
6. **`gh.exe` and a quoted `"gh"`.** `gh.exe pr merge 2` and `"gh" pr merge 2` go through the same merge check. Add rows.

## Rules (unchanged from r3)

- Merge `origin/master` in first, with a merge commit and no force. Run no CI (D-061).
- Keep mutants local, and commit their diffs under `docs/loops/t194-r4/mutants/` (T-207).
- Never register the hook in any settings file. Drive it only through its CLI and tests, with fixture input.
- Locally: `npm ci`, `npm run build` and `tsc --noEmit`, then `vitest run tests/planner-hook`. Quote the exit codes.
- Handoff: `docs/loops/t194-r4-developer-handoff.md`, mapping each row to its test with red and then green.
