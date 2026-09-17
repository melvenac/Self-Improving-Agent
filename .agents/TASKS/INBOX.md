<!-- generated from .agents/state.json rev 14 by open-brain v0.35.0 — do not edit; change state via ob_state -->

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
- [ ] **T-145** Rule on Loop 7 C2: keep retrieval, suspend the maturity lifecycle

## P1

- [ ] **T-045** Verify the vault-isolation leak stays closed
- [ ] **T-046** Cursor + Git Bash: PowerShell hook wrapper fail-closes every tool
- [ ] **T-048** Audit remaining filters in `open-brain/src` for bare `continue`/`filter` drops (supersedes T-049)
- [ ] **T-050** v0.15.1 made a foreign `.recalled-entries.json` writer unreachable *and* uncountable
- [ ] **T-051** Add a `/sync` validator for the `.agents/skills/` frontmatter contract, asserting all three identity sources agree
- [ ] **T-053** Add a `/sync` check that `success_rate` agrees with its own counters
- [ ] **T-054** The automatic feedback path never evaluates the maturity lifecycle
- [ ] **T-055** GitNexus's incremental analyze is unreliable on this repo
- [ ] **T-056** `ob_store` derives the vault folder from a canonicalized path, so it lowercases the project name
- [ ] **T-057** `ob_feedback`'s `referenced` argument does not exist
- [ ] **T-061** Collect shadow-recall sessions
- [ ] **T-065** Port `cli.ts` off the v1 database, then repoint `paths.knowledgeDb`
- [ ] **T-067** Close the remaining 153 open checkboxes across session logs
- [~] **T-071** Verify context-mode hook fixes
- [ ] **T-074** Rewrite /checkpoint as vault-first ob_store_chunk
- [ ] **T-086** Re-tag the 28 oversized experience clusters
- [ ] **T-090** Verify SESSION_UUID against a LIVE session
- [ ] **T-091** v0.7.1 .gitignore patch
- [ ] **T-093** Archive Atlas-Forge mailbox thread
- [ ] **T-146** Run the recency sweep at 0.01 / 0.02 / 0.04
- [ ] **T-147** Triage the 39 pending skill-proposal clusters

## P2

- [ ] **T-100** `open-brain end` (cli.ts:146) still runs the v1 session-end pipeline, which carries a divergent `evaluateLifecycle`
- [ ] **T-101** Commit the entry-455 archive move as one commit
- [ ] **T-102** Distil and sanitise the v1 stores into v2, then retire the v1 vault
- [ ] **T-103** Retire the mailbox as *transport*, keep it as *archive (supersedes T-104)
- [ ] **T-105** Look into how checkpoints are tagged
- [ ] **T-114** Update /start monthly maintenance
- [ ] **T-123** Improve TCM project skills with enhanced skill-creator
- [ ] **T-125** Scope 3: Code maintainability eval
- [ ] **T-126** Context efficiency auto-optimization
- [~] **T-127** Scope 4: True self-improving loop for the protocol itself

## P3

- [ ] **T-128** Cross-platform UUID discovery

## Done (last 3 sessions)

- [x] **T-004** The lifecycle bundle's remaining three parts stay BLOCKED (session 59) — Resolved by Loop 8 R1 rather than unblocked. The maturity multipliers go to 1.0 and the apoptosis gate sits behind a new apoptosisEnabled flag, off, with counters and promotion still recording. That makes parts 1 and 2 — the success_rate denominator fix and the threshold re-tune — unnecessary rather than blocked: with no live threshold there is nothing to miscalibrate. Reversible by restoring three constants, and evaluateLifecycle now takes an optional config so the suspension is provable in both directions by test.
- [x] **T-032** Add `trigger TEXT` to `recall_log` (session 58) — Shipped and populated. recall_log.recall_trigger exists in the db-v2 DDL and carries data: start 245, explicit 254, checkpoint 100, unspecified 11, NULL 637 (pre-column). Verified by direct query during session 58. This is load-bearing rather than cosmetic - it lifted one of the three primary blockers the injection-ablation pre-registration named, and made the start-vs-explicit contrast in the Loop 7 C1 reconciliation computable for the first time.
- [x] **T-052** Watch for the first real `harmful` rating (session 58) — Fired. Session 6111e9ab rated entry 556 harmful on 2026-09-15 via ob_feedback (rating_method='direct'), and entry 558 supersedes 556 as the correction. That is the first harmful rating reachable through a live path; the store now holds 3 all-time (416, 434, 556), max 1 per entry. Verified by direct read of feedback_log during session 58. Note what made it reachable: an agent checked a stored claim against source and found it wrong - not a threshold or a prompt change.
