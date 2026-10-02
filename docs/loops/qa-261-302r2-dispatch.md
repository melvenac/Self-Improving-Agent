# QA 261: #302 round 2, the narrow re-check (T-048 dropped counts, printed at zero)

**By:** Atlas (planner), 2026-10-02, record session 157.

**What this re-checks:** QA 258's row-9 REJECT of #302 (`docs/loops/b4-misc-qa-report.md`, report `64cee8ab`) and the
planner's ruling in D-105: absent and zero must never collapse into one value for the reader.

**Merge authority:** this re-check is NOT under Aaron's overnight pre-approval. An ACCEPT waits for his word.

**QA runs on Opus. Job class: LIGHT.** That means touched test files, **one test file per vitest invocation**, mutants
on touched files only, and `gh` reads. No full suite. **Make no live Jev call.**

**Candidate:**

- **PR:** #302, `loop/t048-dropped-counts`.
- **Head:** `7e92b6f641ad776d886037e54139cb0e6fd4b617`.
- **Code SHA:** `b4d929ae1a1491cfe0bde72b19747d5f6769038c`.
- **Round 1 head:** `ac4323f4`.
- **Handoff:** `docs/loops/builder-roll-handoff-addendum-2-2026-10-02.md` on master, and the T-048 handoff on the
  branch.

## Rows

1. **Confined.** List the round-2 diff with `git diff ac4323f4 7e92b6f6 --stat`. Name every file. One line in
   `cli-bootstrap.ts` (DC-7) is expected; quote it.
2. **Zero reaches the reader.** For each site below, show the output that a seat or `/sync` actually prints, with
   nothing dropped:
   - **DC-3:** `formatRecalledResolution` prints the dropped line at 0 for a file origin.
   - **DC-4 and DC-5:** `ob_start` prints `Session logs unreadable: 0` and `Transcript directories unreadable: 0`.
     When the scan did not run, it prints `not searched` or `not scanned`. Show that both forms appear and that they
     differ.
   - **DC-6:** a passing hub-seats check ends `; 0 seat names ignored`, and sync prints it (`report:true`).
   - **DC-7:** the slot file carries `workspace_unusable_roots`. Show it written by the real hook on a scratch slot
     path.
3. **Red then green.** Run `t048-zero-case.test.ts` and the changed `cli-bootstrap.test.ts` against `ac4323f4`'s
   source; they should fail. Then run them on the head; they should pass. Quote the counts.
4. **Mutants.** Re-run the developer's four:
   - the `if (count)` guard restored;
   - scan-counts silent at zero;
   - the hub-seats count dropped;
   - the slot line deleted.

   Add one of your own.
5. **Nothing regressed.** Run the round-1 rows `t048-dropped-counts.test.ts` and `checks-state.test.ts`, plus
   `server`, `recalled-ids`, `active-session` and `hub-seats`. Run each one on its own. Then `tsc --noEmit`.
6. **CI on the head (read only).** Run `gh pr checks 302`.
7. **Merge with B4.**
   - On a scratch branch from `origin/master`, merge #289 at `be32de21` first, then #302 at `7e92b6f6`. #289 also
     touches `cli-bootstrap.ts`.
   - Report any conflict.
   - Run the touched tests and `tsc` on the result.

## Rules (headless Claude Code)

- You are **QA 261**, and your prefix is `t048r2`.
- Push ONLY `qa/t048r2-*`, and only through `node docs/loops/qa-261/push-qa.mjs <branch>`, run from your `qa261-wt`
  tree.
- **Never create, comment on or edit an issue or a PR.** Use `gh` only to read.
- From real config files, report only counts, names and paths. Scan for key and token patterns before you commit.
- Commit `docs/loops/t048r2-qa-report.md`, with its `.E_t.json`, on `qa/t048r2-report`.
- The last line is exactly `QA-261: REPORT COMPLETE`.
