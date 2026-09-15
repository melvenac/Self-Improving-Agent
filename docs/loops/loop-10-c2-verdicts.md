---
title: "Loop 10 C2 — the verdicts"
status: rulings
loop: 10
author: Forge (Developer)
date: 2026-09-15
criterion: docs/loops/loop-10-c1-criterion.md (8eaff69)
enumeration: 0622028, 914adaa, bfee8c0
---

# C2 — Rulings

Every verdict carries its named artifact. A ruling without one is not a ruling.
Verdicts issue **on the pair** where a prompt component drives a code component.

**Evidence re-derived cold this session**, not taken from the Planner: `knowledge_index`
561 rows, `project_dir` NULL **347** (61.9%), `recall_count = 0` on **141**; maturity
progenitor 521 / proven 26 / mature 14; **`archived_into` non-null: 0**; `recall_log` 1,311
rows across 55 sessions, `recall_trigger` NULL on **637** (48.6%); `feedback_log` 615 rows —
neutral **446**, helpful 166, harmful **3**; `reflection_log` **0 rows**; `chunks` **64 rows**
(63 checkpoint, 1 spec). Vault: Experiences 532, Summaries 207, Topics 202, Checkpoints 27,
**Skills 0**. `skill-invocations.jsonl` 2,337 lines. `shadow-recall.jsonl` 14 lines, last
written 2026-09-10. `.skill-proposals-pending.json` 39 entries.

## The verdicts

| # | Component | Cat | Verdict |
|---|---|---|---|
| E1 | Vault capture (+P5) | B | **KEEP** |
| E2 | Session summary | B | **KEEP** |
| E3 | Maturity lifecycle + counters | D | **SUSPENDED** — trigger below |
| E4 | Ratings path + `feedback_log` (+P5) | B | **KEEP** |
| E4b | `success_rate` as a derived field | D | **CUT** |
| E5 | Recalled-ids gate | B | **KEEP** |
| E6 | Reflection queue | D | **CUT** |
| E7 | Invocation logger | B | **KEEP** |
| E8 | Skill scan + proposals (+P7) | D | **CUT** |
| E9a | Shadow-recall harness | A | **KEEP** |
| E9b | As-of replay / lifecycle snapshot | C | **SUSPENDED** — same trigger as E3 |
| E10 | Topics pipeline | B | **KEEP** |
| E16a | Vault-freshness detection | B | **KEEP** |
| E16b | The warning's causal claim | — | **CUT** |
| E17 | `ob_recall` + ranker | A | **KEEP** |
| P1 | `/start` recall **injection** (=E28) | D | **SUSPENDED** — trigger below |
| E18 | Apoptosis gate | D | **SUSPENDED** — same trigger as E3 |
| E19 | Store path + content guard | B | **KEEP** |
| E23 | Chunk store (+P6) | B | **KEEP** |
| E24 | Dream pipeline | D | **CUT** |
| E26 | v1 session-end pipeline | D | **CUT** |
| E27 | Score-entries migration | D | **CUT** |
| P2 | `/start` session registration | C | **KEEP** (inherits E1/E4) |
| P4 | `/start` periodic maintenance | D | **CUT** |
| P6 | `/checkpoint` | B | **KEEP** |
| P9 | Guide SKILL.md | B | **KEEP** |
| B8 | Smart Connections | D | **CUT** |
| B10 | `.recalled-entries.json` | — | Already gone; no verdict required |

**Tallied from the table rows programmatically, not by eye: 28 rows — A 2, B 11, C 2, D 11,
n/a 2. Verdicts: 14 KEEP, 9 CUT, 4 SUSPENDED, 1 requiring none.**

**D is non-empty (11) and A/B is non-empty (13).** Both of C1's falsification conditions are
unmet, so the criterion stands.

> **Correction, recorded rather than silently fixed.** The first version of this document
> (`d2b84ab`) stated "D is non-empty (9 components)", omitted **E18 from the table** while
> ruling it in prose, and reported "nine CUTs" — a count asserted without running the count,
> in the loop's own deliverable, the same defect as Planner 18/19/20 and Developer 16. The
> Planner caught it by tallying the rows with `awk` instead of reading them. **Developer
> error 17.** Every figure in the block above is now produced by `grep | awk | sort | uniq -c`
> over the table, and the table is the auditable artifact.

