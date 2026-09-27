# T-183: the greeting fits one tool result. Brief for a FRESH developer session (record session 113)

**By:** Atlas (planner), record session 109 · 2026-09-25. **To:** the Claude developer seat (Forge), **record 113**,
in **`~/Worktrees/sia-builder`**, the standing checkout for isolated builds (detached at master `48acaa8`). T-183 is its first job.
**Authority:** Aaron, in the planner session: *"Can we dispatch another agent to work on only t 183? Is that work
isolated enough to not interfere with the other two forge agents?"*, answered yes on the condition below.
**Runs beside two other seats:** Grok on candidate A10 (`harness/*`, in `sia-forge`) and Forge 110 on importer
round 3 (`pipelines/state-import/*` and `cli.ts`, in `sia-infra`). **Do not touch their files.**

## 1. Why

`ob_start`'s greeting is **98,679 characters** at rev 130 (measured by the planner on its own greeting). It no
longer fits one tool result, so every seat reads it in chunks at every start, and one seat skipped it. By section:

| Section | Characters | Share |
|---|---|---|
| Gaps (39, full text) | 32,745 | 33% |
| Verified (77) | 17,097 | 17% |
| `shared.md` | 16,705 | 17% |
| Tasks (67, titles) | 8,765 | 9% |
| Everything else | ~23,000 | 24% |

## 2. The work: render only, NO schema change

**The isolation condition, and it binds:** change **only** `open-brain/src/pipelines/session-start/state-render.ts`
(the sites are `:51–60` at `48acaa8`), a new check in `open-brain/src/pipelines/sync/checks.ts` and its wiring, and
their tests. **No change to `state-schema.ts`, `state-writer.ts`, `state.json`, the importer, `cli.ts` or
`harness/*`.** A gap `title` field is the better long-term fix, but it is a schema migration that every tree
feels, and it is out of scope here.

1. **Gaps are printed clipped.** Each gap is one line: its id, then its `what` cut at the first sentence or 140
   characters, whichever comes first, then `… (N chars; full text: state.json gaps[<id>])` whenever anything was
   cut. **A clip never happens silently**: the marker and the full length are always printed when it applies. The
   opened session stays on the line.
2. **Verified is printed clipped** the same way, at 100 characters, keeping the evidence count.
3. **Unchanged, and a test asserts each:** tasks; the objective; **every handoff watch-out and open question
   VERBATIM** (start.md: "never summarise it, never drop items for length"); the loop state; the other seats'
   lines; and the two role files **in full** (V-050).
4. **A size check in `/sync`:** `greeting-size` renders this project's greeting the way `ob_start` does and reports
   its character count every time. It is an ISSUE above **40,000**. Validate the detector against a known positive
   (a record fixture that renders above the limit) and a known negative in the same test.

## 3. Rows

| Row | Passes when |
|---|---|
| T183-1 | This repository's own `state.json` (at the tree's revision) renders under 40,000 characters, measured and printed in the handoff before and after. |
| T183-2 | A gap longer than the limit is one line carrying the marker and its full length. A gap under the limit is printed whole, with no marker. |
| T183-3 | Every watch-out and open question is byte-identical to `state.json`'s, and the role files are whole. |
| T183-4 | `greeting-size` is red on the positive fixture and green on the negative one, and it prints the count in both. |
| T183-5 | The diff touches only the files in section 2 (`git diff --name-only` in the handoff). |

## 4. How

- `/start` first: read the whole greeting, in chunks (that is this task's reason to exist). Then `npm ci && npm run
  build` in `open-brain`.
- Branch `loop/t183-greeting` from `origin/master`. Red first: the new tests alone, on `48acaa8`, as
  `loop/t183-redcheck`, per test on tcm.
- A code mutant per protection (the clip marker, verbatim watch-outs, the size threshold), with `npx tsc --noEmit
  -p .` before every push and on every mutant.
- CI on tcm (D-040). **Three seats share its two runners tonight**, so batch your runs, and read each one per test.
- **Ask atlas before any full local suite** (G-042).
- Push only `loop/t183-*`. Never master, never force, read back each push.
- On a refusal or a denied command: stop and tell atlas.
- Hand back `docs/loops/t183-developer-handoff.md` on the branch: every row with its run id, each mutant, the
  before/after sizes, what was not verified, and your model and effort. No `/end` (T-163).

## Amendment 1 (planner, record 109, on Forge 113's measured report)

- **T183-1's 40,000 cannot be met under §2.3's constraints.** The unchanged parts alone come to about 37,700
  characters (measured by Forge 113 at rev 131). The planner's own section table estimated about 45k before this
  brief set 40k. **The planner's error.** The threshold is **kept** (no widening after measuring), T183-1 is scored
  as an **honest no** with its before and after figures, and `/sync`'s `greeting-size` reports red until the
  follow-up lands: **per-seat greeting profiles** (Aaron's question, 2026-09-25).
- **Verified:** its count plus the newest 10, clipped at 100 characters, with a stated omission line.
- **Role files stay whole** (V-050). The threshold is not raised.
- **§2.1 is corrected to row T183-2:** text at or under the limit, on one line, prints whole with no marker. Longer
  text is cut at the first sentence end or the limit, whichever comes first, with the marker.
- **New row T183-6:** a live `ob_start` in a fresh session in this tree returns inline, not saved to a file. The
  instrument is the host.
