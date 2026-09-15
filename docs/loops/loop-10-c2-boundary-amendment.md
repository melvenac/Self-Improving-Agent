---
title: "Loop 10 C2 — boundary amendment, before the first verdict"
status: amendment-before-ruling
loop: 10
author: Forge (Developer)
date: 2026-09-15
amends: docs/loops/loop-10-c2-enumeration.md (0622028)
criterion: docs/loops/loop-10-c1-criterion.md (8eaff69) — UNTOUCHED
---

# Boundary amendment

The Planner's correction is accepted: **the hook that fires a stage does not determine which
half it belongs to.** Classing by hook would have hidden memory machinery behind a protocol
label, in the one loop that will ever audit it. C1 is not amended — this amends the C2
boundary only, and it is committed before the first verdict so the ordering stays auditable.

**The test, applied per stage:** would this stage exist if the memory layer were removed
entirely? If no, it is memory half regardless of which hook fires it.

## E11–E16, per stage, with the line that decides it

| Stage | Memory deps | Exists without the memory layer? | Half |
|---|---|---|---|
| E11 state-reader | `fs`, `state-schema` only — state-reader.ts:1-5 | Yes — reads `state.json`, SUMMARY, INBOX | Protocol |
| E11 state-render | `state-schema` only — state-render.ts:1-2 | Yes | Protocol |
| E12 drift-detector | none — drift-detector.ts:1 | Yes | Protocol |
| E13 session-log | `fs`, `path` only — session-log.ts:1-2 | Yes | Protocol |
| E14 session-discovery | `fs`, `path` only — session-discovery.ts:1-2 | Yes — the uuid also serves as the memory join key, but the session log needs it regardless | Protocol |
| E15 agent-identity | `fs`, `path` only — agent-identity.ts:1-2 | Yes | Protocol |
| E16 health-checks | **`obsidianVaultDir` :4, `SKILL_SCAN_ENABLED` :5** | **Partly no** | **Split** |

**E16 is the only stage the test moves, and it moves partly.** Two of its checks exist only
because the memory layer does: the vault-git-freshness warning (health-checks.ts:26-40,
`obsidianVaultDir`) and the skill-scan pending report (health-checks.ts:5, gated on
`SKILL_SCAN_ENABLED`). Those two are **memory half and in scope**. The remainder of the
stage is protocol. E16 is therefore ruled on its memory-half checks only, and the split is
stated here rather than discovered while ruling.

## The finding the Planner's test actually produced — and it is not E11–E16

The Planner's reason for pushing was that the garbage query
`"session start home directory no project state"` was invented by "the SessionStart caller,"
placed out of scope by my boundary. **The test locates that caller, and it is not any of
E11–E16, nor E17.**

**No session-start code calls recall at all.** `grep -rn "ob_recall\|recall"` over
`pipelines/session-start/` returns two hits, neither a call:
`types.ts:100` (a field declaration) and **`index.ts:40`, which returns
`recalledEntryIds: []` — hardcoded empty.**

The recall is performed by the **agent following `.claude/commands/start.md`**, which
instructs it to choose Q1/Q2 itself (start.md:61, :63, :64 for the project path; :139, :141,
:142 for the lightweight path). **The component that invents the query is a prompt artifact,
not code.**

### E28 — the `/start` recall instruction block. Memory half, in scope.

**Neither enumeration contained it.** The Planner's list was built from memory of the
project; **mine was built from source, and I enumerated only TypeScript.** That is the same
defect rule 4 exists to catch, committed in my own enumeration one document after I cited
the rule. The dual enumeration did not catch it because **both enumerations shared the
assumption that a component is code.** The Planner's per-stage test is what surfaced it, by
forcing the question of who the caller is.

**Recorded as Developer error 16.** A source enumeration that silently scopes itself to one
language, in a project whose behaviour is substantially carried by markdown instructions to
an agent, is an enumeration that misses the writer exactly as rule 4 warns.

Two consequences carried to the rulings:

- The Planner's concern was correct in substance and wrong in target: **the query-invention
  failure cannot be attributed to E17**, but the component that owns it is E28, not a
  protocol-half stage. Nothing escapes by exemption.
- **`index.ts:40` returning a hardcoded empty `recalledEntryIds`** means `ob_start` never
  reports what was recalled; the `/end` rating path depends on `recall_log` instead. Recorded
  here, ruled at E4/E5.

## `cli.ts:202` reachability — determined

Rule 5's mirror, as the Planner put it: a no-op is not harmless until someone shows the path
is unreachable.

**Determination: unreachable from any hook; reachable by invocation.**

- `~/.claude/settings.json` wires exactly one SessionEnd hook:
  `node "…/open-brain/build/cli-session-end.js"`. There is no CLI entry on any hook.
- `cli-session-end.ts` does not import `cli.ts`; it calls `sessionEndV2` directly
  (cli-session-end.ts:15, :87).
- Repo-wide grep for `cli.js end` / `open-brain end` finds **no live invocation** — only
  archived session prose and the INBOX item below.
- **But `open-brain` is a published bin and `end` is a live subcommand**, so a human or
  script can reach it. Dead by convention, alive by invocation.

**This was already known and is already recorded.** `.agents/TASKS/INBOX.md:48` — **T-100**,
filed Session 53 — states it precisely, and adds that the same path pulls `auto-feedback.ts`,
whose own `evaluateLifecycle` hardcodes 0.3 / 5 / 3 / 7 / 0.5 independent of
`LIFECYCLE_CONFIG` and writes capitalised maturity strings that the `knowledge_index.maturity`
CHECK constraint rejects. The no-op inserter is a third defect on the same path.

### It does not explain tonight's capture loss, and that matters

Session `2e9a436d` has **no `sessions` row and zero chunks**. Since nothing automated reaches
`cli.ts:202`, **the stubbed inserter did not cause it.** The cause stands where the earlier
determination put it: `ob_set_session` never ran, so the session never registered. **The
Planner's hypothesis is disconfirmed**, and recording that is the point — a plausible
mechanism that did not fire is exactly what rule 5 is about, in both directions.

## Amended boundary

- **Memory half (ruled this loop):** E1–E10, E16 (its vault-freshness and skill-scan checks
  only), E17, E18, E19, E23, E24, E26, E27, **E28**, plus B8 and B10.
- **Protocol half (enumerated, not ruled):** E11–E15, E16 (remainder), E20, E21, E22, E25.

## The constraint this places on C3, accepted as binding

Only one half is subjected to the criterion. Therefore **C3 may state the memory half's
verdicts as verdicts, and may not state that the protocol half earned its keep** — the
protocol half was never tested against C1, and "audited and found wanting" against
"not audited" is not a comparison. If the evidence still points at the protocol half having
carried the project, C3 says so **in those words and names that it rests on observation
rather than on the criterion.**

Running error count: **23 Planner, 16 Developer.**
