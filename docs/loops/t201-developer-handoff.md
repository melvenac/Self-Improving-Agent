# T-201 developer handoff: a seat's `/start` names its assignment

**Builder, 2026-09-30, branch `loop/t201-assignment`, local commits only (D-061: no push until the planner clears it).**
Brief: `docs/loops/t201-brief.md` (on `origin/docs/session-150-c`). Plan approved by Atlas with rulings (1)-(3), (a)-(c), then the Option C ruling below.

## Dependencies (named, not merged into this work)

- **T-200** (`loop/t200-record-from-master`, 5b9eab0a, QA pending): this branch is stacked on it. `ob_start` reads the sidecar from `origin/master` exactly when T-200's `resolveRecordSource` says the record comes from master.
- **T-203** (Forge, `loop/t203-seat-by-checkout`, not merged): NOT re-implemented. The seat is `roles.seat.role` (AGENT.local.md), the source `ob_start` already uses. When T-203 lands, that lookup is the one to swap.
- Overlaps NOT merged: T-199 (`state-render.ts` / `server.ts`), T-164. My `server.ts` edits are two additive blocks (one in `handleStart` before the role files, one at the top of `handleState`); expect a textual conflict, not a semantic one.

## What was built

**Option C (planner ruling): a tracked sidecar, `.agents/assignments.json`, not a field in state.json.** Reason, verified in code: every level of `StateSchema` is `z.strictObject`, so an optional field is still an unknown key to every build lacking it; the first assignment on master would have blinded every unrebuilt checkout, as a version bump does. `StateSchema` and `schema_version` are untouched.

- `open-brain/src/pipelines/assignments/index.ts`: schema, `readAssignments` (working tree or a git ref; **absent, ok and unreadable are three different results**), `renderAssignment`, `applyAssignmentOps`, `classifyOps`.
- `ob_state` ops `set_assignment` / `clear_assignment`, routed in `handleState`. A batch is all-assignment or all-record: a mixed batch is refused. The `expected_revision` argument is the **sidecar's own** revision (0 when absent), not the record's.
- `ob_start`: a `## Assignment (<seat>; from <source>)` block for developer and qa seats: the live entry, or the literal `no assignment`, or `UNREADABLE — <cause>` (never rendered as `no assignment`). Other seats get one line naming the omission.
- `greeting-size` (`composeGreeting`) counts the block and reports it as `assignment N` in its detail.
- `.claude/commands/start.md` and its `project-template` mirror (byte-identical): an ASSIGNMENT section before NEXT, saying the assignment is the session's work and NEXT is context. The Cursor copy is T-197's; not touched.
- `.gitignore`: `!/.agents/assignments.json` added to the allowlist (Aaron's D-066 puts it on the docs-only merge allowlist).

## THE COST, NAMED: a sidecar write is not atomic with the record

- It has its own revision counter. A batch cannot set an assignment and change a task together.
- The task is validated as **active in the record at WRITE time only**. A task closed afterwards leaves a live assignment naming a done task; nothing flags it. The reader does not print the task's current status either (I said it would in the module header of an earlier draft; it does not, and the header now says only what it does).
- **No /sync check guards the sidecar against erasure.** Row (c) is met at the writer: replace supersedes, clear marks cleared, entries are never dropped, and tests pin it. A hand edit or a merge resolution that drops an entry is not detected (record-erasure reads state.json only). Follow-up if wanted.
- **Who may write is not enforced.** Any seat's session can call `set_assignment`; the planner-only convention is not mechanical (T-194 territory).

## Rows, proof, mutants

Fixtures only: every test builds a temp tree from `tests/fixtures-state/state.json`; no id or value from the live record is asserted (T-205). Stale-tree rows use real git (bare origin, seed, clone).

| Row | Tests | Mutant (each tsc-clean, edit asserted landed, restored after) | Result |
|---|---|---|---|
| Prints the reader's assignment / `no assignment` | AS-1 (7 tests) | M1 drop the block; M8 unreadable renders as none; M10 every seat gets a block | red (10 / 2 / 1 failures) |
| Stale tree prints master's | AS-2 (4 tests) | M2 always read local; M3 absent read as unreadable | red (3 / 2) |
| Greeting-size includes the block | AS-4 (2 tests) | M4 composeGreeting drops it | red (2) |
| Write path, refusals | AS-5 (16 tests): dry run, real write, state.json untouched, unknown seat, planner seat, missing/empty task_id, task not in record, task done, missing brief/owed, bad date, unknown key, clear with nothing live, stale revision, bad op refuses whole batch, mixed batch through ob_state | M5 accept unknown seat; M7 skip the done check; M9 accept missing task_id | red (1 / 1 / 2) |
| (c) replaced assignment kept | AS-6 | M6 replacement drops the old entry | red (1) |

M5, M8 and M9 were first written type-invalid (tsc caught them) and redone; the table is the second versions. Mutant script and SHAs: the mutant runs were in-place edits restored by file, not branches; the base commit is `5b9eab0a` and the tree was clean after each.

**True red at base:** the new test file imports a module that does not exist at the base commit, so every row is red there by construction; the mutants are the evidence that each row fails for its own reason.

## Proof

- `npx tsc --noEmit`: exit 0.
- Full suite, unpiped, exit code read directly: `npx vitest run` exit 0, 127 files passed (7 skipped), 1825 tests passed (75 skipped). On this machine only; not CI.
- `sync --check`: 28 passed, 2 issues, both **pre-existing and not caused by this work**: `greeting-size` (49,628 characters, over 40,000; the block is 60 characters of it; T-183 is open) and `retirements` (ENTITIES.md names two retired words). Warning: `ci-status` reports master 9c60361 as failure.
- Not run: GitNexus `impact`/`detect_changes`. There is no `.gitnexus` index in this worktree and the MCP tools are not connected here (`gitnexus-index` skips in every non-main checkout). Blast radius was read by hand: `handleStart`, `handleState` and `composeGreeting` each gained one additive block; `composeGreeting`'s `parts` type gained a field (one consumer, `checkGreetingSize`, updated).

## Limits

- Assignments are keyed by the seat role (`developer` / `qa`), so two seats sharing a role (sia-builder, sia-forge, sia-infra are all "developer") **share one assignment**. That is exactly G-049; T-203 is the fix and this file does not pre-empt it.
- The Cursor `/start` does not print the block (T-197).
- Unpushed. A merge needs Aaron's yes in the planner session.
