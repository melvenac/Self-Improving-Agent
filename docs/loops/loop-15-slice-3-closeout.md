# Loop 15 slice three — close-out

**From:** Atlas (planner) · **Date:** 2026-09-30 · **Verdict:** **CLOSED** at record rev 211 (`3e583893`), with all
three candidates accepted and merged: **A** as #182 (`677c1dd`), **B** as #165 (`7640b93`) and #187 (`c9a7acc1`),
**C** as #195 (`ddd43526`). `G-045`, the brief's mandatory first repair, shipped earlier as `v0.44.1`.
**Brief:** `loop-15-slice-3-brief.md` (base state rev 64), sequenced by `D-026` and amended by `D-033` and `D-036`.
**Rulings:** `loop-15-slice-3-rulings-1.md` to `-21.md`, plus `-b-step1-rulings-qa129.md`, `-b-criteria-rulings.md`
and `-b-et-criteria-rulings.md`. Every ruling after rulings-21 is in `session-147-dispatches.md` or a task note.

> **Sources cited by id, SHA or file:line, not absorbed.** The record was read at master `729d2b2b` (rev 212), plus
> revs 213–214 (`D-070`, `D-071`, the ruled slice-four draft), which merged as #235 (`61b5b4c3`). This close-out was
> drafted from the record by a research agent in planner session 153, and the planner checked it before commit.

---

## 1. What was asked, and what happened

The brief asked for one capability: the harness runs a real role end to end, and it survives the repository states a
real role produces (`loop-15-slice-3-brief.md:24-29`). The order was fixed. `G-045` came first, seen red, and was
then followed by real roles, the `T-155` instrument, and Jev scoring calibrated on real diffs (`:61-71`).

**`G-045`: ACCEPTED and released.** Candidate `9ed674c` was accepted on §2 scope against criteria `17c9056`
(`CHANGELOG.md:212-216`) and released as `v0.44.1`. The release states that it closed one channel and not the
denominator (`:229-233`).

**The scope was then cut twice, on Aaron's word.** `D-033` (session 78) closed the slice at candidates A and B and
moved Jev calibration to the next slice. Its grounds: the slice had grown by nine rulings in one session, and
calibration needs the real diffs that A and B would produce. `D-036` split B in two. B became the `G-042` repair plus
`E_t`'s schema change (rulings-5 R23, rulings-2 R10). `T-155` became candidate C, built on B's accepted SHA.

**Candidate A (a real model-backed role through the runtime): thirteen candidates, twelve rejections.**

| Round | SHA | QA | Ruling |
|---|---|---|---|
| A | `3b19287` | report A (`10eb4d0`) | REJECTED, one blocker (rulings-6) |
| A2 | `2add792` | Probe, record 85 (`8cddfc7`) | REJECTED (rulings-9) |
| A3 | `5010199` | record 87 (`9c8176f`) | REJECTED (rulings-10) |
| A4 | `f9a1aa8` | QA 89 | REJECTED (rulings-12) |
| A5 | `4c1287f` | QA 92 | REJECTED (rulings-13) |
| A6 | `dc35b24` | QA 94 | REJECTED (rulings-14) |
| A7 | `d223d1d` | QA 96 | REJECTED (rulings-15) |
| A8 | `9e2dd5d` | QA 99 | REJECTED (rulings-16) |
| A9 | `6bd97f2` | QA 104 | REJECTED (rulings-17) |
| A10 | `4b7a5ae` | QA 108 | REJECTED (rulings-19) |
| A11 | `ef2a8a7` | QA 130 | REJECTED narrowly, on R85 alone (rulings-20) |
| A12 | `a69f07d` | QA 149 | REJECTED on A12-1 (rulings-21) |
| A13 | `4b43410` | QA 162 (Composer 2.5) and QA 174 (GPT-5.6 Sol) | **ACCEPTED** (`session-147-dispatches.md:285`) |

A13 merged as #182. The PR title reads "ACCEPTED by QA 162 + QA 174". From A2 onward the subject was CA-15. The first
statement of that class is rulings-7:40: *"a restore that acts outside its boundary and records success."* `T-169`'s
note sums the family up: *"a protection that acts outside its boundary is the project's most serious class; four
planner-ruling errors in one family, contained by stating the rule as a principle, R49."* That note was written at
A4; the family reached at least six (rulings-16, "sixth in the family"). Then `D-041` (Aaron,
2026-09-24) changed approach at A6. The operating system resolves links, and the runtime compares only which file it
reaches. It did so because *"every defect since A2 came from hand-written route tracing"*.

