# QA 261: #302 round 2, the narrow re-check (T-048, dropped counts printed at zero)

**By:** QA 261 (headless Claude Code, Opus 5.5) on the desktop (DESKTOP-UGEKR74), 2026-10-02.
**Dispatch:** `docs/loops/qa-261-302r2-dispatch.md`. The dispatch tree `qa261-wt` is at
`897e6f89754344cbc2227269782ab8f9a47ce4f8` (`git -C ~/qa-scratch/qa261-wt log -1 --format=%H`).
**Job class:** LIGHT. I ran one test file per vitest invocation, with no full suite and no live Jev call. I used `gh`
only to read.

| PR | Task | Head | Code SHA | Round 1 head | Verdict |
|----|------|------|----------|--------------|---------|
| #302 | T-048 | `7e92b6f641ad776d886037e54139cb0e6fd4b617` | `b4d929ae1a1491cfe0bde72b19747d5f6769038c` | `ac4323f4` | **ACCEPT** (needs a rebase on master, see row 7; one follow-up, see row 4) |

`git fetch origin loop/t048-dropped-counts` resolved to `7e92b6f6…`, which matches the dispatch. My scratch scripts
and the row-2 demo output are in `C:/qa-tmp/qa261/` on the desktop. Those files are local and not committed. I wrote
the row-2 demo test into the head tree only for the run, then deleted it. The head tree's `open-brain/src` was clean
after every mutant.

## Row 1, confined: met

`git diff ac4323f4 7e92b6f6 --stat`: **13 files, 149 insertions and 6 deletions.** There are two commits:
`b4d929ae` (the code) and `7e92b6f6` (a docs-only handoff note; `git diff b4d929ae 7e92b6f6 --stat` lists only the
handoff).

- `docs/loops/t048-developer-handoff.md` (+10, the round-2 note)
- `open-brain/src/cli-bootstrap.ts` (+1, DC-7)
- `open-brain/src/pipelines/session-end/recalled-ids.ts` (DC-3)
- `open-brain/src/pipelines/session-start/health-checks.ts` (DC-5)
- `open-brain/src/pipelines/session-start/index.ts` (DC-4)
- `open-brain/src/pipelines/session-start/scan-counts.ts` (new, DC-4 and DC-5 formatter)
- `open-brain/src/pipelines/session-start/types.ts` (DC-4 and DC-5 fields)
- `open-brain/src/pipelines/sync/hub-seats.ts` (DC-6)
- `open-brain/src/server.ts` (DC-4 and DC-5 print in `ob_start`)
- `open-brain/src/shared/active-session.ts` (DC-7 type field)
- `open-brain/tests/cli-bootstrap.test.ts` (DC-7 row)
- `open-brain/tests/t048-dropped-counts.test.ts` (DC-3b inverted)
- `open-brain/tests/t048-zero-case.test.ts` (new, 5 rows)

The `cli-bootstrap.ts` line, exactly one added and none removed:

```
+    workspace_unusable_roots: workspace.unusable_roots,
```

The diff does not touch `sync/checks.ts` or `sync/index.ts`.

## Row 2, zero reaches the reader: met

I captured all of this on the head by calling the real reader entry points: `handleStart` (`ob_start`), `handleEnd`
(`ob_end`, `dry_run`), `handleSync` (`ob_sync`), the CLI `open-brain sync --check` and the real SessionStart hook
`cli-bootstrap.ts`. Each ran against scratch projects and a scratch HOME/USERPROFILE. The repo's `tests/setup-env.ts`
pointed the DB, the active-session slot and the vault at temp paths. The output below is verbatim, apart from the
section labels (`==`) and `<scratch-home>`.

**DC-4 and DC-5, `ob_start`.** The zero form and the did-not-run form both appear, and they differ:

