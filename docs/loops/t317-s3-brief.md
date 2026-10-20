# T317-S3: record writes stamp sessions[].last_work_rev, so /end refuses a stale handoff (T-317 part 2, writer)

Runtime: CC (claude -p, Sonnet)
SEAT: QA PC job runner, NOT the desktop. No hub key. Code. Ends at READY with a PR, no merge.
REPLY: the absolute reply path the launcher names. Print it FIRST.

**By:** Atlas (planner), 2026-10-20, session 174. **Task:** T-317 (P0). **Tag:** `T317-S3`. **Size:** SMALL (1 src file,
1 edit; 1 new test file; 2 edits to S2's test file). **Base:** the START sha the launcher names (a master that contains
this brief).

```text
IMPACT-TARGETS: applyStateOps (the sessions[] upsert gains last_work_rev on a write carrying an op other than set_handoff)
```

## Why

S2 (#900, live 5f48b9d9) taught every reader the optional `sessions[].last_work_rev` and made the /end gate refuse
`HANDOFF STALE` when it is above the handoff's `written_rev`. Nothing stamps it yet, so the rule never fires. S3 makes
the writer stamp it: a write with any op other than `set_handoff` sets it to that write's revision; a handoff-only
write keeps the value it had. Work and a handoff in one batch get equal stamps, so they are not stale.

**Dispatched only after every reader is on S2:** the desktop's open-brain servers all restarted on 5f48b9d9 (10-20
20:16Z) and the QA PC's SIA build was moved to 5f48b9d9 or later (clark). An older build refuses a record that
carries the key.

## The change, exactly

All files are under `docs/loops/t317-s3/`.
- **`edits.txt`:** 1 exact-once replacement in `open-brain/src/shared/state-writer.ts` (the sessions[] upsert).
- **`tests.txt`:** 2 exact-once replacements in `open-brain/tests/t317-s2.test.ts`, the rows that assumed nothing
  stamps the field. R3 removes the stamp by hand (a record a pre-S3 build wrote); R4's later write becomes a
  handoff-only write, which keeps the stamp. Both pass before and after the src edit.
- **`t317-s3.test.ts`:** copied verbatim, as a new file, to `open-brain/tests/t317-s3.test.ts`.
  - R1 (guard): work, then the handoff: ob_end closes.
  - R2: the handoff, then work: ob_end refuses with HANDOFF STALE naming both revisions.
  - R3 (guard): re-setting the handoff after that work closes the session.
  - R4: a work write stamps its revision, and a handoff-only write keeps the stamp.
  - R5 (guard): work and the handoff in ONE batch are not stale.

## Measured before dispatch

