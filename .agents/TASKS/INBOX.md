<!-- generated from .agents/state.json rev 33 by open-brain v0.40.0 — do not edit; change state via ob_state -->

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

## P2

- [ ] **T-101** Commit the entry-455 archive move as one commit
- [ ] **T-102** Distil and sanitise the v1 stores into v2, then retire the v1 vault
- [ ] **T-103** Retire the mailbox as *transport*, keep it as *archive (supersedes T-104)
- [ ] **T-114** Update /start monthly maintenance

## P3

- [ ] **T-153** Move the Developer worktree from ~/Projects/sia-forge to ~/Worktrees/sia-forge

## Done (last 3 sessions)

- [x] **T-151** Add .gitattributes — the suite fails in a fresh Windows clone and three instruments call it green (session 64) — Already satisfied at 669902c and verified independently by both seats before either mentioned it to the other. .gitattributes exists and carries its own derivation (T-151, session 62: core.autocrlf=true with no .gitattributes commits LF and checks out CRLF, so a FRESH CLONE failed two assertions in state-views.test.ts while the long-lived tree and Linux CI both passed). All 19 files in docs/loops/ are LF in the working tree, measured file by file. CONSEQUENCE FOR THE VIEWS: the session-63 watch-out 'Line endings are MIXED in this repo - .agents/AGENT.md is LF, docs/loops/*.md is CRLF' is STALE and should not be carried forward by the next /end. It was true when written and was falsified by the fix landing.
- [x] **T-057** `ob_feedback`'s `referenced` argument does not exist (session 62) — Closed by the STRIKE branch, which the note offered as one of two. `referenced` is gone from every copy: `/end` A14 now says `ob_feedback({id, rating})` — those two arguments and no others, citing server.ts:895-897 — and both Cursor mirrors were carrying the same false signature and were repaired too. `grep -rn "entry_id, rating, referenced"` across every mirror returns 0. The IMPLEMENT branch was not taken and its reasoning is not lost: the was-it-cited signal `referenced` would have carried is exactly what T-014 (point-of-use rating) still needs, and the 445 neutrals still hide it. Striking the argument does not answer that question, it just stops the instruction lying about being able to.
- [x] **T-074** Rewrite /checkpoint as vault-first ob_store_chunk (session 62) — Verified already satisfied rather than done this session. The note asked for checkpoint.md to write markdown to ~/Obsidian Vault v2/Checkpoints/ and index in the DB via ob_store_chunk instead of the dropped kb_store_chunk. checkpoint.md:19 already does exactly that, and its parameter block matches the live schema (content, key, category, tags, project_dir, phase — all present, session_id optional and omitted). What was NOT right was the key convention, which is a separate defect found and fixed this session: the command told the caller to put the project and phase INTO key while server.ts:1198 adds both itself.
- [x] **T-105** Look into how checkpoints are tagged (session 62) — Both halves answered. SEVERITY: the note said to check whether the duplicate tag reaches the clustering input before deciding — it cannot, because skill-scan was CUT in Loop 10 and executed off the prompt surface this session. There is no clustering input, so the v0.12.0 inflation risk is gone with it. CALLER: checkpoint.md instructed tags: ["checkpoint", "phase-{N}", "{project-slug}", ...] while server.ts:1209 already prepends `category`; the instruction now says tags: ["checkpoint" removed, ...domain tags]. The server still prepends category, so a caller that passes it will still double — that is the server's behaviour and it is unchanged, but nothing this repo instructs now triggers it. Found alongside the filename doubling, which was the sharper instance of the same shape.