**Candidate B: ACCEPTED in two parts.** Part 1 was the `G-042` repair, `e815e3d`. It passed B-0 to B-9 in QA 129
(`-b-step1-rulings-qa129.md:6`; report `f2e1e39`) and merged as #165. Part 2 was `E_t` recording a human-seat loop,
order and pending: product `8c7769f`, built by Grok as record 187. It passed BE-0 to BE-8 in QA 189 (Composer 2.5,
`qa/b2-report` `75c2c95`), and the planner ruled B ACCEPTED (`session-147-dispatches.md:413-428`). It merged as #187.

**Candidate C (`T-155`, the shadow merge gate): five candidates.**
- Criteria: QA 191 (`4eaee48`), accepted with planner amendments P1–P4 at `e6b64e9e`.
- C, `2035e89`: REJECTED by QA 204 (`session-147-dispatches.md:698`).
- r2, `8054f9f`: REJECTED by QA 212 on CC-6 (`:712`).
- r3, `20c2dfd`: QA 213 said ACCEPT, and **the planner overruled it** (`:831-838`, rev 157). r4's scope was exactly
  the rows QA 213 scored partial. The record lists them as CC-1.2, CC-2.2, CC-5.6, CC-13.1, CC-13.2 and CC-17.
- r4, `c339427`: QA 232 (headless Opus, report `b43e719b`) said ACCEPT. Planner session 153 ruled it at rev 205, with
  **CC-22 met on a condition** (T-155 note). CI at `c339427` was red only on the base-shared r3b test. The condition
  was a head brought up to master, green at its own SHA, and differing from `c339427` in C's paths only by master's
  changes and the conflict resolution.
- The merge-up: a headless dev job on the QA PC merged master into #195 (head `fcc31254`, merge `80550f34`, no
  force). The `cli.ts` resolution **keeps both `flagMap` behaviours**: master's permissive one, and
  `flagMap(argv, strict=true)` for `cmdShadow` alone. The planner verified C's own files byte-identical to `c339427`.
  PR CI run `36717452910` was green.
- The merge: #195 merged as `ddd435260bd07221f83d5ad2d426410171d6f0f3`, pinned to `fcc31254`, on Aaron's "merge all".

**C's first live episode (CC-23, episode 1).**
- `prepare` ran before the merge and returned **undefined**: `criteria block refused: line is not ID: text: (blank)`.
  The cause is a blank line at `loop-15-slice-3-c-criteria.md:340`, inside the `qa-declared` block. That is `T-214`.
- The artifact is committed as written, because CC-7 makes it immutable.
- `decide` ran after the merge and wrote `docs/loops/shadow-merge/ledger.jsonl` line 1: `shadow_verdict` undefined,
  `aaron_action` merged, `disagreed` null, `line_hash` `d88158ff…`. The summary reads evaluated 0, disagreements 0,
  undefined 1.

**Not done in this slice, by ruling:** Jev calibration (`D-033`). **Not done, as fact:** at `96ebd400` there were 0
gate records and 1 live Jev pair, slice two's (`loop-15-slice-4-brief-draft.md:13-18`). Whether any green live loop
ran in slice three, the point where rulings-1 R6 (F11) applies, is not in the record.

## 2. The finding that generalises

**The instruction is a candidate too, and nothing checked it before a seat built to it.** Slice two's lesson was the
order of restore relative to the first read. Slice three's is one level up, at the words that tell a seat what to
build. In this slice, a seat built exactly what it was told again and again, and what it was told was wrong:

- **Candidate A's rounds were driven largely by rulings, not implementations.** Nine rulings files carry the
  planner's own error entry: rulings-9:33, 10:30, 11:11, 12:30, 13:31, 14:32, 15:24, 16:34 ("sixth in the family")
  and 19:15. The entries include:
  - a dispatch that omitted two rows and then said "nothing else" (rulings-9:35-36);
  - instance rulings where the finding was a class (rulings-10:32-39);
  - one ruling that merged two baselines (rulings-11:14-20);
  - a principle that was then defined lexically (rulings-12:32);
  - a dispatch table written from commit subjects rather than diffs (rulings-13:34);
  - *"A brief's code pointers act as its scope, whatever its prose says"* (rulings-15:28);
  - *"a rule defined by a list of what it covers leaks at the list's edge"* (rulings-16:39);
  - a new rule that contradicted an existing test without naming the test obsolete (rulings-17:40).
- **C r3 was built to a narrowed list.** The session-11 planner wrote "the one remaining defect is CC-6", which
  dropped QA 212's major finding C-212-2 (T-155 note; `session-147-dispatches.md:837`).
