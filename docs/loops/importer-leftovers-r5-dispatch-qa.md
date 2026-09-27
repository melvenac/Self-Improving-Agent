# Importer leftovers round 5: dispatch to a FRESH, HEADLESS QA seat (record session 153)

**By:** Atlas (planner), record session 146 · 2026-09-27. **Runs from** `qa-queue.ps1` via `docs/loops/qa-153/drive.ps1`.
**Record the machine, and whether this process runs elevated with `SeBackupPrivilege` enabled** (QA 138's O-a: it
decides whether a share-None hold can block a read). Nobody is watching live. Use `C:\qa-tmp` and `C:\qa-scratch`.
Never write a live `state.json`. Commit the report from a separate worktree.

## The candidate

- **`e2f202b`** on `origin/loop/importer-leftovers-r5`. The handoff and evidence are at `b1c5b77`, and everything after
  `e2f202b` is `docs/loops/` only.
- Stacked on the round-2 leftovers `d500730`, which QA 138 ACCEPTED. **Score only what round 5 adds.**
- The product diff against `d500730` is `cli.ts` and `state-import/index.ts`, plus tests.
- **Built in two seats:** a Claude seat (record 147) wrote the code and stopped for usage limits. A Cursor seat
  (Grok 4.7) ran CI, the probes and `/sync`.
- **CI on tcm:** red `36286942468` (`c3b89d2`: 3 of QA 138's rows fail); green `36286944274` (1368 passed).

## Score against `docs/loops/importer-leftovers-rulings-qa138.md`: R5-1 to R5-4 and O-e

1. **R5-1:** the title rule is narrowed to "no ATX heading at any level".
   - A `##`-only next-session.md is judged by its heading again.
   - UTF-7, zero bytes and a lying LE BOM over UTF-8 are STILL blocked.
   - A valid-UTF-8 file's evidence makes no claim about its encoding.
   - **Re-run QA 138's §1 shapes, written by PS 5.1 itself, byte-exact.** Every R4-4 shape must still be
     `could_not_tell/unreadable`, with a bare `--commit` refusing.
2. **R5-2:** an odd-length `FE FF` input is filed `unreadable` per file and never throws.
   - A not-judged DECISIONS.md or session log of that shape is named and does not block (R4-5).
   - A judged input of that shape blocks.
3. **R5-3:** the EBUSY refusal names the cause and the remedy. **Run it with `SeBackupPrivilege` disabled**
   (`noprivprobe.ps1` from QA 138's scripts), or the read never gets EBUSY.
4. **R5-4 is wider than ruled:** the whole `tree-currency` describe block got the timeout. Check nothing else was
   loosened: no assertion changed, only timeouts.
5. **O-e:** the singular "snapshot" with 2 or more markers.
6. **Preserve:** R4-5's naming, O7, O14, the STALE block, and IF-10's +13/+1 behaviour as QA 138 recorded it.
7. **The developer's `/sync` at `65cdf9c` reported 4 issues.** Read them at the candidate against `d500730`'s: are
   `mirror-parity` (end.md, `.cursor/sync.md`) and `greeting-size` new with round 5, or inherited? Score only the new
   ones.
8. **Your own mutants,** at least one per ruling. QA 138's three survivors (the INBOX-only no-title rule, the BOM path's
   NUL offset, the "it is empty" wording) must stay killed.

## CI and authority

tcm, at most 6 runs. **No laptop (`windows=true`) CI.** **Push only `qa/importer-leftovers-r5-*`, through
`node docs/loops/qa-153/push-qa.mjs`.**

## The report

- **Path:** `docs/loops/importer-leftovers-r5-qa-report.md`.
- Order: the verdict first, then each item, mutants, CI, what could not be verified, defects, disagreements, error
  entries, and "Open for the planner".
- Commit to `qa/importer-leftovers-r5-report`. **The LAST line is exactly `QA-153: REPORT COMPLETE`.** No `/end`.
