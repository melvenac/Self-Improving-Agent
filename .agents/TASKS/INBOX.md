<!-- generated from .agents/state.json rev 43 by open-brain v0.41.0 — do not edit; change state via ob_state -->

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

## Done (last 3 sessions)

- [x] **T-153** Move the Developer worktree from ~/Projects/sia-forge to ~/Worktrees/sia-forge (session 65) — Done 2026-09-19. `git worktree move ~/Projects/sia-forge ~/Worktrees/sia-forge`, run from outside the folder after the developer session had exited and said so plainly. All four checkouts now sit where they belong: the main tree as infrastructure, and Atlas, Forge and Probe side by side under ~/Worktrees/. VERIFIED BY READING THE FILESYSTEM, NOT THE COMMAND'S OUTPUT: the new path exists, the old one does not, `git worktree list` shows four entries, the tree is clean at d50ef67, and `cli-bootstrap.js` run in the new location still greets 'Forge (developer) - partner: Atlas' - which matters because .agents/AGENT.local.md is untracked and a delete-and-recreate would have destroyed the seat identity silently. Both deliberately preserved local branches survived: loop/7-injection (unmerged, which is the only thing protecting it) and docs/loop-13-developer-testimony (kept locally so its commit stays reachable). The .git pointer still reads .git/worktrees/sia-loop12, a name two renames old - LEFT ALONE, as recorded: git resolves it and repairing it is how it breaks. THE PREDICTED FAILURE DID NOT OCCUR. The record warned to expect `Permission denied` on the first attempt and retry from outside the folder, because that happened on both moves the previous day. It moved first time. Either running from outside was the difference, or the earlier failures were the live session holding the directory - unresolved, and worth knowing rather than carrying forward as certain. ORDERING, WHICH THE DEVELOPER GOT RIGHT AND THE PLANNER HAD BACKWARDS: push and merge the session record FIRST, then exit, then move. The developer's close-out existed only in that directory as an unpushed commit; moving first would have made the entire session's record depend on a directory operation succeeding, for no gain.
- [x] **T-151** Add .gitattributes — the suite fails in a fresh Windows clone and three instruments call it green (session 64) — Already satisfied at 669902c and verified independently by both seats before either mentioned it to the other. .gitattributes exists and carries its own derivation (T-151, session 62: core.autocrlf=true with no .gitattributes commits LF and checks out CRLF, so a FRESH CLONE failed two assertions in state-views.test.ts while the long-lived tree and Linux CI both passed). All 19 files in docs/loops/ are LF in the working tree, measured file by file. CONSEQUENCE FOR THE VIEWS: the session-63 watch-out 'Line endings are MIXED in this repo - .agents/AGENT.md is LF, docs/loops/*.md is CRLF' is STALE and should not be carried forward by the next /end. It was true when written and was falsified by the fix landing.
