# T353 review: bootstrap writes a default greeting.json, the template tracks it, /sync warns (PR #1155)

Runtime: CC (claude -p, Opus)
SEAT: job runner (QA PC or Lenovo), NOT the desktop. No hub key. **Read-only: no commit, no push, no PR, no PR comment,
no edit outside the launcher's clone.** Ends at a VERDICT, which decides an SG-1 merge. You are the QA judge; the build
was a separate run (job 1451).
REPLY: the absolute reply path the launcher names. Print it FIRST. Line 1 of the reply is `VERDICT: ACCEPT`,
`VERDICT: ACCEPT-WITH-NOTES` or `VERDICT: REJECT`; line 2 is `MODEL: <your model id>`.

**By:** Atlas (planner), 2026-11-18, session 178. **Task:** T-353 (decision D-166). **Tag:** `t353-review`.
**Spec:** `docs/loops/t353-brief.md` (in the launcher's clone).
**START:** `83f87efa4d17a1e2ed2a496c68dc75233c17303a`. **CAND:** `6d82d38eca779d953e0bf5097d1271da595fff98` (one commit on START,
branch `loop/t353`). Review CAND, never the launcher's own sha: `git fetch origin loop/t353` and
`git checkout -q 6d82d38eca779d953e0bf5097d1271da595fff98`.

```text
IMPACT-TARGETS: none: review only; no repository file is changed
```

## What it does

Every /start greeting feature is opt-in through `.agents/SYSTEM/greeting.json`. A bootstrapped project never got that
file, and the template's ignore rules hid it from git if someone wrote it; two fleet repos ran for weeks on the legacy
briefing with no greeting-metrics row. Aaron decided (D-166) that bootstrap turns the features on by default. CAND:

1. `SCAFFOLD_FILES` gains `.agents/SYSTEM/greeting.json`, copied from the new template file: EIGHT flags true
   (`briefing_budget`, `greeting_metrics`, `maybe_shipped`, `merged_citations`, `missing_handoff`, `reads_owed_own`,
   `role_docs_by_sha`, `state_compact`). Left out on purpose, by the planner: `briefing_problem` (scaffold writes no PRD,
   so `/sync` `prd-version` would be an ISSUE on a fresh install), `briefing_focus` (prints a "no seat map" line every
   start; T-354), `handoff_by_checkout` (a fresh record's first greeting loses its "none yet" line; T-355), `handoff_caps`.
2. `project-template/gitignore` gains `!/.agents/SYSTEM/greeting.json`.
3. `/sync` gains the check `greeting-flags`: WARN when a project with a valid record has no greeting.json, WARN when the
   file exists and git ignores it, skip without a record or where git cannot answer, pass otherwise. Never an issue.

Accepted by the planner and NOT findings: a bootstrap re-run on a bootstrapped project writes nothing (scaffold refuses);
an existing greeting.json makes scaffold refuse as residue; `state import --commit` gives the ignore exception but no
greeting.json.

## Already proved by the planner / reported by the build

- CAND is byte-for-byte START + `docs/loops/t353/edits.txt` + the two copied files (8 files SAME, no EXTRA).
- Build (QA PC, Linux): sixteen step-4 files 154 passed; m1-m12 each red as predicted. Full suite, run BEFORE the commit:
  5060 passed, 7 skipped, 2 failed: `tests/harness/checks.test.ts` D4 (known red at START on both hosts, an npm error)
  and `tests/harness/s4-guards.test.ts` D1b (the new test file was untracked at that step; rerun alone after the commit:
  15 passed). **The full suite has not been seen clean on the committed tree: step 3 runs it.**

## Rules

- Do not read, copy or print `~/.claude.json`, `~/.claude/settings.json`, any `.mcp.json`, `.env` or key file. Do not
  touch the real `~/.claude/open-brain/`: use a scratch HOME and scratch project folders OUTSIDE any git repository for
  anything that runs.
- Paste each command with its output. Every number is pasted output. Mark anything not run NOT RUN, with the reason.
- A finding needs file:line at CAND and a concrete failing input.

## Steps

1. `node -v` must print `v22.*`. `git rev-parse HEAD` must print CAND. Paste `git diff --name-status 83f87efa..HEAD`
   (expect 5 `M`, 2 `A` under `open-brain` and `project-template`, plus the `A` template greeting.json: 8 paths).
2. **Read** `git diff 83f87efa..HEAD -- open-brain/src project-template`. Answer each, with the line:
   a. **The eight flags in a bare project.** For each of the eight default flags, read the code behind its
      `greetingFlag(` call and say what /start prints or does in a project fresh from bootstrap: the scaffolded files
      only (AGENT.md as developer seat, four role stubs, no PRD.md, no hub-partner-seats.json, one checkout, the import's
      single empty handoff). Quote any line that would read as a fault, an alarm or noise there. This is the main
      question: a default that prints a wrong line in every new project is a REJECT.
   b. **Never harms.** Can `checkGreetingFlags` throw out of `runSync` (unreadable state.json, greeting.json that is a
      directory, invalid JSON, git missing, a path with spaces, not a repository, a bare repository, a worktree)? Can it
      ever return `issue`? Does `sync --check`'s exit status change for any project because of it?
   c. **The ignore probe.** `git check-ignore -q -- <rel>` without `--no-index`: confirm from git's behaviour, by
      running it in a scratch repo, the four cases: tracked file under an ignore pattern (not ignored), untracked and
      ignored, untracked and not ignored, file absent. Does the check's answer match in each?
   d. **Scaffold.** Is the template file copied byte-for-byte (LF, trailing newline)? Does adding the entry change what
      scaffold does for any other file, the residue test, or the import step's "tracked" verification? Does the
      framework repo itself ignore or track `project-template/.agents/SYSTEM/greeting.json` (it must be tracked)?
   e. **Existing projects.** Run the new check's logic by reading: for a project with a valid record whose greeting.json
      is tracked (the six fleet repos' state), is the result `pass`? Is there any existing-project shape where a new
      WARN appears that the brief does not name?
   f. **The warn texts.** Are both lines true and actionable as written (the path to create, the exact gitignore line
      and where it goes)?
3. **Run**, in `open-brain` with a scratch HOME: `npm ci`; `node -e "require('better-sqlite3')"`;
   `npx vitest run --no-file-parallelism --testTimeout=180000` (the FULL suite on the committed tree; paste
   `Test Files`, `Tests`, any `Errors` line and any Unhandled Errors section). A red row other than
   `tests/harness/checks.test.ts` D4: run that file alone at CAND and at START (use
   `git worktree add ../t353-start 83f87efa` and `npm ci` there; `git stash` is forbidden) and say which side is red.
   A single `Timeout calling "onTaskUpdate"` unhandled error with every file green is the known T-292 flake: rerun once
   and report both runs.
4. **Live shape.** `npm run build`. In a scratch folder outside any repository: `git init` a new project, run the built
   CLI's bootstrap path the way `tests/pipelines/bootstrap-fix.test.ts`'s whole-path row does (scaffold, then the import
   steps it needs to reach a valid record), then paste: `cat .agents/SYSTEM/greeting.json`;
   `git check-ignore -v .agents/SYSTEM/greeting.json; echo $?`; `git check-ignore -v .agents/SYSTEM/PRD.md; echo $?`;
   the `greeting-flags` and `prd-version` lines of `node <build>/cli.js sync`; `sync --check`'s exit status; and the
   whole `## Briefing` block of `node <build>/cli.js start <project>`. Say whether any line of that first briefing
   reads as a fault or noise. If the CLI path needs more than the fixture gives, say what and mark it NOT RUN.
5. **Surviving mutants.** Name any single-line change to the new code that the fourteen T353 rows and the
   `template-seed` row would not catch; apply, run
   `npx vitest run tests/pipelines/t353-greeting-default.test.ts tests/pipelines/template-seed.test.ts`, paste, restore
   with `git checkout -- <file>`. Try at least: `status === 1` changed to `status !== 0`; the valid-record guard
   dropped; the order of the absent and ignored tests swapped; the `unknown` answer returned as `pass`.

## Verdict

REJECT for: a default flag that prints a wrong, alarming or noisy line in a fresh project (2a, 4); any path where the
new check throws, returns `issue` or changes `sync --check`'s exit status (2b); the probe giving the wrong answer in one
of the four cases (2c); a fresh bootstrap whose greeting.json is ignored by git or not the eight-key file (2d, 4); a new
WARN in the fleet repos' shape (2e); a row red at CAND and green at START; or a surviving mutant that changes who gets
a warning or what the default contains. A surviving mutant that is only a test gap on an input the source handles
correctly is a NOTE (planner ruling, T-351). ACCEPT-WITH-NOTES for anything else. List findings, then NOTES and NITS,
then what was NOT RUN.
