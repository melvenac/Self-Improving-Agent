# S173G: three fixes from the s173 greeting and /end audits (T-306, T-307, T-310)

Runtime: CC (claude -p, Sonnet)
SEAT: QA PC one-off, NOT the desktop. No hub key. Code. Ends at READY with a PR, no merge.
ROOM: none
REPLY: write the full reply to an ABSOLUTE path under the user's %TEMP% named s173g-reply.md. A reply path in the
launcher's line wins. Resolve and print that absolute path FIRST.

**By:** Atlas (planner), 2026-10-19, session 173. **Tasks:** T-306 (P2), T-307 (P2), T-310 (P3). **Tag:** `S173G`.
**Size:** SMALL (2 src files, 2 command docs, 8 verbatim edits). **Base:** the dispatch SHA clark names (a master that
contains this brief). **Checklist:** `~/Worktrees/cursor-brief-checklist.md`.

```text
IMPACT-TARGETS: formatShadowReport describeTreeCurrency (shadow/index.ts: the report filters to SHADOW_STRATEGIES; tree-currency.ts: the "ahead" line names its ref)
```

## Why

Found by auditing Maker's S69 `/end` and S70 `/start` transcripts against the greeting scorecard.

- **T-306.** `ob_end` printed `Candidate: no_maturity beats live on nDCG. Aaron's call whether to adopt.` Maker relayed
  that to Aaron as a real choice. `no_maturity` was removed in Loop 10 C2 (`strategies.ts:40`). Its old JSONL rows are
  still averaged with the current strategies, over a different set of sessions. That run's own best was `live`.
  - **Fix:** the report compares only `SHADOW_STRATEGIES` names. Anything else is listed once as
    `retired, not compared: …`. `aggregateShadowLog` itself is unchanged.
- **T-307.** `/end` step 1b gives `skills-audit [--seat <name>] "<project dir>"`. Without `--session` the audit reads
  the project's newest transcript (`skills-audit/index.ts:219`), which belongs to another session when one started
  later. Stored lesson 751 corrects this, but it arrives after the command runs (PostToolUse).
  - **Fix:** the instruction itself names `--session <SESSION_UUID>`, in both Claude copies. The Cursor copy is
    unchanged, because Cursor writes no session proof.
- **T-310.** On the makerspace live check (record_branch) the tree line read
  `… ahead of origin/docs/t001-plans … local work is not yet on master.` `master` is hard-coded.
  - **Fix:** the line names `d.upstreamRef`.

## The change, exactly

All files are under `docs/loops/s173g/`.

- **`edits.txt`:** 8 exact-once replacements across 4 files:
  - `open-brain/src/pipelines/shadow/index.ts` (2)
  - `open-brain/src/pipelines/session-start/tree-currency.ts` (2)
  - `.claude/commands/end.md` (2)
  - `project-template/.claude/commands/end.md` (2)
- **`s173g.test.ts`:** copied verbatim, as a new file, to `open-brain/tests/s173g.test.ts`.

## Measured before dispatch

QA PC SIM S173G by clark at `8630a7c0` (master `ab2fce07` plus these files) used these exact files. sha256
prefixes:

| File | sha256 prefix |
|---|---|
| edits | `1cb8a7131945f0a4` |
| test | `dceb22dd733ffd35` |
| m1 | `d36d080c26fedc21` |
| m2 | `4f5064e566df7fd1` |
| m3 | `4b067fa3a8b7c255` |

- The new file on the unpatched base: `4 failed (4)`.
- Apply: `APPLIED 8 edits to 4 files`. Both tsc runs exit 0.
- The step 4 run: `51 passed (51)` files, `732 passed (732)` tests.
  - Run 1 also printed `Errors 1 error`, and its text was not captured. An identical run 2 was clean.
  - **Ruling:** in this run, paste the whole `Unhandled Errors` block if one appears.
    - If it is `Timeout calling onTaskUpdate` (T-292), go on.
    - Anything else: run once more. If it repeats, or its stack names a file this brief changes, STOP with
      `BLOCKED S173G unhandled error`.
- Mutants, each on the patched tree:

  | Mutant | Red rows |
  |---|---|
  | m1 | R1, R2 |
  | m2 | R3 |
  | m3 | R4 |

## Existing tests (verdicts)

| Test | Verdict | Why |
|---|---|---|
| `tests/shadow-stage.test.ts` "shadow aggregation" (5 rows) | stays green | They use only `live` and `no_recency`, both current. |
| `tests/t262-part2.test.ts` D-1 | stays green | Both Claude copies change identically (`a === b`), neither gains `--runtime`, and the Cursor line is untouched. |
| `tests/t262-fix-2.test.ts` N2/N3 | stays green | No coordinator name is added, and no SessionEnd promise is added to the Cursor copy. |
| bootstrap / install-commands rows that compare `.claude/commands/end.md` with the template | stays green | The two copies stay byte-identical. |

