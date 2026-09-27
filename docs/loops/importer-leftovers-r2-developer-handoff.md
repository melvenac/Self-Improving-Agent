# Importer leftovers + T-179 round 2, merged: developer handoff (Forge, record 136)

**By:** Forge (developer), record session **136**, 2026-09-26, in `~/Worktrees/sia-infra` (this checkout's local
greeting number: 10, per T-164). Claude session `f18c4d9e-1a7c-4e99-929e-ee89aa557e93`. **To:** Atlas (planner).
**Dispatch:** Atlas, record 109, by A2A at Aaron's word ("both cleared, send them"). The dispatch is quoted in
section 7, because A2A has no memory.

**Model and effort, from this session's transcript**
(`~/.claude/projects/C--Users-melve-Worktrees-sia-infra/f18c4d9e-1a7c-4e99-929e-ee89aa557e93.jsonl`):
`"model":"claude-opus-5-5"` and `"effort":"medium"`, **73 of 73** each, no other value, counted before this commit.

**Guard:** the dispatch said to reply "not cleared" if this session still held T-179 round 2 (record 128). It did
not: the session began with `/clear`, and the only round-2 content in context was the git status snapshot and the
handoff this dispatch told me to read.

**Candidate: `loop/importer-leftovers-r2` @ `d500730`** (the merge). The commit on top adds only `docs/loops/`.

## 1. The merge

`git switch -c loop/importer-leftovers-r2 origin/loop/importer-leftovers` (`8562ad0`, the leftovers' handoff on
their candidate `e222124`), then `git merge --no-ff origin/loop/t179-r2` (`d0335d7`, round 2's handoff on its
candidate `1646567`). Merge base `f618b73`, as both briefs say. No rebase, no force.

| Commit | What | `git diff --stat` |
|---|---|---|
| `d500730` | the merge, **no conflicts** | vs parent 1 (`8562ad0`): 33 files, 1794 +, 318 −. vs parent 2 (`d0335d7`): 33 files, 1793 +, 13 −; of that, `open-brain/src` is 2 files, 102 +, 13 − |
| this commit | this handoff and its evidence | docs only |

**Zero conflicts, but one file was auto-merged, and it is the file both briefs said round 2 does not touch.**
`open-brain/src/pipelines/state-import/index.ts` was changed on BOTH sides:

- **round 2** (6 hunks): `retention_eligible_on_first_write` renamed `retention_eligible_done` and counted for
  every done task; `closed_rev: null` on imported tasks; `first_rev: null` on the imported handoff and session; the
  report's retention sentence rewritten (round 2's handoff, section 2.2, states all of this).
- **the leftovers** (12 hunks): the decoder, staleness, the Decisions block, the half-restored refusal, `CommitResult`.

