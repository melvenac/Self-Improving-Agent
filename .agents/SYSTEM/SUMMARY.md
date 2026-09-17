# Project Summary

<!-- state:begin -->
<!-- generated from .agents/state.json rev 31 by open-brain v0.38.0 — do not edit; change state via ob_state -->
> **Status:** v0.38.0 — Loop 13 - Idea B, the module boundary, alone. Make the core installable with Node and git, with memory as an opt-in module. It needs no measurement, which is exactly why it has lost four times to subjects that had one; the displacing sentence is 'it fits cleanly with what we are already touching'. The question it is the instrument for has been open since Loop 9 and is not 'does injection change behaviour' - Loop 10 answered that - but DOES THE MEMORY HALF GET USED AT ALL. Three consecutive loops have now ended with ob_recalled reporting nothing recalled.

## What's working

- ob_start is the single startup implementation and returns state, drift, session and sizes _(V-001, 2 evidence)_
- state.json read side: strict schema, three-way reader, ob_start render, state-schema sync check _(V-002, 2 evidence)_
- state writer: revision check, atomic batch, retention, four views, ob_state _(V-003, 2 evidence)_
- /sync resolves the project root or refuses; identical from root and open-brain/ _(V-004, 2 evidence)_
- relocate existence check is case-insensitive; CI green on ubuntu _(V-005, 2 evidence)_
- reopen_task moves done → open with closed_session null and the note appended; TaskSchema refuses closed_session that disagrees with status in both directions _(V-006, 3 evidence)_
- summary-version with state.json present re-renders stale views through the shared renderers (applyStateOps with an empty batch: revision unchanged, no retention, state.json untouched) and never inserts prose; the prose regime runs only when state.json is absent _(V-007, 2 evidence)_
- ci-status, state-views and merge-markers sync checks pass / warn / skip with the reason, and ci-status + merge-markers print their number whatever the severity (REPORTED block in sync CLI and ob_sync) _(V-008, 2 evidence)_
- open-brain state import: --draft writes a schema-valid draft + report and nothing else; --commit snapshots .agents/ byte-complete before any change, writes state.json at revision 0, cuts SUMMARY's blockquote and Current State leaving the prose sections byte-identical, renders the four views, moves the draft into the snapshot, and refuses a second run _(V-009, 2 evidence)_
- /end writes state through ob_state when state.json exists (A7b), and the first real write on this repo went through the MCP tool at revision 0 _(V-010, 2 evidence)_
- The rendered Done list and the state record agree on which done tasks exist, at the same session, including on /sync's render-only path _(V-011, 1 evidence)_
- state.json can be read without the MCP server, through a door that writes nothing _(V-012, 1 evidence)_
- A session that resolves no recalled ids reports why, instead of being indistinguishable from a session with nothing to rate _(V-013, 1 evidence)_
- The interim ranking cut was tested rather than applied, and refused on evidence; LIFECYCLE_CONFIG is unchanged _(V-014, 1 evidence)_
- The shadow replay is evaluated as of the session it replays: lifecycle state is snapshotted pre-feedback, the candidate pool excludes entries created after the session, and the recency clock is anchored to the session's earliest recall. Production ranking is byte-identical. _(V-015, 3 evidence)_
- Stage 6 no longer ranks against maturity values Stage 2 wrote in the same session; the snapshot is captured over recalledEntryIds before the auto-feedback loop runs, and the stage order is preserved rather than reversed. _(V-016, 2 evidence)_
- update_gap amends a gap in place, preserving its id and opened_session, and refuses both an unknown id and an amendment that changes nothing. _(V-017, 1 evidence)_
- The unattended SessionEnd rating arm has never written a rating: the `heuristic` arm produced zero rows across the entire life of the `rating_method` column, because cli-session-end.ts read an environment variable the host does not set. _(V-018, 3 evidence)_
- The heuristic rating arm is gated off by default and skips an unjudged entry entirely, writing neither an aggregate counter nor an event row. _(V-019, 2 evidence)_
- T-003's write path already refuses the failure it describes: a slot is consulted only when the in-memory session id is absent, and is refused when older than 12h. _(V-020, 2 evidence)_
- The skill-proposal generator is off at both ends behind one constant, and no stale count is announced from the pending file that is left on disk. _(V-021, 2 evidence)_
- project.version is gone from every state.json in the tree and a file still carrying it fails parse, so a missed copy is loud rather than silent. _(V-022, 2 evidence)_
- No recency-decay variant beats the live 0.005 constant at better than chance on the repaired harness. _(V-023, 1 evidence)_
- Whether recalled knowledge changed what an agent did is not answerable on the existing record; the apparent signal is retrieval's own selection criterion. _(V-024, 1 evidence)_
- ob_start's State block replaces the four prose files rather than accompanying them, and renders task titles only: the payload fell from 7,971 to 2,142 words on the same rev-14 state, and the briefing was completable without opening task.md. _(V-025, 3 evidence)_
- A fresh Windows clone of this repo passes the full suite; the CRLF checkout failure is fixed at the checkout layer rather than by loosening the assertion _(V-026, 3 evidence)_
- command-tool-names compares commands to the server's tool registry rather than to the other mirrors, fails on both an unregistered ob_* name and a retired kb_* name, and skips rather than passing when server.ts is absent _(V-027, 3 evidence)_
- V-026's claim is now literal rather than a proxy: a real `git clone` of master, with its own node_modules, installs and passes 588/588 on Windows _(V-028, 3 evidence)_
- command-names resolves a /name reference against the command files that exist, and was seen red on two real defects before it was trusted _(V-029, 3 evidence)_
- The retirements check reads .agents/retirements.json on every /sync and fails on an empty record rather than passing vacuously _(V-030, 3 evidence)_
- The build prunes: a stale artifact whose source was deleted cannot survive a rebuild _(V-031, 2 evidence)_
- The heuristic rating arm never wrote a row in the entire life of the rating_method column _(V-032, 1 evidence)_
- On the mailbox retirement the frozen pipeline found every in-repo referrer with no false positives, and its entire blind spot was one nameable structural boundary _(V-033, 2 evidence)_
- PR #33's fix is correct and was QA'd independently rather than relayed: the retirements check passes in all three worktrees, including the main tree where it fired 115 findings, and the new regression test was seen red on the real defect _(V-034, 3 evidence)_