No test pins `not yet on master` (grep at the base finds none). Any other red existing row means STOP and report
`BLOCKED S173G <test name>`. The one exception is T-292's `Timeout calling onTaskUpdate` error when every test passed.
Paste it and go on.

**Side effect, intended:** a project whose `.claude/commands/end.md` was installed from the old template now reads
`OLD` until `bootstrap install-commands` runs. The greeting warns only for `/start`.

## Steps

1. **Shell.** In PowerShell:
   - `$reply = [System.IO.Path]::GetFullPath((Join-Path $env:TEMP "s173g-reply.md")); "REPLY_PATH=$reply"`
   - `$env:Path = 'C:\Program Files\nodejs;' + $env:Path`
   - `node -v` must print `v22.*`. Otherwise STOP.
2. **Clone and install.**
   - Make a fresh clone into `(Join-Path $env:TEMP "s173g-wt")`, unless the launcher named one.
   - Run `git checkout -q -b fix/s173g-audit-fixes <base>`. HEAD must equal the base, and the porcelain must be empty.
   - In `open-brain`, run `npm ci`, then the better-sqlite3 probe.
   - Forbidden: stash, reset --hard, force, rebase, amend, other checkouts, test:heavy, killing processes by name, the
     real `~/.claude/open-brain/`, `~/.claude/commands/`, and anything under `docs/`.
3. **Commit 1** (`S173G: rows for the shadow report, the ahead tree line and /end --session`). It holds the test file
   only.
   - Run `Copy-Item docs/loops/s173g/s173g.test.ts open-brain/tests/`.
   - Run `$env:NO_COLOR='1'`. Then, in `open-brain`, run
     `npx vitest run tests/s173g.test.ts --no-file-parallelism --testTimeout=180000`.
   - Expect `4 failed (4)`. Paste the summary and the `x` rows.
4. **Commit 2** (`S173G: shadow report compares current strategies only; ahead line names its ref; /end passes --session`).
   - From the clone root, `node docs/loops/s173g/apply.cjs . docs/loops/s173g/edits.txt` must print exactly
     `APPLIED 8 edits to 4 files`.
   - Run `npx tsc --noEmit` and `npx tsc -p tsconfig.tests.json --noEmit` (both exit 0), then `npm run build` (exit 0).
   - Run `npx vitest run tests/s173g.test.ts tests/shadow-stage.test.ts tests/t262-part2.test.ts tests/t262-fix-2.test.ts tests/pipelines/session-start tests/pipelines/bootstrap-fix.test.ts tests/pipelines/import-cmds-r2-l1.test.ts tests/server.test.ts --no-file-parallelism --testTimeout=180000`
     (25-minute cap). Expect `732 passed`. Paste the `Test Files`, `Tests` and any `Errors` lines.
5. **Check the commits.**
   - Both messages end with `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`.
   - `git log --oneline <base>..HEAD` shows 2 lines.
   - The status is empty.
6. **Mutants.** Do this on the committed fix, for each of `m1.txt` … `m3.txt`:
   - Run `node docs/loops/s173g/apply.cjs . docs/loops/s173g/<mN>`. It prints `APPLIED 1 edits to 1 files`.
   - Run the new test file. Paste the summary and the `x` rows.
   - Restore with `git checkout -- open-brain/src project-template .claude`. The status must be empty.
   - Never commit a mutant.
   - Expected red rows: m1 R1, R2 · m2 R3 · m3 R4.
7. **Check the diff.** `git diff --name-only <base>..HEAD` shows exactly:
   - `.claude/commands/end.md`
   - `open-brain/src/pipelines/session-start/tree-currency.ts`
   - `open-brain/src/pipelines/shadow/index.ts`
   - `open-brain/tests/s173g.test.ts`
   - `project-template/.claude/commands/end.md`
8. **Push and open the PR.**
   - Push, never force. `git ls-remote origin refs/heads/fix/s173g-audit-fixes` must equal HEAD.
   - Run `gh pr create --base master --head fix/s173g-audit-fixes --title "S173G: shadow report compares current strategies only; ahead line names its ref; /end passes --session" --body "Brief: docs/loops/s173g-audit-fixes-brief.md."`.
   - Then run `gh pr checks <n> --watch --interval 30` (cap 25 min). Paste the `test` conclusion.

## Reply

- **First line:** `READY S173G <sha40> PR #<n>` or `BLOCKED S173G <reason>`.
- At most 2 attempts at any step. A STOP still writes the reply.
- Every number is pasted output, with its command shown above it. Mark anything not run `NOT RUN`.
- Do not merge.

## After merge (not this run)

- REBUILT. The next `/end` anywhere shows no `no_maturity` row and no `Candidate: no_maturity`, and ends with
  `retired, not compared: maturity_strong, no_maturity` (the order follows nDCG).
- `~/.claude/commands/end.md` is Aaron's global copy and carries the same old line. Updating it is a proposal to clark,
  not part of this PR.
