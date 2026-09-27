# /bootstrap fix — developer handoff (Forge, record 127)

**By:** Forge (developer), record session 127, 2026-09-26. **To:** Atlas (planner, record 109) and the QA seat.
**Brief:** `docs/loops/bootstrap-fix-brief.md` (on `origin/docs/session-100-qa99-dispatch`). **Acceptance list:**
`docs/loops/t181-frogger-pilot-report.md` (F1–F15, as rows BF-1..BF-8).
**Model and effort, from this session's transcript** (`a4eee1fe-907c-4f5e-a73b-df992fb76a9d.jsonl`):
`"model":"claude-opus-5-5"` and `"effort":"medium"` on all 382 assistant turns.

## 1. What this is built on, and the candidate

- **Base: `origin/loop/t179-merge` at `f618b73`**, which is T-179's candidate `3c0bfdc` plus its handoff doc. The base
  was STACKED as the brief says, not master.
- **Candidate: `loop/bootstrap-fix` at the SHA named in §7** (the last commit before this doc is `8aba3df`).
- **T-179 round 2 is pending.** Atlas's heads-up said QA 125 rejected `3c0bfdc` on D1, and round 2 (record 128)
  is building on `loop/t179-r2`. Per the brief, I will **merge its frozen tip in (never rebase) and repeat the
  acceptance run.** Until then, this candidate carries T-179 as it was at `3c0bfdc`.

## 2. Decisions the brief asked me to state

- **BF-2: the seed is REMOVED, not skipped.** `project-template/.agents/state.json` is deleted.
  - `state import` is the only thing that writes a record, and it refuses when one exists.
  - Nothing ever substituted `{{PROJECT}}`.
  - README's `cp -r project-template/.agents` put the seed into projects, where it blocked the import.
  - "Bootstrap never copies it" would have left that trap in place for every other path into the template.
  - `template-seed.test.ts` now asserts the absence. The seed's old claim, "/start renders rev 0 on a scaffolded
    project", is now proved through the importer, end to end.
- **BF-5: a fresh install is NOT a seat.** Scaffold writes `.agents/AGENT.md` with `role: none`, and the template
  gitignore now tracks it, so a clone has it.
  - **Why:** seats (planner, developer, QA) exist for SIA's multi-checkout loop. A one-agent project runs no loop.
    Making it a seat would load role files that describe that loop and would need a `roles/` tree the project has
    no use for.
  - **Code change it needed:** `role: none` alone still raised `ROLE FILE MISSING: .agents/roles/shared.md`. A
    checkout that declares it is not a seat now has no missing role files. shared.md is still loaded when present.
  - **Verified:** such a project can still hand off. `set_handoff` names its own seat, and the writer accepted it
    with the checkout's seat null (new test row). The greeting line said the opposite; see §5, F-C.
- **BF-6: one source.** Every scaffolded file is copied byte for byte from `project-template/` by
  `open-brain bootstrap scaffold`, and bootstrap.md carries no file content.
  - The one exception is `AGENT.md`, which is generated because it states a fact about the checkout.
  - The command source is `project-template/.claude/commands/` (via scaffold).
  - The global-commands skip is **removed**: the four commands always go into the project, so a clone on another
    machine has them. Existing project files are skipped and listed, never overwritten.
  - `git init` comes first, enforced in code: scaffold refuses anything but a clean repository root with a commit.
- **Deterministic first.**
  - Residue detection, the file copy, and the tracked/local verification are code: `bootstrap check`,
    `move-residue` and `scaffold`.
  - bootstrap.md is the order and the owner's decisions.
  - The order itself is held by a test.

## 3. Rows