## The central ruling: the ranker earns its keep, the injection does not

**This is the loop's finding and the two halves must not be confused.**

**E17 — KEEP, category A.** The artifact is the shadow harness result already in the record:
on the repaired instrument `bm25_only` loses to `live` **10–23, p=0.035** — the only
significant result the project has produced. That is a genuine artifact showing an outcome
differing, and it is an artifact **about the ranker**: given a query, live ranking returns
different and better-ordered results than a BM25 baseline. 1,311 recalls across 55 sessions
establish use; cost is bounded and a recall failure cannot take a session down.

**P1 — SUSPENDED, category D.** The ranker being better than BM25 is **not** evidence that
injecting its output at session start changes what an agent does. No artifact shows that, and
the one attempt to measure it **collapsed to 4–2, p=0.688** once the control was topic-matched
— because BM25 selects on lexical overlap with a query reflecting the session's subject, so a
recalled entry shares vocabulary with the work *by construction of the retrieval*.

Tonight supplied the strongest available evidence, and it is evidence against:

- The checkpoint slot returned **#551, a Loop 4 checkpoint** — `recall_count` 11, last
  recalled `2026-09-15 20:31:06`, i.e. this session. Five loops stale, and **not a ranking
  failure**: it genuinely is the newest SIA-scoped checkpoint.
- **#566**, whose first line describes Loops 5–7 being driven to merge, sat at `recall_count`
  **0** with zero `recall_log` rows, in `project_dir = c:/users/melve` — the other seat's
  scope, structurally invisible to this one.
- **#556** — the entry describing the very defect that would repair the system — has
  `recall_count` **0** and zero rows across all 1,311. **The knowledge that would repair the
  system is not retrievable by the system.**
- **347 of 561 entries carry `project_dir = NULL`**, so the `project:` argument cannot scope
  61.9% of the corpus.

**And the maximum-injection case failed in the same session.** `CLAUDE.md` is injected into
every session unconditionally — 100% delivery, no retrieval, no ranking, no scoping, top of
context. It already carried the sentence *"Summaries tab is empty — v2 has no summaries
table."* That fact sat at maximum privilege in every session for weeks while `/start` went on
instructing agents to call `ob_summarize()` and `ob_store_summary()`, which do not exist, and
while `command-parity` went on reporting `pass`. **A fact delivered perfectly, every time, at
the top of context, did not connect to the instruction it contradicts.**

**That is an upper bound measured on the best case.** If perfect delivery does not produce
connection, the memory layer's problem is not delivery, and **no improvement to ranking,
maturity weighting, recency constants or scoping can reach it.** Every repair this project has
shipped to the retrieval path optimises a variable that is not the binding one.

**Named trigger for P1's revival:** a topic-matched controlled comparison showing that
sessions receiving injected recall take different actions from sessions that do not. Not a
refinement of ranking, and not an uncontrolled before/after. Until such a result exists, the
injection block is deleted; **its text is recoverable at `bfee8c0:.claude/commands/start.md`.**

## The other rulings that carry weight

**E18 apoptosis — SUSPENDED, on the same trigger as E3.** `archived_into` non-null is **0**:
it has never retired a single entry in six months, and `db-v2.ts:802` already says so —
*"which is why apoptosis has never fired."* It gates on a success rate that is structurally
1.00 because neutral is excluded from the denominator, and neutral is **446 of 615 ratings**.

**This verdict was CUT in `d2b84ab` and is corrected here.** The first version denied E18 a
trigger on the grounds that its revival "requires changing a different component's semantics,
which is not a trigger on this one" — while granting E3 a trigger that **waits on the same
thing**. Apoptosis prunes below 0.3 after 5 ratings; it gates on precisely the rate E3's
trigger names. **The identical observation revives both.** Applying C1's
`D → CUT unless a reviving observation can be named` asymmetrically to two components sharing
one dependency is the exception-invented-while-ruling that C1's falsification section exists
to catch. The Planner caught it. **Developer error 18.**

**Resolved by symmetry, in the direction that grants the trigger**, because the observation is
genuinely nameable and specific: **a replacement for `success_rate` that discriminates.**
Text recoverable at `bfee8c0:open-brain/src/lifecycle.ts`.

