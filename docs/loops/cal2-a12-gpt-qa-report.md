# A12 calibration rerun — GPT QA report (record 169)

## What I read

### Intended, allowed reads

- `3f71e7e:docs/loops/cal2-a12-dispatch-qa.md`.
- `3f71e7e:docs/loops/loop-15-slice-3-rulings-20.md`.
- `a69f07d:docs/loops/loop-15-slice-3-a12-developer-handoff.md`.
- `7200e1c:open-brain/src/harness/configwatch.ts`,
  `open-brain/src/harness/runtime.ts`,
  `open-brain/tests/harness/configwatch-a12.test.ts`, and
  `.github/workflows/ci.yml`.
- `origin/qa/loop-15-slice-3-a11-report` (`cc4b185`):
  `docs/loops/loop-15-slice-3-qa-report-a11.md`.
- `qa/loop-15-slice-3-a11-probe` (`5564ef6`): the commit diff and all 15 added
  probe files (`qa89-*`, `qa92-*`, `qa94-*`, `qa96-*`, `qa99-*`, `qa104-*`,
  `qa108-*`, and `qa130-a11-probe.test.ts`). They were then run byte-exact.
- `origin/qa/loop-15-slice-3-a11-fix-q130` (`0cb509f`), only its
  `configwatch.ts` diff, as R90 required: read, not copied.
- Candidate ancestry and diffs among `bbf9d07`, `afe1c3b`, `974eade`,
  `7200e1c`, and `a69f07d`; merge parent `ebda33d`.
- R93 developer-mutant diffs `3e3e420` and `6546937`; these were read only to
  reconstruct the two remaining adopted protections after my first independent
  R93 mutant.
- `3f71e7e:docs/loops/qa-169/push-qa.mjs`,
  `7200e1c:.claude/commands/sync.md`,
  `.agents/skills/self-improving-agent-gotchas/SKILL.md`, and
  `C:/Users/melve/.claude/skills/gitnexus-impact-analysis/SKILL.md`.
- CI logs, per test, for runs `36297550532`, `36297589562`, `36297626039`,
  `36297655126`, `36297686010`, `36297707976`, `36298830897`, and
  `36298858638`.

### Accidental blind-list reads

This run is contaminated and must be discounted accordingly.

1. The supplied workspace was `sia-qa-gpt`, not `sia-qa2-gpt`, and the named
   rerun dispatch was absent there. Before fetching and locating `3f71e7e`, I
   read `c917c4b:docs/loops/cal-a12-dispatch-qa.md`, the first-attempt dispatch.
   It disclosed the first attempt's record/branch names and otherwise nearly
   identical scoring instructions, but no first-attempt report or result.
2. Later, three searches intended for `sia-qa2-gpt-cand` were silently scoped
   by the tool to the old `sia-qa-gpt` workspace. One result exposed excerpts
   from the prohibited `c917c4b:docs/loops/loop-15-slice-3-rulings-21.md`,
   including its verdict and the outline of A12-1. I stopped reading that file,
   continued as the dispatch directs after an accidental read, and independently
   reproduced the defect below on tcm.
3. Those mis-scoped searches also surfaced snippets (not whole-file reads) from:
   `scripts/setup.mjs`; `project-template/.agents/skills/playwright-tester/SKILL.md`;
   `open-brain/src/{cli.ts,cli-bootstrap.ts,cli-session-end.ts,trigger/write-schema.ts,pipelines/sync/checks.ts}`;
   `open-brain/scripts/{backfill-success-rate.mjs,copy-build-assets.mjs,dashboard.mjs,shadow-backfill.mjs,write-build-info.mjs}`;
   `open-brain/tests/{vault-archive.test.ts,vault-writer.test.ts}`;
   `open-brain/tests/trigger/{fires,floor,hook,negatives,no-network,query}.test.ts`;
   `docs/loops/{sia-mailbox-forge-to-atlas.md,loop-15-slice-3-rulings-9.md,loop-15-slice-3-rulings-16.md,loop-15-slice-3-rulings-17.md,loop-15-slice-3-rulings-20.md,loop-15-slice-3-qa-report-a7.md}`;
   and `docs/loops/qa-scripts-a7/{qa96-b2.test.ts,tabmut7.mjs}`.