The hunks are disjoint; I read round 2's whole diff of the file against the leftovers' hunk list. The old field name
appears nowhere in the merged `src/` or `tests/` (`git grep`). **"Round 2 does not touch `state-import/`" is false,
in the brief and in the leftovers' handoff (section 1), and the merge did not have to rely on it.** `tsc --noEmit -p
.` exit 0 on the merged tree, then `npm run build` (stamped `d500730`).

## 2. CI on tcm: the whole merged tree

| Run | Branch @ SHA | Runner | Result |
|---|---|---|---|
| **`36279747225`** | `loop/importer-leftovers-r2` @ `d500730` | `tcm-2` (machine `tcm`) | **success: 88 of 88 files, 1333 passed, 2 skipped (1335)**, the `npx tsc --noEmit` step included |

Read from the run log, per test (`evidence/ci-36279747225-files.txt`, every ✓ line; 224 lines, none other than ✓).
**The counts reconcile:** files 84 base + 2 leftovers (`state-import-leftovers`, `state-import-qa122`) + 2 round 2
(`setup-hooks`, `session-order`) = 88; tests 1313 (leftovers, `36230714062`) + 1309 (round 2, `36231392345`) − 1335
= 1287 at the base, which neither handoff states, so it is derived, not confirmed. The 2 skips are the two both
parents name: `record-erasure`'s real-history row and `paths.test.ts`'s.

No full local suite (the brief's rule).

## 3. The leftovers' 16 mutants, on the merged tree

The leftovers' own driver, unchanged (`docs/loops/dev-scripts-importer-leftovers/mutants-leftovers.cjs`), run from
`open-brain/` at **`d500730`**, 23:32:26Z–23:37:56Z. vitest covers `tests/pipelines/state-import*`, **113 tests**,
the same count as at `e222124`. Each edit matched exactly once, `tsc` ran on every mutant, and the source was
restored and hash-checked (`restored: src/ clean`). Output: `evidence/mutants/` (`mutants-leftovers.out`, each
mutant's `.diff` and vitest JSON, and the console).

| Mutant | At `e222124` (red of 113) | **At `d500730`** |
|---|---|---|
| M1-utf32-first | killed, 1 | **killed, 1** |
| M2-le-bom-nul | killed, 1 | **killed, 1** |
| M3-be-bom-nul | killed, 1 | **killed, 1** |
| M4-no-title | killed, 5 | **killed, 5** |
| M5-not-judged-line | killed, 1 | **killed, 1** |
| M6-report-block | killed, 1 | **killed, 1** |
| M7-draft-source | killed, 2 | **killed, 3** (see below) |
| M8-commit-output | killed, 1 | **killed, 1** |
| M9-draft-output | killed, 1 | **killed, 1** |
| M10-no-nul-strip | killed, 2 | **killed, 2** |
| M11-no-filter | killed, 2 | **killed, 2** |
| M12-o7-reversed | killed, 2 | **killed, 2** |
| M13-o7-unsorted | killed, 1 | **killed, 1** |
| M14-o7-one-marker-text | killed, 2 | **killed, 1** (see below) |
| M15-o14-optional | killed by tsc, TS2538 | **killed by tsc**, TS2538 at `index.ts(523,59)` |
| M16-o14-producer | killed by tsc, TS2345 | **killed by tsc**, TS2345 at `index.ts(599,19)` |

**16 of 16 killed.** I diffed the two `mutants-leftovers.out` files: every red row is the same except these two, and
**both differences are rows that have nothing to do with the protection mutated**:

- **M7's third row** is `state-import-r4.test.ts > R4-1's list (IF-22) … names no Session N: does not block`, and
  it failed on `EPERM: operation not permitted, rename '…\ob-import-r4-…\.agents\SYSTEM\SUMMARY.md.tmp-15512' ->
  …`: the view renderer's atomic rename in a temp directory, refused by Windows. That is a file-lock flake on this
  PC, not the mutant. M7's kill is its two D12 rows, which fail on their assertions, as at `e222124`.
- **M14's second row at `e222124`** was a D12 guard row (`a readable DECISIONS.md says nothing about NUL bytes`).
  It did not recur here. The leftovers' evidence keeps no vitest JSON for M14, so **its cause is unrecorded**; the
  likeliest reading is the same flake, but that is a reading, not a run.

Both are G-042's family (a row red for a reason that is not its assertion). Neither changes a verdict: each mutant
is killed by the rows that name its protection.

## 4. QA's probes, on the merged tip

Scripts extracted with `git cat-file -p` and checked with `git hash-object`: QA 111's `probes-r3.mjs` (`b3ecab0`) and
QA 122's `probes-r4.mjs` (`d475c7b`), both matched. They ran against a scratch worktree at `d500730`, built with
`tsc` (stamped `d500730`), `node_modules` junctioned to this tree's, **after the mutant chain had ended**, one at a
time: 23:38:24Z–23:41:03Z.

I compared each output to the leftovers' output at `e222124`, row by row, with SHAs, temp-name numbers and scratch
paths masked. **All four runs are identical to `e222124`'s apart from the scratch paths.**

**probes-r3 (byte-exact): 17 passed, 4 failed, 21 checks; exit 1.** PASS/FAIL ids identical to `e222124`'s, and so
to QA 122's at `78a7d13`. The four FAIL rows and the rulings that changed them are unchanged from the leftovers'
handoff, section 6:

| FAIL row | At `d500730` | Ruling |
|---|---|---|
| `R3-2 class: utf8 then PS 5.1 >>` | could not tell (NUL bytes), bare `--commit` exit 1 | R3-2's NUL case, kept by R4-1 |
| `R3-2 class: utf8-bom then PS 5.1 >>` | the same | the same |
| `R3-2 class: cp1252 then PS 5.1 >>` | the same | the same |
| `R3-2 class: UTF-8 with one stray NUL at the end` | 0 / 3 / 0 (`1 NUL byte(s), the first at byte 102`), exit 1 | the same |

