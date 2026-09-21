# Loop 16 brief — amendment 1: rulings before the first commit

**From:** Atlas (planner) · **Date:** 2026-09-20 · **Amends:** `loop-16-brief.md` (`8457600`) · **Before:**
the developer's first commit. **QA criteria:** `docs/loops/loop-16-qa-criteria.md` at `154d1b3` on
`qa/loop-16-criteria`, written from §4 before any candidate existed.

> **Why a file.** Six questions from the developer and seven items from QA arrived within minutes of
> each other through the hub rooms; two of the developer's are defects in §4 as written. A ruling
> that lives in a room dies with the room. This is the tracked copy and it binds; where it and the
> brief disagree, this file wins.

## 1. Two planner errors, set here

- **Planner 51 — A4 was unbuildable as written.** It asserted that lowering the floor turns A2's third
  case *from silent to injected*, and A2's third case is a command whose tokens match **no** entry —
  no floor can promote a row FTS never returns. Caught by the developer reading the artifact.
- **Planner 52 — A6 could not fail.** *"The tool call's own result is byte-identical to a run with no
  hook"* is structurally guaranteed on `PostToolUse`: the tool has already run. A green A6 would have
  been a derived value answering its own question — the exact class `loop-14-closeout.md` §3 names,
  in a brief that cites it. Caught by the developer; QA's planted-unequal payload (its item 5) was the
  right instinct against the same row and is now moot.

Both reached the brief and both seats. Entries, not near-misses. **Reading the artifact before
building is what caught them, in both seats, independently — which is the process working.**

## 2. Rulings, numbered to the questions

**R1 — `PostToolUse` only** (developer Q1). Accepted, and the reason is the one the developer gave:
on `PostToolUse` the host *cannot* honour a block, so "the trigger never blocks" is structural rather
than behavioural — deterministic-first exactly. The moment is right for this act too: the damage is
done when the seat reads the trimmed output and the `0`, and the reminder lands beside that result.
Brief §5.2 stands; §2 deliverable 1's "the developer chooses" is now chosen.

**R2 — A5 stays as emitted-JSON, both directions; the non-blocking property is cited, not tested**
(developer Q2, QA items 2 and 5). A5 asserts the hook's own output: on the A1 command
`additionalContext` present with entry 299's id and `ACTION`; on each A2 command **the key absent** —
present-and-empty is a fail (QA's reading is the brief's plain meaning: *not an empty reminder*);
in no case `permissionDecision`, `updatedInput`, or a non-zero exit. That these fields would be
ignored on `PostToolUse` is a fact about the host, cited from the hooks reference in the criteria,
and no mutant is built to prove it — a "deny on PostToolUse" variant run in a live session would
put a throwaway hook in front of a real seat for no evidence the documentation does not already give.

**R3 — A6 is re-scoped to what can fail** (developer Q3, QA item 5). Same three failures — store path
absent, store locked, hook killed at its timeout. Observables: **(a)** exit code `0`, **(b)** empty
stdout — no `additionalContext`, no partial, no error string dressed as an entry, **(c)** one line
naming the failure in the log file the handoff names. *Fails silent to the model, loud to the log.*
Note the reason (a) matters on `PostToolUse`: a hook that exits `2` has its stderr **shown to the
model** — a stack trace would be an injection by another channel. "Byte-identical tool result" is
dropped as an observable.

**R4 — A4 gets its own fixture case** (developer Q4). A command whose tokens **weakly match one decoy
below the floor**: at the shipped floor the trigger is silent; with the floor lowered in the policy
file and **no source change** it injects that decoy; restored, silent again. A2 keeps its three true
negatives unchanged. A4's drift-check clause stands.

**R5 — fires live in a sibling table; `recall_log` keeps meaning "reached the agent"** (developer
Q5). Design (a). `getSessionRecalledIds` and `recalled-ids.ts` precedence are unchanged; a silent
fire never enters the rated set by construction, not by a filter. Injected entries are written to
`recall_log` with the new trigger value **and** to the fires table; looked-at entries to the fires
table only.

**R6 — the new trigger value goes into `RECALL_TRIGGERS` (the DB set) and not into `ob_recall`'s
zod enum** (developer Q6i, QA item 3). An agent cannot label an explicit recall as hook-injected.
QA's item 3 is confirmed as the brief's plain meaning: **a fire that lands in the census as
`unspecified` is a fail** — `db-v2.ts:749` coerces an unregistered value silently, and that is
precisely the failure A8 exists to see.

**R7 — injected entries bump `recall_count` and `last_recalled_at`; looked-at entries do not**
(developer Q6ii). Injected reached the agent; that is what the counter means. `ob_list` will show
it, and that is correct.

**R8 — A8 is observed by calling the resolution directly, not by running QA's `/end`** (QA item 1).
`getSessionRecalledIds` against the live uuid, in the probe session. QA does not run `/end`
mid-loop in any case — its `/end` is the roll. Not both.

**R9 — the first commit survives to hand-over** (QA item 6). The developer's first commit is A1's
test failing, and **the branch is not squashed, rebased or reordered before hand-over**. The
hand-off cites the branch by rev *and* names that first commit's SHA. QA checks it out in a scratch
worktree and runs it red.

**R10 — A10 measures the floor, and says so** (developer's heads-up, QA item 7). Fifty or more
repetitions of one fixed trivial command, with and without the hook, p95 wall time reported with the
method and the configured `timeout`. That is the hook's cost, and node startup is its floor; if the
number is mostly interpreter startup the handoff names that and names "resident process" as the
out-of-scope way down. A number, not a verdict, as §4 says.

**R11 — QA's item 4** (a second independent caller for A1) is QA's own clause, marked `[mine]`,
and stays; it can fail only on a genuine disagreement, which is a finding either way.

## 3. A baseline QA measured that the brief did not state

At base (`4550ee5`), the live-store query *piping to tail masks the real exit code* returns entry
299 at rank 1 **inside a broadened result set** — `_(some results matched only part of the query)_`
— four of five rows are `OR` matches. §7.8 said 299 ranks first at base; it did not say the set
was built by the broadening the trigger is forbidden to use. So the precision-only path may return
fewer than five, possibly only 299, possibly nothing under a strict floor. **That number — the
live-store rank through the trigger's own path — goes in QA's report as a measurement (its §5.1),
not a row**, as QA proposed. And there is no relevance floor at base; A4 is entirely new surface.

## 4. Process, unchanged, restated only where the rooms changed it

The criteria exist (`154d1b3`); the developer may now branch `loop/16-recall-trigger` from
`origin/master` at `4550ee5` and make its first commit. Report by rev. The hub rooms are transport;
this file and the criteria are the record. Nothing is pushed by any seat: the planner pushes by SHA
on Aaron's word, and the settings.json registration for A7/A10 is Aaron's act at the moment QA
asks for it.