```
== ob_start, proven session, ~/.claude/projects present with one readable dir ==
Session #1 (local — from this checkout's session logs; no valid state.json)
Session ID: qa261-start-1
Session logs unreadable: 0
Transcript directories unreadable: 0
== ob_start, no proven session, no ~/.claude/projects ==
Session ID: none — no session proof for this server's parent process 16424 (...by-pid\16424.json absent: ...)
Session logs unreadable: not searched (no session id, or no .agents/SESSIONS directory)
Transcript directories unreadable: not scanned (no ~/.claude/projects directory)
== ob_start, proven, one unreadable Session_N.md and one unlistable transcript entry ==
  [pipeline] 1 transcript directory under C:\qa-tmp\qa261-home-…\.claude\projects could not be read; the newest-transcript check covers only the rest.
  [session-log] 1 session log(s) in .agents/SESSIONS could not be read (Session_90.md); the search for this session's existing log skipped them.
Session logs unreadable: 1
Transcript directories unreadable: 1
```

**DC-3, `ob_end`.** For a file origin, it prints `Dropped 0`. It prints the same `formatRecalledResolution` lines as
the session-end hook (`cli-session-end.ts:133`).

```
== ob_end dry_run, file origin, every entry has an id ==
  Recalled ids: 2 from file
  Dropped 0 of 2 entries in the file: no numeric id, so they were not rated
== ob_end dry_run, file origin, one entry without an id ==
  Recalled ids: 1 from file
  Dropped 1 of 2 entries in the file: no numeric id, so they were not rated
== ob_end dry_run, no proven session (not a file origin) ==
  Recalled ids: 0 from none
```

The none origin carries no Dropped line. That is by design, because `droppedEntries` exists only for the file origin.

**DC-6, sync.** The passing line ends `; 0 seat names ignored`. Both `ob_sync` and the CLI print it in the
`REPORTED (printed whatever the severity):` block (`server.ts:175`, `cli.ts:128`). The `[sev]` bracket form is that
block's format.

```
== ob_sync ==
  hub-seats [pass]: hub-partner-seats.json matches worktree-seats.json and the readers map ob_start reads (0 Cursor room(s): ); 0 seat names ignored
== CLI 'open-brain sync <scratch> --check', exit 1 ==
  hub-seats [pass]: hub-partner-seats.json matches worktree-seats.json and the readers map ob_start reads (0 Cursor room(s): ); 0 seat names ignored
```

The CLI's exit 1 comes from the scratch fixture's own `worktree-layout [issue]` (no `project` token), not from
hub-seats.

**DC-7, the real hook writing a scratch slot** (`OPEN_BRAIN_ACTIVE_SESSION=<scratch-home>\slot\active-session.json`):

```
hook exit 0, one usable root:              workspace_root_count=1 workspace_unusable_roots=0 dir_source=workspace_roots
hook exit 0, three roots, two unusable:    workspace_root_count=1 workspace_unusable_roots=2 dir_source=workspace_roots
hook exit 0, no workspace_roots key:       workspace_root_count=0 workspace_unusable_roots=0 dir_source=fallback:absent
```

## Row 3, red then green: met

**Red, on `ac4323f4`'s source** (`qa261-base302`), with the head's test files copied in:

- `t048-zero-case.test.ts`, as is: **Test Files 1 failed, no tests.** The new module `scan-counts.js` cannot be
  resolved. That red is only an import failure, so I also copied the head's `scan-counts.ts` (the new formatter alone)
  into the base. The result was **Tests 3 failed | 2 passed (5)**:
  - DC-4z: `expected undefined to be +0`.
  - DC-5z failed.
  - DC-6z: `expected undefined to be true`, for `report`.
  - The formatter row passed only because I supplied the head's file.
  - DC-7z passed, because `describeWorkspaceDir` already returned 0 in round 1. Round 2's DC-7 change is the slot
    line, and the cli-bootstrap row below pins it.
- `cli-bootstrap.test.ts`: **Tests 1 failed | 13 passed (14).** The failing row is `T-048 DC-7: the slot records
  workspace_unusable_roots…`, with `expected '{…' to match /"workspace_unusable_roots":\s*0/`.
