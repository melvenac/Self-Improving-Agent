# T-179 + T-163: merge master into the frozen candidate. Brief for a FRESH developer session (record 124)

**By:** Atlas (planner), record session 109 · 2026-09-26. **To:** the Claude developer seat (Forge), record **124**, a
fresh session (D-035) in `~/Worktrees/sia-builder`.

## Why

T-179's candidate `66b2173` (handoff `828a9d3`, Forge 118) was built from master `820dacd`. **Master has since merged
the importer fixes, rounds 1–4** (`be7ddfb`, PR #162), and the research doc (`d2685fd`). `git merge-tree` shows
**real conflicts in three files:**
- `open-brain/src/cli.ts`;
- `open-brain/src/pipelines/state-import/index.ts`;
- `open-brain/tests/pipelines/state-import.test.ts`.

The importer creates the record that T-179's schema v3 changes, so the two meet in the importer. **QA scores the tree
that will merge** (QA 122's lesson), so the merge happens before T-179's QA (record 125), not after.

## The work

1. `/start`, record **124**. **Aaron sets your effort in the session.** Report yours from the transcript.
2. `git fetch origin && git switch -c loop/t179-merge origin/loop/t179-end`, then `git merge origin/master` (**`d2685fd`**
   or later; name it). Resolve every conflict. **Never rebase and never force.** A merge commit keeps both histories
   readable.
3. **The semantic check, which is the point of this round:** the importer (`state import --commit`) must now write a
   **schema v3** record. Its `handoffs[]` and `sessions[]` must follow T163-1's rules: keyed by uuid, and stamped from
   the registered session or, when the import has none, by the rule you choose. State that rule in the handoff.
   **The importer's own guarantees must still hold:** T-175 (no seeded SIA history), T-180 and R4-1 (stale and
   unreadable inputs block), and R3-1 and R3-3 (a refusal deletes nothing it did not create).
   - Add a test: an import on the merged tree produces a v3 record that `ob_state` accepts, and the migration leaves it
     unchanged (v3 in, v3 out).
4. **Red first for the new test** on the merged tree before any fix it needs. Then CI green on tcm, with the merged
   tree's full suite read per test. **All** importer tests (`state-import*`) and all T-179 tests must pass, with their
   counts named.
5. **Re-run T-179's seven mutants** on the merged tree (re-anchored if a line moved), plus QA 122's R4-1 mutants
   `r41-block` and `r41-refusal` re-anchored. Each must still be red.
6. Greeting: re-measure the planner, developer and qa figures (as in handoff §8) on the merged tree. It must be no
   larger than §8's AFTER plus any difference master itself brought.

## How

- No full local suite. `npx tsc --noEmit -p .` before every push. Push only `loop/t179-merge` and `loop/t179-merge-*`.
  Never master, never force, and read back each push.
- **Never write this repository's live `.agents/state.json`.** Scratch copies only.

## Hand back

`docs/loops/t179-merge-developer-handoff.md`, with:
- the master SHA merged;
- each conflict and its resolution;
- the importer's v3 rule;
- the runs;
- the mutants;
- the greeting figures;
- your model and effort.

Push it before messaging atlas. No `/end`.
