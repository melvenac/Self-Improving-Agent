# Importer leftovers (R4-4, R4-5, O7, O14): brief for a FRESH developer session (record 131)

**By:** Atlas (planner), record session 109 · 2026-09-26. **To:** the Claude developer seat (Forge), record **131**, a
fresh session (D-035) in `~/Worktrees/sia-builder`. **Authority:** Aaron ("sia builder also clear"), and the planner's
rulings on QA 122, `docs/loops/importer-fixes-r4-rulings-qa122.md`. **Why now:** these are due before a non-fresh
Windows adoption, and **T-181's pilot 2, co-op-mailer, is an import.**

## Base: STACKED on T-179

T-179 (`loop/t179-merge`, `f618b73`) makes the importer write schema v3. T-179 round 2 (record 128, in `sia-infra` now)
does not touch `state-import/`.
- **Branch `loop/importer-leftovers` from `origin/loop/t179-merge`.**
- When `loop/t179-r2` is frozen, merge its tip in. Never rebase.

## The work (sites from QA 122's report, `origin/qa/importer-fixes-r4-report`)

- **R4-4 (D11):**
  - test the UTF-32LE BOM `FF FE 00 00` BEFORE `FF FE` (`index.ts` about `:124`), and file UTF-32 as `unreadable`;
  - put the NUL check on the BOM paths, so a BOM that lies becomes `unreadable`;
  - file a judged input with no readable `# ` title as `unreadable`. That closes UTF-7, any unnamed encoding and O12's
    zero-byte case.

  **Known positive:** `qa/importer-fixes-r4-d11` (`aff7135`, tcm `36215197448`). Add byte tests: UTF-32LE, UTF-32BE,
  UTF-7, zero bytes, and a UTF-8 BOM followed by UTF-16. **IF-10's +13/+1 still commit** (a readable title, a
  could-not-tell reason that does not block).
- **R4-5 (D12): a not-judged input does not block, but it is NAMED.** A DECISIONS.md with NUL bytes gets its NUL count,
  and which ADRs were and were not imported, in the report AND the `--commit` output. That is QA 122's probes-r4
  DECISIONS.md section.
- **O7:** the two-marker refusal names the **oldest** snapshot, and says what the newer one holds. It is a message
  change.
- **O14:** make the could-not-tell reason REQUIRED by type, so `blocksCommit` cannot fail open on a missing reason. The
  compiler then holds the list.

## How

- Red first on tcm (QA 122's `aff7135` rows and your byte tests), read per test. A mutant per protection. `npx tsc
  --noEmit -p .` before every push. No full local suite.
- **QA 111's `probes-r3.mjs` and QA 122's `probes-r4.mjs`, byte-exact, on your tip.** Each FAIL names the ruling that
  changed it.
- Scratch only. Never a real project, never SIA's live `state.json`. Push only `loop/importer-leftovers` and
  `loop/importer-leftovers-*`. Never master, never force, and read back each push.

## Hand back

`docs/loops/importer-leftovers-developer-handoff.md`, with:
- the T-179 SHA built on;
- a commit table built from each commit's own `git diff --stat`;
- per item, red, green and mutant runs;
- the probe results, row by row;
- your model and effort, from your transcript.

**Push it BEFORE messaging atlas.** No `/end`.
