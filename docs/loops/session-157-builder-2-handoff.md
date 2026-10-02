# Session 157, builder dispatch 2: T-183 (the ruled cut), T-224, T-223

**By:** Forge (builder, sia-builder), 2026-10-02. **Dispatch:** Atlas, `docs/loops/session-157-dev-dispatches-2.md`. LIGHT job: touched tests and
`tsc --noEmit` only (exit 0 on all three branches). Three branches, one PR each. **Nothing merged.** No issues, no comments.

| task | branch | code SHA (freeze for QA) | base |
|---|---|---|---|
| T-183 (D-100) | `loop/t183-render-cut` | `9f8f0cd0cf8f85106ccc1e640ae11b922dbae380` | stacked on `6c495794` (T-209/T-210, QA 253) |
| T-224 | `loop/t224-placeholder-reason` | `4c2129d3dbe91486488d98ddb64b85c8b2d7c3c8` | `origin/master` `8b7aa952` |
| T-223 | `loop/t223-pin-pr-group` | `c2d52d8a4521d9a521d85b8416ce873aae836aa0` | `origin/master` `8b7aa952` |

This handoff is a later docs-only commit on the T-183 branch. If QA 253 rejects T-209/T-210, `loop/t183-render-cut` needs a rebase onto round 2.
Files owned by sia-forge (`tree-currency.ts`, `cli-bootstrap.ts`, `handoff-guard.ts`) were not touched. `ci.yml` was not changed. GitNexus has no index in
this tree, so `impact` could not run; callers by grep: `renderState` is used by `server.ts` and by `sync`'s `greeting-size`; `readStatusKeys` has one caller, `readStandingCron`.

## 1. T-183, the cut ruled in D-100 (`state-render.ts`)

- **Gaps:** the newest `GAPS_SHOWN = 10` open gaps (T-209 order), then `  … and N older open gaps (M open in all): state.json gaps[]`. N and M are computed from
  `gaps[]` (open ones), not from the rendered lines. With 10 or fewer, no count line.
- **Task titles:** over `TITLE_CLIP = 100` characters, cut to the first 100 (right-trimmed) plus `…`. Ids, statuses and the `(supersedes ...)` suffix are never clipped.
  **Reading I chose:** "100 characters ending with `…`" is 100 characters of title plus the ellipsis (101 in all), following Atlas's message ("100 chars + …"). One constant changes it.
- **Role files: no change.**

**Red before** (6 new rows in `state-render.test.ts`; at `6c495794`): 4 failed | 37 passed (41): `C183-1` (40 gaps rendered 40 lines, no count line), `C183-2b`, `C183-3`, `C183-3b`.
**Green after:** 41 passed (41). `C183-2` (0, 1 and 10 open gaps: no count line) passed both before and after, as it should.
**One existing row changed on purpose:** `T183-3 ... leaves the objective and every active task title unchanged` required every title whole. It now states the D-100 rule independently
of the renderer (whole, or the first 100 plus `…`), and its name says so. All other T-183 clip rows pass unchanged.

**Mutants** (each reverted):
- *M-count-rendered* (N and M taken from the rendered gap lines): `C183-1` and `C183-2b` go red, 2 failed | 39 passed.
- *M-clip-99* (cut at 99): `C183-3` and the real-record title row go red, 2 failed | 39 passed.

**Live re-measure** (row 4), same method as the previous table: `handleStart({ project_root })` on this repo at the T-183 head, state rev 278 (80 active tasks, 40 open gaps).
**New total 42,629 characters, 532 lines, about 10,657 tokens, from 51,520 (down 8,891, 17.3%).** `sync` `greeting-size` now reports 41,586 (limit 40,000): still over, by 1,586.

| section | before | after | share now |
|---|---|---|---|
| header | 919 | 1,104 | 2.6% |
| Sizes block | 500 | 500 | 1.2% |
| State preamble | 685 | 685 | 1.6% |
| Tasks (80 active) | 12,066 | **8,120** | 19.0% |
| Verified | 1,819 | 1,819 | 4.3% |
| Gaps (40 open) | 7,126 | **1,996** | 4.7% |
| Decisions line | 182 | 182 | 0.4% |
| your handoff | 3,592 | 3,592 | 8.4% |
| other handoffs | 1,052 | 1,052 | 2.5% |
| last session | 108 | 108 | 0.3% |
| Role files | 23,471 | 23,471 | **55.1%** |

