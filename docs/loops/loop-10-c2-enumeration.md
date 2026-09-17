---
title: "Loop 10 C2 — the component set, enumerated twice"
status: enumeration-before-ruling
loop: 10
author: Forge (Developer)
date: 2026-09-15
criterion: docs/loops/loop-10-c1-criterion.md (pinned at 8eaff69)
---

# C2 — Enumeration, before any component is ruled on

Per C1's pinned method: two independent enumerations, then what is in both, what is in
each alone, and why each exception is allowed. **No verdicts in this document.**

## Enumeration 1 — derived from source and wiring

Wiring evidence is cited as file:line. Hooks resolved from `~/.claude/settings.json`:
`SessionStart` to `open-brain/build/cli-bootstrap.js`, `SessionEnd` to
`open-brain\build\cli-session-end.js`. 61 TypeScript files under `open-brain/src`.

### Live on the SessionEnd hook (`cli-session-end.ts:15` calls `sessionEndV2`)

| # | Component | Wiring |
|---|---|---|
| E1 | Vault capture | `writeSummary` — index-v2:112; `vault-writer.ts` |
| E2 | Session summary | `getSessionSummary` — index-v2:101 |
| E3 | Maturity lifecycle + counters | `captureLifecycleSnapshot` — index-v2:130; `lifecycle.ts` |
| E4 | Ratings path + `feedback_log` | `updateFeedbackV2` :166, `recordFeedbackEvent` :172 |
| E5 | Recalled-ids gate | `recalled-ids.ts`, cli-session-end.ts:16 |
| E6 | Reflection queue | `flagReflectionClusters` — index-v2:182 |
| E7 | Invocation logger | `logInvocations` — index-v2:187 |
| E8 | Skill scan + proposal machinery | `runSkillScanPipeline` — index-v2:196 |
| E9 | Shadow-recall harness | `runShadowStage` — index-v2:213 |
| E10 | Topics pipeline | `planTopics`/`writeTopics` :229, `findOrphans` :233 |

### Live on the SessionStart hook (`cli-bootstrap.ts` into `pipelines/session-start`)

| # | Component | Wiring |
|---|---|---|
| E11 | State reader + render | `state-reader.ts`, `state-render.ts` |
| E12 | Drift detector | `drift-detector.ts` |
| E13 | Session log creation | `session-log.ts` |
| E14 | Session discovery | `session-discovery.ts` |
| E15 | Agent identity | `agent-identity.ts` |
| E16 | Health checks | `health-checks.ts` |

### Live through the MCP server only

| # | Component | Wiring |
|---|---|---|
| E17 | Session-start retrieval — `ob_recall`, `recall_log`, `recallRankExpr` | server.ts:640; lifecycle.ts:311 |
| E18 | Apoptosis gate | `apoptosisFlaggedExpr` lifecycle.ts:224, `apoptosisGateExpr` :239, `formatApoptosisQueue` :278 |
| E19 | Store path + content guard | `pipelines/store/`, `shared/content-guard.ts` |
| E20 | State writer + state views | `shared/state-writer.ts`, `pipelines/state-views/` |
| E21 | `ob_sync` checks | `pipelines/sync/checks.ts`, `checks-state.ts` |
| E22 | Protocol score | `pipelines/sync/score.ts`, `scorer.ts`, `history.ts` |
| E23 | Chunk store | `ob_store_chunk` into db-v2.ts:694 |

### Reachable only from the CLI, on no hook

| # | Component | Wiring |
|---|---|---|
| E24 | Dream pipeline | `cli dream` into `pipelines/dream/` (1,229 lines) |
| E25 | Relocate | `cli relocate` into `relocate.ts` |
| E26 | v1 session-end pipeline | `cli end` into `session-end/index.ts`, `chunk-indexer.ts`, `auto-feedback.ts`, `frontmatter-sync.ts`, `skill-scan.ts` |
| E27 | Score-entries migration | `migration/score-entries.ts` |

## Enumeration 2 — the brief's minimum list

