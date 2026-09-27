# T-193 developer handoff — worktree-layout

**By:** Forge (developer). This Cursor seat had no `SESSION_UUID`, so `ob_set_session` was not bound.
**Model / effort:** Grok 4.7, in Cursor. This transcript has no per-entry effort field, so none is reported.
**Base:** `origin/master` `677c1dd`.
**Branch:** `loop/t193-worktree-check`.
**Brief:** `docs/loops/session-147-dispatches.md` on `origin/master`, section Record 186.
**No `/end`.** The live `.agents/state.json` was not written.

**"It works" is not a claim this seat can make.** What follows is what ran, and what it printed.

## Running note

The first commit on this branch is the red run. `checkWorktreeLayout` returns pass for every root and does not classify worktrees. The rows in `open-brain/tests/pipelines/sync/worktree-layout.test.ts` are the final rows. Locally, against that product, five of them failed and the wiring row passed:

- loop-named folder: expected `issue`, received `pass` (`worktree-layout does not classify worktrees`)
- main checkout and seat folder: message did not contain `Walked 2`
- no seat file: expected `skip`, received `pass`
- different seat list: message did not contain `Walked 2`
- git failing to list: expected `issue`, received `pass`

tcm run ids are filled in after they exist.