| Row | What changed | Evidence |
|---|---|---|
| **BF-1** (F1) | `SECTION_RE` accepts a symbol run before `P0`–`P3`. The template's own INBOX (`## 🔴 P0 — Critical`) imported **0** tasks, which is the same class as F1. An INBOX that yields 0 tasks puts a `WARNING` on the draft's `Tasks:` line and in the report. The template headings are what bootstrap.md tells the owner to keep. | Rows "template's own INBOX imports every item" (red: `expected +0 to be 10`), "WARNING naming 0 tasks" (red on the `Tasks:` line), and a negative control (green on the base). Run 3: `Tasks: 3`, no WARNING. |
| **BF-2** (F2) | Seed removed (§2). bootstrap.md gains step 6 (`--draft`, shown to the owner) and step 7 (the owner runs `--commit`, G-007). | Row "template ships no state.json". Run 3, steps 6–7: rev 0, schema v3. |
| **BF-3** (F5) | `bootstrap check` reports `.agents/` as absent, empty, RESIDUE (named entries), PRE-STATE (the import path) or BOOTSTRAPPED. `move-residue` moves the residue to `.agents/archive/pre-bootstrap-residue-<date>/`, reads it back, and deletes nothing. CLAUDE.md is absent, present, or has-sia-section, and bootstrap.md offers to append the section, never skipping or overwriting. | Four BF-3 rows (all red on the base), plus scaffold refusing over residue. Run 3, steps 1–2 and 4. |
| **BF-4** (F6) | Scaffold prints every file as tracked or local with the reason, then **asks git** (`check-ignore --no-index`) whether each one matches. It also asks about the files the import will write, and about session logs and archive/. bootstrap.md step 8 names the exact expected list. | The end-to-end row checks each file against `git check-ignore` independently and compares the SIA commit to the list. Two known positives (an owner `.agents/` rule; an owner CRLF rule) each make scaffold exit 1. The mutant `verify always ok` was killed by both, with tsc clean. Run 3 step 8: 13 listed, 13 predicted, and status empty after the commit. |
| **BF-5** (F8) | §2. | Row "no ROLE FILE MISSING…" (red on the base: `[Array(1)]`), with its negative control (a real seat still reports it). Run 3 (c): `NOT A SEAT`, no missing role file. |
| **BF-6** (F3, F4, F7) | §2. | End-to-end row: the INBOX is byte-equal to the template's, the four commands are present, and the owner's CLAUDE.md is untouched. The row "refuses before git init" was red on the base. |
| **BF-7** (F10) | `project-template/gitattributes` (`/.agents/** text eol=lf`), merged by scaffold, and scaffold verifies it with `git check-attr`. | End-to-end row: a clone under `core.autocrlf=true` has no CR in `state.json`, `INBOX.md` or `SUMMARY.md`. Run 3 clone: `.agents/` has 0 CR bytes; README.md (outside `.agents/`) has 3, which is the known positive. |
| **BF-8** (F12, F9) | The `ob_start` header uses the record's name. The CLI `open-brain start` printed the same nameless line (a sibling) and is fixed too. The retention edge is floored at 0 for the stamp, and the report never prints a negative session. **F9 was not cosmetic:** a done item with no marker at session 0 got `closed_session = -3`, and **the draft failed validation.** | Rows "done item validates" (red: `{ ok: false }`) and "header names the project" (in the end-to-end row). The CLI sibling mutant was killed: `'Project: v0.1.0'`. |

**Not in this round, as the brief says:** F11, F13, F14, F15.

## 4. The red and green runs

| Run | Where | Tree | Result |
|---|---|---|---|
| Red 1 | tcm (`tcm-1`), CI 36226161147 | redcheck `2a20cde` = base + the first test file | **13 failed** (all in `bootstrap-fix.test.ts`, each on an assertion) · 1287 passed · 2 skipped |
| Red 2 | tcm (`tcm-1`), CI 36226761559 | redcheck `192349e` = base + the test file as of `ff35000` | **15 failed** (all in the new file) · 1287 passed · 2 skipped |
| Green 1 | tcm (`tcm-2`), CI 36226763128 | `d8da169` | **2 failed** · 1303 passed. Both in `tests/shared/cli-args.test.ts`, its "proves it looked" closed lists, which a new command must join. Fixed in `8aba3df`. |
| Green 2 | tcm (`tcm-2`), CI 36227534066 | `8aba3df` | **success**: 85 files, 1317 passed, 2 skipped |
| Local | Windows, this worktree | each commit | single files and small sets only, as the brief says. Last: `bootstrap-fix` + `session-start/*` + `template-seed` = 13 files, 150 passed; `cli-args` 65 passed; `tsc --noEmit` exit 0 before every push. |

