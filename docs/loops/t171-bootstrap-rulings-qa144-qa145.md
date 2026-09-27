# Rulings on QA 144 (T-171) and QA 145 (/bootstrap r3), with the T-171 r2 (record 155) and /bootstrap r4 (record 156) briefs

**By:** Atlas (planner), record session 146 · 2026-09-27. **On:**
- QA 144, `origin/qa/t171-report` `d5a783a` (230 lines, ending `QA-144: REPORT COMPLETE`). Machine: the QA PC.
- QA 145, `origin/qa/bootstrap-fix-r3-report` `67af2b2` (447 lines, ending `QA-145: REPORT COMPLETE`). Machine: the
  laptop.

**The planner read** each report's Verdict, What could not be verified, Defects, Disagreements, error entries and
Open for the planner. **It did not re-read** either candidate's code for these rulings. For r3 it read `bootstrap/index.ts`
at `7f4ca74` before QA 145, and QA 145's rows F1–F3, G1 and G2 confirm that reading.

## QA 144: T-171 `b371176` ACCEPTED

- No op replaces a note without a `NOTE CHANGE` line, and the bare `note` is refused by name.
- `append_note` never removes a character, and the dry run and the write report identically.
- R171-1 holds.
- The disagreements are accepted. The superset case is D1.

**T-171 round 2 (record 155), stacked on `b371176`. It is required before T-171 merges,** because QA's
`superset-foreign-unflagged` mutant shows a one-token change would make D1 flagless with CI green.
- **T171-D1:** a replace that removes nothing keeps the previous authors in `note_by` and adds the writer. QA's fix
  line is the suggestion; the developer decides the form. **Row:** QA's C2h.
- **T171-D3:** QA's three rows, each killing its surviving mutant: `dry-run-hides-replace`, `removes-by-length` and
  `superset-foreign-unflagged`.
- **T171-D2:** the REPLACED line quotes text that was actually removed, or it says "old text began:". One line.
- **Open 2 (the record's stale watch-out and T-171's workaround note) and Open 3 (70 null-authored notes) are the
  planner's,** handled at merge in the close-out and the checklist.

## QA 145: /bootstrap r3 `7f4ca74` ACCEPTED

- R-BF-9 to R-BF-16 hold.
- **The real session-end hook writes into the child in install (iii), and the parent gains nothing.** On `6543e8e`
  it wrote into the parent.
- All four installs pass with no manual fix, and the driver fails on `6543e8e` as the known positive says.
- The disagreements are accepted. Handoff §6.1's caller list was taken from a stale index: 9 call sites, not 4.

**/bootstrap round 4 (record 156), stacked on `7f4ca74`. It is required before pilot 1b (frogger), not before the
merge:**
- **R-BF-17 (QA's Open 1, confirmed by run):** `state.json` is a record only if it is a JSON **object** that carries
  `schema_version`. Anything else is `NOT A RECORD — <what it is>`, and `move-residue` can set it aside.
  - This includes `{}` and `{"project":{}}`.
  - **Rows:** all seven of QA 145's shapes (`{}`, `[]`, `null`, `42`, `"text"`, `true`, `{"project":{}}`).
  - `/start`'s own fallback for non-objects predates this round and is a task.
- **R-BF-18 (QA145-D2 + Open 2's first narrowing):** in `isProjectRoot`, `.agents/state.json` counts as a root
  marker only when it is a record by R-BF-17. `.agents/SYSTEM` and `.agents/META` are unchanged.
  - **Row:** a zero-byte `.agents/state.json` between a real project and the cwd does not win the walk. It kills
    QA's Q6.
  - Open 2's second narrowing (`sync`'s auto-fix refusing a non-literal root) is not ruled. It becomes a task.
- **R-BF-19 (QA145-D1):** the nested STOP's `Next:` names both honest remedies: `git init` here makes this folder its
  own project, or move it out of the enclosing repository. `bootstrap.md` step 1 says the same. **Row:** QA's install
  N reaches (e) with the named step and no inference.
- **R-BF-20 (QA145-D3):** the failed-undo path is never printed as "refused". It says what moved, where, and what
  stayed. **Row:** QA's P-UNDO shape, through the CLI.

## Briefs (both to FRESH Cursor chats, per D-035; hub room `k57frxw0ptb8tadmqdwy0khhks8ey006`)

- **Record 155, T-171 r2:**
  - In `~/Worktrees/sia-infra`, as `--as cursor-infra`. Branch `loop/t171-r2` from `origin/loop/t171` (`b371176`).
  - Read ONLY: this file's QA 144 section; QA 144's Defects, Disagreements and Open; QA 144's mutant branches.
- **Record 156, /bootstrap r4:**
  - In `~/Worktrees/sia-builder`, as `--as cursor-builder`. Branch `loop/bootstrap-fix-r4` from
    `origin/loop/bootstrap-fix-r3` (`7f4ca74`).
  - Read ONLY: this file's QA 145 section; QA 145's Defects, Open, check 4 and its rows on
    `qa/bootstrap-fix-r3-qa-tests` (`2c279ad`).
- **Both:**
  - Red first on tcm per test, at most 6 runs, never `windows=true`. One mutant per protection. `tsc --noEmit` before
    every push.
  - Push only your own `loop/<branch>*`. Keep a running handoff, and push it before posting.
  - Report only through the hub, always with `--session`, never `--peer`. Report your model.
  - No `/end`. Never write a live `state.json`.
