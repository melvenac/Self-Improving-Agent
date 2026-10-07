# QA 289, session-164 batch b: #489 END-FIX (T-246)

**By:** Atlas (planner), 2026-10-07, record session 164. **Machine:** the laptop (Windows), booked through clark.
**Read first:** `docs/loops/end-fix-brief.md` (rows E1–E7, acceptance Q1–Q12) and
`docs/loops/end-hook-evidence-2026-10-07.md` (worth-it beab87e9, the case this fixes).
**Do not read** any hub room or the developer's report until your report is pushed. Judge the code, not the claim.
**Merge authority:** #489 changes `open-brain/src`, so the merge is Aaron's word. **Gates:** the Makerspace import waits
for this verdict.

**Narrow:** one test file per vitest run, mutants on touched files only, `tsc --noEmit`, `npm run typecheck:tests`,
`gh` reads. No full suite.

**Pinned head (CI `test` green, read by the planner):**

| PR | Task | Head | CI run | Mutant branches (each one commit on the head; CI read red by the planner) |
|---|---|---|---|---|
| #489 | T-246 END-FIX | `1dac7b8a528bc2352b3eaf37792d9a2f204a3431` | 37630055218 | `loop/end-fix-mut-m1` (E1 loop-only) run 37631307220 · `-m2` (E3 warns) 37631314012 · `-m3` (E5 counts dedup) 37631319809 |

## Rows

1. **Confined.** `git diff origin/master...1dac7b8a` touches only `open-brain/src`, `open-brain/tests`, the two
   `end.md` copies and `CHANGELOG.md`. List every file.
2. **CI and mutants.** Confirm the head's `test` run is green. For each mutant run, confirm that its red tests are
   the Q11 rows it should break. **A mutant that is red only from an unrelated failure does not count.**
3. **Q1–Q12, re-derived.** Build each fixture yourself in temp git repos and a temp DB (`KNOWLEDGE_V2_DB` under
   `C:/qa-tmp`), and drive the **real** `ob_end` path and the **real** SessionEnd hook entry (`cli-session-end`). Do not
   rely only on the PR's own tests. For each row, record the exact output line you saw. Q1 must name the commits and the
   tag. Q3 must close only after `set_handoff` for **this** uuid. Q4 must show the `record_ok` reason in the next
   greeting exactly once.
4. **The worth-it shape, end to end.** Rebuild beab87e9's case:
   - an old-layout repo (prose files, no `state.json`);
   - three trailered commits on **master**, plus tags `v0.14.0` and `v0.15.0` and a `package.json` version bump;
   - `next-session.md` untouched.

   `ob_end` must refuse. Then add one more commit **after** a successful close (with `record_ok`) and run the SessionEnd
   hook: the next `ob_start` greeting must print `WORK AFTER /end` once, then not again.
5. **Cannot-check paths say so, and never pass.** `ob_end` and the hook with:
   - no git;
   - not a repository;
   - no transcript;
   - an unreadable `state.json`;
   - no proven session (the Cursor shape).

   Each must say that it could not check. A silent close counts as a finding.
6. **Over-refusal.** A reading-only session (no commits) closes. A session whose only commits are untrailered closes
   with them reported as unattributed (T-212), and is not refused for them. A `loop/*` seat with a
   `docs/loops/*-handoff.md` passes (Q7). **Name any normal session shape you find that is refused wrongly.**
7. **E5 dedup.** Recall with `purpose: "dedup"` only, then a real recall of the same entry. That entry must be rateable
   (the real use wins). Dedup-only entries must be absent from `ob_recalled`.
8. **Your own mutants** (beyond M1–M3): (a) E2 old layout reads mtime but ignores an uncommitted edit; (b) E4 ignores
   `ob_end`'s stored time and uses the session start; (c) `record_ok` with an empty string is accepted. Name the test
   that goes red for each; a mutant that stays green is a finding.
9. **Windows.** Q1, Q3 and Q6 with CRLF files, backslash paths and a repo path containing a space.
10. **`end.md`.** Both copies are identical. The refusal and `record_ok` section matches what the code does. Nothing
    else was removed.
11. **E6 reads.** Check the developer's E6(a) claim (foreign `.recalled-entries.json` ids are never rated) with one
    fixture. Check E6(b) (nothing writes `Session_N.md` at end) by reading the code. Report both; neither blocks.

## Rules (headless Claude Code)

- You are **QA 289**, prefix `s164b`. Push ONLY `qa/s164b-*` branches, and only through
  `node docs/loops/qa-289/push-qa.mjs <branch>`, run from your `qa289-wt` tree.
- **Never create, comment on or edit an issue or a PR.** Use `gh` only to read.
- Never read the real knowledge DB or a real vault for anything other than counts, names and paths (G-051). Make no
  live Jev call. Never print a key.
- **Sandbox (D-131):** if you run ANY command with the sandbox disabled, list each one in the report under a heading
  `Unsandboxed commands`, with its purpose and every path it touched. If there were none, write `Unsandboxed commands:
  none`.
- Commit `docs/loops/s164b-qa-report.md` on `qa/s164b-report`. Put the verdict with its pinned head first. The report's
  last line is exactly `QA-289: REPORT COMPLETE`.
