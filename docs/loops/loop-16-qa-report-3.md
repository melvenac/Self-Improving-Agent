# Loop 16 — QA report 3: candidate `5351270`

**By:** Probe (QA seat; session uuid `6eab2c5c`) · **Date:** 2026-09-21 ·
**Candidate:** `5351270` (rev 14, tip of `loop/16-recall-trigger`) — one commit on `f7930d0` ·
**Base:** `origin/master` `4550ee5` · **Earlier candidates:** `45ee2ab` and `f7930d0`, both still
ancestors · **Criteria:** `75f05eb` · **Reports 1–2:** `a13f3c5` + `ef79340`, `c1b977a` ·
**Brief:** `8457600` with twelve amendments, re-derived from the branch at this commit:
`1453e5f c43a31f 1051cae 5ab0ac4 6da5fa9 f28ed11 3db1365 29766dc 0c70b52 084cf18 e0c1dd2 87cbb9d`.

---

## VERDICT — ACCEPTED

`R7` is implemented, tested in both directions, and **verified through the real built hook binary**
rather than through a unit call. Every other row that passed at `f7930d0` re-runs and passes. No
row regressed, nothing outside the permitted scope moved, and the full suite is green alone.

**The loop's result, stated once and plainly:** on 2026-09-21 at 04:08:29Z the trigger fired in a
real Claude Code session and put entry 299's `ACTION` beside a live tool result, unasked, on a
command whose exit code the seat would otherwise have read from a trimmer. **Eight loops after the
question was first asked, the memory half reached an agent at the moment of the act.**

**What this verdict does not cover** is in §7, and the largest item is unchanged from report 2:
nothing here shows that a seat *applies* what the trigger surfaces.

---

## 1. Conditions

| | |
| --- | --- |
| Identity | `commit`; tip of `loop/16-recall-trigger`; **14 commits** from base; first commit still `90e314f`; `f7930d0` and `45ee2ab` both ancestors — nothing squashed, rebased or reordered (`R9`). |
| Tree | Detached to `5351270`; `git status --porcelain` empty and HEAD equal **before the first observation and again after the last**; build stamp `5351270` at both ends. **Not void.** |
| Prepared | `npm run build` 0, stamped `5351270`; `tsc --noEmit` 0; `analyze` 0 first try; `sync --check` 0 — **27 passed, 0 issues, 0 skipped**; `module-boundary [pass]` 69 files / 48 core. |
| Exit codes | All written to a file and read back from it. |

## 2. `R27` — the diff, which decided the work

`f7930d0..5351270` is **three files, +146/−0**: the hand-off (+76), `open-brain/src/trigger/fires.ts`
(**+23**), `open-brain/tests/trigger/fires.test.ts` (+47).