I did not read or contact the other rerun seat, any A13 material, QA 149's
report, the first attempt's report/branches, or the planner-session-146 notes.

## Findings

**VERDICT: REJECT.**

A12's requested R90 words pass, but its new R90 early `continue` bypasses the
ordinary restore/unrestored handling. An absent path that is unobservable at
close remains in place, is omitted from `unrestored`, and is falsely reported
as put back. `runtime.ts` therefore misses R77's pre-git stop and performs six
git calls before rejecting the stage. This is a reachable regression in the
exact branch A12 added.

### Candidate and row-set run — `36297550532`

- tcm, typecheck passed.
- Totals: **12 files failed, 105 passed; 17 tests failed, 1567 passed,
  5 skipped (1589)**.
- The 17 reds separate as: 14 carried assertions already documented obsolete
  by QA 130, CA-9 (T-182), the new Q130 regression below, and my duplicate
  CAL169 regression row. No obsolete row or CA-9 was scored as an A12 defect.
- QA 130's own 15-row file: **14 passed, 1 regressed**. The regressed row is
  `Q130-R83-SUBDIR-NOSEARCH-PLANT`.

### R90

Pass on its stated words, but reject on the reached R77 regression.

- `R90-STATEHASH`, `R90-ABSENT-UNOBSERVABLE`,
  `Q130-R85-REPO-UNREADABLE-ZEROED`, and
  `Q130-R83-DOTGIT-NOSEARCH` all passed in `36297550532`.
- Observed repository side:
  `absent → unobservable (EACCES); unreadable (EACCES); no facts: lstat failed`;
  kind is `modified`; there is no invented type, zero, or `created`.
- My R90 mutant removed the no-facts guard. Run `36297589562` killed it in both
  `R90-STATEHASH` and `Q130-R85-REPO-UNREADABLE-ZEROED`; observed text reverted
  to `unreadable (EACCES); type file dev null ino null nlink 0 size 0 mtimeNs 0`.

### R91

Pass.

- `R91-VIA-FACTS` and byte-exact `Q130-R85-VIA-FILE000` passed in
  `36297550532`. The side contained both the parent-link inode and
  `resolves to: type file ... ino <file inode>`.
- My mutant dropped the file facts. Run `36297626039` killed it in both rows;
  the received side ended after the link's `readlink`, omitting the expected
  file inode.

### R92

Pass.

- `R92-ABSENT-ANCESTOR` and byte-exact
  `Q130-R86-ABSENT-ANCESTOR-LINK` passed in `36297550532`.
- My mutant removed `ancestorLinkText` from the absent branch. Run
  `36297655126` killed it in both rows; the received side retained only
  `absent → symlink ...; <resolved file facts>` and omitted the expected link
  inode.

### R93

Pass: all three adopted rows pass on the candidate and each protection killed
a mutant on tcm.

- Candidate `36297550532`: `R93-STAT-FACTS`, `R93-LSTAT-AT-OPEN`, and
  `R93-PARENT-LINK` all passed. Their matching byte-exact QA rows passed too.
- Facts-drop mutant `36297686010`: killed by `R93-STAT-FACTS` and
  `Q108-R79-FILE000-ALONE`; received
  `unobservable (EACCES); no facts: realpath failed`.
- Lstat-open mutant `36298830897`: killed by `R93-LSTAT-AT-OPEN` and QA 130's
  open-failure rows.
- Parent-link mutant `36298858638`: killed by `R93-PARENT-LINK` and
  `Q130-R85-VIA-TARGET000`.

### R94

Pass.

- `afe1c3b` is a merge with parents `bbf9d07` and `ebda33d`, named
  `Merge origin/master into A12 (R94)`.
- The resolved workflow contains both Linux
  `npm test -- --reporter=verbose` and `test-windows:`.
