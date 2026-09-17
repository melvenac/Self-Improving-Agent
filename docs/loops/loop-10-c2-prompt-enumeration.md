---
title: "Loop 10 C2 — the prompt surface, enumerated; verdict vocabulary for prompt artifacts"
status: enumeration-before-ruling
loop: 10
author: Forge (Developer)
date: 2026-09-15
amends: docs/loops/loop-10-c2-enumeration.md (0622028), loop-10-c2-boundary-amendment.md (914adaa)
criterion: docs/loops/loop-10-c1-criterion.md (8eaff69) — UNTOUCHED
---

# Enumeration 3 — the non-TypeScript surface

E28 entered the set because the Planner pointed at one instance. **The method that missed
`start.md` misses every prompt-driven component equally**, so ruling the memory half against
a known-incomplete set would make every D verdict unsafe: "no component names it as a
dependency" cannot be asserted over a set known to be missing a category. That is C1's own D
test failing on its own terms. This is the last enumeration pass.

## The instrument

Same discipline as the import-list test for code, and equally auditable: **a prompt file is
memory-half if it instructs an agent to call a memory tool.** Measured by
`grep -oE '\bob_[a-z_]+'` per file across `.claude/commands/`, `.agents/skills/`,
`~/.claude/commands/` and `project-template/`.

## The prompt surface, by mirror

The command set exists in **three mirrors**: the repo (`\.claude/commands/`), user scope
(`~/.claude/commands/`), and the distributable (`project-template/.claude/commands/`), plus a
fourth partial Cursor mirror (`project-template/.cursor/commands/`). **`/sync`'s
`command-parity` check compares them** and reported `pass` this session: "7 shared commands
identical across repo, template and user scope." **User scope is what actually executes.**

| # | Component | Memory tools it drives | Half |
|---|---|---|---|
| P1 | `/start` recall block (= E28) — start.md:61, :63, :64, :139, :141, :142 | `ob_recall` | Memory |
| P2 | `/start` session registration | `ob_set_session` | Memory |
| P3 | `/start` state load | `ob_start` | Protocol |
| P4 | `/start` periodic maintenance — session aging, stale pruning, skill-candidate check | `ob_summarize`, `ob_store_summary`, `ob_list` | Memory |
| P5 | `/end` rating and capture block | `ob_feedback`, `ob_recalled`, `ob_recall`, `ob_store`, `ob_end` | Memory |
| P6 | `/checkpoint` | `ob_recall`, `ob_store_chunk` | Memory |
| P7 | `/skill-scan` command | `ob_store` | Memory |
| P8 | `/sync` command | `ob_sync`, `ob_score` | Protocol |
| P9 | `self-improving-agent-guide/SKILL.md` | `ob_feedback`, `ob_recall`, `ob_set_session`, `ob_store`, `ob_store_chunk` | Memory |
| P10 | Cursor mirror (4 files) | `ob_recall`, `ob_score`, `ob_set_session`, `ob_store`, `ob_sync`, `ob_end` | Memory — **G-001, out of scope by the brief** |

`.claude/commands/harness-audit.md`, `task.md`, `test.md`, the gitnexus SKILL.md set,
`self-improving-agent-gotchas/SKILL.md`, and the `project-template/.claude/rules/` files
carry **no `ob_` reference** and are therefore not memory-half by the instrument.

## Rule 4 — enumeration 3 against enumerations 1 and 2

**In enumeration 3 alone (all of P1–P10): ten components, none of which appeared in either
earlier enumeration.** Enumeration 2 was built from memory of the project; enumeration 1 was
built from source but scoped to TypeScript. Neither could reach a markdown instruction.

**Why the exception is allowed:** it is not allowed as an exception — it is the correction of
a defect in enumeration 1, already logged as **Developer error 16**. The set is now the union
of all three enumerations.

**No overlap to report by identity**, but the coupling matters and is recorded: **every
memory-half prompt component drives a code component already enumerated.** P1 drives E17;
P5 drives E4, E5 and E1; P6 drives E23; P7 drives E8; P2 drives the session registration
E17 depends on. **A verdict on a code component that ignores its driving prompt rules on
half a mechanism.** Verdicts are therefore issued on the pair where a pair exists.

## The finding this pass produced

**`/start` instructs the agent to call two tools that do not exist.**

- `start.md:181` — "Call `ob_summarize()` to find unsummarized sessions"
- `start.md:185` — "Call `ob_store_summary(session_id, summary, model)` to persist"

`grep -rn "ob_summarize\|ob_store_summary" open-brain/src` returns **nothing**. The server
registers exactly **14** tools — `ob_end`, `ob_feedback`, `ob_forget`, `ob_list`,
`ob_recall`, `ob_recalled`, `ob_score`, `ob_set_session`, `ob_start`, `ob_state`,
`ob_stats`, `ob_store`, `ob_store_chunk`, `ob_sync` — and neither name is among them.

**This is present in all three mirrors**, so `command-parity` passes: the check compares the
copies to each other, never the tool names against the server's registry. **A stand-in
checked instead of the thing** — rule 6, live, in a validator that reported `pass` this
session.

Recorded, not repaired. It is ruled at P4.

## `index.ts:40` — `recalledEntryIds: []` — consumers determined

**Determination: nothing consumes it. It is a dead field, not a live liar.**

`sessionStart()` is called from exactly two places — `cli.ts:144` and `server.ts:193`
(`ob_start`). **Neither reads `result.recalledEntryIds`.** Every other hit on that identifier
belongs to a *different* type: `session-end/types.ts:5`, populated for real by
`resolveRecalledIds` at `cli-session-end.ts:94` and `server.ts:366`, and consumed at
`index-v2.ts:130`, `:135` and `auto-feedback.ts:72`.

**So the false-report clause is not triggered:** the field emits its untested claim to
nobody. It is a vestige of the superseded design in which `/start` reported what it recalled,
which `recall_log` replaced. Evidence for the enclosing component's verdict, carried to E17
and E4; **it does not by itself bar KEEP anywhere.**

Recording the negative explicitly, per rule 5 in the other direction: a mechanism that could
have fired and did not is worth the same words as one that did.

## Verdict vocabulary for prompt artifacts — pinned before E28 and P1–P10 are ruled

C1 says "CUT means the code goes, deleted, with the tests that pinned it." A prompt component
has no code and no tests, so the mapping is stated **now, before any prompt component is
ruled**, rather than invented while ruling. This is an extension of the vocabulary to a kind
of component C1 did not anticipate, made before the outcomes are known.

- **KEEP** — the instruction block stays as written.
- **CUT** — the block is **deleted from the file, in every mirror that carries it, in one
  commit**: repo, user scope, and `project-template/`. A block deleted from one mirror and
  left in another is a CUT wearing a KEEP's label, and `command-parity` would fail besides.
  No commenting-out, no "disabled" note left in place — the same "not a flag, not dormant"
  clause C1 applies to code. The analogue of "the tests that pinned it" is any `/sync` check
  or fixture asserting the block's presence; those go in the same commit.
- **SUSPENDED-WITH-A-NAMED-TRIGGER** — **the block is still deleted**, and the reviving
  observation is recorded in the loop write-up and the decisions log rather than left in the
  file. **A prompt instruction cannot be suspended in place.** A flag can gate code
  deterministically; an instruction an agent can still read is an instruction that can still
  fire, which is Aaron's deterministic-first rule exactly: remove the trigger rather than
  patch around it. **Suspension of a prompt component differs from CUT only in whether a
  reviving observation was nameable, never in what happens to the file.**

Running error count: **23 Planner, 16 Developer.**
