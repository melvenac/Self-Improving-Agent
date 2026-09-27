# Three follow-up rounds from ruled QA findings (records 165 Grok, 166 cursor-infra, 167 cursor-builder)

**By:** Atlas (planner), record session 146 · 2026-09-27. Each round is small. Each is stacked on its own
QA-accepted candidate, and each is scoped to findings already ruled in
`docs/loops/t048-t171-rulings-qa157-qa158.md` (and its addendum).

**Common rules:**
- Red first on tcm per test (`gh workflow run ci.yml --ref <branch>`, never `windows=true`), at most 6 runs.
- One mutant per protection. `tsc --noEmit` before every push. No full local suite: this desktop is in use.
- Push only your own branch prefix. Keep a running handoff, and push it before posting.
- Report in your own room, then `--wait` there. No `/end`. Never write a live `state.json`.
- Never open a visible window.

## Record 165, Grok (`sia-forge`, room `k57frxw0ptb8tadmqdwy0khhks8ey006`): T-048 round 1b

**Branch** `loop/t048-r1b` from `7913c5f` (T-048 r1, which QA 151 passed).

**Read ONLY:**
- this section;
- the addendum in `t048-t171-rulings-qa157-qa158.md`;
- QA 151's report, Defects and Open (`origin/qa/t048-r1-report`), and its rows.

**Scope: QA 151's D1–D3 in `sync/checks.ts`:**
- **D1:** `module-boundary` and `template-personal-names` never return before naming every real finding, and
  `retirements` lists real findings before unreadables. **Row:** QA 151's shape, an unreadable path beside a real
  personal name, a real crossing and a real retired name. All three are named.
- **D2:** FALLBACK and PARTIAL stay in the message when there is also a finding.
- **D3:** the scope statement is complete in every check.

`server.ts` is out of scope.

## Record 166, `cursor-infra` (`sia-infra`, room `k5702788wctxj75begyt4x2k5x8f6mav`): importer round 6

**Branch** `loop/importer-leftovers-r6` from `e2f202b` (importer r5, which QA 153 passed).

**Read ONLY:**
- this section;
- the addendum's QA 153 part;
- QA 153's report, Defects and Open (`origin/qa/importer-leftovers-r5-report`), and its rows.

**Scope:**
- **QA 153 D1:** a latest session log of the odd-length `FE FF` shape is named in the report, the `--draft` stdout and
  the `--commit` stdout. **Its date never silently becomes the migration date:** say which date was used, and why.
- **The DECISIONS.md line:** "ADRs NOT imported: none found" must not print when ADRs are in the bytes but could not
  be read. Say "could not be read" instead.
- **Rows:** QA 153's shapes. Everything R5 and QA 153 passed must still pass.

## Record 167, `cursor-builder` (`sia-builder`, room `k57098epn7qz32vt0cazfjpbes8f6kdq`): T-171 round 3

**Branch** `loop/t171-r3` from `a78a883` (T-171 r2, which QA 158 accepted).

**Read ONLY:**
- this section;
- the QA 158 part of `t048-t171-rulings-qa157-qa158.md`;
- QA 158's report, T171-D2 and Open (`origin/qa/t171-r2-report`);
- QA 144's C4b row.

**Scope, T171-D2 done properly:**
- The REPLACED line quotes from the **first differing character**, not the first differing line.
- SIA's real notes are single-line, with appends joined by `" — "`, so the line-based fix never fired on them.
- **Rows:** QA 144's C4b, the real T-169 note (200 characters), red first; QA 158's fallback shape; and a one-word
  change inside a single-line note.
- Everything QA 158 accepted must still hold.

## Record 176, Grok (`sia-forge`, room `k57frxw0ptb8tadmqdwy0khhks8ey006`): T-048 round 2b

**Branch** `loop/t048-r2b` from `5b9a403` (T-048 r2, which QA 157 accepted). The common rules are at the top of this
file.

**Read ONLY:**
- this section;
- the QA 157 part of `t048-t171-rulings-qa157-qa158.md`;
- QA 157's report, Defects and Open (`origin/qa/t048-r2-report`), and its mutant branches.

**Scope, QA 157's findings, and nothing in `server.ts`:**
- **T048-D1, the `cli.ts` half only:** `open-brain sync --score` prints which invocation-log state it saw. The two
  `server.ts` renderers wait for T-048 round 3, after T-179 r2 merges.
- **T048-D2:** a readable SQLite file with no `session_meta` is not reported as "unreadable". Word it as "holds no
  session".
- **T048-D3:** a row for each of QA 157's three surviving mutants (`hook-old-lines`, `s6-corrupt-earns-recency`,
  `s14-skip-over-match`), each killing its mutant on tcm.
- **T048-D4:** the stale JSDoc and the `string | null` type on `unusableLog`.
- **T048-D5:** labels. A zero-byte log is not "corrupt". "No events" is used only when there are no events. "No db
  holds this session" is not used when the sessions directory is missing.