- My static row passed in `36297550532`. My mutant removed the reporter flag;
  `CAL169-R94` killed it in `36297707976`.

### R85 whole-file search and effect trace

The handoff's table matches the implementation's side builders: `stateHash`,
the close record and message, `factText`, `readText`, `linkSide`,
`ancestorLinkText`, `unobservableSide`, `currentSide`, `baseText`,
`stageBefore`, unobservable/type-change/stable/absent rows, and the unrestored
text. Failed lstat/stat, link, and absence outputs are accurately listed.

The table itself exposes the missed effect: for the new close branch it says
“No removal” and, at `unrestored`, “not reached for this failure.” Following
that result outside `configwatch.ts`:

1. `closeAndRestore()` records a change and executes `continue` before removal
   or an `unrestored.push`.
2. It returns `ok: false` but `unrestored: []`, while its message chooses
   `Every file was put back by bytes before any git call read the repository.`
3. `runtime.ts` early-stops only for `ancestorLink`, `unrestored`, or
   `unlisted`. With all three empty it calls `closeRefWindow()` and
   `enforceAllowlist()` before the later `configBad` rejection.
4. The measured result is six git calls after the role.

The text inventory is complete; the claimed effect is not safe.

## Defects

### A12-1 — HIGH — unobservable created path falsely restored; R77 pre-git stop lost

Row: byte-exact `Q130-R83-SUBDIR-NOSEARCH-PLANT`.
Run: `36297550532`.

Exact material output (temporary prefix shortened only to `<tmp>`):

```text
change={"path":"<tmp>/.git/hooks/q130-sub/planted","kind":"modified",
"before":"absent","after":"unobservable (EACCES); unreadable (EACCES); no facts: lstat failed"}
plantStill=true
failure.code="stage-changed-config"
failure.reason="... Every file was put back by bytes before any git call read the repository. ..."
gitAfterRoleCount=6
unrestored=[]
```

The six calls printed by the probe are:
`git for-each-ref`, `git symbolic-ref HEAD` twice,
`git rev-parse HEAD`, `git status`, and `git symbolic-ref HEAD`.

This violates earlier R77 (“anything still unrestored ... ends the stage before
git”) and makes a false restoration claim. R90 only forbids saying
`a other was created`; it does not license dropping the unrestored fact.

My `CAL169-R90-R77` row independently confirmed the same missing per-path
entry for `config.worktree`: the change was
`absent → unobservable (EACCES); unreadable (EACCES); no facts: lstat failed`,
the path was absent from `unrestored`, and the row failed. That particular
plant also made sibling paths unrestorable, so those siblings stopped git; the
QA 130 row above is the clean demonstration of the lost stop.

## What could not be verified

- No Windows/laptop run, as dispatched.
- No local suite, local Vitest, or local build.
- GitNexus impact/detect-changes tools were unavailable, and `/sync` confirmed
  this worktree has no `.gitnexus/`; graph blast radius could not be verified.
- The two final R93 CI rows are reported from their completed logs; no ninth
  run was available or needed (the eight-run cap was reached).

## Error entries

1. Blindness errors: the first-attempt dispatch and excerpts from rulings 21
   were accidentally read, as itemized in the first section. The latter
   exposed another scorer's verdict before my CI result; this report is not a
   clean calibration sample.
2. I initially created the candidate worktree from the old workspace because
   the supplied workspace path and requested seat name disagreed. All actual
   edits, branches, pushes, and CI work then used `sia-qa2-gpt-cand` and the
   record-169 push gate.
3. My first independent regression row used `.git` mode 0600 and therefore
   produced collateral unrestored siblings. I kept it as corroboration but
   used QA 130's byte-exact subdirectory row for the isolated defect and exact
   six-git-call observation.
4. `/sync --check` before every commit consistently reported pre-existing
   retirement and greeting-size issues, warnings for vault parity,
   spec provenance and master CI, and skipped GitNexus/build-freshness checks.
   It changed no files.

## Model

Cursor shows **GPT-5.6 Sol** for this chat.

CAL-169: REPORT COMPLETE