- **T-194's D3 was caused by r3's dispatch.** Item 1 said "resolve against the repo root", but a relative Bash
  target resolves against the shell's cwd. The same item's outside-repo deny was the planner's own error, and was
  reversed (T-194 note, QA 234 ruling).
- **The first shadow verdict was undefined because of one blank line in a criteria file.** Nothing parsed that file
  before a candidate existed (`T-214`).

The containments that worked were structural: R49 stated as a principle, the "carries" column built from
`git diff --stat`, and `D-041`, which removed hand tracing altogether. Stated as a principle for slice four:

> **A dispatch, ruling or criteria file is checked against what it governs before any seat builds to it. A block a
> tool will parse is parsed at authoring. A ruling names the criteria row, every code site and every test it
> changes. Where it cannot enumerate, it says it covers the whole class.**

## 3. Rulings made in the loop, so nothing is asked twice

1. **Slice three closes at A, B and C; calibration is the next slice** (`D-033`, `D-036`).
2. **F11 accepted, with its limit.** Clean windows mean clean on the probed channels only (rulings-1 R6).
3. **CA-15 changes approach before A6.** Link resolution goes to the operating system (`D-041`).
4. **A QA ACCEPT with partial rows is not automatic.** C's own criteria make partial give would-not-merge, so an
   accept on partial rows would hold C to a looser standard than it enforces (rev 157).
5. **CC-22 can be met on a condition** when the only red is a base-shared test fixed on master. The condition is a
   head that is green at its own SHA, with its diff against the QA'd SHA verified (T-155 note, rev 205).
6. **The first shadow artifact stands as written.** Re-authoring the criteria to get a different first verdict would
   game the episode (T-155 note).
7. **Forge's CC-1.2 placement accepted over the planner's proposal.** The check lives in `shadow-merge.ts` because
   CC-0.1 forbids C changing B's schema (T-155 note, rev 171).
8. **The planner seat hook protects repo artifacts; it is not a sandbox.** Paths outside the repo are allowed (T-194,
   QA 234 ruling).

## 4. Incidents outside the criteria

**The planner's record write turned master red (`T-205`).** Master run `36681093114` at `9c60361` failed TG-2. That
test asserted specific gap ids against the live `state.json`, and `G-049` moved the next id. The test was the defect
and the record was not reverted. The fix proves the skip on a fixture record: #222 (`cdf079df`), closed at rev 194.
The planner had checked that `G-049` was uncited, but not whether a test pinned the next id.