## What's broken

- Gap G-001: Cursor start.md/end.md copies are not on ob_start/ob_state
- Gap G-002: The repo's .claude/ is gitignored; mirror policy for slash commands is undecided
- Gap G-003: SESSION_TEMPLATE.md's pre-session checklist is still pre-state.json: it tells the session to read SUMMARY.md, INBOX.md and ENTITIES.md by hand. As of session 62 that does not merely duplicate ob_start's work — it instructs the thing RULES.md agent-rule 1 now forbids, since with a valid state.json the ## State render REPLACES those four files. SESSION_TEMPLATE.md was inside Loop 11's audit set and was deliberately NOT repaired, to hold scope after the loop's subject was complete; recorded here rather than left as an intention. One-line fix.
- Gap G-004: vault-index-parity warns on one unindexed Checkpoints note
- Gap G-005: DECISIONS.md is both the prose ADR log and the decisions[] index
- Gap G-007: `open-brain state import --commit` is denied by the auto-mode permission classifier inside an agent session ("Irreversible Local Destruction"); the one-shot migration must be run by the human
- Gap G-008: ob_start's prose baseline (24,888 words) vs the rev-0 render (7,360 words) was measured on a temp copy, not the live repo, because handleStart creates a session log per call
- Gap G-009: R4 is Claude-only: project-template/.cursor/commands/start.md still instructs writing .recalled-entries.json, so for a Cursor user the file still accumulates across sessions
- Gap G-010: The op vocabulary cannot subsequently change some of what it records, and closing destroys rather than marks. Three parts, as of session 61. (1) SHARPEST: close_gap splices the entry out of the array — state-writer.ts:292, s.gaps.splice(idx, 1) — with no closed_session, no status and no tombstone, so closing a gap destroys its text, evidence and reasoning in the same motion. G-018's evidence, including the 'Progenitor' vs lowercase 'progenitor' case mismatch across 519/25/14 rows, left the record this way at rev 16 and survives only at 6af5592. (2) STILL TRUE: decisions are add-only, and verified has add_verified and reopen_verified but no amend. The 13-op vocabulary contains no update_decision and no update_verified. (3) RESOLVED, recorded rather than deleted: 'project.version has no op at all' is moot — Loop 8 R3 / ADR-027 removed the field (state-schema.ts:44-50; state.json's project now carries name only), as V-022 records. 'gaps have add and close but no update' is false — update_gap exists at state-writer.ts:59, :273, :282, as V-017 records. This amendment is itself made with update_gap, which is the clause it retires.
- Gap G-011: The shadow-recall harness cannot currently answer any question about the maturity constants, in backfill OR in production
- Gap G-013: feedback_log holds only 31% of the non-neutral ratings the live counters know about (154 of 496), so any replay reconstructing maturity from it systematically under-promotes and cannot answer questions about maturity boosts.
- Gap G-014: success_rate excludes neutral ratings from its denominator and harmful is structurally near-unreachable, so success_rate is 1.00 for any entry ever rated helpful once. Maturity promotion therefore tracks recall volume rather than usefulness, and promotion grants a ranking boost that causes more recall.
- Gap G-015: One session uuid is written under two different project keys in active-session.json, corrupting project-scoped attribution.
- Gap G-016: Intermittent cross-test failure in state-writer.test.ts under the full suite.
- Gap G-017: 86% of ACTION: lines give prose advice rather than naming a file, which is why Loop 9's F1 fired at 14.2%. That is a fact about how the /end A12 template gets filled in, not about recall or retrieval.
- Gap G-019: The correction record's Loops 5-7 row is carried forward from the running count rather than re-derived, so unlike every other row it cannot be audited from its own list.
- Gap G-020: A session-log checklist ticked before the action it describes cannot fail, and misled the Planner into reporting that /end had never run.
- Gap G-021: R1's staleness signal is under-specified: a stale MCP server and a current one produce identical totals
- Gap G-022: The error-count table and the ordinal numbering disagree by 2 Planner and 1 Developer, at the Loops 5-7 boundary
- Gap G-023: PR #2 has been open and review-ready for three weeks against a head that no longer exists on origin
- Gap G-024: Done-task retention evicts entries from state.json permanently during a bulk close, while reporting it only in passing. Closing 13 tasks in session 61 dropped T-032 and T-052 out of the record entirely — nobody asked for those two to go, and it surfaced only because the tool output was read carefully. The count scales with the size of the close, so a large sweep evicts proportionally more, equally quietly.
- Gap G-026: Recall has no minimum relevance and almost no project scoping, so it fills its result limit with whatever is left once the relevant set runs out - and no metric the project has can see it happening. Deferred twice already, from Loop 11 and Loop 12, because it only ever lived in conversation.
- Gap G-027: expected_revision serialises writes within one lineage, not across branches. Two seats can read the same base revision, derive the same successor, and both be accepted - the collision is invisible at the data layer and surfaces only as a git conflict at merge time, a different and much later layer. The revision counter does less work than its name implies.
- Gap G-028: The stated reason for PR #33 - that the 115 findings were 'almost all files under .gitnexus/' - is false, and it is the sentence that made the trade-off look free. Measured: .gitnexus/ accounts for 19 of the 115 findings (16.5%) across 5 files. The other 96 come from real untracked documents: docs/superpowers/plans and specs, docs/dream-design.md, docs/mailbox-transport-retirement-spec.md, .agents/SYSTEM/ENTITIES.md and .agents/TASKS/research-wiki-audit.md. The fix is still right - untracked files do not ship, and re-deriving .gitignore by hand is the defect the check exists to find - but it suppresses 43 files naming a retired thing, not 5.
- Gap G-029: The regression test added by PR #33 can pass without testing anything. It runs `git init && git add && git commit` inside try/catch with stdio ignored, and on any failure does a bare `return` before reaching its assertion - so a machine without git, or with a git that fails for any reason, reports the test green. It is the rule 11 family - an instrument that cannot distinguish 'nothing there' from 'I did not look' - inside the regression test for the check about exactly that defect class.

