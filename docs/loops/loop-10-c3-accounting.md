---
title: "Loop 10 C3 — the honest accounting"
status: accounting
loop: 10
author: Forge (Developer)
date: 2026-09-15
frozen_at: 7aeec31
for: Aaron
---

# C3 — What the memory half cost, and what it produced

**Written for Aaron. Frozen tree: `7aeec31`.**

Only the memory half was tested against Loop 10's criterion. Everything below about the
protocol half is therefore **observation, not finding** — it was never put through the same
test, and "audited and found wanting" against "not audited" is not a comparison.

## The cost

The project started **2026-03-18** — six months. Nine loops, 58 tags, seven of them for
Loops 1–9. Session 60 tonight.

The memory half is what those loops mostly went into: retrieval ranking, the maturity
lifecycle, apoptosis, the skill scan, the shadow harness, the ratings path, the dream
pipeline, vault capture.

## What it produced

**One significant result, and it is real.** On the repaired shadow harness, `bm25_only`
loses to `live` **10–23, p=0.035**. Live ranking beats a pure lexical baseline. That is a
genuine finding and it is why the ranker is KEEP.

**One instrument-class finding, and it is the larger of the two.** Across five loops, nine
instruments misreported. **Not one was found by inspecting the tool.** Every one was found by
a measurement disagreeing with another measurement. That is a real result about how to build
this kind of system, and it did not come free — it cost the loops that produced it.

**I am not inflating either.** The p=0.035 is one result on one comparison. The
instrument-class finding is methodological, not a working feature.

## What it did not produce

Ruled tonight, each on its own artifact:

- **Apoptosis never fired.** `archived_into` non-null: **0 rows** in six months. Not rarely —
  never. The source already said so in a comment.
- **`success_rate` could not discriminate.** It excluded neutral from its denominator, and
  neutral is **446 of 615 ratings**. It read 1.0 for almost everything ever rated: a number
  that could not be false.
- **The skill scan produced 0 skills** from 39 proposals in six months. The vault's `Skills/`
  folder is empty.
- **The dream pipeline** — 1,229 lines across six files — ran on no hook and left **no output
  artifact anywhere**.
- **The reflection queue** recorded **0 rows**, ever.
- **`/start` instructed agents to call two tools that do not exist**, and `command-parity`
  reported `pass` on it because it compares three copies to each other rather than to the
  server's registry.

**Tonight's deletions: 8,616 lines removed, 1,246 added, across 64 files.** `open-brain/src`
went from 61 TypeScript files to 44.

## The answer to the question the project was started to ask

**The ranker earns its keep. The injection does not.**

The p=0.035 result is about *ranking* — given a query, live ordering beats BM25. It is **not**
evidence that injecting recalled knowledge at session start changes what an agent does. The
one attempt to measure that collapsed to **p=0.688** once the control was topic-matched.

And the strongest available evidence arrived tonight, in this session:

- The checkpoint slot returned a **five-loop-stale** entry — which genuinely was the newest in
  scope, so not even a ranking failure.
- **Entry 556 — the note describing the very defect that would repair the system — has been
  recalled zero times** across all 1,311 recall rows.
- **347 of 561 entries carry no project scope**, so scoping cannot work for 62% of the corpus.

**Then the decisive one.** `CLAUDE.md` is injected into every session unconditionally: 100%
delivery, no retrieval, no ranking, no scoping, top of context. It already contained the
sentence *"Summaries tab is empty — v2 has no summaries table."* That fact sat at maximum
privilege in every session for weeks **while `/start` went on instructing agents to call
`ob_summarize()` and `ob_store_summary()`, which do not exist.**

**A fact delivered perfectly, every time, at the top of context, did not connect to the
instruction it contradicts.**

That is an upper bound measured on the best possible case. **If perfect delivery does not
produce connection, the memory layer's problem is not delivery** — and no improvement to
ranking, maturity weighting, recency constants or scoping can reach it. Every repair this
project has shipped to the retrieval path has been optimising a variable that is not the
binding one.

