# QA 239: T-214, a blank line inside a declared block is not content (slice four, step 1)

**By:** Atlas (planner), 2026-10-01, record session 155. **Candidate:** `caebe8b6ecaa32db8defaf979e19df435a5b60f3` on
`origin/loop/t214-declared-blank`. **Base for red:** `ec7138bb`. **Builder:** sia-builder, Claude Code Sonnet.
**QA runs on Opus** (D-068).

## What to read

1. `docs/loops/loop-15-slice-4-dispatch.md`, "Step 1": the property P-blank and its clauses. **This is what you
   score.** The rule is D-075.
2. `docs/loops/t214-developer-handoff.md` at the candidate: its clause-to-test map, generator counts and mutants.
   **Verify it; do not take it.**

## Rows to score

- **T214-1, P-blank, scored with YOUR OWN generator.** Do not import the builder's.
  - From valid `qa-declared` and `qa-unrunnable` blocks, insert whitespace-only lines (`""`, spaces, tabs, a lone
    `\r`, and mixes of them) at every position: before the first header, between sections, between items, at the end,
    and directly after the opening fence. Each variant must parse equal to the original, with ids in the same order.
  - Use at least 200 variants, CRLF files included. Report every disagreement.
- **T214-2, nothing else loosens.** Each of these is still refused:
  - a non-blank junk line;
  - an item before any header in `qa-declared`;
  - an id in both lists, or twice in one list;
  - two blocks;
  - a header or item with leading whitespace.
  - **Also judge** characters outside `[ \t\r]`, such as NBSP, `\f`, `\v` and a zero-width space. The builder keeps
    NBSP as junk. Say whether refusing them matches D-075's "whitespace-only" or is a gap, and give your reason.
- **T214-3, present-but-empty vs absent.** A block with only blank lines is present and empty. No block is absent.
- **T214-4, the real file.** `parseDeclared` on `docs/loops/loop-15-slice-3-c-criteria.md`, as committed, is refused
  at the base with the blank-line message, which the builder did not capture. **Capture it.** At the candidate it
  parses to CC-23, 24 and 25 unrunnable and CC-26, 27, 28 and 21 out-of-scope. Confirm the file, C's shadow artifact
  and the ledger are byte-identical at base and candidate.
- **Mutants:** re-run the builder's 5, and add at least 2 of your own. One must target the BLANK_RE character class.
- **Regression:** every existing `declared`, `shadow-merge` and `tests/harness` test passes unchanged.
- **Downstream, report only:** does `shadow-verdict prepare` change any outcome for a criteria file that has blank
  lines? It must not rewrite any existing artifact. Do not re-run C's episode.

## Rules (headless Claude Code)

- You are **QA 239**. Your prefix is `t214`. Push ONLY `qa/t214-*` branches, and only through
  `node docs/loops/qa-239/push-qa.mjs <branch>`.
- **CI:** if `gh` is authenticated on your machine, push `qa/t214-ci-candidate` at the candidate and `qa/t214-ci-base`
  at `ec7138bb`, and quote each run's id, headSha, run conclusion and `test` job conclusion. Use at most 2 tcm runs,
  never `windows=true`. If `gh` is not authenticated, make 0 runs and say so. Keep mutants local, with diffs under
  `docs/loops/qa-239/`.
- Commit `docs/loops/t214-qa-report.md` with its `.E_t.json` on `qa/t214-report`. The last line is exactly
  `QA-239: REPORT COMPLETE`.
- Make no live Jev call.
- If you are blocked, write it in "Open for the planner" and finish the report.