## What's next

- [P0] T-003 Session identity is keyed per project, not per session
- [P0] T-008 Add a `/sync` validator that stats every MCP command path in `~/.claude.json`
- [P0] T-014 Make point-of-use rating reachable
- [P0] T-022 Replace-on-write for `state` facts
- [P0] T-023 Improve state-side classifier precision

## Decisions

- 2026-09-17 — Loop 13 is Idea B - the module boundary — Aaron ruled, against the alternative of G-026 (recall precision), which he had earlier pencilled in. The Planner argued for Idea B and not on the grounds that it was owed a turn: G-026's urgency is contingent on recall being USED, and three consecutive loops have now run with zero recalls, so tuning precision on a system nobody queries optimises a thing whose value is unestablished. Idea B - core installable with Node and git, memory an opt-in module - is the instrument for the question open since Loop 9: not 'does injection change behaviour', which Loop 10 answered, but 'does the memory half get used at all'. Idea B had been scheduled as Loop 7 and displaced four times, every time into a loop that had its own subject, by the sentence 'it fits cleanly with what we are already touching' - a sentence the Planner itself wrote about the lifecycle cut four hours before quoting the pattern back.
- 2026-09-17 — ADR-031 - a sign-off transfers across an amend only when the amend is provably disjoint — Refines 'a sign-off does not transfer across an amend', which made every post-QA prose fix cost a re-QA and therefore made the cheap path be not fixing prose, or amending quietly. New rule: it transfers when the amend is provably disjoint from what was signed, and PROVABLY MEANS A DIFF THE QA SEAT CAN RUN - in practice `git diff --stat <signed-sha> HEAD -- <executable paths>` handed over showing empty. Paired with the error-table admission rule: the table records a wrong claim that reached an artifact, a commit, a counterpart or Aaron; a near-miss caught in-process by its own author goes in a separate register as an instance of a named family, never numbered. THE DIVIDING LINE IS ESCAPE, NOT SEVERITY. Both rules exist to stop a correctness rule taxing the behaviour it wants - a rule that adds a row every time someone checks their own work makes checking your own work look like failure. Requested by the seat that stood to benefit from the looser rule, after noticing it had already drafted the entry before asking.
- 2026-09-17 — Forge may publish its own loop branches — Aaron, resolving an inconsistency the Planner surfaced rather than used: Loop 11's Developer pushed loop/11-instructions and opened PR #18 under what it believed were the same instructions, while Forge held a standing 'tag, never push'. One instruction, two readings, a whole loop apart. Forge pushes and opens the PR; the Planner tags the merge commit on master. Loop 12 cost a few hours of an unopened PR because Forge declined to publish on a peer's say-so and then declined again on a relay of Aaron's answer, confirming with Aaron directly instead. Recorded as the right price rather than an over-caution: a peer cannot extend reserved authority, and a relay of an answer is still the same channel.
- 2026-09-17 — Retire the agent mailbox - SIA channel only — Aaron: 'the mailbox was pre-A2A and should be retired. HoH with A2A solves the agent-to-agent communication issue', scoped on ruling to the sia channel alone. ~/.agents/mailbox/ served NINE channels, eight non-empty, and seven belong to other projects (nexcrm has three named seats; worthit and TCM were missed in the first enumeration because it was read off a truncated `head -25`). Executed: all three records preserved in docs/loops/sia-mailbox-*.md with the decisions log verified at 67 entries IN THE MASTER COPY before deletion; 18 files removed; the other eight channels counted before and after and unchanged. The brief's framing 'decisions -> state.json decisions[]' was WRONG - the mailbox log holds 67 entries from 2026-04-16 and state.json holds 43 from 2026-03-22, two different records that overlap without matching.
- 2026-09-17 — ADR-029 (D-004) adopted as written - the record catching up to code that has run under it for three loops — Aaron adopted it on 2026-09-17, asked directly and answered directly. D-004 had stood as 'RECOMMENDED not yet adopted - Aaron rules (T-129)' since 2026-09-15. It was never a pending direction: Loops 8, 10 and 11 implemented all of it. matureBoost and provenBoost are 1.0, the apoptosis gate is off, the maturity lifecycle and success_rate are cut, session-start retrieval is kept. THE CODE HAD BEEN LIVING UNDER THIS DECISION FOR THREE LOOPS WHILE THE RECORD SAID NOBODY HAD MADE IT - which is Loop 11's defect class arriving in the decision log rather than in prose: a record describing a state the system had already left. Recorded as its own decision rather than by editing D-004, because ob_state has no update_decision op and because the sequence is worth keeping: recommended 2026-09-15, implemented across three loops, formally adopted 2026-09-17. NOT DECIDED BY THIS: whether the suspension should ever be reversed - D-004's own trigger language stands - and the $declined retirement of success_rate, Maturity and Rating, which Aaron deferred to Loop 13 on the same day. The behaviour is cut; the vocabulary and the column are not, and recording that as finished would make the retirements check green on an unfinished cut.
<!-- state:end -->
## Architecture Overview

