# T344 review: the budgeted briefing prints the pick-up whole and totals its capped lists (PR #1127)

Runtime: CC (claude -p, Opus)
SEAT: job runner (QA PC or Lenovo), NOT the desktop. No hub key. **Read-only: no commit, no push, no PR, no PR comment,
no edit outside the launcher's clone.** Ends at a VERDICT, which decides an SG-1 merge. You are the QA judge; the build
was a separate run (job 1278), so you are not judging your own work.
REPLY: the absolute reply path the launcher names. Print it FIRST. Line 1 of the reply is `VERDICT: ACCEPT`,
`VERDICT: ACCEPT-WITH-NOTES` or `VERDICT: REJECT`; line 2 is `MODEL: <your model id>`.

**By:** Atlas (planner), 2026-11-17, session 178. **Tasks:** T-344, T-312. **Tag:** `t344-review`.
**Spec:** `docs/loops/t344-brief.md` (in the launcher's clone); the behaviours are its (a) to (e).
**START:** `5d78fb5da3f78a1bd605a80f7e89cbf784241171`. **CAND:** `4ebf6d23f2b82868d752bedf581aeef5abb93165` (one commit on START,
branch `loop/t344`). Review CAND, never the launcher's own sha: `git fetch origin loop/t344` and
`git checkout -q 4ebf6d23f2b82868d752bedf581aeef5abb93165`.

```text
IMPACT-TARGETS: none: review only; no repository file is changed
```

## Already proved by the planner (do not repeat)

- CAND is byte-for-byte START + `docs/loops/t344/edits.txt` (byte-compare, 7 files SAME, no EXTRA).
- The build run reported: the twelve step-4 files 164 passed; mutants m1-m7 each red as predicted; full suite 5007
  passed, 1 failed (`tests/harness/checks.test.ts` D4, an npm error on the Lenovo host, also red in the t343 run on the
  unrelated t343 change).

## Rules

- Do not read, copy or print `~/.claude.json`, `~/.claude/settings.json`, any `.mcp.json`, `.env` or key file.
- Paste each command with its output. Every number is pasted output. Mark anything not run NOT RUN, with the reason.
- A finding needs file:line at CAND and a concrete failing input (a handoff or record shape and the lines printed). Put
  style points under NITS, apart from findings.

## Steps

1. `node -v` must print `v22.*`. `git rev-parse HEAD` must print CAND. `git diff --name-status 5d78fb5d..HEAD` must
   print 7 paths, all `M`: `open-brain/src/pipelines/session-start/briefing.ts` and six test files.
2. **Read** `git diff 5d78fb5d..HEAD -- open-brain/src` and `renderBudgeted` whole at CAND. Answer each, with the line:
   a. **Legacy layout.** Is any line that runs when `budget` is not true changed? (`a2a-byte-identical` is green; say
      whether a shared helper such as `cut` or a shared constant changed behaviour for the legacy path.)
   b. **Tests weakened?** Six existing test files were edited. For each changed assertion, say whether the new
      expectation is the old one with the new value, or a weaker check (a removed assertion, an exact match turned into
      `toContain`, a subtraction that could hide a real overflow). The budget rows now subtract the pick-up text: can a
      briefing whose NON-pick-up part exceeds `BRIEFING_BUDGET.chars` still pass any of them?
   c. **Header totals (a).** Does a header carry `(N)` exactly when items are hidden, and is N the count the record
      holds for that list (not the shown count, not including resolved questions the section already omits)?
   d. **Expiring items (b).** With more watch-outs than the cap: is an item with `expires` ever hidden while one without
      is shown? What happens to an item whose `expires` date is already past, and to `expires` given as a session number?
      Is the printed order still the record's order?
   e. **`WAITING ON AARON: none` (c).** Can it print while an unresolved Aaron-owned question exists in any handoff the
      reader is shown (another seat's, a legacy unattributed one, a question object with `owner` in a different case)?
      Can it print twice, or together with a non-empty WAITING ON AARON section?
   f. **Pick-up (d).** For a pick-up of 4000, 4001 and 20000 chars, and one with no sentence end at all, what is
      printed and how long is it? Can `cutSentence` return an empty string, loop on a pathological input (its regex uses
      lookbehind and `matchAll`), or cut inside a surrogate pair or a backtick-quoted command? Do the merged-sha and
      MAYBE SHIPPED notes still print in full after a whole pick-up?
   g. **Word back-off (e).** Can `cutWord` return more than the cap, or back off into an empty or whitespace-only
      string? Is the `... (N chars)` suffix still the full original length?
   h. **Size.** `greeting-metrics.ts` still writes the full block's size. With a 4000-char pick-up and the worst-case
      rest, how many chars and lines is the briefing? Does anything in `open-brain/src` (a `/sync` check such as
      greeting-size, an alarm, a refusal) fail or warn on that size? `git grep -n "BRIEFING_BUDGET\|budget_chars\|greeting_chars" -- open-brain/src`.
3. **Run**, in `open-brain`: `npm ci`; `node -e "require('better-sqlite3')"`;
   `npx vitest run tests/pipelines/session-start tests/pipelines/sync --no-file-parallelism --testTimeout=180000` (paste
   `Test Files` and `Tests`, and any `T302-WORST` / `B1-MEASURE` lines).
4. **Surviving mutants.** Name any single-line change to `renderBudgeted`, `shownWatch`, `cutSentence` or `cutWord`
   that the step-3 files would NOT catch. For each, apply it, run the session-start directory, paste the result, and
   restore with `git checkout -- <file>` (allowed here: the clone is yours and nothing is committed). Try at least: the
   header total using the shown count; `expires` items placed first in the PRINTED order; `none` printed
   unconditionally; the safety cap compared with `>=`.
5. **Live shape.** `npm run build`, then a one-file node script against the build that calls the briefing renderer (or
   `node open-brain/build/cli.js start <fixture>`) on a fixture record with: a 900-char numbered pick-up, five
   watch-outs of which the last has `expires`, six open questions of which three are Aaron's, and `briefing_budget` on
   in `.agents/SYSTEM/greeting.json`. Paste the block from `## Briefing` to `## End Briefing`. Then the same record with
   no Aaron-owned question. Say in one line each whether a reader could tell what is hidden and where it is.

## Verdict

REJECT for: a legacy-layout change (2a), a weakened budget check that lets a real overflow pass (2b), a wrong or missing
total (2c), an expiring item hidden behind a non-expiring one (2d), `none` printed while a question waits (2e), a
pick-up under 4000 chars that is cut or an empty/looping cut (2f, 2g), or a surviving mutant that changes what a reader
sees. ACCEPT-WITH-NOTES for anything else worth a follow-up. List findings, then NITS, then what was NOT RUN.
