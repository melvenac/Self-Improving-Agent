# T-169: rewrite PRD.md and README.md against what ships (the slice-three close-out, D-033 and D-070)

**By:** Atlas (planner), record session 153, 2026-09-30. **For:** a developer seat. This is a docs and config change
with no product code, so it runs as a headless Claude Code Sonnet job on the QA PC (D-068). **Merge:** docs and
record changes may merge on the planner's word (D-032), but this one rewrites the project's statement of purpose, so
**Aaron reads it before it merges.**

## Why

- Aaron, session 78: "the agent started work and asked what the project was for halfway through the loop."
- At v0.44.x, PRD.md and README.md still describe what Loop 10 cut:
  - the maturity lifecycle and boosts;
  - the reflection cycle;
  - skill distillation and skill-scan;
  - the Node 22 pin for Smart Connections.
- Meanwhile they barely describe what did ship: the HoH loop runtime and its gates, the shadow merge gate, state.json
  through `ob_state`, the seats and A2A, and the recall trigger.
- The agreement was to rewrite once, when slice three made the HoH roles real. Slice three closed on 2026-09-30.

## Read first (intent sources)

1. **The Step-Back artifact:** https://claude.ai/artifact/3Kv8BuKYrj5vaKQgD8NKC7. A headless job cannot open it,
   so the planner read it (version 1789649824-11da, Parts 1 to 5, through Loop 11) and summarises it below. **Treat the
   summary as the intent source.** Do NOT use the vault copy, which stops at Part 3.

   **The Step-Back, summarised by the planner, session 153:**
   - **The problem statement (PRD.md:21) has four claims**, each with a verdict:
     - "Sessions start cold": **SOLVED**, and the proven asset. `.agents/`, `/start` and `/end`, the handoff, and
       state.json with rendered views (Loops 2 to 4; 677 words against 24,887).
     - "Skills die in one project": **REFUTED as built.** skill-scan clustered on tags, not actions, so it was cut
       in Loop 10.
     - "Lessons forgotten": **split.** Session-start retrieval RANKING earns its keep (p=0.035). The INJECTION does
       not (p=0.688 matched on topic). The upper bound: CLAUDE.md, delivered at 100% for weeks, still failed to change
       behaviour.
     - "Repeats discovery" (rate, mature, prune): **NO.** The harm signal never existed; `harmful` was unreachable
       in code.
   - **CUT in Loop 10:** the maturity lifecycle, apoptosis, `success_rate`, the reflection queue and `/skill-scan`.
     Their code was deleted, not left dormant.
   - **What the project learned that is not about memory** (keep these; they are the real product lessons):
     - the deterministic-first invariants (a filter that drops rows emits the dropped count; where one fact has
       several representations, something checks they agree);
     - `/sync` as a gate that catches classes of defect;
     - build the thing that can disagree with you, and prefer a second measurement to a better first one;
     - a deletion is not finished until nothing names the deleted thing (Loop 12).
   - **The seam:** planner, developer and read-only QA, on frozen SHAs. It is the project's best result, and most of
     its substantive catches came from the counterpart agent.
   - **Audience (Q1, answered 2026-09-14): both** Aaron's own machines and other developers. The test is "fresh
     machine, one command, `/start` works". Core needs only Node and git; Obsidian is a viewer, never a prerequisite.
   - **The repository was made private** in Loop 11, and its instruction surface is now tracked.
   - **Still open:** idea B, splitting the core protocol from the memory module. It has been displaced every time
     because it needs no measurement. Name it as open in the PRD; do not claim it is done.
   - **Since the Step-Back (Loops 12 to 16 and Loop 15 slices 1 to 3):** the HoH loop runtime (`open-brain/src/harness/`)
     with the plan gate, the done gate and the shadow merge gate; D-019 (Aaron merges to master until the
     disagreement count says otherwise); the recall trigger (Loop 16); the A2A seats. Read these from the code and the
     record.
2. The current `.agents/SYSTEM/PRD.md` and `README.md`, including the PRD's interim stale note at `:25-29`.
3. T-169's full note in `.agents/state.json` `tasks[]`, plus decisions D-019, D-033, D-036, D-070 and D-071.
4. What actually ships. Read the code and the docs, not the old prose:
   - `open-brain/src/` (the 14 MCP tools listed in CLAUDE.md, `harness/`, `trigger/`, and `pipelines/`);
   - `docs/HOH-JEV.md`;
   - `CHANGELOG.md`;
   - `.agents/retirements.json`.

## Required changes

1. **PRD.md, rewritten.**
   - Keep a problem statement.
   - Describe the product that ships, with an explicit "Not in this product" list for what was retired.
   - Add a **success-metric** section; the PRD has none today. The measurable target in the record is D-019's exit
     criterion (the shadow-gate disagreement count reaching zero across loops with real defects). Add any others the
     code actually measures.
   - Delete the interim stale note.
2. **README.md, rewritten to match.**
   - Setup must work for a new adopter.
   - **State, per D-070, that the HoH gates call TypeSafe's Jev API, that each project adopting SIA needs its OWN
     `TYPESAFE_API_KEY`, set in its local environment and never committed, and that SIA ships no key.**
   - Remove every retired feature.
3. **`.agents/retirements.json`:**
   - remove `.agents/SYSTEM/PRD.md` from the `historical` list, so the retirements check can see the PRD again;
   - ADD the maturity lifecycle (maturity boosts; Progenitor, Proven and Mature; `success_rate`; apoptosis) as
     retired in Loop 10, if no entry names it.
4. **`.agents/SYSTEM/ENTITIES.md`:** fix what the retirements check flags ("dream", R-003; "reflection queue", R-004).
   This is the same scope layer.
5. **Global instructions:** the user's `~/.claude/CLAUDE.md` also describes the maturity lifecycle. That is OUTSIDE
   this repo. Do not edit it; list it in the handoff for the planner.

## Verification

- Run the retirements check. It must report no issue on PRD.md, README.md or ENTITIES.md. Quote the command and its
  output.
- Run `/sync --check`, or the CLI equivalent `node open-brain/build/cli.js sync --check` after `npm run build`. Quote
  its result.
- Run no CI (D-061).
- **Grep** the rewritten files for each retired term: maturity, Progenitor, apoptosis, reflection, skill-scan, dream,
  Smart Connections. Justify every hit that remains.
- **A test pins live record data** (T-205): if any test reads PRD.md, README.md, retirements.json or ENTITIES.md
  from the working tree, run it and quote the result.

## Handoff

`docs/loops/t169-developer-handoff.md`. For each file, give:
- what changed;
- where each new claim comes from (a code path or a record id);
- the verification output.

Push only `docs/t169-prd-readme`, never forced, and do not open a PR; the planner opens it.
