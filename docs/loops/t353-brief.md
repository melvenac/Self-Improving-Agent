# T353: bootstrap turns the greeting features on for a new project, the template tracks greeting.json, and /sync warns where the file is missing or ignored (T-353)

Runtime: CC (claude -p, Opus)
SEAT: job runner (Lenovo or QA PC), NOT the desktop. No hub key. Code. Ends at READY with a PR, or HANDBACK; no merge.
REPLY: the absolute reply path the launcher names. Print it FIRST.

**By:** Atlas (planner), 2026-11-18, session 178. **Tasks:** T-353. **Tag:** `t353`. **Size:** SMALL (three source
files, two template files, one existing test file, one new template file, one new test file). **Base:** the START sha
the launcher names (a master that contains this brief; drafted against `139d3ec0ec8de9cc34afd27b554e0f04cd7b6435`).
**Authority:** the backlog (D-145) and D-166 (Aaron, 11-18: bootstrap turns the greeting features on by default);
merge on Atlas's QA ACCEPT, sent to clark. No auth, deps, workflows or hooks.

```text
IMPACT-TARGETS: SCAFFOLD_FILES (bootstrap/index.ts), runSync (sync/index.ts)
```

New in `sync/checks.ts`, so not in the line above (they do not exist at the base): `checkGreetingFlags`,
`gitCheckIgnore`, `IgnoreAnswer`, `GREETING_FLAGS_MISSING`, `GREETING_FLAGS_IGNORED`. `scaffold`'s body is not edited:
it loops over `SCAFFOLD_FILES`, so its output gains one file. In `checks.ts` one import line changes and code is
appended after `checkGreetingSize`; no existing function there is edited.

## What changes

`docs/loops/t353/edits.txt`, 10 edits in 6 files, plus two files copied in. No new dependency, no hook registration, no
settings, no `package.json`, no change to how `greetingFlag` reads the file (an absent file or key is still OFF).

The problem: every greeting feature is opt-in through `.agents/SYSTEM/greeting.json`, `open-brain bootstrap` never wrote
that file, and the template's ignore rules (`/.agents/SYSTEM/*`, excepting only `SUMMARY.md`) hid it from git when
someone wrote it by hand. Two fleet repos ran for weeks on the legacy briefing with no greeting-metrics row.

1. **`project-template/.agents/SYSTEM/greeting.json`, new** (copied from `docs/loops/t353/greeting.json`): EIGHT keys,
   all `true`, sorted, 2-space JSON, trailing newline: `briefing_budget`, `greeting_metrics`, `maybe_shipped`,
   `merged_citations`, `missing_handoff`, `reads_owed_own`, `role_docs_by_sha`, `state_compact`. NOT in the default
   (ruled; D-166 allows leaving out a flag that reads badly in a bare project): `briefing_problem`, `briefing_focus`,
   `handoff_by_checkout`, and `handoff_caps` as before. The reasons are in the table below.
