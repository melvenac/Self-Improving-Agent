# T-185: rulings on QA 120, and round 2 (record 121)

**By:** Atlas (planner), record session 109 · 2026-09-26. **On:** QA 120's report, `origin/qa/t185-report` `8873a4d`,
297 lines, ending `QA-120: REPORT COMPLETE`. The planner read the Verdict, R185-4's check, Defects, Disagreements
and "Open for the planner".

## Accepted

- **The verdict: ACCEPT `9473b0d` with a short round 2.** Every typo on every command in the table refuses with exit
  2, names the token, and leaves the target byte-identical, except D1.
- **R185-4: NO CONFLICT** with importer round 3. The merge check was run in a scratch clone: tsc clean, 54 of 54 T-185
  tests, and the importer tests passed on the merged tree.
- **QA's disagreements, all three accepted:**
  - `setup.mjs` does not register SessionEnd or the recall trigger; README does. The dispatch was wrong.
  - `detectIde` overrides `--ide` only for a payload carrying `cursor_version`. R185-1's conclusion (do not refuse)
    stands on its other reason: a refusal at session start fails every session.
  - The handoff's "a declaration typo cannot lock a flag out" is true, but it is only half. The other half is D2.

## Round 2 (QA's Open 1 and 2, as QA recommends)

- **R185-5 (D1, medium): a typographic dash is an unrecognised flag.** `parseArgs` treats a token that starts with
  U+2010–U+2015, U+2212, U+FE58, U+FE63 or U+FF0D as an unrecognised flag: exit 2, named as "a typographic dash".
  **And, separately, `state migrate` checks that every named file exists and parses before it writes ANY of them.**
  Both are needed: the first closes the token, and the second closes the shape, a refusal that says "nothing was
  written" while another file was written. **Known positive:** QA's
  `qa: state migrate --seat developer —dry-run <f>` (in `probes.mjs`, and the last row of `qa120-t185.test.ts`).
- **R185-6 (D2, medium): each declared flag is matched against ITS OWN command's usage line.** **Known positive:**
  `qa/t185-mut-sync-declares-dry-run` (tcm `36212775645`, whole suite green). It must turn red.
- **R185-7 (D3, low): adopt QA's DB-not-created rows** (a per-test `KNOWLEDGE_V2_DB`, and the file is absent after a
  refusal). They must kill `qa/t185-mut-db-before-parse` (tcm `36212582133`).
- **R185-8 (D4, low): `inScratch()` also refuses** any argument that resolves to an existing path outside the OS temp
  dir. **Known positive:** QA's `qa120-inscratch.test.ts` A3. Its comment must claim only what the guard does.

**Not in round 2:**
- **QA's Open 3** (`cli-bootstrap` validating `--ide`'s value): no. It is outside T-185, and a wrong value only
  mislabels the slot.
- N1, N3 and N4 are recorded. N4 (the em-dash refusal on a directory command names it as a directory) is fixed by R185-5
  anyway.

## Brief (record 121)

- **To:** a fresh Claude developer session (D-035), record **121**, in whichever checkout frees first. **Branch:**
  `loop/t185-r2` from `origin/loop/t185-cli-flags` (`6e50cf8`).
- **Read ONLY:** this file, QA 120's Defects and its scripts (`git show origin/qa/t185-report:…`,
  `docs/loops/qa-scripts-t185/`), and T-185's brief §4.
- **Red first:** QA's known positives above, on `9473b0d`, as `loop/t185-r2-redcheck`, read on tcm per test. **A code
  mutant per protection:** at least the dash check removed, `state migrate` writing before checking, and the
  own-line match widened back to the whole text. `npx tsc --noEmit -p .` before every push. No full local suite.
- **Push only** `loop/t185-r2` and `loop/t185-r2-*`. Never master, never force, and read back each push.
- **Hand back** `docs/loops/t185-r2-developer-handoff.md` (a commit table, per-test red and green runs, the mutants,
  and your model and effort). **Push it before messaging atlas.** No `/end` (T-163).
- **Merge:** the planner reads the kills. QA 120's own scripts must pass byte-exact on the new tip, except the rows
  that R185-5 to R185-8 change. Then Aaron merges.
