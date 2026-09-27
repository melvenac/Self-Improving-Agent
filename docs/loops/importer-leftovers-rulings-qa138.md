# Importer leftovers: rulings on QA 138, and round 5 (record 147)

**By:** Atlas (planner), record session 146 · 2026-09-27. **On:** `origin/qa/importer-leftovers-report` (357 lines,
ending `QA-138: REPORT COMPLETE`), which QA ran on the laptop, DESKTOP-0GV3HAD. **The planner read:** the Verdict, What
could not be verified, Defects, Observations, Disagreements, error entries and Open for the planner. **It did not
read** the candidate's code or QA's probe outputs. The rulings below turn on QA's evidence; round 5 is what reads the
code.

## Verdict accepted: PASS. `d500730` merges after T-179 round 2, in the stacked order

- R4-4, R4-5, O7 and O14 hold on the merged tree, and all three judged inputs were tested, not only INBOX.md.
- None of D1–D3 is a way past the STALE block or a regression of the rulings. So they do not hold the merge.
- **Disagreement 1 is accepted.** "Contradicts QA 122's O13" becomes **"depends on the process token"**: with
  `SeBackupPrivilege` enabled, a `FileShare.None` hold does not block the read. Both seats were right.
- **Disagreements 2 and 3 are accepted.** The rule tests for any line starting `# `. The comment at `index.ts:595`
  overclaims.

## Round 5 rulings

- **R5-1 (D2): the title rule is narrowed to "no ATX heading at any level"**, i.e. no line that is `#` to `######`
  followed by a space or the end of the line. Its evidence is worded by decode path:
  - a file read as valid UTF-8 says it **"has no heading line"** and makes no claim about its encoding;
  - the encoding sentence stays only where the decode path justifies it.

  **Why:** the rule exists to catch a garbage decode (UTF-7, where `#` is `+ACM-`; zero bytes; a lying LE BOM over
  UTF-8). A `##`-sectioned next-session.md is a legitimate file: `/end` A7 writes one, and `importHandoff` reads `##`
  sections. Blocking it as an encoding failure is a false claim to the operator. QA's analysis says the narrowed rule
  keeps all three garbage shapes blocked. **Rows:**
  - QA's D2 row;
  - a `##`-only next-session.md is judged by its heading, as at `1646567`;
  - UTF-7, zero bytes and the lying LE BOM stay blocked;
  - the wording row asserts no encoding claim on a valid-UTF-8 file.
- **R5-2 (D1): an odd-length input with a UTF-16BE mark is filed `unreadable`,** per file. Its evidence names the file,
  the `FE FF` mark and the odd byte count. It never throws.
  - So a not-judged DECISIONS.md or session log of that shape follows R4-5: named, and not blocking.
  - A judged input of that shape blocks, with that evidence.
  - Rows: QA's D1 rows, which cover INBOX, task, DECISIONS and the latest session log.
- **R5-3 (O-b):** the EBUSY refusal adds the cause and the remedy after Node's message. For example: "another program
  holds this file open; close it and re-run".
- **R5-4 (O-c):** give the CLI-spawning importer tests (`state-import-leftovers.test.ts`, the R4-5 CLI row) and
  `tree-currency`'s DIVERGED row explicit timeouts. `tree-currency` also timed out in Forge 141's local run and in QA
  135's, so it is not one machine's quirk.
- **D3: recorded, not fixed.** It is the mirror of R3-2's `>>` class, it is older than the leftovers, and it surfaces
  as unparsed lines. It goes to the record as a gap.
- **O-a: the planner's, not the developer's.** From now on a QA dispatch that tests a read path says whether the seat
  runs elevated, and asks for the probes with and without `SeBackupPrivilege`.
- **O-e (the singular "snapshot" with 2+ markers): fix it if it is one line.**

## Round 5 brief (record 147)

- **To:** a fresh Claude developer session (D-035) in `~/Worktrees/sia-infra`. **Branch** `loop/importer-leftovers-r5`
  from `origin/loop/importer-leftovers-r2` (`d500730`). It stays stacked on T-179 round 2.
- **Read ONLY:**
  - this file;
  - QA 138's Defects, Observations and §2 (`origin/qa/importer-leftovers-report`);
  - QA's green tests on `origin/qa/importer-leftovers-tests`;
  - the round-2 leftovers handoff `cba0e14`.
- **Red first:** QA's D1 and D2 rows at `d500730`, read per test on tcm. Then one mutant per protection: the old
  `# `-only rule; a throwing BE decode; the old encoding wording. Run `npx tsc --noEmit -p .` before every push.
- **Preserve:**
  - every R4-4 shape QA 138 §1 lists stays `could_not_tell/unreadable`, with a bare `--commit` refusing;
  - R4-5's naming;
  - O7 and O14;
  - the STALE block.
- Scratch only. Push only `loop/importer-leftovers-r5` and `loop/importer-leftovers-r5-*`. **Push the handoff BEFORE
  messaging atlas**, and report your effort from the transcript. No `/end`. No laptop (`windows=true`) CI without
  asking atlas: the laptop is running QA.
