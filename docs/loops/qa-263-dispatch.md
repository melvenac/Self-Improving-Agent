# QA 263: the T-233 batch, a deterministic /start greeting (#343, #344, #345, #346)

**By:** Atlas (planner), 2026-10-02, record session 158. **Runner:** Plumb, booked by clark.

**Criteria:** `docs/loops/start-greeting-deterministic-brief.md`, its **Acceptance** section and
**Amendments 1 and 2**. Where they disagree, Amendment 2 governs scope. Also read the developer's
handoff, `docs/loops/t233-developer-handoff.md`.

**Merge authority:** an ACCEPT waits for Aaron's word naming each PR. Usage: this QA runs under Aaron's
weekly override for T-233 (`weeklyOverride: "T-233"`).

**Job class: LIGHT.** Run touched test files only, **one test file per vitest invocation**, plus
`tsc --noEmit`. `gh` is read-only. No full suite. **Make no live Jev call.**

## Pinned heads

The stack is linear: D → A → B. C is independent.

| PR | part | head | base |
|---|---|---|---|
| #343 | C, the brief glob | `d010692cd478e741f3111767f30a2faadb5815a2` | master |
| #344 | D, standing cron removed (D-113) | `8a8270922dfc6b61ab0179346bbdbbaba0016449` | master |
| #345 | A, serving-build line (T-172 guard) | `d20d4925226f8b5238df7f8ffab7e9181ffab6f9` | #344 |
| #346 | B, briefing in code (items 1, 4, 6) | `724e31fe64a6c5f0b1f915a214a37f3f6f95da05` | #345 |

**DISPATCH_SHA** is the scratch merge of origin/master + #343 + #346. It contains this file, the push
helper, the brief and all nine mutants.

## Rows

1. **Briefing is code, verbatim.**
   - handleStart's `## Briefing … ## End Briefing` block is byte-identical to `renderBriefing`'s output
     for the same record.
   - The block's FIRST line is the serving-build line, and equals ob_start's first line: stale, level,
     and not checked.
   - Every start.md copy (project, template, cursor) says to print the block verbatim, then FLAGS, with
     no model assembly.
2. **Serving build (A).**
   - The distance is the BUILD commit (build-info.json) vs origin/master in the serving tree, not that
     tree's HEAD.
   - Every unreadable shape prints `Serving build: not checked (<why>)`, never nothing.
   - `serving_build_dir` is NOT reachable through the MCP tool's zod schema. Prove it with a call that
     passes it.
3. **Usage (item 4), against the REAL slots.json SHAPE.**
   - The real shape is an object: `level` one word, or free text with a leading word; numeric
     `fiveHourPct`, `sevenDayPct`, ISO `fiveHourResetsAt`, `weeklyOverride`.
   - Bands: weekly <95 adds nothing; 95-97 holds, naming `weeklyOverride` when set; >=98 winds down,
     even with an override.
   - Absent, unreadable, malformed and unknown-word inputs are `not checked (<why>)` (D-104/D-106).
   - The bare-string form still works.
   - The path comes from `usage_file:` seat data or `SIA_USAGE_FILE`, never hard-coded.
4. **resolved_by (item 6).**
   - An open question is a string or `{text, resolved_by?}`, and ob_state accepts both.
   - Resolved questions are omitted from the greeting and the block, with `N resolved, not shown`.
   - The rendered views keep them, marked.
5. **Brief glob (C).** `/(^|-)(re)?brief(-amendment-\d+)?\.md$/`.
   - Every brief shape on master is kept.
   - Drafts, handoffs and responses are excluded.
   - `loop-15-slice-3-a2-grok-brief-2.md` being excluded is ACCEPTED by the planner. Do not report it as
     a finding.
6. **No standing cron (D).** No `Standing cron:` line, no start.md step 5b, no template AGENT.md cron
   section, no cursor waiver. A seat whose data still carries `status_cron` is read by nothing, and
   does not crash.
7. **Relay shares the renderer.** Relay's /start path gets the block from the same function. Prove it
   by test or by call trace, not by reading.
8. **Mutants.**
   - Run all nine under `docs/loops/t233/mutants/`, each against its touched test file, one invocation
     each.
   - Run one mutant of your own on each of A, B and C.
9. **Red then green.** The new rows fail on origin/master `5cd9ed52`'s code and pass on the heads.
10. **Stack integrity.**
    - `git range-diff` cd9e0f05 → d20d4925 (#345 rebased onto D) and d8afa9f2 → 724e31fe (#346 rebased
      onto A).
    - Every change must be rebase context, the server.ts import union, or the serving-line integration.
      Name anything else.
11. **CI (read only).** `gh pr checks` on 343, 344, 345 and 346.
12. **Merge order.**
    - On a scratch branch from origin/master, merge C, D, A, B in that order.
    - There should be no conflicts. Say if there are any.
    - Run each touched test file, one per invocation, and `tsc --noEmit`.

## Rules (headless Claude Code)

- **Identity:** you are **QA 263**, and your prefix is `t233`.
- **Pushing:** push ONLY `qa/t233-*` branches, and only through `node docs/loops/qa-263/push-qa.mjs
  <branch>`, run from your QA worktree. The planner tested all five of the helper's refusals before
  dispatch.
- **PRs and issues:** never create, comment on or edit an issue or a PR. Use `gh` only to read.
- **Real config files, including slots.json:** read-only. Report shapes, counts, names and paths only.
  **Copy no values** (G-051). Scan for key and token patterns before every commit.
- **Report:** commit `docs/loops/t233-qa-report.md` and its `.E_t.json` on `qa/t233-report`.
- **Verdicts:** one verdict line per PR, then a batch verdict. The last line is exactly
  `QA-263: REPORT COMPLETE`.
