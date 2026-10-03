# QA 264, session-159 batch: T-234 A+B, T-235 P2-1, T-152 (#373, #374, #372, #371)

**By:** Atlas (planner), 2026-10-03, record session 159, under Aaron's batch-QA rule. Booked with clark on Plumb.

**Merge authority:** none of these is pre-approved. An ACCEPT waits for Aaron's word per PR.

**QA runs on Opus** (all four builds are Claude Code Sonnet: builder ≠ judge). **Job class: LIGHT.** That means touched
test files, **one test file per vitest invocation**, mutants on touched files only, `tsc`, and `gh` reads. No full
suite. **Make no live Jev call. Never run `setup.mjs` against the real home directory.**

**Pinned heads:**

| PR | Task | Base | Head | Dev evidence |
|---|---|---|---|---|
| #373 | T-234 PR A: served-path stale count, weekly-STOP usage line, F6 "ahead" | master | `1115ee190059ef6cb7e35ac34bc8d5de5d7b3e96` | PR body; `docs/loops/t234-brief.md` (+ planner's shorter line shapes, hub turn 241 / dispatch) |
| #374 | T-234 PR B: QA 263 probes adopted, F7 start.md | **#373's branch** (stacked) | `7e0509e17f0d1915dd4c82040cf273862b1ccfba` | PR body; QA 263 artefacts on `origin/qa/t233-report` fe33a55a |
| #372 | T-235 P2-1: setup.mjs writes the absolute Node path for Cursor MCP and the sessionStart hook | master | `4240a8beeddde0ef9865a411c571932eb2d9d75d` | PR body; `docs/loops/cursor-parity/audit.md` |
| #371 | T-152: last 4 test type errors fixed; `typecheck:tests` added to CI | master | `ef3fbd2394bf57f519fa488f8f735b1f272904f7` | PR body + its comment (run ids) |

## Rows for each PR

1. **Confined.** List the files each PR's own commits touch beyond its base. Flag anything outside the task.
2. **Red then green.** Run the new or changed test files against the base's source (they fail) and against the head
   (they pass). Quote the counts.
3. **One mutant of your own**, plus re-run one of the developer's. Each must turn a row red.
4. **CI on the head (read only).** `gh pr checks <n>`: quote the `test` result and run id.

## Rows specific to this batch

5. **#373.**
   - The build line has NO path and NO ISO timestamp. Exact shapes, pinned in tests:
     `Build <sha> · current (N records-only commits behind)` / `Build <sha> · STALE: N code commits behind → ask Aaron to update` /
     `Build <sha> · ahead by N (unmerged local commits)`.
   - Read `SERVED_PATHS` and judge it: are `open-brain/` minus `open-brain/tests`, `scripts/`, `.claude/`, `package.json`
     the right set? Name any served path it misses (e.g. `project-template/`?) and say whether that matters.
   - Usage at weekly >= 98 puts the weekly window first and never names the 5-hour reset; a 5h-caused STOP with weekly
     < 98 keeps its old text.
6. **#374 (stacked).**
   - Rebase-free check: `git merge-base --is-ancestor 1115ee19 7e0509e1` must hold.
   - Apply each of QA 263's six mutants (`docs/loops/qa-263/mutants/*.diff` on `origin/qa/t233-report`; two were
     adapted by the developer to current code: say whether the adaptation preserves the mutant's intent). All six red.
   - The three `start.md` copies (`.claude/commands`, `project-template/.claude/commands`,
     `project-template/.cursor/commands`) carry the same new lines; `cursor-start-parity` passes.
7. **#372.**
   - `withCursorMcp` / `withCursorSessionHook` are pure; `setup.mjs` passes `process.execPath`.
   - A bare-`node` entry is upgraded; a second run changes nothing; an untagged or stale `cli-bootstrap.js` hook entry is
     replaced, not duplicated; an unrelated hook entry survives.
   - Run `setup.mjs` ONLY under a scratch `USERPROFILE`/`HOME` (Windows) or `HOME` (POSIX). Show the written
     `mcp.json` `command` is an absolute path. Restore the environment.
8. **#371.**
   - `npm run typecheck:tests` exits 0 at the head; on master it reports 4 errors.
   - The deleted ranking case ("does not rank by success rate") is covered by the SQL-absence case still present.
   - `ci.yml`: the new `Typecheck tests` step is in `test` (and `test-windows`); quote the red run 37112456733 and the
     green run 37112675080 and confirm the red was the planted error.
   - The `s4-guards` allowance change (ranking.test.ts 11→9) names T-152/R-011.
9. **Batch merge order.** On a scratch branch from `origin/master`, merge in order **#373, #374, #372, #371**.
   Report any conflict. Then run `npm run typecheck:tests` (it must exit 0 with all four in), `tsc --noEmit`, and the
   touched test files one per invocation.

## Rules (headless Claude Code)

- You are **QA 264**, and your prefix is `s159-batch`. Push ONLY `qa/s159-batch-*` branches, and only through
  `node docs/loops/qa-264/push-qa.mjs <branch>`, run from your `qa264-wt` tree.
- **Never create, comment on or edit an issue or a PR.** Use `gh` only to read.
- From real config files (`~/.claude.json`, `settings.json`, `.mcp.json`, `~/.cursor/*`, env), report **only counts, key
  names, server names and command paths, never values** (G-051). Before every commit, scan for key and token patterns.
- Commit `docs/loops/s159-batch-qa-report.md`, with its `.E_t.json`, on `qa/s159-batch-report`.
- Give one verdict line per PR and a batch verdict.
- The last line is exactly `QA-264: REPORT COMPLETE`.
