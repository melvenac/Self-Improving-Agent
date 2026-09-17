<!-- generated from .agents/state.json rev 20 by open-brain v0.36.0 — do not edit; change state via ob_state -->

# Inbox

Legend: `[ ]` open · `[~]` in_progress · `[!]` blocked

Titles only. Full rationale for a task is its `note` in `.agents/state.json` under `tasks[]` — read it when you work the task, not when you pick one.

## P0

- [ ] **T-003** Session identity is keyed per project, not per session
- [ ] **T-008** Add a `/sync` validator that stats every MCP command path in `~/.claude.json`
- [ ] **T-014** Make point-of-use rating reachable
- [ ] **T-022** Replace-on-write for `state` facts
- [ ] **T-023** Improve state-side classifier precision
- [ ] **T-024** Rewrite the two genuine `obsolete-reference` hits
- [ ] **T-025** Reconcile the experience `type` field across three sources
- [ ] **T-031** Add agent attribution to sessions
- [ ] **T-034** Move the session-start recall into `cli-bootstrap`
- [ ] **T-042** Vault pollution has a preventer but no detector
- [ ] **T-044** The slot needs an OWNER, not just a timestamp
- [ ] **T-149** Give each agent seat its own git worktree
- [ ] **T-150** An unrecognised CLI flag must refuse, not select the mutating default

## P1

- [ ] **T-045** Verify the vault-isolation leak stays closed
- [ ] **T-046** Cursor + Git Bash: PowerShell hook wrapper fail-closes every tool
- [ ] **T-048** Audit remaining filters in `open-brain/src` for bare `continue`/`filter` drops (supersedes T-049)
- [ ] **T-050** v0.15.1 made a foreign `.recalled-entries.json` writer unreachable *and* uncountable
- [ ] **T-051** Add a `/sync` validator for the `.agents/skills/` frontmatter contract, asserting all three identity sources agree
- [ ] **T-055** GitNexus's incremental analyze is unreliable on this repo
- [ ] **T-056** `ob_store` derives the vault folder from a canonicalized path, so it lowercases the project name
- [ ] **T-057** `ob_feedback`'s `referenced` argument does not exist
- [ ] **T-061** Collect shadow-recall sessions
- [ ] **T-065** Port `cli.ts` off the v1 database, then repoint `paths.knowledgeDb`
- [ ] **T-067** Close the remaining 153 open checkboxes across session logs
- [ ] **T-074** Rewrite /checkpoint as vault-first ob_store_chunk
- [ ] **T-091** v0.7.1 .gitignore patch
- [ ] **T-093** Archive Atlas-Forge mailbox thread
- [ ] **T-146** Run the recency sweep at 0.01 / 0.02 / 0.04
- [ ] **T-148** The note is required before you RETIRE a task, not only before you work one

## P2

- [ ] **T-101** Commit the entry-455 archive move as one commit
- [ ] **T-102** Distil and sanitise the v1 stores into v2, then retire the v1 vault
- [ ] **T-103** Retire the mailbox as *transport*, keep it as *archive (supersedes T-104)
- [ ] **T-105** Look into how checkpoints are tagged
- [ ] **T-114** Update /start monthly maintenance

## Done (last 3 sessions)

