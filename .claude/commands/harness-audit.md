# /harness-audit — Deep Semantic Consistency Audit

> Scope 2 of the evaluation pipeline: whether the protocol's documents **agree with each other**.
> Structural checks — does each referenced file exist, do the mirrors match, is the version
> consistent — are `/sync`'s job (`ob_sync`). This command reads for contradictions between
> documents that `/sync` cannot see.
>
> **Required by `RULES.md` for every minor and major release.**

## Instructions

You are auditing the Self-Improving Agent protocol for semantic consistency. Read the full content of every protocol file and cross-reference claims between them. Don't compress — read raw content and reason about contradictions.

### Phase 1: Gather all protocol files

Read these files in parallel (use Agent tool with subagent_type=Explore if needed for large reads):

**Source of truth:**
- `package.json` — version
- `CHANGELOG.md` — what was actually shipped per version
- `~/.claude/settings.json` — actual hook configuration

**Documentation layer:**
- `README.md` — public-facing setup instructions and feature descriptions
- `CLAUDE.md` — agent instructions and architecture overview
- `.agents/SYSTEM/RULES.md` — conventions and procedures
- `.agents/SYSTEM/SUMMARY.md` — current project state

**Task tracking layer:**
- `.agents/TASKS/INBOX.md` — prioritized work items with status
- `.agents/TASKS/task.md` — current sprint focus

**Command layer:**
- `.claude/commands/start.md` — /start protocol
- `.claude/commands/end.md` — /end protocol
- `.claude/commands/sync.md` — /sync protocol
- `.claude/commands/checkpoint.md`, `task.md`, `test.md` — the remaining commands


**Code layer (read for purpose/usage comments):**
- `scripts/setup.mjs` — the only standalone script in the repo
- `open-brain/src/cli-bootstrap.ts` — the SessionStart hook
- `open-brain/src/cli-session-end.ts` — the SessionEnd hook
- `open-brain/src/pipelines/sync/checks.ts` — what `/sync` actually validates


### Phase 2: Cross-reference audit

For each pair, check for contradictions. Report findings in this format:

```
[CONFLICT] source_file:line ↔ target_file:line
  Source says: "..."
  Target says: "..."
  Resolution: which is correct and what to change

[STALE] file:line
  Says: "..."
  Reality: "..."
  Resolution: what to update

[DRIFT] file_a ↔ file_b
  Description of semantic mismatch
  Resolution: which to update
```

**Cross-reference matrix:**

| Check | Source of truth | Must agree with |
|---|---|---|
| Version numbers | `package.json` | README, SUMMARY, PRD, `open-brain/package.json` |
| Feature list | `CHANGELOG.md` | README feature descriptions |
| Hook pipeline | `settings.json` hooks | RULES.md hook order, README hook table |
| Script inventory | actual files in `scripts/` + `open-brain/src/` | README script list, RULES.md references |
| Architecture description | actual code structure | CLAUDE.md, SUMMARY.md, README |
| Completed work | `INBOX.md` `[x]` items | SUMMARY.md "what's broken/next" sections |
| Task alignment | `task.md` done items | INBOX.md status markers |
| Command behavior | slash command `.md` files | what the scripts actually do (read script headers) |
| Setup instructions | README manual setup steps | what `scripts/setup.mjs` actually does |
| Obsidian directories | README vault setup | actual vault structure, RULES.md references |
| Domain tags | `.agents/SYSTEM/domains.json` | SUMMARY.md domain references |

### Phase 3: Report

Present findings grouped by severity:

1. **CONFLICTS** — two documents actively contradict each other (highest priority)
2. **STALE** — a document describes something that's no longer true
3. **DRIFT** — documents have diverged but neither is strictly wrong
4. **CLEAN** — pairs that are consistent (brief summary)

End with a recommended fix list, ordered by impact.

### Phase 4: Fix (with approval)

For each finding, propose a specific edit. Apply fixes only after Aaron approves. Re-run `ob_sync` after fixes to verify the structural checks still pass.

## When to run

- Before releases (catch semantic drift before shipping)
- After major refactors (architecture descriptions go stale)
- Monthly (as part of /start periodic maintenance)
- When `/sync` passes but documentation still feels wrong
