# T-194 r3: the planner seat hook, after QA 233's REJECT

**Planner session 153, 2026-09-30. Record rev 209.** This dispatch is for the developer seat that takes it: sia-builder
or sia-forge, both Claude Code Sonnet on the QA PC (D-068). The planner names the seat when it sends this over
Remote Control.

## Authority and what came before

- T-194 was opened and dispatched in planner session 149 on Aaron's word (see `t194-t195-dispatch.md`). **This r3 is
  not Aaron's word on a merge.** The candidate goes to QA and then to Aaron (D-032).
- QA 233 found two blockers in **699789e1** (r1 + r2). The report is `docs/loops/t194-r2-qa-report.md` on
  `origin/qa/t194-r2-report` (`d6b13423`). Its probes are `docs/loops/qa-233/evidence/`. The planner upheld the
  REJECT; the ruling is in T-194's note in `.agents/state.json`, rev 209.
- The planner confirmed D1 in the code: `open-brain/src/planner-hook/paths.ts` `normalizeRelPath` swaps
  backslashes and strips `./`, but never removes the repo root. An absolute path therefore matches no
  `ARTIFACT_PREFIXES` entry.

## Base

Branch from `origin/loop/t194-planner-hook` (code 699789e1), **merged with current `origin/master`**, which is
`5950826f` or later. Master carries `9b3a4a2c`, the state-schema T-171 r3b fix that failed both of QA 233's CI runs.
Read every fact from that tree, not from a stale seat checkout.

## Required changes (each gets a row and a red-then-green proof)

1. **D1, absolute paths (PH-1, PH-2, PH-6).**
   - Resolve every `file_path` and every statically detected Bash target (redirect, `sed -i`, `tee`, `cp`, `mv`)
     against the repo root (`resolveHookProjectDir`), then make it relative.
   - Deny any absolute path that resolves outside the repo or cannot be made relative. Name the cause.
   - Add rows with absolute paths in BOTH slash forms (`C:/…/open-brain/src/cli.ts` and `C:\…\open-brain\src\cli.ts`)
     for PH-1, for PH-2 (`.agents/state.json`) and for PH-6 (a redirect target). They are QA 233's probes P9 to P15.
   - Red: the rows fail on 699789e1.
2. **D2, compound commands after a docs-only merge (PH-3, r2-1, r2-2).**
   - The no-grant docs-merge allow applies only when the WHOLE command is a single `gh pr merge` invocation, with no
     `&&`, `||`, `;`, `|`, newline, `$(…)`, subshell or backticks.
   - Anything compound falls through to the grant path.
   - Add QA 233's P3 (`gh pr merge <docs> --squash && git push --force origin master`) and P4
     (`gh pr merge <docs> && gh pr merge <code>`) as deny rows.
3. **Grant prefix match (minor, from r1).** `grantMatchesCommand` accepts any command that starts with `<grant> `.
   Apply the same single-invocation rule, so a grant for `gh pr merge 5` does not cover
   `gh pr merge 5 && git push --force origin master`. Add that row.
4. **`--repo`.** `gh pr merge N --repo other/x` must either check `other/x#N` or deny with a named cause. It must never
   check origin's PR N.
5. **D-066.** Add `.agents/assignments.json` to `DOCS_MERGE_ALLOWLIST_EXACT` (QA 233's P6).
6. **Mutants.** Replace r1's ph1, ph2 and ph3, which fail `tsc --noEmit` (TS2345, TS2722, TS18048, TS2339), with
   forms that typecheck. QA 233's ph1-tc, ph2-tc and ph3-tc in `qa233-mutants*.mjs` show the way. Add a mutant for
   D1 (drop the root resolution) and one for D2 (allow compound), and show each is red.

## Rules

- **D-061:** run no CI yourself. Quote local `npm run build`, `tsc --noEmit` and `vitest run` output and exit codes,
  with TEMP and TMP set to a scratch dir.
- **T-207 is not merged:** every `qa/**` or mutant-branch push starts a tcm run. Keep mutants LOCAL and commit their
  diffs under `docs/loops/t194-r3/mutants/`. Push only the candidate branch.
- Never register the hook in any settings file (yours, the repo's, or `~/.claude`). Drive it only through its CLI and
  tests, with fixture input.
- Assert inputs from a fixture environment, never from inherited `process.env` (G-044).
- Write the handoff at `docs/loops/t194-r3-developer-handoff.md`. It maps each row above to its test, with red (on
  699789e1 or the mutant) and then green.
- Report to atlas when done, with the candidate SHA. Push the handoff before any `/clear`.