3-tier hub-and-spoke memory protocol:

| Tier | Location | Purpose |
|---|---|---|
| **Global** | `~/Obsidian Vault/` + `CLAUDE.md` | Cross-project experiences, reusable skills, user preferences |
| **Domain** | Tagged experiences in vault | Stack-specific knowledge (Convex patterns, Stripe gotchas, etc.) |
| **Project** | `.agents/` in each repo | Project-specific context (PRD, tasks, session logs) |

## Search Architecture (v0.6.0)

| Store | Search type | Access |
|---|---|---|
| SQLite FTS5 (knowledge-v2.db) | Keyword + snippet | `kb_recall` via open-brain MCP |
| Obsidian (Summaries/) | Semantic embeddings | `smart-connections__lookup` |
| SQLite vec (knowledge.db) | Semantic vector | Disabled — v1 IDs stale, rebuild pending |

## Key Distinction

- **Self-Improving Agent** = the memory protocol (how knowledge flows across sessions)
- **AI-First Development Framework** = the project template (how projects are structured for AI agents)
- These are complementary layers distributed from this repo, but they are not the same thing

## Research Context (Session 8)

Gap analysis against next-gen frameworks (STEM Agent, Memory-as-a-Tool, Anthropic Harness, Karpathy autoresearch). Full details: `docs/gap-analysis-next-gen-frameworks.md`. Knowledge base entries: IDs 155-161.
