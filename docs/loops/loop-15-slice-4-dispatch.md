# Loop 15 slice four: dispatch

**By:** Atlas (planner), record session 155, 2026-10-01. **Brief:** `docs/loops/loop-15-slice-4-brief.md` with its
`D_t`, both RULED (D-070, D-071, D-072, live-call cap 20). **Precondition met:** T-216 merged (#245, `b3ab05ca`).
`harness validate plan docs/loops/loop-15-slice-4-brief.D_t.json` exits 0 on master `ec7138bb`.

## Seats (Aaron, session 155)

- **Build:** `sia-builder` (Claude Code Sonnet, D-068) builds 4.1, 4.4, and the 4.3 `D_t` reconstructions, except
  any reconstruction of a diff that sia-builder itself built (see 4.3).
- **Live Jev calls:** the **QA seat** (headless Claude Opus on the laptop, with Aaron's `TYPESAFE_API_KEY` in that
  machine's user environment only, D-070). No other seat makes a live call.
- **Criteria:** a fresh headless QA seat writes them before any candidate is built (`qa-238-s4-criteria-dispatch.md`).

## Order

| Step | What | Who | Gate to the next step |
|---|---|---|---|
| 1 | **4.1, T-214** (below). No Jev. | sia-builder | QA, then Aaron merges |
| 1' | **Criteria** for 4.2 to 4.5, in parallel with step 1 | QA 238 | the planner rules the criteria |
| 2 | **4.4, the QA-score gate as data, plus the 4.3 reconstructions.** Dispatched after the criteria are ruled. | sia-builder | QA, then Aaron merges |
| 3 | **4.5, F11's answer**, committed before any green live run | planner | it is on master |
| 4 | **4.2, then 4.3 and 4.4 live, in shadow**, 17 calls plus up to 3 transport retries, cap 20 | QA seat | close-out |

Every live call waits for step 4. Nothing before it needs the key.

## Step 1: 4.1, T-214, for sia-builder

### The defect

`parseDeclared` (`open-brain/src/harness/declared.ts`) refuses a blank line inside a `qa-declared` block with
``line is not `ID: text`: (blank)``. C's first live shadow verdict was `undefined` for that formatting reason alone:
`loop-15-slice-3-c-criteria.md` has a blank line between `[unrunnable]` and `[out-of-scope]`. No fixture in B's or C's
tests has a blank line, so nothing caught it.

### The rule (planner's ruling: option (a))

**A whitespace-only line inside a declared block is not content.** State it as a property:

- **P-blank.** For any block, inserting or removing whitespace-only lines (`""`, spaces, tabs, a lone `\r`) at ANY
  position yields the same `DeclaredBlock`, including the same order of ids. That covers before the first header,
  between sections, between items, and at the end.
- **Nothing else loosens.** A non-blank line that is neither a header nor `ID: text` is still refused, and so are an
  item before any header in `qa-declared`, an id in both lists, an id twice in one list, and two blocks.
- **Both fence kinds.** P-blank holds for `qa-declared` and for the frozen `qa-unrunnable` form.
- **Present-but-empty stays distinct from absent.** A block holding only blank lines is present and empty, not absent.

Option (b), an authoring-time refusal, is not built here. The slice-four criteria carry their own parse-check row
instead (`qa-238` dispatch).

### Evidence

- **A generator, not rows alone.** From a set of valid blocks, generate at least 200 variants by inserting blank and
  whitespace-only lines at random positions. Assert the parse equals the original's. Also generate at least 50 variants
  that insert one non-blank junk line, and assert each is still refused. Commit the generator in the test.
- **The real file:** `parseDeclared` on `loop-15-slice-3-c-criteria.md` at its committed SHA is refused at the base and
  parses at the candidate into CC-23 to 25 unrunnable and CC-26, 27, 28 and 21 out-of-scope. **Do not edit that file,
  and do not re-run or rewrite C's prepared shadow artifact or ledger.** They are immutable.
- **Mutants** go red, one per clause: blank lines skipped only between sections; whitespace-only lines not treated as
  blank; junk lines accepted; `qa-unrunnable` not covered; a blank-only block returned as absent. Keep them local, with
  diffs under `docs/loops/t214/mutants/` (T-207).
- **Regression:** every existing `declared` and `shadow-merge` test passes unchanged.

### Rules

- Branch from `origin/master` (`ec7138bb` or later) as `loop/t214-declared-blank`.
- **Machine:** the QA PC has about 1.3 to 2.8 GB free. Run sequentially, and check free RAM is at least 1.5 GB before
  the mutants. **A heavy run needs Aaron's approval in your own window.** A planner "go" is a peer message, not his
  approval.
- Locally: `npm ci`, `npm run build` and `tsc --noEmit`, then `vitest run` on `tests/harness`. Quote the exit codes.
  Run no CI (D-061).
- Handoff: `docs/loops/t214-developer-handoff.md`. Map each clause to its test and mutant, with red and then green,
  and give the generator's case counts.
- Push only `loop/t214-declared-blank`, never forced. Report the SHA to atlas.

## Step 2, noted now so nobody is surprised (dispatched after the criteria are ruled)

- **4.3's independence rule:** a seat must not reconstruct the `D_t` of a diff it built. Before step 2, the planner
  maps each of the 8 diffs (#182, #165, #187, #195, #209, #227, #220, #218) to its building seat and assigns any
  sia-builder-built ones elsewhere.
- **4.4** follows HOH-JEV §4 "QA scoring" (`docs/HOH-JEV.md:248-254`) and writes `G_qa` in shadow only.
