# Builder roll handoff, addendum 2 (2026-10-02, usage AMBER)

**Adds to** `builder-roll-handoff-2026-10-02.md` (#318) and `builder-roll-handoff-addendum-2026-10-02.md`. **Where they disagree with this file, this file wins.** Forge (builder, sia-builder), record session 157, `origin/master` at `64a70651`. Everything of mine is pushed; the tree is clean.

## What changed since addendum 1

| PR | task | code SHA (freeze) | state |
|---|---|---|---|
| **#302** | T-048 dropped counts, **round 2** (QA 258 row 9: the reject stood) | **`b4d929ae1a1491cfe0bde72b19747d5f6769038c`** (head `7e92b6f6`; was `b47eb897`) | open, **CI green on the head** |
| #299 | T-050 | `ddea392b` (head `483061d0`) | open; QA 258 ACCEPTED it |
| #292, #293, #320 | T-224, T-223, T-228 | `c77dce55`, `58e0ce15`, `e1ffa274` | open; QA 259 ACCEPTED all of B5; waiting for Aaron's morning word |
| #313, #314 | T-065, T-042 | `3b3b6c2a`, `41c87b16` | **MERGED** |

## #302 round 2, in one paragraph
The invariant is that absent and zero never collapse **for the reader**. Round 1 printed a count only above zero. Now: `Dropped 0 of N entries in the file` (recalled ids, file origin); `ob_start` prints `Session logs unreadable: N` and `Transcript directories unreadable: N` always, or `not searched` / `not scanned` when the scan did not run (new `session-start/scan-counts.ts`); a passing `hub-seats` check ends `; N seat names ignored` and is reported; the slot file records `workspace_unusable_roots` beside `workspace_root_count`. Four mutants (the restored `if (count)` guard first) are killed. Detail: `docs/loops/t048-developer-handoff.md`, "Round 2".

## Two things to know
1. **One line in sia-forge's file:** `open-brain/src/cli-bootstrap.ts` gained `workspace_unusable_roots: workspace.unusable_roots,` (the SessionStart hook is the only caller of `describeWorkspaceDir`, so the slot is the only reader). No `sync/checks.ts` or `sync/index.ts` change. If forge edits that region, the rebase is one line.
2. **Test files are not type-checked (T-152).** A missing `readFileSync` import in `cli-bootstrap.test.ts` passed `tsc` and was caught by running the file. The lesson from the roll handoff stands: run the file that pins the behaviour you changed.

## Open items
Nothing owed. If QA rejects any open PR above, Atlas sends the round. Backlog gate (no new code PR while 6+ await QA) is clark's; mine awaiting QA now: #302 (round 2), #292, #293, #320 (accepted, waiting for Aaron), #299 (accepted).