- `t048-dropped-counts.test.ts`, the head's copy with DC-3b inverted: **Tests 1 failed | 8 passed (9)**. The failing
  row is DC-3b.

**Green, on the head:** `t048-zero-case` **5 passed (5)**; `cli-bootstrap` **14 passed (14)**; `t048-dropped-counts`
**9 passed (9)**.

I restored the base tree afterwards with `git checkout -- .` and `git clean`.

## Row 4, mutants: met, with one QA mutant surviving (follow-up)

Each mutant was applied to the head tree, run one test file per invocation, then reverted with `git checkout`.

| Mutant | Test file(s) | Result |
|--------|--------------|--------|
| D1: the `if (resolved.droppedEntries)` guard restored | `t048-dropped-counts` | **KILLED**: 1 failed \| 8 passed, DC-3b (`t048-zero-case` 5 passed: it does not cover DC-3) |
| D2: `scan-counts` silent at zero (lines ending `: 0` filtered out) | `t048-zero-case` | **KILLED**: 1 failed \| 4 passed, the formatter row |
| D3: the hub-seats count dropped from the message | `t048-zero-case` | **KILLED**: 1 failed \| 4 passed, DC-6z (`hub-seats.test.ts` 5 passed: it does not cover the count) |
| D4: the slot line deleted from `cli-bootstrap.ts` | `cli-bootstrap` | **KILLED**: 1 failed \| 13 passed, the DC-7 row |
| **Q1 (QA): `lines.push(...formatScanCounts(...))` removed from `handleStart` in `server.ts`** | `t048-zero-case`, `server`, `t048-dropped-counts` | **SURVIVED**: 5, 30 and 9 passed |
| Q2 (QA): `searched = true`, which collapses "did not search" into 0 | `t048-zero-case` | **KILLED**: 1 failed \| 4 passed, DC-4z |
| Q3 (QA): `report: true` removed from the passing hub-seats result | `t048-zero-case` | **KILLED**: 1 failed \| 4 passed, DC-6z |

**Q1 is the gap.** The developer's rows pin the formatter, `formatScanCounts`, and the data underneath it. No committed
test pins that `ob_start` actually prints those two lines. Deleting the one call in `server.ts`, which is the reader
site QA 258 row 9 was about, leaves every committed test green. My row-2 demo test, which asserts on `handleStart`'s
text, kills it (**1 failed | 3 passed (4)**). The behaviour is right today, and row 2 shows it. The follow-up is one row
in `server.test.ts` asserting `Session logs unreadable: 0` and `Transcript directories unreadable: 0` in
`handleStart`'s output.

## Row 5, nothing regressed: met

On the head, one file per invocation:

| Test file | Result |
|-----------|--------|
| `t048-dropped-counts` | 9 passed (9) |
| `pipelines/sync/checks-state` | 22 passed (22) |
| `server` | 30 passed (30) |
| `pipelines/session-end/recalled-ids` | 17 passed (17) |
| `active-session` | 43 passed (43) |
| `pipelines/sync/hub-seats` | 5 passed (5) |

Each exited 0. `npx tsc --noEmit` exited 0. The developer's handoff counts (server 30, recalled-ids 17, active-session
43, hub-seats 5) match.

## Row 6, CI on the head (read only): met

`gh pr checks 302`: `changed` pass 8s; `test` pass 2m35s; `test-windows` skipping. All three are from run
`37010576779`. `gh run view` gives `headSha 7e92b6f641ad776d886037e54139cb0e6fd4b617`, event `push`, conclusion
`success`.

## Row 7, merge with B4: met, with ONE CONFLICT, and it is with master, not with #289

I started a scratch tree `qa261-merge` from `origin/master` at `a30fa359`. Master moved past the dispatch SHA by two
docs/state-only merges, #330 and #331. I merged with `--no-ff`:

