# Rules & Conventions

## General Rules

1. **All knowledge is plain markdown** — no proprietary formats, no databases as primary store
2. **Never auto-create skills** — always propose to Aaron, 3-experience minimum required
3. **Context cap** — max 3 experiences + 2 skills injected per session start
4. **Always dedup before storing** — check vault for >90% similarity before writing new experiences
5. **Non-prescriptive** — all retrieved knowledge is guidance, not mandates; override based on current context
6. **Keep `project-template/` in sync, don't diverge from it** — it is the distributable copy and it lives in this repo; there is no separate template repo to develop it in. `/sync`'s `command-parity` check compares `.claude/commands/`, `project-template/.claude/commands/` and `~/.claude/commands/` and fails when a shared command differs, so a command fixed in one place must be copied to all three in the same commit. (This rule previously read "Don't modify `project-template/`", which forbade what `command-parity` requires.)
7. **Component lifecycle is governed by [`LIFECYCLE.md`](../LIFECYCLE.md)** — the add/track/prune policy, and the source of the CUT/KEEP vocabulary the evaluation loops rule with. Read it before proposing to add or remove a skill, hook or slash command.

## Documentation Standards

- Getting-started guides are **agent-guided** — written so a user can follow them step-by-step with their AI agent coaching each action
- How-it-works docs are technical but accessible; use diagrams where helpful
- All docs use GitHub-flavored markdown
- Code examples should be copy-pasteable

## Script Conventions

- The hooks and MCP server are TypeScript in `open-brain/src/`, compiled to `open-brain/build/`. The last standalone `.mjs` is `scripts/setup.mjs`.
- Hook errors are logged, never silently swallowed; `cli-session-end.js` exits 0 on error so a failed hook cannot fail the session.
- Scripts read Claude Code `.db` files via `better-sqlite3`
- One SessionEnd hook: `open-brain/build/cli-session-end.js`. Its pipeline stages run in order (summary → auto-feedback → invocation logging → shadow recall → topics) and the order is enforced in `pipelines/session-end/index-v2.ts`, not by hook registration.
- Experience entries must include a `## CONCEPTS` line with domain concept tags for auto-feedback domain-overlap matching

## Git Conventions

- Branch naming: `feature/`, `fix/`, `docs/`, `loop/<n>-<subject>`
- Commit messages: concise, focus on "why" not "what"
- CHANGELOG.md updated with every version bump
- Annotated git tags for releases (`vX.Y.Z`)
- Push tags alongside code: `git push origin <branch> --tags`

### Branch shape — a release tag and a session close-out must not share a branch

**Loop 10 R4.** The close-out goes in **its own PR off `master`**, after the release PR merges.

**Why, and it is by construction rather than by accident.** A release branch is QA'd and signed
off at a frozen SHA. Committing the session close-out onto that same branch moves it. The SHA
the reviewer verified and the SHA the PR points at then **diverge every time** — not when
someone is careless, but always. A sign-off does not transfer across an amend, and here the
amend is guaranteed rather than possible.

Loop 8 and Loop 9 both did this. It is recorded here, in the protocol, rather than only in the
agent channel, because an intention held in a message is what the fresh-session rule and the
skill queue both died of.

**The sequence:** freeze → QA read-only → tag → draft PR → merge on Aaron's word → *then* a
separate close-out PR off the new `master`. If the tree moves after a freeze, say so.

## Release Checklist

| Step | Patch (Z bump) | Minor (Y bump) | Major (X bump) |
|---|---|---|---|
| `/sync` (versions + Scope 1 structural) | Required | Required | Required |
| `/harness-audit` (Scope 2 semantic) | Skip | Required | Required |
| CHANGELOG entry | Required | Required | Required |
| README update | If relevant | Required | Required |
| Tag + push | Required | Required | Required |

## Command Architecture (PENDING — see INBOX P1)

- **Global commands** (`~/.claude/commands/`): vault-level operations only
- **Project commands** (`.claude/commands/`): `.agents/` operations only
- **Current state:** these boundaries are blurred — global commands contain project-level logic
- Resolution is tracked as a P1 architecture issue

## Agent-Specific Rules

1. Run `/start`. It calls `ob_start`, which returns the state record; with a valid `state.json` that REPLACES SUMMARY.md, INBOX.md, task.md and next-session.md — do not open them to fill a gap it did not leave.
2. Priorities come from the same `ob_start` payload. A task's rationale is its `note` in `state.json`, read when you work it, not when you pick it.
3. **Never hand-edit SUMMARY.md, INBOX.md, task.md or next-session.md when `state.json` exists** — they are rendered views, and a hand edit is overwritten by the next render. Write state through `ob_state`.
4. Log decisions in DECISIONS.md with ADR format, and index each one with an `add_decision` op in the same `ob_state` call.
5. **The state record and the instruction surface are tracked; working material is not.** Tracked: `state.json` and its four rendered views, and every file that tells an agent what to do in a session — `CLAUDE.md`, `.claude/commands/`, `.agents/AGENT.md`, `LIFECYCLE.md`, `SYSTEM/RULES.md`, `RUNBOOK.md`, `SECURITY.md`, `TESTING.md`, `domains.json` and `.agents/skills/`. Local by intent: session logs, `archive/`, working task specs, `.claude/settings.local.json` and third-party plugin skills.

   **Authority: Aaron's ruling of 2026-09-17, carried out in PR #17 (`chore(vcs): track the instruction surface`), which rewrites `.gitignore` and tracks the surface.** Not the audit's judgment — Loop 11 found this rule false and deliberately left it alone, because policy is not an auditor's to overturn.

   This rule previously read *"Never commit `.agents/` or `.claude/` to this repo (gitignored)"*. It was false three ways: against PR #17; against the close-out, which commits `state.json` and the four views every loop with `/sync` passing (PR #16); and against Aaron's instruction. It was also in a file with no history of its own, so nobody could say who set it or when — which is what Loop 11 was spent removing everywhere else.