QA PC SIM `sim-t317-s3` (job #16) at `5d36342b`. sha256 prefixes: edits `7818ecfea311f859`, test `7b8530ab22e1c87e`,
m1 `a68d64c0a7309740`, m2 `82ae1b56af0fac60`.
- The new file on the unpatched base: `2 failed | 3 passed (5)`: R2 and R4 red.
- Apply: `APPLIED 1 edits to 1 files`. Both tsc runs and the build exit 0.
- The wide run (step 4's command): `180` files, `2058` tests, no Errors line, no timeouts. TWO rows red alone, both in
  `tests/t317-s2.test.ts` (R3: `not to have property "last_work_rev"`, received 8; R4: `expected 9 to be 7`): S2's
  rows assumed nothing stamps the field. `tests.txt` updates exactly those two rows. That file was NOT in the SIM;
  Atlas applied it to master's t317-s2.test.ts by text (`APPLIED 2 edits to 1 files`).
- m1 (never stamps): R2 and R4 red. m2 (a handoff-only write stamps too): R4 red only.

## Existing tests (verdicts)

| Test | Verdict | Why |
|---|---|---|
| `tests/t317-s2.test.ts` R3, R4 | updated by `tests.txt` | Red alone in the SIM; their old text pinned S2's "nothing stamps it". |
| `tests/t317-s2.test.ts` R1, R2, R5 | stay green | They hand-set the stamp after the writes they check. Green in the SIM. |
| `tests/shared/state-writer.test.ts` (the sessions[] row toEqual at ~:587) | stays green | That write is handoff-only, so no key is added. Green in the SIM. |
| everything else in step 4's run (`tests/end-fix`, `tests/shared`, `tests/server.test.ts`, `tests/pipelines`) | stay green | Green in the SIM. |

Any other red existing row means STOP and report `BLOCKED T317-S3 <test name>`. Exceptions, from T-292 load on the shared
QA PC: red rows only in files other than `t317-s3.test.ts` and `t317-s2.test.ts`, with T-292's `Timeout calling
onTaskUpdate` or a hook timeout: re-run each such file alone; green alone means paste both runs and go on, red alone
means STOP. A red `t317-s3.test.ts` or `t317-s2.test.ts` row after step 4 is never an exception.

## Steps

1. **Shell.** PowerShell: `$env:Path = 'C:\Program Files\nodejs;' + $env:Path`; `node -v` must print `v22.*`.
2. **Branch.** In the clone at START: `git checkout -q -b fix/t317-s3-stamp-last-work`. HEAD must equal START and the
   porcelain must be empty. In `open-brain`: `npm ci`. Run every `apply.cjs` from the CLONE ROOT. Forbidden: stash,
   reset --hard, force, rebase, amend, other checkouts, test:heavy, `vitest -u`, killing processes by name, the real
   `~/.claude/open-brain/`, and anything under `docs/`.
3. **Commit 1** (`T317-S3: rows for the last_work_rev stamp; S2's rows stop assuming nothing stamps it`).
   - `Copy-Item docs/loops/t317-s3/t317-s3.test.ts open-brain/tests/`
   - `node docs/loops/t317-s3/apply.cjs . docs/loops/t317-s3/tests.txt` prints exactly `APPLIED 2 edits to 1 files`.
   - `$env:NO_COLOR='1'`; in `open-brain`:
     `npx vitest run tests/t317-s3.test.ts tests/t317-s2.test.ts --no-file-parallelism --testTimeout=180000`.
   - Expect `2 failed | 8 passed (10)`: t317-s3 R2 and R4 red; every t317-s2 row green. Paste the summary and `x` rows.
4. **Commit 2** (`T317-S3: record writes stamp sessions[].last_work_rev, so /end refuses a stale handoff (T-317)`).
   - `node docs/loops/t317-s3/apply.cjs . docs/loops/t317-s3/edits.txt` prints exactly `APPLIED 1 edits to 1 files`.
   - `npx tsc --noEmit` and `npx tsc -p tsconfig.tests.json --noEmit` (both exit 0), then `npm run build` (exit 0).
   - `npx vitest run tests/t317-s3.test.ts tests/t317-s2.test.ts tests/t317-s1.test.ts tests/end-fix tests/shared tests/server.test.ts tests/pipelines --no-file-parallelism --testTimeout=180000`
     (40-minute cap). Expect 0 failed, about 180 files and 2058 tests. Paste the `Test Files`, `Tests` and any `Errors`
     lines.
5. **Check the commits.** Both messages end with `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`;
   `git log --oneline <START>..HEAD` shows 2 lines; the status is empty.
6. **Mutants**, on the COMMITTED fix, one at a time: `node docs/loops/t317-s3/apply.cjs . docs/loops/t317-s3/<m>.txt`
   prints `APPLIED 1 edits to 1 files`; run `tests/t317-s3.test.ts`; paste the `x` rows; restore with
   `git checkout -- open-brain/src` (this returns to commit 2). Expected red: m1 R2 and R4; m2 R4 only. Never commit one.
7. **Check the diff.** `git diff --name-only <START>..HEAD` shows exactly `open-brain/src/shared/state-writer.ts`,
   `open-brain/tests/t317-s2.test.ts`, `open-brain/tests/t317-s3.test.ts`.
8. **Push and open the PR.** Push, never force; `git ls-remote origin refs/heads/fix/t317-s3-stamp-last-work` must equal
   HEAD. `gh pr create --base master --head fix/t317-s3-stamp-last-work --title "T317-S3: record writes stamp last_work_rev; /end refuses a stale handoff (T-317)" --body "Brief: docs/loops/t317-s3-brief.md."`.
   Then `gh pr checks <n> --watch --interval 30` (cap 25 min). Paste the `test` conclusion.

## Reply

- **First line:** `READY T317-S3 <sha40> PR #<n>` or `BLOCKED T317-S3 <reason>`.
- At most 2 attempts at any step. A STOP still writes the reply. Every number is pasted output, with its command.
  Mark anything not run `NOT RUN`. Do not merge.

## After merge (not this run)

`sia-rebuild`, then each seat reconnects. From then on a session whose last record write came after its handoff is
refused at /end with `HANDOFF STALE`, and the SessionEnd hook flags it for the next /start.
