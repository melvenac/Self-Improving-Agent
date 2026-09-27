# The `/bootstrap` fix round 3 (`7f4ca74`): QA report (QA 145)

**By:** the QA seat, record session **145**, for T-154. Claude session `2d435934-b252-4378-a6af-04f083861b41`, launched
headless by `docs/loops/qa-145/drive.ps1` (`--model claude-opus-5-5 --effort high`), started 2026-09-27 01:31 UTC.
The stream (`%USERPROFILE%\sia-qa145\run-0.jsonl`), counted just before the report commit, shows `claude-opus-5-5` on
193 of 193 assistant entries. Effort is not recorded per entry there, so "high" is the launch flag, not a count.
**Dispatch:** `docs/loops/bootstrap-fix-r3-dispatch-qa.md` (Atlas, record 146), read at `46efa7e`.
**Machine:** `DESKTOP-0GV3HAD`, Windows 10 Pro 10.0.19045, user `Aaron`, Node v22.23.2. The rulings file calls this
machine the laptop. `drive.meta` recorded `head=46efa7e`, `temp=C:\qa-tmp`, and an empty `defender_exclusions=` line
(the driver's `Get-MpPreference` read returned nothing, so whether `C:\qa-tmp` is excluded is **not known** from here).
**Scratch:** worktrees under `C:\qa-scratch\bf145\` (`cand` and `mut` at `7f4ca74`, `base` at `6543e8e`, plus `qat`,
`qred`, `qmut` and `report` for the pushed branches); temp in `C:\qa-tmp`. No live `state.json` was written. No `/end`.
**Read, and only these:** the dispatch; `docs/loops/bootstrap-fix-rulings-qa135.md`; the developer's handoff, both
acceptance transcripts, and the developer's driver and mutant files on `origin/loop/bootstrap-fix-r3`;
`qa135-bootstrap.test.ts`. The source was read at `7f4ca74` and diffed against `b45900f`.
- **Beyond that list, and said here:** to learn how CI is dispatched and which commit identity QA uses, I read:
  - `.github/workflows/ci.yml`;
  - the CI section (lines 223–240) and the Defects table of QA 135's report on `origin/qa/bootstrap-fix-report`;
  - a `grep` for `npm ci` in `docs/loops/importer-leftovers-qa-report.md`;
  - the author lines of two earlier QA commits.
- None of it was used as evidence for a ruling.

**My rows:** `open-brain/tests/pipelines/qa145-bootstrap-r3.test.ts` (15 rows, blob `7ef880e`). Named here as:

| Name | Row |
|---|---|
| H1 | the hook in (iii-b), `CLAUDE_PROJECT_DIR` = the child |
| H2 | the hook in (iii-b), a drifted cwd |
| H3 | the hook in (iii-a), `CLAUDE_PROJECT_DIR` = the child |
| H4 | the hook in (iii-a), a drifted cwd |
| W1–W3 | the root walker's negatives and SIA's own root |
| F1–F3 | `archive/` (R-BF-15) |
| G1, G2 | `state.json` (R-BF-16) |
| N1 | the nested child, untracked |
| N2 | the nested child, tracked |
| S1 | SCAFFOLDED |

**Branches pushed** (each through `push-qa.mjs`, read back):

| Branch | Commit | What |
|---|---|---|
| `qa/bootstrap-fix-r3-qa-tests` | `2c279ad` | `7f4ca74` + my rows |
| `qa/bootstrap-fix-r3-qa-tests-red` | `9eaaba7` | `4fab7ba` + my rows |
| `qa/bootstrap-fix-r3-mut-q1` | `218e75f` | mutant Q1; never to merge |
| `qa/bootstrap-fix-r3-report` | | this report and `docs/loops/qa-145/` (scripts and evidence) |

## Verdict

**ACCEPT `7f4ca74`.** R-BF-9 to R-BF-13 hold against their rows and their wording. R-BF-14 holds: **the real built
session-end hook, run in install (iii), writes into the child and the parent gains nothing** (on `6543e8e` the same
hook wrote its marker into the parent). R-BF-15 and R-BF-16 hold as ruled. All four installs pass with no manual fix,
by the developer's driver re-run here (77 checks, 0 failed), and that driver fails on `6543e8e` (59 checks, 32 failed),
as the known-positive transcript says. My four required mutants are killed, and so are three of my four extra ones.

Nothing found blocks the merge. Three low defects and one survivor are listed below. The non-record-JSON probe
confirms the planner's reading, and it is in "Open for the planner".

## Check 1: R-BF-9 to R-BF-13, each against its row

**QA 135's file is unmodified.** `git hash-object open-brain/tests/pipelines/qa135-bootstrap.test.ts` at `7f4ca74` is
`85ae260c90869d476f4871100ba30933e3bd7cd8`. `4fab7ba`'s blob is the same, and so is my copy into the `6543e8e` tree.

**Green at `7f4ca74`, red at `6543e8e`, run locally here:**

| Row | `7f4ca74` | `6543e8e` (same file) |
|---|---|---|
| CONTROL (package.json) | ✓ | ✓ |
| D1 no package.json can draft | ✓ | × `expected 'state import refused: no project root…' not to match /no project root found/` |
| D2 child never drafts a parent | ✓ | × `expected [ 'SYSTEM', 'TASKS', …(2) ] to deeply equal [ 'SYSTEM', 'TASKS' ]` |
| D3 not "not a fresh install" after scaffold | ✓ | × `… not to match /not a fresh install/` |
| D4 zero-byte state.json not BOOTSTRAPPED | ✓ | × `… not to match /BOOTSTRAPPED/` |
| CONTROL valid record BOOTSTRAPPED | ✓ | ✓ |
| D5 second move-residue | ✓ | × `expected false to be true` |

At `7f4ca74`, `qa135-bootstrap` plus `bootstrap-fix-r3` ran **29 of 29 green**. At `6543e8e`, 5 failed and 2 passed,
every failure an `AssertionError`. The same five went red on tcm in my run `36287047197`, and green in my run
`36287045804` (CI below).

**Each ruling's wording, read against the code** (`7f4ca74` against `b45900f`):

- **R-BF-9: holds.** `cli.ts`'s import door no longer calls `resolveRepoRoot`. It takes `resolve(positionals[0] ?? ".")`
  and refuses unless that directory holds a `.agents/` **directory**: "never walks up into a parent [...] Nothing
  written." That one `projectRoot` feeds both `runDraft` and `runCommit`. `buildImportDraft` names the project from the
  folder when `package.json` has no name (`name_from: "folder"`), and both the draft summary and the report say so.
  - Beyond the rows: my own install N (below) has a stranger ignore `check`'s STOP and run `state import --draft` in a
    child with no `.agents/`, inside the parent's repository. It refuses and the parent gains nothing. On `6543e8e`
    the same command drafted the parent.
- **R-BF-10: holds.** `agentsState` returns `scaffolded` when `.agents/AGENT.md` carries `SCAFFOLD_SIGNATURE`, checked
  **before** the `TASKS/` test that made D3. `nextStep` says "continue at step 4", and adds the INBOX note when INBOX is
  the template's (line ends normalised). `scaffold` refuses a re-run before its git checks. The importer's
  `inboxWarning` fires on `template_copy`. All three are seen in rows, and my S1 row pins the first and the third.
- **R-BF-11: holds as worded.** `notARecord` returns a reason for zero bytes, whitespace only, not JSON, or a
  `project.name` containing `{{`. Anything else that parses is a record. That last clause is exactly what the
  planner's probe is about (check 4).
- **R-BF-12: holds, with one wording exception on a double-failure path** (defect QA145-D3).
  - `moveResidue` moves each named entry into a **new** folder, suffixed `-2`, `-3` when the dated one exists.
    `archive/` is never among the entries, so nothing nests.
  - A read-back mismatch throws `ResidueReadBackError`, which the CLI prints as `MOVED, but …`. M13's row is in
    `bootstrap-fix-r3.test.ts` and green.
  - The exception: when a move fails part-way AND the undo also fails, the thrown error is a plain `Error`. The CLI
    then prints `bootstrap move-residue refused: … could not be undone: aaa are in .agents/archive/…`, which says
    "refused" after something moved (probe P-UNDO).
- **R-BF-13: holds.** `GitState` carries `empty`:
  - with no git, the folder holds nothing but `.agents` or `.git`;
  - in a repository, there is no commit and every dirty line is under `.agents/`.
  `nextStep` then names `` `git commit --allow-empty -m "The project before SIA"` ``, in both branches. `bootstrap.md`
  step 2.2 names the same command. Install (ii) ran the path.
- **D7 and D8: done.** Step 5 no longer sets SUMMARY's status. The `role-files.ts` comment now says a not-a-seat
  write is applied with the seat null, not refused.

## Check 2: R-BF-14, the root walker attacked

### Every caller, found by searching the source

`git grep -n -E "isProjectRoot|resolveRepoRoot|resolveHookProjectDir|repo-root\.js"` over `7f4ca74`, excluding
`docs/`, `*.md`, `.agents/` and tests, finds **9 call sites in 5 files**. `isProjectRoot` has one caller,
`resolveRepoRoot`.

| # | Call site | Door | Writes into the resolved root? |
|---|---|---|---|
| 1 | `cli.ts:74` | `sync` (CLI); then `runSync` resolves again | yes without `--check` (sync's auto-fixes) |
| 2 | `sync/index.ts:39` `runSync` | CLI `sync`; `ob_sync` (`server.ts:133`); `ob_start`'s greeting-size sync (`server.ts:577`, `checkOnly`) | as #1 |
| 3 | `server.ts:556` `handleScore` | `ob_score` | reads (score history goes to the home side) |
| 4 | `cli.ts:304` | `detach` | git only: `checkout --detach` in the resolved directory |
| 5 | `cli.ts:462` | `state erasures` | read-only |
| 6 | `cli.ts:483` | `state show` | read-only |
| 7 | `cli-session-end.ts:56` | session-end hook, handoff guard | **yes**: `.agents/SESSIONS/.missing-handoff.jsonl` |
| 8 | `cli-session-end.ts:87` | session-end hook, memory stages | the vault summary's `project` label (the vault is home-side) |
| 9 | `repo-root.ts:64` `resolveHookProjectDir` | #7 and #8 | as #7 and #8 |

**The handoff's list (§6.1) left out `state show` and `state erasures`.** Both are read-only, so the omission costs
nothing here, but the list was not complete.

### Is a nearer root ever wrong?

**Yes, by construction, when the nearer directory holds a protocol layout that is not a project.** Probe P-STRAY puts
a stray between a real project `P` (package.json, `.agents/SYSTEM/`, a record) and the cwd `P/packages/x/src`, in
three forms:
- a zero-byte `packages/x/.agents/state.json`;
- a copied record;
- a `packages/x/.agents/SYSTEM/`.

`resolveRepoRoot(packages/x/src)` returns `packages/x` in all three forms, so all 9 call sites answer for the stray.
Two were run:
- `state show` refuses on the stray's JSON;
- `sync --check` scores the stray (in the zero-byte case, `5 passed, 12 warnings, 2 issues`).

On `6543e8e` all three forms resolve to `P`.

**Where such a stray could come from, in this repository:**
- **In SIA's tracked tree, the only NEW root is `project-template/`**, which R-BF-14 accepted. The three test-fixture
  directories (`open-brain/tests/fixtures`, `fixtures-import`, `fixtures-import-a2a-hub`) are roots under both rules,
  because each carries a `package.json` (probe W-roots-in-sia, run on both builds).
- **Nothing in this round writes a protocol layout into a walked-to directory.** `scaffold` and `state import` are
  literal, and the hook's own write is `.agents/SESSIONS/`, which is not a marker.
- **For the hook,** the walk starts at `CLAUDE_PROJECT_DIR`, the launch directory. A stray matters only if a session
  is launched inside it, or if the variable is absent and the cwd has drifted into it.

**I judge this the accepted price of the fail-closed direction, not a defect of R-BF-14.** Two points go to the
planner:
- the zero-byte case: the walker takes a `state.json` that `check` calls NOT A RECORD as a root marker;
- `sync` without `--check` writes into whatever root it resolves.

### SIA's own root, the stray `open-brain/.agents/`, and the home directory

- `resolveRepoRoot` from `<SIA>`, `open-brain/`, `open-brain/src/`, `docs/` and `open-brain/tests/pipelines/` returns
  SIA's root, on both builds (probe W-sia-*, and my row W2 on tcm).
- The stray was made for the probe as `open-brain/.agents/reflection-queue.json` in the scratch worktree, then removed.
  With it, `isProjectRoot(open-brain)` is false, and both `open-brain/src` and the hook resolver go to SIA's root.
  My row W3 pins the same shape in a fixture.
- **Home, the known-negative row (W1):** a fixture home whose `.agents/` holds only `mailbox/` and
  `reflection-queue.json`. It is not a root, and a walk from `home/code/loose/src` returns null. The hook resolver
  keeps the start directory.
  - **This machine's real home has no `.agents/` at all** (`C:\Users\Aaron`), so the desktop's mailbox-only shape
    could only be checked as a fixture. `isProjectRoot(C:\Users\Aaron)` is false.

### The real built session-end hook in install (iii): the deciding row

`docs/loops/qa-145/qa145-probes.mjs`, section P-HOOK (transcripts under `docs/loops/qa-145/evidence/probes-*.md`):
- **Setup:**
  - The install is made through the build's own CLI: git init, the before-SIA commit, scaffold, INBOX edited, and
    `state import --draft` then `--commit`. After it, the child holds its own record.
  - Each project then gets a `loop/*` commit made after a transcript's first timestamp, and no handoff. The hook's
    handoff guard therefore writes its marker into **whichever project the hook resolved**.
  - `HOME`, `USERPROFILE`, `KNOWLEDGE_V2_DB` and `OPEN_BRAIN_VAULT_DIR` point at scratch. The DB was created with the
    build's `openV2Database`, and the vault exists, so the hook went past both of its early exits. It printed
    `Recalled ids: 0 from none`, `Summary: skipped` (no session summary to self-generate in a scratch home),
    `Feedback: 0 entries` and `Invocations: 0 logged`. The only project-side write any stage made is the handoff
    marker. `CLAUDE_PROJECT_DIR` and
    `CLAUDE_CODE_SESSION_ID` were removed from the inherited environment.
- **The run:** `node open-brain/build/cli-session-end.js`, with a `{session_id, transcript_path}` payload on stdin, in
  both (iii-b) (the parent a repository, with its own `loop/parent-work`) and (iii-a) (the parent not a repository).
  Each ran twice:
  - `CLAUDE_PROJECT_DIR` = the child;
  - no `CLAUDE_PROJECT_DIR`, cwd `child/csvtool/`.

| Build | (iii-b) env | (iii-b) drifted cwd | (iii-a) env | (iii-a) drifted cwd |
|---|---|---|---|---|
| **`7f4ca74`** | exit 0; `HANDOFF MISSING … loop/child-work`; marker in the **child**; parent files, git status and refs unchanged | same | exit 0; marker in the child; parent unchanged | same |
| `6543e8e` | `HANDOFF MISSING … loop/parent-work`; marker written into the **PARENT** (`.agents/SESSIONS/.missing-handoff.jsonl`) | same | `handoff check NOT RUN: git could not list local branches here` (it resolved the parent); the child gets nothing | same |

**R-BF-14 holds.** The candidate's probe run was 43 rows, 0 failed. On `6543e8e` it was 42 rows, 13 failed. It has one row
fewer because `project-template/` is not a root there, so the list of roots in SIA's tree is one shorter. The two
setup rows fail on `6543e8e` because its import walked to the parent (D2), so the child never got a record. My mutant Q1 (`isProjectRoot` reverted to `b45900f`'s rule) turns the
built-hook rows red again, with the marker back in the parent, so the rows decide on this function and not on
something else. My vitest rows H1–H4 carry the same check, run through `tsx` on the source, onto tcm (CI below).

## Check 3: R-BF-15

- **F1:** an `archive/` that already holds `old-notes/n.md` and an older `pre-bootstrap-residue-1999-01-01/` is
  untouched by `move-residue`, byte for byte. The one new folder holds only `reflection-queue.json`, and `.agents/`
  is left holding only `archive/`.
- **F2:** a second move on the same day goes to `…-2`. Each folder holds only its own entry.
- **F3: a TRACKED, modified file under `.agents/archive/` still counts as dirty**, and an untracked one beside it does
  not.
  - `check` says `1 uncommitted change(s)`, and `Next` says to commit it.
  - `scaffold` refuses, naming ` M .agents/archive/notes.txt`.
  - The filter drops only `?? ` lines, as the planner read.
  - My mutant Q5 (the filter widened to tracked lines) is killed by this row alone. No other row, the developer's
    included, sees it.

## Check 4: R-BF-16

- **G1:** a parseable `state.json` is never moved, even with residue beside it. `check` says BOOTSTRAPPED, and
  `move-residue` refuses with `.agents/ is bootstrapped, not residue — nothing moved`. The file is byte-identical and no
  `archive/` is made. Mutant Q3 is killed by G1, and by the developer's older `bootstrap-fix.test.ts` row.
- **G2:** a **tracked** zero-byte `state.json`:
  - `check` says `NOT A RECORD — state.json is zero bytes`;
  - `Next:` names restore-from-git: `` `git checkout -- .agents/state.json` ``;
  - `move-residue` exits 0 with `Entries: state.json`;
  - `git status --porcelain` shows ` D .agents/state.json`, and the zero-byte file is in the archive;
  - the next `check` says to commit the removal on its own.

### PROBE (reported, not failed): JSON that parses and is not a record

**Confirmed: every one reads BOOTSTRAPPED**, as the planner read the code. Each was run through the build's `check`,
`handleStart` (the `ob_start` behind `/start`) and `move-residue`, with no git and no other files (evidence
`probes-cand-7f4ca74.md`, P-JSON).

| `state.json` | `check` | `/start` (`handleStart`) | `move-residue` |
|---|---|---|---|
| `{}` | BOOTSTRAPPED; "Already bootstrapped. Run /start." | **refuses:** `STATE RECORD REFUSED: schema_version: Invalid input: expected 3.` "NOT falling back to the prose files", `isError: true` | refused (bootstrapped) |
| `{"project":{}}` | same | same refusal | refused |
| `[]` | same | **does not refuse:** `state.json invalid at $: Invalid input: expected object, received array — falling back to files`, then a greeting built from the prose files (all absent here), `isError: false` | refused |
| `null` | same | same fallback (`received null`) | refused |
| `42` | same | same fallback (`received number`) | refused |
| `"text"` | same | same fallback (`received string`) | refused |
| `true` | same | same fallback (`received boolean`) | refused |

So a stranger in this state is told "Run /start", and `/start` goes one of two ways:
- **for an object:** it refuses, with a message about rebuilding the build ("This build cannot read this record's
  schema version"), which is the wrong remedy for a file that is not a record;
- **for a non-object:** it quietly greets from the prose files, the fallback its own object branch refuses to take.

`move-residue` cannot set any of them aside. R-BF-11's wording ("parses") is met, so this is not a round-3 defect.
It is in "Open for the planner".

## Check 5: the acceptance, re-run

**The developer's driver was validated against `6543e8e` first.** I took
`docs/loops/dev-scripts-bf-r3/accept-bf-r3.mjs` from `origin/loop/bootstrap-fix-r3` (blob `79dd7b0`) and copied it,
unmodified, into a `6543e8e` worktree built and stamped `6543e8e8…`. Result: **59 checks, 32 failed**, exit 1, the same
count as the developer's known-positive transcript. The failures:
- D3: the resume check says PRE-STATE in all four runs;
- D6: no `--allow-empty` in (ii);
- D1: the import refuses in (ii), with no record;
- D2 in full, in (iii-a) and (iii-b): the parent's `SUMMARY.md`, `INBOX.md` and `task.md` rewritten, a migration
  snapshot and a `state.json` written into the parent, and in (iii-b) the parent's `git status` gained ` M` and `??`
  lines under `.agents/`.

Then the same driver on `7f4ca74`, built and stamped `7f4ca741…`: **77 checks, 0 failed**, exit 0.
**(e) "no manual fix: every step taken was the one check's Next named" in all four runs**:
- (i) frogger's shape;
- (ii) an empty folder;
- (iii-a);
- (iii-b).

Both transcripts are in `docs/loops/qa-145/evidence/accept-*.md`.

### My own install (N): a child inside the parent's repository that is NOT its own repository

`docs/loops/qa-145/qa145-install-n.mjs` sets up:
- the parent: a repository with `package.json`, `.agents/SYSTEM/`, `TASKS/` and a committed `index.js`;
- the child: `tools/csvtool/` with `pyproject.toml`, untracked, and not a repository.

The same shape, with the child's files tracked by the parent, is my vitest row N2.

| Step | `7f4ca74` |
|---|---|
| `check` | `git: inside another repository at C:/qa-tmp/…/node-parent`; **`Next: STOP: this folder is inside another repository (C:/…/node-parent). Bootstrap a project at its own repository root.`** |
| The stranger ignores STOP: `scaffold` | refused, "inside another git repository (…) — bootstrap a project at its own repository root. Nothing written" |
| `state import --draft` | refused, "has no .agents/ directory [...] never walks up into a parent" |
| `move-residue` | refused |
| The parent | unchanged, files and `git status` |
| **`git init` in the child** | **not named by any `Next:`**. It is the only reading of "at its own repository root". Counted as a manual fix |
| From there on | every step is the one `Next` names (the before-SIA commit, scaffold, SCAFFOLDED to step 4, draft `Project: csvtool — the folder's name`, commit, BOOTSTRAPPED). The parent's files are unchanged, and its `git status` stays `?? tools/` |

**`check` STOPs, and it names the enclosing repository. What to do, it names only as a goal.** `bootstrap.md` step 1
says the same and no more: "If `git:` says `inside another repository`, **stop**: bootstrap a project at its own
repository root." This is defect QA145-D1 (low). The handoff §7 recorded it honestly as a limit.
- 15 checks, 1 failed: the `bootstrap.md` line.
- On `6543e8e` the same script had 8 failures: the stranger's `state import --draft` walked up and drafted the parent,
  and the later commit rewrote the parent's `.agents/`.

## Mutants (mine)

`docs/loops/qa-145/qa145-mutants.mjs`, in the `mut` worktree at `7f4ca74` plus my test file. For each mutant:
- the anchor matched exactly once, and the edit landed;
- `tsc --noEmit` exited 0, and the build was rebuilt;
- 5 test files ran through vitest's JSON reporter (74 rows): `qa145-bootstrap-r3`, `qa135-bootstrap`,
  `bootstrap-fix-r3`, `bootstrap-fix` and `sync/repo-root`;
- the probe script ran on the mutated build;
- the file was restored with git, and its blob checked equal to `7f4ca74`'s (`restored=true` on all 8). The build
  was rebuilt at `7f4ca74` afterwards.

Every kill is an `AssertionError`.

| Mutant | Rows red | Killed by |
|---|---|---|
| **Q1** `isProjectRoot` reverted to `b45900f`'s rule (required) | 5 tests + 11 probe rows | **my H1–H4 (the hook: `HANDOFF MISSING … loop/parent-work`, marker in the parent)**; the built-hook probe rows; the developer's root-walker row |
| **Q2** `archive/` treated as residue (required) | 11 | my F1, F2, F3, G2; the developer's NOT A RECORD rows (3) and second-move row; three older `bootstrap-fix.test.ts` rows |
| **Q3** `move-residue` accepts a parseable `state.json` (required) | 2 | my G1; an older `bootstrap-fix.test.ts` row |
| **Q4** the `SCAFFOLDED` state removed (required) | 4 | my S1; the developer's two SCAFFOLDED rows; QA 135's D3 |
| Q5 `gitState`'s archive filter hides tracked changes | 1 | **only my F3** |
| **Q6** `isProjectRoot` without the `.agents/state.json` clause | **0: SURVIVED** | nothing, mine included (QA145-D2) |
| Q7 the `{{…}}` seed check removed | 1 | the developer's seed row |
| Q8 `state import` walks up again (`resolveRepoRoot ?? literal`) | 3 | the developer's subdirectory refusal; **my N1 and N2** (so the handoff's "killed by one row" is now three) |

**Q6's survival:** after a bootstrap, `.agents/SYSTEM/` always exists, so the new `state.json`-only clause is never
what makes a real project a root in any install run here. It matters for a record-only `.agents/`, and for the stray
case above, where a zero-byte file becomes a root.

## CI (tcm) and the local control run

**The developer's runs, re-read here per test** (`gh run view --log`, logs kept under the scratch evidence):
- **`36282324821`** at `a51972a` (`loop/bootstrap-fix-r3-red`): failure.
  - `Test Files 2 failed | 87 passed (89)`; `Tests 20 failed | 1348 passed | 2 skipped (1370)`.
  - 20 `FAIL` lines: 15 in `bootstrap-fix-r3.test.ts` and QA 135's D1–D5. All 40 error lines are `AssertionError`.
  - **The runner was `tcm-2`, not `tcm-1` as handoff §2 says** (the log's "Runner name: 'tcm-2'", machine `tcm`).
- **`36282961647`** at `7f4ca74`: success, `tcm-1`, machine `tcm`.
  - The Typecheck step ran (`npx tsc --noEmit`) and the job succeeded.
  - `Test Files 89 passed (89)`; `Tests 1368 passed | 2 skipped (1370)`.
  - `bootstrap-fix-r3.test.ts (22 tests)` ✓ and `qa135-bootstrap.test.ts (7 tests)` ✓.

**My runs (3 of 6):**

| # | Run | Ref / SHA | Result |
|---|---|---|---|
| 1 | `36287045804` | `qa/bootstrap-fix-r3-qa-tests` = `2c279ad` (`7f4ca74` + `qa145-bootstrap-r3.test.ts` only) | **success**, `tcm-2`, machine `tcm`, Typecheck step ran: **Test Files 90 passed (90); Tests 1383 passed \| 2 skipped (1385)**. `qa145-bootstrap-r3.test.ts (15 tests)` ✓, `bootstrap-fix-r3.test.ts (22 tests)` ✓, `qa135-bootstrap.test.ts (7 tests)` ✓. It reconciles: 1370 + 15 = 1385; 89 + 1 = 90 files |
| 2 | `36287047197` | `qa/bootstrap-fix-r3-qa-tests-red` = `9eaaba7` (`4fab7ba`, i.e. `6543e8e` + QA 135's file, + mine) | **failure, as intended**, `tcm-1`: **Test Files 2 failed \| 87 passed (89); Tests 17 failed \| 1344 passed \| 2 skipped (1363)**. The 17 are QA 135's D1–D5 and 12 of my 15 (H1–H4, F1–F3, G1, G2, N1, N2, S1); W1–W3 pass, as negatives should. 1341 + 7 + 15 = 1363. Every failure is an `AssertionError`. **On Linux the old hook named the parent too:** 12 printed lines of `HANDOFF MISSING: … on loop/parent-work` |
| 3 | `36287048514` | `qa/bootstrap-fix-r3-mut-q1` = `218e75f` (`2c279ad` + mutant Q1, `isProjectRoot` reverted to `b45900f`'s rule) | **failure, as intended**, `tcm-2`: **Test Files 2 failed \| 88 passed (90); Tests 5 failed \| 1378 passed \| 2 skipped (1385)**. Exactly my H1–H4 and the developer's root-walker row. H (iii-b) fails with `AssertionError: [session-end] HANDOFF MISSING: … on loop/parent-work`, and H (iii-a) with `expected '[session-end] handoff check NOT RUN: …' to match /HANDOFF MISSING/` |

**Runs used: 3 of 6.** `test-windows` was not requested. No laptop CI.

**The one local full-suite control** was run on `7f4ca74` plus my file, under the default TEMP
`C:\Users\Aaron\AppData\Local\Temp`, so Defender stayed in play. Result: **Test Files 1 failed | 89 passed (90);
Tests 1 failed | 1384 passed (1385)**, exit 1, 202 s.
- The one failure is `session-start/tree-currency.test.ts` "reports BEHIND with the commit count and both record
  revisions", `Test timed out in 5000ms`.
- It is the same row and signature the developer (§4) and QA 135 recorded. The file is not in this round's diff.
- My three bootstrap files were green in it: `qa145-bootstrap-r3` 15, `bootstrap-fix-r3` 22, `qa135-bootstrap` 7.
- The load was partly mine: my install-N runs overlapped the first part of it. I record it as a Windows timing
  result, not a candidate defect. It was not re-run, since one control run is allowed.
- There were 0 local skips where tcm has 2, as QA 135 also saw.

## What could not be verified

- **`/start` in a fresh Claude session.** (c) and my JSON probe call the build's `handleStart` from a script, as the
  developer's driver does. No stranger-run.
- **The home directory with a mailbox-only `~/.agents/`** as it exists on the desktop: this machine's home has no
  `.agents/`, so that row is a fixture. The desktop's real home was not reachable from here.
- **Whether `C:\qa-tmp` is excluded from Defender:** `drive.meta`'s `defender_exclusions=` is empty. The driver's read
  may have lacked the rights, so an empty value is not evidence of no exclusion.
- **The CLI's `MOVED, but …` branch** is still reached only by reading (the developer's survivor). My P-UNDO probe
  applies the CLI's own branch logic to what `moveResidue` threw; it does not run the CLI with a failing rename.
- **`gitnexus`** was not available (dispatch). The caller list comes from `git grep` over the source at `7f4ca74`.

## Defects

| Id | Severity | What | Where | Evidence |
|---|---|---|---|---|
| **QA145-D1** | Low | A child inside another repository gets STOP, and the only remedy it names is the goal ("Bootstrap a project at its own repository root"). No `Next:` and no `bootstrap.md` line names a step (for example `git init` here, or move the folder out). A stranger has to infer `git init`, one manual fix. Pre-existing BF-6 wording, and not a round-3 regression, but the dispatch asks that `check` "name what to do" | `bootstrap/index.ts` `nextStep` (the `nested` line); `bootstrap.md` step 1 | install N (15 checks, 1 failed; manual fix: `git init`); rows N1, N2 |
| **QA145-D2** | Low (test coverage) | The widened `isProjectRoot`'s `.agents/state.json` clause is tested by no row, and it counts a state.json that `check` calls NOT A RECORD (zero bytes) as a root marker | `shared/repo-root.ts` `isProjectRoot` | mutant Q6 survived 74 rows and the probes; P-STRAY zero-byte row |
| **QA145-D3** | Low | R-BF-12's "never say refused after moving" fails on one path. If a move fails part-way and putting the moved entries back also fails, `moveResidue` throws a plain `Error`, and the CLI prints `bootstrap move-residue refused: residue move failed (…) and could not be undone: aaa are in .agents/archive/…/, the rest in .agents/`. The body is accurate; the "refused" prefix is not | `bootstrap/index.ts` `moveResidue`'s inner catch; `cli.ts` move-residue catch | probe P-UNDO (an injected rename; `aaa/` was moved aside and not put back) |

## Disagreements

- **With handoff §2:** red run `36282324821` ran on `tcm-2`, not `tcm-1`. The result is as reported.
- **With handoff §6.1's caller list:** it names `sync`, `ob_score`, `detach` and the session-end hook, and omits
  `state show` and `state erasures`. Both are read-only, so nothing turns on it, but the list was taken from a stale
  index, and the source has 9 call sites.
- **With handoff §5's note that walk-again is "killed by one row":** true of the developer's rows. With QA 145's N1
  and N2 it is three.
- None with the rulings. R-BF-14 to R-BF-16 hold as the planner derived them. The planner's own read of `moveResidue`
  and the `archive/` filter is confirmed by rows F1–F3, G1 and G2.

## Error entries (mine)

- **Two assertions of mine were wrong on first run, and were fixed before any push.**
  - W1 expected `resolveRepoRoot` to accept a `package.json` in an ancestor of the start directory. The fallback takes
    only the start directory's own `package.json`, as its comment says.
  - N expected the scaffold refusal to read "inside another repository". It reads "inside another **git**
    repository".
- **My first run of install N counted "check names the enclosing repository" as failed.** `check` prints git's
  forward-slash path, and I compared against the Windows form. Fixed in the script; the committed transcript is the
  re-run.
- **One inline `node -e` edit with `\n` inside a template string failed its own anchor check.** This is the family
  the developer's §8 names. I moved to the Edit tool; nothing was written by the failed attempt.
- **My probe script's P-UNDO section was changed after the candidate run** (an `instanceof` guard for `6543e8e`, which
  has no `ResidueReadBackError`). After the edit I re-ran the candidate
  probes with the final script: 43 rows, 0 failed, the same as before. That re-run is the committed transcript. The
  mutant runs and the `6543e8e` run used the final script.
- **The local control run overlapped my install-N runs** (see the control-run note above). I started install N
  while the control was running, which put my own load on the one run meant to measure the machine.
- **`/sync` before the report commit:** the slash command was not available here, so I ran the candidate build's
  `sync --check .` in the report worktree (`46efa7e` + this report). Result: **22 passed, 3 warnings, 2 issues**.
  - `retirements`: `ENTITIES.md` names retired terms.
  - `state-schema`: `state.json invalid at schema_version: expected 3`. The `7f4ca74` CLI is older than the record on
    this dispatch's commit.
  - Neither comes from this commit, which adds only `docs/loops/` files. I committed on it without gating, and say so.
- **A process note, not a defect:** my commits use the per-command identity `QA 145 (Claude) <melvenac@gmail.com>`
  (`git -c`), as QA 134's did. This machine has no global git identity, and none was set.

## Open for the planner

1. **The non-record JSON probe (check 4): confirmed, and `/start` splits on it.**
   - `{}`, `[]`, `null`, `42`, `"text"`, `true` and `{"project":{}}` all read BOOTSTRAPPED, "Run /start".
   - `/start` refuses the two objects with a "rebuild this build" message, which names the wrong remedy.
   - It falls back to the prose files for the five non-objects, with `isError: false`.
   - `move-residue` cannot set any of them aside.
   - **My recommendation:** a one-clause change to `notARecord` (not an object, or an array → "not a record: JSON
     `<type>`"). The five non-objects then get NOT A RECORD, the restore-or-move-aside `Next:`, and a working
     `move-residue`. Whether `{}` (an object with no `schema_version`) should also be NOT A RECORD is the planner's
     call. Checking `schema_version` is present would catch it without re-running the schema. The `/start` fallback
     for non-objects predates this round, and is probably its own task.
2. **The stray-between case (check 2).** A protocol layout between a real project and the cwd (`.agents/SYSTEM/`, or
   any `.agents/state.json`, even zero bytes) now wins the walk for all 9 call sites. That includes `sync` without
   `--check`, which writes. I judge this the accepted cost of R-BF-14's fail-closed direction. Two narrowings are
   available if the planner wants them, neither needed for this merge:
   - count `.agents/state.json` as a marker only when it is a record (QA145-D2's clause, and one row);
   - have `sync`'s auto-fix refuse when the resolved root is not the directory it was given and is inside another
     root.
3. **QA145-D1 wording:** whether the nested STOP should name `git init` (the child becomes its own project) or moving
   the folder out. Both are defensible, and `check` cannot know which the owner means, so naming both may be the
   honest `Next:`.

QA-145: REPORT COMPLETE
