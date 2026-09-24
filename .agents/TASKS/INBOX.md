<!-- generated from .agents/state.json rev 115 by open-brain v0.44.1 — do not edit; change state via ob_state -->

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
- [ ] **T-046** Cursor + Git Bash: PowerShell hook wrapper fail-closes every tool
- [ ] **T-149** Give each agent seat its own git worktree
- [ ] **T-150** An unrecognised CLI flag must refuse, not select the mutating default
- [ ] **T-158** close_gap must tombstone (or refuse an id the tracked tree cites) — a reused gap id points at something wrong and announces nothing
- [ ] **T-163** Close-outs must APPEND a per-seat record, not overwrite a shared slot — plus a /sync check that no close-out reduces the recorded seat-uuid count for an open loop
- [ ] **T-164** The session counter is per-worktree, so a seat can close out on a number that collides with the record's sequence
- [ ] **T-167** The scope layer did not travel: PRD/DECISIONS/ENTITIES were untracked, so no seat worktree had them — tracked at session 77; make prd-version an ISSUE, and render the problem statement at /start
- [ ] **T-177** Candidate A2 is blocked: the developer seat's responses were stopped twice by a host safety classifier, and slice three cannot close until A2 is built or re-planned

## P1

- [ ] **T-045** Verify the vault-isolation leak stays closed
- [ ] **T-048** Audit remaining filters in `open-brain/src` for bare `continue`/`filter` drops (supersedes T-049)
- [ ] **T-050** v0.15.1 made a foreign `.recalled-entries.json` writer unreachable *and* uncountable
- [ ] **T-051** Add a `/sync` validator for the `.agents/skills/` frontmatter contract, asserting all three identity sources agree
- [ ] **T-055** GitNexus's incremental analyze is unreliable on this repo
- [ ] **T-056** `ob_store` derives the vault folder from a canonicalized path, so it lowercases the project name
- [ ] **T-061** Collect shadow-recall sessions
- [ ] **T-065** Port `cli.ts` off the v1 database, then repoint `paths.knowledgeDb`
- [ ] **T-067** Close the remaining 153 open checkboxes across session logs
- [ ] **T-091** v0.7.1 .gitignore patch
- [ ] **T-093** Archive Atlas-Forge mailbox thread
- [ ] **T-146** Run the recency sweep at 0.01 / 0.02 / 0.04
- [ ] **T-148** The note is required before you RETIRE a task, not only before you work one
- [ ] **T-152** The test suite is not type-checked at all
- [ ] **T-154** Give /start a memory-free documented route, and make the SessionStart hook installable by a stranger
- [ ] **T-155** Shadow merge gate: the runtime records what it would have done at each merge, and disagreements with Aaron are counted
- [ ] **T-159** The trigger's cheap not-asked path — record a not-asked fire without opening the store
- [ ] **T-160** Hub transport: make silence unambiguous (push or long-poll), a Stop-hook seat wake, per-agent keys
- [ ] **T-161** /start must assert a transcript exists for the session's own uuid — the CLAUDE_CODE_CHILD_SESSION check would be a permanent false positive
- [ ] **T-166** GitNexus impact() missed a call site on the exact path under repair while reporting epistemic 'exact' - the MUST-run-impact rule is only as good as the resolver
- [ ] **T-168** 'Run the full suite alone' must become a check: assert peer idleness before the run and refuse or flag when a peer is busy
- [ ] **T-169** At Loop 15 close, rewrite PRD.md and README.md against what ships, take PRD.md off retirements.json's historical list, and retire the maturity lifecycle
- [ ] **T-170** Memory is LOOKUP by default and INJECTION only on a deterministic match against the act; fix the WRITE side first, so every stored lesson carries the key (command pattern, path or error string) that would have caught the mistake
- [ ] **T-172** The main tree serves every session and nothing says when it is behind master: the greeting must print the SERVING build's distance from origin/master, and one refusing command must update, rebuild and verify it
- [ ] **T-173** Per-stage effort chosen by a deterministic policy, with Jev in shadow. Sequenced AFTER candidate A (it needs ProcessRole)
- [ ] **T-175** `state import` seeds SIA's own history (V-001..V-005, G-001..G-006) into EVERY project's record. Delete the seeds from the importer
- [ ] **T-176** gitnexus-index measures distance in one direction only: an index on a different line of history reads as current
- [ ] **T-178** ci.yml runs on push to seat working branches (loop/*, qa/*, docs/*, chore/*), per D-040, so no seat has to dispatch CI by hand
- [ ] **T-179** Replace /end with a small 'store lessons' step: each session's lessons stored with the key that would have caught them (T-170); the record is written as work happens, and the rest of /end is cut

## P2

- [ ] **T-101** Commit the entry-455 archive move as one commit
- [ ] **T-102** Distil and sanitise the v1 stores into v2, then retire the v1 vault
- [ ] **T-103** Retire the mailbox as *transport*, keep it as *archive (supersedes T-104)
- [ ] **T-114** Update /start monthly maintenance
- [ ] **T-156** A scan that matches the sentence forbidding a thing, as though it were the thing (G-040): every source-text scan in the harness tests must be validated against a known positive and a known negative in the same test, or replaced by a parser
- [ ] **T-162** The element table's growth rule: the store cannot be consulted for act shapes the table does not name
- [ ] **T-165** Evaluate an alternate harness/model as the DEVELOPER seat via T-155's shadow merge gate — the driver is a SECOND METER, not cost; Aaron's named candidate is DeepSeek v4.1 Flash
- [ ] **T-171** update_task REPLACES a task's note, and neither the dry run nor the write says so: an op written to append a correction silently erases the whole note
- [ ] **T-174** Win32 job-object launcher so the role's whole process tree is killed on a NORMAL exit too (R22's named limit on Windows)

## Done (last 3 sessions)

_None retained._
