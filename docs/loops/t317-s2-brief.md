# T317-S2: the /end gate refuses a handoff older than this session's last work (T-317 part 2, readers)

Runtime: CC (claude -p, Sonnet)
SEAT: QA PC job runner, NOT the desktop. No hub key. Code. Ends at READY with a PR, no merge.
REPLY: the absolute reply path the launcher names. Print it FIRST.

**By:** Atlas (planner), 2026-10-20, session 174. **Task:** T-317 (P0). **Tag:** `T317-S2`. **Size:** SMALL (2 src files,
4 edits; 1 new test file). **Base:** the START sha the launcher names (a master that contains this brief).

```text
IMPACT-TARGETS: newLayoutRecordUpdated checkRecordUpdated checkSessionHandoff SessionRecordSchema KEY_ORDER (sessions[] gains optional last_work_rev)
```

## Why

T-317 part 1 (#888) made the /end gate need this session's `set_handoff`. A handoff written early still passes, though
the session went on writing the record after it (S173: Atlas's handoff described 10-16 work through dozens of 10-19
writes). Each handoff carries `written_rev` (T-298). This step adds the other stamp, `sessions[].last_work_rev`, the
revision of the session's latest write that carried an op other than `set_handoff`, and the gate compares them.

**Two steps, because every record object is a strict schema:** an older build refuses a state.json carrying a key it
does not know (the SIM's baseline shows it: `Unrecognized key: "last_work_rev"`). S2 (this run) teaches every reader the
optional key and the gate the rule; nothing writes it yet. S3 makes the writer stamp it, after every running open-brain
server is on the S2 build.

## The change, exactly

All files are under `docs/loops/t317-s2/`.
- **`edits.txt`:** 4 exact-once replacements. `open-brain/src/shared/state-schema.ts`: `SessionRecordSchema` gains
  `last_work_rev: nonNegInt.optional()`; `KEY_ORDER.sessions` gains `"last_work_rev"`.
  `open-brain/src/shared/end-record-guard.ts` (`newLayoutRecordUpdated`): this session's handoff with
  `last_work_rev > written_rev` is refused with `HANDOFF STALE: written at rev N; this session wrote rev M after it.
  Re-run ob_state set_handoff`, unless a loop handoff was committed. Either stamp absent: part 1's rule stands.
- **`t317-s2.test.ts`:** copied verbatim, as a new file, to `open-brain/tests/t317-s2.test.ts`.
  - R1: work stamped after the handoff makes ob_end refuse with HANDOFF STALE.
  - R2 (guard): work stamped AT the handoff's revision is not stale.
  - R3 (guard): with no last_work_rev, part 1's rule stands.
  - R4: a state.json carrying last_work_rev reads, and a later write keeps the field.
  - R5: the shared check the SessionEnd hook uses reports the same stale handoff.

## Measured before dispatch

QA PC SIM `sim-t317-s2` (job #8) at `44ecc717`, ALL PASS. sha256 prefixes: edits `ed7b17a9f484412e`, test
`fa56c6d1131f6ca6`, m1 `be482fdc5b511313`, m2 `706d5cf184725225`.
- The new file on the unpatched base: `4 failed | 1 passed (5)`: R1, R2, R4, R5 red (state.json unreadable), R3 green.
- Apply: `APPLIED 4 edits to 2 files`. Both tsc runs and the build exit 0.
- The step 4 run: `119 passed (119)` files and `1609 passed (1609)` tests. No Errors line, no T-292 timeout.
- m1 (no stale check): R1 and R5 red. m2 (`>=`): R2 red only.

## Existing tests (verdicts)

| Test | Verdict | Why |
|---|---|---|
| `tests/t317-s1.test.ts` R1, R2 | stay green | No last_work_rev is stamped, so part 1's rule stands. Green in the SIM. |
| `tests/end-fix-*.test.ts`, `tests/server.test.ts` | stay green | Same: the field is absent in every existing fixture. Green in the SIM. |
| `tests/shared` (incl. the T-238 key-order check) | stay green | `last_work_rev` is in both the schema and `KEY_ORDER.sessions`. Green in the SIM. |
| `tests/pipelines/session-start`, `session-end`, `sync` | stay green | Readers of sessions[] ignore an absent optional key. Green in the SIM. |

Any other red existing row means STOP and report `BLOCKED T317-S2 <test name>`. Exceptions, from T-292 load on the shared
QA PC: red rows only in files other than `t317-s2.test.ts`, with T-292's `Timeout calling onTaskUpdate` or a hook
timeout: re-run each such file alone; green alone means paste both runs and go on, red alone means STOP. A red
`t317-s2.test.ts` row after step 4 is never an exception.

## Steps

1. **Shell.** PowerShell: `$env:Path = 'C:\Program Files\nodejs;' + $env:Path`; `node -v` must print `v22.*`.
2. **Branch.** In the clone at START: `git checkout -q -b fix/t317-s2-stale-handoff`. HEAD must equal START and the
   porcelain must be empty. In `open-brain`: `npm ci`. Forbidden: stash, reset --hard, force, rebase, amend, other
   checkouts, test:heavy, `vitest -u`, killing processes by name, the real `~/.claude/open-brain/`, and anything under
   `docs/`.
3. **Commit 1** (`T317-S2: rows for the stale-handoff gate`), the new test file only.
   - `Copy-Item docs/loops/t317-s2/t317-s2.test.ts open-brain/tests/`
   - `$env:NO_COLOR='1'`; in `open-brain`: `npx vitest run tests/t317-s2.test.ts --no-file-parallelism --testTimeout=180000`.
   - Expect `4 failed | 1 passed (5)`: R1, R2, R4, R5 red, R3 green. Paste the summary and the `x` rows.
4. **Commit 2** (`T317-S2: the /end gate refuses a handoff older than this session's last work (T-317)`).
   - From the clone root, `node docs/loops/t317-s2/apply.cjs . docs/loops/t317-s2/edits.txt` prints exactly
     `APPLIED 4 edits to 2 files`.
   - `npx tsc --noEmit` and `npx tsc -p tsconfig.tests.json --noEmit` (both exit 0), then `npm run build` (exit 0).
   - `npx vitest run tests/t317-s2.test.ts tests/t317-s1.test.ts tests/end-fix tests/shared tests/server.test.ts tests/pipelines/session-end tests/pipelines/session-start tests/pipelines/sync --no-file-parallelism --testTimeout=180000`
     (30-minute cap). Expect 0 failed, 119 files, 1609 tests. Paste the `Test Files`, `Tests` and any `Errors` lines.
5. **Check the commits.** Both messages end with `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`;
   `git log --oneline <START>..HEAD` shows 2 lines; the status is empty (build output is ignored).
6. **Mutants**, on the COMMITTED fix, one at a time: `node docs/loops/t317-s2/apply.cjs . docs/loops/t317-s2/<m>.txt`
   prints `APPLIED 1 edits to 1 files`; run the new test file; paste the `x` rows; restore with
   `git checkout -- open-brain/src` (this returns to commit 2, which holds the fix). Expected red: m1 R1 and R5; m2 R2.
   Never commit a mutant.
7. **Check the diff.** `git diff --name-only <START>..HEAD` shows exactly `open-brain/src/shared/end-record-guard.ts`,
   `open-brain/src/shared/state-schema.ts`, `open-brain/tests/t317-s2.test.ts`.
8. **Push and open the PR.** Push, never force; `git ls-remote origin refs/heads/fix/t317-s2-stale-handoff` must equal
   HEAD. `gh pr create --base master --head fix/t317-s2-stale-handoff --title "T317-S2: the /end gate refuses a stale handoff (T-317)" --body "Brief: docs/loops/t317-s2-brief.md."`.
   Then `gh pr checks <n> --watch --interval 30` (cap 25 min). Paste the `test` conclusion.

## Reply

- **First line:** `READY T317-S2 <sha40> PR #<n>` or `BLOCKED T317-S2 <reason>`.
- At most 2 attempts at any step. A STOP still writes the reply. Every number is pasted output, with its command.
  Mark anything not run `NOT RUN`. Do not merge.

## After merge (not this run)

`sia-rebuild`; servers keep running (STALE PROCESS) until each seat reconnects. Only when every running open-brain
server has started after that rebuild does S3 (the writer stamps `last_work_rev`) dispatch.