(The header is 185 characters larger than in the first table. That is not from these changes, which do not touch it; I did not investigate it.) Role files are now 55.1% of the greeting and unchanged by ruling.
The greeting is still over by 2,629 on `handleStart`'s own count and by 1,586 on `sync`'s `greeting-size`. Showing P2 and P3 tasks as a count line (about 2,900 characters, measured earlier) would clear both. That is not built; it is the planner's call.

## 2. T-224, a placeholder is named (`agent-identity.ts`)

- `readStatusKeys` keeps the placeholder it skips, and now recognises one **anywhere in a value** (`/<[^<>\s]+>/`), not only at the start. This is a small widening:
  the template's own `status_rule: .agents/roles/<role>.md` starts with `.`, so the old start-of-value test counted it as set.
- `readStandingCron` says `status_to is an unfilled placeholder (<agent-name>)`. A placeholder still counts as unset; an absent or empty key still says `missing`;
  a file whose only cron keys are placeholders still carries none of them (`none in seat data`, as before).
- `project-template/.agents/AGENT.md`: the sentence under the example now says to replace every `<…>` value and what `ob_start` says if not.

**Red before** (`standing-cron.test.ts`, 3 new rows): `SR-8` and `SR-8b` failed, 2 failed | 9 passed (11).
- `SR-8` (the template example copied verbatim, read at test time): received `status_to is missing`, expected `status_to is an unfilled placeholder (<agent-name>)`.
- `SR-8b` (recipient filled, `<role>` left in the rule path): received a valid line `*/20 * * * * → status to clark (rule: .agents/roles/<role>.md)`, expected `status_rule is an unfilled placeholder (<role>)`.
**Green after:** 11 passed (11). `SR-8c` (absent key, empty key, placeholder-only file) passed before and after. `sync --check`: `template-personal-names` and `command-parity` pass.

## 3. T-223, pin the PR group (`ci-runs-on.test.ts`)

One new row asserts the exact strings: PR from `loop/x` is `ci-pull_request-loop/x`, a push is `ci-push-loop/x`, a dispatch is `ci-dispatch-<run id>`; and the collision case:
a PR from head `push-x` is `ci-pull_request-push-x`, a push to `x` is `ci-push-x`, and they differ.

**QA 250's M-push-only mutant now fails.** I put `format('ci-{0}{1}', github.event_name == 'push' && 'push-' || '', github.head_ref || github.ref_name)` into `ci.yml` in the working
tree only, ran the file, and restored it (`git status` shows `ci.yml` unchanged): 1 failed | 20 passed, `expected 'ci-loop/x' to be 'ci-pull_request-loop/x'`.
The existing T-221 row (push group differs from PR group) **passed** under the same mutant, which is the gap this row closes. Under the mutant a PR from head `push-x` and a push to `x` would both be
`ci-push-x`; the exact-string assertion fails first, and the collision assertion is the one that would catch a mutant that kept the PR prefix right.
Green on the real `ci.yml`: 21 passed (21).

## Report

Reported to atlas-sia. The three code SHAs above are what QA should freeze.

## Dispatch 3 (a): P2 and P3 as count lines, new commit on `loop/t183-render-cut`

**New code SHA to freeze: `3b207dc64668dfcecffce0f0a8012273ab70617a`.** (It supersedes `9f8f0cd0` for this branch; the PR is #291.)
- `  [P2] N active: INBOX.md` and `  [P3] N active: INBOX.md`, counted from `tasks[]` (done excluded, blocked and in-progress included). P0 and P1 render their titles as before. A priority with no active task has no line.
- Red before (4 new rows `P3-1` to `P3-4`): 4 failed | 41 passed (45). Green after: 45 passed (45).
- One existing row narrowed: the real-record row "every active task title" now asserts P0 and P1 titles only (P2/P3 are counts by ruling).
- Mutant, count taken from the rendered task lines instead of `tasks[]`: `P3-2` and `P3-4` go red (2 failed | 43 passed). Reverted.
- `tsc --noEmit` exit 0. **Live re-measure** (state rev 278, 80 active): `handleStart` total **40,672** characters (from 42,629); Tasks section 6,158 (from 8,120).
  **`sync` `greeting-size`: PASS, 39,625 of 40,000** (it was 41,586). `sync --check`: 32 passed, 0 fixed, 2 warnings, 3 issues, 1 skipped (the `greeting-size` issue is gone; the other three are the standing ones).
  Live lines: `[P2] 16 active: INBOX.md`, `[P3] 3 active: INBOX.md`.
- Note: `handleStart`'s own total (40,672) is above 40,000 because it counts the mode, drift, session, warnings and sizes lines that the check does not; the check is what the limit is defined on.
