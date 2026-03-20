# Self-Improving Agent Protocol

> Quick reference for AI agents. For the full guide, see `~/Obsidian Vault/Guidelines/SELF-IMPROVING-AGENT-GUIDE.md`.

## Architecture

3-tier hub-and-spoke: **Global** (CLAUDE.md + Open Brain + Obsidian) → **Domain** (tagged experiences) → **Project** (.claude + .agents).

## Retrieval (via /recall or project /start)

1. `kb_recall` with project name + domain tags → max 3 experiences
2. Read `~/Obsidian Vault/Guidelines/SKILL-INDEX.md` → max 2 skills
3. Check `.skill-proposals-pending.json` for new cluster notifications
4. Present as non-prescriptive guidance

## Accumulation (at /end, steps 9-10)

1. Extract gotchas/lessons from session log
2. Format as `[EXPERIENCE]` block (PROJECT, DOMAIN, DATE, TYPE, TRIGGER, ACTION, CONTEXT, OUTCOME)
3. Dedup via `kb_recall` before `kb_store`
4. Store session summary via `kb_store_summary`
5. If 3+ similar experiences → propose skill to Aaron (never auto-create)

## Experience Format

```
[EXPERIENCE] {short-title}
PROJECT: {name}
DOMAIN: {tags}
DATE: {YYYY-MM-DD}
TYPE: {gotcha | pattern | decision | fix | optimization}

TRIGGER: {when relevant}
ACTION: {what to do}
CONTEXT: {what was happening}
OUTCOME: {what happened}
```

## Feedback Loop (automatic via SessionEnd hook)

The skill-scan hook runs after vault-writer at every session end:

1. Scan all `~/Obsidian Vault/Experiences/*.md` files
2. Cluster by frontmatter tags (filter noise tags like `gotcha`, `test`)
3. Diff against `SKILL-CANDIDATES.md` — detect new/growing clusters
4. Update `SKILL-CANDIDATES.md` with fresh scan results + diff table
5. Write `.skill-proposals-pending.json` if new clusters cross 3+ threshold
6. Log scan summary to `.vault-writer.log`

**This is the compound loop:** each session adds experiences → skill-scan detects emerging patterns → proposes skills when clusters form → agent gets smarter over time.

Hook order: `auto-index.mjs` → `vault-writer.mjs` → `skill-scan.mjs`

## Guardrails

- Max 3 experiences + 2 skills per session start
- Always dedup before storing
- Never auto-create skills (ask user, 3-experience minimum)
- Non-prescriptive — all retrieved knowledge is guidance
- Monthly `kb_prune`