- [x] **T-053** Add a `/sync` check that `success_rate` agrees with its own counters (session 61) — Closed as moot (session 61, verified against 6af5592): success_rate was CUT in Loop 10 C2 (E4b). No computation remains in open-brain/src — db-v2.ts:457 records that the recomputation is gone, and new databases do not declare the column. A /sync check that success_rate agrees with its counters has nothing that could drift. Separate and still open: the handoff question of whether to drop the inert column from live databases.
- [x] **T-054** The automatic feedback path never evaluates the maturity lifecycle (session 61) — Closed as moot (session 61, verified against 6af5592): the maturity lifecycle was SUSPENDED and deleted in Loop 10 C2 (E3), apoptosis with E18. No evaluateLifecycle function exists anywhere in open-brain/src — only comments recording the cut — and auto-feedback.ts is gone from the tree entirely. The automatic feedback path cannot fail to evaluate a lifecycle that no longer exists. This also retires the substance of G-018, which named auto-feedback.ts's divergent second copy.
- [x] **T-071** Verify context-mode hook fixes (session 61) — Closed as stale, not wrong (session 61, Aaron's call relayed via Clark). Opened session 30, age 31 sessions, and left in_progress the whole time — started and abandoned. Recoverable from state.json history at 6af5592 if ever wanted back.
- [x] **T-086** Re-tag the 28 oversized experience clusters (session 61) — Closed as stale, not wrong (session 61, Aaron's call relayed via Clark). Opened session 40; lost 21 consecutive prioritisation contests without being picked. Recoverable from state.json history at 6af5592 if ever wanted back.
- [x] **T-090** Verify SESSION_UUID against a LIVE session (session 61) — Closed as stale, not wrong (session 61, Aaron's call relayed via Clark). Opened session 40; lost 21 consecutive prioritisation contests without being picked. Recoverable from state.json history at 6af5592 if ever wanted back.
- [x] **T-100** `open-brain end` (cli.ts:146) still runs the v1 session-end pipeline, which carries a divergent `evaluateLifecycle` (session 61) — Closed as moot (session 61, verified against 6af5592): the v1 session-end pipeline was CUT (E26) and the end subcommand is gone from cli.ts — no case "end" remains in its 372 lines. There is no longer a second code path carrying a divergent evaluateLifecycle, because there is no longer an evaluateLifecycle.
- [x] **T-123** Improve TCM project skills with enhanced skill-creator (session 61) — Closed as stale, not wrong (session 61, Aaron's call relayed via Clark). Opened session 13; lost 48 consecutive prioritisation contests without being picked. Recoverable from state.json history at 6af5592 if ever wanted back.
- [x] **T-125** Scope 3: Code maintainability eval (session 61) — Closed as stale, not wrong (session 61, Aaron's call relayed via Clark). Opened session 15; lost 46 consecutive prioritisation contests without being picked. Recoverable from state.json history at 6af5592 if ever wanted back.
- [x] **T-126** Context efficiency auto-optimization (session 61) — Closed as stale, not wrong (session 61, Aaron's call relayed via Clark). Opened session 17; lost 44 consecutive prioritisation contests without being picked. Recoverable from state.json history at 6af5592 if ever wanted back.
- [x] **T-127** Scope 4: True self-improving loop for the protocol itself (session 61) — Closed as stale, not wrong (session 61, Aaron's call relayed via Clark). Opened session 15, age 46 sessions, and left in_progress the whole time — started and abandoned, which is stronger evidence of staleness than never being picked. Recoverable from state.json history at 6af5592 if ever wanted back.
- [x] **T-128** Cross-platform UUID discovery (session 61) — Closed as stale, not wrong (session 61, Aaron's call relayed via Clark). Opened session 21; lost 40 consecutive prioritisation contests as the only P3 in the backlog. Recoverable from state.json history at 6af5592 if ever wanted back.
- [x] **T-145** Rule on Loop 7 C2: keep retrieval, suspend the maturity lifecycle (session 61) — Closed as DONE (session 61, verified against 6af5592): this asked Aaron to rule on Loop 7 C2 — keep retrieval, suspend the maturity lifecycle. Loop 10 ruled exactly that. docs/loops/loop-10-c2-verdicts.md records E3 (maturity lifecycle + counters) SUSPENDED, E18 (apoptosis gate) SUSPENDED on the same trigger, E9b SUSPENDED, and P1 (/start recall injection, =E28) SUSPENDED, against 14 KEEP / 9 CUT / 4 SUSPENDED overall. ob_recall stays. Closed as done rather than moot: the deliverable was a decision and the decision was made.
- [x] **T-147** Triage the 39 pending skill-proposal clusters (session 61) — Closed as moot (session 61, verified against 6af5592): the skill scan and proposal machinery were CUT (E8/P7). Nothing in open-brain/src writes .skill-proposals-pending.json; the sole surviving mention is a comment in session-start/health-checks.ts:119 noting the file is left on disk. There are no longer 39 pending clusters being generated to triage. Note the stale file itself may still sit on disk unannounced — that is V-021's recorded property, not this task.