2. **`bootstrap/index.ts` `SCAFFOLD_FILES`:** one entry, `.agents/SYSTEM/greeting.json`, copied from the template,
   `tracked: true`. That is how scaffold makes every other file (read at the base: "every scaffolded file is copied byte
   for byte from `project-template/`, except `.agents/AGENT.md`"; the copy goes through `templateText`, so it is LF).
   `SCAFFOLD_FILES` is the only list of scaffolded files in `src`; the loop that reads it already skips a file that
   exists, and `verifyTracking` already asks git about every file it wrote, so no other code changes.
3. **`project-template/gitignore`:** `!/.agents/SYSTEM/greeting.json` after `!/.agents/SYSTEM/SUMMARY.md`, and the
   comment above the block says so. The framework's root `.gitignore` already carries that line (line 44 at the base).
4. **`project-template/.claude/commands/bootstrap.md`:** the Tracked list in step 3 names the new file (one sentence).
5. **`sync/checks.ts`, new check `greeting-flags`** (`checkGreetingFlags`), registered in `runSync` after
   `task-assignees`. No existing check reports on whether greeting.json exists (`prd-version` and `task-assignees` only
   read flags from it), so this is a new one. It never returns `issue`:
   - no `.agents/state.json`: `skip`, `skipped: no .agents/state.json, so this project has no greeting to configure`;
   - a `state.json` that `parseState` refuses: `skip`, `skipped: .agents/state.json is not a valid record (see state-schema)`;
   - **(a)** valid record, no greeting.json: `warn`, `.agents/SYSTEM/greeting.json is absent, so every greeting option is
     off: /start prints the legacy briefing and writes no greeting-metrics row. To turn the default set on, create
     .agents/SYSTEM/greeting.json as a copy of the eight-key default in
     project-template/.agents/SYSTEM/greeting.json of the SIA install, and commit it`
     (one line; git is not asked);
   - **(b)** the file exists and `git check-ignore -q -- .agents/SYSTEM/greeting.json` exits 0: `warn`,
     `.agents/SYSTEM/greeting.json exists but git ignores it, so it reaches this checkout only: add the line
     !/.agents/SYSTEM/greeting.json to .gitignore, after /.agents/SYSTEM/*, and commit both` (one line);
   - exit 1 (tracked, or untracked and not ignored): `pass`,
     `.agents/SYSTEM/greeting.json present and not ignored by git (N flag(s) on)`, N = keys whose value is `true`;
   - any other exit (128 outside a repository, git absent): `skip`, `skipped: .agents/SYSTEM/greeting.json present (N
     flag(s) on); whether git ignores it: unknown (git check-ignore failed: <git's first line>)`.

   `check-ignore` runs WITHOUT `--no-index` on purpose: a tracked file is then never "ignored", which is the ruling's
   "no warning when the file is tracked". Exit codes proven first-hand in a scratch repo on the desktop (git only):
   ignored untracked 0; the same file after `git add -f` 1 (and 0 with `--no-index`); excepted untracked 1; outside a
   repository 128.

### Existing projects, and a greeting.json that is already there (ruled)

- **A re-run of bootstrap writes nothing.** `scaffold` refuses a project that has a record (`already bootstrapped:
  .agents/state.json exists. Nothing written`) before it writes anything, today and after this change, and leaves
  `.gitignore` byte for byte (row T353-6). The path for an existing project is `/sync`: warning (a), then (b) if its
  ignore block predates the exception.
- **"Present: never overwritten" holds by refusal.** A greeting.json in a project with no record makes `.agents/`
  RESIDUE, so `scaffold` throws `.agents/ holds residue (SYSTEM/) ...` first; the loop's `already exists` skip is not
  reachable for a file under `.agents/`. Rows T353-4/5 pin the bytes across the refusal. Mutant m1 (the skip removed)
  is caught by the EXISTING row in `tests/pipelines/bootstrap-fix.test.ts`, "scaffold never overwrites: an existing
  .claude/commands/start.md is kept and reported as skipped", not by a T353 row.

### Not in this brief

- **The import path.** A project on the pre-record framework (`.agents/TASKS/`, no `state.json`) never runs scaffold:
  `state import --commit` installs the role stubs and merges the template gitignore itself. After this change that
  project gains the gitignore exception (the merge appends the missing line) and NO greeting.json. Accepted: `/sync`
  warning (a) tells that reader the path to create and where the eight-key default is.
- **The two defects the table found** (the `FOCUS: no seat map` line, and the fresh-record line lost under
  `handoff_by_checkout`). The planner files them as separate tasks; nothing here changes either.

## Behaviour of each default flag in a bare project

Read at the base, code only, nothing run. "Bare" = a valid `state.json`, NO `.agents/roles/`, NO PRD.md, one checkout,
no handoff written from it. A fresh `state import` record carries one empty handoff with `checkout: null`
(`state-import/index.ts:544`) and one session with `checkout: null` (`:886`).

Ruled from this table: three flags are NOT in the default. `briefing_problem`: scaffold writes no PRD, so `/sync`
`prd-version` would be an issue and `sync --check` would exit 1 on a fresh install (row T353-14 pins the warning).
`briefing_focus`: it prints the "no seat map" line on every start in a project with no `hub-partner-seats.json`.
`handoff_by_checkout`: the first greeting loses T-329's `none yet (fresh record)` line. A project turns any of them
on by adding the key.

| flag | what it does there | clean? / in the default? |
|---|---|---|
| `briefing_problem` | Briefing line `PROBLEM: not shown (no PRD.md in .agents/SYSTEM/, docs/ or the repo root)` (`briefing.ts:462`). **And `/sync` `prd-version` goes from `warn` to `issue`** (`sync/checks.ts:98-104`): `PRD.md not found (.agents/SYSTEM/, docs/, repo root): this checkout has no problem statement, so /start cannot show what the project is for. If another checkout has it, it is untracked: add it to the .gitignore allowlist.` `sync --check` exits 1 on any issue (`cli.ts:175-176`). The code comment there says the warning is kept for "a fresh consumer install [that] creates no PRD". Scaffold writes no PRD, the template gitignore ignores `.agents/SYSTEM/PRD.md`, and the template's own PRD.md prints `PROBLEM: not shown (.agents/SYSTEM/PRD.md has no "## Problem Statement" heading)` (`t167-problem.test.ts` row (f)). | NO: a fresh install fails `/sync --check`. **Not in the default** |
| `briefing_focus` | No seat map exists (`.agents/SYSTEM/hub-partner-seats.json`; scaffold writes none and the template gitignore ignores it), so the `PICK UP HERE` header line carries `FOCUS: no seat map (.agents/SYSTEM/hub-partner-seats.json), so this checkout's seat is unknown` (`focus.ts:75`) on every start, beside a `Seat: <name> (developer)` line that resolved the seat. No SEATS line (`seatOrder` is null). | NO: noisy, and reads as a fault. **Not in the default** |
| `handoff_by_checkout` | The imported handoff has no checkout, so it is never "yours". State prints a `Handoffs (1)` header ending `no handoff recorded for this checkout (developer, <folder>):` (`state-render.ts:242`) and lists it as `developer [legacy, unattributed] (session N)` (`:257`, `:346`), where the flag OFF prints `Your handoff: none yet (fresh record)` (`:248`, T-329's fix for exactly this first greeting). The briefing prints `none recorded for this checkout (developer, <folder>)`. It lasts until the first `set_handoff` from this folder. The checkout is the folder's basename (`state-schema.ts:461`): a clone in a folder with another name does not see the handoff as its own. | NO: undoes T-329 on the first greeting. **Not in the default** |
| `briefing_budget` | The budgeted layout. Pick-up line as above, or `none recorded for this seat (developer)` with `handoff_by_checkout` off. `OBJECTIVE` / `none`, `WAITING ON AARON: none`. | clean |
| `state_compact` | Verified and Gaps print counts; other handoffs are one line. | clean |
| `missing_handoff` | Null on the first start: no session of this checkout is in the record. Once a session here writes the record and leaves no handoff: `Handoff MISSING: last ... wrote the record, left no handoff; fix: ob_state set_handoff` (the feature). With no proven session id and only uuid-less sessions: `Handoff check: not checked (...)`. | clean |
| `merged_citations` | Null: no own handoff (`handoff-merged.ts:38`). | clean |
| `maybe_shipped` | Null with no open task, or none named by a code commit. `MAYBE SHIPPED: not checked (...)` only outside git or in a shallow clone. Matches `T-<n>` in commit subjects, so a project that uses `T-12` for something else gets a false note. | clean |
| `reads_owed_own` | Only narrows READS OWED by this seat's own commit trailers; `[]` without a proven session. | clean |
| `role_docs_by_sha` | No role docs: prints nothing and records nothing. With a resolved seat it writes `.agents/role-reads.local.json` (ignored by the template). With NO seat (no AGENT.md): `(Role docs in full: no seat resolved, so there is no last read to compare with.)` every start (`role-files.ts`, `renderRoleDocs`). Scaffold writes AGENT.md, so not in a scaffolded project. | clean there |
| `greeting_metrics` | One row per start in `~/.claude/open-brain/greeting-metrics.jsonl`, and one end row per `ob_end` (`server.ts:427`). On failure one line, `Greeting metrics: not written (...)`. | clean |

Not confirmed by a run: all of the above. The eight flags in the default are the rows marked clean.

## Existing tests that pin this behaviour (planner read at 139d3ec0; rows NOT run)

**One existing row turns red; edits.txt updates it.** No test asserts the number of sync checks or a list of their
names (`git grep` for `checks.length`, `toHaveLength` on checks and name lists: only `greater than 0` forms).

| file / row | verdict |
|---|---|
| `tests/pipelines/template-seed.test.ts` "the template's gitignore ... tracks exactly ..." (the exact rule list) | **turns red; new expected list** has `"!/.agents/SYSTEM/greeting.json"` after `"!/.agents/SYSTEM/SUMMARY.md"` (17 rules), and the title says so. Its second half (every rule is also in the root `.gitignore`) stays true: root line 44 |
| `tests/pipelines/bootstrap-fix.test.ts` "the whole path: scaffold -> draft -> commit -> ob_start" | stays green, **inferred, the row to watch**: its lists are `toContain`; `committed` equals `written` filtered by `tracked`, and the new file is tracked and committed. But the `handleStart` and `cli start` in it now run with the eight default flags ON (budgeted layout, compact state). Its assertions (`## State (state.json rev 0)`, the `Project:` line, `Seat: ... (developer)`, no `NOT A SEAT`, no `this reader's seat is unresolved`, no `ROLE FILE MISSING`) do not name a line the flags change. The metrics row goes to the test's temp `KNOWLEDGE_V2_DB` folder (`tests/setup-env.ts`); `role-reads.local.json` is ignored, so the later `status --porcelain` is still empty |
| same file "scaffold never overwrites: an existing .claude/commands/start.md is kept" | stays green; it is the row that catches m1 |
| same file "the tracking check fires ..." (`problems` matched by regex) | stays green: one more problem line does not break a `toMatch` |
| `tests/pipelines/t251-role-stubs.test.ts` N2 (`verify` ok), N7 (`problems` equals one line) | stay green: with the owner's `/.agents/*` first, the merge appends the SYSTEM block and the exception after it, so git does not ignore the new file |
| `tests/pipelines/t272-seat-checkout.test.ts` S5, S6 (`problems` equals one line) | stay green, same reason |
| `tests/pipelines/g064-developer-seat.test.ts` G1-G3, `tests/pipelines/bootstrap-fix-r3.test.ts`, `tests/pipelines/qa135-bootstrap.test.ts` (scaffold exit 0, then check/draft) | stay green: none lists scaffold's files |
| `tests/pipelines/t328-gitignore-negations.test.ts`, `tests/pipelines/state-import-t297s2.test.ts` G1-G3 | stay green: both compute the expected text from the template file |
| `tests/pipelines/session-start/t297-s3-working-tree.test.ts` (copies the template gitignore) | stays green |
| `tests/pipelines/t329-fresh-start.test.ts` F3 (`Your handoff: none yet (fresh record)`) | stays green: it calls `renderState` without `ownCheckout`. It does not cover the flag-on case named in the table above |
| `tests/pipelines/sync/index.test.ts`, `greeting-size.test.ts` "is among the checks runSync runs", `repo-root.test.ts` | stay green: one more check, no count asserted; on their fixtures (no `state.json`) it is a skip |
| `tests/pipelines/sync/module-boundary.test.ts` | stays green: `checks.ts` already imports `greeting-flags.js` |
| `tests/pipelines/sync/retirements-live.test.ts` | stays green, inferred: `.agents/retirements.json` pins line hashes in `sync/checks.ts`; no pinned line is edited and no added line matches a retired pattern |

New rows, all in the new file `open-brain/tests/pipelines/t353-greeting-default.test.ts` (its own file: the rows
share one git helper, and `t251-role-stubs.test.ts` mocks `node:fs`):

- **T353-1** the template file is exactly the eight-key bytes; none of the four left-out keys; `SCAFFOLD_FILES` has the entry.
- **T353-2** absent: scaffold writes exactly those bytes, reports `copied` / `tracked`, `verify` ok, eight flags read on.
- **T353-3** in the scaffolded real repo `git check-ignore` exits 1 for greeting.json and 0 for `SYSTEM/PRD.md` and
  `SYSTEM/hub-partner-seats.json`; `.gitignore` has the exception line; after a commit `git ls-files` lists the file.
- **T353-4, T353-5a, T353-5b** present with other content, invalid JSON, empty: scaffold throws `holds residue
  (SYSTEM/) ... Nothing written`, the file is byte-unchanged, no `.gitignore` and no `AGENT.md` appear.
- **T353-6** already bootstrapped, old ignore block: scaffold throws `already bootstrapped ...`, no greeting.json,
  `.gitignore` byte for byte, tree clean, and the check gives warning (a). Green at the base for its scaffold half.
- **T353-7** warning (a), exact object, in a repository and outside one, git not asked.
- **T353-8** warning (b), exact object, under the pre-T-353 block; with the exception line added: pass, `8 flag(s) on`.
- **T353-9** no warning: untracked and not ignored (`2 flag(s) on`); tracked by `git add -f` under the old block; committed.
- **T353-10** no record, and a record that does not validate: the two skip objects, git not asked.
- **T353-11** outside a repository: the skip object from an injected answer, and from git itself.
- **T353-12** `runSync` runs it once, right after `task-assignees`; warning (a) is in `warnings`, not in `issues`.
- **T353-13** scaffold, `runDraft`, `runCommit` in a real repo: pass with `8 flag(s) on`, before and after the commit.
- **T353-14** the consequence of the default: in a scaffolded project (no PRD) `syncPrdVersion` returns exactly
  `{ name: "prd-version", severity: "warn", message: "PRD.md not found" }`; with `briefing_problem` written into
  that project's file it is an `issue` (the known positive).

## Steps

1. **Shell.** Windows host: PowerShell, `$env:Path = 'C:\Program Files\nodejs;' + $env:Path`, `$env:NO_COLOR='1'`.
   Linux host: bash, `export NO_COLOR=1`, and use `cp` where a step says `Copy-Item` (backups under `/tmp`). Either way
   `node -v` must print `v22.*`. Say which host you are on.
2. **Branch.** In the clone at START: `git checkout -q -b build/t353`. HEAD must equal START and the porcelain must be
   empty. In `open-brain`: `npm ci` (exit code), then `node -e "require('better-sqlite3')"`; on "Could not locate the
   bindings file" run `npm rebuild better-sqlite3` and say so. Run every `apply.cjs` from the CLONE ROOT.
   - **Forbidden:** stash, reset --hard, force, rebase, amend, other checkouts, test:heavy, `vitest -u`, killing
     processes by name, the real `~/.claude/`, `scripts/setup.mjs`, `git config` writes in the clone (the test rows set
     git config only inside their own temp repositories), any MCP config, `npm install`, any hook registration or
     `settings*.json`, `package.json`, `.github/`, the repo's own `.gitignore` and `.agents/`, and anything under `docs/`.
3. **Apply.** `node docs/loops/t353/apply.cjs . docs/loops/t353/edits.txt` must print exactly
   `APPLIED 10 edits to 6 files`. Then, from the clone root:
   `Copy-Item docs/loops/t353/greeting.json project-template/.agents/SYSTEM/greeting.json` and
   `Copy-Item docs/loops/t353/t353-greeting-default.test.ts open-brain/tests/pipelines/t353-greeting-default.test.ts`.
   `git check-ignore -q project-template/.agents/SYSTEM/greeting.json` must exit 1 (PowerShell: `$LASTEXITCODE`; the
   root `.gitignore` does not ignore the template's file). In `open-brain`: `npx tsc --noEmit` (exit 0),
   `npx tsc -p tsconfig.tests.json --noEmit` (exit 0), `npm run build` (exit 0).
4. **The sixteen files.** In `open-brain`:
   `npx vitest run tests/pipelines/t353-greeting-default.test.ts tests/pipelines/template-seed.test.ts tests/pipelines/bootstrap-fix.test.ts tests/pipelines/bootstrap-fix-r3.test.ts tests/pipelines/qa135-bootstrap.test.ts tests/pipelines/t251-role-stubs.test.ts tests/pipelines/t272-seat-checkout.test.ts tests/pipelines/g064-developer-seat.test.ts tests/pipelines/state-import-t297s2.test.ts tests/pipelines/t328-gitignore-negations.test.ts tests/pipelines/t329-fresh-start.test.ts tests/pipelines/session-start/t297-s3-working-tree.test.ts tests/pipelines/sync/index.test.ts tests/pipelines/sync/greeting-size.test.ts tests/pipelines/sync/module-boundary.test.ts tests/pipelines/sync/retirements-live.test.ts --no-file-parallelism --testTimeout=180000`.
   Expect 0 failed. Paste `Test Files` and `Tests`. A red row here: STOP, `BLOCKED t353 rows <rows>`, with each assertion
   message (expected vs received). The output carries non-ASCII characters: paste it as printed, and if you filter it
   use `grep -a`. T353-11 and the existing BF-6 row both need the temp folder to be outside any git repository; if
   `git -C <temp folder> rev-parse --show-toplevel` prints a path, say so in the reply.
5. **Mutants**, each on the applied tree. Back up once from the clone root (Windows `$env:TEMP`, Linux `/tmp`):
   `open-brain/src/pipelines/bootstrap/index.ts` -> `t353-bs.bak`,
   `open-brain/src/pipelines/sync/checks.ts` -> `t353-ck.bak`,
   `open-brain/src/pipelines/sync/index.ts` -> `t353-ix.bak`,
   `project-template/gitignore` -> `t353-gi.bak`,
   `project-template/.agents/SYSTEM/greeting.json` -> `t353-gj.bak`. Use `Copy-Item` or `cp`, never
   `Get-Content | Set-Content` (it mangles the files' non-ASCII characters).
   For each `docs/loops/t353/mN.txt` (m1-m12): apply (must print `APPLIED 1 edits to 1 files`), run
   `npx vitest run tests/pipelines/t353-greeting-default.test.ts tests/pipelines/template-seed.test.ts --no-file-parallelism --testTimeout=180000`
   in `open-brain` (for **m1 only**, add a second run:
   `npx vitest run tests/pipelines/bootstrap-fix.test.ts -t "scaffold never overwrites" --no-file-parallelism --testTimeout=180000`),
   paste the failed rows, restore that file from its backup (never git checkout). The tests run the sources through
   tsx, so no rebuild between mutants.
   Predicted red (NOT simulated):
   - m1 (the loop's `already exists` skip removed, `bootstrap/index.ts`): NO T353 row; the existing bootstrap-fix row
     "scaffold never overwrites: an existing .claude/commands/start.md is kept and reported as skipped". For m1 the
     STOP rule below counts that row.
   - m2 (`handoff_caps` added to the template file): T353-1, T353-2, T353-13.
   - m3 (`greeting_metrics` dropped from the template file): T353-1, T353-2, T353-13.
   - m4 (the exception line removed, `project-template/gitignore`): the template-seed gitignore row, T353-2, T353-3, T353-13.
   - m5 (warning (a) returned whenever the record is valid, file or no file, `checks.ts`): T353-8, T353-9, T353-11, T353-13.
   - m6 (`--no-index` added, so a tracked file under a matching pattern warns, `checks.ts`): T353-9; T353-11 possibly.
   - m7 (warning (a) made an `issue`, `checks.ts`): T353-7, T353-12.
   - m8 (warning (b) made an `issue`, `checks.ts`): T353-8.
   - m9 (a record that does not validate is judged anyway, `checks.ts`): T353-10.
   - m10 (the check not registered, `sync/index.ts`): T353-12.
   - m11 (every failure of `git check-ignore` read as "not ignored", `checks.ts`): T353-11.
   - m12 (`briefing_problem` added to the template file): T353-1, T353-2, T353-13, T353-14.

   **A mutant with NO red row is a STOP** (`BLOCKED t353 <m> survives`). Other differences from the prediction are not
   a STOP: paste the rows and go on; the planner rules. After the last restore, rerun step 4: 0 failed.
6. **Full suite**, in `open-brain`: `npx vitest run --no-file-parallelism --testTimeout=180000` (60-minute cap). Expect 0
   failed, subject to T-292's flake rule: a red row alongside `Timeout calling onTaskUpdate` or a hook timeout is rerun
   alone up to 3 times, pasting every run. Paste `Test Files`, `Tests`, and the whole `Unhandled Errors` section if any.
   A red `tests/harness/checks.test.ts` D4 is not a STOP: paste its last stderr line and go on; CI judges it. Any other
   red row: STOP, `BLOCKED t353 suite <rows>`, with each assertion message. (Most likely source if one appears: a row
   that scaffolds a project and then asserts a line of its `/start` text or its `/sync` result, now rendered with the
   eight default flags on; or a harness guard on the new test file.)
7. **Sync.** From the clone root:
   `node open-brain/build/cli.js sync 2>&1 | grep -a -E "greeting-flags|module-boundary|retirements|template"`
   (Windows: `Select-String -Pattern "greeting-flags|module-boundary|retirements|template"`). Paste every line.
   `module-boundary` and `retirements` must be `[pass]`; `greeting-flags` must be the pass line with `11 flag(s) on`
   (this repository's own greeting.json has eleven true and `handoff_caps` false).
8. **Commit.** One commit, `T353: bootstrap writes greeting.json for a new project, the template tracks it, /sync warns when it is missing or ignored (T-353)`.
   - Stage exactly the 8 paths: `open-brain/src/pipelines/bootstrap/index.ts`,
     `open-brain/src/pipelines/sync/checks.ts`, `open-brain/src/pipelines/sync/index.ts`,
     `open-brain/tests/pipelines/template-seed.test.ts`, `open-brain/tests/pipelines/t353-greeting-default.test.ts`,
     `project-template/gitignore`, `project-template/.claude/commands/bootstrap.md`,
     `project-template/.agents/SYSTEM/greeting.json`.
   - The message ends with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
   - No git identity on the host and `git config` writes forbidden: commit with GIT_AUTHOR_*/GIT_COMMITTER_* env vars
     (Forge, melvenac@gmail.com).
   - `git log --oneline <START>..HEAD` shows 1 line and the status is empty (if anything else shows, paste it and STOP).
   - `git diff --name-status <START>..HEAD` shows those 8 paths: six `M`, and `A` for the test file and the template's
     greeting.json. `git rev-parse HEAD:project-template/.agents/SYSTEM/greeting.json` must print the same blob id as
     `git rev-parse HEAD:docs/loops/t353/greeting.json` (the committed file is the drafted one, LF, byte for byte).
9. **Push and open the PR**, only on a host that can push. A host that cannot push (the Lenovo, read-only token) stops
   after step 8 and replies `HANDBACK t353 <sha40>`; the planner lands the commit with `job.mjs land`. Do not try to push there.
   - Push, never force. `git ls-remote origin refs/heads/build/t353` must equal HEAD.
   - `gh pr create --base master --head build/t353 --title "T353: bootstrap writes greeting.json for a new project, the template tracks it, /sync warns when it is missing or ignored (T-353)" --body "Brief: docs/loops/t353-brief.md."`.
   - Then `gh pr checks <n> --watch --interval 30` (cap 30 min). Paste every check's name and conclusion.

## Reply

- **First line:** `READY t353 <sha40> PR #<n>`, `HANDBACK t353 <sha40>` (no-push host, steps 1-8 all passed) or
  `BLOCKED t353 <reason>`.
- At most 2 attempts at any step. A STOP still writes the reply. Every number is pasted output, with its command.
  Mark anything not run `NOT RUN`. Name any HIGH, CRITICAL or UNKNOWN impact target from the launcher's prompt and say
  which rows cover its callers. Do not merge.

## After merge (not this run)

`sia-rebuild.sh <mergesha>` (the CLI and the MCP server both run the build; `/sync` through `ob_sync` needs Aaron's
reconnect to carry the new check). Live checks, read-only: (1) `open-brain sync` in this repository prints the
`greeting-flags` pass line with `11 flag(s) on`; (2) in a fleet repo bootstrapped before this change and not yet fixed
by hand, it prints warning (a), or (b) where the file was written under the old ignore block; (3) a scratch project
taken through `/bootstrap` has `.agents/SYSTEM/greeting.json` in its SIA commit and its first `/start` prints the
budgeted briefing.

- **Not changed, by the ruling:** `greetingFlag` and its default (an absent file or key is OFF), this repository's own
  greeting.json, `handoff_caps`, any existing project's `.gitignore` or greeting.json, and `state import --commit`.
- **If the default set changes later:** `docs/loops/t353/greeting.json`, the key list and byte literal in the test
  file, the `8` in rows T353-8/9/11/13 and the words "eight-key" in warning (a) change together.