**The same class was already failing a test shared by every base.** `state-schema` "T-171 r3b" pinned live
`tasks[0]`. It was fixed by `9b3a4a2c` (#210, `3592f11`), and it still failed at the base of several QA runs whose
SHAs predate the fix: T-158, T-195, T-196, T-198, C r4 (run `36690140665`) and T-194 r3 (base `36723422366`). Each
time it was read as base-shared, not charged to the candidate. `T-213` then found five more tests reading the live
seats file.

**QA 232's first attempt died with no report.** It was pid 3704, launched about 08:27Z, and it ended its turn waiting
on a background suite. The second attempt (pid 17840, 08:41:41Z) reported. The headless prompts now run every command
in the foreground (#226, `86e622db`).

**tcm's hub went to `AUTH_MODE=strict` at 2026-09-30T12:32:42Z (`V-078`, `D-063`).** Before the flip, forge's
own-key send landed as turn 60. After it, atlas's own-key read returned 200. `T-213` was first recorded as a strict
prerequisite and then corrected to not one, after Relay revised condition 3.

**Mutant-branch CI starved the runners during the seat moves (`T-207`):** 13 of 21 waiting runs; 25 cancelled by hand.

**A2's developer responses were stopped twice by a host classifier (`T-177`).** No seat worked around it. Aaron
chose one attempt by Grok 4.7 in Cursor, and that attempt built A2.

## 5. Near-misses, by family, all seats

- **A stale fetch read as current (`T-208`).** Two cases within an hour. The planner read a deleted probe ref from an
  unpruned tracking ref. Forge's `/start` printed "level with origin/master" at rev 178 while master was at about
  rev 194.
- **Startup rendering that hides or misattributes things (`T-209`, `T-210`, `T-212`).** Gaps were listed
  oldest-first, which hid `G-049`. The "newest brief" picked was from 2026-09-20. 28 of Rivet's commits were blamed
  on Relay's session.
- **Ref audits charging the QA seat for others' pushes.** Traces were written so that QA 213 and QA 216 were not
  blamed, and one of those traces was itself wrong about timing and was corrected
  (`session-147-dispatches.md:749, 826`).
- **A destructive record op not reported (`T-171`).** `update_task` replaced a whole note, and the dry run said only
  "Applied (1)". It was caught by reading `state-writer.ts:293` before the write. QA 162 also called the laptop "the
  QA PC" (`session-147-dispatches.md:295`).

## 6. The record

**Rev 64 at the brief's base to rev 211 at close** (T-155 `closed_rev`). There are **no numbered error totals** of
the slice-two kind (`Planner N / Developer N / QA N`) for this slice: not in the record. The planner-seat entries are
the ones listed in §2, plus T-205's and the C r3 narrowing.

**Seats and models changed four times.**
- Opus 5 developer and QA seats, with a Fable 5.1 planner (`D-026`).
- Grok 4.7 in Cursor for A2 after the classifier stops (`T-177`), and then for all developer seats, with Composer 2.5
  QA (`D-052`, 2026-09-27). This is `T-165`'s first data.
- Sonnet 5.5 developers and Composer 2.5 in Cursor (`D-067`). The QA corollary in `D-067` is Clark's inference, not
  Aaron's words.
- Until 2026-10-03: an Opus planner, Sonnet developers, Opus headless QA, and Cursor blocked entirely (`D-068`).

**Launch and machines.** The planner launches QA itself over ssh (`D-069`). The laptop is the default QA machine and
the QA PC takes developer seats first (`D-065`); the builder and Forge moved there (`seat-move-qa-pc.md`, rev 184).

**Still to do after this close-out:** close `T-169` when its parts land (its dev job is running: branch
`docs/t169-prd-readme`), and add a CHANGELOG entry (none exists for A, B or C on master; `package.json` reads `0.44.2`).
`D-070` and `D-071` are on master (#235).

## 7. What slice four inherits

- **`T-169` first** (`D-070`; `D-033` makes this close-out carry it). It rewrites `PRD.md` and `README.md`, takes
  `PRD.md` off the `historical` list in `retirements.json`, and adds the maturity lifecycle to it. It also adds a
  dated part to the Step-Back artifact at the same URL. The README must say that an adopting project brings its own
  TypeSafe access (`D-070`).
- **`D-071`:** seat-built diffs are scored PROVISIONAL, tagged with source and plan provenance; "calibrated" needs 5
  or more runtime-produced diffs whose `D_t` was written before the work; the key reaches the Jev endpoint and
  nothing else, with a test for each.
- **`T-214` (P1).** Choose between two fixes. (a) Tolerate blank lines. (b) Refuse an unparseable block at authoring,
  before any candidate. Either way, add a fixture row with a blank line. Do not rewrite C's criteria.
- **`T-194` r4 in QA.** QA 235's dispatch is for `d37e09dc` (on master since #235). The r4
  scope: D3 via `payload.cwd`, outside-repo allow, case-insensitive prefixes, `GH_REPO=`, exact grant match, and
  `gh.exe`.
- **`T-213` (P1).** Repoint forge to room `k571c0nz`, and move the tests onto a fixture seats file.
- **`T-209`–`T-212`**, from Clark's startup audit.
- **C's minor defects D-1 to D-3**, which ride on C's next touch (T-155 note).
- **The draft brief** `loop-15-slice-4-brief-draft.md`. It is ruled but not dispatched, and it becomes the final brief
  after this close-out. The live-call budget is still to be proposed.
- **The open denominator:** the index, submodules, the reflog, and everything outside `.git/` (rulings-1 R6).

## 8. Held for Aaron

- **Merging this close-out and `T-169`'s PR.** The close-out is docs-only (`D-055`). `T-169` touches
  `retirements.json`, which the retirements check reads. Whether that counts as "checks" under `D-032` is not ruled
  in the record.
- **The release.** A, B and C are merged with no CHANGELOG entry or version, and the release is Aaron's (`D-019`,
  `CHANGELOG.md:5-7`).
- **Re-ruling models at the Cursor reset on 2026-10-03**, when `D-068` lapses. `D-067`'s QA corollary is still
  unruled.
- **Registering the `T-194` hook** in `sia-planner`'s `settings.local.json` once r4 is accepted. That is Aaron's
  hand (T-194 note).
- **Slice four's live-call budget**, once the planner proposes it in the final brief (`D-070`, `D-071`).

---

**The loop's verdict, the planner's to give:** slice three asked whether the runtime is still there to refuse after
something real has run inside it. It took thirteen candidates to get A through. Most rounds were spent on
instructions that said less, or something other, than the rule they served. The gate that is meant to count the
planner's disagreements with Aaron opened on a verdict of *undefined*, caused by one blank line that nobody had
parsed. The runtime refuses correctly, and slice four's first check is on the words that tell a seat what to build.