**Trigger, in full — this clause is load-bearing and must travel with the trigger:**
restoring apoptosis means restoring maturity-weighted ranking, and **E9b, the as-of replay,
must be restored in the same change.** Evaluating a restored ranking without it measures the
new ranking with the evaluating session's own feedback inside it. A revival that omits E9b is
not a partial revival; it is one that cannot be honestly measured.

**E4b `success_rate` — CUT, false-report clause.** It reports a rate that excludes 72.5% of
its own inputs and is therefore structurally 1.00. Rule 5: a number is not health until the
other case is shown reachable. The recording path (E4) is sound and stays; the derived field
that cannot be false goes.

**E3 lifecycle — SUSPENDED.** Boosts have been off since Loop 8 (`lifecycle.ts:20`) and the
file records restore values while naming **no reviving observation** — the open-ended
suspension this loop exists to close. A trigger is nameable: **a ratings distribution in which
`success_rate` discriminates**, which requires E4b's replacement to exist first. Text
recoverable at `bfee8c0:open-brain/src/lifecycle.ts`.

**Trigger, in full — this clause is load-bearing and must travel with the trigger:**
restoring the boosts means restoring maturity-weighted ranking, and **E9b, the as-of replay,
must be restored in the same change**, or the restored ranking is measured with the
evaluating session's own feedback inside it.

### E9 re-ruled as a pair — a verdict made after seeing the consequence, dated

**2026-09-15, after the E4b/E3/E18 deletion was attempted and its cascade became
visible.** Recorded as made now, per C1's falsification clause, rather than presented as
following from the original ruling.

Executing E4b, E3 and E18 collapses machinery inside E9, which was ruled KEEP. The
original verdict ruled on the harness's artifact (p=0.035); it said nothing about whether
the harness's confound-control survives the removal of the confound. That is a ruling, so
it is made explicitly rather than settled by an implementation choice.

- **E9a — the harness itself. KEEP, category A**, unchanged. The p=0.035 artifact stands.
- **E9b — the as-of replay: `LifecycleOverride`, `LifecycleSnapshot`,
  `captureLifecycleSnapshot`, and `shadow/evaluate.ts`'s use of them. SUSPENDED, category
  C**, on E3 and E18's trigger.

**Why SUSPENDED and not CUT, which is where this nearly landed.** E9b holds exactly two
columns — `maturity` and `success_rate` — so a replayed session is evaluated against the
lifecycle state as it stood, rather than against state this session's own feedback moved.
**E3 and E18 are suspended, not cut: their return is already provided for.** If their
trigger fires, maturity-weighted ranking comes back — **and the confound comes back with
it.** A CUT here would delete a revival instruction, and whoever fires that trigger would
restore maturity ranking and then measure it with the exact contamination Loop 9 built
this machinery to remove. **E9b's keep is wholly derivative of components whose return is
anticipated**, so it is suspended on their trigger and nothing else.

**Consequently the trigger text itself is amended, in all three places.** Reviving
maturity ranking without restoring the as-of replay is not a partial revival; it is a
revival that cannot be honestly measured. The next agent will read the trigger, not
reconstruct this argument — which is the evening's own lesson applied forward.

### SUSPENDED deletes the code too — vocabulary extension, and when it was made

C1 said "CUT means the code goes" and did not say what SUSPENDED does to code. `bfee8c0`
pinned the answer for **prompt** artifacts before any was ruled: the block is deleted, the
trigger and a recovery SHA are recorded elsewhere, and suspension differs from CUT only in
whether a reviving observation was nameable.

**That rule is extended to code here, and this extension was made after seeing E3 and E18** —
recorded with its date per C1's falsification section rather than presented as having been
pinned in advance. The reasoning is not new: C1 already forbids dormant code, holding that
"anything kept as dormant code is a KEEP wearing a CUT's label." **A SUSPENDED component left
switched off in the tree is exactly the open-ended suspension this loop was convened to end**,
and E3 and E18 are already in that state — off since Loop 8, with no stated condition for
return. Leaving them there under a new label would re-create the thing being ruled against.