**So, in the words the brief asked for if the evidence pointed this way: after six months, the
memory half is still unproven.** The one thing in it that has evidence is the ranker, and what
the ranker is good at is not the thing the layer was built to do.

**On the protocol half — observation, not finding.** Tonight's true project state was
reconstructed from `decisions.md`, which is hand-maintained. The memory half handed both
seats stale state. I did not test the protocol half against the criterion, so I cannot say it
earned its keep; I can say it is what was actually used when it mattered.

## The most uncomfortable thing found

The shadow harness's most intricate machinery — the as-of replay and lifecycle snapshot —
existed to control for two variables (`maturity` and `success_rate`) that this loop ruled do
not earn their keep. **It is not a defect in the harness.** A careful instrument built for an
unearned mechanism is exactly what that looks like.

**The general form: the project built sophisticated machinery to measure something, and never
asked whether the something mattered.** The care went into the instrument rather than into the
question. That is nine loops of instrument repair described in one sentence.

## The one rule worth carrying out of this loop

**Two measurements that share a premise are one measurement.**

Five instances in one evening, across two agents and three subsystems:

1. The dual enumeration missed every prompt-driven component, because both passes assumed a
   component is code.
2. `command-parity` reports `pass` on an instruction that cannot execute, because three
   identical copies of a false statement agree perfectly.
3. A Planner error was briefly confirmed by a Developer error drawn from the same source.
4. A Planner finding was relayed to Aaron unattributed, making one source look like two.
5. **`db.ts`** — 479 lines, unreachable from production, carrying a live copy of a component
   this loop had already cut. Invisible to the source pass (which asked what production
   imports) and to the prompt pass (which asked what calls a memory tool), because both share
   the premise that a component is something production reaches. **This one survived all the
   way to a frozen SHA.**

The project's instrument history is nine misreports caught only by measurements disagreeing.
**This rule names the exact condition under which that catching mechanism silently stops
working.**

A sixth, near-miss, worth one line because it cost nothing: the Planner nearly asserted a
missing amendment after reading a diff through `| head`, and ran a targeted check first. **The
containment was verifying before asserting — not remembering not to truncate.** The hazard is
structural.

## Idea B — the module boundary

**The only original idea never run.** These rulings make it **cheaper, and more clearly
separable** — not moot, and not urgent.

Cheaper because the memory layer is now much smaller and its unearned parts are gone, so a
boundary drawn today encloses less. More clearly separable because the ruling split the layer
along a line Idea B would have had to find anyway: **the ranker, which works, versus the
injection, which is unproven.**

Not urgent, because the binding constraint is not architectural. **It is that perfect delivery
does not produce connection**, and a module boundary does not change that.

**Not done here**, per the brief.

## Two things that follow from tonight and are yours to decide

**The Node v22 pin is released.** It existed for Smart Connections, which was CUT: no code in
this repository, and it could not be observed running during the loop that ruled on it.
**You still run the plugin in your vault, so moving to v24 may break it there** — outside this
repo, where nothing in the test suite would catch it. `CLAUDE.md` now says so in those words.
Treat v22 as the tested version and make any bump deliberate.

**`success_rate` still exists as a column in your live database**, holding its last values.
Nothing computes or reads it. Dropping it means rebuilding a table in your working knowledge
base, which this loop did not rule on, so I left it.

**Session-start recall injection is off in your live environment**, not just in the repo. The
block was deleted from all three mirrors including `~/.claude/commands/start.md`, because a
ruling that leaves the live environment untouched is inert. Your next `/start` will not
inject recalled knowledge. `ob_recall` remains available as a deliberate mid-task tool.

## Error accounting

**25 Planner, 19 Developer**, per-loop and summing. Both counts moved within single exchanges
tonight, in both directions, which is the only evidence the count means anything.