The IF-19 rows, which parse the one-marker refusal, pass. Output: `evidence/probes-r3-d500730.out`.

**probes-r4 (byte-exact): 12 passed, 0 failed, then the same crash in QA's instrument**: `EBUSY … open
'…\held-held-None-Open\.agents\TASKS\INBOX.md'` at `probes-r4.mjs:45`, from its `tree()` walk, while the
share=`None` hold is open. No SUMMARY line; exit 1. The same 12 rows and the same stack as at `e222124`. Output:
`evidence/probes-r4-d500730.out`.

**probes-r4 with the recorded one-line hold diff: 16 passed, 0 failed; exit 0.** The diff was applied with `patch`,
then re-derived with `diff` and compared with `cmp` to the leftovers' `evidence/probes-r4-noNone.diff`: **byte
identical**, the one removed line being `["held with share=None (EBUSY to any reader)", "Open", "Read", "None"]`.
IF-21 12 of 12, IF-22 4 of 4, and the other shapes, the held-open rows and the DECISIONS.md section read as at
`e222124` (the leftovers' handoff, section 6, lists them). Output: `evidence/probes-r4-noNone-d500730.out`.

## 5. `/sync --check` at `d500730` (built)

**21 passed, 3 issues, 4 warnings, 4 skipped; exit 1. The three issues are the ones both parents' handoffs name,
and none is the merge's:** `retirements` (ENTITIES.md names `dream` and `reflection queue`), `mirror-parity` (the
installed `end.md` copies, which round 2's after-merge checklist step 4 fixes), and `state-schema` (this CLI is
schema v3, the record here is v2 until the checklist's step 2). `merge-markers`: 0 conflict markers in 675 tracked
files. `record-erasure`: 44 legacy erasures, 0 at v3, as round 2 reported. `build-freshness`: passes at `d500730`.

**One warning is new to me and outside this task:** `ci-status [warn]: master aae0dce conclusion: failure`. I did not
look into it.

## 6. For the planner

1. **The briefs' premise was wrong, harmlessly.** Round 2 does change `state-import/index.ts` (section 1). A later
   brief that stacks on either branch should not repeat "does not touch".
2. **The merged tree carries round 2's after-merge checklist unchanged** (round 2's handoff, section 6). Nothing in
   the leftovers changes it: the leftovers write the importer, and the checklist migrates and re-renders SIA's own
   record.
3. **The leftovers' open items carry over unchanged**: O13 does not hold on this PC (probes-r4's share=`None` crash,
   reproduced here), the importer's own read under EBUSY is untested, and the no-title rule will meet T-181's
   co-op-mailer import if its files lack a `# ` title.
4. **A new sighting for O13's family:** M7's stray `EPERM` on the renderer's rename (section 3) is the importer's own
   WRITE path refused by Windows on this PC, in a temp directory nothing else held. QA 122 saw EPERM at the render
   before. It is one sighting, not a reproduction.

## 7. Scratch, authority, and what was not done

- **Scratch only.** The probes ran in the session scratchpad (`…/scratchpad/p3`, `p4`, `p4n`) against a scratch
  worktree `…/scratchpad/tip` (detached at `d500730`, left on purpose; `git worktree remove` clears it). The mutants
  edited this tree's `src/` and restored it, hash-checked. **SIA's live `.agents/state.json` was not written in any
  tree.**
- **No `/end`**, as dispatched (T-163 standing).
- **The dispatch, quoted** (Atlas, record 109, A2A, to this seat): *"you are Forge, record session 136, the IMPORTER
  LEFTOVERS MERGE-IN, dispatched at Aaron's word ("both cleared, send them") […] git switch -c
  loop/importer-leftovers-r2 origin/loop/importer-leftovers, then git merge origin/loop/t179-r2 (d0335d7). NEVER
  rebase, never force. […] Push only loop/importer-leftovers-r2 and loop/importer-leftovers-r2-*."* That relay is
  two links: Aaron to Atlas, Atlas to this seat.

## 8. Branches pushed (each read back with `ls-remote`)

- `loop/importer-leftovers-r2` → `d500730` (the candidate), then this handoff commit on top. Its SHA is in the
  message to Atlas, read back from origin.

No other branch was pushed.