B1 session-start retrieval · B2 maturity lifecycle and its counters · B3 apoptosis ·
B4 skill scan and its proposal machinery · B5 shadow-recall harness · B6 the ratings path
and `feedback_log` · B7 vault capture · B8 Smart Connections · B9 dream pipeline ·
B10 the `.recalled-entries.json` remnant, if any survives.

## Rule 4 — both sets, each difference, every exception justified

### In both enumerations (8)

B1=E17, B2=E3, B3=E18, B4=E8, B5=E9, B6=E4, B7=E1, B9=E24.

### In the brief alone, absent from source (2)

**B8 — Smart Connections.** `grep -rln -i "smart.connections"` over the working tree,
excluding `node_modules`, `.git` and `build`, returns **only archived prose** — session
logs and decision records under `.agents/archive/pre-state-migration-2026-09-14/`. **There
is no Smart Connections code in this repository.** It is an external Obsidian plugin, so it
is an integration dependency rather than a component of this codebase. Exception allowed,
and it changes what can be ruled: C1's unobservable clause applies with full force, since
the server is also down this session (`CONNECTION_CLOSED`, reconnect attempted and failed).

**B10 — the `.recalled-entries.json` remnant.** The brief asked "if any survives."
**It does not.** Every hit is archived session prose; there is no live code reference
anywhere in `open-brain/src`, `scripts/`, `project-template/` or `.claude/`. The Loop 5
removal is complete and verified. Exception allowed: the brief anticipated this answer.

### In source alone, absent from the brief (19)

E2, E5, E6, E7, E10, E11–E16, E19–E23, E25, E26, E27.

**Why allowed:** the brief said "**at minimum**, rule on," so additions are expected — and
rule 4 exists precisely because a list built from memory of what a project contains is the
enumeration that misses the writer. It did: **the brief's ten-item list omits nineteen
components, ten of which run on a live hook every session** (E2, E5, E6, E7, E10, E11–E16).
This is not a criticism of the brief; it is the dual enumeration doing the job it was
specified for, and it is itself evidence for C3.

## The boundary this loop rules across, stated before ruling

C3 compares "the memory half" against "the protocol half," so the split must be declared
before any verdict, not chosen per component.

- **Memory half** — anything that stores, retrieves, rates, or derives from the knowledge
  corpus: **E1–E10, E17, E18, E19, E23, E24, E26, E27**, plus B8 and B10.
- **Protocol half** — session lifecycle and the state record: **E11–E16, E20, E21, E22, E25.**

**This loop rules on the memory half.** The protocol half is enumerated here so the set is
complete and so C3's comparison has a named denominator, but it is not up for a verdict in a
loop whose subject is the memory layer. Every component in the brief's list falls on the
memory side, so the split does not narrow what was asked for.

## Three source-resident admissions found during enumeration, recorded not ruled

Carried forward to the rulings; each is a claim the source already makes about itself.

1. **`db-v2.ts:802`** — a comment stating **"which is why apoptosis has never fired."**
2. **`lifecycle.ts:20`** — Loop 8 R1's switch-off, with restore values recorded
   (`matureBoost 1.5, provenBoost 1.2, apoptosisEnabled true`) but **no observation named
   that would justify restoring them**.
3. **`cli.ts:202`** — the v1 `cli end` path passes **`insertChunk: () => {}`**, a no-op, to
   a pipeline (E26) whose first stage exists to index chunks.

## What was read to build this

`find` over `open-brain/src` (61 files, line counts); `server.ts` tool registrations (14,
matching the documented surface); `cli.ts` command dispatch (`dream`, `end`, `relocate`,
`start`, `state`, `sync`, `topics`); `cli-session-end.ts:11-19,87`;
`session-end/index-v2.ts:1-30` imports and its stage call sites; `session-end/index.ts:1-40`;
importer-graph for every `pipelines/*` directory; `lifecycle.ts` export list;
`shared/skill-scan-flag.ts` in full; `~/.claude/settings.json` hook wiring; repo-wide greps
for `recalled-entries`, `smart.connections`, apoptosis and chunk-insert call sites.

**No component has been ruled on. No recall-log figure supplied by the Planner has been
checked** — those are re-derived cold when the rulings reach E17.