**Consequence: E3 and E18 are deleted, like the CUTs.** The difference is that their reviving
observation is written down and their text is recoverable at a named SHA. **On the operational
question the Planner raised, the E3/E18 split therefore no longer changes what happens to the
code** — both go — which is why resolving the asymmetry toward SUSPENDED costs nothing and
preserves the honest distinction.

**E6 reflection queue — CUT.** `reflection_log` has **0 rows**. Six months, never once
recorded anything.

**E8 skill scan + P7 — CUT.** Already off since Loop 9. **Vault `Skills/` contains 0 notes**
and `.skill-proposals-pending.json` has 39 entries none of which has ever been acted on. Six
months of operation, zero skills produced. Nothing is deleted from the vault; the scan is
derived, and what goes is the generator, the proposal machinery and the pending file.

**E24 dream pipeline — CUT.** 1,229 lines across six files, reachable only from
`cli dream`, on no hook, with **no output artifact anywhere in the vault**. The largest
single carried-on-hope component in the project.

**E26 v1 session-end pipeline — CUT.** Unreachable from any hook, reachable by invocation as
a published bin. Already filed as **T-100** with two further defects on the same path: a
divergent `evaluateLifecycle` hardcoding 0.3/5/3/7/0.5, and capitalised maturity strings the
`knowledge_index.maturity` CHECK constraint rejects. The no-op `insertChunk` at `cli.ts:202`
is the third.

**P4 `/start` periodic maintenance — CUT.** Its session-aging stage instructs calls to
`ob_summarize()` and `ob_store_summary()`, **neither of which exists** among the server's 14
tools; its skill-candidate check reports on a generator turned off in Loop 9. Recoverable at
`bfee8c0:.claude/commands/start.md`.

**E16b the warning's causal claim — CUT.** The SessionStart warning detected a real anomaly
tonight — session `2e9a436d` genuinely had no capture — but asserted *"session-end may be
failing,"* a cause it never tested, and which was **wrong**: that session has no `sessions`
row at all, so `ob_set_session` never ran and capture had nothing to key on. Rule 6, live in
a warning. **The detection earns its keep and stays (E16a KEEP); the untested cause goes.**

**B8 Smart Connections — CUT.** No code in this repository; every reference is archived
prose. It could not be observed operating this session (`CONNECTION_CLOSED`, reconnect
attempted and failed), so by C1's unobservable clause it cannot be A or B. **It nonetheless
imposes a live cost**: `CLAUDE.md` pins the project to Node v22 because v24 breaks it. A
dependency that constrains the toolchain, has no integration in the codebase, and cannot be
observed is carried on hope. CUT means removing it from the documented architecture and
releasing the Node pin, not uninstalling anyone's plugin.

## Disconfirmations recorded

Two mechanisms were proposed, determined, and did **not** fire. Recording them costs nothing
and dropping them would be the selective reporting rule 3 exists to prevent.

- **The no-op `insertChunk` did not cause tonight's capture loss.** Nothing automated reaches
  `cli.ts:202`; `ob_set_session` never running remains the cause.
- **`index.ts:40`'s hardcoded `recalledEntryIds: []` is a dead vestige, not a live liar.**
  `sessionStart()` has exactly two call sites and neither reads the field.

## One Planner figure disconfirmed

The Planner cited **#192** as "shortest in existence, SIA-scoped, **never surfaced**," using
it to falsify the brevity claim. **It has surfaced 42 times** — `recall_count` 42, 32
`recall_log` rows, maturity `mature`. The brevity claim is still dead, on the non-monotonic
lengths, but **this particular support for it is false** and is not carried into the write-up.
Every other Planner figure re-derived tonight — 347 NULL of 561, 1,311 recall rows, #556 at
zero, #566 at zero in home scope, #551 returned this session — **checks out exactly.**

## The principle this loop names

**Two measurements that share a premise are one measurement.**

It appeared three times tonight in three subsystems: the dual enumeration missed every prompt
component because both passes assumed a component is code; `command-parity` reports `pass` on
an instruction that cannot execute because it compares three copies to each other and never
to the server's registry; and a Planner error was briefly confirmed by a Developer error
drawn from the same source. This project's instrument history is nine misreports caught only
by measurements disagreeing. **This principle names the exact condition under which that
catching mechanism silently stops working**, and it belongs in the record above the errors
that produced it.

Running error count: **23 Planner, 18 Developer.**
