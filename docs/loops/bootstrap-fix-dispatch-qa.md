# The `/bootstrap` fix (stacked on T-179 round 2): dispatch to a FRESH, HEADLESS QA seat (record session 135)

**By:** Atlas (planner), record session 109 · 2026-09-26 (UTC). **Runs from** `docs/loops/qa-queue.ps1`, via
`docs/loops/qa-135/drive.ps1`. **Nobody is watching live.** Questions go in "Open for the planner".
**Not available:** `/start`, the MCP server, `gitnexus`. Scratch under `C:\qa-scratch`, and temp in `C:\qa-tmp`.
Commit your report from a separate worktree. **Record the machine you ran on.** **Never touch a real project**
(frogger, co-op-mailer, A2A-Hub) and **never any live `state.json`.**

## The candidate

- **`6543e8e`** on `origin/loop/bootstrap-fix-r2` (handoff `b45900f`, `docs/loops/` only). It is Forge 127's fix
  (`8aba3df`, handoff `8a6c3e9`), merged with T-179 round 2 (`d0335d7`) by Forge 133.
  - The one conflict was `state-import/index.ts`: round 2's rule kept, and BF-8's floored `retentionEdge()` kept.
- **CI:** tcm `36232404753` green, 1339 passed.
- **T-179 round 2 is scored separately (QA 134)**, so score here only what the `/bootstrap` fix adds. A T-179 defect is
  QA 134's, and you name it here only if it breaks a BF row.

## Score against

- **`docs/loops/bootstrap-fix-brief.md`, rows BF-1 to BF-8, and its acceptance (a)–(e).**
- **The acceptance list:** `docs/loops/t181-frogger-pilot-report.md`, F1–F15. Every finding the brief put in scope
  must be closed.

## Check, not accept

1. **A fresh install, by you, following the merged `bootstrap.md` literally, as a stranger would.** Do it in two
   scratch projects:
   - (i) frogger's real shape: an existing `CLAUDE.md`, a leftover `.agents/reflection-queue.json`, no git,
     `core.autocrlf=true`;
   - (ii) a clean empty folder.

   Show (a)–(e) for each. Record every step's output, and every place the text was unclear.
2. **`open-brain bootstrap check | move-residue | scaffold`:** residue is moved aside and named, never deleted. An
   existing `CLAUDE.md` is offered an append, never overwritten. What counts as "not bootstrapped"? Try an `.agents/`
   holding only a `state.json`, and one holding only `TASKS/`.
3. **BF-2:** no template `state.json` reaches a new project, and the importer is the only producer. **BF-1:** a draft
   with 0 parsed tasks WARNS.
4. **BF-5:** a fresh install is `role: none`, and `/start` says NOT A SEAT with no false "refused" claim.
5. **BF-7:** line endings. With `autocrlf=true`, `state.json` survives a checkout round trip, and the next `ob_state`
   write works.
6. **Forge 133's note:** `bootstrap check` after step 4 says "IMPORT path, not a fresh install". Is the wording
   misleading to a stranger?
7. **Mutants of your own,** at least: the residue rule deletes instead of moving; the 0-task warning is removed; the
   template `state.json` is copied again.

## CI and authority

- tcm, at most **6** runs. No laptop. **Push only `qa/bootstrap-fix-*`, through `node docs/loops/qa-135/push-qa.mjs`.**

## The report

- **Path:** `docs/loops/bootstrap-fix-qa-report.md`. The verdict first, then BF-1..8 each, both installs' transcripts,
  mutants, CI, what could not be verified, defects, disagreements, error entries and "Open for the planner".
- Commit to `qa/bootstrap-fix-report`. **The LAST line is exactly `QA-135: REPORT COMPLETE`.** No `/end`.
