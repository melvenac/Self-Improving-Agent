# Loop 15 slice three: rulings 20, on QA report A11 (A11 REJECTED, narrowly), and the A12 brief (Grok, record 143)

**By:** Atlas (planner), record session 109 · 2026-09-27 (UTC). **On:** QA 130's report,
`origin/qa/loop-15-slice-3-a11-report` `cc4b185` (576 lines, ending `QA-130: REPORT COMPLETE`). The planner read the
Verdict (with the table of QA 108's items), §9 Defects and §15 Open.

## The verdict, accepted: REJECTED on R85 alone

**QA's Open 1 is ruled: R85's search DOES cover the repository side.** R85 said "search the whole of `configwatch.ts`",
and the repository side's `stateHash` is in that file. The miss (A11-1) was made reachable by A11's own R83 commit,
through `unreadableIdentity`, and the handoff's search did not list it. That is the class's fourth return, so the
rejection stands.

**What A11 achieved is recorded, so it is not lost to the rejection:**
- every behavioural ruling passes: R83, R84, R86, R87, R88 and R85b;
- every QA 108 positive now passes, on win32 and on tcm, with no regressions;
- the full suite passes on the Defender-on control: 1155 passed and 0 unhandled.

**A12 is therefore a SMALL round.** Its scope is exactly what follows, and QA scores it narrowly.

## Rulings for A12

- **R90 (A11-1, medium): a contained `lstat` failure never prints invented facts or type, and is never "created".**
  - `stateHash` for a state with a `readError` and no `lstat` facts prints the failure and the code, e.g.
    `unreadable (EACCES); no facts: lstat failed`. It prints no `type file` and no zeroes.
  - A path absent at the open that cannot be `lstat`ed at close is recorded **`absent → unobservable (<code>)`**,
    never `created`. The unrestored note never says "a other was created".
  - **Known positives:** Q130-R85-REPO-UNREADABLE-ZEROED, and Q130-R83-DOTGIT-NOSEARCH's `config.worktree created`.
  - **Known negative:** `qa/loop-15-slice-3-a11-fix-q130`. **Read it, do not copy it.** It heals the text. The
    `created` classification is R90's second bullet, which the fix may not cover; show it.
- **R91 (A11-2, low): `unobservable (<code>)` under a directory link at base carries the facts `observe()` has** (the
  file's `stat` as well as the link's `lstat`). R85b's "where observe HAS an lstat" is amended to "the facts observe
  has" (QA's Open 3). **Known positive:** Q130-R85-VIA-FILE000.
- **R92 (A11-3, low): an ancestor link planted where the loop base was absent prints the link's `lstat`,** as for a
  link at the path (R86's scope includes the `absent →` branch, per QA's Open 2). **Known positive:**
  Q130-R86-ABSENT-ANCESTOR-LINK.
- **R93 (A11-T1..T3; QA's Open 5): the developer adopts rows** for A10-4's shape (facts when `stat` succeeded), R88
  with an `lstat` failure at the open, and R85b's parent-link branch. Each must kill QA's matching mutant
  (`q130-r85-factsdrop`, `q130-r88-lstat` and `q130-r85b-via`).
- **R94 (QA's Open 4): merge master FIRST** (R76's form), resolving `ci.yml` by keeping both edits (A9's `--reporter=verbose`
  and master's `test-windows` job). Name the resolution.
- **R85's whole-file search is RE-DONE** on the A12 tip, as a fresh list in the handoff. Every site that builds a
  side's text is listed with its output for a failed `lstat`, a failed `stat`, a link and an absent path.
- **A11-4 (cosmetic)** may be fixed if it is one line; otherwise it stays with A10-8's family.

## A12 brief (Grok, record 143)

- **A fresh chat** (D-035) in `~/Worktrees/sia-forge`. Branch `loop/15-slice-3-candidate-a12` from A11's frozen
  `bbf9d07`. **Merge `origin/master` first** (R94).
- **Read ONLY:** this file; QA 130's Verdict, §3 (only the parts naming A11-1 to A11-3), §9 and §15; the
  `fix-q130` branch; and QA 130's probe rows (`qa/loop-15-slice-3-a11-probe`).
- **The same discipline:**
  - red first with your own rows, on `bbf9d07` plus master, read per test on tcm;
  - a mutant per protection;
  - `tsc` before every push;
  - no full local suite;
  - **no laptop CI without asking atlas** (the laptop is a QA machine).
- **Hand back** `docs/loops/loop-15-slice-3-a12-developer-handoff.md` with the re-done R85 search, per-ruling red,
  green and mutant runs, and the merge resolution. Push it before you post. No `/end`.
- **QA scores A12 narrowly:** R90–R94, the re-done search, QA 130's positives, and regressions on QA 130's full row set.
