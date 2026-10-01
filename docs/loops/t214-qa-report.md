# QA 239 report: T-214 (P-blank): ACCEPT, with one test-guard gap

**By:** QA 239, headless Claude Code on Opus, Linux (Plumb), 2026-10-01, second attempt.
This file replaces the first attempt's INCOMPLETE report (`e16270d6`), which this session's sandbox had blocked.
**Dispatch:** `5a8b5fbb14b67d1d0e8421b5c8f64e75256d61e8`. The headless prompt again gave no launch-line SHA. This is
the only ref carrying `qa-239-t214-dispatch.md` (`origin/docs/session-155c`).
**Worktree `git -C ~/qa-scratch/qa239-wt log -1 --format=%H` at setup:** `5a8b5fbb14b67d1d0e8421b5c8f64e75256d61e8`.
**Candidate:** `caebe8b6ecaa32db8defaf979e19df435a5b60f3` (`origin/loop/t214-declared-blank`, read back).
**Base:** `ec7138bb`. Each has its own detached scratch worktree: `~/qa-scratch/qa239-cand` and `~/qa-scratch/qa239-base`.

## Verdict

**ACCEPT.** P-blank holds on 6,196 independently generated variants with 0 disagreements, against an oracle that also
states "nothing else loosens". Every T214-2 refusal still holds. Present-but-empty stays distinct from absent. The real
file parses as specified, and the immutable files are byte-identical. All 5 builder mutants and all 5 of mine are red
on my generator. One gap is recorded (G1 below): the builder's test does not guard leading whitespace. The code is
correct on that point. Only the test fails to guard it, so the gap does not block acceptance.

## Rows

