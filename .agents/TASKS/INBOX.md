<!-- generated from .agents/state.json rev 49 by open-brain v0.42.0 — do not edit; change state via ob_state -->

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

## P2

- [ ] **T-101** Commit the entry-455 archive move as one commit
- [ ] **T-102** Distil and sanitise the v1 stores into v2, then retire the v1 vault
- [ ] **T-103** Retire the mailbox as *transport*, keep it as *archive (supersedes T-104)
- [ ] **T-114** Update /start monthly maintenance
- [ ] **T-156** A scan that matches the sentence forbidding a thing, as though it were the thing (G-040): every source-text scan in the harness tests must be validated against a known positive and a known negative in the same test, or replaced by a parser

## Done (last 3 sessions)

_None retained._