**Mutants, each run with tsc clean and the edit asserted to have landed:**
- `verifyTracking` returns ok always: killed by both known positives.
- The CLI `start` header reverted: killed with `'Project: v0.1.0'`.
- The order guard was run against the two earlier `bootstrap.md` files:
  - `1c9cb74` (run 1's): 2 findings.
  - `a71b4cb` (run 2's): 1 finding.
  - The current file: 0.

**The rows written after the red runs were each seen red first.** They cover the residue order, the tracked-residue
removal, the order guard, and the set_handoff row.

## 5. What went wrong (mine), and what the acceptance runs found

- **F-A. `ff35000` is labelled "tests" but also deletes the seed.** An earlier `git rm` was still staged when I
  committed.
  - Cherry-picked onto redcheck, it would have made BF-2 pass "red" for the wrong reason. I saw it in the
    `--stat`, restored the seed on redcheck in `192349e` before dispatching, and red run 2 is base + tests only.
  - On `loop/bootstrap-fix` the history is pushed and stays as it is: the deletion's commit is `ff35000`, not
    `d8da169`.
- **F-B. Scripted edits mangled escapes twice.** A `"\n"` in one fixture, and a `/\r?\n/` in the order guard that
  became real CR/LF bytes.
  - The second one produced **exit 1 against the two old bootstrap.md files, which I first read as "the guard
    fires"**. It was a transform error, and the current file failed identically. Caught by reading the raw output
    before recording anything.
  - The guard's validation in §4 comes from after the fix.
- **F-C. Four defects the acceptance runs found in my own bootstrap.md and code.** None would have been found by
  the tests I had written first.
  1. **Run 1:** residue and the pre-SIA commit were ordered so that either the residue entered the commit or
     scaffold refused a dirty tree (`a71b4cb`).
  2. **Run 1, same fix:** porcelain was read through a `trim()` that ate the first line's status column
     (` D path` read as `D path`).
  3. **Run 2:** the CLAUDE.md step came before scaffold, and its edit made scaffold refuse (`11ac121`).
  4. **Dry-read before run 3:** step 8's `git status --short` collapses new folders, so the comparison it asked
     for could not be made (`626938b`).
  - I also found, **pre-existing and now on every fresh install's greeting:** "Seat-taking writes (set_handoff) are
    refused from a checkout with no seat". This is false, and `role-files.test.ts` pinned it with `/refused/`.
    Corrected and pinned the other way (`c49d8a7`).
- **F-D. I did not run `tests/shared/cli-args.test.ts` locally.** Its closed command list went red on tcm (green 1).

## 6. The acceptance install (full transcript: `docs/loops/bootstrap-fix-acceptance-transcript.md`)

Run 3, `bootstrap.md` at `626938b`: a scratch folder under `%TEMP%` with `package.json`, an existing `CLAUDE.md`, a
TODO/FIXME in `index.js`, `.agents/reflection-queue.json`, no git, and `core.autocrlf=true`.

- **(a)** The draft imports the scaffolded tasks: `Validates: yes`, `Tasks: 3`, no WARNING.
- **(b)** `--commit` wrote schema v3 rev 0 for `tiny-notes`, with T-001..T-003, an objective, and 0 verified, gaps
  and decisions.
  - `grep -cE "V-00[1-5]|G-00[1-6]"` is 0 on the record and all 4 views.
  - The same grep's known positive, SIA's own record, is 20.
- **(c)** `ob_start` (`handleStart` from the candidate's build) returned `## State (state.json rev 0)`:
  - the header `Project: tiny-notes v0.2.0`;
  - `NOT A SEAT`;
  - `shared.md — ABSENT (shared; not a seat, so none is expected)`;
  - no problem line;
  - 252 words.
- **(d)** Step 8 listed 13 files and predicted 13, and after `Bootstrap SIA`, `git status` was empty.
- **(e)** No manual fix in run 3.

**Honest limits of this acceptance:**
- **`<SIA>` was this worktree, not the main checkout.** Step 0 followed literally resolves to
  `~/Projects/Self-Improving-Agent`, whose master build has no `bootstrap` subcommand (recorded as run 1's first
  output). That holds on Aaron's machine until this merges and the main tree is rebuilt. His *global*
  `~/.claude/commands/bootstrap.md` is also the old one until `setup.mjs` copies the new one.
- **Step 7's `--commit` was run by me as the owner's stand-in, in the scratch project.** It was not denied.
- **(c) is the candidate's `handleStart` called from a script, not `/start` in a fresh Claude session.** This
  session's MCP server serves master's build, which would print the old header.
- **The runs are mine.** A stranger-run (a fresh session given only bootstrap.md) has not been done.
- Runs 1 and 2 are in the transcript because they found defects. Run 3 predates `c49d8a7`, which changed only the
  NOT-A-SEAT sentence.

## 7. State at hand-back

- **Candidate:** `loop/bootstrap-fix` at the SHA of the commit that adds this doc. Read it back with
  `git ls-remote origin refs/heads/loop/bootstrap-fix`. Code, template and tests are unchanged since `8aba3df`.
- **Green 2 (tcm, CI 36227534066, `8aba3df`):** **success**. Runner `tcm-2`: Test Files 85 passed (85); Tests 1317 passed | 2 skipped (1319); `bootstrap-fix.test.ts` 23 tests.
- **Pushed branches:** `loop/bootstrap-fix`, `loop/bootstrap-fix-redcheck` (`192349e`). Nothing else. No master, no
  force.
- **Due next, from Atlas's heads-up:** merge `loop/t179-r2`'s frozen tip in, and repeat the acceptance run (run 4)
  on the result.

## 8. Noticed, not fixed (candidates for tasks)

- **The importer writes a `developer` handoff into a fresh record.** `ob_start` then shows
  `Handoffs (1) — READER'S SEAT UNRESOLVED … developer [legacy] (session 0)` on a project that has no seats.
- **The template's content is PRD-first.** task.md's "Active Tasks" table and acceptance criteria are about writing
  a PRD, and bootstrap.md only replaces the objective. INBOX's "How to Use" block becomes 17 "unparsed lines" in
  every fresh draft.
- **`/sync` in this worktree reports 3 issues from the base, none from this work:**
  - the live record is schema v2 under T-179's v3 build; I did not migrate it, since the brief says never to write
    it;
  - `end.md` mirror parity;
  - `ENTITIES.md` names retired terms.
  - Also a `ci-status` warning: master `aae0dce` failed.
- **GitNexus has no index in this worktree.** Impact ran on the main checkout's index, 95 commits behind:
  `handleStart`, `describeRoleFiles`, `importTasks`, `renderImportReport` and `parseInboxItems` were all LOW.
- **`detect_changes`** ran against that index (`worktree` = this checkout, compare to `f618b73`): 30 changed symbols,
  18 files, **risk "high"**.
  - The "high" comes from `handleStart` sitting in 10 execution flows. My change there is the one header line
    (§3, BF-8).
  - `importDecisions`, `importObjective`, `importHandoff` and `sectionBody` are listed as "touched" but have no
    edits of mine. They sit below lines I inserted, read against an index 95 commits behind.
  - The new `pipelines/bootstrap/` module is not in the index at all, so it is not in the result.
  - **This is a stale instrument's answer, recorded as such, not a clean bill.**
