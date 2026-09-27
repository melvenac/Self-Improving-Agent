# Loop 15 slice three: candidate A11, brief for a FRESH developer session (Grok, record session 115)

**By:** Atlas (planner), record session 109 · 2026-09-26. **To:** the developer seat, **Grok in Cursor, record 115**,
a fresh session (D-035) in `~/Worktrees/sia-forge`. Aaron starts the session. The planner talks to you in hub room
`k57frxw0ptb8tadmqdwy0khhks8ey006`. **A2A has no memory:** rulings made in the hub are written into a tracked file
by the planner.

## 1. Why

A10 `4b7a5ae` was rejected by QA 108 (`origin/qa/loop-15-slice-3-a10-report` `d352af3`). Its high defect, A10-1, is
that `identify()` contains an `lstat` failure correctly, but three of its callers turn the result into `null` (absent),
so a planted hook passes a completed loop and a user's existing hook is deleted by the restore. Rulings-19 carries R83
to R88.

## 2. The work

**R83 first** (rulings-19): kind `other` with a code becomes `unreadable (<code>)` with facts at **every consumer**. At
`ecf1f62` those are at least `readState :463`, `readForCompare :703` and `begin :683`. Search for the rest (`kind !==
"file"`, `=== null`, over identities) and **name every consumer in the handoff**. Then R84 (observable is not the same
as read), R85 (no side stands alone: search the whole file, and list what you find), R86 (an ancestor link's `lstat`
facts), R87 (R72's call site gets a killing test) and R88 (a read failure at open refuses the stage).

## 3. Read ONLY this

1. Rulings-19 in full (`docs/loops/loop-15-slice-3-rulings-19.md`), plus rulings-18 readings 1, 5 and 6 and R82.
2. QA 108's report: the verdict, §9, §11, §14 and §15.
3. **Known positives:** QA 108's probe files (`docs/loops/qa-scripts-a10/` and the `qa108-a10-probe*.test.ts` files on
   `qa/loop-15-slice-3-a10-probe` and `-probe2`). **Known negatives:** `qa/loop-15-slice-3-a10-fix-q108` and
   `-fix-q108-2`. Read them to see what the fix touches, not to copy it.

## 4. How

- Branch `loop/15-slice-3-candidate-a11` from `4b7a5ae`. One commit per ruling.
- **Red first with YOUR OWN tests**, on `4b7a5ae`, as `loop/15-slice-3-a11-redcheck`, per test on tcm. A row red for the
  wrong reason does not count, and neither does a row that is only argued red.
- **A code mutant per protection**, each on `loop/15-slice-3-a11-mut-<name>`, batched on tcm. `npx tsc --noEmit -p .`
  before every push and on every mutant.
- CI on **tcm** (D-040). Hosted minutes are exhausted until 2026-10-01. CA-9 is red on tcm (T-182), and it is not yours.
- **No full local suite** (the planner's ruling: this box is never quiet during the day). QA runs it on the QA PC.
- Push only `loop/15-slice-3-candidate-a11` and `loop/15-slice-3-a11-*`. Never master, never force, and read back each
  push. On a refusal or a denied command, stop and tell atlas.

## 5. Hand back

`docs/loops/loop-15-slice-3-a11-developer-handoff.md`, with: a commit table built from each commit's own `git diff --stat`;
the consumer list (R83) and the placeholder search (R85); per ruling, its red run, green run and every mutant with its
run id; every existing test whose assertion changed, with the ruling that allowed it; and your model and effort. Then
name the frozen SHA. No `/end` (T-163).

**First message to atlas:** "A11 started", with your model and effort.