1. **#289 at `be32de21`: clean.** It is not yet on master (`merge-base --is-ancestor` exits 1), and the PR is OPEN.
2. **#302 at `7e92b6f6`: CONFLICT in `open-brain/src/server.ts`.** It is a one-line import adjacency:
   ```
   <<<<<<< HEAD
   import { describeLatestBrief } from "./pipelines/session-start/latest-brief.js";
   =======
   import { formatScanCounts } from "./pipelines/session-start/scan-counts.js";
   >>>>>>> 7e92b6f6
   ```
   - The HEAD side comes from master's T-209/T-210 commit `6c495794`, not from #289.
   - `gh pr view 302` already reports `mergeable: CONFLICTING` against master, so #302 conflicts with master on its
     own.
   - `cli-bootstrap.ts`, the file both PRs touch, auto-merged cleanly: #289's fetch-first and drift lines, plus #302's
     slot line.
   - **I resolved the conflict in scratch only, by keeping both imports.** The merged HEAD is `ee86e4d5` (local,
     unpushed). Both `describeLatestBrief` and `formatScanCounts` are used after the resolution, at `server.ts:266`
     and `:291`.

On `ee86e4d5`, one file per invocation, every file passed:

| Test file | Result |
|-----------|--------|
| `cli-bootstrap` | 14 passed |
| `session-start/drift-line` | 7 passed |
| `session-start/tree-currency-fetch` | 12 passed |
| `sync/checks-state` | 22 passed |
| `t048-dropped-counts` | 9 passed |
| `t048-zero-case` | 5 passed |
| `server` | 30 passed |
| `session-end/recalled-ids` | 17 passed |
| `active-session` | 43 passed |
| `sync/hub-seats` | 5 passed |

`tsc --noEmit` exited 0.

**#302 cannot merge as it stands.** It needs a rebase onto master, or the same two-import resolution at merge time.
The resolution is mechanical, and I found no semantic interaction.

## Gaps (not blocking)

1. **Q1 survives:** no committed test pins `ob_start` printing the scan-count lines. That is one `server.test.ts` row
   (row 4).
2. **The import conflict with master** (`6c495794`, T-209/T-210). #302 needs a rebase before merging (row 7).
3. **DC-7 absent roots read as 0.** A payload with no `workspace_roots` key writes `workspace_unusable_roots: 0`, and
   `t048-zero-case` DC-7z pins that. The same record carries `dir_source: fallback:absent`, so a reader can still tell
   "absent" from "zero unusable". Under D-105, I count this as distinguishable rather than collapsed.
4. **`workspace_root_count` is described as "how many workspace roots the payload offered"** (`active-session.ts:54`),
   but `describeWorkspaceDir` stores the usable count (`active-session.ts:164`): three roots with two unusable give
   `root_count=1`. The new field's comment ("tell 'one root' from 'three roots, two unusable'") relies on the usable
   reading. The round-1 doc line is now inaccurate.
5. **Pre-existing, outside this dispatch:** the CLI `open-brain start` (`cli.ts:184-210`) calls `sessionStart` with no
   session id and prints neither the health warnings nor the scan counts. The dispatch scopes DC-4 and DC-5 to
   `ob_start`, which does print them.

## Verdict

- VERDICT #302 (T-048 round 2): **ACCEPT.**
  - QA 258 row 9 is answered: every count round 1 added now reaches the reader at zero.
  - "Did not look" is its own line (`not searched` / `not scanned`).
  - The developer's four mutants are killed.
  - Red-first holds, and regression, tsc and CI are green.
- The ACCEPT has two conditions for whoever merges:
  - Rebase onto master, or resolve the one-line `server.ts` import conflict by keeping both imports, as shown in row 7.
  - Track the Q1 `server.test.ts` row as a follow-up.
- **Merge authority:** this re-check is not under Aaron's overnight pre-approval, so the ACCEPT waits for his word.

QA-261: REPORT COMPLETE