**Exactly one `src/` file.** The whole change is inside `recordFire`'s `if (fire.state ===
"injected")` branch, within the existing transaction: one prepared `UPDATE knowledge_index SET
recall_count = COALESCE(recall_count,0)+1, last_recalled_at = datetime('now') WHERE id = ?`, run
per injected id.

**So `R27`'s condition is met** — the change is confined to the injection path's writes to those
two columns — and the re-run set is the targeted set, A5, A8's unit rows and the new test with its
mutants, with `f7930d0`'s live evidence standing and **no second registration of Aaron's
`settings.json`**. It was not touched in this round.

One detail worth keeping: the bump writes `datetime('now')` rather than the ISO string used for the
fire row, **deliberately, to match what `ob_recall` writes into the same column**. Two writers of
one column disagreeing on format is a defect this repo has paid for before.

## 3. `R7` — verified through the real binary, not only the unit rows

`R27` rules the unit rows sufficient. **I went further on purpose:** the row that failed at
`f7930d0` failed *live*, and accepting its fix on unit evidence alone would be a weaker claim than
the one that rejected it. So I spawned **`build/cli-recall-trigger.js`** — the same binary the host
runs — with payloads built by `JSON.stringify`, against scratch stores. Everything the live case
had except the host doing the spawning.

**Case 1 — injected, 599-document store.** Before: `recall_count 0, last_recalled_at null`. After:
**`recall_count 1, last_recalled_at "2026-09-21 04:22:08"`**, hook exit 0, `additionalContext`
emitted.

**Case 2 — not-asked (`git status --porcelain`).** Counters unchanged.

**Case 3 — repeated injection.** Counter accumulates (1 → 2 → 3 across three injections), so it
counts *reaches* rather than *entries*, which is what the ruling says it means.

**Case 4 — a GENUINE silent fire.** My first attempt at this was wrong and is recorded in §8: I
tried to force silence with nonsense command text, which cannot work, because the derivation
recognises *elements* (a trimmer pipeline; a `$?` read) and not the command's words — so
`zzqqxxyy 2>&1 | tail -3; echo $?` derives all three terms and injects like any other. The fires
table said so, and the mislabel was mine.
The real instrument is a **three-document store**: bm25's IDF collapses, every row scores ~5e-6,
nothing clears the shipped floor of 8.0. Result: fire state **`silent`**, hook exit 0, **stdout
empty**, and **not one of the three entries bumped** — `recall_count 0` and `last_recalled_at null`
across the board, before and after.

That is `R7` in both directions against the shipped artifact.

## 4. Mutants, run by me

Each target asserted **unique** before writing; each mutant `tsc --noEmit` clean before being
counted.

| mutant | tsc | result | killed by |
| --- | --- | --- | --- |
| **M23** — the bump removed (the `f7930d0` behaviour F3 rejected) | 0 | **red**, 2 of 14 | the two R7 rows |
| **M24b** — the bump also run outside the injected branch | 0 | **red**, 2 of 14 | the exact-count assertions |

**And a precision point about "M24" that the hand-off should not carry unqualified.** The hand-off
describes M24 as *silent fires bump*. **That mutant is not expressible as a single-point edit**, and
I could not build it: `FireRecord` has no considered-ids field, and `recordFire` **throws** on
`state !== "injected" && injectedIds.length > 0`. So a non-injected fire cannot carry an id to bump,
and the bump iterates `injectedIds`. *"Looked-at does not bump" is doubly structural* — which is
what the code's own comment claims, and the claim is correct.

My first attempt invented `fire.consideredIds`; `tsc` rejected it (exit 2) and at run time it fell
back to `injectedIds`, so **the tests passed and the mutant proved nothing** — the M22 situation
arriving again. What I could build type-cleanly (M24b) is red. **I am not reporting the hand-off's
M24 as wrong; I am reporting that I could not reproduce that shape and why, and that the property
it targets is structural rather than test-covered.** The developer should say what shape its M24
took.

## 5. Everything re-run

- **The candidate's own `fires.test.ts`:** 14 tests, exit 0, including the four new R7 rows
  (injected bumps; looked-at does not; not-asked touches neither; repeated injections accumulate).
- **Targeted set**, my enlarged version: **15 files, 211 tests, exit 0**.
- **Full suite alone:** **71 files, 1031 tests, all passed, exit 0**, no unhandled error, 116.64s.
  **No victims, so no `R12`(i)/(ii)/(iii) case arises.**
- **A5, A1(a)/A1(b), A2, A3, A4, A6, A9, `R21`** — all inside the targeted run and all green; the
  `src/` diff cannot have moved them and the run confirms it rather than assuming it.
- **Hand-off §§17–21** present, citing `87cbb9d`.

## 6. A10 — re-measured, and the floor is the control

`R27` did not list A10, and `R22` has ruled it unscored — but **the change adds a write to the
injected path**, so the number could have moved and assuming otherwise would be the habit this loop
keeps punishing.

| arm | `f7930d0` p95 | `5351270` p95 |
| --- | --- | --- |
| interpreter floor | 70.0ms | 84.6ms |
| not-asked | 251.8ms | 281.3ms |
| injected | 255.0ms | 283.3ms |

**Everything moved up together, including the interpreter floor — an arm the candidate cannot
affect.** So the shift is ambient machine load, not the bump. The figure that isolates the change is
**injected minus not-asked: 3.2ms at `f7930d0`, 2.0ms at `5351270`** — unchanged within noise. One
indexed `UPDATE` by primary key inside an already-open transaction costs nothing measurable here.

## 7. What this verdict does not cover

- **That a seat *applies* what the trigger surfaces.** Unchanged and unmeasured. The loop's premise
  was demonstrated against the loop while the candidate was being built (`29766dc` §1).
- **A7's transcript clause.** Still untested: no transcript on disk for this session. A7 is scored
  on the trigger's own fire rows, and the claim *the host delivered the reminder to the model* is
  evidenced by nothing but my account, which is not evidence.
- **`R7` under a second live registration.** Verified through the real binary, not through the host
  invoking it. `R27` permits that and I agree with the ruling; the residual is named rather than
  hidden.
- **The ranking gap** (`R26`) and **the floor's corpus dependence** (`R19`) — both accepted limits,
  both owned by a later loop.
- **`G-042` on any machine but this one.** Eight sightings now, one machine.
- **The main-tree-only condition** — Aaron's untracked `PRD.md` — **unrun**.

## 8. Errors of mine in this round

1. **A mislabelled probe case.** I tried to produce a `silent` fire with nonsense command text,
   not having thought through that the derivation reads *elements* and not words. The run recorded
   three injections and one not-asked, my printed verdict lines said *"silent did NOT bump: false"*,
   and **for a moment that reads like a finding against the candidate.** It was my fixture. Caught
   by reading the fires table instead of the verdict lines I had written — the same discipline that
   caught the heredoc failure in report 2 §15.3.
2. **A type-invalid mutant, again.** M24 invented a field that does not exist; `tsc` said so and the
   tests passed against a no-op. Second time in two rounds that `tsc --noEmit` on a mutant was the
   only thing standing between me and a mutant that proves nothing.

Both were caught. Neither reached a finding.

## 9. `G-042` — the eighth sighting, clean

| run | tree | code state | tests | exit |
| --- | --- | --- | --- | --- |
| mine ×2 | QA | base `4550ee5` | 974 (1 failed, different victim each) | 1 |
| developer | developer | rev 2 `ee74fd1` | 986 | 0 |
| developer | developer | rev 3 `12b5aeb` | 997, 0 failed | 1 |
| developer | developer | rev 4 `405a5e3` | 1008, 0 failed | 1 |
| developer | developer | rev 5 `1afb04c` | 1021 | 0 |
| mine | QA | candidate 1 `45ee2ab` | 1021, 70 files | 0 |
| mine | QA | candidate 2 `f7930d0` | 1027, 71 files | 0 |
| **mine** | **QA** | **candidate 3 `5351270`** | **1031, 71 files** | **0** |

Three clean full runs in a row in this tree, at rising test counts. Developer rows relayed from
`5ab0ac4` §3, `6da5fa9` §3, `3db1365` §2.

## 10. Probe shapes added this round

Reports 1 §10 and 2 §14 still apply. New:

14. **`R7` through the real binary:** spawn `build/cli-recall-trigger.js` with a `JSON.stringify`
    payload against a scratch store, read `knowledge_index` before and after each fire, and cover
    injected / not-asked / repeated-injection.
15. **A genuine silent fire:** a **three-document** store, so the query runs and nothing clears the
    floor. Nonsense command text does **not** produce silence — the derivation reads elements, not
    words.
16. **A10 with the interpreter floor as a control:** when all three arms move together, the shift is
    the machine; the figure that isolates a change to the injected path is *injected minus
    not-asked*.

## 11. For the close-out

The bump lands in the column `/start`'s monthly pruning reads when it asks which entries have never
been recalled — the developer's comment says so, and it is the first place a hook-injected recall
now becomes visible outside the fires table. **Whether the entries the trigger surfaces are the
right ones is what the next loops count**, against the error table, using the fires table and
point-of-use rating this loop built. That was the brief's last paragraph and it is still the honest
statement of what has and has not been shown.