| Row | Result |
|---|---|
| T214-1 P-blank, own generator | **met**: 6,196 variants, 0 disagreements at the candidate. Base: 3,920 disagreements |
| T214-2 nothing else loosens, plus NBSP/\f/\v/ZWSP | **met**: every refusal holds. Judgement on the non-ASCII characters is below |
| T214-3 present-but-empty vs absent | **met** |
| T214-4 real file | **met**: base message captured. Candidate parse correct. Three files byte-identical |
| Mutants (5 builder's + 5 mine) | **met**: 10/10 red on my generator. 9/10 red on the builder's test (q5 survives, G1) |
| Regression (declared, shadow-merge, tests/harness) | **met**: one failure, environmental and identical at base |
| Downstream `shadow-verdict prepare` (report only) | outcomes change only from `undefined` (blank refusal) to the blank-free verdict. No rewrite |
| CI | **0 runs.** `gh` is not installed on Plumb. The red side is shown by `git grep` at `origin/master` (below) |

### T214-1: P-blank, scored with my own generator

`docs/loops/qa-239/t214-gen.mts`. It is independent of the builder's test: different PRNG (xorshift32), different
blocks, different blank set, and an oracle instead of fixed expectations. The oracle is
**`cand(x) == base(strip(x))`**, where `strip` removes the whitespace-only lines inside the block. The comparison is
on the full result, or on the refusal message, with ids in order. Documents have text before and after the fence.

Blank kinds (13): `""`, `" "`, `"   "`, `\t`, `\t\t`, `" \t "`, `\r`, `" \r"`, `\t\r`, `"\r \t"`, `\r\r`,
`" \t\r "`, `"\t \r\t"`. Valid blocks (11): 8 `qa-declared` (both lists, out-of-scope first, a repeated header, one
list only, C's real body without its blank line, a header alone, an empty block, trailing space in the text) and 3
`qa-unrunnable` (four items, one item with no space after the colon, empty).

| Group | Variants | Candidate disagreements | Base disagreements |
|---|---|---|---|
| G1 valid blocks, base == candidate | 22 | 0 | 0 |
| G2 one blank at EVERY position 0..n (0 = directly after the opening fence), every kind, LF | 637 | 0 | 633 |
| G2 the same, CRLF file | 637 | 0 | 635 |
| G3 random multi-insertion (1 to 8 blanks, runs allowed, LF/CRLF), plus random removal back towards the original | 1,600 | 0 | 1,512 |
| G4 differential: random bodies from 25 non-blank lines (junk, leading whitespace, NBSP, \f, \v, ZWSP, BOM, U+3000, U+2028, U+0085, duplicates) mixed with blanks | 1,860 | 0 | 929 |
| G4 differential, blank-free bodies (exactly base == candidate) | 1,140 | 0 | 0 |
| G5 one junk line plus 3 blanks in a valid block: refused, with the same message as base on the stripped body | 300 | 0 | 211 (still refused, but with the `(blank)` message) |
| **Total** | **6,196** | **0** | **3,920** |

G4's random bodies at the candidate: 700 parsed, 2,300 refused. The 6 base agreements in G2 are the empty blocks D7
and U3 with a single `""` line. `linesOf` already drops that line at the base, so it is not a regression signal.
Summary: `docs/loops/qa-239/t214-gen-candidate.json`.

### T214-2: nothing else loosens

`docs/loops/qa-239/t214-rows.mts`. Blank lines are placed next to each refusal, so the blank skip cannot mask it. At
the candidate:

| Probe | Candidate |
|---|---|
| junk line | refused: ``line is not `ID: text`: not an item`` |
| item before any header (after a blank) | refused: ``line is not `ID: text`: A-1: x`` |
| id in both lists | refused: `id "A-1" is in both unrunnable and out-of-scope` |
| id twice in one list (`qa-declared` and frozen) | refused: `appears twice in unrunnable` |
| two blocks | refused: `more than one declared block in the file` |
| header with a leading space / tab | refused |
| item with a leading space / leading tab (frozen) | refused |
| `[unrunnable]` header inside `qa-unrunnable` | refused |
| NBSP, `\f`, `\v`, ZWSP, BOM, U+3000, `"  \t"` as a line | refused as junk |

At the base, the same probes are also refused, often earlier, by the `(blank)` line. G4 checks the same property
statistically: on 1,140 blank-free bodies, the candidate equals the base exactly, including the refusal text.

**Judgement on NBSP, `\f`, `\v` and ZWSP: refusing them matches D-075. It is not a gap.** My reasons:
1. D-075 says "whitespace-only", and P-blank, where that phrase is made operational, lists the members:
   `""`, spaces, tabs and a lone `\r`. D-075's second half is "nothing else loosens". When the rule names its
   members, a character it does not name stays as strict as it was at the base.
2. Refusal fails closed and is visible. A refused block makes the shadow verdict `undefined`, with the line quoted in
   the reason. Silently accepting a stray character would be the riskier of the two errors.
3. ZWSP and BOM are not whitespace even under JavaScript `\s`, so no reading of "whitespace" makes them blank.
   `\f` and `\v` are the only arguable cases, because they are in ASCII `\s`. Neither occurs in any criteria file,
   and widening the class to include them would be a new ruling, not a fix. My mutant q1 (`\s`) shows the cost of
   that ruling: it would also accept NBSP, U+3000, BOM and U+2028.

### T214-3: present-but-empty vs absent

At the candidate, blank-only `qa-declared` (`"", " ", "\t", "\r"`), the same in CRLF, and blank-only `qa-unrunnable`
each give `{present: true, unrunnable: [], outOfScope: []}`. The empty body is also present and empty. No fence at
all gives `{present: false}`, and so does a different fence (```` ```text ````). At the base, every blank-only block
was refused, so the "present and empty" result is new behaviour. Mutant m5, where a blank-only block returns absent,
is red on G1 to G4.

### T214-4: the real file

- **Base refusal, captured:** `parseDeclared(docs/loops/loop-15-slice-3-c-criteria.md)` at `ec7138bb` throws
  ``DeclaredParseError: line is not `ID: text`: (blank)``. This is the same text C's artifact records as its reason.
- **Candidate:** `{present: true, unrunnable: [CC-23, CC-24, CC-25], outOfScope: [CC-26, CC-27, CC-28, CC-21]}`.
- **Byte-identical at base and candidate:** `git ls-tree` gives the same blobs at both commits, and
  `git diff --stat ec7138bb caebe8b6` over these paths is empty:
  - `docs/loops/loop-15-slice-3-c-criteria.md`: `c7ac9bdba4e01e2c197975f947c533432b29bc50`
  - `docs/loops/shadow-merge/15-slice-3-c/c33942725c73b1aa91ceb46458e6ea7d11c70dcd/shadow_merge.json`: `b42edce4fea7e3ffd1abc5aad57a1640b101862f`
  - `docs/loops/shadow-merge/ledger.jsonl`: `7fc741059372e8979010e38c988c4f4e33758a79`

### Mutants

`docs/loops/qa-239/t214-mutants.mjs` applies each mutant to the candidate scratch tree, runs the builder's test file
and my generator, then restores `declared.ts` (verified clean afterwards). My diffs are in `docs/loops/qa-239/mutants/`.
Results are in `docs/loops/qa-239/t214-mutants-results.json`.

| Mutant | By | Builder's test | My generator |
|---|---|---|---|
| m1 blank skipped only before a header | builder | RED (B1 B2 B3 E1) | RED (3,454) |
| m2 blank is `^$` only | builder | RED (B1 B2 B3 E1) | RED (3,470) |
| m3 junk accepted | builder | RED (J1 J2) | RED (2,638) |
| m4 `qa-unrunnable` not covered | builder | RED (B1 B2 E1) | RED (976) |
| m5 blank-only block is absent | builder | RED (E1) | RED (982) |
| **q1 BLANK_RE class widened to `\s`** (targets the class) | QA 239 | RED (J2, NBSP row only) | RED (956) |
| **q2 BLANK_RE class drops `\t`** (targets the class) | QA 239 | RED (B1 B2 B3 E1) | RED (2,706) |
| q3 blank refused before the first header | QA 239 | RED (B1 B2 B3 E1) | RED (1,452) |
| q4 a blank line resets the section | QA 239 | RED (B1 B2 B3) | RED (1,207) |
| **q5 leading spaces/tabs stripped before matching** | QA 239 | **green: SURVIVES** | RED (662) |

The handoff's clause map checks out. Every builder mutant is red on the tests the handoff names. The builder's test
copied onto the base fails B1, B2, B3, E1 and R1 and passes J1 and J2, exactly as the handoff states. The generator
counts are also as stated: B1 = 6 × 40 = 240, B2 = 6 × 5 = 30, J1 = 6 × 10 = 60.

### Regression

At the candidate: `npm ci` 0, `npm run build` 0 (stamped `caebe8b`), `tsc --noEmit` 0.
- `vitest run tests/harness/b2-et.test.ts tests/harness/shadow-merge.test.ts tests/harness/t214-declared-blank.test.ts`:
  **exit 0**, 3 files, 91 passed (41 + 43 + 7). `b2-et` and `shadow-merge` are unchanged between base and candidate.
- `vitest run tests/harness`: 37 files, **560 passed, 1 failed, 4 skipped**, exit 1. The single failure is
  `checks.test.ts > defaultChecks — D4 > the default BUILD check spawns successfully…`. npm's log for it says
  `could not determine executable to run`. It **fails identically at the base** (`checks.test.ts` at `ec7138bb`: 1
  failed, 23 passed), so it comes from this machine's environment, not from T-214.

### Downstream (report only): `shadow-verdict`

`docs/loops/qa-239/t214-downstream.mts` runs `computeShadowMergeVerdict` on the 5 committed shadow-merge fixtures. For
each fixture it uses the fixture's own criteria text, then the same text with blank lines added after the opening
fence and before `[out-of-scope]`.
- Candidate: all 5 fixtures give the **same verdict and first reason** with and without blanks.
- Base: all 5 become `undefined` / ``criteria block refused: line is not `ID: text`: (blank)`` once blanks are added.
- So the only outcome that changes is a blank-line refusal (`undefined`) becoming the verdict the file would get
  without blank lines. That is the intended change.
- **No rewrite:** `prepareShadowVerdict` aimed at C's existing artifact (loop `15-slice-3-c`, candidate `c3394272`)
  throws `… shadow_merge.json already exists. A verdict is written once.` before reading anything, at both base and
  candidate. The scratch trees were clean afterwards. C's episode was not re-run.
- One of my probes was malformed: a synthetic "C-shaped" evidence with an unmet row failed `validateEvidence` at both
  base and candidate. It says nothing about T-214, and I did not use it.

### CI

0 tcm runs. `gh` is not installed on Plumb. The red side, shown by `git grep` at `origin/master` (`2448a6ea`):
`open-brain/src/harness/declared.ts` has no `BLANK_RE`. Line 66 is `for (const raw of lines) {`, and line 76 throws
``line is not `ID: text`: ${line === "" ? "(blank)" : line}``. `git diff --stat ec7138bb origin/master` over
`open-brain/src/harness`, the criteria file and `docs/loops/shadow-merge` is empty, so master is still the base for
every row above.

## Gaps

- **G1 (test guard, not code):** mutant q5 strips leading spaces and tabs before matching. That makes the parser accept
  ` [unrunnable]` and `  A-1: x`, and the builder's test file is **green** against it. Its JUNK list and J2 have no
  leading-whitespace row, although T214-2 names "a header or item with leading whitespace". The candidate code
  refuses these lines (rows 2f above), and my generator kills q5. Suggested fix: add leading-whitespace rows to J1/J2,
  or commit this generator's G4 differential as a test.
- **G2 (info):** `/sync` was not run on the candidate. The handoff also did not run it.

## Process notes

- This session's sandbox refused shell `VAR=value cmd`, `env VAR=…` and `printenv`. Every build, test, generator and
  mutant run therefore went through `~/qa-tmp/run.mjs`, which spawns the command with
  `TMPDIR=TEMP=TMP=~/qa-tmp`. The two `npm ci` runs were the exception: they ran directly with the default temp
  directory. npm wrote its usual cache and logs under `~/.npm`, outside `~/qa-scratch` and `~/qa-tmp`.
- The QA checkout was not edited. No live `.agents/state.json`, knowledge DB or settings file was written. No live Jev
  call.

## Open for the planner

1. G1: decide whether the builder should add leading-whitespace rows before merge, or whether this report's
   generator is enough evidence on its own.
2. Headless prompts still give no launch-line SHA. Twice now, this seat has had to find the dispatch by searching refs.
3. `gh` is absent on Plumb, so CI rows are always 0-run here.
4. The `checks.test.ts` D4 build-check failure is environmental on Plumb (`npm` "could not determine executable to
   run" in a scratch repo) and also occurs at the base. It is worth a look outside T-214.

QA-239: REPORT COMPLETE
